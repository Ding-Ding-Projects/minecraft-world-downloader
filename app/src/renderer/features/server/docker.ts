import type { AppContext } from '../../core/registry';
import type { ProcessEvent } from '../../../shared/api';

/**
 * The Docker command-line adapter.
 *
 * Everything this feature knows about containers comes from the `docker` binary
 * on this machine, invoked through the privileged process bridge. There is no
 * socket client, no HTTP call to the daemon and no bundled Docker library: the
 * renderer cannot open a socket at all, and the bridge only spawns commands from
 * its own allow-list, of which `docker` is one.
 *
 * Two properties this file exists to guarantee.
 *
 * The first is that a missing `docker` executable and a stopped daemon are
 * different states with different answers. They are trivially easy to collapse
 * into one "Docker is not available" message, and that message helps nobody:
 * one is fixed by installing something, the other by starting something that is
 * already installed.
 *
 * The second is that nothing here invents a value. A container's uptime, health,
 * ports and state are read from what `docker` actually printed. Where `docker`
 * says nothing, this file says nothing rather than guessing.
 */

/* ------------------------------------------------------------------ */
/* Process event fan-out                                               */
/* ------------------------------------------------------------------ */

type EventHandler = (event: ProcessEvent) => void;

const liveHandlers = new Map<string, EventHandler>();
const bufferedEvents = new Map<string, ProcessEvent[]>();
const bufferedOrder: string[] = [];

/** Ids kept while nobody has claimed them yet. Bounded so a burst cannot grow without limit. */
const MAX_BUFFERED_IDS = 32;
/** Events kept per unclaimed id. Beyond this the oldest are simply not retained. */
const MAX_BUFFERED_EVENTS = 4000;

let detachBus: (() => void) | null = null;

/**
 * Installs the single `process:event` listener this feature uses.
 *
 * The subscription has to exist before the first spawn, because a short command
 * can exit before its `spawn` call has even resolved — the exit event would then
 * arrive with no listener attached and the run would hang forever waiting for a
 * result that already happened. Events for an id nobody has claimed yet are
 * buffered and replayed the moment a claim arrives.
 */
export function installProcessBus(ctx: AppContext): () => void {
  if (detachBus) return detachBus;
  const off = ctx.studio.events.on('process:event', (event) => {
    const handler = liveHandlers.get(event.id);
    if (handler) {
      handler(event);
      return;
    }
    let queue = bufferedEvents.get(event.id);
    if (!queue) {
      queue = [];
      bufferedEvents.set(event.id, queue);
      bufferedOrder.push(event.id);
      while (bufferedOrder.length > MAX_BUFFERED_IDS) {
        const oldest = bufferedOrder.shift();
        if (oldest) bufferedEvents.delete(oldest);
      }
    }
    if (queue.length < MAX_BUFFERED_EVENTS) queue.push(event);
  });
  detachBus = () => {
    off();
    detachBus = null;
  };
  return detachBus;
}

function claim(id: string, handler: EventHandler): () => void {
  liveHandlers.set(id, handler);
  const queued = bufferedEvents.get(id);
  if (queued) {
    bufferedEvents.delete(id);
    const index = bufferedOrder.indexOf(id);
    if (index >= 0) bufferedOrder.splice(index, 1);
    for (const event of queued) handler(event);
  }
  return () => {
    liveHandlers.delete(id);
  };
}

/* ------------------------------------------------------------------ */
/* Redaction                                                           */
/* ------------------------------------------------------------------ */

/**
 * Environment keys whose values are never displayed.
 *
 * The manager this feature replaces redacted exactly these four substrings when
 * it echoed a `docker run` command line, because the downloader takes a
 * Minecraft access token and a console password through the environment. The
 * same rule is applied here to command lines and, when the redaction setting is
 * on, to log lines as well.
 */
const SECRET_KEY_PATTERN = /(password|token|secret|key)/i;

