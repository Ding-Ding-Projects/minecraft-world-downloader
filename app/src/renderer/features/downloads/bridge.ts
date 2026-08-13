import bridgeSource from './bridge-host.js?raw';
import type { ProcessEvent, StudioApi } from '../../../shared/api';
import { BRIDGE_PROTOCOL, type CapturePayload } from './model';

/**
 * The renderer's half of the capture receiver.
 *
 * The renderer cannot open a socket and cannot write bytes to disk as they
 * arrive, so the receiver and the transfer engine run as a small Node process
 * started through the privileged bridge. This module owns that process: it
 * writes the script into the application's own data directory, starts it,
 * speaks its line protocol, and reports the honest truth about its state —
 * including "Node is not installed on this machine", which is a real answer and
 * not a failure to hide behind a spinner.
 *
 * The pairing token is generated here, handed over on the process's stdin, and
 * never placed on a command line, in an environment variable, in a settings
 * file, in an export or in local history. A command line is visible to every
 * other process on the machine; stdin is not.
 */

const SENTINEL = '@WDS-BRIDGE-1@';
const SCRIPT_DIRECTORY = 'download-capture';
const SCRIPT_NAME = 'bridge-host.js';

/**
 * The parent retains this process's stdout up to a hard ceiling and stops
 * relaying it once that is reached. Restarting well before the ceiling, while
 * nothing is transferring, keeps live reporting alive without ever interrupting
 * a transfer to do it.
 */
const STDOUT_BUDGET_BYTES = 40 * 1024 * 1024;
const STDOUT_CEILING_BYTES = 64 * 1024 * 1024;

export type BridgeStatus =
  | 'stopped'
  | 'starting'
  | 'listening'
  | 'failed'
  | 'unavailable'
  | 'degraded';

export interface BridgeState {
  status: BridgeStatus;
  /** The port actually bound, which may differ from the requested one. */
  port: number;
  /** The pairing token for this session. Regenerated on every start. */
  token: string;
  /** The exact reason for `failed`, `unavailable` or `degraded`. */
  error: string;
  /** The Node version that is running the receiver, once it has reported one. */
  nodeVersion: string;
  processId: string | null;
  startedAt: string | null;
}

export interface TransferSpec {
  id: string;
  url: string;
  destination: string;
  referrer?: string;
  totalBytes?: number | null;
  overwrite?: boolean;
  resume?: boolean;
}

export interface TransferStateEvent {
  type: 'state';
  id: string;
  state: string;
  received: number;
  total: number | null;
  destination: string;
  partPath: string;
  startedAt: string;
  updatedAt: string;
  resumable: boolean;
  error?: string;
  note?: string;
  finishedAt?: string;
  bytesOnDisk?: number;
  serverFilename?: string | null;
  contentType?: string | null;
  resumedFromBytes?: number;
}

export interface TransferProgressEvent {
  type: 'progress';
  id: string;
  received: number;
  total: number | null;
  bytesPerSecond: number;
  etaSeconds: number | null;
  state: string;
}

export interface ProbeEvent {
  type: 'probe';
  id: string;
  ok: boolean;
  status?: number;
  url?: string;
  totalBytes?: number | null;
  filename?: string;
  contentType?: string;
  acceptsRanges?: boolean;
  error?: string | null;
}

type BridgeEvent =
  | { type: 'ready'; protocol: number; pid: number; node: string }
  | { type: 'listening'; port: number }
  | { type: 'listen-error'; port: number; message: string }
  | { type: 'capture'; capture: CapturePayload }
  | { type: 'stopping' }
  | { type: 'pong'; at: string; port: number; transfers: number }
  | { type: 'error'; id?: string; message: string }
  | TransferStateEvent
  | TransferProgressEvent
  | ProbeEvent;

type Listener<T> = (value: T) => void;

function randomToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

class Emitter<T> {
  private readonly listeners = new Set<Listener<T>>();

  add(listener: Listener<T>): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(value: T): void {
    for (const listener of [...this.listeners]) {
      try {
        listener(value);
      } catch {
        /* one listener throwing never stops the others from being told */
      }
    }
  }
}

export class DownloadBridge {
  private studio: StudioApi | null = null;
  private processId: string | null = null;
  private unsubscribe: (() => void) | null = null;
  private buffer = '';
  private stdoutBytes = 0;
  private requestedPort = 0;
  private stderr = '';
  private restarting = false;

