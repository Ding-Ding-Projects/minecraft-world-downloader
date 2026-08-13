import { el } from '../../core/a11y';
import type { ExportFormat, TabContext } from '../../core/registry';

import { formatBytes, formatRate } from './bytes';
import { discardStaged, openReleaseNotes, restartAndInstall, showStagedPackage } from './actions';
import {
  failureText,
  formatDuration,
  formatInstant,
  outcomeLabel,
  phaseLabel,
  phaseSeverity,
  triggerLabel
} from './presentation';
import {
  ACTIONS_ROW_ID,
  ENABLED_ID,
  LOG_PAGE_SIZE_ID,
  LOG_TABLE_ID,
  SEARCH_ELEMENT_ID,
  STATUS_CARD_ID
} from './settingIds';
import type { CheckLogEntry } from './types';
import { updater } from './updater';

/**
 * The updates destination.
 *
 * Everything the engine knows is on this one surface: what is installed, what
 * the feed last offered, exactly where a staged package sits, what the last
 * failure actually said, and every check that has ever run with its outcome.
 *
 * The rule the whole panel is built around is that a state nobody can act on is
 * not a state worth rendering. Each failure names its cause and offers the
 * control that addresses it; each disabled button names the condition that is
 * not met; and the transfer reports real bytes rather than a spinner.
 */

const EXPORT_FORMATS: ExportFormat[] = [
  'json',
  'jsonl',
  'yaml',
  'toml',
  'xml',
  'csv',
  'tsv',
  'markdown',
  'html',
  'sql'
];

interface LogRow extends Record<string, unknown> {
  id: string;
  when: string;
  startedBy: string;
  outcome: string;
  version: string;
  took: string;
  detail: string;
}

function toRow(ctx: TabContext, entry: CheckLogEntry): LogRow {
  return {
    id: entry.id,
    when: formatInstant(entry.at, entry.at),
    startedBy: triggerLabel(ctx, entry.trigger),
    outcome: outcomeLabel(ctx, entry.outcome),
    version: entry.version,
    took: formatDuration(entry.durationMs),
    detail: entry.detail
  };
}

/** Everything a row contributes to search, joined so one query covers it all. */
function searchable(row: LogRow): string {
  return [row.when, row.startedBy, row.outcome, row.version, row.took, row.detail].join(' ');
}

