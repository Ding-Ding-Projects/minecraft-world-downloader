import type { DocArticle } from '../../core/registry';

/**
 * The in-application documentation for this feature.
 *
 * These articles are bundled into the build and rendered by the shared markdown
 * renderer, so they are readable with no network at all. They say what the
 * surface does, how it is configured, how it fails, what it refuses and how to
 * check that it worked.
 */

export const APPEARANCE_DOCS: DocArticle[] = [
  {
    id: 'appearance.overview',
    title: 'Appearance: theme, typography and presets',
    category: 'Appearance',
    body: `
# Appearance

The **Appearance** destination holds the theme, the typography, the presets, the
catalogue of every rendered element, and the file transfer. Every control on it
is the real control: it writes to the same theme service the rest of the window
reads, so a change lands immediately and no restart is involved.

## Theme

- **Colour scheme** — light, dark, or follow the operating system. Both schemes
  are generated from the accent colour, so choosing a scheme never silently
  changes the accent.
- **Accent colour** — opens the infinite colour picker, with its continuous
  spectrum, numeric entry, colour translator, alpha, gamut warning and contrast
  readout. The picker is the application's own; this surface does not carry a
  second, smaller one.
- **Contrast** — standard, medium or high. Contrast pushes the text and
  container tones apart; the key colours stay where the accent put them.
- **Density** — 0 is the shipped spacing and -3 is the most compact. Touch
  targets keep their accessible minimum at every level.

The colour-role preview at the top of the section reads the generated tokens out
of the live document, so what it shows is what the window is actually painting
rather than a picture of what it should be.

## Typography

- **Interface typeface** — the list is the set of families this machine actually
  has, measured at runtime, plus the bundled stack. Every name previews in its
  own face, which is the only way to choose a typeface without applying it first.
- **A family that is not in the list** — type an exact name. If the machine does
  not have it, the name is kept and the surface says so plainly; the bundled
  stack renders in its place rather than the choice being thrown away.
- **Text size** and **text weight** — the size readout states the CSS pixel size
  and its point equivalent. Sizes are declared in pixels throughout; where points
  are needed the conversion is written out as \`points = pixels × 72 ÷ 96\`.

The Chinese line in the preview is a fallback check. A family with no Chinese
coverage still renders that line from the bundled stack, rather than as the row
of empty boxes that means a font gave up.

## Applying while dragging

**Apply while a slider is moving** decides whether a density or size change lands
on every step of the slider or when you let go. On is the livelier setting; off
is steadier on a slow machine. Either way the value that ends up stored is the
one the slider was left at.

## Verification

- Move the density slider and watch a list row change height while you drag.
- Choose a typeface and confirm the preview and the rest of the window change
  together.
- Type a nonsense family name and confirm the surface says it is not installed
  **and** keeps what you typed.
- Switch the colour scheme and confirm the colour-role values in the preview
  change to the dark or light set.

## Suggested reading

- *Appearance presets and theme files*
- *Editing any rendered element*
- *Appearance and Material Design* in the core documentation
`.trim(),
    related: ['appearance.presets', 'appearance.elements', 'core.appearance']
  },

  {
    id: 'appearance.presets',
    title: 'Appearance presets and theme files',
    category: 'Appearance',
    body: `
# Presets and theme files

A **preset** is a whole appearance — the theme values, and optionally every
per-element override — stored under a name. A **theme file** is the same thing
written to disk, so an appearance survives a reinstall and can be handed to
somebody else.

## Two kinds of preset

- **Provided by the application** — part of the build. They cannot be renamed or
  deleted, because they are not stored in your settings file.
- **Saved by you** — created from whatever the window looks like right now, and
  freely renamed, duplicated, exported and deleted.

An application preset does not claim in advance what it will set. The first time
you apply one, this surface records what it actually changed and lists it from
then on, labelled as observed. That is deliberate: a second copy of the shipped
preset table living in this feature could drift from the real one and start
describing changes that no longer happen.

## Undo

Applying a preset captures the appearance that was in force immediately before
it. The notification carries a **Put the previous appearance back** action, and
the same action stays available on the presets section until the next apply
replaces the capture. The apply itself is also recorded in local history.

## The file format

A theme file is JSON at schema version 1:

\`\`\`json
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
  }
}
\`\`\`

A file with **no** \`overrides\` key deliberately leaves the per-element
overrides alone. That is what makes a theme-only file portable rather than
destructive: handing somebody your colours should not delete their own tweaks.

An \`overrides\` key that is present replaces or merges, depending on **How an
import combines with what is here**. Merge keeps yours and lets the file win only
where both name the same selector *and* the same property.

## Nothing is silently dropped

Anything in a file this build cannot apply is **kept**, byte for byte, with the
exact reason, and listed under *Kept but not applied* on the export and import
section. You can export those entries, carry them to a newer build, or read what
your own file said. They are never quietly deleted to make the import look tidy.

Entries end up there when they are:

- a section or a theme value this build does not have;
- a value outside the range this build can represent, such as a density of 5;
- a declaration this rendering engine does not understand;
- a declaration carrying a brace, an angle bracket or a comment marker.

## Security considerations

Overrides become CSS in a live stylesheet, written as
\`selector { property: value; }\`. A value containing \`}\` could therefore end
that rule and begin one of its own, reaching elements the file never named. Both
halves of every imported declaration are checked for braces, angle brackets and
comment markers, and a declaration carrying one is kept rather than written.

Import and export are entirely local. No network request is made, and a theme
file is read from and written to a path you chose in the platform's own file
dialog.

## Failure modes

- **Not JSON, or not schema version 1** — the whole file is refused and nothing
  is changed. A half-applied appearance is worse than none.
- **The file cannot be read or written** — the exact reason from the operating
  system is reported, and nothing is changed.
- **A typeface the file names is not installed** — the value is applied and kept,
  and the surface says the bundled stack is rendering in its place.

## Verification

- Export an appearance, change the theme, then import the file back and confirm
  the values return.
- Hand-edit an exported file to set \`"density": 5\`, import it, and confirm the
  density is untouched, the entry appears under *Kept but not applied*, and it
  exports again with its original value.
- Select several saved presets, delete them, and confirm the two-key gate lists
  every name before anything is removed.

## Suggested reading

- *Appearance: theme, typography and presets*
- *Editing any rendered element*
- *Exports* in the core documentation
`.trim(),
    related: ['appearance.overview', 'appearance.elements', 'core.export']
  },

  {
    id: 'appearance.elements',
    title: 'Editing any rendered element',
    category: 'Appearance',
    body: `
# Every rendered element

The **Rendered elements** section lists every category of element this
application paints, with the exact selector the appearance editor writes to and a
live sample beside it.

The samples are built from the same component kit as the rest of the window, and
the editor opens against the **real** selector rather than the sample. So an edit
made here reaches the application chrome, the tab strip, the tabs, the toolbars,
the menus, the notifications, the settings rows, the command palette, the colour
picker and the appearance editor's own dialog.

## Surfaces that cannot be a miniature

A dialog, the command palette, the colour picker and the appearance editor are
surfaces, not inline controls. They are not faked with a picture. Their rows
carry a button that opens the genuine surface, and the editor still writes to the
real selector. The destructive-action gate is not opened for a pretend action at
all; its row says so and offers the editor anyway.

That includes the row that opens the appearance editor **on the appearance
editor**. A theming feature that cannot theme its own dialog is incomplete, so
that case is on the list rather than assumed.

## Bulk actions

Rows are multi-selectable with the checkbox, with **Shift** for a range, and
<kbd>Ctrl</kbd>+<kbd>A</kbd> for every row currently shown. Select-all states its
scope honestly: *Select the N shown* and *Select all N* are separate actions,
because a filtered list makes those two different numbers.

Selected rows can be reset — through the two-key gate, listing each selector and
its override count first — or exported as a table of selector, property and
value.

## Locks

Every row offers **Lock this element…**, which opens the toy-lock wizard for that
selector with its own credential. It is a self-imposed speed bump, not security
and not encryption; the wizard says so and names the folder to delete if the
credential is lost.

## Failure modes

- A sample that cannot be built reports why in its own row rather than leaving a
  gap that reads as a missing feature.
- A selector with no overrides has its **Reset** action disabled, and the
  disabled action names that exact reason rather than sitting there inert.

## Verification

- Edit the *Buttons* category, set a corner radius, and confirm every button in
  the window changes — including the buttons on this page.
- Edit the appearance editor's own dialog and confirm the editor itself changes.
- Reset in bulk and confirm the gate lists every affected selector with its
  override count before anything is removed.

## Suggested reading

- *Appearance presets and theme files*
- *Appearance: theme, typography and presets*
- *Toy locks* in the core documentation
`.trim(),
    related: ['appearance.overview', 'appearance.presets', 'core.locks']
  }
];
