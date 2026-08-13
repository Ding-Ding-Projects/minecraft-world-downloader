/**
 * The shared arithmetic and structure tables behind this feature's QR encoder
 * and QR reader.
 *
 * Both halves are implemented in this application, in this process, because a
 * pairing QR carries the secret: sending it to a chart service or a remote
 * generator would hand that secret to somebody else's server on its way to being
 * drawn. Nothing in this file, in `qrencode.ts` or in `qrdecode.ts` makes a
 * network request of any kind.
 *
 * Versions 1 to 10 are covered. A pairing URI for a one-time code is a hundred
 * or so bytes, which fits comfortably inside that range at every error
 * correction level; anything larger is reported as unsupported rather than
 * encoded wrongly or read wrongly.
 */

export type EccLevel = 'L' | 'M' | 'Q' | 'H';

export const ECC_LEVELS: EccLevel[] = ['L', 'M', 'Q', 'H'];

/** Highest version this encoder and reader handle. */
export const MAX_VERSION = 10;

/* ------------------------------------------------------------------ */
/* GF(256)                                                             */
/* ------------------------------------------------------------------ */

/**
 * The Galois field QR codes use: GF(2^8) with the primitive polynomial
 * 0x11D and the generator element 2.
 */
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);

(() => {
  let value = 1;
  for (let index = 0; index < 255; index += 1) {
    GF_EXP[index] = value;
    GF_LOG[value] = index;
    value <<= 1;
    if (value & 0x100) value ^= 0x11d;
  }
  for (let index = 255; index < 512; index += 1) GF_EXP[index] = GF_EXP[index - 255];
})();

export function gfExp(power: number): number {
  return GF_EXP[((power % 255) + 255) % 255];
}

export function gfLog(value: number): number {
  if (value === 0) throw new Error('The logarithm of zero is undefined in this field.');
  return GF_LOG[value];
}

export function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

export function gfDiv(a: number, b: number): number {
  if (b === 0) throw new Error('Division by zero in the field.');
  if (a === 0) return 0;
  return GF_EXP[(GF_LOG[a] - GF_LOG[b] + 255) % 255];
}

export function gfInverse(a: number): number {
  return gfDiv(1, a);
}

/** Polynomials are most-significant coefficient first. */
export function polyMul(a: number[], b: number[]): number[] {
  const out = new Array<number>(a.length + b.length - 1).fill(0);
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] === 0) continue;
    for (let j = 0; j < b.length; j += 1) {
      out[i + j] ^= gfMul(a[i], b[j]);
    }
  }
  return out;
}

export function polyEval(poly: number[], x: number): number {
  let result = 0;
  for (const coefficient of poly) {
    result = gfMul(result, x) ^ coefficient;
  }
  return result;
}

/** The Reed-Solomon generator polynomial for `count` check symbols. */
export function generatorPoly(count: number): number[] {
  let poly = [1];
  for (let index = 0; index < count; index += 1) {
    poly = polyMul(poly, [1, gfExp(index)]);
  }
  return poly;
}

/** Reed-Solomon check symbols for one block of data codewords. */
export function reedSolomonEncode(data: number[], eccCount: number): number[] {
  const generator = generatorPoly(eccCount);
  const remainder = new Array<number>(eccCount).fill(0);
  for (const byte of data) {
    const factor = byte ^ remainder[0];
    remainder.shift();
    remainder.push(0);
    if (factor !== 0) {
      for (let index = 0; index < eccCount; index += 1) {
        remainder[index] ^= gfMul(generator[index + 1], factor);
      }
    }
  }
  return remainder;
}

/**
 * Corrects a received block in place-free fashion.
 *
 * Returns the corrected codewords (data followed by check symbols) or `null`
 * when the block holds more errors than the check symbols can locate. Returning
 * null rather than a best guess matters: a silently mis-corrected block yields a
 * pairing URI that looks plausible and pairs an account with the wrong secret.
 */
