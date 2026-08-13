import { el, nextId } from '../../core/a11y';
import { openColorPicker } from '../../core/colorpicker';
import type { AppContext, ExportFormat, SearchBarHandle, TabContext, ThemeMode } from '../../core/registry';
import { ELEMENT_CATEGORIES, sampleText, type ElementCategory } from './elements';
import {
  countOverrides,
  currentDocument,
  deletePresets,
  duplicatePreset,
  exportText,
  hasUndo,
  importDocument,
  keptEntries,
  overrideRecords,
  presetRows,
  renamePreset,
  resetThemeValues,
  savePreset,
  storeKeptEntries,
  undoLastApply,
  validateDocument,
  applyPreset as applyPresetById,
  type KeptEntry,
  type PresetRow
} from './presets';

/**
 * The Appearance destination.
 *
 * Five sub-sections, each a real tab rather than a heading in one long scroll:
 * the theme, the typography, the presets, every rendered element, and the file
 * transfer. Every control on them is the real control, wired to the same theme
 * and appearance services the rest of the application uses, so a change here is
 * a change everywhere and there is no second copy of the value to drift.
 */

export const APPEARANCE_TAB_ID = 'appearance.studio';

export const SETTING_LIVE_PREVIEW = 'appearance.studio.livePreview';
export const SETTING_SAMPLE_TEXT = 'appearance.studio.sampleText';
export const SETTING_INCLUDE_OVERRIDES = 'appearance.studio.includeOverrides';
export const SETTING_IMPORT_MODE = 'appearance.studio.importMode';

export type SectionId = 'theme' | 'typography' | 'presets' | 'elements' | 'transfer';

/**
 * Set while the destination is mounted, so a palette entry can open the tab,
 * switch to the right sub-section and land on the exact element. Landing on the
 * page and leaving the reader to hunt for the control is not a teleport.
 */
let reveal: ((section: SectionId, elementId?: string) => void) | null = null;

export function revealAppearance(ctx: AppContext, section: SectionId, elementId?: string): void {
  ctx.tabs.open(APPEARANCE_TAB_ID);
  window.requestAnimationFrame(() => {
    reveal?.(section, elementId);
  });
}

/* ------------------------------------------------------------------ */
/* Small shared pieces                                                 */
/* ------------------------------------------------------------------ */

/**
 * One control with its label, its explanation behind progressive disclosure and
 * a provenance line that names the real value rather than the word "default".
 */
function controlBlock(
  ctx: AppContext,
  options: {
    label: string;
    description: string;
    control: HTMLElement;
    settingId?: string;
    defaultValue?: unknown;
    elementId?: string;
  }
): HTMLElement {
  const block = el('div', {
    className: 'appearance-block',
    attrs: { 'data-appearance-id': 'appearance:block' }
  });
  if (options.elementId) block.id = options.elementId;

  const head = el('div', { className: 'appearance-block__head' });
  const pair = ctx.i18n.pair(options.label, options.label);
  const title = el('div', { className: 'appearance-block__title' });
  title.append(el('span', { className: 'md-typescale-title-small', text: pair.primary }));
  if (pair.secondary) {
    title.append(el('span', { className: 'appearance-block__secondary md-typescale-body-small', text: pair.secondary }));
  }

  const descriptionId = nextId('appearance-description');
  const explain = el('button', {
    className: 'md-setting__explain',
    text: '?',
    attrs: {
      type: 'button',
      'aria-label': ctx.t('core.settings.explain', 'What this does'),
      'aria-expanded': 'false',
      'aria-controls': descriptionId
    }
  });
  const description = el('p', {
    className: 'md-setting__description md-typescale-body-small',
    text: ctx.t(options.description, options.description),
    attrs: { id: descriptionId }
  });
  description.hidden = true;
  explain.addEventListener('click', () => {
    description.hidden = !description.hidden;
    explain.setAttribute('aria-expanded', String(!description.hidden));
  });

  head.append(title, explain);
  block.append(head, description, options.control);

  if (options.settingId) {
    const provenance = el('p', { className: 'md-setting__provenance md-typescale-body-small' });
    const refresh = (): void => {
      const source = ctx.settings.provenanceOf(options.settingId as string);
      provenance.textContent =
        source === 'default'
          ? ctx.t(
              'appearance.provenance.default',
              'No file has ever set this. The application is using its own value: {value}.',
              { values: { value: describeValue(options.defaultValue) } }
            )
          : source === 'user'
            ? ctx.t('appearance.provenance.user', 'Set by you.')
            : source === 'imported'
              ? ctx.t('appearance.provenance.imported', 'Set by an imported file.')
              : ctx.t('appearance.provenance.scheduled', 'Set by a schedule.');
    };
    refresh();
    const stop = ctx.settings.onChange((change) => {
      if (change.id === options.settingId) refresh();
    });
    block.addEventListener('md-dispose', () => stop());
    block.append(provenance);
  }

  return block;
}

function describeValue(value: unknown): string {
  if (value === undefined || value === null) return 'not set';
  if (value === '') return 'an empty string';
  return String(value);
}

function heading(ctx: AppContext, title: string, description?: string): HTMLElement {
  return ctx.components.sectionHeading({ title, description });
}

/** Shared multi-select behaviour: shift ranges, a keyboard path, honest scope. */
interface SelectionModel {
  selected: Set<string>;
  anchorIndex: number | null;
}

function extendRange(model: SelectionModel, ids: string[], index: number, on: boolean): void {
  const from = model.anchorIndex === null ? index : model.anchorIndex;
  const [start, end] = from <= index ? [from, index] : [index, from];
  for (let cursor = start; cursor <= end; cursor += 1) {
    const id = ids[cursor];
    if (id === undefined) continue;
    if (on) model.selected.add(id);
    else model.selected.delete(id);
  }
}

/* ------------------------------------------------------------------ */
/* Theme                                                               */
/* ------------------------------------------------------------------ */

const ROLE_SWATCHES = [
  'primary',
  'on-primary',
  'primary-container',
  'secondary',
  'tertiary',
  'error',
  'surface',
  'surface-container',
  'surface-container-high',
  'on-surface',
  'on-surface-variant',
  'outline'
];

