/**
 * The application logo tab.
 *
 * The surface is built so that the preview and the output can never disagree:
 * every preview square is drawn by `drawMark`, which is the same function that
 * produces the bytes finally written. A preview rendered by different code from
 * the result is the one kind of preview worth not shipping.
 *
 * The other shape worth knowing: the controls are created once and never
 * re-created, while the derived regions — the state card, the previews, the
 * loss report and the two tables — are redrawn whenever anything changes. That
 * split is what keeps a slider from losing focus half way through a drag while
 * still letting every readout follow the value live.
 */

import { el, nextId } from '../../core/a11y';
import { contrastRatio, parseColor } from '../../core/color';
import { openColorPicker } from '../../core/colorpicker';
import type { ExportFormat, TabContext } from '../../core/registry';
import { FULL_CROP, convert, describeLosses, drawMark, normalizeCrop, verifyVariant } from './conversion';
import type { CropRect, LogoVariant } from './conversion';
import { LIMITS, TARGET_SIZES, decodeBounded, formatBytes, inspectBytes } from './imageBytes';
import { DEFAULT_PRESET_ID, PRESETS, presetById } from './presets';
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
  activeMark,
  applyToChrome,
  buildMarkElement,
  getSessionSource,
  identityFacts,
  onSessionSourceChange,
  readChoices,
  readCrop,
  readCustomRecord,
  setSessionSource
} from './state';
import type { CustomLogoRecord } from './state';

const EXPORT_FORMATS: ExportFormat[] = [
  'json',
  'jsonl',
  'yaml',
  'toml',
  'xml',
  'csv',
  'tsv',
  'markdown',
  'html',
  'sql'
];

interface SourceRow {
  id: string;
  name: string;
  origin: string;
  detail: string;
  isCustom: boolean;
}

interface VariantRow {
  id: string;
  size: number;
  bytes: number;
  verified: boolean;
  detail: string;
}

/* ------------------------------------------------------------------ */
/* Entry point                                                         */
/* ------------------------------------------------------------------ */

