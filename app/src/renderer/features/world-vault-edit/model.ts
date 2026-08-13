/**
 * Types, ids, coordinate math and the pure helpers the panel and worker
 * client both need. Nothing here touches the DOM or the privileged bridge,
 * so the coordinate math — the part where being wrong is silent — is testable
 * on its own.
 */

/* ------------------------------------------------------------------ */
/* Identifiers                                                         */
/* ------------------------------------------------------------------ */

export const FEATURE_ID = 'worldvaultedit';
export const TAB_ID = 'worldvaultedit.grid';

export const GRID_ID = 'worldvaultedit-grid';
export const SELECTION_ID = 'worldvaultedit-selection';
export const DESTINATION_ID = 'worldvaultedit-destination';
export const LOG_ID = 'worldvaultedit-log';
export const STATUS_ID = 'worldvaultedit-status';

export const SETTING_WORLD_DIRECTORY = 'worldvaultedit.worldDirectory';
export const SETTING_DIMENSION = 'worldvaultedit.dimension';
export const SETTING_CUSTOM_DIMENSION_PATH = 'worldvaultedit.customDimensionPath';

/** Not a control: the persisted edit log this feature's own panel shows. */
export const STORE_EDIT_LOG = 'worldvaultedit.log';
export const STORE_GRID_ORIGIN = 'worldvaultedit.gridOrigin';

/* ------------------------------------------------------------------ */
/* Bounds                                                              */
/* ------------------------------------------------------------------ */

/** Chunks per region file edge, fixed by the Anvil format. */
export const REGION_CHUNKS = 32;

/** One page of the selection grid: a square of chunks, shown at once. */
export const GRID_PAGE_CHUNKS = 16;

/**
 * A selection larger than this is refused with a plain reason rather than
 * handed to the worker: bulk operations stay bounded and reviewable, and a
 * selection this size is already four full region files' worth of chunks.
 */
export const MAX_SELECTION_CHUNKS = 4096;

/** How many affected-item lines a confirmation dialog lists before folding
 *  the rest into a single "and N more" line. */
export const MAX_CONFIRM_ITEMS = 40;

export const MAX_LOG_ENTRIES = 500;

/**
 * The privileged bridge's `readBase64` reads the WHOLE file (refusing above
 * this many bytes) rather than a byte range, so reading a region file's
 * header means reading the whole thing. Region files are typically a few
 * megabytes; this bound is generous without being unbounded.
 */
export const MAX_REGION_READ_BYTES = 16 * 1024 * 1024;

/* ------------------------------------------------------------------ */
/* Dimensions                                                          */
/* ------------------------------------------------------------------ */

export type DimensionId = 'overworld' | 'nether' | 'end' | 'custom';

export interface DimensionOption {
  id: DimensionId;
  /** Path segment under the world folder; '' for the overworld (world root). */
  subpath: string;
  labelKey: string;
}

export const DIMENSION_OPTIONS: DimensionOption[] = [
  { id: 'overworld', subpath: '', labelKey: 'worldvaultedit.dimension.overworld' },
  { id: 'nether', subpath: 'DIM-1', labelKey: 'worldvaultedit.dimension.nether' },
  { id: 'end', subpath: 'DIM1', labelKey: 'worldvaultedit.dimension.end' },
  { id: 'custom', subpath: '', labelKey: 'worldvaultedit.dimension.custom' }
];

export function isDimensionId(value: unknown): value is DimensionId {
  return value === 'overworld' || value === 'nether' || value === 'end' || value === 'custom';
}

/** The dimension subpath actually in effect, honouring the custom override. */
export function dimensionSubpath(dimension: DimensionId, customPath: string): string {
  if (dimension === 'custom') return sanitizeSubpath(customPath);
  return DIMENSION_OPTIONS.find((option) => option.id === dimension)?.subpath ?? '';
}

/**
 * Keeps a user-typed custom dimension path inside the world folder. No `..`
 * segment, no leading slash treated as a drive root — this becomes part of a
 * file path handed to the privileged bridge, so it is validated the same way
 * the map feature validates a dimension name it reads off disk.
 */
export function sanitizeSubpath(value: string): string {
  const trimmed = value.trim().replace(/^[\\/]+/, '').replace(/[\\/]+$/, '');
  if (trimmed === '') return '';
  const segments = trimmed.split(/[\\/]+/);
  if (segments.some((segment) => segment === '..' || segment === '.' || segment === '')) return '';
  return segments.join('/');
}

