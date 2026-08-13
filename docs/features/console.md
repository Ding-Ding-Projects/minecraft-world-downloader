# Web console, natively

The web management console (`web/app.py`) is a small Flask application that
normally runs as a Docker container's main process, driving the headless world
downloader and reporting on it through a browser dashboard. This feature talks
to that exact same process over the loopback interface, through its real JSON
API, and renders every one of its capabilities as a real native surface. It
never embeds the dashboard in a web view — there is no `<webview>`, no iframe,
and no screenshot of the browser page anywhere in this feature.

- **Feature id:** `console`
- **Destination:** *Web console* (one tab holding every section)
- **Settings section:** *Web console*
- **Command palette:** open, start, stop, configuration, account, worlds,
  records, logs, auto-explore bot, plus the live controls for four of its
  settings
- **Satisfies:** `FEATURE_INVENTORY.md` row **13.5**

---

## Behaviour

### Installation and service

The feature inspects the configured console folder for `app.py`, `auth.py`,
`requirements.txt` and a `templates` directory, and reports exactly what it
found — not a generic "not ready". Installing dependencies runs
`py -m pip install --user -r requirements.txt` from that folder as a child
process this application owns, streaming its output into the same log view
the service itself uses.

Starting the console spawns it as a child process (`py app.py`, `python
app.py` or `python3 app.py`, chosen in Settings), with `WEB_PORT`, `DATA_DIR`
and, when set, `JAR_PATH` in its environment. A health probe on a timer
(`/healthz`, which the console deliberately does not gate behind its own
login) distinguishes nine states, each with its own recovery action:

| State | Meaning | Recovery |
| --- | --- | --- |
| Not configured | No console folder set | Set one in Settings |
| Not installed | Folder set, but no `app.py` there | Point at the right folder |
| Stopped | Folder ready, nothing answering | Start it |
| Starting | This application started it, not answering yet | Wait, or check the log |
| Running | Healthy, this application owns the process | — |
| Running elsewhere | Healthy, something else started it | This application can talk to it but cannot stop it |
| Behind its own login | The console's `WEB_PASSWORD` gate is on | See *Security* below |
| Unhealthy | Something answered, but not the console's shape | Check what else is on that port |
| Exited | The owned process ended | Its exit code and log are kept; start again |

A console this application did not start can still be talked to (status, logs,
worlds, account, configuration) — only *stopping* it is refused, because this
application has no process handle for something it did not launch.

### Configuration

Every downloader option the console persists into `manager-config.json` is
rendered here, grouped exactly as the console groups them (Connection, World
output, Render distance & map, Auto-open containers, Chat auto-reply,
Advanced), because `options.ts` is a direct transcription of the console's own
`OPTIONS` table. **Save** persists without starting anything; **Start**
launches with the current form; **Restart** re-launches an already-running
console with it. The exact command line the console would build — including
its two overrides (the proxy port forced onto the published container port,
and the paired centre coordinates) — is previewed before anything runs, and
can be copied. Editing a field never touches the saved configuration until
Save, Start or Restart is pressed; a background health probe never
overwrites what is mid-typed, because the fields are only ever rewritten
after an explicit save/start/restart/reset, not on every poll.

### Minecraft account

Three sign-in routes, matching the console's own: a Microsoft device-code flow
(the code and the verification link are shown and copyable, and this feature
polls the console the same way the browser dashboard does), a pasted access
token, and an offline username. Sign-out goes through the destructive-action
gate, because it drops the console's current sign-in immediately.

### Worlds

Every world folder inside the console's data directory is listed — not only
the one the current configuration points at, because changing the output
directory leaves the previous world exactly where it was. Each is measured
for size, file count, region-file count, the dimension folders present, and
whether an overview render exists, within a bounded walk (depth and file-count
caps in Settings); when a measurement hits its bound, the total is marked as a
floor rather than presented as exact. The list carries multi-select, an
honestly-scoped select-all over the currently searched set, inverse selection,
and bulk export.

### Stored records

The console's own files — the saved configuration, the account record, the
session signing key, the bot's cached state, its Microsoft token cache, and
any exported snapshots — are stated by size and modification time.
Credential-bearing files (the account record, the signing key, the bot's
token cache) are never opened by this feature; only their existence is
reported.

### Logs

The downloader's and the auto-explore bot's output, fetched incrementally
using the console's own monotonic cursor so nothing already seen is
re-fetched. A local search filters the visible lines (plain text by default,
with the full pattern builder available), a follow toggle keeps the view
scrolled to the newest line, and clearing the view goes through the
destructive-action gate because the console's cursor has already advanced
past the cleared lines — they cannot be re-fetched into this view again.

### Auto-explore bot

Start, stop and Microsoft sign-in for the console's own mineflayer walking
bot. This surface intentionally does not yet expose the bot's individual run
parameters (radius, count, fly preference, revisit behaviour) — it starts the
bot with whatever the console's own `bot-config.json` last held. Setting those
in detail still requires the browser dashboard or a direct edit of that file
until a future pass extends this surface.

