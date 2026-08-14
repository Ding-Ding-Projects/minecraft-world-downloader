import { app } from 'electron';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The stable package identity.
 *
 * Every directory below is derived from THIS constant and never from the display
 * name the user may choose in settings. Renaming the application changes what it
 * calls itself in the title bar and nothing else: the data directory, the
 * installer identity and the update feed all stay put. Deriving a data directory
 * from a mutable display name orphans every stored profile the moment somebody
 * types a new title.
 */
export const PACKAGE_NAME = 'world-downloader-studio';

/** The shipped product name. Diagnostics use this, never the chosen name. */
export const PRODUCT_NAME = 'World Downloader Studio';

let cachedRoot: string | null = null;

function ensure(dir: string): string {
  mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Root of the application data directory.
 *
 * Electron derives `userData` from the packaged product name, which is exactly
 * the thing that must not move, so we pin it to the package name explicitly at
 * startup instead of inheriting whatever the installer wrote.
 */
export function userDataRoot(): string {
  if (cachedRoot) return cachedRoot;
  const base = app.getPath('appData');
  cachedRoot = ensure(join(base, PACKAGE_NAME));
  return cachedRoot;
}

export function settingsFilePath(): string {
  return join(userDataRoot(), 'settings.json');
}

export function windowStateFilePath(): string {
  return join(userDataRoot(), 'window-state.json');
}

export function vaultFilePath(): string {
  return join(userDataRoot(), 'vault.bin');
}

export function historyDir(): string {
  return ensure(join(userDataRoot(), 'history'));
}

export function logsDir(): string {
  return ensure(join(userDataRoot(), 'logs'));
}

export function cacheDir(): string {
  return ensure(join(userDataRoot(), 'cache'));
}

/**
 * Directory holding the validated personal-vocabulary cache, if the user has
 * ever supplied a file. Nothing is written here until they do.
 */
export function vocabularyCacheDir(): string {
  return ensure(join(cacheDir(), 'vocabulary'));
}

/**
 * Root of the bundled-tools resources directory.
 *
 * Inside a packaged build this IS `process.resourcesPath` — the directory
 * `extraResources` in `electron-builder.yml` copies the Java engine jar (and,
 * where a release build includes them, a trimmed Java runtime, MinGit and
 * the GitHub CLI) into.
 *
 * There is no packaged resources directory in development, so this resolves
 * to `app/resources` in the repository checkout instead — computed from
 * `__dirname` rather than `process.cwd()`, since electron-vite bundles every
 * main-process source file into the single `out/main/index.js`, so
 * `__dirname` there is always `<repo>/app/out/main` regardless of where the
 * process was launched from. Two levels up is `app/`. The directory is
 * created on first use so a `npm run dev` session finds bundled tools the
 * exact same way an installed build does, once they are dropped in place.
 *
 * Safe to call from a process that never ran inside Electron at all -- a
 * plain-Node tool, or a test that imports this module without mocking
 * `electron`. Outside a real Electron process the `electron` package's own
 * entry point resolves to a bare string (the path to the Electron binary),
 * so the named `app` import comes back `undefined` rather than throwing on
 * import; reading `.isPackaged` straight off that used to throw
 * `TypeError: Cannot read properties of undefined`. `app?.isPackaged` reads
 * as `undefined` instead, which is falsy, so an Electron-less process simply
 * takes the same branch an unpackaged development run already takes -- the
 * `__dirname`-relative repository path -- rather than crashing. Nothing here
 * decides whether a bundled tool is actually present; that is `bundled.ts`'s
 * job, and it re-checks the result on disk regardless of which branch ran.
 */
export function resourcesRoot(): string {
  if (app?.isPackaged) return process.resourcesPath;
  return ensure(join(__dirname, '..', '..', 'resources'));
}

/** Applies the pinned data directory. Call before `app.whenReady()`. */
export function applyStablePaths(): void {
  const root = userDataRoot();
  app.setPath('userData', root);
  app.setPath('sessionData', ensure(join(root, 'session')));
  app.setPath('logs', logsDir());
}
