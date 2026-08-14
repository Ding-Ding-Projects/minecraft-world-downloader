#!/usr/bin/env node
/**
 * Downloads, verifies and unpacks the build-time tools World Downloader Studio
 * bundles inside its own Windows installer.
 *
 * WHY THIS EXISTS
 *
 * The application looks for a dependency it needs (a Java runtime to run its
 * engine, Git to run the World Vault) INSIDE its own installation first, via
 * `app/src/main/services/bundled.ts`'s `resolveTool()`. Only when a tool is
 * genuinely absent from both the bundle and PATH does the application report
 * it as unavailable -- and it reports that honestly, in place, rather than
 * ever handing the user a browser link. This script is the other half of that
 * contract: it is what actually puts the tools inside the bundle, so that
 * "look inside the installation first" has something real to find.
 *
 * Acquisition happens here, at BUILD time, and only here. The running
 * application never downloads anything itself.
 *
 * THE FIXED PATH CONTRACT (matches app/src/main/services/bundled.ts exactly)
 *
 *   <resources>/runtime/jre/bin/java.exe   a trimmed Java runtime
 *   <resources>/runtime/git/cmd/git.exe    MinGit, the portable Git for Windows
 *   <resources>/runtime/gh/bin/gh.exe      the GitHub CLI (optional, see below)
 *
 * In this repository checkout, <resources> is `app/resources` -- the exact
 * directory `app/electron-builder.yml`'s `extraResources` entry copies into
 * the packaged application's `resources/runtime/**`, and the exact directory
 * `app/src/main/paths.ts`'s `resourcesRoot()` falls back to in development.
 *
 * WHAT IS FETCHED
 *
 *   jre  Eclipse Temurin 21 JRE, Windows x64. Always fetched: every download
 *        needs the bundled Java engine to run.
 *   git  MinGit, Windows x64. Always fetched: the World Vault feature needs
 *        it for every world's local history.
 *   gh   The GitHub CLI, Windows x64. NOT fetched by default -- it only
 *        serves the World Vault's optional "publish to a new GitHub
 *        repository" action, and bundling it in every installer for that one
 *        rarely-used path would add roughly another 14 MB (compressed) on
 *        top of what the JRE and MinGit already add. Pass --with-gh (or set
 *        FETCH_GH=1 / WITH_GH=1) to include it. When it is not bundled, the
 *        application falls back to `gh` on PATH exactly as for any other
 *        tool, and reports honestly when neither is present.
 *
 * Every pinned URL, exact release and SHA-256 digest lives in the sibling
 * `dependency-manifest.json`, not in this file, so a human auditing what
 * ends up inside the installer only has to read one small JSON file. This
 * script refuses to extract anything whose downloaded bytes do not match
 * that pinned SHA-256 -- an unverified binary never reaches the installer.
 *
 * IDEMPOTENCE
 *
 * A warm run re-verifies and skips rather than re-downloading: each target
 * directory carries a small `.provenance.json` stamp recording which pinned
 * release and SHA-256 produced it, and a run is considered current when that
 * stamp matches the manifest AND the tool's marker executable is still on
 * disk. This does not re-hash the (already extracted, already verified)
 * installed files on every run -- that would mean re-hashing ~270 MB of
 * files just to confirm what a small stamp file already answers. Pass
 * --force to ignore the stamp and redo everything unconditionally.
 *
 * Downloaded archives are cached in `resources/.download-cache/` and reused
 * across runs (and across jre/git/gh, keyed by filename) as long as their
 * hash still matches the pin; a cache entry that fails to verify is
 * discarded and re-downloaded once before this is called a failure.
 *
 * USAGE
 *
 *   node scripts/fetch-dependencies.mjs              jre + git only
 *   node scripts/fetch-dependencies.mjs --with-gh     jre + git + gh
 *   node scripts/fetch-dependencies.mjs --force       ignore stamps, redo all
 *
 * Never prompts. Exits non-zero on the first real failure, naming the exact
 * dependency, the pinned constraint, the source it was fetched from and the
 * blocking error -- never a bare "failed".
 *
 * Wired as `predist` / `predist:dir` in app/package.json (so a bare
 * `npm run dist` self-heals, matching scripts/ensure-electron-binary.mjs's
 * existing pattern) and as its own explicit, reported phase in the
 * repository's scripts/windows-build.ps1 before packaging.
 */

import { createHash } from 'node:crypto';
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(here, '..');
const resourcesDir = join(appRoot, 'resources');
const runtimeDir = join(resourcesDir, 'runtime');
const cacheDir = join(resourcesDir, '.download-cache');
const manifestPath = join(here, 'dependency-manifest.json');

const args = process.argv.slice(2);
const withGh =
  args.includes('--with-gh') ||
  args.includes('--include-gh') ||
  process.env.FETCH_GH === '1' ||
  process.env.WITH_GH === '1';
