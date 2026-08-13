/**
 * Turning one decoded image into the display variants this application can
 * actually consume, and saying out loud what that costs.
 *
 * Two rules shape everything here.
 *
 * The first is that only the sizes the application really renders are
 * generated. A pipeline that emits every size somebody might one day want is a
 * pipeline that spends the user's disk on nothing, so the target list is fixed,
 * short, and each entry corresponds to a place the mark is genuinely drawn.
 *
 * The second is that a loss is reported BEFORE it becomes the active output,
 * never discovered afterwards. Re-encoding, colour-profile flattening,
 * transparency removal, cropping and downscaling all change the image the user
 * handed over, and each one is named with its exact consequence while the old
 * mark is still in place. If any part of the conversion fails, the previous
 * valid mark stays active — a half-applied logo is worse than an unchanged one.
 */

import { LIMITS, TARGET_SIZES } from './imageBytes';
import type { HeaderFacts } from './imageBytes';

/* ------------------------------------------------------------------ */
/* Choices                                                             */
/* ------------------------------------------------------------------ */

export type FitMode = 'contain' | 'cover' | 'fill';

/** A crop expressed as fractions of the source, so it survives a rescale. */
export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const FULL_CROP: CropRect = { x: 0, y: 0, width: 1, height: 1 };

export interface RenderChoices {
  crop: CropRect;
  fit: FitMode;
  /** 0 is the left edge, 1 the right. Decides which part survives a crop-to-fill. */
  focalX: number;
  /** 0 is the top edge, 1 the bottom. */
  focalY: number;
  /** A CSS colour, or null for a transparent background. */
  background: string | null;
  /** 0 leaves the mark square; 50 makes it a circle. */
  cornerRadiusPercent: number;
}

export const DEFAULT_CHOICES: RenderChoices = {
  crop: FULL_CROP,
  fit: 'contain',
  focalX: 0.5,
  focalY: 0.5,
  background: null,
  cornerRadiusPercent: 0
};

/* ------------------------------------------------------------------ */
/* Losses                                                              */
/* ------------------------------------------------------------------ */

export type LossKind =
  | 'reencode'
  | 'colourProfile'
  | 'transparency'
  | 'crop'
  | 'downscale'
  | 'upscale'
  | 'metadata'
  | 'stretch';

export interface LossNotice {
  kind: LossKind;
  /** i18n key for the short title. */
  titleKey: string;
  /** Already-assembled factual detail. Never restyled by the humour level. */
  detail: string;
}

/* ------------------------------------------------------------------ */
/* Output                                                              */
/* ------------------------------------------------------------------ */

export interface LogoVariant {
  size: number;
  /** `data:image/png;base64,…`. Local only; never uploaded, exported or logged. */
  dataUrl: string;
  byteLength: number;
  verified: boolean;
  /** Exactly what the verification checked, or exactly why it failed. */
  verificationDetail: string;
}

export type ConversionResult =
  | {
      ok: true;
      variants: LogoVariant[];
      losses: LossNotice[];
      hasTransparency: boolean;
      totalBytes: number;
    }
  | { ok: false; code: 'canvas' | 'encode' | 'verify' | 'budget'; detail: string };

/* ------------------------------------------------------------------ */
/* Drawing                                                             */
/* ------------------------------------------------------------------ */

function roundedRectPath(context: CanvasRenderingContext2D, size: number, radiusPercent: number): void {
  const radius = Math.min(size / 2, (size * radiusPercent) / 100);
  context.beginPath();
  if (radius <= 0) {
    context.rect(0, 0, size, size);
  } else {
    context.moveTo(radius, 0);
    context.lineTo(size - radius, 0);
    context.arcTo(size, 0, size, radius, radius);
    context.lineTo(size, size - radius);
    context.arcTo(size, size, size - radius, size, radius);
    context.lineTo(radius, size);
    context.arcTo(0, size, 0, size - radius, radius);
    context.lineTo(0, radius);
    context.arcTo(0, 0, radius, 0, radius);
  }
  context.closePath();
}

