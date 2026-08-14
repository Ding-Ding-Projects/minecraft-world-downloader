/**
 * Integration coverage for the publishing trio in `features/world-vault`:
 * `setRemote`, `push`, `publishPreflight`, and the guard clauses of
 * `createGithubRepo`.
 *
 * These are the operations that send a user's world OFF their machine, which
 * makes them the ones most worth proving -- and, before this file, they were
 * fully wired to the renderer UI (`features/world-vault/panel.ts`) and had
 * zero test coverage of their own. `world-vault-git.test.ts` already proved
 * the shipped-regression shape (a broken `git()` call silently killing the
 * whole feature while every unit test stayed green because none of them
 * touched git); this file extends that same discipline to the three
 * publish-flow functions that file never reached.
 *
 * Everything here drives the real, exported functions against a real git
 * binary and real temporary directories -- a real local *bare* repository
 * standing in for "a remote", so nothing ever touches the network or a real
 * GitHub account. Every assertion that matters is checked twice: once
 * through the module's own return value, and once again through an
 * independent `git` subprocess call this file makes itself, so the module's
 * report of its own success is never taken on trust.
 *
 * `createGithubRepo` is the one function this file deliberately does NOT
 * exercise past its guard clauses. Doing so for real would either fail
 * because the `gh` CLI is not installed/authenticated on the machine running
 * the suite, or -- worse, if it happened to be authenticated -- would
 * actually create a real repository on a real GitHub account. Neither is
 * acceptable in an automated test. The three guard clauses tested below
 * (empty name, invalid characters, no vault yet) are all provably reached
 * and returned from *before* the function ever calls `ghAvailable()` or
 * `ghAuthState()`, so exercising them touches no CLI and no network -- see
 * the self-test at the bottom of this file, which proves that ordering
 * directly against the module's source rather than merely asserting it in a
 * comment. Everything from `ghAvailable()` onward, and the actual
 * `gh repo create ... --push` network call in particular, remains unproven
 * by this suite; that is stated plainly rather than silently assumed.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  commitNow,
  create,
  createGithubRepo,
  publishPreflight,
  push,
  setRemote
} from '../../src/main/features/world-vault';

// Real git spawns real child processes, and this machine may be sharing CPU
// with other work. Give every test in this file real headroom rather than
// vitest's 5s default (see the repository's own notes on contended hosts
// turning slow-but-correct tests into apparent failures).
vi.setConfig({ testTimeout: 30_000, hookTimeout: 20_000 });

const HERE = dirname(fileURLToPath(import.meta.url));
const WORLD_VAULT_SOURCE_PATH = join(HERE, '..', '..', 'src', 'main', 'features', 'world-vault.ts');

/* ==================================================================== */
/* Fixtures                                                              */
/* ==================================================================== */

const LEVEL_DAT_INITIAL = Buffer.from('level.dat: fake NBT payload, initial version\n');
const REGION_BYTES_INITIAL = Buffer.from(Array.from({ length: 512 }, (_, i) => i % 256));

function buildWorldFixture(dir: string): void {
  writeFileSync(join(dir, 'level.dat'), LEVEL_DAT_INITIAL);
  mkdirSync(join(dir, 'region'), { recursive: true });
  writeFileSync(join(dir, 'region', 'r.0.0.mca'), REGION_BYTES_INITIAL);
}

const tmpDirs: string[] = [];
function freshDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tmpDirs.push(dir);
  return dir;
}

/** A real, local, bare repository -- a legitimate git remote with no network involved. */
function freshBareRemote(): string {
  const dir = freshDir('wv-publish-bare-');
  execFileSync('git', ['init', '--quiet', '--bare'], { cwd: dir });
  return dir;
}

afterEach(() => {
  for (const dir of tmpDirs.splice(0)) {
    try {
      rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
    } catch {
      // Best-effort: a lingering handle outliving this process by a moment
      // is not worth failing the whole suite over.
    }
  }
});

/**
 * Runs a real, independent `git` command and returns trimmed, LF-normalized
 * stdout. Deliberately a *separate* code path from the module's own internal
 * `git()` helper: every assertion built on this checks world-vault.ts's work
 * from the outside, the way a person opening a terminal would.
 */
