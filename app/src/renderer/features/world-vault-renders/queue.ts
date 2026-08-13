/**
 * The render queue.
 *
 * This is the feature, per the task this module exists to satisfy: bounded
 * concurrency, cancellable, resumable, with real progress that is never a
 * bare spinner, and — the property that is easy to get quietly wrong — it
 * never blocks the commit that queued it or the download that produced the
 * commit. `enqueue` is synchronous and only ever appends to a plain array; the
 * actual work happens in `pump`, which is fire-and-forget from every caller's
 * point of view.
 *
 * Two hazards this class exists to close:
 *
 * - A commit whose render has not run, was cancelled, or failed says exactly
 *   that. There is no code path that shows one commit's record for another —
 *   every record is keyed by, and only ever updated for, its own commit id,
 *   and a UI that reads `records.get(commitId)` either gets that commit's own
 *   truth or `undefined`, never a neighbour's.
 * - A queue that falls behind is reported as behind, not silently dropped.
 *   Nothing here has a maximum queue length that discards work; instead, once
 *   the backlog crosses a configurable threshold, the queued entries beyond
 *   it are labelled `behind` (still queued, still processed in order) and a
 *   single debounced notification says the queue is falling behind, rather
 *   than saying nothing while commits quietly pile up.
 */

import type { StudioApi } from '../../../shared/api';
import { detectDimensions, renderArguments, writeRenderConfig, type RenderPlan } from './renderConfig';
import { isErrorLine, parseProgressLine, stripLogPrefix } from './logParsing';
import { probeJava, rendererLauncher, validateRendererPath } from './probe';
import { exportVaultCommit, type VaultCommit } from './vaultLink';
import { newRenderRecord, type JavaState, type RenderRecord, type RenderStatus } from './types';

const LOG_LINES = 150;

export interface QueueSettings {
  concurrency: number;
  rendererPath: string;
  acceptDownload: boolean;
  threads: number;
}

export interface QueuePaths {
  /** Base directory exported commit snapshots are written under, one subfolder per commit. */
  exportRoot: string;
  /** Base directory render output (`web/`, `config/`) is written under, one subfolder per commit. */
  outputRoot: string;
}

function joinPath(base: string, ...segments: string[]): string {
  const sep = base.includes('\\') && !base.startsWith('/') ? '\\' : '/';
  let out = base.replace(/[\\/]+$/, '');
  for (const segment of segments) {
    const clean = segment.replace(/^[\\/]+/, '').replace(/[\\/]+$/, '');
    if (clean !== '') out += sep + clean;
  }
  return out;
}

export interface QueueEvents {
  onHistory(action: string, payload: unknown): void;
  onBacklog(depth: number): void;
}

export class RenderQueue {
  private readonly records = new Map<string, RenderRecord>();
  private readonly commits = new Map<string, VaultCommit>();
  private readonly order: string[] = [];
  private readonly running = new Set<string>();
  private readonly cancelRequested = new Set<string>();
  private readonly processUnsubscribes = new Map<string, () => void>();
  private readonly listeners = new Set<() => void>();
  private javaState: JavaState = { kind: 'unknown' };
  private backlogWarnedAt = 0;

  constructor(
    private readonly studio: StudioApi,
    private readonly paths: QueuePaths,
    private readonly getSettings: () => QueueSettings,
    private readonly events: QueueEvents,
    private readonly backlogWarningThreshold: () => number
  ) {}

