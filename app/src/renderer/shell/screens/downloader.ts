import { el } from '../../core/a11y';
import type { AppContext, ExportFormat } from '../../core/types';
import {
  OPTION_DEFINITIONS,
  OPTION_GROUP_ORDER,
  OPTION_GROUP_TITLES,
  OPTION_IDS,
  asBoolean,
  asNumber,
  asString,
  buildArguments,
  defaultValues,
  normalizeValues,
  renderCommandLine,
  type OptionDefinition,
  type OptionGroupId,
  type OptionValue,
  type ProfileValues
} from '../../features/downloader/options';
import {
  CHUNKS_SAVED_AT_SETTING_ID,
  CHUNKS_SAVED_SETTING_ID,
  CURRENT_VALUES_SETTING_ID,
  DEFAULT_EXPORT_FORMAT,
  DEFAULT_JAVA_COMMAND,
  EXPORT_FORMAT_SETTING_ID,
  JAR_PATH_SETTING_ID,
  JAVA_COMMAND_SETTING_ID
} from '../../features/downloader/state';
import {
  countChunks,
  emptyOverview,
  emptyScan,
  formatBytes,
  formatCount,
  formatDuration,
  formatTimestamp,
  probeJar,
  probeJava,
  readOverview,
  scanWorld,
  type ChunkCount,
  type JarProbe,
  type JavaProbe,
  type OverviewStatus,
  type RegionFile,
  type WorldScan
} from '../../features/downloader/runtime';
import { classify, LOG_SEVERITIES, type LogLine, type LogSeverity } from '../../features/downloader/session';
import type { ProcessEvent, ProcessSummary } from '../../../shared/api';
import { shell } from '../index';
import type { ScreenDefinition } from '../types';
import './downloader.css';

/**
 * The Downloader screen (design lines 105-249): the M3 pill tab bar over
 * Overview / Launch options / Activity log, and the three panels underneath.
 *
 * This is chrome, not a second engine. Every real fact — Java, the jar, the
 * launch options, the world on disk, whether a download is running, and every
 * byte of its output — is read through the SAME modules
 * `features/downloader` is built on (`options.ts`, `runtime.ts`, and
 * `session.ts`'s exported pure pieces), and through the exact settings keys
 * `state.ts` already persists to. Two integration facts shape how, and are
 * worth stating rather than discovering by accident:
 *
 * 1. `features/downloader/index.ts` owns a module-private `FeatureState`
 *    singleton (its running `DownloadSession`) that is NOT exposed on
 *    `AppContext`, and this lane may not edit that file or `state.ts` to add
 *    an accessor. `shell/rail.ts`'s own Capture FAB hit the identical wall
 *    and resolved it the sanctioned way: every START and STOP here runs
 *    through the registered command-palette entries
 *    (`downloader.command.start` / `downloader.command.stop`), which close
 *    over the real singleton, so exactly one `DownloadSession` ever spawns a
 *    process no matter how many screens are open.
 * 2. Whether a download is live, and its own real output, is read WITHOUT a
 *    second `DownloadSession`: `ctx.studio.process.list()` finds the real
 *    spawned process by its exact `-jar <path>` argument (the same shape
 *    `session.ts`'s own `start()` builds), `ctx.studio.process.readOutput`
 *    supplies the retained backlog, and the shared `process:event` bus
 *    mirrors everything from then on — a read-only shadow of the one real
 *    process, classified with `session.ts`'s own exported `classify()` so
 *    severity matches exactly what the existing tab would show.
 *
 * What this cannot honestly reproduce without duplicating `session.ts`'s
 * private interpretation regexes (game version, protocol, connection phase,
 * the Microsoft device-code prompt) is left out rather than guessed at; see
 * the lane's completion report for the exact list.
 *
 * Launch options are read and written through the exact settings key
 * `state.ts`'s `FeatureState.setValue()` already writes
 * (`CURRENT_VALUES_SETTING_ID`), so a value changed here is exactly what a
 * fresh session would use. The one gap this lane cannot close without
 * touching `state.ts`: the already-running singleton keeps its own in-memory
 * copy of those values from whenever it was constructed and does not
 * subscribe to settings changes, so an edit made here will not reach an
 * `downloader.command.start` invocation until `state.ts` gains that
 * subscription (a small, surgical fix that belongs to whoever owns that
 * file) — also called out in the completion report.
 */

/* ================================================================== */
/* Small pure helpers                                                  */
/* ================================================================== */

const EXPORT_FORMATS: ExportFormat[] = ['json', 'jsonl', 'yaml', 'toml', 'xml', 'csv', 'tsv', 'markdown', 'html', 'sql'];
const DEFAULT_VISIBLE_LINES = 200;

function readValues(ctx: AppContext): ProfileValues {
  return normalizeValues(ctx.settings.get<unknown>(CURRENT_VALUES_SETTING_ID, null));
}

function writeValues(ctx: AppContext, values: ProfileValues): void {
  ctx.settings.set(CURRENT_VALUES_SETTING_ID, values);
}

function describeTarget(values: ProfileValues): { target: string; outputDir: string } {
  const host = asString(values[OPTION_IDS.serverHost]).trim();
  const port = asNumber(values[OPTION_IDS.serverPort], 25565);
  const target = host === '' ? '' : port === 25565 ? host : `${host}:${port}`;
  const outputDir = asString(values[OPTION_IDS.outputDir]).trim() || 'world';
  return { target, outputDir };
}

function currentExportFormat(ctx: AppContext): ExportFormat {
  const raw = ctx.settings.get<string>(EXPORT_FORMAT_SETTING_ID, DEFAULT_EXPORT_FORMAT);
  return (EXPORT_FORMATS as string[]).includes(raw) ? (raw as ExportFormat) : (DEFAULT_EXPORT_FORMAT as ExportFormat);
}

/** The real command line these launch options would produce, right now. */
function buildCommandLine(ctx: AppContext, values: ProfileValues, jarPath: string): string {
  const javaCommand = ctx.settings.get<string>(JAVA_COMMAND_SETTING_ID, DEFAULT_JAVA_COMMAND);
  const plan = buildArguments(values);
  return renderCommandLine(jarPath || 'world-downloader.jar', javaCommand, plan.args);
}

async function copyText(ctx: AppContext, text: string, successTitleKey: string, successFallback: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    ctx.notify.success(ctx.t(successTitleKey, successFallback), '');
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    ctx.notify.error(
      ctx.t('shell.downloader.copy.failed', 'The clipboard refused the copy'),
      ctx.t('shell.downloader.copy.failed.body', 'Exact reason: {reason}', { values: { reason } })
    );
  }
}

/**
 * Invokes a real palette command by id — the sanctioned door into the
 * module-private `FeatureState` singleton (see the file header). Reports
 * plainly, rather than silently doing nothing, when the downloader feature
 * has not registered — or has not finished initializing — yet.
 */
