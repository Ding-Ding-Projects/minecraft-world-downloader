/**
 * Application logo customization.
 *
 * Shipped vector marks, plus an image of the user's own converted here on this
 * computer into the exact sizes the application draws. The whole pipeline is
 * local, bounded and verified, and the mark it produces is presentation only:
 * nothing here moves the package identity, the installer identity, the update
 * feed or the data directory.
 */

import './styles.css';

import { defineFeature } from '../../core/registry';
import type { AppContext, SettingContext, TabContext } from '../../core/registry';
import { settings as settingsStore } from '../../core/settings';
import { tabs as tabService } from '../../core/tabs';
import { ARTICLES } from './docs';
import { FULL_CROP } from './conversion';
import { formatBytes, LIMITS } from './imageBytes';
import { mountLogoTab } from './panel';
import { DEFAULT_PRESET_ID, PRESETS } from './presets';
import {
  BACKGROUND_COLOUR_ID,
  BACKGROUND_TRANSPARENT_ID,
  CORNER_RADIUS_ID,
  CROP_ID,
  CUSTOM_RECORD_ID,
  CUSTOM_SOURCE,
  FIT_ID,
  FOCAL_X_ID,
  FOCAL_Y_ID,
  SAFE_AREA_ID,
  SHOW_IN_TITLE_BAR_ID,
  SOURCE_ID,
  applyToChrome,
  readCustomRecord,
  watchChrome
} from './state';
import { STRINGS } from './strings';

const TAB_ID = 'appLogo.main';

