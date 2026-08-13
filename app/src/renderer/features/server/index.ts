import { defineFeature } from '../../core/registry';
import type { AppContext, PaletteEntry, SettingsSection } from '../../core/registry';
import { mountContainersPanel } from './containers';
import { SERVER_DOCS } from './docs';
import { DOCKER_INSTALL_URL } from './state';
import { mountLogsPanel } from './logs';
import {
  CONTAINERS_TAB_ID,
  DEFAULTS,
  ELEMENT_IDS,
  EXPORT_FORMAT_ID,
  LOGS_TAB_ID,
  LOG_FOLLOW_ID,
  LOG_PAGE_SIZE_ID,
  LOG_TAIL_ID,
  REDACT_SECRETS_ID,
  REFRESH_SECONDS_ID,
  ServerState,
  SHOW_STOPPED_ID,
  STOP_TIMEOUT_ID
} from './state';
import { SERVER_STRINGS } from './strings';

/**
 * Server and container manager (inventory row 13.3).
 *
 * `state.ts` owns the one poll loop and the one list of containers shared by
 * both destinations; `docker.ts` owns every command line; `containers.ts` and
 * `logs.ts` are the two destinations themselves; `dom.ts` holds the small
 * pieces shared between them. This file is the integration point: it turns
 * those modules into a registered feature — two tabs, a settings section, a
 * palette with a live teleport target for everything a user might search for,
 * and the copy catalogue that renders it in both languages at every humour
 * level.
 *
 * Every destructive container action (stop, restart, remove) already runs
 * through `ctx.confirm.request` inside `containers.ts`. Nothing here weakens
 * that: this module only wires destinations, settings and search terms
 * together.
 */

let state: ServerState | null = null;

function requireState(): ServerState | null {
  if (!state) console.error('The server feature was used before its init ran.');
  return state;
}

/* ================================================================== */
/* Settings                                                            */
/* ================================================================== */

function settingsSection(): SettingsSection {
  return {
    id: 'server',
    title: 'server.settings.title',
    icon: 'dock',
    order: 130,
    controls: [
      {
        id: REFRESH_SECONDS_ID,
        label: 'server.settings.refresh',
        description: 'server.settings.refresh.description',
        kind: 'number',
        defaultValue: DEFAULTS.refreshSeconds,
        min: 2,
        max: 120,
        step: 1,
        hint: 'seconds',
        keywords: ['refresh', 'poll', 'interval', 'docker', 'containers'],
        validate: (value) => {
          const seconds = Number(value);
          if (!Number.isFinite(seconds) || seconds < 2 || seconds > 120) {
            return 'Use a whole number of seconds between 2 and 120. Nothing was changed.';
          }
          return null;
        }
      },
      {
        id: SHOW_STOPPED_ID,
        label: 'server.settings.showStopped',
        description: 'server.settings.showStopped.description',
        kind: 'switch',
        defaultValue: DEFAULTS.showStopped,
        keywords: ['stopped', 'exited', 'filter', 'containers']
      },
      {
        id: STOP_TIMEOUT_ID,
        label: 'server.settings.stopTimeout',
        description: 'server.settings.stopTimeout.description',
        kind: 'number',
        defaultValue: DEFAULTS.stopTimeoutSeconds,
        min: 1,
        max: 300,
        step: 1,
        hint: 'seconds',
        keywords: ['stop', 'restart', 'grace', 'timeout', 'kill'],
        validate: (value) => {
          const seconds = Number(value);
          if (!Number.isFinite(seconds) || seconds < 1 || seconds > 300) {
            return 'Use a whole number of seconds between 1 and 300. Nothing was changed.';
          }
          return null;
        }
      },
      {
        id: LOG_TAIL_ID,
        label: 'server.settings.logTail',
        description: 'server.settings.logTail.description',
        kind: 'number',
        defaultValue: DEFAULTS.logTail,
        min: 50,
        max: 5000,
        step: 50,
        hint: 'lines',
        keywords: ['log', 'tail', 'lines', 'container'],
        validate: (value) => {
          const lines = Number(value);
          if (!Number.isFinite(lines) || lines < 50 || lines > 5000) {
            return 'Use a whole number of lines between 50 and 5000. Nothing was changed.';
          }
          return null;
        }
      },
      {
        id: LOG_FOLLOW_ID,
        label: 'server.settings.logFollow',
        description: 'server.settings.logFollow.description',
        kind: 'switch',
        defaultValue: DEFAULTS.logFollow,
        keywords: ['follow', 'live', 'log', 'stream']
      },
      {
        id: LOG_PAGE_SIZE_ID,
        label: 'server.settings.logPageSize',
        description: 'server.settings.logPageSize.description',
        kind: 'number',
        defaultValue: DEFAULTS.logPageSize,
        min: 50,
        max: 1000,
        step: 50,
        keywords: ['log', 'page', 'rows'],
        validate: (value) => {
          const size = Number(value);
          if (!Number.isFinite(size) || size < 50 || size > 1000) {
            return 'Use a whole number between 50 and 1000. Nothing was changed.';
          }
          return null;
        }
      },
      {
        id: REDACT_SECRETS_ID,
        label: 'server.settings.redactSecrets',
        description: 'server.settings.redactSecrets.description',
        kind: 'switch',
        defaultValue: DEFAULTS.redactSecrets,
        keywords: ['redact', 'secrets', 'password', 'token', 'privacy']
      },
      {
        id: EXPORT_FORMAT_ID,
        label: 'server.settings.exportFormat',
        description: 'server.settings.exportFormat.description',
        kind: 'select',
        defaultValue: DEFAULTS.exportFormat,
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
      }
    ]
  };
}

/* ================================================================== */
/* Palette                                                             */
/* ================================================================== */

