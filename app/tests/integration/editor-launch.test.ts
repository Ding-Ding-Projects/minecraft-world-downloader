/**
 * Integration coverage for `services/editor`'s launch boundary.
 *
 * `open()` used to hand a detached editor process straight to
 * `child.unref()` with no `child.on('error', ...)` listener anywhere on the
 * path. `ChildProcess` is an `EventEmitter`, and Node rethrows an unheard
 * `'error'` event as an uncaught exception on the next tick -- inside
 * Electron's main process that takes down the *entire application*, not just
 * this feature, and by the time it happens `open()`'s promise has already
 * resolved, so no caller's `try`/`catch` could ever have caught it. A user
 * whose chosen editor had been uninstalled, or whose PATH pointed at a
 * deleted binary, would crash the whole app the instant they clicked
 * "Open in editor".
 *
 * While fixing that, driving the module's real launch logic end to end also
 * turned up a second, unrelated, genuinely shipping defect: on Windows, VS
 * Code (and VS Code Insiders, and VSCodium) resolve on PATH to a `.cmd`
 * wrapper script, and `child_process.spawn` refuses to run a `.cmd` file
 * directly with `shell: false` -- it throws `EINVAL` synchronously. This
 * module's own "preferred" editor could never actually launch. See
 * `resolveLaunchTarget` in `services/editor.ts` for the fix (prefer the real
 * GUI `.exe` sitting beside the wrapper) and its own doc comment for why
 * `shell: true` was rejected as the fix.
 *
 * Nothing in this project ever exercised any of this: the feature has never
 * had a test file.
 *
 * SAFETY. An early draft of this file mocked `node:child_process` with
 * `vi.mock` to intercept the final "launch the editor" spawn without ever
 * running a real GUI app. In this project's Vitest/jsdom setup that mock
 * silently failed to intercept anything -- `open()`'s real candidate
 * resolution ran uninterrupted, found the real, installed copy of VS Code on
 * this machine, and launched it for real, repeatedly, popping visible
 * windows on the desktop running the suite. Nothing failed loudly; the tests
 * that used it happened to still pass, for the wrong reason.
 *
 * This file does not make that mistake twice. Instead, `services/editor.ts`
 * exports a narrow, always-present test seam (`__setSpawnImplForTests`) that
 * every process-launching call in the module goes through. The guarded
 * implementation installed below (`installGuardedSpawn`) only ever passes a
 * call through to the real OS for a `where`/`which` PATH probe -- which is
 * safe, because querying PATH never launches anything -- and *throws* for any
 * other, unmatched command rather than silently falling through to a real
 * `spawn`. A bug in a test's own matching rule therefore fails the test
 * loudly with an explicit "refused" error, instead of popping a real window.
 */
import { spawn as realSpawn, type ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __setSpawnImplForTests,
  detect,
  open,
  resolveLaunchTarget,
  spawnDetached,
  whichCommand
} from '../../src/main/services/editor';

// Real spawns -- a `where` probe and, in the crash-safety tests, a genuine
// short-lived process -- are slower and more timing-variable than pure
// in-memory logic, especially on a machine sharing CPU with other agents.
// Give every test in this file real headroom rather than vitest's 5s default.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 20_000 });

/* ==================================================================== */
/* The guarded fake spawn implementation (see the file doc comment)      */
/* ==================================================================== */

interface Rule {
  match: (command: string, args: string[]) => boolean;
  make: (command: string, args: string[]) => ChildProcess;
}

/** Enough of a real `ChildProcess` for this module's own event listeners. */
class FakeChild extends EventEmitter {
  readonly stdout = new EventEmitter();
  unref(): this {
    return this;
  }
}

function installGuardedSpawn(rules: Rule[]): void {
  __setSpawnImplForTests((command, args, options) => {
    const argList = [...args];
    const rule = rules.find((entry) => entry.match(command, argList));
    if (rule) return rule.make(command, argList);
    if (command === 'where' || command === 'which') {
      // Safe: this is a PATH probe for some *other* candidate the current
      // test did not bother faking (e.g. Notepad while testing VS Code).
      // Querying PATH never launches anything.
      return realSpawn(command, argList, options as Record<string, unknown>);
    }
    throw new Error(
      `test safety: unmocked spawn(${JSON.stringify(command)}, ${JSON.stringify(argList)}) was attempted and refused`
    );
  });
}

