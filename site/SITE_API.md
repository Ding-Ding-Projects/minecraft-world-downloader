# World Downloader Studio — site runtime API

Everything a page on this site needs. `site/assets/` is the whole runtime: three stylesheets and
one script, no build step, no framework, no bundler, no module loader.

---

## 1. Every page starts like this

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Page name · World Downloader Studio</title>
  <link rel="stylesheet" href="assets/tokens.css">
  <link rel="stylesheet" href="assets/material.css">
  <link rel="stylesheet" href="assets/site.css">
  <script defer src="assets/site.js"></script>
</head>
<body>
  <a class="skip" href="#main">Skip to the content</a>
  <header class="site-appbar">…</header>
  <main id="main" class="wrap">…</main>
  <footer class="site-footer">…</footer>
  <script>
    Studio.ready(function (S) { /* your page */ });
  </script>
</body>
</html>
```

Load order is **tokens → material → site**, always. Use a path prefix (`../assets/…`) from a
subdirectory; nothing in the runtime assumes it sits at the site root.

`site.js` adds exactly one property to `window`: **`Studio`**. Nothing else.

**`Studio.ready(fn)`** runs `fn(Studio)` once the DOM is parsed and the runtime has booted. It fires
immediately if boot already happened, so it is always safe.

---

## 2. Rules a page must follow

These are not style preferences. Each one is a contract the site is checked against.

- **Never let the body scroll sideways.** Wrap anything that can exceed the viewport — a table, a
  code block, a diagram, a wide figure — in `<div class="scrollx">…</div>`, which scrolls inside
  itself. Verified at 320, 360, 768 and 1280 px.
- **No emoji in a button, an action label, a field label, or an accessible name.** Emoji are for
  dialogs and message boxes only, and only through `Studio.i18n.emoji(kind)`, which returns `''`
  when the visitor has the switch off or School mode on.
- **Every colour comes from a token.** Never hard-code a hex value in a page. Every custom property
  in `tokens.css` is available to you.
- **Never define a colour only inside a media query or a `[data-theme]` block.** A token that exists
  only in the dark block is undefined in light and renders as an invalid value.
- **No network request of any kind.** No CDN script, no CDN stylesheet, no remote font, no remote
  image, no analytics, no tracker, no `fetch`. The single exception is the dim sum dish photo, which
  the runtime owns and the visitor can switch off — do not add a second one.
- **Anything that looks operable must work.** If an element is drawn like a control, it performs its
  labelled action, exposes an accessible name and state, and persists what it changes. If it is
  genuinely illustrative, label it as a static preview and do not style it like a live control.
- **Register everything on the palette.** Every page, every article, every setting, every appearance
  control. A feature nobody can find by name is a feature that is not palette-complete.

---

## 3. Storage — `Studio.store`

Everything a visitor changes lives in this browser's `localStorage` under the `wds.` prefix. Where a
desktop application would use an operating-system credential vault or an application-data folder,
this site uses that same storage and says so at the surface. Clearing this site's storage is the
reset for everything, including School mode and every lock.

| Call | Does |
| --- | --- |
| `store.get(key, fallback)` | Parsed JSON, or `fallback`. |
| `store.set(key, value)` | Serialises and saves. Returns `false` when storage refused. |
| `store.remove(key)` | Removes one key. |
| `store.keys()` | Every key this site owns, without the prefix. |
| `store.clearAll()` | Removes all of them. Returns the count. This is the recovery route. |
| `store.bytes()` | Approximate bytes used. |
| `store.ok()` | `false` when the browser refused storage. |
| `store.status()` | `{ available, note, prefix }`. |
| `store.onChange(fn)` | `fn(key, value)` on every write. Returns an unsubscribe function. |

Storage can be absent, full or refused. None of that takes the page down: the runtime falls back to
memory and reports the state honestly rather than pretending a value was saved.

---

## 4. Language, funny levels, emoji, vocabulary — `Studio.i18n`

### Defining copy

```js
Studio.i18n.define({
  'downloader.title': {
    en: ['World downloader', 'World downloader', 'World downloader',
         'World downloader', 'World downloader'],
    zh: ['世界下載器', '世界下載器', '世界下載器', '世界下載器', '世界下載器']
  },
  'downloader.idle': {
    en: ['Not running.', 'Not running.', 'Not running yet.',
         'Not running yet. Nothing is being downloaded.',
         'Not running yet. Not one chunk has moved.'],
    zh: ['未運行。', '未運行。', '仲未行緊。', '仲未行緊，乜都未落。', '仲未行緊，一舊都未落過。']
  }
});
```

**Five variants per language, always.** Lowest funny level first. Five is not decoration: the level
slider is wired to real copy, so an entry with one variant is a slider that visibly does nothing.
The runtime logs an error for any entry that is not five and five.

**The facts never move.** A level changes voice — how a message is told — never what it says
happened, what will be affected, or what a control does. Keep action labels near-constant; let
messages, titles and empty states carry the humour. A warning nobody can act on is a broken warning,
however funny.

### Rendering copy

| Call | Returns |
| --- | --- |
| `Studio.t(key, fallback)` | The primary string. English in `en` and `both`, Cantonese in `zh`. |
| `Studio.t2(key)` | The compact secondary string in bilingual mode, `''` otherwise. |
| `Studio.tBoth(key, fallback)` | `"primary · secondary"` for a place that cannot hold two nodes — a `title`, a document title, an accessible name. |
| `Studio.label(node, key, fallback)` | Fills `node` with the primary text plus a `<span class="sec">` secondary. Marks it `data-i18n` so it re-renders on a language change. |
| `Studio.i18n.emoji(kind)` | `'ℹ️' '✅' '⚠️' '❌' '❓' '🔒' '🥟'` for `info success warn error question lock dimsum`, or `''`. Dialogs and message boxes only. |
| `Studio.i18n.apply(root)` | Re-renders every `[data-i18n]` and `[data-i18n-attr]` under `root`. |

Mark static markup so it follows the language: `<h2 data-i18n="downloader.title"></h2>` or
`<button data-i18n-attr="title:downloader.title">`.

Bilingual mode keeps the primary label prominent and the secondary compact. Check your layout at
320 px — bilingual strings are the longest the site ever renders.

### Settings

```js
Studio.i18n.mode()        // 'en' | 'zh' | 'both'  — the EFFECTIVE mode (School mode forces 'en')
Studio.i18n.storedMode()  // what the visitor actually chose
Studio.i18n.setMode('both')
Studio.i18n.funny('en')   // 1..5
Studio.i18n.setFunny('zh', 5)
Studio.i18n.emojiEnabled()
Studio.i18n.setEmoji(true)
Studio.i18n.has(key)
```

Disclose the funny level honestly wherever you offer it: it styles **all** messages, warnings and
errors included. Use `Studio.t('lang.funnyNote')`, which already says so at every level.

### Personal vocabulary — `Studio.i18n.vocabulary`

**No mappings ship.** The map stays empty until the visitor supplies a file that passes every bound,
and a rejected file never applies partially. Always show the upload control, even before a file
exists.

```js
Studio.i18n.vocabulary.status()   // { loaded, count, loadedAt, error, limits }
Studio.i18n.vocabulary.loadFile(file)   // Promise<{ok, count} | {ok:false, error}>
Studio.i18n.vocabulary.clear()
Studio.i18n.limits  // frozen
```

File format:

```json
{ "schemaVersion": 1,
  "entries": [ { "match": "world", "replace": "realm", "mode": "word", "lang": "en" } ] }
