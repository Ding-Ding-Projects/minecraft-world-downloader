#!/usr/bin/env node
// Report this project's current state to the shared status hub.
//
// The hub exists so a project's state survives the session that produced it. A project that has
// never appeared on it has its state only in whichever conversation last touched it, which is
// exactly the state that vanishes when that conversation ends.
//
// SECRETS: the hub's enrollment token is never read into this process, never printed, never
// written to a file and never passed as a command-line argument (arguments are visible to every
// other process on the machine). In --via-host mode the token is resolved from the running
// container's own environment ON the host and used in place there. In direct mode it is read from
// the STATUS_HUB_INGEST_TOKEN environment variable of this process and sent only as a request
// header.
//
// The per-session key is generated once and kept OUTSIDE the repository, because a key committed
// to the repository is a key anyone with a clone can use to overwrite this project's status.
//
// Usage:
//   node scripts/report-status.mjs --status running --summary "..." [--gate "..."]... [--dry-run]
//   node scripts/report-status.mjs --via-host docker@<host> --status landed --summary "..."
//
// Exit codes: 0 reported (or dry run). 1 the hub refused or was unreachable. 2 bad usage.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { homedir } from 'node:os'
import { execFileSync, spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const SESSION_ID = 'mwd-herng-ha'
const HUB_ORIGIN = process.env.STATUS_HUB_ORIGIN || 'https://uh.dewhui.uk'
const HUB_LOCAL = process.env.STATUS_HUB_LOCAL || 'http://127.0.0.1:8099'
const CONTAINER = process.env.STATUS_HUB_CONTAINER || 'agent-status-hub'

// Deliberately outside the repository. See the note above.
const KEY_FILE = join(homedir(), '.config', 'world-downloader-studio', 'status-hub-session.key')

const ALLOWED_STATUSES = new Set(['running', 'waiting', 'blocked', 'landed', 'failed'])
const ALLOWED_EVIDENCE_STATES = new Set(['pending', 'running', 'verified', 'failed'])

// --- arguments ---------------------------------------------------------------

function parseArgs(argv) {
  const out = { gates: [], evidence: [], dryRun: false, viaHost: '', status: 'running', summary: '', assumption: '', baseline: '' }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    const next = () => {
      const v = argv[i + 1]
      if (v === undefined || v.startsWith('--')) fail(2, `${a} needs a value`)
      i += 1
      return v
    }
    if (a === '--status') out.status = next()
    else if (a === '--summary') out.summary = next()
    else if (a === '--assumption') out.assumption = next()
    else if (a === '--baseline') out.baseline = next()
    else if (a === '--gate') out.gates.push(next())
    else if (a === '--evidence') out.evidence.push(next()) // "state|label|url"
    else if (a === '--via-host') out.viaHost = next()
    else if (a === '--dry-run') out.dryRun = true
    else fail(2, `unrecognised argument ${a}`)
  }
  if (!ALLOWED_STATUSES.has(out.status)) {
    fail(2, `--status must be one of: ${[...ALLOWED_STATUSES].join(', ')}`)
  }
  return out
}

function fail(code, message) {
  console.error(`report-status: ${message}`)
  process.exit(code)
}

// --- real repository state, never asserted ------------------------------------

function git(...args) {
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim()
  } catch {
    return ''
  }
}

