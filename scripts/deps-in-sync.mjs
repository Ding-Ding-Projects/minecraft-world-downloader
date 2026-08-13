#!/usr/bin/env node
// =============================================================================
//  Is what is installed in node_modules the same as what the manifest and the
//  lockfile say should be there?
// =============================================================================
//
//  build.bat / build.sh call this to decide whether the dependency phase can be
//  skipped on a warm checkout. It answers the real question rather than a
//  timestamp one: comparing modification times reinstalls the whole tree
//  whenever anyone edits a script or bumps a version in package.json, which
//  makes a "warm" run as slow as a cold one and, worse, wipes node_modules
//  underneath anything else that happens to be building.
//
//  Three things have to line up:
//    1. package.json's declared dependencies match what the lockfile resolved
//       for the root package. If they do not, something was declared and never
//       installed.
//    2. every package the lockfile resolved is present in node_modules at that
//       exact version, according to npm's own install marker.
//    3. that marker exists at all.
//
//  Usage:  node scripts/deps-in-sync.mjs <directory containing package.json>
//
//  Exit codes: 0 in sync (the install can be skipped). 1 out of sync, with the
//  reason on standard output. 2 bad usage.

import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const target = process.argv[2];
if (!target) {
  process.stderr.write('deps-in-sync: usage: node scripts/deps-in-sync.mjs <package directory>\n');
  process.exit(2);
}

const root = resolve(target);
const manifestPath = join(root, 'package.json');
const lockPath = join(root, 'package-lock.json');
const markerPath = join(root, 'node_modules', '.package-lock.json');

function outOfSync(reason) {
  process.stdout.write(`${reason}\n`);
  process.exit(1);
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    outOfSync(`${path} could not be read as JSON (${error.message})`);
  }
}

if (!existsSync(manifestPath)) outOfSync('package.json is missing');
if (!existsSync(lockPath)) outOfSync('package-lock.json is missing, so nothing can be compared against it');
if (!existsSync(markerPath)) outOfSync('node_modules has no install marker, so nothing is installed yet');

const manifest = readJson(manifestPath);
const lock = readJson(lockPath);
const marker = readJson(markerPath);

const DEPENDENCY_FIELDS = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'];

// 1. The manifest against the lockfile's record of the root package.
const lockPackages = lock.packages ?? {};
const lockRoot = lockPackages[''] ?? {};
for (const field of DEPENDENCY_FIELDS) {
  const declared = manifest[field] ?? {};
  const resolved = lockRoot[field] ?? {};
  for (const [name, range] of Object.entries(declared)) {
    if (resolved[name] !== range) {
      outOfSync(
        `package.json declares ${field}.${name}@${range} but package-lock.json has ` +
          `${resolved[name] ?? '(nothing)'}; the lockfile has not resolved that change yet`
      );
    }
  }
  for (const name of Object.keys(resolved)) {
    if (!(name in declared)) {
      outOfSync(`package-lock.json still carries ${field}.${name}, which package.json no longer declares`);
    }
  }
}

// 2. Every resolved package present in node_modules at the same version.
const markerPackages = marker.packages ?? {};
let checked = 0;
for (const [path, entry] of Object.entries(lockPackages)) {
  if (path === '') continue;
  // An optional package may legitimately be absent: npm skips the ones whose os
  // or cpu constraints exclude this machine, and a missing one is not a stale
  // install.
  if (entry.optional === true) continue;
  if (entry.link === true) continue;
  const installed = markerPackages[path];
  if (!installed) outOfSync(`${path} is in the lockfile but not installed`);
  if (entry.version && installed.version && entry.version !== installed.version) {
    outOfSync(`${path} is installed at ${installed.version} but the lockfile resolves ${entry.version}`);
  }
  checked += 1;
}

process.stdout.write(`${checked} locked packages are installed at the resolved versions\n`);
process.exit(0);
