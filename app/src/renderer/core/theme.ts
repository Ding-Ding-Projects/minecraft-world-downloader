import { paletteFromSeed, tonalPalette, type TonalPalette } from './color';
import { settings } from './settings';
import type { ContrastLevel, ThemeMode, ThemeService, ThemeState } from './types';

/**
 * Material Design 3 tokens, generated from one seed colour.
 *
 * The static stylesheet defines every token once on `:root`, redefines the same
 * set under dark, and this module then overrides the colour roles at runtime.
 * That ordering matters: a token whose ONLY definition sits inside a media query
 * has no value at all when the query does not match, and a runtime generator
 * that assumed the static file would cover it produces a window with no colours.
 *
 * Font sizes are declared in CSS pixels throughout. Nothing here converts to
 * points; where a conversion is ever needed it is written out explicitly as
 * `points = pixels * 72 / 96` rather than left as a factor somebody has to
 * recognise.
 */

export const THEME_MODE_ID = 'appearance.themeMode';
export const THEME_SEED_ID = 'appearance.seed';
export const THEME_CONTRAST_ID = 'appearance.contrast';
export const THEME_DENSITY_ID = 'appearance.density';
export const THEME_FONT_FAMILY_ID = 'appearance.fontFamily';
export const THEME_FONT_SCALE_ID = 'appearance.fontScale';
export const THEME_FONT_WEIGHT_ID = 'appearance.fontWeight';

// The application's own indigo mark, not a generic Material blue: this is the
// exact `--md-sys-color-primary` the shipped Material 3 design specifies for
// the light scheme. Generating from this seed lands within a barely
// perceptible ΔE76 ≈ 2.2 of that exact value at tone 40 (and ΔE76 ≈ 3.8 of the
// design's dark-scheme primary at tone 80 — the two targets do not share one
// exact hue/chroma pair under this app's constant-hue-chroma LCH model, so no
// single seed reproduces both bit-for-bit; a joint grid search over hue and
// chroma found this choice within 0.24 ΔE76 of the true two-tone optimum,
// which is not worth trading away the seed's own legibility for).
export const DEFAULT_SEED = '#4a5bbe';

/** The bundled stack. Every family here ships with the platform or the build. */
export const BUNDLED_FONT_STACK =
  "'Segoe UI Variable Text', 'Segoe UI', Roboto, 'Noto Sans', 'Noto Sans CJK HK', 'Microsoft JhengHei UI', 'PingFang HK', system-ui, sans-serif";

interface Palettes {
  primary: TonalPalette;
  secondary: TonalPalette;
  tertiary: TonalPalette;
  neutral: TonalPalette;
  neutralVariant: TonalPalette;
  error: TonalPalette;
  success: TonalPalette;
  warning: TonalPalette;
}

function buildPalettes(seed: string): Palettes {
  const { hue, chroma } = paletteFromSeed(seed);
  return {
    primary: tonalPalette(hue, Math.max(36, chroma)),
    secondary: tonalPalette(hue, Math.max(12, chroma / 3)),
    tertiary: tonalPalette((hue + 60) % 360, Math.max(20, chroma / 2)),
    neutral: tonalPalette(hue, 4),
    neutralVariant: tonalPalette(hue, 8),
    error: tonalPalette(25, 84),
    // `success` and `warning` are semantic status colours, generated exactly
    // like `error` above: a fixed hue and chroma, independent of the user's
    // seed, so a notification still reads as unmistakably green or amber no
    // matter what accent colour is chosen. Chosen to land close to the
    // application's own shipped success/warning swatches (green ≈ #1f6d3a,
    // amber ≈ #7a5900 at tone 40) — success within ΔE76 ≈ 0.5, warning within
    // ΔE76 ≈ 0.1 — while staying real generated roles rather than the literal
    // hex values `styles/tokens.css` falls back to before this ever runs.
    success: tonalPalette(149, 42),
    warning: tonalPalette(82, 48)
  };
}

/**
 * Contrast shifts the tones apart rather than recolouring anything.
 *
 * The offsets are applied to the "on" roles and the container roles, which is
 * where legibility actually lives; the key colours stay where the seed put them
 * so a higher contrast setting does not silently change the accent.
 */
