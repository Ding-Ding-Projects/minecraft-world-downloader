import { el } from '../../core/a11y';
import type { ControlHandle, ExportFormat, TabContext } from '../../core/registry';
import {
  OPTION_DEFINITIONS,
  OPTION_GROUP_ORDER,
  OPTION_GROUP_TITLES,
  OPTION_IDS,
  asBoolean,
  asString,
  defaultValues,
  optionById,
  type OptionDefinition,
  type OptionValue
} from './options';
import {
  PROFILE_PRESETS,
  changedOptionIds,
  createProfile,
  describeProfile,
  duplicateProfile,
  presetChanges,
  presetValues,
  profileExportRecords,
  readProfiles,
  writeProfiles,
  type DownloadProfile,
  type ProfilePreset
} from './profiles';
import {
  JAR_DOWNLOAD_URL,
  JAVA_DOWNLOAD_URL,
  SUPPORTED_PROTOCOLS,
  countChunks,
  formatBytes,
  formatCount,
  formatDuration,
  formatTimestamp,
  type ChunkCount,
  type RegionFile
} from './runtime';
import { LOG_SEVERITIES, type ConnectionState, type LogLine, type LogSeverity, type SessionPhase } from './session';
import {
  DEFAULT_EXPORT_FORMAT,
  DEFAULT_VISIBLE_LOG_LINES,
  EXPORT_FORMAT_SETTING_ID,
  FeatureState,
  JAR_PATH_SETTING_ID,
  JAVA_COMMAND_SETTING_ID,
  VISIBLE_LOG_LINES_SETTING_ID
} from './state';

/* ================================================================== */
/* Small shared helpers                                                */
/* ================================================================== */

const EXPORT_FORMATS: ExportFormat[] = ['json', 'jsonl', 'yaml', 'toml', 'xml', 'csv', 'tsv', 'markdown', 'html', 'sql'];

const PHASE_SEVERITY: Record<SessionPhase, 'info' | 'success' | 'warning' | 'error'> = {
  idle: 'info',
  starting: 'info',
  running: 'success',
  stopping: 'warning',
  stopped: 'info',
  failed: 'error'
};

const CONNECTION_KEY: Record<ConnectionState, string> = {
  'not-started': 'notStarted',
  'waiting-for-signin': 'waitingForSignin',
  listening: 'listening',
  'client-connected': 'clientConnected',
  disconnected: 'disconnected',
  ended: 'ended'
};

const SEVERITY_ICON: Record<LogSeverity, string> = {
  error: 'error',
  warning: 'warning',
  notice: 'success',
  info: 'info'
};

function anchorFor(fallback: HTMLElement): HTMLElement {
  const active = document.activeElement;
  return active instanceof HTMLElement && active !== document.body ? active : fallback;
}

function card(...children: Array<Node | null | undefined>): HTMLElement {
  const root = el('div', { className: 'downloader-card' });
  for (const child of children) if (child) root.append(child);
  return root;
}

function row(...children: Array<Node | null | undefined>): HTMLElement {
  const wrap = el('div', { className: 'downloader-row' });
  for (const child of children) if (child) wrap.append(child);
  return wrap;
}

function statLine(ctx: TabContext, labelKey: string, labelFallback: string, value: string): HTMLElement {
  const line = el('div', { className: 'downloader-stat' });
  line.append(
    el('span', { className: 'downloader-stat__label md-typescale-label-large', text: ctx.t(labelKey, labelFallback) }),
    el('span', { className: 'downloader-stat__value md-typescale-body-large', text: value })
  );
  return line;
}

async function copyText(ctx: TabContext, text: string, successKey: string, successFallback: string, failedKey: string, failedFallback: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    ctx.notify.success(ctx.t(successKey, successFallback), '');
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    ctx.notify.error(ctx.t(failedKey, failedFallback), ctx.t(failedKey, failedFallback, { values: { reason } }));
  }
}

/** Opens a small dialog with an export-format picker, then serializes and saves. */
async function exportWithFormatPicker(
  ctx: TabContext,
  records: Array<Record<string, unknown>>,
  defaultName: string,
  titleKey: string,
  titleFallback: string
): Promise<void> {
  if (records.length === 0) return;
  let format = ctx.settings.get<string>(EXPORT_FORMAT_SETTING_ID, DEFAULT_EXPORT_FORMAT) as ExportFormat;
  if (!EXPORT_FORMATS.includes(format)) format = DEFAULT_EXPORT_FORMAT;

  const body = el('div', { className: 'downloader-export-picker' });
  const picker = ctx.components.select({
    label: 'downloader.export.format',
    options: EXPORT_FORMATS.map((f) => ({ value: f, label: f.toUpperCase() })),
    value: format,
    onChange: (value) => {
      format = EXPORT_FORMATS.includes(value as ExportFormat) ? (value as ExportFormat) : DEFAULT_EXPORT_FORMAT;
    }
  });
  body.append(picker.root);

  const approved = await ctx.components.dialog({
    title: titleKey,
    body,
    confirmLabel: 'core.action.export'
  });
  void titleFallback;
  if (!approved) return;

  const preflight = ctx.exporter.preflight(records, format);
  if (preflight.losses.length > 0) {
    const fields = preflight.losses.map((loss) => `${loss.field} (${loss.reason})`).join(', ');
    ctx.notify.warn(
      ctx.t('downloader.export.format', 'Export format'),
      ctx.t('downloader.export.losses', '{format} cannot carry these fields faithfully: {fields}', {
        values: { format: format.toUpperCase(), fields }
      })
    );
  }

  const path = await ctx.exporter.save(records, format, { name: defaultName, defaultFileName: `${defaultName}.${format}` });
  if (path) {
    ctx.notify.success(ctx.t('downloader.export.saved', 'Written to {path}', { values: { path } }), '');
  } else {
    ctx.notify.info(ctx.t('downloader.export.cancelled', 'Nothing was written.'), '');
  }
}

/* ================================================================== */
/* Runtime card: Java + jar                                            */
/* ================================================================== */

