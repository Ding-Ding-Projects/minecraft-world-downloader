import { CHANGELOG_DATA } from './generated';
import type { ChangeCategory, ChangeEntry, ChangelogData, ReleaseRecord } from './types';

/**
 * The bundled changelog, and the small amount of reasoning the viewer needs
 * about it.
 *
 * Nothing here fabricates a fallback. When the bundle is missing or malformed —
 * which in a correctly built application it cannot be, because
 * `validate-changelog.mjs` runs before the build — the viewer renders an honest
 * empty state naming the generator command rather than inventing a version to
 * fill the screen.
 */

const EMPTY: ChangelogData = {
  schemaVersion: 1,
  generatedAt: '',
  generator: 'app/scripts/generate-changelog.mjs',
  command: 'node scripts/generate-changelog.mjs',
  forge: { kind: 'unknown', owner: '', repository: '', webUrl: null, commitUrlTemplate: null, remote: null },
  headCommit: '',
  releases: [],
  commitsExamined: 0,
  bodyLimit: 0
};

function usable(candidate: unknown): candidate is ChangelogData {
  if (typeof candidate !== 'object' || candidate === null) return false;
  const data = candidate as Partial<ChangelogData>;
  return data.schemaVersion === 1 && Array.isArray(data.releases);
}

export const changelog: ChangelogData = usable(CHANGELOG_DATA) ? CHANGELOG_DATA : EMPTY;

/** True when this build carries no changelog at all. */
export function isEmptyBundle(): boolean {
  return changelog.releases.length === 0;
}

/**
 * The browsable page for one commit, or null when there is no recognised forge.
 *
 * Null is deliberate. A commit id with nowhere to point renders as selectable
 * text with a stated reason, because a link that resolves to nothing is worse
 * than no link — the reader has no way to tell it was never checked.
 */
export function commitUrl(sha: string): string | null {
  const template = changelog.forge.commitUrlTemplate;
  if (!template || !/^[0-9a-f]{7,40}$/.test(sha)) return null;
  return template.replace('{sha}', sha);
}

export function totalEntries(): number {
  return changelog.releases.reduce((total, release) => total + release.entries.length, 0);
}

/** Every category that actually appears, in the bundle's own order of use. */
export function presentCategories(): ChangeCategory[] {
  const seen = new Set<ChangeCategory>();
  for (const release of changelog.releases) {
    for (const entry of release.entries) seen.add(entry.category);
  }
  return [...seen];
}

export function categoryCounts(): Map<ChangeCategory, number> {
  const counts = new Map<ChangeCategory, number>();
  for (const release of changelog.releases) {
    for (const entry of release.entries) {
      counts.set(entry.category, (counts.get(entry.category) ?? 0) + 1);
    }
  }
  return counts;
}

/** The oldest and newest release dates present, for the date picker's bounds. */
export function dateBounds(): { min: string | null; max: string | null } {
  let min: string | null = null;
  let max: string | null = null;
  for (const release of changelog.releases) {
    if (min === null || release.date < min) min = release.date;
    if (max === null || release.date > max) max = release.date;
  }
  return { min, max };
}

export function newestRelease(): ReleaseRecord | null {
  return changelog.releases[0] ?? null;
}

/** Everything about one change that a text search should look through. */
export function entryHaystack(release: ReleaseRecord, item: ChangeEntry): string {
  return [
    release.version,
    release.date,
    item.summary,
    item.body,
    item.author,
    item.commit,
    item.shortCommit,
    item.category
  ].join('\n');
}

export function releaseHaystack(release: ReleaseRecord): string {
  return [release.version, release.date, release.commit, release.shortCommit].join('\n');
}
