#!/usr/bin/env node
// Completeness guard for FEATURE_INVENTORY.md.
//
// This guard is driven by the hand-written inventory, NOT by what happens to exist on disk.
// That direction is the whole point: a check that enumerates the modules it finds and then
// validates them passes cleanly on a project that has lost a feature entirely, because it never
// looked for the missing one. Reading the hand-written list first is what makes a disappeared
// feature detectable.
//
// Usage:
//   node scripts/check-inventory.mjs            # report and exit non-zero on any failure
//   node scripts/check-inventory.mjs --json     # machine-readable report
//   node scripts/check-inventory.mjs --list     # list the parsed rows and what each resolves to
//
// Exit codes: 0 = every row satisfied. 1 = at least one row unsatisfied. 2 = the inventory itself
// could not be parsed (which is a failure too — an unreadable contract enforces nothing).

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const INVENTORY = join(ROOT, 'FEATURE_INVENTORY.md')

const RENDERER = join(ROOT, 'app', 'src', 'renderer')
const FEATURES_DIR = join(RENDERER, 'features')
const DOCS_DIR = join(ROOT, 'docs', 'features')
const SITE_DIR = join(ROOT, 'site')

const args = new Set(process.argv.slice(2))
const asJson = args.has('--json')
const listOnly = args.has('--list')

// Column values that name no concrete artifact. They still have to APPEAR in the inventory —
// the row's presence is itself part of the contract — but there is no path to resolve.
const ABSTRACT = new Set(['n/a', 'project-wide', 'documented', 'yes', 'no'])

function die(code, message) {
  if (asJson) console.log(JSON.stringify({ ok: false, fatal: message }, null, 2))
  else console.error(`FATAL: ${message}`)
  process.exit(code)
}

if (!existsSync(INVENTORY)) {
  die(2, `FEATURE_INVENTORY.md not found at ${INVENTORY}. The contract cannot enforce itself if it does not exist.`)
}

const raw = readFileSync(INVENTORY, 'utf8')

// ---------------------------------------------------------------------------
// Parse the inventory tables.
//
// A row looks like:
//   | 1.1 | Feature sentence. | `core/i18n.ts` | yes | ⬜ | Notes. |
// Section headings look like:
//   ## 3. Navigation and discovery
// ---------------------------------------------------------------------------

function splitRow(line) {
  // Trim the leading and trailing pipe, then split. Cells may contain escaped pipes as \| —
  // split on a pipe not preceded by a backslash so a note containing a pipe cannot shear the row.
  const body = line.trim().replace(/^\|/, '').replace(/\|$/, '')
  return body.split(/(?<!\\)\|/).map(c => c.replace(/\\\|/g, '|').trim())
}

const rows = []
let section = null
let inTable = false
let headerCells = null

for (const line of raw.split(/\r\n|\n|\r/)) {
  const heading = /^##\s+(\d+)\.\s+(.*)$/.exec(line)
  if (heading) {
    section = { number: heading[1], title: heading[2].trim() }
    inTable = false
    headerCells = null
    continue
  }

  const looksLikeRow = /^\s*\|/.test(line)
  if (!looksLikeRow) { inTable = false; headerCells = null; continue }

  const cells = splitRow(line)

  // A separator row: | --- | --- | ...
  if (cells.every(c => /^:?-{3,}:?$/.test(c))) { inTable = headerCells !== null; continue }

  if (!inTable && headerCells === null) { headerCells = cells; continue }
  if (!inTable) continue
  if (!section) continue

  // Only the feature tables carry a dotted id in the first column.
  const id = cells[0]
  if (!/^\d+\.\d+$/.test(id)) continue

  rows.push({
    id,
    section: `${section.number}. ${section.title}`,
    feature: cells[1] || '',
    appModule: cells[2] || '',
    site: (cells[3] || '').toLowerCase(),
    status: cells[4] || '',
    notes: cells[5] || '',
    line,
  })
}

if (rows.length === 0) {
  die(2, 'Parsed zero rows out of FEATURE_INVENTORY.md. A guard that finds nothing to check is not a passing guard.')
}

// ---------------------------------------------------------------------------
// Resolve each row's app module column to concrete paths.
// ---------------------------------------------------------------------------

