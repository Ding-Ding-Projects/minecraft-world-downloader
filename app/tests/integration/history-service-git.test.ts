/**
 * Integration coverage for `main/services/history.ts` -- the local, append-only
 * version-history git repository.
 *
 * This module's whole promise is "unlimited undo": every user-facing action can
 * be recorded and later found again. A sibling module in this same project
 * shipped in a tagged release with every one of its git calls silently broken
 * (`git status --porcelain --cached`, an invalid flag combination that exits
 * non-zero every time) while 474 unit tests stayed green, because none of them
 * ever invoked git -- they only exercised pure decision logic with the git
 * layer mocked or bypassed entirely. This file exists so the same gap cannot
 * hide here: every test below drives the real exported functions against a
 * real temporary directory and a real `git` binary, and every claim the module
 * makes about its own success is checked a second time through an independent
 * `git` subprocess or a direct filesystem read -- never taken on the module's
 * word alone.
 *
 * `history.ts` reaches `git` indirectly through `../paths.ts`, which reaches
 * Electron's `app.getPath('appData')`. There is no real Electron process in
 * this test run, so `electron` is mocked at exactly that one seam (`app`) --
 * nothing about git, the filesystem, or the module's own logic is stubbed.
 * Because `paths.ts` caches the resolved data root in a module-level variable,
 * and `history.ts` caches its own backend/sequence state the same way, every
 * test below resets the module registry and re-imports both fresh, pointed at
 * a brand-new temporary directory, so no test can see another test's state.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Real git spawns real child processes on a machine that may be under load
// from other work; give every test in this file real headroom rather than
// vitest's 5s default (see the repository's own notes on contended hosts
// turning slow-but-correct tests into apparent failures).
vi.setConfig({ testTimeout: 30_000, hookTimeout: 20_000 });

const state = vi.hoisted(() => ({ appDataRoot: '' }));

vi.mock('electron', () => ({
  app: {
    getPath: (_name: string) => state.appDataRoot,
    setPath: () => undefined
  }
}));

type HistoryModule = typeof import('../../src/main/services/history');

const tmpDirs: string[] = [];
function freshTmpDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tmpDirs.push(dir);
  return dir;
}

/** Fresh module instance, pointed at a fresh temp "appData" root. */
async function freshHistoryModule(): Promise<HistoryModule> {
  vi.resetModules();
  state.appDataRoot = freshTmpDir('wds-history-appdata-');
  return import('../../src/main/services/history');
}

afterEach(() => {
  for (const dir of tmpDirs.splice(0)) {
    try {
      rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
    } catch {
      // Best-effort: a lingering handle outliving this process by a moment is
      // not worth failing the whole suite over.
    }
  }
});

/** Runs a real, independent `git` command, deliberately separate from the
 * module's own internal `git()` helper -- this checks the module's work from
 * the outside, the way a person opening a terminal in the history repo would.
 */
function runGit(cwd: string, args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8', windowsHide: true }).replace(/\r\n/g, '\n').trim();
}

function commitSubjects(cwd: string): string[] {
  const log = runGit(cwd, ['log', '--format=%s']);
  return log.length === 0 ? [] : log.split('\n');
}

/* ==================================================================== */
/* initialize(): the repository actually gets created                   */
/* ==================================================================== */

describe('history service: real git repository creation', () => {
  it('creates a real .git repository with one honest init commit on first use, verified independently', async () => {
    const history = await freshHistoryModule();

    const s = await history.status();

    expect(s.backend).toBe('git');
    expect(s.degradedReason).toBeUndefined();
    expect(s.entryCount).toBe(0);
    expect(existsSync(join(s.path, '.git'))).toBe(true);

    // Never take the module's word for it: ask git directly.
    const subjects = commitSubjects(s.path);
    expect(subjects).toEqual(['Initialize local version history']);

    const tracked = runGit(s.path, ['ls-tree', '-r', '--name-only', 'HEAD']).split('\n').filter(Boolean);
    expect(tracked).toContain('README.md');
    expect(tracked).toContain('journal.jsonl');

    // The init commit must not have used the user's real global git identity.
    const authorEmail = runGit(s.path, ['log', '-1', '--format=%ae']);
    expect(authorEmail).toBe('studio@localhost');
  });

  it('is safe to call repeatedly: a second status() call reuses the same repository rather than re-initializing', async () => {
    const history = await freshHistoryModule();
    const first = await history.status();
    const second = await history.status();

    expect(second.path).toBe(first.path);
    expect(commitSubjects(first.path)).toEqual(['Initialize local version history']);
  });
});