export default defineFeature({
  id: 'app-logo',
  name: 'Application logo',
  description:
    'Shipped logo marks plus a local, bounded and verified conversion of an image of your own. Presentation only: it never moves the installed identity.',

  strings: STRINGS,

  tabs: [
    {
      id: TAB_ID,
      title: 'appLogo.tab',
      icon: 'palette',
      group: 'group.personalisation',
      order: 210,
      mount(host: HTMLElement, ctx: TabContext) {
        mountLogoTab(host, ctx);
      }
    }
  ],

  settings: [
    {
      id: 'appLogo.settings',
      title: 'appLogo.tab',
      icon: 'palette',
      order: 210,
      controls: [
        {
          id: SOURCE_ID,
          label: 'appLogo.setting.source',
          description: 'appLogo.setting.source.description',
          kind: 'select',
          defaultValue: DEFAULT_PRESET_ID,
          keywords: ['logo', 'mark', 'icon', 'brand', 'preset'],
          options: [
            ...PRESETS.map((preset) => ({ value: preset.id, label: preset.labelKey })),
            { value: CUSTOM_SOURCE, label: 'appLogo.kind.custom' }
          ],
          validate(value) {
            if (value === CUSTOM_SOURCE) {
              // Choosing a mark that has not been converted yet would leave the
              // title bar with nothing to draw, so it is refused here with the
              // route out rather than accepted into a broken state.
              return readCustomRecord(settingsStore)
                ? null
                : 'No image of your own has been converted yet. Open the application logo tab, choose an image and convert it first.';
            }
            return PRESETS.some((preset) => preset.id === value)
              ? null
              : `"${String(value)}" is not a mark this build ships.`;
          }
        },
        {
          id: SHOW_IN_TITLE_BAR_ID,
          label: 'appLogo.setting.showInTitleBar',
          description: 'appLogo.setting.showInTitleBar.description',
          kind: 'switch',
          defaultValue: true,
          keywords: ['logo', 'title bar', 'chrome', 'brand']
        },
        {
          id: FIT_ID,
          label: 'appLogo.setting.fit',
          description: 'appLogo.setting.fit.description',
          kind: 'select',
          defaultValue: 'contain',
          keywords: ['fit', 'contain', 'cover', 'fill', 'stretch'],
          options: [
            { value: 'contain', label: 'appLogo.fit.contain' },
            { value: 'cover', label: 'appLogo.fit.cover' },
            { value: 'fill', label: 'appLogo.fit.fill' }
          ]
        },
        {
          id: FOCAL_X_ID,
          label: 'appLogo.setting.focalX',
          description: 'appLogo.setting.focalX.description',
          kind: 'slider',
          defaultValue: 50,
          min: 0,
          max: 100,
          step: 1,
          keywords: ['focal', 'horizontal', 'position']
        },
        {
          id: FOCAL_Y_ID,
          label: 'appLogo.setting.focalY',
          description: 'appLogo.setting.focalY.description',
          kind: 'slider',
          defaultValue: 50,
          min: 0,
          max: 100,
          step: 1,
          keywords: ['focal', 'vertical', 'position']
        },
        {
          id: BACKGROUND_TRANSPARENT_ID,
          label: 'appLogo.setting.backgroundTransparent',
          description: 'appLogo.setting.backgroundTransparent.description',
          kind: 'switch',
          defaultValue: true,
          keywords: ['transparent', 'alpha', 'background']
        },
        {
          id: BACKGROUND_COLOUR_ID,
          label: 'appLogo.setting.backgroundColour',
          description: 'appLogo.setting.backgroundColour.description',
          kind: 'color',
          defaultValue: '#ffffff',
          keywords: ['background', 'colour', 'color', 'fill']
        },
        {
          id: CORNER_RADIUS_ID,
          label: 'appLogo.setting.cornerRadius',
          description: 'appLogo.setting.cornerRadius.description',
          kind: 'slider',
          defaultValue: 0,
          min: 0,
          max: 50,
          step: 1,
          keywords: ['corner', 'radius', 'rounded', 'circle']
        },
        {
          id: SAFE_AREA_ID,
          label: 'appLogo.setting.safeArea',
          description: 'appLogo.setting.safeArea.description',
          kind: 'switch',
          defaultValue: false,
          keywords: ['safe area', 'guide', 'mask', 'circle']
        },
        {
          id: 'appLogo.action.openEditor',
          label: 'appLogo.setting.openEditor',
          description: 'appLogo.setting.openEditor.description',
          kind: 'action',
          defaultValue: null,
          keywords: ['logo', 'editor', 'crop', 'upload'],
          run(ctx: SettingContext) {
            ctx.tabs.teleport(TAB_ID, 'app-logo-upload');
          }
        },
        {
          id: 'appLogo.action.reset',
          label: 'appLogo.setting.resetAction',
          description: 'appLogo.setting.resetAction.description',
          kind: 'action',
          defaultValue: null,
          keywords: ['reset', 'shipped', 'default', 'remove'],
          async run(ctx: SettingContext) {
            await resetToShipped(ctx);
          }
        }
      ]
    }
  ],

  palette: [
    {
      id: 'appLogo.destination.main',
      title: 'appLogo.palette.open',
      subtitle: 'appLogo.tab.subtitle',
      icon: 'palette',
      kind: 'destination',
      keywords: ['logo', 'icon', 'brand', 'mark', 'appearance'],
      teleport: { tabId: TAB_ID }
    },
    {
      id: 'appLogo.command.upload',
      title: 'appLogo.palette.upload',
      icon: 'upload',
      kind: 'command',
      keywords: ['logo', 'upload', 'image', 'custom', 'convert'],
      // The picker lives in the tab, so the command lands the user on the
      // upload section rather than opening a second, detached dialog.
      run: () => tabService.teleport(TAB_ID, 'app-logo-upload'),
      teleport: { tabId: TAB_ID, elementId: 'app-logo-upload' }
    },
    {
      id: 'appLogo.setting.sourceEntry',
      title: 'appLogo.setting.source',
      icon: 'palette',
      kind: 'setting',
      settingId: SOURCE_ID,
      keywords: ['logo', 'mark', 'preset']
    },
    {
      id: 'appLogo.setting.titleBarEntry',
      title: 'appLogo.setting.showInTitleBar',
      icon: 'dock',
      kind: 'setting',
      settingId: SHOW_IN_TITLE_BAR_ID,
      keywords: ['logo', 'title bar']
    },
    {
      id: 'appLogo.setting.radiusEntry',
      title: 'appLogo.setting.cornerRadius',
      icon: 'tune',
      kind: 'setting',
      settingId: CORNER_RADIUS_ID,
      keywords: ['logo', 'corner', 'radius']
    }
  ],

  docs: ARTICLES,

  init(ctx: AppContext) {
    // Declared so `reset` restores the shipped value and the provenance line can
    // name what the application is actually falling back to.
    ctx.settings.declareDefault(SOURCE_ID, DEFAULT_PRESET_ID);
    ctx.settings.declareDefault(SHOW_IN_TITLE_BAR_ID, true);
    ctx.settings.declareDefault(FIT_ID, 'contain');
    ctx.settings.declareDefault(FOCAL_X_ID, 50);
    ctx.settings.declareDefault(FOCAL_Y_ID, 50);
    ctx.settings.declareDefault(BACKGROUND_TRANSPARENT_ID, true);
    ctx.settings.declareDefault(BACKGROUND_COLOUR_ID, '#ffffff');
    ctx.settings.declareDefault(CORNER_RADIUS_ID, 0);
    ctx.settings.declareDefault(SAFE_AREA_ID, false);
    ctx.settings.declareDefault(CROP_ID, FULL_CROP);
    ctx.settings.declareDefault(CUSTOM_RECORD_ID, null);

    // Reported rather than swallowed: a mark that silently did not appear is
    // indistinguishable from a mark the user never chose.
    const report = (result: { applied: boolean; reason: string }): void => {
      if (!result.applied && ctx.settings.get<boolean>(SHOW_IN_TITLE_BAR_ID, true)) {
        ctx.notify.warn(ctx.t('appLogo.notify.title', 'Application logo'), result.reason);
      }
    };

    // Features initialize BEFORE the shell mounts its title bar, so applying
    // the mark here would always find no chrome and always warn. `watchChrome`
    // applies immediately when the brand already exists and otherwise as soon
    // as it appears, reporting whichever actually happened -- so the warning
    // now means "the mark could not be placed" rather than "the shell has not
    // been built yet", which is the only version of it a user can act on.
    watchChrome(ctx.settings, report);

    ctx.settings.onChange((change) => {
      if (
        change.id === SOURCE_ID ||
        change.id === SHOW_IN_TITLE_BAR_ID ||
        change.id === CUSTOM_RECORD_ID ||
        change.id === CORNER_RADIUS_ID
      ) {
        applyToChrome(ctx.settings);
      }
    });
  }
});

