import { defineFeature } from '../../core/registry';
import type { AppContext, PaletteEntry, SettingsSection } from '../../core/registry';
import './styles.css';
import { PERFORMANCE_DOCS } from './docs';
import {
  ANIMATION_LEVEL_ID,
  CHUNK_BATCH_SIZE_ID,
  LOG_RETENTION_DAYS_ID,
  MAP_TILE_RESOLUTION_ID,
  REFRESH_INTERVAL_ID,
  SPEED_LEVELS,
  WORKER_CONCURRENCY_ID,
  allSettingIds,
  applyLevel
} from './model';
import { performanceSettingsSection } from './settings';
import { PERFORMANCE_STRINGS } from './strings';

/**
 * The performance-tuning feature: inventory row `10.3`.
 *
 * Six real advanced settings (`performance.chunkBatchSize`,
 * `performance.workerConcurrency`, `performance.mapTileResolution`,
 * `performance.logRetentionDays`, `performance.refreshIntervalMs`,
 * `performance.animationLevel`) plus one honest novice-level Speed control
 * mapped onto them. See `model.ts` for the mapping, `control.ts` for the
 * live-syncing UI, and `docs/features/performance.md` (mirrored here in
 * `docs.ts`) for the full explanation.
 */

const SECTION: SettingsSection = performanceSettingsSection();

function paletteEntries(): PaletteEntry[] {
  const entries: PaletteEntry[] = [
    {
      id: 'performance.command.open',
      title: 'performance.palette.open',
      subtitle: 'Speed, plus the six advanced settings it maps onto',
      icon: 'bolt',
      kind: 'destination',
      keywords: ['performance', 'speed', 'tuning', 'chunk', 'worker', 'tile', 'animation', '效能', '速度'],
      teleport: { tabId: 'settings', elementId: 'settings-control-performance.speedLevel' }
    }
  ];

  for (const spec of SPEED_LEVELS) {
    entries.push({
      id: `performance.command.setLevel.${spec.level}`,
      title: 'performance.palette.setLevel',
      icon: 'bolt',
      kind: 'command',
      keywords: ['performance', 'speed', 'level', String(spec.level), spec.slug],
      run: async () => {
        const context = contextRef;
        if (!context) return;
        const applied = await applyLevel(context, spec);
        if (!applied) return;
        context.notify.success(
          context.t('performance.speed.label', 'Speed'),
          context.t(
            'performance.speed.applied',
            'Applied Level {level} — {name}. {count} advanced settings were updated and recorded in local history.',
            { values: { level: spec.level, name: context.t(spec.nameKey, spec.slug), count: allSettingIds().length } }
          )
        );
      }
    });
  }

  const settingEntries: Array<{ id: string; titleKey: string }> = [
    { id: CHUNK_BATCH_SIZE_ID, titleKey: 'performance.chunkBatchSize.label' },
    { id: WORKER_CONCURRENCY_ID, titleKey: 'performance.workerConcurrency.label' },
    { id: MAP_TILE_RESOLUTION_ID, titleKey: 'performance.mapTileResolution.label' },
    { id: LOG_RETENTION_DAYS_ID, titleKey: 'performance.logRetentionDays.label' },
    { id: REFRESH_INTERVAL_ID, titleKey: 'performance.refreshIntervalMs.label' },
    { id: ANIMATION_LEVEL_ID, titleKey: 'performance.animationLevel.label' }
  ];
  for (const entry of settingEntries) {
    entries.push({
      id: `performance.setting.${entry.id}`,
      title: entry.titleKey,
      icon: 'tune',
      kind: 'setting',
      settingId: entry.id,
      keywords: ['performance', 'tuning', entry.id]
    });
  }

  return entries;
}

let contextRef: AppContext | null = null;

export default defineFeature({
  id: 'performance',
  name: 'Performance tuning',
  description:
    'Six real advanced settings — chunk batch size, worker concurrency, map tile resolution, log retention, refresh interval, animation level — plus an honest Speed picker mapped onto exactly those values, with a checkable table and an explicit Custom state.',
  strings: PERFORMANCE_STRINGS,
  docs: PERFORMANCE_DOCS,
  settings: [SECTION],
  palette: paletteEntries(),
  init(ctx: AppContext) {
    contextRef = ctx;
    // Declares every real default up front, so `defaultOf` and `reset` behave
    // correctly even before the settings tab has ever been opened.
    for (const control of SECTION.controls) {
      ctx.settings.declareDefault(control.id, control.defaultValue);
    }
  }
});
