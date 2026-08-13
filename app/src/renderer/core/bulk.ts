import { el } from './a11y';
import { components } from './components';
import { confirmService } from './confirm';
import { i18n } from './i18n';

/**
 * Bulk actions for a list, table or grid: multi-select with shift-ranges and
 * a keyboard equivalent, an honestly-scoped select-all, inverse selection,
 * and the full action set rather than a token subset — with an exact count
 * and a reviewable preview before anything runs.
 *
 * `components.dataTable` and `components.listItem` already hand a caller
 * `selectable` checkboxes and a `selection()`/`setSelection()` pair. What
 * they do not do is decide what "select all" MEANS (every row currently
 * shown, or every row that matches — those are different answers once a
 * search is active), track a shift-click anchor for ranges, or build the
 * bar that says what a bulk action is about to do before it does it. That is
 * this module's job, and it is deliberately generic: the same controller and
 * bar work for a chat log, a profile list, a captured-message table or a
 * notification centre.
 */

export interface BulkController {
  isSelected(id: string): boolean;
  /** Toggles one id. When `rangeAnchor` is set, selects the whole span between it and `id` in `order`. */
  toggle(id: string, order: string[], rangeAnchor?: string | null): void;
  /** Scope `'shown'` selects only what `shownIds()` currently returns; `'all'` selects every match. */
  selectAll(scope: 'shown' | 'all'): void;
  clear(): void;
  /** Selects everything currently not selected, drops everything that was. */
  invert(): void;
  selected(): string[];
  count(): number;
  onChange(listener: () => void): () => void;
}

