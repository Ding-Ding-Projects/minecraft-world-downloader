/**
 * Spawns the ACTUAL deployed artifact: `REGION_EDIT_WORKER_SOURCE` written to
 * a real file and run as a real `node` child process, exactly the way
 * `workerClient.ts` runs it from the renderer via `studio.process.spawn`.
 *
 * Fixtures are built, and the result is verified, through the independently
 * authored TypeScript reference in `app/src/main/features/world-vault-edit.ts`
 * (already covered on its own in `world-vault-edit-main.test.ts`). Two
 * separately written implementations of the same read path agreeing on the
 * worker's output is materially stronger evidence than trusting the worker to
 * grade its own homework.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildRegionFile,
  decodeChunkSector,
  encodeChunkSector,
  localIndex,
  mod32,
  parseRegionFile,
  readNamedRoot,
  writeNamedRoot,
  type NbtCompound,
  type RegionChunkEntry
} from '../../src/main/features/world-vault-edit';
import { REGION_EDIT_WORKER_SOURCE } from '../../src/renderer/features/world-vault-edit/worker-source';

const tmpDirs: string[] = [];
function freshDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'wve-worker-test-'));
  tmpDirs.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of tmpDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function chunkRoot(cx: number, cz: number): NbtCompound {
  return {
    DataVersion: { type: 3, value: 3700 },
    xPos: { type: 3, value: cx },
    zPos: { type: 3, value: cz },
    block_entities: {
      type: 9,
      itemType: 10,
      value: [
        {
          type: 10,
          value: {
            id: { type: 8, value: 'minecraft:barrel' },
            x: { type: 3, value: cx * 16 + 1 },
            y: { type: 3, value: 70 },
            z: { type: 3, value: cz * 16 + 9 }
          }
        }
      ]
    },
    Entities: {
      type: 9,
      itemType: 10,
      value: [
        {
          type: 10,
          value: {
            id: { type: 8, value: 'minecraft:sheep' },
            UUID: { type: 11, value: new Int32Array([100, 200, 300, 400]) },
            Pos: {
              type: 9,
              itemType: 6,
              value: [
                { type: 6, value: cx * 16 + 0.5 },
                { type: 6, value: 71.0 },
                { type: 6, value: cz * 16 + 12.5 }
              ]
            }
          }
        }
      ]
    }
  };
}

function regionBufferWithChunk(cx: number, cz: number): Buffer {
  const chunks = new Map<number, RegionChunkEntry>([
    [localIndex(mod32(cx), mod32(cz)), { timestamp: 1_700_000_000, sectorData: encodeChunkSector(writeNamedRoot(chunkRoot(cx, cz))) }]
  ]);
  return buildRegionFile(chunks);
}

function writeWorkerScript(dir: string): string {
  const scriptPath = join(dir, 'region-worker.cjs');
  writeFileSync(scriptPath, REGION_EDIT_WORKER_SOURCE, 'utf8');
  return scriptPath;
}

function runWorker(dir: string, operation: unknown): { code: number | null; result: { ok: boolean; error: string | null; filesWritten: string[]; detail: string } } {
  const scriptPath = writeWorkerScript(dir);
  const operationPath = join(dir, 'operation.json');
  writeFileSync(operationPath, JSON.stringify(operation), 'utf8');
  const spawned = spawnSync(process.execPath, [scriptPath, operationPath], { encoding: 'utf8' });
  const lastLine = spawned.stdout.trim().split('\n').filter(Boolean).pop() ?? '{}';
  return { code: spawned.status, result: JSON.parse(lastLine) };
}

describe('the spawned worker script: copy', () => {
  it('copies a chunk and rewrites its coordinates, verified through the independent reference reader', () => {
    const dir = freshDir();
    const region = join(dir, 'r.0.0.mca');
    writeFileSync(region, regionBufferWithChunk(4, 4));

    const { code, result } = runWorker(dir, {
      kind: 'copy',
      copy: {
        sourceRegionPath: region,
        sourceEntitiesPath: null,
        source: { cx: 4, cz: 4 },
        destRegionPath: region,
        destEntitiesPath: null,
        destination: { cx: 20, cz: 4 }
      }
    });

    expect(code, JSON.stringify(result)).toBe(0);
    expect(result.ok).toBe(true);

    const finalBuf = readFileSync(region);
    const parsed = parseRegionFile(finalBuf);
    const destEntry = parsed.chunks.get(localIndex(mod32(20), mod32(4)));
    expect(destEntry).toBeDefined();
    const destRoot = readNamedRoot(decodeChunkSector(destEntry!.sectorData)).root;
    expect((destRoot.xPos as { value: number }).value).toBe(20);
    expect((destRoot.zPos as { value: number }).value).toBe(4);
    const blockEntity = (destRoot.block_entities as { value: Array<{ value: NbtCompound }> }).value[0].value;
    expect((blockEntity.x as { value: number }).value).toBe(20 * 16 + 1);
    expect((blockEntity.y as { value: number }).value).toBe(70);

    // source untouched by a copy
    const sourceEntry = parsed.chunks.get(localIndex(mod32(4), mod32(4)));
    const sourceRoot = readNamedRoot(decodeChunkSector(sourceEntry!.sectorData)).root;
    expect((sourceRoot.xPos as { value: number }).value).toBe(4);
  });

  it('refuses copying a chunk onto itself, and never touches the file', () => {
    const dir = freshDir();
    const region = join(dir, 'r.0.0.mca');
    const original = regionBufferWithChunk(1, 1);
    writeFileSync(region, original);

    const { code, result } = runWorker(dir, {
      kind: 'copy',
      copy: {
        sourceRegionPath: region,
        sourceEntitiesPath: null,
        source: { cx: 1, cz: 1 },
        destRegionPath: region,
        destEntitiesPath: null,
        destination: { cx: 1, cz: 1 }
      }
    });

    expect(code).toBe(1);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/same chunk/);
    expect(readFileSync(region).equals(original)).toBe(true);
  });

  it('refuses cleanly (nonzero exit, JSON error) when the source region file is missing', () => {
    const dir = freshDir();
    const { code, result } = runWorker(dir, {
      kind: 'copy',
      copy: {
        sourceRegionPath: join(dir, 'does-not-exist.mca'),
        sourceEntitiesPath: null,
        source: { cx: 0, cz: 0 },
        destRegionPath: join(dir, 'r.0.0.mca'),
        destEntitiesPath: null,
        destination: { cx: 1, cz: 0 }
      }
    });
    expect(code).toBe(1);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/does not exist/);
    expect(existsSync(join(dir, 'r.0.0.mca'))).toBe(false);
  });
});

describe('the spawned worker script: remove', () => {
  it('removes the requested chunk, verified absent through the independent reference reader', () => {
    const dir = freshDir();
    const region = join(dir, 'r.0.0.mca');
    const keptSector = encodeChunkSector(writeNamedRoot(chunkRoot(8, 8)));
    const chunks = new Map<number, RegionChunkEntry>([
      [localIndex(mod32(2), mod32(2)), { timestamp: 1_700_000_000, sectorData: encodeChunkSector(writeNamedRoot(chunkRoot(2, 2))) }],
      [localIndex(mod32(8), mod32(8)), { timestamp: 1_700_000_000, sectorData: keptSector }]
    ]);
    writeFileSync(region, buildRegionFile(chunks));

    const { code, result } = runWorker(dir, {
      kind: 'remove',
      remove: { regionPath: region, entitiesPath: null, chunks: [{ cx: 2, cz: 2 }] }
    });

    expect(code, JSON.stringify(result)).toBe(0);
    expect(result.ok).toBe(true);

    const parsed = parseRegionFile(readFileSync(region));
    expect(parsed.chunks.has(localIndex(mod32(2), mod32(2)))).toBe(false);
    const kept = parsed.chunks.get(localIndex(mod32(8), mod32(8)));
    expect(kept).toBeDefined();
    expect(decodeChunkSector(kept!.sectorData).equals(decodeChunkSector(keptSector))).toBe(true);
  });

  it('exits nonzero and leaves the file untouched when nothing matched', () => {
    const dir = freshDir();
    const region = join(dir, 'r.0.0.mca');
    const original = regionBufferWithChunk(0, 0);
    writeFileSync(region, original);

    const { code, result } = runWorker(dir, {
      kind: 'remove',
      remove: { regionPath: region, entitiesPath: null, chunks: [{ cx: 9, cz: 9 }] }
    });

    expect(code).toBe(1);
    expect(result.ok).toBe(false);
    expect(readFileSync(region).equals(original)).toBe(true);
  });
});
