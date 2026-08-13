/**
 * Starting, watching and stopping the real Node scraper.
 *
 * There is no simulation anywhere in this file. `studio.process.spawn` launches
 * `node scrape.js --config <generated file>` in the scraper's own directory, the
 * push channel delivers that process's genuine output, and the state reported to
 * the surface is the state the process is actually in. A run that could not
 * start says why, in the words the operating system used.
 */

import type { AppContext } from '../../core/registry';
import type { ProcessEvent } from '../../../shared/api';
import { toScraperConfig, validateProfile } from './config';
import type { ScraperConfig } from './config';
import { captureLine, compileRules, severityOf } from './capture';
import type { CompiledRule } from './capture';
import type { BotProfile, BotStore, CapturedMessage, LogLine } from './state';
import { CAPTURE_ENABLED_ID, LOG_LIMIT_ID, SCRAPER_DIR_ID, STOP_SIGNAL_ID, newId } from './state';

export type RunPhase = 'idle' | 'checking' | 'starting' | 'running' | 'stopping' | 'finished' | 'failed';

export interface RunState {
  phase: RunPhase;
  /** The profile this run belongs to, or null when nothing has run yet. */
  profileId: string | null;
  profileName: string;
  processId: string | null;
  pid: number | null;
  startedAt: string | null;
  endedAt: string | null;
  exitCode: number | null;
  signal: string | null;
  /** The exact blocking reason when the phase is `failed`, else empty. */
  error: string;
  /** Absolute path of the generated configuration file, while a run holds one. */
  configPath: string;
  /** Lines read from the process so far this run. */
  linesRead: number;
  /** Messages captured from this run so far. */
  messagesCaptured: number;
  /** Set when the scraper printed a Microsoft device code that is still current. */
  deviceCode: { code: string; url: string } | null;
}

function idleState(): RunState {
  return {
    phase: 'idle',
    profileId: null,
    profileName: '',
    processId: null,
    pid: null,
    startedAt: null,
    endedAt: null,
    exitCode: null,
    signal: null,
    error: '',
    configPath: '',
    linesRead: 0,
    messagesCaptured: 0,
    deviceCode: null
  };
}

export interface StartOutcome {
  ok: boolean;
  /** Plain-words reason when `ok` is false. Never a bare error code. */
  reason: string;
}

type Listener = () => void;

/**
 * Owns exactly one run at a time.
 *
 * One run rather than several because the scraper already runs every account in
 * a profile as its own bot inside a single process, and two processes writing
 * one visited-chunk cache would fight over it.
 */
export class BotRunner {
  private state: RunState = idleState();
  private readonly log: LogLine[] = [];
  private readonly listeners = new Set<Listener>();
  private unsubscribe: (() => void) | null = null;
  private stdoutRemainder = '';
  private stderrRemainder = '';
  private compiled: CompiledRule[] = [];

  constructor(
    private readonly ctx: AppContext,
    private readonly store: BotStore
  ) {
    this.unsubscribe = ctx.studio.events.on('process:event', (event) => this.onProcessEvent(event));
  }

  dispose(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.listeners.clear();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    for (const listener of [...this.listeners]) listener();
  }

  snapshot(): RunState {
    return { ...this.state, deviceCode: this.state.deviceCode ? { ...this.state.deviceCode } : null };
  }

  lines(): LogLine[] {
    return [...this.log];
  }

  isBusy(): boolean {
    return this.state.phase === 'checking' || this.state.phase === 'starting' || this.state.phase === 'running' || this.state.phase === 'stopping';
  }

  /* ================================================================ */
  /* Locating the scraper                                             */
  /* ================================================================ */

  /** The directory this profile would run from, before any check. */
  directoryFor(profile: BotProfile): string {
    const own = profile.scraperDirectory.trim();
    if (own.length > 0) return own;
    return this.ctx.settings.get<string>(SCRAPER_DIR_ID, '').trim();
  }

