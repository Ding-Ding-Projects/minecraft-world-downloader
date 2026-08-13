import { el } from '../../core/a11y';
import type { AppContext, ButtonOptions, SearchBarHandle, SearchQuery } from '../../core/registry';

/**
 * A list with real bulk actions, used by both of this feature's collections.
 *
 * Selecting one row and repeating an action forty times is the interface
 * failing to do its job, so every list here carries the same set: multi-select
 * with shift ranges, a keyboard equivalent for every pointer gesture, a
 * select-all that says plainly WHICH set it means, an inverse selection, and a
 * reviewable preview with the exact count before anything runs.
 *
 * The select-all distinction is the one that is easiest to get quietly wrong. A
 * button labelled "select all" over a filtered list means one of two very
 * different things, and an action that silently took the wrong one is an action
 * that changed rows the user could not even see. So there are two buttons, each
 * naming its own count.
 */

export interface BulkRow {
  id: string;
}

export interface BulkPlan<Row extends BulkRow> {
  changing: Row[];
  skipped: Array<{ row: Row; reason: string }>;
}

export interface BulkAction<Row extends BulkRow> {
  id: string;
  /** i18n key for the button label. Never carries an emoji. */
  label: string;
  icon?: string;
  danger?: boolean;
  /**
   * Works out what would change before anything does, so the preview can be
   * honest about rows that will be left alone and why.
   */
  plan(rows: Row[]): BulkPlan<Row>;
  run(rows: Row[]): void | Promise<void>;
  /**
   * Present when the action cannot be undone. The gate names exactly this.
   */
  irreversible?: string;
}

export interface BulkListOptions<Row extends BulkRow> {
  ctx: AppContext;
  /** i18n key for the list's accessible name. */
  label: string;
  /** i18n key for the search field's label. */
  searchLabel: string;
  /** Every row, unfiltered, newest state each time it is called. */
  rows(): Row[];
  /** The text a search query is matched against. */
  haystack(row: Row): string;
  /** Builds one row's content. The selection control is added around it. */
  render(row: Row): HTMLElement;
  /** An accessible name for one row's selection checkbox. */
  rowLabel(row: Row): string;
  actions: Array<BulkAction<Row>>;
  emptyTitle: string;
  emptyBody?: string;
  emptyAction?: ButtonOptions;
  /** How many rows are built at once. The rest wait behind "show more". */
  window?: number;
}

export interface BulkListHandle {
  root: HTMLElement;
  refresh(): void;
  selection(): string[];
  destroy(): void;
}

const DEFAULT_WINDOW = 60;

