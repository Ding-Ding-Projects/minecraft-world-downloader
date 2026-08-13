import type { NotificationArchive } from './archive';
import { clamp, el, formatTimestamp, relativeTime, truncate } from './dom';
import {
  CENTRE_FILTERS_ID,
  CENTRE_LIST_ID,
  CENTRE_ROOT_ID,
  CENTRE_SEARCH_ID,
  CENTRE_STATISTICS_ID,
  DEFAULT_EXPORT_FORMAT,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MIN_PAGE_SIZE,
  SETTING_EXPORT_FORMAT,
  SETTING_FILTERS_EXPANDED,
  SETTING_PAGE_SIZE,
  SETTING_STATISTICS_EXPANDED,
  SEVERITIES,
  SEVERITY_ICON,
  type CentreRecord
} from './model';
import type {
  AppContext,
  ExportFormat,
  NotificationSeverity,
  SearchQuery
} from '../../core/registry';

/**
 * The notification centre.
 *
 * It is a LIST, which settles most of what follows: multi-select with click,
 * shift-click ranges and a keyboard equivalent; a select-all that says out loud
 * whether it means this page or every match; an inverse selection; bulk dismiss;
 * bulk delete behind the two-key gate; and an export that honours the filter
 * currently applied rather than dumping the whole log. "It is only a log" is not
 * a reason to ship any of that missing.
 *
 * Two subtler rules shape the rest.
 *
 * A row is the real control, not a printout of one. An action the original
 * notification carried is still a working button here for as long as this
 * session holds its callback, and the moment it does not, the row says so
 * instead of rendering a button that would do nothing.
 *
 * A collapsed control that is still excluding records says so. A list quietly
 * shorter than it should be is exactly how somebody concludes their data has
 * gone missing.
 */

type StateFilter = 'all' | 'showing' | 'dismissed';

interface Filters {
  severities: Set<NotificationSeverity>;
  sources: Set<string>;
  state: StateFilter;
}

interface Collapsible {
  root: HTMLElement;
  body: HTMLElement;
  setNote(text: string): void;
  isExpanded(): boolean;
}

const BODY_PREVIEW_LIMIT = 220;
const PREVIEW_ROWS = 25;
const CONFIRM_LIST_ROWS = 20;

/** Sets a reason-bearing disabled state that a screen reader can still reach. */
function setDisabled(button: HTMLButtonElement, disabled: boolean, reason: string): void {
  button.setAttribute('aria-disabled', String(disabled));
  button.classList.toggle('notification-centre-button--inert', disabled);
  if (disabled) {
    button.title = reason;
    button.setAttribute('aria-description', reason);
  } else {
    button.removeAttribute('title');
    button.removeAttribute('aria-description');
  }
}

function isInert(button: HTMLButtonElement): boolean {
  return button.getAttribute('aria-disabled') === 'true';
}

