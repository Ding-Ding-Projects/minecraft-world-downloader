import { history } from '../../core/history';
import { settings } from '../../core/settings';

import type { ReadingState } from './types';

/**
 * The reader's own state: which articles have been read, which are bookmarked,
 * where they were last reading, and how wide the index pane sits.
 *
 * All of it is persisted through the ordinary settings store, so it survives a
 * restart, participates in the settings surface's export and import, and is
 * recorded in local history like any other change. Nothing private passes
 * through here — the whole store is a list of article ids and a number.
 */

export const SETTING_START = 'docs-browser.startArticle';
export const SETTING_SEARCH_BODIES = 'docs-browser.searchBodies';
export const SETTING_SHOW_SOURCE = 'docs-browser.showSource';
export const SETTING_SHOW_OUTLINE = 'docs-browser.showOutline';
export const SETTING_VERIFY_ON_START = 'docs-browser.verifyOnStart';
export const SETTING_SPLIT_WIDTH = 'docs-browser.splitWidth';

/** Not a setting control: the reader's position, written as they read. */
export const STATE_LAST_ARTICLE = 'docs-browser.lastArticle';
export const STATE_READ = 'docs-browser.readArticles';
export const STATE_BOOKMARKS = 'docs-browser.bookmarkedArticles';

export const START_CONTINUE = 'last';
export const DEFAULT_SPLIT_WIDTH = 320;
export const MIN_SPLIT_WIDTH = 200;
export const MAX_SPLIT_WIDTH = 640;

function readIds(key: string): string[] {
  const stored = settings.get<unknown>(key, []);
  if (!Array.isArray(stored)) return [];
  return [...new Set(stored.filter((entry): entry is string => typeof entry === 'string' && entry !== ''))];
}

export function readingState(): ReadingState {
  return { read: readIds(STATE_READ), bookmarked: readIds(STATE_BOOKMARKS) };
}

export function isRead(id: string): boolean {
  return readIds(STATE_READ).includes(id);
}

export function isBookmarked(id: string): boolean {
  return readIds(STATE_BOOKMARKS).includes(id);
}

export function lastArticle(): string | null {
  const stored = settings.get<string>(STATE_LAST_ARTICLE, '');
  return typeof stored === 'string' && stored !== '' ? stored : null;
}

export function rememberArticle(id: string): void {
  // Deliberately not history-recorded. "Which article is on screen" changes on
  // every click, and a history full of that is a history nobody can read.
  settings.set(STATE_LAST_ARTICLE, id);
}

export interface BulkOutcome {
  /** How many articles actually changed state. */
  changed: number;
  /** How many were already in the requested state and were left alone. */
  unchanged: number;
}

/**
 * Applies a read or bookmark change to a set of articles.
 *
 * It reports how many genuinely changed and how many were already in that
 * state, so the caller can say "nothing changed, they were already read"
 * instead of claiming a success that did nothing. When nothing changed, no
 * history entry is written either — an unchanged state is not an event.
 */
async function applySet(
  key: string,
  ids: string[],
  value: boolean,
  action: string
): Promise<BulkOutcome> {
  const current = new Set(readIds(key));
  let changed = 0;
  for (const id of ids) {
    if (value && !current.has(id)) {
      current.add(id);
      changed += 1;
    } else if (!value && current.has(id)) {
      current.delete(id);
      changed += 1;
    }
  }
  const outcome: BulkOutcome = { changed, unchanged: ids.length - changed };
  if (changed === 0) return outcome;

  settings.set(key, [...current].sort((a, b) => a.localeCompare(b, 'en')));
  await history.record(action, 'docs-browser', { articles: ids, changed, value });
  return outcome;
}

export function setRead(ids: string[], value: boolean): Promise<BulkOutcome> {
  return applySet(
    STATE_READ,
    ids,
    value,
    value ? 'Marked documentation articles read' : 'Marked documentation articles unread'
  );
}

export function setBookmarked(ids: string[], value: boolean): Promise<BulkOutcome> {
  return applySet(
    STATE_BOOKMARKS,
    ids,
    value,
    value ? 'Bookmarked documentation articles' : 'Removed documentation bookmarks'
  );
}

/**
 * Clears every read mark and bookmark.
 *
 * Recorded in local history with the exact lists that were cleared, which is
 * what makes it recoverable: history is append-only here, so restoring an
 * earlier state is itself a new entry rather than a rewrite.
 */
export async function clearAllMarks(): Promise<{ read: number; bookmarks: number }> {
  const before = readingState();
  if (before.read.length === 0 && before.bookmarked.length === 0) {
    return { read: 0, bookmarks: 0 };
  }
  settings.set(STATE_READ, []);
  settings.set(STATE_BOOKMARKS, []);
  await history.record('Cleared every documentation read mark and bookmark', 'docs-browser', {
    read: before.read,
    bookmarked: before.bookmarked
  });
  return { read: before.read.length, bookmarks: before.bookmarked.length };
}

export function splitWidth(): number {
  const stored = Number(settings.get<number>(SETTING_SPLIT_WIDTH, DEFAULT_SPLIT_WIDTH));
  if (!Number.isFinite(stored)) return DEFAULT_SPLIT_WIDTH;
  return Math.min(MAX_SPLIT_WIDTH, Math.max(MIN_SPLIT_WIDTH, Math.round(stored)));
}

export function setSplitWidth(value: number): void {
  const clamped = Math.min(MAX_SPLIT_WIDTH, Math.max(MIN_SPLIT_WIDTH, Math.round(value)));
  settings.set(SETTING_SPLIT_WIDTH, clamped);
}

export function searchBodiesEnabled(): boolean {
  return settings.get<boolean>(SETTING_SEARCH_BODIES, true) !== false;
}

export function showSourceEnabled(): boolean {
  return settings.get<boolean>(SETTING_SHOW_SOURCE, false) === true;
}

export function showOutlineEnabled(): boolean {
  return settings.get<boolean>(SETTING_SHOW_OUTLINE, true) !== false;
}

export function verifyOnStartEnabled(): boolean {
  return settings.get<boolean>(SETTING_VERIFY_ON_START, true) !== false;
}

export function startArticleChoice(): string {
  const stored = settings.get<string>(SETTING_START, START_CONTINUE);
  return typeof stored === 'string' && stored !== '' ? stored : START_CONTINUE;
}
