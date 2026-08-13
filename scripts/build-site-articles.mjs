#!/usr/bin/env node
/*
 * build-site-articles.mjs — turn docs/features/*.md into site/assets/articles.js
 *
 * The documentation site ships every feature article inside the page rather than
 * fetching it: the site makes no network request at runtime, so an article that
 * is not in the bundle is an article nobody on the site can read. This script is
 * the only thing that writes site/assets/articles.js. Do not hand-edit that file;
 * run this instead.
 *
 * What it does
 *   1. Reads every markdown file in docs/features, except the ones named in
 *      EXCLUDED below (with the reason stated there, not implied).
 *   2. Pulls out the title, the summary, the headings and the body.
 *   3. Rewrites links so the bundle is self-consistent:
 *        another-article.md  -> #/another-article   (the reader resolves it)
 *        ../images/x.png     -> assets/docs-images/x.png, and copies the file
 *        anything else local -> unlinked, keeping the label text, so no dead
 *                               link ever ships
 *        http(s)             -> left exactly as written
 *   4. Emits site/assets/articles.js as a plain script setting window.WDS_ARTICLES.
 *
 * Fail-closed behaviour. A new article whose slug is missing from CATEGORY_OF is
 * a failure, not a warning. Dropping it into an "Other" bucket would let a
 * feature arrive on the site with nobody having decided where it belongs, and
 * the next person would read the bucket as a decision rather than an oversight.
 *
 * Usage:
 *   node scripts/build-site-articles.mjs           write the bundle and report
 *   node scripts/build-site-articles.mjs --check   report only; write nothing,
 *                                                  and exit non-zero if the file
 *                                                  on disk is stale
 *
 * Exit codes: 0 = the bundle is written (or already current under --check).
 *             1 = something in the source set has to be decided by a person.
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, copyFileSync, statSync } from 'node:fs'
import { join, dirname, resolve, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SRC_DIR = join(ROOT, 'docs', 'features')
const OUT_FILE = join(ROOT, 'site', 'assets', 'articles.js')
const IMG_OUT_DIR = join(ROOT, 'site', 'assets', 'docs-images')
const IMG_OUT_HREF = 'assets/docs-images/'

const checkOnly = process.argv.includes('--check')

/* --------------------------------------------------------------------------
 * Deliberate exclusions. Each one names its reason: a silent skip is
 * indistinguishable from a file that went missing.
 * ----------------------------------------------------------------------- */
const EXCLUDED = {
  'README.md': 'An index of the other files rather than a feature article. The site builds its own index from the bundle, so shipping this one would be a second, immediately stale copy.'
}

/* --------------------------------------------------------------------------
 * The hand-written shape of the reader: which group each article sits in, and
 * the order the groups appear in. Written out rather than derived, so a new
 * article has to be placed by a person who knows where it belongs.
 * ----------------------------------------------------------------------- */
const CATEGORIES = [
  { id: 'downloading', name: 'Downloading worlds', icon: 'download' },
  { id: 'maps', name: 'Maps and rendering', icon: 'globe' },
  { id: 'automation', name: 'Automation and chat', icon: 'play' },
  { id: 'servers', name: 'Servers and consoles', icon: 'grid' },
  { id: 'language', name: 'Language and voice', icon: 'text' },
  { id: 'appearance', name: 'Appearance and identity', icon: 'palette' },
  { id: 'settings', name: 'Settings and scheduling', icon: 'settings' },
  { id: 'records', name: 'Records and portability', icon: 'history' },
  { id: 'locks', name: 'Locks and recovery', icon: 'lock' },
  { id: 'delight', name: 'Delight', icon: 'info' }
]

