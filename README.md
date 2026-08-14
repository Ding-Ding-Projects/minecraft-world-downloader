# minecraft-world-downloader
A Minecraft world downloader that works as a proxy server between the client and the server to read & save chunk data. Download multiplayer worlds by connecting to them and walking around. Chunks can be sent back to the client to extend the render distance.

> **This fork adds:** support for **every version from 1.8 through 26.1**, a fix for the 1.20.2+
> *"Connection Lost — Loading NBT data"* error, and a **Dockerized web console** for running and managing
> the downloader from your browser (Microsoft / access-token / offline account login, live logs, and
> world export).

## 🚀 Mega update — automation & container capture

This release adds opt-in automation features and fixes several long-standing bugs in the
container-capture path. **Everything below was verified end-to-end** with a real Paper server driven by
a [mineflayer](https://github.com/PrismarineJS/mineflayer) bot through the proxy — the full matrix
(**1.12.2, 1.20.4, 1.21.8, 1.21.11**) passed **3/3 runs each**: world download → auto-open + saving of
every container type → chat auto-reply. The downloaded worlds were then **re-opened in a fresh server**
and a bot read the chests back to confirm the items are correct **in-game**, not just in the NBT bytes.

### ✨ New features
- **🤖 Auto-open container sweep now actually works on modern servers.** As you move, the proxy opens
  nearby containers one at a time (rate-limited) and saves their contents — no manual clicking.
  Verified for **all block container types**: chest, trapped chest, barrel, furnace, blast furnace,
  smoker, hopper, dropper, dispenser, brewing stand, shulker boxes, **and crafters** (1.21+).
  Enable with `--auto-open-containers`.
- **🛒 Container minecarts** (chest / hopper minecarts) are auto-opened too. They're entities, so their
  captured contents are written into the saved chunk's entity NBT (verified by reading the minecart's
  items back out of the saved region).
- **📝 Auto-open item log.** Every auto-opened container is appended to a human-readable
  `auto-open-items.log` (beside the world folder) listing the type, coordinates and items, e.g.
  `minecraft:overworld chest @ 12 -60 5 (3 stacks, 81 items)` → `minecraft:diamond x12`. Customize the
  path with `--auto-open-log`.
- **💬 Chat auto-reply.** When an incoming chat message's trigger-coloured text matches a configured
  trigger, the proxy replies with that message's reply-coloured text. Colours default to **yellow →
  red** but are configurable (`--auto-reply-trigger-color` / `--auto-reply-color`) so any colour
  combination works. Works on legacy (pre-1.19) and modern (signed-chat) protocols. Enable with
  `--auto-reply --auto-reply-trigger "<text>"`.
- **🛡️ Player-aware chest safety (on by default).** The sweep will **not** open a chest / trapped chest
  / barrel / shulker box while another player is within `--auto-open-player-radius` (default 100). All
  other container types still open. Pass `--auto-open-allow-chest-near-players` to disable the check.

### 🐛 Fixes
- **Saved containers looked empty in 1.20.5+ Minecraft**: the item NBT stack size moved from `Count`
  (byte) to `count` (int) in 1.20.5, but the downloader still wrote `Count`, so the client read a
  default of 1 for every stack. Now writes the correct format per version — confirmed by loading the
  downloaded world in a real server and reading the exact chest contents back.
- **1.21.5+ world download was broken** (chunks failed to parse → 0 chunks saved): 1.21.5 removed the
  per-array "data length" varint from paletted containers; the long count is now derived from
  bits-per-entry. Verified downloading + saving on 1.21.8 and 1.21.11.
- **Auto-open kicked you on 1.21.3+**: the serverbound *Use Item On* packet gained a `worldBorderHit`
  boolean that the injected open omitted ("Failed to decode use_item_on"). Now written/parsed on 1.21.3+.
- **Auto-open never worked on 1.14+**: the injected open used the pre-1.14 block-position bit layout, so
  modern servers silently ignored it. Now version-correct (`x<<38 | z<<12 | y` on 1.14+).
- **1.14–1.18 auto-open** wrote a stray block-change sequence field (a 1.19+ addition), corrupting the
  packet. Now gated to 1.19+.
- **1.12.2 item names never resolved** (the bundled `items-1.12.2.json` was parsed into the wrong
  shape), so saved chests had broken item ids. Fixed — and metadata variants (e.g. red wool) are now
  distinguished in the log.
- **1.12.2 auto-open** now uses the correct pre-1.14 *Player Block Placement* packet layout.

### 🔌 Also ported from [TheHecateII's fork](https://github.com/TheHecateII/minecraft-world-downloader)
- **Player skin-heads on the map** — other players render as their Minecraft head (face + hat) instead
  of a dot, with a memory + disk skin cache and async Mojang fetch (gated by `--render-players`).
- **Modded block colours** — non-`minecraft:` blocks are coloured on the map from their mod-JAR
  texture (in `.minecraft/mods`), falling back to a deterministic per-name colour (`--modded-block-colors`).
- **Voice-chat UDP proxy** — `--enable-voice-proxy` transparently relays Simple Voice Chat / PlasmoVoice
  so voice works through the downloader (auto-detects the voice port from plugin-channel packets).
- **Modded/1.21 hardening** — clientbound `CustomPayload` mapped for 1.20.6/1.21 (Forge/NeoForge plugin
  channels), plus null-safety fixes so unknown/modded block, item and entity ids no longer crash chunk
  parsing or NBT writing.

### 🗺️ Mapping & automation
- **Live map in the web console** — the overview map now renders **headless** (no GUI) into PNG region
  tiles and is shown as a pannable/zoomable map in the browser, with a live player marker and a
  surface/caves toggle. On by default in `--no-gui` mode; see [`bluemap/`](bluemap) for the 3D map.
