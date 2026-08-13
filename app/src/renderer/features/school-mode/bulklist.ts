import type { AppContext, SearchBarHandle, SearchQuery } from '../../core/registry';
import { el, uniqueId } from './dom';

/**
 * The list every collection in this feature is built from.
 *
 * Selecting one row and repeating an action forty times is the application
 * failing to do its job, so every list here carries the full contract: click and
 * shift-click ranges, a keyboard equivalent for both, a select-all that says
 * plainly whether it means this page or every match, an inverse selection, a
 * reviewable preview with the exact count before anything runs, and honest
 * reporting of whatever the action excluded.
 *
 * Paging is what makes the two select-all scopes mean different things. A list
 * that shows everything at once could offer only one of them truthfully; this
 * one pages, so both are real and the difference between them is visible.
 */

export interface BulkRow {
  id: string;
  /** The prominent line. */
  primary: string;
  /** The compact second line, where the row has one. */
  secondary?: string;
  /** Right-aligned metadata, e.g. a timestamp or a state. */
  meta?: string;
  /** Everything the search bar matches against, already flattened. */
  searchText: string;
  /** The structured record an export or a copy writes out. */
  record: Record<string, unknown>;
  /** Rendered instead of the plain primary line when the row owns a control. */
  render?(host: HTMLElement): void;
}

export interface BulkAction {
  id: string;
  /** i18n key or literal. Never carries an emoji. */
  label: string;
  icon?: string;
  /** True when the outcome cannot be undone; the two-key gate then applies. */
  destructive?: boolean;
  /** Required when `destructive`: exactly what cannot be undone afterwards. */
  irreversible?: string;
  /** Returns a reason to leave a selected row out, or null to include it. */
  exclude?(row: BulkRow): string | null;
  run(rows: BulkRow[], anchor: HTMLElement): void | Promise<void>;
}

export interface BulkListOptions {
  ctx: AppContext;
  /** Accessible name for the list. i18n key or literal. */
  label: string;
  /** i18n key for the search bar's label. */
  searchLabel: string;
  emptyTitle: string;
  emptyBody?: string;
  /** Rows, newest or most relevant first. Re-read on every refresh. */
  rows(): BulkRow[];
  actions: BulkAction[];
  pageSize?: number;
  /** Used as the export file name stem and the export's own record name. */
  exportName: string;
}

export interface BulkListHandle {
  root: HTMLElement;
  refresh(): void;
  destroy(): void;
}

const DEFAULT_PAGE_SIZE = 25;

