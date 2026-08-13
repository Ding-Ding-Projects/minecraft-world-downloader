import type { DocArticle } from '../../core/registry';

/**
 * The in-application documentation for the file converter.
 *
 * These are the same articles as `docs/features/converter.md` in the
 * repository, bundled into the build so they read with no network at all.
 */

export const CONVERTER_DOCS: DocArticle[] = [
  {
    id: 'converter.overview',
    title: 'The file converter',
    category: 'Conversion',
    related: ['converter.catalog', 'converter.pdftools', 'converter.queue', 'core.regex', 'core.export'],
    body: `# The file converter

Three tabs, one shared idea underneath them: a route is only offered if it genuinely ships
inside the installed application, and nothing that route produces is offered back to you
until it has been checked.

## Format catalog

Every route the converter knows about, sorted into eight categories — Documents/PDF, Images,
Audio, Video, Archives, Structured data/spreadsheets, Code/text and Binary encodings. Each
category has its own search field with the anchored pattern builder, filtering only that
category's rows.

A route is either **enabled** — the whole implementation is compiled into this build, proven by
the exact module named in its catalog row — or **disabled**, shown greyed out with the precise
missing piece named next to it (a runtime image decoder, a decompression capability, a codec).
Nothing is hidden and nothing is guessed at: a route that depends on a capability this build
does not carry stays visible and honest about why it cannot run, rather than quietly
disappearing from the list.

## Convert files

Add files one at a time or a whole folder (scanned breadth-first, yielding to the interface
periodically so a large tree never freezes the window), choose a route, and the queue works
through them at a bounded concurrency you control in settings. A file's bytes exist in memory
only for the moment its own conversion is running; the queue itself only ever holds paths and a
handful of small facts per item, so a queue of ten thousand files costs no more memory than a
queue of ten.

The queue is durable: it is written to the same settings store as everything else in the
application, pause and resume both survive a restart, and an item that was mid-conversion when
the application closed comes back as pending rather than lost. Bulk actions — retry, remove,
select all shown, invert the selection — work the way they do everywhere else in the
application, with an exact count and a reviewable preview before anything destructive happens.

## PDF tools

Inspect, extract a page range, reorder, rotate, and rewrite a document's metadata all run
through the same routes the catalog lists, so this tab is a control surface over the validated
adapters, not a second implementation of them. Split and merge are different: they take more
than one output or more than one input, so they drive the underlying PDF reader and writer
directly, with the same reopen-and-check discipline every other PDF route already uses.

## What "validated after write" actually means here

Every PDF-writing route in this feature reopens the bytes it just produced — with the same
reader, no shortcuts — and checks the page count, every page's rotation, every page's size and
any metadata that was requested, before that result is ever offered to be saved. Because that
check runs against the in-memory result, a mismatch is caught before a single byte reaches disk:
there is no partial or invalid file left behind to clean up, because none was ever written.
`
  },
  {
    id: 'converter.catalog',
    title: 'Reading the format catalog',
    category: 'Conversion',
    related: ['converter.overview', 'core.regex'],
    body: `# Reading the format catalog

Each row is one **route** — a specific source-to-target conversion, not just a format. A single
format like JSON can appear as the source of several different routes (to YAML, to CSV, to a
pretty-printed copy of itself) and each one is its own row with its own status.

## Status

**Enabled** means the whole implementation ships inside the installed application: this
feature's own TypeScript, the application's shared export service, or a genuine capability of
the packaged runtime. It is never enabled because a tool happens to be reachable on the
system's PATH, because the machine building this app happened to have something installed, or
because a network service could theoretically be reached — none of those would still be true on
someone else's computer, so none of them ever light up a route here.

**Disabled** rows stay in the list rather than disappearing, each with the exact missing
dependency named — "the runtime's image-decoding capability is not available on this build", for
instance, rather than a vague "not supported".

## The other columns

- **Lossiness** — lossless, lossy, a read-only inspection, or a container repackaging.
- **Sandbox** — where the route actually runs: this feature's own bounded decoder, or entirely
  inside the renderer process with no network reachable from it.
- **Output check** — exactly what is verified about the produced file before it is offered:
  re-parsed as JSON, reopened as a PDF, its CRC-32 recomputed, and so on.

## Exporting the catalog

The **Export catalog** action turns every row into a CSV, through the same export service every
other list in the application uses.
`
  },
  {
    id: 'converter.queue',
    title: 'The convert queue',
    category: 'Conversion',
    related: ['converter.overview', 'core.export'],
    body: `# The convert queue

## Adding work

**Add files…** opens a multi-select file picker. **Add a folder…** walks that folder and every
folder beneath it, breadth-first, handing files to the queue in the batches each directory
listing returns rather than waiting for the whole tree — a scan of a huge tree still shows
progress immediately instead of appearing to hang.

## Concurrency and memory

The **Queue concurrency** setting (in File converter settings) bounds how many files convert at
once — 2 by default. Only files actively converting have their bytes in memory; everything else
in the queue is a path and a small status record. Raising concurrency raises peak memory
roughly linearly; it does not change how many files the queue can hold, because the queue never
loads bytes for anything it is not actively working on.

## Durability

The whole queue — every item, its status, its notes, its output path — is written through the
same settings store the rest of the application uses. Closing the application mid-run and
reopening it finds every item exactly where it left off; anything that was actively converting
when the window closed comes back as pending, with a note saying it was interrupted, rather than
silently vanishing or silently being marked done.

**Resume the queue on launch**, also in settings, controls whether a queue with pending work
starts itself the moment the application opens, before you have even opened this tab.

## What happens to an existing destination file

Set in **File converter** settings, under **When a destination file already exists**:

- **Ask each time** is the default in spirit, though because the queue can run many files at
  once without a human present for each one, this build resolves it once per file into a real
  outcome — either skip or overwrite — rather than opening a per-file dialog no one is there to
  answer, and every choice made this way is written into the item's own notes.
- **Skip the file** marks the item skipped and explains why, and nothing is touched at the
  destination.
- **Overwrite it** writes over the existing file.

## Bulk actions

Multi-select works the way it does throughout the application: click, shift-click for a range,
or the keyboard. **Invert selection** swaps picked for unpicked. **Retry** and **Remove** act on
whatever is currently selected, and both **Cancel every pending item** and **Clear finished
items** show the exact count and the exact affected rows before doing anything, through the same
two-key gate every destructive action in the application uses.
`
  },
  {
    id: 'converter.pdftools',
    title: 'PDF tools: split, merge and the rest',
    category: 'Conversion',
    related: ['converter.overview', 'converter.catalog'],
    body: `# PDF tools

## Inspect, extract, reorder, rotate, metadata

These five all read a chosen source PDF and, where they write, produce a *rewritten* document —
not a byte-for-byte edit of the original. The rewriter walks the object graph reachable from
the pages you keep and copies only that: outlines, form fields, the structure tree, named
destinations and any digital signature do not survive, and every one of those is named before
the action runs, in the disclosure box under the route picker.

Every stream in the rewritten document is re-encoded as ASCII hex ahead of whatever compression
it already had, because the application's file-writing channel writes UTF-8 text and a PDF
carrying raw bytes above 127 would corrupt on that write. This roughly doubles the size of a
PDF that was mostly compressed images, and that too is disclosed up front.

After writing, the result is reopened from scratch with the same reader and checked against the
request: the exact page count, the exact rotation of every page, the exact size of every page,
and any metadata that was set. The **Reopen checks** panel shows every one of those checks by
name; if any of them disagree, nothing was written and the panel says so — a mismatch is caught
before it reaches disk, not cleaned up after.

## Split

Choose a page count per output file. The source is cut into consecutive groups of that many
pages — the last group may hold fewer — and each group becomes its own rewritten document in a
folder you choose, named "\<source\>-part1.pdf", "\<source\>-part2.pdf" and so on. Every part goes
through the same reopen-and-check discipline individually; if any single part fails its check,
the whole split stops and nothing from it is kept.

## Merge

Add PDFs one batch at a time, reorder them with the up/down controls beside each row (or remove
one entirely), then merge. Every page from every source is copied into one new document in the
exact order the list shows, each source's own object numbers renumbered so two sources that
both started counting at object 1 (the ordinary case) do not collide with each other in the
result.

The merged result is reopened and checked the same way a single-source rewrite is: total page
count, every page's rotation and every page's size, all verified against what the merge actually
requested before the file is written.

## Encrypted documents

None of these tools can supply a password. An encrypted source can only have its trailer read,
so every PDF tool refuses it outright and says so, rather than guessing at a partial result.
`
  }
];
