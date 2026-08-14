/**
 * Pure Anvil region-header parsing and diffing.
 *
 * This is the "real diff rather than estimated" the comparison surface needs:
 * every Minecraft region file (`r.<x>.<z>.mca`) opens with an 8192-byte header
 * — a 4096-byte chunk-location table followed by a 4096-byte chunk-timestamp
 * table, one 4-byte big-endian entry per chunk, 1024 entries per table, at
 * byte offset `4 * ((localX & 31) + (localZ & 31) * 32)`. That is not a guess:
 * it is read directly off this project's own writer,
 * `src/main/java/game/data/region/McaFile.java` (`SECTOR_SIZE`, `setLocation`,
 * `setTimestamp`) and `Region.java`'s `pos` formula, so this parser reads
 * exactly the bytes the project's own downloader put there.
 *
 * A location entry of all zero bytes means "no chunk in this slot" — the
 * format's own way of saying absent, not an estimate this code invents. Two
 * present slots with different timestamps mean the chunk was rewritten: the
 * timestamp is the second the chunk was last saved, so a different value is
 * the file itself recording a change, not this code inferring one.
 *
 * Nothing here touches a file system, the DOM or Electron. It operates on a
 * `Uint8Array` (which a Node `Buffer` already is), so the exact same function
 * runs unmodified from the renderer (fed by a base64 read through the
 * privileged bridge) and from the main process (fed by a direct positional
 * file read) — see `regionReader.ts` and `../../main/features/world-vault-renders.ts`.
 */

/** Bytes occupied by the two header tables together. */
export const REGION_HEADER_BYTES = 8192;

/** Chunks per region file, in each axis and in total. */
export const REGION_CHUNK_SPAN = 32;
export const REGION_CHUNK_COUNT = REGION_CHUNK_SPAN * REGION_CHUNK_SPAN;

export interface ChunkSlot {
  /** Chunk-local X within the region, 0..31. */
  localX: number;
  /** Chunk-local Z within the region, 0..31. */
  localZ: number;
  /** False when the location entry is all-zero: the format's own "absent". */
  present: boolean;
  /** Sector offset from the start of the file. 0 when absent. */
  sectorOffset: number;
  /** Sector count the chunk occupies. 0 when absent. */
  sectorCount: number;
  /** Unix seconds the chunk was last saved. 0 when absent. */
  timestamp: number;
}

export interface RegionHeader {
  /** Always 1024: one slot per possible chunk position in the region. */
  slots: ChunkSlot[];
  /** How many slots are present (i.e. the region actually holds a chunk there). */
  presentCount: number;
}

/**
 * Parses the two header tables out of a region file's leading bytes.
 *
 * `bytes` may be the whole file or just its first `REGION_HEADER_BYTES` — only
 * the header is read. Throws if fewer than `REGION_HEADER_BYTES` are given,
 * because a truncated header cannot be told apart from a corrupt one and
 * guessing at missing bytes would silently invent chunk state.
 */
