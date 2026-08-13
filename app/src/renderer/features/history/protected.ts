import type { AppContext, HistoryEntry } from '../../core/registry';
import { hashPassword, verifyPassword, verifyTotp } from '../../core/totp';
import type { TotpAlgorithm } from '../../core/totp';
import { base64ToBytes, bytesToBase64, describeError, fingerprint, safeJson } from './util';

/**
 * The secret and display-name mutation history.
 *
 * What this is for: adding, removing or modifying an authenticator entry, and
 * creating, changing or resetting the application's display name, each get their
 * own entry, written BEFORE the operation reports itself complete.
 *
 * Three properties are load-bearing.
 *
 * No usable secret ever enters an entry. The payload carries a redacted label, a
 * one-way fingerprint and — when the credential store can hold a key — an
 * encrypted body whose plaintext is metadata only. Anything with a
 * credential-shaped field name, anything that looks like a pairing URI and
 * anything that looks like a shared secret is dropped before encryption, and the
 * entry names how many fields were dropped.
 *
 * The log has its OWN credential. Nothing else in the application unlocks it and
 * it unlocks nothing else. There is no master credential, and it starts locked on
 * every launch whatever the unlock duration is set to.
 *
 * It fails safe and visibly. When the credential store, the key or the history
 * repository is unavailable, the mutation is never reported as recorded: the
 * live data is left exactly as the user's operation left it, the caller gets the
 * exact reason, and the panel says which part is missing.
 */

export const SECRET_MUTATION_EVENT = 'studio:secret-mutation';
export const PROTECTED_SOURCE = 'history.protected';

const VAULT_FACTOR_ACCOUNT = 'history.manager.factor';
const VAULT_ENVELOPE_ACCOUNT = 'history.manager.envelope';
const MAX_METADATA_CHARS = 4000;
const MAX_ATTEMPTS = 5;
const COOLDOWN_MS = 30_000;

export const UNLOCK_MINUTES_ID = 'history.protected.unlockMinutes';

/**
 * The core setting id for the user-chosen application display name.
 *
 * It is mirrored here rather than imported, because the integration contract's
 * import table does not expose the core feature module — and a mirrored constant
 * can silently stop matching, so `install` checks that a control with this id
 * genuinely exists and reports it loudly if it does not. A recorder that has
 * quietly stopped observing is the failure this check is for.
 */
const APP_DISPLAY_NAME_ID = 'app.displayName';

/**
 * The event a sibling feature dispatches to have a mutation recorded.
 *
 * The emitter builds the detail with an empty `pending` array, dispatches it,
 * then awaits `Promise.all(detail.pending)` before reporting its own operation
 * complete — the same collector shape a service worker's `waitUntil` uses. If no
 * recorder is installed the array stays empty and the await resolves at once,
 * which is why an emitter must check the outcomes rather than assume one arrived.
 */
export interface SecretMutationDetail {
  /** e.g. `authenticator.added`, `displayName.changed`. */
  kind: string;
  /** A redacted human label for the thing that changed. Never a secret. */
  target: string;
  /** What changed, in words. Never a secret. */
  summary: string;
  /** Non-secret metadata for the encrypted body. Scrubbed before encryption. */
  metadata?: Record<string, unknown>;
  /** Collector the emitter awaits. */
  pending?: Array<Promise<SecretMutationOutcome>>;
}

export interface SecretMutationOutcome {
  ok: boolean;
  entryId?: string;
  error?: string;
  /** Whether an encrypted body was written, and if not, why not. */
  envelope: 'encrypted' | 'omitted';
  envelopeReason?: string;
  /** Field names dropped before encryption because they looked credential-shaped. */
  scrubbed: string[];
}

export interface ProtectedPayload {
  kind: string;
  target: string;
  summary: string;
  fingerprint: string;
  envelope: { alg: string; iv: string; body: string } | null;
  envelopeUnavailable?: string;
  scrubbed?: string[];
  /** Account key of the credential-store entry this mutation concerned, if any. */
  account?: string;
}

export type FactorMethod = 'password' | 'totp';

interface StoredFactor {
  v: 1;
  method: FactorMethod;
  verifier?: string;
  secret?: string;
  algorithm?: TotpAlgorithm;
  digits?: number;
  period?: number;
}

/** Field names whose values never reach an encrypted body, let alone a plain one. */
const CREDENTIAL_SHAPED =
  /(pass(word)?|secret|pin\b|otp|totp|token|credential|verifier|qr|pairing|seed|privatekey|private_key|apikey|api_key|authorization|cookie|recovery)/i;

