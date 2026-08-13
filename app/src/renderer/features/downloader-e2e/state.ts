import type { AppContext } from '../../core/registry';
import type { ProcessEvent } from '../../../shared/api';

/**
 * Everything the end-to-end test tab shares: the configured harness
 * location, the currently running (or last) session, and the run history.
 *
 * This feature never touches the filesystem or spawns a process directly —
 * every privileged action goes through `ctx.studio`, exactly like every other
 * feature. The harness itself (`test-e2e/run.js`) is the one place the actual
 * server/proxy/bot orchestration and Anvil-header verification logic lives;
 * this file's job is to launch that exact script as a child `node` process
 * (an already-allowlisted command) and to read the single-line JSON events it
 * prints on stdout, never to re-implement any of its logic.
 */

export const HARNESS_PATH_SETTING_ID = 'downloader-e2e.settings.harnessPath';
export const NODE_COMMAND_SETTING_ID = 'downloader-e2e.settings.nodeCommand';
export const JAVA_COMMAND_SETTING_ID = 'downloader-e2e.settings.javaCommand';
export const JAR_PATH_SETTING_ID = 'downloader-e2e.settings.downloaderJarPath';
export const SCRAPER_DIR_SETTING_ID = 'downloader-e2e.settings.scraperDir';
export const RUNS_SETTING_ID = 'downloader-e2e.runs';

export const DEFAULT_NODE_COMMAND = 'node';
export const DEFAULT_JAVA_COMMAND = 'java';

export const E2E_STAGES = [
  'preflight',
  'server-starting',
  'server-ready',
  'proxy-starting',
  'proxy-listening',
  'bot-connecting',
  'bot-connected',
  'bot-walking',
  'bot-drained',
  'verifying',
  'done'
] as const;
export type E2eStage = (typeof E2E_STAGES)[number];

export type E2eFailureCause =
  | 'environment-unavailable'
  | 'server-not-ready'
  | 'proxy-not-accepting'
  | 'bot-not-connected'
  | 'no-chunks-streamed'
  | 'chunks-streamed-not-written'
  | 'cancelled';

export interface LaunchOptions {
  version: string;
  mode: 'auto' | 'docker' | 'jar';
  radius: number;
  bots: number;
  coverageThreshold: number;
}

export const DEFAULT_LAUNCH: LaunchOptions = { version: '1.20.4', mode: 'auto', radius: 128, bots: 1, coverageThreshold: 0.6 };

export interface RunRecord {
  id: string;
  startedAt: string;
  endedAt: string | null;
  launch: LaunchOptions;
  /** Null while the run is still in progress. */
  ok: boolean | null;
  reachedStage: E2eStage | null;
  cause: E2eFailureCause | null;
  message: string | null;
  matchedCount: number | null;
  expectedCount: number | null;
  coverageRatio: number | null;
  totalSavedAcrossDimensions: number | null;
  workDir: string | null;
  reportPath: string | null;
  logPath: string | null;
  /** The full progress log, kept for the "open report" action. Bounded. */
  progressLines: string[];
}

const MAX_PROGRESS_LINES = 2000;
const MAX_RUN_RECORDS = 200;

/* ------------------------------------------------------------------ */
/* Probing the three configured paths                                  */
/* ------------------------------------------------------------------ */

export interface HarnessProbe {
  harnessPath: string;
  harnessFound: boolean;
  jarPath: string;
  jarFound: boolean;
  scraperDir: string;
  scraperFound: boolean;
  probedAt: string;
}

export function emptyProbe(): HarnessProbe {
  return {
    harnessPath: '',
    harnessFound: false,
    jarPath: '',
    jarFound: false,
    scraperDir: '',
    scraperFound: false,
    probedAt: new Date(0).toISOString()
  };
}

export async function probeHarness(ctx: AppContext): Promise<HarnessProbe> {
  const harnessPath = ctx.settings.get<string>(HARNESS_PATH_SETTING_ID, '').trim();
  const jarPath = ctx.settings.get<string>(JAR_PATH_SETTING_ID, '').trim();
  const scraperDir = ctx.settings.get<string>(SCRAPER_DIR_SETTING_ID, '').trim();

  const [harnessStat, jarStat, scraperStat] = await Promise.all([
    harnessPath === '' ? Promise.resolve(null) : ctx.studio.fs.stat(harnessPath),
    jarPath === '' ? Promise.resolve(null) : ctx.studio.fs.stat(jarPath),
    scraperDir === '' ? Promise.resolve(null) : ctx.studio.fs.stat(scraperDir)
  ]);

  return {
    harnessPath,
    harnessFound: !!(harnessStat && harnessStat.ok && harnessStat.value.exists && harnessStat.value.isFile),
    jarPath,
    jarFound: !!(jarStat && jarStat.ok && jarStat.value.exists && jarStat.value.isFile),
    scraperDir,
    scraperFound: !!(scraperStat && scraperStat.ok && scraperStat.value.exists && scraperStat.value.isDirectory),
    probedAt: new Date().toISOString()
  };
}

/* ------------------------------------------------------------------ */
/* Parsing the harness's stdout events                                 */
/* ------------------------------------------------------------------ */

