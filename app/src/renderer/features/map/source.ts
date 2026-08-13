/**
 * The local tile source.
 *
 * Everything this feature draws comes off the local disk through the privileged
 * file bridge: the renderer writes PNG region tiles and a small JSON index, and
 * this module reads them back. There is no map service, no tile server, no CDN
 * and no HTTP request of any kind — deliberately, because a map of somebody's
 * private world has no business leaving their machine, and because the whole
 * point of the headless renderer is that it works with the network unplugged.
 */

import {
  MAX_META_BYTES,
  MAX_TILE_BYTES,
  type OverviewMeta,
  type RenderMode,
  emptyMeta,
  joinPath,
  parseMeta,
  tileCount,
  tilePath
} from './model';

/** Why the index could not be read, in the words the surface shows. */
export type SourceStatus =
  | { kind: 'unconfigured' }
  | { kind: 'missing-directory'; directory: string }
  | { kind: 'missing-index'; directory: string; looked: string[] }
  | { kind: 'unreadable'; path: string; error: string }
  | { kind: 'invalid'; path: string; error: string }
  | { kind: 'empty'; path: string; meta: OverviewMeta }
  | { kind: 'ready'; path: string; meta: OverviewMeta };

export interface RefreshOutcome {
  status: SourceStatus;
  /** True when this refresh produced a different index than the last one. */
  changed: boolean;
}

interface CachedTile {
  image: HTMLImageElement | null;
  /** The index version this entry was fetched at. */
  version: number;
  /** Set when the read failed, so a missing tile is not retried every frame. */
  failed: boolean;
  lastUsed: number;
}

/**
 * Reads the index and the tiles, and caches decoded tiles with a bounded LRU.
 *
 * The cache is keyed by dimension, mode, coordinates AND index version, so a
 * re-rendered tile is re-read rather than served stale — the renderer rewrites
 * a tile in place, and a cache keyed only by coordinates would show a world
 * that stopped updating while claiming to be live.
 */
export class TileSource {
  private directory = '';

  /** The resolved directory that actually contains `meta.json`. */
  private overviewDirectory = '';

  private meta: OverviewMeta = emptyMeta();

  private status: SourceStatus = { kind: 'unconfigured' };

  private readonly cache = new Map<string, CachedTile>();

  private readonly pending = new Set<string>();

  private cacheLimit = 96;

  private clock = 0;

  private disposed = false;

  constructor(private readonly onTileReady: () => void) {}

  dispose(): void {
    this.disposed = true;
    this.cache.clear();
    this.pending.clear();
  }

  currentStatus(): SourceStatus {
    return this.status;
  }

  currentMeta(): OverviewMeta {
    return this.meta;
  }

  /** The directory the tiles were actually found in, for the status line. */
  resolvedDirectory(): string {
    return this.overviewDirectory;
  }

  setCacheLimit(limit: number): void {
    this.cacheLimit = Math.max(8, Math.floor(limit));
    this.evict();
  }

  setDirectory(directory: string): void {
    const next = directory.trim();
    if (next === this.directory) return;
    this.directory = next;
    this.overviewDirectory = '';
    this.meta = emptyMeta();
    this.cache.clear();
    this.pending.clear();
    this.status = next === '' ? { kind: 'unconfigured' } : { kind: 'missing-directory', directory: next };
  }

  currentDirectory(): string {
    return this.directory;
  }

