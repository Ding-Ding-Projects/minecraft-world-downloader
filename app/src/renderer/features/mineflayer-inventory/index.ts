/**
 * Inventory, containers, crafting, workstations and villager trading (rows
 * 15.5–15.9) — the whole item-handling half of the bot control surface.
 * Covers `lib/plugins/inventory.js`, `simple_inventory.js`, `chest.js`,
 * `craft.js`, `furnace.js`, `anvil.js`, `enchantment_table.js`,
 * `villager.js` and `block_actions.js`.
 *
 * Every real bot session comes from `../mineflayer/bridge`'s generic
 * `getMineflayerRuntimeContract()` — see `session.ts`. This feature never
 * opens a bot connection of its own.
 */

import { defineFeature } from '../../core/registry';
import type { AppContext, SettingsSection, TabContext } from '../../core/registry';
import './styles.css';

import { mountInventoryTab } from './inventory-panel';
import { mountContainersTab } from './containers-panel';
import { mountCraftingTab } from './crafting-panel';
import { mountWorkstationsTab } from './workstations-panel';
import { mountVillagersTab } from './villagers-panel';
import { MINEFLAYER_INVENTORY_STRINGS } from './strings';
import { MINEFLAYER_INVENTORY_DOCS } from './docs';
import {
  AUTO_REFRESH_ID,
  DEFAULT_AUTO_REFRESH,
  DEFAULT_SEARCH_LIMIT,
  DEFAULT_SEARCH_RADIUS,
  SEARCH_LIMIT_ID,
  SEARCH_RADIUS_ID
} from './settings';

function settingsSection(): SettingsSection {
  return {
    id: 'mineflayerInventory.settings',
    title: 'mineflayerInventory.settings.title',
    icon: 'search',
    order: 245,
    controls: [
      {
        id: SEARCH_RADIUS_ID,
        label: 'mineflayerInventory.settings.radius',
        description: 'mineflayerInventory.settings.radius.description',
        kind: 'slider',
        defaultValue: DEFAULT_SEARCH_RADIUS,
        min: 4,
        max: 128,
        step: 4,
        keywords: ['mineflayer', 'inventory', 'container', 'workstation', 'villager', 'radius', 'search']
      },
      {
        id: SEARCH_LIMIT_ID,
        label: 'mineflayerInventory.settings.limit',
        description: 'mineflayerInventory.settings.limit.description',
        kind: 'slider',
        defaultValue: DEFAULT_SEARCH_LIMIT,
        min: 4,
        max: 128,
        step: 4,
        keywords: ['mineflayer', 'inventory', 'container', 'workstation', 'villager', 'limit', 'results']
      },
      {
        id: AUTO_REFRESH_ID,
        label: 'mineflayerInventory.settings.autoRefresh',
        description: 'mineflayerInventory.settings.autoRefresh.description',
        kind: 'switch',
        defaultValue: DEFAULT_AUTO_REFRESH,
        keywords: ['mineflayer', 'inventory', 'refresh', 'poll']
      }
    ]
  };
}

