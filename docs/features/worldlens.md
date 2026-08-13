# Worldlens pairing

> Finds a downloaded world, finds an installed Worldlens (a separate, freely installable companion product), and hands one to the other — either by launching Worldlens's desktop application or by driving its headless command-line renderer to serve an in-app map on loopback.

- **Feature id:** `worldlens`
- **Destination:** *Worldlens* (`worldlens.main`)
- **Settings section:** *Worldlens*
- **Command palette:** open, detect, get Worldlens, jump to render-and-serve, stop the renderer, plus the live controls for its nine settings
- **Satisfies:** `FEATURE_INVENTORY.md` row **13.2a**

---

## What it does

This feature draws nothing itself. It is a pairing between two things this
application does not own:

1. **Worldlens's desktop application** — a separate product, installed
   through Squirrel like any other Squirrel package, that this feature can
   *find* and *launch* but never bundles, downloads or installs on the
   user's behalf.
2. **Worldlens's headless command-line renderer** — either the renderer
   `.jar` every Worldlens release attaches, run with `java`, or the
   `@worldlens/cli` package's `dist/index.js`, run with `node`. This is what
   actually draws a map when the in-app **Render and serve** action is used.

The world list this feature shows comes from scanning a folder for
`level.dat` files this application has already downloaded — it never reaches
into the downloader's own settings or state to find that folder, and it never
writes into a world folder. `endpoint.ts` publishes a small, typed record of
whatever this feature is currently serving (`currentMapEndpoint()` /
`subscribeMapEndpoint()`), so the separate `map` feature can offer it as a
source without either feature importing the other's internals.

## How it works

### Files

| File | Owns |
| --- | --- |
| `probe.ts` | Pure path arithmetic, version comparison, and parsing of the renderer's own console output. No DOM, no privileged bridge — everything here is testable without a running application. |
| `detect.ts` | Finding an installed desktop application (`detectDesktop`, `validateDesktopExecutable`) and validating a chosen headless renderer, including probing its own `--version` (`validateRenderer`, `suggestRendererPaths`). |
| `worlds.ts` | Scanning a folder for `level.dat`-holding directories and reading enough of each (via `nbt.ts`) to report its display name, Minecraft version and available dimensions (`scanWorlds`, `readWorld`). |
| `nbt.ts` | A bounded, dependency-free NBT reader for exactly the fields this feature needs out of `level.dat` — `LevelName`, `Version.Name`, `DataVersion`. Gzip/zlib/uncompressed are all recognised by their leading bytes. |
| `config.ts` | Writing the HOCON configuration folder (`core.conf`, `webserver.conf`, `webapp.conf`, one map file per dimension) the headless renderer reads for one render (`writeRenderConfig`, `renderArguments`). |
| `runner.ts` | Driving one renderer child process at a time (`RenderRunner`): real progress parsed from its own output, re-entry refused rather than merely disabled, and the loopback endpoint published the moment the server reports itself listening. |
| `endpoint.ts` | The typed contract published to the rest of the application: `currentMapEndpoint()`, `subscribeMapEndpoint()`, `currentRenderOutput()`. Loopback-only, and `null` whenever nothing is running. |
| `panel.ts` | The tab's DOM, `WorldlensState` (the part that survives the tab closing — the runner and the cached probe results), and `detectAndNotify` (shared by the tab button, the settings action and the palette command). |
| `docs.ts` | The in-application documentation article, mirroring this file. |
| `strings.ts` | This feature's own copy, in English and playful Hong Kong Cantonese, at all five humour levels. |
| `index.ts` | The `FeatureModule`: settings section, palette entries, the tab, and `init`, which creates the shared `WorldlensState` once and wires settings changes to fresh probes. |

### The desktop handoff

Worldlens's desktop application takes no world path on its command line and
registers no link scheme this application could use to tell it what to open.
Handing off a world is therefore honest about that limitation rather than
pretending it works like a normal "open with": the world's folder path is
copied to the clipboard, Worldlens is launched through
`studio.shell.openPath(executablePath)` (the same privileged route used to
reveal a folder — not `studio.process.spawn`, whose allow-list is reserved for
the CLI runtimes this feature and others already drive), and the notification
that follows says plainly that the path still has to be pasted into
Worldlens's own world picker by hand. When the clipboard write itself fails,
the notification says that too, rather than claiming a copy that did not
happen.

### Rendering in-app

