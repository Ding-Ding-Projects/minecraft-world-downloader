import type { AppContext } from '../../core/registry';
import {
  type ContainerRow,
  type DaemonStatus,
  type OperationKind,
  listContainers,
  operationArguments,
  probeDaemon,
  runDocker
} from './docker';

/**
 * The shared state behind both destinations.
 *
 * One poll loop, one container list, one daemon verdict and one set of running
 * operations, so the containers destination and the log destination can never
 * disagree about what exists or about what is happening to it.
 *
 * The loop only runs while a destination is actually mounted. A manager that
 * keeps shelling out to `docker ps` every few seconds behind a closed tab is
 * spending the user's battery to answer a question nobody asked.
 */

/* ------------------------------------------------------------------ */
/* Setting ids                                                         */
/* ------------------------------------------------------------------ */

export const REFRESH_SECONDS_ID = 'server.refreshSeconds';
export const SHOW_STOPPED_ID = 'server.showStopped';
export const COMPOSE_PROJECT_ID = 'server.composeProject';
export const STOP_TIMEOUT_ID = 'server.stopTimeoutSeconds';
export const LOG_TAIL_ID = 'server.logTail';
export const LOG_FOLLOW_ID = 'server.logFollow';
export const LOG_PAGE_SIZE_ID = 'server.logPageSize';
export const REDACT_SECRETS_ID = 'server.redactSecrets';
export const EXPORT_FORMAT_ID = 'server.exportFormat';
export const CHECK_DAEMON_ID = 'server.checkDaemon';

export const CONTAINERS_TAB_ID = 'server.containers';
export const LOGS_TAB_ID = 'server.logs';

export const ELEMENT_IDS = {
  daemon: 'server-daemon',
  filters: 'server-filters',
  statistics: 'server-statistics',
  table: 'server-containers-table',
  search: 'server-containers-search',
  operations: 'server-operations',
  logPicker: 'server-log-picker',
  logSearch: 'server-log-search',
  logFilters: 'server-log-filters',
  logStatistics: 'server-log-statistics',
  logLines: 'server-log-lines',
  logFollow: 'server-log-follow'
} as const;

/* ------------------------------------------------------------------ */
/* Defaults                                                            */
/* ------------------------------------------------------------------ */

export const DEFAULTS = {
  refreshSeconds: 5,
  showStopped: true,
  composeProject: '',
  stopTimeoutSeconds: 10,
  logTail: 500,
  logFollow: false,
  logPageSize: 200,
  redactSecrets: true,
  exportFormat: 'json'
} as const;

export function refreshSeconds(ctx: AppContext): number {
  const raw = Number(ctx.settings.get<number>(REFRESH_SECONDS_ID, DEFAULTS.refreshSeconds));
  if (!Number.isFinite(raw)) return DEFAULTS.refreshSeconds;
  return Math.min(120, Math.max(2, Math.round(raw)));
}

export function stopTimeoutSeconds(ctx: AppContext): number {
  const raw = Number(ctx.settings.get<number>(STOP_TIMEOUT_ID, DEFAULTS.stopTimeoutSeconds));
  if (!Number.isFinite(raw)) return DEFAULTS.stopTimeoutSeconds;
  return Math.min(300, Math.max(1, Math.round(raw)));
}

export function logTail(ctx: AppContext): number {
  const raw = Number(ctx.settings.get<number>(LOG_TAIL_ID, DEFAULTS.logTail));
  if (!Number.isFinite(raw)) return DEFAULTS.logTail;
  return Math.min(5000, Math.max(50, Math.round(raw)));
}

export function logPageSize(ctx: AppContext): number {
  const raw = Number(ctx.settings.get<number>(LOG_PAGE_SIZE_ID, DEFAULTS.logPageSize));
  if (!Number.isFinite(raw)) return DEFAULTS.logPageSize;
  return Math.min(1000, Math.max(50, Math.round(raw)));
}

export function redactSecretsEnabled(ctx: AppContext): boolean {
  return ctx.settings.get<boolean>(REDACT_SECRETS_ID, DEFAULTS.redactSecrets) !== false;
}

