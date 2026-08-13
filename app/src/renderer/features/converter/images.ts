/**
 * Image inspection and the raster routes that produce text.
 *
 * Decoding uses the packaged runtime's own image decoders through
 * `createImageBitmap`, which is part of the installed application rather than
 * anything discovered on the machine. Encoding is deliberately limited to the
 * formats whose bytes are text — the ASCII netpbm family and an SVG container —
 * because the application's file-writing channel writes UTF-8, and writing a
 * PNG through it would produce a corrupt file rather than a smaller one.
 */

import { bytesToBase64, bytesToUtf8Lossy, readUintBE, readUintLE, startsWith, ascii, indexOfBytes } from './bytes';
import { ConverterBoundary, Deadline, type ResourceLimits } from './limits';

export interface ImageReport {
  format: string;
  width: number;
  height: number;
  /** Bits per channel where the header records it, otherwise 0. */
  bitDepth: number;
  /** e.g. `truecolour with alpha`, `indexed`, `greyscale`. */
  colour: string;
  hasAlpha: boolean;
  /** Frames the container declares. 1 for a still image. */
  frames: number;
  /** True when the container declares an ICC profile or colour-space chunk. */
  hasColourProfile: boolean;
  /** Metadata blocks present by name, e.g. `EXIF`, `tEXt`. */
  metadataBlocks: string[];
  fileBytes: number;
  megapixels: number;
}

/* ------------------------------------------------------------------ */
/* Header parsing                                                      */
/* ------------------------------------------------------------------ */

const PNG_COLOUR: Record<number, string> = {
  0: 'greyscale',
  2: 'truecolour',
  3: 'indexed',
  4: 'greyscale with alpha',
  6: 'truecolour with alpha'
};

function inspectPng(bytes: Uint8Array, limits: ResourceLimits, deadline: Deadline): ImageReport {
  const width = readUintBE(bytes, 16, 4);
  const height = readUintBE(bytes, 20, 4);
  const bitDepth = bytes[24];
  const colourType = bytes[25];
  const interlace = bytes[28];

  const blocks: string[] = [];
  let frames = 1;
  let hasProfile = false;
  let cursor = 8;
  let chunks = 0;
  while (cursor + 8 <= bytes.length) {
    deadline.check();
    chunks += 1;
    if (chunks > limits.entries) break;
    const length = readUintBE(bytes, cursor, 4);
    const type = bytesToUtf8Lossy(bytes.subarray(cursor + 4, cursor + 8));
    if (type === 'IEND') break;
    if (type === 'iCCP' || type === 'sRGB' || type === 'cHRM' || type === 'gAMA') hasProfile = true;
    if (type === 'tEXt' || type === 'iTXt' || type === 'zTXt' || type === 'eXIf') {
      if (!blocks.includes(type)) blocks.push(type);
    }
    if (type === 'acTL') frames = readUintBE(bytes, cursor + 8, 4);
    cursor += 12 + length;
  }
  if (interlace === 1) blocks.push('Adam7 interlacing');

  return {
    format: 'PNG',
    width,
    height,
    bitDepth,
    colour: PNG_COLOUR[colourType] ?? `colour type ${colourType}`,
    hasAlpha: colourType === 4 || colourType === 6,
    frames,
    hasColourProfile: hasProfile,
    metadataBlocks: blocks,
    fileBytes: bytes.length,
    megapixels: Math.round((width * height) / 10_000) / 100
  };
}

function inspectJpeg(bytes: Uint8Array, limits: ResourceLimits, deadline: Deadline): ImageReport {
  let cursor = 2;
  let width = 0;
  let height = 0;
  let components = 3;
  let bitDepth = 8;
  let progressive = false;
  const blocks: string[] = [];
  let hasProfile = false;
  let markers = 0;

  while (cursor + 4 <= bytes.length) {
    deadline.check();
    markers += 1;
    if (markers > limits.entries) break;
    if (bytes[cursor] !== 0xff) {
      cursor += 1;
      continue;
    }
    const marker = bytes[cursor + 1];
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
      cursor += 2;
      continue;
    }
    const length = readUintBE(bytes, cursor + 2, 2);
    if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb)) {
      bitDepth = bytes[cursor + 4];
      height = readUintBE(bytes, cursor + 5, 2);
      width = readUintBE(bytes, cursor + 7, 2);
      components = bytes[cursor + 9];
      progressive = marker === 0xc2;
      break;
    }
    if (marker === 0xe1 && startsWith(bytes, ascii('Exif'), cursor + 4)) blocks.push('EXIF');
    if (marker === 0xe2 && startsWith(bytes, ascii('ICC_PROFILE'), cursor + 4)) hasProfile = true;
    if (marker === 0xee) hasProfile = true;
    if (marker === 0xfe) blocks.push('comment');
    cursor += 2 + length;
  }

  return {
    format: 'JPEG',
    width,
    height,
    bitDepth,
    colour: components === 1 ? 'greyscale' : components === 4 ? 'four component (CMYK or YCCK)' : 'YCbCr',
    hasAlpha: false,
    frames: 1,
    hasColourProfile: hasProfile,
    metadataBlocks: progressive ? [...blocks, 'progressive scan'] : blocks,
    fileBytes: bytes.length,
    megapixels: Math.round((width * height) / 10_000) / 100
  };
}

