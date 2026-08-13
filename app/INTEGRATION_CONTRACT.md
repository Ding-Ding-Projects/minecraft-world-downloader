# Integration contract

You are adding **one feature** to World Downloader Studio, an Electron + TypeScript
desktop application built on Material Design 3.

This document is the whole contract. It names the directory you own, the exact
shape of the file you write, every import path with its exported names and
signatures, the CSS custom properties available to you, and the checklist your
feature must satisfy before it is finished.

---

## 1. The one rule that matters most

**You own exactly one directory and you never edit a file outside it.**

```
app/src/renderer/features/<your-feature-id>/
```

Everything you write goes in there: `index.ts`, and as many further files as you
like (`panel.ts`, `docs.ts`, `state.ts`, `styles.css`, …).

Do **not** edit:

- anything under `app/src/renderer/core/`
- anything under `app/src/main/`, `app/src/preload/` or `app/src/shared/`
- `app/src/renderer/main.ts`, `index.html`, `styles/tokens.css`, `styles/material.css`
- `app/package.json`, `app/electron-builder.yml`, the tsconfigs, the Vite config
- any other feature's directory

There is no registration list to append to and no switch statement to extend.
The boot sequence globs `./features/*/index.ts`, imports every match and
registers its default export. Adding a directory is the entire integration step.

Around thirty features are being written in parallel against this same tree. Any
edit outside your directory is a merge conflict with somebody else's work.

---

## 2. The file you write

`app/src/renderer/features/<your-feature-id>/index.ts` ends with a default
export built by `defineFeature`:

```ts
import { defineFeature } from '../../core/registry';
import type { AppContext, TabContext, SettingContext } from '../../core/registry';

export default defineFeature({
  id: 'worlddownload',                       // stable, unique, matches the directory name
  name: 'World download',                    // human-readable, shown in About and the docs
  description: 'Runs the proxy and captures the world while you play.',

  tabs: [ /* TabDefinition[] */ ],
  settings: [ /* SettingsSection[] */ ],
  palette: [ /* PaletteEntry[] */ ],
  docs: [ /* DocArticle[] */ ],
  strings: { /* Catalogue — your own copy, at all five humour levels */ },

  init(ctx: AppContext) {
    // Optional. Runs once at boot, after every module is registered.
  }
});
```

`defineFeature` type-checks the object at its definition site, so a missing or
mistyped field is a compile error in your own file rather than a runtime surprise
at boot.

### Registration is validated

The registry refuses, with an exact message, any of the following:

- two features claiming the same `id`
- two features registering the same tab id
- two features registering the same settings section id
- two settings claiming the same setting id (setting ids are unique across the
  **whole application**, not per feature)
- a `kind: 'custom'` setting with no `render`
- a `kind: 'action'` setting with no `run`
- a `kind: 'select'` setting with no `options`
- a tab with no `mount`

**Prefix every id you invent with your feature id.** Tab ids look like
`worlddownload.session`; setting ids look like `worlddownload.port`; palette
entry ids look like `worlddownload.command.start`. Documentation article ids look
like `worlddownload.overview`.

---

## 3. Exact type shapes

These are the types the registry exports. Copy them as written.

```ts
interface FeatureModule {
  id: string;
  name: string;
  description: string;
  tabs?: TabDefinition[];
  settings?: SettingsSection[];
  palette?: PaletteEntry[];
  docs?: DocArticle[];
  strings?: Catalogue;
  init?(ctx: AppContext): void;
}

interface TabDefinition {
  id: string;
  title: string;        // an i18n key
  icon: string;         // a name from ICON_NAMES (section 6)
  group?: string;       // optional group id; the group is created on demand
  order?: number;       // lower sorts first. Core uses 0 and 900+. Use 100–800.
  permanent?: boolean;  // true makes the tab non-closable. Features: leave it off.
  /** Build your content into `host`. Return a dispose function, or use ctx.onDispose. */
  mount(host: HTMLElement, ctx: TabContext): void | (() => void);
}

interface SettingsSection {
  id: string;
  title: string;    // an i18n key
  icon: string;
  order?: number;   // core uses 10–90. Features: use 100+.
  controls: SettingControl[];
}

type SettingKind =
  | 'switch' | 'text' | 'number' | 'slider' | 'select' | 'color'
  | 'font' | 'path' | 'file' | 'folder' | 'action' | 'custom';

interface SettingControl {
  id: string;                 // stable, unique, dotted. Never renamed once shipped.
  label: string;              // an i18n key
  description: string;        // an i18n key — the progressive-disclosure explanation
  kind: SettingKind;
  defaultValue: unknown;      // the compiled-in default. Shown by the provenance line.
  options?: Array<{ value: string; label: string }>;   // required for 'select'
  min?: number; max?: number; step?: number;           // 'number' and 'slider'
  hint?: string;              // i18n key: placeholder or unit
  render?(host: HTMLElement, ctx: SettingContext): void;   // required for 'custom'
  run?(ctx: SettingContext): void | Promise<void>;         // required for 'action'
  lockable?: boolean;         // defaults to true
  lockableReason?: string;    // required when lockable is false — state the reason
  validate?(value: unknown): string | null;   // return null to accept
  keywords?: string[];        // extra search terms
}

interface PaletteEntry {
  id: string;
  title: string;              // i18n key or literal
  subtitle?: string;
  icon?: string;
  keywords?: string[];
  kind: 'command' | 'destination' | 'setting';
  settingId?: string;         // for kind 'setting' — the palette renders the LIVE control
  run?(): void | Promise<void>;
  teleport?: { tabId: string; elementId?: string };
}

interface DocArticle {
  id: string;
  title: string;              // plain English; the browser chrome is what gets translated
  category: string;           // groups the index, e.g. 'World download'
  body: string;               // Markdown. No remote asset may appear in it.
  related: string[];          // ids of related articles, shown as suggested reading
}

/** One key's copy, in both languages, at all five humour levels. */
type FunnyLadder = [string, string, string, string, string];
type Catalogue = Record<string, { en: FunnyLadder; yue: FunnyLadder }>;
```

