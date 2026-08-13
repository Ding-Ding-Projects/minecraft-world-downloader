# Bot inventory, containers, crafting, workstations and villager trading

The player's own inventory as a grid, every container window the vendored library can open, a
recipe browser checked against the real held items, and the workstations — furnace family, anvil,
enchanting table, brewing, grindstone — each with their real slots, progress and fuel state, plus
villager trading. Five inventory-window rows sharing one visual language, because they are all the
same Minecraft concept: a grid of slots a bot can look at and move items between.

- **Feature id:** `mineflayer-inventory`
- **Destination:** *Bot inventory* (tabs: Inventory, Containers, Crafting, Workstations, Trading)
- **Command palette:** open, teleport to each tab, and the live control for every setting
- **Satisfies:** `FEATURE_INVENTORY.md` rows **15.5, 15.6, 15.7, 15.8, 15.9**
- **Build status:** the sibling connection feature (`mineflayer`) and its typed runtime contract
  (`bridge.ts`, `getMineflayerRuntimeContract()`) exist and are documented in
  [Minecraft bots: connection, live state, profiles and the event inspector](mineflayer.md).
  `mineflayer.md` names this feature explicitly as one of two siblings with "no contract to
  discover yet" — this article specifies the contract this feature is to discover and drive,
  ahead of the code that implements it, exactly as `mineflayer-movement.md` and
  `mineflayer-chat.md` did before those two shipped.

---

## Where the session comes from

Like every other bot-driving feature, this one never opens its own connection. At boot it looks for
a session it can drive, in this order:

1. The generic typed contract, `getMineflayerRuntimeContract()` from `features/mineflayer/bridge.ts`
   — every live bot's state, `call(botId, method, args)` for any allow-listed method, and the raw
   `HostMessage` stream. This is the fallback contract `mineflayer.md` names as available to any
   future sibling with nothing chat- or movement-specific baked in, and it is sufficient on its own:
   every capability below is reachable purely through allow-listed `call()` invocations and the
   `windowOpen` / `windowClose` / `updateSlot` events the vendored library already emits.
2. A richer, feature-specific export — `inventorySession`, `getInventorySession`, or a multi-bot
   `sessionHost` — if the `mineflayer` feature later publishes one, exactly as `mineflayer-movement`
   found `sessionHost` ahead of the generic contract.

Three states render honestly and distinctly, matching the pattern every bot-driving sibling uses:
**searching**, **unavailable** (every place searched is listed on screen), and
**connected/disconnected**. Every control stays visible and disabled with the exact reason
"Requires a connected bot" rather than disappearing.

---

## Behaviour

### Inventory (row 15.5)

The real window contents rendered as a grid — 36 main-inventory slots plus the four armor slots and
off-hand, exactly the layout `lib/plugins/inventory.js` builds as `bot.inventory` (window id `0`,
type `minecraft:inventory`). Each slot shows the item's icon (from bundled resources; no remote
texture fetch — the same rule the sibling `mineflayer-chat` and `mineflayer-movement` articles
already state for this project), stack count, and durability where the item has any.

- **Move** by drag or by a keyboard equivalent (select a slot, arrow to the destination, Enter to
  move): both drive `bot.moveSlotItem(sourceSlot, destSlot)`.
- **Split and merge stacks**: split opens a count picker before calling `moveSlotItem` with a
  clicked slot's item halved by the same mouse-drag semantics the protocol expects; merge drags one
  stack onto another of the same item.
- **Equip to a specific slot**: `bot.equip(item, destination)` where `destination` is one of
  `'hand' | 'off-hand' | 'head' | 'torso' | 'legs' | 'feet'`, matching the vendored library's own
  `EquipmentDestination` union.
- **Drop and drop-stack**: `bot.tossStack(item)` for the whole stack, `bot.toss(itemType, metadata,
  count)` for a partial amount — both wired to the library's real toss packets, never a simulated
  removal.
- **Quick-move** (shift-click equivalent): moves a clicked slot's contents to the first available
  complementary location — inventory to an open container, or container to inventory — using the
  same slot arithmetic `inventory.js`'s own `putSelectedItemRange` helpers use.

