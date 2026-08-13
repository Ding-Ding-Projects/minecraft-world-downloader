import type { AppContext } from '../../core/registry';
import type { HttpAllowRule, HttpResponse, Result } from '../../../shared/api';

import { base64ToBytes, bytesToBase64, concatChunks, sha1Hex } from './bytes';
import { chooseCandidate, parseFeed } from './feed';
import {
  ACCEPT_PRERELEASE_ID,
  ALLOW_DOWNGRADE_ID,
  AUTO_DOWNLOAD_ID,
  CHECK_ON_STARTUP_ID,
  CHUNK_BYTES_ID,
  DEFAULT_CHUNK_BYTES,
  DEFAULT_FEED_URL,
  DEFAULT_MAX_PACKAGE_BYTES,
  DEFAULT_RELEASE_NOTES_URL,
  ENABLED_ID,
  FEED_URL_ID,
  INTERVAL_HOURS_ID,
  MAX_PACKAGE_BYTES_ID,
  RELEASE_NOTES_ID,
  SNOOZE_HOURS_ID,
  STARTUP_DELAY_ID,
  STORED_LAST_CHECK_ID,
  STORED_LOG_ID,
  STORED_SNOOZE_ID,
  STORED_STAGED_ID,
  VERIFY_AFTER_WRITE_ID
} from './settingIds';
import type {
  CheckLogEntry,
  FeedEntry,
  StagedUpdate,
  UpdateFailure,
  UpdateFailureCode,
  UpdateInstallBridge,
  UpdatePhase,
  UpdateState
} from './types';

/**
 * The updater engine.
 *
 * It does exactly four things, in order, and reports honestly at every step:
 * read the release feed, choose a package, transfer and verify it, and stage it
 * on disk. It never installs anything by itself and never claims to have.
 *
 * Two boundaries are load-bearing and are stated rather than papered over.
 *
 *  1. **Nothing here is a signature check.** The digest in a Squirrel feed
 *     proves the bytes are the bytes that feed named. It proves nothing about
 *     who published them, and this project signs no artifact at all. Every
 *     surface says so; no surface says "verified publisher".
 *
 *  2. **The renderer cannot run an installer.** The privileged bridge exposes a
 *     text write and a fixed process allow-list that carries no installer, so
 *     the last step — quit and hand the staged package to the platform updater —
 *     needs a privileged bridge that this build may or may not have. The feature
 *     probes for it, and when it is absent the restart action is disabled with
 *     the exact reason rather than pretending to work.
 */

const MAX_LOG_ENTRIES = 200;
const FEED_MAX_BYTES = 1_048_576;
const FEED_TIMEOUT_MS = 20_000;
const CHUNK_TIMEOUT_MS = 120_000;
const MAX_REDIRECTS = 4;

/** Squirrel packages are staged under this directory inside the app's own data. */
const STAGING_DIRECTORY = 'updates';

type Listener = (state: UpdateState) => void;

