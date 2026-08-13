import type { AppContext, LockRecord } from '../../core/registry';

/**
 * What a lock target actually points at, and how it is written down.
 *
 * A lock is stored against one opaque string. That string comes from four
 * different places — a tab id, a setting id, a CSS selector produced by the
 * element menu, and this feature's own appearance-value form — so the manager
 * has to be able to tell them apart before it can say anything truthful about
 * what a lock covers or who enforces it.
 *
 * Nothing here reads or writes a credential. Credentials live in the operating
 * system credential vault under the lock service's own account key and never
 * pass through this file, an export, a history entry or a log line.
 */

/** The settings key the lock service persists its records under. */
export const LOCK_RECORDS_KEY = 'locks.records';

/** Prefix of an appearance-value target, e.g. `appearance:.md-btn|color`. */
export const APPEARANCE_PREFIX = 'appearance:';

export type LockTargetKind = 'tab' | 'setting' | 'element' | 'appearance' | 'unknown';

export interface AppearanceTarget {
  selector: string;
  property: string;
}

/** Builds the appearance-value target string. */
export function appearanceTarget(selector: string, property: string): string {
  return `${APPEARANCE_PREFIX}${selector}|${property}`;
}

/** Reads an appearance-value target back, or null when it is not one. */
export function parseAppearanceTarget(target: string): AppearanceTarget | null {
  if (!target.startsWith(APPEARANCE_PREFIX)) return null;
  const rest = target.slice(APPEARANCE_PREFIX.length);
  const separator = rest.lastIndexOf('|');
  if (separator <= 0 || separator === rest.length - 1) return null;
  return { selector: rest.slice(0, separator), property: rest.slice(separator + 1) };
}

/**
 * True when a target string is a CSS selector the element guard can act on.
 *
 * The element menu produces `[data-appearance-id="…"]`, `#an-id`, `.md-btn` or a
 * bare tag name. A tab id such as `core.settings` is none of those, and treating
 * it as a selector would produce a guard that silently matches nothing.
 */
export function isSelectorLike(target: string): boolean {
  if (target.startsWith(APPEARANCE_PREFIX)) return false;
  if (target.startsWith('[') || target.startsWith('#') || target.startsWith('.')) return true;
  return /^[a-z][a-z0-9-]*$/.test(target) && !target.includes('.');
}

/** Classifies a target so the manager can name who enforces it. */
export function classify(target: string, ctx: AppContext): LockTargetKind {
  if (target.startsWith(APPEARANCE_PREFIX)) return 'appearance';
  if (ctx.registry.tab(target)) return 'tab';
  if (ctx.registry.settingControl(target)) return 'setting';
  if (isSelectorLike(target)) return 'element';
  return 'unknown';
}

/**
 * Every CSS selector one target should be guarded through.
 *
 * A settings lock is stored against the setting's own id, and the settings
 * surface renders that setting as a row carrying both an element id and an
 * appearance id — so the guard has to know both, or a lock on a setting stops a
 * palette row and leaves the settings surface wide open.
 */
export function guardSelectors(target: string, kind: LockTargetKind): string[] {
  if (kind === 'element') return [target];
  if (kind === 'setting') {
    return [
      `#setting-${cssEscape(target)}`,
      `[data-appearance-id="setting-row:${target}"]`,
      `[data-setting-id="${target}"]`
    ];
  }
  return [];
}

/** `CSS.escape` with a plain fallback, so a selector is never built unescaped. */
export function cssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(value);
  return value.replace(/[^\w-]/g, (character) => `\\${character}`);
}

/** Who actually refuses the interaction, in one honest phrase. */
export function enforcementKey(kind: LockTargetKind): string {
  switch (kind) {
    case 'tab':
      return 'locks.enforced.tab';
    case 'setting':
      return 'locks.enforced.setting';
    case 'element':
      return 'locks.enforced.element';
    case 'appearance':
      return 'locks.enforced.appearance';
    default:
      return 'locks.enforced.unknown';
  }
}

/** A short human description of what one record covers. */
export function describeTarget(record: LockRecord, ctx: AppContext): string {
  const appearance = parseAppearanceTarget(record.target);
  if (appearance) {
    return ctx.t('locks.target.appearance', 'The {property} of {selector}', {
      values: { property: appearance.property, selector: appearance.selector }
    });
  }
  const kind = classify(record.target, ctx);
  if (kind === 'tab') {
    const tab = ctx.registry.tab(record.target);
    return ctx.t('locks.target.tab', 'The {name} tab', {
      values: { name: tab ? ctx.t(tab.title, tab.title) : record.target }
    });
  }
  if (kind === 'setting') {
    const control = ctx.registry.settingControl(record.target);
    return ctx.t('locks.target.setting', 'The setting {name}', {
      values: { name: control ? ctx.t(control.label, control.label) : record.target }
    });
  }
  if (kind === 'element') {
    return ctx.t('locks.target.element', 'Every element matching {selector}', {
      values: { selector: record.target }
    });
  }
  return record.target;
}

/** The unlock duration, in words, exactly as it was stored. */
export function describeDuration(minutes: number, ctx: AppContext): string {
  if (minutes === -1) return ctx.t('core.lock.duration.session', 'Until the application closes');
  if (minutes === 0) return ctx.t('core.lock.duration.surface', 'This surface only');
  return ctx.t('core.lock.duration.minutes', '{count} minutes', { values: { count: minutes } });
}

/** The credential method, in words. Never anything about the credential itself. */
export function describeMethod(record: LockRecord, ctx: AppContext): string {
  return record.method === 'password'
    ? ctx.t('core.lock.method.password', 'A password')
    : ctx.t('core.lock.method.totp', 'A one-time code from your authenticator');
}

/**
 * One record flattened for search and export.
 *
 * The credential is not here, and neither is anything that could stand in for
 * it: no hash, no length, no hint, no vault account key.
 */
export function recordToRow(record: LockRecord, ctx: AppContext): Record<string, unknown> {
  return {
    target: record.target,
    label: record.label,
    describes: describeTarget(record, ctx),
    kind: classify(record.target, ctx),
    method: record.method,
    unlockMinutes: record.unlockMinutes,
    unlockDuration: describeDuration(record.unlockMinutes, ctx),
    createdAt: record.createdAt,
    currentlyUnlocked: ctx.locks.isUnlocked(record.target),
    credential: 'omitted — credentials never leave the operating system credential vault'
  };
}

/** Text a search query is run against for one record. */
export function searchHaystack(record: LockRecord, ctx: AppContext): string {
  return [
    record.target,
    record.label,
    describeTarget(record, ctx),
    describeMethod(record, ctx),
    describeDuration(record.unlockMinutes, ctx),
    classify(record.target, ctx),
    record.createdAt,
    ctx.locks.isUnlocked(record.target) ? 'unlocked' : 'locked'
  ].join(' ');
}

/**
 * A dialog title, with the one decorative emoji when the switch allows it.
 *
 * Emoji decorate a dialog or a message box and nothing else: never a button,
 * never a field label, never an accessible name. The study mode removes it
 * along with everything else it removes.
 */
export function dialogTitle(ctx: AppContext, key: string, fallback: string, values?: Record<string, string | number>): string {
  const text = ctx.t(key, fallback, { values });
  const snapshot = ctx.i18n.snapshot();
  if (!snapshot.emojiInDialogs || snapshot.schoolMode) return text;
  return `🔒 ${text}`;
}
