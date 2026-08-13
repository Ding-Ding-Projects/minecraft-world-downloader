# The spoken narrator

**Module:** `app/src/renderer/features/narrator/`
**Surfaces:** the **Narrator** destination, the **Narrator** and **What gets spoken** settings
sections, four command-palette entries and three bundled documentation articles.

The narrator reads application events aloud, in English, Cantonese, or both one after the other. It
ships **switched off**: a new installation speaks nothing at all until somebody turns it on. The
implementation is not optional — the whole feature is here, including the voice pickers, the queue,
the rate limits and the honest failure states — but whether it ever makes a sound is entirely the
listener's choice.

---

## What it does

### The narrated language

| Mode | Value | What speaks |
| --- | --- | --- |
| English | `en` | The English track alone. |
| Cantonese | `yue` | The Cantonese track alone. |
| Both | `both` | The English line first, then the Cantonese line, strictly serialized. |

"Both" is two utterances, never one. The English segment finishes before the Cantonese segment
starts; they are never mixed into a single utterance and they never overlap. Each track keeps its
own voice, its own rate and its own pitch.

### One voice picker per narrated language

There are two pickers, never one shared picker. Choosing an English voice says nothing whatsoever
about which Cantonese voice should read the other half of a bilingual line.

Each picker lists the voices **this computer actually has** for that language, resolved from the
platform at runtime, plus an explicit **Choose automatically** entry which is the shipped default.
Nothing ships with a named voice as its default, because the application cannot know what is
installed until it asks, and naming one would be a preference for a voice most machines do not have.

Cantonese voices are matched on `yue`, `zh-yue`, `zh-HK` and `zh-Hant-HK`. A plain `zh` prefix is
deliberately **not** matched: a Mandarin voice cannot read Cantonese, and offering one would produce
confidently wrong speech rather than honest silence.

### The status line beneath each picker

A select box that merely shows a value implies that value is what will be heard. The line underneath
says what is *actually* in effect:

| Situation | What it says |
| --- | --- |
| A chosen voice is installed | Which voice speaks, and whether it runs locally or over the network. |
| No choice has been made | Which voice automatic picked, and that it was the first the machine offered. |
| The chosen voice is **not installed here** | That it is not installed, that **the choice is kept exactly as it is**, and which voice speaks in the meantime. |
| The chosen voice is missing and nothing can replace it | That the track stays silent until a voice for the language exists. |
| No voice can read the language at all | That the track is silent, and that installing one in the operating system speech settings is the fix. |
| The voice is network-backed | That it goes quiet whenever the computer is offline, plus a note when it is offline **right now**. |

A choice is never silently reset. An uninstalled voice keeps its own entry in the picker, so the
control shows the user's real choice rather than sliding back to automatic behind their back.

### Rate, pitch and volume

Rate and pitch are per track, adjustable within the ranges the platform documents — rate `0.1` to
`10`, pitch `0` to `2` — and both ship at `1`, which is the voice's own normal delivery. Volume is
one setting for both tracks, so a bilingual line does not change loudness halfway through.

### Categories

Events are grouped, and each group carries its own switch, its own minimum gap and its own live
controls in both the settings surface and the Narrator destination.

| Category | Shipped state | Shipped gap |
| --- | --- | --- |
| Failures | spoken | none — never held back |
| Warnings | spoken | 8 s |
| Completions | spoken | 8 s |
| Application events | spoken | 60 s |
| Notices | silent | 12 s |
| Progress | silent | 20 s |
| Navigation | silent | 4 s |
| Settings changes | silent | 10 s |

### How it stays infrequent

Three separate mechanisms, and they are the reason a narrator is worth leaving on:

1. **A wait before speaking.** A line does not go out immediately. Anything of the same category
   arriving inside that window **replaces** it rather than queueing behind it, so a burst becomes
   the single line that was current when the burst stopped.
2. **A minimum gap per category.** A second line of the same kind inside its own gap is not spoken,
   and the reason is recorded.
3. **A serialized queue.** Exactly one line is spoken at a time, with a bounded queue behind it.
   When the queue is full the oldest ordinary line is dropped and recorded as dropped, rather than
   being delayed indefinitely.

