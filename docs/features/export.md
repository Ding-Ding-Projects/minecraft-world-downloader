# Export, archives, and the Visual Studio Code handoff

**Module:** `app/src/renderer/features/export/`
**Inventory rows:** 6.5 (export in every format), 6.6 (ZIP and 7z with the full 7z option set), 6.9 (Visual Studio Code as the first-class target for every export).

`core/export.ts` owns the ten interchange writers. This feature owns the place a person actually
goes to take something away: the catalogue of what can be exported, the per-datum format choice,
the loss report shown before anything is written, the archive support, and the one action that
lands the result in Visual Studio Code.

---

## Behaviour

### What can be exported

If a surface can show it, it can be taken away. The feature ships these sources and any other
feature can register its own:

| Category | Source | Shape | Deliberate omissions |
| --- | --- | --- | --- |
| Settings | Settings and their values | tabular | Local caches; every credential |
| Settings | Settings inventory | tabular | — |
| History | Local version history | structured | Whatever the history itself already redacts |
| History | History actions and counts | tabular | — |
| History | History repository status | structured | — |
| Notifications | Notification centre | tabular | — |
| Navigation | Open tabs · Tab groups · Command palette entries | tabular | — |
| Documentation | Documentation index | tabular | — |
| Documentation | The whole documentation | prose | — |
| Appearance | Theme state · Appearance overrides and presets | structured | — |
| Appearance | Toy locks | tabular | Every credential, hash and hint |
| Security | Credential vault account keys | tabular | Every secret value and every property of one |
| System | Application information · Outbound network rules · Child processes · Detected editors · Installed features | tabular / structured | — |
| Export | Export format catalogue | tabular | — |

**No secret is ever exported.** The vault contributes account *keys* — not a value, not a length,
not a hash. That source is additionally marked sensitive, which surfaces a warning badge on its row
and names it in an archive manifest.

The omission line is written for the mode the application is actually in. While School mode is on,
suppressed capabilities are not named: an omission notice reading "the personal-vocabulary cache is
not included" would announce the existence of a capability that is meant to behave as though it
were not installed.

### Formats, chosen per datum

Fifteen formats, and which of them a row offers depends on the shape of its data:

| Family | Formats | Carries nesting |
| --- | --- | --- |
| Interchange | JSON, JSONL/NDJSON, YAML, TOML, XML | yes |
| Tabular | CSV, TSV, SQL | no |
| Human | Markdown, HTML | no |
| Language source | TypeScript, JavaScript (ESM), Python, Go | yes |
| Schema | JSON Schema | describes the shape and contains none of the records |

A format that would misrepresent a shape is not offered for it. Where a format *can* be used but
cannot carry a field faithfully, the exact fields and reasons are reported **before** the export
runs — in the row preview and again in the result — rather than the column being quietly flattened
into JSON text inside one cell.

The loss report is delegated to `core/export.ts`, the same writer that produces the file, so the
surface and the file can never disagree about it.

### Encoding, line endings, schema version

Every file states all three in its own header. UTF-8 always; LF by default with CRLF on request;
schema version `1`. A UTF-8 byte-order mark is off by default and available for the one case that
needs it — a spreadsheet mangling accented characters in a CSV.

Line endings are normalized to LF before the chosen ending is applied, so a writer that emits CRLF
for its own reasons cannot produce `CR CR LF`.

### Selecting, in bulk

Multi-select with the mouse and from the keyboard. <kbd>Space</kbd> toggles the focused row;
<kbd>Shift</kbd>+<kbd>Space</kbd> and shift-click extend the selection from the last row touched.

A shift range covers only the rows the search is currently showing, so a range never reaches
through hidden rows and selects things the user cannot see.

There are two select-alls carrying their real counts — *Select the N shown* and *Select every
source (N)* — because "all" means two different things the moment a search is active. Inverse
selection and clear complete the set.

The results list carries the same contract: select-all, invert, clear, shift ranges, open the
selected in Visual Studio Code, copy the selected paths, and remove the selected from the list.
Removing from the list deletes no file, and the confirmation says so.

### Running

A run reports real progress — how many of how many, and which source — and stays cancellable.
Cancellation is checked *between* sources, so a cancelled run never leaves half a file behind:
whatever exists is complete. The outcome distinguishes written, skipped, failed and cancelled per
row, and a source that fails to load fails on its own row rather than taking the run down.

