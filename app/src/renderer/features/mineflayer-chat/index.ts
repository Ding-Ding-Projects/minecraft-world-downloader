import { defineFeature } from '../../core/registry';
import type { AppContext, PaletteEntry, SettingsSection } from '../../core/registry';
import './styles.css';
import { mountChatPanel } from './chatpanel';
import { MINEFLAYER_CHAT_DOCS } from './docs';
import {
  KEYS,
  REPLY_BUDGET_DEFAULT,
  REPLY_BUDGET_MAX,
  REPLY_BUDGET_MIN,
  RETENTION_DEFAULT,
  RETENTION_MAX,
  RETENTION_MIN,
  clampRetention
} from './model';
import { mountRulesPanel } from './rulepanel';
import { mountServerPanel } from './serverpanel';
import { ChatFeatureState } from './state';
import { CHAT_STRINGS } from './strings';

/**
 * Bot chat: the message log, the composer, pattern rules that can watch and
 * answer on your behalf, and the server text surfaces (tab list, boss bars,
 * scoreboards, teams, titles) drawn outside the chat box.
 *
 * This feature owns no bot connection. It follows whichever session the
 * `mineflayer` feature publishes through `./session`, and renders its honest
 * disconnected state whenever nothing is connected — never a simulated one.
 */

let state: ChatFeatureState | null = null;

function requireState(): ChatFeatureState | null {
  if (!state) console.error('The bot chat feature was used before its init ran.');
  return state;
}

/* ================================================================== */
/* Settings                                                            */
/* ================================================================== */

function settingsSection(): SettingsSection {
  return {
    id: 'mineflayer-chat',
    title: 'mineflayer-chat.settings.section',
    icon: 'terminal',
    order: 240,
    controls: [
      {
        id: KEYS.retention,
        label: 'mineflayer-chat.setting.retention',
        description: 'mineflayer-chat.setting.retention.description',
        kind: 'number',
        defaultValue: RETENTION_DEFAULT,
        min: RETENTION_MIN,
        max: RETENTION_MAX,
        step: 100,
        keywords: ['retention', 'log', 'messages', 'chat', 'limit'],
        validate: (value) => {
          const parsed = Number(value);
          if (!Number.isFinite(parsed) || parsed < RETENTION_MIN || parsed > RETENTION_MAX) {
            return `Use a whole number between ${RETENTION_MIN} and ${RETENTION_MAX}. Nothing was changed.`;
          }
          return null;
        }
      },
      {
        id: KEYS.timestamps,
        label: 'mineflayer-chat.setting.timestamps',
        description: 'mineflayer-chat.setting.timestamps.description',
        kind: 'switch',
        defaultValue: true,
        keywords: ['timestamp', 'time', 'clock', 'chat']
      },
      {
        id: KEYS.autoScroll,
        label: 'mineflayer-chat.setting.autoScroll',
        description: 'mineflayer-chat.setting.autoScroll.description',
        kind: 'switch',
        defaultValue: true,
        keywords: ['scroll', 'follow', 'chat', 'newest']
      },
      {
        id: KEYS.rulesEnabled,
        label: 'mineflayer-chat.setting.rulesEnabled',
        description: 'mineflayer-chat.setting.rulesEnabled.description',
        kind: 'switch',
        defaultValue: true,
        keywords: ['rules', 'pattern', 'automation', 'reply']
      },
      {
        id: KEYS.replyBudget,
        label: 'mineflayer-chat.setting.replyBudget',
        description: 'mineflayer-chat.setting.replyBudget.description',
        kind: 'slider',
        defaultValue: REPLY_BUDGET_DEFAULT,
        min: REPLY_BUDGET_MIN,
        max: REPLY_BUDGET_MAX,
        step: 1,
        keywords: ['budget', 'rules', 'rate limit', 'messages per minute'],
        validate: (value) => {
          const parsed = Number(value);
          if (!Number.isFinite(parsed) || parsed < REPLY_BUDGET_MIN || parsed > REPLY_BUDGET_MAX) {
            return `Use a whole number between ${REPLY_BUDGET_MIN} and ${REPLY_BUDGET_MAX}. Nothing was changed.`;
          }
          return null;
        }
      },
      {
        id: KEYS.exportFormat,
        label: 'mineflayer-chat.setting.exportFormat',
        description: 'mineflayer-chat.setting.exportFormat.description',
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
      }
    ]
  };
}

/* ================================================================== */
/* Palette                                                             */
/* ================================================================== */

