#!/usr/bin/env node
/**
 * Builds the bundled changelog from the repository's REAL commit history.
 *
 * Nothing here invents a version, a date, a summary or a fix. Every release is a
 * git tag, every date is that tag's own recorded date, every summary is a commit
 * subject copied verbatim, and every commit id comes from `git rev-list`. A tag
 * whose range contains no commits is emitted with an empty entry list so the
 * viewer can say plainly that the version has no recorded changes, rather than
 * being quietly dropped or padded with something plausible.
 *
 * Output is ONE file — `src/renderer/features/changelog/generated.ts` — holding
 * a JSON literal between two markers. The viewer imports it as a typed module
 * and `validate-changelog.mjs` parses the same literal back out, so there is a
 * single source of truth and the two cannot drift apart.
 *
 * Usage:
 *   node scripts/generate-changelog.mjs           write the bundle
 *   node scripts/generate-changelog.mjs --check   fail if the bundle is stale
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(HERE, '..');
const OUTPUT = join(APP_DIR, 'src', 'renderer', 'features', 'changelog', 'generated.ts');

export const BEGIN_MARKER = '/* changelog-data:begin */';
export const END_MARKER = '/* changelog-data:end */';
const ASSIGNMENT = 'export const CHANGELOG_DATA: ChangelogData =';

/** Per-entry ceiling on a commit body. Stated in the bundle so it is auditable. */
const BODY_LIMIT = 4000;

/* ------------------------------------------------------------------ */
/* git                                                                 */
/* ------------------------------------------------------------------ */

function git(args, cwd) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    windowsHide: true
  });
}

function gitOrNull(args, cwd) {
  try {
    return git(args, cwd);
  } catch {
    return null;
  }
}

function repositoryRoot() {
  const root = gitOrNull(['rev-parse', '--show-toplevel'], APP_DIR);
  if (root === null) {
    throw new Error(
      'git is not available, or this directory is not inside a git repository. ' +
        'The changelog is built from the real commit history and cannot be produced without it.'
    );
  }
  return root.trim();
}

/* ------------------------------------------------------------------ */
/* Forge resolution                                                    */
/* ------------------------------------------------------------------ */

/**
 * Turns a git remote into a browsable commit URL template.
 *
 * A remote that is not a recognisable forge produces a null template. That is a
 * real, reported state: the viewer then shows the commit id as plain text and
 * says why, which is better than a link that resolves to nothing.
 */
export function resolveForge(remoteUrl) {
  const empty = {
    kind: 'unknown',
    owner: '',
    repository: '',
    webUrl: null,
    commitUrlTemplate: null,
    remote: null
  };
  if (typeof remoteUrl !== 'string' || remoteUrl.trim() === '') return empty;

  const raw = remoteUrl.trim();
  let host = '';
  let path = '';

  const scpLike = /^(?:([^@/]+)@)?([^:/]+):(.+)$/.exec(raw);
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) {
    let parsed;
    try {
      parsed = new URL(raw);
    } catch {
      return empty;
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:' && parsed.protocol !== 'ssh:') {
      return empty;
    }
    host = parsed.hostname;
    path = parsed.pathname;
  } else if (scpLike) {
    host = scpLike[2];
    path = scpLike[3];
  } else {
    return empty;
  }

  // Credentials never travel into a generated artefact.
  const segments = path
    .replace(/\.git$/i, '')
    .split('/')
    .filter((part) => part !== '');
  if (segments.length < 2 || host === '') return empty;

  const repository = segments[segments.length - 1];
  const owner = segments.slice(0, -1).join('/');
  const sanitizedRemote = `${host}/${owner}/${repository}`;

  const lowerHost = host.toLowerCase();
  let kind = 'unknown';
  let commitPath = null;
  if (lowerHost === 'github.com' || lowerHost.endsWith('.github.com')) {
    kind = 'github';
    commitPath = 'commit';
  } else if (lowerHost === 'gitlab.com' || lowerHost.endsWith('.gitlab.com')) {
    kind = 'gitlab';
    commitPath = '-/commit';
  } else if (lowerHost === 'bitbucket.org') {
    kind = 'bitbucket';
    commitPath = 'commits';
  } else if (lowerHost.includes('gitea') || lowerHost.includes('codeberg')) {
    kind = lowerHost.includes('codeberg') ? 'codeberg' : 'gitea';
    commitPath = 'commit';
  }

  if (commitPath === null) {
    return { kind, owner, repository, webUrl: null, commitUrlTemplate: null, remote: sanitizedRemote };
  }

  const webUrl = `https://${host}/${owner}/${repository}`;
  return {
    kind,
    owner,
    repository,
    webUrl,
    commitUrlTemplate: `${webUrl}/${commitPath}/{sha}`,
    remote: sanitizedRemote
  };
}

