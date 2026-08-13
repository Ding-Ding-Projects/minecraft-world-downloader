import { el } from '../../core/a11y';
import { selectorFor } from '../../core/appearance';
import type {
  ExportFormat,
  HistoryEntry,
  HistoryStatus,
  SearchBarHandle,
  SearchQuery,
  TabContext
} from '../../core/registry';
import { createDateRange } from './daterange';
import type { DateRangeHandle, DateRangeValue } from './daterange';
import { diffPayloads } from './diff';
import type { FeatureState } from './state';
import {
  EXPORT_FORMAT_ID,
  MAX_LOAD_ID,
  PAGE_SIZE_ID,
  REDACT_EXPORTS_ID,
  RETENTION_DAYS_ID,
  recordEntry,
  redactRecords
} from './state';
import type { RestorableChange } from './util';
import {
  dayEndIso,
  dayStartIso,
  describeError,
  formatCount,
  formatTimestamp,
  payloadPreview,
  restorableChange,
  safeJson,
  sameValue,
  searchableText
} from './util';

/**
 * The version-history panel.
 *
 * The three filters compose rather than override: the date range narrows what is
 * loaded, the text search narrows that, the action chips narrow that again, and
 * the chip counts are computed from the date-and-text result so an action that
 * has no matches under the current filters is visibly empty rather than quietly
 * absent.
 *
 * Every list in this application carries bulk actions, and "select all" here
 * says which all it means: the page holds a stated number and the match set
 * holds another, and both are offered by name.
 */

const ROW_HEIGHT = 84;
const OVERSCAN = 6;
const NODE_CACHE_LIMIT = 400;

/**
 * Disables a control and says why in the same breath.
 *
 * A disabled button with no explanation reads as broken rather than as blocked,
 * so the reason travels with the state every time it changes.
 */
function setDisabled(button: HTMLButtonElement, disabled: boolean, reason: string): void {
  button.disabled = disabled;
  if (disabled) {
    button.title = reason;
    button.setAttribute('aria-description', reason);
  } else {
    button.removeAttribute('title');
    button.removeAttribute('aria-description');
  }
}

interface Filters {
  range: DateRangeValue;
  actions: Set<string>;
  query: SearchQuery | null;
}