function buildThemeSection(ctx: TabContext): HTMLElement {
  const section = el('div', { className: 'appearance-section', attrs: { id: 'appearance-theme' } });
  section.append(
    heading(ctx, 'appearance.section.theme', 'appearance.theme.previewNote'),
    el('p', {
      className: 'md-typescale-body-medium',
      text: ctx.t(
        'appearance.theme.previewNote',
        'Every control below is the real one. Changing it changes this window immediately, with no restart.'
      )
    })
  );

  /* ---- the live preview of the generated colour roles ---- */

  const preview = el('div', { className: 'appearance-swatches', attrs: { id: 'appearance-theme-preview' } });
  const swatchValues = new Map<string, HTMLElement>();
  for (const role of ROLE_SWATCHES) {
    const cell = el('div', {
      className: 'appearance-swatch',
      attrs: { 'data-appearance-id': 'appearance:swatch' }
    });
    const chip = el('span', { className: 'appearance-swatch__chip' });
    chip.style.background = `var(--md-sys-color-${role})`;
    const name = el('span', { className: 'appearance-swatch__name md-typescale-label-small', text: role });
    const value = el('code', { className: 'appearance-swatch__value' });
    swatchValues.set(role, value);
    cell.append(chip, name, value);
    preview.append(cell);
  }

  const schemeReadout = el('p', { className: 'md-typescale-body-small', attrs: { role: 'status' } });

  const refreshPreview = (): void => {
    const computed = getComputedStyle(document.documentElement);
    for (const [role, node] of swatchValues) {
      node.textContent = computed.getPropertyValue(`--md-sys-color-${role}`).trim() || 'not set';
    }
    const state = ctx.theme.state();
    schemeReadout.textContent = ctx.t(
      'appearance.theme.schemeReadout',
      'Rendering the {scheme} scheme right now, generated from {seed} at {contrast} contrast and density {density}.',
      {
        values: {
          scheme: state.dark ? ctx.t('appearance.theme.mode.dark', 'Dark') : ctx.t('appearance.theme.mode.light', 'Light'),
          seed: state.seed,
          contrast: state.contrast,
          density: state.density
        }
      }
    );
  };

  section.append(
    el('h3', { className: 'md-typescale-title-small', text: ctx.t('appearance.theme.tokenRoles', 'Colour roles') }),
    preview,
    schemeReadout
  );

  /* ---- colour scheme ---- */

  const modeControl = ctx.components.segmentedButton({
    label: 'appearance.theme.mode',
    value: ctx.theme.state().mode,
    options: [
      { value: 'light', label: 'appearance.theme.mode.light', icon: 'visibility' },
      { value: 'dark', label: 'appearance.theme.mode.dark', icon: 'visibility' },
      { value: 'system', label: 'appearance.theme.mode.system', icon: 'world' }
    ],
    onChange: (value) => ctx.theme.setMode(value as ThemeMode)
  });

  section.append(
    controlBlock(ctx, {
      label: 'appearance.theme.mode',
      description: 'appearance.theme.mode.description',
      control: modeControl.root,
      settingId: 'appearance.themeMode',
      defaultValue: 'system',
      elementId: 'appearance-theme-mode'
    })
  );

  /* ---- accent colour, through the infinite picker ---- */

  const seedRow = el('div', { className: 'appearance-seed' });
  const seedChip = el('span', { className: 'appearance-seed__chip' });
  const seedValue = el('code', { className: 'appearance-seed__value' });
  const seedButton = ctx.components.button({
    label: 'appearance.theme.seedOpen',
    variant: 'outlined',
    icon: 'palette',
    onClick: () => {
      openColorPicker({
        anchor: seedButton,
        value: ctx.theme.state().seed,
        contrastAgainst: getComputedStyle(document.body).backgroundColor,
        onChange: (value) => ctx.theme.setSeed(value)
      });
    }
  });
  seedRow.append(seedChip, seedValue, seedButton);

  section.append(
    controlBlock(ctx, {
      label: 'appearance.theme.seed',
      description: 'core.appearance.seed.description',
      control: seedRow,
      settingId: 'appearance.seed',
      defaultValue: '#4f6bed',
      elementId: 'appearance-theme-seed'
    })
  );

  /* ---- contrast ---- */

  const contrastControl = ctx.components.select({
    label: 'appearance.theme.contrast',
    value: ctx.theme.state().contrast,
    options: [
      { value: 'standard', label: 'appearance.theme.contrast.standard' },
      { value: 'medium', label: 'appearance.theme.contrast.medium' },
      { value: 'high', label: 'appearance.theme.contrast.high' }
    ],
    onChange: (value) => {
      if (value === 'standard' || value === 'medium' || value === 'high') ctx.theme.setContrast(value);
    }
  });

  section.append(
    controlBlock(ctx, {
      label: 'appearance.theme.contrast',
      description: 'appearance.theme.contrast.description',
      control: contrastControl.root,
      settingId: 'appearance.contrast',
      defaultValue: 'standard',
      elementId: 'appearance-theme-contrast'
    })
  );

  /* ---- density, honouring the apply-while-dragging setting ---- */

  const livePreview = (): boolean => ctx.settings.get<boolean>(SETTING_LIVE_PREVIEW, true) !== false;

  const densityControl = ctx.components.slider({
    label: 'appearance.theme.density',
    min: -3,
    max: 0,
    step: 1,
    value: ctx.theme.state().density,
    showTicks: true,
    onChange: (value) => {
      if (livePreview()) ctx.theme.setDensity(value);
    }
  });
  const densityInput = densityControl.root.querySelector('input');
  densityInput?.addEventListener('change', () => {
    if (!livePreview()) ctx.theme.setDensity(Number(densityInput.value));
  });

  section.append(
    controlBlock(ctx, {
      label: 'appearance.theme.density',
      description: 'appearance.theme.density.description',
      control: densityControl.root,
      settingId: 'appearance.density',
      defaultValue: 0,
      elementId: 'appearance-theme-density'
    })
  );

  /* ---- reset ---- */

  const resetButton = ctx.components.button({
    label: 'appearance.action.resetTheme',
    variant: 'outlined',
    icon: 'refresh',
    onClick: () => {
      void (async () => {
        const approved = await ctx.confirm.request({
          action: ctx.t('appearance.action.resetTheme', 'Reset the theme values'),
          affected: [
            `Colour scheme, accent colour, contrast and density`,
            `Typeface, text size and text weight`,
            `${countOverrides(currentDocument(ctx).overrides)} per-element override(s) are NOT affected`
          ],
          irreversible:
            'The current theme values are replaced by the shipped ones. The change is recorded in local history, so the previous values can be read back from there.',
          anchor: resetButton
        });
        if (!approved) return;
        const changed = resetThemeValues(ctx);
        await ctx.history.record('Reset the theme values', 'appearance', { changed });
        ctx.notify.success(
          ctx.t('appearance.action.resetTheme', 'Reset the theme values'),
          changed.length > 0 ? changed.join('; ') : 'Every theme value was already at its shipped value.'
        );
      })();
    }
  });
  section.append(resetButton);

  const stopTheme = ctx.theme.onChange(() => {
    refreshPreview();
    const state = ctx.theme.state();
    modeControl.set(state.mode);
    contrastControl.set(state.contrast);
    densityControl.set(state.density);
    seedChip.style.background = state.seed;
    seedValue.textContent = state.seed;
  });
  ctx.onDispose(() => stopTheme());

  refreshPreview();
  const initial = ctx.theme.state();
  seedChip.style.background = initial.seed;
  seedValue.textContent = initial.seed;

  return section;
}

/* ------------------------------------------------------------------ */
/* Typography                                                          */
/* ------------------------------------------------------------------ */

const TYPE_SCALE_SAMPLES: Array<{ className: string; label: string; basePx: number }> = [
  { className: 'md-typescale-display-small', label: 'Display small', basePx: 36 },
  { className: 'md-typescale-headline-small', label: 'Headline small', basePx: 24 },
  { className: 'md-typescale-title-medium', label: 'Title medium', basePx: 16 },
  { className: 'md-typescale-body-large', label: 'Body large', basePx: 16 },
  { className: 'md-typescale-label-medium', label: 'Label medium', basePx: 12 }
];

/** Written out so the units are visible rather than hidden behind a factor. */
function pixelsToPoints(pixels: number): number {
  return (pixels * 72) / 96;
}