export function reedSolomonDecode(block: number[], eccCount: number): number[] | null {
  const received = [...block];
  const syndromes = new Array<number>(eccCount).fill(0);
  let hasError = false;
  for (let index = 0; index < eccCount; index += 1) {
    syndromes[index] = polyEval(received, gfExp(index));
    if (syndromes[index] !== 0) hasError = true;
  }
  if (!hasError) return received;

  // Berlekamp-Massey. The register length is tracked explicitly rather than
  // read back off the polynomial's degree: a cancelled leading coefficient makes
  // the degree smaller than the register, and inferring one from the other there
  // is how this algorithm silently stops correcting.
  let locator = [1];
  let previous = [1];
  let registerLength = 0;
  let shift = 1;
  let previousDiscrepancy = 1;

  for (let round = 0; round < eccCount; round += 1) {
    let discrepancy = syndromes[round];
    for (let index = 1; index <= registerLength; index += 1) {
      discrepancy ^= gfMul(coefficientAt(locator, index), syndromes[round - index]);
    }
    if (discrepancy === 0) {
      shift += 1;
      continue;
    }
    const scaled = scaleAndShift(previous, gfDiv(discrepancy, previousDiscrepancy), shift);
    if (2 * registerLength <= round) {
      const copy = [...locator];
      locator = addPolynomials(locator, scaled);
      registerLength = round + 1 - registerLength;
      previous = copy;
      previousDiscrepancy = discrepancy;
      shift = 1;
    } else {
      locator = addPolynomials(locator, scaled);
      shift += 1;
    }
  }

  if (registerLength === 0 || registerLength * 2 > eccCount) return null;

  // Chien search: the roots of the locator name the error positions.
  const positions: number[] = [];
  for (let index = 0; index < received.length; index += 1) {
    const exponent = received.length - 1 - index;
    if (polyEval(locator, gfExp(-exponent)) === 0) positions.push(index);
  }
  if (positions.length !== registerLength) return null;

  // Forney. The evaluator is S(x)·Λ(x) truncated to the check-symbol count, and
  // the leading X factor is the one the first consecutive root being α^0 asks
  // for; the self test corrupts a block deliberately so a wrong factor here
  // fails a visible check rather than mis-correcting in silence.
  const evaluatorProduct = polyMul([...syndromes].reverse(), locator);
  const evaluator = evaluatorProduct.slice(Math.max(0, evaluatorProduct.length - eccCount));
  const derivative: number[] = [];
  for (let index = 0; index < locator.length - 1; index += 1) {
    const degree = locator.length - 1 - index;
    derivative.push(degree % 2 === 1 ? locator[index] : 0);
  }

  for (const position of positions) {
    const exponent = received.length - 1 - position;
    const inverse = gfExp(-exponent);
    const numerator = polyEval(evaluator, inverse);
    const denominator = polyEval(derivative, inverse);
    if (denominator === 0) return null;
    received[position] ^= gfMul(gfExp(exponent), gfDiv(numerator, denominator));
  }

  for (let index = 0; index < eccCount; index += 1) {
    if (polyEval(received, gfExp(index)) !== 0) return null;
  }
  return received;
}

/** The coefficient of x^degree in a most-significant-first polynomial. */
function coefficientAt(poly: number[], degree: number): number {
  const index = poly.length - 1 - degree;
  return index >= 0 && index < poly.length ? poly[index] : 0;
}

function scaleAndShift(poly: number[], scale: number, shift: number): number[] {
  return [...poly.map((value) => gfMul(value, scale)), ...new Array<number>(shift).fill(0)];
}

function addPolynomials(a: number[], b: number[]): number[] {
  const length = Math.max(a.length, b.length);
  const out = new Array<number>(length).fill(0);
  for (let index = 0; index < a.length; index += 1) out[length - a.length + index] ^= a[index];
  for (let index = 0; index < b.length; index += 1) out[length - b.length + index] ^= b[index];
  return out;
}

/* ------------------------------------------------------------------ */
/* Structure tables                                                    */
/* ------------------------------------------------------------------ */