const CATEGORY_OF = {
  // The file converter sits under portability rather than settings: what it is for is getting a
  // record out of one shape and into another, which is the same job the exporters do next to it.
  'converter': 'records',
  // The bot control surface is the library's whole API rendered as an interface. Its four sibling
  // articles are already under automation, and splitting the entry point away from them would put
  // the one article a reader starts at in a different group from everything it links to.
  'mineflayer': 'automation',
  'downloader': 'downloading',
  'downloader-e2e': 'downloading',
  'world-download': 'downloading',
  'protocol-versions': 'downloading',
  'extended-render-distance': 'downloading',
  'disconnect-diagnostics': 'downloading',
  'auto-open-containers': 'downloading',
  'downloads': 'downloading',

  'live-map': 'maps',
  'map': 'maps',
  'bluemap': 'maps',
  'ported-features': 'maps',
  'worldlens': 'maps',

  'scraper-bot': 'automation',
  'bot': 'automation',
  'chat-auto-reply': 'automation',
  'mineflayer-chat': 'automation',
  'mineflayer-movement': 'automation',
  'mineflayer-inventory': 'automation',
  'mineflayer-world': 'automation',

  'web-console': 'servers',
  'desktop-manager': 'servers',
  'deployment-ci': 'servers',
  'console': 'servers',
  'server': 'servers',
  'models': 'servers',
  'site-models': 'servers',

  'language': 'language',
  'vocabulary': 'language',
  'school-mode': 'language',
  'narrator': 'language',
  'site-narrator': 'language',

  'appearance': 'appearance',
  'app-identity': 'appearance',
  'app-logo': 'appearance',
  'site-logo': 'appearance',
  'accessibility-themes': 'appearance',

  'settings': 'settings',
  'scheduled-settings': 'settings',
  'site-scheduled-settings': 'settings',
  'performance': 'settings',

  'status': 'servers',

  'history': 'records',
  'export': 'records',
  'changelog': 'records',
  'notification-centre': 'records',
  'docs-browser': 'records',
  'site-converter': 'records',

  'locks': 'locks',
  'support-tickets': 'locks',
  'site-support-tickets': 'locks',
  'authenticator': 'locks',
  'external-editor': 'records',
  'updates': 'records',

  'dim-sum': 'delight',

  // The vault is a version-control record of a downloaded world, so it sits
  // with history/export/changelog rather than under downloading or maps.
  'world-vault': 'records',
  // A render is a visualisation of a vault commit's world state, and belongs
  // with the other map surfaces its output is consumed alongside.
  'world-vault-renders': 'maps',
  // Chunk copy/remove is driven from the same occupancy grid and belongs
  // beside the other map-adjacent surfaces, not under downloading or records.
  'world-vault-edit': 'maps'
}

/* The prerequisite and the natural next step, per article. Both are optional
 * per article, but between these and the derived related list every article
 * ends with somewhere to go: a reader is never dropped at a dead end. */
const PREREQ_OF = {
  'world-download': 'downloader',
  'protocol-versions': 'world-download',
  'extended-render-distance': 'world-download',
  'auto-open-containers': 'world-download',
  'disconnect-diagnostics': 'world-download',
  'map': 'live-map',
  'bluemap': 'live-map',
  'ported-features': 'live-map',
  'worldlens': 'live-map',
  'chat-auto-reply': 'scraper-bot',
  'bot': 'scraper-bot',
  'mineflayer-movement': 'mineflayer-chat',
  'mineflayer-inventory': 'mineflayer',
  'mineflayer-world': 'mineflayer-inventory',
  'console': 'web-console',
  'server': 'deployment-ci',
  'scheduled-settings': 'settings',
  'site-scheduled-settings': 'scheduled-settings',
  'vocabulary': 'language',
  'school-mode': 'language',
  'narrator': 'language',
  'app-identity': 'appearance',
  'app-logo': 'appearance',
  'accessibility-themes': 'appearance',
  'support-tickets': 'locks',
  'site-support-tickets': 'support-tickets',
  'changelog': 'history',
  'export': 'history',
  'notification-centre': 'settings',
  'docs-browser': 'settings',
  'deployment-ci': 'web-console',
  'external-editor': 'export',
  'authenticator': 'locks'
}

const NEXT_OF = {
  'downloader': 'world-download',
  'world-download': 'protocol-versions',
  'protocol-versions': 'extended-render-distance',
  'extended-render-distance': 'live-map',
  'disconnect-diagnostics': 'protocol-versions',
  'auto-open-containers': 'scraper-bot',
  'live-map': 'map',
  'map': 'bluemap',
  'bluemap': 'ported-features',
  'ported-features': 'worldlens',
  'worldlens': 'web-console',
  'scraper-bot': 'bot',
  'bot': 'chat-auto-reply',
  'chat-auto-reply': 'mineflayer-chat',
  'mineflayer-chat': 'mineflayer-movement',
  'mineflayer-movement': 'web-console',
  'web-console': 'console',
  'console': 'server',
  'server': 'desktop-manager',
  'desktop-manager': 'settings',
  'deployment-ci': 'changelog',
  'updates': 'changelog',
  'downloads': 'updates',
  'language': 'vocabulary',
  'vocabulary': 'school-mode',
  'school-mode': 'narrator',
  'narrator': 'accessibility-themes',
  'appearance': 'app-identity',
  'app-identity': 'app-logo',
  'app-logo': 'accessibility-themes',
  'accessibility-themes': 'settings',
  'settings': 'scheduled-settings',
  'scheduled-settings': 'site-scheduled-settings',
  'site-scheduled-settings': 'history',
  'history': 'export',
  'export': 'changelog',
  'changelog': 'docs-browser',
  'notification-centre': 'history',
  'docs-browser': 'export',
  'locks': 'authenticator',
  'authenticator': 'support-tickets',
  'support-tickets': 'history',
  'dim-sum': 'language',
  'external-editor': 'history'
}