  private current: BridgeState = {
    status: 'stopped',
    port: 0,
    token: '',
    error: '',
    nodeVersion: '',
    processId: null,
    startedAt: null
  };

  readonly stateChanged = new Emitter<BridgeState>();
  readonly captured = new Emitter<CapturePayload>();
  readonly transferState = new Emitter<TransferStateEvent>();
  readonly transferProgress = new Emitter<TransferProgressEvent>();
  readonly probed = new Emitter<ProbeEvent>();

  /** True while a transfer is moving bytes, which suppresses an idle restart. */
  activeTransfers = 0;

  attach(studio: StudioApi): void {
    this.studio = studio;
  }

  state(): BridgeState {
    return { ...this.current };
  }

  private update(patch: Partial<BridgeState>): void {
    this.current = { ...this.current, ...patch };
    this.stateChanged.emit(this.state());
  }

  /** Absolute path of the script the receiver runs, inside the app's own data. */
  scriptPath(): string {
    const studio = this.studio;
    if (!studio) return '';
    const root = studio.info.userDataDir.replace(/[\\/]+$/, '');
    const separator = root.includes('\\') && !root.startsWith('/') ? '\\' : '/';
    return `${root}${separator}${SCRIPT_DIRECTORY}${separator}${SCRIPT_NAME}`;
  }

  private directoryPath(): string {
    const path = this.scriptPath();
    const cut = Math.max(path.lastIndexOf('\\'), path.lastIndexOf('/'));
    return cut > 0 ? path.slice(0, cut) : path;
  }

  /**
   * Starts the receiver. Safe to call when it is already running: it stops the
   * previous process first, so the port is never left claimed by an orphan.
   */
  async start(port: number): Promise<BridgeState> {
    const studio = this.studio;
    if (!studio) {
      this.update({ status: 'failed', error: 'The privileged bridge is not available in this window.' });
      return this.state();
    }
    await this.stop();

    this.requestedPort = port;
    this.buffer = '';
    this.stdoutBytes = 0;
    this.stderr = '';
    const token = randomToken();
    this.update({ status: 'starting', error: '', token, port: 0, nodeVersion: '', startedAt: null });

    const directory = await studio.fs.ensureDirectory(this.directoryPath());
    if (!directory.ok) {
      this.update({
        status: 'failed',
        error: `The receiver script directory could not be created: ${directory.error}`
      });
      return this.state();
    }

    // Rewritten on every start rather than only when missing: a build that
    // changed the receiver must not keep running last version's copy.
    const written = await studio.fs.writeText(this.scriptPath(), bridgeSource);
    if (!written.ok) {
      this.update({ status: 'failed', error: `The receiver script could not be written: ${written.error}` });
      return this.state();
    }

    const spawned = await studio.process.spawn({
      command: 'node',
      args: [this.scriptPath()],
      maxOutputBytes: STDOUT_CEILING_BYTES
    });
    if (!spawned.ok) {
      this.update({
        status: 'unavailable',
        error:
          `The receiver could not be started: ${spawned.error}. ` +
          'It runs on Node, which this machine does not appear to have on its PATH.'
      });
      return this.state();
    }

    this.processId = spawned.value.id;
    this.update({ processId: spawned.value.id, startedAt: spawned.value.startedAt });
    this.unsubscribe = studio.events.on('process:event', (event) => this.onProcessEvent(event));
    return this.state();
  }

  async stop(): Promise<void> {
    const studio = this.studio;
    const id = this.processId;
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.processId = null;
    if (studio && id) {
      // Ask it to close its listener and keep its partial files, then make sure
      // it is gone. A receiver that survives a restart holds the port.
      await studio.process.write(id, `${JSON.stringify({ cmd: 'shutdown' })}\n`);
      window.setTimeout(() => {
        void studio.process.kill(id);
      }, 300);
    }
    if (this.current.status !== 'stopped') {
      this.update({ status: 'stopped', port: 0, token: '', error: '', processId: null });
    }
  }

