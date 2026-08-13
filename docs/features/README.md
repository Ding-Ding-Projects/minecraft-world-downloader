# Feature handoff — index

A per-feature handoff for the **cafepromenade** fork of `minecraft-world-downloader`. Each row links to a
detailed, code-grounded document for that feature (what it does, how it works, key files, flags, usage,
verification, gotchas, open items).

For the project-wide handoff see [`../../handoff.md`](../../handoff.md); for build/test/coding
conventions see [`../../AGENTS.md`](../../AGENTS.md).

## Core proxy & protocol
| Feature | Summary | Doc |
|---|---|---|
| **World download & saving** | Intercepts server chunk/entity/block-entity packets, parses them per-version, groups into regions, and writes standard Anvil `.mca` + `level.dat`, preserving container contents across sessions. | [world-download.md](world-download.md) |
| **Version support & protocol fixes** | Auto-detects the client's handshake protocol, resolves it to a packet-ID table in `protocol-versions.json` (closest-lower best-match), routes parsing via version-anchored `DataTypeProvider`s; includes the UTF-8 + VarLong parsing fixes. | [protocol-versions.md](protocol-versions.md) |
| **Extended render distance** | Re-injects already-saved chunks from disk to the client (raises the Login view distance, streams `.mca` chunks as you move), paced smoothly nearest-first; disabled on 1.21+. | [extended-render-distance.md](extended-render-distance.md) |
| **Disconnect diagnostics** | Plain-English `[disconnect]` logging for socket closes, login rejections, encryption/auth failures, and in-game kicks — without changing packet routing. | [disconnect-diagnostics.md](disconnect-diagnostics.md) |

## Automation & capture
| Feature | Summary | Doc |
|---|---|---|
| **Auto-open container sweep** | Opt-in (`--auto-open-containers`): injects serverbound interactions to open nearby block containers and container minecarts one at a time, capturing contents, with player-proximity safety and an item log. | [auto-open-containers.md](auto-open-containers.md) |
| **Chat auto-reply** | Opt-in (`--auto-reply`): when an incoming message's trigger-coloured text matches, echoes its reply-coloured text back as real chat, rate-limited and de-duped. | [chat-auto-reply.md](chat-auto-reply.md) |
| **Auto-explore bot** | Mineflayer bot(s) that connect through the proxy and walk/fly a spiral grid so an area downloads automatically: multi-bot, gamemode-aware movement, visited-chunk dedup, web-console control. | [scraper-bot.md](scraper-bot.md) |

## Mapping
| Feature | Summary | Doc |
|---|---|---|
| **Live overview map** | JavaFX-free renderer writes top-down PNG region tiles + `meta.json` under `<output>/overview`, served as a live pannable browser map; on by default in headless mode. | [live-map.md](live-map.md) |
| **BlueMap 3D map pipeline** | Upgrades a downloaded world via a temporary `--forceUpgrade` server, renders it with the pinned BlueMap 5.16 CLI, and serves a self-contained 3D web map (optional Docker service re-renders every 15 min). | [bluemap.md](bluemap.md) |

## Interfaces
| Feature | Summary | Doc |
|---|---|---|
| **Web management console** | Flask dashboard (the Docker container's entrypoint) mirroring the CLI flags; manages the headless Java process + the bot, handles Minecraft account auth, and serves the live map + world downloads. | [web-console.md](web-console.md) |
| **Desktop manager (C# WPF)** | Windows GUI with M3 tabs, persisted language/funny/font controls, safe settings, a bounded .NET regex builder, notifications, external-editor launch, bundled dim-sum delight, Docker management, BlueMap and bot helpers. | [desktop-manager.md](desktop-manager.md) |
| **Accessibility & themes** | Dark/light/high-contrast theming plus an accessibility menu (presets, reduced motion, calm, focus, dyslexia font, text scaling) in the web console, mirrored by a theme + large-text switcher in the desktop app. | [accessibility-themes.md](accessibility-themes.md) |

## Ported & ops
| Feature | Summary | Doc |
|---|---|---|
| **Ported features (heads, modded colours, voice)** | Player skin-heads on the map, modded-block map colours from mod-JAR textures, and a transparent Simple Voice Chat / PlasmoVoice UDP relay (from TheHecateII's fork). | [ported-features.md](ported-features.md) |
| **Deployment, CI & installer** | Multi-stage Docker image (jar + Python console + Node bot), docker-compose with optional BlueMap, the NSIS Windows installer, and the GitHub Actions release pipelines. | [deployment-ci.md](deployment-ci.md) |

## Delight & release identity
| Feature | Summary | Doc |
|---|---|---|
| **Dim sum surprise & release code names** | A one-in-ten startup card naming a dish in both languages, with its photograph resolved from the public dim sum photo catalogue (never stored here); plus the resolver that gives every release its own unused dish as a code name. | [dim-sum.md](dim-sum.md) |

---
*Each detailed doc follows the same structure: What it does · How it works · Key files · Configuration/flags · Usage · Verification · Gotchas & limitations · Open items.*
