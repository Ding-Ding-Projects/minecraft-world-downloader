# Bot world query, block interaction, entities, fishing, books, creative mode, ambience and resource packs

Everything the vendored bot library knows about the world around it and can act on out there, rather
than inside a window: digging and placing, a target picker driven by ray tracing, block and
block-state lookup, the live entity list with attack and mount, fishing and sleeping, book writing,
creative-mode operations, the world's ambient state, and the server's resource-pack request.

- **Feature id:** `mineflayer-world`
- **Destination:** *Bot world* (tabs: Blocks, Entities, Fishing & sleep, Books, Creative, Ambience,
  Resource pack)
- **Command palette:** open, teleport to each tab, and the live control for every setting
- **Satisfies:** `FEATURE_INVENTORY.md` rows **15.10, 15.11, 15.12, 15.13, 15.14, 15.15, 15.16, 15.17**
- **Build status:** documented ahead of its App-side implementation, exactly as
  [Bot inventory, containers, crafting, workstations and villager trading](mineflayer-inventory.md)
  is — the sibling `mineflayer` runtime contract this feature drives through already exists and is
  documented in
  [Minecraft bots: connection, live state, profiles and the event inspector](mineflayer.md).

---

## Where the session comes from

Same discovery order every bot-driving sibling uses: the generic `getMineflayerRuntimeContract()`
from `features/mineflayer/bridge.ts` first (sufficient on its own, since every capability below is
an allow-listed `call()` plus the library's own events), then a feature-specific export if the
`mineflayer` feature later publishes one. The same three honest states — searching, unavailable
(every place searched listed), connected/disconnected — render on every tab, with every control
visible and disabled at "Requires a connected bot" rather than hidden.

---

## Behaviour

### Block interaction (row 15.10)

- **Dig**, with tool selection and real progress: `bot.dig(block)` from `lib/plugins/digging.js`,
  preceded by `bot.canDigBlock(block)` and `bot.digTime(block)` so the interface can show an honest
  progress bar computed from the library's own dig-time estimate rather than an arbitrary animation.
  `bot.targetDigBlock` and `bot.targetDigFace` report which block and face are currently targeted;
  `bot.stopDigging()` cancels a running dig. The control refuses re-entry while a dig is in flight —
  a second dig request on the same or a different block while one is running is rejected with "a dig
  is already in progress" rather than queued silently or allowed to race.
- **Place**: `bot.placeBlock(referenceBlock, faceVector)` (`lib/plugins/place_block.js`), which emits
  the real `blockPlaced` event with the old and new block once the server confirms it — the UI waits
  for that event before reporting success, never assuming a placement worked from the packet send
  alone.
- **Activate and use-on**: `bot._genericPlace` (`lib/plugins/generic_place.js`) backs both a block
  activation (right-clicking a lever, a door, a button) and using a held item on a block; `bot.useOn`
  (`lib/plugins/entities.js`) is the entity equivalent, listed here because the same target picker
  drives both.
- **Entity placement**: `bot.placeEntity(referenceBlock, faceVector)`
  (`lib/plugins/place_entity.js`) for placing an entity-holding item (a boat, a minecart, an armor
  stand item) — the same target-picker flow as block placement, emitting `entityPlaced` on
  confirmation.
- **Target picker**: driven by ray tracing rather than typed coordinates alone, using the same
  `blockAtCursor` / `entityAtCursor` route
  [Bot movement](mineflayer-movement.md) documents for its own ray-trace tab. Coordinates remain
  typeable as a fallback, but the picker is the primary, guided path — "assume the user does not
  know what to type" applies here exactly as it does to every other guided form in this project.
- **Block events surfaced live**: piston movement, chest-lid movement, note-block sounds and
  break-progress from other players/entities — `pistonMove`, `chestLidMove`, `noteHeard`,
  `blockBreakProgressObserved` / `blockBreakProgressEnd` from `lib/plugins/block_actions.js` — shown
  as a live feed rather than only reacting to the bot's own actions.

### World query (row 15.11)

- **Block lookup at a position**: `bot.blockAt(position)`.
- **Find-blocks by type within a radius**: `bot.findBlocks(options)` and `bot.findBlock(options)`
  from `lib/plugins/blocks.js`, results rendered as a rich list — the shared list contract this
  project uses everywhere: multi-select, an honestly-scoped select-all, bulk actions (teleport the
  view to a result, copy its coordinates, export the set), and the project's regex builder over the
  block-name filter.
- **Block-state inspector**: the block's registry metadata (name, hardness, harvest tools, light
  emission/opacity where the registry carries them) alongside its live NBT/state where the server has
  sent one, read from the same `Block` object `blockAt`/`findBlocks` return — never a second, separate
  fetch that could disagree with what is already known.