export function parseRegionHeader(bytes: Uint8Array): RegionHeader {
  if (bytes.length < REGION_HEADER_BYTES) {
    throw new Error(
      `A region header is ${REGION_HEADER_BYTES} bytes; only ${bytes.length} were given. The file may be truncated or corrupt.`
    );
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const slots: ChunkSlot[] = [];
  let presentCount = 0;

  for (let index = 0; index < REGION_CHUNK_COUNT; index += 1) {
    const localX = index % REGION_CHUNK_SPAN;
    const localZ = Math.floor(index / REGION_CHUNK_SPAN);
    const byteOffset = index * 4;

    // Location entry: 3-byte big-endian sector offset, 1-byte sector count.
    const b0 = bytes[byteOffset] ?? 0;
    const b1 = bytes[byteOffset + 1] ?? 0;
    const b2 = bytes[byteOffset + 2] ?? 0;
    const sectorCount = bytes[byteOffset + 3] ?? 0;
    const sectorOffset = (b0 << 16) | (b1 << 8) | b2;

    const present = sectorCount !== 0 || sectorOffset !== 0;
    const timestamp = present ? view.getUint32(REGION_HEADER_BYTES / 2 + byteOffset, false) : 0;

    if (present) presentCount += 1;
    slots.push({ localX, localZ, present, sectorOffset, sectorCount, timestamp });
  }

  return { slots, presentCount };
}

export type ChunkChangeKind = 'added' | 'removed' | 'changed';

export interface ChunkChange {
  localX: number;
  localZ: number;
  kind: ChunkChangeKind;
  /** Present on both sides for `changed`; the timestamps that differed. */
  timestampBefore: number | null;
  timestampAfter: number | null;
}

export interface RegionDiffSummary {
  addedChunks: number;
  removedChunks: number;
  changedChunks: number;
  unchangedChunks: number;
  /** Every non-unchanged slot, for a caller that wants the exact coordinates. */
  changes: ChunkChange[];
}

/**
 * Diffs two headers of the same region slot-by-slot.
 *
 * A slot absent on both sides is unchanged — there was never a chunk there
 * either time, which is a real fact about the file, not a lack of data.
 */
export function diffRegionHeaders(before: RegionHeader, after: RegionHeader): RegionDiffSummary {
  const changes: ChunkChange[] = [];
  let added = 0;
  let removed = 0;
  let changed = 0;
  let unchanged = 0;

  for (let index = 0; index < REGION_CHUNK_COUNT; index += 1) {
    const a = before.slots[index];
    const b = after.slots[index];
    if (!a || !b) continue;

    if (!a.present && !b.present) {
      unchanged += 1;
      continue;
    }
    if (a.present && !b.present) {
      removed += 1;
      changes.push({ localX: a.localX, localZ: a.localZ, kind: 'removed', timestampBefore: a.timestamp, timestampAfter: null });
      continue;
    }
    if (!a.present && b.present) {
      added += 1;
      changes.push({ localX: b.localX, localZ: b.localZ, kind: 'added', timestampBefore: null, timestampAfter: b.timestamp });
      continue;
    }
    // Both present.
    if (a.timestamp !== b.timestamp) {
      changed += 1;
      changes.push({
        localX: a.localX,
        localZ: a.localZ,
        kind: 'changed',
        timestampBefore: a.timestamp,
        timestampAfter: b.timestamp
      });
    } else {
      unchanged += 1;
    }
  }

  return { addedChunks: added, removedChunks: removed, changedChunks: changed, unchangedChunks: unchanged, changes };
}

/** Parses `r.<x>.<z>.mca` (or `.mcr`), including negative region coordinates. */
export function regionFileCoords(fileName: string): { x: number; z: number } | null {
  const match = /^r\.(-?\d+)\.(-?\d+)\.mc[ar]$/i.exec(fileName.trim());
  if (!match || !match[1] || !match[2]) return null;
  const x = Number.parseInt(match[1], 10);
  const z = Number.parseInt(match[2], 10);
  if (!Number.isInteger(x) || !Number.isInteger(z)) return null;
  return { x, z };
}

/** The absolute chunk coordinate a region-local slot corresponds to. */
export function absoluteChunkCoord(
  region: { x: number; z: number },
  local: { localX: number; localZ: number }
): { x: number; z: number } {
  return { x: region.x * REGION_CHUNK_SPAN + local.localX, z: region.z * REGION_CHUNK_SPAN + local.localZ };
}

/** The three dimension subfolders a downloaded world can hold region files under. */
export const DIMENSION_REGION_PATHS: Array<{ dimension: string; segments: string[] }> = [
  { dimension: 'overworld', segments: ['region'] },
  { dimension: 'nether', segments: ['DIM-1', 'region'] },
  { dimension: 'end', segments: ['DIM1', 'region'] }
];
