# World downloader

> The world downloader tab: connection and launch-option settings, live status read from the running
> process and from disk, an explicit chunk-count action, a searchable activity log with bulk actions,
> saved profiles with honest presets, and a gated start/stop — all driving the bundled
> `world-downloader.jar` exactly as its own command-line parser expects.

## What it does

This feature is the desktop-app front end for the Java proxy documented in
[`world-download.md`](world-download.md). It does not reimplement any of the downloading itself: it
finds a Java runtime and the jar on the machine, turns the options a person chooses into the real
`args4j` flags `config/Config.java` declares, spawns the jar as a child process through the
application's privileged bridge, and reads that process's own stdout/stderr to show what is actually
happening — connection state, the signed-in account, the proxy target, and what has been written to
the output world.

One tab (`downloader.main`) holds seven cards, top to bottom:

| Card | What it shows |
| --- | --- |
| **Java runtime and jar** | Whether a Java runtime answers `-version`, and whether `world-downloader.jar` was found; recheck, "get Java", "get the jar" and "choose the jar" actions. |
| **Session** | Start/Stop, the live phase and connection state, account, proxy target, elapsed time, the Microsoft device-code prompt when one is waiting, and the exact command line that will run (or did run), copyable. |
| **Live status** | What is on disk in the output world right now: region/entity file counts, total bytes, last write time, an explicit "count the saved chunks" action, and the player position and dimension read from the overview map's own status file. |
| **Supported game versions** | The bundled `protocol-versions.json` table, reference only, with the version this session actually detected highlighted above it. |
| **Launch options** | One control per real `@Option`, grouped exactly as the Java core groups them, each with its contributed flag shown, a progressive-disclosure explanation, and a "changed from default" indicator. |
| **Saved profiles** | Named sets of every launch option, honest presets that state exactly what they change, save/update/load/duplicate/delete/export with a proper selection model. |
| **Activity log** | Every line the jar wrote, in order, with severity, stream and a search bar; bulk select/copy/delete/export. |

## How it works

### The options table is the single source of truth

`options.ts` declares one `OptionDefinition` per real command-line flag, read directly from
`src/main/java/config/Config.java` — nothing here is invented. Two flags are deliberately **not**
offered:

- `--token` (a Minecraft access token) would sit on a command line in the clear, readable by anything
  on the machine that can list processes. Automatic authentication and the Microsoft device-code flow
  both reach the same outcome without that exposure.
- `--mark-old-chunks` and `--modded-block-colors` are already the jar's own default when *absent*, so
  offering them as "turn this on" switches would be controls that do nothing when engaged. Their
  `--disable-…` counterparts are offered instead, because those genuinely change behaviour.

Each definition supplies its own `args(value, allValues)` (what it contributes to the command line —
empty when the value equals the jar's own default, so the command line stays readable and a future
change to a Java default is never silently pinned), `validate(value, allValues)` (a plain-English
reason a value is unusable, or `null`), and `inertReason(allValues)` (why a control currently does
nothing, e.g. the auto-open delay while auto-open itself is off — the row is disabled and says
exactly why, rather than looking live and being ignored).

`buildArguments(values)` runs every definition's `args`/`validate`, and returns the full argument
vector plus any problems. Starting a download refuses to spawn anything while `problems.length > 0`.

### The running process

`session.ts`'s `DownloadSession` owns one child process at a time. It classifies every stdout/stderr
line into a severity (`error` / `warning` / `notice` / `info`) from what the line actually says, and
separately parses a handful of the jar's own lines to update live status: the Microsoft device-code
marker (`MSA_CODE {...}`), the "Starting proxy for …" line, the protocol/version line, login and
disconnect lines, and the first-run "generating reports" pair. Re-entry (starting while already
starting) is refused synchronously inside `start()` itself, before the first `await`, because a
disabled button is only the visible guard — the real one has to be in the method a keyboard submit
can still reach.

Stopping sends the process a normal stop request (never a hard kill by default) so the jar can flush
its in-flight region writes before exiting; this goes through the two-key destructive-action gate,
because chunks captured but not yet flushed are lost if the process dies mid-write.

### Runtime and world probes