export function mountCentre(hostElement: HTMLElement, ctx: AppContext, archive: NotificationArchive): () => void {
  const c = ctx.components;
  const t = (key: string, fallback: string, values?: Record<string, string | number>): string =>
    ctx.t(key, fallback, values ? { values } : undefined);

  /* ---------------------------------------------------------------- */
  /* State                                                             */
  /* ---------------------------------------------------------------- */

  const filters: Filters = { severities: new Set(), sources: new Set(), state: 'all' };
  const selection = new Set<string>();
  const expandedBodies = new Set<string>();
  let page = 0;
  let anchorIndex: number | null = null;
  let visible: CentreRecord[] = [];
  let everything: CentreRecord[] = [];
  let sourceSignature = '';
  let disposed = false;

  const pageSize = (): number =>
    Math.round(clamp(Number(ctx.settings.get(SETTING_PAGE_SIZE, DEFAULT_PAGE_SIZE)), MIN_PAGE_SIZE, MAX_PAGE_SIZE));

  const titleOf = (record: CentreRecord): string => ctx.t(record.title, record.title);
  const bodyOf = (record: CentreRecord): string => (record.body ? ctx.t(record.body, record.body) : '');
  const severityName = (severity: NotificationSeverity): string =>
    ctx.t(`core.notify.severity.${severity}`, severity);

  const matchesFilters = (record: CentreRecord, query: SearchQuery): boolean => {
    if (filters.severities.size > 0 && !filters.severities.has(record.severity)) return false;
    if (filters.sources.size > 0 && !filters.sources.has(record.source)) return false;
    if (filters.state === 'showing' && !record.showing) return false;
    if (filters.state === 'dismissed' && record.showing) return false;
    const haystack = [
      titleOf(record),
      record.title,
      bodyOf(record),
      record.source,
      severityName(record.severity),
      record.severity,
      record.createdAt,
      formatTimestamp(record.createdAt)
    ].join(' ');
    return query.matches(haystack);
  };

  const activeFilterCount = (): number =>
    (filters.severities.size > 0 ? 1 : 0) + (filters.sources.size > 0 ? 1 : 0) + (filters.state === 'all' ? 0 : 1);

  /* ---------------------------------------------------------------- */
  /* Chrome                                                            */
  /* ---------------------------------------------------------------- */

  /* The palette teleports to these ids and focuses them, so each one is
     programmatically focusable without entering the Tab order. */
  const root = el('section', {
    className: 'notification-centre',
    attrs: { id: CENTRE_ROOT_ID, tabindex: '-1', 'data-appearance-id': 'notification-centre' }
  });

  root.append(
    c.sectionHeading({
      title: 'notificationCentre.title',
      description: 'notificationCentre.lede'
    })
  );

  const storageStatus = el('p', {
    className: 'notification-centre-status md-typescale-body-small',
    attrs: { role: 'status', 'data-appearance-id': 'notification-centre:status' }
  });

  const search = ctx.createSearchBar({
    label: 'notificationCentre.search.label',
    placeholder: 'notificationCentre.search.placeholder',
    sample: archive
      .all()
      .slice(0, 40)
      .map((record) => `${titleOf(record)} ${bodyOf(record)} ${record.source}`)
      .join('\n'),
    onChange: () => {
      page = 0;
      anchorIndex = null;
      draw();
    }
  });
  search.root.id = CENTRE_SEARCH_ID;
  search.root.tabIndex = -1;

  /* ---------------------------------------------------------------- */
  /* Collapsible sections                                              */
  /* ---------------------------------------------------------------- */

  function collapsible(options: {
    id: string;
    titleKey: string;
    descriptionKey: string;
    expandKey: string;
    collapseKey: string;
    expanded: boolean;
    onToggle(expanded: boolean): void;
  }): Collapsible {
    const section = el('section', {
      className: 'notification-centre-collapsible',
      attrs: { id: options.id, tabindex: '-1', 'data-appearance-id': `notification-centre:${options.id}` }
    });
    const header = el('div', { className: 'notification-centre-collapsible__header' });
    const bodyId = `${options.id}-body`;

    const toggle = el('button', {
      className: 'notification-centre-collapsible__toggle',
      attrs: {
        type: 'button',
        'aria-expanded': String(options.expanded),
        'aria-controls': bodyId
      }
    });
    // The chevron rotates rather than being swapped, so the collapsed and
    // expanded states cannot drift apart and reduced motion can turn the
    // transition off in one place.
    const chevron = c.icon('chevronRight', { size: 18 });
    chevron.classList.add('notification-centre-collapsible__chevron');
    const toggleLabel = el('span', {
      className: 'md-typescale-title-small',
      text: t(options.titleKey, options.titleKey)
    });
    toggle.append(chevron, toggleLabel);

    const note = el('span', { className: 'notification-centre-collapsible__note md-typescale-body-small' });
    const explain = el('p', {
      className: 'md-setting__description md-typescale-body-small',
      text: t(options.descriptionKey, options.descriptionKey)
    });

    const body = el('div', { className: 'notification-centre-collapsible__body', attrs: { id: bodyId } });
    body.hidden = !options.expanded;
    explain.hidden = !options.expanded;

    const apply = (expanded: boolean): void => {
      toggle.setAttribute('aria-expanded', String(expanded));
      body.hidden = !expanded;
      explain.hidden = !expanded;
      chevron.classList.toggle('notification-centre-collapsible__chevron--open', expanded);
      toggle.title = expanded ? t(options.collapseKey, options.collapseKey) : t(options.expandKey, options.expandKey);
    };
    apply(options.expanded);

    toggle.addEventListener('click', () => {
      const next = toggle.getAttribute('aria-expanded') !== 'true';
      apply(next);
      options.onToggle(next);
      draw();
    });

    header.append(toggle, note);
    section.append(header, explain, body);

    return {
      root: section,
      body,
      setNote: (text: string) => {
        note.textContent = text;
        note.classList.toggle('notification-centre-collapsible__note--warning', text !== '');
      },
      isExpanded: () => toggle.getAttribute('aria-expanded') === 'true'
    };
  }

  const filtersPanel = collapsible({
    id: CENTRE_FILTERS_ID,
    titleKey: 'notificationCentre.filters.title',
    descriptionKey: 'notificationCentre.filters.description',
    expandKey: 'notificationCentre.filters.expand',
    collapseKey: 'notificationCentre.filters.collapse',
    expanded: ctx.settings.get<boolean>(SETTING_FILTERS_EXPANDED, true) !== false,
    onToggle: (expanded) => ctx.settings.set(SETTING_FILTERS_EXPANDED, expanded)
  });

  const statsPanel = collapsible({
    id: CENTRE_STATISTICS_ID,
    titleKey: 'notificationCentre.stats.title',
    descriptionKey: 'notificationCentre.stats.description',
    expandKey: 'notificationCentre.stats.expand',
    collapseKey: 'notificationCentre.stats.collapse',
    // Descriptive statistics start collapsed: they describe the log rather than
    // changing it, so they must not push the list itself off the screen.
    expanded: ctx.settings.get<boolean>(SETTING_STATISTICS_EXPANDED, false) === true,
    onToggle: (expanded) => ctx.settings.set(SETTING_STATISTICS_EXPANDED, expanded)
  });

  /* ---------------------------------------------------------------- */
  /* Filter controls                                                   */
  /* ---------------------------------------------------------------- */

  const severityRow = el('div', { className: 'notification-centre-chips' });
  const sourceRow = el('div', { className: 'notification-centre-chips' });
  const severityChips = new Map<NotificationSeverity, { chip: HTMLElement; label: HTMLElement }>();
  const sourceChips = new Map<string, { chip: HTMLElement; label: HTMLElement }>();

  const stateControl = c.segmentedButton({
    label: 'notificationCentre.filters.state',
    options: [
      { value: 'all', label: 'notificationCentre.filters.state.all' },
      { value: 'showing', label: 'notificationCentre.filters.state.showing' },
      { value: 'dismissed', label: 'notificationCentre.filters.state.dismissed' }
    ],
    value: 'all',
    onChange: (value) => {
      filters.state = value === 'showing' || value === 'dismissed' ? value : 'all';
      page = 0;
      draw();
    }
  });

  const resetFilters = c.button({
    label: 'notificationCentre.filters.reset',
    variant: 'text',
    icon: 'refresh',
    onClick: () => {
      if (isInert(resetFilters)) return;
      filters.severities.clear();
      filters.sources.clear();
      filters.state = 'all';
      stateControl.set('all');
      search.clear();
      page = 0;
      draw();
      ctx.a11y.announce(t('notificationCentre.filters.reset', 'Clear every filter'));
    }
  });

  const severityGroup = el('div', { className: 'notification-centre-filter-group' });
  severityGroup.append(
    el('h3', {
      className: 'md-typescale-label-large',
      text: t('notificationCentre.filters.severity', 'Severity')
    }),
    severityRow
  );
  const sourceGroup = el('div', { className: 'notification-centre-filter-group' });
  sourceGroup.append(
    el('h3', {
      className: 'md-typescale-label-large',
      text: t('notificationCentre.filters.source', 'Raised by')
    }),
    sourceRow
  );
  const stateGroup = el('div', { className: 'notification-centre-filter-group' });
  stateGroup.append(stateControl.root);

  filtersPanel.body.append(severityGroup, sourceGroup, stateGroup, resetFilters);

  /* ---------------------------------------------------------------- */
  /* Statistics                                                        */
  /* ---------------------------------------------------------------- */

  const statsBody = el('div', { className: 'notification-centre-stats' });
  statsPanel.body.append(statsBody);

  /* ---------------------------------------------------------------- */
  /* Toolbar                                                           */
  /* ---------------------------------------------------------------- */

  const toolbar = el('div', {
    className: 'notification-centre-toolbar',
    attrs: {
      role: 'toolbar',
      'data-appearance-id': 'notification-centre:toolbar',
      'aria-label': t('notificationCentre.title', 'Notification centre')
    }
  });

  const selectPage = c.button({
    label: 'notificationCentre.select.page',
    variant: 'text',
    icon: 'check',
    onClick: () => {
      if (isInert(selectPage)) return;
      for (const record of pageRecords()) selection.add(record.id);
      announceSelection();
      draw();
    }
  });

  const selectEvery = c.button({
    label: 'notificationCentre.select.every',
    variant: 'text',
    icon: 'check',
    onClick: () => {
      if (isInert(selectEvery)) return;
      for (const record of visible) selection.add(record.id);
      announceSelection();
      draw();
    }
  });

  const invertSelection = c.button({
    label: 'notificationCentre.select.invert',
    variant: 'text',
    icon: 'sort',
    onClick: () => {
      if (isInert(invertSelection)) return;
      for (const record of visible) {
        if (selection.has(record.id)) selection.delete(record.id);
        else selection.add(record.id);
      }
      announceSelection();
      draw();
    }
  });

  const clearSelection = c.button({
    label: 'notificationCentre.select.clear',
    variant: 'text',
    icon: 'close',
    onClick: () => {
      if (isInert(clearSelection)) return;
      selection.clear();
      anchorIndex = null;
      announceSelection();
      draw();
    }
  });

  const dismissSelected = c.button({
    label: 'notificationCentre.action.dismiss',
    variant: 'tonal',
    icon: 'remove',
    onClick: () => {
      if (isInert(dismissSelected)) return;
      const ids = [...selection];
      const result = archive.dismiss(ids);
      if (result.dismissed.length === 0) {
        ctx.notify.warn(
          t('notificationCentre.result.nothingDismissed', 'Nothing was dismissed', { count: ids.length })
        );
      } else if (result.skipped.length > 0) {
        ctx.notify.success(
          t('notificationCentre.result.dismissedWithSkips', '{count} dismissed', {
            count: result.dismissed.length,
            skipped: result.skipped.length
          })
        );
      } else {
        ctx.notify.success(
          t('notificationCentre.result.dismissed', '{count} dismissed', { count: result.dismissed.length })
        );
      }
      if (result.dismissed.length > 0) {
        void ctx.history.record('Notifications dismissed', 'notification-centre', {
          count: result.dismissed.length,
          skipped: result.skipped.length,
          ids: result.dismissed.slice(0, 50)
        });
      }
      draw();
    }
  });

  const deleteSelected = c.button({
    label: 'notificationCentre.action.delete',
    variant: 'text',
    danger: true,
    icon: 'trash',
    onClick: (event) => {
      if (isInert(deleteSelected)) return;
      void runDelete([...selection], event.currentTarget as HTMLElement);
    }
  });

  const exportButton = c.button({
    label: 'notificationCentre.action.export',
    variant: 'text',
    icon: 'download',
    onClick: (event) => {
      if (isInert(exportButton)) return;
      openExportPanel(event.currentTarget as HTMLElement);
    }
  });

  const moreButton = c.iconButton({
    icon: 'more',
    label: 'notificationCentre.action.more',
    onClick: (event) => {
      const anchor = event.currentTarget as HTMLElement;
      c.menu({
        anchor,
        label: 'notificationCentre.action.more',
        items: [
          {
            id: 'dismiss-everything',
            label: 'notificationCentre.action.dismissEverything',
            icon: 'remove',
            disabled: everything.every((record) => !record.showing),
            disabledReason: 'notificationCentre.disabled.noneDismissable',
            run: () => {
              const ids = everything.filter((record) => record.showing).map((record) => record.id);
              const result = archive.dismiss(ids);
              ctx.notify.success(
                t('notificationCentre.result.dismissed', '{count} dismissed', { count: result.dismissed.length })
              );
              void ctx.history.record('Notifications dismissed', 'notification-centre', {
                count: result.dismissed.length,
                scope: 'everything-showing'
              });
              draw();
            }
          },
          {
            id: 'delete-everything',
            label: 'notificationCentre.action.deleteEverything',
            icon: 'trash',
            danger: true,
            separatorBefore: true,
            disabled: everything.length === 0,
            disabledReason: 'notificationCentre.disabled.emptyLog',
            run: () => {
              void runClear(anchor);
            }
          },
          {
            id: 'open-folder',
            label: 'notificationCentre.action.openFolder',
            icon: 'folder',
            separatorBefore: true,
            run: async () => {
              const result = await ctx.studio.shell.openPath(archive.directoryPath());
              if (!result.ok) ctx.notify.error(t('notificationCentre.action.openFolder', 'Open the folder'), result.error);
            }
          }
        ]
      });
    }
  });

  toolbar.append(
    selectPage,
    selectEvery,
    invertSelection,
    clearSelection,
    c.divider(true),
    dismissSelected,
    deleteSelected,
    exportButton,
    moreButton
  );

  const selectionSummary = el('p', {
    className: 'notification-centre-summary md-typescale-body-small',
    attrs: { role: 'status' }
  });

  const previewPanel = collapsible({
    id: 'notification-centre-preview',
    titleKey: 'notificationCentre.preview.title',
    descriptionKey: 'notificationCentre.preview.description',
    expandKey: 'notificationCentre.preview.expand',
    collapseKey: 'notificationCentre.preview.collapse',
    expanded: false,
    onToggle: () => undefined
  });
  const previewList = el('ul', { className: 'notification-centre-preview', attrs: { role: 'list' } });
  previewPanel.body.append(previewList);

  /* ---------------------------------------------------------------- */
  /* List and pager                                                    */
  /* ---------------------------------------------------------------- */

  const listNode = el('ul', {
    className: 'notification-centre-list',
    attrs: {
      id: CENTRE_LIST_ID,
      role: 'list',
      tabindex: '-1',
      'data-appearance-id': 'notification-centre:list',
      'aria-label': t('notificationCentre.title', 'Notification centre')
    }
  });

  const pager = el('div', { className: 'notification-centre-pager' });
  const previousPage = c.button({
    label: 'notificationCentre.action.previousPage',
    variant: 'text',
    icon: 'chevronLeft',
    onClick: () => {
      if (isInert(previousPage)) return;
      page = Math.max(0, page - 1);
      draw();
    }
  });
  const nextPage = c.button({
    label: 'notificationCentre.action.nextPage',
    variant: 'text',
    icon: 'chevronRight',
    onClick: () => {
      if (isInert(nextPage)) return;
      page += 1;
      draw();
    }
  });
  const pageStatus = el('span', { className: 'md-typescale-body-small', attrs: { role: 'status' } });
  pager.append(previousPage, pageStatus, nextPage);

  root.append(
    storageStatus,
    search.root,
    filtersPanel.root,
    statsPanel.root,
    toolbar,
    selectionSummary,
    previewPanel.root,
    listNode,
    pager
  );
  hostElement.append(root);

  /* ---------------------------------------------------------------- */
  /* Keyboard                                                          */
  /* ---------------------------------------------------------------- */

  const rowElements: HTMLElement[] = [];
  const detachRoving = ctx.a11y.roving(listNode, () => rowElements, 'vertical');

  const onRootKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'a' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      for (const record of visible) selection.add(record.id);
      announceSelection();
      draw();
      return;
    }
    if (event.key === 'Escape' && selection.size > 0) {
      const target = event.target as HTMLElement | null;
      // The search field clears itself on Escape first; only take over when the
      // key was not aimed at a text entry.
      if (target && target.tagName === 'INPUT') return;
      event.preventDefault();
      selection.clear();
      anchorIndex = null;
      announceSelection();
      draw();
    }
  };
  root.addEventListener('keydown', onRootKeyDown);

  /* ---------------------------------------------------------------- */
  /* Selection helpers                                                 */
  /* ---------------------------------------------------------------- */

  function pageRecords(): CentreRecord[] {
    const size = pageSize();
    return visible.slice(page * size, page * size + size);
  }

  function announceSelection(): void {
    ctx.a11y.announce(t('notificationCentre.select.announce', '{count} records selected.', { count: selection.size }));
  }

  function selectRange(from: number, to: number): void {
    const start = Math.min(from, to);
    const end = Math.max(from, to);
    for (let index = start; index <= end; index += 1) {
      const record = visible[index];
      if (record) selection.add(record.id);
    }
  }

  /* ---------------------------------------------------------------- */
  /* Destructive paths                                                 */
  /* ---------------------------------------------------------------- */

  async function runDelete(ids: string[], anchor: HTMLElement): Promise<void> {
    if (ids.length === 0) return;
    const records = ids
      .map((id) => archive.byId(id))
      .filter((record): record is CentreRecord => record !== null);
    const affected = records
      .slice(0, CONFIRM_LIST_ROWS)
      .map((record) => `${titleOf(record)} — ${record.source} — ${formatTimestamp(record.createdAt)}`);
    if (records.length > CONFIRM_LIST_ROWS) {
      affected.push(
        t('notificationCentre.confirm.affectedOthers', '…and {count} more records not listed here', {
          count: records.length - CONFIRM_LIST_ROWS
        })
      );
    }
    const approved = await ctx.confirm.request({
      action: t('notificationCentre.confirm.delete', 'Delete {count} notification records from the log', {
        count: records.length
      }),
      affected,
      irreversible: t(
        'notificationCentre.confirm.deleteIrreversible',
        'These records are removed from the stored log and cannot be recovered from within the application.',
        { count: records.length, path: archive.status().path }
      ),
      anchor
    });
    if (!approved) return;
    const removed = await archive.remove(ids);
    for (const id of ids) {
      selection.delete(id);
      expandedBodies.delete(id);
    }
    anchorIndex = null;
    await ctx.history.record('Notification records deleted', 'notification-centre', {
      count: removed,
      ids: ids.slice(0, 50),
      path: archive.status().path
    });
    ctx.notify.success(t('notificationCentre.result.deleted', '{count} records deleted', { count: removed }));
    draw();
  }

  async function runClear(anchor: HTMLElement): Promise<void> {
    const total = everything.length;
    if (total === 0) return;
    const affected = everything
      .slice(0, CONFIRM_LIST_ROWS)
      .map((record) => `${titleOf(record)} — ${record.source} — ${formatTimestamp(record.createdAt)}`);
    if (total > CONFIRM_LIST_ROWS) {
      affected.push(
        t('notificationCentre.confirm.affectedOthers', '…and {count} more records not listed here', {
          count: total - CONFIRM_LIST_ROWS
        })
      );
    }
    const approved = await ctx.confirm.request({
      action: t('notificationCentre.confirm.clear', 'Delete every stored notification record ({count})', {
        count: total
      }),
      affected,
      irreversible: t(
        'notificationCentre.confirm.deleteIrreversible',
        'These records are removed from the stored log and cannot be recovered from within the application.',
        { count: total, path: archive.status().path }
      ),
      anchor
    });
    if (!approved) return;
    const removed = await archive.clear();
    selection.clear();
    expandedBodies.clear();
    anchorIndex = null;
    page = 0;
    await ctx.history.record('Notification log cleared', 'notification-centre', {
      count: removed,
      path: archive.status().path
    });
    ctx.notify.success(t('notificationCentre.result.cleared', 'The log is empty', { count: removed }));
    draw();
  }

  /* ---------------------------------------------------------------- */
  /* Export                                                            */
  /* ---------------------------------------------------------------- */

  function exportRows(records: CentreRecord[]): Array<Record<string, unknown>> {
    return records.map((record) => ({
      id: record.id,
      createdAt: record.createdAt,
      createdAtLocal: formatTimestamp(record.createdAt),
      severity: record.severity,
      severityName: severityName(record.severity),
      source: record.source,
      titleKey: record.title,
      title: titleOf(record),
      body: bodyOf(record),
      dismissedAt: record.dismissedAt,
      stillShowing: record.showing,
      fromThisSession: record.fromThisSession,
      endedWithItsSession: record.endedWithItsSession,
      progress: record.progress,
      linkLabel: record.link?.label ?? '',
      linkUrl: record.link?.url ?? '',
      actionLabels: record.actionLabels.join(' | ')
    }));
  }

  function openExportPanel(anchor: HTMLElement): void {
    const overlay = ctx.overlay.open({
      anchor,
      role: 'dialog',
      label: 'notificationCentre.export.title',
      placement: 'bottom-end',
      resizeKey: 'notification-centre-export',
      dragKey: 'notification-centre-export'
    });

    let scope: 'selection' | 'filtered' | 'everything' = selection.size > 0 ? 'selection' : 'filtered';
    let format = String(
      ctx.settings.get(SETTING_EXPORT_FORMAT, DEFAULT_EXPORT_FORMAT)
    ) as ExportFormat;

    const rowsFor = (): CentreRecord[] => {
      if (scope === 'selection') return everything.filter((record) => selection.has(record.id));
      if (scope === 'filtered') return visible;
      return everything;
    };

    const losses = el('div', { className: 'notification-centre-export__losses md-typescale-body-small' });
    const omitted = el('p', {
      className: 'md-typescale-body-small',
      text: t('notificationCentre.export.omitted', 'Action callbacks are not exported.')
    });

    const refreshLosses = (): void => {
      losses.textContent = '';
      const records = exportRows(rowsFor());
      const preflight = ctx.exporter.preflight(records, format);
      if (preflight.losses.length === 0) {
        losses.append(
          el('p', {
            text: ctx.t('core.export.noLosses', '{format} carries every field faithfully.', {
              values: { format: format.toUpperCase() }
            })
          })
        );
        return;
      }
      losses.append(
        el('p', {
          text: ctx.t('core.export.losses', 'This format cannot carry every field faithfully:', {
            values: { format: format.toUpperCase() }
          })
        })
      );
      const list = el('ul', { attrs: { role: 'list' } });
      for (const loss of preflight.losses) {
        list.append(el('li', { text: `${loss.field}: ${loss.reason}` }));
      }
      losses.append(list);
    };

    const scopeControl = c.radioGroup({
      label: 'notificationCentre.export.scope',
      options: [
        { value: 'selection', label: 'notificationCentre.export.scope.selection' },
        { value: 'filtered', label: 'notificationCentre.export.scope.filtered' },
        { value: 'everything', label: 'notificationCentre.export.scope.everything' }
      ],
      value: scope,
      onChange: (value) => {
        scope = value === 'selection' || value === 'everything' ? value : 'filtered';
        refreshLosses();
      }
    });

    /* Each scope carries a live count, which is data. The radio group resolved
       the key without one, so the exact numbers are written on afterwards. */
    const scopeCounts = [
      t('notificationCentre.export.scope.selection', 'The {count} selected records', { count: selection.size }),
      t('notificationCentre.export.scope.filtered', 'The {count} records the filters allow', {
        count: visible.length
      }),
      t('notificationCentre.export.scope.everything', 'Every stored record ({count})', {
        count: everything.length
      })
    ];
    scopeControl.root.querySelectorAll('.md-radio span').forEach((node, index) => {
      const replacement = scopeCounts[index];
      if (replacement) node.textContent = replacement;
    });

    const formatControl = c.select({
      label: 'core.export.format',
      options: ctx.exporter
        .formats()
        .map((candidate) => ({ value: candidate, label: `notificationCentre.format.${candidate}` })),
      value: format,
      onChange: (value) => {
        format = value as ExportFormat;
        ctx.settings.set(SETTING_EXPORT_FORMAT, value);
        refreshLosses();
      }
    });

    const run = c.button({
      label: 'notificationCentre.export.run',
      variant: 'filled',
      icon: 'save',
      onClick: async () => {
        const records = exportRows(rowsFor());
        if (records.length === 0) {
          ctx.notify.warn(t('notificationCentre.disabled.emptyLog', 'There is nothing to work on.'));
          return;
        }
        const path = await ctx.exporter.save(records, format, {
          name: 'notifications',
          schemaVersion: '1',
          defaultFileName: `notifications.${format === 'markdown' ? 'md' : format}`
        });
        if (!path) {
          ctx.notify.info(t('notificationCentre.export.cancelled', 'No file was chosen, so nothing was written.'));
          return;
        }
        await ctx.history.record('Notification log exported', 'notification-centre', {
          format,
          scope,
          count: records.length,
          path
        });
        ctx.notify.success(ctx.t('core.export.saved', 'Exported to {path}', { values: { path } }));
        overlay.close();
      }
    });

    const cancel = c.button({
      label: 'core.action.cancel',
      variant: 'text',
      onClick: () => overlay.close()
    });

    const actions = el('div', { className: 'notification-centre-export__actions' });
    actions.append(cancel, run);

    overlay.body.append(scopeControl.root, formatControl.root, losses, omitted, actions);
    refreshLosses();
  }

  /* ---------------------------------------------------------------- */
  /* Rows                                                              */
  /* ---------------------------------------------------------------- */

  function buildRow(record: CentreRecord, indexInVisible: number, tabbable: boolean): HTMLElement {
    const row = el('li', {
      className: `notification-centre-row notification-centre-row--${record.severity}`,
      attrs: {
        'data-notification-id': record.id,
        'data-severity': record.severity,
        'data-appearance-id': 'notification-centre:row'
      }
    });
    row.tabIndex = tabbable ? 0 : -1;

    const selected = selection.has(record.id);
    row.classList.toggle('notification-centre-row--selected', selected);

    const title = titleOf(record);
    const body = bodyOf(record);
    const stateText = record.showing
      ? t('notificationCentre.row.showing', 'Still showing')
      : record.dismissedAt
        ? t('notificationCentre.row.dismissedAt', 'Dismissed {when}', {
            when: formatTimestamp(record.dismissedAt)
          })
        : t('notificationCentre.row.endedWithSession', 'Still showing when that session ended');

    row.setAttribute(
      'aria-label',
      `${severityName(record.severity)}. ${title}. ${record.source}. ${formatTimestamp(record.createdAt)}. ${stateText}`
    );

    /* selection checkbox */
    const box = c.checkbox({
      label: 'notificationCentre.select.rowLabel',
      checked: selected,
      onChange: (checked) => {
        if (checked) selection.add(record.id);
        else selection.delete(record.id);
        anchorIndex = indexInVisible;
        row.classList.toggle('notification-centre-row--selected', checked);
        refreshToolbar();
        drawPreview();
        announceSelection();
      }
    });
    box.root.classList.add('notification-centre-row__select');
    box.root.querySelector('span')?.classList.add('md-visually-hidden');

    /* Leading severity mark. It is decorative here rather than named, because
       the row's own accessible name already opens with the severity and a
       screen reader must not read it twice. */
    const mark = el('div', { className: 'notification-centre-row__mark' });
    mark.append(c.icon(SEVERITY_ICON[record.severity], { size: 20 }));

    /* text */
    const text = el('div', { className: 'notification-centre-row__text' });
    text.append(el('span', { className: 'notification-centre-row__title md-typescale-title-small', text: title }));

    if (body) {
      const expanded = expandedBodies.has(record.id);
      const shortened = truncate(body, BODY_PREVIEW_LIMIT);
      const bodyNode = el('p', {
        className: 'notification-centre-row__body md-typescale-body-medium',
        text: expanded ? body : shortened.text
      });
      text.append(bodyNode);
      if (shortened.truncated) {
        const toggle = c.button({
          label: expanded ? 'notificationCentre.action.showLess' : 'notificationCentre.action.showMore',
          variant: 'text',
          onClick: () => {
            if (expanded) expandedBodies.delete(record.id);
            else expandedBodies.add(record.id);
            draw();
          }
        });
        toggle.classList.add('notification-centre-row__more');
        text.append(toggle);
      }
    }

    if (record.progress !== null) {
      const percentText = t('notificationCentre.row.progress', 'Progress recorded at {percent}%', {
        percent: Math.round(record.progress * 100)
      });
      const progress = c.linearProgress({ label: 'notificationCentre.row.progress', value: record.progress });
      // The interpolated value is data, so it is written onto the accessible
      // name directly rather than resolved as a key.
      progress.root.setAttribute('aria-label', percentText);
      text.append(el('span', { className: 'notification-centre-row__meta md-typescale-body-small', text: percentText }), progress.root);
    }

    const metaParts = [
      record.source,
      `${formatTimestamp(record.createdAt)} (${relativeTime(record.createdAt)})`,
      severityName(record.severity),
      stateText
    ];
    if (!record.fromThisSession) {
      metaParts.push(t('notificationCentre.row.earlierSession', 'From an earlier session'));
    }
    text.append(el('span', { className: 'notification-centre-row__meta md-typescale-body-small', text: metaParts.join(' · ') }));

    /* actions — the real ones, while this session still holds them */
    const actions = el('div', { className: 'notification-centre-row__actions' });
    const runnable = archive.actionsFor(record.id);
    for (const action of runnable) {
      actions.append(
        c.button({
          label: action.label,
          variant: 'text',
          onClick: () => {
            void (async () => {
              try {
                await action.run();
              } catch (error) {
                ctx.notify.error(
                  ctx.t(action.label, action.label),
                  error instanceof Error ? error.message : String(error)
                );
              }
            })();
          }
        })
      );
    }
    if (runnable.length === 0 && record.actionLabels.length > 0) {
      // The labels are data and survived the restart; the callbacks are code and
      // did not. Saying so beats rendering a button that would do nothing.
      text.append(
        el('p', {
          className: 'notification-centre-row__note md-typescale-body-small',
          text: t(
            'notificationCentre.row.actionsUnavailable',
            'The actions this notification carried belonged to a session that has ended.',
            { labels: record.actionLabels.map((entry) => ctx.t(entry, entry)).join(', ') }
          )
        })
      );
    }

    if (record.link) {
      const link = record.link;
      actions.append(
        c.button({
          label: link.label,
          variant: 'text',
          icon: 'world',
          onClick: async () => {
            const result = await ctx.studio.shell.openExternal(link.url);
            if (!result.ok) {
              ctx.notify.error(
                t('notificationCentre.result.linkFailed', 'The link could not be opened: {reason}', {
                  reason: result.error
                })
              );
            }
          }
        })
      );
    }

    const dismissRow = c.iconButton({
      icon: 'remove',
      label: 'notificationCentre.action.dismissRow',
      onClick: () => {
        if (isInert(dismissRow)) return;
        archive.dismiss([record.id]);
        void ctx.history.record('Notifications dismissed', 'notification-centre', { count: 1, ids: [record.id] });
        draw();
      }
    });
    setDisabled(
      dismissRow,
      !record.showing,
      t('notificationCentre.disabled.noneDismissable', 'This notification is not on screen, so there is nothing to dismiss.')
    );

    const copyRow = c.iconButton({
      icon: 'copy',
      label: 'notificationCentre.action.copyRecord',
      onClick: async () => {
        const payload = JSON.stringify(exportRows([record])[0], null, 2);
        try {
          await navigator.clipboard.writeText(payload);
          ctx.notify.success(t('notificationCentre.result.copied', 'The record was copied to the clipboard'));
        } catch (error) {
          ctx.notify.error(
            t('notificationCentre.result.copyFailed', 'The clipboard refused the copy: {reason}', {
              reason: error instanceof Error ? error.message : String(error)
            })
          );
        }
      }
    });

    const deleteRow = c.iconButton({
      icon: 'trash',
      label: 'notificationCentre.action.deleteRow',
      onClick: (event) => {
        void runDelete([record.id], event.currentTarget as HTMLElement);
      }
    });

    actions.append(dismissRow, copyRow, deleteRow);

    row.append(box.root, mark, text, actions);

    /* pointer selection, including shift-click ranges */
    row.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      if (target.closest('button') || target.closest('.notification-centre-row__actions')) return;
      if (target.closest('.notification-centre-row__select') && !event.shiftKey) return;
      event.preventDefault();
      if (event.shiftKey && anchorIndex !== null) {
        selectRange(anchorIndex, indexInVisible);
      } else {
        if (selection.has(record.id)) selection.delete(record.id);
        else selection.add(record.id);
        anchorIndex = indexInVisible;
      }
      announceSelection();
      draw();
    });

    row.addEventListener('keydown', (event) => {
      if (event.target !== row) return;
      if (event.key === ' ') {
        event.preventDefault();
        if (selection.has(record.id)) selection.delete(record.id);
        else selection.add(record.id);
        anchorIndex = indexInVisible;
        announceSelection();
        draw();
        window.requestAnimationFrame(() => {
          const restored = listNode.querySelector<HTMLElement>(`[data-notification-id="${CSS.escape(record.id)}"]`);
          restored?.focus();
        });
        return;
      }
      if (event.shiftKey && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
        event.preventDefault();
        const target = indexInVisible + (event.key === 'ArrowDown' ? 1 : -1);
        if (target < 0 || target >= visible.length) return;
        selectRange(anchorIndex ?? indexInVisible, target);
        anchorIndex = anchorIndex ?? indexInVisible;
        announceSelection();
        draw();
        window.requestAnimationFrame(() => {
          const neighbour = visible[target];
          const node = neighbour
            ? listNode.querySelector<HTMLElement>(`[data-notification-id="${CSS.escape(neighbour.id)}"]`)
            : null;
          node?.focus();
        });
        return;
      }
      if (event.key === 'Delete') {
        event.preventDefault();
        const ids = selection.size > 0 ? [...selection] : [record.id];
        void runDelete(ids, row);
      }
    });

    return row;
  }

  /* ---------------------------------------------------------------- */
  /* Drawing                                                           */
  /* ---------------------------------------------------------------- */

  function drawStorageStatus(): void {
    const status = archive.status();
    const parts: string[] = [];
    if (status.error) {
      parts.push(
        t('notificationCentre.status.error', 'The stored log could not be used.', {
          path: status.path,
          reason: status.error
        })
      );
    } else if (!status.enabled) {
      parts.push(
        t('notificationCentre.status.disabled', 'Keeping the log across restarts is switched off.', {
          stored: everything.length
        })
      );
    } else if (status.written) {
      parts.push(
        t('notificationCentre.status.persisted', '{stored} kept in {path}.', {
          stored: everything.length,
          path: status.path,
          loaded: status.loadedFromDisk
        })
      );
    } else {
      parts.push(
        t('notificationCentre.status.notYetWritten', 'The log has not been written yet this session.', {
          stored: everything.length,
          path: status.path
        })
      );
    }
    if (status.refusedOnLoad > 0) {
      parts.push(
        t('notificationCentre.status.refused', 'Some stored records were refused as malformed.', {
          count: status.refusedOnLoad
        })
      );
    }
    storageStatus.textContent = parts.join(' ');
    storageStatus.classList.toggle('notification-centre-status--error', status.error !== null);
  }

  function drawFilterChips(query: SearchQuery): void {
    /* Severity chips are a fixed set, so they are built once and updated.
       The visible text carries a live count, which is data rather than copy, so
       it is written straight onto the node instead of being handed to the
       translator as though it were a key. */
    for (const severity of SEVERITIES) {
      const count = everything.filter((record) => record.severity === severity).length;
      const text = `${severityName(severity)} (${count})`;
      let held = severityChips.get(severity);
      if (!held) {
        const chip = c.chip({
          label: `core.notify.severity.${severity}`,
          icon: SEVERITY_ICON[severity],
          selected: filters.severities.has(severity),
          onToggle: (on) => {
            if (on) filters.severities.add(severity);
            else filters.severities.delete(severity);
            page = 0;
            draw();
          }
        });
        const labelNode = chip.querySelector('span');
        if (!labelNode) continue;
        held = { chip, label: labelNode };
        severityChips.set(severity, held);
        severityRow.append(chip);
      }
      held.label.textContent = text;
      held.chip.setAttribute('aria-pressed', String(filters.severities.has(severity)));
    }

    /* Sources are discovered from the data, so the row is rebuilt when the set
       of sources changes and updated in place otherwise. */
    const sources = [...new Set(everything.map((record) => record.source))].sort();
    const signature = JSON.stringify(sources);
    if (signature !== sourceSignature) {
      sourceSignature = signature;
      sourceRow.textContent = '';
      sourceChips.clear();
      for (const source of sources) {
        const chip = c.chip({
          // A feature id is a proper noun, not copy: the visible text is set
          // below rather than run through the translator.
          label: 'notificationCentre.filters.source',
          selected: filters.sources.has(source),
          onToggle: (on) => {
            if (on) filters.sources.add(source);
            else filters.sources.delete(source);
            page = 0;
            draw();
          }
        });
        const labelNode = chip.querySelector('span');
        if (labelNode) sourceChips.set(source, { chip, label: labelNode });
        sourceRow.append(chip);
      }
      if (sources.length === 0) {
        sourceRow.append(
          el('p', {
            className: 'md-typescale-body-small',
            text: t('notificationCentre.stats.none', 'Nothing has been recorded yet.')
          })
        );
      }
    }
    for (const source of sources) {
      const count = everything.filter((record) => record.source === source).length;
      const held = sourceChips.get(source);
      if (held) {
        held.label.textContent = `${source} (${count})`;
        held.chip.setAttribute('aria-pressed', String(filters.sources.has(source)));
      }
    }

    /* The collapsed note: a filter that is hiding rows always says so. */
    const searchExcluded = everything.filter((record) => !matchesFilters(record, query)).length;
    const active = activeFilterCount() + (query.text.trim() === '' ? 0 : 1);
    if (active === 0) {
      filtersPanel.setNote('');
    } else if (filtersPanel.isExpanded()) {
      filtersPanel.setNote(
        t('notificationCentre.filters.active', '{count} filters are applied.', {
          count: active,
          hidden: searchExcluded,
          total: everything.length
        })
      );
    } else {
      filtersPanel.setNote(
        t('notificationCentre.filters.collapsedWarning', 'The filter row is collapsed and is still hiding records.', {
          hidden: searchExcluded,
          total: everything.length
        })
      );
    }
    setDisabled(
      resetFilters,
      active === 0,
      t('notificationCentre.filters.inactive', 'No filter is applied.', { total: everything.length })
    );
  }

  function drawStatistics(): void {
    statsBody.textContent = '';
    if (everything.length === 0) {
      statsBody.append(
        el('p', {
          className: 'md-typescale-body-medium',
          text: t('notificationCentre.stats.none', 'Nothing has been recorded yet.')
        })
      );
      statsPanel.setNote('');
      return;
    }

    const showing = everything.filter((record) => record.showing).length;
    const dismissed = everything.filter((record) => record.dismissedAt !== null).length;
    const thisSession = everything.filter((record) => record.fromThisSession).length;
    const oldest = everything[everything.length - 1];
    const newest = everything[0];

    const summary = el('dl', { className: 'notification-centre-stats__grid' });
    const addRow = (labelText: string, valueText: string): void => {
      summary.append(
        el('dt', { className: 'md-typescale-label-medium', text: labelText }),
        el('dd', { className: 'md-typescale-body-medium', text: valueText })
      );
    };
    addRow(t('notificationCentre.stats.total', 'Records stored'), String(everything.length));
    addRow(t('notificationCentre.stats.showing', 'Still showing on screen'), String(showing));
    addRow(t('notificationCentre.stats.dismissed', 'Dismissed'), String(dismissed));
    addRow(t('notificationCentre.stats.thisSession', 'Raised this session'), String(thisSession));
    addRow(t('notificationCentre.stats.newest', 'Newest record'), formatTimestamp(newest.createdAt));
    addRow(t('notificationCentre.stats.oldest', 'Oldest record'), formatTimestamp(oldest.createdAt));
    statsBody.append(summary);

    const bars = el('div', { className: 'notification-centre-stats__bars' });
    bars.append(
      el('h4', {
        className: 'md-typescale-label-large',
        text: t('notificationCentre.stats.bySeverity', 'By severity')
      })
    );
    for (const severity of SEVERITIES) {
      const count = everything.filter((record) => record.severity === severity).length;
      if (count === 0) continue;
      const line = el('div', { className: 'notification-centre-stats__bar' });
      line.append(el('span', { className: 'md-typescale-body-small', text: `${severityName(severity)} — ${count}` }));
      const track = el('div', { className: 'notification-centre-stats__track' });
      const fill = el('div', { className: `notification-centre-stats__fill notification-centre-stats__fill--${severity}` });
      fill.style.width = `${Math.round((count / everything.length) * 100)}%`;
      track.append(fill);
      line.append(track);
      bars.append(line);
    }

    bars.append(
      el('h4', {
        className: 'md-typescale-label-large',
        text: t('notificationCentre.stats.bySource', 'By source')
      })
    );
    const bySource = new Map<string, number>();
    for (const record of everything) bySource.set(record.source, (bySource.get(record.source) ?? 0) + 1);
    for (const [source, count] of [...bySource.entries()].sort((a, b) => b[1] - a[1])) {
      const line = el('div', { className: 'notification-centre-stats__bar' });
      line.append(el('span', { className: 'md-typescale-body-small', text: `${source} — ${count}` }));
      const track = el('div', { className: 'notification-centre-stats__track' });
      const fill = el('div', { className: 'notification-centre-stats__fill' });
      fill.style.width = `${Math.round((count / everything.length) * 100)}%`;
      track.append(fill);
      line.append(track);
      bars.append(line);
    }
    statsBody.append(bars);

    statsBody.append(
      el('p', {
        className: 'md-typescale-body-small',
        text: t('notificationCentre.stats.retention', 'The newest records are kept.', {
          count: archive.status().retention
        })
      })
    );

    /* The statistics never filter anything, so a collapsed panel is not
       excluding results and must not claim it is. */
    statsPanel.setNote('');
  }

  function refreshToolbar(): void {
    const shown = pageRecords().length;
    const dismissable = [...selection].filter((id) => archive.byId(id)?.showing === true).length;

    /* The two select-alls carry live counts and say plainly which scope they
       mean: this page, or every record the search and filters allow. */
    const pageLabel = selectPage.querySelector('.md-btn__label');
    if (pageLabel) {
      pageLabel.textContent = t('notificationCentre.select.page', 'Select the {count} on this page', {
        count: shown
      });
    }
    const everyLabel = selectEvery.querySelector('.md-btn__label');
    if (everyLabel) {
      everyLabel.textContent = t('notificationCentre.select.every', 'Select every match ({count})', {
        count: visible.length
      });
    }

    setDisabled(selectPage, shown === 0, t('notificationCentre.disabled.emptyLog', 'There is nothing to work on.'));
    setDisabled(
      selectEvery,
      visible.length === 0,
      t('notificationCentre.disabled.emptyLog', 'There is nothing to work on.')
    );
    setDisabled(
      invertSelection,
      visible.length === 0,
      t('notificationCentre.disabled.emptyLog', 'There is nothing to work on.')
    );
    setDisabled(
      clearSelection,
      selection.size === 0,
      t('notificationCentre.disabled.noSelection', 'Nothing is selected yet.')
    );
    setDisabled(
      dismissSelected,
      dismissable === 0,
      selection.size === 0
        ? t('notificationCentre.disabled.noSelection', 'Nothing is selected yet.')
        : t('notificationCentre.disabled.noneDismissable', 'None of the selected records is still showing.')
    );
    setDisabled(
      deleteSelected,
      selection.size === 0,
      t('notificationCentre.disabled.noSelection', 'Nothing is selected yet.')
    );
    setDisabled(
      exportButton,
      everything.length === 0,
      t('notificationCentre.disabled.emptyLog', 'There is nothing to work on.')
    );

    const size = pageSize();
    const pages = Math.max(1, Math.ceil(visible.length / size));
    setDisabled(previousPage, page === 0, t('notificationCentre.disabled.firstPage', 'This is the first page.'));
    setDisabled(nextPage, page >= pages - 1, t('notificationCentre.disabled.lastPage', 'This is the last page.'));

    selectionSummary.textContent = t(
      'notificationCentre.select.summary',
      '{selected} selected · {shown} of {total} shown · page {page} of {pages}',
      {
        selected: selection.size,
        shown: visible.length,
        total: everything.length,
        page: page + 1,
        pages
      }
    );
    pageStatus.textContent = `${page + 1} / ${pages}`;
  }

  /** The reviewable preview of exactly what a bulk action would touch. */
  function drawPreview(): void {
    previewList.textContent = '';
    const chosen = everything.filter((record) => selection.has(record.id));
    previewPanel.root.hidden = chosen.length === 0;
    if (chosen.length === 0) return;

    previewPanel.setNote(
      t('notificationCentre.select.announce', '{count} records selected.', { count: chosen.length })
    );
    for (const record of chosen.slice(0, PREVIEW_ROWS)) {
      previewList.append(
        el('li', {
          className: 'md-typescale-body-small',
          text: `${titleOf(record)} — ${record.source} — ${formatTimestamp(record.createdAt)}${
            record.showing ? ` — ${t('notificationCentre.row.showing', 'Still showing')}` : ''
          }`
        })
      );
    }
    if (chosen.length > PREVIEW_ROWS) {
      previewList.append(
        el('li', {
          className: 'md-typescale-body-small',
          text: t('notificationCentre.confirm.affectedOthers', '…and {count} more records not listed here', {
            count: chosen.length - PREVIEW_ROWS
          })
        })
      );
    }
  }

  function draw(): void {
    if (disposed) return;
    const query = search.query();
    everything = archive.all();

    /* A source that no longer appears in the log cannot go on filtering it, or
       the list would stay mysteriously empty with no visible cause. */
    const knownSources = new Set(everything.map((record) => record.source));
    for (const chosen of [...filters.sources]) {
      if (!knownSources.has(chosen)) filters.sources.delete(chosen);
    }

    visible = everything.filter((record) => matchesFilters(record, query));

    /* Selection never silently covers a record the filters removed from view;
       the count in the summary and the count in a confirmation always agree. */
    const visibleIds = new Set(everything.map((record) => record.id));
    for (const id of [...selection]) if (!visibleIds.has(id)) selection.delete(id);

    const size = pageSize();
    const pages = Math.max(1, Math.ceil(visible.length / size));
    page = Math.min(page, pages - 1);
    if (page < 0) page = 0;

    drawStorageStatus();
    drawFilterChips(query);
    drawStatistics();

    listNode.textContent = '';
    rowElements.length = 0;
    const start = page * size;
    const slice = visible.slice(start, start + size);

    if (slice.length === 0) {
      const holder = el('li', { className: 'notification-centre-empty-host' });
      if (everything.length === 0) {
        holder.append(
          c.emptyState({ title: 'notificationCentre.empty.title', body: 'notificationCentre.empty.body' })
        );
      } else {
        const state = c.emptyState({
          title: 'notificationCentre.emptyFiltered.title',
          body: 'notificationCentre.emptyFiltered.body',
          action: {
            label: 'notificationCentre.filters.reset',
            variant: 'tonal',
            icon: 'refresh',
            onClick: () => {
              filters.severities.clear();
              filters.sources.clear();
              filters.state = 'all';
              stateControl.set('all');
              search.clear();
              page = 0;
              draw();
            }
          }
        });
        // The stored total is data, so the interpolated line replaces the
        // key-resolved one rather than being passed in as a key.
        const bodyNode = state.querySelectorAll('p')[1];
        if (bodyNode) {
          bodyNode.textContent = t(
            'notificationCentre.emptyFiltered.body',
            '{total} records are stored, and the current search and filters exclude all of them.',
            { total: everything.length }
          );
        }
        holder.append(state);
      }
      listNode.append(holder);
    } else {
      slice.forEach((record, offset) => {
        const row = buildRow(record, start + offset, offset === 0);
        rowElements.push(row);
        listNode.append(row);
      });
    }

    pager.hidden = pages <= 1;
    refreshToolbar();
    drawPreview();
  }

  /* ---------------------------------------------------------------- */
  /* Wiring                                                            */
  /* ---------------------------------------------------------------- */

  const detachArchive = archive.onChange(() => draw());
  const detachSettings = ctx.settings.onChange((change) => {
    if (change.id === SETTING_PAGE_SIZE || change.id === SETTING_EXPORT_FORMAT) draw();
  });

  draw();

  return () => {
    disposed = true;
    detachArchive();
    detachSettings();
    detachRoving();
    root.removeEventListener('keydown', onRootKeyDown);
    search.destroy();
    root.remove();
  };
}
