import type { StudioApi } from '../../core/registry';
import { describeError, joinPath } from './util';

/**
 * Labels and panel state, stored beside the history rather than in the settings
 * file.
 *
 * Labels belong with the entries they describe, and putting them in settings
 * would make every label edit produce a second, generic "Changed
 * history.labels" entry in the very list it is annotating. The panel's own
 * expanded/collapsed state is view state rather than data, so it is kept here
 * too and deliberately not recorded as a history event.
 *
 * Every write reports whether it actually reached disk. A label that only exists
 * in this window is a label that will be gone next launch, and the caller is
 * told so rather than shown a success it cannot rely on.
 */

const FILE_NAME = 'history-annotations.json';
const SCHEMA_VERSION = 1;
const MAX_BYTES = 4 * 1024 * 1024;
const MAX_LABEL_LENGTH = 200;

interface AnnotationDocument {
  schemaVersion: number;
  labels: Record<string, string>;
  filtersExpanded: boolean;
  updatedAt: string;
}

export interface WriteOutcome {
  ok: boolean;
  /** The exact reason the write failed, or an empty string when it succeeded. */
  error: string;
  path: string;
}

function emptyDocument(): AnnotationDocument {
  return { schemaVersion: SCHEMA_VERSION, labels: {}, filtersExpanded: true, updatedAt: new Date(0).toISOString() };
}

export class AnnotationStore {
  private document: AnnotationDocument = emptyDocument();
  private readonly path: string;
  private loaded = false;
  private lastError = '';
  private queue: Promise<WriteOutcome> = Promise.resolve({ ok: true, error: '', path: '' });

  constructor(private readonly studio: StudioApi) {
    this.path = joinPath(studio.info.userDataDir, FILE_NAME, studio.info.platform);
  }

  filePath(): string {
    return this.path;
  }

  /** True once a load has been attempted, whatever the outcome. */
  isLoaded(): boolean {
    return this.loaded;
  }

  /** The last write or read failure, for the panel's honest status line. */
  failure(): string {
    return this.lastError;
  }

  async load(): Promise<void> {
    this.loaded = true;
    const stat = await this.studio.fs.stat(this.path);
    if (!stat.ok || !stat.value.exists) {
      // No file yet is the ordinary first-run state, not a failure.
      return;
    }
    const read = await this.studio.fs.readText(this.path, MAX_BYTES);
    if (!read.ok) {
      this.lastError = read.error;
      return;
    }
    try {
      const parsed = JSON.parse(read.value) as Partial<AnnotationDocument>;
      if (!parsed || typeof parsed !== 'object') throw new Error('the file does not hold an object');
      if (parsed.schemaVersion !== SCHEMA_VERSION) {
        throw new Error(`schema version ${String(parsed.schemaVersion)} is not one this build understands`);
      }
      const labels: Record<string, string> = {};
      for (const [id, label] of Object.entries(parsed.labels ?? {})) {
        if (typeof id !== 'string' || typeof label !== 'string') continue;
        labels[id] = label.slice(0, MAX_LABEL_LENGTH);
      }
      this.document = {
        schemaVersion: SCHEMA_VERSION,
        labels,
        filtersExpanded: parsed.filtersExpanded !== false,
        updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date(0).toISOString()
      };
    } catch (error) {
      // A corrupt annotations file must never take the history panel down with
      // it: the entries are the record, and these are notes about them.
      this.lastError = `${this.path} could not be read (${describeError(error)}); labels start empty in this window.`;
      this.document = emptyDocument();
    }
  }

  labelOf(entryId: string): string {
    return this.document.labels[entryId] ?? '';
  }

  labels(): Readonly<Record<string, string>> {
    return this.document.labels;
  }

  filtersExpanded(): boolean {
    return this.document.filtersExpanded;
  }

  setFiltersExpanded(expanded: boolean): void {
    if (this.document.filtersExpanded === expanded) return;
    this.document.filtersExpanded = expanded;
    void this.persist();
  }

  /**
   * Applies one label.
   *
   * Returns `changed: false` when the label is already exactly that, so an
   * unchanged state records nothing and writes nothing.
   */
  async setLabel(entryId: string, label: string): Promise<WriteOutcome & { changed: boolean; previous: string }> {
    const previous = this.labelOf(entryId);
    const next = label.trim().slice(0, MAX_LABEL_LENGTH);
    if (previous === next) return { ok: true, error: '', path: this.path, changed: false, previous };
    if (next === '') delete this.document.labels[entryId];
    else this.document.labels[entryId] = next;
    const outcome = await this.persist();
    return { ...outcome, changed: true, previous };
  }

  /** Applies one label to many entries, reporting how many actually changed. */
  async setLabels(entryIds: string[], label: string): Promise<WriteOutcome & { changed: number }> {
    const next = label.trim().slice(0, MAX_LABEL_LENGTH);
    let changed = 0;
    for (const id of entryIds) {
      if (this.labelOf(id) === next) continue;
      if (next === '') delete this.document.labels[id];
      else this.document.labels[id] = next;
      changed += 1;
    }
    if (changed === 0) return { ok: true, error: '', path: this.path, changed: 0 };
    const outcome = await this.persist();
    return { ...outcome, changed };
  }

  /** Drops labels for entries that no longer exist, after a prune. */
  async retainOnly(existingIds: Set<string>): Promise<void> {
    let changed = false;
    for (const id of Object.keys(this.document.labels)) {
      if (existingIds.has(id)) continue;
      delete this.document.labels[id];
      changed = true;
    }
    if (changed) await this.persist();
  }

  private persist(): Promise<WriteOutcome> {
    // Writes are serialized so two quick edits cannot interleave into a file
    // holding half of each.
    this.queue = this.queue.then(async () => {
      this.document.updatedAt = new Date().toISOString();
      const result = await this.studio.fs.writeText(this.path, JSON.stringify(this.document, null, 2));
      if (!result.ok) {
        this.lastError = result.error;
        return { ok: false, error: result.error, path: this.path };
      }
      this.lastError = '';
      return { ok: true, error: '', path: this.path };
    });
    return this.queue;
  }
}
