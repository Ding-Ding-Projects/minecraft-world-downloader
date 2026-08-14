# Project handoff

A factual handoff for `minecraft-world-downloader`. For build/test/coding conventions and the full
mirrored agent-instruction ruleset, see [`AGENTS.md`](AGENTS.md); for what "done" means feature-by-
feature across the unified app and its documentation site, see
[`FEATURE_INVENTORY.md`](FEATURE_INVENTORY.md); for where the unification effort stands milestone-by-
milestone, see [`ROADMAP.md`](ROADMAP.md). Per-feature docs live in
[`docs/features/`](docs/features/README.md).

This document has two parts. **Part A** is the unification effort — what changed, what state it's in,
what's verified and what isn't. **Part B** preserves the factual record of the legacy product (Java
proxy, web console, WPF desktop manager, scraper, BlueMap pipeline), which remains live in the tree
during migration and whose prior verification evidence is still accurate for those surfaces.

---

## Part A — The unification effort

### A.1 What changed

> **Reading order for whoever picks this up:** A.6 first (what is actually true right now), then A.7
> (what to do about it). A.1–A.5 describe the shape of the effort and change slowly; A.6 changes
> every session and is the section that has been wrong before.

The repository is being restructured from five separate surfaces (a Java Maven proxy, a Flask web
console, a WPF C# desktop manager, a Node chat-scraper, and a Python BlueMap pipeline, each with its
own build, its own UI conventions, and its own release path) into:

- **One Electron desktop application** at `app/`, built to full Material Design 3 conformance, that
  absorbs every surface's functionality behind one consistent interface.
- **One documentation website** at `site/`, carrying the same feature-completeness contract as the
  app rather than being a lighter-weight companion to it.
- **One GitHub Actions release workflow** that builds, packages, and publishes the desktop
  application — replacing the current six workflows.

`FEATURE_INVENTORY.md` was added as the hand-written, per-surface completeness contract that drives
this effort: roughly 90 feature rows across 14 categories, each row tracked independently for the app
and the site, with a status mark and a note per row. This handoff describes the state of the effort;
that inventory is the authoritative checklist.

### A.2 Repository layout after unification (current state)

| Path | Live? | Role |
| --- | --- | --- |
| `app/` | **Yes — the product** | The unified Electron application, shipping. 40 feature modules under `app/src/renderer/features/`, auto-discovered by `import.meta.glob`; the navigation-rail shell and its nine destinations under `app/src/renderer/shell/`; 24 test files. Packaged with Squirrel.Windows and published per push. |
| `design-system/` | Yes — wired in | Material Design 3 tokens generated from the `#0F7A3D` seed. Live: `app/src/renderer/styles/tokens.css` carries the palette and shape scale, and the whole renderer resolves through it — 1,795 token references across the feature stylesheets, with zero undefined references. |
| `site/` | **Yes — exists** | The documentation website, published through `.github/workflows/pages.yml`. |
| `src/`, `pom.xml` | Yes — legacy, still live | The original Java proxy. Bundled as the downloader core the unified app will drive. See Part B. |
| `web/` | Yes — legacy, still live | The original Flask web console. See Part B. |
| `desktop/`, `desktop.tests/` | Yes — legacy, still live | The original WPF C# desktop manager and its tests. This is what `app/` supersedes. See Part B. |
| `scraper/` | Yes — legacy, still live | The original Node chat-scraper bot. See Part B. |
| `bluemap/` | Yes — legacy, still live | The original BlueMap rendering pipeline. See Part B. |
| `installer/installer.nsi` | Yes — legacy | NSIS installer for the legacy WPF manager. Superseded for the unified app by Squirrel.Windows packaging (`app/electron-builder.yml`). |
| `docs/wiki/`, `docs/features/`, `docs/testing/`, `docs/images/` | Yes | User and feature documentation. `docs/features/` is the canonical per-feature doc set both `AGENTS.md` and `FEATURE_INVENTORY.md` require. |
| `.github/workflows/` | Yes — consolidated to two | `release.yml` (builds the Maven jar, packages the desktop application with Squirrel.Windows, and publishes one release per push) and `pages.yml` (the documentation site). The original six have been retired. Neither runs tests or lint: that is a standing decision, and nothing in a workflow gates a release. |
| `FEATURE_INVENTORY.md`, `ROADMAP.md`, `HANDOFF.md`, `AGENTS.md` | Yes | The four project-tracking documents referenced throughout this handoff. |