  /**
   * Confirms `scrape.js` is really there.
   *
   * A directory that merely exists is not enough: the whole run depends on that
   * one file, and reporting "started" for a spawn that will immediately fail
   * with a module-not-found error helps nobody.
   */
  async locateScript(profile: BotProfile): Promise<{ ok: boolean; path: string; reason: string }> {
    const directory = this.directoryFor(profile);
    if (directory.length === 0) {
      return {
        ok: false,
        path: '',
        reason:
          'No scraper directory is set. Choose the folder that contains scrape.js, either on this profile or in the feature settings.'
      };
    }
    const separator = directory.includes('\\') && !directory.includes('/') ? '\\' : '/';
    const trimmed = directory.replace(/[\\/]+$/, '');
    const scriptPath = `${trimmed}${separator}scrape.js`;
    const stat = await this.ctx.studio.fs.stat(scriptPath);
    if (!stat.ok) {
      return { ok: false, path: scriptPath, reason: `The scraper script could not be read: ${stat.error}` };
    }
    if (!stat.value.exists || !stat.value.isFile) {
      return {
        ok: false,
        path: scriptPath,
        reason: `There is no scrape.js in ${trimmed}. Point the setting at the scraper folder of the world downloader checkout.`
      };
    }
    return { ok: true, path: scriptPath, reason: '' };
  }

  /* ================================================================ */
  /* Starting                                                         */
  /* ================================================================ */

  async start(profile: BotProfile): Promise<StartOutcome> {
    if (this.isBusy()) {
      return { ok: false, reason: 'A run is already going. Stop it before starting another one.' };
    }

    const problems = validateProfile(profile);
    if (problems.length > 0) {
      return { ok: false, reason: problems[0].message };
    }

    this.state = { ...idleState(), phase: 'checking', profileId: profile.id, profileName: profile.name };
    this.log.length = 0;
    this.stdoutRemainder = '';
    this.stderrRemainder = '';
    this.compiled = compileRules(this.store.listRules());
    this.emit();

    const located = await this.locateScript(profile);
    if (!located.ok) return this.fail(located.reason);

    const dataDir = this.ctx.studio.info.userDataDir;
    const separator = dataDir.includes('\\') && !dataDir.includes('/') ? '\\' : '/';
    const runDir = `${dataDir.replace(/[\\/]+$/, '')}${separator}bot-runs`;
    const ensured = await this.ctx.studio.fs.ensureDirectory(runDir);
    if (!ensured.ok) return this.fail(`The run folder could not be created: ${ensured.error}`);

    const configPath = `${runDir}${separator}${profile.id}.config.json`;
    const visitedPath =
      profile.visitedFile.trim().length > 0
        ? profile.visitedFile.trim()
        : `${runDir}${separator}${profile.id}.visited.json`;

    let password = '';
    if (profile.autoLogin && profile.loginPasswordAccount.length > 0) {
      const secret = await this.ctx.studio.vault.get(profile.loginPasswordAccount);
      if (!secret.ok) {
        return this.fail(
          `Automatic login is on but the stored password could not be read: ${secret.error}. Set it again, or turn automatic login off.`
        );
      }
      if (secret.value === null) {
        return this.fail(
          'Automatic login is on but no password is stored for this profile any more. Set it again, or turn automatic login off.'
        );
      }
      password = secret.value;
    }

    const config: ScraperConfig = toScraperConfig(profile, password, visitedPath);
    const written = await this.ctx.studio.fs.writeText(configPath, `${JSON.stringify(config, null, 2)}\n`);
    if (!written.ok) return this.fail(`The configuration file could not be written: ${written.error}`);

    this.state = { ...this.state, phase: 'starting', configPath };
    this.append('runner', `Configuration written to ${configPath}`);
    this.append('runner', `Running node ${located.path} --config ${configPath}`);
    this.emit();

    const spawned = await this.ctx.studio.process.spawn({
      command: 'node',
      args: [located.path, '--config', configPath],
      cwd: this.directoryFor(profile),
      maxOutputBytes: 8 * 1024 * 1024
    });

    if (!spawned.ok) {
      await this.discardConfig(configPath);
      return this.fail(
        `The scraper could not be started: ${spawned.error}. Node must be installed and on the system path for this to work.`
      );
    }

    this.state = {
      ...this.state,
      phase: 'running',
      processId: spawned.value.id,
      pid: spawned.value.pid,
      startedAt: spawned.value.startedAt
    };
    this.emit();

    await this.ctx.history.record('Started the scraper bot', 'bot', {
      profileId: profile.id,
      profileName: profile.name,
      host: profile.host,
      port: profile.port,
      accounts: profile.usernames.length,
      areaMode: profile.areaMode
    });

    return { ok: true, reason: '' };
  }

