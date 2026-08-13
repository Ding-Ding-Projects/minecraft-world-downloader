import type {
  AppContext,
  ExportFormat,
  FunnyLevel,
  LanguageMode,
  SearchQuery,
  TabContext
} from '../../core/registry';
import { renderDisclosure } from './disclosure';
import { el, nextId } from './dom';
import { levelName, modeName, renderPreviewScreen } from './preview';
import { SAMPLES, SAMPLE_LEVELS, sampleText, verifySamples } from './samples';
import { emojiControl, funnyControl, modeControl } from './settings';
import {
  PREVIEW_SCALES,
  PREVIEW_SCALE_ID,
  PREVIEW_WIDTH_ID,
  readEmoji,
  readPreviewScale,
  readPreviewWidth
} from './state';

/**
 * The Language destination.
 *
 * It exists because the settings row can only ever show you the level you are
 * currently on, and the question a person actually has is comparative: what does
 * this look like at the other extreme, in the other mode, and does the bilingual
 * layout survive a narrow window. So this surface renders the whole matrix —
 * three modes at both humour extremes — at a width and a text scale you choose,
 * side by side, from the same ladders the application itself reads.
 */

interface VariantRow {
  id: string;
  sampleId: string;
  category: string;
  language: 'en' | 'yue';
  languageName: string;
  level: FunnyLevel;
  text: string;
}

function buildRows(ctx: AppContext): VariantRow[] {
  const rows: VariantRow[] = [];
  for (const sample of SAMPLES) {
    for (const language of ['en', 'yue'] as const) {
      for (const level of SAMPLE_LEVELS) {
        rows.push({
          id: `${sample.id}:${language}:${level}`,
          sampleId: sample.id,
          category: ctx.t(sample.categoryKey, sample.id),
          language,
          languageName:
            language === 'en'
              ? ctx.t('core.language.mode.en', 'English')
              : ctx.t('core.language.mode.yue', 'Cantonese'),
          level,
          text: ctx.i18n.applyVocabulary(sampleText(sample, language, level))
        });
      }
    }
  }
  return rows;
}

export function mountLanguageTab(host: HTMLElement, ctx: TabContext): void {
  host.classList.add('lang-tab');

  host.append(
    ctx.components.topAppBar({
      title: 'language.tab.title',
      subtitle: 'language.tab.subtitle'
    })
  );

  host.append(renderDisclosure(ctx, 'language.tab'));
  host.append(controlsCard(ctx));
  host.append(factCheckCard(ctx));
  host.append(matrixSection(ctx));
  host.append(variantTable(ctx));
}

/* ------------------------------------------------------------------ */
/* The live controls                                                   */
/* ------------------------------------------------------------------ */

function controlsCard(ctx: TabContext): HTMLElement {
  const card = ctx.components.card({ variant: 'outlined', title: 'language.controls.title' });
  card.setAttribute('data-appearance-id', 'language:controls');
  card.id = 'language-controls';

  const grid = el('div', { className: 'lang-controls-grid' });
  // Real controls, not copies: these are the same functions the settings rows
  // render, writing the same application-wide settings.
  grid.append(
    labelled(ctx, 'language.mode.label', modeControl(ctx, { idSuffix: 'tab', withPreview: false })),
    labelled(ctx, 'language.emoji.label', emojiControl(ctx, { idSuffix: 'tab', withPreview: false })),
    labelled(ctx, 'language.funny.en.label', funnyControl(ctx, 'en', { idSuffix: 'tab', withPreview: false, hideOwnLabel: true })),
    labelled(ctx, 'language.funny.yue.label', funnyControl(ctx, 'yue', { idSuffix: 'tab', withPreview: false, hideOwnLabel: true }))
  );

  card.append(grid);
  return card;
}

function labelled(ctx: AppContext, labelKey: string, control: HTMLElement): HTMLElement {
  const wrap = el('div', { className: 'lang-controls-grid__cell' });
  wrap.append(el('p', { className: 'md-typescale-label-large', text: ctx.t(labelKey, labelKey) }));
  wrap.append(control);
  return wrap;
}

