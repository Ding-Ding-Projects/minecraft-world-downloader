#!/usr/bin/env node
/**
 * The Scraper bot bundling guard.
 *
 * `electron-builder.yml`'s `extraResources` copies the standalone
 * `scraper/` project (one directory above `app/`) into every packaged
 * installer at `<resources>/scraper`, so the Scraper bot tab works on a
 * machine that has never seen Node.js. electron-builder itself only checks
 * that the `from` directory exists — it happily packages `scraper/` even
 * when its own `node_modules` was never installed, which would ship a
 * `scrape.js` that starts, immediately throws `Cannot find module
 * 'mineflayer'`, and looks like an application defect rather than a build
 * that skipped a step. This script is what actually catches that before a
 * single byte is packaged.
 *
 * Run before `electron-builder`, from `app/`:
 *
 *     node scripts/check-scraper-bundle.mjs
 *
 * Wired as part of `predist` / `predist:dir` in `app/package.json`, after
 * `scripts/fetch-dependencies.mjs`, so a bare `npm run dist` fails loudly
 * here rather than shipping a Scraper bot that cannot start.
 *
 * What it verifies, against the real files on disk:
 *
 *   1. `scraper/scrape.js` exists.
 *   2. `scraper/package.json` exists and is genuinely `mcwd-scraper`.
 *   3. `scraper/node_modules/<dep>/package.json` exists and genuinely names
 *      itself `<dep>`, for every dependency `scraper/package.json` declares
 *      (`mineflayer`, `mineflayer-pathfinder`, `prismarine-auth` today —
 *      read live from the manifest, so a future dependency added there is
 *      checked too without this file needing an edit to match).
 *
 * A repository checkout where nobody has ever run `npm install` inside
 * `scraper/` fails here with the exact missing package named, rather than
 * producing an installer that silently ships a non-functional bot.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_DIR = resolve(fileURLToPath(new URL('..', import.meta.url)));
export const SCRAPER_DIR = resolve(APP_DIR, '..', 'scraper');

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

export function checkScraperBundle(scraperDir = SCRAPER_DIR) {
  const problems = [];

  const scriptPath = join(scraperDir, 'scrape.js');
  if (!existsSync(scriptPath)) {
    problems.push(
      `${scriptPath} does not exist. The Scraper bot's own entry point is missing from the ` +
        'scraper/ project this repository ships beside app/.'
    );
  }

  const manifestPath = join(scraperDir, 'package.json');
  const manifest = readJson(manifestPath);
  if (!manifest) {
    problems.push(`${manifestPath} does not exist or is not valid JSON.`);
    return { problems, dependencies: [] };
  }
  if (manifest.name !== 'mcwd-scraper') {
    problems.push(`${manifestPath} does not declare itself "mcwd-scraper" (found "${manifest.name}").`);
  }

  const dependencies = Object.keys(manifest.dependencies ?? {});
  if (dependencies.length === 0) {
    problems.push(`${manifestPath} declares no dependencies at all, which is not the project this expects.`);
  }

  for (const dependency of dependencies) {
    const depManifestPath = join(scraperDir, 'node_modules', dependency, 'package.json');
    const depManifest = readJson(depManifestPath);
    if (!depManifest) {
      problems.push(
        `scraper/node_modules/${dependency} is missing (${depManifestPath} does not exist). ` +
          'Run "npm install" inside scraper/ (or the repository root\'s download-dependencies.bat, ' +
          'once it installs this project\'s dependencies) before packaging.'
      );
      continue;
    }
    if (depManifest.name !== dependency) {
      problems.push(
        `scraper/node_modules/${dependency}/package.json names itself "${depManifest.name}", not "${dependency}".`
      );
    }
  }

  return { problems, dependencies };
}

function main() {
  const { problems, dependencies } = checkScraperBundle();
  if (problems.length > 0) {
    process.stderr.write(
      'check-scraper-bundle: the scraper/ project is not ready to package.\n\n'
    );
    for (const problem of problems) process.stderr.write(`  - ${problem}\n`);
    process.stderr.write(
      `\n${problems.length} problem${problems.length === 1 ? '' : 's'}. The build stops here rather ` +
        'than shipping an installer whose Scraper bot cannot start.\n'
    );
    process.exitCode = 1;
    return;
  }
  process.stdout.write(
    `check-scraper-bundle: scrape.js and ${dependencies.length} declared ` +
      `dependenc${dependencies.length === 1 ? 'y' : 'ies'} present in scraper/node_modules.\n`
  );
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`check-scraper-bundle: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
