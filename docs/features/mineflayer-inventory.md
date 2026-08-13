# Bot inventory, containers, crafting, workstations and villager trading

The player's own inventory as a real, moveable grid; every container window the vendored library
can open; a recipe browser checked against the real held items; the furnace family and the anvil
and enchanting table with their real item slots; and a real, live list of nearby villagers. Five
inventory-window rows sharing one visual language, because they are all the same Minecraft concept:
a grid of slots a bot can look at and move items between.

- **Feature id:** `mineflayer-inventory`
- **Destination:** *Bot inventory* (tabs: Inventory, Containers, Crafting, Workstations, Villager trading)
- **Command palette:** open, teleport to each tab, and the live control for the search-radius setting
- **Satisfies:** `FEATURE_INVENTORY.md` rows **15.5, 15.6, 15.7, 15.8, 15.9**

> **This article describes what actually ships, not an aspirational plan.** An earlier draft of
> this file described real furnace progress bars, real anvil repair costs, real enchanting-table
> offers, brewing stands, grindstones, and villager trading through `bot.openVillager`. None of
> that draft survived contact with the shared bot runtime's actual, current allow-listed method
> surface — see **What is honestly not built, and exactly why** below. This rewrite says what is
> real.

---

## Where the session comes from

This feature never opens its own bot connection. Every tab drives whichever bot the sibling
`mineflayer` feature has active, through `getMineflayerRuntimeContract()` in
`features/mineflayer/bridge.ts` — the generic, low-level contract that file documents as the route
for a sibling with no bespoke discovery contract of its own (see `session.ts`). Every real action
in this feature is one of that contract's allow-listed `call(botId, method, args)` invocations;
nothing here reaches into the `mineflayer` feature's internals.

Every tab renders three honest states: **no bot connected** (with a pointer to the Bots tab),
**bot connected but not yet spawned into the world** (naming the bot's real current status), and
**live**. Every control that needs a spawned bot stays visible and disabled with the exact reason,
rather than disappearing.

---

## Behaviour

### Inventory (row 15.5)

The bot's real 46/45-slot window — exactly the layout `lib/plugins/inventory.js` builds as
`bot.inventory` — rendered as a crafting grid (2×2 plus result), four armour slots, the 27-slot main
inventory, the 9-slot hotbar, and the off-hand slot when the connected server's version has one.

- **Move** by drag-and-drop, or by keyboard: select a slot with Enter/Space to pick it up, then
  select the destination the same way. Both routes call the real `moveSlotItem(source, dest)`.
- **Equip** to hand, off hand, head, chest, legs or feet — `bot.equip(item, destination)`, the exact
  `EquipmentDestination` union the library exposes.
- **Drop one** and **drop the stack** — `bot.toss(itemType, metadata, count)`. This matches by item
  *type* across the whole inventory range, not a specific slot, which the panel and its
  documentation both say plainly: it is the vendored library's own real behaviour, not a
  simplification invented here.
- **Quick-move** between the hotbar and the main inventory in one action — a real shift-click
  (`clickWindow(slot, 0, 1)`), exactly matching the real client.
- **Split a stack** into the first empty inventory slot — a right-click pickup followed by a
  left-click placement (`clickWindow(slot, 1, 0)` then `clickWindow(empty, 0, 0)`), the same two
  raw clicks the real client sends for a manual split.

Right-click on any slot is never intercepted, so this application's own **Edit appearance…** /
**Lock this element…** context menu keeps working on every slot.

### Containers (row 15.6)

Chest, dispenser, dropper, hopper, shulker box (all sixteen colours plus the uncoloured form),
ender chest, trapped chest and barrel — every block name `allowedWindowTypes` in
`lib/plugins/chest.js` accepts. **Nearby containers** is a real, populated list (the bot's own
`findBlocks` call, matched against those exact names), never a coordinate box to fill in by hand.
Opening one calls the shared runtime's `openContainerAt(position)` — the real `bot.openContainer` —
and shows its real slots beside the player's own inventory, both driven by the same picker so an
item can move between them by drag or by keyboard exactly like the Inventory tab.

- **Withdraw all** / **Deposit all** are real bulk actions: a reviewable dialog names every stack
  and the exact total item count before anything moves, then the panel shift-clicks
  (`clickWindow(slot, 0, 1)`) every occupied stack in turn and reports the honest result — *"11 of
  12 stacks moved"* — rather than assuming full success.
- A container that closes on its own (walked too far, another player took it, the server closed it)
  is noticed on the next refresh and reported, instead of continuing to show slots that no longer
  exist.

### Crafting (row 15.7)

Searchable by **result and ingredient at once**, against a bundled recipe/item catalog
(`data/items.ts`, `data/recipes.ts`) generated once, offline, from Minecraft Java Edition 1.21.8
using the real, vendored `prismarine-recipe`/`prismarine-registry` packages already in
`app/node_modules` — the actual `delta`/`requiresTable` algorithm those packages ship, not a
reimplementation of it. The catalog is keyed by item **name**, never by numeric id, because names
are stable across Minecraft versions and ids are not; every action this tab actually takes is
validated against the connected bot's own live server registry.

- **Craftability and every ingredient count shown are computed from the bot's real, live inventory
  snapshot**, refreshed on a timer and immediately after crafting. Nothing here claims something is
  craftable without checking real counts.
- **"How many to craft"** is the number of times the recipe runs, matching
  `bot.craft(recipe, count, craftingTable)`'s own `count` argument exactly (a repeat count, not a
  target quantity) — the card also shows the resulting item total so this is never ambiguous.
