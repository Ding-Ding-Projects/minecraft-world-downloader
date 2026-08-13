/**
 * A QR encoder, drawn in this process.
 *
 * A pairing QR carries the shared secret, so it is generated here rather than
 * fetched from a chart service or a remote generator — either of those would
 * receive the secret on its way to being rendered. There is no network call in
 * this file, and none anywhere in the pairing flow.
 *
 * It writes the whole standard structure rather than a convenient subset:
 * function patterns and their reserved areas, multi-block Reed-Solomon with
 * interleaving, the version field for versions 7 and above, all eight masks
 * scored by the published penalty rules, and both copies of the format field.
 * The self test round-trips every version and level through this feature's own
 * reader, so a structural mistake fails a visible check rather than producing a
 * picture that only some phones can read.
 */

import {
  ALIGNMENT_CENTRES,
  BLOCK_SPECS,
  type EccLevel,
  MASK_FUNCTIONS,
  MAX_VERSION,
  byteCountBits,
  dataCodewordCount,
  formatBits,
  reedSolomonEncode,
  remainderBits,
  sizeForVersion,
  versionBits
} from './qrtables';

export interface QrCode {
  size: number;
  version: number;
  level: EccLevel;
  mask: number;
  /** `true` is a dark module. */
  modules: boolean[][];
}

export interface EncodeOptions {
  level?: EccLevel;
  /** Never encode below this version, so a short URI still draws a stable size. */
  minVersion?: number;
  /**
   * Defaults to true. A long pairing URI cannot fit at the strongest levels, and
   * a drawn code at a weaker level is more use than a refusal — the level that
   * was actually used is reported on the result and stated beside the picture.
   */
  allowLevelDowngrade?: boolean;
}

export class QrCapacityError extends Error {}

/* ------------------------------------------------------------------ */
/* Encoding                                                            */
/* ------------------------------------------------------------------ */