/* ------------------------------------------------------------------ */
/* What this project's own compose file defines                        */
/* ------------------------------------------------------------------ */

export interface KnownContainer {
  name: string;
  service: string;
  /** Ports the compose file publishes, written exactly as it writes them. */
  ports: string[];
  /** Whether the compose file puts the service behind a profile. */
  profile: string | null;
}

/**
 * The two services `docker-compose.yml` in this repository defines.
 *
 * This is reference material for the empty state, not data: nothing here is
 * ever rendered as though the container exists. It exists so somebody looking
 * at an empty list is told what this project would normally run, rather than
 * being left to guess at a container name.
 */
export const KNOWN_CONTAINERS: KnownContainer[] = [
  {
    name: 'minecraft-world-downloader',
    service: 'world-downloader',
    ports: ['8080:8080', '25565:25565'],
    profile: null
  },
  {
    name: 'minecraft-world-downloader-bluemap',
    service: 'bluemap',
    ports: ['8100:8100'],
    profile: 'bluemap'
  }
];

/* ------------------------------------------------------------------ */
/* Operations                                                          */
/* ------------------------------------------------------------------ */

export type OperationPhase = 'sending' | 'waiting' | 'verifying' | 'succeeded' | 'failed';

export interface OperationState {
  /** The container name the operation addresses. Names are what Docker takes. */
  name: string;
  kind: OperationKind;
  startedAt: number;
  elapsedMs: number;
  /** Milliseconds Docker was told to wait before killing, for stop and restart. */
  graceMs: number | null;
  phase: OperationPhase;
  /** Everything the command printed, newest last. Bounded. */
  lines: string[];
  command: string;
  /** Filled in when the operation ends. */
  detail: string;
}

const MAX_OPERATION_LINES = 400;

/* ------------------------------------------------------------------ */
/* Panel handles                                                       */
/* ------------------------------------------------------------------ */

/** What a mounted destination lets the command palette drive. */
export interface PanelHandle {
  focusSearch(): void;
  exportRows(): void | Promise<void>;
}

export interface LogsPanelHandle extends PanelHandle {
  toggleFollow(): void;
}

/* ------------------------------------------------------------------ */
/* The state object                                                    */
/* ------------------------------------------------------------------ */

export class ServerState {
  readonly ctx: AppContext;

  private daemonStatus: DaemonStatus = { kind: 'unknown' };
  private containers: ContainerRow[] = [];
  private listError: string | null = null;
  private unreadableLines = 0;
  private lastListedAt: string | null = null;
  private readonly operations = new Map<string, OperationState>();
  private readonly listeners = new Set<() => void>();

  private timer: number | null = null;
  private attachments = 0;
  private refreshing = false;
  private probing = false;

  /** Set while a destination is mounted, so the palette can drive it. */
  containersPanel: PanelHandle | null = null;
  logsPanel: LogsPanelHandle | null = null;

  constructor(ctx: AppContext) {
    this.ctx = ctx;
  }

