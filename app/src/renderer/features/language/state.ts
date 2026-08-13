import type { AppContext, FunnyLevel, LanguageMode } from '../../core/registry';
import { clampLevel } from './samples';

/**
 * Where this feature's state actually lives, and why there are two copies of it.
 *
 * The language mode, the two humour levels and the emoji switch are
 * application-wide settings owned by the shell, under the ids in `CORE`. This
 * feature does not fork them: every control here writes those exact ids through
 * the shared language service, so the two routes to one value can never disagree
 * about what that value is.
 *
 * A settings row shows the provenance of the id it is registered under, and an
 * id may only be registered once in the whole application. So each control here
 * carries a MIRROR id, kept in lockstep with the shell's value AND with its
 * provenance — including resetting the mirror when the source has never been
 * written, so the row honestly reports "the application is using its own value"
 * rather than implying somebody chose it. The mirror is a reflection; the
 * `CORE` id is always the thing in force.
 */

export const TAB_ID = 'language.preview';
export const SECTION_ID = 'language.voice';

/** The shell's own ids. Registered by the core, written by this feature. */
export const CORE_IDS = {
  mode: 'language.mode',
  funnyEn: 'language.funny.en',
  funnyYue: 'language.funny.yue',
  emoji: 'language.emojiInDialogs'
} as const;

/** This feature's registered ids, each a synchronized reflection of one above. */
export const MIRROR_IDS = {
  mode: 'language.voice.mode',
  funnyEn: 'language.voice.funny.en',
  funnyYue: 'language.voice.funny.yue',
  emoji: 'language.voice.emoji'
} as const;

export const PREVIEW_WIDTH_ID = 'language.preview.width';
export const PREVIEW_SCALE_ID = 'language.preview.scale';
export const DISCLOSURE_ACK_ID = 'language.disclosure.acknowledgedAt';
export const SCHOOL_HID_TAB_ID = 'language.school.tabHidden';

export const DEFAULT_MODE: LanguageMode = 'en';
export const DEFAULT_FUNNY: FunnyLevel = 3;
export const DEFAULT_EMOJI = true;
export const DEFAULT_PREVIEW_WIDTH = 380;
export const DEFAULT_PREVIEW_SCALE = '100';

export const PREVIEW_SCALES = ['100', '125', '150', '200'] as const;

const MIRROR_PAIRS: Array<[source: string, mirror: string]> = [
  [CORE_IDS.mode, MIRROR_IDS.mode],
  [CORE_IDS.funnyEn, MIRROR_IDS.funnyEn],
  [CORE_IDS.funnyYue, MIRROR_IDS.funnyYue],
  [CORE_IDS.emoji, MIRROR_IDS.emoji]
];

/* ------------------------------------------------------------------ */
/* Reading                                                             */
/* ------------------------------------------------------------------ */

/**
 * The stored language mode.
 *
 * This deliberately reads the setting rather than the language snapshot: while
 * the study mode is on the snapshot reports English regardless of what the user
 * chose, and the value we want here is the choice that returns when the study
 * mode is switched off.
 */
export function readMode(ctx: AppContext): LanguageMode {
  const raw = ctx.settings.get<string>(CORE_IDS.mode, DEFAULT_MODE);
  return raw === 'yue' || raw === 'both' ? raw : 'en';
}

export function readFunny(ctx: AppContext, language: 'en' | 'yue'): FunnyLevel {
  const id = language === 'en' ? CORE_IDS.funnyEn : CORE_IDS.funnyYue;
  return clampLevel(ctx.settings.get<number>(id, DEFAULT_FUNNY));
}

export function readEmoji(ctx: AppContext): boolean {
  return ctx.settings.get<boolean>(CORE_IDS.emoji, DEFAULT_EMOJI) === true;
}

export function readPreviewWidth(ctx: AppContext): number {
  const raw = Number(ctx.settings.get<number>(PREVIEW_WIDTH_ID, DEFAULT_PREVIEW_WIDTH));
  if (!Number.isFinite(raw)) return DEFAULT_PREVIEW_WIDTH;
  return Math.min(720, Math.max(240, Math.round(raw)));
}

export function readPreviewScale(ctx: AppContext): string {
  const raw = String(ctx.settings.get<string>(PREVIEW_SCALE_ID, DEFAULT_PREVIEW_SCALE));
  return (PREVIEW_SCALES as readonly string[]).includes(raw) ? raw : DEFAULT_PREVIEW_SCALE;
}

/* ------------------------------------------------------------------ */
/* Writing                                                             */
/* ------------------------------------------------------------------ */

export function writeMode(ctx: AppContext, mode: LanguageMode): void {
  ctx.i18n.setMode(mode);
  syncMirrors(ctx);
}

export function writeFunny(ctx: AppContext, language: 'en' | 'yue', level: FunnyLevel): void {
  ctx.i18n.setFunny(language, clampLevel(level));
  syncMirrors(ctx);
}

export function writeEmoji(ctx: AppContext, on: boolean): void {
  ctx.i18n.setEmojiInDialogs(on);
  syncMirrors(ctx);
}

/**
 * Restores the four shell settings to the values this build ships with.
 *
 * `reset` rather than `set`, so the provenance goes back to "no file has ever
 * set this" instead of recording the shipped value as a deliberate choice.
 */
export function resetVoiceSettings(ctx: AppContext): void {
  // Resetting the source is enough to repaint: the shell watches these exact
  // ids and re-reads the language state from the store whenever one changes.
  for (const [source, mirror] of MIRROR_PAIRS) {
    ctx.settings.reset(source);
    ctx.settings.reset(mirror);
  }
}

/* ------------------------------------------------------------------ */
/* Mirroring                                                           */
/* ------------------------------------------------------------------ */

/** Copies each shell value and its provenance onto this feature's mirror id. */
export function syncMirrors(ctx: AppContext): void {
  for (const [source, mirror] of MIRROR_PAIRS) {
    const provenance = ctx.settings.provenanceOf(source);
    if (provenance === 'default') {
      // The source has never been written, so the mirror must read the same way
      // rather than presenting the shipped value as somebody's choice.
      ctx.settings.reset(mirror);
      continue;
    }
    ctx.settings.set(mirror, ctx.settings.get(source), provenance);
  }
}

/**
 * Keeps the mirrors in step for the whole session.
 *
 * `set` is a no-op when the value is unchanged, so a source change updating a
 * mirror cannot bounce back into a loop.
 */
export function installMirrorSync(ctx: AppContext): () => void {
  syncMirrors(ctx);
  return ctx.settings.onChange((change) => {
    if (MIRROR_PAIRS.some(([source]) => source === change.id)) syncMirrors(ctx);
  });
}

/* ------------------------------------------------------------------ */
/* Disclosure                                                          */
/* ------------------------------------------------------------------ */

export function disclosureAcknowledgedAt(ctx: AppContext): string {
  const raw = ctx.settings.get<string>(DISCLOSURE_ACK_ID, '');
  return typeof raw === 'string' ? raw : '';
}

export function acknowledgeDisclosure(ctx: AppContext): string {
  const when = new Date().toISOString();
  ctx.settings.set(DISCLOSURE_ACK_ID, when);
  void ctx.history.record('Acknowledged the humour-level disclosure', 'language', { acknowledgedAt: when });
  return when;
}

/** A readable local timestamp for the acknowledgement line. */
export function formatWhen(iso: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
}
