import { defineFeature } from '../../core/registry';
import type { AppContext, NotificationRecord, NotificationSeverity } from '../../core/registry';
import { NARRATOR_DOCS } from './docs';
import { narrator } from './engine';
import {
  NARRATOR_ENABLED_ID,
  SPEECH_RANGES,
  pitchSettingId,
  rateSettingId,
  voiceSettingId
} from './model';
import type { CategoryId, NarratedLanguage } from './model';
import { mountNarratorPanel } from './panel';
import { narratorSettingsSections } from './settingsSection';
import { NARRATOR_STRINGS } from './strings';
import { installNarratorStyles } from './styles';
import { voiceRegistry } from './voices';

/**
 * The spoken narrator.
 *
 * It ships switched OFF. The implementation is not optional — the whole feature
 * is here, tested against a machine with no voices, a machine whose list
 * arrives late, and a chosen voice that is not installed — but whether it ever
 * makes a sound is entirely the listener's choice.
 */

/** Which category a notification of each severity is narrated as. */
const SEVERITY_TO_CATEGORY: Record<NotificationSeverity, CategoryId> = {
  error: 'error',
  warning: 'warning',
  success: 'success',
  info: 'notice',
  progress: 'progress'
};

function sampleFor(ctx: AppContext, language: NarratedLanguage): string {
  return language === 'en'
    ? ctx.t('narrator.sample.en', 'This is the English narrator voice, speaking at the current rate and pitch.', {
        language: 'en'
      })
    : ctx.t('narrator.sample.yue', 'This is the Cantonese narrator voice.', { language: 'yue' });
}

function wireNotifications(ctx: AppContext): void {
  // Only records that are genuinely NEW are narrated: `onChange` also fires for
  // a dismissal, and re-reading a dismissed line aloud would be both wrong and
  // maddening.
  const seen = new Set<string>();
  for (const record of ctx.notify.history()) seen.add(record.id);

  ctx.notify.onChange(() => {
    const current = ctx.notify.history();
    const fresh: NotificationRecord[] = [];
    for (const record of current) {
      if (seen.has(record.id)) continue;
      seen.add(record.id);
      fresh.push(record);
    }
    // Oldest first, so a burst reads in the order it happened.
    for (const record of fresh.reverse()) {
      // A failure raised BY the narrator must never be narrated: a speech error
      // that raises a notification that is narrated as a speech error is a loop
      // with a voice.
      if (record.source === 'narrator') continue;
      narrator.speak({
        category: SEVERITY_TO_CATEGORY[record.severity] ?? 'notice',
        values: { title: record.title, body: record.body }
      });
    }
  });
}

function wireNavigation(ctx: AppContext): void {
  let lastTab = ctx.tabs.activeId();
  ctx.tabs.onChange(() => {
    const active = ctx.tabs.activeId();
    if (active === lastTab) return;
    lastTab = active;
    if (!active) return;
    const record = ctx.tabs.list().find((candidate) => candidate.id === active);
    if (!record) return;
    narrator.speak({
      category: 'navigation',
      values: { title: ctx.t(record.title, record.title) }
    });
  });
}

function wireSettings(ctx: AppContext): void {
  ctx.settings.onChange((change) => {
    const control = ctx.registry.settingControl(change.id);
    const name = control ? ctx.t(control.label, control.label) : change.id;
    narrator.speak({
      category: 'settings',
      values: { title: name, body: describe(change.value) }
    });
  });
}

function describe(value: unknown): string {
  if (value === null || value === undefined) return 'not set';
  if (typeof value === 'boolean') return value ? 'on' : 'off';
  if (typeof value === 'object') return 'a structured value';
  return String(value);
}

/**
 * Speaks the one startup line, once the machine has actually answered about its
 * voices.
 *
 * Speaking at `init` would speak into an empty voice list on most platforms and
 * be logged as "no installed voice can read the selected language", which is
 * true at that instant and misleading a second later.
 */
function wireStartupLine(ctx: AppContext): void {
  let spoken = false;
  const attempt = (): void => {
    if (spoken) return;
    if (!narrator.enabled()) return;
    const state = voiceRegistry.listState();
    if (state === 'pending') return;
    spoken = true;
    if (state !== 'ready') return;
    narrator.speak({
      category: 'lifecycle',
      frameKey: 'narrator.event.ready',
      frameFallback: '{title} is ready',
      values: { title: ctx.studio.info.productName }
    });
  };
  voiceRegistry.onChange(attempt);
  window.setTimeout(attempt, 2500);
}

/**
 * Reports, once, when the narrator was asked to speak and genuinely cannot.
 *
 * Silence with no explanation is the failure mode this feature has to avoid
 * hardest: a listener who turned the narrator on and hears nothing has no way
 * to tell a broken feature from a machine with no voices installed.
 */
function reportUnavailability(ctx: AppContext): void {
  let reported = false;
  const check = (): void => {
    if (reported) return;
    if (!narrator.enabled()) return;

    if (!voiceRegistry.supported()) {
      reported = true;
      ctx.notify.show({
        title: ctx.t('narrator.notify.unsupportedTitle', 'This build cannot speak'),
        body: ctx.t(
          'narrator.notify.unsupportedBody',
          'There is no speech synthesis available to this window, so the narrator has nothing to speak with. Your settings were left exactly as they are.'
        ),
        severity: 'warning',
        source: 'narrator'
      });
      return;
    }

    if (voiceRegistry.listState() === 'pending') return;

    for (const language of narrator.languages()) {
      if (voiceRegistry.forLanguage(language).length > 0) continue;
      reported = true;
      const name = language === 'en' ? ctx.t('narrator.mode.en', 'English') : ctx.t('narrator.mode.yue', 'Cantonese');
      ctx.notify.show({
        title: ctx.t('narrator.notify.noVoiceTitle', 'No voice for that language'),
        body: ctx.t(
          'narrator.notify.noVoiceBody',
          'This computer has no installed voice that can read {language}, so that track will stay silent. Installing one in the operating system speech settings is what fixes it.',
          { values: { language: name } }
        ),
        severity: 'warning',
        source: 'narrator'
      });
      return;
    }
  };

  voiceRegistry.onChange(check);
  ctx.settings.onChange((change) => {
    if (change.id === NARRATOR_ENABLED_ID) {
      reported = false;
      check();
    }
  });
  window.setTimeout(check, 3000);
}

