/**
 * A QR reader, implemented in this process.
 *
 * Reading a pairing QR out of a picture is the one registration route that
 * avoids retyping a thirty-two character secret by hand, and it has to happen
 * locally for exactly the reason the encoder does: the picture contains the
 * secret. There is no network call here, no remote decoding service, and no
 * dependency outside this application.
 *
 * The pipeline is the ordinary one: luminance, an adaptive threshold, the three
 * finder patterns, a perspective transform onto the module grid, the format
 * field, the mask, de-interleaving, Reed-Solomon correction and finally the
 * segment stream. Every stage that cannot reach a confident answer reports what
 * it could not do rather than guessing — a mis-corrected block yields a pairing
 * URI that looks perfectly plausible and pairs the account with the wrong
 * secret, which is far worse than an honest failure.
 */

import {
  ALPHANUMERIC_TABLE,
  BLOCK_SPECS,
  type EccLevel,
  MASK_FUNCTIONS,
  alphanumericCountBits,
  byteCountBits,
  decodeFormat,
  numericCountBits,
  reedSolomonDecode,
  versionForSize
} from './qrtables';
import { buildFunctionPatterns, formatPositionsA, formatPositionsB } from './qrencode';

export class QrReadError extends Error {}

export interface QrReadResult {
  text: string;
  version: number;
  level: EccLevel;
  mask: number;
}

/* ------------------------------------------------------------------ */
/* Matrix decoding                                                     */
/* ------------------------------------------------------------------ */

/** Decodes a sampled module grid. `true` is a dark module. */
export function decodeMatrix(modules: boolean[][]): QrReadResult {
  const size = modules.length;
  const version = versionForSize(size);
  if (version === null) {
    throw new QrReadError(
      `A ${size} by ${size} module grid is not a QR code version 1 to 10, which is the range this reader handles. Paste the pairing link instead.`
    );
  }

  const readField = (positions: Array<[number, number]>): number => {
    let raw = 0;
    positions.forEach(([row, column], index) => {
      if (modules[row][column]) raw |= 1 << index;
    });
    return raw;
  };

  const format = decodeFormat(readField(formatPositionsA(size))) ?? decodeFormat(readField(formatPositionsB(size)));
  if (!format) {
    throw new QrReadError('Neither copy of the format field could be read, so the picture is not a readable QR code.');
  }

  const { reserved } = buildFunctionPatterns(size, version);
  const maskFn = MASK_FUNCTIONS[format.mask];
  const unmasked = modules.map((row, rowIndex) =>
    row.map((cell, columnIndex) => (reserved[rowIndex][columnIndex] || !maskFn(rowIndex, columnIndex) ? cell : !cell))
  );

  const bits: boolean[] = [];
  let upward = true;
  let right = size - 1;
  while (right >= 1) {
    if (right === 6) right = 5;
    for (let step = 0; step < size; step += 1) {
      const row = upward ? size - 1 - step : step;
      for (const column of [right, right - 1]) {
        if (reserved[row][column]) continue;
        bits.push(unmasked[row][column]);
      }
    }
    upward = !upward;
    right -= 2;
  }

  const codewords: number[] = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    let value = 0;
    for (let offset = 0; offset < 8; offset += 1) value = (value << 1) | (bits[index + offset] ? 1 : 0);
    codewords.push(value);
  }

  const data = deinterleaveAndCorrect(codewords, version, format.level);
  const text = parseSegments(data, version);
  return { text, version, level: format.level, mask: format.mask };
}