/** Clamps a crop to the unit square and refuses a zero-area rectangle. */
export function normalizeCrop(crop: CropRect): CropRect {
  const x = Math.min(Math.max(crop.x, 0), 0.99);
  const y = Math.min(Math.max(crop.y, 0), 0.99);
  const width = Math.min(Math.max(crop.width, 0.01), 1 - x);
  const height = Math.min(Math.max(crop.height, 0.01), 1 - y);
  return { x, y, width, height };
}

/**
 * Draws the source into one square canvas at `size`.
 *
 * Exported because the editor previews use exactly this function: a preview
 * drawn by different code from the output is a preview that can disagree with
 * what is finally applied, which is the one thing a preview must never do.
 */
export function drawMark(
  canvas: HTMLCanvasElement,
  bitmap: ImageBitmap,
  size: number,
  choices: RenderChoices
): boolean {
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d', { alpha: true });
  if (!context) return false;

  context.clearRect(0, 0, size, size);
  context.save();
  roundedRectPath(context, size, choices.cornerRadiusPercent);
  context.clip();

  if (choices.background) {
    context.fillStyle = choices.background;
    context.fillRect(0, 0, size, size);
  }

  const crop = normalizeCrop(choices.crop);
  const sx = crop.x * bitmap.width;
  const sy = crop.y * bitmap.height;
  const sw = crop.width * bitmap.width;
  const sh = crop.height * bitmap.height;

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';

  if (choices.fit === 'fill') {
    context.drawImage(bitmap, sx, sy, sw, sh, 0, 0, size, size);
  } else {
    const scale = choices.fit === 'cover' ? Math.max(size / sw, size / sh) : Math.min(size / sw, size / sh);
    const dw = sw * scale;
    const dh = sh * scale;
    const dx = (size - dw) * Math.min(Math.max(choices.focalX, 0), 1);
    const dy = (size - dh) * Math.min(Math.max(choices.focalY, 0), 1);
    context.drawImage(bitmap, sx, sy, sw, sh, dx, dy, dw, dh);
  }

  context.restore();
  return true;
}

/* ------------------------------------------------------------------ */
/* Verification of an emitted variant                                  */
/* ------------------------------------------------------------------ */

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

interface EmittedPng {
  bytes: Uint8Array;
  width: number;
  height: number;
  colorType: number;
}

function readEmittedPng(bytes: Uint8Array): EmittedPng | null {
  if (bytes.length < 33) return null;
  for (let index = 0; index < PNG_SIGNATURE.length; index += 1) {
    if (bytes[index] !== PNG_SIGNATURE[index]) return null;
  }
  if (String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]) !== 'IHDR') return null;
  const width = ((bytes[16] << 24) >>> 0) + ((bytes[17] << 16) | (bytes[18] << 8) | bytes[19]);
  const height = ((bytes[20] << 24) >>> 0) + ((bytes[21] << 16) | (bytes[22] << 8) | bytes[23]);
  return { bytes, width, height, colorType: bytes[25] };
}

function decodeBase64(base64: string): Uint8Array | null {
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  } catch {
    return null;
  }
}

/**
 * Checks one emitted variant four ways: its signature, its declared size, its
 * alpha handling, and a decoder round-trip.
 *
 * The round-trip is the one that matters. A file can carry a correct header and
 * still be unreadable, and a variant nothing can decode is a broken logo that
 * only shows itself the next time the window opens.
 */
