#!/usr/bin/env node
/**
 * World Downloader Studio — application mark generator.
 *
 * This script is the single source of the product's visual identity. It holds the
 * artwork geometry as named constants and emits, from that one description:
 *
 *   build/icon.svg                       the master vector source
 *   build/icon-{16,32,48,64,128,256}.png the raster set
 *   build/icon-24.png                    (the extra size Windows asks for in list views)
 *   build/icon.ico                       a real multi-resolution Windows icon container
 *   src/renderer/assets/logo.ts          the mark as an inline SVG string for the UI
 *   ../docs/images/icon-256.png          the copy the README and the site use
 *
 * Everything downstream comes from the same numbers, so the vector master, the
 * rasters, the packaged Windows icon and the mark drawn in the title bar cannot
 * drift apart. Re-run it after any change to the geometry or the palette:
 *
 *     node scripts/generate-icons.mjs
 *
 * There are no dependencies. The rasteriser, the PNG encoder and the ICO
 * container writer are all in this file, so the build needs no native module and
 * no network access to produce the icon.
 *
 * The mark itself is original work drawn for this project: an isometric cube —
 * the world chunk the application downloads — with a download arrow cut clean
 * through it so the backdrop shows through. It deliberately borrows nothing from
 * any game's trademarks, textures or branding.
 */

import { Buffer } from 'node:buffer';
import { deflateSync } from 'node:zlib';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(SCRIPT_DIR, '..');
const REPO_DIR = resolve(APP_DIR, '..');
const BUILD_DIR = join(APP_DIR, 'build');
const RENDERER_ASSETS_DIR = join(APP_DIR, 'src', 'renderer', 'assets');
const DOCS_IMAGES_DIR = join(REPO_DIR, 'docs', 'images');

/* ------------------------------------------------------------------------- *
 * 1. The artwork
 *
 * All coordinates are in a 512 x 512 design space. Every downstream size is a
 * scale of this one description, which is why the 16 px icon and the 256 px icon
 * are the same drawing rather than two drawings that resemble each other.
 * ------------------------------------------------------------------------- */

const CANVAS = 512;

/** Corner radius of the badge. At 16 px this lands on 3.5 px, which still reads as a rounded square. */
const BADGE_RADIUS = 112;

/**
 * The palette is drawn from the product's Material Design 3 scheme: the greens
 * are the primary family, the deep teal at the foot of the backdrop is the
 * tertiary family, which is the colour the live map surfaces use.
 */
const PALETTE = {
  backdropTop: '#0D8F4E',
  backdropBottom: '#00382C',
  faceTop: '#B6FFCE',
  faceLeft: '#62DE89',
  faceRight: '#22A85F',
  grid: '#0D8F4E',
  gridOpacity: 0.3
};

/**
 * The isometric cube. Six silhouette vertices plus the interior vertex where the
 * three visible faces meet. Half-width is 184 and the rhombus half-height is 104,
 * which is close enough to a true 30-degree isometric projection to read as one
 * while keeping every coordinate a whole number.
 *
 * The cube deliberately fills most of the badge. An earlier, politer version left
 * a wide margin and turned to porridge at 16 px, where the whole mark is the size
 * of a word's first letter; the silhouette has to be big enough to survive that.
 */
const CUBE = {
  top: [256, 52],
  upperLeft: [72, 156],
  upperRight: [440, 156],
  centre: [256, 260],
  lowerLeft: [72, 356],
  lowerRight: [440, 356],
  bottom: [256, 460]
};

const FACE_TOP = [CUBE.top, CUBE.upperRight, CUBE.centre, CUBE.upperLeft];
const FACE_LEFT = [CUBE.upperLeft, CUBE.centre, CUBE.bottom, CUBE.lowerLeft];
const FACE_RIGHT = [CUBE.centre, CUBE.upperRight, CUBE.lowerRight, CUBE.bottom];

/** The silhouette, used by the single-colour variant of the mark. */
const CUBE_OUTLINE = [
  CUBE.top,
  CUBE.upperRight,
  CUBE.lowerRight,
  CUBE.bottom,
  CUBE.lowerLeft,
  CUBE.upperLeft
];

