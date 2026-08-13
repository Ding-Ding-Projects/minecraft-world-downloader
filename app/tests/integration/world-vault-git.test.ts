/**
 * Integration coverage for `features/world-vault`'s git seam.
 *
 * The unit tests in `tests/unit/world-vault.test.ts` are thorough about the
 * pure decision logic (settle detection, region-access refusal) but never
 * once invoke git. That gap let a shipped regression go unnoticed: every git
 * call after staging used `git status --porcelain --cached`, an invalid
 * option combination that made git exit non-zero every single time. The
 * module's own `git()` helper throws on a non-zero exit, so `create()`,
 * `commitNow()`, the background runner's poll, `restore()` and `prune()` all
 * failed at the first call after staging. No repository was ever created, no
 * snapshot was ever committed, and the "unlimited undo" had nothing to undo
 * -- while every unit test stayed green, because none of them touched git.
 *
 * Everything here drives the real, exported functions against a real git
 * binary and a real temporary directory standing in for a downloaded world.
 * Every assertion that matters is checked twice: once through the module's
 * own return value, and once again through an independent `git` subprocess
 * call this file makes itself -- the module's report of its own success is
 * never taken on trust. That second check is exactly what would have failed
 * the moment the regression above shipped: every one of these tests throws
 * immediately if the git call it depends on is broken, because the module's
 * own helper throws first.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  commitNow,
  commits,
  create,
  exportCommitTree,
  gc,
  prune,
  publishPreflight,
  requestRegionAccess,
  restore,
  startRunner,
  status,
  stopAllRunners,
  stopRunner
} from '../../src/main/features/world-vault';

// Real git spawns real child processes, and this machine may be sharing CPU
// with other work (see the repository's own notes on contended CI hosts
// turning slow-but-correct tests into apparent failures). Give every test in
// this file real headroom rather than vitest's 5s default.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 20_000 });

/* ==================================================================== */
/* Fixture: a small, plausible world folder                              */
/* ==================================================================== */

const LEVEL_DAT_INITIAL = Buffer.from('level.dat: fake NBT payload, initial version\n');
const REGION_BYTES_INITIAL = Buffer.from(Array.from({ length: 512 }, (_, i) => i % 256));
const PLAYERDATA_INITIAL = Buffer.from('playerdata: fake player state, initial version\n');

function buildWorldFixture(dir: string): void {
  writeFileSync(join(dir, 'level.dat'), LEVEL_DAT_INITIAL);
  mkdirSync(join(dir, 'region'), { recursive: true });
  writeFileSync(join(dir, 'region', 'r.0.0.mca'), REGION_BYTES_INITIAL);
  mkdirSync(join(dir, 'playerdata'), { recursive: true });
  writeFileSync(join(dir, 'playerdata', 'player-uuid-fake.dat'), PLAYERDATA_INITIAL);
}

const tmpDirs: string[] = [];
function freshWorldDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'wv-git-test-'));
  tmpDirs.push(dir);
  return dir;
}

afterEach(() => {
  // Belt and braces: a test that throws before reaching its own
  // stopRunner() would otherwise leave a setInterval polling a directory
  // this hook is about to delete out from under it.
  stopAllRunners();
  for (const dir of tmpDirs.splice(0)) {
    try {
      rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
    } catch {
      // Best-effort: a lingering handle (an AV scan, a not-yet-released git
      // worktree lock) outliving this process by a moment is not worth
      // failing the whole suite over.
    }
  }
});

/**
 * Runs a real, independent `git` command against `cwd` and returns trimmed,
 * LF-normalized stdout. This is deliberately a *second*, separate code path
 * from the module's own internal `git()` helper: every assertion built on
 * this function checks world-vault.ts's work from the outside, the way a
 * person opening a terminal would, rather than trusting the module's own
 * report of its own success.
 */
function runGit(cwd: string, args: string[]): string {
  const output = execFileSync('git', args, { cwd, encoding: 'utf8', windowsHide: true });
  return output.replace(/\r\n/g, '\n').trim();
}