function mountRuntimeCard(ctx: TabContext, state: FeatureState): { root: HTMLElement; refresh(): void } {
  const body = el('div', { className: 'downloader-runtime__body' });
  const root = card(
    ctx.components.sectionHeading({
      title: 'downloader.section.runtime',
      description: 'downloader.section.runtime.description'
    }),
    body
  );
  root.id = 'downloader-runtime-card';

  function refresh(): void {
    body.replaceChildren();

    const java = state.javaProbe;
    let javaLine: string;
    switch (java.state) {
      case 'present':
        javaLine = ctx.t('downloader.runtime.java.present', 'Java is available: {version}', { values: { version: java.versionLine } });
        break;
      case 'checking':
        javaLine = ctx.t('downloader.runtime.java.checking', 'Checking for a Java runtime…');
        break;
      case 'missing':
        javaLine = ctx.t('downloader.runtime.java.missing', 'No Java runtime named "{command}" could be started on this machine.', {
          values: { command: java.command }
        });
        break;
      case 'failed':
        javaLine = ctx.t('downloader.runtime.java.failed', 'The Java runtime answered, but the check did not succeed: {reason}', {
          values: { reason: java.error ?? '' }
        });
        break;
      default:
        javaLine = ctx.t('downloader.runtime.java.unknown', 'The Java runtime has not been checked yet.');
    }
    body.append(el('p', { className: 'md-typescale-body-large', text: javaLine }));

    const jar = state.jarProbe;
    if (jar.found) {
      body.append(
        el('p', {
          className: 'md-typescale-body-large',
          text: ctx.t('downloader.runtime.jar.found', 'Downloader jar: {path} ({size})', {
            values: { path: jar.path, size: formatBytes(jar.sizeBytes) }
          })
        })
      );
    } else {
      body.append(el('p', { className: 'md-typescale-body-large', text: ctx.t('downloader.runtime.jar.missing', 'No world-downloader.jar was found.') }));
      if (jar.searched.length > 0) {
        body.append(
          el('p', {
            className: 'md-typescale-body-small downloader-stat__label',
            text: ctx.t('downloader.runtime.jar.searched', 'Looked in: {paths}', { values: { paths: jar.searched.join(', ') } })
          })
        );
      }
    }

    const actions = el('div', { className: 'downloader-row' });
    actions.append(
      ctx.components.button({
        label: 'downloader.action.recheck',
        icon: 'refresh',
        variant: 'tonal',
        onClick: () => {
          void state.refreshJava();
          void state.refreshJar();
        }
      })
    );
    if (java.state !== 'present') {
      actions.append(
        ctx.components.button({
          label: 'downloader.action.getJava',
          icon: 'download',
          variant: 'text',
          onClick: () => void ctx.studio.shell.openExternal(JAVA_DOWNLOAD_URL)
        })
      );
    }
    if (!jar.found) {
      actions.append(
        ctx.components.button({
          label: 'downloader.action.getJar',
          icon: 'download',
          variant: 'text',
          onClick: () => void ctx.studio.shell.openExternal(JAR_DOWNLOAD_URL)
        })
      );
    }
    actions.append(
      ctx.components.button({
        label: 'downloader.action.chooseJar',
        icon: 'folder',
        variant: 'text',
        onClick: async () => {
          const picked = await ctx.studio.dialog.openFile({
            title: ctx.t('downloader.action.chooseJar', 'Choose the downloader jar'),
            filters: [{ name: 'Java archive', extensions: ['jar'] }]
          });
          if (!picked.ok || !picked.value || picked.value.length === 0) return;
          const [path] = picked.value;
          ctx.settings.set(JAR_PATH_SETTING_ID, path);
          await ctx.history.record('Chose a downloader jar', 'downloader', { path });
          await state.refreshJar();
        }
      })
    );
    body.append(actions);
  }

  refresh();
  return { root, refresh };
}

/* ================================================================== */
/* Session card: start/stop, live status, Microsoft sign-in            */
/* ================================================================== */

function mountSessionCard(ctx: TabContext, state: FeatureState): { root: HTMLElement; refresh(): void } {
  const statusBadge = el('span');
  const body = el('div', { className: 'downloader-session__body' });
  const commandBox = el('pre', { className: 'downloader-command md-typescale-body-small' });
  const commandRow = el('div', { className: 'downloader-row' });
  const actionsRow = el('div', { className: 'downloader-row' });

  const header = el('div', { className: 'downloader-session__header' });
  header.append(
    ctx.components.sectionHeading({ title: 'downloader.section.session', description: 'downloader.section.session.description' }),
    statusBadge
  );

  const root = card(header, body, actionsRow, ctx.components.sectionHeading({ title: 'downloader.session.command' }), commandBox, commandRow);
  root.id = 'downloader-session-card';

  let elapsedTimer: ReturnType<typeof setInterval> | null = null;
  ctx.onDispose(() => {
    if (elapsedTimer) clearInterval(elapsedTimer);
  });

  function refresh(): void {
    const status = state.session.snapshot();

    statusBadge.replaceChildren(
      ctx.components.badge({ label: `downloader.status.phase.${status.phase}`, severity: PHASE_SEVERITY[status.phase] })
    );

    body.replaceChildren();
    body.append(
      statLine(ctx, 'downloader.status.phase', 'State', ctx.t(`downloader.status.phase.${status.phase}`, status.phase)),
      statLine(
        ctx,
        'downloader.status.connection',
        'Connection',
        ctx.t(`downloader.status.connection.${CONNECTION_KEY[status.connection]}`, status.connection)
      )
    );

    if (status.account) body.append(statLine(ctx, 'downloader.status.account', 'Account', status.account));
    if (status.proxyTarget) body.append(statLine(ctx, 'downloader.status.proxy', 'Proxying', status.proxyTarget));
    if (status.localPort !== null) body.append(statLine(ctx, 'downloader.status.localPort', 'Local address', `localhost:${status.localPort}`));
    if (status.gameVersion && status.protocolVersion !== null) {
      body.append(
        statLine(
          ctx,
          'downloader.status.version',
          'Game version',
          ctx.t('downloader.status.versionValue', '{version} (protocol {protocol})', {
            values: { version: status.gameVersion, protocol: status.protocolVersion }
          })
        )
      );
    }
    if (status.lastDisconnectReason) {
      body.append(statLine(ctx, 'downloader.status.disconnect', 'Last disconnect', status.lastDisconnectReason));
    }
    if (status.startedAt) {
      body.append(statLine(ctx, 'downloader.status.elapsed', 'Elapsed', formatDuration(state.session.elapsedMilliseconds() ?? 0)));
    }
    if (status.phase === 'failed' && status.exitCode !== null) {
      body.append(
        statLine(
          ctx,
          'downloader.status.exit',
          'Exit',
          ctx.t('downloader.status.exitValue', 'Exit code {code}', { values: { code: status.exitCode } })
        )
      );
    }
    if (status.error) {
      body.append(el('p', { className: 'md-typescale-body-medium downloader-status--error', text: status.error }));
    }
    if (status.preparingRegistries) {
      body.append(el('p', { className: 'md-typescale-body-medium', text: ctx.t('downloader.status.preparing', 'First run for this game version: the downloader is generating its block reports.') }));
    }
    if (status.outputTruncated) {
      body.append(el('p', { className: 'md-typescale-body-small downloader-status--warn', text: ctx.t('downloader.status.truncated', 'The retained output reached its ceiling, so the earliest lines were dropped.') }));
    }

    if (status.microsoft) {
      const { code, url } = status.microsoft;
      const callout = el('div', { className: 'downloader-callout' });
      callout.append(
        el('h3', { className: 'md-typescale-title-medium', text: ctx.t('downloader.status.microsoft', 'Microsoft sign-in') }),
        el('p', { className: 'md-typescale-body-medium', text: ctx.t('downloader.status.microsoft.body', 'Open {url} and enter the code {code}.', { values: { url, code } }) })
      );
      const codeRow = el('div', { className: 'downloader-row' });
      const codeText = el('span', { className: 'downloader-code md-typescale-headline-small', text: code });
      codeRow.append(
        codeText,
        ctx.components.iconButton({
          icon: 'copy',
          label: ctx.t('downloader.action.copyCommand', 'Copy the command line'),
          onClick: () =>
            void copyText(ctx, code, 'downloader.session.copied', 'The command line is on the clipboard.', 'downloader.session.copyFailed', 'The clipboard refused the copy: {reason}')
        }),
        ctx.components.button({
          label: 'downloader.status.microsoft.open',
          icon: 'download',
          variant: 'filled',
          onClick: () => void ctx.studio.shell.openExternal(url)
        })
      );
      callout.append(codeRow);
      body.append(callout);
    }

    actionsRow.replaceChildren();
    const running = state.session.isRunning();
    const busy = state.session.isBusy();
    if (!running) {
      actionsRow.append(
        ctx.components.button({
          label: 'downloader.action.start',
          icon: 'download',
          variant: 'filled',
          disabled: busy,
          disabledReason: busy ? ctx.t('downloader.session.runningReason', 'A download is running. Stop it first.') : undefined,
          onClick: async () => {
            const failure = await state.start();
            if (failure) {
              const reason =
                failure.kind === 'needsJava'
                  ? ctx.t('downloader.session.needsJava', 'No usable Java runtime was found, so nothing can be started.')
                  : failure.kind === 'needsJar'
                    ? ctx.t('downloader.session.needsJar', 'No downloader jar has been chosen, so nothing can be started.')
                    : failure.kind === 'problems'
                      ? ctx.t('downloader.session.needsValidOptions', 'Some launch options are not usable yet.')
                      : ctx.t('downloader.session.startFailed', 'The downloader did not start: {reason}', { values: { reason: failure.message } });
              ctx.notify.error(ctx.t('downloader.action.start', 'Start the download'), reason);
              return;
            }
            ctx.notify.success(ctx.t('downloader.session.started', 'The downloader started.'), '');
          }
        })
      );
    } else {
      actionsRow.append(
        ctx.components.button({
          label: 'downloader.action.stop',
          icon: 'stop',
          variant: 'filled',
          danger: true,
          disabled: busy,
          disabledReason: busy ? ctx.t('downloader.session.notRunningReason', 'Nothing is running.') : undefined,
          onClick: async (event) => {
            const approved = await ctx.confirm.request({
              action: ctx.t('downloader.confirm.stop', 'Stop the running download'),
              affected: [ctx.t('downloader.tab.title', 'World downloader')],
              irreversible: ctx.t(
                'downloader.confirm.stop.irreversible',
                'The downloader is terminated. Chunks it had captured but not yet flushed to disk are lost.'
              ),
              anchor: (event.currentTarget as HTMLElement) ?? anchorFor(root)
            });
            if (!approved) return;
            const failure = await state.stop();
            if (failure) {
              ctx.notify.error(ctx.t('downloader.action.stop', 'Stop the download'), failure.message);
              return;
            }
            ctx.notify.success(ctx.t('downloader.session.stopped', 'The downloader has stopped.'), '');
          }
        })
      );
    }

    commandBox.textContent = state.commandLine();
    commandRow.replaceChildren(
      ctx.components.button({
        label: 'downloader.action.copyCommand',
        icon: 'copy',
        variant: 'text',
        onClick: () =>
          void copyText(
            ctx,
            state.commandLine(),
            'downloader.session.copied',
            'The command line is on the clipboard.',
            'downloader.session.copyFailed',
            'The clipboard refused the copy: {reason}'
          )
      })
    );

    if (elapsedTimer) {
      clearInterval(elapsedTimer);
      elapsedTimer = null;
    }
    if (running) {
      elapsedTimer = setInterval(() => refreshElapsedOnly(), 1000);
    }
  }

  function refreshElapsedOnly(): void {
    const status = state.session.snapshot();
    if (!status.startedAt) return;
    const stats = body.querySelectorAll('.downloader-stat');
    for (const stat of stats) {
      const label = stat.querySelector('.downloader-stat__label');
      if (label && label.textContent === ctx.t('downloader.status.elapsed', 'Elapsed')) {
        const value = stat.querySelector('.downloader-stat__value');
        if (value) value.textContent = formatDuration(state.session.elapsedMilliseconds() ?? 0);
      }
    }
  }

  refresh();
  return {
    root,
    refresh: () => {
      refresh();
    }
  };
}

