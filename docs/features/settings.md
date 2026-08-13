# Settings surface

> The tabbed settings destination in the desktop application: one browser-style tab per registered
> settings section, a search across every label, explanation and current value, guided controls with
> a truthful provenance line, bulk selection and actions, export in every supported format, import,
> and per-control and global reset.

Source: `app/src/renderer/features/settings/`. In-application article: **The settings surface**
(`settings.surface`), reachable from the Documentation tab and from the command palette.

## What it does

Settings is a destination in the application's own tab strip, and **inside it every registered
settings section is itself a real tab in a real tab strip**. A feature contributes a
`SettingsSection`; this module turns each one into a tab and renders every `SettingControl` it
declares.

Concretely, the surface provides:

- **A nested browser-style tab strip** with the whole tab contract: dockable to left, right, top or
  bottom (left is the default), an overflow surface, reordering, pinning into a stable dedicated
  region, groups with a name, colour and collapsed state, all four searches, both bulk closes, and
  persistence of every one of those across restarts.
- **Its own search bar**, separate from and additional to the tab searches, matching each setting's
  label, explanation, stable id, keywords, options **and current value** across every section, and
  reporting when a match sits on a different tab with a button that navigates there.
- **Every control kind**: `switch`, `text`, `number`, `slider`, `select`, `color`, `font`, `path`,
  `file`, `folder`, `action` and `custom`.
- **An explanation behind progressive disclosure** and **a truthful default-provenance line** on
  every row.
- **Inline validation in plain words**, a per-control reset, a global reset, bulk selection with
  shift ranges and honestly-scoped select-all, export in every format the shared exporter supports,
  and import with a full preview.

## How it works

### Files

| File | Responsibility |
| --- | --- |
| `index.ts` | The `FeatureModule`: the tab, this feature's own settings section, the palette entries, the documentation article and the string catalogue. |
| `surface.ts` | Mounts the destination: top bar, School-mode notice, search, bulk-action bar, the nested tab strip, the section index and the selection model. |
| `nestedtabs.ts` | The nested tab system: dock, overflow, reorder, pin, groups, four searches, both bulk closes, persistence. |
| `rows.ts` | One settings row: title, explanation, provenance, the live control, inline validation, per-control reset, lock and appearance affordances. |
| `transfer.ts` | Export, import and the global reset, including the import parser and its bounds. |
| `strings.ts` | The English and Cantonese catalogue, five humour rungs per language. |
| `docs.ts` | The in-application article. |
| `styles.css` | Material Design 3 tokens only; no hard-coded colours. |

### The nested tab strip

State lives in the ordinary settings store under the `settings.tabs.` prefix, so it persists exactly
like any other preference:

| Key | Holds |
| --- | --- |
| `settings.tabs.dock` | `left`, `right`, `top` or `bottom`. Registered as a real setting, so it is searchable and appears in the command palette. |
| `settings.tabs.order` | Tab id to position. |
| `settings.tabs.pinned` | Ids of pinned tabs. |
| `settings.tabs.groups` | `{ id, name, color, collapsed, order }` per group. |
| `settings.tabs.membership` | Tab id to group id. |
| `settings.tabs.closed` | Ids hidden by a bulk close. |
| `settings.tabs.active` | The tab that was last open. |

Docking is an **orientation change, not a rotation**. When the strip is vertical the overflow test
measures `scrollHeight` against the client height rather than the widths, `aria-orientation` is
`vertical`, and the roving tabindex binds Up and Down instead of Left and Right. No label is ever
rendered sideways. A label that does not fit is ellipsised, never clipped silently.

The four searches are:

1. The strip itself (in the strip head).
2. Inside every individual group (at the head of the group body).
3. Across groups by their visible names (from the tab-tools menu).
4. A master search across every settings tab, **including tabs that are currently closed** — a
   result you cannot see is exactly the one you came looking for.

