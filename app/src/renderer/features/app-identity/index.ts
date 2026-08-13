import './styles.css';

import { defineFeature } from '../../core/registry';
import type { AppContext, SettingContext } from '../../core/registry';
import { SECTION_IDS, mountAbout } from './about';
import { CREDIT_STRINGS } from './credits';
import { ARTICLES } from './docs';
import {
  CODE_NAME_SETTING,
  DIAGNOSTICS_CHOSEN_SETTING,
  DIAGNOSTICS_REDACT_SETTING,
  DISPLAY_NAME_SETTING,
  chosenName,
  diagnosticReport,
  shippedName
} from './identity';
import { STRINGS } from './strings';

/**
 * Application identity: the name it calls itself, and everything that name is
 * deliberately not attached to.
 *
 * The rename itself writes exactly one settings key, `app.displayName`, which
 * the core shell already reads for the title bar. This feature does not
 * register a second control for that value — two ids for one value is how two
 * surfaces come to disagree about what the value is — so it reads and writes
 * that key and owns the surface around it: the editor, the live preview, the
 * runtime identity checks, the licence, the credits and the diagnostic report.
 */

const TAB_ID = 'app-identity.about';

/** Captured at boot so the palette commands can reach the services. */
let appContext: AppContext | null = null;

async function restoreShippedName(ctx: AppContext): Promise<void> {
  const previous = chosenName(ctx);
  if (previous === '') {
    ctx.notify.info(
      ctx.t('app-identity.name.alreadyShipped', 'It is already using the shipped name {name}. Nothing was changed.', {
        values: { name: shippedName(ctx) }
      })
    );
    return;
  }
  ctx.settings.reset(DISPLAY_NAME_SETTING);
  await ctx.history.record('Restored the shipped application name', 'app-identity', {
    from: previous,
    to: null,
    shippedName: shippedName(ctx)
  });
  ctx.notify.success(
    ctx.t('app-identity.name.resetDone', 'The shipped name is back: {name}', { values: { name: shippedName(ctx) } }),
    ctx.t(
      'app-identity.name.resetBody',
      'Your previous name was "{previous}". The change is in the local version history, so you can read it back or type that name again.',
      { values: { previous } }
    )
  );
}

async function copyDiagnosticReport(ctx: AppContext): Promise<void> {
  try {
    await navigator.clipboard.writeText(diagnosticReport(ctx));
    ctx.notify.success(ctx.t('app-identity.diagnostics.copied', 'The report is on the clipboard'));
  } catch (error) {
    ctx.notify.error(
      ctx.t('app-identity.bulk.copyFailed', 'The clipboard refused the text: {reason}', {
        values: { reason: error instanceof Error ? error.message : String(error) }
      })
    );
  }
}