/* ------------------------------------------------------------------ */
/* Categorisation                                                      */
/* ------------------------------------------------------------------ */

const CONVENTIONAL = /^([a-z]+)(\([^)]*\))?(!)?:\s*/i;

const CONVENTIONAL_MAP = {
  feat: 'added',
  feature: 'added',
  add: 'added',
  fix: 'fixed',
  bugfix: 'fixed',
  hotfix: 'fixed',
  perf: 'performance',
  docs: 'documentation',
  doc: 'documentation',
  refactor: 'maintenance',
  style: 'maintenance',
  chore: 'maintenance',
  build: 'maintenance',
  ci: 'maintenance',
  test: 'maintenance',
  deps: 'maintenance',
  revert: 'reverted',
  security: 'security'
};

/**
 * Decides what a commit did, from its own words.
 *
 * The heuristics are ordered from most explicit to least, and the last rung is
 * `other` rather than a guess: a commit whose subject says nothing recognisable
 * is filed as `other` and shown in full, so the reader judges it instead of the
 * generator pretending to.
 */
const VERB_RULES = [
  [/^(add|adds|added|introduce\w*|implement\w*|create\w*|ship\w*|bring\w*|expose\w*|enable\w*|support\w*|allow\w*|publish\w*)\b/i, 'added'],
  [/^(fix\w*|repair\w*|correct\w*|resolve\w*|prevent\w*|avoid\w*|restore\w*|unbreak\w*)\b/i, 'fixed'],
  [/^(remove\w*|delete\w*|drop\w*|retire\w*|purge\w*|strip\w*|ignore\w*|stop\w* tracking)\b/i, 'removed'],
  [/^(secure\w*|harden\w*|sanitiz\w*|authenticat\w*|authoriz\w*)\b/i, 'security'],
  [/^(speed\w*|optimi[sz]\w*|accelerat\w*|cache\w*|smooth\w*)\b/i, 'performance'],
  [/^(document\w*|docs?\b|readme\b|comment\w*)/i, 'documentation'],
  [
    /^(bump\w*|upgrade\w*|vendor\w*|lint\w*|format\w*|reformat\w*|tidy\b|clean\w* up|test\w*|ignore\w*)\b/i,
    'maintenance'
  ],
  [
    /^(change\w*|update\w*|switch\w*|rename\w*|move\w*|rework\w*|refactor\w*|replace\w*|port\w*|show\w*|explain\w*|log\w*|handle\w*|improve\w*|ensure\w*|set\b|raise\w*|lower\w*|make\b|keep\b|use\b|register\b|wire\b|teach\b|let\b|modernize\b|modernise\b)\b/i,
    'changed'
  ]
];

function verbCategory(text) {
  for (const [pattern, category] of VERB_RULES) {
    if (pattern.test(text)) return category;
  }
  return null;
}

/**
 * Decides what a commit did, from its own words.
 *
 * The heuristics run from most explicit to least, and the last rung is `other`
 * rather than a guess: a commit whose subject says nothing recognisable is filed
 * as `other` and shown in full, so the reader judges it instead of the generator
 * pretending to.
 *
 * A `Scope: what it did` subject is very common in this repository's history, so
 * when the leading words match no verb the part after the first colon is tried
 * as well. That reads the sentence the author actually wrote rather than the
 * component name they prefixed it with.
 */
export function categorize(subject, body) {
  const text = `${subject}\n${body}`;
  const breaking = /(^|\n)BREAKING[ -]CHANGE/i.test(text) || /^[a-z]+(\([^)]*\))?!:/i.test(subject);

  if (/^merge\b/i.test(subject)) return { category: 'merged', breaking };
  if (/^revert\b/i.test(subject)) return { category: 'reverted', breaking };

  if (/\b(security|vulnerabilit\w*|vulnerable|exploit|CVE-\d{4}-\d+)\b/i.test(text)) {
    return { category: 'security', breaking };
  }

  const conventional = CONVENTIONAL.exec(subject);
  if (conventional) {
    const mapped = CONVENTIONAL_MAP[conventional[1].toLowerCase()];
    if (mapped) return { category: mapped, breaking };
  }

  const direct = verbCategory(subject);
  if (direct) return { category: direct, breaking };

  const colon = subject.indexOf(':');
  if (colon > 0 && colon < 40) {
    const remainder = subject.slice(colon + 1).trim();
    const scoped = verbCategory(remainder);
    if (scoped) return { category: scoped, breaking };
  }

  return { category: 'other', breaking };
}

/* ------------------------------------------------------------------ */
/* Collection                                                          */
/* ------------------------------------------------------------------ */

const UNIT = String.fromCharCode(31);
const RECORD = String.fromCharCode(30);

