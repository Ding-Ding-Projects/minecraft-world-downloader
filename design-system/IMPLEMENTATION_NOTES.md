# Implementation notes

How the files in this bundle map onto the two implementations: the **Electron
desktop application** and the **static documentation site**.

Read `README.md` first for the token contract and the product-wide rules. This file
is the mapping.

---

## 1. Tokens — do this first, for both implementations

Copy `foundations/tokens.css` verbatim into each implementation. Do not fork it, do
not re-declare a token in a component stylesheet, and do not paste a hex value that
appears in it.

| Implementation | Destination | Loaded by |
| --- | --- | --- |
| Electron | `src/renderer/styles/tokens.css` | imported first, before any component style |
| Site | `docs/assets/tokens.css` | linked first in the base layout |

### Token names an implementer will reach for constantly

| Purpose | Token |
| --- | --- |
| Highest-emphasis action | `--md-sys-color-primary` / `--md-sys-color-on-primary` |
| Secondary action, selected tab, selected row | `--md-sys-color-secondary-container` / `--md-sys-color-on-secondary-container` |
| Accent, group headers, informational callouts | `--md-sys-color-tertiary-container` / `--md-sys-color-on-tertiary-container` |
| Destructive, failure state | `--md-sys-color-error` / `--md-sys-color-on-error` |
| Page background | `--md-sys-color-surface` |
| Panel / card background | `--md-sys-color-surface-container-low` |
| Toolbar, tab strip, title bar | `--md-sys-color-surface-container` |
| Filled field background, raised chip | `--md-sys-color-surface-container-highest` |
| Body text | `--md-sys-color-on-surface` |
| Supporting text, inactive icon | `--md-sys-color-on-surface-variant` |
| Boundary line (never text) | `--md-sys-color-outline` |
| Divider (never text) | `--md-sys-color-outline-variant` |
| Toast background | `--md-sys-color-inverse-surface` / `--md-sys-color-inverse-on-surface` |
| Toast action | `--md-sys-color-inverse-primary` |

### The three token families that get misused

**Elevation is a pair.** `--md-sys-elevation-levelN` is only the shadow half. The
tonal half is a `surface-container-*` role, and in dark mode it does nearly all the
work because the shadow is invisible against a near-black background. Never
substitute a white overlay at an alpha — overlays compound when surfaces nest, so a
card inside a dialog inside a sheet drifts three shades off.

**State layers are the role colour at an opacity**, painted over the component —
never a different colour. Use `--md-sys-state-hover-opacity` (0.08),
`--md-sys-state-focus-opacity` (0.10), `--md-sys-state-pressed-opacity` (0.10).
Disabled is 38 percent content on a 12 percent container, both derived from
`on-surface`.

**Motion durations collapse to 1ms under reduced motion, not to 0.** At exactly
zero some browsers never fire `transitionend`, and any state machine waiting on
that event stalls forever — only for the users who asked for less motion. The
`@media (prefers-reduced-motion: reduce)` block in `tokens.css` already handles
this; do not add a second, competing rule.

### Design sizes are pixels

Every size in `foundations/typography.html` is a **pixel** value. If any layer sets
a font in points — some desktop toolkits do — convert explicitly:

```
points = pixels × 72 / 96
```

Passing a design pixel value straight through as points renders every string in the
application about a third too large, uniformly, with the proportions still correct.
That reads to a user as "this app is oversized" rather than as a bug, which is why
it survives review.

---

## 2. Electron application

### Shell

`app/shell.html` is the frame every other screen lives in.

| Part | Spec | Notes |
| --- | --- | --- |
| Window | frameless, `titleBarStyle: 'hidden'` | The OS title bar is never product chrome |
| Title bar | `--wds-titlebar-height` (40px) | The drag region; carries window controls in platform order; close turns `error` on hover |
| Tab strip | `--wds-tabstrip-width` (232px), docked **left** by default | Collapses to `--wds-tabstrip-width-collapsed` (56px) at narrow widths |
| Content header | 64px, does not scroll | Destination name plus a live subtitle |
| Notification host | bottom-right, stacks upward | Never covers the primary action |

