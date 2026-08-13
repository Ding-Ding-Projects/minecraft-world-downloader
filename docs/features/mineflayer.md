# Minecraft bots: connection, live state, profiles and the event inspector

Runs the vendored [mineflayer](https://github.com/PrismarineJS/mineflayer)
library in a sandboxed Node child process behind an allow-listed method
surface — never an arbitrary exec channel — and gives every other mineflayer
surface in this application the one thing they all need: a live bot to drive.
Owns the guided connection form, the credential vault handoff for the
authentication modes that need one, the live state read-out, saved multi-bot
profiles with the full bulk-action set, and an honest catch-all event
inspector covering every real event the library fires.

- **Feature id:** `mineflayer`
- **Destinations:** *Bots* (connect, live state, saved profiles) and
  *Bot events* (the event inspector)
- **Settings section:** *Bot connection defaults*
- **Command palette:** direct teleports to both tabs, plus the live control
  for the event log buffer size
- **Satisfies:** `FEATURE_INVENTORY.md` rows **15.1**, **15.2**, **15.18**,
  **15.19**, and drives `scripts/check-mineflayer-coverage.mjs` for row
  **15.20**
- **Distinct from `features/bot`:** that feature spawns the project's own
  external scraper script (`scraper/scrape.js`) as a separate operating-system
  process. This feature embeds the vendored `mineflayer` library itself,
  inside its own sandboxed Node child process, and is what every other
  mineflayer surface (`mineflayer-chat`, `mineflayer-movement`, and any future
  `mineflayer-inventory` or `mineflayer-world`) actually drives.

---

## Why a separate process, and why not `require('mineflayer')` in the renderer

The renderer has no `require`, no `process`, and no TCP sockets — Electron
context isolation and this application's own security posture forbid it. The
bot library needs all three: it opens a real socket to a real Minecraft
server and reads the wire protocol. So the runtime lives entirely outside the
renderer, as its own `node` process, and `runtime.ts` speaks to it only
through `ctx.studio.process` — the same allow-listed, privileged bridge every
other feature in this application uses to run a child process. `node` is on
that bridge's fixed allow-list of bare executable names; nothing about this
feature adds to that list or bypasses it.

### The wire contract (`protocol.ts`)

Newline-delimited JSON travels both ways over the child process's stdin and
stdout. Every line the host writes is prefixed with a sentinel
(`@WDS-MINEFLAYER-1@`), so a warning some dependency prints straight to
`console.log` — including the exact Microsoft device sign-in code, which the
library prints rather than handing over as data — can never be mistaken for a
protocol message. `protocol.ts` is the single source of truth both halves
agree on: connection options, the live `BotState` shape, every command the
host accepts, and `EVENT_NAMES`, the complete list of events the library
emits.

### The runtime process (`bot-host.js`)

Written as raw text (imported with Vite's `?raw` suffix, so it is bundled but
never executed inside the renderer) into this application's own data
directory, then launched with `node`. It owns every bot instance and exposes
exactly three things: connect, disconnect, and call one of a **fixed list**
of allow-listed methods with validated arguments. There is deliberately no
`eval` channel, no `require` channel from the renderer's side, and no way to
reach a method that is not on that list — a renderer that could ask a Node
process to run arbitrary code would be a renderer with Node access in
everything but name.

Every event name, method name, option name and property name in `protocol.ts`
and `bot-host.js` was read directly out of the vendored source at
`vendor/mineflayer` (version 4.37.1) — `index.d.ts`, `docs/api.md`,
`lib/loader.js`, `lib/version.js` and every file in `lib/plugins/` — never
guessed, and in five cases (below) verified against the real `bot.emit(...)`
calls rather than trusted from the shipped type declarations alone.

### Finding the vendored library

`resolveLibrary` in `bot-host.js` walks up to eight directories from the
child process's own working directory, checking at each level whether that
directory (or a `vendor/mineflayer`, `node_modules/mineflayer`, or
`app/node_modules/mineflayer` subdirectory of it) is genuinely the `mineflayer`
package — verified by its own `package.json` naming itself `mineflayer`, not
merely by a file existing at that path. `runtime.ts` also passes a handful of
harmless relative `--library-root=` guesses; each one costs nothing when
wrong, because every path tried — right down to the nested error a failed
`require` produced — is recorded and, on failure, shown verbatim under **Every
path the runtime searched** on the *Bots* tab.

**Known packaging gap.** This is honestly the one part of this feature that a
development checkout gets for free and a packaged installer does not yet.
`vendor/mineflayer` sits at the repository root, outside every path this
feature owns, and:

1. It has no `node_modules` of its own — the library's real dependencies
   (`minecraft-data`, `minecraft-protocol`, `vec3`, every `prismarine-*`
   package, and so on) need installing there, or hoisting into `app/`'s own
   `node_modules`, before `require('mineflayer')` can actually resolve them.
2. Electron Builder's packaging configuration (`app/electron-builder.yml`) has
   no `extraResources` entry copying `vendor/mineflayer` into an installed
   build, and this feature's owned paths do not include that file.
3. The renderer has no reliable way to learn the repository root's absolute
   path from `ctx.studio.info` alone — `AppInfo` exposes the application data
   directory, not the source or resources tree, so `runtime.ts`'s relative
   guesses are exactly that: guesses, good enough for a development checkout
   where the child process's working directory sits one level below the
   repository root, not a substitute for a real resolved path.

None of this is silent: a build where the library cannot be found still starts
the host process, which stays alive, reports the fault, and answers every
command with a clear `LIBRARY_NOT_FOUND` error rather than crashing or
pretending to be connected.

---

## Behaviour

### Connecting (row 15.1)

The guided connection form on the *Bots* tab covers everything
`ConnectionOptions` accepts: host, port, username, authentication mode, an
optional Minecraft version (blank lets the library ask the server), an
optional SOCKS5 proxy, view distance, chat visibility, colours, main hand,
difficulty, physics, automatic respawn, and a full reconnect policy —
enabled/disabled, a bounded or unlimited attempt ceiling, exponential backoff
with a ceiling delay, and whether a kick (as opposed to a dropped socket)
should also trigger a reconnect. **Settings → Bot connection defaults**
pre-fills every one of these for a new saved profile or a quick connect; every
field remains individually editable.

Three authentication modes, each handled honestly:

- **Offline** — no credential leaves this feature at all.
- **Microsoft account** — `bot-host.js` passes an `onMsaCode` callback into
  the library; when it fires, the exact device code and verification URL are
  forwarded as a `signin` protocol message, shown as a persistent, actionable
  notification (with an **Open the sign-in page** action wired to
  `ctx.studio.shell.openExternal`) and on the bot's own detail card — never
  paraphrased, never guessed at.
- **Legacy Mojang account** — a password. It is written to
  `ctx.studio.vault` under a stable per-profile account key
  (`mineflayer.profile.<id>.password`) the moment the profile is saved, and
  read back out of the vault only for the instant a `connect` command is
  actually sent; the `HostCommand` protocol's own `secret` field documents
  that it lives in the runtime process's memory for the life of the session
  and never re-appears in a reply, an event, a log line, a setting, an
  export, or a history entry. Deleting a profile deletes its vaulted
  password.

### Live state (row 15.2)

Every field on the *Bots* tab's detail cards is the bot's own last reported
reading — health, food, saturation, oxygen, experience level and progress,
game mode, dimension, difficulty, position, velocity, yaw, pitch, on-ground
state, held item, time of day and day/night, weather, player and entity
counts, server version and brand. `bot-host.js`'s `snapshot()` function
starts every one of these at `null` and only ever fills in a value the
library genuinely reported; nothing here renders a simulated zero while
disconnected. State pushes are cheap: one shared 500&nbsp;ms timer flushes a
snapshot only for a bot whose relevant fields actually changed since the last
push, rather than polling every session on a fixed schedule regardless of
whether anything moved.

Two fields — `eyeHeight` and `isInWater` — were added to `BotState` beyond
what the previous pass on this feature shipped, because `bot.entity.eyeHeight`
and `bot.entity.isInWater` (`lib/plugins/physics.js`) are real, useful state
that the movement sibling's ray-trace and swimming logic needs and that a live
state read-out should not omit.

### Saved profiles and multi-bot sessions (row 15.19)

`store.ts`'s `ProfileStore` persists saved connection profiles through
`ctx.settings`, exactly like any other feature-owned list — no separate file,
no separate schema version to keep in step. The *Bots* tab's list carries the
full contract: multi-select with a keyboard path, an honestly-scoped
select-all, a reviewable preview and exact count before a bulk delete (which
also removes each deleted profile's vaulted password), and export in every
format the profile data can carry.

Up to eight bots run at once from the one host process — the same ceiling
`bot-host.js` itself enforces (`MAX_BOTS`) — and `manager.ts`'s `BotManager`
gives each its own `LiveBotSession`: independent status, live state, event
ring buffer, and Microsoft sign-in prompt, so a second bot connecting never
resets or bleeds into the first one's. Selecting a row in the list makes that
bot **active**; the active bot is the one every sibling mineflayer feature
drives (see below), and the one the *Bot events* tab defaults to showing.

### The event inspector (row 15.18)

The *Bot events* tab is the honest catch-all this row exists for: **every**
event the library actually fires for the selected bot, listed as it fires,
searchable with this project's full pattern-matching builder (matching both
the event name and its serialized payload text), pausable without stopping
the underlying subscription, and exportable as JSON Lines honouring whatever
is currently filtered. A bounded ring buffer per bot — sized by **Settings →
Bot connection defaults → Event log buffer size**, default 2,000 — is the
buffer's stated retention: once full, the oldest entries make way for new
ones, and the setting's own description says so rather than leaving that
silent.

High-frequency events (`move`, `physicTick`, `physicsTick`, `entityMoved`,
`entityUpdate`, `entityAttributes`, `blockUpdate`, `chunkColumnLoad`,
`chunkColumnUnload`, `particle`) are excluded from the default subscription —
a chatty server can fire tens of these a second, and a fresh connection with
every one of them on would fill the retained buffer in under a second and
push every other event out of it. The tab's own toggle turns every one of
them on, honestly labelled with exactly how many more events that adds. The
runtime additionally enforces a 200-events-per-second budget per bot no
matter the subscription; anything dropped under that budget is reported as a
visible `events dropped` marker in the log, with a running total, rather than
disappearing without a trace.

**Five events the shipped `index.d.ts` does not declare, verified against
`bot.emit(...)` in the real source:** `blockPlaced`
(`lib/plugins/place_block.js`), `entityPlaced` (`lib/plugins/place_entity.js`),
`weatherUpdate` (`lib/plugins/rain.js`), and `title_times` / `title_clear`
(`lib/plugins/title.js`). The library's type declarations lag its
implementation on this vendored version; an event inspector that only trusted
the types would have silently dropped every one of these five. Two names
present in `index.d.ts` were deliberately **not** added:
`blockUpdate:(x, y, z)` is a per-coordinate listener template rather than a
literal event name anything emits, and `tablist` is not an event at all —
`lib/plugins/tablist.js` mutates `bot.tablist.header`/`.footer` in place and
never calls `bot.emit`, which is exactly why the allow-listed `tablist`
**method** exists below.

Three raw event-payload classes — `BossBar`, `ScoreBoard` and `Team`
(`lib/bossbar.js`, `lib/scoreboard.js`, `lib/team.js`) — hold every real field
behind class-level getters over underscore-prefixed backing properties. The
generic serializer `bot-host.js` uses for every other event payload only ever
walks *own* enumerable keys and deliberately skips anything starting with
`_`, so a raw instance of one of these three would have serialized to `{}` —
every key it would show lives on the prototype, not the instance. Events like
`bossBarCreated`, `scoreboardCreated` and `teamCreated` hand one of these
straight to `bot.emit`, so this was not hypothetical: it is what the
inspector would otherwise have shown for those events. `serialize()` now
special-cases all three constructors, exactly as it already did for
`ChatMessage`.

A separate, smaller diagnostic log — everything the host process printed to
its own console (level, text, timestamp; this is also how a raw,
un-code-formatted Microsoft sign-in message would surface if the structured
`signin` message were ever unavailable) plus every `fault` message — sits in
a collapsible **Runtime diagnostic log** section beneath the event list. It is
host-wide, not per-bot, because a fault such as `LIBRARY_NOT_FOUND` happens
before any bot session exists to attach it to.

---

## The allow-listed method surface

`bot-host.js`'s `METHODS` object is the complete, fixed list of everything a
renderer can ask a connected bot to do — chat, whisper, tab-complete,
movement and look controls, inventory and window operations, crafting,
digging and block placement, entity interaction, sleeping and respawn, book
writing, resource-pack accept/deny, creative-mode operations, settings
changes, and session control. Every argument is validated by the specific
method's own `run` function before it ever reaches the library — a malformed
argument is refused with a message naming exactly which argument and why,
never handed through unread. `runtime.ts`'s `call(botId, method, args)` is
the one route to any of it; `getMineflayerRuntimeContract()` in `bridge.ts`
exposes that same call surface, plus the live bot list, active-bot tracking
and the raw host message stream, as the generic typed contract any future
sibling can build on without this feature needing to know its shape in
advance.

Five methods exist purely to serve sibling and inspector needs that the
original method list did not yet cover, and were added by reading the exact
vendored source rather than guessed: `tablist` (reads
`bot.tablist.header`/`.footer`, both flattened with `.toString()`, since
there is no library event for a tablist change), `bossBars`, `scoreboards`
and `teams` (pull the same three getter-backed classes discussed above, via
the shared `serializeBossBar`/`serializeScoreboard`/`serializeTeam`
functions), and `chatLengthLimit` (reproduces the exact formula
`lib/plugins/chat.js` computes into a closure variable nothing outside that
file can otherwise read: the connection's own `chatLengthLimit` when set,
otherwise `bot.supportFeature('lessCharsInChat') ? 100 : 256`).

---

## The typed contract sibling features drive a bot through (`bridge.ts`)

A second feature cannot open its own connection to the same server without
the server seeing two players, so this feature is the *only* one that ever
calls `connect`. Every sibling drives whichever bot is **active** here,
through a narrow, typed facade `bridge.ts` builds — never by reaching into
`manager.ts` or `runtime.ts` directly.

Two sibling features already existed when this file was written, and each
expected a different discovery shape, found by reading their own source
rather than guessed:

- **`mineflayer-movement`** (`session.ts`) looks for a **named export** from
  this module, `sessionHost` (checked first, ahead of `sessions`,
  `botSessions` and `mineflayerSessions`), implementing
  `{ active(), subscribe(listener) }` where `active()` returns an object with
  `snapshot`, `subscribe`, `setControlState`, `clearControlStates`, `look`,
  `lookAt`, `entities`, and optionally `blockAtCursor` / `entityAtCursor`.
  `bridge.ts` exports exactly that. `entities()` must be synchronous per that
  contract, so a 1.5&nbsp;second background poll keeps a per-bot entity cache
  warm for whichever bot is active; `setControlState`/`clearControlStates`
  keep an optimistic local shadow of the seven control states so `snapshot()`
  can report them without a live event to read them from (the library does
  not push one).
- **`mineflayer-chat`** (`session.ts`) looks for a function,
  `publishBotSessionHost`, to be **called**, not exported — it owns that
  function itself and documents that the bot feature should import and call
  it once. `bridge.ts` finds it with `import.meta.glob('../mineflayer-chat/
  session.ts')`, exactly as the movement sibling finds this module, so a
  missing or renamed chat feature never breaks this feature's own build or
  type-check. The published `BotChatSession` facade wires `chat`, `whisper`
  and `tabComplete` straight through to the allow-listed methods; caches
  `players`, `tablist`, `bossBars`, `scoreboards`, `teams` and
  `chatLengthLimit` (all required to read synchronously by that contract),
  refreshed on the real events that change them plus a light poll for
  `tablist`, which has none; and forwards `message`, `actionBar`, `title`,
  `title_times` and `title_clear` from the raw event stream. One honest
  simplification: the generic event serializer flattens a chat message to
  its plain text (see the `ChatMessage` special-case in `serialize()`), so
  the structured component tree never crosses this bridge and
  `IncomingChatMessage.component` is always `null` here — the plain text in
  `.raw`/`.plain` is not affected.

A future `mineflayer-inventory` or `mineflayer-world` feature has no
contract to discover yet. `getMineflayerRuntimeContract()` is the generic,
low-level typed contract for that case: every live bot's state, `call` for
any allow-listed method, and the raw `HostMessage` stream, with nothing chat-
or movement-specific baked in.

---

## Security

- No route from a connected server, a sibling feature, or anything else back
  to arbitrary code: the child process accepts exactly the commands in
  `HostCommand` and exactly the methods in `METHODS`, nothing else.
- The sentinel prefix means nothing the Minecraft server sends the bot —
  including chat text a malicious server crafted to look like JSON — can be
  parsed as a runtime protocol message; only lines this process itself wrote
  through `emit()` ever start with `@WDS-MINEFLAYER-1@`.
- A `mojang`-auth password never enters a saved profile, an export, a log
  line, or local history — only the operating system credential vault, read
  back only at the moment of connecting.
- This feature makes no outbound HTTP request of its own kind; the bot
  library's own network traffic is a direct Minecraft-protocol TCP socket
  (and, optionally, a user-configured SOCKS5 proxy), not something routed
  through `ctx.studio.http`.
- Every payload the runtime forwards — event payloads, method results — is
  depth-, key-, array- and string-length-bounded before it ever reaches the
  renderer, so a hostile or buggy server cannot use a crafted response to
  exhaust renderer memory.

---

## Verification

- `npx tsc --noEmit -p tsconfig.web.json` — clean for this feature's files.
- `npm run build` — the full renderer build succeeds; the `?raw` import of
  `bot-host.js` and the `import.meta.glob` sibling lookups resolve correctly.
- `node scripts/check-mineflayer-coverage.mjs` — every plugin file under
  `vendor/mineflayer/lib/plugins` is named by a row in
  `FEATURE_INVENTORY.md` section 15; the guard fails the moment a new
  upstream plugin lands without a home.
- Manual: connect to an offline-mode local server, observe live state
  populate, disconnect and reconnect (both manually and through the
  reconnect policy), save and delete a profile (including its vaulted
  password for a `mojang`-auth profile), watch the event inspector fill,
  pause it, search it, toggle high-frequency events on, and export the
  filtered log.
- Honest failure path: point the runtime at a build with no reachable
  `vendor/mineflayer` and confirm the *Bots* tab shows the exact
  `LIBRARY_NOT_FOUND` fault and every path that was searched, rather than a
  blank surface or a silent hang.

---

## Suggested related articles

- [Bot movement](./mineflayer-movement.md)
- [Bot chat](./mineflayer-chat.md)
- [Scraper bot](./bot.md) — a different, unrelated mineflayer-based surface: an external process, not a bot embedded in this feature
- [Auto-explore bot](./scraper-bot.md) — another external mineflayer-based process, also distinct from this feature
- [Settings](./settings.md) — where *Bot connection defaults* lives, and the credential vault this feature reads a `mojang`-auth password from
- [Version history](./history.md) — where every profile create/update/delete this feature records ends up
