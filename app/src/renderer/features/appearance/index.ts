import './styles.css';

import { defineFeature } from '../../core/registry';
import type { AppContext, FeatureModule, SettingsSection } from '../../core/registry';
import { APPEARANCE_DOCS } from './docs';
import {
  APPEARANCE_TAB_ID,
  SETTING_IMPORT_MODE,
  SETTING_INCLUDE_OVERRIDES,
  SETTING_LIVE_PREVIEW,
  SETTING_SAMPLE_TEXT,
  mountAppearance,
  revealAppearance
} from './panel';
import { countOverrides, currentDocument, deletePresets, presetRows, resetThemeValues } from './presets';
import { APPEARANCE_STRINGS } from './strings';

/**
 * The appearance studio.
 *
 * The per-element editor, the infinite colour picker and the typography controls
 * belong to the core appearance service. This feature is the SETTINGS surface
 * and the preset system built on top of them: it registers a destination, wires
 * the real theme controls to it, adds the named presets and the theme file, and
 * lists every rendered element so the editor can be reached from one place.
 *
 * The settings this feature owns are namespaced under `appearance.studio.` so
 * they cannot collide with the theme values the core already registers. Those
 * theme values are edited here through the same theme service, never through a
 * second copy of the state.
 */

function studioSettings(): SettingsSection {
  return {
    id: 'appearance.studio',
    title: 'appearance.setting.section',
    icon: 'palette',
    order: 31,
    controls: [
      {
        id: SETTING_LIVE_PREVIEW,
        label: 'appearance.setting.livePreview',
        description: 'appearance.setting.livePreview.description',
        kind: 'switch',
        defaultValue: true,
        keywords: ['live', 'preview', 'drag', 'slider', 'immediate']
      },
      {
        id: SETTING_SAMPLE_TEXT,
        label: 'appearance.setting.sampleText',
        description: 'appearance.setting.sampleText.description',
        kind: 'text',
        defaultValue: '',
        keywords: ['sample', 'preview', 'text', 'specimen'],
        validate: (value) =>
          typeof value === 'string' && value.length <= 120 ? null : 'Use at most 120 characters.'
      },
      {
        id: SETTING_INCLUDE_OVERRIDES,
        label: 'appearance.setting.includeOverrides',
        description: 'appearance.setting.includeOverrides.description',
        kind: 'switch',
        defaultValue: true,
        keywords: ['export', 'overrides', 'theme', 'file']
      },
      {
        id: SETTING_IMPORT_MODE,
        label: 'appearance.transfer.importMode',
        description: 'appearance.setting.importMode.description',
        kind: 'select',
        defaultValue: 'replace',
        keywords: ['import', 'merge', 'replace'],
        options: [
          { value: 'replace', label: 'appearance.transfer.importMode.replace' },
          { value: 'merge', label: 'appearance.transfer.importMode.merge' }
        ]
      },
      {
        id: 'appearance.studio.open',
        label: 'appearance.setting.openStudio',
        description: 'appearance.setting.openStudio.description',
        kind: 'action',
        defaultValue: null,
        keywords: ['appearance', 'theme', 'studio', 'open'],
        run: (ctx) => revealAppearance(ctx, 'theme')
      },
      {
        id: 'appearance.studio.resetTheme',
        label: 'appearance.action.resetTheme',
        description: 'appearance.setting.resetTheme.description',
        kind: 'action',
        defaultValue: null,
        keywords: ['reset', 'theme', 'default', 'shipped'],
        run: async (ctx) => {
          const overrides = countOverrides(currentDocument(ctx).overrides);
          const approved = await ctx.confirm.request({
            action: ctx.t('appearance.action.resetTheme', 'Reset the theme values'),
            affected: [
              'Colour scheme, accent colour, contrast and density',
              'Typeface, text size and text weight',
              `${overrides} per-element override(s) are NOT affected`
            ],
            irreversible:
              'The current theme values are replaced by the shipped ones. The change is recorded in local history, so the previous values can be read back from there.',
            anchor: (document.activeElement as HTMLElement | null) ?? document.body
          });
          if (!approved) return;
          const changed = resetThemeValues(ctx);
          await ctx.history.record('Reset the theme values', 'appearance', { changed });
          ctx.notify.success(
            ctx.t('appearance.action.resetTheme', 'Reset the theme values'),
            changed.length > 0 ? changed.join('; ') : 'Every theme value was already at its shipped value.'
          );
        }
      },
      {
        id: 'appearance.studio.deletePresets',
        label: 'appearance.action.deletePresets',
        description: 'appearance.setting.deletePresets.description',
        kind: 'action',
        defaultValue: null,
        keywords: ['delete', 'presets', 'saved', 'clear'],
        run: async (ctx) => {
          const saved = presetRows(ctx).filter((row) => row.kind === 'saved');
          if (saved.length === 0) {
            ctx.notify.info(
              ctx.t('appearance.action.deletePresets', 'Delete every preset you saved'),
              ctx.t('appearance.preset.emptyTitle', 'You have not saved a preset yet')
            );
            return;
          }
          const approved = await ctx.confirm.request({
            action: ctx.t('appearance.action.deletePresets', 'Delete every preset you saved'),
            affected: saved.map((row) => row.name),
            irreversible:
              'The saved copies are removed from the settings file. Any file you already exported is untouched, and the deletion is recorded in local history.',
            anchor: (document.activeElement as HTMLElement | null) ?? document.body
          });
          if (!approved) return;
          const outcome = await deletePresets(
            ctx,
            saved.map((row) => row.id)
          );
          ctx.notify.success(
            ctx.t('appearance.action.deletePresets', 'Delete every preset you saved'),
            `${outcome.removed.length} removed`
          );
        }
      }
    ]
  };
}

