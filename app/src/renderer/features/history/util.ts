import type { HistoryEntry } from '../../core/registry';

/**
 * Small helpers shared by the history surfaces.
 *
 * Nothing here reaches the network, the clock is the machine's own, and every
 * function that can fail says so in its return type rather than throwing into a
 * render loop.
 */

/** The path separator this machine actually uses. */
export function separator(platform: string): string {
  return platform === 'win32' ? '\\' : '/';
}

/** Joins a directory and a file name without importing a Node path module. */
export function joinPath(directory: string, name: string, platform: string): string {
  const sep = separator(platform);
  const trimmed = directory.endsWith(sep) ? directory.slice(0, -sep.length) : directory;
  return `${trimmed}${sep}${name}`;
}

/**
 * Formats a timestamp for display.
 *
 * The machine's own locale decides the order, and the exact ISO string travels
 * beside it in a `title` so a reader who needs the unambiguous form has it
 * without leaving the row.
 */
export function formatTimestamp(iso: string): string {
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return iso;
  const date = new Date(parsed);
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

/** `2026-08-13` for a Date, in local time rather than UTC. */
export function isoDay(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Start of a local day as an ISO instant, for a history query lower bound. */
export function dayStartIso(day: string): string {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, date ?? 1, 0, 0, 0, 0).toISOString();
}

/** End of a local day as an ISO instant, for a history query upper bound. */
export function dayEndIso(day: string): string {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, date ?? 1, 23, 59, 59, 999).toISOString();
}

/** JSON that never throws, whatever a payload holds. */
export function safeJson(value: unknown, space?: number): string {
  try {
    return JSON.stringify(value, null, space) ?? '';
  } catch {
    return '[this value could not be serialized]';
  }
}

/** One line of a payload, for a row preview. */
export function payloadPreview(payload: unknown, maxLength = 180): string {
  const text = safeJson(payload).replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}…`;
}

/** The haystack a text search runs over: everything the row shows. */
export function searchableText(entry: HistoryEntry, label: string): string {
  return `${entry.id}\n${entry.action}\n${entry.source}\n${label}\n${safeJson(entry.payload)}`;
}

/** A thousands-separated count, in the machine's own locale. */
export function formatCount(value: number): string {
  try {
    return new Intl.NumberFormat().format(value);
  } catch {
    return String(value);
  }
}

export function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

/** Base64 for arbitrary bytes, without a Node Buffer. */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) out[index] = binary.charCodeAt(index);
  return out;
}

/** SHA-256, hex, for a non-reversible fingerprint of a redacted label. */
export async function fingerprint(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16);
}

/**
 * The settings-change shape the core recorder writes.
 *
 * An entry carrying it can be restored, because it holds the earlier value. An
 * entry without it records what happened but not what it replaced, and the panel
 * says exactly that rather than offering a button that would do nothing.
 */
export interface RestorableChange {
  id: string;
  from: unknown;
  to: unknown;
}

export function restorableChange(payload: unknown): RestorableChange | null {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const record = payload as Record<string, unknown>;
  if (typeof record.id !== 'string' || record.id === '') return null;
  if (!('from' in record) || !('to' in record)) return null;
  return { id: record.id, from: record.from, to: record.to };
}

/** Values are compared by their serialized form, which is how they persist. */
export function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  return safeJson(a) === safeJson(b);
}