export function createBulkList<Row extends BulkRow>(options: BulkListOptions<Row>): BulkListHandle {
  const { ctx } = options;
  const root = el('div', { className: 'narrator-bulk' });

  const selected = new Set<string>();
  let query: SearchQuery | null = null;
  let windowSize = options.window ?? DEFAULT_WINDOW;
  let lastAnchorIndex: number | null = null;
  let shownRows: Row[] = [];
  /** The live selection control of each rendered row, addressed by row id. */
  const boxes = new Map<string, { node: HTMLElement; set(value: boolean): void }>();

  const status = el('p', {
    className: 'narrator-bulk__status md-typescale-body-small',
    attrs: { role: 'status', 'aria-live': 'polite' }
  });
  const listNode = el('div', {
    className: 'narrator-bulk__list',
    attrs: { role: 'list', 'aria-label': ctx.t(options.label, options.label) }
  });
  const toolbar = el('div', { className: 'narrator-bulk__toolbar' });
  const actionBar = el('div', { className: 'narrator-bulk__actions' });

  const search: SearchBarHandle = ctx.createSearchBar({
    label: options.searchLabel,
    sample: options
      .rows()
      .slice(0, 20)
      .map((row) => options.haystack(row))
      .join('\n'),
    onChange: (next) => {
      query = next;
      windowSize = options.window ?? DEFAULT_WINDOW;
      draw();
    }
  });

  const matching = (): Row[] => {
    const all = options.rows();
    if (!query || (query.text === '' && !query.regex)) return all;
    return all.filter((row) => query?.matches(options.haystack(row)) ?? true);
  };

  /* ---------------- selection ---------------- */

  const setSelected = (id: string, on: boolean): void => {
    if (on) selected.add(id);
    else selected.delete(id);
  };

  const selectRange = (fromIndex: number, toIndex: number, on: boolean): void => {
    const [start, end] = fromIndex <= toIndex ? [fromIndex, toIndex] : [toIndex, fromIndex];
    for (let index = start; index <= end; index += 1) {
      const row = shownRows[index];
      if (row) setSelected(row.id, on);
    }
  };

  /**
   * Reflects the selection without rebuilding a single row.
   *
   * Redrawing the list from inside a checkbox's own change event destroys the
   * control that was just operated, which drops keyboard focus to nowhere and
   * makes a shift-range look like it cancelled itself. Only the state that
   * actually changed is written back.
   */
  const syncSelection = (): void => {
    for (const [id, control] of boxes) {
      const on = selected.has(id);
      control.set(on);
      control.node.setAttribute('aria-selected', String(on));
    }
    const all = options.rows();
    const matched = matching();
    status.textContent = ctx.t('narrator.bulk.count', '{selected} selected of {shown} shown, {total} in total', {
      values: { selected: selected.size, shown: matched.length, total: all.length }
    });
    drawToolbar(matched, all);
    drawActions();
  };

  /* ---------------- drawing ---------------- */

  const draw = (): void => {
    const all = options.rows();
    const matched = matching();
    shownRows = matched.slice(0, windowSize);

    listNode.textContent = '';
    boxes.clear();

    if (all.length === 0) {
      listNode.append(
        ctx.components.emptyState({
          title: options.emptyTitle,
          body: options.emptyBody,
          action: options.emptyAction
        })
      );
    } else if (matched.length === 0) {
      listNode.append(
        ctx.components.emptyState({
          title: 'core.search.noMatches',
          body: query?.error ?? undefined
        })
      );
    } else {
      shownRows.forEach((row, index) => {
        const rowNode = el('div', {
          className: 'narrator-bulk__row',
          attrs: { role: 'listitem', 'data-row-id': row.id, 'aria-selected': String(selected.has(row.id)) }
        });

        let shiftHeld = false;
        const box = ctx.components.checkbox({
          label: options.rowLabel(row),
          checked: selected.has(row.id),
          onChange: (checked) => {
            if (shiftHeld && lastAnchorIndex !== null) selectRange(lastAnchorIndex, index, checked);
            else setSelected(row.id, checked);
            lastAnchorIndex = index;
            shiftHeld = false;
            syncSelection();
          }
        });
        // The checkbox reports only the resulting state, so the modifier has to
        // be captured from the gesture that caused it — pointer or keyboard.
        box.root.addEventListener('pointerdown', (event) => {
          shiftHeld = (event as PointerEvent).shiftKey;
        });
        box.root.addEventListener('keydown', (event) => {
          shiftHeld = (event as KeyboardEvent).shiftKey;
        });
        box.root.querySelector('span')?.classList.add('md-visually-hidden');

        const body = el('div', { className: 'narrator-bulk__body' });
        body.append(options.render(row));

        rowNode.append(box.root, body);
        boxes.set(row.id, { node: rowNode, set: (value) => box.set(value) });

        // The keyboard equivalent of a shift-drag: Shift with an arrow key
        // extends the selection from the row that has focus.
        rowNode.addEventListener('keydown', (event) => {
          if (!event.shiftKey) return;
          if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
          const target = event.key === 'ArrowDown' ? index + 1 : index - 1;
          if (target < 0 || target >= shownRows.length) return;
          event.preventDefault();
          setSelected(row.id, true);
          setSelected(shownRows[target].id, true);
          lastAnchorIndex = target;
          syncSelection();
          const next = listNode.querySelector<HTMLElement>(
            `[data-row-id="${CSS.escape(shownRows[target].id)}"] input[type="checkbox"]`
          );
          next?.focus();
        });

        listNode.append(rowNode);
      });

      if (matched.length > shownRows.length) {
        listNode.append(
          ctx.components.button({
            label: 'core.action.more',
            variant: 'text',
            icon: 'chevronDown',
            onClick: () => {
              windowSize += options.window ?? DEFAULT_WINDOW;
              draw();
            }
          })
        );
      }
    }

    status.textContent = ctx.t('narrator.bulk.count', '{selected} selected of {shown} shown, {total} in total', {
      values: { selected: selected.size, shown: matched.length, total: all.length }
    });

    drawToolbar(matched, all);
    drawActions();
  };

  const drawToolbar = (matched: Row[], all: Row[]): void => {
    toolbar.textContent = '';
    toolbar.append(
      ctx.components.button({
        label: ctx.t('narrator.bulk.selectPage', 'Select the {count} rows shown', {
          values: { count: shownRows.length }
        }),
        variant: 'text',
        icon: 'check',
        disabled: shownRows.length === 0,
        disabledReason: ctx.t('narrator.log.empty', 'There are no rows to select.'),
        onClick: () => {
          for (const row of shownRows) selected.add(row.id);
          syncSelection();
        }
      }),
      ctx.components.button({
        label: ctx.t('narrator.bulk.selectAll', 'Select all {count} rows, including those the search hides', {
          values: { count: all.length }
        }),
        variant: 'text',
        icon: 'check',
        disabled: all.length === 0,
        disabledReason: ctx.t('narrator.log.empty', 'There are no rows to select.'),
        onClick: () => {
          for (const row of all) selected.add(row.id);
          syncSelection();
        }
      }),
      ctx.components.button({
        label: 'narrator.bulk.invert',
        variant: 'text',
        icon: 'refresh',
        onClick: () => {
          for (const row of matched) {
            if (selected.has(row.id)) selected.delete(row.id);
            else selected.add(row.id);
          }
          syncSelection();
        }
      }),
      ctx.components.button({
        label: 'narrator.bulk.clear',
        variant: 'text',
        icon: 'close',
        disabled: selected.size === 0,
        disabledReason: ctx.t('narrator.bulk.none', 'Nothing is selected.'),
        onClick: () => {
          selected.clear();
          lastAnchorIndex = null;
          syncSelection();
        }
      })
    );
  };

  const chosenRows = (): Row[] => options.rows().filter((row) => selected.has(row.id));

  const drawActions = (): void => {
    actionBar.textContent = '';
    for (const action of options.actions) {
      actionBar.append(
        ctx.components.button({
          label: action.label,
          variant: action.danger ? 'outlined' : 'tonal',
          icon: action.icon,
          danger: action.danger,
          disabled: selected.size === 0,
          disabledReason: ctx.t('narrator.bulk.none', 'Nothing is selected, so no action can run.'),
          onClick: (event) => void perform(action, event.currentTarget as HTMLElement)
        })
      );
    }
  };

  /**
   * Runs one action, but only after the user has seen exactly what it does.
   *
   * The preview lists the rows that will change AND the rows that will not,
   * with the reason each was left alone. A bulk action that silently skips
   * items is indistinguishable from one that failed on them.
   */
  const perform = async (action: BulkAction<Row>, anchor: HTMLElement): Promise<void> => {
    const rows = chosenRows();
    if (rows.length === 0) return;
    const plan = action.plan(rows);

    const preview = el('div', { className: 'narrator-bulk__preview' });
    preview.append(
      el('p', {
        className: 'md-typescale-body-medium',
        text: ctx.t('narrator.bulk.previewTitle', '{count} rows will change', {
          values: { count: plan.changing.length }
        })
      })
    );
    const changingList = el('ul', { className: 'narrator-bulk__preview-list' });
    for (const row of plan.changing.slice(0, 40)) {
      changingList.append(el('li', { text: options.rowLabel(row) }));
    }
    if (plan.changing.length > 40) {
      changingList.append(
        el('li', {
          text: ctx.t('narrator.bulk.applied', '{count} rows changed', {
            values: { count: plan.changing.length - 40 }
          })
        })
      );
    }
    preview.append(changingList);

    if (plan.skipped.length > 0) {
      preview.append(
        el('p', {
          className: 'md-typescale-body-small',
          text: ctx.t('narrator.bulk.skipped', '{count} rows were left alone: {reason}', {
            values: { count: plan.skipped.length, reason: plan.skipped[0].reason }
          })
        })
      );
      const skippedList = el('ul', { className: 'narrator-bulk__preview-list' });
      for (const item of plan.skipped.slice(0, 20)) {
        skippedList.append(el('li', { text: `${options.rowLabel(item.row)} — ${item.reason}` }));
      }
      preview.append(skippedList);
    }

    if (plan.changing.length === 0) {
      await ctx.components.dialog({
        title: action.label,
        body: preview,
        confirmLabel: ctx.t('core.action.close', 'Close'),
        cancelLabel: ctx.t('core.action.close', 'Close')
      });
      return;
    }

    if (action.irreversible) {
      const approved = await ctx.confirm.request({
        action: `${ctx.t(action.label, action.label)} (${plan.changing.length})`,
        affected: plan.changing.slice(0, 20).map((row) => options.rowLabel(row)),
        irreversible: action.irreversible,
        anchor
      });
      if (!approved) return;
    } else {
      const approved = await ctx.components.dialog({
        title: action.label,
        body: preview,
        confirmLabel: ctx.t(action.label, action.label)
      });
      if (!approved) return;
    }

    await action.run(plan.changing);
    ctx.a11y.announce(
      ctx.t('narrator.bulk.applied', '{count} rows changed', { values: { count: plan.changing.length } })
    );
    selected.clear();
    draw();
  };

  root.append(search.root, toolbar, status, actionBar, listNode);
  draw();

  return {
    root,
    refresh: draw,
    selection: () => [...selected],
    destroy: () => search.destroy()
  };
}
