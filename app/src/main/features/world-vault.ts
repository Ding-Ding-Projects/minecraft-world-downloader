import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { isAbsolute, join, relative, sep } from 'node:path';
import type { BrowserWindow } from 'electron';
import type {
  BundledToolResolution,
  WorldVaultCommit,
  WorldVaultCommitKind,
  WorldVaultCommitQuery,
  WorldVaultEvent,
  WorldVaultPermission,
  WorldVaultPruneResult,
  WorldVaultPublishPreflight,
  WorldVaultStatus
} from '../../shared/api';
import { resolveTool } from '../services/bundled';

/**
 * The version-controlled vault for a downloaded world.
 *
 * A vault is a real git repository living inside the world's own folder
 * (`<worldPath>/.git`), so it travels with the world if the folder is copied
 * or moved. A background runner watches the folder while a download is in
 * progress and commits once writes have gone quiet — never on every
 * filesystem event, because a region file is rewritten continuously as
 * chunks stream in and a snapshot taken mid-write stores a corrupt chunk
 * (hazard 1). Undo is unlimited and append-only: restoring a commit is
 * itself a new commit, exactly like the application's own local history
 * (`app/src/renderer/core/history.ts`) — the state being replaced is never
 * discarded. Publishing to a remote is a separate, always user-initiated
 * action (hazard 3): nothing here ever pushes on a timer or as a side
 * effect of anything else.
 *
 * Every renderer entry point in this file is intentionally thin: it acquires
 * the per-world lock, does the one thing it is named for, and returns. The
 * pure decision logic — settle detection and region-access refusal, the two
 * places the task explicitly calls out as "wrong is silent" — lives in
 * exported functions with no I/O at all, so they are unit-testable without a
 * real git binary or Electron.
 */

const VAULT_KIND_TRAILER = /^Vault-Kind:\s*(snapshot|restore|edit|prune)\s*$/m;
const IGNORED_DIR_NAMES = new Set(['.git']);
const GITIGNORE_BEGIN = '# >>> world-downloader-studio vault (managed) >>>';
const GITIGNORE_END = '# <<< world-downloader-studio vault (managed) <<<';
const GITIGNORE_BODY = [
  '# These are session/lock/OS artefacts, not world data. Committing them would',
  '# create churn on every session start without capturing anything meaningful.',
  '/session.lock',
  '*.tmp',
  '*.crdownload',
  '.DS_Store',
  'Thumbs.db',
  'desktop.ini'
];

const DEFAULT_QUIET_PERIOD_MS = 8_000;
const DEFAULT_POLL_INTERVAL_MS = 2_000;
const MIN_QUIET_PERIOD_MS = 1_000;
const MIN_POLL_INTERVAL_MS = 500;

/* ==================================================================== */
/* Pure decision logic — no I/O, unit-tested directly                    */
/* ==================================================================== */

export interface FileSnapshotEntry {
  size: number;
  mtimeMs: number;
}

export type SnapshotMap = Map<string, FileSnapshotEntry>;

export interface SnapshotDiff {
  /** Relative paths that were added, removed or whose size/mtime changed. */
  changed: string[];
  hasChanges: boolean;
}

/**
 * Compares two directory snapshots taken by successive polls.
 *
 * A file "changed" when it appears, disappears, or its size or modification
 * time differs — the two cheap signals `fs.stat` gives us that together are
 * a reliable proxy for "still being written to." Content hashing would be
 * more certain but far too expensive to run every poll over hundreds of
 * megabytes of region files.
 */
export function diffSnapshots(previous: SnapshotMap, next: SnapshotMap): SnapshotDiff {
  const changed: string[] = [];
  for (const [path, entry] of next) {
    const before = previous.get(path);
    if (!before || before.size !== entry.size || before.mtimeMs !== entry.mtimeMs) {
      changed.push(path);
    }
  }
  for (const path of previous.keys()) {
    if (!next.has(path)) changed.push(path);
  }
  return { changed, hasChanges: changed.length > 0 };
}

export interface SettleDecision {
  /** True once at least one uncommitted change is pending. */
  dirty: boolean;
  /** True while `dirty` is true and the quiet period has not yet elapsed. */
  waitingForSettle: boolean;
  /** True exactly when a commit should fire on this poll. */
  shouldCommit: boolean;
  /** Milliseconds until the quiet period would elapse, 0 once it has. */
  msRemaining: number;
}

/**
 * Hazard 1, decided in one place.
 *
 * The runner never commits on the poll that first notices a change — it
 * commits only once `nowMs - lastActivityMs >= quietPeriodMs`, i.e. once
 * nothing in the tree has changed for a full quiet period. A poll that finds
 * new activity resets the clock (the caller updates `lastActivityAtMs` before
 * calling this), so a region file rewritten every second during an active
 * download is never snapshotted mid-write; the commit fires only after the
 * writer has moved on and the quiet period has genuinely elapsed.
 */
export function computeSettleDecision(params: {
  dirty: boolean;
  lastActivityAtMs: number;
  nowMs: number;
  quietPeriodMs: number;
}): SettleDecision {
  const { dirty, lastActivityAtMs, nowMs, quietPeriodMs } = params;
  if (!dirty) {
    return { dirty: false, waitingForSettle: false, shouldCommit: false, msRemaining: 0 };
  }
  const elapsed = nowMs - lastActivityAtMs;
  const remaining = Math.max(0, quietPeriodMs - elapsed);
  return {
    dirty: true,
    waitingForSettle: remaining > 0,
    shouldCommit: remaining <= 0,
    msRemaining: remaining
  };
}

