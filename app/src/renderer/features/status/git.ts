import type { AppContext } from '../../core/registry';

/**
 * Real local Git state for this application's own checkout.
 *
 * `git` is a bare name on the privileged process bridge's allow-list, so this
 * runs the exact commands `scripts/report-status.mjs` runs — no shell, one real
 * argv entry per argument — and reads the same facts a person running that
 * script from a terminal would see. Nothing here reaches the network: `git
 * status` and `git rev-parse` both work entirely from the local object
 * database, and the one remote-shaped check (comparing against
 * `origin/<branch>`) reads a ref this machine already has, not the actual
 * remote, so it can be stale until the next `git fetch` — exactly as it is for
 * the command-line script.
 *
 * A packaged build's working directory is not usually inside a Git checkout at
 * all, so every command here is expected to fail there. That failure is
 * reported honestly rather than treated as a crash.
 */

const GIT_TIMEOUT_MS = 15_000;
const MAX_OUTPUT_BYTES = 1024 * 1024;

export interface GitRunResult {
  ok: boolean;
  stdout: string;
  error: string;
}

/** Runs one `git` invocation and waits for it to exit, buffering its output. */
export async function runGit(ctx: AppContext, args: string[], cwd?: string): Promise<GitRunResult> {
  const spawned = await ctx.studio.process.spawn({
    command: 'git',
    args,
    cwd,
    timeoutMs: GIT_TIMEOUT_MS,
    maxOutputBytes: MAX_OUTPUT_BYTES
  });
  if (!spawned.ok) return { ok: false, stdout: '', error: spawned.error };
  const id = spawned.value.id;

  const exit = await new Promise<{ code: number | null } | null>((resolve) => {
    let settled = false;
    const settle = (value: { code: number | null } | null): void => {
      if (settled) return;
      settled = true;
      unsubscribe();
      window.clearTimeout(fallback);
      resolve(value);
    };
    const unsubscribe = ctx.studio.events.on('process:event', (event) => {
      if (event.id !== id) return;
      if (event.kind === 'exit') settle({ code: event.code });
      else if (event.kind === 'error') settle(null);
    });
    // The spawn's own timeout already kills a hung process; this is a second,
    // slightly longer ceiling in case the exit event itself never arrives.
    const fallback = window.setTimeout(() => settle(null), GIT_TIMEOUT_MS + 3000);
  });

  const [stdoutResult, stderrResult] = await Promise.all([
    ctx.studio.process.readOutput(id, 'stdout'),
    ctx.studio.process.readOutput(id, 'stderr')
  ]);
  const stdout = stdoutResult.ok ? stdoutResult.value.trim() : '';
  const stderrText = stderrResult.ok ? stderrResult.value.trim() : '';

  if (!exit) return { ok: false, stdout, error: stderrText || 'git did not report back in time.' };
  if (exit.code !== 0) {
    return { ok: false, stdout, error: stderrText || `git exited with code ${String(exit.code)}.` };
  }
  return { ok: true, stdout, error: '' };
}

async function gitOrEmpty(ctx: AppContext, args: string[]): Promise<string> {
  const result = await runGit(ctx, args);
  return result.ok ? result.stdout : '';
}

function repositorySlugFrom(remoteUrl: string): string {
  const match = /github\.com[:/]([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?)(?:\.git)?$/.exec(remoteUrl);
  return match ? match[1] : remoteUrl;
}

export interface SelfSnapshot {
  ok: boolean;
  /** Empty when `ok` is true. */
  error: string;
  repository: string;
  branch: string;
  commit: string;
  dirty: boolean;
  /** A claim about the remote, proven by comparing SHAs rather than asserted. */
  verifiedBaseline: string;
  /** Absolute path of the checkout's top level, forward-slashed. */
  path: string;
}

/**
 * Gathers exactly the facts `scripts/report-status.mjs` would report for this
 * checkout, so the two surfaces describe the same repository the same way.
 */
export async function gatherSelfSnapshot(ctx: AppContext): Promise<SelfSnapshot> {
  const head = await runGit(ctx, ['rev-parse', 'HEAD']);
  if (!head.ok) {
    return {
      ok: false,
      error:
        head.error ||
        'This is not a Git checkout, or git is not available here. That is the ordinary state for a packaged build.',
      repository: '',
      branch: '',
      commit: '',
      dirty: false,
      verifiedBaseline: '',
      path: ''
    };
  }
  const commit = head.stdout;

  const [branch, remoteUrl, porcelain, topLevel] = await Promise.all([
    gitOrEmpty(ctx, ['rev-parse', '--abbrev-ref', 'HEAD']),
    gitOrEmpty(ctx, ['remote', 'get-url', 'origin']),
    gitOrEmpty(ctx, ['status', '--porcelain']),
    gitOrEmpty(ctx, ['rev-parse', '--show-toplevel'])
  ]);

  const repository = remoteUrl ? repositorySlugFrom(remoteUrl) : '';
  const dirty = porcelain.trim().length > 0;

  const upstream = await runGit(ctx, ['rev-parse', `origin/${branch || 'HEAD'}`]);
  let verifiedBaseline: string;
  if (upstream.ok && upstream.stdout) {
    verifiedBaseline =
      upstream.stdout === commit
        ? `${commit.slice(0, 7)} on origin/${branch}, confirmed present on the remote by SHA comparison`
        : `local ${commit.slice(0, 7)} differs from origin/${branch} at ${upstream.stdout.slice(0, 7)} — local work is not on the remote`;
  } else {
    verifiedBaseline = `${commit.slice(0, 7)} local only — origin/${branch || 'this branch'} does not exist yet, or could not be checked`;
  }

  return {
    ok: true,
    error: '',
    repository,
    branch,
    commit,
    dirty,
    verifiedBaseline,
    path: topLevel.replace(/\\/g, '/')
  };
}