```

Bounds: 65 536 bytes, schema version 1, 500 entries, 200-character keys and values, depth 4,
`mode` is `word` or `substring`, `lang` is `en`, `zh` or `all`. Unknown fields, duplicate keys,
malformed JSON and unknown versions are all refused with the exact reason. Local only: no network,
and the file's name and path are never stored.

---

## 5. School mode — `Studio.school`

One switch in local browser storage. While it is on, the site is English only, and Cantonese,
bilingual mode, both funny sliders, personal vocabulary and every dim sum capability are **omitted
from the interface**, not disabled. A greyed-out control still tells you the feature exists.

```js
Studio.school.isOn()
Studio.school.name()              // the visitor's chosen name, or 'School mode'
Studio.school.setName('Focus')
Studio.school.hasCredential()
Studio.school.setCredential(pin)  // PBKDF2-HMAC-SHA256, 20 000 iterations, random salt
Studio.school.enable()            // refuses without a credential — there would be no way out
Studio.school.disable(pin)        // { ok } | { ok:false, error }
Studio.school.suppresses('dimsum')  // 'cantonese' 'bilingual' 'funny' 'vocabulary' 'dimsum'
```

Use `suppresses()` to decide whether to render a control at all:

```js
if (!Studio.school.suppresses('funny')) settings.appendChild(funnySliders());
```

Say plainly, wherever you offer it, that this is a user-experience lock and not security, and that
clearing this site's storage resets it. `Studio.t('school.explain')`, `Studio.t('msg.notSecurity')`
and `Studio.t('msg.clearReset')` already say all of that at every level.

---

## 6. Theme — `Studio.theme`

```js
theme.mode()            // 'light' | 'dark' | 'system'
theme.effectiveMode()   // what is actually showing right now
theme.setMode('dark')
theme.density()         // 'comfortable' | 'compact' | 'dense'
theme.setDensity('compact')
theme.seed()            // the visitor's seed colour, or null for the shipped palette
theme.seedDefault       // '#0F7A3D'
theme.setSeed('#7B2FF7')   // false if it is not a colour
theme.fonts()           // [{ id, label, stack, available }] — availability is MEASURED
theme.font(); theme.setFont(id, customFamily)
theme.fontScale(); theme.setFontScale(1.15)     // 0.8 – 1.6
theme.fontWeight(); theme.setFontWeight('bold')
theme.motion(); theme.setMotion('reduced')
theme.reset()
theme.exportTheme(); theme.importTheme(data)
theme.palettes(seed); theme.roles(seed, dark)
```

Everything applies **live**. A seed colour generates full M3 tonal palettes at runtime and writes a
stylesheet that repeats the exact structure of `tokens.css` — bare `:root`, the guarded media query,
and both explicit `[data-theme]` blocks — so a generated palette can never leave a token defined
only in a dark block. Tone is CIELAB L\*, and chroma is reduced by binary search to the most sRGB
can hold at that lightness, which is what stops a requested chroma from shifting the hue.

`theme.fonts()` measures each family against three generic fallbacks rather than guessing. There is
no way to enumerate installed fonts without a permission-gated API only one engine ships, so say
plainly which families this machine actually has instead of listing families it may not.

---

## 7. Colour — `Studio.colour`

```js
Studio.colour.parse('oklch(0.7 0.15 150)')
// { rgb:[0..1,0..1,0..1], a, space, clipped }

