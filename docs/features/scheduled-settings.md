# Scheduled settings

Scheduled language, appearance and external settings sources.

A schedule rule sets one or more settings for a chosen time window and then hands
them back. Every value a rule changes is **borrowed**: before the rule touches a
setting, the current value is captured — including where that value came from —
and when the window closes the setting returns to exactly what it was. A
scheduled override is never quietly promoted into the user's permanent setting.

| | |
| --- | --- |
| Module | `app/src/renderer/features/scheduled-settings/` |
| Tab | `scheduled-settings.schedule` |
| Settings section | `scheduled-settings` |
| Inventory rows | 7.1, 7.2, 7.3 |
| Network | Only through the privileged main-process boundary, and only when a rule asks for it |

---

## Behaviour

### What can be scheduled

Every setting this application registers, resolved from the registry at the
moment a rule is edited or evaluated, apart from three groups:

* **Actions**, which have no stored value.
* **Custom controls**, whose stored shape only their own feature understands.
* **This feature's own keys** (`schedule.*`), so a rule cannot switch off the
  scheduler that is running it or rewrite the schedule mid-tick.

That leaves the theme mode, seed colour, contrast level, density, font family,
font scale, font weight, motion preference, display-name presentation, the
language mode and the two humour levels, and every value any other feature
registers. Appearance has no special status here — it is simply the largest
group of settings, and because the set is read from the registry, a setting a
sibling feature adds tomorrow becomes schedulable with no change to this one.

While **School mode** is on, `language.mode`, `language.funny.en`,
`language.funny.yue` and everything under `vocabulary.` and `school.` are neither
offered in the editor nor applied by the engine. Those capabilities behave as if
they are not installed for as long as that mode lasts, so offering them here
would be offering a control the rest of the application has deliberately
withdrawn. The change takes effect immediately — the engine recomputes on the
School-mode change rather than waiting for the next interval.

### Reading a rule

A rule carries an optional **start date** and **end date**, a **start time** and
an **end time**, and either **every day** or an explicit set of weekdays. Every
day means all seven weekdays for that one time window: it is one rule, not seven.

Times are read in the machine's configured local timezone. Both the schedule tab
and the rule editor name that zone, its current UTC offset, and which
daylight-saving behaviour applies. The zone is read from
`Intl.DateTimeFormat().resolvedOptions().timeZone`; whether it observes daylight
saving is determined by comparing the January and July offsets, which is correct
in both hemispheres.

### Exact window semantics

| Case | Meaning |
| --- | --- |
| `start < end` | The window is `[start, end)`. The start minute is included and the end minute excluded, so adjacent rules tile a day exactly with neither gap nor overlap: a rule ending at 09:00 and one starting at 09:00 are never both in effect. |
| `end < start` | The window crosses midnight and belongs to the day it **started** on. The weekday selection and both date bounds are checked against that starting day, so "Fridays, 22:00 to 02:00" runs into Saturday morning without Saturday needing to be selected. |
| `start == end` | The rule holds for the **whole day**. A zero-length window would be a rule that can never fire, which nobody configures on purpose. |
| Dates | Both bounds are inclusive local calendar dates. An empty bound means no bound in that direction. An end date earlier than the start date is refused at save time, because the rule could never run. |
| Empty schedule | No rules, no enabled rules, and no matching rules are all the same outcome: nothing is overridden and every setting shows its own value. |
| Invalid partial input | The editor refuses to save and names each offending field. A stored rule that fails validation on load is **quarantined**: kept byte for byte, never run, and listed in the schedule tab. |

Daylight saving falls out of comparing wall-clock fields rather than absolute
instants, which is the behaviour of a clock on a wall: a time the local clock
skips in spring never matches, and a time the local clock repeats in autumn
matches on both passes. Both are stated in the interface rather than left to be
discovered in March.

### Precedence