/** Simulates `where <command>` (or `which`) resolving to `resolvedPath`. */
function ruleWhereResolves(rules: Rule[], targetCommand: string, resolvedPath: string): void {
  rules.push({
    match: (command, args) => (command === 'where' || command === 'which') && args[0] === targetCommand,
    make: () => {
      const child = new FakeChild();
      queueMicrotask(() => {
        child.stdout.emit('data', Buffer.from(`${resolvedPath}\r\n`, 'utf8'));
        child.emit('close', 0, null);
      });
      return child as unknown as ChildProcess;
    }
  });
}

/** Simulates a real OS process successfully starting for `exactCommand`. */
function ruleLaunchSucceeds(
  rules: Rule[],
  exactCommand: string,
  capture: Array<{ command: string; args: string[] }>
): void {
  rules.push({
    match: (command) => command === exactCommand,
    make: (command, args) => {
      capture.push({ command, args });
      const child = new FakeChild();
      queueMicrotask(() => child.emit('spawn'));
      return child as unknown as ChildProcess;
    }
  });
}

/** Simulates the OS refusing to start `exactCommand` at all. */
function ruleLaunchFails(rules: Rule[], exactCommand: string, message: string, code = 'ENOENT'): void {
  rules.push({
    match: (command) => command === exactCommand,
    make: () => {
      const child = new FakeChild();
      queueMicrotask(() => {
        const error = new Error(message) as NodeJS.ErrnoException;
        error.code = code;
        child.emit('error', error);
      });
      return child as unknown as ChildProcess;
    }
  });
}

/* ==================================================================== */
/* Crash-safety guard, shared by every test in this file                 */
/* ==================================================================== */

let uncaught: unknown[] = [];
function recordUncaught(error: unknown): void {
  uncaught.push(error);
}

beforeEach(() => {
  uncaught = [];
  process.on('uncaughtException', recordUncaught);
});

afterEach(() => {
  process.off('uncaughtException', recordUncaught);
  // Always restore the real spawn implementation, regardless of how the test
  // ended, so a leftover fake can never bleed into the next test.
  __setSpawnImplForTests(null);
  // This is the assertion the whole file exists for: whatever the test just
  // did to a spawn -- refused it, watched it fail, watched it succeed -- it
  // must never have escaped as an uncaught exception on the event loop. Before
  // the fix in services/editor.ts, the "command does not exist" tests below
  // would have failed the *suite* here, not just an assertion inside them.
  expect(uncaught, `uncaught exception(s) escaped the editor module: ${uncaught.map(String).join('; ')}`).toEqual([]);
});

/* ==================================================================== */
/* Temp fixtures                                                         */
/* ==================================================================== */

const tmpDirs: string[] = [];
function freshDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'editor-launch-test-'));
  tmpDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tmpDirs.splice(0)) {
    try {
      rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
    } catch {
      // Best-effort: a lingering handle outliving this process by a moment
      // is not worth failing the whole suite over.
    }
  }
});

/* ==================================================================== */
/* Detection: real PATH probing via `where`/`which`                      */
/* ==================================================================== */

describe('detect() -- real PATH probing', () => {
  it('returns exactly the known Windows editor candidates, none silently dropped', async () => {
    const candidates = await detect(true);
    const ids = candidates.map((candidate) => candidate.id).sort();
    expect(ids).toEqual(['notepad', 'notepadpp', 'vscode', 'vscode-insiders', 'vscodium']);
    for (const candidate of candidates) {
      expect(typeof candidate.name).toBe('string');
      expect(candidate.name.length).toBeGreaterThan(0);
      expect(typeof candidate.command).toBe('string');
      expect(typeof candidate.available).toBe('boolean');
      expect(typeof candidate.supportsFolder).toBe('boolean');
    }
  });

  it('finds Notepad through a real `where notepad.exe` probe', async () => {
    // Notepad ships with every real Windows install and lives in a
    // directory that is always on PATH, so this is deterministic without
    // depending on what else happens to be installed on the machine
    // running the suite.
    const candidates = await detect(true);
    const notepad = candidates.find((candidate) => candidate.id === 'notepad');
    expect(notepad?.available).toBe(true);
    expect(notepad?.command.toLowerCase()).toContain('notepad.exe');
  });

  it('resolves a command that genuinely does not exist to null, via a real probe', async () => {
    const resolved = await whichCommand('this-command-really-does-not-exist-xyz-987');
    expect(resolved).toBeNull();
  });

  it('resolves a command that genuinely exists to its real path, via a real probe', async () => {
    // `node` is on PATH in this environment because it is what is running
    // the test suite itself.
    const resolved = await whichCommand('node');
    expect(resolved).not.toBeNull();
    expect(resolved!.toLowerCase()).toContain('node');
  });
});

