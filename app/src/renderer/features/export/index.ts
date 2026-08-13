import './styles.css';

import { defineFeature, type AppContext, type FeatureModule, type SettingOption } from '../../core/registry';
import {
  ARCHIVE_LEVELS,
  DEFAULT_ARCHIVE_OPTIONS,
  DICTIONARY_SIZES,
  METHODS_BY_FORMAT,
  SOLID_BLOCK_SIZES,
  VOLUME_SIZES
} from './archive';
import { EXPORT_DOCS } from './docs';
import { FORMATS, formatsForShape } from './formats';
import { mountExportPanel } from './panel';
import { EXPORT_SETTINGS, EXPORT_TAB_ID } from './settingsIds';
import { EXPORT_STRINGS } from './strings';

export { registerExportSource, listExportSources } from './sources';
export type { ExportSource, ExportPayload, SourceShape } from './sources';

/**
 * Export: the surface, the archive support, and the Visual Studio Code handoff.
 *
 * `core/export.ts` owns the interchange writers. This module owns the place a
 * person actually goes to take something away — the catalogue of what can be
 * exported, the per-datum format choice, the loss report before anything is
 * written, ZIP and 7z with the full option set, and the one action that lands
 * the result in Visual Studio Code.
 */

const formatOptions = (): SettingOption[] =>
  formatsForShape('structured').map((descriptor) => ({ value: descriptor.id, label: descriptor.name }));

const allMethods = [...new Set([...METHODS_BY_FORMAT['7z'], ...METHODS_BY_FORMAT.zip])];

/** Captured at init so a palette command can reach the services it needs. */
let app: AppContext | null = null;

