#!/usr/bin/env node
/**
 * Fails the build rather than shipping a changelog entry that links nowhere.
 *
 * A WRONG commit reference is worse than none: it sends a reader somewhere
 * confidently irrelevant, and nothing in the interface can tell them the link
 * was never checked. So every commit id in the bundle is resolved against this
 * repository before the application is built, and a single unresolvable id
 * stops the build with the exact id, the exact release and the exact entry that
 * carries it.
 *
 * It also refuses the quieter ways a bundle can lie: a short reference that is
 * not a prefix of its full id, a commit-url template that is not https or does
 * not contain `{sha}`, a duplicate version, a date that does not parse, an entry
 * that claims to summarize commits it does not list, and a body marked truncated
 * that is not at the stated ceiling.
 *
 * There is no skip switch. If git is unavailable the validator cannot prove
 * anything, so it fails closed and says so; that is the whole point of running
 * it before a build rather than after a release.
 *
 * Usage: node scripts/validate-changelog.mjs
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseModule } from './generate-changelog.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(HERE, '..');
const BUNDLE = join(APP_DIR, 'src', 'renderer', 'features', 'changelog', 'generated.ts');

const SHA = /^[0-9a-f]{40}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

class ValidationError extends Error {}

function fail(message) {
  throw new ValidationError(message);
}

/* ------------------------------------------------------------------ */
/* Repository access                                                   */
/* ------------------------------------------------------------------ */

function repositoryRoot() {
  const probe = spawnSync('git', ['rev-parse', '--show-toplevel'], {
    cwd: APP_DIR,
    encoding: 'utf8',
    windowsHide: true
  });
  if (probe.error || probe.status !== 0) {
    fail(
      'git could not be run from this directory, so no commit reference in the changelog can be verified.\n' +
        'The changelog links to real commits and this check exists to prove they resolve; it fails closed rather\n' +
        'than letting an unverifiable link ship. Build from a git checkout with git on PATH.'
    );
  }
  return probe.stdout.trim();
}

/**
 * Resolves every id in one `git cat-file --batch-check` call.
 *
 * One call for thousands of ids rather than one call each: a per-id spawn on
 * Windows turns a sub-second check into minutes, and a check slow enough to be
 * skipped is a check that stops running.
 */
function resolveCommits(root, ids) {
  if (ids.length === 0) return new Map();
  const input = ids.map((id) => `${id}^{commit}`).join('\n') + '\n';
  const result = spawnSync('git', ['cat-file', '--batch-check'], {
    cwd: root,
    input,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true
  });
  if (result.error) fail(`git cat-file could not be run: ${result.error.message}`);

  const lines = result.stdout.split('\n').filter((line) => line.trim() !== '');
  if (lines.length !== ids.length) {
    fail(
      `git cat-file answered ${lines.length} of ${ids.length} commit ids. The check cannot prove the rest resolve, so it fails closed.`
    );
  }

  const resolved = new Map();
  ids.forEach((id, index) => {
    const line = lines[index];
    // "<sha> commit <size>" on success; "<input> missing" otherwise.
    const parts = line.trim().split(/\s+/);
    resolved.set(id, parts.length >= 2 && parts[1] === 'commit');
  });
  return resolved;
}

/* ------------------------------------------------------------------ */
/* Structural checks                                                   */
/* ------------------------------------------------------------------ */