/* ==================================================================== */
/* spawnDetached(): the real, low-level launch boundary                  */
/* ==================================================================== */

describe('spawnDetached() -- the launch boundary that used to crash the app', () => {
  it('resolves once a real, harmless process genuinely starts', async () => {
    // process.execPath is a real executable this machine definitely has: it
    // is the very Node binary running this test. `--version` makes it exit
    // immediately on its own once it prints, with no window and nothing left
    // running -- a safe stand-in for "an editor that launches".
    await expect(spawnDetached(process.execPath, ['--version'])).resolves.toBeUndefined();
  });

  it('rejects, naming the command, when the command does not exist -- and does not crash', async () => {
    const bogus = 'this-command-really-does-not-exist-xyz-987';
    await expect(spawnDetached(bogus, [])).rejects.toThrow(new RegExp(bogus));
    // A macrotask boundary, not just a microtask: the bug this module used
    // to have was an *uncaught* exception, which Node raises asynchronously
    // off the 'error' event. If our own 'error' listener were somehow not
    // actually attached (a regression in spawnDetached itself), the crash
    // would still be observable here rather than silently missed because we
    // returned too early.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(uncaught).toEqual([]);
  });
});

/* ==================================================================== */
/* open(): the full handoff decision logic                               */
/* ==================================================================== */

describe('open() -- the handoff', () => {
  it('refuses an editor id that is not installed, without ever spawning a launch', async () => {
    await detect(true); // real, unmocked: establish a known-real baseline first.
    const dir = freshDir();
    await expect(open(dir, { editorId: 'not-a-real-editor-id' })).rejects.toThrow(
      /is not installed on this machine/
    );
  });

  it('refuses to open a folder in an editor that only opens files (supportsFolder: false)', async () => {
    await detect(true); // real: Notepad is guaranteed available and never supports a folder.
    const dir = freshDir();
    const file = join(dir, 'notes.txt');
    writeFileSync(file, 'hello');
    await expect(open(file, { editorId: 'notepad', asFolder: true })).rejects.toThrow(
      /cannot open a folder as a workspace root/
    );
  });

  it('opens the containing folder as a workspace root when asFolder targets a file', async () => {
    const rules: Rule[] = [];
    // A fake path inside a directory that will never contain a sibling
    // `Code.exe`, so services/editor.ts's own `resolveLaunchTarget` falls
    // straight through to this exact string -- keeping the test's control
    // over "what actually gets spawned" total.
    const fakePath = join(tmpdir(), 'fake-editors-launch-test', 'code.cmd');
    ruleWhereResolves(rules, 'code.cmd', fakePath);
    const captured: Array<{ command: string; args: string[] }> = [];
    ruleLaunchSucceeds(rules, fakePath, captured);
    installGuardedSpawn(rules);
    await detect(true); // picks up the faked `where` result for vscode.

    const dir = freshDir();
    const file = join(dir, 'level.dat');
    writeFileSync(file, 'fake nbt payload');

    await expect(open(file, { editorId: 'vscode', asFolder: true })).resolves.toBeUndefined();

    expect(captured).toHaveLength(1);
    expect(captured[0].command).toBe(fakePath);
    // The file's *containing directory*, not the file itself: this is the
    // folder-vs-file branch working correctly.
    expect(captured[0].args).toEqual(['--new-window', dir]);
  });

  it('opens a directory target directly, not its parent, when asFolder targets a directory', async () => {
    const rules: Rule[] = [];
    const fakePath = join(tmpdir(), 'fake-editors-launch-test', 'code.cmd');
    ruleWhereResolves(rules, 'code.cmd', fakePath);
    const captured: Array<{ command: string; args: string[] }> = [];
    ruleLaunchSucceeds(rules, fakePath, captured);
    installGuardedSpawn(rules);
    await detect(true);

    const dir = freshDir();
    mkdirSync(join(dir, 'region'), { recursive: true });

    await expect(open(dir, { editorId: 'vscode', asFolder: true })).resolves.toBeUndefined();

    expect(captured).toHaveLength(1);
    expect(captured[0].args).toEqual(['--new-window', dir]);
  });

  it('opens a single file without --new-window when asFolder is not requested', async () => {
    const rules: Rule[] = [];
    const fakePath = join(tmpdir(), 'fake-editors-launch-test', 'code.cmd');
    ruleWhereResolves(rules, 'code.cmd', fakePath);
    const captured: Array<{ command: string; args: string[] }> = [];
    ruleLaunchSucceeds(rules, fakePath, captured);
    installGuardedSpawn(rules);
    await detect(true);

    const dir = freshDir();
    const file = join(dir, 'export.json');
    writeFileSync(file, '{}');

    await expect(open(file, { editorId: 'vscode' })).resolves.toBeUndefined();

    expect(captured).toHaveLength(1);
    expect(captured[0].args).toEqual([file]);
  });

  it('reports an honest, command-naming failure -- and does not crash -- when a detected editor fails to launch', async () => {
    // The editor was genuinely found on PATH by `where` (so it is not the
    // "unknown editor id" branch above), but the actual OS-level launch
    // fails anyway -- the exact shape of the historical crash: a real
    // 'error' event on the child process, arriving after detection already
    // said the editor was available.
    const rules: Rule[] = [];
    const fakePath = join(tmpdir(), 'fake-editors-launch-test', 'code.cmd');
    ruleWhereResolves(rules, 'code.cmd', fakePath);
    ruleLaunchFails(rules, fakePath, `spawn ${fakePath} ENOENT`);
    installGuardedSpawn(rules);
    await detect(true);

    const dir = freshDir();
    const file = join(dir, 'notes.txt');
    writeFileSync(file, 'hello');

    await expect(open(file, { editorId: 'vscode' })).rejects.toThrow(
      /Visual Studio Code.*code\.cmd.*could not be started.*ENOENT/s
    );
  });
});

