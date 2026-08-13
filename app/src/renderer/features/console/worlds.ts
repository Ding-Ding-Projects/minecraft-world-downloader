import type { DirectoryEntry, StudioApi } from '../../../shared/api';
import { joinPath, separatorFor } from './service';

/**
 * The console's data directory, read natively.
 *
 * The browser dashboard shows one world: whichever the configuration currently
 * points at. The data directory usually holds several, because changing the
 * output directory leaves the previous one exactly where it was. Listing them
 * all is the difference between a page that reports a number and a surface a
 * person can actually manage their captures from.
 *
 * Measuring a world means walking it, and a world is tens of thousands of
 * files. The walk is therefore bounded in both depth and file count, and when
 * it hits a bound it says so rather than reporting a total that is quietly
 * short.
 */

export interface WorldRecord {
  /** Folder name, which is also the row id. */
  name: string;
  path: string;
  /** ISO-8601 modification time of the folder itself. */
  modifiedAt: string;
  /** Files counted by the walk. */
  files: number;
  /** Bytes counted by the walk. */
  bytes: number;
  /** Region files (`.mca`) found, the honest measure of how much was captured. */
  regionFiles: number;
  /** Dimension folder names found beneath the world. */
  dimensions: string[];
  /** True when a `level.dat` is present, so it is a world rather than a folder. */
  hasLevelDat: boolean;
  /** True when the overview renderer has written tiles into it. */
  hasOverview: boolean;
  /** True when the walk stopped at one of its bounds, so the totals are floors. */
  capped: boolean;
  /** True when this is the folder the current configuration writes into. */
  isCurrent: boolean;
  /** Set when the folder could not be read, with the reason. */
  error: string | null;
}

export interface ScanBounds {
  maxDepth: number;
  maxEntries: number;
}

export interface MeasureResult {
  files: number;
  bytes: number;
  regionFiles: number;
  dimensions: string[];
  hasLevelDat: boolean;
  hasOverview: boolean;
  capped: boolean;
  error: string | null;
}

async function readDirectory(studio: StudioApi, path: string): Promise<DirectoryEntry[] | string> {
  const result = await studio.fs.readDirectory(path);
  return result.ok ? result.value : result.error;
}

/** Walks one folder within the given bounds and totals what it finds. */
export async function measureDirectory(
  studio: StudioApi,
  path: string,
  bounds: ScanBounds,
  shouldStop?: () => boolean
): Promise<MeasureResult> {
  const result: MeasureResult = {
    files: 0,
    bytes: 0,
    regionFiles: 0,
    dimensions: [],
    hasLevelDat: false,
    hasOverview: false,
    capped: false,
    error: null
  };
  const dimensions = new Set<string>();
  const queue: Array<{ path: string; depth: number }> = [{ path, depth: 0 }];

  while (queue.length > 0) {
    if (shouldStop?.()) {
      result.capped = true;
      break;
    }
    const current = queue.shift();
    if (!current) break;
    const entries = await readDirectory(studio, current.path);
    if (typeof entries === 'string') {
      if (current.depth === 0) {
        result.error = entries;
        return result;
      }
      // A folder deeper in the tree that cannot be read is a partial total, not
      // a failed measurement, so the cap flag carries that honestly.
      result.capped = true;
      continue;
    }
    for (const entry of entries) {
      if (entry.isDirectory) {
        if (current.depth === 0) {
          if (entry.name === 'overview') result.hasOverview = true;
          else if (entry.name.startsWith('DIM') || entry.name === 'region' || entry.name === 'entities') {
            dimensions.add(entry.name);
          }
        }
        if (current.depth + 1 <= bounds.maxDepth) queue.push({ path: entry.path, depth: current.depth + 1 });
        else result.capped = true;
        continue;
      }
      result.files += 1;
      result.bytes += entry.size;
      if (entry.name.endsWith('.mca')) result.regionFiles += 1;
      if (current.depth === 0 && entry.name === 'level.dat') result.hasLevelDat = true;
      if (result.files >= bounds.maxEntries) {
        result.capped = true;
        result.dimensions = [...dimensions].sort();
        return result;
      }
    }
  }

  result.dimensions = [...dimensions].sort();
  return result;
}

export interface ScanOptions extends ScanBounds {
  /** The folder the configuration currently writes into, for the badge. */
  currentWorld: string;
  /** Called after each world is measured, so progress is real rather than a spinner. */
  onProgress?(completed: number, total: number, name: string): void;
  shouldStop?(): boolean;
}

export interface ScanOutcome {
  worlds: WorldRecord[];
  /** Set when the data directory itself could not be listed. */
  error: string | null;
  /** Folders skipped because they are the console's own records, not worlds. */
  skipped: string[];
}

/** Folder names in the data directory that are never a captured world. */
const NON_WORLD_FOLDERS = new Set(['exports', 'bot-auth', '__pycache__', 'logs', '.git']);

