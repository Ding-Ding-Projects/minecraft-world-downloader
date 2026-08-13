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
| `app/` | **Yes — active, early stage** | The unified Electron application. `package.json`, `electron-vite.config.ts`, and `electron-builder.yml` (Squirrel.Windows target configured) exist. `app/src/renderer/core/` has three files. `app/src/renderer/features/` exists as an empty directory — no feature module has been built yet. |
| `design-system/` | **Yes — active, early stage** | Material Design 3 tokens, foundations, component references, and pattern references, organized under `app/`, `components/`, `foundations/`, `patterns/`, and `site/` subdirectories. Not yet wired into `app/`'s renderer as the live theme source. |
| `site/` | **No — does not exist yet** | Planned documentation website. |
| `src/`, `pom.xml` | Yes — legacy, still live | The original Java proxy. Bundled as the downloader core the unified app will drive. See Part B. |
| `web/` | Yes — legacy, still live | The original Flask web console. See Part B. |
| `desktop/`, `desktop.tests/` | Yes — legacy, still live | The original WPF C# desktop manager and its tests. This is what `app/` supersedes. See Part B. |
| `scraper/` | Yes — legacy, still live | The original Node chat-scraper bot. See Part B. |
| `bluemap/` | Yes — legacy, still live | The original BlueMap rendering pipeline. See Part B. |
| `installer/installer.nsi` | Yes — legacy | NSIS installer for the legacy WPF manager. Superseded for the unified app by Squirrel.Windows packaging (`app/electron-builder.yml`). |
| `docs/wiki/`, `docs/features/`, `docs/testing/`, `docs/images/` | Yes | User and feature documentation. `docs/features/` is the canonical per-feature doc set both `AGENTS.md` and `FEATURE_INVENTORY.md` require. |
| `.github/workflows/` | Yes — six workflows, not yet consolidated | `build.yml`, `desktop-release.yml`, `docker-base.yml`, `docker-image.yml`, `maven-publish.yml`, `release.yml`. None has been retired or merged into the planned single release workflow yet. |
| `FEATURE_INVENTORY.md`, `ROADMAP.md`, `HANDOFF.md`, `AGENTS.md` | Yes | The four project-tracking documents referenced throughout this handoff. |

No legacy surface has been removed. The migration's own stated rule (see `ROADMAP.md` Milestone 5) is
that a legacy surface is retired only once the unified app has verified parity with it — the repository
does not pass through a state where a capability exists in neither surface.

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

Be precise about this distinction — it's the one most likely to be misread by whoever picks this up
next.

**Verified (legacy surfaces only):** the legacy Java proxy, web console, WPF desktop manager, scraper,
and BlueMap pipeline have real prior verification evidence, recorded in Part B of this document. That
evidence is about those surfaces as they exist today, unmodified by this unification effort so far.

**Not verified (unified app):**

- No release of `app/` has ever been published. There is no installer, signed or unsigned, that a user
  could download today.
- No `npm install` / `npm run build` / `npm run dist` cycle for `app/` has been run and confirmed to
  succeed as part of producing this handoff. The scripts exist in `app/package.json`; whether they
  currently succeed on a clean checkout has not been confirmed here.
- No feature in `FEATURE_INVENTORY.md` has a passing test suite, a localization pass, an accessibility
  pass, or a real built-artifact capture yet — every row in that inventory is currently marked ⬜.
- `build.bat` and `build-installer.bat` do not exist, so the touchless-build path this project requires
  has never been exercised end-to-end.
- The single consolidated release workflow does not exist, so no release-workflow evidence (timing,
  line count, dim-sum asset) has ever been produced for the unified app.

Anyone continuing this work should run `cd app && npm install && npm run typecheck && npm run build`
as the first concrete verification step, before assuming any of the above is in a working state, and
should update this section with the real result once that's done.

### A.7 What remains

Everything in `ROADMAP.md` Milestones 1 through 5: wiring the design system into the app's live theme,
building out the ~90-row feature contract for both the app and the site (category 13, "the product
itself," is where the legacy surfaces' actual functionality gets rebuilt natively — it is the
functional core of the migration, not a finishing touch), standing up `site/` from nothing, adding
`build.bat`/`build-installer.bat`, consolidating the six workflows into one, and only then retiring each
legacy surface once the unified app has verified parity with it.

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
