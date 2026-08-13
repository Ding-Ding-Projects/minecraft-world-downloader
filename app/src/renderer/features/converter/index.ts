import { defineFeature } from '../../core/registry';
import type { AppContext, PaletteEntry, SettingControl, SettingsSection, TabContext } from '../../core/registry';
import './styles.css';

import { mountCatalogTab } from './catalog';
import { mountConvertTab } from './convert-tab';
import { CONVERTER_DOCS } from './docs';
import {
  CHECKPOINT_EVERY_ID,
  CONCURRENCY_ID,
  CPU_BUDGET_ID,
  DEFAULTS,
  DESTINATION_ID,
  HEAD_BYTES_ID,
  KEEP_OUTCOMES_ID,
  MAX_DEPTH_ID,
  MAX_ENTRIES_ID,
  MAX_OUTPUT_BYTES_ID,
  MAX_PAGES_ID,
  MAX_PIXELS_ID,
  MAX_SOURCE_BYTES_ID,
  OVERWRITE_ID,
  RESUME_ON_LAUNCH_ID
} from './limits';
import { mountPdfToolsTab } from './pdftools';
import { QUEUE_PAUSED_ID, QUEUE_STORE_ID, queueEngine, resumeQueueOnLaunch } from './queue';
import { CONVERTER_STRINGS } from './strings';

/**
 * The universal file converter — inventory rows 11.1 through 11.4.
 *
 * Three tabs share the same registry: a format catalog that is exhaustive and
 * honest about what cannot run, a general convert queue that is durable and
 * bounded, and a PDF workbench whose every write is reopened and checked
 * before it is offered. Everything the other modules in this directory built
 * (`adapters.ts`, `pdf.ts`, `archives.ts`, `images.ts`, `media.ts`,
 * `records.ts`, `bytes.ts`, `detect.ts`, `formats.ts`, `limits.ts`) is wired
 * together here, plus `queue.ts`, `runtime.ts`, `discovery.ts`, `catalog.ts`,
 * `convert-tab.ts`, `pdftools.ts`, `docs.ts` and `strings.ts`.
 */

const TAB_CATALOG = 'converter.catalog';
const TAB_CONVERT = 'converter.convert';
const TAB_PDFTOOLS = 'converter.pdftools';
const SETTINGS_SECTION = 'converter.settings';

function positiveIntegerValidator(): (value: unknown) => string | null {
  return (value) => {
    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0 || !Number.isInteger(parsed)) {
      return 'Enter a whole number greater than zero.';
    }
    return null;
  };
}

function settingsSection(): SettingsSection {
  const controls: SettingControl[] = [
    {
      id: MAX_SOURCE_BYTES_ID,
      label: MAX_SOURCE_BYTES_ID,
      description: `${MAX_SOURCE_BYTES_ID}.description`,
      kind: 'number',
      defaultValue: DEFAULTS.sourceBytes,
      min: 1024,
      validate: positiveIntegerValidator(),
      keywords: ['converter', 'limit', 'size', 'source']
    },
    {
      id: MAX_OUTPUT_BYTES_ID,
      label: MAX_OUTPUT_BYTES_ID,
      description: `${MAX_OUTPUT_BYTES_ID}.description`,
      kind: 'number',
      defaultValue: DEFAULTS.outputBytes,
      min: 1024,
      validate: positiveIntegerValidator(),
      keywords: ['converter', 'limit', 'size', 'output']
    },
    {
      id: MAX_PIXELS_ID,
      label: MAX_PIXELS_ID,
      description: `${MAX_PIXELS_ID}.description`,
      kind: 'number',
      defaultValue: DEFAULTS.pixels,
      min: 1,
      validate: positiveIntegerValidator(),
      keywords: ['converter', 'limit', 'image', 'pixels']
    },
    {
      id: MAX_PAGES_ID,
      label: MAX_PAGES_ID,
      description: `${MAX_PAGES_ID}.description`,
      kind: 'number',
      defaultValue: DEFAULTS.pages,
      min: 1,
      validate: positiveIntegerValidator(),
      keywords: ['converter', 'limit', 'pdf', 'pages']
    },
    {
      id: MAX_ENTRIES_ID,
      label: MAX_ENTRIES_ID,
      description: `${MAX_ENTRIES_ID}.description`,
      kind: 'number',
      defaultValue: DEFAULTS.entries,
      min: 1,
      validate: positiveIntegerValidator(),
      keywords: ['converter', 'limit', 'archive', 'entries', 'objects']
    },
    {
      id: MAX_DEPTH_ID,
      label: MAX_DEPTH_ID,
      description: `${MAX_DEPTH_ID}.description`,
      kind: 'number',
      defaultValue: DEFAULTS.depth,
      min: 1,
      validate: positiveIntegerValidator(),
      keywords: ['converter', 'limit', 'nesting', 'depth']
    },
    {
      id: CPU_BUDGET_ID,
      label: CPU_BUDGET_ID,
      description: `${CPU_BUDGET_ID}.description`,
      kind: 'number',
      defaultValue: DEFAULTS.cpuMs,
      min: 1,
      validate: positiveIntegerValidator(),
      keywords: ['converter', 'limit', 'time', 'timeout', 'deadline']
    },
    {
      id: CONCURRENCY_ID,
      label: CONCURRENCY_ID,
      description: `${CONCURRENCY_ID}.description`,
      kind: 'slider',
      defaultValue: DEFAULTS.concurrency,
      min: 1,
      max: 16,
      step: 1,
      keywords: ['converter', 'queue', 'concurrency', 'parallel']
    },
    {
      id: CHECKPOINT_EVERY_ID,
      label: CHECKPOINT_EVERY_ID,
      description: `${CHECKPOINT_EVERY_ID}.description`,
      kind: 'number',
      defaultValue: DEFAULTS.checkpointEvery,
      min: 1,
      validate: positiveIntegerValidator(),
      keywords: ['converter', 'queue', 'checkpoint', 'save']
    },
    {
      id: DESTINATION_ID,
      label: DESTINATION_ID,
      description: `${DESTINATION_ID}.description`,
      kind: 'folder',
      defaultValue: DEFAULTS.destination,
      keywords: ['converter', 'queue', 'destination', 'folder', 'output']
    },
    {
      id: OVERWRITE_ID,
      label: OVERWRITE_ID,
      description: `${OVERWRITE_ID}.description`,
      kind: 'select',
      defaultValue: DEFAULTS.overwrite,
      options: [
        { value: 'confirm', label: `${OVERWRITE_ID}.confirm` },
        { value: 'skip', label: `${OVERWRITE_ID}.skip` },
        { value: 'overwrite', label: `${OVERWRITE_ID}.overwrite` }
      ],
      keywords: ['converter', 'queue', 'overwrite', 'existing', 'collision']
    },
    {
      id: RESUME_ON_LAUNCH_ID,
      label: RESUME_ON_LAUNCH_ID,
      description: `${RESUME_ON_LAUNCH_ID}.description`,
      kind: 'switch',
      defaultValue: DEFAULTS.resumeOnLaunch,
      keywords: ['converter', 'queue', 'resume', 'startup', 'launch']
    },
    {
      id: KEEP_OUTCOMES_ID,
      label: KEEP_OUTCOMES_ID,
      description: `${KEEP_OUTCOMES_ID}.description`,
      kind: 'number',
      defaultValue: DEFAULTS.keepOutcomes,
      min: 10,
      validate: positiveIntegerValidator(),
      keywords: ['converter', 'queue', 'history', 'retention']
    },
    {
      id: HEAD_BYTES_ID,
      label: HEAD_BYTES_ID,
      description: `${HEAD_BYTES_ID}.description`,
      kind: 'number',
      defaultValue: DEFAULTS.headBytes,
      min: 256,
      validate: positiveIntegerValidator(),
      keywords: ['converter', 'detect', 'signature', 'bytes']
    }
  ];

  return {
    id: SETTINGS_SECTION,
    title: 'converter.settings.title',
    icon: 'code',
    order: 300,
    controls
  };
}