/**
 * The download arrow. It is not drawn on top of the cube — it is filled with the
 * backdrop gradient, so it reads as a shape cut through the cube. That keeps the
 * mark to two tones at 16 px, where a third overlapping shape would turn to mush.
 */
const ARROW = [
  [212, 104],
  [300, 104],
  [300, 268],
  [350, 268],
  [256, 394],
  [162, 268],
  [212, 268]
];

/** Two faint lines across the top face, suggesting map grid squares. */
const GRID_STROKE_WIDTH = 7;
const GRID_LINES = [
  [midpoint(CUBE.top, CUBE.upperRight), midpoint(CUBE.upperLeft, CUBE.centre)],
  [midpoint(CUBE.top, CUBE.upperLeft), midpoint(CUBE.upperRight, CUBE.centre)]
];

function midpoint(a, b) {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

/**
 * A stroked line, expressed as the quadrilateral it covers. The rasteriser and
 * the SVG both consume the same four points, so a butt-capped stroke in one
 * cannot render differently from a polygon in the other.
 */
function strokeQuad([ax, ay], [bx, by], width) {
  const dx = bx - ax;
  const dy = by - ay;
  const length = Math.hypot(dx, dy);
  if (length === 0) {
    return [
      [ax, ay],
      [ax, ay],
      [ax, ay],
      [ax, ay]
    ];
  }
  const nx = (-dy / length) * (width / 2);
  const ny = (dx / length) * (width / 2);
  return [
    [ax + nx, ay + ny],
    [bx + nx, by + ny],
    [bx - nx, by - ny],
    [ax - nx, ay - ny]
  ];
}

const GRID_QUADS = GRID_LINES.map(([a, b]) => strokeQuad(a, b, GRID_STROKE_WIDTH));

/* ------------------------------------------------------------------------- *
 * 2. Colour helpers
 * ------------------------------------------------------------------------- */

function parseHex(hex) {
  const value = hex.replace('#', '');
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16)
  };
}

const BACKDROP_TOP_RGB = parseHex(PALETTE.backdropTop);
const BACKDROP_BOTTOM_RGB = parseHex(PALETTE.backdropBottom);
const FACE_TOP_RGB = parseHex(PALETTE.faceTop);
const FACE_LEFT_RGB = parseHex(PALETTE.faceLeft);
const FACE_RIGHT_RGB = parseHex(PALETTE.faceRight);
const GRID_RGB = parseHex(PALETTE.grid);

/** The backdrop gradient, evaluated at a design-space y. */
function backdropAt(y) {
  const t = Math.min(1, Math.max(0, y / CANVAS));
  return {
    r: BACKDROP_TOP_RGB.r + (BACKDROP_BOTTOM_RGB.r - BACKDROP_TOP_RGB.r) * t,
    g: BACKDROP_TOP_RGB.g + (BACKDROP_BOTTOM_RGB.g - BACKDROP_TOP_RGB.g) * t,
    b: BACKDROP_TOP_RGB.b + (BACKDROP_BOTTOM_RGB.b - BACKDROP_TOP_RGB.b) * t
  };
}

/* ------------------------------------------------------------------------- *
 * 3. Geometry tests
 * ------------------------------------------------------------------------- */

function insideBadge(x, y) {
  if (x < 0 || y < 0 || x > CANVAS || y > CANVAS) return false;
  const cx = Math.min(Math.max(x, BADGE_RADIUS), CANVAS - BADGE_RADIUS);
  const cy = Math.min(Math.max(y, BADGE_RADIUS), CANVAS - BADGE_RADIUS);
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= BADGE_RADIUS * BADGE_RADIUS;
}

/** Ray casting, so it is correct for the concave arrow as well as the convex faces. */
function insidePolygon(points, x, y) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

/* ------------------------------------------------------------------------- *
 * 4. Rasteriser
 *
 * Supersampled painter's algorithm. Each output pixel averages an SS x SS grid of
 * subsamples, each of which is composited through the same layer order the SVG
 * uses. That is where the anti-aliasing comes from; there is no separate edge
 * pass to get subtly wrong.
 * ------------------------------------------------------------------------- */

