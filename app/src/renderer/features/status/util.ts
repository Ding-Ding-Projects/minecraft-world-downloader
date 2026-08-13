import type { AppContext } from '../../core/registry';

/**
 * Small helpers used only by this feature.
 *
 * Deliberately not imported from a sibling feature's directory: each feature
 * owns exactly one directory, and a tiny duplicated helper here is cheaper than
 * a dependency on a file another agent is free to change.
 */

/** The path separator this machine actually uses. */
export function separator(platform: string): string {
  return platform === 'win32' ? '\\' : '/';
}

/** Joins a directory and a file name without importing a Node path module. */
export function joinPath(directory: string, name: string, platform: string): string {
  const sep = separator(platform);
  const trimmed = directory.endsWith(sep) ? directory.slice(0, -sep.length) : directory;
  return `${trimmed}${sep}${name}`;
}

export function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

/** JSON that never throws, whatever a value holds. */
export function safeJson(value: unknown, space?: number): string {
  try {
    return JSON.stringify(value, null, space) ?? '';
  } catch {
    return '[this value could not be serialized]';
  }
}

/**
 * Formats an ISO timestamp for display in the machine's own locale, with the
 * unambiguous ISO form kept alongside it (callers put that in a `title`).
 */
export function formatTimestamp(iso: string): string {
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return iso;
  const date = new Date(parsed);
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

/**
 * "3 minutes ago", honestly. Used everywhere this feature shows how old a
 * record is, so a stale record is never presented as current.
 */
export function ageLabel(iso: string, ctx: AppContext): string {
  const parsed = Date.parse(iso);
  if (!iso || !Number.isFinite(parsed) || parsed <= 0) {
    return ctx.t('status.age.never', 'never refreshed');
  }
  const diffMs = Date.now() - parsed;
  if (diffMs < 0) return ctx.t('status.age.justNow', 'just now');
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 45) return ctx.t('status.age.justNow', 'just now');
  const minutes = Math.floor(seconds / 60);
  if (minutes === 1) return ctx.t('status.age.oneMinute', '1 minute ago');
  if (minutes < 60) return ctx.t('status.age.minutes', '{count} minutes ago', { values: { count: minutes } });
  const hours = Math.floor(minutes / 60);
  if (hours === 1) return ctx.t('status.age.oneHour', '1 hour ago');
  if (hours < 36) return ctx.t('status.age.hours', '{count} hours ago', { values: { count: hours } });
  const days = Math.floor(hours / 24);
  if (days === 1) return ctx.t('status.age.oneDay', '1 day ago');
  return ctx.t('status.age.days', '{count} days ago', { values: { count: days } });
}

/** A stable id for a newly added lane. Never reused, never guessable as a slug. */
export function newLaneId(): string {
  const random = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `status.lane.${random}`;
}

/** A DOM-safe fragment of an id, for building stable element ids from it. */
export function domSafe(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, '-');
}

export function clampText(value: unknown, max: number): string {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

/** A thousands-separated count, in the machine's own locale. */
export function formatCount(value: number): string {
  try {
    return new Intl.NumberFormat().format(value);
  } catch {
    return String(value);
  }
}
