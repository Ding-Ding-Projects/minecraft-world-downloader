#!/usr/bin/env node
// Static coverage guard for the settings explanation + provenance contract (FEATURE_INVENTORY.md row 10.5).
//
// core/settings-ui.ts holds the hand-written manifest (CORE_REQUIRED_SETTING_IDS) and the coverage
// function this script mirrors. That module runs the same check live, at boot, against the real
// registered SettingsSection objects; this script runs the equivalent check statically, from the
// command line, against the real source of core/coreFeature.ts, so the guard is verifiable without
// building or launching the Electron app.
//
// A rule that only checks "every explanation present is well-formed" passes cleanly on a setting
// that has NO explanation at all, because it never looked for the missing one. This script looks:
// every id below is required to resolve to a real control with a non-empty description that is not
// merely a restatement of its label, and a declared defaultValue.
//
// Usage:
//   node scripts/check-settings-coverage.mjs            # report and exit non-zero on any gap
//   node scripts/check-settings-coverage.mjs --json     # machine-readable report
//
// Exit codes: 0 = every required id covered. 1 = at least one gap. 2 = the source could not be read
// or parsed, which is a failure too -- a guard that cannot see its own input enforces nothing.

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CORE_FEATURE = join(ROOT, 'app', 'src', 'renderer', 'core', 'coreFeature.ts')
const I18N = join(ROOT, 'app', 'src', 'renderer', 'core', 'i18n.ts')
const THEME = join(ROOT, 'app', 'src', 'renderer', 'core', 'theme.ts')

const args = new Set(process.argv.slice(2))
const asJson = args.has('--json')

function die(code, message) {
  if (asJson) console.log(JSON.stringify({ ok: false, fatal: message }, null, 2))
  else console.error(`FATAL: ${message}`)
  process.exit(code)
}

// This list MUST be kept in sync, by hand, with CORE_REQUIRED_SETTING_IDS in
// app/src/renderer/core/settings-ui.ts. Both are hand-written deliberately: a list generated FROM
// the source could never notice a setting disappearing from that same source.
const CORE_REQUIRED_SETTING_IDS = [
  'language.mode',
  'language.funny.en',
  'language.funny.yue',
  'language.emojiInDialogs',
  'vocabulary.file',
  'school.enabled',
  'school.name',
  'school.unlock.set',
  'appearance.themeMode',
  'appearance.seed',
  'appearance.contrast',
  'appearance.density',
  'appearance.fontFamily',
  'appearance.fontScale',
  'appearance.fontWeight',
  'app.displayName',
  'appearance.resetAll',
  'tabs.dock',
  'palette.size',
  'data.reveal',
  'data.exportSettings',
  'data.resetSettings'
]

for (const p of [CORE_FEATURE, I18N, THEME]) {
  if (!existsSync(p)) die(2, `${p} does not exist. The guard cannot check source it cannot read.`)
}

// ---------------------------------------------------------------------------
// A brace-depth scanner that respects string, template and comment
// boundaries. A lazy regex spanning "{...}" would misread the first `}`
// inside a nested `options: [...]` array or a `run(ctx) { ... }` function as
// the end of the control object; this walks the text instead of guessing.
// ---------------------------------------------------------------------------

function skipStringsAndComments(text, i, onChar) {
  let inString = null
  for (; i < text.length; i++) {
    const c = text[i]
    const prev = text[i - 1]
    if (inString) {
      if (c === inString && prev !== '\\') inString = null
      continue
    }
    if (c === "'" || c === '"' || c === '`') {
      inString = c
      continue
    }
    if (c === '/' && text[i + 1] === '/') {
      const nl = text.indexOf('\n', i)
      i = nl === -1 ? text.length : nl
      continue
    }
    if (c === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2)
      i = end === -1 ? text.length : end + 1
      continue
    }
    const stop = onChar(c, i)
    if (stop) return i
  }
  return -1
}

/** Extracts every top-level `{ ... }` object literal inside a `controls: [ ... ]` array. */
function extractControlObjects(sectionSrc) {
  const marker = 'controls:'
  const markerIndex = sectionSrc.indexOf(marker)
  if (markerIndex === -1) return []
  const bracketIndex = sectionSrc.indexOf('[', markerIndex)
  if (bracketIndex === -1) return []

  const objects = []
  let bracketDepth = 0
  let braceDepth = 0
  let objStart = -1

  skipStringsAndComments(sectionSrc, bracketIndex, (c, i) => {
    if (c === '[') bracketDepth += 1
    else if (c === ']') {
      bracketDepth -= 1
      if (bracketDepth === 0) return true // end of the controls array
    } else if (c === '{') {
      if (braceDepth === 0) objStart = i
      braceDepth += 1
    } else if (c === '}') {
      braceDepth -= 1
      if (braceDepth === 0 && objStart !== -1) {
        objects.push(sectionSrc.slice(objStart, i + 1))
        objStart = -1
      }
    }
    return false
  })

  return objects
}