  private fail(reason: string): StartOutcome {
    this.state = { ...this.state, phase: 'failed', error: reason, endedAt: new Date().toISOString() };
    this.append('runner', reason);
    this.emit();
    return { ok: false, reason };
  }

  /* ================================================================ */
  /* Stopping                                                         */
  /* ================================================================ */

  async stop(): Promise<StartOutcome> {
    const id = this.state.processId;
    if (!id || this.state.phase !== 'running') {
      return { ok: false, reason: 'Nothing is running, so there is nothing to stop.' };
    }
    const signal = this.ctx.settings.get<string>(STOP_SIGNAL_ID, 'SIGTERM');
    this.state = { ...this.state, phase: 'stopping' };
    this.append('runner', `Asked the scraper to stop with ${signal}.`);
    this.emit();

    const killed = await this.ctx.studio.process.kill(id, signal);
    if (!killed.ok) {
      this.state = { ...this.state, phase: 'running' };
      this.append('runner', `The stop request was refused: ${killed.error}`);
      this.emit();
      return { ok: false, reason: `The scraper could not be stopped: ${killed.error}` };
    }

    await this.ctx.history.record('Stopped the scraper bot', 'bot', {
      profileId: this.state.profileId,
      profileName: this.state.profileName,
      signal
    });
    return { ok: true, reason: '' };
  }

  private async discardConfig(path: string): Promise<void> {
    if (path.length === 0) return;
    // The generated file holds the AuthMe password in the clear because the
    // scraper has no other way to receive it. Overwriting it the moment the run
    // is over keeps it from sitting on disk between runs.
    await this.ctx.studio.fs.writeText(path, '{}\n');
  }

  /* ================================================================ */
  /* Output                                                           */
  /* ================================================================ */

  private onProcessEvent(event: ProcessEvent): void {
    if (!this.state.processId || event.id !== this.state.processId) return;

    switch (event.kind) {
      case 'stdout':
      case 'stderr': {
        const stream = event.kind;
        const carried = stream === 'stdout' ? this.stdoutRemainder : this.stderrRemainder;
        const combined = carried + event.chunk;
        const parts = combined.split(/\r?\n/);
        const remainder = parts.pop() ?? '';
        if (stream === 'stdout') this.stdoutRemainder = remainder;
        else this.stderrRemainder = remainder;
        for (const line of parts) this.consumeLine(line, stream);
        break;
      }
      case 'truncated':
        this.append('runner', `The ${event.stream} stream was trimmed to its ${event.retainedBytes} byte ceiling. The run continues.`);
        break;
      case 'error':
        this.append('runner', `The process reported an error: ${event.message}`);
        this.state = { ...this.state, error: event.message };
        break;
      case 'exit': {
        const ended = new Date().toISOString();
        this.append(
          'runner',
          event.signal
            ? `The scraper ended on signal ${event.signal}.`
            : `The scraper exited with code ${event.code ?? 'unknown'}.`
        );
        this.state = {
          ...this.state,
          phase: event.code === 0 || event.signal !== null ? 'finished' : 'failed',
          endedAt: ended,
          exitCode: event.code,
          signal: event.signal,
          error:
            event.code === 0 || event.signal !== null
              ? this.state.error
              : `The scraper exited with code ${event.code ?? 'unknown'}. The run log above has the reason.`
        };
        const configPath = this.state.configPath;
        this.state = { ...this.state, configPath: '' };
        void this.discardConfig(configPath);
        void this.ctx.history.record('The scraper bot run ended', 'bot', {
          profileId: this.state.profileId,
          profileName: this.state.profileName,
          exitCode: event.code,
          signal: event.signal,
          linesRead: this.state.linesRead,
          messagesCaptured: this.state.messagesCaptured
        });
        break;
      }
      default:
        break;
    }

    this.emit();
  }

