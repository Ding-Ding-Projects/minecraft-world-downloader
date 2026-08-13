import { el } from '../../core/a11y';
import type { DataTableHandle, TabContext } from '../../core/registry';

/**
 * The bulk-action bar every list in this feature carries.
 *
 * Two things it refuses to be vague about.
 *
 * **Scope.** "Select all" is two different promises depending on whether a
 * search is narrowing the list, so it is two buttons that each say which they
 * mean and how many rows that is. A single button whose meaning silently
 * changes with the filter is how somebody deletes forty rows intending eight.
 *
 * **Effect.** Every action states the exact number of rows it will touch before
 * it runs, and reports what it actually did afterwards — including the rows it
 * skipped and why, rather than reporting a whole batch as done when part of it
 * was refused.
 */

export interface BulkAction<Row> {
  id: string;
  /** i18n key for the button. */
  label: string;
  icon?: string;
  danger?: boolean;
  /**
   * Rows this action would refuse, with the reason. Returning a non-empty
   * string disables the button and that string becomes its stated reason.
   */
  disabledReason(rows: Row[]): string | null;
  run(rows: Row[], anchor: HTMLElement): void | Promise<void>;
}

export interface BulkBarOptions<Row> {
  ctx: TabContext;
  /** Every row the collection holds, filter ignored. */
  everything(): Row[];
  /** The rows the table is showing right now. */
  shown(): Row[];
  rowId(row: Row): string;
  actions: Array<BulkAction<Row>>;
}

export interface BulkBarHandle<Row> {
  root: HTMLElement;
  /** Call after the table's selection or contents changed. */
  refresh(): void;
  /** Wire this into `dataTable({ onSelectionChange })`. */
  onSelectionChange(ids: string[]): void;
  /** Wire the table in once it exists; the bar is built before it. */
  attach(table: DataTableHandle<Row>): void;
  selected(): Row[];
}

