/**
 * ZIP, gzip and tar readers.
 *
 * Everything here reads a container that is already in memory and produces
 * either an inventory of what is inside it or the bytes of one member. Nothing
 * writes an archive: creating one needs a binary write channel, and the
 * registry lists those routes as unavailable with that exact reason rather than
 * pretending otherwise.
 *
 * Decompression uses the packaged runtime's own decompression streams, bounded
 * so that a compression bomb stops at the ceiling instead of expanding first
 * and being rejected afterwards.
 */

import { ascii, bytesToUtf8Lossy, crc32, decompress, lastIndexOfBytes, readUintLE, startsWith } from './bytes';
import { ConverterBoundary, Deadline, type ResourceLimits } from './limits';

export interface ArchiveEntry {
  /** Path as recorded inside the archive, with separators normalised to `/`. */
  path: string;
  /** True when the entry is a directory marker rather than a file. */
  directory: boolean;
  /** Uncompressed size in bytes, as the archive itself declares it. */
  size: number;
  /** Bytes the entry occupies inside the archive. */
  compressedSize: number;
  /** Human-readable compression method, e.g. `stored`, `deflate`. */
  method: string;
  /** ISO-8601 timestamp when the archive records one, otherwise an empty string. */
  modifiedAt: string;
  /** The CRC-32 the archive claims, as lowercase hexadecimal. */
  crc32: string;
  /** True when this member is encrypted and cannot be read without a password. */
  encrypted: boolean;
  /** Offset of the entry's local header, used to read the member back. */
  offset: number;
  /** Raw method number, kept so a member read can decide what to do. */
  methodCode: number;
}

export interface ArchiveInventory {
  format: 'zip' | 'gzip' | 'tar';
  entries: ArchiveEntry[];
  /** True when the central directory declared more entries than were read. */
  truncated: boolean;
  /** Archive-level comment, when the format carries one. */
  comment: string;
  totalUncompressed: number;
  totalCompressed: number;
}

/**
 * A path recorded inside an archive can point anywhere, including outside the
 * directory it is being read into. Nothing here writes files, but the inventory
 * still marks a traversal so a user is never shown a clean-looking name for an
 * entry that is trying to escape.
 */
export function isUnsafeArchivePath(path: string): boolean {
  const normalized = path.replace(/\\/g, '/');
  if (normalized.startsWith('/')) return true;
  if (/^[A-Za-z]:/.test(normalized)) return true;
  return normalized.split('/').some((segment) => segment === '..');
}

/* ------------------------------------------------------------------ */
/* ZIP                                                                 */
/* ------------------------------------------------------------------ */

const EOCD = [0x50, 0x4b, 0x05, 0x06];
const CENTRAL = [0x50, 0x4b, 0x01, 0x02];
const LOCAL = [0x50, 0x4b, 0x03, 0x04];
const ZIP64_EOCD_LOCATOR = [0x50, 0x4b, 0x06, 0x07];

function zipMethodName(code: number): string {
  switch (code) {
    case 0: return 'stored';
    case 8: return 'deflate';
    case 9: return 'deflate64';
    case 12: return 'bzip2';
    case 14: return 'lzma';
    case 93: return 'zstd';
    case 95: return 'xz';
    case 98: return 'ppmd';
    default: return `method ${code}`;
  }
}

function dosTimeToIso(date: number, time: number): string {
  if (date === 0) return '';
  const year = 1980 + ((date >> 9) & 0x7f);
  const month = (date >> 5) & 0x0f;
  const day = date & 0x1f;
  const hour = (time >> 11) & 0x1f;
  const minute = (time >> 5) & 0x3f;
  const second = (time & 0x1f) * 2;
  if (month < 1 || month > 12 || day < 1 || day > 31) return '';
  const stamp = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  return Number.isNaN(stamp.getTime()) ? '' : stamp.toISOString();
}

