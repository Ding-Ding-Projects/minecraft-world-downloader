/**
 * The mineflayer bot runtime feature.
 *
 * Owns the one Node child process that runs the vendored `mineflayer` library
 * (see `runtime.ts` and `bot-host.js`), the saved connection profiles and
 * multi-bot session bookkeeping (`store.ts`, `manager.ts`), the guided
 * connection form and live-state read-out (`ui-bots.ts`, row 15.1 and 15.2),
 * the event inspector (`ui-events.ts`, row 15.18), and the typed contract the
 * four sibling mineflayer features drive a bot through (`bridge.ts`).
 */

import { defineFeature } from '../../core/registry';
import type { AppContext, DocArticle, PaletteEntry, SettingsSection, TabContext } from '../../core/registry';
import './styles.css';

import { BotRuntimeClient } from './runtime';
import { BotManager } from './manager';
import {
  ProfileStore,
  declareStoreDefaults,
  DEFAULT_AUTH_ID,
  DEFAULT_CHAT_ID,
  DEFAULT_MAIN_HAND_ID,
  DEFAULT_RECONNECT_ENABLED_ID,
  DEFAULT_RECONNECT_MAX_ATTEMPTS_ID,
  DEFAULT_RECONNECT_ON_KICK_ID,
  DEFAULT_VIEW_DISTANCE_ID,
  EVENT_BUFFER_SIZE_ID,
  DEFAULT_EVENT_BUFFER_SIZE
} from './store';
import { initSiblingBridge, disposeSiblingBridge } from './bridge';
import { mountBotsTab } from './ui-bots';
import { mountEventsTab } from './ui-events';
import { MINEFLAYER_STRINGS } from './strings';
import { MINEFLAYER_DOCS } from './docs';

let runtime: BotRuntimeClient | null = null;
let manager: BotManager | null = null;
let profiles: ProfileStore | null = null;

function settingsSection(): SettingsSection {
  return {
    id: 'mineflayer.settings.defaults',
    title: 'mineflayer.settings.title',
    icon: 'world',
    order: 150,
    controls: [
      {
        id: DEFAULT_VIEW_DISTANCE_ID,
        label: 'mineflayer.form.viewDistance',
        description: 'mineflayer.settings.viewDistance.description',
        kind: 'select',
        defaultValue: 'normal',
        options: [
          { value: 'far', label: 'mineflayer.form.viewDistance.far' },
          { value: 'normal', label: 'mineflayer.form.viewDistance.normal' },
          { value: 'short', label: 'mineflayer.form.viewDistance.short' },
          { value: 'tiny', label: 'mineflayer.form.viewDistance.tiny' }
        ],
        keywords: ['mineflayer', 'bot', 'view', 'distance', 'chunks']
      },
      {
        id: DEFAULT_CHAT_ID,
        label: 'mineflayer.form.chat',
        description: 'mineflayer.settings.chat.description',
        kind: 'select',
        defaultValue: 'enabled',
        options: [
          { value: 'enabled', label: 'mineflayer.form.chat.enabled' },
          { value: 'commandsOnly', label: 'mineflayer.form.chat.commandsOnly' },
          { value: 'disabled', label: 'mineflayer.form.chat.disabled' }
        ],
        keywords: ['mineflayer', 'bot', 'chat', 'default']
      },
      {
        id: DEFAULT_AUTH_ID,
        label: 'mineflayer.form.auth',
        description: 'mineflayer.settings.auth.description',
        kind: 'select',
        defaultValue: 'offline',
        options: [
          { value: 'offline', label: 'mineflayer.form.auth.offline' },
          { value: 'microsoft', label: 'mineflayer.form.auth.microsoft' },
          { value: 'mojang', label: 'mineflayer.form.auth.mojang' }
        ],
        keywords: ['mineflayer', 'bot', 'auth', 'login', 'microsoft', 'mojang', 'offline']
      },
      {
        id: DEFAULT_MAIN_HAND_ID,
        label: 'mineflayer.form.mainHand',
        description: 'mineflayer.settings.mainHand.description',
        kind: 'select',
        defaultValue: 'right',
        options: [
          { value: 'right', label: 'mineflayer.form.mainHand.right' },
          { value: 'left', label: 'mineflayer.form.mainHand.left' }
        ],
        keywords: ['mineflayer', 'bot', 'hand']
      },
      {
        id: DEFAULT_RECONNECT_ENABLED_ID,
        label: 'mineflayer.form.reconnect',
        description: 'mineflayer.settings.reconnectEnabled.description',
        kind: 'switch',
        defaultValue: true,
        keywords: ['mineflayer', 'bot', 'reconnect']
      },
      {
        id: DEFAULT_RECONNECT_ON_KICK_ID,
        label: 'mineflayer.form.reconnectOnKick',
        description: 'mineflayer.settings.reconnectOnKick.description',
        kind: 'switch',
        defaultValue: false,
        keywords: ['mineflayer', 'bot', 'reconnect', 'kick']
      },
      {
        id: DEFAULT_RECONNECT_MAX_ATTEMPTS_ID,
        label: 'mineflayer.form.reconnectMax',
        description: 'mineflayer.settings.reconnectMaxAttempts.description',
        kind: 'number',
        defaultValue: 0,
        min: 0,
        max: 1000,
        keywords: ['mineflayer', 'bot', 'reconnect', 'attempts']
      },
      {
        id: EVENT_BUFFER_SIZE_ID,
        label: 'mineflayer.settings.eventBufferSize.label',
        description: 'mineflayer.settings.eventBufferSize.description',
        kind: 'slider',
        defaultValue: DEFAULT_EVENT_BUFFER_SIZE,
        min: 100,
        max: 20000,
        step: 100,
        keywords: ['mineflayer', 'bot', 'events', 'buffer', 'retention', 'inspector']
      }
    ]
  };
}

