import { defineFeature } from '../../core/registry';
import type { AppContext, PaletteEntry, SettingsSection } from '../../core/registry';
import './styles.css';
import { BOT_DOCS } from './docs';
import { BOT_STRINGS } from './strings';
import { mountBotPanel } from './panel';
import { BotRunner } from './runner';
import {
  CAPTURE_ENABLED_ID,
  EXPORT_FORMAT_ID,
  FOLLOW_LOG_ID,
  LAST_PROFILE_KEY,
  LOG_ELEMENT,
  LOG_LIMIT_ID,
  MESSAGES_ELEMENT,
  MESSAGES_KEY,
  MESSAGE_LIMIT_ID,
  PROFILES_KEY,
  PROFILE_LIST_ELEMENT,
  RULES_KEY,
  RUN_CONTROLS_ELEMENT,
  SCRAPER_DIR_ID,
  STOP_SIGNAL_ID,
  TAB_ID,
  initStore
} from './state';
import type { BotStore } from './state';

/**
 * The chat scraper bot runner.
 *
 * This wires the already-written support modules — `state` (records and the
 * persisted store), `config` (translating a profile into the scraper's own
 * configuration, plus validation and presets), `capture` (turning raw output
 * lines into captured messages), `runner` (the real `node scrape.js` process),
 * `profileform` (the guided editor) and `panel` (the tab itself) — into one
 * registered feature: a tab, a settings section, palette entries, this
 * feature's documentation and its full bilingual copy catalogue.
 *
 * There is exactly one store and one runner for the whole application, created
 * once in `init` and shared by every mount of the tab, so a run started while
 * the tab was open keeps going — and keeps being tracked — if the tab is
 * closed and reopened.
 */

interface BotFeatureState {
  ctx: AppContext;
  store: BotStore;
  runner: BotRunner;
}

let state: BotFeatureState | null = null;

function requireState(): BotFeatureState | null {
  if (!state) console.error('The scraper bot feature was used before its init ran.');
  return state;
}

/* ================================================================== */
/* Settings                                                            */
/* ================================================================== */

function settingsSection(): SettingsSection {
  return {
    id: 'bot.settings',
    title: 'bot.settings.section',
    icon: 'terminal',
    order: 140,
    controls: [
      {
        id: SCRAPER_DIR_ID,
        label: 'bot.settings.scraperDirectory',
        description: 'bot.settings.scraperDirectory.description',
        kind: 'folder',
        defaultValue: '',
        keywords: ['scraper', 'node', 'scrape.js', 'folder', 'mineflayer']
      },
      {
        id: MESSAGE_LIMIT_ID,
        label: 'bot.settings.messageLimit',
        description: 'bot.settings.messageLimit.description',
        kind: 'number',
        defaultValue: 5000,
        min: 100,
        max: 200_000,
        step: 100,
        keywords: ['messages', 'captured', 'limit'],
        validate: (value) => {
          const limit = Number(value);
          if (!Number.isFinite(limit) || limit < 100 || limit > 200_000) {
            return 'Use a whole number between 100 and 200000. Nothing was changed.';
          }
          return null;
        }
      },
      {
        id: LOG_LIMIT_ID,
        label: 'bot.settings.logLimit',
        description: 'bot.settings.logLimit.description',
        kind: 'number',
        defaultValue: 2000,
        min: 100,
        max: 200_000,
        step: 100,
        keywords: ['log', 'lines', 'limit'],
        validate: (value) => {
          const limit = Number(value);
          if (!Number.isFinite(limit) || limit < 100 || limit > 200_000) {
            return 'Use a whole number between 100 and 200000. Nothing was changed.';
          }
          return null;
        }
      },
      {
        id: FOLLOW_LOG_ID,
        label: 'bot.settings.followLog',
        description: 'bot.settings.followLog.description',
        kind: 'switch',
        defaultValue: true,
        keywords: ['follow', 'scroll', 'log']
      },
      {
        id: CAPTURE_ENABLED_ID,
        label: 'bot.settings.captureFromRun',
        description: 'bot.settings.captureFromRun.description',
        kind: 'switch',
        defaultValue: true,
        keywords: ['capture', 'rules', 'messages', 'chat']
      },
      {
        id: EXPORT_FORMAT_ID,
        label: 'bot.settings.exportFormat',
        description: 'bot.settings.exportFormat.description',
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
      },
      {
        id: STOP_SIGNAL_ID,
        label: 'bot.settings.stopSignal',
        description: 'bot.settings.stopSignal.description',
        kind: 'select',
        defaultValue: 'SIGTERM',
        keywords: ['stop', 'signal', 'kill', 'sigterm', 'sigkill'],
        options: [
          { value: 'SIGTERM', label: 'SIGTERM — asks it to shut down cleanly' },
          { value: 'SIGINT', label: 'SIGINT — the same as pressing Ctrl+C' },
          { value: 'SIGKILL', label: 'SIGKILL — ends it immediately, no cleanup' }
        ]
      }
    ]
  };
}