/**
 * Hazard 6, decided in one place: may a sibling feature (the map-render or
 * chunk-edit lane) safely read or write one region file right now?
 *
 * Refused, plainly, whenever either of two things is true: a fresh, on-demand
 * double-stat taken moments apart just saw the file's bytes move
 * (`liveChanged` — the ground truth, independent of the runner), or the
 * runner has itself observed activity on this exact path within the quiet
 * window (it may still be settling even though the two live reads happened
 * to land between writes). A path the runner has never seen change, or a
 * world with no runner running at all, is granted on the strength of the
 * live check alone. Never queued — the caller gets a plain refusal with the
 * reason and decides for itself whether to retry later.
 */
export function evaluateRegionAccess(params: {
  relativePath: string;
  runnerActive: boolean;
  lastKnownActivityAtMs: number | null;
  nowMs: number;
  quietPeriodMs: number;
  liveChanged: boolean;
}): WorldVaultPermission {
  const { relativePath, runnerActive, lastKnownActivityAtMs, nowMs, quietPeriodMs, liveChanged } = params;

  if (liveChanged) {
    return {
      granted: false,
      reason: `"${relativePath}" changed size or modification time between two checks taken moments apart, so it is still being written. Try again once the download settles.`
    };
  }
  if (runnerActive && lastKnownActivityAtMs !== null) {
    const elapsed = nowMs - lastKnownActivityAtMs;
    if (elapsed < quietPeriodMs) {
      const remainingSeconds = Math.ceil((quietPeriodMs - elapsed) / 1000);
      return {
        granted: false,
        reason: `"${relativePath}" was written to ${Math.max(0, Math.round(elapsed / 1000))}s ago, inside the ${Math.round(
          quietPeriodMs / 1000
        )}s quiet period. Wait about ${remainingSeconds}s for it to settle before touching it.`
      };
    }
  }
  return { granted: true, reason: null };
}

/* ==================================================================== */
/* Filesystem helpers                                                    */
/* ==================================================================== */

function toPosixRelative(root: string, absolutePath: string): string {
  return relative(root, absolutePath).split(sep).join('/');
}

/** Recursively lists every file under `root`, excluding `.git`. */
async function walkFiles(root: string): Promise<Array<{ relativePath: string; absolutePath: string; size: number; mtimeMs: number }>> {
  const out: Array<{ relativePath: string; absolutePath: string; size: number; mtimeMs: number }> = [];

  async function walk(dir: string): Promise<void> {
    let entries: import('node:fs').Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return; // the directory may have been removed between listing and reading
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (IGNORED_DIR_NAMES.has(entry.name)) continue;
        await walk(join(dir, entry.name));
        continue;
      }
      if (!entry.isFile()) continue;
      const absolutePath = join(dir, entry.name);
      try {
        const stats = await fs.stat(absolutePath);
        out.push({
          relativePath: toPosixRelative(root, absolutePath),
          absolutePath,
          size: stats.size,
          mtimeMs: stats.mtimeMs
        });
      } catch {
        // vanished between readdir and stat — not an error, just not there anymore
      }
    }
  }

  await walk(root);
  return out;
}

async function takeSnapshot(root: string): Promise<SnapshotMap> {
  const files = await walkFiles(root);
  const map: SnapshotMap = new Map();
  for (const file of files) map.set(file.relativePath, { size: file.size, mtimeMs: file.mtimeMs });
  return map;
}

async function dirSizeBytes(root: string): Promise<number> {
  let total = 0;
  async function walk(dir: string): Promise<void> {
    let entries: import('node:fs').Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const absolutePath = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(absolutePath);
        continue;
      }
      if (!entry.isFile() && !entry.isSymbolicLink()) continue;
      try {
        const stats = await fs.stat(absolutePath);
        total += stats.size;
      } catch {
        /* vanished between readdir and stat */
      }
    }
  }
  await walk(root);
  return total;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

function normalizeWorldPath(worldPath: string): string {
  const value = String(worldPath ?? '').trim();
  if (!value) throw new Error('No world folder was given.');
  if (!isAbsolute(value)) throw new Error(`"${value}" is not an absolute path.`);
  return value;
}

async function ensureGitignore(worldPath: string): Promise<void> {
  const path = join(worldPath, '.gitignore');
  const managedBlock = [GITIGNORE_BEGIN, ...GITIGNORE_BODY, GITIGNORE_END].join('\n');
  let existing = '';
  try {
    existing = await fs.readFile(path, 'utf8');
  } catch {
    existing = '';
  }
  if (existing.includes(GITIGNORE_BEGIN)) return; // already written by an earlier createVault
  const next = existing.length > 0 ? `${existing.replace(/\s*$/, '')}\n\n${managedBlock}\n` : `${managedBlock}\n`;
  await fs.writeFile(path, next, 'utf8');
}

/* ==================================================================== */
/* git / gh execution                                                    */
/* ==================================================================== */

interface ExecResult {
  ok: boolean;
  code: number | null;
  stdout: string;
  stderr: string;
  spawnError: string | null;
}