/** Lists and measures every world folder in the console's data directory. */
export async function scanWorlds(
  studio: StudioApi,
  dataDirectory: string,
  options: ScanOptions
): Promise<ScanOutcome> {
  const trimmed = dataDirectory.trim();
  if (!trimmed) {
    return {
      worlds: [],
      error: 'No data directory is configured, so there is nowhere to look for worlds.',
      skipped: []
    };
  }
  const entries = await readDirectory(studio, trimmed);
  if (typeof entries === 'string') {
    return { worlds: [], error: entries, skipped: [] };
  }

  const folders = entries.filter((entry) => entry.isDirectory);
  const skipped: string[] = [];
  const candidates = folders.filter((entry) => {
    if (NON_WORLD_FOLDERS.has(entry.name)) {
      skipped.push(entry.name);
      return false;
    }
    return true;
  });

  const worlds: WorldRecord[] = [];
  let completed = 0;
  for (const entry of candidates) {
    if (options.shouldStop?.()) break;
    const measured = await measureDirectory(
      studio,
      entry.path,
      { maxDepth: options.maxDepth, maxEntries: options.maxEntries },
      options.shouldStop
    );
    worlds.push({
      name: entry.name,
      path: entry.path,
      modifiedAt: entry.modifiedAt,
      files: measured.files,
      bytes: measured.bytes,
      regionFiles: measured.regionFiles,
      dimensions: measured.dimensions,
      hasLevelDat: measured.hasLevelDat,
      hasOverview: measured.hasOverview,
      capped: measured.capped,
      isCurrent: entry.name === options.currentWorld,
      error: measured.error
    });
    completed += 1;
    options.onProgress?.(completed, candidates.length, entry.name);
  }

  worlds.sort((left, right) => left.name.localeCompare(right.name));
  return { worlds, error: null, skipped };
}

/* ------------------------------------------------------------------ */
/* The console's own stored records                                    */
/* ------------------------------------------------------------------ */

export type RecordSensitivity = 'plain' | 'never-read';

export interface DataRecord {
  id: string;
  /** What the file is, in plain words. */
  label: string;
  path: string;
  exists: boolean;
  isDirectory: boolean;
  bytes: number;
  modifiedAt: string;
  /** What the console keeps in it. */
  purpose: string;
  /**
   * `never-read` marks a file this application will not open, because its
   * contents are credential material. Its existence and size are reported; its
   * contents never are.
   */
  sensitivity: RecordSensitivity;
}

interface RecordDescriptor {
  id: string;
  name: string;
  label: string;
  purpose: string;
  sensitivity: RecordSensitivity;
}

const RECORD_DESCRIPTORS: RecordDescriptor[] = [
  {
    id: 'manager-config',
    name: 'manager-config.json',
    label: 'Saved configuration',
    purpose: 'Every downloader option the console persists, by the same keys it turns into command line flags.',
    sensitivity: 'plain'
  },
  {
    id: 'auth',
    name: 'auth.json',
    label: 'Minecraft account record',
    purpose: 'The signed-in Minecraft account, including its access token. Its presence is reported; it is never opened here.',
    sensitivity: 'never-read'
  },
  {
    id: 'secret-key',
    name: '.secret_key',
    label: 'Session signing key',
    purpose: 'The key the console signs its browser sessions with. Its presence is reported; it is never opened here.',
    sensitivity: 'never-read'
  },
  {
    id: 'bot-config',
    name: 'bot-config.json',
    label: 'Auto-explore bot configuration',
    purpose: 'The configuration written for the most recent bot run: accounts, radius, and the flight and revisit choices.',
    sensitivity: 'plain'
  },
  {
    id: 'bot-visited',
    name: 'bot-visited.json',
    label: 'Bot visited-position cache',
    purpose: 'Where the auto-explore bot has already been, so a later run does not walk the same ground.',
    sensitivity: 'plain'
  },
  {
    id: 'bot-auth',
    name: 'bot-auth',
    label: 'Bot Microsoft token cache',
    purpose: 'Cached Microsoft tokens for the bot, so a sign-in survives a restart. Never opened here.',
    sensitivity: 'never-read'
  },
  {
    id: 'exports',
    name: 'exports',
    label: 'World snapshots',
    purpose: 'Timestamped copies the console makes when a snapshot is taken from this surface or the dashboard.',
    sensitivity: 'plain'
  }
];

/** Stats the console's own stored records without reading any of them. */
export async function listDataRecords(studio: StudioApi, dataDirectory: string): Promise<DataRecord[]> {
  const separator = separatorFor(studio.info.platform);
  const trimmed = dataDirectory.trim();
  if (!trimmed) return [];
  const records = await Promise.all(
    RECORD_DESCRIPTORS.map(async (descriptor): Promise<DataRecord> => {
      const path = joinPath(separator, trimmed, descriptor.name);
      const stat = await studio.fs.stat(path);
      const found = stat.ok && stat.value.exists;
      return {
        id: descriptor.id,
        label: descriptor.label,
        path,
        exists: found,
        isDirectory: found ? stat.ok && stat.value.isDirectory : false,
        bytes: found && stat.ok ? stat.value.size : 0,
        modifiedAt: found && stat.ok ? stat.value.modifiedAt : '',
        purpose: descriptor.purpose,
        sensitivity: descriptor.sensitivity
      };
    })
  );
  return records;
}

/** Formats a byte count without pretending to a precision it does not have. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KiB', 'MiB', 'GiB', 'TiB'];
  let value = bytes / 1024;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[index]}`;
}

/** A local timestamp, or an em dash when there genuinely is not one. */
export function formatTimestamp(iso: string): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
}
