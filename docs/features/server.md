# Server and container manager

> A container list for every container Docker knows about on this machine — state, health, ports
> and Compose labels — with a live or snapshot log reader, gated start, stop, restart and remove,
> and an install-vs-daemon distinction that always points at the right fix.

## What it does

This feature replaces the small, single-container manager that used to ship beside the world
downloader. That manager listed one hard-coded container name, echoed the exact `docker` command
it ran, and offered start, stop and remove with a single button press. Everything it did is here,
against **every** container on the machine rather than one name, and every command that destroys
something now runs behind the two-key confirmation gate instead of a bare click.

Two destinations ship:

| Tab | What it holds |
| --- | --- |
| **Containers** (`server.containers`) | Every container Docker lists: state, health, ports, Compose project/service, uptime, and per-row and bulk start/stop/restart/remove. |
| **Container logs** (`server.logs`) | One container's log at a time, read as a snapshot or followed live, with severity filtering, search, selection, copy and export. |

Nothing in this feature opens a Docker socket or bundles a Docker client library. Every fact shown
— a state, a port binding, an uptime string — is read from what the `docker` command line on this
machine actually printed, run through the application's privileged process bridge
(`ctx.studio.process`). Where Docker says nothing, this feature says nothing rather than inventing
a value.

## How it works

### One shared poll loop

`state.ts` holds a single `ServerState` object shared by both destinations: one daemon probe, one
container list, one set of in-flight operations. A destination calls `attach()` on mount and the
returned detach function on unmount; the poll loop only runs while at least one destination is
open, on the interval from **Automatic refresh, in seconds** (`server.refreshSeconds`, default 5,
2–120). Changing that setting calls `ServerState.restartTimer()` so the new interval takes effect
immediately rather than at the next natural poll.

Because both destinations read the same `ServerState`, they can never disagree about what exists:
opening the log destination for a container that the containers destination just removed shows the
same "no longer listed" state in both places.

### Docker missing vs Docker not answering — the distinction the row exists to satisfy

`docker.ts`'s `probeDaemon()` runs `docker version --format {{json .}}` and classifies the result
into exactly the states the inventory row calls for, each with its own recovery route:

| State | What it means | Recovery offered |
| --- | --- | --- |
| **`missing`** | The `docker` executable itself could not be found or started (matched against `ENOENT`, "not recognized", "command not found", and equivalents). | A button opens the official Docker installation page in the user's browser — the *only* network request this feature ever makes, and only on that press. |
| **`unreachable`** | `docker` ran — so it is installed — and the daemon it talks to did not answer (matched against "cannot connect to the docker daemon", named-pipe and socket errors, and equivalents). | If Docker Desktop is found at one of its platform-standard installation paths (checked with `ctx.studio.fs.stat`, never assumed), a button opens it and the panel keeps polling. If it is not found, the panel says plainly that there is nothing here to press, rather than shipping a button that would do nothing. |
| **`refused`** | The daemon answered and rejected the request (permission denied, unauthorized, or an unparsable response). | A recheck button; the exact detail Docker reported; a note that this is usually group membership on Linux or a still-starting container engine on Windows. |
| **`ready`** | A server version was reported. | The container list loads and the poll loop starts. |

The two failure states are deliberately never collapsed into one "Docker is not available" message:
one is fixed by installing something, the other by starting something that is already installed,
and a shared message would leave the user guessing which.

### Reading a container's real state

`docker.ts` parses `docker ps --all --no-trunc --format {{json .}}` line by line. A line that fails
to parse as JSON is counted as unreadable and excluded rather than silently dropped without a
trace — the containers destination reports the count under the daemon banner. State strings outside
Docker's own eight (`running`, `restarting`, `paused`, `created`, `exited`, `removing`, `dead`) are
mapped to `unknown` rather than crashing the row. Ports are parsed from Docker's comma-joined
`HOST:PORT->CONTAINER/proto` and bare `CONTAINER/proto` forms; health is read from the
`(healthy)` / `(unhealthy)` / `(health: starting)` suffix Docker appends to its own status text.

### Destructive actions and the two-key gate

Stop, restart and remove — singly from a row's primary button, its overflow menu, or in bulk from
the selection bar — all call `ctx.confirm.request` before anything runs. The confirmation names:

- the exact action and the exact container(s), with each one's image and current state;
- every published port that stops answering as a result;
- in bulk, how many of the selected containers are actually applicable (already-running containers
  are excluded from a bulk start, for example) and how many are skipped because an operation is
  already running against them;
- the exact irreversible consequence, including the **grace period** in seconds that will actually
  be used (from the **Stop grace period** setting) — a stop or restart asks every process inside to
  finish and kills it after that many seconds if it has not, and anything held only in memory and
  not yet written to disk is lost. Remove additionally states that named volumes and bind-mounted
  directories — where this project keeps a downloaded world — are **not** deleted, so a removed
  container can be recreated without losing what it held.

