/**
 * The record shape, the pairing URI, and the validation around both.
 *
 * Parameters carried by a pairing URI are HONOURED rather than overwritten with
 * this application's defaults. An issuer that uses eight digits, a fifty second
 * period or SHA-512 is entirely legitimate, and quietly replacing those with
 * six/thirty/SHA-1 produces an entry that generates ordinary looking codes which
 * every service refuses, with nothing on screen to explain why.
 */

import { base32Decode, type TotpAlgorithm } from '../../core/totp';

export const ALGORITHMS: TotpAlgorithm[] = ['SHA-1', 'SHA-256', 'SHA-512'];

export const DEFAULTS = {
  algorithm: 'SHA-1' as TotpAlgorithm,
  digits: 6,
  period: 30
};

export const LIMITS = {
  minDigits: 6,
  maxDigits: 8,
  minPeriod: 5,
  maxPeriod: 300,
  maxIssuerLength: 120,
  maxAccountLength: 160,
  maxLabelLength: 120,
  maxNoteLength: 400,
  maxEntries: 500,
  /** A picture larger than this is refused before it is decoded. */
  maxImageBytes: 12 * 1024 * 1024
};

export interface AuthenticatorEntry {
  /** Stable for the life of the entry; the vault key hangs off it. */
  id: string;
  issuer: string;
  account: string;
  /** What the list shows. Defaults to the issuer and is the user's to change. */
  label: string;
  /** A name from the bundled icon set. Never a remote image. */
  icon: string;
  group: string | null;
  order: number;
  algorithm: TotpAlgorithm;
  digits: number;
  period: number;
  createdAt: string;
  /**
   * True when a live code from this secret was matched during registration.
   * False means the user could not check it at the time and said so.
   */
  verified: boolean;
  note: string;
}

export interface AuthenticatorGroup {
  id: string;
  name: string;
  color: string;
  collapsed: boolean;
  order: number;
}

export interface PairingParameters {
  issuer: string;
  account: string;
  secret: string;
  algorithm: TotpAlgorithm;
  digits: number;
  period: number;
}

export class PairingUriError extends Error {}

/* ------------------------------------------------------------------ */
/* Base32                                                              */
/* ------------------------------------------------------------------ */

/** Validates a base32 secret and returns it in canonical form. */
export function normalizeSecret(raw: string): string {
  const cleaned = raw.replace(/[\s-]+/g, '').replace(/=+$/, '').toUpperCase();
  if (cleaned === '') throw new PairingUriError('The secret is empty.');
  if (!/^[A-Z2-7]+$/.test(cleaned)) {
    throw new PairingUriError(
      'A base32 secret uses only the letters A to Z and the digits 2 to 7. Check for a 0, 1, 8 or 9 that should be an O, I, B or G.'
    );
  }
  let decoded: Uint8Array;
  try {
    decoded = base32Decode(cleaned);
  } catch (error) {
    throw new PairingUriError(error instanceof Error ? error.message : 'That secret is not valid base32.');
  }
  if (decoded.length < 10) {
    throw new PairingUriError(
      `That secret decodes to ${decoded.length} bytes. A one-time code secret is at least 10 bytes (16 base32 characters), so this is probably incomplete.`
    );
  }
  return cleaned;
}

/** Groups a secret into fours so it can be read aloud and typed accurately. */
export function groupSecret(secret: string): string {
  return (secret.match(/.{1,4}/g) ?? []).join(' ');
}

/* ------------------------------------------------------------------ */
/* Pairing URIs                                                        */
/* ------------------------------------------------------------------ */

function normalizeAlgorithm(raw: string): TotpAlgorithm {
  const cleaned = raw.trim().toUpperCase().replace(/[-_\s]/g, '');
  if (cleaned === 'SHA1') return 'SHA-1';
  if (cleaned === 'SHA256') return 'SHA-256';
  if (cleaned === 'SHA512') return 'SHA-512';
  throw new PairingUriError(
    `"${raw}" is not an algorithm this application can compute. It handles SHA-1, SHA-256 and SHA-512.`
  );
}

/**
 * Parses a standard `otpauth://totp/` URI.
 *
 * Everything the URI states is kept. Anything it omits falls back to the
 * standard default (SHA-1, six digits, thirty seconds) rather than to a local
 * preference, because those defaults are what the issuer assumed when it left
 * the parameter out.
 */