/** `KEY=value` where KEY looks sensitive. Also matches a bare `--token value`. */
const ASSIGNMENT_PATTERN = /\b([A-Za-z_][A-Za-z0-9_.-]*)=([^\s"']+|"[^"]*"|'[^']*')/g;
const FLAG_VALUE_PATTERN = /(--(?:token|password|secret|key)[A-Za-z-]*)(\s+|=)("[^"]*"|'[^']*'|\S+)/gi;

/** Replaces the value of any sensitive assignment with a fixed marker. */
export function redactSecrets(text: string): string {
  return text
    .replace(ASSIGNMENT_PATTERN, (whole, key: string, value: string) =>
      SECRET_KEY_PATTERN.test(key) ? `${key}=<redacted>` : whole
    )
    .replace(FLAG_VALUE_PATTERN, (_whole, flag: string, gap: string) => `${flag}${gap === '=' ? '=' : ' '}<redacted>`);
}

/** The command line as it is shown to the user, with sensitive values removed. */
export function formatCommand(args: string[]): string {
  const rendered = args
    .map((argument) => (/\s/.test(argument) ? JSON.stringify(argument) : argument))
    .join(' ');
  return redactSecrets(`docker ${rendered}`);
}

/* ------------------------------------------------------------------ */
/* Running one command                                                 */
/* ------------------------------------------------------------------ */

export interface DockerRun {
  /** True only when the process exited with status 0. */
  ok: boolean;
  /** The real exit status, or null when the process never reported one. */
  code: number | null;
  stdout: string;
  stderr: string;
  /** Set when the command could not be run at all, rather than running and failing. */
  failure: string | null;
  /** The command line as displayed, already redacted. */
  command: string;
}

export interface RunOptions {
  timeoutMs?: number;
  maxOutputBytes?: number;
  onOutput?(stream: 'stdout' | 'stderr', chunk: string): void;
}

const DEFAULT_TIMEOUT_MS = 30_000;

export async function runDocker(ctx: AppContext, args: string[], options: RunOptions = {}): Promise<DockerRun> {
  const command = formatCommand(args);
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const spawned = await ctx.studio.process.spawn({
    command: 'docker',
    args,
    timeoutMs,
    maxOutputBytes: options.maxOutputBytes ?? 4 * 1024 * 1024
  });
  if (!spawned.ok) {
    return { ok: false, code: null, stdout: '', stderr: '', failure: spawned.error, command };
  }

  const id = spawned.value.id;
  return await new Promise<DockerRun>((resolve) => {
    let stdout = '';
    let stderr = '';
    let settled = false;
    let release: (() => void) | null = null;
    let releaseWhenClaimed = false;
    let guard: number | null = null;

    const finish = (run: DockerRun): void => {
      if (settled) return;
      settled = true;
      if (guard !== null) window.clearTimeout(guard);
      if (release) release();
      else releaseWhenClaimed = true;
      resolve(run);
    };

    // The bridge already kills the process at `timeoutMs`. This second guard
    // exists for the case where the kill itself produces no event, so a caller
    // is never left waiting on a promise that can no longer settle.
    guard = window.setTimeout(() => {
      void ctx.studio.process.kill(id);
      finish({
        ok: false,
        code: null,
        stdout,
        stderr,
        failure: `The command produced no result within ${Math.round((timeoutMs + 5000) / 1000)} seconds and was stopped.`,
        command
      });
    }, timeoutMs + 5000);

    release = claim(id, (event) => {
      if (event.kind === 'stdout') {
        stdout += event.chunk;
        options.onOutput?.('stdout', event.chunk);
        return;
      }
      if (event.kind === 'stderr') {
        stderr += event.chunk;
        options.onOutput?.('stderr', event.chunk);
        return;
      }
      if (event.kind === 'truncated') return;
      if (event.kind === 'error') {
        finish({ ok: false, code: null, stdout, stderr, failure: event.message, command });
        return;
      }
      finish({ ok: event.code === 0, code: event.code, stdout, stderr, failure: null, command });
    });
    if (releaseWhenClaimed) release();
  });
}

/* ------------------------------------------------------------------ */
/* Streaming a command                                                 */
/* ------------------------------------------------------------------ */

export interface StreamCallbacks {
  onLine(line: string, stream: 'stdout' | 'stderr'): void;
  /** Called exactly once. `reason` is null for a clean end. */
  onEnd(reason: string | null, code: number | null): void;
}

export interface StreamHandle {
  id: string;
  command: string;
  stop(): Promise<void>;
}

export type StreamStart = { ok: true; handle: StreamHandle } | { ok: false; error: string; command: string };

/**
 * Runs a long-lived command and reports whole lines as they arrive.
 *
 * `docker logs --follow` never exits on its own, so this returns a handle rather
 * than a promise. The partial-chunk buffer matters: a chunk boundary lands in
 * the middle of a line often enough that assembling lines per chunk produces a
 * log full of split words.
 */
export async function streamDocker(
  ctx: AppContext,
  args: string[],
  callbacks: StreamCallbacks,
  options: { maxOutputBytes?: number } = {}
): Promise<StreamStart> {
  const command = formatCommand(args);
  const spawned = await ctx.studio.process.spawn({
    command: 'docker',
    args,
    maxOutputBytes: options.maxOutputBytes ?? 8 * 1024 * 1024
  });
  if (!spawned.ok) return { ok: false, error: spawned.error, command };

  const id = spawned.value.id;
  const partial: Record<'stdout' | 'stderr', string> = { stdout: '', stderr: '' };
  let ended = false;
  let release: (() => void) | null = null;

  const flush = (stream: 'stdout' | 'stderr'): void => {
    const remainder = partial[stream];
    if (remainder === '') return;
    partial[stream] = '';
    callbacks.onLine(remainder, stream);
  };

  const end = (reason: string | null, code: number | null): void => {
    if (ended) return;
    ended = true;
    flush('stdout');
    flush('stderr');
    release?.();
    callbacks.onEnd(reason, code);
  };

  release = claim(id, (event) => {
    if (event.kind === 'stdout' || event.kind === 'stderr') {
      const stream = event.kind;
      const combined = partial[stream] + event.chunk;
      const parts = combined.split(/\r?\n/);
      partial[stream] = parts.pop() ?? '';
      for (const line of parts) callbacks.onLine(line, stream);
      return;
    }
    if (event.kind === 'truncated') return;
    if (event.kind === 'error') {
      end(event.message, null);
      return;
    }
    end(null, event.code);
  });

  return {
    ok: true,
    handle: {
      id,
      command,
      stop: async () => {
        if (!ended) await ctx.studio.process.kill(id);
        end(null, null);
      }
    }
  };
}

/* ------------------------------------------------------------------ */
/* Daemon probe                                                        */
/* ------------------------------------------------------------------ */

export type DaemonStatus =
  | { kind: 'unknown' }
  | { kind: 'checking' }
  | {
      kind: 'ready';
      clientVersion: string;
      serverVersion: string;
      serverOs: string;
      checkedAt: string;
    }
  /** The `docker` executable itself could not be found or could not be started. */
  | { kind: 'missing'; detail: string; checkedAt: string }
  /** `docker` ran, and the daemon it talks to did not answer. */
  | { kind: 'unreachable'; detail: string; checkedAt: string }
  /** `docker` ran and the daemon refused this user, or failed for another stated reason. */
  | { kind: 'refused'; detail: string; checkedAt: string };

const NOT_INSTALLED = /(enoent|not recognized|command not found|no such file|is not on the allow-list|cannot find the path)/i;
const DAEMON_DOWN =
  /(cannot connect to the docker daemon|is the docker daemon running|error during connect|open \/\/\.\/pipe\/docker_engine|dial unix|docker daemon is not running|the system cannot find the file specified)/i;
const PERMISSION = /(permission denied|access is denied|got permission denied|unauthorized)/i;

interface VersionPayload {
  Client?: { Version?: string; Os?: string };
  Server?: { Version?: string; Os?: string } | null;
}

function firstLine(text: string): string {
  const line = text
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .find((entry) => entry !== '');
  return line ?? '';
}

/** Asks `docker` who it is and whether a daemon answered. */
export async function probeDaemon(ctx: AppContext): Promise<DaemonStatus> {
  const checkedAt = new Date().toISOString();
  const run = await runDocker(ctx, ['version', '--format', '{{json .}}'], { timeoutMs: 15_000 });

  if (run.failure !== null) {
    const detail = run.failure;
    if (NOT_INSTALLED.test(detail)) return { kind: 'missing', detail, checkedAt };
    if (DAEMON_DOWN.test(detail)) return { kind: 'unreachable', detail, checkedAt };
    return { kind: 'refused', detail, checkedAt };
  }

  if (run.ok) {
    let payload: VersionPayload = {};
    try {
      payload = JSON.parse(run.stdout.trim()) as VersionPayload;
    } catch {
      // `docker version` answered with something this build cannot parse. The
      // client clearly exists; whether a daemon answered is genuinely unknown,
      // so the raw first line is reported rather than a guess.
      return { kind: 'refused', detail: firstLine(run.stdout) || 'The version output could not be read.', checkedAt };
    }
    const serverVersion = payload.Server?.Version ?? '';
    if (serverVersion === '') {
      return {
        kind: 'unreachable',
        detail: 'The Docker command line answered, and reported no server version, so no daemon is attached to it.',
        checkedAt
      };
    }
    return {
      kind: 'ready',
      clientVersion: payload.Client?.Version ?? '',
      serverVersion,
      serverOs: payload.Server?.Os ?? '',
      checkedAt
    };
  }

  const detail = firstLine(run.stderr) || firstLine(run.stdout) || `Exit status ${String(run.code)}.`;
  if (NOT_INSTALLED.test(detail)) return { kind: 'missing', detail, checkedAt };
  if (PERMISSION.test(detail)) return { kind: 'refused', detail, checkedAt };
  if (DAEMON_DOWN.test(detail)) return { kind: 'unreachable', detail, checkedAt };
  return { kind: 'refused', detail, checkedAt };
}

/* ------------------------------------------------------------------ */
/* Containers                                                          */
/* ------------------------------------------------------------------ */

export type ContainerState =
  | 'running'
  | 'exited'
  | 'created'
  | 'restarting'
  | 'paused'
  | 'removing'
  | 'dead'
  | 'unknown';

export const CONTAINER_STATES: ContainerState[] = [
  'running',
  'restarting',
  'paused',
  'created',
  'exited',
  'removing',
  'dead',
  'unknown'
];

export type HealthState = 'healthy' | 'unhealthy' | 'starting' | 'none';

export interface PortBinding {
  /** The address and port published on this machine, empty when nothing is published. */
  published: string;
  /** The port inside the container. */
  container: string;
  protocol: string;
}

export interface ContainerRow {
  id: string;
  shortId: string;
  name: string;
  image: string;
  state: ContainerState;
  /** Exactly what `docker` printed, e.g. `Up 3 hours (healthy)`. */
  status: string;
  health: HealthState;
  /** `docker`'s own relative time, e.g. `3 hours ago`. Empty when it printed none. */
  runningFor: string;
  createdAt: string;
  ports: PortBinding[];
  composeProject: string | null;
  composeService: string | null;
  command: string;
}

interface PsPayload {
  ID?: string;
  Image?: string;
  Names?: string;
  State?: string;
  Status?: string;
  Ports?: string;
  CreatedAt?: string;
  RunningFor?: string;
  Labels?: string;
  Command?: string;
}

function parseState(raw: string): ContainerState {
  const value = raw.trim().toLowerCase();
  return (CONTAINER_STATES as string[]).includes(value) ? (value as ContainerState) : 'unknown';
}

function parseHealth(status: string): HealthState {
  if (/\(healthy\)/i.test(status)) return 'healthy';
  if (/\(unhealthy\)/i.test(status)) return 'unhealthy';
  if (/\(health: starting\)/i.test(status)) return 'starting';
  return 'none';
}

/** `0.0.0.0:8080->8080/tcp, :::8080->8080/tcp` and the unpublished `25565/tcp`. */
export function parsePorts(raw: string): PortBinding[] {
  const bindings: PortBinding[] = [];
  for (const piece of raw.split(',')) {
    const text = piece.trim();
    if (text === '') continue;
    const mapped = /^(.*)->([0-9]+)\/([a-z]+)$/i.exec(text);
    if (mapped) {
      bindings.push({ published: mapped[1], container: mapped[2], protocol: mapped[3].toLowerCase() });
      continue;
    }
    const exposed = /^([0-9]+)\/([a-z]+)$/i.exec(text);
    if (exposed) {
      bindings.push({ published: '', container: exposed[1], protocol: exposed[2].toLowerCase() });
      continue;
    }
    bindings.push({ published: '', container: text, protocol: '' });
  }
  return bindings;
}

/** `com.docker.compose.project=x,com.docker.compose.service=y`. */
function parseLabels(raw: string): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const piece of raw.split(',')) {
    const text = piece.trim();
    if (text === '') continue;
    const equals = text.indexOf('=');
    if (equals <= 0) {
      labels[text] = '';
      continue;
    }
    labels[text.slice(0, equals)] = text.slice(equals + 1);
  }
  return labels;
}

