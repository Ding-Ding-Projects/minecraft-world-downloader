import { defineFeature } from '../../core/registry';
import type { AppContext, PaletteEntry, SettingsSection } from '../../core/registry';
import './styles.css';
import { HISTORY_DOCS } from './docs';
import { mountHistoryPanel } from './panel';
import { mountProtectedPanel, openFactorWizard } from './managerpanel';
import { UNLOCK_MINUTES_ID } from './protected';
import {
  AUTO_PRUNE_ID,
  EXPORT_FORMAT_ID,
  FeatureState,
  MAX_LOAD_ID,
  PAGE_SIZE_ID,
  REDACT_EXPORTS_ID,
  RETENTION_DAYS_ID,
  recordEntry
} from './state';
import { HISTORY_STRINGS } from './strings';
import { formatCount, formatTimestamp } from './util';

/**
 * The local version-history surface.
 *
 * `core/history.ts` owns the plumbing — an append-only, git-backed store in the
 * application's own data directory, with a journal fallback when git is not
 * installed. This feature is what a person actually uses: browsing, filtering,
 * comparing, labelling, restoring, pruning and exporting, plus the separately
 * protected log of secret and display-name mutations built on the same store.
 */

let state: FeatureState | null = null;

function requireState(): FeatureState | null {
  if (!state) console.error('The history feature was used before its init ran.');
  return state;
}

/* ================================================================== */
/* Settings                                                            */
/* ================================================================== */

function settingsSection(): SettingsSection {
  return {
    id: 'history',
    title: 'history.settings.section',
    icon: 'history',
    order: 120,
    controls: [
      {
        id: RETENTION_DAYS_ID,
        label: 'history.settings.retention',
        description: 'history.settings.retention.description',
        kind: 'number',
        defaultValue: 365,
        min: 1,
        max: 3650,
        step: 1,
        hint: 'days',
        keywords: ['retention', 'keep', 'prune', 'days', 'history'],
        validate: (value) => {
          const days = Number(value);
          if (!Number.isFinite(days) || days < 1 || days > 3650) {
            return 'Use a whole number of days between 1 and 3650. Nothing was changed.';
          }
          return null;
        }
      },
      {
        id: AUTO_PRUNE_ID,
        label: 'history.settings.autoPrune',
        description: 'history.settings.autoPrune.description',
        kind: 'switch',
        defaultValue: false,
        keywords: ['prune', 'startup', 'retention', 'automatic']
      },
      {
        id: PAGE_SIZE_ID,
        label: 'history.settings.pageSize',
        description: 'history.settings.pageSize.description',
        kind: 'number',
        defaultValue: 200,
        min: 10,
        max: 2000,
        step: 10,
        keywords: ['page', 'rows', 'list', 'history'],
        validate: (value) => {
          const size = Number(value);
          if (!Number.isFinite(size) || size < 10 || size > 2000) {
            return 'Use a whole number between 10 and 2000. Nothing was changed.';
          }
          return null;
        }
      },
      {
        id: MAX_LOAD_ID,
        label: 'history.settings.maxLoad',
        description: 'history.settings.maxLoad.description',
        kind: 'number',
        defaultValue: 5000,
        min: 100,
        max: 100_000,
        step: 100,
        keywords: ['limit', 'load', 'performance', 'history'],
        validate: (value) => {
          const limit = Number(value);
          if (!Number.isFinite(limit) || limit < 100 || limit > 100_000) {
            return 'Use a whole number between 100 and 100000. Nothing was changed.';
          }
          return null;
        }
      },
      {
        id: REDACT_EXPORTS_ID,
        label: 'history.settings.redact',
        description: 'history.settings.redact.description',
        kind: 'switch',
        defaultValue: true,
        keywords: ['redact', 'export', 'privacy', 'secrets']
      },
      {
        id: EXPORT_FORMAT_ID,
        label: 'history.settings.exportFormat',
        description: 'history.settings.exportFormat.description',
        kind: 'select',
        defaultValue: 'json',
        keywords: ['export', 'format', 'json', 'csv'],
        options: [
          { value: 'json', label: 'JSON' },
          { value: 'jsonl', label: 'JSONL' },
          { value: 'yaml', label: 'YAML' },
          { value: 'toml', label: 'TOML' },
          { value: 'xml', label: 'XML' },
          { value: 'csv', label: 'CSV' },
          { value: 'tsv', label: 'TSV' },
          { value: 'markdown', label: 'Markdown' },
          { value: 'html', label: 'HTML' },
          { value: 'sql', label: 'SQL' }
        ]
      },
      {
        id: UNLOCK_MINUTES_ID,
        label: 'history.settings.unlockMinutes',
        description: 'history.settings.unlockMinutes.description',
        kind: 'select',
        defaultValue: '15',
        keywords: ['unlock', 'protected', 'lock', 'duration'],
        options: [
          { value: '0', label: 'While the log stays open' },
          { value: '5', label: '5 minutes' },
          { value: '15', label: '15 minutes' },
          { value: '60', label: '60 minutes' },
          { value: '-1', label: 'Until the application closes' }
        ]
      },
      {
        id: 'history.protected.setCredential',
        label: 'history.settings.factor',
        description: 'history.settings.factor.description',
        kind: 'action',
        defaultValue: null,
        keywords: ['credential', 'password', 'authenticator', 'protected', 'lock'],
        lockable: false,
        lockableReason:
          'This control is itself the credential route for the protected log, so a second lock on top of it would leave no way back in.',
        run: (settingCtx) => {
          const current = requireState();
          if (!current) return;
          const anchor = (document.activeElement as HTMLElement | null) ?? document.body;
          openFactorWizard(settingCtx, current, anchor, () => undefined);
        }
      },
      {
        id: 'history.protected.removeCredential',
        label: 'history.settings.forget',
        description: 'history.settings.forget.description',
        kind: 'action',
        defaultValue: null,
        keywords: ['credential', 'remove', 'forget', 'protected'],
        run: async (settingCtx) => {
          const current = requireState();
          if (!current) return;
          const anchor = (document.activeElement as HTMLElement | null) ?? document.body;
          const has = await current.protectedLog.hasFactor();
          if (!has) {
            settingCtx.notify.info(
              settingCtx.t('history.settings.factor', 'Protected log credential'),
              settingCtx.t(
                'history.protected.noFactor',
                'No credential has been set for this log yet. Set one and it locks on every launch.'
              )
            );
            return;
          }
          const approved = await settingCtx.confirm.request({
            action: settingCtx.t('history.settings.forget', 'Remove the protected log credential'),
            affected: [
              settingCtx.t('history.protected.title', 'Protected mutation log'),
              `The stored verifier under the credential-store account for this log.`
            ],
            irreversible:
              'The stored verifier is deleted. The protected log stops asking for anything until a new credential is set. Its entries are not touched and stay readable.',
            anchor,
            confirmLabel: settingCtx.t('history.protected.removeFactor', 'Remove the credential')
          });
          if (!approved) return;
          const result = await current.protectedLog.removeFactor();
          if (!result.ok) {
            settingCtx.notify.error(
              settingCtx.t('history.settings.forget', 'Remove the protected log credential'),
              result.error ?? ''
            );
            return;
          }
          await recordEntry(settingCtx, 'Removed the protected history credential', 'history.protected', {
            kind: 'historyManager.credentialRemoved',
            summary: 'The protected mutation log no longer asks for a credential.'
          });
          settingCtx.notify.success(
            settingCtx.t('history.settings.forget', 'Remove the protected log credential'),
            settingCtx.t(
              'history.protected.noFactor',
              'No credential has been set for this log yet. Set one and it locks on every launch.'
            )
          );
        }
      }
    ]
  };
}

