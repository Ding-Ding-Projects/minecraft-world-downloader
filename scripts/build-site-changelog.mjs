#!/usr/bin/env node
/* ==================================================================
 * build-site-changelog.mjs
 *
 * Emits site/assets/changelog.js from the REAL commit history of this
 * repository. Nothing here is written by hand and nothing is invented:
 * every version is a tag that exists, every entry is a commit that
 * exists, and every date is the date git recorded.
 *
 * Node only. No dependencies, no network, no build step.
 *
 *   node scripts/build-site-changelog.mjs
 *   node scripts/build-site-changelog.mjs --check   (verify, write nothing)
 *
 * WHY THE VALIDATION STEP EXISTS
 * ------------------------------
 * The changelog viewer renders one commit link per entry. A wrong SHA
 * does not fail loudly -- it sends a reader to a page that confidently
 * shows something irrelevant, or to a 404 that reads as a broken site.
 * So every SHA collected here is checked back against the object
 * database with `git cat-file --batch-check` before anything is
 * written, and the generator exits non-zero rather than emitting a
 * dead link. Failing the build is cheap; a dead link in a published
 * changelog is not.
 *
 * WHAT IS DERIVED RATHER THAN RECORDED
 * ------------------------------------
 * Exactly one thing: the category ("Added", "Fixed", ...). Git does
 * not record a category, so it is derived from the commit subject by
 * the rules in CATEGORY_RULES below and the emitted file says so, so
 * a reader knows which column is a fact and which is a guess. The
 * subject, SHA, author, date, tag and version are all recorded values
 * and are copied through unchanged.
 * ================================================================== */

import { execFileSync } from 'node:child_process';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const OUT = join(REPO, 'site', 'assets', 'changelog.js');
const CHECK_ONLY = process.argv.includes('--check');

/* Field and record separators that cannot appear in a commit subject. */
const FS = '';
const RS = '';

function git(args, input) {
  return execFileSync('git', args, {
    cwd: REPO,
    input: input === undefined ? undefined : input,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024
  });
}

function fail(message) {
  process.stderr.write('build-site-changelog: ' + message + '\n');
  process.exit(1);
}

/* ---------------------------------------------------------------- *
 * 1. Where the commits live, so a link can be built for them.
 *
 * A link is only emitted when the remote is a form whose commit URL
 * is known. Anything else emits no base at all and the viewer shows
 * the SHA as plain copyable text, which is honest, rather than a
 * guessed URL, which is not.
 * ---------------------------------------------------------------- */
function remoteUrl() {
  try {
    return git(['config', '--get', 'remote.origin.url']).trim();
  } catch {
    return '';
  }
}

function commitBaseFor(url) {
  if (!url) return null;
  let m = url.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/i);
  if (m) return { host: 'github', web: `https://github.com/${m[1]}/${m[2]}`, commit: `https://github.com/${m[1]}/${m[2]}/commit/` };
  m = url.match(/^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/i);
  if (m) return { host: 'github', web: `https://github.com/${m[1]}/${m[2]}`, commit: `https://github.com/${m[1]}/${m[2]}/commit/` };
  m = url.match(/^https:\/\/gitlab\.com\/(.+?)(?:\.git)?\/?$/i);
  if (m) return { host: 'gitlab', web: `https://gitlab.com/${m[1]}`, commit: `https://gitlab.com/${m[1]}/-/commit/` };
  return null;
}

/* ---------------------------------------------------------------- *
 * 2. Category derivation.
 *
 * Ordered: the first rule that matches wins. Conventional-commit
 * prefixes first because they are a stated intent; the keyword rules
 * afterwards are a best reading of an ordinary English subject.
 * ---------------------------------------------------------------- */
const CATEGORIES = [
  'Added',
  'Changed',
  'Fixed',
  'Removed',
  'Security',
  'Performance',
  'Documentation',
  'Build and release',
  'Tests',
  'Reverted',
  'Other changes'
];

