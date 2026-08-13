/**
 * Tests for `app/src/main/features/world-vault-renders.ts` — the efficient,
 * positional-read region-header diff meant for the main process. It has no
 * Electron dependency (only `node:fs/promises` and `node:path`), so it runs
 * directly against real files written to a real temporary directory, proving
 * the positional read finds the same answer the renderer's whole-file read
 * does (see `world-vault-renders.test.ts` for that half), without needing an
 * Electron runtime to do it.
 */
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { REGION_HEADER_BYTES } from '../../src/renderer/features/world-vault-renders/anvil';
import { diffWorldDirectories, directoryExists, readRegionHeaderFromDisk } from '../../src/main/features/world-vault-renders';

function headerBuffer(entries: Array<{ index: number; sectorOffset: number; sectorCount: number; timestamp: number }>): Buffer {
  const buffer = Buffer.alloc(REGION_HEADER_BYTES);
  for (const entry of entries) {
    const byteOffset = entry.index * 4;
    buffer[byteOffset] = (entry.sectorOffset >>> 16) & 0xff;
    buffer[byteOffset + 1] = (entry.sectorOffset >>> 8) & 0xff;
    buffer[byteOffset + 2] = entry.sectorOffset & 0xff;
    buffer[byteOffset + 3] = entry.sectorCount & 0xff;
    buffer.writeUInt32BE(entry.timestamp >>> 0, REGION_HEADER_BYTES / 2 + byteOffset);
  }
  return buffer;
}

/** A whole, minimally-plausible .mca file: the header plus one padding sector of chunk data. */
function regionFileBytes(entries: Array<{ index: number; sectorOffset: number; sectorCount: number; timestamp: number }>): Buffer {
  return Buffer.concat([headerBuffer(entries), Buffer.alloc(4096, 1)]);
}

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'wvr-main-'));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('world-vault-renders.ts (main): readRegionHeaderFromDisk', () => {
  it('reads back exactly the header bytes written, via a real positional read', async () => {
    const path = join(root, 'r.0.0.mca');
    await writeFile(path, regionFileBytes([{ index: 42, sectorOffset: 2, sectorCount: 1, timestamp: 1_700_000_000 }]));
    const result = await readRegionHeaderFromDisk(path);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.presentCount).toBe(1);
    expect(result.value.slots[42]?.present).toBe(true);
    expect(result.value.slots[42]?.timestamp).toBe(1_700_000_000);
  });

  it('reports a truncated file honestly rather than reading past the end', async () => {
    const path = join(root, 'r.0.0.mca');
    await writeFile(path, Buffer.alloc(100));
    const result = await readRegionHeaderFromDisk(path);
    expect(result.ok).toBe(false);
  });

  it('reports a missing file honestly', async () => {
    const result = await readRegionHeaderFromDisk(join(root, 'does-not-exist.mca'));
    expect(result.ok).toBe(false);
  });
});

describe('world-vault-renders.ts (main): diffWorldDirectories', () => {
  async function writeWorld(base: string, region: Record<string, Array<{ index: number; sectorOffset: number; sectorCount: number; timestamp: number }>>): Promise<void> {
    const dir = join(base, 'region');
    await mkdir(dir, { recursive: true });
    for (const [name, entries] of Object.entries(region)) {
      await writeFile(join(dir, name), regionFileBytes(entries));
    }
  }

  it('reports no regions changed for two byte-identical exports', async () => {
    const before = join(root, 'before');
    const after = join(root, 'after');
    const entries = [{ index: 5, sectorOffset: 2, sectorCount: 1, timestamp: 100 }];
    await writeWorld(before, { 'r.0.0.mca': entries });
    await writeWorld(after, { 'r.0.0.mca': entries });

    const result = await diffWorldDirectories(before, after);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.regionsChanged).toBe(0);
    expect(result.value.regions).toHaveLength(0);
    expect(result.value.totalChunksChanged).toBe(0);
  });

  it('reports a changed chunk timestamp as a real, counted difference for the exact region file it is in', async () => {
    const before = join(root, 'before');
    const after = join(root, 'after');
    await writeWorld(before, { 'r.0.0.mca': [{ index: 5, sectorOffset: 2, sectorCount: 1, timestamp: 100 }] });
    await writeWorld(after, { 'r.0.0.mca': [{ index: 5, sectorOffset: 2, sectorCount: 1, timestamp: 200 }] });

    const result = await diffWorldDirectories(before, after);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.regionsChanged).toBe(1);
    expect(result.value.regions[0]).toMatchObject({ dimension: 'overworld', regionFile: 'r.0.0.mca', status: 'changed', changedChunks: 1 });
    expect(result.value.totalChunksChanged).toBe(1);
    expect(result.value.totalChunksAdded).toBe(0);
    expect(result.value.totalChunksRemoved).toBe(0);
  });

  it('reports a region file that only exists on one side as fully added or fully removed, never as "changed"', async () => {
    const before = join(root, 'before');
    const after = join(root, 'after');
    await writeWorld(before, {});
    await writeWorld(after, { 'r.1.1.mca': [{ index: 0, sectorOffset: 2, sectorCount: 1, timestamp: 1 }, { index: 1, sectorOffset: 3, sectorCount: 1, timestamp: 2 }] });

    const result = await diffWorldDirectories(before, after);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.regions).toHaveLength(1);
    expect(result.value.regions[0]?.status).toBe('added');
    expect(result.value.regions[0]?.addedChunks).toBe(2);
    expect(result.value.totalChunksAdded).toBe(2);
  });

  it('treats a dimension folder missing on both sides as a normal absence, not an error (no nether/end generated)', async () => {
    const before = join(root, 'before');
    const after = join(root, 'after');
    await writeWorld(before, { 'r.0.0.mca': [{ index: 0, sectorOffset: 2, sectorCount: 1, timestamp: 1 }] });
    await writeWorld(after, { 'r.0.0.mca': [{ index: 0, sectorOffset: 2, sectorCount: 1, timestamp: 1 }] });
    // Neither `before` nor `after` has a DIM-1 or DIM1 folder at all.
    const result = await diffWorldDirectories(before, after);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.regions).toHaveLength(0);
  });
});

describe('world-vault-renders.ts (main): directoryExists', () => {
  it('is true for a real directory and false for a file or a missing path', async () => {
    expect(await directoryExists(root)).toBe(true);
    const filePath = join(root, 'a-file.txt');
    await writeFile(filePath, 'hello');
    expect(await directoryExists(filePath)).toBe(false);
    expect(await directoryExists(join(root, 'nope'))).toBe(false);
  });
});