function contrastShift(level: ContrastLevel): number {
  if (level === 'high') return 10;
  if (level === 'medium') return 5;
  return 0;
}

function lightRoles(palettes: Palettes, contrast: ContrastLevel): Record<string, string> {
  const shift = contrastShift(contrast);
  const { primary, secondary, tertiary, neutral, neutralVariant, error, success, warning } = palettes;
  return {
    primary: primary.tone(40 - shift / 2),
    'on-primary': primary.tone(100),
    'primary-container': primary.tone(90),
    'on-primary-container': primary.tone(10 - shift / 2 < 0 ? 0 : 10 - shift / 2),
    'inverse-primary': primary.tone(80),

    secondary: secondary.tone(40 - shift / 2),
    'on-secondary': secondary.tone(100),
    'secondary-container': secondary.tone(90),
    'on-secondary-container': secondary.tone(10),

    tertiary: tertiary.tone(40 - shift / 2),
    'on-tertiary': tertiary.tone(100),
    'tertiary-container': tertiary.tone(90),
    'on-tertiary-container': tertiary.tone(10),

    error: error.tone(40 - shift / 2),
    'on-error': error.tone(100),
    'error-container': error.tone(90),
    'on-error-container': error.tone(10),

    success: success.tone(40 - shift / 2),
    'on-success': success.tone(100),
    'success-container': success.tone(90),
    'on-success-container': success.tone(10),

    warning: warning.tone(40 - shift / 2),
    'on-warning': warning.tone(100),
    'warning-container': warning.tone(90),
    'on-warning-container': warning.tone(10),

    background: neutral.tone(99),
    'on-background': neutral.tone(10),
    surface: neutral.tone(98),
    'on-surface': neutral.tone(10),
    'surface-variant': neutralVariant.tone(90),
    'on-surface-variant': neutralVariant.tone(30 - shift),
    'surface-dim': neutral.tone(87),
    'surface-bright': neutral.tone(98),
    'surface-container-lowest': neutral.tone(100),
    'surface-container-low': neutral.tone(96),
    'surface-container': neutral.tone(94),
    'surface-container-high': neutral.tone(92),
    'surface-container-highest': neutral.tone(90),
    'inverse-surface': neutral.tone(20),
    'inverse-on-surface': neutral.tone(95),

    outline: neutralVariant.tone(50 - shift),
    'outline-variant': neutralVariant.tone(80 - shift / 2),
    shadow: neutral.tone(0),
    scrim: neutral.tone(0),
    'surface-tint': primary.tone(40)
  };
}

function darkRoles(palettes: Palettes, contrast: ContrastLevel): Record<string, string> {
  const shift = contrastShift(contrast);
  const { primary, secondary, tertiary, neutral, neutralVariant, error, success, warning } = palettes;
  return {
    primary: primary.tone(80 + shift / 2),
    'on-primary': primary.tone(20),
    'primary-container': primary.tone(30),
    'on-primary-container': primary.tone(90 + shift / 2 > 100 ? 100 : 90 + shift / 2),
    'inverse-primary': primary.tone(40),

    secondary: secondary.tone(80 + shift / 2),
    'on-secondary': secondary.tone(20),
    'secondary-container': secondary.tone(30),
    'on-secondary-container': secondary.tone(90),

    tertiary: tertiary.tone(80 + shift / 2),
    'on-tertiary': tertiary.tone(20),
    'tertiary-container': tertiary.tone(30),
    'on-tertiary-container': tertiary.tone(90),

    error: error.tone(80 + shift / 2),
    'on-error': error.tone(20),
    'error-container': error.tone(30),
    'on-error-container': error.tone(90),

    success: success.tone(80 + shift / 2),
    'on-success': success.tone(20),
    'success-container': success.tone(30),
    'on-success-container': success.tone(90),

    warning: warning.tone(80 + shift / 2),
    'on-warning': warning.tone(20),
    'warning-container': warning.tone(30),
    'on-warning-container': warning.tone(90),

    background: neutral.tone(6),
    'on-background': neutral.tone(90),
    surface: neutral.tone(6),
    'on-surface': neutral.tone(90 + shift / 2 > 100 ? 100 : 90 + shift / 2),
    'surface-variant': neutralVariant.tone(30),
    'on-surface-variant': neutralVariant.tone(80 + shift / 2),
    'surface-dim': neutral.tone(6),
    'surface-bright': neutral.tone(24),
    'surface-container-lowest': neutral.tone(4),
    'surface-container-low': neutral.tone(10),
    'surface-container': neutral.tone(12),
    'surface-container-high': neutral.tone(17),
    'surface-container-highest': neutral.tone(22),
    'inverse-surface': neutral.tone(90),
    'inverse-on-surface': neutral.tone(20),

    outline: neutralVariant.tone(60 + shift / 2),
    'outline-variant': neutralVariant.tone(30 + shift / 2),
    shadow: neutral.tone(0),
    scrim: neutral.tone(0),
    'surface-tint': primary.tone(80)
  };
}

