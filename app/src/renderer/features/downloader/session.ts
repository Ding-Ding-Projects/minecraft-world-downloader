import type { AppContext } from '../../core/registry';
import type { ProcessEvent } from '../../../shared/api';

/**
 * The running download.
 *
 * One session owns one child process. Everything it reports is read from that
 * process's real output or from its real exit: there is no simulated progress
 * here, and a field the downloader has not reported yet stays empty rather than
 * being filled in with something plausible.
 *
 * Re-entry is refused in `start` itself rather than only by disabling a button.
 * A disabled button is the visible guard; a keyboard submit walks straight past
 * it, so the guard that matters is the one in this file.
 */

export type SessionPhase = 'idle' | 'starting' | 'running' | 'stopping' | 'stopped' | 'failed';

export type ConnectionState =
  | 'not-started'
  | 'waiting-for-signin'
  | 'listening'
  | 'client-connected'
  | 'disconnected'
  | 'ended';

export type LogSeverity = 'error' | 'warning' | 'notice' | 'info';

export const LOG_SEVERITIES: LogSeverity[] = ['error', 'warning', 'notice', 'info'];

export interface LogLine {
  /** Monotonic within a session, and the stable id for selection and export. */
  seq: number;
  at: string;
  stream: 'stdout' | 'stderr' | 'app';
  severity: LogSeverity;
  text: string;
}

export interface MicrosoftPrompt {
  code: string;
  url: string;
  seenAt: string;
}

export interface SessionStatus {
  phase: SessionPhase;
  connection: ConnectionState;
  /** Process id from the operating system, once it exists. */
  pid: number | null;
  startedAt: string | null;
  endedAt: string | null;
  exitCode: number | null;
  signal: string | null;
  /** Exact reason the session could not start or did not survive. */
  error: string | null;
  /** The address the jar said it was proxying, verbatim from its own line. */
  proxyTarget: string | null;
  /** The local port the jar said to connect to. */
  localPort: number | null;
  gameVersion: string | null;
  protocolVersion: number | null;
  account: string | null;
  accountUuid: string | null;
  lastDisconnectReason: string | null;
  microsoft: MicrosoftPrompt | null;
  /** True once the retained output hit its ceiling and older text was dropped. */
  outputTruncated: boolean;
  /** True while the jar reports it is generating first-run version reports. */
  preparingRegistries: boolean;
}

export function idleStatus(): SessionStatus {
  return {
    phase: 'idle',
    connection: 'not-started',
    pid: null,
    startedAt: null,
    endedAt: null,
    exitCode: null,
    signal: null,
    error: null,
    proxyTarget: null,
    localPort: null,
    gameVersion: null,
    protocolVersion: null,
    account: null,
    accountUuid: null,
    lastDisconnectReason: null,
    microsoft: null,
    outputTruncated: false,
    preparingRegistries: false
  };
}

export interface StartRequest {
  javaCommand: string;
  jarPath: string;
  args: string[];
  /** Working directory: the jar writes its cache and config beside it. */
  workingDirectory: string;
  maxOutputBytes: number;
}

export interface StartOutcome {
  started: boolean;
  /** Exact reason nothing was started. Empty when it was. */
  reason: string;
}

/* ------------------------------------------------------------------ */
/* Output classification                                               */
/* ------------------------------------------------------------------ */

const MSA_CODE = /^MSA_CODE\s+(\{.*\})\s*$/;
const PROXY_LINE = /^Starting proxy for (.+?)\. Make sure to connect to localhost:(\d+)/;
const PROTOCOL_LINE = /^Using protocol of game version (\S+) \((\d+)\)/;
const LOGIN_LINE = /^Login success: (\S+) logged in with uuid (\S+)/;
const DISCONNECT_LINE = /^\[disconnect\]\s*(.*)$/;
const MS_SIGNED_IN = /^\[ms-auth\] Signed in as (.+?)\.?$/;

/** Severity is derived from what the line actually says, never from guesswork. */
export function classify(stream: 'stdout' | 'stderr' | 'app', text: string): LogSeverity {
  const line = text.trim();
  if (line === '') return 'info';
  if (stream === 'stderr') return 'error';
  if (/^\[disconnect\]/.test(line)) return 'warning';
  if (/(exception|error|failed|failure|unable to|could not|cannot)/i.test(line)) return 'error';
  if (/(warning|deprecated|skipping|seems to be running without console)/i.test(line)) return 'warning';
  if (
    PROXY_LINE.test(line) ||
    PROTOCOL_LINE.test(line) ||
    LOGIN_LINE.test(line) ||
    MS_SIGNED_IN.test(line) ||
    /^Completed generating reports/.test(line) ||
    /^(Pausing|Resuming)$/.test(line)
  ) {
    return 'notice';
  }
  return 'info';
}

/* ------------------------------------------------------------------ */
/* The session                                                         */
/* ------------------------------------------------------------------ */

type Listener = () => void;