interface StageEvent {
  kind: 'stage';
  stage: string;
  detail?: string;
}
interface ProgressEvent {
  kind: 'progress';
  stage: string;
  done: number;
  total: number;
}
interface ResultEvent {
  kind: 'result';
  verdict: {
    ok: boolean;
    reachedStage: string | null;
    cause: string | null;
    message: string;
    detail: string | null;
  };
  args?: { version?: string };
  serverRoute?: string;
  serverReadyLine?: string;
  proxyReadyLine?: string;
  botRun?: { exitCode: number; spawnedBots: number; gamemodes: string[]; totalVisited: number };
  verification?: {
    matchedCount: number;
    expectedCount: number;
    coverageRatio: number;
    totalSavedAcrossDimensions: number;
  };
  error?: string;
}

function parseHarnessLine(line: string): StageEvent | ProgressEvent | ResultEvent | null {
  const spaceIndex = line.indexOf(' ');
  if (spaceIndex < 0) return null;
  const tag = line.slice(0, spaceIndex);
  const payload = line.slice(spaceIndex + 1);
  if (tag !== 'STAGE' && tag !== 'PROGRESS' && tag !== 'RESULT') return null;
  try {
    return JSON.parse(payload) as StageEvent | ProgressEvent | ResultEvent;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* The running session                                                 */
/* ------------------------------------------------------------------ */

type Listener = () => void;

export class E2eRunSession {
  private readonly ctx: AppContext;
  private processId: string | null = null;
  private unsubscribe: (() => void) | null = null;
  private partial = { stdout: '', stderr: '' };
  private readonly listeners = new Set<Listener>();
  private busy = false;

  record: RunRecord | null = null;

  constructor(ctx: AppContext) {
    this.ctx = ctx;
  }

  isRunning(): boolean {
    return this.record !== null && this.record.ok === null;
  }

  isBusy(): boolean {
    return this.busy;
  }

  onChange(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }

  async start(launch: LaunchOptions, workDir: string): Promise<{ started: boolean; reason: string }> {
    if (this.busy || this.isRunning()) {
      return { started: false, reason: 'A run is already in progress in this window.' };
    }
    this.busy = true;

    const probe = await probeHarness(this.ctx);
    if (!probe.harnessFound) {
      this.busy = false;
      return { started: false, reason: `The harness script was not found at "${probe.harnessPath || '(not set)'}".` };
    }

    const nodeCommand = this.ctx.settings.get<string>(NODE_COMMAND_SETTING_ID, DEFAULT_NODE_COMMAND);
    const javaCommand = this.ctx.settings.get<string>(JAVA_COMMAND_SETTING_ID, DEFAULT_JAVA_COMMAND);

    const args = [
      probe.harnessPath,
      '--version',
      launch.version,
      '--mode',
      launch.mode,
      '--radius',
      String(launch.radius),
      '--bots',
      String(launch.bots),
      '--coverage-threshold',
      String(launch.coverageThreshold),
      '--java',
      javaCommand,
      '--work-dir',
      workDir
    ];
    if (probe.jarFound) args.push('--jar', probe.jarPath);
    if (probe.scraperFound) args.push('--scraper-dir', probe.scraperDir);

    const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.record = {
      id: runId,
      startedAt: new Date().toISOString(),
      endedAt: null,
      launch,
      ok: null,
      reachedStage: 'preflight',
      cause: null,
      message: null,
      matchedCount: null,
      expectedCount: null,
      coverageRatio: null,
      totalSavedAcrossDimensions: null,
      workDir,
      reportPath: null,
      logPath: null,
      progressLines: []
    };
    this.partial = { stdout: '', stderr: '' };
    this.emit();

    const spawned = await this.ctx.studio.process.spawn({
      command: nodeCommand,
      args,
      maxOutputBytes: 16 * 1024 * 1024
    });

    if (!spawned.ok) {
      this.finishAsEnvironmentFailure(spawned.error);
      this.busy = false;
      return { started: false, reason: spawned.error };
    }

    this.processId = spawned.value.id;
    this.busy = false;
    this.unsubscribe = this.ctx.studio.events.on('process:event', (event: ProcessEvent) => {
      if (event.id !== this.processId) return;
      this.handle(event);
    });
    return { started: true, reason: '' };
  }

  async cancel(): Promise<void> {
    if (!this.processId || !this.isRunning()) return;
    await this.ctx.studio.process.kill(this.processId);
  }

  dispose(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.listeners.clear();
  }

  private finishAsEnvironmentFailure(message: string): void {
    if (!this.record) return;
    this.record.ok = false;
    this.record.cause = 'environment-unavailable';
    this.record.message = message;
    this.record.endedAt = new Date().toISOString();
    this.record.reachedStage = 'preflight';
    this.emit();
  }

  private pushLine(line: string): void {
    if (!this.record) return;
    this.record.progressLines.push(line);
    if (this.record.progressLines.length > MAX_PROGRESS_LINES) {
      this.record.progressLines.splice(0, this.record.progressLines.length - MAX_PROGRESS_LINES);
    }
  }

  private handle(event: ProcessEvent): void {
    if (!this.record) return;
    switch (event.kind) {
      case 'stdout':
      case 'stderr': {
        const key = event.kind;
        const combined = this.partial[key] + event.chunk;
        const parts = combined.split(/\r?\n/);
        this.partial[key] = parts.pop() ?? '';
        for (const raw of parts) {
          this.consumeLine(raw);
        }
        this.emit();
        break;
      }
      case 'exit': {
        for (const key of ['stdout', 'stderr'] as const) {
          if (this.partial[key].trim() !== '') this.consumeLine(this.partial[key]);
          this.partial[key] = '';
        }
        if (this.record.ok === null) {
          // The process exited without ever printing a RESULT line — treat as
          // an environment failure rather than silently leaving the run
          // "in progress" forever.
          this.record.ok = false;
          this.record.cause = 'environment-unavailable';
          this.record.message = `The harness process exited (code ${String(event.code)}) without reporting a result.`;
        }
        this.record.endedAt = new Date().toISOString();
        this.unsubscribe?.();
        this.unsubscribe = null;
        this.processId = null;
        this.emit();
        break;
      }
      case 'error': {
        this.finishAsEnvironmentFailure(event.message);
        break;
      }
      default:
        break;
    }
  }

  private consumeLine(line: string): void {
    if (!this.record || line.trim() === '') return;
    this.pushLine(line);
    const parsed = parseHarnessLine(line.trim());
    if (!parsed) return;

    if (parsed.kind === 'stage') {
      if (E2E_STAGES.includes(parsed.stage as E2eStage)) {
        this.record.reachedStage = parsed.stage as E2eStage;
      }
      return;
    }
    if (parsed.kind === 'result') {
      const verdict = parsed.verdict;
      this.record.ok = verdict.ok;
      this.record.reachedStage = E2E_STAGES.includes(verdict.reachedStage as E2eStage) ? (verdict.reachedStage as E2eStage) : null;
      this.record.cause = (verdict.cause as E2eFailureCause | null) ?? null;
      this.record.message = verdict.message;
      if (parsed.verification) {
        this.record.matchedCount = parsed.verification.matchedCount;
        this.record.expectedCount = parsed.verification.expectedCount;
        this.record.coverageRatio = parsed.verification.coverageRatio;
        this.record.totalSavedAcrossDimensions = parsed.verification.totalSavedAcrossDimensions;
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* The feature state                                                   */
/* ------------------------------------------------------------------ */

type StateListener = () => void;

export class FeatureState {
  readonly ctx: AppContext;
  readonly session: E2eRunSession;
  probe: HarnessProbe = emptyProbe();
  runs: RunRecord[];

  private readonly listeners = new Set<StateListener>();
  private disposed = false;

  constructor(ctx: AppContext) {
    this.ctx = ctx;
    this.session = new E2eRunSession(ctx);
    this.runs = ctx.settings.get<RunRecord[]>(RUNS_SETTING_ID, []);
    this.session.onChange(() => {
      this.syncCurrentIntoHistory();
      this.emit();
    });
  }

  onChange(listener: StateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }

  async refreshProbe(): Promise<HarnessProbe> {
    this.probe = await probeHarness(this.ctx);
    this.emit();
    return this.probe;
  }

  async start(launch: LaunchOptions): Promise<{ started: boolean; reason: string }> {
    const runId = `${Date.now()}`;
    const separator = this.ctx.studio.info.platform === 'win32' ? '\\' : '/';
    const workDir = [this.ctx.studio.info.userDataDir, 'downloader-e2e', 'runs', runId].join(separator);
    const outcome = await this.session.start(launch, workDir);
    if (outcome.started) {
      void this.ctx.history.record('Started an end-to-end test run', 'downloader-e2e', { launch, workDir });
    }
    return outcome;
  }

  async cancel(): Promise<void> {
    await this.session.cancel();
  }

  private syncCurrentIntoHistory(): void {
    const current = this.session.record;
    if (!current) return;
    const index = this.runs.findIndex((run) => run.id === current.id);
    const snapshot: RunRecord = { ...current, progressLines: [...current.progressLines] };
    if (index >= 0) this.runs[index] = snapshot;
    else this.runs = [snapshot, ...this.runs];
    if (this.runs.length > MAX_RUN_RECORDS) this.runs = this.runs.slice(0, MAX_RUN_RECORDS);
    this.ctx.settings.set(RUNS_SETTING_ID, this.runs);

    if (current.ok !== null && current.endedAt !== null) {
      void this.ctx.history.record(current.ok ? 'End-to-end run passed' : 'End-to-end run failed', 'downloader-e2e', {
        id: current.id,
        cause: current.cause,
        reachedStage: current.reachedStage
      });
    }
  }

  deleteRuns(ids: string[]): void {
    const doomed = new Set(ids);
    this.runs = this.runs.filter((run) => !doomed.has(run.id));
    this.ctx.settings.set(RUNS_SETTING_ID, this.runs);
    void this.ctx.history.record('Deleted end-to-end run records', 'downloader-e2e', { ids });
    this.emit();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.session.dispose();
    this.listeners.clear();
  }
}