No legacy surface has been removed. The migration's own stated rule (see `ROADMAP.md` Milestone 5) is
that a legacy surface is retired only once the unified app has verified parity with it — the repository
does not pass through a state where a capability exists in neither surface.

### A.2b How the interface is put together

This is the least obvious part of the codebase and the easiest to break by accident, so it is worth
the paragraph.

The application used to open onto a strip of forty browser-style tabs, in which the downloader was
one tab among thirty-nine other things. It now opens onto a **navigation rail**, because the
downloader is the product. Everything else lives under a single **Other** destination.

```
main.ts  →  mountShell()                    app/src/renderer/shell/index.ts
              ├── titlebar.ts               display name, palette, bell, window controls
              ├── rail.ts                   the nine destinations
              ├── drawer.ts                 every destination AND every registered tab
              ├── header.ts                 screen title, live subtitle, profile chip
              └── screens/*.ts              discovered by import.meta.glob, like features
```

**The registry is still the single source of truth for features.** A feature module contributes
`TabDefinition`s exactly as before; `screens/other.ts` enumerates `ctx.registry.tabs()` and mounts
the selected one's own real `mount(host, ctx)` inside its detail frame. Nothing about writing a
feature changed, and no feature was rewritten to fit the shell.

Three consequences worth knowing before you edit any of this:

- **The drawer's "all features" list is load-bearing.** With the tab strip gone, that list plus the
  Other directory are the *only* routes to most features. In the first draft it, the notification
  bell and the account chip all mounted into a container that is no longer visible — real mount,
  real side effects, nothing on screen. If you add a control that opens a feature, route it through
  `openRegisteredTab()` in `shell/drawer.ts`, never `ctx.tabs.open()`.
- **`ctx.tabs` still exists and is still mounted**, hidden, because several call sites depend on it
  and `TabsImpl.open()` is a silent no-op when unmounted. Treat a direct `ctx.tabs.open()` from new
  code as a bug.
- **Three screens are deliberately tiny.** `map.ts`, `history.ts` and `settings.ts` mount the real
  feature panels rather than growing a second thinner copy of a date picker or a chunk editor that
  would quietly start disagreeing with the first about what a restore does. Small is the design
  there, not an unfinished screen.

### A.3 How to build and run

**The unified app, today:**

```bash
cd app
npm install
npm run dev          # electron-vite dev server, for interactive development
npm run typecheck     # tsc --noEmit against both the node and web tsconfigs
npm run build         # electron-vite build (no packaging)
npm run dist          # electron-vite build + electron-builder --win squirrel — the real installer
npm run dist:dir      # unpacked build only, for quick local inspection
```

**`build.bat` and `build-installer.bat` do not exist at the repository root yet.** This project's
standing build-script contract (see `AGENTS.md` §8, `FEATURE_INVENTORY.md` rows 14.1–14.2) requires a
touchless, dependency-bootstrapping `build.bat` (with a silent `/s` mode) and a `build-installer.bat`
that produces and verifies the same Squirrel installer CI would publish. Both are open work, not
something already shipped and merely undocumented.

**Legacy surfaces** build exactly as they did before this effort started — see Part B §B.4, or
`AGENTS.md` §3 for the full command reference (Maven for the proxy, Docker Compose for the web console,
`dotnet publish` for the WPF manager, `npm install`/`node scrape.js` for the scraper, the pipeline
script for BlueMap).

### A.4 How releases happen

