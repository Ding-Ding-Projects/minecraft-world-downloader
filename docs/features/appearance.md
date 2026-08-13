# Appearance studio

The appearance studio is the settings surface and the preset system for how this
application looks. It owns the **Appearance** destination, the named presets and
theme files, and the catalogue of every rendered element.

It is built **on top of** the core appearance service rather than beside it. The
per-element editor, the infinite colour picker, the word-depth typography editor
and the theme token generator all live in `core/appearance.ts`,
`core/colorpicker.ts` and `core/theme.ts`. This feature uses them; it does not
carry a second copy of any of them, because two copies of one value are two
values that can disagree.

- Implementation: `app/src/renderer/features/appearance/`
- In-application articles: *Appearance: theme, typography and presets*,
  *Appearance presets and theme files*, *Editing any rendered element*
- Inventory rows satisfied: **2.2** and **2.6**

---

## Behaviour

### The destination

`Appearance` is a tab with five sub-sections, each a real tab rather than a
heading in one long scroll:

| Section | What it holds |
| --- | --- |
| Theme | Colour scheme, accent colour, contrast, density, and a live readout of the generated colour roles |
| Typography | Typeface list, a free-entry family name, text size, text weight, and a live type-scale preview |
| Presets and saved themes | Every preset, saving, renaming, duplicating, deleting, exporting, and undo |
| Rendered elements | Every element category with its real selector, a live sample, and its appearance editor |
| Export and import | The appearance file, the override table in every format, and the entries an import kept |

Each sub-tab button is wired to its panel with `aria-controls` and
`aria-labelledby`, and every panel carries the id the command palette teleports
to.

### Live application

Every control writes through `ThemeService`, which is the same service the rest
of the window reads. A change lands immediately: there is no restart, no "apply"
button, and no staging copy that could fall out of step with what is rendering.

The **Apply while a slider is moving** setting decides whether density, text size
and text weight land on every step of the slider or when the pointer is released.
When it is off, the slider's own `change` event carries the value instead of its
`input` event; the value that is finally stored is identical either way.

### Typography

The typeface list is the set of families this machine actually has. It is
measured at runtime by the core theme service, which compares a string's rendered
width in the candidate family against three generic fallbacks — a family the
machine does not have measures identically to the generic, so it is left out
rather than offered and then silently substituted.

Every family name in the list previews in its own face, and each row carries a
sample line with Latin, digits and Chinese.

The Chinese line is a fallback check rather than decoration: a family with no
Chinese coverage still renders that line from the bundled stack, instead of the
row of empty boxes that means a font gave up.

Sizes are declared in CSS pixels throughout. Where points are shown beside the
size readout the conversion is written out explicitly as
`points = pixels × 72 ÷ 96`, so nobody has to recognise a bare factor.

#### The study mode and the Chinese specimen

This feature exposes no language-mode control, no funny-level control, no
personal-vocabulary control and no dim-sum capability, so it has nothing to omit
while the named study mode is on: its interface copy is rendered in English by
the shared translator like every other surface.

The Chinese specimen line stays visible in that mode, deliberately. It is a
glyph-coverage check on the chosen typeface rather than interface copy, and
hiding it would break the CJK-fallback contract this section exists to
demonstrate. Its text names nothing belonging to a hidden capability.

### Presets

A preset is a whole appearance stored under a name: the theme values, and
optionally every per-element override.

**Application presets** ship with the build and cannot be renamed or deleted.
**Saved presets** are the user's own and are stored in the settings file, under
exactly the keys the core appearance service already reads
(`appearance.presets` for the index and `appearance.preset.<id>` for the
payload), so applying one goes through `appearance.applyPreset()` rather than a
private path.

An application preset does not claim in advance what it will set. The first time
one is applied, this feature records what actually changed and lists it from then
on, labelled as observed. That is deliberate: duplicating the shipped preset
table into this feature would let the duplicate drift and start describing
changes that no longer happen.

