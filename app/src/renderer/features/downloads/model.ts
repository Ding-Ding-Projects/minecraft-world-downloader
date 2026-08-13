/**
 * The shapes the downloads feature stores, renders and exports.
 *
 * Every field here is either something the browser extension actually reported,
 * something the transfer engine actually measured, or something the user
 * actually chose. Nothing is inferred and presented as measured.
 */

export const DOWNLOADS_TAB_ID = 'downloads.main';
export const DOWNLOADS_SECTION_ID = 'downloads';
export const BRIDGE_PROTOCOL = 1;

/** Where a download came from. */
export type DownloadOrigin = 'browser-extension' | 'manual';

/**
 * The life of one transfer.
 *
 * `awaiting-decision` is the state a capture sits in while the Start download
 * dialog is open: the application has it, and nothing has transferred.
 */
export type DownloadState =
  | 'awaiting-decision'
  | 'queued'
  | 'connecting'
  | 'downloading'
  | 'paused'
  | 'interrupted'
  | 'completed'
  | 'cancelled'
  | 'failed';

/** The states from which a transfer can be started or resumed. */
export const RESUMABLE_STATES: readonly DownloadState[] = ['paused', 'interrupted', 'failed', 'queued'];

/** The states in which a transfer is currently moving bytes. */
export const ACTIVE_STATES: readonly DownloadState[] = ['connecting', 'downloading'];

export interface CapturePayload {
  captureId: string;
  url: string;
  host: string;
  referrer: string;
  suggestedFilename: string;
  mimeType: string;
  totalBytes: number | null;
  capturedAt: string;
  source: string;
}

export interface DownloadRecord {
  /** Stable id, minted by the application and used by the transfer engine. */
  id: string;
  /** The capture this download came from, when it came from the extension. */
  captureId: string | null;
  origin: DownloadOrigin;
  url: string;
  host: string;
  referrer: string;
  /** The name the browser suggested, before the user edited it. */
  suggestedFilename: string;
  /** The name the file is actually being written under. */
  filename: string;
  /** Absolute destination folder. */
  folder: string;
  /** Absolute destination path, as reported by the engine once it is final. */
  destination: string;
  mimeType: string;
  state: DownloadState;
  /** Bytes genuinely written to disk. */
  received: number;
  /** Total size, when the server declared one. Null means the server did not. */
  total: number | null;
  /** Last measured rate in bytes per second. Zero while nothing is moving. */
  bytesPerSecond: number;
  /** Seconds remaining, only when both a total and a usable rate exist. */
  etaSeconds: number | null;
  /** Null until a response has told us whether the server honours a range. */
  resumable: boolean | null;
  capturedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  /** The exact failure, verbatim from the engine. Empty when there is none. */
  error: string;
  /** A truthful note from the engine, such as an ignored resume request. */
  note: string;
  /** Overwrite an existing file rather than writing a numbered variant. */
  overwrite: boolean;
}

export interface DownloadsSnapshot {
  schemaVersion: 1;
  records: DownloadRecord[];
}

/** A brand-new record from a capture, before the user has decided anything. */
export function recordFromCapture(
  capture: CapturePayload,
  folder: string,
  filename: string,
  id: string
): DownloadRecord {
  return {
    id,
    captureId: capture.captureId,
    origin: 'browser-extension',
    url: capture.url,
    host: capture.host,
    referrer: capture.referrer,
    suggestedFilename: capture.suggestedFilename,
    filename,
    folder,
    destination: joinPath(folder, filename),
    mimeType: capture.mimeType,
    state: 'awaiting-decision',
    received: 0,
    total: capture.totalBytes,
    bytesPerSecond: 0,
    etaSeconds: null,
    resumable: null,
    capturedAt: capture.capturedAt,
    startedAt: null,
    finishedAt: null,
    error: '',
    note: '',
    overwrite: false
  };
}

export function manualRecord(url: string, folder: string, filename: string, id: string): DownloadRecord {
  let host = '';
  try {
    host = new URL(url).hostname;
  } catch {
    host = '';
  }
  return {
    id,
    captureId: null,
    origin: 'manual',
    url,
    host,
    referrer: '',
    suggestedFilename: filename,
    filename,
    folder,
    destination: joinPath(folder, filename),
    mimeType: '',
    state: 'awaiting-decision',
    received: 0,
    total: null,
    bytesPerSecond: 0,
    etaSeconds: null,
    resumable: null,
    capturedAt: new Date().toISOString(),
    startedAt: null,
    finishedAt: null,
    error: '',
    note: '',
    overwrite: false
  };
}

