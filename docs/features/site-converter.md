# The documentation site's file converter

> A categorized, searchable adapter catalog across all eight required categories, running entirely
> inside the visitor's browser. Four adapters genuinely work offline with nothing to fetch: image
> raster conversion, structured-data conversion, text-encoding and line-ending conversion, and
> binary-to-text encodings. Everything else — PDF, audio, video, archives, office documents,
> spreadsheets — is listed and visibly disabled with the exact missing capability, never hidden.

Owned by `site/assets/converter.js` (the logic, registered as `window.StudioConverter`) and
`site/converter.html` (the page). It is a sibling of the desktop application's own universal file
converter, not a replacement for it: this article covers the **site's** implementation only, which
is why it is named `site-converter.md` rather than `converter.md`. See the desktop application's own
converter documentation for the offline-first, unbounded version that ships inside the installed
app.

**Inventory rows:** 11.1 (categorized, searchable adapter catalog across all eight categories), 11.2
(enabled means bundled, offline and sandboxed to this page), 11.3 (PDF tools — see "Why PDF is
disabled here" below for the honest reason this row is intentionally unmet on the site), 11.4 (a
bounded, chunked queue rather than an unbounded one, stated plainly).

---

## Why a website converter is different from the desktop one

The desktop application can bundle real decoder libraries, spawn processes, and hold an unbounded
queue backed by disk. A static GitHub Pages site cannot: it ships no build step, no bundler, and no
third-party dependency, and it can make exactly one network request in the whole product (the
optional dim sum dish photo). Given that, this feature draws the line the contract itself draws:
**enabled means it genuinely works here, offline, with no dependency to fetch.** Where that line
falls short of "convert absolutely anything", the feature says so, in the interface, by name.

## What is enabled, and why those four

| Adapter | Category | What it actually does |
| --- | --- | --- |
| Image (resize and convert) | Images | Decodes any image this browser's own `<canvas>`/`createImageBitmap` can decode (PNG, JPEG, GIF, WebP, BMP, ICO, SVG among others) and re-encodes to PNG, JPEG or WebP, with optional resizing. |
| Structured data | Structured data and spreadsheets | Converts among JSON, JSON Lines, a documented YAML subset, CSV, TSV, and a generic XML mapping. |
| Text encoding and line endings | Code and text | Re-encodes text between UTF-8, UTF-16LE, UTF-16BE and Windows-1252, and rewrites line endings between LF, CRLF and CR. |
| Binary-to-text encodings | Binary encodings | Converts a file's bytes to and from Base64, Base64url, hex, URL percent-encoding and quoted-printable. |

Every one of these is implemented as real, hand-written or browser-native logic in
`site/assets/converter.js` — not a stub, and not a call to a service. The binary codecs, the
delimited-text (CSV/TSV) reader and writer, the documented YAML subset, and the small XML parser are
all written from scratch in plain JavaScript specifically so they need nothing beyond the JavaScript
engine itself; image conversion uses the browser's own `<canvas>`, which is a real, standard,
zero-dependency API.

### The documented YAML subset

Supported: block mappings and sequences with space indentation, the `- key: value`
sequence-of-mappings shorthand, plain, single- and double-quoted scalars, flow lists (`[a, b]`) and
flow maps (`{a: 1}`), booleans, `null`/`~`, integers and floats, and `#` comments outside quotes.

**Not supported, and rejected with a line-numbered error rather than silently misread:** anchors and
aliases (`&`/`*`), tags (`!!`), multiple documents, and block scalars (`|` and `>`). A tab used for
indentation is refused by exact line number rather than silently treated as some number of spaces.

### The generic XML mapping

XML has no natural one-to-one mapping onto JSON, so this feature is explicit about the one it uses.
Reading XML produces `{ tag, "@attrs", text, children }` recursively; writing XML from arbitrary data
rewrites property names that are not valid XML element names (letters, digits, `.`, `-`, `_` only)
and turns a list into repeated elements sharing their property's name — which cannot be told apart
from a single value once written back out. Both directions disclose this before the conversion runs.

### Type detection

The extension is never trusted alone. Every file's first up to 512 bytes are read and matched
against real magic numbers (PNG, JPEG, GIF, WebP, BMP, ICO, TIFF, ZIP-family, gzip, 7-Zip, RAR, WAV,
OGG, MP3, FLAC, MP4/MOV, Matroska/WebM, AVI, PDF, the OLE compound-file header used by legacy Office
formats, and RTF). A file with no matching magic number falls back to a best-effort text-format
guess, which itself requires the sampled bytes to decode as strict, valid UTF-8 with a low
control-character ratio before it will call anything "text" — six raw bytes of noise are reported as
unidentified, not mislabelled as plain text.

## What is disabled, and exactly why

Every disabled row names the *exact* missing capability rather than a vague "unsupported":

