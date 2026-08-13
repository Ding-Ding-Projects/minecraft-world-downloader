/**
 * The shape of the compiled-in documentation bundle.
 *
 * `generated.ts` is written by `app/scripts/bundle-docs.mjs` and is typed
 * against this file, so a change to the generator that stops producing a field
 * the browser reads is a compile error rather than an `undefined` that renders
 * as an empty heading.
 */

export interface BundledHeading {
  /** 1 for `#`, 2 for `##`, and so on. */
  level: number;
  text: string;
  /** A stable slug, unique within the article even when two headings match. */
  anchor: string;
}

export interface BundledArticle {
  /** `manual.<file-name-without-extension>`. Stable; used as a link target. */
  id: string;
  /** The file name without its extension, e.g. `locks`. */
  slug: string;
  title: string;
  category: string;
  /** The Markdown source, verbatim. */
  body: string;
  /** Ids of other bundled articles this one links to or names explicitly. */
  related: string[];
  /** Link targets that leave the bundle, kept so they can be named honestly. */
  externalLinks: string[];
  /** Repository-relative source path, e.g. `docs/features/locks.md`. */
  sourceFile: string;
  headings: BundledHeading[];
  /** UTF-8 byte length of `body`. Re-verified at boot. */
  bytes: number;
  words: number;
  readingMinutes: number;
  /** 32-bit FNV-1a over the UTF-8 bytes of `body`. Re-verified at boot. */
  checksum: number;
  /** SHA-256 of `body`, compared against the file on disk by the build guard. */
  sha256: string;
}

export interface DocsBundleManifest {
  count: number;
  ids: string[];
  digest: string;
  totalBytes: number;
}

export interface DocsBundle {
  schemaVersion: number;
  generatedAt: string;
  generator: string;
  command: string;
  checkCommand: string;
  sourceDirectory: string;
  articles: BundledArticle[];
  manifest: DocsBundleManifest;
}

/** One problem found while re-verifying the bundle inside the application. */
export interface IntegrityProblem {
  articleId: string;
  detail: string;
}

export interface IntegrityReport {
  checkedAt: string;
  articleCount: number;
  declaredCount: number;
  totalBytes: number;
  problems: IntegrityProblem[];
  ok: boolean;
}

/** An article as the browser works with it, bundled or feature-registered. */
export interface LibraryArticle {
  id: string;
  title: string;
  category: string;
  body: string;
  related: string[];
  /** Bundled articles carry their file; feature-registered ones do not. */
  sourceFile: string | null;
  headings: BundledHeading[];
  readingMinutes: number;
  bytes: number;
  /** `bundle` came from docs/features/; `module` was registered by a feature. */
  origin: 'bundle' | 'module';
}

/** Per-article state the reader owns: read marks and bookmarks. */
export interface ReadingState {
  read: string[];
  bookmarked: string[];
}
