import { spawn as nodeSpawn, type ChildProcess } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import type { EditorCandidate } from '../../shared/api';

/**
 * External editor detection and handoff.
 *
 * Visual Studio Code is the preferred target: everything the application can
 * export must be openable in it directly from the surface that produced the
 * file. Opening a folder opens it as a workspace root, so the file tree is
 * usable rather than a single file with no context.
 *
 * An external editor is NOT a dependency of this application — every feature
 * here works fully without one, and this module never treats "nothing found"
 * as a failed prerequisite. `detect()` below checks every location the
 * stable, Insiders and portable-style distributions of these editors
 * realistically install to (PATH, per-user and machine Program Files, the
 * 32-bit Program Files fallback, and the Scoop package manager's shim
 * layout) before concluding none is present. When it genuinely finds
 * nothing, `open()` says so plainly and points at the one route that
 * actually covers an install this scan cannot guess the location of — a
 * portable copy extracted somewhere arbitrary — which is the "Add editor"
 * browse control in External editor settings (see
 * `renderer/features/external-editor`), never a bare instruction to go
 * download something the user may already have.
 *
 * On Windows, the command VS Code (and VS Code Insiders, and VSCodium) puts on
 * PATH is a `.cmd` batch-file wrapper, not the real GUI executable — it exists
 * for fast terminal use (`code --version` without booting the whole Electron
 * app) and internally launches the real one itself. `child_process.spawn`
 * refuses to run a `.cmd`/`.bat` file directly with `shell: false` — Node
 * throws `EINVAL` rather than silently invoking a shell, specifically because
 * *safely* forwarding arguments through `cmd.exe`'s own metacharacter parsing
 * is a real, historically exploited problem (see Node's `DEP0190`), not
 * something to solve by turning `shell: true` on and hoping a folder or file
 * name never contains `&`, `|`, or `^`. `resolveLaunchTarget` below sidesteps
 * the whole question: once PATH resolution finds the wrapper, it looks one
 * directory up for the real GUI `.exe` sitting right next to it and launches
 * that instead — a completely normal, shell-free process launch, and the
 * layout every one of these three editors ships.
 */

interface Candidate {
  id: string;
  name: string;
  supportsFolder: boolean;
  /** Bare commands to try on PATH, in order. */
  commands: string[];
  /** Absolute paths to try, in order. `~` expands to the home directory. */
  paths: string[];
  /**
   * Windows only. When PATH/`paths` resolution finds a `.cmd`/`.bat` wrapper
   * for this candidate, the real GUI executable of this name — one directory
   * above the resolved wrapper — is preferred as the thing actually spawned.
   * See the module doc comment above for why.
   */
  guiExecutable?: string;
}

const WINDOWS_CANDIDATES: Candidate[] = [
  {
    id: 'vscode',
    name: 'Visual Studio Code',
    supportsFolder: true,
    // PATH first (`code.cmd`/`code`) — this alone already covers a portable
    // copy the user added to their own PATH, which is the one thing that
    // makes a portable install findable at all without asking where it is.
    commands: ['code.cmd', 'code'],
    paths: [
      '~/AppData/Local/Programs/Microsoft VS Code/bin/code.cmd',
      'C:/Program Files/Microsoft VS Code/bin/code.cmd',
      // The 32-bit build some older or hand-picked installs still use.
      'C:/Program Files (x86)/Microsoft VS Code/bin/code.cmd',
      // The Scoop package manager's install layout. Scoop normally also puts
      // a shim on PATH (already covered by `commands` above), so this is
      // defence in depth for a PATH that has not been refreshed since Scoop
      // installed it.
      '~/scoop/apps/vscode/current/bin/code.cmd'
    ],
    guiExecutable: 'Code.exe'
  },
  {
    id: 'vscode-insiders',
    name: 'Visual Studio Code Insiders',
    supportsFolder: true,
    commands: ['code-insiders.cmd', 'code-insiders'],
    paths: [
      '~/AppData/Local/Programs/Microsoft VS Code Insiders/bin/code-insiders.cmd',
      'C:/Program Files/Microsoft VS Code Insiders/bin/code-insiders.cmd',
      'C:/Program Files (x86)/Microsoft VS Code Insiders/bin/code-insiders.cmd',
      '~/scoop/apps/vscode-insiders/current/bin/code-insiders.cmd'
    ],
    guiExecutable: 'Code - Insiders.exe'
  },
  {
    id: 'vscodium',
    name: 'VSCodium',
    supportsFolder: true,
    commands: ['codium.cmd', 'codium'],
    paths: [
      '~/AppData/Local/Programs/VSCodium/bin/codium.cmd',
      'C:/Program Files/VSCodium/bin/codium.cmd',
      'C:/Program Files (x86)/VSCodium/bin/codium.cmd',
      '~/scoop/apps/vscodium/current/bin/codium.cmd'
    ],
    guiExecutable: 'VSCodium.exe'
  },
  {
    id: 'notepadpp',
    name: 'Notepad++',
    supportsFolder: false,
    commands: ['notepad++.exe'],
    paths: ['C:/Program Files/Notepad++/notepad++.exe', 'C:/Program Files (x86)/Notepad++/notepad++.exe']
  },
  { id: 'notepad', name: 'Notepad', supportsFolder: false, commands: ['notepad.exe'], paths: [] }
];