/* ------------------------------------------------------------------ */
/* Coordinate math                                                     */
/* ------------------------------------------------------------------ */

export interface ChunkPos {
  cx: number;
  cz: number;
}

export function chunkKey(cx: number, cz: number): string {
  return `${String(cx)},${String(cz)}`;
}

export function parseChunkKey(key: string): ChunkPos | null {
  const match = /^(-?\d+),(-?\d+)$/.exec(key);
  if (!match) return null;
  return { cx: Number(match[1]), cz: Number(match[2]) };
}

export function chunkToRegion(cx: number, cz: number): { rx: number; rz: number } {
  return { rx: Math.floor(cx / REGION_CHUNKS), rz: Math.floor(cz / REGION_CHUNKS) };
}

export function mod32(n: number): number {
  return ((n % REGION_CHUNKS) + REGION_CHUNKS) % REGION_CHUNKS;
}

export function localChunkIndex(cx: number, cz: number): number {
  return mod32(cx) + mod32(cz) * REGION_CHUNKS;
}

export function regionFileName(rx: number, rz: number): string {
  return `r.${String(rx)}.${String(rz)}.mca`;
}

/* ------------------------------------------------------------------ */
/* Paths                                                               */
/* ------------------------------------------------------------------ */

export function pathSeparator(base: string): string {
  if (base.includes('\\')) return '\\';
  if (base.includes('/')) return '/';
  return window.studio.info.platform === 'win32' ? '\\' : '/';
}

export function joinPath(base: string, ...parts: string[]): string {
  const separator = pathSeparator(base);
  const trimmed = base.replace(/[\\/]+$/, '');
  const cleanParts = parts.filter((part) => part !== '');
  return [trimmed, ...cleanParts].join(separator);
}

/** Path relative to the world folder, using forward slashes (the form `requestRegionAccess` expects). */
export function regionRelativePath(dimSubpath: string, kind: 'region' | 'entities', rx: number, rz: number): string {
  const parts = [dimSubpath, kind, regionFileName(rx, rz)].filter((part) => part !== '');
  return parts.join('/');
}

export function regionAbsolutePath(worldDir: string, dimSubpath: string, kind: 'region' | 'entities', rx: number, rz: number): string {
  return joinPath(worldDir, ...[dimSubpath, kind, regionFileName(rx, rz)].filter((part) => part !== ''));
}

/* ------------------------------------------------------------------ */
/* Region occupancy (header-only)                                      */
/* ------------------------------------------------------------------ */

export interface RegionOccupancy {
  rx: number;
  rz: number;
  /** True at `localIndex` when that chunk slot has data. Length 1024, or empty when unread. */
  occupied: boolean[];
}

export function emptyOccupancy(rx: number, rz: number): RegionOccupancy {
  return { rx, rz, occupied: new Array<boolean>(1024).fill(false) };
}