async function runPaletteCommand(ctx: AppContext, id: string): Promise<void> {
  const entry = ctx.registry.paletteEntries().find((candidate) => candidate.id === id);
  if (!entry || !entry.run) {
    ctx.notify.warn(
      ctx.t('shell.downloader.engineUnavailable.title', 'The downloader is not ready'),
      ctx.t('shell.downloader.engineUnavailable.body', 'The World download feature has not finished starting up yet.')
    );
    return;
  }
  await entry.run();
}

/* ================================================================== */
/* Read-only process mirror                                            */
/*                                                                      */
/* Finds the real spawned java process by its exact "-jar <path>"       */
/* argument, mirrors its retained + live output through the shared      */
/* process:event bus, and reports honest running/elapsed facts — all    */
/* without owning or spawning anything itself.                          */
/* ================================================================== */

const MAX_MIRROR_LINES = 5000;
const POLL_MS = 4000;

interface MirrorSnapshot {
  process: ProcessSummary | null;
  running: boolean;
}

class ProcessMirror {
  private readonly ctx: AppContext;
  private jarPath = '';
  private javaCommand = DEFAULT_JAVA_COMMAND;
  private trackedId: string | null = null;
  private unsubscribeEvents: (() => void) | null = null;
  private pollHandle: ReturnType<typeof setInterval> | null = null;
  private partial: Record<'stdout' | 'stderr', string> = { stdout: '', stderr: '' };
  private seq = 0;
  private dropped = 0;
  private started = false;
  lines: LogLine[] = [];
  snapshot: MirrorSnapshot = { process: null, running: false };
  private readonly listeners = new Set<() => void>();

  constructor(ctx: AppContext) {
    this.ctx = ctx;
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    for (const listener of [...this.listeners]) listener();
  }

  droppedLineCount(): number {
    return this.dropped;
  }

  removeLines(seqs: Iterable<number>): number {
    const doomed = new Set(seqs);
    if (doomed.size === 0) return 0;
    const before = this.lines.length;
    this.lines = this.lines.filter((line) => !doomed.has(line.seq));
    const removed = before - this.lines.length;
    if (removed > 0) this.emit();
    return removed;
  }

  /** Called whenever the resolved jar path (from a probe or a settings edit) changes. */
  setEngine(jarPath: string, javaCommand: string): void {
    this.jarPath = jarPath;
    this.javaCommand = javaCommand;
    if (this.started) void this.poll();
  }

  /** Forces an immediate re-check, e.g. right after a start/stop was requested. */
  refreshNow(): void {
    void this.poll();
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    void this.poll();
    this.pollHandle = setInterval(() => void this.poll(), POLL_MS);
    this.unsubscribeEvents = this.ctx.studio.events.on('process:event', (event: ProcessEvent) => {
      if (event.id !== this.trackedId) return;
      this.handle(event);
    });
  }

  dispose(): void {
    this.started = false;
    if (this.pollHandle) clearInterval(this.pollHandle);
    this.pollHandle = null;
    this.unsubscribeEvents?.();
    this.unsubscribeEvents = null;
    this.listeners.clear();
  }

  private async poll(): Promise<void> {
    if (this.jarPath.trim() === '') {
      if (this.snapshot.process !== null) {
        this.snapshot = { process: null, running: false };
        this.emit();
      }
      return;
    }
    const result = await this.ctx.studio.process.list();
    if (!result.ok) return;
    const candidates = result.value.filter(
      (candidate) =>
        candidate.command === this.javaCommand && candidate.args[0] === '-jar' && candidate.args[1] === this.jarPath
    );
    candidates.sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
    const running = candidates.find((candidate) => candidate.running);
    const chosen = running ?? candidates[0] ?? null;

    const changed =
      chosen?.id !== this.snapshot.process?.id ||
      chosen?.running !== this.snapshot.process?.running ||
      chosen?.exitCode !== this.snapshot.process?.exitCode;
    this.snapshot = { process: chosen, running: chosen?.running === true };

    if (chosen && chosen.id !== this.trackedId) {
      await this.track(chosen.id);
    } else if (!chosen && this.trackedId !== null) {
      this.trackedId = null;
    }

    if (changed) this.emit();
  }

  /** Loads the real retained backlog for a newly discovered process, then mirrors it live. */
  private async track(id: string): Promise<void> {
    this.trackedId = id;
    this.lines = [];
    this.dropped = 0;
    this.seq = 0;
    this.partial = { stdout: '', stderr: '' };
    const [stdout, stderr] = await Promise.all([
      this.ctx.studio.process.readOutput(id, 'stdout'),
      this.ctx.studio.process.readOutput(id, 'stderr')
    ]);
    if (stdout.ok) this.ingest('stdout', stdout.value);
    if (stderr.ok) this.ingest('stderr', stderr.value);
    this.emit();
  }

  private handle(event: ProcessEvent): void {
    if (event.kind === 'stdout' || event.kind === 'stderr') {
      this.ingest(event.kind, event.chunk);
      this.emit();
    } else if (event.kind === 'exit' || event.kind === 'error') {
      void this.poll();
    }
  }

  private ingest(stream: 'stdout' | 'stderr', chunk: string): void {
    const combined = this.partial[stream] + chunk;
    const parts = combined.split(/\r?\n/);
    this.partial[stream] = parts.pop() ?? '';
    for (const part of parts) {
      const text = part.replace(/\r$/, '');
      if (text === '') continue;
      this.seq += 1;
      this.lines.push({ seq: this.seq, at: new Date().toISOString(), stream, severity: classify(stream, text), text });
    }
    if (this.lines.length > MAX_MIRROR_LINES) {
      const excess = this.lines.length - MAX_MIRROR_LINES;
      this.lines.splice(0, excess);
      this.dropped += excess;
    }
  }
}

/* ================================================================== */
/* Shared engine-probe state (mount-scoped, survives a language rebuild) */
/* ================================================================== */

interface EngineState {
  java: JavaProbe | null;
  jar: JarProbe | null;
  worldScan: WorldScan;
  overview: OverviewStatus;
  scanning: boolean;
  /** 0..1, real progress from `countChunks`'s own `onProgress` callback. */
  scanProgress: number;
}

/* ================================================================== */
/* Overview panel                                                      */
/* ================================================================== */

interface OverviewDeps {
  ctx: AppContext;
  mirror: ProcessMirror;
  state: EngineState;
  onStateChange(listener: () => void): () => void;
  notifyStateChange(): void;
  refreshProbes(): Promise<void>;
  runChunkScan(): Promise<void>;
  cancelChunkScan(): void;
  goToLog(): void;
}