function codeSpans(cell) {
  const out = []
  const re = /`([^`]+)`/g
  let m
  while ((m = re.exec(cell)) !== null) out.push(m[1].trim())
  return out
}

function resolveModule(spec) {
  // Returns { spec, kind, path } — kind is 'file' | 'dir' | 'either'.
  if (spec.startsWith('core/') || spec.startsWith('styles/') || spec.startsWith('features/')) {
    return { spec, kind: spec.endsWith('/') ? 'dir' : 'either', path: join(RENDERER, spec) }
  }
  // Anything else is repository-relative: .github/..., scripts/..., app/...
  return { spec, kind: 'either', path: join(ROOT, spec) }
}

function pathSatisfied(target) {
  if (existsSync(target.path)) {
    const st = statSync(target.path)
    if (target.kind === 'dir') return st.isDirectory()
    return true
  }
  // `core/i18n.ts` may legitimately have been authored as `core/i18n/index.ts`.
  const asIndex = target.path.replace(/\.ts$/, '/index.ts')
  if (asIndex !== target.path && existsSync(asIndex)) return true
  // `features/foo` is satisfied by `features/foo/index.ts`.
  if (existsSync(join(target.path, 'index.ts'))) return true
  return false
}

// ---------------------------------------------------------------------------
// Build the failure list. Every distinct obligation is its own entry so a fix
// can be verified one at a time.
// ---------------------------------------------------------------------------

const failures = []
const checked = []

const featureIds = new Set()

for (const row of rows) {
  const specs = codeSpans(row.appModule)
  const bare = row.appModule.replace(/`/g, '').trim().toLowerCase()

  const record = { id: row.id, section: row.section, feature: row.feature.slice(0, 90), targets: [], site: row.site }

  if (specs.length === 0) {
    if (bare === 'repo root') {
      for (const f of ['build.bat', 'build-installer.bat', 'build.sh', 'build-installer.sh']) {
        const p = join(ROOT, f)
        record.targets.push({ spec: f, ok: existsSync(p) })
        if (!existsSync(p)) failures.push({ row: row.id, kind: 'missing-file', detail: `row ${row.id} names the repository root build scripts; ${f} does not exist` })
      }
    } else if (!ABSTRACT.has(bare) && bare.length > 0) {
      failures.push({ row: row.id, kind: 'unparsed-module', detail: `row ${row.id} app-module column "${row.appModule}" names neither a code path nor a recognised abstract value` })
    }
  }

  for (const spec of specs) {
    const target = resolveModule(spec)
    const ok = pathSatisfied(target)
    record.targets.push({ spec, ok })
    if (!ok) {
      failures.push({ row: row.id, kind: 'missing-module', detail: `row ${row.id} ("${row.feature.slice(0, 60)}") names ${spec}, which does not exist` })
    }
    const feat = /^features\/([A-Za-z0-9-]+)/.exec(spec)
    if (feat) featureIds.add(feat[1])
  }

  // Every row must carry a status mark. An empty status cell is a row nobody has judged.
  if (!/[✅🏗️⬜]/u.test(row.status)) {
    failures.push({ row: row.id, kind: 'no-status', detail: `row ${row.id} has no status mark` })
  }

  checked.push(record)
}

// Every feature directory named by the inventory must carry its documentation article.
for (const id of [...featureIds].sort()) {
  const article = join(DOCS_DIR, `${id}.md`)
  if (!existsSync(article)) {
    failures.push({ row: `features/${id}`, kind: 'missing-article', detail: `feature "${id}" is named in the inventory but docs/features/${id}.md does not exist` })
  }
}

// The reverse direction: a feature directory that exists but no inventory row names it is a
// feature nobody has taken responsibility for documenting as a contract.
if (existsSync(FEATURES_DIR)) {
  for (const entry of readdirSync(FEATURES_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    if (!featureIds.has(entry.name)) {
      failures.push({ row: `features/${entry.name}`, kind: 'unlisted-feature', detail: `app/src/renderer/features/${entry.name}/ exists but no inventory row names it` })
    }
  }
}

// Every feature directory must actually export a module the registry can consume.
for (const id of [...featureIds].sort()) {
  const index = join(FEATURES_DIR, id, 'index.ts')
  if (!existsSync(index)) continue
  const src = readFileSync(index, 'utf8')
  if (!/export\s+default\b/.test(src)) {
    failures.push({ row: `features/${id}`, kind: 'no-default-export', detail: `features/${id}/index.ts has no default export, so auto-discovery cannot register it` })
  }
}

// Rows marked as carried by the site must have a site that exists to carry them.
const siteRows = rows.filter(r => r.site === 'yes')
if (siteRows.length > 0 && !existsSync(SITE_DIR)) {
  failures.push({ row: 'site', kind: 'missing-site', detail: `${siteRows.length} inventory rows are marked as carried by the documentation site, but site/ does not exist` })
}

// ---------------------------------------------------------------------------
// Report.
// ---------------------------------------------------------------------------

if (listOnly) {
  for (const r of checked) {
    const marks = r.targets.map(t => `${t.ok ? 'ok  ' : 'MISS'} ${t.spec}`).join('\n        ')
    console.log(`${r.id.padEnd(6)} ${r.feature}\n        ${marks || '(no concrete path)'}`)
  }
  process.exit(0)
}

const summary = {
  ok: failures.length === 0,
  rowsParsed: rows.length,
  sections: [...new Set(rows.map(r => r.section))].length,
  featureDirectoriesNamed: featureIds.size,
  failures,
}

if (asJson) {
  console.log(JSON.stringify(summary, null, 2))
} else {
  console.log(`Inventory guard: ${rows.length} rows across ${summary.sections} sections, ${featureIds.size} feature directories named.`)
  if (failures.length === 0) {
    console.log('PASS — every row in FEATURE_INVENTORY.md resolves to something that exists.')
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
