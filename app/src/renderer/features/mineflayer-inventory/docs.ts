import type { DocArticle } from '../../core/registry';
import { CATALOG_VERSION } from './data';

const INVENTORY = `
The Inventory tab shows the connected bot's real 46-slot window — the exact
one \`lib/plugins/inventory.js\` builds as \`bot.inventory\` — laid out the way
the game itself lays it out: a 2×2 crafting grid and its result, four armour
slots, the 27-slot main inventory, the 9-slot hotbar, and the off-hand slot
when the connected server's version has one.

## Moving items

Every slot is a real, focusable button. Two routes move an item, and both end
up calling the vendored library's own \`moveSlotItem\` (a pick-up click
followed by a place click, exactly what the real client does):

- **Drag and drop** — drag a filled slot onto another slot.
- **Keyboard** — press Enter or Space on a slot to pick it up (it visibly
  highlights), then press Enter or Space on the destination. Press the same
  slot again, or Escape, to put it back down without moving it.

Right-click is never intercepted by this tab, so this application's own
"Edit appearance…" and "Lock this element…" context menu keeps working on
every slot.

## Picked-item actions

Picking up a slot also opens a small action bar: equip it to a chosen
destination (hand, off hand, head, chest, legs, feet — \`bot.equip\`), drop one
or drop the whole stack (\`bot.toss\`, which matches by item type across the
inventory — see the note on the button), quick-move between the hotbar and
the main inventory in one step (a shift-click, exactly like the real client),
and split a stack in two into the first empty inventory slot.

## What refreshes it

The tab polls the bot's real inventory every couple of seconds while it is
open (turn this off in Settings → **Bot inventory search** → *Auto-refresh
open windows* if you would rather refresh manually), and refreshes
immediately after every action you take here.
`.trim();

const CONTAINERS = `
Chest, dispenser, dropper, hopper, shulker box, ender chest, trapped chest and
barrel — every block name \`allowedWindowTypes\` in \`lib/plugins/chest.js\`
accepts. The **Nearby containers** list is real data from the bot's own
\`findBlocks\` call, not a coordinate box you have to fill in by hand; open one
and its real slot contents load through the same generic window snapshot the
Inventory tab uses.

## Withdraw all / deposit all

Both are real bulk actions: a preview dialog names every stack and the exact
total item count before anything moves, and the action itself is a shift-click
per occupied stack — precisely how withdrawing or depositing everything works
in the real client. The result is reported honestly (*"11 of 12 stacks
moved"*) rather than assumed to have fully succeeded.

## Closing

A container can close on its own — you walked too far away, another player
took it, the server closed it — and the tab notices this on its next refresh
and says so, rather than continuing to show slots that no longer exist.
`.trim();

const CRAFTING = `
The recipe browser is searchable by **result** and by **ingredient** at once —
type "diamond" and you will find both the diamond entry and every recipe that
*uses* a diamond. That search runs entirely against a bundled catalog built
from Minecraft Java Edition ${CATALOG_VERSION}, generated once, offline, using
the real \`prismarine-recipe\`/\`prismarine-registry\` packages already
vendored in this application — the actual delta and requires-table
computation those packages ship, not a re-implementation of it. Nothing about
the recipe browser touches the network.

Recipes are keyed by item **name**, not by Minecraft's numeric item ids —
those ids are not stable across game versions, but names are, and every
action this tab actually takes is validated against the connected bot's own,
real, live server registry.

## What is checked for real

Every "craftable right now", every ingredient count and shortfall, is
computed from the bot's actual, live inventory snapshot, refreshed on a
timer and immediately after crafting. Nothing here ever claims something is
craftable without checking real counts.

## Crafting

"How many to craft" is the number of times the recipe runs — matching
\`bot.craft(recipe, count, craftingTable)\`'s own \`count\` argument exactly —
not a target quantity, which is why the card also shows the resulting item
total. When a recipe needs a table, the nearest real crafting table (found the
same way containers are found) is passed along automatically. If more than one
real recipe variant exists for an item, the bot crafts with whichever one it
finds it can complete at the moment you ask — which the card says plainly, so
the result is never a surprise.
`.trim();