  /**
   * Re-reads the index.
   *
   * The user may point this at the world output folder or at the `overview`
   * folder inside it — both are reasonable readings of "where the map is" — so
   * both are tried, and the honest failure names both paths that were looked at
   * rather than the one the code happened to try first.
   */
  async refresh(): Promise<RefreshOutcome> {
    if (this.directory === '') {
      const changed = this.status.kind !== 'unconfigured';
      this.status = { kind: 'unconfigured' };
      return { status: this.status, changed };
    }

    const previousVersion = this.meta.updated;
    const previousKind = this.status.kind;

    const directoryStat = await window.studio.fs.stat(this.directory);
    if (!directoryStat.ok || !directoryStat.value.exists || !directoryStat.value.isDirectory) {
      this.status = { kind: 'missing-directory', directory: this.directory };
      return { status: this.status, changed: previousKind !== 'missing-directory' };
    }

    const candidates = [joinPath(this.directory, 'meta.json'), joinPath(this.directory, 'overview', 'meta.json')];
    let indexPath = '';
    for (const candidate of candidates) {
      const stat = await window.studio.fs.stat(candidate);
      if (stat.ok && stat.value.exists && stat.value.isFile) {
        indexPath = candidate;
        break;
      }
    }
    if (indexPath === '') {
      this.status = { kind: 'missing-index', directory: this.directory, looked: candidates };
      return { status: this.status, changed: previousKind !== 'missing-index' };
    }

    const read = await window.studio.fs.readText(indexPath, MAX_META_BYTES);
    if (!read.ok) {
      this.status = { kind: 'unreadable', path: indexPath, error: read.error };
      return { status: this.status, changed: true };
    }

    const parsed = parseMeta(read.value);
    if (!parsed.meta) {
      this.status = { kind: 'invalid', path: indexPath, error: parsed.error ?? 'The index could not be parsed.' };
      return { status: this.status, changed: true };
    }

    this.meta = parsed.meta;
    this.overviewDirectory = indexPath.slice(0, indexPath.length - 'meta.json'.length).replace(/[\\/]+$/, '');
    this.status =
      tileCount(parsed.meta) === 0
        ? { kind: 'empty', path: indexPath, meta: parsed.meta }
        : { kind: 'ready', path: indexPath, meta: parsed.meta };

    const changed = previousKind !== this.status.kind || previousVersion !== parsed.meta.updated;
    if (changed) this.pruneStaleVersions(parsed.meta.updated);
    return { status: this.status, changed };
  }

  /**
   * Returns a decoded tile if it is already in the cache.
   *
   * A cache miss schedules the read and returns `null` immediately, so drawing
   * a frame never waits on the disk. `onTileReady` fires once the bytes have
   * decoded and the frame can be drawn again with the tile in it.
   */
  tile(dimension: string, mode: RenderMode, rx: number, rz: number): HTMLImageElement | null {
    if (this.overviewDirectory === '') return null;
    const version = this.meta.updated;
    const key = `${dimension}|${mode}|${rx}|${rz}|${version}`;
    const hit = this.cache.get(key);
    if (hit) {
      this.clock += 1;
      hit.lastUsed = this.clock;
      return hit.image;
    }
    if (this.pending.has(key)) return null;
    this.pending.add(key);
    void this.load(key, dimension, mode, rx, rz, version);
    return null;
  }

  /** Forgets every decoded tile. Used when the folder or the world changes. */
  clearTiles(): void {
    this.cache.clear();
    this.pending.clear();
  }

  private async load(
    key: string,
    dimension: string,
    mode: RenderMode,
    rx: number,
    rz: number,
    version: number
  ): Promise<void> {
    const path = tilePath(this.overviewDirectory, dimension, mode, rx, rz);
    const read = await window.studio.fs.readBase64(path, MAX_TILE_BYTES);
    if (this.disposed) return;
    this.pending.delete(key);

    if (!read.ok) {
      this.remember(key, { image: null, version, failed: true, lastUsed: ++this.clock });
      return;
    }

    const image = new Image();
    image.decoding = 'async';
    image.src = `data:image/png;base64,${read.value}`;
    try {
      await image.decode();
    } catch {
      if (this.disposed) return;
      this.remember(key, { image: null, version, failed: true, lastUsed: ++this.clock });
      return;
    }
    if (this.disposed) return;
    this.remember(key, { image, version, failed: false, lastUsed: ++this.clock });
    this.onTileReady();
  }

  private remember(key: string, entry: CachedTile): void {
    this.cache.set(key, entry);
    this.evict();
  }

  private evict(): void {
    if (this.cache.size <= this.cacheLimit) return;
    const entries = [...this.cache.entries()].sort((a, b) => a[1].lastUsed - b[1].lastUsed);
    const excess = this.cache.size - this.cacheLimit;
    for (let index = 0; index < excess; index += 1) {
      this.cache.delete(entries[index][0]);
    }
  }

  private pruneStaleVersions(version: number): void {
    for (const key of [...this.cache.keys()]) {
      const entry = this.cache.get(key);
      if (entry && entry.version !== version) this.cache.delete(key);
    }
  }
}