**Today**, releases still flow through the six existing workflows under `.github/workflows/`,
unchanged by this effort so far — see Part B §B.7 for what the existing all-in-one release workflow
produces for the legacy desktop manager and jar.

**Once Milestone 4 of `ROADMAP.md` lands**, every push and every manual dispatch to the single
consolidated workflow will publish exactly one new, uniquely tagged, non-draft GitHub Release carrying
a genuinely built, unsigned Squirrel.Windows installer for the unified app, plus the release's required
line-count report, workflow timing, and dim-sum photo asset. **No such release has shipped yet** — the
consolidated workflow does not exist, and neither does a release build of `app/`.

### A.5 Standing constraints

These apply to every surface in this repository, not only the unified app, and are not subject to
per-task discretion:

- **Code signing is permanently prohibited.** No certificate, private key, timestamp credential, or
  signer service, for the desktop installer or any browser-extension packaging. Every build path
  clears signing inputs and verifies its output is genuinely unsigned; release notes say so plainly.
  See `AGENTS.md` §7.
- **No test or lint gate exists, or may be added, to GitHub Actions.** A workflow builds, packages,
  and publishes — checking happens locally, before a push, and a failing local check is still a real
  defect to fix, just never a gate. See `AGENTS.md` §6.
- **Squirrel.Windows is the only Windows installer format for the unified app.** No NSIS, portable,
  self-extracting, or ZIP-only installer path. If Squirrel packaging fails, that blocks the release
  rather than falling back to something else.
- **The unified app ships with no runtime dependency on a remote network asset it doesn't control and
  disclose** — no CDN scripts or stylesheets, no remote fonts, no third-party analytics or tracking,
  per the appearance/Material Design and landing-page rules in the maintainer's shared instructions
  that `AGENTS.md` mirrors.
- **Nobody ever pays to use this software.** No purchase, license, subscription, trial, or feature held
  behind an unlock, in the app or on the site. Where the app is built on another project's work (the
  bundled Java downloader core, any upstream library), a donation link — if one exists at all — points
  at that upstream project, never at this one.

### A.6 What is verified, and what is not

**Last updated: 2026-08-14, at commit `5c4a8df`.** Be precise about this distinction — it is the one
most likely to be misread by whoever picks this up next, and this section has been wrong before: it
previously claimed no release of `app/` had ever been published, long after ninety-three had.

**Verified:**

- **A published, downloadable release exists.** `app-v1.0.93` is non-draft, targets `5c4a8df`
  exactly, and every asset answers a real ranged request (HTTP 206): the Squirrel setup executable
  (164.9 MB), `world-downloader.jar` (14.1 MB), `RELEASES`, and the full `.nupkg`. The Java engine
  jar ships beside the app rather than only as a separate download.
- **The application compiles and packages.** `npm run typecheck` and `npm run build` both exit 0
  (482 modules). The release workflow is green for this commit.
- **`build.bat`, `build-installer.bat` and `download-dependencies.bat` all exist at the repository
  root**, and the dependency fetcher pins every binary it installs to an exact version and a
  recorded SHA-256 in `scripts/dependency-manifest.json`.
- **The world vault is proven against the real `git` binary**, not around it — `tests/integration/
  world-vault-git.test.ts` drives real repositories through real subprocesses.

**Not verified, stated exactly:**

- **The new interface has never been looked at.** The navigation-rail shell (`app/src/renderer/
  shell/`, nine destinations, ~9,300 lines) was written, typechecked and built, but no screenshot
  was taken and nobody has seen a pixel of it running. *Implemented and compiled is not verified*,
  and the screenshot matrix for it is the single largest outstanding item in this document.