Each one is built with the shared `createSearchBar`, so each carries its own anchored pattern
builder and its own query, pattern, flags and mode. None shares state with another.

Both bulk closes share **one predicate**, so "not containing" is the exact negation of "containing"
and the flags, casing and scope cannot drift apart. Neither runs on an empty query or an invalid
pattern, both show the exact count and a reviewable preview first, and pinned tabs are excluded
unless the user deliberately includes them.

### Rows

`createSettingRow` builds the row and owns the **single write path**. A value typed into a field and
a value chosen through a browse button both arrive at the same `commit`, so a browsed path is never
trusted more than a typed one.

`commit` runs, in order: the built-in checks for the control kind (numeric parse, `min`, `max`,
`step` with a floating-point tolerance), then the control's own `validate`. A refusal is shown
inline in a `role="alert"` paragraph beside the control and **nothing is written**; the field keeps
what the user typed so they can correct it rather than start again.

The provenance line reports one of:

- `From your settings file at <path>.`
- `No file has ever set this. The application is using its built-in value: <value>.`
- `A schedule is setting this right now. … The built-in value is <value>.`
- `Came from an imported theme or settings file. The built-in value is <value>.`

The real value is always named. "Default" on its own tells a reader nothing about what a reset would
give them back.

Guided-form behaviour throughout: the font picker lists the families the machine actually reports;
the start-tab picker lists the settings tabs that genuinely exist; a `select` with no options is
disabled **with the reason stated**; a numeric field shows its accepted range as supporting text;
and a "use the built-in value" shortcut appears only while the value is not already the built-in
one.

### Selection and bulk actions

The selection is a set of setting **ids** held by the surface, not a DOM state, so it survives a tab
switch and works for settings whose panels have not been built yet. Rows synchronise to it when they
are created.

- Click a checkbox, then shift-click another to take the range. <kbd>Space</kbd> and
  <kbd>Enter</kbd> take the same path, so the keyboard has the same multi-select the pointer has.
- **Select every setting on this tab** and **Select every setting matching the search, on every
  tab** are two separate actions, each saying which scope it means.
- Invert applies within the current search, not to the whole application.
- Reset, export and copy-the-ids act on the selection. Reset counts honestly: it says how many will
  move and how many were already at their shipped value and will not.

### Export and import

Export offers every format `core/export.ts` supports — JSON, JSONL, YAML, TOML, XML, CSV, TSV,
Markdown, HTML, SQL — and four scopes: everything, this tab, the selection, or only settings whose
value differs from the shipped one. The panel runs the exporter's `preflight` before anything is
written and names the fields the chosen format cannot carry faithfully.

Each record carries `id`, `label`, `section`, `kind`, `value`, `provenance` and `shippedDefault`, and
a trailing `_notice` record states what was omitted.

Import accepts three shapes: the `records` array this panel writes, the raw `values` object of the
settings document, and a flat object of id to value (what somebody editing by hand will write). It
is bounded at 1 MiB and 5000 keys, refuses reserved object keys, and separates what will be applied
from what this build does not recognise and what already matches — all before the two-key
confirmation gate.

## Configuration

Settings this module registers, in the section `settings.surface`:

| Id | Kind | Default | What it does |
| --- | --- | --- | --- |
| `settings.tabs.dock` | select | `left` | Which edge the settings tab strip sits on. |
| `settings.startTab` | custom (select) | `last` | Which settings tab opens first: the last one used, or a named one. |
| `settings.showIds` | switch | `false` | Shows each setting's stable dotted id under its name. |
| `settings.expandExplanations` | switch | `false` | Starts every explanation open rather than behind the question mark. |
| `settings.action.export` | action | — | Opens the export panel. |
| `settings.action.import` | action | — | Opens the import panel. |
| `settings.action.resetAll` | action | — | Opens the two-key gate for the global reset. |

## Failure modes

