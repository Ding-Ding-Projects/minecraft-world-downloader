/**
 * Integration coverage for the archive export's spawn boundary: `archive.ts`'s
 * `planArchive` / `runCommand` / `probeArchiver` on one side, and
 * `main/services/processes.ts`'s `spawnProcess` / `ALLOWED_COMMANDS` gate on
 * the other.
 *
 * The archive feature shipped completely dead on every machine. `ARCHIVER_CANDIDATES`
 * in `archive.ts` names `7z`, `7za` and `7zz`; `ALLOWED_COMMANDS` in `processes.ts`
 * named none of them. `spawnProcess()` refuses any command not in that set before
 * ever checking whether the binary exists, so `probeArchiver()` always answered
 * `available: false` and "Create the archive" silently did nothing — regardless of
 * whether 7-Zip was actually installed. The gate the security comment describes
 * ("cannot quietly turn this into an arbitrary shell") was working exactly as
 * designed; it was simply never told the archiver's own name.
 *
 * Nothing here trusts either module's report of its own success. The tests that
 * exercise a real archiver check the file it wrote with `statSync`, and read the
 * archive back with the real archiver's own `l` (list) command — a completely
 * separate invocation from the one that wrote it — rather than trusting `outcome`
 * or `probe`. The tests that exercise the disallowed/absent-archiver paths do so
 * through the real `spawnProcess`, not a stub of it: a disallowed command is
 * refused by the module's actual string check, and an absent archiver is proven
 * absent by really clearing `PATH` before a real `child_process.spawn()` looks
 * for it, so the resulting ENOENT is genuine, not asserted.
 *
 * This file also closes the other half of the bug report: adding the archiver
 * names to `ALLOWED_COMMANDS` must not let a user-configured "preferred archiver"
 * setting smuggle some other already-allowed command (`npm`, `git`, ...) into
 * being probed with archiver-shaped arguments. `isKnownArchiverCommand()` is
 * exactly that check, and is proven here to reject everything except the three
 * real archiver names.
 */
import { execFileSync } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ARCHIVER_CANDIDATES,
  DEFAULT_ARCHIVE_OPTIONS,
  isKnownArchiverCommand,
  planArchive,
  probeArchiver,
  runCommand,
  type ArchiveOptions
} from '../../src/renderer/features/export/archive';
import { allowedCommands, attachProcessBroadcast, killAll, spawnProcess } from '../../src/main/services/processes';
import type { ProcessEvent, Result, SpawnHandle, SpawnOptions, StudioApi, StudioEvents } from '../../src/shared/api';
// Type-only: erased at compile time, so this never actually imports the
// `electron` module into a plain Node/vitest process.
import type { BrowserWindow } from 'electron';

// Real subprocesses, on a machine that may be sharing CPU with other work.
// vitest's 5s default is not enough headroom for that (see the repository's own
// notes on contended hosts turning slow-but-correct tests into failures).
vi.setConfig({ testTimeout: 30_000, hookTimeout: 20_000 });

/* ==================================================================== */
/* A bridge that is the real thing, minus Electron's IPC transport        */
/* ==================================================================== */

/**
 * Wires `archive.ts`'s calls straight into the real, unmodified
 * `spawnProcess()` / `attachProcessBroadcast()` from `processes.ts` — the exact
 * pair `main/ipc.ts` wires together for the real app, just without an actual
 * `BrowserWindow` and `ipcRenderer` round trip in between. `studio.process.spawn`
 * replicates only the try/catch-to-`Result` wrapping `ipc.ts`'s own
 * `registerHandler` does (`error.message`, nothing more), and `studio.events.on`
 * replicates only the subscribe/unsubscribe `preload/index.ts` exposes. Every
 * decision that matters — whether a command is allowed, whether the OS can find
 * the binary, what the child process actually does — happens in the real,
 * unmodified module.
 */
