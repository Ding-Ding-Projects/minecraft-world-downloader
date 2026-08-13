/**
 * Byte-level inspection of a user-selected image.
 *
 * Nothing here trusts a file extension or a MIME claim. A picker hands back a
 * path; the path says nothing about what is inside the file, and a decoder
 * handed an unexpected format is exactly the surface worth not exercising. So
 * the bytes are read first, the container is identified from its own signature,
 * the dimensions are parsed out of the header, and the decoder is only reached
 * once those numbers are inside the declared bounds.
 *
 * Every limit is a hard ceiling with an exact reason attached, because a
 * rejection a user cannot act on is the same as a crash with better manners.
 *
 * Nothing in this file touches the network, the clipboard, the log, or any
 * persistent store. It takes bytes and returns facts about them.
 */

/* ------------------------------------------------------------------ */
/* Bounds                                                              */
/* ------------------------------------------------------------------ */

export const LIMITS = {
  /** Hard ceiling on the file the user picks. */
  maxSourceBytes: 4 * 1024 * 1024,
  /** width x height. 4096x4096 is far more than any display target needs. */
  maxPixels: 16_777_216,
  maxDimension: 8192,
  /** Below this a mark cannot fill even the smallest target without blurring. */
  minDimension: 16,
  /** The decoder is raced against this; a file that takes longer is refused. */
  decodeTimeoutMs: 10_000,
  /** How far into a file the header walker will read before giving up. */
  maxHeaderScanBytes: 512 * 1024,
  /** How many display variants may be generated from one source. */
  maxOutputCount: 8,
  /** Total size of every generated variant held in application settings. */
  maxTotalOutputBytes: 1_048_576
} as const;

/** The display sizes the application can actually consume. Nothing else is generated. */
export const TARGET_SIZES: readonly number[] = [16, 24, 32, 48, 64, 128, 256];

/* ------------------------------------------------------------------ */
/* Results                                                             */
/* ------------------------------------------------------------------ */

export type AllowedFormat = 'png' | 'jpeg' | 'webp' | 'bmp';

export type RejectionCode =
  | 'empty'
  | 'tooLarge'
  | 'tooSmall'
  | 'tooManyPixels'
  | 'tooWide'
  | 'animated'
  | 'vector'
  | 'unsupportedContainer'
  | 'malformed'
  | 'headerMismatch'
  | 'decodeTimeout'
  | 'decodeFailed';

export interface HeaderFacts {
  format: AllowedFormat;
  mimeType: string;
  width: number;
  height: number;
  /** True when the container declares a channel or table that can carry alpha. */
  hasAlphaChannel: boolean;
  /** Bits per channel where the container states it, otherwise 8. */
  bitDepth: number;
  byteLength: number;
}

export type HeaderResult =
  | { ok: true; facts: HeaderFacts }
  | { ok: false; code: RejectionCode; detail: string };

export interface DecodedSource {
  bitmap: ImageBitmap;
  facts: HeaderFacts;
}

export type DecodeResult = { ok: true; source: DecodedSource } | { ok: false; code: RejectionCode; detail: string };

/* ------------------------------------------------------------------ */
/* Small readers                                                       */
/* ------------------------------------------------------------------ */

function u16be(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function u32be(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] << 24) >>> 0) + ((bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3])
  );
}

function u16le(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function u24le(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function u32le(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0
  );
}

function i32le(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24);
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  let out = '';
  for (let index = 0; index < length; index += 1) {
    const code = bytes[offset + index];
    if (code === undefined) return out;
    out += String.fromCharCode(code);
  }
  return out;
}

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  if (bytes.length < signature.length) return false;
  for (let index = 0; index < signature.length; index += 1) {
    if (bytes[index] !== signature[index]) return false;
  }
  return true;
}

/* ------------------------------------------------------------------ */
/* Base64                                                              */
/* ------------------------------------------------------------------ */

/** Decodes standard base64 (no data-URL prefix) into bytes. */
export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

