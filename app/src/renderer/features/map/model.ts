/**
 * Shared model for the live map viewer.
 *
 * Types, stable identifiers, bounds and the pure helpers that both the tile
 * source and the surface need. Nothing here touches the DOM, so it can be
 * reasoned about — and corrected — without opening a window.
 */

/* ------------------------------------------------------------------ */
/* Identifiers                                                         */
/* ------------------------------------------------------------------ */

export const FEATURE_ID = 'map';

export const TAB_ID = 'map.viewer';

/** Element ids used as teleport targets from the command palette. */
export const CANVAS_ID = 'map-canvas';
export const LAYERS_ID = 'map-layers';
export const JUMP_ID = 'map-jump';
export const MARKERS_ID = 'map-markers';
export const READOUT_ID = 'map-readout';
export const STATUS_ID = 'map-status';

/* Settings ---------------------------------------------------------- */

export const SETTING_DIRECTORY = 'map.overviewDirectory';
export const SETTING_AUTO_REFRESH = 'map.autoRefresh';
export const SETTING_REFRESH_SECONDS = 'map.refreshSeconds';
export const SETTING_DEFAULT_MODE = 'map.defaultMode';
export const SETTING_FOLLOW_PLAYER = 'map.followPlayer';
export const SETTING_LAYER_REGION_GRID = 'map.layer.regionGrid';
export const SETTING_LAYER_PLAYER = 'map.layer.player';
export const SETTING_LAYER_MARKERS = 'map.layer.markers';
export const SETTING_LAYER_CROSSHAIR = 'map.layer.crosshair';
export const SETTING_SMOOTHING = 'map.smoothing';
export const SETTING_TILE_CACHE = 'map.tileCacheSize';
export const SETTING_REVEAL_FOLDER = 'map.revealFolder';

/** Not a control: the stored marker list and the remembered camera. */
export const STORE_MARKERS = 'map.markers';
export const STORE_CAMERA = 'map.camera';

/* ------------------------------------------------------------------ */
/* Bounds                                                              */
/* ------------------------------------------------------------------ */

/** Minecraft's own horizontal world border, in blocks. */
export const WORLD_MIN = -30_000_000;
export const WORLD_MAX = 30_000_000;
/** The build limit range that covers every version this downloader supports. */
export const HEIGHT_MIN = -2048;
export const HEIGHT_MAX = 2048;

export const MIN_SCALE = 0.02;
export const MAX_SCALE = 16;
export const DEFAULT_SCALE = 0.5;

export const MIN_REFRESH_SECONDS = 2;
export const MAX_REFRESH_SECONDS = 120;
export const DEFAULT_REFRESH_SECONDS = 3;

export const MIN_TILE_CACHE = 16;
export const MAX_TILE_CACHE = 512;
export const DEFAULT_TILE_CACHE = 96;

/** A marker name longer than this is refused rather than silently truncated. */
export const MAX_MARKER_NAME = 120;
export const MAX_MARKER_NOTE = 512;
/** Markers live in the settings file, so the list is deliberately bounded. */
export const MAX_MARKERS = 2000;

/** Hard ceiling on one tile read, well above a 512x512 PNG of terrain. */
export const MAX_TILE_BYTES = 4 * 1024 * 1024;
/** Hard ceiling on the index read. The real file is a few kilobytes. */
export const MAX_META_BYTES = 8 * 1024 * 1024;

/* ------------------------------------------------------------------ */
/* The on-disk index                                                   */
/* ------------------------------------------------------------------ */

export type RenderMode = 'normal' | 'caves';

export const RENDER_MODES: RenderMode[] = ['normal', 'caves'];

export interface PlayerPosition {
  x: number;
  y: number;
  z: number;
}

/** One region tile's coordinates, in region units (32 chunks each). */
export interface TileRef {
  rx: number;
  rz: number;
}

export interface OverviewMeta {
  /** Pixels along one edge of a region tile. The renderer writes 512. */
  regionPx: number;
  /** Pixels along one edge of a chunk. The renderer writes 16. */
  chunkPx: number;
  /** Epoch milliseconds of the last flush. Used as the tile cache version. */
  updated: number;
  /** Sanitised dimension the player is currently in, or null. */
  currentDimension: string | null;
  player: PlayerPosition | null;
  /** dimension -> mode -> tiles. */
  tiles: Record<string, Partial<Record<RenderMode, TileRef[]>>>;
}

export function emptyMeta(): OverviewMeta {
  return { regionPx: 512, chunkPx: 16, updated: 0, currentDimension: null, player: null, tiles: {} };
}

/**
 * Parses the renderer's index.
 *
 * The file is written by hand-rolled string concatenation on the Java side, so
 * it is treated as untrusted input here: every field is checked, every
 * dimension name is validated against the same character class the path guard
 * uses, and anything unrecognised is dropped rather than propagated into a file
 * path.
 */
