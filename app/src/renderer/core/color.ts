/**
 * Colour science, implemented here rather than pulled from a package.
 *
 * The application bundles every asset locally and takes no runtime dependency it
 * does not need, so the tonal palettes behind the Material colour roles and the
 * translator behind the infinite colour picker are both computed from these
 * functions.
 *
 * The tonal model is CIELAB/LCH rather than CAM16-HCT. That is stated plainly
 * because it matters: tones are perceptual lightness in L*, and a requested
 * chroma is reduced until the colour is inside the sRGB gamut, which is the same
 * shape of construction Material uses without claiming to be bit-identical to it.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface Lab {
  l: number;
  a: number;
  b: number;
}

export interface Lch {
  l: number;
  c: number;
  h: number;
}

export interface Hsl {
  h: number;
  s: number;
  l: number;
}

export interface Hsv {
  h: number;
  s: number;
  v: number;
}

export interface Hwb {
  h: number;
  w: number;
  b: number;
}

export interface Cmyk {
  c: number;
  m: number;
  y: number;
  k: number;
}

const clamp = (value: number, min = 0, max = 1): number => Math.min(max, Math.max(min, value));
const round = (value: number, places = 2): number => Number.parseFloat(value.toFixed(places));

/* ------------------------------------------------------------------ */
/* Parsing and formatting                                              */
/* ------------------------------------------------------------------ */

const NAMED: Record<string, string> = {
  black: '#000000',
  white: '#ffffff',
  red: '#ff0000',
  lime: '#00ff00',
  blue: '#0000ff',
  yellow: '#ffff00',
  cyan: '#00ffff',
  magenta: '#ff00ff',
  silver: '#c0c0c0',
  gray: '#808080',
  grey: '#808080',
  maroon: '#800000',
  olive: '#808000',
  green: '#008000',
  purple: '#800080',
  teal: '#008080',
  navy: '#000080',
  orange: '#ffa500',
  pink: '#ffc0cb',
  brown: '#a52a2a',
  gold: '#ffd700',
  indigo: '#4b0082',
  violet: '#ee82ee',
  turquoise: '#40e0d0',
  salmon: '#fa8072',
  coral: '#ff7f50',
  crimson: '#dc143c',
  transparent: '#00000000'
};

/** The named colours the translator understands, for the picker's own list. */
export function namedColors(): string[] {
  return Object.keys(NAMED).sort();
}