function buildTypographySection(ctx: TabContext): HTMLElement {
  const section = el('div', { className: 'appearance-section', attrs: { id: 'appearance-typography' } });
  section.append(heading(ctx, 'appearance.section.typography'));

  /* ---- the live preview ---- */

  const preview = el('div', {
    className: 'appearance-typepreview',
    attrs: { id: 'appearance-type-preview', 'data-appearance-id': 'appearance:type-preview' }
  });
  const previewLines: Array<{ node: HTMLElement; basePx: number; readout: HTMLElement }> = [];
  for (const scale of TYPE_SCALE_SAMPLES) {
    const line = el('div', { className: 'appearance-typepreview__line' });
    const text = el('p', { className: scale.className });
    const readout = el('span', { className: 'appearance-typepreview__meta md-typescale-label-small' });
    line.append(text, readout);
    preview.append(line);
    previewLines.push({ node: text, basePx: scale.basePx, readout });
  }
  const cjkLine = el('p', { className: 'md-typescale-body-large appearance-typepreview__cjk' });
  const cjkNote = el('p', {
    className: 'md-typescale-body-small',
    text: ctx.t(
      'appearance.type.cjkNote',
      'The Chinese line is the fallback check: a family with no Chinese coverage still renders it from the bundled stack rather than as empty boxes.'
    )
  });
  preview.append(cjkLine, cjkNote);
  section.append(preview);

  const refreshPreview = (): void => {
    const state = ctx.theme.state();
    const text = sampleText(ctx);
    for (const line of previewLines) {
      line.node.textContent = text;
      const px = Math.round(line.basePx * state.fontScale * 100) / 100;
      line.readout.textContent = `${px}px · ${Math.round(pixelsToPoints(px) * 100) / 100}pt`;
    }
    // A glyph-coverage specimen, deliberately naming nothing that belongs to a
    // capability the study mode hides. It is a font check, not interface copy.
    cjkLine.textContent = '中文字體樣本 · 廣東話 · 0123456789';
  };
  refreshPreview();

  /* ---- typeface list ---- */

  const familyHost = el('div', { className: 'appearance-fontlist', attrs: { id: 'appearance-type-family' } });
  const familyStatus = el('p', { className: 'md-typescale-body-small', attrs: { role: 'status' } });
  const familyList = el('div', {
    className: 'appearance-fontlist__rows',
    attrs: { role: 'radiogroup', 'aria-label': ctx.t('appearance.type.family', 'Interface typeface') }
  });
  const familyCount = el('p', { className: 'md-typescale-body-small', attrs: { role: 'status' } });

  let installed: string[] = [];
  let familySearch: SearchBarHandle | null = null;

  const applyFamily = (family: string): void => {
    ctx.theme.setFontFamily(family);
    refreshFamilyStatus();
    drawFamilies(familySearch?.query().text ?? '');
  };

  const refreshFamilyStatus = (): void => {
    const chosen = ctx.theme.state().fontFamily;
    if (chosen === '') {
      familyStatus.textContent = ctx.t(
        'appearance.type.systemDefaultStatus',
        'The bundled stack is rendering, which covers Latin and Chinese on this platform.'
      );
      return;
    }
    familyStatus.textContent = installed.includes(chosen)
      ? ctx.t('appearance.type.installed', '"{family}" is installed on this computer and is rendering now.', {
          values: { family: chosen }
        })
      : ctx.t(
          'appearance.type.notInstalled',
          '"{family}" is not installed on this computer. Your choice is kept; the bundled stack renders in its place.',
          { values: { family: chosen } }
        );
  };

  const drawFamilies = (query: string): void => {
    const match = familySearch?.query();
    const chosen = ctx.theme.state().fontFamily;
    const entries = [{ value: '', name: ctx.t('appearance.type.systemDefault', 'System default') }, ...installed.map((family) => ({ value: family, name: family }))];
    const filtered = entries.filter((item) => (match ? match.matches(item.name) : item.name.includes(query)));

    familyList.textContent = '';
    // The list is short on every machine seen so far, but it is bounded anyway:
    // a machine with a very large font library must not build a control per
    // family and make the page stutter.
    const LIMIT = 300;
    for (const item of filtered.slice(0, LIMIT)) {
      const option = el('button', {
        className: 'appearance-fontlist__row',
        attrs: {
          type: 'button',
          role: 'radio',
          'aria-checked': String(item.value === chosen),
          'data-appearance-id': 'appearance:font-row'
        }
      });
      const name = el('span', { className: 'appearance-fontlist__name md-typescale-body-large', text: item.name });
      const sample = el('span', { className: 'appearance-fontlist__sample', text: `${sampleText(ctx)} · 廣東話` });
      if (item.value) {
        // Each family previews in its own face, which is the only way to choose
        // a typeface without applying it first.
        name.style.fontFamily = `"${item.value}", ${'sans-serif'}`;
        sample.style.fontFamily = `"${item.value}", sans-serif`;
      }
      option.append(name, sample);
      option.addEventListener('click', () => applyFamily(item.value));
      familyList.append(option);
    }

    familyCount.textContent =
      filtered.length > LIMIT
        ? ctx.t(
            'appearance.type.familyCountLimited',
            '{shown} of {total} typefaces shown. Narrow the search to reach the rest.',
            { values: { shown: LIMIT, total: filtered.length } }
          )
        : ctx.t('core.search.matchCount', '{count} of {total} shown', {
            values: { count: filtered.length, total: entries.length }
          });
  };

  familySearch = ctx.createSearchBar({
    label: 'appearance.type.familySearch',
    sample: 'Segoe UI\nRoboto\nNoto Sans CJK HK\nConsolas',
    onChange: (query) => drawFamilies(query.text)
  });

  familyHost.append(familySearch.root, familyCount, familyList, familyStatus);

  const customField = ctx.components.textField({
    label: 'appearance.type.custom',
    value: ctx.theme.state().fontFamily,
    supportingText: ctx.t(
      'appearance.type.customHint',
      'Type an exact family name. If this machine does not have it, the name is kept and the bundled stack renders instead.'
    ),
    onCommit: (value) => applyFamily(value.trim())
  });
  familyHost.append(customField.root);

  void ctx.theme.availableFonts().then((families) => {
    installed = families;
    drawFamilies('');
    refreshFamilyStatus();
  });

  section.append(
    controlBlock(ctx, {
      label: 'appearance.type.family',
      description: 'appearance.type.family.description',
      control: familyHost,
      settingId: 'appearance.fontFamily',
      defaultValue: '',
      elementId: 'appearance-type-familyblock'
    })
  );

  /* ---- size and weight ---- */

  const livePreview = (): boolean => ctx.settings.get<boolean>(SETTING_LIVE_PREVIEW, true) !== false;

  const scaleReadout = el('p', { className: 'md-typescale-body-small', attrs: { role: 'status' } });
  const refreshScaleReadout = (): void => {
    const px = Math.round(16 * ctx.theme.state().fontScale * 100) / 100;
    scaleReadout.textContent = ctx.t(
      'appearance.type.scaleReadout',
      'Body text renders at {px} CSS pixels, which is {pt} points at 96 dpi.',
      { values: { px, pt: Math.round(pixelsToPoints(px) * 100) / 100 } }
    );
  };
  refreshScaleReadout();

  const scaleControl = ctx.components.slider({
    label: 'appearance.type.scale',
    min: 0.8,
    max: 1.6,
    step: 0.05,
    value: ctx.theme.state().fontScale,
    onChange: (value) => {
      if (livePreview()) ctx.theme.setFontScale(value);
    }
  });
  const scaleInput = scaleControl.root.querySelector('input');
  scaleInput?.addEventListener('change', () => {
    if (!livePreview()) ctx.theme.setFontScale(Number(scaleInput.value));
  });

  const scaleHost = el('div');
  scaleHost.append(scaleControl.root, scaleReadout);

  section.append(
    controlBlock(ctx, {
      label: 'appearance.type.scale',
      description: 'appearance.type.scale.description',
      control: scaleHost,
      settingId: 'appearance.fontScale',
      defaultValue: 1,
      elementId: 'appearance-type-scale'
    })
  );

  const weightControl = ctx.components.slider({
    label: 'appearance.type.weight',
    min: 100,
    max: 900,
    step: 100,
    value: ctx.theme.state().fontWeight,
    showTicks: true,
    onChange: (value) => {
      if (livePreview()) ctx.theme.setFontWeight(value);
    }
  });
  const weightInput = weightControl.root.querySelector('input');
  weightInput?.addEventListener('change', () => {
    if (!livePreview()) ctx.theme.setFontWeight(Number(weightInput.value));
  });

  section.append(
    controlBlock(ctx, {
      label: 'appearance.type.weight',
      description: 'appearance.type.weight.description',
      control: weightControl.root,
      settingId: 'appearance.fontWeight',
      defaultValue: 400,
      elementId: 'appearance-type-weight'
    })
  );

  const stopTheme = ctx.theme.onChange(() => {
    const state = ctx.theme.state();
    scaleControl.set(state.fontScale);
    weightControl.set(state.fontWeight);
    customField.set(state.fontFamily);
    refreshScaleReadout();
    refreshPreview();
    refreshFamilyStatus();
  });
  ctx.onDispose(() => {
    stopTheme();
    familySearch?.destroy();
  });

  return section;
}

/* ------------------------------------------------------------------ */
/* Presets                                                             */
/* ------------------------------------------------------------------ */