/**
 * Registers the palette commands that need a live context, and re-registers
 * them whenever the study mode changes.
 *
 * The Cantonese entries are ADDED AND REMOVED rather than disabled: while the
 * study mode is on, Cantonese narration must behave as though it were not
 * installed, and a greyed-out palette row still announces that the capability
 * exists.
 */
function registerCommands(ctx: AppContext): void {
  let release: (() => void) | null = null;

  const draw = (): void => {
    release?.();
    const school = ctx.i18n.schoolModeActive();
    release = ctx.palette.add([
      {
        id: 'narrator.command.toggle',
        title: 'narrator.palette.toggle',
        icon: 'bolt',
        kind: 'command',
        keywords: ['narrator', 'on', 'off', 'mute', 'speak'],
        run: () => {
          const next = !narrator.enabled();
          ctx.settings.set(NARRATOR_ENABLED_ID, next);
          if (!next) narrator.cancelAll('The narrator was switched off.');
          ctx.notify.show({
            title: ctx.t('narrator.enabled', 'Speak application events aloud'),
            body: next
              ? ctx.t('narrator.state.idle', 'Ready, and not speaking.')
              : ctx.t('narrator.action.stop', 'Stop speaking'),
            severity: 'info',
            // Marked as this feature's own, so the notification the narrator
            // raised is never itself read aloud.
            source: 'narrator'
          });
        }
      },
      {
        id: 'narrator.command.sampleEn',
        title: 'narrator.palette.sampleEn',
        icon: 'play',
        kind: 'command',
        keywords: ['sample', 'preview', 'english', 'voice'],
        run: () => narrator.preview('en', sampleFor(ctx, 'en'))
      },
      ...(school
        ? []
        : [
            {
              id: 'narrator.command.voiceYue',
              title: 'narrator.palette.voiceYue',
              icon: 'play',
              kind: 'destination' as const,
              keywords: ['voice', 'cantonese', 'narrator', '廣東話'],
              teleport: { tabId: 'narrator.home', elementId: 'narrator-voice-yue' }
            },
            {
              id: 'narrator.command.sampleYue',
              title: 'narrator.palette.sampleYue',
              icon: 'play',
              kind: 'command' as const,
              keywords: ['sample', 'preview', 'cantonese', 'voice', '廣東話'],
              run: () => narrator.preview('yue', sampleFor(ctx, 'yue'))
            }
          ])
    ]);
  };

  draw();
  ctx.i18n.onChange(draw);
}

export default defineFeature({
  id: 'narrator',
  name: 'Narrator',
  description:
    'Speaks application events aloud in English, Cantonese or both, one line at a time, with a voice picker per language. Off until it is switched on.',
  strings: NARRATOR_STRINGS,
  docs: NARRATOR_DOCS,
  settings: narratorSettingsSections(),
  tabs: [
    {
      id: 'narrator.home',
      title: 'narrator.tab.title',
      icon: 'play',
      group: 'group.personalisation',
      order: 140,
      mount: mountNarratorPanel
    }
  ],
  palette: [
    {
      id: 'narrator.command.open',
      title: 'narrator.palette.open',
      icon: 'play',
      kind: 'destination',
      keywords: ['narrator', 'speech', 'voice', 'speak', 'tts', '旁白'],
      teleport: { tabId: 'narrator.home' }
    },
    {
      id: 'narrator.command.voiceEn',
      title: 'narrator.palette.voiceEn',
      icon: 'play',
      kind: 'destination',
      keywords: ['voice', 'english', 'narrator', 'rate', 'pitch'],
      teleport: { tabId: 'narrator.home', elementId: 'narrator-voice-en' }
    },
    {
      id: 'narrator.command.stop',
      title: 'narrator.palette.stop',
      icon: 'stop',
      kind: 'command',
      keywords: ['stop', 'silence', 'quiet', 'narrator'],
      run: () => narrator.cancelAll('You asked it to stop from the command palette.')
    }
  ],
  init(ctx: AppContext) {
    installNarratorStyles();

    // Rate and pitch are edited inside the voice picker rather than as their own
    // settings rows, so their defaults are declared here — otherwise a reset
    // would have no compiled-in value to restore and the provenance line would
    // have nothing truthful to name.
    for (const language of ['en', 'yue'] as NarratedLanguage[]) {
      ctx.settings.declareDefault(rateSettingId(language), SPEECH_RANGES.rate.default);
      ctx.settings.declareDefault(pitchSettingId(language), SPEECH_RANGES.pitch.default);
      ctx.settings.declareDefault(voiceSettingId(language), '');
    }

    narrator.attach(ctx);

    wireNotifications(ctx);
    wireNavigation(ctx);
    wireSettings(ctx);
    wireStartupLine(ctx);
    reportUnavailability(ctx);

    registerCommands(ctx);

    window.addEventListener('beforeunload', () => narrator.detach());
  }
});