export function encodeQr(text: string, options: EncodeOptions = {}): QrCode {
  const preferred: EccLevel = options.level ?? 'M';
  if (options.allowLevelDowngrade === false) return encodeAtLevel(text, preferred, options.minVersion ?? 1);

  const order: EccLevel[] = ['H', 'Q', 'M', 'L'];
  const candidates = order.slice(order.indexOf(preferred));
  let lastError: unknown = null;
  for (const level of candidates) {
    try {
      return encodeAtLevel(text, level, options.minVersion ?? 1);
    } catch (error) {
      if (!(error instanceof QrCapacityError)) throw error;
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new QrCapacityError('That text cannot be drawn as a QR code here.');
}

function encodeAtLevel(text: string, level: EccLevel, minVersion: number): QrCode {
  const data = new TextEncoder().encode(text);
  const version = pickVersion(data.length, level, minVersion);
  const size = sizeForVersion(version);

  const codewords = buildCodewords(data, version, level);
  const { modules, reserved } = buildFunctionPatterns(size, version);
  placeData(modules, reserved, codewords, size, version);

  let best: QrCode | null = null;
  let bestPenalty = Number.POSITIVE_INFINITY;
  for (let mask = 0; mask < 8; mask += 1) {
    const candidate = applyMaskAndFormat(modules, reserved, size, version, level, mask);
    const penalty = scorePenalty(candidate);
    if (penalty < bestPenalty) {
      bestPenalty = penalty;
      best = { size, version, level, mask, modules: candidate };
    }
  }
  if (!best) throw new Error('No mask could be applied, which should be impossible.');
  return best;
}

function pickVersion(byteLength: number, level: EccLevel, minVersion: number): number {
  for (let version = Math.max(1, minVersion); version <= MAX_VERSION; version += 1) {
    const capacityBits = dataCodewordCount(version, level) * 8;
    const neededBits = 4 + byteCountBits(version) + byteLength * 8;
    if (neededBits <= capacityBits) return version;
  }
  throw new QrCapacityError(
    `That text is ${byteLength} bytes, which is beyond what this encoder draws (QR versions 1 to ${MAX_VERSION} at error correction level ${level}).`
  );
}

function buildCodewords(data: Uint8Array, version: number, level: EccLevel): number[] {
  const spec = BLOCK_SPECS[version][level];
  const capacityCodewords = dataCodewordCount(version, level);

  const bits: number[] = [];
  const push = (value: number, length: number): void => {
    for (let index = length - 1; index >= 0; index -= 1) bits.push((value >> index) & 1);
  };
  push(0b0100, 4);
  push(data.length, byteCountBits(version));
  for (const byte of data) push(byte, 8);

  const capacityBits = capacityCodewords * 8;
  push(0, Math.min(4, capacityBits - bits.length));
  while (bits.length % 8 !== 0) bits.push(0);

  const stream: number[] = [];
  for (let index = 0; index < bits.length; index += 8) {
    stream.push(Number.parseInt(bits.slice(index, index + 8).join(''), 2));
  }
  const padding = [0xec, 0x11];
  let padIndex = 0;
  while (stream.length < capacityCodewords) {
    stream.push(padding[padIndex % 2]);
    padIndex += 1;
  }

  // Split into blocks exactly as the structure table describes, compute the
  // check symbols per block, then interleave: reading a QR back depends on the
  // interleaving being right far more than on any single block being right.
  const dataBlocks: number[][] = [];
  const eccBlocks: number[][] = [];
  let cursor = 0;
  for (const group of spec.groups) {
    for (let block = 0; block < group.blocks; block += 1) {
      const slice = stream.slice(cursor, cursor + group.dataCodewords);
      cursor += group.dataCodewords;
      dataBlocks.push(slice);
      eccBlocks.push(reedSolomonEncode(slice, spec.ecPerBlock));
    }
  }

  const interleaved: number[] = [];
  const longestData = Math.max(...dataBlocks.map((block) => block.length));
  for (let index = 0; index < longestData; index += 1) {
    for (const block of dataBlocks) if (index < block.length) interleaved.push(block[index]);
  }
  for (let index = 0; index < spec.ecPerBlock; index += 1) {
    for (const block of eccBlocks) interleaved.push(block[index]);
  }
  return interleaved;
}

/* ------------------------------------------------------------------ */
/* Function patterns                                                   */
/* ------------------------------------------------------------------ */

interface Skeleton {
  modules: boolean[][];
  reserved: boolean[][];
}

export function buildFunctionPatterns(size: number, version: number): Skeleton {
  const modules: boolean[][] = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const reserved: boolean[][] = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));

  const finder = (row: number, column: number): void => {
    for (let dy = -1; dy <= 7; dy += 1) {
      for (let dx = -1; dx <= 7; dx += 1) {
        const y = row + dy;
        const x = column + dx;
        if (y < 0 || y >= size || x < 0 || x >= size) continue;
        const inner = dy >= 0 && dy <= 6 && dx >= 0 && dx <= 6;
        const ring = inner && (dy === 0 || dy === 6 || dx === 0 || dx === 6);
        const core = dy >= 2 && dy <= 4 && dx >= 2 && dx <= 4;
        modules[y][x] = ring || core;
        reserved[y][x] = true;
      }
    }
  };
  finder(0, 0);
  finder(0, size - 7);
  finder(size - 7, 0);

  for (let index = 8; index < size - 8; index += 1) {
    const dark = index % 2 === 0;
    modules[6][index] = dark;
    reserved[6][index] = true;
    modules[index][6] = dark;
    reserved[index][6] = true;
  }

  for (const row of ALIGNMENT_CENTRES[version] ?? []) {
    for (const column of ALIGNMENT_CENTRES[version] ?? []) {
      if ((row === 6 && column === 6) || (row === 6 && column === size - 7) || (row === size - 7 && column === 6)) {
        continue;
      }
      for (let dy = -2; dy <= 2; dy += 1) {
        for (let dx = -2; dx <= 2; dx += 1) {
          modules[row + dy][column + dx] = Math.max(Math.abs(dy), Math.abs(dx)) !== 1;
          reserved[row + dy][column + dx] = true;
        }
      }
    }
  }

  // The one module that is always dark, and the two format fields.
  modules[size - 8][8] = true;
  reserved[size - 8][8] = true;
  for (const [row, column] of formatPositionsA(size)) reserved[row][column] = true;
  for (const [row, column] of formatPositionsB(size)) reserved[row][column] = true;

  if (version >= 7) {
    for (const [row, column] of versionPositions(size)) reserved[row][column] = true;
  }

  return { modules, reserved };
}

