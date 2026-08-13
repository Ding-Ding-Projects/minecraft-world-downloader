/**
 * Finding the worlds this application has already downloaded, and reading enough
 * of each one to hand it to Worldlens honestly.
 *
 * A world is a folder holding a `level.dat`. That is the only rule, and it is
 * the rule the renderer itself uses, so a folder this module lists is a folder
 * the renderer will accept. Anything else in the worlds directory is left alone
 * and reported as what it is rather than offered as a world that will then fail.
 */

import type { StudioApi } from '../../../shared/api';
import { MAX_LEVEL_DAT_BYTES, readLevelSummary } from './nbt';
import { baseName, classifyWorldVersion, joinPath, type WorldSupport } from './probe';

/** The three dimensions a vanilla save keeps, and where each one's regions live. */
export const DIMENSIONS = [
  { id: 'minecraft:overworld', label: 'Overworld', regionPath: ['region'], sorting: 0 },
  { id: 'minecraft:the_nether', label: 'Nether', regionPath: ['DIM-1', 'region'], sorting: 100 },
  { id: 'minecraft:the_end', label: 'End', regionPath: ['DIM1', 'region'], sorting: 200 }
] as const;

export type DimensionId = (typeof DIMENSIONS)[number]['id'];

export interface DiscoveredWorld {
  /** Stable id for lists and selections: the absolute path. */
  id: string;
  /** The folder itself. This is what the renderer is pointed at. */
  path: string;
  /** The folder's own name. */
  folderName: string;
  /** `LevelName` from the save, when it has one; otherwise the folder name. */
  displayName: string;
  /** The Minecraft version the save records, when it records one. */
  versionName: string | null;
  /** Whether Worldlens states it can read a world of that version. */
  support: WorldSupport;
  /** Dimensions whose region folder actually exists in this save. */
  dimensions: DimensionId[];
  /** Number of region files across the dimensions found, for a size sense. */
  regionFiles: number;
  /** ISO-8601 modification time of the save folder. */
  modifiedAt: string;
  /** Set when `level.dat` was found but could not be read, with the reason. */
  readError: string | null;
}

export type ScanState =
  | { kind: 'unconfigured' }
  | { kind: 'missing'; directory: string }
  | { kind: 'unreadable'; directory: string; error: string }
  | { kind: 'empty'; directory: string; inspected: number }
  | { kind: 'ready'; directory: string; worlds: DiscoveredWorld[]; skipped: number };

/** How many entries of a worlds directory are inspected before the scan stops. */
const MAX_CANDIDATES = 500;

async function isWorldFolder(studio: StudioApi, path: string): Promise<boolean> {
  const stat = await studio.fs.stat(joinPath(path, 'level.dat'));
  return stat.ok && stat.value.exists && stat.value.isFile;
}

async function countRegionFiles(studio: StudioApi, directory: string): Promise<number> {
  const listing = await studio.fs.readDirectory(directory);
  if (!listing.ok) return 0;
  return listing.value.filter((entry) => !entry.isDirectory && /\.mca$/i.test(entry.name)).length;
}

/** Reads one world folder. Never throws: a failure becomes `readError`. */
export async function readWorld(studio: StudioApi, path: string): Promise<DiscoveredWorld> {
  const folderName = baseName(path);
  const stat = await studio.fs.stat(path);
  const modifiedAt = stat.ok && stat.value.exists ? stat.value.modifiedAt : '';

  const dimensions: DimensionId[] = [];
  let regionFiles = 0;
  for (const dimension of DIMENSIONS) {
    const regionDirectory = joinPath(path, ...dimension.regionPath);
    const regionStat = await studio.fs.stat(regionDirectory);
    if (regionStat.ok && regionStat.value.exists && regionStat.value.isDirectory) {
      dimensions.push(dimension.id);
      regionFiles += await countRegionFiles(studio, regionDirectory);
    }
  }

  let versionName: string | null = null;
  let displayName = folderName;
  let readError: string | null = null;

  const encoded = await studio.fs.readBase64(joinPath(path, 'level.dat'), MAX_LEVEL_DAT_BYTES);
  if (!encoded.ok) {
    readError = encoded.error;
  } else {
    try {
      const summary = await readLevelSummary(encoded.value);
      versionName = summary.versionName;
      if (summary.levelName && summary.levelName.trim() !== '') displayName = summary.levelName.trim();
    } catch (error) {
      readError = error instanceof Error ? error.message : String(error);
    }
  }

  return {
    id: path,
    path,
    folderName,
    displayName,
    versionName,
    support: classifyWorldVersion(versionName),
    dimensions,
    regionFiles,
    modifiedAt,
    readError
  };
}

/**
 * Scans a directory for worlds.
 *
 * The directory itself counts when it holds a `level.dat`, because pointing the
 * field straight at one world is the obvious thing to do and refusing it would
 * be pedantry. Otherwise its immediate children are inspected; the scan does not
 * recurse, because a saves folder is one level deep and a recursive walk over an
 * arbitrary directory somebody browsed to is an expensive way to find nothing.
 */
export async function scanWorlds(studio: StudioApi, directory: string): Promise<ScanState> {
  const trimmed = directory.trim();
  if (trimmed === '') return { kind: 'unconfigured' };

  const stat = await studio.fs.stat(trimmed);
  if (!stat.ok) return { kind: 'unreadable', directory: trimmed, error: stat.error };
  if (!stat.value.exists) return { kind: 'missing', directory: trimmed };
  if (!stat.value.isDirectory) {
    return {
      kind: 'unreadable',
      directory: trimmed,
      error: 'That path is a file. Choose the folder your downloaded worlds are written to.'
    };
  }

  if (await isWorldFolder(studio, trimmed)) {
    return { kind: 'ready', directory: trimmed, worlds: [await readWorld(studio, trimmed)], skipped: 0 };
  }

  const listing = await studio.fs.readDirectory(trimmed);
  if (!listing.ok) return { kind: 'unreadable', directory: trimmed, error: listing.error };

  const candidates = listing.value.filter((entry) => entry.isDirectory).slice(0, MAX_CANDIDATES);
  const worlds: DiscoveredWorld[] = [];
  let skipped = 0;
  for (const candidate of candidates) {
    if (await isWorldFolder(studio, candidate.path)) worlds.push(await readWorld(studio, candidate.path));
    else skipped += 1;
  }

  worlds.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt) || a.displayName.localeCompare(b.displayName));
  if (worlds.length === 0) {
    return { kind: 'empty', directory: trimmed, inspected: candidates.length };
  }
  return { kind: 'ready', directory: trimmed, worlds, skipped };
}

/** The rows a world contributes to an export, with nothing computed twice. */
export function worldExportRow(world: DiscoveredWorld): Record<string, unknown> {
  return {
    name: world.displayName,
    folder: world.folderName,
    path: world.path,
    minecraftVersion: world.versionName ?? '',
    rendererSupport: world.support.kind,
    dimensions: world.dimensions.join(', '),
    regionFiles: world.regionFiles,
    modifiedAt: world.modifiedAt,
    readError: world.readError ?? ''
  };
}
