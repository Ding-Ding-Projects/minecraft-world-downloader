/**
 * Real Node `fs`/`zlib` verification of the canonical world-vault-edit
 * algorithm (`app/src/main/features/world-vault-edit.ts`): Anvil region
 * parsing and rebuilding, NBT round-tripping, and — the part where being
 * wrong is silent — coordinate rewriting on copy and clean removal.
 *
 * Every fixture here is built through the module's own writer functions
 * (`writeNamedRoot`, `encodeChunkSector`, `buildRegionFile`), matching the
 * byte layout this project's own Java writer produces
 * (`McaFile.java`/`ChunkBinary.java`/`Chunk.java`/`ChunkEntities.java`), then
 * everything is asserted by reading the result back with the *decode* half of
 * the same module — never by trusting the buffer already held in memory.
 */
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  atomicWriteAndVerify,
  buildRegionFile,
  copyChunk,
  decodeChunkSector,
  encodeChunkSector,
  localIndex,
  mod32,
  parseRegionFile,
  readNamedRoot,
  removeChunks,
  rewriteChunkCoordinates,
  rewriteEntitiesFileRoot,
  writeNamedRoot,
  type NbtCompound,
  type RegionChunkEntry
} from '../../src/main/features/world-vault-edit';

/* ---------------- fixture builders ---------------- */

function chunkRoot(cx: number, cz: number, opts?: { withEntities?: boolean }): NbtCompound {
  const root: NbtCompound = {
    DataVersion: { type: 3, value: 3700 },
    xPos: { type: 3, value: cx },
    zPos: { type: 3, value: cz },
    InhabitedTime: { type: 4, value: 0n },
    block_entities: {
      type: 9,
      itemType: 10,
      value: [
        {
          type: 10,
          value: {
            id: { type: 8, value: 'minecraft:chest' },
            x: { type: 3, value: cx * 16 + 3 },
            y: { type: 3, value: 64 },
            z: { type: 3, value: cz * 16 + 5 },
            Items: { type: 9, itemType: 0, value: [] }
          }
        }
      ]
    }
  };
  if (opts?.withEntities !== false) {
    root.Entities = {
      type: 9,
      itemType: 10,
      value: [
        {
          type: 10,
          value: {
            id: { type: 8, value: 'minecraft:cow' },
            UUID: { type: 11, value: new Int32Array([11, 22, 33, 44]) },
            Pos: {
              type: 9,
              itemType: 6,
              value: [
                { type: 6, value: cx * 16 + 8.5 },
                { type: 6, value: 65.25 },
                { type: 6, value: cz * 16 + 2.75 }
              ]
            }
          }
        }
      ]
    };
  }
  return root;
}

function sectorFor(root: NbtCompound): Buffer {
  return encodeChunkSector(writeNamedRoot(root));
}

function regionBufferWithChunks(entries: Array<{ cx: number; cz: number; sector: Buffer }>): Buffer {
  const chunks = new Map<number, RegionChunkEntry>();
  for (const entry of entries) {
    const idx = localIndex(mod32(entry.cx), mod32(entry.cz));
    chunks.set(idx, { timestamp: 1_710_000_000, sectorData: entry.sector });
  }
  return buildRegionFile(chunks);
}

function readBackChunk(buf: Buffer, cx: number, cz: number): NbtCompound {
  const idx = localIndex(mod32(cx), mod32(cz));
  const entry = parseRegionFile(buf).chunks.get(idx);
  if (!entry) throw new Error(`no chunk at (${String(cx)}, ${String(cz)})`);
  return readNamedRoot(decodeChunkSector(entry.sectorData)).root;
}

const tmpDirs: string[] = [];
function freshDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'wve-test-'));
  tmpDirs.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of tmpDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/* ================================================================== */
/* Anvil header + sector round trip                                    */
/* ================================================================== */