function deinterleaveAndCorrect(codewords: number[], version: number, level: EccLevel): number[] {
  const spec = BLOCK_SPECS[version][level];
  const lengths: number[] = [];
  for (const group of spec.groups) {
    for (let index = 0; index < group.blocks; index += 1) lengths.push(group.dataCodewords);
  }
  const blockCount = lengths.length;
  const expected = lengths.reduce((total, value) => total + value, 0) + blockCount * spec.ecPerBlock;
  if (codewords.length < expected) {
    throw new QrReadError(
      `Only ${codewords.length} codewords were sampled where version ${version} level ${level} needs ${expected}. The picture is probably too small or too blurred to read.`
    );
  }

  const dataBlocks: number[][] = lengths.map(() => []);
  const eccBlocks: number[][] = lengths.map(() => []);
  let cursor = 0;
  const longest = Math.max(...lengths);
  for (let index = 0; index < longest; index += 1) {
    for (let block = 0; block < blockCount; block += 1) {
      if (index < lengths[block]) {
        dataBlocks[block].push(codewords[cursor]);
        cursor += 1;
      }
    }
  }
  for (let index = 0; index < spec.ecPerBlock; index += 1) {
    for (let block = 0; block < blockCount; block += 1) {
      eccBlocks[block].push(codewords[cursor]);
      cursor += 1;
    }
  }

  const out: number[] = [];
  for (let block = 0; block < blockCount; block += 1) {
    const corrected = reedSolomonDecode([...dataBlocks[block], ...eccBlocks[block]], spec.ecPerBlock);
    if (!corrected) {
      throw new QrReadError(
        `Block ${block + 1} of ${blockCount} holds more damage than its check symbols can repair, so nothing was read. Try a sharper picture, or paste the pairing link.`
      );
    }
    out.push(...corrected.slice(0, lengths[block]));
  }
  return out;
}

function parseSegments(data: number[], version: number): string {
  let cursor = 0;
  const totalBits = data.length * 8;
  const read = (count: number): number => {
    if (cursor + count > totalBits) {
      throw new QrReadError('The data stream ended in the middle of a segment, so the picture was only partly read.');
    }
    let value = 0;
    for (let index = 0; index < count; index += 1) {
      const bitIndex = cursor + index;
      const bit = (data[bitIndex >> 3] >> (7 - (bitIndex & 7))) & 1;
      value = (value << 1) | bit;
    }
    cursor += count;
    return value;
  };

  let text = '';
  const bytes: number[] = [];
  const flushBytes = (): void => {
    if (bytes.length === 0) return;
    text += decodeBytes(Uint8Array.from(bytes));
    bytes.length = 0;
  };

  while (cursor + 4 <= totalBits) {
    const mode = read(4);
    if (mode === 0b0000) break;
    if (mode === 0b0111) {
      // An ECI header names the byte encoding. UTF-8 is what everything issuing
      // a pairing URI uses, and it is what `decodeBytes` tries first anyway.
      const first = read(8);
      if ((first & 0b1100_0000) === 0b1000_0000) read(8);
      else if ((first & 0b1110_0000) === 0b1100_0000) read(16);
      continue;
    }
    if (mode === 0b0100) {
      const count = read(byteCountBits(version));
      for (let index = 0; index < count; index += 1) bytes.push(read(8));
      continue;
    }
    flushBytes();
    if (mode === 0b0001) {
      let remaining = read(numericCountBits(version));
      while (remaining >= 3) {
        text += String(read(10)).padStart(3, '0');
        remaining -= 3;
      }
      if (remaining === 2) text += String(read(7)).padStart(2, '0');
      else if (remaining === 1) text += String(read(4));
      continue;
    }
    if (mode === 0b0010) {
      let remaining = read(alphanumericCountBits(version));
      while (remaining >= 2) {
        const pair = read(11);
        text += ALPHANUMERIC_TABLE[Math.floor(pair / 45)] + ALPHANUMERIC_TABLE[pair % 45];
        remaining -= 2;
      }
      if (remaining === 1) text += ALPHANUMERIC_TABLE[read(6)];
      continue;
    }
    throw new QrReadError(
      `This QR code uses mode ${mode.toString(2).padStart(4, '0')}, which this reader does not handle. Paste the pairing link instead.`
    );
  }
  flushBytes();

  if (text === '') throw new QrReadError('The QR code was read but held no text.');
  return text;
}

function decodeBytes(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    // The specification's default for byte mode is ISO-8859-1; falling back to
    // it means a code written by an older encoder still reads correctly.
    return new TextDecoder('iso-8859-1').decode(bytes);
  }
}

/* ------------------------------------------------------------------ */
/* Image decoding                                                      */
/* ------------------------------------------------------------------ */

interface BinaryImage {
  width: number;
  height: number;
  /** 1 means a dark pixel. */
  bits: Uint8Array;
}

interface FinderCandidate {
  x: number;
  y: number;
  moduleSize: number;
  count: number;
}