  /** Restores records persisted from a previous session. Never overwrites a record already known. */
  hydrate(records: RenderRecord[], commits: VaultCommit[]): void {
    for (const commit of commits) this.commits.set(commit.id, commit);
    for (const record of records) {
      if (this.records.has(record.commitId)) continue;
      // A record still mid-flight when the app last closed cannot still be
      // mid-flight now; it is honestly reported as queued again rather than
      // claiming a progress percentage nothing is currently producing.
      const restored: RenderRecord =
        record.status === 'exporting' || record.status === 'rendering'
          ? { ...record, status: 'queued', progressFraction: null, progressTask: '' }
          : record;
      this.records.set(record.commitId, restored);
      this.order.push(record.commitId);
    }
    this.emit();
    this.updateBacklogLabels();
    // A commit still queued when the application last closed is real,
    // unfinished work — "resumable" means it picks back up on its own here,
    // not that it waits for the next unrelated commit to nudge the queue.
    void this.pump();
  }

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
      } catch {
        /* one broken subscriber must not stop the others, or the queue */
      }
    }
  }

  snapshot(): RenderRecord[] {
    return this.order.map((id) => this.records.get(id)).filter((record): record is RenderRecord => record !== undefined);
  }

  recordFor(commitId: string): RenderRecord | null {
    return this.records.get(commitId) ?? null;
  }

  isQueued(commitId: string): boolean {
    const record = this.records.get(commitId);
    return record !== undefined && (record.status === 'queued' || record.status === 'behind');
  }

  isBusy(commitId: string): boolean {
    const record = this.records.get(commitId);
    return record !== undefined && (record.status === 'exporting' || record.status === 'rendering');
  }

  /** The spawn id currently running this commit's render, if any. Used by callers driving process:event in tests. */
  activeProcessIdFor(commitId: string): string | null {
    return this.activeProcessId.get(commitId) ?? null;
  }

  /** Queues a render for one commit. A commit already known is never re-queued; call `retry` for that. */
  enqueue(commit: VaultCommit): void {
    this.commits.set(commit.id, commit);
    if (this.records.has(commit.id)) return;
    this.records.set(commit.id, newRenderRecord(commit));
    this.order.push(commit.id);
    this.emit();
    this.updateBacklogLabels();
    void this.pump();
  }

  /** Re-queues a failed or cancelled render. Does nothing for a commit that is queued or running already. */
  retry(commitId: string): void {
    const record = this.records.get(commitId);
    const commit = this.commits.get(commitId);
    if (!record || !commit) return;
    if (record.status === 'queued' || record.status === 'behind' || this.running.has(commitId)) return;
    this.cancelRequested.delete(commitId);
    this.records.set(commitId, {
      ...newRenderRecord(commit),
      exportDirectory: record.exportDirectory,
      log: []
    });
    this.emit();
    this.updateBacklogLabels();
    void this.pump();
  }

  /** Cancels a queued or running render. Safe to call for one that has already finished. */
  cancel(commitId: string): void {
    const record = this.records.get(commitId);
    if (!record) return;
    if (record.status === 'queued' || record.status === 'behind') {
      this.records.set(commitId, { ...record, status: 'cancelled', endedAt: new Date().toISOString() });
      this.emit();
      this.updateBacklogLabels();
      return;
    }
    if (record.status === 'exporting' || record.status === 'rendering') {
      this.cancelRequested.add(commitId);
      // The process kill itself happens in `runOne`'s process-event handling
      // once it can address the right spawn id; this only records the intent
      // so a race between "still starting" and "cancel clicked" is not lost.
      const processId = this.activeProcessId.get(commitId);
      if (processId) void this.studio.process.kill(processId);
    }
  }

  private readonly activeProcessId = new Map<string, string>();

  private updateBacklogLabels(): void {
    const threshold = Math.max(1, this.backlogWarningThreshold());
    const queuedIds = this.order.filter((id) => {
      const record = this.records.get(id);
      return record && (record.status === 'queued' || record.status === 'behind');
    });
    let changed = false;
    queuedIds.forEach((id, position) => {
      const record = this.records.get(id);
      if (!record) return;
      const shouldBeBehind = position >= threshold;
      const nextStatus: RenderStatus = shouldBeBehind ? 'behind' : 'queued';
      if (record.status !== nextStatus) {
        this.records.set(id, { ...record, status: nextStatus });
        changed = true;
      }
    });
    if (changed) this.emit();
    if (queuedIds.length >= threshold) {
      const now = Date.now();
      if (now - this.backlogWarnedAt > 60_000) {
        this.backlogWarnedAt = now;
        this.events.onBacklog(queuedIds.length);
      }
    } else {
      this.backlogWarnedAt = 0;
    }
  }

  private async pump(): Promise<void> {
    const settings = this.getSettings();
    const limit = Math.max(1, Math.min(4, settings.concurrency));
    while (this.running.size < limit) {
      const next = this.order.find((id) => {
        const record = this.records.get(id);
        return record && (record.status === 'queued' || record.status === 'behind');
      });
      if (!next) break;
      this.running.add(next);
      void this.runOne(next).finally(() => {
        this.running.delete(next);
        this.updateBacklogLabels();
        void this.pump();
      });
    }
  }

  private setRecord(commitId: string, patch: Partial<RenderRecord>): void {
    const current = this.records.get(commitId);
    if (!current) return;
    this.records.set(commitId, { ...current, ...patch });
    this.emit();
  }

  private appendLog(commitId: string, line: string): void {
    const text = stripLogPrefix(line);
    if (text === '') return;
    const current = this.records.get(commitId);
    if (!current) return;
    const log = [...current.log, text];
    this.setRecord(commitId, { log: log.length > LOG_LINES ? log.slice(log.length - LOG_LINES) : log });
  }

  private async runOne(commitId: string): Promise<void> {
    const commit = this.commits.get(commitId);
    if (!commit) return;
    if (this.cancelRequested.has(commitId)) {
      this.cancelRequested.delete(commitId);
      this.setRecord(commitId, { status: 'cancelled', endedAt: new Date().toISOString() });
      return;
    }

    this.setRecord(commitId, { status: 'exporting', startedAt: new Date().toISOString(), progressTask: '' });

    const exportDirectory = joinPath(this.paths.exportRoot, commit.vaultId, commit.id);
    const alreadyExported = await this.studio.fs.stat(exportDirectory);
    let exportedPath = exportDirectory;
    if (!alreadyExported.ok || !alreadyExported.value.exists) {
      const exported = await exportVaultCommit(commit, exportDirectory);
      if (this.cancelRequested.has(commitId)) {
        this.cancelRequested.delete(commitId);
        this.setRecord(commitId, { status: 'cancelled', endedAt: new Date().toISOString() });
        return;
      }
      if (!exported.ok) {
        this.setRecord(commitId, {
          status: 'failed',
          failure: { kind: 'export-failed', detail: exported.error },
          endedAt: new Date().toISOString()
        });
        return;
      }
      exportedPath = exported.path;
    }
    this.setRecord(commitId, { exportDirectory: exportedPath });

    if (this.javaState.kind !== 'available') {
      this.javaState = await probeJava(this.studio);
    }
    if (this.javaState.kind !== 'available') {
      this.setRecord(commitId, {
        status: 'failed',
        failure: {
          kind: 'java-missing',
          detail: this.javaState.kind === 'missing' ? this.javaState.reason : 'A Java runtime could not be found.'
        },
        endedAt: new Date().toISOString()
      });
      return;
    }

    const settings = this.getSettings();
    const rendererState = await validateRendererPath(this.studio, settings.rendererPath);
    if (rendererState.kind === 'unconfigured') {
      this.setRecord(commitId, {
        status: 'failed',
        failure: { kind: 'renderer-not-configured', detail: 'No renderer file is configured in settings.' },
        endedAt: new Date().toISOString()
      });
      return;
    }
    if (rendererState.kind === 'invalid') {
      this.setRecord(commitId, {
        status: 'failed',
        failure: { kind: 'renderer-invalid', detail: rendererState.reason },
        endedAt: new Date().toISOString()
      });
      return;
    }

    const dimensions = await detectDimensions(this.studio, exportedPath);
    const outputDirectory = joinPath(this.paths.outputRoot, commit.vaultId, commit.id);
    const plan: RenderPlan = {
      exportDirectory: exportedPath,
      outputDirectory,
      dimensions,
      worldLabel: commit.worldName,
      threads: settings.threads,
      acceptDownload: settings.acceptDownload
    };

    const written = await writeRenderConfig(this.studio, plan);
    if (!written.ok) {
      this.setRecord(commitId, {
        status: 'failed',
        failure: { kind: 'render-failed', detail: written.error },
        endedAt: new Date().toISOString()
      });
      return;
    }

    const webStat = await this.studio.fs.stat(written.value.webroot);
    const firstRenderEver = !(webStat.ok && webStat.value.exists);

    const launcher = rendererLauncher(rendererState.path, rendererState.rendererKind);
    if (!launcher) {
      this.setRecord(commitId, {
        status: 'failed',
        failure: { kind: 'renderer-invalid', detail: 'The configured renderer path is neither a .jar nor a Node entry point.' },
        endedAt: new Date().toISOString()
      });
      return;
    }

    this.setRecord(commitId, {
      status: 'rendering',
      dimensions,
      webroot: written.value.webroot,
      configDirectory: written.value.configDirectory
    });

    const args = [...launcher.leading, ...renderArguments(written.value.configDirectory, firstRenderEver)];
    const spawned = await this.studio.process.spawn({
      command: launcher.command,
      args,
      cwd: outputDirectory,
      maxOutputBytes: 8 * 1024 * 1024
    });
    if (!spawned.ok) {
      this.setRecord(commitId, {
        status: 'failed',
        failure: { kind: 'spawn-failed', detail: spawned.error },
        endedAt: new Date().toISOString()
      });
      return;
    }

    this.activeProcessId.set(commitId, spawned.value.id);
    this.appendLog(commitId, `${launcher.command} ${args.join(' ')}`);
    if (this.cancelRequested.has(commitId)) {
      await this.studio.process.kill(spawned.value.id);
    }

    await new Promise<void>((resolve) => {
      const processId = spawned.value.id;
      let lastErrorLine: string | null = null;

      const unsubscribe = this.studio.events.on('process:event', (event) => {
        if (event.id !== processId) return;

        if (event.kind === 'stdout' || event.kind === 'stderr') {
          for (const line of event.chunk.split(/\r?\n/)) {
            if (line.trim() === '') continue;
            this.appendLog(commitId, line);
            const progress = parseProgressLine(line);
            if (progress) this.setRecord(commitId, { progressFraction: progress.fraction, progressTask: progress.description });
            if (isErrorLine(line)) lastErrorLine = stripLogPrefix(line);
          }
          return;
        }

        if (event.kind === 'truncated') {
          this.appendLog(
            commitId,
            `Output past ${String(event.retainedBytes)} bytes on ${event.stream} was dropped. The render itself is unaffected.`
          );
          return;
        }

        if (event.kind === 'error') {
          unsubscribe();
          this.processUnsubscribes.delete(commitId);
          this.activeProcessId.delete(commitId);
          this.setRecord(commitId, {
            status: 'failed',
            failure: { kind: 'spawn-failed', detail: event.message },
            endedAt: new Date().toISOString()
          });
          resolve();
          return;
        }

        if (event.kind === 'exit') {
          unsubscribe();
          this.processUnsubscribes.delete(commitId);
          this.activeProcessId.delete(commitId);
          const wasCancelled = this.cancelRequested.has(commitId);
          this.cancelRequested.delete(commitId);

          if (wasCancelled) {
            this.setRecord(commitId, { status: 'cancelled', endedAt: new Date().toISOString() });
          } else if (event.code === 0) {
            this.setRecord(commitId, {
              status: 'finished',
              endedAt: new Date().toISOString(),
              progressFraction: 1,
              progressTask: ''
            });
            this.events.onHistory('Rendered a world-vault commit', {
              commitId,
              vaultId: commit.vaultId,
              dimensions,
              webroot: written.value.webroot
            });
          } else {
            const reason =
              event.signal !== null
                ? `The renderer was stopped by signal ${event.signal}.`
                : `The renderer exited with code ${String(event.code)}.`;
            this.setRecord(commitId, {
              status: 'failed',
              failure: { kind: 'render-failed', detail: lastErrorLine ?? reason },
              endedAt: new Date().toISOString()
            });
          }
          resolve();
        }
      });
      this.processUnsubscribes.set(commitId, unsubscribe);
    });
  }

  /** Releases every process subscription. Running processes are left running; call `cancel` first if that matters. */
  dispose(): void {
    for (const unsubscribe of this.processUnsubscribes.values()) unsubscribe();
    this.processUnsubscribes.clear();
    this.listeners.clear();
  }
}
