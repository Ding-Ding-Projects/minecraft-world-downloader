/**
 * When a rule matches, and which rule wins when several do.
 *
 * Everything here is pure and works on the machine's configured local timezone,
 * because that is the only clock a person reading "22:00" is thinking about.
 * There is no hidden UTC conversion: a window is compared against local
 * wall-clock fields, which is what gives the daylight-saving behaviour described
 * in `describeTimezone` — and that behaviour is stated in the interface rather
 * than left for somebody to discover in March.
 */

import { toMinutes } from './schema';
import type { ScheduleRule } from './schema';

/* ------------------------------------------------------------------ */
/* Timezone and daylight saving                                        */
/* ------------------------------------------------------------------ */

export interface TimezoneFacts {
  /** The IANA zone name the machine reports, e.g. `Europe/London`. */
  zone: string;
  /** The current offset, formatted `UTC+01:00`. */
  offsetLabel: string;
  /** Minutes east of UTC, right now. */
  offsetMinutes: number;
  /** True when this zone uses two different offsets across the year. */
  observesDaylightSaving: boolean;
}

function formatOffset(minutesEastOfUtc: number): string {
  const sign = minutesEastOfUtc < 0 ? '-' : '+';
  const total = Math.abs(minutesEastOfUtc);
  const hours = String(Math.floor(total / 60)).padStart(2, '0');
  const minutes = String(total % 60).padStart(2, '0');
  return `UTC${sign}${hours}:${minutes}`;
}

/**
 * The zone facts, read from the platform rather than assumed.
 *
 * Daylight saving is detected by comparing the January and July offsets, which
 * is the standard trick and is correct for both hemispheres: a zone that never
 * shifts reports the same offset in both months.
 */