/** Reads just the 4096-byte location table's size bytes; ignores everything after. */
export function parseRegionOccupancy(rx: number, rz: number, bytes: Uint8Array): RegionOccupancy {
  const occupied = new Array<boolean>(1024).fill(false);
  if (bytes.length < 4096) return { rx, rz, occupied };
  for (let i = 0; i < 1024; i += 1) occupied[i] = bytes[i * 4 + 3] > 0;
  return { rx, rz, occupied };
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

/* ------------------------------------------------------------------ */
/* Selection                                                           */
/* ------------------------------------------------------------------ */

export interface SelectionBounds {
  minCx: number;
  maxCx: number;
  minCz: number;
  maxCz: number;
}

export function boundsOf(selection: ReadonlySet<string>): SelectionBounds | null {
  let minCx = Infinity;
  let maxCx = -Infinity;
  let minCz = Infinity;
  let maxCz = -Infinity;
  let any = false;
  for (const key of selection) {
    const pos = parseChunkKey(key);
    if (!pos) continue;
    any = true;
    if (pos.cx < minCx) minCx = pos.cx;
    if (pos.cx > maxCx) maxCx = pos.cx;
    if (pos.cz < minCz) minCz = pos.cz;
    if (pos.cz > maxCz) maxCz = pos.cz;
  }
  return any ? { minCx, maxCx, minCz, maxCz } : null;
}

export function rectangleKeys(a: ChunkPos, b: ChunkPos): string[] {
  const minCx = Math.min(a.cx, b.cx);
  const maxCx = Math.max(a.cx, b.cx);
  const minCz = Math.min(a.cz, b.cz);
  const maxCz = Math.max(a.cz, b.cz);
  const keys: string[] = [];
  for (let cz = minCz; cz <= maxCz; cz += 1) {
    for (let cx = minCx; cx <= maxCx; cx += 1) keys.push(chunkKey(cx, cz));
  }
  return keys;
}

export function selectionToChunks(selection: ReadonlySet<string>): ChunkPos[] {
  const out: ChunkPos[] = [];
  for (const key of selection) {
    const pos = parseChunkKey(key);
    if (pos) out.push(pos);
  }
  return out.sort((a, b) => a.cz - b.cz || a.cx - b.cx);
}

/* ------------------------------------------------------------------ */
/* Edit log                                                            */
/* ------------------------------------------------------------------ */

export type EditKind = 'copy' | 'remove';

export interface EditLogEntry {
  id: string;
  kind: EditKind;
  dimension: DimensionId;
  dimensionSubpath: string;
  /** For 'copy': the exact source and destination chunks, paired in order. */
  pairs: Array<{ source: ChunkPos; destination: ChunkPos }>;
  /** For 'remove': the exact chunks removed. */
  removed: ChunkPos[];
  outcome: 'ok' | 'error';
  detail: string;
  commitId: string | null;
  createdAt: string;
}

let logCounter = 0;
export function newLogId(): string {
  logCounter += 1;
  return `wve-${Date.now().toString(36)}-${logCounter.toString(36)}`;
}

export function normaliseChunkPos(raw: unknown): ChunkPos | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const record = raw as Record<string, unknown>;
  const cx = Number(record.cx);
  const cz = Number(record.cz);
  if (!Number.isInteger(cx) || !Number.isInteger(cz)) return null;
  return { cx, cz };
}

export function normaliseLogEntry(raw: unknown): EditLogEntry | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const record = raw as Record<string, unknown>;
  if (record.kind !== 'copy' && record.kind !== 'remove') return null;
  if (typeof record.id !== 'string' || record.id === '') return null;
  const pairs: Array<{ source: ChunkPos; destination: ChunkPos }> = [];
  if (Array.isArray(record.pairs)) {
    for (const item of record.pairs) {
      if (typeof item !== 'object' || item === null) continue;
      const pair = item as Record<string, unknown>;
      const source = normaliseChunkPos(pair.source);
      const destination = normaliseChunkPos(pair.destination);
      if (source && destination) pairs.push({ source, destination });
    }
  }
  const removed: ChunkPos[] = [];
  if (Array.isArray(record.removed)) {
    for (const item of record.removed) {
      const pos = normaliseChunkPos(item);
      if (pos) removed.push(pos);
    }
  }
  return {
    id: record.id,
    kind: record.kind,
    dimension: isDimensionId(record.dimension) ? record.dimension : 'overworld',
    dimensionSubpath: typeof record.dimensionSubpath === 'string' ? record.dimensionSubpath : '',
    pairs,
    removed,
    outcome: record.outcome === 'error' ? 'error' : 'ok',
    detail: typeof record.detail === 'string' ? record.detail : '',
    commitId: typeof record.commitId === 'string' ? record.commitId : null,
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : new Date().toISOString()
  };
}

export function normaliseLog(raw: unknown): EditLogEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: EditLogEntry[] = [];
  for (const item of raw) {
    const entry = normaliseLogEntry(item);
    if (entry) out.push(entry);
  }
  return out.slice(0, MAX_LOG_ENTRIES);
}

export function logEntryToRecord(entry: EditLogEntry): Record<string, unknown> {
  return {
    id: entry.id,
    kind: entry.kind,
    dimension: entry.dimension,
    dimensionSubpath: entry.dimensionSubpath,
    pairs: entry.pairs,
    removed: entry.removed,
    outcome: entry.outcome,
    detail: entry.detail,
    commitId: entry.commitId,
    createdAt: entry.createdAt
  };
}

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

export function formatChunk(pos: ChunkPos): string {
  return `(${String(pos.cx)}, ${String(pos.cz)})`;
}

export function formatNumber(value: number): string {
  return Math.round(value).toLocaleString('en-US');
}

export function formatTimestamp(iso: string): string {
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return iso;
  return new Date(parsed).toISOString().replace('T', ' ').replace(/\.\d+Z$/, 'Z');
}