Minimum and default window size must be **clamped to about 95 percent of the usable
client area of the display the window opens on**. With per-monitor DPI awareness
the application scales its own pixel constants including the minimum size, and an
unclamped minimum at 150 percent produces a window a small laptop cannot fit — on
that machine only, while a 1080p desktop shows nothing wrong.

### Screen → tab mapping

| Design file | Tab | Position in the strip |
| --- | --- | --- |
| `app/downloader.html` | Downloader | Pinned |
| `app/map.html` | Live map | Pinned |
| `app/server.html` | Containers | Group "Andyville" |
| `app/bot.html` | Chat capture | Group "Andyville" |
| `app/history.html` | Version history | Strip foot |
| `app/settings.html` | Settings | Strip foot |

### Overlay screens — not tabs

| Design file | Trigger | Surface |
| --- | --- | --- |
| `app/palette.html` | <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>F</kbd> | Bounded card, size persisted, full-window option |
| `app/confirm.html` | Any destructive action | Modal — the one deliberate exception to the reserve-modals rule |
| `app/appearance.html` | Right-click → *Edit appearance…*, or <kbd>Shift</kbd>+right-click | Non-modal anchored popover |
| `app/locks.html` | Right-click → *Lock this element…* | Anchored wizard |
| `app/dimsum.html` | 10 percent draw at launch | Non-blocking auto-dismissing card |
| `app/support.html` | Unlock prompt, lock setting, or Help | A destination, reachable from three routes |

### Component anatomy → renderer components

| Design file | Component | Anatomy that is load-bearing |
| --- | --- | --- |
| `components/button.html` | `Button` | 5 variants + icon + FAB + segmented; state layer is a `::after` at the role colour; focus is a 3px `secondary` outline **outside** the shape |
| `components/textfield.html` | `TextField` | Filled and outlined; supporting text is part of the field; error changes border, label, icon and text together |
| `components/select-menu.html` | `Menu`, `Select` | **Filter field at the head plus regex affordance — mandatory in every instance** |
| `components/checkbox-radio-switch.html` | `Switch`, `Checkbox`, `Radio` | Whole row is the 48px target, not the glyph |
| `components/slider.html` | `Slider` | Always renders its value as text; arrows step, Page keys jump, Home/End bound |
| `components/chip.html` | `Chip`, `StatusChip` | Status chip is read-only, never focusable; remove control gets its own 48px target |
| `components/card.html` | `Card` | Outlined is the default; a clickable card must not nest interactive children |
| `components/list.html` | `List`, `ListItem` | Virtualize once rows carry live controls |
| `components/dialog.html` | `Dialog`, `FullScreenDialog` | Focus trapped, returns on close, Escape cancels, headline is the accessible name |
| `components/snackbar.html` | `Snackbar`, `NotificationCentre` | Errors and warnings persist until dismissed |
| `components/tabs.html` | `TabStrip`, `TabGroup` | Vertical strip is `aria-orientation="vertical"` and arrow keys become up/down |
| `components/navigation.html` | `TitleBar`, `TopAppBar`, `NavRail`, `Drawer` | Window controls keep platform order and platform hover behaviour |
| `components/progress.html` | `LinearProgress`, `CircularProgress` | **Linear easing only** — easing a determinate bar makes it lie |
| `components/datepicker.html` | `DatePicker` | Month **and** year jump, range, presets, typed entry in locale format **or** ISO; invalid input is reported inline and kept |
| `components/table.html` | `DataTable`, `BulkActionBar` | Select-all names its own scope; numbers are `tabular-nums` and right-aligned |
| `components/tooltip-badge-divider.html` | `Tooltip`, `Badge`, `Divider` | Badge count goes in the accessible name; capped display must not cap the announced value |
| `components/colorpicker.html` | `ColorPicker` | Continuous wheel + SV field + numeric entry; 14-format translator; gamut warning **before** commit; live contrast readout |
| `components/fontpicker.html` | `FontPicker` | Each family name rendered in its own face; size is stepper **and** free entry; unsupported properties stay visible and keep their value |
| `components/searchbar.html` | `SearchBar`, `RegexBuilder` | Builder is anchored to its own field; each field owns its own state |

