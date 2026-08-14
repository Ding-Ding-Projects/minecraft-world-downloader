/**
 * Scheduled language, appearance and external settings sources.
 *
 * One directory, one default export, nothing outside it touched. The engine does
 * the work; this file is the declaration of what the rest of the application can
 * see: a tab, a settings section, palette entries, a documentation article and
 * the feature's own copy.
 */

import './styles.css';

import { article } from './docs';
import { el } from './dom';
import {
  ENABLED_SETTING_ID,
  NOTIFY_SETTING_ID,
  RULES_SETTING_ID,
  ScheduleEngine,
  TICK_SECONDS_SETTING_ID,
  TIMEOUT_SETTING_ID
} from './engine';
import { describeWindow } from './evaluate';
import { mountSchedulePanel, mountScheduleSummary } from './panel';
import { LIMITS } from './schema';
import { strings } from './strings';
import { defineFeature } from '../../core/registry';
import type { AppContext, SettingContext, TabContext } from '../../core/registry';

const TAB_ID = 'scheduled-settings.schedule';

/**
 * The single engine for the window, and the context it was given.
 *
 * Both are created in `init`, which the registry runs after every module has
 * registered, so the set of schedulable settings is already complete the first
 * time a rule is evaluated.
 */
let engine: ScheduleEngine | null = null;
let appCtx: AppContext | null = null;

/** An honest placeholder for the case where the engine genuinely is not running. */
function notRunning(ctx: AppContext): HTMLElement {
  return el('p', {
    className: 'md-typescale-body-medium',
    text: ctx.t(
      'schedule.notRunning',
      'The schedule engine did not start, so no rule is running and no setting is being held. Reopening the application will try again.'
    )
  });
}

