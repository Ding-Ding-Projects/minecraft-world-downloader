import { defineFeature } from '../../core/registry';
import type { AppContext, PaletteEntry, SettingsSection } from '../../core/registry';
import { WORLDLENS_DOCS } from './docs';
import {
  ACCEPT_DOWNLOAD_ID,
  DESKTOP_PATH_ID,
  FORCE_ID,
  OUTPUT_DIR_ID,
  PORT_ID,
  RENDERER_PATH_ID,
  THREADS_ID,
  WATCH_ID,
  WORLDS_DIR_ID,
  WorldlensState,
  detectAndNotify,
  mountWorldlensTab
} from './panel';
import { WORLDLENS_RELEASES_URL } from './probe';
import { strings } from './strings';
import './styles.css';

/**
 * Pairs a downloaded world with Worldlens — a separate, freely installable
 * companion product — either by handing a world to its desktop application or
 * by driving its headless command-line renderer to serve an in-app map on
 * loopback.
 *
 * This feature never bundles, downloads or installs Worldlens; it only finds
 * an install already on the machine and says honestly when there is none, with
 * a real route to get one. `endpoint.ts` publishes what this feature is
 * currently serving, so another feature (the built-in map viewer) can offer it
 * as a source without either feature reaching into the other's directory.
 */

let featureState: WorldlensState | null = null;

function requireState(): WorldlensState | null {
  if (!featureState) console.error('The worldlens feature was used before its init ran.');
  return featureState;
}

/* ================================================================== */
/* Settings                                                            */
/* ================================================================== */

const DEFAULT_PORT = 8100;
const DEFAULT_THREADS = 2;