const exportFeature: FeatureModule = {
  id: 'export',
  name: 'Export',
  description:
    'Writes any record, list, log, document, setting or generated artifact to a file in any format that can carry it, bundles them into ZIP or 7z archives, and opens the result in Visual Studio Code.',

  strings: EXPORT_STRINGS,

  tabs: [
    {
      id: EXPORT_TAB_ID,
      title: 'export.tab.title',
      icon: 'download',
      group: 'group.records',
      order: 300,
      mount(host, ctx) {
        mountExportPanel(host, ctx);
      }
    }
  ],

  settings: [
    {
      id: 'export',
      title: 'export.settings.title',
      icon: 'download',
      order: 300,
      controls: [
        {
          id: EXPORT_SETTINGS.defaultFormat,
          label: 'export.setting.format.label',
          description: 'export.setting.format.desc',
          kind: 'select',
          defaultValue: 'json',
          options: formatOptions(),
          keywords: ['format', 'json', 'csv', 'yaml', 'export']
        },
        {
          id: EXPORT_SETTINGS.lineEnding,
          label: 'export.setting.eol.label',
          description: 'export.setting.eol.desc',
          kind: 'select',
          defaultValue: 'lf',
          options: [
            { value: 'lf', label: 'LF — one newline, what most tools expect' },
            { value: 'crlf', label: 'CRLF — carriage return and newline, the Windows convention' }
          ],
          keywords: ['line', 'ending', 'newline', 'crlf', 'lf']
        },
        {
          id: EXPORT_SETTINGS.byteOrderMark,
          label: 'export.setting.bom.label',
          description: 'export.setting.bom.desc',
          kind: 'switch',
          defaultValue: false,
          keywords: ['bom', 'encoding', 'utf-8', 'excel']
        },
        {
          id: EXPORT_SETTINGS.destination,
          label: 'export.setting.destination.label',
          description: 'export.setting.destination.desc',
          kind: 'folder',
          defaultValue: '',
          keywords: ['folder', 'destination', 'output', 'path']
        },
        {
          id: EXPORT_SETTINGS.openInEditor,
          label: 'export.setting.openAfter.label',
          description: 'export.setting.openAfter.desc',
          kind: 'switch',
          defaultValue: false,
          keywords: ['vscode', 'editor', 'open', 'code']
        },
        {
          id: EXPORT_SETTINGS.editorId,
          label: 'export.setting.editor.label',
          description: 'export.setting.editor.desc',
          kind: 'select',
          defaultValue: '',
          options: [
            { value: '', label: 'Whichever is installed, Visual Studio Code first' },
            { value: 'vscode', label: 'Visual Studio Code' },
            { value: 'vscode-insiders', label: 'Visual Studio Code Insiders' },
            { value: 'vscodium', label: 'VSCodium' }
          ],
          keywords: ['vscode', 'insiders', 'vscodium', 'editor']
        },
        {
          id: EXPORT_SETTINGS.archiveName,
          label: 'export.setting.archiveName.label',
          description: 'export.setting.archiveName.desc',
          kind: 'text',
          defaultValue: 'studio-export',
          keywords: ['archive', 'name', 'zip', '7z'],
          validate: (value) =>
            String(value ?? '').trim().length === 0 ? 'An archive needs a name; an empty one would produce a file called only a date.' : null
        },
        {
          id: EXPORT_SETTINGS.archiveFormat,
          label: 'export.setting.archiveFormat.label',
          description: 'export.setting.archiveFormat.desc',
          kind: 'select',
          defaultValue: DEFAULT_ARCHIVE_OPTIONS.format,
          options: [
            { value: '7z', label: '7z — smaller, and the only one here that can hide the file names' },
            { value: 'zip', label: 'ZIP — opens everywhere with no extra software' }
          ],
          keywords: ['archive', 'zip', '7z', 'compress']
        },
        {
          id: EXPORT_SETTINGS.archiveMethod,
          label: 'export.setting.method.label',
          description: 'export.setting.method.desc',
          kind: 'select',
          defaultValue: DEFAULT_ARCHIVE_OPTIONS.method,
          options: allMethods.map((method) => ({ value: method, label: method })),
          keywords: ['lzma', 'lzma2', 'ppmd', 'bzip2', 'deflate', 'method']
        },
        {
          id: EXPORT_SETTINGS.archiveLevel,
          label: 'export.setting.level.label',
          description: 'export.setting.level.desc',
          kind: 'select',
          defaultValue: DEFAULT_ARCHIVE_OPTIONS.level,
          options: ARCHIVE_LEVELS,
          keywords: ['level', 'ultra', 'store', 'compression']
        },
        {
          id: EXPORT_SETTINGS.archiveDictionary,
          label: 'export.setting.dictionary.label',
          description: 'export.setting.dictionary.desc',
          kind: 'select',
          defaultValue: DEFAULT_ARCHIVE_OPTIONS.dictionary,
          options: DICTIONARY_SIZES.map((size) => ({ value: size, label: size })),
          keywords: ['dictionary', 'memory', 'window']
        },
        {
          id: EXPORT_SETTINGS.archiveWordSize,
          label: 'export.setting.wordSize.label',
          description: 'export.setting.wordSize.desc',
          kind: 'slider',
          defaultValue: DEFAULT_ARCHIVE_OPTIONS.wordSize,
          min: 8,
          max: 273,
          step: 1,
          keywords: ['word', 'fast bytes', 'match']
        },
        {
          id: EXPORT_SETTINGS.archiveSolid,
          label: 'export.setting.solid.label',
          description: 'export.setting.solid.desc',
          kind: 'switch',
          defaultValue: DEFAULT_ARCHIVE_OPTIONS.solid,
          keywords: ['solid', 'block', 'stream']
        },
        {
          id: EXPORT_SETTINGS.archiveSolidBlock,
          label: 'export.setting.solidBlock.label',
          description: 'export.setting.solidBlock.desc',
          kind: 'select',
          defaultValue: DEFAULT_ARCHIVE_OPTIONS.solidBlock,
          options: SOLID_BLOCK_SIZES.map((size) => ({
            value: size,
            label: size === 'on' ? 'on — one block for everything' : size
          })),
          keywords: ['solid', 'block', 'size']
        },
        {
          id: EXPORT_SETTINGS.archiveThreads,
          label: 'export.setting.threads.label',
          description: 'export.setting.threads.desc',
          kind: 'select',
          defaultValue: DEFAULT_ARCHIVE_OPTIONS.threads,
          options: [
            { value: 'off', label: 'off — one thread' },
            { value: 'on', label: 'on — the archiver chooses' },
            ...[1, 2, 4, 6, 8, 12, 16, 24, 32].map((count) => ({ value: String(count), label: String(count) }))
          ],
          keywords: ['threads', 'parallel', 'cpu']
        },
        {
          id: EXPORT_SETTINGS.archiveVolume,
          label: 'export.setting.volume.label',
          description: 'export.setting.volume.desc',
          kind: 'select',
          defaultValue: '',
          options: VOLUME_SIZES.map((size) => ({ value: size, label: size === '' ? 'one file' : size })),
          keywords: ['volume', 'split', 'parts']
        },
        {
          id: EXPORT_SETTINGS.archiveEncryptHeaders,
          label: 'export.setting.encryptHeaders.label',
          description: 'export.setting.encryptHeaders.desc',
          kind: 'switch',
          defaultValue: DEFAULT_ARCHIVE_OPTIONS.encryptHeaders,
          keywords: ['encrypt', 'headers', 'names', 'aes']
        },
        {
          id: EXPORT_SETTINGS.archiverCommand,
          label: 'export.setting.archiver.label',
          description: 'export.setting.archiver.desc',
          kind: 'text',
          defaultValue: '',
          hint: '7z',
          keywords: ['7z', 'archiver', 'command', 'path'],
          validate: (value) => {
            const text = String(value ?? '').trim();
            if (text.length === 0) return null;
            return /[\\/]/.test(text)
              ? 'Give a bare command name resolved on PATH. The privileged bridge refuses a filesystem path.'
              : null;
          }
        }
      ]
    }
  ],

  palette: [
    {
      id: 'export.destination.tab',
      title: 'export.tab.title',
      subtitle: 'export.lede',
      icon: 'download',
      kind: 'destination',
      keywords: ['export', 'download', 'save', 'csv', 'json', 'archive', 'zip', '7z', 'backup'],
      teleport: { tabId: EXPORT_TAB_ID }
    },
    {
      id: 'export.destination.sources',
      title: 'export.section.sources',
      icon: 'file',
      kind: 'destination',
      keywords: ['export', 'sources', 'what can be exported', 'records'],
      teleport: { tabId: EXPORT_TAB_ID, elementId: 'export-sources' }
    },
    {
      id: 'export.destination.format',
      title: 'export.section.format',
      icon: 'code',
      kind: 'destination',
      keywords: ['format', 'encoding', 'line endings', 'bom', 'utf-8'],
      teleport: { tabId: EXPORT_TAB_ID, elementId: 'export-format' }
    },
    {
      id: 'export.destination.run',
      title: 'export.section.run',
      icon: 'download',
      kind: 'destination',
      keywords: ['export now', 'write files', 'destination folder'],
      teleport: { tabId: EXPORT_TAB_ID, elementId: 'export-run' }
    },
    {
      id: 'export.destination.archive',
      title: 'export.section.archive',
      icon: 'save',
      kind: 'destination',
      keywords: ['archive', 'zip', '7z', 'lzma2', 'ppmd', 'encrypt', 'aes', 'volumes', 'solid'],
      teleport: { tabId: EXPORT_TAB_ID, elementId: 'export-archive' }
    },
    {
      id: 'export.destination.results',
      title: 'export.section.results',
      icon: 'history',
      kind: 'destination',
      keywords: ['results', 'written files', 'open in vscode'],
      teleport: { tabId: EXPORT_TAB_ID, elementId: 'export-results' }
    },
    {
      id: 'export.destination.vscode',
      title: 'export.vscode.title',
      icon: 'code',
      kind: 'destination',
      keywords: ['visual studio code', 'vscode', 'editor', 'open in editor'],
      teleport: { tabId: EXPORT_TAB_ID, elementId: 'export-vscode' }
    },
    {
      id: 'export.setting.defaultFormat',
      title: 'export.setting.format.label',
      icon: 'tune',
      kind: 'setting',
      settingId: EXPORT_SETTINGS.defaultFormat,
      keywords: ['default format', 'json', 'csv']
    },
    {
      id: 'export.setting.lineEnding',
      title: 'export.setting.eol.label',
      icon: 'tune',
      kind: 'setting',
      settingId: EXPORT_SETTINGS.lineEnding,
      keywords: ['line endings', 'crlf', 'lf']
    },
    {
      id: 'export.setting.bom',
      title: 'export.setting.bom.label',
      icon: 'tune',
      kind: 'setting',
      settingId: EXPORT_SETTINGS.byteOrderMark,
      keywords: ['bom', 'byte order mark', 'excel']
    },
    {
      id: 'export.setting.destinationFolder',
      title: 'export.setting.destination.label',
      icon: 'folder',
      kind: 'setting',
      settingId: EXPORT_SETTINGS.destination,
      keywords: ['destination', 'folder', 'output']
    },
    {
      id: 'export.setting.openAfter',
      title: 'export.setting.openAfter.label',
      icon: 'code',
      kind: 'setting',
      settingId: EXPORT_SETTINGS.openInEditor,
      keywords: ['vscode', 'open after export']
    },
    {
      id: 'export.setting.archiveFormatEntry',
      title: 'export.setting.archiveFormat.label',
      icon: 'save',
      kind: 'setting',
      settingId: EXPORT_SETTINGS.archiveFormat,
      keywords: ['zip', '7z']
    },
    {
      id: 'export.setting.encryptHeadersEntry',
      title: 'export.setting.encryptHeaders.label',
      icon: 'lock',
      kind: 'setting',
      settingId: EXPORT_SETTINGS.archiveEncryptHeaders,
      keywords: ['encrypt file names', 'headers', 'aes']
    },
    {
      id: 'export.command.formats',
      title: 'List every export format and what it is for',
      icon: 'book',
      kind: 'command',
      keywords: ['formats', 'json', 'yaml', 'toml', 'sql', 'typescript', 'python', 'go'],
      run: () => {
        // The context arrives at init; until then the command reports that
        // rather than doing nothing and looking broken.
        if (!app) {
          console.warn('The export feature has not been initialized yet, so the format list is not available.');
          return;
        }
        app.notify.info(
          app.t('export.section.format', 'How the file is written', { dialog: true }),
          FORMATS.map((format) => `${format.name} (.${format.extension}) — ${format.purpose}`).join('\n')
        );
      }
    },
    {
      id: 'export.command.open',
      title: 'Export something',
      subtitle: 'export.lede',
      icon: 'download',
      kind: 'command',
      keywords: ['export', 'take away', 'save to file', 'backup'],
      run: () => app?.tabs.open(EXPORT_TAB_ID)
    }
  ],

  docs: EXPORT_DOCS,

  init(ctx) {
    app = ctx;
  }
};

export default defineFeature(exportFeature);