export function parsePairingUri(input: string): PairingParameters {
  const trimmed = input.trim();
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new PairingUriError('That is not a URI. A pairing link starts with "otpauth://totp/".');
  }
  if (url.protocol !== 'otpauth:') {
    throw new PairingUriError(`This reads "${url.protocol}" where a pairing link starts with "otpauth://".`);
  }
  const kind = url.host.toLowerCase();
  if (kind === 'hotp') {
    throw new PairingUriError(
      'That is a counter-based (HOTP) link. This authenticator holds time-based (TOTP) entries, so it cannot keep the counter that one needs.'
    );
  }
  if (kind !== 'totp') {
    throw new PairingUriError(`"${url.host}" is not a code type this application handles; it handles "totp".`);
  }

  const rawLabel = decodeURIComponent(url.pathname.replace(/^\//, ''));
  let labelIssuer = '';
  let account = rawLabel;
  const separator = rawLabel.indexOf(':');
  if (separator > -1) {
    labelIssuer = rawLabel.slice(0, separator).trim();
    account = rawLabel.slice(separator + 1).trim();
  }

  const parameters = url.searchParams;
  const secretRaw = parameters.get('secret');
  if (!secretRaw) throw new PairingUriError('That link carries no secret, so there is nothing to pair.');
  const secret = normalizeSecret(secretRaw);

  const issuerParameter = parameters.get('issuer')?.trim() ?? '';
  const issuer = issuerParameter || labelIssuer;

  const algorithm = parameters.has('algorithm') ? normalizeAlgorithm(parameters.get('algorithm') ?? '') : DEFAULTS.algorithm;

  let digits = DEFAULTS.digits;
  if (parameters.has('digits')) {
    digits = Number.parseInt(parameters.get('digits') ?? '', 10);
    if (!Number.isInteger(digits) || digits < LIMITS.minDigits || digits > LIMITS.maxDigits) {
      throw new PairingUriError(
        `That link asks for ${parameters.get('digits')} digits. This application generates ${LIMITS.minDigits} to ${LIMITS.maxDigits}.`
      );
    }
  }

  let period = DEFAULTS.period;
  if (parameters.has('period')) {
    period = Number.parseInt(parameters.get('period') ?? '', 10);
    if (!Number.isInteger(period) || period < LIMITS.minPeriod || period > LIMITS.maxPeriod) {
      throw new PairingUriError(
        `That link asks for a ${parameters.get('period')} second period. This application handles ${LIMITS.minPeriod} to ${LIMITS.maxPeriod} seconds.`
      );
    }
  }

  return {
    issuer: issuer.slice(0, LIMITS.maxIssuerLength),
    account: account.slice(0, LIMITS.maxAccountLength),
    secret,
    algorithm,
    digits,
    period
  };
}

/**
 * Builds the pairing URI for an entry.
 *
 * The label keeps the `Issuer:Account` shape every authenticator expects, and
 * the issuer is repeated as a parameter because some readers use only one and
 * some use only the other.
 */
export function buildPairingUri(parameters: PairingParameters): string {
  const label =
    parameters.issuer.trim() === ''
      ? encodeURIComponent(parameters.account)
      : `${encodeURIComponent(parameters.issuer)}:${encodeURIComponent(parameters.account)}`;
  const query = new URLSearchParams();
  query.set('secret', parameters.secret);
  if (parameters.issuer.trim() !== '') query.set('issuer', parameters.issuer);
  query.set('algorithm', parameters.algorithm.replace('-', ''));
  query.set('digits', String(parameters.digits));
  query.set('period', String(parameters.period));
  return `otpauth://totp/${label}?${query.toString()}`;
}

/* ------------------------------------------------------------------ */
/* Entry helpers                                                       */
/* ------------------------------------------------------------------ */

export function newEntryId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function describeEntry(entry: AuthenticatorEntry): string {
  const label = entry.label.trim() || entry.issuer.trim() || entry.account.trim() || entry.id;
  return entry.account.trim() === '' ? label : `${label} (${entry.account})`;
}

/** The haystack every search over the entry list matches against. */
export function searchHaystack(entry: AuthenticatorEntry, groupName: string): string {
  return [
    entry.label,
    entry.issuer,
    entry.account,
    entry.note,
    groupName,
    entry.algorithm,
    `${entry.digits} digits`,
    `${entry.period}s`
  ]
    .filter(Boolean)
    .join(' ');
}

export function validateEntryFields(entry: {
  issuer: string;
  account: string;
  label: string;
  digits: number;
  period: number;
}): string | null {
  if (entry.account.trim() === '' && entry.issuer.trim() === '') {
    return 'An entry needs at least an issuer or an account name, or the list has nothing to show.';
  }
  if (entry.issuer.length > LIMITS.maxIssuerLength) return `The issuer is longer than ${LIMITS.maxIssuerLength} characters.`;
  if (entry.account.length > LIMITS.maxAccountLength) return `The account is longer than ${LIMITS.maxAccountLength} characters.`;
  if (entry.label.length > LIMITS.maxLabelLength) return `The label is longer than ${LIMITS.maxLabelLength} characters.`;
  if (!Number.isInteger(entry.digits) || entry.digits < LIMITS.minDigits || entry.digits > LIMITS.maxDigits) {
    return `Digits must be a whole number from ${LIMITS.minDigits} to ${LIMITS.maxDigits}.`;
  }
  if (!Number.isInteger(entry.period) || entry.period < LIMITS.minPeriod || entry.period > LIMITS.maxPeriod) {
    return `The period must be a whole number of seconds from ${LIMITS.minPeriod} to ${LIMITS.maxPeriod}.`;
  }
  return null;
}

/** Splits a code into halves so long digit runs stay readable. */
export function groupCode(code: string): string {
  if (code.length <= 4) return code;
  const half = Math.ceil(code.length / 2);
  return `${code.slice(0, half)} ${code.slice(half)}`;
}
