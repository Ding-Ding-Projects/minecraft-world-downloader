import { defineFeature } from '../../core/registry';
import type { AppContext, SettingContext, TabContext } from '../../core/registry';
import './styles.css';
import { DOCS } from './docs';
import { mountRendersPanel, probeReadiness, BLUEMAP_RELEASES_URL } from './panel';
import { ensureQueue } from './runtime';
import { SETTINGS } from './store';
import { STRINGS } from './strings';

export default defineFeature({
  id: 'world-vault-renders',
  name: 'World Vault renders',
  description: 'An optional map render per World Vault commit, and a real, word-level comparison between any two commits.',

  strings: STRINGS,
  docs: DOCS,

  tabs: [
    {
      id: 'worldvaultrenders.main',
      title: 'worldvaultrenders.tab',
      icon: 'map',
      order: 420,
      mount(host: HTMLElement, ctx: TabContext) {
        mountRendersPanel(host, ctx);
      }
    }
  ],

  settings: [
    {
      id: 'worldvaultrenders.settings',
      title: 'worldvaultrenders.settings.title',
      icon: 'map',
      order: 420,
      controls: [
        {
          id: SETTINGS.enabled,
          label: 'worldvaultrenders.enabled',
          description: 'worldvaultrenders.enabled.description',
          kind: 'switch',
          defaultValue: false,
          keywords: ['render', 'map', 'bluemap', 'worldlens', 'automatic']
        },
        {
          id: SETTINGS.concurrency,
          label: 'worldvaultrenders.concurrency',
          description: 'worldvaultrenders.concurrency.description',
          kind: 'slider',
          defaultValue: 1,
          min: 1,
          max: 4,
          step: 1,
          keywords: ['concurrency', 'parallel', 'cpu', 'queue']
        },
        {
          id: SETTINGS.rendererPath,
          label: 'worldvaultrenders.rendererPath',
          description: 'worldvaultrenders.rendererPath.description',
          kind: 'file',
          defaultValue: '',
          keywords: ['bluemap', 'worldlens', 'jar', 'renderer', 'cli'],
          validate: (value) => {
            const path = String(value ?? '').trim();
            if (path === '') return null;
            const lower = path.toLowerCase();
            if (!lower.endsWith('.jar') && !lower.endsWith('.js') && !lower.endsWith('.mjs') && !lower.endsWith('.cjs')) {
              return 'This must be a ".jar" file or a Node ".js"/".mjs"/".cjs" entry point.';
            }
            return null;
          }
        },
        {
          id: SETTINGS.acceptDownload,
          label: 'worldvaultrenders.acceptDownload',
          description: 'worldvaultrenders.acceptDownload.description',
          kind: 'switch',
          defaultValue: false,
          keywords: ['download', 'textures', 'network', 'consent', 'eula']
        },
        {
          id: SETTINGS.threads,
          label: 'worldvaultrenders.threads',
          description: 'worldvaultrenders.threads.description',
          kind: 'number',
          defaultValue: 0,
          min: 0,
          max: 64,
          step: 1,
          keywords: ['threads', 'cpu', 'performance']
        },
        {
          id: SETTINGS.backlogWarningThreshold,
          label: 'worldvaultrenders.backlogWarningThreshold',
          description: 'worldvaultrenders.backlogWarningThreshold.description',
          kind: 'number',
          defaultValue: 5,
          min: 1,
          max: 50,
          step: 1,
          keywords: ['backlog', 'queue', 'behind', 'warning']
        },
        {
          id: 'worldvaultrenders.action.openReleases',
          label: 'worldvaultrenders.recovery.openReleases',
          description: 'worldvaultrenders.rendererPath.description',
          kind: 'action',
          defaultValue: null,
          keywords: ['bluemap', 'download', 'renderer', 'get', 'install'],
          run: async (ctx: SettingContext) => {
            await ctx.studio.shell.openExternal(BLUEMAP_RELEASES_URL);
          }
        },
        {
          id: 'worldvaultrenders.action.checkReadiness',
          label: 'worldvaultrenders.recovery.rendererMissing',
          description: 'worldvaultrenders.enabled.description',
          kind: 'action',
          defaultValue: null,
          keywords: ['java', 'renderer', 'check', 'readiness', 'diagnose'],
          run: async (ctx: SettingContext) => {
            const result = await probeReadiness(ctx);
            ctx.notify.info('worldvaultrenders.settings.title', `Java: ${result.java} · Renderer: ${result.renderer}`);
          }
        }
      ]
    }
  ],

  palette: [
    {
      id: 'worldvaultrenders.palette.open',
      title: 'worldvaultrenders.palette.open',
      icon: 'map',
      kind: 'destination',
      keywords: ['render', 'map', 'queue', 'vault', 'commit', 'compare'],
      teleport: { tabId: 'worldvaultrenders.main' }
    },
    {
      id: 'worldvaultrenders.palette.settings',
      title: 'worldvaultrenders.palette.settings',
      icon: 'tune',
      kind: 'setting',
      settingId: SETTINGS.enabled,
      keywords: ['render', 'settings', 'bluemap', 'java']
    }
  ],

  init(ctx: AppContext) {
    // Starts the shared background queue immediately, so a commit made while
    // the Renders tab is closed is still queued when the setting is on — the
    // same "runs in the background regardless of what tab is open" contract
    // the download and the vault's own committer follow. The queue itself
    // stays idle (nothing is ever spawned) until a commit actually arrives
    // and SETTINGS.enabled is true; creating it here costs nothing while the
    // feature is off.
    ensureQueue(ctx);
  }
});