/** Splits a `data:` URL into its declared MIME type and decoded bytes. */
export function dataUrlToBytes(dataUrl: string): { mimeType: string; bytes: Uint8Array } | null {
  const match = /^data:([^;,]+);base64,(.*)$/s.exec(dataUrl);
  if (!match) return null;
  try {
    return { mimeType: match[1], bytes: base64ToBytes(match[2]) };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* PNG                                                                 */
/* ------------------------------------------------------------------ */

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;

function readPng(bytes: Uint8Array): HeaderResult {
  if (bytes.length < 33) return { ok: false, code: 'malformed', detail: 'The file is shorter than a PNG header.' };
  if (ascii(bytes, 12, 4) !== 'IHDR') {
    return { ok: false, code: 'malformed', detail: 'The first PNG chunk is not IHDR, so the file is not a valid PNG.' };
  }

  const width = u32be(bytes, 16);
  const height = u32be(bytes, 20);
  const bitDepth = bytes[24];
  const colorType = bytes[25];
  const interlace = bytes[28];

  if (interlace !== 0 && interlace !== 1) {
    return { ok: false, code: 'malformed', detail: 'The PNG declares an interlace method that does not exist.' };
  }

  let hasAlphaChannel = colorType === 4 || colorType === 6;
  let animated = false;

  // Walk the chunk list far enough to find acTL (animated PNG) or tRNS
  // (palette transparency). Both change what the file actually is, and neither
  // is visible from the first chunk alone.
  let offset = 8;
  const scanLimit = Math.min(bytes.length, LIMITS.maxHeaderScanBytes);
  while (offset + 8 <= scanLimit) {
    const length = u32be(bytes, offset);
    const type = ascii(bytes, offset + 4, 4);
    if (length > bytes.length) {
      return { ok: false, code: 'malformed', detail: `The PNG chunk "${type}" declares a length past the end of the file.` };
    }
    if (type === 'acTL') animated = true;
    if (type === 'tRNS') hasAlphaChannel = true;
    if (type === 'IDAT' || type === 'IEND') break;
    offset += 12 + length;
  }

  if (animated) {
    return {
      ok: false,
      code: 'animated',
      detail: 'This is an animated PNG. A logo is drawn at seven fixed sizes, so an animation cannot be carried through.'
    };
  }

  return {
    ok: true,
    facts: {
      format: 'png',
      mimeType: 'image/png',
      width,
      height,
      hasAlphaChannel,
      bitDepth: bitDepth || 8,
      byteLength: bytes.length
    }
  };
}

/* ------------------------------------------------------------------ */
/* JPEG                                                                */
/* ------------------------------------------------------------------ */

const SOF_MARKERS = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

function readJpeg(bytes: Uint8Array): HeaderResult {
  let offset = 2;
  const scanLimit = Math.min(bytes.length, LIMITS.maxHeaderScanBytes);

  while (offset + 4 <= scanLimit) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    let marker = bytes[offset + 1];
    // Fill bytes: any run of 0xFF before the marker is padding.
    let cursor = offset + 1;
    while (marker === 0xff && cursor + 1 < scanLimit) {
      cursor += 1;
      marker = bytes[cursor];
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset = cursor + 1;
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) break;

    const segmentLength = u16be(bytes, cursor + 1);
    if (segmentLength < 2) {
      return { ok: false, code: 'malformed', detail: 'A JPEG segment declares an impossible length.' };
    }
    if (SOF_MARKERS.has(marker)) {
      const height = u16be(bytes, cursor + 4);
      const width = u16be(bytes, cursor + 6);
      return {
        ok: true,
        facts: {
          format: 'jpeg',
          mimeType: 'image/jpeg',
          width,
          height,
          hasAlphaChannel: false,
          bitDepth: bytes[cursor + 3] || 8,
          byteLength: bytes.length
        }
      };
    }
    offset = cursor + 1 + segmentLength;
  }

  return {
    ok: false,
    code: 'malformed',
    detail: 'The JPEG carries no frame header, so its size cannot be read without decoding it.'
  };
}

/* ------------------------------------------------------------------ */
/* WebP                                                                */
/* ------------------------------------------------------------------ */

function readWebp(bytes: Uint8Array): HeaderResult {
  if (bytes.length < 30) return { ok: false, code: 'malformed', detail: 'The file is shorter than a WebP header.' };

  let offset = 12;
  const scanLimit = Math.min(bytes.length, LIMITS.maxHeaderScanBytes);
  let width = 0;
  let height = 0;
  let hasAlphaChannel = false;
  let animated = false;
  let found = false;

  while (offset + 8 <= scanLimit) {
    const fourcc = ascii(bytes, offset, 4);
    const size = u32le(bytes, offset + 4);
    const payload = offset + 8;
    if (size > bytes.length) {
      return { ok: false, code: 'malformed', detail: `The WebP chunk "${fourcc}" declares a length past the end of the file.` };
    }

    if (fourcc === 'VP8X') {
      const flags = bytes[payload];
      hasAlphaChannel = (flags & 0x10) !== 0;
      if ((flags & 0x02) !== 0) animated = true;
      width = u24le(bytes, payload + 4) + 1;
      height = u24le(bytes, payload + 7) + 1;
      found = true;
    } else if (fourcc === 'ANIM' || fourcc === 'ANMF') {
      animated = true;
    } else if (fourcc === 'ALPH') {
      hasAlphaChannel = true;
    } else if (fourcc === 'VP8 ' && !found) {
      if (bytes[payload + 3] !== 0x9d || bytes[payload + 4] !== 0x01 || bytes[payload + 5] !== 0x2a) {
        return { ok: false, code: 'malformed', detail: 'The lossy WebP frame header is missing its start code.' };
      }
      width = u16le(bytes, payload + 6) & 0x3fff;
      height = u16le(bytes, payload + 8) & 0x3fff;
      found = true;
    } else if (fourcc === 'VP8L' && !found) {
      if (bytes[payload] !== 0x2f) {
        return { ok: false, code: 'malformed', detail: 'The lossless WebP frame header is missing its signature byte.' };
      }
      const packed = u32le(bytes, payload + 1);
      width = (packed & 0x3fff) + 1;
      height = ((packed >>> 14) & 0x3fff) + 1;
      hasAlphaChannel = hasAlphaChannel || ((packed >>> 28) & 0x01) === 1;
      found = true;
    }

    offset = payload + size + (size % 2);
  }

  if (animated) {
    return {
      ok: false,
      code: 'animated',
      detail: 'This is an animated WebP. A logo is drawn at seven fixed sizes, so an animation cannot be carried through.'
    };
  }
  if (!found) {
    return { ok: false, code: 'malformed', detail: 'The WebP file carries no image chunk that states its size.' };
  }

  return {
    ok: true,
    facts: {
      format: 'webp',
      mimeType: 'image/webp',
      width,
      height,
      hasAlphaChannel,
      bitDepth: 8,
      byteLength: bytes.length
    }
  };
}

/* ------------------------------------------------------------------ */
/* BMP                                                                 */
/* ------------------------------------------------------------------ */

function readBmp(bytes: Uint8Array): HeaderResult {
  if (bytes.length < 26) return { ok: false, code: 'malformed', detail: 'The file is shorter than a BMP header.' };
  const dibSize = u32le(bytes, 14);

  let width: number;
  let height: number;
  let bitCount: number;

  if (dibSize === 12) {
    width = u16le(bytes, 18);
    height = u16le(bytes, 20);
    bitCount = u16le(bytes, 24);
  } else if (dibSize >= 40 && bytes.length >= 30) {
    width = i32le(bytes, 18);
    height = i32le(bytes, 22);
    bitCount = u16le(bytes, 28);
  } else {
    return { ok: false, code: 'malformed', detail: `The BMP declares an information header of ${dibSize} bytes, which is not a known form.` };
  }

  return {
    ok: true,
    facts: {
      format: 'bmp',
      mimeType: 'image/bmp',
      width: Math.abs(width),
      height: Math.abs(height),
      hasAlphaChannel: bitCount === 32,
      bitDepth: 8,
      byteLength: bytes.length
    }
  };
}

/* ------------------------------------------------------------------ */
/* The allow list                                                      */
/* ------------------------------------------------------------------ */

function looksLikeMarkup(bytes: Uint8Array): boolean {
  let index = 0;
  // Skip a UTF-8 byte-order mark and any leading whitespace.
  if (startsWith(bytes, [0xef, 0xbb, 0xbf])) index = 3;
  while (index < bytes.length && (bytes[index] === 0x20 || bytes[index] === 0x09 || bytes[index] === 0x0a || bytes[index] === 0x0d)) {
    index += 1;
  }
  const head = ascii(bytes, index, 5).toLowerCase();
  return head.startsWith('<?xml') || head.startsWith('<svg') || head.startsWith('<!doc');
}

/**
 * Identifies the container from its own bytes and reads the header.
 *
 * The allow list is deliberately short. Every entry is a single-frame raster
 * format a canvas can draw and this file can measure without decoding, which is
 * the whole requirement a logo has. Everything else is refused by name with the
 * reason, rather than being handed to a decoder to find out.
 */
export function inspectBytes(bytes: Uint8Array): HeaderResult {
  if (bytes.length === 0) return { ok: false, code: 'empty', detail: 'The file is empty.' };
  if (bytes.length > LIMITS.maxSourceBytes) {
    return {
      ok: false,
      code: 'tooLarge',
      detail: `The file is ${formatBytes(bytes.length)}. The limit is ${formatBytes(LIMITS.maxSourceBytes)}.`
    };
  }

  let header: HeaderResult;

  if (startsWith(bytes, PNG_SIGNATURE)) {
    header = readPng(bytes);
  } else if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    header = readJpeg(bytes);
  } else if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') {
    header = readWebp(bytes);
  } else if (startsWith(bytes, [0x42, 0x4d])) {
    header = readBmp(bytes);
  } else if (ascii(bytes, 0, 3) === 'GIF') {
    return {
      ok: false,
      code: 'animated',
      detail:
        'GIF is refused because a GIF can carry an animation and this feature produces seven fixed-size still images. Save the frame you want as a PNG.'
    };
  } else if (looksLikeMarkup(bytes)) {
    return {
      ok: false,
      code: 'vector',
      detail:
        'SVG and other markup files are refused. An SVG is a document that can carry scripts and references to other files, and none of that belongs in a logo pipeline. Export the drawing as a PNG first.'
    };
  } else if (startsWith(bytes, [0x00, 0x00, 0x01, 0x00]) || startsWith(bytes, [0x00, 0x00, 0x02, 0x00])) {
    return {
      ok: false,
      code: 'unsupportedContainer',
      detail: 'This is an icon container holding several images at once. Pick the single image you want instead.'
    };
  } else if (startsWith(bytes, [0x49, 0x49, 0x2a, 0x00]) || startsWith(bytes, [0x4d, 0x4d, 0x00, 0x2a])) {
    return {
      ok: false,
      code: 'unsupportedContainer',
      detail: 'TIFF is not on the allow list: it can hold several pages and colour models this feature does not read.'
    };
  } else {
    return {
      ok: false,
      code: 'unsupportedContainer',
      detail: 'The first bytes of this file match no format on the allow list: PNG, JPEG, WebP and BMP.'
    };
  }

  if (!header.ok) return header;

  const { width, height } = header.facts;

  // A truncated header reads back as zero rather than as a number, because the
  // bitwise readers coerce a missing byte to zero. Either way it is refused
  // here rather than handed to the decoder to find out.
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    return {
      ok: false,
      code: 'malformed',
      detail: 'The header does not state a usable width and height, so the file is probably truncated.'
    };
  }
  if (width > LIMITS.maxDimension || height > LIMITS.maxDimension) {
    return {
      ok: false,
      code: 'tooWide',
      detail: `The image is ${width}x${height}. Neither side may exceed ${LIMITS.maxDimension} pixels.`
    };
  }
  if (width < LIMITS.minDimension || height < LIMITS.minDimension) {
    return {
      ok: false,
      code: 'tooSmall',
      detail: `The image is ${width}x${height}. Both sides must be at least ${LIMITS.minDimension} pixels, or the largest display size would be guesswork.`
    };
  }
  if (width * height > LIMITS.maxPixels) {
    return {
      ok: false,
      code: 'tooManyPixels',
      detail: `The image would decode to ${(width * height).toLocaleString()} pixels. The limit is ${LIMITS.maxPixels.toLocaleString()}.`
    };
  }

  return header;
}

