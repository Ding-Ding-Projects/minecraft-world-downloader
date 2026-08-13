# Application logo customization

> Shipped vector marks plus an image of the user's own, converted entirely on the local
> machine into the exact display sizes the desktop application draws. Bounded, byte-verified
> and presentation-only: it never moves the installed identity.

## What it does

The desktop application draws a mark beside its name in the title bar. This feature lets the
user choose which mark that is.

Two kinds of mark exist:

- **Shipped marks** — seven original vector designs authored for this project (`block-download`,
  `world-arrow`, `chunk-grid`, `compass`, `map-pin`, `region-stack`, `monogram`). Each is drawn
  as inline SVG geometry that inherits the application's Material Design 3 colour roles, so a
  shipped mark follows the user's seed colour, contrast level and theme rather than sitting in
  the chrome as a fixed-colour rectangle.
- **The user's own image** — a local PNG, JPEG, WebP or BMP file, inspected at the byte level,
  decoded under a time budget, cropped and framed by the user, then rasterized into seven
  square PNG variants (16, 24, 32, 48, 64, 128 and 256 pixels), each one verified before it is
  allowed to become the active mark.

The feature also provides the framing controls that decide how a custom image occupies its
square: a crop rectangle, a fit mode, a focal point, an optional background colour, corner
rounding and a safe-area guide.

## The boundary this feature exists to hold

**A logo is presentation. Choosing one changes what the user looks at and nothing else.**

The package identity, application id, executable filename, installer identity, update feed and
application data directory all come from the build and from `studio.info`. No code path in this
feature writes any of them. The rule is enforced by construction — `state.ts` reads
`window.studio.info` and never writes it — and it is made checkable rather than merely asserted:
the logo tab prints the package identity, the shipped product name, the version and the data
directory beside the picker, so the user can watch those values stay identical across a change.

The reason is concrete. An application whose data directory were derived from its presentation
would orphan every stored profile, credential and history entry the first time somebody changed
their mind about an icon.

## How it works

### 1. Byte inspection — `imageBytes.ts`

Nothing trusts a file extension or a MIME claim. The picker returns a path; the path says
nothing about the contents. So the bytes are read through the privileged bridge
(`studio.fs.readBase64`, itself bounded), and the container is identified from its own
signature:

| Container | Detection | Dimensions read from |
| --- | --- | --- |
| PNG | 8-byte signature | `IHDR`, with a chunk walk for `acTL` and `tRNS` |
| JPEG | `FF D8 FF` | the first `SOFn` frame header, walking markers and fill bytes |
| WebP | `RIFF`…`WEBP` | `VP8X`, `VP8 ` or `VP8L`, with `ANIM`/`ANMF` and `ALPH` noted |
| BMP | `BM` | `BITMAPCOREHEADER` or `BITMAPINFOHEADER` |

Refused by name, with the reason stated:

- **Animated PNG, animated WebP and every GIF** — the output is seven fixed still images, so an
  animation has nowhere to go.
- **SVG and other markup** — an SVG is a document that can carry scripts and references to other
  files, and none of that belongs in a logo pipeline.
- **Icon containers (`.ico`, `.cur`) and TIFF** — these hold several images at once.
- **Anything else** — the first bytes match nothing on the allow list.

### 2. Bounds

Every stage has a hard ceiling with an exact number attached, so a rejection is always
actionable:

| Bound | Value |
| --- | --- |
| Maximum source file | 4 MiB |
| Smallest side | 16 pixels |
| Largest side | 8192 pixels |
| Maximum decoded pixels | 16,777,216 |
| Decode time budget | 10,000 ms |
| Header scan window | 512 KiB |
| Generated variants | 7 |
| Total size of the generated set | 1 MiB |

A decompression bomb is caught before the decoder is ever reached, because the pixel count comes
out of the header rather than out of a decoded bitmap.

### 3. Bounded decode and the self-consistency check

`decodeBounded` races `createImageBitmap` against the time budget, then compares the decoded
dimensions with the ones parsed from the header. A file whose header and decoder disagree is
refused: one of the two is wrong, and neither answer is safe to build a rendering pipeline on.

### 4. Framing — `panel.ts`

The crop rectangle is stored as fractions of the source, so it survives any rescale. It can be
dragged, resized by its four corners, or typed into as four numeric percentage fields — the two
routes write the same value through the same function, so they cannot drift apart. From the
keyboard, focusing a corner and pressing the arrow keys moves it by 1% (5% with <kbd>Shift</kbd>),
and focusing the rectangle itself moves the whole crop.

Fit modes are `contain` (whole cropped image inside the square), `cover` (fills the square,
crops the overflow) and `fill` (stretches, aspect ratio not preserved). The focal point decides
which part survives when the image does not exactly fill the square. Background is transparent
by default; switching transparency off paints the chosen colour behind the image, chosen through
the application's infinite colour picker, with a live contrast readout against the window
surface and a warning below 3:1.