Every slot change is driven by the real `updateSlot:<n>` event `bot.inventory` and `bot.currentWindow`
emit; nothing here predicts or simulates a slot's contents ahead of the server's own packet.

### Containers (row 15.6)

Chest, dispenser, dropper, hopper, shulker box, ender chest and barrel, opened through
`bot.openContainer(block, direction, cursorPos)` — the one function `lib/plugins/chest.js` aliases as
`bot.openChest`, `bot.openDispenser`, and which every other container type in this list also resolves
to, since the protocol represents them all as the same generic container window. Opening one renders
its slots exactly like the inventory grid, side by side with the player's own inventory (the window
the library hands back already includes both), and closing it calls `window.close()`, which the
library turns into the real `CLOSE_WINDOW` packet.

- **Browse and transfer**: drag or the keyboard equivalent between the container's slots and the
  player's own, using the same `moveSlotItem` route as the inventory tab.
- **Withdraw-all and deposit-all** are bulk actions: an exact preflight count ("12 items across 4
  slots will move to your inventory"), then one `moveSlotItem` call per affected slot, reporting a
  partial result honestly if the destination runs out of room partway through — never claiming a
  full transfer that did not finish.

### Crafting (row 15.7)

A recipe browser searchable by result item and by ingredient (wired to this project's regex
builder for the search field, per the shared search-bar contract), backed by
`bot.recipesFor(itemType, metadata, minResultCount, craftingTable)` and `bot.recipesAll(itemType,
metadata, craftingTable)` — the real recipe-matching functions `lib/plugins/craft.js` exposes, run
twice per query: once with `craftingTable: null` for what a 2×2 personal grid can make, and once
against a real, nearby crafting-table block for what needs one. A recipe the current inventory
cannot satisfy is shown but marked **missing** with the exact ingredients and counts still needed —
computed from the recipe's own `delta` array against the live inventory contents, never asserted
without checking.

Crafting itself calls `bot.craft(recipe, count, craftingTable)`, which is the library's own
multi-step craft (it repeats the recipe up to `count` times, moving materials in and results out).
A craft that runs out of materials partway stops there and reports how many completed, rather than
claiming the full requested count.

### Workstations (row 15.8)

Furnace, blast furnace and smoker (one shared window, opened by `bot.openFurnace(block)` from
`lib/plugins/furnace.js`), anvil (`bot.openAnvil(block)`, `lib/plugins/anvil.js`), enchanting table
(`bot.openEnchantmentTable(block)`, `lib/plugins/enchantment_table.js`), brewing stand, and
grindstone — every one rendered with its real slot layout, its real progress bars, and its real fuel
state, read from the window object the library hands back rather than drawn from a static template:

- **Furnace family**: input, fuel and output slots, `furnace.fuel` (0–1), `furnace.progress` (0–1)
  and the real burn-time countdown the window exposes as it updates on each `updateSlot` /
  `windowUpdate` event.
- **Anvil**: the two input slots, the rename text field wired straight to the protocol's rename
  string, and the resulting item with its real computed repair cost shown before confirming, taken
  from the window's own state rather than calculated locally.
- **Enchanting table**: the three enchantment options with their real cost (in levels) and the real
  minimum enchanting level the table currently offers, exactly as `openEnchantmentTable`'s window
  reports them — never a guessed cost, because the actual number depends on the table's nearby
  bookshelves and the server's own randomness seed.
- **Brewing and grindstone**: the same real-slots-and-progress treatment, using whichever generic
  container window the protocol assigns them (both are ordinary container windows at the protocol
  level, distinguished only by their `inventoryType`).

### Villager trading (row 15.9)

`bot.openVillager(entity)` from `lib/plugins/villager.js` opens the trade window and returns the
villager's real trade list: for each trade, its input item(s), output item, uses remaining, whether
it is disabled, and the villager's profession and level, read directly from the window object rather
than inferred. A trade whose "uses remaining" has hit zero, or that the villager has otherwise
disabled, is shown greyed out with the exact reason ("no uses remaining" / "trade disabled"), and
attempting it is refused before any packet is sent rather than silently failing on the server.

---

## Configuration

All under **Settings → Bot inventory**:

| Setting | Default | What it does |
| --- | --- | --- |
| Quick-move confirmation | off | Asks before a quick-move that would fill the destination's last slot |
| Withdraw/deposit-all preview | on | Shows the exact slot-and-count preview before a bulk container transfer |
| Recipe search scope | Result and ingredients | Whether the crafting search matches only the result item or ingredients too |
| Show recipes needing a table | on | Includes recipes that need a nearby crafting table, not only the 2×2 grid |
| Container window timeout | 10 s | How long to wait for the server's window-open packet before reporting failure |
| Item icon set | Bundled resources | Local icon set used for every slot; never fetched over the network |

Every setting carries its own explanation and a provenance line, and is reachable and live-editable
from the command palette.

---

## Failure modes

| Situation | What happens |
| --- | --- |
| No bot session available | Every tab's controls stay visible and disabled with "Requires a connected bot" |
| `openContainer` / `openFurnace` / `openAnvil` / `openEnchantmentTable` / `openVillager` times out | The window does not open; the exact timeout and the block or entity attempted are reported |
| A quick-move or withdraw-all cannot fit everything | The transfer stops at the first full destination slot and reports exactly how many items moved and how many did not |
| A craft runs out of materials mid-batch | Reports the real completed count against the requested count, never claiming the full batch |
| A trade's uses run out mid-session | The trade greys out immediately on the next window update; an in-flight attempt is refused with the real reason |
| An enchantment or anvil cost cannot be read from the window | The action is disabled with "the server has not reported a cost yet" rather than guessing one |
| The window closes unexpectedly (block broken, entity moved away, server-side close) | The tab returns to its closed state and logs the real `windowClose` reason where the library provides one |

---

## Security considerations

- **No network access of any kind.** This feature only calls allow-listed methods on the bot session
  it is handed; it never makes an HTTP request and registers no allow-rule of its own.
- **No credentials pass through this surface.** Connection details belong to the `mineflayer`
  feature.
- **Every write action is an explicit, logged, allow-listed method call.** There is no route from a
  connected server or a rendered slot back into arbitrary code — `bot.moveSlotItem`,
  `bot.equip`, `bot.craft`, `bot.tossStack` and the workstation openers are the entire allow-listed
  surface this feature uses, each validated by its own `run` function in `bot-host.js` before it
  ever reaches the library, per the allow-list model `mineflayer.md` documents.
- **Bulk destructive actions are gated.** Bulk drop and bulk withdraw-all/deposit-all name the exact
  items and counts affected before anything moves.

---

## Verification

- `npx tsc --noEmit -p tsconfig.web.json` — this feature's files compile clean once written.
- Manual: with no `mineflayer` session module present, confirm every tab's controls stay visible and
  disabled with the exact reason.
- Manual: open a chest, withdraw-all with the destination inventory nearly full, and confirm the
  reported count matches what actually moved.
- Manual: search the recipe browser for an item craftable only with a table, and confirm it is
  listed as needing one rather than as immediately craftable.
- Manual: open a villager with a trade whose uses have run out, and confirm it renders disabled with
  the reason rather than accepting an attempt.
- Manual: open an anvil, rename an item, and confirm the shown repair cost matches the window's own
  reported value rather than a locally computed guess.

---

## Suggested related articles

- [Minecraft bots: connection, live state, profiles and the event inspector](mineflayer.md) — the
  session and allow-list model every inventory action here is validated against.
- [Bot movement: pad, look, ray tracing, walk and follow](mineflayer-movement.md) — the sibling
  surface for piloting the same bot.
- [Bot chat](mineflayer-chat.md) — chat, whisper and pattern-matched rules for the same session.
- [Bot world query, block interaction and entities](mineflayer-world.md) — digging, placing,
  fishing, sleeping, book writing, creative mode and resource packs for the same bot.