### The three context objects

```ts
interface AppContext {
  registry: Registry;
  settings: SettingsStore;
  i18n: I18n;
  t(key: string, fallbackEn?: string, options?: TranslateOptions): string;
  notify: NotificationService;
  history: HistoryRecorder;
  confirm: ConfirmService;
  tabs: TabService;
  palette: PaletteService;
  docsService: DocsService;
  theme: ThemeService;
  appearance: AppearanceService;
  locks: LockService;
  overlay: OverlayService;
  a11y: A11yService;
  components: ComponentKit;
  exporter: ExportService;
  createSearchBar(options: SearchBarOptions): SearchBarHandle;
  createRegexBuilder(options: RegexBuilderOptions): RegexBuilderHandle;
  studio: StudioApi;                 // the privileged bridge — see section 7
  dimSum: { subscribe(listener: (draw: DimSumDraw) => void): () => void };
}

interface TabContext extends AppContext {
  tabId: string;
  onDispose(fn: () => void): void;   // release listeners and timers here
}

interface SettingContext extends AppContext {
  setting: SettingControl;
  value: unknown;
  setValue(value: unknown): void;    // runs `validate` first; refuses and reports on failure
  provenance: 'user' | 'default' | 'scheduled' | 'imported';
}
```

---

## 4. Import paths

From `app/src/renderer/features/<id>/index.ts`. Relative paths are the default;
the aliases `@core/*` and `@shared/*` resolve to the same files if you prefer.

| Path | Exports |
| --- | --- |
| `../../core/registry` | `defineFeature`, `registry`, `register`, **and every type in section 3** |
| `../../core/components` | `components: ComponentKit` |
| `../../core/a11y` | `a11y: A11yService`, `el`, `nextId`, `focusableWithin` |
| `../../core/icons` | `ICON_NAMES: string[]`, `ICON_PATHS`, `iconElement(name, size?)` |
| `../../core/searchbar` | `createSearchBar(options): SearchBarHandle` |
| `../../core/regexbuilder` | `createRegexBuilder(options)`, `compile(pattern, flags)`, `evaluate(regex, sample)`, `escapeLiteral(text)` |
| `../../core/colorpicker` | `openColorPicker(options): OverlayHandle` |
| `../../core/color` | `parseColor`, `toHex`, `toCssRgb`, `formatColor`, `translate`, `contrastRatio`, `relativeLuminance`, `inGamut`, `tonalPalette`, `tonalColor`, `paletteFromSeed`, `namedColors`, `COLOR_FORMATS`, and the space converters (`rgbToHsl`, `hslToRgb`, `rgbToLab`, `labToRgb`, `rgbToLch`, `lchToRgb`, `rgbToOklab`, `oklabToRgb`, `rgbToOklch`, `oklchToRgb`, `rgbToHsv`, `hsvToRgb`, `rgbToHwb`, `hwbToRgb`, `rgbToCmyk`, `cmykToRgb`) |
| `../../core/overlay` | `overlay: OverlayService` |
| `../../core/notifications` | `notifications: NotificationService` |
| `../../core/confirm` | `confirmService: ConfirmService` |
| `../../core/export` | `exporter: ExportService` |
| `../../core/settings` | `settings: SettingsStore` |
| `../../core/i18n` | `i18n: I18n`, `t`, `VOCABULARY_LIMITS`, `LANGUAGE_MODE_ID`, `FUNNY_EN_ID`, `FUNNY_YUE_ID`, `EMOJI_DIALOGS_ID`, `SCHOOL_ENABLED_ID`, `SCHOOL_NAME_ID` |
| `../../core/theme` | `theme: ThemeService`, `pixelsToPoints`, `DEFAULT_SEED`, `BUNDLED_FONT_STACK`, `THEME_MODE_ID`, `THEME_SEED_ID`, `THEME_CONTRAST_ID`, `THEME_DENSITY_ID`, `THEME_FONT_FAMILY_ID`, `THEME_FONT_SCALE_ID`, `THEME_FONT_WEIGHT_ID` |
| `../../core/appearance` | `appearance: AppearanceService`, `selectorFor(element)` |
| `../../core/locks` | `locks: LockService`, `openSupportTickets(anchor, folder)` |
| `../../core/history` | `history: HistoryRecorder` |
| `../../core/tabs` | `tabs: TabService` |
| `../../core/palette` | `palette: PaletteService` |
| `../../core/docs` | `docsService: DocsService`, `docsCoverage()` |
| `../../core/markdown` | `renderMarkdown(source, { onInternalLink? }): DocumentFragment` |
| `../../core/totp` | `generateSecret`, `totp`, `hotp`, `verifyTotp`, `otpauthUri`, `qrSvg`, `qrMatrix`, `base32Encode`, `base32Decode`, `hashPassword`, `verifyPassword` |
| `../../core/dimsum` | `subscribeDimSum`, `showDimSum`, `DISHES` |
| `../../../shared/api` | every privileged type: `StudioApi`, `Result`, `AppInfo`, `SpawnOptions`, `SpawnHandle`, `ProcessEvent`, `ProcessSummary`, `HistoryEntry`, `HistoryQuery`, `HistoryStatus`, `HttpRequest`, `HttpResponse`, `HttpAllowRule`, `EditorCandidate`, `FileStat`, `DirectoryEntry`, `OpenDialogOptions`, `SaveDialogOptions`, `VaultStatus`, `WindowState`, `DimSumDraw`, `PlatformName` |

