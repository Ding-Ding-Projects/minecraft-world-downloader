#!/usr/bin/env node
// =============================================================================
//  The project's committed line counter.
// =============================================================================
//
//  This prints the exact table every release publishes. The release workflow
//  runs it over the tagged commit and pastes the result into the release notes,
//  so the figure is produced by the same run that built the artifacts, at
//  exactly the commit being released, and anyone can reproduce it locally with
//  one command.
//
//  Nobody counts lines by hand. An ad-hoc `git ls-files | xargs wc -l` costs far
//  more than this does, and a path-prefix bucketing written on the spot silently
//  drops every file that matches no prefix — a total that quietly loses whole
//  directories misrepresents the project. This script has a catch-all row
//  instead, so no file can escape being counted.
//
//  WHAT IT MEASURES
//
//    * A single revision (HEAD by default, or --rev <rev> for a release tag).
//      Contents are read from the git object store rather than the working
//      tree, so the count, the attribution and the revision can never disagree.
//    * Lines and non-blank lines, broken down by category and by language.
//    * Hand-written versus generated.
//    * Which lines survive from an agent's commits and which from a person's,
//      attributed per SURVIVING line with `git blame`. Never by summing added
//      lines from the log: churn is not authorship, and a line written and
//      later deleted belongs to nobody.
//    * A project total and a grand total, with every excluded row visible in
//      the same table rather than silently dropped.
//
//  Usage:
//    node scripts/count-lines.mjs                  plain text table
//    node scripts/count-lines.mjs --markdown       release-notes table
//    node scripts/count-lines.mjs --rev v1.2.3     count a specific revision
//    node scripts/count-lines.mjs --help
//
//  Exit codes: 0 counted. 1 the counter's own arithmetic disagreed, or git
//  refused. 2 bad usage.

import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { cpus } from 'node:os';

const execFileAsync = promisify(execFile);

// A generous ceiling: `git cat-file --batch` streams the whole tree's text
// through one pipe, and the default 1 MiB buffer truncates it without saying so.
const MAX_BUFFER = 1024 * 1024 * 512;

// --------------------------------------------------------------------------- //
// Classification tables
// --------------------------------------------------------------------------- //

// Paths that are not this project's code. Each one names why, and each one
// appears as its own row in the output: excluded is not the same as invisible.
const EXCLUSIONS = [
  {
    key: 'vendored',
    label: 'Vendored third-party source',
    why: 'copied in from another project; not written here',
    test: (path) => /^vendor\//.test(path) || /(^|\/)(third_party|third-party)\//.test(path)
  },
  {
    key: 'dependencies',
    label: 'Dependency directories',
    why: 'installed packages, not sources',
    test: (path) => /(^|\/)node_modules\//.test(path) || /(^|\/)(\.venv|venv|site-packages)\//.test(path)
  },
  {
    key: 'build-output',
    label: 'Build output',
    why: 'produced by a build, not committed as source',
    test: (path) => /(^|\/)(out|dist|release|target|build\/(classes|libs))\//.test(path)
  },
  {
    key: 'lockfiles',
    label: 'Dependency lockfiles',
    why: 'machine-maintained resolution records',
    test: (path) =>
      /(^|\/)(package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml|Cargo\.lock|poetry\.lock|composer\.lock|Gemfile\.lock|go\.sum)$/.test(
        path
      )
  }
];

