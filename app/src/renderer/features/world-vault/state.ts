import type { AppContext } from '../../core/registry';
import type { WorldVaultCommit, WorldVaultEvent, WorldVaultStatus } from '../../../shared/api';
import { registerKnownVault, setActiveWorldPath } from './contract';

/**
 * Shared UI-facing state for the vault tab.
 *
 * One instance is created in `init` and the panel reads and writes through
 * it, so a palette command that opens the tab and a settings action that
 * changes the world path can never disagree about which world is selected.
 */

export const WORLD_PATH_ID = 'world-vault.worldPath';
export const QUIET_PERIOD_ID = 'world-vault.quietPeriodMs';
export const POLL_INTERVAL_ID = 'world-vault.pollIntervalMs';
export const AUTO_START_ID = 'world-vault.runnerAutoStart';
export const PUBLISH_VISIBILITY_ID = 'world-vault.publishVisibilityDefault';

export const DEFAULT_QUIET_PERIOD_MS = 8_000;
export const DEFAULT_POLL_INTERVAL_MS = 2_000;

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value >= 100 ? Math.round(value) : Math.round(value * 10) / 10} ${units[unitIndex]}`;
}

export function formatSeconds(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}m ${remaining}s`;
}

export function formatTimestamp(iso: string): string {
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return iso;
  return new Date(parsed).toLocaleString();
}

type Hook = () => void;

export class VaultFeatureState {
  worldPath = '';
  status: WorldVaultStatus | null = null;
  commits: WorldVaultCommit[] = [];
  lastError = '';

  private statusListeners = new Set<(status: WorldVaultStatus | null) => void>();
  private commitListeners = new Set<(commit: WorldVaultCommit, status: WorldVaultStatus) => void>();
  private unsubscribeEvents: (() => void) | null = null;
  private refreshHook: Hook | null = null;
  private focusSearchHook: Hook | null = null;

  constructor(private readonly ctx: AppContext) {
    this.worldPath = String(ctx.settings.get<string>(WORLD_PATH_ID, ''));
  }

  registerRefresh(hook: Hook): void {
    this.refreshHook = hook;
  }
  registerFocusSearch(hook: Hook): void {
    this.focusSearchHook = hook;
  }
  private run(hook: Hook | null, tabId: string, again: () => Hook | null): void {
    if (hook) {
      hook();
      return;
    }
    this.ctx.tabs.open(tabId);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => again()?.());
    });
  }
  refresh(): void {
    this.run(this.refreshHook, 'world-vault.main', () => this.refreshHook);
  }
  focusSearch(): void {
    this.ctx.tabs.teleport('world-vault.main', 'worldvault-search');
    this.run(this.focusSearchHook, 'world-vault.main', () => this.focusSearchHook);
  }

  onStatusChange(listener: (status: WorldVaultStatus | null) => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }
  onCommit(listener: (commit: WorldVaultCommit, status: WorldVaultStatus) => void): () => void {
    this.commitListeners.add(listener);
    return () => this.commitListeners.delete(listener);
  }

  setWorldPath(path: string): void {
    const trimmed = path.trim();
    if (trimmed === this.worldPath) return;
    this.worldPath = trimmed;
    this.ctx.settings.set(WORLD_PATH_ID, trimmed);
    setActiveWorldPath(trimmed || null);
    this.rewireEvents();
    void this.reload();
  }

  quietPeriodMs(): number {
    const raw = Number(this.ctx.settings.get<number>(QUIET_PERIOD_ID, DEFAULT_QUIET_PERIOD_MS));
    return Number.isFinite(raw) && raw >= 1000 ? Math.round(raw) : DEFAULT_QUIET_PERIOD_MS;
  }
  pollIntervalMs(): number {
    const raw = Number(this.ctx.settings.get<number>(POLL_INTERVAL_ID, DEFAULT_POLL_INTERVAL_MS));
    return Number.isFinite(raw) && raw >= 500 ? Math.round(raw) : DEFAULT_POLL_INTERVAL_MS;
  }
  autoStart(): boolean {
    return this.ctx.settings.get<boolean>(AUTO_START_ID, true) === true;
  }

  async reload(): Promise<void> {
    if (!this.worldPath) {
      this.status = null;
      this.lastError = '';
      this.notifyStatus();
      return;
    }
    const result = await this.ctx.studio.worldVault.status(this.worldPath);
    if (!result.ok) {
      this.lastError = result.error;
      this.status = null;
    } else {
      this.lastError = '';
      this.status = result.value;
      registerKnownVault(this.worldPath, result.value.exists);
    }
    this.notifyStatus();
  }

  async reloadCommits(): Promise<void> {
    if (!this.worldPath) {
      this.commits = [];
      return;
    }
    const result = await this.ctx.studio.worldVault.commits({ worldPath: this.worldPath, limit: 200 });
    if (result.ok) this.commits = result.value;
  }

  private notifyStatus(): void {
    for (const listener of this.statusListeners) listener(this.status);
  }

  private rewireEvents(): void {
    this.unsubscribeEvents?.();
    this.unsubscribeEvents = null;
    if (!this.worldPath) return;
    const path = this.worldPath;
    this.unsubscribeEvents = this.ctx.studio.events.on('worldvault:event', (event: WorldVaultEvent) => {
      if (event.worldPath !== path) return;
      if (event.kind === 'status') {
        this.status = event.status;
        this.notifyStatus();
      } else if (event.kind === 'commit') {
        this.status = event.status;
        this.notifyStatus();
        for (const listener of this.commitListeners) listener(event.commit, event.status);
      }
    });
  }

  dispose(): void {
    this.unsubscribeEvents?.();
    this.unsubscribeEvents = null;
  }

  start(): void {
    setActiveWorldPath(this.worldPath || null);
    this.rewireEvents();
    void this.reload();
    void this.reloadCommits();
  }
}