function supersampleFactor(size) {
  return Math.max(4, Math.min(16, Math.ceil(768 / size)));
}

function renderRgba(size) {
  const ss = supersampleFactor(size);
  const scale = CANVAS / size;
  const pixels = new Uint8Array(size * size * 4);
  const samplesPerPixel = ss * ss;

  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      let accR = 0;
      let accG = 0;
      let accB = 0;
      let accA = 0;

      for (let sy = 0; sy < ss; sy += 1) {
        const y = (py + (sy + 0.5) / ss) * scale;
        for (let sx = 0; sx < ss; sx += 1) {
          const x = (px + (sx + 0.5) / ss) * scale;

          // Layer 0: nothing. Outside the badge the icon is transparent.
          let r = 0;
          let g = 0;
          let b = 0;
          let a = 0;

          // `over` composites a source colour with the accumulated colour, in
          // straight (non-premultiplied) form.
          const over = (sr, sg, sb, sa) => {
            const outA = sa + a * (1 - sa);
            if (outA <= 0) {
              r = 0;
              g = 0;
              b = 0;
              a = 0;
              return;
            }
            r = (sr * sa + r * a * (1 - sa)) / outA;
            g = (sg * sa + g * a * (1 - sa)) / outA;
            b = (sb * sa + b * a * (1 - sa)) / outA;
            a = outA;
          };

          if (insideBadge(x, y)) {
            const backdrop = backdropAt(y);
            over(backdrop.r, backdrop.g, backdrop.b, 1);

            const onTopFace = insidePolygon(FACE_TOP, x, y);
            if (onTopFace) {
              over(FACE_TOP_RGB.r, FACE_TOP_RGB.g, FACE_TOP_RGB.b, 1);
            } else if (insidePolygon(FACE_LEFT, x, y)) {
              over(FACE_LEFT_RGB.r, FACE_LEFT_RGB.g, FACE_LEFT_RGB.b, 1);
            } else if (insidePolygon(FACE_RIGHT, x, y)) {
              over(FACE_RIGHT_RGB.r, FACE_RIGHT_RGB.g, FACE_RIGHT_RGB.b, 1);
            }

            // The grid is clipped to the top face, exactly as the SVG clips it.
            if (onTopFace) {
              for (const quad of GRID_QUADS) {
                if (insidePolygon(quad, x, y)) {
                  over(GRID_RGB.r, GRID_RGB.g, GRID_RGB.b, PALETTE.gridOpacity);
                  break;
                }
              }
            }

            // The arrow is the backdrop showing through, so it is filled with the
            // gradient rather than painted in a third colour.
            if (insidePolygon(ARROW, x, y)) {
              over(backdrop.r, backdrop.g, backdrop.b, 1);
            }
          }

          accR += r * a;
          accG += g * a;
          accB += b * a;
          accA += a;
        }
      }

      const offset = (py * size + px) * 4;
      if (accA <= 0) {
        pixels[offset] = 0;
        pixels[offset + 1] = 0;
        pixels[offset + 2] = 0;
        pixels[offset + 3] = 0;
      } else {
        // accR..accB are premultiplied sums; dividing by accA un-premultiplies.
        pixels[offset] = Math.round(Math.min(255, Math.max(0, accR / accA)));
        pixels[offset + 1] = Math.round(Math.min(255, Math.max(0, accG / accA)));
        pixels[offset + 2] = Math.round(Math.min(255, Math.max(0, accB / accA)));
        pixels[offset + 3] = Math.round(Math.min(255, Math.max(0, (accA / samplesPerPixel) * 255)));
      }
    }
  }

  return pixels;
}

/* ------------------------------------------------------------------------- *
 * 5. PNG encoder
 * ------------------------------------------------------------------------- */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([length, typeAndData, crc]);
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function encodePng(rgba, size) {
  const stride = size * 4;
  // One filter byte per scanline. Filter 0 (None) keeps the encoder honest and
  // small; the payloads here are a few kilobytes either way.
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(
      raw,
      y * (stride + 1) + 1
    );
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr.writeUInt8(8, 8); // bit depth
  ihdr.writeUInt8(6, 9); // colour type: truecolour with alpha
  ihdr.writeUInt8(0, 10); // compression
  ihdr.writeUInt8(0, 11); // filter
  ihdr.writeUInt8(0, 12); // interlace

  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}