Applying a preset captures the appearance in force immediately before it, so the
notification and the presets section both offer **Put the previous appearance
back**.

### Rendered elements

The catalogue lists 26 element categories. Each row names the **real** selector
the appearance editor writes to, shows a live sample built from the same
component kit as the rest of the window, states how many overrides that selector
currently carries, and offers *Edit appearance…*, *Reset this element* and *Lock
this element…*.

Because the editor is opened against the real selector rather than the sample,
an edit made here reaches the application chrome, the tab strip, the tabs, the
toolbars, the menus, the notifications, the settings rows, the command palette,
the colour picker — and the appearance editor's own dialog, which has its own row
for exactly that reason.

Four categories are surfaces rather than inline controls. They are not faked with
a picture: their rows carry a button that opens the genuine dialog, menu, palette
or picker. The destructive-action gate is not opened for a pretend action at all;
its row says so plainly and still offers the editor.

---

## Configuration

| Setting | Default | What it does |
| --- | --- | --- |
| `appearance.studio.livePreview` | `true` | Apply a slider's value on every step, or when it is released |
| `appearance.studio.sampleText` | `""` (the shipped sample) | The line shown in the typography preview and every element sample |
| `appearance.studio.includeOverrides` | `true` | Whether an exported appearance file carries the per-element overrides |
| `appearance.studio.importMode` | `replace` | Whether an import replaces the current overrides or merges into them |

Three actions live beside them: **Open the appearance studio**, **Reset the theme
values**, and **Delete every preset you saved**. The last two go through the
two-key destructive gate.

Every setting this feature registers is namespaced under `appearance.studio.` so
it cannot collide with the theme values the core registers under `appearance.`.
The theme values themselves are edited here through the theme service; this
feature never registers a second control for an id the core already owns.

### The appearance file

```json
{
  "schemaVersion": 1,
  "generatedAt": "2026-01-01T00:00:00.000Z",
  "theme": {
    "mode": "system",
    "seed": "#4f6bed",
    "contrast": "standard",
    "density": 0,
    "fontFamily": "",
    "fontScale": 1,
    "fontWeight": 400
  },
  "overrides": {
    ".md-btn": [{ "property": "border-radius", "value": "8px" }]
  },
  "presets": [{ "id": "…", "name": "Forest", "note": "", "document": { "…": "…" } }]
}
```

A file with **no** `overrides` key deliberately leaves the current overrides
alone. That is what makes a theme-only file portable rather than destructive:
handing somebody your colours should not delete their own tweaks.

`merge` keeps the overrides already in place and lets the file win only where
both name the same selector **and** the same property, which is the only
combination where the two genuinely conflict.

---

## Failure modes

| Situation | What happens |
| --- | --- |
| The file is not JSON, or not schema version 1 | The whole file is refused and nothing is changed. A half-applied appearance is worse than none. |
| A theme value is outside the range this build can represent | The value is **kept** with its exact reason and listed under *Kept but not applied*. The rest of the file still applies. |
| A declaration this rendering engine does not understand | Kept, with the property and value named, so a newer build can apply it. |
| A declaration or selector containing `{`, `}`, `<`, `>` or a comment marker | Refused and kept, with the reason stated. See *Security considerations*. |
| A typeface the file names is not installed | Applied and kept. The surface says the bundled stack is rendering in its place, rather than resetting the choice. |
| A typeface typed by hand that is not installed | The same: the name is kept, and the status line says so. |
| The file cannot be read or written | The operating system's exact reason is reported and nothing is changed. |
| A sample in the element catalogue cannot be built | That row reports why, rather than leaving a gap that reads as a missing feature. |
| A selector has no overrides | Its **Reset** action is disabled and names that exact reason. |

**Nothing is ever silently dropped.** Every entry this build cannot apply is kept
byte for byte, listed with its reason, exportable as its own file, and removable
only through the destructive gate. Reading the live appearance for an export
checks the shape of an override and nothing else, so an override the editor
accepted can never quietly vanish from the next export.