/** Values that look like a shared secret even under an innocent field name. */
function looksLikeSecretValue(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  if (/^otpauth:\/\//i.test(value)) return true;
  if (/^[A-Z2-7]{16,}={0,6}$/.test(value.replace(/\s+/g, ''))) return true;
  return false;
}

export interface ScrubResult {
  metadata: Record<string, unknown>;
  dropped: string[];
}

/** Removes anything credential-shaped, by name and by value, reporting each drop. */
export function scrubMetadata(input: Record<string, unknown> | undefined): ScrubResult {
  const dropped: string[] = [];
  if (!input) return { metadata: {}, dropped };

  const walk = (value: unknown, path: string, depth: number): unknown => {
    if (depth > 6) return '[depth limit]';
    if (Array.isArray(value)) return value.slice(0, 50).map((item, index) => walk(item, `${path}.${index}`, depth + 1));
    if (value !== null && typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
        const childPath = path === '' ? key : `${path}.${key}`;
        if (CREDENTIAL_SHAPED.test(key)) {
          dropped.push(childPath);
          continue;
        }
        if (looksLikeSecretValue(item)) {
          dropped.push(`${childPath} (the value looked like a shared secret)`);
          continue;
        }
        out[key] = walk(item, childPath, depth + 1);
      }
      return out;
    }
    return value;
  };

  const metadata = walk(input, '', 0) as Record<string, unknown>;
  return { metadata, dropped };
}

export interface VaultDrift {
  checked: number;
  /** Accounts the credential store holds that no entry ever mentioned. */
  unrecorded: string[];
  /** Accounts entries mention that the credential store no longer holds. */
  orphaned: string[];
}

export class ProtectedHistory {
  private key: CryptoKey | null = null;
  private keyFailure = '';
  private unlockedUntil = 0;
  private surfaceUnlocked = false;
  private attempts = 0;
  private cooldownUntil = 0;
  private readonly listeners = new Set<() => void>();

  constructor(private readonly ctx: AppContext) {}

  /* ---------------- observation ---------------- */