/* ================================================================== */
/* Palette                                                             */
/* ================================================================== */

function paletteEntries(): PaletteEntry[] {
  const settingEntries: Array<{ id: string; titleKey: string }> = [
    { id: SCRAPER_DIR_ID, titleKey: 'bot.settings.scraperDirectory' },
    { id: MESSAGE_LIMIT_ID, titleKey: 'bot.settings.messageLimit' },
    { id: LOG_LIMIT_ID, titleKey: 'bot.settings.logLimit' },
    { id: FOLLOW_LOG_ID, titleKey: 'bot.settings.followLog' },
    { id: CAPTURE_ENABLED_ID, titleKey: 'bot.settings.captureFromRun' },
    { id: EXPORT_FORMAT_ID, titleKey: 'bot.settings.exportFormat' },
    { id: STOP_SIGNAL_ID, titleKey: 'bot.settings.stopSignal' }
  ];

  const entries: PaletteEntry[] = [
    {
      id: 'bot.command.open',
      title: 'bot.tab',
      kind: 'destination',
      icon: 'terminal',
      keywords: ['scraper', 'bot', 'mineflayer', 'node', 'run', 'chat'],
      teleport: { tabId: TAB_ID, elementId: RUN_CONTROLS_ELEMENT },
      run: () => state?.ctx.tabs.open(TAB_ID)
    },
    {
      id: 'bot.command.profiles',
      title: 'bot.profiles.title',
      kind: 'destination',
      icon: 'file',
      keywords: ['scraper', 'profiles', 'bot', 'configuration'],
      teleport: { tabId: TAB_ID, elementId: PROFILE_LIST_ELEMENT },
      run: () => state?.ctx.tabs.open(TAB_ID)
    },
    {
      id: 'bot.command.log',
      title: 'bot.log.title',
      kind: 'destination',
      icon: 'terminal',
      keywords: ['scraper', 'bot', 'run log', 'output', 'stdout'],
      teleport: { tabId: TAB_ID, elementId: LOG_ELEMENT },
      run: () => state?.ctx.tabs.open(TAB_ID)
    },
    {
      id: 'bot.command.messages',
      title: 'bot.messages.title',
      kind: 'destination',
      icon: 'world',
      keywords: ['scraper', 'bot', 'captured', 'chat', 'messages'],
      teleport: { tabId: TAB_ID, elementId: MESSAGES_ELEMENT },
      run: () => state?.ctx.tabs.open(TAB_ID)
    },
    {
      id: 'bot.command.stop',
      title: 'bot.run.stop',
      kind: 'command',
      icon: 'stop',
      keywords: ['scraper', 'bot', 'stop', 'kill'],
      run: async () => {
        const current = requireState();
        if (!current) return;
        const outcome = await current.runner.stop();
        if (!outcome.ok) {
          current.ctx.notify.error(current.ctx.t('bot.run.stopFailedTitle', 'The bot did not stop'), outcome.reason);
        }
      }
    }
  ];

  for (const { id, titleKey } of settingEntries) {
    entries.push({
      id: `bot.setting.${id}`,
      title: titleKey,
      kind: 'setting',
      settingId: id,
      icon: 'tune',
      keywords: ['scraper', 'bot', 'setting', id]
    });
  }

  return entries;
}

/* ================================================================== */
/* The module                                                          */
/* ================================================================== */

export default defineFeature({
  id: 'bot',
  name: 'Scraper bot',
  description:
    'Runs the bundled Node scraper (a mineflayer client) through the downloader proxy, watches its real output, and turns matching lines into a searchable table of captured messages.',
  strings: BOT_STRINGS,
  docs: BOT_DOCS,
  settings: [settingsSection()],
  palette: paletteEntries(),
  tabs: [
    {
      id: TAB_ID,
      title: 'bot.tab',
      icon: 'terminal',
      // Ungrouped, on top: one of the product's own surfaces.
      order: 4,
      mount(host, tabCtx) {
        const current = requireState();
        if (!current) return;
        mountBotPanel(host, { ctx: tabCtx, store: current.store, runner: current.runner });
      }
    }
  ],

  init(ctx: AppContext) {
    const store = initStore(ctx);
    const runner = new BotRunner(ctx, store);
    state = { ctx, store, runner };

    // These are records the feature owns rather than user-tunable settings,
    // but declaring their compiled-in default lets the settings store's
    // provenance and reset machinery reason about them consistently with
    // every other stored value.
    ctx.settings.declareDefault(PROFILES_KEY, []);
    ctx.settings.declareDefault(MESSAGES_KEY, []);
    ctx.settings.declareDefault(RULES_KEY, []);
    ctx.settings.declareDefault(LAST_PROFILE_KEY, '');

    window.addEventListener('beforeunload', () => runner.dispose());
  }
});
