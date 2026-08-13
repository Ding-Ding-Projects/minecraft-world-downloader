#!/usr/bin/env node
/**
 * Bundles every documentation article into the build.
 *
 * Reads `docs/features/*.md` and writes
 * `app/src/renderer/features/docs-browser/generated.ts`, a plain TypeScript
 * module the renderer imports like any other source file. Nothing is fetched at
 * runtime: the in-application documentation browser works with the machine
 * completely offline, on the first launch after installation, with no cache to
 * warm and nothing that can 404.
 *
 * Run it directly:
 *
 *     node scripts/bundle-docs.mjs
 *
 * and check the result with:
 *
 *     node scripts/check-docs-bundle.mjs
 *
 * The check is the half that matters. Bundling drops a file exactly as easily as
 * it includes one, and a documentation browser silently missing its newest
 * article looks identical to one that is complete.
 */

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = resolve(HERE, '..');
const REPO_ROOT = resolve(APP_ROOT, '..');

export const SOURCE_DIRECTORY = join(REPO_ROOT, 'docs', 'features');
export const OUTPUT_FILE = join(
  APP_ROOT,
  'src',
  'renderer',
  'features',
  'docs-browser',
  'generated.ts'
);

export const SCHEMA_VERSION = 1;
export const ID_PREFIX = 'manual.';
export const BEGIN_MARKER = '/* docs-bundle:begin */';
export const END_MARKER = '/* docs-bundle:end */';
export const DECLARATION = 'export const DOCS_BUNDLE: DocsBundle = ';

/** The category used when the index does not place a file in a group. */
export const FALLBACK_CATEGORY = 'Feature guides';
/** The category the documentation index itself gets. */
export const INDEX_CATEGORY = 'Start here';

/* ------------------------------------------------------------------ */
/* Small helpers, duplicated deliberately                              */
/* ------------------------------------------------------------------ */

/**
 * A 32-bit FNV-1a checksum over the UTF-8 bytes of a string.
 *
 * The renderer computes this same value from the bundled body at boot and
 * compares it with the number recorded here, so a generated file that was
 * truncated, hand-edited or merged badly is caught by the application itself
 * rather than only by a build step somebody may have skipped. It is deliberately
 * implemented twice — here with `Buffer`, in the renderer with `TextEncoder` —
 * because a shared implementation would have to live outside both trees.
 */