/* ================================================================== */
/* Status card: world on disk, chunk count, versions                   */
/* ================================================================== */

function mountStatusCard(ctx: TabContext, state: FeatureState): { root: HTMLElement; refresh(): void } {
  const body = el('div', { className: 'downloader-status__body' });
  const chunkBody = el('div', { className: 'downloader-status__chunks' });
  const root = card(ctx.components.sectionHeading({ title: 'downloader.section.status', description: 'downloader.section.status.description' }), body, chunkBody);
  root.id = 'downloader-status-card';

  let chunkResult: ChunkCount | null = null;
  let scanning = false;
  let cancelled = false;
  const progress = ctx.components.linearProgress({ label: ctx.t('downloader.scan.running', 'Counting chunks…'), value: 0 });
  progress.root.hidden = true;

  function refresh(): void {
    body.replaceChildren();
    const scan = state.worldScan;

    if (!scan.exists) {
      body.append(el('p', { className: 'md-typescale-body-large', text: ctx.t('downloader.world.missing', 'The output directory does not exist yet.') }));
    } else {
      const regions = scan.files.filter((f) => f.kind === 'region').length;
      const entities = scan.files.filter((f) => f.kind === 'entities').length;
      body.append(
        statLine(
          ctx,
          'downloader.status.regionFiles',
          'Region files written',
          ctx.t('downloader.status.regionFilesValue', '{regions} region and {entities} entity files', { values: { regions, entities } })
        ),
        statLine(ctx, 'downloader.status.worldBytes', 'World size on disk', formatBytes(scan.totalBytes)),
        statLine(
          ctx,
          'downloader.status.lastWrite',
          'Last region write',
          scan.lastWriteAt ? formatTimestamp(scan.lastWriteAt) : ctx.t('downloader.status.pending', 'Not reported yet')
        )
      );
      body.append(
        ctx.components.button({
          label: 'downloader.action.revealWorld',
          icon: 'folder',
          variant: 'text',
          onClick: () => void ctx.studio.shell.openPath(scan.root)
        })
      );
      body.append(el('p', { className: 'md-typescale-body-small downloader-stat__label', text: ctx.t('downloader.world.deleteHint', 'This application cannot delete a world folder.') }));
    }

    const overview = state.overview;
    if (overview.available && overview.player) {
      body.append(
        statLine(ctx, 'downloader.status.player', 'Player position', `${overview.player.x}, ${overview.player.y}, ${overview.player.z}`),
        statLine(ctx, 'downloader.status.dimension', 'Dimension', overview.dimension ?? ctx.t('downloader.status.pending', 'Not reported yet'))
      );
    } else {
      body.append(
        el('p', {
          className: 'md-typescale-body-small downloader-stat__label',
          text: !asBoolean(state.values[OPTION_IDS.renderMap])
            ? ctx.t('downloader.status.player.needsMap', 'The player position comes from the overview map’s own status file, and map rendering is turned off for this session.')
            : ctx.t('downloader.status.player', 'Player position')
        })
      );
    }

    /* ---------------- chunks ---------------- */
    chunkBody.replaceChildren();
    chunkBody.append(el('h3', { className: 'md-typescale-title-medium', text: ctx.t('downloader.status.chunks', 'Chunks saved') }));

    if (scanning) {
      progress.root.hidden = false;
      chunkBody.append(progress.root);
      chunkBody.append(
        ctx.components.button({
          label: 'downloader.action.cancelScan',
          icon: 'stop',
          variant: 'text',
          onClick: () => {
            cancelled = true;
          }
        })
      );
    } else {
      progress.root.hidden = true;
      if (chunkResult) {
        if (chunkResult.cancelled) {
          chunkBody.append(el('p', { className: 'md-typescale-body-medium', text: ctx.t('downloader.scan.cancelled', 'Counting was stopped. The partial figure is shown and labelled as partial.') }));
        }
        chunkBody.append(
          el('p', {
            className: 'md-typescale-body-large',
            text: ctx.t('downloader.status.chunks.value', '{chunks} chunks across {files} region files, counted {when}', {
              values: { chunks: formatCount(chunkResult.chunks), files: chunkResult.filesRead, when: formatTimestamp(chunkResult.countedAt) }
            })
          })
        );
        if (chunkResult.filesSkipped > 0) {
          chunkBody.append(
            el('p', {
              className: 'md-typescale-body-small downloader-status--warn',
              text: ctx.t('downloader.status.chunks.skipped', '{count} region files were skipped because they are larger than the read ceiling.', {
                values: { count: chunkResult.filesSkipped }
              })
            })
          );
        }
      } else {
        chunkBody.append(el('p', { className: 'md-typescale-body-medium', text: ctx.t('downloader.status.chunks.never', 'Not counted yet.') }));
      }
      const disabled = state.worldScan.files.length === 0;
      chunkBody.append(
        ctx.components.button({
          label: 'downloader.action.scanChunks',
          icon: 'search',
          variant: 'tonal',
          disabled,
          disabledReason: disabled ? ctx.t('downloader.scan.nothing', 'There are no region files to count yet.') : undefined,
          onClick: async () => {
            scanning = true;
            cancelled = false;
            refresh();
            const files: RegionFile[] = state.worldScan.files;
            chunkResult = await countChunks(
              ctx,
              files,
              (done, total) => {
                progress.set(total > 0 ? Math.round((done / total) * 100) : 0);
              },
              () => cancelled
            );
            scanning = false;
            refresh();
          }
        })
      );
    }
  }

  refresh();
  return { root, refresh };
}