function readCommits(root) {
  const format = ['%H', '%aI', '%an', '%s', '%b'].join('%x1f') + '%x1e';
  const raw = git(['log', '--all', '--no-color', `--format=${format}`], root);
  const commits = new Map();
  for (const chunk of raw.split(RECORD)) {
    const record = chunk.replace(/^\r?\n/, '');
    if (record.trim() === '') continue;
    const [sha, authoredAt, author, subject, ...rest] = record.split(UNIT);
    if (!sha || !/^[0-9a-f]{40}$/.test(sha)) continue;
    commits.set(sha, {
      sha,
      authoredAt,
      author,
      subject: (subject ?? '').trim(),
      body: rest.join(UNIT).trim()
    });
  }
  return commits;
}

function readTags(root) {
  const format = [
    '%(refname:short)',
    '%(creatordate:iso-strict)',
    '%(objectname)',
    '%(*objectname)'
  ].join('%09');
  const raw = gitOrNull(['tag', '--sort=creatordate', `--format=${format}`], root) ?? '';
  const tags = [];
  for (const line of raw.split('\n')) {
    if (line.trim() === '') continue;
    const [name, created, objectName, dereferenced] = line.split('\t');
    const commit = (dereferenced ?? '').trim() || (objectName ?? '').trim();
    if (!name || !/^[0-9a-f]{40}$/.test(commit)) continue;
    tags.push({ name, created: created.trim(), commit });
  }
  return tags;
}

function rangeCommits(root, from, to) {
  const spec = from ? `${from}..${to}` : to;
  const raw = gitOrNull(['rev-list', '--reverse', spec], root);
  if (raw === null) return [];
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^[0-9a-f]{40}$/.test(line));
}

/**
 * Folds commits that carried the same subject into one entry.
 *
 * The entry links the commit that COMPLETED the change — the last one in the
 * range — and records how many commits it stands for, so the viewer can say it
 * is a summary rather than implying that one link is the whole story.
 */
function toEntries(shas, commits, tagName) {
  const groups = new Map();
  const order = [];
  for (const sha of shas) {
    const commit = commits.get(sha);
    if (!commit) continue;
    const key = commit.subject.toLowerCase().replace(/\s+/g, ' ').trim();
    if (!groups.has(key)) {
      groups.set(key, []);
      order.push(key);
    }
    groups.get(key).push(commit);
  }

  const entries = [];
  for (const key of order) {
    const group = groups.get(key);
    const completing = group[group.length - 1];
    const body = completing.body;
    const truncated = body.length > BODY_LIMIT;
    const { category, breaking } = categorize(completing.subject, body);
    entries.push({
      id: `${tagName}#${entries.length}`,
      category,
      breaking,
      summary: completing.subject === '' ? '(this commit has no subject line)' : completing.subject,
      body: truncated ? body.slice(0, BODY_LIMIT) : body,
      bodyTruncated: truncated,
      commit: completing.sha,
      shortCommit: completing.sha.slice(0, 7),
      authoredAt: completing.authoredAt,
      author: completing.author,
      summarizes: group.length > 1 ? group.length : null,
      commits: group.map((commit) => commit.sha)
    });
  }
  return entries;
}

export function build() {
  const root = repositoryRoot();
  const commits = readCommits(root);
  const tags = readTags(root);
  const head = (gitOrNull(['rev-parse', 'HEAD'], root) ?? '').trim();
  const remote =
    (gitOrNull(['config', '--get', 'remote.origin.url'], root) ?? '').trim() ||
    (gitOrNull(['remote'], root) ?? '')
      .split('\n')
      .map((name) => name.trim())
      .filter(Boolean)
      .map((name) => (gitOrNull(['config', '--get', `remote.${name}.url`], root) ?? '').trim())
      .find((url) => url !== '') ||
    '';

  const releases = [];
  let examined = 0;

  for (let index = 0; index < tags.length; index += 1) {
    const tag = tags[index];
    const previous = index > 0 ? tags[index - 1] : null;
    const shas = rangeCommits(root, previous ? previous.commit : null, tag.commit);
    examined += shas.length;
    releases.push({
      version: tag.name,
      tag: tag.name,
      released: true,
      date: tag.created.slice(0, 10),
      timestamp: tag.created,
      commit: tag.commit,
      shortCommit: tag.commit.slice(0, 7),
      previousTag: previous ? previous.name : null,
      entries: toEntries(shas, commits, tag.name),
      commitCount: shas.length
    });
  }

  if (head !== '') {
    const newest = tags.length > 0 ? tags[tags.length - 1] : null;
    const shas = rangeCommits(root, newest ? newest.commit : null, head);
    if (shas.length > 0) {
      examined += shas.length;
      const headCommit = commits.get(head);
      releases.push({
        version: 'Unreleased',
        tag: null,
        released: false,
        date: (headCommit?.authoredAt ?? new Date().toISOString()).slice(0, 10),
        timestamp: headCommit?.authoredAt ?? new Date().toISOString(),
        commit: head,
        shortCommit: head.slice(0, 7),
        previousTag: newest ? newest.name : null,
        entries: toEntries(shas, commits, 'unreleased'),
        commitCount: shas.length
      });
    }
  }

  releases.reverse();

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    generator: 'app/scripts/generate-changelog.mjs',
    command: 'node scripts/generate-changelog.mjs',
    forge: resolveForge(remote),
    headCommit: head,
    releases,
    commitsExamined: examined,
    bodyLimit: BODY_LIMIT
  };
}

