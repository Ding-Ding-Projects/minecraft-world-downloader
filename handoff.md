# Project handoff

A complete handoff for the **cafepromenade** fork of `minecraft-world-downloader`. For build/test/coding
conventions see [`AGENTS.md`](AGENTS.md); for user docs see [`README.md`](README.md) and `docs/wiki/`.
**Per-feature handoff docs** (one detailed document per feature) live in
[`docs/features/`](docs/features/README.md).

---

## 1. What this is

A Minecraft **world downloader** that works as a man-in-the-middle proxy: you point your Minecraft client
at the proxy (`localhost`) instead of the server, and as you explore, the proxy saves the chunks,
entities, block entities and container contents the server sends — producing a normal singleplayer world
on disk. This fork adds broad version support, automation, mapping, a web console, a desktop manager, and
an auto-explore bot.

**Versions:** Minecraft **1.8 → 26.1**, including a working 1.21.5+ chunk path.

## 2. Components

| Component | Where | Role |
|-----------|-------|------|
| **Proxy / downloader** | `src/main/java` | The core. Handshake/login/encryption MITM, per-version packet handlers, chunk/region (.mca) writing, entities, containers, the JavaFX GUI, and the headless overview-map renderer. |
| **Web console** | `web/` (Flask, Docker) | Browser UI to configure every option, sign in (Microsoft / token / offline), start/stop the downloader, watch logs, download the world, view a **live map**, and drive the **bot**. |
| **Desktop manager** | `desktop/` (C# WPF) | Windows app that runs the dockerized console, generates `docker-compose.yml`, and has controls for **BlueMap** and the **bot**; themes + accessibility. |
| **Auto-explore bot** | `scraper/` (mineflayer) | Bots that connect *through the proxy* and walk/fly a grid so an area downloads automatically. |
| **BlueMap pipeline** | `bluemap/` (Python) | Upgrade a saved world with a temporary server jar (`--forceUpgrade`), then render an interactive 3D web map. |

## 3. Feature inventory (all implemented)

- **Download + save**: chunks, block entities, entities (incl. chest/hopper **minecart** containers),
  per-version `.mca` writing; 1.20.5+ item-NBT fix (`count` int) so saved containers aren't empty.
- **Auto-open container sweep** (`--auto-open-containers`): opens nearby containers (every block type +
  crafters + container minecarts), logs captured items. Safety: **trapped chests are skipped by
  default** (opening one emits a redstone pulse; opt in with `--auto-open-allow-trapped-chests`), and a
  **player-proximity safety** won't open chests / trapped chests / barrels / shulker boxes while another
  player is within `--auto-open-player-radius` (default 100). Reach is fixed at 4.0.
- **Chat auto-reply** (`--auto-reply`): replies with a message's reply-coloured text when its
  trigger-coloured text matches (any colours; legacy + signed chat).
- **Live overview map**: renders **headless** (no JavaFX) to PNG region tiles under `<world>/overview`,
  shown as a pannable/zoomable canvas map in the web console (player marker, surface/caves toggle).
- **BlueMap 3D map**: `bluemap/pipeline.py` (standalone, docker profile, or desktop GUI).
- **Auto-explore bot**: Microsoft/offline accounts, gamemode-aware movement (creative/spectator fly,
  survival/adventure pathfinder-walk), multi-bot, AuthMe `/register`+`/login`, anti-stuck, **center-out
  spiral** coverage, visited-chunk dedup (+ revisit). Microsoft device-code sign-in is surfaced in the
  web console UI.
- **Extended render distance** (`-r`): re-sends downloaded chunks to the client; delivery is a steady
  per-chunk drip (`--extended-render-pace`, default 6ms) sending nearest chunks first (smooth, not bursty).
- **Ported from TheHecateII's fork**: player skin-heads on the map, modded-block map colours (from mod
  JARs), Simple Voice Chat / PlasmoVoice UDP proxy, `CustomPayload` 1.20.6/1.21, NeoForge null-safety.
- **Core protocol fixes**: UTF-8 string decoding (credit 7byLoper) and VarLong overflow (credit
  trichhoffson), both regression-tested.
- **Accessibility & themes**: web console ♿ menu (dark/light/high-contrast; ADHD-focus / calm /
  easy-reading / low-vision presets; reduced motion; dyslexia font; text scaling; skip links) and
  desktop persisted themes + large-text, M3 tabs, font controls, language/funny modes, notification
  history, and searchable settings backed by the bounded .NET regex builder.
- **Jar GUI parity**: the JavaFX settings window has **Auto-open** and **Extras** tabs exposing the
  fork's features (auto-open suite incl. trapped-chest/player-radius safety + log/state paths, chat
  auto-reply, extended-render pace, voice proxy, modded block colours, web-map tile writing) — so every
  feature is configurable from the jar GUI, web console, and desktop manager alike. Settings save on
  tab switch and apply live (the sweep/reply/pace read `Config` continuously). The map window has a
  **status bar** (dimension, player position, loaded chunks, zoom), and the GUI supports **three
  themes** — dark / light / high-contrast (`--gui-theme`, or the Extras-tab picker, which switches all
  open windows live). Theme overrides live in `ui/light.css` / `ui/contrast.css` layered over
  `ui/dark.css` on the scene ROOT (parent stylesheets outrank scene stylesheets in JavaFX).
- **Disconnect diagnostics**: `[disconnect] …` logs for login kicks, in-game kicks, and socket closes;
  online-mode auth failures explain themselves; routine socket closes are logged calmly.