export function createBulkList(options: BulkListOptions): BulkListHandle {
  const { ctx } = options;
  const listId = uniqueId('school-mode-list');
  const root = el('section', {
    className: 'school-mode__list',
    attrs: { 'data-appearance-id': `school-mode:list:${options.exportName}` }
  });

  const selection = new Set<string>();
  let query: SearchQuery | null = null;
  let page = 0;
  let lastAnchorIndex: number | null = null;
  let destroyed = false;

  const toolbar = el('div', { className: 'school-mode__list-toolbar' });
  const searchHost = el('div', { className: 'school-mode__list-search' });
  const selectionBar = el('div', {
    className: 'school-mode__list-selection',
    attrs: { role: 'group', 'aria-label': ctx.t('schoolMode.list.selected', '{count} selected', { values: { count: 0 } }) }
  });
  const body = el('div', {
    className: 'school-mode__list-body',
    attrs: { role: 'listbox', 'aria-multiselectable': 'true', 'aria-label': label(options.label), id: listId }
  });
  const footer = el('div', { className: 'school-mode__list-footer' });

  const searchBar: SearchBarHandle = ctx.createSearchBar({
    label: options.searchLabel,
    sample: options
      .rows()
      .slice(0, 12)
      .map((row) => row.searchText)
      .join('\n'),
    onChange: (next) => {
      query = next;
      page = 0;
      draw();
    },
    onEscape: () => {
      query = null;
      page = 0;
      draw();
    }
  });
  searchHost.append(searchBar.root);
  toolbar.append(searchHost, selectionBar);
  root.append(toolbar, body, footer);

  function label(value: string): string {
    return ctx.t(value, value);
  }

  function allRows(): BulkRow[] {
    return options.rows();
  }

  function matching(): BulkRow[] {
    const active = query;
    if (!active || active.text.trim() === '') return allRows();
    return allRows().filter((row) => active.matches(row.searchText));
  }

  function pageRows(rows: BulkRow[]): BulkRow[] {
    const size = options.pageSize ?? DEFAULT_PAGE_SIZE;
    const start = page * size;
    return rows.slice(start, start + size);
  }

  function pruneSelection(rows: BulkRow[]): void {
    const live = new Set(rows.map((row) => row.id));
    for (const id of [...selection]) if (!live.has(id)) selection.delete(id);
  }

  function announceSelection(total: number): void {
    ctx.a11y.announce(
      ctx.t('schoolMode.list.announceSelection', '{count} of {total} selected', {
        values: { count: selection.size, total }
      })
    );
  }

  /* ---------------- selection controls ---------------- */

  function drawSelectionBar(matches: BulkRow[], visible: BulkRow[]): void {
    selectionBar.textContent = '';
    selectionBar.setAttribute(
      'aria-label',
      ctx.t('schoolMode.list.selected', '{count} selected', { values: { count: selection.size } })
    );

    const count = el('span', {
      className: 'school-mode__list-count md-typescale-label-large',
      text: ctx.t('schoolMode.list.selected', '{count} selected', { values: { count: selection.size } })
    });

    const selectPage = ctx.components.button({
      label: ctx.t('schoolMode.list.selectPage', 'Select the {count} on this page', {
        values: { count: visible.length }
      }),
      variant: 'text',
      disabled: visible.length === 0,
      disabledReason: ctx.t('schoolMode.list.nothingSelected', 'Nothing is selected, so there is nothing to do.'),
      onClick: () => {
        for (const row of visible) selection.add(row.id);
        draw();
        announceSelection(matches.length);
      }
    });

    const selectAll = ctx.components.button({
      label: ctx.t('schoolMode.list.selectAll', 'Select every match ({count})', { values: { count: matches.length } }),
      variant: 'text',
      disabled: matches.length === 0,
      disabledReason: ctx.t('schoolMode.list.nothingSelected', 'Nothing is selected, so there is nothing to do.'),
      onClick: () => {
        for (const row of matches) selection.add(row.id);
        draw();
        announceSelection(matches.length);
      }
    });

    const invert = ctx.components.button({
      label: ctx.t('schoolMode.list.invert', 'Invert the selection'),
      variant: 'text',
      disabled: matches.length === 0,
      disabledReason: ctx.t('schoolMode.list.nothingSelected', 'Nothing is selected, so there is nothing to do.'),
      onClick: () => {
        for (const row of matches) {
          if (selection.has(row.id)) selection.delete(row.id);
          else selection.add(row.id);
        }
        draw();
        announceSelection(matches.length);
      }
    });

    const clear = ctx.components.button({
      label: ctx.t('schoolMode.list.clear', 'Clear the selection'),
      variant: 'text',
      disabled: selection.size === 0,
      disabledReason: ctx.t('schoolMode.list.nothingSelected', 'Nothing is selected, so there is nothing to do.'),
      onClick: () => {
        selection.clear();
        lastAnchorIndex = null;
        draw();
        announceSelection(matches.length);
      }
    });

    selectionBar.append(count, selectPage, selectAll, invert, clear);

    for (const action of options.actions) {
      const button = ctx.components.button({
        label: action.label,
        variant: action.destructive ? 'outlined' : 'tonal',
        icon: action.icon,
        danger: action.destructive,
        disabled: selection.size === 0,
        disabledReason: ctx.t('schoolMode.list.nothingSelected', 'Nothing is selected, so there is nothing to do.'),
        onClick: () => void runAction(action, button)
      });
      selectionBar.append(button);
    }
  }

  /* ---------------- the preview and the run ---------------- */

  async function runAction(action: BulkAction, anchor: HTMLElement): Promise<void> {
    const selected = allRows().filter((row) => selection.has(row.id));
    if (selected.length === 0) {
      ctx.notify.info(label(action.label), ctx.t('schoolMode.list.nothingSelected', 'Nothing is selected, so there is nothing to do.'));
      return;
    }
    const excluded: Array<{ row: BulkRow; reason: string }> = [];
    const included: BulkRow[] = [];
    for (const row of selected) {
      const reason = action.exclude?.(row) ?? null;
      if (reason) excluded.push({ row, reason });
      else included.push(row);
    }

    const approved = await preview(action, included, excluded, anchor);
    if (!approved) return;

    if (action.destructive) {
      const confirmed = await ctx.confirm.request({
        action: `${label(action.label)} (${included.length})`,
        affected: included.slice(0, 20).map((row) => row.primary),
        irreversible:
          action.irreversible ??
          'This cannot be undone.',
        anchor
      });
      if (!confirmed) return;
    }

    await action.run(included, anchor);
    draw();
  }

  function preview(
    action: BulkAction,
    included: BulkRow[],
    excluded: Array<{ row: BulkRow; reason: string }>,
    anchor: HTMLElement
  ): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      let settled = false;
      const finish = (value: boolean): void => {
        if (settled) return;
        settled = true;
        release();
        handle.close();
        ctx.a11y.focusVisible(anchor);
        resolve(value);
      };

      const handle = ctx.overlay.open({
        anchor,
        role: 'dialog',
        label: ctx.t('schoolMode.list.previewTitle', '{action}: {count} items', {
          values: { action: label(action.label), count: included.length }
        }),
        lightDismiss: false,
        resizeKey: `school-mode.preview.${action.id}`,
        dragKey: `school-mode.preview.${action.id}`,
        onClose: () => finish(false)
      });

      handle.body.append(
        el('h2', {
          className: 'md-typescale-title-medium',
          text: ctx.t('schoolMode.list.previewTitle', '{action}: {count} items', {
            values: { action: label(action.label), count: included.length }
          })
        }),
        el('p', {
          className: 'md-typescale-body-small',
          text: ctx.t('schoolMode.list.previewBody', 'These are the exact items the action will run on. Nothing else is touched.')
        })
      );

      const list = el('ul', { className: 'school-mode__preview-list' });
      for (const row of included) {
        list.append(el('li', { className: 'md-typescale-body-small', text: row.primary }));
      }
      handle.body.append(list);

      if (excluded.length > 0) {
        const reasons = [...new Set(excluded.map((item) => item.reason))].join('; ');
        handle.body.append(
          el('p', {
            className: 'school-mode__warning md-typescale-body-small',
            text: ctx.t('schoolMode.list.previewExcluded', '{count} selected items are excluded: {reason}', {
              values: { count: excluded.length, reason: reasons }
            })
          })
        );
      }

      const actions = el('div', { className: 'school-mode__dialog-actions' });
      const cancel = ctx.components.button({
        label: ctx.t('schoolMode.list.previewCancel', 'Not now'),
        variant: 'text',
        onClick: () => finish(false)
      });
      const run = ctx.components.button({
        label: ctx.t('schoolMode.list.previewRun', 'Run it'),
        variant: action.destructive ? 'outlined' : 'filled',
        danger: action.destructive,
        disabled: included.length === 0,
        disabledReason: ctx.t('schoolMode.list.nothingSelected', 'Nothing is selected, so there is nothing to do.'),
        onClick: () => finish(true)
      });
      actions.append(cancel, run);
      handle.body.append(actions);

      const release = ctx.a11y.trapFocus(handle.root);
      handle.root.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          finish(false);
        }
      });
      window.setTimeout(() => ctx.a11y.focusVisible(run), 0);
    });
  }

  /* ---------------- rows ---------------- */

  function toggle(row: BulkRow, index: number, event: MouseEvent | KeyboardEvent, matches: BulkRow[]): void {
    const rangeSelect = event.shiftKey && lastAnchorIndex !== null;
    if (rangeSelect && lastAnchorIndex !== null) {
      const [from, to] = lastAnchorIndex <= index ? [lastAnchorIndex, index] : [index, lastAnchorIndex];
      for (let cursor = from; cursor <= to; cursor += 1) {
        const target = matches[cursor];
        if (target) selection.add(target.id);
      }
    } else if (selection.has(row.id)) {
      selection.delete(row.id);
      lastAnchorIndex = index;
    } else {
      selection.add(row.id);
      lastAnchorIndex = index;
    }
    draw();
    announceSelection(matches.length);
  }

  function drawRows(matches: BulkRow[], visible: BulkRow[]): void {
    body.textContent = '';
    if (visible.length === 0) {
      body.append(
        ctx.components.emptyState({
          title: allRows().length === 0 ? options.emptyTitle : 'core.search.noMatches',
          body: allRows().length === 0 ? options.emptyBody : undefined
        })
      );
      return;
    }

    visible.forEach((row, offset) => {
      const index = page * (options.pageSize ?? DEFAULT_PAGE_SIZE) + offset;
      const selected = selection.has(row.id);
      const item = el('div', {
        className: `school-mode__row${selected ? ' school-mode__row--selected' : ''}`,
        attrs: {
          role: 'option',
          'aria-selected': String(selected),
          tabindex: '-1',
          'data-row-id': row.id,
          'data-appearance-id': `school-mode:row:${options.exportName}`
        }
      });

      const box = ctx.components.checkbox({
        label: ctx.t('schoolMode.list.selectRow', 'Select {name}', { values: { name: row.primary } }),
        checked: selected,
        onChange: () => undefined
      });
      // The checkbox is the visible affordance; the row owns the click so a
      // shift-range works from anywhere on it rather than only on the box.
      box.root.querySelector('input')?.setAttribute('tabindex', '-1');
      box.root.addEventListener('click', (event) => {
        event.preventDefault();
        toggle(row, index, event as MouseEvent, matches);
      });

      const text = el('div', { className: 'school-mode__row-text' });
      if (row.render) {
        row.render(text);
      } else {
        text.append(el('span', { className: 'md-typescale-body-large', text: row.primary }));
        if (row.secondary) {
          text.append(el('span', { className: 'school-mode__secondary', text: row.secondary }));
        }
      }

      item.append(box.root, text);
      if (row.meta) {
        item.append(el('span', { className: 'school-mode__row-meta md-typescale-label-medium', text: row.meta }));
      }

      item.addEventListener('click', (event) => {
        if ((event.target as HTMLElement).closest('button, a, input')) return;
        toggle(row, index, event, matches);
      });
      item.addEventListener('keydown', (event) => {
        if (event.key === ' ' || event.key === 'Enter') {
          event.preventDefault();
          toggle(row, index, event, matches);
        }
      });

      ctx.appearance.applyTo(item, `school-mode:row:${options.exportName}`);
      body.append(item);
    });

    disposeRoving?.();
    disposeRoving = ctx.a11y.roving(body, () => [...body.querySelectorAll<HTMLElement>('.school-mode__row')], 'vertical');
  }

  let disposeRoving: (() => void) | null = null;

  /* ---------------- paging ---------------- */

  function drawFooter(matches: BulkRow[]): void {
    footer.textContent = '';
    const size = options.pageSize ?? DEFAULT_PAGE_SIZE;
    const pages = Math.max(1, Math.ceil(matches.length / size));
    if (page > pages - 1) page = pages - 1;

    footer.append(
      el('span', {
        className: 'md-typescale-label-medium',
        text: ctx.t('schoolMode.list.page', 'Page {page} of {pages}', { values: { page: page + 1, pages } })
      })
    );

    if (pages > 1) {
      footer.append(
        ctx.components.button({
          label: ctx.t('schoolMode.list.previous', 'Previous page'),
          variant: 'text',
          disabled: page === 0,
          disabledReason: ctx.t('schoolMode.list.page', 'Page {page} of {pages}', {
            values: { page: page + 1, pages }
          }),
          onClick: () => {
            page = Math.max(0, page - 1);
            draw();
          }
        }),
        ctx.components.button({
          label: ctx.t('schoolMode.list.next', 'Next page'),
          variant: 'text',
          disabled: page >= pages - 1,
          disabledReason: ctx.t('schoolMode.list.page', 'Page {page} of {pages}', {
            values: { page: page + 1, pages }
          }),
          onClick: () => {
            page = Math.min(pages - 1, page + 1);
            draw();
          }
        })
      );
    }
  }

  function draw(): void {
    if (destroyed) return;
    const matches = matching();
    pruneSelection(allRows());
    const visible = pageRows(matches);
    drawSelectionBar(matches, visible);
    drawRows(matches, visible);
    drawFooter(matches);
  }

  draw();

  return {
    root,
    refresh: draw,
    destroy: () => {
      destroyed = true;
      disposeRoving?.();
      searchBar.destroy();
      root.remove();
    }
  };
}