/* ------------------------------------------------------------------ */
/* The fact check                                                      */
/* ------------------------------------------------------------------ */

function factCheckCard(ctx: TabContext): HTMLElement {
  const card = ctx.components.card({ variant: 'outlined', title: 'language.facts.title' });
  card.id = 'language-fact-check';
  card.setAttribute('data-appearance-id', 'language:fact-check');

  card.append(
    el('p', {
      className: 'md-typescale-body-small',
      text: ctx.t(
        'language.facts.description',
        'Each sample declares the facts every rung of its ladder must carry. This check reads all thirty rendered variants and reports any that dropped one.'
      )
    })
  );

  const results = verifySamples();
  const failures = results.filter((result) => result.missing.length > 0);
  const status = el('p', {
    className: `lang-fact-status md-typescale-body-medium${failures.length > 0 ? ' lang-fact-status--failed' : ''}`,
    attrs: { role: 'status' }
  });

  status.textContent =
    failures.length === 0
      ? ctx.t('language.facts.pass', 'All {total} rendered variants carry every fact they declare.', {
          values: { total: results.length }
        })
      : ctx.t('language.facts.fail', '{count} of {total} variants dropped a declared fact: {detail}', {
          values: {
            count: failures.length,
            total: results.length,
            detail: failures
              .map((failure) => `${failure.sampleId}/${failure.language}/${failure.level} → ${failure.missing.join(', ')}`)
              .join('; ')
          }
        });

  card.append(status);
  return card;
}

/* ------------------------------------------------------------------ */
/* The matrix                                                          */
/* ------------------------------------------------------------------ */

function matrixSection(ctx: TabContext): HTMLElement {
  const section = el('section', { className: 'lang-matrix', attrs: { id: 'language-matrix' } });
  section.append(
    ctx.components.sectionHeading({
      title: 'language.preview.matrix',
      description: 'language.preview.matrix.description'
    })
  );

  const controls = el('div', { className: 'lang-matrix__controls' });

  const width = ctx.components.slider({
    label: ctx.t('language.preview.width', 'Preview width'),
    id: 'language-preview-width-tab',
    min: 240,
    max: 720,
    step: 20,
    unit: 'px',
    value: readPreviewWidth(ctx),
    onChange: (value) => ctx.settings.set(PREVIEW_WIDTH_ID, Math.round(value))
  });

  const scale = ctx.components.select({
    label: ctx.t('language.preview.scale', 'Preview text scale'),
    id: 'language-preview-scale-tab',
    options: PREVIEW_SCALES.map((value) => ({ value, label: `${value}%` })),
    value: readPreviewScale(ctx),
    onChange: (value) => ctx.settings.set(PREVIEW_SCALE_ID, value)
  });

  controls.append(width.root, scale.root);
  section.append(controls);

  section.append(
    el('p', {
      className: 'lang-matrix__notice md-typescale-body-small',
      text: ctx.t(
        'language.preview.examples',
        'These three messages are examples written for this preview. No world was saved, nothing is being deleted and no connection was refused.'
      )
    })
  );

  const grid = el('div', { className: 'lang-matrix__grid' });
  section.append(grid);

  const repaint = (): void => {
    const widthPx = readPreviewWidth(ctx);
    const scalePercent = Number(readPreviewScale(ctx));
    width.set(widthPx);
    scale.set(String(scalePercent));
    grid.style.setProperty('--lang-preview-scale', String(scalePercent / 100));
    grid.textContent = '';

    const modes: LanguageMode[] = ['en', 'yue', 'both'];
    const extremes: FunnyLevel[] = [1, 5];
    for (const level of extremes) {
      for (const mode of modes) {
        const title = ctx.t('language.preview.cell', '{mode}, English at level {en}, Cantonese at level {yue}', {
          values: { mode: modeName(ctx, mode), en: level, yue: level }
        });
        grid.append(
          renderPreviewScreen(
            ctx,
            { mode, funnyEn: level, funnyYue: level, emoji: readEmoji(ctx) },
            { title, widthPx }
          )
        );
      }
    }
  };
  repaint();

  const stopSettings = ctx.settings.onChange((change) => {
    if (change.id === PREVIEW_WIDTH_ID || change.id === PREVIEW_SCALE_ID) repaint();
  });
  const stopI18n = ctx.i18n.onChange(() => repaint());
  ctx.onDispose(() => {
    stopSettings();
    stopI18n();
  });

  return section;
}