const force = args.includes('--force');
const wantsHelp = args.includes('--help') || args.includes('-h');

if (wantsHelp) {
  console.log(`fetch-dependencies: downloads, verifies and unpacks the build-time tools
World Downloader Studio bundles inside its own Windows installer.

Usage:
  node scripts/fetch-dependencies.mjs [--with-gh] [--force]

  --with-gh, --include-gh   also fetch the GitHub CLI (off by default; it only
                             serves the World Vault's optional GitHub-publish
                             action). Same as FETCH_GH=1 or WITH_GH=1.
  --force                   ignore the .provenance.json stamps and re-fetch,
                             re-verify and re-extract everything.

Pinned versions, URLs and SHA-256 digests live in scripts/dependency-manifest.json.
`);
  process.exit(0);
}

if (!existsSync(manifestPath)) {
  fail('dependency manifest', {
    constraint: 'scripts/dependency-manifest.json must exist',
    source: manifestPath,
    problem: 'the file this script reads its pinned versions, URLs and SHA-256 digests from is missing from this checkout'
  });
}

/** @type {{ tools: Record<string, {
 *   name: string, release: string, url: string, sha256: string, sizeBytes: number,
 *   archiveTopLevelDir: string | null, targetDir: string, markerFile: string,
 *   bundledByDefault: boolean
 * }> }} */
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

function log(toolId, message) {
  console.log(`[fetch-dependencies] ${toolId}: ${message}`);
}

function fail(toolId, { constraint, source, problem }) {
  console.error('');
  console.error('-'.repeat(74));
  console.error('  FETCH-DEPENDENCIES FAILED');
  console.error('-'.repeat(74));
  console.error(`  Dependency or step : ${toolId}`);
  console.error(`  Version constraint : ${constraint ?? '(none)'}`);
  console.error(`  Source tried       : ${source ?? '(none)'}`);
  console.error(`  Blocking error     : ${problem}`);
  console.error('-'.repeat(74));
  process.exit(1);
}

