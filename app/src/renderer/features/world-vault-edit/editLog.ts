/**
 * The persisted log of edits made through this panel.
 *
 * This is a convenience index for the panel's own list surface — search,
 * export, bulk-clear — distinct from the world vault's own commit history,
 * which is the thing that actually makes an edit undoable. Every real edit
 * still goes through `ctx.history.record` and the vault's `commitEdit`; this
 * store exists so a user can see, search and export what THIS feature did
 * without having to read commit messages out of the vault's timeline.
 */

import { MAX_LOG_ENTRIES, STORE_EDIT_LOG, logEntryToRecord, normaliseLog, type EditLogEntry } from './model';
import type { HistoryRecorder, SettingsStore } from '../../core/registry';

export class EditLogStore {
  private entries: EditLogEntry[];

  private readonly listeners = new Set<() => void>();

  constructor(
    private readonly settings: SettingsStore,
    private readonly history: HistoryRecorder
  ) {
    this.entries = normaliseLog(this.settings.get<unknown>(STORE_EDIT_LOG, []));
  }

  all(): EditLogEntry[] {
    return this.entries.map((entry) => ({ ...entry }));
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Appends one entry (newest first) and records it in the application's own history. */
  async add(entry: EditLogEntry): Promise<void> {
    this.entries = [entry, ...this.entries].slice(0, MAX_LOG_ENTRIES);
    this.persist();
    await this.history.record(
      entry.kind === 'copy' ? 'Copied a chunk in the world vault edit grid' : 'Removed chunks in the world vault edit grid',
      'worldvaultedit',
      logEntryToRecord(entry)
    );
  }

  async remove(ids: string[]): Promise<number> {
    const wanted = new Set(ids);
    const before = this.entries.length;
    this.entries = this.entries.filter((entry) => !wanted.has(entry.id));
    const removed = before - this.entries.length;
    if (removed === 0) return 0;
    this.persist();
    await this.history.record('Cleared entries from the world vault edit log', 'worldvaultedit', { count: removed, ids: [...wanted] });
    return removed;
  }

  async clear(): Promise<number> {
    if (this.entries.length === 0) return 0;
    const count = this.entries.length;
    this.entries = [];
    this.persist();
    await this.history.record('Cleared the world vault edit log', 'worldvaultedit', { count });
    return count;
  }

  private persist(): void {
    this.settings.set(STORE_EDIT_LOG, this.entries.map(logEntryToRecord));
    for (const listener of this.listeners) listener();
  }
}
