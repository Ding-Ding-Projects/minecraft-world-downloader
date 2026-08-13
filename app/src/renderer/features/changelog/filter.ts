import { entryHaystack, releaseHaystack } from './data';
import type { ChangeCategory, ChangeEntry, ReleaseRecord } from './types';
import { CHANGE_CATEGORIES } from './types';

/**
 * The filter model.
 *
 * The rule that matters: the date range, the text search, the category chips,
 * the breaking switch and the released switch all COMPOSE. None of them
 * overrides another and none of them silently widens when a second one is set.
 * A user who narrows to 2026 and then types a word gets the changes in 2026 that
 * match the word, which is the only reading of "both filters are on" that is not
 * a lie.
 *
 * One deliberate asymmetry, stated because it is a real decision rather than an
 * accident: the date range and the released switch apply to the VERSION, while
 * the categories and the breaking switch apply to a CHANGE. Typing a version
 * number therefore shows that whole version rather than nothing, because the
 * thing that matched was the version itself.
 */

/** A search predicate over one string. Supplied by the shared search bar. */
export type TextPredicate = (value: string) => boolean;

export interface ChangelogFilter {
  /** Raw text, kept so the field and the export header agree. */
  text: string;
  /** True when the user deliberately switched the field to a pattern. */
  regex: boolean;
  pattern: string;
  flags: string;
  /** Null when the predicate should accept everything. */
  matches: TextPredicate | null;
  /** Inclusive `YYYY-MM-DD` bounds on the release date. */
  from: string | null;
  to: string | null;
  /** Empty means every category. */
  categories: ChangeCategory[];
  breakingOnly: boolean;
  releasedOnly: boolean;
}

export function emptyFilter(): ChangelogFilter {
  return {
    text: '',
    regex: false,
    pattern: '',
    flags: 'i',
    matches: null,
    from: null,
    to: null,
    categories: [],
    breakingOnly: false,
    releasedOnly: false
  };
}

export function isFiltering(filter: ChangelogFilter): boolean {
  return (
    filter.text.trim() !== '' ||
    filter.from !== null ||
    filter.to !== null ||
    filter.categories.length > 0 ||
    filter.breakingOnly ||
    filter.releasedOnly
  );
}

export interface FilteredRelease {
  release: ReleaseRecord;
  /** The changes that survived. Never a reordering of a different release. */
  entries: ChangeEntry[];
  /** How many of this version's changes the filter removed. */
  hidden: number;
  /** True when the version itself matched the text rather than one of its changes. */
  matchedByVersion: boolean;
}

export interface FilterResult {
  releases: FilteredRelease[];
  /** Changes shown, after filtering. */
  entryCount: number;
  /** Changes the filter removed from versions that are still shown. */
  hiddenCount: number;
}

function inDateRange(release: ReleaseRecord, filter: ChangelogFilter): boolean {
  if (filter.from !== null && release.date < filter.from) return false;
  if (filter.to !== null && release.date > filter.to) return false;
  return true;
}

function categoryAllowed(entry: ChangeEntry, filter: ChangelogFilter): boolean {
  if (filter.breakingOnly && !entry.breaking) return false;
  if (filter.categories.length === 0) return true;
  return filter.categories.includes(entry.category);
}

export function applyFilter(releases: readonly ReleaseRecord[], filter: ChangelogFilter): FilterResult {
  const out: FilteredRelease[] = [];
  let entryCount = 0;
  let hiddenCount = 0;

  for (const release of releases) {
    if (filter.releasedOnly && !release.released) continue;
    if (!inDateRange(release, filter)) continue;

    const byCategory = release.entries.filter((entry) => categoryAllowed(entry, filter));

    let kept: ChangeEntry[];
    let matchedByVersion = false;

    if (filter.matches === null) {
      kept = byCategory;
    } else if (filter.matches(releaseHaystack(release))) {
      // The version itself is what matched, so the whole version is the answer.
      kept = byCategory;
      matchedByVersion = true;
    } else {
      kept = byCategory.filter((entry) => filter.matches?.(entryHaystack(release, entry)) ?? true);
    }

    const entryFilterActive =
      filter.categories.length > 0 || filter.breakingOnly || (filter.matches !== null && !matchedByVersion);

    // A version with no recorded changes is kept so it can say so — but only
    // when no filter is asking about the changes it does not have.
    if (kept.length === 0 && (release.entries.length > 0 || entryFilterActive)) continue;

    const hidden = release.entries.length - kept.length;
    out.push({ release, entries: kept, hidden, matchedByVersion });
    entryCount += kept.length;
    hiddenCount += hidden;
  }

  return { releases: out, entryCount, hiddenCount };
}

