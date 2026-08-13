# Site logo customization

> The documentation site's own equivalent of [Application logo customization](app-logo.md):
> several shipped marks plus a local image of the visitor's own, cropped, framed and safely
> converted entirely in this browser, then applied to every place this site draws its own mark.
> Presentation-only, per-visitor, and never touching the site's name, storage keys or URLs.

## What it does

This site draws a small mark in its header (`.site-brand__mark`), a larger version of the same
mark on the landing page's hero section (`.lp-hero__mark`), and — on the pages that carry one — a
browser-tab favicon. This feature lets a visitor choose what all three actually show, for
themselves, in their own browser.

Two kinds of mark exist:

- **Shipped marks** — six original vector designs (`chunk-arrow`, `compass`, `blocks`, `beacon`,
  `pin`, `monogram`), drawn as inline SVG line geometry using `currentColor`, so a shipped mark
  follows this site's theme, seed colour and light/dark mode automatically. There is no
  conversion pipeline for these at all, because a hand-authored vector has nothing to convert.
- **A visitor's own image** — a local PNG, JPEG or WebP file, inspected at the byte level,
  decoded under a real time budget, cropped and framed by the visitor, then rasterized into three
  verified PNG variants: one 256×256 image shared by the header and hero marks (this site's own
  CSS scales it to whichever of those it is drawn as), and two small favicon images (32×32 and
  16×16) generated separately because a favicon is loaded by the browser as an independent
  resource with no access to this page's styling.

The feature also provides the framing controls that decide how a custom image occupies its
square: a crop rectangle, a fit mode, a focal point, an optional background colour, corner
rounding, and a safe-area guide matching this site's real header rounding (8px on a 28px mark).

## The boundary this feature exists to hold

**A logo is presentation. Choosing one changes what a visitor looks at, in their own browser, and
nothing else.**

The site's name, every `wds.`-prefixed storage key, and every URL this site serves are untouched
by any code path in this feature. Applying a chosen mark works by finding the elements this site
already renders its mark at (`.site-brand__mark`, `.lp-hero__mark`, and `link[rel="icon"]` where a
page carries one) and swapping what is drawn there — it never edits a page's HTML, never renames
anything, and never writes to any storage key outside `logo.selection` and `logo.custom`.

## How it works

### 1. Byte inspection

Nothing trusts a file's extension or the browser's MIME guess. The first 64 KiB of the chosen
file are read and matched against the real container signatures:

| Container | Detection | Dimensions read from |
| --- | --- | --- |
| PNG | 8-byte signature | `IHDR`, with a bounded chunk walk for `acTL` (animated PNG) |
| JPEG | `FF D8 FF` | the first `SOFn` marker, walking segments within the read window |
| WebP | `RIFF`…`WEBP` | `VP8X` (with its animation flag), `VP8 ` or `VP8L` |

Refused by name, with the reason stated on the status line and in a notification:

- **Animated PNG, animated WebP, and every GIF** — the output is always exactly one still image.
- **SVG and other XML documents** — a document format that can carry scripts has no place in a
  logo pipeline.
- **ICO, CUR, TIFF, PDF, BMP** — recognised by signature and refused by name rather than by a
  generic "unsupported format" message.
- **Anything else** — the first bytes match nothing on the allow list.

### 2. Bounds

| Bound | Value |
| --- | --- |
| Maximum source file | 4 MiB |
| Header scan window | 64 KiB |
| Smallest accepted side | 16 pixels |
| Largest accepted side | 8192 pixels |
| Maximum decoded pixels | 16,777,216 |
| Decode time budget | 10,000 ms |
| Generated variants | 3 (256, 32, 16) |
| Generated set byte budget | ~300 KB of PNG data |

Where the container format allows it, pixel dimensions are read directly from the header before
any decode is attempted, so an oversized image is refused before the decoder ever sees it.

### 3. Bounded decode and the self-consistency check

`createImageBitmap` (or an `<img>` plus `decode()` where that API is unavailable) races the time
budget. The decoded dimensions are then compared against whatever the header parse already found;
a file whose header and decoder disagree is refused, because neither answer is safe to build a
raster pipeline on.

### 4. Framing

The crop rectangle is stored as fractions of the source image, so it survives any rescale of the
on-screen editor. It has three routes, all writing the same state, so none of them can disagree
with another:

- **Pointer drag** — dragging the rectangle body moves it; dragging one of its four corner
  handles resizes from that corner.
- **Keyboard** — focusing the rectangle and pressing the arrow keys moves it by 1% (5% with
  <kbd>Shift</kbd>); focusing a corner handle and pressing the arrow keys resizes from that
  corner by the same steps.