### Behaviour that spans components

- **Local history** (`app/history.html`) — an isolated Git repository beside the
  application's data directory, never a `.git` inside a user folder. Every
  settings, marker, profile and rule change is a commit. **Restore appends a new
  entry; it never rewinds.** Region files are explicitly *not* snapshotted, and the
  confirmation gate says so.
- **Destructive gate** (`app/confirm.html`) — two independently operated keys, then
  a full-range slider that only unlocks once both are held, with an always-visible
  emergency exit and <kbd>Esc</kbd>. The seven facts (action, folder, file count,
  chunk count, size, what is kept, reversibility) stay exact at every funny level.
- **Element locks** (`app/locks.html`) — credentials in the OS credential vault,
  never in settings files, presets, exports, history entries, screenshots or logs.
  A password is checked against a stored hash. One credential per lock; no master
  key. Locked items still appear in search, labelled as locked.
- **Settings provenance** (`app/settings.html`) — every element states whether its
  value came from a written file or the compiled-in default, and names the real
  default value rather than saying "default". Coverage is guarded by a
  **hand-written list**; a test that only validates the explanations present passes
  cleanly on a setting that has none.
- **App rename** — changes the display name and nothing else. Data directory,
  package identifiers, update feed and any marker written into user folders are
  derived from a fixed constant. Diagnostics send the shipped name.

---

## 3. Documentation site

| Design file | Page | Route |
| --- | --- | --- |
| `site/landing.html` | Home | `/` |
| `site/docs.html` | Article reader | `/docs/<article>` |
| `site/settings.html` | Site settings | `/settings` |
| `site/mobile.html` | — | Not a page; the 390px acceptance check for the two above |

### The site is not exempt from anything

It carries the same contracts as the application: three language modes, both
funny-level sliders, the theme switch, browser-style tabbed navigation with the
four tab searches, a search bar with its anchored regex builder on **every** search
field, the full appearance-customization system with per-element
*Edit appearance…*, element locks, the command palette on the same
<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>F</kbd>, non-blocking notifications, bulk
actions, local history for visitor-owned state, and the destructive-action gate.

"It is only docs" and "nobody customizes that one" are not exemptions.

Where a rule assumes something a browser does not have, **substitute and say so**:

| Application | Site |
| --- | --- |
| OS credential vault | per-visitor browser storage, with the reset route stated |
| Application data folder | this site's storage, with "clear this site's storage to reset" |
| Local Git history repository | browser storage, with its own retention statement |

Keep a **hand-written completeness list** of every contract feature the site must
carry, and fail the docs build when one is missing. A guard that only validates the
features already present passes cleanly on a site that has none of them.

### Landing page specifics

- The installer download button uses the **immutable release asset URL from a
  validated release manifest**, and states version, platform, size and date. Until
  publication is verified it is **absent** rather than pointing at a guessed URL.
- It states plainly that the installer is **unsigned** and that Windows will show
  an unknown-publisher warning. Code signing is out of scope for this project.
- The feature grid covers **every** feature, not a highlight reel. A feature that
  ships and never appears there is undocumented in practice.
- The capture gallery uses **real captures of the built application at a verified
  commit** — never mockups, never design files, never hand-edited images. Where a
  surface cannot be captured yet, say so where the image would go rather than
  leaving a silent gap.

### Article specifics

Every article covers **behaviour, configuration, failure modes, security
considerations and verification**, and ends with **suggested articles** — related
features, the prerequisite, and the natural next step.

Failure modes and verification are the two sections that get skipped, and they are
the two a reader actually needs when something has gone wrong.

