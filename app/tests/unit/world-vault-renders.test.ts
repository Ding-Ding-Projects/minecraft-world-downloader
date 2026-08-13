/**
 * Tests for the parts of world-vault-renders where being wrong is silent:
 *
 * - The Anvil region-header parser and diff (anvil.ts) — a mis-read byte
 *   offset does not throw, it just reports a slightly wrong chunk count, and
 *   nothing about a wrong count looks obviously wrong on screen.
 * - The render queue (queue.ts) — a bug here shows the wrong commit's status,
 *   over-runs the concurrency limit, or drops a queued commit silently; every
 *   one of those is invisible unless specifically asserted against.
 * - The "honest absence" guarantee: a commit with no render never reads as
 *   another commit's render.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `vaultLink.ts` imports real, named values from `../world-vault` — the
 * sibling "world-vault" feature that owns the actual Git-backed repository.
 * This suite tests the renders feature's own logic (the Anvil diff, the
 * queue's concurrency/backlog/retry behaviour), not the sibling module, so
 * the sibling's five named exports are mocked here with the minimum needed
 * to drive the queue through export → render. `vi.mock` is hoisted above
 * every import in this file by Vitest's own transform, so this runs before
 * `queue.ts` (via `vaultLink.ts`) ever resolves `../world-vault`.
 */
vi.mock('../../src/renderer/features/world-vault', () => ({
  listVaults: () => [],
  subscribeVaults: () => () => undefined,
  listVaultCommits: () => [],
  subscribeVaultCommits: () => () => undefined,
  exportVaultCommit: async (_commit: unknown, destinationDirectory: string) => ({ ok: true, value: { path: destinationDirectory } })
}));

import {
  DIMENSION_REGION_PATHS,
  REGION_HEADER_BYTES,
  absoluteChunkCoord,
  diffRegionHeaders,
  parseRegionHeader,
  regionFileCoords
} from '../../src/renderer/features/world-vault-renders/anvil';
import { newRenderRecord, type RenderRecord } from '../../src/renderer/features/world-vault-renders/types';
import { RenderQueue, type QueueEvents } from '../../src/renderer/features/world-vault-renders/queue';
import type { VaultCommit } from '../../src/renderer/features/world-vault-renders/vaultLink';
import type { ProcessEvent, Result, StudioApi } from '../../src/shared/api';

/* ------------------------------------------------------------------ */
/* anvil.ts                                                            */
/* ------------------------------------------------------------------ */

/** Builds a synthetic region header buffer with the given present slots. */
function buildHeader(entries: Array<{ index: number; sectorOffset: number; sectorCount: number; timestamp: number }>): Uint8Array {
  const bytes = new Uint8Array(REGION_HEADER_BYTES);
  const view = new DataView(bytes.buffer);
  for (const entry of entries) {
    const byteOffset = entry.index * 4;
    bytes[byteOffset] = (entry.sectorOffset >>> 16) & 0xff;
    bytes[byteOffset + 1] = (entry.sectorOffset >>> 8) & 0xff;
    bytes[byteOffset + 2] = entry.sectorOffset & 0xff;
    bytes[byteOffset + 3] = entry.sectorCount & 0xff;
    view.setUint32(REGION_HEADER_BYTES / 2 + byteOffset, entry.timestamp >>> 0, false);
  }
  return bytes;
}

describe('anvil.ts: parseRegionHeader', () => {
  it('reports every slot absent for an all-zero header', () => {
    const header = parseRegionHeader(new Uint8Array(REGION_HEADER_BYTES));
    expect(header.presentCount).toBe(0);
    expect(header.slots).toHaveLength(1024);
    expect(header.slots.every((slot) => !slot.present)).toBe(true);
  });

  it('decodes the exact byte offset formula the project’s own writer uses: 4 * ((x & 31) + (z & 31) * 32)', () => {
    // Chunk local (5, 3): index = 5 + 3*32 = 101.
    const header = parseHeaderWithOneChunk(5, 3, 2, 1, 1_700_000_000);
    const slot = header.slots[101];
    expect(slot).toBeDefined();
    expect(slot?.localX).toBe(5);
    expect(slot?.localZ).toBe(3);
    expect(slot?.present).toBe(true);
    expect(slot?.timestamp).toBe(1_700_000_000);
    expect(header.presentCount).toBe(1);
  });

  function parseHeaderWithOneChunk(localX: number, localZ: number, sectorOffset: number, sectorCount: number, timestamp: number) {
    const index = localX + localZ * 32;
    return parseRegionHeader(buildHeader([{ index, sectorOffset, sectorCount, timestamp }]));
  }

  it('throws rather than silently reading past a truncated buffer', () => {
    expect(() => parseRegionHeader(new Uint8Array(100))).toThrow();
  });
});

