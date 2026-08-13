import { el } from '../../core/a11y';
import type { AppContext } from '../../core/registry';
import { narrator } from './engine';
import { SPEECH_RANGES, pitchSettingId, rateSettingId, voiceSettingId } from './model';
import type { NarratedLanguage } from './model';
import { voiceRegistry } from './voices';

/**
 * One picker per narrated language — never one shared picker.
 *
 * Choosing an English voice says nothing whatsoever about which Cantonese voice
 * should read the other half of a bilingual line, so each track carries its own
 * selection, its own rate, its own pitch, its own persistence and its own
 * status line.
 *
 * The status line underneath is the part that earns its place. A select box
 * that merely shows a value implies that value is what will be heard, which is
 * exactly the state that needs saying out loud when it is not: a chosen voice
 * that is not installed here, a voice that needs the network, or a language
 * this computer cannot read at all.
 */

export interface VoicePickerHandle {
  root: HTMLElement;
  refresh(): void;
  destroy(): void;
}

function languageName(ctx: AppContext, language: NarratedLanguage): string {
  return language === 'en'
    ? ctx.t('narrator.mode.en', 'English')
    : ctx.t('narrator.mode.yue', 'Cantonese');
}

function sampleText(ctx: AppContext, language: NarratedLanguage): string {
  return language === 'en'
    ? ctx.t('narrator.sample.en', 'This is the English narrator voice, speaking at the current rate and pitch.', {
        language: 'en'
      })
    : ctx.t('narrator.sample.yue', 'This is the Cantonese narrator voice.', { language: 'yue' });
}

export interface VoicePickerOptions {
  /**
   * Prefix for every element id this picker creates.
   *
   * The same picker is built in two places — this feature's destination and a
   * settings row — and two elements sharing one id would make the palette's
   * teleport land on whichever the document happened to hold first. The
   * destination keeps the plain prefix, because that is what the palette
   * entries point at.
   */
  idPrefix?: string;
}