export function parseMeta(source: string): { meta: OverviewMeta | null; error: string | null } {
  let raw: unknown;
  try {
    raw = JSON.parse(source);
  } catch (error) {
    return { meta: null, error: error instanceof Error ? error.message : 'The index is not valid JSON.' };
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { meta: null, error: 'The index is not a JSON object.' };
  }
  const record = raw as Record<string, unknown>;
  const meta = emptyMeta();

  if (typeof record.regionPx === 'number' && record.regionPx > 0 && record.regionPx <= 4096) {
    meta.regionPx = Math.floor(record.regionPx);
  }
  if (typeof record.chunkPx === 'number' && record.chunkPx > 0 && record.chunkPx <= 512) {
    meta.chunkPx = Math.floor(record.chunkPx);
  }
  if (typeof record.updated === 'number' && Number.isFinite(record.updated)) {
    meta.updated = Math.floor(record.updated);
  }
  if (typeof record.currentDimension === 'string' && isSafeDimension(record.currentDimension)) {
    meta.currentDimension = record.currentDimension;
  }
  const player = record.player;
  if (typeof player === 'object' && player !== null) {
    const point = player as Record<string, unknown>;
    if (typeof point.x === 'number' && typeof point.y === 'number' && typeof point.z === 'number') {
      meta.player = { x: point.x, y: point.y, z: point.z };
    }
  }

  const tiles = record.tiles;
  if (typeof tiles === 'object' && tiles !== null && !Array.isArray(tiles)) {
    for (const [dimension, byMode] of Object.entries(tiles as Record<string, unknown>)) {
      if (!isSafeDimension(dimension)) continue;
      if (typeof byMode !== 'object' || byMode === null || Array.isArray(byMode)) continue;
      const modes: Partial<Record<RenderMode, TileRef[]>> = {};
      for (const [modeName, list] of Object.entries(byMode as Record<string, unknown>)) {
        if (!isRenderMode(modeName)) continue;
        if (!Array.isArray(list)) continue;
        const refs: TileRef[] = [];
        for (const item of list) {
          if (!Array.isArray(item) || item.length < 2) continue;
          const rx = Number(item[0]);
          const rz = Number(item[1]);
          if (!Number.isInteger(rx) || !Number.isInteger(rz)) continue;
          refs.push({ rx, rz });
        }
        modes[modeName] = refs;
      }
      meta.tiles[dimension] = modes;
    }
  }

  return { meta, error: null };
}

export function isRenderMode(value: string): value is RenderMode {
  return value === 'normal' || value === 'caves';
}

/**
 * The exact character class the renderer's own path sanitiser produces.
 *
 * A dimension name reaches a file path, so anything outside this set is refused
 * rather than escaped: refusing is checkable, escaping is a guess.
 */
export function isSafeDimension(value: string): boolean {
  return value.length > 0 && value.length <= 128 && /^[A-Za-z0-9._-]+$/.test(value);
}

/** `minecraft_overworld` reads as `Overworld`; the raw id is kept beside it. */
export function prettyDimension(id: string): string {
  const stripped = id.startsWith('minecraft_') ? id.slice('minecraft_'.length) : id;
  const spaced = stripped.replace(/_/g, ' ').trim();
  if (spaced === '') return id;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function tileCount(meta: OverviewMeta): number {
  let total = 0;
  for (const byMode of Object.values(meta.tiles)) {
    for (const refs of Object.values(byMode)) total += refs?.length ?? 0;
  }
  return total;
}

export function dimensionsOf(meta: OverviewMeta): string[] {
  return Object.keys(meta.tiles).sort((a, b) => a.localeCompare(b));
}

export function tilesFor(meta: OverviewMeta, dimension: string, mode: RenderMode): TileRef[] {
  return meta.tiles[dimension]?.[mode] ?? [];
}

/* ------------------------------------------------------------------ */
/* Paths                                                               */
/* ------------------------------------------------------------------ */

/**
 * The separator already in use in a path, falling back to the platform's.
 *
 * Joining a Windows path with a forward slash works for the file system but
 * reads as a mistake when the path is shown to the user, and the path is shown
 * to the user in every one of this feature's error states.
 */
export function pathSeparator(base: string): string {
  if (base.includes('\\')) return '\\';
  if (base.includes('/')) return '/';
  return window.studio.info.platform === 'win32' ? '\\' : '/';
}

export function joinPath(base: string, ...parts: string[]): string {
  const separator = pathSeparator(base);
  const trimmed = base.replace(/[\\/]+$/, '');
  return [trimmed, ...parts].join(separator);
}

export function tilePath(overviewDir: string, dimension: string, mode: RenderMode, rx: number, rz: number): string {
  return joinPath(overviewDir, dimension, mode, `r.${rx}.${rz}.png`);
}

/* ------------------------------------------------------------------ */
/* Markers                                                             */
/* ------------------------------------------------------------------ */

export const MARKER_COLOURS = ['primary', 'secondary', 'tertiary', 'error', 'success', 'warning'] as const;

export type MarkerColour = (typeof MARKER_COLOURS)[number];

export function isMarkerColour(value: unknown): value is MarkerColour {
  return typeof value === 'string' && (MARKER_COLOURS as readonly string[]).includes(value);
}

export interface MapMarker {
  id: string;
  name: string;
  dimension: string;
  x: number;
  /** The height the marker was placed at. Recorded, never used for the plan view. */
  y: number;
  z: number;
  colour: MarkerColour;
  visible: boolean;
  note: string;
  /** ISO-8601. */
  createdAt: string;
}

let markerCounter = 0;

export function newMarkerId(): string {
  markerCounter += 1;
  return `mk-${Date.now().toString(36)}-${markerCounter.toString(36)}`;
}

/**
 * Validates and repairs one stored marker.
 *
 * Returns null when the record cannot be trusted at all. A marker that survives
 * comes back with every field inside its declared bound, so nothing downstream
 * has to re-check it.
 */
export function normaliseMarker(raw: unknown): MapMarker | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const x = Number(record.x);
  const z = Number(record.z);
  if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
  const dimension = typeof record.dimension === 'string' && isSafeDimension(record.dimension) ? record.dimension : '';
  if (dimension === '') return null;
  const name = typeof record.name === 'string' ? record.name.slice(0, MAX_MARKER_NAME) : '';
  const note = typeof record.note === 'string' ? record.note.slice(0, MAX_MARKER_NOTE) : '';
  const y = Number(record.y);
  return {
    id: typeof record.id === 'string' && record.id !== '' ? record.id : newMarkerId(),
    name,
    dimension,
    x: clamp(Math.round(x), WORLD_MIN, WORLD_MAX),
    y: Number.isFinite(y) ? clamp(Math.round(y), HEIGHT_MIN, HEIGHT_MAX) : 64,
    z: clamp(Math.round(z), WORLD_MIN, WORLD_MAX),
    colour: isMarkerColour(record.colour) ? record.colour : 'primary',
    visible: record.visible !== false,
    note,
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : new Date().toISOString()
  };
}