/** Groups one version's changes by category, in the canonical category order. */
export function groupByCategory(entries: readonly ChangeEntry[]): Array<{ category: ChangeCategory; entries: ChangeEntry[] }> {
  const buckets = new Map<ChangeCategory, ChangeEntry[]>();
  for (const entry of entries) {
    const bucket = buckets.get(entry.category);
    if (bucket) bucket.push(entry);
    else buckets.set(entry.category, [entry]);
  }
  const groups: Array<{ category: ChangeCategory; entries: ChangeEntry[] }> = [];
  for (const category of CHANGE_CATEGORIES) {
    const bucket = buckets.get(category);
    if (bucket && bucket.length > 0) groups.push({ category, entries: bucket });
  }
  return groups;
}

/* ------------------------------------------------------------------ */
/* Persistence                                                         */
/* ------------------------------------------------------------------ */

/**
 * The part of a filter that survives a restart.
 *
 * The predicate itself is a function and is rebuilt from `text`, `regex`,
 * `pattern` and `flags` on load, so nothing unserializable is ever written to
 * the settings file.
 */
export interface StoredView {
  text: string;
  regex: boolean;
  pattern: string;
  flags: string;
  from: string | null;
  to: string | null;
  categories: ChangeCategory[];
  breakingOnly: boolean;
  releasedOnly: boolean;
}

export function toStoredView(filter: ChangelogFilter): StoredView {
  return {
    text: filter.text,
    regex: filter.regex,
    pattern: filter.pattern,
    flags: filter.flags,
    from: filter.from,
    to: filter.to,
    categories: [...filter.categories],
    breakingOnly: filter.breakingOnly,
    releasedOnly: filter.releasedOnly
  };
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Reads a stored view back, rejecting anything that is not the shape it should
 * be. A settings file edited by hand, or written by an older build, must not be
 * able to put the viewer into a state it cannot render.
 */
export function fromStoredView(raw: unknown): StoredView | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const value = raw as Partial<StoredView>;
  const text = typeof value.text === 'string' ? value.text.slice(0, 2000) : '';
  const pattern = typeof value.pattern === 'string' ? value.pattern.slice(0, 2000) : '';
  const flags = typeof value.flags === 'string' && /^[dgimsuvy]*$/.test(value.flags) ? value.flags : 'i';
  const from = typeof value.from === 'string' && ISO_DATE.test(value.from) ? value.from : null;
  const to = typeof value.to === 'string' && ISO_DATE.test(value.to) ? value.to : null;
  const categories = Array.isArray(value.categories)
    ? value.categories.filter((candidate): candidate is ChangeCategory =>
        (CHANGE_CATEGORIES as readonly string[]).includes(candidate as string)
      )
    : [];
  return {
    text,
    regex: value.regex === true,
    pattern,
    flags,
    from,
    to,
    categories,
    breakingOnly: value.breakingOnly === true,
    releasedOnly: value.releasedOnly === true
  };
}

/** A one-line description of what is currently narrowing the list. */
export function describeFilter(
  filter: ChangelogFilter,
  categoryName: (category: ChangeCategory) => string
): string {
  const parts: string[] = [];
  if (filter.text.trim() !== '') {
    parts.push(filter.regex ? `pattern /${filter.pattern}/${filter.flags}` : `text "${filter.text}"`);
  }
  if (filter.from !== null && filter.to !== null) parts.push(`${filter.from} to ${filter.to}`);
  else if (filter.from !== null) parts.push(`from ${filter.from}`);
  else if (filter.to !== null) parts.push(`up to ${filter.to}`);
  if (filter.categories.length > 0) parts.push(filter.categories.map(categoryName).join(', '));
  if (filter.breakingOnly) parts.push('breaking changes only');
  if (filter.releasedOnly) parts.push('released versions only');
  return parts.join(' · ');
}
