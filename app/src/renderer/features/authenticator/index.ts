/**
 * The authenticator feature module.
 *
 * QR pairing and a built-in time-based one-time code authenticator: the user's
 * own entries for whatever accounts they like, live codes with a countdown and
 * a peek at the next one, and a searchable, groupable, bulk-manageable list.
 *
 * Everything is local. There is no account, no synchronization, no telemetry and
 * no network request anywhere in this feature — the QR is drawn in this process
 * and read in this process, because a pairing picture contains the secret.
 */

import './styles.css';

import type { AppContext, FeatureModule, SettingsSection } from '../../core/registry';
import {
  CLOCK_OFFSET_ID,
  CLOCK_WARN_ID,
  startClockWatch
} from './clock';
import { AUTHENTICATOR_DOCS } from './docs';
import { ALGORITHMS, DEFAULTS, LIMITS } from './model';
import {
  HIDE_CODES_ID,
  SHOW_NEXT_ID,
  exportSecrets,
  mountChecks,
  mountEntries,
  openClockCheck
} from './panel';
import {
  DEFAULT_ALGORITHM_ID,
  DEFAULT_DIGITS_ID,
  DEFAULT_PERIOD_ID,
  QR_MODULE_SIZE_ID,
  openRegistration
} from './register';
import { runSelfTest } from './selftest';
import { AUTHENTICATOR_STRINGS } from './strings';
import { attachStore, store } from './store';

const TAB_ENTRIES = 'authenticator.entries';
const TAB_CHECKS = 'authenticator.checks';

/**
 * The application context, kept for the palette commands.
 *
 * Palette entries are declared before `init` runs and are invoked long after, so
 * they need a handle on the context. Every one of them checks it rather than
 * assuming, so a command invoked before boot finishes does nothing instead of
 * throwing.
 */
let contextRef: AppContext | null = null;