function exec(
  command: string,
  args: string[],
  options: { cwd?: string; timeoutMs?: number } = {}
): Promise<ExecResult> {
  return new Promise((resolve) => {
    execFile(
      command,
      args,
      {
        cwd: options.cwd,
        timeout: options.timeoutMs ?? 30_000,
        windowsHide: true,
        maxBuffer: 64 * 1024 * 1024
      },
      (error, stdout, stderr) => {
        if (!error) {
          resolve({ ok: true, code: 0, stdout, stderr, spawnError: null });
          return;
        }
        const errno = (error as NodeJS.ErrnoException).code;
        if (typeof errno === 'string') {
          resolve({
            ok: false,
            code: null,
            stdout: stdout ?? '',
            stderr: stderr ?? '',
            spawnError:
              errno === 'ENOENT'
                ? `"${command}" was not found on PATH.`
                : `"${command}" could not be started (${errno}).`
          });
          return;
        }
        const exitCode = (error as unknown as { code?: number }).code;
        resolve({
          ok: false,
          code: typeof exitCode === 'number' ? exitCode : null,
          stdout: stdout ?? '',
          stderr: stderr ?? '',
          spawnError: null
        });
      }
    );
  });
}

/**
 * Bundled first, then PATH — resolved once per process and reused for every
 * git/gh invocation this module makes (a positive OR negative result is
 * cached forever, exactly like the `gitAvailableCache` boolean this
 * replaces), so the background runner polling every couple of seconds is not
 * also paying for a fresh PATH search on every tick. Never hands back a
 * browser link: a miss here means every caller reports the same honest
 * "not available, here is exactly why" instead.
 */
let gitResolutionCache: BundledToolResolution | null | undefined;
async function resolveGit(): Promise<BundledToolResolution | null> {
  if (gitResolutionCache === undefined) gitResolutionCache = await resolveTool('git');
  return gitResolutionCache;
}

let ghResolutionCache: BundledToolResolution | null | undefined;
async function resolveGh(): Promise<BundledToolResolution | null> {
  if (ghResolutionCache === undefined) ghResolutionCache = await resolveTool('gh');
  return ghResolutionCache;
}

const GIT_UNAVAILABLE_MESSAGE =
  'git is not available: no copy is bundled with this build and none was found on PATH.';
const GH_UNAVAILABLE_MESSAGE =
  'The GitHub CLI ("gh") is not available: no copy is bundled with this build and none was found on PATH.';

/** Every direct `git` invocation in this module goes through here, never the bare string `'git'`. */
async function execGit(args: string[], options: { cwd?: string; timeoutMs?: number } = {}): Promise<ExecResult> {
  const resolution = await resolveGit();
  if (!resolution) {
    return { ok: false, code: null, stdout: '', stderr: '', spawnError: GIT_UNAVAILABLE_MESSAGE };
  }
  return exec(resolution.path, args, options);
}

/** Every direct `gh` invocation in this module goes through here, never the bare string `'gh'`. */
async function execGh(args: string[], options: { cwd?: string; timeoutMs?: number } = {}): Promise<ExecResult> {
  const resolution = await resolveGh();
  if (!resolution) {
    return { ok: false, code: null, stdout: '', stderr: '', spawnError: GH_UNAVAILABLE_MESSAGE };
  }
  return exec(resolution.path, args, options);
}

async function git(cwd: string, args: string[], timeoutMs?: number): Promise<string> {
  const result = await execGit(args, { cwd, timeoutMs });
  if (!result.ok) {
    const reason = result.spawnError ?? (result.stderr.trim() || result.stdout.trim() || `exit code ${result.code}`);
    throw new Error(`git ${args.join(' ')} failed: ${reason}`);
  }
  return result.stdout.trim();
}

let gitAvailableCache: boolean | null = null;

async function gitAvailable(): Promise<boolean> {
  if (gitAvailableCache !== null) return gitAvailableCache;
  const result = await execGit(['--version'], { timeoutMs: 10_000 });
  gitAvailableCache = result.ok;
  return gitAvailableCache;
}

async function ghAvailable(): Promise<boolean> {
  const result = await execGh(['--version'], { timeoutMs: 10_000 });
  return result.ok;
}