function settingsSection(): SettingsSection {
  return {
    id: 'worldlens',
    title: 'worldlens.tab',
    icon: 'map',
    order: 260,
    controls: [
      {
        id: DESKTOP_PATH_ID,
        label: 'worldlens.setting.desktopPath',
        description: 'worldlens.setting.desktopPath.description',
        kind: 'file',
        defaultValue: '',
        keywords: ['worldlens', 'desktop', 'executable', 'squirrel']
      },
      {
        id: RENDERER_PATH_ID,
        label: 'worldlens.setting.rendererPath',
        description: 'worldlens.setting.rendererPath.description',
        kind: 'file',
        defaultValue: '',
        keywords: ['worldlens', 'renderer', 'cli', 'jar', 'headless', 'bluemap']
      },
      {
        id: WORLDS_DIR_ID,
        label: 'worldlens.setting.worldsDir',
        description: 'worldlens.setting.worldsDir.description',
        kind: 'folder',
        defaultValue: '',
        keywords: ['worlds', 'downloads', 'saves', 'level.dat']
      },
      {
        id: OUTPUT_DIR_ID,
        label: 'worldlens.setting.outputDir',
        description: 'worldlens.setting.outputDir.description',
        kind: 'folder',
        defaultValue: '',
        keywords: ['render', 'output', 'web', 'tiles']
      },
      {
        id: PORT_ID,
        label: 'worldlens.setting.port',
        description: 'worldlens.setting.port.description',
        kind: 'number',
        defaultValue: DEFAULT_PORT,
        min: 1024,
        max: 65535,
        step: 1,
        keywords: ['port', 'loopback', 'server', '127.0.0.1'],
        validate: (value) => {
          const port = Number(value);
          if (!Number.isInteger(port) || port < 1024 || port > 65535) {
            return 'Use a whole number between 1024 and 65535. Nothing was changed.';
          }
          return null;
        }
      },
      {
        id: THREADS_ID,
        label: 'worldlens.setting.threads',
        description: 'worldlens.setting.threads.description',
        kind: 'number',
        defaultValue: DEFAULT_THREADS,
        min: 1,
        max: 32,
        step: 1,
        keywords: ['threads', 'performance', 'render'],
        validate: (value) => {
          const threads = Number(value);
          if (!Number.isInteger(threads) || threads < 1 || threads > 32) {
            return 'Use a whole number between 1 and 32. Nothing was changed.';
          }
          return null;
        }
      },
      {
        id: ACCEPT_DOWNLOAD_ID,
        label: 'worldlens.setting.acceptDownload',
        description: 'worldlens.setting.acceptDownload.description',
        kind: 'switch',
        defaultValue: false,
        keywords: ['download', 'mojang', 'textures', 'network']
      },
      {
        id: WATCH_ID,
        label: 'worldlens.setting.watch',
        description: 'worldlens.setting.watch.description',
        kind: 'switch',
        defaultValue: false,
        keywords: ['watch', 'live', 'update']
      },
      {
        id: FORCE_ID,
        label: 'worldlens.setting.force',
        description: 'worldlens.setting.force.description',
        kind: 'switch',
        defaultValue: false,
        keywords: ['force', 'rerender', 'chunks']
      },
      {
        id: 'worldlens.settings.getWorldlens',
        label: 'worldlens.setting.getWorldlens',
        description: 'worldlens.setting.getWorldlens.description',
        kind: 'action',
        defaultValue: null,
        keywords: ['install', 'download', 'releases', 'worldlens'],
        run: (settingCtx) => {
          void settingCtx.studio.shell.openExternal(WORLDLENS_RELEASES_URL);
        }
      },
      {
        id: 'worldlens.settings.redetect',
        label: 'worldlens.setting.redetect',
        description: 'worldlens.setting.redetect.description',
        kind: 'action',
        defaultValue: null,
        keywords: ['detect', 'refresh', 'worldlens', 'renderer'],
        run: async () => {
          const current = requireState();
          if (!current) return;
          await detectAndNotify(current);
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
    DESKTOP_PATH_ID,
    RENDERER_PATH_ID,
    WORLDS_DIR_ID,
    OUTPUT_DIR_ID,
    PORT_ID,
    THREADS_ID,
    ACCEPT_DOWNLOAD_ID,
    WATCH_ID,
    FORCE_ID
  ];

  const entries: PaletteEntry[] = [
    {
      id: 'worldlens.command.open',
      title: 'worldlens.palette.open',
      kind: 'destination',
      icon: 'map',
      keywords: ['worldlens', 'map', 'render', 'bluemap', '配對'],
      teleport: { tabId: 'worldlens.main', elementId: 'worldlens-worlds-search' },
      run: () => {
        featureState?.ctx.tabs.open('worldlens.main');
      }
    },
    {
      id: 'worldlens.command.detect',
      title: 'worldlens.action.detect',
      kind: 'command',
      icon: 'search',
      keywords: ['worldlens', 'detect', 'refresh'],
      run: () => {
        const current = requireState();
        if (current) void detectAndNotify(current);
      }
    },
    {
      id: 'worldlens.command.getWorldlens',
      title: 'worldlens.action.getWorldlens',
      kind: 'command',
      icon: 'download',
      keywords: ['worldlens', 'install', 'releases'],
      run: () => {
        void featureState?.ctx.studio.shell.openExternal(WORLDLENS_RELEASES_URL);
      }
    },
    {
      id: 'worldlens.command.render',
      title: 'worldlens.action.renderAndServe',
      kind: 'destination',
      icon: 'play',
      keywords: ['worldlens', 'render', 'serve'],
      teleport: { tabId: 'worldlens.main', elementId: 'worldlens-run-section' }
    },
    {
      id: 'worldlens.command.stop',
      title: 'worldlens.action.stop',
      kind: 'command',
      icon: 'stop',
      keywords: ['worldlens', 'stop', 'cancel'],
      run: () => {
        void featureState?.runner.stop();
      }
    }
  ];

  for (const id of settingIds) {
    entries.push({
      id: `worldlens.setting.${id}`,
      title: id,
      kind: 'setting',
      settingId: id,
      icon: 'tune',
      keywords: ['worldlens', 'setting', id]
    });
  }

  return entries;
}

/* ================================================================== */
/* The module                                                          */
/* ================================================================== */

export default defineFeature({
  id: 'worldlens',
  name: 'Worldlens',
  description:
    'Pairs a downloaded world with the Worldlens companion renderer, either handing it to the desktop application or rendering and serving an in-app map on loopback.',
  strings,
  docs: WORLDLENS_DOCS,
  settings: [settingsSection()],
  palette: paletteEntries(),
  tabs: [
    {
      id: 'worldlens.main',
      title: 'worldlens.tab',
      icon: 'map',
      order: 260,
      mount: (host, tabCtx) => {
        const current = requireState();
        if (!current) return;
        return mountWorldlensTab(host, tabCtx, current);
      }
    }
  ],
  init: (ctx: AppContext) => {
    featureState = new WorldlensState(ctx);
    void featureState.refreshAll();

    ctx.settings.onChange((change) => {
      const current = featureState;
      if (!current) return;
      if (change.id === DESKTOP_PATH_ID) void current.refreshDesktop();
      else if (change.id === RENDERER_PATH_ID) void current.refreshRenderer();
      else if (change.id === WORLDS_DIR_ID) void current.refreshWorlds();
    });
  }
});