function paletteEntries(): PaletteEntry[] {
  const settingIds = [
    REFRESH_SECONDS_ID,
    SHOW_STOPPED_ID,
    STOP_TIMEOUT_ID,
    LOG_TAIL_ID,
    LOG_FOLLOW_ID,
    LOG_PAGE_SIZE_ID,
    REDACT_SECRETS_ID,
    EXPORT_FORMAT_ID
  ];

  const entries: PaletteEntry[] = [
    {
      id: 'server.command.openContainers',
      title: 'server.palette.openContainers',
      kind: 'destination',
      icon: 'dock',
      keywords: ['server', 'docker', 'containers', 'start', 'stop', 'restart', 'remove'],
      teleport: { tabId: CONTAINERS_TAB_ID, elementId: ELEMENT_IDS.table },
      run: () => {
        requireState()?.ctx.tabs.open(CONTAINERS_TAB_ID);
      }
    },
    {
      id: 'server.command.openLogs',
      title: 'server.palette.openLogs',
      kind: 'destination',
      icon: 'terminal',
      keywords: ['server', 'docker', 'logs', 'container', 'follow'],
      teleport: { tabId: LOGS_TAB_ID, elementId: ELEMENT_IDS.logLines },
      run: () => {
        requireState()?.ctx.tabs.open(LOGS_TAB_ID);
      }
    },
    {
      id: 'server.command.refresh',
      title: 'server.palette.refresh',
      kind: 'command',
      icon: 'refresh',
      keywords: ['refresh', 'reload', 'docker', 'containers'],
      run: () => void requireState()?.refreshList()
    },
    {
      id: 'server.command.checkDaemon',
      title: 'server.palette.checkDaemon',
      kind: 'command',
      icon: 'bolt',
      keywords: ['docker', 'daemon', 'check', 'probe', 'status'],
      run: () => void requireState()?.probe()
    },
    {
      id: 'server.command.searchContainers',
      title: 'server.palette.searchContainers',
      kind: 'command',
      icon: 'search',
      keywords: ['search', 'find', 'containers', 'filter'],
      teleport: { tabId: CONTAINERS_TAB_ID, elementId: ELEMENT_IDS.search },
      run: () => {
        const current = requireState();
        current?.ctx.tabs.open(CONTAINERS_TAB_ID);
        current?.containersPanel?.focusSearch();
      }
    },
    {
      id: 'server.command.searchLogs',
      title: 'server.palette.searchLogs',
      kind: 'command',
      icon: 'search',
      keywords: ['search', 'find', 'log', 'lines'],
      teleport: { tabId: LOGS_TAB_ID, elementId: ELEMENT_IDS.logSearch },
      run: () => {
        const current = requireState();
        current?.ctx.tabs.open(LOGS_TAB_ID);
        current?.logsPanel?.focusSearch();
      }
    },
    {
      id: 'server.command.exportContainers',
      title: 'server.palette.exportContainers',
      kind: 'command',
      icon: 'download',
      keywords: ['export', 'containers', 'csv', 'json'],
      run: () => void requireState()?.containersPanel?.exportRows()
    },
    {
      id: 'server.command.exportLogs',
      title: 'server.palette.exportLogs',
      kind: 'command',
      icon: 'download',
      keywords: ['export', 'log', 'lines', 'csv', 'json'],
      run: () => void requireState()?.logsPanel?.exportRows()
    },
    {
      id: 'server.command.toggleFollow',
      title: 'server.palette.toggleFollow',
      kind: 'command',
      icon: 'play',
      keywords: ['follow', 'live', 'log', 'stream', 'tail'],
      run: () => requireState()?.logsPanel?.toggleFollow()
    },
    {
      id: 'server.command.installDocker',
      title: 'server.palette.installDocker',
      kind: 'command',
      icon: 'cloud',
      keywords: ['install', 'docker', 'download', 'get'],
      run: () => {
        void requireState()?.ctx.studio.shell.openExternal(DOCKER_INSTALL_URL);
      }
    }
  ];

  for (const id of settingIds) {
    entries.push({
      id: `server.setting.${id}`,
      title: id,
      kind: 'setting',
      settingId: id,
      icon: 'tune',
      keywords: ['server', 'docker', 'setting', id]
    });
  }

  return entries;
}

/* ================================================================== */
/* The module                                                          */
/* ================================================================== */

export default defineFeature({
  id: 'server',
  name: 'Server and containers',
  description:
    'Container list with state, log stream, and gated start, stop, restart and remove for every Docker container on this machine.',
  strings: SERVER_STRINGS,
  docs: SERVER_DOCS,
  settings: [settingsSection()],
  palette: paletteEntries(),

  tabs: [
    {
      id: CONTAINERS_TAB_ID,
      title: 'server.tab.containers',
      icon: 'dock',
      // Ungrouped, on top: one of the product's own surfaces.
      order: 2,
      mount: (host, tabCtx) => {
        const current = requireState();
        if (!current) return;
        mountContainersPanel(host, tabCtx, current);
      }
    },
    {
      id: LOGS_TAB_ID,
      title: 'server.tab.logs',
      icon: 'terminal',
      order: 3,
      mount: (host, tabCtx) => {
        const current = requireState();
        if (!current) return;
        mountLogsPanel(host, tabCtx, current);
      }
    }
  ],

  init: (ctx: AppContext) => {
    state = new ServerState(ctx);

    // The poll interval is read fresh every time the timer is (re)started, so
    // a change to the setting only has to trigger a restart, not a rewrite of
    // the loop itself.
    ctx.settings.onChange((change) => {
      if (change.id === REFRESH_SECONDS_ID) state?.restartTimer();
    });
  }
});
