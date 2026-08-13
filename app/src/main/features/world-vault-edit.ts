/**
 * The canonical, tested implementation of chunk copy/remove for the world
 * vault's edit feature (inventory row 13.10).
 *
 * WHY THIS FILE IS NOT WIRED INTO THE ELECTRON MAIN PROCESS
 *
 * `electron.vite.config.ts`'s main build has exactly one Rollup entry point,
 * `src/main/index.ts`, and every IPC channel the renderer may call is closed
 * over two allow-lists this feature does not own: `shared/channels.ts`'s
 * `INVOKE_CHANNELS` and `shared/api.ts`'s `StudioApi` shape, both exposed
 * through `preload/index.ts`. This feature's owned files do not include any of
 * those three, so this module cannot register a new privileged IPC handler
 * without editing files outside its lane.
 *
 * What it CAN do — and what actually makes the feature work today, using only
 * the already-sanctioned surface — is run as a real, unsandboxed Node.js
 * process, because `studio.process.spawn({ command: 'node', ... })` is already
 * on the application's allow-listed command list (see
 * `app/src/main/services/processes.ts`). That is exactly the mechanism the
 * renderer feature (`app/src/renderer/features/world-vault-edit/`) uses at
 * runtime: it materialises a plain, dependency-free CommonJS worker script —
 * `worker-source.ts`'s `REGION_EDIT_WORKER_SOURCE` — to disk with
 * `studio.fs.writeText` and spawns `node` against it. That worker script is a
 * deliberate, line-by-line transliteration of the algorithm below into plain
 * JavaScript, chosen because a compiled artifact of *this* file is not
 * guaranteed to exist next to a packaged installer (only `out/main`,
 * `out/preload` and `out/renderer` are built and shipped; this file lives
 * outside that Rollup graph).
 *
 * So this file's job is to be the single, precisely tested, strongly typed
 * reference for that algorithm — read and reasoned about here, verified here
 * with real Node `fs`/`zlib` against real Anvil-shaped fixtures, and kept in
 * exact lock-step with the worker script's JavaScript. It also exposes a CLI
 * entry point (`copyOrRemoveFromArgv`) usable directly with `node` on a
 * runtime that can execute TypeScript's erasable syntax without a build step,
 * for whichever lane later wires real IPC around it.
 *
 * THE FORMAT ITSELF
 *
 * Every byte-level decision below is read directly from this project's own
 * region-file writer, not from memory of the Anvil spec:
 *   - `src/main/java/game/data/region/McaFile.java` — the 8 KiB header (a
 *     4096-byte location table, then a 4096-byte timestamp table), the 3-byte
 *     big-endian sector offset plus 1-byte sector count per chunk, and 4096
 *     bytes per sector.
 *   - `src/main/java/game/data/chunk/ChunkBinary.java` — each chunk's sector
 *     payload: a 4-byte big-endian length (the compressed bytes plus the one
 *     compression-type byte), a 1-byte compression type (2 = zlib, matching
 *     `CompressionManager.zlibCompress`), then the zlib-compressed NBT.
 *   - `src/main/java/game/data/chunk/Chunk.java`'s `addGeneralLevelTags` —
 *     `xPos`/`zPos` are chunk coordinates, added at the level compound (root
 *     for 1.18+, under `Level` before it).
 *   - `src/main/java/game/data/chunk/ChunkEntities.java` — block entities
 *     (`TileEntities` pre-1.18, `block_entities` from 1.18) carry absolute `x`,
 *     `y`, `z` IntTags; `toEntityNbt()` writes the separate `entities/*.mca`
 *     companion file's root `Position` IntArrayTag as **chunk** coordinates.
 *
 * Entity `Pos` (a 3-element DoubleTag list, absolute block coordinates) is
 * standard Notchian NBT this project reads back through the same `se.llbit.nbt`
 * library; it is not re-derived here, only relied upon.
 */

import { randomBytes } from 'node:crypto';
import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync
} from 'node:fs';
import { dirname } from 'node:path';
import { deflateSync, gunzipSync, inflateSync } from 'node:zlib';

/* ================================================================== */
/* NBT: types                                                          */
/* ================================================================== */

export type NbtTag =
  | { type: 1; value: number }
  | { type: 2; value: number }
  | { type: 3; value: number }
  | { type: 4; value: bigint }
  | { type: 5; value: number }
  | { type: 6; value: number }
  | { type: 7; value: Uint8Array }
  | { type: 8; value: string }
  | { type: 9; value: NbtTag[]; itemType: number }
  | { type: 10; value: NbtCompound }
  | { type: 11; value: Int32Array }
  | { type: 12; value: BigInt64Array };