export class DownloadSession {
  private readonly ctx: AppContext;
  private status: SessionStatus = idleStatus();
  private lines: LogLine[] = [];
  private seq = 0;
  private dropped = 0;
  private maxLines: () => number;
  private processId: string | null = null;
  private unsubscribe: (() => void) | null = null;
  private partial: Record<'stdout' | 'stderr', string> = { stdout: '', stderr: '' };
  private readonly statusListeners = new Set<Listener>();
  private readonly logListeners = new Set<Listener>();
  /** The re-entry guard. Set synchronously, before the first await in `start`. */
  private busy = false;

  constructor(ctx: AppContext, maxLines: () => number) {
    this.ctx = ctx;
    this.maxLines = maxLines;
  }

  /* ---------------- reading ---------------- */

  snapshot(): SessionStatus {
    return { ...this.status };
  }

  logLines(): LogLine[] {
    return this.lines;
  }

  droppedLineCount(): number {
    return this.dropped;
  }

  isRunning(): boolean {
    return this.status.phase === 'starting' || this.status.phase === 'running' || this.status.phase === 'stopping';
  }

  /** True while a start or stop is in flight, whatever a button looks like. */
  isBusy(): boolean {
    return this.busy;
  }

  elapsedMilliseconds(now = Date.now()): number | null {
    if (!this.status.startedAt) return null;
    const started = new Date(this.status.startedAt).getTime();
    const ended = this.status.endedAt ? new Date(this.status.endedAt).getTime() : now;
    return Math.max(0, ended - started);
  }

  onStatusChange(listener: Listener): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  onLogChange(listener: Listener): () => void {
    this.logListeners.add(listener);
    return () => this.logListeners.delete(listener);
  }

  /* ---------------- writing ---------------- */

  /** Records a line the application itself produced, marked as such. */
  note(text: string, severity: LogSeverity = 'notice'): void {
    this.append('app', text, severity);
    this.emitLog();
  }

  clearLog(): void {
    this.lines = [];
    this.dropped = 0;
    this.emitLog();
  }

  removeLines(seqs: Iterable<number>): number {
    const doomed = new Set(seqs);
    if (doomed.size === 0) return 0;
    const before = this.lines.length;
    this.lines = this.lines.filter((line) => !doomed.has(line.seq));
    const removed = before - this.lines.length;
    if (removed > 0) this.emitLog();
    return removed;
  }

  /* ---------------- lifecycle ---------------- */

  async start(request: StartRequest): Promise<StartOutcome> {
    // Synchronous guard first: two activations in the same tick must not both
    // reach the spawn call.
    if (this.busy || this.isRunning()) {
      return {
        started: false,
        reason: 'A download is already running in this window. Stop it before starting another.'
      };
    }
    this.busy = true;

    this.status = idleStatus();
    this.status.phase = 'starting';
    this.status.startedAt = new Date().toISOString();
    this.partial = { stdout: '', stderr: '' };
    this.emitStatus();

    const args = ['-jar', request.jarPath, ...request.args];
    this.note(`Starting: ${request.javaCommand} ${args.join(' ')}`);

    const spawned = await this.ctx.studio.process.spawn({
      command: request.javaCommand,
      args,
      cwd: request.workingDirectory || undefined,
      maxOutputBytes: request.maxOutputBytes
    });

    if (!spawned.ok) {
      this.status.phase = 'failed';
      this.status.error = spawned.error;
      this.status.endedAt = new Date().toISOString();
      this.busy = false;
      this.note(spawned.error, 'error');
      this.emitStatus();
      return { started: false, reason: spawned.error };
    }

    this.processId = spawned.value.id;
    this.status.pid = spawned.value.pid;
    this.status.phase = 'running';
    this.status.connection = 'not-started';
    this.busy = false;
    this.emitStatus();

    this.unsubscribe = this.ctx.studio.events.on('process:event', (event: ProcessEvent) => {
      if (event.id !== this.processId) return;
      this.handle(event);
    });

    return { started: true, reason: '' };
  }

  /**
   * Asks the process to stop. The caller runs the confirmation gate first;
   * this method performs the stop it was told to perform.
   */
  async stop(signal?: string): Promise<StartOutcome> {
    if (!this.processId || !this.isRunning()) {
      return { started: false, reason: 'Nothing is running, so nothing was stopped.' };
    }
    if (this.busy) {
      return { started: false, reason: 'A stop is already in flight.' };
    }
    this.busy = true;
    this.status.phase = 'stopping';
    this.emitStatus();

    const killed = await this.ctx.studio.process.kill(this.processId, signal);
    this.busy = false;
    if (!killed.ok) {
      this.status.phase = 'running';
      this.status.error = killed.error;
      this.note(killed.error, 'error');
      this.emitStatus();
      return { started: false, reason: killed.error };
    }
    this.note('Stop requested. Waiting for the downloader to flush its regions and exit.');
    return { started: true, reason: '' };
  }

  dispose(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.statusListeners.clear();
    this.logListeners.clear();
  }

  /* ---------------- internals ---------------- */

