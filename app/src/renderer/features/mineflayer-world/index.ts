/**
 * World interaction: dig, place, activate, look up blocks, drive nearby
 * entities, fish, sleep, write and sign books, use creative tools, watch
 * world ambience and answer resource-pack requests.
 *
 * Inventory rows 15.10-15.17. See `docs/features/mineflayer-world.md` and
 * `panel.ts` for the full behaviour and the exact vendored plugins each
 * section covers. This feature never opens a bot connection itself -- it
 * drives whichever session the `mineflayer` feature publishes through its
 * `bridge.ts` (`contract.ts` finds it dynamically, so this feature builds
 * and runs whether or not that sibling exists in a given build).
 */

import './styles.css';
import { defineFeature } from '../../core/registry';
import type { PaletteEntry, SettingsSection } from '../../core/registry';
import {
  AMBIENCE_ELEMENT,
  BLOCKS_ELEMENT,
  BOOK_ELEMENT,
  CONFIRM_MOB_ATTACKS_ID,
  CREATIVE_ELEMENT,
  DEFAULTS,
  DEFAULT_FIND_COUNT_ID,
  DEFAULT_FIND_DISTANCE_ID,
  ENTITIES_ELEMENT,
  ENTITY_POLL_MS_ID,
  EVENT_FEED_LIMIT_ID,
  FEATURE_ID,
  FIND_BLOCKS_ELEMENT,
  RESOURCE_PACK_ELEMENT,
  STATUS_ELEMENT,
  SURVIVAL_ELEMENT,
  TAB_ID
} from './model';
import { mountWorldTab } from './panel';
import { WORLD_STRINGS } from './strings';
import { WORLD_DOCS } from './docs';

function settingsSection(): SettingsSection {
  return {
    id: FEATURE_ID,
    title: 'mineflayerWorld.settings.title',
    icon: 'world',
    order: 250,
    controls: [
      {
        id: ENTITY_POLL_MS_ID,
        label: 'mineflayerWorld.settings.entityPollMs',
        description: 'mineflayerWorld.settings.entityPollMs.description',
        kind: 'number',
        defaultValue: DEFAULTS.entityPollMs,
        min: 250,
        max: 10_000,
        step: 250,
        hint: 'ms',
        keywords: ['entities', 'poll', 'refresh', 'world'],
        validate: (value) => {
          const ms = Number(value);
          return Number.isFinite(ms) && ms >= 250 && ms <= 10_000 ? null : 'Use a number of milliseconds from 250 to 10000.';
        }
      },
      {
        id: EVENT_FEED_LIMIT_ID,
        label: 'mineflayerWorld.settings.eventFeedLimit',
        description: 'mineflayerWorld.settings.eventFeedLimit.description',
        kind: 'number',
        defaultValue: DEFAULTS.eventFeedLimit,
        min: 20,
        max: 5000,
        step: 20,
        keywords: ['ambience', 'feed', 'events', 'buffer', 'world'],
        validate: (value) => {
          const limit = Number(value);
          return Number.isFinite(limit) && limit >= 20 && limit <= 5000 ? null : 'Use a whole number from 20 to 5000.';
        }
      },
      {
        id: CONFIRM_MOB_ATTACKS_ID,
        label: 'mineflayerWorld.settings.confirmMobAttacks',
        description: 'mineflayerWorld.settings.confirmMobAttacks.description',
        kind: 'switch',
        defaultValue: DEFAULTS.confirmMobAttacks,
        keywords: ['attack', 'confirm', 'mob', 'entity', 'world']
      },
      {
        id: DEFAULT_FIND_DISTANCE_ID,
        label: 'mineflayerWorld.settings.defaultFindDistance',
        description: 'mineflayerWorld.settings.defaultFindDistance.description',
        kind: 'number',
        defaultValue: DEFAULTS.defaultFindDistance,
        min: 1,
        max: 256,
        step: 1,
        hint: 'm',
        keywords: ['find', 'blocks', 'radius', 'distance', 'world'],
        validate: (value) => {
          const distance = Number(value);
          return Number.isFinite(distance) && distance >= 1 && distance <= 256 ? null : 'Use a number of metres from 1 to 256.';
        }
      },
      {
        id: DEFAULT_FIND_COUNT_ID,
        label: 'mineflayerWorld.settings.defaultFindCount',
        description: 'mineflayerWorld.settings.defaultFindCount.description',
        kind: 'number',
        defaultValue: DEFAULTS.defaultFindCount,
        min: 1,
        max: 4096,
        step: 1,
        keywords: ['find', 'blocks', 'count', 'results', 'world'],
        validate: (value) => {
          const count = Number(value);
          return Number.isFinite(count) && count >= 1 && count <= 4096 ? null : 'Use a whole number from 1 to 4096.';
        }
      }
    ]
  };
}