/** Reads a QR code out of raw pixels. */
export function decodeImageData(image: ImageData): QrReadResult {
  const binary = binarize(image);
  const candidates = findFinderPatterns(binary);
  if (candidates.length < 3) {
    throw new QrReadError(
      `Only ${candidates.length} of the three corner squares of a QR code were found in that picture. Crop it closer to the code, or paste the pairing link instead.`
    );
  }

  let lastError: unknown = null;
  for (const triple of candidateTriples(candidates)) {
    try {
      const matrix = sampleGrid(binary, triple);
      return decodeMatrix(matrix);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error
    ? new QrReadError(lastError.message)
    : new QrReadError('That picture could not be read as a QR code.');
}

/**
 * Converts to luminance and thresholds locally.
 *
 * A single global threshold fails on a photograph with any gradient across it,
 * so the image is divided into blocks and each block is compared against the
 * average of its neighbourhood. A block with almost no contrast of its own
 * borrows its neighbours' threshold, which stops flat paper being turned into
 * noise.
 */
function binarize(image: ImageData): BinaryImage {
  const { width, height, data } = image;
  const luminance = new Uint8Array(width * height);
  for (let index = 0; index < width * height; index += 1) {
    const offset = index * 4;
    const alpha = data[offset + 3];
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    // A transparent pixel is treated as white, because a QR exported with a
    // transparent background is otherwise read as one solid dark square.
    const value = alpha < 128 ? 255 : (red * 306 + green * 601 + blue * 117) >> 10;
    luminance[index] = value;
  }

  const bits = new Uint8Array(width * height);
  const blockSize = 8;
  const blocksWide = Math.max(1, Math.ceil(width / blockSize));
  const blocksHigh = Math.max(1, Math.ceil(height / blockSize));

  if (blocksWide < 5 || blocksHigh < 5) {
    // Too small for a neighbourhood to mean anything: one threshold, honestly.
    let min = 255;
    let max = 0;
    for (const value of luminance) {
      if (value < min) min = value;
      if (value > max) max = value;
    }
    const threshold = (min + max) / 2;
    for (let index = 0; index < luminance.length; index += 1) {
      bits[index] = luminance[index] < threshold ? 1 : 0;
    }
    return { width, height, bits };
  }

  // A per-block black point, then a threshold smoothed over the neighbourhood.
  //
  // The block that needs care is the one with no contrast of its own — the
  // inside of a large dark module, or blank paper. Judging such a block on its
  // own average turns the middle of every fat dark square white, which is the
  // failure that looks like "no QR code here" on exactly the large, clean
  // pictures that should be easiest to read. Such a block borrows the black
  // point its neighbours already agreed on.
  const blackPoints = new Float32Array(blocksWide * blocksHigh);
  for (let blockY = 0; blockY < blocksHigh; blockY += 1) {
    for (let blockX = 0; blockX < blocksWide; blockX += 1) {
      let sum = 0;
      let count = 0;
      let min = 255;
      let max = 0;
      for (let y = blockY * blockSize; y < Math.min(height, (blockY + 1) * blockSize); y += 1) {
        for (let x = blockX * blockSize; x < Math.min(width, (blockX + 1) * blockSize); x += 1) {
          const value = luminance[y * width + x];
          sum += value;
          count += 1;
          if (value < min) min = value;
          if (value > max) max = value;
        }
      }
      let blackPoint = count > 0 ? sum / count : 128;
      if (max - min <= 24) {
        blackPoint = min / 2;
        if (blockY > 0 && blockX > 0) {
          const neighbourhood =
            (blackPoints[(blockY - 1) * blocksWide + blockX] +
              2 * blackPoints[blockY * blocksWide + blockX - 1] +
              blackPoints[(blockY - 1) * blocksWide + blockX - 1]) /
            4;
          if (min < neighbourhood) blackPoint = neighbourhood;
        }
      }
      blackPoints[blockY * blocksWide + blockX] = blackPoint;
    }
  }

  const thresholds = new Float32Array(blocksWide * blocksHigh);
  for (let blockY = 0; blockY < blocksHigh; blockY += 1) {
    for (let blockX = 0; blockX < blocksWide; blockX += 1) {
      let sum = 0;
      let count = 0;
      for (let dy = -2; dy <= 2; dy += 1) {
        for (let dx = -2; dx <= 2; dx += 1) {
          const y = Math.min(blocksHigh - 1, Math.max(0, blockY + dy));
          const x = Math.min(blocksWide - 1, Math.max(0, blockX + dx));
          sum += blackPoints[y * blocksWide + x];
          count += 1;
        }
      }
      thresholds[blockY * blocksWide + blockX] = sum / Math.max(1, count);
    }
  }

  for (let y = 0; y < height; y += 1) {
    const blockY = Math.min(blocksHigh - 1, Math.floor(y / blockSize));
    for (let x = 0; x < width; x += 1) {
      const blockX = Math.min(blocksWide - 1, Math.floor(x / blockSize));
      bits[y * width + x] = luminance[y * width + x] < thresholds[blockY * blocksWide + blockX] ? 1 : 0;
    }
  }
  return { width, height, bits };
}

function isDark(image: BinaryImage, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= image.width || y >= image.height) return false;
  return image.bits[y * image.width + x] === 1;
}

/** True when five consecutive runs are close enough to the 1:1:3:1:1 ratio. */
function matchesFinderRatio(runs: number[]): boolean {
  const total = runs.reduce((sum, value) => sum + value, 0);
  if (total < 7) return false;
  const unit = total / 7;
  const tolerance = unit / 2;
  return (
    Math.abs(unit - runs[0]) < tolerance &&
    Math.abs(unit - runs[1]) < tolerance &&
    Math.abs(3 * unit - runs[2]) < 3 * tolerance &&
    Math.abs(unit - runs[3]) < tolerance &&
    Math.abs(unit - runs[4]) < tolerance
  );
}

function centreOfRuns(end: number, runs: number[]): number {
  return end - runs[4] - runs[3] - runs[2] / 2;
}

function findFinderPatterns(image: BinaryImage): FinderCandidate[] {
  const found: FinderCandidate[] = [];

  for (let y = 0; y < image.height; y += 1) {
    const runs = [0, 0, 0, 0, 0];
    let state = 0;
    for (let x = 0; x < image.width; x += 1) {
      const dark = isDark(image, x, y);
      if ((state & 1) === 0) {
        // Currently counting a dark run.
        if (dark) {
          runs[state] += 1;
        } else {
          if (state === 4) {
            if (matchesFinderRatio(runs)) {
              considerCandidate(image, found, centreOfRuns(x, runs), y, runs);
            }
            runs[0] = runs[2];
            runs[1] = runs[3];
            runs[2] = runs[4];
            runs[3] = 1;
            runs[4] = 0;
            state = 3;
          } else {
            state += 1;
            runs[state] = 1;
          }
        }
      } else if (dark) {
        state += 1;
        runs[state] = 1;
      } else {
        runs[state] += 1;
      }
    }
    if (state === 4 && matchesFinderRatio(runs)) {
      considerCandidate(image, found, centreOfRuns(image.width, runs), y, runs);
    }
  }

  return found.filter((candidate) => candidate.count >= 2);
}

function considerCandidate(
  image: BinaryImage,
  found: FinderCandidate[],
  centreX: number,
  row: number,
  runs: number[]
): void {
  const total = runs.reduce((sum, value) => sum + value, 0);
  const moduleSize = total / 7;
  const centreY = verifyVertical(image, Math.round(centreX), row, total);
  if (centreY === null) return;
  const confirmedX = verifyHorizontal(image, Math.round(centreX), Math.round(centreY), total);
  if (confirmedX === null) return;

  for (const candidate of found) {
    if (
      Math.abs(candidate.x - confirmedX) < candidate.moduleSize &&
      Math.abs(candidate.y - centreY) < candidate.moduleSize
    ) {
      candidate.x = (candidate.x * candidate.count + confirmedX) / (candidate.count + 1);
      candidate.y = (candidate.y * candidate.count + centreY) / (candidate.count + 1);
      candidate.moduleSize = (candidate.moduleSize * candidate.count + moduleSize) / (candidate.count + 1);
      candidate.count += 1;
      return;
    }
  }
  found.push({ x: confirmedX, y: centreY, moduleSize, count: 1 });
}

function verifyVertical(image: BinaryImage, x: number, startY: number, originalTotal: number): number | null {
  const runs = [0, 0, 0, 0, 0];
  let y = startY;
  while (y >= 0 && isDark(image, x, y)) {
    runs[2] += 1;
    y -= 1;
  }
  if (y < 0) return null;
  while (y >= 0 && !isDark(image, x, y) && runs[1] <= originalTotal) {
    runs[1] += 1;
    y -= 1;
  }
  if (y < 0 || runs[1] > originalTotal) return null;
  while (y >= 0 && isDark(image, x, y) && runs[0] <= originalTotal) {
    runs[0] += 1;
    y -= 1;
  }
  if (runs[0] > originalTotal) return null;

  y = startY + 1;
  while (y < image.height && isDark(image, x, y)) {
    runs[2] += 1;
    y += 1;
  }
  if (y >= image.height) return null;
  while (y < image.height && !isDark(image, x, y) && runs[3] < originalTotal) {
    runs[3] += 1;
    y += 1;
  }
  if (y >= image.height || runs[3] >= originalTotal) return null;
  while (y < image.height && isDark(image, x, y) && runs[4] < originalTotal) {
    runs[4] += 1;
    y += 1;
  }
  if (runs[4] >= originalTotal) return null;

  const total = runs.reduce((sum, value) => sum + value, 0);
  if (Math.abs(total - originalTotal) * 5 >= 2 * originalTotal) return null;
  return matchesFinderRatio(runs) ? centreOfRuns(y, runs) : null;
}

function verifyHorizontal(image: BinaryImage, startX: number, y: number, originalTotal: number): number | null {
  const runs = [0, 0, 0, 0, 0];
  let x = startX;
  while (x >= 0 && isDark(image, x, y)) {
    runs[2] += 1;
    x -= 1;
  }
  if (x < 0) return null;
  while (x >= 0 && !isDark(image, x, y) && runs[1] <= originalTotal) {
    runs[1] += 1;
    x -= 1;
  }
  if (x < 0 || runs[1] > originalTotal) return null;
  while (x >= 0 && isDark(image, x, y) && runs[0] <= originalTotal) {
    runs[0] += 1;
    x -= 1;
  }
  if (runs[0] > originalTotal) return null;

  x = startX + 1;
  while (x < image.width && isDark(image, x, y)) {
    runs[2] += 1;
    x += 1;
  }
  if (x >= image.width) return null;
  while (x < image.width && !isDark(image, x, y) && runs[3] < originalTotal) {
    runs[3] += 1;
    x += 1;
  }
  if (x >= image.width || runs[3] >= originalTotal) return null;
  while (x < image.width && isDark(image, x, y) && runs[4] < originalTotal) {
    runs[4] += 1;
    x += 1;
  }
  if (runs[4] >= originalTotal) return null;

  const total = runs.reduce((sum, value) => sum + value, 0);
  if (5 * Math.abs(total - originalTotal) >= originalTotal) return null;
  return matchesFinderRatio(runs) ? centreOfRuns(x, runs) : null;
}

/**
 * Orders three candidates into top-left, top-right and bottom-left, and offers
 * the plausible triples in order of how much they look like a QR code.
 */
function candidateTriples(candidates: FinderCandidate[]): Array<[FinderCandidate, FinderCandidate, FinderCandidate]> {
  const sorted = [...candidates].sort((a, b) => b.count - a.count).slice(0, 6);
  const triples: Array<{ triple: [FinderCandidate, FinderCandidate, FinderCandidate]; score: number }> = [];
  for (let a = 0; a < sorted.length; a += 1) {
    for (let b = a + 1; b < sorted.length; b += 1) {
      for (let c = b + 1; c < sorted.length; c += 1) {
        const ordered = orderCorners(sorted[a], sorted[b], sorted[c]);
        if (!ordered) continue;
        const [topLeft, topRight, bottomLeft] = ordered;
        const side1 = distance(topLeft, topRight);
        const side2 = distance(topLeft, bottomLeft);
        const squareness = Math.abs(side1 - side2) / Math.max(side1, side2);
        const moduleSpread =
          Math.max(topLeft.moduleSize, topRight.moduleSize, bottomLeft.moduleSize) /
          Math.max(0.001, Math.min(topLeft.moduleSize, topRight.moduleSize, bottomLeft.moduleSize));
        triples.push({ triple: ordered, score: squareness * 4 + (moduleSpread - 1) });
      }
    }
  }
  return triples.sort((a, b) => a.score - b.score).map((entry) => entry.triple);
}

function orderCorners(
  a: FinderCandidate,
  b: FinderCandidate,
  c: FinderCandidate
): [FinderCandidate, FinderCandidate, FinderCandidate] | null {
  const ab = distance(a, b);
  const bc = distance(b, c);
  const ca = distance(c, a);
  if (ab === 0 || bc === 0 || ca === 0) return null;

  // The corner opposite the longest side is the one with the right angle.
  let topLeft = c;
  let first = a;
  let second = b;
  if (bc >= ab && bc >= ca) {
    topLeft = a;
    first = b;
    second = c;
  } else if (ca >= ab && ca >= bc) {
    topLeft = b;
    first = c;
    second = a;
  }

  // Screen coordinates run downwards, so a code that is the right way round has
  // a positive cross product from the top-right arm to the bottom-left arm.
  const cross =
    (first.x - topLeft.x) * (second.y - topLeft.y) - (first.y - topLeft.y) * (second.x - topLeft.x);
  return cross > 0 ? [topLeft, first, second] : [topLeft, second, first];
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/* ------------------------------------------------------------------ */
/* Perspective sampling                                                */
/* ------------------------------------------------------------------ */

class PerspectiveTransform {
  constructor(
    private a11: number,
    private a21: number,
    private a31: number,
    private a12: number,
    private a22: number,
    private a32: number,
    private a13: number,
    private a23: number,
    private a33: number
  ) {}

  static squareToQuad(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    x3: number,
    y3: number
  ): PerspectiveTransform {
    const dx3 = x0 - x1 + x2 - x3;
    const dy3 = y0 - y1 + y2 - y3;
    if (dx3 === 0 && dy3 === 0) {
      return new PerspectiveTransform(x1 - x0, x2 - x1, x0, y1 - y0, y2 - y1, y0, 0, 0, 1);
    }
    const dx1 = x1 - x2;
    const dx2 = x3 - x2;
    const dy1 = y1 - y2;
    const dy2 = y3 - y2;
    const denominator = dx1 * dy2 - dx2 * dy1;
    const a13 = (dx3 * dy2 - dx2 * dy3) / denominator;
    const a23 = (dx1 * dy3 - dx3 * dy1) / denominator;
    return new PerspectiveTransform(
      x1 - x0 + a13 * x1,
      x3 - x0 + a23 * x3,
      x0,
      y1 - y0 + a13 * y1,
      y3 - y0 + a23 * y3,
      y0,
      a13,
      a23,
      1
    );
  }

  private adjoint(): PerspectiveTransform {
    return new PerspectiveTransform(
      this.a22 * this.a33 - this.a23 * this.a32,
      this.a23 * this.a31 - this.a21 * this.a33,
      this.a21 * this.a32 - this.a22 * this.a31,
      this.a13 * this.a32 - this.a12 * this.a33,
      this.a11 * this.a33 - this.a13 * this.a31,
      this.a12 * this.a31 - this.a11 * this.a32,
      this.a12 * this.a23 - this.a13 * this.a22,
      this.a13 * this.a21 - this.a11 * this.a23,
      this.a11 * this.a22 - this.a12 * this.a21
    );
  }

  private times(other: PerspectiveTransform): PerspectiveTransform {
    return new PerspectiveTransform(
      this.a11 * other.a11 + this.a21 * other.a12 + this.a31 * other.a13,
      this.a11 * other.a21 + this.a21 * other.a22 + this.a31 * other.a23,
      this.a11 * other.a31 + this.a21 * other.a32 + this.a31 * other.a33,
      this.a12 * other.a11 + this.a22 * other.a12 + this.a32 * other.a13,
      this.a12 * other.a21 + this.a22 * other.a22 + this.a32 * other.a23,
      this.a12 * other.a31 + this.a22 * other.a32 + this.a32 * other.a33,
      this.a13 * other.a11 + this.a23 * other.a12 + this.a33 * other.a13,
      this.a13 * other.a21 + this.a23 * other.a22 + this.a33 * other.a23,
      this.a13 * other.a31 + this.a23 * other.a32 + this.a33 * other.a33
    );
  }

  static quadToQuad(source: number[], destination: number[]): PerspectiveTransform {
    const toSquare = PerspectiveTransform.squareToQuad(
      source[0],
      source[1],
      source[2],
      source[3],
      source[4],
      source[5],
      source[6],
      source[7]
    ).adjoint();
    const fromSquare = PerspectiveTransform.squareToQuad(
      destination[0],
      destination[1],
      destination[2],
      destination[3],
      destination[4],
      destination[5],
      destination[6],
      destination[7]
    );
    return fromSquare.times(toSquare);
  }

  apply(x: number, y: number): { x: number; y: number } {
    const denominator = this.a13 * x + this.a23 * y + this.a33;
    return {
      x: (this.a11 * x + this.a21 * y + this.a31) / denominator,
      y: (this.a12 * x + this.a22 * y + this.a32) / denominator
    };
  }
}

function sampleGrid(
  image: BinaryImage,
  [topLeft, topRight, bottomLeft]: [FinderCandidate, FinderCandidate, FinderCandidate]
): boolean[][] {
  const moduleSize = (topLeft.moduleSize + topRight.moduleSize + bottomLeft.moduleSize) / 3;
  if (moduleSize < 1) throw new QrReadError('The code is drawn too small in that picture to be read.');

  const across = distance(topLeft, topRight) / moduleSize;
  const down = distance(topLeft, bottomLeft) / moduleSize;
  let dimension = Math.round((across + down) / 2) + 7;
  switch (dimension & 0x03) {
    case 0:
      dimension += 1;
      break;
    case 2:
      dimension -= 1;
      break;
    case 3:
      throw new QrReadError('The module grid could not be measured reliably. Try a larger or sharper picture.');
    default:
      break;
  }
  const version = versionForSize(dimension);
  if (version === null) {
    throw new QrReadError(
      `That looks like a ${dimension} module QR code, which is outside the versions 1 to 10 this reader handles. Paste the pairing link instead.`
    );
  }

  // Versions two and up carry a fourth reference point near the bottom-right
  // corner. Using it corrects perspective; without it the fourth corner is
  // estimated, which is exact only for a flat, square-on picture.
  const estimatedX = topRight.x - topLeft.x + bottomLeft.x;
  const estimatedY = topRight.y - topLeft.y + bottomLeft.y;
  let fourthImage = { x: estimatedX, y: estimatedY };
  let fourthModule = { x: dimension - 3.5, y: dimension - 3.5 };

  if (version >= 2) {
    const correction = 1 - 3 / (dimension - 7);
    const guessX = topLeft.x + correction * (estimatedX - topLeft.x);
    const guessY = topLeft.y + correction * (estimatedY - topLeft.y);
    const alignment = findAlignmentPattern(image, guessX, guessY, moduleSize);
    if (alignment) {
      fourthImage = alignment;
      fourthModule = { x: dimension - 6.5, y: dimension - 6.5 };
    }
  }

  const transform = PerspectiveTransform.quadToQuad(
    [3.5, 3.5, dimension - 3.5, 3.5, fourthModule.x, fourthModule.y, 3.5, dimension - 3.5],
    [topLeft.x, topLeft.y, topRight.x, topRight.y, fourthImage.x, fourthImage.y, bottomLeft.x, bottomLeft.y]
  );

  const matrix: boolean[][] = [];
  for (let row = 0; row < dimension; row += 1) {
    const line: boolean[] = [];
    for (let column = 0; column < dimension; column += 1) {
      const point = transform.apply(column + 0.5, row + 0.5);
      line.push(sampleModule(image, point.x, point.y));
    }
    matrix.push(line);
  }
  return matrix;
}

/** Reads one module by majority vote of a small neighbourhood. */
function sampleModule(image: BinaryImage, x: number, y: number): boolean {
  const centreX = Math.round(x);
  const centreY = Math.round(y);
  let dark = 0;
  let total = 0;
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const sampleX = centreX + dx;
      const sampleY = centreY + dy;
      if (sampleX < 0 || sampleY < 0 || sampleX >= image.width || sampleY >= image.height) continue;
      total += 1;
      if (isDark(image, sampleX, sampleY)) dark += 1;
    }
  }
  if (total === 0) return false;
  // The centre pixel is worth more than its neighbours, so a module the grid
  // lands slightly off centre still reads correctly.
  const centreDark = isDark(image, centreX, centreY) ? 1 : 0;
  return dark * 2 + centreDark * 3 > total + 1;
}

