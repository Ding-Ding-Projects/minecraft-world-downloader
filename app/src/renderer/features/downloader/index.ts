import { defineFeature } from '../../core/registry';
import type { AppContext, PaletteEntry, SettingsSection } from '../../core/registry';
import './styles.css';
import { DOWNLOADER_DOCS } from './docs';
import { mountDownloaderPanel } from './panel';
import {
  DEFAULT_EXPORT_FORMAT,
  DEFAULT_JAVA_COMMAND,
  DEFAULT_MAX_LOG_LINES,
  DEFAULT_POLL_SECONDS,
  DEFAULT_VISIBLE_LOG_LINES,
  EXPORT_FORMAT_SETTING_ID,
  FeatureState,
  JAR_PATH_SETTING_ID,
  JAVA_COMMAND_SETTING_ID,
  MAX_LOG_LINES_SETTING_ID,
  POLL_SECONDS_SETTING_ID,
  VISIBLE_LOG_LINES_SETTING_ID,
  WORKING_DIRECTORY_SETTING_ID
} from './state';
import { DOWNLOADER_STRINGS } from './strings';

/**
 * The world downloader: the driver for the bundled `world-downloader.jar`.
 *
 * `options.ts` is the launch-option table (one entry per real `@Option` on the
 * Java core's `config/Config.java`), `profiles.ts` stores named sets of those
 * options, `runtime.ts` probes Java, the jar and the output world on disk, and
 * `session.ts` owns the running child process and its parsed output.
 * `state.ts` ties those together into one live object; `panel.ts` is the tab
 * built on top of it. This file is only the registration: settings, palette,
 * docs and the tab itself.
 */

const MAIN_TAB_ID = 'downloader.main';

let state: FeatureState | null = null;

function requireState(): FeatureState | null {
  if (!state) console.error('The downloader feature was used before its init ran.');
  return state;
}

/* ================================================================== */
/* Settings                                                            */
/* ================================================================== */