- When a recipe needs a table, the nearest real crafting table (found the same way containers are
  found, via `findBlocks`) is passed automatically.
- If more than one real recipe variant exists for an item, the bot crafts with whichever it finds
  it can complete at the moment you ask, which the card states plainly, so the actual outcome is
  never a surprise relative to the variant pictured.

### Workstations (row 15.8)

Furnace, blast furnace and smoker share one real window shape (input/fuel/output — exactly
`lib/plugins/furnace.js`'s slot 0/1/2); anvil and the enchanting table are their own real windows.
All three families are found the same way containers are (`findBlocks`) and opened through the
shared runtime's generic `openBlockAt(position)` — the real `bot.openBlock`. Every slot shown is
real, live server data, moved normally by drag or keyboard.

#### What is honestly not built, and exactly why

Live burn/cook percentage, the anvil's real repair cost, item renaming, and the enchanting table's
three real offers (their level requirement and cost) are **not shown, and not fabricated** — each
panel states plainly, in place of a number, that the data is not available yet, and names why:

- All four ultimately come from a Minecraft *window property* packet (historically named
  `craft_progress_bar`) that only starts flowing once the vendored library's own
  `bot.openFurnace` / `bot.openAnvil` / `bot.openEnchantmentTable` is called. The shared runtime's
  `openBlockAt` calls the generic `bot.openBlock` instead — it never calls any of those three
  plugin-specific openers, so that packet is never subscribed to and no data ever arrives.
- Renaming needs the anvil's custom-name channel (`name_item` / `MC|ItemName`); nothing in the
  shared runtime's allow-listed method list sends it.
- Choosing an enchantment needs the `enchant_item` packet
  (`enchantmentTable.enchant(choice)`); it is likewise not exposed.

**This is not a limitation of the vendored `mineflayer` library.** Every one of those calls exists,
real and working, in `vendor/mineflayer/lib/plugins/`. It is a gap in
`../mineflayer/bot-host.js`'s allow-listed method surface — a file this feature does not own and is
not permitted to edit (see **What would unblock this** below). Placing real items in the anvil's
first two slots, or in the enchanting table's item slot, still genuinely works: the server computes
the real result and it appears in the window on the tab's next refresh; a **Collect the result**
button on the anvil panel shift-clicks it into the inventory.

**Brewing stands and grindstones have no tab at all**, for a different and simpler reason: the
vendored `mineflayer` library itself ships no `brewing_stand.js` or `grindstone.js` plugin, so
there is no library capability to expose in the first place. (`vendor/mineflayer/lib/plugins/`
has 41 files; brewing and grindstone are not among them.)

### Villager trading (row 15.9)

This is the one row that genuinely cannot be built with the current shared runtime, and the tab
says so plainly instead of shipping a fake trade list. `bot.openVillager` needs `bot.openEntity`,
which opens a window at an **entity** — but the shared runtime's only window-opening methods,
`openContainerAt` and `openBlockAt`, both take a **block position**. There is no allow-listed way,
from this feature's own directory, to open a villager's window, read its real `trades` array, or
call `bot.trade`.

What *is* real on this tab: the nearby villager list, built from the bot's own live `entities()`
call filtered to villagers, with real positions and real distances computed from the bot's own real
position. Profession and level are not shown, because that data is not part of any currently
allow-listed method's response either.

---

## What would unblock this

Everything named above as unavailable needs new methods added to `../mineflayer/bot-host.js` (and
their types added to `../mineflayer/protocol.ts`) — files owned by the sibling `mineflayer`
feature, outside this feature's own directory:

| Gap | What would close it |
| --- | --- |
| Furnace fuel/cook progress | An `openFurnaceAt(position)` method that calls the real `bot.openFurnace` and forwards `fuel`/`progress`/`fuelSeconds`/`progressSeconds` as they update (or a poll-friendly `furnaceState(botId)` method) |
| Anvil repair cost and renaming | An `openAnvilAt(position)` that calls `bot.openAnvil`, plus `anvilCombine(itemOneSlot, itemTwoSlot, name)` / `anvilRename(slot, name)` methods that call the real `anvil.combine`/`anvil.rename`, with the real cost forwarded |
| Enchanting table's three offers | An `openEnchantmentTableAt(position)` that calls `bot.openEnchantmentTable` and forwards its three `{ level, expected }` offers, plus an `enchantSlot(choice)` method calling the real `enchantmentTable.enchant(choice)` |
| Villager trading | An `openVillagerAt(entityId)` method that calls the real `bot.openVillager`, forwarding its `trades` array, plus a `villagerTrade(index, count)` method calling the real `bot.trade` |

None of these are hypothetical: every underlying library call already exists, tested and real, in
`vendor/mineflayer/lib/plugins/furnace.js`, `anvil.js`, `enchantment_table.js` and `villager.js`.

---

## Configuration

All under **Settings → Bot inventory search**:

| Setting | Default | What it does |
| --- | --- | --- |
| Nearby search radius | 32 blocks | How far the Containers, Workstations and Villager trading tabs search for real nearby matches (`findBlocks`/`entities` filtered client-side) |
| Nearby result limit | 24 | The most nearby matches those searches list at once |
| Auto-refresh open windows | on | While a container or workstation is open, poll the bot for its real current contents every ~1.8 seconds instead of only refreshing after your own actions |

Every setting carries its own explanation, a truthful provenance line, and is reachable and
live-editable from the command palette.

---

## Failure modes

| Situation | What happens |
| --- | --- |
| No bot connected | Every tab shows an honest empty state pointing at the Bots tab |
| Bot connected but not yet spawned | Every tab shows an honest empty state naming the bot's real current status |
| `openContainerAt` / `openBlockAt` is refused (out of reach, wrong block, timeout) | The real runtime error is shown in a notification, verbatim |
| A move, equip, toss, quick-move or split is refused by the server | The real runtime error is shown in a notification, verbatim; the grid re-fetches the true current state rather than assuming the move happened |
| Withdraw-all / deposit-all partially fails | Reports the honest count — "*N* of *M* stacks moved" — never claims full success |
| A container or workstation closes on its own | Noticed on the next refresh; the panel returns to its closed/list state |
| A recipe search matches nothing in the bundled catalog | An honest empty state, not a blank panel |
| Crafting fails (missing ingredients discovered server-side, no table reachable, etc.) | The real runtime error is shown in a notification, verbatim |
| Furnace/anvil/enchanting live progress, cost or offers | Never fabricated — a plain capability note explains exactly why, every time the panel is open |
| Villager trading | Never fabricated — a plain capability note explains exactly why; the nearby list itself is still real |

---

## Security considerations

- **No network access of any kind.** This feature only calls allow-listed methods on the bot
  session the shared runtime hands it; it never makes an HTTP request and registers no outbound
  allow rule of its own.
- **No credentials pass through this surface.** Connection details and any stored secret belong
  entirely to the `mineflayer` feature; this feature never sees them.
- **Every write action is an explicit, validated, allow-listed method call.** There is no route from
  a connected server, a chat message, or a rendered slot back into arbitrary code — every RPC this
  feature makes (`moveSlotItem`, `equip`, `toss`, `clickWindow`, `craft`, `openContainerAt`,
  `openBlockAt`, `closeWindow`, `findBlocks`, `entities`, `inventory`, `currentWindow`) is one of a
  fixed, validated list in `../mineflayer/bot-host.js`; nothing here can ask the runtime to do
  anything outside that list.
- **The bundled recipe/item catalog is local, static data** — generated once offline from packages
  already vendored in this repository. Nothing about the recipe browser's search, browsing, or
  display ever touches the network.
- **Bulk actions are reviewed before they run.** Withdraw-all and deposit-all show every affected
  stack and the exact total count in a dialog before anything moves.

---

## Verification

- `npx tsc --noEmit -p tsconfig.web.json` — this feature's sixteen files compile clean.
- `node scripts/check-mineflayer-coverage.mjs` (repository root, not owned by this feature) —
  confirms every plugin in `vendor/mineflayer/lib/plugins` is named by a row in
  `FEATURE_INVENTORY.md` section 15, including the eight this feature covers
  (`inventory`, `simple_inventory`, `chest`, `craft`, `furnace`, `anvil`, `enchantment_table`,
  `villager`).
- Manual, with a real connected and spawned bot: move an item by drag, then move a different item
  by keyboard only (Enter to pick up, Enter to place); confirm both end up matching the server's
  real inventory on the next refresh.
- Manual: open a real nearby chest, withdraw all, and confirm the reported "*N* of *M* stacks
  moved" count matches what actually left the chest.
- Manual: search the recipe browser for an item whose only real recipe needs a table, with no table
  nearby; confirm it is shown as needing one rather than as craftable.
- Manual: open a real furnace and a real anvil; confirm the item slots are real and move correctly,
  and confirm the capability note is shown in place of a fabricated progress bar or cost.
- Manual: stand near a real villager; confirm it appears in the nearby list with a real distance,
  and confirm the capability note explains why trading is not available.

---

## Suggested related articles

- [Minecraft bots: connecting and live state](mineflayer.md) — the session and allow-listed method
  surface every action here is validated against.
- [Minecraft bots: the event inspector](mineflayer.md) — the honest catch-all for any bot capability
  without a purpose-built control, including window-related events this feature does not have a
  dedicated view for.
- [Bot movement](mineflayer-movement.md) — the sibling surface for piloting the same bot.
- [Bot chat](mineflayer-chat.md) — chat, whisper and pattern-matched rules for the same session.
- [Bot world query, block interaction and entities](mineflayer-world.md) — digging, placing,
  fishing, sleeping, book writing, creative mode and resource packs for the same bot.