| Category | Adapter | Exact reason shown in the interface |
| --- | --- | --- |
| Documents and PDF | PDF inspect/split/merge/extract/reorder/rotate/metadata | No bundled PDF decoder ships with this static page; a real PDF library would need a build step, a third-party dependency, or a network fetch. |
| Documents and PDF | PDF pages to and from images | Needs a PDF renderer and a PDF writer; neither is bundled. |
| Documents and PDF | Word, RTF, OpenDocument Text, PowerPoint | No bundled office-document reader or writer. |
| Images | Raster to SVG (vector tracing) | No bundled vector-tracing library. |
| Images | Encoding to HEIC/HEIF/AVIF | This browser's own canvas encoder does not offer these output formats. |
| Audio | WAV/MP3/FLAC/OGG/AAC transcoding | No bundled audio codec; playback support in a browser is not an encoder this site can call. |
| Video | MP4/WebM/MOV transcoding, video to GIF | No bundled video codec, same reason as audio. |
| Archives | ZIP/7-Zip/TAR/gzip create and extract | No bundled archive codec. |
| Structured data | XLSX/ODS spreadsheet reading and writing | No bundled spreadsheet decoder; use the CSV or TSV adapter as the offline substitute. |
| Code and text | Source-code formatting and minification | No bundled formatter or minifier; these are large tools in their own right. |
| Binary encodings | Uuencode, yEnc and other legacy schemes | Not implemented; rarely used today, and Base64/hex/percent-encoding/quoted-printable above cover the common cases. |

Every one of these rows is real, visible, and permanently in the catalog — never hidden, and never a
control that looks live and silently does nothing. Each carries a disabled native `<button>` with the
reason in its own `title` attribute and in the adjacent description text, matching the site runtime's
existing convention for a disabled menu item's `disabledReason`.

### Why PDF is disabled here

Inventory row 11.3 asks for PDF inspect/split/merge/extract/reorder/rotate/metadata with post-write
reopen validation. A static page with no build step and no bundled dependency has no way to meet that
row honestly — the alternative would be silently downloading a PDF library from a CDN at runtime,
which the site's own network policy forbids outright (the only permitted network request on this
whole site is the optional dim sum photo). Rather than fake it or quietly skip the row, this feature
lists the exact PDF capability, marks it unavailable, states the exact reason, and points at the
desktop application, which bundles a real, offline PDF toolkit with none of these constraints. That
is the "closest accessible, testable equivalent" the contract asks for when a rule genuinely cannot
apply to a static page.

## Lossy and metadata-changing disclosure

Before any conversion that can change or omit something, the feature shows the exact list of changes
and requires an explicit "Convert anyway" action — never a silent default. Examples:

- **Image → JPEG:** "Transparency will be flattened onto a white background, because JPEG cannot
  store an alpha channel."
- **Quality below 100%:** the exact percentage, and that it cannot be undone.
- **Resize enabled:** the exact target dimensions.
- **Animated source:** only the first frame is kept; none of the enabled output formats store
  animation.
- **Any conversion touching YAML:** the exact documented subset and its exact omissions.
- **Any conversion touching XML:** the exact generic mapping and its exact reversibility limits.
- **CSV/TSV as a target:** a nested value is written as its own JSON text inside one cell.
- **CSV/TSV as a source:** every cell is read as text unless it is exactly `true`, `false`, or a
  plain number.
- **Re-encoding text, or targeting Windows-1252:** which characters can change or become `"?"`.
- **Rewriting line endings:** the exact bytes of the file change even where the text looks the same.

The disclosure list is recomputed live as the visitor changes options, and again at the moment
"Convert" is pressed, so a stale disclosure can never wave through a conversion whose settings have
since changed.

## Bounds — a browser tab is not a server

FEATURE_INVENTORY row 11.4 asks for an unlimited-length queue with paged discovery and constant-
memory backpressure. This page is honest that it does not offer that: a browser tab that runs out of
memory takes the whole page down with it, so this feature draws a real, stated bound instead and says
so plainly in its own interface, rather than claiming an unbounded queue it cannot actually provide.

| Category | Per-file bound | Per-batch bound |
| --- | --- | --- |
| Images | 60 MB | 300 MB |
| Structured data | 20 MB | 150 MB |
| Code and text | 20 MB | 150 MB |
| Binary encodings | 12 MB | 80 MB |

At most 40 files may be queued at once. Every read happens through the File `ReadableStream` API in
1 MiB chunks (`readFileBoundedChunks` in `converter.js`), so a file that turns out to exceed its bound
partway through stops being read immediately — the bound is checked cheaply against `file.size`
before any byte is read, and again against bytes actually received as they stream in, so a
misreported size cannot smuggle an oversized file into memory. Up to two files convert concurrently.
Every queue row can be cancelled individually or as a whole batch, with real per-file progress
reported from the chunked read and, for images, from the encode step.