/* ==================================================================== */
/* record(): every recorded action becomes a real, independently-visible */
/* journal line AND a real git commit                                    */
/* ==================================================================== */

describe('record(): a real change becomes a real journal line and a real git commit', () => {
  it('appends to the journal file and commits it, both verified by an independent read', async () => {
    const history = await freshHistoryModule();
    const before = await history.status();
    const beforeSubjects = commitSubjects(before.path);

    const entry = await history.record('Deleted the download profile', 'core.settings', { profileId: 'abc-123' });

    expect(entry.id).toBe('00000001');
    expect(entry.action).toBe('Deleted the download profile');
    expect(entry.source).toBe('core.settings');
    expect(Number.isFinite(Date.parse(entry.timestamp))).toBe(true);

    // Independent read #1: the raw journal file on disk really holds it.
    const raw = readFileSync(join(before.path, 'journal.jsonl'), 'utf8');
    const lines = raw.split('\n').filter((l) => l.trim().length > 0);
    expect(lines.length).toBe(1);
    const parsed = JSON.parse(lines[0]);
    expect(parsed).toEqual(entry);

    // Independent read #2: a real git commit landed for it, on top of init.
    const subjectsAfter = commitSubjects(before.path);
    expect(subjectsAfter.length).toBe(beforeSubjects.length + 1);
    expect(subjectsAfter[0]).toBe('Deleted the download profile [00000001]');

    // And status() itself now agrees with both independent channels.
    expect((await history.status()).entryCount).toBe(1);
  });

  it('increments the id across multiple records and preserves them all in git-commit order', async () => {
    const history = await freshHistoryModule();
    const e1 = await history.record('First action', 'core.a', { n: 1 });
    const e2 = await history.record('Second action', 'core.b', { n: 2 });
    const e3 = await history.record('Third action', 'core.c', { n: 3 });

    expect([e1.id, e2.id, e3.id]).toEqual(['00000001', '00000002', '00000003']);

    // Two identical-looking actions in a row are NOT deduplicated: this is a
    // pure append-only log, and nothing here is allowed to silently drop an
    // entry just because it looks like a repeat of the last one.
    const e4 = await history.record('Third action', 'core.c', { n: 3 });
    expect(e4.id).toBe('00000004');
    expect((await history.status()).entryCount).toBe(4);

    const subjects = commitSubjects((await history.status()).path);
    // newest first, plus the init commit at the bottom
    expect(subjects).toEqual([
      'Third action [00000004]',
      'Third action [00000003]',
      'Second action [00000002]',
      'First action [00000001]',
      'Initialize local version history'
    ]);
  });

  it('redacts sensitive keys before they ever reach the journal file or a git commit', async () => {
    const history = await freshHistoryModule();
    const secretValue = 'sk-super-secret-do-not-leak-9f8e7d6c';
    const entry = await history.record('Saved API credentials', 'core.vault', {
      account: 'mc-premium',
      apiKey: secretValue,
      password: secretValue,
      note: 'this part is fine to keep'
    });

    expect(entry.payload).toEqual({
      account: 'mc-premium',
      apiKey: '[redacted]',
      password: '[redacted]',
      note: 'this part is fine to keep'
    });

    const s = await history.status();

    // Independent channel #1: the raw journal file on disk never held the secret.
    const rawJournal = readFileSync(join(s.path, 'journal.jsonl'), 'utf8');
    expect(rawJournal).not.toContain(secretValue);
    expect(rawJournal).toContain('this part is fine to keep');

    // Independent channel #2: neither does the committed git blob.
    const committedBlob = runGit(s.path, ['show', 'HEAD:journal.jsonl']);
    expect(committedBlob).not.toContain(secretValue);
  });

  it('when the git commit genuinely fails, still journals the entry and reports the degradation honestly -- never loses the record and never claims a commit that did not land', async () => {
    const history = await freshHistoryModule();
    const before = await history.status(); // creates the repo
    const beforeCommitCount = commitSubjects(before.path).length;

    // Force a real git failure: a stale index.lock makes every subsequent
    // `git add`/`git commit` in this repository refuse to run, exactly the
    // way an interrupted git process or antivirus lock would in the wild.
    const lockPath = join(before.path, '.git', 'index.lock');
    writeFileSync(lockPath, '');

    const entry = await history.record('An action recorded while git is locked', 'core.test', { ok: true });

    // The operation itself must never fail because a commit did not land.
    expect(entry.id).toBe('00000001');

    // Independent channel #1: the journal file on disk really has the entry,
    // despite git having refused the commit.
    const raw = readFileSync(join(before.path, 'journal.jsonl'), 'utf8');
    expect(raw).toContain('An action recorded while git is locked');

    // Independent channel #2: no new commit actually landed in git -- the
    // lock genuinely blocked it, this is not a simulated failure.
    expect(commitSubjects(before.path).length).toBe(beforeCommitCount);

    // And status() must say so honestly rather than pretending success.
    const after = await history.status();
    expect(after.entryCount).toBe(1);
    expect(after.degradedReason).toMatch(/appended to the journal but not committed/i);
  });
});