Articles are updated **in the same task that changes behaviour**. Stale
documentation is worse than none, because it is confidently wrong and the reader
has no way to tell.

### Mobile acceptance

From `site/mobile.html`, at 390px:

- The page body never scrolls sideways; wide content scrolls in its own container.
- The left article strip collapses to a single edge affordance naming the current
  group and its count.
- Touch targets stay at least 48px **with separation** between neighbours.
- Text reflows rather than truncating, and is readable without pinch-zoom.
- Bilingual labels stack rather than competing for one row.

Verify with an actual touch screen, not a narrowed desktop browser — a resized
desktop window still has a mouse, which is exactly the thing being tested for.
Hover-only affordances need a tap equivalent.

---

## 4. Patterns — apply across both implementations

| Design file | Applies to |
| --- | --- |
| `patterns/language-modes.html` | Every rendered string in both implementations |
| `patterns/funny-levels.html` | Every message, with **no category exempt** |
| `patterns/empty-error-loading.html` | Every list, every async operation, every failure path |
| `patterns/accessibility.html` | Everything, as a completion blocker rather than polish |

### Language modes

Three modes: English, playful Hong Kong Cantonese, bilingual. In bilingual the
primary label keeps its normal size and weight; the secondary drops to `body-small`
in `on-surface-variant`. Two labels at equal weight fight each other and double the
height of every row.

**Numbers, identifiers, paths and error strings never translate.**
`connection reset by peer` stays in the words the server actually said —
translating it makes it unsearchable, which is the one thing a user does with an
error string.

Keep localization resources separate from logic, provide fallback behaviour, and
test all three modes.

### Funny levels

Two independent sliders, 1 to 5, one per language. Level 1 is fully professional;
level 5 is maximum playfulness. **Every category takes the funny level**, including
destructive, financial, security, accessibility and error copy.

The level styles **voice, never facts**. `patterns/funny-levels.html` renders the
same destructive warning and the same error at all five levels in both languages,
with the invariant facts listed as chips under each block. That chip row is the
test: every chip must be findable in both languages at all five levels. If any
level drops the path, the count, or the word that says it is irreversible, that
level is wrong.

Humour roasts the situation, never the user — not their data loss, not their money,
not their disability.

### Accessibility

Focus is a 3px `secondary` outline at a 2px offset, outside the shape,
`:focus-visible` only. 48×48 is the target floor for pointer and touch alike, held
by a transparent pseudo-element when the drawn control is smaller. Every `on-` role
clears 4.5:1 against its own container in both themes.

Fix accessibility defects **in the task that finds them**. They are completion
blockers, not polish.

---

## 5. Verification checklist before either implementation ships

- [ ] `tokens.css` copied verbatim; no component re-declares a token or hard-codes
      a hex that appears in it.
- [ ] Every colour token has a definition on bare `:root`; none exists only inside
      a media query or `[data-theme]` block.
- [ ] Both dark blocks present — the media query **and** the attribute selector.
- [ ] Every search field, dropdown and context menu has its filter and its own
      anchored regex builder. **Add each new search field to the completeness list
      in the same change that adds the field** — a list-based guard cannot notice a
      field that was never added to it.
- [ ] Every rendered element exposes *Edit appearance…* and *Lock this element…*.
- [ ] Every list has multi-select, a scoped select-all, inverse selection and bulk
      actions — including the notification centre and the history panel.
- [ ] No modal that only informs.
- [ ] No `http://` or `https://` resource reference anywhere in either build.
- [ ] No emoji in any button, action label, field label or accessible name.
- [ ] Nothing clips at 100/125/150/200 percent, at narrow widths, in bilingual mode.
- [ ] Reduced motion collapses durations to 1ms, not 0.
- [ ] Every state is a colour **and** something else.
- [ ] Density tokens have readers. Follow each one to something that consumes it —
      a control can persist its value, survive a restart, pass every test written
      for it, and still render a pixel-identical interface because the properties
      it writes have no readers.
