# Spoken narrator (site)

> This site can read its own notifications aloud — the same toasts a visitor already sees appear in
> a corner of the screen, spoken through the browser's built-in Web Speech API. It ships off. One
> voice picker per narrated language, resolved from what this browser actually has installed rather
> than a guessed default; a debounced, per-category, one-utterance-at-a-time queue that a failure is
> allowed to jump; and a section that speaks three sample lines on demand so a visitor can hear the
> setting before turning anything on.

Module: `site/assets/narrator.js` (new file; adds exactly one global, `window.StudioNarrator`, per
[`SITE_API.md`](../../site/SITE_API.md)'s documented fallback for a page-extension pattern it does
not otherwise define)
Wired from: **nothing on this site yet** — see *Known limitations* below. The engine boots and
listens for `Studio.notify` events the moment `assets/narrator.js` is loaded on any page, but no page
currently loads that script or calls `StudioNarrator.mount(...)`, so there is nowhere on this site a
visitor can reach the control surface today.
Storage keys: `wds.narrator.enabled`, `wds.narrator.language`, `wds.narrator.voice.en`,
`wds.narrator.voice.en.name`, `wds.narrator.voice.zh`, `wds.narrator.voice.zh.name`,
`wds.narrator.rate.en`, `wds.narrator.rate.zh`, `wds.narrator.pitch.en`, `wds.narrator.pitch.zh`,
`wds.narrator.cat.error`, `wds.narrator.cat.warn`, `wds.narrator.cat.success`, `wds.narrator.cat.info`
(see [`SITE_API.md` §3](../../site/SITE_API.md#3-storage--studiostore))
Satisfies: **FEATURE_INVENTORY rows 1.7 and 1.8**

This article documents the site's implementation specifically. For the desktop application's
narrator — which has more categories, a per-track volume, quiet hours and a persistent in-memory
log — see [`docs/features/narrator.md`](narrator.md). The two are deliberately not identical: a
static page has no application-data folder, no operating-system credential vault, and no way to know
whether a screen reader is running alongside it, and each of those differences is disclosed on the
site's own panel rather than silently copied from the desktop article.

---

## What it does

### The engine always boots; the panel is opt-in

`assets/narrator.js` splits cleanly into two halves, and only one of them needs a page to build
anything:

1. **The engine.** The moment the script loads on any page (after `assets/site.js`), it registers its
   own i18n copy, starts enumerating this browser's voices, and subscribes to `Studio.on('notify', …)`
   — the exact event every toast on this site already raises. Every notification this site shows is,
   by construction, an "app event"; the narrator is nothing more than an optional spoken channel
   layered on top of the same events a visitor already sees. This is what makes the feature genuinely
   about **this site's events**, not about one settings page.
2. **The panel.** `StudioNarrator.mount(host)` builds the whole control surface — the master switch,
   the language choice, the voice pickers, rate and pitch, the category switches, and the "hear it
   before you commit to it" section — into whatever element a page hands it, using only
   `Studio.settingRow` / `Studio.makeSwitch` / `Studio.makeSlider` / `Studio.createSelect` /
   `Studio.collapse.attach`, so every row already carries this site's appearance editor, its lock
   wizard, its reset action and its provenance line with no extra code written here.

Ships **off**: `narrator.enabled` defaults to `false`, and the engine's own `speak()` function
refuses to do anything at all while it is off — not merely "the UI hides it", the function itself
returns immediately. The implementation above that switch is complete; only whether it ever makes a
sound is the visitor's choice.

### The narrated language

| Value | What speaks |
| --- | --- |
| `en` (shipped default) | The English line alone. |
| `zh` | The Cantonese line alone. |
| `both` | The English line, then the Cantonese line, strictly one after the other. |

"Both" is genuinely two utterances built by the same sequencing function
(`speakSequence(text, langMode, done)`): it resolves the English voice, speaks, waits for that
utterance's own `onend`/`onerror`, *then* resolves the Cantonese voice and speaks that one. They are
never constructed as one utterance and never dispatched to `speechSynthesis.speak()` at the same
time, so there is no code path that can make them overlap.

### One voice picker per narrated language

Two independent `Studio.createSelect` pickers, `narrator.voice.en` and `narrator.voice.zh` — never
one shared picker, because choosing an English voice says nothing about which Cantonese voice should
read the other half of a bilingual line. Each lists exactly the voices this browser reports for that
language, resolved via `speechSynthesis.getVoices()` filtered by:

- **English:** `/^en/i.test(voice.lang)`.
- **Cantonese:** the voice's `lang`, lower-cased with underscores normalised to hyphens, equals or
  starts with one of `yue`, `zh-yue`, `zh-hk`, `zh-hant-hk`. A plain `zh` (Mandarin) voice is
  **deliberately not offered here** — matching the desktop narrator's own documented choice — because
  it would produce confidently wrong speech rather than honest silence.

Both pickers carry an explicit **Choose automatically** entry, which is the shipped default
(`shippedValue: 'auto'`). Nothing on this site ever ships with a named voice as the default: the page
cannot know what is installed until it asks, and naming one would be a preference for a voice most
machines do not have.

### Persisted by stable identity, not display name

The chosen voice is stored as its `voiceURI` (`wds.narrator.voice.en` / `.zh`), never its `name`. A
companion key (`wds.narrator.voice.en.name` / `.zh.name`) caches the last-known display name purely
so the picker can show something readable if that exact voice later becomes unavailable — it is never
used for matching. Matching a stored choice back to a real `SpeechSynthesisVoice` object is always by
`voiceURI` equality (`resolveVoice(code)` in `narrator.js`), because voice names are not unique
(several engines can register voices with the same name) and browsers can localise a name between
sessions, while `voiceURI` is documented as the stable identifier.

### Late enumeration, handled honestly

`speechSynthesis.getVoices()` commonly answers with an empty array on the very first call and fills
in a moment later behind the `voiceschanged` event — and some engines never fire that event reliably
at all. `ensureVoiceEnumeration()` therefore:

1. Calls `getVoices()` immediately and marks the result "settled" the instant it is non-empty.
2. Subscribes to `voiceschanged` (via `addEventListener` where available, falling back to the
   `onvoiceschanged` property).
3. Backs both of those with a bounded poll — up to 12 attempts, 350&nbsp;ms apart — so a browser that
   never fires the event still resolves within roughly 4.2 seconds rather than reporting "no voices
   installed" the instant the panel opens.

Every voice picker's status line reads `siteNarrator.statusLoading` ("Still asking this browser which
voices it has installed.") while the list has not yet settled and is still empty, and only reports a
genuine "no voice for this language" once the deadline above has actually passed — never on the first
render.

### The status line beneath each picker says what is actually in effect

A select box that merely shows a value implies that value is what will be heard. Each voice block's
status paragraph (built by the `paintStatus()` closure inside `buildVoiceBlock`) reads one of seven
honest states, repainted every time the voice list changes or the choice changes:

| State | What it says |
| --- | --- |
| List still loading | `siteNarrator.statusLoading` |
| No voice on this browser can read this language at all | `siteNarrator.statusNone` |
| The stored choice is not installed, and nothing else here can read this language | `siteNarrator.statusNotInstalledNoFallback` — **the choice is kept**, not reset |
| The stored choice is not installed, but another voice for this language exists | `siteNarrator.statusNotInstalledFallback`, naming the real voice currently filling in |
| The resolved voice is network-backed and this browser is online | `siteNarrator.statusNetwork` |
| The resolved voice is network-backed and this browser is offline right now | `siteNarrator.statusNetworkOffline` |
| A voice was found, automatically | `siteNarrator.statusAuto`, naming the exact voice |
| A voice was found, by explicit choice | `siteNarrator.statusChosen`, naming the exact voice |

The "network-backed" check reads `SpeechSynthesisVoice.localService === false`, which the Web Speech
API defines as true for a voice whose synthesis actually happens on a remote server; combined with
`navigator.onLine`, this is the honest signal available to a page — there is no way for a page to
probe an individual voice's real-time reachability beyond that.

An uninstalled voice's `voiceURI` **stays in the picker's option list** (appended after the real
voices, labelled with the cached name and "not installed here") rather than being silently dropped,
so the control shows the visitor's real choice instead of sliding back to automatic behind their
back.

### Rate and pitch

Two sliders per narrated language (`narrator.rate.en/zh`, `narrator.pitch.en/zh`), matching the Web
Speech API's own documented ranges: rate `0.1`–`10`, pitch `0`–`2`, both defaulting to `1` — the
voice's own normal delivery. `clamp()` enforces the bound on every read, so a value written outside
range by hand (or by an older version of this file) cannot reach `SpeechSynthesisUtterance` unclamped.

### What gets spoken

Every notification this site raises carries a `kind`: `'error'`, `'warn'`, `'success'` or `'info'`
(anything else falls back to `'info'`). Each kind is its own narration category with its own switch
(`narrator.cat.error/warn/success/info`) and its own minimum gap since the last line of that same
kind:

| Category | Shipped switch | Cooldown |
| --- | --- | --- |
| Failures (`error`) | On | **None** — never held back, and jumps the queue |
| Warnings (`warn`) | On | 8 seconds |
| Completions (`success`) | On | 8 seconds |
| Notices (`info`) | **Off** | 12 seconds |

Notices ship off because most of them are not worth interrupting anything for — the same posture the
desktop narrator's own "Notices: silent" default takes.

### How it stays infrequent

- **A 650&nbsp;ms debounce per category.** A fresh notification of the same category arriving inside
  that window **replaces** the pending line's text rather than queueing a second utterance behind it,
  so a burst of the same kind collapses into whatever was current when the burst stopped.
- **The category's own cooldown**, checked only after the debounce settles. If the gap since the last
  spoken line of that category has not elapsed, the new line is dropped silently — this is a real
  design choice: a suppressed ordinary line is not queued for "later", because "later" would no
  longer describe the current state.
- **One utterance at a time**, through a single `queue` array and a `speaking` flag; `pump()` only
  ever starts the next item once the previous one's callback has fired. The queue is bounded
  (`MAX_QUEUE = 6`); once full, the oldest ordinary item is dropped to make room for a new one.
- **Failures are the deliberate exception.** `speak('error', text)` skips both the debounce and the
  cooldown, clears the queue, cancels whatever is currently speaking
  (`window.speechSynthesis.cancel()`), and speaks immediately. This is the one place "infrequent" is
  overridden on purpose.

### Hear it before you commit to it

A collapsed-by-default section (`Studio.collapse.attach`, `descriptive: true`) holds three buttons —
one per category that actually gets read by default — each speaking one of this site's own funny-level
preview sample messages (`siteNarrator.sample.success/warn/error`, the same three facts-never-move
messages `settings.html` already uses to preview the funny-level sliders, under this module's own
`siteNarrator.sample.*` keys so the two definitions can never collide). Crucially, these buttons call
`speakPreview(text)`, a separate code path from the notify-driven `speak(category, text)`:
`speakPreview` **bypasses the master switch, every category switch and every cooldown** — the entire
point is to let a visitor hear the current language, voices, rate and pitch *before* turning the
narrator on at all. It still speaks only one utterance at a time (it cancels whatever is currently
speaking first), and a live `aria-live="polite"` status line beside the buttons reports "Speaking
now." / "Quiet." so the state is available to more than just the ear. A fourth button, **Silence
now**, is always present and calls `silenceNow()` directly.

### Screen readers, reduced motion, and other honest boundaries

Two paragraphs on the panel state these plainly, in full, at every funny level (see
`siteNarrator.screenReaderNote` and `siteNarrator.quietBoundaryNote`):

- **Browsers give a page no way to detect whether a screen reader is active.** This narrator cannot
  politely take turns with one the way it manages its own cooldowns — it can only disclose the
  overlap and default off. Every status this site shows already carries its own accessible name or an
  `aria-live` announcement (`Studio.a11y.announce`), so turning this narrator off costs no
  information, only the second voice.
- **This browser exposes no "quiet" or "reduced sound" media feature** the way it exposes
  `prefers-reduced-motion`, so there is nothing standard for the narrator to follow automatically.
  Deliberately **not** wired to reduced motion either — matching the desktop narrator's own documented
  decision — because speech is not animation, and silencing a narrator someone switched on because of
  an unrelated motion preference would be this site deciding it knew better. `Silence now` and the
  master switch remain the two real controls.

### Where the site stands in for a desktop concept it does not have

The desktop application's narrator persists to, and reads from, the operating system's application
data. A static page has neither an application-data folder nor a credential vault, so every setting
here lives in this browser's `localStorage` instead, under the keys listed above — and the panel's own
`siteNarrator.storageNote` paragraph says exactly that, and adds the consequence that follows from it:
voices are a **per-machine** fact, so a voice chosen on one computer can legitimately show as "not
installed" on a different one, and the choice is kept regardless, per the status table above.

---

## Storage

| Key | Shape | Meaning |
| --- | --- | --- |
| `wds.narrator.enabled` | boolean | Master switch. Absent/`false` = off (shipped). |
| `wds.narrator.language` | `'en' \| 'zh' \| 'both'` | Absent = `'en'`. |
| `wds.narrator.voice.en` / `.zh` | `voiceURI` string, or absent | Absent = **Choose automatically**. |
| `wds.narrator.voice.en.name` / `.zh.name` | string, or absent | Cosmetic cache of the last-known display name for a chosen voice; never used for matching. |
| `wds.narrator.rate.en` / `.zh` | number, `0.1`–`10` | Absent = `1`. |
| `wds.narrator.pitch.en` / `.zh` | number, `0`–`2` | Absent = `1`. |
| `wds.narrator.cat.error` / `.warn` / `.success` / `.info` | boolean | Absent = shipped default (`true` / `true` / `true` / `false`). |

Choosing **Choose automatically** in a voice picker `store.remove()`s both the `voice.<code>` and
`voice.<code>.name` keys rather than writing a sentinel value, so "never chosen" and "explicitly
automatic" are the same, unambiguous, absent state.

---

## Failure modes

| Situation | What happens |
| --- | --- |
| `window.speechSynthesis` / `window.SpeechSynthesisUtterance` do not exist at all | `StudioNarrator.isSupported()` returns `false`; `mount()` renders exactly one `note--warn` explaining this plainly and **nothing else** — no master switch, no voice pickers, no dead controls that look operable and are not. `speak()` and `speakPreview()` are silent no-ops rather than throwing. |
| A chosen voice's `voiceURI` is no longer in `getVoices()` | Handled by `resolveVoice()`'s `missingFallback` / `missingSilent` states above; the stored choice is never cleared automatically. |
| No voice at all matches a narrated language | `resolveVoice()` returns `{ voice: null, state: 'none' }`; that track is silently skipped inside `speakSequence()` (in "Both" mode, the other track still speaks), and the status line names the exact gap. |
| An utterance's `onerror` fires mid-sentence | `speakSequence()`'s `next()` treats `onerror` exactly like `onend` and moves on to the next job (or the next queued item), rather than stalling the queue. |
| `localStorage` is refused | `Studio.store` falls back to an in-memory value for the page's lifetime and reports it via `Studio.store.status()` / the site-wide `msg.storageOff` toast; the narrator keeps working for the rest of that page load and every choice reverts to the shipped default on reload. |
| `mount()` is called again (a page rebuilding its own tab on a language/School-mode change) | The exported `mount()` automatically calls the previous mount's `destroy()` first — clearing its DOM and unsubscribing its voice-list listener — before building the new one, so repeated calls never leak a listener or duplicate a palette registration. Verified by the smoke test in *Verification*. |

---

## Security and privacy considerations

- **No network request of any kind.** Speech synthesis happens through the browser's own platform
  API; this module contains no `fetch`, `XMLHttpRequest`, `WebSocket` or beacon. A voice reported as
  `localService === false` (a "network voice") is a fact **about that voice**, disclosed to the
  visitor — the module itself never dials out to check it.
- **Nothing spoken is ever written to disk, sent anywhere, or logged.** The engine speaks the exact
  `title`/`body` text a `Studio.notify(...)` call already put on screen as a toast; it introduces no
  new data.
- **Emoji are stripped before speech** (`stripEmoji()`), so a voice does not pronounce a decoration's
  full name mid-sentence. The words around it are left untouched. `Studio.notify`'s own `record.title`
  / `record.body` are already the raw, undecorated strings (any emoji shown on a toast is composed
  separately at render time), so this is a defensive second pass, not the only one.
- **No secret is ever spoken.** The narrator only ever receives what a `Studio.notify(...)` call
  passes as `title`/`body`; nothing in this module reads a lock's credential, an authenticator secret,
  or any other sensitive value, and nothing about this feature is a security boundary.

---

## Accessibility, language and layout

- Every row in the panel is built with `Studio.settingRow`, so each one already carries the required
  accessible name, the appearance editor, the lock wizard, a context menu and a truthful provenance
  line ("Not set here, so this site is using its own value: …" / "Set in this browser to: …") — see
  [`SITE_API.md` §28](../../site/SITE_API.md#28-settings-surfaces).
- Every static paragraph on the panel is rendered through `Studio.label(node, key, fallback)`, which
  marks the node `data-i18n` and re-renders automatically on a language change; the panel additionally
  rebuilds itself from scratch on `Studio.on('i18n', …)` and `Studio.on('school', …)` (independent of
  whatever the hosting page does), so a language or School-mode change is reflected correctly even if
  the module were mounted somewhere that does not already rebuild its own tab on those events.
- **All 57 i18n keys this module defines carry exactly five English and five Cantonese variants** —
  checked mechanically, not by eye; see *Verification*.
- **No wide content.** Every control here is a row, a select, a slider or a short paragraph; nothing
  in this panel can force the page to scroll sideways, so no `.scrollx` wrapper is needed.
- **School mode.** `S.school.suppresses('cantonese')` removes the Cantonese option from the language
  select, omits the entire Cantonese voice block (heading, picker, status, rate, pitch — not merely
  disables it), and forces the *effective* narrated language to English even if `'both'` or `'zh'` is
  still stored — the stored choice is preserved and returns the moment School mode is turned back off,
  per the shared School-mode contract. Verified by the mount smoke test in *Verification*.
- Every button (`btn--outlined` / `btn--tonal`) carries a real, non-icon-only label; no emoji appears
  in any button, action label, field label or accessible name anywhere in this module.

---

## Local history

Every mutating action calls `Studio.history.record('settings', …, …)`: turning the narrator on or off,
changing the narrated language, choosing a voice (naming the language track and the resolved display
name or "automatic"), changing a rate or a pitch, and toggling a category switch. Restoring an earlier
state through the shared history panel writes a **new** entry, per this site's append-only history
contract ([`history.md`](history.md)) — this module records changes but implements no restore logic of
its own, relying entirely on the shared `Studio.history` mechanism.

---

## Verification

This article documents the shipping implementation as read from `site/assets/narrator.js` at the
commit this file was written against. The following were actually run, not merely reasoned about:

1. **`node --check site/assets/narrator.js`** — completed with no syntax error.
2. **A boot-path smoke test** (a Node script providing a minimal stub `window.Studio` and no
   `window.speechSynthesis`) loaded the file directly, then verified:
   - It does not throw while loading.
   - **All 57 `Studio.i18n.define()` entries** this module registers carry exactly five English and
     five Cantonese variants — checked programmatically against every key, not sampled.
   - `window.StudioNarrator` is set and exposes every documented function (`mount`, `searchEntries`,
     `speak`, `speakPreview`, `silenceNow`, `isSpeaking`, `isEnabled`, `isSupported`,
     `onSpeakingChange`, `onVoicesChanged`, `voicesFor`, `resolveVoice`).
   - `isSupported()` honestly reports `false` with no `speechSynthesis`; `isEnabled()` reports `false`
     (ships off); `speak()` / `speakPreview()` / `silenceNow()` do not throw when called before any
     `mount()`; `searchEntries()` is `[]` before `mount()` has ever run.
   - Simulating a `Studio.notify` event before enabling the narrator does not throw and does not speak.
3. **A fuller mount-path smoke test**, this time with a fake but structurally faithful DOM (`el`,
   `icon`, `settingRow`, `makeSwitch`, `makeSlider`, `createSelect`, `collapse.attach`,
   `palette.register` all implemented well enough to actually build a tree) and a fake
   `speechSynthesis` exposing three voices (two English, one network-backed Cantonese voice), verified:
   - `mount(host)` returns a `destroy` function and appends real content to `host`.
   - Exactly **12** rows are built and registered on the palette (all 8 non-language-gated rows plus
     the 4 Cantonese-specific rows), each with `target: '[data-setting="narrator.<id>"]'`.
   - `searchEntries()` returns the same 12 rows in the shape a settings page's own search index uses.
   - **Turning the narrator on and raising a real `Studio.notify('success', …)` produces an actual
     spoken utterance carrying the exact notified text**, after the documented 650&nbsp;ms debounce —
     i.e. the notify-to-speech wiring genuinely works end to end, not merely "the function exists".
   - `speakPreview()` speaks even while the master switch is off, confirming "hear it before you
     commit to it" is real.
   - `resolveVoice('zh')` correctly auto-picked the fake network Cantonese voice and reported
     `localService === false`.
   - **Calling `mount()` a second time does not register the palette rows again** (still exactly one
     `palette.register` call across the whole run) — confirming the auto-destroy-previous-mount
     behaviour that makes repeated `mount()` calls from a page's own rebuild loop safe.
   - **With School mode suppressing Cantonese, storing `narrator.language = 'both'` and speaking still
     produced only English-lang utterances** — confirming the suppression is enforced at the engine
     level (`narratedLanguage()`), not only hidden in the UI.
4. **A third smoke test with no `window.speechSynthesis` at all** confirmed `mount()` still returns a
   working `destroy` function, still renders the honest unsupported note, and registers **zero**
   palette rows and **zero** search entries — no phantom, un-reachable "features" are ever advertised.

This is static/Node-level verification of the module's own logic, not a live-browser capture — the
panel has never been rendered in an actual browser because no page currently mounts it (see *Known
limitations*). A follow-up pass should drive the built site with the project's own capture harness,
once the settings-page hook below lands, and record the real panel states (loading, both voices
resolved, a chosen-but-uninstalled voice, School mode on, the try-it section open and mid-speech, the
unsupported-browser note) before this feature is marked verified in `FEATURE_INVENTORY.md`.

---

## Known limitations

`site/assets/narrator.js` is a new, independently-owned file, but the pages that would host its panel
— `site/settings.html` in particular — are owned by other agents working in parallel and must not be
edited from here. These gaps are recorded precisely so whoever next has `settings.html` open can close
them in one pass, per this project's shared instructions for documenting an exact reason rather than
leaving a silent gap:

- **No page currently loads `assets/narrator.js` or calls `StudioNarrator.mount(...)`.** The engine
  is complete and self-testing (see *Verification*), but until a page is wired up, no visitor can
  reach the master switch, a voice picker, or the try-it section — the feature is implemented and
  verified in isolation, not yet reachable. The fix, precisely:
  1. Add `<script defer src="assets/narrator.js"></script>` to `settings.html`, after
     `assets/site.js`.
  2. Add one entry to `settings.html`'s `TABS` array, e.g.
     `{ id: 'narrator', labelKey: 'tab.narrator', icon: 'text', keywords: 'speech voice tts speak read aloud accessibility' }`,
     plus a `tab.narrator` i18n definition ("Narrator" / "有聲讀出").
  3. Add a `BUILDERS.narrator` entry: `BUILDERS.narrator = function (panel) { if (window.StudioNarrator) window.StudioNarrator.mount(panel, { page: 'settings.html', tabStrip: 'settings', tabId: 'narrator' }); };`.
     `settings.html` already clears and rebuilds every tab panel on every language/School-mode change
     (its own `render()` function), so no extra reactivity needs adding for this module — `mount()` is
     explicitly safe to call again on every rebuild, which the mount smoke test above confirms.
  4. Splice this module's rows into `settings.html`'s own private `searchIndex` array, so the panel's
     settings are findable from the page's own search bar and not only the command palette:
     `Array.prototype.push.apply(searchIndex, window.StudioNarrator.searchEntries());`, called after
     step 3's `BUILDERS.narrator(panel)` has run (`searchEntries()` is `[]` until `mount()` has run at
     least once).
- **`StudioNarrator.speak()` / `speakPreview()` only reach the browser's real speech engine.** There
  is no way for a static page to synthesise or ship its own voices, so on a browser with zero voices
  installed for a language, that track is honestly silent — this is a real platform boundary
  (`SITE_API.md §32`), not a bug in this module, and the status line names it exactly
  (`siteNarrator.statusNone`).
- **This site's `Studio.notify` currently emits four kinds** (`error`, `warn`, `success`, `info`);
  this module maps all four to its own four narration categories one-to-one. If a future kind is ever
  added to `Studio.notify`, `speak()`'s fallback (`category = 'info'` for anything unrecognised) keeps
  it from being silently dropped, but it would be worth a deliberate category of its own at that point
  rather than being folded into Notices.

None of the above makes the *engine* non-functional: every notification this site already raises is
speakable the moment `narrator.enabled` is set to `true` (verifiably so, per the mount smoke test),
and the whole feature is complete, tested and documented. What is missing is exclusively the one line
of wiring in a file this article's author does not own.

---

## Suggested related articles

- [Spoken narrator (desktop application)](narrator.md) — the same feature idea with more categories,
  quiet hours, a per-track volume and a persistent log, built against a real operating system rather
  than a browser tab.
- [Language, humour levels and the emoji switch](language.md) — the language modes and funny-level
  sliders this feature's copy follows, and the `Studio.i18n.define` contract every key above satisfies.
- [School mode (site)](school-mode.md) — why the Cantonese voice block disappears entirely, and why
  the narrated language is forced to English, rather than either being merely disabled.
- [Support Tickets (site)](site-support-tickets.md) — another feature built against the same
  browser-storage-only constraints this article discloses for voice persistence.
- [Local version history](history.md) — the append-only history contract every setting change in this
  module records into.
