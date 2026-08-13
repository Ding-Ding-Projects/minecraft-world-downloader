import type { AppContext } from '../../core/registry';

/**
 * The six real advanced settings and the five documented Speed levels mapped
 * onto them.
 *
 * This file holds no rendering code on purpose. The settings section, the
 * in-surface table, the palette entries and the documentation article are all
 * built FROM this one table, so the mapping shown to a person and the mapping
 * actually applied when they move the Speed control can never say two
 * different things.
 */

export const CHUNK_BATCH_SIZE_ID = 'performance.chunkBatchSize';
export const WORKER_CONCURRENCY_ID = 'performance.workerConcurrency';
export const MAP_TILE_RESOLUTION_ID = 'performance.mapTileResolution';
export const LOG_RETENTION_DAYS_ID = 'performance.logRetentionDays';
export const REFRESH_INTERVAL_ID = 'performance.refreshIntervalMs';
export const ANIMATION_LEVEL_ID = 'performance.animationLevel';

/** The composite Speed picker. It never itself holds a real stored value. */
export const SPEED_LEVEL_ID = 'performance.speedLevel';

export type MapTileResolution = '128' | '256' | '512' | '1024';
export type AnimationLevel = 'off' | 'minimal' | 'standard' | 'full';
export type SpeedLevelNumber = 1 | 2 | 3 | 4 | 5;

export interface AdvancedValues {
  chunkBatchSize: number;
  workerConcurrency: number;
  mapTileResolution: MapTileResolution;
  logRetentionDays: number;
  refreshIntervalMs: number;
  animationLevel: AnimationLevel;
}

export interface SpeedLevelSpec {
  level: SpeedLevelNumber;
  /** A stable slug used in ids, exports and the documentation. Never renamed. */
  slug: 'batterySaver' | 'light' | 'balanced' | 'fast' | 'maximum';
  /** i18n key for the level's short name, e.g. "Balanced". */
  nameKey: string;
  /** i18n key for a one-line description of who this level suits. */
  blurbKey: string;
  values: AdvancedValues;
}

/**
 * The five documented levels. `values` here is the single source of truth: the
 * segmented picker writes exactly these numbers, the reference table renders
 * exactly these numbers, and `docs.ts` generates its Markdown table from this
 * same array, so nothing here can drift out of sync with what a person reads.
 */
export const SPEED_LEVELS: readonly SpeedLevelSpec[] = [
  {
    level: 1,
    slug: 'batterySaver',
    nameKey: 'performance.level.1.name',
    blurbKey: 'performance.level.1.blurb',
    values: {
      chunkBatchSize: 16,
      workerConcurrency: 1,
      mapTileResolution: '128',
      logRetentionDays: 3,
      refreshIntervalMs: 4000,
      animationLevel: 'off'
    }
  },
  {
    level: 2,
    slug: 'light',
    nameKey: 'performance.level.2.name',
    blurbKey: 'performance.level.2.blurb',
    values: {
      chunkBatchSize: 32,
      workerConcurrency: 2,
      mapTileResolution: '256',
      logRetentionDays: 7,
      refreshIntervalMs: 2000,
      animationLevel: 'minimal'
    }
  },
  {
    level: 3,
    slug: 'balanced',
    nameKey: 'performance.level.3.name',
    blurbKey: 'performance.level.3.blurb',
    values: {
      chunkBatchSize: 64,
      workerConcurrency: 4,
      mapTileResolution: '256',
      logRetentionDays: 14,
      refreshIntervalMs: 1000,
      animationLevel: 'standard'
    }
  },
  {
    level: 4,
    slug: 'fast',
    nameKey: 'performance.level.4.name',
    blurbKey: 'performance.level.4.blurb',
    values: {
      chunkBatchSize: 128,
      workerConcurrency: 6,
      mapTileResolution: '512',
      logRetentionDays: 30,
      refreshIntervalMs: 500,
      animationLevel: 'standard'
    }
  },
  {
    level: 5,
    slug: 'maximum',
    nameKey: 'performance.level.5.name',
    blurbKey: 'performance.level.5.blurb',
    values: {
      chunkBatchSize: 256,
      workerConcurrency: 8,
      mapTileResolution: '1024',
      logRetentionDays: 60,
      refreshIntervalMs: 250,
      animationLevel: 'full'
    }
  }
] as const;

