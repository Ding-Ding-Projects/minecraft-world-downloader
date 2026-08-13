/**
 * A bounded reader for the one thing this feature needs out of a Minecraft save:
 * the Minecraft version the world was last written by.
 *
 * Why read it at all: Worldlens states which world versions it can render
 * (Minecraft 1.12.2 through 26.x), and "installed, but too old for this world"
 * is a distinct state that deserves its own message and its own recovery action.
 * Guessing that from a folder name would be a guess; `level.dat` records it.
 *
 * Why write a reader rather than take a dependency: the renderer has no Node
 * modules and no network, and the whole of what is needed here is one string out
 * of a small, completely specified file. Decompression is the browser's own
 * `DecompressionStream`, which Chromium provides; the tag walk below is the NBT
 * format as Mojang documents it.
 *
 * Everything is bounded. A `level.dat` is a few kilobytes; a file claiming to be
 * one and running to gigabytes is refused rather than parsed, and so is a
 * structure nested deeply enough to be an attack on the parser rather than a
 * world.
 */

/** Nothing legitimate approaches this. A real `level.dat` is a few kilobytes. */
export const MAX_LEVEL_DAT_BYTES = 4 * 1024 * 1024;
/** Ceiling on the decompressed document. */
const MAX_INFLATED_BYTES = 16 * 1024 * 1024;
/** Deeper than any real save, shallow enough that recursion cannot run away. */
const MAX_DEPTH = 64;
/** Ceiling on one list or array, so a corrupt length cannot allocate the heap. */
const MAX_ELEMENTS = 1_000_000;
/** Ceiling on one NBT string. Names and values here are short. */
const MAX_STRING_BYTES = 64 * 1024;

export type NbtValue =
  | number
  | bigint
  | string
  | Uint8Array
  | Int32Array
  | BigInt64Array
  | NbtValue[]
  | NbtCompound;

export interface NbtCompound {
  [key: string]: NbtValue;
}

