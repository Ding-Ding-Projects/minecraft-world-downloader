import { registry } from '../../core/registry';

import { DOCS_BUNDLE } from './generated';
import type { BundledArticle, IntegrityReport, LibraryArticle } from './types';

/**
 * The library the browser reads from.
 *
 * Two sets of articles live in one index, and the difference between them is
 * stated rather than hidden:
 *
 * - **Bundled** articles come from `docs/features/*.md`, compiled into the build
 *   by `app/scripts/bundle-docs.mjs`. Their ids are `manual.<file-name>`.
 * - **Module** articles are the `DocArticle` entries feature modules register for
 *   themselves. They have no file on disk.
 *
 * Nothing here fetches anything. The bundle is a compiled-in TypeScript module,
 * and the module articles are already in memory by the time any of this runs.
 */

export const ID_PREFIX = 'manual.';

/* ------------------------------------------------------------------ */
/* Integrity                                                           */
/* ------------------------------------------------------------------ */

/**
 * The renderer's half of the 32-bit FNV-1a checksum the bundler records.
 *
 * Deliberately a second implementation of the same function: the bundler's runs
 * in Node over a `Buffer`, this one runs in the renderer over a `TextEncoder`
 * result, and a shared implementation would have to live outside both trees. The
 * two agreeing is the point — that is what makes a truncated or hand-edited
 * generated file detectable from inside the running application.
 */
