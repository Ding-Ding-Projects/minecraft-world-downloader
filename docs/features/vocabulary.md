# Personal vocabulary

**Module:** `app/src/renderer/features/vocabulary/`
**Surfaces:** the **Personal vocabulary** destination, nine command-palette entries, three bundled
documentation articles, and the always-present upload control in the **Language and voice** settings
section (owned by the core language module, listed here because it is the same capability).

This feature lets a user replace the desktop application's wording with their own, from one local
JSON file. It ships **no vocabulary of its own** — no mappings, no samples, no templates carrying
real values — so until the user supplies a valid file, every surface renders exactly the wording the
build shipped with and the replacement step is the identity function.

Satisfies **FEATURE_INVENTORY row 1.6** ("Personal-vocabulary JSON upload control, always visible
even before a file exists").

---

## What it does

### The upload control is always there

Two routes, both present before any file has ever existed:

| Route | Where | Owner |
| --- | --- | --- |
| **Choose a JSON file** | The **Personal vocabulary** destination | this feature |
| **Personal vocabulary file** | Settings → **Language and voice** | `core/coreFeature.ts` |

A control that appears only once a vocabulary is loaded is a control nobody can use to create the
first one, which is why "always visible even before a file exists" is the row's actual wording.

Both routes use the platform's own file picker, are keyboard and screen-reader operable, and meet
the 44 CSS-pixel touch-target minimum. Both end at the same validator and the same cache.

### The five states, named honestly

| State | What the destination says |
| --- | --- |
| **No file** | "No file loaded", plus the explicit statement that the application holds no vocabulary of its own and nothing is replaced. |
| **Loaded** | "{active} of {total} replacements active", the load time, and where the cache lives. |
| **Loaded, empty** | "A file is loaded and it contains no replacements" — a valid document that asks for nothing is a real state, not an error. |
| **Refused** | The exact rule the file broke, plus "Nothing was applied from it, and what was already loaded is unchanged." |
| **Replace / clear** | The primary button reads **Choose a JSON file** with nothing loaded and **Replace the loaded file** once something is; **Clear and restore the original wording** is separate and gated. |

A sixth state exists for honesty rather than by design: if a vocabulary was loaded through the
settings-surface control, this destination can see that replacements are applied but cannot always
list them, and it says so instead of claiming nothing is loaded.

### Validation

One documented, versioned, bounded schema, validated over the **complete byte payload** before
anything is displayed, applied or cached. See
[the schema section](#the-file-format) below for the full contract.

The decisive property: **a file that breaks any rule is refused whole.** There is no partial load.
A file that is good for four hundred entries and wrong on the four hundred and first applies none of
them, and whatever was loaded before is untouched.

### Working with what is loaded

The destination lists every loaded replacement in a table with:

- a **search field** carrying its anchored regular-expression builder, plain text by default;
- **multi-select** with shift-click ranges and a `Shift`+`ArrowUp`/`ArrowDown` keyboard equivalent;
- **honestly scoped select-all** — "Select the *n* on this page" is a separate control from
  "Select all *n* matching", because a select-all that does not say which it means is a select-all
  nobody can trust;
- **inverse selection** over the current matches;
- **Suppress**, **Restore** and **Remove**, available on one row through its context menu and on a
  whole selection through the toolbar;
- a **reviewable preview** stating what each action would actually change before it is used. "42
  selected" and "42 will change" are different numbers whenever part of a selection is already in
  the state being asked for, and both are shown.

**Suppress** and **Restore** are reversible and change nothing on disk beyond this application's own
cache. **Remove** takes replacements out of the loaded copy and goes through the destructive-action
super-confirmation gate; the user's own file is not modified, so loading it again brings them back,
and the gate's irreversibility line says exactly that rather than overstating the consequence.

### The preview

A sample field and a result pane, running `i18n.applyVocabulary` — the same function the rest of the
application runs, not an imitation of it — so what the preview shows is what every other surface
will do. It reports "Nothing in this sample changes" when nothing changes, which is a useful answer
and a common one.

### Options

Three options, rendered on the destination with the same explanation-behind-disclosure and truthful
default-provenance line that any settings row carries:

| Option | Default | Effect |
| --- | --- | --- |
| **Show the loaded replacements** | shown | Turning it off keeps every replacement working and shows only a count. Useful when the screen is not private. |
| **Replacements per page** | 50 rows | Also defines the scope of "select the page". |
| **Sample text** | empty | What the preview starts with. |

---

## The file format

A JSON object with exactly two fields. Any other field refuses the file.

```json
{
  "version": 1,
  "replacements": {}
}
```

- **`version`** — a whole number. This build understands `1`.
- **`replacements`** — an object whose member names are the text to find and whose values are the
  text to render instead. Every value must be a JSON string; an empty string means "render nothing",
  which is how a word is removed rather than replaced.

The example above is the blank template, and it is the only example this project ships. A documented
"sample vocabulary" would be a shipped vocabulary with a different name on it. **Save a blank
template** on the destination writes exactly that file.

### Limits

| Rule | Limit |
| --- | --- |
| Complete payload | 262144 bytes (256 KiB) |
| Replacements in one file | 2000 |
| Key length | 1 to 120 characters |
| Value length | 0 to 200 characters |
| JSON nesting depth | 2 levels |
| Schema versions understood | 1 |

### Every reason a file is refused

Each carries a stable code. The code is what reaches local history; the sentence is what reaches the
screen.

| Code | Meaning |
| --- | --- |
| `not-text` | The payload was not a string. |
| `empty-file` | No content. |
| `byte-limit` | Larger than the payload limit. Reported with the real byte count. |
| `depth-limit` | Nested deeper than a vocabulary document ever is. |
| `duplicate-key` | Two members of one object share a name. |
| `malformed-json` | The parser refused it; the exact syntax error is shown. |
| `not-an-object` | The top level is an array, number or string. |
| `missing-version` / `unsupported-version` | Absent, non-integer, or a version this build does not understand. |
| `unknown-field` | A field outside the schema. |
| `missing-replacements` / `replacements-not-an-object` | The replacements field is absent or is not an object. |
| `entry-limit` | More replacements than the limit. |
| `reserved-key` | `__proto__`, `constructor` or `prototype` used as a replacement key. |
| `empty-key` / `whitespace-key` | An empty key, or one made only of whitespace. |
| `key-length` / `value-length` | Beyond the length limits. |
| `value-not-a-string` | A value that is a number, object, array, boolean or null. |

Two of these need explaining because they look like pedantry and are not.

**`duplicate-key`.** `JSON.parse` keeps the last of two identical member names and silently discards
the first, so a document that says two different things about one word would be accepted as though
it had only ever said the second. The duplicate is therefore detected by scanning the raw text
before parsing — after `JSON.parse` the evidence is gone.

**`depth-limit`.** Nesting has to be bounded *before* a parser recurses through it, so the same raw
scan enforces it. Two levels is not an arbitrary ceiling: a valid document is exactly the root object
and the `replacements` object inside it.

### Applying order and scope

Replacements are applied **longest key first**, so a longer phrase is never broken apart by a shorter
key that happens to sit inside it. Matching is exact and case-sensitive — this is literal text
substitution, not a pattern language.

Replacement happens at the point user-facing text is rendered, including accessible names. Commands,
URLs, identifiers, code, file paths, exact error text from another program and the factual content of
external records are not user-facing copy and are not touched.

---

## How it works

| File | Responsibility |
| --- | --- |
| `schema.ts` | The contract, the raw structural scan, the validator, serialization, the blank template. No UI, no state. |
| `store.ts` | State, persistence, every operation, history recording, notifications. The only file that talks to the shared language layer. |
| `panel.ts` | The destination: status, upload, schema reference, table with bulk actions, preview, options, privacy statement. |
| `settingrow.ts` | A settings row with its explanation and default-provenance line, for the options this feature keeps on its own destination. |
| `strings.ts` | English and Cantonese copy at all five humour levels, per language. |
| `docs.ts` | The three bundled in-application articles. |
| `emoji.ts` | The one place a decorative emoji is added, and only to dialog and message-box copy. |
| `styles.css` | Material Design 3 tokens only. |
| `index.ts` | The feature module: destination, documentation, copy, commands, and the study-mode wiring. |

### Two validators, deliberately

The store hands the active set to `i18n.loadVocabularyFile`, which validates it **again** on the
shared language layer's own terms. So what ends up applied has passed two independent
implementations of the contract. If they ever disagree, the operation reports a failure rather than
silently applying nothing while the interface claims a vocabulary is loaded.

### Persistence

Everything this feature stores sits under the `vocabulary.` settings prefix:

| Key | Holds |
| --- | --- |
| `vocabulary.source` | The complete validated document, including suppressed entries. |
| `vocabulary.suppressed` | Keys deliberately not applied. |
| `vocabulary.loadedAt` | When the load happened. **Not** the file's own timestamp. |
| `vocabulary.showEntries`, `vocabulary.pageSize`, `vocabulary.sample` | This destination's options. |
| `vocabulary.schoolHiddenTab` | Whether study mode removed the destination from the strip. |

That prefix is load-bearing, not cosmetic: the core settings export and the automatic
settings-history recorder both skip it wholesale, so the private word list cannot reach an exported
file or a durable history entry by being forgotten. The cost is that this destination's ordinary
options are skipped from the settings export too. That is stated here rather than worked around.

The cache is **revalidated at every load**, never trusted. A settings file can be hand-edited, copied
between machines, or written by an older build, and a cache that no longer meets the contract must
not be applied because it once did. When revalidation fails the cache is dropped, the shipped wording
returns, and the destination says the cache was dropped.

### Study mode

While the named study mode is on, the whole capability behaves as though it were **not installed**:

- the destination leaves the tab strip;
- its nine command-palette entries are withdrawn;
- the panel's remembered search, page and selection are dropped;
- the shared language layer stops applying replacements.

The user's file, their suppression choices and their options are kept untouched and return when the
mode is turned off — that is what makes it a user-experience lock rather than a deletion.

**Known residual gap.** The three documentation articles remain in the in-application documentation
index while study mode is on. A feature's articles are registered once at boot and there is no way
for a feature to withdraw one at runtime, so the capability's *existence* is still discoverable
through the documentation browser even though nothing about it can be used. Closing this needs a
`schoolSensitive` flag on `DocArticle` honoured by the registry, which is a core change outside this
feature's directory.

### Why no settings section is registered

This feature registers a destination, documentation, copy and commands — and no `SettingsSection`.
A registered section stays on the settings surface whether the owning feature wants it to or not, and
study mode requires this capability to be omitted rather than disabled. The upload control that
belongs on the settings surface already lives in the language section, which that surface omits
correctly, and this destination's own options are rendered on the destination with the same
obligations any settings row carries.

---

## Security and privacy

### No network, at any point

This feature makes no network request. Not to validate, not to load, not to report an error, not to
check for a schema update. There is no CDN, no remote font, no analytics and no telemetry in it. The
file is chosen through the platform's picker, read through the application's scoped file reader,
validated in the renderer, and cached locally.

### What is stored, and what deliberately is not

The validated replacements are cached in the application's own data folder. **The file itself is not
stored, and neither is its name nor its location.** After a successful load the application knows the
replacements and the time it loaded them, and nothing else about where they came from.

Terms, values, file names and paths never appear in:

- **logs** — no replacement is ever written to a log line;
- **exports** — the settings export skips the whole `vocabulary.` namespace and says so in the
  exported file;
- **version history** — history records that a vocabulary was loaded, refused, cleared, suppressed,
  restored or had entries removed, with counts and a rejection *code*; never a term, never a path;
- **crash reports and diagnostics**;
- **screenshots taken by the project's own capture tooling**, which run from a fresh profile.

**Rejection messages never quote content.** They name the rule, the limit and the position —
"replacement 12", never the replacement itself. That is not caution for its own sake: a rejection
reason is rendered on screen, announced to a screen reader and written into local history, so a
reason that quoted the user's words would put them in a durable record. There is an automated check
for exactly this (see *Verification*).

One consequence worth stating plainly: **clearing cannot be undone from version history**, because
there is nothing in history to restore from, by design. The confirmation gate says so rather than
implying an undo that does not exist. Loading the file again is the way back.

### Failing closed

Every route out of an unexpected state ends at the wording the build shipped with, never at a
half-applied one: a refused file applies nothing; a cache that stops validating is dropped and
reported; clearing purges the cache immediately; study mode stops replacement entirely.

### Bounded input

The byte ceiling, entry ceiling, key and value length ceilings and depth ceiling are all enforced
before the payload is trusted, and the file read itself is bounded by the same byte limit through the
privileged bridge. An oversized file is reported with its real byte count from a `stat` call rather
than from the bridge's own error, because that error names the path.

---

## Failure modes

| Situation | Behaviour |
| --- | --- |
| File will not open, or is larger than the read limit | Notification and rejection banner naming the limit. The path is **not** shown, because the reason is also announced and recorded. |
| File breaks any schema rule | Refused whole. The exact rule is shown; the previous vocabulary is untouched. |
| Persisted cache no longer validates | Dropped, shipped wording restored, and the destination says the cache was dropped with a route to reload. |
| The shared language layer refuses an active set | Reported rather than swallowed; the store returns to "nothing loaded" rather than claiming a vocabulary is applied when none is. |
| A vocabulary was loaded from the settings surface | Adopted for listing where readable; otherwise the destination says the entries cannot be listed here and offers to reload the file. |
| Study mode turned on mid-session | Destination and commands withdrawn live, replacement stops, choices preserved. |
| Study mode turned off | Destination and commands return; the previously active destination is restored so the user is not moved. |
| History write fails | The user's operation still succeeds. History failures are reported through the history status surface, never by failing the thing the user asked for. |

---

## Verification

`scripts` for this feature are the type-checker and a validator exercise; there is no network or
filesystem dependency in either.

**Type-check.** `npm run typecheck` in `app/` covers this feature with the rest of the renderer.

**Validator.** The validator was exercised against 32 cases covering every acceptance path and every
rejection code:

- accepted: the blank template, a single entry, an empty replacement value, a leading byte-order
  mark;
- refused: non-text input, empty file, malformed JSON, array top level, missing/float/unknown
  version, unknown field, missing and non-object `replacements`, duplicate keys at both levels,
  excessive nesting, non-string and null values, empty and whitespace keys, reserved keys, key and
  value length limits, entry limit, byte limit;
- behaviour: an escaped quote inside a key, a colon inside a string not being read as a member
  separator, a brace inside a string not opening a nesting frame, longest-key-first ordering,
  serialization round trip, no prototype pollution;
- **privacy:** four payloads carrying a distinctive marker term through four different rejection
  paths, asserting the marker appears in none of the rejection messages.

All 32 passed. The privacy case is the one worth keeping: it is the check that fails loudly if
somebody later "improves" an error message by quoting the offending value into it.

**What has not been verified yet.** No screenshot of the built artifact exists for this destination.
The capture harness runs from a fresh profile with no vocabulary loaded, which shows the empty state
correctly but cannot show the loaded, refused or suppressed states without a fixture file — and a
fixture file with real values is exactly what this feature must not ship. A capture using a
throwaway generated file (marker terms, deleted afterwards) is the route, and it has not been done.

---

## Suggested reading

- [`language.md`](language.md) — the language modes and humour levels this feature sits beside, and
  the settings section that carries the second upload control.
- [`locks.md`](locks.md) — the toy locks that can be put on this destination's own controls.
- [`accessibility-themes.md`](accessibility-themes.md) — the accessibility and Material Design rules
  every surface here is held to.
- [`notification-centre.md`](notification-centre.md) — where this feature's notifications go and how
  they are reviewed afterwards.