function buildOverviewPanel(deps: OverviewDeps): { root: HTMLElement; refresh(): void; dispose(): void } {
  const { ctx, mirror, state } = deps;

  /* ---------------- hero ---------------- */

  const heroChip = el('span', { className: 'wds-dl-hero__chip' });
  const heroFigure = el('div', { className: 'wds-dl-hero__figure' });
  const heroCountAction = el('div', { className: 'wds-dl-hero__count-action' });
  const heroLine = el('p', { className: 'wds-dl-hero__line md-typescale-body-medium' });
  const heroActions = el('div', { className: 'wds-dl-hero__actions' });
  const heroStats = el('div', { className: 'wds-dl-hero__stats' });
  const heroMain = el('div', { className: 'wds-dl-hero__main', children: [heroChip, heroFigure, heroCountAction, heroLine, heroActions] });
  const hero = el('section', { className: 'wds-dl-hero', children: [heroMain, heroStats] });

  /* ---------------- runtime card ---------------- */

  const runtimeBody = el('div', { className: 'wds-dl-card__body' });
  const runtimeCard = el('section', {
    className: 'wds-dl-card',
    children: [
      ctx.components.sectionHeading({ title: 'downloader.section.runtime', description: 'downloader.section.runtime.description' }),
      runtimeBody
    ]
  });

  /* ---------------- activity card ---------------- */

  const activityBody = el('div', { className: 'wds-dl-activity__body' });
  const activityHeader = el('div', {
    className: 'wds-dl-card__header',
    children: [
      el('b', { className: 'md-typescale-title-medium wds-dl-card__title', text: ctx.t('downloader.section.log', 'Activity log') }),
      ctx.components.button({ label: 'shell.downloader.openFullLog', variant: 'text', onClick: () => deps.goToLog() })
    ]
  });
  const activityCard = el('section', { className: 'wds-dl-card', children: [activityHeader, activityBody] });

  /* ---------------- overview map card ---------------- */

  const mapBody = el('div', { className: 'wds-dl-card__body' });
  const mapHeader = el('div', {
    className: 'wds-dl-card__header',
    children: [
      el('b', { className: 'md-typescale-title-medium wds-dl-card__title', text: ctx.t('shell.downloader.overviewMap', 'Overview map') }),
      ctx.components.button({ label: 'shell.downloader.overviewMap.open', variant: 'text', onClick: () => shell.go('map') })
    ]
  });
  const mapCard = el('section', { className: 'wds-dl-card', children: [mapHeader, mapBody] });

  const grid = el('div', { className: 'wds-dl-grid', children: [hero, activityCard, mapCard, runtimeCard] });
  const root = el('div', { className: 'wds-dl-overview', children: [grid] });

  /* ---------------- rendering ---------------- */

  let elapsedTimer: ReturnType<typeof setInterval> | null = null;
  const chunkProgress = ctx.components.linearProgress({ label: ctx.t('downloader.scan.running', 'Counting chunks…'), value: 0 });
  chunkProgress.root.hidden = true;

  function renderRuntime(): void {
    runtimeBody.replaceChildren();
    const java = state.java;
    const line = !java
      ? ctx.t('downloader.runtime.java.unknown', 'The Java runtime has not been checked yet.')
      : java.state === 'present'
        ? ctx.t('downloader.runtime.java.present', 'Java is available: {version}', { values: { version: java.versionLine } })
        : java.state === 'missing'
          ? ctx.t('downloader.runtime.java.missing', 'No Java runtime named "{command}" could be started on this machine.', { values: { command: java.command } })
          : ctx.t('downloader.runtime.java.failed', 'The Java runtime answered, but the check did not succeed: {reason}', { values: { reason: java.error ?? '' } });
    runtimeBody.append(el('p', { className: 'md-typescale-body-large', text: line }));

    const jar = state.jar;
    if (jar) {
      runtimeBody.append(
        el('p', {
          className: 'md-typescale-body-large',
          text: jar.found
            ? ctx.t('downloader.runtime.jar.found', 'Downloader jar: {path} ({size})', { values: { path: jar.path, size: formatBytes(jar.sizeBytes) } })
            : ctx.t('downloader.runtime.jar.missing', 'No world-downloader.jar was found.')
        })
      );
    }
    runtimeBody.append(
      ctx.components.button({ label: 'downloader.action.recheck', icon: 'refresh', variant: 'tonal', onClick: () => void deps.refreshProbes() })
    );
  }

  function renderMap(): void {
    mapBody.replaceChildren();
    const overview = state.overview;
    if (overview.available && overview.player) {
      mapBody.append(
        el('p', {
          className: 'md-typescale-body-large',
          text: `${ctx.t('downloader.status.player', 'Player position')}: ${overview.player.x}, ${overview.player.y}, ${overview.player.z}`
        }),
        el('p', {
          className: 'md-typescale-body-small wds-dl-muted',
          text: `${ctx.t('downloader.status.dimension', 'Dimension')}: ${overview.dimension ?? ctx.t('downloader.status.pending', 'Not reported yet')}`
        })
      );
    } else {
      mapBody.append(
        el('p', {
          className: 'md-typescale-body-medium wds-dl-muted',
          text: asBoolean(readValues(ctx)[OPTION_IDS.renderMap])
            ? ctx.t('shell.downloader.overviewMap.pending', 'No player position has been reported yet.')
            : ctx.t(
                'downloader.status.player.needsMap',
                'The player position comes from the overview map’s own status file, and map rendering is turned off for this session.'
              )
        })
      );
    }
  }

  function renderChunks(): void {
    const saved = ctx.settings.get<number | null>(CHUNKS_SAVED_SETTING_ID, null);
    const savedAt = ctx.settings.get<string | null>(CHUNKS_SAVED_AT_SETTING_ID, null);
    heroFigure.replaceChildren();
    if (saved !== null && savedAt !== null) {
      heroFigure.append(
        el('span', { className: 'wds-dl-hero__number', text: formatCount(saved) }),
        el('span', { className: 'wds-dl-hero__unit', text: ctx.t('shell.downloader.chunks.unit', 'chunks') })
      );
    } else {
      heroFigure.append(el('span', { className: 'wds-dl-hero__unknown', text: ctx.t('downloader.status.chunks.never', 'Not counted yet.') }));
    }

    heroCountAction.replaceChildren();
    if (state.scanning) {
      chunkProgress.set(state.scanProgress);
      heroCountAction.append(
        chunkProgress.root,
        ctx.components.button({ label: 'downloader.action.cancelScan', variant: 'text', onClick: () => deps.cancelChunkScan() })
      );
    } else {
      const disabled = state.worldScan.files.length === 0;
      heroCountAction.append(
        ctx.components.button({
          label: saved === null ? 'downloader.action.scanChunks' : 'downloader.action.recheck',
          icon: 'search',
          variant: 'tonal',
          disabled,
          disabledReason: disabled ? ctx.t('downloader.scan.nothing', 'There are no region files to count yet.') : undefined,
          onClick: () => void deps.runChunkScan()
        })
      );
      if (saved !== null) {
        heroCountAction.append(
          el('span', {
            className: 'md-typescale-body-small wds-dl-muted',
            text: ctx.t('shell.downloader.chunks.countedAt', 'Counted {when}', { values: { when: formatTimestamp(savedAt) } })
          })
        );
      }
    }
  }

  function renderStats(): void {
    heroStats.replaceChildren();
    const scan = state.worldScan;
    const regions = scan.files.filter((file) => file.kind === 'region').length;
    const entities = scan.files.filter((file) => file.kind === 'entities').length;
    const rows: Array<[string, string]> = [
      [ctx.t('shell.downloader.stats.regionFiles', 'Region files'), formatCount(regions)],
      [ctx.t('shell.downloader.stats.entityFiles', 'Entity files'), formatCount(entities)],
      [ctx.t('shell.downloader.stats.onDisk', 'On disk'), formatBytes(scan.totalBytes)],
      // The design's own hero sidebar shows "Containers saved", but this
      // application tracks no such count anywhere — showing one would be a
      // fabricated number, which the house rules forbid outright. Dimensions
      // actually written to disk is the nearest real fact the world scan has,
      // so it stands in that slot instead.
      [ctx.t('shell.downloader.stats.dimensions', 'Dimensions'), formatCount(scan.dimensions.length)]
    ];
    for (const [labelText, value] of rows) {
      heroStats.append(
        el('div', {
          className: 'wds-dl-hero__stat',
          children: [
            el('span', { className: 'wds-dl-hero__statlabel md-typescale-label-medium', text: labelText }),
            el('span', { className: 'wds-dl-hero__statvalue md-typescale-title-medium', text: value })
          ]
        })
      );
    }
    heroStats.append(
      el('p', {
        className: 'md-typescale-body-small wds-dl-muted',
        text: scan.lastWriteAt
          ? ctx.t('shell.downloader.stats.lastWrite', 'Last region write: {when}', { values: { when: formatTimestamp(scan.lastWriteAt) } })
          : ctx.t('shell.downloader.stats.noWrite', 'Nothing has been written to disk yet.')
      })
    );
    if (mirror.snapshot.running) {
      const progress = ctx.components.linearProgress({ label: ctx.t('shell.downloader.hero.downloading', 'Downloading…') });
      progress.root.classList.add('wds-dl-hero__sweep');
      heroStats.append(
        progress.root,
        el('span', { className: 'md-typescale-label-small wds-dl-muted', text: ctx.t('shell.downloader.hero.downloading', 'Downloading…') })
      );
    }
  }

  function renderActivity(): void {
    activityBody.replaceChildren();
    const recent = mirror.lines.slice(-7);
    if (recent.length === 0) {
      activityBody.append(el('p', { className: 'md-typescale-body-medium wds-dl-muted', text: ctx.t('downloader.log.empty', 'Nothing has been logged yet.') }));
      return;
    }
    for (const line of recent) {
      activityBody.append(
        el('div', {
          className: `wds-dl-logline wds-dl-logline--${line.severity}`,
          children: [
            el('span', { className: 'wds-dl-logline__time', text: formatTimestamp(line.at) }),
            el('span', { className: 'wds-dl-logline__text', text: line.text === '' ? ' ' : line.text })
          ]
        })
      );
    }
  }

  let actionBusy = false;

  async function onRunStop(running: boolean): Promise<void> {
    if (actionBusy) return;
    actionBusy = true;
    renderHero();
    try {
      await runPaletteCommand(ctx, running ? 'downloader.command.stop' : 'downloader.command.start');
    } finally {
      actionBusy = false;
      mirror.refreshNow();
      window.setTimeout(() => void deps.refreshProbes(), 400);
      renderHero();
    }
  }

  /**
   * Updates the chip and the sentence beneath it — cheap text mutation, safe
   * to run every second while a download is running. Deliberately never
   * touches `heroActions`: rebuilding real `<button>` elements once a second
   * would silently steal focus from whichever one the user is on, which is
   * exactly the kind of thing a screenshot never reveals and a keyboard user
   * hits immediately.
   */
  function renderHeroLine(): { target: string; outputDir: string; running: boolean } {
    const { process, running } = mirror.snapshot;
    heroChip.textContent = running ? ctx.t('shell.downloader.hero.capturing', 'Capturing') : ctx.t('shell.downloader.hero.stopped', 'Stopped');
    heroChip.classList.toggle('wds-dl-hero__chip--running', running);

    const values = readValues(ctx);
    const { target, outputDir } = describeTarget(values);
    const startedAt = process?.startedAt ?? null;
    const endedAt = process?.endedAt ?? null;
    const elapsedMs = startedAt ? Date.parse(endedAt ?? new Date().toISOString()) - Date.parse(startedAt) : 0;

    if (target === '') {
      heroLine.textContent = ctx.t('shell.downloader.hero.noServer', 'No server address is set yet. Open Launch options to add one.');
    } else if (running) {
      heroLine.textContent = ctx.t('shell.downloader.hero.running', '{target} → {output} · running {elapsed}', {
        values: { target, output: outputDir, elapsed: formatDuration(elapsedMs) }
      });
    } else if (startedAt) {
      heroLine.textContent = ctx.t('shell.downloader.hero.stoppedAfter', '{target} → {output} · stopped · last ran for {elapsed}', {
        values: { target, output: outputDir, elapsed: formatDuration(elapsedMs) }
      });
    } else {
      heroLine.textContent = ctx.t('shell.downloader.hero.neverRun', '{target} → {output} · not started yet', { values: { target, output: outputDir } });
    }
    return { target, outputDir, running };
  }

  function renderHero(): void {
    const { outputDir, running } = renderHeroLine();
    const values = readValues(ctx);

    heroActions.replaceChildren(
      ctx.components.button({
        label: running ? 'downloader.action.stop' : 'downloader.action.start',
        icon: running ? 'stop' : 'download',
        variant: 'filled',
        danger: running,
        disabled: actionBusy,
        disabledReason: actionBusy ? ctx.t('shell.downloader.hero.busy', 'A start or stop request is already in flight.') : undefined,
        onClick: () => void onRunStop(running)
      }),
      ctx.components.button({
        label: 'downloader.action.revealWorld',
        icon: 'folder',
        variant: 'tonal',
        onClick: () => void ctx.studio.shell.openPath(state.worldScan.root || outputDir)
      }),
      ctx.components.button({
        label: 'downloader.action.copyCommand',
        icon: 'copy',
        variant: 'tonal',
        onClick: () =>
          void copyText(ctx, buildCommandLine(ctx, values, state.jar?.path ?? ''), 'downloader.session.copied', 'The command line is on the clipboard.')
      })
    );

    if (elapsedTimer) clearInterval(elapsedTimer);
    elapsedTimer = running ? setInterval(() => renderHeroLine(), 1000) : null;
  }

  function refresh(): void {
    renderHero();
    renderChunks();
    renderStats();
    renderActivity();
    renderMap();
    renderRuntime();
  }

  const unsubscribeMirror = mirror.onChange(refresh);
  const unsubscribeState = deps.onStateChange(refresh);
  refresh();

  return {
    root,
    refresh,
    dispose: () => {
      unsubscribeMirror();
      unsubscribeState();
      if (elapsedTimer) clearInterval(elapsedTimer);
    }
  };
}