function repositorySlug() {
  const url = git('remote', 'get-url', 'origin')
  const m = /github\.com[:/]([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?)(?:\.git)?$/.exec(url)
  return m ? m[1] : url
}

function sessionKey() {
  if (existsSync(KEY_FILE)) {
    const existing = readFileSync(KEY_FILE, 'utf8').trim()
    if (existing.length >= 24) return existing
  }
  const generated = randomBytes(24).toString('hex')
  mkdirSync(dirname(KEY_FILE), { recursive: true })
  writeFileSync(KEY_FILE, generated, { mode: 0o600 })
  console.log(`report-status: generated a new session key at ${KEY_FILE} (value not printed)`)
  return generated
}

function parseEvidence(specs) {
  return specs.map((spec, index) => {
    const [state, label, url] = spec.split('|')
    if (!ALLOWED_EVIDENCE_STATES.has(state)) fail(2, `evidence state "${state}" must be one of: ${[...ALLOWED_EVIDENCE_STATES].join(', ')}`)
    if (!label || !url) fail(2, `evidence must be "state|label|url" — got "${spec}"`)
    try {
      const parsed = new URL(url)
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('protocol')
    } catch {
      fail(2, `evidence url is not a usable http(s) URL: ${url}`)
    }
    return { id: `evidence-${index + 1}`, label, url, state }
  }).slice(0, 8)
}

// --- build the payload --------------------------------------------------------

const args = parseArgs(process.argv.slice(2))

const sha = git('rev-parse', 'HEAD')
const branch = git('rev-parse', '--abbrev-ref', 'HEAD')
const slug = repositorySlug()
const dirty = git('status', '--porcelain').length > 0

if (!sha) fail(1, 'could not resolve HEAD — is this a git checkout?')

// The baseline is a claim about what is actually on the remote, so prove it rather than assert it.
let baseline = args.baseline
if (!baseline) {
  const upstream = git('rev-parse', `origin/${branch}`)
  baseline = upstream === sha
    ? `${sha.slice(0, 7)} on origin/${branch}, confirmed present on the remote by SHA comparison`
    : upstream
      ? `local ${sha.slice(0, 7)} differs from origin/${branch} at ${upstream.slice(0, 7)} — local work is not on the remote`
      : `${sha.slice(0, 7)} local only — origin/${branch} does not exist yet`
}

const payload = {
  id: SESSION_ID,
  title: 'World Downloader Studio - unify five projects into one desktop application',
  repository: slug,
  branch,
  agent: 'Claude Fable 5',
  status: args.status,
  summary: args.summary || 'No summary supplied for this update.',
  assumption: args.assumption,
  verifiedBaseline: baseline,
  machine: process.env.COMPUTERNAME || process.env.HOSTNAME || 'local workstation',
  worktrees: [{ path: ROOT.replace(/\\/g, '/'), branch, commit: sha, bytes: 0, dirty }],
}
if (args.gates.length) payload.nextGates = args.gates.slice(0, 8)
if (args.evidence.length) payload.evidence = parseEvidence(args.evidence)

const body = JSON.stringify(payload)

if (args.dryRun) {
  console.log(JSON.stringify(payload, null, 2))
  console.log(`\nreport-status: dry run — nothing sent. ${body.length} bytes would go to ${args.viaHost ? `${HUB_LOCAL} via ${args.viaHost}` : HUB_ORIGIN}.`)
  process.exit(0)
}

// --- send ---------------------------------------------------------------------

const key = sessionKey()

if (args.viaHost) {
  // The token stays on the host. It is read from the container's own environment there and used in
  // the same shell; it is never returned to this process.
  const remote = `
set -u
TOKEN=$(docker inspect "$CONTAINER_NAME" --format '{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null | sed -n 's/^AGENT_INGEST_TOKEN=//p' | head -1)
if [ -z "$TOKEN" ]; then echo "BLOCKER: AGENT_INGEST_TOKEN is not set on $CONTAINER_NAME"; exit 3; fi
TMP=$(mktemp)
printf '%s' "$PAYLOAD_B64" | base64 -d > "$TMP"
HTTP=$(curl -sS -o "$TMP.out" -w '%{http_code}' --max-time 30 \
  -X POST "$HUB_URL/api/agent/sessions" \
  -H 'content-type: application/json' \
  -H "x-agent-ingest-token: $TOKEN" \
  -H "x-session-key: $SESSION_KEY" \
  --data-binary @"$TMP")
echo "HTTP=$HTTP"
if [ "$HTTP" != "200" ]; then head -c 400 "$TMP.out"; echo; fi
rm -f "$TMP" "$TMP.out"
`
  // ssh does not forward this process's environment, so the non-secret values are inlined as
  // assignments in front of `bash -s`. The token is deliberately NOT among them: it is resolved on
  // the far side, inside the same shell that uses it.
  const sent = spawnSync('ssh', ['-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=no', '-o', 'ConnectTimeout=10', args.viaHost,
    `CONTAINER_NAME='${CONTAINER}' HUB_URL='${HUB_LOCAL}' SESSION_KEY='${key}' PAYLOAD_B64='${Buffer.from(body).toString('base64')}' bash -s`], {
    input: remote,
    encoding: 'utf8',
  })
  const out = (sent.stdout || '') + (sent.stderr || '')
  process.stdout.write(out)
  const ok = /HTTP=200/.test(out)
  console.log(ok ? `report-status: hub accepted the update for session ${SESSION_ID}.` : 'report-status: the hub did NOT accept the update.')
  process.exit(ok ? 0 : 1)
}

const token = process.env.STATUS_HUB_INGEST_TOKEN
if (!token) {
  fail(1, 'no STATUS_HUB_INGEST_TOKEN in the environment and no --via-host given.\n' +
    '  Either export the token into this process, or use --via-host docker@<host> so the token is\n' +
    '  read from the running container on the host and never travels. Do not paste a token into a\n' +
    '  command line: arguments are visible to every other process on the machine.')
}

const res = await fetch(`${HUB_ORIGIN}/api/agent/sessions`, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-agent-ingest-token': token,
    'x-session-key': key,
  },
  body,
}).catch(e => { fail(1, `could not reach the hub at ${HUB_ORIGIN}: ${e.message}`) })

if (res.status !== 200) {
  const text = await res.text().catch(() => '')
  fail(1, `the hub refused the update with HTTP ${res.status}. ${text.slice(0, 300)}`)
}

console.log(`report-status: hub accepted the update for session ${SESSION_ID} (HTTP 200).`)
