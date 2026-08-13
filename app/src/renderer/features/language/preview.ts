import type { AppContext, FunnyLevel, LanguageMode } from '../../core/registry';
import { el } from './dom';
import { CHROME, SAMPLES, type Sample, type SampleLadder, clampLevel, sampleText } from './samples';

/**
 * The preview renderer.
 *
 * Everything it produces is a STATIC preview and says so: no element inside a
 * preview is focusable, none of them is styled like a live control, and every
 * preview carries a caption naming it as a preview of example copy. A mock that
 * looks operable and is not is worse than a screenshot, because a screenshot at
 * least never invites a click.
 *
 * The whole point of rendering it here rather than reading the shipped level is
 * that a preview must be able to show a level the application is not currently
 * using — that is what makes it a preview rather than a mirror.
 */

export interface PreviewSettings {
  mode: LanguageMode;
  funnyEn: FunnyLevel;
  funnyYue: FunnyLevel;
  /** The emoji switch. Decoration reaches a message box and nothing else. */
  emoji: boolean;
}

function rung(ladder: SampleLadder, level: FunnyLevel): string {
  return ladder[clampLevel(level) - 1];
}

/** Applies the user's own vocabulary, exactly as every other surface does. */
function finish(ctx: AppContext, text: string): string {
  return ctx.i18n.applyVocabulary(text);
}

/**
 * One rendered sample message.
 *
 * The emoji decoration lands on the primary line only, once, and only when the
 * switch is on — a message box gets one decorative emoji, not one per language.
 */
export function renderSample(ctx: AppContext, sample: Sample, view: PreviewSettings): HTMLElement {
  const card = el('div', {
    className: `lang-sample lang-sample--${sample.id}`,
    attrs: { role: 'group', 'aria-label': `${ctx.t(sample.categoryKey, sample.id)} — ${ctx.t('language.preview.static', 'Static preview. Nothing here is a live control.')}` }
  });

  card.append(
    el('p', {
      className: 'lang-sample__category md-typescale-label-medium',
      text: ctx.t(sample.categoryKey, sample.id)
    })
  );

  const primaryLanguage: 'en' | 'yue' = view.mode === 'yue' ? 'yue' : 'en';
  const primaryLevel = primaryLanguage === 'en' ? view.funnyEn : view.funnyYue;
  const decoration = view.emoji ? `${sample.emoji} ` : '';

  card.append(
    el('p', {
      className: 'lang-sample__primary md-typescale-body-medium',
      text: `${decoration}${finish(ctx, sampleText(sample, primaryLanguage, primaryLevel))}`
    })
  );

  if (view.mode === 'both') {
    card.append(
      el('p', {
        className: 'lang-sample__secondary md-typescale-body-small',
        text: finish(ctx, sampleText(sample, 'yue', view.funnyYue)),
        attrs: { lang: 'yue-Hant-HK' }
      })
    );
  }

  return card;
}

/** The three samples, in one pane, at the given view. */
export function renderSampleSet(ctx: AppContext, view: PreviewSettings): HTMLElement {
  const pane = el('div', { className: 'lang-samples' });
  for (const sample of SAMPLES) pane.append(renderSample(ctx, sample, view));
  return pane;
}

/**
 * A whole preview screen: heading, supporting line, the three messages and a row
 * of action labels.
 *
 * The action labels are rendered as text rather than as buttons, because they
 * are not buttons. They are here so the length a bilingual label reaches is
 * visible beside the copy it has to share a column with.
 */