---

## Configuration

All settings live under **Settings → Web console**:

| Setting | Default | Notes |
| --- | --- | --- |
| Console folder | *(none)* | Must contain `app.py` |
| Data directory | *(none)* | The console's `DATA_DIR` |
| Python launcher | `py` | `py`, `python` or `python3` |
| Console port | `8080` | Loopback only |
| Downloader jar | *(none)* | Passed as `JAR_PATH`; blank uses the console's own default |
| Poll automatically | on | |
| Seconds between health checks | `5` | |
| Seconds between log fetches | `2` | |
| Log lines kept | `2000` | This surface's own retention, not the console's |
| Follow the log | on | |
| World scan depth | `4` | Folders below the data directory |
| World scan file cap | `40000` | Per world |
| Console sign-in username | `admin` | Used only when starting with the login gate on |
| Start with the console's login gate | off | Requires a stored password |
| Console password | *(vault)* | See *Security* |
| Rescan worlds when this tab regains focus | off | |

---

## Failure modes

- **Nothing answers on the port** — reported as *Stopped* (ready to start) or
  *Not installed* (nothing to start), never a generic connection error.
- **Something answers, but not with the console's shape** — reported as
  *Unhealthy*: something else is listening on that port.
- **The console redirects to its own sign-in page, or answers 401** —
  reported as *Behind its own login*, with the exact reason. See *Security*.
- **The owned service process exits** — its exit code is kept, the log holds
  whatever it printed, and health is re-checked in case something else is now
  answering on that port.
- **A world folder cannot be read partway through a scan** — the scan
  continues, and that world's totals are marked as a floor rather than
  failing the whole scan.
- **A configuration field fails validation** (a server address with a space
  or a colon, a non-numeric field expecting an integer) — reported inline,
  beside the field, in plain words; the invalid value is never written into
  the tracked configuration.

---

## Security considerations

- **Outbound HTTP is deny-by-default.** This feature registers exactly one
  allow rule (`client.ts`, `ensureAllowRule`), naming itself and its reason,
  before its first request, and only ever talks to `127.0.0.1`.
- **Cookies and `authorization` headers are stripped from every outbound
  request by the privileged bridge.** A console started with `WEB_PASSWORD`
  set therefore gates its API behind a session cookie this application
  cannot present. This is reported as its own honest state — *behind its own
  login* — rather than a broken console, with two real recoveries: start the
  console without the login gate, or turn the requirement off in Settings.
- **The console's own login password** lives only in the operating system
  credential vault (`console.web-password`), is never rendered, exported, or
  written to a log or history entry, and is read exactly once — immediately
  before the console starts — straight into the child process environment.
- **A pasted Minecraft access token** is passed straight through to the
  console's `/api/auth/manual` route and is never stored anywhere by this
  feature: not in settings, not in the vault, not in an export, not in a log
  line.
- **`auth.json`, `.secret_key` and the bot's Microsoft token cache** are
  reported by existence, size and modification time only. This feature never
  opens them.
- **The console's login gate is off by default**, exactly as the console
  itself ships. With no password stored, anything that can reach the
  configured port can drive the downloader, read logs, sign accounts in and
  out, and read worlds. Setting a password and turning the login-gate setting
  on is the console's own mitigation, unchanged by this feature.

---

## Verification

Exercised against the console's real JSON routes, over loopback, through the
privileged bridge — no mock server and no embedded browser:

- `GET /healthz`, `GET /api/status`, `GET /api/logs`, `GET /api/bot/logs`,
  `GET /api/bot/status`, `GET /api/world-info`, `GET /api/auth/status`
- `POST /api/save`, `/api/start`, `/api/stop`, `/api/restart`,
  `/api/export-dir`
- `POST /api/auth/microsoft/start`, `GET /api/auth/microsoft/poll`,
  `POST /api/auth/manual`, `/api/auth/offline`, `/api/auth/logout`
- `POST /api/bot/start`, `/api/bot/auth`, `/api/bot/stop`

The command-line preview (`options.ts`, `previewCommandLine`) is a direct
transcription of the console's own `Downloader.build_command`, including its
two overrides: the fixed container proxy port, and the paired centre
coordinates. The option schema (`options.ts`, `CONSOLE_OPTIONS`) is a
transcription of the console's own `OPTIONS` table — same keys, same flags,
same defaults — because a key invented here would be written into
`manager-config.json` and then silently ignored by the console.

`npx tsc --noEmit -p tsconfig.web.json` is clean for every file in
`app/src/renderer/features/console/`.

---

## Suggested related articles

- [Server and container manager](desktop-manager.md)
- [Scraper bot](scraper-bot.md)
- [World download](world-download.md)
- [Local version history](history.md)
- [Export](export.md)
- [Locks](locks.md)
- [The original web console (reference)](web-console.md)
