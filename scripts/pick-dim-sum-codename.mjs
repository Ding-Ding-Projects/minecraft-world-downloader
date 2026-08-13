#!/usr/bin/env node
/**
 * Picks the next unused dim sum code name for a release.
 *
 * Every build or release carries a dim sum code name drawn from the public dim
 * sum photo catalogue, used once per project so two builds are never called the
 * same thing. This script resolves that name and proves the dish's photograph is
 * actually published before handing it over.
 *
 * How it stays cheap, which is the whole design constraint:
 *
 *  - It reads this repository's prior release bodies ONCE, in a single paginated
 *    API call, and extracts every dish already spent.
 *  - It reads the public catalogue index ONCE.
 *  - It enumerates the catalogue's photo RELEASES (three of them today), never
 *    their assets. Listing thousands of assets to choose one name is exactly the
 *    thing this script exists not to do.
 *  - It then sends a HEAD request for the next unused candidate only. GitHub
 *    answers 302 for a published asset and 404 for one that is not there, so a
 *    single request per candidate settles it.
 *
 * Usage:
 *   node scripts/pick-dim-sum-codename.mjs [--repo owner/name] [--offline] [--pretty]
 *
 * Output: one JSON object on stdout.
 *
 * Exit codes:
 *   0  a code name was resolved; the object carries it
 *   3  no code name could be resolved (catalogue unreachable, pool exhausted)
 *
 * A non-zero exit means "publish this release without a code name". The code
 * name is decoration with a purpose, never a gate: a release must not be
 * blocked, delayed or renamed because the catalogue was unavailable.
 */

import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..');
const SNAPSHOT_FILE = join(REPO_ROOT, 'app', 'src', 'renderer', 'core', 'dimsum.ts');

const CATALOGUE_REPO = 'Ding-Ding-Projects/dim-sum-photos';
const CATALOGUE_INDEX_URL =
  'https://raw.githubusercontent.com/Ding-Ding-Projects/dim-sum-photos/main/catalog/index.json';
const ASSET_BASE_URL = 'https://github.com/Ding-Ding-Projects/dim-sum-photos/releases/download';

/** How many candidates may be probed before giving up, so a broken catalogue cannot spin. */
const MAX_PROBES = 40;
/** How many prior releases are read. Far beyond any realistic history, and bounded. */
const MAX_RELEASES = 1000;

/* ------------------------------------------------------------------ */
/* Arguments                                                           */
/* ------------------------------------------------------------------ */

function parseArgs(argv) {
  const options = { repo: '', offline: false, pretty: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--repo') {
      options.repo = String(argv[i + 1] ?? '');
      i += 1;
    } else if (arg.startsWith('--repo=')) {
      options.repo = arg.slice('--repo='.length);
    } else if (arg === '--offline') {
      options.offline = true;
    } else if (arg === '--pretty') {
      options.pretty = true;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    }
  }
  return options;
}

function emit(value, pretty, code) {
  process.stdout.write(`${JSON.stringify(value, null, pretty ? 2 : 0)}\n`);
  process.exitCode = code;
}

/* ------------------------------------------------------------------ */
/* This repository's spent code names                                  */
/* ------------------------------------------------------------------ */

async function gh(args) {
  const { stdout } = await run('gh', args, { maxBuffer: 64 * 1024 * 1024, windowsHide: true });
  return stdout;
}

async function resolveRepo(explicit) {
  if (explicit) return explicit;
  const stdout = await gh(['repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner']);
  return stdout.trim();
}

/**
 * Reads every prior release body once.
 *
 * `gh api --paginate` returns the bodies with the list, so this is one command
 * rather than one `gh release view` per release. When that call is refused the
 * documented `gh release list` + `gh release view` route is used instead, which
 * costs one call per release but works with narrower permissions.
 */
