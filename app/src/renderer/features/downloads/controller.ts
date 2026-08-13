import type { AppContext } from '../../core/registry';
import { downloadBridge, type TransferProgressEvent, type TransferStateEvent } from './bridge';
import { showCompletion } from './completion';
import {
  ACTIVE_STATES,
  filenameFromUrl,
  joinPath,
  manualRecord,
  recordFromCapture,
  sanitizeFilename,
  type CapturePayload,
  type DownloadRecord,
  type DownloadState
} from './model';
import { alwaysOnTop } from './ontop';
import { closeProgressWindow, openProgressWindow } from './progressWindow';
import { DEFAULT_MAX_CONCURRENT, DEFAULT_PORT, DOWNLOAD_SETTINGS } from './settingIds';
import { openStartDialog } from './startDialog';
import { downloadStore } from './store';

/**
 * Everything that decides what happens to a download.
 *
 * The surfaces render; this decides. It owns the receiver's lifecycle, turns a
 * capture into a decision, turns a decision into a real transfer, folds the
 * engine's events back into the stored list, and enforces the concurrency limit
 * the user chose.
 *
 * Two rules run through all of it. Nothing transfers without a decision, and no
 * state is ever reported that the engine did not actually report.
 */

const HISTORY_SOURCE = 'downloads';