/** Extracts every `function xxx(): SettingsSection { ... }` body, by the same brace-depth rule. */
function extractSettingsSectionFunctions(source) {
  const bodies = []
  const re = /function\s+\w+\s*\(\s*\)\s*:\s*SettingsSection\s*\{/g
  let m
  while ((m = re.exec(source)) !== null) {
    const openBrace = m.index + m[0].length - 1
    let depth = 0
    let end = -1
    skipStringsAndComments(source, openBrace, (c, i) => {
      if (c === '{') depth += 1
      else if (c === '}') {
        depth -= 1
        if (depth === 0) {
          end = i
          return true
        }
      }
      return false
    })
    if (end !== -1) bodies.push(source.slice(openBrace, end + 1))
  }
  return bodies
}

// ---------------------------------------------------------------------------
// Resolve `id:` values -- some controls use a literal string, others use an
// exported `..._ID` constant declared in i18n.ts or theme.ts.
// ---------------------------------------------------------------------------

function collectIdConstants(source) {
  const map = new Map()
  const re = /export const (\w+_ID)\s*=\s*'([^']+)'/g
  let m
  while ((m = re.exec(source)) !== null) map.set(m[1], m[2])
  return map
}

const coreFeatureSrc = readFileSync(CORE_FEATURE, 'utf8')
const idConstants = new Map([
  ...collectIdConstants(readFileSync(I18N, 'utf8')),
  ...collectIdConstants(readFileSync(THEME, 'utf8')),
  ...collectIdConstants(coreFeatureSrc)
])

function resolveControl(objText) {
  const idMatch = /\bid:\s*(?:'([^']*)'|"([^"]*)"|([A-Za-z_][A-Za-z0-9_]*))/.exec(objText)
  if (!idMatch) return null
  const id = idMatch[1] ?? idMatch[2] ?? idConstants.get(idMatch[3]) ?? null
  if (id === null) return null

  const labelMatch = /\blabel:\s*'([^']*)'/.exec(objText)
  const descriptionMatch = /\bdescription:\s*'([^']*)'/.exec(objText)
  const hasDefaultValue = /\bdefaultValue:\s*[^,}\n]/.test(objText)

  return {
    id,
    label: labelMatch ? labelMatch[1] : null,
    description: descriptionMatch ? descriptionMatch[1] : null,
    hasDefaultValue
  }
}

// ---------------------------------------------------------------------------
// Run.
// ---------------------------------------------------------------------------

const sectionBodies = extractSettingsSectionFunctions(coreFeatureSrc)
if (sectionBodies.length === 0) {
  die(2, `Found zero "function xxx(): SettingsSection { ... }" bodies in ${CORE_FEATURE}. Nothing to check.`)
}

const byId = new Map()
for (const body of sectionBodies) {
  for (const objText of extractControlObjects(body)) {
    const resolved = resolveControl(objText)
    if (resolved) byId.set(resolved.id, resolved)
  }
}

const failures = []
for (const id of CORE_REQUIRED_SETTING_IDS) {
  const control = byId.get(id)
  if (!control) {
    failures.push({ id, kind: 'missing-control', detail: `"${id}" is on the required list but no settings control in coreFeature.ts registers it` })
    continue
  }
  if (!control.description || control.description.trim().length === 0) {
    failures.push({ id, kind: 'no-description', detail: `"${id}" has no description; the progressive-disclosure explanation would render empty` })
    continue
  }
  if (control.label !== null && control.description.trim() === control.label.trim()) {
    failures.push({ id, kind: 'description-equals-label', detail: `"${id}" description is identical to its label` })
  }
  if (!control.hasDefaultValue) {
    failures.push({ id, kind: 'no-default-value', detail: `"${id}" has no defaultValue; the provenance line cannot name a real shipped value` })
  }
}

const summary = {
  ok: failures.length === 0,
  requiredCount: CORE_REQUIRED_SETTING_IDS.length,
  controlsFound: byId.size,
  failures
}

if (asJson) {
  console.log(JSON.stringify(summary, null, 2))
} else {
  console.log(`Settings coverage guard: ${CORE_REQUIRED_SETTING_IDS.length} required ids, ${byId.size} controls found in coreFeature.ts.`)
  if (failures.length === 0) {
    console.log('PASS — every required setting id has a description, a distinct explanation, and a declared default.')
  } else {
    console.log(`FAIL — ${failures.length} gap(s):\n`)
    for (const f of failures) console.log(`  - ${f.detail}`)
  }
}

process.exit(failures.length === 0 ? 0 : 1)