Studio.colour.translate('#0F7A3D')
// { input, space, alpha, clipped, named, hex, hex8, rgb, rgba, hsl, hsla, hsv, hwb,
//   lab, lch, oklab, oklch, cmyk, cmykNote, contrastOnWhite, contrastOnBlack, rgbFloat }

Studio.colour.contrast('#000', '#fff')   // 21
Studio.colour.palettes(seed)             // { seed, hue, chroma, primary(tone), secondary(tone), … }
Studio.colour.roles(seedOrPalettes, dark) // the 35 M3 colour roles
Studio.colour.tone(hue, chroma, tone)
Studio.colour.picker(initial, onChange)  // see §12
```

Reads and writes named CSS colours, HEX, HEX8, RGB(A), HSL(A), HSV, HWB, LAB, LCH, OKLab, OKLCH and
CMYK. A value specified outside the sRGB gamut is clipped and the clip is **reported** in
`.clipped` — silently showing a different colour than the one entered is the worst possible answer.
CMYK is the naive device conversion with no ICC profile; `cmykNote` says so, so do not present it as
print-ready.

---

## 8. Tabs — `Studio.tabs`

```js
var strip = Studio.tabs.create(hostElement, {
  id: 'docs',            // storage key; each strip persists separately
  dock: 'left',          // 'left' (default) | 'right' | 'top' | 'bottom'
  tabs: [
    { id: 'overview', label: 'Overview', labelKey: 'docs.overview', icon: 'doc',
      panel: someElement,        // or a function returning one, called once
      closable: true, badge: null, keywords: 'start intro' }
  ],
  groups: [ { id: 'g1', name: 'Reference', colour: '#006D34', collapsed: false, members: ['overview'] } ]
});
```

The host must be able to hold a flex row: `display:flex` with a height.

| Controller | Does |
| --- | --- |
| `strip.dock()` / `strip.setDock(d)` | Any of the four edges. Persisted. |
| `strip.select(id)` / `strip.selected()` | Prompts to unlock first if the tab is locked. |
| `strip.add(tab)` / `strip.close(id, quiet)` | |
| `strip.togglePin(id)` | Pinned tabs get their own stable region. |
| `strip.move(id, ±1)` | Moves past the **visible** neighbour, not the flat-order one. |
| `strip.reorderBefore(dragged, target)` | Dropping into a group joins that group. |
| `strip.createGroup(name, colour)` → group | |
| `strip.renameGroup` / `setGroupColour` / `toggleGroup` / `removeGroup` | |
| `strip.moveToGroup(tabId, groupId)` / `removeFromGroup(tabId)` | |
| `strip.searchStrip(anchor)` | Search 1 of 4: this strip. |
| `strip.searchGroup(anchor, groupId)` | Search 2 of 4: inside one group. |
| `strip.searchGroups(anchor)` | Search 3 of 4: groups by name. |
| `Studio.tabs.masterSearch(anchor)` | Search 4 of 4: every open tab in every strip. |
| `strip.closeContaining(anchor)` / `closeNotContaining(anchor)` | Reviewable preview, exact counts, pinned excluded by default. |
| `strip.tabs()` / `groups()` / `state()` / `refresh()` | |
| `Studio.tabs.strips()` / `Studio.tabs.docks` | |

Order, pinned order, groups, group order, collapsed state, membership and selection all persist.

Docking is an **orientation** change, not a rotation. Labels are never turned ninety degrees.
`aria-orientation` and the arrow keys follow the axis — get that wrong and the strip looks perfect
and cannot be driven by keyboard, which no capture will ever reveal. The overflow surface measures
**height** on a vertical strip and **width** on a horizontal one.

Keyboard: arrows along the axis, Home/End, Enter or Space to select, **Alt+arrow** to reorder,
Delete to close. Right-click, the context-menu key, Shift+F10 and a long press all open the tab menu.

Every tab and every group header carries **Edit appearance…**, **Lock this element…** and the four
searches in its context menu, and Shift+right-click opens the appearance editor directly.

Move-into-group is an anchored **picker** with its own search and regex builder, never an inline
list of group menu items.

Groups are `role="group"` with `aria-labelledby` inside the `role="tablist"`. ARIA has no first-class
grouping inside a tablist; this is the closest structure that still tells a screen reader the group
exists and what it is called.

---

## 9. The regex builder — `Studio.regex`

```js
Studio.regex.open(anchorEl, { pattern, flags, sample }, function (result) {
  // result = { pattern, flags, sample }
});
Studio.regex.builder(state, onChange)   // the panel, for embedding
Studio.regex.compile(pattern, flags)    // { ok, re } | { ok:false, error }
Studio.regex.evaluate(pattern, flags, sample)  // Promise
Studio.regex.risk(pattern)              // [] or a list of readable warnings
Studio.regex.engine                     // 'JavaScript RegExp'
Studio.regex.evaluationMode()           // 'worker' | 'main-thread'
Studio.regex.limits                     // { maxPattern 2000, maxSample 20000, hardSample 200000,
                                        //   maxMatches 500, timeoutMs 250 }
```

Guided construction (23 pieces), a raw editor, all seven flags, sample text, live matches with
capture groups, syntax feedback, copy and export.

**Bounds, stated honestly.** A JavaScript regular expression cannot be interrupted once a single
match attempt begins. Where the browser will create a Worker — everywhere the site is served over
http or https — evaluation runs in one and the worker is **terminated** on timeout, which is a real
bound. Where a Worker cannot be created (a page opened from `file://`), evaluation falls back to the
main thread with a capped sample and capped match count, and the builder says which path it is on
rather than implying the stronger guarantee.