export function mountLogoTab(host: HTMLElement, ctx: TabContext): void {
  const panel = el('div', { className: 'md-panel', attrs: { 'data-appearance-id': 'app-logo:panel' } });
  host.append(panel);

  panel.append(
    ctx.components.topAppBar({
      title: 'appLogo.tab',
      subtitle: 'appLogo.tab.subtitle',
      actions: [
        ctx.components.button({
          label: 'appLogo.tab',
          variant: 'text',
          icon: 'book',
          onClick: () => ctx.docsService.open('appLogo.overview')
        })
      ]
    })
  );

  /* ------------------------------------------------------------- */
  /* 1. The mark in use                                             */
  /* ------------------------------------------------------------- */

  const currentSection = el('section', {
    className: 'app-logo-section',
    attrs: { id: 'app-logo-current', 'data-appearance-id': 'app-logo:current' }
  });
  currentSection.append(ctx.components.sectionHeading({ title: 'appLogo.current.title' }));

  const currentCard = el('div', { className: 'app-logo-card' });
  const currentMarkHolder = el('div', { className: 'app-logo-preview__frame' });
  const currentText = el('div', { className: 'app-logo-card__text' });
  const currentState = el('p', {
    className: 'md-typescale-body-medium app-logo-status',
    attrs: { role: 'status' }
  });
  const currentChrome = el('p', { className: 'md-typescale-body-small app-logo-status' });
  currentText.append(currentState, currentChrome);
  currentCard.append(currentMarkHolder, currentText);
  currentSection.append(currentCard);

  const identity = el('dl', { className: 'app-logo-identity md-typescale-body-small' });
  currentSection.append(
    ctx.components.sectionHeading({ title: 'appLogo.identity.title', description: 'appLogo.identity.body' }),
    identity
  );
  panel.append(currentSection);

  /* ------------------------------------------------------------- */
  /* 2. Choose a mark                                               */
  /* ------------------------------------------------------------- */

  const sourcesSection = el('section', {
    className: 'app-logo-section',
    attrs: { id: 'app-logo-sources', 'data-appearance-id': 'app-logo:sources' }
  });
  sourcesSection.append(
    ctx.components.sectionHeading({ title: 'appLogo.sources.title', description: 'appLogo.sources.description' })
  );

  let sourceRows: SourceRow[] = [];
  let shownSourceRows: SourceRow[] = [];
  let sourceSelection: string[] = [];

  const sourceSummary = el('p', {
    className: 'md-typescale-body-small app-logo-status',
    attrs: { role: 'status' }
  });

  const sourceSearch = ctx.createSearchBar({
    label: 'appLogo.search',
    sample: PRESETS.map((preset) => ctx.t(preset.labelKey, preset.id)).join('\n'),
    onChange: () => redrawSources()
  });
  sourcesSection.append(sourceSearch.root);

  const sourceTable = ctx.components.dataTable<SourceRow>({
    label: 'appLogo.sources.title',
    selectable: true,
    rows: [],
    rowId: (row) => row.id,
    emptyMessage: 'core.search.noMatches',
    onSelectionChange: (ids) => {
      sourceSelection = ids;
      refreshSourceToolbar();
    },
    columns: [
      {
        id: 'preview',
        label: 'appLogo.column.preview',
        render: (row) => {
          const holder = el('span', { className: 'app-logo-cell-preview' });
          const preset = presetById(row.id);
          if (preset) {
            holder.append(preset.draw(28) as unknown as Node);
          } else {
            const record = readCustomRecord(ctx.settings);
            const variant = record ? pickVariant(record, 32) : null;
            if (variant) {
              const image = document.createElement('img');
              image.src = variant.dataUrl;
              image.width = 28;
              image.height = 28;
              image.alt = '';
              image.setAttribute('aria-hidden', 'true');
              holder.append(image);
            }
          }
          return holder;
        }
      },
      { id: 'name', label: 'appLogo.column.name', sortable: true, value: (row) => row.name },
      { id: 'origin', label: 'appLogo.column.kind', sortable: true, value: (row) => row.origin },
      { id: 'detail', label: 'appLogo.column.detail', value: (row) => row.detail }
    ]
  });

  const applyButton = ctx.components.button({
    label: 'appLogo.action.apply',
    variant: 'filled',
    icon: 'check',
    disabled: true,
    disabledReason: 'appLogo.action.apply.needOne',
    onClick: () => {
      if (sourceSelection.length !== 1) return;
      applySource(sourceSelection[0]);
    }
  });

  const selectShownButton = ctx.components.button({
    label: 'core.action.selectAll',
    variant: 'text',
    onClick: () => {
      sourceTable.setSelection(shownSourceRows.map((row) => row.id));
      sourceSelection = sourceTable.selection();
      refreshSourceToolbar();
      announceSourceSelection();
    }
  });

  const selectEverythingButton = ctx.components.button({
    label: 'core.action.selectAll',
    variant: 'text',
    onClick: () => {
      sourceTable.setSelection(sourceRows.map((row) => row.id));
      sourceSelection = sourceTable.selection();
      refreshSourceToolbar();
      announceSourceSelection();
    }
  });

  const invertButton = ctx.components.button({
    label: 'core.action.invertSelection',
    variant: 'text',
    onClick: () => {
      const chosen = new Set(sourceTable.selection());
      sourceTable.setSelection(sourceRows.filter((row) => !chosen.has(row.id)).map((row) => row.id));
      sourceSelection = sourceTable.selection();
      refreshSourceToolbar();
      announceSourceSelection();
    }
  });

  const sourceFormat = ctx.components.select({
    label: 'appLogo.export.format',
    options: EXPORT_FORMATS.map((format) => ({ value: format, label: format.toUpperCase() })),
    value: 'json'
  });

  const sourceExport = ctx.components.button({
    label: 'appLogo.export.action',
    variant: 'text',
    icon: 'download',
    onClick: () => void exportRows(sourceSelection, 'sources')
  });

  const removeCustom = ctx.components.button({
    label: 'appLogo.remove.action',
    variant: 'text',
    icon: 'trash',
    danger: true,
    onClick: (event) => void removeCustomMark(event.currentTarget as HTMLElement)
  });

  const sourceToolbar = el('div', { className: 'app-logo-row' });
  sourceToolbar.append(
    applyButton,
    selectShownButton,
    selectEverythingButton,
    invertButton,
    sourceFormat.root,
    sourceExport,
    removeCustom
  );

  const exportNote = el('p', {
    className: 'md-typescale-body-small app-logo-status',
    text: ctx.t('appLogo.export.omitted', 'Image data is deliberately left out of every export.')
  });

  sourcesSection.append(sourceToolbar, sourceSummary, exportNote, sourceTable.root);
  panel.append(sourcesSection);

  /* ------------------------------------------------------------- */
  /* 3. Use your own image                                          */
  /* ------------------------------------------------------------- */

  const uploadSection = el('section', {
    className: 'app-logo-section',
    attrs: { id: 'app-logo-upload', 'data-appearance-id': 'app-logo:upload' }
  });
  uploadSection.append(ctx.components.sectionHeading({ title: 'appLogo.upload.title' }));

  uploadSection.append(
    el('p', {
      className: 'md-typescale-body-medium',
      text: ctx.t('appLogo.upload.limits', 'PNG, JPEG, WebP and BMP only.', {
        values: {
          bytes: formatBytes(LIMITS.maxSourceBytes),
          min: LIMITS.minDimension,
          max: LIMITS.maxDimension
        }
      })
    })
  );

  const uploadStatus = el('p', {
    className: 'md-typescale-body-medium app-logo-status',
    attrs: { role: 'status', id: 'app-logo-upload-status' }
  });

  const chooseButton = ctx.components.button({
    label: 'appLogo.upload.choose',
    variant: 'tonal',
    icon: 'upload',
    onClick: () => void chooseFile()
  });

  uploadSection.append(
    el('div', { className: 'app-logo-row', children: [chooseButton] }),
    uploadStatus,
    el('p', {
      className: 'md-typescale-body-small app-logo-status',
      text: ctx.t('appLogo.upload.notRetained', 'The original file is not kept.')
    })
  );
  panel.append(uploadSection);

  /* ------------------------------------------------------------- */
  /* 4. Crop and framing                                            */
  /* ------------------------------------------------------------- */

  const editorSection = el('section', {
    className: 'app-logo-section',
    attrs: { id: 'app-logo-editor', 'data-appearance-id': 'app-logo:editor' }
  });
  editorSection.append(
    ctx.components.sectionHeading({ title: 'appLogo.editor.title', description: 'appLogo.crop.regionHint' })
  );

  const editorUnavailable = ctx.components.emptyState({
    title: 'appLogo.editor.unavailable',
    action: {
      label: 'appLogo.upload.choose',
      variant: 'tonal',
      icon: 'upload',
      onClick: () => void chooseFile()
    }
  });

  const editorBody = el('div');
  const cropper = buildCropper();
  const cropSummary = el('p', {
    className: 'md-typescale-body-small app-logo-status',
    attrs: { role: 'status' }
  });

  const cropX = ctx.components.textField({
    label: 'appLogo.crop.x',
    type: 'number',
    min: 0,
    max: 99,
    step: 1,
    value: String(Math.round(readCrop(ctx.settings).x * 100)),
    onCommit: (value) => commitCropField('x', value)
  });
  const cropY = ctx.components.textField({
    label: 'appLogo.crop.y',
    type: 'number',
    min: 0,
    max: 99,
    step: 1,
    value: String(Math.round(readCrop(ctx.settings).y * 100)),
    onCommit: (value) => commitCropField('y', value)
  });
  const cropW = ctx.components.textField({
    label: 'appLogo.crop.width',
    type: 'number',
    min: 1,
    max: 100,
    step: 1,
    value: String(Math.round(readCrop(ctx.settings).width * 100)),
    onCommit: (value) => commitCropField('width', value)
  });
  const cropH = ctx.components.textField({
    label: 'appLogo.crop.height',
    type: 'number',
    min: 1,
    max: 100,
    step: 1,
    value: String(Math.round(readCrop(ctx.settings).height * 100)),
    onCommit: (value) => commitCropField('height', value)
  });

  const cropReset = ctx.components.button({
    label: 'appLogo.crop.reset',
    variant: 'text',
    icon: 'refresh',
    onClick: () => writeCrop(FULL_CROP)
  });

  const fitControl = ctx.components.segmentedButton({
    label: 'appLogo.setting.fit',
    value: readChoices(ctx.settings).fit,
    options: [
      { value: 'contain', label: 'appLogo.fit.contain' },
      { value: 'cover', label: 'appLogo.fit.cover' },
      { value: 'fill', label: 'appLogo.fit.fill' }
    ],
    onChange: (value) => ctx.settings.set(FIT_ID, value)
  });

  const focalXControl = ctx.components.slider({
    label: 'appLogo.setting.focalX',
    min: 0,
    max: 100,
    step: 1,
    unit: '%',
    value: ctx.settings.get<number>(FOCAL_X_ID, 50),
    onChange: (value) => ctx.settings.set(FOCAL_X_ID, value)
  });

  const focalYControl = ctx.components.slider({
    label: 'appLogo.setting.focalY',
    min: 0,
    max: 100,
    step: 1,
    unit: '%',
    value: ctx.settings.get<number>(FOCAL_Y_ID, 50),
    onChange: (value) => ctx.settings.set(FOCAL_Y_ID, value)
  });

  const transparentControl = ctx.components.switchControl({
    label: 'appLogo.setting.backgroundTransparent',
    checked: ctx.settings.get<boolean>(BACKGROUND_TRANSPARENT_ID, true),
    onChange: (checked) => ctx.settings.set(BACKGROUND_TRANSPARENT_ID, checked)
  });

  const backgroundButton = ctx.components.button({
    label: 'appLogo.background.pick',
    variant: 'outlined',
    icon: 'palette',
    onClick: () => {
      openColorPicker({
        anchor: backgroundButton,
        value: ctx.settings.get<string>(BACKGROUND_COLOUR_ID, '#ffffff'),
        contrastAgainst: surfaceColour(),
        onChange: (value) => ctx.settings.set(BACKGROUND_COLOUR_ID, value)
      });
    }
  });

  const contrastLine = el('p', {
    className: 'md-typescale-body-small app-logo-status',
    attrs: { role: 'status' }
  });

  const radiusControl = ctx.components.slider({
    label: 'appLogo.setting.cornerRadius',
    min: 0,
    max: 50,
    step: 1,
    unit: '%',
    value: ctx.settings.get<number>(CORNER_RADIUS_ID, 0),
    onChange: (value) => ctx.settings.set(CORNER_RADIUS_ID, value)
  });

  const safeAreaControl = ctx.components.switchControl({
    label: 'appLogo.setting.safeArea',
    checked: ctx.settings.get<boolean>(SAFE_AREA_ID, false),
    onChange: (checked) => ctx.settings.set(SAFE_AREA_ID, checked)
  });

  const numbers = el('div', { className: 'app-logo-numbers' });
  numbers.append(cropX.root, cropY.root, cropW.root, cropH.root);

  const framingRow = el('div', { className: 'app-logo-row' });
  framingRow.append(fitControl.root, transparentControl.root, backgroundButton, safeAreaControl.root);

  const slidersRow = el('div', { className: 'app-logo-row' });
  slidersRow.append(focalXControl.root, focalYControl.root, radiusControl.root);

  const pendingPreviews = el('div', { className: 'app-logo-previews' });

  editorBody.append(
    cropper.root,
    numbers,
    el('div', { className: 'app-logo-row', children: [cropReset] }),
    cropSummary,
    framingRow,
    contrastLine,
    slidersRow,
    ctx.components.sectionHeading({ title: 'appLogo.preview.title', description: 'appLogo.preview.description' }),
    pendingPreviews
  );

  editorSection.append(editorUnavailable, editorBody);
  panel.append(editorSection);

  /* ------------------------------------------------------------- */
  /* 5. Losses and conversion                                       */
  /* ------------------------------------------------------------- */

  const conversionSection = el('section', {
    className: 'app-logo-section',
    attrs: { id: 'app-logo-conversion', 'data-appearance-id': 'app-logo:conversion' }
  });
  conversionSection.append(ctx.components.sectionHeading({ title: 'appLogo.losses.title' }));

  const lossList = el('ul', { className: 'app-logo-losses' });
  const convertButton = ctx.components.button({
    label: 'appLogo.convert.action',
    variant: 'filled',
    icon: 'save',
    disabled: true,
    disabledReason: 'appLogo.convert.needSource',
    onClick: () => void runConversion()
  });
  const convertProgress = ctx.components.linearProgress({ label: 'appLogo.convert.title', value: 0 });
  convertProgress.root.hidden = true;

  conversionSection.append(
    lossList,
    el('div', { className: 'app-logo-row', children: [convertButton] }),
    convertProgress.root
  );
  panel.append(conversionSection);

  /* ------------------------------------------------------------- */
  /* 6. Generated sizes                                             */
  /* ------------------------------------------------------------- */

  const variantSection = el('section', {
    className: 'app-logo-section',
    attrs: { id: 'app-logo-variants', 'data-appearance-id': 'app-logo:variants' }
  });
  variantSection.append(
    ctx.components.sectionHeading({ title: 'appLogo.variants.title', description: 'appLogo.variants.description' })
  );

  let variantRows: VariantRow[] = [];
  let shownVariantRows: VariantRow[] = [];
  let variantSelection: string[] = [];

  const variantSummary = el('p', {
    className: 'md-typescale-body-small app-logo-status',
    attrs: { role: 'status' }
  });

  const variantSearch = ctx.createSearchBar({
    label: 'appLogo.variantSearch',
    sample: TARGET_SIZES.join('\n'),
    onChange: () => redrawVariants()
  });

  const variantTable = ctx.components.dataTable<VariantRow>({
    label: 'appLogo.variants.title',
    selectable: true,
    rows: [],
    rowId: (row) => row.id,
    emptyMessage: 'appLogo.variants.empty',
    onSelectionChange: (ids) => {
      variantSelection = ids;
      refreshVariantToolbar();
    },
    columns: [
      {
        id: 'preview',
        label: 'appLogo.column.preview',
        render: (row) => {
          const holder = el('span', { className: 'app-logo-cell-preview' });
          const record = readCustomRecord(ctx.settings);
          const variant = record?.variants.find((candidate) => candidate.size === row.size) ?? null;
          if (variant) {
            const image = document.createElement('img');
            image.src = variant.dataUrl;
            image.width = Math.min(28, row.size);
            image.height = Math.min(28, row.size);
            image.alt = '';
            image.setAttribute('aria-hidden', 'true');
            holder.append(image);
          }
          return holder;
        }
      },
      { id: 'size', label: 'appLogo.variants.column.size', sortable: true, value: (row) => row.size },
      { id: 'bytes', label: 'appLogo.variants.column.bytes', sortable: true, align: 'end', value: (row) => row.bytes },
      {
        id: 'verified',
        label: 'appLogo.variants.column.verified',
        value: (row) => (row.verified ? ctx.t('appLogo.variants.verified', 'Verified') : ctx.t('appLogo.variants.unverified', 'Not verified')),
        render: (row) =>
          ctx.components.badge({
            label: row.verified ? 'appLogo.variants.verified' : 'appLogo.variants.unverified',
            severity: row.verified ? 'success' : 'error'
          })
      }
    ]
  });

  const variantSelectShown = ctx.components.button({
    label: 'core.action.selectAll',
    variant: 'text',
    onClick: () => {
      variantTable.setSelection(shownVariantRows.map((row) => row.id));
      variantSelection = variantTable.selection();
      refreshVariantToolbar();
      announceVariantSelection();
    }
  });

  const variantSelectAll = ctx.components.button({
    label: 'core.action.selectAll',
    variant: 'text',
    onClick: () => {
      variantTable.setSelection(variantRows.map((row) => row.id));
      variantSelection = variantTable.selection();
      refreshVariantToolbar();
      announceVariantSelection();
    }
  });

  const variantInvert = ctx.components.button({
    label: 'core.action.invertSelection',
    variant: 'text',
    onClick: () => {
      const chosen = new Set(variantTable.selection());
      variantTable.setSelection(variantRows.filter((row) => !chosen.has(row.id)).map((row) => row.id));
      variantSelection = variantTable.selection();
      refreshVariantToolbar();
      announceVariantSelection();
    }
  });

  const variantFormat = ctx.components.select({
    label: 'appLogo.export.format',
    options: EXPORT_FORMATS.map((format) => ({ value: format, label: format.toUpperCase() })),
    value: 'csv'
  });

  const variantExport = ctx.components.button({
    label: 'appLogo.export.action',
    variant: 'text',
    icon: 'download',
    onClick: () => void exportRows(variantSelection, 'variants')
  });

  const variantVerify = ctx.components.button({
    label: 'appLogo.variants.reverify',
    variant: 'text',
    icon: 'check',
    onClick: () => void reverifySelected()
  });

  const variantToolbar = el('div', { className: 'app-logo-row' });
  variantToolbar.append(
    variantSelectShown,
    variantSelectAll,
    variantInvert,
    variantVerify,
    variantFormat.root,
    variantExport
  );

  variantSection.append(variantSearch.root, variantToolbar, variantSummary, variantTable.root);
  panel.append(variantSection);

  /* ------------------------------------------------------------- */
  /* 7. The active mark at every display size                       */
  /* ------------------------------------------------------------- */

  const activeSection = el('section', {
    className: 'app-logo-section',
    attrs: { id: 'app-logo-active-previews', 'data-appearance-id': 'app-logo:active-previews' }
  });
  activeSection.append(ctx.components.sectionHeading({ title: 'appLogo.preview.title' }));
  const activePreviews = el('div', { className: 'app-logo-previews' });
  activeSection.append(activePreviews);
  panel.append(activeSection);

  /* ------------------------------------------------------------- */
  /* Behaviour                                                      */
  /* ------------------------------------------------------------- */

  /** Rewrites a button's visible label without rebuilding the button. */
  function relabel(button: HTMLButtonElement, text: string): void {
    const node = button.querySelector('.md-btn__label');
    if (node) node.textContent = text;
  }

  /** Explains why a control is unavailable, on the control itself. */
  function setBlocked(button: HTMLButtonElement, blocked: boolean, reason: string): void {
    button.disabled = blocked;
    if (blocked) {
      button.title = reason;
      button.setAttribute('aria-description', reason);
    } else {
      button.removeAttribute('title');
      button.removeAttribute('aria-description');
    }
  }

  function surfaceColour(): string {
    const value = getComputedStyle(document.documentElement).getPropertyValue('--md-sys-color-surface').trim();
    return value || '#ffffff';
  }

  function pickVariant(record: CustomLogoRecord, size: number): LogoVariant | null {
    const sorted = [...record.variants].sort((left, right) => left.size - right.size);
    return sorted.find((variant) => variant.size >= size) ?? sorted[sorted.length - 1] ?? null;
  }

  function writeCrop(crop: CropRect): void {
    const next = normalizeCrop(crop);
    ctx.settings.set(CROP_ID, next);
    cropX.set(String(Math.round(next.x * 100)));
    cropY.set(String(Math.round(next.y * 100)));
    cropW.set(String(Math.round(next.width * 100)));
    cropH.set(String(Math.round(next.height * 100)));
  }

  function commitCropField(field: keyof CropRect, raw: string): void {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      ctx.notify.warn(
        ctx.t('appLogo.notify.title', 'Application logo'),
        `"${raw}" is not a number, so the crop was left unchanged.`
      );
      writeCrop(readCrop(ctx.settings));
      return;
    }
    const crop = { ...readCrop(ctx.settings), [field]: parsed / 100 } as CropRect;
    writeCrop(crop);
  }

  /* ---------------- the cropper ---------------- */

  interface Cropper {
    root: HTMLElement;
    draw(): void;
    syncRegion(): void;
  }

  function buildCropper(): Cropper {
    const root = el('div', { className: 'app-logo-cropper' });
    const canvas = el('canvas', { className: 'app-logo-cropper__canvas' });
    const region = el('div', {
      className: 'app-logo-cropper__region',
      attrs: {
        role: 'group',
        tabindex: '0',
        'aria-label': ctx.t('appLogo.crop.region', 'Crop rectangle'),
        id: nextId('app-logo-crop-region')
      }
    });

    const corners: Array<{ key: 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight'; labelKey: string }> = [
      { key: 'topLeft', labelKey: 'appLogo.crop.handle.topLeft' },
      { key: 'topRight', labelKey: 'appLogo.crop.handle.topRight' },
      { key: 'bottomLeft', labelKey: 'appLogo.crop.handle.bottomLeft' },
      { key: 'bottomRight', labelKey: 'appLogo.crop.handle.bottomRight' }
    ];

    for (const corner of corners) {
      const handle = el('button', {
        className: 'app-logo-cropper__handle',
        attrs: {
          type: 'button',
          'data-corner': corner.key,
          'aria-label': ctx.t(corner.labelKey, corner.key)
        }
      });
      handle.addEventListener('keydown', (event) => {
        const step = event.shiftKey ? 0.05 : 0.01;
        let dx = 0;
        let dy = 0;
        if (event.key === 'ArrowLeft') dx = -step;
        else if (event.key === 'ArrowRight') dx = step;
        else if (event.key === 'ArrowUp') dy = -step;
        else if (event.key === 'ArrowDown') dy = step;
        else return;
        event.preventDefault();
        moveCorner(corner.key, dx, dy);
      });
      handle.addEventListener('pointerdown', (event) => {
        event.stopPropagation();
        event.preventDefault();
        startDrag((fractionX, fractionY) => setCorner(corner.key, fractionX, fractionY));
      });
      region.append(handle);
    }

    region.addEventListener('keydown', (event) => {
      if (event.target !== region) return;
      const step = event.shiftKey ? 0.05 : 0.01;
      const crop = readCrop(ctx.settings);
      let dx = 0;
      let dy = 0;
      if (event.key === 'ArrowLeft') dx = -step;
      else if (event.key === 'ArrowRight') dx = step;
      else if (event.key === 'ArrowUp') dy = -step;
      else if (event.key === 'ArrowDown') dy = step;
      else return;
      event.preventDefault();
      writeCrop({
        ...crop,
        x: Math.min(Math.max(crop.x + dx, 0), 1 - crop.width),
        y: Math.min(Math.max(crop.y + dy, 0), 1 - crop.height)
      });
    });

    region.addEventListener('pointerdown', (event) => {
      const start = readCrop(ctx.settings);
      const rect = root.getBoundingClientRect();
      const originX = (event.clientX - rect.left) / rect.width;
      const originY = (event.clientY - rect.top) / rect.height;
      event.preventDefault();
      startDrag((fractionX, fractionY) => {
        const nextX = Math.min(Math.max(start.x + (fractionX - originX), 0), 1 - start.width);
        const nextY = Math.min(Math.max(start.y + (fractionY - originY), 0), 1 - start.height);
        writeCrop({ ...start, x: nextX, y: nextY });
      });
    });

    /**
     * Tracks a pointer on the window rather than on the element, so a drag that
     * leaves the cropper keeps working instead of stopping at the edge and
     * leaving the rectangle somewhere the user did not choose.
     */
    function startDrag(onMove: (fractionX: number, fractionY: number) => void): void {
      const rect = root.getBoundingClientRect();
      const move = (moveEvent: PointerEvent): void => {
        onMove(
          Math.min(Math.max((moveEvent.clientX - rect.left) / rect.width, 0), 1),
          Math.min(Math.max((moveEvent.clientY - rect.top) / rect.height, 0), 1)
        );
      };
      const up = (): void => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    }

    function setCorner(key: string, fractionX: number, fractionY: number): void {
      const crop = readCrop(ctx.settings);
      const left = crop.x;
      const top = crop.y;
      const right = crop.x + crop.width;
      const bottom = crop.y + crop.height;
      const minimum = 0.02;

      if (key === 'topLeft') {
        const x = Math.min(fractionX, right - minimum);
        const y = Math.min(fractionY, bottom - minimum);
        writeCrop({ x, y, width: right - x, height: bottom - y });
      } else if (key === 'topRight') {
        const x = Math.max(fractionX, left + minimum);
        const y = Math.min(fractionY, bottom - minimum);
        writeCrop({ x: left, y, width: x - left, height: bottom - y });
      } else if (key === 'bottomLeft') {
        const x = Math.min(fractionX, right - minimum);
        const y = Math.max(fractionY, top + minimum);
        writeCrop({ x, y: top, width: right - x, height: y - top });
      } else {
        const x = Math.max(fractionX, left + minimum);
        const y = Math.max(fractionY, top + minimum);
        writeCrop({ x: left, y: top, width: x - left, height: y - top });
      }
    }

    function moveCorner(key: string, dx: number, dy: number): void {
      const crop = readCrop(ctx.settings);
      const anchorX = key === 'topLeft' || key === 'bottomLeft' ? crop.x : crop.x + crop.width;
      const anchorY = key === 'topLeft' || key === 'topRight' ? crop.y : crop.y + crop.height;
      setCorner(key, Math.min(Math.max(anchorX + dx, 0), 1), Math.min(Math.max(anchorY + dy, 0), 1));
    }

    root.append(canvas, region);

    return {
      root,
      draw(): void {
        const source = getSessionSource();
        if (!source) return;
        const width = Math.min(source.bitmap.width, 480);
        const height = Math.round((width / source.bitmap.width) * source.bitmap.height);
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        if (!context) return;
        context.clearRect(0, 0, width, height);
        context.drawImage(source.bitmap, 0, 0, width, height);
      },
      syncRegion(): void {
        const crop = readCrop(ctx.settings);
        region.style.insetInlineStart = `${crop.x * 100}%`;
        region.style.insetBlockStart = `${crop.y * 100}%`;
        region.style.width = `${crop.width * 100}%`;
        region.style.height = `${crop.height * 100}%`;
      }
    };
  }

  /* ---------------- file choosing ---------------- */

  async function chooseFile(): Promise<void> {
    uploadStatus.classList.remove('app-logo-status--warning');
    const picked = await ctx.studio.dialog.openFile({
      title: ctx.t('appLogo.upload.choose', 'Choose an image file'),
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp'] }]
    });
    if (!picked.ok) {
      showUploadProblem(picked.error);
      return;
    }
    const paths = picked.value;
    if (!paths || paths.length === 0) return;

    uploadStatus.textContent = ctx.t('appLogo.upload.loading', 'Reading and checking the file…');

    const read = await ctx.studio.fs.readBase64(paths[0], LIMITS.maxSourceBytes + 1);
    if (!read.ok) {
      showUploadProblem(read.error);
      return;
    }

    let bytes: Uint8Array;
    try {
      const binary = atob(read.value);
      bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    } catch {
      showUploadProblem('The file could not be read as binary data.');
      return;
    }

    const header = inspectBytes(bytes);
    if (!header.ok) {
      showUploadProblem(header.detail);
      return;
    }

    const decoded = await decodeBounded(bytes, header.facts);
    if (!decoded.ok) {
      showUploadProblem(decoded.detail);
      return;
    }

    setSessionSource(decoded.source);
    writeCrop(FULL_CROP);
    uploadStatus.textContent = ctx.t('appLogo.upload.ready', 'Loaded.', {
      values: {
        format: header.facts.format.toUpperCase(),
        width: header.facts.width,
        height: header.facts.height,
        bytes: formatBytes(header.facts.byteLength),
        alpha: header.facts.hasAlphaChannel
          ? ctx.t('appLogo.upload.hasAlpha', 'It carries an alpha channel.')
          : ctx.t('appLogo.upload.noAlpha', 'It carries no alpha channel.')
      }
    });
    ctx.a11y.announce(uploadStatus.textContent);
    refreshAll();
  }

  function showUploadProblem(detail: string): void {
    const message = ctx.t('appLogo.upload.rejected', 'The file was refused and nothing was changed. {detail}', {
      values: { detail }
    });
    uploadStatus.textContent = message;
    uploadStatus.classList.add('app-logo-status--warning');
    ctx.notify.warn(ctx.t('appLogo.notify.title', 'Application logo'), message);
    ctx.a11y.announce(message, true);
  }

  /* ---------------- applying a source ---------------- */

  function applySource(id: string): void {
    if (id === CUSTOM_SOURCE && !readCustomRecord(ctx.settings)) {
      ctx.notify.warn(
        ctx.t('appLogo.notify.title', 'Application logo'),
        ctx.t('appLogo.convert.needSource', 'Load an image in this session before converting.')
      );
      return;
    }
    ctx.settings.set(SOURCE_ID, id);
    const result = applyToChrome(ctx.settings);
    const name =
      id === CUSTOM_SOURCE
        ? ctx.t('appLogo.kind.custom', 'Your own image')
        : ctx.t(presetById(id)?.labelKey ?? id, id);
    void ctx.history.record('Changed the application logo', 'app-logo', {
      source: id,
      titleBarApplied: result.applied
    });
    ctx.notify.success(
      ctx.t('appLogo.notify.title', 'Application logo'),
      ctx.t('appLogo.notify.applied', 'The application logo is now {name}.', { values: { name } })
    );
    if (!result.applied && ctx.settings.get<boolean>(SHOW_IN_TITLE_BAR_ID, true)) {
      ctx.notify.warn(ctx.t('appLogo.notify.title', 'Application logo'), result.reason);
    }
    refreshAll();
  }

  async function removeCustomMark(anchor: HTMLElement): Promise<void> {
    const record = readCustomRecord(ctx.settings);
    if (!record) {
      ctx.notify.info(
        ctx.t('appLogo.notify.title', 'Application logo'),
        ctx.t('appLogo.remove.none', 'There is no converted mark to remove.')
      );
      return;
    }
    const approved = await ctx.confirm.request({
      action: `Remove the ${record.variants.length} converted logo sizes`,
      affected: record.variants.map((variant) => `${variant.size}x${variant.size} PNG, ${formatBytes(variant.byteLength)}`),
      irreversible:
        'The converted sizes are deleted from the settings file and cannot be recovered from within the application. Your original image file on disk is not touched, and the shipped mark takes over immediately.',
      anchor
    });
    if (!approved) return;

    ctx.settings.set(CUSTOM_RECORD_ID, null);
    if (ctx.settings.get<string>(SOURCE_ID, DEFAULT_PRESET_ID) === CUSTOM_SOURCE) {
      ctx.settings.set(SOURCE_ID, DEFAULT_PRESET_ID);
    }
    applyToChrome(ctx.settings);
    await ctx.history.record('Removed the converted application logo', 'app-logo', {
      sizes: record.variants.map((variant) => variant.size),
      totalBytes: record.totalBytes
    });
    ctx.notify.success(
      ctx.t('appLogo.notify.title', 'Application logo'),
      ctx.t('appLogo.remove.done', 'The converted sizes were removed and the shipped mark is back in use.')
    );
    refreshAll();
  }

  /* ---------------- conversion ---------------- */

  async function runConversion(): Promise<void> {
    const source = getSessionSource();
    if (!source) return;

    const choices = readChoices(ctx.settings);
    convertProgress.root.hidden = false;
    convertProgress.set(0);
    // Re-entry here would write two sets of variants over one another, so the
    // button is closed for the duration and says why rather than going quiet.
    setBlocked(convertButton, true, ctx.t('appLogo.convert.title', 'Converting the logo'));

    const result = await convert(source.bitmap, source.facts, choices, (done, total, size) => {
      convertProgress.set(done / total);
      ctx.a11y.announce(
        ctx.t('appLogo.convert.progress', 'Converting.', { values: { done, total, size } })
      );
    });

    convertProgress.root.hidden = true;
    setBlocked(convertButton, false, '');

    if (!result.ok) {
      const message = ctx.t('appLogo.convert.failed', 'Conversion failed and the previous mark is still in use. {detail}', {
        values: { detail: result.detail }
      });
      ctx.notify.error(ctx.t('appLogo.notify.title', 'Application logo'), message);
      ctx.a11y.announce(message, true);
      return;
    }

    const record: CustomLogoRecord = {
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
      sourceFormat: source.facts.format,
      sourceWidth: source.facts.width,
      sourceHeight: source.facts.height,
      sourceBytes: source.facts.byteLength,
      sourceHadAlpha: source.facts.hasAlphaChannel,
      crop: normalizeCrop(choices.crop),
      fit: choices.fit,
      focalX: choices.focalX,
      focalY: choices.focalY,
      background: choices.background,
      cornerRadiusPercent: choices.cornerRadiusPercent,
      hasTransparency: result.hasTransparency,
      totalBytes: result.totalBytes,
      variants: result.variants,
      losses: result.losses
    };

    ctx.settings.set(CUSTOM_RECORD_ID, record);
    ctx.settings.set(SOURCE_ID, CUSTOM_SOURCE);
    const applied = applyToChrome(ctx.settings);

    // The payload records what was produced, never the produced image itself:
    // a history entry is a record of a change, not a second copy of the user's
    // picture sitting in a different file.
    await ctx.history.record('Converted a custom application logo', 'app-logo', {
      sourceFormat: source.facts.format,
      sourceWidth: source.facts.width,
      sourceHeight: source.facts.height,
      sizes: result.variants.map((variant) => variant.size),
      totalBytes: result.totalBytes,
      losses: result.losses.map((loss) => loss.kind),
      titleBarApplied: applied.applied
    });

    const message = ctx.t('appLogo.convert.success', 'All sizes were written and verified.', {
      values: { count: result.variants.length, bytes: formatBytes(result.totalBytes) }
    });
    ctx.notify.success(ctx.t('appLogo.notify.title', 'Application logo'), message);
    ctx.a11y.announce(message);
    if (!applied.applied && ctx.settings.get<boolean>(SHOW_IN_TITLE_BAR_ID, true)) {
      ctx.notify.warn(ctx.t('appLogo.notify.title', 'Application logo'), applied.reason);
    }
    refreshAll();
  }

  async function reverifySelected(): Promise<void> {
    const record = readCustomRecord(ctx.settings);
    if (!record || variantSelection.length === 0) {
      ctx.notify.info(
        ctx.t('appLogo.notify.title', 'Application logo'),
        ctx.t('appLogo.export.needRows', 'Select at least one row to export.')
      );
      return;
    }
    let passed = 0;
    const updated: LogoVariant[] = [];
    for (const variant of record.variants) {
      if (!variantSelection.includes(String(variant.size))) {
        updated.push(variant);
        continue;
      }
      const check = await verifyVariant(variant.dataUrl, variant.size);
      if (check.ok) passed += 1;
      updated.push({ ...variant, verified: check.ok, verificationDetail: check.detail, byteLength: check.byteLength });
    }
    ctx.settings.set(CUSTOM_RECORD_ID, { ...record, variants: updated });
    const message = ctx.t('appLogo.variants.reverified', 'Verification finished.', {
      values: { passed, count: variantSelection.length }
    });
    if (passed === variantSelection.length) {
      ctx.notify.success(ctx.t('appLogo.notify.title', 'Application logo'), message);
    } else {
      ctx.notify.warn(ctx.t('appLogo.notify.title', 'Application logo'), message);
    }
    ctx.a11y.announce(message);
    refreshAll();
  }

  /* ---------------- export ---------------- */

  async function exportRows(ids: string[], which: 'sources' | 'variants'): Promise<void> {
    if (ids.length === 0) {
      ctx.notify.warn(
        ctx.t('appLogo.notify.title', 'Application logo'),
        ctx.t('appLogo.export.needRows', 'Select at least one row to export.')
      );
      return;
    }
    const format = (which === 'sources' ? sourceFormat.get() : variantFormat.get()) as ExportFormat;
    const rows: Array<Record<string, unknown>> =
      which === 'sources'
        ? sourceRows
            .filter((row) => ids.includes(row.id))
            .map((row) => ({ id: row.id, name: row.name, origin: row.origin, detail: row.detail }))
        : variantRows
            .filter((row) => ids.includes(row.id))
            .map((row) => ({
              size: row.size,
              bytes: row.bytes,
              verified: row.verified,
              verification: row.detail,
              imageData: 'omitted by design'
            }));

    const preflight = ctx.exporter.preflight(rows, format);
    if (preflight.losses.length > 0) {
      ctx.notify.warn(
        ctx.t('appLogo.export.format', 'Export format'),
        preflight.losses.map((loss) => `${loss.field}: ${loss.reason}`).join(' ')
      );
    }

    const path = await ctx.exporter.save(rows, format, {
      name: which === 'sources' ? 'application-logo-marks' : 'application-logo-sizes',
      defaultFileName: `${which === 'sources' ? 'application-logo-marks' : 'application-logo-sizes'}.${format}`
    });
    if (!path) return;
    ctx.notify.success(
      ctx.t('appLogo.notify.title', 'Application logo'),
      ctx.t('appLogo.export.done', 'Export finished.', { values: { count: rows.length, path } })
    );
  }

  /* ---------------- drawing the derived regions ---------------- */

  function refreshSourceToolbar(): void {
    setBlocked(
      applyButton,
      sourceSelection.length !== 1,
      ctx.t('appLogo.action.apply.needOne', 'Select exactly one mark to apply.', {
        values: { count: sourceSelection.length }
      })
    );

    const shownIds = new Set(shownSourceRows.map((row) => row.id));
    const hidden = sourceSelection.filter((id) => !shownIds.has(id)).length;
    sourceSummary.textContent = ctx.t('appLogo.selection.summary', 'Selection.', {
      values: {
        selected: sourceSelection.length,
        shown: shownSourceRows.length,
        total: sourceRows.length,
        hidden
      }
    });

    relabel(selectShownButton, ctx.t('appLogo.action.selectShown', 'Select the shown rows', {
      values: { count: shownSourceRows.length }
    }));
    relabel(selectEverythingButton, ctx.t('appLogo.action.selectEverything', 'Select every row', {
      values: { count: sourceRows.length }
    }));

    setBlocked(
      removeCustom,
      readCustomRecord(ctx.settings) === null,
      ctx.t('appLogo.remove.none', 'There is no converted mark to remove.')
    );
  }

  function announceSourceSelection(): void {
    ctx.a11y.announce(sourceSummary.textContent ?? '');
  }

  function redrawSources(): void {
    const record = readCustomRecord(ctx.settings);
    sourceRows = PRESETS.map((preset) => ({
      id: preset.id,
      name: ctx.t(preset.labelKey, preset.id),
      origin: ctx.t('appLogo.kind.preset', 'Shipped'),
      detail: ctx.t(preset.descriptionKey, ''),
      isCustom: false
    }));
    if (record) {
      sourceRows.push({
        id: CUSTOM_SOURCE,
        name: ctx.t('appLogo.kind.custom', 'Your own image'),
        origin: ctx.t('appLogo.kind.custom', 'Your own image'),
        detail: ctx.t('appLogo.custom.detail', 'Converted sizes.', {
          values: {
            count: record.variants.length,
            bytes: formatBytes(record.totalBytes),
            date: formatDate(record.createdAt)
          }
        }),
        isCustom: true
      });
    }

    const query = sourceSearch.query();
    shownSourceRows = sourceRows.filter((row) => {
      const preset = presetById(row.id);
      const haystack = [row.name, row.origin, row.detail, row.id, ...(preset?.keywords ?? [])].join(' ');
      return query.matches(haystack);
    });
    sourceTable.setRows(shownSourceRows);
    pruneSelection(sourceTable, sourceRows.map((row) => row.id));
    sourceSelection = sourceTable.selection();
    refreshSourceToolbar();
  }

  /**
   * Drops selected ids for rows that no longer exist.
   *
   * Without this, removing the converted mark while it is selected leaves the
   * summary counting a row nobody can see, and a bulk action addressing a row
   * that is gone.
   */
  function pruneSelection(
    table: { selection(): string[]; setSelection(ids: string[]): void },
    existing: string[]
  ): void {
    const valid = new Set(existing);
    const current = table.selection();
    const kept = current.filter((id) => valid.has(id));
    if (kept.length !== current.length) table.setSelection(kept);
  }

  function refreshVariantToolbar(): void {
    const shownIds = new Set(shownVariantRows.map((row) => row.id));
    const hidden = variantSelection.filter((id) => !shownIds.has(id)).length;
    variantSummary.textContent = ctx.t('appLogo.selection.summary', 'Selection.', {
      values: {
        selected: variantSelection.length,
        shown: shownVariantRows.length,
        total: variantRows.length,
        hidden
      }
    });
    relabel(variantSelectShown, ctx.t('appLogo.action.selectShown', 'Select the shown rows', {
      values: { count: shownVariantRows.length }
    }));
    relabel(variantSelectAll, ctx.t('appLogo.action.selectEverything', 'Select every row', {
      values: { count: variantRows.length }
    }));

    const none = variantRows.length === 0;
    const reason = ctx.t('appLogo.variants.empty', 'No sizes have been generated.');
    for (const control of [variantSelectShown, variantSelectAll, variantInvert, variantVerify, variantExport]) {
      setBlocked(control, none, reason);
    }
  }

  function announceVariantSelection(): void {
    ctx.a11y.announce(variantSummary.textContent ?? '');
  }

  function redrawVariants(): void {
    const record = readCustomRecord(ctx.settings);
    variantRows = (record?.variants ?? []).map((variant) => ({
      id: String(variant.size),
      size: variant.size,
      bytes: variant.byteLength,
      verified: variant.verified,
      detail: variant.verificationDetail
    }));
    const query = variantSearch.query();
    shownVariantRows = variantRows.filter((row) => query.matches(`${row.size} ${row.bytes} ${row.detail}`));
    variantTable.setRows(shownVariantRows);
    pruneSelection(variantTable, variantRows.map((row) => row.id));
    variantSelection = variantTable.selection();
    refreshVariantToolbar();
  }

  function redrawCurrent(): void {
    currentMarkHolder.textContent = '';
    const mark = buildMarkElement(ctx.settings, 48);
    if (mark) currentMarkHolder.append(mark);

    const state = activeMark(ctx.settings);
    if (state.kind === 'preset') {
      const preset = presetById(state.presetId);
      currentState.textContent = ctx.t('appLogo.current.preset', 'A shipped mark is in use: {name}.', {
        values: { name: ctx.t(preset?.labelKey ?? state.presetId, state.presetId) }
      });
      currentState.classList.remove('app-logo-status--warning');
    } else if (state.kind === 'custom') {
      currentState.textContent = ctx.t('appLogo.current.custom', 'Your own image is in use.', {
        values: {
          date: formatDate(state.record.createdAt),
          format: String(state.record.sourceFormat).toUpperCase(),
          width: state.record.sourceWidth,
          height: state.record.sourceHeight
        }
      });
      currentState.classList.remove('app-logo-status--warning');
    } else {
      currentState.textContent = ctx.t('appLogo.current.missing', 'The stored choice cannot be rendered.', {
        values: { id: state.requested }
      });
      currentState.classList.add('app-logo-status--warning');
    }

    currentChrome.textContent = ctx.t('appLogo.current.chrome', 'Title bar: {state}', {
      values: { state: applyToChrome(ctx.settings).reason }
    });

    identity.textContent = '';
    const facts = identityFacts();
    const pairs: Array<[string, string]> = [
      [ctx.t('appLogo.identity.packageName', 'Package identity'), facts.packageName],
      [ctx.t('appLogo.identity.productName', 'Shipped product name'), facts.productName],
      [ctx.t('appLogo.identity.version', 'Version'), facts.version],
      [ctx.t('appLogo.identity.userDataDir', 'Data directory'), facts.userDataDir]
    ];
    for (const [term, value] of pairs) {
      identity.append(el('dt', { text: term }), el('dd', { text: value }));
    }
  }

  function redrawEditor(): void {
    const source = getSessionSource();
    const available = source !== null;
    editorUnavailable.hidden = available;
    editorBody.hidden = !available;
    setBlocked(
      convertButton,
      !available,
      ctx.t('appLogo.convert.needSource', 'Load an image in this session before converting.')
    );
    if (!available) {
      lossList.textContent = '';
      pendingPreviews.textContent = '';
      contrastLine.textContent = '';
      cropSummary.textContent = '';
      return;
    }

    cropper.draw();
    cropper.syncRegion();

    const choices = readChoices(ctx.settings);
    const crop = normalizeCrop(choices.crop);
    cropSummary.textContent = ctx.t('appLogo.crop.summary', 'Crop.', {
      values: {
        width: Math.round(crop.width * source.facts.width),
        height: Math.round(crop.height * source.facts.height),
        sourceWidth: source.facts.width,
        sourceHeight: source.facts.height
      }
    });

    /* contrast readout for the chosen background */
    if (choices.background) {
      const chosen = parseColor(choices.background);
      const against = parseColor(surfaceColour());
      if (chosen && against) {
        const ratio = contrastRatio(chosen, against);
        contrastLine.textContent =
          ratio < 3
            ? ctx.t('appLogo.background.lowContrast', 'Low contrast.', { values: { ratio: ratio.toFixed(2) } })
            : ctx.t('appLogo.background.contrast', 'Contrast.', { values: { ratio: ratio.toFixed(2) } });
        contrastLine.classList.toggle('app-logo-status--warning', ratio < 3);
      } else {
        contrastLine.textContent = '';
      }
    } else {
      contrastLine.textContent = '';
      contrastLine.classList.remove('app-logo-status--warning');
    }

    /* the pending previews, drawn by the same code that writes the output */
    pendingPreviews.textContent = '';
    for (const size of TARGET_SIZES) {
      pendingPreviews.append(buildPreviewTile(size, () => {
        const canvas = document.createElement('canvas');
        drawMark(canvas, source.bitmap, size, choices);
        canvas.style.width = `${size}px`;
        canvas.style.height = `${size}px`;
        return canvas;
      }));
    }

    /* the loss report, computed before anything is written */
    lossList.textContent = '';
    const losses = describeLosses(source.facts, choices);
    if (losses.length === 0) {
      lossList.append(
        el('li', {
          className: 'app-logo-loss md-typescale-body-medium',
          text: ctx.t('appLogo.losses.none', 'Nothing beyond the resize itself.')
        })
      );
    }
    for (const loss of losses) {
      const item = el('li', { className: 'app-logo-loss' });
      item.append(
        el('strong', { className: 'app-logo-loss__title md-typescale-title-small', text: ctx.t(loss.titleKey, loss.kind) }),
        el('span', { className: 'app-logo-loss__detail md-typescale-body-small', text: loss.detail })
      );
      lossList.append(item);
    }
  }

  function buildPreviewTile(size: number, build: () => HTMLElement | null): HTMLElement {
    const tile = el('div', { className: 'app-logo-preview' });
    const frame = el('div', { className: 'app-logo-preview__frame' });
    frame.style.inlineSize = `${size + 16}px`;
    frame.style.blockSize = `${size + 16}px`;
    const content = build();
    if (content) frame.append(content);
    if (ctx.settings.get<boolean>(SAFE_AREA_ID, false)) {
      frame.append(el('span', { className: 'app-logo-safe-ring' }));
    }
    tile.append(
      frame,
      el('span', {
        className: 'app-logo-preview__label md-typescale-label-small',
        text: ctx.t('appLogo.preview.size', '{size} pixels', { values: { size } })
      })
    );
    return tile;
  }

  function redrawActivePreviews(): void {
    activePreviews.textContent = '';
    for (const size of TARGET_SIZES) {
      activePreviews.append(buildPreviewTile(size, () => buildMarkElement(ctx.settings, size)));
    }
  }

  function formatDate(iso: string): string {
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
  }

  /**
   * Brings the editor's own controls back in step with the settings store.
   *
   * These same values also have rows in the settings surface, and two routes to
   * one value must never disagree about what that value is. Each control is
   * only written when it actually differs, so a value changed by dragging this
   * very slider is not written back underneath the user's finger.
   */
  function syncEditorControls(): void {
    const crop = readCrop(ctx.settings);
    const fields: Array<[typeof cropX, number]> = [
      [cropX, crop.x],
      [cropY, crop.y],
      [cropW, crop.width],
      [cropH, crop.height]
    ];
    for (const [field, value] of fields) {
      const next = String(Math.round(value * 100));
      if (field.get() !== next) field.set(next);
    }

    const choices = readChoices(ctx.settings);
    if (fitControl.get() !== choices.fit) fitControl.set(choices.fit);

    const focalX = ctx.settings.get<number>(FOCAL_X_ID, 50);
    if (focalXControl.get() !== focalX) focalXControl.set(focalX);
    const focalY = ctx.settings.get<number>(FOCAL_Y_ID, 50);
    if (focalYControl.get() !== focalY) focalYControl.set(focalY);

    const transparent = ctx.settings.get<boolean>(BACKGROUND_TRANSPARENT_ID, true);
    if (transparentControl.get() !== transparent) transparentControl.set(transparent);

    const radius = ctx.settings.get<number>(CORNER_RADIUS_ID, 0);
    if (radiusControl.get() !== radius) radiusControl.set(radius);

    const safe = ctx.settings.get<boolean>(SAFE_AREA_ID, false);
    if (safeAreaControl.get() !== safe) safeAreaControl.set(safe);

    setBlocked(
      backgroundButton,
      transparent,
      ctx.t(
        'appLogo.background.disabled',
        'The background is transparent, so a background colour would have no effect.'
      )
    );

    relabel(
      chooseButton,
      getSessionSource()
        ? ctx.t('appLogo.upload.replace', 'Choose a different image file')
        : ctx.t('appLogo.upload.choose', 'Choose an image file')
    );
  }

  function refreshAll(): void {
    redrawCurrent();
    redrawSources();
    redrawVariants();
    syncEditorControls();
    redrawEditor();
    redrawActivePreviews();
  }

  /* ---------------- wiring ---------------- */

  const watched = new Set([
    SOURCE_ID,
    SHOW_IN_TITLE_BAR_ID,
    FIT_ID,
    FOCAL_X_ID,
    FOCAL_Y_ID,
    BACKGROUND_TRANSPARENT_ID,
    BACKGROUND_COLOUR_ID,
    CORNER_RADIUS_ID,
    SAFE_AREA_ID,
    CROP_ID,
    CUSTOM_RECORD_ID
  ]);

  const stopSettings = ctx.settings.onChange((change) => {
    if (!watched.has(change.id)) return;
    if (change.id === CROP_ID) {
      cropper.syncRegion();
      redrawEditor();
      return;
    }
    refreshAll();
  });

  const stopSession = onSessionSourceChange(() => refreshAll());

  ctx.onDispose(() => {
    stopSettings();
    stopSession();
    sourceSearch.destroy();
    variantSearch.destroy();
  });

  // The tab can be reopened while an image chosen earlier this session is still
  // decoded and held, so the status line starts from the real state rather than
  // from an assumption that nothing has been loaded yet.
  const opening = getSessionSource();
  uploadStatus.textContent = opening
    ? ctx.t('appLogo.upload.ready', 'Loaded.', {
        values: {
          format: opening.facts.format.toUpperCase(),
          width: opening.facts.width,
          height: opening.facts.height,
          bytes: formatBytes(opening.facts.byteLength),
          alpha: opening.facts.hasAlphaChannel
            ? ctx.t('appLogo.upload.hasAlpha', 'It carries an alpha channel.')
            : ctx.t('appLogo.upload.noAlpha', 'It carries no alpha channel.')
        }
      })
    : ctx.t('appLogo.upload.none', 'No image is loaded in this session.');

  refreshAll();
}
