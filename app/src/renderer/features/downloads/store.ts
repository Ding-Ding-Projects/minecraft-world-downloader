import type { AppContext } from '../../core/registry';
import {
  isDownloadRecord,
  reconcileAfterRestart,
  type DownloadRecord,
  type DownloadState
} from './model';
import { DOWNLOAD_SETTINGS } from './settingIds';

/**
 * The download list, and the one place it is written.
 *
 * Records live in the settings document, which is the same store every other
 * preference uses, so a download list survives a restart exactly as a theme
 * does. What does NOT survive is the transfer engine, so every record that was
 * moving bytes is reconciled to `interrupted` on load rather than restored as
 * though it were still running.
 */

type Listener = (records: DownloadRecord[]) => void;

const PERSIST_DEBOUNCE_MS = 250;

export class DownloadStore {
  private records: DownloadRecord[] = [];
  private readonly listeners = new Set<Listener>();
  private timer: number | null = null;
  private ctx: AppContext | null = null;

  attach(ctx: AppContext): void {
    this.ctx = ctx;
    const stored = ctx.settings.get<unknown>(DOWNLOAD_SETTINGS.records, []);
    const rows = Array.isArray(stored) ? stored : [];
    this.records = rows.filter(isDownloadRecord).map(reconcileAfterRestart);
    this.emit();
  }

  all(): DownloadRecord[] {
    return [...this.records];
  }

  byId(id: string): DownloadRecord | null {
    return this.records.find((record) => record.id === id) ?? null;
  }

  byCaptureId(captureId: string): DownloadRecord | null {
    return this.records.find((record) => record.captureId === captureId) ?? null;
  }

  inState(...states: DownloadState[]): DownloadRecord[] {
    return this.records.filter((record) => states.includes(record.state));
  }

  onChange(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  add(record: DownloadRecord): DownloadRecord {
    this.records = [record, ...this.records];
    this.persist();
    this.emit();
    return record;
  }

  /**
   * Applies a patch to one record. Returns the updated record, or null when the
   * id is unknown — which happens legitimately when a late engine event arrives
   * for a download the user has already removed.
   */
  patch(id: string, patch: Partial<DownloadRecord>): DownloadRecord | null {
    const index = this.records.findIndex((record) => record.id === id);
    if (index < 0) return null;
    const updated = { ...this.records[index], ...patch };
    this.records = [...this.records.slice(0, index), updated, ...this.records.slice(index + 1)];
    this.persist();
    this.emit();
    return updated;
  }

  remove(ids: string[]): DownloadRecord[] {
    const removing = new Set(ids);
    const removed = this.records.filter((record) => removing.has(record.id));
    if (removed.length === 0) return [];
    this.records = this.records.filter((record) => !removing.has(record.id));
    this.persist();
    this.emit();
    return removed;
  }

  /** Replaces the whole list. Used by an undo that restores an earlier state. */
  replaceAll(records: DownloadRecord[]): void {
    this.records = records.map((record) => ({ ...record }));
    this.persist();
    this.emit();
  }

  private emit(): void {
    const snapshot = this.all();
    for (const listener of [...this.listeners]) {
      try {
        listener(snapshot);
      } catch {
        /* a listener that throws never stops the rest of the list updating */
      }
    }
  }

  /**
   * Writes the list back, coalescing the burst of updates a running transfer
   * produces. Progress arrives several times a second; writing the settings
   * file that often would be a lot of disk traffic for a number that is
   * recomputed the moment a transfer resumes anyway.
   */
  private persist(): void {
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => {
      this.timer = null;
      this.ctx?.settings.set(DOWNLOAD_SETTINGS.records, this.all());
    }, PERSIST_DEBOUNCE_MS);
  }

  /** Forces the pending write out, for a quit or an explicit export. */
  flush(): void {
    if (this.timer !== null) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
    this.ctx?.settings.set(DOWNLOAD_SETTINGS.records, this.all());
  }
}

export const downloadStore = new DownloadStore();

/** The row shape used by every export and by the data table. */
export interface DownloadRow extends Record<string, unknown> {
  id: string;
  filename: string;
  state: DownloadState;
  host: string;
  url: string;
  destination: string;
  receivedBytes: number;
  totalBytes: number | null;
  bytesPerSecond: number;
  origin: string;
  capturedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  error: string;
  note: string;
}

export function toRow(record: DownloadRecord): DownloadRow {
  return {
    id: record.id,
    filename: record.filename,
    state: record.state,
    host: record.host,
    url: record.url,
    destination: record.destination,
    receivedBytes: record.received,
    totalBytes: record.total,
    bytesPerSecond: record.bytesPerSecond,
    origin: record.origin,
    capturedAt: record.capturedAt,
    startedAt: record.startedAt,
    finishedAt: record.finishedAt,
    error: record.error,
    note: record.note
  };
}

/** Everything a row can be matched against by the search field. */
export function searchableText(record: DownloadRecord): string {
  return [record.filename, record.host, record.url, record.destination, record.state, record.origin, record.error]
    .filter((part) => typeof part === 'string' && part.length > 0)
    .join('\n');
}
