import type { AppContext, LanguageMode, SettingsSection } from '../../core/registry';
import { openDisclosure } from './disclosure';
import { el } from './dom';
import { levelName, modeName, renderLanguagePreview, renderPreviewScreen, renderSample } from './preview';
import { SAMPLES, clampLevel } from './samples';
import {
  CORE_IDS,
  DEFAULT_PREVIEW_SCALE,
  DEFAULT_PREVIEW_WIDTH,
  MIRROR_IDS,
  PREVIEW_SCALES,
  PREVIEW_SCALE_ID,
  PREVIEW_WIDTH_ID,
  SECTION_ID,
  readEmoji,
  readFunny,
  readMode,
  resetVoiceSettings,
  writeEmoji,
  writeFunny,
  writeMode
} from './state';

/**
 * The language and voice settings section.
 *
 * Each of the first four controls is the real control, wired to the same
 * application-wide setting the shell uses, with a live preview beside it so the
 * choice is made with the result in view rather than from the name of a level.
 *
 * The section is registered under this feature's own ids because a setting id is
 * unique across the whole application; `state.ts` explains the mirroring and
 * keeps the provenance line above each control truthful about the value that is
 * actually in force.
 */

/**
 * Keeps a subscription alive only while its element is in the document.
 *
 * A settings row can be rebuilt at any time, and a listener whose element left
 * the document would repaint a detached tree forever.
 */
function bindLive(node: HTMLElement, subscribe: (repaint: () => void) => () => void, repaint: () => void): void {
  let unsubscribe: (() => void) | null = null;
  unsubscribe = subscribe(() => {
    if (!node.isConnected) {
      unsubscribe?.();
      unsubscribe = null;
      return;
    }
    repaint();
  });
  node.addEventListener('md-dispose', () => {
    unsubscribe?.();
    unsubscribe = null;
  });
}

/**
 * Removes this section's own rows from a settings surface that was already open
 * when the study mode was switched on.
 *
 * The rule is omission rather than disabling: while that mode is on, the
 * Cantonese, bilingual and humour capabilities behave as though they were never
 * installed. The registry stops offering this section the moment the mode
 * changes, so a surface built afterwards simply never contains it — this handles
 * the one case the registry cannot, a panel that is already on screen. It only
 * ever removes elements that belong to this feature.
 */
function omitUnderSchoolMode(ctx: AppContext, host: HTMLElement): boolean {
  if (!ctx.i18n.schoolModeActive()) return false;
  const row = host.closest('.md-setting');
  const section = row?.parentElement ?? null;
  row?.remove();
  if (section && section.querySelectorAll('.md-setting').length === 0) {
    section.remove();
    document.querySelector(`.md-tabbar [data-tab-id="${CSS.escape(SECTION_ID)}"]`)?.remove();
  }
  return true;
}

function mirrorNote(ctx: AppContext, source: string, mirror: string): HTMLElement {
  return el('p', {
    className: 'lang-mirror-note md-typescale-label-small',
    text: ctx.t(
      'language.mirror.note',
      'This control writes the application-wide setting {source} and keeps its own copy at {mirror} in step with it, so the provenance line above describes the value that is actually in force.',
      { values: { source, mirror } }
    )
  });
}

function currentView(ctx: AppContext): {
  mode: LanguageMode;
  funnyEn: ReturnType<typeof readFunny>;
  funnyYue: ReturnType<typeof readFunny>;
  emoji: boolean;
} {
  return {
    mode: readMode(ctx),
    funnyEn: readFunny(ctx, 'en'),
    funnyYue: readFunny(ctx, 'yue'),
    emoji: readEmoji(ctx)
  };
}

