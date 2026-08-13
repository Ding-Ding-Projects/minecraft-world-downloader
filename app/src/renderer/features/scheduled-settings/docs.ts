import type { DocArticle } from '../../core/registry';

/**
 * The in-application documentation article.
 *
 * It is the same material as `docs/features/scheduled-settings.md` in the
 * repository, written for someone who is looking at the feature rather than at
 * the source, and it links onward rather than dead-ending.
 */
export const article: DocArticle = {
  id: 'scheduled-settings',
  title: 'Scheduled settings',
  category: 'Automation',
  related: ['appearance', 'language', 'history', 'notifications'],
  body: `
# Scheduled settings

A schedule rule sets one or more settings for a chosen time window, then hands
them back. Every value it changes is **borrowed**: before a rule touches a
setting the current value is captured — including where that value came from —
and when the window closes the setting goes back to exactly what it was. A
scheduled value never quietly becomes your permanent one.

## What can be scheduled

Every setting this application registers, apart from three groups:

* **Actions**, which have no stored value.
* **Custom controls**, whose shape only their own feature understands.
* **This feature's own keys**, so a rule cannot switch off the scheduler that is
  running it or rewrite the schedule mid-tick.

That leaves the theme, the density, the seed colour, the contrast level, the font
family, scale and weight, the motion preference, the display-name presentation,
the language mode, and every value any other feature registers. There is nothing
special about appearance here — it is simply the largest group of settings.

While School mode is on, the language mode, the two humour levels and the
personal-vocabulary keys are not offered and are not applied, because those
capabilities behave as if they are not installed for as long as that mode lasts.

## Reading a rule

A rule has an optional **start date** and **end date**, a **start time** and an
**end time**, and either **every day** or an explicit set of weekdays. Every day
means all seven weekdays for that one time window — it is one rule, not seven.

Times are read in your machine's configured local timezone. The schedule tab and
the rule editor both name that zone and its current offset, and say which
daylight-saving behaviour applies.

### The exact semantics

| Case | What happens |
| --- | --- |
| \`start < end\` | The window is \`[start, end)\`. It includes the start minute and excludes the end minute, so adjacent rules tile a day exactly with no gap and no overlap. |
| \`end < start\` | The window crosses midnight. It belongs to the day it **started** on, so the weekday selection and the date bounds are checked against that starting day. |
| \`start == end\` | The rule holds for the **whole day**. A zero-length window would be a rule that can never fire, which nobody sets on purpose. |
| Dates | Both bounds are inclusive calendar dates. An empty bound means no bound in that direction. |
| Empty schedule | No rules, no enabled rules, or no matching rules all mean the same thing: nothing is overridden and every setting shows its own value. |
| Invalid input | The editor refuses to save and names each field. A stored rule that fails validation is quarantined — kept, never run, and listed in the schedule tab. |

On a daylight-saving change the comparison is against wall-clock fields, the same
way an alarm clock on the wall behaves: a time the local clock skips in spring
never matches, and a time the clock repeats in autumn matches on both passes.

## Which rule wins

Rules are painted in order and later paints over earlier. The order is ascending
priority, then position in the list. In plain words: **a higher priority wins,
and between equal priorities the rule further down the list wins.**

Precedence is decided per setting, not per rule, so a low-priority rule still
contributes any setting no higher-priority rule claimed. The schedule tab names
the winner of every held setting and lists the rules that were painted over.

## Where a rule's answer comes from

Each rule picks one source, and every schedulable setting can be driven by any of
them — an endpoint is not limited to the language.

**This computer.** The rule uses its own stored values and makes no network
request at all.

**HTTPS endpoint.** A \`GET\` that answers with:

\`\`\`json
{ "schemaVersion": 1, "active": true, "settings": { "appearance.themeMode": "dark" } }
\`\`\`

\`active\` is the gate. \`settings\` is allow-listed against the setting ids this
application actually registers: a key it does not have is refused and named,
never stored. Each accepted value is then validated by the same control that
would validate it if you typed it into the settings surface. Endpoint values are
painted over the rule's own stored values, so a rule can carry a working local
answer and still defer to the server when it replies.

**Home Assistant.** A \`binary_sensor\` or \`input_boolean\` entity. \`on\`
activates the rule so its own values apply; \`off\` leaves the base settings, or
another matching rule, in effect.

## Security

* Every request goes through the privileged main-process boundary. That boundary
  refuses redirects, refuses a URL carrying embedded credentials, refuses plain
  HTTP to anything but a loopback address, and bounds the response.
* A host is allow-listed by name before the first request, with this feature and
  the rule named as the reason. Hosts no rule wants any more are revoked.
* The response is bounded to 64 KiB and the request to the configured timeout,
  and the refresh interval has a floor of 60 seconds so a rule can never become a
  hot loop. After a failure the wait doubles, up to eight times the interval.
* A generation counter guards every request, so a slow earlier answer can never
  overwrite a newer one.
* A Home Assistant token lives in the operating system credential vault under the
  rule's own account key. It is never written into the schedule, an export, the
  local history, a log or a screenshot, and it is never displayed again once
  stored. Deleting a rule deletes its vault entry.

## When something goes wrong

Nothing here blocks. Network failure, malformed data, an offline machine, a
refused token, an \`off\` gate and rate limiting are all handled the same way:

* If the rule has never had a successful answer, it contributes nothing and the
  base settings stay exactly as they are.
* If it has had one, that answer stays in effect and is marked **stale** — it is
  never replaced by a guess.
* A notification names the exact failure and offers a way back to the rule.

The schedule never claims a remote setting was applied when it was not.

## If you change a held setting by hand

Your change wins. It becomes the new base value, and the rule leaves that one
setting alone until the schedule's own decision changes — a new window opening,
a rule edited, an endpoint answering differently. The schedule tab lists every
setting in that state.

## Recovering

* **Release every override now** hands back everything immediately, and the
  released settings are then left alone until the schedule's own decision changes
  — a window opening or closing, a rule edited, an endpoint answering
  differently. A release that undid itself on the next check would be a button
  that looks like it works and does not.
* **Switching the scheduler off** evaluates nothing and releases everything, and
  keeps every rule where it is.
* The base values are stored on disk, not only in memory, so a crash while a
  window is open does not strand a borrowed setting.

## Verification

The behaviour worth checking by hand:

1. A rule whose end time is earlier than its start time runs past midnight and
   ends on the following morning.
2. A rule with equal start and end times holds all day.
3. Two rules claiming one setting resolve by priority, and then by list position.
4. Closing a window puts the previous value back, including its provenance.
5. Editing a held setting by hand suppresses the rule for that setting only.
6. An endpoint answering with an unknown setting id has that field refused and
   named, and the rest of the answer still applies.
7. An unreachable endpoint leaves the base settings untouched and reports it.

## Suggested reading

* **Appearance** — the settings a schedule most often borrows, and what each one
  does.
* **Language modes and humour levels** — what the language mode changes, and why
  School mode withdraws it from the schedule.
* **Local version history** — every rule edit and every take and release is
  recorded there.
* **Notifications** — where the schedule's own messages go, and how to review the
  ones you dismissed.
`
};