export function parseColor(input: string): Rgb | null {
  const value = String(input ?? '').trim().toLowerCase();
  if (value === '') return null;

  const named = NAMED[value];
  if (named) return parseColor(named);

  const hex = value.startsWith('#') ? value.slice(1) : /^[0-9a-f]{3,8}$/.test(value) ? value : null;
  if (hex) {
    if (hex.length === 3 || hex.length === 4) {
      const parts = [...hex].map((character) => Number.parseInt(character + character, 16));
      return { r: parts[0], g: parts[1], b: parts[2], a: parts.length === 4 ? parts[3] / 255 : 1 };
    }
    if (hex.length === 6 || hex.length === 8) {
      const r = Number.parseInt(hex.slice(0, 2), 16);
      const g = Number.parseInt(hex.slice(2, 4), 16);
      const b = Number.parseInt(hex.slice(4, 6), 16);
      const a = hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) / 255 : 1;
      if ([r, g, b].some((part) => Number.isNaN(part))) return null;
      return { r, g, b, a };
    }
    return null;
  }

  const functional = value.match(/^([a-z]+)\(([^)]*)\)$/);
  if (!functional) return null;
  const name = functional[1];
  const parts = functional[2]
    .replace(/\//g, ' ')
    .split(/[\s,]+/)
    .filter((part) => part.length > 0);
  const number = (index: number, scale = 1): number => {
    const raw = parts[index];
    if (raw === undefined) return Number.NaN;
    if (raw.endsWith('%')) return (Number.parseFloat(raw) / 100) * scale;
    return Number.parseFloat(raw);
  };
  const alpha = (index: number): number => {
    const raw = parts[index];
    if (raw === undefined) return 1;
    return clamp(raw.endsWith('%') ? Number.parseFloat(raw) / 100 : Number.parseFloat(raw));
  };

  switch (name) {
    case 'rgb':
    case 'rgba':
      return {
        r: clamp(number(0, 255), 0, 255),
        g: clamp(number(1, 255), 0, 255),
        b: clamp(number(2, 255), 0, 255),
        a: alpha(3)
      };
    case 'hsl':
    case 'hsla':
      return { ...hslToRgb({ h: number(0), s: number(1, 100) / 100, l: number(2, 100) / 100 }), a: alpha(3) };
    case 'hsv':
    case 'hsb':
      return { ...hsvToRgb({ h: number(0), s: number(1, 100) / 100, v: number(2, 100) / 100 }), a: alpha(3) };
    case 'hwb':
      return { ...hwbToRgb({ h: number(0), w: number(1, 100) / 100, b: number(2, 100) / 100 }), a: alpha(3) };
    case 'lab':
      return { ...labToRgb({ l: number(0, 100), a: number(1), b: number(2) }), a: alpha(3) };
    case 'lch':
      return { ...lchToRgb({ l: number(0, 100), c: number(1), h: number(2) }), a: alpha(3) };
    case 'oklab':
      return { ...oklabToRgb({ l: number(0, 1), a: number(1), b: number(2) }), a: alpha(3) };
    case 'oklch':
      return { ...oklchToRgb({ l: number(0, 1), c: number(1), h: number(2) }), a: alpha(3) };
    case 'cmyk':
      return {
        ...cmykToRgb({ c: number(0, 100) / 100, m: number(1, 100) / 100, y: number(2, 100) / 100, k: number(3, 100) / 100 }),
        a: 1
      };
    default:
      return null;
  }
}

export function toHex(rgb: Rgb, withAlpha = false): string {
  const part = (value: number): string =>
    Math.round(clamp(value, 0, 255)).toString(16).padStart(2, '0');
  const base = `#${part(rgb.r)}${part(rgb.g)}${part(rgb.b)}`;
  if (!withAlpha && rgb.a >= 1) return base;
  return `${base}${part(clamp(rgb.a) * 255)}`;
}