  /**
   * Starts recording.
   *
   * Two sources feed it: the cross-feature event, and this application's own
   * display-name setting, which needs no coordination with anybody.
   */
  install(): () => void {
    // A mirrored setting id that no longer names a real control means this
    // recorder has stopped watching the display name, which would otherwise
    // look exactly like a display name nobody ever changed.
    if (!this.ctx.registry.settingControl(APP_DISPLAY_NAME_ID)) {
      const message = `The protected mutation log watches the setting "${APP_DISPLAY_NAME_ID}", and no control claims that id. Display-name changes are not being recorded.`;
      console.error(message);
      this.ctx.notify.warn(this.ctx.t('history.protected.title', 'Protected mutation log'), message);
    }

    const onMutation = (event: Event): void => {
      const detail = (event as CustomEvent<SecretMutationDetail>).detail;
      if (!detail || typeof detail.kind !== 'string') return;
      const promise = this.record(detail);
      if (Array.isArray(detail.pending)) detail.pending.push(promise);
      else void promise;
    };
    document.addEventListener(SECRET_MUTATION_EVENT, onMutation);

    const offSettings = this.ctx.settings.onChange((change) => {
      if (change.id !== APP_DISPLAY_NAME_ID) return;
      const previous = typeof change.previous === 'string' ? change.previous : '';
      const next = typeof change.value === 'string' ? change.value : '';
      const kind = next === '' ? 'displayName.reset' : previous === '' ? 'displayName.created' : 'displayName.changed';
      const shipped = this.ctx.studio.info.productName;
      void this.record({
        kind,
        target: 'The application display name',
        summary:
          next === ''
            ? `The display name was reset, so the application introduces itself as ${shipped} again.`
            : `The display name became "${next}".`,
        metadata: { previousDisplayName: previous, newDisplayName: next, shippedProductName: shipped }
      }).then((outcome) => {
        if (outcome.ok) return;
        this.reportFailure(outcome.error ?? 'the reason was not reported');
      });
    });

    return () => {
      document.removeEventListener(SECRET_MUTATION_EVENT, onMutation);
      offSettings();
    };
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private announceChange(): void {
    for (const listener of [...this.listeners]) {
      try {
        listener();
      } catch (error) {
        console.error('A protected-history listener threw:', error);
      }
    }
  }

  private reportFailure(reason: string): void {
    this.ctx.notify.show({
      title: this.ctx.t('history.protected.title', 'Protected mutation log', { dialog: true }),
      body: this.ctx.t(
        'history.protected.recordFailed',
        'The mutation happened, but it was not recorded: {reason} Your data is untouched; the log is incomplete and says so here.',
        { values: { reason } }
      ),
      severity: 'error',
      source: PROTECTED_SOURCE,
      actions: [
        {
          label: this.ctx.t('history.palette.openProtected', 'Open the protected mutation log'),
          run: () => this.ctx.tabs.open('history.protected')
        }
      ]
    });
  }

  /* ---------------- recording ---------------- */

  /**
   * Writes one mutation.
   *
   * The order matters: scrub, then encrypt, then append. If the append fails the
   * caller is told it failed — this never returns `ok` for an entry that is not
   * on disk.
   */
  async record(mutation: SecretMutationDetail): Promise<SecretMutationOutcome> {
    const scrub = scrubMetadata(mutation.metadata);
    let metadataJson = safeJson(scrub.metadata);
    if (metadataJson.length > MAX_METADATA_CHARS) {
      scrub.dropped.push(`(the metadata was ${metadataJson.length} characters, beyond the ${MAX_METADATA_CHARS} ceiling)`);
      metadataJson = safeJson({ omitted: `metadata beyond the ${MAX_METADATA_CHARS}-character ceiling` });
    }

    const sealed = await this.seal(metadataJson);
    const payload: ProtectedPayload = {
      kind: mutation.kind,
      target: mutation.target,
      summary: mutation.summary,
      fingerprint: await fingerprint(`${mutation.kind}\n${mutation.target}`),
      envelope: sealed.envelope
    };
    if (sealed.reason) payload.envelopeUnavailable = sealed.reason;
    if (scrub.dropped.length > 0) payload.scrubbed = scrub.dropped;
    const account = typeof mutation.metadata?.account === 'string' ? mutation.metadata.account : undefined;
    if (account) payload.account = account;

    const result = await this.ctx.studio.history.record(mutation.summary, PROTECTED_SOURCE, payload);
    if (!result.ok) {
      return {
        ok: false,
        error: result.error,
        envelope: sealed.envelope ? 'encrypted' : 'omitted',
        envelopeReason: sealed.reason,
        scrubbed: scrub.dropped
      };
    }
    this.announceChange();
    return {
      ok: true,
      entryId: result.value.id,
      envelope: sealed.envelope ? 'encrypted' : 'omitted',
      envelopeReason: sealed.reason,
      scrubbed: scrub.dropped
    };
  }

  private async seal(plaintext: string): Promise<{ envelope: ProtectedPayload['envelope']; reason?: string }> {
    const key = await this.envelopeKey();
    if (!key) {
      return { envelope: null, reason: this.keyFailure || 'the credential store could not hold an encryption key' };
    }
    try {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const cipher = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv.slice().buffer as ArrayBuffer },
        key,
        new TextEncoder().encode(plaintext)
      );
      return {
        envelope: { alg: 'AES-GCM-256', iv: bytesToBase64(iv), body: bytesToBase64(new Uint8Array(cipher)) }
      };
    } catch (error) {
      return { envelope: null, reason: describeError(error) };
    }
  }

  /** Reads back the metadata of one entry. Never a secret: there is none in there. */
  async openEnvelope(payload: ProtectedPayload): Promise<{ ok: true; metadata: unknown } | { ok: false; error: string }> {
    if (!payload.envelope) {
      return { ok: false, error: payload.envelopeUnavailable ?? 'this entry carries no encrypted body' };
    }
    const key = await this.envelopeKey();
    if (!key) return { ok: false, error: this.keyFailure || 'the encryption key is not available on this machine' };
    try {
      const plain = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: base64ToBytes(payload.envelope.iv).slice().buffer as ArrayBuffer },
        key,
        base64ToBytes(payload.envelope.body).slice().buffer as ArrayBuffer
      );
      return { ok: true, metadata: JSON.parse(new TextDecoder().decode(plain)) as unknown };
    } catch (error) {
      return { ok: false, error: describeError(error) };
    }
  }

  private async envelopeKey(): Promise<CryptoKey | null> {
    if (this.key) return this.key;
    const existing = await this.ctx.studio.vault.get(VAULT_ENVELOPE_ACCOUNT);
    if (existing.ok && existing.value) {
      try {
        this.key = await crypto.subtle.importKey(
          'raw',
          base64ToBytes(existing.value).slice().buffer as ArrayBuffer,
          { name: 'AES-GCM' },
          false,
          ['encrypt', 'decrypt']
        );
        this.keyFailure = '';
        return this.key;
      } catch (error) {
        this.keyFailure = `the stored encryption key could not be read (${describeError(error)})`;
        return null;
      }
    }
    if (!existing.ok) {
      this.keyFailure = existing.error;
      return null;
    }
    const raw = crypto.getRandomValues(new Uint8Array(32));
    const stored = await this.ctx.studio.vault.set(VAULT_ENVELOPE_ACCOUNT, bytesToBase64(raw));
    if (!stored.ok) {
      this.keyFailure = stored.error;
      return null;
    }
    try {
      this.key = await crypto.subtle.importKey('raw', raw.slice().buffer as ArrayBuffer, { name: 'AES-GCM' }, false, [
        'encrypt',
        'decrypt'
      ]);
      this.keyFailure = '';
      return this.key;
    } catch (error) {
      this.keyFailure = describeError(error);
      return null;
    }
  }

  /* ---------------- the log's own credential ---------------- */

  async hasFactor(): Promise<boolean> {
    const result = await this.ctx.studio.vault.has(VAULT_FACTOR_ACCOUNT);
    return result.ok && result.value;
  }

  async factorMethod(): Promise<FactorMethod | null> {
    const stored = await this.readFactor();
    return stored?.method ?? null;
  }

  private async readFactor(): Promise<StoredFactor | null> {
    const result = await this.ctx.studio.vault.get(VAULT_FACTOR_ACCOUNT);
    if (!result.ok || !result.value) return null;
    try {
      const parsed = JSON.parse(result.value) as StoredFactor;
      if (parsed.v !== 1) return null;
      if (parsed.method !== 'password' && parsed.method !== 'totp') return null;
      return parsed;
    } catch {
      return null;
    }
  }

  async setPasswordFactor(password: string): Promise<{ ok: boolean; error?: string }> {
    const verifier = await hashPassword(password);
    const factor: StoredFactor = { v: 1, method: 'password', verifier };
    const stored = await this.ctx.studio.vault.set(VAULT_FACTOR_ACCOUNT, JSON.stringify(factor));
    if (!stored.ok) return { ok: false, error: stored.error };
    this.lock();
    return { ok: true };
  }

  /**
   * Stores a pairing only after one live code has verified against it.
   *
   * Without that step a mistyped or mis-scanned secret locks somebody out of a
   * thing they have just set up, and the first they hear of it is the next time
   * they need it.
   */
  async setTotpFactor(
    parameters: { secret: string; algorithm: TotpAlgorithm; digits: number; period: number },
    confirmationCode: string
  ): Promise<{ ok: boolean; error?: string }> {
    const matched = await verifyTotp(parameters, confirmationCode);
    if (!matched) {
      return {
        ok: false,
        error: this.ctx.t(
          'history.protected.pairingFailed',
          'That code did not match, so the credential was not stored and this log is unchanged.'
        )
      };
    }
    const factor: StoredFactor = {
      v: 1,
      method: 'totp',
      secret: parameters.secret,
      algorithm: parameters.algorithm,
      digits: parameters.digits,
      period: parameters.period
    };
    const stored = await this.ctx.studio.vault.set(VAULT_FACTOR_ACCOUNT, JSON.stringify(factor));
    if (!stored.ok) return { ok: false, error: stored.error };
    this.lock();
    return { ok: true };
  }

  async removeFactor(): Promise<{ ok: boolean; error?: string }> {
    const removed = await this.ctx.studio.vault.delete(VAULT_FACTOR_ACCOUNT);
    if (!removed.ok) return { ok: false, error: removed.error };
    this.lock();
    return { ok: true };
  }

  /** Seconds left on the cooldown, or zero when there is none. */
  cooldownSeconds(): number {
    const remaining = this.cooldownUntil - Date.now();
    return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
  }

  attemptsRemaining(): number {
    return Math.max(0, MAX_ATTEMPTS - this.attempts);
  }

  async attemptUnlock(candidate: string): Promise<{ ok: boolean; error?: string }> {
    if (this.cooldownSeconds() > 0) {
      return {
        ok: false,
        error: this.ctx.t('history.protected.cooldown', 'Too many attempts. Try again in {seconds} seconds.', {
          values: { seconds: this.cooldownSeconds() }
        })
      };
    }
    const factor = await this.readFactor();
    if (!factor) {
      // No credential set: the log is not protecting anything and says so
      // rather than pretending an unlock happened.
      this.applyUnlock();
      return { ok: true };
    }
    let matched = false;
    if (factor.method === 'password') {
      matched = typeof factor.verifier === 'string' && (await verifyPassword(candidate, factor.verifier));
    } else if (factor.secret) {
      matched = await verifyTotp(
        {
          secret: factor.secret,
          algorithm: factor.algorithm ?? 'SHA-1',
          digits: factor.digits ?? 6,
          period: factor.period ?? 30
        },
        candidate
      );
    }
    if (!matched) {
      this.attempts += 1;
      if (this.attempts >= MAX_ATTEMPTS) {
        this.cooldownUntil = Date.now() + COOLDOWN_MS;
        this.attempts = 0;
        return {
          ok: false,
          error: this.ctx.t('history.protected.cooldown', 'Too many attempts. Try again in {seconds} seconds.', {
            values: { seconds: Math.ceil(COOLDOWN_MS / 1000) }
          })
        };
      }
      return {
        ok: false,
        error: this.ctx.t(
          'history.protected.wrong',
          'That did not match. Nothing was deleted and nothing was changed. {remaining} attempts before a short wait.',
          { values: { remaining: this.attemptsRemaining() } }
        )
      };
    }
    this.attempts = 0;
    this.applyUnlock();
    return { ok: true };
  }

  private applyUnlock(): void {
    const raw = String(this.ctx.settings.get<string>(UNLOCK_MINUTES_ID, '15'));
    const minutes = Number(raw);
    if (raw === '-1' || minutes === -1) {
      this.unlockedUntil = Number.POSITIVE_INFINITY;
      this.surfaceUnlocked = true;
    } else if (raw === '0' || minutes === 0) {
      this.unlockedUntil = 0;
      this.surfaceUnlocked = true;
    } else {
      this.unlockedUntil = Date.now() + minutes * 60_000;
      this.surfaceUnlocked = true;
    }
    this.announceChange();
  }

  isUnlocked(): boolean {
    if (!this.surfaceUnlocked) return false;
    if (this.unlockedUntil === 0) return true;
    return Date.now() < this.unlockedUntil;
  }

  /** How the current unlock ends, in words, for the panel to state honestly. */
  unlockDescription(): string {
    if (!this.isUnlocked()) return '';
    if (this.unlockedUntil === Number.POSITIVE_INFINITY) return 'until this application closes';
    if (this.unlockedUntil === 0) return 'while this surface stays open';
    const seconds = Math.max(0, Math.round((this.unlockedUntil - Date.now()) / 1000));
    return `for another ${Math.floor(seconds / 60)} minutes and ${seconds % 60} seconds`;
  }

  lock(): void {
    this.surfaceUnlocked = false;
    this.unlockedUntil = 0;
    this.announceChange();
  }

  /* ---------------- reading ---------------- */

  async entries(): Promise<HistoryEntry[]> {
    const result = await this.ctx.studio.history.list({});
    if (!result.ok) throw new Error(result.error);
    return result.value.filter((entry) => entry.source === PROTECTED_SOURCE);
  }

  /**
   * Compares the log against the credential store, by account key only.
   *
   * Drift is reported rather than quietly written down. A log that invents the
   * entries it thinks should exist is worse than a log with a visible gap,
   * because the gap can be investigated and the invention cannot be told apart
   * from the truth.
   */
  async verifyAgainstVault(): Promise<VaultDrift> {
    const accountsResult = await this.ctx.studio.vault.listAccounts();
    if (!accountsResult.ok) throw new Error(accountsResult.error);
    const stored = new Set(
      accountsResult.value.filter((account) => account !== VAULT_FACTOR_ACCOUNT && account !== VAULT_ENVELOPE_ACCOUNT)
    );
    const mentioned = new Set<string>();
    for (const entry of await this.entries()) {
      const payload = entry.payload as ProtectedPayload | null;
      if (payload && typeof payload.account === 'string') mentioned.add(payload.account);
    }
    return {
      checked: stored.size,
      unrecorded: [...stored].filter((account) => !mentioned.has(account)).sort(),
      orphaned: [...mentioned].filter((account) => !stored.has(account)).sort()
    };
  }

  /** The exact folder a locked-out user deletes to reset this credential. */
  recoveryPath(): string {
    return this.ctx.studio.info.userDataDir;
  }
}

/**
 * Helper for a sibling feature: dispatches the event and waits for whatever
 * recorders answered, so the caller can refuse to report success when the
 * mutation was not written down.
 */
export async function announceSecretMutation(
  detail: Omit<SecretMutationDetail, 'pending'>
): Promise<SecretMutationOutcome[]> {
  const pending: Array<Promise<SecretMutationOutcome>> = [];
  document.dispatchEvent(new CustomEvent<SecretMutationDetail>(SECRET_MUTATION_EVENT, { detail: { ...detail, pending } }));
  return Promise.all(pending);
}