  /* ---------------- observation ---------------- */

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    for (const listener of [...this.listeners]) {
      try {
        listener();
      } catch (error) {
        console.error('A server manager listener failed:', error);
      }
    }
  }

  daemon(): DaemonStatus {
    return this.daemonStatus;
  }

  rows(): ContainerRow[] {
    return this.containers;
  }

  error(): string | null {
    return this.listError;
  }

  unreadable(): number {
    return this.unreadableLines;
  }

  listedAt(): string | null {
    return this.lastListedAt;
  }

  operation(name: string): OperationState | null {
    return this.operations.get(name) ?? null;
  }

  runningOperations(): OperationState[] {
    return [...this.operations.values()];
  }

  busy(name: string): boolean {
    const operation = this.operations.get(name);
    return operation !== undefined && operation.phase !== 'succeeded' && operation.phase !== 'failed';
  }

  anyBusy(): boolean {
    return this.runningOperations().some((operation) => operation.phase !== 'succeeded' && operation.phase !== 'failed');
  }

  /* ---------------- the poll loop ---------------- */

  /** Called by a destination while it is mounted. Returns the detach function. */
  attach(): () => void {
    this.attachments += 1;
    if (this.attachments === 1) {
      void this.refreshAll();
      this.startTimer();
    }
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.attachments -= 1;
      if (this.attachments <= 0) {
        this.attachments = 0;
        this.stopTimer();
      }
    };
  }

  private startTimer(): void {
    this.stopTimer();
    const interval = refreshSeconds(this.ctx) * 1000;
    this.timer = window.setInterval(() => {
      void this.refreshList();
    }, interval);
  }

  /** Re-reads the interval setting and restarts the loop at the new period. */
  restartTimer(): void {
    if (this.attachments > 0) this.startTimer();
  }

  private stopTimer(): void {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }

  /* ---------------- refreshing ---------------- */

  async probe(): Promise<DaemonStatus> {
    if (this.probing) return this.daemonStatus;
    this.probing = true;
    this.daemonStatus = { kind: 'checking' };
    this.emit();
    try {
      this.daemonStatus = await probeDaemon(this.ctx);
    } finally {
      this.probing = false;
    }
    this.emit();
    return this.daemonStatus;
  }

  /** Probes the daemon and, when it answered, lists the containers. */
  async refreshAll(): Promise<void> {
    const status = await this.probe();
    if (status.kind !== 'ready') {
      this.containers = [];
      this.listError = null;
      this.emit();
      return;
    }
    await this.refreshList();
  }

  /** Lists containers. Re-probes when the listing fails, so the state stays honest. */
  async refreshList(): Promise<void> {
    if (this.refreshing) return;
    if (this.daemonStatus.kind === 'checking') return;
    this.refreshing = true;
    try {
      const result = await listContainers(this.ctx);
      if (result.ok) {
        this.containers = result.rows;
        this.listError = null;
        this.unreadableLines = result.unreadableLines;
        this.lastListedAt = new Date().toISOString();
        if (this.daemonStatus.kind !== 'ready') {
          // The list succeeded, so whatever the last probe concluded is stale.
          this.daemonStatus = await probeDaemon(this.ctx);
        }
      } else {
        this.listError = result.error;
        this.daemonStatus = await probeDaemon(this.ctx);
        if (this.daemonStatus.kind !== 'ready') this.containers = [];
      }
    } finally {
      this.refreshing = false;
      this.emit();
    }
  }

  /* ---------------- operations ---------------- */

  /**
   * Runs one lifecycle command against one container.
   *
   * Re-entry is refused here as well as in the surface. The disabled button is
   * the visible guard; this is the real one, because a keyboard activation, a
   * palette command and a bulk action can all reach the same operation without
   * ever touching that button.
   */
  async run(kind: OperationKind, name: string): Promise<{ ok: boolean; detail: string }> {
    if (this.busy(name)) {
      return { ok: false, detail: `Another operation is already running against ${name}.` };
    }

    const grace = stopTimeoutSeconds(this.ctx);
    const usesGrace = kind === 'stop' || kind === 'restart';
    const args = operationArguments(kind, name, grace);
    const operation: OperationState = {
      name,
      kind,
      startedAt: Date.now(),
      elapsedMs: 0,
      graceMs: usesGrace ? grace * 1000 : null,
      phase: 'sending',
      lines: [],
      command: '',
      detail: ''
    };
    this.operations.set(name, operation);
    this.emit();

    // A real elapsed clock, ticking against the grace period Docker was actually
    // given. It is elapsed time, not a guess at completion, and the surface says
    // so — a percentage nobody can measure would be a decoration pretending to
    // be information.
    const ticker = window.setInterval(() => {
      operation.elapsedMs = Date.now() - operation.startedAt;
      if (operation.phase === 'sending' && operation.elapsedMs > 400) operation.phase = 'waiting';
      this.emit();
    }, 250);

    const appendLine = (chunk: string): void => {
      for (const line of chunk.split(/\r?\n/)) {
        const text = line.trim();
        if (text === '') continue;
        operation.lines.push(text);
      }
      while (operation.lines.length > MAX_OPERATION_LINES) operation.lines.shift();
    };

    const run = await runDocker(this.ctx, args, {
      // A stop is allowed to take its whole grace period and then some; the
      // ceiling is deliberately above it so a slow but succeeding stop is never
      // reported as a failure.
      timeoutMs: usesGrace ? grace * 1000 + 30_000 : 60_000,
      onOutput: (_stream, chunk) => {
        appendLine(chunk);
        this.emit();
      }
    });

    window.clearInterval(ticker);
    operation.elapsedMs = Date.now() - operation.startedAt;
    operation.command = run.command;
    operation.phase = 'verifying';
    this.emit();

    const succeeded = run.failure === null && run.ok;
    const detail = succeeded
      ? run.stdout.trim() || `${name} reported no output, and exited with status 0.`
      : run.failure ??
        (run.stderr.trim() || run.stdout.trim() || `The command exited with status ${String(run.code)}.`);

    operation.phase = succeeded ? 'succeeded' : 'failed';
    operation.detail = detail;
    this.emit();

    // The list is re-read before the result is reported, so what the surface
    // shows next is the state Docker is genuinely in rather than the state the
    // command was expected to produce.
    await this.refreshList();

    await this.ctx.history.record(
      succeeded ? `${labelForHistory(kind)} the container ${name}` : `Failed to ${kind} the container ${name}`,
      'server',
      {
        kind: `server.${kind}`,
        container: name,
        command: run.command,
        exitCode: run.code,
        succeeded,
        detail,
        elapsedMs: operation.elapsedMs
      }
    );

    // The finished record is kept for a short while so the surface can show the
    // outcome, then cleared so the row returns to its ordinary controls.
    window.setTimeout(() => {
      const current = this.operations.get(name);
      if (current === operation) {
        this.operations.delete(name);
        this.emit();
      }
    }, 6000);

    return { ok: succeeded, detail };
  }

  /** Clears a finished operation record immediately. */
  dismissOperation(name: string): void {
    const operation = this.operations.get(name);
    if (!operation) return;
    if (operation.phase !== 'succeeded' && operation.phase !== 'failed') return;
    this.operations.delete(name);
    this.emit();
  }
}

