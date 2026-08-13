/**
 * The verification this authenticator ships with, runnable from inside it.
 *
 * An authenticator that is subtly wrong produces codes that every service
 * refuses, with no error anywhere to read — so "it looked right" is not evidence
 * and neither is a passing build. These checks run the real code paths the
 * application uses against the published test vectors, and they are reachable
 * from the surface so a user who suspects the codes can prove it either way in
 * one action.
 *
 * Vectors used:
 *   - RFC 4226 appendix D: the ten HOTP counters.
 *   - RFC 6238 appendix B: six instants, three hash functions, eight digits.
 *   - This feature's own QR encoder and reader, round-tripped through a real
 *     rasterized picture rather than through the matrix alone.
 */

import { base32Decode, base32Encode, hotp, totp, verifyTotp } from '../../core/totp';
import { decodeImageData, decodeMatrix } from './qrdecode';
import { encodeQr, qrToCanvas } from './qrencode';
import { BLOCK_SPECS, ECC_LEVELS, TOTAL_CODEWORDS, blockSpecTotal, decodeFormat, formatBits, reedSolomonDecode, reedSolomonEncode } from './qrtables';
import { buildPairingUri, normalizeSecret, parsePairingUri } from './model';

export interface CheckResult {
  id: string;
  /** Plain English; this is evidence, so it is not styled by the humour level. */
  name: string;
  passed: boolean;
  detail: string;
  durationMs: number;
}

export interface SelfTestReport {
  results: CheckResult[];
  passed: number;
  failed: number;
  totalMs: number;
  ranAt: string;
}

/* ------------------------------------------------------------------ */
/* Published vectors                                                   */
/* ------------------------------------------------------------------ */

/** RFC 4226 appendix D, secret "12345678901234567890". */
const HOTP_VECTORS = [
  '755224',
  '287082',
  '359152',
  '969429',
  '338314',
  '254676',
  '287922',
  '162583',
  '399871',
  '520489'
];

/** RFC 6238 appendix B. Times are seconds; codes are eight digits. */
const TOTP_VECTORS: Array<{ seconds: number; sha1: string; sha256: string; sha512: string }> = [
  { seconds: 59, sha1: '94287082', sha256: '46119246', sha512: '90693936' },
  { seconds: 1_111_111_109, sha1: '07081804', sha256: '68084774', sha512: '25091201' },
  { seconds: 1_111_111_111, sha1: '14050471', sha256: '67062674', sha512: '99943326' },
  { seconds: 1_234_567_890, sha1: '89005924', sha256: '91819424', sha512: '93441116' },
  { seconds: 2_000_000_000, sha1: '69279037', sha256: '90698825', sha512: '38618901' },
  { seconds: 20_000_000_000, sha1: '65353130', sha256: '77737706', sha512: '47863826' }
];

const SEED_SHA1 = '12345678901234567890';
const SEED_SHA256 = '12345678901234567890123456789012';
const SEED_SHA512 = '1234567890123456789012345678901234567890123456789012345678901234';

function seedToBase32(ascii: string): string {
  return base32Encode(new TextEncoder().encode(ascii));
}

/* ------------------------------------------------------------------ */
/* The checks                                                          */
/* ------------------------------------------------------------------ */

type Check = { id: string; name: string; run(): Promise<string> | string };

