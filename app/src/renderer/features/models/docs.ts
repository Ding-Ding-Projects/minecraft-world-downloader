import type { DocArticle } from '../../core/registry';

/**
 * The in-application documentation for the local model suite manager.
 *
 * These are the same articles as `docs/features/models.md` in the repository,
 * bundled into the build so they read with no network at all.
 */

export const MODELS_DOCS: DocArticle[] = [
  {
    id: 'models.docs.overview',
    title: 'The local model suite manager',
    category: 'Local models',
    related: ['models.docs.hardware', 'models.docs.store', 'models.docs.queue', 'models.docs.chat', 'models.docs.harness'],
    body: `# The local model suite manager

Four tabs over one local runtime: **Local models** for health and what is installed,
**Model store** for the published catalog and the pull queue, **Model chat** for local
sessions, and **Harness profiles** for launching a program of your own against a model.

## What this talks to

Every call goes through the privileged bridge to the runtime's own documented HTTP API —
version, tags, ps, show, delete, copy, pull, chat — and nothing else. There is no
unofficial proxy, no embedded cloud model service, and no route that lets the runtime
launch an arbitrary program; that is what the harness feature is for, and it launches
through this application's own allow-listed process bridge, never through the runtime.

## Two limits that shape the whole feature

The privileged network boundary buffers a response rather than streaming it, and caps a
single request at two minutes. Two consequences follow directly:

- A chat reply arrives complete, not a word at a time. There is nothing to render
  progressively, so the timing counters shown are the runtime's own.
- A large pull cannot be one two-minute-plus request. It runs as a series of bounded
  attempts instead — see the pull queue article for exactly how that works.

## Honesty rules that hold everywhere in this feature

- A figure nobody measured is Unknown, never a guess read off a model's name.
- A hardware-fit verdict is evidence about this machine, never a promise about a run.
- The pull queue is a download queue. There is no price, no purchase, no account and no
  payment anywhere in it.
- A harness profile launches through an allow-listed schema. There is no free-text
  command field, and two strings are never joined into one.`
  },
  {
    id: 'models.docs.hardware',
    title: 'Hardware evidence and fit verdicts',
    category: 'Local models',
    related: ['models.docs.overview', 'models.docs.store'],
    body: `# Hardware evidence and fit verdicts

Every fit verdict is arithmetic over measured figures, computed fresh whenever the
hardware snapshot, the model's own metadata, or the context and runtime allowance
setting changes.

## Where the figures come from

- **Processor count and a memory lower bound** come from the browser runtime.
  \`navigator.deviceMemory\` is capped at 8 GiB by the browser itself, so it can only ever
  support a positive verdict, never a negative one.
- **The graphics adapter string** comes from the \`WEBGL_debug_renderer_info\` extension,
  when the browser allows it.
- **Video memory in use** comes from the runtime's own \`/api/ps\` report of what it
  currently holds loaded, which is a lower bound on capacity rather than the capacity
  itself.
- **Exact system memory and free disk space** come from the measurement helper, which is
  off by default. Turning it on in Settings › Local models runs one small, fixed program
  — held as a constant in this application's source — through the privileged process
  bridge. It reads three numbers and writes nothing; nothing you type ever becomes part
  of it.

## The four verdicts

**Runs well**, **Runs with limits**, **Unlikely**, and **Unknown**. A verdict is never
inferred from a model's name. Missing metadata — an unpublished weights size, an
unmeasured disk figure — produces Unknown, never a zero that would quietly bias the
arithmetic.

Every verdict shows its reasoning line by line and names every assumption it made,
including the flat context-and-runtime allowance that is added on top of a model's
published weights size. The evidence rows and the reasoning are shown in English
regardless of the active language mode, because they are measured figures and quoted
runtime output rather than copy.`
  },
  {
    id: 'models.docs.store',
    title: 'The model store and catalog refresh',
    category: 'Local models',
    related: ['models.docs.overview', 'models.docs.queue', 'models.docs.hardware'],
    body: `# The model store and catalog refresh

The inventory is variant level — one row per published tag — built from the runtime's
registry using its documented OCI Distribution v2 endpoints: the repository catalog, each
repository's tag list, and a manifest per variant.

## What "complete" means

A refresh follows every page of every listing to its end. The completeness verdict is
only ever true when nothing stopped it early. When the registry refuses a whole-catalog
listing — which it is entitled to do — the refresh says so in those exact words and falls
back to enumerating every repository it can name from real evidence: what a previous
refresh already found, and what is installed locally. That fallback listing is genuinely
complete for every repository it names, and honestly incomplete about the rest.

## Sizes are not read eagerly

Fetching a manifest per tag would be thousands of requests for a catalog nobody has
scrolled yet. A row's size, parameter count, quantization and capabilities stay Unknown,
with the gap named, until you open that row, add it to the pull queue, or run the bounded
enrichment pass over the rows currently shown.

## Installed models are never hidden

The store combines the catalog with the local runtime's own installed list. Neither set is
filtered out of the other: an installed model the catalog source never listed keeps its
row, and a catalog entry that is not installed keeps its row too.

## Stale and offline

A catalog older than the configured staleness window is labelled stale with an offer to
verify it again; nothing is deleted when it goes stale. When the source cannot be reached
at all, the store shows the last verified catalog plus the current installed state, and
says plainly that nothing new was guessed at.`
  },
  {
    id: 'models.docs.queue',
    title: 'The pull queue',
    category: 'Local models',
    related: ['models.docs.store', 'models.docs.hardware'],
    body: `# The pull queue

Adding a variant schedules a local download and nothing else. There is no price, no
purchase, no checkout, no account and no payment anywhere in this feature.

## Why a pull is a series of attempts

The privileged network boundary caps any single request at two minutes and hands the
response body back only once it is complete. A multi-gigabyte pull cannot be one such
request, so each queue item runs as a sequence of bounded attempts instead. The runtime
keeps the layers it already fetched between attempts and resumes from them.

## What actually proves a pull landed

After every attempt, the queue asks the runtime's own installed list whether the model is
now there. That list — not a status line, and not the attempt's own claim of success — is
the only thing that marks an item done. An attempt that runs out of its two-minute window
is re-checked the same way before it is retried, because it may have finished anyway.

## Cancel, retry, resume

Cancelling an item stops it without discarding progress: whatever layers already landed
stay on disk, and a retry resumes from them. On startup the queue reconciles every
outstanding item against the runtime's installed list, so work that finished while the
application was closed is recognised rather than pulled again.

## Bounded parallelism

The number of items pulling at once is configurable, from 1 to 4. More is rarely faster
once the link or the disk is saturated, and every concurrent item competes for the same
disk.`
  },
  {
    id: 'models.docs.chat',
    title: 'Model chat',
    category: 'Local models',
    related: ['models.docs.overview'],
    body: `# Model chat

Local sessions against an installed model. Nothing leaves this machine except the request
to the runtime address configured in Settings, which defaults to a loopback address.

## Replies arrive complete

The privileged network boundary buffers the whole response before handing it back, so a
reply cannot be rendered a word at a time. The timing counters shown under a reply —
prompt tokens, reply tokens, total duration, tokens per second — are the runtime's own
measurements, read straight off its response.

## Attachments are gated on real capability

An image can only be attached when the runtime has actually reported a vision capability
for the chosen model, read from its own \`/api/show\` response. A model that has not been
opened yet has not had its capabilities read, and the attachment control says so rather
than guessing.

## What is kept, and where

Sessions, their messages and their settings are stored in this application's own local
settings file. Turn history sent with each new message is bounded by the configured turn
limit, which is what keeps a long-running session from growing without limit.`
  },
  {
    id: 'models.docs.harness',
    title: 'Harness profiles',
    category: 'Local models',
    related: ['models.docs.overview', 'models.docs.chat'],
    body: `# Harness profiles

A harness profile is this application launching a local program of your own against a
model — not the model runtime launching anything, because the runtime cannot launch a
program at all.

## The allow list, twice over

Every field is validated against a fixed schema before a launch is even attempted.

- **The executable** must be one of a short, fixed list of names, passed to the operating
  system with no shell in between.
- **Every argument** is a typed token: a literal drawn from a bounded character set, an
  absolute path chosen through the native browse control, a number, or one of two
  substitutions this application fills in itself (the chosen model, or the runtime
  address). There is no free-text command field anywhere, and two strings are never
  joined into one before being passed to the process.
- **Every environment key** a profile may set is drawn from a fixed list. A secret value
  is stored as the *name* of an operating system vault account, never as the value
  itself, and the value is read from the vault only at the moment of launch — never
  written into a snapshot, a log, an export, or the settings file.

## Preflight, then launch

Preflight checks the profile's schema, its working directory, its required files, the
chosen model's presence in the runtime's installed list, every vault entry a profile
needs, and the runtime's own health — and reports each one by name, pass or blocked, with
the exact next action. The reviewable preview shows exactly what will run: the resolved
command and arguments, and the environment with every secret redacted.

## Snapshot, launch, rollback

A snapshot of the profile is taken automatically before every launch attempt. If the
process refuses to start, exits during its settle window, or never prints its configured
readiness marker, the snapshot is put back automatically and the launch report says so —
a failed launch never leaves a profile carrying the state of a run that did not happen.
Snapshots are also listed for manual restore, and a restore is itself recorded as a new
snapshot, never a silent rewrite.

## The shipped templates

The profiles this feature ships are templates, not one-click launchers: they name a real,
allow-listed shape and leave the folder, and anything specific to your own machine, to be
chosen through the pickers after duplicating one into a profile of your own.`
  }
];