/** The first format copy, bit 0 first. */
export function formatPositionsA(size: number): Array<[number, number]> {
  const positions: Array<[number, number]> = [];
  for (let index = 0; index <= 5; index += 1) positions.push([8, index]);
  positions.push([8, 7], [8, 8], [7, 8]);
  for (let index = 5; index >= 0; index -= 1) positions.push([index, 8]);
  return positions;
}

/** The second format copy, bit 0 first. */
export function formatPositionsB(size: number): Array<[number, number]> {
  const positions: Array<[number, number]> = [];
  for (let index = 0; index < 8; index += 1) positions.push([8, size - 1 - index]);
  for (let index = 7; index >= 1; index -= 1) positions.push([size - index, 8]);
  return positions;
}

/** Both version fields, bit 0 first, as [row, column] pairs. */
export function versionPositions(size: number): Array<[number, number]> {
  const positions: Array<[number, number]> = [];
  for (let index = 0; index < 18; index += 1) {
    const a = Math.floor(index / 3);
    const b = size - 11 + (index % 3);
    positions.push([a, b]);
  }
  for (let index = 0; index < 18; index += 1) {
    const a = size - 11 + (index % 3);
    const b = Math.floor(index / 3);
    positions.push([a, b]);
  }
  return positions;
}

function placeData(
  modules: boolean[][],
  reserved: boolean[][],
  codewords: number[],
  size: number,
  version: number
): void {
  const bits: boolean[] = [];
  for (const codeword of codewords) {
    for (let index = 7; index >= 0; index -= 1) bits.push(((codeword >> index) & 1) === 1);
  }
  for (let index = 0; index < remainderBits(version); index += 1) bits.push(false);

  let cursor = 0;
  let upward = true;
  let right = size - 1;
  while (right >= 1) {
    // Column six is the vertical timing pattern and is never part of a pair.
    if (right === 6) right = 5;
    for (let step = 0; step < size; step += 1) {
      const row = upward ? size - 1 - step : step;
      for (const column of [right, right - 1]) {
        if (reserved[row][column]) continue;
        modules[row][column] = cursor < bits.length ? bits[cursor] : false;
        cursor += 1;
      }
    }
    upward = !upward;
    right -= 2;
  }
}

function applyMaskAndFormat(
  base: boolean[][],
  reserved: boolean[][],
  size: number,
  version: number,
  level: EccLevel,
  mask: number
): boolean[][] {
  const maskFn = MASK_FUNCTIONS[mask];
  const out = base.map((row) => [...row]);
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      if (reserved[row][column]) continue;
      if (maskFn(row, column)) out[row][column] = !out[row][column];
    }
  }

  const format = formatBits(level, mask);
  const writeFormat = (positions: Array<[number, number]>): void => {
    positions.forEach(([row, column], index) => {
      out[row][column] = ((format >> index) & 1) === 1;
    });
  };
  writeFormat(formatPositionsA(size));
  writeFormat(formatPositionsB(size));
  out[size - 8][8] = true;

  if (version >= 7) {
    const info = versionBits(version);
    versionPositions(size).forEach(([row, column], index) => {
      out[row][column] = ((info >> (index % 18)) & 1) === 1;
    });
  }

  return out;
}

/* ------------------------------------------------------------------ */
/* Penalty scoring                                                     */
/* ------------------------------------------------------------------ */