function inspectGif(bytes: Uint8Array, limits: ResourceLimits, deadline: Deadline): ImageReport {
  const width = readUintLE(bytes, 6, 2);
  const height = readUintLE(bytes, 8, 2);
  const packed = bytes[10];
  const bitDepth = (packed & 0x07) + 1;
  let frames = 0;
  let hasTransparency = false;
  let scanned = 0;
  for (let cursor = 13; cursor + 1 < bytes.length; cursor += 1) {
    if (scanned % 4096 === 0) deadline.check();
    scanned += 1;
    if (scanned > limits.entries * 64) break;
    if (bytes[cursor] === 0x2c) frames += 1;
    if (bytes[cursor] === 0x21 && bytes[cursor + 1] === 0xf9 && (bytes[cursor + 3] & 0x01) === 1) hasTransparency = true;
  }
  return {
    format: 'GIF',
    width,
    height,
    bitDepth,
    colour: 'indexed',
    hasAlpha: hasTransparency,
    frames: Math.max(frames, 1),
    hasColourProfile: false,
    metadataBlocks: frames > 1 ? ['animation control blocks'] : [],
    fileBytes: bytes.length,
    megapixels: Math.round((width * height) / 10_000) / 100
  };
}

function inspectBmp(bytes: Uint8Array): ImageReport {
  const width = readUintLE(bytes, 18, 4);
  const height = readUintLE(bytes, 22, 4);
  const bitsPerPixel = readUintLE(bytes, 28, 2);
  return {
    format: 'BMP',
    width,
    height,
    bitDepth: bitsPerPixel <= 8 ? bitsPerPixel : 8,
    colour: bitsPerPixel <= 8 ? 'indexed' : bitsPerPixel === 32 ? 'truecolour with alpha' : 'truecolour',
    hasAlpha: bitsPerPixel === 32,
    frames: 1,
    hasColourProfile: false,
    metadataBlocks: [],
    fileBytes: bytes.length,
    megapixels: Math.round((width * height) / 10_000) / 100
  };
}

function inspectWebp(bytes: Uint8Array): ImageReport {
  let width = 0;
  let height = 0;
  let hasAlpha = false;
  let frames = 1;
  const blocks: string[] = [];

  const vp8x = indexOfBytes(bytes, ascii('VP8X'), 12);
  if (vp8x === 12) {
    const flags = bytes[vp8x + 8];
    hasAlpha = (flags & 0x10) !== 0;
    if ((flags & 0x02) !== 0) blocks.push('animation');
    if ((flags & 0x20) !== 0) blocks.push('EXIF');
    if ((flags & 0x04) !== 0) blocks.push('XMP');
    width = readUintLE(bytes, vp8x + 12, 3) + 1;
    height = readUintLE(bytes, vp8x + 15, 3) + 1;
    const anmf = indexOfBytes(bytes, ascii('ANMF'), 12);
    if (anmf >= 0) {
      frames = 0;
      let cursor = anmf;
      while (cursor >= 0 && frames < 100_000) {
        frames += 1;
        cursor = indexOfBytes(bytes, ascii('ANMF'), cursor + 4);
      }
    }
  } else {
    const vp8l = indexOfBytes(bytes, ascii('VP8L'), 12);
    if (vp8l === 12) {
      const bits = readUintLE(bytes, vp8l + 9, 4);
      width = (bits & 0x3fff) + 1;
      height = ((bits >> 14) & 0x3fff) + 1;
      hasAlpha = ((bits >> 28) & 1) === 1;
    } else {
      const vp8 = indexOfBytes(bytes, ascii('VP8 '), 12);
      if (vp8 === 12) {
        width = readUintLE(bytes, vp8 + 14, 2) & 0x3fff;
        height = readUintLE(bytes, vp8 + 16, 2) & 0x3fff;
      }
    }
  }

  return {
    format: 'WebP',
    width,
    height,
    bitDepth: 8,
    colour: 'truecolour',
    hasAlpha,
    frames,
    hasColourProfile: blocks.includes('ICC'),
    metadataBlocks: blocks,
    fileBytes: bytes.length,
    megapixels: Math.round((width * height) / 10_000) / 100
  };
}

