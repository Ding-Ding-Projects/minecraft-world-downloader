/**
 * The renderer-side half of the bot runtime bridge.
 *
 * The bot library is Node-only, so it never runs in this process. This file
 * writes `bot-host.js` (imported as a raw string — it is never executed here)
 * into the application's own data directory, launches it with `node` through
 * the privileged, allow-listed `ctx.studio.process` bridge, and speaks the
 * newline-delimited JSON protocol described in `protocol.ts` over its stdin
 * and stdout. There is no other route from this renderer to the bot: no
 * `require`, no eval channel, and no method the host was not built to accept.
 *
 * One `BotRuntimeClient` owns exactly one host process for the whole
 * application. The host itself supports up to eight simultaneous bot sessions
 * (`MAX_BOTS` in `bot-host.js`), which is how several bots run at once without
 * paying for a process each — `manager.ts` is what turns "one host, many
 * sessions" into the per-bot API the rest of this feature and its siblings use.
 */

import type { AppContext } from '../../core/registry';
import {
  PROTOCOL_VERSION,
  SENTINEL,
  type ConnectionOptions,
  type HostCommand,
  type HostHandshake,
  type HostMessage
} from './protocol';

// eslint-disable-next-line import/no-unresolved -- Vite's `?raw` suffix, declared by `vite/client`.
import botHostSource from './bot-host.js?raw';

export type RuntimeStatus = 'idle' | 'starting' | 'ready' | 'crashed' | 'unavailable' | 'stopped';

export interface RuntimeInfo {
  status: RuntimeStatus;
  handshake: HostHandshake | null;
  /** The exact failure, verbatim, once known. Never paraphrased. */
  fault: string | null;
  /** Every path the host actually tried, when a library-not-found fault names them. */
  attemptedPaths: string[];
  hostPath: string | null;
  startedAt: number | null;
  pid: number | null;
}

export type HostListener = (message: HostMessage) => void;
type Unsubscribe = () => void;

/**
 * `Omit<HostCommand, 'id'>` is not what it looks like: for a union type,
 * `keyof HostCommand` is only the keys every member shares, so plain `Omit`
 * collapses the whole discriminated union to a near-empty type. Distributing
 * over the union first, then omitting from each member, keeps every command's
 * own fields intact.
 */
type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;

interface Pending {
  resolve(value: unknown): void;
  reject(error: Error & { code?: string }): void;
}

function platformSeparator(ctx: AppContext): string {
  return ctx.studio.info.platform === 'win32' ? '\\' : '/';
}

/** Joins path segments with the running platform's real separator. No Node `path` module exists here. */
function joinPath(ctx: AppContext, ...parts: string[]): string {
  const sep = platformSeparator(ctx);
  const trimmed = parts
    .filter((part) => part.length > 0)
    .map((part, index) => {
      let value = part.replace(/[\\/]+/g, sep);
      if (index > 0) value = value.replace(new RegExp('^\\' + sep + '+'), '');
      value = value.replace(new RegExp('\\' + sep + '+$'), '');
      return value;
    });
  return trimmed.join(sep);
}

/**
 * A handful of harmless relative guesses at where `vendor/mineflayer` sits
 * relative to whatever directory the spawned `node` process inherits as its
 * working directory.
 *
 * These cost nothing when wrong — `resolveLibrary` in `bot-host.js` just
 * records each one it tried — and its own upward walk from that same working
 * directory (now checking a `vendor/mineflayer` sibling at every ancestor, see
 * that file) is what actually carries the weight in development. Packaging
 * `vendor/mineflayer` into the installed application so it can be found at all
 * once installed is outside this feature's owned paths; see `docs/features/
 * mineflayer.md` for the exact gap this leaves in a packaged build.
 */
function libraryRootGuesses(): string[] {
  const guesses: string[] = [];
  for (let up = 1; up <= 4; up += 1) {
    guesses.push(Array.from({ length: up }, () => '..').join('/') + '/vendor/mineflayer');
  }
  return guesses;
}

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

/**
 * Owns the one `node bot-host.js` child process and every command sent to it.
 *
 * Every public method that talks to the host returns a real promise tied to
 * the host's own `reply` message for that command id; nothing here guesses at
 * success before the host has actually answered.
 */
export class BotRuntimeClient {
  private readonly ctx: AppContext;
  private handleId: string | null = null;
  private nextCommandId = 1;
  private readonly pending = new Map<number, Pending>();
  private buffer = '';
  private readonly messageListeners = new Set<HostListener>();
  private readonly infoListeners = new Set<(info: RuntimeInfo) => void>();
  private info: RuntimeInfo = {
    status: 'idle',
    handshake: null,
    fault: null,
    attemptedPaths: [],
    hostPath: null,
    startedAt: null,
    pid: null
  };
  private starting: Promise<void> | null = null;
  private unsubscribeProcessEvents: Unsubscribe | null = null;