/* ================================================================== */
/* Versions reference card                                             */
/* ================================================================== */

function mountVersionsCard(ctx: TabContext, state: FeatureState): { root: HTMLElement; refresh(): void } {
  const body = el('div');
  const root = card(ctx.components.sectionHeading({ title: 'downloader.section.versions', description: 'downloader.section.versions.description' }), body);
  root.id = 'downloader-versions-card';

  const table = ctx.components.dataTable<(typeof SUPPORTED_PROTOCOLS)[number]>({
    label: 'downloader.section.versions',
    columns: [
      { id: 'version', label: 'downloader.versions.column.version', sortable: true, value: (r) => r.version },
      { id: 'protocol', label: 'downloader.versions.column.protocol', sortable: true, align: 'end', value: (r) => r.protocol },
      { id: 'dataVersion', label: 'downloader.versions.column.dataVersion', sortable: true, align: 'end', value: (r) => r.dataVersion }
    ],
    rows: SUPPORTED_PROTOCOLS,
    rowId: (r) => String(r.protocol),
    emptyMessage: 'core.search.noMatches'
  });

  const search = ctx.createSearchBar({
    label: 'downloader.search.versions',
    sample: SUPPORTED_PROTOCOLS.map((r) => r.version).join('\n'),
    onChange: (query) => {
      table.setRows(SUPPORTED_PROTOCOLS.filter((r) => query.matches(`${r.version} ${r.protocol} ${r.dataVersion}`)));
    }
  });

  body.append(search.root, table.root);

  function refresh(): void {
    const status = state.session.snapshot();
    let existing = body.querySelector('.downloader-versions__detected');
    if (status.gameVersion && status.protocolVersion !== null) {
      if (!existing) {
        existing = el('p', { className: 'md-typescale-body-large downloader-versions__detected' });
        body.prepend(existing);
      }
      existing.textContent = `${ctx.t('downloader.versions.detected', 'Detected in this session')}: ${ctx.t('downloader.status.versionValue', '{version} (protocol {protocol})', { values: { version: status.gameVersion, protocol: status.protocolVersion } })}`;
    } else if (existing) {
      existing.remove();
    }
  }

  refresh();
  return { root, refresh };
}

/* ================================================================== */
/* Launch options card                                                 */
/* ================================================================== */

interface OptionRow {
  definition: OptionDefinition;
  root: HTMLElement;
  set(value: OptionValue): void;
  refreshAvailability(): void;
  searchText: string;
}

