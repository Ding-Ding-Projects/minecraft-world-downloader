# Scheduled settings, on this site

Schedule the language mode, theme, density, accent colour, fonts and motion this
site renders with, on native date and time pickers, without leaving your browser.

A rule holds one setting at one value inside a window described with native
date and time inputs. When the window ends, the value you had before the rule
started is put back exactly — a scheduled override never quietly becomes your
permanent setting. This is the site's own version of the feature the desktop
application documents in [`scheduled-settings.md`](scheduled-settings.md); the
two share the same idea and the same window semantics, but not the same code,
because a static page has no privileged process to make a network call safely
behind.

| | |
| --- | --- |
| Surface | `site/settings.html`, tab **Scheduled settings** |
| Engine | `site/assets/schedule.js` — `window.StudioSchedule` |
| Storage | `localStorage`, keys `wds.schedule.rules` and `wds.schedule.base` |
| Inventory rows | 7.1, 7.2, 7.3 |
| Network | None. Every rule either uses local data or is shown disabled with the reason. |

---

## What is actually running today

This article is deliberately exact about which of the two pieces below is
doing the work, because the honest answer has a seam in it right now and
pretending otherwise would be the one thing these instructions forbid most
directly.

**The Scheduled settings tab on `settings.html`** is a complete, working rule
editor: native `<input type="date">` and `<input type="time">` controls, an
**Every day** switch with seven weekday chips underneath it when that switch
is off, a priority number, a label, bulk enable/disable/export/delete with a
reviewable preview, per-rule **Edit appearance…** and **Lock this element…**,
and a live **In effect right now** panel that names which rule is holding
which setting. It reads and writes `wds.schedule.rules` and
`wds.schedule.base` directly, in its own inline script, and it evaluates and
applies rules whenever that page is open — on load, and again every time a
rule is added, edited, enabled, disabled or deleted.