export function languageSettingsSection(): SettingsSection {
  return {
    id: SECTION_ID,
    title: 'language.section.title',
    icon: 'world',
    order: 11,
    controls: [
      /* ---------------- the language mode ---------------- */
      {
        id: MIRROR_IDS.mode,
        label: 'language.mode.label',
        description: 'language.mode.description',
        kind: 'custom',
        defaultValue: 'en',
        keywords: ['english', 'cantonese', 'bilingual', 'language', 'mode', '語言', '雙語'],
        render(host, ctx) {
          host.append(modeControl(ctx, { idSuffix: 'setting' }));
          host.append(mirrorNote(ctx, CORE_IDS.mode, MIRROR_IDS.mode));
        }
      },

      /* ---------------- humour, English ---------------- */
      {
        id: MIRROR_IDS.funnyEn,
        label: 'language.funny.en.label',
        description: 'language.funny.description',
        kind: 'custom',
        defaultValue: 3,
        keywords: ['humour', 'humor', 'funny', 'tone', 'voice', 'english', 'level'],
        validate: (value) => {
          const numeric = Number(value);
          return Number.isFinite(numeric) && numeric >= 1 && numeric <= 5
            ? null
            : 'The humour level is a whole number from 1 to 5. Nothing was changed.';
        },
        render(host, ctx) {
          host.append(funnyControl(ctx, 'en', { idSuffix: 'setting', hideOwnLabel: true }));
          host.append(mirrorNote(ctx, CORE_IDS.funnyEn, MIRROR_IDS.funnyEn));
        }
      },

      /* ---------------- humour, Cantonese ---------------- */
      {
        id: MIRROR_IDS.funnyYue,
        label: 'language.funny.yue.label',
        description: 'language.funny.description',
        kind: 'custom',
        defaultValue: 3,
        keywords: ['humour', 'funny', 'tone', 'cantonese', '廣東話', '語氣', 'level'],
        validate: (value) => {
          const numeric = Number(value);
          return Number.isFinite(numeric) && numeric >= 1 && numeric <= 5
            ? null
            : 'The humour level is a whole number from 1 to 5. Nothing was changed.';
        },
        render(host, ctx) {
          host.append(funnyControl(ctx, 'yue', { idSuffix: 'setting', hideOwnLabel: true }));
          host.append(mirrorNote(ctx, CORE_IDS.funnyYue, MIRROR_IDS.funnyYue));
        }
      },

      /* ---------------- the emoji switch ---------------- */
      {
        id: MIRROR_IDS.emoji,
        label: 'language.emoji.label',
        description: 'language.emoji.description',
        kind: 'custom',
        defaultValue: true,
        keywords: ['emoji', 'dialog', 'message box', 'decoration', '表情符號'],
        render(host, ctx) {
          host.append(emojiControl(ctx, { idSuffix: 'setting' }));
          host.append(mirrorNote(ctx, CORE_IDS.emoji, MIRROR_IDS.emoji));
        }
      },

      /* ---------------- preview geometry ---------------- */
      {
        id: PREVIEW_WIDTH_ID,
        label: 'language.preview.width',
        description: 'language.preview.width.description',
        kind: 'slider',
        defaultValue: DEFAULT_PREVIEW_WIDTH,
        min: 240,
        max: 720,
        step: 20,
        hint: 'CSS pixels',
        keywords: ['preview', 'width', 'narrow', 'clipping', 'bilingual']
      },
      {
        id: PREVIEW_SCALE_ID,
        label: 'language.preview.scale',
        description: 'language.preview.scale.description',
        kind: 'select',
        defaultValue: DEFAULT_PREVIEW_SCALE,
        keywords: ['preview', 'scale', 'display', 'zoom', '125', '150', '200'],
        options: PREVIEW_SCALES.map((value) => ({ value, label: `${value}%` }))
      },

      /* ---------------- disclosure and reset ---------------- */
      {
        id: 'language.voice.disclosure',
        label: 'language.disclosure.show',
        description: 'language.disclosure.body',
        kind: 'action',
        defaultValue: null,
        keywords: ['disclosure', 'humour', 'warning', 'errors'],
        run: (ctx) => openDisclosure(ctx)
      },
      {
        id: 'language.voice.reset',
        label: 'language.reset.label',
        description: 'language.reset.description',
        kind: 'action',
        defaultValue: null,
        keywords: ['reset', 'default', 'language', 'humour', 'emoji'],
        run: async (ctx) => {
          // This is recoverable — every value is recorded in local history before
          // it changes — so it asks for a decision rather than running the
          // two-key gate reserved for what cannot be undone.
          const approved = await ctx.components.dialog({
            title: ctx.t('language.reset.confirm', 'Reset language mode, both humour levels and the emoji switch?'),
            body: ctx.t(
              'language.reset.confirmBody',
              'The language mode returns to English, both humour levels return to 3, and the emoji switch returns to on. The change is written to local history, so the values you had now can be read back from there.'
            ),
            confirmLabel: ctx.t('core.action.reset', 'Reset'),
            icon: 'refresh'
          });
          if (!approved) return;
          resetVoiceSettings(ctx);
          void ctx.history.record('Reset the language and voice settings', 'language', {
            ids: [CORE_IDS.mode, CORE_IDS.funnyEn, CORE_IDS.funnyYue, CORE_IDS.emoji]
          });
          ctx.notify.success(
            ctx.t(
              'language.reset.done',
              'Language mode, both humour levels and the emoji switch are back to their shipped values.'
            )
          );
        }
      }
    ]
  };
}

/* ------------------------------------------------------------------ */
/* The three live controls, shared by the settings row and the tab      */
/* ------------------------------------------------------------------ */

export interface ControlOptions {
  /**
   * Distinguishes the element ids when the same control is rendered twice, in
   * the settings surface and on the language tab. Two elements sharing one id
   * break every `label for=` and every teleport that names it.
   */
  idSuffix: string;
  /** Hides the preview when the caller shows a bigger one of its own. */
  withPreview?: boolean;
  /**
   * Hides the control's own visible label, keeping it as the accessible name.
   * A settings row already prints the name above the control, and printing it
   * twice reads as two different settings.
   */
  hideOwnLabel?: boolean;
}