Rules are painted in order and later paints over earlier. The order is ascending
priority, then position in the document. In plain words: **a higher priority
wins, and between equal priorities the rule further down the list wins.**

Precedence is decided **per setting, not per rule**, so a low-priority rule still
contributes any setting that no higher-priority rule claimed. The schedule tab
names the winner of every held setting and lists the rules that were painted
over, so the answer to "which rule is winning" is readable off the screen rather
than inferred.

### Sources

Each rule picks one source. Every schedulable setting can be driven by any of
them — an endpoint is not limited to the language.

**This computer.** The rule uses its own stored values and makes no network
request at all.

**HTTPS endpoint.** A `GET` whose body is:

```json
{
  "schemaVersion": 1,
  "active": true,
  "settings": {
    "appearance.themeMode": "dark",
    "appearance.density": -2
  }
}
```

`active` is the gate. `settings` is allow-listed against the setting ids this
application actually registers: an unknown key is refused and named in the rule's
status, never stored. Each accepted value is then coerced and passed to the
owning control's own `validate`, so a value that would be refused when typed into
the settings surface is refused here too. Endpoint values are painted over the
rule's own stored values, so a rule can carry a working local answer and still
defer to the server when it replies.

**Home Assistant.** A `binary_sensor` or `input_boolean` entity, read from
`GET {baseUrl}/api/states/{entityId}` with a bearer token from the credential
vault. `on` activates the rule so its own values apply; `off` leaves the base
settings, or another matching rule, in effect. Any state other than `on` or `off`
is refused with the state named, because only a boolean entity can drive a gate.

### Refresh, back-off and generation guards

* A source is asked once the moment its window opens, and then on its own
  interval.
* The interval has a floor of **60 seconds** and a ceiling of **86 400**, so a
  misconfigured rule can never become a hot loop.
* After a failure the wait doubles, capped at eight times the interval. An
  `HTTP 429` honours `Retry-After` when the server sends one.
* Every request carries a generation number. A slower earlier answer arriving
  after a newer one is discarded rather than applied, so an older response can
  never overwrite a newer setting.
* One request per rule is in flight at a time.
* A refresh is never awaited by the tick: a slow server cannot hold up the
  schedule.

### When a setting is edited by hand while a rule holds it

The person in front of the screen wins. The edited value becomes the new **base**
value, and the rule leaves that one setting alone until the schedule's own
decision changes — a window opening or closing, a rule edited, an endpoint
answering differently. The schedule tab lists every setting in that state, and
the change is recorded in the local version history.

**Release every override now** behaves the same way: the released settings are
suppressed until the decision changes, because a release button that undid itself
on the next check would be a control that looks like it works and does not.

---

## Configuration

| Setting id | Kind | Default | What it does |
| --- | --- | --- | --- |
| `schedule.enabled` | switch | `true` | When off, no rule is evaluated and every held setting is handed back immediately. The rules themselves are kept. |
| `schedule.tickSeconds` | slider, 10–300 | `30` | Seconds between checks. A machine that was asleep catches up on the next check regardless. |
| `schedule.notifyOnChange` | switch | `true` | Whether a non-blocking notification names the settings as they are taken and released. Turning it off changes only whether the schedule says so, never what it does. |
| `schedule.networkTimeoutMs` | number, 1000–30000 | `8000` | How long a request may take before it is abandoned. An abandoned request never applies a value. |
| `schedule.rules` | custom | *(none)* | The stored schedule document. Edited from the schedule tab, not by hand. |
| `schedule.openEditor` | action | — | Opens the schedule tab. |
| `schedule.deleteAll` | action | — | Deletes every rule, behind the destructive-action gate. |

`schedule.baseSnapshot` is written by the engine and is not a user-facing control.
It holds the captured base value, its provenance and the rule that borrowed it,
for each setting currently held — which is what makes a crash mid-window
recoverable rather than a lost setting.

### Storage schema

Version **1**, stored under `schedule.rules` in the ordinary settings file.