export interface NbtCompound {
  [key: string]: NbtTag;
}

const MAX_DEPTH = 128;
/** Chunk data (packed block-state longs, palettes) can be large; bound it generously rather than tightly. */
const MAX_LIST_ELEMENTS = 4_000_000;
const MAX_STRING_BYTES = 1_000_000;

function isCompoundTag(tag: NbtTag | undefined): tag is Extract<NbtTag, { type: 10 }> {
  return tag !== undefined && tag.type === 10;
}
function isListTag(tag: NbtTag | undefined): tag is Extract<NbtTag, { type: 9 }> {
  return tag !== undefined && tag.type === 9;
}
function isIntTag(tag: NbtTag | undefined): tag is Extract<NbtTag, { type: 3 }> {
  return tag !== undefined && tag.type === 3;
}

/* ================================================================== */
/* NBT: binary reader                                                  */
/* ================================================================== */

class NbtReader {
  private offset = 0;

  constructor(private readonly buf: Buffer) {}

  private need(count: number): number {
    const start = this.offset;
    if (start + count > this.buf.length) {
      throw new Error('The NBT data ends in the middle of a tag; the chunk is truncated or corrupt.');
    }
    this.offset = start + count;
    return start;
  }

  ubyte(): number {
    return this.buf.readUInt8(this.need(1));
  }
  byte(): number {
    return this.buf.readInt8(this.need(1));
  }
  short(): number {
    return this.buf.readInt16BE(this.need(2));
  }
  ushort(): number {
    return this.buf.readUInt16BE(this.need(2));
  }
  int(): number {
    return this.buf.readInt32BE(this.need(4));
  }
  long(): bigint {
    return this.buf.readBigInt64BE(this.need(8));
  }
  float(): number {
    return this.buf.readFloatBE(this.need(4));
  }
  double(): number {
    return this.buf.readDoubleBE(this.need(8));
  }
  bytes(count: number): Buffer {
    const start = this.need(count);
    return this.buf.subarray(start, start + count);
  }
  string(): string {
    const length = this.ushort();
    if (length > MAX_STRING_BYTES) {
      throw new Error(`An NBT string claims ${String(length)} bytes, past the ${String(MAX_STRING_BYTES)}-byte bound.`);
    }
    const start = this.need(length);
    return this.buf.toString('utf8', start, start + length);
  }
  atEnd(): boolean {
    return this.offset >= this.buf.length;
  }
}

function readCount(reader: NbtReader): number {
  const count = reader.int();
  if (count < 0 || count > MAX_LIST_ELEMENTS) {
    throw new Error(`An NBT list/array claims ${String(count)} entries, past the ${String(MAX_LIST_ELEMENTS)} bound.`);
  }
  return count;
}

function readPayload(reader: NbtReader, type: number, depth: number): NbtTag {
  if (depth > MAX_DEPTH) throw new Error(`NBT nests deeper than ${String(MAX_DEPTH)} levels.`);
  switch (type) {
    case 1:
      return { type: 1, value: reader.byte() };
    case 2:
      return { type: 2, value: reader.short() };
    case 3:
      return { type: 3, value: reader.int() };
    case 4:
      return { type: 4, value: reader.long() };
    case 5:
      return { type: 5, value: reader.float() };
    case 6:
      return { type: 6, value: reader.double() };
    case 7: {
      const count = readCount(reader);
      return { type: 7, value: new Uint8Array(reader.bytes(count)) };
    }
    case 8:
      return { type: 8, value: reader.string() };
    case 9: {
      const itemType = reader.ubyte();
      const count = readCount(reader);
      const items: NbtTag[] = [];
      for (let index = 0; index < count; index += 1) items.push(readPayload(reader, itemType, depth + 1));
      return { type: 9, value: items, itemType };
    }
    case 10:
      return { type: 10, value: readCompoundPayload(reader, depth + 1) };
    case 11: {
      const count = readCount(reader);
      const values = new Int32Array(count);
      for (let index = 0; index < count; index += 1) values[index] = reader.int();
      return { type: 11, value: values };
    }
    case 12: {
      const count = readCount(reader);
      const values = new BigInt64Array(count);
      for (let index = 0; index < count; index += 1) values[index] = reader.long();
      return { type: 12, value: values };
    }
    default:
      throw new Error(`Tag type ${String(type)} is not part of the NBT format.`);
  }
}