function newId(): string {
  return `dl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Maps an engine state name onto the record's state vocabulary. */
function mapState(engineState: string, previous: DownloadState): DownloadState {
  switch (engineState) {
    case 'connecting':
      return 'connecting';
    case 'downloading':
      return 'downloading';
    case 'paused':
      return 'paused';
    case 'completing':
      return 'downloading';
    case 'completed':
      return 'completed';
    case 'cancelled':
      return 'cancelled';
    case 'failed':
      return 'failed';
    default:
      return previous;
  }
}

export class DownloadsController {
  private ctx: AppContext | null = null;
  private started = false;
  private readonly disposers: Array<() => void> = [];

  attach(ctx: AppContext): void {
    if (this.ctx) return;
    this.ctx = ctx;
    downloadStore.attach(ctx);
    downloadBridge.attach(ctx.studio);
    alwaysOnTop.attach(ctx.studio);
    alwaysOnTop.setEnabled(ctx.settings.get<boolean>(DOWNLOAD_SETTINGS.alwaysOnTop, true));

    this.disposers.push(
      downloadBridge.captured.add((capture) => void this.onCapture(capture)),
      downloadBridge.transferState.add((event) => this.onTransferState(event)),
      downloadBridge.transferProgress.add((event) => this.onTransferProgress(event)),
      ctx.settings.onChange((change) => {
        if (change.id === DOWNLOAD_SETTINGS.alwaysOnTop) {
          alwaysOnTop.setEnabled(change.value === true);
        }
        if (change.id === DOWNLOAD_SETTINGS.port && downloadBridge.state().status === 'listening') {
          void this.startReceiver();
        }
      })
    );

    if (ctx.settings.get<boolean>(DOWNLOAD_SETTINGS.autoStartReceiver, false)) {
      void this.startReceiver();
    }
  }

  dispose(): void {
    for (const dispose of this.disposers.splice(0)) dispose();
    void downloadBridge.stop();
  }

  private require(): AppContext {
    if (!this.ctx) throw new Error('The downloads feature was used before it was initialised.');
    return this.ctx;
  }

  /* ---------------------------------------------------------------- */
  /* The receiver                                                      */
  /* ---------------------------------------------------------------- */

  async startReceiver(): Promise<void> {
    const ctx = this.require();
    const port = Number(ctx.settings.get<number>(DOWNLOAD_SETTINGS.port, DEFAULT_PORT));
    const state = await downloadBridge.start(Number.isFinite(port) ? port : DEFAULT_PORT);
    if (state.status === 'unavailable') {
      ctx.notify.error(
        ctx.t('downloads.receiver.unavailable.title', 'The capture receiver could not start'),
        state.error
      );
      return;
    }
    if (state.status === 'failed') {
      ctx.notify.error(ctx.t('downloads.receiver.failed.title', 'The capture receiver failed'), state.error);
    }
  }

  async stopReceiver(): Promise<void> {
    await downloadBridge.stop();
  }

  /* ---------------------------------------------------------------- */
  /* Captures                                                          */
  /* ---------------------------------------------------------------- */

  private defaultFolder(): string {
    const ctx = this.require();
    const chosen = ctx.settings.get<string>(DOWNLOAD_SETTINGS.folder, '');
    if (chosen.trim()) return chosen.trim();
    // No folder has been chosen yet, so the application's own data directory is
    // the one place it certainly may write. The settings row says so.
    return joinPath(ctx.studio.info.userDataDir, 'downloads');
  }

  private async onCapture(capture: CapturePayload): Promise<void> {
    const ctx = this.require();
    const folder = this.defaultFolder();
    const filename = sanitizeFilename(
      capture.suggestedFilename || filenameFromUrl(capture.url),
      filenameFromUrl(capture.url)
    );
    const record = downloadStore.add(recordFromCapture(capture, folder, filename, newId()));

    ctx.notify.info(
      ctx.t('downloads.capture.title', 'A download was captured'),
      ctx.t('downloads.capture.body', '{name} from {host}. Nothing has transferred yet.', {
        values: { name: record.filename, host: record.host }
      })
    );

    const ask = ctx.settings.get<boolean>(DOWNLOAD_SETTINGS.askBeforeStarting, true);
    if (!ask) {
      // Even when the user has asked not to be interrupted, the decision is
      // still theirs: it was made in advance, in settings, and the record says
      // which route it took.
      downloadBridge.resolveCapture(capture.captureId);
      await this.begin(record.id, { resume: false, announcedAutomatically: true });
      return;
    }

    const decision = await openStartDialog(ctx, record);
    downloadBridge.resolveCapture(capture.captureId);

    if (!decision.started) {
      downloadStore.patch(record.id, {
        state: 'cancelled',
        note: ctx.t(
          'downloads.capture.declined',
          'You chose not to download it, so nothing was transferred and nothing was written.'
        )
      });
      await ctx.history.record('Declined a captured download', HISTORY_SOURCE, {
        id: record.id,
        filename: record.filename,
        host: record.host
      });
      return;
    }

    downloadStore.patch(record.id, {
      filename: decision.filename,
      folder: decision.folder,
      destination: decision.destination,
      overwrite: decision.overwrite
    });
    await this.begin(record.id, { resume: false, announcedAutomatically: false });
  }

  /** Adds a download the user typed in themselves, through the same dialog. */
  async addManual(url: string): Promise<void> {
    const ctx = this.require();
    let parsed: URL;
    try {
      parsed = new URL(url.trim());
    } catch {
      ctx.notify.error(
        ctx.t('downloads.manual.invalid.title', 'That address cannot be downloaded'),
        ctx.t('downloads.manual.invalid.body', 'It is not a valid http or https URL, so nothing was added.')
      );
      return;
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      ctx.notify.error(
        ctx.t('downloads.manual.invalid.title', 'That address cannot be downloaded'),
        ctx.t('downloads.manual.scheme.body', 'Only http and https addresses are transferred; {scheme} was refused.', {
          values: { scheme: parsed.protocol.replace(':', '') }
        })
      );
      return;
    }

    const record = downloadStore.add(
      manualRecord(parsed.toString(), this.defaultFolder(), filenameFromUrl(parsed.toString()), newId())
    );
    const decision = await openStartDialog(ctx, record);
    if (!decision.started) {
      downloadStore.patch(record.id, {
        state: 'cancelled',
        note: ctx.t('downloads.manual.declined', 'You cancelled before it started, so nothing was written.')
      });
      return;
    }
    downloadStore.patch(record.id, {
      filename: decision.filename,
      folder: decision.folder,
      destination: decision.destination,
      overwrite: decision.overwrite
    });
    await this.begin(record.id, { resume: false, announcedAutomatically: false });
  }

  /* ---------------------------------------------------------------- */
  /* Starting, pausing, cancelling                                     */
  /* ---------------------------------------------------------------- */

  private activeCount(): number {
    return downloadStore.all().filter((record) => ACTIVE_STATES.includes(record.state)).length;
  }

  private maxConcurrent(): number {
    const ctx = this.require();
    const value = Number(ctx.settings.get<number>(DOWNLOAD_SETTINGS.maxConcurrent, DEFAULT_MAX_CONCURRENT));
    return Number.isFinite(value) && value >= 1 ? Math.floor(value) : DEFAULT_MAX_CONCURRENT;
  }

  /**
   * Begins or resumes one transfer, respecting the concurrency limit. A
   * download over the limit is genuinely queued, and says so, rather than being
   * started anyway and quietly competing for the same connection.
   */
  private async begin(id: string, options: { resume: boolean; announcedAutomatically: boolean }): Promise<void> {
    const ctx = this.require();
    const record = downloadStore.byId(id);
    if (!record) return;

    if (!downloadBridge.ready()) {
      downloadStore.patch(id, {
        state: 'failed',
        error: ctx.t(
          'downloads.error.noReceiver',
          'The capture receiver is not running, so nothing can be transferred. Start it from the Downloads tab.'
        )
      });
      ctx.notify.error(
        ctx.t('downloads.error.noReceiver.title', 'The receiver is not running'),
        ctx.t(
          'downloads.error.noReceiver',
          'The capture receiver is not running, so nothing can be transferred. Start it from the Downloads tab.'
        )
      );
      return;
    }

    if (this.activeCount() >= this.maxConcurrent()) {
      downloadStore.patch(id, {
        state: 'queued',
        note: ctx.t('downloads.queued.note', 'Waiting: {count} transfers are already running.', {
          values: { count: String(this.activeCount()) }
        })
      });
      return;
    }

    downloadStore.patch(id, {
      state: 'connecting',
      error: '',
      note: '',
      startedAt: record.startedAt ?? new Date().toISOString()
    });
    downloadBridge.activeTransfers = this.activeCount();

    const sent = downloadBridge.startTransfer({
      id: record.id,
      url: record.url,
      destination: record.destination,
      referrer: record.referrer,
      totalBytes: record.total,
      overwrite: record.overwrite,
      resume: options.resume
    });

    if (!sent) {
      downloadStore.patch(id, {
        state: 'failed',
        error: ctx.t('downloads.error.notSent', 'The instruction never reached the receiver, so nothing started.')
      });
      return;
    }

    if (ctx.settings.get<boolean>(DOWNLOAD_SETTINGS.openProgressWindow, true)) {
      openProgressWindow(ctx, id, this.progressHandlers());
    }

    await ctx.history.record(options.resume ? 'Resumed a download' : 'Started a download', HISTORY_SOURCE, {
      id: record.id,
      filename: record.filename,
      host: record.host,
      destination: record.destination,
      automatic: options.announcedAutomatically
    });
  }

  /** Starts whatever is queued, up to the limit, oldest capture first. */
  private drainQueue(): void {
    const room = this.maxConcurrent() - this.activeCount();
    if (room <= 0) return;
    const queued = downloadStore
      .inState('queued')
      .sort((left, right) => left.capturedAt.localeCompare(right.capturedAt))
      .slice(0, room);
    for (const record of queued) {
      void this.begin(record.id, { resume: record.received > 0, announcedAutomatically: true });
    }
  }

  pause(id: string): void {
    const ctx = this.require();
    const record = downloadStore.byId(id);
    if (!record) return;
    if (!ACTIVE_STATES.includes(record.state)) {
      ctx.notify.warn(
        ctx.t('downloads.pause.notRunning.title', 'That transfer is not running'),
        ctx.t('downloads.pause.notRunning.body', 'It is {state}, so there is nothing to pause.', {
          values: { state: record.state }
        })
      );
      return;
    }
    downloadBridge.pauseTransfer(id);
    void ctx.history.record('Paused a download', HISTORY_SOURCE, {
      id: record.id,
      filename: record.filename,
      receivedBytes: record.received
    });
  }

  resume(id: string): void {
    const record = downloadStore.byId(id);
    if (!record) return;
    void this.begin(id, { resume: record.received > 0, announcedAutomatically: false });
  }

  retry(id: string): void {
    const record = downloadStore.byId(id);
    if (!record) return;
    // A retry after a failure starts from whatever is genuinely on disk. When
    // nothing is, that is a fresh start, and the engine says which it did.
    void this.begin(id, { resume: record.received > 0, announcedAutomatically: false });
  }

  /**
   * Cancels a running or paused transfer. It removes the partial file, so it is
   * irreversible and goes through the two-key gate like every other
   * irreversible action.
   */
  async cancel(id: string, anchor: HTMLElement): Promise<void> {
    const ctx = this.require();
    const record = downloadStore.byId(id);
    if (!record) return;
    const approved = await ctx.confirm.request({
      action: ctx.t('downloads.cancel.action', 'Cancel the download of {name}', {
        values: { name: record.filename }
      }),
      affected: [record.destination, record.url],
      irreversible: ctx.t(
        'downloads.cancel.irreversible',
        'The partial file is deleted from disk and the bytes received so far are lost. The completed file is not created.'
      ),
      anchor,
      confirmLabel: ctx.t('downloads.cancel.confirm', 'Cancel it and delete the partial file')
    });
    if (!approved) return;
    downloadBridge.cancelTransfer(id, true);
    await ctx.history.record('Cancelled a download', HISTORY_SOURCE, {
      id: record.id,
      filename: record.filename,
      receivedBytes: record.received
    });
  }

  /** Removes records from the list. It never deletes a completed file. */
  async remove(ids: string[], anchor: HTMLElement): Promise<void> {
    const ctx = this.require();
    const records = ids
      .map((id) => downloadStore.byId(id))
      .filter((record): record is DownloadRecord => record !== null);
    if (records.length === 0) return;

    const running = records.filter((record) => ACTIVE_STATES.includes(record.state));
    const approved = await ctx.confirm.request({
      action: ctx.t('downloads.remove.action', 'Remove {count} downloads from the list', {
        values: { count: String(records.length) }
      }),
      affected: records.map((record) => `${record.filename} — ${record.destination}`),
      irreversible:
        running.length > 0
          ? ctx.t(
              'downloads.remove.irreversible.running',
              'The list entries are deleted and cannot be recovered. {count} of them are still transferring and will be cancelled, deleting their partial files. Files that already finished are left on disk untouched.',
              { values: { count: String(running.length) } }
            )
          : ctx.t(
              'downloads.remove.irreversible',
              'The list entries are deleted and cannot be recovered. Files that already finished are left on disk untouched.'
            ),
      anchor,
      confirmLabel: ctx.t('downloads.remove.confirm', 'Remove them from the list')
    });
    if (!approved) return;

    for (const record of running) downloadBridge.cancelTransfer(record.id, true);
    for (const record of records) {
      downloadBridge.forgetTransfer(record.id);
      closeProgressWindow(record.id);
    }
    const removed = downloadStore.remove(ids);
    await ctx.history.record('Removed downloads from the list', HISTORY_SOURCE, {
      ids: removed.map((record) => record.id),
      filenames: removed.map((record) => record.filename),
      cancelled: running.length
    });
    ctx.notify.success(
      ctx.t('downloads.remove.done.title', 'Removed from the list'),
      ctx.t('downloads.remove.done.body', '{count} entries were removed. Finished files were left on disk.', {
        values: { count: String(removed.length) }
      })
    );
  }

  async open(id: string): Promise<void> {
    const ctx = this.require();
    const record = downloadStore.byId(id);
    if (!record) return;
    const result = await ctx.studio.shell.openPath(record.destination);
    if (!result.ok) {
      ctx.notify.error(
        ctx.t('downloads.open.failed.title', 'The file could not be opened'),
        `${record.destination}: ${result.error}`
      );
    }
  }

  async reveal(id: string): Promise<void> {
    const ctx = this.require();
    const record = downloadStore.byId(id);
    if (!record) return;
    const result = await ctx.studio.shell.showItemInFolder(record.destination);
    if (!result.ok) {
      ctx.notify.error(
        ctx.t('downloads.reveal.failed.title', 'The folder could not be opened'),
        `${record.destination}: ${result.error}`
      );
    }
  }

  showInList(id: string): void {
    const ctx = this.require();
    ctx.tabs.teleport('downloads.main', `downloads-row-${id}`);
  }

  progressHandlers() {
    return {
      pause: (id: string) => this.pause(id),
      resume: (id: string) => this.resume(id),
      cancel: (id: string, anchor: HTMLElement) => void this.cancel(id, anchor),
      open: (id: string) => void this.open(id),
      reveal: (id: string) => void this.reveal(id),
      retry: (id: string) => this.retry(id)
    };
  }

  openProgress(id: string): void {
    openProgressWindow(this.require(), id, this.progressHandlers());
  }

  /* ---------------------------------------------------------------- */
  /* Engine events                                                     */
  /* ---------------------------------------------------------------- */

  private onTransferProgress(event: TransferProgressEvent): void {
    downloadStore.patch(event.id, {
      received: event.received,
      total: event.total,
      bytesPerSecond: event.bytesPerSecond,
      etaSeconds: event.etaSeconds
    });
  }

  private onTransferState(event: TransferStateEvent): void {
    const ctx = this.require();
    const record = downloadStore.byId(event.id);
    if (!record) return;
    const state = mapState(event.state, record.state);
    const patch: Partial<DownloadRecord> = {
      state,
      received: event.received,
      total: event.total,
      destination: event.destination || record.destination,
      resumable: typeof event.resumable === 'boolean' ? event.resumable : record.resumable,
      note: event.note ?? (state === 'downloading' ? '' : record.note),
      error: event.error ?? (state === 'failed' ? record.error : '')
    };
    if (state === 'completed' || state === 'failed' || state === 'cancelled') {
      patch.finishedAt = event.finishedAt ?? new Date().toISOString();
      patch.bytesPerSecond = 0;
      patch.etaSeconds = null;
    }
    if (event.serverFilename && event.serverFilename !== record.suggestedFilename) {
      patch.suggestedFilename = event.serverFilename;
    }
    if (event.contentType && !record.mimeType) patch.mimeType = event.contentType;

    const updated = downloadStore.patch(event.id, patch);
    downloadBridge.activeTransfers = this.activeCount();
    if (!updated) return;

    if (state === 'completed') {
      void ctx.history.record('Completed a download', HISTORY_SOURCE, {
        id: updated.id,
        filename: updated.filename,
        destination: updated.destination,
        bytes: updated.received
      });
      if (ctx.settings.get<boolean>(DOWNLOAD_SETTINGS.showCompletion, true)) {
        showCompletion(ctx, updated, this.completionHandlers());
      } else {
        ctx.notify.success(
          ctx.t('downloads.complete.title', 'Download complete'),
          `${updated.filename} — ${updated.destination}`
        );
      }
      if (ctx.settings.get<boolean>(DOWNLOAD_SETTINGS.revealOnCompletion, false)) {
        void ctx.studio.shell.showItemInFolder(updated.destination);
      }
      this.drainQueue();
      return;
    }

    if (state === 'failed') {
      void ctx.history.record('A download failed', HISTORY_SOURCE, {
        id: updated.id,
        filename: updated.filename,
        receivedBytes: updated.received,
        reason: updated.error
      });
      if (ctx.settings.get<boolean>(DOWNLOAD_SETTINGS.showCompletion, true)) {
        showCompletion(ctx, updated, this.completionHandlers());
      } else {
        ctx.notify.error(ctx.t('downloads.failed.title', 'Download failed'), `${updated.filename}: ${updated.error}`);
      }
      this.drainQueue();
      return;
    }

    if (state === 'cancelled' || state === 'paused') {
      this.drainQueue();
    }
  }

  private completionHandlers() {
    return {
      open: (id: string) => void this.open(id),
      reveal: (id: string) => void this.reveal(id),
      show: (id: string) => this.showInList(id),
      retry: (id: string) => this.retry(id)
    };
  }
}

export const downloadsController = new DownloadsController();