- **The bundled runtimes are not actually in the released installer.** `predist` fetches a Java
  runtime and a portable Git into `app/resources/runtime/`, but `.github/workflows/release.yml`
  never runs `npm run dist` — it calls `npm run build` and then `npx electron-builder` directly,
  so `predist` never fires. Proof: `app-v1.0.91`'s setup was 164,772,864 bytes and `app-v1.0.93`'s
  is 164,862,464 bytes, about 90 KB apart, when a JRE plus MinGit is roughly 88 MB. The resolution
  code is correct; the pipeline never feeds it. A fix is in flight.
- **`FEATURE_INVENTORY.md` has not been re-checked against the shell.** Rows describing where a
  feature lives in the interface may now name the retired tab strip rather than a destination.
- No accessibility pass, localization pass, or built-artifact capture has been run against the
  shell.

### A.7 What remains

In rough order of what would most change someone's confidence in this project:

1. **Look at it.** Capture the nine destinations, both themes, the narrow layout and the empty and
   failed states from the real built artifact. Everything below is cheaper to judge once this exists.
2. **Make the installer carry what the app resolves.** Wire the acquisition step into the release
   workflow and assert against the *packaged output* that `resources/runtime/jre`,
   `resources/runtime/git` and `resources/scraper` are present. A green packaging log proves a file
   was copied, never that anything is inside the result — that mistake has now been made twice in
   this repository, at two different layers.
3. **Re-check `FEATURE_INVENTORY.md` against the shell**, row by row, and correct any that describe
   the old chrome.
4. **Give the shell tests.** It shipped with none by explicit instruction, and its riskiest seam is
   the one that already failed once: a control that mounts something into a container nobody can see.
5. Retire each legacy surface only once the unified app has verified parity with it, per
   `ROADMAP.md` Milestone 5.

---

## Part B — The legacy product (still live)

*This part preserves the prior project handoff. It describes the Java proxy, web console, WPF desktop
manager, scraper, and BlueMap pipeline as they exist today — unmodified by the unification effort so
far, and still buildable and usable exactly as described here. Once a piece of this is superseded and
retired per `ROADMAP.md` Milestone 5, remove it from this part and record the retirement in Part A.*

### B.1 What this is

A Minecraft **world downloader** that works as a man-in-the-middle proxy: point a Minecraft client at
the proxy (`localhost`) instead of the real server, and as you explore, the proxy saves the chunks,
entities, block entities, and container contents the server sends — producing a normal singleplayer
world on disk. This fork adds broad version support, automation, mapping, a web console, a desktop
manager, and an auto-explore bot around that core.

**Versions:** Minecraft **1.8 → 26.1**, including a working 1.21.5+ chunk path.

### B.2 Components

