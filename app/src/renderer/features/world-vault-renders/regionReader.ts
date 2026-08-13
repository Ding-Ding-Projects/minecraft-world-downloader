/**
 * Reads an Anvil region header through the privileged bridge that is actually
 * wired up today.
 *
 * `studio.fs.readBase64` has no positional/ranged read — it returns a whole
 * file, base64-encoded, bounded only by `maxBytes`. Reading a several-megabyte
 * region file in full just to look at its 8192-byte header is wasteful, and
 * `../../../main/features/world-vault-renders.ts` documents the efficient,
 * positional-read version of this for once a dedicated IPC channel exists.
 * Until then, this is the honest, fully-functional version that runs today:
 * it bounds the read to a generous ceiling, decodes it, and hands only the
 * header bytes to the same pure parser `anvil.ts` exports — so the two
 * implementations can never disagree about what a region file contains, they
 * only disagree about how many bytes crossed the bridge to find out.
 */

import type { StudioApi } from '../../../shared/api';
import { REGION_HEADER_BYTES, parseRegionHeader, type RegionHeader } from './anvil';

/**
 * A generous ceiling on a single region file. Vanilla region files are
 * usually well under a few megabytes; this is deliberately loose so an
 * unusually built-up region is still read rather than refused, while still
 * being a real bound rather than "whatever memory allows".
 */
export const MAX_REGION_FILE_BYTES = 32 * 1024 * 1024;

export type RegionHeaderReadResult =
  | { ok: true; header: RegionHeader; fileSize: number }
  | { ok: false; kind: 'too-large'; fileSize: number; limit: number }
  | { ok: false; kind: 'unreadable'; error: string }
  | { ok: false; kind: 'truncated'; fileSize: number };

/** Decodes a base64 string into bytes, without pulling in a Node Buffer polyfill. */
function decodeBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export async function readRegionHeaderViaStudio(
  studio: StudioApi,
  path: string
): Promise<RegionHeaderReadResult> {
  const stat = await studio.fs.stat(path);
  if (!stat.ok) return { ok: false, kind: 'unreadable', error: stat.error };
  if (!stat.value.exists || !stat.value.isFile) {
    return { ok: false, kind: 'unreadable', error: `"${path}" does not exist, or is not a file.` };
  }
  if (stat.value.size > MAX_REGION_FILE_BYTES) {
    return { ok: false, kind: 'too-large', fileSize: stat.value.size, limit: MAX_REGION_FILE_BYTES };
  }
  if (stat.value.size < REGION_HEADER_BYTES) {
    return { ok: false, kind: 'truncated', fileSize: stat.value.size };
  }

  const read = await studio.fs.readBase64(path, MAX_REGION_FILE_BYTES);
  if (!read.ok) return { ok: false, kind: 'unreadable', error: read.error };

  const bytes = decodeBase64(read.value);
  if (bytes.length < REGION_HEADER_BYTES) {
    return { ok: false, kind: 'truncated', fileSize: bytes.length };
  }
  return { ok: true, header: parseRegionHeader(bytes.subarray(0, REGION_HEADER_BYTES)), fileSize: stat.value.size };
}
