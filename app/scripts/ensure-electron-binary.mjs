#!/usr/bin/env node
/**
 * Makes sure the Electron runtime binary is actually present.
 *
 * WHY THIS EXISTS
 *
 * `npm install` runs `node_modules/electron/install.js`, which downloads the
 * platform archive into the shared `@electron/get` cache and extracts it into
 * `node_modules/electron/dist`. On some hosts that script prints a cache hit,
 * exits 0 in well under a second, and extracts NOTHING — `dist/` is left holding
 * at most an empty `locales` folder and there is no `path.txt`. No error is
 * printed either time, and re-running it changes nothing, so the only reliable
 * way to judge it is whether the executable exists afterwards.
 *
 * The same happens whenever a package manager is configured to block install
 * scripts, which is increasingly the default.
 *
 * WHAT THIS DOES
 *
 * Entirely synchronous, and needs no dependency the project does not already
 * have. It finds the already-downloaded archive in the `@electron/get` cache,
 * verifies its SHA-256 against the `checksums.json` that ships inside the
 * `electron` package itself, extracts it into `node_modules/electron/dist`, and
 * writes the `path.txt` that `require('electron')` reads.
 *
 * It never downloads anything. If the archive is not in the cache it says so and
 * names the exact file it was looking for, so the failure is actionable rather
 * than a silent empty window.
 *
 * Run it directly with `node scripts/ensure-electron-binary.mjs`; it is also
 * wired as `predev` and `prestart` so the ordinary commands self-heal.
 */

import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { createRequire } from 'node:module';
import { homedir, platform as osPlatform } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(here, '..');
const electronDir = join(appRoot, 'node_modules', 'electron');

function fail(message) {
  console.error(`ensure-electron-binary: ${message}`);
  process.exit(1);
}

if (!existsSync(electronDir)) {
  fail(`the electron package is not installed at ${electronDir}. Run "npm install" first.`);
}

const version = JSON.parse(readFileSync(join(electronDir, 'package.json'), 'utf8')).version;
const platform = process.platform;
const arch = process.arch;
const executableName =
  platform === 'win32' ? 'electron.exe' : platform === 'darwin' ? 'Electron.app/Contents/MacOS/Electron' : 'electron';
const distDir = join(electronDir, 'dist');
const executablePath = join(distDir, executableName);

if (existsSync(executablePath)) {
  console.log(`ensure-electron-binary: already present (${executablePath}).`);
  process.exit(0);
}

const archiveName = `electron-v${version}-${platform}-${arch}.zip`;

function cacheRoot() {
  if (process.env.electron_config_cache) return process.env.electron_config_cache;
  if (process.env.ELECTRON_CACHE) return process.env.ELECTRON_CACHE;
  if (platform === 'win32') {
    return join(process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local'), 'electron', 'Cache');
  }
  if (platform === 'darwin') return join(homedir(), 'Library', 'Caches', 'electron');
  return join(process.env.XDG_CACHE_HOME ?? join(homedir(), '.cache'), 'electron');
}

function findArchive() {
  const root = cacheRoot();
  if (!existsSync(root)) return null;
  // The cache is one directory per download, named by a hash; the archive keeps
  // its real filename inside, so look one level down rather than guessing a hash.
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const candidate = join(root, entry.name, archiveName);
    if (existsSync(candidate)) return candidate;
  }
  const flat = join(root, archiveName);
  return existsSync(flat) ? flat : null;
}

const archive = findArchive();
if (!archive) {
  fail(
    `${archiveName} is not in the Electron download cache (${cacheRoot()}). ` +
      `Nothing was downloaded. Run "node node_modules/electron/install.js" on a machine with network access, or set ELECTRON_CACHE to a directory that already holds it.`
  );
}

/* --- verify the archive against the checksums the package itself ships --- */

const checksumsPath = join(electronDir, 'checksums.json');
if (existsSync(checksumsPath)) {
  const checksums = JSON.parse(readFileSync(checksumsPath, 'utf8'));
  const expected = checksums[archiveName];
  if (typeof expected === 'string') {
    const actual = createHash('sha256').update(readFileSync(archive)).digest('hex');
    if (actual.toLowerCase() !== expected.toLowerCase()) {
      fail(
        `the cached ${archiveName} does not match the SHA-256 recorded in checksums.json. ` +
          `Expected ${expected}, found ${actual}. Nothing was extracted; delete the cached file and download it again.`
      );
    }
    console.log(`ensure-electron-binary: ${archiveName} matches its recorded SHA-256.`);
  } else {
    console.log(`ensure-electron-binary: checksums.json has no entry for ${archiveName}; extracting without verification.`);
  }
} else {
  console.log('ensure-electron-binary: the electron package ships no checksums.json; extracting without verification.');
}

/* --- extract --- */

mkdirSync(distDir, { recursive: true });

try {
  if (platform === 'win32') {
    execFileSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-Command',
        `Expand-Archive -LiteralPath '${archive.replace(/'/g, "''")}' -DestinationPath '${distDir.replace(/'/g, "''")}' -Force`
      ],
      { stdio: 'inherit' }
    );
  } else {
    execFileSync('unzip', ['-o', '-q', archive, '-d', distDir], { stdio: 'inherit' });
  }
} catch (error) {
  fail(`extraction failed: ${error instanceof Error ? error.message : String(error)}`);
}

if (!existsSync(executablePath)) {
  rmSync(join(electronDir, 'path.txt'), { force: true });
  fail(`extraction produced no ${executableName} in ${distDir}. Nothing was written to path.txt.`);
}

writeFileSync(join(electronDir, 'path.txt'), executableName, 'utf8');

// Prove the package now resolves to a real file rather than trusting the write.
const resolved = require('electron');
if (typeof resolved !== 'string' || !existsSync(resolved)) {
  fail(`require('electron') still does not resolve to an existing file. path.txt was written as "${executableName}".`);
}

console.log(`ensure-electron-binary: ready (${resolved}) for ${osPlatform()} ${arch}, Electron ${version}.`);