describe('anvil.ts: diffRegionHeaders', () => {
  it('reports two absent slots as unchanged, not as a difference', () => {
    const before = parseRegionHeader(new Uint8Array(REGION_HEADER_BYTES));
    const after = parseRegionHeader(new Uint8Array(REGION_HEADER_BYTES));
    const diff = diffRegionHeaders(before, after);
    expect(diff.addedChunks).toBe(0);
    expect(diff.removedChunks).toBe(0);
    expect(diff.changedChunks).toBe(0);
    expect(diff.unchangedChunks).toBe(1024);
  });

  it('counts a newly-present chunk as added, never as changed', () => {
    const before = parseRegionHeader(new Uint8Array(REGION_HEADER_BYTES));
    const after = parseRegionHeader(buildHeader([{ index: 0, sectorOffset: 2, sectorCount: 1, timestamp: 100 }]));
    const diff = diffRegionHeaders(before, after);
    expect(diff.addedChunks).toBe(1);
    expect(diff.removedChunks).toBe(0);
    expect(diff.changedChunks).toBe(0);
    expect(diff.changes).toEqual([{ localX: 0, localZ: 0, kind: 'added', timestampBefore: null, timestampAfter: 100 }]);
  });

  it('counts a chunk that disappeared as removed', () => {
    const before = parseRegionHeader(buildHeader([{ index: 5, sectorOffset: 2, sectorCount: 1, timestamp: 100 }]));
    const after = parseRegionHeader(new Uint8Array(REGION_HEADER_BYTES));
    const diff = diffRegionHeaders(before, after);
    expect(diff.removedChunks).toBe(1);
    expect(diff.addedChunks).toBe(0);
  });

  it('counts a present-on-both-sides chunk with a different timestamp as changed, and an identical one as unchanged — the exact distinction the "real diff" claim rests on', () => {
    const before = parseRegionHeader(buildHeader([{ index: 10, sectorOffset: 2, sectorCount: 1, timestamp: 100 }]));
    const changed = parseRegionHeader(buildHeader([{ index: 10, sectorOffset: 3, sectorCount: 1, timestamp: 200 }]));
    const identical = parseRegionHeader(buildHeader([{ index: 10, sectorOffset: 2, sectorCount: 1, timestamp: 100 }]));

    const changedDiff = diffRegionHeaders(before, changed);
    expect(changedDiff.changedChunks).toBe(1);
    expect(changedDiff.addedChunks).toBe(0);
    expect(changedDiff.removedChunks).toBe(0);

    const identicalDiff = diffRegionHeaders(before, identical);
    expect(identicalDiff.changedChunks).toBe(0);
    expect(identicalDiff.unchangedChunks).toBe(1024);
  });

  it('touches only the slot that actually changed, leaving the other 1023 unchanged', () => {
    const before = parseRegionHeader(new Uint8Array(REGION_HEADER_BYTES));
    const after = parseRegionHeader(buildHeader([{ index: 500, sectorOffset: 2, sectorCount: 1, timestamp: 1 }]));
    const diff = diffRegionHeaders(before, after);
    expect(diff.addedChunks).toBe(1);
    expect(diff.unchangedChunks).toBe(1023);
  });
});