  constructor(ctx: AppContext) {
    this.ctx = ctx;
  }

  getInfo(): RuntimeInfo {
    return this.info;
  }

  onInfoChange(listener: (info: RuntimeInfo) => void): Unsubscribe {
    this.infoListeners.add(listener);
    return () => {
      this.infoListeners.delete(listener);
    };
  }

  /** Every `event`, `status`, `state`, `dropped`, `log`, `signin` and `fault` message the host sends. */
  onMessage(listener: HostListener): Unsubscribe {
    this.messageListeners.add(listener);
    return () => {
      this.messageListeners.delete(listener);
    };
  }

  private setInfo(patch: Partial<RuntimeInfo>): void {
    this.info = { ...this.info, ...patch };
    for (const listener of [...this.infoListeners]) listener(this.info);
  }

  /** Starts the host process if it is not already starting or running. Idempotent and concurrency-safe. */
  async ensureStarted(): Promise<void> {
    if (this.info.status === 'ready') return;
    if (this.starting) {
      await this.starting;
      return;
    }
    this.starting = this.start();
    try {
      await this.starting;
    } finally {
      this.starting = null;
    }
  }

  private async start(): Promise<void> {
    this.setInfo({ status: 'starting', fault: null, attemptedPaths: [] });

    const runtimeDir = joinPath(this.ctx, this.ctx.studio.info.userDataDir, 'mineflayer-runtime');
    const ensured = await this.ctx.studio.fs.ensureDirectory(runtimeDir);
    if (!ensured.ok) {
      this.setInfo({ status: 'unavailable', fault: ensured.error });
      throw new Error(ensured.error);
    }

    const hostPath = joinPath(this.ctx, runtimeDir, 'bot-host.js');
    const written = await this.ctx.studio.fs.writeText(hostPath, botHostSource);
    if (!written.ok) {
      this.setInfo({ status: 'unavailable', fault: written.error, hostPath });
      throw new Error(written.error);
    }

    const profilesDir = joinPath(this.ctx, runtimeDir, 'profiles');
    const args = [
      hostPath,
      ...libraryRootGuesses().map((root) => `--library-root=${root}`),
      `--profiles=${profilesDir}`
    ];

    const spawned = await this.ctx.studio.process.spawn({
      command: 'node',
      args,
      maxOutputBytes: 16 * 1024 * 1024
    });
    if (!spawned.ok) {
      this.setInfo({ status: 'unavailable', fault: spawned.error, hostPath });
      throw new Error(spawned.error);
    }

    this.handleId = spawned.value.id;
    this.buffer = '';
    this.unsubscribeProcessEvents?.();
    this.unsubscribeProcessEvents = this.ctx.studio.events.on('process:event', (event) => {
      this.onProcessEvent(event);
    });
    this.setInfo({ hostPath, pid: spawned.value.pid, startedAt: Date.now() });

    try {
      const handshake = await this.send<HostHandshake>({ cmd: 'handshake' });
      if (handshake.protocol !== PROTOCOL_VERSION) {
        // Still usable: the host answered, it just built against a different
        // protocol constant than this renderer. Record it and carry on rather
        // than refusing a runtime that might work perfectly well.
        this.ctx.notify.warn(
          this.ctx.t('mineflayer.runtime.protocolMismatch', 'The bot runtime is a different protocol version'),
          this.ctx.t(
            'mineflayer.runtime.protocolMismatchBody',
            `This renderer expects protocol ${PROTOCOL_VERSION}; the runtime answered with ${handshake.protocol}.`,
            { values: { expected: PROTOCOL_VERSION, actual: handshake.protocol } }
          )
        );
      }
      this.setInfo({ status: 'ready', handshake, fault: null });
    } catch (error) {
      const message = describeError(error);
      const attempted = extractAttemptedPaths(message);
      this.setInfo({ status: 'crashed', fault: message, attemptedPaths: attempted });
      throw error instanceof Error ? error : new Error(message);
    }
  }

