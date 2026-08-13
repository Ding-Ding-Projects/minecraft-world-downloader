import type { SettingsSection } from '../../core/registry';
import { mountSpeedControl } from './control';
import {
  ANIMATION_LEVEL_ID,
  CHUNK_BATCH_SIZE_ID,
  DEFAULTS,
  LOG_RETENTION_DAYS_ID,
  MAP_TILE_RESOLUTION_ID,
  REFRESH_INTERVAL_ID,
  SPEED_LEVEL_ID,
  WORKER_CONCURRENCY_ID
} from './model';

/**
 * The six real advanced settings, plus the novice Speed picker built on top of
 * them.
 *
 * The Speed control is declared FIRST and is `kind: 'custom'` because it does
 * not itself hold a stored value — see `model.ts` for why that is the design
 * rather than an oversight. Its own settings-row provenance line therefore
 * always reads "using the built-in value"; the control's own body, which this
 * feature fully owns, is what actually tells the truth about the current
 * level or the honest Custom state, and it updates live from the six real
 * settings underneath.
 */

function integerInRange(min: number, max: number, step: number, label: string) {
  return (value: unknown): string | null => {
    const num = Number(value);
    if (!Number.isFinite(num)) return `${label} must be a number.`;
    if (num < min || num > max) return `${label} must be between ${min} and ${max}.`;
    const steps = (num - min) / step;
    if (Math.abs(steps - Math.round(steps)) > 1e-6) {
      return `${label} must be a multiple of ${step}, counting from ${min}.`;
    }
    return null;
  };
}

export function performanceSettingsSection(): SettingsSection {
  return {
    id: 'performance',
    title: 'performance.section',
    icon: 'bolt',
    order: 150,
    controls: [
      {
        id: SPEED_LEVEL_ID,
        label: 'performance.speed.label',
        description: 'performance.speed.description',
        kind: 'custom',
        defaultValue: 'balanced',
        keywords: ['speed', 'performance', 'level', 'preset', 'fast', 'slow', 'tuning', '速度', '效能'],
        render(host, ctx) {
          const control = mountSpeedControl(ctx);
          host.append(control.root);
          host.addEventListener('md-dispose', () => control.destroy());
        }
      },
      {
        id: CHUNK_BATCH_SIZE_ID,
        label: 'performance.chunkBatchSize.label',
        description: 'performance.chunkBatchSize.description',
        kind: 'slider',
        defaultValue: DEFAULTS.chunkBatchSize,
        min: 8,
        max: 256,
        step: 8,
        hint: 'performance.unit.chunks',
        keywords: ['chunk', 'batch', 'download', 'worker', 'performance', 'tuning'],
        validate: integerInRange(8, 256, 8, 'Chunk batch size')
      },
      {
        id: WORKER_CONCURRENCY_ID,
        label: 'performance.workerConcurrency.label',
        description: 'performance.workerConcurrency.description',
        kind: 'slider',
        defaultValue: DEFAULTS.workerConcurrency,
        min: 1,
        max: 8,
        step: 1,
        hint: 'performance.unit.workers',
        keywords: ['worker', 'thread', 'concurrency', 'parallel', 'performance', 'tuning'],
        validate: integerInRange(1, 8, 1, 'Worker concurrency')
      },
      {
        id: MAP_TILE_RESOLUTION_ID,
        label: 'performance.mapTileResolution.label',
        description: 'performance.mapTileResolution.description',
        kind: 'select',
        defaultValue: DEFAULTS.mapTileResolution,
        keywords: ['map', 'tile', 'resolution', 'pixel', 'render', 'performance', 'tuning'],
        options: [
          { value: '128', label: 'performance.mapTileResolution.option.128' },
          { value: '256', label: 'performance.mapTileResolution.option.256' },
          { value: '512', label: 'performance.mapTileResolution.option.512' },
          { value: '1024', label: 'performance.mapTileResolution.option.1024' }
        ],
        validate: (value) =>
          ['128', '256', '512', '1024'].includes(String(value))
            ? null
            : 'Map tile resolution must be 128, 256, 512 or 1024 pixels.'
      },
      {
        id: LOG_RETENTION_DAYS_ID,
        label: 'performance.logRetentionDays.label',
        description: 'performance.logRetentionDays.description',
        kind: 'slider',
        defaultValue: DEFAULTS.logRetentionDays,
        min: 1,
        max: 90,
        step: 1,
        hint: 'performance.unit.days',
        keywords: ['log', 'retention', 'prune', 'days', 'performance', 'tuning'],
        validate: integerInRange(1, 90, 1, 'Log retention')
      },
      {
        id: REFRESH_INTERVAL_ID,
        label: 'performance.refreshIntervalMs.label',
        description: 'performance.refreshIntervalMs.description',
        kind: 'slider',
        defaultValue: DEFAULTS.refreshIntervalMs,
        min: 100,
        max: 5000,
        step: 50,
        hint: 'performance.unit.ms',
        keywords: ['refresh', 'interval', 'poll', 'live', 'status', 'map', 'performance', 'tuning'],
        validate: integerInRange(100, 5000, 50, 'Refresh interval')
      },
      {
        id: ANIMATION_LEVEL_ID,
        label: 'performance.animationLevel.label',
        description: 'performance.animationLevel.description',
        kind: 'select',
        defaultValue: DEFAULTS.animationLevel,
        keywords: ['animation', 'motion', 'reduced motion', 'decorative', 'performance', 'tuning'],
        options: [
          { value: 'off', label: 'performance.animationLevel.option.off' },
          { value: 'minimal', label: 'performance.animationLevel.option.minimal' },
          { value: 'standard', label: 'performance.animationLevel.option.standard' },
          { value: 'full', label: 'performance.animationLevel.option.full' }
        ],
        validate: (value) =>
          ['off', 'minimal', 'standard', 'full'].includes(String(value))
            ? null
            : 'Animation level must be off, minimal, standard or full.'
      }
    ]
  };
}