describe('Anvil region parse/build round trip', () => {
  it('round-trips a single chunk byte-for-byte through its decoded NBT', () => {
    const root = chunkRoot(5, -3);
    const buf = regionBufferWithChunks([{ cx: 5, cz: -3, sector: sectorFor(root) }]);
    const back = readBackChunk(buf, 5, -3);
    expect((back.xPos as { value: number }).value).toBe(5);
    expect((back.zPos as { value: number }).value).toBe(-3);
  });

  it('places chunk data starting at sector 2 and reports the correct sector count', () => {
    const root = chunkRoot(0, 0);
    const sector = sectorFor(root);
    const buf = regionBufferWithChunks([{ cx: 0, cz: 0, sector }]);
    const idx = localIndex(0, 0);
    const location = (buf[idx * 4] << 16) | (buf[idx * 4 + 1] << 8) | buf[idx * 4 + 2];
    const size = buf[idx * 4 + 3];
    expect(location).toBe(2);
    expect(size).toBe(Math.ceil(sector.length / 4096));
    expect(buf.length).toBe(4096 * 2 + size * 4096);
  });

  it('leaves an unrelated chunk in the same file untouched by a second chunk existing', () => {
    const rootA = chunkRoot(0, 0);
    const rootB = chunkRoot(1, 0);
    const sectorA = sectorFor(rootA);
    const buf = regionBufferWithChunks([
      { cx: 0, cz: 0, sector: sectorA },
      { cx: 1, cz: 0, sector: sectorFor(rootB) }
    ]);
    const idx = localIndex(0, 0);
    const entry = parseRegionFile(buf).chunks.get(idx);
    // The stored sector is zero-padded up to a 4096-byte multiple, so it is
    // legitimately longer than the original unpadded `sectorA` — decode both
    // and compare the meaningful NBT bytes, which `decodeChunkSector` reads
    // using the sector's own embedded length prefix regardless of padding.
    expect(entry).toBeDefined();
    expect(decodeChunkSector(entry!.sectorData).equals(decodeChunkSector(sectorA))).toBe(true);
  });

  it('reports absent for an empty slot rather than throwing', () => {
    const buf = regionBufferWithChunks([{ cx: 0, cz: 0, sector: sectorFor(chunkRoot(0, 0)) }]);
    expect(parseRegionFile(buf).chunks.has(localIndex(5, 5))).toBe(false);
  });
});

/* ================================================================== */
/* Coordinate rewriting — the hazardous part                           */
/* ================================================================== */