export function toCssRgb(rgb: Rgb): string {
  const r = Math.round(clamp(rgb.r, 0, 255));
  const g = Math.round(clamp(rgb.g, 0, 255));
  const b = Math.round(clamp(rgb.b, 0, 255));
  return rgb.a >= 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${round(rgb.a, 3)})`;
}

/* ------------------------------------------------------------------ */
/* sRGB <-> linear <-> XYZ                                             */
/* ------------------------------------------------------------------ */

function srgbToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(channel: number): number {
  const c = channel <= 0.0031308 ? channel * 12.92 : 1.055 * channel ** (1 / 2.4) - 0.055;
  return clamp(c) * 255;
}

const WHITE_X = 95.047;
const WHITE_Y = 100;
const WHITE_Z = 108.883;

function rgbToXyz(rgb: Rgb): [number, number, number] {
  const r = srgbToLinear(rgb.r);
  const g = srgbToLinear(rgb.g);
  const b = srgbToLinear(rgb.b);
  return [
    (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) * 100,
    (r * 0.2126729 + g * 0.7151522 + b * 0.072175) * 100,
    (r * 0.0193339 + g * 0.119192 + b * 0.9503041) * 100
  ];
}

function xyzToRgb(x: number, y: number, z: number): Rgb {
  const xn = x / 100;
  const yn = y / 100;
  const zn = z / 100;
  const r = xn * 3.2404542 + yn * -1.5371385 + zn * -0.4985314;
  const g = xn * -0.969266 + yn * 1.8760108 + zn * 0.041556;
  const b = xn * 0.0556434 + yn * -0.2040259 + zn * 1.0572252;
  return { r: linearToSrgb(r), g: linearToSrgb(g), b: linearToSrgb(b), a: 1 };
}

/* ------------------------------------------------------------------ */
/* CIELAB and LCH                                                      */
/* ------------------------------------------------------------------ */

const LAB_EPSILON = 216 / 24389;
const LAB_KAPPA = 24389 / 27;

export function rgbToLab(rgb: Rgb): Lab {
  const [x, y, z] = rgbToXyz(rgb);
  const f = (value: number): number => (value > LAB_EPSILON ? Math.cbrt(value) : (LAB_KAPPA * value + 16) / 116);
  const fx = f(x / WHITE_X);
  const fy = f(y / WHITE_Y);
  const fz = f(z / WHITE_Z);
  return { l: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

export function labToRgb(lab: Lab): Rgb {
  const fy = (lab.l + 16) / 116;
  const fx = fy + lab.a / 500;
  const fz = fy - lab.b / 200;
  const inverse = (value: number): number => {
    const cubed = value ** 3;
    return cubed > LAB_EPSILON ? cubed : (116 * value - 16) / LAB_KAPPA;
  };
  return xyzToRgb(inverse(fx) * WHITE_X, inverse(fy) * WHITE_Y, inverse(fz) * WHITE_Z);
}

export function labToLch(lab: Lab): Lch {
  const c = Math.hypot(lab.a, lab.b);
  let h = (Math.atan2(lab.b, lab.a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { l: lab.l, c, h };
}

export function lchToLab(lch: Lch): Lab {
  const radians = (lch.h * Math.PI) / 180;
  return { l: lch.l, a: Math.cos(radians) * lch.c, b: Math.sin(radians) * lch.c };
}

export function rgbToLch(rgb: Rgb): Lch {
  return labToLch(rgbToLab(rgb));
}

export function lchToRgb(lch: Lch): Rgb {
  return labToRgb(lchToLab(lch));
}

/* ------------------------------------------------------------------ */
/* OKLab and OKLCH                                                     */
/* ------------------------------------------------------------------ */

export function rgbToOklab(rgb: Rgb): Lab {
  const r = srgbToLinear(rgb.r);
  const g = srgbToLinear(rgb.g);
  const b = srgbToLinear(rgb.b);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return {
    l: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  };
}

export function oklabToRgb(lab: Lab): Rgb {
  const l = (lab.l + 0.3963377774 * lab.a + 0.2158037573 * lab.b) ** 3;
  const m = (lab.l - 0.1055613458 * lab.a - 0.0638541728 * lab.b) ** 3;
  const s = (lab.l - 0.0894841775 * lab.a - 1.291485548 * lab.b) ** 3;
  return {
    r: linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
    a: 1
  };
}

export function rgbToOklch(rgb: Rgb): Lch {
  return labToLch(rgbToOklab(rgb));
}

export function oklchToRgb(lch: Lch): Rgb {
  return oklabToRgb(lchToLab(lch));
}

/* ------------------------------------------------------------------ */
/* HSL, HSV, HWB, CMYK                                                 */
/* ------------------------------------------------------------------ */

export function rgbToHsl(rgb: Rgb): Hsl {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const delta = max - min;
  if (delta === 0) return { h: 0, s: 0, l };
  const s = delta / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === r) h = ((g - b) / delta) % 6;
  else if (max === g) h = (b - r) / delta + 2;
  else h = (r - g) / delta + 4;
  h *= 60;
  if (h < 0) h += 360;
  return { h, s, l };
}

export function hslToRgb(hsl: Hsl): Rgb {
  const h = ((hsl.h % 360) + 360) % 360;
  const s = clamp(hsl.s);
  const l = clamp(hsl.l);
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255, a: 1 };
}

export function rgbToHsv(rgb: Rgb): Hsv {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  if (delta !== 0) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : delta / max, v: max };
}

export function hsvToRgb(hsv: Hsv): Rgb {
  const l = hsv.v * (1 - hsv.s / 2);
  const s = l === 0 || l === 1 ? 0 : (hsv.v - l) / Math.min(l, 1 - l);
  return hslToRgb({ h: hsv.h, s, l });
}

export function rgbToHwb(rgb: Rgb): Hwb {
  const hsv = rgbToHsv(rgb);
  return { h: hsv.h, w: (1 - hsv.s) * hsv.v, b: 1 - hsv.v };
}

export function hwbToRgb(hwb: Hwb): Rgb {
  let w = clamp(hwb.w);
  let b = clamp(hwb.b);
  if (w + b > 1) {
    const scale = w + b;
    w /= scale;
    b /= scale;
  }
  const v = 1 - b;
  const s = v === 0 ? 0 : 1 - w / v;
  return hsvToRgb({ h: hwb.h, s, v });
}

export function rgbToCmyk(rgb: Rgb): Cmyk {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const k = 1 - Math.max(r, g, b);
  if (k === 1) return { c: 0, m: 0, y: 0, k: 1 };
  return { c: (1 - r - k) / (1 - k), m: (1 - g - k) / (1 - k), y: (1 - b - k) / (1 - k), k };
}

export function cmykToRgb(cmyk: Cmyk): Rgb {
  return {
    r: 255 * (1 - clamp(cmyk.c)) * (1 - clamp(cmyk.k)),
    g: 255 * (1 - clamp(cmyk.m)) * (1 - clamp(cmyk.k)),
    b: 255 * (1 - clamp(cmyk.y)) * (1 - clamp(cmyk.k)),
    a: 1
  };
}

/* ------------------------------------------------------------------ */
/* Contrast and gamut                                                  */
/* ------------------------------------------------------------------ */

export function relativeLuminance(rgb: Rgb): number {
  const r = srgbToLinear(rgb.r);
  const g = srgbToLinear(rgb.g);
  const b = srgbToLinear(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

export function inGamut(rgb: Rgb): boolean {
  const tolerance = 0.5;
  return (
    rgb.r >= -tolerance &&
    rgb.r <= 255 + tolerance &&
    rgb.g >= -tolerance &&
    rgb.g <= 255 + tolerance &&
    rgb.b >= -tolerance &&
    rgb.b <= 255 + tolerance
  );
}

/* ------------------------------------------------------------------ */
/* Tonal palettes                                                      */
/* ------------------------------------------------------------------ */

/**
 * One tone of a tonal palette.
 *
 * `tone` is L* from 0 (black) to 100 (white). The requested chroma is reduced by
 * bisection until the result is representable in sRGB, so a vivid seed stays
 * vivid where the gamut allows and degrades gracefully where it does not,
 * instead of clipping into a colour nobody chose.
 */
export function tonalColor(hue: number, chroma: number, tone: number): Rgb {
  const target = clamp(tone, 0, 100);
  if (target >= 100) return { r: 255, g: 255, b: 255, a: 1 };
  if (target <= 0) return { r: 0, g: 0, b: 0, a: 1 };

  const direct = lchToRgb({ l: target, c: chroma, h: hue });
  if (inGamut(direct)) return clampRgb(direct);

  let low = 0;
  let high = chroma;
  let best = lchToRgb({ l: target, c: 0, h: hue });
  for (let step = 0; step < 20; step += 1) {
    const mid = (low + high) / 2;
    const candidate = lchToRgb({ l: target, c: mid, h: hue });
    if (inGamut(candidate)) {
      best = candidate;
      low = mid;
    } else {
      high = mid;
    }
  }
  return clampRgb(best);
}

function clampRgb(rgb: Rgb): Rgb {
  return { r: clamp(rgb.r, 0, 255), g: clamp(rgb.g, 0, 255), b: clamp(rgb.b, 0, 255), a: rgb.a };
}

export interface TonalPalette {
  hue: number;
  chroma: number;
  tone(value: number): string;
}

export function tonalPalette(hue: number, chroma: number): TonalPalette {
  const cache = new Map<number, string>();
  return {
    hue,
    chroma,
    tone(value: number): string {
      const key = Math.round(value * 10) / 10;
      const cached = cache.get(key);
      if (cached) return cached;
      const hex = toHex(tonalColor(hue, chroma, key));
      cache.set(key, hex);
      return hex;
    }
  };
}

/** Derives the palette hue and chroma from a seed colour. */
export function paletteFromSeed(seed: string): { hue: number; chroma: number } {
  const rgb = parseColor(seed) ?? { r: 103, g: 80, b: 164, a: 1 };
  const lch = rgbToLch(rgb);
  return { hue: lch.h, chroma: Math.max(16, lch.c) };
}

/* ------------------------------------------------------------------ */
/* Translator                                                          */
/* ------------------------------------------------------------------ */

export type ColorFormat =
  | 'named'
  | 'hex'
  | 'hex8'
  | 'rgb'
  | 'rgba'
  | 'hsl'
  | 'hsla'
  | 'hsv'
  | 'hwb'
  | 'lab'
  | 'lch'
  | 'oklab'
  | 'oklch'
  | 'cmyk';

export const COLOR_FORMATS: ColorFormat[] = [
  'named',
  'hex',
  'hex8',
  'rgb',
  'rgba',
  'hsl',
  'hsla',
  'hsv',
  'hwb',
  'lab',
  'lch',
  'oklab',
  'oklch',
  'cmyk'
];

/**
 * Renders one colour in one representation.
 *
 * `named` returns the exact named colour only when there is one; otherwise it
 * says so rather than returning an approximate name, because an approximate
 * name is a colour the user did not choose.
 */
export function formatColor(rgb: Rgb, format: ColorFormat): string {
  switch (format) {
    case 'named': {
      const hex = toHex({ ...rgb, a: 1 }).toLowerCase();
      const found = Object.entries(NAMED).find(([, value]) => value.toLowerCase() === hex);
      return found ? found[0] : 'no exact named colour';
    }
    case 'hex':
      return toHex(rgb, false);
    case 'hex8':
      return toHex(rgb, true);
    case 'rgb':
      return `rgb(${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(rgb.b)})`;
    case 'rgba':
      return `rgba(${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(rgb.b)}, ${round(rgb.a, 3)})`;
    case 'hsl': {
      const hsl = rgbToHsl(rgb);
      return `hsl(${round(hsl.h, 1)} ${round(hsl.s * 100, 1)}% ${round(hsl.l * 100, 1)}%)`;
    }
    case 'hsla': {
      const hsl = rgbToHsl(rgb);
      return `hsla(${round(hsl.h, 1)} ${round(hsl.s * 100, 1)}% ${round(hsl.l * 100, 1)}% / ${round(rgb.a, 3)})`;
    }
    case 'hsv': {
      const hsv = rgbToHsv(rgb);
      return `hsv(${round(hsv.h, 1)} ${round(hsv.s * 100, 1)}% ${round(hsv.v * 100, 1)}%)`;
    }
    case 'hwb': {
      const hwb = rgbToHwb(rgb);
      return `hwb(${round(hwb.h, 1)} ${round(hwb.w * 100, 1)}% ${round(hwb.b * 100, 1)}%)`;
    }
    case 'lab': {
      const lab = rgbToLab(rgb);
      return `lab(${round(lab.l, 2)}% ${round(lab.a, 2)} ${round(lab.b, 2)})`;
    }
    case 'lch': {
      const lch = rgbToLch(rgb);
      return `lch(${round(lch.l, 2)}% ${round(lch.c, 2)} ${round(lch.h, 2)})`;
    }
    case 'oklab': {
      const lab = rgbToOklab(rgb);
      return `oklab(${round(lab.l, 4)} ${round(lab.a, 4)} ${round(lab.b, 4)})`;
    }
    case 'oklch': {
      const lch = rgbToOklch(rgb);
      return `oklch(${round(lch.l, 4)} ${round(lch.c, 4)} ${round(lch.h, 2)})`;
    }
    case 'cmyk': {
      const cmyk = rgbToCmyk(rgb);
      return `cmyk(${round(cmyk.c * 100, 1)}% ${round(cmyk.m * 100, 1)}% ${round(cmyk.y * 100, 1)}% ${round(cmyk.k * 100, 1)}%)`;
    }
    default:
      return toHex(rgb);
  }
}

/** Every representation of one colour, for the picker's translator panel. */
export function translate(rgb: Rgb): Array<{ format: ColorFormat; value: string }> {
  return COLOR_FORMATS.map((format) => ({ format, value: formatColor(rgb, format) }));
}
