import { el, nextId } from './a11y';
import {
  COLOR_FORMATS,
  contrastRatio,
  formatColor,
  hsvToRgb,
  inGamut,
  namedColors,
  parseColor,
  rgbToHsv,
  toCssRgb,
  toHex,
  translate,
  type ColorFormat,
  type Rgb
} from './color';
import { i18n } from './i18n';
import { overlay } from './overlay';
import { createSearchBar } from './searchbar';
import type { OverlayHandle } from './types';

/**
 * The infinite colour picker.
 *
 * "Infinite" is the requirement and it is literal: a continuous two-dimensional
 * saturation/value field plus a continuous hue slider plus direct numeric entry.
 * Swatches, recents and named colours are conveniences layered on top of that
 * continuous surface — never a replacement for it, because a finite swatch grid
 * cannot express a colour that is not in the grid.
 *
 * The translator converts bidirectionally between every representation the
 * application understands. Alpha is preserved across all of them, the active
 * colour space is named, and a colour outside the sRGB gamut says exactly what
 * it will be clipped to rather than silently becoming a different colour.
 */

export interface ColorPickerOptions {
  anchor: HTMLElement;
  value: string;
  /** The colour the contrast readout is computed against. */
  contrastAgainst?: string;
  onChange(value: string): void;
  onClose?(): void;
}

const RECENT_LIMIT = 18;
const recent: string[] = [];