  private consumeLine(raw: string, stream: 'stdout' | 'stderr'): void {
    const text = raw.replace(/\s+$/, '');
    if (text.length === 0) return;
    this.append(stream, text);
    this.state = { ...this.state, linesRead: this.state.linesRead + 1 };

    const deviceCode = /^MSA_CODE\s+(\{.*\})$/.exec(text.trim());
    if (deviceCode) this.readDeviceCode(deviceCode[1]);
    if (/spawned at /.test(text)) this.state = { ...this.state, deviceCode: null };

    if (this.ctx.settings.get<boolean>(CAPTURE_ENABLED_ID, true)) {
      const captured = captureLine(text, this.compiled, {
        origin: this.state.profileName,
        source: 'run'
      });
      if (captured) {
        this.store.addMessages([captured.message]);
        this.state = { ...this.state, messagesCaptured: this.state.messagesCaptured + 1 };
      }
    }
  }

  private readDeviceCode(json: string): void {
    try {
      const parsed = JSON.parse(json) as { code?: unknown; url?: unknown };
      const code = typeof parsed.code === 'string' ? parsed.code : '';
      const url = typeof parsed.url === 'string' ? parsed.url : '';
      if (code.length > 0) this.state = { ...this.state, deviceCode: { code, url } };
    } catch {
      // A malformed line is left in the log verbatim and simply produces no
      // sign-in panel; inventing a code from a line we could not read would be
      // worse than showing none.
    }
  }

  private append(stream: 'stdout' | 'stderr' | 'runner', text: string): void {
    const line: LogLine = {
      id: newId('bot-line'),
      timestamp: new Date().toISOString(),
      severity: stream === 'runner' ? 'info' : severityOf(text, stream),
      stream,
      text
    };
    this.log.push(line);
    const limit = Math.max(100, Number(this.ctx.settings.get<number>(LOG_LIMIT_ID, 2000)));
    if (this.log.length > limit) this.log.splice(0, this.log.length - limit);
  }

  /** Empties the on-screen log. The captured messages are untouched. */
  clearLog(): void {
    this.log.length = 0;
    this.emit();
  }

  /** Recovers a run that was already going when the tab was reopened. */
  async adopt(): Promise<void> {
    if (this.state.processId) return;
    const listed = await this.ctx.studio.process.list();
    if (!listed.ok) return;
    const running = listed.value.find(
      (summary) => summary.running && summary.command === 'node' && summary.args.some((arg) => arg.endsWith('scrape.js'))
    );
    if (!running) return;
    this.compiled = compileRules(this.store.listRules());
    this.state = {
      ...idleState(),
      phase: 'running',
      profileId: this.store.lastProfileId() || null,
      profileName: this.store.profile(this.store.lastProfileId())?.name ?? 'A run started earlier',
      processId: running.id,
      pid: running.pid,
      startedAt: running.startedAt
    };
    this.append('runner', `Reattached to a scraper that was already running (process ${running.pid ?? 'unknown'}).`);
    const stdout = await this.ctx.studio.process.readOutput(running.id, 'stdout');
    if (stdout.ok) {
      for (const line of stdout.value.split(/\r?\n/)) {
        const text = line.replace(/\s+$/, '');
        if (text.length > 0) this.append('stdout', text);
      }
    }
    this.emit();
  }
}

export type CapturedRow = CapturedMessage;