**Failures are the deliberate exception.** The failure category jumps the queue, ignores the wait and
the minimum gap, and interrupts an ordinary line that is already speaking. Its gap control is
disabled with that reason stated. A rate limit that swallowed an error report would be worse than
having no narrator at all, so spoken failure narration always names the actual failure and what to
do about it.

### Beside a screen reader

A window is given **no way** to ask whether a screen reader is running, and this feature does not
claim to detect one.

- **Automatic** (the default) ducks around the application's own live-region announcements — exactly
  the moments a screen reader would be speaking — by waiting and lowering its volume. That is a real
  signal about a real moment rather than a guess about the machine.
- **A screen reader is running: speak quietly and wait** ducks all the time.
- **A screen reader is running: say nothing at all** yields completely, and the status line says so,
  so the silence is never mistaken for a fault.
- **No screen reader: never duck** speaks at full volume without waiting.

### Quiet hours

Between two local times, every spoken line stops — failures included, because that is what switching
them on means. The events still happen and still appear as notifications; only the speaking stops,
and every suppressed line is logged with that exact reason. A window crossing midnight, such as
`22:00` to `07:00`, works as written, and a live readout in settings says whether the window is in
force at this moment.

### The log

Everything the narrator said, and everything it did not, with the reason: the category was off, the
gap had not elapsed, a newer line replaced it, the queue was full, quiet hours were in force, the
platform reported an error, or no installed voice could read the language. It carries the same bulk
actions as every other list in the application, and it is held in memory for the session only.

### The study mode

While the study mode is on, the narrator speaks English only. The Cantonese track, its picker, its
rate, its pitch, the language selector and the Cantonese palette entries are **omitted rather than
disabled** — the capability behaves as though it were not installed — and every stored choice is
kept and returns the moment the mode goes off.

---

## Configuration

| Setting | Id | Default |
| --- | --- | --- |
| Speak application events aloud | `narrator.enabled` | `false` |
| Narrated language | `narrator.language` | `en` |
| English voice | `narrator.voice.en` | `""` (choose automatically) |
| Cantonese voice | `narrator.voice.yue` | `""` (choose automatically) |
| Speaking rate, per track | `narrator.rate.en`, `narrator.rate.yue` | `1` |
| Pitch, per track | `narrator.pitch.en`, `narrator.pitch.yue` | `1` |
| Volume | `narrator.volume` | `1` |
| Wait before speaking | `narrator.debounceMs` | `400` |
| When a screen reader is running | `narrator.screenReader` | `auto` |
| Volume while ducking | `narrator.duckVolume` | `0.45` |
| Duck for | `narrator.duckWindowMs` | `1600` |
| Quiet hours | `narrator.quiet.enabled` | `false` |
| Quiet from / until | `narrator.quiet.from`, `narrator.quiet.to` | `22:00`, `07:00` |
| Lines kept in the log | `narrator.log.limit` | `200` |
| Per category | `narrator.category.<id>.enabled`, `narrator.category.<id>.cooldownMs` | see the table above |

The voice settings store the platform's **voice identity** (`voiceURI`), never the display name.
Names are not unique — one machine can carry several voices with the same name from different
engines — and platforms localize them, so a stored name silently stops matching on another install.

---

## Failure modes

| Failure | What happens |
| --- | --- |
| The build has no speech synthesis | Every control is disabled with that reason, and one notification says so plainly. No stored choice is changed. |
| The voice list is empty on the first call | Normal, and expected. The registry starts in a waiting state, subscribes to `voiceschanged`, re-reads on a bounded poll and only reports an empty list after an eight-second deadline. A picker that read the list once would report "no voices installed" on a machine with forty. |
| The chosen voice is not installed | The choice is kept, a fallback speaks, and both facts are stated. |
| No voice can read a selected language | That track is silent, one notification explains it, and every attempt is logged with the same reason. |
| A network-backed voice goes offline | The status line says the voice needs the network, and says when the machine is offline right now. |
| The platform never reports the end of an utterance | A watchdog cancels it after a generous estimate of its own length, logs the line as failed with that reason, and the queue moves on. Without it a strictly serialized queue would wedge permanently — a known behaviour of Chromium speech synthesis on long utterances. |
| The platform reports a speech error | The line is logged as failed with the platform's own error name. |
| An error arrives while an ordinary line is speaking | The ordinary line is cancelled, logged as interrupted, and the error is spoken immediately. |