/* ================================================================== */
/* Launch options panel                                                */
/* ================================================================== */

interface OptionRowHandle {
  definition: OptionDefinition;
  root: HTMLElement;
  searchText: string;
  refresh(values: ProfileValues): void;
}

function describeDefaultValue(ctx: AppContext, definition: OptionDefinition): string {
  if (definition.kind === 'switch') {
    return asBoolean(definition.defaultValue) ? ctx.t('core.action.on', 'On') : ctx.t('core.action.off', 'Off');
  }
  if (definition.choices) {
    const found = definition.choices.find((choice) => choice.value === String(definition.defaultValue));
    if (found) return ctx.t(found.labelKey, found.labelKey);
  }
  const text = String(definition.defaultValue);
  return text === '' ? ctx.t('shell.downloader.option.blank', '(blank)') : text;
}

function buildOptionRow(
  ctx: AppContext,
  definition: OptionDefinition,
  getValues: () => ProfileValues,
  setValue: (id: string, value: OptionValue) => void
): OptionRowHandle {
  const root = el('div', { className: 'wds-dl-option', attrs: { id: `wds-dl-option-${definition.id}` } });

  const changedBadge = el('span', { className: 'wds-dl-badge', text: ctx.t('downloader.option.changed', 'Changed from default') });
  changedBadge.hidden = true;

  const explainBody = el('div', { className: 'wds-dl-option__explain' });
  explainBody.hidden = true;
  const description = el('p', { className: 'md-typescale-body-small', text: ctx.t(definition.descriptionKey, definition.descriptionKey) });
  const provenance = el('p', { className: 'md-typescale-body-small wds-dl-muted' });
  explainBody.append(description, provenance);

  const explainToggle = ctx.components.iconButton({
    icon: 'info',
    label: ctx.t('core.settings.explain', 'What this does'),
    onClick: () => {
      explainBody.hidden = !explainBody.hidden;
    }
  });

  const header = el('div', {
    className: 'wds-dl-option__header',
    children: [
      el('b', { className: 'md-typescale-body-large', text: ctx.t(definition.labelKey, definition.labelKey) }),
      changedBadge,
      explainToggle
    ]
  });

  const flagLine = el('p', {
    className: 'md-typescale-label-small wds-dl-option__flag',
    text: ctx.t('downloader.flagLabel', 'Command-line flag: {flag}', { values: { flag: definition.flag } })
  });

  const errorLine = el('p', { className: 'md-typescale-body-small wds-dl-error' });
  errorLine.hidden = true;

  let controlRoot: HTMLElement;
  let applyValue: (value: OptionValue) => void;
  let applyDisabled: (disabled: boolean, reason?: string) => void;

  const initial = getValues()[definition.id];

  if (definition.kind === 'switch') {
    const handle = ctx.components.switchControl({
      label: definition.labelKey,
      checked: asBoolean(initial),
      onChange: (value) => setValue(definition.id, value)
    });
    controlRoot = handle.root;
    applyValue = (value) => handle.set(asBoolean(value));
    applyDisabled = (disabled, reason) => handle.setDisabled(disabled, reason);
  } else if (definition.kind === 'select') {
    const handle = ctx.components.select({
      label: definition.labelKey,
      options: (definition.choices ?? []).map((choice) => ({ value: choice.value, label: choice.labelKey })),
      value: asString(initial),
      onChange: (value) => setValue(definition.id, value)
    });
    controlRoot = handle.root;
    applyValue = (value) => handle.set(asString(value));
    applyDisabled = (disabled, reason) => handle.setDisabled(disabled, reason);
  } else if (definition.kind === 'folder' || definition.kind === 'file') {
    const handle = ctx.components.textField({
      label: definition.labelKey,
      value: asString(initial),
      browse: definition.kind,
      onChange: (value) => setValue(definition.id, value)
    });
    controlRoot = handle.root;
    applyValue = (value) => handle.set(asString(value));
    applyDisabled = (disabled, reason) => handle.setDisabled(disabled, reason);
  } else if (
    definition.kind === 'number' &&
    (definition.id === OPTION_IDS.autoOpenPlayerRadius || definition.id === OPTION_IDS.extendedRenderDistance)
  ) {
    // The design shows a real range control for the nearby-player radius
    // specifically (line 200 of the prototype); a slider only reads well for
    // a small, evenly-steppable bound, so it is used here and for the other
    // similarly bounded numeric option, never for the wide ones (a centre
    // coordinate spans +/-30,000,000, a delay spans up to 600,000ms) where a
    // slider would have unusable granularity.
    const handle = ctx.components.slider({
      label: definition.labelKey,
      min: definition.min ?? 0,
      max: definition.max ?? 100,
      step: definition.step ?? 1,
      value: asNumber(initial, asNumber(definition.defaultValue, 0)),
      unit: definition.hintKey ? ctx.t(definition.hintKey, definition.hintKey) : undefined,
      onChange: (value) => setValue(definition.id, value)
    });
    controlRoot = handle.root;
    applyValue = (value) => handle.set(asNumber(value, 0));
    applyDisabled = (disabled, reason) => handle.setDisabled(disabled, reason);
  } else if (definition.kind === 'number') {
    const handle = ctx.components.textField({
      label: definition.labelKey,
      value: asString(initial),
      type: 'number',
      min: definition.min,
      max: definition.max,
      step: definition.step,
      suffix: definition.hintKey ? ctx.t(definition.hintKey, definition.hintKey) : undefined,
      onCommit: (value) => {
        const parsed = Number(value);
        setValue(definition.id, Number.isFinite(parsed) ? parsed : definition.defaultValue);
      }
    });
    controlRoot = handle.root;
    applyValue = (value) => handle.set(String(value));
    applyDisabled = (disabled, reason) => handle.setDisabled(disabled, reason);
  } else {
    const handle = ctx.components.textField({
      label: definition.labelKey,
      value: asString(initial),
      onChange: (value) => setValue(definition.id, value)
    });
    controlRoot = handle.root;
    applyValue = (value) => handle.set(asString(value));
    applyDisabled = (disabled, reason) => handle.setDisabled(disabled, reason);
  }

  root.append(header, flagLine, explainBody, controlRoot, errorLine);

  function refresh(values: ProfileValues): void {
    const current = values[definition.id];
    applyValue(current);
    const isDefault = String(current) === String(definition.defaultValue);
    changedBadge.hidden = isDefault;
    const defaultText = describeDefaultValue(ctx, definition);
    provenance.textContent = isDefault
      ? ctx.t('shell.downloader.option.provenance.default', 'Using the compiled-in default ({value}).', { values: { value: defaultText } })
      : ctx.t('shell.downloader.option.provenance.custom', 'Set in your launch options. The compiled-in default is {value}.', { values: { value: defaultText } });
    const reason = definition.inertReason?.(values) ?? null;
    applyDisabled(reason !== null, reason ?? undefined);
    const problem = definition.validate?.(current, values) ?? null;
    errorLine.hidden = problem === null;
    errorLine.textContent = problem ?? '';
    root.classList.toggle('wds-dl-option--invalid', problem !== null);
  }

  const searchText = `${ctx.t(definition.labelKey, definition.labelKey)} ${definition.flag} ${definition.keywords.join(' ')}`.toLowerCase();
  return { definition, root, searchText, refresh };
}