/** Level 3, Balanced — the level that reproduces the application's shipped defaults. */
export const DEFAULT_LEVEL: SpeedLevelSpec = SPEED_LEVELS[2];
export const DEFAULTS: AdvancedValues = DEFAULT_LEVEL.values;

export function levelBySlug(slug: SpeedLevelSpec['slug']): SpeedLevelSpec {
  const found = SPEED_LEVELS.find((entry) => entry.slug === slug);
  if (!found) throw new Error(`Unknown performance level slug: ${slug}`);
  return found;
}

export function levelByNumber(level: SpeedLevelNumber): SpeedLevelSpec {
  const found = SPEED_LEVELS.find((entry) => entry.level === level);
  if (!found) throw new Error(`Unknown performance level: ${level}`);
  return found;
}

/** Reads the six advanced settings as they actually are right now. */
export function currentAdvancedValues(ctx: AppContext): AdvancedValues {
  return {
    chunkBatchSize: Number(ctx.settings.get<number>(CHUNK_BATCH_SIZE_ID, DEFAULTS.chunkBatchSize)),
    workerConcurrency: Number(ctx.settings.get<number>(WORKER_CONCURRENCY_ID, DEFAULTS.workerConcurrency)),
    mapTileResolution: ctx.settings.get<MapTileResolution>(MAP_TILE_RESOLUTION_ID, DEFAULTS.mapTileResolution),
    logRetentionDays: Number(ctx.settings.get<number>(LOG_RETENTION_DAYS_ID, DEFAULTS.logRetentionDays)),
    refreshIntervalMs: Number(ctx.settings.get<number>(REFRESH_INTERVAL_ID, DEFAULTS.refreshIntervalMs)),
    animationLevel: ctx.settings.get<AnimationLevel>(ANIMATION_LEVEL_ID, DEFAULTS.animationLevel)
  };
}

function sameValues(a: AdvancedValues, b: AdvancedValues): boolean {
  return (
    a.chunkBatchSize === b.chunkBatchSize &&
    a.workerConcurrency === b.workerConcurrency &&
    a.mapTileResolution === b.mapTileResolution &&
    a.logRetentionDays === b.logRetentionDays &&
    a.refreshIntervalMs === b.refreshIntervalMs &&
    a.animationLevel === b.animationLevel
  );
}

/**
 * The level the six real values currently match, or `null` for Custom.
 *
 * This is a pure read with no side effect of any kind: calling it, and
 * therefore merely DISPLAYING a "Custom" state, never writes anything. Only
 * `applyLevel` below writes, and only when a person deliberately moves the
 * Speed picker.
 */
export function detectLevel(ctx: AppContext): SpeedLevelSpec | null {
  const current = currentAdvancedValues(ctx);
  return SPEED_LEVELS.find((entry) => sameValues(entry.values, current)) ?? null;
}

const IDS: Array<{ id: string; key: keyof AdvancedValues }> = [
  { id: CHUNK_BATCH_SIZE_ID, key: 'chunkBatchSize' },
  { id: WORKER_CONCURRENCY_ID, key: 'workerConcurrency' },
  { id: MAP_TILE_RESOLUTION_ID, key: 'mapTileResolution' },
  { id: LOG_RETENTION_DAYS_ID, key: 'logRetentionDays' },
  { id: REFRESH_INTERVAL_ID, key: 'refreshIntervalMs' },
  { id: ANIMATION_LEVEL_ID, key: 'animationLevel' }
];

/**
 * Writes every one of the six real advanced settings to the values a level
 * documents, and only those six. Nothing about the Speed picker itself is
 * ever stored — the level is always recomputed from these six afterwards, so
 * there is exactly one source of truth and no way for the two to drift apart.
 */
export async function applyLevel(ctx: AppContext, level: SpeedLevelSpec): Promise<boolean> {
  const before = currentAdvancedValues(ctx);
  if (sameValues(before, level.values)) return false;
  for (const { id, key } of IDS) {
    ctx.settings.set(id, level.values[key]);
  }
  await ctx.history.record(
    `Applied the "${ctx.i18n.t(level.nameKey, level.slug)}" performance level (Level ${level.level})`,
    'performance',
    { level: level.level, slug: level.slug, before, after: level.values }
  );
  return true;
}

/** Every setting id this feature owns, for declaring defaults and for export scopes. */
export function allSettingIds(): string[] {
  return IDS.map((entry) => entry.id);
}