---

## Security and privacy considerations

- **Nothing leaves the machine.** Narration uses the platform speech service available to the
  window. The feature makes no network request of its own, bundles no remote asset and loads no
  remote font. A voice the platform itself synthesises over the network is identified as such in the
  interface so the choice is informed.
- **The log is in memory only** and is never written to disk. It is cleared when the window closes,
  and clearing it deliberately is irreversible and goes through the destructive-action gate.
- **No secret is ever spoken or logged.** The narrator speaks notification titles and bodies, the
  names of settings and their new values. Anything a feature declines to put in a notification is
  never reached by the narrator either.
- **Emoji are stripped before speech.** A voice pronounces an emoji as its full name, so decoration
  would become several spoken words mid-sentence. The words themselves survive untouched.

---

## Verification

- **Late enumeration.** Open the window and read the picker before the platform answers: it must say
  it is still reading the list, not that no voices are installed. It must fill in when
  `voiceschanged` fires, and report an empty list only after the deadline.
- **A missing voice.** Set `narrator.voice.en` to an identity that does not exist on the machine.
  The picker must still show that entry, the status line must say it is not installed, name the
  fallback, and the stored value must be unchanged after a restart.
- **No voice for a language.** On a machine with no Cantonese voice, choose Cantonese: the track
  must stay silent, one notification must explain it, and each attempt must be logged with that
  reason rather than appearing to succeed.
- **Serialization.** Raise several notifications at once with "Both" selected. Exactly one utterance
  must be audible at a time, English before Cantonese, with no overlap.
- **Replacement, not stacking.** Raise five notifications of one category inside the wait window:
  exactly one line is spoken and the log shows the others as replaced.
- **The cooldown.** Raise two completions a second apart: the second must be logged as suppressed
  with the remaining gap named.
- **Errors are never suppressed.** With every gap set to its maximum, raise two failures in
  succession: both must be spoken, and an ordinary line already speaking must be interrupted.
- **Ducking.** With the automatic setting, trigger an application announcement while a line is
  queued: the line must wait and then speak at the reduced volume.
- **Quiet hours across midnight.** Set `22:00` to `07:00` and check the live readout at times either
  side of midnight; every suppressed line must name quiet hours as the reason.
- **The study mode.** Turn it on: the language selector, the Cantonese picker and both Cantonese
  palette entries must be absent from every surface, not merely disabled, and every stored value
  must return when it is turned off.
- **Humour levels.** At levels 1 and 5, in both languages, a spoken failure must still name the same
  failure. Only the frame around the fact may change.
- **Bulk actions.** In both lists: shift-click a range, use the keyboard equivalent, check that
  "select the rows shown" and "select all rows" report different counts under an active search, and
  confirm the preview names the exact rows that will change and the rows that will not, with
  reasons.
- **Accessibility.** Operate every control by keyboard with a visible focus ring, confirm the status
  regions announce changes, and check that nothing clips at narrow widths or at 200% display scale
  with bilingual labels.
- **Reduced motion.** The narrator's surfaces contain no animation and no transition, so there is
  nothing for the reduced-motion preference to suppress. It is deliberately **not** wired to the
  speech itself: silencing a narrator somebody switched on, because of a preference about motion,
  would be the application deciding it knew better. Quiet hours and the screen-reader settings are
  the controls that stop the sound, and both say so plainly.

---

## Suggested articles

- [Language, humour levels and the emoji switch](language.md) — the modes and levels this feature's
  spoken copy follows.
- [School mode](school-mode.md) — why the Cantonese track disappears entirely rather than greying
  out.
- [Accessibility and themes](accessibility-themes.md) — the rules the narrator's surfaces are held
  to alongside everything else.
- [The notification centre](notification-centre.md) — the source of most narrated lines.
