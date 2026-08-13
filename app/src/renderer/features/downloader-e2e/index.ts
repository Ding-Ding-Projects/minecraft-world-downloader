import { defineFeature } from '../../core/registry';
import type { AppContext, PaletteEntry, SettingsSection } from '../../core/registry';
import './styles.css';
import { DOWNLOADER_E2E_DOCS } from './docs';
import { harnessProbeSummary, mountDownloaderE2ePanel } from './panel';
import {
  DEFAULT_JAVA_COMMAND,
  DEFAULT_NODE_COMMAND,
  FeatureState,
  HARNESS_PATH_SETTING_ID,
  JAR_PATH_SETTING_ID,
  JAVA_COMMAND_SETTING_ID,
  NODE_COMMAND_SETTING_ID,
  RUNS_SETTING_ID,
  SCRAPER_DIR_SETTING_ID
} from './state';
import { DOWNLOADER_E2E_STRINGS } from './strings';

/**
 * The end-to-end test harness: a real Minecraft server, real bots through the
 * downloader's proxy, and the world verified on disk afterward — the one test
 * in this application that actually exercises the protocol.
 *
 * `state.ts` owns the launch/session/history model, spawning the standalone
 * `test-e2e/run.js` script (which is also runnable with nothing but `node`,
 * outside this application entirely — see `docs/features/downloader-e2e.md`)
 * as a child process and parsing its structured stdout. `panel.ts` is the tab
 * built on top of it. This file is only registration: settings, palette,
 * docs and the tab itself.
 */

const MAIN_TAB_ID = 'downloader-e2e.main';

let state: FeatureState | null = null;

function requireState(): FeatureState | null {
  if (!state) console.error('The downloader-e2e feature was used before its init ran.');
  return state;
}

/* ================================================================== */
/* Settings                                                            */
/* ================================================================== */

function settingsSection(): SettingsSection {
  return {
    id: 'downloader-e2e.settings',
    title: 'downloader-e2e.settings.section',
    icon: 'terminal',
    order: 210,
    controls: [
      {
        id: HARNESS_PATH_SETTING_ID,
        label: 'downloader-e2e.settings.harnessPath',
        description: 'downloader-e2e.settings.harnessPath.description',
        kind: 'file',
        defaultValue: '',
        keywords: ['e2e', 'harness', 'test-e2e', 'run.js', 'end-to-end']
      },
      {
        id: NODE_COMMAND_SETTING_ID,
        label: 'downloader-e2e.settings.nodeCommand',
        description: 'downloader-e2e.settings.nodeCommand.description',
        kind: 'text',
        defaultValue: DEFAULT_NODE_COMMAND,
        keywords: ['node', 'runtime', 'command']
      },
      {
        id: JAVA_COMMAND_SETTING_ID,
        label: 'downloader-e2e.settings.javaCommand',
        description: 'downloader-e2e.settings.javaCommand.description',
        kind: 'select',
        defaultValue: DEFAULT_JAVA_COMMAND,
        keywords: ['java', 'javaw', 'runtime'],
        options: [
          { value: 'java', label: 'java' },
          { value: 'javaw', label: 'javaw' }
        ]
      },
      {
        id: JAR_PATH_SETTING_ID,
        label: 'downloader-e2e.settings.downloaderJarPath',
        description: 'downloader-e2e.settings.downloaderJarPath.description',
        kind: 'file',
        defaultValue: '',
        keywords: ['jar', 'world-downloader', 'target', 'mvn']
      },
      {
        id: SCRAPER_DIR_SETTING_ID,
        label: 'downloader-e2e.settings.scraperDir',
        description: 'downloader-e2e.settings.scraperDir.description',
        kind: 'folder',
        defaultValue: '',
        keywords: ['scraper', 'scrape.js', 'mineflayer', 'bots']
      },
      {
        id: 'downloader-e2e.settings.checkHarness',
        label: 'downloader-e2e.settings.checkHarness',
        description: 'downloader-e2e.settings.checkHarness.description',
        kind: 'action',
        defaultValue: null,
        keywords: ['check', 'probe', 'harness', 'paths'],
        lockable: false,
        lockableReason: 'An action has no stored value, so a lock on it would guard nothing.',
        run: async (settingCtx) => {
          const current = requireState();
          if (!current) return;
          const probe = await current.refreshProbe();
          const summary = harnessProbeSummary(probe, settingCtx.t);
          if (probe.harnessFound && probe.jarFound && probe.scraperFound) {
            settingCtx.notify.success(settingCtx.t('downloader-e2e.settings.checkHarness', 'Check the harness locations'), summary);
          } else {
            settingCtx.notify.warn(settingCtx.t('downloader-e2e.settings.checkHarness', 'Check the harness locations'), summary);
          }
        }
      }
    ]
  };
}

