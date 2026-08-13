/**
 * Byte primitives for the converter.
 *
 * Everything here is pure TypeScript compiled into the renderer bundle. There
 * is no network call, no worker fetched from a URL and no optional native
 * dependency: an adapter that depends only on this file is genuinely bundled
 * and works with the machine offline.
 *
 * The privileged bridge hands file contents over as base64 and takes file
 * contents back as UTF-8 text, so every routine here is written to move between
 * those two representations without ever holding more than one copy of a
 * payload at a time.
 */

/** Characters of the standard base64 alphabet, in order. */
const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
/** RFC 4648 base32 alphabet. */
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const HEX_DIGITS = '0123456789abcdef';

/** Chunk size used whenever a large array is walked through `String.fromCharCode`. */
const CHUNK = 0x8000;

/**
 * Decodes a base64 payload into bytes.
 *
 * `atob` is a platform primitive rather than a dependency, and it rejects a
 * malformed payload by throwing, which is exactly the boundary this converter
 * wants: a source that is not what it claimed stays untouched and reports.
 */
export function base64ToBytes(base64: string): Uint8Array {
  const clean = base64.replace(/\s+/g, '');
  const binary = atob(clean);
  const out = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) out[index] = binary.charCodeAt(index);
  return out;
}

/** Encodes bytes as standard base64 with padding. */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + CHUNK));
  }
  return btoa(binary);
}

/** Encodes bytes as base64 with a line break every `width` characters. */
export function bytesToBase64Wrapped(bytes: Uint8Array, width: number): string {
  const flat = bytesToBase64(bytes);
  if (width <= 0) return flat;
  const lines: string[] = [];
  for (let offset = 0; offset < flat.length; offset += width) {
    lines.push(flat.slice(offset, offset + width));
  }
  return lines.join('\n');
}

/** Encodes bytes as lowercase hexadecimal, optionally wrapped and spaced. */
export function bytesToHex(bytes: Uint8Array, options: { width?: number; separator?: string } = {}): string {
  const separator = options.separator ?? '';
  const width = options.width ?? 0;
  const parts: string[] = [];
  let line: string[] = [];
  for (let index = 0; index < bytes.length; index += 1) {
    const value = bytes[index];
    line.push(HEX_DIGITS[value >> 4] + HEX_DIGITS[value & 0x0f]);
    if (width > 0 && line.length >= width) {
      parts.push(line.join(separator));
      line = [];
    }
  }
  if (line.length > 0) parts.push(line.join(separator));
  return parts.join('\n');
}

/** Encodes bytes as RFC 4648 base32 with padding. */
export function bytesToBase32(bytes: Uint8Array): string {
  let out = '';
  let buffer = 0;
  let bits = 0;
  for (let index = 0; index < bytes.length; index += 1) {
    buffer = (buffer << 8) | bytes[index];
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(buffer >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32_ALPHABET[(buffer << (5 - bits)) & 31];
  while (out.length % 8 !== 0) out += '=';
  return out;
}

/** True when every byte is printable ASCII, tab, carriage return or line feed. */
export function isAsciiText(bytes: Uint8Array): boolean {
  for (let index = 0; index < bytes.length; index += 1) {
    const value = bytes[index];
    if (value === 9 || value === 10 || value === 13) continue;
    if (value < 32 || value > 126) return false;
  }
  return true;
}

/** Decodes bytes as UTF-8, refusing anything that is not valid UTF-8. */
export function bytesToUtf8Strict(bytes: Uint8Array): string {
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

/** Decodes bytes as UTF-8, replacing anything invalid. Used for previews only. */
export function bytesToUtf8Lossy(bytes: Uint8Array): string {
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
}

/** Encodes a string as UTF-8 bytes. */
export function utf8ToBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

/** Decodes bytes as Latin-1, which never fails and never loses a byte. */
export function bytesToLatin1(bytes: Uint8Array): string {
  let out = '';
  for (let offset = 0; offset < bytes.length; offset += CHUNK) {
    out += String.fromCharCode(...bytes.subarray(offset, offset + CHUNK));
  }
  return out;
}

/** Reads a big-endian unsigned integer of `size` bytes. */
export function readUintBE(bytes: Uint8Array, offset: number, size: number): number {
  let value = 0;
  for (let index = 0; index < size; index += 1) value = value * 256 + bytes[offset + index];
  return value;
}

/** Reads a little-endian unsigned integer of `size` bytes. */
export function readUintLE(bytes: Uint8Array, offset: number, size: number): number {
  let value = 0;
  for (let index = size - 1; index >= 0; index -= 1) value = value * 256 + bytes[offset + index];
  return value;
}

/** True when `bytes` begins with `signature` at `offset`. */
export function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  for (let index = 0; index < signature.length; index += 1) {
    if (bytes[offset + index] !== signature[index]) return false;
  }
  return true;
}

/** Turns an ASCII string into the byte signature it represents. */
export function ascii(text: string): number[] {
  const out: number[] = [];
  for (let index = 0; index < text.length; index += 1) out.push(text.charCodeAt(index) & 0xff);
  return out;
}

/** Finds `needle` inside `haystack`, searching backwards from `from`. */
export function lastIndexOfBytes(haystack: Uint8Array, needle: readonly number[], from: number): number {
  for (let start = Math.min(from, haystack.length - needle.length); start >= 0; start -= 1) {
    let matched = true;
    for (let index = 0; index < needle.length; index += 1) {
      if (haystack[start + index] !== needle[index]) {
        matched = false;
        break;
      }
    }
    if (matched) return start;
  }
  return -1;
}

/** Finds `needle` inside `haystack`, searching forwards from `from`. */
export function indexOfBytes(haystack: Uint8Array, needle: readonly number[], from = 0): number {
  const limit = haystack.length - needle.length;
  for (let start = Math.max(0, from); start <= limit; start += 1) {
    let matched = true;
    for (let index = 0; index < needle.length; index += 1) {
      if (haystack[start + index] !== needle[index]) {
        matched = false;
        break;
      }
    }
    if (matched) return start;
  }
  return -1;
}

/* ------------------------------------------------------------------ */
/* CRC-32                                                              */
/* ------------------------------------------------------------------ */

let crcTable: Uint32Array | null = null;

function crc32Table(): Uint32Array {
  if (crcTable) return crcTable;
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  crcTable = table;
  return table;
}

/** The CRC-32 used by ZIP and gzip, so a decompressed member can be verified. */
export function crc32(bytes: Uint8Array): number {
  const table = crc32Table();
  let crc = 0xffffffff;
  for (let index = 0; index < bytes.length; index += 1) {
    crc = table[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/* ------------------------------------------------------------------ */
/* SHA-256                                                             */
/* ------------------------------------------------------------------ */

const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98,
  0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8,
  0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819,
  0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7,
  0xc67178f2
]);

/**
 * SHA-256 of a byte array, as lowercase hexadecimal.
 *
 * Written out rather than taken from `crypto.subtle`, because the subtle crypto
 * interface is only present in a secure context and the packaged renderer is
 * loaded from a file URL. A digest that is sometimes unavailable is a digest
 * that cannot be part of an evidence line.
 */
export function sha256Hex(bytes: Uint8Array): string {
  const h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ]);

  const bitLength = bytes.length * 8;
  const paddedLength = (((bytes.length + 9) >> 6) + 1) << 6;
  const padded = new Uint8Array(paddedLength);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000), false);
  view.setUint32(paddedLength - 4, bitLength >>> 0, false);

  const w = new Uint32Array(64);
  for (let block = 0; block < paddedLength; block += 64) {
    for (let index = 0; index < 16; index += 1) w[index] = view.getUint32(block + index * 4, false);
    for (let index = 16; index < 64; index += 1) {
      const a = w[index - 15];
      const b = w[index - 2];
      const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3);
      const s1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10);
      w[index] = (w[index - 16] + s0 + w[index - 7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, hh] = [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7]];
    for (let index = 0; index < 64; index += 1) {
      const s1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const temp1 = (hh + s1 + ch + SHA256_K[index] + w[index]) >>> 0;
      const s0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }
    h[0] = (h[0] + a) >>> 0;
    h[1] = (h[1] + b) >>> 0;
    h[2] = (h[2] + c) >>> 0;
    h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0;
    h[5] = (h[5] + f) >>> 0;
    h[6] = (h[6] + g) >>> 0;
    h[7] = (h[7] + hh) >>> 0;
  }

  let out = '';
  for (let index = 0; index < 8; index += 1) out += h[index].toString(16).padStart(8, '0');
  return out;
}