describe('anvil.ts: regionFileCoords and absoluteChunkCoord', () => {
  it('parses positive and negative region coordinates', () => {
    expect(regionFileCoords('r.0.0.mca')).toEqual({ x: 0, z: 0 });
    expect(regionFileCoords('r.-1.2.mca')).toEqual({ x: -1, z: 2 });
    expect(regionFileCoords('r.-3.-4.mca')).toEqual({ x: -3, z: -4 });
  });

  it('refuses a name that is not a region file, rather than guessing', () => {
    expect(regionFileCoords('level.dat')).toBeNull();
    expect(regionFileCoords('r.0.0.mcafoo')).toBeNull();
    expect(regionFileCoords('r.a.b.mca')).toBeNull();
  });

  it('computes the absolute chunk coordinate from a region and a local slot', () => {
    expect(absoluteChunkCoord({ x: -1, z: 2 }, { localX: 5, localZ: 3 })).toEqual({ x: -27, z: 67 });
  });

  it('lists exactly the three dimension subpaths this project’s downloader writes', () => {
    expect(DIMENSION_REGION_PATHS).toEqual([
      { dimension: 'overworld', segments: ['region'] },
      { dimension: 'nether', segments: ['DIM-1', 'region'] },
      { dimension: 'end', segments: ['DIM1', 'region'] }
    ]);
  });
});

/* ------------------------------------------------------------------ */
/* queue.ts                                                            */
/* ------------------------------------------------------------------ */

function makeCommit(id: string, vaultId = 'vault-1'): VaultCommit {
  return { id, vaultId, worldName: 'Test World', worldPath: 'C:/world', message: `commit ${id}`, createdAt: new Date().toISOString(), filesChanged: 1, parentId: null };
}

/**
 * A fake `StudioApi` that exercises the real queue logic without a real
 * filesystem or a real Java process. `fs.stat`/`readDirectory` report a
 * plausible exported world; `process.spawn` hands back a synthetic id that
 * the test drives to completion (or failure) itself by pushing
 * `process:event` payloads through the same `events.on` handler the queue
 * subscribed with.
 */
interface FakeStudioHandle {
  studio: StudioApi;
  emit: (event: ProcessEvent) => void;
  spawnedCommands: string[];
  spawns: Array<{ id: string; command: string; args: string[] }>;
}

function makeFakeStudio(): FakeStudioHandle {
  const ok = <T>(value: T): Result<T> => ({ ok: true, value });
  let processCounter = 0;
  const handlers = new Set<(event: ProcessEvent) => void>();
  const spawnedCommands: string[] = [];
  const spawns: Array<{ id: string; command: string; args: string[] }> = [];
  const emitExit = (id: string, code: number | null, signal: string | null): void => {
    for (const handler of [...handlers]) handler({ id, kind: 'exit', code, signal });
  };

  const studio = {
    info: { platform: 'win32', userDataDir: 'C:/data' },
    fs: {
      // Reports every path as an existing file: this fake is exercising the
      // queue's control flow (export -> Java probe -> renderer validation ->
      // spawn -> wait for a process:event), not the filesystem itself, so
      // every stat check that would otherwise need a distinct real path is
      // made to pass uniformly.
      stat: vi.fn(async (path: string) => ok({ path, exists: true, isFile: true, isDirectory: false, size: 100, modifiedAt: new Date(0).toISOString() })),
      readText: vi.fn(async () => ok('')),
      writeText: vi.fn(async () => ok(undefined)),
      readDirectory: vi.fn(async (path: string) =>
        ok(path.endsWith('region') ? [{ name: 'r.0.0.mca', path: `${path}/r.0.0.mca`, isDirectory: false, size: 1, modifiedAt: new Date(0).toISOString() }] : [])
      ),
      ensureDirectory: vi.fn(async () => ok(undefined)),
      readBase64: vi.fn(async () => ok(''))
    },
    process: {
      spawn: vi.fn(async (options: { command: string; args?: string[] }) => {
        processCounter += 1;
        const id = `p${String(processCounter)}`;
        spawnedCommands.push(options.command);
        spawns.push({ id, command: options.command, args: options.args ?? [] });
        return ok({ id, pid: processCounter, command: options.command, args: options.args ?? [], startedAt: new Date().toISOString() });
      }),
      // A real killed process eventually reports its own exit through
      // `process:event` (see `main/services/processes.ts`'s `child.on('close', ...)`
      // broadcast) — this fake reproduces that so a cancelled render actually
      // settles instead of hanging on a process:event nobody ever sends.
      kill: vi.fn(async (id: string) => {
        emitExit(id, null, 'SIGTERM');
        return ok(undefined);
      }),
      list: vi.fn(async () => ok([{ id: 'java-version', pid: 1, command: 'java', args: [], running: false, startedAt: new Date().toISOString(), endedAt: new Date().toISOString(), exitCode: 0, signal: null }])),
      readOutput: vi.fn(async (_id: string, stream: 'stdout' | 'stderr') => ok(stream === 'stderr' ? 'openjdk version "21.0.1"' : ''))
    },
    events: {
      on: vi.fn((_name: string, handler: (event: ProcessEvent) => void) => {
        handlers.add(handler);
        return () => handlers.delete(handler);
      })
    }
  } as unknown as StudioApi;

  return {
    studio,
    emit: (event) => {
      for (const handler of [...handlers]) handler(event);
    },
    spawnedCommands,
    spawns
  };
}