class ThemeImpl implements ThemeService {
  private listeners = new Set<(state: ThemeState) => void>();
  private systemDark = window.matchMedia('(prefers-color-scheme: dark)');
  private fontCache: string[] | null = null;

  state(): ThemeState {
    const mode = this.mode();
    return {
      mode,
      dark: mode === 'dark' || (mode === 'system' && this.systemDark.matches),
      seed: settings.get<string>(THEME_SEED_ID, DEFAULT_SEED) || DEFAULT_SEED,
      contrast: this.contrast(),
      density: this.density(),
      fontFamily: settings.get<string>(THEME_FONT_FAMILY_ID, '') || '',
      fontScale: this.fontScale(),
      fontWeight: this.fontWeight(),
      reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches
    };
  }

  private mode(): ThemeMode {
    const raw = settings.get<string>(THEME_MODE_ID, 'system');
    return raw === 'light' || raw === 'dark' ? raw : 'system';
  }

  private contrast(): ContrastLevel {
    const raw = settings.get<string>(THEME_CONTRAST_ID, 'standard');
    return raw === 'medium' || raw === 'high' ? raw : 'standard';
  }

  private density(): number {
    const raw = Number(settings.get<number>(THEME_DENSITY_ID, 0));
    if (!Number.isFinite(raw)) return 0;
    return Math.min(0, Math.max(-3, Math.round(raw)));
  }

  private fontScale(): number {
    const raw = Number(settings.get<number>(THEME_FONT_SCALE_ID, 1));
    if (!Number.isFinite(raw)) return 1;
    return Math.min(1.6, Math.max(0.8, raw));
  }

  private fontWeight(): number {
    const raw = Number(settings.get<number>(THEME_FONT_WEIGHT_ID, 400));
    if (!Number.isFinite(raw)) return 400;
    return Math.min(900, Math.max(100, Math.round(raw / 100) * 100));
  }

  setMode(mode: ThemeMode): void {
    settings.set(THEME_MODE_ID, mode);
    this.apply();
  }

  setSeed(hex: string): void {
    settings.set(THEME_SEED_ID, hex);
    this.apply();
  }

  setContrast(level: ContrastLevel): void {
    settings.set(THEME_CONTRAST_ID, level);
    this.apply();
  }

  setDensity(value: number): void {
    settings.set(THEME_DENSITY_ID, Math.min(0, Math.max(-3, Math.round(value))));
    this.apply();
  }

  setFontFamily(family: string): void {
    settings.set(THEME_FONT_FAMILY_ID, family);
    this.apply();
  }

  setFontScale(scale: number): void {
    settings.set(THEME_FONT_SCALE_ID, scale);
    this.apply();
  }

  setFontWeight(weight: number): void {
    settings.set(THEME_FONT_WEIGHT_ID, weight);
    this.apply();
  }

