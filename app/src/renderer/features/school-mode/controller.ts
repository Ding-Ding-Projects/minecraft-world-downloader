import { SCHOOL_ENABLED_ID, SCHOOL_NAME_ID, i18n } from '../../core/i18n';
import type { AppContext } from '../../core/registry';
import {
  UNKNOWN_CREDENTIAL,
  clearCredential,
  readCredentialStatus,
  type CredentialStatus
} from './credential';
import {
  MAX_NAME_LENGTH,
  SHIPPED_MODE_NAME,
  SharedRecordStore,
  isValidName,
  type ReadOutcome,
  type ReadState,
  type SchoolRecord
} from './shared-record';
import { nameStrings } from './strings';
import { requestUnlock } from './unlock';

/**
 * The controller.
 *
 * One shared switch means exactly one authority, and it is the record on disk —
 * not this application's settings file, which holds a mirror of it so that the
 * language machinery can read the mode synchronously while it renders.
 *
 * The direction of travel is therefore always the same: the record is read, and
 * the mirror follows. Every route that changes the mode writes the record first
 * and lets the same code path that handles another application's change handle
 * its own. That is what makes a change made anywhere arrive everywhere without a
 * restart, and it is why the mirror can never quietly disagree with the record.
 *
 * The guard is the other half. The shipped language settings expose their own
 * switch for the mode, and that switch knows nothing about the unlock code, so
 * this module watches the mirror and puts back a value that was turned off
 * without the code — then opens the unlock prompt, which is what the user was
 * asking for anyway.
 */

export interface SchoolModeState {
  enabled: boolean;
  name: string;
  /** `shared` when the record is the authority right now; `mirror` when it is not usable. */
  authority: 'shared' | 'mirror';
  record: SchoolRecord | null;
  recordPath: string;
  recordFolder: string;
  readState: ReadState;
  readError: string | null;
  writeError: string | null;
  watching: boolean;
  watchError: string | null;
  lastReadAt: string | null;
  intervalMs: number;
  credential: CredentialStatus;
}

export interface ActivityEntry {
  id: string;
  at: string;
  action: string;
  detail: string;
}

export const SETTING_ENABLED = 'school-mode.enabled';
export const SETTING_NAME = 'school-mode.name';
export const SETTING_FOLDER = 'school-mode.sharedFolder';
export const SETTING_WATCH_SECONDS = 'school-mode.watchSeconds';
export const SETTING_CREDENTIAL = 'school-mode.credential';

export const HISTORY_SOURCE = 'school-mode';

export const DEFAULT_WATCH_SECONDS = 2;
export const MIN_WATCH_SECONDS = 1;
export const MAX_WATCH_SECONDS = 60;

export class SchoolModeController {
  private ctx: AppContext | null = null;
  private store: SharedRecordStore | null = null;
  private listeners = new Set<(state: SchoolModeState) => void>();
  private credential: CredentialStatus = UNKNOWN_CREDENTIAL;
  private writeError: string | null = null;
  private applying = false;
  private unlockOpen = false;
  private started = false;
  private activityCache: ActivityEntry[] = [];

  /* ---------------- lifecycle ---------------- */

  start(ctx: AppContext): void {
    if (this.started) return;
    this.started = true;
    this.ctx = ctx;

    this.store = new SharedRecordStore({
      studio: ctx.studio,
      folderOverride: () => String(ctx.settings.get<string>(SETTING_FOLDER, '') ?? ''),
      intervalMs: () => this.intervalMs()
    });

    // The name-bearing copy has to exist before the first surface renders, or a
    // renamed mode shows its key instead of its name for one frame.
    this.registerNameStrings(this.name());

    ctx.settings.onChange((change) => {
      if (change.id === SETTING_FOLDER || change.id === SETTING_WATCH_SECONDS) {
        this.store?.restart();
        void this.refreshNow();
        this.emit();
        return;
      }
      if (change.id === SCHOOL_ENABLED_ID) this.onMirrorChanged(change.value === true);
    });

    this.store.start((outcome) => void this.onRecordChanged(outcome));

    void (async () => {
      await this.refreshCredential();
      await this.reconcile();
    })();
  }

  stop(): void {
    this.store?.stop();
  }

