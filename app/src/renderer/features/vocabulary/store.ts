import type { AppContext } from '../../core/registry';
import { dialogDecoration } from './emoji';
import {
  VOCABULARY_CONTRACT,
  blankTemplate,
  inApplicationOrder,
  serializeDocument,
  validateVocabularyPayload
} from './schema';
import type { VocabularyEntry, VocabularyRejection } from './schema';

/**
 * The personal vocabulary's state and every operation on it.
 *
 * Three rules shape this file.
 *
 * LOCAL ONLY. Nothing here opens a socket. The file is chosen through the
 * platform's own picker, read through the privileged bridge's scoped file
 * reader, validated in this process, and cached in this application's own data
 * folder. There is no fetch, no upload, no CDN and no telemetry anywhere in this
 * feature, and no code path that could grow one without this comment becoming
 * false.
 *
 * FAIL CLOSED. Every route out of an unexpected state ends at the wording this
 * build ships with. A refused file changes nothing; a cache that stops
 * validating is dropped and reported rather than half-applied; an empty document
 * is a valid document that replaces nothing.
 *
 * NOTHING LEAKS. Terms, values, the file's name and the file's path never reach
 * a log, an export, a history entry or a notification body. What history gets is
 * a count and a stable rejection CODE — enough to see what happened, carrying no
 * fragment of what it happened to.
 */

/* ------------------------------------------------------------------ */
/* Persisted keys                                                      */
/* ------------------------------------------------------------------ */

/**
 * Every key this feature persists sits under the `vocabulary.` prefix.
 *
 * That prefix is not decoration: the core settings export and the automatic
 * settings-history recorder both skip it wholesale, so the private word list
 * cannot reach an exported file or a durable history entry by being forgotten.
 * The cost is that this destination's ordinary options are skipped too, which is
 * stated in the documentation rather than worked around.
 */
export const VOCABULARY_KEYS = {
  /** The complete validated source document, including suppressed entries. */
  source: 'vocabulary.source',
  /** Keys currently suppressed: present in the source, deliberately not applied. */
  suppressed: 'vocabulary.suppressed',
  /** ISO-8601 time of the last successful load. Not the file's own timestamp. */
  loadedAt: 'vocabulary.loadedAt',
  /** Whether this destination lists the terms on screen. */
  showEntries: 'vocabulary.showEntries',
  /** Rows per page, which is also the scope of "select the page". */
  pageSize: 'vocabulary.pageSize',
  /** The preview's starting text. */
  sample: 'vocabulary.sample',
  /** True while the named study mode has taken this destination out of the strip. */
  schoolHiddenTab: 'vocabulary.schoolHiddenTab'
} as const;

/**
 * The shared language layer's own cache key.
 *
 * Read-only, and never written from here. The settings surface carries a second
 * upload control that writes straight to the language layer, so a vocabulary can
 * legitimately arrive without this feature ever seeing the file. Reading that
 * cache lets this destination stay truthful about what is actually applied
 * instead of claiming nothing is loaded while replacements are visibly
 * happening. Every read is shape-checked, and a shape this does not recognize
 * degrades to an honest "loaded elsewhere" state rather than an exception.
 */
const LANGUAGE_LAYER_CACHE_KEY = 'vocabulary.cache';
/** The count the settings surface's own control displays. Kept in step. */
const LANGUAGE_LAYER_COUNT_KEY = 'vocabulary.count';

export const DEFAULT_PAGE_SIZE = 50;
export const DEFAULT_SHOW_ENTRIES = true;
export const DEFAULT_SAMPLE = '';

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

export interface VocabularyState {
  /** False while the named study mode is on: the capability is not installed. */
  available: boolean;
  /** True once a validated document is held. A zero-entry document counts. */
  loaded: boolean;
  /** True when a vocabulary is applied but its entries cannot be listed here. */
  loadedElsewhere: boolean;
  total: number;
  active: number;
  suppressed: number;
  /** ISO-8601, or null when nothing has been loaded. */
  loadedAt: string | null;
  /** The last refusal, held until it is dismissed or a load succeeds. */
  rejection: VocabularyRejection | null;
  /** True when a persisted cache stopped validating and was dropped. */
  cacheDropped: boolean;
}

interface StoredSource {
  version: number;
  entries: Array<[string, string]>;
}

