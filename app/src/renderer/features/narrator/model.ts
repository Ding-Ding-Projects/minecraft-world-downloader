/**
 * The narrator's stable identifiers and its event-category model.
 *
 * Setting ids are stable and dotted, and they are never renamed: a renamed id
 * silently loses the value a user already chose, which for a voice choice reads
 * as "the application forgot my voice" with nothing in the interface to explain
 * it.
 */

/** The two tracks the narrator can speak. `both` speaks English then Cantonese. */
export type NarratedLanguage = 'en' | 'yue';

/** What the language setting can hold. */
export type NarrationMode = 'en' | 'yue' | 'both';

/* ------------------------------------------------------------------ */
/* Setting ids                                                         */
/* ------------------------------------------------------------------ */

export const NARRATOR_ENABLED_ID = 'narrator.enabled';
export const NARRATOR_MODE_ID = 'narrator.language';
export const NARRATOR_VOLUME_ID = 'narrator.volume';
export const NARRATOR_DEBOUNCE_ID = 'narrator.debounceMs';
export const NARRATOR_SCREEN_READER_ID = 'narrator.screenReader';
export const NARRATOR_DUCK_VOLUME_ID = 'narrator.duckVolume';
export const NARRATOR_DUCK_WINDOW_ID = 'narrator.duckWindowMs';
export const NARRATOR_QUIET_ENABLED_ID = 'narrator.quiet.enabled';
export const NARRATOR_QUIET_FROM_ID = 'narrator.quiet.from';
export const NARRATOR_QUIET_TO_ID = 'narrator.quiet.to';
export const NARRATOR_LOG_LIMIT_ID = 'narrator.log.limit';

/** The stored voice identity for one track. Empty means "choose automatically". */
export function voiceSettingId(language: NarratedLanguage): string {
  return `narrator.voice.${language}`;
}

export function rateSettingId(language: NarratedLanguage): string {
  return `narrator.rate.${language}`;
}

export function pitchSettingId(language: NarratedLanguage): string {
  return `narrator.pitch.${language}`;
}

export function categoryEnabledId(category: string): string {
  return `narrator.category.${category}.enabled`;
}

export function categoryCooldownId(category: string): string {
  return `narrator.category.${category}.cooldownMs`;
}

/* ------------------------------------------------------------------ */
/* Platform ranges                                                     */
/* ------------------------------------------------------------------ */

/**
 * The documented ranges of the platform speech API, used exactly as documented
 * rather than narrowed to a range that felt safer.
 *
 * `rate` is 0.1 to 10 and `pitch` is 0 to 2 in the Web Speech specification,
 * and both default to 1, which is the voice's own normal delivery. Nothing here
 * ships a value other than 1, so a voice always starts by sounding the way its
 * author intended.
 */
export const SPEECH_RANGES = {
  rate: { min: 0.1, max: 10, step: 0.1, default: 1 },
  pitch: { min: 0, max: 2, step: 0.1, default: 1 },
  volume: { min: 0, max: 1, step: 0.05, default: 1 }
} as const;

/* ------------------------------------------------------------------ */
/* Categories                                                          */
/* ------------------------------------------------------------------ */

export type CategoryId =
  | 'lifecycle'
  | 'notice'
  | 'success'
  | 'warning'
  | 'error'
  | 'progress'
  | 'navigation'
  | 'settings';

export interface CategoryDefinition {
  id: CategoryId;
  /** i18n key for the visible name. */
  label: string;
  /** i18n key for the progressive-disclosure explanation. */
  description: string;
  /** i18n key for the sentence frame spoken for this category. */
  frame: string;
  /** English fallback for that frame, used before a catalogue entry exists. */
  frameFallback: string;
  /** Shipped default for whether this category is spoken at all. */
  enabledByDefault: boolean;
  /**
   * Shipped default for the minimum gap between two lines of this category.
   *
   * Zero means the category is never held back. Only `error` ships that way:
   * a spoken failure that a rate limit swallowed is a failure the listener
   * never hears about.
   */
  cooldownMs: number;
  /**
   * True when the category jumps the queue and ignores both the debounce and
   * the cooldown. Only the error category is written this way.
   */
  neverSuppressed: boolean;
  icon: string;
}