const CHECKS: Check[] = [
  {
    id: 'base32',
    name: 'Base32 encodes and decodes without loss, and refuses invalid characters',
    run() {
      for (let length = 1; length <= 64; length += 1) {
        const bytes = new Uint8Array(length);
        crypto.getRandomValues(bytes);
        const encoded = base32Encode(bytes);
        const decoded = base32Decode(encoded);
        if (decoded.length !== bytes.length || decoded.some((value, index) => value !== bytes[index])) {
          throw new Error(`A ${length} byte secret did not survive the round trip.`);
        }
      }
      for (const bad of ['ABC1', 'ABC8', 'ABC9', 'ab$d']) {
        let refused = false;
        try {
          normalizeSecret(bad.padEnd(16, 'A'));
        } catch {
          refused = true;
        }
        if (!refused) throw new Error(`"${bad}" was accepted as base32 and should not have been.`);
      }
      return '64 lengths round-tripped; four invalid alphabets refused.';
    }
  },
  {
    id: 'hotp',
    name: 'RFC 4226 appendix D: the ten published HOTP counters',
    async run() {
      const secret = seedToBase32(SEED_SHA1);
      for (let counter = 0; counter < HOTP_VECTORS.length; counter += 1) {
        const produced = await hotp(secret, counter, 'SHA-1', 6);
        if (produced !== HOTP_VECTORS[counter]) {
          throw new Error(`Counter ${counter} produced ${produced} where the standard publishes ${HOTP_VECTORS[counter]}.`);
        }
      }
      return `All ${HOTP_VECTORS.length} counters matched.`;
    }
  },
  {
    id: 'totp-sha1',
    name: 'RFC 6238 appendix B: SHA-1 at eight digits, six instants',
    run: () => runTotpVectors('SHA-1', SEED_SHA1, (vector) => vector.sha1)
  },
  {
    id: 'totp-sha256',
    name: 'RFC 6238 appendix B: SHA-256 at eight digits, six instants',
    run: () => runTotpVectors('SHA-256', SEED_SHA256, (vector) => vector.sha256)
  },
  {
    id: 'totp-sha512',
    name: 'RFC 6238 appendix B: SHA-512 at eight digits, six instants',
    run: () => runTotpVectors('SHA-512', SEED_SHA512, (vector) => vector.sha512)
  },
  {
    id: 'totp-six-digits',
    name: 'Six-digit codes are the low six digits of the published eight-digit ones',
    async run() {
      const secret = seedToBase32(SEED_SHA1);
      for (const vector of TOTP_VECTORS) {
        const produced = await totp({ secret, algorithm: 'SHA-1', digits: 6, period: 30 }, vector.seconds * 1000);
        const expected = vector.sha1.slice(-6);
        if (produced !== expected) {
          throw new Error(`At ${vector.seconds}s a six-digit code read ${produced} where ${expected} was expected.`);
        }
      }
      return `All ${TOTP_VECTORS.length} instants matched at six digits.`;
    }
  },
  {
    id: 'totp-period',
    name: 'A non-standard period changes the code exactly at its own boundary',
    async run() {
      const secret = seedToBase32(SEED_SHA1);
      for (const period of [15, 30, 45, 60, 90]) {
        const parameters = { secret, algorithm: 'SHA-1' as const, digits: 6, period };
        const base = 1_700_000_000 * 1000;
        const start = Math.floor(base / (period * 1000)) * period * 1000;
        const insideStart = await totp(parameters, start);
        const insideEnd = await totp(parameters, start + period * 1000 - 1);
        const afterBoundary = await totp(parameters, start + period * 1000);
        if (insideStart !== insideEnd) throw new Error(`A ${period}s code changed inside its own period.`);
        if (insideStart === afterBoundary) throw new Error(`A ${period}s code did not change at its boundary.`);
      }
      return 'Five periods held steady inside and changed at the boundary.';
    }
  },
  {
    id: 'totp-window',
    name: 'Verification accepts one step of clock skew and refuses three',
    async run() {
      const secret = seedToBase32(SEED_SHA1);
      const parameters = { secret, algorithm: 'SHA-1' as const, digits: 6, period: 30 };
      const now = 1_700_000_000 * 1000;
      const code = await totp(parameters, now);
      for (const step of [-1, 0, 1]) {
        const accepted = await verifyTotp(parameters, code, 1, now + step * 30_000);
        if (!accepted) throw new Error(`A code ${step} steps away was refused and should have been accepted.`);
      }
      for (const step of [-3, 3]) {
        const accepted = await verifyTotp(parameters, code, 1, now + step * 30_000);
        if (accepted) throw new Error(`A code ${step} steps away was accepted and should have been refused.`);
      }
      return 'One step either side accepted; three steps refused.';
    }
  },
  {
    id: 'pairing-uri',
    name: 'A pairing URI keeps every parameter it carries',
    run() {
      const parameters = {
        issuer: 'Example Service Ltd',
        account: 'someone+tag@example.org',
        secret: seedToBase32(SEED_SHA256),
        algorithm: 'SHA-512' as const,
        digits: 8,
        period: 45
      };
      const parsed = parsePairingUri(buildPairingUri(parameters));
      for (const key of Object.keys(parameters) as Array<keyof typeof parameters>) {
        if (parsed[key] !== parameters[key]) {
          throw new Error(`"${key}" came back as "${String(parsed[key])}" instead of "${String(parameters[key])}".`);
        }
      }
      const bare = parsePairingUri(`otpauth://totp/Bare?secret=${seedToBase32(SEED_SHA1)}`);
      if (bare.algorithm !== 'SHA-1' || bare.digits !== 6 || bare.period !== 30) {
        throw new Error('A URI without parameters did not fall back to the standard defaults.');
      }
      let refusedCounterBased = false;
      try {
        parsePairingUri(`otpauth://hotp/Bare?secret=${seedToBase32(SEED_SHA1)}&counter=1`);
      } catch {
        refusedCounterBased = true;
      }
      if (!refusedCounterBased) throw new Error('A counter-based link was accepted and should have been refused.');
      return 'Every parameter survived; defaults applied when absent; a counter-based link was refused.';
    }
  },
  {
    id: 'qr-tables',
    name: 'Every QR block structure adds up to its version total',
    run() {
      let rows = 0;
      for (const version of Object.keys(BLOCK_SPECS).map(Number)) {
        for (const level of ECC_LEVELS) {
          const total = blockSpecTotal(version, level);
          if (total !== TOTAL_CODEWORDS[version - 1]) {
            throw new Error(
              `Version ${version} level ${level} adds up to ${total} codewords where the standard says ${TOTAL_CODEWORDS[version - 1]}.`
            );
          }
          rows += 1;
        }
      }
      return `${rows} block structures matched their version totals.`;
    }
  },
  {
    id: 'qr-format',
    name: 'The QR format field survives three flipped bits',
    run() {
      let checked = 0;
      for (const level of ECC_LEVELS) {
        for (let mask = 0; mask < 8; mask += 1) {
          const bits = formatBits(level, mask);
          const clean = decodeFormat(bits);
          if (!clean || clean.level !== level || clean.mask !== mask) {
            throw new Error(`Level ${level} mask ${mask} did not read back cleanly.`);
          }
          const damaged = decodeFormat(bits ^ 0b101000000001);
          if (!damaged || damaged.level !== level || damaged.mask !== mask) {
            throw new Error(`Level ${level} mask ${mask} was not recovered after three bits were flipped.`);
          }
          checked += 1;
        }
      }
      return `${checked} format fields read back, clean and damaged.`;
    }
  },
  {
    id: 'reed-solomon',
    name: 'Reed-Solomon repairs damage up to its published limit',
    run() {
      let blocks = 0;
      for (const eccCount of [7, 10, 15, 18, 20, 22, 24, 26, 28, 30]) {
        const data = Array.from({ length: 40 }, () => Math.floor(Math.random() * 256));
        const codeword = [...data, ...reedSolomonEncode(data, eccCount)];
        const clean = reedSolomonDecode([...codeword], eccCount);
        if (!clean || clean.join(',') !== codeword.join(',')) {
          throw new Error(`An undamaged block with ${eccCount} check symbols was altered.`);
        }
        const damaged = [...codeword];
        const positions = new Set<number>();
        while (positions.size < Math.floor(eccCount / 2)) {
          positions.add(Math.floor(Math.random() * damaged.length));
        }
        for (const position of positions) damaged[position] ^= 1 + Math.floor(Math.random() * 255);
        const repaired = reedSolomonDecode(damaged, eccCount);
        if (!repaired || repaired.join(',') !== codeword.join(',')) {
          throw new Error(`A block with ${Math.floor(eccCount / 2)} damaged bytes was not repaired exactly.`);
        }
        blocks += 1;
      }
      return `${blocks} blocks repaired at exactly half their check-symbol count.`;
    }
  },
  {
    id: 'qr-matrix',
    name: 'A pairing URI survives the QR encoder and reader at every level',
    run() {
      let codes = 0;
      for (const level of ECC_LEVELS) {
        for (const padding of [0, 30, 70]) {
          const text = `otpauth://totp/Check:user@example.org?secret=${seedToBase32(SEED_SHA1)}${'&x='.padEnd(padding + 3, 'y')}`;
          const encoded = encodeQr(text, { level });
          const read = decodeMatrix(encoded.modules);
          if (read.text !== text) throw new Error(`A version ${encoded.version} code read back as different text.`);
          if (read.mask !== encoded.mask || read.level !== encoded.level) {
            throw new Error(`A version ${encoded.version} code reported the wrong mask or level.`);
          }
          codes += 1;
        }
      }
      return `${codes} codes round-tripped through the module grid.`;
    }
  },
  {
    id: 'qr-picture',
    name: 'The same URI survives being drawn as a picture and read back',
    async run() {
      const text = `otpauth://totp/Picture:user@example.org?secret=${seedToBase32(SEED_SHA1)}&issuer=Picture&algorithm=SHA1&digits=6&period=30`;
      let pictures = 0;
      for (const level of ECC_LEVELS) {
        const encoded = encodeQr(text, { level });
        for (const moduleSize of [3, 6]) {
          const canvas = qrToCanvas(encoded, moduleSize, 4);
          const context = canvas.getContext('2d', { willReadFrequently: true });
          if (!context) throw new Error('This build cannot read pixels back from a canvas.');
          const image = context.getImageData(0, 0, canvas.width, canvas.height);
          const read = decodeImageData(image);
          if (read.text !== text) throw new Error(`A ${moduleSize}px picture at level ${level} read back as different text.`);
          pictures += 1;
        }
      }
      return `${pictures} rasterized pictures were read back exactly.`;
    }
  }
];

