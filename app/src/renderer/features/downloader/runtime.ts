import type { AppContext } from '../../core/registry';
import type { ProcessEvent } from '../../../shared/api';

/**
 * Everything the download session needs from the machine it is running on:
 * where Java is, where the jar is, and what is actually on disk in the output
 * world.
 *
 * Nothing here guesses. A probe that could not be run says so, and the surface
 * that shows the result offers the route out of that state rather than an error
 * string with nowhere to go.
 */

/* ------------------------------------------------------------------ */
/* Paths                                                               */
/* ------------------------------------------------------------------ */

export function separatorFor(platform: string): string {
  return platform === 'win32' ? '\\' : '/';
}

export function joinPath(separator: string, ...parts: string[]): string {
  const cleaned = parts.filter((part) => part !== '');
  if (cleaned.length === 0) return '';
  const [first, ...rest] = cleaned;
  const tail = rest.map((part) => part.replace(/^[\\/]+/, '')).filter((part) => part !== '');
  const head = first.replace(/[\\/]+$/, '');
  return [head, ...tail].join(separator);
}

export function isAbsolutePath(path: string): boolean {
  return /^([A-Za-z]:[\\/]|[\\/])/.test(path);
}

/** Turns a server address into a directory-safe name for a suggested path. */
export function safeFolderName(value: string): string {
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned === '' ? 'world' : cleaned.slice(0, 48);
}

/* ------------------------------------------------------------------ */
/* Java runtime                                                        */
/* ------------------------------------------------------------------ */

export type JavaState = 'unknown' | 'checking' | 'present' | 'missing' | 'failed';

export interface JavaProbe {
  state: JavaState;
  /** The command that was probed: `java` or `javaw`. */
  command: string;
  /** The first line the runtime printed, verbatim. Empty until it answers. */
  versionLine: string;
  /** Everything it printed, kept for the honest failure explanation. */
  output: string;
  /** Exact reason the probe failed, when it did. */
  error: string | null;
  checkedAt: string | null;
}

export function unknownJava(command: string): JavaProbe {
  return { state: 'unknown', command, versionLine: '', output: '', error: null, checkedAt: null };
}

/**
 * Runs `<command> -version` and reads what comes back.
 *
 * Java prints its version banner on stderr, which is not a failure; the exit
 * code is what decides. A missing runtime surfaces as a spawn `error` event
 * rather than a rejected promise, so both routes are handled.
 */
export async function probeJava(ctx: AppContext, command: string): Promise<JavaProbe> {
  const started = await ctx.studio.process.spawn({
    command,
    args: ['-version'],
    maxOutputBytes: 64 * 1024,
    timeoutMs: 15_000
  });
  if (!started.ok) {
    return {
      state: 'missing',
      command,
      versionLine: '',
      output: '',
      error: started.error,
      checkedAt: new Date().toISOString()
    };
  }

  const id = started.value.id;
  return new Promise<JavaProbe>((resolve) => {
    let output = '';
    let settled = false;
    const finish = (probe: JavaProbe): void => {
      if (settled) return;
      settled = true;
      unsubscribe();
      clearTimeout(guard);
      resolve(probe);
    };

    const unsubscribe = ctx.studio.events.on('process:event', (event: ProcessEvent) => {
      if (event.id !== id) return;
      if (event.kind === 'stdout' || event.kind === 'stderr') {
        output += event.chunk;
        return;
      }
      if (event.kind === 'error') {
        finish({
          state: 'missing',
          command,
          versionLine: '',
          output,
          error: event.message,
          checkedAt: new Date().toISOString()
        });
        return;
      }
      if (event.kind === 'exit') {
        const firstLine = output.split(/\r?\n/).find((line) => line.trim() !== '')?.trim() ?? '';
        if (event.code === 0) {
          finish({
            state: 'present',
            command,
            versionLine: firstLine,
            output,
            error: null,
            checkedAt: new Date().toISOString()
          });
        } else {
          finish({
            state: 'failed',
            command,
            versionLine: firstLine,
            output,
            error: `"${command} -version" exited with code ${String(event.code)}.`,
            checkedAt: new Date().toISOString()
          });
        }
      }
    });

    const guard = setTimeout(() => {
      void ctx.studio.process.kill(id);
      finish({
        state: 'failed',
        command,
        versionLine: '',
        output,
        error: `"${command} -version" did not answer within 15 seconds.`,
        checkedAt: new Date().toISOString()
      });
    }, 16_000);
  });
}