function nowIso(): string {
  return new Date().toISOString();
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function joinPath(directory: string, ...parts: string[]): string {
  const separator = directory.includes('\\') && !directory.includes('/') ? '\\' : '/';
  const trimmed = directory.replace(/[\\/]+$/, '');
  return [trimmed, ...parts].join(separator);
}

/**
 * Finds the privileged installer bridge, if this build has one.
 *
 * The probe is structural rather than a version check, because the honest answer
 * to "can this build install an update" is "is the call actually there".
 */
function findInstallBridge(): UpdateInstallBridge | null {
  const candidate = (window.studio as unknown as { updater?: unknown }).updater;
  if (!candidate || typeof candidate !== 'object') return null;
  const install = (candidate as { installStaged?: unknown }).installStaged;
  if (typeof install !== 'function') return null;
  return candidate as UpdateInstallBridge;
}

class UpdaterEngine {
  private ctx: AppContext | null = null;
  private readonly listeners = new Set<Listener>();
  private logEntries: CheckLogEntry[] = [];
  private allowedHosts = new Set<string>();
  private scheduleTimer: number | null = null;
  private startupTimer: number | null = null;
  private cancelRequested = false;
  private busy = false;
  private logCounter = 0;

  private current: UpdateState = {
    phase: 'idle',
    currentVersion: '0.0.0',
    candidate: null,
    failure: null,
    transferred: 0,
    total: 0,
    rangeSupported: null,
    lastCheckedAt: null,
    nextCheckAt: null,
    staged: null,
    installAvailable: false,
    snoozedUntil: null,
    cancellable: false
  };

  /* ---------------------------------------------------------------- */
  /* Lifecycle                                                         */
  /* ---------------------------------------------------------------- */

  attach(ctx: AppContext): void {
    this.ctx = ctx;
    this.current.currentVersion = ctx.studio.info.version;
    this.current.installAvailable = findInstallBridge() !== null;
    this.logEntries = this.readStoredLog();
    this.logCounter = this.logEntries.length;
    this.current.staged = this.readStoredStaged();
    this.current.lastCheckedAt = ctx.settings.get<string | null>(STORED_LAST_CHECK_ID, null);
    this.current.snoozedUntil = ctx.settings.get<string | null>(STORED_SNOOZE_ID, null);

    if (this.current.staged) {
      this.current.phase = 'ready';
    } else if (!this.enabled()) {
      this.current.phase = 'disabled';
    } else if (this.feedUrl() === '') {
      this.current.phase = 'unconfigured';
    }

    ctx.settings.onChange((change) => {
      if (
        change.id === ENABLED_ID ||
        change.id === INTERVAL_HOURS_ID ||
        change.id === FEED_URL_ID ||
        change.id === CHECK_ON_STARTUP_ID
      ) {
        this.reschedule();
        if (change.id === ENABLED_ID || change.id === FEED_URL_ID) this.refreshIdlePhase();
        this.emit();
      }
    });

    this.scheduleStartupCheck();
    this.reschedule();
    this.emit();
  }

  private refreshIdlePhase(): void {
    if (this.busy) return;
    if (this.current.staged) {
      this.current.phase = 'ready';
      return;
    }
    if (!this.enabled()) {
      this.current.phase = 'disabled';
      return;
    }
    if (this.feedUrl() === '') {
      this.current.phase = 'unconfigured';
      return;
    }
    if (this.current.phase === 'disabled' || this.current.phase === 'unconfigured') {
      this.current.phase = 'idle';
    }
  }

  /* ---------------------------------------------------------------- */
  /* Configuration                                                     */
  /* ---------------------------------------------------------------- */

  private require(): AppContext {
    if (!this.ctx) throw new Error('The updater was used before it was attached to the application context.');
    return this.ctx;
  }

  enabled(): boolean {
    return this.ctx ? this.ctx.settings.get<boolean>(ENABLED_ID, true) === true : true;
  }

  feedUrl(): string {
    const raw = this.ctx ? this.ctx.settings.get<string>(FEED_URL_ID, DEFAULT_FEED_URL) : DEFAULT_FEED_URL;
    return typeof raw === 'string' ? raw.trim() : '';
  }

  releaseNotesUrl(): string {
    const raw = this.ctx
      ? this.ctx.settings.get<string>(RELEASE_NOTES_ID, DEFAULT_RELEASE_NOTES_URL)
      : DEFAULT_RELEASE_NOTES_URL;
    return typeof raw === 'string' ? raw.trim() : '';
  }

  private intervalHours(): number {
    return clampNumber(this.require().settings.get(INTERVAL_HOURS_ID, 6), 6, 1, 168);
  }

  private chunkBytes(): number {
    return clampNumber(this.require().settings.get(CHUNK_BYTES_ID, DEFAULT_CHUNK_BYTES), DEFAULT_CHUNK_BYTES, 262_144, 7_340_032);
  }

  private maxPackageBytes(): number {
    return clampNumber(
      this.require().settings.get(MAX_PACKAGE_BYTES_ID, DEFAULT_MAX_PACKAGE_BYTES),
      DEFAULT_MAX_PACKAGE_BYTES,
      1_048_576,
      1_073_741_824
    );
  }

  /* ---------------------------------------------------------------- */
  /* Observation                                                       */
  /* ---------------------------------------------------------------- */

  state(): UpdateState {
    return { ...this.current, candidate: this.current.candidate ? { ...this.current.candidate } : null };
  }

  log(): CheckLogEntry[] {
    return this.logEntries.map((entry) => ({ ...entry }));
  }

  onChange(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    const snapshot = this.state();
    for (const listener of [...this.listeners]) {
      try {
        listener(snapshot);
      } catch (error) {
        // A broken surface must not stop the transfer that was feeding it.
        console.error(`An updater listener threw: ${errorText(error)}`);
      }
    }
  }

  private setPhase(phase: UpdatePhase, failure: UpdateFailure | null = null): void {
    this.current.phase = phase;
    this.current.failure = failure;
    this.emit();
  }

  private fail(code: UpdateFailureCode, detail: string): void {
    this.setPhase('failed', { code, detail });
  }

  /* ---------------------------------------------------------------- */
  /* Stored records                                                    */
  /* ---------------------------------------------------------------- */

  private readStoredStaged(): StagedUpdate | null {
    const raw = this.require().settings.get<StagedUpdate | null>(STORED_STAGED_ID, null);
    if (!raw || typeof raw !== 'object') return null;
    const record = raw as Partial<StagedUpdate>;
    if (
      typeof record.version !== 'string' ||
      typeof record.sha1 !== 'string' ||
      typeof record.packagePath !== 'string' ||
      typeof record.manifestPath !== 'string' ||
      typeof record.fileName !== 'string' ||
      typeof record.size !== 'number'
    ) {
      return null;
    }
    return {
      version: record.version,
      fileName: record.fileName,
      sha1: record.sha1,
      size: record.size,
      packagePath: record.packagePath,
      manifestPath: record.manifestPath,
      encoding: 'base64',
      stagedAt: typeof record.stagedAt === 'string' ? record.stagedAt : nowIso(),
      feedUrl: typeof record.feedUrl === 'string' ? record.feedUrl : '',
      supersedes: typeof record.supersedes === 'string' ? record.supersedes : this.current.currentVersion
    };
  }

  private readStoredLog(): CheckLogEntry[] {
    const raw = this.require().settings.get<CheckLogEntry[]>(STORED_LOG_ID, []);
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((entry): entry is CheckLogEntry => Boolean(entry) && typeof entry === 'object' && typeof entry.id === 'string')
      .slice(0, MAX_LOG_ENTRIES);
  }

  private persistLog(): void {
    this.require().settings.set(STORED_LOG_ID, this.logEntries.slice(0, MAX_LOG_ENTRIES));
  }

  private appendLog(entry: Omit<CheckLogEntry, 'id'>): void {
    this.logCounter += 1;
    const record: CheckLogEntry = { id: `updates-check-${Date.now()}-${this.logCounter}`, ...entry };
    this.logEntries = [record, ...this.logEntries].slice(0, MAX_LOG_ENTRIES);
    this.persistLog();
  }

  /** Removes chosen log rows. The caller has already run the confirmation gate. */
  async removeLogEntries(ids: string[]): Promise<number> {
    const wanted = new Set(ids);
    const before = this.logEntries.length;
    this.logEntries = this.logEntries.filter((entry) => !wanted.has(entry.id));
    this.persistLog();
    const removed = before - this.logEntries.length;
    if (removed > 0) {
      await this.require().history.record('Removed update check log entries', 'updates', { removed, ids });
    }
    this.emit();
    return removed;
  }

  /* ---------------------------------------------------------------- */
  /* Scheduling                                                        */
  /* ---------------------------------------------------------------- */

  private scheduleStartupCheck(): void {
    const ctx = this.require();
    if (!this.enabled()) return;
    if (ctx.settings.get<boolean>(CHECK_ON_STARTUP_ID, true) !== true) return;
    const delaySeconds = clampNumber(ctx.settings.get(STARTUP_DELAY_ID, 20), 20, 0, 600);
    if (this.startupTimer !== null) window.clearTimeout(this.startupTimer);
    this.startupTimer = window.setTimeout(() => {
      this.startupTimer = null;
      void this.check('startup');
    }, delaySeconds * 1000);
  }

  private reschedule(): void {
    if (this.scheduleTimer !== null) {
      window.clearTimeout(this.scheduleTimer);
      this.scheduleTimer = null;
    }
    if (!this.ctx || !this.enabled() || this.feedUrl() === '') {
      this.current.nextCheckAt = null;
      return;
    }
    const intervalMs = this.intervalHours() * 3_600_000;
    this.current.nextCheckAt = new Date(Date.now() + intervalMs).toISOString();
    this.scheduleTimer = window.setTimeout(() => {
      this.scheduleTimer = null;
      void this.check('schedule');
    }, intervalMs);
  }

  /** Releases every timer. Called when the window is going away. */
  dispose(): void {
    if (this.scheduleTimer !== null) window.clearTimeout(this.scheduleTimer);
    if (this.startupTimer !== null) window.clearTimeout(this.startupTimer);
    this.scheduleTimer = null;
    this.startupTimer = null;
  }

  /* ---------------------------------------------------------------- */
  /* Network permission                                                */
  /* ---------------------------------------------------------------- */

  /**
   * Registers the allow rules this feature needs, and only those.
   *
   * Outbound HTTP is denied by default. The feed host is allowed because the
   * user configured it; a GitHub feed additionally redirects its assets to the
   * content host, so that suffix is allowed too, with the redirect named as the
   * reason rather than left for somebody to guess at.
   */
  private async ensureAllowed(url: string): Promise<Result<void>> {
    let host: string;
    let scheme: 'http' | 'https';
    try {
      const parsed = new URL(url);
      host = parsed.hostname;
      scheme = parsed.protocol === 'http:' ? 'http' : 'https';
    } catch {
      return { ok: false, error: `The address "${url}" is not a URL.`, code: 'invalid-url' };
    }
    if (this.allowedHosts.has(host)) return { ok: true, value: undefined };

    const rules: HttpAllowRule[] = [
      {
        host,
        schemes: [scheme],
        owner: 'updates',
        reason: 'Reads the application release feed and downloads the update package named in it.'
      }
    ];
    if (host === 'github.com' || host.endsWith('.github.com')) {
      rules.push({
        host: '.githubusercontent.com',
        schemes: ['https'],
        owner: 'updates',
        reason: 'GitHub redirects release asset downloads to this content host; refusing it would break the transfer.'
      });
    }

    for (const rule of rules) {
      const result = await window.studio.http.allow(rule);
      if (!result.ok) return result;
      this.allowedHosts.add(rule.host.replace(/^\./, ''));
    }
    this.allowedHosts.add(host);
    return { ok: true, value: undefined };
  }

  /* ---------------------------------------------------------------- */
  /* Checking                                                          */
  /* ---------------------------------------------------------------- */

  /**
   * Reads the feed and decides what, if anything, to do next.
   *
   * A check never interrupts anything: it runs in the background, reports
   * through the state listeners, and raises a notification only when the user
   * asked for the check themselves.
   */
  async check(trigger: CheckLogEntry['trigger']): Promise<void> {
    const ctx = this.require();
    const startedAt = Date.now();

    if (this.busy) {
      if (trigger === 'manual') {
        ctx.notify.info(
          ctx.t('updates.notify.busy.title', 'An update task is already running'),
          ctx.t('updates.notify.busy.body', 'Wait for the current check or transfer to finish, or cancel it first.')
        );
      }
      return;
    }
    if (!this.enabled()) {
      this.appendLog({
        at: nowIso(),
        trigger,
        outcome: 'skipped',
        version: this.current.currentVersion,
        detail: 'Automatic updates are switched off.',
        durationMs: 0
      });
      this.setPhase('disabled');
      return;
    }

    const feedUrl = this.feedUrl();
    if (feedUrl === '') {
      this.appendLog({
        at: nowIso(),
        trigger,
        outcome: 'failed',
        version: this.current.currentVersion,
        detail: 'No release feed address is configured.',
        durationMs: 0
      });
      this.setPhase('unconfigured', {
        code: 'not-configured',
        detail: 'No release feed address is configured, so there is nothing to check against.'
      });
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      this.appendLog({
        at: nowIso(),
        trigger,
        outcome: 'failed',
        version: this.current.currentVersion,
        detail: 'This computer reports that it is offline.',
        durationMs: 0
      });
      this.fail('offline', 'This computer reports that it is offline. The feed was not contacted.');
      this.finishCheck();
      return;
    }

    this.busy = true;
    this.cancelRequested = false;
    this.setPhase('checking');

    try {
      const allowed = await this.ensureAllowed(feedUrl);
      if (!allowed.ok) {
        this.recordFailure(trigger, startedAt, 'feed-unreachable', allowed.error);
        return;
      }

      const response = await window.studio.http.request({
        url: feedUrl,
        method: 'GET',
        headers: { Accept: 'text/plain' },
        timeoutMs: FEED_TIMEOUT_MS,
        maxBytes: FEED_MAX_BYTES,
        maxRedirects: MAX_REDIRECTS
      });
      if (!response.ok) {
        this.recordFailure(trigger, startedAt, 'feed-unreachable', response.error);
        return;
      }
      const http = response.value;
      if (http.status < 200 || http.status >= 300) {
        this.recordFailure(
          trigger,
          startedAt,
          'feed-unreachable',
          `The feed answered ${http.status} ${http.statusText} from ${http.finalUrl ?? feedUrl}.`
        );
        return;
      }
      if (http.truncated) {
        this.recordFailure(trigger, startedAt, 'feed-invalid', `The feed body exceeded ${FEED_MAX_BYTES} bytes and was cut off.`);
        return;
      }

      const parsed = parseFeed(http.body, http.finalUrl ?? feedUrl);
      if (parsed.entries.length === 0) {
        const reason =
          parsed.rejected.length > 0
            ? `No usable package lines. First refusal on line ${parsed.rejected[0].line}: ${parsed.rejected[0].reason}.`
            : 'The feed contained no package lines at all.';
        this.recordFailure(trigger, startedAt, 'feed-invalid', reason);
        return;
      }

      const decision = chooseCandidate(parsed.entries, {
        currentVersion: this.current.currentVersion,
        acceptPrerelease: ctx.settings.get<boolean>(ACCEPT_PRERELEASE_ID, false) === true,
        allowDowngrade: ctx.settings.get<boolean>(ALLOW_DOWNGRADE_ID, false) === true
      });

      this.current.lastCheckedAt = nowIso();
      ctx.settings.set(STORED_LAST_CHECK_ID, this.current.lastCheckedAt);

      if (!decision.entry) {
        if (decision.blocked === 'downgrade') {
          const detail = `The feed offers ${decision.newestOffered ?? 'an older build'}, which is older than the installed ${this.current.currentVersion}. Rollback protection refused it.`;
          this.appendLog({
            at: nowIso(),
            trigger,
            outcome: 'failed',
            version: decision.newestOffered ?? this.current.currentVersion,
            detail,
            durationMs: Date.now() - startedAt
          });
          this.current.candidate = null;
          this.fail('downgrade-blocked', detail);
          this.finishCheck();
          return;
        }
        const detail =
          decision.blocked === 'prerelease'
            ? `The only newer package in the feed is a prerelease (${decision.newestOffered ?? 'unknown version'}) and prereleases are not accepted.`
            : `The newest package in the feed is ${decision.newestOffered ?? this.current.currentVersion}, which this build already is.`;
        this.appendLog({
          at: nowIso(),
          trigger,
          outcome: 'up-to-date',
          version: decision.newestOffered ?? this.current.currentVersion,
          detail,
          durationMs: Date.now() - startedAt
        });
        this.current.candidate = null;
        this.setPhase('upToDate');
        this.finishCheck();
        if (trigger === 'manual') {
          ctx.notify.success(
            ctx.t('updates.notify.upToDate.title', 'No update available'),
            ctx.t('updates.notify.upToDate.body', 'This build is {version}, which is the newest the feed offers.', {
              values: { version: this.current.currentVersion }
            })
          );
        }
        return;
      }

      const entry = decision.entry;
      this.current.candidate = entry;
      const maximum = this.maxPackageBytes();
      if (entry.size > maximum) {
        const detail = `The package ${entry.fileName} is ${entry.size} bytes, above the ${maximum} byte staging ceiling.`;
        this.appendLog({
          at: nowIso(),
          trigger,
          outcome: 'failed',
          version: entry.version,
          detail,
          durationMs: Date.now() - startedAt
        });
        this.fail('too-large', detail);
        this.finishCheck();
        return;
      }

      if (this.current.staged && this.current.staged.version === entry.version) {
        this.appendLog({
          at: nowIso(),
          trigger,
          outcome: 'staged',
          version: entry.version,
          detail: `Version ${entry.version} is already staged and verified at ${this.current.staged.packagePath}.`,
          durationMs: Date.now() - startedAt
        });
        this.setPhase('ready');
        this.finishCheck();
        return;
      }

      this.appendLog({
        at: nowIso(),
        trigger,
        outcome: 'available',
        version: entry.version,
        detail: `Version ${entry.version} is available as ${entry.fileName} (${entry.size} bytes).`,
        durationMs: Date.now() - startedAt
      });
      this.setPhase('available');
      this.finishCheck();

      if (ctx.settings.get<boolean>(AUTO_DOWNLOAD_ID, true) === true) {
        this.busy = false;
        await this.download(trigger);
        return;
      }
      if (trigger === 'manual') {
        ctx.notify.info(
          ctx.t('updates.notify.available.title', 'An update is available'),
          ctx.t('updates.notify.available.body', 'Version {version} is available. Downloading it is a separate step.', {
            values: { version: entry.version }
          })
        );
      }
    } catch (error) {
      this.recordFailure(trigger, startedAt, 'feed-unreachable', errorText(error));
    } finally {
      this.busy = false;
      this.reschedule();
      this.emit();
    }
  }

  private recordFailure(
    trigger: CheckLogEntry['trigger'],
    startedAt: number,
    code: UpdateFailureCode,
    detail: string
  ): void {
    this.appendLog({
      at: nowIso(),
      trigger,
      outcome: 'failed',
      version: this.current.candidate?.version ?? this.current.currentVersion,
      detail,
      durationMs: Date.now() - startedAt
    });
    this.current.lastCheckedAt = nowIso();
    this.require().settings.set(STORED_LAST_CHECK_ID, this.current.lastCheckedAt);
    this.fail(code, detail);
  }

  private finishCheck(): void {
    this.current.lastCheckedAt = this.current.lastCheckedAt ?? nowIso();
    this.require().settings.set(STORED_LAST_CHECK_ID, this.current.lastCheckedAt);
  }

  /* ---------------------------------------------------------------- */
  /* Transfer, verification and staging                                */
  /* ---------------------------------------------------------------- */

  /** Cancels an in-flight transfer between chunks. Never leaves a half file. */
  cancel(): void {
    if (!this.busy) return;
    this.cancelRequested = true;
    this.emit();
  }

  /**
   * Transfers the chosen package, verifies its digest against the feed and
   * stages it.
   *
   * The transfer is made in bounded byte-range chunks. That is not an
   * optimisation: the privileged bridge caps a single response body, so a single
   * request could not carry a whole package. It also buys two real properties —
   * byte-accurate progress and a cancellation point between every chunk — rather
   * than a spinner that means nothing.
   */
  async download(trigger: CheckLogEntry['trigger'] = 'manual'): Promise<void> {
    const ctx = this.require();
    const entry = this.current.candidate;
    if (!entry) {
      ctx.notify.warn(
        ctx.t('updates.notify.nothingToDownload.title', 'There is no update to download'),
        ctx.t('updates.notify.nothingToDownload.body', 'Check for updates first; nothing has been offered by the feed yet.')
      );
      return;
    }
    if (this.busy) return;

    this.busy = true;
    this.cancelRequested = false;
    this.current.transferred = 0;
    this.current.total = entry.size;
    this.current.rangeSupported = null;
    this.current.cancellable = true;
    this.setPhase('downloading');

    const startedAt = Date.now();
    try {
      const allowed = await this.ensureAllowed(entry.url);
      if (!allowed.ok) {
        this.finishTransferFailure(trigger, startedAt, entry, 'transfer-failed', allowed.error);
        return;
      }

      const chunkSize = this.chunkBytes();
      const received: Uint8Array[] = [];
      let offset = 0;
      let singleShot = false;

      while (offset < entry.size) {
        if (this.cancelRequested) {
          this.finishTransferFailure(trigger, startedAt, entry, 'cancelled', `Cancelled after ${offset} of ${entry.size} bytes.`);
          return;
        }
        const end = Math.min(offset + chunkSize, entry.size) - 1;
        const response: Result<HttpResponse> = await window.studio.http.request({
          url: entry.url,
          method: 'GET',
          headers: { Accept: 'application/octet-stream', Range: `bytes=${offset}-${end}` },
          responseEncoding: 'base64',
          timeoutMs: CHUNK_TIMEOUT_MS,
          maxBytes: chunkSize + 65_536,
          maxRedirects: MAX_REDIRECTS
        });
        if (!response.ok) {
          this.finishTransferFailure(trigger, startedAt, entry, 'transfer-failed', response.error);
          return;
        }
        const http = response.value;
        if (http.status !== 206 && http.status !== 200) {
          this.finishTransferFailure(
            trigger,
            startedAt,
            entry,
            'transfer-failed',
            `The server answered ${http.status} ${http.statusText} for bytes ${offset}-${end}.`
          );
          return;
        }
        if (http.truncated) {
          this.finishTransferFailure(
            trigger,
            startedAt,
            entry,
            'transfer-failed',
            `The response for bytes ${offset}-${end} was truncated by the transfer ceiling.`
          );
          return;
        }
        const decoded = base64ToBytes(http.body);
        if (!decoded.ok) {
          this.finishTransferFailure(trigger, startedAt, entry, 'transfer-failed', `The chunk at byte ${offset} did not decode: ${decoded.error}`);
          return;
        }

        if (http.status === 200) {
          // The server ignored the range header and sent the whole package.
          // That is legal, so it is accepted — but progress genuinely arrived in
          // one piece, and the surface says so instead of animating a fiction.
          this.current.rangeSupported = false;
          singleShot = true;
          received.length = 0;
          received.push(decoded.bytes);
          this.current.transferred = decoded.bytes.length;
          this.emit();
          break;
        }

        this.current.rangeSupported = true;
        received.push(decoded.bytes);
        offset += decoded.bytes.length;
        this.current.transferred = offset;
        this.emit();

        if (decoded.bytes.length === 0) {
          this.finishTransferFailure(trigger, startedAt, entry, 'transfer-failed', `The server returned an empty range at byte ${offset}.`);
          return;
        }
      }

      const bytes = concatChunks(received);
      if (bytes.length !== entry.size) {
        this.finishTransferFailure(
          trigger,
          startedAt,
          entry,
          'size-mismatch',
          `The feed said ${entry.size} bytes and ${bytes.length} bytes arrived${singleShot ? ' in one response' : ''}.`
        );
        return;
      }

      this.setPhase('verifying');
      const digest = await sha1Hex(bytes);
      if (digest !== entry.sha1) {
        this.finishTransferFailure(
          trigger,
          startedAt,
          entry,
          'hash-mismatch',
          `The feed named SHA-1 ${entry.sha1} and the transferred bytes hash to ${digest}. Nothing was written to disk.`
        );
        return;
      }

      this.setPhase('staging');
      const staged = await this.writeStaged(entry, bytes, digest);
      if (!staged.ok) {
        this.finishTransferFailure(trigger, startedAt, entry, staged.code, staged.error);
        return;
      }

      this.current.staged = staged.value;
      ctx.settings.set(STORED_STAGED_ID, staged.value);
      this.current.cancellable = false;
      this.appendLog({
        at: nowIso(),
        trigger,
        outcome: 'staged',
        version: entry.version,
        detail: `Transferred ${bytes.length} bytes, SHA-1 ${digest} matched the feed, staged at ${staged.value.packagePath}.`,
        durationMs: Date.now() - startedAt
      });
      await ctx.history.record('Staged an application update', 'updates', {
        version: entry.version,
        fileName: entry.fileName,
        size: entry.size,
        sha1: digest,
        packagePath: staged.value.packagePath,
        feedUrl: staged.value.feedUrl
      });
      this.clearSnooze();
      this.setPhase('ready');
    } catch (error) {
      this.finishTransferFailure(trigger, startedAt, entry, 'transfer-failed', errorText(error));
    } finally {
      this.busy = false;
      this.current.cancellable = false;
      this.emit();
    }
  }

  private finishTransferFailure(
    trigger: CheckLogEntry['trigger'],
    startedAt: number,
    entry: FeedEntry,
    code: UpdateFailureCode,
    detail: string
  ): void {
    this.appendLog({
      at: nowIso(),
      trigger,
      outcome: code === 'cancelled' ? 'cancelled' : 'failed',
      version: entry.version,
      detail,
      durationMs: Date.now() - startedAt
    });
    this.current.cancellable = false;
    this.fail(code, detail);
  }

  /** Writes the verified payload and its manifest, then proves what landed. */
  private async writeStaged(
    entry: FeedEntry,
    bytes: Uint8Array,
    digest: string
  ): Promise<{ ok: true; value: StagedUpdate } | { ok: false; code: UpdateFailureCode; error: string }> {
    const ctx = this.require();
    const directory = joinPath(ctx.studio.info.userDataDir, STAGING_DIRECTORY);
    const ensured = await window.studio.fs.ensureDirectory(directory);
    if (!ensured.ok) return { ok: false, code: 'write-failed', error: ensured.error };

    const packagePath = joinPath(directory, `${entry.fileName}.base64`);
    const manifestPath = joinPath(directory, 'staged-update.json');
    const encoded = bytesToBase64(bytes);

    const written = await window.studio.fs.writeText(packagePath, encoded);
    if (!written.ok) return { ok: false, code: 'write-failed', error: written.error };

    const record: StagedUpdate = {
      version: entry.version,
      fileName: entry.fileName,
      sha1: digest,
      size: entry.size,
      packagePath,
      manifestPath,
      encoding: 'base64',
      stagedAt: nowIso(),
      feedUrl: this.feedUrl(),
      supersedes: this.current.currentVersion
    };

    const manifest = {
      schemaVersion: 1,
      ...record,
      signed: false,
      note:
        'This package is unsigned. The SHA-1 recorded here is the digest the release feed stated and the transferred bytes produced. It says nothing about who published the package.'
    };
    const manifestWritten = await window.studio.fs.writeText(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    if (!manifestWritten.ok) return { ok: false, code: 'write-failed', error: manifestWritten.error };

    if (ctx.settings.get<boolean>(VERIFY_AFTER_WRITE_ID, true) === true) {
      const readBack = await window.studio.fs.readText(packagePath, encoded.length + 4096);
      if (!readBack.ok) return { ok: false, code: 'asset-corrupt', error: `The staged payload could not be read back: ${readBack.error}` };
      const decoded = base64ToBytes(readBack.value);
      if (!decoded.ok) {
        return { ok: false, code: 'asset-corrupt', error: `The staged payload on disk is not valid base64: ${decoded.error}` };
      }
      const recheck = await sha1Hex(decoded.bytes);
      if (recheck !== digest) {
        return {
          ok: false,
          code: 'asset-corrupt',
          error: `The staged payload hashes to ${recheck} on re-reading, not the ${digest} that was written. The staged file is not usable.`
        };
      }
    }

    return { ok: true, value: record };
  }

  /* ---------------------------------------------------------------- */
  /* Staged package lifecycle                                          */
  /* ---------------------------------------------------------------- */

  /**
   * Discards the staged package.
   *
   * The privileged bridge has no file removal, so the payload is truncated to
   * nothing — which genuinely returns the disk space — and the manifest is
   * rewritten to record the discard. The user is told the exact path, because
   * two empty files remain and pretending otherwise would be a lie about their
   * own disk.
   */
  async discardStaged(): Promise<{ ok: boolean; error?: string; path: string }> {
    const ctx = this.require();
    const staged = this.current.staged;
    if (!staged) return { ok: false, error: 'There is no staged update to discard.', path: '' };

    const truncated = await window.studio.fs.writeText(staged.packagePath, '');
    if (!truncated.ok) return { ok: false, error: truncated.error, path: staged.packagePath };

    const manifest = {
      schemaVersion: 1,
      discardedAt: nowIso(),
      version: staged.version,
      fileName: staged.fileName,
      sha1: staged.sha1,
      packagePath: staged.packagePath,
      signed: false,
      note: 'The staged payload was discarded by the user. The payload file was truncated to zero bytes; it can be deleted safely.'
    };
    await window.studio.fs.writeText(staged.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

    ctx.settings.set(STORED_STAGED_ID, null);
    this.current.staged = null;
    this.current.candidate = null;
    await ctx.history.record('Discarded the staged application update', 'updates', {
      version: staged.version,
      packagePath: staged.packagePath,
      sha1: staged.sha1
    });
    if (this.current.phase === 'ready') this.current.phase = 'idle';
    this.refreshIdlePhase();
    this.emit();
    return { ok: true, path: staged.packagePath };
  }

  /* ---------------------------------------------------------------- */
  /* Unsaved work and installation                                     */
  /* ---------------------------------------------------------------- */

  /**
   * Everything on screen that says it holds unsaved work.
   *
   * Any surface can join in by carrying `data-unsaved-work` with a label naming
   * what would be lost. Restarting reads that list and shows it, so a restart
   * cannot quietly throw away somebody's editing.
   */
  unsavedWork(): string[] {
    const nodes = [...document.querySelectorAll<HTMLElement>('[data-unsaved-work]')];
    const labels = nodes
      .map((node) => node.dataset.unsavedWork?.trim() ?? '')
      .filter((label) => label !== '' && label !== 'false');
    return [...new Set(labels)];
  }

  installBridgeAvailable(): boolean {
    const available = findInstallBridge() !== null;
    if (available !== this.current.installAvailable) {
      this.current.installAvailable = available;
      this.emit();
    }
    return available;
  }

  /**
   * Hands the staged package to the platform updater and quits into it.
   *
   * Only ever called from an explicit user action, and only after the unsaved
   * work check. When the privileged bridge is absent this reports that exact
   * boundary; it never relaunches and calls that an installation.
   */
  async installStaged(): Promise<{ ok: boolean; code: UpdateFailureCode | null; detail: string }> {
    const ctx = this.require();
    const staged = this.current.staged;
    if (!staged) return { ok: false, code: 'install-failed', detail: 'There is no staged update to install.' };

    const bridge = findInstallBridge();
    if (!bridge) {
      const detail =
        'This build has no privileged installer bridge (window.studio.updater.installStaged), so the renderer cannot hand the package to the platform updater. The verified package is staged and can be installed by hand.';
      this.current.installAvailable = false;
      this.fail('install-unavailable', detail);
      return { ok: false, code: 'install-unavailable', detail };
    }

    this.setPhase('installing');
    await ctx.history.record('Restarted to install an application update', 'updates', {
      version: staged.version,
      from: this.current.currentVersion,
      packagePath: staged.packagePath,
      sha1: staged.sha1
    });

    try {
      const result = await bridge.installStaged({
        manifestPath: staged.manifestPath,
        packagePath: staged.packagePath,
        encoding: staged.encoding,
        version: staged.version,
        sha1: staged.sha1
      });
      if (!result.ok) {
        this.fail('install-failed', result.error);
        return { ok: false, code: 'install-failed', detail: result.error };
      }
      return { ok: true, code: null, detail: `Handed version ${staged.version} to the platform updater.` };
    } catch (error) {
      const detail = errorText(error);
      this.fail('install-failed', detail);
      return { ok: false, code: 'install-failed', detail };
    }
  }

  /* ---------------------------------------------------------------- */
  /* Snoozing the banner                                               */
  /* ---------------------------------------------------------------- */

  snooze(): void {
    const ctx = this.require();
    const hours = clampNumber(ctx.settings.get(SNOOZE_HOURS_ID, 4), 4, 1, 168);
    const until = new Date(Date.now() + hours * 3_600_000).toISOString();
    this.current.snoozedUntil = until;
    ctx.settings.set(STORED_SNOOZE_ID, until);
    this.emit();
  }

  clearSnooze(): void {
    this.current.snoozedUntil = null;
    this.require().settings.set(STORED_SNOOZE_ID, null);
    this.emit();
  }

  snoozeActive(): boolean {
    const until = this.current.snoozedUntil;
    if (!until) return false;
    const at = Date.parse(until);
    if (!Number.isFinite(at)) return false;
    if (at <= Date.now()) {
      this.clearSnooze();
      return false;
    }
    return true;
  }
}

/** The one engine. Surfaces observe it; nothing else constructs another. */
export const updater = new UpdaterEngine();
