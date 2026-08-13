import type { AppContext } from '../../core/registry';
import {
  OPTION_IDS,
  buildArguments,
  normalizeValues,
  renderCommandLine,
  type ArgumentPlan,
  type ProfileValues
} from './options';
import { DownloadSession, idleStatus, type SessionStatus } from './session';
import {
  emptyOverview,
  emptyScan,
  probeJar,
  probeJava,
  readOverview,
  scanWorld,
  unknownJava,
  type JarProbe,
  type JavaProbe,
  type OverviewStatus,
  type WorldScan
} from './runtime';
import { LAST_PROFILE_SETTING_ID, readProfiles } from './profiles';

/**
 * Everything the downloader tab and its settings share: the values currently
 * being edited, the running session, and the last-known state of the machine
 * (Java, the jar, the output world). One instance is created in `init` and
 * every mount reads from it, so switching tabs never loses in-flight edits or
 * restarts a running download.
 */

export const CURRENT_VALUES_SETTING_ID = 'downloader.currentValues';
export const JAVA_COMMAND_SETTING_ID = 'downloader.settings.javaCommand';
export const JAR_PATH_SETTING_ID = 'downloader.settings.jarPath';
export const WORKING_DIRECTORY_SETTING_ID = 'downloader.settings.workingDirectory';
export const MAX_LOG_LINES_SETTING_ID = 'downloader.settings.maxLogLines';
export const VISIBLE_LOG_LINES_SETTING_ID = 'downloader.settings.visibleLogLines';
export const POLL_SECONDS_SETTING_ID = 'downloader.settings.pollSeconds';
export const EXPORT_FORMAT_SETTING_ID = 'downloader.settings.exportFormat';

/**
 * The last real chunk count, published to the shared settings store so the
 * application's persistent status bar (`core/main.ts`) can show it without the
 * core depending on this feature's own types — settings are the one namespace
 * every part of the application already shares. Written only from a genuine,
 * on-disk count (see `panel.ts`'s "Count now" action); the status bar shows
 * "not counted yet" rather than a fabricated live figure until then, exactly
 * as the panel itself already does.
 */
export const CHUNKS_SAVED_SETTING_ID = 'downloader.status.chunksSaved';
export const CHUNKS_SAVED_AT_SETTING_ID = 'downloader.status.chunksSavedAt';

export const DEFAULT_JAVA_COMMAND = 'java';
export const DEFAULT_MAX_LOG_LINES = 5000;
export const DEFAULT_VISIBLE_LOG_LINES = 200;
export const DEFAULT_POLL_SECONDS = 5;
export const DEFAULT_EXPORT_FORMAT = 'json';

/** The spawn's own byte ceiling. Independent of the retained-line count. */
const MAX_OUTPUT_BYTES = 16 * 1024 * 1024;

type Listener = () => void;

export interface StartFailure {
  kind: 'problems' | 'needsJava' | 'needsJar' | 'session';
  message: string;
}

export class FeatureState {
  readonly ctx: AppContext;
  readonly session: DownloadSession;

  values: ProfileValues;
  javaProbe: JavaProbe;
  jarProbe: JarProbe;
  worldScan: WorldScan;
  overview: OverviewStatus;

  private pollHandle: ReturnType<typeof setInterval> | null = null;
  private readonly listeners = new Set<Listener>();
  private disposed = false;

  constructor(ctx: AppContext) {
    this.ctx = ctx;
    this.session = new DownloadSession(ctx, () =>
      Number(ctx.settings.get<number>(MAX_LOG_LINES_SETTING_ID, DEFAULT_MAX_LOG_LINES))
    );
    this.values = normalizeValues(ctx.settings.get<unknown>(CURRENT_VALUES_SETTING_ID, null));
    this.javaProbe = unknownJava(ctx.settings.get<string>(JAVA_COMMAND_SETTING_ID, DEFAULT_JAVA_COMMAND));
    this.jarProbe = { path: '', found: false, sizeBytes: 0, modifiedAt: null, origin: 'none', searched: [] };
    this.worldScan = emptyScan('');
    this.overview = emptyOverview();

    this.session.onStatusChange(() => {
      this.handleStatusChange(this.session.snapshot());
      this.emit();
    });
    this.session.onLogChange(() => this.emit());
  }

  /* ---------------- subscription ---------------- */

  onChange(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }

  /* ---------------- values ---------------- */

  setValues(values: ProfileValues, persist = true): void {
    this.values = { ...values };
    if (persist) this.ctx.settings.set(CURRENT_VALUES_SETTING_ID, this.values);
    this.emit();
  }

