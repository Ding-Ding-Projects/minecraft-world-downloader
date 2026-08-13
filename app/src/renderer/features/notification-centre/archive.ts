import { clamp, debounce, joinPath } from './dom';
import {
  DEFAULT_RETENTION,
  MAX_RETENTION,
  MIN_RETENTION,
  SETTING_PERSIST,
  SETTING_RETENTION,
  type ArchivedNotification,
  type ArchiveStatus,
  type CentreRecord
} from './model';
import type {
  AppContext,
  NotificationAction,
  NotificationHandle,
  NotificationInput,
  NotificationSeverity
} from '../../core/registry';

/**
 * The durable half of the notification centre.
 *
 * The notification service keeps this session's records in memory, which is the
 * right thing for a toast and the wrong thing for a reviewable log: closing the
 * window would take the entire history with it. This class keeps a bounded,
 * validated copy on disk inside the application data directory, merges it with
 * whatever the live service currently holds, and hands the centre one ordered
 * list to render.
 *
 * Three properties are load-bearing.
 *
 * It never invents a record. A row that came from an earlier session is labelled
 * as such, and a notification that was still on screen when that session ended
 * is reported that way rather than given a fabricated dismissal time.
 *
 * It never claims a write that did not happen. When the file cannot be read or
 * written, the status carries the exact reason and the centre says so on screen
 * instead of quietly behaving as though the log were durable.
 *
 * It reads nothing it has not validated. The file is the application's own, but
 * it is still parsed defensively — bounded size, a known schema version, a
 * checked shape per record — because a corrupt file must degrade to an empty
 * log rather than to a broken window.
 */

const SCHEMA_VERSION = 1;
const DIRECTORY_NAME = 'notification-centre';
const FILE_NAME = 'archive.json';

/** Hard ceilings applied while reading, independent of the retention setting. */
const LIMITS = {
  maxFileBytes: 8 * 1024 * 1024,
  maxRecords: MAX_RETENTION,
  maxTitle: 400,
  maxBody: 8000,
  maxSource: 120,
  maxUrl: 2048,
  maxActionLabels: 12
} as const;

const VALID_SEVERITIES = new Set<string>(['info', 'success', 'warning', 'error', 'progress']);

interface StoredDocument {
  schemaVersion: number;
  updatedAt: string;
  records: ArchivedNotification[];
}

interface SessionExtras {
  actions: NotificationAction[];
  link: { label: string; url: string } | null;
}

function isRecordObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown, limit: number): string | null {
  if (typeof value !== 'string') return null;
  if (value.length > limit) return value.slice(0, limit);
  return value;
}