function isStoredSource(value: unknown): value is StoredSource {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<StoredSource>;
  if (typeof candidate.version !== 'number') return false;
  if (!Array.isArray(candidate.entries)) return false;
  return candidate.entries.every(
    (pair) => Array.isArray(pair) && pair.length === 2 && typeof pair[0] === 'string' && typeof pair[1] === 'string'
  );
}

/* ------------------------------------------------------------------ */
/* The store                                                           */
/* ------------------------------------------------------------------ */

export class VocabularyStore {
  private readonly listeners = new Set<(state: VocabularyState) => void>();
  private source: VocabularyEntry[] = [];
  private version: number = VOCABULARY_CONTRACT.currentVersion;
  private suppressed = new Set<string>();
  private rejection: VocabularyRejection | null = null;
  private cacheDropped = false;
  private everLoaded = false;
  private loadedElsewhere = false;

  constructor(private readonly ctx: AppContext) {}

  /* ---------------- lifecycle ---------------- */

  /**
   * Restores the persisted copy at boot, revalidating it first.
   *
   * The cache is revalidated rather than trusted. A settings file can be edited
   * by hand, copied between machines or written by an older build, and a cache
   * that no longer meets the contract must not be applied because it once did.
   */
  restore(): void {
    const stored = this.ctx.settings.get<unknown>(VOCABULARY_KEYS.source, null);
    if (stored !== null && stored !== undefined) {
      if (!isStoredSource(stored)) {
        this.dropCache();
      } else {
        const revalidated = validateVocabularyPayload(
          serializeDocument(
            stored.entries.map(([from, to]) => ({ from, to })),
            stored.version
          )
        );
        if (revalidated.ok) {
          this.source = revalidated.document.entries;
          this.version = revalidated.document.version;
          this.everLoaded = true;
          const suppressedList = this.ctx.settings.get<unknown>(VOCABULARY_KEYS.suppressed, []);
          const known = new Set(this.source.map((entry) => entry.from));
          this.suppressed = new Set(
            Array.isArray(suppressedList)
              ? suppressedList.filter((key): key is string => typeof key === 'string' && known.has(key))
              : []
          );
        } else {
          this.dropCache();
        }
      }
    }

    this.adoptExternalCacheIfNeeded();
    // The language layer restored its own cache before this ran. Re-applying the
    // active set makes the two agree even when suppression was persisted after
    // the last load, so what is applied is always what this destination reports.
    void this.apply({ silent: true });
    this.emit();
  }

  /**
   * Adopts a vocabulary loaded through the settings surface's own control.
   *
   * Without this the destination would report "no file loaded" while the
   * application visibly used a vocabulary, which is exactly the kind of
   * confidently wrong answer this project treats as a defect.
   */
  private adoptExternalCacheIfNeeded(): void {
    if (this.source.length > 0) return;
    const cached = this.ctx.settings.get<unknown>(LANGUAGE_LAYER_CACHE_KEY, null);
    if (!isStoredSource(cached)) {
      // Nothing readable there. If the language layer nevertheless reports a
      // loaded vocabulary, say so honestly rather than claiming there is none.
      this.loadedElsewhere = this.ctx.i18n.snapshot().vocabularyLoaded;
      return;
    }
    if (cached.entries.length === 0) return;
    const revalidated = validateVocabularyPayload(
      serializeDocument(
        cached.entries.map(([from, to]) => ({ from, to })),
        cached.version
      )
    );
    if (!revalidated.ok) {
      this.loadedElsewhere = this.ctx.i18n.snapshot().vocabularyLoaded;
      return;
    }
    this.source = revalidated.document.entries;
    this.version = revalidated.document.version;
    this.suppressed = new Set();
    this.everLoaded = true;
    this.loadedElsewhere = false;
    this.persistSource();
  }

  private dropCache(): void {
    this.source = [];
    this.suppressed = new Set();
    this.cacheDropped = true;
    this.ctx.settings.reset(VOCABULARY_KEYS.source);
    this.ctx.settings.reset(VOCABULARY_KEYS.suppressed);
    this.ctx.settings.reset(VOCABULARY_KEYS.loadedAt);
  }

  /* ---------------- reading ---------------- */