export const CATEGORIES: CategoryDefinition[] = [
  {
    id: 'error',
    label: 'narrator.category.error',
    description: 'narrator.category.error.description',
    frame: 'narrator.frame.error',
    frameFallback: 'Something failed. {title}. {body}',
    enabledByDefault: true,
    cooldownMs: 0,
    neverSuppressed: true,
    icon: 'error'
  },
  {
    id: 'warning',
    label: 'narrator.category.warning',
    description: 'narrator.category.warning.description',
    frame: 'narrator.frame.warning',
    frameFallback: 'A warning. {title}. {body}',
    enabledByDefault: true,
    cooldownMs: 8000,
    neverSuppressed: false,
    icon: 'warning'
  },
  {
    id: 'success',
    label: 'narrator.category.success',
    description: 'narrator.category.success.description',
    frame: 'narrator.frame.success',
    frameFallback: 'Finished. {title}. {body}',
    enabledByDefault: true,
    cooldownMs: 8000,
    neverSuppressed: false,
    icon: 'success'
  },
  {
    id: 'notice',
    label: 'narrator.category.notice',
    description: 'narrator.category.notice.description',
    frame: 'narrator.frame.notice',
    frameFallback: '{title}. {body}',
    enabledByDefault: false,
    cooldownMs: 12000,
    neverSuppressed: false,
    icon: 'info'
  },
  {
    id: 'progress',
    label: 'narrator.category.progress',
    description: 'narrator.category.progress.description',
    frame: 'narrator.frame.progress',
    frameFallback: '{title}, {body}.',
    enabledByDefault: false,
    cooldownMs: 20000,
    neverSuppressed: false,
    icon: 'refresh'
  },
  {
    id: 'lifecycle',
    label: 'narrator.category.lifecycle',
    description: 'narrator.category.lifecycle.description',
    frame: 'narrator.frame.lifecycle',
    frameFallback: '{title}.',
    enabledByDefault: true,
    cooldownMs: 60000,
    neverSuppressed: false,
    icon: 'bolt'
  },
  {
    id: 'navigation',
    label: 'narrator.category.navigation',
    description: 'narrator.category.navigation.description',
    frame: 'narrator.frame.navigation',
    frameFallback: '{title}.',
    enabledByDefault: false,
    cooldownMs: 4000,
    neverSuppressed: false,
    icon: 'dock'
  },
  {
    id: 'settings',
    label: 'narrator.category.settings',
    description: 'narrator.category.settings.description',
    frame: 'narrator.frame.settings',
    frameFallback: '{title} is now {body}.',
    enabledByDefault: false,
    cooldownMs: 10000,
    neverSuppressed: false,
    icon: 'tune'
  }
];

export function categoryById(id: string): CategoryDefinition | null {
  return CATEGORIES.find((category) => category.id === id) ?? null;
}

/* ------------------------------------------------------------------ */
/* Spoken-line bookkeeping                                             */
/* ------------------------------------------------------------------ */

export type LineOutcome =
  | 'spoken'
  | 'replaced'
  | 'dropped'
  | 'suppressed'
  | 'interrupted'
  | 'failed';

export interface SpokenLine {
  id: string;
  /** ISO-8601 with the local offset, so the log is readable without conversion. */
  at: string;
  category: CategoryId;
  /** What each track was asked to say, exactly as it was handed to the engine. */
  segments: Array<{ language: NarratedLanguage; text: string; voiceName: string }>;
  outcome: LineOutcome;
  /** Why, in plain words, whenever the outcome is not `spoken`. */
  reason: string;
}

/**
 * Local ISO-8601 including the offset.
 *
 * `toISOString` would render the log in UTC, which reads as the wrong time of
 * day to everybody who is not on UTC and makes a quiet-hours complaint
 * impossible to check.
 */
export function localIso(date = new Date()): string {
  const pad = (value: number, width = 2): string => String(Math.abs(value)).padStart(width, '0');
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `.${pad(date.getMilliseconds(), 3)}${sign}${pad(Math.trunc(offsetMinutes / 60))}:${pad(offsetMinutes % 60)}`
  );
}
