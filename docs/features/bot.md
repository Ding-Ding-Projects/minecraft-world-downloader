# Scraper bot

> Runs the bundled Node scraper — a mineflayer-based client, not the in-app mineflayer chat surfaces
> — through the downloader proxy: saved profiles, live run controls over a real process, a searchable
> run log, and a capture-rule pipeline that turns matching output lines into a table of captured
> messages.

## What it does

World Downloader Studio captures whatever chunks a Minecraft client actually loads; it does not walk
the world by itself. `scraper/scrape.js` in the project checkout is a small Node script, built on
mineflayer, that logs in, walks or flies a grid of waypoints and disconnects — the thing that
actually makes the proxy see chunks worth saving. This feature (`features/bot`) is the control
surface over that real, external process. It is deliberately distinct from `features/mineflayer` and
`features/mineflayer-chat`, which embed a mineflayer bot **inside** the renderer process itself; this
feature never does that. Everything here happens by spawning and watching `node scrape.js` as its own
operating-system process through the privileged process bridge, so nothing about a run is simulated.

Four surfaces, in the order a person actually uses them:

| Surface | What it holds |
| --- | --- |
| **Run controls** | Pick a saved profile, start it, watch its phase live, stop it, reveal the generated configuration file. |
| **Profiles** | Saved scraper configurations with a guided editor, five starter presets, and the full bulk-action set. |
| **Run log** | Every line the scraper printed, verbatim, filterable by severity and searchable. |
| **Captured messages** | Rows a capture rule matched — chat, sign-in, progress, kicks, errors — sortable, taggable, exportable, and editable capture rules underneath. |

## How it works

### Profiles

A profile (`app/src/renderer/features/bot/state.ts`, `BotProfile`) is an editable record of every key
the scraper's own `loadConfig` recognises: the proxy address and port (never the real server —
`config.ts` is explicit that the proxy is what saves chunks), the protocol version, one account per
bot, the area to cover (centre-and-radius, an explicit bounding box, or around-each-spawn), movement
(fly/walk per game mode, altitude), timing (per-chunk dwell, waypoint timeout, container dwell, final
drain before disconnecting), the visited-chunk cache path and whether to ignore it, and an optional
stored AuthMe-style login password.

`config.ts` owns translating a profile into the scraper's actual configuration JSON
(`toScraperConfig`), a `redactedConfig` variant that swaps the password for a marker wherever a human
or an export might see it, a rough chunk-count estimate (`estimateArea`) shown live in the editor, and
`validateProfile`, which returns every problem in plain words — which field, and what to do about it,
never a bare "invalid". A profile can be saved with problems still outstanding; only *starting a run*
refuses until the list is empty, and the disabled Start button names the first unmet condition.

Five presets (also in `config.ts`) offer a blank-slate starting point: the scraper's own compiled-in
defaults, a walk-around-spawn profile, a large flying sweep, a slow pass tuned for automatic container
opening, and a resume-an-interrupted-sweep profile. Each preset card states exactly which fields it
sets, before it is applied; what comes out afterwards is an ordinary, fully editable profile with no
special status.

The editor (`profileform.ts`) never presents a blank box where a real list exists: the protocol
version picker reads the versions actually installed under the scraper's `minecraft-data` dependency
(falling back to whatever versions other profiles already use when that cannot be read), and the
known-hosts picker is seeded from every other profile's proxy address.

### Running the scraper

`runner.ts` (`BotRunner`) owns exactly one run at a time — the scraper already runs every account in
a profile as its own bot inside one process, so a second concurrent process would fight the first over
the visited-chunk cache file. Starting a run:

1. Validates the profile again (defence in depth against a stale UI state).
2. Locates `scrape.js` (`directoryFor`/`locateScript` in `runner.ts`) — the profile's own
   scraper-folder override first, then the feature's `bot.scraperDirectory` setting, then the copy of
   the `scraper/` project this installation bundles at `<resources>/scraper` (`electron-builder.yml`'s
   `extraResources`, resolved through `ctx.studio.bundled.resolve('scraperScript')`) — and confirms the
   file genuinely exists before spawning anything, rather than reporting "started" for a spawn that
   will immediately fail with a module-not-found error. Either explicit setting still wins the moment
   one is set; the bundled copy is only ever the last resort for a machine that has configured nothing.
3. Writes a generated configuration file into the application's own data directory
   (`<userData>/bot-runs/<profileId>.config.json`), including the AuthMe password read from the
   credential vault if automatic login is on.