/* --------------------------------------------------------------------------
 * Reading the source
 * ----------------------------------------------------------------------- */

const problems = []
const warnings = []

function fail(msg) { problems.push(msg) }
function warn(msg) { warnings.push(msg) }

if (!existsSync(SRC_DIR)) {
  console.error(`FATAL: ${SRC_DIR} does not exist. There is nothing to bundle.`)
  process.exit(1)
}

const files = readdirSync(SRC_DIR)
  .filter(f => f.toLowerCase().endsWith('.md'))
  .sort()

const included = files.filter(f => !Object.prototype.hasOwnProperty.call(EXCLUDED, f))

if (!included.length) {
  console.error(`FATAL: no article files found in ${SRC_DIR}.`)
  process.exit(1)
}

/* Git knows when an article was last really changed; a file's modification time
 * is only ever the moment this checkout appeared. Prefer git, say so per
 * article, and fall back honestly rather than inventing a date. */
function lastChanged(relPath) {
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%cs', '--', relPath], {
      cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']
    }).trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(out)) return { date: out, source: 'the commit history' }
  } catch (e) { /* git is not available, or the file is not committed yet */ }
  const st = statSync(join(ROOT, relPath))
  return { date: st.mtime.toISOString().slice(0, 10), source: 'this checkout\'s file dates' }
}

const slugOf = f => f.replace(/\.md$/i, '')
const knownSlugs = new Set(included.map(slugOf))

const copiedImages = new Map()   // source path -> output filename
const droppedLinks = []          // { slug, target, label }

/* Rewrite one link or image target. Returns either a replacement target, or
 * null meaning "unlink this: keep the label, drop the href". */