// Extension -> [language, category]. Category is one of:
//   source | tests | styles-markup | docs | config-data
// Anything not listed here falls into the catch-all, which is reported rather
// than dropped.
const LANGUAGES = new Map(
  Object.entries({
    '.java': ['Java', 'source'],
    '.kt': ['Kotlin', 'source'],
    '.cs': ['C#', 'source'],
    '.ts': ['TypeScript', 'source'],
    '.tsx': ['TypeScript', 'source'],
    '.js': ['JavaScript', 'source'],
    '.mjs': ['JavaScript', 'source'],
    '.cjs': ['JavaScript', 'source'],
    '.jsx': ['JavaScript', 'source'],
    '.py': ['Python', 'source'],
    '.rb': ['Ruby', 'source'],
    '.go': ['Go', 'source'],
    '.rs': ['Rust', 'source'],
    '.sh': ['Shell', 'source'],
    '.bash': ['Shell', 'source'],
    '.bat': ['Batch', 'source'],
    '.cmd': ['Batch', 'source'],
    '.ps1': ['PowerShell', 'source'],
    '.psm1': ['PowerShell', 'source'],
    '.nsi': ['NSIS script', 'source'],
    '.sql': ['SQL', 'source'],

    '.html': ['HTML', 'styles-markup'],
    '.htm': ['HTML', 'styles-markup'],
    '.xaml': ['XAML', 'styles-markup'],
    '.fxml': ['FXML', 'styles-markup'],
    '.css': ['CSS', 'styles-markup'],
    '.scss': ['SCSS', 'styles-markup'],
    '.sass': ['SCSS', 'styles-markup'],
    '.less': ['LESS', 'styles-markup'],
    '.svg': ['SVG', 'styles-markup'],

    '.md': ['Markdown', 'docs'],
    '.markdown': ['Markdown', 'docs'],
    '.rst': ['reStructuredText', 'docs'],
    '.txt': ['Plain text', 'docs'],
    '.adoc': ['AsciiDoc', 'docs'],

    '.json': ['JSON', 'config-data'],
    '.yml': ['YAML', 'config-data'],
    '.yaml': ['YAML', 'config-data'],
    '.toml': ['TOML', 'config-data'],
    '.xml': ['XML', 'config-data'],
    '.csproj': ['MSBuild project', 'config-data'],
    '.props': ['MSBuild project', 'config-data'],
    '.targets': ['MSBuild project', 'config-data'],
    '.properties': ['Properties', 'config-data'],
    '.ini': ['INI', 'config-data'],
    '.cfg': ['INI', 'config-data'],
    '.mcmeta': ['JSON', 'config-data'],
    '.npmrc': ['Configuration', 'config-data'],
    '.npmignore': ['Configuration', 'config-data'],
    '.dockerignore': ['Configuration', 'config-data'],
    '.gitignore': ['Configuration', 'config-data'],
    '.gitattributes': ['Configuration', 'config-data'],
    '.nojekyll': ['Configuration', 'config-data'],
    '.editorconfig': ['Configuration', 'config-data'],
    '.manifest': ['Application manifest', 'config-data'],
    '.ipynb': ['Jupyter notebook', 'config-data']
  })
);

// Files with no extension whose name alone identifies them.
const FILENAMES = new Map(
  Object.entries({
    Dockerfile: ['Dockerfile', 'config-data'],
    'Dockerfile.base': ['Dockerfile', 'config-data'],
    Makefile: ['Makefile', 'config-data'],
    LICENSE: ['Plain text', 'docs'],
    RELEASES: ['Plain text', 'config-data']
  })
);

const CATEGORY_LABELS = new Map(
  Object.entries({
    source: 'Project source',
    tests: 'Tests',
    'styles-markup': 'Styles and markup',
    docs: 'Documentation',
    'config-data': 'Configuration and data',
    other: 'Uncategorised (catch-all)'
  })
);

const CATEGORY_ORDER = ['source', 'tests', 'styles-markup', 'docs', 'config-data', 'other'];