function collectReferences(data) {
  /** @type {Array<{ id: string; where: string }>} */
  const references = [];
  const seenVersions = new Set();

  if (data.schemaVersion !== 1) {
    fail(`The bundle declares schema version ${JSON.stringify(data.schemaVersion)}; this validator understands 1.`);
  }
  if (!Array.isArray(data.releases)) fail('The bundle has no releases array.');
  if (typeof data.headCommit !== 'string' || !SHA.test(data.headCommit)) {
    fail(`The bundle's headCommit is not a 40-character commit id: ${JSON.stringify(data.headCommit)}`);
  }
  references.push({ id: data.headCommit, where: 'headCommit' });

  const forge = data.forge ?? {};
  if (forge.commitUrlTemplate !== null) {
    if (typeof forge.commitUrlTemplate !== 'string') {
      fail('forge.commitUrlTemplate must be a string or null.');
    }
    if (!forge.commitUrlTemplate.startsWith('https://')) {
      fail(
        `forge.commitUrlTemplate must be https so a commit link cannot be read over plain http: ${forge.commitUrlTemplate}`
      );
    }
    if (!forge.commitUrlTemplate.includes('{sha}')) {
      fail(`forge.commitUrlTemplate has no {sha} placeholder, so every entry would link to the same page: ${forge.commitUrlTemplate}`);
    }
    if (typeof forge.webUrl !== 'string' || !forge.webUrl.startsWith('https://')) {
      fail('forge.webUrl must be an https URL whenever a commit template is present.');
    }
  }
  if (typeof forge.remote === 'string' && /@/.test(forge.remote)) {
    fail(`forge.remote still carries credentials or a user component: ${forge.remote}`);
  }

  for (const release of data.releases) {
    const label = `release "${release.version}"`;
    if (typeof release.version !== 'string' || release.version.trim() === '') {
      fail('A release has no version.');
    }
    if (seenVersions.has(release.version)) {
      fail(`Two releases claim the version "${release.version}". A version identifies one build and must be unique.`);
    }
    seenVersions.add(release.version);

    if (!ISO_DATE.test(release.date)) fail(`${label} has the date ${JSON.stringify(release.date)}, which is not YYYY-MM-DD.`);
    if (Number.isNaN(Date.parse(release.timestamp))) {
      fail(`${label} has the timestamp ${JSON.stringify(release.timestamp)}, which does not parse.`);
    }
    if (!release.timestamp.startsWith(release.date)) {
      fail(`${label} has date ${release.date} and timestamp ${release.timestamp}, which disagree.`);
    }
    if (release.released !== true && release.released !== false) {
      fail(`${label} does not say whether it is released.`);
    }
    if (release.released && (typeof release.tag !== 'string' || release.tag === '')) {
      fail(`${label} is marked released but carries no tag.`);
    }
    if (!release.released && release.tag !== null) {
      fail(`${label} is not released but carries the tag ${JSON.stringify(release.tag)}.`);
    }
    if (!SHA.test(release.commit)) fail(`${label} has a commit that is not a 40-character id: ${release.commit}`);
    if (!release.commit.startsWith(release.shortCommit)) {
      fail(`${label} has the short reference ${release.shortCommit}, which is not a prefix of ${release.commit}.`);
    }
    references.push({ id: release.commit, where: `${label} (the tagged commit)` });

    if (!Array.isArray(release.entries)) fail(`${label} has no entries array.`);
    if (typeof release.commitCount !== 'number' || release.commitCount < 0) {
      fail(`${label} has no honest commit count.`);
    }
    if (release.entries.length > release.commitCount) {
      fail(
        `${label} lists ${release.entries.length} entries from ${release.commitCount} commits. Entries fold commits together; they can never outnumber them.`
      );
    }

    const seenEntryIds = new Set();
    for (const entry of release.entries) {
      const at = `${label}, entry "${entry.id}"`;
      if (typeof entry.id !== 'string' || entry.id === '') fail(`${label} has an entry with no id.`);
      if (seenEntryIds.has(entry.id)) fail(`${label} has two entries with the id "${entry.id}".`);
      seenEntryIds.add(entry.id);

      if (typeof entry.summary !== 'string' || entry.summary.trim() === '') {
        fail(`${at} has an empty summary. A change with nothing to say about it is not a change.`);
      }
      if (!SHA.test(entry.commit)) fail(`${at} has a commit that is not a 40-character id: ${entry.commit}`);
      if (!entry.commit.startsWith(entry.shortCommit)) {
        fail(`${at} shows ${entry.shortCommit}, which is not a prefix of ${entry.commit}.`);
      }
      if (Number.isNaN(Date.parse(entry.authoredAt))) {
        fail(`${at} has the authored date ${JSON.stringify(entry.authoredAt)}, which does not parse.`);
      }
      if (!Array.isArray(entry.commits) || entry.commits.length === 0) {
        fail(`${at} lists no commits.`);
      }
      if (!entry.commits.includes(entry.commit)) {
        fail(`${at} links ${entry.shortCommit}, which is not one of the commits it stands for.`);
      }
      if (entry.commits[entry.commits.length - 1] !== entry.commit) {
        fail(
          `${at} links ${entry.shortCommit}, which is not the last commit in its group. A summary entry links the commit that COMPLETED the change.`
        );
      }
      if (entry.summarizes !== null) {
        if (typeof entry.summarizes !== 'number' || entry.summarizes < 2) {
          fail(`${at} claims to summarize ${entry.summarizes} commits; a summary stands for two or more.`);
        }
        if (entry.summarizes !== entry.commits.length) {
          fail(
            `${at} says it summarizes ${entry.summarizes} commits but lists ${entry.commits.length}. The viewer would tell the reader something untrue.`
          );
        }
      } else if (entry.commits.length !== 1) {
        fail(
          `${at} lists ${entry.commits.length} commits but is not marked as a summary, so the viewer would present it as a single change.`
        );
      }
      if (entry.bodyTruncated === true && entry.body.length !== data.bodyLimit) {
        fail(
          `${at} is marked truncated but its body is ${entry.body.length} characters against a stated ceiling of ${data.bodyLimit}.`
        );
      }
      if (entry.bodyTruncated === false && typeof data.bodyLimit === 'number' && entry.body.length > data.bodyLimit) {
        fail(`${at} exceeds the stated body ceiling of ${data.bodyLimit} without being marked truncated.`);
      }

      for (const sha of entry.commits) {
        if (!SHA.test(sha)) fail(`${at} lists ${JSON.stringify(sha)}, which is not a 40-character commit id.`);
        references.push({ id: sha, where: `${at} (${entry.summary})` });
      }
    }
  }

  return references;
}