/* ================================================================== */
/* Palette                                                             */
/* ================================================================== */

function anchorForPalette(): HTMLElement {
  return document.activeElement instanceof HTMLElement ? document.activeElement : document.body;
}

function paletteEntries(): PaletteEntry[] {
  return [
    {
      id: 'downloader-e2e.command.open',
      title: 'downloader-e2e.palette.open',
      subtitle: 'downloader-e2e.tab.subtitle',
      kind: 'destination',
      icon: 'terminal',
      keywords: ['e2e', 'end-to-end', 'test', 'server', 'bot', 'verify'],
      teleport: { tabId: MAIN_TAB_ID },
      run: () => state?.ctx.tabs.open(MAIN_TAB_ID)
    },
    {
      id: 'downloader-e2e.command.start',
      title: 'downloader-e2e.palette.start',
      kind: 'command',
      icon: 'play',
      keywords: ['start', 'run', 'e2e', 'test'],
      teleport: { tabId: MAIN_TAB_ID, elementId: 'downloader-e2e-launch-card' },
      run: () => {
        state?.ctx.tabs.open(MAIN_TAB_ID);
      }
    },
    {
      id: 'downloader-e2e.command.cancel',
      title: 'downloader-e2e.palette.cancel',
      kind: 'command',
      icon: 'stop',
      keywords: ['cancel', 'stop', 'abort'],
      teleport: { tabId: MAIN_TAB_ID, elementId: 'downloader-e2e-status-card' },
      run: async () => {
        const current = requireState();
        if (!current || !current.session.isRunning()) return;
        current.ctx.tabs.open(MAIN_TAB_ID);
        const approved = await current.ctx.confirm.request({
          action: current.ctx.t('downloader-e2e.palette.cancel', 'Cancel the running end-to-end test'),
          affected: [current.ctx.t('downloader-e2e.tab.title', 'End-to-end test')],
          irreversible: current.ctx.t(
            'downloader-e2e.confirm.cancel.irreversible',
            'The server, proxy and any bots this run started are stopped immediately.'
          ),
          anchor: anchorForPalette()
        });
        if (!approved) return;
        await current.cancel();
      }
    },
    {
      id: 'downloader-e2e.command.history',
      title: 'downloader-e2e.history.title',
      kind: 'destination',
      icon: 'history',
      keywords: ['history', 'runs', 'results'],
      teleport: { tabId: MAIN_TAB_ID, elementId: 'downloader-e2e-history-card' },
      run: () => state?.ctx.tabs.open(MAIN_TAB_ID)
    },
    {
      id: 'downloader-e2e.command.checkHarness',
      title: 'downloader-e2e.settings.checkHarness',
      kind: 'command',
      icon: 'refresh',
      keywords: ['check', 'harness', 'probe'],
      teleport: { tabId: MAIN_TAB_ID, elementId: 'downloader-e2e-launch-card' },
      run: () => {
        void requireState()?.refreshProbe();
      }
    },
    ...[HARNESS_PATH_SETTING_ID, NODE_COMMAND_SETTING_ID, JAVA_COMMAND_SETTING_ID, JAR_PATH_SETTING_ID, SCRAPER_DIR_SETTING_ID].map<PaletteEntry>((id) => ({
      id: `downloader-e2e.setting.${id}`,
      title: id,
      kind: 'setting',
      settingId: id,
      icon: 'tune',
      keywords: ['downloader-e2e', 'setting', id]
    }))
  ];
}

/* ================================================================== */
/* The module                                                          */
/* ================================================================== */

export default defineFeature({
  id: 'downloader-e2e',
  name: 'End-to-end test',
  description:
    'Brings up a real Minecraft server, drives real bots through the downloader proxy, and verifies the saved world by reading region files back — the one test that exercises the real protocol.',
  strings: DOWNLOADER_E2E_STRINGS,
  docs: DOWNLOADER_E2E_DOCS,
  settings: [settingsSection()],
  palette: paletteEntries(),
  tabs: [
    {
      id: MAIN_TAB_ID,
      title: 'downloader-e2e.tab.title',
      icon: 'terminal',
      group: 'group.tools',
      order: 480,
      mount: (host, tabCtx) => {
        const current = requireState();
        if (!current) return;
        return mountDownloaderE2ePanel(host, tabCtx, current);
      }
    }
  ],
  init(ctx: AppContext) {
    ctx.settings.declareDefault(RUNS_SETTING_ID, []);
    state = new FeatureState(ctx);

    const unsubscribe = ctx.studio.events.on('app:before-quit', () => {
      state?.dispose();
    });
    window.addEventListener('beforeunload', () => {
      unsubscribe();
      state?.dispose();
    });
  }
});
