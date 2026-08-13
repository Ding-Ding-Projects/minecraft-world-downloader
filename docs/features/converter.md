# File converter

A local, bundled file converter with a categorized, searchable adapter catalog across eight
categories, a durable bounded-concurrency convert queue, and a PDF workbench (inspect, split,
merge, extract, reorder, rotate, metadata) whose every write is reopened and checked before it
is offered. A route is enabled only when its whole implementation ships inside the installed
application; PATH discovery, a developer-machine tool, or a reachable network service never
lights one up.

- **Feature id:** `converter`
- **Destinations:** *Convert files* (the queue), *Format catalog* (every route, by category),
  *PDF tools* (inspect / split / merge / extract / reorder / rotate / metadata)
- **Settings section:** *File converter*
- **Command palette:** open each of the three destinations, plus the live controls for all
  fourteen settings
- **Satisfies:** `FEATURE_INVENTORY.md` rows **11.1**–**11.4**

---

## Behaviour

### The format catalog (row 11.1)

*Format catalog* lists every route — not every format, every *route*, since one format can be
both the source and the target of several distinct routes — sorted into the eight categories
Documents/PDF, Images, Audio, Video, Archives, Structured data/spreadsheets, Code/text and
Binary encodings. Each category renders as its own section with its own heading, its own
description, and its own search field carrying the anchored full pattern builder, filtering
only that category's rows; there is no single shared search silently applying to whichever
category was last touched.

Every route shows its status, lossiness, sandbox and output-check columns, resolved from the
same data the queue and the PDF tools tab run against — nothing here is a second, separate
description of what a route does. A route that cannot run right now stays in the list rather
than disappearing, shown disabled with the exact missing dependency named in its own column
("the runtime's image-decoding capability is not available on this build", for instance,
rather than a bare "unsupported"). The whole catalog can be exported to CSV through the
application's own export service.

### Enabled means bundled, offline and proven (row 11.2)

A route's `bundled` flag is claimed only when its whole implementation is compiled into the
renderer bundle: this feature's own TypeScript modules (`adapters.ts`, `pdf.ts`, `archives.ts`,
`images.ts`, `media.ts`, `records.ts`, `bytes.ts`), the application's shared export service, or a
genuine capability of the packaged Electron/Chromium runtime (`createImageBitmap` +
`OffscreenCanvas` for raster decoding, `DecompressionStream` for gzip). It is never enabled
because a tool happens to be reachable on the machine's `PATH`, because the machine that built
the app happened to have something installed, or because a network service could theoretically
answer — none of those survive being copied to someone else's computer, so none of them light a
route up here. Where a route leans on a capability that might genuinely be absent even in a
correctly packaged build (the two runtime probes above), it is re-checked live every time the
catalog renders rather than assumed once at build time.

Every route also declares its sandbox (this feature's own bounded decoder, or the renderer
process with no network reachable from it), its resource bounds (source bytes, output bytes,
decoded pixels, PDF pages, archive/record/object entries, nesting depth, a wall-clock time
budget — all user-adjustable in settings, all enforced by a cooperative `Deadline` every
adapter checks inside its own loops), and exactly what is checked about its output before that
output is ever offered: a JSON re-parse, a CRC-32 recomputation against the archive's own
record, a reopened and reparsed PDF, and so on.

### PDF tools (row 11.3)

*Inspect*, *Extract pages*, *Reorder pages*, *Rotate pages* and *Edit metadata* each run the
exact `documents.pdf.*` route the catalog lists, through the same `runSingleFileAdapter` path
the queue itself uses — this tab is a control surface over the validated routes, not a second
implementation of them. Every one of the four writing routes rewrites the document from the
object graph reachable from the pages kept: outlines, form fields, the structure tree, named
destinations and any digital signature do not survive, and every one of those is named in the
disclosure box shown under the route picker before the action runs. Every stream in the
rewritten document is re-encoded as `ASCIIHexDecode` ahead of whatever compression it already
carried, because the application's file-writing channel writes UTF-8 text and a raw byte above
127 would corrupt on that write; this roughly doubles the size of an image-heavy source, and
that is disclosed too.

*Split* and *merge* have no single-source `run` step (they are declared `multiFile: 'split' |
'merge'` in the adapter registry, deliberately, since neither fits the one-file-in/one-file-out
shape every other route has), so this tab drives `pdf.ts`'s `buildDocument` and `mergeDocuments`
directly:

- **Split** cuts the source into consecutive groups of a chosen page count (the last group may
  hold fewer) and writes one rewritten document per group into a chosen folder, named
  `<source>-part1.pdf`, `<source>-part2.pdf` and so on. Each part is validated individually; if
  any single part fails its reopen check, the whole split stops and nothing from it is kept.
- **Merge** copies every page from every chosen source, in the exact order a reorderable list
  shows, into one new document. Each source's own object numbers are renumbered independently
  before being combined, so two sources that both started counting at object 1 — the ordinary
  case — do not collide with each other in the merged result.

Every PDF-writing route — the four single-source ones, every split part, and the merge —
reopens the bytes it just produced with the same reader, no shortcuts, and checks the exact
page count, every page's rotation, every page's size, and any metadata that was requested,
before the result is ever offered to be saved. None of the encrypted-source refusal is a
partial attempt: an encrypted PDF can only have its trailer read, so every PDF route refuses it
outright with that exact reason rather than guessing at a partial result.

**On "atomic" writes.** The privileged file bridge exposes a single `writeText(path, contents)`
call with no separate rename-into-place step. Every write in this feature is therefore made
*validated-then-write* rather than *write-then-validate*: the reopen check above runs entirely
against the in-memory bytes the route just produced, and the destination path is only ever
touched once that check has already passed. A failing check means the destination is never
touched at all — there is no partial or mismatched file left behind to clean up, because none
was ever written in the first place.

### The convert queue (row 11.4)

*Convert files* is an unlimited-length, durable, bounded-concurrency queue. **Add files…**
opens a multi-select picker; **Add a folder…** walks that folder and everything beneath it
breadth-first through `discovery.ts`, handing each directory's files to the queue in the batch
that directory's own listing returned (paged discovery — one directory read, not the whole
tree, is the unit of work) and yielding to the interface every twenty directories so a large
tree never blocks the window.

The queue holds only paths and a handful of small per-item facts (id, status, detected type,
output path, notes, error, timestamps) in memory at any size — never every file's bytes. A
file's bytes exist only for the moment its own item is actively converting (read through
`readSourceBytes`, bounded to the current source-size limit) and are released the instant that
conversion finishes; with the default concurrency of 2 that bounds memory to roughly two files'
worth of bytes regardless of whether the queue holds ten items or ten thousand.

State is written through the same durable JSON settings store every other setting in the
application uses (`ctx.settings`), not a bespoke file. An item found `running` at startup was
interrupted by a restart rather than finished, so the engine puts it back to `pending` —
recoverable, with a note saying so — before anything else happens. **Resume the queue on
launch** (a setting) starts the engine from `init`, before any tab has even been opened, when a
durable queue was left with pending work and was not deliberately paused; pause itself is
durable too, written through the same store, so a paused queue stays paused across a restart
until the user resumes it.

**Existing destinations.** Before the queue starts, every pending item's destination is
resolved and checked. Under **Skip the file** every collision is marked skipped outright, with
the reason recorded on the item. Under **Overwrite it** every collision is pre-approved and the
queue writes over them. Under **Ask each time** — the default — the whole colliding set is
shown once, by name, through the two-key confirmation gate before the queue starts; declining
skips exactly that set, approving marks exactly that set pre-approved to overwrite. There is no
per-file dialog once conversion is actually running unattended: anything that still collides at
write time without a prior approval (added after the ask, or written first by a sibling item) is
skipped rather than silently overwritten, since there is no one left to ask a second time.

Bulk actions follow the same contract as every other list in the application: multi-select with
a keyboard path, **Invert selection**, **Retry** and **Remove** acting on whatever is currently
selected, and both **Cancel every pending item** and **Clear finished items** showing the exact
count and the exact affected rows through the two-key gate before anything happens. **Cancel
every pending item** only ever touches items that have not started; a *running* item is
cancelled individually from its own row, which asks that item's cooperative deadline to stop at
its next check rather than killing anything mid-write.

---

## Configuration

All under **Settings → File converter**:

| Setting | Default | What it bounds |
| --- | --- | --- |
| Maximum source size | 16 MiB | The largest source file any route will read |
| Maximum output size | 64 MiB | The largest produced file any route will write |
| Maximum decoded pixels | 40,000,000 | The largest image an image route will decode |
| Maximum PDF pages | 5,000 | The largest page count a PDF route will touch |
| Maximum entries | 20,000 | Archive members, records or PDF objects per run |
| Maximum nesting depth | 32 | How deep an object graph, JSON document or archive path may nest |
| Per-file time budget | 20,000 ms | Wall-clock budget for one conversion |
| Queue concurrency | 2 | Files converting at once |
| Save queue state every | 25 | (Reserved for future finer-grained checkpointing; the queue currently persists on every state change) |
| Destination folder | *(none — beside source)* | Where converted files land |
| When a destination file already exists | Ask each time | `confirm` / `skip` / `overwrite` |
| Resume the queue on launch | On | Whether pending work restarts itself at application start |
| Keep finished outcomes | 500 | Finished queue rows kept before the oldest are trimmed |
| Detection sample size | 4,096 bytes | Bytes sampled from the start of a file to detect its type |

Every control carries its own explanation behind progressive disclosure and a truthful
provenance line naming whether its current value came from a file the user wrote or the
compiled-in default shown above.

---

## Failure modes

- **A source past the size, pixel, page, entry, depth or time bound** is refused with the exact
  boundary named (`ConverterBoundary`) and the setting that governs it; nothing partial is
  written.
- **An unsupported or mismatched source** (a text route handed bytes that are not valid UTF-8,
  a JSON route handed a source that does not parse) is refused with the exact reason.
- **An encrypted PDF** is refused outright by every PDF route; only its trailer could be read.
- **A route that is not bundled on this build** never appears runnable in the Convert tab's
  route picker and shows disabled with its exact missing dependency in the catalog.
- **A destination write failure** (permission denied, disk full, an invalid path) is reported on
  the queue item as `failed` with the bridge's own error message; the conversion itself already
  succeeded and only the write failed, so retrying re-runs the whole conversion rather than
  attempting to resume a partial write, since no partial file was ever created.
- **A reopen-check mismatch on any PDF write** — single-route, one split part, or the merge —
  refuses the whole write; nothing reaches disk.
- **A restart during an active conversion** leaves that item `pending` again on the next launch,
  with a note explaining it was interrupted, rather than lost or silently marked done.

---

## Security considerations

- **No runtime network access.** Every route runs entirely inside the renderer process or this
  feature's own bounded decoder; nothing here calls `ctx.studio.http`, and no adapter is ever
  enabled because a network service might be reachable.
- **Bounded everything.** Source bytes, output bytes, decoded pixels, PDF pages, archive/record
  entries, nesting depth and wall-clock time are all enforced, so a hostile or simply enormous
  source stops at a stated, user-visible boundary rather than exhausting memory or hanging the
  window.
- **No path traversal from an archive.** `archives.ts`'s `isUnsafeArchivePath` refuses any
  archive member path that would escape its extraction target before that member is ever read.
- **No secrets, no logs of file content.** A failure message is scrubbed
  (`safeFailureMessage`) to strip anything that looks like a filesystem path before it is shown,
  since a parser error can otherwise quote bytes from the document itself.
- **Destination writes stay inside the chosen folder.** Output file names are derived from the
  source file's own stem; nothing in this feature accepts an output path from inside a
  document's own content.

---

## Verification

- `npx tsc --noEmit -p tsconfig.web.json` — clean for every file in `features/converter/`.
- Loading `strings.ts` at runtime confirms all 425 catalogue entries carry exactly five rungs in
  both English and Cantonese, and that every one of the 67 formats and 8 categories declared in
  `formats.ts` has matching name and summary text (both throw at module load if a gap exists,
  so a format added without its text fails loudly rather than shipping silently blank).
- Every `ctx.t('converter....')` call and every static `label:`/`title:`/`description:` field
  across `catalog.ts`, `convert-tab.ts`, `pdftools.ts` and `index.ts` resolves to a key that
  exists in `strings.ts` (cross-checked directly against the source, not assumed).
- Manual review of `pdf.ts`'s `mergeDocuments` (added alongside `assembleDocument`, factored out
  of the existing `buildDocument` so both share one serializer) against `buildDocument`'s
  existing, already-tested renumbering algorithm, run once per source with an independent
  `assigned` map so two sources' colliding object numbers cannot overwrite each other.

---

## Suggested related articles

- [Local models](models.md)
- [Export](export.md)
- [Local version history](history.md)