export default defineFeature({
  id: 'mineflayer-inventory',
  name: 'Bot inventory',
  description:
    'The bot\'s real inventory, nearby containers, a recipe browser checked against the real inventory, furnace/anvil/enchanting-table workstations, and a nearby villager list — driving whichever bot the mineflayer feature has active.',

  strings: MINEFLAYER_INVENTORY_STRINGS,
  settings: [settingsSection()],
  docs: MINEFLAYER_INVENTORY_DOCS,

  palette: [
    {
      id: 'mineflayerInventory.palette.inventory',
      title: 'mineflayerInventory.tab.inventory',
      subtitle: 'mineflayerInventory.tab.inventory.subtitle',
      icon: 'folder',
      kind: 'destination',
      keywords: ['mineflayer', 'bot', 'inventory', 'items', 'slots', 'equip', 'drop'],
      teleport: { tabId: 'mineflayerInventory.inventory' }
    },
    {
      id: 'mineflayerInventory.palette.containers',
      title: 'mineflayerInventory.tab.containers',
      subtitle: 'mineflayerInventory.tab.containers.subtitle',
      icon: 'dock',
      kind: 'destination',
      keywords: ['mineflayer', 'bot', 'chest', 'dispenser', 'dropper', 'hopper', 'shulker', 'ender chest', 'barrel', 'container'],
      teleport: { tabId: 'mineflayerInventory.containers' }
    },
    {
      id: 'mineflayerInventory.palette.crafting',
      title: 'mineflayerInventory.tab.crafting',
      subtitle: 'mineflayerInventory.tab.crafting.subtitle',
      icon: 'tune',
      kind: 'destination',
      keywords: ['mineflayer', 'bot', 'craft', 'recipe', 'crafting table'],
      teleport: { tabId: 'mineflayerInventory.crafting' }
    },
    {
      id: 'mineflayerInventory.palette.workstations',
      title: 'mineflayerInventory.tab.workstations',
      subtitle: 'mineflayerInventory.tab.workstations.subtitle',
      icon: 'bolt',
      kind: 'destination',
      keywords: ['mineflayer', 'bot', 'furnace', 'blast furnace', 'smoker', 'anvil', 'enchanting table', 'enchant'],
      teleport: { tabId: 'mineflayerInventory.workstations' }
    },
    {
      id: 'mineflayerInventory.palette.villagers',
      title: 'mineflayerInventory.tab.villagers',
      subtitle: 'mineflayerInventory.tab.villagers.subtitle',
      icon: 'book',
      kind: 'destination',
      keywords: ['mineflayer', 'bot', 'villager', 'trade', 'trading'],
      teleport: { tabId: 'mineflayerInventory.villagers' }
    },
    {
      id: 'mineflayerInventory.palette.searchRadius',
      title: 'mineflayerInventory.settings.radius',
      icon: 'search',
      kind: 'setting',
      settingId: SEARCH_RADIUS_ID,
      keywords: ['mineflayer', 'inventory', 'radius']
    }
  ],

  tabs: [
    {
      id: 'mineflayerInventory.inventory',
      title: 'mineflayerInventory.tab.inventory',
      icon: 'folder',
      group: 'group.bot-control',
      order: 430,
      mount(host: HTMLElement, ctx: TabContext) {
        mountInventoryTab(host, ctx);
      }
    },
    {
      id: 'mineflayerInventory.containers',
      title: 'mineflayerInventory.tab.containers',
      icon: 'dock',
      group: 'group.bot-control',
      order: 431,
      mount(host: HTMLElement, ctx: TabContext) {
        mountContainersTab(host, ctx);
      }
    },
    {
      id: 'mineflayerInventory.crafting',
      title: 'mineflayerInventory.tab.crafting',
      icon: 'tune',
      group: 'group.bot-control',
      order: 432,
      mount(host: HTMLElement, ctx: TabContext) {
        mountCraftingTab(host, ctx);
      }
    },
    {
      id: 'mineflayerInventory.workstations',
      title: 'mineflayerInventory.tab.workstations',
      icon: 'bolt',
      group: 'group.bot-control',
      order: 433,
      mount(host: HTMLElement, ctx: TabContext) {
        mountWorkstationsTab(host, ctx);
      }
    },
    {
      id: 'mineflayerInventory.villagers',
      title: 'mineflayerInventory.tab.villagers',
      icon: 'book',
      group: 'group.bot-control',
      order: 434,
      mount(host: HTMLElement, ctx: TabContext) {
        mountVillagersTab(host, ctx);
      }
    }
  ],

  init(ctx: AppContext) {
    ctx.settings.declareDefault(SEARCH_RADIUS_ID, DEFAULT_SEARCH_RADIUS);
    ctx.settings.declareDefault(SEARCH_LIMIT_ID, DEFAULT_SEARCH_LIMIT);
    ctx.settings.declareDefault(AUTO_REFRESH_ID, DEFAULT_AUTO_REFRESH);
  }
});
