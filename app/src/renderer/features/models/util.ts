/**
 * Small shared helpers for the local model suite manager.
 *
 * Nothing here talks to the network or to the operating system. These are the
 * formatting and parsing routines that every panel needs, kept in one place so
 * two surfaces can never disagree about how many bytes a gibibyte is or how a
 * refusal reason is worded.
 */

/** Formats a byte count for display. Returns an em dash for an unknown value. */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) return '—';
  if (bytes < 0) return '—';
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const units = ['KiB', 'MiB', 'GiB', 'TiB'];
  let value = bytes / 1024;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  const decimals = value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(decimals)} ${units[index]}`;
}

/** Formats a whole number with thousands separators, or an em dash. */
export function formatCount(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return Math.round(value).toLocaleString();
}

/** Formats a duration in milliseconds as a compact, readable string. */
export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms) || ms < 0) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)} s`;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds - minutes * 60);
  return `${minutes} min ${rest} s`;
}

/** Formats an ISO timestamp for display, or an em dash when it is absent. */
export function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

/** How long ago an ISO timestamp was, in plain words. */
export function formatAge(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return 'never';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'never';
  const delta = Math.max(0, now - then);
  const minutes = Math.floor(delta / 60_000);
  if (minutes < 1) return 'less than a minute ago';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

/** Milliseconds since an ISO timestamp, or `Infinity` when it never happened. */
export function ageMs(iso: string | null | undefined, now = Date.now()): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return Number.POSITIVE_INFINITY;
  return Math.max(0, now - then);
}

/** Clamps a number into a range, falling back when it is not a number at all. */
export function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
}

/** Turns an unknown thrown value into a message without inventing detail. */
export function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string' && error.trim() !== '') return error;
  return 'The operation failed and reported no reason.';
}

/** Parses JSON without throwing. Returns `null` when the text is not JSON. */
export function parseJson<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/**
 * Splits an NDJSON body into its parsed objects.
 *
 * A truncated final line is dropped rather than guessed at, so a body that was
 * cut off at the byte ceiling yields the records that did arrive intact and
 * nothing that was invented to fill the gap.
 */
export function parseNdjson<T>(body: string): T[] {
  const out: T[] = [];
  for (const line of body.split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '') continue;
    const parsed = parseJson<T>(trimmed);
    if (parsed !== null) out.push(parsed);
  }
  return out;
}

/** ISO-8601 timestamp for right now. */
export function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Splits a model reference into its repository and tag halves.
 *
 * `llama3.2:3b` becomes `{ repository: 'llama3.2', tag: '3b' }`; a reference
 * with no colon takes the registry's own default tag, which is `latest`. A
 * namespaced reference such as `library/llama3.2:3b` keeps its namespace in the
 * repository half, because that is what the registry addresses.
 */
export function splitReference(reference: string): { repository: string; tag: string } {
  const text = reference.trim();
  const slash = text.lastIndexOf('/');
  const colon = text.lastIndexOf(':');
  if (colon > slash) {
    return { repository: text.slice(0, colon), tag: text.slice(colon + 1) };
  }
  return { repository: text, tag: 'latest' };
}

/** Joins a repository and tag back into a reference. */
export function joinReference(repository: string, tag: string): string {
  return `${repository}:${tag}`;
}

/**
 * Strips the `library/` namespace the public registry uses for its own models,
 * because that is the form the local runtime prints and the form a person types.
 */
export function displayRepository(repository: string): string {
  return repository.startsWith('library/') ? repository.slice('library/'.length) : repository;
}

/** Adds the `library/` namespace when a reference has none, for registry calls. */
export function registryRepository(repository: string): string {
  return repository.includes('/') ? repository : `library/${repository}`;
}

/**
 * A conservative parse of a parameter-size string such as `8.0B` or `70B`.
 *
 * Returns `null` for anything it does not recognise. It never falls back to a
 * guess drawn from the model's name: a size the metadata did not state is
 * unknown, and unknown is a real answer here.
 */
export function parseParameterCount(text: string | null | undefined): number | null {
  if (!text) return null;
  const match = /^\s*([0-9]+(?:\.[0-9]+)?)\s*([KMBT])\s*$/i.exec(text);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return null;
  const scale: Record<string, number> = { k: 1e3, m: 1e6, b: 1e9, t: 1e12 };
  return value * (scale[match[2].toLowerCase()] ?? 1);
}

/**
 * Bits per weight implied by a quantization label such as `Q4_K_M` or `F16`.
 *
 * Returns `null` when the label is absent or unrecognised, which keeps a fit
 * verdict at Unknown rather than silently treating a missing value as zero.
 */
export function quantizationBits(label: string | null | undefined): number | null {
  if (!label) return null;
  const text = label.trim().toUpperCase();
  const float = /^(?:F|BF)(16|32)$/.exec(text);
  if (float) return Number(float[1]);
  const quant = /^Q(\d+)(?:_.*)?$/.exec(text);
  if (quant) {
    const bits = Number(quant[1]);
    return Number.isFinite(bits) && bits > 0 && bits <= 32 ? bits : null;
  }
  if (text === 'IQ1_S' || text === 'IQ1_M') return 1;
  const iq = /^IQ(\d+)(?:_.*)?$/.exec(text);
  if (iq) {
    const bits = Number(iq[1]);
    return Number.isFinite(bits) && bits > 0 && bits <= 32 ? bits : null;
  }
  return null;
}

/** A stable, DOM-safe id fragment built from an arbitrary reference. */
export function slug(text: string): string {
  return text.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'item';
}

/** Deduplicates while preserving order. */
export function unique<T>(values: T[]): T[] {
  const seen = new Set<T>();
  const out: T[] = [];
  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

/**
 * Validates a runtime base URL.
 *
 * Plain http is only reachable for a loopback host, because that is exactly the
 * rule the privileged network boundary enforces; refusing it here means the user
 * is told why while they are typing rather than when a request is refused.
 */
export function validateBaseUrl(value: string): string | null {
  const text = String(value ?? '').trim();
  if (text === '') return 'Enter the runtime address, for example http://127.0.0.1:11434. Nothing was changed.';
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return `"${text}" is not a valid URL. Use a full address such as http://127.0.0.1:11434. Nothing was changed.`;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return `Only http and https are supported; "${url.protocol.replace(':', '')}" was refused. Nothing was changed.`;
  }
  if (url.username || url.password) {
    return 'A URL carrying an embedded username or password is refused. Put the credential in the operating system vault instead. Nothing was changed.';
  }
  if (url.protocol === 'http:' && !isLoopbackHost(url.hostname)) {
    return `Plain http is only permitted for a loopback address; "${url.hostname}" was refused. Use https, or point this at 127.0.0.1. Nothing was changed.`;
  }
  return null;
}

/** True for the hostnames the privileged boundary treats as loopback. */
export function isLoopbackHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host === '[::1]' ||
    /^127\.\d+\.\d+\.\d+$/.test(host)
  );
}

/** Normalises a base URL to have no trailing slash. */
export function normalizeBaseUrl(value: string): string {
  return String(value ?? '').trim().replace(/\/+$/, '');
}