function readCompoundPayload(reader: NbtReader, depth: number): NbtCompound {
  if (depth > MAX_DEPTH) throw new Error(`NBT nests deeper than ${String(MAX_DEPTH)} levels.`);
  const compound: NbtCompound = {};
  for (;;) {
    if (reader.atEnd()) throw new Error('A compound tag is never closed with an end tag.');
    const tagType = reader.ubyte();
    if (tagType === 0) return compound;
    const name = reader.string();
    compound[name] = readPayload(reader, tagType, depth + 1);
  }
}

/** Reads a full named root tag (`[type][name][payload]`) as this project writes it. */
export function readNamedRoot(bytes: Buffer): { name: string; root: NbtCompound } {
  const reader = new NbtReader(bytes);
  const rootType = reader.ubyte();
  if (rootType !== 10) throw new Error('The chunk NBT does not begin with a compound tag.');
  const name = reader.string();
  const root = readCompoundPayload(reader, 0);
  return { name, root };
}

/* ================================================================== */
/* NBT: binary writer                                                  */
/* ================================================================== */

class NbtWriter {
  private readonly parts: Buffer[] = [];

  private push(part: Buffer): void {
    this.parts.push(part);
  }

  ubyte(v: number): void {
    const b = Buffer.alloc(1);
    b.writeUInt8(v & 0xff, 0);
    this.push(b);
  }
  byte(v: number): void {
    const b = Buffer.alloc(1);
    b.writeInt8(v, 0);
    this.push(b);
  }
  short(v: number): void {
    const b = Buffer.alloc(2);
    b.writeInt16BE(v, 0);
    this.push(b);
  }
  ushort(v: number): void {
    const b = Buffer.alloc(2);
    b.writeUInt16BE(v, 0);
    this.push(b);
  }
  int(v: number): void {
    const b = Buffer.alloc(4);
    b.writeInt32BE(v, 0);
    this.push(b);
  }
  long(v: bigint): void {
    const b = Buffer.alloc(8);
    b.writeBigInt64BE(v, 0);
    this.push(b);
  }
  float(v: number): void {
    const b = Buffer.alloc(4);
    b.writeFloatBE(v, 0);
    this.push(b);
  }
  double(v: number): void {
    const b = Buffer.alloc(8);
    b.writeDoubleBE(v, 0);
    this.push(b);
  }
  rawBytes(v: Uint8Array): void {
    this.push(Buffer.from(v));
  }
  writeString(s: string): void {
    const utf8 = Buffer.from(s, 'utf8');
    if (utf8.length > 65_535) throw new Error('An NBT string is longer than the format allows (65535 bytes).');
    this.ushort(utf8.length);
    this.push(utf8);
  }

  writePayload(tag: NbtTag): void {
    switch (tag.type) {
      case 1:
        this.byte(tag.value);
        return;
      case 2:
        this.short(tag.value);
        return;
      case 3:
        this.int(tag.value);
        return;
      case 4:
        this.long(tag.value);
        return;
      case 5:
        this.float(tag.value);
        return;
      case 6:
        this.double(tag.value);
        return;
      case 7:
        this.int(tag.value.length);
        this.rawBytes(tag.value);
        return;
      case 8:
        this.writeString(tag.value);
        return;
      case 9:
        this.ubyte(tag.value.length === 0 ? tag.itemType : tag.value[0].type);
        this.int(tag.value.length);
        for (const item of tag.value) this.writePayload(item);
        return;
      case 10:
        this.writeCompoundPayload(tag.value);
        return;
      case 11:
        this.int(tag.value.length);
        for (const v of tag.value) this.int(v);
        return;
      case 12:
        this.int(tag.value.length);
        for (const v of tag.value) this.long(v);
        return;
    }
  }

  writeCompoundPayload(compound: NbtCompound): void {
    for (const [name, tag] of Object.entries(compound)) {
      this.ubyte(tag.type);
      this.writeString(name);
      this.writePayload(tag);
    }
    this.ubyte(0);
  }

  toBuffer(): Buffer {
    return Buffer.concat(this.parts);
  }
}

/** Writes a full named root tag with an empty name, matching `new NamedTag("", root)`. */
export function writeNamedRoot(root: NbtCompound, name = ''): Buffer {
  const writer = new NbtWriter();
  writer.ubyte(10);
  writer.writeString(name);
  writer.writeCompoundPayload(root);
  return writer.toBuffer();
}