export function normaliseMarkers(raw: unknown): MapMarker[] {
  if (!Array.isArray(raw)) return [];
  const out: MapMarker[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (out.length >= MAX_MARKERS) break;
    const marker = normaliseMarker(item);
    if (!marker) continue;
    if (seen.has(marker.id)) marker.id = newMarkerId();
    seen.add(marker.id);
    out.push(marker);
  }
  return out;
}

/** The flat record shape an export writes. Exports never carry a live object. */
export function markerToRecord(marker: MapMarker): Record<string, unknown> {
  return {
    id: marker.id,
    name: marker.name,
    dimension: marker.dimension,
    x: marker.x,
    y: marker.y,
    z: marker.z,
    colour: marker.colour,
    visible: marker.visible,
    note: marker.note,
    createdAt: marker.createdAt
  };
}

/* ------------------------------------------------------------------ */
/* Camera                                                              */
/* ------------------------------------------------------------------ */

export interface CameraState {
  /** World block coordinates at the centre of the viewport. */
  x: number;
  z: number;
  /** Screen pixels per world block. */
  scale: number;
  dimension: string;
  mode: RenderMode;
}

export function defaultCamera(): CameraState {
  return { x: 0, z: 0, scale: DEFAULT_SCALE, dimension: '', mode: 'normal' };
}

export function normaliseCamera(raw: unknown): CameraState | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const x = Number(record.x);
  const z = Number(record.z);
  const scale = Number(record.scale);
  if (!Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(scale)) return null;
  const dimension = typeof record.dimension === 'string' && isSafeDimension(record.dimension) ? record.dimension : '';
  const mode = typeof record.mode === 'string' && isRenderMode(record.mode) ? record.mode : 'normal';
  return {
    x: clamp(x, WORLD_MIN, WORLD_MAX),
    z: clamp(z, WORLD_MIN, WORLD_MAX),
    scale: clamp(scale, MIN_SCALE, MAX_SCALE),
    dimension,
    mode
  };
}

/* ------------------------------------------------------------------ */
/* Small numeric helpers                                               */
/* ------------------------------------------------------------------ */

export function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export function floorDiv(value: number, divisor: number): number {
  return Math.floor(value / divisor);
}

/** The block distance a scale bar should span so it lands near `targetPx`. */
export function niceBlockSpan(targetPx: number, scale: number): number {
  const raw = targetPx / scale;
  if (!Number.isFinite(raw) || raw <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  for (const step of [1, 2, 5, 10]) {
    const candidate = step * magnitude;
    if (candidate >= raw) return candidate;
  }
  return 10 * magnitude;
}

/** `12345` reads as `12,345`, in every language mode. Numbers are facts. */
export function formatNumber(value: number): string {
  return Math.round(value).toLocaleString('en-US');
}

export function formatCoordinate(value: number): string {
  return formatNumber(value);
}

export function formatTimestamp(epochMillis: number): string {
  if (!Number.isFinite(epochMillis) || epochMillis <= 0) return '—';
  return new Date(epochMillis).toISOString().replace('T', ' ').replace(/\.\d+Z$/, 'Z');
}