function labelForHistory(kind: OperationKind): string {
  switch (kind) {
    case 'start':
      return 'Started';
    case 'stop':
      return 'Stopped';
    case 'restart':
      return 'Restarted';
    case 'remove':
      return 'Removed';
  }
}

/* ------------------------------------------------------------------ */
/* Recovery routes                                                     */
/* ------------------------------------------------------------------ */

/** Where Docker Desktop installs itself, per platform. Probed, never assumed. */
const DESKTOP_PATHS: Partial<Record<string, string[]>> = {
  win32: [
    'C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe',
    'C:\\Program Files (x86)\\Docker\\Docker\\Docker Desktop.exe'
  ],
  darwin: ['/Applications/Docker.app'],
  linux: ['/opt/docker-desktop/bin/docker-desktop', '/usr/bin/docker-desktop']
};

/**
 * Looks for an installed Docker Desktop.
 *
 * This is what makes "the daemon is not running" actionable rather than a
 * sentence the user has to act on themselves: when the application is genuinely
 * on disk, the recovery button opens it. When it is not, no button is offered
 * and the surface says why, instead of shipping a control that would do nothing.
 */
export async function findDockerDesktop(ctx: AppContext): Promise<string | null> {
  const candidates = DESKTOP_PATHS[ctx.studio.info.platform] ?? [];
  for (const candidate of candidates) {
    const stat = await ctx.studio.fs.stat(candidate);
    if (stat.ok && stat.value.exists) return candidate;
  }
  return null;
}

/** The official installation page, opened in the user's browser on request only. */
export const DOCKER_INSTALL_URL = 'https://docs.docker.com/get-started/get-docker/';
