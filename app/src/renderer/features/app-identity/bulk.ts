import { a11y, el, nextId } from '../../core/a11y';
import { components } from '../../core/components';
import type { AppContext, ExportFormat } from '../../core/registry';

/**
 * The selectable table both lists on the About surface are built from.
 *
 * Every list in this application carries the same contract, so it is written
 * once here rather than twice, slightly differently, in two places: multi-select
 * with shift ranges, a keyboard path that does not need a mouse, a select-all
 * that says plainly whether it means what is shown or everything there is, an
 * inverse selection, and actions that show the exact count and a reviewable
 * preview before they do anything.
 *
 * The row checkboxes are real checkboxes, so Space toggles and Tab reaches them
 * without any of this code re-implementing what the platform already does
 * correctly. Arrow keys move between rows, and Shift with an arrow extends the
 * selection the way a list is expected to.
 */

export interface BulkColumn<Row> {
  id: string;
  /** i18n key for the column header. */
  labelKey: string;
  /** The cell's text. Also what the search field matches against. */
  value(row: Row): string;
  /** Optional richer cell. When present it replaces the text. */
  render?(row: Row): HTMLElement;
  /** Rendered in a monospace face — paths, versions, identifiers. */
  mono?: boolean;
}

export interface BulkTableOptions<Row> {
  ctx: AppContext;
  /** i18n key naming the table for assistive technology. */
  labelKey: string;
  /** i18n key for the search field's label and accessible name. */
  searchLabelKey: string;
  columns: Array<BulkColumn<Row>>;
  rows: Row[];
  rowId(row: Row): string;
  /** Human-readable name of one row, used in previews and announcements. */
  rowName(row: Row): string;
  /** Base file name offered when the selection is exported. */
  exportName: string;
  /** A control rendered at the end of each row. Real, never decorative. */
  rowAction?(row: Row): HTMLElement | null;
  /** Registered so timers and listeners are released when the tab closes. */
  onDispose(fn: () => void): void;
}

export interface BulkTableHandle<Row> {
  root: HTMLElement;
  setRows(rows: Row[]): void;
  selection(): Row[];
}

const PREVIEW_LIMIT = 12;