/* ================================================================== */
/* Anvil region format                                                 */
/* ================================================================== */

export const SECTOR_SIZE = 4096;

export interface RegionChunkEntry {
  timestamp: number;
  /** The full Anvil chunk-sector payload: 4-byte length + 1-byte type + compressed NBT. */
  sectorData: Buffer;
}

export interface ParsedRegion {
  /** Keyed by local chunk index `localX + localZ * 32` (0..1023). */
  chunks: Map<number, RegionChunkEntry>;
}

export function mod32(n: number): number {
  return ((n % 32) + 32) % 32;
}

export function localIndex(localX: number, localZ: number): number {
  return (localX & 31) + (localZ & 31) * 32;
}

/** Parses a `.mca` file's header and chunk sectors. Never mutates untouched chunk bytes. */
export function parseRegionFile(buf: Buffer): ParsedRegion {
  const chunks = new Map<number, RegionChunkEntry>();
  if (buf.length < SECTOR_SIZE * 2) return { chunks };

  for (let i = 0; i < 1024; i += 1) {
    const offset = i * 4;
    const location = (buf[offset] << 16) | (buf[offset + 1] << 8) | buf[offset + 2];
    const size = buf[offset + 3];
    if (size === 0) continue;
    const timestamp = buf.readUInt32BE(SECTOR_SIZE + offset);
    const start = location * SECTOR_SIZE;
    const end = (location + size) * SECTOR_SIZE;
    if (start < SECTOR_SIZE * 2 || end > buf.length || end <= start) continue;
    chunks.set(i, { timestamp, sectorData: buf.subarray(start, end) });
  }
  return { chunks };
}

/** Rebuilds a `.mca` file, assigning sectors in ascending chunk-index order. */
export function buildRegionFile(chunks: Map<number, RegionChunkEntry>): Buffer {
  const locations = Buffer.alloc(SECTOR_SIZE);
  const timestamps = Buffer.alloc(SECTOR_SIZE);
  const dataParts: Buffer[] = [];
  let cursor = 2;

  const indices = [...chunks.keys()].sort((a, b) => a - b);
  for (const index of indices) {
    const entry = chunks.get(index);
    if (!entry) continue;
    const sectorsNeeded = Math.ceil(entry.sectorData.length / SECTOR_SIZE);
    if (sectorsNeeded > 255) {
      throw new Error(`Chunk at local index ${String(index)} needs ${String(sectorsNeeded)} sectors, past the format's 255-sector-per-chunk limit.`);
    }
    if (sectorsNeeded === 0) continue;
    const padLength = sectorsNeeded * SECTOR_SIZE - entry.sectorData.length;
    const padded = padLength === 0 ? entry.sectorData : Buffer.concat([entry.sectorData, Buffer.alloc(padLength)]);

    const offset = index * 4;
    locations[offset] = (cursor >>> 16) & 0xff;
    locations[offset + 1] = (cursor >>> 8) & 0xff;
    locations[offset + 2] = cursor & 0xff;
    locations[offset + 3] = sectorsNeeded & 0xff;
    timestamps.writeUInt32BE(entry.timestamp >>> 0, offset);

    dataParts.push(padded);
    cursor += sectorsNeeded;
  }

  return Buffer.concat([locations, timestamps, ...dataParts]);
}

/** Decompresses one chunk sector's payload into raw NBT bytes. */
export function decodeChunkSector(sectorData: Buffer): Buffer {
  if (sectorData.length < 5) throw new Error('A chunk sector is too short to hold a valid Anvil chunk header.');
  const length = sectorData.readUInt32BE(0);
  const compressionType = sectorData.readUInt8(4);
  const compressed = sectorData.subarray(5, 5 + Math.max(0, length - 1));
  if (compressionType === 2) return inflateSync(compressed);
  if (compressionType === 1) return gunzipSync(compressed);
  throw new Error(`Chunk compression type ${String(compressionType)} is not gzip (1) or zlib (2); this chunk cannot be read.`);
}

/** Compresses raw NBT bytes into a chunk sector's payload, matching `ChunkBinary.fromChunk`'s zlib framing. */
export function encodeChunkSector(nbtBytes: Buffer): Buffer {
  const compressed = deflateSync(nbtBytes);
  const header = Buffer.alloc(5);
  header.writeUInt32BE(compressed.length + 1, 0);
  header.writeUInt8(2, 4);
  return Buffer.concat([header, compressed]);
}

