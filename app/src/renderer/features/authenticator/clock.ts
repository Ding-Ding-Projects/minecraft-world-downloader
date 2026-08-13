/**
 * The clock, which is the failure in a time-based authenticator that nobody
 * diagnoses.
 *
 * Codes come from the system clock. When it is wrong, the digits look perfectly
 * ordinary and every service simply refuses them, with no error anywhere that
 * says why. This module makes that state visible instead of leaving the user to
 * guess, and it never silently "fixes" anything: a correction is only ever
 * applied because the user set one, and while one is set every code surface says
 * so in words.
 *
 * There is nothing to compare against offline, so honesty here means being
 * precise about what can and cannot be known:
 *
 *   - A clock that JUMPS while the application is open is detectable, by
 *     comparing wall-clock movement against the monotonic clock. Waking from
 *     sleep looks the same, so that is said too rather than being reported as a
 *     fault.
 *   - A clock that is simply, steadily wrong is NOT detectable without a
 *     reference. The user supplies one — the time on their phone — and the
 *     measured difference is recorded.
 *   - A clock outside any plausible range is wrong whatever else is true.
 *
 * Time zones never enter into it: the standard counts seconds from the same
 * instant everywhere, so a machine set to the wrong zone but the right instant
 * produces correct codes. The surface says that too, because it is the first
 * thing people suspect and almost never the cause.
 */

import type { AppContext } from '../../core/registry';

export const CLOCK_OFFSET_ID = 'authenticator.clock.offsetSeconds';
export const CLOCK_WARN_ID = 'authenticator.clock.warnSeconds';
export const CLOCK_CHECKED_AT_ID = 'authenticator.clock.checkedAt';
export const CLOCK_CHECKED_OFFSET_ID = 'authenticator.clock.checkedOffsetSeconds';

export type ClockSeverity = 'ok' | 'notice' | 'warning';

export interface ClockVerdict {
  severity: ClockSeverity;
  /** The correction the user set, in seconds. Zero means none is applied. */
  offsetSeconds: number;
  /** Difference measured at the last reference check, before any correction. */
  measuredSeconds: number | null;
  checkedAt: string | null;
  /** Wall-clock movement against the monotonic clock, this session. */
  driftSeconds: number;
  /** Threshold beyond which a difference is reported as a problem. */
  warnSeconds: number;
  /** Stable reason ids the surface turns into localized sentences. */
  reasons: ClockReason[];
}

export type ClockReason =
  | 'unchecked'
  | 'offsetApplied'
  | 'measuredLarge'
  | 'drifted'
  | 'implausible'
  | 'checkedRecentlyOk';

/* ------------------------------------------------------------------ */
/* Drift watch                                                         */
/* ------------------------------------------------------------------ */

interface Baseline {
  wall: number;
  monotonic: number;
}

let baseline: Baseline = { wall: Date.now(), monotonic: performance.now() };
let observedDriftMs = 0;
const driftListeners = new Set<(driftSeconds: number) => void>();

/** Milliseconds of divergence before a jump is worth reporting. */
const DRIFT_REPORT_MS = 2000;

let timer: number | null = null;

/**
 * Starts watching for the clock jumping under the application.
 *
 * The check is cheap and runs every few seconds. After a jump is recorded the
 * baseline is reset, so one event is reported once rather than for ever.
 */
export function startClockWatch(): () => void {
  if (timer !== null) return () => undefined;
  baseline = { wall: Date.now(), monotonic: performance.now() };
  timer = window.setInterval(() => {
    const expected = baseline.wall + (performance.now() - baseline.monotonic);
    const difference = Date.now() - expected;
    if (Math.abs(difference) >= DRIFT_REPORT_MS) {
      observedDriftMs = difference;
      baseline = { wall: Date.now(), monotonic: performance.now() };
      for (const listener of [...driftListeners]) listener(observedDriftMs / 1000);
    }
  }, 5000);
  return () => {
    if (timer !== null) window.clearInterval(timer);
    timer = null;
  };
}

export function onDrift(listener: (driftSeconds: number) => void): () => void {
  driftListeners.add(listener);
  return () => {
    driftListeners.delete(listener);
  };
}

/** Forgets a reported jump, once the user has seen and acknowledged it. */
export function clearDrift(): void {
  observedDriftMs = 0;
  baseline = { wall: Date.now(), monotonic: performance.now() };
}

