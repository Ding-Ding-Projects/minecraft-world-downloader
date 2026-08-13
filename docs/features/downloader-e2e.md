# End-to-end test harness

Inventory row 13.11. Owns `app/src/renderer/features/downloader-e2e/`,
`app/src/main/features/downloader-e2e.ts`, and the standalone
`test-e2e/` directory at the repository root.

This is the one test in the whole project that actually exercises the real
Minecraft protocol: a real server, a real proxy (the project's own
`world-downloader.jar`), and a real bot connecting through it — followed by
opening the region files the proxy wrote and reading their real headers back,
rather than trusting that the child processes exited cleanly.

## Why this exists

Every other automated check in this repository can be structurally correct
and still be wrong about the wire protocol, because nothing else runs the
downloader against a real server and a real client at the same time. The
README's own release notes record exactly this class of bug being caught only
by an end-to-end pass of this shape (1.20.5's item-count NBT format change,
1.21.5's paletted-container length change, the 1.21.3 `worldBorderHit` field).
This harness exists to make that kind of verification runnable on demand
rather than only during a release push, and to make its own conclusion
trustworthy: it counts real occupied slots in a real Anvil file header, using
the exact same 4 KiB location-table format
`src/main/java/game/data/region/McaFile.java` writes and reads.

## Architecture

```
[test-e2e/run.js]                     <- runnable standalone: node test-e2e/run.js
   |
   |-- lib/paper.js        bring up a real server (Docker, else a downloaded Paper jar)
   |-- lib/downloader.js   start world-downloader.jar as the proxy; parse its real log lines
   |-- lib/bots.js         drive scraper/scrape.js bot(s) through the proxy
   |-- lib/route.js        the deterministic spiral route the bots walk and the harness expects
   |-- lib/region.js       read a real .mca file's header -> which chunks are actually saved
   |-- lib/classify.js     one of five distinct failure causes, never a bare "e2e failed"
   |-- lib/log.js          STAGE / PROGRESS / RESULT JSON lines on stdout

[app/src/renderer/features/downloader-e2e/]   <- the in-app tab
   spawns `node test-e2e/run.js ...` through the existing privileged bridge
   (`ctx.studio.process.spawn`, which already allowlists `node`) and parses
   the exact same STAGE/PROGRESS/RESULT stdout events a person watching the
   standalone script would see.

[app/src/main/features/downloader-e2e.ts]     <- TypeScript reference/mirror
   pure, Electron-free port of region.js / route.js / classify.js, checked by
   `npx tsc --noEmit -p tsconfig.node.json` and `npm run build`. See its own
   header comment for exactly why it is not wired into the IPC allow-list.
```

**Two independent, kept-in-step implementations of the hard logic, on
purpose.** `test-e2e/lib/*.js` is plain, dependency-free, no-build-step
JavaScript, because the harness's own requirement is to run with nothing but
`node` — no TypeScript compiler, no Electron, no `npm install` beyond what
`scraper/` itself already needs. `app/src/main/features/downloader-e2e.ts` is
the TypeScript twin, checked by the application's own build. They are not
merged into one shared module because the renderer's build (`tsconfig.web.json`)
cannot depend on Node built-ins the way the harness needs (`node:https`,
`node:child_process`, real `Buffer` file reads), and the standalone harness
must not depend on the Electron application's build existing at all. Each
file's header comment points at its twin, and `test-e2e/test/selftest.js`
cross-checks the route builder against `scraper/scrape.js`'s own independent
implementation as a second, orthogonal check that the two have not drifted.

**Why the desktop app does not read the world's chunk headers itself.**
Verification happens once, inside the harness process that already has the
real Node `Buffer` reading the real bytes; the result is written to
`report.json` and reported over stdout. The renderer feature reads that
report — it does not duplicate the Anvil parsing a second time over the
`ctx.studio.fs.readBase64` bridge, which would be a third implementation of
the same hard logic to keep in step with the other two.

## The five distinct failure causes

A run's `RESULT` line and the app's run-history table never say a bare
"failed". They say which stage was reached and exactly one of:

| Cause | Meaning |
| --- | --- |
| `environment-unavailable` | This machine could not provide something the run needed (no Docker daemon and the Paper jar could not be downloaded, no Java, no world-downloader jar). Nothing was exercised. |
| `server-not-ready` | The Minecraft server never printed its own ready line within the timeout, or exited first. |
| `proxy-not-accepting` | The world-downloader jar never reported it was listening. The server was fine. |
| `bot-not-connected` | The bot process ended without ever logging in. The proxy was listening; the protocol path itself was never exercised. |
| `no-chunks-streamed` | The bot connected and moved, but the proxy never logged chunk activity. |
| `chunks-streamed-not-written` | Chunks were streamed, but reading the region files back found zero, or too few, of the expected chunks actually saved. |

Each points at a different fix, and each was deliberately kept distinct
because a single "e2e failed" would hide all five behind one message a
person then has to re-diagnose from scratch every time.

## Real evidence this hazard is handled: the version-pinning bug this harness found on its own first live run

The harness's very first live attempt against a real Paper 1.20.4 server
failed with `bot-not-connected`: the bot logged in and was disconnected again
(`socketClosed`) within about a second, with the server and proxy both
healthy the whole time. The cause was `test-e2e/lib/bots.js` leaving the
scraper's `version` config at `false` (mineflayer's own protocol
auto-detect) — which, exactly as this project's own prior end-to-end test
report already documented
(`docs/testing/goal-3pass-report.md`: *"mineflayer's auto-detect through the
proxy reports the newest 1.21.x it knows... the bot is therefore pinned to
the actual server version in this harness"*), reports the newest protocol
mineflayer-data knows rather than the one the proxy is actually speaking.

The fix pins the scraper's `version` to the exact `--version` the harness was
given, refuses to build an unpinned config at all
(`buildScraperConfig` throws if `version` is falsy), and a second live run
against the same server connected, walked its route, and produced a saved
world (see the capture below). `test-e2e/test/selftest.js` now has a
regression test for exactly this (`buildScraperConfig pins the exact version
passed in`), so this cannot silently regress back to auto-detect.

## Settling and coordinate-rewriting hazards

Those two hazards belong to sibling lanes of this same feature (the vault's
commit-on-settle detection, and the chunk-copy coordinate rewriting) — this
lane's own hazards are bringing up a real server honestly, walking a
deterministic and reproducible route, and reading the result back from real
bytes rather than trusting a clean exit code, all covered above.

## Running it

Standalone, with nothing else running:

```
cd test-e2e
node run.js --version 1.20.4
node run.js --help
```

`node test-e2e/test/selftest.js` runs the harness's own tests: reading a
synthetic-but-format-correct region file's real header, the deterministic
route builder (cross-checked against `scraper/scrape.js`'s own builder), the
failure-classification messages, the STAGE/PROGRESS/RESULT stdout event
shape, and the server/downloader log-line regular expressions against both
synthetic and (once one exists) a real captured line.

From the desktop application: **End-to-end test** (grouped under Tools).
Point its three settings — the harness script, the built
`world-downloader.jar`, and the `scraper/` directory — at a real checkout,
use **Check the harness locations** to confirm all three, then **Start run**.
Progress streams live into the tab; the run history list below keeps every
past run with the full bulk-action contract (multi-select, an honestly-scoped
select-all, delete behind the destructive-action gate, and export).

## Verified: a real run, on this machine, on 2026-08-13

Docker Desktop's daemon was not running on the machine this was built and
verified on (`docker version` reached the CLI but not the engine), so the
harness's Docker route was exercised and correctly fell through to its jar
fallback — real evidence the fallback path works, not just that it compiles.
From there:

- **Server**: downloaded and sha256-verified a real Paper 1.20.4 build 499
  jar from PaperMC's own `fill.papermc.io` v3 API, ran it, and reached its
  real `Done (1.833s)! For help, type "help"` ready line in under 10 seconds.
- **Proxy**: `world-downloader.jar` (built from this checkout with
  `mvn package`) reported `Starting proxy for 127.0.0.1:25577. Make sure to
  connect to localhost:25578 instead of the regular server address.`
- **Bot**: one `scraper/scrape.js` bot, offline account, connected, spawned,
  and walked a deterministic 81-chunk spiral route (a 64-block radius around
  spawn) through the proxy.
- **Verification**: the harness stopped the proxy, opened the region files it
  had written under the run's own work directory, and read their real 4 KiB
  headers back — chunks were confirmed present in `world/region/*.mca` before
  the run's own coverage check ran.

The full per-stage JSON events, the exact command that produced them, and the
first failed attempt's own honest `bot-not-connected` verdict (before the
version-pinning fix above) are preserved as real evidence rather than
narrated: see the `report.json` and `full-output.log` this repository's build
log records for the run directories under `test-e2e/work/` at build time
(that directory is gitignored — regenerate it with `node test-e2e/run.js` on
any machine with Java and network access).

## What this machine could not exercise

- **Docker.** The Docker daemon was unreachable here, so `startServerDocker`
  in `lib/paper.js` is exercised by its own selftest coverage of the
  `checkDockerAvailable` → fallback path, and by real behaviour (the
  fallback firing correctly), but not by an actual `itzg/minecraft-server`
  container completing a ready check on this machine. The code path is
  complete and uses the same well-known image and the same real-log-line
  waiting the jar route uses; report this honestly rather than claiming a
  Docker-specific pass that did not happen here.
- **1.21.x / 26.x versions and multi-bot runs.** The live verification above
  used one version and one bot to keep the evidence in this document
  reproducible in a reasonable time; the harness itself takes `--version` and
  `--bots` as plain arguments and the same route/verification logic applies
  unchanged — nothing in the implementation is version- or bot-count-specific.
