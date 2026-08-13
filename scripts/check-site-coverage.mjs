#!/usr/bin/env node
/*
 * check-site-coverage.mjs — the documentation site's own completeness guard.
 *
 * Two independent obligations, both driven from a hand-written source rather than from what the
 * bundle already contains. A guard that only validates the articles it has already found cannot
 * detect one that disappeared entirely — that direction is the whole point, so both checks below
 * start from something written by a person (the docs/features directory listing, and
 * FEATURE_INVENTORY.md) and ask whether the generated/rendered side still agrees with it.
 *
 *   1. Every markdown file in docs/features/ (except README.md, which is an index, not an
 *      article) must be bundled into site/assets/articles.js. An article that exists on disk but
 *      is missing from the bundle is an article nobody visiting the site can ever read, because
 *      the site makes no network request at runtime.
 *
 *   2. Every row in FEATURE_INVENTORY.md marked "Site: yes" must be carried by the site somehow:
 *      either its own bundled article, or a landing-page card naming that exact row id. A row can
 *      satisfy this through either route — the inventory does not mandate a full article for
 *      every single row, only that the obligation is visibly discharged somewhere a visitor can
 *      see it. A row satisfying neither is a promise made in the inventory and kept nowhere.
 *
 * Usage:
 *   node scripts/check-site-coverage.mjs            report and exit non-zero on any failure
 *   node scripts/check-site-coverage.mjs --json      machine-readable report
 *
 * Exit codes: 0 = both obligations satisfied. 1 = at least one is not. 2 = a required input
 * (the inventory, the docs directory, or the bundle) could not even be read.
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const INVENTORY = join(ROOT, 'FEATURE_INVENTORY.md')
const DOCS_DIR = join(ROOT, 'docs', 'features')
const SITE_DIR = join(ROOT, 'site')
const ARTICLES_FILE = join(SITE_DIR, 'assets', 'articles.js')

const args = new Set(process.argv.slice(2))
const asJson = args.has('--json')

function die(code, message) {
  if (asJson) console.log(JSON.stringify({ ok: false, fatal: message }, null, 2))
  else console.error(`FATAL: ${message}`)
  process.exit(code)
}

if (!existsSync(DOCS_DIR)) die(2, `${DOCS_DIR} does not exist. There is nothing to check articles against.`)
if (!existsSync(INVENTORY)) die(2, `FEATURE_INVENTORY.md not found at ${INVENTORY}. The contract cannot enforce itself if it does not exist.`)
if (!existsSync(ARTICLES_FILE)) die(2, `${ARTICLES_FILE} does not exist. Run "node scripts/build-site-articles.mjs" first.`)
if (!existsSync(SITE_DIR)) die(2, `${SITE_DIR} does not exist.`)

const failures = []

/* ---------------------------------------------------------------------------
 * Obligation 1: every docs/features/*.md file (except README.md) is bundled.
 * ------------------------------------------------------------------------ */

const EXCLUDED_DOCS = new Set(['README.md'])

const docFiles = readdirSync(DOCS_DIR)
  .filter(f => f.toLowerCase().endsWith('.md'))
  .filter(f => !EXCLUDED_DOCS.has(f))
  .sort()

if (docFiles.length === 0) die(2, `No article files found in ${DOCS_DIR}. A guard checking zero articles is not a passing guard.`)

const docSlugs = docFiles.map(f => f.replace(/\.md$/i, ''))

const articlesSrc = readFileSync(ARTICLES_FILE, 'utf8')
const bundledSlugs = new Set()
{
  const re = /"slug"\s*:\s*"([^"]+)"/g
  let m
  while ((m = re.exec(articlesSrc))) bundledSlugs.add(m[1])
}

if (bundledSlugs.size === 0) {
  failures.push({
    kind: 'empty-bundle',
    detail: `${ARTICLES_FILE} contains no "slug" entries at all — either it was never generated, or it was hand-edited into an unreadable shape. Run "node scripts/build-site-articles.mjs".`
  })
}

for (const slug of docSlugs) {
  if (!bundledSlugs.has(slug)) {
    failures.push({
      kind: 'unbundled-article',
      detail: `docs/features/${slug}.md exists on disk but "${slug}" is not bundled into site/assets/articles.js. Run "node scripts/build-site-articles.mjs" and commit the result.`
    })
  }
}

/* ---------------------------------------------------------------------------
 * Obligation 2: every "Site: yes" inventory row is carried by an article or a
 * landing-page card.
 * ------------------------------------------------------------------------ */

function splitRow(line) {
  const body = line.trim().replace(/^\|/, '').replace(/\|$/, '')
  return body.split(/(?<!\\)\|/).map(c => c.replace(/\\\|/g, '|').trim())
}