function buildOptionRow(ctx: TabContext, def: OptionDefinition, state: FeatureState, onChange: () => void): OptionRow {
  const root = el('div', { className: 'downloader-option-row', attrs: { id: `downloader-option-${def.id}` } });
  const header = el('div', { className: 'downloader-option-row__header' });
  const changedBadge = el('span', { className: 'downloader-option-row__changed md-typescale-label-small' });
  const explain = ctx.components.iconButton({
    icon: 'info',
    label: ctx.t('core.settings.explain', 'What this does'),
    onClick: () => {
      description.hidden = !description.hidden;
    }
  });
  header.append(el('span', { className: 'md-typescale-body-large', text: ctx.t(def.labelKey, def.labelKey) }), changedBadge, explain);

  const description = el('p', { className: 'md-typescale-body-small downloader-option-row__description', text: ctx.t(def.descriptionKey, def.descriptionKey) });
  description.hidden = true;
  const flagLine = el('p', {
    className: 'md-typescale-label-small downloader-option-row__flag',
    text: ctx.t('downloader.flagLabel', 'Command-line flag: {flag}', { values: { flag: def.flag } })
  });

  let controlRoot: HTMLElement;
  let getter: () => OptionValue;
  let setter: (value: OptionValue) => void;
  let disabler: (disabled: boolean, reason?: string) => void;

  const current = state.values[def.id];

  if (def.kind === 'switch') {
    const handle: ControlHandle<boolean> = ctx.components.switchControl({
      label: def.labelKey,
      checked: asBoolean(current),
      onChange: (value) => {
        state.setValue(def.id, value);
        onChange();
      }
    });
    controlRoot = handle.root;
    getter = () => handle.get();
    setter = (value) => handle.set(asBoolean(value));
    disabler = (disabled, reason) => handle.setDisabled(disabled, reason);
  } else if (def.kind === 'select') {
    const handle: ControlHandle<string> = ctx.components.select({
      label: def.labelKey,
      options: (def.choices ?? []).map((choice) => ({ value: choice.value, label: choice.labelKey })),
      value: asString(current),
      onChange: (value) => {
        state.setValue(def.id, value);
        onChange();
      }
    });
    controlRoot = handle.root;
    getter = () => handle.get();
    setter = (value) => handle.set(asString(value));
    disabler = (disabled, reason) => handle.setDisabled(disabled, reason);
  } else if (def.kind === 'folder' || def.kind === 'file') {
    const handle: ControlHandle<string> = ctx.components.textField({
      label: def.labelKey,
      value: asString(current),
      browse: def.kind,
      onChange: (value) => {
        state.setValue(def.id, value);
        onChange();
      }
    });
    controlRoot = handle.root;
    getter = () => handle.get();
    setter = (value) => handle.set(asString(value));
    disabler = (disabled, reason) => handle.setDisabled(disabled, reason);
  } else if (def.kind === 'number') {
    const handle: ControlHandle<string> = ctx.components.textField({
      label: def.labelKey,
      value: asString(current),
      type: 'number',
      min: def.min,
      max: def.max,
      step: def.step,
      suffix: def.hintKey ? ctx.t(def.hintKey, def.hintKey) : undefined,
      onCommit: (value) => {
        const parsed = Number(value);
        state.setValue(def.id, Number.isFinite(parsed) ? parsed : def.defaultValue);
        onChange();
      }
    });
    controlRoot = handle.root;
    getter = () => {
      const parsed = Number(handle.get());
      return Number.isFinite(parsed) ? parsed : 0;
    };
    setter = (value) => handle.set(String(value));
    disabler = (disabled, reason) => handle.setDisabled(disabled, reason);
  } else {
    const handle: ControlHandle<string> = ctx.components.textField({
      label: def.labelKey,
      value: asString(current),
      onChange: (value) => {
        state.setValue(def.id, value);
        onChange();
      }
    });
    controlRoot = handle.root;
    getter = () => handle.get();
    setter = (value) => handle.set(asString(value));
    disabler = (disabled, reason) => handle.setDisabled(disabled, reason);
  }

  root.append(header, flagLine, description, controlRoot);

  function refreshAvailability(): void {
    const defaults = defaultValues();
    const changed = String(state.values[def.id]) !== String(defaults[def.id]);
    changedBadge.textContent = changed ? ctx.t('downloader.option.changed', 'Changed from default') : '';
    const reason = def.inertReason?.(state.values) ?? null;
    disabler(reason !== null, reason ?? undefined);
    const problem = def.validate?.(state.values[def.id], state.values) ?? null;
    root.classList.toggle('downloader-option-row--invalid', problem !== null);
    root.title = problem ?? '';
    void getter;
  }

  return {
    definition: def,
    root,
    set: (value) => {
      setter(value);
      refreshAvailability();
    },
    refreshAvailability,
    searchText: `${ctx.t(def.labelKey, def.labelKey)} ${def.flag} ${def.keywords.join(' ')}`.toLowerCase()
  };
}

function mountOptionsCard(ctx: TabContext, state: FeatureState): { root: HTMLElement; refresh(): void; refreshAvailability(): void } {
  const body = el('div');
  const noMatches = el('p', { className: 'md-typescale-body-medium', text: ctx.t('downloader.options.noMatches', 'No launch option matches this search.') });
  noMatches.hidden = true;
  const root = card(ctx.components.sectionHeading({ title: 'downloader.section.options', description: 'downloader.section.options.description' }), body, noMatches);
  root.id = 'downloader-options-card';

  const rows: OptionRow[] = [];
  const onAnyChange = (): void => {
    for (const r of rows) r.refreshAvailability();
  };

  for (const group of OPTION_GROUP_ORDER) {
    const groupDefs = OPTION_DEFINITIONS.filter((d) => d.group === group);
    if (groupDefs.length === 0) continue;
    const groupCard = el('div', { className: 'downloader-option-group' });
    groupCard.append(el('h3', { className: 'md-typescale-title-medium', text: ctx.t(OPTION_GROUP_TITLES[group], group) }));
    for (const def of groupDefs) {
      const r = buildOptionRow(ctx, def, state, onAnyChange);
      rows.push(r);
      groupCard.append(r.root);
    }
    body.append(groupCard);
  }

  const search = ctx.createSearchBar({
    label: 'downloader.search.options',
    sample: rows.map((r) => r.searchText).join('\n'),
    onChange: (query) => {
      let anyVisible = false;
      for (const r of rows) {
        const visible = query.matches(r.searchText);
        r.root.hidden = !visible;
        if (visible) anyVisible = true;
      }
      for (const groupEl of Array.from(body.children)) {
        if (!(groupEl instanceof HTMLElement) || !groupEl.classList.contains('downloader-option-group')) continue;
        const anyRowVisible = Array.from(groupEl.querySelectorAll<HTMLElement>('.downloader-option-row')).some((r) => !r.hidden);
        groupEl.hidden = !anyRowVisible;
      }
      noMatches.hidden = anyVisible;
    }
  });
  body.prepend(search.root);
  ctx.onDispose(() => search.destroy());

  const actions = el('div', { className: 'downloader-row' });
  actions.append(
    ctx.components.button({
      label: 'downloader.action.resetOptions',
      icon: 'refresh',
      variant: 'text',
      onClick: async (event) => {
        const approved = await ctx.confirm.request({
          action: ctx.t('downloader.action.resetOptions', 'Reset every option to its default'),
          affected: [ctx.t('downloader.section.options', 'Launch options')],
          irreversible: ctx.t('downloader.options.reset', 'Every launch option is back at its default.'),
          anchor: (event.currentTarget as HTMLElement) ?? anchorFor(root)
        });
        if (!approved) return;
        state.setValues(defaultValues());
        for (const r of rows) r.set(state.values[r.definition.id]);
        onAnyChange();
        await ctx.history.record('Reset every launch option to its default', 'downloader', {});
        ctx.notify.info(ctx.t('downloader.options.reset', 'Every launch option is back at its default.'), '');
      }
    })
  );
  body.append(actions);

  function applyValues(): void {
    for (const r of rows) r.set(state.values[r.definition.id]);
    onAnyChange();
  }

  onAnyChange();
  return { root, refresh: applyValues, refreshAvailability: onAnyChange };
}

/* ================================================================== */
/* Profiles card                                                       */
/* ================================================================== */

