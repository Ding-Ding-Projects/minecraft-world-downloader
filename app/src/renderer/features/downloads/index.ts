import { defineFeature } from '../../core/registry';
import type { AppContext, PaletteEntry, SettingsSection } from '../../core/registry';
import './styles.css';
import { downloadBridge } from './bridge';
import { downloadsController } from './controller';
import { DOWNLOADS_DOCS } from './docs';
import { DOWNLOADS_SECTION_ID, DOWNLOADS_TAB_ID } from './model';
import { mountDownloadsPanel, openManualAddDialog, openPairingPopover } from './panel';
import { DEFAULT_MAX_CONCURRENT, DEFAULT_PORT, DOWNLOAD_SETTINGS } from './settingIds';
import { DOWNLOADS_STRINGS } from './strings';

/**
 * Wires the already-built download-capture pieces — the bridge to the
 * receiver process, the store, the controller, the Start dialog, the
 * separate Downloading progress windows and the always-on-top completion
 * surface — into the application: one tab, one settings section, a handful
 * of palette entries, four documentation articles and this feature's own
 * copy catalogue.
 */

const WHOLE_NUMBER_RANGE_ERROR = (min: number, max: number): string =>
  `Use a whole number between ${min} and ${max}. Nothing was changed.`;

/**
 * Set once in `init` and read by the palette entries below. The palette
 * builds its static entry list before any context exists — exactly the
 * pattern every other feature with a palette command uses — so a command
 * that needs a live service reaches it through this module-level reference
 * rather than through an argument the entry shape does not carry.
 */
let currentCtx: AppContext | null = null;

function settingsSection(): SettingsSection {
  return {
    id: DOWNLOADS_SECTION_ID,
    title: 'downloads.settings.title',
    icon: 'download',
    order: 130,
    controls: [
      {
        id: DOWNLOAD_SETTINGS.folder,
        label: 'downloads.settings.folder',
        description: 'downloads.settings.folder.description',
        kind: 'folder',
        defaultValue: '',
        keywords: ['download', 'folder', 'destination', 'save', 'path']
      },
      {
        id: DOWNLOAD_SETTINGS.autoStartReceiver,
        label: 'downloads.settings.autoStartReceiver',
        description: 'downloads.settings.autoStartReceiver.description',
        kind: 'switch',
        defaultValue: false,
        keywords: ['receiver', 'start', 'automatic', 'launch', 'boot']
      },
      {
        id: DOWNLOAD_SETTINGS.port,
        label: 'downloads.settings.port',
        description: 'downloads.settings.port.description',
        kind: 'number',
        defaultValue: DEFAULT_PORT,
        min: 1,
        max: 65535,
        step: 1,
        keywords: ['port', 'receiver', 'loopback', 'listen'],
        validate: (value) => {
          const port = Number(value);
          return Number.isFinite(port) && port >= 1 && port <= 65535 ? null : WHOLE_NUMBER_RANGE_ERROR(1, 65535);
        }
      },
      {
        id: DOWNLOAD_SETTINGS.askBeforeStarting,
        label: 'downloads.settings.askBeforeStarting',
        description: 'downloads.settings.askBeforeStarting.description',
        kind: 'switch',
        defaultValue: true,
        keywords: ['ask', 'confirm', 'start dialog', 'decision']
      },
      {
        id: DOWNLOAD_SETTINGS.maxConcurrent,
        label: 'downloads.settings.maxConcurrent',
        description: 'downloads.settings.maxConcurrent.description',
        kind: 'number',
        defaultValue: DEFAULT_MAX_CONCURRENT,
        min: 1,
        max: 10,
        step: 1,
        keywords: ['concurrent', 'parallel', 'queue', 'limit', 'simultaneous'],
        validate: (value) => {
          const count = Number(value);
          return Number.isFinite(count) && count >= 1 && count <= 10 ? null : WHOLE_NUMBER_RANGE_ERROR(1, 10);
        }
      },
      {
        id: DOWNLOAD_SETTINGS.alwaysOnTop,
        label: 'downloads.settings.alwaysOnTop',
        description: 'downloads.settings.alwaysOnTop.description',
        kind: 'switch',
        defaultValue: true,
        keywords: ['always on top', 'window', 'browser', 'above']
      },
      {
        id: DOWNLOAD_SETTINGS.openProgressWindow,
        label: 'downloads.settings.openProgressWindow',
        description: 'downloads.settings.openProgressWindow.description',
        kind: 'switch',
        defaultValue: true,
        keywords: ['progress', 'window', 'automatic', 'downloading']
      },
      {
        id: DOWNLOAD_SETTINGS.showCompletion,
        label: 'downloads.settings.showCompletion',
        description: 'downloads.settings.showCompletion.description',
        kind: 'switch',
        defaultValue: true,
        keywords: ['completion', 'notification', 'finish', 'surface']
      },
      {
        id: DOWNLOAD_SETTINGS.overwrite,
        label: 'downloads.settings.overwrite',
        description: 'downloads.settings.overwrite.description',
        kind: 'switch',
        defaultValue: false,
        keywords: ['overwrite', 'replace', 'default', 'existing file']
      },
      {
        id: DOWNLOAD_SETTINGS.revealOnCompletion,
        label: 'downloads.settings.revealOnCompletion',
        description: 'downloads.settings.revealOnCompletion.description',
        kind: 'switch',
        defaultValue: false,
        keywords: ['reveal', 'file manager', 'finish', 'explorer']
      },
      {
        id: DOWNLOAD_SETTINGS.restartReceiver,
        label: 'downloads.settings.restartReceiver',
        description: 'downloads.settings.restartReceiver.description',
        kind: 'action',
        defaultValue: null,
        keywords: ['restart', 'receiver', 'token', 'refresh'],
        run: () => void downloadsController.startReceiver()
      },
      {
        id: DOWNLOAD_SETTINGS.showPairing,
        label: 'downloads.settings.showPairing',
        description: 'downloads.settings.showPairing.description',
        kind: 'action',
        defaultValue: null,
        keywords: ['pairing', 'extension', 'token', 'endpoint', 'browser'],
        run: (settingCtx) => {
          const anchor = (document.activeElement as HTMLElement | null) ?? document.body;
          openPairingPopover(settingCtx, anchor);
        }
      }
    ]
  };
}