/* ------------------------------------------------------------------ */
/* Emit                                                                */
/* ------------------------------------------------------------------ */

/**
 * `generatedAt` moves on every run, so a byte comparison would report every
 * bundle as stale. `--check` compares everything else.
 */
function withoutTimestamp(data) {
  const { generatedAt: _ignored, ...rest } = data;
  return rest;
}

/**
 * Serializes the bundle with one release per line.
 *
 * Compact JSON would put half a megabyte on a single line and make every
 * regeneration an unreviewable diff; two-space indentation would inflate the
 * same data by a quarter. One line per release keeps the diff readable — a new
 * tag adds one line — without paying for indentation on 1,300 entries.
 */
function renderData(data) {
  const parts = [];
  for (const [key, value] of Object.entries(data)) {
    if (key === 'releases' && Array.isArray(value)) {
      const rows = value.map((release) => `  ${JSON.stringify(release)}`).join(',\n');
      parts.push(`  "releases": [\n${rows}\n  ]`);
      continue;
    }
    parts.push(`  ${JSON.stringify(key)}: ${JSON.stringify(value)}`);
  }
  return `{\n${parts.join(',\n')}\n}`;
}

export function renderModule(data) {
  return [
    '/**',
    ' * GENERATED FILE — do not edit by hand.',
    ' *',
    ` * Written by ${data.generator} from the repository's real commit history.`,
    ` * Regenerate with: ${data.command}`,
    ' *',
    ' * Every commit id below is validated against the repository by',
    ' * app/scripts/validate-changelog.mjs before the application builds, so a',
    ' * reference that no longer resolves fails the build rather than shipping as',
    ' * a link that goes nowhere.',
    ' */',
    '',
    "import type { ChangelogData } from './types';",
    '',
    BEGIN_MARKER,
    `${ASSIGNMENT} ${renderData(data)};`,
    END_MARKER,
    ''
  ].join('\n');
}

/** Reads the JSON literal back out of a generated module. */
export function parseModule(source) {
  const begin = source.indexOf(BEGIN_MARKER);
  const end = source.indexOf(END_MARKER);
  if (begin === -1 || end === -1 || end < begin) {
    throw new Error(
      `The generated changelog module is missing its ${BEGIN_MARKER} / ${END_MARKER} markers. Regenerate it.`
    );
  }
  const between = source.slice(begin + BEGIN_MARKER.length, end).trim();
  if (!between.startsWith(ASSIGNMENT)) {
    throw new Error(`The generated changelog module does not begin with "${ASSIGNMENT}". Regenerate it.`);
  }
  const literal = between.slice(ASSIGNMENT.length).trim().replace(/;$/, '');
  return JSON.parse(literal);
}

function main() {
  const check = process.argv.includes('--check');
  const data = build();
  const next = renderModule(data);

  if (check) {
    if (!existsSync(OUTPUT)) {
      console.error(`The changelog bundle is missing. Run: ${data.command}`);
      process.exitCode = 1;
      return;
    }
    const current = parseModule(readFileSync(OUTPUT, 'utf8'));
    const same = JSON.stringify(withoutTimestamp(current)) === JSON.stringify(withoutTimestamp(data));
    if (!same) {
      console.error(`The changelog bundle is stale. Run: ${data.command}`);
      process.exitCode = 1;
      return;
    }
    console.log(
      `Changelog bundle is current: ${data.releases.length} releases, ${data.commitsExamined} commits examined.`
    );
    return;
  }

  mkdirSync(dirname(OUTPUT), { recursive: true });
  writeFileSync(OUTPUT, next, 'utf8');
  const released = data.releases.filter((release) => release.released).length;
  const empty = data.releases.filter((release) => release.entries.length === 0).length;
  console.log(
    `Wrote ${OUTPUT}\n` +
      `  releases: ${data.releases.length} (${released} tagged, ${data.releases.length - released} unreleased)\n` +
      `  commits examined: ${data.commitsExamined}\n` +
      `  releases with no recorded changes: ${empty}\n` +
      `  forge: ${data.forge.commitUrlTemplate ?? 'no recognised forge; commit ids will render as plain text'}`
  );
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

export { OUTPUT, BODY_LIMIT };