export function parseContainerLine(line: string): ContainerRow | null {
  let payload: PsPayload;
  try {
    payload = JSON.parse(line) as PsPayload;
  } catch {
    return null;
  }
  const id = (payload.ID ?? '').trim();
  const name = (payload.Names ?? '').split(',')[0]?.trim() ?? '';
  if (id === '' && name === '') return null;
  const status = (payload.Status ?? '').trim();
  const labels = parseLabels(payload.Labels ?? '');
  return {
    id,
    shortId: id.slice(0, 12),
    name: name === '' ? id.slice(0, 12) : name,
    image: (payload.Image ?? '').trim(),
    state: parseState(payload.State ?? ''),
    status,
    health: parseHealth(status),
    runningFor: (payload.RunningFor ?? '').trim(),
    createdAt: (payload.CreatedAt ?? '').trim(),
    ports: parsePorts(payload.Ports ?? ''),
    composeProject: labels['com.docker.compose.project'] ?? null,
    composeService: labels['com.docker.compose.service'] ?? null,
    command: (payload.Command ?? '').trim()
  };
}

export interface ContainerListResult {
  ok: boolean;
  rows: ContainerRow[];
  /** Set when the listing itself failed. The previous rows are then kept by the caller. */
  error: string | null;
  /** Lines `docker` printed that could not be read as a container record. */
  unreadableLines: number;
}