export interface BlockGroup {
  blocks: number;
  dataCodewords: number;
}

export interface BlockSpec {
  ecPerBlock: number;
  groups: BlockGroup[];
}

/** Total codewords (data plus check symbols) for versions 1 to 10. */
export const TOTAL_CODEWORDS = [26, 44, 70, 100, 134, 172, 196, 242, 292, 346];

/**
 * The error-correction block structure, version by version and level by level.
 *
 * Each row is checked by `blockSpecTotal` against `TOTAL_CODEWORDS` in the
 * feature's self test, so a mistyped number here fails a visible check rather
 * than producing codes that only some readers accept.
 */
export const BLOCK_SPECS: Record<number, Record<EccLevel, BlockSpec>> = {
  1: {
    L: { ecPerBlock: 7, groups: [{ blocks: 1, dataCodewords: 19 }] },
    M: { ecPerBlock: 10, groups: [{ blocks: 1, dataCodewords: 16 }] },
    Q: { ecPerBlock: 13, groups: [{ blocks: 1, dataCodewords: 13 }] },
    H: { ecPerBlock: 17, groups: [{ blocks: 1, dataCodewords: 9 }] }
  },
  2: {
    L: { ecPerBlock: 10, groups: [{ blocks: 1, dataCodewords: 34 }] },
    M: { ecPerBlock: 16, groups: [{ blocks: 1, dataCodewords: 28 }] },
    Q: { ecPerBlock: 22, groups: [{ blocks: 1, dataCodewords: 22 }] },
    H: { ecPerBlock: 28, groups: [{ blocks: 1, dataCodewords: 16 }] }
  },
  3: {
    L: { ecPerBlock: 15, groups: [{ blocks: 1, dataCodewords: 55 }] },
    M: { ecPerBlock: 26, groups: [{ blocks: 1, dataCodewords: 44 }] },
    Q: { ecPerBlock: 18, groups: [{ blocks: 2, dataCodewords: 17 }] },
    H: { ecPerBlock: 22, groups: [{ blocks: 2, dataCodewords: 13 }] }
  },
  4: {
    L: { ecPerBlock: 20, groups: [{ blocks: 1, dataCodewords: 80 }] },
    M: { ecPerBlock: 18, groups: [{ blocks: 2, dataCodewords: 32 }] },
    Q: { ecPerBlock: 26, groups: [{ blocks: 2, dataCodewords: 24 }] },
    H: { ecPerBlock: 16, groups: [{ blocks: 4, dataCodewords: 9 }] }
  },
  5: {
    L: { ecPerBlock: 26, groups: [{ blocks: 1, dataCodewords: 108 }] },
    M: { ecPerBlock: 24, groups: [{ blocks: 2, dataCodewords: 43 }] },
    Q: {
      ecPerBlock: 18,
      groups: [
        { blocks: 2, dataCodewords: 15 },
        { blocks: 2, dataCodewords: 16 }
      ]
    },
    H: {
      ecPerBlock: 22,
      groups: [
        { blocks: 2, dataCodewords: 11 },
        { blocks: 2, dataCodewords: 12 }
      ]
    }
  },
  6: {
    L: { ecPerBlock: 18, groups: [{ blocks: 2, dataCodewords: 68 }] },
    M: { ecPerBlock: 16, groups: [{ blocks: 4, dataCodewords: 27 }] },
    Q: { ecPerBlock: 24, groups: [{ blocks: 4, dataCodewords: 19 }] },
    H: { ecPerBlock: 28, groups: [{ blocks: 4, dataCodewords: 15 }] }
  },
  7: {
    L: { ecPerBlock: 20, groups: [{ blocks: 2, dataCodewords: 78 }] },
    M: { ecPerBlock: 18, groups: [{ blocks: 4, dataCodewords: 31 }] },
    Q: {
      ecPerBlock: 18,
      groups: [
        { blocks: 2, dataCodewords: 14 },
        { blocks: 4, dataCodewords: 15 }
      ]
    },
    H: {
      ecPerBlock: 26,
      groups: [
        { blocks: 4, dataCodewords: 13 },
        { blocks: 1, dataCodewords: 14 }
      ]
    }
  },
  8: {
    L: { ecPerBlock: 24, groups: [{ blocks: 2, dataCodewords: 97 }] },
    M: {
      ecPerBlock: 22,
      groups: [
        { blocks: 2, dataCodewords: 38 },
        { blocks: 2, dataCodewords: 39 }
      ]
    },
    Q: {
      ecPerBlock: 22,
      groups: [
        { blocks: 4, dataCodewords: 18 },
        { blocks: 2, dataCodewords: 19 }
      ]
    },
    H: {
      ecPerBlock: 26,
      groups: [
        { blocks: 4, dataCodewords: 14 },
        { blocks: 2, dataCodewords: 15 }
      ]
    }
  },
  9: {
    L: { ecPerBlock: 30, groups: [{ blocks: 2, dataCodewords: 116 }] },
    M: {
      ecPerBlock: 22,
      groups: [
        { blocks: 3, dataCodewords: 36 },
        { blocks: 2, dataCodewords: 37 }
      ]
    },
    Q: {
      ecPerBlock: 20,
      groups: [
        { blocks: 4, dataCodewords: 16 },
        { blocks: 4, dataCodewords: 17 }
      ]
    },
    H: {
      ecPerBlock: 24,
      groups: [
        { blocks: 4, dataCodewords: 12 },
        { blocks: 4, dataCodewords: 13 }
      ]
    }
  },
  10: {
    L: {
      ecPerBlock: 18,
      groups: [
        { blocks: 2, dataCodewords: 68 },
        { blocks: 2, dataCodewords: 69 }
      ]
    },
    M: {
      ecPerBlock: 26,
      groups: [
        { blocks: 4, dataCodewords: 43 },
        { blocks: 1, dataCodewords: 44 }
      ]
    },
    Q: {
      ecPerBlock: 24,
      groups: [
        { blocks: 6, dataCodewords: 19 },
        { blocks: 2, dataCodewords: 20 }
      ]
    },
    H: {
      ecPerBlock: 28,
      groups: [
        { blocks: 6, dataCodewords: 15 },
        { blocks: 2, dataCodewords: 16 }
      ]
    }
  }
};

