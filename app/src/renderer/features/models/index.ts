import { defineFeature } from '../../core/registry';
import type { AppContext, PaletteEntry, SettingsSection } from '../../core/registry';
import './styles.css';

import { mountChatPanel } from './chatpanel';
import { MODELS_DOCS } from './docs';
import { mountHarnessPanel } from './harnesspanel';
import { mountOverviewPanel } from './overviewpanel';
import { refreshCatalog } from './refresh';
import type { Runtime } from './runtime';
import { PullQueue } from './queue';
import {
  CHAT_NUM_PREDICT_ID,
  CHAT_TEMPERATURE_ID,
  CHAT_TOP_P_ID,
  CHAT_TURN_LIMIT_ID,
  CHAT_TAB,
  CONTEXT_OVERHEAD_ID,
  EXPORT_FORMAT_ID,
  HARNESS_TAB,
  HOST_ID,
  ModelsState,
  OVERVIEW_TAB,
  PROBE_ENABLED_ID,
  PROBE_PATH_ID,
  PULL_ATTEMPTS_ID,
  PULL_PARALLELISM_ID,
  REGISTRY_HOST_ID,
  REGISTRY_MAX_REPOS_ID,
  REGISTRY_PAGE_SIZE_ID,
  STALE_HOURS_ID,
  STORE_TAB,
  TIMEOUT_ID
} from './state';
import { mountStorePanel } from './storepanel';
import { MODELS_STRINGS } from './strings';
import { validateBaseUrl } from './util';

/**
 * The local model suite manager.
 *
 * Four tabs over one local runtime, talked to only through its own documented
 * HTTP API: Local models (health, installed inventory, hardware evidence),
 * Model store (the published catalog and the batch pull queue), Model chat
 * (local sessions), and Harness profiles (this application launching a local
 * program of your own against a model, never the runtime launching anything).
 */

let runtime: Runtime | null = null;

function requireRuntime(): Runtime | null {
  if (!runtime) console.error('The local model suite manager was used before its init ran.');
  return runtime;
}

/* ================================================================== */
/* Settings                                                            */
/* ================================================================== */

