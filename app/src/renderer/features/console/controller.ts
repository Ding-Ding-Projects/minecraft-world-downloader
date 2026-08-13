import type { AppContext } from '../../core/registry';
import type { ProcessEvent } from '../../../shared/api';
import {
  consoleApi,
  type AccountStatus,
  type BotStatus,
  type ConsoleCall,
  type DownloaderStatus,
  type WorldInfo
} from './client';
import {
  CONSOLE_OPTIONS,
  defaultConfig,
  normalizeConfig,
  type ConsoleConfig
} from './options';
import {
  inspectInstallation,
  installRequirements,
  joinPath,
  normalizePythonCommand,
  planStart,
  separatorFor,
  startService,
  type InstallationReport,
  type PythonCommand,
  type ServiceSnapshot,
  type ServiceState
} from './service';
import { CONSOLE_PASSWORD_ACCOUNT, CONSOLE_SETTINGS } from './settingsIds';
import {
  listDataRecords,
  scanWorlds,
  type DataRecord,
  type WorldRecord
} from './worlds';

/**
 * One place that knows what the console is doing.
 *
 * Six sections of the surface all need the same facts — is the service up, what
 * is the downloader doing, which account is signed in, what is in the data
 * directory — and each fetching them separately would produce a surface whose
 * halves disagree. The controller owns the state, the timers and the child
 * process, and every section renders from a snapshot it is handed.
 *
 * Nothing here reports an outcome it has not observed. A probe that has not run
 * yet is `unconfigured` rather than `stopped`, an operation that failed keeps
 * its exact error, and a measurement that hit its bound is marked as a floor.
 */

export type LogSource = 'service' | 'downloader' | 'bot';

export interface LogBuffer {
  lines: string[];
  /** The console's monotonic cursor, so a fetch only asks for what is new. */
  cursor: number;
  error: string | null;
  /** True once at least one successful fetch has happened. */
  loaded: boolean;
}

export interface WorldScanState {
  running: boolean;
  completed: number;
  total: number;
  current: string;
}

export interface ConsoleState {
  installation: InstallationReport;
  service: ServiceSnapshot;
  /** Set while a privileged operation is in flight, naming what it is. */
  busy: string | null;
  downloader: DownloaderStatus | null;
  downloaderError: string | null;
  bot: BotStatus | null;
  account: AccountStatus | null;
  accountError: string | null;
  worldInfo: WorldInfo | null;
  config: ConsoleConfig;
  savedConfig: ConsoleConfig;
  configSource: 'console' | 'file' | 'defaults';
  configError: string | null;
  worlds: WorldRecord[];
  worldsError: string | null;
  worldsSkipped: string[];
  worldScan: WorldScanState;
  records: DataRecord[];
  logs: Record<LogSource, LogBuffer>;
  vaultAvailable: boolean;
  vaultBackend: string;
  passwordStored: boolean;
  /** Grows every time the state changes, so a renderer can skip stale work. */
  revision: number;
}

function emptyBuffer(): LogBuffer {
  return { lines: [], cursor: 0, error: null, loaded: false };
}

function nowIso(): string {
  return new Date().toISOString();
}

export class ConsoleController {
  private readonly ctx: AppContext;

  private listeners = new Set<(state: ConsoleState) => void>();

  private state: ConsoleState;

  private probeTimer: number | null = null;

  private logTimer: number | null = null;

  private unsubscribeProcess: (() => void) | null = null;

  private unsubscribeSettings: (() => void) | null = null;

  /** Process id of the console service this application started, if any. */
  private serviceProcessId: string | null = null;

  /** Process id of a dependency installation, if one is running. */
  private installProcessId: string | null = null;

  private scanToken = 0;

  private disposed = false;