export async function verifyVariant(
  dataUrl: string,
  expectedSize: number
): Promise<{ ok: boolean; detail: string; byteLength: number }> {
  const comma = dataUrl.indexOf(',');
  if (!dataUrl.startsWith('data:image/png;base64,') || comma < 0) {
    return { ok: false, detail: 'The encoder did not produce a PNG data URL.', byteLength: 0 };
  }
  const bytes = decodeBase64(dataUrl.slice(comma + 1));
  if (!bytes) return { ok: false, detail: 'The emitted data URL is not valid base64.', byteLength: 0 };

  const header = readEmittedPng(bytes);
  if (!header) {
    return { ok: false, detail: 'The emitted bytes do not start with a PNG signature and IHDR chunk.', byteLength: bytes.length };
  }
  if (header.width !== expectedSize || header.height !== expectedSize) {
    return {
      ok: false,
      detail: `The emitted PNG is ${header.width}x${header.height} but ${expectedSize}x${expectedSize} was requested.`,
      byteLength: bytes.length
    };
  }
  if (header.colorType !== 6) {
    return {
      ok: false,
      detail: `The emitted PNG has colour type ${header.colorType}; type 6 (RGBA) is required so transparency survives.`,
      byteLength: bytes.length
    };
  }

  try {
    // Copied into a freshly allocated buffer: a view onto a shared buffer is
    // not a `BlobPart`, and the copy is a few kilobytes at most.
    const owned = new Uint8Array(bytes.length);
    owned.set(bytes);
    const blob = new Blob([owned], { type: 'image/png' });
    const bitmap = await createImageBitmap(blob);
    const round = bitmap.width === expectedSize && bitmap.height === expectedSize;
    bitmap.close();
    if (!round) {
      return { ok: false, detail: 'The emitted PNG decoded back to a different size than it declares.', byteLength: bytes.length };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, detail: `The emitted PNG could not be decoded back: ${message}`, byteLength: bytes.length };
  }

  return {
    ok: true,
    detail: `Signature, ${expectedSize}x${expectedSize} dimensions, RGBA colour type and a decoder round-trip all checked.`,
    byteLength: bytes.length
  };
}

/* ------------------------------------------------------------------ */
/* Loss report                                                         */
/* ------------------------------------------------------------------ */

/**
 * Everything the conversion will change about the user's image.
 *
 * Computed from the header facts and the current choices alone, so it can be
 * shown while the user is still deciding, before a single pixel is written.
 */
export function describeLosses(facts: HeaderFacts, choices: RenderChoices): LossNotice[] {
  const losses: LossNotice[] = [];
  const crop = normalizeCrop(choices.crop);

  if (facts.format !== 'png') {
    losses.push({
      kind: 'reencode',
      titleKey: 'appLogo.loss.reencode',
      detail: `The source is ${facts.format.toUpperCase()} and every generated size is written as PNG. The original file on disk is not touched.`
    });
  }

  if (facts.format === 'jpeg' || facts.format === 'webp') {
    losses.push({
      kind: 'colourProfile',
      titleKey: 'appLogo.loss.colourProfile',
      detail:
        'Any embedded colour profile is flattened to sRGB by the canvas. Colours may shift slightly if the file was authored in a wider space.'
    });
  }

  losses.push({
    kind: 'metadata',
    titleKey: 'appLogo.loss.metadata',
    detail: 'EXIF, ICC and text metadata are not carried into the generated sizes. Only the pixels are kept.'
  });

  if (facts.hasAlphaChannel && choices.background) {
    losses.push({
      kind: 'transparency',
      titleKey: 'appLogo.loss.transparency',
      detail: `The source carries an alpha channel and the background is set to ${choices.background}. Transparent areas will be filled with that colour.`
    });
  }

  if (crop.x > 0 || crop.y > 0 || crop.width < 1 || crop.height < 1) {
    const keptWidth = Math.round(crop.width * facts.width);
    const keptHeight = Math.round(crop.height * facts.height);
    losses.push({
      kind: 'crop',
      titleKey: 'appLogo.loss.crop',
      detail: `The crop keeps ${keptWidth}x${keptHeight} of the ${facts.width}x${facts.height} source. Everything outside that rectangle is discarded from the generated sizes.`
    });
  }

  if (choices.fit === 'fill' && Math.abs(crop.width * facts.width - crop.height * facts.height) > 1) {
    losses.push({
      kind: 'stretch',
      titleKey: 'appLogo.loss.stretch',
      detail: 'Fill stretches the cropped area to a square, so the aspect ratio of the source is not preserved.'
    });
  }

  const croppedWidth = crop.width * facts.width;
  const croppedHeight = crop.height * facts.height;
  const smallest = Math.min(croppedWidth, croppedHeight);
  const shrunk = TARGET_SIZES.filter((size) => size < smallest);
  if (shrunk.length > 0) {
    losses.push({
      kind: 'downscale',
      titleKey: 'appLogo.loss.downscale',
      detail: `${shrunk.join(', ')} pixel sizes are drawn smaller than the cropped source, so fine detail in the original is averaged away at those sizes.`
    });
  }
  const grown = TARGET_SIZES.filter((size) => size > smallest);
  if (grown.length > 0) {
    losses.push({
      kind: 'upscale',
      titleKey: 'appLogo.loss.upscale',
      detail: `${grown.join(', ')} pixel sizes are larger than the cropped source (${Math.round(croppedWidth)}x${Math.round(croppedHeight)}), so those sizes are enlarged and will look soft.`
    });
  }

  return losses;
}