export default defineFeature({
  id: 'scheduled-settings',
  name: 'Scheduled settings',
  description:
    'Schedules the language mode, every appearance value and every other setting this application registers, from local values, a validated HTTPS endpoint or a Home Assistant boolean entity.',

  strings,
  docs: [article],

  tabs: [
    {
      id: TAB_ID,
      title: 'schedule.tab.title',
      icon: 'calendar',
      group: 'group.personalisation',
      order: 140,
      mount(host: HTMLElement, ctx: TabContext) {
        if (!engine) {
          host.append(notRunning(ctx));
          return;
        }
        mountSchedulePanel(host, ctx, engine);
      }
    }
  ],

  settings: [
    {
      id: 'scheduled-settings',
      title: 'schedule.section.title',
      icon: 'calendar',
      order: 140,
      controls: [
        {
          id: ENABLED_SETTING_ID,
          label: 'schedule.setting.enabled',
          description: 'schedule.setting.enabledDesc',
          kind: 'switch',
          defaultValue: true,
          keywords: ['schedule', 'timer', 'automation', 'rules', 'when']
        },
        {
          id: TICK_SECONDS_SETTING_ID,
          label: 'schedule.setting.tick',
          description: 'schedule.setting.tickDesc',
          kind: 'slider',
          defaultValue: 30,
          min: 10,
          max: 300,
          step: 5,
          hint: 's',
          keywords: ['schedule', 'interval', 'check', 'poll'],
          validate: (value) => {
            const numeric = Number(value);
            if (!Number.isFinite(numeric)) return 'Enter a number of seconds.';
            if (numeric < 10 || numeric > 300) return 'Choose between 10 and 300 seconds.';
            return null;
          }
        },
        {
          id: NOTIFY_SETTING_ID,
          label: 'schedule.setting.notify',
          description: 'schedule.setting.notifyDesc',
          kind: 'switch',
          defaultValue: true,
          keywords: ['schedule', 'notification', 'toast', 'announce']
        },
        {
          id: TIMEOUT_SETTING_ID,
          label: 'schedule.setting.timeout',
          description: 'schedule.setting.timeoutDesc',
          kind: 'number',
          defaultValue: 8000,
          min: LIMITS.minTimeoutMs,
          max: LIMITS.maxTimeoutMs,
          step: 500,
          hint: 'ms',
          keywords: ['schedule', 'network', 'timeout', 'http', 'home assistant'],
          validate: (value) => {
            const numeric = Number(value);
            if (!Number.isFinite(numeric)) return 'Enter a number of milliseconds.';
            if (numeric < LIMITS.minTimeoutMs || numeric > LIMITS.maxTimeoutMs) {
              return `Choose between ${LIMITS.minTimeoutMs} and ${LIMITS.maxTimeoutMs} milliseconds.`;
            }
            return null;
          }
        },
        {
          id: RULES_SETTING_ID,
          label: 'schedule.setting.rules',
          description: 'schedule.setting.rulesDesc',
          kind: 'custom',
          defaultValue: null,
          keywords: ['schedule', 'rules', 'window', 'weekday', 'home assistant', 'endpoint'],
          // A live summary plus the real route to the editor, rather than a text
          // box holding a JSON document nobody can safely hand-edit.
          render(host: HTMLElement, ctx: SettingContext) {
            if (!engine) {
              host.append(notRunning(ctx));
              return;
            }
            mountScheduleSummary(host, ctx, engine);
          }
        },
        {
          id: 'schedule.openEditor',
          label: 'schedule.setting.openEditor',
          description: 'schedule.setting.openEditorDesc',
          kind: 'action',
          defaultValue: null,
          keywords: ['schedule', 'open', 'editor', 'rules'],
          run(ctx: SettingContext) {
            ctx.tabs.teleport(TAB_ID, 'schedule-rules');
          }
        },
        {
          id: 'schedule.deleteAll',
          label: 'schedule.setting.deleteAll',
          description: 'schedule.setting.deleteAllDesc',
          kind: 'action',
          defaultValue: null,
          keywords: ['schedule', 'delete', 'remove', 'clear'],
          async run(ctx: SettingContext) {
            if (!engine) return;
            const active = engine;
            const rules = active.rules();
            if (rules.length === 0) {
              ctx.notify.info(
                ctx.t('schedule.setting.deleteAll', 'Delete every rule'),
                ctx.t('schedule.empty.title', 'No rules yet')
              );
              return;
            }
            const anchor =
              (document.getElementById('schedule-rules') as HTMLElement | null) ??
              (document.querySelector('.wds-content') as HTMLElement | null) ??
              document.body;
            const confirmed = await ctx.confirm.request({
              action: ctx.t('schedule.confirm.deleteAll', 'Delete every schedule rule'),
              affected: rules.map((rule) => `${rule.label} — ${describeWindow(rule)}`),
              irreversible: ctx.t(
                'schedule.confirm.deleteIrreversible',
                'The rules are removed from the schedule and any Home Assistant token stored for them is deleted from the credential vault. Settings a rule was holding are handed back to their base values first. The deletion is recorded in the local version history, which is the only place a copy remains.'
              ),
              anchor,
              confirmLabel: ctx.t('schedule.action.delete', 'Delete')
            });
            if (!confirmed) return;
            active.releaseAll(ctx.t('schedule.confirm.deleteAll', 'Delete every schedule rule'));
            active.deleteRules(
              rules.map((rule) => rule.id),
              'Every schedule rule deleted'
            );
          }
        }
      ]
    }
  ],

  palette: [
    {
      id: 'scheduled-settings.open',
      title: 'schedule.palette.open',
      kind: 'destination',
      icon: 'calendar',
      keywords: ['schedule', 'timer', 'when', 'rules', 'automation', 'appearance', 'language'],
      teleport: { tabId: TAB_ID, elementId: 'schedule-rules' }
    },
    {
      id: 'scheduled-settings.new',
      title: 'schedule.palette.new',
      kind: 'command',
      icon: 'add',
      keywords: ['schedule', 'new', 'rule', 'create'],
      run: () => {
        // The palette presses the tab's own control rather than opening a second,
        // divergent creation path that could drift from it.
        appCtx?.tabs.teleport(TAB_ID, 'schedule-new-rule');
        window.setTimeout(() => document.getElementById('schedule-new-rule')?.click(), 120);
      }
    },
    {
      id: 'scheduled-settings.refresh',
      title: 'schedule.palette.refresh',
      kind: 'command',
      icon: 'refresh',
      keywords: ['schedule', 'refresh', 'endpoint', 'home assistant', 'source'],
      run: () => {
        void engine?.refreshAll();
      }
    },
    {
      id: 'scheduled-settings.release',
      title: 'schedule.palette.release',
      kind: 'command',
      icon: 'stop',
      keywords: ['schedule', 'release', 'restore', 'base'],
      run: () => {
        engine?.releaseAll('Released from the command palette.');
      }
    },
    {
      id: 'scheduled-settings.docs',
      title: 'schedule.palette.docs',
      kind: 'command',
      icon: 'book',
      keywords: ['schedule', 'documentation', 'help', 'how'],
      run: () => {
        appCtx?.docsService.open(article.id);
      }
    },
    {
      id: 'scheduled-settings.enabled',
      title: 'schedule.setting.enabled',
      kind: 'setting',
      settingId: ENABLED_SETTING_ID,
      keywords: ['schedule', 'on', 'off', 'run']
    },
    {
      id: 'scheduled-settings.tick',
      title: 'schedule.setting.tick',
      kind: 'setting',
      settingId: TICK_SECONDS_SETTING_ID,
      keywords: ['schedule', 'interval', 'seconds']
    },
    {
      id: 'scheduled-settings.notify',
      title: 'schedule.setting.notify',
      kind: 'setting',
      settingId: NOTIFY_SETTING_ID,
      keywords: ['schedule', 'notification']
    },
    {
      id: 'scheduled-settings.timeout',
      title: 'schedule.setting.timeout',
      kind: 'setting',
      settingId: TIMEOUT_SETTING_ID,
      keywords: ['schedule', 'timeout', 'network']
    }
  ],

  init(ctx: AppContext) {
    appCtx = ctx;
    engine = new ScheduleEngine(ctx);
    engine.start();

    // A School-mode change withdraws or restores the language keys, so the
    // decision is recomputed rather than waiting for the next interval.
    ctx.i18n.onChange(() => engine?.tick());

    // The window closing is the one moment a borrowed setting could be stranded,
    // so the base values are flushed to disk before the process goes away. They
    // are already written on every change; this makes the last write certain.
    ctx.studio.events.on('app:before-quit', () => {
      void ctx.settings.flush();
    });
  }
});