/* ------------------------------------------------------------------ */
/* The variant table                                                   */
/* ------------------------------------------------------------------ */

function variantTable(ctx: TabContext): HTMLElement {
  const section = el('section', { className: 'lang-variants', attrs: { id: 'language-variants' } });
  section.append(
    ctx.components.sectionHeading({
      title: 'language.table.title',
      description: 'language.table.description'
    })
  );

  let rows = buildRows(ctx);
  let visible = [...rows];
  const selection = new Set<string>();
  let anchorIndex: number | null = null;

  const status = el('p', { className: 'lang-variants__status md-typescale-body-small', attrs: { role: 'status' } });
  const tableWrap = el('div', { className: 'md-table-wrap lang-variants__wrap' });
  const table = el('table', {
    className: 'md-table',
    attrs: { 'aria-label': ctx.t('language.table.title', 'Every rendered variant') }
  });
  const head = el('thead');
  const body = el('tbody');
  table.append(head, body);
  tableWrap.append(table);

  const search = ctx.createSearchBar({
    label: 'language.table.search',
    sample: rows
      .slice(0, 6)
      .map((row) => row.text)
      .join('\n'),
    onChange: (query: SearchQuery) => {
      visible = rows.filter((row) =>
        query.matches(`${row.category} ${row.languageName} ${row.language} ${row.level} ${row.text}`)
      );
      anchorIndex = null;
      drawBody();
      refreshAll();
    }
  });

  /* ---------------- selection ---------------- */

  /**
   * The count line.
   *
   * It separates "selected" from "shown" deliberately: a select-all over a
   * filtered list is the one place a count quietly lies about what an action
   * will touch, so the hidden part of the selection is named rather than
   * implied.
   */
  function refreshStatus(): void {
    const hidden = [...selection].filter((id) => !visible.some((row) => row.id === id)).length;
    status.textContent = `${ctx.t(
      'language.table.selected',
      '{selected} selected. {affected} will be acted on; {hidden} of them are hidden by the current search.',
      { values: { selected: selection.size, affected: selection.size, hidden } }
    )} ${ctx.t('core.search.matchCount', '{count} of {total} shown', {
      values: { count: visible.length, total: rows.length }
    })}`;
  }

  /** Updates the checkboxes in place, so a click never steals its own focus. */
  function syncSelectionUi(): void {
    for (const tr of body.querySelectorAll<HTMLTableRowElement>('tr[data-row-id]')) {
      const id = tr.dataset.rowId ?? '';
      const selected = selection.has(id);
      tr.setAttribute('aria-selected', String(selected));
      const box = tr.querySelector<HTMLInputElement>('input[type="checkbox"]');
      if (box) box.checked = selected;
    }
  }

  function refreshAll(): void {
    syncSelectionUi();
    refreshStatus();
    relabelScopes();
  }

  const setSelected = (id: string, selected: boolean): void => {
    if (selected) selection.add(id);
    else selection.delete(id);
  };

  const applyRange = (from: number, to: number, selected: boolean): void => {
    const start = Math.min(from, to);
    const end = Math.max(from, to);
    for (let index = start; index <= end; index += 1) {
      const row = visible[index];
      if (row) setSelected(row.id, selected);
    }
  };

  /* ---------------- drawing ---------------- */

  const drawHead = (): void => {
    head.textContent = '';
    const tr = el('tr');
    tr.append(
      el('th', {
        attrs: { scope: 'col' },
        children: [el('span', { className: 'md-visually-hidden', text: ctx.t('core.action.selectAll', 'Select all') })]
      })
    );
    for (const key of [
      'language.table.column.category',
      'language.table.column.language',
      'language.table.column.level',
      'language.table.column.text'
    ]) {
      tr.append(el('th', { attrs: { scope: 'col' }, text: ctx.t(key, key) }));
    }
    head.append(tr);
  };

  const drawBody = (): void => {
    body.textContent = '';
    if (visible.length === 0) {
      const tr = el('tr');
      tr.append(
        el('td', {
          className: 'md-table__empty',
          attrs: { colspan: '5' },
          text: ctx.t('language.table.empty', 'No variant matched that search.')
        })
      );
      body.append(tr);
      return;
    }

    visible.forEach((row, index) => {
      const tr = el('tr', { attrs: { 'data-row-id': row.id, 'aria-selected': String(selection.has(row.id)) } });

      const selectCell = el('td');
      const boxId = nextId('language-variant');
      const box = el('input', {
        attrs: {
          id: boxId,
          type: 'checkbox',
          'aria-label': ctx.t('language.table.row', '{category}, {language}, level {level}', {
            values: { category: row.category, language: row.languageName, level: row.level }
          })
        }
      });
      box.checked = selection.has(row.id);

      const commit = (checked: boolean, extend: boolean): void => {
        if (extend && anchorIndex !== null) applyRange(anchorIndex, index, checked);
        else setSelected(row.id, checked);
        anchorIndex = index;
        refreshAll();
      };

      box.addEventListener('click', (event) => {
        const mouse = event as MouseEvent;
        commit(box.checked, mouse.shiftKey === true);
      });
      // Shift with the arrow keys extends from the anchor, so the range is
      // reachable without a pointer.
      box.addEventListener('keydown', (event) => {
        if (!event.shiftKey) return;
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
        event.preventDefault();
        const next = event.key === 'ArrowDown' ? index + 1 : index - 1;
        if (next < 0 || next >= visible.length) return;
        applyRange(index, next, true);
        anchorIndex = index;
        refreshAll();
        body.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')[next]?.focus();
      });

      selectCell.append(box);
      tr.append(selectCell);
      tr.append(el('td', { text: row.category }));
      tr.append(el('td', { text: row.languageName, attrs: row.language === 'yue' ? { lang: 'yue-Hant-HK' } : {} }));
      tr.append(el('td', { text: `${row.level} — ${levelName(ctx, row.level)}` }));
      tr.append(
        el('td', {
          className: 'lang-variants__text',
          text: row.text,
          attrs: row.language === 'yue' ? { lang: 'yue-Hant-HK' } : {}
        })
      );
      body.append(tr);
    });
  };

  /* ---------------- bulk actions ---------------- */

  const toolbar = el('div', { className: 'lang-variants__toolbar' });

  const selectShown = ctx.components.button({
    label: 'core.action.selectAll',
    variant: 'text',
    icon: 'check',
    onClick: () => {
      for (const row of visible) selection.add(row.id);
      refreshAll();
    }
  });

  const selectEvery = ctx.components.button({
    label: 'core.action.selectAll',
    variant: 'text',
    icon: 'check',
    onClick: () => {
      for (const row of rows) selection.add(row.id);
      refreshAll();
    }
  });

  const invert = ctx.components.button({
    label: 'core.action.invertSelection',
    variant: 'text',
    icon: 'refresh',
    onClick: () => {
      for (const row of visible) {
        if (selection.has(row.id)) selection.delete(row.id);
        else selection.add(row.id);
      }
      refreshAll();
    }
  });

  const clearSelection = ctx.components.button({
    label: 'language.table.clear',
    variant: 'text',
    icon: 'close',
    onClick: () => {
      selection.clear();
      anchorIndex = null;
      drawBody();
      refreshAll();
    }
  });

  const selectedRows = (): VariantRow[] => rows.filter((row) => selection.has(row.id));

  const copy = ctx.components.button({
    label: 'language.table.copy',
    variant: 'tonal',
    icon: 'copy',
    onClick: async () => {
      const chosen = selectedRows();
      if (chosen.length === 0) {
        ctx.notify.warn(ctx.t('language.table.none', 'Nothing is selected, so nothing was done.'));
        return;
      }
      const text = chosen
        .map((row) => `${row.category} · ${row.languageName} · level ${row.level}\n${row.text}`)
        .join('\n\n');
      try {
        await navigator.clipboard.writeText(text);
        ctx.notify.success(
          ctx.t('language.table.copied', '{count} variants copied to the clipboard.', {
            values: { count: chosen.length }
          })
        );
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        ctx.notify.error(
          ctx.t('language.table.copyFailed', 'The clipboard refused the copy: {reason}. Nothing was changed.', {
            values: { reason }
          })
        );
      }
    }
  });

  const exportButton = ctx.components.button({
    label: 'language.table.export',
    variant: 'tonal',
    icon: 'download',
    onClick: () => {
      const chosen = selectedRows();
      if (chosen.length === 0) {
        ctx.notify.warn(ctx.t('language.table.none', 'Nothing is selected, so nothing was done.'));
        return;
      }
      const records = chosen.map((row) => ({
        id: row.id,
        category: row.category,
        sample: row.sampleId,
        language: row.language,
        level: row.level,
        text: row.text
      }));
      ctx.components.menu({
        anchor: exportButton,
        label: ctx.t('core.export.format', 'Format'),
        items: ctx.exporter.formats().map((format: ExportFormat) => ({
          id: format,
          label: format.toUpperCase(),
          run: async () => {
            const preflight = ctx.exporter.preflight(records, format);
            if (preflight.losses.length > 0) {
              ctx.notify.warn(
                ctx.t('core.export.losses', '{format} cannot carry every field. These would be flattened or dropped: {fields}', {
                  values: {
                    format: format.toUpperCase(),
                    fields: preflight.losses.map((loss) => loss.field).join(', ')
                  }
                })
              );
            }
            const path = await ctx.exporter.save(records, format, {
              name: 'language-variants',
              schemaVersion: '1',
              defaultFileName: `language-variants.${format}`
            });
            if (path) {
              ctx.notify.success(ctx.t('core.export.saved', 'Exported to {path}', { values: { path } }));
              void ctx.history.record('Exported language preview variants', 'language', {
                format,
                count: records.length,
                path
              });
            }
          }
        }))
      });
    }
  });

  toolbar.append(selectShown, selectEvery, invert, clearSelection, copy, exportButton);

  function relabelScopes(): void {
    // The two select-all actions say exactly what they cover, because "select
    // all" over a filtered list is the one place a count quietly lies.
    const shownLabel = selectShown.querySelector('.md-btn__label');
    if (shownLabel) {
      shownLabel.textContent = ctx.t('language.table.selectShown', 'Select the {count} shown', {
        values: { count: visible.length }
      });
    }
    const everyLabel = selectEvery.querySelector('.md-btn__label');
    if (everyLabel) {
      everyLabel.textContent = ctx.t('language.table.selectEvery', 'Select all {count}, shown or not', {
        values: { count: rows.length }
      });
    }
  }

  drawHead();
  drawBody();
  refreshAll();

  section.append(search.root, toolbar, status, tableWrap);
  section.append(
    el('p', {
      className: 'lang-variants__honesty md-typescale-label-small',
      text: ctx.t(
        'language.table.noDestructive',
        'These rows are shipped preview samples rather than your data, so there is no delete, rename or move here. Copy and export are the whole set of actions this list can honestly offer.'
      )
    })
  );

  const stopI18n = ctx.i18n.onChange(() => {
    rows = buildRows(ctx);
    visible = rows.filter((row) =>
      search
        .query()
        .matches(`${row.category} ${row.languageName} ${row.language} ${row.level} ${row.text}`)
    );
    drawHead();
    drawBody();
    refreshAll();
  });

  ctx.onDispose(() => {
    stopI18n();
    search.destroy();
  });

  return section;
}