export function describeTimezone(now: Date = new Date()): TimezoneFacts {
  let zone = '';
  try {
    zone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch {
    zone = '';
  }
  // getTimezoneOffset is minutes *behind* UTC, so it is negated here.
  const offsetMinutes = -now.getTimezoneOffset();
  const january = -new Date(now.getFullYear(), 0, 1).getTimezoneOffset();
  const july = -new Date(now.getFullYear(), 6, 1).getTimezoneOffset();
  return {
    zone: zone === '' ? formatOffset(offsetMinutes) : zone,
    offsetLabel: formatOffset(offsetMinutes),
    offsetMinutes,
    observesDaylightSaving: january !== july
  };
}

/* ------------------------------------------------------------------ */
/* Window shape                                                        */
/* ------------------------------------------------------------------ */

export type WindowShape = 'whole-day' | 'same-day' | 'crosses-midnight';

/**
 * How a rule's two times are read.
 *
 * `whole-day` is the deliberate meaning of an equal start and end: the rule holds
 * for the entire selected day rather than for zero minutes. A zero-length window
 * would be a rule that can never fire, which nobody sets on purpose.
 */
export function windowShape(rule: Pick<ScheduleRule, 'startTime' | 'endTime'>): WindowShape {
  const start = toMinutes(rule.startTime);
  const end = toMinutes(rule.endTime);
  if (start === end) return 'whole-day';
  return start < end ? 'same-day' : 'crosses-midnight';
}

function isoDateOf(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dayAllowed(rule: ScheduleRule, day: Date): boolean {
  if (rule.everyDay) return true;
  return rule.weekdays.includes(day.getDay());
}

function withinDates(rule: ScheduleRule, day: Date): boolean {
  const iso = isoDateOf(day);
  if (rule.startDate && iso < rule.startDate) return false;
  if (rule.endDate && iso > rule.endDate) return false;
  return true;
}

/**
 * Whether the rule's time window contains this instant.
 *
 * The window is half-open — `[start, end)` — so a rule ending at 09:00 and one
 * starting at 09:00 never both hold at 09:00, and a day's worth of adjacent rules
 * tiles exactly with no gap and no overlap.
 *
 * A window that crosses midnight belongs to the day it *started* on: the weekday
 * selection and the date bounds are checked against that starting day, so
 * "Fridays, 22:00 to 02:00" runs into Saturday morning rather than needing
 * Saturday to be selected as well.
 *
 * On a daylight-saving change this compares wall-clock fields, which means a time
 * the local clock skips in spring never matches, and a time the local clock
 * repeats in autumn matches on both passes. That is the same thing an alarm clock
 * on the wall does.
 */
export function matchesAt(rule: ScheduleRule, now: Date): boolean {
  const start = toMinutes(rule.startTime);
  const end = toMinutes(rule.endTime);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  if (start === end) {
    return dayAllowed(rule, now) && withinDates(rule, now);
  }

  if (start < end) {
    if (nowMinutes < start || nowMinutes >= end) return false;
    return dayAllowed(rule, now) && withinDates(rule, now);
  }

  if (nowMinutes >= start) {
    return dayAllowed(rule, now) && withinDates(rule, now);
  }
  if (nowMinutes < end) {
    const startedOn = new Date(now.getTime());
    startedOn.setDate(startedOn.getDate() - 1);
    return dayAllowed(rule, startedOn) && withinDates(rule, startedOn);
  }
  return false;
}

/* ------------------------------------------------------------------ */
/* Precedence                                                          */
/* ------------------------------------------------------------------ */

/**
 * Sorts the rules into the order they are painted in.
 *
 * Later paints over earlier, so the winner of any contested setting is the last
 * rule in this order that assigns it. The order is: ascending priority, then the
 * rule's position in the document. In plain words — a higher priority wins, and
 * between equal priorities the rule further down the list wins. Both halves are
 * visible in the interface, so the answer to "which one is winning" is always
 * readable off the screen rather than inferred.
 *
 * A rule that assigns settings nobody else claims still contributes them, whatever
 * its priority: precedence is decided per setting, not per rule.
 */
export function paintOrder(rules: ScheduleRule[]): ScheduleRule[] {
  return rules
    .map((rule, index) => ({ rule, index }))
    .sort((a, b) => a.rule.priority - b.rule.priority || a.index - b.index)
    .map((entry) => entry.rule);
}

export interface ResolvedAssignment {
  settingId: string;
  value: unknown;
  /** The rule that won this setting. */
  ruleId: string;
  ruleLabel: string;
  /** Rules that also assigned this setting and were painted over. */
  overriddenBy: Array<{ ruleId: string; ruleLabel: string }>;
}

export interface ResolveInput {
  rule: ScheduleRule;
  /** False when the rule's external gate said no, or its source has no answer. */
  gateOpen: boolean;
  /** The values this rule contributes: its own assignments, or an API's. */
  assignments: Array<{ settingId: string; value: unknown }>;
}

/**
 * Resolves the whole schedule into the exact set of settings to override.
 *
 * The result is a decision, not an action: nothing is written here. That
 * separation is what lets the interface show what *would* change before it
 * changes, and lets the engine diff two decisions to work out what to release.
 */
export function resolve(inputs: ResolveInput[], now: Date): Map<string, ResolvedAssignment> {
  const winners = new Map<string, ResolvedAssignment>();
  const ordered = paintOrder(inputs.map((input) => input.rule));
  const byId = new Map(inputs.map((input) => [input.rule.id, input]));

  for (const rule of ordered) {
    const input = byId.get(rule.id);
    if (!input) continue;
    if (!rule.enabled) continue;
    if (!input.gateOpen) continue;
    if (!matchesAt(rule, now)) continue;
    for (const assignment of input.assignments) {
      const previous = winners.get(assignment.settingId);
      winners.set(assignment.settingId, {
        settingId: assignment.settingId,
        value: assignment.value,
        ruleId: rule.id,
        ruleLabel: rule.label,
        overriddenBy: previous
          ? [...previous.overriddenBy, { ruleId: previous.ruleId, ruleLabel: previous.ruleLabel }]
          : []
      });
    }
  }
  return winners;
}

/* ------------------------------------------------------------------ */
/* Human-readable window summary                                       */
/* ------------------------------------------------------------------ */

const WEEKDAY_ORDER = [0, 1, 2, 3, 4, 5, 6];

/** Localized weekday names from the platform, long and short. */
export function weekdayNames(): Array<{ index: number; long: string; short: string }> {
  // 2024-01-07 was a Sunday, so adding the index lands on each weekday in turn.
  return WEEKDAY_ORDER.map((index) => {
    const probe = new Date(2024, 0, 7 + index);
    let long = String(index);
    let short = String(index);
    try {
      long = new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(probe);
      short = new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(probe);
    } catch {
      /* a platform without Intl still gets a usable, if terse, label */
    }
    return { index, long, short };
  });
}

/**
 * A factual one-line summary of when a rule holds.
 *
 * Deliberately not styled by the humour level: this is the sentence a user checks
 * a rule against, so it stays exact at every setting.
 */
export function describeWindow(rule: ScheduleRule): string {
  const names = weekdayNames();
  const days = rule.everyDay
    ? 'Every day'
    : rule.weekdays.length === 0
      ? 'No day selected'
      : rule.weekdays
          .slice()
          .sort()
          .map((day) => names[day]?.short ?? String(day))
          .join(', ');

  const shape = windowShape(rule);
  const time =
    shape === 'whole-day'
      ? `all day (start and end are both ${rule.startTime})`
      : shape === 'crosses-midnight'
        ? `${rule.startTime} until ${rule.endTime} the next morning`
        : `${rule.startTime} until ${rule.endTime}`;

  const dates =
    rule.startDate && rule.endDate
      ? `, between ${rule.startDate} and ${rule.endDate}`
      : rule.startDate
        ? `, from ${rule.startDate}`
        : rule.endDate
          ? `, until ${rule.endDate}`
          : '';

  return `${days}, ${time}${dates}`;
}

/**
 * The next instant at which this rule's match state could change.
 *
 * Used only to tell the user when something is due; the engine still ticks on its
 * own interval rather than trusting one computed timestamp, so a machine that
 * slept through the moment still catches up on the next tick.
 */
export function nextBoundary(rule: ScheduleRule, now: Date): Date | null {
  const shape = windowShape(rule);
  if (shape === 'whole-day') return null;
  const candidates = [toMinutes(rule.startTime), toMinutes(rule.endTime)];
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const upcoming = candidates.filter((minutes) => minutes > nowMinutes).sort((a, b) => a - b);
  const target = new Date(now.getTime());
  target.setSeconds(0, 0);
  if (upcoming.length > 0) {
    target.setHours(Math.floor(upcoming[0] / 60), upcoming[0] % 60);
    return target;
  }
  const earliest = Math.min(...candidates);
  target.setDate(target.getDate() + 1);
  target.setHours(Math.floor(earliest / 60), earliest % 60);
  return target;
}