/* ------------------------------------------------------------------------- *
 * 6. ICO container
 *
 * Written byte by byte. Every frame is stored as a 32-bit BGRA device independent
 * bitmap rather than as a compressed PNG.
 *
 * Windows stores its own 256 px frames as PNG, so PNG looks like the obvious
 * choice and the container is about 264 KB smaller with it. Uncompressed frames
 * are chosen anyway, because they are the format every reader on the platform
 * decodes, and the whole container still comes to roughly 370 KB — nothing beside
 * an installer.
 *
 * Worth writing down, because it looks like an encoding fault and is not one: the
 * legacy `System.Drawing.Icon(path, 256, 256)` selector hands back the 128 px
 * frame from this container, and reports no error while doing it. That is not the
 * frame failing to decode. An icon holding only the 256 px frame loads at 256
 * through the very same reader, with either encoding. The size field in a
 * directory entry is one byte, so 256 has to be stored as 0, and that selector
 * compares the raw byte — 0 loses to 128. Switching the frame between PNG and
 * bitmap changes nothing about it. Modern readers are unaffected: the WPF decoder
 * enumerates all seven frames here, 256 among them.
 * ------------------------------------------------------------------------- */

function encodeIcoBitmap(rgba, size) {
  const header = Buffer.alloc(40);
  const xorSize = size * size * 4;
  const maskStride = Math.ceil(size / 32) * 4; // 1 bit per pixel, rows padded to 4 bytes
  const maskSize = maskStride * size;

  header.writeUInt32LE(40, 0); // biSize
  header.writeInt32LE(size, 4); // biWidth
  header.writeInt32LE(size * 2, 8); // biHeight: colour rows plus mask rows
  header.writeUInt16LE(1, 12); // biPlanes
  header.writeUInt16LE(32, 14); // biBitCount
  header.writeUInt32LE(0, 16); // biCompression: BI_RGB
  header.writeUInt32LE(xorSize + maskSize, 20); // biSizeImage
  header.writeInt32LE(0, 24); // biXPelsPerMeter
  header.writeInt32LE(0, 28); // biYPelsPerMeter
  header.writeUInt32LE(0, 32); // biClrUsed
  header.writeUInt32LE(0, 36); // biClrImportant

  const xor = Buffer.alloc(xorSize);
  const mask = Buffer.alloc(maskSize); // zero means "use the colour data"

  for (let y = 0; y < size; y += 1) {
    // Device independent bitmaps are stored bottom-up.
    const sourceRow = size - 1 - y;
    for (let x = 0; x < size; x += 1) {
      const source = (sourceRow * size + x) * 4;
      const target = (y * size + x) * 4;
      const alpha = rgba[source + 3];
      xor[target] = rgba[source + 2]; // blue
      xor[target + 1] = rgba[source + 1]; // green
      xor[target + 2] = rgba[source]; // red
      xor[target + 3] = alpha;

      // The AND mask is legacy, but a renderer that ignores the alpha channel
      // would otherwise paint the transparent corners black.
      if (alpha < 128) {
        const bitOffset = y * maskStride + (x >> 3);
        mask[bitOffset] |= 0x80 >> (x & 7);
      }
    }
  }

  return Buffer.concat([header, xor, mask]);
}

function encodeIco(images) {
  const directory = Buffer.alloc(6 + images.length * 16);
  directory.writeUInt16LE(0, 0); // reserved
  directory.writeUInt16LE(1, 2); // type 1 = icon
  directory.writeUInt16LE(images.length, 4);

  let offset = directory.length;
  const payloads = [];

  images.forEach((image, index) => {
    const entry = 6 + index * 16;
    // 256 is stored as 0: the field is one byte and 256 does not fit.
    directory.writeUInt8(image.size >= 256 ? 0 : image.size, entry);
    directory.writeUInt8(image.size >= 256 ? 0 : image.size, entry + 1);
    directory.writeUInt8(0, entry + 2); // colours in palette: none, it is truecolour
    directory.writeUInt8(0, entry + 3); // reserved
    directory.writeUInt16LE(1, entry + 4); // colour planes
    directory.writeUInt16LE(32, entry + 6); // bits per pixel
    directory.writeUInt32LE(image.data.length, entry + 8);
    directory.writeUInt32LE(offset, entry + 12);
    offset += image.data.length;
    payloads.push(image.data);
  });

  return Buffer.concat([directory, ...payloads]);
}