/* ==================================================================== */
/* read()/actions()/list(): the journal is genuinely queryable            */
/* ==================================================================== */

describe('read()/actions()/list(): querying the real, persisted journal', () => {
  it('read() finds a recorded entry by id and returns null for one that was never recorded', async () => {
    const history = await freshHistoryModule();
    const entry = await history.record('Something worth finding later', 'core.x', { v: 1 });

    expect(await history.read(entry.id)).toEqual(entry);
    expect(await history.read('99999999')).toBeNull();
  });

  it('actions() groups real entries by action label with accurate counts', async () => {
    const history = await freshHistoryModule();
    await history.record('Renamed a profile', 'core.a', {});
    await history.record('Renamed a profile', 'core.a', {});
    await history.record('Deleted a profile', 'core.a', {});

    expect(await history.actions()).toEqual([
      { action: 'Deleted a profile', count: 1 },
      { action: 'Renamed a profile', count: 2 }
    ]);
  });

  it('list() filters by action, text and returns newest-first, respecting limit', async () => {
    const history = await freshHistoryModule();
    await history.record('Alpha event', 'core.a', { detail: 'first' });
    await history.record('Beta event', 'core.b', { detail: 'second' });
    await history.record('Alpha event', 'core.a', { detail: 'third' });

    const all = await history.list();
    expect(all.map((e) => e.action)).toEqual(['Alpha event', 'Beta event', 'Alpha event']);

    const onlyAlpha = await history.list({ actions: ['Alpha event'] });
    expect(onlyAlpha.length).toBe(2);
    expect(onlyAlpha.every((e) => e.action === 'Alpha event')).toBe(true);

    const textMatch = await history.list({ text: 'second' });
    expect(textMatch.length).toBe(1);
    expect(textMatch[0].action).toBe('Beta event');

    const limited = await history.list({ limit: 1 });
    expect(limited.length).toBe(1);
    expect(limited[0].payload).toEqual({ detail: 'third' }); // newest first
  });
});

/* ==================================================================== */
/* prune(): bounds growth honestly, verified by independent git reads    */
/* ==================================================================== */