function paletteEntries(): PaletteEntry[] {
  return [
    {
      id: 'mineflayer.palette.bots',
      title: 'mineflayer.tab.bots',
      subtitle: 'mineflayer.tab.bots.subtitle',
      icon: 'world',
      kind: 'destination',
      keywords: ['mineflayer', 'bot', 'minecraft', 'connect', 'server', 'profile'],
      teleport: { tabId: 'mineflayer.bots' }
    },
    {
      id: 'mineflayer.palette.events',
      title: 'mineflayer.tab.events',
      subtitle: 'mineflayer.tab.events.subtitle',
      icon: 'terminal',
      kind: 'destination',
      keywords: ['mineflayer', 'bot', 'events', 'inspector', 'log'],
      teleport: { tabId: 'mineflayer.events' }
    },
    {
      id: 'mineflayer.palette.eventBufferSize',
      title: 'mineflayer.settings.eventBufferSize.label',
      icon: 'tune',
      kind: 'setting',
      settingId: EVENT_BUFFER_SIZE_ID,
      keywords: ['mineflayer', 'bot', 'events', 'buffer', 'retention']
    }
  ];
}

export default defineFeature({
  id: 'mineflayer',
  name: 'Minecraft bots',
  description:
    'Runs mineflayer bots in a sandboxed Node runtime behind an allow-listed method surface: connections, live state, saved multi-bot profiles and a full event inspector.',

  strings: MINEFLAYER_STRINGS,
  settings: [settingsSection()],
  palette: paletteEntries(),
  docs: MINEFLAYER_DOCS,

  tabs: [
    {
      id: 'mineflayer.bots',
      title: 'mineflayer.tab.bots',
      icon: 'world',
      group: 'group.bot-control',
      order: 400,
      mount(host: HTMLElement, ctx: TabContext) {
        if (!manager || !profiles) {
          host.append(
            ctx.components.emptyState({
              title: ctx.t('mineflayer.runtime.idle', 'Bot runtime not started yet'),
              body: ctx.t('mineflayer.runtime.notStarted', 'The bot runtime has not started.')
            })
          );
          return;
        }
        mountBotsTab(host, ctx, manager, profiles);
      }
    },
    {
      id: 'mineflayer.events',
      title: 'mineflayer.tab.events',
      icon: 'terminal',
      group: 'group.bot-control',
      order: 401,
      mount(host: HTMLElement, ctx: TabContext) {
        if (!manager) {
          host.append(
            ctx.components.emptyState({
              title: ctx.t('mineflayer.runtime.idle', 'Bot runtime not started yet'),
              body: ctx.t('mineflayer.runtime.notStarted', 'The bot runtime has not started.')
            })
          );
          return;
        }
        mountEventsTab(host, ctx, manager);
      }
    }
  ],

  init(ctx: AppContext) {
    declareStoreDefaults(ctx);

    runtime = new BotRuntimeClient(ctx);
    profiles = new ProfileStore(ctx);
    manager = new BotManager(ctx, runtime, profiles);

    initSiblingBridge(ctx, manager);

    ctx.studio.events.on('app:before-quit', () => {
      void manager?.disposeAll();
      disposeSiblingBridge();
    });
  }
});