function rewriteTarget(slug, target, isImage) {
  const clean = target.replace(/^\.\//, '')

  if (/^https?:/i.test(clean) || /^mailto:/i.test(clean)) return clean
  if (clean.startsWith('#')) return clean

  if (isImage) {
    const abs = resolve(SRC_DIR, clean.split('#')[0])
    if (existsSync(abs)) {
      const name = basename(abs)
      copiedImages.set(abs, name)
      return IMG_OUT_HREF + name
    }
    droppedLinks.push({ slug, target, label: '(image)' })
    return null
  }

  const m = clean.match(/^([A-Za-z0-9._-]+)\.md(#.*)?$/)
  if (m) {
    const targetSlug = m[1]
    if (knownSlugs.has(targetSlug)) return '#/' + targetSlug
  }

  droppedLinks.push({ slug, target, label: '' })
  return null
}

/* Walk the markdown line by line so nothing inside a fenced code block is
 * rewritten: a code sample showing a link is a code sample, not a link. */
function rewriteLinks(slug, body) {
  const lines = body.split('\n')
  let inFence = false
  const out = lines.map(line => {
    if (/^\s*```/.test(line)) { inFence = !inFence; return line }
    if (inFence) return line
    return line.replace(/(!?)\[([^\]]*)\]\(([^)\s]+)\)/g, (whole, bang, label, target) => {
      const isImage = bang === '!'
      const next = rewriteTarget(slug, target, isImage)
      if (next === null) return isImage ? (label || 'image') : label
      return `${bang}[${label}](${next})`
    })
  })
  return out.join('\n')
}

function stripInline(s) {
  return String(s)
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .trim()
}

function summaryOf(lines) {
  // Prefer the article's own one-line standfirst: a leading blockquote.
  const quote = []
  let i = 0
  while (i < lines.length && !lines[i].trim()) i++
  while (i < lines.length && /^>\s?/.test(lines[i])) { quote.push(lines[i].replace(/^>\s?/, '')); i++ }
  if (quote.length) return stripInline(quote.join(' ').replace(/\s+/g, ' '))

  // Otherwise the first real paragraph, cut at a sentence boundary.
  let inFence = false
  for (const line of lines) {
    if (/^\s*```/.test(line)) { inFence = !inFence; continue }
    if (inFence) continue
    const s = line.trim()
    if (!s || s.startsWith('#') || s.startsWith('|') || s.startsWith('-') || s.startsWith('*') || s.startsWith('>')) continue
    const flat = stripInline(s)
    if (flat.length <= 240) return flat
    const cut = flat.slice(0, 240)
    const dot = cut.lastIndexOf('. ')
    return (dot > 80 ? cut.slice(0, dot + 1) : cut.replace(/\s+\S*$/, '')) + (dot > 80 ? '' : '…')
  }
  return ''
}

const articles = []

for (const file of included) {
  const slug = slugOf(file)
  const relPath = ['docs', 'features', file].join('/')
  const raw = readFileSync(join(SRC_DIR, file), 'utf8').replace(/\r\n?/g, '\n')
  const lines = raw.split('\n')

  const titleIndex = lines.findIndex(l => /^#\s+\S/.test(l))
  if (titleIndex < 0) {
    fail(`${relPath} has no level-one heading, so the reader has no title to show. Add a "# Title" line at the top.`)
    continue
  }
  const title = stripInline(lines[titleIndex].replace(/^#\s+/, ''))

  const category = CATEGORY_OF[slug]
  if (!category) {
    fail(`${relPath} is not placed in a category. Add "'${slug}': '<category id>'" to CATEGORY_OF in scripts/build-site-articles.mjs. Valid ids: ${CATEGORIES.map(c => c.id).join(', ')}.`)
    continue
  }

  const bodyLines = lines.slice(titleIndex + 1)
  const summary = summaryOf(bodyLines)
  if (!summary) warn(`${relPath} has no standfirst and no opening paragraph, so its card and search result will show no summary.`)

  // Headings, for the contents panel and for search keywords.
  const headings = []
  let inFence = false
  for (const line of bodyLines) {
    if (/^\s*```/.test(line)) { inFence = !inFence; continue }
    if (inFence) continue
    const h = line.match(/^(#{2,4})\s+(.*)$/)
    if (h) headings.push({ level: h[1].length, text: stripInline(h[2]) })
  }

  const body = rewriteLinks(slug, bodyLines.join('\n')).replace(/^\n+/, '').replace(/\s+$/, '')
  const words = body.split(/\s+/).filter(Boolean).length
  const changed = lastChanged(relPath)

  // Outgoing article links, for the related list.
  const outgoing = []
  const linkRe = /\]\(#\/([A-Za-z0-9._-]+)\)/g
  let mm
  while ((mm = linkRe.exec(body))) if (mm[1] !== slug && outgoing.indexOf(mm[1]) < 0) outgoing.push(mm[1])

  articles.push({
    slug,
    file: relPath,
    title,
    summary,
    category,
    updated: changed.date,
    updatedSource: changed.source,
    words,
    readingMinutes: Math.max(1, Math.round(words / 220)),
    headings,
    links: outgoing,
    prereq: PREREQ_OF[slug] || null,
    next: NEXT_OF[slug] || null,
    related: [],
    body
  })
}

/* --------------------------------------------------------------------------
 * Suggested articles. The prerequisite and the next step are hand-written; the
 * rest of the related list is derived from the links the article really makes,
 * topped up with its own category so nothing ends with an empty list.
 * ----------------------------------------------------------------------- */
const bySlug = new Map(articles.map(a => [a.slug, a]))

for (const a of articles) {
  if (a.prereq && !bySlug.has(a.prereq)) { fail(`${a.file}: PREREQ_OF names "${a.prereq}", which is not an article. Fix the map in scripts/build-site-articles.mjs.`); a.prereq = null }
  if (a.next && !bySlug.has(a.next)) { fail(`${a.file}: NEXT_OF names "${a.next}", which is not an article. Fix the map in scripts/build-site-articles.mjs.`); a.next = null }

  const skip = new Set([a.slug, a.prereq, a.next].filter(Boolean))
  const related = []
  for (const s of a.links) if (!skip.has(s) && bySlug.has(s) && related.indexOf(s) < 0) related.push(s)
  for (const b of articles) {
    if (related.length >= 4) break
    if (b.category === a.category && !skip.has(b.slug) && related.indexOf(b.slug) < 0) related.push(b.slug)
  }
  a.related = related.slice(0, 4)
}

for (const c of CATEGORIES) {
  if (!articles.some(a => a.category === c.id)) {
    warn(`Category "${c.name}" (${c.id}) has no articles. It will not appear in the reader.`)
  }
}

if (problems.length) {
  console.error('The article bundle was NOT written. These need a decision:\n')
  for (const p of problems) console.error('  - ' + p)
  process.exit(1)
}

/* --------------------------------------------------------------------------
 * Images. Copied rather than linked: the site loads every asset from its own
 * origin and makes no network request, so an image left in docs/ would simply
 * be missing.
 * ----------------------------------------------------------------------- */
const imageReport = []
if (copiedImages.size && !checkOnly) {
  mkdirSync(IMG_OUT_DIR, { recursive: true })
  for (const [src, name] of copiedImages) {
    copyFileSync(src, join(IMG_OUT_DIR, name))
    imageReport.push(`${name}  (${statSync(src).size} bytes)`)
  }
}

/* --------------------------------------------------------------------------
 * Emit
 * ----------------------------------------------------------------------- */
const order = new Map(CATEGORIES.map((c, i) => [c.id, i]))
articles.sort((a, b) => (order.get(a.category) - order.get(b.category)) || a.title.localeCompare(b.title, 'en'))

const usedCategories = CATEGORIES.filter(c => articles.some(a => a.category === c.id))

const header = `/* GENERATED FILE — do not edit by hand.
 *
 * Written by scripts/build-site-articles.mjs from docs/features/*.md.
 * Run "node scripts/build-site-articles.mjs" after changing an article, and
 * "node scripts/check-site-coverage.mjs" to prove nothing fell out of the site.
 *
 * Every article the documentation reader can show is in this file. The site
 * makes no network request, so an article that is missing here is an article
 * nobody can read — which is what the coverage guard exists to catch.
 *
 * Articles: ${articles.length}. Categories: ${usedCategories.length}.
 * Source: docs/features (excluding ${Object.keys(EXCLUDED).join(', ') || 'nothing'}).
 */
window.WDS_ARTICLES = {
  schemaVersion: 1,
  source: 'docs/features',
  count: ${articles.length},
  categories: ${JSON.stringify(usedCategories, null, 2).split('\n').join('\n  ')},
  articles: [
`
const rows = articles.map(a => '    ' + JSON.stringify(a)).join(',\n')
const out = header + rows + '\n  ]\n};\n'

if (checkOnly) {
  const current = existsSync(OUT_FILE) ? readFileSync(OUT_FILE, 'utf8') : ''
  if (current !== out) {
    console.error('STALE: site/assets/articles.js does not match docs/features. Run: node scripts/build-site-articles.mjs')
    process.exit(1)
  }
  console.log(`site/assets/articles.js is current: ${articles.length} articles.`)
  process.exit(0)
}

mkdirSync(dirname(OUT_FILE), { recursive: true })
writeFileSync(OUT_FILE, out, 'utf8')

/* --------------------------------------------------------------------------
 * Report. Every file, so a missing one is visible in the output rather than
 * only in a count.
 * ----------------------------------------------------------------------- */
console.log(`Read    ${files.length} markdown file(s) in docs/features`)
for (const [name, why] of Object.entries(EXCLUDED)) {
  console.log(`Skipped ${name} — ${why}`)
}
console.log(`Bundled ${articles.length} article(s) into site/assets/articles.js (${(out.length / 1024).toFixed(1)} KiB)\n`)

for (const c of usedCategories) {
  const list = articles.filter(a => a.category === c.id)
  console.log(`  ${c.name} (${list.length})`)
  for (const a of list) {
    console.log(`    ${a.slug.padEnd(26)} ${String(a.words).padStart(5)} words  updated ${a.updated}  ${a.title}`)
  }
}

console.log('')
if (imageReport.length) {
  console.log(`Copied ${imageReport.length} image(s) into site/assets/docs-images/:`)
  for (const line of imageReport) console.log('  ' + line)
} else {
  console.log('No images were referenced by any article.')
}

if (droppedLinks.length) {
  console.log(`\n${droppedLinks.length} link target(s) could not be resolved inside the site and were unlinked (the label text is kept, so no dead link ships):`)
  for (const d of droppedLinks) console.log(`  ${d.slug}: ${d.target}`)
}

if (warnings.length) {
  console.log('\nWarnings:')
  for (const w of warnings) console.log('  - ' + w)
}

const updatedFromGit = articles.filter(a => a.updatedSource === 'the commit history').length
console.log(`\nDates: ${updatedFromGit} from the commit history, ${articles.length - updatedFromGit} from this checkout's file dates.`)
console.log('Done.')