  onChange(listener: (state: SchoolModeState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    const state = this.state();
    for (const listener of [...this.listeners]) {
      try {
        listener(state);
      } catch (error) {
        console.error('A study-mode listener threw:', error);
      }
    }
  }

  /* ---------------- current state ---------------- */

  intervalMs(): number {
    const raw = Number(this.ctx?.settings.get<number>(SETTING_WATCH_SECONDS, DEFAULT_WATCH_SECONDS) ?? DEFAULT_WATCH_SECONDS);
    const seconds = Math.min(MAX_WATCH_SECONDS, Math.max(MIN_WATCH_SECONDS, Math.round(raw) || DEFAULT_WATCH_SECONDS));
    return seconds * 1000;
  }

  enabled(): boolean {
    return this.ctx?.settings.get<boolean>(SCHOOL_ENABLED_ID, false) === true;
  }

  name(): string {
    const stored = this.ctx?.settings.get<string>(SCHOOL_NAME_ID, SHIPPED_MODE_NAME);
    return isValidName(stored) ? stored.trim() : SHIPPED_MODE_NAME;
  }

  /** True once the user has chosen a name of their own. */
  renamed(): boolean {
    return this.name() !== SHIPPED_MODE_NAME;
  }

  credentialStatus(): CredentialStatus {
    return this.credential;
  }

  state(): SchoolModeState {
    const last: ReadOutcome | null = this.store?.last ?? null;
    return {
      enabled: this.enabled(),
      name: this.name(),
      authority: last?.state === 'ok' ? 'shared' : 'mirror',
      record: last?.record ?? null,
      recordPath: this.store?.path() ?? '',
      recordFolder: this.store?.folder() ?? '',
      readState: last?.state ?? 'never',
      readError: last?.error ?? null,
      writeError: this.writeError,
      watching: this.store?.isWatching() === true,
      watchError: this.store?.watchError ?? null,
      lastReadAt: last && last.state !== 'never' ? last.at : null,
      intervalMs: this.intervalMs(),
      credential: this.credential
    };
  }

  /* ---------------- reading the shared record ---------------- */

  async refreshNow(): Promise<void> {
    if (!this.store) return;
    const outcome = await this.store.read();
    await this.applyRecord(outcome, false);
    this.emit();
  }

  async refreshCredential(): Promise<void> {
    if (!this.ctx) return;
    this.credential = await readCredentialStatus(this.ctx.studio);
    this.emit();
  }

  private async onRecordChanged(outcome: ReadOutcome): Promise<void> {
    await this.applyRecord(outcome, true);
    this.emit();
  }

  /**
   * Reconciliation at startup.
   *
   * A record that exists wins, because it is the shared authority and this
   * application may have been closed when it last changed. When none exists yet,
   * this application creates it from its own mirror — somebody has to be first,
   * and doing it at startup means the folder is there before the first change.
   */
  private async reconcile(): Promise<void> {
    if (!this.store) return;
    const outcome = await this.store.read();
    if (outcome.state === 'ok') {
      await this.applyRecord(outcome, false);
      this.emit();
      return;
    }
    if (outcome.state === 'missing') {
      const written = await this.writeRecord(this.enabled(), this.name());
      if (!written.ok) this.writeError = written.error;
    }
    this.emit();
  }

  /** Brings the mirror into line with the record, and repaints if it moved. */
  private async applyRecord(outcome: ReadOutcome, announce: boolean): Promise<void> {
    if (!this.ctx || outcome.state !== 'ok' || !outcome.record) return;
    const record = outcome.record;
    const enabledNow = this.enabled();
    const nameNow = this.name();
    if (record.enabled === enabledNow && record.name === nameNow) return;

    this.applying = true;
    try {
      if (record.name !== nameNow) {
        this.registerNameStrings(record.name);
        this.ctx.settings.set(SCHOOL_NAME_ID, record.name, 'imported');
        this.ctx.settings.set(SETTING_NAME, record.name, 'imported');
      }
      if (record.enabled !== enabledNow) {
        this.ctx.settings.set(SCHOOL_ENABLED_ID, record.enabled, 'imported');
        this.ctx.settings.set(SETTING_ENABLED, record.enabled, 'imported');
      }
    } finally {
      this.applying = false;
    }

    // The language machinery reads the mirror, so it has to be told the mirror
    // moved; the shell repaints from this and the mode arrives with no restart.
    i18n.emit();

    if (announce) {
      const message = this.ctx.t(
        'schoolMode.watch.changedElsewhere',
        'Another application changed the shared record. The new state is now in effect here too.'
      );
      this.ctx.notify.info(record.name, message);
      this.ctx.a11y.announce(message);
      await this.record(
        record.enabled ? 'Study mode turned on' : 'Study mode turned off',
        `${record.name}; from the shared record written by ${record.updatedBy}`
      );
    }
  }

  /**
   * The guard.
   *
   * The shipped language settings carry their own switch for this mode and know
   * nothing about the unlock code. Turning the mode off there would otherwise
   * walk straight past the code the user set, so the value goes back and the
   * unlock prompt opens instead — which is the thing they were trying to do.
   */
  private onMirrorChanged(nowEnabled: boolean): void {
    if (!this.ctx || this.applying) return;
    if (nowEnabled) {
      void this.writeRecord(true, this.name()).then(async (result) => {
        this.writeError = result.ok ? null : result.error;
        await this.record('Study mode turned on', `${this.name()}; from this application's language settings`);
        this.emit();
      });
      return;
    }
    if (this.credential.method === 'none') {
      void this.writeRecord(false, this.name()).then(async (result) => {
        this.writeError = result.ok ? null : result.error;
        await this.record('Study mode turned off', `${this.name()}; no unlock code was set`);
        this.emit();
      });
      return;
    }
    // Put it straight back, then ask for the code.
    this.applying = true;
    try {
      this.ctx.settings.set(SCHOOL_ENABLED_ID, true);
      this.ctx.settings.set(SETTING_ENABLED, true);
    } finally {
      this.applying = false;
    }
    i18n.emit();
    const anchor =
      document.getElementById(`setting-${SCHOOL_ENABLED_ID}`) ??
      document.getElementById(`setting-${SETTING_ENABLED}`) ??
      document.body;
    void this.requestDisable(anchor instanceof HTMLElement ? anchor : document.body);
  }

  /* ---------------- writing ---------------- */

  private async writeRecord(enabled: boolean, name: string): Promise<{ ok: true } | { ok: false; error: string }> {
    if (!this.store || !this.ctx) return { ok: false, error: 'The study mode is not started yet.' };
    const record: SchoolRecord = {
      schemaVersion: 1,
      enabled,
      name,
      credentialMethod: this.credential.method,
      updatedAt: new Date().toISOString(),
      updatedBy: this.ctx.studio.info.packageName
    };
    const written = await this.store.write(record);
    this.writeError = written.ok ? null : written.error;
    return written;
  }

  /* ---------------- the routes a user takes ---------------- */

  /** Turns the mode on, asking first when there is no code to turn it off with. */
  async requestEnable(anchor: HTMLElement): Promise<boolean> {
    if (!this.ctx) return false;
    if (this.enabled()) return true;
    await this.refreshCredential();

    if (this.credential.method === 'none') {
      const folder = this.store?.folder() ?? '';
      const proceed = await this.ctx.components.dialog({
        title: this.ctx.t('schoolMode.enable.noCodeTitle', 'Turn it on with no unlock code?'),
        body: this.ctx.t(
          'schoolMode.enable.noCodeBody',
          'No unlock code is set. It will still turn off from this screen, and deleting the shared record folder at {path} resets it. Set a code first if you want it to ask for one.',
          { values: { path: folder } }
        ),
        confirmLabel: this.ctx.t('schoolMode.enable.noCodeConfirm', 'Turn it on anyway'),
        cancelLabel: this.ctx.t('schoolMode.enable.setCodeFirst', 'Set a code first')
      });
      this.ctx.a11y.focusVisible(anchor);
      if (!proceed) return false;
    }

    const written = await this.writeRecord(true, this.name());
    this.setMirror(true);
    if (!written.ok) this.reportWriteFailure();
    await this.record('Study mode turned on', `${this.name()}; from this application`);
    this.ctx.a11y.announce(
      this.ctx.t('schoolMode.enable.done', '{name} is on. Everything is in English now.', {
        values: { name: this.name() }
      }),
      true
    );
    this.emit();
    return true;
  }

  /** Turns the mode off, through the unlock prompt whenever a code exists. */
  async requestDisable(anchor: HTMLElement): Promise<boolean> {
    if (!this.ctx || this.unlockOpen) return false;
    if (!this.enabled()) return true;
    await this.refreshCredential();

    this.unlockOpen = true;
    let unlocked = false;
    try {
      unlocked = await requestUnlock({
        ctx: this.ctx,
        anchor,
        modeName: this.name(),
        recoveryFolder: this.store?.folder() ?? '',
        credential: this.credential
      });
    } finally {
      this.unlockOpen = false;
    }
    if (!unlocked) return false;

    const written = await this.writeRecord(false, this.name());
    this.setMirror(false);
    if (!written.ok) this.reportWriteFailure();
    await this.record('Study mode turned off', `${this.name()}; unlocked in this application`);
    this.emit();
    return true;
  }

  /** Renames the mode everywhere, including the shared record. */
  async rename(next: string): Promise<{ ok: true } | { ok: false; error: string }> {
    if (!this.ctx) return { ok: false, error: 'The study mode is not started yet.' };
    const trimmed = String(next ?? '').trim();
    if (trimmed === '') {
      return { ok: false, error: this.ctx.t('schoolMode.name.empty', 'The mode needs a name. Nothing was changed.') };
    }
    if (trimmed.length > MAX_NAME_LENGTH) {
      return {
        ok: false,
        error: this.ctx.t('schoolMode.name.tooLong', 'A name may be at most {max} characters. Nothing was changed.', {
          values: { max: MAX_NAME_LENGTH }
        })
      };
    }
    if (!isValidName(trimmed)) {
      return {
        ok: false,
        error: this.ctx.t(
          'schoolMode.name.controlCharacters',
          'A name may not contain line breaks or control characters. Nothing was changed.'
        )
      };
    }
    if (trimmed === this.name()) return { ok: true };

    const written = await this.writeRecord(this.enabled(), trimmed);
    this.registerNameStrings(trimmed);
    this.applying = true;
    try {
      this.ctx.settings.set(SCHOOL_NAME_ID, trimmed);
      this.ctx.settings.set(SETTING_NAME, trimmed);
    } finally {
      this.applying = false;
    }
    i18n.emit();
    if (!written.ok) this.reportWriteFailure();
    await this.record('Study mode renamed', trimmed);
    this.ctx.notify.success(
      trimmed,
      this.ctx.t('schoolMode.name.renamed', 'The mode is now called {name}.', { values: { name: trimmed } })
    );
    this.emit();
    return { ok: true };
  }

  /** Restores the shipped name without ever printing it on a control. */
  async useShippedName(): Promise<void> {
    await this.rename(SHIPPED_MODE_NAME);
  }

  /** Removes the unlock code. The caller runs the two-key gate first. */
  async removeCredential(): Promise<{ ok: true } | { ok: false; error: string }> {
    if (!this.ctx) return { ok: false, error: 'The study mode is not started yet.' };
    const cleared = await clearCredential(this.ctx.studio);
    if (!cleared.ok) return cleared;
    await this.refreshCredential();
    await this.writeRecord(this.enabled(), this.name());
    await this.record('Study mode unlock code removed', 'No unlock code is set');
    this.emit();
    return { ok: true };
  }

  /** Called after a code is stored, so the record carries the new method. */
  async credentialStored(method: 'password' | 'totp'): Promise<void> {
    await this.refreshCredential();
    await this.writeRecord(this.enabled(), this.name());
    await this.record(
      'Study mode unlock code set',
      method === 'totp' ? 'An authenticator is paired' : 'A password or PIN is set'
    );
    this.emit();
  }

  /* ---------------- helpers ---------------- */

  private setMirror(enabled: boolean): void {
    if (!this.ctx) return;
    this.applying = true;
    try {
      this.ctx.settings.set(SCHOOL_ENABLED_ID, enabled);
      this.ctx.settings.set(SETTING_ENABLED, enabled);
    } finally {
      this.applying = false;
    }
    i18n.emit();
  }

  private reportWriteFailure(): void {
    if (!this.ctx || !this.writeError) return;
    this.ctx.notify.warn(
      this.name(),
      this.ctx.t(
        'schoolMode.shared.writeFailed',
        'The shared record at {path} could not be written: {error} The change stayed local to this application.',
        { values: { path: this.store?.path() ?? '', error: this.writeError } }
      )
    );
  }

  private registerNameStrings(name: string): void {
    i18n.register(nameStrings(name));
  }

  /**
   * Appends one entry to the local version history.
   *
   * The payload names the state, the chosen name and where the change came from.
   * It never carries the unlock code, any part of it, or anything from which its
   * length or shape could be inferred — the code is not recorded anywhere.
   */
  private async record(action: string, detail: string): Promise<void> {
    if (!this.ctx) return;
    await this.ctx.history.record(action, HISTORY_SOURCE, {
      enabled: this.enabled(),
      name: this.name(),
      credentialMethod: this.credential.method,
      detail
    });
    this.activityCache = [];
  }

  /** Reads this feature's own entries out of the local version history. */
  async activity(): Promise<ActivityEntry[]> {
    if (!this.ctx) return [];
    if (this.activityCache.length > 0) return this.activityCache;
    const entries = await this.ctx.history.list({ limit: 500 });
    this.activityCache = entries
      .filter((entry) => entry.source === HISTORY_SOURCE)
      .map((entry) => ({
        id: entry.id,
        at: entry.timestamp,
        action: entry.action,
        detail: describePayload(entry.payload)
      }));
    return this.activityCache;
  }

  invalidateActivity(): void {
    this.activityCache = [];
  }
}

function describePayload(payload: unknown): string {
  if (payload === null || payload === undefined) return '';
  if (typeof payload === 'string') return payload;
  if (typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    const detail = typeof record.detail === 'string' ? record.detail : '';
    const method = typeof record.credentialMethod === 'string' ? record.credentialMethod : '';
    return [detail, method ? `unlock method: ${method}` : ''].filter((part) => part !== '').join('; ');
  }
  return String(payload);
}

export const schoolMode = new SchoolModeController();
