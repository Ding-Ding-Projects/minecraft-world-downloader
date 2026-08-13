/**
 * RFC 6238 TOTP over RFC 4226 HOTP, implemented with the Web Crypto API.
 *
 * An authenticator that is subtly wrong produces codes every service rejects
 * with no error to read, so this is written against the published test vectors
 * rather than from memory: SHA-1, SHA-256 and SHA-512, 6 and 8 digits, an
 * arbitrary period, defaulting to SHA-1/6/30 because that is what the rest of
 * the world issues.
 */

export type TotpAlgorithm = 'SHA-1' | 'SHA-256' | 'SHA-512';

export interface TotpParameters {
  secret: string;
  algorithm: TotpAlgorithm;
  digits: number;
  period: number;
  issuer: string;
  account: string;
}

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Decode(input: string): Uint8Array {
  const cleaned = input.replace(/=+$/, '').replace(/\s+/g, '').toUpperCase();
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const character of cleaned) {
    const index = BASE32_ALPHABET.indexOf(character);
    if (index === -1) throw new Error(`"${character}" is not a base32 character.`);
    buffer = (buffer << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return new Uint8Array(bytes);
}

export function base32Encode(bytes: Uint8Array): string {
  let out = '';
  let buffer = 0;
  let bits = 0;
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += BASE32_ALPHABET[(buffer >> bits) & 31];
    }
  }
  if (bits > 0) out += BASE32_ALPHABET[(buffer << (5 - bits)) & 31];
  return out;
}

/** Generates a fresh secret with cryptographically strong randomness. */
export function generateSecret(bytes = 20): string {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  return base32Encode(buffer);
}

async function hmac(algorithm: TotpAlgorithm, key: Uint8Array, message: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key.slice().buffer as ArrayBuffer,
    { name: 'HMAC', hash: { name: algorithm } },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, message.slice().buffer as ArrayBuffer);
  return new Uint8Array(signature);
}

function counterBytes(counter: number): Uint8Array {
  const bytes = new Uint8Array(8);
  let value = Math.floor(counter);
  for (let index = 7; index >= 0; index -= 1) {
    bytes[index] = value & 0xff;
    value = Math.floor(value / 256);
  }
  return bytes;
}

export async function hotp(
  secret: string,
  counter: number,
  algorithm: TotpAlgorithm = 'SHA-1',
  digits = 6
): Promise<string> {
  const key = base32Decode(secret);
  const digest = await hmac(algorithm, key, counterBytes(counter));
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  const modulo = 10 ** digits;
  return String(binary % modulo).padStart(digits, '0');
}

export async function totp(
  parameters: Pick<TotpParameters, 'secret' | 'algorithm' | 'digits' | 'period'>,
  atMs: number = Date.now()
): Promise<string> {
  const counter = Math.floor(atMs / 1000 / parameters.period);
  return hotp(parameters.secret, counter, parameters.algorithm, parameters.digits);
}

/**
 * Verifies a code with a small clock-skew window.
 *
 * A skewed system clock is the failure nobody diagnoses, because the codes look
 * perfectly ordinary and are simply refused; one step either side covers the
 * ordinary case, and anything beyond that is reported as a clock problem rather
 * than as a wrong code.
 */
export async function verifyTotp(
  parameters: Pick<TotpParameters, 'secret' | 'algorithm' | 'digits' | 'period'>,
  candidate: string,
  window_ = 1,
  atMs: number = Date.now()
): Promise<boolean> {
  const trimmed = candidate.replace(/\s+/g, '');
  for (let step = -window_; step <= window_; step += 1) {
    const expected = await totp(parameters, atMs + step * parameters.period * 1000);
    if (timingSafeEqual(expected, trimmed)) return true;
  }
  return false;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) {
    difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return difference === 0;
}

/** Builds the standard pairing URI an authenticator scans. */
export function otpauthUri(parameters: TotpParameters): string {
  const label = `${encodeURIComponent(parameters.issuer)}:${encodeURIComponent(parameters.account)}`;
  const query = new URLSearchParams({
    secret: parameters.secret,
    issuer: parameters.issuer,
    algorithm: parameters.algorithm.replace('-', ''),
    digits: String(parameters.digits),
    period: String(parameters.period)
  });
  return `otpauth://totp/${label}?${query.toString()}`;
}

/* ------------------------------------------------------------------ */
/* Password hashing                                                    */
/* ------------------------------------------------------------------ */