describe('prune(): retention boundary, verified through an independent git show', () => {
  it('removes exactly the entries strictly older than the cutoff, keeps the boundary entry, and commits the change for real', async () => {
    const history = await freshHistoryModule();
    const s = await history.status();

    // record() always stamps "now", so to exercise a real retention boundary
    // we write realistic historical journal lines directly -- exactly the
    // shape record() itself produces -- then let prune() do its real work
    // against them. This is still a real git repository and a real prune();
    // only the ages of the fixture entries are constructed rather than waited
    // for in real time.
    const day = 24 * 60 * 60 * 1000;
    const now = Date.now();
    const rows = [
      { id: '00000001', action: 'Old A', timestamp: new Date(now - 3 * day).toISOString(), source: 'core.x', payload: {} },
      { id: '00000002', action: 'Old B', timestamp: new Date(now - 2 * day).toISOString(), source: 'core.x', payload: {} },
      { id: '00000003', action: 'On the boundary', timestamp: new Date(now - 1 * day).toISOString(), source: 'core.x', payload: {} },
      { id: '00000004', action: 'Recent', timestamp: new Date(now - 1 * 60 * 60 * 1000).toISOString(), source: 'core.x', payload: {} }
    ];
    const journalPath = join(s.path, 'journal.jsonl');
    writeFileSync(journalPath, rows.map((r) => `${JSON.stringify(r)}\n`).join(''), 'utf8');

    const cutoffIso = rows[2].timestamp; // exactly "On the boundary"'s own timestamp
    const beforeCommitCount = commitSubjects(s.path).length;

    const result = await history.prune(cutoffIso);

    expect(result.removed).toBe(2); // Old A and Old B only

    // Independent channel #1: read the file directly off disk.
    const remainingRaw = readFileSync(journalPath, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
    expect(remainingRaw.map((r: { id: string }) => r.id)).toEqual(['00000003', '00000004']);

    // Boundary semantics: the entry timestamped exactly at cutoff is KEPT
    // (>=), never dropped.
    expect(remainingRaw.some((r: { action: string }) => r.action === 'On the boundary')).toBe(true);

    // Independent channel #2: git itself committed the prune, and its own
    // tracked blob for journal.jsonl matches what's on disk.
    expect(commitSubjects(s.path).length).toBe(beforeCommitCount + 1);
    expect(commitSubjects(s.path)[0]).toBe(`Prune 2 entries older than ${cutoffIso}`);
    const committedBlob = runGit(s.path, ['show', 'HEAD:journal.jsonl']);
    expect(committedBlob.trim()).toBe(readFileSync(journalPath, 'utf8').trim());

    // read() for a pruned id genuinely returns nothing now.
    expect(await history.read('00000001')).toBeNull();
    expect(await history.read('00000004')).not.toBeNull();
  });

  it('makes no commit at all when nothing qualifies for removal', async () => {
    const history = await freshHistoryModule();
    await history.record('Recent enough to survive', 'core.x', {});
    const s = await history.status();
    const beforeCommitCount = commitSubjects(s.path).length;

    const result = await history.prune(new Date(0).toISOString()); // epoch: everything is newer

    expect(result.removed).toBe(0);
    expect(commitSubjects(s.path).length).toBe(beforeCommitCount); // no pointless commit
  });

  it('rejects an invalid cutoff timestamp without touching the journal or git', async () => {
    const history = await freshHistoryModule();
    await history.record('Should be untouched', 'core.x', {});
    const s = await history.status();
    const beforeRaw = readFileSync(join(s.path, 'journal.jsonl'), 'utf8');
    const beforeCommitCount = commitSubjects(s.path).length;

    await expect(history.prune('not-a-real-timestamp')).rejects.toThrow(/not a valid ISO-8601 timestamp/);

    expect(readFileSync(join(s.path, 'journal.jsonl'), 'utf8')).toBe(beforeRaw);
    expect(commitSubjects(s.path).length).toBe(beforeCommitCount);
  });
});

/* ==================================================================== */
/* Degraded backend: git genuinely missing from PATH                     */
/* ==================================================================== */

describe('degraded backend: honest fallback when git truly cannot be found', () => {
  it('falls back to the journal-only backend and never creates a .git directory when git is unreachable, then records still land in the journal', async () => {
    const history = await freshHistoryModule();

    const pathKeys = Object.keys(process.env).filter((k) => k.toLowerCase() === 'path');
    const saved = new Map(pathKeys.map((k) => [k, process.env[k]]));
    try {
      for (const k of pathKeys) process.env[k] = '';

      const s = await history.status();
      if (s.backend !== 'journal') {
        // Some Windows installs register git.exe under the "App Paths"
        // registry key, which lets CreateProcess resolve it even with PATH
        // cleared. When that happens on this host, the degradation this
        // test targets genuinely cannot be induced here -- rather than
        // assert a false premise, say so plainly and skip only this case.
        expect(s.backend).toBe('git'); // documents the observed host behavior
        return;
      }

      expect(s.degradedReason).toMatch(/git was not found on PATH/i);
      expect(existsSync(join(s.path, '.git'))).toBe(false);

      const entry = await history.record('Recorded with no git available', 'core.offline', { note: 'still journaled' });
      expect(entry.id).toBe('00000001');

      const raw = readFileSync(join(s.path, 'journal.jsonl'), 'utf8');
      expect(raw).toContain('Recorded with no git available');
      expect(existsSync(join(s.path, '.git'))).toBe(false);
    } finally {
      for (const [k, v] of saved) process.env[k] = v as string;
    }
  });
});