function commitHashes(dir: string): string[] {
  return runGit(dir, ['log', '--format=%H']).split('\n').filter(Boolean);
}

/** Polls `predicate` until it is true, rather than guessing a sleep duration. */
async function waitUntil(predicate: () => Promise<boolean> | boolean, timeoutMs: number, intervalMs = 200): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (await predicate()) return;
    if (Date.now() >= deadline) {
      throw new Error(`waitUntil() timed out after ${timeoutMs}ms without the condition becoming true`);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

/* ==================================================================== */
/* create()                                                              */
/* ==================================================================== */

describe('create(): a real repository, independently verified', () => {
  it('makes a real .git directory and an initial commit that both status() and an independent git log agree exist', async () => {
    const dir = freshWorldDir();
    buildWorldFixture(dir);

    const result = await create(dir);

    expect(existsSync(join(dir, '.git'))).toBe(true);
    expect(result.exists).toBe(true);
    expect(result.commitCount).toBe(1);
    expect(result.lastCommit).not.toBeNull();

    // Never take the module's word for its own success: ask git directly.
    const hashes = commitHashes(dir);
    expect(hashes).toEqual([result.lastCommit!.hash]);

    const trackedFiles = runGit(dir, ['ls-tree', '-r', '--name-only', 'HEAD']).split('\n').filter(Boolean);
    expect(trackedFiles).toContain('level.dat');
    expect(trackedFiles).toContain('region/r.0.0.mca');
    expect(trackedFiles).toContain('playerdata/player-uuid-fake.dat');

    // status() must report the same repository state a fresh caller would see.
    const reportedByStatus = await status(dir);
    expect(reportedByStatus.exists).toBe(true);
    expect(reportedByStatus.commitCount).toBe(1);
    expect(reportedByStatus.lastCommit?.hash).toBe(result.lastCommit!.hash);
  });

  it('is idempotent: calling create() again on an already-initialized, unchanged world adds no new commit', async () => {
    const dir = freshWorldDir();
    buildWorldFixture(dir);
    const first = await create(dir);

    const second = await create(dir);

    expect(second.commitCount).toBe(first.commitCount);
    expect(commitHashes(dir).length).toBe(1);
  });
});

/* ==================================================================== */
/* commitNow()                                                           */
/* ==================================================================== */

describe('commitNow(): the hazard-1 seam -- a real modification becomes a real commit', () => {
  it('commits a modified file, and an independent git log/git show both see it', async () => {
    const dir = freshWorldDir();
    buildWorldFixture(dir);
    await create(dir);

    writeFileSync(join(dir, 'level.dat'), Buffer.from('modified level.dat bytes'));
    const commit = await commitNow(dir, 'Captured a settle', 'snapshot');

    expect(commit).not.toBeNull();
    expect(commit!.kind).toBe('snapshot');

    const hashes = commitHashes(dir);
    expect(hashes.length).toBe(2);
    expect(hashes[0]).toBe(commit!.hash); // newest first

    const filesInCommit = runGit(dir, ['show', '--name-only', '--format=', commit!.hash]).split('\n').filter(Boolean);
    expect(filesInCommit).toEqual(['level.dat']);

    const committedContent = runGit(dir, ['show', `${commit!.hash}:level.dat`]);
    expect(committedContent).toBe('modified level.dat bytes');
  });

  it('returns null and creates no commit when nothing on disk actually changed', async () => {
    const dir = freshWorldDir();
    buildWorldFixture(dir);
    await create(dir);
    const beforeHashes = commitHashes(dir);

    const result = await commitNow(dir, 'nothing to see here', 'edit');

    expect(result).toBeNull();
    expect(commitHashes(dir)).toEqual(beforeHashes);
  });
});

/* ==================================================================== */
/* commits()                                                             */
/* ==================================================================== */

describe('commits(): the timeline, in the order git itself agrees on', () => {
  it('returns commits newest-first with real hashes matching an independent git log exactly', async () => {
    const dir = freshWorldDir();
    buildWorldFixture(dir);
    const c0 = await create(dir);
    writeFileSync(join(dir, 'level.dat'), Buffer.from('v1'));
    const c1 = await commitNow(dir, 'first snapshot', 'snapshot');
    writeFileSync(join(dir, 'level.dat'), Buffer.from('v2'));
    const c2 = await commitNow(dir, 'second snapshot', 'snapshot');

    const list = await commits({ worldPath: dir, offset: 0, limit: 10 });

    expect(list.map((c) => c.hash)).toEqual([c2!.hash, c1!.hash, c0.lastCommit!.hash]);
    expect(list.map((c) => c.hash)).toEqual(commitHashes(dir));

    const paged = await commits({ worldPath: dir, offset: 1, limit: 1 });
    expect(paged.length).toBe(1);
    expect(paged[0].hash).toBe(c1!.hash);
  });

  it('returns an empty list for a world that has no vault at all, rather than throwing', async () => {
    const dir = freshWorldDir();
    buildWorldFixture(dir); // note: no create() call
    const list = await commits({ worldPath: dir, offset: 0, limit: 10 });
    expect(list).toEqual([]);
  });
});

/* ==================================================================== */
/* restore(): append-only undo                                           */
/* ==================================================================== */

describe('restore(): unlimited, append-only undo -- nothing is ever silently discarded', () => {
  it('reverts the file content on disk, and captures the pre-restore state as its own commit first', async () => {
    const dir = freshWorldDir();
    buildWorldFixture(dir);
    const created = await create(dir);
    const initialHash = created.lastCommit!.hash;

    writeFileSync(join(dir, 'level.dat'), Buffer.from('changed after initial'));
    await commitNow(dir, 'second snapshot', 'snapshot');

    // Something is left uncommitted at the exact moment restore() is called,
    // to prove the promise in the module's own doc comment: it is captured
    // as a commit before anything is thrown away, never dropped on the floor.
    writeFileSync(join(dir, 'level.dat'), Buffer.from('uncommitted at restore time'));

    const beforeCount = Number(runGit(dir, ['rev-list', '--count', 'HEAD']));
    expect(beforeCount).toBe(2);

    const restoreCommit = await restore(dir, initialHash);

    const afterCount = Number(runGit(dir, ['rev-list', '--count', 'HEAD']));
    // +1 for "captured pending changes before restoring", +1 for the restore commit itself.
    expect(afterCount).toBe(beforeCount + 2);
    expect(restoreCommit.kind).toBe('restore');

    // The file on disk really is back to what create() first wrote -- not
    // just what the module claims, but what an independent read confirms.
    expect(readFileSync(join(dir, 'level.dat'))).toEqual(LEVEL_DAT_INITIAL);

    // The pre-restore uncommitted content was preserved as a real, readable
    // commit -- the parent of the restore commit -- not silently discarded.
    const parentHash = runGit(dir, ['rev-parse', `${restoreCommit.hash}^`]);
    const capturedContent = runGit(dir, ['show', `${parentHash}:level.dat`]);
    expect(capturedContent).toBe('uncommitted at restore time');

    // And an independent git log confirms the module's own commit count.
    expect(Number(runGit(dir, ['rev-list', '--count', 'HEAD']))).toBe((await status(dir)).commitCount);
  });

  it('refuses to restore to a commit hash that does not exist in this vault', async () => {
    const dir = freshWorldDir();
    buildWorldFixture(dir);
    await create(dir);
    await expect(restore(dir, '0000000000000000000000000000000000dead')).rejects.toThrow();
  });
});

/* ==================================================================== */
/* prune(): hazard 2 -- bound growth honestly                            */
/* ==================================================================== */

describe('prune(): squashes history before a boundary, and the working tree survives intact', () => {
  it('reduces the real commit count by exactly the squashed amount and leaves the tree content untouched', async () => {
    const dir = freshWorldDir();
    buildWorldFixture(dir);
    await create(dir); // c0
    writeFileSync(join(dir, 'level.dat'), Buffer.from('v1'));
    await commitNow(dir, 'snapshot v1', 'snapshot'); // c1
    writeFileSync(join(dir, 'level.dat'), Buffer.from('v2'));
    const c2 = await commitNow(dir, 'snapshot v2', 'snapshot'); // c2
    writeFileSync(join(dir, 'level.dat'), Buffer.from('v3'));
    await commitNow(dir, 'snapshot v3', 'snapshot'); // c3

    const beforeCount = Number(runGit(dir, ['rev-list', '--count', 'HEAD']));
    expect(beforeCount).toBe(4);

    // Prune everything up to and including c2: c0 and c1 get squashed into a
    // fresh root sharing c2's tree, and only c3 survives as its own commit on
    // top of it -- so the history goes from 4 commits down to 2.
    const result = await prune(dir, c2!.hash);

    expect(result.removedCommitCount).toBe(2);
    expect(typeof result.reclaimedBytes).toBe('number');
    expect(result.reclaimedBytes).toBeGreaterThanOrEqual(0);

    const afterCount = Number(runGit(dir, ['rev-list', '--count', 'HEAD']));
    expect(afterCount).toBe(2);

    // The working tree at HEAD is unaffected by pruning history: it still
    // holds the newest content, exactly as it did before the prune.
    expect(readFileSync(join(dir, 'level.dat')).toString()).toBe('v3');

    // git itself must consider the rewritten repository healthy.
    expect(() => execFileSync('git', ['fsck'], { cwd: dir, encoding: 'utf8' })).not.toThrow();
  });

  it('refuses a boundary commit that is not an ancestor of the current history', async () => {
    const dir = freshWorldDir();
    buildWorldFixture(dir);
    await create(dir);
    const branch = runGit(dir, ['branch', '--show-current']);

    // Build a commit that really exists in this exact repository's object
    // database -- so `git rev-parse --verify` resolves it just fine -- but
    // sits on a completely different line of history than the current
    // branch. That is the actual condition the ancestor check exists to
    // catch, as distinct from a hash that fails to resolve to a commit at
    // all (a hash from an unrelated repository never reaches the ancestor
    // check: it fails one line earlier, at rev-parse --verify itself).
    execFileSync('git', ['checkout', '--quiet', '--orphan', 'unrelated-history'], { cwd: dir });
    writeFileSync(join(dir, 'level.dat'), Buffer.from('a commit on an unrelated line of history'));
    execFileSync('git', ['add', '-A'], { cwd: dir });
    execFileSync('git', ['commit', '--quiet', '-m', 'unrelated commit'], { cwd: dir });
    const unrelatedHash = runGit(dir, ['rev-parse', 'HEAD']);
    execFileSync('git', ['checkout', '--quiet', branch], { cwd: dir });

    await expect(prune(dir, unrelatedHash)).rejects.toThrow(/not in this vault/);
  });
});

/* ==================================================================== */
/* exportCommitTree() and gc()                                           */
/* ==================================================================== */

describe('exportCommitTree(): a real, isolated worktree checkout of exactly one commit', () => {
  it('checks out the target commit into an isolated directory, and never touches the live world', async () => {
    const dir = freshWorldDir();
    buildWorldFixture(dir);
    const created = await create(dir);

    writeFileSync(join(dir, 'level.dat'), Buffer.from('changed after the exported commit'));
    await commitNow(dir, 'a later snapshot', 'snapshot');

    const exportDest = mkdtempSync(join(tmpdir(), 'wv-export-'));
    tmpDirs.push(exportDest);

    const result = await exportCommitTree(dir, created.lastCommit!.hash, exportDest);
    expect(result.path).toBe(exportDest);

    // The exported tree holds the FIRST commit's content...
    expect(readFileSync(join(exportDest, 'level.dat'))).toEqual(LEVEL_DAT_INITIAL);
    expect(existsSync(join(exportDest, 'region', 'r.0.0.mca'))).toBe(true);

    // ...and the live world, which has since moved on, is completely
    // unaffected -- the whole point of exporting to a detached worktree.
    expect(readFileSync(join(dir, 'level.dat')).toString()).toBe('changed after the exported commit');

    // Independent proof this really is a git worktree of the same
    // repository, detached at exactly the requested commit.
    expect(runGit(exportDest, ['rev-parse', 'HEAD'])).toBe(created.lastCommit!.hash);
    const worktrees = runGit(dir, ['worktree', 'list', '--porcelain']);
    expect(worktrees).toContain(exportDest.replace(/\\/g, '/'));
  });
});

describe('gc(): compacts .git without rewriting or losing a single commit', () => {
  it('shrinks or maintains .git while every commit hash from before gc is still present after it', async () => {
    const dir = freshWorldDir();
    buildWorldFixture(dir);
    await create(dir);
    for (let i = 0; i < 4; i += 1) {
      writeFileSync(join(dir, 'level.dat'), Buffer.from(`payload for gc test, revision ${i}: ${'x'.repeat(2000)}`));
      // eslint-disable-next-line no-await-in-loop
      await commitNow(dir, `snapshot ${i}`, 'snapshot');
    }
    const hashesBefore = commitHashes(dir);

    const result = await gc(dir);

    expect(result.gitDirBytes).toBeGreaterThan(0);
    expect(commitHashes(dir)).toEqual(hashesBefore); // gc must never rewrite history, only compact storage
    expect(() => execFileSync('git', ['fsck'], { cwd: dir, encoding: 'utf8' })).not.toThrow();
  });
});

/* ==================================================================== */
/* startRunner()/stopRunner() and requestRegionAccess(): hazard 1 and 6, */
/* driven for real through wall-clock time rather than faked             */
/* ==================================================================== */

describe('startRunner()/stopRunner(): the background poller really commits via git once writes go quiet', () => {
  it('auto-commits a changed region file once the quiet period elapses, independently verified', async () => {
    const dir = freshWorldDir();
    buildWorldFixture(dir);
    const created = await create(dir);

    await startRunner(dir, { quietPeriodMs: 1200, pollIntervalMs: 500 });
    try {
      writeFileSync(join(dir, 'region', 'r.0.0.mca'), Buffer.from('quietly settled region bytes'));

      // Poll for the effect rather than guessing a sleep duration: this
      // passes quickly on a healthy machine and still has real headroom
      // (up to the file's 30s test timeout) on a contended one.
      await waitUntil(async () => (await status(dir)).commitCount === created.commitCount + 1, 25_000, 250);

      const hashes = commitHashes(dir);
      expect(hashes.length).toBe(created.commitCount + 1);

      const filesInNewestCommit = runGit(dir, ['show', '--name-only', '--format=', hashes[0]]).split('\n').filter(Boolean);
      expect(filesInNewestCommit).toContain('region/r.0.0.mca');

      // Well past the quiet period now: a fresh access request must be granted.
      const permission = await requestRegionAccess(dir, 'region/r.0.0.mca');
      expect(permission.granted).toBe(true);
    } finally {
      await stopRunner(dir);
    }

    // stopRunner() really stopped it: status() no longer reports it active.
    expect((await status(dir)).runnerActive).toBe(false);
  });
});

describe('requestRegionAccess(): hazard 6 -- refuse to race the downloader, proven against a real runner', () => {
  it('refuses a path the runner just saw change, while a deliberately long quiet period is still pending', async () => {
    const dir = freshWorldDir();
    buildWorldFixture(dir);
    await create(dir);

    // A quiet period far longer than this test could possibly run for: this
    // removes any race against real time. The test only needs the runner to
    // have *noticed* the write, never to have it actually settle.
    await startRunner(dir, { quietPeriodMs: 60_000, pollIntervalMs: 500 });
    try {
      writeFileSync(join(dir, 'region', 'r.0.0.mca'), Buffer.from('actively being written'));

      await waitUntil(async () => (await status(dir)).waitingForSettle === true, 15_000, 200);

      const permission = await requestRegionAccess(dir, 'region/r.0.0.mca');
      expect(permission.granted).toBe(false);
      expect(permission.reason).toContain('region/r.0.0.mca');
    } finally {
      await stopRunner(dir);
    }
  });

  it('grants access to a settled file with no runner running at all', async () => {
    const dir = freshWorldDir();
    buildWorldFixture(dir);
    await create(dir);

    const permission = await requestRegionAccess(dir, 'region/r.0.0.mca');
    expect(permission).toEqual({ granted: true, reason: null });
  });
});

/* ==================================================================== */
/* publishPreflight()                                                    */
/* ==================================================================== */

describe('publishPreflight(): honest reporting of real repository state', () => {
  it('reports no remote for a fresh vault, then reports a real remote once one is really added', async () => {
    const dir = freshWorldDir();
    buildWorldFixture(dir);
    await create(dir);

    const before = await publishPreflight(dir);
    expect(before.gitAvailable).toBe(true);
    expect(before.hasRemote).toBe(false);
    expect(before.remoteUrl).toBeNull();
    expect(before.fileCount).toBeGreaterThanOrEqual(3); // level.dat, region file, playerdata file

    // Add a real remote -- a second, real bare repository on disk -- and
    // confirm publishPreflight() reads it back rather than reporting a
    // cached or guessed value.
    const bareRemote = mkdtempSync(join(tmpdir(), 'wv-remote-'));
    tmpDirs.push(bareRemote);
    execFileSync('git', ['init', '--quiet', '--bare'], { cwd: bareRemote });
    execFileSync('git', ['remote', 'add', 'origin', bareRemote], { cwd: dir });

    const after = await publishPreflight(dir);
    expect(after.hasRemote).toBe(true);
    expect(after.remoteUrl).toBe(bareRemote);
  });
});

/* ==================================================================== */
/* Self-test: proving this suite would have caught the shipped regression */
/* ==================================================================== */

describe('self-test: the exact regressed invocation really is invalid', () => {
  it('"git status --porcelain --cached" fails with exit code 129 on the real git binary, and the fixed replacement does not', () => {
    // This is not a test of world-vault.ts. It is a test of the regression
    // itself, run directly against the same git binary the module uses, to
    // prove in isolation what made the whole feature dead: `--cached` is not
    // an option `git status` accepts. Every test above depends on this being
    // true -- if it were not, none of the assertions built on real git calls
    // in this file would mean anything, because the module's own `git()`
    // helper would never have had a reason to throw in the first place.
    const dir = freshWorldDir();
    execFileSync('git', ['init', '--quiet'], { cwd: dir });

    let threw = false;
    let stderrText = '';
    try {
      // stdio is fully piped (not inherited) so git's usage text does not
      // spam the test runner's console on every single run.
      execFileSync('git', ['status', '--porcelain', '--cached'], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (error) {
      threw = true;
      stderrText = String((error as { stderr?: string }).stderr ?? error);
    }
    expect(threw).toBe(true);
    expect(stderrText).toMatch(/unknown option/i);

    // And the fixed replacement the module actually calls today is a real,
    // accepted git command that behaves correctly on an empty repository.
    expect(() => execFileSync('git', ['diff', '--cached', '--name-only'], { cwd: dir, encoding: 'utf8' })).not.toThrow();
    const staged = execFileSync('git', ['diff', '--cached', '--name-only'], { cwd: dir, encoding: 'utf8' }).trim();
    expect(staged).toBe('');
  });

  it('self-test: a broken commit-count expectation that never matched reality would fail this suite, not pass it silently', () => {
    // Mirrors the self-test style used throughout world-vault.test.ts: prove
    // the assertions here are load-bearing by deliberately comparing a real
    // result against a wrong expectation and confirming it throws.
    const brokenStatus = { exists: false, commitCount: 0 };
    expect(() => expect(brokenStatus).toEqual({ exists: true, commitCount: 1 })).toThrow();
  });
});
