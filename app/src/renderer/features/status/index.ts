import { defineFeature } from '../../core/registry';
import type { AppContext, PaletteEntry, SettingsSection } from '../../core/registry';
import './styles.css';
import { STATUS_DOCS } from './docs';
import { mountStatusPanel } from './panel';
import { AUTO_REFRESH_ID, AUTO_REFRESH_SECONDS_ID, FeatureState } from './state';
import { STATUS_STRINGS } from './strings';

/**
 * The application's own status surface.
 *
 * `scripts/report-status.mjs` reports this project's state to the shared hub
 * from the command line, over the network, with a secret token that never
 * touches this process. This feature is the other half: a local, in-app view
 * of the same record shape (`./model.ts`), read from a plain file this
 * application writes and reads on disk, refreshed from real Git state for this
 * checkout and editable by hand for anything else worth tracking here. It never
 * talks to the hub, and it never sees that token.
 */

let state: FeatureState | null = null;

function requireState(): FeatureState | null {
  if (!state) console.error('The status feature was used before its init ran.');
  return state;
}

function settingsSection(): SettingsSection {
  return {
    id: 'status',
    title: 'status.tab.title',
    icon: 'success',
    order: 260,
    controls: [
      {
        id: AUTO_REFRESH_ID,
        label: 'status.settings.autoRefresh',
        description: 'status.settings.autoRefresh.description',
        kind: 'switch',
        defaultValue: true,
        keywords: ['status', 'refresh', 'automatic', 'git', 'checkout']
      },
      {
        id: AUTO_REFRESH_SECONDS_ID,
        label: 'status.settings.autoRefreshSeconds',
        description: 'status.settings.autoRefreshSeconds.description',
        kind: 'number',
        defaultValue: 60,
        min: 15,
        max: 3600,
        step: 15,
        hint: 'seconds',
        keywords: ['status', 'refresh', 'interval', 'seconds'],
        validate: (value) => {
          const seconds = Number(value);
          if (!Number.isFinite(seconds) || seconds < 15 || seconds > 3600) {
            return 'Use a whole number of seconds between 15 and 3600. Nothing was changed.';
          }
          return null;
        }
      }
    ]
  };
}

function paletteEntries(): PaletteEntry[] {
  return [
    {
      id: 'status.command.open',
      title: 'status.palette.open',
      subtitle: 'status.palette.open.subtitle',
      kind: 'destination',
      icon: 'success',
      keywords: ['status', 'hub', 'lanes', 'health', 'gates', 'evidence'],
      teleport: { tabId: 'status.panel', elementId: 'status-results' }
    },
    {
      id: 'status.command.add',
      title: 'status.palette.addLane',
      kind: 'destination',
      icon: 'add',
      keywords: ['status', 'lane', 'add', 'new', 'track'],
      teleport: { tabId: 'status.panel', elementId: 'status-add-lane' }
    },
    {
      id: 'status.command.search',
      title: 'status.palette.search',
      kind: 'destination',
      icon: 'search',
      keywords: ['status', 'search', 'find', 'filter'],
      teleport: { tabId: 'status.panel', elementId: 'status-search' }
    },
    {
      id: 'status.command.refresh',
      title: 'status.palette.refresh',
      kind: 'command',
      icon: 'refresh',
      keywords: ['status', 'refresh', 'git', 'reload'],
      run: () => void requireState()?.refreshSelf()
    },
    {
      id: 'status.setting.autoRefresh',
      title: AUTO_REFRESH_ID,
      kind: 'setting',
      settingId: AUTO_REFRESH_ID,
      icon: 'tune',
      keywords: ['status', 'refresh', 'automatic']
    },
    {
      id: 'status.setting.autoRefreshSeconds',
      title: AUTO_REFRESH_SECONDS_ID,
      kind: 'setting',
      settingId: AUTO_REFRESH_SECONDS_ID,
      icon: 'tune',
      keywords: ['status', 'refresh', 'interval', 'seconds']
    }
  ];
}

export default defineFeature({
  id: 'status',
  name: 'Status',
  description:
    "This application's own status board: this checkout's real Git state, plus any local status lanes you record, in the same record shape scripts/report-status.mjs reports to the shared hub — read entirely from a local file, never over the network.",
  strings: STATUS_STRINGS,
  docs: STATUS_DOCS,
  settings: [settingsSection()],
  palette: paletteEntries(),
  tabs: [
    {
      id: 'status.panel',
      title: 'status.tab.title',
      icon: 'success',
      order: 340,
      mount: (host, tabCtx) => {
        const current = requireState();
        if (!current) return;
        mountStatusPanel(host, tabCtx, current);
      }
    }
  ],
  init(ctx: AppContext) {
    state = new FeatureState(ctx);
    void state.loadFromDisk();
  }
});