`ServerState.run()` refuses re-entry against a container that already has an operation in flight,
independently of whether the calling button happened to be disabled — a keyboard activation, a
palette command and a bulk action can all reach the same operation, and only one of them holds the
disabled attribute.

### Live operation progress, not a bare spinner

While a command runs, an operation card shows: the exact phase (sending → waiting → verifying →
succeeded/failed); a progress bar that is **elapsed time against the stated grace period** for a
stop or restart (explicitly labelled as elapsed time, never presented as a completion estimate,
because Docker reports no completion figure to estimate from); the exact redacted command line; and
everything the command printed as it printed it. After the list is re-read to confirm the real
outcome, the card is kept briefly and then cleared, returning the row to its ordinary controls.

### Log reading

A snapshot runs `docker logs --timestamps --tail N`; following runs the same command with
`--follow`, which never exits on its own and is stopped when following is switched off, the
container is changed, or the destination closes. Docker interleaves a container's stdout and
stderr onto one pipe, so a **followed** line keeps its real stream (used for severity and for
redaction context); a **snapshot** cannot recover which stream a line came from and every line is
recorded as `stdout`, honestly, rather than guessed.

Severity (error/warning/info/debug/other) is read from the words in each line and from which stream
it arrived on — a container log carries no severity channel of its own, and the filter panel says
so plainly rather than presenting a guess as something Docker reported.

## Configuration

Every setting is in **Settings → Server and containers**, carries its own progressive-disclosure
explanation and a provenance line naming the real value in use, and has a live control reachable
from the command palette.

| Setting | Default | What it does |
| --- | --- | --- |
| `server.refreshSeconds` | `5` | How often the container list is re-read while a destination is open. Nothing is polled while both are closed. |
| `server.showStopped` | `true` | Starting position of the "show stopped containers" switch on the containers destination. |
| `server.stopTimeoutSeconds` | `10` | Grace period Docker is given before killing a container on stop or restart. The confirmation dialog always states the exact figure that will be used. |
| `server.logTail` | `500` | Lines read from the end of a log by default (50–5000). |
| `server.logFollow` | `false` | Whether a newly chosen container is followed live by default. |
| `server.logPageSize` | `200` | Log lines per page (50–1000). |
| `server.redactSecrets` | `true` | Replaces values assigned to password/token/secret/key-shaped keys with `<redacted>` in echoed command lines, log lines, and log exports. |
| `server.exportFormat` | `json` | Default format for the container-list and log-line export actions. |

## Usage

- <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>F</kbd> → *Open the containers list*, *Open container logs*,
  *Refresh the container list*, *Check Docker again*, *Search containers*, *Search log lines*,
  *Export the container list*, *Export log lines*, *Toggle following the log live*, *Open the
  Docker installation page*, plus a live control for every setting above.