/** Where a person gets a Java runtime. Opened in their browser, never fetched. */
export const JAVA_DOWNLOAD_URL = 'https://adoptium.net/temurin/releases/';

/** Where the jar is published. Opened in their browser, never fetched. */
export const JAR_DOWNLOAD_URL =
  'https://github.com/cafepromenade/minecraft-world-downloader/releases/latest';

/* ------------------------------------------------------------------ */
/* The jar                                                             */
/* ------------------------------------------------------------------ */

export interface JarProbe {
  path: string;
  found: boolean;
  sizeBytes: number;
  modifiedAt: string | null;
  /** Where the path came from, so the surface can say it plainly. */
  origin: 'setting' | 'application-data' | 'none';
  /** Every place that was looked in, in order, for the honest empty state. */
  searched: string[];
}

/**
 * Resolves the jar: the configured path first, then the places an installed
 * build keeps it. A guess is never reported as found — every candidate is
 * stat-ed before it is offered.
 */
export async function probeJar(ctx: AppContext, configured: string): Promise<JarProbe> {
  const separator = separatorFor(ctx.studio.info.platform);
  const dataDir = ctx.studio.info.userDataDir;
  const candidates: Array<{ path: string; origin: JarProbe['origin'] }> = [];

  const trimmed = configured.trim();
  if (trimmed !== '') candidates.push({ path: trimmed, origin: 'setting' });
  candidates.push({ path: joinPath(separator, dataDir, 'world-downloader.jar'), origin: 'application-data' });
  candidates.push({
    path: joinPath(separator, dataDir, 'downloader', 'world-downloader.jar'),
    origin: 'application-data'
  });

  const searched: string[] = [];
  for (const candidate of candidates) {
    searched.push(candidate.path);
    const stat = await ctx.studio.fs.stat(candidate.path);
    if (stat.ok && stat.value.exists && stat.value.isFile) {
      return {
        path: candidate.path,
        found: true,
        sizeBytes: stat.value.size,
        modifiedAt: stat.value.modifiedAt,
        origin: candidate.origin,
        searched
      };
    }
  }

  return {
    path: trimmed,
    found: false,
    sizeBytes: 0,
    modifiedAt: null,
    origin: 'none',
    searched
  };
}

/* ------------------------------------------------------------------ */
/* What is on disk in the output world                                 */
/* ------------------------------------------------------------------ */

export interface RegionFile {
  path: string;
  name: string;
  /** `region` or `entities` — the two Anvil directories the jar writes. */
  kind: 'region' | 'entities';
  /** The dimension folder the file sits under, as it is named on disk. */
  dimension: string;
  sizeBytes: number;
  modifiedAt: string;
}

export interface WorldScan {
  /** True when the output directory exists at all. */
  exists: boolean;
  root: string;
  files: RegionFile[];
  totalBytes: number;
  /** ISO-8601 of the newest region write, or null when nothing is written. */
  lastWriteAt: string | null;
  dimensions: string[];
  /** Exact reason a scan could not complete, or null. */
  error: string | null;
  scannedAt: string;
}

export function emptyScan(root: string): WorldScan {
  return {
    exists: false,
    root,
    files: [],
    totalBytes: 0,
    lastWriteAt: null,
    dimensions: [],
    error: null,
    scannedAt: new Date().toISOString()
  };
}

/**
 * Walks the output world looking for Anvil region files.
 *
 * Bounded on purpose: a world folder is the user's own directory and may hold
 * anything, so the walk stops at a fixed depth and a fixed entry count rather
 * than following a deep tree indefinitely.
 */