- **BlueMap 3D map pipeline** ([`bluemap/pipeline.py`](bluemap/pipeline.py)) — upgrade a downloaded
  world with a temporary server jar (`--forceUpgrade`, auto-stopped), then render an interactive 3D web
  map with [BlueMap](https://github.com/BlueMap-Minecraft/BlueMap). Run standalone, via the
  `bluemap` docker-compose profile, or from the desktop manager.
- **Mineflayer auto-scraper** ([`scraper/`](scraper)) — bots that walk/fly a grid through the proxy to
  capture a whole area automatically: Microsoft or offline login, gamemode-aware movement
  (creative/spectator fly, survival/adventure walk via pathfinder), multi-bot, AuthMe auto-login,
  anti-stuck, a center-out spiral so it covers near you first, and a visited-chunk cache so re-runs skip
  downloaded chunks. **Launchable from both the web console and the desktop manager** (the Microsoft
  device-code sign-in is shown right in the web UI).
- **Smoother extended render distance** — re-sent chunks are delivered at a steady, nearest-first pace
  (`--extended-render-pace`, default 6 ms) instead of in bursts, so the extended area fills in without
  the choppy pop-in.
- **Accessibility & themes** — the web console has a ♿ menu (dark / light / high-contrast themes,
  ADHD-focus / calm / easy-reading / low-vision presets, reduced motion, dyslexia font, text scaling,
  skip links, keyboard focus); the desktop manager adds persisted M3 tabs, English/Cantonese/bilingual
  copy with independent funny levels, font controls, searchable settings with a safe .NET regex builder,
  reviewable notifications, external-editor launch, and an optional bundled 1% dim-sum startup delight.

### ✅ Verified versions
End-to-end (Paper server + mineflayer bot through the proxy), **3/3 runs each** on **1.12.2, 1.20.4,
1.21.8, 1.21.11**: world download, auto-open + saving of every container type, and chat auto-reply.
The headless live map, the scraper (survival/adventure/creative, dedup, no-stuck over 5000×5000), the
server-jar upgrade and the BlueMap render are each verified end-to-end as well.
The player-aware chest safety has its own two-bot test, and minecart capture + the in-game load-back
(re-open the downloaded world in a server and read the chests with a bot) are verified too.

### ⚠️ Known limitations
- **26.1.2** cannot be exercised by a bot yet — mineflayer/minecraft-data have no 26.x protocol data
  (`unsupported protocol version: 26.1.2`). The proxy's 26.1 mapping reuses the verified 1.21.5+ chunk
  and signed-chat paths, so the same code is covered by the 1.21.8/1.21.11 tests.
- On 1.12.2, **furnaces and brewing stands** aren't auto-opened (their block state resolves to a null
  name in the bundled 1.12 block registry).