### 5. Conversion and verification — `conversion.ts`

`drawMark` renders one square at one size. **The previews call exactly that function**, so a
preview cannot disagree with the result — a preview drawn by different code from the output is
the one kind of preview worth not shipping.

Each emitted variant is verified four ways before it counts:

1. the PNG signature and `IHDR` chunk,
2. the declared dimensions match the requested size,
3. colour type 6 (RGBA), so transparency survives,
4. a decoder round-trip that reproduces the same dimensions.

A failure at any of those stops the whole conversion and reports which size failed and which
check. **The previous mark stays active**: a half-applied logo is worse than an unchanged one.

### 6. Losses reported before, not discovered after

`describeLosses` computes everything the conversion will change from the header facts and the
current choices alone, so the list is on screen while the user is still deciding:

| Loss | When it applies |
| --- | --- |
| Re-encoded as PNG | The source is not already a PNG |
| Colour profile flattened | JPEG or WebP source; the canvas flattens to sRGB |
| Metadata dropped | Always — EXIF, ICC and text chunks are not carried |
| Transparency removed | Source has alpha and the background is opaque |
| Cropped | The crop is smaller than the whole image, with the exact kept pixel size |
| Aspect ratio not preserved | Fit is `fill` and the cropped area is not square |
| Detail lost at small sizes | Named target sizes smaller than the cropped source |
| Enlarged at large sizes | Named target sizes larger than the cropped source |

## Configuration

All setting ids are prefixed `appLogo.` and are unique application-wide.

| Setting | Kind | Default | Effect |
| --- | --- | --- | --- |
| `appLogo.source` | select | `block-download` | Which mark is drawn. `custom` is refused unless a converted mark exists. |
| `appLogo.showInTitleBar` | switch | `true` | Places the mark in the title bar; off restores the shipped icon and deletes nothing. |
| `appLogo.fit` | select | `contain` | `contain`, `cover` or `fill`. |
| `appLogo.focalX` | slider 0–100 | `50` | Horizontal position when the image does not exactly fill the square. |
| `appLogo.focalY` | slider 0–100 | `50` | Vertical position. |
| `appLogo.backgroundTransparent` | switch | `true` | Keeps the area behind the image transparent. |
| `appLogo.backgroundColour` | colour | `#ffffff` | Painted behind the image when transparency is off. |
| `appLogo.cornerRadius` | slider 0–50 | `0` | Percentage rounding; 50 is a circle. |
| `appLogo.safeAreaGuide` | switch | `false` | Draws a circular-mask guide over the previews only. |
| `appLogo.crop` | stored value | whole image | Edited in the tab, not as a settings row. |
| `appLogo.customRecord` | stored value | `null` | The converted variants and their provenance. |

Two action settings are also registered: **Open the logo editor** (teleports to the tab's upload
section) and **Reset to the shipped mark** (behind the two-key destructive gate).

## Privacy

- **No network request is made at any stage.** No upload, no CDN, no remote converter, no
  analytics. The window's content security policy closes outbound connections and the privileged
  HTTP bridge is deny-by-default; this feature registers no allow rule because it needs none.
- **The original image is never stored.** Only the generated variants are kept, in the
  application's own settings file. The source path and file name are never persisted, exported
  or recorded.
- **History entries carry metadata only** — source format, source dimensions, which sizes were
  produced, total bytes and which losses applied. Never image data, so the history never becomes
  a second copy of the user's picture in another file.
- **Exports omit the image data on purpose** and say so on the export surface: names, sizes,
  byte counts and verification results only.

The consequence, stated plainly in the editor rather than hidden: re-cropping after a restart
means choosing the file again, because the application deliberately kept no copy.

## Security considerations

- The allow list is short and every entry is a single-frame raster format whose dimensions can
  be measured without decoding. Everything else is refused by name.
- SVG is refused specifically because it is an executable document format, not because it is
  inconvenient.
- The header walk is itself bounded (512 KiB) so a file with a pathological chunk list cannot
  spin the parser.
- Chunk lengths are validated against the real file length before being used as offsets.
- The decode is time-bounded and the result is cross-checked against the header.
- The rendered output is re-parsed from its own bytes and round-tripped through the decoder
  before it is trusted.
- The stored record is re-validated on every read, because a settings file is editable by hand;
  a record that does not validate is treated as absent rather than half-trusted.

## Failure modes