/* ------------------------------------------------------------------------- *
 * 7. SVG emitter
 * ------------------------------------------------------------------------- */

function pointsAttribute(points) {
  return points.map(([x, y]) => `${round(x)},${round(y)}`).join(' ');
}

function round(value) {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

function svgBody(idPrefix) {
  const gradientId = `${idPrefix}-backdrop`;
  const clipId = `${idPrefix}-topface`;
  return `  <defs>
    <linearGradient id="${gradientId}" x1="0" y1="0" x2="0" y2="${CANVAS}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${PALETTE.backdropTop}"/>
      <stop offset="1" stop-color="${PALETTE.backdropBottom}"/>
    </linearGradient>
    <clipPath id="${clipId}">
      <polygon points="${pointsAttribute(FACE_TOP)}"/>
    </clipPath>
  </defs>
  <!-- Backdrop: a rounded square so the mark holds its shape on a light desktop and a dark one. -->
  <rect x="0" y="0" width="${CANVAS}" height="${CANVAS}" rx="${BADGE_RADIUS}" ry="${BADGE_RADIUS}" fill="url(#${gradientId})"/>
  <!-- The chunk: three faces of an isometric cube. -->
  <polygon points="${pointsAttribute(FACE_TOP)}" fill="${PALETTE.faceTop}"/>
  <polygon points="${pointsAttribute(FACE_LEFT)}" fill="${PALETTE.faceLeft}"/>
  <polygon points="${pointsAttribute(FACE_RIGHT)}" fill="${PALETTE.faceRight}"/>
  <!-- Map grid, clipped to the top face. -->
  <g clip-path="url(#${clipId})" fill="${PALETTE.grid}" fill-opacity="${PALETTE.gridOpacity}">
${GRID_QUADS.map((quad) => `    <polygon points="${pointsAttribute(quad)}"/>`).join('\n')}
  </g>
  <!-- The download arrow, filled with the backdrop so it reads as a shape cut through the chunk. -->
  <polygon points="${pointsAttribute(ARROW)}" fill="url(#${gradientId})"/>`;
}

function buildMasterSvg() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!--
  World Downloader Studio — application mark.

  Original artwork for this project. An isometric cube, standing for the world
  chunk the application downloads, with a download arrow cut through it. It
  borrows nothing from any game's trademarks, textures or branding.

  Self-contained: no external references, no embedded raster, no script, no font.
  Generated from app/scripts/generate-icons.mjs, which rasterises the same
  geometry for the PNG set and the Windows icon container.
-->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS} ${CANVAS}" width="${CANVAS}" height="${CANVAS}" role="img" aria-label="World Downloader Studio">
${svgBody('wds')}
</svg>
`;
}

/* ------------------------------------------------------------------------- *
 * 8. The renderer's inline copy of the mark
 * ------------------------------------------------------------------------- */

function buildLogoModule() {
  const monochromePath = [
    `M ${CUBE_OUTLINE.map(([x, y], index) => `${index === 0 ? '' : 'L '}${round(x)} ${round(y)}`).join(' ')} Z`,
    `M ${ARROW.map(([x, y], index) => `${index === 0 ? '' : 'L '}${round(x)} ${round(y)}`).join(' ')} Z`
  ].join(' ');

  // The artwork body, with the identifier prefix turned into a template hole the
  // emitted TypeScript fills in per instance. The body contains no backtick and
  // no dollar sign of its own, so it drops into a template literal untouched.
  const colourBody = svgBody('__ID__').replace(/__ID__/g, '${id}');
  if (colourBody.includes('`')) {
    throw new Error('artwork body contains a backtick and cannot be emitted as a template literal');
  }

  return `/**
 * World Downloader Studio — the application mark, inline.
 *
 * Generated by app/scripts/generate-icons.mjs from the same geometry that
 * produces build/icon.svg and build/icon.ico, so the mark in the title bar is
 * the mark on the taskbar. Do not hand-edit: re-run the generator instead.
 *
 * The mark is an inline string rather than a file reference on purpose. Nothing
 * here loads over the network and nothing reaches for a file:// URL at runtime,
 * so the title bar, the About surface and every empty state draw the mark with
 * no request of any kind.
 */

/** The design space every coordinate in the mark is expressed in. */
export const APP_LOGO_VIEWBOX = '0 0 ${CANVAS} ${CANVAS}';

/** The product name, used as the accessible name when the caller supplies none. */
export const APP_LOGO_DEFAULT_TITLE = 'World Downloader Studio';

/**
 * The single-colour silhouette: the cube outline with the arrow as a hole in it,
 * separated by the even-odd fill rule. It paints in \`currentColor\`, so it takes
 * the colour of whatever surface it sits on and stays legible in both themes.
 */
export const APP_LOGO_SILHOUETTE_PATH =
  '${monochromePath}';

export interface AppLogoOptions {
  /** Rendered edge length in CSS pixels. The mark is square. Defaults to 24. */
  size?: number;
  /**
   * Accessible name. Ignored when \`decorative\` is true. Defaults to the product
   * name, which is the right answer wherever the mark stands in for the product.
   */
  title?: string;
  /**
   * True when the mark sits beside text that already names the product. The
   * element is then hidden from assistive technology instead of announcing the
   * product name a second time.
   */
  decorative?: boolean;
  /** Extra class names for the root element. */
  className?: string;
}

let instanceCounter = 0;

/**
 * Gradient and clip-path identifiers are document-wide in SVG, so two copies of
 * the mark on one surface would otherwise fight over them.
 */
function nextInstanceId(): string {
  instanceCounter += 1;
  return \`wds-logo-\${instanceCounter}\`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function rootAttributes(options: AppLogoOptions): string {
  const size = options.size ?? 24;
  const className = options.className ? \` class="\${escapeXml(options.className)}"\` : '';
  const label = options.decorative
    ? ' aria-hidden="true" focusable="false"'
    : \` role="img" aria-label="\${escapeXml(options.title ?? APP_LOGO_DEFAULT_TITLE)}"\`;
  return \`xmlns="http://www.w3.org/2000/svg" viewBox="\${APP_LOGO_VIEWBOX}" width="\${size}" height="\${size}"\${className}\${label}\`;
}

/**
 * The artwork itself. \`id\` scopes the gradient and clip-path identifiers to one
 * instance so two copies of the mark on the same surface cannot fight over them.
 */
function appLogoArtwork(id: string): string {
  return \`
${colourBody}\`;
}

/**
 * The full-colour mark, as an SVG string ready to assign to \`innerHTML\` on a
 * container the application owns.
 */
export function appLogoSvg(options: AppLogoOptions = {}): string {
  const id = nextInstanceId();
  return \`<svg \${rootAttributes(options)}>\${appLogoArtwork(id)}
</svg>\`;
}

/**
 * The single-colour mark. Use it in a title bar, a menu row or anywhere the mark
 * has to sit at small size in the surrounding text colour.
 */
export function appLogoMonochromeSvg(options: AppLogoOptions = {}): string {
  return [
    \`<svg \${rootAttributes(options)}>\`,
    \`  <path d="\${APP_LOGO_SILHOUETTE_PATH}" fill="currentColor" fill-rule="evenodd"/>\`,
    '</svg>'
  ].join('\\n');
}

/**
 * The full-colour mark as a \`data:\` URI, for the places that need an image
 * source rather than markup. It encodes the markup already in memory; it never
 * fetches anything.
 */
export function appLogoDataUri(options: AppLogoOptions = {}): string {
  return \`data:image/svg+xml;charset=utf-8,\${encodeURIComponent(appLogoSvg(options))}\`;
}
`;
}