  setValue(id: string, value: ProfileValues[string]): void {
    this.values = { ...this.values, [id]: value };
    this.ctx.settings.set(CURRENT_VALUES_SETTING_ID, this.values);
    this.emit();
  }

  lastProfileId(): string {
    return this.ctx.settings.get<string>(LAST_PROFILE_SETTING_ID, '');
  }

  setLastProfileId(id: string): void {
    this.ctx.settings.set(LAST_PROFILE_SETTING_ID, id);
  }

  /** Whether the current values still match the last-loaded profile exactly. */
  matchesLastProfile(): boolean {
    const id = this.lastProfileId();
    if (id === '') return false;
    const profile = readProfiles(this.ctx).find((candidate) => candidate.id === id);
    if (!profile) return false;
    return JSON.stringify(profile.values) === JSON.stringify(this.values);
  }

  /* ---------------- runtime probes ---------------- */

  async refreshJava(): Promise<void> {
    const command = this.ctx.settings.get<string>(JAVA_COMMAND_SETTING_ID, DEFAULT_JAVA_COMMAND);
    this.javaProbe = { ...this.javaProbe, command, state: 'checking' };
    this.emit();
    this.javaProbe = await probeJava(this.ctx, command);
    this.emit();
  }

  async refreshJar(): Promise<void> {
    const configured = this.ctx.settings.get<string>(JAR_PATH_SETTING_ID, '');
    this.jarProbe = await probeJar(this.ctx, configured);
    this.emit();
  }

  async refreshWorld(): Promise<void> {
    const root = String(this.values[OPTION_IDS.outputDir] ?? '').trim();
    const [scan, overview] = await Promise.all([scanWorld(this.ctx, root), readOverview(this.ctx, root)]);
    this.worldScan = scan;
    this.overview = overview;
    this.emit();
  }

  async refreshAll(): Promise<void> {
    await Promise.all([this.refreshJava(), this.refreshJar(), this.refreshWorld()]);
  }

  /* ---------------- the plan ---------------- */

  plan(): ArgumentPlan {
    return buildArguments(this.values);
  }

  commandLine(): string {
    const javaCommand = this.ctx.settings.get<string>(JAVA_COMMAND_SETTING_ID, DEFAULT_JAVA_COMMAND);
    const jarPath =
      this.jarProbe.found && this.jarProbe.path !== ''
        ? this.jarProbe.path
        : this.ctx.settings.get<string>(JAR_PATH_SETTING_ID, '').trim() || 'world-downloader.jar';
    return renderCommandLine(jarPath, javaCommand, this.plan().args);
  }

  /* ---------------- lifecycle ---------------- */

  async start(): Promise<StartFailure | null> {
    const plan = this.plan();
    if (plan.problems.length > 0) {
      return { kind: 'problems', message: plan.problems[0].message };
    }
    if (this.javaProbe.state !== 'present') {
      return { kind: 'needsJava', message: this.javaProbe.error ?? '' };
    }
    if (!this.jarProbe.found) {
      return { kind: 'needsJar', message: '' };
    }

    const javaCommand = this.ctx.settings.get<string>(JAVA_COMMAND_SETTING_ID, DEFAULT_JAVA_COMMAND);
    const workingDirectory = this.ctx.settings.get<string>(WORKING_DIRECTORY_SETTING_ID, '');

    const outcome = await this.session.start({
      javaCommand,
      jarPath: this.jarProbe.path,
      args: plan.args,
      workingDirectory,
      maxOutputBytes: MAX_OUTPUT_BYTES
    });
    if (!outcome.started) return { kind: 'session', message: outcome.reason };
    return null;
  }

  async stop(): Promise<StartFailure | null> {
    const outcome = await this.session.stop();
    if (!outcome.started) return { kind: 'session', message: outcome.reason };
    return null;
  }

  private handleStatusChange(status: SessionStatus): void {
    const running = status.phase === 'starting' || status.phase === 'running' || status.phase === 'stopping';
    if (running) this.startPolling();
    else {
      this.stopPolling();
      void this.refreshWorld();
    }
  }

  private startPolling(): void {
    if (this.pollHandle !== null) return;
    const seconds = Math.max(
      1,
      Number(this.ctx.settings.get<number>(POLL_SECONDS_SETTING_ID, DEFAULT_POLL_SECONDS))
    );
    this.pollHandle = setInterval(() => void this.refreshWorld(), seconds * 1000);
    void this.refreshWorld();
  }

  private stopPolling(): void {
    if (this.pollHandle === null) return;
    clearInterval(this.pollHandle);
    this.pollHandle = null;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stopPolling();
    this.session.dispose();
    this.listeners.clear();
  }
}

export function statusSnapshot(state: FeatureState): SessionStatus {
  return state.session.snapshot() ?? idleStatus();
}
