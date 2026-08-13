import type { AppContext } from '../../core/registry';
import { gatherSelfSnapshot } from './git';
import { createSelfLane, SELF_LANE_ID } from './model';
import type { LaneRecord } from './model';
import { StatusStore } from './store';
import type { WriteOutcome } from './store';

export const AUTO_REFRESH_ID = 'status.autoRefresh';
export const AUTO_REFRESH_SECONDS_ID = 'status.autoRefreshSeconds';

const MIN_AUTO_REFRESH_SECONDS = 15;
const DEFAULT_AUTO_REFRESH_SECONDS = 60;

/** A record edit or deletion is recorded, and never breaks the caller's own operation. */
export async function recordEntry(ctx: AppContext, action: string, payload: unknown): Promise<void> {
  await ctx.history.record(action, 'status', payload);
}

/**
 * The feature's shared state: the on-disk store, the Git refresh routine for
 * this checkout, and a tiny change-notification list so every open view of the
 * tab (there is only ever one, but the pattern costs nothing) redraws when
 * something changes underneath it.
 */
export class FeatureState {
  readonly store: StatusStore;
  private refreshing = false;
  private refreshError = '';
  private lastAttemptAt = '';
  private timer: number | null = null;
  private readonly listeners = new Set<() => void>();

  constructor(public readonly ctx: AppContext) {
    this.store = new StatusStore(ctx.studio);
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }

  isRefreshing(): boolean {
    return this.refreshing;
  }

  /** Empty when the last refresh succeeded, or none has run yet. */
  lastRefreshError(): string {
    return this.refreshError;
  }

  /** ISO-8601, or empty if this checkout has never been refreshed this session. */
  lastRefreshedAt(): string {
    return this.lastAttemptAt;
  }

  async loadFromDisk(): Promise<void> {
    await this.store.load();
    this.notify();
  }

  /** Re-reads real Git state for this checkout and merges it into the local lane. */
  async refreshSelf(): Promise<{ ok: boolean; error: string }> {
    if (this.refreshing) return { ok: true, error: '' };
    this.refreshing = true;
    this.notify();

    const snapshot = await gatherSelfSnapshot(this.ctx);
    const lanes = this.store.lanes();
    const self = lanes.find((lane) => lane.id === SELF_LANE_ID) ?? createSelfLane();
    const now = new Date().toISOString();

    // `lastAttemptAt`/`refreshError` track the ATTEMPT, shown beside the
    // record regardless of outcome. `lane.updatedAt` tracks the RECORD, and
    // only moves when the record's own content actually changed — a failed
    // attempt leaves the last-known-good facts exactly as they were, dated
    // honestly, rather than claiming they were just refreshed.
    this.lastAttemptAt = now;
    this.refreshError = snapshot.ok ? '' : snapshot.error;

    if (!snapshot.ok) {
      this.refreshing = false;
      this.notify();
      return { ok: false, error: this.refreshError };
    }

    const merged: LaneRecord = {
      ...self,
      repository: snapshot.repository || self.repository,
      branch: snapshot.branch || self.branch,
      verifiedBaseline: snapshot.verifiedBaseline,
      worktrees: [{ path: snapshot.path, branch: snapshot.branch, commit: snapshot.commit, bytes: 0, dirty: snapshot.dirty }],
      updatedAt: now
    };

    const outcome = await this.store.upsertLane(merged);
    this.refreshing = false;
    if (!outcome.ok) this.refreshError = outcome.error;
    this.notify();
    return { ok: outcome.ok, error: this.refreshError };
  }

  /** Fields a person can set on the local lane without touching Git-derived facts. */
  async updateSelfFields(
    patch: Pick<LaneRecord, 'title' | 'status' | 'summary' | 'assumption' | 'evidence' | 'nextGates' | 'agent' | 'machine'>
  ): Promise<WriteOutcome> {
    const lanes = this.store.lanes();
    const self = lanes.find((lane) => lane.id === SELF_LANE_ID) ?? createSelfLane();
    const merged: LaneRecord = { ...self, ...patch, updatedAt: new Date().toISOString() };
    const outcome = await this.store.upsertLane(merged);
    if (outcome.ok) {
      await recordEntry(this.ctx, 'Updated this checkout’s local status record', {
        id: SELF_LANE_ID,
        status: merged.status
      });
    }
    this.notify();
    return outcome;
  }

  async addLane(lane: LaneRecord): Promise<WriteOutcome> {
    const outcome = await this.store.upsertLane(lane);
    if (outcome.ok) {
      await recordEntry(this.ctx, `Added a local status lane: ${lane.title}`, { id: lane.id, title: lane.title, status: lane.status });
    }
    this.notify();
    return outcome;
  }

  async updateLane(lane: LaneRecord): Promise<WriteOutcome> {
    const outcome = await this.store.upsertLane(lane);
    if (outcome.ok) {
      await recordEntry(this.ctx, `Updated the status lane "${lane.title}"`, { id: lane.id, title: lane.title, status: lane.status });
    }
    this.notify();
    return outcome;
  }

  async removeLanes(ids: string[], titles: string[]): Promise<WriteOutcome> {
    const outcome = await this.store.removeLanes(ids);
    if (outcome.ok) {
      await recordEntry(this.ctx, `Removed ${ids.length} status lane(s): ${titles.join(', ')}`, { ids });
    }
    this.notify();
    return outcome;
  }

  /** Starts (or restarts, after a setting changed) the background self-refresh timer. */
  startAutoRefresh(): void {
    this.stopAutoRefresh();
    if (this.ctx.settings.get<boolean>(AUTO_REFRESH_ID, true) !== true) return;
    const raw = Number(this.ctx.settings.get<number>(AUTO_REFRESH_SECONDS_ID, DEFAULT_AUTO_REFRESH_SECONDS));
    const seconds = Number.isFinite(raw) && raw >= MIN_AUTO_REFRESH_SECONDS ? Math.round(raw) : DEFAULT_AUTO_REFRESH_SECONDS;
    this.timer = window.setInterval(() => void this.refreshSelf(), seconds * 1000);
  }

  stopAutoRefresh(): void {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }
}