export async function scanWorld(ctx: AppContext, root: string): Promise<WorldScan> {
  const scan = emptyScan(root);
  if (root.trim() === '') {
    scan.error = 'No output world directory is set.';
    return scan;
  }

  const stat = await ctx.studio.fs.stat(root);
  if (!stat.ok) {
    scan.error = stat.error;
    return scan;
  }
  if (!stat.value.exists || !stat.value.isDirectory) {
    // Not an error: a world that has never been written simply is not there yet.
    return scan;
  }
  scan.exists = true;

  const MAX_DEPTH = 4;
  const MAX_ENTRIES = 20_000;
  let seen = 0;
  const dimensions = new Set<string>();

  const walk = async (directory: string, depth: number, dimension: string): Promise<void> => {
    if (depth > MAX_DEPTH || seen > MAX_ENTRIES) return;
    const listing = await ctx.studio.fs.readDirectory(directory);
    if (!listing.ok) {
      // One unreadable subdirectory does not invalidate the rest of the scan.
      if (scan.error === null) scan.error = listing.error;
      return;
    }
    for (const entry of listing.value) {
      seen += 1;
      if (seen > MAX_ENTRIES) return;
      if (entry.isDirectory) {
        if (entry.name === 'overview' || entry.name === 'debug') continue;
        const nextDimension =
          entry.name === 'region' || entry.name === 'entities' || entry.name === 'poi'
            ? dimension
            : entry.name;
        await walk(entry.path, depth + 1, nextDimension);
        continue;
      }
      if (!entry.name.toLowerCase().endsWith('.mca')) continue;
      const parent = directory.replace(/[\\/]+$/, '').split(/[\\/]/).pop() ?? '';
      const kind: RegionFile['kind'] = parent === 'entities' ? 'entities' : 'region';
      const dimensionName = dimension === '' ? 'overworld' : dimension;
      dimensions.add(dimensionName);
      scan.files.push({
        path: entry.path,
        name: entry.name,
        kind,
        dimension: dimensionName,
        sizeBytes: entry.size,
        modifiedAt: entry.modifiedAt
      });
      scan.totalBytes += entry.size;
      if (scan.lastWriteAt === null || entry.modifiedAt > scan.lastWriteAt) {
        scan.lastWriteAt = entry.modifiedAt;
      }
    }
  };

  await walk(root, 0, '');
  scan.dimensions = [...dimensions].sort();
  scan.scannedAt = new Date().toISOString();
  return scan;
}

/* ------------------------------------------------------------------ */
/* Counting saved chunks                                               */
/* ------------------------------------------------------------------ */

export interface ChunkCount {
  /** Chunk slots actually occupied in the region headers that were read. */
  chunks: number;
  filesRead: number;
  /** Files skipped because they were larger than the read ceiling. */
  filesSkipped: number;
  skippedNames: string[];
  perDimension: Array<{ dimension: string; kind: RegionFile['kind']; chunks: number }>;
  cancelled: boolean;
  error: string | null;
  countedAt: string;
}

/** The per-file ceiling for a header read. A region file above it is skipped. */
export const REGION_READ_CEILING_BYTES = 24 * 1024 * 1024;

/** Anvil header: 1024 four-byte location entries in the first 4 KiB. */
const LOCATION_TABLE_BYTES = 4096;

function countOccupiedSlots(base64: string): number {
  // Only the first 4 KiB matter, and base64 encodes three bytes per four
  // characters, so the header lives in the first 5464 characters.
  const headerChars = Math.min(base64.length, Math.ceil(LOCATION_TABLE_BYTES / 3) * 4);
  const aligned = headerChars - (headerChars % 4);
  if (aligned <= 0) return 0;
  const binary = atob(base64.slice(0, aligned));
  const usable = Math.min(binary.length, LOCATION_TABLE_BYTES);
  let occupied = 0;
  for (let offset = 0; offset + 4 <= usable; offset += 4) {
    const sectorCount = binary.charCodeAt(offset + 3) & 0xff;
    const sectorOffset =
      ((binary.charCodeAt(offset) & 0xff) << 16) |
      ((binary.charCodeAt(offset + 1) & 0xff) << 8) |
      (binary.charCodeAt(offset + 2) & 0xff);
    if (sectorCount > 0 && sectorOffset > 1) occupied += 1;
  }
  return occupied;
}

