import type { StudioApi } from '../../core/registry';

/**
 * The one shared record.
 *
 * The mode is not a per-application setting that happens to have the same name
 * in several applications: it is a single switch, held in one file in a shared
 * application-data folder, that every application in the suite reads and writes.
 * This module owns that file — where it lives, what shape it must have, how a
 * change made elsewhere is noticed, and what is said when it cannot be used.
 *
 * Two deliberate limitations, both surfaced to the user rather than hidden:
 *
 * The privileged bridge exposes no filesystem watcher, so a change made by
 * another application is noticed by polling `stat` on a bounded interval and by
 * re-reading whenever this window regains focus. The interval is the user's to
 * choose and the control states it plainly; there is no pretence of an instant
 * push.
 *
 * The bridge also exposes no rename, so the write is a plain write rather than
 * a write-then-rename. A write interrupted at exactly the wrong moment can leave
 * a short or truncated file — which the reader rejects as invalid rather than
 * applying half of, and reports with the exact reason.
 */

export const RECORD_SCHEMA_VERSION = 1;

/** The shared folder's name, beside each application's own data directory. */
export const SHARED_FOLDER_NAME = 'shared-app-settings';

export const RECORD_FILE_NAME = 'school-mode.json';

/** Hard ceiling on the record. It holds five short fields; anything larger is not it. */
export const MAX_RECORD_BYTES = 64 * 1024;

export const MAX_NAME_LENGTH = 60;

/** The shipped name, used only until the user chooses their own. */
export const SHIPPED_MODE_NAME = 'School mode';

export type CredentialMethod = 'none' | 'password' | 'totp';

export interface SchoolRecord {
  schemaVersion: number;
  enabled: boolean;
  name: string;
  /** Which kind of unlock code exists. Never any part of the code itself. */
  credentialMethod: CredentialMethod;
  /** ISO-8601 timestamp of the last write. */
  updatedAt: string;
  /** Package name of the application that wrote it last. */
  updatedBy: string;
}

export type ReadState = 'never' | 'ok' | 'missing' | 'unreadable' | 'invalid';

export interface ReadOutcome {
  state: ReadState;
  record: SchoolRecord | null;
  error: string | null;
  /** ISO-8601 of the moment the read completed. */
  at: string;
}

/* ------------------------------------------------------------------ */
/* Path helpers                                                        */
/* ------------------------------------------------------------------ */

/**
 * The separator this platform's paths already use.
 *
 * Derived from the path in hand rather than from the platform name, because a
 * user may legitimately type either form into the folder override and a joined
 * path that mixes both is refused by the bridge on Windows.
 */
function separatorOf(path: string): string {
  return path.includes('\\') ? '\\' : '/';
}

/** The parent directory of an absolute path, with no trailing separator. */
export function directoryOf(path: string): string {
  const trimmed = path.replace(/[\\/]+$/, '');
  const cut = Math.max(trimmed.lastIndexOf('\\'), trimmed.lastIndexOf('/'));
  return cut <= 0 ? trimmed : trimmed.slice(0, cut);
}

export function joinPath(base: string, ...segments: string[]): string {
  const separator = separatorOf(base);
  const head = base.replace(/[\\/]+$/, '');
  const tail = segments.map((segment) => segment.replace(/^[\\/]+|[\\/]+$/g, '')).filter((segment) => segment !== '');
  return [head, ...tail].join(separator);
}

/**
 * The derived shared folder: a sibling of this application's own data
 * directory, so every application in the suite lands on the same place without
 * any of them having to know about the others.
 */
export function derivedSharedFolder(userDataDir: string): string {
  return joinPath(directoryOf(userDataDir), SHARED_FOLDER_NAME);
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

/**
 * True when the string holds a C0 or C7F control character.
 *
 * Written as a scan rather than a regular expression with a literal control
 * range in it, because a literal control character inside a source file is
 * invisible to the next reader and survives an editor's reformatting only by
 * luck.
 */
function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

export function isValidName(name: unknown): name is string {
  if (typeof name !== 'string') return false;
  const trimmed = name.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_NAME_LENGTH) return false;
  return !hasControlCharacter(trimmed);
}