**`site/assets/schedule.js`** is a second, independent implementation of the
identical algorithm — same storage keys, same schema version, same
window-matching arithmetic, verified line for line against the tab's own
rules in this project's working notes — built so the schedule can stay live
on *every* page of this site, not only while Settings happens to be open, and
so that scheduling reaches settings the tab's own hand-written list does not
yet cover (see below). As of this writing it is not yet loaded by any page:
see [Known gaps and the exact fix](#known-gaps-and-the-exact-fix).

Because the two share the same storage format, a rule created in the tab is
read identically by the engine and vice versa. Nothing about this seam can
corrupt a rule or make the two disagree about which one is currently active —
the engine is a strict superset of what the tab already does.

---

## Behaviour

### What can be scheduled

The tab's own picker currently offers five settings: **Language mode**,
**Theme**, **Density**, **Motion**, and **Accent colour**. The engine in
`schedule.js` additionally registers **Interface font**, **Text size** and
**Heavier labels**, covering "fonts" and "every other appearance value this
site exposes" as this feature's inventory row requires — those three are not
yet selectable from the tab's picker for the reason given below.

While **School mode** is on, a rule scheduled for Cantonese or bilingual
language mode is silently inert: `Studio.i18n.setMode()` itself refuses to
change the language while School mode is active, so the schedule engine's own
attempt to apply that value is a safe no-op rather than a fight it could win.
Nothing else this feature schedules is affected by School mode.

### Reading a rule

A rule carries an optional **start date** and **end date**, a **start time**
and an **end time**, and either **every day** or an explicit set of weekdays.
Every day means all seven weekdays for that one window — it is one rule, not
seven duplicated ones.

Times are read in this computer's own local time zone, resolved from
`Intl.DateTimeFormat().resolvedOptions().timeZone`. The tab states that zone
by name, and whether it currently observes daylight saving is worked out by
comparing this year's January and July UTC offsets — a comparison that is
correct in both hemispheres, since one of the two months always falls inside
daylight saving for a zone that observes it at all and one always falls
outside it.

### Exact window semantics

| Case | Meaning |
| --- | --- |
| `start < end` | The window is `[start, end)`: the start minute is included, the end minute excluded. A rule ending at 09:00 and one starting at 09:00 are never both in effect. |
| `end < start` | The window wraps past midnight and belongs to the day it **started** on. A rule for "Friday 22:00 to Saturday 02:00" only needs Friday selected. |
| `start == end` | **A zero-length window. It never matches.** This is a stated decision: a rule with identical start and end times cannot have been meant to run, so it is read as inert rather than guessed into "the whole day". |
| Only a start time | The window runs from that time to the end of the day. |
| Only an end time | The window runs from the start of the day to that time. |
| Neither time set | The rule is active all day on the days it matches. |
| Dates | Both bounds are inclusive local calendar dates. An empty bound means no bound in that direction. An end date earlier than the start date can simply never match — that is the honest answer, not an error dialog. |
| No weekday selected, "every day" off | Can never match. The rule editor's own status line says so under the rule. |
| Empty schedule | No rules, no enabled rules, and no matching rules are the same outcome: every setting shows whatever you set it to by hand. |

The site's reading of `start == end` is worth naming plainly because it is
**not** the same reading the desktop application documents for the identical
input (the desktop application treats equal start and end as "holds for the
whole day"). Both are internally consistent, both are stated at their own
surface, and neither is a mistake — they are simply two different decisions
about one genuinely ambiguous input, made independently by two different
implementations that do not share code. If you move a rule between the two
surfaces by hand, check which reading you meant.

### Precedence

Rules are resolved **per setting, not per rule**, so a low-priority rule can
still hold a setting that no higher-priority rule currently claims. Among the
rules matching right now for one setting: **the higher `priority` wins, and
between equal priorities the rule further down the list wins.** The tab's
**In effect right now** panel names the winning rule for every setting it is
currently holding, so the answer to "which rule is winning" is always
readable rather than something you have to work out by hand.

### Sources

Each rule picks where its value comes from. A rule may take its value from:

* **This computer** — the value stored on the rule itself. This is the only
  source this site evaluates.
* **A versioned HTTPS API** — listed in the picker and **disabled**, naming
  the exact reason: this site makes no network request and has no privileged
  process boundary to validate a response behind before applying it. A static
  page cannot refuse a redirect, cannot keep a bearer token out of page
  storage where any script on the origin could read it, and cannot bound a
  response the way the desktop application's main process does. The desktop
  application supports this source; this site names why it does not, rather
  than silently hiding the option or pretending to fetch.
* **A Home Assistant boolean entity** — listed and disabled for the identical
  reason, plus the fact that a Home Assistant access token has nowhere safe
  to live in a browser tab. The desktop application keeps that token in the
  operating-system credential vault; this site has no such vault (see
  [Storage](#storage) below).

A remote-sourced rule is never silently dropped or hidden: it is stored like
any other rule, shown in the list, and its window-matching semantics are
exactly the same — it simply never contributes a value on this site, because
`schedule.js`'s own `match()` function refuses any rule whose `source` is not
`"local"`.

### When a setting is edited by hand while a rule holds it

The value you type wins immediately, exactly as it would with no rule
running. On the **next** evaluation — the following tick, or the next time
the window that setting is inside is re-checked — the rule reasserts its own
value again, because the engine has no way to distinguish "you changed your
mind" from "the browser just repainted with the old value cached somewhere",
and re-asserting is the only choice that keeps the promise that a rule holds
its setting for the whole of its window. If you want your own value to stick
for the rest of the window, disable the rule; if you want it gone entirely,
delete it — both hand the setting straight back to whatever it held before
the rule started.

---

## Configuration

### Storage

The desktop application keeps this in the operating-system credential vault
and its own application-data folder. A web page has neither of those, so this
site uses your browser's `localStorage` for this origin instead, under the
keys `wds.schedule.rules` and `wds.schedule.base`, and says so here rather
than behaving as though a vault existed. Clearing this site's storage removes
every rule and every currently-held base value — the same reset that clears
every other setting, lock and history entry this site keeps.

### Storage schema

Version **1**, stored under `schedule.rules`.

```jsonc
{
  "schemaVersion": 1,
  "rules": [
    {
      "id": "rule-m1p2q3-1",     // stable for the life of the rule
      "label": "Evening",
      "enabled": true,
      "priority": 5,             // higher wins; ties go to the later rule
      "setting": "theme.mode",   // one of the ids under "What can be scheduled"
      "value": "dark",
      "source": "local",         // "https" and "homeassistant" are stored but never applied here
      "startDate": "",           // inclusive YYYY-MM-DD, or "" for no bound
      "endDate": "",
      "startTime": "22:00",      // local wall clock, or "" for the start of the day
      "endTime": "06:00",
      "days": "every"            // or an array such as ["mon","tue","wed","thu","fri"]
    }
  ]
}
```

`schedule.base` holds the value each currently-held setting had immediately
before its first matching rule started, keyed by setting id — what makes the
"put it back exactly" promise possible, including across a page reload,
since it is read fresh from storage on every evaluation rather than kept only
in memory.

**Bounds.** The document is ordinary JSON under this site's shared
`localStorage` quota (a few megabytes in every current browser); there is no
separate hand-enforced rule count today. A document whose `schemaVersion` is
**higher** than this file understands is left completely untouched and
reported to the console, never partially read or guessed at. A document whose
`schemaVersion` is **lower** is run through a registered migration function
for that exact version if one exists; none exists yet, because schema version
1 is the only version either implementation of this feature has ever written.

---

## Known gaps and the exact fix

Named plainly, because a silent gap here would read as an oversight to the
next person and as a decision to nobody:

1. **The schedule is only evaluated live while `settings.html` is the open
   page.** `site/assets/schedule.js` exists specifically to fix this — it
   evaluates on load, on a 20-second interval, when the tab regains focus or
   visibility, and immediately when another open tab of this same browser
   changes the stored rules — but as of this writing no page's `<script>`
   tags include it yet. The fix is one line per page, after `site.js`:
   `<script defer src="assets/schedule.js"></script>`, added to `index.html`,
   `docs.html`, `changelog.html` and `settings.html`.
2. **Interface font, text size and heavier labels are not yet selectable
   from the tab's own Setting picker**, even though `schedule.js` registers
   all three and will apply a rule that names one. The tab's picker is a
   short hand-written list inside `settings.html`'s own inline script; once
   the script tag above is added, that list can be replaced with
   `Studio.scheduler.settings.list()` so the picker and the engine can never
   drift apart, and the three missing settings appear automatically.
3. **The rule list on the tab does not yet have its own search bar.** Every
   other list on this site carries one wired to the shared regex builder; the
   rules list currently has bulk actions and export but no
   `Studio.createSearchBar` of its own. Adding one is a page-local change to
   `settings.html`.

None of these three is a missing feature dressed up as a limitation — each
one names the real reason and the real fix, per this project's own rule that
a surface which cannot carry a contract literally says exactly why rather
than leaving a quiet hole.

---

## Security considerations

* **This site makes no network request for scheduled settings**, matching
  the rest of this site's one-network-request rule (the optional dim sum dish
  photo). The HTTPS and Home Assistant sources are stored but never fetched.
* **Nothing here can hold a credential.** There is no token field anywhere in
  the schema; a Home Assistant rule simply has no access token to lose,
  because this site never asks for one.
* **`localStorage` is not a secure store.** Anything written here is readable
  by any script running on this same origin and by anyone with access to this
  browser profile. This feature holds no secrets, so that boundary is stated
  for completeness rather than because it changes what this feature can do.
* **A rule cannot escape its own setting.** `schedule.js` only ever calls the
  `set()` function registered for the exact setting id a rule names, through
  the same public `Studio.theme` / `Studio.i18n` calls a person clicking a
  control would trigger — there is no path from a rule to arbitrary code.

---

## Verification

Open **Settings → Scheduled settings** and check the following. Each one has
an observable answer.

1. A rule whose end time is earlier than its start time runs past midnight
   and ends the following morning; with weekdays selected, only the
   *starting* day needs to be chosen.
2. A rule with equal start and end times never becomes active — the note
   under the rule says so as soon as you set matching times.
3. Two rules claiming the same setting resolve by priority first, list
   position second; **In effect right now** names the winner.
4. Disabling or deleting a rule that was holding a setting restores the exact
   value that setting had before the rule started, and the **Held for
   restoring** line in the status panel loses that entry.
5. The **HTTPS API** and **Home Assistant** source options are visible in
   every rule's **Where the value comes from** picker, both shown disabled
   with their exact reason on hover and to a screen reader.
6. The zone name shown on the tab matches this computer's actual configured
   time zone.

### Automated checks

`schedule.js`'s pure matching functions (`match`, `winners`) and its live
evaluate/base-restore cycle were exercised against a minimal `window` /
`Studio` shim covering: the half-open boundary, the zero-length window, the
cross-midnight wrap, explicit and empty weekday sets, inclusive and
impossible date ranges, disabled and non-local rules, priority precedence
with a tie broken by position, base capture and exact restoration (including
falling back to the shipped default when nothing was stored before the
rule), string-to-number coercion for `theme.fontScale`, refusal of a
newer-than-understood schema version, a registered migration actually
running, and `write()` persisting through `Studio.store` and recording
history. The harness is a scratch file, run and then removed; it is not
shipped with the repository.

---

## Suggested related articles

* [`scheduled-settings.md`](scheduled-settings.md) — the desktop
  application's version of this feature, including the two working remote
  sources this site cannot safely offer.
* [`appearance.md`](appearance.md) — the theme, density, accent colour, font
  and motion settings a schedule rule holds.
* [`language.md`](language.md) — the language modes and funny levels, and why
  School mode makes a Cantonese or bilingual rule inert rather than refused.
* [`settings.md`](settings.md) — how the Scheduled settings tab sits inside
  the rest of this site's settings surface.
* [`history.md`](history.md) — where every rule change, and every value a
  rule takes or releases, is recorded.
