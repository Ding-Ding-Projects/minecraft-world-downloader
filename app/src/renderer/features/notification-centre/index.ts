import './styles.css';

import { NotificationArchive } from './archive';
import { mountCentre } from './centre';
import { NOTIFICATION_CENTRE_DOCS } from './docs';
import {
  CENTRE_FILTERS_ID,
  CENTRE_LIST_ID,
  CENTRE_ROOT_ID,
  CENTRE_SEARCH_ID,
  CENTRE_STATISTICS_ID,
  CENTRE_TAB_ID,
  DEFAULT_EXPORT_FORMAT,
  DEFAULT_PAGE_SIZE,
  DEFAULT_RETENTION,
  MAX_PAGE_SIZE,
  MAX_RETENTION,
  MIN_PAGE_SIZE,
  MIN_RETENTION,
  SETTING_EXPORT_FORMAT,
  SETTING_FILTERS_EXPANDED,
  SETTING_PAGE_SIZE,
  SETTING_PERSIST,
  SETTING_RETENTION,
  SETTING_STATISTICS_EXPANDED
} from './model';
import { NOTIFICATION_CENTRE_STRINGS } from './strings';
import { defineFeature } from '../../core/registry';
import type { AppContext, ExportFormat, SettingsSection } from '../../core/registry';

/**
 * The notification centre.
 *
 * The core notification service raises toasts and keeps this session's records
 * in memory. This module owns the other half: a durable, bounded, validated log
 * and the surface that makes it reviewable — search with its anchored pattern
 * builder, severity and source filters with live counts, collapsible filter and
 * statistics panels, and the full bulk-action contract every list in this
 * application carries.
 *
 * It installs its centre into the notification service's own `mountCentre`
 * rather than registering a second destination, so the application has exactly
 * one notification centre rather than two tabs showing the same log. The core
 * placeholder remains the fallback if this module ever fails to start.
 */

let archive: NotificationArchive | null = null;

function exportFormatOptions(): Array<{ value: string; label: string }> {
  const formats: ExportFormat[] = [
    'json',
    'jsonl',
    'yaml',
    'toml',
    'xml',
    'csv',
    'tsv',
    'markdown',
    'html',
    'sql'
  ];
  return formats.map((format) => ({ value: format, label: `notificationCentre.format.${format}` }));
}