export function openColorPicker(options: ColorPickerOptions): OverlayHandle {
  const handle = overlay.open({
    anchor: options.anchor,
    placement: 'bottom-start',
    role: 'dialog',
    label: i18n.t('core.color.title', 'Colour'),
    dragKey: 'color-picker',
    onClose: options.onClose
  });
  handle.root.classList.add('md-colorpicker-surface');

  let rgb: Rgb = parseColor(options.value) ?? { r: 79, g: 107, b: 237, a: 1 };
  let hsv = rgbToHsv(rgb);

  const body = el('div', { className: 'md-colorpicker' });

  /* --- continuous field --- */
  const field = el('div', {
    className: 'md-colorpicker__field',
    attrs: { role: 'application', 'aria-label': i18n.t('core.color.spectrum', 'Spectrum'), tabindex: '0' }
  });
  const thumb = el('div', { className: 'md-colorpicker__thumb' });
  field.append(thumb);

  const hueId = nextId('md-hue');
  const hue = el('input', {
    className: 'md-colorpicker__hue',
    attrs: { id: hueId, type: 'range', min: '0', max: '360', step: '0.1', 'aria-label': i18n.t('core.color.hue', 'Hue') }
  });
  const alphaId = nextId('md-alpha');
  const alpha = el('input', {
    className: 'md-colorpicker__alpha',
    attrs: {
      id: alphaId,
      type: 'range',
      min: '0',
      max: '1',
      step: '0.001',
      'aria-label': i18n.t('core.color.alpha', 'Opacity')
    }
  });

  const preview = el('div', { className: 'md-colorpicker__preview' });
  const warning = el('p', { className: 'md-colorpicker__warning md-typescale-body-small', attrs: { role: 'status' } });
  const contrast = el('p', { className: 'md-typescale-body-small' });

  /* --- direct entry --- */
  const entryId = nextId('md-color-entry');
  const entryWrap = el('div', { className: 'md-field md-field--outlined' });
  entryWrap.append(
    el('label', {
      className: 'md-field__label',
      text: i18n.t('core.color.format', 'Format'),
      attrs: { for: entryId }
    })
  );
  const entry = el('input', {
    className: 'md-field__input md-colorpicker__value',
    attrs: { id: entryId, type: 'text', spellcheck: 'false', autocomplete: 'off' }
  });
  entryWrap.append(entry);

  /* --- translator --- */
  const translations = el('div', { className: 'md-colorpicker__translations' });

  /* --- swatches and named colours --- */
  const swatchRow = el('div', { className: 'md-swatches' });
  const namedList = el('div', { className: 'md-swatches' });
  const namedSearch = createSearchBar({
    label: 'core.search.label',
    compact: true,
    sample: namedColors().join('\n'),
    onChange: (query) => {
      for (const child of [...namedList.children]) {
        const node = child as HTMLElement;
        node.hidden = !query.matches(node.dataset.name ?? '');
      }
    }
  });

  const render = (): void => {
    const base = hsvToRgb({ h: hsv.h, s: 1, v: 1 });
    field.style.background = `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${toHex(base)})`;
    thumb.style.insetInlineStart = `${hsv.s * 100}%`;
    thumb.style.insetBlockStart = `${(1 - hsv.v) * 100}%`;
    thumb.style.background = toCssRgb(rgb);
    hue.value = String(hsv.h);
    alpha.value = String(rgb.a);
    preview.style.background = toCssRgb(rgb);
    if (document.activeElement !== entry) entry.value = toHex(rgb, rgb.a < 1);

    const clipped = !inGamut(rgb);
    warning.textContent = clipped
      ? i18n.t('core.color.outOfGamut', 'That colour is outside the sRGB gamut and will be clipped to {hex}.', {
          values: { hex: toHex(rgb) }
        })
      : '';

    const against = parseColor(options.contrastAgainst ?? '#ffffff') ?? { r: 255, g: 255, b: 255, a: 1 };
    contrast.textContent = i18n.t('core.color.contrast', 'Contrast against {against}: {ratio}:1', {
      values: { against: toHex(against), ratio: contrastRatio(rgb, against).toFixed(2) }
    });

    translations.textContent = '';
    for (const { format, value } of translate(rgb)) {
      const name = el('span', { className: 'md-typescale-label-medium', text: format });
      const input = el('input', {
        className: 'md-field__input md-colorpicker__value',
        attrs: { type: 'text', spellcheck: 'false', 'aria-label': `${format} value` }
      });
      input.value = value;
      input.addEventListener('change', () => applyText(input.value, format));
      const copy = el('button', {
        className: 'md-icon-btn',
        text: '⧉',
        attrs: { type: 'button', 'aria-label': i18n.t('core.color.copy', 'Copy this representation') }
      });
      copy.addEventListener('click', () => void navigator.clipboard.writeText(input.value));
      translations.append(name, input, copy);
    }

    swatchRow.textContent = '';
    for (const value of recent) {
      const swatch = el('button', {
        className: 'md-swatch',
        attrs: { type: 'button', 'aria-label': value, title: value }
      });
      swatch.style.background = value;
      swatch.addEventListener('click', () => applyText(value, 'hex'));
      swatchRow.append(swatch);
    }

    options.onChange(toHex(rgb, rgb.a < 1));
  };

  const applyText = (text: string, format: ColorFormat | 'hex'): void => {
    const parsed = parseColor(text);
    if (!parsed) {
      warning.textContent = `"${text}" could not be read as a ${format} colour. Nothing was changed.`;
      return;
    }
    rgb = parsed;
    hsv = rgbToHsv(rgb);
    remember(toHex(rgb, rgb.a < 1));
    render();
  };

  const remember = (value: string): void => {
    const index = recent.indexOf(value);
    if (index >= 0) recent.splice(index, 1);
    recent.unshift(value);
    if (recent.length > RECENT_LIMIT) recent.length = RECENT_LIMIT;
  };

  const pick = (event: PointerEvent): void => {
    const rect = field.getBoundingClientRect();
    const s = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const v = 1 - Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
    hsv = { h: hsv.h, s, v };
    rgb = { ...hsvToRgb(hsv), a: rgb.a };
    render();
  };

  field.addEventListener('pointerdown', (event) => {
    field.setPointerCapture(event.pointerId);
    pick(event);
    const move = (moveEvent: PointerEvent): void => pick(moveEvent);
    const up = (): void => {
      field.removeEventListener('pointermove', move);
      field.removeEventListener('pointerup', up);
      remember(toHex(rgb, rgb.a < 1));
    };
    field.addEventListener('pointermove', move);
    field.addEventListener('pointerup', up);
  });

  // The field is operable from the keyboard too: a colour surface that needs a
  // pointer is a colour surface a keyboard user cannot reach.
  field.addEventListener('keydown', (event) => {
    const step = event.shiftKey ? 0.1 : 0.01;
    let handled = true;
    if (event.key === 'ArrowRight') hsv = { ...hsv, s: Math.min(1, hsv.s + step) };
    else if (event.key === 'ArrowLeft') hsv = { ...hsv, s: Math.max(0, hsv.s - step) };
    else if (event.key === 'ArrowUp') hsv = { ...hsv, v: Math.min(1, hsv.v + step) };
    else if (event.key === 'ArrowDown') hsv = { ...hsv, v: Math.max(0, hsv.v - step) };
    else handled = false;
    if (!handled) return;
    event.preventDefault();
    rgb = { ...hsvToRgb(hsv), a: rgb.a };
    render();
  });

  hue.addEventListener('input', () => {
    hsv = { ...hsv, h: Number(hue.value) };
    rgb = { ...hsvToRgb(hsv), a: rgb.a };
    render();
  });

  alpha.addEventListener('input', () => {
    rgb = { ...rgb, a: Number(alpha.value) };
    render();
  });

  entry.addEventListener('change', () => applyText(entry.value, 'hex'));

  for (const name of namedColors()) {
    const swatch = el('button', {
      className: 'md-swatch',
      attrs: { type: 'button', 'aria-label': name, title: name, 'data-name': name }
    });
    swatch.style.background = name;
    swatch.addEventListener('click', () => applyText(name, 'named'));
    namedList.append(swatch);
  }

  body.append(
    field,
    hue,
    alpha,
    preview,
    entryWrap,
    warning,
    contrast,
    el('h3', { className: 'md-typescale-title-small', text: 'Every representation' }),
    translations,
    el('h3', { className: 'md-typescale-title-small', text: 'Recent' }),
    swatchRow,
    el('h3', { className: 'md-typescale-title-small', text: `Named colours (${COLOR_FORMATS.length} formats supported)` }),
    namedSearch.root,
    namedList
  );

  handle.body.append(body);
  remember(toHex(rgb, rgb.a < 1));
  render();
  handle.reposition();
  return handle;
}

export { formatColor };