  private onProcessEvent(event: {
    id: string;
    kind: 'stdout' | 'stderr' | 'truncated' | 'exit' | 'error';
    chunk?: string;
    code?: number | null;
    signal?: string | null;
    message?: string;
  }): void {
    if (event.id !== this.handleId) return;

    if (event.kind === 'stdout' && typeof event.chunk === 'string') {
      this.buffer += event.chunk;
      let newlineIndex = this.buffer.indexOf('\n');
      while (newlineIndex >= 0) {
        const line = this.buffer.slice(0, newlineIndex);
        this.buffer = this.buffer.slice(newlineIndex + 1);
        this.handleLine(line);
        newlineIndex = this.buffer.indexOf('\n');
      }
      return;
    }

    if (event.kind === 'exit') {
      const reason = this.ctx.t(
        'mineflayer.runtime.exited',
        `The bot runtime process exited (code ${event.code ?? 'null'}, signal ${event.signal ?? 'none'}).`,
        { values: { code: event.code ?? 'null', signal: event.signal ?? 'none' } }
      );
      this.failEverythingPending(reason);
      this.setInfo({ status: 'stopped', fault: reason });
      this.handleId = null;
      this.unsubscribeProcessEvents?.();
      this.unsubscribeProcessEvents = null;
      return;
    }

    if (event.kind === 'error' && typeof event.message === 'string') {
      this.failEverythingPending(event.message);
      this.setInfo({ status: 'unavailable', fault: event.message });
      return;
    }
    // 'truncated' carries no protocol content and needs no handling here: the
    // live stream this class reads from is independent of the host's own
    // retained-output buffer, which is what the truncation limit bounds.
  }

  private handleLine(rawLine: string): void {
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
    if (!line.startsWith(SENTINEL)) return; // a stray, non-protocol line: never parsed as a message.
    const json = line.slice(SENTINEL.length);
    let message: HostMessage;
    try {
      message = JSON.parse(json) as HostMessage;
    } catch {
      return;
    }
    if (message.type === 'reply') {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.ok) pending.resolve(message.value);
      else {
        const error = new Error(message.error) as Error & { code?: string };
        if (message.code) error.code = message.code;
        pending.reject(error);
      }
      return;
    }
    for (const listener of [...this.messageListeners]) {
      try {
        listener(message);
      } catch (error) {
        console.error('A mineflayer runtime listener threw while handling a host message.', error);
      }
    }
  }

  private failEverythingPending(reason: string): void {
    for (const [, pending] of this.pending) pending.reject(new Error(reason));
    this.pending.clear();
  }

  private async send<T>(command: DistributiveOmit<HostCommand, 'id'>): Promise<T> {
    if (!this.handleId) throw new Error(this.ctx.t('mineflayer.runtime.notStarted', 'The bot runtime has not started.'));
    const id = this.nextCommandId;
    this.nextCommandId += 1;
    const full = { ...command, id } as HostCommand;
    const line = JSON.stringify(full) + '\n';
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (value: unknown) => void, reject });
      this.ctx.studio.process.write(this.handleId as string, line).then((result) => {
        if (!result.ok) {
          this.pending.delete(id);
          reject(new Error(result.error));
        }
      });
    });
  }

  async connect(botId: string, options: ConnectionOptions, secret?: string): Promise<{ botId: string }> {
    await this.ensureStarted();
    return this.send({ cmd: 'connect', botId, options, secret });
  }

  async disconnect(botId: string, reason: string): Promise<{ botId: string }> {
    return this.send({ cmd: 'disconnect', botId, reason });
  }

  async forget(botId: string): Promise<{ botId: string }> {
    return this.send({ cmd: 'forget', botId });
  }

  async state(botId: string): Promise<unknown> {
    return this.send({ cmd: 'state', botId });
  }

  async subscribe(botId: string, events: string[]): Promise<{ subscribed: number }> {
    return this.send({ cmd: 'subscribe', botId, events });
  }

  async call<T = unknown>(botId: string, method: string, args: unknown[] = []): Promise<T> {
    return this.send<T>({ cmd: 'call', botId, method, args });
  }

  /** Sends `shutdown` and tears down the client's own bookkeeping either way. */
  async dispose(): Promise<void> {
    const handleId = this.handleId;
    if (handleId) {
      try {
        await this.send({ cmd: 'shutdown' });
      } catch {
        /* the process may already be gone; killing it below is the real cleanup */
      }
      await this.ctx.studio.process.kill(handleId).catch(() => undefined);
    }
    this.unsubscribeProcessEvents?.();
    this.unsubscribeProcessEvents = null;
    this.failEverythingPending(this.ctx.t('mineflayer.runtime.disposed', 'The bot runtime was shut down.'));
    this.handleId = null;
    this.setInfo({ status: 'stopped' });
  }
}

/** Pulls the "Paths tried:" block out of the host's own `LIBRARY_NOT_FOUND` message, for an honest detail view. */
function extractAttemptedPaths(message: string): string[] {
  const marker = 'Paths tried:\n';
  const index = message.indexOf(marker);
  if (index < 0) return [];
  return message
    .slice(index + marker.length)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}