export function validateRecordText(text: string): { ok: true; record: SchoolRecord } | { ok: false; error: string } {
  const bytes = new TextEncoder().encode(text).byteLength;
  if (bytes > MAX_RECORD_BYTES) {
    return { ok: false, error: `The record is ${bytes} bytes, beyond the ${MAX_RECORD_BYTES}-byte limit.` };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'The record is not valid JSON.' };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, error: 'The top level of the record must be a JSON object.' };
  }
  const document = parsed as Record<string, unknown>;
  if (document.schemaVersion !== RECORD_SCHEMA_VERSION) {
    return {
      ok: false,
      error: `Unsupported schema version ${String(document.schemaVersion)}; this build reads version ${RECORD_SCHEMA_VERSION}.`
    };
  }
  if (typeof document.enabled !== 'boolean') {
    return { ok: false, error: 'The "enabled" field must be true or false.' };
  }
  if (!isValidName(document.name)) {
    return {
      ok: false,
      error: `The "name" field must be 1 to ${MAX_NAME_LENGTH} characters with no control characters.`
    };
  }
  const method = document.credentialMethod;
  if (method !== 'none' && method !== 'password' && method !== 'totp') {
    return { ok: false, error: 'The "credentialMethod" field must be "none", "password" or "totp".' };
  }
  const updatedAt = typeof document.updatedAt === 'string' ? document.updatedAt : '';
  if (updatedAt === '' || Number.isNaN(Date.parse(updatedAt))) {
    return { ok: false, error: 'The "updatedAt" field must be an ISO-8601 timestamp.' };
  }
  const updatedBy = typeof document.updatedBy === 'string' ? document.updatedBy.slice(0, 120) : 'an unnamed application';
  return {
    ok: true,
    record: {
      schemaVersion: RECORD_SCHEMA_VERSION,
      enabled: document.enabled,
      name: (document.name as string).trim(),
      credentialMethod: method,
      updatedAt,
      updatedBy
    }
  };
}

export function serializeRecord(record: SchoolRecord): string {
  const ordered: SchoolRecord = {
    schemaVersion: RECORD_SCHEMA_VERSION,
    enabled: record.enabled,
    name: record.name,
    credentialMethod: record.credentialMethod,
    updatedAt: record.updatedAt,
    updatedBy: record.updatedBy
  };
  return `${JSON.stringify(ordered, null, 2)}\n`;
}

export function recordsEqual(a: SchoolRecord | null, b: SchoolRecord | null): boolean {
  if (a === null || b === null) return a === b;
  return (
    a.enabled === b.enabled &&
    a.name === b.name &&
    a.credentialMethod === b.credentialMethod &&
    a.updatedAt === b.updatedAt &&
    a.updatedBy === b.updatedBy
  );
}

/* ------------------------------------------------------------------ */
/* The store                                                           */
/* ------------------------------------------------------------------ */

export interface SharedRecordStoreOptions {
  studio: StudioApi;
  /** The user's folder override, or an empty string for the derived location. */
  folderOverride(): string;
  /** Poll interval in milliseconds. */
  intervalMs(): number;
}

export class SharedRecordStore {
  private timer: number | null = null;
  private signature = '';
  private listener: ((outcome: ReadOutcome) => void) | null = null;
  private reading = false;
  private focusHandler: (() => void) | null = null;
  private visibilityHandler: (() => void) | null = null;

  /** Set when the poll loop itself could not be established. */
  watchError: string | null = null;

  last: ReadOutcome = { state: 'never', record: null, error: null, at: new Date(0).toISOString() };

  constructor(private readonly options: SharedRecordStoreOptions) {}

  folder(): string {
    const override = this.options.folderOverride().trim();
    if (override !== '') return override.replace(/[\\/]+$/, '');
    return derivedSharedFolder(this.options.studio.info.userDataDir);
  }

  path(): string {
    return joinPath(this.folder(), RECORD_FILE_NAME);
  }