export function createVoicePicker(
  ctx: AppContext,
  language: NarratedLanguage,
  options: VoicePickerOptions = {}
): VoicePickerHandle {
  const prefix = `${options.idPrefix ?? 'narrator-voice'}-${language}`;
  const root = el('div', {
    className: 'narrator-voice',
    attrs: { id: prefix, 'data-appearance-id': `narrator:voice:${language}` }
  });

  const heading = el('h3', {
    className: 'md-typescale-title-small',
    text: ctx.t(`narrator.voice.${language}`, language === 'en' ? 'English voice' : 'Cantonese voice')
  });

  const explanationId = `${prefix}-explanation`;
  const explain = el('button', {
    className: 'md-setting__explain',
    text: '?',
    attrs: {
      type: 'button',
      'aria-label': ctx.t('core.settings.explain', 'What this does'),
      'aria-expanded': 'false',
      'aria-controls': explanationId
    }
  });
  const explanation = el('p', {
    className: 'md-setting__description md-typescale-body-small',
    text: ctx.t('narrator.voice.description', 'Chooses which installed voice reads this track.'),
    attrs: { id: explanationId }
  });
  explanation.hidden = true;
  explain.addEventListener('click', () => {
    explanation.hidden = !explanation.hidden;
    explain.setAttribute('aria-expanded', String(!explanation.hidden));
  });

  const head = el('div', { className: 'narrator-voice__head' });
  head.append(heading, explain);

  const selectHost = el('div', { className: 'narrator-voice__select' });
  const status = el('p', {
    className: 'narrator-voice__status md-typescale-body-small',
    attrs: { role: 'status', 'aria-live': 'polite' }
  });
  const provenance = el('p', { className: 'md-setting__provenance' });
  const controls = el('div', { className: 'narrator-voice__controls' });
  const actions = el('div', { className: 'narrator-voice__actions' });

  /* ---------------- the select ---------------- */

  const drawSelect = (): void => {
    selectHost.textContent = '';
    const installed = voiceRegistry.forLanguage(language);
    const stored = ctx.settings.get<string>(voiceSettingId(language), '');
    const listState = voiceRegistry.listState();

    const options = [
      { value: '', label: ctx.t('narrator.voice.automatic', 'Choose automatically') },
      ...installed.map((voice) => ({
        value: voice.voiceURI,
        // The tag and the origin belong in the option itself: two voices with
        // the same display name are common, and the difference between them is
        // exactly what the tag and the origin say.
        label: `${voice.name} — ${voice.lang}${voice.localService ? '' : ' — network'}`
      }))
    ];

    // A stored voice that is not installed keeps its own entry, so the picker
    // shows the user's real choice rather than silently sliding to "automatic".
    if (stored !== '' && !installed.some((voice) => voice.voiceURI === stored)) {
      options.push({ value: stored, label: `${stored} — not installed on this computer` });
    }

    const handle = ctx.components.select({
      label: `narrator.voice.${language}`,
      options,
      value: stored,
      disabled: listState === 'unsupported',
      disabledReason: ctx.t('narrator.voice.unsupported', 'This build has no speech synthesis.'),
      onChange: (value) => {
        ctx.settings.set(voiceSettingId(language), value);
        refresh();
      },
      id: `${prefix}-select`
    });
    selectHost.append(handle.root);
  };

  /* ---------------- the honest status line ---------------- */

  const drawStatus = (): void => {
    const listState = voiceRegistry.listState();
    if (listState === 'unsupported') {
      status.textContent = ctx.t('narrator.voice.unsupported', 'This build has no speech synthesis, so nothing can be spoken.');
      return;
    }
    if (listState === 'pending') {
      status.textContent = ctx.t(
        'narrator.voice.pending',
        'Reading the installed voices from the platform. The list often arrives a moment after the window opens.'
      );
      return;
    }
    if (listState === 'empty') {
      status.textContent = ctx.t('narrator.voice.emptyList', 'This computer has no speech voices installed at all.');
      return;
    }

    const stored = ctx.settings.get<string>(voiceSettingId(language), '');
    const resolution = voiceRegistry.resolve(language, stored);
    const name = languageName(ctx, language);
    const origin = resolution.voice
      ? resolution.voice.localService
        ? ctx.t('narrator.voiceStatus.originLocal', 'It runs on this computer and keeps working offline.')
        : `${ctx.t(
            'narrator.voiceStatus.originNetwork',
            'It is produced over the network and goes quiet whenever this computer is offline.'
          )}${
            navigator.onLine
              ? ''
              : ` ${ctx.t('narrator.voiceStatus.offlineNow', 'This computer is offline right now.')}`
          }`
      : '';

    switch (resolution.reason) {
      case 'chosen':
        status.textContent = ctx.t('narrator.voiceStatus.chosen', '{name} will speak. {origin}', {
          values: { name: resolution.voice?.name ?? '', origin }
        });
        break;
      case 'automatic':
        status.textContent = ctx.t(
          'narrator.voiceStatus.automatic',
          'No voice chosen, so {name} speaks — the first one this computer offers for {language}. {origin}',
          { values: { name: resolution.voice?.name ?? '', language: name, origin } }
        );
        break;
      case 'missing-fallback':
        status.textContent = ctx.t(
          'narrator.voiceStatus.missingFallback',
          'The voice you chose is NOT installed on this computer. Your choice is kept; {name} speaks instead. {origin}',
          { values: { name: resolution.voice?.name ?? '', origin } }
        );
        break;
      case 'missing-silent':
        status.textContent = ctx.t(
          'narrator.voiceStatus.missingSilent',
          'The voice you chose is NOT installed on this computer, and nothing else here can read {language}.',
          { values: { language: name } }
        );
        break;
      default:
        status.textContent = ctx.t(
          'narrator.voiceStatus.none',
          'No voice on this computer can read {language} at all, so this track stays silent.',
          { values: { language: name } }
        );
        break;
    }

    const count = voiceRegistry.forLanguage(language).length;
    status.textContent += ` ${ctx.t('narrator.voice.count', '{count} voices on this computer can read {language}.', {
      values: { count, language: name }
    })}`;
  };

  const drawProvenance = (): void => {
    const source = ctx.settings.provenanceOf(voiceSettingId(language));
    provenance.textContent =
      source === 'default'
        ? ctx.t(
            'core.settings.provenance.default',
            'No file has ever set this. The application is using its own value: {value}.',
            { values: { value: ctx.t('narrator.voice.automatic', 'Choose automatically') } }
          )
        : ctx.t('core.settings.provenance.user', 'Set by you, and stored in {path}.', {
            values: { path: ctx.settings.filePath() || 'the settings file' }
          });
  };

  /* ---------------- rate, pitch and the preview ---------------- */

  const drawControls = (): void => {
    controls.textContent = '';
    const rate = ctx.components.slider({
      label: 'narrator.rate',
      min: SPEECH_RANGES.rate.min,
      max: SPEECH_RANGES.rate.max,
      step: SPEECH_RANGES.rate.step,
      value: ctx.settings.get<number>(rateSettingId(language), SPEECH_RANGES.rate.default),
      onChange: (value) => ctx.settings.set(rateSettingId(language), value),
      id: `${prefix}-rate`
    });
    const pitch = ctx.components.slider({
      label: 'narrator.pitch',
      min: SPEECH_RANGES.pitch.min,
      max: SPEECH_RANGES.pitch.max,
      step: SPEECH_RANGES.pitch.step,
      value: ctx.settings.get<number>(pitchSettingId(language), SPEECH_RANGES.pitch.default),
      onChange: (value) => ctx.settings.set(pitchSettingId(language), value),
      id: `${prefix}-pitch`
    });
    controls.append(rate.root, pitch.root);
  };

  const drawActions = (): void => {
    actions.textContent = '';
    const resolution = voiceRegistry.resolve(language, ctx.settings.get<string>(voiceSettingId(language), ''));
    actions.append(
      ctx.components.button({
        label: 'narrator.action.preview',
        variant: 'tonal',
        icon: 'play',
        disabled: resolution.voice === null,
        disabledReason: ctx.t(
          'narrator.voiceStatus.none',
          'No voice on this computer can read {language} at all, so this track stays silent.',
          { values: { language: languageName(ctx, language) } }
        ),
        onClick: () => narrator.preview(language, sampleText(ctx, language))
      }),
      ctx.components.button({
        label: 'narrator.action.resetVoice',
        variant: 'text',
        icon: 'refresh',
        disabled: ctx.settings.get<string>(voiceSettingId(language), '') === '',
        disabledReason: ctx.t('narrator.voice.automatic', 'Choose automatically'),
        onClick: () => {
          ctx.settings.reset(voiceSettingId(language));
          refresh();
        }
      })
    );
  };

  const refresh = (): void => {
    drawSelect();
    drawStatus();
    drawProvenance();
    drawControls();
    drawActions();
  };

  root.append(head, explanation, selectHost, status, provenance, controls, actions);
  refresh();

  /**
   * The subscriptions release themselves once this element leaves the document.
   *
   * A picker is built in two places — this feature's own tab, which disposes
   * properly, and a settings row, which is rebuilt every time the language or
   * humour level changes. Without this check the second route would leave a
   * live subscription behind on every rebuild, and the leak would be invisible
   * until a long session started redrawing a picker that is no longer on screen.
   */
  const detached = (): boolean => !root.isConnected;

  let stopVoices = (): void => undefined;
  let stopSettings = (): void => undefined;
  const release = (): void => {
    stopVoices();
    stopSettings();
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOnline);
  };

  stopVoices = voiceRegistry.onChange(() => {
    if (detached()) {
      release();
      return;
    }
    refresh();
  });
  stopSettings = ctx.settings.onChange((change) => {
    if (detached()) {
      release();
      return;
    }
    if (
      change.id === voiceSettingId(language) ||
      change.id === rateSettingId(language) ||
      change.id === pitchSettingId(language)
    ) {
      drawStatus();
      drawProvenance();
      drawActions();
    }
  });
  function onOnline(): void {
    if (detached()) {
      release();
      return;
    }
    drawStatus();
  }
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOnline);

  return { root, refresh, destroy: release };
}
