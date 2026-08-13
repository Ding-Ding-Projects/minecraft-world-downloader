/**
 * Byte handling for the updater: base64 in both directions, and the SHA-1 the
 * release feed states for each package.
 *
 * SHA-1 is used because that is the digest a Squirrel `RELEASES` file carries.
 * It answers one question — are these the bytes the feed named — and nothing
 * about who published them. This project signs nothing, and no part of this
 * feature claims otherwise.
 */

/** Chunked so a large package cannot blow the argument limit of `fromCharCode`. */
const CHARS_PER_PASS = 0x8000;

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += CHARS_PER_PASS) {
    const slice = bytes.subarray(offset, Math.min(offset + CHARS_PER_PASS, bytes.length));
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

export interface DecodeResult {
  ok: boolean;
  bytes: Uint8Array;
  error: string | null;
}

/** Decodes base64 back to bytes. A malformed payload is reported, never thrown. */
export function base64ToBytes(text: string): DecodeResult {
  try {
    const binary = atob(text.trim());
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return { ok: true, bytes, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, bytes: new Uint8Array(0), error: message };
  }
}

/** Joins received chunks into one buffer in the order they were received. */
export function concatChunks(chunks: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const chunk of chunks) total += chunk.length;
  const joined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.length;
  }
  return joined;
}

/** Lower-case hex SHA-1 of the given bytes, computed by the platform. */
export async function sha1Hex(bytes: Uint8Array): Promise<string> {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  const digest = await crypto.subtle.digest('SHA-1', buffer);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

/** Human-readable byte count. Used for display only; the exact number is kept. */
export function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value < 0) return '—';
  if (value < 1024) return `${value} B`;
  const units = ['KiB', 'MiB', 'GiB', 'TiB'];
  let scaled = value / 1024;
  let unit = 0;
  while (scaled >= 1024 && unit < units.length - 1) {
    scaled /= 1024;
    unit += 1;
  }
  return `${scaled.toFixed(scaled >= 100 ? 0 : 1)} ${units[unit]}`;
}

/** A transfer rate in bytes per second, or `—` when it cannot be known yet. */
export function formatRate(bytes: number, milliseconds: number): string {
  if (milliseconds <= 0 || bytes <= 0) return '—';
  return `${formatBytes(Math.round((bytes / milliseconds) * 1000))}/s`;
}