/** Validates one stored record. Returns null when it cannot be trusted. */
function parseRecord(value: unknown): ArchivedNotification | null {
  if (!isRecordObject(value)) return null;

  const id = readString(value.id, 200);
  const title = readString(value.title, LIMITS.maxTitle);
  const createdAt = readString(value.createdAt, 64);
  if (!id || !title || !createdAt) return null;
  if (Number.isNaN(new Date(createdAt).getTime())) return null;

  const severity = typeof value.severity === 'string' && VALID_SEVERITIES.has(value.severity)
    ? (value.severity as NotificationSeverity)
    : null;
  if (!severity) return null;

  const dismissedAtRaw = value.dismissedAt;
  let dismissedAt: string | null = null;
  if (typeof dismissedAtRaw === 'string') {
    if (Number.isNaN(new Date(dismissedAtRaw).getTime())) return null;
    dismissedAt = dismissedAtRaw;
  } else if (dismissedAtRaw !== null && dismissedAtRaw !== undefined) {
    return null;
  }

  let link: { label: string; url: string } | null = null;
  const storedLink: unknown = value.link;
  if (isRecordObject(storedLink)) {
    const url = readString(storedLink.url, LIMITS.maxUrl);
    const label = readString(storedLink.label, LIMITS.maxTitle);
    // Only http(s) survives. Anything else is dropped rather than offered as a
    // button that the privileged bridge would refuse anyway.
    if (url && label && /^https?:\/\//i.test(url)) link = { label, url };
  }

  const storedLabels: unknown = value.actionLabels;
  const actionLabels = Array.isArray(storedLabels)
    ? (storedLabels as unknown[])
        .slice(0, LIMITS.maxActionLabels)
        .map((entry) => readString(entry, LIMITS.maxTitle))
        .filter((entry): entry is string => entry !== null)
    : [];

  const progress =
    typeof value.progress === 'number' && Number.isFinite(value.progress)
      ? clamp(value.progress, 0, 1)
      : null;

  return {
    id,
    title,
    body: readString(value.body, LIMITS.maxBody) ?? '',
    severity,
    source: readString(value.source, LIMITS.maxSource) ?? 'unknown',
    createdAt,
    dismissedAt,
    progress,
    link,
    actionLabels,
    sessionStartedAt:
      typeof value.sessionStartedAt === 'number' && Number.isFinite(value.sessionStartedAt)
        ? value.sessionStartedAt
        : 0
  };
}

export class NotificationArchive {
  private readonly ctx: AppContext;
  private readonly sessionStartedAt: number;
  private readonly records = new Map<string, ArchivedNotification>();
  private readonly sessionExtras = new Map<string, SessionExtras>();
  private readonly listeners = new Set<() => void>();
  private readonly directory: string;
  private readonly file: string;

  private loadedFromDisk = 0;
  private refusedOnLoad = 0;
  private lastWriteAt: string | null = null;
  private written = false;
  private error: string | null = null;
  private disposed = false;
  private detachService: (() => void) | null = null;
  private detachQuit: (() => void) | null = null;

  private readonly schedulePersist = debounce(() => {
    void this.persistNow();
  }, 900);

  constructor(ctx: AppContext) {
    this.ctx = ctx;
    this.sessionStartedAt = ctx.studio.info.startedAt;
    this.directory = joinPath(ctx.studio.info.userDataDir, DIRECTORY_NAME);
    this.file = joinPath(this.directory, FILE_NAME);
  }

  /* ---------------------------------------------------------------- */
  /* Lifecycle                                                         */
  /* ---------------------------------------------------------------- */

  /**
   * Starts capturing, then reads whatever earlier sessions left behind.
   *
   * Capture is installed FIRST and synchronously. Reading the file is
   * asynchronous, and a notification raised while that read is in flight would
   * otherwise lose its actions for the rest of the session.
   */
  async start(): Promise<void> {
    this.captureLiveService();
    this.absorbLiveRecords();
    await this.load();
    this.detachQuit = this.ctx.studio.events.on('app:before-quit', () => {
      // Best effort: the write is asynchronous and the process may not wait for
      // it, which is exactly why the debounced write is short rather than lazy.
      this.schedulePersist.flush();
    });
    this.emit();
  }

  dispose(): void {
    this.disposed = true;
    this.schedulePersist.flush();
    this.detachService?.();
    this.detachService = null;
    this.detachQuit?.();
    this.detachQuit = null;
    this.listeners.clear();
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    for (const listener of [...this.listeners]) {
      try {
        listener();
      } catch (error) {
        console.error('A notification centre listener threw:', error);
      }
    }
  }

  /* ---------------------------------------------------------------- */
  /* Capture                                                           */
  /* ---------------------------------------------------------------- */

  /**
   * Wraps `notify.show` so the centre can keep an action's callback.
   *
   * `NotificationRecord` carries no actions — it cannot, because a callback is
   * not data — so the only place the closures exist is the input the caller
   * passed. Wrapping the one method that receives that input is how a row in
   * the centre can still run "Retry" ten minutes later.
   */
  private captureLiveService(): void {
    const service = this.ctx.notify;
    const originalShow = service.show.bind(service);

    const wrapped = (input: NotificationInput): NotificationHandle => {
      const handle = originalShow(input);
      this.sessionExtras.set(handle.id, {
        actions: [...(input.actions ?? [])],
        link: input.link ? { label: input.link.label, url: input.link.url } : null
      });
      return handle;
    };

    service.show = wrapped;
    const unsubscribe = service.onChange(() => {
      this.absorbLiveRecords();
      this.emit();
    });

    this.detachService = () => {
      unsubscribe();
      // Restoring the original keeps the service exactly as it was found, so a
      // reload of this feature cannot stack two wrappers on one method.
      service.show = originalShow;
    };
  }

  /** Folds the live service's records into the archive, newest state winning. */
  private absorbLiveRecords(): void {
    for (const record of this.ctx.notify.history()) {
      const extras = this.sessionExtras.get(record.id);
      const existing = this.records.get(record.id);
      this.records.set(record.id, {
        id: record.id,
        title: record.title,
        body: record.body,
        severity: record.severity,
        source: record.source,
        createdAt: record.createdAt,
        dismissedAt: record.dismissedAt,
        progress: record.progress,
        link: extras?.link ?? existing?.link ?? null,
        actionLabels: extras ? extras.actions.map((action) => action.label) : (existing?.actionLabels ?? []),
        sessionStartedAt: this.sessionStartedAt
      });
    }
    this.enforceRetention();
    this.schedulePersist.schedule();
  }

  /* ---------------------------------------------------------------- */
  /* Reading and writing                                               */
  /* ---------------------------------------------------------------- */

  private retention(): number {
    const raw = Number(this.ctx.settings.get(SETTING_RETENTION, DEFAULT_RETENTION));
    return Math.round(clamp(raw, MIN_RETENTION, MAX_RETENTION));
  }

  private persistenceEnabled(): boolean {
    return this.ctx.settings.get<boolean>(SETTING_PERSIST, true) !== false;
  }

  private enforceRetention(): void {
    const ceiling = this.retention();
    if (this.records.size <= ceiling) return;
    const ordered = [...this.records.values()].sort(
      (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id.localeCompare(a.id)
    );
    for (const record of ordered.slice(ceiling)) this.records.delete(record.id);
  }

  private async load(): Promise<void> {
    if (!this.persistenceEnabled()) {
      this.error = null;
      return;
    }
    const stat = await this.ctx.studio.fs.stat(this.file);
    if (!stat.ok) {
      this.error = stat.error;
      return;
    }
    if (!stat.value.exists) {
      // A first run is not a failure. The log simply starts here.
      this.error = null;
      return;
    }
    if (stat.value.size > LIMITS.maxFileBytes) {
      this.error = `The stored log is ${stat.value.size} bytes, above the ${LIMITS.maxFileBytes}-byte ceiling, so it was not read. Nothing was deleted.`;
      return;
    }

    const read = await this.ctx.studio.fs.readText(this.file, LIMITS.maxFileBytes);
    if (!read.ok) {
      this.error = read.error;
      return;
    }

    let parsed: unknown = null;
    try {
      parsed = JSON.parse(read.value);
    } catch (error) {
      this.error = `The stored log is not valid JSON, so it was ignored: ${
        error instanceof Error ? error.message : String(error)
      }`;
      return;
    }

    if (!isRecordObject(parsed)) {
      this.error = 'The stored log is not an object, so it was ignored. Nothing was deleted.';
      return;
    }
    const parsedDocument = parsed;
    if (parsedDocument.schemaVersion !== SCHEMA_VERSION) {
      this.error = `The stored log declares schema version ${String(
        parsedDocument.schemaVersion
      )}, and this build reads version ${SCHEMA_VERSION}. It was left untouched.`;
      return;
    }
    const storedRecords: unknown = parsedDocument.records;
    if (!Array.isArray(storedRecords)) {
      this.error = 'The stored log has no record list, so it was ignored. Nothing was deleted.';
      return;
    }

    let accepted = 0;
    let refused = 0;
    for (const candidate of (storedRecords as unknown[]).slice(0, LIMITS.maxRecords)) {
      const record = parseRecord(candidate);
      if (!record) {
        refused += 1;
        continue;
      }
      // A live record for the same id always wins: it is the current truth.
      if (!this.records.has(record.id)) this.records.set(record.id, record);
      accepted += 1;
    }

    this.loadedFromDisk = accepted;
    this.refusedOnLoad = refused;
    this.error = null;
    this.enforceRetention();
    this.emit();
  }

  private async persistNow(): Promise<void> {
    if (this.disposed) return;
    if (!this.persistenceEnabled()) return;

    const payload: StoredDocument = {
      schemaVersion: SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
      records: this.ordered().map((record) => ({
        id: record.id,
        title: record.title,
        body: record.body,
        severity: record.severity,
        source: record.source,
        createdAt: record.createdAt,
        dismissedAt: record.dismissedAt,
        progress: record.progress,
        link: record.link,
        actionLabels: record.actionLabels,
        sessionStartedAt: record.sessionStartedAt
      }))
    };

    const ensured = await this.ctx.studio.fs.ensureDirectory(this.directory);
    if (!ensured.ok) {
      this.error = ensured.error;
      this.emit();
      return;
    }
    const written = await this.ctx.studio.fs.writeText(this.file, `${JSON.stringify(payload, null, 2)}\n`);
    if (!written.ok) {
      this.error = written.error;
      this.emit();
      return;
    }
    this.written = true;
    this.lastWriteAt = payload.updatedAt;
    if (this.error !== null) {
      this.error = null;
      this.emit();
    }
  }

  /** Writes immediately rather than on the debounce. Used after a deletion. */
  async flush(): Promise<void> {
    this.schedulePersist.flush();
    await this.persistNow();
  }

  /* ---------------------------------------------------------------- */
  /* Reading the merged view                                           */
  /* ---------------------------------------------------------------- */

  private ordered(): ArchivedNotification[] {
    return [...this.records.values()].sort(
      (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id.localeCompare(a.id)
    );
  }

  /** Every known notification, newest first, with its current live state. */
  all(): CentreRecord[] {
    const showing = new Set(
      this.ctx.notify
        .history()
        .filter((record) => record.dismissedAt === null)
        .map((record) => record.id)
    );
    return this.ordered().map((record) => {
      const fromThisSession = record.sessionStartedAt === this.sessionStartedAt;
      return {
        ...record,
        showing: showing.has(record.id),
        fromThisSession,
        actionsRunnable: (this.sessionExtras.get(record.id)?.actions.length ?? 0) > 0,
        endedWithItsSession: !fromThisSession && record.dismissedAt === null
      };
    });
  }

  byId(id: string): CentreRecord | null {
    return this.all().find((record) => record.id === id) ?? null;
  }

  /** The callbacks the original notification carried, if this session holds them. */
  actionsFor(id: string): NotificationAction[] {
    return this.sessionExtras.get(id)?.actions ?? [];
  }

  status(): ArchiveStatus {
    return {
      path: this.file,
      enabled: this.persistenceEnabled(),
      written: this.written,
      lastWriteAt: this.lastWriteAt,
      loadedFromDisk: this.loadedFromDisk,
      refusedOnLoad: this.refusedOnLoad,
      error: this.error,
      retention: this.retention()
    };
  }

  directoryPath(): string {
    return this.directory;
  }

  /* ---------------------------------------------------------------- */
  /* Mutations                                                         */
  /* ---------------------------------------------------------------- */

  /**
   * Dismisses the given ids.
   *
   * Only a notification still on screen can be dismissed, so the result reports
   * what was dismissed and what was skipped rather than pretending a historical
   * row changed state.
   */
  dismiss(ids: string[]): { dismissed: string[]; skipped: string[] } {
    const dismissed: string[] = [];
    const skipped: string[] = [];
    const showing = new Set(
      this.ctx.notify
        .history()
        .filter((record) => record.dismissedAt === null)
        .map((record) => record.id)
    );
    for (const id of ids) {
      if (showing.has(id)) {
        this.ctx.notify.dismiss(id);
        dismissed.push(id);
      } else {
        skipped.push(id);
      }
    }
    this.absorbLiveRecords();
    this.emit();
    return { dismissed, skipped };
  }

  /** Removes records from the log and from the live service, then persists. */
  async remove(ids: string[]): Promise<number> {
    const known = ids.filter((id) => this.records.has(id));
    const live = new Set(this.ctx.notify.history().map((record) => record.id));
    const liveIds = known.filter((id) => live.has(id));
    if (liveIds.length > 0) this.ctx.notify.remove(liveIds);
    for (const id of known) {
      this.records.delete(id);
      this.sessionExtras.delete(id);
    }
    await this.flush();
    this.emit();
    return known.length;
  }

  /** Removes everything, including this session's records. */
  async clear(): Promise<number> {
    const ids = [...this.records.keys()];
    return this.remove(ids);
  }
}
