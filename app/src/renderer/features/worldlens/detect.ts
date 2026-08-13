/**
 * Finding an installed Worldlens, and finding its headless renderer.
 *
 * These are two separate questions with two separate answers, so they get two
 * separate states on the surface. A machine can perfectly well have the desktop
 * application and no renderer to drive from here, or a renderer jar and no
 * desktop application, and reporting either as "Worldlens is installed" would be
 * telling the user something that is only half true.
 *
 * Every claim below is checked against the file system through the privileged
 * bridge. Nothing is inferred from a version number that was not read, and a
 * probe that fails says why rather than falling back to "not installed", because
 * "we could not look" is not the same answer as "it is not there".
 */

import type { StudioApi } from '../../../shared/api';
import {
  WORLDLENS_EXECUTABLE,
  WORLDLENS_PACKAGE_ID,
  baseName,
  classifyCliTarget,
  joinPath,
  launcherFor,
  localAppDataFrom,
  newestSquirrelVersion,
  parentDirectory,
  type CliKind
} from './probe';

/* ------------------------------------------------------------------ */
/* The desktop application                                             */
/* ------------------------------------------------------------------ */

export type DesktopState =
  | { kind: 'unsupported-platform'; platform: string }
  | { kind: 'not-installed'; searched: string[] }
  | { kind: 'unreadable'; searched: string[]; error: string }
  | { kind: 'invalid-choice'; path: string; error: string }
  | {
      kind: 'installed';
      /** The executable that will actually be launched. */
      executablePath: string;
      /** The Squirrel package root, when the install was found through one. */
      packageRoot: string | null;
      /** The version read from the `app-<version>` directory, when there was one. */
      version: string | null;
      /** True when the user chose this path rather than detection finding it. */
      chosen: boolean;
    };

/** Every place a Squirrel-installed Worldlens can legitimately be. */
export function desktopSearchPaths(studio: StudioApi): string[] {
  if (studio.info.platform !== 'win32') return [];
  const localAppData = localAppDataFrom(studio.info.userDataDir);
  if (!localAppData) return [];
  return [joinPath(localAppData, WORLDLENS_PACKAGE_ID)];
}

/**
 * Validates a path the user browsed to, with exactly the checks detection uses.
 *
 * A browsed path is not trusted more than a detected one: both end up here, so
 * a person who points the field at a folder, or at a file that is not there any
 * more, gets the same honest answer either way.
 */
export async function validateDesktopExecutable(
  studio: StudioApi,
  path: string
): Promise<DesktopState> {
  const trimmed = path.trim();
  if (trimmed === '') {
    return { kind: 'invalid-choice', path, error: 'No path was given.' };
  }
  const stat = await studio.fs.stat(trimmed);
  if (!stat.ok) {
    return { kind: 'invalid-choice', path: trimmed, error: stat.error };
  }
  if (!stat.value.exists) {
    return { kind: 'invalid-choice', path: trimmed, error: 'Nothing exists at that path.' };
  }
  if (!stat.value.isFile) {
    return {
      kind: 'invalid-choice',
      path: trimmed,
      error: 'That path is a folder. Choose the Worldlens executable itself.'
    };
  }
  const directory = parentDirectory(trimmed);
  const match = /^app-(\d[\w.+-]*)$/i.exec(baseName(directory));
  return {
    kind: 'installed',
    executablePath: trimmed,
    packageRoot: match ? parentDirectory(directory) : null,
    version: match && match[1] ? match[1] : null,
    chosen: true
  };
}

/**
 * Looks for an installed Worldlens desktop application.
 *
 * Squirrel's layout is a package root holding a stub launcher beside one
 * `app-<version>` directory per retained version. The stub is the right thing to
 * launch — it is what the Start menu shortcut points at, and it follows the app
 * across an update — so it is preferred, and the versioned executable is the
 * fallback for an install whose stub is missing.
 */
export async function detectDesktop(studio: StudioApi): Promise<DesktopState> {
  if (studio.info.platform !== 'win32') {
    return { kind: 'unsupported-platform', platform: studio.info.platform };
  }
  const searched = desktopSearchPaths(studio);
  if (searched.length === 0) {
    return {
      kind: 'unreadable',
      searched: [],
      error:
        'The local application-data directory could not be derived from this application’s own data directory, so there was nowhere to look.'
    };
  }

  for (const root of searched) {
    const rootStat = await studio.fs.stat(root);
    if (!rootStat.ok) return { kind: 'unreadable', searched, error: rootStat.error };
    if (!rootStat.value.exists || !rootStat.value.isDirectory) continue;

    const listing = await studio.fs.readDirectory(root);
    if (!listing.ok) return { kind: 'unreadable', searched, error: listing.error };

    const directories = listing.value.filter((entry) => entry.isDirectory).map((entry) => entry.name);
    const version = newestSquirrelVersion(directories);

    const stubPath = joinPath(root, WORLDLENS_EXECUTABLE);
    const stub = await studio.fs.stat(stubPath);
    if (stub.ok && stub.value.exists && stub.value.isFile) {
      return { kind: 'installed', executablePath: stubPath, packageRoot: root, version, chosen: false };
    }

    if (version !== null) {
      const versionedPath = joinPath(root, `app-${version}`, WORLDLENS_EXECUTABLE);
      const versioned = await studio.fs.stat(versionedPath);
      if (versioned.ok && versioned.value.exists && versioned.value.isFile) {
        return {
          kind: 'installed',
          executablePath: versionedPath,
          packageRoot: root,
          version,
          chosen: false
        };
      }
    }
  }

  return { kind: 'not-installed', searched };
}