async function ghAuthState(): Promise<{ authenticated: boolean; accountLogin: string | null }> {
  const result = await execGh(['auth', 'status'], { timeoutMs: 15_000 });
  const combined = `${result.stdout}\n${result.stderr}`;
  const match = combined.match(/Logged in to [^\s]+ as ([^\s(]+)/);
  return { authenticated: result.ok, accountLogin: result.ok && match ? match[1] : null };
}

/* ==================================================================== */
/* Per-world serialization                                               */
/* ==================================================================== */

const locks = new Map<string, Promise<unknown>>();

/** Every git-mutating operation against one world runs one at a time. */
function withLock<T>(worldPath: string, fn: () => Promise<T>): Promise<T> {
  const previous = locks.get(worldPath) ?? Promise.resolve();
  const next = previous.then(fn, fn);
  // Swallow so one caller's rejection does not poison the chain for the next.
  locks.set(
    worldPath,
    next.catch(() => undefined)
  );
  return next;
}

/* ==================================================================== */
/* Runner state                                                          */
/* ==================================================================== */

interface RunnerState {
  worldPath: string;
  quietPeriodMs: number;
  pollIntervalMs: number;
  timer: NodeJS.Timeout;
  snapshot: SnapshotMap;
  /** Per-file: the last time each path was observed to have changed. */
  lastActivityByPath: Map<string, number>;
  dirty: boolean;
  lastActivityAtMs: number;
  polling: boolean;
}

const runners = new Map<string, RunnerState>();

let broadcast: (event: WorldVaultEvent) => void = () => undefined;

/** Wires the push channel. Call once at boot, mirroring `attachProcessBroadcast`. */
export function attachWorldVaultBroadcast(getWindow: () => BrowserWindow | null): void {
  broadcast = (event) => {
    const window = getWindow();
    if (window && !window.isDestroyed()) window.webContents.send('worldvault:event', event);
  };
}

/* ==================================================================== */
/* Commit parsing                                                        */
/* ==================================================================== */

function kindOf(body: string): WorldVaultCommitKind {
  const match = body.match(VAULT_KIND_TRAILER);
  return (match?.[1] as WorldVaultCommitKind | undefined) ?? 'snapshot';
}

const UNIT_SEP = '';

async function parseCommit(worldPath: string, hash: string): Promise<WorldVaultCommit> {
  const header = await git(worldPath, [
    'show',
    '--no-patch',
    `--format=%H${UNIT_SEP}%h${UNIT_SEP}%cI${UNIT_SEP}%s${UNIT_SEP}%b`,
    hash
  ]);
  const [fullHash, shortHash, timestampIso, subject, ...bodyParts] = header.split(UNIT_SEP);
  const body = bodyParts.join(UNIT_SEP);

  const stat = await execGit(['show', '--stat=4096', '--format=', hash], { cwd: worldPath, timeoutMs: 30_000 });
  let filesChanged = 0;
  let bytesChanged = 0;
  if (stat.ok) {
    for (const line of stat.stdout.split('\n')) {
      const binMatch = line.match(/\|\s*Bin\s+(\d+)\s*->\s*(\d+)\s*bytes/);
      if (binMatch) {
        bytesChanged += Math.abs(Number(binMatch[2]) - Number(binMatch[1]));
        continue;
      }
      const summaryMatch = line.match(/(\d+) files? changed/);
      if (summaryMatch) filesChanged = Number(summaryMatch[1]);
    }
    if (filesChanged === 0) {
      // A pure-binary diff still lists one "path | Bin X -> Y bytes" line per
      // file even without a trailing summary line in some git versions.
      filesChanged = stat.stdout.split('\n').filter((line) => /\|\s*(Bin|\d)/.test(line)).length;
    }
  }

  return {
    hash: fullHash,
    shortHash,
    timestampIso,
    subject,
    kind: kindOf(body),
    filesChanged,
    bytesChanged
  };
}

/* ==================================================================== */
/* Vault lifecycle                                                       */
/* ==================================================================== */

async function repoInitialized(worldPath: string): Promise<boolean> {
  return pathExists(join(worldPath, '.git'));
}

export async function status(worldPath: string): Promise<WorldVaultStatus> {
  const world = normalizeWorldPath(worldPath);
  const base: WorldVaultStatus = {
    exists: false,
    worldPath: world,
    repoRoot: null,
    branch: null,
    commitCount: 0,
    lastCommit: null,
    runnerActive: runners.has(world),
    waitingForSettle: false,
    msSinceLastActivity: null,
    quietPeriodMs: runners.get(world)?.quietPeriodMs ?? DEFAULT_QUIET_PERIOD_MS,
    pollIntervalMs: runners.get(world)?.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS,
    gitDirBytes: 0,
    workingTreeBytes: 0,
    remoteUrl: null,
    degradedReason: null
  };

  if (!(await gitAvailable())) {
    base.degradedReason = `${GIT_UNAVAILABLE_MESSAGE} A vault cannot be created or used until it is.`;
    return base;
  }
  if (!(await repoInitialized(world))) {
    base.workingTreeBytes = (await pathExists(world)) ? await dirSizeBytes(world) : 0;
    return base;
  }

  base.exists = true;
  base.repoRoot = world;
  try {
    base.branch = (await git(world, ['branch', '--show-current'])) || null;
    base.commitCount = Number((await git(world, ['rev-list', '--count', 'HEAD'])).trim() || '0');
    const lastHash = (await git(world, ['rev-parse', 'HEAD'])).trim();
    base.lastCommit = await parseCommit(world, lastHash);
    try {
      base.remoteUrl = (await git(world, ['remote', 'get-url', 'origin'])) || null;
    } catch {
      base.remoteUrl = null;
    }
  } catch (error) {
    base.degradedReason = `The repository exists but could not be read: ${describe(error)}`;
  }

  base.gitDirBytes = await dirSizeBytes(join(world, '.git'));
  base.workingTreeBytes = await dirSizeBytes(world);

  const runner = runners.get(world);
  if (runner) {
    const decision = computeSettleDecision({
      dirty: runner.dirty,
      lastActivityAtMs: runner.lastActivityAtMs,
      nowMs: Date.now(),
      quietPeriodMs: runner.quietPeriodMs
    });
    base.waitingForSettle = decision.waitingForSettle;
    base.msSinceLastActivity = runner.dirty ? Date.now() - runner.lastActivityAtMs : null;
  }

  return base;
}

export async function create(worldPath: string): Promise<WorldVaultStatus> {
  const world = normalizeWorldPath(worldPath);
  if (!(await gitAvailable())) {
    throw new Error(GIT_UNAVAILABLE_MESSAGE);
  }
  return withLock(world, async () => {
    await fs.mkdir(world, { recursive: true });
    const alreadyInitialized = await repoInitialized(world);
    if (!alreadyInitialized) {
      await git(world, ['init', '--quiet']);
      await git(world, ['config', 'user.name', 'World Downloader Studio Vault']);
      await git(world, ['config', 'user.email', 'vault@worlddownloaderstudio.local']);
      await git(world, ['config', 'commit.gpgsign', 'false']);
      await git(world, ['config', 'core.autocrlf', 'false']);
    }
    await ensureGitignore(world);
    await git(world, ['add', '-A']);
    const staged = await git(world, ['diff', '--cached', '--name-only']);
    if (staged.trim().length > 0) {
      await commitStaged(
        world,
        alreadyInitialized ? 'Captured pending changes' : 'Created the vault: initial snapshot',
        'snapshot'
      );
    } else {
      const hasCommit = (await execGit(['rev-parse', '--verify', 'HEAD'], { cwd: world, timeoutMs: 10_000 })).ok;
      if (!hasCommit) {
        await commitStaged(world, 'Created the vault (the world folder was empty)', 'snapshot', true);
      }
    }
    return status(world);
  });
}

async function commitStaged(
  worldPath: string,
  subject: string,
  kind: WorldVaultCommitKind,
  allowEmpty = false
): Promise<WorldVaultCommit> {
  const args = ['commit', '--quiet', '-m', subject, '-m', `Vault-Kind: ${kind}`];
  if (allowEmpty) args.splice(1, 0, '--allow-empty');
  await git(worldPath, args);
  const hash = (await git(worldPath, ['rev-parse', 'HEAD'])).trim();
  return parseCommit(worldPath, hash);
}

/** Commits whatever is currently on disk, if anything changed. Used by the
 *  runner and exposed to sibling features that just finished an edit. */
export async function commitNow(
  worldPath: string,
  message: string,
  kind: WorldVaultCommitKind = 'edit'
): Promise<WorldVaultCommit | null> {
  const world = normalizeWorldPath(worldPath);
  if (!(await repoInitialized(world))) {
    throw new Error(`"${world}" has no vault yet. Create one first.`);
  }
  return withLock(world, async () => {
    await git(world, ['add', '-A']);
    const porcelain = await git(world, ['diff', '--cached', '--name-only']);
    if (porcelain.trim().length === 0) return null;
    const subject = String(message || 'Captured a change').slice(0, 200);
    const commit = await commitStaged(world, subject, kind);
    const nextStatus = await status(world);
    broadcast({ worldPath: world, kind: 'commit', commit, status: nextStatus });
    return commit;
  });
}

/* ==================================================================== */
/* Background runner                                                     */
/* ==================================================================== */

async function pollOnce(state: RunnerState): Promise<void> {
  if (state.polling) return; // never overlap a poll that is still running
  state.polling = true;
  try {
    const world = state.worldPath;
    if (!(await pathExists(world))) return;
    const next = await takeSnapshot(world);
    const diff = diffSnapshots(state.snapshot, next);
    state.snapshot = next;

    const now = Date.now();
    if (diff.hasChanges) {
      state.dirty = true;
      state.lastActivityAtMs = now;
      for (const path of diff.changed) state.lastActivityByPath.set(path, now);
    }

    const decision = computeSettleDecision({
      dirty: state.dirty,
      lastActivityAtMs: state.lastActivityAtMs,
      nowMs: now,
      quietPeriodMs: state.quietPeriodMs
    });

    if (decision.shouldCommit) {
      const commit = await withLock(world, async () => {
        await git(world, ['add', '-A']);
        const porcelain = await git(world, ['diff', '--cached', '--name-only']);
        if (porcelain.trim().length === 0) return null;
        const fileCount = porcelain.split('\n').filter((line) => line.trim().length > 0).length;
        return commitStaged(world, `Captured ${fileCount} changed file${fileCount === 1 ? '' : 's'} as they settled`, 'snapshot');
      });
      state.dirty = false;
      const nextStatus = await status(world);
      if (commit) {
        broadcast({ worldPath: world, kind: 'commit', commit, status: nextStatus });
      } else {
        broadcast({ worldPath: world, kind: 'status', status: nextStatus });
      }
    } else if (diff.hasChanges) {
      broadcast({ worldPath: world, kind: 'status', status: await status(world) });
    }
  } catch (error) {
    console.error(`world-vault: poll of "${state.worldPath}" failed: ${describe(error)}`);
  } finally {
    state.polling = false;
  }
}

export async function startRunner(
  worldPath: string,
  options: { quietPeriodMs: number; pollIntervalMs: number }
): Promise<WorldVaultStatus> {
  const world = normalizeWorldPath(worldPath);
  if (!(await repoInitialized(world))) {
    throw new Error(`"${world}" has no vault yet. Create one before starting the runner.`);
  }
  const quietPeriodMs = Math.max(MIN_QUIET_PERIOD_MS, Math.floor(options.quietPeriodMs) || DEFAULT_QUIET_PERIOD_MS);
  const pollIntervalMs = Math.max(MIN_POLL_INTERVAL_MS, Math.floor(options.pollIntervalMs) || DEFAULT_POLL_INTERVAL_MS);

  const existing = runners.get(world);
  if (existing) {
    clearInterval(existing.timer);
  }

  const snapshot = await takeSnapshot(world);
  const state: RunnerState = {
    worldPath: world,
    quietPeriodMs,
    pollIntervalMs,
    snapshot,
    lastActivityByPath: existing?.lastActivityByPath ?? new Map(),
    dirty: existing?.dirty ?? false,
    lastActivityAtMs: existing?.lastActivityAtMs ?? Date.now(),
    polling: false,
    timer: null as unknown as NodeJS.Timeout
  };
  state.timer = setInterval(() => void pollOnce(state), pollIntervalMs);
  runners.set(world, state);
  return status(world);
}

export async function stopRunner(worldPath: string): Promise<WorldVaultStatus> {
  const world = normalizeWorldPath(worldPath);
  const existing = runners.get(world);
  if (existing) {
    clearInterval(existing.timer);
    runners.delete(world);
  }
  return status(world);
}

/** Stops every runner. Called on app quit so nothing keeps polling a dead window. */
export function stopAllRunners(): void {
  for (const state of runners.values()) clearInterval(state.timer);
  runners.clear();
}

/* ==================================================================== */
/* Region access (hazard 6)                                              */
/* ==================================================================== */

export async function requestRegionAccess(worldPath: string, relativePathInput: string): Promise<WorldVaultPermission> {
  const world = normalizeWorldPath(worldPath);
  const relativePath = String(relativePathInput ?? '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!relativePath || relativePath.includes('..')) {
    return { granted: false, reason: 'The region path is empty or escapes the world folder.' };
  }
  const absolutePath = join(world, ...relativePath.split('/'));

  // A fresh, live double-check: stat now, wait briefly, stat again. Anything
  // still mid-write moves between the two reads.
  let liveChanged = false;
  const first = await statOrNull(absolutePath);
  if (first) {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const second = await statOrNull(absolutePath);
    if (!second || second.size !== first.size || second.mtimeMs !== first.mtimeMs) liveChanged = true;
  }

  const runner = runners.get(world);
  const permission = evaluateRegionAccess({
    relativePath,
    runnerActive: runner !== undefined,
    lastKnownActivityAtMs: runner?.lastActivityByPath.get(relativePath) ?? null,
    nowMs: Date.now(),
    quietPeriodMs: runner?.quietPeriodMs ?? DEFAULT_QUIET_PERIOD_MS,
    liveChanged
  });

  if (!permission.granted && permission.reason) {
    broadcast({ worldPath: world, kind: 'permission-denied', regionPath: relativePath, reason: permission.reason });
  }
  return permission;
}

async function statOrNull(path: string): Promise<{ size: number; mtimeMs: number } | null> {
  try {
    const stats = await fs.stat(path);
    return { size: stats.size, mtimeMs: stats.mtimeMs };
  } catch {
    return null;
  }
}

/* ==================================================================== */
/* Timeline                                                               */
/* ==================================================================== */

export async function commits(query: WorldVaultCommitQuery): Promise<WorldVaultCommit[]> {
  const world = normalizeWorldPath(query.worldPath);
  if (!(await repoInitialized(world))) return [];
  const offset = Math.max(0, Math.floor(query.offset ?? 0));
  const limit = Math.min(500, Math.max(1, Math.floor(query.limit ?? 100)));
  const raw = await git(world, [
    'log',
    `--skip=${offset}`,
    `-n${limit}`,
    `--format=%H`
  ]);
  const hashes = raw.split('\n').map((line) => line.trim()).filter(Boolean);
  const out: WorldVaultCommit[] = [];
  for (const hash of hashes) out.push(await parseCommit(world, hash));
  return out;
}

/* ==================================================================== */
/* Restore (append-only undo)                                            */
/* ==================================================================== */

export async function restore(worldPath: string, hash: string): Promise<WorldVaultCommit> {
  const world = normalizeWorldPath(worldPath);
  const targetHash = String(hash ?? '').trim();
  if (!targetHash) throw new Error('No commit was given to restore to.');
  if (!(await repoInitialized(world))) throw new Error(`"${world}" has no vault yet.`);

  return withLock(world, async () => {
    // Resolve to a full hash and confirm it actually exists in this repository
    // before anything on disk is touched.
    const resolved = (await git(world, ['rev-parse', '--verify', `${targetHash}^{commit}`])).trim();
    const target = await parseCommit(world, resolved);

    // Nothing the download or a prior session left uncommitted is ever
    // silently discarded: it becomes its own commit first.
    await git(world, ['add', '-A']);
    const pending = await git(world, ['diff', '--cached', '--name-only']);
    if (pending.trim().length > 0) {
      await commitStaged(world, 'Captured pending changes before restoring', 'snapshot');
    }

    // Files present now but absent from the target commit must be removed to
    // truly match that snapshot; `git checkout <hash> -- .` alone only
    // updates files the target commit has, it never deletes extras.
    const nameStatus = await git(world, ['diff', '--name-status', resolved, 'HEAD']);
    const toRemove: string[] = [];
    for (const line of nameStatus.split('\n')) {
      const match = line.match(/^A\t(.+)$/);
      if (match) toRemove.push(match[1]);
    }
    for (const relativePath of toRemove) {
      const absolutePath = join(world, ...relativePath.split('/'));
      try {
        await fs.rm(absolutePath, { force: true });
      } catch {
        /* already gone, or a permission issue git's own checkout will also hit */
      }
    }

    await git(world, ['checkout', resolved, '--', '.']);
    await git(world, ['add', '-A']);
    const restoreCommit = await commitStaged(
      world,
      `Restored to ${target.shortHash}: ${target.subject}`.slice(0, 200),
      'restore',
      true
    );
    const nextStatus = await status(world);
    broadcast({ worldPath: world, kind: 'commit', commit: restoreCommit, status: nextStatus });
    return restoreCommit;
  });
}

/* ==================================================================== */
/* Publish (hazard 3: always user-initiated)                             */
/* ==================================================================== */

export async function publishPreflight(worldPath: string): Promise<WorldVaultPublishPreflight> {
  const world = normalizeWorldPath(worldPath);
  const [gAvailable, gAvailableGh, authState, fileCount] = await Promise.all([
    gitAvailable(),
    ghAvailable(),
    ghAuthState(),
    walkFiles(world).then((files) => files.length)
  ]);
  let remoteUrl: string | null = null;
  if (await repoInitialized(world)) {
    try {
      remoteUrl = (await git(world, ['remote', 'get-url', 'origin'])).trim() || null;
    } catch {
      remoteUrl = null;
    }
  }
  const worldSizeBytes = await dirSizeBytes(world);
  return {
    worldPath: world,
    worldSizeBytes,
    fileCount,
    hasRemote: remoteUrl !== null,
    remoteUrl,
    gitAvailable: gAvailable,
    ghAvailable: gAvailableGh,
    ghAuthenticated: authState.authenticated,
    ghAccountLogin: authState.accountLogin
  };
}

export async function setRemote(worldPath: string, url: string): Promise<void> {
  const world = normalizeWorldPath(worldPath);
  const value = String(url ?? '').trim();
  if (!value) throw new Error('No remote URL was given.');
  if (!(await repoInitialized(world))) throw new Error(`"${world}" has no vault yet.`);
  await withLock(world, async () => {
    let hasOrigin = true;
    try {
      await git(world, ['remote', 'get-url', 'origin']);
    } catch {
      hasOrigin = false;
    }
    if (hasOrigin) await git(world, ['remote', 'set-url', 'origin', value]);
    else await git(world, ['remote', 'add', 'origin', value]);
  });
}

export async function push(worldPath: string): Promise<{ output: string }> {
  const world = normalizeWorldPath(worldPath);
  if (!(await repoInitialized(world))) throw new Error(`"${world}" has no vault yet.`);
  return withLock(world, async () => {
    const branch = (await git(world, ['branch', '--show-current'])).trim();
    if (!branch) throw new Error('The vault has no commits yet, so there is nothing to push.');
    const result = await execGit(['push', '-u', 'origin', branch], { cwd: world, timeoutMs: 180_000 });
    if (!result.ok) {
      const reason = result.spawnError ?? (result.stderr.trim() || result.stdout.trim() || `exit code ${result.code}`);
      throw new Error(`git push failed: ${reason}`);
    }
    return { output: `${result.stdout}\n${result.stderr}`.trim() };
  });
}

export async function createGithubRepo(
  worldPath: string,
  options: { name: string; visibility: 'public' | 'private' }
): Promise<{ url: string; output: string }> {
  const world = normalizeWorldPath(worldPath);
  const name = String(options.name ?? '').trim();
  if (!name) throw new Error('No repository name was given.');
  if (!/^[A-Za-z0-9._-]+$/.test(name)) {
    throw new Error('The repository name may only contain letters, digits, dots, hyphens and underscores.');
  }
  if (!(await repoInitialized(world))) throw new Error(`"${world}" has no vault yet.`);
  if (!(await ghAvailable())) throw new Error(GH_UNAVAILABLE_MESSAGE);
  const auth = await ghAuthState();
  if (!auth.authenticated) {
    throw new Error('The GitHub CLI is not signed in. Run "gh auth login" and try again.');
  }
  const visibilityFlag = options.visibility === 'public' ? '--public' : '--private';

  return withLock(world, async () => {
    const result = await execGh(
      ['repo', 'create', name, visibilityFlag, '--source=.', '--remote=origin', '--push'],
      { cwd: world, timeoutMs: 180_000 }
    );
    const output = `${result.stdout}\n${result.stderr}`.trim();
    if (!result.ok) {
      const reason = result.spawnError ?? (result.stderr.trim() || result.stdout.trim() || `exit code ${result.code}`);
      throw new Error(`gh repo create failed: ${reason}`);
    }
    let url = (output.match(/https:\/\/github\.com\/\S+/) ?? [null])[0];
    if (!url) {
      try {
        url = (await git(world, ['remote', 'get-url', 'origin'])).trim();
      } catch {
        url = '';
      }
    }
    return { url: url ?? '', output };
  });
}

/* ==================================================================== */
/* Maintenance (hazard 2: bound the growth honestly)                     */
/* ==================================================================== */

export async function gc(worldPath: string): Promise<{ gitDirBytes: number }> {
  const world = normalizeWorldPath(worldPath);
  if (!(await repoInitialized(world))) throw new Error(`"${world}" has no vault yet.`);
  await withLock(world, () => git(world, ['gc'], 180_000));
  return { gitDirBytes: await dirSizeBytes(join(world, '.git')) };
}

/**
 * Checks one commit's tree out to `destinationDirectory` through
 * `git worktree add --detach`, a real, isolated, read-only-in-practice
 * checkout of exactly that commit. The live world at `worldPath` is never
 * touched by this — no file in it is read, stat'd or written — which is
 * exactly what a sibling render feature needs: a commit's files on disk to
 * render from, without ever racing the live, possibly-still-downloading
 * world (hazard 6, from the other side).
 */
export async function exportCommitTree(
  worldPath: string,
  hash: string,
  destinationDirectory: string
): Promise<{ path: string }> {
  const world = normalizeWorldPath(worldPath);
  const targetHash = String(hash ?? '').trim();
  if (!targetHash) throw new Error('No commit was given to export.');
  const destination = String(destinationDirectory ?? '').trim();
  if (!destination || !isAbsolute(destination)) {
    throw new Error('The destination directory must be given as an absolute path.');
  }
  if (!(await repoInitialized(world))) throw new Error(`"${world}" has no vault yet.`);

  return withLock(world, async () => {
    const resolved = (await git(world, ['rev-parse', '--verify', `${targetHash}^{commit}`])).trim();

    // `git worktree add` refuses a non-empty destination outright, and a
    // leftover worktree at the same path from an earlier, interrupted export
    // would refuse just as hard — so a clean directory is prepared first
    // rather than trusting whatever the caller left behind.
    const priorWorktrees = await execGit(['worktree', 'list', '--porcelain'], { cwd: world, timeoutMs: 15_000 });
    if (priorWorktrees.ok && priorWorktrees.stdout.includes(destination)) {
      await execGit(['worktree', 'remove', '--force', destination], { cwd: world, timeoutMs: 30_000 });
    }
    await fs.rm(destination, { recursive: true, force: true });
    await fs.mkdir(destination, { recursive: true });

    const result = await execGit(['worktree', 'add', '--detach', '--force', destination, resolved], {
      cwd: world,
      timeoutMs: 60_000
    });
    if (!result.ok) {
      const reason = result.spawnError ?? (result.stderr.trim() || result.stdout.trim() || `exit code ${result.code}`);
      throw new Error(`Exporting commit ${targetHash} failed: ${reason}`);
    }
    return { path: destination };
  });
}

/**
 * Squashes every commit before `beforeHash` into one. The tree — the actual
 * file content — at `beforeHash` is preserved exactly; only the individual
 * commits leading up to it are collapsed into a single new root, and the
 * disk space they occupied is reclaimed. This is destructive to detail (the
 * intermediate history disappears) and is gated behind the two-key confirm
 * dialog on the renderer side; it never runs on its own.
 */
export async function prune(worldPath: string, beforeHash: string): Promise<WorldVaultPruneResult> {
  const world = normalizeWorldPath(worldPath);
  const target = String(beforeHash ?? '').trim();
  if (!target) throw new Error('No commit was given to prune before.');
  if (!(await repoInitialized(world))) throw new Error(`"${world}" has no vault yet.`);

  return withLock(world, async () => {
    const resolvedTarget = (await git(world, ['rev-parse', '--verify', `${target}^{commit}`])).trim();
    const isAncestorResult = await execGit(['merge-base', '--is-ancestor', resolvedTarget, 'HEAD'], {
      cwd: world,
      timeoutMs: 30_000
    });
    if (!isAncestorResult.ok) {
      throw new Error('That commit is not in this vault\'s current history, so it cannot be used as a prune boundary.');
    }

    const beforeGitDirBytes = await dirSizeBytes(join(world, '.git'));
    const totalBefore = Number((await git(world, ['rev-list', '--count', 'HEAD'])).trim() || '0');

    let parentOfTarget = '';
    try {
      parentOfTarget = (await git(world, ['rev-parse', '--verify', `${resolvedTarget}^`])).trim();
    } catch {
      parentOfTarget = ''; // target is already the root commit — nothing to squash
    }
    if (!parentOfTarget) {
      return { removedCommitCount: 0, reclaimedBytes: 0 };
    }

    const branch = (await git(world, ['branch', '--show-current'])).trim();
    if (!branch) throw new Error('The vault is not on a branch, so history cannot be pruned safely.');

    // Ensure nothing uncommitted is silently lost by the rebase below.
    await git(world, ['add', '-A']);
    const pending = await git(world, ['diff', '--cached', '--name-only']);
    if (pending.trim().length > 0) {
      await commitStaged(world, 'Captured pending changes before pruning', 'snapshot');
    }

    const targetInfo = await parseCommit(world, resolvedTarget);
    const newRoot = (
      await execGit(['commit-tree', `${resolvedTarget}^{tree}`, '-m', `Squashed vault history before ${targetInfo.shortHash}: ${targetInfo.subject}`, '-m', 'Vault-Kind: prune'], {
        cwd: world,
        timeoutMs: 30_000
      })
    ).stdout.trim();
    if (!newRoot) throw new Error('Could not build the squashed root commit.');

    const rebaseResult = await execGit(['rebase', '--onto', newRoot, resolvedTarget, branch], {
      cwd: world,
      timeoutMs: 180_000
    });
    if (!rebaseResult.ok) {
      // Leave nothing half-rewritten: abort and surface the real reason.
      await execGit(['rebase', '--abort'], { cwd: world, timeoutMs: 30_000 });
      const reason = rebaseResult.spawnError ?? (rebaseResult.stderr.trim() || rebaseResult.stdout.trim());
      throw new Error(`Pruning failed and was rolled back: ${reason}`);
    }

    await execGit(['reflog', 'expire', '--expire=now', '--all'], { cwd: world, timeoutMs: 60_000 });
    await execGit(['gc', '--prune=now'], { cwd: world, timeoutMs: 180_000 });

    const totalAfter = Number((await git(world, ['rev-list', '--count', 'HEAD'])).trim() || '0');
    const afterGitDirBytes = await dirSizeBytes(join(world, '.git'));

    const result: WorldVaultPruneResult = {
      removedCommitCount: Math.max(0, totalBefore - totalAfter),
      reclaimedBytes: Math.max(0, beforeGitDirBytes - afterGitDirBytes)
    };
    broadcast({ worldPath: world, kind: 'status', status: await status(world) });
    return result;
  });
}

/* ==================================================================== */
/* Small helpers                                                         */
/* ==================================================================== */

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