/** Reads a ZIP central directory into an inventory. Never decompresses. */
export function readZipInventory(bytes: Uint8Array, limits: ResourceLimits, deadline: Deadline): ArchiveInventory {
  const eocd = lastIndexOfBytes(bytes, EOCD, bytes.length - 22);
  if (eocd < 0) {
    throw new ConverterBoundary('malformed', 'No ZIP end-of-central-directory record was found, so the archive index cannot be read.');
  }
  if (lastIndexOfBytes(bytes, ZIP64_EOCD_LOCATOR, eocd) >= 0 && readUintLE(bytes, eocd + 10, 2) === 0xffff) {
    throw new ConverterBoundary(
      'unsupported',
      'The archive uses the ZIP64 index, which this reader does not implement. Nothing was read beyond the trailer.'
    );
  }

  const declared = readUintLE(bytes, eocd + 10, 2);
  let cursor = readUintLE(bytes, eocd + 16, 4);
  const commentLength = readUintLE(bytes, eocd + 20, 2);
  const comment = commentLength > 0 ? bytesToUtf8Lossy(bytes.subarray(eocd + 22, eocd + 22 + commentLength)) : '';

  const entries: ArchiveEntry[] = [];
  let totalUncompressed = 0;
  let totalCompressed = 0;

  for (let index = 0; index < declared; index += 1) {
    deadline.check();
    if (index >= limits.entries) {
      return {
        format: 'zip',
        entries,
        truncated: true,
        comment,
        totalUncompressed,
        totalCompressed
      };
    }
    if (!startsWith(bytes, CENTRAL, cursor)) break;

    const flags = readUintLE(bytes, cursor + 8, 2);
    const methodCode = readUintLE(bytes, cursor + 10, 2);
    const time = readUintLE(bytes, cursor + 12, 2);
    const date = readUintLE(bytes, cursor + 14, 2);
    const crc = readUintLE(bytes, cursor + 16, 4);
    const compressedSize = readUintLE(bytes, cursor + 20, 4);
    const size = readUintLE(bytes, cursor + 24, 4);
    const nameLength = readUintLE(bytes, cursor + 28, 2);
    const extraLength = readUintLE(bytes, cursor + 30, 2);
    const commentLen = readUintLE(bytes, cursor + 32, 2);
    const offset = readUintLE(bytes, cursor + 42, 4);
    const rawName = bytes.subarray(cursor + 46, cursor + 46 + nameLength);
    const path = bytesToUtf8Lossy(rawName).replace(/\\/g, '/');

    entries.push({
      path,
      directory: path.endsWith('/') || (size === 0 && compressedSize === 0 && path.endsWith('/')),
      size,
      compressedSize,
      method: zipMethodName(methodCode),
      modifiedAt: dosTimeToIso(date, time),
      crc32: crc.toString(16).padStart(8, '0'),
      encrypted: (flags & 1) === 1,
      offset,
      methodCode
    });
    totalUncompressed += size;
    totalCompressed += compressedSize;

    cursor += 46 + nameLength + extraLength + commentLen;
    if (cursor > bytes.length) break;
  }

  return {
    format: 'zip',
    entries,
    truncated: entries.length < declared,
    comment,
    totalUncompressed,
    totalCompressed
  };
}

/** Reads one ZIP member back, verifying its CRC-32 before returning it. */
export async function readZipMember(
  bytes: Uint8Array,
  entry: ArchiveEntry,
  limits: ResourceLimits,
  deadline: Deadline
): Promise<Uint8Array> {
  if (entry.encrypted) {
    throw new ConverterBoundary(
      'encrypted',
      `"${entry.path}" is encrypted inside the archive. This build cannot supply a password to it, so nothing was extracted.`
    );
  }
  if (!startsWith(bytes, LOCAL, entry.offset)) {
    throw new ConverterBoundary('malformed', 'The member’s local header is not where the archive index said it would be.');
  }
  const nameLength = readUintLE(bytes, entry.offset + 26, 2);
  const extraLength = readUintLE(bytes, entry.offset + 28, 2);
  const start = entry.offset + 30 + nameLength + extraLength;
  const end = start + entry.compressedSize;
  if (end > bytes.length) {
    throw new ConverterBoundary('malformed', 'The member runs past the end of the archive, so it cannot be read.');
  }
  if (entry.size > limits.outputBytes) {
    throw new ConverterBoundary(
      'output-size',
      `"${entry.path}" is ${entry.size} bytes uncompressed, past the ${limits.outputBytes}-byte output bound. Nothing was extracted.`
    );
  }
  deadline.check();

  const packed = bytes.subarray(start, end);
  let data: Uint8Array;
  if (entry.methodCode === 0) data = packed.slice();
  else if (entry.methodCode === 8) data = await decompress(packed, 'deflate-raw', limits.outputBytes);
  else {
    throw new ConverterBoundary(
      'unsupported',
      `"${entry.path}" uses the ${entry.method} compression method, which this build does not implement. Nothing was extracted.`
    );
  }

  const actual = crc32(data);
  const expected = Number.parseInt(entry.crc32, 16);
  if (Number.isFinite(expected) && expected !== 0 && actual !== expected) {
    throw new ConverterBoundary(
      'validation',
      `The extracted member failed its CRC-32 check: the archive records ${entry.crc32} and the bytes produce ${actual
        .toString(16)
        .padStart(8, '0')}. Nothing was written.`
    );
  }
  return data;
}