/**
 * Restores the shipped mark.
 *
 * Deleting the converted sizes is irreversible from inside the application, so
 * it goes through the two-key gate and names exactly what disappears — and
 * exactly what does not, because the user's own file on disk is untouched and
 * saying so is the difference between a confident yes and a nervous one.
 */
async function resetToShipped(ctx: SettingContext): Promise<void> {
  const anchor = document.activeElement instanceof HTMLElement ? document.activeElement : document.body;
  const record = readCustomRecord(ctx.settings);

  const affected: string[] = [
    `The chosen mark returns to "${DEFAULT_PRESET_ID}"`,
    'The crop, fit, focal point, background and corner rounding return to their shipped values'
  ];
  if (record) {
    affected.push(
      `${record.variants.length} converted sizes totalling ${formatBytes(record.totalBytes)} are deleted from the settings file`
    );
  }

  const approved = await ctx.confirm.request({
    action: 'Reset the application logo to the shipped mark',
    affected,
    irreversible: record
      ? 'The converted sizes cannot be recovered from within the application; the image would have to be chosen and converted again. Your original file on disk is not touched, and no identity, data directory or update setting changes.'
      : 'Nothing is deleted, because no converted mark exists. The framing settings return to their shipped values and no identity, data directory or update setting changes.',
    anchor
  });
  if (!approved) return;

  ctx.settings.set(CUSTOM_RECORD_ID, null);
  ctx.settings.set(SOURCE_ID, DEFAULT_PRESET_ID);
  ctx.settings.set(CROP_ID, FULL_CROP);
  ctx.settings.set(FIT_ID, 'contain');
  ctx.settings.set(FOCAL_X_ID, 50);
  ctx.settings.set(FOCAL_Y_ID, 50);
  ctx.settings.set(BACKGROUND_TRANSPARENT_ID, true);
  ctx.settings.set(BACKGROUND_COLOUR_ID, '#ffffff');
  ctx.settings.set(CORNER_RADIUS_ID, 0);
  applyToChrome(ctx.settings);

  await ctx.history.record('Reset the application logo to the shipped mark', 'app-logo', {
    removedSizes: record?.variants.map((variant) => variant.size) ?? [],
    removedBytes: record?.totalBytes ?? 0,
    limitsAtTimeOfReset: { maxSourceBytes: LIMITS.maxSourceBytes }
  });

  ctx.notify.success(
    ctx.t('appLogo.notify.title', 'Application logo'),
    ctx.t('appLogo.remove.done', 'The converted sizes were removed and the shipped mark is back in use.')
  );
}