export function mountHistoryPanel(host: HTMLElement, ctx: TabContext, state: FeatureState): void {
  const filters: Filters = { range: { start: null, end: null }, actions: new Set(), query: null };

  let loaded: HistoryEntry[] = [];
  let matched: HistoryEntry[] = [];
  let afterText: HistoryEntry[] = [];
  let status: HistoryStatus | null = null;
  let loadError = '';
  let truncated = false;
  let page = 0;
  let anchorIndex: number | null = null;
  const selection = new Set<string>();
  const nodeCache = new Map<string, HTMLElement>();

  const pageSize = (): number => {
    const raw = Number(ctx.settings.get<number>(PAGE_SIZE_ID, 200));
    return Number.isFinite(raw) && raw >= 10 ? Math.min(2000, Math.round(raw)) : 200;
  };
  const maxLoad = (): number => {
    const raw = Number(ctx.settings.get<number>(MAX_LOAD_ID, 5000));
    return Number.isFinite(raw) && raw >= 100 ? Math.min(100_000, Math.round(raw)) : 5000;
  };

  /* ================================================================ */
  /* Chrome                                                            */
  /* ================================================================ */

  const refreshButton = ctx.components.button({
    label: 'history.action.refresh',
    variant: 'text',
    icon: 'refresh',
    onClick: () => void reload()
  });
  const exportButton = ctx.components.button({
    label: 'history.export.title',
    variant: 'text',
    icon: 'download',
    onClick: (event) => void openExportDialog(matchedOrSelected(), event.currentTarget as HTMLElement)
  });
  const pruneButton = ctx.components.button({
    label: 'history.prune.title',
    variant: 'text',
    icon: 'trash',
    onClick: (event) => void openRetentionPrune(event.currentTarget as HTMLElement)
  });
  const folderButton = ctx.components.button({
    label: 'history.status.openFolder',
    variant: 'text',
    icon: 'folder',
    onClick: () => void openFolder()
  });

  host.append(
    ctx.components.topAppBar({
      title: 'history.panel.title',
      subtitle: 'history.panel.subtitle',
      actions: [refreshButton, exportButton, pruneButton, folderButton]
    })
  );

  /* ---------------- status ---------------- */

  const statusCard = ctx.components.card({ variant: 'outlined' });
  statusCard.id = 'history-status';
  statusCard.setAttribute('data-appearance-id', 'history:status');
  const statusHeading = el('h2', {
    className: 'md-typescale-title-small',
    text: ctx.t('history.status.heading', 'Where this is stored')
  });
  const statusText = el('p', { className: 'md-typescale-body-medium', attrs: { role: 'status' } });
  const statusExtra = el('p', { className: 'md-typescale-body-small history-status__extra' });
  statusExtra.hidden = true;
  const statusActions = el('div', { className: 'history-status__actions' });
  statusActions.append(
    ctx.components.button({ label: 'history.status.openFolder', variant: 'text', onClick: () => void openFolder() }),
    ctx.components.button({ label: 'history.status.retry', variant: 'text', onClick: () => void reload() })
  );
  statusCard.append(statusHeading, statusText, statusExtra, statusActions);
  host.append(statusCard);

  /* ---------------- filters ---------------- */

  const filterSection = el('section', {
    className: 'history-filters',
    attrs: { id: 'history-filters', 'data-appearance-id': 'history:filters' }
  });
  const filterHead = el('div', { className: 'history-filters__head' });
  const filterToggle = el('button', {
    className: 'history-filters__toggle md-btn md-btn--text',
    attrs: { type: 'button', 'aria-expanded': 'true', 'aria-controls': 'history-filters-body' }
  });
  const filterToggleLabel = el('span', { className: 'md-btn__label' });
  filterToggle.append(filterToggleLabel);
  const filterSummary = el('p', {
    className: 'history-filters__summary md-typescale-body-small',
    attrs: { role: 'status' }
  });
  const clearFilters = ctx.components.button({
    label: 'history.filters.clear',
    variant: 'text',
    onClick: () => {
      dateRange.clear();
      filters.actions.clear();
      search.clear();
      filters.query = search.query();
      page = 0;
      applyFilters();
    }
  });
  filterHead.append(filterToggle, filterSummary, clearFilters);

  const filterBody = el('div', { className: 'history-filters__body', attrs: { id: 'history-filters-body' } });
  filterBody.append(
    ctx.components.sectionHeading({
      title: 'history.filters.heading',
      description: 'history.filters.explain'
    })
  );

  const dateRange: DateRangeHandle = createDateRange(ctx, {
    label: 'history.date.label',
    id: 'history-daterange',
    onChange: (value) => {
      filters.range = value;
      page = 0;
      void reload();
    }
  });
  filterBody.append(dateRange.root);

  const actionBlock = el('div', { className: 'history-actions', attrs: { id: 'history-actions' } });
  const actionSearch = ctx.createSearchBar({
    label: 'history.action.searchLabel',
    onChange: () => drawActionChips()
  });
  const actionChips = el('div', { className: 'history-actions__chips', attrs: { role: 'group' } });
  const actionEmpty = el('p', { className: 'md-typescale-body-small' });
  actionBlock.append(
    el('h3', {
      className: 'md-typescale-label-large',
      text: ctx.t('history.action.filterLabel', 'Filter by action')
    }),
    actionSearch.root,
    actionChips,
    actionEmpty
  );
  filterBody.append(actionBlock);

  const search: SearchBarHandle = ctx.createSearchBar({
    label: 'history.search.label',
    placeholder: 'history.search.placeholder',
    sample: 'Changed the language mode\nDeleted the saved server profile\nRestored 2 settings',
    onChange: (query) => {
      filters.query = query;
      page = 0;
      applyFilters();
    }
  });
  search.root.id = 'history-search';
  filterBody.append(search.root);

  filterSection.append(filterHead, filterBody);
  host.append(filterSection);

  const setFiltersExpanded = (expanded: boolean): void => {
    filterBody.hidden = !expanded;
    filterToggle.setAttribute('aria-expanded', String(expanded));
    filterToggleLabel.textContent = expanded
      ? ctx.t('history.filters.hide', 'Hide filters')
      : ctx.t('history.filters.show', 'Show filters');
    state.store.setFiltersExpanded(expanded);
  };
  filterToggle.addEventListener('click', () => setFiltersExpanded(filterBody.hidden));
  setFiltersExpanded(state.store.filtersExpanded());

  /* ---------------- results ---------------- */

  const resultsHead = el('div', { className: 'history-results__head', attrs: { id: 'history-results' } });
  const resultsCount = el('p', { className: 'md-typescale-body-small', attrs: { role: 'status' } });
  const truncationNote = el('p', { className: 'md-typescale-body-small history-results__warning' });
  truncationNote.hidden = true;
  resultsHead.append(resultsCount, truncationNote);
  host.append(resultsHead);

  const bulkBar = el('div', {
    className: 'history-bulk',
    attrs: { role: 'group', 'aria-label': ctx.t('history.bulk.selected', '{count} selected', { values: { count: 0 } }) }
  });
  bulkBar.hidden = true;
  host.append(bulkBar);

  const scroller = el('div', { className: 'history-list', attrs: { tabindex: '-1' } });
  const sizer = el('div', { className: 'history-list__sizer' });
  const viewport = el('ul', {
    className: 'history-list__viewport',
    attrs: { role: 'list', 'aria-label': ctx.t('history.results.heading', 'Entries') }
  });
  sizer.append(viewport);
  scroller.append(sizer);
  const emptyHost = el('div', { className: 'history-list__empty' });
  emptyHost.hidden = true;
  host.append(scroller, emptyHost);

  const pager = el('nav', { className: 'history-pager', attrs: { 'aria-label': ctx.t('history.results.heading', 'Entries') } });
  const pagerLabel = el('span', { className: 'md-typescale-body-small' });
  const previousPage = ctx.components.button({
    label: 'history.results.previous',
    variant: 'outlined',
    onClick: () => {
      if (page === 0) return;
      page -= 1;
      drawList();
    }
  });
  const nextPage = ctx.components.button({
    label: 'history.results.next',
    variant: 'outlined',
    onClick: () => {
      if ((page + 1) * pageSize() >= matched.length) return;
      page += 1;
      drawList();
    }
  });
  pager.append(previousPage, pagerLabel, nextPage);
  host.append(pager);

  /* ================================================================ */
  /* Loading and filtering                                             */
  /* ================================================================ */

  async function reload(): Promise<void> {
    loadError = '';
    const limit = maxLoad();
    const query = {
      from: filters.range.start ? dayStartIso(filters.range.start) : undefined,
      to: filters.range.end ? dayEndIso(filters.range.end) : undefined,
      limit
    };
    const [entriesResult, statusResult] = await Promise.all([
      ctx.studio.history.list(query),
      ctx.studio.history.status()
    ]);
    if (statusResult.ok) status = statusResult.value;
    if (!entriesResult.ok) {
      loadError = entriesResult.error;
      loaded = [];
      truncated = false;
    } else {
      loaded = entriesResult.value;
      truncated = loaded.length >= limit;
    }
    nodeCache.clear();
    drawStatus();
    applyFilters();
  }

  function drawStatus(): void {
    if (loadError) {
      statusText.textContent = ctx.t('history.status.unreadable', 'The history could not be read: {reason}', {
        values: { reason: loadError }
      });
      statusCard.classList.add('history-status--bad');
      statusExtra.hidden = true;
      return;
    }
    if (!status) {
      statusText.textContent = '';
      return;
    }
    statusCard.classList.remove('history-status--bad');
    statusText.textContent =
      status.backend === 'git'
        ? ctx.t('history.status.git', 'A local git repository at {path}. {count} entries. Nothing is pushed anywhere.', {
            values: { path: status.path, count: formatCount(status.entryCount) }
          })
        : ctx.t(
            'history.status.journal',
            'An append-only journal at {path}. {count} entries. git is not in use here: {reason}',
            {
              values: {
                path: status.path,
                count: formatCount(status.entryCount),
                reason: status.degradedReason ?? ''
              }
            }
          );
    const annotationFailure = state.store.failure();
    if (status.backend === 'git' && status.degradedReason) {
      statusExtra.hidden = false;
      statusExtra.textContent = ctx.t('history.status.degraded', 'Entries are still being kept, but not committed. {reason}', {
        values: { reason: status.degradedReason }
      });
    } else if (annotationFailure) {
      statusExtra.hidden = false;
      statusExtra.textContent = annotationFailure;
    } else {
      statusExtra.hidden = true;
      statusExtra.textContent = '';
    }
  }

  function applyFilters(): void {
    const query = filters.query;
    afterText =
      query && query.text.trim() !== ''
        ? loaded.filter((entry) => query.matches(searchableText(entry, state.store.labelOf(entry.id))))
        : [...loaded];
    matched =
      filters.actions.size > 0 ? afterText.filter((entry) => filters.actions.has(entry.action)) : [...afterText];
    const maxPage = Math.max(0, Math.ceil(matched.length / pageSize()) - 1);
    if (page > maxPage) page = maxPage;
    drawActionChips();
    drawList();
    drawFilterSummary();
  }

  function filterDescriptions(): string[] {
    const parts: string[] = [];
    if (filters.range.start || filters.range.end) {
      parts.push(
        `${ctx.t('history.date.label', 'Date range')} ${filters.range.start ?? '…'} – ${filters.range.end ?? '…'}`
      );
    }
    if (filters.actions.size > 0) {
      parts.push(
        ctx.t('history.action.selected', '{count} actions selected', { values: { count: filters.actions.size } })
      );
    }
    const query = filters.query;
    if (query && query.text.trim() !== '') {
      parts.push(`${query.regex ? 'pattern' : 'text'} "${query.text}"`);
    }
    return parts;
  }

  function drawFilterSummary(): void {
    const parts = filterDescriptions();
    filterSummary.textContent =
      parts.length === 0
        ? ctx.t('history.filters.none', 'No filter is applied.')
        : ctx.t('history.filters.active', 'Filtering by {summary}.', { values: { summary: parts.join('; ') } });
  }

  function drawActionChips(): void {
    const counts = new Map<string, number>();
    for (const entry of afterText) counts.set(entry.action, (counts.get(entry.action) ?? 0) + 1);
    // Every action ever recorded is offered, so one with no matches under the
    // current filters shows a zero rather than disappearing.
    const universe = new Map<string, number>();
    for (const entry of loaded) universe.set(entry.action, (universe.get(entry.action) ?? 0) + 1);
    for (const action of filters.actions) if (!universe.has(action)) universe.set(action, 0);

    const query = actionSearch.query();
    actionChips.textContent = '';
    const names = [...universe.keys()].sort((a, b) => a.localeCompare(b));
    let visible = 0;
    for (const action of names) {
      if (!query.matches(action)) continue;
      visible += 1;
      const shown = counts.get(action) ?? 0;
      const total = universe.get(action) ?? 0;
      const chip = ctx.components.chip({
        label: `${action} · ${ctx.t('history.action.countOf', '{shown} of {total}', {
          values: { shown: formatCount(shown), total: formatCount(total) }
        })}`,
        selected: filters.actions.has(action),
        onToggle: (selected) => {
          if (selected) filters.actions.add(action);
          else filters.actions.delete(action);
          page = 0;
          applyFilters();
        }
      });
      if (shown === 0) chip.classList.add('history-actions__chip--empty');
      actionChips.append(chip);
    }
    if (names.length === 0) {
      actionEmpty.hidden = false;
      actionEmpty.textContent = ctx.t(
        'history.action.none',
        'Nothing has been recorded yet, so there are no actions to filter by.'
      );
    } else if (visible === 0) {
      actionEmpty.hidden = false;
      actionEmpty.textContent = ctx.t('core.search.noMatches', 'Nothing matched.');
    } else {
      actionEmpty.hidden = true;
      actionEmpty.textContent = '';
    }
  }

  /* ================================================================ */
  /* The list                                                          */
  /* ================================================================ */

  function pageRows(): HistoryEntry[] {
    const size = pageSize();
    return matched.slice(page * size, page * size + size);
  }

  function drawList(): void {
    const rows = pageRows();
    const size = pageSize();
    const pages = Math.max(1, Math.ceil(matched.length / size));
    pagerLabel.textContent = ctx.t('history.results.page', 'Page {page} of {pages}', {
      values: { page: page + 1, pages }
    });
    setDisabled(previousPage, page === 0, ctx.t('history.results.page', 'Page {page} of {pages}', {
      values: { page: 1, pages }
    }));
    setDisabled(nextPage, page + 1 >= pages, ctx.t('history.results.page', 'Page {page} of {pages}', {
      values: { page: pages, pages }
    }));
    pager.hidden = pages <= 1;

    resultsCount.textContent = ctx.t(
      'history.results.count',
      '{shown} shown of {matched} matching, out of {total} kept.',
      {
        values: {
          shown: formatCount(rows.length),
          matched: formatCount(matched.length),
          total: formatCount(status?.entryCount ?? loaded.length)
        }
      }
    );
    truncationNote.hidden = !truncated;
    if (truncated) {
      truncationNote.textContent = ctx.t(
        'history.results.truncated',
        'Only the newest {limit} entries in this range were loaded. Narrow the range to reach older ones.',
        { values: { limit: formatCount(maxLoad()) } }
      );
    }

    sizer.style.blockSize = `${rows.length * ROW_HEIGHT}px`;

    if (rows.length === 0) {
      scroller.hidden = true;
      emptyHost.hidden = false;
      emptyHost.textContent = '';
      const parts = filterDescriptions();
      if (loaded.length === 0 && parts.length === 0) {
        emptyHost.append(
          ctx.components.emptyState({
            title: ctx.t('history.results.heading', 'Entries'),
            body: ctx.t(
              'history.results.empty',
              'Nothing has been recorded yet. Change a setting or a record and the entry appears here.'
            ),
            action: {
              label: 'core.settings.title',
              variant: 'tonal',
              onClick: () => ctx.tabs.open('core.settings')
            }
          })
        );
      } else {
        emptyHost.append(
          ctx.components.emptyState({
            title: ctx.t('core.search.noMatches', 'Nothing matched.'),
            body: ctx.t('history.results.noMatch', 'No entry matched. Filtered out by {summary}.', {
              values: { summary: parts.join('; ') || ctx.t('history.filters.none', 'No filter is applied.') }
            }),
            action: {
              label: 'history.filters.clear',
              variant: 'tonal',
              onClick: () => {
                dateRange.clear();
                filters.actions.clear();
                search.clear();
                filters.query = search.query();
                page = 0;
                applyFilters();
              }
            }
          })
        );
      }
      drawBulkBar();
      return;
    }

    scroller.hidden = false;
    emptyHost.hidden = true;
    drawWindow();
    drawBulkBar();
  }

  function drawWindow(): void {
    const rows = pageRows();
    const first = Math.max(0, Math.floor(scroller.scrollTop / ROW_HEIGHT) - OVERSCAN);
    const visible = Math.ceil((scroller.clientHeight || ROW_HEIGHT * 8) / ROW_HEIGHT) + OVERSCAN * 2;
    const last = Math.min(rows.length, first + visible);
    viewport.style.transform = `translateY(${first * ROW_HEIGHT}px)`;
    viewport.textContent = '';
    for (let index = first; index < last; index += 1) {
      viewport.append(rowNode(rows[index], page * pageSize() + index));
    }
  }

  scroller.addEventListener('scroll', () => {
    if (!scroller.hidden) drawWindow();
  });

  function rowNode(entry: HistoryEntry, absoluteIndex: number): HTMLElement {
    const cached = nodeCache.get(entry.id);
    if (cached) {
      const box = cached.querySelector<HTMLInputElement>('.history-row__check');
      if (box) box.checked = selection.has(entry.id);
      cached.setAttribute('aria-selected', String(selection.has(entry.id)));
      cached.dataset.index = String(absoluteIndex);
      return cached;
    }

    const row = el('li', {
      className: 'history-row',
      attrs: {
        'data-entry-id': entry.id,
        'data-index': String(absoluteIndex),
        'aria-selected': String(selection.has(entry.id)),
        'data-appearance-id': 'history:row'
      }
    });

    const check = el('input', {
      className: 'history-row__check',
      attrs: {
        type: 'checkbox',
        'aria-label': ctx.t('history.row.select', 'Select entry {id}', { values: { id: entry.id } })
      }
    });
    check.checked = selection.has(entry.id);
    check.addEventListener('click', (event) => {
      const mouse = event as MouseEvent;
      if (mouse.shiftKey && anchorIndex !== null) {
        extendSelection(anchorIndex, absoluteIndex, check.checked);
      } else {
        toggle(entry.id, check.checked);
        anchorIndex = absoluteIndex;
      }
    });

    const main = el('div', { className: 'history-row__main' });
    const headline = el('button', {
      className: 'history-row__headline',
      attrs: { type: 'button' }
    });
    headline.append(
      el('span', { className: 'md-typescale-body-large history-row__action', text: entry.action }),
      el('span', {
        className: 'md-typescale-label-small history-row__meta',
        text: `${formatTimestamp(entry.timestamp)} · ${entry.source} · ${entry.id}`,
        attrs: { title: entry.timestamp }
      })
    );
    headline.addEventListener('click', () => openDetails(entry, headline));

    const preview = el('span', {
      className: 'md-typescale-body-small history-row__preview',
      text: payloadPreview(entry.payload)
    });
    main.append(headline, preview);

    // The label is the real control, not a printout of one: editing it here is
    // the same code path as the bulk label action.
    const labelField = ctx.components.textField({
      label: 'history.row.label',
      value: state.store.labelOf(entry.id),
      placeholder: 'history.row.labelPlaceholder',
      onCommit: (value) => void applyLabel(entry, value)
    });
    labelField.root.classList.add('history-row__label');

    const menuButton = ctx.components.iconButton({
      icon: 'more',
      label: ctx.t('history.row.actions', 'Entry actions'),
      onClick: () => openRowMenu(entry, menuButton)
    });

    row.append(check, main, labelField.root, menuButton);
    // The row's own menu replaces the global element menu rather than opening
    // beside it, so it carries that menu's commands too — Edit appearance… and
    // Lock this element… are both on it. Propagation is stopped precisely
    // because two menus opening at once is worse than either.
    row.addEventListener('contextmenu', (event) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      event.preventDefault();
      event.stopPropagation();
      openRowMenu(entry, menuButton);
    });

    if (nodeCache.size > NODE_CACHE_LIMIT) {
      const oldest = nodeCache.keys().next();
      if (!oldest.done) nodeCache.delete(oldest.value);
    }
    nodeCache.set(entry.id, row);
    return row;
  }

  /* ---------------- selection ---------------- */

  function toggle(id: string, selected: boolean): void {
    if (selected) selection.add(id);
    else selection.delete(id);
    syncRowState();
    drawBulkBar();
  }

  function extendSelection(from: number, to: number, selected: boolean): void {
    const low = Math.min(from, to);
    const high = Math.max(from, to);
    for (let index = low; index <= high; index += 1) {
      const entry = matched[index];
      if (!entry) continue;
      if (selected) selection.add(entry.id);
      else selection.delete(entry.id);
    }
    anchorIndex = to;
    syncRowState();
    drawBulkBar();
  }

  function syncRowState(): void {
    for (const [id, node] of nodeCache) {
      const box = node.querySelector<HTMLInputElement>('.history-row__check');
      if (box) box.checked = selection.has(id);
      node.setAttribute('aria-selected', String(selection.has(id)));
    }
  }

  // The keyboard equivalent of shift-clicking a range, plus select-all.
  scroller.addEventListener('keydown', (event) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    // Inside a text box, Ctrl+A means "select this text" and must keep meaning
    // that; hijacking it there would make the label field unusable.
    const editing =
      target instanceof HTMLTextAreaElement ||
      (target instanceof HTMLInputElement && target.type !== 'checkbox');
    if (!editing && event.key.toLowerCase() === 'a' && !event.shiftKey && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      for (const entry of matched) selection.add(entry.id);
      syncRowState();
      drawBulkBar();
      ctx.a11y.announce(
        ctx.t('history.bulk.selectAll', 'Select all {count} matching entries', {
          values: { count: formatCount(matched.length) }
        })
      );
      return;
    }
    if (!target.classList.contains('history-row__check')) return;
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const row = target.closest<HTMLElement>('.history-row');
    if (!row) return;
    const index = Number(row.dataset.index ?? '0');
    const nextIndex = event.key === 'ArrowDown' ? index + 1 : index - 1;
    if (nextIndex < 0 || nextIndex >= matched.length) return;
    event.preventDefault();
    if (event.shiftKey) {
      extendSelection(anchorIndex ?? index, nextIndex, true);
    } else {
      anchorIndex = nextIndex;
    }
    const size = pageSize();
    const targetPage = Math.floor(nextIndex / size);
    if (targetPage !== page) {
      page = targetPage;
      drawList();
    }
    scroller.scrollTop = (nextIndex - page * size) * ROW_HEIGHT - scroller.clientHeight / 2;
    drawWindow();
    const nextEntry = matched[nextIndex];
    viewport
      .querySelector<HTMLElement>(`[data-entry-id="${nextEntry.id}"] .history-row__check`)
      ?.focus();
  });

  /* ---------------- bulk bar ---------------- */

  function selectedEntries(): HistoryEntry[] {
    return matched.filter((entry) => selection.has(entry.id));
  }

  function matchedOrSelected(): HistoryEntry[] {
    return selection.size > 0 ? selectedEntries() : matched;
  }

  function drawBulkBar(): void {
    const count = selection.size;
    bulkBar.hidden = count === 0;
    bulkBar.textContent = '';
    if (count === 0) return;

    const rows = pageRows();
    const label = el('span', {
      className: 'md-typescale-label-large',
      text: ctx.t('history.bulk.selected', '{count} selected', { values: { count: formatCount(count) } })
    });
    bulkBar.setAttribute('aria-label', label.textContent ?? '');

    const selectPage = ctx.components.button({
      label: ctx.t('history.bulk.selectPage', 'Select the {count} on this page', {
        values: { count: formatCount(rows.length) }
      }),
      variant: 'text',
      onClick: () => {
        for (const entry of rows) selection.add(entry.id);
        syncRowState();
        drawBulkBar();
      }
    });
    const selectAll = ctx.components.button({
      label: ctx.t('history.bulk.selectAll', 'Select all {count} matching entries', {
        values: { count: formatCount(matched.length) }
      }),
      variant: 'text',
      onClick: () => {
        for (const entry of matched) selection.add(entry.id);
        syncRowState();
        drawBulkBar();
      }
    });
    const invert = ctx.components.button({
      label: 'history.bulk.invert',
      variant: 'text',
      onClick: () => {
        for (const entry of matched) {
          if (selection.has(entry.id)) selection.delete(entry.id);
          else selection.add(entry.id);
        }
        syncRowState();
        drawBulkBar();
      }
    });
    const clear = ctx.components.button({
      label: 'history.bulk.clear',
      variant: 'text',
      onClick: () => {
        selection.clear();
        syncRowState();
        drawBulkBar();
      }
    });

    const exportSelected = ctx.components.button({
      label: 'history.bulk.export',
      variant: 'tonal',
      icon: 'download',
      onClick: (event) => void openExportDialog(selectedEntries(), event.currentTarget as HTMLElement)
    });
    const exportEditor = ctx.components.button({
      label: 'history.bulk.exportEditor',
      variant: 'text',
      icon: 'code',
      onClick: () => void exportToEditor(selectedEntries())
    });
    const copy = ctx.components.button({
      label: 'history.bulk.copy',
      variant: 'text',
      icon: 'copy',
      onClick: () => void copyEntries(selectedEntries())
    });
    const labelAll = ctx.components.button({
      label: 'history.bulk.label',
      variant: 'text',
      icon: 'edit',
      onClick: () => void openBulkLabel(selectedEntries())
    });
    const clearLabels = ctx.components.button({
      label: 'history.bulk.clearLabels',
      variant: 'text',
      onClick: () => void clearLabelsFor(selectedEntries())
    });
    const compare = ctx.components.button({
      label: 'history.bulk.compare',
      variant: 'text',
      icon: 'sort',
      disabled: count !== 2,
      disabledReason: ctx.t('history.diff.needTwo', 'Select exactly two entries to compare. {count} are selected.', {
        values: { count: formatCount(count) }
      }),
      onClick: (event) => {
        const [a, b] = selectedEntries();
        openDiff(a, b, event.currentTarget as HTMLElement);
      }
    });
    const restore = ctx.components.button({
      label: 'history.bulk.restore',
      variant: 'text',
      icon: 'refresh',
      onClick: (event) => void restoreEntries(selectedEntries(), event.currentTarget as HTMLElement)
    });
    const prune = ctx.components.button({
      label: 'history.bulk.prune',
      variant: 'text',
      icon: 'trash',
      danger: true,
      onClick: (event) => void pruneOlderThanSelection(selectedEntries(), event.currentTarget as HTMLElement)
    });

    bulkBar.append(
      label,
      selectPage,
      selectAll,
      invert,
      clear,
      ctx.components.divider(true),
      exportSelected,
      exportEditor,
      copy,
      labelAll,
      clearLabels,
      compare,
      restore,
      prune
    );
  }

  /* ================================================================ */
  /* Row actions                                                       */
  /* ================================================================ */

  function openRowMenu(entry: HistoryEntry, anchor: HTMLElement): void {
    const change = restorableChange(entry.payload);
    ctx.components.menu({
      anchor,
      label: ctx.t('history.row.actions', 'Entry actions'),
      items: [
        {
          id: 'details',
          label: ctx.t('history.row.details', 'Open the details'),
          icon: 'visibility',
          shortcut: 'Enter',
          run: () => openDetails(entry, anchor)
        },
        {
          id: 'diff',
          label: ctx.t('history.row.diffPrevious', 'Compare with the previous entry from this source'),
          icon: 'sort',
          run: () => diffWithPrevious(entry, anchor)
        },
        {
          id: 'restore',
          label: ctx.t('history.row.restore', 'Restore this value'),
          icon: 'refresh',
          disabled: change === null,
          disabledReason: ctx.t(
            'history.restore.notRestorable',
            'This entry records what happened but does not carry the earlier value, so there is nothing to put back.'
          ),
          run: () => void restoreEntries([entry], anchor)
        },
        {
          id: 'copy',
          label: ctx.t('history.row.copy', 'Copy this entry'),
          icon: 'copy',
          run: () => void copyEntries([entry])
        },
        {
          id: 'export',
          label: ctx.t('history.bulk.export', 'Export the selection'),
          icon: 'download',
          separatorBefore: true,
          run: () => void openExportDialog([entry], anchor)
        },
        {
          id: 'edit-appearance',
          label: ctx.t('core.appearance.editElement', 'Edit appearance…'),
          icon: 'palette',
          shortcut: 'Shift+F10',
          separatorBefore: true,
          run: () => ctx.appearance.edit(anchor)
        },
        {
          id: 'lock-element',
          label: ctx.t('core.lock.command', 'Lock this element…'),
          icon: 'lock',
          run: () => {
            window.dispatchEvent(
              new CustomEvent('studio:lock-element', { detail: { target: anchor, selector: selectorFor(anchor) } })
            );
          }
        }
      ]
    });
  }

  async function applyLabel(entry: HistoryEntry, value: string): Promise<void> {
    const outcome = await state.store.setLabel(entry.id, value);
    if (!outcome.changed) return;
    if (!outcome.ok) {
      ctx.notify.error(
        ctx.t('history.row.label', 'Label'),
        ctx.t('history.label.notSaved', 'The label was applied in this window but not written to {path}: {reason}', {
          values: { path: outcome.path, reason: outcome.error }
        })
      );
      return;
    }
    const description =
      value.trim() === ''
        ? `Cleared the label on history entry ${entry.id}`
        : `Labelled history entry ${entry.id} "${value.trim()}"`;
    const recorded = await recordEntry(ctx, description, 'history.labels', {
      entry: entry.id,
      from: outcome.previous,
      to: value.trim()
    });
    if (!recorded.ok) {
      ctx.notify.warn(ctx.t('history.row.label', 'Label'), recorded.error);
      return;
    }
    ctx.a11y.announce(ctx.t('history.label.applied', 'Labelled entry {id}.', { values: { id: entry.id } }));
  }

  async function openBulkLabel(entries: HistoryEntry[]): Promise<void> {
    const body = el('div', { className: 'history-dialog' });
    body.append(
      el('p', {
        className: 'md-typescale-body-medium',
        text: ctx.t(
          'history.label.bulkBody',
          'The same label is applied to all {count} selected entries. Entries that already carry it are left alone.',
          { values: { count: formatCount(entries.length) } }
        )
      })
    );
    const field = ctx.components.textField({
      label: 'history.row.label',
      placeholder: 'history.row.labelPlaceholder'
    });
    body.append(field.root);
    const list = el('ul', { className: 'history-dialog__preview' });
    for (const entry of entries.slice(0, 12)) {
      list.append(el('li', { text: `${entry.id} · ${entry.action}` }));
    }
    if (entries.length > 12) {
      list.append(el('li', { text: `… and ${formatCount(entries.length - 12)} more` }));
    }
    body.append(list);

    const approved = await ctx.components.dialog({
      title: ctx.t('history.label.bulkTitle', 'Label the selected entries'),
      body,
      confirmLabel: ctx.t('history.action.apply', 'Apply')
    });
    if (!approved) return;
    const value = field.get();
    const outcome = await state.store.setLabels(
      entries.map((entry) => entry.id),
      value
    );
    if (!outcome.ok) {
      ctx.notify.error(
        ctx.t('history.row.label', 'Label'),
        ctx.t('history.label.notSaved', 'The label was applied in this window but not written to {path}: {reason}', {
          values: { path: outcome.path, reason: outcome.error }
        })
      );
      return;
    }
    await recordEntry(ctx, `Labelled ${outcome.changed} history entries "${value.trim()}"`, 'history.labels', {
      entries: entries.map((entry) => entry.id).slice(0, 200),
      changed: outcome.changed,
      to: value.trim()
    });
    nodeCache.clear();
    drawList();
    ctx.notify.success(
      ctx.t('history.row.label', 'Label'),
      ctx.t('history.label.applied', 'Labelled entry {id}.', { values: { id: formatCount(outcome.changed) } })
    );
  }

  async function clearLabelsFor(entries: HistoryEntry[]): Promise<void> {
    const outcome = await state.store.setLabels(
      entries.map((entry) => entry.id),
      ''
    );
    if (!outcome.ok) {
      ctx.notify.error(ctx.t('history.row.label', 'Label'), outcome.error);
      return;
    }
    if (outcome.changed === 0) return;
    await recordEntry(ctx, `Cleared the label on ${outcome.changed} history entries`, 'history.labels', {
      entries: entries.map((entry) => entry.id).slice(0, 200),
      changed: outcome.changed
    });
    nodeCache.clear();
    drawList();
    ctx.notify.success(
      ctx.t('history.row.label', 'Label'),
      ctx.t('history.label.cleared', 'Cleared the label from {count} entries.', {
        values: { count: formatCount(outcome.changed) }
      })
    );
  }

  async function copyEntries(entries: HistoryEntry[]): Promise<void> {
    const text = safeJson(
      entries.map((entry) => ({ ...entry, label: state.store.labelOf(entry.id) })),
      2
    );
    try {
      await navigator.clipboard.writeText(text);
      ctx.notify.success(
        ctx.t('history.panel.title', 'Version history'),
        ctx.t('history.bulk.copied', '{count} entries copied to the clipboard.', {
          values: { count: formatCount(entries.length) }
        })
      );
    } catch (error) {
      ctx.notify.error(
        ctx.t('history.panel.title', 'Version history'),
        ctx.t('history.bulk.copyFailed', 'The clipboard refused the copy: {reason}', {
          values: { reason: describeError(error) }
        })
      );
    }
  }

  /* ================================================================ */
  /* Details and comparison                                            */
  /* ================================================================ */

  function openDetails(entry: HistoryEntry, anchor: HTMLElement): void {
    const handle = ctx.overlay.open({
      anchor,
      placement: 'bottom-start',
      role: 'dialog',
      label: ctx.t('history.details.title', 'Entry {id}', { values: { id: entry.id } }),
      resizeKey: 'history.details',
      dragKey: 'history.details'
    });
    handle.root.classList.add('history-details');

    const body = handle.body;
    body.append(
      el('h2', {
        className: 'md-typescale-title-medium',
        text: ctx.t('history.details.title', 'Entry {id}', { values: { id: entry.id } })
      }),
      el('p', { className: 'md-typescale-body-medium', text: entry.action }),
      el('p', {
        className: 'md-typescale-body-small',
        text: `${formatTimestamp(entry.timestamp)} · ${entry.source}`,
        attrs: { title: entry.timestamp }
      })
    );

    const labelField = ctx.components.textField({
      label: 'history.row.label',
      value: state.store.labelOf(entry.id),
      placeholder: 'history.row.labelPlaceholder',
      onCommit: (value) => void applyLabel(entry, value)
    });
    body.append(labelField.root);

    body.append(
      el('h3', { className: 'md-typescale-label-large', text: ctx.t('history.details.payload', 'Recorded payload') }),
      el('pre', { className: 'history-details__payload', text: safeJson(entry.payload, 2) }),
      el('p', {
        className: 'md-typescale-body-small',
        text: ctx.t(
          'history.details.redactedNote',
          'Values under credential-shaped keys were replaced before this was written to disk.'
        )
      })
    );

    const change = restorableChange(entry.payload);
    const actions = el('div', { className: 'history-details__actions' });
    actions.append(
      ctx.components.button({
        label: 'history.row.copy',
        variant: 'text',
        icon: 'copy',
        onClick: () => void copyEntries([entry])
      }),
      ctx.components.button({
        label: 'history.row.diffPrevious',
        variant: 'text',
        icon: 'sort',
        onClick: () => diffWithPrevious(entry, anchor)
      }),
      ctx.components.button({
        label: 'history.row.restore',
        variant: 'tonal',
        icon: 'refresh',
        disabled: change === null,
        disabledReason: ctx.t(
          'history.restore.notRestorable',
          'This entry records what happened but does not carry the earlier value, so there is nothing to put back.'
        ),
        onClick: () => void restoreEntries([entry], anchor)
      })
    );
    body.append(actions);
    handle.reposition();
  }

  function diffWithPrevious(entry: HistoryEntry, anchor: HTMLElement): void {
    // `loaded` is newest first, so the previous entry from the same source sits
    // at a higher index.
    const index = loaded.findIndex((candidate) => candidate.id === entry.id);
    const previous = index === -1 ? undefined : loaded.slice(index + 1).find((candidate) => candidate.source === entry.source);
    if (!previous) {
      ctx.notify.info(
        ctx.t('history.diff.title', 'Compare entries'),
        ctx.t('history.diff.noPrevious', 'There is no earlier entry from {source} in the loaded range.', {
          values: { source: entry.source }
        })
      );
      return;
    }
    openDiff(previous, entry, anchor);
  }

  function openDiff(older: HistoryEntry, newer: HistoryEntry, anchor: HTMLElement): void {
    const [left, right] = Date.parse(older.timestamp) <= Date.parse(newer.timestamp) ? [older, newer] : [newer, older];
    const handle = ctx.overlay.open({
      anchor,
      placement: 'bottom-start',
      role: 'dialog',
      label: ctx.t('history.diff.title', 'Compare entries'),
      resizeKey: 'history.diff',
      dragKey: 'history.diff'
    });
    handle.root.classList.add('history-diff');
    const body = handle.body;
    body.append(
      el('h2', { className: 'md-typescale-title-medium', text: ctx.t('history.diff.title', 'Compare entries') }),
      el('p', {
        className: 'md-typescale-body-small',
        text: `${left.id} (${formatTimestamp(left.timestamp)}) → ${right.id} (${formatTimestamp(right.timestamp)})`
      })
    );

    const result = diffPayloads(left.payload, right.payload);
    if (result.identical) {
      body.append(
        el('p', {
          className: 'md-typescale-body-medium',
          text: ctx.t('history.diff.identical', 'These two payloads are identical.')
        })
      );
      handle.reposition();
      return;
    }

    const table = ctx.components.dataTable({
      label: ctx.t('history.diff.title', 'Compare entries'),
      columns: [
        { id: 'path', label: ctx.t('history.diff.path', 'Field'), sortable: true, value: (row) => row.path },
        {
          id: 'kind',
          label: ctx.t('history.diff.kind', 'Change'),
          sortable: true,
          value: (row) => row.kind,
          render: (row) =>
            ctx.components.badge({
              label:
                row.kind === 'added'
                  ? ctx.t('history.diff.added', 'Added')
                  : row.kind === 'removed'
                    ? ctx.t('history.diff.removed', 'Removed')
                    : ctx.t('history.diff.changed', 'Changed'),
              severity: row.kind === 'added' ? 'success' : row.kind === 'removed' ? 'error' : 'warning'
            })
        },
        { id: 'left', label: ctx.t('history.diff.left', 'Older'), value: (row) => row.left },
        { id: 'right', label: ctx.t('history.diff.right', 'Newer'), value: (row) => row.right }
      ],
      rows: result.rows,
      rowId: (row) => row.path
    });
    body.append(table.root);
    if (result.truncated) {
      body.append(
        el('p', {
          className: 'md-typescale-body-small',
          text: 'Only the first 500 differing fields are listed.'
        })
      );
    }
    handle.reposition();
  }

  /* ================================================================ */
  /* Restore                                                           */
  /* ================================================================ */

  async function restoreEntries(entries: HistoryEntry[], anchor: HTMLElement): Promise<void> {
    const restorable: Array<{ entry: HistoryEntry; change: RestorableChange }> = [];
    for (const entry of entries) {
      const change = restorableChange(entry.payload);
      if (change) restorable.push({ entry, change });
    }
    const skipped = entries.length - restorable.length;

    if (restorable.length === 0) {
      ctx.notify.warn(
        ctx.t('history.restore.title', 'Restore an earlier value'),
        ctx.t(
          'history.restore.notRestorable',
          'This entry records what happened but does not carry the earlier value, so there is nothing to put back.'
        )
      );
      return;
    }

    const unchanged = restorable.filter((candidate) => sameValue(ctx.settings.get(candidate.change.id), candidate.change.from));
    const willChange = restorable.filter((candidate) => !unchanged.includes(candidate));

    if (willChange.length === 0) {
      ctx.notify.info(
        ctx.t('history.restore.title', 'Restore an earlier value'),
        ctx.t('history.restore.unchanged', '{id} already holds that value, so nothing was changed and nothing was recorded.', {
          values: { id: restorable.map((candidate) => candidate.change.id).join(', ') }
        })
      );
      return;
    }

    const approved = await ctx.confirm.request({
      action: ctx.t('history.restore.confirmAction', 'Restore {count} settings to their earlier values', {
        values: { count: formatCount(willChange.length) }
      }),
      affected: willChange.map(
        (candidate) =>
          `${candidate.change.id}: ${safeJson(ctx.settings.get(candidate.change.id))} → ${safeJson(candidate.change.from)}`
      ),
      irreversible: ctx.t(
        'history.restore.irreversible',
        'The current values are replaced immediately. Each replacement is recorded as a new entry, so this restore can itself be restored.'
      ),
      anchor,
      confirmLabel: ctx.t('history.row.restore', 'Restore this value')
    });
    if (!approved) return;

    for (const candidate of willChange) {
      ctx.settings.set(candidate.change.id, candidate.change.from);
    }

    const summary = await recordEntry(
      ctx,
      `Restored ${willChange.length} setting${willChange.length === 1 ? '' : 's'} from earlier history entries`,
      'history.restore',
      {
        restoredFrom: willChange.map((candidate) => candidate.entry.id),
        settings: willChange.map((candidate) => candidate.change.id)
      }
    );

    if (skipped > 0) {
      ctx.notify.info(
        ctx.t('history.restore.title', 'Restore an earlier value'),
        ctx.t('history.restore.skipped', '{count} of the selected entries carry no earlier value and were left alone.', {
          values: { count: formatCount(skipped) }
        })
      );
    }
    ctx.notify.success(
      ctx.t('history.restore.title', 'Restore an earlier value'),
      ctx.t(
        'history.restore.done',
        '{id} was set back to its earlier value. That restore is itself entry {entry}, so it can be undone too.',
        {
          values: {
            id: willChange.map((candidate) => candidate.change.id).join(', '),
            entry: summary.ok ? summary.id : 'not recorded'
          }
        }
      )
    );
    await reload();
  }

  /* ================================================================ */
  /* Export                                                            */
  /* ================================================================ */

  function exportRecords(entries: HistoryEntry[]): { records: Array<Record<string, unknown>>; redactedFields: number } {
    const base = entries.map((entry) => ({
      id: entry.id,
      timestamp: entry.timestamp,
      action: entry.action,
      source: entry.source,
      label: state.store.labelOf(entry.id),
      payload: entry.payload
    }));
    if (ctx.settings.get<boolean>(REDACT_EXPORTS_ID, true) !== true) {
      return { records: base, redactedFields: 0 };
    }
    return redactRecords(base);
  }

  async function openExportDialog(entries: HistoryEntry[], anchor: HTMLElement): Promise<void> {
    if (entries.length === 0) {
      ctx.notify.info(ctx.t('history.export.title', 'Export history'), ctx.t('core.search.noMatches', 'Nothing matched.'));
      return;
    }
    const body = el('div', { className: 'history-dialog' });
    body.append(
      el('p', {
        className: 'md-typescale-body-medium',
        text: ctx.t('history.export.scope', '{count} entries will be written, exactly the ones currently selected or matching.', {
          values: { count: formatCount(entries.length) }
        })
      })
    );

    let format = String(ctx.settings.get<string>(EXPORT_FORMAT_ID, 'json')) as ExportFormat;
    const losses = el('p', { className: 'md-typescale-body-small', attrs: { role: 'status' } });
    const redactionNote = el('p', { className: 'md-typescale-body-small' });

    const describe = (): void => {
      const { records, redactedFields } = exportRecords(entries);
      const preflight = ctx.exporter.preflight(records, format);
      losses.textContent =
        preflight.losses.length === 0
          ? ''
          : ctx.t('history.export.losses', '{format} cannot carry these faithfully: {fields}', {
              values: {
                format: format.toUpperCase(),
                fields: preflight.losses.map((loss) => `${loss.field} (${loss.reason})`).join('; ')
              }
            });
      redactionNote.textContent =
        ctx.settings.get<boolean>(REDACT_EXPORTS_ID, true) === true
          ? ctx.t('history.export.redacted', '{fields} field values were replaced with a marker across {entries} entries.', {
              values: { fields: formatCount(redactedFields), entries: formatCount(entries.length) }
            })
          : ctx.t('history.export.noRedaction', 'Redaction is off for this export, so payloads are written as they were stored.');
    };

    const formatSelect = ctx.components.select({
      label: 'history.export.format',
      value: format,
      options: ctx.exporter.formats().map((candidate) => ({ value: candidate, label: candidate.toUpperCase() })),
      onChange: (value) => {
        format = value as ExportFormat;
        describe();
      }
    });
    const redactSwitch = ctx.components.switchControl({
      label: 'history.settings.redact',
      checked: ctx.settings.get<boolean>(REDACT_EXPORTS_ID, true) === true,
      onChange: (checked) => {
        ctx.settings.set(REDACT_EXPORTS_ID, checked);
        describe();
      }
    });
    body.append(formatSelect.root, redactSwitch.root, redactionNote, losses);
    describe();

    const approved = await ctx.components.dialog({
      title: ctx.t('history.export.title', 'Export history'),
      body,
      confirmLabel: ctx.t('core.action.export', 'Export')
    });
    if (!approved) {
      anchor.focus();
      return;
    }

    const { records } = exportRecords(entries);
    const path = await ctx.exporter.save(records, format, {
      name: 'history',
      schemaVersion: '1',
      defaultFileName: `history.${format === 'markdown' ? 'md' : format}`
    });
    if (!path) {
      ctx.notify.info(ctx.t('history.export.title', 'Export history'), ctx.t('history.export.cancelled', 'Nothing was written.'));
      return;
    }
    ctx.notify.success(
      ctx.t('history.export.title', 'Export history'),
      ctx.t('history.export.saved', 'Written to {path}', { values: { path } })
    );
  }

  async function exportToEditor(entries: HistoryEntry[]): Promise<void> {
    if (entries.length === 0) return;
    const { records } = exportRecords(entries);
    const result = ctx.exporter.serialize(records, 'json', { name: 'history', schemaVersion: '1' });
    const target = `${ctx.studio.info.userDataDir}${ctx.studio.info.platform === 'win32' ? '\\' : '/'}history-export.json`;
    const written = await ctx.studio.fs.writeText(target, result.text);
    if (!written.ok) {
      ctx.notify.error(ctx.t('history.export.title', 'Export history'), written.error);
      return;
    }
    const opened = await ctx.studio.editor.open(target);
    if (!opened.ok) {
      ctx.notify.warn(
        ctx.t('history.export.title', 'Export history'),
        ctx.t('history.export.editorMissing', 'No editor was found on this machine, so the file was written but not opened: {reason}', {
          values: { reason: opened.error }
        })
      );
      return;
    }
    ctx.notify.success(
      ctx.t('history.export.title', 'Export history'),
      ctx.t('history.export.saved', 'Written to {path}', { values: { path: target } })
    );
  }

  /* ================================================================ */
  /* Prune                                                             */
  /* ================================================================ */

  async function countOlderThan(cutoffIso: string): Promise<number> {
    const result = await ctx.studio.history.list({ to: cutoffIso });
    if (!result.ok) throw new Error(result.error);
    const cutoff = Date.parse(cutoffIso);
    return result.value.filter((entry) => Date.parse(entry.timestamp) < cutoff).length;
  }

  async function runPrune(cutoffIso: string, anchor: HTMLElement): Promise<void> {
    let candidates = 0;
    try {
      candidates = await countOlderThan(cutoffIso);
    } catch (error) {
      ctx.notify.error(ctx.t('history.prune.title', 'Prune old entries'), describeError(error));
      return;
    }
    const total = status?.entryCount ?? loaded.length;
    if (candidates === 0) {
      ctx.notify.info(
        ctx.t('history.prune.title', 'Prune old entries'),
        ctx.t('history.prune.none', 'Nothing is older than {cutoff}, so there is nothing to prune.', {
          values: { cutoff: formatTimestamp(cutoffIso) }
        })
      );
      return;
    }

    const approved = await ctx.confirm.request({
      action: ctx.t('history.prune.confirmAction', 'Remove {count} history entries older than {cutoff}', {
        values: { count: formatCount(candidates), cutoff: formatTimestamp(cutoffIso) }
      }),
      affected: [
        ctx.t('history.prune.preview', '{count} of the {total} kept entries are older than {cutoff} and would be removed.', {
          values: { count: formatCount(candidates), total: formatCount(total), cutoff: formatTimestamp(cutoffIso) }
        }),
        ctx.t(
          'history.prune.explain',
          'Pruning removes entries older than a cutoff from the journal. The removal is itself recorded, but the removed entries do not come back.'
        )
      ],
      irreversible: ctx.t(
        'history.prune.irreversible',
        'Those entries are removed from the journal permanently. Nothing in the application can bring them back.'
      ),
      anchor,
      confirmLabel: ctx.t('history.prune.title', 'Prune old entries')
    });
    if (!approved) return;

    const result = await ctx.studio.history.prune(cutoffIso);
    if (!result.ok) {
      ctx.notify.error(
        ctx.t('history.prune.title', 'Prune old entries'),
        ctx.t('history.prune.failed', 'Nothing was removed: {reason}', { values: { reason: result.error } })
      );
      return;
    }
    await recordEntry(ctx, `Pruned ${result.value.removed} history entries older than ${cutoffIso}`, 'history.prune', {
      cutoff: cutoffIso,
      removed: result.value.removed
    });
    ctx.notify.success(
      ctx.t('history.prune.title', 'Prune old entries'),
      ctx.t('history.prune.done', '{count} entries were removed.', { values: { count: formatCount(result.value.removed) } })
    );
    selection.clear();
    await reload();
    await state.store.retainOnly(new Set(loaded.map((entry) => entry.id)));
  }

  async function openRetentionPrune(anchor: HTMLElement): Promise<void> {
    const days = Number(ctx.settings.get<number>(RETENTION_DAYS_ID, 365));
    const safeDays = Number.isFinite(days) && days > 0 ? Math.round(days) : 365;
    const cutoff = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000).toISOString();
    await runPrune(cutoff, anchor);
  }

  async function pruneOlderThanSelection(entries: HistoryEntry[], anchor: HTMLElement): Promise<void> {
    if (entries.length === 0) return;
    const oldest = entries.reduce((accumulator, entry) =>
      Date.parse(entry.timestamp) < Date.parse(accumulator.timestamp) ? entry : accumulator
    );
    await runPrune(oldest.timestamp, anchor);
  }

  async function openFolder(): Promise<void> {
    const path = status?.path ?? ctx.studio.info.historyDir;
    const result = await ctx.studio.shell.openPath(path);
    if (!result.ok) ctx.notify.error(ctx.t('history.status.openFolder', 'Open the folder'), result.error);
  }

  /* ================================================================ */
  /* Wiring                                                            */
  /* ================================================================ */

  filters.query = search.query();

  const offSettings = ctx.settings.onChange((change) => {
    if (change.id === PAGE_SIZE_ID || change.id === MAX_LOAD_ID) void reload();
  });
  ctx.onDispose(() => {
    offSettings();
    search.destroy();
    actionSearch.destroy();
    dateRange.destroy();
  });

  // A fresh window of the panel always starts from the real state on disk
  // rather than from whatever the previous mount happened to hold.
  void reload();

  state.registerRefresh(() => void reload());
  state.registerFocusSearch(() => {
    setFiltersExpanded(true);
    search.focus();
  });
  state.registerFocusDates(() => {
    setFiltersExpanded(true);
    dateRange.focus();
  });
  state.registerExport(() => void openExportDialog(matchedOrSelected(), exportButton));
  state.registerPrune(() => void openRetentionPrune(pruneButton));
}