const POSIX_CANDIDATES: Candidate[] = [
  {
    id: 'vscode',
    name: 'Visual Studio Code',
    supportsFolder: true,
    commands: ['code'],
    paths: ['/usr/bin/code', '/usr/local/bin/code', '/snap/bin/code', '/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code']
  },
  {
    id: 'vscode-insiders',
    name: 'Visual Studio Code Insiders',
    supportsFolder: true,
    commands: ['code-insiders'],
    paths: ['/usr/bin/code-insiders', '/usr/local/bin/code-insiders']
  },
  { id: 'vscodium', name: 'VSCodium', supportsFolder: true, commands: ['codium'], paths: ['/usr/bin/codium', '/snap/bin/codium'] },
  { id: 'nano', name: 'nano', supportsFolder: false, commands: ['nano'], paths: ['/usr/bin/nano'] }
];

/**
 * The real process-launching primitive, indirected through a swappable
 * module-level binding.
 *
 * Nothing in this file's own logic ever needs a different implementation:
 * production code always runs with `spawnImpl === nodeSpawn`. The seam exists
 * so a test can prove `whichCommand`/`spawnDetached`/`open`'s real decision
 * logic — candidate resolution, the folder-vs-file branch, the
 * `supportsFolder` refusal, the catch-and-rewrap around a failed launch —
 * without ever letting a real copy of Notepad or Visual Studio Code actually
 * launch on whatever desktop is running the test. Relying on mocking the
 * `node:child_process` module instead was tried first and rejected: in this
 * project's Vitest/jsdom setup it silently failed to intercept anything,
 * which let an early draft of this module's own test suite spawn several
 * real, visible VS Code windows. An explicit, always-present seam in the
 * module under test cannot silently fail to apply the way a mock can.
 */
type SpawnFn = (command: string, args: readonly string[], options: Record<string, unknown>) => ChildProcess;
let spawnImpl: SpawnFn = nodeSpawn as unknown as SpawnFn;

/**
 * Test-only. Overrides the process-launching primitive every function in this
 * module uses, or restores the real one when called with `null`. Never
 * called from production code.
 */
export function __setSpawnImplForTests(impl: SpawnFn | null): void {
  spawnImpl = impl ?? (nodeSpawn as unknown as SpawnFn);
}

function expand(path: string): string {
  return path.startsWith('~/') ? join(homedir(), path.slice(2)) : path;
}

async function exists(path: string): Promise<boolean> {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Exported (in addition to being used internally) so the launch boundary can
 * be driven and asserted on directly in tests, against the real `where`/
 * `which` binary, rather than only indirectly through `detect()`.
 */
export function whichCommand(command: string): Promise<string | null> {
  return new Promise((resolve) => {
    const finder = process.platform === 'win32' ? 'where' : 'which';
    const child = spawnImpl(finder, [command], { windowsHide: true });
    let out = '';
    child.stdout?.on('data', (chunk: Buffer) => {
      out += chunk.toString('utf8');
    });
    child.on('error', () => resolve(null));
    child.on('close', (code) => {
      if (code !== 0) return resolve(null);
      const first = out.split(/\r?\n/).find((line) => line.trim().length > 0);
      resolve(first ? first.trim() : null);
    });
  });
}

/**
 * Spawns a detached, output-ignored process and resolves only once the child
 * has genuinely started.
 *
 * `spawn()` returns a `ChildProcess` immediately, before the operating system
 * has confirmed anything: a command that does not exist on PATH, or a binary
 * the current user cannot execute, fails asynchronously on a later tick via an
 * `'error'` event. `ChildProcess` is an `EventEmitter`, and an `'error'` event
 * with no listener is rethrown as an uncaught exception — in Electron's main
 * process that takes down the whole application, not just this feature, and it
 * happens well after `open()`'s promise would already have resolved, so no
 * caller's `try`/`catch` could ever have caught it.
 *
 * Waiting for the `'spawn'` event (Node 15.1+) rather than assuming success
 * lets a real launch failure become an honest rejection instead of a crash.
 */
export function spawnDetached(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawnImpl(command, args, {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
      shell: false
    });
    let settled = false;
    child.once('error', (error: Error) => {
      if (settled) return;
      settled = true;
      reject(error);
    });
    child.once('spawn', () => {
      if (settled) return;
      settled = true;
      child.unref();
      resolve();
    });
  });
}