function sha256Of(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function formatBytes(bytes) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GiB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(2)} MiB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KiB`;
  return `${bytes} bytes`;
}

async function downloadFile(url, destination, toolId) {
  log(toolId, `downloading ${url}`);
  let response;
  try {
    response = await fetch(url, { redirect: 'follow' });
  } catch (error) {
    fail(toolId, {
      source: url,
      problem: `network request failed: ${error instanceof Error ? error.message : String(error)}`
    });
    return;
  }
  if (!response.ok || !response.body) {
    fail(toolId, { source: url, problem: `HTTP ${response.status} ${response.statusText}` });
    return;
  }

  mkdirSync(dirname(destination), { recursive: true });
  const partial = `${destination}.part`;
  try {
    await pipeline(Readable.fromWeb(response.body), createWriteStream(partial));
  } catch (error) {
    rmSync(partial, { force: true });
    fail(toolId, {
      source: url,
      problem: `download stream failed: ${error instanceof Error ? error.message : String(error)}`
    });
    return;
  }
  renameSync(partial, destination);
  log(toolId, `downloaded ${formatBytes(statSync(destination).size)}`);
}

function verifyChecksum(filePath, expectedSha256, toolId) {
  const actual = sha256Of(filePath);
  if (actual.toLowerCase() !== expectedSha256.toLowerCase()) {
    fail(toolId, {
      constraint: `SHA-256 ${expectedSha256}`,
      source: filePath,
      problem: `the archive hashed to ${actual}; refusing to extract an unverified binary into the installer. The file has been left in place for inspection rather than deleted -- remove ${filePath} before retrying if it is simply corrupt.`
    });
    return;
  }
  log(toolId, `SHA-256 verified: ${actual}`);
}

function extractZip(archivePath, destinationDir, toolId) {
  mkdirSync(destinationDir, { recursive: true });
  try {
    if (process.platform === 'win32') {
      execFileSync(
        'powershell.exe',
        [
          '-NoProfile',
          '-ExecutionPolicy',
          'Bypass',
          '-Command',
          `Expand-Archive -LiteralPath '${archivePath.replace(/'/g, "''")}' -DestinationPath '${destinationDir.replace(/'/g, "''")}' -Force`
        ],
        { stdio: 'inherit' }
      );
    } else {
      execFileSync('unzip', ['-o', '-q', archivePath, '-d', destinationDir], { stdio: 'inherit' });
    }
  } catch (error) {
    fail(toolId, {
      source: archivePath,
      problem: `extraction failed: ${error instanceof Error ? error.message : String(error)}`
    });
  }
}

function toolTargetDir(spec) {
  return join(resourcesDir, ...spec.targetDir.split('/'));
}

function markerPath(spec) {
  return join(toolTargetDir(spec), ...spec.markerFile.split('/'));
}

function provenancePath(targetDir) {
  return join(targetDir, '.provenance.json');
}

function isAlreadyCurrent(spec) {
  const marker = markerPath(spec);
  if (!existsSync(marker)) return false;
  const provFile = provenancePath(toolTargetDir(spec));
  if (!existsSync(provFile)) return false;
  try {
    const provenance = JSON.parse(readFileSync(provFile, 'utf8'));
    return provenance.release === spec.release && provenance.sha256 === spec.sha256;
  } catch {
    return false;
  }
}

async function ensureTool(id, spec) {
  const targetDir = toolTargetDir(spec);

  if (!force && isAlreadyCurrent(spec)) {
    log(id, `already present and verified at ${targetDir} (${spec.release}); skipping`);
    return;
  }

  mkdirSync(cacheDir, { recursive: true });
  const archiveName = spec.url.split('/').pop();
  const cachedArchive = join(cacheDir, archiveName);

  let needDownload = true;
  if (!force && existsSync(cachedArchive)) {
    const actual = sha256Of(cachedArchive);
    if (actual.toLowerCase() === spec.sha256.toLowerCase()) {
      log(id, `reusing cached, verified archive at ${cachedArchive}`);
      needDownload = false;
    } else {
      log(id, `cached archive at ${cachedArchive} does not match the pinned SHA-256; discarding and re-downloading`);
      rmSync(cachedArchive, { force: true });
    }
  }

  if (needDownload) {
    await downloadFile(spec.url, cachedArchive, id);
    verifyChecksum(cachedArchive, spec.sha256, id);
  }

  const actualSize = statSync(cachedArchive).size;
  if (actualSize !== spec.sizeBytes) {
    // The SHA-256 check above is authoritative; a size mismatch alone is not
    // treated as a failure (a re-hosted mirror can legitimately re-encode
    // nothing and still match bit-for-bit, but this is worth surfacing).
    log(id, `note: archive is ${formatBytes(actualSize)}; manifest recorded ${formatBytes(spec.sizeBytes)} when it was pinned`);
  }

  const staging = join(cacheDir, `.staging-${id}-${process.pid}-${Date.now()}`);
  rmSync(staging, { recursive: true, force: true });
  log(id, `extracting ${archiveName}`);
  extractZip(cachedArchive, staging, id);

  const sourceRoot = spec.archiveTopLevelDir ? join(staging, spec.archiveTopLevelDir) : staging;
  const sourceMarker = join(sourceRoot, ...spec.markerFile.split('/'));
  if (!existsSync(sourceMarker)) {
    fail(id, {
      constraint: `${spec.markerFile} inside the extracted archive`,
      source: cachedArchive,
      problem: `the archive extracted but ${sourceMarker} is not there; its layout no longer matches what this script expects (archiveTopLevelDir: ${spec.archiveTopLevelDir ?? '(none)'} in dependency-manifest.json)`
    });
    return;
  }

  rmSync(targetDir, { recursive: true, force: true });
  mkdirSync(dirname(targetDir), { recursive: true });
  renameSync(sourceRoot, targetDir);
  rmSync(staging, { recursive: true, force: true });

  writeFileSync(
    provenancePath(targetDir),
    `${JSON.stringify(
      {
        tool: id,
        name: spec.name,
        release: spec.release,
        url: spec.url,
        sha256: spec.sha256,
        fetchedAt: new Date().toISOString()
      },
      null,
      2
    )}\n`,
    'utf8'
  );

  const finalMarker = markerPath(spec);
  if (!existsSync(finalMarker)) {
    fail(id, {
      constraint: `${spec.markerFile} at ${targetDir}`,
      source: targetDir,
      problem: 'moved into place but the marker executable is missing afterwards'
    });
    return;
  }

  log(id, `ready at ${targetDir} (${spec.name}, ${spec.release})`);
}

async function main() {
  const entries = Object.entries(manifest.tools ?? {});
  if (entries.length === 0) {
    fail('dependency manifest', {
      source: manifestPath,
      problem: 'the manifest has no "tools" entries; nothing to fetch'
    });
    return;
  }

  const selected = entries.filter(([, spec]) => spec.bundledByDefault || withGh);
  const skipped = entries.filter(([, spec]) => !spec.bundledByDefault && !withGh);

  console.log(`[fetch-dependencies] resources root : ${resourcesDir}`);
  console.log(`[fetch-dependencies] fetching        : ${selected.map(([id]) => id).join(', ') || '(none)'}`);
  if (skipped.length > 0) {
    console.log(
      `[fetch-dependencies] on demand only  : ${skipped.map(([id]) => id).join(', ')} (pass --with-gh to bundle it too)`
    );
  }

  for (const [id, spec] of selected) {
    await ensureTool(id, spec);
  }

  console.log('[fetch-dependencies] done.');
}

main().catch((error) => {
  fail('fetch-dependencies', {
    problem: `unexpected error: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`
  });
});