function settingsSection(): SettingsSection {
  return {
    id: 'models',
    title: 'models.settings.section',
    icon: 'terminal',
    order: 220,
    controls: [
      {
        id: HOST_ID,
        label: 'models.settings.host',
        description: 'models.settings.host.description',
        kind: 'text',
        defaultValue: 'http://127.0.0.1:11434',
        keywords: ['ollama', 'runtime', 'address', 'host', 'port', 'models'],
        validate: (value) => validateBaseUrl(String(value ?? ''))
      },
      {
        id: TIMEOUT_ID,
        label: 'models.settings.timeout',
        description: 'models.settings.timeout.description',
        kind: 'number',
        defaultValue: 60,
        min: 5,
        max: 120,
        step: 1,
        keywords: ['timeout', 'seconds', 'models'],
        validate: (value) => {
          const seconds = Number(value);
          return Number.isFinite(seconds) && seconds >= 5 && seconds <= 120 ? null : 'Use a whole number of seconds between 5 and 120. Nothing was changed.';
        }
      },
      {
        id: REGISTRY_HOST_ID,
        label: 'models.settings.registryHost',
        description: 'models.settings.registryHost.description',
        kind: 'text',
        defaultValue: 'registry.ollama.ai',
        keywords: ['registry', 'catalog', 'source', 'models'],
        validate: (value) => {
          const text = String(value ?? '').trim();
          if (text === '' || text === 'none') return null;
          if (!/^[a-z0-9.-]+(:[0-9]{1,5})?$/i.test(text)) {
            return 'Use a bare host such as registry.ollama.ai, or "none" to use only what is installed locally. Nothing was changed.';
          }
          return null;
        }
      },
      {
        id: REGISTRY_PAGE_SIZE_ID,
        label: 'models.settings.registryPageSize',
        description: 'models.settings.registryPageSize.description',
        kind: 'number',
        defaultValue: 100,
        min: 10,
        max: 1000,
        step: 10,
        keywords: ['catalog', 'page', 'size', 'models']
      },
      {
        id: REGISTRY_MAX_REPOS_ID,
        label: 'models.settings.registryMaxRepositories',
        description: 'models.settings.registryMaxRepositories.description',
        kind: 'number',
        defaultValue: 500,
        min: 10,
        max: 5000,
        step: 10,
        keywords: ['catalog', 'repositories', 'ceiling', 'models']
      },
      {
        id: STALE_HOURS_ID,
        label: 'models.settings.staleHours',
        description: 'models.settings.staleHours.description',
        kind: 'number',
        defaultValue: 24,
        min: 1,
        max: 720,
        step: 1,
        keywords: ['stale', 'catalog', 'hours', 'models']
      },
      {
        id: PULL_PARALLELISM_ID,
        label: 'models.settings.parallelism',
        description: 'models.settings.parallelism.description',
        kind: 'slider',
        defaultValue: 1,
        min: 1,
        max: 4,
        step: 1,
        keywords: ['pull', 'parallel', 'queue', 'models']
      },
      {
        id: PULL_ATTEMPTS_ID,
        label: 'models.settings.attempts',
        description: 'models.settings.attempts.description',
        kind: 'number',
        defaultValue: 20,
        min: 1,
        max: 200,
        step: 1,
        keywords: ['pull', 'attempts', 'retry', 'budget', 'models']
      },
      {
        id: CONTEXT_OVERHEAD_ID,
        label: 'models.settings.contextOverhead',
        description: 'models.settings.contextOverhead.description',
        kind: 'number',
        defaultValue: 1024,
        min: 128,
        max: 65_536,
        step: 128,
        keywords: ['context', 'overhead', 'memory', 'fit', 'models']
      },
      {
        id: PROBE_ENABLED_ID,
        label: 'models.settings.probe',
        description: 'models.settings.probe.description',
        kind: 'switch',
        defaultValue: false,
        keywords: ['probe', 'measure', 'memory', 'disk', 'hardware', 'models']
      },
      {
        id: PROBE_PATH_ID,
        label: 'models.settings.probePath',
        description: 'models.settings.probePath.description',
        kind: 'folder',
        defaultValue: '',
        keywords: ['probe', 'disk', 'folder', 'models']
      },
      {
        id: CHAT_TURN_LIMIT_ID,
        label: 'models.settings.chatTurns',
        description: 'models.settings.chatTurns.description',
        kind: 'number',
        defaultValue: 20,
        min: 1,
        max: 200,
        step: 1,
        keywords: ['chat', 'turns', 'history', 'models']
      },
      {
        id: CHAT_TEMPERATURE_ID,
        label: 'models.settings.temperature',
        description: 'models.settings.temperature.description',
        kind: 'slider',
        defaultValue: 0.8,
        min: 0,
        max: 2,
        step: 0.05,
        keywords: ['chat', 'temperature', 'sampling', 'models']
      },
      {
        id: CHAT_TOP_P_ID,
        label: 'models.settings.topP',
        description: 'models.settings.topP.description',
        kind: 'slider',
        defaultValue: 0.9,
        min: 0,
        max: 1,
        step: 0.01,
        keywords: ['chat', 'top-p', 'sampling', 'models']
      },
      {
        id: CHAT_NUM_PREDICT_ID,
        label: 'models.settings.numPredict',
        description: 'models.settings.numPredict.description',
        kind: 'number',
        defaultValue: 512,
        min: -1,
        max: 32_768,
        step: 1,
        keywords: ['chat', 'reply', 'tokens', 'ceiling', 'models']
      },
      {
        id: EXPORT_FORMAT_ID,
        label: 'models.settings.exportFormat',
        description: 'models.settings.exportFormat.description',
        kind: 'select',
        defaultValue: 'json',
        keywords: ['export', 'format', 'models'],
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
        id: 'models.action.checkNow',
        label: 'models.settings.checkNow',
        description: 'models.settings.checkNow.description',
        kind: 'action',
        defaultValue: null,
        keywords: ['check', 'health', 'runtime', 'models'],
        run: async (settingCtx) => {
          const current = requireRuntime();
          if (!current) return;
          settingCtx.tabs.teleport(OVERVIEW_TAB, 'models-health');
          await current.ensureHostsAllowed();
          await current.models.refreshRuntime();
        }
      },
      {
        id: 'models.action.refreshNow',
        label: 'models.settings.refreshNow',
        description: 'models.settings.refreshNow.description',
        kind: 'action',
        defaultValue: null,
        keywords: ['refresh', 'catalog', 'models'],
        run: async (settingCtx) => {
          const current = requireRuntime();
          if (!current) return;
          settingCtx.tabs.teleport(STORE_TAB, 'models-store-inventory');
          await current.ensureHostsAllowed();
          const outcome = await refreshCatalog(current.models, { cancelled: false }, () => undefined);
          if (outcome.ok) {
            settingCtx.notify.success(
              settingCtx.t('models.store.refresh', 'Refresh the catalog'),
              settingCtx.t('models.notice.refreshed', '{variants} variants across {repositories} repositories, {pages} pages followed. {verdict}', {
                values: {
                  variants: outcome.variantCount,
                  repositories: outcome.repositoryCount,
                  pages: outcome.pageCount,
                  verdict: outcome.complete
                    ? settingCtx.t('models.store.completeVerdict', 'Complete')
                    : settingCtx.t('models.store.incompleteVerdict', 'Incomplete')
                }
              })
            );
          } else {
            settingCtx.notify.warn(
              settingCtx.t('models.store.refresh', 'Refresh the catalog'),
              settingCtx.t('models.notice.refreshFailed', 'The catalog refresh did not complete. {reason}', { values: { reason: outcome.error ?? outcome.note } })
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
    HOST_ID,
    TIMEOUT_ID,
    REGISTRY_HOST_ID,
    REGISTRY_PAGE_SIZE_ID,
    REGISTRY_MAX_REPOS_ID,
    STALE_HOURS_ID,
    PULL_PARALLELISM_ID,
    PULL_ATTEMPTS_ID,
    CONTEXT_OVERHEAD_ID,
    PROBE_ENABLED_ID,
    PROBE_PATH_ID,
    CHAT_TURN_LIMIT_ID,
    CHAT_TEMPERATURE_ID,
    CHAT_TOP_P_ID,
    CHAT_NUM_PREDICT_ID,
    EXPORT_FORMAT_ID
  ];

  const entries: PaletteEntry[] = [
    {
      id: 'models.command.overview',
      title: 'models.tab.overview',
      icon: 'terminal',
      kind: 'destination',
      keywords: ['ollama', 'local model', 'runtime', 'health', 'installed', '本機模型'],
      teleport: { tabId: OVERVIEW_TAB, elementId: 'models-health' }
    },
    {
      id: 'models.command.store',
      title: 'models.tab.store',
      icon: 'download',
      kind: 'destination',
      keywords: ['model store', 'catalog', 'pull', 'download', '模型倉'],
      teleport: { tabId: STORE_TAB, elementId: 'models-store-inventory' }
    },
    {
      id: 'models.command.queue',
      title: 'models.queue.title',
      icon: 'download',
      kind: 'destination',
      keywords: ['pull queue', 'download', 'queue', '落載隊列'],
      teleport: { tabId: STORE_TAB, elementId: 'models-queue' }
    },
    {
      id: 'models.command.chat',
      title: 'models.tab.chat',
      icon: 'terminal',
      kind: 'destination',
      keywords: ['chat', 'model chat', 'conversation', '模型傾偈'],
      teleport: { tabId: CHAT_TAB, elementId: 'models-chat-sessions' }
    },
    {
      id: 'models.command.harness',
      title: 'models.tab.harness',
      icon: 'play',
      kind: 'destination',
      keywords: ['harness', 'launch', 'profile', '啟動設定檔'],
      teleport: { tabId: HARNESS_TAB, elementId: 'models-harness-list' }
    },
    {
      id: 'models.command.checkRuntime',
      title: 'models.health.check',
      icon: 'refresh',
      kind: 'command',
      keywords: ['check', 'health', 'runtime', 'models'],
      run: async () => {
        const current = requireRuntime();
        if (!current) return;
        await current.ensureHostsAllowed();
        await current.models.refreshRuntime();
      }
    },
    {
      id: 'models.command.refreshCatalog',
      title: 'models.store.refresh',
      icon: 'refresh',
      kind: 'destination',
      keywords: ['refresh', 'catalog', 'models'],
      teleport: { tabId: STORE_TAB, elementId: 'models-store-inventory' }
    }
  ];

  for (const id of settingIds) {
    entries.push({ id: `models.setting.${id}`, title: id, kind: 'setting', settingId: id, icon: 'tune', keywords: ['models', 'setting', id] });
  }

  return entries;
}

/* ================================================================== */
/* Networking                                                          */
/* ================================================================== */

function hostAndScheme(url: string): { host: string; scheme: 'http' | 'https' } | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return { host: parsed.hostname, scheme: parsed.protocol === 'http:' ? 'http' : 'https' };
  } catch {
    return null;
  }
}

function buildRuntime(ctx: AppContext): Runtime {
  const models = new ModelsState(ctx);
  const queue = new PullQueue(models);
  let allowedRuntimeHost = '';
  let allowedRegistryHost = '';

  const rt: Runtime = {
    ctx,
    models,
    queue,
    async ensureHostsAllowed(): Promise<void> {
      const runtimeConfig = models.runtimeConfig();
      const runtimeTarget = hostAndScheme(runtimeConfig.baseUrl);
      if (runtimeTarget && `${runtimeTarget.scheme}:${runtimeTarget.host}` !== allowedRuntimeHost) {
        const result = await ctx.studio.http.allow({
          host: runtimeTarget.host,
          schemes: [runtimeTarget.scheme, ...(runtimeTarget.scheme === 'http' ? [] : ['https' as const])],
          owner: 'models',
          reason: 'Talks to the local model runtime’s documented HTTP API for health, installed models, pulls and chat.'
        });
        if (result.ok) allowedRuntimeHost = `${runtimeTarget.scheme}:${runtimeTarget.host}`;
      }

      const registry = models.registrySettings();
      if (registry.host && registry.host !== allowedRegistryHost) {
        const result = await ctx.studio.http.allow({
          host: registry.host,
          schemes: ['https'],
          owner: 'models',
          reason: 'Reads the published model catalog from this registry’s documented repository and tag listing endpoints.'
        });
        if (result.ok) allowedRegistryHost = registry.host;
      }
    }
  };
  return rt;
}

/* ================================================================== */
/* The module                                                          */
/* ================================================================== */

export default defineFeature({
  id: 'models',
  name: 'Local models',
  description:
    'A local model suite manager over the runtime’s documented HTTP API: health, installed and running models, an exhaustive catalog with conservative hardware-fit verdicts, a batch pull queue, local chat sessions, and allow-listed harness launches.',
  strings: MODELS_STRINGS,
  docs: MODELS_DOCS,
  settings: [settingsSection()],
  palette: paletteEntries(),
  tabs: [
    {
      id: OVERVIEW_TAB,
      title: 'models.tab.overview',
      icon: 'terminal',
      order: 500,
      mount: (host, tabCtx) => {
        const current = requireRuntime();
        if (!current) return;
        mountOverviewPanel(host, tabCtx, current);
      }
    },
    {
      id: STORE_TAB,
      title: 'models.tab.store',
      icon: 'download',
      order: 501,
      mount: (host, tabCtx) => {
        const current = requireRuntime();
        if (!current) return;
        mountStorePanel(host, tabCtx, current);
      }
    },
    {
      id: CHAT_TAB,
      title: 'models.tab.chat',
      icon: 'terminal',
      order: 502,
      mount: (host, tabCtx) => {
        const current = requireRuntime();
        if (!current) return;
        mountChatPanel(host, tabCtx, current);
      }
    },
    {
      id: HARNESS_TAB,
      title: 'models.tab.harness',
      icon: 'play',
      order: 503,
      mount: (host, tabCtx) => {
        const current = requireRuntime();
        if (!current) return;
        mountHarnessPanel(host, tabCtx, current);
      }
    }
  ],
  init(ctx: AppContext) {
    runtime = buildRuntime(ctx);
    void runtime.queue.reconcile();
  }
});