```jsonc
{
  "schemaVersion": 1,
  "updatedAt": "2026-08-13T21:00:00.000Z",
  "rules": [
    {
      "id": "rule-m1p2q3-1",       // stable for the life of the rule
      "label": "Evening",
      "enabled": true,
      "priority": 100,             // 0..999
      "startDate": null,           // inclusive YYYY-MM-DD, or null
      "endDate": null,
      "startTime": "22:00",        // local wall clock
      "endTime": "06:30",
      "everyDay": true,
      "weekdays": [0, 1, 2, 3, 4, 5, 6],   // 0 is Sunday
      "source": { "kind": "local" },
      "assignments": [{ "settingId": "appearance.themeMode", "value": "dark" }],
      "createdAt": "…",
      "updatedAt": "…"
    }
  ]
}
```

**Bounds.** 64 rules per document; 32 settings per rule; 80 characters per label;
2048 per address; 128 per entity id; 512 per assigned string value; 256 KiB per
serialized document; 64 KiB per external response. Assigned values are limited to
strings, finite numbers, booleans and `null`.

**Migration.** A document with a lower `schemaVersion`, including one written
before the field existed (treated as version 0), is read through the current
validator and rewritten as version 1; the user is told it happened. A document
with a **higher** version was written by a newer build: it is refused, left
untouched on disk, and reported. Downgrading by silently dropping fields a newer
build understood would be data loss disguised as compatibility.

---

## Failure modes

Every one of these is non-blocking and fails safe. Nothing here can interrupt a
tick, and the schedule never claims a remote setting was applied when it was not.

| Failure | What happens |
| --- | --- |
| Endpoint unreachable, DNS failure, timeout | If the rule has never had a successful answer it contributes nothing and the base settings stay exactly as they are. If it has, that answer stays in effect and is marked **stale**, never replaced by a guess. A notification names the failure. |
| `HTTP 401` / `403` | Reported as **not authorized**, with the address named and the query string stripped. |
| `HTTP 429` | Reported as **rate limited**; the next attempt honours `Retry-After` when present, otherwise waits four intervals. |
| Malformed JSON, wrong `schemaVersion`, missing `active`, non-object `settings` | Reported as **answer refused**, with the exact reason. Nothing is applied. |
| Response longer than 64 KiB | Refused rather than truncated and parsed. |
| Unknown setting id in an endpoint answer | That field alone is refused and named; the rest of the answer still applies. |
| Home Assistant entity missing (`404`) | Reported with the entity id named. |
| Home Assistant entity reporting something other than `on`/`off` | Refused with the reported state named. |
| No token stored for a Home Assistant rule | Reported, with the route to storing one. |
| Offline machine | The same stale-or-nothing path; no error dialog, no blocked interface. |
| Stored rule fails validation | Quarantined: kept, never run, listed in the tab, and reported once at startup. |
| Whole document refused | Nothing runs, the file is left untouched, and the reason is shown in the tab and as a notification. |
| Engine did not start | The tab and the settings control say so plainly rather than rendering an empty panel. |

### A known boundary limitation

The Home Assistant source sends `Authorization: Bearer …`. The privileged HTTP
boundary in `app/src/main/services/net.ts` currently **strips** `Authorization`
and `Cookie` from outbound requests. Until that boundary forwards `Authorization`
for an allow-listed host, a Home Assistant rule will receive `HTTP 401` even with
a correct token. The failure is reported honestly and names both possible causes
— an invalid token, or the boundary not forwarding the header — rather than being
presented as a working feature. The HTTPS-endpoint source and the local source
are unaffected, because neither needs an authorization header.

---

## Security considerations

* **Every request goes through the privileged main-process boundary.** That
  boundary refuses redirects, refuses a URL carrying embedded credentials,
  refuses plain HTTP to anything but a loopback address, and bounds the response.
  This feature validates the same things again before the boundary is called, so
  a bad address is rejected at the point the user typed it rather than after a
  request has been attempted.