/** Turns the base64 the privileged bridge returns into bytes. */
export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function drain(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const next = await reader.read();
    if (next.done) break;
    const chunk = next.value;
    total += chunk.byteLength;
    if (total > MAX_INFLATED_BYTES) {
      await reader.cancel();
      throw new Error(
        `The file expands past ${String(MAX_INFLATED_BYTES)} bytes, which no level.dat does. It was not read.`
      );
    }
    chunks.push(chunk);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

/**
 * Decompresses a `level.dat`.
 *
 * Vanilla writes gzip. Some tools write zlib, and a few write the tags with no
 * compression at all, so all three are recognised by their own leading bytes
 * rather than by the file extension, which is the same in every case.
 */
export async function inflateLevelDat(bytes: Uint8Array): Promise<Uint8Array> {
  const first = bytes[0];
  const second = bytes[1];
  let format: 'gzip' | 'deflate' | null = null;
  if (first === 0x1f && second === 0x8b) format = 'gzip';
  else if (first === 0x78) format = 'deflate';
  if (format === null) return bytes;

  if (typeof DecompressionStream === 'undefined') {
    throw new Error('This runtime provides no decompression, so a compressed level.dat cannot be read.');
  }
  const source = new Blob([bytes as BlobPart]).stream();
  return drain(source.pipeThrough(new DecompressionStream(format)) as ReadableStream<Uint8Array>);
}

class Cursor {
  private offset = 0;

  constructor(private readonly view: DataView) {}

  private require(count: number): number {
    const start = this.offset;
    if (start + count > this.view.byteLength) {
      throw new Error('The file ends in the middle of a tag, so it is not a complete level.dat.');
    }
    this.offset = start + count;
    return start;
  }

  byte(): number {
    return this.view.getInt8(this.require(1));
  }

  unsignedShort(): number {
    return this.view.getUint16(this.require(2), false);
  }

  short(): number {
    return this.view.getInt16(this.require(2), false);
  }

  int(): number {
    return this.view.getInt32(this.require(4), false);
  }

  long(): bigint {
    return this.view.getBigInt64(this.require(8), false);
  }

  float(): number {
    return this.view.getFloat32(this.require(4), false);
  }

  double(): number {
    return this.view.getFloat64(this.require(8), false);
  }

  bytes(count: number): Uint8Array {
    const start = this.require(count);
    return new Uint8Array(this.view.buffer, this.view.byteOffset + start, count);
  }

  atEnd(): boolean {
    return this.offset >= this.view.byteLength;
  }
}

const decoder = new TextDecoder('utf-8', { fatal: false });

function readString(cursor: Cursor): string {
  const length = cursor.unsignedShort();
  if (length > MAX_STRING_BYTES) {
    throw new Error(`A tag name or value claims ${String(length)} bytes, which no level.dat contains.`);
  }
  // NBT stores modified UTF-8. Every string this feature reads back — a version
  // name, a level name — is plain ASCII in practice, and the two encodings agree
  // there; a stray supplementary character elsewhere in the file decodes to a
  // replacement rather than aborting the read, because the version string is
  // still perfectly readable when an unrelated tag is unusual.
  return decoder.decode(cursor.bytes(length));
}

function readCount(cursor: Cursor): number {
  const count = cursor.int();
  if (count < 0 || count > MAX_ELEMENTS) {
    throw new Error(`A list or array claims ${String(count)} entries, which is not a readable level.dat.`);
  }
  return count;
}

function readPayload(cursor: Cursor, tag: number, depth: number): NbtValue {
  if (depth > MAX_DEPTH) {
    throw new Error(`The tags nest deeper than ${String(MAX_DEPTH)} levels, so the file was not read.`);
  }
  switch (tag) {
    case 1:
      return cursor.byte();
    case 2:
      return cursor.short();
    case 3:
      return cursor.int();
    case 4:
      return cursor.long();
    case 5:
      return cursor.float();
    case 6:
      return cursor.double();
    case 7:
      return cursor.bytes(readCount(cursor)).slice();
    case 8:
      return readString(cursor);
    case 9: {
      const itemTag = cursor.byte();
      const count = readCount(cursor);
      const items: NbtValue[] = [];
      if (itemTag === 0) return items;
      for (let index = 0; index < count; index += 1) items.push(readPayload(cursor, itemTag, depth + 1));
      return items;
    }
    case 10: {
      const compound: NbtCompound = {};
      for (;;) {
        if (cursor.atEnd()) {
          throw new Error('A compound tag is never closed, so the file is truncated.');
        }
        const childTag = cursor.byte();
        if (childTag === 0) return compound;
        const name = readString(cursor);
        compound[name] = readPayload(cursor, childTag, depth + 1);
      }
    }
    case 11: {
      const count = readCount(cursor);
      const values = new Int32Array(count);
      for (let index = 0; index < count; index += 1) values[index] = cursor.int();
      return values;
    }
    case 12: {
      const count = readCount(cursor);
      const values = new BigInt64Array(count);
      for (let index = 0; index < count; index += 1) values[index] = cursor.long();
      return values;
    }
    default:
      throw new Error(`Tag type ${String(tag)} is not part of the NBT format, so the file is not a level.dat.`);
  }
}

/** Parses a decompressed NBT document and returns its root compound. */
export function parseNbt(bytes: Uint8Array): NbtCompound {
  const cursor = new Cursor(new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength));
  const rootTag = cursor.byte();
  if (rootTag !== 10) {
    throw new Error('The file does not begin with a compound tag, so it is not a level.dat.');
  }
  readString(cursor);
  const root = readPayload(cursor, 10, 0);
  if (typeof root !== 'object' || root === null || Array.isArray(root) || ArrayBuffer.isView(root)) {
    throw new Error('The root tag is not a compound, so the file is not a level.dat.');
  }
  return root as NbtCompound;
}

function compoundAt(value: NbtValue | undefined): NbtCompound | null {
  if (typeof value !== 'object' || value === null) return null;
  if (Array.isArray(value) || ArrayBuffer.isView(value)) return null;
  return value as NbtCompound;
}

export interface LevelSummary {
  /** `Data.LevelName`, or null when the save does not carry one. */
  levelName: string | null;
  /** `Data.Version.Name`, e.g. `1.20.4`. Null on a save that predates it. */
  versionName: string | null;
  /** `Data.DataVersion` — present on every save since 1.9, useful when Name is not. */
  dataVersion: number | null;
}

/** Pulls the few fields this feature uses out of a parsed `level.dat`. */
export function summarizeLevel(root: NbtCompound): LevelSummary {
  const data = compoundAt(root['Data']) ?? root;
  const version = compoundAt(data['Version']);
  const rawName = version ? version['Name'] : undefined;
  const rawDataVersion = data['DataVersion'];
  return {
    levelName: typeof data['LevelName'] === 'string' ? data['LevelName'] : null,
    versionName: typeof rawName === 'string' && rawName.trim() !== '' ? rawName.trim() : null,
    dataVersion: typeof rawDataVersion === 'number' ? rawDataVersion : null
  };
}

/** Reads a `level.dat` end to end, from the base64 the privileged bridge returns. */
export async function readLevelSummary(base64: string): Promise<LevelSummary> {
  const bytes = base64ToBytes(base64);
  if (bytes.byteLength === 0) throw new Error('The level.dat file is empty.');
  const inflated = await inflateLevelDat(bytes);
  return summarizeLevel(parseNbt(inflated));
}