export function checksum32(text: string): number {
  const bytes = new TextEncoder().encode(text);
  let hash = 0x811c9dc5;
  for (let index = 0; index < bytes.length; index += 1) {
    hash ^= bytes[index];
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

export function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

/**
 * Re-verifies the compiled-in bundle against itself.
 *
 * This is not the build guard and does not replace it. The build guard compares
 * the bundle with the Markdown files on disk and is the only thing that can
 * notice an article that was never bundled at all. This check runs inside the
 * application, where there is no disk to compare against, and catches the other
 * failure: a generated file that was truncated, hand-edited or badly merged
 * after it was written, whose recorded checksums no longer describe its own
 * contents.
 *
 * A failure is reported per article and never hides the rest. A bad checksum is
 * a reason to distrust one article, not to blank the other thirty.
 */
export function verifyBundle(): IntegrityReport {
  const problems: IntegrityReport['problems'] = [];
  const articles = Array.isArray(DOCS_BUNDLE.articles) ? DOCS_BUNDLE.articles : [];

  const declaredCount = DOCS_BUNDLE.manifest?.count ?? -1;
  if (declaredCount !== articles.length) {
    problems.push({
      articleId: '(manifest)',
      detail: `The manifest declares ${declaredCount} articles but ${articles.length} are present.`
    });
  }

  const declaredIds = [...(DOCS_BUNDLE.manifest?.ids ?? [])].sort((a, b) => a.localeCompare(b, 'en'));
  const actualIds = articles.map((article) => article.id).sort((a, b) => a.localeCompare(b, 'en'));
  if (declaredIds.join(' ') !== actualIds.join(' ')) {
    problems.push({
      articleId: '(manifest)',
      detail: 'The manifest id list does not match the articles present.'
    });
  }

  const seen = new Set<string>();
  for (const article of articles) {
    if (seen.has(article.id)) {
      problems.push({ articleId: article.id, detail: 'Two articles claim this id.' });
      continue;
    }
    seen.add(article.id);

    const body = typeof article.body === 'string' ? article.body : '';
    const actualChecksum = checksum32(body);
    if (article.checksum !== actualChecksum) {
      problems.push({
        articleId: article.id,
        detail: `Recorded checksum ${article.checksum} but its text checksums to ${actualChecksum}.`
      });
    }
    const actualBytes = byteLength(body);
    if (article.bytes !== actualBytes) {
      problems.push({
        articleId: article.id,
        detail: `Recorded ${article.bytes} bytes but its text is ${actualBytes} bytes.`
      });
    }
    if (typeof article.title !== 'string' || article.title.trim() === '') {
      problems.push({ articleId: article.id, detail: 'The article has no title.' });
    }
  }

  return {
    checkedAt: new Date().toISOString(),
    articleCount: articles.length,
    declaredCount,
    totalBytes: DOCS_BUNDLE.manifest?.totalBytes ?? 0,
    problems,
    ok: problems.length === 0
  };
}

/* ------------------------------------------------------------------ */
/* Reading the library                                                 */
/* ------------------------------------------------------------------ */

const WORDS_PER_MINUTE = 200;

function fromBundle(article: BundledArticle): LibraryArticle {
  return {
    id: article.id,
    title: article.title,
    category: article.category,
    body: article.body,
    related: [...article.related],
    sourceFile: article.sourceFile,
    headings: [...article.headings],
    readingMinutes: article.readingMinutes,
    bytes: article.bytes,
    origin: 'bundle'
  };
}

/** Derives the same fields for a feature-registered article, which has none. */
function fromModule(article: { id: string; title: string; category: string; body: string; related: string[] }): LibraryArticle {
  const body = typeof article.body === 'string' ? article.body : '';
  const words = body.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
  return {
    id: article.id,
    title: article.title,
    category: article.category,
    body,
    related: [...(article.related ?? [])],
    sourceFile: null,
    headings: headingsOf(body),
    readingMinutes: Math.max(1, Math.round(words / WORDS_PER_MINUTE)),
    bytes: byteLength(body),
    origin: 'module'
  };
}

/**
 * Extracts headings, skipping fenced code.
 *
 * Kept in step with the bundler's own extraction, and used only for
 * feature-registered articles — bundled ones already carry theirs, computed at
 * build time by the same rule.
 */
export function headingsOf(body: string): LibraryArticle['headings'] {
  const headings: LibraryArticle['headings'] = [];
  const seen = new Map<string, number>();
  let insideFence = false;
  for (const line of body.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) {
      insideFence = !insideFence;
      continue;
    }
    if (insideFence) continue;
    const match = line.match(/^(#{1,6})\s+(.+?)\s*$/);
    if (!match) continue;
    const text = match[2].replace(/\s*#+\s*$/, '').trim();
    if (text === '') continue;
    const base = text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    headings.push({ level: match[1].length, text, anchor: count === 0 ? base : `${base}-${count}` });
  }
  return headings;
}

/**
 * Every article the browser can show, bundled first then feature-registered.
 *
 * A feature-registered article whose id collides with a bundled one is dropped
 * rather than silently replacing it, because two different texts under one id
 * means whichever loaded last decides what the reader sees. The collision is
 * surfaced by `duplicateIds` rather than being swallowed.
 */
export function allArticles(): LibraryArticle[] {
  const byId = new Map<string, LibraryArticle>();
  for (const article of DOCS_BUNDLE.articles ?? []) {
    if (!byId.has(article.id)) byId.set(article.id, fromBundle(article));
  }
  for (const article of registry.docs()) {
    if (byId.has(article.id)) continue;
    byId.set(article.id, fromModule(article));
  }
  return [...byId.values()].sort(
    (a, b) => a.category.localeCompare(b.category, 'en') || a.title.localeCompare(b.title, 'en')
  );
}

export function articleById(id: string): LibraryArticle | null {
  return allArticles().find((article) => article.id === id) ?? null;
}

export function categories(): string[] {
  return [...new Set(allArticles().map((article) => article.category))].sort((a, b) =>
    a.localeCompare(b, 'en')
  );
}

/* ------------------------------------------------------------------ */
/* Link resolution                                                     */
/* ------------------------------------------------------------------ */

/**
 * Resolves a relative Markdown link to an article id, or null.
 *
 * The forms that appear in the real articles are all accepted: `locks.md`,
 * `./locks.md`, `locks.md#the-list`, the bare `locks`, and a full article id
 * such as `manual.locks` or a feature's own `settings.surface`. Anything that
 * climbs out of the directory, names another directory, or carries a scheme is
 * not an article and returns null, so the caller can say where it actually
 * pointed rather than doing nothing.
 */
export function resolveArticleLink(target: string, known: LibraryArticle[]): string | null {
  if (typeof target !== 'string' || target.trim() === '') return null;
  const trimmed = target.trim();
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return null;
  if (trimmed.startsWith('#')) return null;

  const [pathPart] = trimmed.split('#');
  if (pathPart === '') return null;
  if (pathPart.includes('..')) return null;

  const ids = new Set(known.map((article) => article.id));

  // An exact article id, as used by `related` entries and palette teleports.
  if (ids.has(pathPart)) return pathPart;

  const fileName = pathPart.replace(/^\.\//, '');
  if (fileName.includes('/')) return null;

  const slug = fileName.replace(/\.md$/i, '');
  if (ids.has(`${ID_PREFIX}${slug}`)) return `${ID_PREFIX}${slug}`;
  if (ids.has(slug)) return slug;
  return null;
}

/** The anchor part of a link target, or null. Used to jump within an article. */
export function anchorOf(target: string): string | null {
  const hash = typeof target === 'string' ? target.indexOf('#') : -1;
  if (hash === -1) return null;
  const anchor = target.slice(hash + 1).trim();
  return anchor === '' ? null : anchor;
}

/* ------------------------------------------------------------------ */
/* Search                                                              */
/* ------------------------------------------------------------------ */

export interface SearchHit {
  article: LibraryArticle;
  /** Occurrences in the body. Zero when body search is off or it matched a title. */
  bodyHits: number;
  /** True when the title, category or source path matched. */
  metadataMatch: boolean;
}

/**
 * Counts how many times a query matches inside a body.
 *
 * A regular-expression query is counted with a global clone of the compiled
 * pattern; a plain-text query is counted by scanning for the lowercased needle.
 * Either way the count is real, and it is bounded so a pathological pattern on a
 * large article cannot spin: past the cap the count is reported as the cap,
 * which still tells the reader this article matches heavily.
 */
export const MAX_COUNTED_HITS = 999;

export function countHits(body: string, text: string, compiled: RegExp | null): number {
  if (body === '') return 0;
  if (compiled) {
    const flags = compiled.flags.includes('g') ? compiled.flags : `${compiled.flags}g`;
    let pattern: RegExp;
    try {
      pattern = new RegExp(compiled.source, flags);
    } catch {
      return 0;
    }
    let count = 0;
    let match = pattern.exec(body);
    while (match && count < MAX_COUNTED_HITS) {
      count += 1;
      // A zero-width match would never advance on its own.
      if (match.index === pattern.lastIndex) pattern.lastIndex += 1;
      match = pattern.exec(body);
    }
    return count;
  }
  const needle = text.trim().toLowerCase();
  if (needle === '') return 0;
  const haystack = body.toLowerCase();
  let count = 0;
  let index = haystack.indexOf(needle);
  while (index !== -1 && count < MAX_COUNTED_HITS) {
    count += 1;
    index = haystack.indexOf(needle, index + needle.length);
  }
  return count;
}

/**
 * Filters the library by a search query.
 *
 * Metadata — title, category and source path — is always searched. Bodies are
 * searched only when the reader has left that on, and the number of occurrences
 * is reported so the heaviest match is obvious before opening anything.
 */
export function search(
  articles: LibraryArticle[],
  query: { text: string; matches(value: string): boolean; compiled: RegExp | null },
  searchBodies: boolean
): SearchHit[] {
  const hits: SearchHit[] = [];
  for (const article of articles) {
    const metadata = `${article.title} ${article.category} ${article.id} ${article.sourceFile ?? ''}`;
    const metadataMatch = query.matches(metadata);
    const bodyMatch = searchBodies && query.matches(article.body);
    if (!metadataMatch && !bodyMatch) continue;
    hits.push({
      article,
      bodyHits: searchBodies ? countHits(article.body, query.text, query.compiled) : 0,
      metadataMatch
    });
  }
  return hits;
}

/** A human byte size. Used wherever a size is shown beside an article. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const kilobytes = bytes / 1024;
  if (kilobytes < 1024) return `${Math.round(kilobytes * 10) / 10} kB`;
  return `${Math.round((kilobytes / 1024) * 10) / 10} MB`;
}

export { DOCS_BUNDLE };