export default defineFeature({
  id: 'app-identity',
  name: 'Application identity',
  description:
    'The name the application calls itself, an About surface carrying the version, licence and credits, and runtime checks proving a rename moves nothing but the label.',

  strings: { ...STRINGS, ...CREDIT_STRINGS },

  tabs: [
    {
      id: TAB_ID,
      title: 'app-identity.tab',
      icon: 'info',
      order: 800,
      mount: mountAbout
    }
  ],

  settings: [
    {
      id: 'app-identity.settings',
      title: 'app-identity.section.settings',
      icon: 'info',
      order: 140,
      controls: [
        {
          id: 'app-identity.openAbout',
          label: 'app-identity.setting.openAbout',
          description: 'app-identity.setting.openAbout.description',
          kind: 'action',
          defaultValue: null,
          keywords: ['about', 'version', 'licence', 'license', 'credits', 'identity', '關於'],
          run: (ctx: SettingContext) => {
            ctx.tabs.teleport(TAB_ID, SECTION_IDS.name);
          }
        },
        {
          id: 'app-identity.resetName',
          label: 'app-identity.setting.resetName',
          description: 'app-identity.setting.resetName.description',
          kind: 'action',
          defaultValue: null,
          keywords: ['rename', 'name', 'title', 'reset', 'restore', '改名'],
          run: (ctx: SettingContext) => restoreShippedName(ctx)
        },
        {
          id: DIAGNOSTICS_CHOSEN_SETTING,
          label: 'app-identity.setting.includeChosen',
          description: 'app-identity.setting.includeChosen.description',
          kind: 'switch',
          defaultValue: false,
          keywords: ['diagnostic', 'report', 'crash', 'issue', 'name'],
          validate: (value) => (typeof value === 'boolean' ? null : 'This setting is on or off.')
        },
        {
          id: DIAGNOSTICS_REDACT_SETTING,
          label: 'app-identity.setting.redactPaths',
          description: 'app-identity.setting.redactPaths.description',
          kind: 'switch',
          defaultValue: true,
          keywords: ['diagnostic', 'report', 'path', 'privacy', 'account'],
          validate: (value) => (typeof value === 'boolean' ? null : 'This setting is on or off.')
        }
      ]
    }
  ],

  palette: [
    {
      id: 'app-identity.destination.about',
      title: 'app-identity.palette.about',
      icon: 'info',
      kind: 'destination',
      keywords: ['about', 'version', 'identity', 'licence', 'license', '關於'],
      teleport: { tabId: TAB_ID }
    },
    {
      id: 'app-identity.destination.rename',
      title: 'app-identity.palette.rename',
      icon: 'edit',
      kind: 'destination',
      keywords: ['rename', 'display name', 'title bar', 'call it', '改名'],
      teleport: { tabId: TAB_ID, elementId: 'app-identity-name-field' }
    },
    {
      id: 'app-identity.destination.checks',
      title: 'app-identity.palette.checks',
      icon: 'success',
      kind: 'destination',
      keywords: ['identity', 'checks', 'data directory', 'package', 'evidence'],
      teleport: { tabId: TAB_ID, elementId: SECTION_IDS.checks }
    },
    {
      id: 'app-identity.destination.credits',
      title: 'app-identity.palette.credits',
      icon: 'book',
      kind: 'destination',
      keywords: ['credits', 'licence', 'license', 'attribution', 'thanks', 'funding'],
      teleport: { tabId: TAB_ID, elementId: SECTION_IDS.credits }
    },
    {
      id: 'app-identity.command.copyReport',
      title: 'app-identity.palette.copyReport',
      icon: 'copy',
      kind: 'command',
      keywords: ['diagnostic', 'report', 'issue', 'crash', 'versions'],
      run: () => {
        if (!appContext) return;
        return copyDiagnosticReport(appContext);
      }
    },
    {
      id: 'app-identity.command.resetName',
      title: 'app-identity.palette.resetName',
      icon: 'refresh',
      kind: 'command',
      keywords: ['rename', 'reset', 'restore', 'shipped name'],
      run: () => {
        if (!appContext) return;
        return restoreShippedName(appContext);
      }
    },
    {
      id: 'app-identity.setting.includeChosen',
      title: 'app-identity.setting.includeChosen',
      icon: 'tune',
      kind: 'setting',
      settingId: DIAGNOSTICS_CHOSEN_SETTING,
      keywords: ['diagnostic', 'report', 'name']
    },
    {
      id: 'app-identity.setting.redactPaths',
      title: 'app-identity.setting.redactPaths',
      icon: 'tune',
      kind: 'setting',
      settingId: DIAGNOSTICS_REDACT_SETTING,
      keywords: ['diagnostic', 'report', 'path', 'privacy']
    }
  ],

  docs: ARTICLES,

  init(ctx: AppContext) {
    appContext = ctx;
    // Declared so the code name has a real compiled-in default behind it: the
    // provenance line can then name that value, and a reset restores it rather
    // than deleting the key and hoping every reader agrees on the fallback.
    ctx.settings.declareDefault(CODE_NAME_SETTING, '');
    ctx.settings.declareDefault(DIAGNOSTICS_CHOSEN_SETTING, false);
    ctx.settings.declareDefault(DIAGNOSTICS_REDACT_SETTING, true);
  }
});