Prefer taking services from `ctx` inside `mount` and `init`; the direct imports
are there for module-level code that runs before a context exists.

---

## 5. The component kit

`ctx.components` (or `import { components } from '../../core/components'`).
Every factory returns real DOM. Signatures, exactly:

```ts
button(o: { label: string; variant?: 'filled'|'tonal'|'outlined'|'text'|'elevated';
            icon?: string; trailingIcon?: string; disabled?: boolean;
            disabledReason?: string; danger?: boolean;
            onClick?(e: MouseEvent): void; id?: string }): HTMLButtonElement

iconButton(o: { icon: string; label: string;   // `label` is the accessible name and is required
                variant?: 'standard'|'filled'|'tonal'|'outlined';
                toggled?: boolean; disabled?: boolean; disabledReason?: string;
                onClick?(e: MouseEvent): void; id?: string }): HTMLButtonElement

fab(o: { icon: string; label?: string; size?: 'small'|'medium'|'large';
         onClick?(e: MouseEvent): void }): HTMLButtonElement

card(o?: { variant?: 'elevated'|'filled'|'outlined'; title?: string;
           subtitle?: string; onClick?(e: MouseEvent): void }): HTMLElement

chip(o: { label: string; icon?: string; selected?: boolean; removable?: boolean;
          onToggle?(selected: boolean): void; onRemove?(): void }): HTMLElement

switchControl(o: { label: string; checked?: boolean; disabled?: boolean;
                   disabledReason?: string; onChange?(v: boolean): void;
                   id?: string }): ControlHandle<boolean>

checkbox(o: SwitchOptions & { indeterminate?: boolean }): ControlHandle<boolean>

radioGroup(o: { label: string; options: {value,label}[]; value?: string;
                onChange?(v: string): void; id?: string }): ControlHandle<string>

slider(o: { label: string; min: number; max: number; step?: number; value?: number;
            unit?: string; showTicks?: boolean; onChange?(v: number): void;
            id?: string }): ControlHandle<number>

textField(o: { label: string; value?: string; variant?: 'filled'|'outlined';
               type?: 'text'|'number'|'password'|'search'|'url';
               placeholder?: string; supportingText?: string; error?: string;
               multiline?: boolean; rows?: number; min?/max?/step?: number;
               prefix?: string; suffix?: string;
               browse?: 'file'|'folder'|'both';     // adds the native browse control
               onChange?(v: string): void; onCommit?(v: string): void;
               id?: string }): ControlHandle<string>

select(o: { label: string; options: {value,label}[]; value?: string;
            filterable?: boolean;   // defaults true; you never need to set it
            disabled?: boolean; disabledReason?: string;
            onChange?(v: string): void; id?: string }): ControlHandle<string>

menu(o: { anchor: HTMLElement; items: MenuItem[]; label?: string;
          placement?: OverlayPlacement; onClose?(): void }): OverlayHandle

list(o?: { label?: string }): HTMLElement
listItem(o: { headline: string; supporting?: string;
              trailing?: string | HTMLElement; leadingIcon?: string;
              selected?: boolean; selectable?: boolean;
              onActivate?(): void; onSelectChange?(s: boolean): void;
              id?: string }): HTMLElement

dialog(o: { title: string; body?: string | HTMLElement; icon?: string;
            confirmLabel?: string; cancelLabel?: string;
            extraActions?: ButtonOptions[] }): Promise<boolean>

tabBar(o: { tabs: {id,label,icon?}[]; active?: string;
            variant?: 'primary'|'secondary'; onChange?(id: string): void }): HTMLElement
navigationRail(o: TabBarOptions): HTMLElement
topAppBar(o: { title: string; subtitle?: string; actions?: HTMLElement[] }): HTMLElement
tooltip(element: HTMLElement, text: string): () => void

linearProgress(o: { value?: number; label: string; size?: number }): ControlHandle<number>
circularProgress(o: ProgressOptions): ControlHandle<number>
badge(o: { label: string; severity?: NotificationSeverity }): HTMLElement
divider(vertical?: boolean): HTMLElement

segmentedButton(o: { label: string; options: (SettingOption & {icon?})[];
                     value?: string; onChange?(v: string): void;
                     id?: string }): ControlHandle<string>

datePicker(o: { label: string; value?: string|null; range?: boolean;
                rangeEnd?: string|null; min?: string; max?: string;
                onChange?(v: {start: string|null; end: string|null}): void;
                id?: string }): ControlHandle<{start: string|null; end: string|null}>

dataTable<Row>(o: { label: string; columns: DataTableColumn<Row>[]; rows: Row[];
                    rowId(row: Row): string; selectable?: boolean;
                    onSelectionChange?(ids: string[]): void;
                    onActivate?(row: Row): void;
                    emptyMessage?: string }): DataTableHandle<Row>

icon(name: string, o?: { size?: number; label?: string }): HTMLElement
emptyState(o: { title: string; body?: string; action?: ButtonOptions }): HTMLElement
sectionHeading(o: { title: string; description?: string }): HTMLElement
```