/* ------------------------------------------------------------------ */
/* gzip                                                                */
/* ------------------------------------------------------------------ */

export interface GzipHeader {
  /** Original file name recorded in the header, when there is one. */
  originalName: string;
  comment: string;
  modifiedAt: string;
  /** Size recorded in the trailer, modulo 2^32. */
  declaredSize: number;
  declaredCrc32: string;
}

/** Reads the gzip header and trailer without decompressing the member. */
export function readGzipHeader(bytes: Uint8Array): GzipHeader {
  if (!startsWith(bytes, [0x1f, 0x8b])) {
    throw new ConverterBoundary('unsupported', 'The file does not begin with a gzip member header.');
  }
  if (bytes[2] !== 8) {
    throw new ConverterBoundary('unsupported', `The gzip member uses compression method ${bytes[2]} rather than deflate.`);
  }
  const flags = bytes[3];
  const mtime = readUintLE(bytes, 4, 4);
  let cursor = 10;
  if ((flags & 0x04) !== 0) {
    const extraLength = readUintLE(bytes, cursor, 2);
    cursor += 2 + extraLength;
  }
  let originalName = '';
  if ((flags & 0x08) !== 0) {
    const start = cursor;
    while (cursor < bytes.length && bytes[cursor] !== 0) cursor += 1;
    originalName = bytesToUtf8Lossy(bytes.subarray(start, cursor));
    cursor += 1;
  }
  let comment = '';
  if ((flags & 0x10) !== 0) {
    const start = cursor;
    while (cursor < bytes.length && bytes[cursor] !== 0) cursor += 1;
    comment = bytesToUtf8Lossy(bytes.subarray(start, cursor));
    cursor += 1;
  }

  const declaredCrc = bytes.length >= 8 ? readUintLE(bytes, bytes.length - 8, 4) : 0;
  const declaredSize = bytes.length >= 4 ? readUintLE(bytes, bytes.length - 4, 4) : 0;

  return {
    originalName,
    comment,
    modifiedAt: mtime > 0 ? new Date(mtime * 1000).toISOString() : '',
    declaredSize,
    declaredCrc32: declaredCrc.toString(16).padStart(8, '0')
  };
}

/** Decompresses a gzip member and verifies its trailer. */
export async function readGzipMember(
  bytes: Uint8Array,
  limits: ResourceLimits,
  deadline: Deadline
): Promise<Uint8Array> {
  const header = readGzipHeader(bytes);
  deadline.check();
  const data = await decompress(bytes, 'gzip', limits.outputBytes);
  const actualCrc = crc32(data).toString(16).padStart(8, '0');
  if (header.declaredCrc32 !== '00000000' && actualCrc !== header.declaredCrc32) {
    throw new ConverterBoundary(
      'validation',
      `The decompressed member failed its CRC-32 check: the trailer records ${header.declaredCrc32} and the bytes produce ${actualCrc}. Nothing was written.`
    );
  }
  if (header.declaredSize !== 0 && data.length % 0x100000000 !== header.declaredSize) {
    throw new ConverterBoundary(
      'validation',
      `The decompressed member is ${data.length} bytes and the gzip trailer records ${header.declaredSize}. Nothing was written.`
    );
  }
  return data;
}

/* ------------------------------------------------------------------ */
/* tar                                                                 */
/* ------------------------------------------------------------------ */