function runGit(cwd: string, args: string[]): string {
  const output = execFileSync('git', args, { cwd, encoding: 'utf8', windowsHide: true });
  return output.replace(/\r\n/g, '\n').trim();
}

/** Reads a real ref's hash out of a repository's git-dir directly (works for bare repos too). */
function readRefHash(gitDir: string, ref: string): string {
  return execFileSync('git', ['--git-dir', gitDir, 'rev-parse', ref], { encoding: 'utf8', windowsHide: true })
    .replace(/\r\n/g, '\n')
    .trim();
}

function countFilesExcludingGit(root: string): number {
  let count = 0;
  function walk(dir: string): void {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (entry.name === '.git') continue;
        walk(join(dir, entry.name));
      } else if (entry.isFile()) {
        count += 1;
      }
    }
  }
  walk(root);
  return count;
}

function sumBytesIncludingGit(root: string): number {
  let total = 0;
  function walk(dir: string): void {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        total += statSync(full).size;
      }
    }
  }
  walk(root);
  return total;
}

/* ==================================================================== */
/* setRemote(): a real remote URL, stored and read back independently    */
/* ==================================================================== */

describe('setRemote(): stores a real remote and reports it back honestly', () => {
  it('adds an origin remote where none existed, readable both through the module and through independent git', async () => {
    const dir = freshDir('wv-publish-world-');
    buildWorldFixture(dir);
    await create(dir);
    const bareRemote = freshBareRemote();

    await setRemote(dir, bareRemote);

    // Independent check: ask git itself, not the module.
    expect(runGit(dir, ['remote', 'get-url', 'origin'])).toBe(bareRemote);
    // And the module's own read-back agrees with that independent check.
    const preflight = await publishPreflight(dir);
    expect(preflight.hasRemote).toBe(true);
    expect(preflight.remoteUrl).toBe(bareRemote);
  });

  it('overwrites an existing remote rather than erroring or leaving a stale duplicate', async () => {
    const dir = freshDir('wv-publish-world-');
    buildWorldFixture(dir);
    await create(dir);
    const firstRemote = freshBareRemote();
    const secondRemote = freshBareRemote();

    await setRemote(dir, firstRemote);
    await setRemote(dir, secondRemote);

    // Exactly one "origin" remote exists, and it points at the second URL --
    // never the first, and never both.
    const remoteNames = runGit(dir, ['remote']).split('\n').filter(Boolean);
    expect(remoteNames).toEqual(['origin']);
    expect(runGit(dir, ['remote', 'get-url', 'origin'])).toBe(secondRemote);
    expect((await publishPreflight(dir)).remoteUrl).toBe(secondRemote);
  });

  it('refuses an empty or whitespace-only URL, and creates no remote as a result', async () => {
    const dir = freshDir('wv-publish-world-');
    buildWorldFixture(dir);
    await create(dir);

    await expect(setRemote(dir, '')).rejects.toThrow(/no remote url was given/i);
    await expect(setRemote(dir, '   ')).rejects.toThrow(/no remote url was given/i);

    // The refusal really did refuse: no "origin" remote was created by either call.
    expect(runGit(dir, ['remote']).trim()).toBe('');
    expect((await publishPreflight(dir)).hasRemote).toBe(false);
  });

  it('refuses an invalid URL without disturbing an existing valid remote', async () => {
    const dir = freshDir('wv-publish-world-');
    buildWorldFixture(dir);
    await create(dir);
    const goodRemote = freshBareRemote();
    await setRemote(dir, goodRemote);

    await expect(setRemote(dir, '')).rejects.toThrow();

    // The rejected call must not have touched the remote that was already set.
    expect(runGit(dir, ['remote', 'get-url', 'origin'])).toBe(goodRemote);
  });
});

/* ==================================================================== */
/* push(): a real push to a real local bare remote, and honest failure   */
/* ==================================================================== */