async function readReleaseText(repo) {
  let apiError = '';
  try {
    const stdout = await gh([
      'api',
      `repos/${repo}/releases?per_page=100`,
      '--paginate',
      '--jq',
      '.[] | [.tag_name, .name, .body] | @tsv'
    ]);
    return { ok: true, text: stdout, route: 'gh api repos/:owner/:repo/releases --paginate' };
  } catch (error) {
    apiError = error instanceof Error ? error.message : String(error);
  }

  // Fallback: enumerate, then read each body. One call per release, but it works
  // where the bulk API call is refused.
  let listed = '';
  try {
    listed = await gh(['release', 'list', '--repo', repo, '--limit', String(MAX_RELEASES), '--json', 'tagName,name']);
  } catch (error) {
    return {
      ok: false,
      text: '',
      route: 'none',
      reason: `${apiError} / ${error instanceof Error ? error.message : String(error)}`
    };
  }
  let rows = [];
  try {
    rows = JSON.parse(listed);
  } catch (error) {
    return { ok: false, text: '', route: 'none', reason: error instanceof Error ? error.message : String(error) };
  }
  const chunks = [];
  const unreadable = [];
  for (const row of rows) {
    chunks.push(String(row.name ?? ''));
    chunks.push(String(row.tagName ?? ''));
    try {
      const body = await gh(['release', 'view', String(row.tagName), '--repo', repo, '--json', 'body', '--jq', '.body']);
      chunks.push(body);
    } catch {
      // A body that cannot be read is reported rather than guessed at, because
      // the cost of missing one is a code name spent twice.
      unreadable.push(String(row.tagName ?? ''));
    }
  }
  return {
    ok: true,
    text: chunks.join('\n'),
    route: 'gh release list + gh release view',
    unreadable
  };
}

/**
 * Extracts the dishes already spent.
 *
 * Two signals, because release notes have carried both forms: the catalogue
 * identifier (`hk-dish-0001`), which is exact, and the dish's English name,
 * which is what a human reads. Matching both means an older release that only
 * printed the name still counts as having spent that dish.
 */