function buildPresetSection(ctx: TabContext): HTMLElement {
  const section = el('div', { className: 'appearance-section', attrs: { id: 'appearance-presets' } });
  section.append(heading(ctx, 'appearance.section.presets'));

  const model: SelectionModel = { selected: new Set(), anchorIndex: null };
  let rows: PresetRow[] = [];
  let shown: PresetRow[] = [];

  const summary = el('p', { className: 'md-typescale-body-small', attrs: { role: 'status' } });
  const listHost = el('div', { className: 'appearance-presets' });
  const emptyHost = el('div');
  const bulkBar = el('div', {
    className: 'appearance-bulkbar',
    attrs: { role: 'group', 'data-appearance-id': 'appearance:bulkbar' }
  });
  const undoHost = el('div');

  const modifiers = { shift: false };

  const refreshSummary = (): void => {
    summary.textContent = ctx.t(
      'appearance.preset.selection',
      '{selected} of {shown} shown selected, out of {total} in total.',
      { values: { selected: model.selected.size, shown: shown.length, total: rows.length } }
    );
  };

  const draw = (): void => {
    rows = presetRows(ctx);
    const query = search.query();
    shown = rows.filter((row) => query.matches(`${row.name} ${row.note} ${row.kind}`));
    // A selection cannot survive a preset being deleted elsewhere.
    for (const id of [...model.selected]) {
      if (!rows.some((row) => row.id === id)) model.selected.delete(id);
    }

    listHost.textContent = '';
    const ids = shown.map((row) => row.id);

    for (const [index, row] of shown.entries()) {
      const card = el('div', {
        className: 'appearance-preset',
        attrs: {
          id: `appearance-preset-${row.id}`,
          'aria-selected': String(model.selected.has(row.id)),
          // One shared appearance id, so styling a preset card styles them all
          // rather than only the preset that happened to be right-clicked.
          'data-appearance-id': 'appearance:preset-card'
        }
      });

      card.addEventListener('pointerdown', (event) => {
        modifiers.shift = event.shiftKey;
      });
      card.addEventListener(
        'keydown',
        (event) => {
          modifiers.shift = event.shiftKey;
        },
        true
      );

      const selectable = row.kind === 'saved';
      const box = ctx.components.checkbox({
        label: row.name,
        checked: model.selected.has(row.id),
        disabled: !selectable,
        disabledReason: selectable
          ? undefined
          : ctx.t(
              'appearance.preset.bulkOnlySaved',
              'Only presets you saved can be renamed or deleted. Application presets are part of the build.'
            ),
        onChange: (checked) => {
          if (modifiers.shift) extendRange(model, ids, index, checked);
          else if (checked) model.selected.add(row.id);
          else model.selected.delete(row.id);
          modifiers.shift = false;
          model.anchorIndex = index;
          draw();
        }
      });
      box.root.classList.add('appearance-preset__select');

      const head = el('div', { className: 'appearance-preset__head' });
      const titles = el('div');
      titles.append(el('span', { className: 'md-typescale-title-small', text: row.name }));
      titles.append(
        ctx.components.badge({
          label:
            row.kind === 'saved'
              ? ctx.t('appearance.preset.kind.saved', 'Saved by you')
              : ctx.t('appearance.preset.kind.application', 'Provided by the application')
        })
      );
      head.append(box.root, titles);

      const detail = el('div', { className: 'appearance-preset__detail' });
      if (row.note) detail.append(el('p', { className: 'md-typescale-body-small', text: row.note }));
      if (row.observed && row.observed.length > 0) {
        detail.append(
          el('p', {
            className: 'md-typescale-body-small',
            text: ctx.t('appearance.preset.observed', 'Last time this was applied it set: {summary}', {
              values: { summary: row.observed.join('; ') }
            })
          })
        );
      } else if (row.kind === 'saved' && row.document) {
        const themeCount = Object.keys(row.document.theme).length;
        const overrides = countOverrides(row.document.overrides);
        detail.append(
          el('p', {
            className: 'md-typescale-body-small',
            text: ctx.t(
              'appearance.preset.contents',
              'This preset carries {theme} theme value(s) and {overrides} element override(s).',
              { values: { theme: themeCount, overrides } }
            )
          })
        );
      } else {
        detail.append(
          el('p', {
            className: 'md-typescale-body-small',
            text: ctx.t(
              'appearance.preset.unobserved',
              'This preset ships with the application. The exact values it sets are listed here the first time it is applied, and the appearance it replaced can be put back from the notification or from local history.'
            )
          })
        );
      }

      const actions = el('div', { className: 'appearance-preset__actions' });
      const applyButton = ctx.components.button({
        label: 'appearance.preset.apply',
        variant: 'filled',
        icon: 'check',
        onClick: () => void applyOne(row)
      });
      const moreButton = ctx.components.iconButton({
        icon: 'more',
        label: ctx.t('core.action.more', 'More'),
        onClick: () => {
          ctx.components.menu({
            anchor: moreButton,
            label: row.name,
            items: [
              {
                id: 'rename',
                label: 'appearance.preset.rename',
                icon: 'edit',
                disabled: row.kind !== 'saved',
                disabledReason: ctx.t(
                  'appearance.preset.bulkOnlySaved',
                  'Only presets you saved can be renamed or deleted. Application presets are part of the build.'
                ),
                run: () => void renameOne(row, moreButton)
              },
              {
                id: 'duplicate',
                label: 'appearance.preset.duplicate',
                icon: 'copy',
                disabled: row.kind !== 'saved',
                disabledReason: ctx.t(
                  'appearance.preset.bulkOnlySaved',
                  'Only presets you saved can be renamed or deleted. Application presets are part of the build.'
                ),
                run: () => {
                  void duplicatePreset(ctx, row.id).then((result) => {
                    if (!result.ok) ctx.notify.warn(ctx.t('appearance.preset.duplicate', 'Duplicate'), result.error ?? '');
                    draw();
                  });
                }
              },
              {
                id: 'export',
                label: 'appearance.preset.exportOne',
                icon: 'download',
                disabled: row.kind !== 'saved',
                disabledReason: ctx.t(
                  'appearance.preset.bulkOnlySaved',
                  'Only presets you saved can be renamed or deleted. Application presets are part of the build.'
                ),
                run: () => void exportPresets([row])
              },
              {
                id: 'delete',
                label: 'appearance.preset.delete',
                icon: 'trash',
                danger: true,
                separatorBefore: true,
                disabled: row.kind !== 'saved',
                disabledReason: ctx.t(
                  'appearance.preset.bulkOnlySaved',
                  'Only presets you saved can be renamed or deleted. Application presets are part of the build.'
                ),
                run: () => void removePresets([row], moreButton)
              }
            ]
          });
        }
      });
      actions.append(applyButton, moreButton);

      card.append(head, detail, actions);
      listHost.append(card);
    }

    emptyHost.textContent = '';
    if (rows.filter((row) => row.kind === 'saved').length === 0) {
      emptyHost.append(
        ctx.components.emptyState({
          title: 'appearance.preset.emptyTitle',
          body: 'appearance.preset.emptyBody',
          action: {
            label: 'appearance.preset.save',
            variant: 'tonal',
            icon: 'save',
            onClick: () => {
              nameField.focus();
            }
          }
        })
      );
    }

    undoHost.textContent = '';
    if (hasUndo(ctx)) {
      undoHost.append(
        ctx.components.button({
          label: 'appearance.preset.undo',
          variant: 'text',
          icon: 'history',
          onClick: () => {
            void undoLastApply(ctx).then((result) => {
              if (result.ok) {
                ctx.notify.success(ctx.t('appearance.preset.undone', 'The appearance from before the preset was restored.'));
                ctx.a11y.announce(ctx.t('appearance.preset.undone', 'The appearance from before the preset was restored.'));
              } else {
                ctx.notify.warn(ctx.t('appearance.preset.undo', 'Put the previous appearance back'), result.error ?? '');
              }
              draw();
            });
          }
        })
      );
    }

    refreshSummary();
    drawBulkBar();
    refreshListLosses();
  };

  const selectedRows = (): PresetRow[] => rows.filter((row) => model.selected.has(row.id));

  const drawBulkBar = (): void => {
    bulkBar.textContent = '';
    const savedShown = shown.filter((row) => row.kind === 'saved');
    const savedTotal = rows.filter((row) => row.kind === 'saved');

    bulkBar.append(
      ctx.components.button({
        label: ctx.t('appearance.preset.selectAllShown', 'Select the {count} shown', {
          values: { count: savedShown.length }
        }),
        variant: 'text',
        onClick: () => {
          for (const row of savedShown) model.selected.add(row.id);
          draw();
        }
      }),
      ctx.components.button({
        label: ctx.t('appearance.preset.selectAllEverything', 'Select all {count}', {
          values: { count: savedTotal.length }
        }),
        variant: 'text',
        onClick: () => {
          for (const row of savedTotal) model.selected.add(row.id);
          draw();
        }
      }),
      ctx.components.button({
        label: 'appearance.preset.invertSelection',
        variant: 'text',
        onClick: () => {
          for (const row of savedTotal) {
            if (model.selected.has(row.id)) model.selected.delete(row.id);
            else model.selected.add(row.id);
          }
          draw();
        }
      }),
      ctx.components.button({
        label: 'appearance.preset.clearSelection',
        variant: 'text',
        disabled: model.selected.size === 0,
        disabledReason: ctx.t('appearance.preset.nothingSelected', 'Nothing is selected.'),
        onClick: () => {
          model.selected.clear();
          draw();
        }
      })
    );

    const deleteButton = ctx.components.button({
      label: 'appearance.preset.bulkDelete',
      variant: 'outlined',
      icon: 'trash',
      danger: true,
      disabled: model.selected.size === 0,
      disabledReason: ctx.t('appearance.preset.nothingSelected', 'Nothing is selected.'),
      onClick: () => void removePresets(selectedRows(), deleteButton)
    });

    const exportButton = ctx.components.button({
      label: 'appearance.preset.bulkExport',
      variant: 'outlined',
      icon: 'download',
      disabled: model.selected.size === 0,
      disabledReason: ctx.t('appearance.preset.nothingSelected', 'Nothing is selected.'),
      onClick: () => void exportPresets(selectedRows())
    });

    const renameButton = ctx.components.button({
      label: 'appearance.preset.bulkRename',
      variant: 'outlined',
      icon: 'edit',
      disabled: model.selected.size === 0,
      disabledReason: ctx.t('appearance.preset.nothingSelected', 'Nothing is selected.'),
      onClick: () => void renameMany(selectedRows(), renameButton)
    });

    const applyBlocked = ctx.components.button({
      label: 'appearance.preset.apply',
      variant: 'text',
      disabled: true,
      disabledReason: ctx.t(
        'appearance.preset.bulkApplyBlocked',
        'Apply works on one preset at a time, because only one appearance can be in effect.'
      )
    });

    bulkBar.append(deleteButton, exportButton, renameButton, applyBlocked);
  };

  const applyOne = async (row: PresetRow): Promise<void> => {
    const outcome = await applyPresetById(ctx, row.id, row.name);
    if (!outcome.ok) {
      ctx.notify.error(ctx.t('appearance.preset.apply', 'Apply'), outcome.error ?? '');
      return;
    }
    const message =
      outcome.changed.length > 0
        ? ctx.t('appearance.preset.applied', 'Applied the "{name}" preset. It changed {count} value(s).', {
            values: { name: row.name, count: outcome.changed.length }
          })
        : ctx.t('appearance.preset.appliedNothing', 'The "{name}" preset was already the current appearance. Nothing changed.', {
            values: { name: row.name }
          });
    ctx.notify.show({
      title: message,
      body: outcome.changed.join('\n'),
      severity: 'success',
      source: 'appearance',
      actions:
        outcome.changed.length > 0
          ? [
              {
                label: 'appearance.preset.undo',
                run: async () => {
                  const result = await undoLastApply(ctx);
                  if (result.ok) draw();
                }
              }
            ]
          : []
    });
    ctx.a11y.announce(message);
    draw();
  };

  const renameOne = async (row: PresetRow, anchor: HTMLElement): Promise<void> => {
    const field = ctx.components.textField({ label: 'appearance.preset.saveName', value: row.name });
    const confirmed = await ctx.components.dialog({
      title: ctx.t('appearance.preset.rename', 'Rename'),
      body: field.root,
      confirmLabel: ctx.t('appearance.preset.rename', 'Rename')
    });
    if (!confirmed) {
      anchor.focus();
      return;
    }
    const result = await renamePreset(ctx, row.id, field.get());
    if (!result.ok) ctx.notify.warn(ctx.t('appearance.preset.rename', 'Rename'), result.error ?? '');
    draw();
    anchor.focus();
  };

  const renameMany = async (selected: PresetRow[], anchor: HTMLElement): Promise<void> => {
    const savedOnly = selected.filter((row) => row.kind === 'saved');
    if (savedOnly.length === 0) return;
    const field = ctx.components.textField({
      label: 'appearance.preset.bulkPattern',
      value: '{name}',
      supportingText: ctx.t('appearance.preset.bulkPattern', 'Name pattern, where {name} is the old name')
    });
    const preview = el('div');
    const drawPreview = (): void => {
      preview.textContent = '';
      preview.append(
        el('p', {
          className: 'md-typescale-body-small',
          text: ctx.t('appearance.preset.previewBulk', '{count} preset(s) will be affected: {names}', {
            values: {
              count: savedOnly.length,
              names: savedOnly.map((row) => `${row.name} → ${field.get().replace(/\{name\}/g, row.name)}`).join(', ')
            }
          })
        })
      );
    };
    drawPreview();
    field.root.addEventListener('input', drawPreview);
    const body = el('div');
    body.append(field.root, preview);

    const confirmed = await ctx.components.dialog({
      title: ctx.t('appearance.preset.bulkRename', 'Rename the selected by pattern'),
      body,
      confirmLabel: ctx.t('appearance.preset.rename', 'Rename')
    });
    if (!confirmed) {
      anchor.focus();
      return;
    }
    const failures: string[] = [];
    for (const row of savedOnly) {
      const next = field.get().replace(/\{name\}/g, row.name);
      const result = await renamePreset(ctx, row.id, next);
      if (!result.ok) failures.push(`${row.name}: ${result.error ?? 'refused'}`);
    }
    if (failures.length > 0) {
      ctx.notify.warn(ctx.t('appearance.preset.bulkRename', 'Rename the selected by pattern'), failures.join('; '));
    } else {
      ctx.notify.success(ctx.t('appearance.preset.bulkRename', 'Rename the selected by pattern'));
    }
    draw();
    anchor.focus();
  };

  const removePresets = async (selected: PresetRow[], anchor: HTMLElement): Promise<void> => {
    const savedOnly = selected.filter((row) => row.kind === 'saved');
    if (savedOnly.length === 0) {
      ctx.notify.warn(
        ctx.t('appearance.preset.delete', 'Delete'),
        ctx.t(
          'appearance.preset.bulkOnlySaved',
          'Only presets you saved can be renamed or deleted. Application presets are part of the build.'
        )
      );
      return;
    }
    const approved = await ctx.confirm.request({
      action: ctx.t('appearance.preset.bulkDelete', 'Delete the selected presets'),
      affected: savedOnly.map((row) => row.name),
      irreversible:
        'The saved copies are removed from the settings file. Any file you already exported is untouched, and the deletion is recorded in local history.',
      anchor
    });
    if (!approved) {
      anchor.focus();
      return;
    }
    const outcome = await deletePresets(
      ctx,
      savedOnly.map((row) => row.id)
    );
    model.selected.clear();
    ctx.notify.success(
      ctx.t('appearance.preset.bulkDelete', 'Delete the selected presets'),
      `${outcome.removed.length} removed${outcome.refused.length > 0 ? `, ${outcome.refused.length} refused` : ''}`
    );
    draw();
    anchor.focus();
  };

  const exportPresets = async (selected: PresetRow[]): Promise<void> => {
    const savedOnly = selected.filter((row) => row.kind === 'saved' && row.document);
    if (savedOnly.length === 0) {
      ctx.notify.warn(
        ctx.t('appearance.preset.bulkExport', 'Export the selected presets'),
        ctx.t(
          'appearance.preset.bulkOnlySaved',
          'Only presets you saved can be renamed or deleted. Application presets are part of the build.'
        )
      );
      return;
    }
    const text = exportText(ctx, ctx.settings.get<boolean>(SETTING_INCLUDE_OVERRIDES, true) !== false, savedOnly);
    await writeTextFile(ctx, text, 'appearance-presets.json');
  };

  /* ---- saving the current appearance ---- */

  const saveHost = el('div', { className: 'appearance-save', attrs: { id: 'appearance-save-preset' } });
  const nameField = ctx.components.textField({ label: 'appearance.preset.saveName', value: '' });
  const noteField = ctx.components.textField({ label: 'appearance.preset.saveNote', value: '' });
  const saveButton = ctx.components.button({
    label: 'appearance.preset.save',
    variant: 'filled',
    icon: 'save',
    onClick: () => {
      void (async () => {
        const includeOverrides = ctx.settings.get<boolean>(SETTING_INCLUDE_OVERRIDES, true) !== false;
        const result = await savePreset(ctx, nameField.get(), noteField.get(), includeOverrides);
        if (!result.ok) {
          ctx.notify.warn(ctx.t('appearance.preset.save', 'Save the current appearance as a preset'), result.error ?? '');
          return;
        }
        ctx.notify.success(
          ctx.t('appearance.preset.saved', 'Saved "{name}". It carries {theme} theme value(s) and {overrides} element override(s).', {
            values: {
              name: nameField.get().trim(),
              theme: result.themeCount ?? 0,
              overrides: result.overrideCount ?? 0
            }
          })
        );
        nameField.set('');
        noteField.set('');
        draw();
      })();
    }
  });
  saveHost.append(nameField.root, noteField.root, saveButton);

  const search = ctx.createSearchBar({
    label: 'appearance.preset.search',
    sample: 'Compact\nHigh contrast\nForest',
    onChange: () => draw()
  });

  /* ---- the preset list itself, in every format that can carry it ---- */

  const listExport = el('div', { className: 'appearance-transfer' });
  const listFormat = ctx.components.select({
    label: 'appearance.transfer.format',
    value: 'json',
    options: ctx.exporter.formats().map((format) => ({ value: format, label: format.toUpperCase() })),
    onChange: () => refreshListLosses()
  });
  const listLosses = el('p', { className: 'md-typescale-body-small', attrs: { role: 'status' } });

  const presetRecords = (): Array<Record<string, unknown>> => {
    const source = model.selected.size > 0 ? rows.filter((row) => model.selected.has(row.id)) : shown;
    return source.map((row) => ({
      name: row.name,
      kind: row.kind,
      note: row.note,
      createdAt: row.createdAt ?? '',
      themeValues: row.document ? Object.keys(row.document.theme).length : 0,
      elementOverrides: countOverrides(row.document?.overrides),
      lastObservedChanges: (row.observed ?? []).join('; ')
    }));
  };

  const refreshListLosses = (): void => {
    const preflight = ctx.exporter.preflight(presetRecords(), listFormat.get() as ExportFormat);
    listLosses.textContent =
      preflight.losses.length === 0
        ? ctx.t('appearance.transfer.noLosses', 'This format carries every field faithfully.')
        : ctx.t('appearance.transfer.losses', 'This format cannot carry: {fields}. Choose another format if that matters.', {
            values: { fields: preflight.losses.map((loss) => `${loss.field} (${loss.reason})`).join(', ') }
          });
  };

  const listExportButton = ctx.components.button({
    label: 'appearance.preset.exportList',
    variant: 'outlined',
    icon: 'download',
    onClick: () => {
      const records = presetRecords();
      void ctx.exporter
        .save(records, listFormat.get() as ExportFormat, { name: 'appearance-presets', schemaVersion: '1' })
        .then((path) => {
          if (path) ctx.notify.success(ctx.t('appearance.transfer.saved', 'Written to {path}', { values: { path } }));
        })
        .catch((error: unknown) => {
          ctx.notify.error(
            ctx.t('appearance.error.writeFailed', 'That file could not be written: {reason}', {
              values: { reason: error instanceof Error ? error.message : String(error) }
            })
          );
        });
    }
  });

  listExport.append(
    listFormat.root,
    listLosses,
    listExportButton,
    el('p', {
      className: 'md-typescale-body-small',
      text: ctx.t(
        'appearance.preset.exportListNote',
        'This writes the preset list as a table. To write a preset you can import again, use "Export to a file" on the preset itself.'
      )
    })
  );
  refreshListLosses();

  // Ctrl+A selects every saved preset currently shown, which is the honest
  // scope for a keyboard select-all on a filtered list.
  listHost.addEventListener('keydown', (event) => {
    if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'a') return;
    event.preventDefault();
    for (const row of shown.filter((candidate) => candidate.kind === 'saved')) model.selected.add(row.id);
    draw();
    ctx.a11y.announce(
      ctx.t('appearance.preset.selection', '{selected} of {shown} shown selected, out of {total} in total.', {
        values: { selected: model.selected.size, shown: shown.length, total: rows.length }
      })
    );
  });

  section.append(saveHost, search.root, summary, bulkBar, listExport, undoHost, emptyHost, listHost);
  ctx.onDispose(() => search.destroy());
  draw();

  return section;
}

