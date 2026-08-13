/**
 * Driving the headless renderer: one run at a time, with real progress.
 *
 * The renderer is a child process that logs what it is doing, so the progress
 * this reports is the renderer's own percentage rather than an animation that
 * happens to move while something unrelated is happening. When the renderer has
 * no percentage to give — while it is loading resources, for instance — the
 * state says so in words instead of inventing a number.
 *
 * Re-entry is refused in the runner, not only in the button. A disabled button
 * is the visible guard; it is not the real one, because a keyboard submit, a
 * palette command and a context-menu action all reach the same code without ever
 * passing the button. `start` therefore returns a refusal when a run is already
 * in flight, and that refusal is a normal outcome rather than an exception.
 */

import type { ProcessEvent, StudioApi } from '../../../shared/api';
import { renderArguments, writeRenderConfig, type RenderPlan } from './config';
import { publishMapEndpoint, publishRenderOutput } from './endpoint';
import {
  isErrorLine,
  isRenderComplete,
  launcherFor,
  parseListening,
  parseProgressLine,
  stripLogPrefix,
  type CliKind
} from './probe';

export type RunPhase =
  | 'idle'
  | 'preparing'
  | 'starting'
  | 'rendering'
  | 'serving'
  | 'watching'
  | 'stopping'
  | 'finished'
  | 'cancelled'
  | 'failed';

export interface RunState {
  phase: RunPhase;
  /** The plan this run is for, or null when nothing has run yet. */
  plan: RenderPlan | null;
  /** The renderer's own description of what it is doing now. */
  task: string;
  /** 0..1, or null when the renderer has not reported a percentage yet. */
  fraction: number | null;
  /** The renderer's own estimate of the time remaining, already formatted. */
  eta: string | null;
  /** The loopback address, once the server reports itself listening. */
  serving: { host: string; port: number; url: string } | null;
  /** The last few lines the renderer printed, newest last. */
  log: string[];
  /** Set when the run failed, in the words the renderer used. */
  error: string | null;
  /** ISO-8601 time the run started. */
  startedAt: string | null;
  /** ISO-8601 time the run reached a terminal phase. */
  endedAt: string | null;
}

/** How many output lines are retained for the surface. */
const LOG_LINES = 200;

function emptyState(): RunState {
  return {
    phase: 'idle',
    plan: null,
    task: '',
    fraction: null,
    eta: null,
    serving: null,
    log: [],
    error: null,
    startedAt: null,
    endedAt: null
  };
}

export type StartRefusal =
  | { kind: 'busy' }
  | { kind: 'no-renderer' }
  | { kind: 'config-failed'; error: string }
  | { kind: 'spawn-failed'; error: string };

export type StartOutcome = { ok: true } | { ok: false; refusal: StartRefusal };

/**
 * Owns the single running renderer.
 *
 * One instance is created by the feature module and shared by the tab, the
 * palette commands and the settings actions, so every route into a render goes
 * through the same re-entry guard and the same state.
 */
export class RenderRunner {
  private state: RunState = emptyState();
  private readonly listeners = new Set<(state: RunState) => void>();
  private processId: string | null = null;
  private unsubscribe: (() => void) | null = null;
  private cancelling = false;

  constructor(
    private readonly studio: StudioApi,
    private readonly onHistory: (action: string, payload: unknown) => void
  ) {}

  snapshot(): RunState {
    return { ...this.state, log: [...this.state.log], plan: this.state.plan };
  }