---

## 10. Search bars — `Studio.createSearchBar`

**Every search field on this site is one of these, and each one carries its own anchored regex
builder.**

```js
var search = Studio.createSearchBar({
  ariaLabel: 'Search articles',   // or label: 'Search articles' for a visible label
  placeholder: 'Search',
  storageKey: 'articles',   // remembers plain/regex mode and flags
  help: 'Searches titles and body text.',
  sampleProvider: function () { return rows.map(r => r.title).join('\n'); },
  onChange: function (api) { render(); }
});
container.appendChild(search.el);
```

| Method | Does |
| --- | --- |
| `search.value()` / `setValue(v)` | |
| `search.mode()` / `setMode('regex')` | Plain text is the default. Regex is an explicit opt-in. |
| `search.pattern()` / `flags()` / `valid()` / `error()` | |
| `search.matcher()` | Returns `fn(text) -> boolean`. **Use this**, never a hand-rolled comparison. |
| `search.test(text)` | One-shot convenience. |
| `search.focus()` | |

`onChange` does **not** fire during construction, so `var search = Studio.createSearchBar({ onChange: render })`
where `render` reads `search` is safe.

Use one `matcher()` for an action and its inverse. Two predicates drift on casing, flags and Unicode
the first time either side is edited alone.

Each instance owns its own query, pattern, flags and mode. One shared builder silently applying to
whichever field was last touched is the failure this design exists to prevent.

---

## 11. Menus, context menus and selects

**Every dropdown and every context menu opens with a keyboard-focusable filter field at its head and
its own anchored regex builder beside it.** There is no exemption for a short menu.

```js
Studio.createMenu({
  anchor: buttonEl,             // an element, or { x, y } from a pointer event
  ariaLabel: 'Article actions',
  filterLabel: 'Filter actions',
  storageKey: 'article-actions',
  placement: 'bottom',
  items: [
    { label: 'Open', icon: 'doc', shortcut: 'Enter', run: fn },
    { label: 'Copy link', icon: 'copy', keywords: 'url share', run: fn },
    '-',
    { label: 'Show drafts', checked: false, run: fn },
    { label: 'Delete', icon: 'trash', danger: true, run: fn,
      disabled: true, disabledReason: 'This article is published.' }
  ]
});   // → { close, refresh, handle }
```

Item fields: `label` or `labelKey`, `secondary`, `shortcut`, `icon`, `danger`, `disabled`,
`disabledReason`, `checked`, `keywords`, `run`. `'-'` is a separator.

`shortcut` is displayed right-aligned and exposed as `aria-keyshortcuts`. **Only pass the shortcut
that actually works in that context** — a wrong one trains a visitor to press a key that does
nothing.

Every disabled item states `disabledReason`, in its tooltip and to a screen reader. A disabled
control with no explanation reads as broken rather than as blocked.

Escape clears the filter first and closes only when the filter is already empty. Arrows move, Home
and End jump, focus returns to whatever opened the menu.

```js
Studio.contextMenu(element, function (target, event) { return [ …items… ]; },
                   { ariaLabel: 'Row menu', storageKey: 'row' });
```

Right-click, the context-menu key, Shift+F10 and a **long press** all reach it. A phone has no
right-click, so without the long press every context menu would be unreachable on the device most
visitors arrive with.

```js
var sel = Studio.createSelect({
  label: 'Format', value: 'json', storageKey: 'format',
  options: [ { value: 'json', label: 'JSON', keywords: 'javascript object' } ],
  onChange: function (value, option) {}
});
// sel.el, sel.value(), sel.setValue(v), sel.setOptions(list), sel.options(), sel.focus()
```

A select is a menu button plus the same filtered menu, so the two cannot diverge.

---

## 12. Appearance — `Studio.appearance`

```js
Studio.appearance.enable(node, 'article:intro', 'The introduction');
```

Gives the element a stable key, a Shift+right-click shortcut and an **Alt+Shift+E** keyboard
equivalent. Add **Edit appearance…** to that element's context menu yourself so it is discoverable:

```js
Studio.contextMenu(node, function () {
  return [
    { label: Studio.t('act.openEditor') + '…', icon: 'palette', shortcut: 'Shift+Right click',
      run: function () { Studio.appearance.openEditor(node, 'article:intro', 'The introduction'); } },
    { label: Studio.t('locks.lockThis') + '…', icon: 'lock',
      run: function () { Studio.locks.wizard(node, 'article:intro', 'The introduction'); } }
  ];
});
```

The editor opens **non-modally**, anchored beside that exact element, draggable and resizable, and
returns focus to it on close. It carries its own search, 21 typography properties (family, size,
variable axes, weight, italic and oblique, small caps, capitalization, underline, strikethrough,
overline, decoration style, colour and thickness, super and subscript, text colour, highlight,
outline, shadow and glow, character spacing, word spacing, line height, alignment, direction) and 7
box properties (radius, padding, border width, colour and style, elevation, opacity).

A property this browser does not support stays **visible** with the reason rather than vanishing.

```js
Studio.appearance.openEditor(anchor, key, label)
Studio.appearance.colourPicker(initial, onChange)  // → { el, value(), set(v) }
Studio.appearance.rules()      // every stored per-element rule
Studio.appearance.reset(key); Studio.appearance.resetAll()
Studio.appearance.presets()    // [{ id, label, describes, apply }]
Studio.appearance.translate(colour); Studio.appearance.contrast(a, b)
```