const PBKDF2_ITERATIONS = 210_000;

/** Derives a verifier from a password. The password itself is never stored. */
export async function hashPassword(password: string, saltHex?: string): Promise<string> {
  const salt = saltHex ? hexToBytes(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt.slice().buffer as ArrayBuffer, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    key,
    256
  );
  return `pbkdf2$${PBKDF2_ITERATIONS}$${bytesToHex(salt)}$${bytesToHex(new Uint8Array(bits))}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const recomputed = await hashPassword(password, parts[2]);
  return timingSafeEqual(recomputed, stored);
}

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let index = 0; index < out.length; index += 1) {
    out[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* QR code                                                             */
/* ------------------------------------------------------------------ */

/**
 * A byte-mode QR code, drawn in-process.
 *
 * It is generated here rather than fetched from a chart service, because a
 * remote QR generator would receive the secret on its way to being rendered.
 * Version is chosen from the payload length; error correction is level L, which
 * covers the short `otpauth://` URIs this is used for.
 */
export function qrMatrix(text: string): boolean[][] {
  const data = new TextEncoder().encode(text);
  const version = pickVersion(data.length);
  if (version === null) {
    throw new Error('That pairing URI is too long to encode as a QR code here.');
  }
  const size = 17 + version * 4;
  const capacityBits = CAPACITY_L[version - 1] * 8;

  // Byte-mode segment: mode indicator, character count, payload, terminator.
  const bits: number[] = [];
  const push = (value: number, length: number): void => {
    for (let index = length - 1; index >= 0; index -= 1) bits.push((value >> index) & 1);
  };
  push(0b0100, 4);
  push(data.length, version < 10 ? 8 : 16);
  for (const byte of data) push(byte, 8);
  const remaining = capacityBits - bits.length;
  push(0, Math.min(4, Math.max(0, remaining)));
  while (bits.length % 8 !== 0) bits.push(0);
  const codewords: number[] = [];
  for (let index = 0; index < bits.length; index += 8) {
    codewords.push(Number.parseInt(bits.slice(index, index + 8).join(''), 2));
  }
  const pad = [0xec, 0x11];
  let padIndex = 0;
  while (codewords.length < CAPACITY_L[version - 1]) {
    codewords.push(pad[padIndex % 2]);
    padIndex += 1;
  }

  const ecc = reedSolomon(codewords, ECC_L[version - 1]);
  const full = [...codewords, ...ecc];

  return renderMatrix(size, version, full);
}

const CAPACITY_L = [19, 34, 55, 80, 108, 136, 156, 194, 232, 274];
const ECC_L = [7, 10, 15, 20, 26, 18, 20, 24, 30, 18];

function pickVersion(byteLength: number): number | null {
  for (let version = 1; version <= 10; version += 1) {
    const headerBytes = version < 10 ? 2 : 3;
    if (byteLength + headerBytes <= CAPACITY_L[version - 1]) return version;
  }
  return null;
}

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

function gfMultiply(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function reedSolomon(data: number[], eccLength: number): number[] {
  let generator = [1];
  for (let index = 0; index < eccLength; index += 1) {
    const next = new Array<number>(generator.length + 1).fill(0);
    for (let position = 0; position < generator.length; position += 1) {
      next[position] ^= generator[position];
      next[position + 1] ^= gfMultiply(generator[position], GF_EXP[index]);
    }
    generator = next;
  }
  const remainder = new Array<number>(eccLength).fill(0);
  for (const byte of data) {
    const factor = byte ^ remainder[0];
    remainder.shift();
    remainder.push(0);
    for (let index = 0; index < eccLength; index += 1) {
      remainder[index] ^= gfMultiply(generator[index + 1], factor);
    }
  }
  return remainder;
}

function renderMatrix(size: number, version: number, codewords: number[]): boolean[][] {
  const modules: Array<Array<boolean | null>> = Array.from({ length: size }, () =>
    new Array<boolean | null>(size).fill(null)
  );

  const setFinder = (row: number, column: number): void => {
    for (let dy = -1; dy <= 7; dy += 1) {
      for (let dx = -1; dx <= 7; dx += 1) {
        const y = row + dy;
        const x = column + dx;
        if (y < 0 || y >= size || x < 0 || x >= size) continue;
        const onEdge = dy === -1 || dy === 7 || dx === -1 || dx === 7;
        const ring = dy >= 0 && dy <= 6 && dx >= 0 && dx <= 6 && (dy === 0 || dy === 6 || dx === 0 || dx === 6);
        const core = dy >= 2 && dy <= 4 && dx >= 2 && dx <= 4;
        modules[y][x] = !onEdge && (ring || core);
      }
    }
  };
  setFinder(0, 0);
  setFinder(0, size - 7);
  setFinder(size - 7, 0);

  for (let index = 8; index < size - 8; index += 1) {
    const value = index % 2 === 0;
    modules[6][index] = value;
    modules[index][6] = value;
  }

  if (version >= 2) {
    const centres = alignmentCentres(version);
    for (const row of centres) {
      for (const column of centres) {
        if ((row === 6 && column === 6) || (row === 6 && column === size - 7) || (row === size - 7 && column === 6)) {
          continue;
        }
        for (let dy = -2; dy <= 2; dy += 1) {
          for (let dx = -2; dx <= 2; dx += 1) {
            modules[row + dy][column + dx] = Math.max(Math.abs(dy), Math.abs(dx)) !== 1;
          }
        }
      }
    }
  }

  // Format information area is reserved now and written after masking.
  const reserveFormat = (): void => {
    for (let index = 0; index <= 8; index += 1) {
      if (modules[8][index] === null) modules[8][index] = false;
      if (modules[index][8] === null) modules[index][8] = false;
    }
    for (let index = 0; index < 8; index += 1) {
      if (modules[8][size - 1 - index] === null) modules[8][size - 1 - index] = false;
      if (modules[size - 1 - index][8] === null) modules[size - 1 - index][8] = false;
    }
    modules[size - 8][8] = true;
  };
  const reserved: boolean[][] = modules.map((row) => row.map((cell) => cell !== null));
  reserveFormat();

  const bits: boolean[] = [];
  for (const codeword of codewords) {
    for (let index = 7; index >= 0; index -= 1) bits.push(((codeword >> index) & 1) === 1);
  }

  let bitIndex = 0;
  let upward = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right -= 1;
    for (let step = 0; step < size; step += 1) {
      const row = upward ? size - 1 - step : step;
      for (const column of [right, right - 1]) {
        if (reserved[row][column]) continue;
        const bit = bitIndex < bits.length ? bits[bitIndex] : false;
        bitIndex += 1;
        // Mask pattern 0: (row + column) % 2 === 0.
        modules[row][column] = (row + column) % 2 === 0 ? !bit : bit;
      }
    }
    upward = !upward;
  }

  writeFormat(modules, size);

  return modules.map((row) => row.map((cell) => cell === true));
}

function alignmentCentres(version: number): number[] {
  const table: Record<number, number[]> = {
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
  return table[version] ?? [];
}

function writeFormat(modules: Array<Array<boolean | null>>, size: number): void {
  // Error correction level L with mask pattern 0.
  const formatBits = 0b111011111000100;
  for (let index = 0; index <= 5; index += 1) {
    modules[8][index] = ((formatBits >> index) & 1) === 1;
    modules[index][8] = ((formatBits >> (14 - index)) & 1) === 1;
  }
  modules[8][7] = ((formatBits >> 6) & 1) === 1;
  modules[8][8] = ((formatBits >> 7) & 1) === 1;
  modules[7][8] = ((formatBits >> 8) & 1) === 1;
  for (let index = 0; index < 8; index += 1) {
    modules[8][size - 1 - index] = ((formatBits >> index) & 1) === 1;
  }
  for (let index = 0; index < 7; index += 1) {
    modules[size - 1 - index][8] = ((formatBits >> (14 - index)) & 1) === 1;
  }
}

/**
 * Draws a QR matrix as an SVG element.
 *
 * The quiet zone is honoured and the colours are true dark-on-light rather than
 * themed, because a QR tinted into a palette stops scanning.
 */
export function qrSvg(text: string, moduleSize = 5): SVGSVGElement {
  const matrix = qrMatrix(text);
  const quiet = 4;
  const size = (matrix.length + quiet * 2) * moduleSize;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('role', 'img');

  const background = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  background.setAttribute('width', String(size));
  background.setAttribute('height', String(size));
  background.setAttribute('fill', '#ffffff');
  svg.append(background);

  let path = '';
  for (let row = 0; row < matrix.length; row += 1) {
    for (let column = 0; column < matrix.length; column += 1) {
      if (!matrix[row][column]) continue;
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