  subscribe(listener: (state: RunState) => void): () => void {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** True while a render is in flight. Every entry point checks this. */
  busy(): boolean {
    return (
      this.state.phase === 'preparing' ||
      this.state.phase === 'starting' ||
      this.state.phase === 'rendering' ||
      this.state.phase === 'serving' ||
      this.state.phase === 'watching' ||
      this.state.phase === 'stopping'
    );
  }

  private emit(patch: Partial<RunState>): void {
    this.state = { ...this.state, ...patch };
    const snapshot = this.snapshot();
    for (const listener of [...this.listeners]) {
      try {
        listener(snapshot);
      } catch {
        // One broken subscriber must not stop the others being told, and must
        // not take the render down with it.
      }
    }
  }

  private append(line: string): void {
    const text = stripLogPrefix(line);
    if (text === '') return;
    const log = [...this.state.log, text];
    this.emit({ log: log.length > LOG_LINES ? log.slice(log.length - LOG_LINES) : log });
  }

  /**
   * Starts a render.
   *
   * Refuses rather than throws, and refuses for exactly one of four reasons the
   * caller can report to the user in its own words.
   */
  async start(plan: RenderPlan, rendererPath: string, cliKind: CliKind): Promise<StartOutcome> {
    if (this.busy()) return { ok: false, refusal: { kind: 'busy' } };

    const launcher = launcherFor(rendererPath, cliKind);
    if (!launcher) return { ok: false, refusal: { kind: 'no-renderer' } };

    this.cancelling = false;
    this.emit({
      phase: 'preparing',
      plan,
      task: '',
      fraction: null,
      eta: null,
      serving: null,
      log: [],
      error: null,
      startedAt: new Date().toISOString(),
      endedAt: null
    });
    publishMapEndpoint(null);

    const written = await writeRenderConfig(this.studio, plan);
    if (!written.ok) {
      this.finish('failed', written.error);
      return { ok: false, refusal: { kind: 'config-failed', error: written.error } };
    }
    for (const file of written.value.files) this.append(`Wrote ${file}`);

    this.emit({ phase: 'starting' });
    const args = [...launcher.leading, ...renderArguments(written.value.configDirectory, plan)];
    const spawned = await this.studio.process.spawn({
      command: launcher.command,
      args,
      cwd: plan.outputDirectory,
      maxOutputBytes: 8 * 1024 * 1024
    });
    if (!spawned.ok) {
      this.finish('failed', spawned.error);
      return { ok: false, refusal: { kind: 'spawn-failed', error: spawned.error } };
    }

    this.processId = spawned.value.id;
    this.append(`${launcher.command} ${args.join(' ')}`);
    this.emit({ phase: 'rendering', task: 'Loading the world and its resources' });

    const written_ = written.value;
    this.unsubscribe = this.studio.events.on('process:event', (event: ProcessEvent) => {
      if (event.id !== this.processId) return;
      this.handleEvent(event, plan, written_.webroot, written_.mapsRoot, written_.mapIds);
    });

    this.onHistory('Started a Worldlens render', {
      world: plan.world.path,
      dimensions: plan.dimensions,
      output: plan.outputDirectory,
      port: plan.port,
      watch: plan.watch,
      force: plan.force
    });
    return { ok: true };
  }

  private handleEvent(
    event: ProcessEvent,
    plan: RenderPlan,
    webroot: string,
    mapsRoot: string,
    mapIds: string[]
  ): void {
    if (event.kind === 'stdout' || event.kind === 'stderr') {
      for (const line of event.chunk.split(/\r?\n/)) {
        if (line.trim() === '') continue;
        this.append(line);

        const progress = parseProgressLine(line);
        if (progress) {
          this.emit({
            phase: this.state.phase === 'watching' ? 'watching' : 'rendering',
            task: progress.description,
            fraction: progress.fraction,
            eta: progress.eta
          });
        }

        const listening = parseListening(line);
        if (listening) {
          const url = `http://${listening.host}:${String(listening.port)}/`;
          this.emit({ serving: { ...listening, url } });
          publishMapEndpoint({
            url,
            host: listening.host,
            port: listening.port,
            webroot,
            worldPath: plan.world.path,
            worldName: plan.world.displayName,
            mapIds,
            startedAt: new Date().toISOString()
          });
        }

        if (isRenderComplete(line)) {
          publishRenderOutput({
            directory: plan.outputDirectory,
            webroot,
            mapsRoot,
            worldPath: plan.world.path,
            completedAt: new Date().toISOString()
          });
          this.emit({
            phase: plan.watch ? 'watching' : 'serving',
            task: plan.watch ? 'Watching the world for changes' : 'Serving the rendered map',
            fraction: 1,
            eta: null
          });
        } else if (isErrorLine(line) && this.state.error === null) {
          this.emit({ error: stripLogPrefix(line) });
        }
      }
      return;
    }

    if (event.kind === 'truncated') {
      this.append(
        `Output past ${String(event.retainedBytes)} bytes on ${event.stream} was dropped. The render itself is unaffected.`
      );
      return;
    }

    if (event.kind === 'error') {
      this.emit({ error: event.message });
      this.finish('failed', event.message);
      return;
    }

    if (event.kind === 'exit') {
      if (this.cancelling) {
        this.finish('cancelled', null);
        return;
      }
      if (event.code === 0) {
        this.finish('finished', null);
        return;
      }
      const reason =
        event.signal !== null
          ? `The renderer was stopped by signal ${event.signal}.`
          : `The renderer exited with code ${String(event.code)}.`;
      this.finish('failed', this.state.error ?? reason);
    }
  }

  private finish(phase: RunPhase, error: string | null): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.processId = null;
    publishMapEndpoint(null);
    this.emit({
      phase,
      serving: null,
      error,
      endedAt: new Date().toISOString(),
      eta: null
    });
    this.onHistory(
      phase === 'finished'
        ? 'A Worldlens render finished'
        : phase === 'cancelled'
          ? 'A Worldlens render was cancelled'
          : 'A Worldlens render failed',
      { error }
    );
  }

  /** Stops the running renderer. Safe to call when nothing is running. */
  async stop(): Promise<void> {
    if (!this.processId) return;
    this.cancelling = true;
    this.emit({ phase: 'stopping', task: 'Stopping the renderer' });
    const killed = await this.studio.process.kill(this.processId);
    if (!killed.ok) {
      this.emit({ error: killed.error });
      this.finish('failed', killed.error);
    }
  }

  /** Releases the process subscription. The renderer itself is left running. */
  dispose(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.listeners.clear();
  }
}
