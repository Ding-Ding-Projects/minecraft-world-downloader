/**
 * The live map feature module.
 *
 * This is the integration surface only. Everything that actually draws or
 * reads anything lives in `model.ts` (types, bounds, pure helpers), `source.ts`
 * (the local tile reader), `canvas.ts` (the pannable/zoomable viewport),
 * `markers.ts` (the marker store) and `panel.ts` (wiring it all into one tab).
 * This file registers that tab, the settings section that configures it, the
 * palette entries that find it, and the documentation that explains it.
 */

import { defineFeature } from '../../core/registry';
import type { AppContext, PaletteEntry, SettingsSection } from '../../core/registry';
import './styles.css';
import { MAP_DOCS } from './docs';
import {
  DEFAULT_REFRESH_SECONDS,
  DEFAULT_TILE_CACHE,
  MAX_REFRESH_SECONDS,
  MAX_TILE_CACHE,
  MIN_REFRESH_SECONDS,
  MIN_TILE_CACHE,
  RENDER_MODES,
  SETTING_AUTO_REFRESH,
  SETTING_DEFAULT_MODE,
  SETTING_DIRECTORY,
  SETTING_FOLLOW_PLAYER,
  SETTING_LAYER_CROSSHAIR,
  SETTING_LAYER_MARKERS,
  SETTING_LAYER_PLAYER,
  SETTING_LAYER_REGION_GRID,
  SETTING_REFRESH_SECONDS,
  SETTING_REVEAL_FOLDER,
  SETTING_SMOOTHING,
  SETTING_TILE_CACHE,
  STORE_CAMERA,
  STORE_MARKERS,
  TAB_ID,
  CANVAS_ID,
  JUMP_ID,
  LAYERS_ID,
  MARKERS_ID,
  READOUT_ID,
  WORLDLENS_ID,
  joinPath
} from './model';
import { mountMapTab } from './panel';
import { MAP_STRINGS } from './strings';

/* ================================================================== */
/* Settings                                                            */
/* ================================================================== */

/**
 * Finds the folder tiles are actually read from, mirroring the same two
 * candidates the tile source checks: the configured folder itself, or an
 * `overview` folder inside it. Used by the "reveal folder" setting action,
 * which can run before the tab has ever been opened and so cannot borrow the
 * tab's own resolved directory.
 */
async function resolveTileFolder(ctx: AppContext, directory: string): Promise<string | null> {
  const trimmed = directory.trim();
  if (trimmed === '') return null;
  const candidates = [joinPath(trimmed, 'meta.json'), joinPath(trimmed, 'overview', 'meta.json')];
  for (const candidate of candidates) {
    const stat = await ctx.studio.fs.stat(candidate);
    if (stat.ok && stat.value.exists && stat.value.isFile) {
      return candidate.slice(0, candidate.length - 'meta.json'.length).replace(/[\\/]+$/, '');
    }
  }
  const base = await ctx.studio.fs.stat(trimmed);
  return base.ok && base.value.exists ? trimmed : null;
}