`runtime.ts` never reports something as present without actually checking: `probeJava` runs
`<command> -version` and reads the real exit code (Java's version banner is on stderr, which is not
by itself a failure); `probeJar` `stat`s each candidate path in order (the configured setting, then
the two conventional locations under the application data directory) and only reports the first one
that genuinely exists; `scanWorld` walks the output directory for `.mca` files under bounded
depth/entry ceilings; `countChunks` is a **separate, explicit action** (not part of the live-status
poll) because it reads every region file's own Anvil location table — real occupied-slot counts, not
an estimate — which is cheap for a small world and genuinely not for a large one.

### Profiles and presets

A profile (`profiles.ts`) is a name, notes, and one value per launch option. A preset never guesses:
it starts from `defaultValues()` and applies only the exact delta it declares, and the UI states that
delta (`presetChanges`) before it is applied — which is also what makes "reset every option" and "the
defaults a preset starts from" incapable of disagreeing with each other, since both read the same
table.

## Key files

- `app/src/renderer/features/downloader/options.ts` — the launch-option table, argument-vector
  builder and command-line renderer.
- `app/src/renderer/features/downloader/profiles.ts` — saved profiles and presets.
- `app/src/renderer/features/downloader/runtime.ts` — Java/jar/world/overview probes, the supported
  protocol table, and formatting helpers.
- `app/src/renderer/features/downloader/session.ts` — the running child process, output
  classification and live status.
- `app/src/renderer/features/downloader/state.ts` — the one live `FeatureState` shared by every card:
  current option values, probes, and the poll loop that re-reads the world while a download runs.
- `app/src/renderer/features/downloader/panel.ts` — the tab itself: the seven cards described above.
- `app/src/renderer/features/downloader/strings.ts` — every user-facing string, in English and
  playful Hong Kong Cantonese, at five humour levels each.
- `app/src/renderer/features/downloader/index.ts` — registration: settings, palette, docs, the tab.

## Configuration

All settings are under **Settings → World download**:

| Setting | Default | What it does |
| --- | --- | --- |
| Java launcher | `java` | `java` keeps a console attached; `javaw` does not (hides the console on Windows, but also hides anything Java prints before this application's own capture begins). |
| Downloader jar | *(empty)* | The `world-downloader.jar` to run. Empty means "look in the application data directory". |
| Working directory | *(empty)* | Where the Java process runs — its `config.json`, version cache and any relative output path resolve against this. Empty means the application's own directory. |
| Retained log lines | 5000 | How many activity-log lines this window keeps before the oldest are dropped (the log says how many). |
| Visible log lines | 200 | How many *matching* lines are drawn at once; "Show more" reveals further back. Keeps a long log responsive without hiding the true match count. |
| Poll interval | 5 s | How often the output world and the overview status file are re-read while a download is running. Counting chunks is never on this timer — it stays an explicit action. |
| Preferred export format | JSON | Offered first when exporting profiles or the log; every other format stays available at the moment of export. |
| Check the Java runtime | — | An action: reruns the Java probe immediately and reports the result. |

Nothing here needs restarting the application; every value is read live at the moment it is used
(the next start, the next poll tick, the next export).

## Failure modes

| Situation | What happens |
| --- | --- |
| No Java runtime answers | Start is refused before spawning anything; the runtime card names the exact command that was tried and offers the official download page. |
| No jar found | Same refusal, with the exact paths that were searched and a native file picker to point at one directly. |
| An option fails validation (bad port, non-numeric seed, unknown template placeholder, …) | Start is refused; the exact option and the exact reason are shown, never a bare "invalid". |
| The jar exits non-zero | The session moves to `failed`, the exit code is shown, and the reason (when the jar gave one) is kept in the log rather than discarded. |
| Output is dropped for staying within the retained-line ceiling | The log says exactly how many earlier lines were dropped; the ceiling is a display retention limit only — it never affects what the jar itself wrote to disk. |
| A region file is larger than the read ceiling during a chunk count | It is skipped and named, and the skip count is part of the reported total rather than silently lowering it. |
| The clipboard refuses a copy | Reported with the browser's own refusal reason, never a silent no-op. |
| Export is cancelled at the native save dialog | Reported as "nothing was written", never mistaken for a failure. |

## Security considerations

- **No access token ever reaches a command line.** `--token` is not offered by this application at
  all; see "How it works" above for why. Authentication is either the running launcher's own cached
  session (automatic) or the Microsoft headless device-code flow, whose one-time code and link are
  shown in the Session card the moment the jar prints them and nowhere else.
- **The child process is spawned without a shell**, through the privileged bridge's allow-listed
  `java`/`javaw` commands only; the renderer cannot spawn an arbitrary executable.
- **Every filesystem path this feature touches is absolute** and goes through the privileged bridge's
  scoped `fs`/`dialog`/`shell` calls — there is no direct Node `fs` access from the renderer.
- **A profile never carries a credential.** Launch-option values are the only thing a profile stores;
  a Microsoft sign-in is per-session state on `SessionStatus`, never written to settings or exported.
- **This application cannot delete a world folder.** The privileged bridge has no delete capability
  for user data, deliberately; the "show in file manager" action is the only way to reach one, and
  removing it is the user's own action in their own file manager.

## Verification

1. With no Java on `PATH`, open the tab: the runtime card reports it plainly and Start is disabled
   with that exact reason.
2. Point the jar-path setting at a real `world-downloader.jar`: the runtime card reports the resolved
   path and size, and Start becomes available once Java also answers.
3. Enter an out-of-range server port: the field's row is marked invalid and Start is refused with the
   exact reason; the command-line preview never includes it.
4. Start a download against a real server: the Session card's phase and connection state update from
   the process's own output, not from a timer; the command-line preview matches exactly what was
   spawned.
5. Let a first-run version generate its reports: "First run for this game version…" is shown and
   clears itself when the jar reports completion.
6. Stop a running download: the two-key gate appears, names what is affected, and only the confirmed
   path calls `stop()`.
7. With the output directory pointed at a folder holding real `.mca` files, run "Count the saved
   chunks": the total updates from real header reads, progress advances file by file, and Cancel
   leaves a result explicitly labelled partial.
8. Save the current options as a profile, change several options, then load the profile back: every
   control (including ones disabled by another option's state) reflects the reloaded values exactly.
9. Search the activity log for text and by severity, select the shown lines and the full matching set
   separately, delete the selection, and confirm the retained log's own dropped-line count is
   unaffected by that deletion.
10. Export profiles and the log in more than one format and confirm the preflight names any field a
    format cannot carry, before anything is written.

## Language modes, humour and School mode

Every label, action, description, empty state and error in this feature is an i18n key with a
five-rung ladder in English and in playful Hong Kong Cantonese (`strings.ts`). Humour changes voice,
never facts: a level-5 "delete these log lines" confirmation still names the exact count and exactly
what cannot be undone, in both languages. The two model-layer exceptions are the Java core's own
validation and process-lifecycle messages (`options.ts`'s `validate` reasons, `session.ts`'s status
strings) — these describe a real technical condition precisely and are kept in plain English at the
model layer, exactly as the equivalent `SettingControl.validate` messages are elsewhere in this
application; every *rendered* surface around them is fully localized.

This feature has no Cantonese-only, bilingual-only or personal-vocabulary capability of its own to
hide, so School mode changes only how its copy reads, through the shared catalogue, exactly as
everywhere else.

## Gotchas and limitations

- The extended-render-distance and auto-open/auto-reply options are genuinely experimental at the
  Java-core level (the jar's own `usage` text says so); this application surfaces them exactly as the
  jar defines them and does not soften or hide that.
- `--center-x` and `--center-z` are declared as a pair by the jar's own argument parser
  (`depends = "--center-z"` and back); this feature emits both together or neither, from the centre-X
  option's `args()` alone, so the two rows can never disagree about whether the offset is active.
- Java's version banner prints on stderr; a Java probe reading stderr as automatic failure would
  misreport every working Java installation, so `probeJava` decides success from the exit code alone.
- Counting chunks reads every region file's header; a very large world makes this a genuinely slow,
  cancellable action rather than something safe to run on every status poll.

## Suggested related articles

- [World download & saving](world-download.md) — the Java-core proxy and Anvil writer this tab
  drives; the actual packet handling, region grouping and container-content preservation live there.
- [Live overview map](live-map.md) — the map renderer whose `meta.json` status file this feature's
  player-position readout is sourced from.
- [Settings](settings.md) — where every setting on this page actually lives and how its provenance is
  reported.
- [Export](export.md) — the shared export pipeline behind the profile and log export actions.
- [Version history](history.md) — where profile creation, updates and deletions are recorded.
- [Worldlens](worldlens.md) — the companion renderer a captured world can be handed to once the
  download is done.