/**
 * Counts saved chunks by reading each region file's own location table.
 *
 * This is a real count of what is on disk, not an estimate: a slot is counted
 * only when the header says a chunk occupies at least one sector at a plausible
 * offset. It is deliberately an explicit action rather than part of the status
 * poll, because it reads every region file.
 */
export async function countChunks(
  ctx: AppContext,
  files: RegionFile[],
  onProgress: (done: number, total: number) => void,
  isCancelled: () => boolean
): Promise<ChunkCount> {
  const result: ChunkCount = {
    chunks: 0,
    filesRead: 0,
    filesSkipped: 0,
    skippedNames: [],
    perDimension: [],
    cancelled: false,
    error: null,
    countedAt: new Date().toISOString()
  };
  const buckets = new Map<string, { dimension: string; kind: RegionFile['kind']; chunks: number }>();

  let index = 0;
  for (const file of files) {
    if (isCancelled()) {
      result.cancelled = true;
      break;
    }
    index += 1;
    onProgress(index, files.length);

    if (file.sizeBytes > REGION_READ_CEILING_BYTES) {
      result.filesSkipped += 1;
      result.skippedNames.push(`${file.dimension}/${file.kind}/${file.name}`);
      continue;
    }
    const read = await ctx.studio.fs.readBase64(file.path, REGION_READ_CEILING_BYTES);
    if (!read.ok) {
      result.filesSkipped += 1;
      result.skippedNames.push(`${file.dimension}/${file.kind}/${file.name}`);
      if (result.error === null) result.error = read.error;
      continue;
    }
    let occupied = 0;
    try {
      occupied = countOccupiedSlots(read.value);
    } catch {
      result.filesSkipped += 1;
      result.skippedNames.push(`${file.dimension}/${file.kind}/${file.name}`);
      continue;
    }
    result.filesRead += 1;
    result.chunks += occupied;
    const key = `${file.dimension}|${file.kind}`;
    const bucket = buckets.get(key) ?? { dimension: file.dimension, kind: file.kind, chunks: 0 };
    bucket.chunks += occupied;
    buckets.set(key, bucket);
  }

  result.perDimension = [...buckets.values()].sort(
    (a, b) => a.dimension.localeCompare(b.dimension) || a.kind.localeCompare(b.kind)
  );
  result.countedAt = new Date().toISOString();
  return result;
}

/* ------------------------------------------------------------------ */
/* The overview map's own status file                                  */
/* ------------------------------------------------------------------ */

export interface OverviewStatus {
  available: boolean;
  player: { x: number; y: number; z: number } | null;
  dimension: string | null;
  /** Milliseconds since epoch, as the jar wrote it. */
  updatedAt: number | null;
  tileCount: number;
  error: string | null;
}

export function emptyOverview(): OverviewStatus {
  return { available: false, player: null, dimension: null, updatedAt: null, tileCount: 0, error: null };
}

/**
 * Reads `<output>/overview/meta.json`, which the jar writes while it renders
 * the overview map. This is where the live player position genuinely comes
 * from; with map rendering off, the file does not exist and the surface says so
 * rather than showing a position it does not have.
 */