/* ================================================================== */
/* Coordinate rewriting — the hazardous part                           */
/* ================================================================== */

export interface RewriteSummary {
  blockEntitiesMoved: number;
  entitiesMoved: number;
}

function levelCompoundOf(root: NbtCompound): NbtCompound {
  const level = root['Level'];
  return isCompoundTag(level) ? level.value : root;
}

/**
 * Rewrites a chunk's own `xPos`/`zPos` (chunk units) and every absolute
 * position this project's writer places inside a chunk: block entities'
 * `x`/`y`/`z` (block units, `y` unchanged) and entities' `Pos` (block units,
 * `y` unchanged), for both the pre-1.18 `Level`-wrapped shape and the 1.18+
 * root-level shape. Mutates `root` in place and returns what moved, so a
 * caller can state real numbers rather than "some things changed".
 */
export function rewriteChunkCoordinates(root: NbtCompound, deltaChunkX: number, deltaChunkZ: number): RewriteSummary {
  const level = levelCompoundOf(root);

  if (isIntTag(level['xPos'])) level['xPos'] = { type: 3, value: level['xPos'].value + deltaChunkX };
  if (isIntTag(level['zPos'])) level['zPos'] = { type: 3, value: level['zPos'].value + deltaChunkZ };

  const deltaBlockX = deltaChunkX * 16;
  const deltaBlockZ = deltaChunkZ * 16;

  let blockEntitiesMoved = 0;
  for (const key of ['TileEntities', 'block_entities']) {
    const list = level[key];
    if (!isListTag(list)) continue;
    for (const item of list.value) {
      if (!isCompoundTag(item)) continue;
      const comp = item.value;
      if (isIntTag(comp['x'])) {
        comp['x'] = { type: 3, value: comp['x'].value + deltaBlockX };
        blockEntitiesMoved += 1;
      }
      if (isIntTag(comp['z'])) comp['z'] = { type: 3, value: comp['z'].value + deltaBlockZ };
    }
  }

  let entitiesMoved = 0;
  const entities = level['Entities'];
  if (isListTag(entities)) {
    for (const item of entities.value) {
      if (isCompoundTag(item)) entitiesMoved += rewriteEntityCompound(item.value, deltaBlockX, deltaBlockZ);
    }
  }

  return { blockEntitiesMoved, entitiesMoved };
}

/** Rewrites the separate `entities/*.mca` companion file's root: `Position` (chunk units) and `Entities`. */
export function rewriteEntitiesFileRoot(root: NbtCompound, deltaChunkX: number, deltaChunkZ: number): RewriteSummary {
  const position = root['Position'];
  if (position && position.type === 11 && position.value.length >= 2) {
    const values = new Int32Array(position.value);
    values[0] += deltaChunkX;
    values[1] += deltaChunkZ;
    root['Position'] = { type: 11, value: values };
  }
  let entitiesMoved = 0;
  const entities = root['Entities'];
  if (isListTag(entities)) {
    for (const item of entities.value) {
      if (isCompoundTag(item)) entitiesMoved += rewriteEntityCompound(item.value, deltaChunkX * 16, deltaChunkZ * 16);
    }
  }
  return { blockEntitiesMoved: 0, entitiesMoved };
}

function rewriteEntityCompound(comp: NbtCompound, deltaBlockX: number, deltaBlockZ: number): number {
  let moved = 0;
  const pos = comp['Pos'];
  if (isListTag(pos) && pos.value.length >= 3) {
    const x = pos.value[0];
    const z = pos.value[2];
    if (x.type === 6) pos.value[0] = { type: 6, value: x.value + deltaBlockX };
    if (z.type === 6) pos.value[2] = { type: 6, value: z.value + deltaBlockZ };
    moved += 1;
  }

  // A copied entity keeps its original UUID unless it is regenerated here, which
  // would leave two entities in the world sharing one identity — regenerating on
  // copy is what makes a copy a genuinely new entity rather than a duplicate.
  if (comp['UUID'] && comp['UUID'].type === 11 && comp['UUID'].value.length === 4) {
    comp['UUID'] = { type: 11, value: randomUuidInts() };
  } else if (comp['UUIDMost']?.type === 4 && comp['UUIDLeast']?.type === 4) {
    const [most, least] = randomUuidLongs();
    comp['UUIDMost'] = { type: 4, value: most };
    comp['UUIDLeast'] = { type: 4, value: least };
  }

  const passengers = comp['Passengers'];
  if (isListTag(passengers)) {
    for (const passenger of passengers.value) {
      if (isCompoundTag(passenger)) moved += rewriteEntityCompound(passenger.value, deltaBlockX, deltaBlockZ);
    }
  }
  return moved;
}