- **Sign text**: read from the block's sign data where present, and writable through
  `bot.updateSign(block, text)`, which itself refuses more than four lines or 45 characters per line
  before ever sending the packet, exactly as `lib/plugins/blocks.js` does — the same "reject before
  it reaches the library" pattern the allow-list uses everywhere else.

### Entities (row 15.12)

A live list of nearby entities — type, custom name where set, distance from the bot, health where the
entity reports it, and equipment for entities that carry any — refreshed from `bot.entities`
(`lib/plugins/entities.js`), which the library itself keeps current as entities spawn, move and
despawn. `bot.nearestEntity(match)` backs a "closest of type" quick-filter.

- **Attack**: `bot.attack(entity)`. **Gated when the target is a player** — attacking is a
  consequential action against another person, so the control requires the same confirmation this
  project's destructive-action gate uses elsewhere, naming the exact player before anything is sent.
  Attacking a non-player entity is not gated.
- **Mount and dismount**: `bot.mount(entity)`, `bot.dismount()`.
- **Use-on-entity**: `bot.useOn(entity)`.
- **Player/UUID lookup**: `bot.players`, `bot.uuidToUsername`, `bot.findPlayer(filter)` back a
  players-only view of the same list.

### Fishing, sleeping, waking, spawn point and respawn (row 15.13)

- **Fish**: `bot.fish()` (`lib/plugins/fishing.js`) — casts, waits for a bite, and reels in; the
  control reports the real outcome (caught / line broken / cancelled) rather than a fixed timer.
- **Sleep and wake**: `bot.sleep(bedBlock)` and `bot.wake()` (`lib/plugins/bed.js`), with
  `bot.isSleeping` reflecting the real state and `bot.isABed(block)` used to validate a target before
  attempting. **Sleep failures report the real reason the game gave** — `lib/plugins/bed.js` can fail
  a sleep attempt for reasons the server states explicitly (not night, monsters nearby, bed
  obstructed, too far away); the UI surfaces that exact server-given reason rather than a generic
  "could not sleep" message.
- **Spawn point**: `bot.spawnPoint` (`Vec3`, updated live by `lib/plugins/spawn_point.js` as the
  server sends spawn-point updates), and the `spawnReset` event fired on respawn, shown as a
  read-out with a "set here" affordance where the bot is standing near a bed.

### Book writing and signing (row 15.14)

A page editor over `bot.writeBook(slot, pages)` and `bot.signBook(slot, pages, author, title)`
(`lib/plugins/book.js`), showing the real character-per-page and page-count limits the protocol
enforces **before** either is hit — a page that would overflow is flagged inline as it is typed,
never discovered only after the write is attempted and rejected.

### Creative mode (row 15.15)

Clearly separated from every other tab, and **disabled with a stated reason when the server is not in
creative** (read from `bot.game.gameMode`, the same live game-mode field
[Bot connection](mineflayer.md) already documents for its own read-out):

- **Give item**: `bot.creative.setInventorySlot(slot, item)` from `lib/plugins/creative.js` — the
  library's real creative-inventory write, not a fabricated "give" command.
- **Fly**: `bot.creative.flyTo(position)`, `bot.creative.startFlying()`,
  `bot.creative.stopFlying()`.
- **Instant break**: creative-mode digging is the same `bot.dig(block)` call the Blocks tab uses;
  `bot.digTime(block)` already returns a near-zero duration in creative, so this tab's "instant
  break" toggle is presentation only (it skips showing a progress bar for a dig that will complete
  effectively immediately) rather than a second, different dig implementation.
- **Set block**: not a distinct library method — achieved through the same placement route (Blocks
  tab) which creative mode lets succeed regardless of held-item count, so this tab links to Blocks
  rather than duplicating a control that already exists.
- **Clear**: `bot.creative.clearSlot(slot)` and `bot.creative.clearInventory()`.

### World ambience (row 15.16)

Read-outs and, where the vendored library exposes a write, controls:

- **Time of day**: `bot.time.timeOfDay`, `.isDay`, `.moonPhase`, `.day`, updated on the library's own
  `time` event (`lib/plugins/time.js`).
- **Weather**: `bot.isRaining`, `.rainState`, `.thunderState`, updated on `rain` /
  `weatherUpdate` (`lib/plugins/rain.js`).
- **Sounds**: the `soundEffectHeard` / `hardcodedSoundEffectHeard` events (`lib/plugins/sound.js`)
  surfaced as a live, bulk-actionable, exportable list — sound name, position, volume, pitch — using
  the same list contract as the world-query results.