/** Data codewords available at one version and level. */
export function dataCodewordCount(version: number, level: EccLevel): number {
  const spec = BLOCK_SPECS[version]?.[level];
  if (!spec) throw new Error(`No block structure is recorded for version ${version} level ${level}.`);
  return spec.groups.reduce((total, group) => total + group.blocks * group.dataCodewords, 0);
}

/** Data plus check symbols, used to prove the table against `TOTAL_CODEWORDS`. */
export function blockSpecTotal(version: number, level: EccLevel): number {
  const spec = BLOCK_SPECS[version][level];
  const blocks = spec.groups.reduce((total, group) => total + group.blocks, 0);
  return dataCodewordCount(version, level) + blocks * spec.ecPerBlock;
}

/** Alignment pattern centre coordinates, versions 1 to 10. */
export const ALIGNMENT_CENTRES: Record<number, number[]> = {
  1: [],
  2: [6, 18],
  3: [6, 22],
  4: [6, 26],
  5: [6, 30],
  6: [6, 34],
  7: [6, 22, 38],
  8: [6, 24, 42],
  9: [6, 26, 46],
  10: [6, 28, 50]
};

/** Remainder bits appended after the interleaved codewords. */
export function remainderBits(version: number): number {
  if (version === 1) return 0;
  if (version >= 2 && version <= 6) return 7;
  return 0;
}

export function versionForSize(size: number): number | null {
  if ((size - 17) % 4 !== 0) return null;
  const version = (size - 17) / 4;
  if (version < 1 || version > MAX_VERSION) return null;
  return version;
}