const WORKSTATIONS = `
Furnace, blast furnace and smoker share one real window shape — three slots:
input, fuel, output — exactly as \`lib/plugins/furnace.js\` lays it out; the
anvil and the enchanting table are their own real windows, opened the same
way. Every one of them opens through the shared bot runtime's generic
\`openBlockAt\`, which is the real \`bot.openBlock\` under the hood, and every
slot shown is real, live server data that moves normally by drag or keyboard,
exactly like the Inventory and Containers tabs.

## What is honestly not shown here, and why

Live burn/cook percentage, the anvil's real repair cost, renaming, and the
enchanting table's three real offers are **not fabricated** on this tab —
they are not shown at all, with a plain note in their place, because none of
that data is currently available:

- All four come from a Minecraft *window property* packet
  (historically \`craft_progress_bar\`) that only starts flowing once the
  library's own \`bot.openFurnace\` / \`bot.openAnvil\` /
  \`bot.openEnchantmentTable\` is called — and the shared runtime's
  \`openBlockAt\` calls the generic \`bot.openBlock\` instead, so that packet is
  never subscribed to.
- Renaming needs the anvil's custom-name channel
  (\`name_item\`/\`MC|ItemName\`), which nothing in the shared runtime's
  method list sends.
- Choosing an enchantment needs the \`enchant_item\` packet
  (\`enchantmentTable.enchant(choice)\`), which is likewise not exposed.

None of this is a limitation of the vendored \`mineflayer\` library — every one
of those calls exists in \`vendor/mineflayer/lib/plugins/\`. It is a gap in
\`../mineflayer/bot-host.js\`'s allow-listed method surface, which this
feature does not own and cannot edit. Placing real items in the anvil's first
two slots or the enchanting table's item slot still genuinely works — the
server computes the real result and it appears in the window the next time
this tab refreshes.

Brewing stands and grindstones have no tab here at all, for a different
reason: the vendored \`mineflayer\` library itself ships no
\`brewing_stand.js\` or \`grindstone.js\` plugin, so there is no library
capability to expose in the first place.
`.trim();

const VILLAGERS = `
Villager trading is the one row in this feature that genuinely cannot be
built yet, and this tab says so plainly rather than shipping a fake trade
list. \`bot.openVillager\` needs \`bot.openEntity\`, which opens a window at an
**entity** — but the shared bot runtime's only window-opening methods,
\`openContainerAt\` and \`openBlockAt\`, both take a **block position**. There
is no allow-listed way to open a villager's window, read its real
\`trades\` array, or call \`bot.trade\` from this feature's own directory.

## What is real on this tab

The nearby villager list is genuine: it comes straight from the bot's own
live \`entities()\` call, filtered to villagers, with real distances computed
from the bot's own real position. Profession and level are not shown because
that data is not part of any currently-allowed method's response either.

## What would unblock it

An \`openVillagerAt(entityId)\` runtime method (calling the real
\`bot.openVillager\`), forwarding its \`trades\` array, and a
\`villagerTrade(index, count)\` method (calling the real \`bot.trade\`) — all in
\`../mineflayer/bot-host.js\` and \`../mineflayer/protocol.ts\`, which belong to
the \`mineflayer\` feature, not this one.
`.trim();

export const MINEFLAYER_INVENTORY_DOCS: DocArticle[] = [
  {
    id: 'mineflayerInventory.inventory',
    title: 'Bot inventory: the real slots, dragged or keyed around',
    category: 'Bot inventory',
    body: INVENTORY,
    related: ['mineflayerInventory.containers', 'mineflayerInventory.crafting', 'mineflayer.overview']
  },
  {
    id: 'mineflayerInventory.containers',
    title: 'Containers: chests, hoppers, shulkers and their bulk actions',
    category: 'Bot inventory',
    body: CONTAINERS,
    related: ['mineflayerInventory.inventory', 'mineflayerInventory.workstations']
  },
  {
    id: 'mineflayerInventory.crafting',
    title: 'Crafting: searching, checking and making recipes for real',
    category: 'Bot inventory',
    body: CRAFTING,
    related: ['mineflayerInventory.inventory', 'mineflayerInventory.workstations']
  },
  {
    id: 'mineflayerInventory.workstations',
    title: 'Workstations: furnace, anvil, enchanting table — and their honest gaps',
    category: 'Bot inventory',
    body: WORKSTATIONS,
    related: ['mineflayerInventory.crafting', 'mineflayerInventory.villagers']
  },
  {
    id: 'mineflayerInventory.villagers',
    title: 'Villager trading: why it is not built yet, and what would unblock it',
    category: 'Bot inventory',
    body: VILLAGERS,
    related: ['mineflayerInventory.workstations', 'mineflayer.overview']
  }
];