const CATEGORY_RULES = [
  { category: 'Reverted', test: /^revert[(:!\s]/i },
  { category: 'Added', test: /^feat[(:!\s]/i },
  { category: 'Fixed', test: /^fix[(:!\s]/i },
  { category: 'Documentation', test: /^docs?[(:!\s]/i },
  { category: 'Tests', test: /^test[s]?[(:!\s]/i },
  { category: 'Performance', test: /^perf[(:!\s]/i },
  { category: 'Changed', test: /^(refactor|style)[(:!\s]/i },
  { category: 'Build and release', test: /^(build|ci|chore|release|deps?|bump)[(:!\s]/i },
  { category: 'Security', test: /\b(security|vulnerab|CVE-\d|sanitiz|escap\w*\s+injection)\b/i },
  { category: 'Removed', test: /^(remove|delete|drop|retire|purge|strip|unvendor)\b/i },
  { category: 'Added', test: /^(add|introduce|create|implement|ship|vendor|bring|draw|author|register|wire)\b/i },
  { category: 'Fixed', test: /^(fix|repair|correct|resolve|stop|prevent|guard|restore|unbreak|patch)\b/i },
  { category: 'Documentation', test: /\b(readme|changelog|documentation|docs|handoff|roadmap)\b/i },
  { category: 'Build and release', test: /^(build|package|publish|tag|version|bump|workflow|installer|docker|gradle|maven|npm)\b/i },
  { category: 'Performance', test: /\b(performance|faster|speed up|optimi[sz]e|memory)\b/i },
  { category: 'Changed', test: /^(update|change|rename|move|refactor|improve|modernis|moderniz|switch|replace|rework|tidy|simplif|make|use|keep|let|turn|split|merge|reduce|widen|narrow|apply|adjust|align|convert|promote|separate|secure|commit)\b/i },
  { category: 'Changed', test: /.*/ }
];

function categorize(subject) {
  const s = String(subject);
  for (const rule of CATEGORY_RULES) {
    if (rule.test.test(s)) return rule.category === 'Changed' && rule.test.source === '.*' ? 'Other changes' : rule.category;
  }
  return 'Other changes';
}

/* Breaking change is a recorded fact when the author wrote it: the
   conventional `!` marker or a BREAKING CHANGE trailer. It is never
   guessed from the wording. */
function isBreaking(subject, body) {
  if (/^[a-z]+(\([^)]*\))?!:/i.test(subject)) return true;
  return /^BREAKING[ -]CHANGE:/im.test(body || '');
}

/* ---------------------------------------------------------------- *
 * 3. Authorship.
 *
 * Per surviving commit, not per line: this file is a changelog, not a
 * line counter. The rule is stated in the emitted file so the number
 * can be checked rather than believed.
 * ---------------------------------------------------------------- */
const AGENT_EMAILS = [/noreply@anthropic\.com$/i, /users\.noreply\.github\.com$/i];
const AGENT_NAMES = [/^claude\b/i, /\bbot\]?$/i, /^dependabot/i, /^github-actions/i];

function isAgent(authorName, authorEmail, trailers) {
  if (AGENT_EMAILS.some((r) => r.test(authorEmail))) {
    /* A noreply GitHub address alone is not evidence of an agent, so
       only the Anthropic one counts on its own. */
    if (/noreply@anthropic\.com$/i.test(authorEmail)) return true;
  }
  if (AGENT_NAMES.some((r) => r.test(authorName))) return true;
  if (trailers && /claude|copilot|codex|assistant/i.test(trailers)) return true;
  return false;
}

/* ---------------------------------------------------------------- *
 * 4. Read the history.
 * ---------------------------------------------------------------- */
function readCommits() {
  const format =
    ['%H', '%h', '%aI', '%cI', '%s', '%an', '%ae', '%(trailers:key=Co-Authored-By,valueonly,separator=%x2c)', '%b']
      .join(FS) + RS;
  const raw = git(['log', '--all', '--no-merges', '--date-order', '--format=' + format]);
  const map = new Map();
  for (const rec of raw.split(RS)) {
    const line = rec.replace(/^\n/, '');
    if (!line.trim()) continue;
    const f = line.split(FS);
    if (f.length < 9) continue;
    const [sha, short, authorDate, commitDate, subject, an, ae, trailers, body] = f;
    map.set(sha, {
      sha,
      short,
      date: commitDate || authorDate,
      authorDate,
      subject,
      author: an,
      agent: isAgent(an, ae, trailers),
      category: categorize(subject),
      breaking: isBreaking(subject, body)
    });
  }
  return map;
}

function readTags() {
  const fmt = ['%(refname:short)', '%(objecttype)', '%(objectname)', '%(*objectname)', '%(creatordate:iso-strict)', '%(contents:subject)'].join(FS);
  const raw = git(['for-each-ref', '--sort=creatordate', '--format=' + fmt, 'refs/tags']);
  const out = [];
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    const [name, type, objectname, peeled, created, subject] = line.split(FS);
    const commit = (peeled && peeled.trim()) || objectname;
    out.push({ name, annotated: type === 'tag', commit, created, subject: subject || '' });
  }
  return out;
}

/* Commits reachable from `head` but from none of `excludes`. Passed on
   stdin so a repository with hundreds of tags cannot blow the command
   line length limit, which is a real ceiling on Windows. */
function revsExcluding(head, excludes) {
  const input = [head].concat(excludes.map((c) => '^' + c)).join('\n') + '\n';
  let raw;
  try {
    raw = git(['rev-list', '--no-merges', '--stdin'], input);
  } catch (e) {
    fail('git rev-list failed for ' + head + ': ' + (e.stderr || e.message));
  }
  return raw.split('\n').filter(Boolean);
}

/* ---------------------------------------------------------------- *
 * 5. Validate every SHA before anything is written.
 * ---------------------------------------------------------------- */
function validateShas(shas) {
  if (!shas.length) return;
  const input = shas.map((s) => s + '^{commit}').join('\n') + '\n';
  const raw = git(['cat-file', '--batch-check'], input);
  const lines = raw.split('\n').filter(Boolean);
  if (lines.length !== shas.length) {
    fail('cat-file returned ' + lines.length + ' lines for ' + shas.length + ' commits. The changelog was not written.');
  }
  const bad = [];
  lines.forEach((line, i) => {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 2 || parts[1] !== 'commit') bad.push(shas[i] + ' -> ' + line.trim());
  });
  if (bad.length) {
    fail(
      'these commits could not be resolved, so a link to them would be dead:\n  ' +
        bad.join('\n  ') +
        '\nThe changelog was not written.'
    );
  }
}

/* ---------------------------------------------------------------- *
 * 6. Build it.
 * ---------------------------------------------------------------- */
function build() {
  let inside;
  try {
    inside = git(['rev-parse', '--is-inside-work-tree']).trim();
  } catch {
    fail('this is not a git working tree, so there is no history to read.');
  }
  if (inside !== 'true') fail('this is not a git working tree, so there is no history to read.');

  const url = remoteUrl();
  const base = commitBaseFor(url);
  const commits = readCommits();
  const tags = readTags();

  const versions = [];
  const seen = [];
  let missingMeta = 0;

  for (const tag of tags) {
    const shas = revsExcluding(tag.commit, seen.slice());
    seen.push(tag.commit);
    const entries = [];
    for (const sha of shas) {
      const meta = commits.get(sha);
      if (!meta) {
        missingMeta++;
        continue;
      }
      entries.push(meta);
    }
    entries.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    versions.push({
      version: tag.name,
      tag: tag.name,
      annotated: tag.annotated,
      tagCommit: tag.commit,
      tagSubject: tag.subject,
      date: (tag.created || '').slice(0, 10),
      dateIso: tag.created,
      released: true,
      entries
    });
  }

  /* Anything on HEAD that no tag has reached yet. It is included and
     labelled as not released, because leaving it out would make the
     newest work invisible while making the page look complete. */
  const head = git(['rev-parse', 'HEAD']).trim();
  const headBranch = (() => {
    try {
      return git(['rev-parse', '--abbrev-ref', 'HEAD']).trim();
    } catch {
      return '';
    }
  })();
  const unreleasedShas = revsExcluding(head, tags.map((t) => t.commit));
  const unreleased = unreleasedShas.map((s) => commits.get(s)).filter(Boolean);
  unreleased.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  versions.reverse();
  if (unreleased.length) {
    versions.unshift({
      version: 'Unreleased',
      tag: null,
      annotated: false,
      tagCommit: head,
      tagSubject: '',
      date: unreleased[0].date.slice(0, 10),
      dateIso: unreleased[0].date,
      released: false,
      branch: headBranch,
      entries: unreleased
    });
  }

  const allShas = [];
  for (const v of versions) {
    if (v.tagCommit) allShas.push(v.tagCommit);
    for (const e of v.entries) allShas.push(e.sha);
  }
  validateShas(Array.from(new Set(allShas)));

  const entryCount = versions.reduce((n, v) => n + v.entries.length, 0);
  const emptyVersions = versions.filter((v) => !v.entries.length).length;
  const agentCount = versions.reduce((n, v) => n + v.entries.filter((e) => e.agent).length, 0);

  const payload = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    generator: 'scripts/build-site-changelog.mjs',
    command: 'node scripts/build-site-changelog.mjs',
    repository: url || null,
    repositoryWeb: base ? base.web : null,
    commitUrlBase: base ? base.commit : null,
    commitLinkNote: base
      ? 'Every entry links to its commit on ' + base.host + '. Each SHA was checked back against the object database before this file was written.'
      : 'This checkout has no recognised remote, so no commit link can be built. The full SHA is shown instead and can be copied.',
    head,
    headBranch,
    versionCount: versions.length,
    releasedVersionCount: versions.filter((v) => v.released).length,
    entryCount,
    emptyVersionCount: emptyVersions,
    agentEntryCount: agentCount,
    categories: CATEGORIES,
    derivation: {
      category:
        'Git records no category, so it is derived from the commit subject: conventional-commit prefixes first, then plain-English keywords. The subject beside it is the recorded text, unchanged.',
      breaking:
        'A change is marked breaking only where the author said so, with a conventional-commit exclamation mark or a BREAKING CHANGE trailer. It is never inferred from the wording.',
      authorship:
        'An entry counts as agent-written when the commit author is an automation identity or carries a co-author trailer naming one. Stated so the number can be checked rather than believed.',
      date: 'A version date is the date its tag was created. An entry date is the commit date git recorded.'
    },
    versions
  };

  if (missingMeta) {
    process.stderr.write(
      'build-site-changelog: ' + missingMeta + ' commits appeared in a range but not in the log pass and were skipped.\n'
    );
  }

  const body =
    '/* GENERATED FILE -- do not edit.\n' +
    ' *\n' +
    ' * Written by scripts/build-site-changelog.mjs from this repository\'s\n' +
    ' * real commit history. Every SHA below was validated against the object\n' +
    ' * database before this file was written, so no entry links to a commit\n' +
    ' * that does not exist.\n' +
    ' *\n' +
    ' * Regenerate with:  node scripts/build-site-changelog.mjs\n' +
    ' */\n' +
    'window.WDS_CHANGELOG = ' +
    JSON.stringify(payload, null, 1) +
    ';\n';

  if (CHECK_ONLY) {
    if (!existsSync(OUT)) fail('site/assets/changelog.js does not exist. Run the generator.');
    const current = readFileSync(OUT, 'utf8');
    const a = current.replace(/"generatedAt": "[^"]*"/, '');
    const b = body.replace(/"generatedAt": "[^"]*"/, '');
    if (a !== b) fail('site/assets/changelog.js is stale. Run: node scripts/build-site-changelog.mjs');
    process.stdout.write('changelog.js is current: ' + versions.length + ' versions, ' + entryCount + ' entries.\n');
    return;
  }

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, body, 'utf8');

  process.stdout.write(
    [
      'Wrote ' + OUT,
      '  repository        ' + (url || '(none)'),
      '  commit link base  ' + (base ? base.commit : '(none: SHAs shown as plain text)'),
      '  versions          ' + versions.length + ' (' + payload.releasedVersionCount + ' released, ' + (versions.length - payload.releasedVersionCount) + ' not yet released)',
      '  entries           ' + entryCount + ' (' + agentCount + ' agent-written)',
      '  empty versions    ' + emptyVersions + ' (each says so rather than being hidden)',
      '  SHAs validated    ' + new Set(allShas).size + ' distinct, all resolved to commits',
      '  bytes             ' + Buffer.byteLength(body, 'utf8')
    ].join('\n') + '\n'
  );
}

build();
