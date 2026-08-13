import type { AppContext, TabContext } from '../../core/registry';
import type { E2eStage, HarnessProbe, LaunchOptions, RunRecord } from './state';
import { DEFAULT_LAUNCH, FeatureState } from './state';

/**
 * The end-to-end test tab: a launch form, a live progress view for whatever
 * is running right now, and the run history list (with the full bulk-action
 * contract) below it.
 */

/** A short, curated list of versions this project's own README documents as
 * verified end to end, plus the current newest. Free text is still accepted —
 * this is a starting point, not an allow-list. */
const SUGGESTED_VERSIONS = ['1.12.2', '1.16.5', '1.18.2', '1.20.4', '1.20.6', '1.21', '1.21.8', '1.21.11'];

export function mountDownloaderE2ePanel(host: HTMLElement, tabCtx: TabContext, state: FeatureState): () => void {
  const { components: c, t } = tabCtx;
  host.classList.add('downloader-e2e-panel');
  host.append(c.topAppBar({ title: t('downloader-e2e.tab.title', 'End-to-end test'), subtitle: t('downloader-e2e.tab.subtitle', 'Real server, bots through the proxy, world verified on disk.') }));

  /* ---- launch card ---- */

  const launchCard = c.card({ variant: 'outlined' });
  launchCard.id = 'downloader-e2e-launch-card';
  launchCard.append(c.sectionHeading({ title: t('downloader-e2e.launch.title', 'Launch a run') }));

  let launch: LaunchOptions = { ...DEFAULT_LAUNCH };

  const versionField = c.textField({
    label: t('downloader-e2e.launch.version', 'Minecraft / Paper version'),
    value: launch.version,
    supportingText: SUGGESTED_VERSIONS.join(', '),
    onChange: (value) => {
      launch = { ...launch, version: value.trim() || DEFAULT_LAUNCH.version };
      refreshDisabled();
    }
  });

  const modeField = c.select({
    label: t('downloader-e2e.launch.mode', 'Server route'),
    value: launch.mode,
    options: [
      { value: 'auto', label: t('downloader-e2e.launch.mode.auto', 'Auto (Docker, then a downloaded jar)') },
      { value: 'docker', label: t('downloader-e2e.launch.mode.docker', 'Docker only') },
      { value: 'jar', label: t('downloader-e2e.launch.mode.jar', 'Downloaded server jar only') }
    ],
    onChange: (value) => {
      launch = { ...launch, mode: value as LaunchOptions['mode'] };
    }
  });

  const radiusField = c.slider({
    label: t('downloader-e2e.launch.radius', 'Route radius (blocks)'),
    min: 16,
    max: 512,
    step: 16,
    value: launch.radius,
    unit: t('downloader-e2e.unit.blocks', 'blocks'),
    onChange: (value) => {
      launch = { ...launch, radius: value };
    }
  });

  const botsField = c.slider({
    label: t('downloader-e2e.launch.bots', 'Bot count'),
    min: 1,
    max: 4,
    step: 1,
    value: launch.bots,
    onChange: (value) => {
      launch = { ...launch, bots: value };
    }
  });

  // The slider reads and displays a whole percentage (10-100); launch.coverageThreshold
  // itself stays a 0..1 fraction, which is what the harness's --coverage-threshold expects.
  const coverageField = c.slider({
    label: t('downloader-e2e.launch.coverageThreshold', 'Pass threshold'),
    min: 10,
    max: 100,
    step: 5,
    value: Math.round(launch.coverageThreshold * 100),
    unit: '%',
    onChange: (value) => {
      launch = { ...launch, coverageThreshold: value / 100 };
    }
  });

  const startButton = c.button({
    label: t('downloader-e2e.launch.start', 'Start run'),
    variant: 'filled',
    icon: 'play',
    onClick: async (event) => {
      startButton.disabled = true;
      try {
        const outcome = await state.start(launch);
        if (!outcome.started) {
          tabCtx.notify.error(t('downloader-e2e.launch.start', 'Start run'), outcome.reason);
          return;
        }
        tabCtx.notify.success(t('downloader-e2e.notify.started', 'End-to-end run started'), '');
      } finally {
        refreshDisabled();
      }
      void event;
    }
  });

  const cancelButton = c.button({
    label: t('downloader-e2e.launch.cancel', 'Cancel'),
    variant: 'text',
    icon: 'stop',
    onClick: async (event) => {
      const approved = await tabCtx.confirm.request({
        action: t('downloader-e2e.palette.cancel', 'Cancel the running end-to-end test'),
        affected: [t('downloader-e2e.tab.title', 'End-to-end test')],
        irreversible: t(
          'downloader-e2e.confirm.cancel.irreversible',
          'The server, proxy and any bots this run started are stopped immediately. Whatever was saved before the cancel stays on disk in the run\'s work directory; nothing further is verified.'
        ),
        anchor: event.currentTarget as HTMLElement
      });
      if (!approved) return;
      await state.cancel();
      tabCtx.notify.info(t('downloader-e2e.notify.cancelled', 'Run cancelled'), '');
    }
  });

  launchCard.append(versionField.root, modeField.root, radiusField.root, botsField.root, coverageField.root, startButton, cancelButton);

  /* ---- status card ---- */

  const statusCard = c.card({ variant: 'outlined' });
  statusCard.id = 'downloader-e2e-status-card';
  statusCard.append(c.sectionHeading({ title: t('downloader-e2e.status.title', 'Current run') }));
  const statusBody = document.createElement('div');
  statusBody.className = 'downloader-e2e-status-body';
  statusBody.setAttribute('role', 'status');
  statusCard.append(statusBody);

  const progress = c.linearProgress({ label: t('downloader-e2e.status.title', 'Current run'), value: undefined });
  statusCard.append(progress.root);

  const logHeading = c.sectionHeading({ title: t('downloader-e2e.status.log.title', 'Progress log') });
  statusCard.append(logHeading);
  const logList = document.createElement('div');
  logList.className = 'downloader-e2e-log';
  let logFiltered: string[] = [];
  const renderLog = (): void => {
    logList.replaceChildren();
    for (const line of logFiltered.slice(-300)) {
      const row = document.createElement('div');
      row.className = 'downloader-e2e-log-row';
      row.textContent = line;
      logList.append(row);
    }
  };
  const logSearch = tabCtx.createSearchBar({
    label: t('downloader-e2e.status.log.title', 'Progress log'),
    sample: '',
    onChange: (query) => {
      const source = state.session.record?.progressLines ?? [];
      logFiltered = source.filter((line) => query.matches(line));
      renderLog();
    }
  });
  statusCard.append(logSearch.root, logList);

  /* ---- history card ---- */

  const historyCard = c.card({ variant: 'outlined' });
  historyCard.id = 'downloader-e2e-history-card';
  historyCard.append(c.sectionHeading({ title: t('downloader-e2e.history.title', 'Run history') }));

  const historyEmpty = c.emptyState({ title: t('downloader-e2e.history.empty', 'No run has finished yet. There is no sample data — an empty list really means empty.') });
  const tableHost = document.createElement('div');
  tableHost.className = 'downloader-e2e-history-table-host';

  const bulkBar = document.createElement('div');
  bulkBar.className = 'downloader-e2e-bulk-bar';
  const selectAllButton = c.button({ label: t('downloader-e2e.history.selectAll', 'Select all shown'), variant: 'text' });
  const clearSelectionButton = c.button({ label: t('downloader-e2e.history.clearSelection', 'Clear selection'), variant: 'text' });
  const deleteButton = c.button({
    label: t('downloader-e2e.history.delete', 'Delete'),
    variant: 'text',
    danger: true,
    disabled: true,
    disabledReason: t('downloader-e2e.history.delete.needsSelection', 'Select at least one run first.')
  });
  const exportButton = c.button({ label: t('downloader-e2e.history.export', 'Export'), variant: 'text', icon: 'download' });
  bulkBar.append(selectAllButton, clearSelectionButton, deleteButton, exportButton);

  let filteredRuns: RunRecord[] = [];
  let table: ReturnType<typeof buildTable> | null = null;

  function stageLabel(stage: E2eStage | null): string {
    if (!stage) return '—';
    return t(`downloader-e2e.stage.${stage}`, stage);
  }

  function causeLabel(cause: RunRecord['cause']): string {
    if (!cause) return '';
    return t(`downloader-e2e.cause.${cause}`, cause);
  }

  function buildTable() {
    return c.dataTable<RunRecord>({
      label: t('downloader-e2e.history.title', 'Run history'),
      selectable: true,
      rowId: (row) => row.id,
      emptyMessage: t('core.search.noMatches', 'No results match this search.'),
      columns: [
        { id: 'startedAt', label: t('downloader-e2e.history.column.startedAt', 'Started'), sortable: true, value: (row) => row.startedAt },
        { id: 'version', label: t('downloader-e2e.history.column.version', 'Version'), sortable: true, value: (row) => row.launch.version },
        {
          id: 'result',
          label: t('downloader-e2e.history.column.result', 'Result'),
          sortable: true,
          value: (row) => (row.ok === null ? 0 : row.ok ? 1 : -1),
          render: (row) => {
            if (row.ok === null) return t('downloader-e2e.stage.running', 'Running…');
            return row.ok ? t('downloader-e2e.history.result.pass', 'Pass') : `${t('downloader-e2e.history.result.fail', 'Fail')} — ${causeLabel(row.cause)}`;
          }
        },
        { id: 'stage', label: t('downloader-e2e.history.column.stage', 'Reached'), render: (row) => stageLabel(row.reachedStage) },
        {
          id: 'coverage',
          label: t('downloader-e2e.history.column.coverage', 'Coverage'),
          align: 'end',
          sortable: true,
          value: (row) => row.coverageRatio ?? -1,
          render: (row) =>
            row.coverageRatio === null
              ? '—'
              : `${row.matchedCount ?? 0}/${row.expectedCount ?? 0} (${(row.coverageRatio * 100).toFixed(0)}%)`
        }
      ],
      rows: filteredRuns,
      onSelectionChange: (ids) => {
        deleteButton.disabled = ids.length === 0;
        deleteButton.title = ids.length === 0 ? t('downloader-e2e.history.delete.needsSelection', 'Select at least one run first.') : '';
      },
      onActivate: (row) => {
        if (row.reportPath) void tabCtx.studio.shell.openPath(row.reportPath);
      }
    });
  }

  const historySearch = tabCtx.createSearchBar({
    label: t('downloader-e2e.history.search', 'Search runs'),
    sample: state.runs.map((run) => `${run.launch.version} ${run.reachedStage ?? ''} ${run.cause ?? ''}`).join('\n'),
    onChange: (query) => {
      filteredRuns = state.runs.filter((run) => query.matches(`${run.launch.version} ${run.launch.mode} ${stageLabel(run.reachedStage)} ${causeLabel(run.cause)}`));
      renderHistory();
    }
  });

  selectAllButton.addEventListener('click', () => table?.setSelection(filteredRuns.map((run) => run.id)));
  clearSelectionButton.addEventListener('click', () => table?.clearSelection());

  deleteButton.addEventListener('click', async (event) => {
    const ids = table?.selection() ?? [];
    if (ids.length === 0) return;
    const approved = await tabCtx.confirm.request({
      action: t('downloader-e2e.history.delete.confirm', 'Delete {count} run record(s)', { values: { count: ids.length } }),
      affected: state.runs.filter((run) => ids.includes(run.id)).map((run) => `${run.launch.version} — ${run.startedAt}`),
      irreversible: t(
        'downloader-e2e.history.delete.irreversible',
        'The run record is removed from this list. The work directory it points to on disk is not touched.'
      ),
      anchor: event.currentTarget as HTMLElement
    });
    if (!approved) return;
    state.deleteRuns(ids);
    tabCtx.notify.success(t('downloader-e2e.history.delete', 'Delete'), '');
  });

  exportButton.addEventListener('click', async () => {
    const rows = filteredRuns.map((run) => ({
      id: run.id,
      startedAt: run.startedAt,
      endedAt: run.endedAt ?? '',
      version: run.launch.version,
      mode: run.launch.mode,
      radius: run.launch.radius,
      bots: run.launch.bots,
      ok: run.ok,
      reachedStage: run.reachedStage ?? '',
      cause: run.cause ?? '',
      message: run.message ?? '',
      matchedCount: run.matchedCount ?? '',
      expectedCount: run.expectedCount ?? '',
      coverageRatio: run.coverageRatio ?? '',
      workDir: run.workDir ?? ''
    }));
    const path = await tabCtx.exporter.save(rows, 'json', { name: 'downloader-e2e-runs', defaultFileName: 'downloader-e2e-runs.json' });
    if (path) tabCtx.notify.success(tabCtx.t('core.export.saved', 'Exported'), path);
  });

  function renderHistory(): void {
    const hasAny = state.runs.length > 0;
    historyEmpty.hidden = hasAny;
    tableHost.hidden = !hasAny;
    bulkBar.hidden = !hasAny;
    if (!hasAny) return;
    tableHost.replaceChildren();
    table = buildTable();
    tableHost.append(table.root);
  }

  historyCard.append(historySearch.root, bulkBar, historyEmpty, tableHost);

  /* ---- rendering the live status ---- */

  function refreshDisabled(): void {
    const running = state.session.isRunning();
    startButton.disabled = running || state.session.isBusy() || !state.probe.harnessFound || launch.version.trim() === '';
    startButton.title = running
      ? t('downloader-e2e.launch.disabled.busy', 'A run is already in progress in this window.')
      : !state.probe.harnessFound
        ? t('downloader-e2e.launch.disabled.noHarness', 'The harness script has not been located yet. Set it in settings.')
        : '';
    cancelButton.disabled = !running;
  }

  function renderStatus(): void {
    const record = state.session.record;
    statusBody.replaceChildren();
    if (!record) {
      statusBody.textContent = t('downloader-e2e.status.idle', 'No run has been started yet.');
      progress.set(0);
      logFiltered = [];
      renderLog();
      return;
    }
    const stageText = t('downloader-e2e.status.stage', 'Stage: {stage}', { values: { stage: stageLabel(record.reachedStage) } });
    const line1 = document.createElement('div');
    line1.textContent = stageText;
    statusBody.append(line1);
    if (record.ok !== null) {
      const line2 = document.createElement('div');
      line2.textContent = record.ok
        ? t('downloader-e2e.history.result.pass', 'Pass')
        : `${t('downloader-e2e.history.result.fail', 'Fail')} — ${causeLabel(record.cause)}: ${record.message ?? ''}`;
      statusBody.append(line2);
    }
    const stageIndex = record.reachedStage ? ['preflight', 'server-starting', 'server-ready', 'proxy-starting', 'proxy-listening', 'bot-connecting', 'bot-connected', 'bot-walking', 'bot-drained', 'verifying', 'done'].indexOf(record.reachedStage) : 0;
    // ControlHandle<number>.set for linearProgress takes a 0..1 fraction, not
    // a 0..100 percentage — it multiplies by 100 itself.
    progress.set(record.ok !== null ? 1 : Math.max(0.04, stageIndex / 10));

    logFiltered = record.progressLines;
    renderLog();
  }

  /* ---- wiring ---- */

  const unsubscribe = state.onChange(() => {
    renderStatus();
    renderHistory();
    refreshDisabled();
  });
  tabCtx.onDispose(() => {
    unsubscribe();
    logSearch.destroy();
    historySearch.destroy();
  });

  void state.refreshProbe().then(() => refreshDisabled());
  refreshDisabled();
  renderStatus();
  renderHistory();

  host.append(launchCard, statusCard, historyCard);

  return () => {
    /* cleanup registered via onDispose above */
  };
}

export function harnessProbeSummary(probe: HarnessProbe, t: AppContext['t']): string {
  const parts: string[] = [];
  parts.push(
    probe.harnessFound
      ? t('downloader-e2e.settings.checkHarness.found', 'Found: {what}', { values: { what: `harness script (${probe.harnessPath})` } })
      : t('downloader-e2e.settings.checkHarness.missing', 'Missing: {what}', { values: { what: `harness script (${probe.harnessPath || 'not set'})` } })
  );
  parts.push(
    probe.jarFound
      ? t('downloader-e2e.settings.checkHarness.found', 'Found: {what}', { values: { what: `world-downloader.jar (${probe.jarPath})` } })
      : t('downloader-e2e.settings.checkHarness.missing', 'Missing: {what}', { values: { what: `world-downloader.jar (${probe.jarPath || 'not set'})` } })
  );
  parts.push(
    probe.scraperFound
      ? t('downloader-e2e.settings.checkHarness.found', 'Found: {what}', { values: { what: `scraper/ (${probe.scraperDir})` } })
      : t('downloader-e2e.settings.checkHarness.missing', 'Missing: {what}', { values: { what: `scraper/ (${probe.scraperDir || 'not set'})` } })
  );
  return parts.join(' · ');
}
