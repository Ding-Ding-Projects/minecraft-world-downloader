'use strict';
/*
 * Anvil (.mca) region-file header reader.
 *
 * This is a byte-for-byte port of the READ side of
 * `src/main/java/game/data/region/McaFile.java` — the project's own writer for
 * the exact files this harness has to verify. It is deliberately not a fresh
 * reading of the public Anvil spec: the Java class is the authority on what
 * this downloader actually put on disk, so the header math here (the 4 KiB
 * location table, the 3-byte sector offset + 1-byte sector count per slot, the
 * "one bare placeholder sector counts as empty" guard, and the slot-index to
 * local-chunk-coordinate mapping) is copied from `McaFile#readFile` and
 * `McaFile#intToCoordinate` line for line, not reimplemented from memory.
 *
 * A count derived from file size or a directory listing would be a guess. This
 * opens the real header and asks the file what it actually contains, which is
 * the same question the downloader's own reader asks when it re-loads a world.
 */

const SECTOR_SIZE = 4096;
const LOCATION_TABLE_BYTES = SECTOR_SIZE;

/**
 * Parses one region (or entities) file's header.
 *
 * @param {Buffer} buffer the full file contents
 * @param {number} regionX the region's X coordinate, from its filename
 * @param {number} regionZ the region's Z coordinate, from its filename
 * @returns {{ chunks: Array<{x:number,z:number,sizeBytes:number}>, truncated: boolean }}
 */
function parseRegionHeader(buffer, regionX, regionZ) {
  if (!Buffer.isBuffer(buffer) || buffer.length < LOCATION_TABLE_BYTES * 2) {
    // Smaller than the two fixed header sectors: not a real region file (a
    // freshly-created, never-written file is exactly this size: 0 bytes).
    return { chunks: [], truncated: buffer instanceof Buffer && buffer.length > 0 };
  }

  const locations = buffer.subarray(0, LOCATION_TABLE_BYTES);
  const chunkAreaLength = buffer.length - LOCATION_TABLE_BYTES * 2;
  const occupied = [];

  for (let i = 0; i + 4 <= LOCATION_TABLE_BYTES; i += 4) {
    const sizeSectors = locations[i + 3] & 0xff;
    if (sizeSectors === 0) continue;

    const sectorOffset = locations.readUIntBE(i, 3);
    // McaFile: "chunk location includes first location/timestamp sections so
    // we need to lower the addresses by 2 sectors".
    const dataStart = (sectorOffset - 2) * SECTOR_SIZE;
    const dataEnd = (sectorOffset + sizeSectors - 2) * SECTOR_SIZE;
    if (dataStart < 0 || dataStart >= chunkAreaLength) continue;
    if (dataEnd < 0 || dataEnd > chunkAreaLength || dataEnd < dataStart) continue;

    // McaFile#intToCoordinate: offset = i/4; localX = offset & 0x1F; localZ = offset >>> 5.
    const offset = i / 4;
    const localX = offset & 0x1f;
    const localZ = offset >>> 5;
    occupied.push({
      x: regionX * 32 + localX,
      z: regionZ * 32 + localZ,
      sizeBytes: dataEnd - dataStart
    });
  }

  // McaFile#readFile: "if a region only has a single small chunk, we ignore it
  // since it's probably not actually generated" — a lone slot whose data is
  // exactly one bare sector is a placeholder, not a saved chunk.
  if (occupied.length === 1 && occupied[0].sizeBytes === SECTOR_SIZE) {
    return { chunks: [], truncated: false };
  }

  return { chunks: occupied, truncated: false };
}

const REGION_FILENAME = /^r\.(-?\d+)\.(-?\d+)\.mca$/;

/** Parses `r.<x>.<z>.mca` into its region coordinates, or null if it does not match. */
function parseRegionFileName(name) {
  const match = REGION_FILENAME.exec(name);
  if (!match) return null;
  return { x: Number(match[1]), z: Number(match[2]) };
}

/** The chunk (not region) coordinate a block position falls in. */
function chunkOf(blockX, blockZ) {
  return { x: Math.floor(blockX / 16), z: Math.floor(blockZ / 16) };
}

module.exports = { parseRegionHeader, parseRegionFileName, chunkOf, SECTOR_SIZE };