  private onProcessEvent(event: ProcessEvent): void {
    if (event.id !== this.processId) return;
    if (event.kind === 'stdout') {
      this.stdoutBytes += event.chunk.length;
      this.buffer += event.chunk;
      let newline = this.buffer.indexOf('\n');
      while (newline >= 0) {
        const line = this.buffer.slice(0, newline);
        this.buffer = this.buffer.slice(newline + 1);
        this.consume(line);
        newline = this.buffer.indexOf('\n');
      }
      this.considerIdleRestart();
      return;
    }
    if (event.kind === 'stderr') {
      this.stderr = (this.stderr + event.chunk).slice(-2000);
      return;
    }
    if (event.kind === 'truncated' && event.stream === 'stdout') {
      this.update({
        status: 'degraded',
        error:
          'The receiver has produced more output than this session retains, so live progress reporting has stopped. ' +
          'Transfers already running are unaffected on disk. Restart the receiver to restore live reporting.'
      });
      return;
    }
    if (event.kind === 'error') {
      this.update({ status: 'failed', error: event.message });
      return;
    }
    if (event.kind === 'exit') {
      const detail = this.stderr.trim();
      if (this.restarting) return;
      this.update({
        status: 'stopped',
        port: 0,
        token: '',
        processId: null,
        error:
          event.code === 0 || event.code === null
            ? ''
            : `The receiver exited with code ${event.code}.${detail ? ` It reported: ${detail}` : ''}`
      });
      this.processId = null;
    }
  }

  /**
   * Restarts the receiver once its output stream is close to the ceiling, but
   * only while nothing is transferring. A restart mid-transfer would interrupt
   * real bytes to protect a reporting channel, which is the wrong trade.
   */
  private considerIdleRestart(): void {
    if (this.stdoutBytes < STDOUT_BUDGET_BYTES) return;
    if (this.activeTransfers > 0) return;
    if (this.restarting) return;
    this.restarting = true;
    void this.start(this.requestedPort).finally(() => {
      this.restarting = false;
    });
  }

  private consume(rawLine: string): void {
    const line = rawLine.trim();
    if (!line.startsWith(SENTINEL)) return;
    let event: BridgeEvent;
    try {
      event = JSON.parse(line.slice(SENTINEL.length)) as BridgeEvent;
    } catch {
      return;
    }
    switch (event.type) {
      case 'ready': {
        if (event.protocol !== BRIDGE_PROTOCOL) {
          this.update({
            status: 'failed',
            error: `The receiver speaks protocol ${event.protocol}; this build speaks ${BRIDGE_PROTOCOL}.`
          });
          return;
        }
        this.update({ nodeVersion: event.node });
        this.send({
          cmd: 'configure',
          token: this.current.token,
          port: this.requestedPort,
          productName: this.studio?.info.productName ?? 'World Downloader Studio'
        });
        return;
      }
      case 'listening':
        this.update({ status: 'listening', port: event.port, error: '' });
        return;
      case 'listen-error':
        this.update({ status: 'failed', port: 0, error: event.message });
        return;
      case 'capture':
        this.captured.emit(event.capture);
        return;
      case 'state':
        this.transferState.emit(event);
        return;
      case 'progress':
        this.transferProgress.emit(event);
        return;
      case 'probe':
        this.probed.emit(event);
        return;
      case 'error':
        this.update({ error: event.message });
        return;
      default:
        return;
    }
  }

  private send(command: Record<string, unknown>): boolean {
    const studio = this.studio;
    const id = this.processId;
    if (!studio || !id) return false;
    void studio.process.write(id, `${JSON.stringify(command)}\n`);
    return true;
  }

  /** True when a command can currently reach the receiver. */
  ready(): boolean {
    return this.processId !== null && (this.current.status === 'listening' || this.current.status === 'degraded');
  }

  startTransfer(spec: TransferSpec): boolean {
    return this.send({
      cmd: spec.resume ? 'resume' : 'start',
      id: spec.id,
      url: spec.url,
      destination: spec.destination,
      referrer: spec.referrer ?? '',
      totalBytes: spec.totalBytes ?? null,
      overwrite: spec.overwrite === true,
      resume: spec.resume === true
    });
  }

  pauseTransfer(id: string): boolean {
    return this.send({ cmd: 'pause', id });
  }

  cancelTransfer(id: string, deletePartial: boolean): boolean {
    return this.send({ cmd: 'cancel', id, deletePartial });
  }

  forgetTransfer(id: string): boolean {
    return this.send({ cmd: 'forget', id });
  }

  resolveCapture(captureId: string): boolean {
    return this.send({ cmd: 'resolve', captureId });
  }

  probe(id: string, url: string): boolean {
    return this.send({ cmd: 'probe', id, url });
  }

  /** The address the browser extension is configured with. */
  endpoint(): string {
    return this.current.port > 0 ? `http://127.0.0.1:${this.current.port}` : '';
  }
}

export const downloadBridge = new DownloadBridge();