`ControlHandle<T>` is `{ root: HTMLElement; get(): T; set(v: T): void;
setDisabled(disabled: boolean, reason?: string): void; focus(): void }`.

**Two things the kit already does for you, so do not rebuild them:**

- Every `select` and every `menu` opens with a keyboard-focusable filter field at
  its head and an anchored pattern-builder affordance beside that field. You get
  that by using `components.select` and `components.menu`. Do not write a raw
  `<select>`, and do not write your own popup menu.
- Every `disabled` control needs a `disabledReason`. A disabled button with no
  explanation reads as broken rather than as blocked.

---

## 6. Icons, tokens and styling

### Icon names

`icon`, `iconButton`, `TabDefinition.icon`, `MenuItem.icon` and
`SettingsSection.icon` all take a name from this set (`ICON_NAMES` exports it):

```
add        bolt        book       calendar   check         chevronDown
chevronLeft chevronRight chevronUp close     cloud         code
copy       dock        download   edit       error         file
filter     folder      history    home       info          key
lock       lockOpen    map        more       notifications palette
pause      pin         play       refresh    remove        save
search     settings    sort       stop       success       terminal
trash      tune        upload     visibility warning       world
```

An unknown name renders a bordered initial rather than an empty box, so a
missing icon is visible during development instead of silently blank. There is
no icon font and no remote request.

### CSS custom properties

Use these. Never write a literal colour, a literal radius or a literal duration:
the whole scheme is generated at runtime from the user's seed colour, and a
hard-coded value simply stops following it.

**Colour roles** — `--md-sys-color-<role>` where `<role>` is one of:

```
primary  on-primary  primary-container  on-primary-container  inverse-primary
secondary  on-secondary  secondary-container  on-secondary-container
tertiary  on-tertiary  tertiary-container  on-tertiary-container
error  on-error  error-container  on-error-container
success  on-success  success-container  on-success-container
warning  on-warning  warning-container  on-warning-container
background  on-background  surface  on-surface
surface-variant  on-surface-variant  surface-dim  surface-bright
surface-container-lowest  surface-container-low  surface-container
surface-container-high  surface-container-highest
inverse-surface  inverse-on-surface
outline  outline-variant  shadow  scrim  surface-tint
```

Intermediate tones, when you genuinely need one:
`--md-ref-palette-<primary|secondary|tertiary|neutral|neutralVariant|error>-<tone>`
for tone in `0 4 6 10 12 17 20 22 24 30 40 50 60 70 80 87 90 92 94 95 96 98 99 100`.

