import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { BundledToolResolution, HistoryEntry, HistoryQuery, HistoryStatus } from '../../shared/api';
import { historyDir } from '../paths';
import { resolveTool } from './bundled';

const run = promisify(execFile);

/**
 * Local, append-only version history.
 *
 * The repository lives inside the application data directory and never inside a
 * folder the user owns, so nothing this app does can ever put a stray `.git`
 * into somebody's project. Nothing is pushed anywhere; there is no remote.
 *
 * Append-only means the repository's own history is never rewritten. Restoring
 * an earlier state and pruning old entries are both recorded as NEW commits, so
 * an undo can be undone.
 *
 * `git` itself is resolved bundled-first, then PATH (see `./bundled`), the
 * exact same order every other feature in this app uses — there is no
 * manual-install instruction anywhere in this file. Only when neither a
 * bundled copy nor a PATH copy can be found does this module fall back to
 * the same append-only journal file used without commits, and `status()`
 * reports the degraded backend honestly rather than pretending a commit
 * happened.
 */

const JOURNAL = 'journal.jsonl';
const README = 'README.md';

const GIT_UNAVAILABLE_REASON =
  'git is not available: no copy is bundled with this build and none was found on PATH';

let backend: 'git' | 'journal' | null = null;
let degradedReason: string | undefined;
let sequence = 0;
let initializing: Promise<void> | null = null;

/** Resolved once per process — a positive or negative result is cached for
 *  the life of the process, exactly like `backend` itself once `initialize()`
 *  has run. */
let gitResolutionCache: BundledToolResolution | null | undefined;
async function resolveGit(): Promise<BundledToolResolution | null> {
  if (gitResolutionCache === undefined) gitResolutionCache = await resolveTool('git');
  return gitResolutionCache;
}

async function git(args: string[]): Promise<string> {
  const resolution = await resolveGit();
  if (!resolution) throw new Error(GIT_UNAVAILABLE_REASON);
  const { stdout } = await run(resolution.path, args, { cwd: historyDir(), windowsHide: true });
  return stdout.trim();
}

async function initialize(): Promise<void> {
  if (backend) return;
  if (initializing) return initializing;
  initializing = (async () => {
    const dir = historyDir();
    await fs.mkdir(dir, { recursive: true });

    const journalPath = join(dir, JOURNAL);
    try {
      await fs.access(journalPath);
    } catch {
      await fs.writeFile(journalPath, '', 'utf8');
    }
    sequence = (await readLines()).length;

    const resolution = await resolveGit();
    if (!resolution) {
      backend = 'journal';
      degradedReason = `${GIT_UNAVAILABLE_REASON}, so entries are appended to the journal file without commits.`;
      return;
    }
    try {
      await run(resolution.path, ['--version'], { windowsHide: true });
    } catch {
      backend = 'journal';
      degradedReason =
        'The resolved copy of git could not be run, so entries are appended to the journal file without commits.';
      return;
    }

    try {
      await fs.access(join(dir, '.git'));
    } catch {
      try {
        await git(['init', '--quiet']);
        await git(['config', 'user.name', 'World Downloader Studio']);
        await git(['config', 'user.email', 'studio@localhost']);
        await git(['config', 'commit.gpgsign', 'false']);
        await fs.writeFile(
          join(dir, README),
          [
            '# Local version history',
            '',
            'This repository is created and maintained by World Downloader Studio.',
            'It is local only: there is no remote and nothing is ever pushed.',
            '',
            'Entries are appended to `journal.jsonl`. History is never rewritten:',
            'restores and prunes are recorded as new commits.',
            ''
          ].join('\n'),
          'utf8'
        );
        await git(['add', '--all']);
        await git(['commit', '--quiet', '-m', 'Initialize local version history']);
      } catch (error) {
        backend = 'journal';
        degradedReason = `The history repository could not be initialized (${describe(error)}), so entries are appended to the journal file without commits.`;
        return;
      }
    }
    backend = 'git';
    degradedReason = undefined;
  })();
  try {
    await initializing;
  } finally {
    initializing = null;
  }
}

export async function status(): Promise<HistoryStatus> {
  await initialize();
  const entries = await readLines();
  const result: HistoryStatus = {
    backend: backend ?? 'journal',
    path: historyDir(),
    entryCount: entries.length
  };
  if (degradedReason) result.degradedReason = degradedReason;
  return result;
}