---

## Security considerations

- **Overrides become CSS.** The core service writes them into a live stylesheet
  as `selector { property: value; }`, so a value containing `}` could end that
  rule and begin one of its own, reaching elements the file never named. Both
  halves of every **imported** declaration are checked for braces, angle brackets
  and comment markers, and one carrying any of them is kept rather than written.
  This is the one place an imported file could reach further than the element it
  names, so it is checked at the boundary rather than assumed further in.
- **Property names are checked** against a CSS identifier or a custom property
  before being written.
- **No network at runtime.** Nothing here fetches, and no font, stylesheet, icon
  or image is loaded from a remote host. Import and export read and write a path
  the user chose in the platform's own file dialog, through the privileged
  bridge.
- **No secrets travel in an appearance file.** It carries colours, sizes, names
  and CSS declarations only.
- **A rename changes display only.** This feature never writes to the data
  directory name, package identity, installer identity or update feed.

---

## Verification

### By hand

1. Move the density slider and watch a list row change height while dragging.
   Turn **Apply while a slider is moving** off and confirm the change now lands
   when the pointer is released, and that the stored value is the same.
2. Choose a typeface and confirm the preview and the rest of the window change
   together, with no restart.
3. Type a nonsense family name. Confirm the status line says it is not installed
   **and** that the field still contains what was typed.
4. Switch the colour scheme and confirm the colour-role readout changes to the
   dark or light values, read out of the live document.
5. Save a preset, change the theme, apply the preset, and confirm the
   notification lists exactly what changed and offers to put the previous
   appearance back.
6. Apply an application preset twice: the first time its row says the values are
   listed once applied, the second time it lists what it actually set.
7. Export an appearance, hand-edit `"density"` to `5`, and import it. Confirm the
   density is untouched, the entry appears under *Kept but not applied* with its
   reason, and it exports again carrying its original value.
8. Import a file whose override value contains `}`. Confirm it is kept, not
   written, and that the reason names the risk.
9. Edit the *Buttons* category, set a corner radius, and confirm every button in
   the window changes — including the buttons on the page doing the editing.
10. Open the appearance editor on the appearance editor and confirm the editor's
    own dialog changes.
11. Select several saved presets, delete them, and confirm the two-key gate lists
    every name before anything is removed.
12. Bulk-reset several element categories and confirm the gate lists each
    selector with its override count.

### Layout and accessibility

- Check the destination at 320 px, 720 px and full width, at 100 %, 125 %, 150 %
  and 200 % display scale, in all three language modes. The page must never
  scroll sideways; the type preview, the element samples and the kept-entries
  table scroll inside their own containers.
- Traverse the whole surface with the keyboard alone: the sub-tab strip, the
  typeface list (arrow keys move between rows), every slider, every menu, and
  the bulk-action bars. Focus must be visible at every stop.
- <kbd>Ctrl</kbd>+<kbd>A</kbd> inside the preset or element list selects every
  row **currently shown**, and the count is announced.
- Select-all is offered as two separate actions — *Select the N shown* and
  *Select all N* — because a filtered list makes those different numbers.

### Copy

- Read every string at funny level 1 and level 5, in English and in Cantonese.
  The voice changes; the preset name, the file path, the counts, the selector and
  the description of what cannot be undone do not.

---

## Suggested related articles

- [Material Design and appearance](./appearance-core.md) — the token generator,
  the per-element editor, the infinite colour picker and the typography editor
  this feature builds on.
- [Exports](./export.md) — the formats the override table can be written in and
  what each of them cannot carry.
- [Toy locks](./locks.md) — the per-element lock the element catalogue offers,
  and why it is honestly described as a speed bump rather than security.
- [Local version history](./history.md) — where every appearance change, preset
  apply, import and reset is recorded.