Selecting exactly one world, ticking at least one of its available
dimensions, and choosing **Render and serve** builds a `RenderPlan` from the
current settings, has `config.ts` write the renderer's configuration folder,
and hands it to `RenderRunner.start`. The runner refuses re-entry itself
(`busy()`), not only through the button being disabled, because a keyboard
submit or a palette command reaches the same code without ever touching the
button. Real progress — the renderer's own reported task and percentage — is
parsed from its stdout/stderr as it arrives; when the renderer has not
reported a percentage yet, the surface says so in words rather than
inventing a number or spinning silently.

### Loopback, always

Every configuration this feature writes pins the map server's listen address
to `127.0.0.1`, regardless of what the renderer's own default (`0.0.0.0`,
which would publish to every interface on the machine) would have been. The
map is reachable from this computer and nowhere else, for as long as the
renderer keeps running. Turning on **Keep watching the world after
rendering** keeps it running and redrawing after the first pass — useful
while a download is still writing into the same world — and it keeps using
processor time until it is stopped.

### World-version support

Worldlens states it reads Minecraft `1.12.2` through `26.x`. Every scanned
world's `Version.Name` (read from `level.dat`, when present) is checked
against that range and reported as supported, older, newer, or unknown (a
version string that does not parse as a numbered release, such as a snapshot
name). The check is informative, not a gate: a world outside the range can
still be selected and rendered, and the renderer or the desktop application
will say what it actually makes of it.

## Configuration

Every setting lives under **Settings → Worldlens**:

| Setting | Default | Purpose |
| --- | --- | --- |
| Worldlens executable | (none) | Overrides automatic detection of the desktop application. Empty uses whatever `detectDesktop` finds under the local application-data directory, where Squirrel installs it. |
| Headless renderer | (none) | The command-line renderer driven for the in-app map — the release `.jar` (run with `java`) or `@worldlens/cli`'s `dist/index.js` (run with `node`). Empty means this tab cannot render, and says so rather than pretending. |
| Worlds folder | (none) | Where this tab looks for downloaded worlds. A folder holding a `level.dat` is one world; any other folder is scanned one level deep. Read only, never written. |
| Render output folder | (none) | Where a render writes. The renderer creates `config`, `web` and `data` inside it; tiles land in `web/maps`. The world folder itself is never modified. |
| Loopback port | 8100 | The port the map server listens on. Always bound to `127.0.0.1`; the port picks the local address, never the audience. |
| Render threads | 2 | Worker threads the renderer uses. More finishes sooner and leaves less of the machine for anything else, including a download running at the same time. |
| Let the renderer download Minecraft client files | Off | The only setting here that permits a network request. On, the renderer may fetch block textures from Mojang mid-render; off, it uses what is already on the machine and stops with a message when it cannot. |
| Keep watching the world after rendering | Off | Keeps the renderer running and redrawing after the first pass. Uses processor time until stopped. |
| Re-render every chunk | Off | Redraws every chunk instead of only the ones that changed — slower, and the fix for a map that looks wrong after a partial render. |
| Open the Worldlens releases page | (action) | Opens Worldlens's GitHub releases page in the user's own browser. Never downloads or installs anything. |
| Detect Worldlens now | (action) | Re-runs detection of both the desktop application and the renderer. Looking changes nothing on disk. |

## Failure modes

Every state below is a distinct, honest message rather than one blank panel
or a spinner that never resolves:

- **Desktop application:** not installed (with the exact paths searched),
  unsupported platform (Worldlens ships a Windows installer only), the
  search itself could not complete, or a hand-chosen path is invalid.
- **Renderer:** unconfigured, a chosen path that is neither a `.jar` nor a
  recognised JavaScript entry point, or ready with its version unknown
  (the `--version` probe failed or timed out — the renderer is still usable,
  the version line simply could not be read).
- **Worlds folder:** unconfigured, the folder does not exist, the folder
  could not be read, or the folder exists but holds nothing with a
  `level.dat` in it (states how many candidate folders were actually
  inspected).
- **A render:** refused for exactly one of four reasons the caller can show
  verbatim — a render is already busy, no renderer is configured, the
  configuration folder could not be written, or the process could not be
  spawned. A render that starts and then fails reports the renderer's own
  error line, or its exit code when it printed nothing recognisable.
- **The handoff:** Worldlens is not installed (with a direct route to get
  it), the desktop application could not be launched from the resolved
  path, or the clipboard write failed — each reported separately rather than
  folded into one generic failure.

## Security considerations

- **No bundling, no silent installation.** Worldlens is never downloaded,
  installed or embedded by this application. **Get Worldlens** opens a
  public releases page in the user's own browser through
  `studio.shell.openExternal`, which refuses anything that is not `http(s)`;
  installing it remains an action the user takes themselves.