The colour picker is **infinite**: a continuous saturation and brightness field with keyboard
control, a hue slider, an alpha slider over a chequerboard, free-text entry in any supported format,
a bidirectional translator across every representation with copy buttons, a contrast readout, a
gamut warning, swatches, recent colours, and the platform eyedropper where one exists. Swatches are
a convenience layered on the continuous picker, never a replacement.

Rules are stored against `[data-wds-akey]` in one generated stylesheet, so a rule survives a
re-render that replaces the node, and resetting a property **removes** it rather than overwriting it
with a guess at the default.

---

## 13. Notifications — `Studio.notify`, `Studio.notifications`

```js
Studio.notify.success('Saved.');
Studio.notify.error('The file was refused: it is 90 000 bytes and the limit is 65 536.');
Studio.notify({
  kind: 'warn', title: 'Not everything applied',
  body: '3 of 12 rows were skipped.',
  actions: [ { label: 'Show which', run: fn }, { label: 'Docs', href: 'export.html' } ],
  timeout: 8000, persist: false
});   // → { id, close, element }
```

Corner-anchored, stacking, non-blocking. Errors and warnings persist until dismissed — an error that
auto-dismisses is an error the reader may never have seen. Hovering or focusing a toast stops its
timer.

**Reserve a modal dialog for a decision the visitor must make before continuing.** Everything that
only informs is a toast.

```js
Studio.notifications.all(); dismiss(ids); markRead(ids); clearAll();
Studio.notifications.corner(); setCorner('bottom-start');
Studio.notifications.open(anchor);   // the centre, with the full bulk contract
```

---

## 14. Destructive confirmation — `Studio.confirm`

```js
Studio.confirm({
  anchor: buttonEl, returnTo: buttonEl,
  action: 'Delete this saved world',
  target: 'Overworld (2.4 GB)',
  facts: [ { k: 'Chunks', v: '18 402' }, { k: 'Last opened', v: '3 August 2026' } ],
  detail: 'The folder and everything in it is removed.',
  irreversible: true
}).then(function (confirmed) { if (confirmed) doIt(); });
```

Two independent keys, then a slider that only wakes once both are turned, a progress bar while it
travels, a completion animation, and an **emergency exit** that is always available. Escape cancels,
focus returns to the originating control, and the promise resolves `false` on every cancellation
path.

The facts stay exact at every language mode and every funny level: the dialog names the action, the
target and what becomes irreversible in words no level is allowed to soften.

---

## 15. Command palette — `Studio.palette`

Opens on **Ctrl+Shift+F** from anywhere. Register everything your page owns.

```js
Studio.palette.register([
  { id: 'downloader.page', title: 'World downloader', kind: 'page',
    keywords: 'chunks server connect', page: 'downloader.html' },

  { id: 'settings.density', title: 'Density', subtitle: 'Appearance', kind: 'setting',
    target: '[data-setting="appearance.density"]',
    control: function () { return Studio.makeSwitch({ … }); } },

  { id: 'docs.map', title: 'Live map viewer', kind: 'article',
    page: 'docs/map.html', target: '#markers',
    tabStrip: 'docs', tabId: 'markers' },

  { id: 'act.export', title: 'Export everything', kind: 'command', run: fn }
]);
```

`kind` is a free short word shown beside the row: `page`, `article`, `setting`, `command`,
`destination`, `appearance`.

**Rows are rich.** Give a setting a `control()` and its real control renders inline, wired to the
same code as the originating surface, so the two can never disagree about the value.

**Selecting a result teleports to the exact element**: it opens the page (carrying
`?teleport=<id>`, which the destination resolves on load), selects the tab, opens any collapsed
`<details>` or collapse panel around it, scrolls it into view, focuses it and briefly highlights it.

`locked: 'some:key'` marks a result as locked; it still appears in results, labelled, and selecting
it prompts to unlock rather than silently doing nothing.

Card and full-window sizes, persisted, card by default.

---

## 16. Overlays and panels — `Studio.overlay`

```js
var panel = Studio.overlay.open({
  anchor: buttonEl,          // element or { x, y }; omit to centre
  title: 'Filters',
  content: node,             // node, array, or string
  footer: [ okButton, cancelButton ],
  placement: 'bottom',       // preferred side; it will pick another if that one does not fit
  modal: false, dim: false, backdrop: true,
  draggable: true, resizable: true,
  persistKey: 'filters',     // remembers size and position, with a reset
  returnTo: buttonEl,
  onClose: function (reason) {}
});
// panel.el, panel.body, panel.reposition(), panel.resetGeometry(), panel.close(reason)
```

Every popover, menu, tooltip and panel goes through here, so four rules hold everywhere at once:

1. **It paints its own surface.** A transparent overlay lets whatever sits behind it read straight
   through the text on top.
2. **It is bounded by the viewport and scrolls internally.** Capping a height and hiding the overflow
   silently deletes content past the cap.
3. **It never covers its anchor.** On a narrow viewport it becomes a bottom sheet, and if that sheet
   would land on the control that opened it the page scrolls the anchor clear.
4. **Escape and a click outside dismiss it, and focus returns.**

A panel with `persistKey` drags by its header, resizes from its corner and right and bottom edges,
and has a keyboard path: **Alt+arrows** move it, **Ctrl+Alt+arrows** resize it, Shift for a larger
step. `resetGeometry()` puts it back.

`Studio.overlay.closeTop()`, `closeAll()`, `count()`.

