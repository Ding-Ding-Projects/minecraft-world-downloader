/**
 * Chunk operations driven from the rendered map (inventory row 13.10).
 *
 * This is the integration surface. Everything that actually reads occupancy,
 * rewrites coordinates, or talks to the vault lives in `model.ts` (types,
 * coordinate math, path building), `worker-source.ts` + `workerClient.ts`
 * (the privileged Anvil/NBT worker), `editLog.ts` (the persisted log store)
 * and `panel.ts` (wiring it all into one tab). This file registers that tab,
 * its settings, the palette entries that find it, and its documentation.
 */

import { defineFeature } from '../../core/registry';
import type { PaletteEntry, SettingsSection } from '../../core/registry';
import './styles.css';
import { WORLD_VAULT_EDIT_DOCS } from './docs';
import {
  DIMENSION_OPTIONS,
  GRID_ID,
  LOG_ID,
  SELECTION_ID,
  SETTING_CUSTOM_DIMENSION_PATH,
  SETTING_DIMENSION,
  SETTING_WORLD_DIRECTORY,
  STORE_EDIT_LOG,
  STORE_GRID_ORIGIN,
  TAB_ID
} from './model';
import { mountWorldVaultEditTab } from './panel';
import { WORLD_VAULT_EDIT_STRINGS } from './strings';

function settingsSection(): SettingsSection {
  return {
    id: 'worldvaultedit',
    title: 'worldvaultedit.tab',
    icon: 'edit',
    order: 145,
    controls: [
      {
        id: SETTING_WORLD_DIRECTORY,
        label: 'worldvaultedit.worldDirectory',
        description: 'worldvaultedit.worldDirectory.hint',
        kind: 'folder',
        defaultValue: '',
        keywords: ['chunk', 'edit', 'copy', 'remove', 'vault', 'world', 'folder', '區塊', '複製', '移除']
      },
      {
        id: SETTING_DIMENSION,
        label: 'worldvaultedit.dimension',
        description: 'worldvaultedit.config.description',
        kind: 'select',
        defaultValue: 'overworld',
        options: DIMENSION_OPTIONS.map((option) => ({ value: option.id, label: option.labelKey })),
        keywords: ['dimension', 'overworld', 'nether', 'end', '維度']
      },
      {
        id: SETTING_CUSTOM_DIMENSION_PATH,
        label: 'worldvaultedit.customDimensionPath',
        description: 'worldvaultedit.customDimensionPath.hint',
        kind: 'text',
        defaultValue: '',
        keywords: ['custom', 'dimension', 'modded', '自訂']
      }
    ]
  };
}

function paletteEntries(): PaletteEntry[] {
  return [
    {
      id: 'worldvaultedit.command.open',
      title: 'worldvaultedit.tab',
      kind: 'destination',
      icon: 'edit',
      keywords: ['chunk', 'copy', 'remove', 'vault', 'edit', '區塊'],
      teleport: { tabId: TAB_ID, elementId: GRID_ID }
    },
    {
      id: 'worldvaultedit.command.selection',
      title: 'worldvaultedit.selection.title',
      kind: 'destination',
      icon: 'copy',
      keywords: ['selection', 'copy', 'destination', '選取'],
      teleport: { tabId: TAB_ID, elementId: SELECTION_ID }
    },
    {
      id: 'worldvaultedit.command.log',
      title: 'worldvaultedit.log.title',
      kind: 'destination',
      icon: 'history',
      keywords: ['log', 'history', 'commit', '記錄'],
      teleport: { tabId: TAB_ID, elementId: LOG_ID }
    },
    {
      id: 'worldvaultedit.setting.worldDirectory',
      title: SETTING_WORLD_DIRECTORY,
      kind: 'setting',
      settingId: SETTING_WORLD_DIRECTORY,
      icon: 'folder',
      keywords: ['world', 'folder', 'directory']
    },
    {
      id: 'worldvaultedit.setting.dimension',
      title: SETTING_DIMENSION,
      kind: 'setting',
      settingId: SETTING_DIMENSION,
      icon: 'world',
      keywords: ['dimension']
    }
  ];
}

export default defineFeature({
  id: 'world-vault-edit',
  name: 'World vault: chunk operations',
  description:
    'Copies or removes chunks in a downloaded world from a real occupancy grid, rewriting every absolute position a copied chunk carries and recording every edit as a vault commit.',
  strings: WORLD_VAULT_EDIT_STRINGS,
  docs: WORLD_VAULT_EDIT_DOCS,
  settings: [settingsSection()],
  palette: paletteEntries(),
  tabs: [
    {
      id: TAB_ID,
      title: 'worldvaultedit.tab',
      icon: 'edit',
      order: 130,
      mount: (host, tabCtx) => {
        mountWorldVaultEditTab(host, tabCtx);
      }
    }
  ],
  init: (ctx) => {
    ctx.settings.declareDefault(STORE_EDIT_LOG, []);
    ctx.settings.declareDefault(STORE_GRID_ORIGIN, null);
  }
});