export async function listContainers(ctx: AppContext): Promise<ContainerListResult> {
  const run = await runDocker(ctx, ['ps', '--all', '--no-trunc', '--format', '{{json .}}'], { timeoutMs: 20_000 });
  if (run.failure !== null) return { ok: false, rows: [], error: run.failure, unreadableLines: 0 };
  if (!run.ok) {
    const detail = firstLine(run.stderr) || firstLine(run.stdout) || `Exit status ${String(run.code)}.`;
    return { ok: false, rows: [], error: detail, unreadableLines: 0 };
  }

  const rows: ContainerRow[] = [];
  let unreadableLines = 0;
  for (const line of run.stdout.split(/\r?\n/)) {
    const text = line.trim();
    if (text === '') continue;
    const row = parseContainerLine(text);
    if (row) rows.push(row);
    else unreadableLines += 1;
  }
  rows.sort((left, right) => left.name.localeCompare(right.name));
  return { ok: true, rows, error: null, unreadableLines };
}

/* ------------------------------------------------------------------ */
/* Operations                                                          */
/* ------------------------------------------------------------------ */

export type OperationKind = 'start' | 'stop' | 'restart' | 'remove';

export function operationArguments(kind: OperationKind, name: string, stopTimeoutSeconds: number): string[] {
  const grace = String(Math.max(1, Math.round(stopTimeoutSeconds)));
  switch (kind) {
    case 'start':
      return ['start', name];
    case 'stop':
      return ['stop', '--time', grace, name];
    case 'restart':
      return ['restart', '--time', grace, name];
    case 'remove':
      // `--force` because a running container cannot otherwise be removed, and
      // the confirmation gate says plainly that it is stopped first. Volumes are
      // deliberately NOT removed: the compose file keeps the downloaded world in
      // a bind-mounted directory, and taking that with the container would
      // destroy data the user never agreed to lose.
      return ['rm', '--force', name];
  }
}