**Typography** — `--md-sys-typeface-plain`, `--md-sys-typeface-mono`,
`--md-sys-typescale-factor`, `--md-sys-typescale-weight`, and
`--md-sys-typescale-<style>-<size>` where `<style>-<size>` is
`display-large|display-medium|display-small|headline-large|headline-medium|headline-small|title-large|title-medium|title-small|body-large|body-medium|body-small|label-large|label-medium|label-small`
with the `-size` and `-line` suffixes.

Prefer the ready-made classes: `md-typescale-display-large`,
`md-typescale-headline-medium`, `md-typescale-title-small`,
`md-typescale-body-large`, `md-typescale-label-medium`, and so on for every
combination above.

**Shape** — `--md-sys-shape-corner-<none|extra-small|small|medium|large|extra-large|full>`

**Elevation** — `--md-sys-elevation-<0..5>`

**Motion** — `--md-sys-motion-easing-<emphasized|emphasized-decelerate|emphasized-accelerate|standard|standard-decelerate|standard-accelerate|linear>`
and `--md-sys-motion-duration-<short1..short4|medium1..medium4|long1..long4>`

**State layers** — `--md-sys-state-<hover|focus|pressed|dragged>-opacity`,
`--md-sys-state-disabled-content-opacity`, `--md-sys-state-disabled-container-opacity`

**Density and layout** — `--md-sys-density-scale`, `--md-comp-row-height`,
`--md-comp-button-height`, `--md-comp-field-height`, `--md-comp-icon-button-size`,
`--md-comp-touch-target`, `--md-comp-title-bar-height`, `--md-comp-tab-strip-width`,
and spacing `--md-space-<1|2|3|4|5|6|8|10>`

### Your own CSS

If you need styles beyond the kit, put them in a `.css` file **inside your own
directory** and `import './styles.css'` from your `index.ts`. Prefix every class
with your feature id — `.worlddownload-session-row` — so nothing collides.
Never edit `styles/material.css` or `styles/tokens.css`.

---

## 7. The privileged bridge

`ctx.studio` (also `window.studio`, typed as `StudioApi` from
`../../../shared/api`). This is the **only** route to the operating system:
there is no `require`, no `process` and no Node integration in the renderer.

**Every call returns `Result<T>` rather than throwing.** Read `ok` first, always:

```ts
type Result<T> = { ok: true; value: T } | { ok: false; error: string; code?: string };
```

```ts
studio.info                      // AppInfo, available synchronously

studio.app.getInfo() | relaunch() | quit() | revealUserData()

studio.window.minimize() | toggleMaximize() | maximize() | unmaximize() | close()
             | setFullScreen(on) | getState() | setTitle(title) | setAlwaysOnTop(on)

studio.settings.readAll() | writeAll(record) | filePath()
   // Use `ctx.settings` instead. This is the raw file underneath it.

studio.vault.status() | set(account, secret) | get(account) | has(account)
            | delete(account) | listAccounts()
   // OS-backed encryption. Never log, export, render or history-record a secret.

studio.dialog.openFile(o?) | openFolder(o?) | saveFile(o?)

studio.fs.stat(path) | readText(path, maxBytes?) | writeText(path, contents)
         | readDirectory(path) | ensureDirectory(path) | readBase64(path, maxBytes?)
   // Absolute paths only.

studio.shell.openPath(path) | showItemInFolder(path) | openExternal(url)
   // openExternal refuses anything that is not http(s).

studio.editor.detect() | open(target, { editorId?, asFolder? })
   // Visual Studio Code is preferred. `asFolder: true` opens a workspace root.

studio.process.spawn({ command, args?, cwd?, env?, maxOutputBytes?, timeoutMs? })
              | write(id, data) | kill(id, signal?) | list()
              | readOutput(id, 'stdout' | 'stderr')
   // No shell is involved. `command` must be a bare name on this allow-list:
   //   java javaw node npm npx docker docker-compose git python python3 py mvn gradle
   // Streamed output arrives on the 'process:event' push channel.

studio.history.status() | record(action, source, payload) | list(query?)
              | actions() | read(id) | prune(olderThanIso)
   // Use `ctx.history` instead; it never throws into your operation.

studio.http.request(req) | allow(rule) | rules() | revoke(host)
   // DENY BY DEFAULT. Register an allow rule naming your feature and its reason
   // before any request. Plain http is refused except to a loopback host.
   // Redirects are refused. The response body is bounded.

studio.events.on(name, handler): () => void
   // 'window:state' | 'process:event' | 'dimsum:surprise'
   // | 'app:before-quit' | 'app:theme-source-changed'
```

---

## 8. Writing copy

Every user-facing string is an **i18n key**, resolved through `ctx.t(key,
fallbackEn)`. Supply the copy in your module's `strings` catalogue, in both
languages, at all five humour levels.

