/**
 * The shipped logo presets.
 *
 * Each mark is drawn here as inline SVG geometry rather than shipped as an
 * image file. Three reasons, all of them practical:
 *
 * - Inline SVG inherits the page's custom properties, so a preset follows the
 *   user's seed colour, contrast level and theme instead of sitting in the
 *   chrome as a fixed-colour rectangle that stops matching the moment anything
 *   is customized.
 * - There is no file to fetch, so there is no network request, no CDN and no
 *   cache to go stale.
 * - It scales without conversion, which means the whole crop, fit and
 *   rasterization pipeline only exists for the custom upload path, where it is
 *   genuinely needed.
 *
 * Every mark is original geometry authored for this application. Nothing here
 * is traced from, or derived from, another project's logo.
 */

export interface LogoPreset {
  /** Stable id. Persisted in settings, so it is never renamed once shipped. */
  id: string;
  /** i18n key for the visible name. */
  labelKey: string;
  /** i18n key for the one-line description shown beside it in the picker. */
  descriptionKey: string;
  /** Search terms the picker matches in addition to the localized name. */
  keywords: string[];
  /** Builds the mark at the requested pixel size. Never fetches anything. */
  draw(size: number): SVGSVGElement;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

function svgRoot(size: number): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 48 48');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  return svg;
}

function path(d: string, fill: string, extra: Record<string, string> = {}): SVGPathElement {
  const node = document.createElementNS(SVG_NS, 'path');
  node.setAttribute('d', d);
  node.setAttribute('fill', fill);
  for (const [key, value] of Object.entries(extra)) node.setAttribute(key, value);
  return node;
}

function circle(cx: number, cy: number, r: number, fill: string, extra: Record<string, string> = {}): SVGCircleElement {
  const node = document.createElementNS(SVG_NS, 'circle');
  node.setAttribute('cx', String(cx));
  node.setAttribute('cy', String(cy));
  node.setAttribute('r', String(r));
  node.setAttribute('fill', fill);
  for (const [key, value] of Object.entries(extra)) node.setAttribute(key, value);
  return node;
}

function rect(
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fill: string,
  extra: Record<string, string> = {}
): SVGRectElement {
  const node = document.createElementNS(SVG_NS, 'rect');
  node.setAttribute('x', String(x));
  node.setAttribute('y', String(y));
  node.setAttribute('width', String(width));
  node.setAttribute('height', String(height));
  node.setAttribute('rx', String(radius));
  node.setAttribute('fill', fill);
  for (const [key, value] of Object.entries(extra)) node.setAttribute(key, value);
  return node;
}

const PRIMARY = 'var(--md-sys-color-primary)';
const ON_PRIMARY = 'var(--md-sys-color-on-primary)';
const TERTIARY = 'var(--md-sys-color-tertiary)';
const SECONDARY = 'var(--md-sys-color-secondary)';
const OUTLINE = 'var(--md-sys-color-outline)';

/* ------------------------------------------------------------------ */
/* The marks                                                           */
/* ------------------------------------------------------------------ */

/** An isometric block with a download arrow cut into its top face. */
function drawBlockDownload(size: number): SVGSVGElement {
  const svg = svgRoot(size);
  // Top face, then the two side faces, in three tones so the cube reads at 16px.
  svg.append(
    path('M24 4 44 14 24 24 4 14z', PRIMARY),
    path('M4 14 24 24v20L4 34z', SECONDARY, { 'fill-opacity': '0.85' }),
    path('M44 14 24 24v20l20-10z', TERTIARY, { 'fill-opacity': '0.85' }),
    path('M22 9h4v5h4l-6 6-6-6h4z', ON_PRIMARY)
  );
  return svg;
}

/** A globe with a meridian pair and a descending arrow beside it. */
function drawWorldArrow(size: number): SVGSVGElement {
  const svg = svgRoot(size);
  svg.append(
    circle(21, 22, 15, PRIMARY),
    path('M21 7c-4 4-6 9-6 15s2 11 6 15c4-4 6-9 6-15s-2-11-6-15z', ON_PRIMARY, { 'fill-opacity': '0.55' }),
    rect(7, 20.5, 28, 3, 1.5, ON_PRIMARY, { 'fill-opacity': '0.55' }),
    path('M38 24h-5l7 9 7-9h-5v-9h-4z', TERTIARY)
  );
  return svg;
}

/** A four-by-four chunk grid with the loaded quadrant filled in. */
function drawChunkGrid(size: number): SVGSVGElement {
  const svg = svgRoot(size);
  svg.append(rect(5, 5, 38, 38, 6, PRIMARY, { 'fill-opacity': '0.18' }));
  const cell = 8.5;
  const origin = 7.5;
  for (let row = 0; row < 4; row += 1) {
    for (let column = 0; column < 4; column += 1) {
      const loaded = row < 2 && column < 2;
      const nearly = row + column === 2;
      svg.append(
        rect(
          origin + column * cell,
          origin + row * cell,
          cell - 1.5,
          cell - 1.5,
          1.5,
          loaded ? PRIMARY : nearly ? TERTIARY : OUTLINE,
          { 'fill-opacity': loaded ? '1' : nearly ? '0.75' : '0.35' }
        )
      );
    }
  }
  return svg;
}