function buildOptionsPanel(ctx: AppContext, getJarPath: () => string): { root: HTMLElement; refresh(): void; dispose(): void } {
  let values = readValues(ctx);

  function setValue(id: string, value: OptionValue): void {
    values = { ...values, [id]: value };
    writeValues(ctx, values);
    refreshAll();
  }

  const rows: OptionRowHandle[] = [];
  const groupWraps = new Map<OptionGroupId, HTMLElement>();
  const groupCounts = new Map<OptionGroupId, HTMLElement>();
  const body = el('div', { className: 'wds-dl-options__groups' });

  for (const group of OPTION_GROUP_ORDER) {
    const defs = OPTION_DEFINITIONS.filter((definition) => definition.group === group);
    if (defs.length === 0) continue;
    const countSpan = el('span', { className: 'md-typescale-body-small wds-dl-muted' });
    const groupHeader = el('div', {
      className: 'wds-dl-options__groupheader',
      children: [el('b', { className: 'md-typescale-title-small', text: ctx.t(OPTION_GROUP_TITLES[group], group) }), countSpan]
    });
    const groupBody = el('div', { className: 'wds-dl-options__grouprows' });
    for (const definition of defs) {
      const row = buildOptionRow(ctx, definition, () => values, setValue);
      rows.push(row);
      groupBody.append(row.root);
    }
    const groupWrap = el('section', { className: 'wds-dl-options__group', children: [groupHeader, groupBody] });
    body.append(groupWrap);
    groupWraps.set(group, groupWrap);
    groupCounts.set(group, countSpan);
  }

  const noMatches = ctx.components.emptyState({ title: 'downloader.options.noMatches' });
  noMatches.hidden = true;

  let changedOnly = false;

  function applyFilter(): void {
    const query = search.query();
    let anyVisible = false;
    for (const row of rows) {
      const matchesText = query.matches(row.searchText);
      const matchesChanged = !changedOnly || String(values[row.definition.id]) !== String(defaultValues()[row.definition.id]);
      const visible = matchesText && matchesChanged;
      row.root.hidden = !visible;
      if (visible) anyVisible = true;
    }
    for (const wrap of groupWraps.values()) {
      const anyRow = [...wrap.querySelectorAll<HTMLElement>('.wds-dl-option')].some((rowEl) => !rowEl.hidden);
      wrap.hidden = !anyRow;
    }
    noMatches.hidden = anyVisible;
  }

  const search = ctx.createSearchBar({
    label: 'downloader.search.options',
    sample: rows.map((row) => row.searchText).join('\n'),
    onChange: () => applyFilter()
  });

  const filterSeg = ctx.components.segmentedButton({
    label: 'shell.downloader.options.filter',
    options: [
      { value: 'all', label: 'shell.downloader.options.filter.all' },
      { value: 'changed', label: 'shell.downloader.options.filter.changed' }
    ],
    value: 'all',
    onChange: (value) => {
      changedOnly = value === 'changed';
      applyFilter();
    }
  });

  const toolbar = el('div', { className: 'wds-dl-options__toolbar', children: [search.root, filterSeg.root] });

  const commandLine = el('pre', { className: 'wds-dl-commandline' });
  const commandCard = el('section', {
    className: 'wds-dl-card wds-dl-options__command',
    children: [
      el('b', { className: 'md-typescale-title-small', text: ctx.t('shell.downloader.options.commandTitle', 'The command line these options produce') }),
      commandLine,
      ctx.components.button({
        label: 'downloader.action.copyCommand',
        icon: 'copy',
        variant: 'text',
        onClick: () => void copyText(ctx, commandLine.textContent ?? '', 'downloader.session.copied', 'The command line is on the clipboard.')
      })
    ]
  });

  const resetRow = el('div', {
    className: 'wds-dl-row',
    children: [
      ctx.components.button({
        label: 'downloader.action.resetOptions',
        icon: 'refresh',
        variant: 'text',
        onClick: async (event) => {
          const approved = await ctx.confirm.request({
            action: ctx.t('downloader.action.resetOptions', 'Reset every option to its default'),
            affected: [ctx.t('downloader.section.options', 'Launch options')],
            irreversible: ctx.t('downloader.options.reset', 'Every launch option is back at its default.'),
            anchor: event.currentTarget as HTMLElement
          });
          if (!approved) return;
          values = defaultValues();
          writeValues(ctx, values);
          await ctx.history.record('Reset every launch option to its default', 'shell.downloader', {});
          refreshAll();
          ctx.notify.info(ctx.t('downloader.options.reset', 'Every launch option is back at its default.'), '');
        }
      })
    ]
  });

  const root = el('div', { className: 'wds-dl-options', children: [toolbar, body, noMatches, commandCard, resetRow] });

  function refreshAll(): void {
    for (const row of rows) row.refresh(values);
    for (const group of OPTION_GROUP_ORDER) {
      const defs = OPTION_DEFINITIONS.filter((definition) => definition.group === group);
      if (defs.length === 0) continue;
      const changed = defs.filter((definition) => String(values[definition.id]) !== String(defaultValues()[definition.id])).length;
      const countSpan = groupCounts.get(group);
      if (countSpan) {
        countSpan.textContent = ctx.t('shell.downloader.options.groupCount', '{count} options · {changed} changed', {
          values: { count: defs.length, changed }
        });
      }
    }
    commandLine.textContent = buildCommandLine(ctx, values, getJarPath());
    applyFilter();
  }

  const unsubscribeSettings = ctx.settings.onChange((change) => {
    if (change.id !== CURRENT_VALUES_SETTING_ID) return;
    values = readValues(ctx);
    refreshAll();
  });

  refreshAll();

  return {
    root,
    refresh: refreshAll,
    dispose: () => {
      unsubscribeSettings();
      search.destroy();
    }
  };
}