---

## 17. Collapsible rows — `Studio.collapse`

```js
var box = Studio.collapse.attach(hostElement, {
  title: 'Filters', descriptive: true, storageKey: 'article-filters'
});
box.setActiveSummary('Excluding results: 2 action filters, a date range');
```

`descriptive: true` starts collapsed — a view whose controls take more room than its content has
buried the content. Existing children of the host move inside automatically.

**A collapsed row that is currently excluding results must say so.** Call `setActiveSummary()` with
a plain description whenever a filter inside it is active, and `setActiveSummary('')` when it is not.

---

## 18. Bulk actions — `Studio.bulk`

**Every list, table, grid and collection gets this, including a notification centre and a history
panel.** Mark rows with `data-bulk-item data-id="…"`.

```js
var ctl = Studio.bulk.attach(listElement, {
  itemSelector: '[data-bulk-item]',
  getLabel: function (id) { return titles[id]; },
  allMatchingCount: function () { return filtered().length; },   // enables "every match"
  allMatchingIds: function () { return filtered().map(r => r.id); },
  actions: [
    { id: 'export', label: 'Export', run: function (ids) { … } },
    { id: 'delete', label: 'Delete', danger: true, destructive: true, run: function (ids) { … } }
  ]
});
// ctl.selected(), clear(), selectPage(), selectAllMatching(), invert(), refresh(), destroy()
```

Click selects, Ctrl or Cmd adds, Shift extends a range, Space and Enter select from the keyboard,
Ctrl+A selects the page. Select-all is **honestly scoped**: "this page" and "every match" are two
different buttons and the bar says when they differ.

Nothing runs without an exact count and a reviewable preview. `destructive: true` routes through the
super-confirmation gate. Return `{ done, skipped, reason }` from `run` and the outcome is reported
honestly instead of claiming the whole batch succeeded.

---

## 19. Locks — `Studio.locks`

Every rendered element and every appearance value can be locked, and **every lock carries its own
credential**. There is no master credential and no inheritance.

```js
Studio.locks.wizard(anchor, 'article:secret', 'The secret article');
Studio.locks.promptUnlock(anchor, key, label, function () { /* unlocked */ });
Studio.locks.isLocked(key); Studio.locks.isUnlocked(key);
Studio.locks.list(); Studio.locks.remove(key); Studio.locks.relock(key);
Studio.locks.manage(anchor);      // searchable, bulk-manageable list
Studio.locks.veil(node, key, label);   // covers a locked region with an unlock affordance
```

The wizard is anchored beside the exact element, names it, offers a password or a one-time code with
a locally drawn QR, confirms an OTP pairing with a live code before arming, and offers an unlock
duration.

Locked items still appear in every search and in the palette, labelled as locked. Locked tabs are
excluded from bulk closes by default.

**It is for fun.** Every surface must say so and name the recovery route.
`Studio.t('msg.notSecurity')`, `Studio.t('locks.own')` and `Studio.t('msg.clearReset')` say all of
it at every level. Never describe it as securing, protecting or encrypting anything.

---

## 20. Support Tickets — `Studio.support`

```js
Studio.support.open(anchor);
Studio.support.create(category, description);
Studio.support.advance(id);
Studio.support.list();
```

The recovery route dressed as a support desk: a category, a description, a ticket number, a severity
nobody will honour, a status that advances, and canned responses. The resolution explains how to
clear this site's storage, shows the exact origin, and offers to do it through the
super-confirmation gate.

**One plain line, outside the comedy and identical at every funny level**, states that nothing is
sent anywhere, no ticket exists outside this browser, no network request is made, no data is
collected and nobody is reading it. Render it as `<p class="note--plain">` with
`Studio.t('tickets.plain')` — not a banner, no emoji, no styling. Nobody should sit waiting for a
reply that was never coming.

Link to it from your unlock prompts as **Forgotten your password?**.

---

## 21. Authenticator, QR and TOTP

```js
Studio.qr.encode(text)            // { size, modules[][], version, mask, level }
Studio.qr.svg(text, { label })    // an <svg> element, drawn from these bytes
Studio.qr.otpauthUri({ issuer, account, secret, algorithm, digits, period })
Studio.qr.parseOtpauth(uri)
Studio.totp(secretBase32, { algorithm, digits, period, timestamp, offset })
Studio.base32.encode(bytes); Studio.base32.decode(str)
Studio.hash.sha1|sha256|sha512|hmac|pbkdf2|hex|utf8|base64
```

Byte mode, error-correction level M, versions 1–15. A remote QR service would hand the secret to
somebody else's server on the way to rendering it, which is the one thing a pairing code must never
do. Always show the manual base32 secret beside the code, grouped and copyable, with the algorithm,
digit count and period stated — a QR is useless to somebody who cannot see it, and useless again to
somebody pairing on the very device showing it. The code is drawn true black on true white with its
quiet zone, never tinted to the theme.

```js
Studio.authenticator.open(anchor);
Studio.authenticator.add({ issuer, account, secret, algorithm, digits, period });
Studio.authenticator.list(); remove(id); code(id, offset);
Studio.authenticator.clockWarning();
Studio.authenticator.selfTest();   // the RFC 6238 published test vectors
```

RFC 6238 over RFC 4226, SHA-1, SHA-256 and SHA-512, 6–8 digits, arbitrary period. Live code, a
countdown, a peek at the next code, and a searchable, bulk-manageable list. Implemented in pure
JavaScript rather than through WebCrypto, because `crypto.subtle` is unavailable outside a secure
context and a copy of this site opened from a local file would otherwise lose its authenticator
entirely.