/* ------------------------------------------------------------------ */
/* Decompression                                                       */
/* ------------------------------------------------------------------ */

type DecompressionFormat = 'gzip' | 'deflate' | 'deflate-raw';

interface DecompressionStreamLike {
  readable: ReadableStream<Uint8Array>;
  writable: WritableStream<Uint8Array>;
}

type DecompressionStreamConstructor = new (format: DecompressionFormat) => DecompressionStreamLike;

/**
 * Resolves the platform's own decompression stream.
 *
 * The constructor ships inside the packaged runtime, so an adapter that uses it
 * is bundled in exactly the sense the registry means: nothing is discovered on
 * PATH, nothing is downloaded and nothing is optional at install time. It is
 * still probed at runtime so a build that genuinely lacks it reports the exact
 * gap rather than failing halfway through a file.
 */
export function decompressionStreamConstructor(): DecompressionStreamConstructor | null {
  const candidate = (globalThis as Record<string, unknown>)['DecompressionStream'];
  return typeof candidate === 'function' ? (candidate as DecompressionStreamConstructor) : null;
}

/** True when the packaged runtime exposes the decompression streams. */
export function hasDecompression(): boolean {
  return decompressionStreamConstructor() !== null;
}

/**
 * Decompresses a buffer, refusing once the output passes `maxOutputBytes`.
 *
 * The bound is enforced while the stream is being read rather than afterwards,
 * so a compression bomb is stopped at the limit instead of being fully expanded
 * and then rejected.
 */
export async function decompress(
  bytes: Uint8Array,
  format: DecompressionFormat,
  maxOutputBytes: number
): Promise<Uint8Array> {
  const Constructor = decompressionStreamConstructor();
  if (!Constructor) {
    throw new Error('The packaged runtime does not expose DecompressionStream, so nothing was decompressed.');
  }
  const stream = new Constructor(format);
  const writer = stream.writable.getWriter();
  const writeDone = writer.write(bytes).then(() => writer.close());

  const reader = stream.readable.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const next = await reader.read();
    if (next.done) break;
    const chunk = next.value;
    total += chunk.length;
    if (total > maxOutputBytes) {
      await reader.cancel();
      throw new Error(
        `Decompressed output passed the ${maxOutputBytes}-byte ceiling after ${total} bytes. Nothing was written.`
      );
    }
    chunks.push(chunk);
  }
  await writeDone;

  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

/** Formats a byte count for display. The number itself is never restyled. */
export function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value < 0) return '0 B';
  if (value < 1024) return `${value} B`;
  const units = ['KiB', 'MiB', 'GiB', 'TiB'];
  let scaled = value / 1024;
  let unit = 0;
  while (scaled >= 1024 && unit < units.length - 1) {
    scaled /= 1024;
    unit += 1;
  }
  return `${scaled.toFixed(scaled < 10 ? 2 : 1)} ${units[unit]}`;
}