async function runTotpVectors(
  algorithm: 'SHA-1' | 'SHA-256' | 'SHA-512',
  seed: string,
  select: (vector: (typeof TOTP_VECTORS)[number]) => string
): Promise<string> {
  const secret = seedToBase32(seed);
  for (const vector of TOTP_VECTORS) {
    const produced = await totp({ secret, algorithm, digits: 8, period: 30 }, vector.seconds * 1000);
    const expected = select(vector);
    if (produced !== expected) {
      throw new Error(`At ${vector.seconds}s ${algorithm} produced ${produced} where the standard publishes ${expected}.`);
    }
  }
  return `All ${TOTP_VECTORS.length} published instants matched.`;
}

/* ------------------------------------------------------------------ */
/* Runner                                                              */
/* ------------------------------------------------------------------ */

/** Runs every check. Reports what happened; never throws at the caller. */
export async function runSelfTest(onProgress?: (done: number, total: number) => void): Promise<SelfTestReport> {
  const results: CheckResult[] = [];
  const start = performance.now();
  for (const check of CHECKS) {
    const checkStart = performance.now();
    try {
      const detail = await check.run();
      results.push({
        id: check.id,
        name: check.name,
        passed: true,
        detail,
        durationMs: Math.round(performance.now() - checkStart)
      });
    } catch (error) {
      results.push({
        id: check.id,
        name: check.name,
        passed: false,
        detail: error instanceof Error ? error.message : String(error),
        durationMs: Math.round(performance.now() - checkStart)
      });
    }
    onProgress?.(results.length, CHECKS.length);
  }
  return {
    results,
    passed: results.filter((result) => result.passed).length,
    failed: results.filter((result) => !result.passed).length,
    totalMs: Math.round(performance.now() - start),
    ranAt: new Date().toISOString()
  };
}

export function checkCount(): number {
  return CHECKS.length;
}