/**
 * Joins a folder and a file name with the separator the folder already uses.
 *
 * The renderer has no `path` module — there is no Node in this context — and
 * guessing the separator from the platform name is wrong the moment somebody
 * types a POSIX path on Windows, which the browse control happily accepts.
 */
export function joinPath(folder: string, filename: string): string {
  const trimmed = folder.replace(/[\\/]+$/, '');
  if (trimmed === '') return filename;
  const separator = trimmed.includes('\\') && !trimmed.startsWith('/') ? '\\' : '/';
  return trimmed + separator + filename;
}

/** True for an absolute Windows or POSIX path. */
export function isAbsolutePath(candidate: string): boolean {
  return /^[a-zA-Z]:[\\/]/.test(candidate) || candidate.startsWith('\\\\') || candidate.startsWith('/');
}

const RESERVED_WINDOWS_NAMES = new Set([
  'con',
  'prn',
  'aux',
  'nul',
  'com1',
  'com2',
  'com3',
  'com4',
  'com5',
  'com6',
  'com7',
  'com8',
  'com9',
  'lpt1',
  'lpt2',
  'lpt3',
  'lpt4',
  'lpt5',
  'lpt6',
  'lpt7',
  'lpt8',
  'lpt9'
]);

const SMALLEST_PRINTABLE = 32;
const DELETE_CHARACTER = 127;

/** Drops every control character, written as a code-point filter rather than
 *  as an escape class, so the source file itself stays plain printable text. */
function withoutControlCharacters(value: string): string {
  let out = '';
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    if (code >= SMALLEST_PRINTABLE && code !== DELETE_CHARACTER) out += character;
  }
  return out;
}

/**
 * Turns whatever the browser suggested into a name that is safe to write.
 *
 * The name arriving from a capture is attacker-influenced: it comes from a
 * remote server's `Content-Disposition` by way of the browser. Every path
 * separator, every traversal segment, every control character and every
 * reserved device name is removed here, so a capture can never decide where a
 * byte lands.
 */
export function sanitizeFilename(candidate: string, fallback: string): string {
  const tail = String(candidate ?? '').split(/[\\/]/).pop() ?? '';
  let name = withoutControlCharacters(tail).trim();
  name = name.replace(/[<>:"|?*]/g, '_');
  name = name.replace(/^\.+/, '');
  name = name.replace(/[. ]+$/, '');
  const stem = name.includes('.') ? name.slice(0, name.lastIndexOf('.')) : name;
  if (RESERVED_WINDOWS_NAMES.has(stem.toLowerCase())) name = `_${name}`;
  if (name.length > 200) {
    const dot = name.lastIndexOf('.');
    const suffix = dot > 0 && name.length - dot <= 12 ? name.slice(dot) : '';
    name = name.slice(0, 200 - suffix.length) + suffix;
  }
  return name.length > 0 ? name : fallback;
}

/** Derives a plausible file name from a URL when the browser suggested none. */
export function filenameFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const last = decodeURIComponent(parsed.pathname.split('/').filter(Boolean).pop() ?? '');
    if (last) return sanitizeFilename(last, 'download');
    return sanitizeFilename(parsed.hostname.replace(/[^a-z0-9.-]/gi, '-'), 'download');
  } catch {
    return 'download';
  }
}

/** Validates one stored record enough to trust it after a restart. */
export function isDownloadRecord(value: unknown): value is DownloadRecord {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === 'string' &&
    row.id.length > 0 &&
    typeof row.url === 'string' &&
    typeof row.filename === 'string' &&
    typeof row.folder === 'string' &&
    typeof row.state === 'string'
  );
}

/**
 * Reconciles a stored record with the fact that the transfer engine does not
 * survive a restart. Anything that was moving when the application closed is
 * interrupted, not running, and saying so is the difference between a resumable
 * download and a row that lies about being alive.
 */
export function reconcileAfterRestart(record: DownloadRecord): DownloadRecord {
  if (record.state === 'downloading' || record.state === 'connecting' || record.state === 'queued') {
    return {
      ...record,
      state: 'interrupted',
      bytesPerSecond: 0,
      etaSeconds: null,
      note: 'The application closed while this transfer was running. The partial file is still on disk.'
    };
  }
  if (record.state === 'awaiting-decision') {
    return {
      ...record,
      state: 'cancelled',
      note: 'The application closed before the Start download dialog was answered, so nothing transferred.'
    };
  }
  if (record.state === 'paused') {
    return { ...record, bytesPerSecond: 0, etaSeconds: null };
  }
  return record;
}