export function sizeForVersion(version: number): number {
  return version * 4 + 17;
}

/* ------------------------------------------------------------------ */
/* Format and version information                                      */
/* ------------------------------------------------------------------ */

const LEVEL_BITS: Record<EccLevel, number> = { L: 0b01, M: 0b00, Q: 0b11, H: 0b10 };
const BITS_LEVEL: Record<number, EccLevel> = { 0b01: 'L', 0b00: 'M', 0b11: 'Q', 0b10: 'H' };

/** The 15-bit format string: five data bits, BCH check bits, masked. */
export function formatBits(level: EccLevel, mask: number): number {
  const data = (LEVEL_BITS[level] << 3) | mask;
  let remainder = data << 10;
  for (let index = 14; index >= 10; index -= 1) {
    if ((remainder >> index) & 1) remainder ^= 0x537 << (index - 10);
  }
  return ((data << 10) | remainder) ^ 0x5412;
}

const ALL_FORMATS: Array<{ bits: number; level: EccLevel; mask: number }> = (() => {
  const out: Array<{ bits: number; level: EccLevel; mask: number }> = [];
  for (const level of ECC_LEVELS) {
    for (let mask = 0; mask < 8; mask += 1) {
      out.push({ bits: formatBits(level, mask), level, mask });
    }
  }
  return out;
})();

/**
 * Reads a 15-bit format field back, tolerating up to three flipped bits.
 *
 * Every valid format string is generated once above and the closest is chosen by
 * Hamming distance, which is exactly what the BCH code guarantees can be
 * corrected. Beyond three bits the answer is refused rather than guessed.
 */
export function decodeFormat(raw: number): { level: EccLevel; mask: number } | null {
  let best: { level: EccLevel; mask: number } | null = null;
  let bestDistance = 32;
  for (const candidate of ALL_FORMATS) {
    const distance = popCount(candidate.bits ^ (raw & 0x7fff));
    if (distance < bestDistance) {
      bestDistance = distance;
      best = { level: candidate.level, mask: candidate.mask };
    }
  }
  return bestDistance <= 3 ? best : null;
}

export function levelFromBits(bits: number): EccLevel | null {
  return BITS_LEVEL[bits] ?? null;
}

/** The 18-bit version field written on versions 7 and above. */
export function versionBits(version: number): number {
  let remainder = version << 12;
  for (let index = 17; index >= 12; index -= 1) {
    if ((remainder >> index) & 1) remainder ^= 0x1f25 << (index - 12);
  }
  return (version << 12) | remainder;
}

function popCount(value: number): number {
  let count = 0;
  let remaining = value;
  while (remaining !== 0) {
    count += remaining & 1;
    remaining >>>= 1;
  }
  return count;
}

/* ------------------------------------------------------------------ */
/* Masks                                                               */
/* ------------------------------------------------------------------ */

export const MASK_FUNCTIONS: Array<(row: number, column: number) => boolean> = [
  (row, column) => (row + column) % 2 === 0,
  (row) => row % 2 === 0,
  (_row, column) => column % 3 === 0,
  (row, column) => (row + column) % 3 === 0,
  (row, column) => (Math.floor(row / 2) + Math.floor(column / 3)) % 2 === 0,
  (row, column) => ((row * column) % 2) + ((row * column) % 3) === 0,
  (row, column) => (((row * column) % 2) + ((row * column) % 3)) % 2 === 0,
  (row, column) => (((row + column) % 2) + ((row * column) % 3)) % 2 === 0
];

/** Character-count indicator width for byte mode at a given version. */
export function byteCountBits(version: number): number {
  return version <= 9 ? 8 : 16;
}

export function numericCountBits(version: number): number {
  if (version <= 9) return 10;
  if (version <= 26) return 12;
  return 14;
}

export function alphanumericCountBits(version: number): number {
  if (version <= 9) return 9;
  if (version <= 26) return 11;
  return 13;
}

export const ALPHANUMERIC_TABLE = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';
