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

/** Applies the pinned data directory. Call before `app.whenReady()`. */
export function applyStablePaths(): void {
  const root = userDataRoot();
  app.setPath('userData', root);
  app.setPath('sessionData', ensure(join(root, 'session')));
  app.setPath('logs', logsDir());
}