Every written file is `stat`'d afterwards. *Written* means the bytes are on the disk, not that a
write call returned without complaining.

### Archives

ZIP and 7z, with the whole 7z option set exposed as real choices:

- **Method** — LZMA2, LZMA, PPMd, BZip2, Deflate, Copy (7z); Deflate, BZip2, LZMA, PPMd, Copy (ZIP)
- **Level** — 0 store, 1 fastest, 3 fast, 5 normal, 7 maximum, 9 ultra
- **Dictionary size** — 64 KiB … 1536 MiB (`-md`, or `-mmem` for PPMd where it is the model memory; for BZip2 it is the block size)
- **Word size** — 8 … 273 (`-mfb`; `-mo` model order for PPMd)
- **Solid** — on/off with a block size from 1 MiB to 64 GiB, or one block for everything (`-ms`)
- **Threads** — off, an explicit count, or the archiver's own choice (`-mmt`)
- **Split volumes** — 10 MiB … 4 GiB, or one file (`-v`)
- **Encryption** — AES-256 (`-p`, plus `-mem=AES256` for ZIP)
- **Encrypted headers** — 7z only (`-mhe=on`), hiding the file names as well as the contents

Each choice states what it costs in time and memory with real figures: the LZMA family needs
roughly 10.5× the dictionary to compress and roughly the dictionary itself to extract, and each
additional compressing thread keeps its own buffers.

A control that cannot apply is disabled **and names the reason**: Deflate has a fixed 32 KiB
window, ZIP compresses each entry separately so has no solid mode, Copy has no dictionary.

### Relative paths, always

Entries are written into one root folder, and the archiver runs with its working directory set to
that folder's *parent* and is handed the root's bare name. No entry can therefore carry a drive
letter, a leading separator, or a `..` segment, and extracting the archive cannot write outside the
directory it is extracted into. `safeRelativePath` additionally strips reserved characters, control
characters, and trailing dots and spaces — two entry names that differ only by a trailing dot would
otherwise collapse into one file on Windows, silently overwriting each other.

A `MANIFEST.md` goes into the archive naming every entry, what it is, and exactly how the archive
was made.

---

## Configuration

All settings live under `export.` and are rendered by the core settings surface, so each carries
its progressive-disclosure explanation and its truthful default-provenance line automatically.

| Setting | Default | What it does |
| --- | --- | --- |
| `export.defaultFormat` | `json` | Format a row starts on; a row whose shape cannot use it starts on the closest one that can |
| `export.lineEndings` | `lf` | LF or CRLF, stated in every file header |
| `export.byteOrderMark` | `false` | Writes a UTF-8 BOM |
| `export.destination` | *(empty)* | Destination folder; empty means the export asks each time |
| `export.openInEditor` | `false` | Hands every finished export to Visual Studio Code |
| `export.editorId` | *(empty)* | Which of the detected Visual Studio Code family to use |
| `export.archive.name` | `studio-export` | Base name of the archive and of the folder its entries sit under |
| `export.archive.format` | `7z` | ZIP or 7z |
| `export.archive.method` | `LZMA2` | Compression method |
| `export.archive.level` | `5` | 0–9 |
| `export.archive.dictionary` | `16m` | Dictionary size |
| `export.archive.wordSize` | `32` | Word size / PPMd model order |
| `export.archive.solid` | `true` | Solid archive |
| `export.archive.solidBlock` | `4g` | Solid block size |
| `export.archive.threads` | `on` | Thread count |
| `export.archive.volume` | *(empty)* | Volume size, empty for one file |
| `export.archive.encryptHeaders` | `true` | Encrypt file names in 7z archives |
| `export.archive.command` | *(empty)* | Bare archiver command tried before the built-in list |

The archive password is **not** a setting. It is held in memory for the length of one run and is
never written to the settings file, the version history, a log, an export, or a screenshot.

### Registering another feature's data

```ts
import { registerExportSource } from '../export';

registerExportSource({
  id: 'my-feature-records',
  name: 'My feature records',
  description: 'What these records are, in one line.',
  category: 'My feature',
  shape: 'tabular',
  omits: () => 'Nothing.',
  async load(ctx) {
    return { kind: 'records', records: await readMyRecords(ctx) };
  }
});
```

A feature that would rather not import this one can push the same object onto
`globalThis.studioExportSources`; the queue is drained on the next listing.

---

## Failure modes