function staticPalette(): PaletteEntry[] {
  return [
    {
      id: 'converter.palette.catalog',
      title: 'converter.palette.openCatalog',
      icon: 'file',
      kind: 'destination',
      keywords: ['convert', 'converter', 'catalog', 'format', 'pdf', 'archive', 'image', 'audio', 'video'],
      teleport: { tabId: TAB_CATALOG }
    },
    {
      id: 'converter.palette.convert',
      title: 'converter.palette.openConvert',
      icon: 'upload',
      kind: 'destination',
      keywords: ['convert', 'converter', 'queue', 'file', 'batch'],
      teleport: { tabId: TAB_CONVERT }
    },
    {
      id: 'converter.palette.pdftools',
      title: 'converter.palette.openPdfTools',
      icon: 'file',
      kind: 'destination',
      keywords: ['pdf', 'split', 'merge', 'extract', 'rotate', 'metadata', 'converter'],
      teleport: { tabId: TAB_PDFTOOLS }
    }
  ];
}

export default defineFeature({
  id: 'converter',
  name: 'File converter',
  description:
    'A local, bundled file converter: a categorized format catalog across eight categories, a durable bounded-concurrency convert queue, and a PDF workbench (inspect, split, merge, extract, reorder, rotate, metadata) whose every write is reopened and checked before it is offered.',

  strings: CONVERTER_STRINGS,

  tabs: [
    {
      id: TAB_CONVERT,
      title: 'converter.tab.convert',
      icon: 'upload',
      group: 'group.tools',
      order: 400,
      mount(host: HTMLElement, ctx: TabContext) {
        mountConvertTab(host, ctx);
      }
    },
    {
      id: TAB_CATALOG,
      title: 'converter.tab.catalog',
      icon: 'file',
      group: 'group.tools',
      order: 410,
      mount(host: HTMLElement, ctx: TabContext) {
        mountCatalogTab(host, ctx);
      }
    },
    {
      id: TAB_PDFTOOLS,
      title: 'converter.tab.pdftools',
      icon: 'file',
      group: 'group.tools',
      order: 420,
      mount(host: HTMLElement, ctx: TabContext) {
        mountPdfToolsTab(host, ctx);
      }
    }
  ],

  settings: [settingsSection()],
  palette: staticPalette(),
  docs: CONVERTER_DOCS,

  init(ctx: AppContext) {
    // The ad-hoc queue-state keys are not backed by a `SettingControl` (they
    // are data, not a user preference), so their compiled-in default is
    // declared here directly — the same pattern the shared worked example
    // uses for its own plain data store.
    ctx.settings.declareDefault(QUEUE_STORE_ID, []);
    ctx.settings.declareDefault(QUEUE_PAUSED_ID, false);

    // Creates the queue engine now (rather than waiting for the Convert tab
    // to be opened) so a durable queue left running when the application last
    // closed can resume before anyone has looked at the tab at all.
    queueEngine(ctx);
    resumeQueueOnLaunch(ctx);
  }
});