/* ------------------------------------------------------------------ */
/* Log lines                                                           */
/* ------------------------------------------------------------------ */

export type Severity = 'error' | 'warning' | 'info' | 'debug' | 'other';

export const SEVERITIES: Severity[] = ['error', 'warning', 'info', 'debug', 'other'];

export interface LogLine {
  /** Monotonic within one loaded stream, so a selection survives a redraw. */
  key: number;
  /** The RFC 3339 timestamp `--timestamps` prefixes, or empty when absent. */
  timestamp: string;
  text: string;
  severity: Severity;
  stream: 'stdout' | 'stderr';
}

const ERROR_PATTERN = /\b(error|errors|exception|fatal|severe|failed|failure|panic|traceback)\b/i;
const WARNING_PATTERN = /\b(warn|warning|deprecated|retrying)\b/i;
const INFO_PATTERN = /\b(info|notice|starting|started|listening|ready)\b/i;
const DEBUG_PATTERN = /\b(debug|trace|verbose)\b/i;

/**
 * Classifies one line by what it says.
 *
 * A container log has no severity channel — it is whatever the program inside
 * wrote to its own output — so this is a reading of the text, not a fact
 * reported by Docker. The surface says so beside the filter rather than
 * presenting the classification as authoritative.
 */
export function classifySeverity(text: string, stream: 'stdout' | 'stderr'): Severity {
  if (ERROR_PATTERN.test(text)) return 'error';
  if (WARNING_PATTERN.test(text)) return 'warning';
  if (DEBUG_PATTERN.test(text)) return 'debug';
  if (INFO_PATTERN.test(text)) return 'info';
  return stream === 'stderr' ? 'warning' : 'other';
}

const TIMESTAMP_PATTERN = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?)\s(.*)$/;

/** Splits the `--timestamps` prefix off a line, keeping the rest verbatim. */
export function parseLogLine(raw: string, stream: 'stdout' | 'stderr', key: number, redact: boolean): LogLine {
  const cleaned = raw.replace(/\r$/, '');
  const match = TIMESTAMP_PATTERN.exec(cleaned);
  const timestamp = match ? match[1] : '';
  const body = match ? match[2] : cleaned;
  const text = redact ? redactSecrets(body) : body;
  return { key, timestamp, text, severity: classifySeverity(body, stream), stream };
}

export function logArguments(name: string, tail: number, follow: boolean): string[] {
  const args = ['logs', '--timestamps', '--tail', String(Math.max(1, Math.round(tail)))];
  if (follow) args.push('--follow');
  args.push(name);
  return args;
}