* **Plain HTTP is accepted only for a loopback host** — the explicitly bounded
  development route — and `https` everywhere else.
* **Hosts are allow-listed by name**, once per session, with this feature and the
  rule named as the reason so the outbound-rules surface can explain who asked
  for what. Hosts no enabled rule wants any more are revoked.
* **Request forgery and arbitrary file access** are prevented by the scheme and
  host checks plus the boundary's own refusal of anything but `http`/`https`.
* **Unbounded refresh loops** are prevented by the 60-second interval floor, the
  single-flight guard, and the doubling back-off.
* **Home Assistant tokens live in the operating-system credential vault** under
  the stable account key `scheduled-settings/home-assistant/<rule id>`. The token
  is never written into the schedule document, an export, the local version
  history, a log, a notification or a screenshot; the entry field is cleared as
  soon as the token is stored and the value is never displayed again. Deleting a
  rule deletes its vault entry. Duplicating a rule gives the copy its own account
  key rather than sharing one, so removing the copy cannot delete the original's
  credential.
* **Neither a token nor a response body is logged.** Addresses are reduced to
  scheme, host and path before they appear anywhere, so a query string cannot
  carry a secret into a status message.
* **Exports carry no credential material**, and the export dialog says so before
  it writes anything.

---

## Verification

Run the application, open **Schedule**, and check the following. Each one has an
observable answer; none of them requires reading the source.

1. A rule whose end time is earlier than its start time runs past midnight and
   ends the following morning. With weekdays selected, only the *starting* day
   needs to be selected.
2. A rule with equal start and end times holds all day.
3. Adjacent rules meet exactly: a rule ending at 09:00 and one starting at 09:00
   are never both in effect at 09:00.
4. Two rules claiming one setting resolve by priority first and by list position
   second. The **In effect right now** section names the winner and the rules it
   painted over.
5. Closing a window puts the previous value back, *including its provenance* —
   the setting's provenance line returns from "scheduled" to whatever it was.
6. A setting that had no stored value before the rule took it is cleared again
   rather than frozen at the borrowed value.
7. Editing a held setting by hand suppresses the rule for that one setting only,
   and the other settings that rule holds are untouched.
8. **Release every override now** hands everything back and the next check does
   not immediately take it again.
9. Switching `schedule.enabled` off releases everything and keeps the rules.
10. An endpoint answering with an unknown setting id has that field refused and
    named, while the rest of the answer still applies.
11. An unreachable endpoint leaves the base settings untouched, reports the
    failure, and — if it had answered successfully earlier — marks that answer
    stale rather than discarding it.
12. A stored document with a higher `schemaVersion` is refused and the file is
    left untouched.
13. Turning School mode on removes the language settings from the picker and
    stops them being applied, without a restart.

### Automated checks

Two probes exercise the pure logic and the borrow-and-return promise against a
stubbed context. They live outside the repository (they are scratch harnesses,
not shipped tests) and cover: window shapes; cross-midnight matching and its
weekday and date bounds; half-open tiling; whole-day windows; precedence by
priority and by list position; closed gates and disabled rules; validation
refusals including a non-existent calendar date; URL and entity-id refusals;
document migration, quarantine and refusal; base capture and restoration with
provenance; the hand-edit suppression; School-mode withdrawal; value coercion
against the owning control; the master switch; and the absence of credential
material from an export.

---

## Suggested related articles

* [`appearance.md`](appearance.md) — the settings a schedule most often borrows,
  and what each one does.
* [`language.md`](language.md) — the language modes and humour levels, and why
  School mode withdraws them from the schedule.
* [`school-mode.md`](school-mode.md) — what "behaves as if not installed" means
  in practice.
* [`history.md`](history.md) — where every rule edit, take and release is
  recorded, and how to review them.
* [`notification-centre.md`](notification-centre.md) — where the schedule's own messages go
  and how to review dismissed ones.