/* ================================================================== */
/* Activity log panel                                                  */
/* ================================================================== */

function buildLogPanel(ctx: AppContext, mirror: ProcessMirror): { root: HTMLElement; refresh(): void; dispose(): void } {
  // Matches the design's own default (line ~1225 of the prototype's model):
  // error, warning and notice start on; information starts off.
  const severityFilter = new Set<LogSeverity>(['error', 'warning', 'notice']);
  const selected = new Set<number>();
  let autoScroll = true;
  let visibleCount = DEFAULT_VISIBLE_LINES;
  let currentFiltered: LogLine[] = [];

  const list = ctx.components.list({ label: 'downloader.section.log' });
  const emptyState = ctx.components.emptyState({ title: 'downloader.log.empty', body: 'downloader.log.emptyBody' });
  const showingLine = el('p', { className: 'md-typescale-body-small wds-dl-muted' });
  const droppedLine = el('p', { className: 'md-typescale-body-small wds-dl-error' });
  const selectionLine = el('p', { className: 'md-typescale-body-small wds-dl-muted' });
  const showMoreRow = el('div', { className: 'wds-dl-row' });
  const severityRow = el('div', { className: 'wds-dl-row' });
  const bulkRow = el('div', { className: 'wds-dl-row' });

  const search = ctx.createSearchBar({
    label: 'downloader.search.log',
    sample: mirror.lines.map((line) => line.text).join('\n'),
    onChange: () => refresh()
  });

  const followSwitch = ctx.components.switchControl({
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
    followSwitch.root
  );

  const root = el('div', {
    className: 'wds-dl-log',
    children: [severityRow, search.root, droppedLine, showingLine, list, emptyState, showMoreRow, selectionLine, bulkRow]
  });

  function matchesQuery(line: LogLine): boolean {
    return severityFilter.has(line.severity) && search.query().matches(line.text);
  }

  function refresh(): void {
    const total = mirror.lines;
    currentFiltered = total.filter(matchesQuery);
    const shown = currentFiltered.slice(Math.max(0, currentFiltered.length - visibleCount));

    list.replaceChildren();
    for (const line of shown) {
      const item = ctx.components.listItem({
        headline: line.text === '' ? ' ' : line.text,
        supporting: `${formatTimestamp(line.at)} · ${ctx.t(`downloader.log.stream.${line.stream}`, line.stream)}`,
        selectable: true,
        selected: selected.has(line.seq),
        onSelectChange: (isSelected) => {
          if (isSelected) selected.add(line.seq);
          else selected.delete(line.seq);
          refreshBulk();
        },
        id: `wds-dl-logline-${line.seq}`
      });
      item.classList.add(`wds-dl-logrow--${line.severity}`);
      list.append(item);
    }

    emptyState.hidden = total.length > 0;
    list.hidden = total.length === 0;

    if (total.length > 0 && currentFiltered.length === 0) {
      showingLine.textContent = ctx.t('downloader.log.noMatches', 'No line matches this search.');
    } else if (currentFiltered.length > 0) {
      showingLine.textContent = ctx.t(
        'downloader.log.showing',
        'Showing the most recent {shown} of {matching} matching lines ({total} in the log).',
        { values: { shown: shown.length, matching: currentFiltered.length, total: total.length } }
      );
    } else {
      showingLine.textContent = '';
    }

    const dropped = mirror.droppedLineCount();
    droppedLine.hidden = dropped === 0;
    if (dropped > 0) {
      droppedLine.textContent = ctx.t('downloader.log.dropped', '{count} of the oldest lines were dropped to stay within the retained-line limit.', {
        values: { count: dropped }
      });
    }

    showMoreRow.replaceChildren();
    if (currentFiltered.length > shown.length) {
      showMoreRow.append(
        ctx.components.button({
          label: 'downloader.log.showMore',
          variant: 'text',
          onClick: () => {
            visibleCount += DEFAULT_VISIBLE_LINES;
            refresh();
          }
        })
      );
    }

    if (autoScroll && shown.length > 0) list.scrollTop = list.scrollHeight;

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
        onClick: () => void copySelected()
      }),
      ctx.components.button({
        label: 'downloader.action.exportLog',
        icon: 'download',
        variant: 'text',
        disabled: mirror.lines.length === 0,
        disabledReason: mirror.lines.length === 0 ? ctx.t('downloader.log.empty', 'Nothing has been logged yet.') : undefined,
        onClick: () => void exportView()
      }),
      ctx.components.button({
        label: 'downloader.action.deleteLines',
        icon: 'trash',
        variant: 'text',
        danger: true,
        disabled: selected.size === 0,
        disabledReason: selected.size === 0 ? ctx.t('downloader.log.needsSelection', 'Select at least one line first.') : undefined,
        onClick: (event) => void deleteSelected(event.currentTarget as HTMLElement)
      })
    );
  }

  async function copySelected(): Promise<void> {
    const lines = mirror.lines.filter((line) => selected.has(line.seq));
    const text = lines.map((line) => `[${line.at}] [${line.severity}] ${line.text}`).join('\n');
    await copyText(ctx, text, 'downloader.log.copied', '{count} lines are on the clipboard.');
  }

  /** Exports whatever is currently on screen: the selection when one exists, else the filtered/shown view. */
  async function exportView(): Promise<void> {
    const lines = selected.size > 0 ? mirror.lines.filter((line) => selected.has(line.seq)) : currentFiltered;
    const records = lines.map((line) => ({ seq: line.seq, at: line.at, stream: line.stream, severity: line.severity, text: line.text }));
    const format = currentExportFormat(ctx);
    const preflight = ctx.exporter.preflight(records, format);
    if (preflight.losses.length > 0) {
      ctx.notify.warn(
        ctx.t('downloader.export.format', 'Export format'),
        ctx.t('downloader.export.losses', '{format} cannot carry these fields faithfully: {fields}', {
          values: { format: format.toUpperCase(), fields: preflight.losses.map((loss) => `${loss.field} (${loss.reason})`).join(', ') }
        })
      );
    }
    const path = await ctx.exporter.save(records, format, { name: 'downloader-log', defaultFileName: `downloader-log.${format}` });
    if (path) ctx.notify.success(ctx.t('downloader.export.saved', 'Written to {path}', { values: { path } }), '');
    else ctx.notify.info(ctx.t('downloader.export.cancelled', 'Nothing was written.'), '');
  }

  async function deleteSelected(anchor: HTMLElement): Promise<void> {
    const count = selected.size;
    const approved = await ctx.confirm.request({
      action: ctx.t('downloader.confirm.deleteLines', 'Delete {count} log lines', { values: { count } }),
      affected: [ctx.t('downloader.section.log', 'Activity log')],
      irreversible: ctx.t(
        'shell.downloader.log.deleteIrreversible',
        'The lines are removed from this mirrored view only. Nothing the downloader itself retains on disk is affected.'
      ),
      anchor
    });
    if (!approved) return;
    const removed = mirror.removeLines(selected);
    selected.clear();
    await ctx.history.record('Deleted downloader activity-log lines from this view', 'shell.downloader', { count: removed });
    ctx.notify.success(ctx.t('downloader.log.deleted', '{count} lines were removed from the list.', { values: { count: removed } }), '');
    refresh();
  }

  const unsubscribeMirror = mirror.onChange(refresh);
  refresh();

  return {
    root,
    refresh,
    dispose: () => {
      unsubscribeMirror();
      search.destroy();
    }
  };
}