Secrets stay in this browser and are **left out of ordinary exports**, and the export says so.

---

## 22. History — `Studio.history`

```js
Studio.history.record('settings', 'Theme set to dark', { 'theme.mode': 'dark' });
Studio.history.all(); actions(); diff(id); restore(id); label(id, text); prune(keep);
Studio.history.open(anchor);
```

**Append-only.** Restoring an earlier state writes a **new** entry, so an undo can itself be undone,
and that undo undone in turn. A restore that discarded what it replaced is the one failure mode that
makes a history panel unsafe to open.

Record anything a visitor can change and would want back. The runtime already records every theme,
language, appearance, lock and authenticator change.

The panel has an advanced date picker, filters by the **real recorded actions with counts** derived
from the log, text search with the regex builder, per-entry diffs, restore, labelling, pruning and
redacted export — and the filters compose rather than override.

`Studio.history.actions()` returns `[{ action, count }]` from the log itself, never a hard-coded
list that drifts from what the site actually records.

---

## 23. Dates — `Studio.datePicker`, `Studio.parseDate`

```js
var picker = Studio.datePicker({ from: null, to: null, range: true,
  onChange: function (from, to) { render(); } });
// picker.el, picker.from(), picker.to()

Studio.parseDate('2026-08-13')   // { ok: true, date }
Studio.parseDate('31/02/2026')   // { ok: false, error: 'There is no day 31 in month 2.' }
```

Month and year jump, range selection, named presets, and typed dates in **both** the locale's own
order and plain ISO. An invalid or partial entry is reported inline and **the typed text is kept** —
wiping the box the moment somebody has typed three characters is the fastest way to make a date
field unusable.

---

## 24. Export — `Studio.exportData`, `Studio.exportDialog`

```js
Studio.exportDialog(rows, { name: 'articles', anchor: buttonEl,
                            omitted: 'Draft bodies are left out of this file.' });

var out = Studio.exportData(rows, 'csv', { name: 'articles' });
// { text, mime, ext, filename, warnings, encoding: 'UTF-8', schemaVersion: 1 }
Studio.exportFormats();
```

JSON, JSONL, YAML, TOML, XML, CSV, TSV, Markdown, HTML and SQL. Every file states its encoding, line
endings and schema version.

**A format that cannot carry a field warns before the export runs**, naming the exact fields. Show
`out.warnings` — the dialog already does. Silently flattening a nested field into `[object Object]`
is what this prevents.

This site cannot open a local editor the way the desktop application can. It says so and offers
download and copy instead.

---

## 25. Markdown — `Studio.markdown`

```js
Studio.markdown.render(text);          // an HTML string
Studio.markdown.renderInto(node, text) // adds .wds-md and fills it
```

**One renderer, shared by every article body and every piece of text this site did not write
itself.** Headings, paragraphs, lists, blockquotes, fenced code, inline code, bold, italic,
strikethrough, links, images, tables (wrapped in `.scrollx`) and rules.

Escaped first, then a safe subset is re-introduced. `javascript:` and `data:` hrefs are neutralised
to `#`; remote images are refused and their alt text is rendered instead. Empty input gets an honest
empty state, never a blank region that reads as a loading failure.

---

## 26. Dim sum — `Studio.dimSum`

A 10 per cent chance at each launch, fired automatically. It never gates the page, never takes
focus, auto-dismisses, and **cannot be opted out of**. School mode suppresses it as part of removing
every dim sum capability, which is not the same thing as an off switch.

```js
Studio.dimSum.catalog();          // bundled, photo-free: { id, en, zh, file }
Studio.dimSum.photosEnabled(); setPhotosEnabled(false);
Studio.dimSum.photoUrl(dish);
Studio.dimSum.maybeShow(true);    // force one, for a demo
```

The dish **names are bundled**, so the surprise works with no network at all. The **photo** is the
one and only network request this site can make: an `<img>` pointing at the public dim-sum catalog's
release asset, with an honest "photo unavailable offline" state, named in the settings, and
switchable off. Nothing is copied into this repository. Offer the setting with
`Studio.t('dimsum.photoSetting')` and `Studio.t('dimsum.photoNote')`.

---

## 27. Accessibility — `Studio.a11y`

```js
Studio.a11y.announce(message, assertive);
Studio.a11y.reducedMotion();
Studio.a11y.trapFocus(root, { initial, restore });   // → release()
Studio.a11y.roving(container, { selector: '[role="tab"]', axis: 'vertical', onMove });
Studio.a11y.focusables(root);
```

`roving` takes the **axis**, and the axis decides which arrow keys move. A vertical strip driven by
left and right arrows looks perfect in every screenshot and cannot be used by keyboard.

---

## 28. Settings surfaces

```js
container.appendChild(Studio.settingRow({
  id: 'appearance.density',
  label: 'Density', secondary: '密度',
  explain: 'Changes the height of rows, controls and toolbars. Text size does not change, because shrinking type is a legibility change rather than a density one.',
  storageKey: 'theme.density',
  shippedValue: 'comfortable',
  control: densitySelect.el,
  onReset: function () { Studio.theme.setDensity('comfortable'); }
}));
```

Every settings element carries its **full explanation behind progressive disclosure** and a truthful
**provenance line** that names the real value: "Not set here, so this site is using its own value:
comfortable", or "Set in this browser to: compact". Never the opaque word "default".