  constructor(ctx: AppContext) {
    this.ctx = ctx;
    this.state = {
      installation: {
        state: 'unset',
        directory: '',
        appPath: '',
        authPath: '',
        requirementsPath: '',
        templatesPath: '',
        hasApp: false,
        hasAuth: false,
        hasRequirements: false,
        hasTemplates: false,
        appBytes: 0,
        checks: []
      },
      service: {
        state: 'unconfigured',
        detail: 'Nothing has been checked yet.',
        owned: false,
        observedAt: nowIso()
      },
      busy: null,
      downloader: null,
      downloaderError: null,
      bot: null,
      account: null,
      accountError: null,
      worldInfo: null,
      config: defaultConfig(),
      savedConfig: defaultConfig(),
      configSource: 'defaults',
      configError: null,
      worlds: [],
      worldsError: null,
      worldsSkipped: [],
      worldScan: { running: false, completed: 0, total: 0, current: '' },
      records: [],
      logs: { service: emptyBuffer(), downloader: emptyBuffer(), bot: emptyBuffer() },
      vaultAvailable: false,
      vaultBackend: 'unknown',
      passwordStored: false,
      revision: 0
    };
  }

  /* ---------------- subscription ---------------- */

  subscribe(listener: (state: ConsoleState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  snapshot(): ConsoleState {
    return this.state;
  }

  private patch(patch: Partial<ConsoleState>): void {
    if (this.disposed) return;
    this.state = { ...this.state, ...patch, revision: this.state.revision + 1 };
    for (const listener of [...this.listeners]) listener(this.state);
  }

  /* ---------------- settings ---------------- */

  get port(): number {
    const raw = Number(this.ctx.settings.get(CONSOLE_SETTINGS.port, 8080));
    return Number.isFinite(raw) && raw >= 1 && raw <= 65535 ? Math.floor(raw) : 8080;
  }

  get serviceDirectory(): string {
    return String(this.ctx.settings.get(CONSOLE_SETTINGS.serviceDirectory, '') ?? '').trim();
  }

  get dataDirectory(): string {
    return String(this.ctx.settings.get(CONSOLE_SETTINGS.dataDirectory, '') ?? '').trim();
  }

  get jarPath(): string {
    return String(this.ctx.settings.get(CONSOLE_SETTINGS.jarPath, '') ?? '').trim();
  }

  get python(): PythonCommand {
    return normalizePythonCommand(this.ctx.settings.get(CONSOLE_SETTINGS.pythonCommand, 'py'));
  }

  get requireLogin(): boolean {
    return this.ctx.settings.get<boolean>(CONSOLE_SETTINGS.requireLogin, false) === true;
  }

  get consoleUsername(): string {
    return String(this.ctx.settings.get(CONSOLE_SETTINGS.consoleUsername, 'admin') ?? 'admin').trim() || 'admin';
  }

  get logRetention(): number {
    const raw = Number(this.ctx.settings.get(CONSOLE_SETTINGS.logRetention, 2000));
    return Number.isFinite(raw) && raw >= 100 ? Math.floor(raw) : 2000;
  }

  /** The world folder the saved configuration writes into. */
  get currentWorldName(): string {
    return String(this.state.savedConfig.worldOutputDir ?? 'world').trim() || 'world';
  }

  /* ---------------- lifecycle ---------------- */

  async attach(): Promise<void> {
    this.unsubscribeProcess = this.ctx.studio.events.on('process:event', (event) => this.onProcessEvent(event));
    this.unsubscribeSettings = this.ctx.settings.onChange((change) => {
      if (
        change.id === CONSOLE_SETTINGS.serviceDirectory ||
        change.id === CONSOLE_SETTINGS.port ||
        change.id === CONSOLE_SETTINGS.dataDirectory
      ) {
        void this.refreshAll();
      }
      if (change.id === CONSOLE_SETTINGS.autoProbe || change.id === CONSOLE_SETTINGS.probeSeconds) {
        this.restartTimers();
      }
      if (change.id === CONSOLE_SETTINGS.logSeconds) this.restartTimers();
    });
    await this.refreshVault();
    await this.refreshAll();
    this.restartTimers();
  }

  dispose(): void {
    this.disposed = true;
    this.stopTimers();
    this.unsubscribeProcess?.();
    this.unsubscribeSettings?.();
    this.listeners.clear();
  }

  private stopTimers(): void {
    if (this.probeTimer !== null) window.clearInterval(this.probeTimer);
    if (this.logTimer !== null) window.clearInterval(this.logTimer);
    this.probeTimer = null;
    this.logTimer = null;
  }

  restartTimers(): void {
    this.stopTimers();
    if (this.disposed) return;
    const auto = this.ctx.settings.get<boolean>(CONSOLE_SETTINGS.autoProbe, true) === true;
    if (!auto) return;
    const probeSeconds = Math.max(2, Number(this.ctx.settings.get(CONSOLE_SETTINGS.probeSeconds, 5)) || 5);
    const logSeconds = Math.max(1, Number(this.ctx.settings.get(CONSOLE_SETTINGS.logSeconds, 2)) || 2);
    this.probeTimer = window.setInterval(() => void this.probe(), probeSeconds * 1000);
    this.logTimer = window.setInterval(() => void this.refreshLogs(), logSeconds * 1000);
  }

  /* ---------------- process ownership ---------------- */

  private onProcessEvent(event: ProcessEvent): void {
    if (event.id === this.serviceProcessId) {
      if (event.kind === 'stdout' || event.kind === 'stderr') {
        this.appendLines('service', event.chunk.split(/\r?\n/).filter((line) => line.length > 0));
      } else if (event.kind === 'exit') {
        this.appendLines('service', [
          `=== the console service exited (code ${event.code ?? 'unknown'}${event.signal ? `, signal ${event.signal}` : ''}) ===`
        ]);
        this.serviceProcessId = null;
        this.patch({
          service: {
            state: 'exited',
            detail:
              event.code === 0
                ? 'The console service this application started has exited normally.'
                : `The console service this application started exited with code ${event.code ?? 'unknown'}. The service log holds what it printed before it went.`,
            owned: false,
            exitCode: event.code,
            observedAt: nowIso()
          }
        });
        void this.probe();
      } else if (event.kind === 'error') {
        this.appendLines('service', [`=== the console service reported an error: ${event.message} ===`]);
      } else if (event.kind === 'truncated') {
        this.appendLines('service', [
          `=== the service output was truncated at ${event.retainedBytes} retained bytes on ${event.stream} ===`
        ]);
      }
      return;
    }
    if (event.id === this.installProcessId) {
      if (event.kind === 'stdout' || event.kind === 'stderr') {
        this.appendLines('service', event.chunk.split(/\r?\n/).filter((line) => line.length > 0));
      } else if (event.kind === 'exit') {
        const ok = event.code === 0;
        this.appendLines('service', [`=== dependency installation finished (code ${event.code ?? 'unknown'}) ===`]);
        this.installProcessId = null;
        this.patch({ busy: null });
        if (ok) {
          this.ctx.notify.success(
            this.ctx.t('console.notify.depsInstalled', 'The console dependencies are installed'),
            this.ctx.t(
              'console.notify.depsInstalledBody',
              'Flask, waitress and requests were installed for this user. The service can be started now.'
            )
          );
        } else {
          this.ctx.notify.error(
            this.ctx.t('console.notify.depsFailed', 'The dependency installation failed'),
            this.ctx.t('console.notify.depsFailedBody', 'The installer exited with code {code}. The service log holds the output.', {
              values: { code: String(event.code ?? 'unknown') }
            })
          );
        }
      }
    }
  }

  private appendLines(source: LogSource, lines: string[]): void {
    if (lines.length === 0) return;
    const buffer = this.state.logs[source];
    const next = [...buffer.lines, ...lines];
    const retention = this.logRetention;
    const trimmed = next.length > retention ? next.slice(next.length - retention) : next;
    this.patch({
      logs: { ...this.state.logs, [source]: { ...buffer, lines: trimmed, loaded: true } }
    });
  }

  /* ---------------- refresh ---------------- */

  async refreshVault(): Promise<void> {
    const status = await this.ctx.studio.vault.status();
    const has = await this.ctx.studio.vault.has(CONSOLE_PASSWORD_ACCOUNT);
    this.patch({
      vaultAvailable: status.ok ? status.value.encryptionAvailable : false,
      vaultBackend: status.ok ? status.value.backend : 'unavailable',
      passwordStored: has.ok ? has.value : false
    });
  }

  /** Re-inspects the folder, probes the port and reloads everything derived. */
  async refreshAll(): Promise<void> {
    const report = await inspectInstallation(this.ctx.studio, this.serviceDirectory);
    this.patch({ installation: report });
    await this.probe();
    await this.loadConfig();
    await this.refreshRecords();
    await this.refreshLogs();
  }

  /** One health probe, plus the console's own status when it answers. */
  async probe(): Promise<ServiceSnapshot> {
    const port = this.port;
    const started = performance.now();
    const health = await consoleApi.health(this.ctx.studio, port);
    const latencyMs = Math.round(performance.now() - started);
    const owned = this.serviceProcessId !== null;

    let snapshot: ServiceSnapshot;
    if (health.ok) {
      const state: ServiceState = owned ? 'running' : 'running-elsewhere';
      snapshot = {
        state,
        detail: owned
          ? `The console this application started is answering on port ${port}. The downloader is ${health.value.running ? 'running' : 'stopped'}.`
          : `A console is answering on port ${port}, and this application did not start it. The downloader is ${health.value.running ? 'running' : 'stopped'}.`,
        latencyMs,
        owned,
        observedAt: nowIso()
      };
    } else if (health.loginRequired) {
      snapshot = {
        state: 'login-gated',
        detail: health.error,
        status: health.status,
        owned,
        observedAt: nowIso()
      };
    } else if (health.unreachable) {
      snapshot = {
        state: this.state.installation.state === 'ready' ? 'stopped' : this.installation(),
        detail:
          this.state.installation.state === 'ready'
            ? `Nothing is listening on port ${port}. The console folder is in place, so it can be started from here.`
            : health.error,
        owned: false,
        observedAt: nowIso()
      };
      if (owned) this.serviceProcessId = this.serviceProcessId; // still starting; kept as owned below
      if (owned) snapshot = { ...snapshot, state: 'starting', detail: `The console this application started is not answering on port ${port} yet.`, owned: true };
    } else {
      snapshot = {
        state: 'unhealthy',
        detail: health.error,
        status: health.status,
        owned,
        observedAt: nowIso()
      };
    }

    this.patch({ service: snapshot });
    if (snapshot.state === 'running' || snapshot.state === 'running-elsewhere') {
      await this.refreshLiveState();
    }
    return snapshot;
  }

  /** The state to report when the port is silent and nothing is installed. */
  private installation(): ServiceState {
    switch (this.state.installation.state) {
      case 'unset':
        return 'unconfigured';
      case 'ready':
        return 'stopped';
      default:
        return 'not-installed';
    }
  }

  private async refreshLiveState(): Promise<void> {
    const port = this.port;
    const [status, account, world, bot] = await Promise.all([
      consoleApi.status(this.ctx.studio, port),
      consoleApi.accountStatus(this.ctx.studio, port),
      consoleApi.worldInfo(this.ctx.studio, port),
      consoleApi.botStatus(this.ctx.studio, port)
    ]);
    this.patch({
      downloader: status.ok ? status.value : null,
      downloaderError: status.ok ? null : status.error,
      account: account.ok ? account.value : null,
      accountError: account.ok ? null : account.error,
      worldInfo: world.ok ? world.value : null,
      bot: bot.ok ? bot.value : null
    });
  }

  /**
   * Loads the saved configuration.
   *
   * The console's own status is authoritative while it is running, because that
   * is the configuration the process was actually launched with. When it is not
   * running the file underneath is read directly, so the surface is usable
   * before anything is started.
   */
  async loadConfig(): Promise<void> {
    const status = this.state.downloader;
    if (status && Object.keys(status.config).length > 0) {
      const config = normalizeConfig(status.config);
      this.patch({ config, savedConfig: config, configSource: 'console', configError: null });
      return;
    }
    const dataDirectory = this.dataDirectory;
    if (!dataDirectory) {
      this.patch({
        configSource: 'defaults',
        configError: 'No data directory is configured, so the saved configuration file cannot be found.'
      });
      return;
    }
    const separator = separatorFor(this.ctx.studio.info.platform);
    const path = joinPath(separator, dataDirectory, 'manager-config.json');
    const read = await this.ctx.studio.fs.readText(path, 512 * 1024);
    if (!read.ok) {
      this.patch({
        config: defaultConfig(),
        savedConfig: defaultConfig(),
        configSource: 'defaults',
        configError: `No saved configuration was read from ${path}: ${read.error}`
      });
      return;
    }
    try {
      const parsed = JSON.parse(read.value) as unknown;
      const config = normalizeConfig(parsed);
      this.patch({ config, savedConfig: config, configSource: 'file', configError: null });
    } catch (error: unknown) {
      this.patch({
        configSource: 'defaults',
        configError: `${path} exists but is not valid JSON: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }

  setConfigValue(key: string, value: string | boolean): void {
    this.patch({ config: { ...this.state.config, [key]: value } });
  }

  resetConfigToSaved(): void {
    this.patch({ config: { ...this.state.savedConfig } });
  }

  get configDirty(): boolean {
    return CONSOLE_OPTIONS.some(
      (option) => String(this.state.config[option.key] ?? '') !== String(this.state.savedConfig[option.key] ?? '')
    );
  }

  async refreshRecords(): Promise<void> {
    const records = await listDataRecords(this.ctx.studio, this.dataDirectory);
    this.patch({ records });
  }

  async refreshLogs(): Promise<void> {
    const state = this.state.service.state;
    if (state !== 'running' && state !== 'running-elsewhere') return;
    const port = this.port;
    const [downloader, bot] = await Promise.all([
      consoleApi.logs(this.ctx.studio, port, this.state.logs.downloader.cursor),
      consoleApi.botLogs(this.ctx.studio, port, this.state.logs.bot.cursor)
    ]);
    const logs = { ...this.state.logs };
    logs.downloader = this.mergePage(logs.downloader, downloader);
    logs.bot = this.mergePage(logs.bot, bot);
    this.patch({ logs });
  }

  private mergePage(buffer: LogBuffer, page: ConsoleCall<{ total: number; lines: string[] }>): LogBuffer {
    if (!page.ok) return { ...buffer, error: page.error };
    const retention = this.logRetention;
    const combined = [...buffer.lines, ...page.value.lines];
    const trimmed = combined.length > retention ? combined.slice(combined.length - retention) : combined;
    return { lines: trimmed, cursor: page.value.total, error: null, loaded: true };
  }

  clearLog(source: LogSource): void {
    this.patch({
      logs: { ...this.state.logs, [source]: { ...this.state.logs[source], lines: [] } }
    });
  }

  /* ---------------- world scan ---------------- */

  async scan(): Promise<void> {
    const token = ++this.scanToken;
    this.patch({
      worldScan: { running: true, completed: 0, total: 0, current: '' },
      worldsError: null
    });
    const outcome = await scanWorlds(this.ctx.studio, this.dataDirectory, {
      maxDepth: Math.max(1, Number(this.ctx.settings.get(CONSOLE_SETTINGS.scanDepth, 4)) || 4),
      maxEntries: Math.max(100, Number(this.ctx.settings.get(CONSOLE_SETTINGS.scanCap, 40000)) || 40000),
      currentWorld: this.currentWorldName,
      onProgress: (completed, total, name) => {
        if (token !== this.scanToken) return;
        this.patch({ worldScan: { running: true, completed, total, current: name } });
      },
      shouldStop: () => token !== this.scanToken || this.disposed
    });
    if (token !== this.scanToken) return;
    this.patch({
      worlds: outcome.worlds,
      worldsError: outcome.error,
      worldsSkipped: outcome.skipped,
      worldScan: { running: false, completed: outcome.worlds.length, total: outcome.worlds.length, current: '' }
    });
  }

  cancelScan(): void {
    this.scanToken += 1;
    this.patch({ worldScan: { running: false, completed: 0, total: 0, current: '' } });
  }

  /* ---------------- service operations ---------------- */

  async start(): Promise<void> {
    if (this.state.busy) return;
    const report = this.state.installation;
    if (report.state !== 'ready') {
      this.ctx.notify.error(
        this.ctx.t('console.notify.startBlocked', 'The console cannot be started'),
        this.ctx.t(
          'console.notify.startBlockedBody',
          'There is no app.py in the configured console folder, so there is nothing to run.'
        )
      );
      return;
    }
    this.patch({ busy: 'start' });
    let password: string | undefined;
    if (this.requireLogin) {
      const secret = await this.ctx.studio.vault.get(CONSOLE_PASSWORD_ACCOUNT);
      if (!secret.ok || !secret.value) {
        this.patch({ busy: null });
        this.ctx.notify.error(
          this.ctx.t('console.notify.noPassword', 'No console password is stored'),
          this.ctx.t(
            'console.notify.noPasswordBody',
            'The console is set to require a sign-in, but no password is in the credential vault. Store one, or turn the requirement off.'
          )
        );
        return;
      }
      password = secret.value;
    }

    const plan = planStart({
      report,
      python: this.python,
      port: this.port,
      dataDirectory: this.dataDirectory,
      jarPath: this.jarPath,
      username: this.consoleUsername,
      password
    });
    this.appendLines('service', [`$ ${plan.command} ${plan.args.join(' ')}  (cwd ${plan.cwd})`]);

    const outcome = await startService(this.ctx.studio, {
      report,
      python: this.python,
      port: this.port,
      dataDirectory: this.dataDirectory,
      jarPath: this.jarPath,
      username: this.consoleUsername,
      password
    });
    password = undefined;
    if (!outcome.ok || !outcome.processId) {
      this.patch({ busy: null });
      this.ctx.notify.error(
        this.ctx.t('console.notify.startFailed', 'The console service did not start'),
        outcome.error ?? 'The privileged bridge refused to start the process and gave no reason.'
      );
      return;
    }
    this.serviceProcessId = outcome.processId;
    this.patch({
      busy: null,
      service: {
        state: 'starting',
        detail: `The console service was started as process ${outcome.pid ?? 'unknown'}. It is not answering yet.`,
        owned: true,
        observedAt: nowIso()
      }
    });
    await this.ctx.history.record('Started the web console service', 'console', {
      port: this.port,
      directory: report.directory,
      python: this.python,
      loginGate: this.requireLogin
    });
    window.setTimeout(() => void this.probe(), 1200);
  }

  async stop(): Promise<void> {
    if (!this.serviceProcessId) return;
    this.patch({ busy: 'stop' });
    const result = await this.ctx.studio.process.kill(this.serviceProcessId);
    this.patch({ busy: null });
    if (!result.ok) {
      this.ctx.notify.error(
        this.ctx.t('console.notify.stopFailed', 'The console service did not stop'),
        result.error
      );
      return;
    }
    await this.ctx.history.record('Stopped the web console service', 'console', { port: this.port });
    window.setTimeout(() => void this.probe(), 600);
  }

  async installDependencies(): Promise<void> {
    if (this.state.busy) return;
    this.patch({ busy: 'install' });
    const outcome = await installRequirements(this.ctx.studio, this.state.installation, this.python);
    if (!outcome.ok || !outcome.processId) {
      this.patch({ busy: null });
      this.ctx.notify.error(
        this.ctx.t('console.notify.installFailed', 'The dependency installation did not start'),
        outcome.error ?? 'The privileged bridge refused to start the installer and gave no reason.'
      );
      return;
    }
    this.installProcessId = outcome.processId;
    this.appendLines('service', [
      `$ ${this.python} -m pip install --user -r ${this.state.installation.requirementsPath}`
    ]);
  }

  /** True when the console can be asked to do something over its API. */
  get apiReachable(): boolean {
    return this.state.service.state === 'running' || this.state.service.state === 'running-elsewhere';
  }

  /** A single sentence naming why an API action is unavailable, or null. */
  unavailableReason(): string | null {
    if (this.apiReachable) return null;
    switch (this.state.service.state) {
      case 'unconfigured':
        return 'No console folder is configured yet, so there is nothing to talk to.';
      case 'not-installed':
        return 'The configured folder does not contain the console, so there is nothing to talk to.';
      case 'stopped':
        return 'The console is not running. Start it first.';
      case 'starting':
        return 'The console was started and has not answered yet.';
      case 'exited':
        return 'The console service exited. Start it again first.';
      case 'login-gated':
        return 'The console is behind its own sign-in gate, which this application cannot pass.';
      case 'unhealthy':
        return 'Something is answering on that port but it is not the console.';
      default:
        return 'The console is not reachable.';
    }
  }
}