/* ------------------------------------------------------------------ */
/* The conversion                                                      */
/* ------------------------------------------------------------------ */

/** True when any pixel in the canvas is not fully opaque. */
function detectTransparency(canvas: HTMLCanvasElement): boolean {
  const context = canvas.getContext('2d');
  if (!context) return false;
  const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
  for (let index = 3; index < data.length; index += 4) {
    if (data[index] < 255) return true;
  }
  return false;
}

/**
 * Generates and verifies every display variant.
 *
 * Progress is real: it reports the variant actually finished, not a timer
 * pretending to be one. A failure at any stage returns without producing a
 * partial set, so the caller can leave the previous mark in place.
 */
export async function convert(
  bitmap: ImageBitmap,
  facts: HeaderFacts,
  choices: RenderChoices,
  onProgress?: (done: number, total: number, size: number) => void
): Promise<ConversionResult> {
  const sizes = [...TARGET_SIZES];
  if (sizes.length > LIMITS.maxOutputCount) {
    return {
      ok: false,
      code: 'budget',
      detail: `The target list holds ${sizes.length} sizes and the ceiling is ${LIMITS.maxOutputCount}.`
    };
  }

  const canvas = document.createElement('canvas');
  const variants: LogoVariant[] = [];
  let totalBytes = 0;
  let hasTransparency = false;

  for (let index = 0; index < sizes.length; index += 1) {
    const size = sizes[index];
    if (!drawMark(canvas, bitmap, size, choices)) {
      return { ok: false, code: 'canvas', detail: 'A 2D drawing context could not be created, so no size was written.' };
    }
    if (size === sizes[sizes.length - 1]) hasTransparency = detectTransparency(canvas);

    let dataUrl: string;
    try {
      dataUrl = canvas.toDataURL('image/png');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, code: 'encode', detail: `The ${size} pixel size could not be encoded: ${message}` };
    }

    const check = await verifyVariant(dataUrl, size);
    if (!check.ok) {
      return {
        ok: false,
        code: 'verify',
        detail: `The ${size} pixel size failed verification: ${check.detail} Nothing was applied and the previous mark is still in place.`
      };
    }

    totalBytes += check.byteLength;
    variants.push({
      size,
      dataUrl,
      byteLength: check.byteLength,
      verified: true,
      verificationDetail: check.detail
    });
    onProgress?.(index + 1, sizes.length, size);
  }

  if (totalBytes > LIMITS.maxTotalOutputBytes) {
    return {
      ok: false,
      code: 'budget',
      detail: `The generated sizes come to ${totalBytes} bytes and the ceiling is ${LIMITS.maxTotalOutputBytes}. Crop tighter or choose a simpler image. Nothing was applied.`
    };
  }

  return { ok: true, variants, losses: describeLosses(facts, choices), hasTransparency, totalBytes };
}
