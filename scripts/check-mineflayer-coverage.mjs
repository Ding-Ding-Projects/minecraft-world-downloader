#!/usr/bin/env node
// Coverage guard for the vendored mineflayer plugin list (FEATURE_INVENTORY.md section 15).
//
// This is the REVERSE direction from scripts/check-inventory.mjs. That guard starts from the
// hand-written inventory and checks that every row resolves to something real on disk; this one
// starts from what genuinely exists on disk — every plugin file under
// vendor/mineflayer/lib/plugins — and checks that the hand-written inventory names every one of
// them. Both directions are needed for the same reason and neither substitutes for the other: a
// guard that only validates rows already written passes cleanly on a project that lost a plugin's
// row entirely, because it never looked for the missing one. Driving from the directory listing is
// what makes a plugin the upstream library adds — and this project has not yet given a home —
// detectable instead of silently unaudited.
//
// Usage:
//   node scripts/check-mineflayer-coverage.mjs            # report and exit non-zero on any gap
//   node scripts/check-mineflayer-coverage.mjs --json     # machine-readable report
//   node scripts/check-mineflayer-coverage.mjs --list     # list every plugin and which row(s) cover it
//
// Exit codes: 0 = every plugin covered. 1 = at least one plugin has no covering row. 2 = the
// plugin directory or the inventory itself could not be read, which is a failure too — a guard
// that cannot see its own inputs enforces nothing.

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PLUGINS_DIR = join(ROOT, 'vendor', 'mineflayer', 'lib', 'plugins')
const INVENTORY = join(ROOT, 'FEATURE_INVENTORY.md')
const SECTION_NUMBER = '15'

const args = new Set(process.argv.slice(2))
const asJson = args.has('--json')
const listOnly = args.has('--list')

function die(code, message) {
  if (asJson) console.log(JSON.stringify({ ok: false, fatal: message }, null, 2))
  else console.error(`FATAL: ${message}`)
  process.exit(code)
}

if (!existsSync(PLUGINS_DIR)) {
  die(2, `The vendored plugin directory does not exist at ${PLUGINS_DIR}. There is nothing to check coverage against.`)
}
if (!existsSync(INVENTORY)) {
  die(2, `FEATURE_INVENTORY.md not found at ${INVENTORY}. The contract cannot enforce itself if it does not exist.`)
}

// ---------------------------------------------------------------------------
// What genuinely exists: every real plugin file, by its bare module name.
// ---------------------------------------------------------------------------

const pluginEntries = readdirSync(PLUGINS_DIR, { withFileTypes: true })
const pluginFiles = pluginEntries.filter(e => e.isFile() && e.name.endsWith('.js')).map(e => e.name)
const unexpectedEntries = pluginEntries.filter(e => !(e.isFile() && e.name.endsWith('.js'))).map(e => e.name)

if (pluginFiles.length === 0) {
  die(2, `Read zero .js files out of ${PLUGINS_DIR}. A guard that finds nothing to check is not a passing guard.`)
}

const plugins = pluginFiles.map(f => f.replace(/\.js$/, '')).sort()

// ---------------------------------------------------------------------------
// Parse FEATURE_INVENTORY.md section 15's rows (same row shape as check-inventory.mjs).
// ---------------------------------------------------------------------------

function splitRow(line) {
  const body = line.trim().replace(/^\|/, '').replace(/\|$/, '')
  return body.split(/(?<!\\)\|/).map(c => c.replace(/\\\|/g, '|').trim())
}

const raw = readFileSync(INVENTORY, 'utf8')
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
  if (cells.every(c => /^:?-{3,}:?$/.test(c))) { inTable = headerCells !== null; continue }
  if (!inTable && headerCells === null) { headerCells = cells; continue }
  if (!inTable) continue
  if (!section || section.number !== SECTION_NUMBER) continue

  const id = cells[0]
  if (!/^\d+\.\d+[a-z]?$/.test(id)) continue

  rows.push({
    id,
    feature: cells[1] || '',
    appModule: cells[2] || '',
    notes: cells[5] || '',
    line,
  })
}

if (rows.length === 0) {
  die(2, `Parsed zero rows out of section ${SECTION_NUMBER} of FEATURE_INVENTORY.md. Nothing to check coverage against.`)
}

// ---------------------------------------------------------------------------
// A plugin is "named" by a row when its exact bare module name appears inside
// a backtick span anywhere in that row (app-module column or notes column —
// most rows name their plugins in notes as "Covers `x`, `y`.", but the check
// does not assume that convention specifically, only that the name is quoted
// as code somewhere on the row, so a plugin named a different way still counts).
// ---------------------------------------------------------------------------

function codeSpans(text) {
  const out = []
  const re = /`([^`]+)`/g
  let m
  while ((m = re.exec(text)) !== null) out.push(m[1].trim())
  return out
}

const coverage = new Map(plugins.map(p => [p, []]))

for (const row of rows) {
  const spans = new Set([...codeSpans(row.appModule), ...codeSpans(row.notes)])
  for (const plugin of plugins) {
    if (spans.has(plugin)) coverage.get(plugin).push(row.id)
  }
}

const failures = []
for (const plugin of plugins) {
  if (coverage.get(plugin).length === 0) {
    failures.push({
      kind: 'uncovered-plugin',
      detail: `vendor/mineflayer/lib/plugins/${plugin}.js exists but no row in FEATURE_INVENTORY.md section ${SECTION_NUMBER} names \`${plugin}\``,
    })
  }
}

if (unexpectedEntries.length > 0) {
  failures.push({
    kind: 'unexpected-plugin-entry',
    detail: `vendor/mineflayer/lib/plugins contains non-.js entries this guard does not know how to classify: ${unexpectedEntries.join(', ')}`,
  })
}

// ---------------------------------------------------------------------------
// Report.
// ---------------------------------------------------------------------------

if (listOnly) {
  for (const plugin of plugins) {
    const rowIds = coverage.get(plugin)
    console.log(`${plugin.padEnd(20)} ${rowIds.length > 0 ? 'covered by ' + rowIds.join(', ') : 'MISSING — no covering row'}`)
  }
  process.exit(0)
}

const summary = {
  ok: failures.length === 0,
  pluginsFound: plugins.length,
  rowsParsed: rows.length,
  failures,
}

if (asJson) {
  console.log(JSON.stringify(summary, null, 2))
} else {
  console.log(
    `Mineflayer coverage guard: ${plugins.length} plugins in vendor/mineflayer/lib/plugins, ${rows.length} rows in FEATURE_INVENTORY.md section ${SECTION_NUMBER}.`
  )
  if (failures.length === 0) {
    console.log('PASS — every vendored plugin is named by a row in FEATURE_INVENTORY.md section 15.')
  } else {
    console.log(`FAIL — ${failures.length} gap(s):\n`)
    for (const f of failures) console.log(`  - ${f.detail}`)
  }
}

process.exit(failures.length === 0 ? 0 : 1)