function settingsSection(): SettingsSection {
  return {
    id: 'downloader.settings',
    title: 'downloader.settings.section',
    icon: 'download',
    order: 200,
    controls: [
      {
        id: JAVA_COMMAND_SETTING_ID,
        label: 'downloader.settings.javaCommand',
        description: 'downloader.settings.javaCommand.description',
        kind: 'select',
        defaultValue: DEFAULT_JAVA_COMMAND,
        keywords: ['java', 'javaw', 'runtime', 'launcher', 'console'],
        options: [
          { value: 'java', label: 'java' },
          { value: 'javaw', label: 'javaw' }
        ]
      },
      {
        id: JAR_PATH_SETTING_ID,
        label: 'downloader.settings.jarPath',
        description: 'downloader.settings.jarPath.description',
        kind: 'file',
        defaultValue: '',
        keywords: ['jar', 'world-downloader', 'path', 'file']
      },
      {
        id: WORKING_DIRECTORY_SETTING_ID,
        label: 'downloader.settings.workingDirectory',
        description: 'downloader.settings.workingDirectory.description',
        kind: 'folder',
        defaultValue: '',
        keywords: ['working directory', 'cwd', 'config.json', 'cache']
      },
      {
        id: MAX_LOG_LINES_SETTING_ID,
        label: 'downloader.settings.maxLogLines',
        description: 'downloader.settings.maxLogLines.description',
        kind: 'number',
        defaultValue: DEFAULT_MAX_LOG_LINES,
        min: 200,
        max: 200_000,
        step: 100,
        keywords: ['log', 'lines', 'retain', 'limit'],
        validate: (value) => {
          const parsed = Number(value);
          if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 200 || parsed > 200_000) {
            return 'Use a whole number between 200 and 200000. Nothing was changed.';
          }
          return null;
        }
      },
      {
        id: VISIBLE_LOG_LINES_SETTING_ID,
        label: 'downloader.settings.visibleLogLines',
        description: 'downloader.settings.visibleLogLines.description',
        kind: 'number',
        defaultValue: DEFAULT_VISIBLE_LOG_LINES,
        min: 20,
        max: 5000,
        step: 20,
        keywords: ['log', 'lines', 'visible', 'page', 'performance'],
        validate: (value) => {
          const parsed = Number(value);
          if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 20 || parsed > 5000) {
            return 'Use a whole number between 20 and 5000. Nothing was changed.';
          }
          return null;
        }
      },
      {
        id: POLL_SECONDS_SETTING_ID,
        label: 'downloader.settings.pollSeconds',
        description: 'downloader.settings.pollSeconds.description',
        kind: 'number',
        defaultValue: DEFAULT_POLL_SECONDS,
        min: 1,
        max: 300,
        step: 1,
        keywords: ['poll', 'refresh', 'interval', 'seconds', 'world'],
        validate: (value) => {
          const parsed = Number(value);
          if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 1 || parsed > 300) {
            return 'Use a whole number of seconds between 1 and 300. Nothing was changed.';
          }
          return null;
        }
      },
      {
        id: EXPORT_FORMAT_SETTING_ID,
        label: 'downloader.settings.exportFormat',
        description: 'downloader.settings.exportFormat.description',
        kind: 'select',
        defaultValue: DEFAULT_EXPORT_FORMAT,
        keywords: ['export', 'format', 'json', 'csv', 'profiles', 'log'],
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
        id: 'downloader.settings.checkJava',
        label: 'downloader.settings.checkJava',
        description: 'downloader.settings.checkJava.description',
        kind: 'action',
        defaultValue: null,
        keywords: ['java', 'check', 'runtime', 'version'],
        lockable: false,
        lockableReason: 'An action has no stored value, so a lock on it would guard nothing.',
        run: async (settingCtx) => {
          const current = requireState();
          if (!current) return;
          await current.refreshJava();
          const probe = current.javaProbe;
          if (probe.state === 'present') {
            settingCtx.notify.success(
              settingCtx.t('downloader.settings.checkJava', 'Check the Java runtime'),
              settingCtx.t('downloader.runtime.java.present', 'Java is available: {version}', { values: { version: probe.versionLine } })
            );
          } else {
            settingCtx.notify.error(
              settingCtx.t('downloader.settings.checkJava', 'Check the Java runtime'),
              probe.state === 'missing'
                ? settingCtx.t('downloader.runtime.java.missing', 'No Java runtime named "{command}" could be started on this machine.', {
                    values: { command: probe.command }
                  })
                : settingCtx.t('downloader.runtime.java.failed', 'The Java runtime answered, but the check did not succeed: {reason}', {
                    values: { reason: probe.error ?? '' }
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

function anchorForPalette(): HTMLElement {
  return document.activeElement instanceof HTMLElement ? document.activeElement : document.body;
}

function paletteEntries(): PaletteEntry[] {
  return [
    {
      id: 'downloader.command.open',
      title: 'downloader.palette.open',
      subtitle: 'downloader.tab.subtitle',
      kind: 'destination',
      icon: 'download',
      keywords: ['downloader', 'world', 'minecraft', 'proxy', 'capture', 'jar'],
      teleport: { tabId: MAIN_TAB_ID },
      run: () => state?.ctx.tabs.open(MAIN_TAB_ID)
    },
    {
      id: 'downloader.command.start',
      title: 'downloader.palette.start',
      kind: 'command',
      icon: 'download',
      keywords: ['start', 'download', 'begin', 'run'],
      teleport: { tabId: MAIN_TAB_ID, elementId: 'downloader-session-card' },
      run: async () => {
        const current = requireState();
        if (!current) return;
        current.ctx.tabs.open(MAIN_TAB_ID);
        if (current.session.isRunning()) return;
        const failure = await current.start();
        if (failure) {
          current.ctx.notify.error(
            current.ctx.t('downloader.action.start', 'Start the download'),
            failure.message !== ''
              ? failure.message
              : current.ctx.t('downloader.session.needsValidOptions', 'Some launch options are not usable yet.')
          );
          return;
        }
        current.ctx.notify.success(current.ctx.t('downloader.session.started', 'The downloader started.'), '');
      }
    },
    {
      id: 'downloader.command.stop',
      title: 'downloader.palette.stop',
      kind: 'command',
      icon: 'stop',
      keywords: ['stop', 'halt', 'end'],
      teleport: { tabId: MAIN_TAB_ID, elementId: 'downloader-session-card' },
      run: async () => {
        const current = requireState();
        if (!current || !current.session.isRunning()) return;
        current.ctx.tabs.open(MAIN_TAB_ID);
        const approved = await current.ctx.confirm.request({
          action: current.ctx.t('downloader.confirm.stop', 'Stop the running download'),
          affected: [current.ctx.t('downloader.tab.title', 'World downloader')],
          irreversible: current.ctx.t(
            'downloader.confirm.stop.irreversible',
            'The downloader is terminated. Chunks it had captured but not yet flushed to disk are lost.'
          ),
          anchor: anchorForPalette()
        });
        if (!approved) return;
        const failure = await current.stop();
        if (failure) {
          current.ctx.notify.error(current.ctx.t('downloader.action.stop', 'Stop the download'), failure.message);
          return;
        }
        current.ctx.notify.success(current.ctx.t('downloader.session.stopped', 'The downloader has stopped.'), '');
      }
    },
    {
      id: 'downloader.command.searchLog',
      title: 'downloader.palette.searchLog',
      kind: 'destination',
      icon: 'search',
      keywords: ['log', 'search', 'activity', 'output'],
      teleport: { tabId: MAIN_TAB_ID, elementId: 'downloader-log-card' },
      run: () => state?.ctx.tabs.open(MAIN_TAB_ID)
    },
    {
      id: 'downloader.command.profiles',
      title: 'downloader.palette.profiles',
      kind: 'destination',
      icon: 'folder',
      keywords: ['profiles', 'saved', 'servers', 'presets'],
      teleport: { tabId: MAIN_TAB_ID, elementId: 'downloader-profiles-card' },
      run: () => state?.ctx.tabs.open(MAIN_TAB_ID)
    },
    {
      id: 'downloader.command.scan',
      title: 'downloader.palette.scan',
      kind: 'destination',
      icon: 'search',
      keywords: ['chunks', 'count', 'region', 'scan'],
      teleport: { tabId: MAIN_TAB_ID, elementId: 'downloader-status-card' },
      run: () => state?.ctx.tabs.open(MAIN_TAB_ID)
    },
    {
      id: 'downloader.command.checkJava',
      title: 'downloader.palette.checkJava',
      kind: 'command',
      icon: 'refresh',
      keywords: ['java', 'runtime', 'check', 'version'],
      teleport: { tabId: MAIN_TAB_ID, elementId: 'downloader-runtime-card' },
      run: () => {
        const current = requireState();
        if (!current) return;
        current.ctx.tabs.open(MAIN_TAB_ID);
        void current.refreshJava();
        void current.refreshJar();
      }
    },
    ...[
      JAVA_COMMAND_SETTING_ID,
      JAR_PATH_SETTING_ID,
      WORKING_DIRECTORY_SETTING_ID,
      MAX_LOG_LINES_SETTING_ID,
      VISIBLE_LOG_LINES_SETTING_ID,
      POLL_SECONDS_SETTING_ID,
      EXPORT_FORMAT_SETTING_ID
    ].map<PaletteEntry>((id) => ({
      id: `downloader.setting.${id}`,
      title: id,
      kind: 'setting',
      settingId: id,
      icon: 'tune',
      keywords: ['downloader', 'setting', id]
    }))
  ];
}

/* ================================================================== */
/* The module                                                          */
/* ================================================================== */

export default defineFeature({
  id: 'downloader',
  name: 'World download',
  description:
    'Runs the bundled world-downloader.jar as a proxy: connection settings, live status, chunk progress, an activity log, and start/stop.',
  strings: DOWNLOADER_STRINGS,
  docs: DOWNLOADER_DOCS,
  settings: [settingsSection()],
  palette: paletteEntries(),
  tabs: [
    {
      id: MAIN_TAB_ID,
      title: 'downloader.tab.title',
      icon: 'download',
      order: 110,
      mount: (host, tabCtx) => {
        const current = requireState();
        if (!current) return;
        return mountDownloaderPanel(host, tabCtx, current);
      }
    }
  ],
  init(ctx: AppContext) {
    state = new FeatureState(ctx);
    void state.refreshAll();

    const unsubscribe = ctx.studio.events.on('app:before-quit', () => {
      state?.dispose();
    });
    window.addEventListener('beforeunload', () => {
      unsubscribe();
      state?.dispose();
    });
  }
});