function mountProfilesCard(
  ctx: TabContext,
  state: FeatureState,
  onLoaded: () => void
): { root: HTMLElement; refresh(): void } {
  let profiles: DownloadProfile[] = readProfiles(ctx);
  let filtered: DownloadProfile[] = [...profiles];

  const emptyState = ctx.components.emptyState({
    title: 'downloader.profiles.empty',
    body: 'downloader.profiles.emptyBody'
  });

  const table = ctx.components.dataTable<DownloadProfile>({
    label: 'downloader.section.profiles',
    columns: [
      { id: 'name', label: 'downloader.profiles.column.name', sortable: true, value: (p) => p.name },
      { id: 'target', label: 'downloader.profiles.column.target', value: (p) => describeProfile(p) },
      { id: 'changed', label: 'downloader.profiles.column.changed', sortable: true, align: 'end', value: (p) => changedOptionIds(p.values).length },
      { id: 'updated', label: 'downloader.profiles.column.updated', sortable: true, value: (p) => formatTimestamp(p.updatedAt) }
    ],
    rows: filtered,
    rowId: (p) => p.id,
    selectable: true,
    onSelectionChange: () => refreshButtons(),
    onActivate: (profile) => loadProfile(profile),
    emptyMessage: 'downloader.profiles.empty'
  });

  const search = ctx.createSearchBar({
    label: 'downloader.search.profiles',
    sample: profiles.map((p) => `${p.name} ${p.notes} ${describeProfile(p)}`).join('\n'),
    onChange: (query) => {
      filtered = profiles.filter((p) => query.matches(`${p.name} ${p.notes} ${describeProfile(p)}`));
      table.setRows(filtered);
      refreshButtons();
    }
  });

  const selectionLine = el('p', { className: 'md-typescale-body-small' });
  const selectRow = el('div', { className: 'downloader-row' });
  const actionRow = el('div', { className: 'downloader-row' });

  const presetSelect = { current: PROFILE_PRESETS[0] as ProfilePreset };
  const presetCaption = el('p', { className: 'md-typescale-body-small' });
  const updatePresetCaption = (): void => {
    const changes = presetChanges(presetSelect.current);
    presetCaption.textContent =
      changes.length === 0
        ? ctx.t('downloader.profiles.presetSetsNothing', 'Sets nothing beyond the application’s own defaults.')
        : ctx.t('downloader.profiles.presetSets', 'Sets: {changes}', {
            values: { changes: changes.map((id) => ctx.t(optionById(id)?.labelKey ?? id, id)).join(', ') }
          });
  };
  const presetPicker = ctx.components.select({
    label: 'downloader.profiles.presets',
    options: PROFILE_PRESETS.map((p) => ({ value: p.id, label: p.nameKey })),
    value: presetSelect.current.id,
    onChange: (value) => {
      presetSelect.current = PROFILE_PRESETS.find((p) => p.id === value) ?? PROFILE_PRESETS[0];
      updatePresetCaption();
    }
  });
  updatePresetCaption();
  const applyPresetButton = ctx.components.button({
    label: 'downloader.action.applyPreset',
    icon: 'bolt',
    variant: 'text',
    onClick: async () => {
      state.setValues(presetValues(presetSelect.current));
      onLoaded();
      await ctx.history.record('Applied a launch-option preset', 'downloader', { preset: presetSelect.current.id });
    }
  });
  const presetRow = el('div', { className: 'downloader-row' }, );
  presetRow.append(presetPicker.root, applyPresetButton, presetCaption);

  const root = card(
    ctx.components.sectionHeading({ title: 'downloader.section.profiles', description: 'downloader.section.profiles.description' }),
    presetRow,
    search.root,
    table.root,
    emptyState,
    selectionLine,
    selectRow,
    actionRow
  );
  root.id = 'downloader-profiles-card';
  ctx.onDispose(() => search.destroy());

  function refreshButtons(): void {
    const selected = table.selection();
    selectionLine.textContent = ctx.t('downloader.profiles.selection', '{count} of {total} profiles selected', {
      values: { count: selected.length, total: profiles.length }
    });
    emptyState.hidden = profiles.length > 0;
    table.root.hidden = profiles.length === 0;

    selectRow.replaceChildren(
      ctx.components.button({
        label: 'downloader.action.selectAllProfiles',
        variant: 'text',
        disabled: profiles.length === 0,
        disabledReason: profiles.length === 0 ? ctx.t('downloader.profiles.empty', 'No profiles have been saved yet.') : undefined,
        onClick: () => {
          table.setSelection(profiles.map((p) => p.id));
          refreshButtons();
        }
      }),
      ctx.components.button({
        label: 'downloader.action.invertSelection',
        variant: 'text',
        onClick: () => {
          const set = new Set(table.selection());
          table.setSelection(filtered.filter((p) => !set.has(p.id)).map((p) => p.id));
          refreshButtons();
        }
      }),
      ctx.components.button({
        label: 'downloader.action.clearSelection',
        variant: 'text',
        disabled: selected.length === 0,
        disabledReason: selected.length === 0 ? ctx.t('downloader.profiles.needsSome', 'Select at least one profile first.') : undefined,
        onClick: () => {
          table.clearSelection();
          refreshButtons();
        }
      })
    );

    const single = selected.length === 1 ? profiles.find((p) => p.id === selected[0]) ?? null : null;

    actionRow.replaceChildren(
      ctx.components.button({
        label: 'downloader.action.saveProfile',
        icon: 'save',
        variant: 'tonal',
        onClick: (event) => void saveAsNewProfile(event.currentTarget as HTMLElement)
      }),
      ctx.components.button({
        label: 'downloader.action.updateProfile',
        icon: 'save',
        variant: 'text',
        disabled: single === null,
        disabledReason: single === null ? ctx.t('downloader.profiles.needsOne', 'Select exactly one profile first.') : undefined,
        onClick: () => void updateProfile(single as DownloadProfile)
      }),
      ctx.components.button({
        label: 'downloader.action.loadProfile',
        icon: 'folder',
        variant: 'text',
        disabled: single === null,
        disabledReason: single === null ? ctx.t('downloader.profiles.needsOne', 'Select exactly one profile first.') : undefined,
        onClick: () => single && loadProfile(single)
      }),
      ctx.components.button({
        label: 'downloader.action.duplicateProfile',
        icon: 'copy',
        variant: 'text',
        disabled: single === null,
        disabledReason: single === null ? ctx.t('downloader.profiles.needsOne', 'Select exactly one profile first.') : undefined,
        onClick: (event) => void duplicateSelected(single as DownloadProfile, event.currentTarget as HTMLElement)
      }),
      ctx.components.button({
        label: 'downloader.action.deleteProfiles',
        icon: 'trash',
        variant: 'text',
        danger: true,
        disabled: selected.length === 0,
        disabledReason: selected.length === 0 ? ctx.t('downloader.profiles.needsSome', 'Select at least one profile first.') : undefined,
        onClick: (event) => void deleteSelected(selected, event.currentTarget as HTMLElement)
      }),
      ctx.components.button({
        label: 'downloader.action.exportProfiles',
        icon: 'download',
        variant: 'text',
        disabled: profiles.length === 0,
        disabledReason: profiles.length === 0 ? ctx.t('downloader.profiles.empty', 'No profiles have been saved yet.') : undefined,
        onClick: () => {
          const chosen = selected.length > 0 ? profiles.filter((p) => selected.includes(p.id)) : profiles;
          void exportWithFormatPicker(ctx, profileExportRecords(chosen), 'download-profiles', 'downloader.action.exportProfiles', 'Export the profiles');
        }
      })
    );
  }

  async function persist(next: DownloadProfile[]): Promise<void> {
    profiles = next;
    writeProfiles(ctx, profiles);
    filtered = [...profiles];
    search.clear();
    table.setRows(profiles);
    refreshButtons();
  }

  function loadProfile(profile: DownloadProfile): void {
    state.setValues(profile.values);
    state.setLastProfileId(profile.id);
    onLoaded();
    ctx.notify.success(ctx.t('downloader.profiles.loaded', 'Loaded "{name}" into the options.', { values: { name: profile.name } }), '');
  }

  async function saveAsNewProfile(anchor: HTMLElement): Promise<void> {
    const body = el('div', { className: 'downloader-profile-form' });
    const name = ctx.components.textField({ label: 'downloader.profiles.name', value: '' });
    const notes = ctx.components.textField({ label: 'downloader.profiles.notes', value: '', multiline: true, rows: 3 });
    body.append(name.root, notes.root);
    const approved = await ctx.components.dialog({
      title: 'downloader.action.saveProfile',
      body,
      confirmLabel: 'downloader.action.saveProfile'
    });
    if (!approved) return;
    const profile = createProfile(name.get(), notes.get(), state.values);
    await persist([...profiles, profile]);
    state.setLastProfileId(profile.id);
    await ctx.history.record('Saved a new download profile', 'downloader', { id: profile.id, name: profile.name });
    ctx.notify.success(ctx.t('downloader.profiles.saved', 'Saved the profile "{name}".', { values: { name: profile.name } }), '');
    void anchor;
  }

  async function updateProfile(profile: DownloadProfile): Promise<void> {
    const next = profiles.map((p) =>
      p.id === profile.id ? { ...p, values: { ...state.values }, updatedAt: new Date().toISOString() } : p
    );
    await persist(next);
    await ctx.history.record('Updated a download profile', 'downloader', { id: profile.id, name: profile.name });
    ctx.notify.success(ctx.t('downloader.profiles.updated', 'Updated the profile "{name}".', { values: { name: profile.name } }), '');
  }

  async function duplicateSelected(profile: DownloadProfile, anchor: HTMLElement): Promise<void> {
    const body = el('div', { className: 'downloader-profile-form' });
    const name = ctx.components.textField({ label: 'downloader.profiles.name', value: `${profile.name} copy` });
    body.append(name.root);
    const approved = await ctx.components.dialog({
      title: 'downloader.action.duplicateProfile',
      body,
      confirmLabel: 'downloader.action.duplicateProfile'
    });
    if (!approved) return;
    const copy = duplicateProfile(profile, name.get());
    await persist([...profiles, copy]);
    await ctx.history.record('Duplicated a download profile', 'downloader', { fromId: profile.id, id: copy.id, name: copy.name });
    ctx.notify.success(ctx.t('downloader.action.duplicateProfile', 'Duplicate'), copy.name);
    void anchor;
  }

  async function deleteSelected(ids: string[], anchor: HTMLElement): Promise<void> {
    const named = profiles.filter((p) => ids.includes(p.id)).map((p) => p.name);
    const approved = await ctx.confirm.request({
      action: ctx.t('downloader.confirm.deleteProfiles', 'Delete {count} saved profiles', { values: { count: ids.length } }),
      affected: named,
      irreversible: ctx.t(
        'downloader.confirm.deleteProfiles.irreversible',
        'The profiles are removed from the settings file. Captured worlds on disk are not touched.'
      ),
      anchor
    });
    if (!approved) return;
    const removedLast = ids.includes(state.lastProfileId());
    await persist(profiles.filter((p) => !ids.includes(p.id)));
    if (removedLast) state.setLastProfileId('');
    await ctx.history.record('Deleted download profiles', 'downloader', { ids, names: named });
    ctx.notify.success(ctx.t('downloader.profiles.deleted', 'Deleted {count} profiles.', { values: { count: ids.length } }), '');
  }

  refreshButtons();
  return { root, refresh: refreshButtons };
}