function findAlignmentPattern(
  image: BinaryImage,
  guessX: number,
  guessY: number,
  moduleSize: number
): { x: number; y: number } | null {
  const allowance = Math.max(3, Math.round(moduleSize * 3));
  const left = Math.max(0, Math.round(guessX - allowance));
  const right = Math.min(image.width - 1, Math.round(guessX + allowance));
  const top = Math.max(0, Math.round(guessY - allowance));
  const bottom = Math.min(image.height - 1, Math.round(guessY + allowance));
  if (right - left < moduleSize * 3 || bottom - top < moduleSize * 3) return null;

  let best: { x: number; y: number; distance: number } | null = null;
  for (let y = top; y <= bottom; y += 1) {
    const runs = [0, 0, 0];
    let state = 0;
    for (let x = left; x <= right; x += 1) {
      const dark = isDark(image, x, y);
      if (state === 1 ? dark : !dark) {
        if (state === 2) {
          if (alignmentRatio(runs, moduleSize)) {
            const centreX = x - runs[2] - runs[1] / 2;
            const centreY = verifyAlignmentVertically(image, Math.round(centreX), y, moduleSize);
            if (centreY !== null) {
              const away = Math.hypot(centreX - guessX, centreY - guessY);
              if (!best || away < best.distance) best = { x: centreX, y: centreY, distance: away };
            }
          }
          runs[0] = runs[2];
          runs[1] = 1;
          runs[2] = 0;
          state = 1;
        } else {
          state += 1;
          runs[state] = 1;
        }
      } else {
        runs[state] += 1;
      }
    }
  }
  return best ? { x: best.x, y: best.y } : null;
}