const invRaw = readFileSync(INVENTORY, 'utf8')
const invRows = []
{
  let section = null
  let inTable = false
  let headerCells = null
  for (const line of invRaw.split(/\r\n|\n|\r/)) {
    const heading = /^##\s+(\d+)\.\s+(.*)$/.exec(line)
    if (heading) { section = { number: heading[1], title: heading[2].trim() }; inTable = false; headerCells = null; continue }

    const looksLikeRow = /^\s*\|/.test(line)
    if (!looksLikeRow) { inTable = false; headerCells = null; continue }

    const cells = splitRow(line)
    if (cells.every(c => /^:?-{3,}:?$/.test(c))) { inTable = headerCells !== null; continue }
    if (!inTable && headerCells === null) { headerCells = cells; continue }
    if (!inTable) continue
    if (!section) continue

    const id = cells[0]
    // Trailing letter (e.g. "13.2a") is deliberate: a row inserted between two shipped rows keeps
    // its neighbours' ids stable rather than renumbering everything after it. Requiring the plain
    // \d+\.\d+ shape here would silently skip every such row.
    if (!/^\d+\.\d+[a-z]?$/.test(id)) continue

    invRows.push({
      id,
      section: `${section.number}. ${section.title}`,
      feature: cells[1] || '',
      appModule: cells[2] || '',
      site: (cells[3] || '').toLowerCase(),
      status: cells[4] || '',
      line,
    })
  }
}

if (invRows.length === 0) die(2, 'Parsed zero rows out of FEATURE_INVENTORY.md. A guard that finds nothing to check is not a passing guard.')

const siteYesRows = invRows.filter(r => r.site === 'yes')
if (siteYesRows.length === 0) {
  failures.push({
    kind: 'no-site-yes-rows',
    detail: 'FEATURE_INVENTORY.md has zero rows marked "Site: yes". Either the inventory column was renamed out from under this guard, or the site has lost every one of its obligations — both are failures worth a human look.'
  })
}

// Every code span (`features/xxx`, `core/xxx.ts`, ...) named in a row's App-module column.
function codeSpans(cell) {
  const out = []
  const re = /`([^`]+)`/g
  let m
  while ((m = re.exec(cell)) !== null) out.push(m[1].trim())
  return out
}

// The slug an article bundle would use for a `features/xxx` module reference.
function featureSlugOf(spec) {
  const m = /^features\/([A-Za-z0-9-]+)/.exec(spec)
  return m ? m[1] : null
}

// Landing-page (and any other site page's) card ids: every occurrence of a bracketed, single- or
// double-quoted dotted id as the first element of an array literal — the shape every card table in
// this site's pages uses, e.g. ['13.2a', 'Worldlens pairing', ...]. Scanned across every .html file
// under site/ so a card is found no matter which page it lives on.
const cardIds = new Set()
{
  const htmlFiles = readdirSync(SITE_DIR, { withFileTypes: true })
    .filter(e => e.isFile() && e.name.toLowerCase().endsWith('.html'))
    .map(e => e.name)
  const re = /\[\s*['"]([0-9]+\.[0-9]+[a-z]?)['"]/g
  for (const name of htmlFiles) {
    const src = readFileSync(join(SITE_DIR, name), 'utf8')
    let m
    while ((m = re.exec(src))) cardIds.add(m[1])
  }
}

for (const row of siteYesRows) {
  const specs = codeSpans(row.appModule)
  const featureSlugs = specs.map(featureSlugOf).filter(Boolean)

  const hasArticle = featureSlugs.some(slug => bundledSlugs.has(slug))
  const hasCard = cardIds.has(row.id)

  if (!hasArticle && !hasCard) {
    failures.push({
      kind: 'uncovered-site-row',
      detail: `row ${row.id} ("${row.feature.slice(0, 70)}") is marked "Site: yes" but has neither a bundled article (checked: ${featureSlugs.length ? featureSlugs.join(', ') : '(no features/ module named)'}) nor a landing-page card with id "${row.id}".`
    })
  }
}

/* ---------------------------------------------------------------------------
 * Report.
 * ------------------------------------------------------------------------ */

const summary = {
  ok: failures.length === 0,
  docArticles: docSlugs.length,
  bundledArticles: bundledSlugs.size,
  inventoryRows: invRows.length,
  siteYesRows: siteYesRows.length,
  cardIdsFound: cardIds.size,
  failures,
}

if (asJson) {
  console.log(JSON.stringify(summary, null, 2))
} else {
  console.log(`Site coverage guard:`)
  console.log(`  docs/features/*.md articles on disk : ${docSlugs.length}`)
  console.log(`  bundled into site/assets/articles.js : ${bundledSlugs.size}`)
  console.log(`  FEATURE_INVENTORY.md rows parsed     : ${invRows.length}`)
  console.log(`  rows marked "Site: yes"              : ${siteYesRows.length}`)
  console.log(`  distinct card ids found on the site   : ${cardIds.size}`)
  console.log('')
  if (failures.length === 0) {
    console.log('PASS — every docs/features article is bundled, and every "Site: yes" inventory row is carried by an article or a landing-page card.')
  } else {
    console.log(`FAIL — ${failures.length} unsatisfied obligation(s):\n`)
    const byKind = new Map()
    for (const f of failures) {
      if (!byKind.has(f.kind)) byKind.set(f.kind, [])
      byKind.get(f.kind).push(f)
    }
    for (const [kind, list] of byKind) {
      console.log(`  ${kind} (${list.length}):`)
      for (const f of list) console.log(`    - ${f.detail}`)
      console.log('')
    }
  }
}

process.exit(failures.length === 0 ? 0 : 1)