/* ================================================================== */
/* Palette                                                             */
/* ================================================================== */

function paletteEntries(): PaletteEntry[] {
  const settingIds = [
    RETENTION_DAYS_ID,
    AUTO_PRUNE_ID,
    PAGE_SIZE_ID,
    MAX_LOAD_ID,
    REDACT_EXPORTS_ID,
    EXPORT_FORMAT_ID,
    UNLOCK_MINUTES_ID
  ];

  const entries: PaletteEntry[] = [
    {
      id: 'history.command.open',
      title: 'history.palette.open',
      kind: 'destination',
      icon: 'history',
      keywords: ['history', 'versions', 'undo', 'restore', '紀錄'],
      teleport: { tabId: 'history.panel', elementId: 'history-results' },
      run: () => {
        state?.ctx.tabs.open('history.panel');
      }
    },
    {
      id: 'history.command.openProtected',
      title: 'history.palette.openProtected',
      kind: 'destination',
      icon: 'lock',
      keywords: ['protected', 'secret', 'authenticator', 'display name'],
      teleport: { tabId: 'history.protected', elementId: 'history-protected' },
      run: () => {
        state?.ctx.tabs.open('history.protected');
      }
    },
    {
      id: 'history.command.refresh',
      title: 'history.palette.refresh',
      kind: 'command',
      icon: 'refresh',
      keywords: ['reload', 'history'],
      run: () => state?.refresh()
    },
    {
      id: 'history.command.search',
      title: 'history.palette.search',
      kind: 'command',
      icon: 'search',
      keywords: ['search', 'find', 'history', 'regex'],
      run: () => state?.focusSearch()
    },
    {
      id: 'history.command.dates',
      title: 'history.palette.dates',
      kind: 'command',
      icon: 'calendar',
      keywords: ['date', 'range', 'calendar', 'filter'],
      run: () => state?.focusDates()
    },
    {
      id: 'history.command.export',
      title: 'history.palette.export',
      kind: 'command',
      icon: 'download',
      keywords: ['export', 'json', 'csv', 'history'],
      run: () => state?.exportHistory()
    },
    {
      id: 'history.command.prune',
      title: 'history.palette.prune',
      kind: 'command',
      icon: 'trash',
      keywords: ['prune', 'retention', 'delete', 'history'],
      run: () => state?.pruneHistory()
    },
    {
      id: 'history.command.credential',
      title: 'history.settings.factor',
      kind: 'command',
      icon: 'key',
      keywords: ['credential', 'password', 'authenticator', 'protected'],
      run: () => {
        const current = requireState();
        if (!current) return;
        const anchor = (document.activeElement as HTMLElement | null) ?? document.body;
        openFactorWizard(current.ctx, current, anchor, () => undefined);
      }
    }
  ];

  for (const id of settingIds) {
    entries.push({
      id: `history.setting.${id}`,
      title: id,
      kind: 'setting',
      settingId: id,
      icon: 'tune',
      keywords: ['history', 'setting', id]
    });
  }

  return entries;
}