function settingsSection(): SettingsSection {
  return {
    id: 'notificationCentre',
    title: 'notificationCentre.settings.section',
    icon: 'notifications',
    order: 150,
    controls: [
      {
        id: SETTING_PERSIST,
        label: 'notificationCentre.settings.persist',
        description: 'notificationCentre.settings.persist.description',
        kind: 'switch',
        defaultValue: true,
        keywords: ['notification', 'log', 'persist', 'restart', 'history', '通知']
      },
      {
        id: SETTING_RETENTION,
        label: 'notificationCentre.settings.retention',
        description: 'notificationCentre.settings.retention.description',
        kind: 'number',
        defaultValue: DEFAULT_RETENTION,
        min: MIN_RETENTION,
        max: MAX_RETENTION,
        step: 25,
        keywords: ['retention', 'notification', 'log', 'keep', 'prune'],
        validate: (value) => {
          const parsed = Number(value);
          if (!Number.isFinite(parsed)) return 'Enter a whole number. Nothing was changed.';
          if (parsed < MIN_RETENTION || parsed > MAX_RETENTION) {
            return `Enter a number between ${MIN_RETENTION} and ${MAX_RETENTION}. Nothing was changed.`;
          }
          return null;
        }
      },
      {
        id: SETTING_PAGE_SIZE,
        label: 'notificationCentre.settings.pageSize',
        description: 'notificationCentre.settings.pageSize.description',
        kind: 'number',
        defaultValue: DEFAULT_PAGE_SIZE,
        min: MIN_PAGE_SIZE,
        max: MAX_PAGE_SIZE,
        step: 10,
        keywords: ['page', 'rows', 'notification', 'list'],
        validate: (value) => {
          const parsed = Number(value);
          if (!Number.isFinite(parsed)) return 'Enter a whole number. Nothing was changed.';
          if (parsed < MIN_PAGE_SIZE || parsed > MAX_PAGE_SIZE) {
            return `Enter a number between ${MIN_PAGE_SIZE} and ${MAX_PAGE_SIZE}. Nothing was changed.`;
          }
          return null;
        }
      },
      {
        id: SETTING_FILTERS_EXPANDED,
        label: 'notificationCentre.settings.filtersExpanded',
        description: 'notificationCentre.settings.filtersExpanded.description',
        kind: 'switch',
        defaultValue: true,
        keywords: ['filter', 'collapse', 'notification']
      },
      {
        id: SETTING_STATISTICS_EXPANDED,
        label: 'notificationCentre.settings.statisticsExpanded',
        description: 'notificationCentre.settings.statisticsExpanded.description',
        kind: 'switch',
        defaultValue: false,
        keywords: ['statistics', 'collapse', 'notification']
      },
      {
        id: SETTING_EXPORT_FORMAT,
        label: 'notificationCentre.settings.exportFormat',
        description: 'notificationCentre.settings.exportFormat.description',
        kind: 'select',
        defaultValue: DEFAULT_EXPORT_FORMAT,
        options: exportFormatOptions(),
        keywords: ['export', 'format', 'json', 'csv', 'notification']
      },
      {
        id: 'notificationCentre.clear',
        label: 'notificationCentre.settings.clear',
        description: 'notificationCentre.settings.clear.description',
        kind: 'action',
        defaultValue: null,
        keywords: ['clear', 'delete', 'notification', 'log'],
        run: async (ctx) => {
          const store = archive;
          if (!store) {
            ctx.notify.error(
              ctx.t('notificationCentre.settings.clear', 'Delete every stored notification'),
              'The notification log did not start, so there is nothing to delete.'
            );
            return;
          }
          const records = store.all();
          if (records.length === 0) {
            ctx.notify.info(ctx.t('notificationCentre.disabled.emptyLog', 'The log is empty.'));
            return;
          }
          const approved = await ctx.confirm.request({
            action: ctx.t(
              'notificationCentre.confirm.clear',
              'Delete every stored notification record ({count})',
              { values: { count: records.length } }
            ),
            affected: records
              .slice(0, 20)
              .map((record) => `${ctx.t(record.title, record.title)} — ${record.source} — ${record.createdAt}`),
            irreversible: ctx.t(
              'notificationCentre.confirm.deleteIrreversible',
              'These records are removed from the stored log and cannot be recovered from within the application.',
              { values: { count: records.length, path: store.status().path } }
            ),
            anchor: document.activeElement as HTMLElement
          });
          if (!approved) return;
          const removed = await store.clear();
          await ctx.history.record('Notification log cleared', 'notification-centre', {
            count: removed,
            path: store.status().path
          });
          ctx.notify.success(
            ctx.t('notificationCentre.result.cleared', 'The log is empty.', { values: { count: removed } })
          );
        }
      },
      {
        id: 'notificationCentre.reveal',
        label: 'notificationCentre.settings.reveal',
        description: 'notificationCentre.settings.reveal.description',
        kind: 'action',
        defaultValue: null,
        keywords: ['folder', 'reveal', 'notification', 'log', 'file'],
        run: async (ctx) => {
          const store = archive;
          if (!store) {
            ctx.notify.error(
              ctx.t('notificationCentre.settings.reveal', 'Open the folder holding the log'),
              'The notification log did not start, so its folder is not known.'
            );
            return;
          }
          const result = await ctx.studio.shell.openPath(store.directoryPath());
          if (!result.ok) {
            ctx.notify.error(
              ctx.t('notificationCentre.settings.reveal', 'Open the folder holding the log'),
              result.error
            );
          }
        }
      }
    ]
  };
}