describe('push(): really moves commits to a real remote, and never claims success it did not earn', () => {
  it('pushes the current branch to a real bare remote, verified by reading the bare repository directly', async () => {
    const dir = freshDir('wv-publish-world-');
    buildWorldFixture(dir);
    const created = await create(dir);
    const bareRemote = freshBareRemote();
    await setRemote(dir, bareRemote);

    // A second commit, so the pushed history is more than just the initial one.
    writeFileSync(join(dir, 'level.dat'), Buffer.from('changed before publishing'));
    const secondCommit = await commitNow(dir, 'a second snapshot before publishing', 'snapshot');
    expect(secondCommit).not.toBeNull();

    const branch = runGit(dir, ['branch', '--show-current']);
    const result = await push(dir);

    expect(typeof result.output).toBe('string');

    // Independent proof: read the bare remote's own ref directly, through a
    // completely separate `git` invocation this file makes itself, rather
    // than trusting push()'s own return value.
    expect(readRefHash(bareRemote, branch)).toBe(secondCommit!.hash);
    // The remote's log holds both commits, in the same order the local repo does.
    const remoteHashes = execFileSync('git', ['--git-dir', bareRemote, 'log', '--format=%H', branch], {
      encoding: 'utf8',
      windowsHide: true
    })
      .replace(/\r\n/g, '\n')
      .trim()
      .split('\n');
    expect(remoteHashes).toEqual([secondCommit!.hash, created.lastCommit!.hash]);
  });

  it('reports a failed push honestly -- rejecting rather than resolving -- when the configured remote does not exist', async () => {
    const dir = freshDir('wv-publish-world-');
    buildWorldFixture(dir);
    await create(dir);
    // Deliberately never call setRemote(): "origin" genuinely does not exist.
    expect(runGit(dir, ['remote']).trim()).toBe('');

    await expect(push(dir)).rejects.toThrow(/git push failed/i);

    // The failure really is a rejection, not a disguised success: nothing
    // that looks like a remote sprang into existence as a side effect, and
    // the local repository's own history is completely untouched by the
    // attempt.
    expect(runGit(dir, ['remote']).trim()).toBe('');
    expect(Number(runGit(dir, ['rev-list', '--count', 'HEAD']))).toBe(1);
  });

  it('reports a failed push honestly when the remote URL points at a location that is not a git repository at all', async () => {
    const dir = freshDir('wv-publish-world-');
    buildWorldFixture(dir);
    await create(dir);
    const notARepo = freshDir('wv-publish-not-a-repo-');
    // notARepo exists on disk but was never `git init`-ed -- a real path,
    // but not a valid push target, which is the honest-failure case a stale
    // or mistyped remote URL would produce.
    await setRemote(dir, notARepo);

    await expect(push(dir)).rejects.toThrow(/git push failed/i);

    // The bogus "remote" directory was never turned into a repository as a
    // side effect of the failed attempt.
    expect(() => execFileSync('git', ['rev-parse', '--git-dir'], { cwd: notARepo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })).toThrow();
  });
});

/* ==================================================================== */
/* publishPreflight(): the numbers match what is actually on disk        */
/* ==================================================================== */

describe('publishPreflight(): the reported numbers match reality, not a guess', () => {
  it('reports a fileCount and worldSizeBytes that agree with an independent filesystem walk', async () => {
    const dir = freshDir('wv-publish-world-');
    buildWorldFixture(dir);
    await create(dir);

    const preflight = await publishPreflight(dir);

    // fileCount: walk the real tree ourselves, excluding .git exactly as the
    // module documents it does, and compare against the module's own count.
    const independentFileCount = countFilesExcludingGit(dir);
    expect(preflight.fileCount).toBe(independentFileCount);
    expect(preflight.fileCount).toBeGreaterThanOrEqual(2); // level.dat + the region file, at minimum

    // worldSizeBytes: sum every real file under the world folder, including
    // .git (the module's own dirSizeBytes() walk does not special-case it),
    // and require the two totals to agree exactly rather than approximately.
    const independentTotalBytes = sumBytesIncludingGit(dir);
    expect(preflight.worldSizeBytes).toBe(independentTotalBytes);
    expect(preflight.worldSizeBytes).toBeGreaterThan(0);
  });

  it('reports gitAvailable truthfully by agreeing with an independent `git --version` probe', async () => {
    const dir = freshDir('wv-publish-world-');
    buildWorldFixture(dir);
    await create(dir);

    const preflight = await publishPreflight(dir);

    let gitReallyAvailable = true;
    try {
      execFileSync('git', ['--version'], { stdio: ['ignore', 'pipe', 'pipe'] });
    } catch {
      gitReallyAvailable = false;
    }
    expect(preflight.gitAvailable).toBe(gitReallyAvailable);
  });
});

