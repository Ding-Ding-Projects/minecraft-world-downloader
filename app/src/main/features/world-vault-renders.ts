/**
 * Main-process support for the "world-vault-renders" feature: an efficient,
 * real-filesystem implementation of the Anvil region-header diff that the
 * comparison surface presents in words ("which regions differ and how many
 * chunks").
 *
 * WHY THIS LIVES IN THE MAIN PROCESS RATHER THAN BEHIND THE EXISTING
 * `ctx.studio.fs` BRIDGE: `studio.fs.readBase64` reads a whole file — there is
 * no positional/ranged read on the bridge — so computing a diff over
 * potentially hundreds of multi-megabyte region files by that route means
 * decoding every one of them in full as base64 in the renderer just to look at
 * their first 8192 bytes. That is correct (and is in fact what
 * `../../renderer/features/world-vault-renders/regionReader.ts` does today,
 * bounded and documented there) but wasteful. This module does the same
 * comparison with a genuine positional read of only the header, which is the
 * right way to do it once it has a way to reach the renderer.
 *
 * CURRENT INTEGRATION STATE — read before assuming this runs automatically:
 * this feature's own contract grants it exactly three paths to own:
 * `app/src/renderer/features/world-vault-renders/**`, this file, and its docs
 * article. Wiring a new IPC channel is a change to `app/src/main/ipc.ts` and
 * `app/src/shared/channels.ts` (the allow-list) and `app/src/shared/api.ts`
 * (the `StudioApi` shape) — three files this feature does not own, shared by
 * every feature in the application and, for this specific feature cluster, by
 * the sibling `world-vault` and `world-vault-edit` lanes too. Rather than each
 * lane racing to edit the same three files, this module is written to be
 * wired in with a single small, additive change once that integration pass
 * happens:
 *
 *   1. Add `'world-vault-renders:diff-directories'` to `INVOKE_CHANNELS` in
 *      `app/src/shared/channels.ts`.
 *   2. In `app/src/main/ipc.ts`, `registerHandler('world-vault-renders:diff-directories',
 *      (_event, worldA, worldB) => diffWorldDirectories(String(worldA), String(worldB)))`.
 *   3. Add the matching method to `StudioApi` in `app/src/shared/api.ts` and to
 *      the preload bridge.
 *
 * Until that lands, every function below is real, working, independently
 * tested code — see `app/tests/unit/world-vault-renders-main.test.ts`, which
 * exercises it directly against real files written to a temporary directory —
 * it is simply not yet reachable from the renderer, which uses the slower but
 * fully-wired `regionReader.ts` path in the meantime. Both read the identical
 * on-disk format through the identical pure parser in `anvil.ts`, so the two
 * are never able to disagree about what a region file contains.
 */