function spentFrom(text, dishes) {
  const ids = new Set();
  for (const match of text.matchAll(/hk-dish-\d{4,}/gi)) ids.add(match[0].toLowerCase());

  const haystack = text.toLowerCase();
  const names = new Set();
  for (const dish of dishes) {
    const name = dish.nameEn.toLowerCase();
    // Bounded by a non-letter on each side so "Har Gow" does not swallow
    // "Scallop Har Gow" and vice versa.
    if (name.length >= 4 && new RegExp(`(^|[^a-z])${escapeRegExp(name)}([^a-z]|$)`).test(haystack)) {
      names.add(dish.id);
    }
    // The Chinese name needs its own boundary, and it is not a word boundary:
    // 蝦餃 sits inside 帶子蝦餃, so a plain substring test would spend the
    // shorter name every time the longer one is mentioned. Requiring a
    // non-ideograph on each side keeps the two apart.
    if (
      dish.nameZhHant &&
      new RegExp(`(?<![\\u3400-\\u9FFF])${escapeRegExp(dish.nameZhHant)}(?![\\u3400-\\u9FFF])`).test(text)
    ) {
      names.add(dish.id);
    }
  }
  return { ids, names };
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/* ------------------------------------------------------------------ */
/* The catalogue                                                       */
/* ------------------------------------------------------------------ */

function normalizeDish(record) {
  const id = String(record?.id ?? '');
  const slug = String(record?.slug ?? '');
  const nameEn = String(record?.name?.en ?? '');
  const nameZhHant = String(record?.name?.zhHant ?? '');
  const path = String(record?.image?.path ?? '');
  if (!id || !nameEn || !nameZhHant || !path) return null;
  return {
    id,
    slug,
    nameEn,
    nameZhHant,
    assetFileName: path.replace(/^.*\//, ''),
    number: Number.parseInt(id.replace(/^\D+/, ''), 10) || 0
  };
}

async function readLiveCatalogue() {
  const response = await fetch(CATALOGUE_INDEX_URL, { redirect: 'follow' });
  if (!response.ok) throw new Error(`The catalogue index answered ${response.status} ${response.statusText}.`);
  const parsed = await response.json();
  const dishes = [];
  for (const record of Array.isArray(parsed?.dishes) ? parsed.dishes : []) {
    const dish = normalizeDish(record);
    if (dish) dishes.push(dish);
  }
  dishes.sort((a, b) => a.number - b.number || a.id.localeCompare(b.id));
  return { dishes, source: CATALOGUE_INDEX_URL, total: Number(parsed?.total) || dishes.length };
}

/**
 * The bundled snapshot, read out of the application's own module.
 *
 * This is the offline route and the fallback. It is a genuine subset of the
 * catalogue rather than a second authority, and the rows are parsed out of the
 * TypeScript source rather than duplicated here, so the two can never drift.
 */
async function readSnapshotCatalogue() {
  const source = await readFile(SNAPSHOT_FILE, 'utf8');
  const dishes = [];
  const row = /\bd\(\s*'((?:[^'\\]|\\.)*)'\s*,\s*'((?:[^'\\]|\\.)*)'\s*,\s*'((?:[^'\\]|\\.)*)'\s*,\s*'((?:[^'\\]|\\.)*)'\s*,\s*'((?:[^'\\]|\\.)*)'\s*,\s*'((?:[^'\\]|\\.)*)'\s*,\s*'((?:[^'\\]|\\.)*)'/g;
  for (const match of source.matchAll(row)) {
    const unescape = (value) => value.replace(/\\(['\\])/g, '$1');
    const id = unescape(match[1]);
    dishes.push({
      id,
      slug: unescape(match[2]),
      nameEn: unescape(match[3]),
      nameZhHant: unescape(match[4]),
      assetFileName: unescape(match[7]),
      releaseTag: unescape(match[6]),
      number: Number.parseInt(id.replace(/^\D+/, ''), 10) || 0
    });
  }
  dishes.sort((a, b) => a.number - b.number || a.id.localeCompare(b.id));
  return { dishes, source: 'app/src/renderer/core/dimsum.ts (bundled snapshot)', total: dishes.length };
}

/**
 * Lists the catalogue's published photo releases.
 *
 * Releases, not assets: there are three release records today and several
 * thousand assets inside them, and only the release tags are needed to build a
 * download URL.
 */
async function catalogueReleaseTags() {
  try {
    const stdout = await gh([
      'release',
      'list',
      '--repo',
      CATALOGUE_REPO,
      '--limit',
      '200',
      '--json',
      'tagName',
      '--jq',
      '.[].tagName'
    ]);
    const tags = stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => /^catalog-v1/.test(line));
    if (tags.length > 0) {
      // Oldest volume first, so the low dish numbers are probed against the
      // release that actually holds them on the first try.
      tags.sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
      return tags;
    }
  } catch {
    // The known volumes below are the documented fallback.
  }
  return ['catalog-v1', 'catalog-v1-part-002', 'catalog-v1-part-003'];
}

function downloadUrl(tag, assetFileName) {
  return `${ASSET_BASE_URL}/${tag}/${encodeURIComponent(assetFileName)}`;
}

/**
 * Confirms one asset is published.
 *
 * A HEAD with redirects left unfollowed is the cheapest possible proof: GitHub
 * answers 302 (handing off to its signed download host) when the asset exists
 * and 404 when it does not, and no bytes of the picture are transferred either
 * way.
 */
async function assetExists(url) {
  try {
    const response = await fetch(url, { method: 'HEAD', redirect: 'manual' });
    if (response.status >= 300 && response.status < 400) return true;
    return response.status === 200;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(
      [
        'Picks the next unused dim sum code name for a release.',
        '',
        'Usage: node scripts/pick-dim-sum-codename.mjs [--repo owner/name] [--offline] [--pretty]',
        '',
        '  --repo owner/name  Read prior releases from this repository (default: the current one).',
        '  --offline          Use the bundled metadata snapshot instead of the public catalogue index.',
        '  --pretty           Indent the JSON.',
        '',
        'Exit 0 prints the resolved code name. Exit 3 means no code name could be',
        'resolved: publish the release without one rather than blocking it.',
        ''
      ].join('\n')
    );
    return;
  }

  let catalogue;
  const notes = [];
  if (options.offline) {
    catalogue = await readSnapshotCatalogue();
  } else {
    try {
      catalogue = await readLiveCatalogue();
    } catch (error) {
      notes.push(`The public catalogue index was unreachable (${error.message}); the bundled snapshot was used.`);
      catalogue = await readSnapshotCatalogue();
    }
  }

  if (catalogue.dishes.length === 0) {
    emit({ ok: false, reason: 'No dishes could be read from the catalogue.', notes }, options.pretty, 3);
    return;
  }

  let repo = '';
  let releaseText = '';
  let priorReleasesRead = false;
  let releaseRoute = 'none';
  try {
    repo = await resolveRepo(options.repo);
    const read = await readReleaseText(repo);
    releaseText = read.text;
    priorReleasesRead = read.ok;
    releaseRoute = read.route;
    if (!read.ok) {
      notes.push(
        `Prior releases could not be read (${read.reason}); every dish is treated as unused, so a code name may repeat.`
      );
    } else if (read.unreadable && read.unreadable.length > 0) {
      notes.push(
        `${read.unreadable.length} release bodies could not be read (${read.unreadable.join(', ')}); a code name used only in one of those would repeat.`
      );
    }
  } catch (error) {
    notes.push(
      `The repository could not be resolved (${error instanceof Error ? error.message : String(error)}); every dish is treated as unused, so a code name may repeat.`
    );
  }

  const spent = spentFrom(releaseText, catalogue.dishes);
  const usedIds = new Set([...spent.ids, ...spent.names]);

  const tags = await catalogueReleaseTags();
  const probed = [];

  for (const dish of catalogue.dishes) {
    if (usedIds.has(dish.id.toLowerCase()) || usedIds.has(dish.id)) continue;
    if (probed.length >= MAX_PROBES) break;

    // The snapshot already knows which volume holds its dishes; the live index
    // does not, so the volumes are tried in order and the first hit wins.
    const candidateTags = dish.releaseTag ? [dish.releaseTag, ...tags.filter((t) => t !== dish.releaseTag)] : tags;

    for (const tag of candidateTags) {
      const url = downloadUrl(tag, dish.assetFileName);
      probed.push({ id: dish.id, tag });
      if (await assetExists(url)) {
        emit(
          {
            ok: true,
            id: dish.id,
            slug: dish.slug,
            nameEn: dish.nameEn,
            nameZhHant: dish.nameZhHant,
            codeName: `${dish.nameEn} · ${dish.nameZhHant}`,
            assetFileName: dish.assetFileName,
            releaseTag: tag,
            downloadUrl: url,
            catalogueRepository: `https://github.com/${CATALOGUE_REPO}`,
            catalogueSource: catalogue.source,
            catalogueTotal: catalogue.total,
            repository: repo,
            priorReleasesRead,
            priorReleaseRoute: releaseRoute,
            usedCount: usedIds.size,
            remainingApproximate: Math.max(catalogue.dishes.length - usedIds.size - 1, 0),
            probes: probed.length,
            notes
          },
          options.pretty,
          0
        );
        return;
      }
      if (probed.length >= MAX_PROBES) break;
    }
  }

  emit(
    {
      ok: false,
      reason:
        usedIds.size >= catalogue.dishes.length
          ? 'Every dish in the catalogue has already been used as a code name for this repository.'
          : 'No unused dish with a published photograph could be confirmed within the probe budget.',
      catalogueSource: catalogue.source,
      catalogueTotal: catalogue.total,
      repository: repo,
      priorReleasesRead,
      priorReleaseRoute: releaseRoute,
      usedCount: usedIds.size,
      probes: probed.length,
      notes
    },
    options.pretty,
    3
  );
}

main().catch((error) => {
  emit({ ok: false, reason: error instanceof Error ? error.message : String(error) }, false, 3);
});