/** Reads whatever the image's own header states, without decoding pixels. */
export function inspectImage(formatId: string, bytes: Uint8Array, limits: ResourceLimits, deadline: Deadline): ImageReport {
  switch (formatId) {
    case 'png': return inspectPng(bytes, limits, deadline);
    case 'jpeg': return inspectJpeg(bytes, limits, deadline);
    case 'gif': return inspectGif(bytes, limits, deadline);
    case 'bmp': return inspectBmp(bytes);
    case 'webp': return inspectWebp(bytes);
    default:
      throw new ConverterBoundary('unsupported', `No header reader is implemented for ${formatId} images.`);
  }
}

/* ------------------------------------------------------------------ */
/* Decoding                                                            */
/* ------------------------------------------------------------------ */

export interface DecodedRaster {
  width: number;
  height: number;
  /** RGBA, four bytes per pixel, row major. */
  pixels: Uint8ClampedArray;
}

/** True when the packaged runtime exposes the decoders these routes need. */
export function hasRasterDecoder(): boolean {
  const global = globalThis as Record<string, unknown>;
  return typeof global['createImageBitmap'] === 'function' && typeof global['OffscreenCanvas'] === 'function';
}

/**
 * Decodes an image with the runtime's own decoder, bounded by pixel count.
 *
 * The bound is checked against the decoded bitmap before any pixel buffer is
 * allocated, so a small file declaring an enormous canvas is refused rather
 * than being allowed to allocate first and fail afterwards.
 */
export async function decodeRaster(
  bytes: Uint8Array,
  mimeType: string,
  limits: ResourceLimits,
  deadline: Deadline
): Promise<DecodedRaster> {
  if (!hasRasterDecoder()) {
    throw new ConverterBoundary(
      'unavailable',
      'The packaged runtime does not expose createImageBitmap and OffscreenCanvas, so no image could be decoded.'
    );
  }
  deadline.check();
  const blob = new Blob([bytes], { type: mimeType });
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(blob);
  } catch {
    throw new ConverterBoundary('malformed', 'The runtime decoder refused the image, so nothing was converted.');
  }
  try {
    const pixelCount = bitmap.width * bitmap.height;
    if (pixelCount > limits.pixels) {
      throw new ConverterBoundary(
        'pixels',
        `The image is ${bitmap.width}x${bitmap.height} (${pixelCount} pixels), past the ${limits.pixels}-pixel bound. Nothing was converted.`
      );
    }
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
      throw new ConverterBoundary('unavailable', 'A two-dimensional drawing context could not be created, so nothing was decoded.');
    }
    context.drawImage(bitmap, 0, 0);
    const data = context.getImageData(0, 0, bitmap.width, bitmap.height);
    deadline.check();
    return { width: bitmap.width, height: bitmap.height, pixels: data.data };
  } finally {
    bitmap.close();
  }
}

/** The media type a format id decodes as. */
export function mimeTypeFor(formatId: string): string {
  switch (formatId) {
    case 'png': return 'image/png';
    case 'jpeg': return 'image/jpeg';
    case 'gif': return 'image/gif';
    case 'webp': return 'image/webp';
    case 'bmp': return 'image/bmp';
    case 'ico': return 'image/x-icon';
    case 'svg': return 'image/svg+xml';
    case 'tiff': return 'image/tiff';
    default: return 'application/octet-stream';
  }
}

/* ------------------------------------------------------------------ */
/* Encoding to text formats                                            */
/* ------------------------------------------------------------------ */

export interface RasterEncodeOptions {
  /** Colour used where the source was transparent, since netpbm has no alpha. */
  backgroundHex: string;
  /** Maximum output length in bytes. */
  maxOutputBytes: number;
}

function parseHex(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return [255, 255, 255];
  return [
    Number.parseInt(clean.slice(0, 2), 16),
    Number.parseInt(clean.slice(2, 4), 16),
    Number.parseInt(clean.slice(4, 6), 16)
  ];
}

/**
 * Encodes a raster as ASCII PPM (netpbm P3).
 *
 * P3 is a real, widely-read image format whose bytes are all printable ASCII,
 * which is why it is one of the raster targets this build can genuinely write.
 * It has no alpha channel and no colour profile, so both are composited or
 * dropped and that is disclosed before the conversion runs.
 */