function paletteEntries(): PaletteEntry[] {
  const settingIds = [KEYS.retention, KEYS.timestamps, KEYS.autoScroll, KEYS.rulesEnabled, KEYS.replyBudget, KEYS.exportFormat];

  const entries: PaletteEntry[] = [
    {
      id: 'mineflayer-chat.command.open',
      title: 'mineflayer-chat.palette.open',
      kind: 'destination',
      icon: 'terminal',
      keywords: ['bot', 'chat', 'mineflayer', '聊天'],
      teleport: { tabId: 'mineflayer-chat.chat' }
    },
    {
      id: 'mineflayer-chat.command.compose',
      title: 'mineflayer-chat.palette.compose',
      kind: 'destination',
      icon: 'save',
      keywords: ['send', 'whisper', 'command', 'chat'],
      teleport: { tabId: 'mineflayer-chat.chat', elementId: 'mineflayer-chat-composer-field' }
    },
    {
      id: 'mineflayer-chat.command.rules',
      title: 'mineflayer-chat.palette.rules',
      kind: 'destination',
      icon: 'filter',
      keywords: ['rules', 'pattern', 'regex', 'automation'],
      teleport: { tabId: 'mineflayer-chat.rules' }
    },
    {
      id: 'mineflayer-chat.command.server',
      title: 'mineflayer-chat.palette.server',
      kind: 'destination',
      icon: 'world',
      keywords: ['tablist', 'bossbar', 'scoreboard', 'team', 'title'],
      teleport: { tabId: 'mineflayer-chat.server' }
    },
    {
      id: 'mineflayer-chat.command.export',
      title: 'mineflayer-chat.palette.export',
      kind: 'command',
      icon: 'download',
      keywords: ['export', 'chat', 'log'],
      run: () => requireState()?.exportLog()
    },
    {
      id: 'mineflayer-chat.command.newRule',
      title: 'mineflayer-chat.palette.newRule',
      kind: 'command',
      icon: 'add',
      keywords: ['rule', 'new', 'pattern'],
      run: () => requireState()?.openNewRule()
    }
  ];

  for (const id of settingIds) {
    entries.push({
      id: `mineflayer-chat.setting.${id}`,
      title: id,
      kind: 'setting',
      settingId: id,
      icon: 'tune',
      keywords: ['mineflayer-chat', 'setting', id]
    });
  }

  return entries;
}

/* ================================================================== */
/* The module                                                          */
/* ================================================================== */

export default defineFeature({
  id: 'mineflayer-chat',
  name: 'Bot chat',
  description:
    'The bot’s message log, the composer for sending messages, whispers and commands, pattern rules that can watch and answer on your behalf, and the server text surfaces (tab list, boss bars, scoreboards, teams, titles) drawn outside the chat box.',
  strings: CHAT_STRINGS,
  docs: MINEFLAYER_CHAT_DOCS,
  settings: [settingsSection()],
  palette: paletteEntries(),
  tabs: [
    {
      id: 'mineflayer-chat.chat',
      title: 'mineflayer-chat.tab.title',
      icon: 'terminal',
      group: 'mineflayer-chat',
      order: 220,
      mount: (host, tabCtx) => {
        const current = requireState();
        if (!current) return;
        mountChatPanel(host, tabCtx, current);
      }
    },
    {
      id: 'mineflayer-chat.rules',
      title: 'mineflayer-chat.section.rules',
      icon: 'filter',
      group: 'mineflayer-chat',
      order: 221,
      mount: (host, tabCtx) => {
        const current = requireState();
        if (!current) return;
        mountRulesPanel(host, tabCtx, current);
      }
    },
    {
      id: 'mineflayer-chat.server',
      title: 'mineflayer-chat.section.server',
      icon: 'world',
      group: 'mineflayer-chat',
      order: 222,
      mount: (host, tabCtx) => {
        const current = requireState();
        if (!current) return;
        mountServerPanel(host, tabCtx, current);
      }
    }
  ],
  init: (ctx: AppContext) => {
    state = new ChatFeatureState(ctx);
    state.store.start();

    ctx.settings.declareDefault(KEYS.retention, RETENTION_DEFAULT);
    ctx.settings.declareDefault(KEYS.timestamps, true);
    ctx.settings.declareDefault(KEYS.autoScroll, true);
    ctx.settings.declareDefault(KEYS.rulesEnabled, true);
    ctx.settings.declareDefault(KEYS.replyBudget, REPLY_BUDGET_DEFAULT);
    ctx.settings.declareDefault(KEYS.exportFormat, 'json');

    // `ChatLog` caches its retention limit rather than re-reading settings on
    // every message, so a live change to the setting is applied here rather
    // than silently waiting for the next application restart to take effect.
    ctx.settings.onChange((change) => {
      if (change.id !== KEYS.retention) return;
      state?.store.setRetention(clampRetention(Number(change.value)));
    });
  }
});