import { open, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import {
  DIMENSION_REGION_PATHS,
  REGION_HEADER_BYTES,
  absoluteChunkCoord,
  diffRegionHeaders,
  parseRegionHeader,
  regionFileCoords,
  type RegionHeader
} from '../../renderer/features/world-vault-renders/anvil';

export type MainResult<T> = { ok: true; value: T } | { ok: false; error: string };

/**
 * Reads exactly the header bytes of one region file with a positional read —
 * never the whole file — so this scales to hundreds of multi-megabyte region
 * files without holding any of their chunk data in memory.
 */
export async function readRegionHeaderFromDisk(path: string): Promise<MainResult<RegionHeader>> {
  let handle;
  try {
    handle = await open(path, 'r');
  } catch (error) {
    return { ok: false, error: `"${path}" could not be opened: ${describe(error)}` };
  }
  try {
    const stats = await handle.stat();
    if (stats.size < REGION_HEADER_BYTES) {
      return {
        ok: false,
        error: `"${path}" is ${String(stats.size)} bytes, smaller than the ${String(
          REGION_HEADER_BYTES
        )}-byte Anvil header. It is truncated or not a region file.`
      };
    }
    const buffer = Buffer.alloc(REGION_HEADER_BYTES);
    const { bytesRead } = await handle.read(buffer, 0, REGION_HEADER_BYTES, 0);
    if (bytesRead < REGION_HEADER_BYTES) {
      return { ok: false, error: `Only ${String(bytesRead)} header bytes could be read from "${path}".` };
    }
    return { ok: true, value: parseRegionHeader(buffer) };
  } catch (error) {
    return { ok: false, error: `"${path}" could not be read: ${describe(error)}` };
  } finally {
    await handle.close().catch(() => undefined);
  }
}

export interface RegionFileDiffEntry {
  dimension: string;
  regionFile: string;
  regionX: number;
  regionZ: number;
  status: 'added' | 'removed' | 'changed';
  addedChunks: number;
  removedChunks: number;
  changedChunks: number;
  /** Absolute chunk coordinates for every changed slot, for a caller that wants them. */
  changedChunkCoords: Array<{ x: number; z: number }>;
}

export interface WorldDiffSummary {
  /** Only the region files that actually differ; an unchanged region is not noise here. */
  regions: RegionFileDiffEntry[];
  regionsCompared: number;
  regionsChanged: number;
  totalChunksAdded: number;
  totalChunksRemoved: number;
  totalChunksChanged: number;
  /** ISO-8601 time the comparison ran. */
  computedAt: string;
}

async function listRegionFiles(worldDirectory: string, segments: string[]): Promise<string[]> {
  const target = join(worldDirectory, ...segments);
  try {
    const entries = await readdir(target, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && regionFileCoords(entry.name) !== null)
      .map((entry) => entry.name);
  } catch {
    // A dimension that was never generated (no nether, no end) has no such
    // folder at all. That is a normal, honest absence, not an error.
    return [];
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Compares every region file across every dimension folder between two
 * exported world snapshots (the on-disk trees produced by checking out two
 * different vault commits), and reports exactly which regions differ and by
 * how many chunks — read from the files' own headers, never estimated.
 */
export async function diffWorldDirectories(
  worldDirectoryBefore: string,
  worldDirectoryAfter: string
): Promise<MainResult<WorldDiffSummary>> {
  const regions: RegionFileDiffEntry[] = [];
  let compared = 0;
  let totalAdded = 0;
  let totalRemoved = 0;
  let totalChanged = 0;

  for (const { dimension, segments } of DIMENSION_REGION_PATHS) {
    const [beforeFiles, afterFiles] = await Promise.all([
      listRegionFiles(worldDirectoryBefore, segments),
      listRegionFiles(worldDirectoryAfter, segments)
    ]);
    const names = new Set([...beforeFiles, ...afterFiles]);

    for (const name of [...names].sort()) {
      const coords = regionFileCoords(name);
      if (!coords) continue;
      const beforePath = join(worldDirectoryBefore, ...segments, name);
      const afterPath = join(worldDirectoryAfter, ...segments, name);
      const inBefore = beforeFiles.includes(name);
      const inAfter = afterFiles.includes(name);
      compared += 1;

      if (inBefore && !inAfter) {
        const header = await readRegionHeaderFromDisk(beforePath);
        if (!header.ok) return header;
        if (header.value.presentCount === 0) continue;
        const coordsChanged = header.value.slots
          .filter((slot) => slot.present)
          .map((slot) => absoluteChunkCoord(coords, slot));
        regions.push({
          dimension,
          regionFile: name,
          regionX: coords.x,
          regionZ: coords.z,
          status: 'removed',
          addedChunks: 0,
          removedChunks: header.value.presentCount,
          changedChunks: 0,
          changedChunkCoords: coordsChanged
        });
        totalRemoved += header.value.presentCount;
        continue;
      }

      if (!inBefore && inAfter) {
        const header = await readRegionHeaderFromDisk(afterPath);
        if (!header.ok) return header;
        if (header.value.presentCount === 0) continue;
        const coordsChanged = header.value.slots
          .filter((slot) => slot.present)
          .map((slot) => absoluteChunkCoord(coords, slot));
        regions.push({
          dimension,
          regionFile: name,
          regionX: coords.x,
          regionZ: coords.z,
          status: 'added',
          addedChunks: header.value.presentCount,
          removedChunks: 0,
          changedChunks: 0,
          changedChunkCoords: coordsChanged
        });
        totalAdded += header.value.presentCount;
        continue;
      }

      // Present on both sides: a real header-to-header diff.
      const [before, after] = await Promise.all([
        readRegionHeaderFromDisk(beforePath),
        readRegionHeaderFromDisk(afterPath)
      ]);
      if (!before.ok) return before;
      if (!after.ok) return after;
      const diff = diffRegionHeaders(before.value, after.value);
      if (diff.addedChunks === 0 && diff.removedChunks === 0 && diff.changedChunks === 0) continue;

      regions.push({
        dimension,
        regionFile: name,
        regionX: coords.x,
        regionZ: coords.z,
        status: 'changed',
        addedChunks: diff.addedChunks,
        removedChunks: diff.removedChunks,
        changedChunks: diff.changedChunks,
        changedChunkCoords: diff.changes.map((change) => absoluteChunkCoord(coords, change))
      });
      totalAdded += diff.addedChunks;
      totalRemoved += diff.removedChunks;
      totalChanged += diff.changedChunks;
    }
  }

  return {
    ok: true,
    value: {
      regions,
      regionsCompared: compared,
      regionsChanged: regions.length,
      totalChunksAdded: totalAdded,
      totalChunksRemoved: totalRemoved,
      totalChunksChanged: totalChanged,
      computedAt: new Date().toISOString()
    }
  };
}

/** True when the directory exists and is a directory. Used to validate an export before diffing it. */
export async function directoryExists(path: string): Promise<boolean> {
  try {
    const stats = await stat(path);
    return stats.isDirectory();
  } catch {
    return false;
  }
}