/* ------------------------------------------------------------------------- *
 * 9. Verification
 *
 * Nothing below trusts what was just written. Every emitted file is read back
 * from disk and its bytes parsed, because "the write call returned" and "the file
 * is a valid icon" are different claims.
 * ------------------------------------------------------------------------- */

function verifyPng(path, expectedSize) {
  const bytes = readFileSync(path);
  if (!bytes.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error(`${path}: not a PNG (signature mismatch)`);
  }
  if (bytes.readUInt32BE(8) !== 13 || bytes.subarray(12, 16).toString('ascii') !== 'IHDR') {
    throw new Error(`${path}: first chunk is not IHDR`);
  }
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  const bitDepth = bytes.readUInt8(24);
  const colourType = bytes.readUInt8(25);
  if (width !== expectedSize || height !== expectedSize) {
    throw new Error(`${path}: expected ${expectedSize}x${expectedSize}, read ${width}x${height}`);
  }
  if (bitDepth !== 8 || colourType !== 6) {
    throw new Error(`${path}: expected 8-bit RGBA, read bit depth ${bitDepth} colour type ${colourType}`);
  }
  return { bytes: bytes.length, width, height, bitDepth, colourType };
}

function verifyIco(path, expectedSizes) {
  const bytes = readFileSync(path);
  if (bytes.length < 6) throw new Error(`${path}: too short to be an icon`);
  const reserved = bytes.readUInt16LE(0);
  const type = bytes.readUInt16LE(2);
  const count = bytes.readUInt16LE(4);
  if (reserved !== 0) throw new Error(`${path}: reserved field is ${reserved}, expected 0`);
  if (type !== 1) throw new Error(`${path}: type is ${type}, expected 1 (icon)`);
  if (count !== expectedSizes.length) {
    throw new Error(`${path}: directory declares ${count} images, expected ${expectedSizes.length}`);
  }

  const entries = [];
  for (let index = 0; index < count; index += 1) {
    const at = 6 + index * 16;
    const declaredWidth = bytes.readUInt8(at) === 0 ? 256 : bytes.readUInt8(at);
    const declaredHeight = bytes.readUInt8(at + 1) === 0 ? 256 : bytes.readUInt8(at + 1);
    const planes = bytes.readUInt16LE(at + 4);
    const bitCount = bytes.readUInt16LE(at + 6);
    const byteLength = bytes.readUInt32LE(at + 8);
    const offset = bytes.readUInt32LE(at + 12);

    if (offset + byteLength > bytes.length) {
      throw new Error(`${path}: entry ${index} runs past the end of the file`);
    }

    const payload = bytes.subarray(offset, offset + byteLength);
    let encoding;
    let actualWidth;
    let actualHeight;

    if (payload.subarray(0, 8).equals(PNG_SIGNATURE)) {
      encoding = 'PNG';
      actualWidth = payload.readUInt32BE(16);
      actualHeight = payload.readUInt32BE(20);
    } else {
      encoding = 'BMP';
      const headerSize = payload.readUInt32LE(0);
      if (headerSize !== 40) {
        throw new Error(`${path}: entry ${index} has a ${headerSize}-byte bitmap header, expected 40`);
      }
      actualWidth = payload.readInt32LE(4);
      // The stored height covers the colour rows and the mask rows together.
      actualHeight = payload.readInt32LE(8) / 2;
    }

    if (actualWidth !== declaredWidth || actualHeight !== declaredHeight) {
      throw new Error(
        `${path}: entry ${index} declares ${declaredWidth}x${declaredHeight} but the image is ${actualWidth}x${actualHeight}`
      );
    }
    if (declaredWidth !== expectedSizes[index]) {
      throw new Error(
        `${path}: entry ${index} is ${declaredWidth}px, expected ${expectedSizes[index]}px`
      );
    }
    if (planes !== 1 || bitCount !== 32) {
      throw new Error(`${path}: entry ${index} declares ${planes} plane(s) at ${bitCount}bpp, expected 1 at 32`);
    }

    entries.push({
      index,
      size: declaredWidth,
      encoding,
      planes,
      bitCount,
      byteLength,
      offset
    });
  }

  // Guard the decision recorded above: every frame is an uncompressed bitmap, so
  // no reader on the platform has to understand a compressed payload to use it.
  const compressed = entries.filter((entry) => entry.encoding !== 'BMP');
  if (compressed.length > 0) {
    throw new Error(
      `${path}: ${compressed.map((entry) => `${entry.size}px`).join(', ')} stored as PNG; ` +
        'every frame must be an uncompressed bitmap'
    );
  }

  return { bytes: bytes.length, count, entries };
}