- **Particles**: the `particle` event (`lib/plugins/particle.js`), same list treatment.
- **Explosions**: `bot.getExplosionDamages(targetEntity, sourcePos, power)` from
  `lib/plugins/explosion.js`, letting the interface show the real computed damage an observed or
  hypothetical explosion would deal to a chosen entity.
- **Command-block editing**: `bot.setCommandBlock(position, command, options)`
  (`lib/plugins/command_block.js`) — only reachable when the bot has permission, and the control
  reports the server's own refusal verbatim when it does not.

### Resource packs (row 15.17)

The server's request surfaced honestly: the `resourcePack` event
(`lib/plugins/resource_pack.js`) carries the pack URL and hash, shown to the user with an accept and
a decline action wired to `bot.acceptResourcePack()` / `bot.denyResourcePack()`, and a plain
explanation of what each choice means (accepting downloads and applies the pack on the *server's*
expectation of the connected client; declining may itself get the bot kicked, depending on server
settings — stated plainly rather than hidden). **Never accepts on the user's behalf** — the request
sits until a person chooses, exactly as this project's destructive/consent-style prompts already
require elsewhere.

---

## Configuration

All under **Settings → Bot world**:

| Setting | Default | What it does |
| --- | --- | --- |
| Dig re-entry | Refuse | Whether a second dig request while one is running is refused (default) or queued after the first completes |
| Attack-a-player confirmation | on | Requires the confirmation gate before `bot.attack` targets a player |
| Ambience log limit | 500 entries | How many sound/particle/weather events are kept before the oldest drop |
| Fishing auto-recast | off | Automatically calls `bot.fish()` again after a successful catch |
| Resource-pack auto-response | Ask every time | Never auto-accepts or auto-declines; this option only controls whether the prompt re-shows for an identical repeated request in the same session |

Every setting carries its own explanation and a provenance line, and is reachable and live-editable
from the command palette.

---

## Failure modes

| Situation | What happens |
| --- | --- |
| No bot session available | Every tab's controls stay visible and disabled with "Requires a connected bot" |
| A dig is requested while one is already running | Refused with "a dig is already in progress" |
| `placeBlock` / `placeEntity` sends but the server never confirms | Reported as "placement not confirmed" after a timeout, rather than assumed successful |
| Sleep fails | The real server-given reason is shown verbatim, never a generic message |
| A book page would exceed the character or page limit | Flagged inline while typing, before any write is attempted |
| Creative action attempted outside creative mode | The whole Creative tab is disabled with "the server is not in creative mode" |
| Command-block edit refused by the server | The server's own refusal is shown verbatim |
| Resource-pack request arrives with no user response yet | The prompt persists (it is a decision, not a notification) until accepted or declined |

---

## Security considerations

- **No network access of any kind** beyond the bot's own game connection, which belongs to the
  `mineflayer` feature; this one only calls allow-listed methods on the session it is handed.
- **Attacking a player is gated** behind the same confirmation pattern this project uses for every
  other consequential action against another person's account or data.
- **A resource pack is never accepted automatically.** Auto-accept is not offered as an option,
  because a resource pack is server-supplied content the user should see named before it is used.
- **Command-block editing is only ever attempted, never assumed to succeed** — the server's own
  permission check is the real gate, and this feature adds no bypass of it.

---

## Verification

- `npx tsc --noEmit -p tsconfig.web.json` — this feature's files compile clean once written.
- Manual: with no `mineflayer` session module present, confirm every tab's controls stay visible and
  disabled with the exact reason.
- Manual: start a dig, then request a second dig before it finishes; confirm the refusal message.
- Manual: attempt to sleep with monsters nearby (a real in-game failure condition) and confirm the
  server's own reason is shown rather than a generic message.
- Manual: attempt an attack on a player entity and confirm the confirmation gate appears, naming that
  exact player, before anything is sent.
- Manual: write a book page past the character limit and confirm it is flagged before the write is
  attempted.
- Manual: leave the Creative tab open while not in creative mode and confirm every control is
  disabled with the stated reason.
- Manual: trigger a resource-pack request and confirm neither accept nor decline fires without an
  explicit user action.

---

## Suggested related articles

- [Minecraft bots: connection, live state, profiles and the event inspector](mineflayer.md) — the
  session and allow-list model every action here is validated against.
- [Bot inventory, containers, crafting, workstations and villager trading](mineflayer-inventory.md) —
  the window-based sibling surface for the same bot.
- [Bot movement: pad, look, ray tracing, walk and follow](mineflayer-movement.md) — the ray-trace
  target picker this feature's Blocks tab shares.
- [Bot chat](mineflayer-chat.md) — chat, whisper and pattern-matched rules for the same session.
