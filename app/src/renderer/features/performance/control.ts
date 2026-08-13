import { el } from '../../core/a11y';
import type { AppContext } from '../../core/registry';
import {
  AdvancedValues,
  AnimationLevel,
  DEFAULT_LEVEL,
  MapTileResolution,
  SPEED_LEVELS,
  SpeedLevelNumber,
  SpeedLevelSpec,
  allSettingIds,
  applyLevel,
  currentAdvancedValues,
  detectLevel
} from './model';

/**
 * The novice-level Speed control: a picker for the five documented levels, a
 * status line naming exactly what is in effect right now (a level, or the
 * honest "Custom" state), a reference table with the whole mapping, and an
 * export of the current values.
 *
 * Nothing here stores its own value. Every read goes straight to the six real
 * advanced settings through `model.ts`, so this UI cannot say something
 * different from what the application will actually do.
 */

const ANIMATION_OPTION_KEY: Record<AnimationLevel, string> = {
  off: 'performance.animationLevel.option.off',
  minimal: 'performance.animationLevel.option.minimal',
  standard: 'performance.animationLevel.option.standard',
  full: 'performance.animationLevel.option.full'
};

const TILE_OPTION_KEY: Record<MapTileResolution, string> = {
  '128': 'performance.mapTileResolution.option.128',
  '256': 'performance.mapTileResolution.option.256',
  '512': 'performance.mapTileResolution.option.512',
  '1024': 'performance.mapTileResolution.option.1024'
};

function animationLabel(ctx: AppContext, level: AnimationLevel): string {
  return ctx.t(ANIMATION_OPTION_KEY[level], level);
}

function tileLabel(ctx: AppContext, size: MapTileResolution): string {
  return ctx.t(TILE_OPTION_KEY[size], `${size} px`);
}

/** Every knob's current value, formatted the same way in the table and the status line. */
function formatKnobs(ctx: AppContext, values: AdvancedValues): Record<keyof AdvancedValues, string> {
  return {
    chunkBatchSize: ctx.t('performance.unit.chunks', '{value} chunks per batch', { values: { value: values.chunkBatchSize } }),
    workerConcurrency: ctx.t('performance.unit.workers', '{value} worker(s)', { values: { value: values.workerConcurrency } }),
    mapTileResolution: tileLabel(ctx, values.mapTileResolution),
    logRetentionDays: ctx.t('performance.unit.days', '{value} days', { values: { value: values.logRetentionDays } }),
    refreshIntervalMs: ctx.t('performance.unit.ms', 'every {value} ms', { values: { value: values.refreshIntervalMs } }),
    animationLevel: animationLabel(ctx, values.animationLevel)
  };
}

function levelName(ctx: AppContext, spec: SpeedLevelSpec): string {
  return ctx.t(spec.nameKey, spec.slug);
}

export interface SpeedControlHandle {
  root: HTMLElement;
  /** Re-reads the six real settings and updates every part of the UI. */
  refresh(): void;
  destroy(): void;
}