/* ------------------------------------------------------------------ */
/* Correction and verdict                                              */
/* ------------------------------------------------------------------ */

export function offsetSeconds(ctx: AppContext): number {
  const raw = ctx.settings.get<number>(CLOCK_OFFSET_ID, 0);
  return Number.isFinite(raw) ? Math.trunc(raw) : 0;
}

/** The instant codes are computed for: the system clock plus any correction. */
export function correctedNow(ctx: AppContext): number {
  return Date.now() + offsetSeconds(ctx) * 1000;
}

/**
 * Records a reference reading.
 *
 * `referenceMs` is the time the user read off a device they trust. The measured
 * difference is stored as evidence, and the correction is only changed when the
 * user asks for it to be — a measurement and a decision are different things.
 */
export function recordReferenceCheck(ctx: AppContext, referenceMs: number): number {
  const measured = Math.round((referenceMs - Date.now()) / 1000);
  ctx.settings.set(CLOCK_CHECKED_OFFSET_ID, measured);
  ctx.settings.set(CLOCK_CHECKED_AT_ID, new Date().toISOString());
  return measured;
}

export function applyCorrection(ctx: AppContext, seconds: number): void {
  ctx.settings.set(CLOCK_OFFSET_ID, Math.trunc(seconds));
}

export function verdict(ctx: AppContext): ClockVerdict {
  const warnSeconds = Math.max(1, ctx.settings.get<number>(CLOCK_WARN_ID, 10));
  const offset = offsetSeconds(ctx);
  const checkedAt = ctx.settings.get<string>(CLOCK_CHECKED_AT_ID, '') || null;
  const measuredRaw = ctx.settings.get<number>(CLOCK_CHECKED_OFFSET_ID, Number.NaN);
  const measured = Number.isFinite(measuredRaw) ? measuredRaw : null;
  const drift = observedDriftMs / 1000;

  const reasons: ClockReason[] = [];
  let severity: ClockSeverity = 'ok';

  const year = new Date().getFullYear();
  if (year < 2024 || year > 2100) {
    reasons.push('implausible');
    severity = 'warning';
  }

  if (Math.abs(drift) >= DRIFT_REPORT_MS / 1000) {
    reasons.push('drifted');
    if (severity !== 'warning') severity = 'warning';
  }

  if (measured === null) {
    reasons.push('unchecked');
    if (severity === 'ok') severity = 'notice';
  } else {
    // What matters is the difference that REMAINS after the correction: a clock
    // forty seconds slow with a forty second correction applied is producing
    // correct codes, and reporting that as a fault would be false.
    const residual = measured - offset;
    if (Math.abs(residual) >= warnSeconds) {
      reasons.push('measuredLarge');
      severity = 'warning';
    } else {
      reasons.push('checkedRecentlyOk');
    }
  }

  if (offset !== 0) {
    reasons.push('offsetApplied');
    if (severity === 'ok') severity = 'notice';
  }

  return {
    severity,
    offsetSeconds: offset,
    measuredSeconds: measured,
    checkedAt,
    driftSeconds: drift,
    warnSeconds,
    reasons
  };
}

/** Parses a typed reference time. Accepts a full ISO stamp or `HH:MM:SS`. */
export function parseReferenceTime(input: string): { value: number | null; error: string | null } {
  const trimmed = input.trim();
  if (trimmed === '') return { value: null, error: 'Type the time your other device is showing.' };

  const clock = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(trimmed);
  if (clock) {
    const hours = Number(clock[1]);
    const minutes = Number(clock[2]);
    const seconds = clock[3] ? Number(clock[3]) : 0;
    if (hours > 23 || minutes > 59 || seconds > 59) {
      return { value: null, error: 'That is not a time of day. Use 24 hour clock, for example 14:05:30.' };
    }
    const now = new Date();
    const candidate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, seconds, 0);
    // A reading near midnight can belong to the neighbouring day; the closest
    // of yesterday, today and tomorrow is the one meant.
    const options = [candidate.getTime() - 86_400_000, candidate.getTime(), candidate.getTime() + 86_400_000];
    const closest = options.reduce((best, option) =>
      Math.abs(option - now.getTime()) < Math.abs(best - now.getTime()) ? option : best
    );
    return { value: closest, error: null };
  }

  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) {
    return { value: null, error: 'That is not a time this application could read. Try 14:05:30, or a full date and time.' };
  }
  return { value: parsed, error: null };
}