| Component | Where | Role |
|-----------|-------|------|
| **Proxy / downloader** | `src/main/java` | The core. Handshake/login/encryption MITM, per-version packet handlers, chunk/region (`.mca`) writing, entities, containers, the JavaFX GUI, and the headless overview-map renderer. |
| **Web console** | `web/` (Flask, Docker) | Browser UI to configure every option, sign in (Microsoft / token / offline), start/stop the downloader, watch logs, download the world, view a **live map**, and drive the **bot**. |
| **Desktop manager** | `desktop/` (C# WPF) | Windows app that runs the dockerized console, generates `docker-compose.yml`, and has controls for **BlueMap** and the **bot**; themes and accessibility. This is what the unified `app/` supersedes. |
| **Auto-explore bot** | `scraper/` (mineflayer) | Bots that connect *through the proxy* and walk/fly a grid so an area downloads automatically. |
| **BlueMap pipeline** | `bluemap/` (Python) | Upgrades a saved world with a temporary server jar (`--forceUpgrade`), then renders an interactive 3D web map. |

<details>
<summary><strong>B.3 Feature inventory (legacy, all implemented)</strong></summary>

- **Download + save**: chunks, block entities, entities (including chest/hopper **minecart**
  containers), per-version `.mca` writing; a 1.20.5+ item-NBT fix (`count` int) so saved containers
  aren't empty.
- **Auto-open container sweep** (`--auto-open-containers`): opens nearby containers (every block type
  plus crafters and container minecarts), logs captured items. Safety: **trapped chests are skipped by
  default** (opening one emits a redstone pulse; opt in with `--auto-open-allow-trapped-chests`), and a
  **player-proximity safety** won't open chests / trapped chests / barrels / shulker boxes while
  another player is within `--auto-open-player-radius` (default 100). Reach is fixed at 4.0.
- **Chat auto-reply** (`--auto-reply`): replies with a message's reply-colored text when its
  trigger-colored text matches (any colors; legacy + signed chat).
- **Live overview map**: renders **headless** (no JavaFX) to PNG region tiles under `<world>/overview`,
  shown as a pannable/zoomable canvas map in the web console (player marker, surface/caves toggle).
- **BlueMap 3D map**: `bluemap/pipeline.py` (standalone, docker profile, or desktop GUI).
- **Auto-explore bot**: Microsoft/offline accounts, gamemode-aware movement (creative/spectator fly,
  survival/adventure pathfinder-walk), multi-bot, AuthMe `/register`+`/login`, anti-stuck, **center-out
  spiral** coverage, visited-chunk dedup (+ revisit). Microsoft device-code sign-in is surfaced in the
  web console UI.
- **Extended render distance** (`-r`): re-sends downloaded chunks to the client; delivery is a steady
  per-chunk drip (`--extended-render-pace`, default 6ms) sending nearest chunks first (smooth, not
  bursty).
- **Ported from an upstream fork**: player skin-heads on the map, modded-block map colors (from mod
  JARs), Simple Voice Chat / PlasmoVoice UDP proxy, `CustomPayload` 1.20.6/1.21, NeoForge null-safety.
- **Core protocol fixes**: UTF-8 string decoding and VarLong overflow, both regression-tested (credited
  in `CREDITS.md`).
- **Accessibility & themes**: web console accessibility menu (dark/light/high-contrast; ADHD-focus /
  calm / easy-reading / low-vision presets; reduced motion; dyslexia font; text scaling; skip links)
  and desktop persisted themes plus large-text, Material tabs, font controls, language/funny modes,
  notification history, and searchable settings backed by a bounded .NET regex builder.
- **Jar GUI parity**: the JavaFX settings window has **Auto-open** and **Extras** tabs exposing the
  fork's features (auto-open suite including trapped-chest/player-radius safety plus log/state paths,
  chat auto-reply, extended-render pace, voice proxy, modded block colors, web-map tile writing) — so
  every feature is configurable from the jar GUI, web console, and desktop manager alike. Settings save
  on tab switch and apply live. The map window has a **status bar** (dimension, player position, loaded
  chunks, zoom), and the GUI supports **three themes** — dark / light / high-contrast (`--gui-theme`,
  or the Extras-tab picker, which switches all open windows live).
- **Disconnect diagnostics**: `[disconnect] …` logs for login kicks, in-game kicks, and socket closes;
  online-mode auth failures explain themselves; routine socket closes are logged calmly.

</details>

### B.4 Build & run (legacy, quickstart)

```bash
# Java proxy (JDK 21; tests skipped by default)
export JAVA_HOME=/path/to/jdk-21 && mvn package
java -jar target/world-downloader.jar --no-gui -s <server> -o <world>

# Web console (Docker)
docker compose up -d --build              # http://localhost:8080

# Desktop manager (Windows)
dotnet publish desktop/WorldDownloaderManager.csproj -c Release -r win-x64 --self-contained true -o publish
```

Full details and flags: `AGENTS.md` and `docs/wiki/Command-Line-Options.md`.

### B.5 Testing & verification (legacy, as last recorded)

- **Unit tests**: `mvn test -DskipTests=false` (JUnit 5).
- **Live integration harness** (not part of this repository, and not part of this handoff's
  verification claims for the unified app) drives a real Paper server through the proxy with a
  mineflayer bot. Last recorded full-matrix result before this handoff:
  - Core download + auto-open (all container types) + chat reply + saved-world load-back: green on
    1.12.2 / 1.20.4 / 1.21.8 / 1.21.11.
  - Scraper: dedup, survival, adventure, creative, and no-stuck coverage over a 5000×5000 area — green.
  - Server-jar upgrade + BlueMap render — green.
  - Extended-render-distance sanity (online path) — green.