```ts
strings: {
  'worlddownload.start': {
    en: [
      'Start the download',       // level 1 — fully professional
      'Start the download',
      'Start capturing the world',
      'Off we go — start hoovering up the world',
      'Off we go — start hoovering up the world'   // level 5 — maximum playfulness
    ],
    yue: [
      '開始下載',
      '開始下載',
      '開始捉住個世界',
      '出發喇，開始吸晒成個世界入袋',
      '出發喇，開始吸晒成個世界入袋'
    ]
  }
}
```

**Rules, not preferences:**

- A ladder is always **exactly five strings**, even when several rungs read the
  same. The resolver must be able to reach every level without falling off the
  end.
- The two humour levels are **independent**. English at 1 beside Cantonese at 5
  is a combination somebody will choose, and both halves of a bilingual line must
  read correctly in it.
- Humour styles the **voice**, never the **facts**. At every level a message
  still names what happened, exactly what it affects and what the options are —
  including error, warning and destructive copy, which are not carved out of it.
  A funny message that leaves the reader unsure what a button will do is a broken
  message.
- Interpolate with `{name}` placeholders and `ctx.t(key, fallback, { values: { name } })`.
  Values are never restyled by the humour level.
- Pass `{ dialog: true }` only for copy inside a dialog or a message box; that is
  the only place the emoji switch may add a decorative emoji. Never for a button
  label, a field label or an accessible name.
- Namespace your keys with your feature id. A key that collides with an existing
  one silently renders somebody else's words, with no error anywhere.

---

## 9. Search fields, lists and destructive actions

**Every search field** you add is `ctx.createSearchBar(...)`. It carries the
anchored pattern builder, keeps plain text as the default and regular
expressions as an explicit opt-in, and owns its own query, pattern, flags and
mode. Do not write a bare `<input type="search">`.

```ts
const search = ctx.createSearchBar({
  label: 'worlddownload.search',     // i18n key; also the accessible name
  sample: rows.map((r) => r.name).join('\n'),   // seeds the builder's sample text
  onChange: (query) => {
    for (const row of rows) row.node.hidden = !query.matches(row.name);
  }
});
host.append(search.root);
ctx.onDispose(() => search.destroy());
```

`query.matches(value)` never throws: an invalid pattern matches nothing and the
field shows the reason inline, which is the honest empty state.

**Every list, table and grid** carries bulk actions: multi-select with a keyboard
path, a select-all that says plainly whether it means *what is shown* or
*everything*, an inverse selection, and the same actions in bulk that exist
singly. `components.dataTable({ selectable: true })` and
`components.listItem({ selectable: true })` give you the selection; the actions
are yours to wire.

**Every destructive or irreversible action** goes through the two-key gate:

```ts
const approved = await ctx.confirm.request({
  action: `Delete ${chosen.length} download profiles`,   // the exact action
  affected: chosen.map((p) => p.name),                    // item by item
  irreversible: 'The profiles and their captured chunk index are removed from disk and cannot be recovered.',
  anchor: event.currentTarget as HTMLElement               // it anchors here and returns focus here
});
if (!approved) return;
```

Reserve `components.dialog` for a decision the user must make before continuing.
Everything that only informs is `ctx.notify.info/success/warn/error` — a toast,
never a modal. Warnings and errors persist until dismissed.

---

## 10. Recording history and exporting

Any record your feature creates, edits or deletes is recorded:

```ts
await ctx.history.record('Deleted a download profile', 'worlddownload', { id, name });
```

Restoring an earlier state is recorded as a **new** entry, never as a rewrite, so
an undo can be undone. `ctx.history.record` never throws into your operation.

Anything your feature can show, it can export:

```ts
const path = await ctx.exporter.save(rows, 'json', {
  name: 'download-profiles',
  defaultFileName: 'download-profiles.json'
});
```

Formats: `json jsonl yaml toml xml csv tsv markdown html sql`. Call
`ctx.exporter.preflight(rows, format)` first and show the user which fields the
chosen format cannot carry, **before** anything is written.

---

## 11. Per-feature checklist

Your feature is not finished until every line here is true of it.

**Language**
- [ ] Every user-facing string is an i18n key with a five-rung ladder in `en` and `yue`.
- [ ] Both humour levels change your copy, independently, at every level from 1 to 5.
- [ ] Bilingual mode reads correctly and does not crowd the layout; the primary line stays prominent.
- [ ] Facts survive every level: what happened, what it affects, what the options are.
- [ ] Emoji appears only in dialog and message-box copy, never in a button, a label or an accessible name.

**Accessibility**
- [ ] Every control is reachable and operable from the keyboard, with a visible focus ring.
- [ ] Every control has an accessible name; an icon alone is never a name.
- [ ] Correct roles and states (`aria-selected`, `aria-expanded`, `aria-pressed`, `role="status"` for live regions).
- [ ] Nothing is announced only by colour or only by motion.
- [ ] `prefers-reduced-motion` is respected (`ctx.a11y.reducedMotion()`).
- [ ] Interactive targets are at least 44×44 CSS pixels.