/* ------------------------------------------------------------------ */
/* The headless renderer                                               */
/* ------------------------------------------------------------------ */

export type RendererState =
  | { kind: 'unconfigured' }
  | { kind: 'invalid-choice'; path: string; error: string }
  | { kind: 'unrecognized'; path: string }
  | {
      kind: 'ready';
      path: string;
      cliKind: CliKind;
      command: string;
      /** The version the renderer reported for itself, when the probe succeeded. */
      version: string | null;
      /** Why the version is unknown, when the probe could not answer. */
      versionNote: string | null;
    };

/** How long a version probe may take before it is abandoned. */
const VERSION_PROBE_TIMEOUT_MS = 20_000;

/**
 * Validates a chosen renderer and, when it can, asks it for its own version.
 *
 * The version probe runs the renderer's documented `--version` flag and reads
 * what it prints. It is deliberately allowed to fail without failing the whole
 * check: a Java runtime that is not installed, or a renderer that takes longer
 * than the timeout to start, means the version is unknown — which is stated —
 * not that the renderer is unusable.
 */
export async function validateRenderer(studio: StudioApi, path: string): Promise<RendererState> {
  const trimmed = path.trim();
  if (trimmed === '') return { kind: 'unconfigured' };

  const stat = await studio.fs.stat(trimmed);
  if (!stat.ok) return { kind: 'invalid-choice', path: trimmed, error: stat.error };
  if (!stat.value.exists) {
    return { kind: 'invalid-choice', path: trimmed, error: 'Nothing exists at that path.' };
  }
  if (!stat.value.isFile) {
    return {
      kind: 'invalid-choice',
      path: trimmed,
      error: 'That path is a folder. Choose the renderer file itself.'
    };
  }

  const cliKind = classifyCliTarget(trimmed);
  const launcher = launcherFor(trimmed, cliKind);
  if (!launcher) return { kind: 'unrecognized', path: trimmed };

  const probe = await probeVersion(studio, launcher.command, launcher.leading);
  return {
    kind: 'ready',
    path: trimmed,
    cliKind,
    command: launcher.command,
    version: probe.version,
    versionNote: probe.note
  };
}

async function probeVersion(
  studio: StudioApi,
  command: string,
  leading: string[]
): Promise<{ version: string | null; note: string | null }> {
  const spawned = await studio.process.spawn({
    command,
    args: [...leading, '--version'],
    maxOutputBytes: 64 * 1024,
    timeoutMs: VERSION_PROBE_TIMEOUT_MS
  });
  if (!spawned.ok) {
    return { version: null, note: `The version could not be read: ${spawned.error}` };
  }

  const id = spawned.value.id;
  const exited = await waitForExit(studio, id, VERSION_PROBE_TIMEOUT_MS);
  const stdout = await studio.process.readOutput(id, 'stdout');
  const stderr = await studio.process.readOutput(id, 'stderr');
  const text = `${stdout.ok ? stdout.value : ''}\n${stderr.ok ? stderr.value : ''}`;

  if (!exited) {
    await studio.process.kill(id);
    return { version: null, note: 'The renderer did not answer --version before the probe timed out.' };
  }

  const line = text
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .find((entry) => /\d+\.\d+/.test(entry));
  if (!line) {
    return { version: null, note: 'The renderer started but printed no version this reader recognised.' };
  }
  return { version: line, note: null };
}

/** Polls the process list until the id is no longer running, or the wait runs out. */
async function waitForExit(studio: StudioApi, id: string, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const listed = await studio.process.list();
    if (listed.ok) {
      const entry = listed.value.find((summary) => summary.id === id);
      if (!entry || !entry.running) return true;
    }
    if (Date.now() >= deadline) return false;
    await new Promise<void>((resolve) => setTimeout(resolve, 250));
  }
}

/**
 * Suggests renderer paths worth trying, from the Worldlens install this machine
 * already has. Every suggestion is checked before it is offered, so the picker
 * never lists a file that is not there.
 */
export async function suggestRendererPaths(
  studio: StudioApi,
  desktop: DesktopState
): Promise<string[]> {
  if (desktop.kind !== 'installed' || !desktop.packageRoot) return [];
  const roots: string[] = [desktop.packageRoot];
  if (desktop.version) roots.push(joinPath(desktop.packageRoot, `app-${desktop.version}`));

  const found: string[] = [];
  for (const root of roots) {
    for (const relative of [
      ['resources', 'jars'],
      ['resources', 'cli'],
      ['resources', 'app', 'dist']
    ]) {
      const directory = joinPath(root, ...relative);
      const listing = await studio.fs.readDirectory(directory);
      if (!listing.ok) continue;
      for (const entry of listing.value) {
        if (entry.isDirectory) continue;
        const kind = classifyCliTarget(entry.name);
        if (kind === 'jar' && /cli/i.test(entry.name)) found.push(entry.path);
        else if (kind === 'node' && /^index\.(m?js)$/i.test(entry.name)) found.push(entry.path);
      }
    }
  }
  return [...new Set(found)];
}