4. Resolves a Node interpreter through `ctx.studio.bundled.resolve('node')` — this installation's own
   embedded Electron runtime first (`main/services/node-runtime.ts`, `process.execPath` spawned with
   `ELECTRON_RUN_AS_NODE=1`), a system `node` on PATH only as a fallback — and spawns
   `<that> <scrape.js path> --config <file>` through `studio.process.spawn` with the scraper's own
   folder as the working directory. `node` also stays on the privileged bridge's bare command
   allow-list, so a manually-configured system `node` keeps working exactly as before.
5. Streams every `stdout`/`stderr` chunk from the `process:event` push channel, splits it into whole
   lines, classifies each line's severity (`capture.ts`'s `severityOf`), appends it to the run log, and
   — when `bot.captureFromRun` is on — runs it through the compiled capture rules.
6. On exit, records the outcome in local history and **overwrites** the generated configuration file
   with `{}` so the password it may have carried does not sit on disk between runs.

If the tab is closed mid-run and reopened, `adopt()` looks for an already-running scraper process
through `studio.process.list()` — matching either the bare `node` command or this installation's own
resolved embedded-runtime command — and reattaches to it, replaying its retained stdout, rather than
losing track of a run that is still going.

A Microsoft account's first sign-in prints a `MSA_CODE {...}` line; the runner parses it and the panel
shows a dedicated device-code panel with a one-click link to the sign-in page. After that one-time
step per account, the scraper caches the token itself.

### Capture rules and captured messages

A **capture rule** (`capture.ts`, `CaptureRule`) is a regular expression plus a sender template, a
message capture group, an optional timestamp capture group, and a target channel (chat, system, auth,
progress, disconnect, error). Every line a run prints reaches the run log unconditionally; becoming a
row in the captured-messages table is a separate, additional step that only happens when a rule
matches. The seven shipped rules (`builtInRules()`) match the shapes the bundled scraper genuinely
prints — sign-in, a Microsoft device code, progress reports, kicks/disconnects, errors — because the
scraper, as shipped, does not echo server chat. Real chat capture comes from importing a server or
console log file, which runs through the exact same rule pipeline as live output
(`captureLines`/`captureLine`), with every row stating whether it came from a run or an import.

Rules can be disabled, edited in place, or opened in the full anchored pattern builder. Disabling or
removing a *shipped* rule is recoverable — "Restore the shipped rules" brings it back without
disturbing custom rules or anything already captured; deleting a rule you wrote yourself is not
recoverable, and the confirmation dialog says so.

## Configuration

All settings live in the **Scraper bot** settings section (`bot.settings`, order 140):

| Setting | Id | Default | What it does |
| --- | --- | --- | --- |
| Default scraper folder | `bot.scraperDirectory` | *(empty)* | Fallback folder containing `scrape.js` for any profile that does not name its own. Leaving this empty too falls back to the copy of `scraper/` this installation bundles. |
| Captured message limit | `bot.messageLimit` | 5000 | Oldest captured messages are dropped first once a run or import would exceed it. |
| Run log limit | `bot.logLimit` | 2000 | Oldest run-log lines are dropped first past this ceiling. |
| Follow the newest run log line by default | `bot.followLog` | on | Starting position of the run log's own follow switch. |
| Capture messages while a run is going | `bot.captureFromRun` | on | Whether live output is also checked against the capture rules, not just written to the log. |
| Default export format | `bot.exportFormat` | `json` | Pre-selected format for exporting profiles, the run log or captured messages. |
| Signal used to stop the bot | `bot.stopSignal` | `SIGTERM` | `SIGTERM` (clean shutdown), `SIGINT` (same as Ctrl+C) or `SIGKILL` (immediate, no cleanup). |

Every profile can additionally override the scraper folder for itself alone.

## Failure modes

- **No scraper folder set (and no bundled copy in this build either), or `scrape.js` missing from the
  resolved folder** — the run refuses to start and names the exact problem (`locateScript` in
  `runner.ts`) instead of spawning a process that would immediately fail with an opaque module error.
- **No Node runtime could be resolved at all** — this installation's own embedded Electron runtime
  means this practically never happens in a normal packaged build; it is reported honestly as "No Node
  runtime could be found to run the scraper" if it ever does, rather than ever handing back a browser
  link. A real spawn failure once a runtime *was* resolved (a permissions problem, a corrupted
  installation) is reported by `studio.process.spawn` and surfaced as "The scraper could not be
  started", verbatim.
- **Automatic login is on with no password stored** — caught by `validateProfile` before a run is
  attempted, and again defensively by the runner if the credential vault read fails or the secret has
  since been removed.