function paletteEntries(): PaletteEntry[] {
  const settingIds = [
    DOWNLOAD_SETTINGS.folder,
    DOWNLOAD_SETTINGS.autoStartReceiver,
    DOWNLOAD_SETTINGS.port,
    DOWNLOAD_SETTINGS.askBeforeStarting,
    DOWNLOAD_SETTINGS.maxConcurrent,
    DOWNLOAD_SETTINGS.alwaysOnTop,
    DOWNLOAD_SETTINGS.openProgressWindow,
    DOWNLOAD_SETTINGS.showCompletion,
    DOWNLOAD_SETTINGS.overwrite,
    DOWNLOAD_SETTINGS.revealOnCompletion
  ];

  const entries: PaletteEntry[] = [
    {
      id: 'downloads.command.open',
      title: 'downloads.palette.open',
      kind: 'destination',
      icon: 'download',
      keywords: ['download', 'transfer', 'file', '下載'],
      teleport: { tabId: DOWNLOADS_TAB_ID, elementId: 'downloads-results' }
    },
    {
      id: 'downloads.command.addManual',
      title: 'downloads.palette.addManual',
      kind: 'command',
      icon: 'add',
      keywords: ['download', 'address', 'url', 'manual'],
      run: () => {
        if (currentCtx) void openManualAddDialog(currentCtx);
      }
    },
    {
      id: 'downloads.command.startReceiver',
      title: 'downloads.palette.startReceiver',
      kind: 'command',
      icon: 'play',
      keywords: ['receiver', 'start', 'listen'],
      run: () => void downloadsController.startReceiver()
    },
    {
      id: 'downloads.command.stopReceiver',
      title: 'downloads.palette.stopReceiver',
      kind: 'command',
      icon: 'stop',
      keywords: ['receiver', 'stop'],
      run: () => void downloadsController.stopReceiver()
    },
    {
      id: 'downloads.command.pairing',
      title: 'downloads.palette.pairing',
      kind: 'destination',
      icon: 'key',
      keywords: ['pairing', 'extension', 'token', 'endpoint'],
      teleport: { tabId: DOWNLOADS_TAB_ID, elementId: 'downloads-pairing-button' }
    }
  ];

  for (const id of settingIds) {
    entries.push({
      id: `downloads.setting.${id}`,
      title: id,
      kind: 'setting',
      settingId: id,
      icon: 'tune',
      keywords: ['downloads', 'setting', id]
    });
  }

  return entries;
}

export default defineFeature({
  id: 'downloads',
  name: 'Downloads',
  description:
    'Captures a browser download through a small paired extension, asks before anything transfers, and reports every transfer in its own progress window and completion surface.',
  strings: DOWNLOADS_STRINGS,
  docs: DOWNLOADS_DOCS,
  settings: [settingsSection()],
  palette: paletteEntries(),
  tabs: [
    {
      id: DOWNLOADS_TAB_ID,
      title: 'downloads.tab.title',
      icon: 'download',
      order: 400,
      mount: (host, tabCtx) => {
        mountDownloadsPanel(host, tabCtx);
      }
    }
  ],
  init(ctx: AppContext) {
    currentCtx = ctx;
    downloadsController.attach(ctx);

    ctx.studio.events.on('app:before-quit', () => {
      // A quit while a transfer is running still leaves a real, resumable
      // partial file on disk; the receiver process is simply not asked to do
      // anything further once the application itself is going away.
      void downloadBridge.stop();
    });
  }
});