- **Loopback only, unconditionally.** Every configuration file this feature
  writes pins the map server to `127.0.0.1`, overriding whatever the
  renderer's own default would have published. This is written into the
  configuration text itself, not merely documented as an intention.
- **One network switch, off by default.** `accept-download` in the written
  configuration is the single place this pairing can cause a network
  request, and it defaults to off. Every other file operation is local reads
  and writes inside the chosen output directory.
- **Bounded, dependency-free NBT reading.** `nbt.ts` caps the raw file
  (4 MiB), the inflated document (16 MiB), nesting depth (64), list/array
  element counts (1,000,000) and individual string length (64 KiB) before
  parsing a byte of a `level.dat` a user did not necessarily create
  themselves. A file that exceeds any bound is refused with a stated reason
  rather than parsed.
- **The launched process is exactly the resolved path.** The desktop handoff
  uses `studio.shell.openPath` on the path this feature itself validated
  (either detected under the local application-data directory or a
  hand-chosen file that passed the same checks); the headless renderer is
  spawned only as `java` or `node` — both already on the privileged bridge's
  fixed process allow-list — with the configuration folder this feature just
  wrote as the only variable input.
- **World folders are never modified.** Both the desktop handoff and the
  in-app render treat the world folder as read-only; every write happens
  inside the separately chosen output directory.

## Verification

- With Worldlens not installed, confirm the desktop-application state names
  every path that was searched, and that **Get Worldlens** opens the
  releases page.
- Install Worldlens (or point **Worldlens executable** at a chosen copy) and
  confirm detection reports the resolved path and, when the install layout
  carries an `app-<version>` folder, the version.
- Select a world and choose **Open this world in Worldlens** from its row
  menu; confirm the desktop application launches, the path lands on the
  clipboard, and the notification says so honestly (including the case
  where the clipboard write itself fails).
- Point **Headless renderer** at the release `.jar` and separately at
  `@worldlens/cli`'s `dist/index.js`; confirm both are recognised, launched
  with the correct command, and report a version when the probe succeeds.
- Point **Worlds folder** at a folder with no `level.dat` anywhere in it, a
  folder that does not exist, and a real worlds folder; confirm each honest
  state and, for the real folder, that supported/older/newer/unknown
  versions are reported correctly against a few test saves.
- Start a render, confirm progress and log lines update from the renderer's
  own output, confirm the map endpoint is only ever reachable at
  `127.0.0.1`, and confirm **Stop the renderer** ends it cleanly. Start a
  second render while the first is running and confirm it is refused with
  the busy message rather than starting a second process.
- Confirm the render button's disabled reason changes correctly across: no
  renderer configured, a render already running, no world selected, and a
  world selected with every dimension unticked.
- Search the worlds table, page through more than one page of results at
  the 50-row page size, and confirm **Select the N worlds shown** and
  **Select all N worlds found** select genuinely different sets when the
  match count exceeds one page.
- Export the world list and confirm the CSV write only happens after any
  field-loss warning has been shown.
- `npx tsc --noEmit -p tsconfig.web.json` from `app/` is clean for this
  feature.

## Language modes, humour and School mode

Every user-facing string in this feature is an i18n key with a five-rung
ladder in English and Cantonese (`strings.ts`). Both humour levels change the
voice independently; the facts survive every level — which world, which
path, what a button will do, and what an error actually was read the same at
level 1 and level 5. School mode needs no special handling here: this
feature exposes no Cantonese, bilingual, humour or personal-vocabulary
capability of its own beyond the shared translator, so there is nothing for
it to omit.

## Gotchas and limitations

- Worldlens's desktop application genuinely cannot be told which world to
  open from outside itself — this is a limitation of Worldlens, not a
  missing feature here. The clipboard-and-paste handoff is the honest
  version of "open this world," not a workaround pending a fix.
- The headless renderer only ever produces the in-app map when its path is
  set; the desktop application and the headless renderer are two separate
  detections and one can be present without the other.
- A world's version is read from `level.dat`'s `Version.Name`, which some
  very old or hand-edited saves may not carry; those are reported as
  "unknown," never guessed at from the folder name.

## Suggested related articles

- `docs/features/map.md` — the built-in overview-tile viewer that imports
  this feature's `endpoint.ts` to offer a Worldlens render as an additional
  source, without either feature reaching into the other's directory.
- [`world-download.md`](world-download.md) — where the worlds this feature
  scans actually come from.
- [`export.md`](export.md) — the shared export contract the world list is
  written through.
- [`history.md`](history.md) — where every render start, finish, cancel and
  handoff is recorded.
- [`settings.md`](settings.md) — the settings surface this feature's section
  renders through.