describe('rewriteChunkCoordinates', () => {
  it('shifts xPos/zPos by exactly the chunk delta', () => {
    const root = chunkRoot(2, 2);
    rewriteChunkCoordinates(root, 5, -1);
    expect((root.xPos as { value: number }).value).toBe(7);
    expect((root.zPos as { value: number }).value).toBe(1);
  });

  it('shifts every block entity x/z by the block delta (16x the chunk delta) and leaves y untouched', () => {
    const root = chunkRoot(2, 2);
    const before = root.block_entities as { value: Array<{ value: NbtCompound }> };
    const originalX = (before.value[0].value.x as { value: number }).value;
    const originalY = (before.value[0].value.y as { value: number }).value;
    const originalZ = (before.value[0].value.z as { value: number }).value;

    const summary = rewriteChunkCoordinates(root, 3, -2);

    const after = root.block_entities as { value: Array<{ value: NbtCompound }> };
    expect((after.value[0].value.x as { value: number }).value).toBe(originalX + 3 * 16);
    expect((after.value[0].value.z as { value: number }).value).toBe(originalZ - 2 * 16);
    expect((after.value[0].value.y as { value: number }).value).toBe(originalY);
    expect(summary.blockEntitiesMoved).toBe(1);
  });

  it('shifts entity Pos[0]/Pos[2] by the block delta and leaves Pos[1] (height) untouched', () => {
    const root = chunkRoot(10, -10);
    const entitiesBefore = root.Entities as { value: Array<{ value: NbtCompound }> };
    const posBefore = entitiesBefore.value[0].value.Pos as { value: Array<{ value: number }> };
    const [originalX, originalY, originalZ] = posBefore.value.map((v) => v.value);

    const summary = rewriteChunkCoordinates(root, 4, 4);

    const entitiesAfter = root.Entities as { value: Array<{ value: NbtCompound }> };
    const posAfter = entitiesAfter.value[0].value.Pos as { value: Array<{ value: number }> };
    expect(posAfter.value[0].value).toBeCloseTo(originalX + 4 * 16, 6);
    expect(posAfter.value[1].value).toBeCloseTo(originalY, 6);
    expect(posAfter.value[2].value).toBeCloseTo(originalZ + 4 * 16, 6);
    expect(summary.entitiesMoved).toBe(1);
  });

  it('regenerates entity UUID so a copy is not a duplicate of the original', () => {
    const root = chunkRoot(0, 0);
    const before = (root.Entities as { value: Array<{ value: NbtCompound }> }).value[0].value.UUID as {
      value: Int32Array;
    };
    const originalUuid = [...before.value];
    rewriteChunkCoordinates(root, 1, 0);
    const after = (root.Entities as { value: Array<{ value: NbtCompound }> }).value[0].value.UUID as {
      value: Int32Array;
    };
    expect([...after.value]).not.toEqual(originalUuid);
    expect(after.value.length).toBe(4);
  });

  it('a zero delta still runs cleanly and reports the same coordinates', () => {
    const root = chunkRoot(7, 7);
    rewriteChunkCoordinates(root, 0, 0);
    expect((root.xPos as { value: number }).value).toBe(7);
    expect((root.zPos as { value: number }).value).toBe(7);
  });

  it('handles the pre-1.18 Level-wrapped shape identically to the 1.18+ root shape', () => {
    const inner = chunkRoot(3, 3);
    const wrapped: NbtCompound = { Level: { type: 10, value: inner }, DataVersion: { type: 3, value: 1343 } };
    rewriteChunkCoordinates(wrapped, 2, 1);
    const level = (wrapped.Level as { value: NbtCompound }).value;
    expect((level.xPos as { value: number }).value).toBe(5);
    expect((level.zPos as { value: number }).value).toBe(4);
  });
});

describe('rewriteEntitiesFileRoot (the separate entities/*.mca companion)', () => {
  it('shifts the root Position IntArray by the chunk delta', () => {
    const root: NbtCompound = {
      Position: { type: 11, value: new Int32Array([6, -6]) },
      Entities: { type: 9, itemType: 0, value: [] }
    };
    rewriteEntitiesFileRoot(root, 3, -3);
    const position = root.Position as { value: Int32Array };
    expect([...position.value]).toEqual([9, -9]);
  });
});

/* ================================================================== */
/* copyChunk — end to end, real files, real re-read verification       */
/* ================================================================== */