| Situation | Behaviour |
| --- | --- |
| File refused at inspection | Exact reason on the upload status line (`role="status"`) and as a persistent warning notification. Nothing changes. |
| Decode exceeds the time budget | Stopped and reported with the budget in seconds. Nothing changes. |
| Header and decoder disagree on size | Refused, both sizes named. Nothing changes. |
| A variant fails verification | Conversion stops, naming the size and the failed check. The previous mark stays in use. |
| Generated set exceeds the byte budget | Exact total and ceiling reported. Nothing is applied. |
| Stored choice cannot be rendered | The shipped icon is shown and the tab states which choice failed, in a warning style. |
| Title bar element not found | The mark is still saved; the state line and a notification say the screen did not change. |
| No image loaded this session | The crop editor shows an honest empty state with a route to the file picker, and the convert button names the unmet condition. |

## Accessibility, language and layout

- Every string is an i18n key with a five-rung ladder in English and playful Hong Kong Cantonese;
  both humour levels style the voice while pixel sizes, byte counts, formats and colour values
  stay exact.
- Every search field is `createSearchBar`, so it carries the anchored regular-expression builder;
  every dropdown is `components.select`, so it carries its own filter field.
- Both tables carry multi-select, an honestly-scoped select-all (`Select the N shown` versus
  `Select every one of the N`), inverse selection, a live selection summary naming how many
  selected rows the current filter is hiding, and bulk export and bulk re-verification.
- Crop corners are focusable buttons with accessible names and arrow-key operation; the crop
  rectangle is focusable in its own right.
- Status regions use `role="status"` and changes are announced through the shared live region.
- Disabled controls always name the unmet condition in their own tooltip and `aria-description`.
- Wide preview rows scroll inside their own container; the panel never scrolls sideways.
- Removing a converted mark and resetting to the shipped mark both go through the two-key
  destructive-action gate, which names every affected item and what is irreversible.

## School mode

School mode omits the Cantonese, bilingual, humour-level, personal-vocabulary and dim sum
capabilities wherever a surface offers them. This feature offers none of those controls itself —
it has no language selector, no humour slider, no vocabulary control and no dim sum surface — so
there is nothing here for the mode to omit, and no control is merely disabled in its place. The
feature's copy still passes through the shared resolver, so it follows the forced English that
School mode applies application-wide.

## Files

| File | Contents |
| --- | --- |
| `app/src/renderer/features/app-logo/index.ts` | The feature module: settings, palette entries, docs, tab registration, chrome wiring, reset action. |
| `app/src/renderer/features/app-logo/imageBytes.ts` | Bounds, signature detection, header parsing for PNG/JPEG/WebP/BMP, bounded decode. |
| `app/src/renderer/features/app-logo/conversion.ts` | Draw, loss report, variant generation and four-way verification. |
| `app/src/renderer/features/app-logo/presets.ts` | The seven shipped vector marks. |
| `app/src/renderer/features/app-logo/state.ts` | Setting ids, stored record validation, session source, chrome application, identity facts. |
| `app/src/renderer/features/app-logo/panel.ts` | The tab: picker, cropper, framing controls, previews, loss report, both tables. |
| `app/src/renderer/features/app-logo/strings.ts` | The bilingual, five-rung catalogue. |
| `app/src/renderer/features/app-logo/docs.ts` | The two in-application documentation articles. |
| `app/src/renderer/features/app-logo/styles.css` | Feature-prefixed styles, tokens only. |

## Verification

1. Choose each shipped mark in turn; the title bar follows immediately, with no restart.
2. Turn **Show the mark in the title bar** off and confirm the shipped icon returns and nothing
   stored is lost; turn it back on and the chosen mark returns.
3. Rename a text file to `.png` and choose it — it is refused by signature, not by name, and the
   message names the allow list.
4. Choose a GIF and an SVG — each is refused with its own specific reason.
5. Choose a PNG with transparency; confirm the transparency loss notice appears only after the
   transparent background is switched off.
6. Crop with the pointer, then with the numeric fields, then with the keyboard on a corner —
   all three agree, and the crop summary names the kept pixel size.
7. Convert; the progress reports real per-variant progress and every row of the generated sizes
   table reads **Verified**.
8. Re-verify a selection; the reported passed/selected counts match the selection exactly.
9. Export a selection in several formats and confirm no image data appears in the file.
10. Restart; the mark is still in use, and the editor honestly reports that the original image is
    no longer loaded.
11. Compare the package identity, product name, version and data directory printed in the tab
    before and after every change above — all four must be byte-identical throughout.
12. Reset to the shipped mark through the two-key gate and confirm the converted sizes are gone
    from the settings file while the original file on disk is untouched.

## Suggested related articles

- [Accessibility & themes](accessibility-themes.md) — the theme and contrast system whose colour
  roles the shipped vector marks follow.
- [Desktop manager](desktop-manager.md) — the desktop shell whose title bar this feature draws
  into.