function alignmentRatio(runs: number[], moduleSize: number): boolean {
  const tolerance = Math.max(1, moduleSize / 2);
  return runs.every((run) => Math.abs(run - moduleSize) <= tolerance);
}

function verifyAlignmentVertically(
  image: BinaryImage,
  x: number,
  startY: number,
  moduleSize: number
): number | null {
  const maximum = Math.ceil(moduleSize * 2);
  let up = 0;
  while (up < maximum && isDark(image, x, startY - up)) up += 1;
  let down = 0;
  while (down < maximum && isDark(image, x, startY + down + 1)) down += 1;
  const middle = up + down;
  if (Math.abs(middle - moduleSize) > Math.max(1, moduleSize / 2)) return null;

  let above = 0;
  while (above < maximum && !isDark(image, x, startY - up - above)) above += 1;
  let below = 0;
  while (below < maximum && !isDark(image, x, startY + down + 1 + below)) below += 1;
  if (Math.abs(above - moduleSize) > moduleSize || Math.abs(below - moduleSize) > moduleSize) return null;

  return startY - up + middle / 2;
}

/* ------------------------------------------------------------------ */
/* Loading pictures                                                    */
/* ------------------------------------------------------------------ */

/** The longest edge a picture is scaled down to before it is read. */
const MAX_IMAGE_EDGE = 2000;

/**
 * Turns a picture into pixels this reader can work on.
 *
 * The decode happens on a canvas in this window; the blob never leaves the
 * process. Very large pictures are scaled down first, both so the reader stays
 * responsive and so a camera frame does not allocate a hundred megabytes.
 */
export async function imageDataFromBlob(blob: Blob): Promise<ImageData> {
  const bitmap = await createImageBitmap(blob);
  try {
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new QrReadError('This build cannot read pixels from a canvas, so pictures cannot be scanned.');
    context.drawImage(bitmap, 0, 0, width, height);
    return context.getImageData(0, 0, width, height);
  } finally {
    bitmap.close();
  }
}

/** Reads a QR code out of a picture. */
export async function decodeBlob(blob: Blob): Promise<QrReadResult> {
  return decodeImageData(await imageDataFromBlob(blob));
}