- **Numeric fields** — four percentage fields (left, top, width, height) that read and write the
  identical crop state.

Fit modes are `contain` (the whole cropped image inside the square), `cover` (fills the square,
crops the overflow using the focal point to decide which part survives) and `fill` (stretches,
aspect ratio not preserved). Background is transparent by default; switching transparency off
paints a chosen colour behind the image, chosen through this site's own infinite colour picker
(`Studio.appearance.colourPicker`), with a contrast check against white and a warning below 3:1.
Corner rounding (0–50%) is baked into the raster output, and an optional safe-area guide overlays
the crop preview with this site's real 8px-on-28px header rounding so a visitor can see what
survives at that shape.

### 5. Conversion and verification

Each of the three variants is drawn fresh at its own target size (never produced by downscaling a
single larger canvas), converted to a PNG data URL, then verified before it is trusted:

1. the data URL carries the `data:image/png;base64,` signature;
2. it decodes through a real `Image` element;
3. the decoded width and height match the requested size exactly.

A failure at any size stops the whole conversion, names which size and which check failed, and
**keeps the previous mark active** — a half-applied logo is worse than an unchanged one. Only
after every variant passes does the record get written to storage and applied to the page.

### 6. What the panel discloses before conversion runs

A live list, updated as the framing controls change, states exactly what the conversion will do —
re-encoding to PNG (always, since a canvas re-render always happens), transparency removed
(whenever the background is not transparent), cropping (whenever less than the whole source is
kept, with the exact kept percentage), and aspect ratio not preserved (whenever `fill` is chosen
against a non-square crop). This is visible on screen while the visitor is still deciding, not
discovered afterwards.

### 7. Applying it live

`applyToPage()` finds every `.site-brand__mark` and `.lp-hero__mark` on whichever page included
this script, and — for a chosen preset or a converted custom image — hides the original element
and inserts a replacement (an inline SVG for a preset, an `<img>` for a custom image) carrying the
same class list, so this site's own CSS sizes it exactly as it sized the original. The original
element is hidden, never removed, so reverting to the shipped mark is instant. Where the current
page carries a `<link rel="icon">`, its `href` is updated the same way (baking the current theme
colours into an SVG data URI for a preset, or using the generated 32px PNG for a custom image),
with the original href restored on reset.

## Configuration

Two storage keys, both under this site's shared `wds.` prefix:

| Key | Kind | Default | Contents |
| --- | --- | --- | --- |
| `logo.selection` | stored value | `{ kind: 'shipped' }` | `{ kind: 'shipped' }`, `{ kind: 'preset', presetId }`, or `{ kind: 'custom' }` |
| `logo.custom` | stored value | absent | The three generated PNG data URLs, the source format, and the framing choices that produced them |

Two actions are reachable everywhere this script is loaded: **Customize the site logo** in the
command palette (`Ctrl+Shift+F`), which opens the full editor in a non-modal, draggable, resizable
overlay; and **Customize this logo…** on the right-click menu of the header mark itself. Both are
attached at runtime and require no change to any page's markup.

## Privacy

- **No network request is made at any stage.** No upload, no CDN, no remote converter. The
  feature's own privacy note is stated on its "About this" tab in the same words.
- **The original image is never stored.** Only the three generated, verified variants are kept,
  in this browser's own local storage. The source file's name is never read into any stored or
  exported value.
- **History entries carry metadata only** — `logo.selection`, and for a custom image the source
  format — never the image data itself, exactly like every other history entry this site records.
- **Everything lives in local browser storage**, exactly where a desktop application would use an
  operating-system credential vault or an application-data folder — this site has neither, so it
  uses `localStorage` under the `wds.` prefix and says so on the "About this" tab. Clearing this
  site's storage resets this feature along with everything else; there is no separate reset route
  to remember.

## Security considerations

- The allow list is three single-frame raster formats whose dimensions can be read, in the cases
  that matter, without a full decode.
- SVG is refused specifically because it is an executable document format, not because it is
  merely inconvenient.
- The header scan is itself bounded (64 KiB) so a file with a pathological chunk list cannot spin
  the parser.
- The decode is time-bounded and its result is cross-checked against whatever the header parse
  found.
- The rendered output is re-parsed from its own bytes (decoded through a real `Image` element)
  and its dimensions checked before it is trusted.
- The stored record is read back through the same store as every other setting; a corrupted or
  unrecognised record is treated as absent (falling back to the shipped mark) rather than
  half-trusted.

## Failure modes

