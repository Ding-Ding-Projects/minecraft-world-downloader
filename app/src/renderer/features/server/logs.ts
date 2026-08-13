import type { AppContext, ExportFormat, SearchBarHandle, SearchQuery, TabContext } from '../../core/registry';
import {
  type LogLine,
  SEVERITIES,
  type Severity,
  type StreamHandle,
  logArguments,
  parseLogLine,
  runDocker,
  streamDocker
} from './docker';
import { SelectionModel, collapsible, hideCheckboxLabel, node, wireRowKeyboard } from './dom';
import {
  ELEMENT_IDS,
  EXPORT_FORMAT_ID,
  LOGS_TAB_ID,
  LOG_FOLLOW_ID,
  LOG_TAIL_ID,
  type ServerState,
  logPageSize,
  logTail,
  redactSecretsEnabled
} from './state';

/**
 * The log destination.
 *
 * One container's output at a time, read with `docker logs`. The two modes are
 * genuinely different commands rather than a switch on the same one: a snapshot
 * runs `docker logs --tail N` and exits, and following runs the same command
 * with `--follow`, which never exits and is killed when the toggle goes off, the
 * container changes or the destination closes.
 *
 * The severity a line is given is this application reading the text, not a fact
 * Docker reported — a container log is whatever the program inside wrote to its
 * own output, and it has no severity channel. The filter says so beside itself
 * rather than presenting a guess as a measurement.
 */

/* ------------------------------------------------------------------ */
/* Memory across a remount                                             */
/* ------------------------------------------------------------------ */

interface LogsMemory {
  container: string;
  query: string;
  severities: Set<Severity>;
  page: number;
  filtersOpen: boolean;
  statisticsOpen: boolean;
  selection: SelectionModel;
}

const memory: LogsMemory = {
  container: '',
  query: '',
  severities: new Set<Severity>(),
  page: 0,
  filtersOpen: true,
  statisticsOpen: false,
  selection: new SelectionModel()
};

/** Set while the destination is mounted, so another surface can retarget it. */
let retarget: ((name: string) => void) | null = null;

export function resetLogsPanelMemory(): void {
  memory.container = '';
  memory.query = '';
  memory.severities.clear();
  memory.page = 0;
  memory.filtersOpen = true;
  memory.statisticsOpen = false;
  memory.selection.clear();
}

/** Opens the log destination pointed at one container. */
export function openLogsFor(ctx: AppContext, name: string): void {
  memory.container = name;
  ctx.tabs.open(LOGS_TAB_ID);
  retarget?.(name);
}

/* ------------------------------------------------------------------ */
/* Bounds                                                              */
/* ------------------------------------------------------------------ */

/**
 * How many lines are held in memory at once.
 *
 * A container that logs a line a millisecond fills any buffer, so there has to
 * be a ceiling; what matters is that the surface says the ceiling was reached
 * rather than quietly dropping the beginning of the log.
 */
const MAX_LINES = 20_000;

const SEVERITY_TONE: Record<Severity, 'info' | 'success' | 'warning' | 'error' | 'progress'> = {
  error: 'error',
  warning: 'warning',
  info: 'info',
  debug: 'progress',
  other: 'info'
};

/* ------------------------------------------------------------------ */
/* The destination                                                     */
/* ------------------------------------------------------------------ */