const feature: FeatureModule = defineFeature({
  id: 'appearance',
  name: 'Appearance studio',
  description:
    'The theme, the typography, the named presets and theme files, and a catalogue of every rendered element with its live sample and its appearance editor.',
  strings: APPEARANCE_STRINGS,
  settings: [studioSettings()],
  docs: APPEARANCE_DOCS,
  tabs: [
    {
      id: APPEARANCE_TAB_ID,
      title: 'appearance.tab.title',
      icon: 'palette',
      order: 100,
      mount: mountAppearance
    }
  ],
  palette: [
    {
      id: 'appearance.command.open',
      title: 'Appearance: theme, typography, presets and elements',
      subtitle: 'Appearance',
      icon: 'palette',
      kind: 'destination',
      keywords: ['appearance', 'theme', 'colour', 'color', 'font', 'preset', 'density'],
      run: () => revealAppearanceFromPalette('theme')
    },
    {
      id: 'appearance.command.theme',
      title: 'Appearance: colour scheme, accent, contrast and density',
      subtitle: 'Appearance · Theme',
      icon: 'palette',
      kind: 'destination',
      keywords: ['theme', 'dark', 'light', 'accent', 'seed', 'contrast', 'density'],
      run: () => revealAppearanceFromPalette('theme', 'appearance-theme-mode')
    },
    {
      id: 'appearance.command.seed',
      title: 'Appearance: choose the accent colour',
      subtitle: 'Appearance · Theme',
      icon: 'palette',
      kind: 'destination',
      keywords: ['accent', 'seed', 'colour', 'color', 'picker'],
      run: () => revealAppearanceFromPalette('theme', 'appearance-theme-seed')
    },
    {
      id: 'appearance.command.typography',
      title: 'Appearance: typeface, text size and text weight',
      subtitle: 'Appearance · Typography',
      icon: 'edit',
      kind: 'destination',
      keywords: ['font', 'typeface', 'size', 'weight', 'typography', 'cjk'],
      run: () => revealAppearanceFromPalette('typography', 'appearance-type-familyblock')
    },
    {
      id: 'appearance.command.presets',
      title: 'Appearance: presets and saved themes',
      subtitle: 'Appearance · Presets',
      icon: 'save',
      kind: 'destination',
      keywords: ['preset', 'theme', 'saved', 'apply'],
      run: () => revealAppearanceFromPalette('presets', 'appearance-presets')
    },
    {
      id: 'appearance.command.savePreset',
      title: 'Appearance: save the current appearance as a preset',
      subtitle: 'Appearance · Presets',
      icon: 'save',
      kind: 'command',
      keywords: ['save', 'preset', 'name', 'store'],
      run: () => revealAppearanceFromPalette('presets', 'appearance-save-preset')
    },
    {
      id: 'appearance.command.elements',
      title: 'Appearance: every rendered element and its editor',
      subtitle: 'Appearance · Rendered elements',
      icon: 'tune',
      kind: 'destination',
      keywords: ['element', 'selector', 'editor', 'chrome', 'menu', 'notification'],
      run: () => revealAppearanceFromPalette('elements', 'appearance-elements')
    },
    {
      id: 'appearance.command.export',
      title: 'Appearance: export the current appearance to a file',
      subtitle: 'Appearance · Export and import',
      icon: 'download',
      kind: 'command',
      keywords: ['export', 'file', 'theme', 'share', 'backup'],
      run: () => revealAppearanceFromPalette('transfer', 'appearance-export')
    },
    {
      id: 'appearance.command.import',
      title: 'Appearance: import an appearance file',
      subtitle: 'Appearance · Export and import',
      icon: 'upload',
      kind: 'command',
      keywords: ['import', 'file', 'theme', 'restore'],
      run: () => revealAppearanceFromPalette('transfer', 'appearance-import')
    },
    {
      id: 'appearance.command.kept',
      title: 'Appearance: entries an import kept but could not apply',
      subtitle: 'Appearance · Export and import',
      icon: 'info',
      kind: 'destination',
      keywords: ['kept', 'unapplied', 'import', 'unsupported'],
      run: () => revealAppearanceFromPalette('transfer', 'appearance-kept')
    }
  ],
  init(ctx: AppContext) {
    // The palette entries above are declared before the context exists, so the
    // context is captured here rather than smuggled through a module import.
    appContext = ctx;
  }
});

/**
 * The application context, captured at initialization.
 *
 * A palette entry's `run` has no context argument, so this is how a static entry
 * reaches the live services. It is set once, at boot, before any palette entry
 * can be selected.
 */
let appContext: AppContext | null = null;

function revealAppearanceFromPalette(section: Parameters<typeof revealAppearance>[1], elementId?: string): void {
  if (!appContext) return;
  revealAppearance(appContext, section, elementId);
}

export default feature;