export function modeControl(ctx: AppContext, options: ControlOptions): HTMLElement {
  const host = el('div', { className: 'lang-control lang-control--mode' });
  const control = ctx.components.segmentedButton({
    label: ctx.t('language.mode.label', 'Language'),
    id: `language-mode-${options.idSuffix}`,
    options: [
      { value: 'en', label: 'core.language.mode.en' },
      { value: 'yue', label: 'core.language.mode.yue' },
      { value: 'both', label: 'core.language.mode.both' }
    ],
    value: readMode(ctx),
    onChange: (value) => writeMode(ctx, value === 'yue' || value === 'both' ? value : 'en')
  });

  const preview = el('div', { className: 'lang-inline-preview' });
  const showPreview = options.withPreview !== false;

  const repaint = (): void => {
    if (omitUnderSchoolMode(ctx, host)) return;
    control.set(readMode(ctx));
    if (!showPreview) return;
    preview.textContent = '';
    const view = currentView(ctx);
    preview.append(
      renderPreviewScreen(ctx, view, {
        title: ctx.t('language.preview.cell', '{mode}, English at level {en}, Cantonese at level {yue}', {
          values: { mode: modeName(ctx, view.mode), en: view.funnyEn, yue: view.funnyYue }
        })
      })
    );
  };
  repaint();

  host.append(control.root);
  if (showPreview) host.append(preview);
  bindLive(host, (fn) => ctx.i18n.onChange(fn), repaint);
  return host;
}

export function funnyControl(ctx: AppContext, language: 'en' | 'yue', options: ControlOptions): HTMLElement {
  const host = el('div', { className: 'lang-control lang-funny' });

  const labelKey = language === 'en' ? 'language.funny.en.label' : 'language.funny.yue.label';
  const readout = el('p', { className: 'lang-funny__readout md-typescale-label-large', attrs: { role: 'status' } });
  const preview = el('div', { className: 'lang-funny__preview' });
  const showPreview = options.withPreview !== false;

  const slider = ctx.components.slider({
    label: ctx.t(labelKey, language === 'en' ? 'Humour level, English' : 'Humour level, Cantonese'),
    id: `language-funny-${language}-${options.idSuffix}`,
    min: 1,
    max: 5,
    step: 1,
    showTicks: true,
    value: readFunny(ctx, language),
    onChange: (value) => writeFunny(ctx, language, clampLevel(value))
  });
  if (options.hideOwnLabel) {
    slider.root.querySelector('.md-field__label')?.classList.add('md-visually-hidden');
  }

  const repaint = (): void => {
    if (omitUnderSchoolMode(ctx, host)) return;
    const level = readFunny(ctx, language);
    slider.set(level);
    readout.textContent = ctx.t('language.funny.current', 'Level {level} of 5 — {name}', {
      values: { level, name: levelName(ctx, level) }
    });
    if (!showPreview) return;
    preview.textContent = '';
    preview.append(renderLanguagePreview(ctx, language, level, readEmoji(ctx)));
  };
  repaint();

  host.append(slider.root, readout);
  if (showPreview) host.append(preview);
  bindLive(host, (fn) => ctx.i18n.onChange(fn), repaint);
  return host;
}

export function emojiControl(ctx: AppContext, options: ControlOptions): HTMLElement {
  const host = el('div', { className: 'lang-control lang-control--emoji' });
  const control = ctx.components.switchControl({
    label: ctx.t('language.emoji.label', 'Show emojis in dialogs and message boxes'),
    id: `language-emoji-${options.idSuffix}`,
    checked: readEmoji(ctx),
    onChange: (checked) => writeEmoji(ctx, checked)
  });

  const comparison = el('div', { className: 'lang-emoji-compare' });
  const showPreview = options.withPreview !== false;

  const repaint = (): void => {
    if (omitUnderSchoolMode(ctx, host)) return;
    control.set(readEmoji(ctx));
    if (!showPreview) return;
    comparison.textContent = '';
    const view = currentView(ctx);
    // The destructive sample, because that is the category where somebody would
    // most want to know whether an emoji is about to appear.
    const sample = SAMPLES.find((candidate) => candidate.id === 'destructive') ?? SAMPLES[0];
    for (const on of [true, false]) {
      const column = el('div', { className: 'lang-emoji-compare__column' });
      column.append(
        el('p', {
          className: 'md-typescale-label-medium',
          text: on
            ? ctx.t('language.emoji.on', 'With the switch on')
            : ctx.t('language.emoji.off', 'With the switch off')
        })
      );
      column.append(renderSample(ctx, sample, { ...view, emoji: on }));
      comparison.append(column);
    }
  };
  repaint();

  host.append(control.root);
  if (showPreview) host.append(comparison);
  bindLive(host, (fn) => ctx.i18n.onChange(fn), repaint);
  return host;
}