| Situation | Behaviour |
| --- | --- |
| No feature has registered a settings section | An honest empty state naming that fact. The strip is not drawn. |
| A section registers no controls | Its tab still exists and its panel says "This tab has no settings in it." |
| A search matches nothing on the active tab | The panel shows a no-match state, and the summary still says how many matched on other tabs. |
| A refused value | Reported inline beside the control; nothing is written; the typed text is kept. |
| A `select` with no options | Disabled, with the reason stated in its tooltip and accessible description. |
| The installed font list cannot be read | The font row reports the exact error in place of the picker rather than showing an empty box. |
| A locked setting or tab | Stays visible, labelled as locked, with the unlock route beside it. Never silently hidden. |
| An import file that is too large, not JSON, or carries reserved keys | Refused with the exact reason. Nothing is applied partially. |
| An import key this build does not know | Listed as unknown and **not written**. |
| The export is written but the editor cannot open it | Reported as information; the file is on disk either way. |
| Every settings tab closed by a bulk close | The strip shows an empty state with a "reopen every closed tab" action, and the same action is in the tab tools and the command palette. |

## Security and privacy

- **No network access at all.** Nothing here fetches, uploads or reports anything.
- Export excludes anything under `vocabulary.`, `school.unlock` and `locks.`, and the exported file
  states that credentials, the personal-vocabulary cache and the lock verifiers were omitted. Import
  refuses the same prefixes, so an edited file cannot inject them back.
- Import is bounded (1 MiB, 5000 keys) and rejects `__proto__`, `constructor` and `prototype` keys.
- Toy locks are a user-experience speed bump and every surface says so. They are not security, not
  encryption, and no protection from anybody else using the computer. Deleting the application data
  folder clears every one of them.
- The global reset explicitly does **not** touch credentials, locks or the local history, and says so
  in the confirmation gate rather than leaving the user to guess.

## Language, humour and School mode

All copy is resolved through `t()` with English and playful Hong Kong Cantonese ladders at five
humour rungs each, and the two languages are independent. The humour styles the voice only: a count
is the exact count at level 5, a validation message names the exact accepted range, and the reset
gate names exactly what goes and what stays.

While the renamable study mode is on, the surface omits the language section and every control whose
id begins `language.`, `vocabulary.` or `dimsum.` — they are removed rather than disabled — and a
notice at the top says so using the user's chosen name for the mode.

## Accessibility

- The strip is a real `tablist` with `aria-orientation` following the dock edge, roving tabindex on
  the matching axis, and `aria-controls`/`aria-labelledby` pairing each tab with its panel.
- Every explanation toggle carries `aria-expanded` and `aria-controls`; every disabled control
  carries its reason in `title` and `aria-description`.
- Validation lives in a `role="alert"` region; counts and summaries in `role="status"` regions;
  opening a tab and changing a value are announced on the shared live region.
- Tab buttons, the explanation toggle and the lock affordance are all at least 44 CSS pixels.
- Row bodies scroll inside their own container, so a wide control never makes the page scroll
  sideways. Below 900 px the strip moves above the content instead of competing for width.
- Motion is limited to one colour transition, and that is removed under `prefers-reduced-motion`.

## Verification

- `npm run typecheck` in `app/` covers this module.
- Manual checks worth running against the built application: dock the strip to each of the four
  edges and confirm the arrow keys follow the axis; close every settings tab and confirm the empty
  state and its reopen action; search for a term that only exists on another tab and confirm the
  "go to" button appears with the right count; type an out-of-range number and confirm nothing is
  written and the message names the range; browse for a folder into a path setting and confirm the
  same validation runs; export as CSV with a structured value and confirm the preflight names the
  column; import a file with an unknown key and confirm it is listed and not applied.

## Suggested related articles

- [Accessibility & themes](accessibility-themes.md) — the theming and accessibility controls this
  surface renders.
- [Desktop manager](desktop-manager.md) — the surrounding desktop application.
- [Ported features](ported-features.md) — how features register the sections that become these tabs.