| Failure | What the surface does |
| --- | --- |
| A source cannot be read | Its row shows the exact reason; the run marks that one row failed and continues |
| The destination folder does not exist | It is created; a failure to create it stops the run with the exact error |
| A target file already exists | The two-key destructive-action gate opens with the exact list of paths and states that the previous contents cannot be brought back |
| The write reports success but no file exists | The row fails with "the write reported success but no file exists at that path" |
| The run is cancelled | Reports how many of how many were written, and that those files are complete |
| No archiver can be started | The banner reports the bridge's exact refusal and every command that was tried, and offers *Write the archive contents as a folder instead* with the exact command line to run yourself |
| The archiver runs and fails | The exit code and the archiver's own output are shown; no archive is claimed |
| The archiver never exits | Given up on after ten minutes and reported as such, rather than spinning |
| Encryption selected with no password | The create button is disabled naming that exact condition; nothing is written |
| Visual Studio Code is not installed | Says so, names what was looked for, offers the download page — and opens nothing else |

The staged folder is left in place beside a created archive: this application has no route to
delete a file, and the surface says so rather than implying the folder was cleaned up.

---

## Security considerations

- **No secret is exported.** The vault contributes account keys only. Nothing here reads, displays,
  or characterises a stored secret's value, length, or composition.
- **The archive password never persists.** It exists in memory for one run. It is redacted to
  `********` in the displayed command line, the manifest, and every history entry. The surface
  states plainly that the password reaches the archiver on its command line and that on a shared
  machine another process could read that command line while the archive is being written — a
  guarantee that cannot be made is not made.
- **An encrypted archive is never described as protected while its names are in the clear.** ZIP
  cannot encrypt its central directory, so with ZIP selected the encrypt-names control is disabled
  with that exact reason and the surface says the names inside stay readable.
- **Extraction cannot escape.** Entries are relative-only, under one root, with reserved and
  control characters stripped.
- **No network at runtime.** The only outbound action is `shell.openExternal` to the Visual Studio
  Code download page, on an explicit click, in the user's own browser.
- **No archiver path injection.** The privileged bridge refuses a filesystem path as a command and
  the archiver setting validates that before it is stored; arguments are passed as an array, never
  through a shell.

---

## Verification

Typecheck: `npm run typecheck` in `app/` (this feature is clean under `tsconfig.web.json`).

What to exercise by hand in the built application:

1. **Sources** — every row shows a record count or an honest read failure; the search filters; the
   two select-alls report different counts while a search is active; shift-click and
   <kbd>Shift</kbd>+<kbd>Space</kbd> both extend a range over visible rows only.
2. **Formats** — a tabular source offers CSV; a prose source does not; the preview of a structured
   source in CSV lists the exact nested fields that will be flattened.
3. **Encoding** — export the same source as LF and as CRLF and compare the bytes; turn the BOM on
   and confirm `EF BB BF` leads the file.
4. **Overwrite** — export twice into the same folder; the second run opens the two-key gate with
   the exact paths, and cancelling it writes nothing.
5. **Cancellation** — select every source, start, cancel; the files already written are complete
   and the count reported matches what is on disk.
6. **Archives** — switch to ZIP and confirm the solid and encrypt-names controls disable with their
   reasons; switch to 7z with encryption off and confirm encrypt-names disables with a different
   reason; change method to Copy and confirm the dictionary disables.
7. **The archiver** — the banner reports either the command that answered or the exact refusal; the
   folder fallback writes the same entries at the same relative paths with a manifest.
8. **Visual Studio Code** — with it installed, a result row opens the file and the folder opens as
   a workspace root; with it absent, the banner says so and offers the download rather than opening
   another editor.
9. **Accessibility** — reach every control by keyboard with a visible focus ring; confirm the
   selection count and the run result are announced; check the surface at 100/125/150/200% display
   scale in bilingual mode with no clipping and no sideways page scroll.

---

## Suggested related articles

- [Local version history](./history.md) — where every export is recorded, and what a redacted
  payload contains.
- [Settings](./settings.md) — how the explanation and default-provenance line beside each `export.`
  setting is produced.
- [Toy locks](./locks.md) — the source whose export deliberately carries no credential of any kind.
- [The in-application documentation browser](./docs-browser.md) — where this feature's four bundled
  articles are read offline.

In the application itself, read **The export surface**, **Formats, encoding and what a format
cannot carry**, **ZIP and 7z archives** and **Opening an export in Visual Studio Code**, all under
the *Data* category.
