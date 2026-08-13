/**
 * Number and time formatting for the download surfaces.
 *
 * These produce the *facts* a reader checks a transfer against — how many bytes
 * have landed, how fast, how long is left — so none of them ever rounds a
 * number into a friendlier lie. An unknown total is reported as unknown rather
 * than guessed at, and a rate nobody has measured yet is reported as zero
 * rather than as a plausible-looking placeholder.
 */

const BYTE_UNITS = ['B', 'kB', 'MB', 'GB', 'TB', 'PB'] as const;

/** A byte count in the largest unit that keeps it readable, plus the exact value. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  if (bytes < 1000) return `${Math.round(bytes)} B`;
  let value = bytes;
  let unit = 0;
  while (value >= 1000 && unit < BYTE_UNITS.length - 1) {
    value /= 1000;
    unit += 1;
  }
  const decimals = value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(decimals)} ${BYTE_UNITS[unit]}`;
}

/** The exact integer byte count, grouped, for the detail line. */
export function formatExactBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0';
  return Math.round(bytes).toLocaleString();
}

export function formatRate(bytesPerSecond: number): string {
  if (!Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) return '0 B/s';
  return `${formatBytes(bytesPerSecond)}/s`;
}

/** A duration in whole units. Returns an empty string when there is no estimate. */
export function formatDuration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return '';
  const whole = Math.round(seconds);
  if (whole < 60) return `${whole}s`;
  const minutes = Math.floor(whole / 60);
  const restSeconds = whole % 60;
  if (minutes < 60) return `${minutes}m ${restSeconds}s`;
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  if (hours < 24) return `${hours}h ${restMinutes}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

/**
 * Completion as a fraction, or null when the server never declared a total.
 *
 * Null is the honest answer there: a progress bar that invents a percentage
 * from a size nobody knows is worse than an indeterminate one, because it looks
 * like information.
 */
export function fraction(received: number, total: number | null): number | null {
  if (total === null || !Number.isFinite(total) || total <= 0) return null;
  return Math.max(0, Math.min(1, received / total));
}

export function formatPercent(value: number | null): string {
  if (value === null) return '';
  return `${Math.floor(value * 100)}%`;
}

/** An ISO timestamp rendered in the user's own locale, or an empty string. */
export function formatTimestamp(iso: string | null): string {
  if (!iso) return '';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleString();
}

/** The elapsed wall time between two ISO timestamps, in whole seconds. */
export function elapsedSeconds(startIso: string | null, endIso: string | null): number | null {
  if (!startIso) return null;
  const start = new Date(startIso).getTime();
  const end = endIso ? new Date(endIso).getTime() : Date.now();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
  return (end - start) / 1000;
}

/** Shortens a URL for a single-line label without hiding which host it is. */
export function shortenUrl(url: string, limit = 72): string {
  if (url.length <= limit) return url;
  try {
    const parsed = new URL(url);
    const head = `${parsed.protocol}//${parsed.host}`;
    const tail = parsed.pathname.split('/').filter(Boolean).pop() ?? '';
    const candidate = tail ? `${head}/…/${tail}` : `${head}/…`;
    return candidate.length <= limit ? candidate : `${candidate.slice(0, limit - 1)}…`;
  } catch {
    return `${url.slice(0, limit - 1)}…`;
  }
}