function settingsSection(): SettingsSection {
  return {
    id: 'map',
    title: 'map.settings.section',
    icon: 'map',
    order: 140,
    controls: [
      {
        id: SETTING_DIRECTORY,
        label: 'map.overviewDirectory',
        description: 'map.overviewDirectory.description',
        kind: 'folder',
        defaultValue: '',
        keywords: ['map', 'world', 'folder', 'overview', 'directory', 'tiles', '地圖', '資料夾']
      },
      {
        id: SETTING_AUTO_REFRESH,
        label: 'map.autoRefresh',
        description: 'map.autoRefresh.description',
        kind: 'switch',
        defaultValue: true,
        keywords: ['refresh', 'automatic', 'poll', 'map']
      },
      {
        id: SETTING_REFRESH_SECONDS,
        label: 'map.refreshSeconds',
        description: 'map.refreshSeconds.description',
        kind: 'number',
        defaultValue: DEFAULT_REFRESH_SECONDS,
        min: MIN_REFRESH_SECONDS,
        max: MAX_REFRESH_SECONDS,
        step: 1,
        hint: 'map.refreshSeconds.hint',
        keywords: ['refresh', 'seconds', 'interval', 'map'],
        validate: (value) => {
          const seconds = Number(value);
          if (!Number.isFinite(seconds) || seconds < MIN_REFRESH_SECONDS || seconds > MAX_REFRESH_SECONDS) {
            return `Use a whole number of seconds between ${String(MIN_REFRESH_SECONDS)} and ${String(MAX_REFRESH_SECONDS)}. Nothing was changed.`;
          }
          return null;
        }
      },
      {
        id: SETTING_DEFAULT_MODE,
        label: 'map.defaultMode',
        description: 'map.defaultMode.description',
        kind: 'select',
        defaultValue: 'normal',
        options: RENDER_MODES.map((mode) => ({ value: mode, label: `map.mode.${mode}` })),
        keywords: ['render', 'mode', 'surface', 'caves', 'map']
      },
      {
        id: SETTING_FOLLOW_PLAYER,
        label: 'map.followPlayer',
        description: 'map.followPlayer.description',
        kind: 'switch',
        defaultValue: true,
        keywords: ['follow', 'player', 'centre', 'map']
      },
      {
        id: SETTING_LAYER_MARKERS,
        label: 'map.layer.markers',
        description: 'map.layer.markers.description',
        kind: 'switch',
        defaultValue: true,
        keywords: ['markers', 'layer', 'map']
      },
      {
        id: SETTING_LAYER_PLAYER,
        label: 'map.layer.player',
        description: 'map.layer.player.description',
        kind: 'switch',
        defaultValue: true,
        keywords: ['player', 'marker', 'layer', 'map']
      },
      {
        id: SETTING_LAYER_REGION_GRID,
        label: 'map.layer.regionGrid',
        description: 'map.layer.regionGrid.description',
        kind: 'switch',
        defaultValue: false,
        keywords: ['grid', 'region', 'layer', 'map']
      },
      {
        id: SETTING_LAYER_CROSSHAIR,
        label: 'map.layer.crosshair',
        description: 'map.layer.crosshair.description',
        kind: 'switch',
        defaultValue: true,
        keywords: ['crosshair', 'centre', 'layer', 'map']
      },
      {
        id: SETTING_SMOOTHING,
        label: 'map.smoothing',
        description: 'map.smoothing.description',
        kind: 'switch',
        defaultValue: true,
        keywords: ['smoothing', 'zoom', 'blend', 'map']
      },
      {
        id: SETTING_TILE_CACHE,
        label: 'map.tileCacheSize',
        description: 'map.tileCacheSize.description',
        kind: 'number',
        defaultValue: DEFAULT_TILE_CACHE,
        min: MIN_TILE_CACHE,
        max: MAX_TILE_CACHE,
        step: 8,
        keywords: ['cache', 'memory', 'tiles', 'map'],
        validate: (value) => {
          const size = Number(value);
          if (!Number.isFinite(size) || size < MIN_TILE_CACHE || size > MAX_TILE_CACHE) {
            return `Use a whole number between ${String(MIN_TILE_CACHE)} and ${String(MAX_TILE_CACHE)}. Nothing was changed.`;
          }
          return null;
        }
      },
      {
        id: SETTING_REVEAL_FOLDER,
        label: 'map.revealFolder',
        description: 'map.revealFolder.description',
        kind: 'action',
        defaultValue: null,
        keywords: ['reveal', 'open', 'folder', 'tiles', 'map'],
        run: async (settingCtx) => {
          const directory = String(settingCtx.settings.get(SETTING_DIRECTORY, ''));
          const resolved = await resolveTileFolder(settingCtx, directory);
          if (!resolved) {
            settingCtx.notify.warn(
              settingCtx.t('map.revealFolder', 'Show the tile folder'),
              settingCtx.t('map.empty.noFolder.title', 'No world folder is chosen yet')
            );
            return;
          }
          const opened = await settingCtx.studio.shell.openPath(resolved);
          if (!opened.ok) {
            settingCtx.notify.error(
              settingCtx.t('map.revealFolder', 'Show the tile folder'),
              settingCtx.t('map.notify.folderFailed', 'That folder could not be opened: {error}', {
                values: { error: opened.error }
              })
            );
          }
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
    SETTING_DIRECTORY,
    SETTING_AUTO_REFRESH,
    SETTING_REFRESH_SECONDS,
    SETTING_DEFAULT_MODE,
    SETTING_FOLLOW_PLAYER,
    SETTING_LAYER_MARKERS,
    SETTING_LAYER_PLAYER,
    SETTING_LAYER_REGION_GRID,
    SETTING_LAYER_CROSSHAIR,
    SETTING_SMOOTHING,
    SETTING_TILE_CACHE
  ];

  const entries: PaletteEntry[] = [
    {
      id: 'map.command.open',
      title: 'map.palette.open',
      kind: 'destination',
      icon: 'map',
      keywords: ['map', 'live', 'overview', 'tiles', '地圖'],
      teleport: { tabId: TAB_ID, elementId: CANVAS_ID },
      run: () => {
        contextRef?.tabs.open(TAB_ID);
      }
    },
    {
      id: 'map.command.jump',
      title: 'map.palette.jump',
      kind: 'destination',
      icon: 'pin',
      keywords: ['coordinates', 'jump', 'teleport', 'go to', '坐標'],
      teleport: { tabId: TAB_ID, elementId: JUMP_ID },
      run: () => {
        contextRef?.tabs.open(TAB_ID);
      }
    },
    {
      id: 'map.command.markers',
      title: 'map.palette.markers',
      kind: 'destination',
      icon: 'pin',
      keywords: ['markers', 'pins', 'places', '標記'],
      teleport: { tabId: TAB_ID, elementId: MARKERS_ID },
      run: () => {
        contextRef?.tabs.open(TAB_ID);
      }
    },
    {
      id: 'map.command.layers',
      title: 'map.palette.layers',
      kind: 'destination',
      icon: 'tune',
      keywords: ['layers', 'dimension', 'mode', '圖層'],
      teleport: { tabId: TAB_ID, elementId: LAYERS_ID },
      run: () => {
        contextRef?.tabs.open(TAB_ID);
      }
    },
    {
      id: 'map.command.readout',
      title: 'map.readout.title',
      kind: 'destination',
      icon: 'world',
      keywords: ['position', 'zoom', 'centre', '位置'],
      teleport: { tabId: TAB_ID, elementId: READOUT_ID },
      run: () => {
        contextRef?.tabs.open(TAB_ID);
      }
    },
    {
      id: 'map.command.worldlens',
      title: 'map.palette.worldlens',
      kind: 'destination',
      icon: 'world',
      keywords: ['worldlens', 'render', '3d', 'companion'],
      teleport: { tabId: TAB_ID, elementId: WORLDLENS_ID },
      run: () => {
        contextRef?.tabs.open(TAB_ID);
      }
    },
    {
      id: 'map.command.refresh',
      title: 'map.palette.refresh',
      kind: 'command',
      icon: 'refresh',
      keywords: ['reload', 'refresh', 'map'],
      run: () => {
        // Opening the tab is enough: mounting re-reads the index immediately,
        // and there is nothing to refresh while the canvas does not exist.
        contextRef?.tabs.open(TAB_ID);
      }
    }
  ];

  for (const id of settingIds) {
    entries.push({
      id: `map.setting.${id}`,
      title: id,
      kind: 'setting',
      settingId: id,
      icon: 'tune',
      keywords: ['map', 'setting', id]
    });
  }

  return entries;
}

/* ================================================================== */
/* The module                                                          */
/* ================================================================== */

let contextRef: AppContext | null = null;

export default defineFeature({
  id: 'map',
  name: 'Live map',
  description:
    'A pannable, zoomable viewer for the region tiles the downloader’s headless overview renderer writes to disk, with layer controls, a coordinate readout and user-saved markers. Reads local files only; renders nothing itself.',
  strings: MAP_STRINGS,
  docs: MAP_DOCS,
  settings: [settingsSection()],
  palette: paletteEntries(),
  tabs: [
    {
      id: TAB_ID,
      title: 'map.tab',
      icon: 'map',
      order: 220,
      mount: (host, tabCtx) => {
        mountMapTab(host, tabCtx);
      }
    }
  ],
  init: (ctx) => {
    contextRef = ctx;
    // These two keys are live application state (the marker list and the
    // remembered camera), not settings a person edits directly, so they have
    // no `SettingControl` of their own to declare a default for them.
    ctx.settings.declareDefault(STORE_MARKERS, []);
    ctx.settings.declareDefault(STORE_CAMERA, null);
  }
});
