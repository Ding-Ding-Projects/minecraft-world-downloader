import type { FeedEntry } from './types';

/**
 * Reading a Squirrel release feed.
 *
 * The feed is a `RELEASES` file: one package per line, three whitespace-separated
 * fields, `<sha1> <filename> <size>`. Blank lines and `#` comments are ignored.
 * Anything else is a malformed feed, and a malformed feed is reported as one
 * rather than being partially believed — half-understood release metadata is how
 * an updater downloads the wrong thing.
 *
 * Nothing here claims anything about authenticity. A SHA-1 in a feed proves that
 * the bytes are the bytes that feed named; it is not a signature, it is not a
 * publisher identity, and this project does not sign its artifacts at all.
 */

export interface FeedParseResult {
  entries: FeedEntry[];
  /** Lines the parser refused, with the reason, so the failure is inspectable. */
  rejected: Array<{ line: number; text: string; reason: string }>;
}

const PACKAGE_NAME = /^(?<id>.+?)-(?<version>\d+(?:\.\d+)*(?:[-+][0-9A-Za-z.-]+)?)-(?<kind>full|delta)\.nupkg$/;
const SHA1_HEX = /^[0-9a-f]{40}$/i;

/** Splits a version into numeric parts and an optional prerelease tail. */
function splitVersion(version: string): { numbers: number[]; prerelease: string } {
  const [core, ...rest] = version.split(/[-+]/);
  const numbers = core.split('.').map((part) => {
    const value = Number.parseInt(part, 10);
    return Number.isFinite(value) ? value : 0;
  });
  return { numbers, prerelease: rest.join('-') };
}

/**
 * Orders two versions. Negative when `a` is older, positive when `a` is newer.
 *
 * A prerelease sorts before the release it leads to (`1.2.0-beta.1` < `1.2.0`),
 * which is the rule every packaging tool in this ecosystem uses, and getting it
 * backwards would make a beta look like an upgrade over the stable build it was
 * cut from.
 */
export function compareVersions(a: string, b: string): number {
  const left = splitVersion(a.trim());
  const right = splitVersion(b.trim());
  const length = Math.max(left.numbers.length, right.numbers.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (left.numbers[index] ?? 0) - (right.numbers[index] ?? 0);
    if (difference !== 0) return difference < 0 ? -1 : 1;
  }
  if (left.prerelease === right.prerelease) return 0;
  if (left.prerelease === '') return 1;
  if (right.prerelease === '') return -1;
  return left.prerelease < right.prerelease ? -1 : 1;
}

export function isPrerelease(version: string): boolean {
  return splitVersion(version).prerelease !== '';
}

/**
 * Resolves a package file name against the feed address.
 *
 * Squirrel feeds name packages relatively, so `RELEASES` sitting at
 * `…/releases/latest/download/RELEASES` puts its packages beside it. An absolute
 * URL in the feed is honoured as written; anything that is not http or https is
 * refused, because the privileged bridge would refuse it anyway and a clear
 * message here beats an opaque one there.
 */
export function resolvePackageUrl(feedUrl: string, fileName: string): string | null {
  try {
    const resolved = new URL(fileName, feedUrl);
    if (resolved.protocol !== 'https:' && resolved.protocol !== 'http:') return null;
    return resolved.toString();
  } catch {
    return null;
  }
}

/** Parses a `RELEASES` document. Never throws: a bad feed is a reported result. */
export function parseFeed(text: string, feedUrl: string): FeedParseResult {
  const entries: FeedEntry[] = [];
  const rejected: FeedParseResult['rejected'] = [];
  const lines = text.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index];
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) continue;

    const fields = line.split(/\s+/);
    if (fields.length < 3) {
      rejected.push({ line: index + 1, text: line, reason: 'expected three fields: hash, file name and size' });
      continue;
    }
    const [sha1, fileName, sizeText] = fields;
    if (!SHA1_HEX.test(sha1)) {
      rejected.push({ line: index + 1, text: line, reason: 'the first field is not a 40-character SHA-1 digest' });
      continue;
    }
    const size = Number.parseInt(sizeText, 10);
    if (!Number.isFinite(size) || size <= 0) {
      rejected.push({ line: index + 1, text: line, reason: 'the size field is not a positive whole number' });
      continue;
    }
    const match = PACKAGE_NAME.exec(fileName);
    if (!match?.groups) {
      rejected.push({
        line: index + 1,
        text: line,
        reason: 'the file name is not <id>-<version>-full.nupkg or <id>-<version>-delta.nupkg'
      });
      continue;
    }
    const url = resolvePackageUrl(feedUrl, fileName);
    if (!url) {
      rejected.push({ line: index + 1, text: line, reason: 'the package address does not resolve to an http or https URL' });
      continue;
    }
    entries.push({
      sha1: sha1.toLowerCase(),
      fileName,
      size,
      version: match.groups.version,
      kind: match.groups.kind === 'delta' ? 'delta' : 'full',
      url
    });
  }

  return { entries, rejected };
}

export interface CandidateOptions {
  currentVersion: string;
  acceptPrerelease: boolean;
  allowDowngrade: boolean;
}

export interface CandidateResult {
  /** The package to install, or null when there is nothing to do. */
  entry: FeedEntry | null;
  /**
   * Set when a package exists but was deliberately not chosen. The surface says
   * so rather than reporting "up to date", which would be a different fact.
   */
  blocked: 'downgrade' | 'prerelease' | null;
  /** The newest version the feed offers at all, whether or not it was chosen. */
  newestOffered: string | null;
}

/**
 * Picks the package to install.
 *
 * Only complete packages are considered. A differential package is meaningless
 * without the exact build it was cut against, and this updater stages one file
 * rather than reconstructing a chain — offering a delta it cannot apply would be
 * a control that looks like it works and does not.
 */
export function chooseCandidate(entries: FeedEntry[], options: CandidateOptions): CandidateResult {
  const full = entries.filter((entry) => entry.kind === 'full');
  if (full.length === 0) return { entry: null, blocked: null, newestOffered: null };

  const ordered = [...full].sort((a, b) => compareVersions(b.version, a.version));
  const newestOffered = ordered[0].version;

  const eligible = ordered.filter((entry) => options.acceptPrerelease || !isPrerelease(entry.version));
  if (eligible.length === 0) {
    return { entry: null, blocked: 'prerelease', newestOffered };
  }

  const best = eligible[0];
  const order = compareVersions(best.version, options.currentVersion);
  if (order > 0) return { entry: best, blocked: null, newestOffered };
  if (order === 0) return { entry: null, blocked: null, newestOffered };
  if (options.allowDowngrade) return { entry: best, blocked: null, newestOffered };
  return { entry: null, blocked: 'downgrade', newestOffered };
}
