/**
 * The single, application-lifetime render queue.
 *
 * Rendering is a background runner exactly like the vault's own committer:
 * enabling `worldvaultrenders.enabled` must queue a render for every new
 * commit whether or not the user has the Renders tab open right now, the
 * same way turning on the download does not require a particular tab to stay
 * mounted. Building the queue inside the tab's own `mount` would tie its
 * lifetime — and the vault-commit subscription that drives auto-enqueueing —
 * to that tab being open, which is exactly wrong for a background feature.
 *
 * `ensureQueue` is created once, from `init`, and is idempotent: calling it
 * again (which the tab's `mount` also does, to get the same instance for its
 * own UI subscription) returns the existing queue rather than building a
 * second one with its own, disagreeing state.
 */

import type { AppContext } from '../../core/registry';
import { RenderQueue, type QueueEvents } from './queue';
import { featureDirectories, loadPersistedRecords, savePersistedRecords, SETTINGS } from './store';
import { listVaultCommits, listVaults, subscribeVaultCommits, type VaultCommit } from './vaultLink';

let sharedQueue: RenderQueue | null = null;
let persistTimer: ReturnType<typeof setTimeout> | null = null;

export function ensureQueue(ctx: AppContext): RenderQueue {
  if (sharedQueue) return sharedQueue;

  const paths = featureDirectories(ctx.studio);
  const events: QueueEvents = {
    onHistory: (action, payload) => void ctx.history.record(action, 'worldvaultrenders', payload),
    onBacklog: (depth) => {
      ctx.notify.warn(
        ctx.t('worldvaultrenders.backlog.title', 'The render queue is falling behind'),
        ctx.t('worldvaultrenders.backlog.body', '{count} renders are waiting. Nothing is being dropped; they will run in order.', {
          values: { count: depth }
        })
      );
    }
  };

  const queue = new RenderQueue(
    ctx.studio,
    paths,
    () => ({
      concurrency: Number(ctx.settings.get(SETTINGS.concurrency, 1)),
      rendererPath: String(ctx.settings.get(SETTINGS.rendererPath, '')),
      acceptDownload: Boolean(ctx.settings.get(SETTINGS.acceptDownload, false)),
      threads: Number(ctx.settings.get(SETTINGS.threads, 0))
    }),
    events,
    () => Number(ctx.settings.get(SETTINGS.backlogWarningThreshold, 5))
  );

  const vaults = listVaults();
  const allKnownCommits: VaultCommit[] = [];
  for (const vault of vaults) allKnownCommits.push(...listVaultCommits(vault.id));
  queue.hydrate(loadPersistedRecords(ctx.settings), allKnownCommits);

  const schedulePersist = (): void => {
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => savePersistedRecords(ctx.settings, queue.snapshot()), 1000);
  };
  queue.subscribe(schedulePersist);

  // The one place a commit is auto-enqueued, independent of any tab's
  // lifetime. `enabled` is read fresh on every new commit rather than once,
  // so turning the setting on mid-session starts covering commits from that
  // point without needing a restart.
  subscribeVaultCommits((commit) => {
    if (Boolean(ctx.settings.get(SETTINGS.enabled, false))) queue.enqueue(commit);
  });

  sharedQueue = queue;
  return queue;
}