  private handle(event: ProcessEvent): void {
    switch (event.kind) {
      case 'stdout':
      case 'stderr': {
        const stream = event.kind;
        const combined = this.partial[stream] + event.chunk;
        const parts = combined.split(/\r?\n/);
        this.partial[stream] = parts.pop() ?? '';
        let statusChanged = false;
        for (const part of parts) {
          const text = part.replace(/\r$/, '');
          this.append(stream, text, classify(stream, text));
          if (this.interpret(text)) statusChanged = true;
        }
        this.emitLog();
        if (statusChanged) this.emitStatus();
        break;
      }
      case 'truncated': {
        this.status.outputTruncated = true;
        this.note(
          `The retained ${event.stream} output reached its ${event.retainedBytes}-byte ceiling; earlier text was dropped.`,
          'warning'
        );
        this.emitStatus();
        break;
      }
      case 'error': {
        this.status.phase = 'failed';
        this.status.error = event.message;
        this.status.endedAt = new Date().toISOString();
        this.status.connection = 'ended';
        this.note(event.message, 'error');
        this.emitStatus();
        break;
      }
      case 'exit': {
        this.flushPartial();
        this.status.exitCode = event.code;
        this.status.signal = event.signal;
        this.status.endedAt = new Date().toISOString();
        this.status.connection = 'ended';
        this.status.phase = event.code === 0 || event.signal !== null ? 'stopped' : 'failed';
        if (this.status.phase === 'failed' && this.status.error === null) {
          this.status.error = `The downloader exited with code ${String(event.code)}.`;
        }
        this.note(
          event.signal
            ? `The downloader was stopped with signal ${event.signal}.`
            : `The downloader exited with code ${String(event.code)}.`,
          this.status.phase === 'failed' ? 'error' : 'notice'
        );
        this.unsubscribe?.();
        this.unsubscribe = null;
        this.processId = null;
        this.emitStatus();
        break;
      }
      default:
        break;
    }
  }

  private flushPartial(): void {
    for (const stream of ['stdout', 'stderr'] as const) {
      const rest = this.partial[stream];
      if (rest.trim() !== '') {
        this.append(stream, rest, classify(stream, rest));
        this.interpret(rest);
      }
      this.partial[stream] = '';
    }
    this.emitLog();
  }

  private append(stream: LogLine['stream'], text: string, severity: LogSeverity): void {
    if (text === '' && stream !== 'app') return;
    this.seq += 1;
    this.lines.push({ seq: this.seq, at: new Date().toISOString(), stream, severity, text });
    const ceiling = Math.max(200, this.maxLines());
    if (this.lines.length > ceiling) {
      const excess = this.lines.length - ceiling;
      this.lines.splice(0, excess);
      this.dropped += excess;
    }
  }

  /** Reads one output line for status. Returns true when the status changed. */
  private interpret(text: string): boolean {
    const line = text.trim();
    if (line === '') return false;

    const msa = MSA_CODE.exec(line);
    if (msa) {
      try {
        const parsed = JSON.parse(msa[1]) as { code?: string; url?: string };
        if (typeof parsed.code === 'string' && typeof parsed.url === 'string') {
          this.status.microsoft = { code: parsed.code, url: parsed.url, seenAt: new Date().toISOString() };
          this.status.connection = 'waiting-for-signin';
          return true;
        }
      } catch {
        // A malformed marker is left as an ordinary log line and nothing else.
      }
      return false;
    }

    const signedIn = MS_SIGNED_IN.exec(line);
    if (signedIn) {
      this.status.account = signedIn[1];
      this.status.microsoft = null;
      return true;
    }

    const proxy = PROXY_LINE.exec(line);
    if (proxy) {
      this.status.proxyTarget = proxy[1];
      this.status.localPort = Number(proxy[2]);
      this.status.connection = 'listening';
      return true;
    }

    const protocol = PROTOCOL_LINE.exec(line);
    if (protocol) {
      this.status.gameVersion = protocol[1];
      this.status.protocolVersion = Number(protocol[2]);
      return true;
    }

    const login = LOGIN_LINE.exec(line);
    if (login) {
      this.status.account = login[1];
      this.status.accountUuid = login[2];
      this.status.connection = 'client-connected';
      this.status.lastDisconnectReason = null;
      return true;
    }

    const disconnect = DISCONNECT_LINE.exec(line);
    if (disconnect) {
      this.status.lastDisconnectReason = disconnect[1] || 'The connection ended without a stated reason.';
      this.status.connection = 'disconnected';
      return true;
    }

    if (/^Generating reports for version /.test(line) || /^Downloading this version's server\.jar/.test(line)) {
      this.status.preparingRegistries = true;
      return true;
    }
    if (/^Completed generating reports/.test(line)) {
      this.status.preparingRegistries = false;
      return true;
    }
    return false;
  }

  private emitStatus(): void {
    for (const listener of this.statusListeners) listener();
  }

  private emitLog(): void {
    for (const listener of this.logListeners) listener();
  }
}