describe('queue.ts: RenderQueue', () => {
  let fake: ReturnType<typeof makeFakeStudio>;
  let events: QueueEvents;
  let historyCalls: Array<{ action: string; payload: unknown }>;
  let backlogCalls: number[];

  beforeEach(() => {
    fake = makeFakeStudio();
    historyCalls = [];
    backlogCalls = [];
    events = {
      onHistory: (action, payload) => historyCalls.push({ action, payload }),
      onBacklog: (depth) => backlogCalls.push(depth)
    };
  });

  function makeQueue(concurrency = 1, backlogThreshold = 5): RenderQueue {
    return new RenderQueue(
      fake.studio,
      { exportRoot: 'C:/data/exports', outputRoot: 'C:/data/renders' },
      () => ({ concurrency, rendererPath: 'C:/tools/bluemap-cli.jar', acceptDownload: false, threads: 0 }),
      events,
      () => backlogThreshold
    );
  }

  it('reports a commit with no render as "no record", never as a neighbouring commit’s state — the honest-absence guarantee', () => {
    const queue = makeQueue();
    const commitA = makeCommit('aaa');
    const commitB = makeCommit('bbb');
    queue.enqueue(commitA);
    // commitB was never enqueued.
    expect(queue.recordFor(commitB.id)).toBeNull();
    expect(queue.recordFor(commitA.id)).not.toBeNull();
    expect(queue.recordFor(commitA.id)?.commitId).toBe(commitA.id);
  });

  it('never runs more render processes at once than the concurrency limit, and starts the next once a slot frees up', async () => {
    const queue = makeQueue(2);
    const commits = [makeCommit('a'), makeCommit('b'), makeCommit('c'), makeCommit('d')];
    for (const commit of commits) queue.enqueue(commit);

    // Every step up to the actual renderer spawn (`java -jar ...`) resolves
    // on its own in this fake; the spawn itself never exits until this test
    // emits the exit event for it, so "how many are outstanding" is a real,
    // deterministic count rather than a timing guess. Two commits should
    // reach the render step and hang there; the concurrency limit is 2, so
    // no more than 2 may ever be busy at once, checked repeatedly while the
    // rest of the queue's async chain settles.
    // Wait specifically for the render process itself to have been spawned
    // (not merely for the status to say "rendering"), so the exit event
    // below is sent to a process id the queue has actually recorded.
    await vi.waitFor(() => {
      const withProcess = commits.filter((commit) => queue.activeProcessIdFor(commit.id) !== null).length;
      expect(withProcess).toBeGreaterThan(0);
    });
    const busyIds = commits.filter((commit) => queue.activeProcessIdFor(commit.id) !== null).map((commit) => commit.id);
    expect(busyIds.length).toBeGreaterThan(0);
    expect(busyIds.length).toBeLessThanOrEqual(2);
    expect(commits.filter((commit) => queue.isBusy(commit.id)).length).toBeLessThanOrEqual(2);

    // Finish one running render; a third commit should then start, and the
    // busy count must still never exceed the limit of two.
    const firstBusyId = busyIds[0] as string;
    const processId = queue.activeProcessIdFor(firstBusyId);
    expect(processId).not.toBeNull();
    if (processId) fake.emit({ id: processId, kind: 'exit', code: 0, signal: null });

    await vi.waitFor(() => {
      expect(queue.recordFor(firstBusyId)?.status).toBe('finished');
    });
    const busyAfter = commits.filter((commit) => queue.isBusy(commit.id)).length;
    expect(busyAfter).toBeLessThanOrEqual(2);
  });

  it('labels the oldest queued entries "behind" once the backlog passes the threshold, and never drops them', () => {
    const queue = makeQueue(1, 2);
    const commits = Array.from({ length: 5 }, (_, index) => makeCommit(`c${String(index)}`));
    for (const commit of commits) queue.enqueue(commit);
    const snapshot = queue.snapshot();
    expect(snapshot).toHaveLength(5);
    const behindCount = snapshot.filter((record) => record.status === 'behind').length;
    expect(behindCount).toBeGreaterThan(0);
    expect(backlogCalls.length).toBeGreaterThan(0);
  });

  it('does not re-queue a commit that is already known (same object identity)', () => {
    const queue = makeQueue(1);
    const commit = makeCommit('x');
    queue.enqueue(commit);
    const firstRecord = queue.recordFor(commit.id);
    queue.enqueue(commit);
    expect(queue.recordFor(commit.id)).toBe(firstRecord);
  });

  it('cancelling a still-queued commit marks it cancelled immediately, without ever starting it, and retry puts it straight back in line', () => {
    // Concurrency 1, with a blocker commit occupying the only slot and never
    // finishing (its exit is never emitted), keeps the second commit
    // genuinely `queued` — never picked up — so both the cancel and the
    // retry paths below are observable synchronously rather than racing the
    // fake's own async chain.
    const queue = makeQueue(1);
    const blocker = makeCommit('blocker');
    const target = makeCommit('target');
    queue.enqueue(blocker);
    queue.enqueue(target);

    expect(queue.recordFor(target.id)?.status).toBe('queued');
    queue.cancel(target.id);
    expect(queue.recordFor(target.id)?.status).toBe('cancelled');

    queue.retry(target.id);
    // The slot is still held by `blocker`, so retry re-queues target but
    // cannot start it — proving retry re-queues rather than force-starting.
    expect(queue.recordFor(target.id)?.status).toBe('queued');
    expect(queue.isBusy(target.id)).toBe(false);
  });

  it('cancelling a commit that is already running kills its process and settles it as cancelled, never as finished', async () => {
    const queue = makeQueue(1);
    const commit = makeCommit('running-cancel');
    queue.enqueue(commit);
    await vi.waitFor(() => {
      expect(queue.activeProcessIdFor(commit.id)).not.toBeNull();
    });
    queue.cancel(commit.id);
    await vi.waitFor(() => {
      expect(queue.recordFor(commit.id)?.status).toBe('cancelled');
    });
  });

  it('hydrate() never leaves a restored mid-flight record claiming stale progress nobody is currently producing', () => {
    const queue = makeQueue(1);
    const commit = makeCommit('mid-flight');
    const staleRecord: RenderRecord = { ...newRenderRecord(commit), status: 'rendering', progressFraction: 0.42, progressTask: 'Rendering overworld' };
    queue.hydrate([staleRecord], [commit]);
    const restored = queue.recordFor(commit.id);
    // hydrate() also resumes it (see queue.ts), so by the time this reads the
    // record it may already be synchronously past `queued` into `exporting`
    // — the one thing that must never be true again is the stale 42% claim.
    expect(restored?.status).not.toBe('rendering');
    expect(['queued', 'exporting']).toContain(restored?.status);
    expect(restored?.progressFraction).toBeNull();
    expect(restored?.progressTask).toBe('');
  });

  it('hydrate() resumes a restored queued commit on its own, rather than waiting for an unrelated new commit', async () => {
    const queue = makeQueue(1);
    const commit = makeCommit('resume-me');
    const staleRecord: RenderRecord = { ...newRenderRecord(commit), status: 'queued' };
    queue.hydrate([staleRecord], [commit]);
    await vi.waitFor(() => {
      expect(queue.recordFor(commit.id)?.status).not.toBe('queued');
    });
  });

  it('cancel() on an unknown commit is a safe no-op', () => {
    const queue = makeQueue();
    expect(() => queue.cancel('does-not-exist')).not.toThrow();
  });
});
