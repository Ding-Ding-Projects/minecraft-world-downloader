import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import type { BrowserWindow } from 'electron';
import type { BundledTool, ProcessEvent, ProcessSummary, SpawnHandle, SpawnOptions } from '../../shared/api';
import { bundledToolPath } from './bundled';

/**
 * Bounded child-process supervision.
 *
 * Every process is addressed by an opaque id rather than a pid, output is
 * retained up to a hard ceiling and then truncated with an explicit event, and a
 * shell is never involved: the command and its arguments are passed separately
 * so nothing the renderer supplies can be reinterpreted as shell syntax.
 */

const DEFAULT_MAX_OUTPUT = 4 * 1024 * 1024;

interface Entry {
  id: string;
  child: ChildProcessWithoutNullStreams;
  command: string;
  args: string[];
  startedAt: string;
  endedAt: string | null;
  exitCode: number | null;
  signal: string | null;
  running: boolean;
  stdout: string;
  stderr: string;
  stdoutTruncated: boolean;
  stderrTruncated: boolean;
  maxOutputBytes: number;
  timer: NodeJS.Timeout | null;
}

const entries = new Map<string, Entry>();
let broadcast: (event: ProcessEvent) => void = () => undefined;

export function attachProcessBroadcast(getWindow: () => BrowserWindow | null): void {
  broadcast = (event) => {
    const window = getWindow();
    if (window && !window.isDestroyed()) {
      window.webContents.send('process:event', event);
    }
  };
}

/**
 * Commands the renderer may start. Anything else is refused with the exact
 * reason, so a feature cannot quietly turn this into an arbitrary shell.
 */
const ALLOWED_COMMANDS = new Set([
  'java',
  'javaw',
  'node',
  'npm',
  'npx',
  'docker',
  'docker-compose',
  'git',
  'python',
  'python3',
  'py',
  'mvn',
  'gradle',
  // The archive export feature (`renderer/features/export/archive.ts`) needs
  // exactly these three 7-Zip binary names to create an archive at all. This is
  // adding specific, known archiver binaries the feature actually uses, not
  // opening the allowlist to whatever a user types into a settings field:
  // `archive.ts`'s own `probeArchiver` only ever attempts a user-configured
  // archiver command when it is one of these exact three names (see
  // `isKnownArchiverCommand` there); every other configured value is never
  // even tried, on either side of this boundary.
  '7z',
  '7za',
  '7zz'
]);

export function allowedCommands(): string[] {
  return [...ALLOWED_COMMANDS].sort();
}

function normalizeCommand(command: string): string {
  const trimmed = command.trim();
  const base = trimmed.replace(/\.(exe|cmd|bat)$/i, '');
  return base.toLowerCase();
}

/**
 * Tools this application can bundle inside its own installation (see
 * `./bundled.ts`) and that also need to be spawned as a long-running,
 * streamed process from here, rather than run as one short-lived command
 * from the main process directly. `engineJar` is never a spawn command — it
 * is passed as a `-jar` argument to `java` — so it is deliberately absent;
 * `scraperScript` likewise is only ever passed as an argument to `node`, not
 * spawned itself.
 *
 * `node` was added alongside the embedded-runtime work: `bundledToolPath`
 * resolves it to `process.execPath` (the running Electron binary) rather
 * than a file under `resourcesRoot()`, but the check below re-resolves
 * through that exact same function either way, so the narrow-door guarantee
 * ("only a value the main process itself just recomputed can pass") holds
 * identically for it.
 */
const BUNDLED_SPAWNABLE_TOOLS: readonly BundledTool[] = ['java', 'git', 'gh', 'node'];

/**
 * True only when `command` is byte-for-byte the exact path `./bundled.ts`
 * would itself resolve, right now, for one of the tools above.
 *
 * This is the one and only door the filesystem-path refusal below leaves
 * open, and it is deliberately narrow: the renderer supplies the string, but
 * it cannot manufacture a value that passes this check by typing one in —
 * this re-resolves the bundled tool itself, from the main process, and only
 * an exact match to what is genuinely sitting inside this installation right
 * now is accepted. A path that used to be valid (a build that shipped a
 * runtime and was later reinstalled without one) stops matching the moment
 * the file is gone, since `bundledToolPath` always re-stats a miss for a
 * file-backed tool. `node` is the one entry with nothing to stat —
 * `bundledToolPath('node')` always hands back the running process's own
 * `process.execPath` — so for it this check reduces to "is this genuinely
 * the Electron binary that is right now running the main process", which is
 * exactly as narrow a door as a matched file path is for the others.
 */
function isKnownBundledExecutable(command: string): boolean {
  return BUNDLED_SPAWNABLE_TOOLS.some((tool) => bundledToolPath(tool) === command);
}