| Situation | Behaviour |
| --- | --- |
| File refused at inspection | Exact reason on the upload status line (`role="status"`) and as a persistent error notification. Nothing changes. |
| Decode exceeds the time budget | Stopped and reported with the budget in seconds. Nothing changes. |
| Header and decoder disagree on size | Refused, both sizes named. Nothing changes. |
| A variant fails verification | Conversion stops, naming the size that failed. The previous mark stays in use. |
| Generated set exceeds the byte budget | The exact character total and the ceiling are reported. Nothing is applied. |
| Stored selection references data that no longer exists | Silently and safely falls back to the shipped mark rather than showing nothing. |
| No image loaded yet | The crop editor stays absent; the "Generate and apply" button is disabled with the unmet condition in its own tooltip. |

## Accessibility, language and layout

- Every string is an i18n key with a five-rung ladder in English and playful Hong Kong Cantonese;
  both humour levels style the voice while pixel sizes, byte counts, formats and percentages stay
  exact.
- The preset search is `Studio.createSearchBar`, so it carries the site's anchored regular
  expression builder like every other search field on this site.
- Crop corners are focusable buttons with accessible names and arrow-key operation; the crop
  rectangle itself is focusable and arrow-key operable. The four numeric percentage fields are a
  fully keyboard- and screen-reader-operable equivalent route to the same state, so the pointer
  drag handles are a precision convenience layered on top of a route that never depends on
  pointer accuracy.
- The panel is organised into the site's shared tab strip (Presets, Your own image, About this),
  carrying that component's full contract — reordering, the tab search, and everything else — and
  the wide crop stage sits inside its own `.scrollx` container so nothing forces the page to
  scroll sideways at narrow widths.
- Status changes use `role="status"` with `aria-live="polite"`.
- The "Generate and apply" button names its unmet condition in its own tooltip when no image has
  been chosen yet, rather than being disabled with no explanation.
- Removing a custom image and resetting to the shipped mark both go through this site's shared
  destructive-action confirmation (`Studio.confirm`), naming the action and stating plainly that
  the change is presentation-only and reversible.

## School mode

This feature offers no language selector, no humour slider, no vocabulary control and no dim sum
surface of its own, so there is nothing here for School mode to omit. Its copy passes through the
shared i18n resolver like everything else on this site, so it follows the forced English School
mode applies site-wide without any code of its own.

## Files

| File | Contents |
| --- | --- |
| `site/assets/logo.js` | The whole feature: byte sniffing, bounded decode, crop/fit/focal/background/corner composition, the six shipped presets, live-apply to the header, hero and favicon, the mount()-based panel, and command-palette/context-menu registration. |
| `docs/features/site-logo.md` | This article. |

## Verification

1. `node --check site/assets/logo.js` — syntax.
2. A Node `vm`-based DOM shim boots the module (`Studio.ready` fires, `S.i18n.define` accepts
   every entry with exactly five English and five Cantonese variants), calls `mount(host)` to
   build the full panel including every tab, applies a preset and reverts to the shipped mark,
   and destroys the panel — all without throwing.
3. Choose each shipped preset in turn on a real page that includes this script; the header mark,
   the landing-page hero mark, and the favicon (where the page has one) all follow immediately,
   with no reload.
4. Rename a text file to `.png` and choose it — refused by signature, not by name, naming the
   allow list.
5. Choose an animated PNG, an animated WebP and a GIF — each refused with its own reason.
6. Crop with the pointer, then with the keyboard on a corner, then with the numeric fields — all
   three agree, and the live loss list updates to match.
7. Choose `Fill and crop` fit with a non-square crop and confirm the "aspect ratio not preserved"
   notice appears only then.
8. Switch transparency off, choose a low-contrast background colour and confirm the contrast
   warning appears; choose a high-contrast one and confirm it does not.
9. Generate; confirm all three sizes report as applied and the header/hero/favicon all change.
10. Reload the page; the chosen mark is still in use, sourced only from local storage.
11. Remove the custom image through the confirmation gate; the shipped mark returns and
    `logo.custom` is gone from storage.
12. Clear this site's storage entirely and confirm this feature resets along with everything
    else, with no separate reset route needed.
13. Open the editor from the command palette (`Ctrl+Shift+F`) and from the header mark's own
    right-click menu; both reach the same panel.

## Suggested related articles

- [Application logo customization](app-logo.md) — the desktop application's equivalent feature,
  covering the same crop/fit/framing contract against the title-bar mark.
- [Accessibility & themes](accessibility-themes.md) — the theme and contrast system the shipped
  presets and the background-colour contrast check both follow.
- [App identity](app-identity.md) — the boundary between presentation and installed identity that
  this feature's own boundary section mirrors for the site.