/* ================================================================== */
/* Pill tab bar                                                        */
/* ================================================================== */

type PillTab = 'overview' | 'options' | 'log';

/* ================================================================== */
/* Screen definition                                                   */
/* ================================================================== */

const screen: ScreenDefinition = {
  id: 'downloader',
  title: 'shell.screen.downloader.title',
  subtitle: 'shell.screen.downloader.subtitle',
  icon: 'download',
  rail: 1,
  mount(host: HTMLElement, ctx: AppContext): () => void {
    const mirror = new ProcessMirror(ctx);
    const state: EngineState = {
      java: null,
      jar: null,
      worldScan: emptyScan(''),
      overview: emptyOverview(),
      scanning: false,
      scanProgress: 0
    };
    let cancelScan = false;
    const stateListeners = new Set<() => void>();
    const onStateChange = (listener: () => void): (() => void) => {
      stateListeners.add(listener);
      return () => stateListeners.delete(listener);
    };
    const notifyStateChange = (): void => {
      for (const listener of [...stateListeners]) listener();
    };

    async function refreshProbes(): Promise<void> {
      const javaCommand = ctx.settings.get<string>(JAVA_COMMAND_SETTING_ID, DEFAULT_JAVA_COMMAND);
      const configuredJar = ctx.settings.get<string>(JAR_PATH_SETTING_ID, '');
      const [java, jar] = await Promise.all([probeJava(ctx, javaCommand), probeJar(ctx, configuredJar)]);
      state.java = java;
      state.jar = jar;
      const resolvedJarPath = jar.found && jar.path !== '' ? jar.path : configuredJar.trim();
      mirror.setEngine(resolvedJarPath, javaCommand);
      notifyStateChange();
    }

    async function refreshWorld(): Promise<void> {
      const values = readValues(ctx);
      const root = describeTarget(values).outputDir;
      const [scan, overview] = await Promise.all([scanWorld(ctx, root), readOverview(ctx, root)]);
      state.worldScan = scan;
      state.overview = overview;
      notifyStateChange();
    }

    async function runChunkScan(): Promise<void> {
      state.scanning = true;
      state.scanProgress = 0;
      cancelScan = false;
      notifyStateChange();
      const files: RegionFile[] = state.worldScan.files;
      const result: ChunkCount = await countChunks(
        ctx,
        files,
        (done, total) => {
          state.scanProgress = total > 0 ? done / total : 0;
          notifyStateChange();
        },
        () => cancelScan
      );
      state.scanning = false;
      if (!result.cancelled && !result.error) {
        ctx.settings.set(CHUNKS_SAVED_SETTING_ID, result.chunks);
        ctx.settings.set(CHUNKS_SAVED_AT_SETTING_ID, result.countedAt);
      }
      notifyStateChange();
    }

    function cancelChunkScan(): void {
      cancelScan = true;
    }

    const params = shell.params();
    let activeTab: PillTab = params.tab === 'options' || params.tab === 'log' ? params.tab : 'overview';

    const panelHost = el('div', { className: 'wds-dl-panelhost' });
    let disposePanels: (() => void) | null = null;

    function updateSubtitle(): void {
      const values = readValues(ctx);
      const { target } = describeTarget(values);
      const saved = ctx.settings.get<number | null>(CHUNKS_SAVED_SETTING_ID, null);
      const text = mirror.snapshot.running
        ? ctx.t('shell.downloader.subtitle.running', 'Capturing {target}', {
            values: { target: target || ctx.t('shell.downloader.subtitle.noTarget', 'no server set') }
          })
        : saved !== null
          ? ctx.t('shell.downloader.subtitle.stoppedCounted', 'Stopped · {count} chunks on disk', { values: { count: formatCount(saved) } })
          : ctx.t('shell.downloader.subtitle.stopped', 'Stopped');
      shell.setSubtitle('downloader', text);
    }

    function applyActiveTab(id: PillTab): void {
      activeTab = id;
      for (const panel of panelHost.children) {
        (panel as HTMLElement).hidden = panel.getAttribute('data-pill') !== id;
      }
    }

    function renderShell(): void {
      disposePanels?.();
      host.textContent = '';

      const tabBar = ctx.components.tabBar({
        tabs: [
          { id: 'overview', label: ctx.t('shell.downloader.tab.overview', 'Overview') },
          { id: 'options', label: ctx.t('shell.downloader.tab.options', 'Launch options') },
          { id: 'log', label: ctx.t('shell.downloader.tab.log', 'Activity log') }
        ],
        active: activeTab,
        onChange: (id) => applyActiveTab(id as PillTab)
      });
      const tabBarWrap = el('div', { className: 'wds-dl-pilltabs', children: [tabBar] });

      const overviewPanel = buildOverviewPanel({
        ctx,
        mirror,
        state,
        onStateChange,
        notifyStateChange,
        refreshProbes,
        runChunkScan,
        cancelChunkScan,
        goToLog: () => applyActiveTab('log')
      });
      const optionsPanel = buildOptionsPanel(ctx, () => state.jar?.path ?? '');
      const logPanel = buildLogPanel(ctx, mirror);

      overviewPanel.root.setAttribute('data-pill', 'overview');
      optionsPanel.root.setAttribute('data-pill', 'options');
      logPanel.root.setAttribute('data-pill', 'log');

      panelHost.replaceChildren();
      panelHost.append(overviewPanel.root, optionsPanel.root, logPanel.root);
      applyActiveTab(activeTab);

      host.append(tabBarWrap, panelHost);

      disposePanels = () => {
        overviewPanel.dispose();
        optionsPanel.dispose();
        logPanel.dispose();
      };
    }

    renderShell();
    void refreshProbes();
    void refreshWorld();
    mirror.start();

    // The real engine polls the world folder every few seconds while a
    // download is running (`state.ts`'s own `startPolling`) so the on-disk
    // figures stay live rather than frozen at whatever they read at mount.
    // This screen cannot share that timer (it belongs to the module-private
    // singleton), so it keeps its own, at the same cadence, reading the same
    // real directory through the same `scanWorld`/`readOverview` calls.
    const worldPollHandle = window.setInterval(() => void refreshWorld(), 5000);

    const unsubscribeI18n = ctx.i18n.onChange(() => renderShell());
    const unsubscribeMirrorSubtitle = mirror.onChange(updateSubtitle);
    const unsubscribeStateSubtitle = onStateChange(updateSubtitle);
    const unsubscribeSettingsSubtitle = ctx.settings.onChange((change) => {
      if (change.id === CHUNKS_SAVED_SETTING_ID || change.id === CURRENT_VALUES_SETTING_ID) updateSubtitle();
    });
    updateSubtitle();

    return () => {
      window.clearInterval(worldPollHandle);
      unsubscribeI18n();
      unsubscribeMirrorSubtitle();
      unsubscribeStateSubtitle();
      unsubscribeSettingsSubtitle();
      stateListeners.clear();
      disposePanels?.();
      mirror.dispose();
    };
  }
};

export default screen;
