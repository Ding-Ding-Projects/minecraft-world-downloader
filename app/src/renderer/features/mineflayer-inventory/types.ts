/**
 * Shapes shared by every panel in this feature.
 *
 * `SerializedItem` and `SerializedWindow` mirror exactly what `serializeItem`
 * and `serializeWindow` in `../mineflayer/bot-host.js` emit — see that file's
 * `serializeItem`/`serializeWindow` functions. Nothing here invents a field
 * the runtime does not actually send.
 */

export interface SerializedItem {
  name: string;
  displayName: string;
  count: number;
  slot: number;
  type: number;
  metadata: number | null;
  durabilityUsed: number | null;
  maxDurability: number | null;
  enchants: Array<{ name?: string; lvl?: number } | unknown>;
}

export interface SerializedWindow {
  id: number;
  type: string;
  title: string;
  slotCount: number;
  inventoryStart: number | null;
  inventoryEnd: number | null;
  slots: Array<SerializedItem | null>;
}

/* -------------------------------------------------------------------- */
/* The player's own inventory window — a fixed, well-known layout        */
/* -------------------------------------------------------------------- */

/** `lib/plugins/inventory.js`: `bot.inventory = windows.createWindow(0, 'minecraft:inventory', ...)`. */
export const PLAYER_WINDOW_TYPE = 'minecraft:inventory';

export const CRAFT_RESULT_SLOT = 0;
/** The 2×2 personal crafting grid — `slot(x, y)` in `lib/plugins/craft.js` for the no-table path. */
export const CRAFT_GRID_SLOTS = [1, 2, 3, 4];
/** `armorSlots` in `lib/plugins/simple_inventory.js`. */
export const ARMOR_SLOTS: Array<{ slot: number; destination: 'head' | 'torso' | 'legs' | 'feet' }> = [
  { slot: 5, destination: 'head' },
  { slot: 6, destination: 'torso' },
  { slot: 7, destination: 'legs' },
  { slot: 8, destination: 'feet' }
];
export const MAIN_INVENTORY_START = 9;
export const MAIN_INVENTORY_COUNT = 27;
/** `QUICK_BAR_START` in `lib/plugins/simple_inventory.js`. */
export const HOTBAR_START = 36;
export const HOTBAR_COUNT = 9;
/** Present only when `!bot.supportFeature('doesntHaveOffHandSlot')`. */
export const OFFHAND_SLOT = 45;

/* -------------------------------------------------------------------- */
/* Workstation slot layouts — from the vendored plugin source            */
/* -------------------------------------------------------------------- */

/** `furnace.inputItem/fuelItem/outputItem` in `lib/plugins/furnace.js`. */
export const FURNACE_SLOTS = { input: 0, fuel: 1, output: 2 } as const;
/** `putSomething(0|1, ...)` and `putAway(2)` in `lib/plugins/anvil.js`. */
export const ANVIL_SLOTS = { itemOne: 0, itemTwo: 1, result: 2 } as const;
/** `targetItem()` (slot 0) and `putLapis` (slot 1) in `lib/plugins/enchantment_table.js`. */
export const ENCHANTMENT_SLOTS = { target: 0, lapis: 1 } as const;

export const FURNACE_BLOCK_NAMES = ['furnace', 'blast_furnace', 'smoker'];
export const ANVIL_BLOCK_NAMES = ['anvil', 'chipped_anvil', 'damaged_anvil'];
export const ENCHANTING_TABLE_BLOCK_NAMES = ['enchanting_table'];
export const CRAFTING_TABLE_BLOCK_NAMES = ['crafting_table'];

/** `allowedWindowTypes` in `lib/plugins/chest.js`, without the leading `minecraft:`. */
export const CONTAINER_BLOCK_NAMES = [
  'chest',
  'trapped_chest',
  'ender_chest',
  'barrel',
  'dispenser',
  'dropper',
  'hopper',
  'white_shulker_box',
  'orange_shulker_box',
  'magenta_shulker_box',
  'light_blue_shulker_box',
  'yellow_shulker_box',
  'lime_shulker_box',
  'pink_shulker_box',
  'gray_shulker_box',
  'light_gray_shulker_box',
  'cyan_shulker_box',
  'purple_shulker_box',
  'blue_shulker_box',
  'brown_shulker_box',
  'green_shulker_box',
  'red_shulker_box',
  'black_shulker_box',
  'shulker_box'
];

/* -------------------------------------------------------------------- */
/* Bundled recipe/item catalog                                          */
/* -------------------------------------------------------------------- */

export interface CatalogItem {
  name: string;
  displayName: string;
  stackSize: number;
}

export interface RecipeIngredient {
  name: string;
  count: number;
}

export interface RecipeVariant {
  requiresTable: boolean;
  resultCount: number;
  ingredients: RecipeIngredient[];
}

export interface RecipeCatalog {
  version: string;
  recipes: Record<string, RecipeVariant[]>;
}

/* -------------------------------------------------------------------- */
/* Click modes accepted by the `clickWindow` runtime method              */
/* -------------------------------------------------------------------- */

/** `Click Window` mode ids — https://wiki.vg/Protocol#Click_Window, `Window.js`'s `acceptClick`. */
export const CLICK_MODE = {
  pickupOrPlace: 0,
  shiftClick: 1,
  numberKey: 2,
  middleClick: 3,
  drop: 4
} as const;

export interface NearbyBlock {
  name: string;
  displayName: string;
  position: { x: number; y: number; z: number };
  distance: number;
}

export interface NearbyEntity {
  id: number;
  type: string;
  name: string;
  displayName: string;
  username: string | null;
  position: { x: number; y: number; z: number } | null;
  distance: number;
}