/* ================================================================== */
/* Startup work                                                        */
/* ================================================================== */

async function runStartupPrune(ctx: AppContext): Promise<void> {
  if (ctx.settings.get<boolean>(AUTO_PRUNE_ID, false) !== true) return;
  const days = Number(ctx.settings.get<number>(RETENTION_DAYS_ID, 365));
  const safeDays = Number.isFinite(days) && days > 0 ? Math.round(days) : 365;
  const cutoff = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000).toISOString();

  const result = await ctx.studio.history.prune(cutoff);
  if (!result.ok) {
    ctx.notify.warn(
      ctx.t('history.prune.title', 'Prune old entries'),
      ctx.t('history.prune.failed', 'Nothing was removed: {reason}', { values: { reason: result.error } })
    );
    return;
  }
  // Nothing removed is an unchanged state, and an unchanged state records
  // nothing and says nothing.
  if (result.value.removed === 0) return;

  await recordEntry(
    ctx,
    `Pruned ${result.value.removed} history entries older than ${cutoff} at startup`,
    'history.prune',
    { cutoff, removed: result.value.removed, retentionDays: safeDays, trigger: 'startup' }
  );
  ctx.notify.info(
    ctx.t('history.prune.title', 'Prune old entries'),
    ctx.t('history.prune.auto', '{count} entries older than the {days}-day retention window were removed at startup.', {
      values: { count: formatCount(result.value.removed), days: safeDays }
    })
  );
  ctx.a11y.announce(formatTimestamp(cutoff));
}

/* ================================================================== */
/* The module                                                          */
/* ================================================================== */

export default defineFeature({
  id: 'history',
  name: 'Version history',
  description:
    'Browse, filter, compare, label, restore, prune and export the local append-only history, plus the separately protected log of secret and display-name mutations.',
  strings: HISTORY_STRINGS,
  docs: HISTORY_DOCS,
  settings: [settingsSection()],
  palette: paletteEntries(),
  tabs: [
    {
      id: 'history.panel',
      title: 'history.panel.title',
      icon: 'history',
      group: 'group.records',
      order: 300,
      mount: (host, tabCtx) => {
        const current = requireState();
        if (!current) return;
        mountHistoryPanel(host, tabCtx, current);
      }
    },
    {
      id: 'history.protected',
      title: 'history.protected.title',
      icon: 'lock',
      group: 'group.records',
      order: 301,
      mount: (host, tabCtx) => {
        const current = requireState();
        if (!current) return;
        mountProtectedPanel(host, tabCtx, current);
      }
    }
  ],
  init: (ctx) => {
    state = new FeatureState(ctx);

    // The recorder is installed before anything else so a mutation that happens
    // during startup is still written down.
    const uninstall = state.protectedLog.install();
    window.addEventListener('beforeunload', uninstall);

    void state.store.load().then(() => {
      const failure = state?.store.failure();
      if (failure) {
        ctx.notify.warn(ctx.t('history.panel.title', 'Version history'), failure);
      }
    });

    void runStartupPrune(ctx).catch((error: unknown) => {
      ctx.notify.warn(
        ctx.t('history.prune.title', 'Prune old entries'),
        error instanceof Error ? error.message : String(error)
      );
    });
  }
});