function tarOctal(bytes: Uint8Array, offset: number, length: number): number {
  let text = '';
  for (let index = offset; index < offset + length; index += 1) {
    const byte = bytes[index];
    if (byte === 0 || byte === 0x20) break;
    text += String.fromCharCode(byte);
  }
  const value = Number.parseInt(text.trim(), 8);
  return Number.isFinite(value) ? value : 0;
}

function tarString(bytes: Uint8Array, offset: number, length: number): string {
  let end = offset;
  while (end < offset + length && bytes[end] !== 0) end += 1;
  return bytesToUtf8Lossy(bytes.subarray(offset, end));
}

function tarTypeName(code: number): string {
  switch (String.fromCharCode(code)) {
    case '0':
    case ' ': return 'file';
    case '1': return 'hard link';
    case '2': return 'symbolic link';
    case '3': return 'character device';
    case '4': return 'block device';
    case '5': return 'directory';
    case '6': return 'fifo';
    case 'L': return 'long name';
    case 'x':
    case 'g': return 'extended header';
    default: return `type ${String.fromCharCode(code)}`;
  }
}

/** Reads a tar archive's member headers. Never reads member content. */
export function readTarInventory(bytes: Uint8Array, limits: ResourceLimits, deadline: Deadline): ArchiveInventory {
  const entries: ArchiveEntry[] = [];
  let cursor = 0;
  let total = 0;
  let pendingLongName = '';

  while (cursor + 512 <= bytes.length) {
    deadline.check();
    // Two consecutive zero blocks end the archive.
    let empty = true;
    for (let index = 0; index < 512; index += 1) {
      if (bytes[cursor + index] !== 0) {
        empty = false;
        break;
      }
    }
    if (empty) break;

    const typeCode = bytes[cursor + 156];
    const size = tarOctal(bytes, cursor + 124, 12);
    const mtime = tarOctal(bytes, cursor + 136, 12);
    const prefix = tarString(bytes, cursor + 345, 155);
    const rawName = tarString(bytes, cursor, 100);
    const path = pendingLongName || (prefix.length > 0 ? `${prefix}/${rawName}` : rawName);
    const kind = tarTypeName(typeCode);

    const blocks = Math.ceil(size / 512);
    const dataOffset = cursor + 512;

    if (kind === 'long name') {
      pendingLongName = bytesToUtf8Lossy(bytes.subarray(dataOffset, dataOffset + size)).replace(/\0+$/, '');
      cursor = dataOffset + blocks * 512;
      continue;
    }
    pendingLongName = '';

    if (kind !== 'extended header') {
      entries.push({
        path: path.replace(/\\/g, '/'),
        directory: kind === 'directory',
        size,
        compressedSize: size,
        method: kind === 'file' ? 'stored' : kind,
        modifiedAt: mtime > 0 ? new Date(mtime * 1000).toISOString() : '',
        crc32: '',
        encrypted: false,
        offset: dataOffset,
        methodCode: 0
      });
      total += size;
      if (entries.length >= limits.entries) {
        return { format: 'tar', entries, truncated: true, comment: '', totalUncompressed: total, totalCompressed: total };
      }
    }

    cursor = dataOffset + blocks * 512;
  }

  return { format: 'tar', entries, truncated: false, comment: '', totalUncompressed: total, totalCompressed: total };
}

/** Reads one tar member's bytes straight out of the archive. */
export function readTarMember(bytes: Uint8Array, entry: ArchiveEntry, limits: ResourceLimits): Uint8Array {
  if (entry.size > limits.outputBytes) {
    throw new ConverterBoundary(
      'output-size',
      `"${entry.path}" is ${entry.size} bytes, past the ${limits.outputBytes}-byte output bound. Nothing was extracted.`
    );
  }
  const end = entry.offset + entry.size;
  if (end > bytes.length) {
    throw new ConverterBoundary('malformed', 'The member runs past the end of the archive, so it cannot be read.');
  }
  return bytes.slice(entry.offset, end);
}

/** True when these bytes look like a tar archive rather than something else. */
export function looksLikeTarBytes(bytes: Uint8Array): boolean {
  return startsWith(bytes, ascii('ustar'), 257);
}