export function scorePenalty(modules: boolean[][]): number {
  const size = modules.length;
  let penalty = 0;

  // Rule 1: runs of five or more identical modules in a row or a column.
  const runPenalty = (get: (a: number, b: number) => boolean): number => {
    let total = 0;
    for (let a = 0; a < size; a += 1) {
      let run = 1;
      for (let b = 1; b < size; b += 1) {
        if (get(a, b) === get(a, b - 1)) {
          run += 1;
        } else {
          if (run >= 5) total += 3 + (run - 5);
          run = 1;
        }
      }
      if (run >= 5) total += 3 + (run - 5);
    }
    return total;
  };
  penalty += runPenalty((row, column) => modules[row][column]);
  penalty += runPenalty((column, row) => modules[row][column]);

  // Rule 2: two-by-two blocks of one colour.
  for (let row = 0; row < size - 1; row += 1) {
    for (let column = 0; column < size - 1; column += 1) {
      const first = modules[row][column];
      if (
        modules[row][column + 1] === first &&
        modules[row + 1][column] === first &&
        modules[row + 1][column + 1] === first
      ) {
        penalty += 3;
      }
    }
  }

  // Rule 3: the finder-like 1:1:3:1:1 sequence with four light modules beside it.
  const pattern = [true, false, true, true, true, false, true];
  const light = [false, false, false, false];
  const matches = (values: boolean[], start: number, wanted: boolean[]): boolean =>
    wanted.every((value, index) => values[start + index] === value);
  const scanLine = (values: boolean[]): number => {
    let total = 0;
    for (let index = 0; index + 11 <= values.length; index += 1) {
      if (matches(values, index, [...pattern, ...light]) || matches(values, index, [...light, ...pattern])) {
        total += 40;
      }
    }
    return total;
  };
  for (let row = 0; row < size; row += 1) penalty += scanLine(modules[row]);
  for (let column = 0; column < size; column += 1) {
    penalty += scanLine(modules.map((row) => row[column]));
  }

  // Rule 4: how far the dark proportion sits from half.
  let dark = 0;
  for (const row of modules) for (const cell of row) if (cell) dark += 1;
  const percent = (dark * 100) / (size * size);
  penalty += Math.floor(Math.abs(percent - 50) / 5) * 10;

  return penalty;
}

/* ------------------------------------------------------------------ */
/* Drawing                                                             */
/* ------------------------------------------------------------------ */

export interface QrDrawOptions {
  /** Pixels per module. Larger modules stay scannable at a smaller display. */
  moduleSize?: number;
  /** Modules of margin. Four is the standard quiet zone; less stops scanners. */
  quietZone?: number;
  /** The real text alternative: what this picture is and what it pairs. */
  description: string;
}

/**
 * Draws the code as an SVG.
 *
 * The colours are true black on true white in both themes rather than tinted
 * into the palette, because a QR that has been styled to match a dark interface
 * stops being readable by the camera it exists for. The quiet zone is honoured
 * for the same reason.
 */
export function qrToSvg(code: QrCode, options: QrDrawOptions): SVGSVGElement {
  const moduleSize = options.moduleSize ?? 6;
  const quiet = options.quietZone ?? 4;
  const pixels = (code.size + quiet * 2) * moduleSize;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${pixels} ${pixels}`);
  svg.setAttribute('width', String(pixels));
  svg.setAttribute('height', String(pixels));
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', options.description);
  svg.classList.add('authenticator-qr');

  const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
  title.textContent = options.description;
  svg.append(title);

  const background = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  background.setAttribute('width', String(pixels));
  background.setAttribute('height', String(pixels));
  background.setAttribute('fill', '#ffffff');
  svg.append(background);

  let path = '';
  for (let row = 0; row < code.size; row += 1) {
    for (let column = 0; column < code.size; column += 1) {
      if (!code.modules[row][column]) continue;
      const x = (column + quiet) * moduleSize;
      const y = (row + quiet) * moduleSize;
      path += `M${x} ${y}h${moduleSize}v${moduleSize}h-${moduleSize}z`;
    }
  }
  const shape = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  shape.setAttribute('d', path);
  shape.setAttribute('fill', '#000000');
  svg.append(shape);
  return svg;
}

/** Draws the same code onto a canvas, used by the reader's round-trip check. */
export function qrToCanvas(code: QrCode, moduleSize = 4, quiet = 4): HTMLCanvasElement {
  const pixels = (code.size + quiet * 2) * moduleSize;
  const canvas = document.createElement('canvas');
  canvas.width = pixels;
  canvas.height = pixels;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This build cannot draw on a canvas, so the QR could not be rasterized.');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, pixels, pixels);
  context.fillStyle = '#000000';
  for (let row = 0; row < code.size; row += 1) {
    for (let column = 0; column < code.size; column += 1) {
      if (!code.modules[row][column]) continue;
      context.fillRect((column + quiet) * moduleSize, (row + quiet) * moduleSize, moduleSize, moduleSize);
    }
  }
  return canvas;
}
