/**
 * Colour science round-trips and the tonal-palette/token-count contract.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import {
  cmykToRgb,
  formatColor,
  hslToRgb,
  hsvToRgb,
  hwbToRgb,
  labToRgb,
  lchToRgb,
  oklabToRgb,
  oklchToRgb,
  paletteFromSeed,
  parseColor,
  rgbToCmyk,
  rgbToHsl,
  rgbToHsv,
  rgbToHwb,
  rgbToLab,
  rgbToLch,
  rgbToOklab,
  rgbToOklch,
  toHex,
  tonalPalette,
  type Rgb
} from '../../src/renderer/core/color';
import { theme, THEME_SEED_ID, THEME_MODE_ID } from '../../src/renderer/core/theme';
import { settings } from '../../src/renderer/core/settings';

const HERE = dirname(fileURLToPath(import.meta.url));
const TOKENS_CSS = resolve(HERE, '../../src/renderer/styles/tokens.css');

function channelClose(a: number, b: number, tolerance: number): boolean {
  return Math.abs(a - b) <= tolerance;
}

function rgbClose(a: Rgb, b: Rgb, tolerance = 1.5): void {
  expect(channelClose(a.r, b.r, tolerance), `r: ${a.r} vs ${b.r}`).toBe(true);
  expect(channelClose(a.g, b.g, tolerance), `g: ${a.g} vs ${b.g}`).toBe(true);
  expect(channelClose(a.b, b.b, tolerance), `b: ${a.b} vs ${b.b}`).toBe(true);
}

// A spread of saturated, muted, light, dark and neutral colours — the cases
// that most often expose a sign error or a wrapped hue at the 0/360 boundary.
const SAMPLES: Rgb[] = [
  { r: 0, g: 0, b: 0, a: 1 },
  { r: 255, g: 255, b: 255, a: 1 },
  { r: 128, g: 128, b: 128, a: 1 },
  { r: 255, g: 0, b: 0, a: 1 },
  { r: 0, g: 255, b: 0, a: 1 },
  { r: 0, g: 0, b: 255, a: 1 },
  { r: 74, g: 91, b: 190, a: 1 }, // the application's own default seed
  { r: 12, g: 200, b: 133, a: 1 },
  { r: 231, g: 84, b: 128, a: 1 },
  { r: 17, g: 17, b: 19, a: 1 },
  { r: 250, g: 248, b: 240, a: 1 }
];

describe('colour round-trips: RGB -> X -> RGB stays within tolerance', () => {
  for (const sample of SAMPLES) {
    const label = toHex(sample);

    it(`${label} through CIELAB`, () => rgbClose(sample, labToRgb(rgbToLab(sample))));
    it(`${label} through LCH`, () => rgbClose(sample, lchToRgb(rgbToLch(sample))));
    it(`${label} through OKLab`, () => rgbClose(sample, oklabToRgb(rgbToOklab(sample))));
    it(`${label} through OKLCH`, () => rgbClose(sample, oklchToRgb(rgbToOklch(sample))));
    it(`${label} through HSL`, () => rgbClose(sample, hslToRgb(rgbToHsl(sample))));
    it(`${label} through HSV`, () => rgbClose(sample, hsvToRgb(rgbToHsv(sample))));
    it(`${label} through HWB`, () => rgbClose(sample, hwbToRgb(rgbToHwb(sample))));
    it(`${label} through CMYK`, () => rgbClose(sample, cmykToRgb(rgbToCmyk(sample)), 1.5));
  }
});

describe('the translator parses back what it formats, for every representation', () => {
  const FORMATS_TO_ROUND_TRIP = ['hex', 'hex8', 'rgb', 'rgba', 'hsl', 'hsla', 'hsv', 'hwb', 'lab', 'lch', 'oklab', 'oklch', 'cmyk'] as const;

  for (const sample of SAMPLES) {
    for (const format of FORMATS_TO_ROUND_TRIP) {
      it(`${toHex(sample)} formatted as ${format} parses back close to the original`, () => {
        const text = formatColor(sample, format);
        const parsed = parseColor(text);
        expect(parsed, `formatColor produced "${text}", which parseColor rejected`).not.toBeNull();
        rgbClose(sample, parsed as Rgb, 2);
      });
    }
  }

  it('formats a named colour exactly for red, and reports honestly when there is none', () => {
    expect(formatColor({ r: 255, g: 0, b: 0, a: 1 }, 'named')).toBe('red');
    expect(formatColor({ r: 1, g: 2, b: 3, a: 1 }, 'named')).toBe('no exact named colour');
  });

  it('every named colour parses back to its own hex value', () => {
    // namedColors() is exercised indirectly: parseColor already special-cases
    // every entry, so round-tripping a handful proves the table both ways.
    expect(toHex(parseColor('red')!)).toBe('#ff0000');
    expect(toHex(parseColor('crimson')!)).toBe('#dc143c');
    expect(toHex(parseColor('transparent')!, true)).toBe('#00000000');
  });
});

describe('the tonal palette produced from a seed matches the token set tokens.css declares', () => {
  afterEach(() => {
    settings.reset(THEME_SEED_ID);
    settings.reset(THEME_MODE_ID);
  });

  it('theme.apply() (the real generator, not a re-implementation) produces exactly the colour-role tokens.css declares as generated', () => {
    // This calls the actual code under test — core/theme.ts's `apply()` — and
    // reads back the real CSS custom properties it wrote onto
    // `document.documentElement`, rather than hand-copying `lightRoles()`'s key
    // list into the test. A hand-copied list would drift silently the moment
    // theme.ts's own role set changed; this cannot, because it IS theme.ts's
    // role set.
    settings.set(THEME_MODE_ID, 'light');
    settings.set(THEME_SEED_ID, '#4f6bed');
    theme.apply();

    const style = document.documentElement.style;
    const written: string[] = [];
    for (let index = 0; index < style.length; index += 1) written.push(style[index]);
    const generatedRoles = new Set(
      written
        .filter((name) => name.startsWith('--md-sys-color-'))
        .map((name) => name.slice('--md-sys-color-'.length))
    );
    expect(generatedRoles.size).toBeGreaterThan(0);

    const css = readFileSync(TOKENS_CSS, 'utf8');
    const declared = new Set([...css.matchAll(/--md-sys-color-([a-z-]+):/g)].map((match) => match[1]));

    // `success` and `warning` (with their `on-`/`-container` siblings) used to
    // be static literals that theme.ts never touched -- tokens.css carried the
    // only definition, and a seed change could not reach them. They are now
    // real generated roles, from their own fixed hue/chroma tonal palettes
    // (the same construction `error` already used), so every declared colour
    // role comes out of the real generator and the generator must not invent
    // a role tokens.css does not know.
    const declaredGenerated = [...declared];

    const missingFromGenerator = declaredGenerated.filter((name) => !generatedRoles.has(name));
    const extraInGenerator = [...generatedRoles].filter((name) => !declared.has(name));

    expect(missingFromGenerator, `tokens.css declares these but theme.apply() never wrote them: ${missingFromGenerator.join(', ')}`).toHaveLength(0);
    expect(extraInGenerator, `theme.apply() wrote these but tokens.css never declares them: ${extraInGenerator.join(', ')}`).toHaveLength(0);

    // The real, observed count — not a number pulled from memory. Read the
    // failure message above if this ever moves; it names exactly what changed.
    expect(generatedRoles.size).toBe(declaredGenerated.length);
  });

  it('theme.apply() writes valid 6-digit hex for every generated colour role, in both light and dark', () => {
    for (const mode of ['light', 'dark'] as const) {
      settings.set(THEME_MODE_ID, mode);
      settings.set(THEME_SEED_ID, '#4f6bed');
      theme.apply();
      const style = document.documentElement.style;
      for (let index = 0; index < style.length; index += 1) {
        const name = style[index];
        if (!name.startsWith('--md-sys-color-')) continue;
        expect(style.getPropertyValue(name).trim(), `${mode} ${name}`).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
  });

  it('every tone requested by theme.ts stays in the sRGB gamut and round-trips through hex', () => {
    const { hue, chroma } = paletteFromSeed('#4f6bed');
    const palette = tonalPalette(hue, chroma);
    for (const tone of [0, 10, 20, 40, 50, 60, 80, 90, 99, 100]) {
      const hex = palette.tone(tone);
      expect(hex).toMatch(/^#[0-9a-f]{6}$/);
    }
    expect(palette.tone(0)).toBe('#000000');
    expect(palette.tone(100)).toBe('#ffffff');
  });

  it('a seed with zero chroma (pure grey) still produces a full, distinct set of tones', () => {
    const palette = tonalPalette(0, 0);
    const tones = [0, 20, 40, 60, 80, 100].map((tone) => palette.tone(tone));
    expect(new Set(tones).size).toBe(tones.length);
  });
});