// A test path. Deliberately conservative: a directory literally named for tests,
// or a filename that says so.
function isTestPath(path) {
  if (/(^|\/)(src\/test|test|tests|__tests__|spec)\//.test(path)) return true;
  if (/(^|\/)[^/]*\.(test|spec)\.[a-z]+$/i.test(path)) return true;
  if (/(^|\/)[^/]*Tests?\.(java|cs|kt)$/.test(path)) return true;
  if (/^desktop\.tests\//.test(path)) return true;
  return false;
}

// Generated files, by path shape. The content sniff below catches the rest.
function looksGeneratedByPath(path) {
  if (/(^|\/)(generated|__generated__|gen)\//i.test(path)) return true;
  if (/\.generated\.[A-Za-z0-9]+$/i.test(path)) return true;
  if (/\.min\.(js|css)$/i.test(path)) return true;
  if (/(^|\/)[^/]*\.g\.(cs|ts|js|dart)$/i.test(path)) return true;
  return false;
}

// The marker a generator leaves at the top of what it wrote. Only the first few
// kilobytes are examined, because that is where such a marker lives and reading
// further would find the words in ordinary prose.
const GENERATED_MARKERS = [
  '@generated',
  'Code generated by',
  'auto-generated',
  'AUTO-GENERATED',
  'autogenerated',
  'DO NOT EDIT THIS FILE',
  'This file was generated',
  'This file is generated'
];

function looksGeneratedByContent(text) {
  const head = text.slice(0, 4096);
  return GENERATED_MARKERS.some((marker) => head.includes(marker));
}

// --------------------------------------------------------------------------- //
// Authorship
// --------------------------------------------------------------------------- //

// THE RULE, stated here and printed in the output so the number can be checked:
// a commit counts as agent-written when its AUTHOR is an automation identity, or
// when the commit message carries a Co-Authored-By trailer naming an agent.
//
// The name patterns are anchored on whole words rather than substrings, so a
// person whose name merely contains one of them is not swept up.
const AGENT_IDENTITY = /(^|[^a-z])(claude|codex|copilot|dependabot|renovate|github-actions)([^a-z]|$)/i;
const AGENT_BOT_SUFFIX = /\[bot\]/i;
const AGENT_EMAIL = /(noreply@anthropic\.com|@users\.noreply\.github\.com$)/i;

function identityIsAgent(name, email) {
  if (AGENT_BOT_SUFFIX.test(name) || AGENT_BOT_SUFFIX.test(email)) return true;
  if (AGENT_IDENTITY.test(name) || AGENT_IDENTITY.test(email)) return true;
  // A noreply address alone is not evidence; it must also name an automation.
  if (AGENT_EMAIL.test(email) && AGENT_IDENTITY.test(email)) return true;
  if (/noreply@anthropic\.com/i.test(email)) return true;
  return false;
}

function commitIsAgentWritten(commit) {
  if (identityIsAgent(commit.authorName, commit.authorEmail)) {
    return { agent: true, reason: 'author is an automation identity' };
  }
  for (const raw of commit.body.split(/\r?\n/)) {
    const match = /^\s*co-authored-by:\s*(.+)$/i.exec(raw);
    if (!match) continue;
    const value = match[1].trim();
    const emailMatch = /<([^>]*)>/.exec(value);
    const email = emailMatch ? emailMatch[1] : '';
    const name = value.replace(/<[^>]*>/, '').trim();
    if (identityIsAgent(name, email)) {
      return { agent: true, reason: 'Co-Authored-By trailer names an agent' };
    }
  }
  return { agent: false, reason: 'author is a person and no agent trailer is present' };
}

// --------------------------------------------------------------------------- //
// git plumbing
// --------------------------------------------------------------------------- //

async function git(args, options = {}) {
  return execFileAsync('git', args, {
    maxBuffer: MAX_BUFFER,
    encoding: 'utf8',
    ...options
  });
}

// Feeds a list of object ids to a long-running git process and collects its raw
// output. This has to be spawn rather than execFile: the asynchronous execFile
// has no `input` option (only the synchronous one does), so a command that reads
// standard input simply waits forever on a pipe nobody closes, with no error and
// no output to say why.
function gitWithStdin(args, input, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn('git', args, { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
    const chunks = [];
    let stderr = '';
    child.stdout.on('data', (chunk) => chunks.push(chunk));
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve(Buffer.concat(chunks));
      else reject(new Error(stderr.trim() || `git ${args[0]} exited ${code}`));
    });
    child.stdin.on('error', reject);
    child.stdin.end(input);
  });
}

async function resolveRepositoryRoot() {
  try {
    const { stdout } = await git(['rev-parse', '--show-toplevel']);
    return stdout.trim();
  } catch (error) {
    fail(1, `this is not a git checkout, so nothing can be counted.\n  git said: ${describeError(error)}`);
  }
}

function describeError(error) {
  const stderr = (error && error.stderr ? String(error.stderr) : '').trim();
  return stderr || (error && error.message) || String(error);
}

// Every blob in the tree at the given revision, as { path, sha }.
async function listTree(rev, cwd) {
  let stdout;
  try {
    ({ stdout } = await git(['ls-tree', '-r', '-z', '--full-tree', rev], { cwd }));
  } catch (error) {
    fail(1, `could not read the tree at '${rev}'.\n  git said: ${describeError(error)}`);
  }
  const entries = [];
  for (const record of stdout.split('\0')) {
    if (!record) continue;
    const tabAt = record.indexOf('\t');
    if (tabAt < 0) continue;
    const meta = record.slice(0, tabAt).split(/\s+/);
    const path = record.slice(tabAt + 1);
    const [, type, sha] = meta;
    // A gitlink (submodule) has no blob to read and is not this tree's content.
    if (type !== 'blob') continue;
    entries.push({ path, sha });
  }
  return entries;
}

// Reads every blob in one `git cat-file --batch` rather than one process per
// file. The output is a stream of "<sha> blob <size>\n<size bytes>\n".
async function readBlobs(entries, cwd) {
  if (entries.length === 0) return new Map();
  const input = Buffer.from(entries.map((entry) => entry.sha).join('\n') + '\n', 'utf8');
  let stdout;
  try {
    stdout = await gitWithStdin(['cat-file', '--batch'], input, cwd);
  } catch (error) {
    fail(1, `could not read blob contents.\n  git said: ${describeError(error)}`);
  }

  const contents = new Map();
  let offset = 0;
  while (offset < stdout.length) {
    const newlineAt = stdout.indexOf(0x0a, offset);
    if (newlineAt < 0) break;
    const header = stdout.slice(offset, newlineAt).toString('utf8');
    const parts = header.split(' ');
    if (parts.length < 3) {
      fail(1, `git cat-file produced a header this script cannot parse: ${JSON.stringify(header)}`);
    }
    const sha = parts[0];
    const size = Number.parseInt(parts[2], 10);
    const start = newlineAt + 1;
    contents.set(sha, stdout.slice(start, start + size));
    offset = start + size + 1; // the trailing newline git appends
  }
  return contents;
}

// Attribution, per surviving line, from `git blame --porcelain`. The porcelain
// format emits the full commit header only the first time a commit appears and
// a bare "<sha> <orig> <final>" line afterwards, which is why it is used here in
// preference to --line-porcelain: same answer, a fraction of the output.
async function blameFile(rev, path, cwd) {
  const { stdout } = await git(['blame', '--porcelain', rev, '--', path], { cwd });
  const counts = new Map();
  let total = 0;
  for (const line of stdout.split('\n')) {
    // 40 hex for SHA-1, 64 for a SHA-256 repository. Porcelain content lines
    // begin with a tab, so they can never match this.
    const match = /^([0-9a-f]{40,64})\s+\d+\s+\d+(?:\s+\d+)?$/.exec(line);
    if (!match) continue;
    const sha = match[1];
    counts.set(sha, (counts.get(sha) ?? 0) + 1);
    total += 1;
  }
  return { counts, total };
}

async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  const runners = new Array(Math.min(limit, items.length)).fill(null).map(async () => {
    for (;;) {
      const index = next;
      next += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return results;
}

// --------------------------------------------------------------------------- //
// Counting
// --------------------------------------------------------------------------- //

function extensionOf(path) {
  const name = path.slice(path.lastIndexOf('/') + 1);
  const dotAt = name.lastIndexOf('.');
  if (dotAt < 0) return '';
  // A dotfile such as .gitignore has its whole name as the key. Treating the
  // leading dot as "no extension" is what dropped four real configuration files
  // into the catch-all row on the first run of this script.
  if (dotAt === 0) return name.toLowerCase();
  return name.slice(dotAt).toLowerCase();
}

function classifyPath(path) {
  for (const exclusion of EXCLUSIONS) {
    if (exclusion.test(path)) return { excluded: exclusion.key };
  }
  const name = path.slice(path.lastIndexOf('/') + 1);
  const byName = FILENAMES.get(name);
  const byExtension = LANGUAGES.get(extensionOf(path));
  const known = byName ?? byExtension;
  const language = known ? known[0] : 'Other text';
  let category = known ? known[1] : 'other';
  if (isTestPath(path)) category = 'tests';
  return { excluded: null, language, category };
}

// A NUL byte anywhere in the first 8 KiB is how git itself decides a blob is
// binary, and it is the right call here too: counting "lines" in a PNG is
// meaningless and blaming one is slow.
function looksBinary(buffer) {
  const head = buffer.slice(0, 8192);
  return head.includes(0x00);
}

// Lines counted exactly the way `git blame` counts them, which is what makes the
// line total and the attribution total agree. A file's trailing newline
// terminates its last line rather than starting another one; counting it as an
// extra line is the usual cause of a counter whose two totals disagree.
function countLines(buffer) {
  if (buffer.length === 0) return { lines: 0, nonBlank: 0 };
  let lines = 0;
  for (let index = 0; index < buffer.length; index += 1) {
    if (buffer[index] === 0x0a) lines += 1;
  }
  if (buffer[buffer.length - 1] !== 0x0a) lines += 1;

  const text = buffer.toString('utf8');
  let nonBlank = 0;
  let start = 0;
  for (;;) {
    let end = text.indexOf('\n', start);
    const last = end < 0;
    if (last) end = text.length;
    if (end > start) {
      const slice = text.slice(start, end);
      if (slice.trim().length > 0) nonBlank += 1;
    }
    if (last) break;
    start = end + 1;
  }
  return { lines, nonBlank };
}

function emptyTally() {
  return { files: 0, lines: 0, nonBlank: 0 };
}

function addTo(tally, lines, nonBlank) {
  tally.files += 1;
  tally.lines += lines;
  tally.nonBlank += nonBlank;
}

// --------------------------------------------------------------------------- //
// Rendering
// --------------------------------------------------------------------------- //

function formatNumber(value) {
  return value.toLocaleString('en-US');
}

function renderTable(headers, rows, alignRight, markdown) {
  if (markdown) {
    const head = `| ${headers.join(' | ')} |`;
    const rule = `| ${headers.map((_, index) => (alignRight[index] ? '---:' : ':---')).join(' | ')} |`;
    const body = rows.map((row) => `| ${row.join(' | ')} |`);
    return [head, rule, ...body].join('\n');
  }
  const widths = headers.map((header, index) =>
    Math.max(header.length, ...rows.map((row) => String(row[index] ?? '').length))
  );
  const renderRow = (cells) =>
    '  ' +
    cells
      .map((cell, index) =>
        alignRight[index] ? String(cell).padStart(widths[index]) : String(cell).padEnd(widths[index])
      )
      .join('  ');
  const separator = '  ' + widths.map((width) => '-'.repeat(width)).join('  ');
  return [renderRow(headers), separator, ...rows.map(renderRow)].join('\n');
}

function heading(text, markdown, level = 2) {
  if (markdown) return `\n${'#'.repeat(level)} ${text}\n`;
  return `\n${text}\n${'='.repeat(text.length)}\n`;
}

// --------------------------------------------------------------------------- //
// Entry point
// --------------------------------------------------------------------------- //

function fail(code, message) {
  process.stderr.write(`count-lines: ${message}\n`);
  process.exit(code);
}

function usage() {
  process.stdout.write(
    [
      '',
      '  count-lines.mjs - the project line count that releases publish',
      '',
      '    node scripts/count-lines.mjs                 plain text table',
      '    node scripts/count-lines.mjs --markdown      release-notes table',
      '    node scripts/count-lines.mjs --rev <rev>     count a specific revision',
      '                                                 (a release tag, a commit)',
      '    node scripts/count-lines.mjs --help',
      '',
      '  It counts a revision from the git object store, not the working tree, so',
      '  the count, the attribution and the revision can never disagree. Agent and',
      '  human shares are attributed per surviving line with git blame.',
      ''
    ].join('\n')
  );
}

function parseArguments(argv) {
  const options = { rev: 'HEAD', markdown: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--markdown' || argument === '-m') {
      options.markdown = true;
    } else if (argument === '--rev' || argument === '-r') {
      const value = argv[index + 1];
      if (!value || value.startsWith('-')) fail(2, '--rev needs a revision');
      options.rev = value;
      index += 1;
    } else if (argument === '--help' || argument === '-h') {
      usage();
      process.exit(0);
    } else {
      fail(2, `unrecognised argument: ${argument}`);
    }
  }
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const root = await resolveRepositoryRoot();

  let resolvedRev;
  try {
    resolvedRev = (await git(['rev-parse', options.rev], { cwd: root })).stdout.trim();
  } catch (error) {
    fail(1, `'${options.rev}' is not a revision in this repository.\n  git said: ${describeError(error)}`);
  }

  const entries = await listTree(options.rev, root);
  const contents = await readBlobs(entries, root);

  const byCategory = new Map(CATEGORY_ORDER.map((key) => [key, emptyTally()]));
  const byLanguage = new Map();
  const byExclusion = new Map(EXCLUSIONS.map((exclusion) => [exclusion.key, emptyTally()]));
  const binary = emptyTally();
  const generated = emptyTally();
  const handWritten = emptyTally();
  const projectTotal = emptyTally();
  const excludedTotal = emptyTally();

  const generatedPaths = [];
  const blameTargets = [];

  for (const entry of entries) {
    const buffer = contents.get(entry.sha);
    if (!buffer) {
      fail(1, `git cat-file returned no content for ${entry.path} (${entry.sha}).`);
    }

    const classification = classifyPath(entry.path);

    if (looksBinary(buffer)) {
      // Counted as a file and reported, never silently dropped, but it has no
      // lines to count and nothing meaningful to blame.
      binary.files += 1;
      continue;
    }

    const { lines, nonBlank } = countLines(buffer);

    if (classification.excluded) {
      addTo(byExclusion.get(classification.excluded), lines, nonBlank);
      addTo(excludedTotal, lines, nonBlank);
      continue;
    }

    addTo(byCategory.get(classification.category), lines, nonBlank);
    if (!byLanguage.has(classification.language)) byLanguage.set(classification.language, emptyTally());
    addTo(byLanguage.get(classification.language), lines, nonBlank);
    addTo(projectTotal, lines, nonBlank);

    const text = buffer.toString('utf8');
    // The content sniff is not applied to documentation: an article that
    // describes a generated file says "auto-generated" in ordinary prose, and
    // counting the article itself as generated would be simply wrong. Path
    // shape still applies everywhere.
    const isGenerated =
      looksGeneratedByPath(entry.path) ||
      (classification.category !== 'docs' && looksGeneratedByContent(text));
    if (isGenerated) {
      addTo(generated, lines, nonBlank);
      generatedPaths.push({ path: entry.path, lines });
    } else {
      addTo(handWritten, lines, nonBlank);
    }

    if (lines > 0) blameTargets.push(entry.path);
  }

  // --- attribution --------------------------------------------------------- //

  const concurrency = Math.max(2, Math.min(8, cpus().length));
  const perCommit = new Map();
  let attributedLines = 0;
  const blameFailures = [];

  const blames = await mapWithConcurrency(blameTargets, concurrency, async (path) => {
    try {
      return { path, result: await blameFile(options.rev, path, root) };
    } catch (error) {
      return { path, error: describeError(error) };
    }
  });

  for (const blame of blames) {
    if (blame.error) {
      blameFailures.push(`${blame.path}: ${blame.error}`);
      continue;
    }
    attributedLines += blame.result.total;
    for (const [sha, count] of blame.result.counts) {
      perCommit.set(sha, (perCommit.get(sha) ?? 0) + count);
    }
  }

  if (blameFailures.length > 0) {
    fail(
      1,
      `git blame could not attribute ${blameFailures.length} file(s), so the authorship split would be wrong:\n  ` +
        blameFailures.slice(0, 10).join('\n  ')
    );
  }

  // The counter's two totals must agree. If they do not, that is a bug here, not
  // something to paper over: an unexplained gap between two numbers in the same
  // table destroys the credibility of both.
  if (attributedLines !== projectTotal.lines) {
    fail(
      1,
      `the attribution total (${attributedLines}) and the line total (${projectTotal.lines}) disagree by ` +
        `${Math.abs(attributedLines - projectTotal.lines)} line(s). This is a defect in this counter and must be ` +
        `fixed rather than published. The usual cause is counting a file's trailing newline as an extra line, ` +
        `which git blame does not.`
    );
  }

  const commitDetails = await loadCommits([...perCommit.keys()], root);
  let agentLines = 0;
  let humanLines = 0;
  const unknownCommits = [];
  for (const [sha, count] of perCommit) {
    const commit = commitDetails.get(sha);
    if (!commit) {
      unknownCommits.push(sha);
      continue;
    }
    if (commitIsAgentWritten(commit).agent) agentLines += count;
    else humanLines += count;
  }
  if (unknownCommits.length > 0) {
    fail(
      1,
      `git could not describe ${unknownCommits.length} commit(s) that blame attributed lines to, so the ` +
        `authorship split would be incomplete: ${unknownCommits.slice(0, 5).join(', ')}`
    );
  }
  if (agentLines + humanLines !== projectTotal.lines) {
    fail(
      1,
      `the authorship split (${agentLines} + ${humanLines}) does not add up to the project total ` +
        `(${projectTotal.lines}). This is a defect in this counter.`
    );
  }

  render({
    options,
    root,
    resolvedRev,
    entries,
    byCategory,
    byLanguage,
    byExclusion,
    binary,
    generated,
    handWritten,
    generatedPaths,
    projectTotal,
    excludedTotal,
    agentLines,
    humanLines,
    commitCount: perCommit.size
  });
}

async function loadCommits(shas, cwd) {
  const details = new Map();
  const CHUNK = 150; // keeps the command line comfortably under the Windows limit
  for (let index = 0; index < shas.length; index += CHUNK) {
    const chunk = shas.slice(index, index + CHUNK);
    const { stdout } = await git(
      ['log', '--no-walk=unsorted', '--format=%H%x1f%an%x1f%ae%x1f%B%x1e', ...chunk],
      { cwd }
    );
    for (const record of stdout.split('\x1e')) {
      const trimmed = record.replace(/^\n+/, '');
      if (!trimmed.trim()) continue;
      const [sha, authorName, authorEmail, body] = trimmed.split('\x1f');
      if (!sha) continue;
      details.set(sha.trim(), {
        authorName: authorName ?? '',
        authorEmail: authorEmail ?? '',
        body: body ?? ''
      });
    }
  }
  return details;
}

function render(data) {
  const markdown = data.options.markdown;
  const out = [];
  const percent = (value, total) => (total === 0 ? '0.0%' : `${((value / total) * 100).toFixed(1)}%`);

  out.push(heading('Lines of code', markdown, 2));
  const shortRev = data.resolvedRev.slice(0, 12);
  const facts = [
    `Revision counted: \`${data.resolvedRev}\` (${data.options.rev === 'HEAD' ? 'HEAD' : data.options.rev})`,
    `Command: \`node scripts/count-lines.mjs${data.options.markdown ? ' --markdown' : ''}${
      data.options.rev === 'HEAD' ? '' : ` --rev ${data.options.rev}`
    }\``,
    `Files in the tree at ${shortRev}: ${formatNumber(data.entries.length)}`,
    'Contents are read from the git object store at that revision, not from the working tree.'
  ];
  out.push(markdown ? facts.map((fact) => `- ${fact}`).join('\n') : facts.map((fact) => `  ${fact.replace(/`/g, '')}`).join('\n'));

  // --- categories ---------------------------------------------------------- //
  out.push(heading('The project, by category', markdown, 3));
  const categoryRows = CATEGORY_ORDER.map((key) => {
    const tally = data.byCategory.get(key);
    return [
      CATEGORY_LABELS.get(key),
      formatNumber(tally.files),
      formatNumber(tally.lines),
      formatNumber(tally.nonBlank)
    ];
  });
  categoryRows.push([
    markdown ? '**Project total**' : 'Project total',
    formatNumber(data.projectTotal.files),
    formatNumber(data.projectTotal.lines),
    formatNumber(data.projectTotal.nonBlank)
  ]);
  out.push(
    renderTable(['Category', 'Files', 'Lines', 'Non-blank'], categoryRows, [false, true, true, true], markdown)
  );
  out.push(
    markdown
      ? '\nThe catch-all row exists so no file can slip out of the count: anything this script does not recognise lands there and is still counted.'
      : '\n  The catch-all row exists so no file can slip out of the count: anything this\n  script does not recognise lands there and is still counted.'
  );

  // --- languages ----------------------------------------------------------- //
  out.push(heading('The project, by language', markdown, 3));
  const languageRows = [...data.byLanguage.entries()]
    .sort((a, b) => b[1].lines - a[1].lines || a[0].localeCompare(b[0]))
    .map(([language, tally]) => [
      language,
      formatNumber(tally.files),
      formatNumber(tally.lines),
      formatNumber(tally.nonBlank)
    ]);
  out.push(
    renderTable(['Language', 'Files', 'Lines', 'Non-blank'], languageRows, [false, true, true, true], markdown)
  );

  // --- generated ----------------------------------------------------------- //
  out.push(heading('Hand-written versus generated', markdown, 3));
  const originRows = [
    [
      'Hand-written',
      formatNumber(data.handWritten.files),
      formatNumber(data.handWritten.lines),
      percent(data.handWritten.lines, data.projectTotal.lines)
    ],
    [
      'Generated',
      formatNumber(data.generated.files),
      formatNumber(data.generated.lines),
      percent(data.generated.lines, data.projectTotal.lines)
    ]
  ];
  out.push(renderTable(['Origin', 'Files', 'Lines', 'Share'], originRows, [false, true, true, true], markdown));
  const biggestGenerated = [...data.generatedPaths].sort((a, b) => b.lines - a.lines).slice(0, 5);
  if (biggestGenerated.length > 0) {
    const list = biggestGenerated.map((file) => `${file.path} (${formatNumber(file.lines)} lines)`);
    out.push(
      markdown
        ? `\nLargest generated files: ${list.join(', ')}.`
        : `\n  Largest generated files:\n${list.map((item) => `    ${item}`).join('\n')}`
    );
  } else {
    out.push(
      markdown
        ? '\nNo generated files were detected at this revision, by path shape or by a generator marker in the first 4 KiB.'
        : '\n  No generated files were detected at this revision, by path shape or by a\n  generator marker in the first 4 KiB.'
    );
  }

  // --- authorship ---------------------------------------------------------- //
  out.push(heading('Who wrote the surviving lines', markdown, 3));
  const authorshipRows = [
    ['Agents', formatNumber(data.agentLines), percent(data.agentLines, data.projectTotal.lines)],
    ['People', formatNumber(data.humanLines), percent(data.humanLines, data.projectTotal.lines)],
    [
      markdown ? '**Total**' : 'Total',
      formatNumber(data.agentLines + data.humanLines),
      percent(data.agentLines + data.humanLines, data.projectTotal.lines)
    ]
  ];
  out.push(renderTable(['Written by', 'Lines', 'Share'], authorshipRows, [false, true, true], markdown));
  const rule = [
    `Attributed per SURVIVING line with \`git blame\` over ${formatNumber(data.commitCount)} distinct commits, never by summing added lines from the log: churn is not authorship, and a line written and later deleted belongs to nobody.`,
    'A commit counts as agent-written when its author is an automation identity (a name or address carrying claude, codex, copilot, dependabot, renovate, github-actions, a [bot] suffix, or noreply@anthropic.com) or when the commit message carries a Co-Authored-By trailer naming one of those. Every other commit counts as written by a person.',
    'This is stated plainly and without spin in either direction: a high agent share is not a boast and not an apology.'
  ];
  // The leading blank line matters in markdown: a list that starts on the line
  // immediately after a table row is swallowed by the table.
  out.push(
    markdown
      ? '\n' + rule.map((item) => `- ${item}`).join('\n')
      : '\n' + rule.map((item) => `  ${wrapText(item, 76)}`).join('\n\n')
  );

  // --- exclusions ---------------------------------------------------------- //
  out.push(heading('What was excluded, and the grand total', markdown, 3));
  const exclusionRows = EXCLUSIONS.map((exclusion) => {
    const tally = data.byExclusion.get(exclusion.key);
    return [
      exclusion.label,
      exclusion.why,
      formatNumber(tally.files),
      formatNumber(tally.lines),
      formatNumber(tally.nonBlank)
    ];
  });
  exclusionRows.push([
    'Binary and non-text files',
    'images, archives, fixtures; no lines to count',
    formatNumber(data.binary.files),
    '-',
    '-'
  ]);
  exclusionRows.push([
    markdown ? '**Excluded total**' : 'Excluded total',
    '',
    formatNumber(data.excludedTotal.files + data.binary.files),
    formatNumber(data.excludedTotal.lines),
    formatNumber(data.excludedTotal.nonBlank)
  ]);
  exclusionRows.push([
    markdown ? '**Project total**' : 'Project total',
    'everything in the tables above',
    formatNumber(data.projectTotal.files),
    formatNumber(data.projectTotal.lines),
    formatNumber(data.projectTotal.nonBlank)
  ]);
  exclusionRows.push([
    markdown ? '**GRAND TOTAL**' : 'GRAND TOTAL',
    'everything counted, excluded rows included',
    formatNumber(data.projectTotal.files + data.excludedTotal.files + data.binary.files),
    formatNumber(data.projectTotal.lines + data.excludedTotal.lines),
    formatNumber(data.projectTotal.nonBlank + data.excludedTotal.nonBlank)
  ]);
  out.push(
    renderTable(
      ['Excluded', 'Why', 'Files', 'Lines', 'Non-blank'],
      exclusionRows,
      [false, false, true, true, true],
      markdown
    )
  );
  const exclusionNote =
    'Excluded rows are shown rather than dropped: two clearly-labelled totals let a reader see both what the project is and what the repository holds. Authorship above is attributed over the project total only, because attributing vendored third-party code to this project says nothing true about either.';
  out.push(markdown ? `\n${exclusionNote}` : `\n  ${wrapText(exclusionNote, 76)}`);

  process.stdout.write(out.join('\n') + '\n');
}

function wrapText(text, width) {
  const words = text.split(/\s+/);
  const lines = [];
  let current = '';
  for (const word of words) {
    if (current.length === 0) current = word;
    else if (current.length + 1 + word.length <= width) current += ` ${word}`;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.join('\n  ');
}

main().catch((error) => {
  fail(1, describeError(error));
});
