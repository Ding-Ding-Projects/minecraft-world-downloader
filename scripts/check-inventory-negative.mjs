#!/usr/bin/env node
// Negative regression for the completeness guard.
//
// A guard nobody has watched fail proves nothing. This harness deliberately removes or disables
// ONE asserted item at a time and requires the guard to turn red; restoring it must turn green.
//
// Every mutation runs against a throwaway MIRROR of the inputs the guard reads, never against the
// real tree — a harness that damages the working tree to prove a point is worse than no harness.
//
// The positive control runs first and matters most: if the unmutated mirror is already failing,
// every mutation "turns red" for free and the whole run proves nothing. That case is reported as
// INCONCLUSIVE rather than as a pass.
//
// Usage:
//   node scripts/check-inventory-negative.mjs
//   node scripts/check-inventory-negative.mjs --json

import { readFileSync, writeFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, statSync, copyFileSync, rmSync, renameSync } from 'node:fs'
import { join, dirname, resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const asJson = process.argv.includes('--json')

// Only the paths the guard actually reads. Keeping this narrow keeps each mutation cheap.
const MIRROR_PATHS = [
  'FEATURE_INVENTORY.md',
  'scripts/check-inventory.mjs',
  'scripts/count-lines.mjs',
  'app/src/renderer',
  'docs/features',
  'build.bat',
  'build-installer.bat',
  'build.sh',
  'build-installer.sh',
  '.github/workflows/release.yml',
  'app/tests',
  'site',
]

function copyTree(from, to, filter) {
  const st = statSync(from)
  if (st.isDirectory()) {
    mkdirSync(to, { recursive: true })
    for (const entry of readdirSync(from)) {
      if (entry === 'node_modules' || entry === '.git') continue
      copyTree(join(from, entry), join(to, entry), filter)
    }
    return
  }
  if (filter && !filter(from)) return
  mkdirSync(dirname(to), { recursive: true })
  copyFileSync(from, to)
}

function buildMirror() {
  const dir = mkdtempSync(join(tmpdir(), 'inventory-negative-'))
  for (const p of MIRROR_PATHS) {
    const src = join(ROOT, p)
    if (!existsSync(src)) continue
    copyTree(src, join(dir, p), f => /\.(ts|tsx|css|md|mjs|js|bat|sh|yml|yaml|html|json)$/i.test(f))
  }
  return dir
}

function runGuard(dir) {
  const r = spawnSync(process.execPath, [join(dir, 'scripts', 'check-inventory.mjs'), '--json'], {
    encoding: 'utf8',
    cwd: dir,
  })
  let parsed = null
  try { parsed = JSON.parse(r.stdout) } catch { /* guard crashed or printed non-JSON */ }
  return { code: r.status, stdout: r.stdout, stderr: r.stderr, parsed }
}

// --- helpers the mutations use -------------------------------------------------

function firstFeatureDir(dir) {
  const f = join(dir, 'app/src/renderer/features')
  if (!existsSync(f)) return null
  const dirs = readdirSync(f, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name).sort()
  return dirs[0] || null
}

function firstNamedCoreFile(dir) {
  const inv = readFileSync(join(dir, 'FEATURE_INVENTORY.md'), 'utf8')
  const m = /`(core\/[A-Za-z0-9-]+\.ts)`/.exec(inv)
  if (!m) return null
  const p = join(dir, 'app/src/renderer', m[1])
  return existsSync(p) ? { rel: m[1], abs: p } : null
}

// --- the mutations -------------------------------------------------------------
//
// Each returns a short description of exactly what it removed, or null when the tree does not
// contain the thing it would remove (in which case the case is reported SKIPPED, never PASSED —
// a mutation that could not be applied has demonstrated nothing).

const MUTATIONS = [
  {
    name: 'feature directory deleted entirely',
    why: 'the case a discovery-driven guard cannot see: the feature is simply gone, so there is nothing left to enumerate and validate',
    apply(dir) {
      const id = firstFeatureDir(dir)
      if (!id) return null
      rmSync(join(dir, 'app/src/renderer/features', id), { recursive: true, force: true })
      return `removed app/src/renderer/features/${id}/`
    },
  },
  {
    name: 'documentation article deleted',
    why: 'a feature that ships undocumented still fails the contract',
    apply(dir) {
      const id = firstFeatureDir(dir)
      if (!id) return null
      const article = join(dir, 'docs/features', `${id}.md`)
      if (!existsSync(article)) return null
      rmSync(article)
      return `removed docs/features/${id}.md`
    },
  },
  {
    name: 'named core module deleted',
    why: 'the inventory names an exact path; the guard must notice that path stopped existing',
    apply(dir) {
      const f = firstNamedCoreFile(dir)
      if (!f) return null
      rmSync(f.abs)
      return `removed app/src/renderer/${f.rel}`
    },
  },
  {
    name: 'feature default export removed',
    why: 'the directory still exists and still looks complete, but auto-discovery can no longer register it',
    apply(dir) {
      const id = firstFeatureDir(dir)
      if (!id) return null
      const index = join(dir, 'app/src/renderer/features', id, 'index.ts')
      if (!existsSync(index)) return null
      const src = readFileSync(index, 'utf8')
      if (!/export\s+default\b/.test(src)) return null
      // Exact boundary: neutralise the keyword itself rather than deleting a line that merely
      // mentions it, so a rename elsewhere in the file cannot accidentally satisfy the check.
      writeFileSync(index, src.replace(/export\s+default\b/, 'const __unregistered ='))
      return `neutralised the default export in features/${id}/index.ts`
    },
  },
  {
    name: 'inventory row status mark blanked',
    why: 'a row nobody has judged is a row that proves nothing about the feature it names',
    apply(dir) {
      const p = join(dir, 'FEATURE_INVENTORY.md')
      const src = readFileSync(p, 'utf8')
      const lines = src.split('\n')
      const i = lines.findIndex(l => /^\s*\|\s*\d+\.\d+\s*\|/.test(l) && /[✅🏗️⬜]/u.test(l))
      if (i === -1) return null
      lines[i] = lines[i].replace(/[✅🏗️⬜]/u, ' ')
      writeFileSync(p, lines.join('\n'))
      return `blanked the status mark on inventory row ${/^\s*\|\s*(\d+\.\d+)/.exec(lines[i])?.[1]}`
    },
  },
  {
    name: 'unlisted feature directory added',
    why: 'a feature nobody put in the contract is a feature nobody agreed to document, localize or test',
    apply(dir) {
      const target = join(dir, 'app/src/renderer/features/__unlisted_probe')
      if (!existsSync(join(dir, 'app/src/renderer/features'))) return null
      mkdirSync(target, { recursive: true })
      writeFileSync(join(target, 'index.ts'), 'export default { id: "unlisted", name: "Unlisted", description: "" }\n')
      return 'added app/src/renderer/features/__unlisted_probe/'
    },
  },
  {
    name: 'documentation site removed',
    why: 'many rows are marked as carried by the site; removing it must not pass quietly',
    apply(dir) {
      const site = join(dir, 'site')
      if (!existsSync(site)) return null
      renameSync(site, join(dir, 'site__moved'))
      return 'removed site/'
    },
  },
  {
    name: 'installer build script deleted',
    why: 'the root build scripts are a named contract row, not a convenience',
    apply(dir) {
      const p = join(dir, 'build-installer.bat')
      if (!existsSync(p)) return null
      rmSync(p)
      return 'removed build-installer.bat'
    },
  },
]

// --- run -----------------------------------------------------------------------

const results = []
let baseline = null

const baseDir = buildMirror()
try {
  baseline = runGuard(baseDir)
} finally {
  rmSync(baseDir, { recursive: true, force: true })
}

const baselineGreen = baseline.code === 0

for (const mutation of MUTATIONS) {
  const dir = buildMirror()
  let applied = null
  let after = null
  try {
    applied = mutation.apply(dir)
    if (applied !== null) after = runGuard(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }

  if (applied === null) {
    results.push({ name: mutation.name, verdict: 'SKIPPED', reason: 'the tree does not yet contain the item this mutation removes', why: mutation.why })
    continue
  }

  const turnedRed = after.code !== 0
  results.push({
    name: mutation.name,
    verdict: turnedRed ? 'CAUGHT' : 'MISSED',
    applied,
    why: mutation.why,
    guardExit: after.code,
    newFailures: after.parsed?.failures?.length ?? null,
  })
}

const caught = results.filter(r => r.verdict === 'CAUGHT').length
const missed = results.filter(r => r.verdict === 'MISSED')
const skipped = results.filter(r => r.verdict === 'SKIPPED')

let verdict
if (!baselineGreen) verdict = 'INCONCLUSIVE'
else if (missed.length > 0) verdict = 'FAIL'
else if (caught === 0) verdict = 'INCONCLUSIVE'
else verdict = 'PASS'

const report = {
  verdict,
  baseline: { exit: baseline.code, green: baselineGreen, failures: baseline.parsed?.failures?.length ?? null },
  caught,
  missed: missed.map(m => ({ name: m.name, applied: m.applied })),
  skipped: skipped.map(s => s.name),
  results,
}

if (asJson) {
  console.log(JSON.stringify(report, null, 2))
} else {
  console.log('Negative regression for the completeness guard\n')
  if (!baselineGreen) {
    console.log(`INCONCLUSIVE — the unmutated mirror already fails the guard (exit ${baseline.code},`)
    console.log(`${baseline.parsed?.failures?.length ?? '?'} failures). Every mutation below "turns red" for free,`)
    console.log('so this run demonstrates nothing about the guard. Make the baseline green first.\n')
  }
  for (const r of results) {
    const mark = r.verdict === 'CAUGHT' ? 'CAUGHT ' : r.verdict === 'MISSED' ? 'MISSED ' : 'SKIPPED'
    console.log(`  [${mark}] ${r.name}`)
    if (r.applied) console.log(`            ${r.applied}`)
    if (r.verdict === 'MISSED') console.log(`            the guard stayed green. ${r.why}`)
    if (r.verdict === 'SKIPPED') console.log(`            ${r.reason}`)
  }
  console.log(`\n${verdict} — ${caught} caught, ${missed.length} missed, ${skipped.length} skipped.`)
  if (verdict === 'FAIL') {
    console.log('A guard that stays green while an asserted item is gone is not a guard.')
  }
}

process.exit(verdict === 'PASS' ? 0 : 1)