- **A run is already going** — starting a second run, from anywhere (the run controls, or a profile
  row's own run button), is refused with a plain explanation; only one scraper process runs at a time.
- **An imported log file matches no capture rule** — reported honestly ("nothing matched"), naming how
  many lines were read, rather than silently importing zero rows with no explanation.
- **A capture rule's pattern does not compile** — shown inline beside that rule, and the rule is
  treated as disabled for matching purposes rather than throwing during a run.
- **The stored message or log limit is exceeded** — older rows are dropped and the user is told how
  many, both for a live run and for a log-file import.

## Security considerations

- A profile's proxy address is explicitly never the real Minecraft server; `config.ts` and the field
  help text both say so, because the proxy is what actually saves chunks.
- An AuthMe-style login password lives in the operating system credential vault, addressed by an
  opaque per-profile account key — never in the settings file, never rendered back to the editor, and
  never included in an unredacted export or history payload (`redactedConfig`, `field.password.help`).
- The password reaches the scraper process the only way it can: written into the generated
  configuration file for the duration of a run, and that file is overwritten with `{}` the moment the
  run ends, so it does not sit on disk between runs.
- Deleting a profile deletes any password it stored in the vault at the same time, so a removed
  profile cannot leave an orphaned credential behind. Duplicating a profile deliberately does **not**
  copy the vault key — sharing one credential-vault entry between two profiles would mean deleting
  either one deletes the other's password — so a duplicate starts with automatic login off.
- The only network traffic this feature causes is the scraper's own Minecraft connection to the proxy
  address named in the profile; nothing here calls `studio.http` or reaches outside the machine.
- `node` is invoked only through the privileged bridge's allow-listed process spawn, with explicit
  arguments (`scrape.js`, `--config`, an application-data path) — never through a shell, and never with
  user-supplied text interpolated into a command line.

## Verification

- `validateProfile` covers: empty name, empty/invalid host, out-of-range port, no accounts, duplicate
  account names, an unusable offline name, a Microsoft name with no `@`, an inverted bounding box, a
  too-small radius, a non-positive chunk step, both movement switches off, and every timing field's
  lower bound. Each returns the exact field and a plain-words message.
- `estimateArea` was checked against both the centre/radius and bounding-box paths, including the
  "known: false" case for around-each-spawn, where the total genuinely cannot be known in advance.
- The capture pipeline (`captureLine`/`captureLines`) was exercised against every shipped rule's real
  match text, plus a malformed pattern (compiles to `regex: null` with the error surfaced, not thrown),
  a line matching no rule (produces no row), and the bare-clock-time timestamp path (anchored to the
  capture date, flagged `timestampFromLine: false` otherwise).
- The run/profile/messages/rules lists carry the full bulk-action contract: multi-select, an honestly
  scoped select-all (shown vs. every profile/message), inverse selection, and every destructive action
  behind `ctx.confirm.request` naming the exact affected items.
- `npx tsc --noEmit -p tsconfig.web.json` is clean for every file in `features/bot`.

## Language modes, humour and School mode

Every string this feature renders — including validation and destructive-action copy — is an i18n key
resolved through the shared catalogue (`strings.ts`), with a five-rung ladder in English and in
Cantonese. The two humour levels are independent; facts (profile names, hosts, counts, ports) never
change with the humour level, only the voice around them does. This feature adds no Cantonese-only,
bilingual-only or humour-specific control of its own, so School mode changes only how its copy reads,
exactly as everywhere else — there is nothing here for that mode to omit.

## Gotchas and limitations

- The scraper, as shipped, does not echo server chat — only its own sign-in, progress, kick and error
  lines. Capturing actual player chat requires importing a server or console log file that contains
  it; running the bot alone will never produce chat rows.
- A bare `HH:MM:SS` timestamp captured out of a console log line has no date of its own, so it is
  anchored to the moment the line was read; the row says so (`timestampFromLine: false`) rather than
  presenting a guessed full timestamp as fact.
- Only one scraper run is tracked at a time by design, because every account in a profile already runs
  as its own bot inside that one process, and two processes would race over the same visited-chunk
  cache file.
- Reattaching to an already-running scraper after reopening the tab replays retained stdout only —
  stderr history is not replayed on adoption, since only the live event stream is guaranteed complete
  for a freshly attached process.

## Suggested related articles

- [Settings](settings.md) — where every scraper-bot setting lives, and how provenance is reported.
- [History](history.md) — the local, append-only record every profile save, run start/stop and
  message import writes to.
- [Locks](locks.md) — the per-element toy locks available on this tab's controls, exactly as on any
  other rendered element.
- [Export](export.md) — the shared export pipeline profiles, run log lines and captured messages all
  go through.