export async function readOverview(ctx: AppContext, root: string): Promise<OverviewStatus> {
  const status = emptyOverview();
  if (root.trim() === '') return status;
  const separator = separatorFor(ctx.studio.info.platform);
  const path = joinPath(separator, root, 'overview', 'meta.json');

  const stat = await ctx.studio.fs.stat(path);
  if (!stat.ok || !stat.value.exists) return status;

  const read = await ctx.studio.fs.readText(path, 8 * 1024 * 1024);
  if (!read.ok) {
    status.error = read.error;
    return status;
  }
  try {
    const parsed = JSON.parse(read.value) as {
      player?: { x?: number; y?: number; z?: number } | null;
      currentDimension?: string | null;
      updated?: number;
      tiles?: Record<string, Record<string, unknown[]>>;
    };
    status.available = true;
    if (
      parsed.player &&
      typeof parsed.player.x === 'number' &&
      typeof parsed.player.y === 'number' &&
      typeof parsed.player.z === 'number'
    ) {
      status.player = { x: parsed.player.x, y: parsed.player.y, z: parsed.player.z };
    }
    status.dimension = typeof parsed.currentDimension === 'string' ? parsed.currentDimension : null;
    status.updatedAt = typeof parsed.updated === 'number' ? parsed.updated : null;
    let tiles = 0;
    for (const modes of Object.values(parsed.tiles ?? {})) {
      for (const list of Object.values(modes)) {
        if (Array.isArray(list)) tiles += list.length;
      }
    }
    status.tileCount = tiles;
  } catch (error) {
    status.error = error instanceof Error ? error.message : String(error);
  }
  return status;
}

/* ------------------------------------------------------------------ */
/* Supported game versions                                             */
/* ------------------------------------------------------------------ */

export interface ProtocolRow {
  protocol: number;
  version: string;
  dataVersion: number;
}

/**
 * The protocol table the Java core ships in
 * `src/main/resources/protocol-versions.json`.
 *
 * The downloader picks its protocol from the client's own handshake, so there
 * is no version flag to set and this list is reference material rather than a
 * control. The live status shows whichever version the running session actually
 * reported.
 */
export const SUPPORTED_PROTOCOLS: ProtocolRow[] = [
  { protocol: 47, version: '1.8', dataVersion: 100 },
  { protocol: 107, version: '1.9', dataVersion: 169 },
  { protocol: 210, version: '1.10', dataVersion: 510 },
  { protocol: 315, version: '1.11', dataVersion: 819 },
  { protocol: 317, version: '1.12.2', dataVersion: 1132 },
  { protocol: 341, version: '1.13.2', dataVersion: 1444 },
  { protocol: 440, version: '1.14.4', dataVersion: 1901 },
  { protocol: 550, version: '1.15.2', dataVersion: 2200 },
  { protocol: 701, version: '1.16.2', dataVersion: 2578 },
  { protocol: 755, version: '1.17', dataVersion: 2724 },
  { protocol: 757, version: '1.18', dataVersion: 2860 },
  { protocol: 759, version: '1.19', dataVersion: 3105 },
  { protocol: 761, version: '1.19.3', dataVersion: 3218 },
  { protocol: 762, version: '1.19.4', dataVersion: 3337 },
  { protocol: 763, version: '1.20', dataVersion: 3463 },
  { protocol: 764, version: '1.20.2', dataVersion: 3578 },
  { protocol: 765, version: '1.20.4', dataVersion: 3700 },
  { protocol: 766, version: '1.20.6', dataVersion: 3839 },
  { protocol: 767, version: '1.21', dataVersion: 3953 },
  { protocol: 768, version: '1.21.3', dataVersion: 4082 },
  { protocol: 769, version: '1.21.4', dataVersion: 4189 },
  { protocol: 770, version: '1.21.5', dataVersion: 4325 },
  { protocol: 771, version: '1.21.6', dataVersion: 4435 },
  { protocol: 772, version: '1.21.8', dataVersion: 4440 },
  { protocol: 773, version: '1.21.9', dataVersion: 4554 },
  { protocol: 774, version: '1.21.11', dataVersion: 4671 },
  { protocol: 775, version: '26.1', dataVersion: 4786 }
];

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const rounded = unit === 0 ? String(Math.round(value)) : value.toFixed(value >= 100 ? 0 : 1);
  return `${rounded} ${units[unit]}`;
}

export function formatDuration(milliseconds: number): string {
  const total = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat().format(value);
}

export function formatTimestamp(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
}