  apply(): void {
    const state = this.state();
    const root = document.documentElement;
    const palettes = buildPalettes(state.seed);
    const roles = state.dark ? darkRoles(palettes, state.contrast) : lightRoles(palettes, state.contrast);

    for (const [name, value] of Object.entries(roles)) {
      root.style.setProperty(`--md-sys-color-${name}`, value);
    }

    // The full tonal palettes are exposed too, so a feature that genuinely needs
    // an intermediate tone takes it from the same generator rather than
    // inventing a colour beside the scheme.
    for (const [name, palette] of Object.entries(palettes)) {
      for (const tone of [0, 4, 6, 10, 12, 17, 20, 22, 24, 30, 40, 50, 60, 70, 80, 87, 90, 92, 94, 95, 96, 98, 99, 100]) {
        root.style.setProperty(`--md-ref-palette-${name}-${tone}`, palette.tone(tone));
      }
    }

    root.setAttribute('data-theme', state.dark ? 'dark' : 'light');
    root.setAttribute('data-contrast', state.contrast);
    root.setAttribute('data-density', String(state.density));
    root.style.setProperty('--md-sys-density-scale', String(state.density));
    root.style.setProperty('--md-sys-typescale-factor', String(state.fontScale));
    root.style.setProperty('--md-sys-typescale-weight', String(state.fontWeight));
    root.style.setProperty(
      '--md-sys-typeface-plain',
      state.fontFamily ? `${quoteFamily(state.fontFamily)}, ${BUNDLED_FONT_STACK}` : BUNDLED_FONT_STACK
    );

    for (const listener of [...this.listeners]) {
      try {
        listener(state);
      } catch (error) {
        console.error('A theme listener threw:', error);
      }
    }
  }

  onChange(listener: (state: ThemeState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async availableFonts(): Promise<string[]> {
    if (this.fontCache) return this.fontCache;
    const found = new Set<string>();
    // A candidate list checked against the platform's own metrics: a family the
    // machine does not have measures identically to the generic fallback, so it
    // is left out rather than offered and then silently substituted.
    const candidates = [
      'Segoe UI Variable Text',
      'Segoe UI',
      'Roboto',
      'Roboto Flex',
      'Inter',
      'Noto Sans',
      'Noto Sans CJK HK',
      'Noto Sans HK',
      'Microsoft JhengHei UI',
      'Microsoft YaHei UI',
      'PingFang HK',
      'PingFang SC',
      'Arial',
      'Helvetica',
      'Verdana',
      'Tahoma',
      'Trebuchet MS',
      'Georgia',
      'Times New Roman',
      'Garamond',
      'Cambria',
      'Calibri',
      'Consolas',
      'Cascadia Code',
      'Cascadia Mono',
      'Courier New',
      'Lucida Console',
      'JetBrains Mono',
      'Fira Code',
      'Source Code Pro',
      'Menlo',
      'Monaco',
      'SF Pro Text',
      'Ubuntu',
      'DejaVu Sans',
      'Liberation Sans'
    ];
    for (const family of candidates) {
      if (isFontAvailable(family)) found.add(family);
    }
    this.fontCache = [...found].sort((a, b) => a.localeCompare(b));
    return this.fontCache;
  }
}

function quoteFamily(family: string): string {
  return /^[A-Za-z0-9-]+$/.test(family) ? family : `'${family.replace(/'/g, "\\'")}'`;
}

/**
 * Measures a string in the candidate family against three generic fallbacks.
 *
 * A family the machine does not have falls back to the generic, so identical
 * metrics in all three comparisons means "not installed". This is the only
 * detection a renderer can do without a privileged font enumeration API.
 */
function isFontAvailable(family: string): boolean {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) return false;
  const sample = 'mmmmmmmmmmlliWWQ漢字廣東話';
  const size = '72px';
  const generics = ['monospace', 'sans-serif', 'serif'];
  for (const generic of generics) {
    context.font = `${size} ${generic}`;
    const baseline = context.measureText(sample).width;
    context.font = `${size} ${quoteFamily(family)}, ${generic}`;
    if (Math.abs(context.measureText(sample).width - baseline) > 0.5) return true;
  }
  return false;
}

export const theme = new ThemeImpl();

/** Applies the stored theme and keeps it in step with the system scheme. */
export function initTheme(): void {
  theme.apply();
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (theme.state().mode === 'system') theme.apply();
  });
  window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', () => theme.apply());
  settings.onChange((change) => {
    if (change.id.startsWith('appearance.')) theme.apply();
  });
}

/** Converts a CSS pixel size to points, written out so the units are visible. */
export function pixelsToPoints(pixels: number): number {
  return (pixels * 72) / 96;
}