/* ------------------------------------------------------------------ */
/* Elements                                                            */
/* ------------------------------------------------------------------ */

function buildElementSection(ctx: TabContext): HTMLElement {
  const section = el('div', { className: 'appearance-section', attrs: { id: 'appearance-elements' } });
  section.append(
    heading(ctx, 'appearance.section.elements'),
    el('p', {
      className: 'md-typescale-body-medium',
      text: ctx.t(
        'appearance.elements.note',
        'Each sample below is a real control built from the same component kit as the rest of the window, and the editor it opens writes to the real selector named beside it — so an edit here reaches the application chrome, not a copy of it.'
      )
    })
  );

  const model: SelectionModel = { selected: new Set(), anchorIndex: null };
  const modifiers = { shift: false };
  let shown: ElementCategory[] = [];

  const summary = el('p', { className: 'md-typescale-body-small', attrs: { role: 'status' } });
  const bulkBar = el('div', {
    className: 'appearance-bulkbar',
    attrs: { role: 'group', 'data-appearance-id': 'appearance:bulkbar' }
  });
  const listHost = el('div', { className: 'appearance-elements' });

  const overridesFor = (selector: string): number => ctx.appearance.overridesFor(selector).length;

  const draw = (): void => {
    const query = search.query();
    shown = ELEMENT_CATEGORIES.filter((category) =>
      query.matches(
        `${ctx.t(category.label, category.fallback)} ${category.fallback} ${category.selector} ${category.keywords.join(' ')}`
      )
    );

    listHost.textContent = '';
    const ids = shown.map((category) => category.id);

    for (const [index, category] of shown.entries()) {
      const card = el('div', {
        className: 'appearance-element',
        attrs: {
          id: `appearance-element-${category.id}`,
          'aria-selected': String(model.selected.has(category.id)),
          'data-appearance-id': 'appearance:element-card'
        }
      });
      card.addEventListener('pointerdown', (event) => {
        modifiers.shift = event.shiftKey;
      });
      card.addEventListener(
        'keydown',
        (event) => {
          modifiers.shift = event.shiftKey;
        },
        true
      );

      const box = ctx.components.checkbox({
        label: ctx.t(category.label, category.fallback),
        checked: model.selected.has(category.id),
        onChange: (checked) => {
          if (modifiers.shift) extendRange(model, ids, index, checked);
          else if (checked) model.selected.add(category.id);
          else model.selected.delete(category.id);
          modifiers.shift = false;
          model.anchorIndex = index;
          draw();
        }
      });

      const head = el('div', { className: 'appearance-element__head' });
      const titles = el('div');
      titles.append(el('span', { className: 'md-typescale-title-small', text: ctx.t(category.label, category.fallback) }));
      titles.append(el('code', { className: 'appearance-element__selector', text: category.selector }));
      head.append(box.root, ctx.components.icon(category.icon), titles);

      const count = overridesFor(category.selector);
      const countLine = el('p', {
        className: 'md-typescale-body-small',
        text:
          count === 0
            ? ctx.t('appearance.elements.none', 'No overrides on {selector}', {
                values: { selector: category.selector }
              })
            : ctx.t('appearance.elements.overrideCount', '{count} override(s) on {selector}', {
                values: { count, selector: category.selector }
              })
      });

      const sampleHost = el('div', {
        className: 'appearance-sample',
        attrs: { 'data-appearance-id': 'appearance:sample' }
      });
      try {
        sampleHost.append(category.build(ctx, sampleText(ctx)));
      } catch (error) {
        // A sample that cannot be built says so rather than leaving a gap that
        // reads as a missing feature.
        const message = error instanceof Error ? error.message : String(error);
        sampleHost.append(
          el('p', {
            className: 'md-typescale-body-small',
            text: ctx.t('appearance.elements.sampleFailed', 'This sample could not be built: {reason}', {
              values: { reason: message }
            })
          })
        );
      }

      const actions = el('div', { className: 'appearance-element__actions' });
      const editButton = ctx.components.button({
        label: 'appearance.elements.edit',
        variant: 'tonal',
        icon: 'palette',
        onClick: () => ctx.appearance.edit(sampleHost, category.selector)
      });
      const resetButton = ctx.components.button({
        label: 'appearance.elements.reset',
        variant: 'text',
        icon: 'refresh',
        disabled: count === 0,
        disabledReason: ctx.t('appearance.elements.none', 'No overrides on {selector}', {
          values: { selector: category.selector }
        }),
        onClick: () => {
          ctx.appearance.resetSelector(category.selector);
          ctx.notify.success(
            ctx.t('appearance.elements.reset', 'Reset this element'),
            `${ctx.t(category.label, category.fallback)} — ${category.selector}`
          );
          draw();
        }
      });
      const lockButton = ctx.components.button({
        label: 'appearance.elements.lock',
        variant: 'text',
        icon: 'lock',
        onClick: () => ctx.locks.wizard(lockButton, `appearance:${category.selector}`, ctx.t(category.label, category.fallback))
      });
      actions.append(editButton, resetButton, lockButton);

      card.append(head, countLine, sampleHost, actions);
      listHost.append(card);
    }

    summary.textContent = ctx.t('appearance.preset.selection', '{selected} of {shown} shown selected, out of {total} in total.', {
      values: { selected: model.selected.size, shown: shown.length, total: ELEMENT_CATEGORIES.length }
    });
    drawBulkBar();
  };

  const drawBulkBar = (): void => {
    bulkBar.textContent = '';
    bulkBar.append(
      ctx.components.button({
        label: ctx.t('appearance.preset.selectAllShown', 'Select the {count} shown', { values: { count: shown.length } }),
        variant: 'text',
        onClick: () => {
          for (const category of shown) model.selected.add(category.id);
          draw();
        }
      }),
      ctx.components.button({
        label: ctx.t('appearance.preset.selectAllEverything', 'Select all {count}', {
          values: { count: ELEMENT_CATEGORIES.length }
        }),
        variant: 'text',
        onClick: () => {
          for (const category of ELEMENT_CATEGORIES) model.selected.add(category.id);
          draw();
        }
      }),
      ctx.components.button({
        label: 'appearance.preset.invertSelection',
        variant: 'text',
        onClick: () => {
          for (const category of ELEMENT_CATEGORIES) {
            if (model.selected.has(category.id)) model.selected.delete(category.id);
            else model.selected.add(category.id);
          }
          draw();
        }
      }),
      ctx.components.button({
        label: 'appearance.preset.clearSelection',
        variant: 'text',
        disabled: model.selected.size === 0,
        disabledReason: ctx.t('appearance.preset.nothingSelected', 'Nothing is selected.'),
        onClick: () => {
          model.selected.clear();
          draw();
        }
      })
    );

    const selected = ELEMENT_CATEGORIES.filter((category) => model.selected.has(category.id));
    const withOverrides = selected.filter((category) => ctx.appearance.overridesFor(category.selector).length > 0);

    const resetButton = ctx.components.button({
      label: 'appearance.elements.bulkReset',
      variant: 'outlined',
      icon: 'refresh',
      danger: true,
      disabled: withOverrides.length === 0,
      disabledReason:
        model.selected.size === 0
          ? ctx.t('appearance.preset.nothingSelected', 'Nothing is selected.')
          : ctx.t('appearance.elements.selectedHaveNoOverrides', 'None of the selected elements has an override to reset.'),
      onClick: () => {
        void (async () => {
          const approved = await ctx.confirm.request({
            action: ctx.t('appearance.elements.bulkReset', 'Reset the selected elements'),
            affected: withOverrides.map(
              (category) =>
                `${ctx.t(category.label, category.fallback)} (${category.selector}) — ${ctx.appearance.overridesFor(category.selector).length} override(s)`
            ),
            irreversible:
              'Those overrides are removed from the appearance file. The reset is recorded in local history, and an exported appearance file you already have still contains them.',
            anchor: resetButton
          });
          if (!approved) return;
          for (const category of withOverrides) ctx.appearance.resetSelector(category.selector);
          await ctx.history.record('Reset element appearance in bulk', 'appearance', {
            selectors: withOverrides.map((category) => category.selector)
          });
          ctx.notify.success(
            ctx.t('appearance.elements.bulkReset', 'Reset the selected elements'),
            `${withOverrides.length} element(s)`
          );
          draw();
        })();
      }
    });

    const exportButton = ctx.components.button({
      label: 'appearance.elements.bulkExport',
      variant: 'outlined',
      icon: 'download',
      disabled: withOverrides.length === 0,
      disabledReason:
        model.selected.size === 0
          ? ctx.t('appearance.preset.nothingSelected', 'Nothing is selected.')
          : ctx.t('appearance.elements.selectedHaveNoOverrides', 'None of the selected elements has an override to reset.'),
      onClick: () => {
        const records: Array<Record<string, unknown>> = [];
        for (const category of withOverrides) {
          for (const override of ctx.appearance.overridesFor(category.selector)) {
            records.push({
              category: ctx.t(category.label, category.fallback),
              selector: category.selector,
              property: override.property,
              value: override.value
            });
          }
        }
        void ctx.exporter
          .save(records, 'json', { name: 'appearance-overrides', schemaVersion: '1', defaultFileName: 'appearance-overrides.json' })
          .then((path) => {
            if (path) ctx.notify.success(ctx.t('appearance.transfer.saved', 'Written to {path}', { values: { path } }));
          })
          .catch((error: unknown) => {
            ctx.notify.error(
              ctx.t('appearance.error.writeFailed', 'That file could not be written: {reason}', {
                values: { reason: error instanceof Error ? error.message : String(error) }
              })
            );
          });
      }
    });

    bulkBar.append(resetButton, exportButton);
  };

  const search = ctx.createSearchBar({
    label: 'appearance.elements.search',
    sample: ELEMENT_CATEGORIES.map((category) => `${category.label} ${category.selector}`).join('\n'),
    onChange: () => draw()
  });

  listHost.addEventListener('keydown', (event) => {
    if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'a') return;
    event.preventDefault();
    for (const category of shown) model.selected.add(category.id);
    draw();
  });

  section.append(search.root, summary, bulkBar, listHost);

  // An override written from the editor changes the counts on this page, so the
  // page follows the store rather than showing a number from when it was built.
  const stopSettings = ctx.settings.onChange((change) => {
    if (change.id === 'appearance.overrides') draw();
  });
  ctx.onDispose(() => {
    stopSettings();
    search.destroy();
  });

  draw();
  return section;
}