### 📖 Documentation
Full guides are in [**`docs/wiki/`**](docs/wiki) (also published to the project
[wiki](https://github.com/cafepromenade/minecraft-world-downloader/wiki)):
[Installation](docs/wiki/Installation.md) ·
[Docker & web console](docs/wiki/Docker-Web-Console.md) ·
[Authentication](docs/wiki/Authentication.md) ·
[Supported versions](docs/wiki/Supported-Versions.md) ·
[Command-line options](docs/wiki/Command-Line-Options.md) ·
[Building from source](docs/wiki/Building-From-Source.md) ·
[FAQ](docs/wiki/FAQ.md)

**Contributors / maintainers / agents:** see [**`HANDOFF.md`**](HANDOFF.md) (project state, architecture,
open items), [**`AGENTS.md`**](AGENTS.md) (build/test/run + conventions), and
[**`docs/features/`**](docs/features/README.md) — a per-feature handoff index with one detailed document
per feature. Third-party credits and dependency links are in [**`CREDITS.md`**](CREDITS.md).

### Downloads  <a href="https://github.com/cafepromenade/minecraft-world-downloader/releases/latest"><img align="right" src="https://img.shields.io/github/downloads/cafepromenade/minecraft-world-downloader/total.svg"></a>
Windows desktop manager (installer): [WorldDownloaderManager-Setup.exe](https://github.com/cafepromenade/minecraft-world-downloader/releases/latest/download/WorldDownloaderManager-Setup.exe)

Latest cross-platform jar (command-line support): [world-downloader.jar](https://github.com/cafepromenade/minecraft-world-downloader/releases/latest/download/world-downloader.jar)

**Sample downloaded worlds** (for 1.20.4 / 1.21.8 / 1.21.11 / 1.12.2, plus a BlueMap render) are
published on the [`test-worlds`](https://github.com/cafepromenade/minecraft-world-downloader/releases/tag/test-worlds)
release — produced end-to-end through the dockerized downloader. See
[`docs/testing/goal-3pass-report.md`](docs/testing/goal-3pass-report.md) for the full 3-pass Docker
feature test (all features + combinations, world load-back, BlueMap, upgrade-playability).

### The desktop app opens straight into the world downloader

The world downloader is the default, permanent, top destination — not one tile among many. On a
fresh install the desktop app opens quiet: the world downloader active, and the other 35 features
tucked away behind five collapsible groups (**Bot control**, **Tools**, **Personalisation**,
**Records**, **Security**) that start collapsed, so the tab strip doesn't greet you with a wall of
tabs.

<img src="docs/images/captures/00-main-window.png" width="80%" alt="World Downloader Studio's default view on a fresh profile: the World downloader tab active, the sidebar showing only the top-level destinations with all five feature groups collapsed, and a first-launch tip about the humour-level setting anchored bottom-left.">

Expand any group and nothing is missing — all 35 features are exactly where their group says:

<img src="docs/images/captures/20-tab-groups-expanded.png" width="30%" alt="The tab strip with all five groups expanded, showing every one of the 35 grouped features: Bot control (Bot chat, Pattern rules, Server text, Bots, Bot events, The world, Bot movement, Inventory, Containers, Crafting, Workstations, Villager trading), Tools (Authenticator, Verification, Convert some files, Downloads, Format catalog, PDF toolbox, External editor, App updates, Local models, Model store, Model chat, Harness profiles), Personalisation (Appearance, Language, School mode, Narrator, Schedule, Application logo, Personal vocabulary, About this application), Records (Documentation, Export, Version history, Protected mutation log, Status, Changelog), and the start of Security (Locks, Support Tickets).">

A status bar now runs along the bottom of the window with live session state — which destination
is showing, what's running in the background, and how long the app has been up:

<img src="docs/images/captures/21-status-bar.png" width="70%" alt="Close-up of the status bar along the bottom of the window: Viewing: World downloader, No background processes running, Chunks saved: not counted yet, and Up 49m 09s on the right.">

The top toolbar is compact icon buttons instead of padded hero cards — command palette, notifications,
settings, and the frameless window's own minimize/maximize/close controls:

<img src="docs/images/captures/22-toolbar-closeup.png" width="50%" alt="Close-up of the top toolbar's compact icon buttons: a search icon that opens the command palette (Ctrl+Shift+F), a notifications bell, a settings gear, and the minimize, maximize and close window controls.">

### Basic usage
[Download](https://github.com/cafepromenade/minecraft-world-downloader/releases/latest/download/WorldDownloaderManager-Setup.exe) the Windows desktop application and run it. Enter the server address in the address field and press start.

<img src="docs/images/captures/readme-console-start.png" width="80%" alt="The Console tab of World Downloader Studio: a Service card with Not configured status and a Start it up button, above a Configuration card with a search field.">

Instead of connecting to the server itself, connect to `localhost` in Minecraft to start downloading the world.
<img src="docs/images/captures/readme-console-connection.png" width="80%" alt="The Console tab's Connection card, showing the Server address and Proxy port (host) fields with the explanatory text describing which port your Minecraft client should connect to.">

If you run into any problems, check the [FAQ](https://github.com/cafepromenade/minecraft-world-downloader/wiki/FAQ) page for some common issues. 

### [Features](https://github.com/cafepromenade/minecraft-world-downloader/wiki/Features)
- Requires no client modifications and as such works with every game client, vanilla or not
- Automatically merge into previous downloads or existing worlds
- Save chests and other inventories by opening them
- Extend the client's render distance by sending chunks downloaded previously back to the client
- Overview map of chunks that have been saved:

<img src="docs/images/captures/readme-live-map.png" width="80%" alt="The Live map tab of World Downloader Studio, showing its marker/grid/crosshair toggles and position panel. This capture was taken with no world downloaded yet in this environment, so the map canvas itself is empty; once chunks are saved they render here as an explorable, pannable/zoomable overview.">

### World vault: version control, renders and chunk editing

A downloaded world can also become a real, local Git repository. **World vault** watches the
folder while it settles and commits automatically, keeps an unlimited, undoable commit timeline,
and only ever leaves the machine through an explicit, two-key **publish** gate — nothing pushes
on a timer or as a side effect of anything else.

<img src="docs/images/captures/23-world-vault.png" width="80%" alt="The World vault tab: the status card showing 2 commits, the branch, last commit and on-disk size, plus Stop watching / Commit now / Compact history actions, and the commit timeline table below listing both real commits with their kind, files-changed and bytes-changed columns.">

Publishing shows exactly what is about to leave the machine — size, file count and destination —
behind the same two-key, slide-to-confirm gate every other destructive action in the app uses:

<img src="docs/images/captures/24-world-vault-publish-confirm.png" width="80%" alt="The publish confirmation gate open over the World vault tab: the title reads 'This one is permanent: Push the vault (29.4 KB, 4 files) to https://github.com/example/scratch-vault-demo.git', with a What this affects list, a What cannot be undone paragraph, two independent First key / Second key controls, a disabled confirmation slider, and Emergency exit / Cancel actions.">

**Renders** can turn any commit into a rendered map, queued and tracked with real per-row status —
and it is honest when nothing has been rendered yet rather than inventing a placeholder:

<img src="docs/images/captures/25-world-vault-renders-queue.png" width="80%" alt="The Renders tab in its honest empty state: 'Nothing rendered yet. Turn it on in settings, or start one for a commit below.' shown both as a page-level banner and as the render queue table's own empty row, with a commit picker and a disabled Render this commit button beneath it.">

Two commits can be compared directly — which region files changed, and by how much:

<img src="docs/images/captures/26-world-vault-renders-compare.png" width="80%" alt="The Renders tab's Compare two commits card with two different real commits chosen (Created the vault: initial snapshot on the left, Captured a manual snapshot on the right) and the real result 'No region files differ between these two commits.' beneath the Compare button, plus the Slider/Toggle/Side-by-side visual-comparison mode and the exported-snapshots folder card.">

**Chunk operations** reads real region-file occupancy into a clickable grid, so a chunk — or a
whole rectangle of them — can be copied to a new location or removed outright, with every edit
recorded both in the vault's own commit history and in this feature's own edit log:

<img src="docs/images/captures/27-world-vault-edit-chunk-grid.png" width="80%" alt="The Chunk operations tab: part of the 16x16 chunk grid with a 3x3 rectangle selection highlighted in purple, the Selection card reading '9 chunks selected, from (3, 2) to (5, 4)' with destination-X/Z fields and enabled Copy to destination / Remove selected chunks buttons, the tab-group sidebar expanded, and the Edit log's honest 'No edits recorded yet' empty state below.">

Finally, **the end-to-end test harness** — the same one this README's verified-versions table is
built from — has its own destination: launch a real Paper server, drive real bots through the
downloader proxy, and verify the saved world by reading region files back:

<img src="docs/images/captures/28-downloader-e2e.png" width="80%" alt="The End-to-end test tab: a Launch a run card with version, server-route, walk-radius, bot-count and pass-threshold controls and a Start the end-to-end run button, and a Current run card reading 'Nothing running — start one above.' — its honest idle state, since no harness is configured in this capture environment.">

<details>
<summary><strong>Capture method, commit, and defects fixed along the way</strong></summary>

These six images are real screenshots of the packaged desktop application (`npm run build`, then
`npx electron-builder --win --dir --config electron-builder.yml`, both exit `0`), launched on an
off-screen Windows desktop and driven over the Chrome DevTools Protocol — the same method as every
other capture in this README. The feature set was introduced at commit
[`e9ace7b`](https://github.com/cafepromenade/minecraft-world-downloader/commit/e9ace7be983a176fa317b75482f83f32f059d6ee)
("Version-control the downloaded world, render it, and edit chunks from the map"); this capture
session's own working tree sits on top of that at
[`72adf02`](https://github.com/cafepromenade/minecraft-world-downloader/commit/72adf0293243312530d1fcb7d586f48068a72b00).

No world had actually been downloaded in this environment, so a real, throwaway folder outside the
repository stood in for one — World vault doesn't know or care that it isn't Minecraft data, which
is exactly why the vault, commit, and chunk-grid captures could be genuine rather than mocked. Two
real commits were made to it (a create and a manual snapshot) so the commit timeline, the publish
gate's size/file-count numbers, and the commit-comparison picker all show real, non-fabricated
values. The renders queue and the end-to-end harness captures are shown in their honest not-yet-used
states: no render is enabled in settings, and no harness script is configured in this environment,
so "Nothing rendered yet" and "Nothing running — start one above" are what the real application
actually says. **Every navigation for this pass — including expanding the collapsed "Tools" group
to reach the End-to-end test tab — was driven through the real, visible interface** (a genuine
click on the group's expand header, confirmed by checking the tab button's `offsetParent` before
clicking it), never by mutating state directly. The single-visible-heading assertion from `c8ff5c0`
was re-checked after every navigation and held throughout; no muddled multi-pane screen was ever a
candidate for a capture.

**Four real defects were found and fixed by driving the built application, not by its test suite:**

- **The vault could never actually be created.** `git status --porcelain --cached` is not a valid
  git invocation — `--cached` is not a `git status` option — so every one of the five call sites
  that used it (create, commit-now, the background settle-runner, restore, and prune) failed at the
  first hurdle. The feature was not degraded, it was inert: no repository was ever created and the
  advertised unlimited undo had nothing to undo. Fixed by switching to `git diff --cached
  --name-only`, the actual way to ask what is staged.
- **The publish button could get stuck disabled after typing a remote URL.** Its enabled state was
  computed once, when the async preflight resolved — usually before the user had finished typing —
  and never recomputed afterward, so a URL typed a moment too late left "Set the remote and push"
  permanently unusable. Fixed by recomputing on every keystroke as well as when the preflight
  resolves.
- **The publish gate's own safety copy could show literal `{size}`/`{files}` tokens instead of real
  numbers**, because the higher funny-level variants of the risk paragraph and the confirmation
  dialog's title carry those placeholders but the call sites never supplied the values — visible
  directly in the screenshot this feature exists to make trustworthy. Fixed by threading the real
  size and file count through both call sites.
- **Every render and every commit comparison failed before it started.** The renders feature builds
  its export/output directories by joining a commit's `vaultId` — which is the vault's own absolute
  world path — in as a path *segment*. On Windows that is not a nested directory, it is an illegal
  one: an absolute path carries its own drive-letter colon, and a colon is not valid anywhere in a
  Windows path component except right after the drive letter. Fixed with a `vaultDirName()`
  sanitizer that turns the raw path into one safe, stable, collision-resistant segment.

The git-status fix above was independently found and committed by a concurrent pass during this
same session (visible as its own commit in the history); the other three ship as part of this
capture session's own working tree. None of the four were reachable without genuinely exercising
the built application end to end — the project's unit suite covers the pure settle-detection and
region-access-race logic and never once calls a real `git` binary or a real filesystem path.

</details>

<details>
<summary><strong>More screenshots</strong> — every destination: Overview, World downloader, supported versions, appearance, command palette, bots, local models, console, live map, Worldlens, containers, changelog, settings, version history, notifications, destructive gate, both themes, narrow layout, error state, empty state</summary>

Real captures of the built application (`app/`), taken at the commit this README documents. No mockups, no design files.

| | |
|---|---|
| ![Overview page listing the build's version, Electron/Chromium/Node versions, the 36 installed feature modules, and the bundled documentation count.](docs/images/captures/readme-overview.png) | ![The World downloader tab: Java runtime detection, the jar picker, session status, and the generated command line.](docs/images/captures/readme-world-downloader.png) |
| Overview — build info, installed modules, docs | World downloader — Java/jar setup, session, command line |
| ![The World downloader tab scrolled to the searchable Supported game versions table listing protocol and data versions from 1.8 through 26.x.](docs/images/captures/readme-supported-versions.png) | ![The Appearance tab showing Material Design 3 colour tokens (primary, secondary, tertiary, surface, outline, etc.) with their hex values, plus colour scheme, accent colour, contrast and density controls.](docs/images/captures/readme-appearance.png) |
| World downloader — supported versions table | Appearance — M3 colour tokens and theme controls |
| ![The command palette open over the Overview page, searching every command, setting and destination; the result count reads 1325 of 1325 shown.](docs/images/captures/readme-command-palette.png) | ![The Bots tab: start-runtime control, a searchable list of saved profiles and live bots, and New profile / Quick connect / Delete / Export actions, in its honest empty state.](docs/images/captures/05-mineflayer-bots.png) |
| Command palette — `Ctrl+Shift+F`, searches everything | Bots — mineflayer profiles and live connections |
| ![The command palette filtered to "Local models", listing matching settings destinations such as Model runtime address, Request timeout, and Catalog source.](docs/images/captures/16-settings-search.png) | ![The Local model runtime tab: a live Ollama runtime answering at 127.0.0.1:11434 and two installed models (gemma4, qwen3.6) with size, parameters, quantization and hardware-fit columns.](docs/images/captures/06-models.png) |
| Command palette — filtered results stay live controls | Local models — a real, running Ollama detected |
| ![The Console tab's live Connection card, showing Server address, Proxy port and a Disable SRV lookup toggle with explanatory text.](docs/images/captures/readme-console-connection.png) | ![The Live map tab: no world folder chosen yet, with the Layers panel (render mode, follow player, markers, region grid) and Position panel on the right.](docs/images/captures/readme-live-map.png) |
| Console — connection settings, scrolled | Live map — tile viewer, layers, position |
| ![The Worldlens destination: the detected Worldlens desktop application, its headless renderer status, and the downloaded-worlds picker.](docs/images/captures/03-worldlens.png) | ![The Containers tab mid-check: "Checking whether Docker is here", running `docker version` to find the daemon, with the state filters and bulk-action row beneath it.](docs/images/captures/02-server.png) |
| Worldlens — the companion renderer app | Containers — Docker container management |
| ![The Console tab's own panel: Service status Not configured with net::ERR_CONNECTION_REFUSED, and the Configuration section with its search field.](docs/images/captures/04-console.png) | ![The Changelog viewer: 142 versions and 1323 commits, category filters (Added, Changed, Fixed, Security, …), a release date-range picker, and the Unreleased entry with its commit hash.](docs/images/captures/08-changelog.png) |
| Console — service status and configuration | Changelog — every release, linked to its commit |
| ![The Settings surface: language, per-language humour-level sliders, and the nested settings-tab list including a still-unfixed literal `{name}` label.](docs/images/captures/09-settings.png) | ![The Version history panel: a local Git-backed log of real settings changes from this capture session, with action-type filter chips and a date-range picker.](docs/images/captures/10-history.png) |
| Settings — language, humour levels, categories | Version history — local, Git-backed, filterable |
| ![The Notifications centre: severity and source filters, an All / Still showing / Dismissed toggle, and session statistics for the nine real warnings raised this session.](docs/images/captures/11-notifications.png) | ![The Appearance Studio's Theme tab: colour-role swatches with hex values, and the Light / Dark / Follow the system segmented control.](docs/images/captures/12-appearance-studio.png) |
| Notification centre — filters and statistics | Appearance editor — theme tokens and controls |
| ![The destructive-confirmation gate for "Reset every setting": the affected-keys list, the irreversible-action sentence, two independent keys, and the confirmation slider, anchored beside the button that opened it.](docs/images/captures/17-destructive-gate.png) | ![The World downloader tab rendered in the light colour scheme.](docs/images/captures/13-theme-light.png) |
| Destructive-action super-confirmation gate | Light theme |
| ![The same World downloader tab rendered in the dark colour scheme.](docs/images/captures/14-theme-dark.png) | ![The Overview page at a 400×900 viewport: the tab strip has collapsed to icons only and the info cards keep their own horizontal scroll.](docs/images/captures/15-narrow-layout.png) |
| Dark theme | Narrow layout — collapsed tab strip |
| ![A non-blocking error notification anchored bottom-left, raised through the application's real global error handler, with its message and a Dismiss action.](docs/images/captures/18-error-state.png) | ![The Authenticator destination with no accounts registered: "Nothing in here yet — there is no sample data: an empty list means the list really is empty," beside a disabled bulk-action row.](docs/images/captures/19-empty-state.png) |
| Error state — real error-handling path, not a mock | Authenticator — a second honest empty state |

</details>

<details>
<summary><strong>Capture method and commit</strong></summary>

Every image above is a real screenshot of the packaged desktop application
(`npm run build && npx electron-builder --win --dir --config electron-builder.yml`, both exit `0`),
launched on an off-screen Windows desktop and driven over the Chrome DevTools Protocol — no mockups, no
design-system pages, no hand-edited pixels. The build was made from commit
[`f0d1e71`](https://github.com/cafepromenade/minecraft-world-downloader/commit/f0d1e71c6a553ed3975c4098d6cb7c1a610ff179),
the tip of `main` at capture time, working tree clean.

The full 35-feature, five-group tab strip was reached by clicking every group's expand chevron and
capturing the sidebar at an emulated 3300px-tall viewport so nothing had to be cropped out; the default
fresh-profile hero shot (`00-main-window.png`) came from a genuinely empty profile — the real
`%APPDATA%\world-downloader-studio` directory was moved aside, the app was launched cold, and the
directory was moved back afterward once every capture was done, so no throwaway profile data was left
behind.

**A real, reproducible tab-switching bug was found while driving the app for these captures.** Clicking
through the sidebar in a live session can leave a *previous* destination's content pane still mounted and
visible (`offsetParent !== null`) underneath or alongside the newly selected one — observed with three
different destinations simultaneously rendered as "visible" at once — even though the sidebar highlight
and the status bar's "Viewing: …" label both update correctly to the new destination. A full page reload
after navigating reliably shows the single correct panel, which is the workaround this capture pass used
throughout (click, wait, reload, verify the exactly-one visible heading, then screenshot) rather than
trusting an in-session click alone. This was not fixed here — this is the captures lane, not the
navigation-router lane — but it is real, it reproduces on demand, and it is worth a follow-up fix; a user
clicking quickly between tabs could genuinely see stale content.

One small existing UI defect also surfaced incidentally, unrelated to the capture work itself: one settings
row in the desktop app's own Settings surface still renders the literal `{name}` as both its label and its
description instead of the school-mode display-name copy (visible in the nested settings-tab list in
`09-settings.png`). The previously-noted `changelog.subtitle` literal-key defect has since been fixed — the
Changelog destination now shows real copy in the command-palette results. Neither item was touched here.

</details>

### Documentation site
The [documentation site](https://ding-ding-projects.github.io/minecraft-world-downloader/) (`site/`
in this repository) is a separate, self-contained Material Design 3 web app: seven pages, no
framework, no CDN, no network request. It carries its own responsive contract — checked at 320,
360, 390 and 768&nbsp;px — and its header was recently rebuilt because, below 899&nbsp;px, the old
seven-link text navigation no longer fit beside the brand and the action icons on one row: it
collapsed into a column that grew to **580&nbsp;px tall** and clipped the page title
("Documentation") right off the edge. The fix folds that navigation behind one menu button and
folds the action icons behind a second, bringing the same header down to **57&nbsp;px**.

<img src="docs/images/site/phone-360-docs-01-header.png" width="30%" alt="The documentation site's Documentation page at 360px wide: a slim, single-row header — brand mark, a shortened title, a menu button, a search button and a more-actions button — with the full page title readable beneath it."> <img src="docs/images/site/phone-360-docs-02-nav-open.png" width="30%" alt="The same page with the site-navigation menu open: a filterable, keyboard-operable list of all seven pages (Home, Documentation, Downloads, Converter, Local models, Changelog, Settings), with Documentation checked as the current page."> <img src="docs/images/site/phone-360-docs-03-overflow-open.png" width="30%" alt="The same page with the action-overflow \"More\" menu open, listing the icon actions that no longer fit in the header row: Language, Theme, Notifications, Command palette, More actions.">

<img src="docs/images/site/desktop-1440-docs.png" width="90%" alt="The Documentation page at 1440px wide: the full seven-link text navigation and every action icon fit directly in the header, so neither the menu button nor the overflow button render at this width.">

<details>
<summary><strong>Every page, phone and desktop</strong> — index, docs, settings, downloads, changelog, converter, models</summary>

| Phone (360px) — header | Phone (360px) — nav menu | Phone (360px) — action overflow | Desktop (1440px) |
|---|---|---|---|
| ![The landing page at 360px: brand mark, shortened title, and (since the landing page has always had its own compact action set rather than the shared site-nav toggle) search, notifications, theme and more-actions icons directly in the header row.](docs/images/site/phone-360-index-01-header.png) | *(no separate nav toggle — see the More actions menu)* | ![The landing page's own "More actions" menu open, listing Documentation, Downloads, Converter, Local models, Changelog, Local history, Locks, Authenticator, Support Tickets, Command palette and both Settings destinations — 12 of 12 shown.](docs/images/site/phone-360-index-03-overflow-open.png) | ![The landing page at 1440px: hero, download card and feature tab host, with the search bar and its results panel in the header.](docs/images/site/desktop-1440-index.png) |
| ![The Documentation page's collapsed 57px header at 360px.](docs/images/site/phone-360-docs-01-header.png) | ![The Documentation page's site-navigation menu open, 7 of 7 links shown.](docs/images/site/phone-360-docs-02-nav-open.png) | ![The Documentation page's action-overflow menu open, 5 of 5 actions shown.](docs/images/site/phone-360-docs-03-overflow-open.png) | ![The Documentation page at 1440px, full nav strip and article reader visible.](docs/images/site/desktop-1440-docs.png) |
| ![The Settings page's collapsed header at 360px.](docs/images/site/phone-360-settings-01-header.png) | ![The Settings page's site-navigation menu open.](docs/images/site/phone-360-settings-02-nav-open.png) | ![The Settings page's action-overflow menu open.](docs/images/site/phone-360-settings-03-overflow-open.png) | ![The Settings page at 1440px.](docs/images/site/desktop-1440-settings.png) |
| ![The Downloads page's collapsed header at 360px.](docs/images/site/phone-360-downloads-01-header.png) | ![The Downloads page's site-navigation menu open.](docs/images/site/phone-360-downloads-02-nav-open.png) | ![The Downloads page's action-overflow menu open.](docs/images/site/phone-360-downloads-03-overflow-open.png) | ![The Downloads page at 1440px.](docs/images/site/desktop-1440-downloads.png) |
| ![The Changelog page's collapsed header at 360px.](docs/images/site/phone-360-changelog-01-header.png) | ![The Changelog page's site-navigation menu open.](docs/images/site/phone-360-changelog-02-nav-open.png) | ![The Changelog page's action-overflow menu open.](docs/images/site/phone-360-changelog-03-overflow-open.png) | ![The Changelog page at 1440px.](docs/images/site/desktop-1440-changelog.png) |
| ![The Converter page's collapsed header at 360px.](docs/images/site/phone-360-converter-01-header.png) | ![The Converter page's site-navigation menu open.](docs/images/site/phone-360-converter-02-nav-open.png) | ![The Converter page's action-overflow menu open.](docs/images/site/phone-360-converter-03-overflow-open.png) | ![The Converter page at 1440px.](docs/images/site/desktop-1440-converter.png) |
| ![The Local models page's collapsed header at 360px.](docs/images/site/phone-360-models-01-header.png) | ![The Local models page's site-navigation menu open.](docs/images/site/phone-360-models-02-nav-open.png) | ![The Local models page's action-overflow menu open.](docs/images/site/phone-360-models-03-overflow-open.png) | ![The Local models page at 1440px.](docs/images/site/desktop-1440-models.png) |

</details>

<details>
<summary><strong>Mobile contract, measured before and after</strong> — horizontal overflow and touch-target size</summary>

Horizontal page overflow at 320 / 360 / 390 / 768&nbsp;px stayed at **0px on every page at every
width**, both before this header fix and after it — the header rebuild did not introduce any
sideways scroll, and none existed beforehand either.

Interactive elements smaller than the 44×44px touch minimum, measured at 360px, dropped sharply
once the collapsed header stopped squeezing the row beside it:

| Page | Before | After | What is left |
|---|---:|---:|---|
| index.html | 16 | **0** | — |
| docs.html | 18 | **1** | One `Home` breadcrumb link at 40×44px (2px short on width only) |
| settings.html | 23 | **1** | Same `Home` breadcrumb link |
| downloads.html | 22 | **1** | Same `Home` breadcrumb link |
| changelog.html | 51 | **27** | Inline commit-hash and tag links in the changelog body text, each ~36px tall; a real remaining gap, not fixed by the header change and not in scope for this capture pass |
| converter.html | *(not previously measured)* | 2 | The `Home` breadcrumb link, plus one intentionally `visually-hidden` 1×1px native file input (the real file button beside it is full-size — this is a false positive from measuring a deliberately invisible element) |
| models.html | *(not previously measured)* | 1 | Same `Home` breadcrumb link |

The remaining `Home` breadcrumb link and the changelog's commit-hash links were not touched by the
header fix and are real, reproducible gaps against the 44px touch-target rule — left here rather
than silently fixed as part of a captures-only pass.

</details>

<details>
<summary><strong>Capture method and commit</strong></summary>

Every image above is a real screenshot of the documentation site's own source (`site/`), served
locally with `python -m http.server` from commit
[`f0d1e71`](https://github.com/cafepromenade/minecraft-world-downloader/commit/f0d1e71c6a553ed3975c4098d6cb7c1a610ff179)
— the commit titled "Make the site usable on a phone: the header was eating the whole first
screen", the fix these captures exist to verify — and driven over the Chrome DevTools Protocol
from an Edge instance launched on an off-screen Windows desktop with an isolated profile (`--guest
--disable-sync --disable-extensions`, verified to expose exactly one page target before anything
was touched). Phone captures used `Emulation.setDeviceMetricsOverride` at 360×780 with touch
emulation enabled and a 2x device scale factor; desktop captures used 1440×900 with no device
scale. No mockups, no design-system pages, no hand-edited pixels.

The site-navigation menu was opened by clicking `.site-nav-toggle`; the action-overflow menu was
opened by clicking the folded `[data-overflow-more]` button (or, on the landing page, its own
always-present "More actions" button — the landing page never ships a `.site-nav-toggle` at all,
by design, per the comments in `site/assets/site.js`). Each menu was closed between captures by
dispatching a `pointerdown` on the overlay's own backdrop element, matching exactly how the site's
overlay system defines "click outside" — a plain `Escape` `KeyboardEvent` dispatched from outside
the page does not reach the menu's own `keydown` listener, since that listener is bound to the menu
element itself rather than `document`.

</details>

### Requirements
- Java 21 or higher
- Minecraft version 1.8+ // 1.9+ // 1.10+ // 1.11+ // 1.12.2+ // 1.13.2+ // 1.14.1+ // 1.15.2+ // 1.16.2+ // 1.17+ // 1.18+ // 1.19.3+ // 1.20+ // 1.21+ // 26.1

### Command-line
[Download](https://github.com/cafepromenade/minecraft-world-downloader/releases/latest/download/world-downloader.jar) the cross-platform `world-downloader.jar` and run it using the command-line:

```
java -jar world-downloader.jar
```

Arguments can be specified to change the behaviour of the downloader. Running with `--help` shows all the available commands.
```
java -jar world-downloader.jar --help
```

The GUI can be disabled by including the `--no-gui` option, and specifying the server address:
```
java -jar world-downloader.jar --no-gui -s address.to.server.com
```

### Running on Linux
To easily download the latest release using the terminal, the following commands can be used:
```
wget https://github.com/cafepromenade/minecraft-world-downloader/releases/latest/download/world-downloader.jar
java -jar world-downloader.jar -s address.to.server.com
```

When running headless Java, the GUI should be disabled by including the GUI option:
```
java -jar world-downloader.jar -s address.to.server.com --no-gui
```

Some linux distributions may require `-Djdk.gtk.version=2` for the GUI to work:
```
java -Djdk.gtk.version=2 -jar world-downloader.jar
```

### Docker + web console
The project ships a `Dockerfile` and `docker-compose.yml` that run the downloader headless behind a
small **web management console** which mirrors every command-line option. See the
[Docker & web console](https://github.com/cafepromenade/minecraft-world-downloader/wiki/Docker-Web-Console)
wiki page for the full guide.

```
docker compose up -d --build
```

Then open **http://localhost:8080** — the console has **no login by default** (set `WEB_PASSWORD`
to gate it behind a username/password if you expose it beyond localhost). From the console you can:
- **sign in to your Minecraft account** three ways — **Microsoft** (device-code login: open the link,
  enter the code), **access token** (paste an existing token), or **offline** username,
- set every option (server address, ports, render distance, world output, center offset, and all the
  map/behaviour toggles) — the same flags as the command line,
- **start / stop / restart** the downloader,
- watch live logs and status,
- **save** all settings (persisted to the volume),
- **export the world** as `.zip` or `.tar.gz`, or snapshot the directory into `./data/exports`.

Point your Minecraft client at `localhost:25565` (the proxy port) to download a world. Worlds, the
registry cache, your account session and saved settings persist in the `./data` folder (mounted at `/data`).

| Port | Purpose |
| ---- | ------- |
| 8080 | Web management console |
| 25565 | Minecraft proxy — connect your client here |

Environment variables: `WEB_PORT`; `WEB_USERNAME` + `WEB_PASSWORD` (optional — set both to require a
console login; off by default); `SECRET_KEY` (auto-generated if unset, only used when login is enabled);
and `MS_CLIENT_ID` (Azure/Microsoft OAuth client id for Microsoft login; defaults to the public
Minecraft launcher client id).

### Desktop manager (Windows)
A small **WinUI 3** desktop app (`desktop/`) sets up and runs the Dockerized console for you: pick the
folder where worlds and data are stored, choose the ports and (optional) login, then **Start** — it
launches the container and opens the console in your browser. Download the **NSIS installer** from the
[releases](https://github.com/cafepromenade/minecraft-world-downloader/releases) page (built by the
`Desktop manager release` GitHub Actions workflow on each `v*` tag). It uses the image published to
`ghcr.io/cafepromenade/minecraft-world-downloader-web`. Requires [Docker Desktop](https://www.docker.com/products/docker-desktop/).

### Building from source

**One click, from a checkout with nothing installed.** `build.bat` at the repository root takes a
fresh Windows machine — no Node.js, no npm, no package manager, no SDK — obtains every dependency
itself, builds the desktop application, and then offers to run it. `build-installer.bat` does the
same and produces the Squirrel.Windows installer instead. Neither one asks you to go and install
something by hand, and neither needs administrator rights.

```
build.bat                 install every dependency, build, then offer to run it
build.bat /s              silent: no prompt, no pause, non-zero exit on first failure
build-installer.bat       build and package the installer, then verify the artifact
build-installer.bat /s    the same, silently
```

`./build.sh` and `./build-installer.sh` are the equivalents for a POSIX host, with the same flags
and the same phases. `SILENT=1` in the environment has the same effect as `/s` or `-s` everywhere.

<details>
  <summary>What the one-click scripts actually do</summary>

  Each script reports every phase as it runs — what it found already installed, what it installed
  and where, and how long each phase took — and a failure names the exact dependency, the version
  constraint, the source that was tried, and the blocking error rather than a bare "build failed".

  1. **Preflight** — repository, mode, host, and the source commit.
  2. **Node.js runtime** — reuses any Node.js ≥ 20.19.0 already on the machine. Otherwise a
     user-scoped `winget` install is tried first, and a portable runtime is extracted into
     `%LOCALAPPDATA%\world-downloader-studio\toolchain` if that is unavailable or refuses. The
     portable archive is verified against the official published SHA-256 before it is extracted.
     The current process's `PATH` is rebuilt from the registry after an install, because a package
     manager writes `PATH` for *future* shells and the very next command would otherwise still not
     find what was just installed.
  3. **npm** — the one that ships inside that Node.js distribution.
  4. **Application dependencies** — skipped when what is installed already matches `package.json`
     and `package-lock.json` (`scripts/deps-in-sync.mjs` decides, by comparing declared against
     resolved against installed, not by comparing modification times). Otherwise `npm ci`, falling
     back to `npm install` when the lockfile and manifest are out of step.
  5. **Electron runtime binary** — verified present, and extracted from the already-downloaded
     package cache when an install script left it missing.
  6. **Build** — `npm run build` (`electron-vite build`) for the application, or `npm run dist`
     (`electron-vite build && electron-builder --win squirrel`) for the installer. That is the same
     command the release workflow runs, on the same version.
  7. **Verify** — the build output for the application; for the installer, that the setup
     executable, the `RELEASES` index and the `.nupkg` all exist, that the setup is a plausible
     size, and its SHA-256, version and source commit.
  8. **Run** — the application script offers to launch it. This is the last thing it does, so a
     failed build never gets as far as offering to run nothing.

  Re-running is cheap and safe: each phase checks before it acts, and an interrupted download or
  extraction leaves nothing the next run cannot recover from.
</details>

### Downloading dependencies without building

`build.bat` and `build.sh` obtain everything they need automatically, so most people never need to
run anything else. **`download-dependencies.bat`** at the repository root is the narrower piece of
that: it *only* fetches and verifies the build toolchain — a JDK, Apache Maven and a Node.js
runtime — plus every dependency the root `pom.xml` declares, without building or running anything.
Use it to pre-warm a machine, in a CI cache-priming step, or to audit exactly what a build would put
on disk before ever running `build.bat`.

```
download-dependencies.bat      download everything, then pause
download-dependencies.bat /s   silent: no prompt, no pause, non-zero exit on first failure
```

`./download-dependencies.sh` is the POSIX equivalent, with the same flags. `SILENT=1` in the
environment has the same effect as `/s` or `-s`.

<details>
  <summary>What it does, and how it differs from build.bat</summary>

  1. **Node.js runtime, JDK and Apache Maven** — each a pinned, exact version verified against a
     SHA-256 or SHA-512 digest recorded in [`scripts/dependency-manifest.json`](scripts/dependency-manifest.json),
     which is committed beside the scripts so a human can audit exactly what a build places on their
     machine without running anything. A version already on the machine that satisfies the floor is
     reused and reported as `[present]`; otherwise the pinned build is downloaded, verified and
     extracted into the same per-user toolchain directory `build.bat` uses
     (`%LOCALAPPDATA%\world-downloader-studio\toolchain` / `~/.cache/world-downloader-studio/toolchain`),
     so the two scripts never install two different versions of the same thing.
  2. **Every Maven dependency `pom.xml` declares** — `mvn dependency:go-offline` pulls the full
     dependency and plugin tree (including the `jitpack.io`-hosted `jo-nbt` library) into the local
     `~/.m2` repository.
  3. **app/'s own bundled runtime dependencies** — delegated to `app/scripts/fetch-dependencies.mjs`
     once Node.js is available. That script is a separate concern: it obtains the runtime binaries
     that get bundled *inside* the packaged installer for end users (a Java runtime, a portable Git,
     the GitHub CLI), not the toolchain used to build the project.

  What it deliberately does **not** do: install `app/`'s own npm packages (`app/node_modules`) or
  build anything. Those remain `build.bat`'s job, so the two scripts never race installing into the
  same directory.

  Every binary is pinned and checksum-verified before extraction, every archive and every extracted
  toolchain lives entirely outside the repository (nothing here is ever committed, and nothing here
  uses Git LFS in any form), and a warm run re-verifies what is already on disk and skips rather than
  re-downloading. Administrator rights are never required.
</details>

<details>
  <summary>Code signing, and what the installer build will not do</summary>

  **Code signing is permanently out of scope for this project.** No script here requests, generates,
  discovers, stores or uses a certificate, signing key or timestamp credential, and no signer is
  ever invoked. `build-installer.bat` asserts that the setup executable it produced reports
  `NotSigned` and fails if anything managed to sign it, and it states in its own output that the
  artifact is unsigned — Windows will show an unknown-publisher or SmartScreen warning, which is
  expected and permanent. Nothing claims authenticity and no signature can be verified.

  `build-installer.bat` never publishes, tags, pushes or creates a release. Building an installer
  and shipping one are different actions with different authority, and a local build script has the
  first and not the second.
</details>

<details>
  <summary>Counting the project's lines</summary>

  `scripts/count-lines.mjs` prints the exact table each release publishes. Do not count by hand:
  an ad-hoc sweep costs far more and silently drops every file that matches no pattern.

  ```
  node scripts/count-lines.mjs                 plain text table
  node scripts/count-lines.mjs --markdown      release-notes table
  node scripts/count-lines.mjs --rev v1.2.3    count a specific revision
  ```

  It reads a single revision from the git object store rather than the working tree, breaks the
  count down by category and by language with both total and non-blank lines, separates generated
  files from hand-written ones, shows every excluded row (vendored source, dependency directories,
  build output, lockfiles, binaries) beside a project total and a grand total, and has a catch-all
  row so no file can escape being counted. Agent and human shares are attributed per **surviving**
  line with `git blame` — never by summing added lines from the log, because churn is not
  authorship. If its attribution total and its line total ever disagree it exits non-zero and says
  so, rather than publishing two numbers that do not add up.
</details>

<details>
  <summary>Dependencies on linux</summary>
  
  ### debian/ubuntu
  
  ```
  sudo apt-get install default-jdk maven
  ```

  ### arch/manjaro
  
  ```
  sudo pacman -S --needed jdk-openjdk maven
  ```
</details>

<details>
  <summary>Build project to executable jar file</summary>
  
 Building the project manually can be done using Maven:
  ```
  git clone https://github.com/cafepromenade/minecraft-world-downloader
  cd minecraft-world-downloader
  mvn package
  java -jar ./target/world-downloader.jar -s address.to.server.com
  ```

</details>

### Credits
This is a fork of [minecraft-world-downloader by Mirco Kroon](https://github.com/mircokroon/minecraft-world-downloader),
and incorporates fixes/features from the [TheHecateII](https://github.com/TheHecateII/minecraft-world-downloader),
[7byLoper](https://github.com/7byLoper/minecraft-world-downloader) and
[trichhoffson](https://github.com/trichhoffson/minecraft-world-downloader) forks. See
**[CREDITS.md](CREDITS.md)** for the full list of contributors, forks, and every third-party
dependency (each linked to its source repository).

### Contact
<details>
  <summary>Contact information</summary>

  For problems, bugs, feature requests and questions about how to use the application, please [open an issue](https://github.com/cafepromenade/minecraft-world-downloader/issues/new/choose) or discussion on GitHub. 

  For other inquiries, email: cafepromenade.github@gmail.com
  
  If you want to support this project, you can [donate through GitHub](https://github.com/sponsors/cafepromenade?frequency=one-time&amount=5)
</details>