The row is appearance-editable and lockable and carries its own context menu automatically.

```js
Studio.makeSwitch({ checked, ariaLabel, onChange })
Studio.makeSlider({ min, max, step, value, ariaLabel, format, onInput, onChange })
```

**Every settings surface also needs**, and the runtime does not add for you:

- its own search bar wired to the builder (`Studio.createSearchBar`), which reports when a match sits
  on a different tab;
- browser-style **tabs** for its sections (`Studio.tabs.create`), carrying the full tab feature set.
  "It is only settings" is not an exemption, and neither is "it is a dialog".

---

## 29. Privacy — `Studio.privacy`

```js
Studio.privacy.storagePrefix   // 'wds.'
Studio.privacy.origin
Studio.privacy.note            // one honest sentence for a privacy page
Studio.privacy.networkRequests()  // [] when dish photos are off; one entry when they are on
Studio.privacy.clearAll()      // the reset for everything
```

Print `networkRequests()` on your privacy page rather than asserting "no network requests" — it is
computed from the actual setting, so it cannot become a lie.

---

## 30. Small helpers and events

```js
Studio.el('button', { class: 'btn btn--filled', type: 'button', onclick: fn,
                      'aria-label': 'Save', dataset: { id: '3' } }, [ Studio.icon('check'), 'Save' ])
Studio.append(node, children); Studio.clear(node);
Studio.icon(name, extraClass);      // inline SVG, never an icon font
Studio.uid(prefix); Studio.escapeHtml(s); Studio.escapeRegex(s);
Studio.copy(text); Studio.download(filename, text, mime);
Studio.flash(node);                 // the teleport highlight
```

Icon names: `search close check minus chevronRight chevronDown chevronUp chevronLeft more plus pin
folder lock unlock palette settings info warn error success copy download upload trash filter
history key calendar grid list dock bell doc globe text reset play stop eye ticket drag`.

Never use a ligature icon font. It puts the glyph's name into `textContent`, so a name the font does
not carry renders as a literal English word, and every assertion that reads text starts failing with
the icon name glued to the label.

```js
Studio.on('ready' | 'i18n' | 'theme' | 'vocab' | 'school' | 'notify' |
          'history' | 'locks' | 'tabs' | 'tab-selected', fn)   // → unsubscribe
```

---

## 31. CSS you can use

From `material.css` — Material Design 3 components, matching
`design-system/components/*.html` exactly:

`.btn` with `--filled --tonal --outlined --text --elevated --icon --danger --fab --fab-sm --fab-lg
--fab-ext` · `.segmented` `.segbtn` · `.field` with `--filled --outlined --dense` and
`.field__box __label __input __val __ph __aff __help`, states `.is-focus .is-error .is-disabled` ·
`.chip` `.chip--elev` `.chipset` `.status` with `--ok --warn --error` · `.card` with
`--elev --fill --out` · `.list` `.li` `.li--action` `.li__t __h __s` `.avatar` `.divider` ·
`.switch` + `.knob` · `.cbx` `.rad` `.ctl` · `.slider` `.slider__row __value __ticks` ·
`.prog` `.prog__bar` `.prog--indeterminate` `.spinner` · `.badge` `.badge--dot` `.badge-anchor` ·
`.tip` `.tip--rich` · `.appbar` `.appbar__title __actions` · `.rail` `.rail__item __pill` ·
`.drawer` `.drawer__section __item __label` · `.tabs` `.tabs__tab` · `.menu` `.menu__hd __i __sep
__empty __count` · `.scrim` `.dlg` `.dlg__head __body __acts` `.sheet` · `.snack` with
`--error --warn --success` · `.scrollx` `.tbl` · `.surface` `.panel` `.note` `.note--warn`
`.note--plain` `.banner` `.row` `.col` `.stack` `.cap` `.muted` `.visually-hidden` ·
`.i` `.i--sm` `.i--lg` `.i--filled` · type helpers `.t-display-large` … `.t-label-small`.

`.is-sel` marks selection, `.s-hover .s-focus .s-press .s-disabled` force a state for a specimen.

From `site.css` — layout: `.skip` `.shell` `.shell__main` `.site-appbar` `.site-brand`
`.wrap` `.wrap--wide` `.prose` `.lede` `.grid` `.grid--2` `.pair` `.site-footer`. Everything
prefixed `.wds-` belongs to the runtime; do not restyle it in a page.

`.note--plain` exists for one purpose: a line that must never be dressed by a funny level, a theme
accent or an emoji. Use it for the Support Tickets disclosure and nothing decorative.

---

## 32. Boundaries, stated plainly

- **BigInt is required** (SHA-512 and the TOTP counter). Every browser since 2020 has it.
- **Workers** give the regex builder its hard timeout. Opened from `file://` the page still works;
  the builder falls back to a capped main-thread evaluation and says so.
- **Font enumeration is impossible** without a permission-gated API only one engine ships. The picker
  measures availability instead and reports which families this machine actually has.
- **Clock skew** cannot be checked against a time server without a network request. The
  authenticator reports an obviously wrong year and any offset the visitor records, and no more.
- **Locks, School mode and the authenticator are conveniences, not security.** Everything is in the
  visitor's own browser, readable by anyone with the machine and a developer console. Say so.
- **`role="group"` inside `role="tablist"`** is not in ARIA. It is the closest structure that still
  conveys tab groups; the alternative conveys nothing.
- **Row height at `dense` density is 40 px.** That is the documented density contract for list rows;
  interactive controls keep their full target at every density.