/* ================================================================== */
/* Log card                                                             */
/* ================================================================== */

function mountLogCard(ctx: TabContext, state: FeatureState): { root: HTMLElement; refresh(): void } {
  const severityFilter = new Set<LogSeverity>(LOG_SEVERITIES);
  const selected = new Set<number>();
  let visibleCount = Math.max(
    20,
    Number(ctx.settings.get<number>(VISIBLE_LOG_LINES_SETTING_ID, DEFAULT_VISIBLE_LOG_LINES))
  );
  let autoScroll = true;
  let currentFiltered: LogLine[] = [];

  const list = ctx.components.list({ label: 'downloader.section.log' });
  const emptyState = ctx.components.emptyState({ title: 'downloader.log.empty', body: 'downloader.log.emptyBody' });
  const showingLine = el('p', { className: 'md-typescale-body-small' });
  const droppedLine = el('p', { className: 'md-typescale-body-small downloader-status--warn' });
  const selectionLine = el('p', { className: 'md-typescale-body-small' });
  const showMoreRow = el('div', { className: 'downloader-row' });
  const severityRow = el('div', { className: 'downloader-row' });
  const bulkRow = el('div', { className: 'downloader-row' });

  const search = ctx.createSearchBar({
    label: 'downloader.search.log',
    sample: state.session.logLines().map((l) => l.text).join('\n'),
    onChange: () => refresh()
  });

  const root = card(
    ctx.components.sectionHeading({ title: 'downloader.section.log', description: 'downloader.section.log.description' }),
    severityRow,
    search.root,
    droppedLine,
    showingLine,
    list,
    emptyState,
    showMoreRow,
    selectionLine,
    bulkRow
  );
  root.id = 'downloader-log-card';
  ctx.onDispose(() => search.destroy());

  const autoScrollSwitch = ctx.components.switchControl({
    label: 'downloader.log.autoScroll',
    checked: autoScroll,
    onChange: (value) => {
      autoScroll = value;
    }
  });

  const severityChips = LOG_SEVERITIES.map((severity) =>
    ctx.components.chip({
      label: `downloader.log.severity.${severity}`,
      selected: severityFilter.has(severity),
      onToggle: (isSelected) => {
        if (isSelected) severityFilter.add(severity);
        else severityFilter.delete(severity);
        refresh();
      }
    })
  );
  severityRow.append(
    el('span', { className: 'md-typescale-label-large', text: ctx.t('downloader.log.severityFilter', 'Severity') }),
    ...severityChips,
    autoScrollSwitch.root
  );

  function allLines(): LogLine[] {
    return state.session.logLines();
  }

  function matchesQuery(line: LogLine): boolean {
    return severityFilter.has(line.severity) && search.query().matches(line.text);
  }

  function refresh(): void {
    const total = allLines();
    currentFiltered = total.filter(matchesQuery);
    const shown = currentFiltered.slice(Math.max(0, currentFiltered.length - visibleCount));

    list.replaceChildren();
    for (const line of shown) {
      const item = ctx.components.listItem({
        headline: line.text === '' ? ' ' : line.text,
        supporting: `${formatTimestamp(line.at)} · ${ctx.t(`downloader.log.stream.${line.stream}`, line.stream)}`,
        leadingIcon: SEVERITY_ICON[line.severity],
        selectable: true,
        selected: selected.has(line.seq),
        onSelectChange: (isSelected) => {
          if (isSelected) selected.add(line.seq);
          else selected.delete(line.seq);
          refreshBulk();
        },
        id: `downloader-log-line-${line.seq}`
      });
      item.classList.add(`downloader-log-line--${line.severity}`);
      list.append(item);
    }

    emptyState.hidden = total.length > 0;
    list.hidden = total.length === 0;

    if (total.length > 0 && currentFiltered.length === 0) {
      showingLine.textContent = ctx.t('downloader.log.noMatches', 'No line matches this search.');
    } else if (currentFiltered.length > 0) {
      showingLine.textContent = ctx.t('downloader.log.showing', 'Showing the most recent {shown} of {matching} matching lines ({total} in the log).', {
        values: { shown: shown.length, matching: currentFiltered.length, total: total.length }
      });
    } else {
      showingLine.textContent = '';
    }

    const droppedCount = state.session.droppedLineCount();
    droppedLine.hidden = droppedCount === 0;
    if (droppedCount > 0) {
      droppedLine.textContent = ctx.t('downloader.log.dropped', '{count} of the oldest lines were dropped to stay within the retained-line limit.', {
        values: { count: droppedCount }
      });
    }

    showMoreRow.replaceChildren();
    if (currentFiltered.length > shown.length) {
      showMoreRow.append(
        ctx.components.button({
          label: 'downloader.log.showMore',
          variant: 'text',
          onClick: () => {
            visibleCount += Math.max(
              20,
              Number(ctx.settings.get<number>(VISIBLE_LOG_LINES_SETTING_ID, DEFAULT_VISIBLE_LOG_LINES))
            );
            refresh();
          }
        })
      );
    }

    if (autoScroll && shown.length > 0) {
      list.scrollTop = list.scrollHeight;
    }

    refreshBulk();
  }

  function refreshBulk(): void {
    selectionLine.textContent = ctx.t('downloader.log.selection', '{count} of {total} lines selected', {
      values: { count: selected.size, total: currentFiltered.length }
    });

    const shown = currentFiltered.slice(Math.max(0, currentFiltered.length - visibleCount));

    bulkRow.replaceChildren(
      ctx.components.button({
        label: ctx.t('downloader.action.selectAllShown', 'Select the {count} lines shown', { values: { count: shown.length } }),
        variant: 'text',
        onClick: () => {
          for (const line of shown) selected.add(line.seq);
          refresh();
        }
      }),
      ctx.components.button({
        label: ctx.t('downloader.action.selectAllMatches', 'Select all {count} matching lines', { values: { count: currentFiltered.length } }),
        variant: 'text',
        onClick: () => {
          for (const line of currentFiltered) selected.add(line.seq);
          refresh();
        }
      }),
      ctx.components.button({
        label: 'downloader.action.invertSelection',
        variant: 'text',
        onClick: () => {
          for (const line of currentFiltered) {
            if (selected.has(line.seq)) selected.delete(line.seq);
            else selected.add(line.seq);
          }
          refresh();
        }
      }),
      ctx.components.button({
        label: 'downloader.action.clearSelection',
        variant: 'text',
        disabled: selected.size === 0,
        disabledReason: selected.size === 0 ? ctx.t('downloader.log.needsSelection', 'Select at least one line first.') : undefined,
        onClick: () => {
          selected.clear();
          refresh();
        }
      }),
      ctx.components.button({
        label: 'downloader.action.copyLines',
        icon: 'copy',
        variant: 'text',
        disabled: selected.size === 0,
        disabledReason: selected.size === 0 ? ctx.t('downloader.log.needsSelection', 'Select at least one line first.') : undefined,
        onClick: async () => {
          const lines = allLines().filter((l) => selected.has(l.seq));
          const text = lines.map((l) => `[${l.at}] [${l.severity}] ${l.text}`).join('\n');
          try {
            await navigator.clipboard.writeText(text);
            ctx.notify.success(ctx.t('downloader.log.copied', '{count} lines are on the clipboard.', { values: { count: lines.length } }), '');
          } catch (error) {
            const reason = error instanceof Error ? error.message : String(error);
            ctx.notify.error(ctx.t('downloader.log.copyFailed', 'The clipboard refused the copy: {reason}', { values: { reason } }), '');
          }
        }
      }),
      ctx.components.button({
        label: 'downloader.action.deleteLines',
        icon: 'trash',
        variant: 'text',
        danger: true,
        disabled: selected.size === 0,
        disabledReason: selected.size === 0 ? ctx.t('downloader.log.needsSelection', 'Select at least one line first.') : undefined,
        onClick: async (event) => {
          const count = selected.size;
          const approved = await ctx.confirm.request({
            action: ctx.t('downloader.confirm.deleteLines', 'Delete {count} log lines', { values: { count } }),
            affected: [ctx.t('downloader.section.log', 'Activity log')],
            irreversible: ctx.t(
              'downloader.confirm.deleteLines.irreversible',
              'The lines are removed from this window’s activity log. The downloader’s own retained output is not affected.'
            ),
            anchor: event.currentTarget as HTMLElement
          });
          if (!approved) return;
          const removed = state.session.removeLines(selected);
          selected.clear();
          await ctx.history.record('Deleted downloader log lines', 'downloader', { count: removed });
          ctx.notify.success(ctx.t('downloader.log.deleted', '{count} lines were removed from the list.', { values: { count: removed } }), '');
          refresh();
        }
      }),
      ctx.components.button({
        label: 'downloader.action.exportLog',
        icon: 'download',
        variant: 'text',
        disabled: allLines().length === 0,
        disabledReason: allLines().length === 0 ? ctx.t('downloader.log.empty', 'Nothing has been logged yet.') : undefined,
        onClick: () => {
          const lines = selected.size > 0 ? allLines().filter((l) => selected.has(l.seq)) : currentFiltered;
          const records = lines.map((l) => ({ seq: l.seq, at: l.at, stream: l.stream, severity: l.severity, text: l.text }));
          void exportWithFormatPicker(ctx, records, 'downloader-log', 'downloader.action.exportLog', 'Export the log');
        }
      })
    );
  }

  refresh();
  return { root, refresh };
}

/* ================================================================== */
/* Entry point                                                         */
/* ================================================================== */

export function mountDownloaderPanel(host: HTMLElement, ctx: TabContext, state: FeatureState): () => void {
  const container = el('div', { className: 'downloader-panel' });
  container.append(ctx.components.topAppBar({ title: 'downloader.tab.title', subtitle: 'downloader.tab.subtitle' }));

  const runtime = mountRuntimeCard(ctx, state);
  const session = mountSessionCard(ctx, state);
  const status = mountStatusCard(ctx, state);
  const versions = mountVersionsCard(ctx, state);
  const options = mountOptionsCard(ctx, state);
  const profiles = mountProfilesCard(ctx, state, () => {
    options.refresh();
    session.refresh();
  });
  const log = mountLogCard(ctx, state);

  container.append(runtime.root, session.root, status.root, versions.root, options.root, profiles.root, log.root);
  host.append(container);

  const unsubscribe = state.onChange(() => {
    runtime.refresh();
    session.refresh();
    status.refresh();
    versions.refresh();
    log.refresh();
  });

  void state.refreshAll();

  return () => {
    unsubscribe();
  };
}