export function mountSpeedControl(ctx: AppContext): SpeedControlHandle {
  const root = el('div', { className: 'performance-speed' });

  const status = el('p', {
    className: 'performance-speed__status md-typescale-title-small',
    attrs: { role: 'status' }
  });
  const values = el('p', { className: 'performance-speed__values md-typescale-body-small' });

  const pickerHost = el('div', { className: 'performance-speed__picker' });

  const buttonRow = el('div', { className: 'performance-speed__actions' });
  const applyDefaultButton = ctx.components.button({
    label: 'performance.speed.applyDefault',
    variant: 'tonal',
    icon: 'refresh',
    onClick: () => void handleApply(DEFAULT_LEVEL)
  });
  const exportButton = ctx.components.button({
    label: 'performance.speed.export',
    variant: 'text',
    icon: 'download',
    onClick: () => void handleExport()
  });
  buttonRow.append(applyDefaultButton, exportButton);

  const tableWrap = el('div', { className: 'performance-speed__tablewrap' });

  root.append(status, values, pickerHost, buttonRow, tableWrap);

  let picker = ctx.components.segmentedButton({
    label: 'performance.speed.picker.label',
    options: SPEED_LEVELS.map((spec) => ({ value: String(spec.level), label: String(spec.level) })),
    value: '',
    onChange: (raw) => {
      const level = SPEED_LEVELS.find((spec) => String(spec.level) === raw);
      if (level) void handleApply(level);
    }
  });
  pickerHost.append(picker.root);

  async function handleApply(level: SpeedLevelSpec): Promise<void> {
    const applied = await applyLevel(ctx, level);
    if (applied) {
      ctx.notify.success(
        ctx.t('performance.speed.label', 'Speed'),
        ctx.t('performance.speed.applied', 'Applied Level {level} — {name}. {count} advanced settings were updated and recorded in local history.', {
          values: { level: level.level, name: levelName(ctx, level), count: allSettingIds().length }
        })
      );
    }
    refresh();
  }

  async function handleExport(): Promise<void> {
    const current = currentAdvancedValues(ctx);
    const match = detectLevel(ctx);
    const record: Record<string, unknown> = {
      speedLevel: match ? match.level : 'custom',
      speedLevelName: match ? levelName(ctx, match) : 'Custom',
      ...current
    };
    const path = await ctx.exporter.save([record], 'json', {
      name: 'performance-settings',
      defaultFileName: 'performance-settings.json'
    });
    if (path) {
      ctx.notify.success(ctx.t('performance.speed.export', 'Export current performance values'), ctx.t('performance.speed.exported', 'Saved to {path}.', { values: { path } }));
    }
  }

  const tableRows = new Map<SpeedLevelNumber, HTMLTableRowElement>();

  function buildTable(): void {
    tableWrap.textContent = '';
    const table = el('table', { className: 'performance-speed__table' });
    const caption = el('caption', { text: ctx.t('performance.speed.table.caption', 'Exactly what each Speed level sets') });
    const thead = el('thead');
    const headRow = el('tr');
    const columns: Array<{ key: keyof AdvancedValues | 'level'; labelKey: string; fallback: string }> = [
      { key: 'level', labelKey: 'performance.speed.table.col.level', fallback: 'Level' },
      { key: 'chunkBatchSize', labelKey: 'performance.speed.table.col.chunkBatchSize', fallback: 'Chunk batch size' },
      { key: 'workerConcurrency', labelKey: 'performance.speed.table.col.workerConcurrency', fallback: 'Worker concurrency' },
      { key: 'mapTileResolution', labelKey: 'performance.speed.table.col.mapTileResolution', fallback: 'Map tile resolution' },
      { key: 'logRetentionDays', labelKey: 'performance.speed.table.col.logRetentionDays', fallback: 'Log retention' },
      { key: 'refreshIntervalMs', labelKey: 'performance.speed.table.col.refreshIntervalMs', fallback: 'Refresh interval' },
      { key: 'animationLevel', labelKey: 'performance.speed.table.col.animationLevel', fallback: 'Animation level' }
    ];
    for (const column of columns) {
      headRow.append(el('th', { text: ctx.t(column.labelKey, column.fallback), attrs: { scope: 'col' } }));
    }
    thead.append(headRow);

    const tbody = el('tbody');
    tableRows.clear();
    for (const spec of SPEED_LEVELS) {
      const row = el('tr', { attrs: { 'data-level': String(spec.level) } });
      const formatted = formatKnobs(ctx, spec.values);
      const levelCell = el('th', { attrs: { scope: 'row' } });
      levelCell.append(
        document.createTextNode(`${spec.level} — ${levelName(ctx, spec)}`)
      );
      row.append(levelCell);
      for (const column of columns) {
        if (column.key === 'level') continue;
        row.append(el('td', { text: formatted[column.key as keyof AdvancedValues] }));
      }
      tbody.append(row);
      tableRows.set(spec.level, row);
    }
    table.append(caption, thead, tbody);
    tableWrap.append(table);
  }

  buildTable();

  function refresh(): void {
    const current = currentAdvancedValues(ctx);
    const match = detectLevel(ctx);
    const formatted = formatKnobs(ctx, current);

    if (match) {
      status.textContent = ctx.t('performance.speed.status.level', 'Level {level} — {name}.', {
        values: { level: match.level, name: levelName(ctx, match) }
      });
      status.classList.remove('performance-speed__status--custom');
      picker.set(String(match.level));
    } else {
      status.textContent = ctx.t('performance.speed.status.custom', 'Custom: the six advanced values below do not match any documented level.');
      status.classList.add('performance-speed__status--custom');
      picker.set('');
    }

    values.textContent = [
      formatted.chunkBatchSize,
      formatted.workerConcurrency,
      formatted.mapTileResolution,
      formatted.logRetentionDays,
      formatted.refreshIntervalMs,
      formatted.animationLevel
    ].join(' · ');

    const isDefault = match?.level === DEFAULT_LEVEL.level;
    applyDefaultButton.hidden = isDefault === true;
    applyDefaultButton.querySelector('.md-btn__label')?.replaceChildren(
      document.createTextNode(
        ctx.t('performance.speed.applyDefault', 'Use the shipped default (Level {level} — {name})', {
          values: { level: DEFAULT_LEVEL.level, name: levelName(ctx, DEFAULT_LEVEL) }
        })
      )
    );

    for (const [level, row] of tableRows) {
      const isCurrent = match?.level === level;
      row.classList.toggle('performance-speed__row--current', isCurrent);
      if (isCurrent) {
        row.setAttribute('aria-current', 'true');
        const cell = row.querySelector('th');
        if (cell && !cell.querySelector('.performance-speed__badge')) {
          cell.append(
            el('span', { className: 'performance-speed__badge md-typescale-label-small', text: ` (${ctx.t('performance.speed.table.current', 'current')})` })
          );
        }
      } else {
        row.removeAttribute('aria-current');
        row.querySelector('.performance-speed__badge')?.remove();
      }
    }
  }

  refresh();

  const unsubscribe = ctx.settings.onChange((change) => {
    if (!allSettingIds().includes(change.id)) return;
    refresh();
  });

  return {
    root,
    refresh,
    destroy: () => {
      unsubscribe();
    }
  };
}