/* ------------------------------------------------------------------ */
/* Bounded decode                                                      */
/* ------------------------------------------------------------------ */

/**
 * Decodes an inspected file, with a time budget and a dimension cross-check.
 *
 * The cross-check matters more than it looks: a file whose header says one size
 * and whose decoder produces another is a file where one of the two is lying,
 * and neither answer is safe to build a rendering pipeline on.
 */
export async function decodeBounded(bytes: Uint8Array, facts: HeaderFacts): Promise<DecodeResult> {
  // Copied into a freshly allocated buffer: a view onto a shared buffer is not
  // a `BlobPart`, and the source is already bounded to a few megabytes.
  const owned = new Uint8Array(bytes.length);
  owned.set(bytes);
  const blob = new Blob([owned], { type: facts.mimeType });

  let timer = 0;
  const timeout = new Promise<'timeout'>((resolve) => {
    timer = window.setTimeout(() => resolve('timeout'), LIMITS.decodeTimeoutMs);
  });

  let outcome: ImageBitmap | 'timeout';
  try {
    outcome = await Promise.race([createImageBitmap(blob), timeout]);
  } catch (error) {
    window.clearTimeout(timer);
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, code: 'decodeFailed', detail: `The image decoder refused the file: ${message}` };
  }
  window.clearTimeout(timer);

  if (outcome === 'timeout') {
    return {
      ok: false,
      code: 'decodeTimeout',
      detail: `Decoding did not finish within ${LIMITS.decodeTimeoutMs / 1000} seconds, so it was stopped. Nothing was changed.`
    };
  }

  if (outcome.width !== facts.width || outcome.height !== facts.height) {
    const decoded = `${outcome.width}x${outcome.height}`;
    outcome.close();
    return {
      ok: false,
      code: 'headerMismatch',
      detail: `The header says the image is ${facts.width}x${facts.height} but the decoder produced ${decoded}. A file that disagrees with itself is not used.`
    };
  }

  return { ok: true, source: { bitmap: outcome, facts } };
}

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

/** Human-readable byte count. Used in copy, so it never invents precision. */
export function formatBytes(count: number): string {
  if (count < 1024) return `${count} bytes`;
  if (count < 1024 * 1024) return `${(count / 1024).toFixed(1)} KiB`;
  return `${(count / (1024 * 1024)).toFixed(2)} MiB`;
}