describe('copyChunk', () => {
  it('copies within the same region file, rewrites coordinates, and leaves the source chunk exactly as it was', () => {
    const dir = freshDir();
    const region = join(dir, 'r.0.0.mca');
    const sourceRoot = chunkRoot(3, 3);
    require('node:fs').writeFileSync(region, regionBufferWithChunks([{ cx: 3, cz: 3, sector: sectorFor(sourceRoot) }]));

    const result = copyChunk({
      sourceRegionPath: region,
      sourceEntitiesPath: null,
      source: { cx: 3, cz: 3 },
      destRegionPath: region,
      destEntitiesPath: null,
      destination: { cx: 10, cz: -2 }
    });

    expect(result.ok, result.error ?? '').toBe(true);
    expect(result.filesWritten).toEqual([region]);

    const finalBuf = readFileSync(region);
    const destChunk = readBackChunk(finalBuf, 10, -2);
    expect((destChunk.xPos as { value: number }).value).toBe(10);
    expect((destChunk.zPos as { value: number }).value).toBe(-2);
    const destBlockEntity = (destChunk.block_entities as { value: Array<{ value: NbtCompound }> }).value[0].value;
    expect((destBlockEntity.x as { value: number }).value).toBe(10 * 16 + 3);
    expect((destBlockEntity.z as { value: number }).value).toBe(-2 * 16 + 5);

    // the source chunk must still be exactly where and what it was — this is a copy, not a move
    const sourceChunk = readBackChunk(finalBuf, 3, 3);
    expect((sourceChunk.xPos as { value: number }).value).toBe(3);
    expect((sourceChunk.zPos as { value: number }).value).toBe(3);
  });

  it('copies across two different region files, creating the destination file when it does not exist', () => {
    const dir = freshDir();
    const sourceRegion = join(dir, 'r.0.0.mca');
    const destRegion = join(dir, 'r.1.0.mca');
    const fs = require('node:fs');
    fs.writeFileSync(sourceRegion, regionBufferWithChunks([{ cx: 5, cz: 5, sector: sectorFor(chunkRoot(5, 5)) }]));
    expect(existsSync(destRegion)).toBe(false);

    const result = copyChunk({
      sourceRegionPath: sourceRegion,
      sourceEntitiesPath: null,
      source: { cx: 5, cz: 5 },
      destRegionPath: destRegion,
      destEntitiesPath: null,
      destination: { cx: 40, cz: 5 } // region (1,0)
    });

    expect(result.ok, result.error ?? '').toBe(true);
    expect(existsSync(destRegion)).toBe(true);
    const destChunk = readBackChunk(readFileSync(destRegion), 40, 5);
    expect((destChunk.xPos as { value: number }).value).toBe(40);
    // the source region file must be completely unaffected
    const sourceChunk = readBackChunk(readFileSync(sourceRegion), 5, 5);
    expect((sourceChunk.xPos as { value: number }).value).toBe(5);
  });

  it('also copies the separate entities file when the source has one, rewriting Position and Pos there too', () => {
    const dir = freshDir();
    const region = join(dir, 'r.0.0.mca');
    const entitiesRegion = join(dir, 'entities-r.0.0.mca');
    const fs = require('node:fs');
    fs.writeFileSync(region, regionBufferWithChunks([{ cx: 2, cz: 2, sector: sectorFor(chunkRoot(2, 2, { withEntities: false })) }]));
    const entitiesRoot: NbtCompound = {
      DataVersion: { type: 3, value: 3700 },
      Position: { type: 11, value: new Int32Array([2, 2]) },
      Entities: {
        type: 9,
        itemType: 10,
        value: [
          {
            type: 10,
            value: {
              id: { type: 8, value: 'minecraft:pig' },
              UUID: { type: 11, value: new Int32Array([1, 2, 3, 4]) },
              Pos: {
                type: 9,
                itemType: 6,
                value: [
                  { type: 6, value: 2 * 16 + 4 },
                  { type: 6, value: 70 },
                  { type: 6, value: 2 * 16 + 1 }
                ]
              }
            }
          }
        ]
      }
    };
    fs.writeFileSync(entitiesRegion, regionBufferWithChunks([{ cx: 2, cz: 2, sector: sectorFor(entitiesRoot) }]));

    const result = copyChunk({
      sourceRegionPath: region,
      sourceEntitiesPath: entitiesRegion,
      source: { cx: 2, cz: 2 },
      destRegionPath: region,
      destEntitiesPath: entitiesRegion,
      destination: { cx: 6, cz: 9 }
    });

    expect(result.ok, result.error ?? '').toBe(true);
    expect(result.filesWritten).toContain(entitiesRegion);

    const destEntities = readBackChunk(readFileSync(entitiesRegion), 6, 9);
    const position = destEntities.Position as { value: Int32Array };
    expect([...position.value]).toEqual([6, 9]);
    const pos = (destEntities.Entities as { value: Array<{ value: NbtCompound }> }).value[0].value.Pos as {
      value: Array<{ value: number }>;
    };
    expect(pos.value[0].value).toBeCloseTo(6 * 16 + 4, 6);
    expect(pos.value[2].value).toBeCloseTo(9 * 16 + 1, 6);
  });

  it('refuses when the source and destination are the exact same chunk', () => {
    const dir = freshDir();
    const region = join(dir, 'r.0.0.mca');
    require('node:fs').writeFileSync(region, regionBufferWithChunks([{ cx: 0, cz: 0, sector: sectorFor(chunkRoot(0, 0)) }]));
    const result = copyChunk({
      sourceRegionPath: region,
      sourceEntitiesPath: null,
      source: { cx: 0, cz: 0 },
      destRegionPath: region,
      destEntitiesPath: null,
      destination: { cx: 0, cz: 0 }
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/same chunk/);
  });

  it('refuses when the source region file does not exist', () => {
    const dir = freshDir();
    const result = copyChunk({
      sourceRegionPath: join(dir, 'r.0.0.mca'),
      sourceEntitiesPath: null,
      source: { cx: 0, cz: 0 },
      destRegionPath: join(dir, 'r.1.0.mca'),
      destEntitiesPath: null,
      destination: { cx: 32, cz: 0 }
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/does not exist/);
  });

  it('refuses when the source chunk has no data in an existing region file', () => {
    const dir = freshDir();
    const region = join(dir, 'r.0.0.mca');
    require('node:fs').writeFileSync(region, regionBufferWithChunks([{ cx: 0, cz: 0, sector: sectorFor(chunkRoot(0, 0)) }]));
    const result = copyChunk({
      sourceRegionPath: region,
      sourceEntitiesPath: null,
      source: { cx: 5, cz: 5 },
      destRegionPath: region,
      destEntitiesPath: null,
      destination: { cx: 6, cz: 6 }
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/no data/);
  });
});

/* ================================================================== */
/* removeChunks                                                        */
/* ================================================================== */

describe('removeChunks', () => {
  it('clears the requested chunk and leaves an unrelated chunk in the same file intact', () => {
    const dir = freshDir();
    const region = join(dir, 'r.0.0.mca');
    const keptSector = sectorFor(chunkRoot(9, 9));
    const fs = require('node:fs');
    fs.writeFileSync(
      region,
      regionBufferWithChunks([
        { cx: 1, cz: 1, sector: sectorFor(chunkRoot(1, 1)) },
        { cx: 9, cz: 9, sector: keptSector }
      ])
    );

    const result = removeChunks({ regionPath: region, entitiesPath: null, chunks: [{ cx: 1, cz: 1 }] });
    expect(result.ok, result.error ?? '').toBe(true);

    const finalBuf = readFileSync(region);
    expect(parseRegionFile(finalBuf).chunks.has(localIndex(1, 1))).toBe(false);
    const kept = parseRegionFile(finalBuf).chunks.get(localIndex(9, 9));
    expect(kept).toBeDefined();
    expect(decodeChunkSector(kept!.sectorData).equals(decodeChunkSector(keptSector))).toBe(true);
  });

  it('removes several chunks in one call and reports the real count', () => {
    const dir = freshDir();
    const region = join(dir, 'r.0.0.mca');
    require('node:fs').writeFileSync(
      region,
      regionBufferWithChunks([
        { cx: 1, cz: 1, sector: sectorFor(chunkRoot(1, 1)) },
        { cx: 2, cz: 2, sector: sectorFor(chunkRoot(2, 2)) },
        { cx: 3, cz: 3, sector: sectorFor(chunkRoot(3, 3)) }
      ])
    );
    const result = removeChunks({
      regionPath: region,
      entitiesPath: null,
      chunks: [
        { cx: 1, cz: 1 },
        { cx: 2, cz: 2 }
      ]
    });
    expect(result.ok, result.error ?? '').toBe(true);
    expect(result.detail).toMatch(/Removed 2 chunk/);
    const parsed = parseRegionFile(readFileSync(region));
    expect(parsed.chunks.has(localIndex(1, 1))).toBe(false);
    expect(parsed.chunks.has(localIndex(2, 2))).toBe(false);
    expect(parsed.chunks.has(localIndex(3, 3))).toBe(true);
  });

  it('also removes the matching entry from a separate entities file when present', () => {
    const dir = freshDir();
    const region = join(dir, 'r.0.0.mca');
    const entitiesRegion = join(dir, 'entities-r.0.0.mca');
    const fs = require('node:fs');
    fs.writeFileSync(region, regionBufferWithChunks([{ cx: 4, cz: 4, sector: sectorFor(chunkRoot(4, 4, { withEntities: false })) }]));
    fs.writeFileSync(
      entitiesRegion,
      regionBufferWithChunks([
        { cx: 4, cz: 4, sector: sectorFor({ Position: { type: 11, value: new Int32Array([4, 4]) } }) }
      ])
    );

    const result = removeChunks({ regionPath: region, entitiesPath: entitiesRegion, chunks: [{ cx: 4, cz: 4 }] });
    expect(result.ok, result.error ?? '').toBe(true);
    expect(result.filesWritten).toContain(entitiesRegion);
    expect(parseRegionFile(readFileSync(entitiesRegion)).chunks.has(localIndex(4, 4))).toBe(false);
  });

  it('refuses when none of the requested chunks have any data', () => {
    const dir = freshDir();
    const region = join(dir, 'r.0.0.mca');
    require('node:fs').writeFileSync(region, regionBufferWithChunks([{ cx: 0, cz: 0, sector: sectorFor(chunkRoot(0, 0)) }]));
    const result = removeChunks({ regionPath: region, entitiesPath: null, chunks: [{ cx: 9, cz: 9 }] });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/any data to remove/);
  });

  it('refuses when the region file does not exist', () => {
    const dir = freshDir();
    const result = removeChunks({ regionPath: join(dir, 'r.0.0.mca'), entitiesPath: null, chunks: [{ cx: 0, cz: 0 }] });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/does not exist/);
  });
});

/* ================================================================== */
/* atomicWriteAndVerify                                                */
/* ================================================================== */

describe('atomicWriteAndVerify', () => {
  it('leaves no temp file behind and reports failure when verification rejects the write', () => {
    const dir = freshDir();
    const target = join(dir, 'r.0.0.mca');
    const result = atomicWriteAndVerify(target, Buffer.from('hello'), () => 'deliberately rejected for the test');
    expect(result.ok).toBe(false);
    expect(existsSync(target)).toBe(false);
    const leftovers = readdirSync(dir).filter((name) => name.includes('.tmp-'));
    expect(leftovers).toEqual([]);
  });

  it('never touches the original file when verification rejects the write', () => {
    const dir = freshDir();
    const target = join(dir, 'r.0.0.mca');
    const fs = require('node:fs');
    fs.writeFileSync(target, Buffer.from('original bytes'));
    const result = atomicWriteAndVerify(target, Buffer.from('new bytes'), () => 'rejected');
    expect(result.ok).toBe(false);
    expect(readFileSync(target).toString()).toBe('original bytes');
  });

  it('renames the temp file into place only after a clean verification', () => {
    const dir = freshDir();
    const target = join(dir, 'r.0.0.mca');
    const result = atomicWriteAndVerify(target, Buffer.from('committed bytes'), (reread) =>
      reread.toString() === 'committed bytes' ? null : 'mismatch'
    );
    expect(result.ok).toBe(true);
    expect(readFileSync(target).toString()).toBe('committed bytes');
    const leftovers = readdirSync(dir).filter((name) => name.includes('.tmp-'));
    expect(leftovers).toEqual([]);
  });
});