function paletteEntries(): PaletteEntry[] {
  const entries: PaletteEntry[] = [
    {
      id: 'mineflayerWorld.command.open',
      title: 'mineflayerWorld.tab.title',
      icon: 'world',
      kind: 'destination',
      keywords: ['world', 'dig', 'place', 'block', 'entity', 'bot', 'minecraft'],
      teleport: { tabId: TAB_ID, elementId: STATUS_ELEMENT }
    },
    {
      id: 'mineflayerWorld.command.blocks',
      title: 'mineflayerWorld.blocks.heading',
      icon: 'world',
      kind: 'destination',
      keywords: ['dig', 'place', 'activate', 'block', 'ray', 'target'],
      teleport: { tabId: TAB_ID, elementId: BLOCKS_ELEMENT }
    },
    {
      id: 'mineflayerWorld.command.find',
      title: 'mineflayerWorld.find.heading',
      icon: 'search',
      kind: 'destination',
      keywords: ['find', 'blocks', 'search', 'radius'],
      teleport: { tabId: TAB_ID, elementId: FIND_BLOCKS_ELEMENT }
    },
    {
      id: 'mineflayerWorld.command.entities',
      title: 'mineflayerWorld.entities.heading',
      icon: 'world',
      kind: 'destination',
      keywords: ['entities', 'attack', 'mount', 'dismount', 'use on'],
      teleport: { tabId: TAB_ID, elementId: ENTITIES_ELEMENT }
    },
    {
      id: 'mineflayerWorld.command.survival',
      title: 'mineflayerWorld.survival.heading',
      icon: 'play',
      kind: 'destination',
      keywords: ['fish', 'sleep', 'wake', 'spawn', 'respawn'],
      teleport: { tabId: TAB_ID, elementId: SURVIVAL_ELEMENT }
    },
    {
      id: 'mineflayerWorld.command.book',
      title: 'mineflayerWorld.book.heading',
      icon: 'book',
      kind: 'destination',
      keywords: ['book', 'write', 'sign', 'page'],
      teleport: { tabId: TAB_ID, elementId: BOOK_ELEMENT }
    },
    {
      id: 'mineflayerWorld.command.creative',
      title: 'mineflayerWorld.creative.heading',
      icon: 'bolt',
      kind: 'destination',
      keywords: ['creative', 'give', 'fly', 'instant break'],
      teleport: { tabId: TAB_ID, elementId: CREATIVE_ELEMENT }
    },
    {
      id: 'mineflayerWorld.command.ambience',
      title: 'mineflayerWorld.ambience.heading',
      icon: 'notifications',
      kind: 'destination',
      keywords: ['time', 'weather', 'sound', 'particle', 'explosion', 'command block'],
      teleport: { tabId: TAB_ID, elementId: AMBIENCE_ELEMENT }
    },
    {
      id: 'mineflayerWorld.command.resourcePack',
      title: 'mineflayerWorld.pack.heading',
      icon: 'download',
      kind: 'destination',
      keywords: ['resource pack', 'texture', 'accept', 'decline'],
      teleport: { tabId: TAB_ID, elementId: RESOURCE_PACK_ELEMENT }
    }
  ];

  for (const id of [ENTITY_POLL_MS_ID, EVENT_FEED_LIMIT_ID, CONFIRM_MOB_ATTACKS_ID, DEFAULT_FIND_DISTANCE_ID, DEFAULT_FIND_COUNT_ID]) {
    entries.push({
      id: `mineflayerWorld.setting.${id}`,
      title: id,
      kind: 'setting',
      settingId: id,
      icon: 'tune',
      keywords: ['world', 'setting', id]
    });
  }

  return entries;
}

export default defineFeature({
  id: FEATURE_ID,
  name: 'World interaction',
  description:
    'Dig with tool selection and real progress, place and activate blocks, ray-trace a target, query and find blocks, drive nearby entities, fish, sleep, respawn, write and sign books, use creative tools, watch world ambience and answer resource-pack requests honestly.',

  strings: WORLD_STRINGS,
  docs: WORLD_DOCS,
  settings: [settingsSection()],
  palette: paletteEntries(),

  tabs: [
    {
      id: TAB_ID,
      title: 'mineflayerWorld.tab.title',
      icon: 'world',
      order: 402,
      mount(host, ctx) {
        mountWorldTab(host, ctx);
      }
    }
  ]
});