export function createBulkController(shownIds: () => string[], allIds: () => string[]): BulkController {
  const selected = new Set<string>();
  const listeners = new Set<() => void>();
  let lastAnchor: string | null = null;

  const emit = (): void => {
    for (const listener of [...listeners]) listener();
  };

  return {
    isSelected: (id) => selected.has(id),
    toggle(id, order, rangeAnchor) {
      const anchor = rangeAnchor ?? lastAnchor;
      if (anchor && anchor !== id && order.includes(anchor) && order.includes(id)) {
        const from = order.indexOf(anchor);
        const to = order.indexOf(id);
        const [start, end] = from < to ? [from, to] : [to, from];
        const willSelect = !selected.has(id);
        for (let i = start; i <= end; i += 1) {
          if (willSelect) selected.add(order[i]);
          else selected.delete(order[i]);
        }
      } else if (selected.has(id)) {
        selected.delete(id);
      } else {
        selected.add(id);
      }
      lastAnchor = id;
      emit();
    },
    selectAll(scope) {
      const ids = scope === 'shown' ? shownIds() : allIds();
      for (const id of ids) selected.add(id);
      emit();
    },
    clear() {
      selected.clear();
      lastAnchor = null;
      emit();
    },
    invert() {
      const next = new Set<string>();
      for (const id of allIds()) if (!selected.has(id)) next.add(id);
      selected.clear();
      for (const id of next) selected.add(id);
      emit();
    },
    selected: () => [...selected],
    count: () => selected.size,
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
}

export interface BulkActionDef {
  id: string;
  /** i18n key. */
  label: string;
  icon?: string;
  danger?: boolean;
  /** The exact action named for the preview, e.g. "Delete 3 download profiles". */
  describe(ids: string[]): string;
  /** What cannot be undone, in unambiguous words. Omit for a reversible action. */
  irreversible?: string;
  /** Runs the action. Return the ids that were skipped and why, if any were. */
  run(ids: string[]): Promise<{ skipped: Array<{ id: string; reason: string }> } | void>;
}

export interface BulkBarOptions {
  controller: BulkController;
  /** ids currently visible under the active filter. */
  shownIds(): string[];
  /** every id that exists, filter or no filter. */
  allIds(): string[];
  /** Resolves an id to its display label, for the preview list. */
  labelFor(id: string): string;
  actions: BulkActionDef[];
}

/** Builds the bulk-action bar. Append `root` wherever the list's toolbar lives. */
export function mountBulkBar(options: BulkBarOptions): { root: HTMLElement; destroy(): void } {
  const { controller } = options;
  const root = el('div', { className: 'md-bulk-bar', attrs: { role: 'toolbar' } });

  const countLabel = el('span', { className: 'md-typescale-body-medium md-bulk-bar__count' });
  const selectShown = components.button({
    label: 'core.bulk.selectShown',
    variant: 'text',
    onClick: () => controller.selectAll('shown')
  });
  const selectAllMatching = components.button({
    label: 'core.bulk.selectAll',
    variant: 'text',
    onClick: () => controller.selectAll('all')
  });
  const invert = components.button({
    label: 'core.bulk.invert',
    variant: 'text',
    onClick: () => controller.invert()
  });
  const clear = components.button({
    label: 'core.bulk.clear',
    variant: 'text',
    onClick: () => controller.clear()
  });

  const actionButtons: HTMLButtonElement[] = [];
  for (const action of options.actions) {
    const button = components.button({
      label: action.label,
      variant: 'outlined',
      danger: action.danger,
      icon: action.icon,
      onClick: () => void runBulkAction(action, button)
    });
    actionButtons.push(button);
  }

  function buildPreviewList(ids: string[]): HTMLElement {
    const list = el('ul', { className: 'md-bulk-bar__preview' });
    for (const id of ids) list.append(el('li', { className: 'md-typescale-body-medium', text: options.labelFor(id) }));
    return list;
  }

  async function runBulkAction(action: BulkActionDef, anchor: HTMLElement): Promise<void> {
    const ids = controller.selected();
    if (ids.length === 0) return;

    // Every destructive bulk action goes through the same two-key gate as a
    // single destructive action -- it is never satisfied by this bar's own,
    // lighter preview dialog.
    const approved = action.danger
      ? await confirmService.request({
          action: action.describe(ids),
          affected: ids.map((id) => options.labelFor(id)),
          irreversible: action.irreversible
            ? i18n.t(action.irreversible, action.irreversible)
            : i18n.t('core.confirm.irreversibleUnknown', 'This cannot be undone.'),
          anchor
        })
      : await components.dialog({
          title: action.describe(ids),
          body: buildPreviewList(ids),
          confirmLabel: i18n.t('core.action.confirm', 'Confirm'),
          cancelLabel: i18n.t('core.action.cancel', 'Cancel')
        });
    if (!approved) return;

    const result = await action.run(ids);
    const skipped = result?.skipped ?? [];
    if (skipped.length > 0) {
      const detail = skipped.map((s) => `${options.labelFor(s.id)}: ${s.reason}`).join('; ');
      countLabel.title = i18n.t('core.bulk.skippedDetail', '{count} skipped: {detail}', {
        values: { count: skipped.length, detail }
      });
    } else {
      countLabel.removeAttribute('title');
    }
    controller.clear();
  }

  const refresh = (): void => {
    const count = controller.count();
    const shown = options.shownIds().length;
    const all = options.allIds().length;
    countLabel.textContent = i18n.t('core.bulk.count', '{count} selected', { values: { count } });
    selectShown.querySelector('.md-btn__label')!.textContent = i18n.t(
      'core.bulk.selectShown',
      'Select all {count} shown',
      { values: { count: shown } }
    );
    selectAllMatching.querySelector('.md-btn__label')!.textContent = i18n.t(
      'core.bulk.selectAll',
      'Select all {count} matching',
      { values: { count: all } }
    );
    const hasSelection = count > 0;
    for (const button of actionButtons) button.disabled = !hasSelection;
    clear.disabled = !hasSelection;
    invert.disabled = all === 0;
  };

  root.append(countLabel, selectShown, selectAllMatching, invert, clear, ...actionButtons);
  const unsubscribe = controller.onChange(refresh);
  refresh();

  return {
    root,
    destroy: () => unsubscribe()
  };
}