/* ==================================================================== */
/* createGithubRepo(): guard clauses only -- see the header comment for  */
/* exactly why this file never calls past them                          */
/* ==================================================================== */

describe('createGithubRepo(): its local guard clauses refuse before any CLI or network call', () => {
  it('refuses an empty repository name', async () => {
    const dir = freshDir('wv-publish-world-');
    buildWorldFixture(dir);
    await create(dir);
    await expect(createGithubRepo(dir, { name: '', visibility: 'private' })).rejects.toThrow(/no repository name/i);
  });

  it('refuses a repository name containing characters outside letters, digits, dots, hyphens and underscores', async () => {
    const dir = freshDir('wv-publish-world-');
    buildWorldFixture(dir);
    await create(dir);
    await expect(createGithubRepo(dir, { name: 'my world!', visibility: 'private' })).rejects.toThrow(/letters, digits/i);
    await expect(createGithubRepo(dir, { name: 'nope/nope', visibility: 'public' })).rejects.toThrow(/letters, digits/i);
  });

  it('refuses a world that has no vault yet, before ever checking for the gh CLI', async () => {
    const dir = freshDir('wv-publish-world-'); // note: no create() call, so there is no .git
    writeFileSync(join(dir, 'level.dat'), LEVEL_DAT_INITIAL);
    await expect(createGithubRepo(dir, { name: 'a-fine-name', visibility: 'private' })).rejects.toThrow(/has no vault yet/i);
  });
});

/* ==================================================================== */
/* Self-tests: proving the assumptions this file relies on               */
/* ==================================================================== */

describe('self-test: the guard-clause ordering this file relies on to avoid the gh CLI/network is real', () => {
  it('the source really does check name and vault existence before it ever references ghAvailable', () => {
    // This is not a test of behaviour, it is a test of the *source itself* --
    // proving in isolation the ordering claim the header comment above makes,
    // so that claim cannot silently go stale if the function is reordered
    // later without anyone updating this file's assumptions.
    const source = readFileSync(WORLD_VAULT_SOURCE_PATH, 'utf8');
    const fnStart = source.indexOf('export async function createGithubRepo');
    expect(fnStart).toBeGreaterThan(-1);
    const fnBody = source.slice(fnStart, fnStart + 1500);
    const nameCheckIndex = fnBody.indexOf('No repository name was given');
    const charCheckIndex = fnBody.indexOf('letters, digits');
    const vaultCheckIndex = fnBody.indexOf('has no vault yet');
    const ghAvailableIndex = fnBody.indexOf('ghAvailable(');
    expect(nameCheckIndex).toBeGreaterThan(-1);
    expect(charCheckIndex).toBeGreaterThan(-1);
    expect(vaultCheckIndex).toBeGreaterThan(-1);
    expect(ghAvailableIndex).toBeGreaterThan(-1);
    expect(nameCheckIndex).toBeLessThan(ghAvailableIndex);
    expect(charCheckIndex).toBeLessThan(ghAvailableIndex);
    expect(vaultCheckIndex).toBeLessThan(ghAvailableIndex);
  });

  it('self-test: a broken expectation that push() resolves on failure would fail this suite, not pass it silently', async () => {
    const dir = freshDir('wv-publish-world-');
    buildWorldFixture(dir);
    await create(dir);
    // Proves the negative-assertion style used above is load-bearing: a
    // push() call that is (wrongly) expected to *resolve* when it actually
    // rejects must itself throw when that wrong expectation is checked.
    let sawRejection = false;
    try {
      await push(dir);
    } catch {
      sawRejection = true;
    }
    expect(sawRejection).toBe(true);
    expect(() => expect(sawRejection).toBe(false)).toThrow();
  });
});