function createBridgedStudio(options: { forceEnv?: Record<string, string> } = {}): StudioApi {
  const emitter = new EventEmitter();
  const fakeWindow = {
    isDestroyed: () => false,
    webContents: {
      send: (_channel: string, event: ProcessEvent) => {
        emitter.emit('process:event', event);
      }
    }
  };
  attachProcessBroadcast(() => fakeWindow as unknown as BrowserWindow);

  const studio = {
    process: {
      async spawn(spawnOptions: SpawnOptions): Promise<Result<SpawnHandle>> {
        try {
          const merged: SpawnOptions = options.forceEnv
            ? { ...spawnOptions, env: { ...(spawnOptions.env ?? {}), ...options.forceEnv } }
            : spawnOptions;
          const handle = spawnProcess(merged);
          return { ok: true, value: handle };
        } catch (error) {
          return { ok: false, error: error instanceof Error ? error.message : String(error) };
        }
      }
    },
    events: {
      on<K extends keyof StudioEvents>(name: K, handler: (payload: StudioEvents[K]) => void): () => void {
        const listener = (payload: StudioEvents[K]): void => handler(payload);
        emitter.on(name, listener as (...args: unknown[]) => void);
        return () => emitter.off(name, listener as (...args: unknown[]) => void);
      }
    }
  };

  // Only `.process` and `.events` are real for this test bridge; nothing here
  // ever calls another member of StudioApi, so the rest is deliberately absent
  // rather than stubbed out with fakes nobody would notice were wrong.
  return studio as unknown as StudioApi;
}

/**
 * Every casing Windows might use for the PATH variable, forced empty. Applied
 * as a real `env` override on a real `spawn()` call, this makes the OS
 * genuinely unable to find `7z.exe` even though it is installed — the actual
 * mechanism behind a "no archiver on this machine" run, not a description of
 * one.
 */
function emptyPathEnv(): Record<string, string> {
  const overrides: Record<string, string> = { PATH: '', Path: '', path: '' };
  for (const key of Object.keys(process.env)) {
    if (key.toLowerCase() === 'path') overrides[key] = '';
  }
  return overrides;
}

/** Whichever of the three candidate names actually answers on this machine. */
function detectRealArchiver(): string | null {
  for (const candidate of ARCHIVER_CANDIDATES) {
    try {
      execFileSync(candidate, ['i'], { stdio: 'ignore', timeout: 10_000, windowsHide: true });
      return candidate;
    } catch {
      continue;
    }
  }
  return null;
}

const REAL_ARCHIVER = detectRealArchiver();
// eslint-disable-next-line no-console
console.log(
  REAL_ARCHIVER
    ? `[export-archive.test.ts] real archiver detected: "${REAL_ARCHIVER}" — the real-archive tests run for real.`
    : '[export-archive.test.ts] no archiver found on PATH (7z/7za/7zz) — the real-archive tests are skipped; the ' +
      'honest-refusal tests, which need no archiver at all, still run.'
);

const tmpDirs: string[] = [];
afterEach(() => {
  killAll();
  for (const dir of tmpDirs.splice(0)) {
    try {
      rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
    } catch {
      // Best-effort: a lingering handle outliving this process by a moment is
      // not worth failing the whole suite over.
    }
  }
});

/* ==================================================================== */
/* The exact gate that killed the feature                                */
/* ==================================================================== */