/* ==================================================================== */
/* resolveLaunchTarget(): the .cmd -> real GUI .exe redirection          */
/* ==================================================================== */

describe('resolveLaunchTarget() -- preferring the real GUI executable', () => {
  it('prefers the sibling GUI executable when it genuinely sits next to the resolved wrapper', async () => {
    const root = freshDir();
    const bin = join(root, 'bin');
    mkdirSync(bin, { recursive: true });
    const cmdPath = join(bin, 'code.cmd');
    writeFileSync(cmdPath, '@echo off\r\n');
    const exePath = join(root, 'Code.exe');
    writeFileSync(exePath, 'not a real PE file, existence is all resolveLaunchTarget checks');

    const result = await resolveLaunchTarget(cmdPath, 'Code.exe');
    expect(result).toBe(exePath);
  });

  it('falls back to the resolved wrapper path when no sibling GUI executable exists', async () => {
    const root = freshDir();
    const bin = join(root, 'bin');
    mkdirSync(bin, { recursive: true });
    const cmdPath = join(bin, 'code.cmd');
    writeFileSync(cmdPath, '@echo off\r\n');
    // Deliberately do not create Code.exe next to it.

    const result = await resolveLaunchTarget(cmdPath, 'Code.exe');
    expect(result).toBe(cmdPath);
  });

  it('returns the resolved path unchanged for a candidate with no guiExecutable at all', async () => {
    // The Notepad/Notepad++ shape: a real .exe on PATH already, nothing to
    // redirect.
    const result = await resolveLaunchTarget('C:/Windows/System32/notepad.exe', undefined);
    expect(result).toBe('C:/Windows/System32/notepad.exe');
  });
});

describe('the .cmd wrapper never reaches spawn() directly', () => {
  it('would throw EINVAL if a resolved .cmd path were ever spawned with shell:false -- proving the redirection matters', async () => {
    // This is not exercising services/editor.ts at all: it is independent,
    // ground-truth evidence for *why* resolveLaunchTarget exists, using the
    // exact spawn options spawnDetached uses. If Node ever changes this
    // behavior, this test -- not a production incident -- is what notices.
    const cmdPath = join(tmpdir(), 'editor-launch-einval-proof', 'fake.cmd');
    mkdirSync(join(tmpdir(), 'editor-launch-einval-proof'), { recursive: true });
    writeFileSync(cmdPath, '@echo off\r\n');
    let threw: NodeJS.ErrnoException | null = null;
    try {
      realSpawn(cmdPath, ['--version'], { detached: true, stdio: 'ignore', windowsHide: true, shell: false });
    } catch (error) {
      threw = error as NodeJS.ErrnoException;
    } finally {
      rmSync(join(tmpdir(), 'editor-launch-einval-proof'), { recursive: true, force: true });
    }
    expect(threw?.code).toBe('EINVAL');
  });
});
