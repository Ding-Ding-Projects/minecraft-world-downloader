# World Vault renders

> An optional map render per World Vault commit, driven by a bounded, cancellable, resumable queue, plus a two-part comparison between any two commits: a real region-header diff read directly off disk, and an on-demand visual comparison opened in the user's own browser.

- **Feature id:** `worldvaultrenders`
- **Destination:** *Renders* (`worldvaultrenders.main`)
- **Settings section:** *World Vault renders*
- **Command palette:** open the render queue, jump to settings, plus the live controls for its settings
- **Satisfies:** `FEATURE_INVENTORY.md` row **13.9**

---

## What it does

Rendering a world costs real minutes of CPU time and needs a Java runtime, so
this feature is off by default and never runs a render as a side effect of
anything else — not of enabling the vault, not of a commit landing while the
setting happens to be off. When the setting is on, every new commit the vault
records is added to a render queue.

The queue never touches the live, actively-downloading world directly. It
asks `../world-vault` to export the chosen commit's tree to its own, separate
folder — an immutable snapshot the render can take as long as it likes over,
with no race against whatever the downloader is still writing to the real
world folder.

### The queue

- **Bounded concurrency** — a configurable number of renders run at once
  (`worldvaultrenders.concurrency`, 1–4). Nothing beyond that limit starts
  until a slot frees up.
- **Cancellable** — a queued render is marked cancelled instantly; a running
  one has its process killed and reports `cancelled` once the process
  actually exits.
- **Resumable** — a cancelled or failed render can be retried from the same
  commit, and a render still `exporting`/`rendering` when the application
  last closed is honestly re-labelled `queued` on the next launch rather than
  claiming a percentage nothing is currently producing.
- **Real progress** — the renderer's own console output is parsed for a
  percentage; when it has not printed one yet, the surface shows the task
  description and the live log instead of a bare spinner, which is
  indistinguishable from a hang.
- **Behind, not dropped** — once the backlog passes
  `worldvaultrenders.backlogWarningThreshold`, the oldest still-queued
  entries beyond it are labelled `behind` and a single debounced notification
  says the queue is falling behind. Nothing is ever silently discarded.

### Honest absence

A commit's render record is keyed by, and only ever updated for, that
commit's own id. A commit with no render yet, a cancelled render, or a failed
one says exactly that in words — it never shows a neighbouring commit's
picture in its place, which would be very hard for a user to notice was
wrong.

### Java and the renderer

A render needs two things this application never assumes: a Java runtime on
the machine, and a configured renderer file (the BlueMap CLI jar, or a
Worldlens Node entry point — see `bluemap.md` and `worldlens.md`; both accept
the same `-c <config> -r -g` invocation, documented in
`bluemap/README.md`/`bluemap/pipeline.py`). Each is probed independently, and
a failed render names exactly which one is missing — `java-missing`,
`renderer-not-configured`, `renderer-invalid`, `export-failed`,
`spawn-failed` or `render-failed` — with its own recovery route, rather than
one generic failure message.

## Comparing two commits

### Word diff (always available)

`compare.ts`'s `computeWordDiff` reads the 8192-byte Anvil header off every
matching region file for two exported commits and reports which regions
differ and by how many chunks — a real count read from the format's own
chunk-location and chunk-timestamp tables (see `anvil.ts`, verified against
this project's own writer, `src/main/java/game/data/region/McaFile.java`),
never an estimate from file size or modification time. This needs no render
at all and works for any two commits the moment they both exist in the vault.

### Visual comparison (needs both rendered)

Once both chosen commits have a finished render, "Open visual comparison"
starts a short-lived, on-demand webserver for each (the same renderer, `-w`,
each on its own loopback port) and writes a small, self-contained local HTML
page with two iframes and a slider / toggle / side-by-side control, then
opens it with the operating system's default browser. This never happens
inside this application's own window: the renderer's generated web output is
a third-party bundle, this application's Content-Security-Policy refuses
every frame, and loosening it for one feature is out of scope — exactly the
route `../worldlens/panel.ts` already uses for the same family of renderer.

## Disk space

Every render leaves an exported snapshot and a rendered web output on disk
under this application's own data directory. The privileged bridge this
feature is built on (`ctx.studio.fs`) has no delete operation today, so this
feature cannot prune either from inside its own interface; the settings
section links straight to both folders in the file manager instead, so old
renders can be cleared by hand. See `worldvaultrenders.ts` in
`app/src/main/features/` for the efficient, positional-read region-diff
implementation waiting for a delete-capable, dedicated IPC channel.

## How it works

### Files

| File | Owns |
| --- | --- |
| `anvil.ts` | Pure Anvil region-header parsing and diffing. No I/O. |
| `regionReader.ts` | Reads one region file's header through `studio.fs.readBase64`. |
| `vaultLink.ts` | The one import from `../world-vault`: commits and the export operation. |
| `probe.ts` | Detects Java and validates the configured renderer path. |
| `renderConfig.ts` | Writes the renderer's configuration folder; detects present dimensions. |
| `logParsing.ts` | Reads progress/listening/error lines from the renderer's console output. |
| `queue.ts` | `RenderQueue` — the bounded, cancellable, resumable render queue. |
| `compare.ts` | The word diff and the visual-comparison serve/HTML generation. |
| `store.ts` | Setting ids, persisted-record cap, and on-disk directory layout. |
| `panel.ts` | The tab: queue list, comparison panel, disk-usage section. |
| `docs.ts`, `strings.ts`, `styles.css`, `index.ts` | Registration, copy and styling. |

### Verification

`app/tests/unit/world-vault-renders.test.ts` exercises the Anvil parser and
diff against hand-built header buffers, the queue's concurrency/cancel/retry
behaviour, and the honest-absence guarantee. Because being wrong here is
silent — a mis-parsed header just reports a slightly wrong number, and a
queue bug just shows the wrong commit's status — both are covered with
adversarial cases: a truncated header, a fully-empty header, headers that
differ only in one slot, and a queue asked to run more jobs than its
concurrency limit allows.