## 4. Build & run (quickstart)

```bash
# Java proxy (JDK 21; tests skipped by default)
export JAVA_HOME=/path/to/jdk-21 && mvn package
java -jar target/world-downloader.jar --no-gui -s <server> -o <world>

# Web console (Docker)
docker compose up -d --build              # http://localhost:8080

# Desktop manager (Windows)
dotnet publish desktop/WorldDownloaderManager.csproj -c Release -r win-x64 --self-contained true -o publish
```
Full details + flags: `AGENTS.md` and `docs/wiki/Command-Line-Options.md`.

## 5. Testing & verification

- **Unit tests**: `mvn test -DskipTests=false` (JUnit 5).
- **Live integration harness** (NOT in the repo) at `C:/Users/cntow/mcwdtest/` drives a real Paper
  server ← proxy ← mineflayer bot. Last full matrix result:
  - Core download + auto-open (all container types) + chat reply + saved-world load-back: **green on
    1.12.2 / 1.20.4 / 1.21.8 / 1.21.11**.
  - Scraper: dedup, survival, adventure, creative, and no-stuck over 5000×5000 — **green**.
  - Server-jar upgrade + BlueMap render — **green**.
  - Extended-render-distance sanity (online path) — **green**.
- Build verification: `mvn package` (Java), `dotnet build` (C#), `python -m py_compile web/app.py`
  and `bluemap/pipeline.py`, `node -e "require('./scraper/scrape.js')"`.

## 6. Open items / in progress

- Desktop global-memory rollout: the first verified milestone includes encrypted current-user password
  storage, Docker-log redaction, defensive YAML scalars, tabs, language/funny preferences, regex building,
  notifications, external-editor launch, bundled dim-sum assets, ten desktop tests and headless captures.
  Remaining work is tracked in `ROADMAP.md`: full element-level appearance editing, tab management,
  Git-backed local history, and the complete historical changelog viewer.

- **1.12.2 instant disconnect on a specific online-mode server (cause is server-side, not the proxy).**
  Conclusion after a deep investigation against the author's upstream (`git fetch upstream` + diffs):
  - **The proxy's 1.12.2 path is correct and equivalent to upstream's.** The handshake and login
    (`Key`/EncryptionResponse) handlers are byte-identical to upstream; the pre-1.19 encryption/auth
    flow is functionally identical (fork `EncryptionManager` deltas are 1.19+/1.20.6 branches, the
    auto-open injector, and log text only). The fork's 1.12.2 (`317`) packet-table changes are additive
    (container-slot capture, chat send, the `Disconnect` mapping) plus a correctness fix
    (upstream mislabels serverbound `UseItem` → corrected to `UseItemOn` + `UseItem`).
  - **The proxy cannot corrupt the connection:** it always forwards the *original* packet bytes
    (handlers read a copy), per-packet handler exceptions are caught and the packet is still forwarded,
    and **offline-mode 1.12.2 passes end-to-end** (same packet handling; online only adds encryption,
    which is upstream-identical). So a fork "fix-by-revert" was deliberately **not** done — there is no
    proxy regression to revert (the chosen direction was *fix the real cause, keep all features*).
  - **Remaining (server-side) fix:** capture the reason the proxy now logs on join
    (`[disconnect] server kicked you in-game: …`, `… server rejected the login: …`, or a benign
    socket-close line) or the client's disconnect screen, and confirm the **server's real version +
    whether it's behind BungeeCord/Velocity or uses ViaVersion**. A bare `SocketException` reset with no
    kick line points to a proxy/network layer in front of the server or Via severing the 1.12.2
    handshake — a server-side configuration, not a downloader bug. All the diagnostics to pinpoint it
    are in place (`ProxyServer`, `EncryptionManager`, `ClientBound{Login,Game}PacketHandler`).
- **BlueMap pin**: uses BlueMap **5.16** (last release that runs on Java 21; 5.17+ need Java 25).
- **Voice proxy `CustomPayload`** is mapped for 1.20.6/1.21 only.
- The three large ported features (skin-heads, modded colours, voice) are compile/regression-verified
  but not fully integration-tested (need skins / mod JARs / a voice plugin).

## 7. Releases & PRs

- **CI**: every push to `main` runs the all-in-one release workflow producing
  `WorldDownloaderManager-Setup.exe` (self-contained), `world-downloader.jar`, and `source.zip` on a
  GitHub release. A `bluemap` docker profile and a desktop-release workflow also exist.
- **Cross-fork PRs** (offering this fork's work, with credit): TheHecateII #1 (updated), 7byLoper #1,
  trichhoffson #1. All credited in `CREDITS.md`.

## 8. Where to look first

- Proxy entry / connection: `proxy/ProxyServer.java`, `proxy/ConnectionManager.java`,
  `proxy/EncryptionManager.java`.
- Packet routing: `packets/DataReader.java`, `packets/handler/**`, `src/main/resources/protocol-versions.json`.
- World/chunks: `game/data/WorldManager.java`, `game/data/chunk/**`, `game/data/region/**`.
- Config/flags: `config/Config.java`, `config/Version.java`, `config/VersionReporter.java`.
- Web: `web/app.py` (routes, `OPTIONS`, `Downloader`, `BotManager`), `web/templates/`, `web/static/`.
- Bot: `scraper/scrape.js`. Map pipeline: `bluemap/pipeline.py`. Desktop: `desktop/MainWindow.xaml(.cs)`.