describe('ALLOWED_COMMANDS: the exact gate that shipped killing the archive feature', () => {
  it('now includes every archiver binary archive.ts actually tries', () => {
    const allowed = new Set(allowedCommands());
    for (const candidate of ARCHIVER_CANDIDATES) {
      expect(allowed.has(candidate), `"${candidate}" is missing from ALLOWED_COMMANDS`).toBe(true);
    }
  });

  it('self-test: this is not a vacuous check -- an unlisted command is still refused, by name, before any spawn', () => {
    expect(allowedCommands()).not.toContain('powershell');
    let thrown: unknown = null;
    try {
      spawnProcess({ command: 'powershell', args: ['-NoProfile'] });
    } catch (error) {
      thrown = error;
    }
    expect(thrown, 'spawnProcess() did not throw for a command that is not on the allowlist').toBeInstanceOf(Error);
    expect((thrown as Error).message).toMatch(/Refusing to start "powershell"/);
  });

  it(
    'self-test: the exact historical bug reproduces when the allowlist and the archiver candidate list diverge',
    () => {
      // ALLOWED_COMMANDS exactly as it shipped in the tagged release that had
      // no working archive export: not one archiver name in it. This is the
      // literal empty intersection that made probeArchiver() answer
      // available:false on every machine, whether or not 7-Zip was installed —
      // the application's own gate refused the binary by name before ever
      // checking whether it existed.
      const shippedAllowlist = new Set([
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
      const intersection = ARCHIVER_CANDIDATES.filter((candidate) => shippedAllowlist.has(candidate));
      expect(intersection).toEqual([]);
    }
  );
});

/* ==================================================================== */
/* Real archive creation through the real boundary                       */
/* ==================================================================== */

describe('the archive export actually works, through the real allowlist and a real archiver', () => {
  it.skipIf(!REAL_ARCHIVER)(
    'plans, spawns and writes a real archive, verified by reading it back with the real archiver -- not by trusting this module\'s report',
    async () => {
      const tempRoot = mkdtempSync(join(tmpdir(), 'archive-export-test-'));
      tmpDirs.push(tempRoot);
      const rootName = 'payload';
      const rootDir = join(tempRoot, rootName);
      mkdirSync(rootDir);
      mkdirSync(join(rootDir, 'nested'));
      writeFileSync(join(rootDir, 'hello.txt'), 'hello archive world\n');
      writeFileSync(join(rootDir, 'nested', 'note.txt'), 'a nested file, to prove -r recursion works too\n');

      const studio = createBridgedStudio();
      const options: ArchiveOptions = { ...DEFAULT_ARCHIVE_OPTIONS, format: '7z', method: 'Copy', level: 0 };
      const plan = planArchive({
        command: REAL_ARCHIVER as string,
        options,
        parentDirectory: tempRoot,
        root: rootName,
        separator: '\\'
      });

      const outcome = await runCommand(studio, {
        command: plan.command,
        args: plan.args,
        cwd: plan.cwd,
        timeoutMs: 20_000
      });

      expect(outcome.started, `spawn was refused: ${outcome.refusal ?? '(no refusal reason given)'}`).toBe(true);
      expect(outcome.timedOut).toBe(false);
      expect(outcome.exitCode, `archiver stderr: ${outcome.stderr}\nstdout: ${outcome.stdout}`).toBe(0);

      // Independent channel #1: the real filesystem, not the module's opinion
      // of what it wrote.
      const stat = statSync(plan.archivePath);
      expect(stat.isFile()).toBe(true);
      expect(stat.size).toBeGreaterThan(0);

      // Independent channel #2: a completely separate invocation of the same
      // real archiver, asked to list what is actually inside the file on disk.
      const listing = execFileSync(REAL_ARCHIVER as string, ['l', plan.archivePath], {
        encoding: 'utf8',
        timeout: 20_000
      });
      expect(listing).toContain('hello.txt');
      expect(listing).toContain('note.txt');
      expect(listing).toMatch(/payload[\\/]hello\.txt|hello\.txt/);
    }
  );

  it.skipIf(!REAL_ARCHIVER)('probeArchiver() reports the real archiver as available, honestly', async () => {
    const studio = createBridgedStudio();
    const probe = await probeArchiver(studio, '');
    expect(probe.available).toBe(true);
    expect(probe.command).toBe(REAL_ARCHIVER);
    expect(probe.reason).toBe('');
  });
});

/* ==================================================================== */
/* The honest refusal path, proven without needing an archiver at all    */
/* ==================================================================== */

describe('when no archiver can be found, the failure is reported honestly -- never a silent no-op', () => {
  it('a real spawn with PATH genuinely emptied produces a real "not found" outcome', async () => {
    const studio = createBridgedStudio({ forceEnv: emptyPathEnv() });
    const outcome = await runCommand(studio, { command: '7z', args: ['i'], timeoutMs: 10_000 });

    // The bridge accepted the request -- "7z" IS an allowed command name now --
    // but the OS genuinely could not locate the executable with no PATH to
    // search, so it never actually launched.
    expect(outcome.started).toBe(true);
    expect(outcome.timedOut).toBe(false);
    expect(outcome.exitCode).toBeNull();
    expect(outcome.stderr.toLowerCase()).toContain('enoent');
  });

  it('probeArchiver() aggregates that into available:false with the real reason, having really tried all three', async () => {
    const studio = createBridgedStudio({ forceEnv: emptyPathEnv() });
    const probe = await probeArchiver(studio, '');

    expect(probe.available).toBe(false);
    expect(probe.command).toBeNull();
    expect(probe.tried).toEqual(ARCHIVER_CANDIDATES);
    expect(probe.reason.length).toBeGreaterThan(0);
  });

  it('a disallowed command name is refused before any spawn is attempted, with the exact reason surfaced', async () => {
    const studio = createBridgedStudio();
    const outcome = await runCommand(studio, { command: 'not-a-real-archiver-tool', args: ['i'], timeoutMs: 5_000 });

    expect(outcome.started).toBe(false);
    expect(outcome.refusal).toMatch(/Refusing to start "not-a-real-archiver-tool"/);
    expect(outcome.exitCode).toBeNull();
  });
});

/* ==================================================================== */
/* isKnownArchiverCommand: the settings field cannot smuggle in an       */
/* unrelated already-allowed command                                     */
/* ==================================================================== */

describe('isKnownArchiverCommand(): a configured "preferred archiver" value is validated against the fixed set', () => {
  it('accepts exactly the three known archiver names, case- and extension-insensitively', () => {
    for (const name of ['7z', '7za', '7zz', '7Z', '7Z.EXE', ' 7za ', '7ZZ.exe', '7z.cmd', '7z.bat']) {
      expect(isKnownArchiverCommand(name), `expected "${name}" to be accepted`).toBe(true);
    }
  });

  it('rejects everything else, including commands this application legitimately allows for other features', () => {
    for (const name of ['npm', 'npx', 'git', 'docker', 'node', 'java', '', '   ', '7zip', '7z-fake', 'powershell']) {
      expect(isKnownArchiverCommand(name), `expected "${name}" to be rejected`).toBe(false);
    }
  });

  it('self-test: this is not a vacuous check -- it genuinely distinguishes valid from invalid names', () => {
    // A checker that always returns the same answer would pass every assertion
    // above trivially. Prove both outcomes are actually reachable.
    expect(isKnownArchiverCommand('7z')).toBe(true);
    expect(isKnownArchiverCommand('git')).toBe(false);
  });

  it('probeArchiver() never even attempts a configured value that is not a known archiver', async () => {
    const studio = createBridgedStudio({ forceEnv: emptyPathEnv() });
    const probe = await probeArchiver(studio, 'npm');

    // "npm" is a real, already-allowed command in ALLOWED_COMMANDS -- if it had
    // been tried, it would appear in `tried`. It must not: the settings field
    // is not permitted to route an unrelated allowed command into an
    // archiver-shaped probe. PATH is cleared here too, so this proves the
    // *filtering*, not an accidental spawn failure hiding the omission.
    expect(probe.tried).not.toContain('npm');
    expect(probe.tried).toEqual(ARCHIVER_CANDIDATES);
  });

  it.skipIf(!REAL_ARCHIVER)('a genuinely valid configured archiver name IS tried, and tried first', async () => {
    const studio = createBridgedStudio();
    const probe = await probeArchiver(studio, REAL_ARCHIVER as string);

    expect(probe.tried[0]).toBe(REAL_ARCHIVER);
    expect(probe.available).toBe(true);
    expect(probe.command).toBe(REAL_ARCHIVER);
  });
});