export function encodePpm(raster: DecodedRaster, options: RasterEncodeOptions, deadline: Deadline): string {
  const [bgR, bgG, bgB] = parseHex(options.backgroundHex);
  const parts: string[] = [`P3\n# written by the file converter\n${raster.width} ${raster.height}\n255\n`];
  let length = parts[0].length;
  let line: string[] = [];

  for (let index = 0; index < raster.pixels.length; index += 4) {
    if ((index & 0xffff) === 0) deadline.check();
    const alpha = raster.pixels[index + 3] / 255;
    const r = Math.round(raster.pixels[index] * alpha + bgR * (1 - alpha));
    const g = Math.round(raster.pixels[index + 1] * alpha + bgG * (1 - alpha));
    const b = Math.round(raster.pixels[index + 2] * alpha + bgB * (1 - alpha));
    line.push(`${r} ${g} ${b}`);
    if (line.length >= 5) {
      const chunk = `${line.join(' ')}\n`;
      length += chunk.length;
      if (length > options.maxOutputBytes) {
        throw new ConverterBoundary(
          'output-size',
          `The ASCII raster passed the ${options.maxOutputBytes}-byte output bound. Nothing was written.`
        );
      }
      parts.push(chunk);
      line = [];
    }
  }
  if (line.length > 0) parts.push(`${line.join(' ')}\n`);
  return parts.join('');
}

/** Encodes a raster as ASCII PGM (netpbm P2) using Rec. 709 luminance. */
export function encodePgm(raster: DecodedRaster, options: RasterEncodeOptions, deadline: Deadline): string {
  const [bgR, bgG, bgB] = parseHex(options.backgroundHex);
  const parts: string[] = [`P2\n# written by the file converter\n${raster.width} ${raster.height}\n255\n`];
  let length = parts[0].length;
  let line: string[] = [];

  for (let index = 0; index < raster.pixels.length; index += 4) {
    if ((index & 0xffff) === 0) deadline.check();
    const alpha = raster.pixels[index + 3] / 255;
    const r = raster.pixels[index] * alpha + bgR * (1 - alpha);
    const g = raster.pixels[index + 1] * alpha + bgG * (1 - alpha);
    const b = raster.pixels[index + 2] * alpha + bgB * (1 - alpha);
    line.push(String(Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b)));
    if (line.length >= 16) {
      const chunk = `${line.join(' ')}\n`;
      length += chunk.length;
      if (length > options.maxOutputBytes) {
        throw new ConverterBoundary(
          'output-size',
          `The ASCII raster passed the ${options.maxOutputBytes}-byte output bound. Nothing was written.`
        );
      }
      parts.push(chunk);
      line = [];
    }
  }
  if (line.length > 0) parts.push(`${line.join(' ')}\n`);
  return parts.join('');
}

/**
 * Wraps the original bytes in an SVG container, unchanged.
 *
 * This is a container change and not a vectorisation: the raster inside is the
 * source's own bytes, so nothing is resampled and nothing is lost. The result
 * is a valid standalone SVG document that any browser or vector editor opens.
 */
export function encodeSvgContainer(
  bytes: Uint8Array,
  mimeType: string,
  width: number,
  height: number,
  maxOutputBytes: number
): string {
  const encoded = bytesToBase64(bytes);
  const document = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `  <title>Raster image wrapped without change</title>`,
    `  <image x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="none" xlink:href="data:${mimeType};base64,${encoded}"/>`,
    '</svg>',
    ''
  ].join('\n');
  if (document.length > maxOutputBytes) {
    throw new ConverterBoundary(
      'output-size',
      `The wrapped document is ${document.length} bytes, past the ${maxOutputBytes}-byte output bound. Nothing was written.`
    );
  }
  return document;
}

/** Parses an ASCII netpbm header, so a P2 or P3 file can be inspected too. */
export function inspectNetpbm(bytes: Uint8Array): ImageReport {
  const head = bytesToUtf8Lossy(bytes.subarray(0, Math.min(bytes.length, 512)));
  const tokens = head
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('#'))
    .join(' ')
    .trim()
    .split(/\s+/);
  const magic = tokens[0] ?? '';
  const width = Number(tokens[1] ?? 0);
  const height = Number(tokens[2] ?? 0);
  return {
    format: magic === 'P2' ? 'PGM (ASCII)' : magic === 'P3' ? 'PPM (ASCII)' : `netpbm ${magic}`,
    width: Number.isFinite(width) ? width : 0,
    height: Number.isFinite(height) ? height : 0,
    bitDepth: 8,
    colour: magic === 'P2' ? 'greyscale' : 'truecolour',
    hasAlpha: false,
    frames: 1,
    hasColourProfile: false,
    metadataBlocks: [],
    fileBytes: bytes.length,
    megapixels: Math.round((width * height) / 10_000) / 100
  };
}