/* ------------------------------------------------------------------ */
/* Entry point                                                         */
/* ------------------------------------------------------------------ */

function main() {
  if (!existsSync(BUNDLE)) {
    fail(
      `The changelog bundle is missing at ${BUNDLE}.\n` +
        'Generate it first: node scripts/generate-changelog.mjs'
    );
  }

  const data = parseModule(readFileSync(BUNDLE, 'utf8'));
  const references = collectReferences(data);

  const root = repositoryRoot();
  const unique = [...new Set(references.map((reference) => reference.id))];
  const resolved = resolveCommits(root, unique);

  const dead = references.filter((reference) => resolved.get(reference.id) !== true);
  if (dead.length > 0) {
    const shown = dead.slice(0, 20);
    const lines = shown.map((reference) => `  ${reference.id}  ${reference.where}`);
    if (dead.length > shown.length) lines.push(`  … and ${dead.length - shown.length} more`);
    fail(
      `${dead.length} commit reference${dead.length === 1 ? '' : 's'} in the changelog do not resolve in this repository:\n` +
        `${lines.join('\n')}\n\n` +
        'A wrong commit link is worse than no link, so the build stops here. Either fetch the missing history\n' +
        '(a shallow clone will not contain it) or regenerate the bundle: node scripts/generate-changelog.mjs'
    );
  }

  const entries = data.releases.reduce((total, release) => total + release.entries.length, 0);
  const emptyReleases = data.releases.filter((release) => release.entries.length === 0).length;
  console.log(
    `Changelog validated: ${data.releases.length} releases, ${entries} entries, ${unique.length} distinct commit ids all resolve.\n` +
      `  releases with no recorded changes: ${emptyReleases} (each says so in the viewer)\n` +
      `  commit links: ${data.forge.commitUrlTemplate ?? 'no recognised forge, so commit ids render as plain text'}`
  );
}

try {
  main();
} catch (error) {
  if (error instanceof ValidationError) {
    console.error(`Changelog validation failed.\n\n${error.message}`);
  } else {
    console.error(`Changelog validation failed unexpectedly: ${error instanceof Error ? error.stack : String(error)}`);
  }
  process.exitCode = 1;
}

export { collectReferences, BUNDLE };
