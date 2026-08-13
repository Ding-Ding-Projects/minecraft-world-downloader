import { el } from '../../core/a11y';
import type { ExportFormat, SearchBarHandle, SearchQuery, TabContext } from '../../core/registry';
import { openLaneForm } from './laneform';
import {
  EVIDENCE_EMOJI,
  SELF_LANE_ID,
  STATUS_EMOJI,
  STATUS_ICON,
  STATUS_VALUES
} from './model';
import type { EvidenceItem, EvidenceState, LaneRecord, StatusValue } from './model';
import { AUTO_REFRESH_ID, AUTO_REFRESH_SECONDS_ID } from './state';
import type { FeatureState } from './state';
import { ageLabel, domSafe, formatTimestamp } from './util';

/**
 * The Status tab.
 *
 * One list, one record shape (`./model.ts`), read straight from the file this
 * feature writes on disk. The first row is always this checkout's own record,
 * refreshed from real Git state; every row after it is something you added by
 * hand to keep another project's last-known status somewhere you will actually
 * see it. Nothing here calls the shared hub — see the banner at the top of the
 * mounted tab, and `docs/features/status.md`, for exactly what that means.
 */

export function mountStatusPanel(host: HTMLElement, ctx: TabContext, state: FeatureState): void {
  const selection = new Set<string>();
  const expanded = new Set<string>([SELF_LANE_ID]);
  const statusFilter = new Set<StatusValue>();
  let query: SearchQuery | null = null;
  let lastToggledId: string | null = null;
  let shiftHeld = false;

  const statusLabel = (value: StatusValue): string => ctx.t(`status.value.${value}`, value);
  const evidenceStateLabel = (value: EvidenceState): string => ctx.t(`status.evidenceValue.${value}`, value);

  /* ================================================================ */
  /* Chrome                                                            */
  /* ================================================================ */

  const refreshButton = ctx.components.button({
    label: 'status.action.refresh',
    variant: 'tonal',
    icon: 'refresh',
    onClick: () => void doRefresh()
  });
  const addButton = ctx.components.button({
    label: 'status.action.add',
    variant: 'filled',
    icon: 'add',
    onClick: (event) => void openAdd(event.currentTarget as HTMLElement)
  });
  addButton.id = 'status-add-lane';
  const exportButton = ctx.components.button({
    label: 'core.action.export',
    variant: 'text',
    icon: 'download',
    onClick: (event) => exportLanes(visibleLanes(), event.currentTarget as HTMLElement)
  });

  host.append(
    ctx.components.topAppBar({
      title: 'status.tab.title',
      subtitle: 'status.tab.subtitle',
      actions: [refreshButton, addButton, exportButton]
    })
  );

  const banner = ctx.components.card({ variant: 'outlined' });
  banner.classList.add('status-banner');
  banner.setAttribute('data-appearance-id', 'status:banner');
  ctx.appearance.applyTo(banner, '.status-banner');
  banner.append(
    el('h2', { className: 'md-typescale-title-small', text: ctx.t('status.banner.heading', 'A local record, not a live connection') }),
    el('p', {
      className: 'md-typescale-body-medium',
      text: ctx.t(
        'status.banner.body',
        "This tab reads this application's own record from disk. It never connects to the shared status hub over the network, and it never shows or stores the hub's enrollment token. Everything below is what is actually on this computer, with its age stated beside it — never a stale record shown as current."
      )
    })
  );
  host.append(banner);

  const storeStatus = el('p', { className: 'md-typescale-body-small status-store-status', attrs: { role: 'status' } });
  host.append(storeStatus);

  /* ================================================================ */
  /* Filters                                                           */
  /* ================================================================ */

  const filterSection = el('section', { className: 'status-filters', attrs: { id: 'status-filters' } });
  const chipsRow = el('div', {
    className: 'status-filters__chips',
    attrs: { role: 'group', 'aria-label': ctx.t('status.filter.heading', 'Filter by status') }
  });
  const search: SearchBarHandle = ctx.createSearchBar({
    label: 'status.search.label',
    placeholder: 'status.search.placeholder',
    sample: 'This checkout\nnext release\nblocked on credentials',
    onChange: (nextQuery) => {
      query = nextQuery;
      draw();
    }
  });
  search.input.id = 'status-search';
  filterSection.append(chipsRow, search.root);
  host.append(filterSection);

  /* ================================================================ */
  /* Bulk actions                                                      */
  /* ================================================================ */

  const bulkBar = el('section', {
    className: 'status-bulk',
    attrs: { role: 'group', 'aria-label': ctx.t('status.bulk.title', 'Selected status lanes') }
  });
  const bulkCount = el('p', { className: 'md-typescale-body-medium', attrs: { role: 'status', 'aria-live': 'polite' } });
  const selectAllButton = ctx.components.button({
    label: 'status.bulk.selectAll',
    variant: 'text',
    onClick: () => {
      for (const lane of visibleLanes()) selection.add(lane.id);
      draw();
    }
  });
  const invertButton = ctx.components.button({
    label: 'status.bulk.invert',
    variant: 'text',
    onClick: () => {
      for (const lane of visibleLanes()) {
        if (selection.has(lane.id)) selection.delete(lane.id);
        else selection.add(lane.id);
      }
      draw();
    }
  });
  const clearSelectionButton = ctx.components.button({
    label: 'status.bulk.clear',
    variant: 'text',
    onClick: () => {
      selection.clear();
      lastToggledId = null;
      draw();
    }
  });
  const bulkExportButton = ctx.components.button({
    label: 'status.bulk.export',
    variant: 'text',
    icon: 'download',
    onClick: (event) => exportLanes(selectedLanes(), event.currentTarget as HTMLElement)
  });
  const bulkDeleteButton = ctx.components.button({
    label: 'status.bulk.delete',
    variant: 'text',
    danger: true,
    icon: 'trash',
    onClick: (event) => void bulkDelete(event.currentTarget as HTMLElement)
  });
  const bulkActions = el('div', { className: 'status-bulk__actions' });
  bulkActions.append(selectAllButton, invertButton, clearSelectionButton, bulkExportButton, bulkDeleteButton);
  bulkBar.append(bulkCount, bulkActions);
  host.append(bulkBar);

  /* ================================================================ */
  /* Results                                                           */
  /* ================================================================ */

  const resultsHead = el('p', { className: 'md-typescale-body-small', attrs: { role: 'status', id: 'status-results-summary' } });
  host.append(resultsHead);

  const listHost = ctx.components.list({ label: ctx.t('status.lanes.heading', 'Status lanes') });
  listHost.id = 'status-results';
  listHost.classList.add('status-lanes');
  host.append(listHost);

  /* ================================================================ */
  /* Data                                                              */
  /* ================================================================ */

  function allLanes(): LaneRecord[] {
    return state.store.lanes();
  }

  function searchableText(lane: LaneRecord): string {
    return [
      lane.title,
      lane.repository,
      lane.branch,
      lane.agent,
      lane.status,
      lane.summary,
      lane.assumption,
      lane.verifiedBaseline,
      lane.machine,
      lane.nextGates.join(' '),
      lane.evidence.map((item) => `${item.label} ${item.url}`).join(' ')
    ].join('\n');
  }

  function afterSearch(): LaneRecord[] {
    const lanes = allLanes();
    if (!query || query.text.trim() === '') return lanes;
    const activeQuery = query;
    return lanes.filter((lane) => activeQuery.matches(searchableText(lane)));
  }

  function visibleLanes(): LaneRecord[] {
    const searched = afterSearch();
    const filtered = statusFilter.size === 0 ? searched : searched.filter((lane) => statusFilter.has(lane.status));
    return [...filtered].sort((a, b) => {
      if (a.id === SELF_LANE_ID) return -1;
      if (b.id === SELF_LANE_ID) return 1;
      return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
    });
  }

  function selectedLanes(): LaneRecord[] {
    const ids = selection;
    return allLanes().filter((lane) => ids.has(lane.id));
  }

  /* ================================================================ */
  /* Actions                                                           */
  /* ================================================================ */

  async function doRefresh(): Promise<void> {
    const result = await state.refreshSelf();
    if (result.ok) {
      ctx.notify.success(ctx.t('status.notify.refreshTitle', 'Refresh this checkout from Git'), ctx.t('status.notify.refreshOk', 'Refreshed.'));
    } else {
      ctx.notify.warn(
        ctx.t('status.notify.refreshTitle', 'Refresh this checkout from Git'),
        ctx.t('status.notify.refreshFailed', 'Git could not be read: {reason}', { values: { reason: result.error } })
      );
    }
  }

  async function openAdd(anchor: HTMLElement): Promise<void> {
    const result = await openLaneForm(ctx, anchor, null);
    if (!result.saved || !result.lane) return;
    const outcome = await state.addLane(result.lane);
    if (!outcome.ok) {
      ctx.notify.error(
        ctx.t('status.notify.saveFailedTitle', 'Save this status lane'),
        ctx.t('status.notify.saveFailed', 'Could not save this lane: {reason}', { values: { reason: outcome.error } })
      );
      return;
    }
    ctx.notify.success(
      ctx.t('status.notify.saveFailedTitle', 'Save this status lane'),
      ctx.t('status.notify.added', 'Added "{title}".', { values: { title: result.lane.title } })
    );
  }

  async function openEdit(lane: LaneRecord, anchor: HTMLElement): Promise<void> {
    const result = await openLaneForm(ctx, anchor, lane);
    if (!result.saved || !result.lane) return;
    const outcome =
      lane.origin === 'local'
        ? await state.updateSelfFields({
            title: result.lane.title,
            status: result.lane.status,
            summary: result.lane.summary,
            assumption: result.lane.assumption,
            evidence: result.lane.evidence,
            nextGates: result.lane.nextGates,
            agent: result.lane.agent,
            machine: result.lane.machine
          })
        : await state.updateLane(result.lane);
    if (!outcome.ok) {
      ctx.notify.error(
        ctx.t('status.notify.saveFailedTitle', 'Save this status lane'),
        ctx.t('status.notify.saveFailed', 'Could not save this lane: {reason}', { values: { reason: outcome.error } })
      );
      return;
    }
    ctx.notify.success(
      ctx.t('status.notify.saveFailedTitle', 'Save this status lane'),
      ctx.t('status.notify.updated', 'Updated "{title}".', { values: { title: result.lane.title } })
    );
  }

  async function deleteOne(lane: LaneRecord, anchor: HTMLElement): Promise<void> {
    const approved = await ctx.confirm.request({
      action: ctx.t('status.confirm.deleteOneAction', 'Delete the status lane "{title}"', { values: { title: lane.title } }),
      affected: [`${lane.title} — ${statusLabel(lane.status)}`],
      irreversible: ctx.t(
        'status.confirm.irreversible',
        'This local record is removed from the status file on disk. The removal is written to local history, so it can be reviewed there afterwards.'
      ),
      anchor
    });
    if (!approved) return;
    const outcome = await state.removeLanes([lane.id], [lane.title]);
    if (!outcome.ok) {
      ctx.notify.error(
        ctx.t('status.notify.deleteFailedTitle', 'Delete a status lane'),
        ctx.t('status.notify.deleteFailed', 'Could not remove that lane: {reason}', { values: { reason: outcome.error } })
      );
      return;
    }
    selection.delete(lane.id);
    ctx.notify.success(ctx.t('status.notify.deleteFailedTitle', 'Delete a status lane'), ctx.t('status.notify.deletedOne', 'Removed "{title}".', { values: { title: lane.title } }));
  }

  async function bulkDelete(anchor: HTMLElement): Promise<void> {
    const chosen = selectedLanes();
    const targets = chosen.filter((lane) => lane.origin !== 'local');
    const skippedSelf = chosen.some((lane) => lane.origin === 'local');
    if (targets.length === 0) return;
    const approved = await ctx.confirm.request({
      action: ctx.t('status.confirm.deleteManyAction', 'Delete {count} status lanes', { values: { count: targets.length } }),
      affected: targets.map((lane) => `${lane.title} — ${statusLabel(lane.status)}`),
      irreversible: ctx.t(
        'status.confirm.irreversible',
        'This local record is removed from the status file on disk. The removal is written to local history, so it can be reviewed there afterwards.'
      ),
      anchor,
      confirmLabel: ctx.t('status.bulk.delete', 'Delete selected')
    });
    if (!approved) return;
    const outcome = await state.removeLanes(
      targets.map((lane) => lane.id),
      targets.map((lane) => lane.title)
    );
    if (!outcome.ok) {
      ctx.notify.error(
        ctx.t('status.notify.deleteFailedTitle', 'Delete a status lane'),
        ctx.t('status.notify.deleteFailed', 'Could not remove those lanes: {reason}', { values: { reason: outcome.error } })
      );
      return;
    }
    for (const lane of targets) selection.delete(lane.id);
    ctx.notify.success(
      ctx.t('status.notify.deleteFailedTitle', 'Delete a status lane'),
      ctx.t('status.notify.deleted', '{count} status lane(s) removed.', { values: { count: targets.length } })
    );
    if (skippedSelf) {
      ctx.notify.info(
        ctx.t('status.notify.deleteFailedTitle', 'Delete a status lane'),
        ctx.t('status.notify.deleteSkippedSelf', "This checkout's own record was left alone — it can be edited, but never removed.")
      );
    }
  }

  function laneToRecord(lane: LaneRecord): Record<string, unknown> {
    const worktree = lane.worktrees[0];
    return {
      id: lane.id,
      origin: lane.origin,
      title: lane.title,
      repository: lane.repository,
      branch: lane.branch,
      agent: lane.agent,
      status: lane.status,
      summary: lane.summary,
      assumption: lane.assumption,
      verifiedBaseline: lane.verifiedBaseline,
      evidence: lane.evidence.map((item) => `${item.state}|${item.label}|${item.url}`).join('; '),
      nextGates: lane.nextGates.join('; '),
      machine: lane.machine,
      worktree: worktree ? `${worktree.path} @ ${worktree.commit.slice(0, 7)}${worktree.dirty ? ' (uncommitted changes)' : ''}` : '',
      updatedAt: lane.updatedAt
    };
  }

  function exportLanes(records: LaneRecord[], anchor: HTMLElement): void {
    if (records.length === 0) {
      ctx.notify.info(ctx.t('status.export.title', 'Export status lanes'), ctx.t('status.export.empty', 'There is nothing to export yet.'));
      return;
    }
    const rows = records.map(laneToRecord);
    const overlay = ctx.overlay.open({
      anchor,
      placement: 'bottom-end',
      role: 'dialog',
      label: ctx.t('status.export.title', 'Export status lanes'),
      resizeKey: 'status.exportPanel',
      dragKey: 'status.exportPanel'
    });
    let format: ExportFormat = 'json';

    const summary = el('p', { className: 'md-typescale-body-medium', attrs: { role: 'status' } });
    const losses = el('p', { className: 'md-typescale-body-small' });

    const refresh = (): void => {
      summary.textContent = ctx.t('status.export.count', '{count} lane(s) will be written.', { values: { count: rows.length } });
      const preflight = ctx.exporter.preflight(rows, format);
      losses.textContent =
        preflight.losses.length === 0
          ? ctx.t('status.export.noLosses', '{format} carries every field faithfully.', { values: { format: format.toUpperCase() } })
          : ctx.t('status.export.losses', '{format} cannot carry every field faithfully. These become text: {fields}', {
              values: { format: format.toUpperCase(), fields: preflight.losses.map((loss) => loss.field).join(', ') }
            });
    };

    const formatControl = ctx.components.select({
      label: 'status.export.format',
      options: ctx.exporter.formats().map((candidate) => ({ value: candidate, label: candidate.toUpperCase() })),
      value: format,
      onChange: (value) => {
        format = value as ExportFormat;
        refresh();
      }
    });

    const saveButton = ctx.components.button({
      label: 'core.action.export',
      variant: 'filled',
      icon: 'download',
      onClick: async () => {
        const path = await ctx.exporter.save(rows, format, {
          name: 'status-lanes',
          defaultFileName: `status-lanes.${format === 'markdown' ? 'md' : format}`
        });
        if (!path) {
          ctx.notify.info(ctx.t('status.export.title', 'Export status lanes'), ctx.t('status.export.cancelled', 'Nothing was written.'));
          return;
        }
        await ctx.history.record('Exported status lanes', 'status', { count: rows.length, format, path });
        ctx.notify.success(ctx.t('status.export.title', 'Export status lanes'), ctx.t('status.export.saved', 'Exported to {path}', { values: { path } }));
        overlay.close();
      }
    });

    overlay.body.append(summary, formatControl.root, losses, saveButton);
    refresh();
    overlay.reposition();
  }

  /* ================================================================ */
  /* Selection                                                         */
  /* ================================================================ */

  function toggleSelection(id: string, indexInVisible: number, visible: LaneRecord[], checked: boolean): void {
    if (shiftHeld && lastToggledId !== null) {
      const previousIndex = visible.findIndex((lane) => lane.id === lastToggledId);
      if (previousIndex !== -1) {
        const from = Math.min(previousIndex, indexInVisible);
        const to = Math.max(previousIndex, indexInVisible);
        for (let cursor = from; cursor <= to; cursor += 1) {
          const laneId = visible[cursor].id;
          if (checked) selection.add(laneId);
          else selection.delete(laneId);
        }
        shiftHeld = false;
        lastToggledId = id;
        draw();
        return;
      }
    }
    shiftHeld = false;
    if (checked) selection.add(id);
    else selection.delete(id);
    lastToggledId = id;
    draw();
  }

  /* ================================================================ */
  /* Rendering                                                         */
  /* ================================================================ */

  function renderEvidenceItem(item: EvidenceItem): HTMLElement {
    const row = el('li', { className: 'status-lane__evidence-item' });
    row.append(
      el('span', {
        className: `status-lane__evidence-state status-lane__evidence-state--${item.state}`,
        text: `${EVIDENCE_EMOJI[item.state]} ${evidenceStateLabel(item.state)}`
      }),
      el('span', { className: 'status-lane__evidence-label', text: item.label })
    );
    row.append(
      ctx.components.iconButton({
        icon: 'world',
        label: ctx.t('status.lane.evidence.open', 'Open "{label}" in your browser', { values: { label: item.label } }),
        onClick: () =>
          void ctx.studio.shell.openExternal(item.url).then((result) => {
            if (!result.ok) {
              ctx.notify.error(
                ctx.t('status.lane.evidence.openFailedTitle', 'Open evidence link'),
                ctx.t('status.lane.evidence.openFailed', 'Could not open that link: {reason}', { values: { reason: result.error } })
              );
            }
          })
      })
    );
    return row;
  }

  function renderLaneDetail(lane: LaneRecord): HTMLElement {
    const detail = el('div', {
      className: 'status-lane__detail',
      attrs: { id: `status-lane-detail-${domSafe(lane.id)}` }
    });

    const facts = el('dl', { className: 'status-lane__facts' });
    const addFact = (fallback: string, key: string, value: string): void => {
      if (value.trim() === '') return;
      facts.append(el('dt', { text: ctx.t(key, fallback) }), el('dd', { text: value }));
    };
    addFact('Agent', 'status.lane.agent', lane.agent);
    addFact('Machine', 'status.lane.machine', lane.machine);
    addFact('Verified baseline', 'status.lane.verifiedBaseline', lane.verifiedBaseline);
    addFact('Assumption', 'status.lane.assumption', lane.assumption);
    if (facts.children.length > 0) detail.append(facts);

    const worktree = lane.worktrees[0];
    if (worktree) {
      detail.append(
        el('p', {
          className: 'md-typescale-body-small status-lane__worktree',
          text: ctx.t('status.lane.worktree', '{path} at {commit}{dirty}', {
            values: {
              path: worktree.path || '—',
              commit: worktree.commit ? worktree.commit.slice(0, 7) : '—',
              dirty: worktree.dirty ? ` (${ctx.t('status.lane.dirty', 'uncommitted changes')})` : ''
            }
          })
        })
      );
    }

    detail.append(el('h4', { className: 'md-typescale-title-small', text: ctx.t('status.lane.evidence.heading', 'Evidence') }));
    if (lane.evidence.length === 0) {
      detail.append(el('p', { className: 'md-typescale-body-small', text: ctx.t('status.lane.evidence.empty', 'No evidence recorded.') }));
    } else {
      const evidenceList = el('ul', { className: 'status-lane__evidence' });
      for (const item of lane.evidence) evidenceList.append(renderEvidenceItem(item));
      detail.append(evidenceList);
    }

    detail.append(el('h4', { className: 'md-typescale-title-small', text: ctx.t('status.lane.gates.heading', 'Next gates') }));
    if (lane.nextGates.length === 0) {
      detail.append(el('p', { className: 'md-typescale-body-small', text: ctx.t('status.lane.gates.empty', 'No next gates recorded.') }));
    } else {
      const gateList = el('ul', { className: 'status-lane__gates' });
      for (const gate of lane.nextGates) gateList.append(el('li', { className: 'md-typescale-body-medium', text: gate }));
      detail.append(gateList);
    }

    return detail;
  }

  function renderLaneRow(lane: LaneRecord, indexInVisible: number, visible: LaneRecord[]): HTMLElement {
    const isOpen = expanded.has(lane.id);
    const card = ctx.components.card({ variant: 'outlined' });
    card.classList.add('status-lane');
    card.setAttribute('data-appearance-id', 'status:lane');
    card.setAttribute('data-lane-id', lane.id);
    ctx.appearance.applyTo(card, '.status-lane');

    const header = el('div', { className: 'status-lane__head' });

    const selectBox = ctx.components.checkbox({
      label: ctx.t('status.lane.select', 'Select "{title}"', { values: { title: lane.title } }),
      checked: selection.has(lane.id),
      onChange: (checked) => toggleSelection(lane.id, indexInVisible, visible, checked)
    });
    selectBox.root.classList.add('status-lane__select');
    selectBox.root.querySelector('span')?.classList.add('md-visually-hidden');
    selectBox.root.addEventListener(
      'mousedown',
      (event) => {
        shiftHeld = (event as MouseEvent).shiftKey === true;
      },
      true
    );
    header.append(selectBox.root);
    header.append(ctx.components.icon(STATUS_ICON[lane.status], { size: 20 }));

    const titleWrap = el('div', { className: 'status-lane__title' });
    titleWrap.append(el('h3', { className: 'md-typescale-title-medium', text: lane.title }));
    if (lane.origin === 'local') {
      titleWrap.append(ctx.components.badge({ label: ctx.t('status.lane.local', 'This checkout'), severity: 'info' }));
    }
    titleWrap.append(
      el('span', {
        className: `status-lane__status status-lane__status--${lane.status}`,
        text: `${STATUS_EMOJI[lane.status]} ${statusLabel(lane.status)}`
      })
    );
    header.append(titleWrap);

    const expandButton = ctx.components.iconButton({
      icon: isOpen ? 'chevronUp' : 'chevronDown',
      label: isOpen
        ? ctx.t('status.lane.hideDetails', 'Hide details for "{title}"', { values: { title: lane.title } })
        : ctx.t('status.lane.showDetails', 'Show details for "{title}"', { values: { title: lane.title } }),
      onClick: () => {
        if (isOpen) expanded.delete(lane.id);
        else expanded.add(lane.id);
        draw();
      }
    });
    expandButton.setAttribute('aria-expanded', String(isOpen));
    expandButton.setAttribute('aria-controls', `status-lane-detail-${domSafe(lane.id)}`);
    header.append(expandButton);
    card.append(header);

    const metaParts = [lane.repository, lane.branch].filter((part) => part !== '');
    const meta = el('p', { className: 'md-typescale-body-small status-lane__meta' });
    meta.textContent = `${
      metaParts.length > 0 ? metaParts.join(' · ') : ctx.t('status.lane.noRepository', 'No repository recorded')
    } — ${ctx.t('status.lane.updated', 'updated {age}', { values: { age: ageLabel(lane.updatedAt, ctx) } })}`;
    meta.title = formatTimestamp(lane.updatedAt);
    card.append(meta);

    if (lane.id === SELF_LANE_ID) {
      const attemptedAt = state.lastRefreshedAt();
      if (attemptedAt) {
        const attempt = el('p', { className: 'md-typescale-body-small status-lane__attempt', attrs: { role: 'status' } });
        attempt.title = formatTimestamp(attemptedAt);
        attempt.textContent = ctx.t('status.self.lastAttempt', 'Last refresh attempt: {age}', { values: { age: ageLabel(attemptedAt, ctx) } });
        card.append(attempt);
      }
      if (state.isRefreshing()) {
        card.append(
          ctx.components.linearProgress({ label: ctx.t('status.self.refreshing', 'Reading Git…') }).root
        );
      } else if (state.lastRefreshError()) {
        const warning = el('div', { className: 'status-lane__warning' });
        warning.append(
          el('p', {
            className: 'md-typescale-body-small',
            text: ctx.t('status.self.error', 'Git could not be read: {reason}', { values: { reason: state.lastRefreshError() } })
          })
        );
        warning.append(ctx.components.button({ label: 'status.self.retry', variant: 'text', onClick: () => void doRefresh() }));
        card.append(warning);
      }
    }

    card.append(
      el('p', {
        className: `md-typescale-body-medium status-lane__summary${lane.summary.trim() === '' ? ' status-lane__summary--empty' : ''}`,
        text: lane.summary.trim() === '' ? ctx.t('status.lane.noSummary', 'No summary recorded yet.') : lane.summary
      })
    );

    if (isOpen) card.append(renderLaneDetail(lane));

    const actions = el('div', { className: 'status-lane__actions' });
    if (lane.id === SELF_LANE_ID) {
      actions.append(
        ctx.components.button({
          label: 'status.self.refresh',
          variant: 'text',
          icon: 'refresh',
          disabled: state.isRefreshing(),
          disabledReason: state.isRefreshing() ? ctx.t('status.self.alreadyRefreshing', 'Already refreshing.') : undefined,
          onClick: () => void doRefresh()
        })
      );
    }
    actions.append(
      ctx.components.button({
        label: 'status.lane.edit',
        variant: 'text',
        icon: 'edit',
        onClick: (event) => void openEdit(lane, event.currentTarget as HTMLElement)
      })
    );
    if (lane.origin !== 'local') {
      actions.append(
        ctx.components.button({
          label: 'status.lane.delete',
          variant: 'text',
          danger: true,
          icon: 'trash',
          onClick: (event) => void deleteOne(lane, event.currentTarget as HTMLElement)
        })
      );
    }
    card.append(actions);

    if (selection.has(lane.id)) card.classList.add('status-lane--selected');
    return card;
  }

  function drawChips(): void {
    chipsRow.textContent = '';
    const searched = afterSearch();
    const counts = new Map<StatusValue, number>();
    for (const value of STATUS_VALUES) counts.set(value, 0);
    for (const lane of searched) counts.set(lane.status, (counts.get(lane.status) ?? 0) + 1);

    const allChip = ctx.components.chip({
      label: `${ctx.t('status.filter.all', 'All')} · ${searched.length}`,
      selected: statusFilter.size === 0,
      onToggle: () => {
        statusFilter.clear();
        draw();
      }
    });
    chipsRow.append(allChip);

    for (const value of STATUS_VALUES) {
      const chip = ctx.components.chip({
        label: `${STATUS_EMOJI[value]} ${statusLabel(value)} · ${counts.get(value) ?? 0}`,
        selected: statusFilter.has(value),
        onToggle: (selectedNow) => {
          if (selectedNow) statusFilter.add(value);
          else statusFilter.delete(value);
          draw();
        }
      });
      chipsRow.append(chip);
    }
  }

  function draw(): void {
    refreshButton.disabled = state.isRefreshing();
    refreshButton.title = state.isRefreshing() ? ctx.t('status.self.refreshing', 'Reading Git…') : '';

    const failure = state.store.failure();
    storeStatus.textContent = failure
      ? ctx.t('status.store.unreadable', 'The local record could not be read: {reason}', { values: { reason: failure } })
      : ctx.t('status.store.path', 'Stored at {path}.', { values: { path: state.store.filePath() } });
    storeStatus.classList.toggle('status-store-status--bad', failure !== '');

    drawChips();

    const visible = visibleLanes();
    const total = allLanes().length;
    resultsHead.textContent =
      visible.length === total
        ? ctx.t('status.results.count', '{count} status lane(s).', { values: { count: total } })
        : ctx.t('status.results.filtered', '{shown} of {total} status lane(s) match the current filter.', {
            values: { shown: visible.length, total }
          });

    listHost.textContent = '';
    if (visible.length === 0) {
      listHost.append(
        ctx.components.emptyState({
          title: 'status.empty.title',
          body: ctx.t('status.empty.body', 'Nothing matches the current search and filter. Clear them, or add a status lane.')
        })
      );
    } else {
      for (let index = 0; index < visible.length; index += 1) {
        listHost.append(renderLaneRow(visible[index], index, visible));
      }
    }

    const selectedCount = selection.size;
    bulkBar.hidden = selectedCount === 0;
    bulkCount.textContent = ctx.t('status.bulk.count', '{count} selected', { values: { count: selectedCount } });
    const deletable = selectedLanes().filter((lane) => lane.origin !== 'local');
    if (selectedCount === 0) {
      bulkDeleteButton.disabled = true;
      bulkDeleteButton.title = ctx.t('status.bulk.deleteNoSelection', 'Select at least one lane first.');
      bulkExportButton.disabled = true;
      bulkExportButton.title = ctx.t('status.bulk.exportNoSelection', 'Select at least one lane first.');
    } else {
      bulkExportButton.disabled = false;
      bulkExportButton.title = '';
      bulkDeleteButton.disabled = deletable.length === 0;
      bulkDeleteButton.title =
        deletable.length === 0
          ? ctx.t('status.bulk.deleteOnlySelf', "This checkout's own record can't be removed. Select a lane you added yourself.")
          : '';
    }
  }

  /* ================================================================ */
  /* Wiring                                                            */
  /* ================================================================ */

  ctx.onDispose(state.onChange(() => draw()));
  ctx.onDispose(
    ctx.settings.onChange((change) => {
      if (change.id === AUTO_REFRESH_ID || change.id === AUTO_REFRESH_SECONDS_ID) state.startAutoRefresh();
    })
  );

  state.startAutoRefresh();
  ctx.onDispose(() => state.stopAutoRefresh());

  draw();
  void (async () => {
    if (!state.store.isLoaded()) await state.loadFromDisk();
    draw();
    const self = state.store.lanes().find((lane) => lane.id === SELF_LANE_ID);
    if (!self || Date.parse(self.updatedAt) <= 0) void state.refreshSelf();
  })();
}