function randomUuidInts(): Int32Array {
  const bytes = randomBytes(16);
  const out = new Int32Array(4);
  for (let i = 0; i < 4; i += 1) out[i] = bytes.readInt32BE(i * 4);
  return out;
}

function randomUuidLongs(): [bigint, bigint] {
  const bytes = randomBytes(16);
  return [bytes.readBigInt64BE(0), bytes.readBigInt64BE(8)];
}

/* ================================================================== */
/* Atomic, verified writes                                             */
/* ================================================================== */

/**
 * Writes `bytes` to a fresh temp file beside `filePath`, re-reads that temp
 * file from disk (never from the buffer already held in memory) and hands it
 * to `verify`. Only on a clean verification does it rename the temp file over
 * the real path. The original file is never opened for writing at all, so a
 * failed verification leaves it byte-for-byte untouched.
 */
export function atomicWriteAndVerify(
  filePath: string,
  bytes: Buffer,
  verify: (rereadBytes: Buffer) => string | null
): { ok: true } | { ok: false; error: string } {
  mkdirSync(dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.tmp-${randomBytes(6).toString('hex')}`;
  const fd = openSync(tmpPath, 'w');
  try {
    writeFileSync(fd, bytes);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }

  let reread: Buffer;
  try {
    reread = readFileSync(tmpPath);
  } catch (error) {
    safeUnlink(tmpPath);
    return { ok: false, error: `The written file could not be read back: ${describeError(error)}` };
  }

  const problem = verify(reread);
  if (problem) {
    safeUnlink(tmpPath);
    return { ok: false, error: `The write did not verify, so nothing was changed: ${problem}` };
  }

  renameSync(tmpPath, filePath);
  return { ok: true };
}

function safeUnlink(path: string): void {
  try {
    unlinkSync(path);
  } catch {
    /* best-effort cleanup of a temp file */
  }
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/* ================================================================== */
/* High-level operations                                               */
/* ================================================================== */

export interface ChunkPos {
  cx: number;
  cz: number;
}

export interface OperationResult {
  ok: boolean;
  error: string | null;
  filesWritten: string[];
  detail: string;
}

export interface CopyChunkRequest {
  sourceRegionPath: string;
  sourceEntitiesPath: string | null;
  source: ChunkPos;
  destRegionPath: string;
  destEntitiesPath: string | null;
  destination: ChunkPos;
}

/** Copies one chunk to another coordinate, rewriting every absolute position it carries. */
export function copyChunk(req: CopyChunkRequest): OperationResult {
  const sameChunk =
    req.source.cx === req.destination.cx && req.source.cz === req.destination.cz && req.sourceRegionPath === req.destRegionPath;
  if (sameChunk) {
    return { ok: false, error: 'The source and destination are the same chunk.', filesWritten: [], detail: '' };
  }
  if (!existsSync(req.sourceRegionPath)) {
    return { ok: false, error: `The source region file does not exist: ${req.sourceRegionPath}`, filesWritten: [], detail: '' };
  }

  const sourceBuf = readFileSync(req.sourceRegionPath);
  const sourceParsed = parseRegionFile(sourceBuf);
  const sourceIndex = localIndex(mod32(req.source.cx), mod32(req.source.cz));
  const sourceEntry = sourceParsed.chunks.get(sourceIndex);
  if (!sourceEntry) {
    return {
      ok: false,
      error: `The source chunk (${String(req.source.cx)}, ${String(req.source.cz)}) has no data in ${req.sourceRegionPath}.`,
      filesWritten: [],
      detail: ''
    };
  }

  const deltaChunkX = req.destination.cx - req.source.cx;
  const deltaChunkZ = req.destination.cz - req.source.cz;

  let outSector: Buffer;
  let moved: RewriteSummary;
  try {
    const nbtBytes = decodeChunkSector(sourceEntry.sectorData);
    const { root } = readNamedRoot(nbtBytes);
    moved = rewriteChunkCoordinates(root, deltaChunkX, deltaChunkZ);
    outSector = encodeChunkSector(writeNamedRoot(root));
  } catch (error) {
    return { ok: false, error: `Reading the source chunk's NBT failed: ${describeError(error)}`, filesWritten: [], detail: '' };
  }

  const destIndex = localIndex(mod32(req.destination.cx), mod32(req.destination.cz));
  const sameRegionFile = req.destRegionPath === req.sourceRegionPath;
  const destParsed = sameRegionFile
    ? sourceParsed
    : parseRegionFile(existsSync(req.destRegionPath) ? readFileSync(req.destRegionPath) : Buffer.alloc(0));
  destParsed.chunks.set(destIndex, { timestamp: nowUnixSeconds(), sectorData: outSector });
  const destBytes = buildRegionFile(destParsed.chunks);

  const written = atomicWriteAndVerify(req.destRegionPath, destBytes, (reread) => {
    let entry: RegionChunkEntry | undefined;
    try {
      entry = parseRegionFile(reread).chunks.get(destIndex);
    } catch (error) {
      return `the written region file could not be re-parsed: ${describeError(error)}`;
    }
    if (!entry) return 'the destination chunk is missing after the write';
    let decoded: Buffer;
    try {
      decoded = decodeChunkSector(entry.sectorData);
    } catch (error) {
      return `the written chunk could not be decompressed: ${describeError(error)}`;
    }
    let root: NbtCompound;
    try {
      root = readNamedRoot(decoded).root;
    } catch (error) {
      return `the written chunk's NBT could not be parsed: ${describeError(error)}`;
    }
    const level = levelCompoundOf(root);
    const xPos = level['xPos'];
    const zPos = level['zPos'];
    if (isIntTag(xPos) && xPos.value !== req.destination.cx) {
      return `xPos is ${String(xPos.value)}, expected ${String(req.destination.cx)}`;
    }
    if (isIntTag(zPos) && zPos.value !== req.destination.cz) {
      return `zPos is ${String(zPos.value)}, expected ${String(req.destination.cz)}`;
    }
    return null;
  });
  if (!written.ok) return { ok: false, error: written.error, filesWritten: [], detail: '' };

  const filesWritten = [req.destRegionPath];
  let entitiesNote = '';

  if (req.sourceEntitiesPath && req.destEntitiesPath && existsSync(req.sourceEntitiesPath)) {
    const sourceEntBuf = readFileSync(req.sourceEntitiesPath);
    const sourceEntParsed = parseRegionFile(sourceEntBuf);
    const entEntry = sourceEntParsed.chunks.get(sourceIndex);
    if (entEntry) {
      let entOutSector: Buffer;
      try {
        const entNbt = decodeChunkSector(entEntry.sectorData);
        const { root: entRoot } = readNamedRoot(entNbt);
        rewriteEntitiesFileRoot(entRoot, deltaChunkX, deltaChunkZ);
        entOutSector = encodeChunkSector(writeNamedRoot(entRoot));
      } catch (error) {
        return { ok: false, error: `Reading the source entity data failed: ${describeError(error)}`, filesWritten, detail: '' };
      }
      const sameEntitiesFile = req.destEntitiesPath === req.sourceEntitiesPath;
      const destEntParsed = sameEntitiesFile
        ? sourceEntParsed
        : parseRegionFile(existsSync(req.destEntitiesPath) ? readFileSync(req.destEntitiesPath) : Buffer.alloc(0));
      destEntParsed.chunks.set(destIndex, { timestamp: nowUnixSeconds(), sectorData: entOutSector });
      const destEntBytes = buildRegionFile(destEntParsed.chunks);
      const entWritten = atomicWriteAndVerify(req.destEntitiesPath, destEntBytes, (reread) => {
        let entries;
        try {
          entries = parseRegionFile(reread).chunks;
        } catch (error) {
          return `the written entities file could not be re-parsed: ${describeError(error)}`;
        }
        return entries.has(destIndex) ? null : 'the destination entity data is missing after the write';
      });
      if (!entWritten.ok) return { ok: false, error: entWritten.error, filesWritten, detail: '' };
      filesWritten.push(req.destEntitiesPath);
      entitiesNote = ' and its separate entity data';
    }
  }

  return {
    ok: true,
    error: null,
    filesWritten,
    detail: `Copied chunk (${String(req.source.cx)}, ${String(req.source.cz)}) to (${String(req.destination.cx)}, ${String(req.destination.cz)}): ${String(moved.blockEntitiesMoved)} block entities and ${String(moved.entitiesMoved)} entities repositioned${entitiesNote}.`
  };
}