/**
 * Given a resolved `.cmd`/`.bat` wrapper path, looks for the real GUI
 * executable one directory above it and returns that instead when it exists,
 * so `open()` never has to hand a batch file straight to `spawn()`. Returns
 * the original resolved path unchanged when the candidate has no
 * `guiExecutable` (nothing to prefer) or the sibling executable is not
 * actually there (a layout the running install does not match).
 */
export async function resolveLaunchTarget(resolvedPath: string, guiExecutable: string | undefined): Promise<string> {
  if (!guiExecutable) return resolvedPath;
  const exePath = join(dirname(resolvedPath), '..', guiExecutable);
  return (await exists(exePath)) ? exePath : resolvedPath;
}

let cache: EditorCandidate[] | null = null;

export async function detect(force = false): Promise<EditorCandidate[]> {
  if (cache && !force) return cache;
  const list = process.platform === 'win32' ? WINDOWS_CANDIDATES : POSIX_CANDIDATES;
  const out: EditorCandidate[] = [];
  for (const candidate of list) {
    let resolved: string | null = null;
    for (const command of candidate.commands) {
      resolved = await whichCommand(command);
      if (resolved) break;
    }
    if (!resolved) {
      for (const raw of candidate.paths) {
        const path = expand(raw);
        if (await exists(path)) {
          resolved = path;
          break;
        }
      }
    }
    const command =
      resolved !== null ? await resolveLaunchTarget(resolved, candidate.guiExecutable) : (candidate.commands[0] ?? '');
    out.push({
      id: candidate.id,
      name: candidate.name,
      command,
      available: resolved !== null,
      supportsFolder: candidate.supportsFolder
    });
  }
  cache = out;
  return out;
}

export async function open(
  target: string,
  options: { editorId?: string; asFolder?: boolean } = {}
): Promise<void> {
  const candidates = await detect();
  const available = candidates.filter((candidate) => candidate.available);
  if (available.length === 0) {
    // This is not a failed prerequisite: nothing in the application requires
    // an external editor, and every feature that offers a handoff works
    // exactly as well without one — the handoff is simply skipped. The scan
    // above already checked every common install location for VS Code
    // (stable, Insiders, and the Scoop/32-bit variants), VSCodium, Notepad++
    // and Notepad, so a genuine miss here usually means the editor is a
    // portable copy sitting somewhere this scan cannot guess — which "Add
    // editor" in External editor settings covers directly, by browsing to it
    // once, without downloading anything new.
    throw new Error(
      'No editor was found on this machine, and none is required — this application is fully functional without one. ' +
        'If an editor is already installed somewhere this automatic check does not cover, such as a portable copy, ' +
        'add it from External editor settings. Visual Studio Code is only the suggested default, not something this needs.'
    );
  }
  const chosen = options.editorId
    ? available.find((candidate) => candidate.id === options.editorId)
    : available[0];
  if (!chosen) {
    throw new Error(`The editor "${options.editorId}" is not installed on this machine.`);
  }

  let path = target;
  if (options.asFolder) {
    const stats = await fs.stat(target).catch(() => null);
    path = stats?.isDirectory() ? target : dirname(target);
    if (!chosen.supportsFolder) {
      throw new Error(`${chosen.name} cannot open a folder as a workspace root.`);
    }
  }

  const args = chosen.supportsFolder && options.asFolder ? ['--new-window', path] : [path];
  try {
    await spawnDetached(chosen.command, args);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${chosen.name} (${chosen.command}) could not be started: ${message}`);
  }
}
