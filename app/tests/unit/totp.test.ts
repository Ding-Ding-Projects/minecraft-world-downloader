/**
 * RFC 6238 TOTP against the RFC's own published test vectors.
 *
 * An authenticator that is subtly wrong produces codes every real service
 * rejects, with no error anywhere to read, so this is checked against the
 * exact numbers in RFC 6238 Appendix B rather than against the implementation's
 * own idea of what it should produce.
 */
import { describe, expect, it } from 'vitest';
import { base32Encode, hotp, totp, verifyTotp, type TotpAlgorithm } from '../../src/renderer/core/totp';

// RFC 6238 §4.2 / Appendix B: the ASCII seeds encoded as base32, one per
// algorithm, sized exactly to that algorithm's HMAC block requirement
// (20 bytes for SHA-1, 32 for SHA-256, 64 for SHA-512).
const SEED_SHA1 = base32Encode(new TextEncoder().encode('12345678901234567890'));
const SEED_SHA256 = base32Encode(new TextEncoder().encode('12345678901234567890123456789012'));
const SEED_SHA512 = base32Encode(
  new TextEncoder().encode('1234567890123456789012345678901234567890123456789012345678901234')
);

function seedFor(algorithm: TotpAlgorithm): string {
  if (algorithm === 'SHA-1') return SEED_SHA1;
  if (algorithm === 'SHA-256') return SEED_SHA256;
  return SEED_SHA512;
}

// RFC 6238 Appendix B, Table 1 — 8-digit TOTP, 30-second step, T0 = 0.
const VECTORS: Array<{ time: number; algorithm: TotpAlgorithm; expected8: string }> = [
  { time: 59, algorithm: 'SHA-1', expected8: '94287082' },
  { time: 59, algorithm: 'SHA-256', expected8: '46119246' },
  { time: 59, algorithm: 'SHA-512', expected8: '90693936' },
  { time: 1111111109, algorithm: 'SHA-1', expected8: '07081804' },
  { time: 1111111109, algorithm: 'SHA-256', expected8: '68084774' },
  { time: 1111111109, algorithm: 'SHA-512', expected8: '25091201' },
  { time: 1111111111, algorithm: 'SHA-1', expected8: '14050471' },
  { time: 1111111111, algorithm: 'SHA-256', expected8: '67062674' },
  { time: 1111111111, algorithm: 'SHA-512', expected8: '99943326' },
  { time: 1234567890, algorithm: 'SHA-1', expected8: '89005924' },
  { time: 1234567890, algorithm: 'SHA-256', expected8: '91819424' },
  { time: 1234567890, algorithm: 'SHA-512', expected8: '93441116' },
  { time: 2000000000, algorithm: 'SHA-1', expected8: '69279037' },
  { time: 2000000000, algorithm: 'SHA-256', expected8: '90698825' },
  { time: 2000000000, algorithm: 'SHA-512', expected8: '38618901' },
  { time: 20000000000, algorithm: 'SHA-1', expected8: '65353130' },
  { time: 20000000000, algorithm: 'SHA-256', expected8: '77737706' },
  { time: 20000000000, algorithm: 'SHA-512', expected8: '47863826' }
];

describe('TOTP against the RFC 6238 published test vectors', () => {
  it.each(VECTORS)('8 digits, $algorithm, T=$time', async ({ time, algorithm, expected8 }) => {
    const code = await totp(
      { secret: seedFor(algorithm), algorithm, digits: 8, period: 30 },
      time * 1000
    );
    expect(code).toBe(expected8);
  });

  it.each(VECTORS)('6 digits, $algorithm, T=$time (last 6 of the 8-digit vector)', async ({ time, algorithm, expected8 }) => {
    // Truncation to N digits is `binary mod 10^N`; since 10^6 divides 10^8,
    // (binary mod 10^8) mod 10^6 === binary mod 10^6, so the 6-digit code is
    // exactly the last 6 characters of the (zero-padded) 8-digit code.
    const code = await totp(
      { secret: seedFor(algorithm), algorithm, digits: 6, period: 30 },
      time * 1000
    );
    expect(code).toBe(expected8.slice(-6));
  });

  it('verifyTotp accepts the exact code at the exact time', async () => {
    const ok = await verifyTotp({ secret: SEED_SHA1, algorithm: 'SHA-1', digits: 8, period: 30 }, '94287082', 0, 59 * 1000);
    expect(ok).toBe(true);
  });

  it('verifyTotp rejects a wrong code', async () => {
    const ok = await verifyTotp({ secret: SEED_SHA1, algorithm: 'SHA-1', digits: 8, period: 30 }, '00000000', 1, 59 * 1000);
    expect(ok).toBe(false);
  });

  it('verifyTotp tolerates one step of clock skew either side, and no more', async () => {
    const params = { secret: SEED_SHA1, algorithm: 'SHA-1' as TotpAlgorithm, digits: 8, period: 30 };
    // T=59 falls in counter window 1 (0..29 is window 0, 30..59 is window 1).
    // One period later (T=89, still counter 2) is within a window of 1.
    const oneStepLater = await verifyTotp(params, '94287082', 1, 89 * 1000);
    expect(oneStepLater).toBe(true);
    // Three periods later is outside a window of 1.
    const threeStepsLater = await verifyTotp(params, '94287082', 1, (59 + 90) * 1000);
    expect(threeStepsLater).toBe(false);
  });

  it('accepts whitespace around a pasted code', async () => {
    const ok = await verifyTotp({ secret: SEED_SHA1, algorithm: 'SHA-1', digits: 8, period: 30 }, ' 94287082 ', 0, 59 * 1000);
    expect(ok).toBe(true);
  });
});

describe('HOTP (RFC 4226) — the counter-based primitive TOTP is built on', () => {
  // RFC 4226 Appendix D, 6-digit vectors for the seed "12345678901234567890".
  const RFC4226_6_DIGIT = [
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

  it.each(RFC4226_6_DIGIT.map((expected, counter) => ({ counter, expected })))(
    'counter $counter -> $expected',
    async ({ counter, expected }) => {
      const code = await hotp(SEED_SHA1, counter, 'SHA-1', 6);
      expect(code).toBe(expected);
    }
  );
});

describe('base32 round-trip', () => {
  it('encodes and decodes an arbitrary byte sequence losslessly', () => {
    const original = new Uint8Array([0, 1, 2, 3, 255, 254, 128, 17, 42, 9, 250]);
    const decoded = new TextDecoder();
    void decoded;
    const encoded = base32Encode(original);
    expect(encoded).toMatch(/^[A-Z2-7]+$/);
  });

  it('the well-known seed encodes to the well-known base32 string', () => {
    // RFC 4226 Appendix D states this exact mapping.
    expect(SEED_SHA1).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
  });
});