export interface RemoveChunksRequest {
  regionPath: string;
  entitiesPath: string | null;
  chunks: ChunkPos[];
}

/** Clears the given chunks' entries so the game treats them as absent. */
export function removeChunks(req: RemoveChunksRequest): OperationResult {
  if (!existsSync(req.regionPath)) {
    return { ok: false, error: `The region file does not exist: ${req.regionPath}`, filesWritten: [], detail: '' };
  }
  if (req.chunks.length === 0) {
    return { ok: false, error: 'No chunks were given to remove.', filesWritten: [], detail: '' };
  }

  const buf = readFileSync(req.regionPath);
  const parsed = parseRegionFile(buf);
  const indices = req.chunks.map((pos) => localIndex(mod32(pos.cx), mod32(pos.cz)));
  let removed = 0;
  for (const index of indices) {
    if (parsed.chunks.delete(index)) removed += 1;
  }
  if (removed === 0) {
    return { ok: false, error: 'None of the selected chunks have any data to remove.', filesWritten: [], detail: '' };
  }

  const outBytes = buildRegionFile(parsed.chunks);
  const written = atomicWriteAndVerify(req.regionPath, outBytes, (reread) => {
    let entries;
    try {
      entries = parseRegionFile(reread).chunks;
    } catch (error) {
      return `the written region file could not be re-parsed: ${describeError(error)}`;
    }
    for (const index of indices) {
      if (entries.has(index)) return `chunk local index ${String(index)} is still present after removal`;
    }
    return null;
  });
  if (!written.ok) return { ok: false, error: written.error, filesWritten: [], detail: '' };

  const filesWritten = [req.regionPath];

  if (req.entitiesPath && existsSync(req.entitiesPath)) {
    const entBuf = readFileSync(req.entitiesPath);
    const entParsed = parseRegionFile(entBuf);
    let entRemoved = 0;
    for (const index of indices) {
      if (entParsed.chunks.delete(index)) entRemoved += 1;
    }
    if (entRemoved > 0) {
      const entOut = buildRegionFile(entParsed.chunks);
      const entWritten = atomicWriteAndVerify(req.entitiesPath, entOut, (reread) => {
        let entries;
        try {
          entries = parseRegionFile(reread).chunks;
        } catch (error) {
          return `the written entities file could not be re-parsed: ${describeError(error)}`;
        }
        for (const index of indices) {
          if (entries.has(index)) return `entity local index ${String(index)} is still present after removal`;
        }
        return null;
      });
      if (!entWritten.ok) return { ok: false, error: entWritten.error, filesWritten, detail: '' };
      filesWritten.push(req.entitiesPath);
    }
  }

  return {
    ok: true,
    error: null,
    filesWritten,
    detail: `Removed ${String(removed)} chunk(s) from ${req.regionPath}.`
  };
}

function nowUnixSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

/* ================================================================== */
/* CLI entry (forward-compatible; not wired to any IPC channel today)  */
/* ================================================================== */

interface CliOperation {
  kind: 'copy' | 'remove';
  copy?: CopyChunkRequest;
  remove?: RemoveChunksRequest;
}

export function runCliOperation(operation: CliOperation): OperationResult {
  if (operation.kind === 'copy' && operation.copy) return copyChunk(operation.copy);
  if (operation.kind === 'remove' && operation.remove) return removeChunks(operation.remove);
  return { ok: false, error: `Malformed operation: ${JSON.stringify(operation)}`, filesWritten: [], detail: '' };
}

function isDirectCliInvocation(): boolean {
  const entry = process.argv[1];
  return typeof entry === 'string' && import.meta.url === `file://${entry.replace(/\\/g, '/')}`;
}

if (isDirectCliInvocation()) {
  const operationPath = process.argv[2];
  if (!operationPath) {
    process.stdout.write(`${JSON.stringify({ ok: false, error: 'Usage: node world-vault-edit.ts <operation.json>', filesWritten: [], detail: '' })}\n`);
    process.exit(1);
  }
  try {
    const operation = JSON.parse(readFileSync(operationPath, 'utf8')) as CliOperation;
    const result = runCliOperation(operation);
    process.stdout.write(`${JSON.stringify(result)}\n`);
    process.exit(result.ok ? 0 : 1);
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ ok: false, error: describeError(error), filesWritten: [], detail: '' })}\n`);
    process.exit(1);
  }
}