  snapshot(): VocabularyState {
    const available = !this.ctx.i18n.schoolModeActive();
    const total = this.source.length;
    const suppressedCount = this.countSuppressed();
    return {
      available,
      loaded: available && (this.everLoaded || this.loadedElsewhere),
      loadedElsewhere: available && this.loadedElsewhere && this.source.length === 0,
      total,
      active: total - suppressedCount,
      suppressed: suppressedCount,
      loadedAt: this.ctx.settings.get<string>(VOCABULARY_KEYS.loadedAt, '') || null,
      rejection: this.rejection,
      cacheDropped: this.cacheDropped
    };
  }

  private countSuppressed(): number {
    let count = 0;
    for (const entry of this.source) if (this.suppressed.has(entry.from)) count += 1;
    return count;
  }

  /** The loaded replacements in the order the file listed them. */
  entries(): VocabularyEntry[] {
    return [...this.source];
  }

  isSuppressed(from: string): boolean {
    return this.suppressed.has(from);
  }

  /** The entries actually applied, longest key first. */
  activeEntries(): VocabularyEntry[] {
    return inApplicationOrder(this.source.filter((entry) => !this.suppressed.has(entry.from)));
  }

  subscribe(listener: (state: VocabularyState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    const state = this.snapshot();
    for (const listener of [...this.listeners]) {
      try {
        listener(state);
      } catch (error) {
        console.error('A personal vocabulary listener threw:', error);
      }
    }
  }

  /* ---------------- persistence ---------------- */

  private persistSource(): void {
    if (this.source.length === 0) {
      this.ctx.settings.reset(VOCABULARY_KEYS.source);
      return;
    }
    this.ctx.settings.set(VOCABULARY_KEYS.source, {
      version: this.version,
      entries: this.source.map((entry) => [entry.from, entry.to] as [string, string])
    });
  }

  private persistSuppressed(): void {
    if (this.suppressed.size === 0) {
      this.ctx.settings.reset(VOCABULARY_KEYS.suppressed);
      return;
    }
    this.ctx.settings.set(VOCABULARY_KEYS.suppressed, [...this.suppressed]);
  }

  /**
   * Hands the active set to the shared language layer.
   *
   * The layer takes a complete payload and validates it again on its own terms,
   * so what ends up applied has passed two independent validators. A refusal here
   * would mean the two contracts disagree, which is reported rather than
   * swallowed: silently applying nothing while the interface says a vocabulary is
   * loaded is the worst of the available outcomes.
   */
  private async apply(options: { silent?: boolean } = {}): Promise<boolean> {
    const active = this.activeEntries();
    if (active.length === 0) {
      await this.ctx.i18n.clearVocabulary();
      this.ctx.settings.set(LANGUAGE_LAYER_COUNT_KEY, 0);
      return true;
    }
    const result = await this.ctx.i18n.loadVocabularyFile(serializeDocument(active, this.version));
    if (!result.ok) {
      if (!options.silent) {
        this.ctx.notify.error(
          dialogDecoration(
            this.ctx,
            this.ctx.t('vocabulary.notify.applyFailed', 'The change was not applied'),
            '⚠️'
          ),
          result.error ?? 'The shared language layer refused the active set.'
        );
      }
      return false;
    }
    this.ctx.settings.set(LANGUAGE_LAYER_COUNT_KEY, result.entryCount);
    return true;
  }

  /* ---------------- operations ---------------- */

  /**
   * The always-available upload route.
   *
   * The size is checked before the read so an oversized file is reported with an
   * exact byte count instead of an error message that would carry the file's
   * path, and the read itself is bounded by the same contract limit.
   */
  async loadFromPicker(): Promise<boolean> {
    const picked = await this.ctx.studio.dialog.openFile({
      title: 'Choose a personal vocabulary file',
      filters: [{ name: 'JSON', extensions: ['json'] }]
    });
    if (!picked.ok || !picked.value || picked.value.length === 0) return false;
    const path = picked.value[0];

    const stat = await this.ctx.studio.fs.stat(path);
    if (stat.ok && stat.value.exists && stat.value.size > VOCABULARY_CONTRACT.maxBytes) {
      this.setRejection({
        code: 'byte-limit',
        message: `The file is ${stat.value.size} bytes. The limit is ${VOCABULARY_CONTRACT.maxBytes} bytes. Nothing was applied.`
      });
      void this.ctx.history.record('Refused a personal vocabulary file', 'vocabulary', {
        reasonCode: 'byte-limit',
        contentOmitted: true
      });
      return false;
    }

    const read = await this.ctx.studio.fs.readText(path, VOCABULARY_CONTRACT.maxBytes);
    if (!read.ok) {
      // The bridge's own error names the path. It is replaced rather than shown,
      // because a rejection reason is rendered, announced and recorded.
      this.ctx.notify.error(
        dialogDecoration(this.ctx, this.ctx.t('vocabulary.notify.readFailed', 'The file could not be read'), '⚠️'),
        this.ctx.t(
          'vocabulary.notify.readFailed.body',
          'It could not be opened, or it is beyond the {limit}-byte limit. Nothing was applied.',
          { values: { limit: VOCABULARY_CONTRACT.maxBytes } }
        )
      );
      void this.ctx.history.record('Refused a personal vocabulary file', 'vocabulary', {
        reasonCode: 'unreadable',
        contentOmitted: true
      });
      return false;
    }

    return this.loadPayload(read.value);
  }

  /** Validates and applies one complete payload. Nothing partial ever lands. */
  async loadPayload(payload: string): Promise<boolean> {
    const validated = validateVocabularyPayload(payload);
    if (!validated.ok) {
      this.setRejection(validated.rejection);
      this.ctx.notify.error(
        dialogDecoration(this.ctx, this.ctx.t('vocabulary.notify.refused', 'That file was refused'), '⛔'),
        validated.rejection.message
      );
      void this.ctx.history.record('Refused a personal vocabulary file', 'vocabulary', {
        reasonCode: validated.rejection.code,
        contentOmitted: true
      });
      return false;
    }

    const previousTotal = this.source.length;
    this.source = validated.document.entries;
    this.version = validated.document.version;
    this.suppressed = new Set();
    this.everLoaded = true;
    this.loadedElsewhere = false;
    this.rejection = null;
    this.cacheDropped = false;

    const applied = await this.apply();
    if (!applied) {
      // Fail closed: a half-applied set is not recoverable, so the store returns
      // to "nothing loaded" and the surface says so.
      this.source = [];
      this.everLoaded = false;
      this.persistSource();
      this.persistSuppressed();
      this.emit();
      return false;
    }

    this.persistSource();
    this.persistSuppressed();
    this.ctx.settings.set(VOCABULARY_KEYS.loadedAt, new Date().toISOString());

    void this.ctx.history.record('Loaded a personal vocabulary file', 'vocabulary', {
      entryCount: this.source.length,
      previousEntryCount: previousTotal,
      schemaVersion: this.version,
      contentOmitted: true
    });

    this.ctx.notify.success(
      dialogDecoration(this.ctx, this.ctx.t('vocabulary.notify.loaded', 'Personal vocabulary loaded'), '✅'),
      this.ctx.t('vocabulary.notify.loaded.body', '{count} replacements passed validation and are in use.', {
        values: { count: this.source.length }
      })
    );
    this.emit();
    return true;
  }

  /** Purges the cache and restores the shipped wording immediately. */
  async clear(): Promise<void> {
    const removed = this.source.length;
    this.source = [];
    this.suppressed = new Set();
    this.everLoaded = false;
    this.loadedElsewhere = false;
    this.cacheDropped = false;
    this.rejection = null;
    await this.ctx.i18n.clearVocabulary();
    this.ctx.settings.reset(VOCABULARY_KEYS.source);
    this.ctx.settings.reset(VOCABULARY_KEYS.suppressed);
    this.ctx.settings.reset(VOCABULARY_KEYS.loadedAt);
    this.ctx.settings.set(LANGUAGE_LAYER_COUNT_KEY, 0);
    void this.ctx.history.record('Cleared the personal vocabulary', 'vocabulary', {
      entryCount: removed,
      contentOmitted: true
    });
    this.ctx.notify.success(
      dialogDecoration(this.ctx, this.ctx.t('vocabulary.notify.cleared', 'Personal vocabulary cleared'), '♻️'),
      this.ctx.t('vocabulary.notify.cleared.body', 'Every surface is back to the wording this build ships with.')
    );
    this.emit();
  }

  /**
   * Suppresses or restores a set of replacements.
   *
   * Returns how many actually changed, which is what the surface reports: "42
   * selected" and "42 will change" are different numbers whenever part of a
   * selection is already in the requested state, and reporting the first as the
   * second is a small lie that compounds.
   */
  async setSuppressed(keys: string[], suppressed: boolean): Promise<number> {
    const known = new Set(this.source.map((entry) => entry.from));
    let changed = 0;
    for (const key of keys) {
      if (!known.has(key)) continue;
      if (suppressed) {
        if (this.suppressed.has(key)) continue;
        this.suppressed.add(key);
      } else {
        if (!this.suppressed.has(key)) continue;
        this.suppressed.delete(key);
      }
      changed += 1;
    }
    if (changed === 0) return 0;

    const applied = await this.apply();
    if (!applied) return 0;

    this.persistSuppressed();
    void this.ctx.history.record(
      suppressed ? 'Suppressed personal vocabulary replacements' : 'Restored personal vocabulary replacements',
      'vocabulary',
      { count: changed, activeAfter: this.source.length - this.countSuppressed(), contentOmitted: true }
    );
    this.ctx.notify.success(
      this.ctx.t(
        suppressed ? 'vocabulary.notify.suppressed' : 'vocabulary.notify.restored',
        suppressed ? '{count} replacements suppressed' : '{count} replacements restored',
        { values: { count: changed } }
      )
    );
    this.emit();
    return changed;
  }

  /** Removes replacements from the loaded copy. The user's file is untouched. */
  async remove(keys: string[]): Promise<number> {
    const removing = new Set(keys);
    const before = this.source.length;
    this.source = this.source.filter((entry) => !removing.has(entry.from));
    const removed = before - this.source.length;
    if (removed === 0) return 0;
    for (const key of removing) this.suppressed.delete(key);

    const applied = await this.apply();
    if (!applied) return 0;

    this.persistSource();
    this.persistSuppressed();
    void this.ctx.history.record('Removed personal vocabulary replacements', 'vocabulary', {
      count: removed,
      remaining: this.source.length,
      contentOmitted: true
    });
    this.ctx.notify.success(
      this.ctx.t('vocabulary.notify.removed', '{count} replacements removed from the loaded copy', {
        values: { count: removed }
      })
    );
    this.emit();
    return removed;
  }

  /** Writes a blank file in this schema to a location the user picks. */
  async saveTemplate(): Promise<boolean> {
    const target = await this.ctx.studio.dialog.saveFile({
      title: 'Save a blank personal vocabulary template',
      defaultPath: 'personal-vocabulary.json',
      filters: [{ name: 'JSON', extensions: ['json'] }]
    });
    if (!target.ok || !target.value) return false;
    const written = await this.ctx.studio.fs.writeText(target.value, blankTemplate());
    if (!written.ok) {
      this.ctx.notify.error(
        dialogDecoration(this.ctx, this.ctx.t('vocabulary.notify.applyFailed', 'The change was not applied'), '⚠️'),
        written.error
      );
      return false;
    }
    this.ctx.notify.success(
      dialogDecoration(this.ctx, this.ctx.t('vocabulary.notify.templateSaved', 'Blank template saved'), '📄'),
      this.ctx.t(
        'vocabulary.notify.templateSaved.body',
        'It declares schema version {version} and contains no replacements.',
        { values: { version: VOCABULARY_CONTRACT.currentVersion } }
      )
    );
    return true;
  }

  /** Runs the application's own replacement code over a piece of text. */
  preview(text: string): string {
    return this.ctx.i18n.applyVocabulary(text);
  }

  /** How many loaded replacements actually occur in a piece of text. */
  countMatches(text: string): number {
    let count = 0;
    for (const entry of this.activeEntries()) {
      if (entry.from && text.includes(entry.from)) count += 1;
    }
    return count;
  }

  setRejection(rejection: VocabularyRejection | null): void {
    this.rejection = rejection;
    this.emit();
  }

  acknowledgeCacheDrop(): void {
    this.cacheDropped = false;
    this.emit();
  }

  /** Re-reads School mode and re-emits, so surfaces follow it without a restart. */
  refresh(): void {
    this.adoptExternalCacheIfNeeded();
    this.emit();
  }
}