**Layout**
- [ ] Nothing clips, truncates, overlaps or goes off-screen at narrow widths.
- [ ] Nothing clips at 100%, 125%, 150% or 200% display scale.
- [ ] Checked with the longest localized strings, which means bilingual mode.
- [ ] Wide content (tables, code, diagrams) scrolls inside its own container; the panel never scrolls sideways.

**Controls**
- [ ] Every search field is `ctx.createSearchBar`, so it carries the anchored pattern builder.
- [ ] Every dropdown and menu is `components.select` / `components.menu`, so it carries its filter field and builder.
- [ ] Every list, table and grid has multi-select, select-all with an honest scope, inverse selection and bulk actions.
- [ ] Every disabled control names the exact unmet condition.
- [ ] Every value that can be enumerated is a picker populated from real data, not an empty text box.
- [ ] Every path field has a native browse control (`browse: 'file' | 'folder' | 'both'`).
- [ ] Nothing that looks operable is decorative. If it genuinely cannot be operated, label it a static preview and do not style it as a live control.

**Settings**
- [ ] Every setting has a `description` explaining what it does, not restating its label.
- [ ] Every setting has a real `defaultValue`, so the provenance line can name it.
- [ ] Setting ids are unique application-wide and prefixed with your feature id.
- [ ] Any setting that opts out of `lockable` states the reason in `lockableReason`.

**Every rendered element**
- [ ] Reachable by **Edit appearance…** from its context menu (this is automatic — do not suppress `contextmenu`).
- [ ] Give elements a stable `data-appearance-id` or `id` where the appearance should persist across restarts.
- [ ] Lockable through **Lock this element…** on the same menu.

**Integration surfaces**
- [ ] At least one `PaletteEntry`, and a `teleport` target for anything a user might search for by name.
- [ ] At least one `DocArticle`, in Markdown, with `related` ids that exist.
- [ ] Records go through `ctx.history.record`.
- [ ] Anything displayed can be exported through `ctx.exporter`.
- [ ] Destructive actions go through `ctx.confirm.request`.
- [ ] Informational messages are notifications, never modal dialogs.

**Hygiene**
- [ ] No network asset of any kind: no CDN script, no remote stylesheet, no web font, no remote image, no analytics.
- [ ] Outbound HTTP, if you need it, registers an allow rule naming your feature and its reason first.
- [ ] `npx tsc --noEmit -p tsconfig.web.json` is clean.
- [ ] `npm run build` is clean.
- [ ] No file outside your feature directory was modified.
- [ ] No TODO, no placeholder, no stub, no "implement later".

---

## 12. A complete worked example

