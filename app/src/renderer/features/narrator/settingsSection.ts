import { el } from '../../core/a11y';
import type { SettingsSection } from '../../core/registry';
import { insideQuietHours } from './engine';
import {
  CATEGORIES,
  NARRATOR_DEBOUNCE_ID,
  NARRATOR_DUCK_VOLUME_ID,
  NARRATOR_DUCK_WINDOW_ID,
  NARRATOR_ENABLED_ID,
  NARRATOR_LOG_LIMIT_ID,
  NARRATOR_MODE_ID,
  NARRATOR_QUIET_ENABLED_ID,
  NARRATOR_QUIET_FROM_ID,
  NARRATOR_QUIET_TO_ID,
  NARRATOR_SCREEN_READER_ID,
  NARRATOR_VOLUME_ID,
  SPEECH_RANGES,
  categoryCooldownId,
  categoryEnabledId,
  voiceSettingId
} from './model';
import { createVoicePicker } from './voicepicker';

/**
 * The narrator's settings rows.
 *
 * Three of these are `custom` rather than a plain select, and each for the same
 * reason: while the study mode is on, Cantonese and bilingual narration must
 * behave as though they were NOT INSTALLED. A disabled control still tells the
 * user the capability exists, so the control is omitted entirely and a sentence
 * explains that the stored choice is being kept for when the mode goes off.
 */

function validClock(value: unknown): string | null {
  if (typeof value !== 'string') return 'Write the time as HH:MM, for example 22:00.';
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return 'Write the time as HH:MM, for example 22:00. Nothing was changed.';
  if (Number(match[1]) > 23 || Number(match[2]) > 59) {
    return 'Hours run 0 to 23 and minutes 0 to 59. Nothing was changed.';
  }
  return null;
}