function settingsSection(): SettingsSection {
  return {
    id: 'authenticator',
    title: 'authenticator.settings.section',
    icon: 'key',
    order: 210,
    controls: [
      {
        id: DEFAULT_ALGORITHM_ID,
        label: 'authenticator.settings.defaultAlgorithm',
        description: 'authenticator.settings.defaultAlgorithm.description',
        kind: 'select',
        defaultValue: DEFAULTS.algorithm,
        options: ALGORITHMS.map((algorithm) => ({ value: algorithm, label: algorithm })),
        keywords: ['totp', 'sha', 'hash', 'algorithm', 'authenticator', '演算法'],
        validate: (value) => (ALGORITHMS.includes(value as (typeof ALGORITHMS)[number]) ? null : 'That is not an algorithm this application can compute.')
      },
      {
        id: DEFAULT_DIGITS_ID,
        label: 'authenticator.settings.defaultDigits',
        description: 'authenticator.settings.defaultDigits.description',
        kind: 'select',
        defaultValue: DEFAULTS.digits,
        options: [6, 7, 8].map((digits) => ({ value: String(digits), label: String(digits) })),
        keywords: ['digits', 'length', 'code', 'authenticator', '位數'],
        validate: (value) => {
          const digits = Number(value);
          return Number.isInteger(digits) && digits >= LIMITS.minDigits && digits <= LIMITS.maxDigits
            ? null
            : `Digits must be a whole number from ${LIMITS.minDigits} to ${LIMITS.maxDigits}.`;
        }
      },
      {
        id: DEFAULT_PERIOD_ID,
        label: 'authenticator.settings.defaultPeriod',
        description: 'authenticator.settings.defaultPeriod.description',
        kind: 'number',
        defaultValue: DEFAULTS.period,
        min: LIMITS.minPeriod,
        max: LIMITS.maxPeriod,
        step: 1,
        keywords: ['period', 'seconds', 'interval', 'authenticator', '週期'],
        validate: (value) => {
          const period = Number(value);
          return Number.isInteger(period) && period >= LIMITS.minPeriod && period <= LIMITS.maxPeriod
            ? null
            : `The period must be a whole number of seconds from ${LIMITS.minPeriod} to ${LIMITS.maxPeriod}.`;
        }
      },
      {
        id: HIDE_CODES_ID,
        label: 'authenticator.settings.hideCodes',
        description: 'authenticator.settings.hideCodes.description',
        kind: 'switch',
        defaultValue: false,
        keywords: ['hide', 'mask', 'privacy', 'screen share', 'authenticator']
      },
      {
        id: SHOW_NEXT_ID,
        label: 'authenticator.settings.showNext',
        description: 'authenticator.settings.showNext.description',
        kind: 'switch',
        defaultValue: true,
        keywords: ['next', 'peek', 'preview', 'code', 'authenticator']
      },
      {
        id: QR_MODULE_SIZE_ID,
        label: 'authenticator.settings.qrModuleSize',
        description: 'authenticator.settings.qrModuleSize.description',
        kind: 'slider',
        defaultValue: 6,
        min: 3,
        max: 12,
        step: 1,
        keywords: ['qr', 'pairing', 'size', 'scan', 'authenticator']
      },
      {
        id: CLOCK_WARN_ID,
        label: 'authenticator.settings.clockWarn',
        description: 'authenticator.settings.clockWarn.description',
        kind: 'number',
        defaultValue: 10,
        min: 1,
        max: 120,
        step: 1,
        keywords: ['clock', 'skew', 'drift', 'time', 'authenticator', '時鐘']
      },
      {
        id: CLOCK_OFFSET_ID,
        label: 'authenticator.settings.clockOffset',
        description: 'authenticator.settings.clockOffset.description',
        kind: 'number',
        defaultValue: 0,
        min: -3600,
        max: 3600,
        step: 1,
        keywords: ['clock', 'offset', 'correction', 'time', 'authenticator'],
        validate: (value) => {
          const seconds = Number(value);
          return Number.isFinite(seconds) && Math.abs(seconds) <= 3600
            ? null
            : 'A correction is a whole number of seconds between -3600 and 3600.';
        }
      },
      {
        id: 'authenticator.action.selfTest',
        label: 'authenticator.settings.selfTest',
        description: 'authenticator.settings.selfTest.description',
        kind: 'action',
        defaultValue: null,
        keywords: ['verify', 'test', 'rfc', 'vectors', 'authenticator'],
        run: (ctx) => {
          ctx.tabs.teleport(TAB_CHECKS, 'authenticator-run-checks');
        }
      },
      {
        id: 'authenticator.action.exportSecrets',
        label: 'authenticator.exportSecrets',
        description: 'authenticator.settings.exportSecrets.description',
        kind: 'custom',
        defaultValue: null,
        keywords: ['export', 'secrets', 'backup', 'authenticator'],
        render(host, ctx) {
          const warning = document.createElement('p');
          warning.className = 'md-field__support md-typescale-body-small';
          warning.textContent = ctx.t(
            'authenticator.exportSecrets.warning',
            'This writes every secret in readable form.'
          );
          const button = ctx.components.button({
            label: 'authenticator.exportSecrets',
            variant: 'outlined',
            icon: 'warning',
            danger: true,
            onClick: () => void exportSecrets(ctx, button)
          });
          host.append(button, warning);
        }
      }
    ]
  };
}

