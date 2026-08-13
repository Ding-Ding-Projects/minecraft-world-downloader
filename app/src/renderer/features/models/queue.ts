import { listInstalled, pullAttempt } from './api';
import type { ModelsState, QueueItem } from './state';
import { nowIso, splitReference } from './util';

/**
 * The batch pull queue.
 *
 * It is a download queue and nothing else. There is no price, no basket total,
 * no checkout, no account, no subscription and no entitlement anywhere in it:
 * adding a variant schedules a local pull, and removing one unschedules it.
 *
 * The shape of an item's life is decided by a real constraint. The privileged
 * network boundary caps any single request at two minutes and hands the body
 * back buffered, so a multi-gigabyte pull cannot be one request that reports its
 * own bytes as they arrive. Instead each item runs as a sequence of bounded
 * attempts: the runtime keeps the layers it has already fetched and resumes from
 * them, and after every attempt the queue asks the runtime's own installed list
 * whether the model is now there. That list is the only thing that actually
 * proves a pull landed, so it — and not a status line — is what marks an item
 * done.
 *
 * An attempt that completes inside the window carries every progress line the
 * runtime emitted, so the byte totals shown are the runtime's own measurements
 * rather than an estimate.
 */

export interface QueueSummary {
  queued: number;
  running: number;
  done: number;
  failed: number;
  cancelled: number;
  skipped: number;
  /** Bytes the catalog said the outstanding work would transfer, when known. */
  outstandingBytes: number | null;
  /** True when at least one outstanding item has no published size. */
  outstandingUnknown: boolean;
}

let counter = 0;
function newId(): string {
  counter += 1;
  return `pull-${Date.now().toString(36)}-${counter.toString(36)}`;
}

export class PullQueue {
  private active = false;
  private readonly cancelled = new Set<string>();
  private workers = 0;

  constructor(private readonly state: ModelsState) {}

  isRunning(): boolean {
    return this.active;
  }

  summary(): QueueSummary {
    const summary: QueueSummary = {
      queued: 0,
      running: 0,
      done: 0,
      failed: 0,
      cancelled: 0,
      skipped: 0,
      outstandingBytes: null,
      outstandingUnknown: false
    };
    let bytes = 0;
    let sawBytes = false;
    for (const item of this.state.queue) {
      summary[item.status] += 1;
      if (item.status === 'queued' || item.status === 'running') {
        if (item.expectedBytes === null) summary.outstandingUnknown = true;
        else {
          bytes += item.expectedBytes;
          sawBytes = true;
        }
      }
    }
    summary.outstandingBytes = sawBytes ? bytes : null;
    return summary;
  }

  /** Adds references, skipping anything already queued or already installed. */
  add(refs: string[]): { added: string[]; alreadyQueued: string[]; alreadyInstalled: string[] } {
    const added: string[] = [];
    const alreadyQueued: string[] = [];
    const alreadyInstalled: string[] = [];
    const installed = new Set(this.state.installed.map((model) => model.name));
    const pending = new Set(
      this.state.queue.filter((item) => item.status === 'queued' || item.status === 'running').map((item) => item.ref)
    );

    for (const ref of refs) {
      const { repository, tag } = splitReference(ref);
      const canonical = `${repository}:${tag}`;
      if (pending.has(canonical)) {
        alreadyQueued.push(canonical);
        continue;
      }
      if (installed.has(canonical)) {
        alreadyInstalled.push(canonical);
        continue;
      }
      const variant = this.state.variant(canonical);
      this.state.queue.push({
        id: newId(),
        ref: canonical,
        addedAt: nowIso(),
        status: 'queued',
        attempts: 0,
        maxAttempts: this.state.pullAttemptBudget(),
        lastStatusLine: '',
        totalBytes: null,
        completedBytes: null,
        expectedBytes: variant?.downloadBytes ?? variant?.modelBytes ?? null,
        error: null,
        startedAt: null,
        finishedAt: null
      });
      pending.add(canonical);
      added.push(canonical);
    }
    if (added.length > 0) this.state.saveQueue();
    return { added, alreadyQueued, alreadyInstalled };
  }

  /** Removes items outright. Used by the bulk actions on the queue list. */
  remove(ids: string[]): number {
    const set = new Set(ids);
    for (const item of this.state.queue) {
      if (set.has(item.id) && item.status === 'running') this.cancelled.add(item.id);
    }
    const before = this.state.queue.length;
    this.state.queue = this.state.queue.filter((item) => !set.has(item.id));
    this.state.saveQueue();
    return before - this.state.queue.length;
  }

  /** Marks items cancelled without removing their record. */
  cancel(ids: string[]): number {
    let changed = 0;
    for (const item of this.state.queue) {
      if (!ids.includes(item.id)) continue;
      if (item.status === 'done' || item.status === 'failed' || item.status === 'cancelled') continue;
      this.cancelled.add(item.id);
      item.status = 'cancelled';
      item.finishedAt = nowIso();
      item.error = 'Cancelled before it finished. Any layers already fetched stay on disk and a retry resumes from them.';
      changed += 1;
    }
    if (changed > 0) this.state.saveQueue();
    return changed;
  }