export async function record(action: string, source: string, payload: unknown): Promise<HistoryEntry> {
  await initialize();
  sequence += 1;
  const entry: HistoryEntry = {
    id: String(sequence).padStart(8, '0'),
    action: String(action).slice(0, 200),
    timestamp: new Date().toISOString(),
    source: String(source).slice(0, 120),
    payload: redact(payload, 0)
  };
  const dir = historyDir();
  await fs.appendFile(join(dir, JOURNAL), `${JSON.stringify(entry)}\n`, 'utf8');
  if (backend === 'git') {
    try {
      await git(['add', '--', JOURNAL]);
      await git(['commit', '--quiet', '-m', `${entry.action} [${entry.id}]`]);
    } catch (error) {
      // The user's actual operation must not fail because a commit did not
      // land. Report the degradation rather than claiming it was recorded.
      degradedReason = `The last entry was appended to the journal but not committed (${describe(error)}).`;
    }
  }
  return entry;
}

export async function list(query: HistoryQuery = {}): Promise<HistoryEntry[]> {
  await initialize();
  const entries = await readEntries();
  const from = query.from ? Date.parse(query.from) : Number.NEGATIVE_INFINITY;
  const to = query.to ? Date.parse(query.to) : Number.POSITIVE_INFINITY;
  const actions = query.actions && query.actions.length > 0 ? new Set(query.actions) : null;
  const text = query.text ? query.text.toLowerCase() : null;

  const filtered = entries.filter((entry) => {
    const at = Date.parse(entry.timestamp);
    if (Number.isFinite(at)) {
      if (at < from || at > to) return false;
    }
    if (actions && !actions.has(entry.action)) return false;
    if (text) {
      const haystack = `${entry.action}\n${entry.source}\n${safeStringify(entry.payload)}`.toLowerCase();
      if (!haystack.includes(text)) return false;
    }
    return true;
  });

  filtered.reverse();
  const limit = typeof query.limit === 'number' && query.limit > 0 ? query.limit : filtered.length;
  return filtered.slice(0, limit);
}

export async function actions(): Promise<Array<{ action: string; count: number }>> {
  await initialize();
  const counts = new Map<string, number>();
  for (const entry of await readEntries()) {
    counts.set(entry.action, (counts.get(entry.action) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([action, count]) => ({ action, count }))
    .sort((a, b) => a.action.localeCompare(b.action));
}

export async function read(id: string): Promise<HistoryEntry | null> {
  await initialize();
  const entries = await readEntries();
  return entries.find((entry) => entry.id === id) ?? null;
}

export async function prune(olderThanIso: string): Promise<{ removed: number }> {
  await initialize();
  const cutoff = Date.parse(olderThanIso);
  if (!Number.isFinite(cutoff)) throw new Error(`"${olderThanIso}" is not a valid ISO-8601 timestamp.`);
  const entries = await readEntries();
  const kept = entries.filter((entry) => {
    const at = Date.parse(entry.timestamp);
    return !Number.isFinite(at) || at >= cutoff;
  });
  const removed = entries.length - kept.length;
  if (removed === 0) return { removed: 0 };
  const dir = historyDir();
  await fs.writeFile(join(dir, JOURNAL), kept.map((entry) => `${JSON.stringify(entry)}\n`).join(''), 'utf8');
  if (backend === 'git') {
    try {
      await git(['add', '--', JOURNAL]);
      await git(['commit', '--quiet', '-m', `Prune ${removed} entries older than ${olderThanIso}`]);
    } catch (error) {
      degradedReason = `Entries were pruned from the journal but the prune was not committed (${describe(error)}).`;
    }
  }
  return { removed };
}

async function readLines(): Promise<string[]> {
  try {
    const raw = await fs.readFile(join(historyDir(), JOURNAL), 'utf8');
    return raw.split('\n').filter((line) => line.trim().length > 0);
  } catch {
    return [];
  }
}

async function readEntries(): Promise<HistoryEntry[]> {
  const out: HistoryEntry[] = [];
  for (const line of await readLines()) {
    try {
      out.push(JSON.parse(line) as HistoryEntry);
    } catch {
      /* one unreadable line must not hide the rest of the history */
    }
  }
  return out;
}

/** Keys whose values never enter the history, whatever a caller passes. */
const SENSITIVE = /(pass(word)?|secret|token|pin|otp|totp|credential|apikey|api_key|authorization|cookie|vocabulary)/i;

function redact(value: unknown, depth: number): unknown {
  if (depth > 8) return '[depth limit]';
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'string' && value.length > 4000) return `${value.slice(0, 4000)}…[truncated]`;
    return value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 500).map((item) => redact(item, depth + 1));
  }
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    out[key] = SENSITIVE.test(key) ? '[redacted]' : redact(item, depth + 1);
  }
  return out;
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value) ?? '';
  } catch {
    return '';
  }
}

function describe(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