```ts
// app/src/renderer/features/example/index.ts
import { defineFeature } from '../../core/registry';
import type { AppContext, TabContext } from '../../core/registry';

interface Row { id: string; name: string; chunks: number }

const ROWS_KEY = 'example.rows';

export default defineFeature({
  id: 'example',
  name: 'Example',
  description: 'Shows the shape of a feature module end to end.',

  strings: {
    'example.tab': {
      en: ['Example', 'Example', 'Example', 'The example, in all its glory', 'The example, in all its glory'],
      yue: ['示範', '示範', '示範', '示範，隆重登場', '示範，隆重登場']
    },
    'example.search': {
      en: ['Search rows', 'Search rows', 'Search the rows', 'Type and watch the rows thin out', 'Type and watch the rows thin out'],
      yue: ['搵行', '搵行', '搵下啲行', '打字，睇住啲行少埋', '打字，睇住啲行少埋']
    },
    'example.enabled': {
      en: ['Enable the example', 'Enable the example', 'Turn the example on', 'Switch the example on', 'Switch the example on'],
      yue: ['啟用示範', '啟用示範', '開咗個示範', '撳着個示範', '撳着個示範']
    },
    'example.enabled.description': {
      en: [
        'Registers the example tab in the strip. Turning it off leaves the tab registered but empty; nothing stored is deleted.',
        'Registers the example tab in the strip. Turning it off leaves the tab registered but empty; nothing stored is deleted.',
        'Puts the example tab in the strip. Off leaves it there but empty, and deletes nothing.',
        'Puts the example tab in the strip. Off leaves it sitting there empty, sulking. Nothing is deleted either way.',
        'Puts the example tab in the strip. Off leaves it sitting there empty, sulking. Nothing is deleted either way.'
      ],
      yue: [
        '喺分頁列登記示範分頁。閂咗個分頁仲喺度但係空嘅，儲低嘅嘢一件都唔會刪。',
        '喺分頁列登記示範分頁。閂咗個分頁仲喺度但係空嘅，儲低嘅嘢一件都唔會刪。',
        '將示範分頁放入分頁列。閂咗佢仲喺度但係空嘅，乜都唔會刪。',
        '將示範分頁放入分頁列。閂咗佢就喺度空吟吟咁扁嘴，不過乜都唔會刪。',
        '將示範分頁放入分頁列。閂咗佢就喺度空吟吟咁扁嘴，不過乜都唔會刪。'
      ]
    }
  },

  settings: [
    {
      id: 'example.settings',
      title: 'example.tab',
      icon: 'bolt',
      order: 100,
      controls: [
        {
          id: 'example.enabled',
          label: 'example.enabled',
          description: 'example.enabled.description',
          kind: 'switch',
          defaultValue: true,
          keywords: ['example', 'demo']
        }
      ]
    }
  ],

  palette: [
    {
      id: 'example.command.open',
      title: 'example.tab',
      icon: 'bolt',
      kind: 'destination',
      keywords: ['example'],
      teleport: { tabId: 'example.main' }
    }
  ],

  docs: [
    {
      id: 'example.overview',
      title: 'The example feature',
      category: 'Example',
      body: [
        'This feature exists to show the shape of a module.',
        '',
        '## What it does',
        '',
        'It renders a table of rows, filters them through a search field that carries the pattern builder, and deletes a selection behind the two-key gate.'
      ].join('\n'),
      related: ['core.overview']
    }
  ],

  tabs: [
    {
      id: 'example.main',
      title: 'example.tab',
      icon: 'bolt',
      order: 100,
      mount(host: HTMLElement, ctx: TabContext) {
        const rows: Row[] = ctx.settings.get<Row[]>(ROWS_KEY, [
          { id: 'a', name: 'Overworld', chunks: 4120 },
          { id: 'b', name: 'Nether', chunks: 318 }
        ]);
        let filtered = [...rows];

        host.append(ctx.components.topAppBar({ title: 'example.tab' }));

        const table = ctx.components.dataTable<Row>({
          label: 'example.tab',
          columns: [
            { id: 'name', label: 'Name', sortable: true, value: (r) => r.name },
            { id: 'chunks', label: 'Chunks', sortable: true, align: 'end', value: (r) => r.chunks }
          ],
          rows: filtered,
          rowId: (r) => r.id,
          selectable: true,
          emptyMessage: 'core.search.noMatches'
        });

        const search = ctx.createSearchBar({
          label: 'example.search',
          sample: rows.map((r) => r.name).join('\n'),
          onChange: (query) => {
            filtered = rows.filter((r) => query.matches(r.name));
            table.setRows(filtered);
          }
        });

        const remove = ctx.components.button({
          label: 'core.action.delete',
          variant: 'text',
          danger: true,
          onClick: async (event) => {
            const chosen = table.selection();
            if (chosen.length === 0) return;
            const approved = await ctx.confirm.request({
              action: `Delete ${chosen.length} rows`,
              affected: chosen.map((id) => rows.find((r) => r.id === id)?.name ?? id),
              irreversible: 'The rows are removed from the stored list. The change is recorded in local history.',
              anchor: event.currentTarget as HTMLElement
            });
            if (!approved) return;
            for (const id of chosen) {
              const index = rows.findIndex((r) => r.id === id);
              if (index >= 0) rows.splice(index, 1);
            }
            ctx.settings.set(ROWS_KEY, rows);
            await ctx.history.record('Deleted example rows', 'example', { ids: chosen });
            filtered = [...rows];
            table.setRows(filtered);
            table.clearSelection();
            ctx.notify.success('core.action.delete', `${chosen.length} rows removed.`);
          }
        });

        const exportButton = ctx.components.button({
          label: 'core.action.export',
          variant: 'text',
          icon: 'download',
          onClick: async () => {
            const path = await ctx.exporter.save(filtered.map((r) => ({ ...r })), 'csv', {
              name: 'example-rows',
              defaultFileName: 'example-rows.csv'
            });
            if (path) ctx.notify.success('core.export.saved', path);
          }
        });

        host.append(search.root, remove, exportButton, table.root);
        ctx.onDispose(() => search.destroy());
      }
    }
  ],

  init(ctx: AppContext) {
    ctx.settings.declareDefault(ROWS_KEY, []);
  }
});
```

---

## 13. Building and checking

From `app/`:

```
npm install                                  # once
npm run ensure-electron                       # restores the Electron binary if install scripts were blocked
npx tsc --noEmit -p tsconfig.web.json         # your feature must be clean
npm run build                                 # main + preload + renderer
npm run dev                                   # run it
```

`npm run dist` packages the Windows installer with electron-builder, target
`squirrel`. Code signing is permanently out of scope: never add a certificate, a
signing key or a signing step anywhere.