export function renderPreviewScreen(
  ctx: AppContext,
  view: PreviewSettings,
  options: { title?: string; widthPx?: number } = {}
): HTMLElement {
  const screen = el('div', {
    className: 'lang-screen',
    attrs: {
      role: 'group',
      'aria-label':
        options.title ??
        ctx.t('language.preview.cell', '{mode}, English at level {en}, Cantonese at level {yue}', {
          values: { mode: modeName(ctx, view.mode), en: view.funnyEn, yue: view.funnyYue }
        })
    }
  });
  if (options.widthPx) screen.style.inlineSize = `${options.widthPx}px`;

  if (options.title) {
    screen.append(el('p', { className: 'lang-screen__caption md-typescale-label-large', text: options.title }));
  }

  const chromeLanguage: 'en' | 'yue' = view.mode === 'yue' ? 'yue' : 'en';
  const chromeLevel = chromeLanguage === 'en' ? view.funnyEn : view.funnyYue;

  const header = el('div', { className: 'lang-screen__header' });
  header.append(
    el('h4', {
      className: 'lang-screen__title md-typescale-title-small',
      text: finish(ctx, rung(CHROME.title[chromeLanguage], chromeLevel))
    })
  );
  if (view.mode === 'both') {
    header.append(
      el('p', {
        className: 'lang-screen__title-secondary md-typescale-label-medium',
        text: finish(ctx, rung(CHROME.title.yue, view.funnyYue)),
        attrs: { lang: 'yue-Hant-HK' }
      })
    );
  }
  header.append(
    el('p', {
      className: 'lang-screen__supporting md-typescale-body-small',
      text: finish(ctx, rung(CHROME.supporting[chromeLanguage], chromeLevel))
    })
  );
  if (view.mode === 'both') {
    header.append(
      el('p', {
        className: 'lang-screen__supporting md-typescale-body-small lang-screen__secondary',
        text: finish(ctx, rung(CHROME.supporting.yue, view.funnyYue)),
        attrs: { lang: 'yue-Hant-HK' }
      })
    );
  }
  screen.append(header);

  screen.append(renderSampleSet(ctx, view));

  const actions = el('div', { className: 'lang-screen__actions' });
  for (const action of CHROME.actions) {
    const text = finish(ctx, rung(action[chromeLanguage], chromeLevel));
    const second = view.mode === 'both' ? finish(ctx, rung(action.yue, view.funnyYue)) : '';
    const chip = el('span', { className: 'lang-screen__action' });
    chip.append(el('span', { className: 'md-typescale-label-large', text }));
    if (second) {
      chip.append(
        el('span', {
          className: 'lang-screen__action-secondary md-typescale-label-small',
          text: second,
          attrs: { lang: 'yue-Hant-HK' }
        })
      );
    }
    actions.append(chip);
  }
  screen.append(actions);

  screen.append(
    el('p', {
      className: 'lang-screen__notice md-typescale-label-small',
      text: ctx.t('language.preview.static', 'Static preview. Nothing here is a live control.')
    })
  );

  return screen;
}

/** The localized name of a language mode, for a caption. */
export function modeName(ctx: AppContext, mode: LanguageMode): string {
  if (mode === 'yue') return ctx.t('core.language.mode.yue', 'Cantonese');
  if (mode === 'both') return ctx.t('core.language.mode.both', 'Bilingual');
  return ctx.t('core.language.mode.en', 'English');
}

/** The localized name of one humour rung, for a caption or a readout. */
export function levelName(ctx: AppContext, level: FunnyLevel): string {
  const fallbacks: Record<number, string> = {
    1: 'Fully professional',
    2: 'Plain',
    3: 'Warm',
    4: 'Playful',
    5: 'Maximum playfulness'
  };
  const clamped = clampLevel(level);
  return ctx.t(`language.funny.level.${clamped}`, fallbacks[clamped]);
}

/**
 * The pane that sits under one humour slider.
 *
 * It shows exactly one language, because that slider governs exactly one
 * language, and showing the other one beside it would suggest the slider moved
 * both.
 */
export function renderLanguagePreview(
  ctx: AppContext,
  language: 'en' | 'yue',
  level: FunnyLevel,
  emoji: boolean
): HTMLElement {
  const pane = el('div', { className: 'lang-preview-pane' });
  pane.append(
    el('p', {
      className: 'lang-preview-pane__head md-typescale-label-large',
      text: `${language === 'en' ? ctx.t('core.language.mode.en', 'English') : ctx.t('core.language.mode.yue', 'Cantonese')} — ${ctx.t(
        'language.funny.current',
        'Level {level} of 5 — {name}',
        { values: { level, name: levelName(ctx, level) } }
      )}`
    })
  );
  pane.append(
    renderSampleSet(ctx, {
      mode: language === 'en' ? 'en' : 'yue',
      funnyEn: level,
      funnyYue: level,
      emoji
    })
  );
  pane.append(
    el('p', {
      className: 'lang-preview-pane__notice md-typescale-label-small',
      text: ctx.t(
        'language.preview.examples',
        'These three messages are examples written for this preview. No world was saved, nothing is being deleted and no connection was refused.'
      )
    })
  );
  return pane;
}