/** A compass rose: four points, a filled north, and a ring. */
function drawCompass(size: number): SVGSVGElement {
  const svg = svgRoot(size);
  const ring = document.createElementNS(SVG_NS, 'circle');
  ring.setAttribute('cx', '24');
  ring.setAttribute('cy', '24');
  ring.setAttribute('r', '18');
  ring.setAttribute('fill', 'none');
  ring.setAttribute('stroke', OUTLINE);
  ring.setAttribute('stroke-width', '3');
  svg.append(
    ring,
    path('M24 6 30 24 24 20 18 24z', PRIMARY),
    path('M24 42 18 24 24 28 30 24z', SECONDARY, { 'fill-opacity': '0.8' }),
    circle(24, 24, 3.5, TERTIARY)
  );
  return svg;
}

/** A folded map with a route across it and a pin at the destination. */
function drawMapPin(size: number): SVGSVGElement {
  const svg = svgRoot(size);
  svg.append(
    path('M6 12 18 8v28L6 40z', SECONDARY, { 'fill-opacity': '0.7' }),
    path('M18 8l12 4v28l-12-4z', PRIMARY, { 'fill-opacity': '0.35' }),
    path('M30 12l12-4v28l-12 4z', SECONDARY, { 'fill-opacity': '0.5' }),
    path('M28 14a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7z', TERTIARY),
    circle(28, 21, 2.8, ON_PRIMARY)
  );
  return svg;
}

/** A monogram: the two initials of the application, on a rounded plate. */
function drawMonogram(size: number): SVGSVGElement {
  const svg = svgRoot(size);
  svg.append(rect(4, 4, 40, 40, 12, PRIMARY));
  const text = document.createElementNS(SVG_NS, 'text');
  text.setAttribute('x', '24');
  text.setAttribute('y', '31');
  text.setAttribute('text-anchor', 'middle');
  text.setAttribute('font-size', '18');
  text.setAttribute('font-weight', '700');
  text.setAttribute('font-family', 'var(--md-sys-typeface-plain)');
  text.setAttribute('fill', ON_PRIMARY);
  text.textContent = 'WD';
  svg.append(text);
  return svg;
}

/** A stack of saved regions, drawn as three offset plates. */
function drawRegionStack(size: number): SVGSVGElement {
  const svg = svgRoot(size);
  svg.append(
    rect(8, 30, 32, 8, 3, OUTLINE, { 'fill-opacity': '0.45' }),
    rect(6, 20, 36, 9, 3, SECONDARY, { 'fill-opacity': '0.8' }),
    rect(4, 9, 40, 10, 3, PRIMARY),
    circle(38, 34, 5, TERTIARY),
    path('M36 32h4v3h-4z', ON_PRIMARY)
  );
  return svg;
}

/* ------------------------------------------------------------------ */
/* The catalogue                                                       */
/* ------------------------------------------------------------------ */

export const PRESETS: readonly LogoPreset[] = [
  {
    id: 'block-download',
    labelKey: 'appLogo.preset.blockDownload',
    descriptionKey: 'appLogo.preset.blockDownload.description',
    keywords: ['block', 'cube', 'download', 'arrow', 'isometric'],
    draw: drawBlockDownload
  },
  {
    id: 'world-arrow',
    labelKey: 'appLogo.preset.worldArrow',
    descriptionKey: 'appLogo.preset.worldArrow.description',
    keywords: ['world', 'globe', 'planet', 'arrow', 'download'],
    draw: drawWorldArrow
  },
  {
    id: 'chunk-grid',
    labelKey: 'appLogo.preset.chunkGrid',
    descriptionKey: 'appLogo.preset.chunkGrid.description',
    keywords: ['chunk', 'grid', 'region', 'tiles', 'progress'],
    draw: drawChunkGrid
  },
  {
    id: 'compass',
    labelKey: 'appLogo.preset.compass',
    descriptionKey: 'appLogo.preset.compass.description',
    keywords: ['compass', 'rose', 'north', 'navigation'],
    draw: drawCompass
  },
  {
    id: 'map-pin',
    labelKey: 'appLogo.preset.mapPin',
    descriptionKey: 'appLogo.preset.mapPin.description',
    keywords: ['map', 'pin', 'route', 'location', 'fold'],
    draw: drawMapPin
  },
  {
    id: 'region-stack',
    labelKey: 'appLogo.preset.regionStack',
    descriptionKey: 'appLogo.preset.regionStack.description',
    keywords: ['region', 'stack', 'saved', 'files', 'layers'],
    draw: drawRegionStack
  },
  {
    id: 'monogram',
    labelKey: 'appLogo.preset.monogram',
    descriptionKey: 'appLogo.preset.monogram.description',
    keywords: ['monogram', 'initials', 'letters', 'plate', 'wd'],
    draw: drawMonogram
  }
];

export const DEFAULT_PRESET_ID = 'block-download';

export function presetById(id: string): LogoPreset | null {
  return PRESETS.find((preset) => preset.id === id) ?? null;
}