  /** Returns finished-but-unsuccessful items to the queue for another go. */
  retry(ids: string[]): number {
    let changed = 0;
    for (const item of this.state.queue) {
      if (!ids.includes(item.id)) continue;
      if (item.status === 'running' || item.status === 'queued') continue;
      this.cancelled.delete(item.id);
      item.status = 'queued';
      item.error = null;
      item.finishedAt = null;
      item.maxAttempts = item.attempts + this.state.pullAttemptBudget();
      changed += 1;
    }
    if (changed > 0) this.state.saveQueue();
    return changed;
  }

  /**
   * Reconciles every item against what the runtime actually holds.
   *
   * Run on start-up, this is what makes a queue durable across a restart: an
   * item that finished while the application was closed is marked done from the
   * evidence rather than pulled a second time, and an item that is still
   * outstanding keeps its place.
   */
  async reconcile(): Promise<{ resolved: number }> {
    const result = await listInstalled(this.state.ctx.studio, this.state.runtimeConfig());
    if (!result.ok) return { resolved: 0 };
    const installed = new Set(result.value.map((model) => model.name));
    let resolved = 0;
    for (const item of this.state.queue) {
      if (item.status === 'done') continue;
      if (!installed.has(item.ref)) continue;
      item.status = 'done';
      item.finishedAt = item.finishedAt ?? nowIso();
      item.error = null;
      item.lastStatusLine = item.lastStatusLine || 'Verified against the runtime installed list.';
      resolved += 1;
    }
    if (resolved > 0) this.state.saveQueue();
    return { resolved };
  }

  /** Starts processing. Safe to call while already running. */
  start(): void {
    if (this.active) return;
    this.active = true;
    this.state.emit('queue');
    void this.pump();
  }

  /** Stops taking new items. Anything mid-attempt finishes its current attempt. */
  stop(): void {
    if (!this.active) return;
    this.active = false;
    this.state.emit('queue');
  }

  private nextQueued(): QueueItem | null {
    return this.state.queue.find((item) => item.status === 'queued') ?? null;
  }

  private async pump(): Promise<void> {
    const parallelism = this.state.pullParallelism();
    while (this.active && this.workers < parallelism) {
      const item = this.nextQueued();
      if (!item) break;
      item.status = 'running';
      item.startedAt = item.startedAt ?? nowIso();
      this.state.saveQueue();
      this.workers += 1;
      void this.run(item).finally(() => {
        this.workers -= 1;
        if (this.active) void this.pump();
        else if (this.workers === 0) this.state.emit('queue');
      });
    }
    if (this.workers === 0 && !this.nextQueued()) {
      this.active = false;
      this.state.emit('queue');
    }
  }

  private async run(item: QueueItem): Promise<void> {
    const config = this.state.runtimeConfig();

    while (this.active && !this.cancelled.has(item.id) && item.attempts < item.maxAttempts) {
      item.attempts += 1;
      this.state.saveQueue();

      const outcome = await pullAttempt(this.state.ctx.studio, config, item.ref, config.timeoutMs);
      if (this.cancelled.has(item.id)) break;

      if (outcome.ok) {
        item.lastStatusLine = outcome.value.status;
        item.totalBytes = outcome.value.totalBytes;
        item.completedBytes = outcome.value.completedBytes;
        if (outcome.value.succeeded) {
          const verified = await this.verify(item);
          if (verified) return;
          item.error =
            'The runtime reported success but the model is not in its installed list. Nothing was assumed; retry to see whether it appears.';
          item.status = 'failed';
          item.finishedAt = nowIso();
          this.state.saveQueue();
          return;
        }
        item.error = `The attempt ended without success. The runtime's last line was "${outcome.value.status}".`;
      } else {
        item.error = outcome.error;
        item.lastStatusLine = item.lastStatusLine || 'No progress line arrived within the request window.';
      }

      // An attempt that ran out of window may still have completed the pull.
      const verified = await this.verify(item);
      if (verified) return;
      this.state.saveQueue();
    }

    if (this.cancelled.has(item.id)) {
      item.status = 'cancelled';
      item.finishedAt = nowIso();
      item.error =
        'Cancelled before it finished. Any layers already fetched stay on disk and a retry resumes from them.';
    } else if (item.attempts >= item.maxAttempts) {
      item.status = 'failed';
      item.finishedAt = nowIso();
      item.error = `${item.error ?? 'The pull did not complete.'} It used its whole budget of ${
        item.maxAttempts
      } attempts. Raise the budget in Settings, or retry, and the runtime will resume from the layers it already has.`;
    } else {
      // The queue was stopped rather than the item failing.
      item.status = 'queued';
    }
    this.state.saveQueue();
  }

  private async verify(item: QueueItem): Promise<boolean> {
    const result = await listInstalled(this.state.ctx.studio, this.state.runtimeConfig());
    if (!result.ok) return false;
    this.state.installed = result.value;
    this.state.mergeInstalledIntoCatalog();
    this.state.emit('installed');
    if (!result.value.some((model) => model.name === item.ref)) return false;
    item.status = 'done';
    item.finishedAt = nowIso();
    item.error = null;
    if (item.lastStatusLine === '') item.lastStatusLine = 'Verified against the runtime installed list.';
    this.state.saveQueue();
    return true;
  }
}