/* ------------------------------------------------------------------------- *
 * 10. Run
 * ------------------------------------------------------------------------- */

const ICON_SIZES = [16, 24, 32, 48, 64, 128, 256];
const PNG_SIZES = [16, 24, 32, 48, 64, 128, 256];

function main() {
  mkdirSync(BUILD_DIR, { recursive: true });
  mkdirSync(RENDERER_ASSETS_DIR, { recursive: true });
  mkdirSync(DOCS_IMAGES_DIR, { recursive: true });

  const written = [];

  // The vector master.
  const svgPath = join(BUILD_DIR, 'icon.svg');
  writeFileSync(svgPath, buildMasterSvg(), 'utf8');
  written.push(svgPath);

  // The raster set. Render each size once and reuse the pixels for the PNG and
  // for the icon container, so the two can never disagree.
  const rendered = new Map();
  for (const size of new Set([...ICON_SIZES, ...PNG_SIZES])) {
    process.stdout.write(`  rendering ${size}x${size} (${supersampleFactor(size)}x supersampled)\n`);
    rendered.set(size, renderRgba(size));
  }

  for (const size of PNG_SIZES) {
    const path = join(BUILD_DIR, `icon-${size}.png`);
    writeFileSync(path, encodePng(rendered.get(size), size));
    written.push(path);
  }

  // The Windows icon container.
  const icoImages = ICON_SIZES.map((size) => ({
    size,
    data: encodeIcoBitmap(rendered.get(size), size)
  }));
  const icoPath = join(BUILD_DIR, 'icon.ico');
  writeFileSync(icoPath, encodeIco(icoImages));
  written.push(icoPath);

  // The renderer's inline copy.
  const logoPath = join(RENDERER_ASSETS_DIR, 'logo.ts');
  writeFileSync(logoPath, buildLogoModule(), 'utf8');
  written.push(logoPath);

  // The copy the README and the documentation site use.
  const docsIconPath = join(DOCS_IMAGES_DIR, 'icon-256.png');
  writeFileSync(docsIconPath, readFileSync(join(BUILD_DIR, 'icon-256.png')));
  written.push(docsIconPath);

  // Read every one of them back.
  process.stdout.write('\nVerifying emitted files\n');
  for (const size of PNG_SIZES) {
    const path = join(BUILD_DIR, `icon-${size}.png`);
    const info = verifyPng(path, size);
    process.stdout.write(
      `  icon-${size}.png            ${info.width}x${info.height} RGBA8  ${info.bytes} bytes\n`
    );
  }
  const docsInfo = verifyPng(docsIconPath, 256);
  process.stdout.write(
    `  docs/images/icon-256.png  ${docsInfo.width}x${docsInfo.height} RGBA8  ${docsInfo.bytes} bytes\n`
  );

  const ico = verifyIco(icoPath, ICON_SIZES);
  process.stdout.write(`\n  icon.ico  ${ico.bytes} bytes, ${ico.count} images\n`);
  for (const entry of ico.entries) {
    process.stdout.write(
      `    [${entry.index}] ${String(entry.size).padStart(3)}x${String(entry.size).padEnd(3)} ` +
        `${entry.encoding.padEnd(3)} ${entry.bitCount}bpp  ` +
        `${String(entry.byteLength).padStart(7)} bytes at offset ${entry.offset}\n`
    );
  }

  const svgBytes = readFileSync(svgPath, 'utf8');
  if (/<(script|image|use\s[^>]*href="[^#])/i.test(svgBytes)) {
    throw new Error('icon.svg contains a script or an external reference');
  }
  process.stdout.write(`\n  icon.svg  ${Buffer.byteLength(svgBytes)} bytes, self-contained\n`);
  process.stdout.write(`  logo.ts   ${readFileSync(logoPath).length} bytes\n`);

  process.stdout.write(`\nWrote ${written.length} files.\n`);
}

main();