export function mountLogsPanel(host: HTMLElement, ctx: TabContext, state: ServerState): void {
  host.classList.add('server');

  let lines: LogLine[] = [];
  let nextKey = 1;
  let droppedLines = 0;
  let loading = false;
  let loadError: string | null = null;
  let stream: StreamHandle | null = null;
  let streamEnded: string | null = null;
  let query: SearchQuery | null = null;
  let redrawTimer: number | null = null;
  let disposed = false;

  const followWanted = (): boolean => ctx.settings.get<boolean>(LOG_FOLLOW_ID, false) === true;

  /* ---------------- chrome ---------------- */

  const refreshButton = ctx.components.iconButton({
    icon: 'refresh',
    label: ctx.t('server.logs.reload', 'Read the log again'),
    onClick: () => void reload()
  });

  host.append(
    ctx.components.topAppBar({
      title: 'server.tab.logs',
      subtitle: 'server.tab.logs.subtitle',
      actions: [refreshButton]
    })
  );

  const body = node('div', { className: 'server__body' });
  host.append(body);

  /* ---------------- source row ---------------- */

  const sourceSection = node('section', {
    className: 'server__section',
    attrs: { id: ELEMENT_IDS.logPicker, 'data-appearance-id': 'server:logPicker' }
  });
  body.append(sourceSection);

  const sourceRow = node('div', { className: 'server__row' });
  sourceSection.append(
    ctx.components.sectionHeading({ title: 'server.logs.source', description: 'server.logs.source.description' }),
    sourceRow
  );

  const statusLine = node('p', {
    className: 'md-typescale-body-small server-muted',
    attrs: { role: 'status', 'aria-live': 'polite' }
  });
  sourceSection.append(statusLine);

  /* ---------------- filters ---------------- */

  const filterSummary = node('span', { className: 'md-typescale-label-medium' });
  const filters = collapsible(ctx, {
    id: ELEMENT_IDS.logFilters,
    title: 'server.logs.filters',
    description: 'server.logs.filters.description',
    startOpen: memory.filtersOpen,
    summary: filterSummary
  });
  filters.trigger.addEventListener('click', () => {
    memory.filtersOpen = filters.isOpen();
  });
  body.append(filters.root);

  const search: SearchBarHandle = ctx.createSearchBar({
    label: 'server.logs.search',
    placeholder: 'server.logs.search.placeholder',
    initialText: memory.query,
    sample: '',
    onChange: (next) => {
      query = next;
      memory.query = next.text;
      memory.page = 0;
      draw();
    }
  });
  search.root.id = ELEMENT_IDS.logSearch;
  filters.body.append(search.root);

  const severityChips = node('div', { className: 'server__chips', attrs: { role: 'group' } });
  filters.body.append(
    node('p', { className: 'md-typescale-label-large', text: ctx.t('server.logs.severity', 'Show these severities') }),
    node('p', {
      className: 'md-typescale-body-small server-muted',
      text: ctx.t(
        'server.logs.severity.note',
        'A container log carries no severity channel. These are read from the words in each line, and from whether the line came from the error stream, so treat them as a reading rather than as a fact Docker reported.'
      )
    }),
    severityChips
  );

  /* ---------------- statistics ---------------- */

  const statisticsSummary = node('span', { className: 'md-typescale-label-medium' });
  const statistics = collapsible(ctx, {
    id: ELEMENT_IDS.logStatistics,
    title: 'server.logs.stats',
    description: 'server.logs.stats.description',
    startOpen: memory.statisticsOpen,
    summary: statisticsSummary
  });
  statistics.trigger.addEventListener('click', () => {
    memory.statisticsOpen = statistics.isOpen();
  });
  body.append(statistics.root);

  /* ---------------- selection and lines ---------------- */

  const selectionBar = node('div', { className: 'server__toolbar' });
  const selectionStatus = node('p', {
    className: 'md-typescale-body-medium server__selection',
    attrs: { role: 'status', 'aria-live': 'polite' }
  });
  const selectionActions = node('div', { className: 'server__row' });
  selectionBar.append(selectionStatus, selectionActions);
  body.append(selectionBar);

  const linesHost = node('div', {
    className: 'server__tablehost',
    attrs: { id: ELEMENT_IDS.logLines, 'data-appearance-id': 'server:logLines' }
  });
  body.append(linesHost);

  const pager = node('div', { className: 'server__pager' });
  body.append(pager);

  /* ---------------- reading the log ---------------- */

  const appendRaw = (raw: string, streamName: 'stdout' | 'stderr'): void => {
    lines.push(parseLogLine(raw, streamName, nextKey, redactSecretsEnabled(ctx)));
    nextKey += 1;
    if (lines.length > MAX_LINES) {
      const excess = lines.length - MAX_LINES;
      lines = lines.slice(excess);
      droppedLines += excess;
    }
  };

  /** Coalesces redraws so a chatty container cannot pin the interface. */
  const scheduleDraw = (): void => {
    if (redrawTimer !== null) return;
    redrawTimer = window.setTimeout(() => {
      redrawTimer = null;
      if (!disposed) draw();
    }, 250);
  };

  const stopStream = async (): Promise<void> => {
    const current = stream;
    stream = null;
    if (current) await current.stop();
  };

  const startStream = async (): Promise<void> => {
    await stopStream();
    if (memory.container === '') return;
    streamEnded = null;
    const started = await streamDocker(
      ctx,
      logArguments(memory.container, logTail(ctx), true),
      {
        onLine: (line, streamName) => {
          if (line === '') return;
          appendRaw(line, streamName);
          if (followWanted()) memory.page = Number.MAX_SAFE_INTEGER;
          scheduleDraw();
        },
        onEnd: (reason) => {
          stream = null;
          streamEnded =
            reason ??
            ctx.t(
              'server.logs.follow.ended',
              'The follow ended. This happens when the container stops, when Docker closes the stream, or when following was switched off.'
            );
          scheduleDraw();
        }
      }
    );
    if (!started.ok) {
      loadError = started.error;
      draw();
      return;
    }
    stream = started.handle;
    draw();
  };

  const loadSnapshot = async (): Promise<void> => {
    if (memory.container === '') return;
    loading = true;
    loadError = null;
    draw();
    const run = await runDocker(ctx, logArguments(memory.container, logTail(ctx), false), {
      timeoutMs: 30_000,
      maxOutputBytes: 8 * 1024 * 1024
    });
    loading = false;
    if (run.failure !== null) {
      loadError = run.failure;
      draw();
      return;
    }
    if (!run.ok) {
      loadError = run.stderr.trim() || run.stdout.trim() || `The command exited with status ${String(run.code)}.`;
      draw();
      return;
    }
    // Docker writes a container's stdout and stderr to this one pipe. What the
    // program inside sent to which stream is not recoverable from the snapshot,
    // so every snapshot line is recorded as standard output rather than being
    // assigned a stream it might not have come from.
    for (const raw of run.stdout.split(/\r?\n/)) {
      if (raw.trim() === '') continue;
      appendRaw(raw, 'stdout');
    }
    for (const raw of run.stderr.split(/\r?\n/)) {
      if (raw.trim() === '') continue;
      appendRaw(raw, 'stderr');
    }
    memory.page = Number.MAX_SAFE_INTEGER;
    draw();
  };

  const reload = async (): Promise<void> => {
    lines = [];
    droppedLines = 0;
    memory.selection.clear();
    streamEnded = null;
    if (followWanted()) await startStream();
    else {
      await stopStream();
      await loadSnapshot();
    }
  };

  const selectContainer = async (name: string): Promise<void> => {
    if (name === memory.container) return;
    memory.container = name;
    memory.page = 0;
    await reload();
  };

  retarget = (name: string) => {
    void selectContainer(name);
  };

  /* ---------------- filtering ---------------- */

  const searchMatched = (): LogLine[] => {
    if (!query || query.text.trim() === '') return lines;
    return lines.filter((line) => query?.matches(`${line.timestamp} ${line.text}`) ?? true);
  };

  const visible = (searched: LogLine[]): LogLine[] => {
    if (memory.severities.size === 0) return searched;
    return searched.filter((line) => memory.severities.has(line.severity));
  };

  /* ---------------- actions ---------------- */

  const renderLine = (line: LogLine): string =>
    line.timestamp === '' ? line.text : `${line.timestamp} ${line.text}`;

  const copySelected = async (): Promise<void> => {
    const chosen = lines.filter((line) => memory.selection.has(String(line.key)));
    if (chosen.length === 0) return;
    const text = chosen.map(renderLine).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      ctx.notify.success(
        ctx.t('server.logs.copied', 'Copied'),
        ctx.t('server.logs.copied.body', '{count} lines are on the clipboard, exactly as they are shown here.', {
          values: { count: chosen.length }
        })
      );
    } catch (error) {
      ctx.notify.error(
        ctx.t('server.copy.failed', 'Nothing was copied'),
        ctx.t('server.copy.failed.body', 'The clipboard refused: {reason}', {
          values: { reason: error instanceof Error ? error.message : String(error) }
        })
      );
    }
  };

  const exportRows = async (): Promise<void> => {
    const searched = searchMatched();
    const shown = visible(searched);
    const chosen = memory.selection.size() > 0 ? lines.filter((line) => memory.selection.has(String(line.key))) : shown;
    if (chosen.length === 0) {
      ctx.notify.info(
        ctx.t('server.logs.export', 'Export log lines'),
        ctx.t('server.logs.export.empty', 'There is nothing to export: no line is selected and none is shown.')
      );
      return;
    }
    const records = chosen.map((line, index) => ({
      index: index + 1,
      timestamp: line.timestamp,
      severity: line.severity,
      stream: line.stream,
      text: line.text
    }));
    const format = ctx.settings.get<string>(EXPORT_FORMAT_ID, 'json') as ExportFormat;
    const preflight = ctx.exporter.preflight(records, format);
    if (preflight.losses.length > 0) {
      const proceed = await ctx.components.dialog({
        title: ctx.t('server.export.losses', 'This format cannot carry everything'),
        body: preflight.losses.map((loss) => `${loss.field}: ${loss.reason}`).join('\n'),
        confirmLabel: ctx.t('server.export.proceed', 'Export anyway'),
        cancelLabel: ctx.t('server.export.cancel', 'Choose another format first')
      });
      if (!proceed) return;
    }
    const path = await ctx.exporter.save(records, format, {
      name: 'container-log',
      defaultFileName: `${memory.container || 'container'}-log.${format}`
    });
    if (!path) return;
    ctx.notify.success(
      ctx.t('server.logs.export', 'Export log lines'),
      redactSecretsEnabled(ctx)
        ? ctx.t(
            'server.logs.export.redacted',
            '{count} lines written to {path}. They carry the same redaction the surface shows, so a value that reads as a password or a token is written as <redacted> in the file too.',
            { values: { count: records.length, path } }
          )
        : ctx.t(
            'server.logs.export.raw',
            '{count} lines written to {path}. Redaction is switched off, so anything the container printed — including a token or a password — is in that file exactly as it was printed.',
            { values: { count: records.length, path } }
          )
    );
    await ctx.history.record(`Exported ${records.length} log lines from ${memory.container}`, 'server', {
      kind: 'server.logs.export',
      container: memory.container,
      format,
      count: records.length,
      redacted: redactSecretsEnabled(ctx),
      path
    });
  };

  /* ---------------- drawing ---------------- */

  const drawSource = (): void => {
    sourceRow.textContent = '';
    const rows = state.rows();
    const options = rows.map((row) => ({
      value: row.name,
      label: `${row.name} — ${ctx.t(`server.state.${row.state}`, row.state)}`
    }));

    if (memory.container !== '' && !rows.some((row) => row.name === memory.container)) {
      // The container the user was reading has gone. Say so, and keep it in the
      // picker so the lines already on screen are not orphaned by a control that
      // claims to be pointing somewhere else.
      options.unshift({
        value: memory.container,
        label: ctx.t('server.logs.missing', '{name} — no longer listed', { values: { name: memory.container } })
      });
    }

    const picker = ctx.components.select({
      label: 'server.logs.container',
      options: options.length > 0 ? options : [{ value: '', label: ctx.t('server.logs.none', 'No container') }],
      value: memory.container,
      disabled: options.length === 0,
      disabledReason: ctx.t(
        'server.logs.container.disabled',
        'Docker listed no containers, so there is no log to read. The containers destination says why.'
      ),
      onChange: (value) => void selectContainer(value)
    });

    const tailField = ctx.components.textField({
      label: 'server.logs.tail',
      type: 'number',
      value: String(logTail(ctx)),
      min: 50,
      max: 5000,
      step: 50,
      supportingText: ctx.t('server.logs.tail.support', 'Lines read from the end of the log, between 50 and 5000.'),
      onCommit: (value) => {
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) return;
        ctx.settings.set(LOG_TAIL_ID, Math.min(5000, Math.max(50, Math.round(parsed))));
        void reload();
      }
    });

    const follow = ctx.components.switchControl({
      label: 'server.logs.follow',
      checked: followWanted(),
      id: ELEMENT_IDS.logFollow,
      disabled: memory.container === '',
      disabledReason: ctx.t('server.logs.follow.disabled', 'Choose a container first; there is nothing to follow yet.'),
      onChange: (value) => {
        ctx.settings.set(LOG_FOLLOW_ID, value);
        void reload();
      }
    });

    sourceRow.append(picker.root, tailField.root, follow.root);
  };

  const drawStatus = (): void => {
    const parts: string[] = [];
    if (memory.container === '') {
      parts.push(ctx.t('server.logs.status.none', 'No container chosen.'));
    } else if (loading) {
      parts.push(ctx.t('server.logs.status.loading', 'Reading the last {tail} lines of {name}.', {
        values: { tail: logTail(ctx), name: memory.container }
      }));
    } else if (stream) {
      parts.push(
        ctx.t('server.logs.status.following', 'Following {name}. New lines appear as the container prints them.', {
          values: { name: memory.container }
        })
      );
    } else if (streamEnded) {
      parts.push(streamEnded);
    } else {
      parts.push(
        ctx.t('server.logs.status.snapshot', '{count} lines read from {name}. This is a snapshot, not a live view.', {
          values: { count: lines.length, name: memory.container }
        })
      );
    }
    if (droppedLines > 0) {
      parts.push(
        ctx.t(
          'server.logs.status.dropped',
          '{count} of the oldest lines were dropped to stay within the {max}-line ceiling this destination holds in memory.',
          { values: { count: droppedLines, max: MAX_LINES } }
        )
      );
    }
    if (redactSecretsEnabled(ctx)) {
      parts.push(
        ctx.t(
          'server.logs.status.redacted',
          'Values that read as a password, a token, a secret or a key are shown as <redacted>. Turn redaction off in settings to see them.'
        )
      );
    }
    statusLine.textContent = parts.join(' ');
  };

  const drawSeverityChips = (searched: LogLine[]): void => {
    severityChips.textContent = '';
    const counts = new Map<Severity, number>();
    for (const line of searched) counts.set(line.severity, (counts.get(line.severity) ?? 0) + 1);
    for (const severity of SEVERITIES) {
      const count = counts.get(severity) ?? 0;
      const chip = ctx.components.chip({
        label: `${ctx.t(`server.severity.${severity}`, severity)} (${count})`,
        selected: memory.severities.has(severity),
        onToggle: (selected) => {
          if (selected) memory.severities.add(severity);
          else memory.severities.delete(severity);
          memory.page = 0;
          draw();
        }
      });
      if (count === 0 && !memory.severities.has(severity)) chip.classList.add('server-chip--empty');
      severityChips.append(chip);
    }
  };

  const drawStatistics = (searched: LogLine[], shown: LogLine[]): void => {
    statistics.body.textContent = '';
    const counts = new Map<Severity, number>();
    for (const line of lines) counts.set(line.severity, (counts.get(line.severity) ?? 0) + 1);
    const errors = counts.get('error') ?? 0;
    statisticsSummary.textContent = ctx.t('server.logs.stats.summary', '{lines} lines, {errors} read as errors', {
      values: { lines: lines.length, errors }
    });

    const grid = node('dl', { className: 'server__stats' });
    const pair = (label: string, value: string): void => {
      grid.append(
        node('div', {
          className: 'server__stat',
          children: [
            node('dt', { className: 'md-typescale-label-medium server-muted', text: label }),
            node('dd', { className: 'md-typescale-title-medium', text: value })
          ]
        })
      );
    };
    pair(ctx.t('server.logs.stats.loaded', 'Lines held'), String(lines.length));
    pair(ctx.t('server.logs.stats.searched', 'Matching the search'), String(searched.length));
    pair(ctx.t('server.logs.stats.shown', 'Shown after the severity filter'), String(shown.length));
    for (const severity of SEVERITIES) {
      pair(ctx.t(`server.severity.${severity}`, severity), String(counts.get(severity) ?? 0));
    }
    pair(ctx.t('server.logs.stats.dropped', 'Dropped at the ceiling'), String(droppedLines));
    statistics.body.append(grid);
  };

  const drawSelection = (searched: LogLine[], shown: LogLine[]): void => {
    const chosen = memory.selection.size();
    selectionStatus.textContent =
      chosen === 0
        ? ctx.t('server.logs.selection.none', 'No line selected')
        : ctx.t('server.logs.selection.count', '{count} lines selected', { values: { count: chosen } });
    if (chosen > 0) {
      selectionStatus.append(
        node('span', {
          className: 'server-muted',
          text: ` · ${ctx.t('server.logs.selection.preview', 'Copying or exporting acts on exactly those {count} lines.', {
            values: { count: chosen }
          })}`
        })
      );
    }

    selectionActions.textContent = '';
    const emptyReason = ctx.t('server.logs.selection.none', 'No line selected');
    selectionActions.append(
      ctx.components.button({
        label: 'server.logs.copy',
        variant: 'tonal',
        icon: 'copy',
        disabled: chosen === 0,
        disabledReason: emptyReason,
        onClick: () => void copySelected()
      }),
      ctx.components.button({
        label: 'server.logs.export',
        variant: 'text',
        icon: 'download',
        onClick: () => void exportRows()
      }),
      ctx.components.divider(true),
      ctx.components.button({
        label: ctx.t('server.logs.selectShown', 'Select the {count} shown', { values: { count: shown.length } }),
        variant: 'text',
        disabled: shown.length === 0,
        disabledReason: ctx.t('server.logs.empty.filtered', 'No line matches the search and severity filter.'),
        onClick: () => {
          memory.selection.addAll(shown.map((line) => String(line.key)));
          draw();
          ctx.a11y.announce(
            ctx.t('server.logs.selection.count', '{count} lines selected', { values: { count: memory.selection.size() } })
          );
        }
      }),
      ctx.components.button({
        label: ctx.t('server.logs.selectAll', 'Select all {count} held, including filtered out', {
          values: { count: lines.length }
        }),
        variant: 'text',
        disabled: lines.length === 0,
        disabledReason: ctx.t('server.logs.empty', 'No line has been read yet.'),
        onClick: () => {
          memory.selection.addAll(lines.map((line) => String(line.key)));
          draw();
        }
      }),
      ctx.components.button({
        label: 'server.action.invert',
        variant: 'text',
        disabled: shown.length === 0,
        disabledReason: ctx.t('server.logs.empty.filtered', 'No line matches the search and severity filter.'),
        onClick: () => {
          memory.selection.invert(shown.map((line) => String(line.key)));
          draw();
        }
      }),
      ctx.components.button({
        label: 'server.action.clearSelection',
        variant: 'text',
        disabled: chosen === 0,
        disabledReason: emptyReason,
        onClick: () => {
          memory.selection.clear();
          draw();
        }
      })
    );
    filterSummary.textContent = ctx.t('server.logs.filters.summary', '{shown} of {held} lines shown', {
      values: { shown: shown.length, held: lines.length }
    });
    void searched;
  };

  const redrawAndFocusRow = (index: number): void => {
    draw();
    const restored = linesHost.querySelectorAll('tbody input[type="checkbox"]')[index];
    if (restored instanceof HTMLInputElement) restored.focus();
  };

  const drawLines = (shown: LogLine[]): void => {
    linesHost.textContent = '';
    pager.textContent = '';

    if (memory.container === '') {
      const rows = state.rows();
      linesHost.append(
        ctx.components.emptyState({
          title: ctx.t('server.logs.empty.noContainer', 'Choose a container to read its log'),
          body:
            rows.length === 0
              ? ctx.t(
                  'server.logs.empty.noContainer.none',
                  'Docker listed no containers, so there is no log to choose. The containers destination says whether Docker is missing or simply not answering.'
                )
              : ctx.t('server.logs.empty.noContainer.some', '{count} containers exist. Pick one above.', {
                  values: { count: rows.length }
                }),
          action: {
            label: 'server.logs.openContainers',
            variant: 'text',
            icon: 'cloud',
            onClick: () => ctx.tabs.open('server.containers')
          }
        })
      );
      return;
    }

    if (loading) {
      const progress = ctx.components.linearProgress({
        label: ctx.t('server.logs.status.loading', 'Reading the last {tail} lines of {name}.', {
          values: { tail: logTail(ctx), name: memory.container }
        })
      });
      linesHost.append(progress.root);
      return;
    }

    if (loadError !== null) {
      linesHost.append(
        ctx.components.emptyState({
          title: ctx.t('server.logs.error', 'The log could not be read'),
          body: loadError,
          action: {
            label: 'server.logs.reload',
            variant: 'filled',
            icon: 'refresh',
            onClick: () => void reload()
          }
        })
      );
      return;
    }

    if (lines.length === 0) {
      linesHost.append(
        ctx.components.emptyState({
          title: ctx.t('server.logs.empty', 'No line has been read yet.'),
          body: ctx.t(
            'server.logs.empty.body',
            '{name} has printed nothing that Docker retained, or it has only just started. Following it shows each line as it arrives.',
            { values: { name: memory.container } }
          ),
          action: {
            label: 'server.logs.reload',
            variant: 'text',
            icon: 'refresh',
            onClick: () => void reload()
          }
        })
      );
      return;
    }

    if (shown.length === 0) {
      linesHost.append(
        ctx.components.emptyState({
          title: ctx.t('server.logs.empty.filtered', 'No line matches the search and severity filter.'),
          body: ctx.t('server.logs.empty.filtered.body', '{count} lines are held; the filter is hiding all of them.', {
            values: { count: lines.length }
          }),
          action: {
            label: 'server.logs.clearFilter',
            variant: 'text',
            icon: 'close',
            onClick: () => {
              memory.severities.clear();
              search.clear();
              query = null;
              memory.query = '';
              memory.page = 0;
              draw();
            }
          }
        })
      );
      return;
    }

    const size = logPageSize(ctx);
    const pageCount = Math.max(1, Math.ceil(shown.length / size));
    if (memory.page >= pageCount) memory.page = pageCount - 1;
    if (memory.page < 0) memory.page = 0;
    const start = memory.page * size;
    const pageRows = shown.slice(start, start + size);
    const keys = pageRows.map((line) => String(line.key));

    const wrap = node('div', {
      className: 'md-table-wrap server__logwrap',
      attrs: { role: 'region', tabindex: '0', 'aria-label': ctx.t('server.logs.table', 'Log lines') }
    });
    const table = node('table', {
      className: 'md-table server__logtable',
      attrs: { 'aria-label': ctx.t('server.logs.table', 'Log lines') }
    });

    const head = node('thead');
    const headRow = node('tr');
    const selectedOnPage = pageRows.filter((line) => memory.selection.has(String(line.key))).length;
    const selectPage = ctx.components.checkbox({
      label: ctx.t('server.logs.selectPage', 'Select the {count} lines on this page', { values: { count: pageRows.length } }),
      checked: selectedOnPage === pageRows.length && pageRows.length > 0,
      indeterminate: selectedOnPage > 0 && selectedOnPage < pageRows.length,
      onChange: (checked) => {
        for (const line of pageRows) memory.selection.set(String(line.key), checked);
        draw();
      }
    });
    hideCheckboxLabel(selectPage.root);
    const selectHeader = node('th', { attrs: { scope: 'col' } });
    selectHeader.append(selectPage.root);
    headRow.append(
      selectHeader,
      node('th', { attrs: { scope: 'col' }, text: ctx.t('server.logs.column.time', 'Time') }),
      node('th', { attrs: { scope: 'col' }, text: ctx.t('server.logs.column.severity', 'Severity') }),
      node('th', { attrs: { scope: 'col' }, text: ctx.t('server.logs.column.text', 'Line') })
    );
    head.append(headRow);

    const tbody = node('tbody');
    pageRows.forEach((line, index) => {
      const tr = node('tr', { attrs: { 'aria-selected': String(memory.selection.has(String(line.key))) } });
      tr.dataset.appearanceId = 'server:logRow';

      const selectCell = node('td');
      const box = ctx.components.checkbox({
        label: ctx.t('server.logs.select', 'Select line {index}', { values: { index: start + index + 1 } }),
        checked: memory.selection.has(String(line.key)),
        onChange: (checked) => {
          memory.selection.set(String(line.key), checked);
          tr.setAttribute('aria-selected', String(checked));
          drawSelection(searchMatched(), shown);
        }
      });
      hideCheckboxLabel(box.root);
      const input = box.root.querySelector('input');
      if (input instanceof HTMLInputElement) wireRowKeyboard(input, index, keys, memory.selection, redrawAndFocusRow);
      selectCell.append(box.root);

      const timeCell = node('td', {
        className: 'server__logtime',
        text: line.timestamp === '' ? ctx.t('server.logs.noTime', 'Not stamped') : line.timestamp
      });
      const severityCell = node('td');
      severityCell.append(
        ctx.components.badge({
          label: ctx.t(`server.severity.${line.severity}`, line.severity),
          severity: SEVERITY_TONE[line.severity]
        })
      );
      const textCell = node('td');
      textCell.append(node('code', { className: 'server__logline', text: line.text }));

      tr.append(selectCell, timeCell, severityCell, textCell);
      tbody.append(tr);
    });

    table.append(head, tbody);
    wrap.append(table);
    linesHost.append(wrap);

    const first = start + 1;
    const last = Math.min(start + size, shown.length);
    pager.append(
      ctx.components.button({
        label: 'server.logs.previous',
        variant: 'text',
        icon: 'chevronLeft',
        disabled: memory.page === 0,
        disabledReason: ctx.t('server.logs.firstPage', 'This is the first page.'),
        onClick: () => {
          memory.page -= 1;
          draw();
        }
      }),
      node('span', {
        className: 'md-typescale-body-small',
        attrs: { role: 'status' },
        text: ctx.t('server.logs.page', 'Showing {from} to {to} of {total}', {
          values: { from: first, to: last, total: shown.length }
        })
      }),
      ctx.components.button({
        label: 'server.logs.next',
        variant: 'text',
        trailingIcon: 'chevronRight',
        disabled: memory.page >= pageCount - 1,
        disabledReason: ctx.t('server.logs.lastPage', 'This is the last page.'),
        onClick: () => {
          memory.page += 1;
          draw();
        }
      })
    );
  };

  const draw = (): void => {
    memory.selection.retain(lines.map((line) => String(line.key)));
    const searched = searchMatched();
    const shown = visible(searched);
    drawSource();
    drawStatus();
    drawSeverityChips(searched);
    drawStatistics(searched, shown);
    drawSelection(searched, shown);
    drawLines(shown);
  };

  /* ---------------- wiring ---------------- */

  state.logsPanel = {
    focusSearch: () => search.focus(),
    exportRows: () => exportRows(),
    toggleFollow: () => {
      ctx.settings.set(LOG_FOLLOW_ID, !followWanted());
      void reload();
    }
  };

  const unsubscribe = state.subscribe(() => {
    // The container list changed underneath this destination: the picker's
    // options and a container's disappearance both have to be reflected.
    drawSource();
    drawStatus();
  });
  const detach = state.attach();

  ctx.onDispose(() => {
    disposed = true;
    if (redrawTimer !== null) window.clearTimeout(redrawTimer);
    retarget = null;
    state.logsPanel = null;
    unsubscribe();
    detach();
    search.destroy();
    void stopStream();
  });

  draw();
  if (memory.query !== '') search.setText(memory.query);

  if (memory.container === '') {
    // Nothing is chosen yet, so the first container Docker listed is offered
    // rather than an empty picker the user has to work out. Nothing is read
    // until they choose, so no log is loaded behind their back.
    const first = state.rows()[0];
    if (first) void selectContainer(first.name);
  } else if (lines.length === 0) {
    void reload();
  }
}