export function buildBulkBar<Row>(options: BulkBarOptions<Row>): BulkBarHandle<Row> {
  const { ctx } = options;
  let table: DataTableHandle<Row> | null = null;
  /** The row the last selection click landed on, for shift-ranges. */
  let anchorId: string | null = null;

  const root = el('div', { className: 'external-editor-bulk' });
  const count = el('p', {
    className: 'external-editor-bulk__count md-typescale-label-large',
    attrs: { role: 'status', 'aria-live': 'polite' }
  });

  const scope = el('div', { className: 'external-editor-bulk__row' });
  const actionRow = el('div', { className: 'external-editor-bulk__row' });

  const selectedRows = (): Row[] => {
    if (!table) return [];
    const ids = new Set(table.selection());
    return options.everything().filter((row) => ids.has(options.rowId(row)));
  };

  const buttons: Array<{ action: BulkAction<Row>; node: HTMLButtonElement }> = [];

  const refresh = (): void => {
    const chosen = selectedRows();
    const shownCount = options.shown().length;
    const totalCount = options.everything().length;

    count.textContent = ctx.t(
      'externalEditor.bulk.count',
      '{selected} selected of {shown} shown, {total} in total.',
      {
        values: {
          selected: String(chosen.length),
          shown: String(shownCount),
          total: String(totalCount)
        }
      }
    );

    // Only the label text is rewritten, so the button keeps its icon: clearing
    // the whole button would take the icon with it and leave a bare word.
    setLabel(
      selectShown,
      ctx.t('externalEditor.bulk.selectShown', 'Select the {count} rows shown', {
        values: { count: String(shownCount) }
      })
    );
    setLabel(
      selectAll,
      ctx.t('externalEditor.bulk.selectEverything', 'Select every row ({count})', {
        values: { count: String(totalCount) }
      })
    );

    const nothingShown = ctx.t('externalEditor.bulk.nothingShown', 'No rows are shown to select.');
    const nothingAtAll = ctx.t('externalEditor.bulk.nothingAtAll', 'There is nothing in this list yet.');
    setDisabled(selectShown, shownCount === 0, nothingShown);
    setDisabled(selectAll, totalCount === 0, nothingAtAll);
    setDisabled(invert, shownCount === 0, nothingShown);
    setDisabled(
      clear,
      chosen.length === 0,
      ctx.t('externalEditor.bulk.nothingSelected', 'Nothing is selected.')
    );

    for (const { action, node } of buttons) {
      const reason = action.disabledReason(chosen);
      setDisabled(node, reason !== null, reason ?? '');
    }
  };

  const setLabel = (node: HTMLButtonElement, text: string): void => {
    const span = node.querySelector('.md-btn__label');
    if (span) span.textContent = text;
    else node.append(el('span', { className: 'md-btn__label', text }));
  };

  const setDisabled = (node: HTMLButtonElement, disabled: boolean, reason: string): void => {
    node.disabled = disabled;
    if (disabled && reason !== '') {
      node.title = reason;
      node.setAttribute('aria-description', reason);
    } else {
      node.removeAttribute('title');
      node.removeAttribute('aria-description');
    }
  };

  const applySelection = (ids: string[]): void => {
    table?.setSelection(ids);
    refresh();
  };

  const selectShown = ctx.components.button({
    label: 'externalEditor.bulk.selectShown',
    variant: 'text',
    icon: 'check',
    onClick: () => applySelection(options.shown().map(options.rowId))
  });

  const selectAll = ctx.components.button({
    label: 'externalEditor.bulk.selectEverything',
    variant: 'text',
    icon: 'check',
    onClick: () => applySelection(options.everything().map(options.rowId))
  });

  const invert = ctx.components.button({
    label: 'externalEditor.bulk.invert',
    variant: 'text',
    icon: 'refresh',
    onClick: () => {
      const current = new Set(table?.selection() ?? []);
      const next = options
        .shown()
        .map(options.rowId)
        .filter((id) => !current.has(id));
      // Rows outside the current filter keep whatever state they had, because a
      // filtered inverse that silently reaches rows nobody can see is the same
      // trap as an unscoped select-all.
      for (const id of current) {
        if (!options.shown().some((row) => options.rowId(row) === id)) next.push(id);
      }
      applySelection(next);
    }
  });

  const clear = ctx.components.button({
    label: 'externalEditor.bulk.clear',
    variant: 'text',
    icon: 'close',
    onClick: () => {
      table?.clearSelection();
      anchorId = null;
      refresh();
    }
  });

  scope.append(selectShown, selectAll, invert, clear);

  for (const action of options.actions) {
    const node = ctx.components.button({
      label: action.label,
      variant: action.danger === true ? 'outlined' : 'tonal',
      icon: action.icon,
      danger: action.danger === true,
      onClick: (event) => {
        const chosen = selectedRows();
        if (chosen.length === 0) return;
        void Promise.resolve(action.run(chosen, event.currentTarget as HTMLElement)).then(() => refresh());
      }
    });
    buttons.push({ action, node });
    actionRow.append(node);
  }

  root.append(count, scope, actionRow);

  /**
   * Shift-click and Shift+Space extend a range.
   *
   * The table draws its own checkbox per row, so the range lives here rather
   * than inside the component: a click on a row's checkbox with Shift held
   * selects every row between the last one clicked and this one, in the order
   * they are currently shown — which is the order the user can see, not the
   * order the data happens to be stored in.
   */
  const extendRange = (toId: string, additive: boolean): void => {
    if (!table) return;
    const order = options.shown().map(options.rowId);
    const from = anchorId === null ? -1 : order.indexOf(anchorId);
    const to = order.indexOf(toId);
    if (to === -1) return;
    if (from === -1) {
      // No range has been started yet, so a shift-click is simply a click: the
      // row becomes the selection and the anchor for the next one.
      anchorId = toId;
      applySelection(additive ? [...new Set([...table.selection(), toId])] : [toId]);
      return;
    }
    const [start, end] = from <= to ? [from, to] : [to, from];
    const range = order.slice(start, end + 1);
    const next = additive ? new Set([...table.selection(), ...range]) : new Set(range);
    applySelection([...next]);
  };

  /**
   * The row a pointer or keyboard event landed on, when it landed on that row's
   * own selection checkbox rather than somewhere else in the row. Anything else
   * in the row — a button in a cell, the text — is left alone.
   */
  const rowIdOfSelectionTarget = (target: EventTarget | null): string | null => {
    if (!(target instanceof HTMLElement)) return null;
    if (target.closest('.md-checkbox') === null) return null;
    const row = target.closest('tr[data-row-id]');
    if (!(row instanceof HTMLElement)) return null;
    return row.dataset.rowId ?? null;
  };

  /*
   * Handled on click rather than mousedown: a checkbox is toggled by the click
   * event's default action, so cancelling it in the capture phase is what stops
   * the range gesture from also flipping the row it started on. Cancelling
   * mousedown would not prevent the toggle, and the row would come out inverted.
   */
  const onClick = (event: MouseEvent): void => {
    const id = rowIdOfSelectionTarget(event.target);
    if (id === null) return;
    if (event.shiftKey) {
      event.preventDefault();
      event.stopPropagation();
      extendRange(id, true);
      return;
    }
    anchorId = id;
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== ' ' || !event.shiftKey) return;
    const id = rowIdOfSelectionTarget(event.target);
    if (id === null) return;
    event.preventDefault();
    event.stopPropagation();
    extendRange(id, true);
  };

  return {
    root,
    refresh,
    onSelectionChange: () => refresh(),
    attach: (handle: DataTableHandle<Row>) => {
      table = handle;
      handle.root.addEventListener('click', onClick, true);
      handle.root.addEventListener('keydown', onKeyDown, true);
      refresh();
    },
    selected: selectedRows
  };
}