The desktop application's converter carries the genuinely unbounded, paged, constant-memory queue
row 11.4 describes; this page's bounded queue is the closest honest, testable equivalent a browser
tab can offer.

## The source is never modified

Every adapter reads the source file and produces a new output; nothing here writes back to the
original. The result is offered as a real browser download (`URL.createObjectURL` plus a synthetic
`<a download>` click), which the visitor saves deliberately — there is no silent auto-save and no
attempt to replace the file the visitor picked.

## Everywhere the shared runtime carries the feature

This page reuses the shared site runtime (`site/assets/site.js`) rather than reimplementing any of
it:

- **Eight categories, each with its own search bar and anchored regular-expression builder**
  (`Studio.createSearchBar`), filtering that category's adapter rows — enabled and disabled alike —
  by name, description and keywords.
- **`Studio.collapse.attach`** for each category section, persisted per visitor.
- **`Studio.bulk.attach`** on the pre-conversion file list: multi-select, an honestly-scoped
  select-all, and a bulk remove routed through the destructive-action super-confirmation gate.
- **`Studio.overlay.open`** for the lossy-disclosure confirmation, anchored beside the "Convert"
  button, never a bare `confirm()`.
- **`Studio.notify`** for the batch summary, and **`Studio.history.record`** so every conversion run
  is a recoverable entry in the site's local version history.
- **`Studio.palette.register`** so the page itself, and every one of its features, is reachable by
  name from the command palette (`Ctrl+Shift+F`) from anywhere on the site.
- **`Studio.i18n`**: every user-facing string on this page — labels, empty states, disclosure
  sentences, disabled reasons — is defined with five variants in English and five in playful Hong
  Kong-style Cantonese, exactly as the runtime requires. Adapter names, category names, field labels
  and the disabled-adapter reasons are near-constant technical facts, so they use the same `same()`
  helper the settings page's own tab labels use; the lede, the empty states and the disclosure
  sentences carry the full five-level voice.

## Accessibility and responsive layout

The drop zone is a real `<label>` wrapping a native `<input type="file" multiple>`, so it is
reachable, operable and announced the same way any file input is, with an added keyboard path
(<kbd>Enter</kbd>/<kbd>Space</kbd> while focused opens the file picker) and drag-and-drop as a
convenience layered on top, never a replacement for it. Every disabled adapter row states its exact
reason in both its visible text and its button's `title`, so a disabled control never reads as
broken. Wide content — the file list and the results table — is wrapped in `.scrollx` so the page
body never scrolls sideways at 320 px. All text and controls go through the shared runtime's existing
token-based theming, so both the light and dark themes, and any visitor's own accent colour, reach
this page with no extra work.

## Privacy

No network request happens anywhere in this feature. Every file, every conversion, and every queued
result stays inside the browser tab; nothing is uploaded, and nothing is copied into
`Studio.privacy.networkRequests()`'s report (which only ever lists the optional dim sum photo). A
locally converted file leaves the browser only when the visitor deliberately clicks its own
"Download" button.

## Verification

`node --check site/assets/converter.js` passes. The module was exercised directly in a plain Node.js
process — with a minimal `global.window = global` shim so its final `window.StudioConverter =
StudioConverter` assignment has somewhere to land — covering: type sniffing (real magic numbers, a
valid-UTF-8 text guess, and a rejection of both invalid-UTF-8 and high-control-ratio binary noise);
Base64/Base64url/hex/URL-percent/quoted-printable round trips including every base64 remainder length
against Node's own `Buffer` implementation as a cross-check; UTF-16LE/BE and Windows-1252 text
round trips with an astral-plane character; line-ending conversion; the CSV/TSV reader and writer
including quoted fields, embedded commas and newlines, doubled-quote escaping, header-row coercion,
and nested-value flattening; the YAML subset's block mappings and sequences, the `- key: value`
shorthand, flow lists and maps, quoted scalars, comments, and its rejection of tab indentation; the
hand-written XML parser's attributes, entities, self-closing tags, CDATA, and its rejection of a
mismatched closing tag; the generic XML↔JSON mapping in both directions; JSON Lines round trips
including the non-array wrap-and-warn path; and a structural check that all eight categories carry at
least one adapter, exactly four adapters are enabled with a `buildPanel`, and at least nine are
disabled with a stated reason key. A separate check confirmed all 96 i18n dictionary entries carry
exactly five English and five Cantonese variants with no literal `|` character (which would corrupt
the runtime's own `D()` parser). `site/converter.html`'s inline script was extracted and syntax-
checked the same way, and the file's opening and closing tags were counted and found balanced.
Interactive, in-browser behaviour (drag-and-drop, the confirmation overlay, live progress, an actual
downloaded file) was reasoned through against the shared runtime's documented contracts in
`SITE_API.md` rather than clicked through a real browser, since this task's tools did not include one;
see the module's own inline comments for the exact API calls each interactive path makes.