export function checksum32(text) {
  const bytes = Buffer.from(text, 'utf8');
  let hash = 0x811c9dc5;
  for (let index = 0; index < bytes.length; index += 1) {
    hash ^= bytes[index];
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

export function sha256(text) {
  return createHash('sha256').update(Buffer.from(text, 'utf8')).digest('hex');
}

export function slugOf(fileName) {
  return fileName.replace(/\.md$/i, '');
}

export function idOf(slug) {
  return `${ID_PREFIX}${slug}`;
}

function prettify(slug) {
  const words = slug.replace(/[-_]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/* ------------------------------------------------------------------ */
/* Parsing one article                                                 */
/* ------------------------------------------------------------------ */

const METADATA = /<!--\s*docs-browser:\s*([a-z]+)\s*:\s*([^>]*?)\s*-->/gi;
const HEADING = /^(#{1,6})\s+(.+?)\s*$/;
const LINK = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

/**
 * Removes fenced code blocks, replacing each with a blank line.
 *
 * Everything that scans an article for structure runs over this first. An
 * article that documents the metadata markers shows them inside a fence, and a
 * scanner that cannot tell the difference reads the example as a real
 * instruction — which is exactly how this article gave itself the wrong category
 * the first time it was bundled. The same applies to links: a Markdown link
 * printed inside a code sample is an illustration, not a reference.
 */
export function stripFences(body) {
  const out = [];
  let insideFence = false;
  for (const line of body.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) {
      insideFence = !insideFence;
      out.push('');
      continue;
    }
    out.push(insideFence ? '' : line);
  }
  return out.join('\n');
}

/** Reads the optional `<!-- docs-browser: key: value -->` markers. */
export function readMetadata(source) {
  const body = stripFences(source);
  const found = {};
  METADATA.lastIndex = 0;
  let match = METADATA.exec(body);
  while (match) {
    found[match[1].toLowerCase()] = match[2].trim();
    match = METADATA.exec(body);
  }
  return found;
}

export function readTitle(body, slug) {
  // Through `readHeadings` so a `# comment` line inside a shell code fence is
  // never mistaken for the article's title.
  const first = readHeadings(body).find((heading) => heading.level === 1);
  return first ? first.text : prettify(slug);
}

export function readHeadings(body) {
  const headings = [];
  const seen = new Map();
  let insideFence = false;
  for (const line of body.split(/\r?\n/)) {
    if (line.startsWith('```')) {
      insideFence = !insideFence;
      continue;
    }
    if (insideFence) continue;
    const heading = line.match(HEADING);
    if (!heading) continue;
    const text = heading[2].replace(/\s*#+\s*$/, '').trim();
    if (text === '') continue;
    const base = text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    headings.push({
      level: heading[1].length,
      text,
      anchor: count === 0 ? base : `${base}-${count}`
    });
  }
  return headings;
}

/**
 * Collects every link the article makes, split into the ones that land on
 * another bundled article and the ones that leave the bundle.
 *
 * The second list is not discarded. A reader who clicks a link that points
 * outside the bundled set is told exactly where it pointed, rather than getting
 * a control that quietly does nothing.
 */
export function readLinks(source, slugs, ownSlug) {
  const body = stripFences(source);
  const internal = [];
  const external = [];
  LINK.lastIndex = 0;
  let match = LINK.exec(body);
  while (match) {
    const raw = match[1];
    const target = resolveLinkTarget(raw, slugs);
    if (target && target !== ownSlug) {
      if (!internal.includes(target)) internal.push(target);
    } else if (!target && !external.includes(raw)) {
      external.push(raw);
    }
    match = LINK.exec(body);
  }
  return { internal, external };
}

/**
 * Resolves a Markdown link target to a bundled slug, or null.
 *
 * `world-download.md`, `./world-download.md`, `world-download.md#saving` and the
 * bare `world-download` all name the same article. `../../AGENTS.md` names a
 * file that is not part of the bundle, and an `https://` target is somebody
 * else's website; both return null.
 */
export function resolveLinkTarget(raw, slugs) {
  if (typeof raw !== 'string' || raw === '') return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return null;
  if (raw.startsWith('#')) return null;
  const withoutAnchor = raw.split('#')[0];
  if (withoutAnchor === '') return null;
  if (withoutAnchor.includes('..')) return null;
  const fileName = withoutAnchor.replace(/^\.\//, '');
  if (fileName.includes('/')) return null;
  const candidate = slugOf(fileName);
  return slugs.includes(candidate) ? candidate : null;
}

/**
 * Reads the category grouping out of the documentation index.
 *
 * `docs/features/README.md` already groups every article under a heading, in a
 * table whose rows link to the file. Deriving the categories from that real file
 * keeps one source of truth: adding an article to the index puts it in the right
 * group in the application too, and a file the index has not listed falls back
 * to a stated default rather than being invented a group of its own.
 */
export function readCategoryIndex(indexBody, slugs) {
  const categories = new Map();
  if (typeof indexBody !== 'string') return categories;
  let current = FALLBACK_CATEGORY;
  let insideFence = false;
  for (const line of indexBody.split(/\r?\n/)) {
    if (line.startsWith('```')) {
      insideFence = !insideFence;
      continue;
    }
    if (insideFence) continue;
    const heading = line.match(HEADING);
    if (heading && heading[1].length >= 2) {
      current = heading[2].trim();
      continue;
    }
    LINK.lastIndex = 0;
    let match = LINK.exec(line);
    while (match) {
      const slug = resolveLinkTarget(match[1], slugs);
      if (slug && !categories.has(slug)) categories.set(slug, current);
      match = LINK.exec(line);
    }
  }
  return categories;
}

/** Words per minute used for the reading-time estimate shown beside an article. */
export const READING_WORDS_PER_MINUTE = 200;

export function readingMinutes(body) {
  const words = body
    .replace(/```[\s\S]*?```/g, ' ')
    .split(/\s+/)
    .filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
  return Math.max(1, Math.round(words / READING_WORDS_PER_MINUTE));
}

/* ------------------------------------------------------------------ */
/* Building the bundle                                                 */
/* ------------------------------------------------------------------ */

export function listSourceFiles(directory = SOURCE_DIRECTORY) {
  if (!existsSync(directory)) {
    throw new Error(
      `The documentation source directory does not exist: ${directory}. ` +
        'Articles live in docs/features/ and are bundled from there.'
    );
  }
  return readdirSync(directory)
    .filter((name) => name.toLowerCase().endsWith('.md'))
    .sort((a, b) => a.localeCompare(b, 'en'));
}

export function buildBundle(directory = SOURCE_DIRECTORY) {
  const files = listSourceFiles(directory);
  if (files.length === 0) {
    throw new Error(
      `No Markdown articles were found in ${directory}. The bundle would be empty, which is ` +
        'never a correct outcome: the documentation browser would ship with nothing to read.'
    );
  }

  const slugs = files.map(slugOf);
  const bodies = new Map();
  for (const file of files) {
    bodies.set(slugOf(file), readFileSync(join(directory, file), 'utf8').replace(/\r\n/g, '\n'));
  }

  const indexSlug = slugs.find((slug) => slug.toLowerCase() === 'readme') ?? null;
  const categoryIndex = readCategoryIndex(indexSlug ? bodies.get(indexSlug) : '', slugs);

  const articles = files.map((file) => {
    const slug = slugOf(file);
    const body = bodies.get(slug) ?? '';
    const metadata = readMetadata(body);
    const links = readLinks(body, slugs, slug);

    const explicitRelated = (metadata.related ?? '')
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => (part.startsWith(ID_PREFIX) ? part : idOf(slugOf(part))))
      .filter((id) => slugs.includes(id.slice(ID_PREFIX.length)));

    const derivedRelated = links.internal.map(idOf);
    const related = [...new Set([...explicitRelated, ...derivedRelated])];

    const category =
      metadata.category ||
      (slug === indexSlug ? INDEX_CATEGORY : categoryIndex.get(slug) ?? FALLBACK_CATEGORY);

    return {
      id: idOf(slug),
      slug,
      title: metadata.title || readTitle(body, slug),
      category,
      body,
      related,
      externalLinks: links.external,
      sourceFile: `docs/features/${file}`,
      headings: readHeadings(body),
      bytes: Buffer.byteLength(body, 'utf8'),
      words: body.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length,
      readingMinutes: readingMinutes(body),
      checksum: checksum32(body),
      sha256: sha256(body)
    };
  });

  const ids = articles.map((article) => article.id).sort((a, b) => a.localeCompare(b, 'en'));
  const digest = sha256(
    articles
      .map((article) => `${article.id}:${article.sha256}`)
      .sort((a, b) => a.localeCompare(b, 'en'))
      .join('\n')
  );

  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    generator: 'app/scripts/bundle-docs.mjs',
    command: 'node scripts/bundle-docs.mjs',
    checkCommand: 'node scripts/check-docs-bundle.mjs',
    sourceDirectory: 'docs/features',
    articles,
    manifest: {
      count: articles.length,
      ids,
      digest,
      totalBytes: articles.reduce((sum, article) => sum + article.bytes, 0)
    }
  };
}

export function renderModule(bundle) {
  return `${[
    '/**',
    ' * GENERATED FILE — do not edit by hand.',
    ' *',
    ` * Written by ${bundle.generator} from the Markdown in ${bundle.sourceDirectory}/.`,
    ` * Regenerate with: ${bundle.command}`,
    ` * Verify with:     ${bundle.checkCommand}`,
    ' *',
    ' * Every article below is compiled into the application, so the documentation',
    ' * browser needs no network connection, no cache and no first-run download.',
    ' * The verifier compares this file against the files actually on disk and fails',
    ' * the build when one of them is missing from it.',
    ' */',
    '',
    "import type { DocsBundle } from './types';",
    '',
    BEGIN_MARKER,
    `${DECLARATION}${JSON.stringify(bundle, null, 2)};`,
    END_MARKER,
    ''
  ].join('\n')}`;
}

function main() {
  const bundle = buildBundle();
  mkdirSync(dirname(OUTPUT_FILE), { recursive: true });
  writeFileSync(OUTPUT_FILE, renderModule(bundle), 'utf8');
  const kilobytes = Math.round(bundle.manifest.totalBytes / 102.4) / 10;
  process.stdout.write(
    `Bundled ${bundle.manifest.count} documentation articles (${kilobytes} kB of Markdown) into ` +
      `src/renderer/features/docs-browser/generated.ts\n`
  );
  for (const article of bundle.articles) {
    process.stdout.write(`  ${article.id.padEnd(34)} ${article.category} — ${article.title}\n`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`bundle-docs: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
