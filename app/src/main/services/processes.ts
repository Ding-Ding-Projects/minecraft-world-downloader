import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import type { BrowserWindow } from 'electron';
import type { ProcessEvent, ProcessSummary, SpawnHandle, SpawnOptions } from '../../shared/api';

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
  'gradle'
]);

export function allowedCommands(): string[] {
  return [...ALLOWED_COMMANDS].sort();
}

function normalizeCommand(command: string): string {
  const trimmed = command.trim();
  const base = trimmed.replace(/\.(exe|cmd|bat)$/i, '');
  return base.toLowerCase();
}

export function spawnProcess(options: SpawnOptions): SpawnHandle {
  const command = String(options.command ?? '').trim();
  if (!command) throw new Error('No command was given.');
  if (command.includes('/') || command.includes('\\')) {
    throw new Error(
      `Refusing to start "${command}": pass a bare command name resolved on PATH, not a filesystem path.`
    );
  }
  const normalized = normalizeCommand(command);
  if (!ALLOWED_COMMANDS.has(normalized)) {
    throw new Error(
      `Refusing to start "${command}". Allowed commands are: ${allowedCommands().join(', ')}.`
    );
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