export function spawnProcess(options: SpawnOptions): SpawnHandle {
  const command = String(options.command ?? '').trim();
  if (!command) throw new Error('No command was given.');
  const looksLikeAPath = command.includes('/') || command.includes('\\');
  const isBundledExecutable = looksLikeAPath && isKnownBundledExecutable(command);
  if (looksLikeAPath && !isBundledExecutable) {
    throw new Error(
      `Refusing to start "${command}": pass a bare command name resolved on PATH, not a filesystem path.`
    );
  }
  if (!isBundledExecutable) {
    const normalized = normalizeCommand(command);
    if (!ALLOWED_COMMANDS.has(normalized)) {
      throw new Error(
        `Refusing to start "${command}". Allowed commands are: ${allowedCommands().join(', ')}.`
      );
    }
  }
  const args = Array.isArray(options.args) ? options.args.map((value) => String(value)) : [];
  const maxOutputBytes =
    typeof options.maxOutputBytes === 'number' && options.maxOutputBytes > 0
      ? Math.min(options.maxOutputBytes, 64 * 1024 * 1024)
      : DEFAULT_MAX_OUTPUT;

  const child = spawn(command, args, {
    cwd: options.cwd || undefined,
    env: { ...process.env, ...(options.env ?? {}) },
    shell: false,
    windowsHide: true
  }) as ChildProcessWithoutNullStreams;

  const id = randomUUID();
  const entry: Entry = {
    id,
    child,
    command,
    args,
    startedAt: new Date().toISOString(),
    endedAt: null,
    exitCode: null,
    signal: null,
    running: true,
    stdout: '',
    stderr: '',
    stdoutTruncated: false,
    stderrTruncated: false,
    maxOutputBytes,
    timer: null
  };
  entries.set(id, entry);

  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk: string) => append(entry, 'stdout', chunk));
  child.stderr.on('data', (chunk: string) => append(entry, 'stderr', chunk));

  child.on('error', (error: Error) => {
    entry.running = false;
    entry.endedAt = new Date().toISOString();
    broadcast({ id, kind: 'error', message: error.message });
  });

  child.on('close', (code, signal) => {
    entry.running = false;
    entry.endedAt = new Date().toISOString();
    entry.exitCode = code;
    entry.signal = signal;
    if (entry.timer) {
      clearTimeout(entry.timer);
      entry.timer = null;
    }
    broadcast({ id, kind: 'exit', code, signal });
  });

  if (typeof options.timeoutMs === 'number' && options.timeoutMs > 0) {
    entry.timer = setTimeout(() => {
      if (entry.running) child.kill();
    }, options.timeoutMs);
  }

  return { id, pid: child.pid ?? null, command, args, startedAt: entry.startedAt };
}

function append(entry: Entry, stream: 'stdout' | 'stderr', chunk: string): void {
  const truncatedFlag = stream === 'stdout' ? 'stdoutTruncated' : 'stderrTruncated';
  const current = stream === 'stdout' ? entry.stdout : entry.stderr;
  const room = entry.maxOutputBytes - Buffer.byteLength(current, 'utf8');
  if (room <= 0) {
    if (!entry[truncatedFlag]) {
      entry[truncatedFlag] = true;
      broadcast({ id: entry.id, kind: 'truncated', stream, retainedBytes: entry.maxOutputBytes });
    }
    return;
  }
  let piece = chunk;
  if (Buffer.byteLength(chunk, 'utf8') > room) {
    piece = Buffer.from(chunk, 'utf8').subarray(0, room).toString('utf8');
    entry[truncatedFlag] = true;
  }
  if (stream === 'stdout') entry.stdout += piece;
  else entry.stderr += piece;
  broadcast(
    stream === 'stdout'
      ? { id: entry.id, kind: 'stdout', chunk: piece }
      : { id: entry.id, kind: 'stderr', chunk: piece }
  );
  if (entry[truncatedFlag]) {
    broadcast({ id: entry.id, kind: 'truncated', stream, retainedBytes: entry.maxOutputBytes });
  }
}

export function writeToProcess(id: string, data: string): void {
  const entry = entries.get(id);
  if (!entry) throw new Error(`No process with id ${id}.`);
  if (!entry.running) throw new Error(`Process ${id} has already exited; nothing was written.`);
  entry.child.stdin.write(data);
}

export function killProcess(id: string, signal?: string): void {
  const entry = entries.get(id);
  if (!entry) throw new Error(`No process with id ${id}.`);
  if (!entry.running) return;
  entry.child.kill((signal as NodeJS.Signals | undefined) ?? 'SIGTERM');
}

export function listProcesses(): ProcessSummary[] {
  return [...entries.values()].map((entry) => ({
    id: entry.id,
    pid: entry.child.pid ?? null,
    command: entry.command,
    args: entry.args,
    running: entry.running,
    startedAt: entry.startedAt,
    endedAt: entry.endedAt,
    exitCode: entry.exitCode,
    signal: entry.signal
  }));
}

export function readOutput(id: string, stream: 'stdout' | 'stderr'): string {
  const entry = entries.get(id);
  if (!entry) throw new Error(`No process with id ${id}.`);
  return stream === 'stdout' ? entry.stdout : entry.stderr;
}

/** Terminates everything still running. Called on quit. */
export function killAll(): void {
  for (const entry of entries.values()) {
    if (entry.running) {
      try {
        entry.child.kill();
      } catch {
        /* the process may already be gone */
      }
    }
  }
}