  /** Reads once, classifying every failure rather than collapsing them to "no". */
  async read(): Promise<ReadOutcome> {
    const at = new Date().toISOString();
    const target = this.path();
    const stat = await this.options.studio.fs.stat(target);
    if (!stat.ok) {
      this.last = { state: 'unreadable', record: null, error: stat.error, at };
      this.signature = '';
      return this.last;
    }
    if (!stat.value.exists) {
      this.last = { state: 'missing', record: null, error: null, at };
      this.signature = '';
      return this.last;
    }
    if (stat.value.size > MAX_RECORD_BYTES) {
      this.last = {
        state: 'invalid',
        record: null,
        error: `The record is ${stat.value.size} bytes, beyond the ${MAX_RECORD_BYTES}-byte limit.`,
        at
      };
      this.signature = `${stat.value.modifiedAt}:${stat.value.size}`;
      return this.last;
    }
    const text = await this.options.studio.fs.readText(target, MAX_RECORD_BYTES);
    if (!text.ok) {
      this.last = { state: 'unreadable', record: null, error: text.error, at };
      return this.last;
    }
    const validated = validateRecordText(text.value);
    this.signature = `${stat.value.modifiedAt}:${stat.value.size}`;
    this.last = validated.ok
      ? { state: 'ok', record: validated.record, error: null, at }
      : { state: 'invalid', record: null, error: validated.error, at };
    return this.last;
  }

  /**
   * Writes the record.
   *
   * The folder is created first, because the very first application in the suite
   * to change the mode is the one that has to bring the shared location into
   * existence.
   */
  async write(record: SchoolRecord): Promise<{ ok: true } | { ok: false; error: string }> {
    const folder = this.folder();
    const ensured = await this.options.studio.fs.ensureDirectory(folder);
    if (!ensured.ok) return { ok: false, error: ensured.error };
    const written = await this.options.studio.fs.writeText(this.path(), serializeRecord(record));
    if (!written.ok) return { ok: false, error: written.error };
    // Adopt the write immediately so the next poll does not report our own
    // change back to us as though another application had made it.
    this.last = { state: 'ok', record, error: null, at: new Date().toISOString() };
    const stat = await this.options.studio.fs.stat(this.path());
    this.signature = stat.ok && stat.value.exists ? `${stat.value.modifiedAt}:${stat.value.size}` : '';
    return { ok: true };
  }

  /**
   * Starts watching. The listener is called only when the record's content
   * genuinely changed, so a quiet poll costs one `stat` and nothing else.
   */
  start(listener: (outcome: ReadOutcome) => void): void {
    this.stop();
    this.listener = listener;
    try {
      this.timer = window.setInterval(() => void this.poll(), Math.max(500, this.options.intervalMs()));
      this.focusHandler = () => void this.poll();
      this.visibilityHandler = () => {
        if (document.visibilityState === 'visible') void this.poll();
      };
      window.addEventListener('focus', this.focusHandler);
      document.addEventListener('visibilitychange', this.visibilityHandler);
      this.watchError = null;
    } catch (error) {
      this.watchError = error instanceof Error ? error.message : String(error);
    }
  }

  /** Applies a new interval without losing the current listener. */
  restart(): void {
    if (!this.listener) return;
    const listener = this.listener;
    this.start(listener);
  }

  stop(): void {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
    if (this.focusHandler) {
      window.removeEventListener('focus', this.focusHandler);
      this.focusHandler = null;
    }
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
    this.listener = null;
  }

  isWatching(): boolean {
    return this.timer !== null;
  }

  /** One poll cycle. Re-entrant calls are dropped rather than queued. */
  async poll(): Promise<ReadOutcome> {
    if (this.reading) return this.last;
    this.reading = true;
    try {
      const previous = this.last;
      const previousSignature = this.signature;
      const outcome = await this.read();
      const changed =
        outcome.state !== previous.state ||
        !recordsEqual(outcome.record, previous.record) ||
        outcome.error !== previous.error ||
        this.signature !== previousSignature;
      if (changed) this.listener?.(outcome);
      return outcome;
    } finally {
      this.reading = false;
    }
  }
}