export function createBulkTable<Row>(options: BulkTableOptions<Row>): BulkTableHandle<Row> {
  const { ctx } = options;
  const tableId = nextId('app-identity-table');

  let allRows = [...options.rows];
  let shownRows = [...allRows];
  const selected = new Set<string>();
  let anchorIndex: number | null = null;

  const root = el('section', {
    className: 'app-identity-table',
    attrs: { 'data-appearance-id': `app-identity:table:${options.labelKey}` }
  });

  const searchText = (row: Row): string => options.columns.map((column) => column.value(row)).join(' | ');

  const search = ctx.createSearchBar({
    label: options.searchLabelKey,
    sample: allRows.map((row) => searchText(row)).join('\n'),
    onChange: (query) => {
      shownRows = allRows.filter((row) => query.matches(searchText(row)));
      anchorIndex = null;
      drawBody();
      refreshControls();
    }
  });
  options.onDispose(() => search.destroy());

  /* ---------------- bulk bar ---------------- */

  const bar = el('div', { className: 'app-identity-bulk', attrs: { role: 'group' } });

  const selectShown = components.button({
    label: 'app-identity.bulk.selectShown',
    variant: 'text',
    icon: 'check',
    onClick: () => {
      for (const row of shownRows) selected.add(options.rowId(row));
      afterSelectionChange();
      announceSelection();
    }
  });

  const selectEvery = components.button({
    label: 'app-identity.bulk.selectEvery',
    variant: 'text',
    icon: 'check',
    onClick: () => {
      for (const row of allRows) selected.add(options.rowId(row));
      afterSelectionChange();
      announceSelection();
    }
  });

  const invert = components.button({
    label: 'app-identity.bulk.invert',
    variant: 'text',
    icon: 'refresh',
    onClick: () => {
      for (const row of shownRows) {
        const id = options.rowId(row);
        if (selected.has(id)) selected.delete(id);
        else selected.add(id);
      }
      afterSelectionChange();
      announceSelection();
    }
  });

  const clear = components.button({
    label: 'app-identity.bulk.clear',
    variant: 'text',
    icon: 'close',
    onClick: () => {
      selected.clear();
      afterSelectionChange();
      announceSelection();
    }
  });

  const copy = components.button({
    label: 'app-identity.bulk.copy',
    variant: 'text',
    icon: 'copy',
    onClick: () => void copySelection()
  });

  const exportButton = components.button({
    label: 'app-identity.bulk.export',
    variant: 'text',
    icon: 'download',
    onClick: () => openExportOverlay(exportButton)
  });

  bar.append(selectShown, selectEvery, invert, clear, copy, exportButton);

  const status = el('p', {
    className: 'app-identity-bulk__status md-typescale-body-small',
    attrs: { role: 'status', 'aria-live': 'polite' }
  });

  /* ---------------- table ---------------- */

  const scroller = el('div', { className: 'app-identity-scroll' });
  const table = el('table', {
    className: 'md-table app-identity-table__grid',
    attrs: { id: tableId, 'aria-label': ctx.t(options.labelKey, options.labelKey) }
  });
  const head = el('thead');
  const body = el('tbody');
  table.append(head, body);
  scroller.append(table);

  const headSelectAll = el('input', {
    className: 'app-identity-table__check',
    attrs: { type: 'checkbox' }
  }) as HTMLInputElement;
  headSelectAll.addEventListener('change', () => {
    if (headSelectAll.checked) for (const row of shownRows) selected.add(options.rowId(row));
    else for (const row of shownRows) selected.delete(options.rowId(row));
    afterSelectionChange();
    announceSelection();
  });

  function drawHead(): void {
    head.textContent = '';
    const tr = el('tr');
    const selectCell = el('th', { attrs: { scope: 'col' } });
    headSelectAll.setAttribute(
      'aria-label',
      ctx.t('app-identity.bulk.selectShown', 'Select the {count} shown', { values: { count: shownRows.length } })
    );
    selectCell.append(headSelectAll);
    tr.append(selectCell);
    for (const column of options.columns) {
      tr.append(el('th', { attrs: { scope: 'col' }, text: ctx.t(column.labelKey, column.labelKey) }));
    }
    if (options.rowAction) {
      tr.append(el('th', { attrs: { scope: 'col' }, text: ctx.t('core.action.more', 'More') }));
    }
    head.append(tr);
  }

  function checkboxes(): HTMLInputElement[] {
    return [...body.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
  }

  function applyRange(from: number, to: number, checkedState: boolean): void {
    const start = Math.min(from, to);
    const end = Math.max(from, to);
    for (let index = start; index <= end; index += 1) {
      const row = shownRows[index];
      if (!row) continue;
      const id = options.rowId(row);
      if (checkedState) selected.add(id);
      else selected.delete(id);
    }
  }

  function drawBody(): void {
    body.textContent = '';
    if (shownRows.length === 0) {
      const tr = el('tr');
      tr.append(
        el('td', {
          className: 'md-table__empty',
          text: ctx.t('core.search.noMatches', 'Nothing matched.'),
          attrs: { colspan: String(options.columns.length + (options.rowAction ? 2 : 1)) }
        })
      );
      body.append(tr);
      return;
    }

    shownRows.forEach((row, index) => {
      const id = options.rowId(row);
      const tr = el('tr', { attrs: { 'data-row-id': id, 'aria-selected': String(selected.has(id)) } });

      const selectCell = el('td');
      const box = el('input', {
        className: 'app-identity-table__check',
        attrs: {
          type: 'checkbox',
          'data-index': String(index),
          'aria-label': ctx.t('app-identity.bulk.selectRow', 'Select {name}', { values: { name: options.rowName(row) } })
        }
      }) as HTMLInputElement;
      box.checked = selected.has(id);
      box.addEventListener('click', (event) => {
        const mouse = event as MouseEvent;
        if (mouse.shiftKey && anchorIndex !== null) {
          applyRange(anchorIndex, index, box.checked);
        } else if (box.checked) {
          selected.add(id);
        } else {
          selected.delete(id);
        }
        anchorIndex = index;
        afterSelectionChange();
      });
      box.addEventListener('keydown', (event) => {
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
        event.preventDefault();
        const boxes = checkboxes();
        const next = event.key === 'ArrowDown' ? index + 1 : index - 1;
        const target = boxes[next];
        if (!target) return;
        if (event.shiftKey) {
          applyRange(index, next, box.checked);
          afterSelectionChange();
        }
        anchorIndex = next;
        const refreshed = checkboxes()[next];
        (refreshed ?? target).focus();
      });
      selectCell.append(box);
      tr.append(selectCell);

      for (const column of options.columns) {
        const cell = el('td', { className: column.mono ? 'app-identity-table__mono' : undefined });
        const rendered = column.render?.(row);
        if (rendered) cell.append(rendered);
        else cell.textContent = column.value(row);
        tr.append(cell);
      }

      if (options.rowAction) {
        const cell = el('td');
        const action = options.rowAction(row);
        if (action) cell.append(action);
        tr.append(cell);
      }

      body.append(tr);
    });
  }

  table.addEventListener('keydown', (event) => {
    if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'a') return;
    event.preventDefault();
    for (const row of shownRows) selected.add(options.rowId(row));
    afterSelectionChange();
    announceSelection();
  });

  /* ---------------- selection plumbing ---------------- */

  function selectedRows(): Row[] {
    return allRows.filter((row) => selected.has(options.rowId(row)));
  }

  function refreshControls(): void {
    const count = selectedRows().length;
    const nothingSelected = count === 0;
    const reason = 'app-identity.bulk.needSelection';
    for (const node of [copy, exportButton]) {
      node.disabled = nothingSelected;
      if (nothingSelected) {
        const explanation = ctx.t(reason, 'Nothing is selected yet, so there is nothing to act on.');
        node.title = explanation;
        node.setAttribute('aria-description', explanation);
      } else {
        node.removeAttribute('title');
        node.removeAttribute('aria-description');
      }
    }

    const shownSelected = shownRows.filter((row) => selected.has(options.rowId(row))).length;
    headSelectAll.checked = shownRows.length > 0 && shownSelected === shownRows.length;
    headSelectAll.indeterminate = shownSelected > 0 && shownSelected < shownRows.length;

    const shownLabel = shownRows.length;
    setButtonLabel(
      selectShown,
      ctx.t('app-identity.bulk.selectShown', 'Select the {count} shown', { values: { count: shownLabel } })
    );
    setButtonLabel(
      selectEvery,
      ctx.t('app-identity.bulk.selectEvery', 'Select every one of the {count}', { values: { count: allRows.length } })
    );
    status.textContent = ctx.t('app-identity.bulk.status', '{selected} selected · {shown} of {total} shown', {
      values: { selected: count, shown: shownRows.length, total: allRows.length }
    });
    headSelectAll.setAttribute(
      'aria-label',
      ctx.t('app-identity.bulk.selectShown', 'Select the {count} shown', { values: { count: shownLabel } })
    );
  }

  function setButtonLabel(node: HTMLButtonElement, text: string): void {
    const labelNode = node.querySelector('.md-btn__label');
    if (labelNode) labelNode.textContent = text;
  }

  function afterSelectionChange(): void {
    for (const tr of body.querySelectorAll<HTMLTableRowElement>('tr[data-row-id]')) {
      const id = tr.dataset.rowId ?? '';
      const isSelected = selected.has(id);
      tr.setAttribute('aria-selected', String(isSelected));
      const box = tr.querySelector<HTMLInputElement>('input[type="checkbox"]');
      if (box) box.checked = isSelected;
    }
    refreshControls();
  }

  function announceSelection(): void {
    a11y.announce(
      ctx.t('app-identity.bulk.status', '{selected} selected · {shown} of {total} shown', {
        values: { selected: selectedRows().length, shown: shownRows.length, total: allRows.length }
      })
    );
  }

  /* ---------------- actions ---------------- */

  function previewList(rows: Row[]): HTMLElement {
    const wrap = el('div', { className: 'app-identity-preview-list' });
    const list = el('ul', { className: 'md-list', attrs: { role: 'list' } });
    for (const row of rows.slice(0, PREVIEW_LIMIT)) {
      list.append(el('li', { className: 'md-list-item', text: options.rowName(row) }));
    }
    wrap.append(list);
    if (rows.length > PREVIEW_LIMIT) {
      wrap.append(
        el('p', {
          className: 'md-typescale-body-small',
          text: ctx.t('app-identity.bulk.previewMore', '…and {count} more', {
            values: { count: rows.length - PREVIEW_LIMIT }
          })
        })
      );
    }
    return wrap;
  }

  function toRecord(row: Row): Record<string, unknown> {
    const record: Record<string, unknown> = {};
    for (const column of options.columns) record[column.id] = column.value(row);
    return record;
  }

  function toText(rows: Row[]): string {
    const header = options.columns.map((column) => ctx.t(column.labelKey, column.labelKey)).join('\t');
    const lines = rows.map((row) => options.columns.map((column) => column.value(row)).join('\t'));
    return [header, ...lines].join('\n');
  }

  async function copySelection(): Promise<void> {
    const rows = selectedRows();
    if (rows.length === 0) return;
    const approved = await components.dialog({
      title: ctx.t('app-identity.bulk.previewTitle', '{count} rows will be copied', {
        values: { count: rows.length },
        dialog: true
      }),
      body: previewList(rows),
      confirmLabel: 'core.action.copy',
      cancelLabel: 'core.action.cancel'
    });
    if (!approved) return;
    try {
      await navigator.clipboard.writeText(toText(rows));
      ctx.notify.success(
        ctx.t('app-identity.bulk.copied', '{count} rows are on the clipboard', { values: { count: rows.length } })
      );
    } catch (error) {
      ctx.notify.error(
        ctx.t('app-identity.bulk.copyFailed', 'The clipboard refused the text: {reason}', {
          values: { reason: error instanceof Error ? error.message : String(error) }
        })
      );
    }
  }

  function openExportOverlay(anchor: HTMLElement): void {
    const rows = selectedRows();
    if (rows.length === 0) return;
    const records = rows.map((row) => toRecord(row));

    const handle = ctx.overlay.open({
      anchor,
      placement: 'bottom-end',
      role: 'dialog',
      label: ctx.t('app-identity.export.heading', 'Export {count} rows', { values: { count: rows.length } }),
      resizeKey: 'app-identity-export',
      dragKey: 'app-identity-export'
    });

    handle.body.append(
      el('h3', {
        className: 'md-typescale-title-small',
        text: ctx.t('app-identity.export.heading', 'Export {count} rows', { values: { count: rows.length } })
      })
    );

    const losses = el('div', { className: 'app-identity-export__losses', attrs: { role: 'status' } });
    let format: ExportFormat = 'json';

    const refreshLosses = (): void => {
      losses.textContent = '';
      const preflight = ctx.exporter.preflight(records, format);
      if (preflight.losses.length === 0) {
        losses.append(
          el('p', {
            className: 'md-typescale-body-small',
            text: ctx.t('app-identity.export.noLosses', 'This format carries every field exactly as it is.')
          })
        );
        return;
      }
      losses.append(
        el('p', {
          className: 'md-typescale-body-small',
          text: ctx.t('app-identity.export.losses', 'This format cannot carry every field faithfully:')
        })
      );
      const list = el('ul', { className: 'md-list', attrs: { role: 'list' } });
      for (const loss of preflight.losses) {
        list.append(el('li', { className: 'md-list-item', text: `${loss.field} — ${loss.reason}` }));
      }
      losses.append(list);
    };

    const formatSelect = components.select({
      label: 'app-identity.export.format',
      value: format,
      options: ctx.exporter.formats().map((value) => ({ value, label: value.toUpperCase() })),
      onChange: (value) => {
        format = value as ExportFormat;
        refreshLosses();
      }
    });

    const run = components.button({
      label: 'app-identity.export.run',
      variant: 'filled',
      icon: 'save',
      onClick: async () => {
        run.disabled = true;
        const busy = ctx.t('app-identity.export.run', 'Choose a file and write it');
        run.title = busy;
        try {
          const path = await ctx.exporter.save(records, format, {
            name: options.exportName,
            defaultFileName: `${options.exportName}.${format === 'markdown' ? 'md' : format}`
          });
          if (path) {
            ctx.notify.success(ctx.t('app-identity.export.saved', 'Written to {path}', { values: { path } }));
            handle.close();
          } else {
            ctx.notify.info(ctx.t('app-identity.export.cancelled', 'No file was chosen, so nothing was written.'));
          }
        } finally {
          run.disabled = false;
          run.removeAttribute('title');
        }
      }
    });

    handle.body.append(formatSelect.root, losses, previewList(rows), run);
    refreshLosses();
  }

  /* ---------------- assembly ---------------- */

  root.append(search.root, bar, status, scroller);
  drawHead();
  drawBody();
  refreshControls();

  return {
    root,
    setRows: (rows: Row[]) => {
      allRows = [...rows];
      const shownIds = new Set(allRows.map((row) => options.rowId(row)));
      for (const id of [...selected]) if (!shownIds.has(id)) selected.delete(id);
      const query = search.query();
      shownRows = allRows.filter((row) => query.matches(searchText(row)));
      drawHead();
      drawBody();
      refreshControls();
    },
    selection: () => selectedRows()
  };
}