export function narratorSettingsSections(): SettingsSection[] {
  return [
    {
      id: 'narrator.main',
      title: 'narrator.section',
      icon: 'play',
      order: 120,
      controls: [
        {
          id: NARRATOR_ENABLED_ID,
          label: 'narrator.enabled',
          description: 'narrator.enabled.description',
          kind: 'switch',
          defaultValue: false,
          keywords: ['narrator', 'speech', 'speak', 'voice', 'tts', 'read aloud', '旁白', '讀出']
        },
        {
          id: NARRATOR_MODE_ID,
          label: 'narrator.mode',
          description: 'narrator.mode.description',
          kind: 'custom',
          defaultValue: 'en',
          keywords: ['language', 'english', 'cantonese', 'both', 'narrated'],
          render(host, ctx) {
            if (ctx.i18n.schoolModeActive()) {
              host.append(
                el('p', {
                  className: 'md-typescale-body-small',
                  text: ctx.t(
                    'narrator.school.note',
                    'The narrator is speaking English only, because the study mode is on.'
                  )
                })
              );
              return;
            }
            const handle = ctx.components.segmentedButton({
              label: 'narrator.mode',
              options: [
                { value: 'en', label: 'narrator.mode.en' },
                { value: 'yue', label: 'narrator.mode.yue' },
                { value: 'both', label: 'narrator.mode.both' }
              ],
              value: ctx.settings.get<string>(NARRATOR_MODE_ID, 'en'),
              onChange: (value) => ctx.setValue(value)
            });
            host.append(handle.root);
          }
        },
        {
          id: voiceSettingId('en'),
          label: 'narrator.voice.en',
          description: 'narrator.voice.description',
          kind: 'custom',
          defaultValue: '',
          keywords: ['voice', 'english', 'speaker', 'rate', 'pitch'],
          render(host, ctx) {
            const picker = createVoicePicker(ctx, 'en', { idPrefix: 'narrator-setting-voice' });
            host.append(picker.root);
            host.addEventListener('md-dispose', () => picker.destroy());
          }
        },
        {
          id: voiceSettingId('yue'),
          label: 'narrator.voice.yue',
          description: 'narrator.voice.description',
          kind: 'custom',
          defaultValue: '',
          keywords: ['voice', 'cantonese', 'speaker', 'rate', 'pitch', '廣東話'],
          render(host, ctx) {
            if (ctx.i18n.schoolModeActive()) {
              host.append(
                el('p', {
                  className: 'md-typescale-body-small',
                  text: ctx.t(
                    'narrator.school.note',
                    'The narrator is speaking English only, because the study mode is on.'
                  )
                })
              );
              return;
            }
            const picker = createVoicePicker(ctx, 'yue', { idPrefix: 'narrator-setting-voice' });
            host.append(picker.root);
            host.addEventListener('md-dispose', () => picker.destroy());
          }
        },
        {
          id: NARRATOR_VOLUME_ID,
          label: 'narrator.volume',
          description: 'narrator.volume.description',
          kind: 'slider',
          defaultValue: SPEECH_RANGES.volume.default,
          min: SPEECH_RANGES.volume.min,
          max: SPEECH_RANGES.volume.max,
          step: SPEECH_RANGES.volume.step,
          keywords: ['volume', 'loud', 'quiet']
        },
        {
          id: NARRATOR_DEBOUNCE_ID,
          label: 'narrator.debounce',
          description: 'narrator.debounce.description',
          kind: 'number',
          defaultValue: 400,
          min: 0,
          max: 5000,
          step: 50,
          hint: 'milliseconds',
          keywords: ['debounce', 'wait', 'delay', 'burst']
        },
        {
          id: NARRATOR_SCREEN_READER_ID,
          label: 'narrator.screenReader',
          description: 'narrator.screenReader.description',
          kind: 'select',
          defaultValue: 'auto',
          keywords: ['screen reader', 'accessibility', 'duck', 'yield', 'nvda', 'jaws', 'voiceover'],
          options: [
            { value: 'auto', label: 'narrator.screenReader.auto' },
            { value: 'duck', label: 'narrator.screenReader.duck' },
            { value: 'silent', label: 'narrator.screenReader.silent' },
            { value: 'off', label: 'narrator.screenReader.off' }
          ]
        },
        {
          id: NARRATOR_DUCK_VOLUME_ID,
          label: 'narrator.duckVolume',
          description: 'narrator.duckVolume.description',
          kind: 'slider',
          defaultValue: 0.45,
          min: 0.05,
          max: 1,
          step: 0.05,
          keywords: ['duck', 'quieter', 'screen reader']
        },
        {
          id: NARRATOR_DUCK_WINDOW_ID,
          label: 'narrator.duckWindow',
          description: 'narrator.duckWindow.description',
          kind: 'number',
          defaultValue: 1600,
          min: 0,
          max: 10000,
          step: 100,
          hint: 'milliseconds',
          keywords: ['duck', 'wait', 'announcement']
        },
        {
          id: NARRATOR_QUIET_ENABLED_ID,
          label: 'narrator.quiet.enabled',
          description: 'narrator.quiet.enabled.description',
          kind: 'switch',
          defaultValue: false,
          keywords: ['quiet', 'night', 'do not disturb', 'hours']
        },
        {
          id: NARRATOR_QUIET_FROM_ID,
          label: 'narrator.quiet.from',
          description: 'narrator.quiet.time.description',
          kind: 'text',
          defaultValue: '22:00',
          hint: 'HH:MM',
          keywords: ['quiet', 'from', 'start'],
          validate: validClock
        },
        {
          id: NARRATOR_QUIET_TO_ID,
          label: 'narrator.quiet.to',
          description: 'narrator.quiet.time.description',
          kind: 'text',
          defaultValue: '07:00',
          hint: 'HH:MM',
          keywords: ['quiet', 'until', 'end'],
          validate: validClock
        },
        {
          // A live readout of whether the window is in force right now, because
          // two times and a switch do not tell anybody what is true at this
          // moment — and "it went quiet and I do not know why" is exactly the
          // question this answers.
          id: 'narrator.quiet.state',
          label: 'narrator.quiet.enabled',
          description: 'narrator.quiet.enabled.description',
          kind: 'custom',
          defaultValue: null,
          lockable: false,
          lockableReason: 'It is a readout rather than a control, so there is nothing for a lock to protect.',
          keywords: ['quiet', 'now', 'status'],
          render(host, ctx) {
            const line = el('p', {
              className: 'md-typescale-body-small',
              attrs: { role: 'status', 'aria-live': 'polite' }
            });
            const refresh = (): void => {
              const on = ctx.settings.get<boolean>(NARRATOR_QUIET_ENABLED_ID, false) === true;
              const from = ctx.settings.get<string>(NARRATOR_QUIET_FROM_ID, '22:00');
              const to = ctx.settings.get<string>(NARRATOR_QUIET_TO_ID, '07:00');
              if (!on) {
                line.textContent = ctx.t('narrator.state.idle', 'Quiet hours are switched off.');
                return;
              }
              line.textContent = insideQuietHours(from, to)
                ? ctx.t('narrator.state.silent', 'Silent: {reason}', {
                    values: { reason: `quiet hours are in force now (${from} to ${to}, local time)` }
                  })
                : ctx.t('narrator.state.idle', 'Ready, and not speaking.');
            };
            host.append(line);
            refresh();

            // Releases itself once the row leaves the document, so a rebuilt
            // settings surface does not leave a live timer behind each time.
            let stop = (): void => undefined;
            const timer = window.setInterval(() => {
              if (!line.isConnected) {
                stop();
                window.clearInterval(timer);
                return;
              }
              refresh();
            }, 30000);
            stop = ctx.settings.onChange((change) => {
              if (!line.isConnected) {
                stop();
                window.clearInterval(timer);
                return;
              }
              if (change.id.startsWith('narrator.quiet.')) refresh();
            });
            host.addEventListener('md-dispose', () => {
              stop();
              window.clearInterval(timer);
            });
          }
        },
        {
          id: NARRATOR_LOG_LIMIT_ID,
          label: 'narrator.log.limit',
          description: 'narrator.log.limit.description',
          kind: 'number',
          defaultValue: 200,
          min: 20,
          max: 2000,
          step: 10,
          keywords: ['log', 'history', 'lines']
        }
      ]
    },
    {
      id: 'narrator.categories',
      title: 'narrator.section.categories',
      icon: 'tune',
      order: 121,
      controls: CATEGORIES.flatMap((category) => [
        {
          id: categoryEnabledId(category.id),
          label: category.label,
          description: category.description,
          kind: 'switch' as const,
          defaultValue: category.enabledByDefault,
          keywords: ['narrator', 'category', category.id]
        },
        {
          id: categoryCooldownId(category.id),
          label: `narrator.cooldown.${category.id}`,
          description: 'narrator.cooldown.description',
          kind: 'number' as const,
          defaultValue: category.cooldownMs,
          min: 0,
          max: 600000,
          step: 500,
          hint: 'milliseconds',
          keywords: ['narrator', 'cooldown', 'gap', category.id],
          validate: (value: unknown) =>
            category.neverSuppressed && Number(value) > 0
              ? 'This category is never held back, so a gap here would have no effect. Nothing was changed.'
              : null
        }
      ])
    }
  ];
}
