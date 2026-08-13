import { hashPassword, verifyPassword, verifyTotp } from '../../core/totp';
import type { StudioApi } from '../../core/registry';
import type { CredentialMethod } from './shared-record';

/**
 * The unlock code.
 *
 * Three properties, and each of them is the whole point:
 *
 * A password or PIN is stored as a PBKDF2 verifier, never as the code. There is
 * no route in this module — or anywhere in the application — that returns a
 * password, states its length, or characterises it in any way.
 *
 * The verifier and the authenticator secret live in the operating system's
 * credential vault, under stable account keys shared by every application in the
 * suite, so the same code opens the mode wherever it is asked for. Neither ever
 * enters the settings file, the shared record, an export, the local version
 * history, a log line or a screenshot.
 *
 * It is a user-experience lock rather than a security boundary, and the surface
 * says so. Somebody who can reach the disk can delete the shared record and be
 * done with it; that route is documented rather than hidden, because a lock that
 * pretends to be protection is worse than one that is honest about being a
 * speed bump.
 */

/**
 * Account keys. `school.unlock` is deliberately the key this application's core
 * already writes its password verifier to, so a code set through either surface
 * opens the mode from both.
 */
export const PASSWORD_ACCOUNT = 'school.unlock';
export const TOTP_ACCOUNT = 'school.unlock.totp';

export const MIN_PASSWORD_LENGTH = 4;

export const TOTP_PARAMETERS = {
  algorithm: 'SHA-1',
  digits: 6,
  period: 30
} as const;

export interface CredentialStatus {
  method: CredentialMethod;
  /** True when the operating system's encryption service is usable here. */
  vaultAvailable: boolean;
  /** The vault backend's own name, e.g. "dpapi". Never a secret. */
  backend: string;
  /** Set when the vault could not be inspected at all. */
  error: string | null;
}

export const UNKNOWN_CREDENTIAL: CredentialStatus = {
  method: 'none',
  vaultAvailable: false,
  backend: 'unknown',
  error: null
};

/** Reads which kind of code exists. It never reads the code itself. */
export async function readCredentialStatus(studio: StudioApi): Promise<CredentialStatus> {
  const status = await studio.vault.status();
  if (!status.ok) {
    return { method: 'none', vaultAvailable: false, backend: 'unknown', error: status.error };
  }
  const [password, totp] = await Promise.all([studio.vault.has(PASSWORD_ACCOUNT), studio.vault.has(TOTP_ACCOUNT)]);
  const hasTotp = totp.ok && totp.value;
  const hasPassword = password.ok && password.value;
  const readError = !password.ok ? password.error : !totp.ok ? totp.error : null;
  return {
    // An authenticator pairing is checked first: it is the more recently set of
    // the two whenever both exist, because pairing clears the password.
    method: hasTotp ? 'totp' : hasPassword ? 'password' : 'none',
    vaultAvailable: status.value.encryptionAvailable,
    backend: status.value.backend,
    error: readError
  };
}

/** Stores a password or PIN as a verifier. The code is never written down. */
export async function storePassword(
  studio: StudioApi,
  code: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const verifier = await hashPassword(code);
  const stored = await studio.vault.set(PASSWORD_ACCOUNT, verifier);
  if (!stored.ok) return { ok: false, error: stored.error };
  // Only one method is in effect at a time, so the other is cleared rather than
  // left behind where it would silently keep opening the mode.
  await studio.vault.delete(TOTP_ACCOUNT);
  return { ok: true };
}

/** Stores an authenticator secret after the user has proved they can read it. */
export async function storeTotpSecret(
  studio: StudioApi,
  secret: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const stored = await studio.vault.set(TOTP_ACCOUNT, secret);
  if (!stored.ok) return { ok: false, error: stored.error };
  await studio.vault.delete(PASSWORD_ACCOUNT);
  return { ok: true };
}

export async function clearCredential(studio: StudioApi): Promise<{ ok: true } | { ok: false; error: string }> {
  const password = await studio.vault.delete(PASSWORD_ACCOUNT);
  const totp = await studio.vault.delete(TOTP_ACCOUNT);
  if (!password.ok) return { ok: false, error: password.error };
  if (!totp.ok) return { ok: false, error: totp.error };
  return { ok: true };
}

export type VerifyOutcome =
  | { ok: true }
  | { ok: false; reason: 'no-credential' }
  | { ok: false; reason: 'wrong' }
  | { ok: false; reason: 'error'; error: string };

/**
 * Checks a candidate against whichever method is configured.
 *
 * A wrong answer and a broken vault are different outcomes, because they need
 * different things from the user: one is "try again", the other is "this cannot
 * be checked at all right now and here is exactly why".
 */
export async function verifyCandidate(
  studio: StudioApi,
  method: CredentialMethod,
  candidate: string
): Promise<VerifyOutcome> {
  if (method === 'none') return { ok: false, reason: 'no-credential' };
  const account = method === 'totp' ? TOTP_ACCOUNT : PASSWORD_ACCOUNT;
  const stored = await studio.vault.get(account);
  if (!stored.ok) return { ok: false, reason: 'error', error: stored.error };
  if (stored.value === null || stored.value === '') return { ok: false, reason: 'no-credential' };
  try {
    const matched =
      method === 'totp'
        ? await verifyTotp({ secret: stored.value, ...TOTP_PARAMETERS }, candidate)
        : await verifyPassword(candidate, stored.value);
    return matched ? { ok: true } : { ok: false, reason: 'wrong' };
  } catch (error) {
    return { ok: false, reason: 'error', error: error instanceof Error ? error.message : String(error) };
  }
}

/* ------------------------------------------------------------------ */
/* Attempt pacing                                                      */
/* ------------------------------------------------------------------ */

/**
 * Wrong-answer pacing, held in memory for the life of the window.
 *
 * It lives here rather than inside the prompt so that closing the prompt and
 * reopening it does not reset the wait — which would make the pacing decorative.
 * It never wipes anything, never escalates and never pretends to be enforcement:
 * it is a pause, and the recovery route is stated beside it the whole time.
 */
const FREE_ATTEMPTS = 3;
const BASE_WAIT_MS = 5_000;
const MAX_WAIT_MS = 60_000;

let failures = 0;
let blockedUntil = 0;

export function attemptCount(): number {
  return failures;
}

/** Milliseconds still to wait, or 0 when an attempt is allowed right now. */
export function waitRemainingMs(now = Date.now()): number {
  return Math.max(0, blockedUntil - now);
}

export function recordFailure(now = Date.now()): void {
  failures += 1;
  if (failures > FREE_ATTEMPTS) {
    const step = failures - FREE_ATTEMPTS - 1;
    blockedUntil = now + Math.min(MAX_WAIT_MS, BASE_WAIT_MS * 2 ** step);
  }
}

export function recordSuccess(): void {
  failures = 0;
  blockedUntil = 0;
}