export function mountUpdates(host: HTMLElement, ctx: TabContext): void {
  const panel = el('div', { className: 'updates-panel', attrs: { 'data-appearance-id': 'updates:panel' } });
  ctx.appearance.applyTo(panel, '[data-appearance-id="updates:panel"]');

  /* ------------------------------------------------------------ */
  /* Header                                                        */
  /* ------------------------------------------------------------ */

  const headerCheck = ctx.components.button({
    label: ctx.t('updates.action.check', 'Check for updates'),
    variant: 'tonal',
    icon: 'refresh',
    onClick: () => {
      void updater.check('manual');
    }
  });
  panel.append(
    ctx.components.topAppBar({
      title: ctx.t('updates.title', 'Application updates'),
      subtitle: ctx.t(
        'updates.subtitle',
        'Checks the release feed, verifies the package against the digest the feed states, and stages it for an explicit restart.'
      ),
      actions: [headerCheck]
    })
  );

  /* ------------------------------------------------------------ */
  /* The unsigned statement, always visible                        */
  /* ------------------------------------------------------------ */

  const unsigned = el('aside', {
    className: 'updates-unsigned',
    attrs: { 'data-appearance-id': 'updates:unsigned', id: 'updates-unsigned-notice', role: 'note' }
  });
  ctx.appearance.applyTo(unsigned, '[data-appearance-id="updates:unsigned"]');
  unsigned.append(ctx.components.icon('warning', { size: 20 }));
  const unsignedText = el('div');
  unsignedText.append(
    el({ tag: 'h2' }.tag as 'h2', {
      className: 'md-typescale-title-small',
      text: ctx.t('updates.unsigned.heading', 'Unsigned artifact')
    })
  );
  unsignedText.append(
    el('p', {
      className: 'md-typescale-body-small',
      text: ctx.t(
        'updates.unsigned.body',
        'This application is not code-signed. The digest check proves the downloaded bytes are the bytes the release feed named; it proves nothing about who published them.'
      )
    })
  );
  unsigned.append(unsignedText);
  panel.append(unsigned);

  /* ------------------------------------------------------------ */
  /* Status card                                                   */
  /* ------------------------------------------------------------ */

  const statusCard = el('section', {
    className: 'updates-status',
    attrs: {
      id: STATUS_CARD_ID,
      'data-appearance-id': 'updates:status',
      'aria-labelledby': 'updates-status-heading'
    }
  });
  ctx.appearance.applyTo(statusCard, '[data-appearance-id="updates:status"]');
  statusCard.append(
    el('h2', {
      className: 'md-typescale-title-medium',
      text: ctx.t('updates.section.status', 'Current state'),
      attrs: { id: 'updates-status-heading' }
    })
  );

  const stateLine = el('div', { className: 'updates-status__state', attrs: { role: 'status', 'aria-live': 'polite' } });
  statusCard.append(stateLine);

  const failureLine = el('p', {
    className: 'updates-status__failure md-typescale-body-medium',
    attrs: { role: 'alert' }
  });
  statusCard.append(failureLine);

  const progressWrap = el('div', { className: 'updates-status__progress' });
  const progress = ctx.components.linearProgress({
    label: ctx.t('updates.field.progress', 'Transferred'),
    value: 0
  });
  const progressText = el('p', { className: 'md-typescale-body-small' });
  progressWrap.append(progress.root, progressText);
  statusCard.append(progressWrap);

  const facts = el('dl', { className: 'updates-facts' });
  statusCard.append(facts);
  panel.append(statusCard);

  /* ------------------------------------------------------------ */
  /* Actions                                                       */
  /* ------------------------------------------------------------ */

  const actionsRow = el('div', {
    className: 'updates-actions',
    attrs: { id: ACTIONS_ROW_ID, 'data-appearance-id': 'updates:actions', role: 'group', 'aria-label': ctx.t('updates.section.actions', 'Actions') }
  });
  ctx.appearance.applyTo(actionsRow, '[data-appearance-id="updates:actions"]');
  panel.append(actionsRow);

  /* ------------------------------------------------------------ */
  /* Check log                                                     */
  /* ------------------------------------------------------------ */

  const logSection = el('section', {
    className: 'updates-log',
    attrs: { 'data-appearance-id': 'updates:log', 'aria-labelledby': 'updates-log-heading' }
  });
  ctx.appearance.applyTo(logSection, '[data-appearance-id="updates:log"]');
  logSection.append(
    ctx.components.sectionHeading({
      title: ctx.t('updates.section.log', 'Check log'),
      description: ctx.t(
        'updates.log.empty.body',
        'Every check writes one row here, whether it found an update or not.'
      )
    })
  );
  logSection.querySelector('h2, h3')?.setAttribute('id', 'updates-log-heading');

  let allRows: LogRow[] = [];
  let matching: LogRow[] = [];
  let page = 0;

  const pageSize = (): number => {
    const raw = ctx.settings.get<number>(LOG_PAGE_SIZE_ID, 25);
    const parsed = typeof raw === 'number' ? raw : Number.parseInt(String(raw), 10);
    return Number.isFinite(parsed) ? Math.min(200, Math.max(5, Math.round(parsed))) : 25;
  };

  const search = ctx.createSearchBar({
    label: 'updates.log.search',
    sample: '',
    onChange: () => {
      page = 0;
      redrawLog();
    }
  });
  search.root.id = SEARCH_ELEMENT_ID;
  search.root.dataset.appearanceId = 'updates:log-search';
  logSection.append(search.root);

  const selectionBar = el('div', {
    className: 'updates-selection',
    attrs: { role: 'group', 'aria-label': ctx.t('updates.section.log', 'Check log') }
  });
  const selectionCount = el('p', { className: 'md-typescale-label-large', attrs: { role: 'status', 'aria-live': 'polite' } });

  const selectPage = ctx.components.button({
    label: ctx.t('updates.log.selectShown', 'Select the rows on this page'),
    variant: 'outlined',
    onClick: () => {
      const ids = new Set(table.selection());
      for (const row of currentPageRows()) ids.add(row.id);
      table.setSelection([...ids]);
      updateSelectionUi();
    }
  });
  const selectMatching = ctx.components.button({
    label: ctx.t('updates.log.selectMatching', 'Select all rows matching the search'),
    variant: 'outlined',
    onClick: () => {
      table.setSelection(matching.map((row) => row.id));
      updateSelectionUi();
    }
  });
  const invert = ctx.components.button({
    label: ctx.t('updates.log.invert', 'Invert the selection'),
    variant: 'outlined',
    onClick: () => {
      const chosen = new Set(table.selection());
      table.setSelection(matching.filter((row) => !chosen.has(row.id)).map((row) => row.id));
      updateSelectionUi();
    }
  });
  const clearSelection = ctx.components.button({
    label: ctx.t('updates.log.clearSelection', 'Clear the selection'),
    variant: 'text',
    onClick: () => {
      table.clearSelection();
      updateSelectionUi();
    }
  });

  const formatSelect = ctx.components.select({
    label: ctx.t('updates.log.exportFormat', 'Export format'),
    options: EXPORT_FORMATS.map((format) => ({ value: format, label: format.toUpperCase() })),
    value: 'json'
  });

  const exportButton = ctx.components.button({
    label: ctx.t('updates.action.export', 'Export the check log'),
    variant: 'tonal',
    icon: 'download',
    onClick: () => {
      void exportRows();
    }
  });

  const deleteButton = ctx.components.button({
    label: ctx.t('updates.action.deleteSelected', 'Delete the selected rows'),
    variant: 'text',
    danger: true,
    icon: 'trash',
    onClick: (event) => {
      void deleteSelected(event.currentTarget as HTMLElement);
    }
  });

  selectionBar.append(
    selectionCount,
    selectPage,
    selectMatching,
    invert,
    clearSelection,
    formatSelect.root,
    exportButton,
    deleteButton
  );
  logSection.append(selectionBar);

  const table = ctx.components.dataTable<LogRow>({
    label: ctx.t('updates.section.log', 'Check log'),
    columns: [
      { id: 'when', label: ctx.t('updates.log.column.at', 'When'), sortable: true, value: (row) => row.when },
      { id: 'startedBy', label: ctx.t('updates.log.column.trigger', 'Started by'), sortable: true, value: (row) => row.startedBy },
      { id: 'outcome', label: ctx.t('updates.log.column.outcome', 'Outcome'), sortable: true, value: (row) => row.outcome },
      { id: 'version', label: ctx.t('updates.log.column.version', 'Version'), sortable: true, value: (row) => row.version },
      { id: 'took', label: ctx.t('updates.log.column.duration', 'Took'), align: 'end', value: (row) => row.took },
      { id: 'detail', label: ctx.t('updates.log.column.detail', 'Detail'), value: (row) => row.detail }
    ],
    rows: [],
    rowId: (row) => row.id,
    selectable: true,
    emptyMessage: ctx.t('updates.log.noMatches', 'No log rows match the current search.'),
    onSelectionChange: () => updateSelectionUi()
  });
  table.root.id = LOG_TABLE_ID;
  table.root.dataset.appearanceId = 'updates:log-table';
  logSection.append(table.root);

  const emptyState = ctx.components.emptyState({
    title: ctx.t('updates.log.empty.title', 'No checks have been recorded yet'),
    body: ctx.t(
      'updates.log.empty.body',
      'Every check writes one row here, whether it found an update or not. Run a check to start the log.'
    ),
    action: {
      label: ctx.t('updates.action.check', 'Check for updates'),
      variant: 'filled',
      icon: 'refresh',
      onClick: () => {
        void updater.check('manual');
      }
    }
  });
  logSection.append(emptyState);

  const pager = el('div', { className: 'updates-pager' });
  const pagerStatus = el('p', { className: 'md-typescale-body-small', attrs: { role: 'status', 'aria-live': 'polite' } });
  const previousPage = ctx.components.button({
    label: ctx.t('updates.log.previousPage', 'Previous page'),
    variant: 'text',
    icon: 'chevronLeft',
    onClick: () => {
      page = Math.max(0, page - 1);
      redrawLog();
    }
  });
  const nextPage = ctx.components.button({
    label: ctx.t('updates.log.nextPage', 'Next page'),
    variant: 'text',
    trailingIcon: 'chevronRight',
    onClick: () => {
      page += 1;
      redrawLog();
    }
  });
  pager.append(previousPage, pagerStatus, nextPage);
  logSection.append(pager);

  panel.append(logSection);
  host.append(panel);

  /* ------------------------------------------------------------ */
  /* Behaviour                                                     */
  /* ------------------------------------------------------------ */

  function currentPageRows(): LogRow[] {
    const size = pageSize();
    return matching.slice(page * size, page * size + size);
  }

  function updateSelectionUi(): void {
    const selected = table.selection().length;
    selectionCount.textContent = ctx.t('updates.log.selection', '{selected} of {total} rows selected', {
      values: { selected, total: matching.length }
    });
    const shown = currentPageRows().length;
    selectPage.textContent = ctx.t('updates.log.selectShown', 'Select the {count} rows on this page', {
      values: { count: shown }
    });
    selectMatching.textContent = ctx.t('updates.log.selectMatching', 'Select all {count} rows matching the search', {
      values: { count: matching.length }
    });
    const nothing = ctx.t('updates.disabled.nothingSelected', 'No rows are selected.');
    const empty = ctx.t('updates.disabled.emptyLog', 'The check log has no entries yet.');
    setDisabled(deleteButton, selected === 0, nothing);
    setDisabled(exportButton, matching.length === 0, empty);
    setDisabled(selectPage, shown === 0, empty);
    setDisabled(selectMatching, matching.length === 0, empty);
    setDisabled(invert, matching.length === 0, empty);
    setDisabled(clearSelection, selected === 0, nothing);
  }

  function setDisabled(button: HTMLButtonElement, disabled: boolean, reason: string): void {
    button.disabled = disabled;
    if (disabled) {
      button.setAttribute('aria-disabled', 'true');
      button.title = reason;
    } else {
      button.removeAttribute('aria-disabled');
      button.removeAttribute('title');
    }
  }

  function redrawLog(): void {
    allRows = updater.log().map((entry) => toRow(ctx, entry));
    const query = search.query();
    matching = allRows.filter((row) => query.matches(searchable(row)));

    const size = pageSize();
    const pages = Math.max(1, Math.ceil(matching.length / size));
    page = Math.min(page, pages - 1);

    table.setRows(currentPageRows());
    emptyState.hidden = allRows.length > 0;
    table.root.hidden = allRows.length === 0;
    selectionBar.hidden = allRows.length === 0;
    pager.hidden = allRows.length === 0;

    pagerStatus.textContent = ctx.t(
      'updates.log.page',
      'Page {page} of {pages}, showing {shown} of {total} rows',
      {
        values: { page: page + 1, pages, shown: currentPageRows().length, total: matching.length }
      }
    );
    setDisabled(previousPage, page === 0, ctx.t('updates.log.previousPage', 'Previous page'));
    setDisabled(nextPage, page >= pages - 1, ctx.t('updates.log.nextPage', 'Next page'));
    updateSelectionUi();
  }

  async function exportRows(): Promise<void> {
    const selected = new Set(table.selection());
    const chosen = selected.size > 0 ? matching.filter((row) => selected.has(row.id)) : matching;
    if (chosen.length === 0) return;
    const format = formatSelect.get() as ExportFormat;
    const records = chosen.map((row) => ({ ...row }));

    const preflight = ctx.exporter.preflight(records, format);
    if (preflight.losses.length > 0) {
      const proceed = await ctx.components.dialog({
        title: ctx.t('updates.log.exportLosses', 'The {format} format cannot carry {fields} faithfully.', {
          values: {
            format: format.toUpperCase(),
            fields: preflight.losses.map((loss) => loss.field).join(', ')
          },
          dialog: true
        }),
        body: preflight.losses.map((loss) => `${loss.field}: ${loss.reason}`).join('\n'),
        icon: 'warning'
      });
      if (!proceed) return;
    }

    const path = await ctx.exporter.save(records, format, {
      name: 'update-check-log',
      defaultFileName: `update-check-log.${format}`
    });
    if (path) {
      ctx.notify.success(ctx.t('updates.notify.exported.title', 'The check log was exported'), path);
      await ctx.history.record('Exported the update check log', 'updates', {
        format,
        rows: records.length,
        path
      });
    }
  }

  async function deleteSelected(anchor: HTMLElement): Promise<void> {
    const chosen = table.selection();
    if (chosen.length === 0) return;
    const lookup = new Map(allRows.map((row) => [row.id, row]));
    const approved = await ctx.confirm.request({
      action: ctx.t('updates.confirm.deleteLog.action', 'Delete {count} check log entries', {
        values: { count: chosen.length }
      }),
      affected: chosen.map((id) => {
        const row = lookup.get(id);
        return row ? `${row.when} — ${row.outcome} — ${row.version}` : id;
      }),
      irreversible: ctx.t(
        'updates.confirm.deleteLog.irreversible',
        'The rows are removed from the stored log. The removal is recorded in local history, but the rows themselves are not recoverable from it.'
      ),
      anchor
    });
    if (!approved) {
      anchor.focus();
      return;
    }
    const removed = await updater.removeLogEntries(chosen);
    table.clearSelection();
    redrawLog();
    ctx.notify.success(
      ctx.t('updates.notify.logCleared.title', '{count} log entries were removed', { values: { count: removed } })
    );
    anchor.focus();
  }

  /* ------------------------------------------------------------ */
  /* Status rendering                                              */
  /* ------------------------------------------------------------ */

  function fact(labelKey: string, fallback: string, value: string): void {
    facts.append(el('dt', { className: 'md-typescale-label-small', text: ctx.t(labelKey, fallback) }));
    facts.append(el('dd', { className: 'md-typescale-body-small', text: value }));
  }

  let transferStartedAt = 0;
  let lastPhase = '';

  function renderStatus(): void {
    const state = updater.state();
    const severity = phaseSeverity(state.phase);

    if (state.phase === 'downloading' && lastPhase !== 'downloading') transferStartedAt = Date.now();
    lastPhase = state.phase;

    stateLine.textContent = '';
    stateLine.append(ctx.components.badge({ label: phaseLabel(ctx, state.phase), severity }));
    stateLine.dataset.phase = state.phase;

    const failure = failureText(ctx, state);
    failureLine.textContent = failure;
    failureLine.hidden = failure === '';

    const transferring = state.phase === 'downloading';
    progressWrap.hidden = !transferring;
    if (transferring) {
      if (state.rangeSupported === false || state.total <= 0) {
        progress.root.dataset.indeterminate = 'true';
        progressText.textContent = ctx.t(
          'updates.value.rangeNo',
          'The server sent the whole package in one response, so there was no intermediate progress to report'
        );
      } else {
        delete progress.root.dataset.indeterminate;
        progress.set(Math.min(1, state.transferred / state.total));
        progressText.textContent = `${formatBytes(state.transferred)} / ${formatBytes(state.total)} · ${formatRate(
          state.transferred,
          Date.now() - transferStartedAt
        )}`;
      }
    }

    facts.textContent = '';
    fact('updates.field.currentVersion', 'Installed version', state.currentVersion);
    fact(
      'updates.field.candidateVersion',
      'Offered version',
      state.candidate ? state.candidate.version : ctx.t('updates.value.none', 'None')
    );
    fact(
      'updates.field.lastChecked',
      'Last checked',
      formatInstant(state.lastCheckedAt, ctx.t('updates.value.never', 'Never'))
    );
    fact(
      'updates.field.nextCheck',
      'Next scheduled check',
      formatInstant(state.nextCheckAt, ctx.t('updates.value.notScheduled', 'Not scheduled'))
    );
    fact('updates.field.feed', 'Release feed', updater.feedUrl() || ctx.t('updates.value.none', 'None'));
    fact(
      'updates.field.installBridge',
      'Installer handover',
      state.installAvailable
        ? ctx.t('updates.value.installReady', 'Available in this build')
        : ctx.t('updates.value.installMissing', 'Not available in this build')
    );
    if (state.candidate) {
      fact('updates.field.packageFile', 'Package file', state.candidate.fileName);
      fact('updates.field.size', 'Package size', `${formatBytes(state.candidate.size)} (${state.candidate.size} bytes)`);
      fact('updates.field.digest', 'SHA-1 digest stated by the feed', state.candidate.sha1);
    }
    if (state.staged) {
      fact('updates.field.stagedAt', 'Staged at', formatInstant(state.staged.stagedAt, state.staged.stagedAt));
      fact('updates.field.stagedPath', 'Staged payload path', state.staged.packagePath);
      fact('updates.field.digest', 'SHA-1 digest stated by the feed', state.staged.sha1);
    }

    renderActions(state.phase, state.candidate !== null, state.staged !== null, state.cancellable, state.installAvailable);
  }

  function renderActions(
    phase: string,
    hasCandidate: boolean,
    hasStaged: boolean,
    cancellable: boolean,
    installAvailable: boolean
  ): void {
    actionsRow.textContent = '';
    const busy = phase === 'checking' || phase === 'downloading' || phase === 'verifying' || phase === 'staging' || phase === 'installing';

    actionsRow.append(
      ctx.components.button({
        label: ctx.t('updates.action.check', 'Check for updates'),
        variant: 'filled',
        icon: 'refresh',
        disabled: busy,
        disabledReason: busy
          ? ctx.t('updates.disabled.busy', 'A check or transfer is already running. Wait for it, or cancel it.')
          : undefined,
        onClick: () => {
          void updater.check('manual');
        }
      })
    );

    actionsRow.append(
      ctx.components.button({
        label: ctx.t('updates.action.download', 'Download and verify'),
        variant: 'tonal',
        icon: 'download',
        disabled: !hasCandidate || busy,
        disabledReason: busy
          ? ctx.t('updates.disabled.busy', 'A check or transfer is already running.')
          : !hasCandidate
            ? ctx.t('updates.disabled.noCandidate', 'Nothing has been offered by the feed yet. Check for updates first.')
            : undefined,
        onClick: () => {
          void updater.download('manual');
        }
      })
    );

    actionsRow.append(
      ctx.components.button({
        label: ctx.t('updates.action.cancel', 'Cancel the transfer'),
        variant: 'outlined',
        icon: 'stop',
        disabled: !cancellable,
        disabledReason: cancellable ? undefined : ctx.t('updates.disabled.noTransfer', 'No transfer is running.'),
        onClick: () => {
          updater.cancel();
        }
      })
    );

    actionsRow.append(
      ctx.components.button({
        label: ctx.t('updates.action.restart', 'Restart to install update'),
        variant: 'filled',
        icon: 'play',
        disabled: !hasStaged || !installAvailable || busy,
        disabledReason: !hasStaged
          ? ctx.t('updates.disabled.notStaged', 'No verified package is staged yet, so there is nothing to install.')
          : !installAvailable
            ? ctx.t(
                'updates.disabled.noInstallBridge',
                'This build has no privileged installer handover, so the application cannot install the staged package itself.'
              )
            : busy
              ? ctx.t('updates.disabled.busy', 'A check or transfer is already running.')
              : undefined,
        onClick: (event) => {
          void restartAndInstall(ctx, event.currentTarget as HTMLElement);
        }
      })
    );

    actionsRow.append(
      ctx.components.button({
        label: ctx.t('updates.action.showStaged', 'Show the staged package'),
        variant: 'text',
        icon: 'folder',
        disabled: !hasStaged,
        disabledReason: hasStaged
          ? undefined
          : ctx.t('updates.disabled.notStaged', 'No verified package is staged yet.'),
        onClick: () => {
          void showStagedPackage(ctx);
        }
      })
    );

    actionsRow.append(
      ctx.components.button({
        label: ctx.t('updates.action.discard', 'Discard the staged update'),
        variant: 'text',
        danger: true,
        icon: 'trash',
        disabled: !hasStaged || busy,
        disabledReason: !hasStaged
          ? ctx.t('updates.disabled.notStaged', 'No verified package is staged yet.')
          : busy
            ? ctx.t('updates.disabled.busy', 'A check or transfer is already running.')
            : undefined,
        onClick: (event) => {
          void discardStaged(ctx, event.currentTarget as HTMLElement);
        }
      })
    );

    actionsRow.append(
      ctx.components.button({
        label: ctx.t('updates.action.releaseNotes', 'Open the release notes'),
        variant: 'text',
        icon: 'book',
        disabled: updater.releaseNotesUrl() === '',
        disabledReason:
          updater.releaseNotesUrl() === ''
            ? ctx.t('updates.disabled.noNotes', 'No release notes address is configured.')
            : undefined,
        onClick: () => {
          void openReleaseNotes(ctx);
        }
      })
    );

    actionsRow.append(
      ctx.components.button({
        label: ctx.t('updates.action.openSettings', 'Open the update settings'),
        variant: 'text',
        icon: 'settings',
        onClick: () => {
          ctx.tabs.teleport('core.settings', ENABLED_ID);
        }
      })
    );
  }

  renderStatus();
  redrawLog();

  const stopWatching = updater.onChange(() => {
    renderStatus();
    redrawLog();
  });
  const stopLanguage = ctx.i18n.onChange(() => {
    renderStatus();
    redrawLog();
  });
  // The scheduled-check countdown and the transfer rate both move without a
  // state change, so the card refreshes on a slow tick as well.
  const tick = window.setInterval(() => {
    if (updater.state().phase === 'downloading') renderStatus();
  }, 1000);

  ctx.onDispose(() => {
    stopWatching();
    stopLanguage();
    window.clearInterval(tick);
    search.destroy();
  });
}