- Right-click a row (or use the row's overflow button) for start/stop/restart/remove, opening the
  log stream, opening a published address in the browser, and copying the name, id or command line.
- Every search field carries the anchored pattern builder; plain text is the default and a regular
  expression is an explicit opt-in.
- The state chips, the Compose project picker and the severity chips all show a live count and
  narrow what is shown — they never change what Docker actually has.
- Bulk actions state the exact count and a reviewable breakdown (applicable vs skipped) before
  anything runs, and report a real per-item succeeded/failed/skipped summary afterwards.

## Failure modes

| Situation | What happens |
| --- | --- |
| `docker` cannot be run at all | Reported as **missing**, with the install button as the only recovery route. |
| `docker` runs but the daemon does not answer | Reported as **unreachable**; a start button appears only when Docker Desktop is genuinely found on disk. |
| The daemon rejects the request | Reported as **refused**, with Docker's own detail and a recheck button. |
| `docker ps` fails after previously succeeding | The daemon is re-probed rather than trusting the stale "ready" state, and the containers list is cleared only if the re-probe also fails. |
| A line from `docker ps` cannot be parsed | Counted and reported under the daemon banner; excluded from the list rather than silently dropped. |
| A command times out | The bridge's own timeout kills the process; a second guard in `docker.ts` resolves the caller even if the kill itself produces no event, so nothing can hang forever. |
| The log stream ends (container stops, Docker closes it, or follow is switched off) | The status line states which of those happened, using Docker's own reported reason when one exists. |
| The 20,000-line in-memory log ceiling is reached | The oldest lines are dropped and the status line states exactly how many. |
| An export format cannot carry every field | The user is shown exactly which fields and why, before anything is written, with the option to choose another format first. |
| The clipboard refuses a copy | The exact reason is reported; nothing is silently swallowed. |

## Security considerations

- **No Docker socket, no bundled client library, no network request other than the one explicit
  "open the installation page" click.** Every fact comes from the `docker` command line, invoked
  through the same allow-listed, sandboxed process bridge every other feature uses.
- **Redaction by default.** Any value assigned to a key that looks like a password, token, secret or
  key is replaced with `<redacted>` in echoed command lines, in log lines, and in log exports,
  unless the user explicitly turns it off — which also changes what gets written to an export, and
  the export success notification says which mode was used.
- **Remove never deletes a volume or a bind mount.** The `docker rm --force` call this feature
  issues never includes `--volumes`, so a removed container's named volumes and bind-mounted
  directories — including a downloaded Minecraft world kept in one — survive the removal.
- **No arbitrary command execution.** Every invocation goes through `runDocker`/`streamDocker`,
  which only ever spawn the allow-listed `docker` binary with an argument array this feature built
  itself; nothing here accepts free-text shell input.

## Verification

1. With Docker not installed (or with the `docker` binary temporarily off `PATH`), open the
   containers destination. It reports **missing**, not **unreachable**, and offers only the install
   button.
2. With Docker installed and the daemon stopped, open the same destination. It reports
   **unreachable**; if Docker Desktop is present, a start button appears and opening it triggers a
   notification and continued polling.
3. Start a real container, stop it from a row's primary button. The confirmation names the exact
   container, its published ports, and the exact grace-period figure from settings. Confirm it —
   the operation card shows elapsed time against that same figure, then the row returns to a
   stopped state once the list re-reads.
4. Select several containers in different states and choose a bulk restart. The confirmation states
   how many are applicable and how many are skipped, and why.
5. Remove a container that has a bind-mounted directory. The confirmation states plainly that the
   mount is kept; after removal, the directory and its contents are still on disk.
6. Open the log destination for a running container, switch on **Follow live**, and watch new lines
   arrive without a manual refresh. Switch a container off while following — the status line states
   that the follow ended and why.
7. Turn off **Redact secrets in command lines and logs**, then export a log that contains a `TOKEN=`
   assignment. The exported file contains the real value; the notification says redaction was off.
8. Filter containers to a state nothing is currently in. The empty state names the total count and
   offers to reset the filters, rather than showing a bare box.
9. Select a mixture of log lines with shift-click and the keyboard, then export. Only the selected
   lines are written, and the exported count matches the selection exactly.

## Language modes, humour and School mode

All copy renders through the shared catalogue in `strings.ts`, in English, in playful Hong Kong
Cantonese, or bilingually, at whichever humour level each language is set to. Humour styles the
voice and never the facts: at level 5 a remove confirmation still names the exact container, the
exact grace period, and exactly what is kept and what is destroyed.

This feature exposes no Cantonese-only, bilingual-only, humour, personal-vocabulary or dim-sum
capability of its own, so School mode changes only how its copy reads, through the shared
catalogue, exactly as it does everywhere else.

## Key files

| Path | What lives there |
| --- | --- |
| `app/src/renderer/features/server/index.ts` | The feature module: tabs, settings, palette entries, documentation, the refresh-interval wiring. |
| `app/src/renderer/features/server/state.ts` | The shared `ServerState`, setting ids and defaults, Docker Desktop discovery, the shared poll loop. |
| `app/src/renderer/features/server/docker.ts` | Every `docker` command line: the daemon probe, container listing, redaction, run and stream helpers. |
| `app/src/renderer/features/server/containers.ts` | The containers destination: filters, statistics, selection, bulk actions, the row menu. |
| `app/src/renderer/features/server/logs.ts` | The log destination: source picker, severity filter, selection, pager, copy and export. |
| `app/src/renderer/features/server/dom.ts` | Shared DOM helpers: the collapsible section, the selection model, small formatters. |
| `app/src/renderer/features/server/strings.ts` | Every string, English and Cantonese, at all five humour levels. |
| `app/src/renderer/features/server/docs.ts` | The in-app documentation articles. |

## Gotchas and limitations

- Log severity is a **reading of the text**, not a channel Docker exposes. A container that never
  prints the word "error" will never show an error-severity line even if it is failing badly, and a
  chatty container that prints "warning" in a comment will show warnings that are not really ones.
- A container removed by another process (outside this feature) simply disappears from the list on
  the next poll; there is no separate "vanished" notification, because the list is always exactly
  what `docker ps` reports right now.
- The in-memory log buffer is capped at 20,000 lines per destination mount; a very chatty followed
  container will drop its oldest lines, and the status line always says by how many.

## Suggested related articles

- [Locks](locks.md) — the destructive-action confirmation gate every stop, restart and remove goes
  through.
- [Export](export.md) — the shared export system the container list and log lines both use.
- [Settings](settings.md) — where every server setting lives, and how provenance is reported.
- [Version history](history.md) — where every container lifecycle operation is recorded.
- [Notification centre](notification-centre.md) — where every operation's success and failure
  report lands, and stays reviewable after it auto-dismisses.