export default defineFeature({
  id: 'notification-centre',
  name: 'Notification centre',
  description:
    'A durable, searchable, filterable log of every notification the application has raised, with the full bulk-action contract.',
  strings: NOTIFICATION_CENTRE_STRINGS,
  settings: [settingsSection()],
  docs: NOTIFICATION_CENTRE_DOCS,
  palette: [
    {
      id: 'notificationCentre.open',
      title: 'notificationCentre.action.openCentre',
      subtitle: 'notificationCentre.lede',
      icon: 'notifications',
      kind: 'destination',
      keywords: ['notification', 'centre', 'center', 'log', 'toast', 'messages', '通知'],
      teleport: { tabId: CENTRE_TAB_ID, elementId: CENTRE_ROOT_ID }
    },
    {
      id: 'notificationCentre.search',
      title: 'notificationCentre.search.label',
      icon: 'search',
      kind: 'destination',
      keywords: ['notification', 'search', 'filter', 'regex'],
      teleport: { tabId: CENTRE_TAB_ID, elementId: CENTRE_SEARCH_ID }
    },
    {
      id: 'notificationCentre.filters',
      title: 'notificationCentre.filters.title',
      icon: 'filter',
      kind: 'destination',
      keywords: ['notification', 'filter', 'severity', 'source'],
      teleport: { tabId: CENTRE_TAB_ID, elementId: CENTRE_FILTERS_ID }
    },
    {
      id: 'notificationCentre.statistics',
      title: 'notificationCentre.stats.title',
      icon: 'sort',
      kind: 'destination',
      keywords: ['notification', 'statistics', 'counts'],
      teleport: { tabId: CENTRE_TAB_ID, elementId: CENTRE_STATISTICS_ID }
    },
    {
      id: 'notificationCentre.list',
      title: 'notificationCentre.title',
      icon: 'notifications',
      kind: 'destination',
      keywords: ['notification', 'list', 'rows'],
      teleport: { tabId: CENTRE_TAB_ID, elementId: CENTRE_LIST_ID }
    },
    {
      id: 'notificationCentre.setting.persist',
      title: 'notificationCentre.settings.persist',
      icon: 'save',
      kind: 'setting',
      settingId: SETTING_PERSIST,
      keywords: ['notification', 'persist', 'restart']
    },
    {
      id: 'notificationCentre.setting.retention',
      title: 'notificationCentre.settings.retention',
      icon: 'history',
      kind: 'setting',
      settingId: SETTING_RETENTION,
      keywords: ['notification', 'retention', 'keep']
    },
    {
      id: 'notificationCentre.setting.pageSize',
      title: 'notificationCentre.settings.pageSize',
      icon: 'dock',
      kind: 'setting',
      settingId: SETTING_PAGE_SIZE,
      keywords: ['notification', 'page', 'rows']
    },
    {
      id: 'notificationCentre.setting.exportFormat',
      title: 'notificationCentre.settings.exportFormat',
      icon: 'download',
      kind: 'setting',
      settingId: SETTING_EXPORT_FORMAT,
      keywords: ['notification', 'export', 'format']
    }
  ],

  init(ctx: AppContext) {
    const store = new NotificationArchive(ctx);
    archive = store;

    /*
     * Installing the real centre over the core placeholder.
     *
     * The service's own `mountCentre` is what the shell's notifications tab
     * calls, so replacing it gives the application exactly one notification
     * centre rather than a second tab rendering the same log beside the first.
     * The original stays bound as the fallback: if this module's archive never
     * started, the placeholder is still better than an empty panel.
     */
    const fallback = ctx.notify.mountCentre.bind(ctx.notify);
    ctx.notify.mountCentre = (hostElement: HTMLElement, mountCtx: AppContext): (() => void) => {
      if (!archive) return fallback(hostElement, mountCtx);
      return mountCentre(hostElement, mountCtx, archive);
    };

    void store.start().catch((error: unknown) => {
      // Starting the durable half is allowed to fail; the centre still renders
      // this session's notifications, and the status line says what happened.
      console.error('The notification log did not start:', error);
    });
  }
});