/* ------------------------------------------------------------------ */
/* Export and import                                                   */
/* ------------------------------------------------------------------ */

async function writeTextFile(ctx: AppContext, text: string, defaultName: string): Promise<string | null> {
  const chosen = await ctx.studio.dialog.saveFile({
    defaultPath: defaultName,
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  if (!chosen.ok || !chosen.value) return null;
  const written = await ctx.studio.fs.writeText(chosen.value, text);
  if (!written.ok) {
    ctx.notify.error(
      ctx.t('appearance.error.writeFailed', 'That file could not be written: {reason}', {
        values: { reason: written.error }
      })
    );
    return null;
  }
  const path = chosen.value;
  ctx.notify.show({
    title: ctx.t('appearance.transfer.saved', 'Written to {path}', { values: { path } }),
    severity: 'success',
    source: 'appearance',
    actions: [
      {
        label: 'appearance.transfer.openInEditor',
        run: async () => {
          const opened = await ctx.studio.editor.open(path);
          if (!opened.ok) {
            ctx.notify.warn(ctx.t('appearance.transfer.openInEditor', 'Open it in the external editor'), opened.error);
          }
        }
      }
    ]
  });
  return path;
}

function buildTransferSection(ctx: TabContext): HTMLElement {
  const section = el('div', { className: 'appearance-section', attrs: { id: 'appearance-transfer' } });
  section.append(heading(ctx, 'appearance.section.transfer'));

  /* ---- the canonical appearance file ---- */

  const exportHost = el('div', { className: 'appearance-transfer', attrs: { id: 'appearance-export' } });
  const exportSummary = el('p', { className: 'md-typescale-body-small', attrs: { role: 'status' } });
  const includeOverridesControl = ctx.components.switchControl({
    label: 'appearance.setting.includeOverrides',
    checked: ctx.settings.get<boolean>(SETTING_INCLUDE_OVERRIDES, true) !== false,
    onChange: (checked) => {
      ctx.settings.set(SETTING_INCLUDE_OVERRIDES, checked);
      refreshExportSummary();
    }
  });
  const includePresetsControl = ctx.components.checkbox({
    label: 'appearance.transfer.includePresets',
    checked: false
  });
  const refreshExportSummary = (): void => {
    const document_ = currentDocument(ctx);
    exportSummary.textContent = ctx.t(
      'appearance.transfer.exportSummary',
      'The file will carry {theme} theme value(s) and {overrides} element override(s).',
      {
        values: {
          theme: Object.keys(document_.theme).length,
          overrides: includeOverridesControl.get() ? countOverrides(document_.overrides) : 0
        }
      }
    );
  };
  refreshExportSummary();

  const exportButton = ctx.components.button({
    label: 'appearance.transfer.exportTheme',
    variant: 'filled',
    icon: 'download',
    onClick: () => {
      const presets = includePresetsControl.get() ? presetRows(ctx) : [];
      const text = exportText(ctx, includeOverridesControl.get(), presets);
      void writeTextFile(ctx, text, 'appearance.json').then((path) => {
        if (path) void ctx.history.record('Exported the appearance', 'appearance', { path });
      });
    }
  });

  exportHost.append(
    includeOverridesControl.root,
    includePresetsControl.root,
    exportSummary,
    exportButton
  );
  section.append(
    controlBlock(ctx, {
      label: 'appearance.transfer.exportTheme',
      description: 'appearance.setting.includeOverrides.description',
      control: exportHost
    })
  );

  /* ---- import ---- */

  const importHost = el('div', { className: 'appearance-transfer', attrs: { id: 'appearance-import' } });
  const modeControl = ctx.components.select({
    label: 'appearance.transfer.importMode',
    value: ctx.settings.get<string>(SETTING_IMPORT_MODE, 'replace'),
    options: [
      { value: 'replace', label: 'appearance.transfer.importMode.replace' },
      { value: 'merge', label: 'appearance.transfer.importMode.merge' }
    ],
    onChange: (value) => ctx.settings.set(SETTING_IMPORT_MODE, value)
  });

  const importButton = ctx.components.button({
    label: 'appearance.transfer.importTheme',
    variant: 'filled',
    icon: 'upload',
    onClick: () => {
      void (async () => {
        const chosen = await ctx.studio.dialog.openFile({ filters: [{ name: 'JSON', extensions: ['json'] }] });
        if (!chosen.ok || !chosen.value || !chosen.value[0]) return;
        const path = chosen.value[0];
        const read = await ctx.studio.fs.readText(path, 2 * 1024 * 1024);
        if (!read.ok) {
          ctx.notify.error(
            ctx.t('appearance.error.readFailed', 'That file could not be read: {reason}', {
              values: { reason: read.error }
            })
          );
          return;
        }

        // The file is validated BEFORE anything is written, so the decision the
        // user is asked to make is a decision about a known quantity.
        const validated = validateDocument(read.value, ctx);
        if (!validated.ok || !validated.document) {
          ctx.notify.error(
            ctx.t('appearance.transfer.rejected', 'That file was refused and nothing was changed. {reason}', {
              values: { reason: validated.error ?? '' }
            })
          );
          return;
        }

        const body = el('div');
        body.append(
          el('p', {
            className: 'md-typescale-body-medium',
            text: ctx.t(
              'appearance.transfer.importPreview',
              '{theme} theme value(s), {overrides} element override(s) and {presets} preset(s) will be applied from {path}.',
              {
                values: {
                  theme: Object.keys(validated.document.theme).length,
                  overrides: countOverrides(validated.document.overrides),
                  presets: validated.presets.length,
                  path
                }
              }
            )
          })
        );
        if (validated.kept.length > 0) {
          body.append(
            el('p', {
              className: 'md-typescale-body-medium',
              text: ctx.t(
                'appearance.transfer.unapplied',
                '{count} entry from that file could not be applied by this version. It has been kept exactly as written and is listed below; nothing was discarded.',
                { values: { count: validated.kept.length } }
              )
            })
          );
        }

        const confirmed = await ctx.components.dialog({
          title: ctx.t('appearance.transfer.importTheme', 'Import an appearance file'),
          body,
          confirmLabel: ctx.t('appearance.transfer.importTheme', 'Import an appearance file')
        });
        if (!confirmed) return;

        const mode = modeControl.get() === 'merge' ? 'merge' : 'replace';
        const outcome = await importDocument(ctx, read.value, mode, path);
        if (!outcome.ok) {
          ctx.notify.error(
            ctx.t('appearance.transfer.rejected', 'That file was refused and nothing was changed. {reason}', {
              values: { reason: outcome.error ?? '' }
            })
          );
          return;
        }

        ctx.notify.success(
          ctx.t('appearance.transfer.imported', 'Imported {theme} theme value(s) and {overrides} element override(s) from {path}.', {
            values: { theme: outcome.themeCount, overrides: outcome.overrideCount, path }
          }),
          outcome.addedPresets.length > 0 ? outcome.addedPresets.join(', ') : undefined
        );

        // A typeface the file asked for that this machine does not have is
        // stated plainly, and the user's value is kept rather than reset.
        if (outcome.fontFamily) {
          const families = await ctx.theme.availableFonts();
          if (!families.includes(outcome.fontFamily)) {
            ctx.notify.warn(
              ctx.t('appearance.type.family', 'Interface typeface'),
              ctx.t(
                'appearance.type.notInstalled',
                '"{family}" is not installed on this computer. Your choice is kept; the bundled stack renders in its place.',
                { values: { family: outcome.fontFamily } }
              )
            );
          }
        }

        if (outcome.kept.length > 0) {
          ctx.notify.warn(
            ctx.t('appearance.transfer.unappliedTitle', 'Kept but not applied'),
            ctx.t(
              'appearance.transfer.unapplied',
              '{count} entry from that file could not be applied by this version. It has been kept exactly as written and is listed below; nothing was discarded.',
              { values: { count: outcome.kept.length } }
            )
          );
        }
        drawKept();
      })();
    }
  });

  importHost.append(modeControl.root, importButton);
  section.append(
    controlBlock(ctx, {
      label: 'appearance.transfer.importTheme',
      description: 'appearance.setting.importMode.description',
      control: importHost,
      settingId: SETTING_IMPORT_MODE,
      defaultValue: 'replace'
    })
  );

  /* ---- the override table, in every format that can carry it ---- */

  const tableHost = el('div', { className: 'appearance-transfer' });
  const formatControl = ctx.components.select({
    label: 'appearance.transfer.format',
    value: 'json',
    options: ctx.exporter.formats().map((format) => ({ value: format, label: format.toUpperCase() })),
    onChange: () => refreshLosses()
  });
  const lossLine = el('p', { className: 'md-typescale-body-small', attrs: { role: 'status' } });
  const refreshLosses = (): void => {
    const format = formatControl.get() as ExportFormat;
    const preflight = ctx.exporter.preflight(overrideRecords(ctx), format);
    lossLine.textContent =
      preflight.losses.length === 0
        ? ctx.t('appearance.transfer.noLosses', 'This format carries every field faithfully.')
        : ctx.t('appearance.transfer.losses', 'This format cannot carry: {fields}. Choose another format if that matters.', {
            values: { fields: preflight.losses.map((loss) => `${loss.field} (${loss.reason})`).join(', ') }
          });
  };
  refreshLosses();

  const tableExport = ctx.components.button({
    label: 'appearance.transfer.exportOverrides',
    variant: 'outlined',
    icon: 'download',
    onClick: () => {
      const format = formatControl.get() as ExportFormat;
      void ctx.exporter
        .save(overrideRecords(ctx), format, { name: 'appearance-overrides', schemaVersion: '1' })
        .then((path) => {
          if (path) ctx.notify.success(ctx.t('appearance.transfer.saved', 'Written to {path}', { values: { path } }));
        })
        .catch((error: unknown) => {
          ctx.notify.error(
            ctx.t('appearance.error.writeFailed', 'That file could not be written: {reason}', {
              values: { reason: error instanceof Error ? error.message : String(error) }
            })
          );
        });
    }
  });

  tableHost.append(formatControl.root, lossLine, tableExport);
  section.append(
    controlBlock(ctx, {
      label: 'appearance.transfer.exportOverrides',
      description: 'appearance.transfer.exportOverrides.description',
      control: tableHost
    })
  );

  /* ---- entries kept from an import ---- */

  const keptHost = el('div', { className: 'appearance-kept', attrs: { id: 'appearance-kept' } });

  const drawKept = (): void => {
    keptHost.textContent = '';
    const entries: KeptEntry[] = keptEntries(ctx);
    keptHost.append(
      el('h3', {
        className: 'md-typescale-title-small',
        text: ctx.t('appearance.transfer.unappliedTitle', 'Kept but not applied')
      })
    );
    if (entries.length === 0) {
      keptHost.append(
        ctx.components.emptyState({
          title: 'appearance.transfer.unappliedEmpty',
          body: 'appearance.transfer.unappliedEmptyBody'
        })
      );
      return;
    }

    const keyOf = (entry: KeptEntry): string => `${entry.path}@${entry.keptAt}`;
    let selection: string[] = [];

    const scopeLabel = (): string =>
      selection.length > 0
        ? ctx.t('appearance.transfer.keptScopeSelected', 'the {count} selected entries', {
            values: { count: selection.length }
          })
        : ctx.t('appearance.transfer.keptScopeAll', 'all {count} entries', { values: { count: entries.length } });

    const scoped = (): KeptEntry[] =>
      selection.length > 0 ? entries.filter((entry) => selection.includes(keyOf(entry))) : entries;

    const table = ctx.components.dataTable<KeptEntry>({
      label: ctx.t('appearance.transfer.unappliedTitle', 'Kept but not applied'),
      columns: [
        { id: 'path', label: 'appearance.transfer.keptPath', sortable: true, value: (row) => row.path },
        { id: 'value', label: 'appearance.transfer.keptValue', value: (row) => row.value },
        { id: 'reason', label: 'appearance.transfer.keptReason', value: (row) => row.reason },
        { id: 'keptAt', label: 'appearance.transfer.keptWhen', sortable: true, value: (row) => row.keptAt }
      ],
      rows: entries,
      rowId: keyOf,
      selectable: true,
      onSelectionChange: (ids) => {
        selection = ids;
        redrawActions();
      }
    });

    const actions = el('div', { className: 'appearance-bulkbar' });

    const redrawActions = (): void => {
      actions.textContent = '';

      const scopeLine = el('span', {
        className: 'md-typescale-body-small',
        attrs: { role: 'status' },
        text: ctx.t('appearance.transfer.keptScope', 'Actions below apply to {scope}.', {
          values: { scope: scopeLabel() }
        })
      });

      const invert = ctx.components.button({
        label: 'appearance.preset.invertSelection',
        variant: 'text',
        onClick: () => {
          const inverted = entries.map(keyOf).filter((id) => !selection.includes(id));
          table.setSelection(inverted);
          selection = inverted;
          redrawActions();
        }
      });

      const clearSelection = ctx.components.button({
        label: 'appearance.preset.clearSelection',
        variant: 'text',
        disabled: selection.length === 0,
        disabledReason: ctx.t('appearance.preset.nothingSelected', 'Nothing is selected.'),
        onClick: () => {
          table.clearSelection();
          selection = [];
          redrawActions();
        }
      });

      const exportKept = ctx.components.button({
        label: 'appearance.transfer.unappliedExport',
        variant: 'outlined',
        icon: 'download',
        onClick: () => {
          void ctx.exporter
            .save(scoped() as unknown as Array<Record<string, unknown>>, 'json', {
              name: 'appearance-kept-entries',
              schemaVersion: '1',
              defaultFileName: 'appearance-kept-entries.json'
            })
            .then((path) => {
              if (path) ctx.notify.success(ctx.t('appearance.transfer.saved', 'Written to {path}', { values: { path } }));
            })
            .catch((error: unknown) => {
              ctx.notify.error(
                ctx.t('appearance.error.writeFailed', 'That file could not be written: {reason}', {
                  values: { reason: error instanceof Error ? error.message : String(error) }
                })
              );
            });
        }
      });

      const clearKept = ctx.components.button({
        label: 'appearance.transfer.unappliedClear',
        variant: 'text',
        icon: 'trash',
        danger: true,
        onClick: () => {
          void (async () => {
            const going = scoped();
            const approved = await ctx.confirm.request({
              action: ctx.t('appearance.transfer.unappliedClear', 'Discard the kept entries'),
              affected: going.map((entry) => `${entry.path} = ${entry.value}`),
              irreversible:
                'These are the only copies this application holds of the parts of your file it could not apply. Export them first if you want them.',
              anchor: clearKept
            });
            if (!approved) return;
            const remaining = entries.filter((entry) => !going.includes(entry));
            storeKeptEntries(ctx, remaining);
            await ctx.history.record('Discarded kept import entries', 'appearance', { count: going.length });
            drawKept();
          })();
        }
      });

      actions.append(scopeLine, invert, clearSelection, exportKept, clearKept);
    };

    redrawActions();
    keptHost.append(actions, table.root);
  };

  drawKept();
  section.append(keptHost);

  return section;
}

/* ------------------------------------------------------------------ */
/* The destination itself                                              */
/* ------------------------------------------------------------------ */

export function mountAppearance(host: HTMLElement, ctx: TabContext): () => void {
  host.append(
    ctx.components.topAppBar({
      title: ctx.t('appearance.tab.title', 'Appearance'),
      subtitle: ctx.t('appearance.tab.subtitle', 'Theme, typography, presets and every rendered element.'),
      actions: [
        ctx.components.iconButton({
          icon: 'search',
          label: ctx.t('core.palette.title', 'Command palette'),
          onClick: () => ctx.palette.open()
        })
      ]
    })
  );

  const sections: Array<{ id: SectionId; label: string; icon: string; node: HTMLElement }> = [
    { id: 'theme', label: 'appearance.section.theme', icon: 'palette', node: buildThemeSection(ctx) },
    { id: 'typography', label: 'appearance.section.typography', icon: 'edit', node: buildTypographySection(ctx) },
    { id: 'presets', label: 'appearance.section.presets', icon: 'save', node: buildPresetSection(ctx) },
    { id: 'elements', label: 'appearance.section.elements', icon: 'tune', node: buildElementSection(ctx) },
    { id: 'transfer', label: 'appearance.section.transfer', icon: 'download', node: buildTransferSection(ctx) }
  ];

  let active: SectionId = 'theme';
  const show = (id: SectionId): void => {
    active = id;
    for (const section of sections) section.node.hidden = section.id !== id;
  };

  const bar = ctx.components.tabBar({
    tabs: sections.map((section) => ({ id: section.id, label: section.label, icon: section.icon })),
    active,
    onChange: (id) => show(id as SectionId)
  });

  // The strip and the panels are wired to each other properly: each button
  // names the panel it controls and each panel names the button that labels it,
  // so a screen reader reports the relationship rather than a row of unrelated
  // buttons above a slab of content.
  for (const section of sections) {
    const trigger = bar.querySelector<HTMLElement>(`[data-tab-id="${section.id}"]`);
    // The panel already carries the id the palette teleports to, so it is reused
    // here rather than replaced — renaming it would break every teleport target.
    const panelId = section.node.id;
    section.node.setAttribute('role', 'tabpanel');
    if (trigger) {
      const triggerId = `appearance-subtab-${section.id}`;
      trigger.id = triggerId;
      trigger.setAttribute('aria-controls', panelId);
      section.node.setAttribute('aria-labelledby', triggerId);
    }
  }

  const body = el('div', { className: 'appearance-body' });
  for (const section of sections) body.append(section.node);
  show(active);

  host.append(bar, body);

  reveal = (section, elementId) => {
    // Clicking the real trigger keeps the strip's own selected state in step,
    // rather than showing one panel while the strip highlights another.
    const trigger = bar.querySelector<HTMLElement>(`[data-tab-id="${section}"]`);
    if (trigger) trigger.click();
    else show(section);
    if (!elementId) return;
    window.requestAnimationFrame(() => {
      const target = document.getElementById(elementId);
      if (!target) return;
      target.scrollIntoView({ behavior: ctx.a11y.reducedMotion() ? 'auto' : 'smooth', block: 'center' });
      ctx.a11y.focusVisible(target);
      target.classList.add('md-teleport-highlight');
      window.setTimeout(() => target.classList.remove('md-teleport-highlight'), 2000);
    });
  };

  return () => {
    reveal = null;
    for (const section of sections) {
      for (const node of section.node.querySelectorAll('*')) node.dispatchEvent(new CustomEvent('md-dispose'));
    }
  };
}