const authenticator: FeatureModule = {
  id: 'authenticator',
  name: 'Authenticator',
  description:
    'QR pairing and a built-in time-based one-time code authenticator, entirely local: live codes with a countdown and a next-code peek, a searchable and groupable list, and verification against the published RFC test vectors.',
  strings: AUTHENTICATOR_STRINGS,
  docs: AUTHENTICATOR_DOCS,
  settings: [settingsSection()],
  tabs: [
    {
      id: TAB_ENTRIES,
      title: 'authenticator.title',
      icon: 'key',
      group: 'group.tools',
      order: 300,
      mount: mountEntries
    },
    {
      id: TAB_CHECKS,
      title: 'authenticator.checks.title',
      icon: 'check',
      group: 'group.tools',
      order: 301,
      mount: mountChecks
    }
  ],
  palette: [
    {
      id: 'authenticator.command.open',
      title: 'authenticator.palette.open',
      icon: 'key',
      kind: 'destination',
      keywords: ['authenticator', 'otp', 'totp', 'two factor', '2fa', 'codes', '驗證器'],
      teleport: { tabId: TAB_ENTRIES, elementId: 'authenticator-list' }
    },
    {
      id: 'authenticator.command.add',
      title: 'authenticator.palette.add',
      icon: 'add',
      kind: 'command',
      keywords: ['add', 'register', 'pair', 'qr', 'otp', 'totp', 'authenticator'],
      run: () => {
        // The registration flow anchors beside the control that starts it, so
        // the palette route opens the destination first and then reuses that
        // real control rather than anchoring a dialog to nothing.
        const context = contextRef;
        if (!context) return;
        context.tabs.teleport(TAB_ENTRIES, 'authenticator-add');
        window.setTimeout(() => {
          const anchor = document.getElementById('authenticator-add');
          if (anchor) openRegistration(context, anchor, () => undefined);
        }, 120);
      }
    },
    {
      id: 'authenticator.command.checks',
      title: 'authenticator.palette.checks',
      icon: 'check',
      kind: 'destination',
      keywords: ['verify', 'vectors', 'rfc', 'test', 'authenticator'],
      teleport: { tabId: TAB_CHECKS, elementId: 'authenticator-run-checks' }
    },
    {
      id: 'authenticator.command.runChecks',
      title: 'authenticator.checks.run',
      icon: 'play',
      kind: 'command',
      keywords: ['run', 'verify', 'vectors', 'rfc', 'authenticator'],
      run: async () => {
        const report = await runSelfTest();
        const context = contextRef;
        if (!context) return;
        const summary = context.t('authenticator.checks.summary', '{passed} passed, {failed} failed, in {ms} milliseconds.', {
          values: { passed: report.passed, failed: report.failed, ms: report.totalMs },
          dialog: true
        });
        if (report.failed === 0) {
          context.notify.success(context.t('authenticator.checks.title', 'Verification', { dialog: true }), summary);
        } else {
          context.notify.error(
            context.t('authenticator.checks.title', 'Verification', { dialog: true }),
            `${summary}\n${report.results
              .filter((result) => !result.passed)
              .map((result) => `${result.name}: ${result.detail}`)
              .join('\n')}`
          );
        }
      }
    },
    {
      id: 'authenticator.command.clock',
      title: 'authenticator.palette.clock',
      icon: 'calendar',
      kind: 'command',
      keywords: ['clock', 'time', 'skew', 'drift', 'authenticator'],
      run: () => {
        const context = contextRef;
        if (!context) return;
        context.tabs.teleport(TAB_ENTRIES, 'authenticator-list');
        window.setTimeout(() => {
          const anchor =
            document.getElementById('authenticator-clock-check') ??
            document.getElementById('authenticator-add') ??
            document.body;
          openClockCheck(context, anchor as HTMLElement, () => undefined);
        }, 120);
      }
    },
    {
      id: 'authenticator.command.forget',
      title: 'authenticator.palette.forget',
      icon: 'lock',
      kind: 'command',
      keywords: ['forget', 'memory', 'secrets', 'privacy', 'authenticator'],
      run: () => {
        const context = contextRef;
        if (!context) return;
        store().forgetCachedSecrets();
        context.notify.info(
          context.t('authenticator.privacy.title', 'Where this is kept', { dialog: true }),
          context.t('authenticator.privacy.cached', '{count} secrets are held in this window’s memory so the codes can tick.', {
            values: { count: 0 }
          })
        );
      }
    },
    {
      id: 'authenticator.setting.hideCodes',
      title: 'authenticator.settings.hideCodes',
      icon: 'visibility',
      kind: 'setting',
      settingId: HIDE_CODES_ID,
      keywords: ['hide', 'mask', 'codes', 'privacy', 'authenticator']
    },
    {
      id: 'authenticator.setting.showNext',
      title: 'authenticator.settings.showNext',
      icon: 'chevronRight',
      kind: 'setting',
      settingId: SHOW_NEXT_ID,
      keywords: ['next', 'peek', 'preview', 'authenticator']
    },
    {
      id: 'authenticator.setting.qrSize',
      title: 'authenticator.settings.qrModuleSize',
      icon: 'palette',
      kind: 'setting',
      settingId: QR_MODULE_SIZE_ID,
      keywords: ['qr', 'size', 'pairing', 'authenticator']
    },
    {
      id: 'authenticator.setting.clockOffset',
      title: 'authenticator.settings.clockOffset',
      icon: 'calendar',
      kind: 'setting',
      settingId: CLOCK_OFFSET_ID,
      keywords: ['clock', 'offset', 'correction', 'authenticator']
    }
  ],
  init(ctx: AppContext) {
    contextRef = ctx;
    attachStore(ctx);
    startClockWatch();
  }
};

export default authenticator;