- Build verification commands used for the legacy surfaces: `mvn package` (Java), `dotnet build` (C#),
  `python -m py_compile web/app.py` and `bluemap/pipeline.py`, `node -e "require('./scraper/scrape.js')"`.

<details>
<summary><strong>B.6 Open items / known issues (legacy)</strong></summary>

- **1.12.2 instant disconnect on a specific online-mode server (cause is server-side, not the proxy).**
  Conclusion after a deep investigation against the author's upstream:
  - **The proxy's 1.12.2 path is correct and equivalent to upstream's.** The handshake and login
    (`Key`/EncryptionResponse) handlers are byte-identical to upstream; the pre-1.19 encryption/auth
    flow is functionally identical. The fork's 1.12.2 (`317`) packet-table changes are additive
    (container-slot capture, chat send, the `Disconnect` mapping) plus a correctness fix (upstream
    mislabels serverbound `UseItem` → corrected to `UseItemOn` + `UseItem`).
  - **The proxy cannot corrupt the connection:** it always forwards the *original* packet bytes
    (handlers read a copy), per-packet handler exceptions are caught and the packet is still forwarded,
    and **offline-mode 1.12.2 passes end-to-end** (same packet handling; online only adds encryption,
    which is upstream-identical). No fork "fix-by-revert" was done — there's no proxy regression to
    revert.
  - **Remaining (server-side) fix:** capture the reason the proxy now logs on join
    (`[disconnect] server kicked you in-game: …`, `… server rejected the login: …`, or a benign
    socket-close line) or the client's disconnect screen, and confirm the server's real version and
    whether it's behind BungeeCord/Velocity or uses ViaVersion. A bare `SocketException` reset with no
    kick line points to a proxy/network layer in front of the server or Via severing the 1.12.2
    handshake — a server-side configuration, not a downloader bug.
- **BlueMap pin**: uses BlueMap **5.16** (last release that runs on Java 21; 5.17+ needs Java 25).
- **Voice proxy `CustomPayload`** is mapped for 1.20.6/1.21 only.
- The three large ported features (skin-heads, modded colors, voice) are compile/regression-verified
  but not fully integration-tested (they need real skins, mod JARs, and a voice plugin to exercise).

</details>

### B.7 Releases & PRs (legacy, as they exist today)

- **CI**: every push to `main` runs the all-in-one release workflow (`release.yml`), producing
  `WorldDownloaderManager-Setup.exe` (self-contained), `world-downloader.jar`, and `source.zip` on a
  GitHub release. A `bluemap` Docker profile and a separate desktop-release workflow also exist. This
  is the release path Part A §A.4 will replace once the unified app's own consolidated workflow ships.
- **Cross-fork PRs** (offering this fork's work back upstream, with credit): recorded and credited in
  `CREDITS.md`.

### B.8 Where to look first (legacy)

- Proxy entry / connection: `proxy/ProxyServer.java`, `proxy/ConnectionManager.java`,
  `proxy/EncryptionManager.java`.
- Packet routing: `packets/DataReader.java`, `packets/handler/**`,
  `src/main/resources/protocol-versions.json`.
- World/chunks: `game/data/WorldManager.java`, `game/data/chunk/**`, `game/data/region/**`.
- Config/flags: `config/Config.java`, `config/Version.java`, `config/VersionReporter.java`.
- Web: `web/app.py` (routes, `OPTIONS`, `Downloader`, `BotManager`), `web/templates/`, `web/static/`.
- Bot: `scraper/scrape.js`. Map pipeline: `bluemap/pipeline.py`. Desktop:
  `desktop/MainWindow.xaml(.cs)`.
