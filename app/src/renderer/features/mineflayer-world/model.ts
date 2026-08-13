/**
 * Stable identifiers, shared types and small pure helpers for the block,
 * entity and world-ambience surface (inventory rows 15.10-15.17).
 *
 * Every id is prefixed with the feature id because setting ids are unique
 * across the whole application, not per feature, and a palette teleport needs
 * an element id that survives a re-render.
 */

export const FEATURE_ID = 'mineflayer-world';
export const TAB_ID = 'mineflayerWorld.panel';

/* ---------------- setting ids ---------------- */

export const ENTITY_POLL_MS_ID = 'mineflayerWorld.entityPollMs';
export const EVENT_FEED_LIMIT_ID = 'mineflayerWorld.eventFeedLimit';
export const CONFIRM_MOB_ATTACKS_ID = 'mineflayerWorld.confirmMobAttacks';
export const DEFAULT_FIND_DISTANCE_ID = 'mineflayerWorld.defaultFindDistance';
export const DEFAULT_FIND_COUNT_ID = 'mineflayerWorld.defaultFindCount';

export const DEFAULTS = {
  entityPollMs: 1500,
  eventFeedLimit: 300,
  confirmMobAttacks: false,
  defaultFindDistance: 32,
  defaultFindCount: 64
} as const;

/* ---------------- element ids the palette teleports to ---------------- */

export const STATUS_ELEMENT = 'mineflayer-world-status';
export const BLOCKS_ELEMENT = 'mineflayer-world-blocks';
export const FIND_BLOCKS_ELEMENT = 'mineflayer-world-find-blocks';
export const ENTITIES_ELEMENT = 'mineflayer-world-entities';
export const SURVIVAL_ELEMENT = 'mineflayer-world-survival';
export const BOOK_ELEMENT = 'mineflayer-world-book';
export const CREATIVE_ELEMENT = 'mineflayer-world-creative';
export const AMBIENCE_ELEMENT = 'mineflayer-world-ambience';
export const RESOURCE_PACK_ELEMENT = 'mineflayer-world-resourcepack';

/* ---------------- vocabulary read straight out of vendor/mineflayer ---------------- */

/** The six faces `placeBlock`/`placeEntity` accept, as unit vectors. `lib/plugins/generic_place.js`. */
export const FACE_OPTIONS: Array<{ value: string; label: string; vector: Vec3Like }> = [
  { value: 'top', label: 'Top (+Y)', vector: { x: 0, y: 1, z: 0 } },
  { value: 'bottom', label: 'Bottom (-Y)', vector: { x: 0, y: -1, z: 0 } },
  { value: 'north', label: 'North (-Z)', vector: { x: 0, y: 0, z: -1 } },
  { value: 'south', label: 'South (+Z)', vector: { x: 0, y: 0, z: 1 } },
  { value: 'west', label: 'West (-X)', vector: { x: -1, y: 0, z: 0 } },
  { value: 'east', label: 'East (+X)', vector: { x: 1, y: 0, z: 0 } }
];

/** Exactly `beds` in `lib/plugins/bed.js` — every real bed block name across every colour. */
export const BED_BLOCK_NAMES: string[] = [
  'white_bed', 'orange_bed', 'magenta_bed', 'light_blue_bed', 'yellow_bed', 'lime_bed', 'pink_bed', 'gray_bed',
  'light_gray_bed', 'cyan_bed', 'purple_bed', 'blue_bed', 'brown_bed', 'green_bed', 'red_bed', 'black_bed', 'bed'
];

/** A hand-picked, non-exhaustive set of common vanilla block names, offered as quick picks. */
export const COMMON_BLOCK_NAMES: string[] = [
  'stone', 'dirt', 'grass_block', 'oak_log', 'oak_planks', 'cobblestone', 'sand', 'gravel', 'water', 'lava',
  'coal_ore', 'iron_ore', 'diamond_ore', 'gold_ore', 'redstone_ore', 'chest', 'crafting_table', 'furnace',
  'torch', 'glass', 'obsidian', 'bedrock', 'oak_leaves', 'oak_door'
];

/** A hand-picked, non-exhaustive set of common vanilla item names, offered as quick picks for creative give. */
export const COMMON_ITEM_NAMES: string[] = [
  'diamond', 'iron_ingot', 'gold_ingot', 'oak_planks', 'torch', 'cobblestone', 'bread', 'apple', 'arrow', 'bow',
  'ender_pearl', 'totem_of_undying', 'diamond_sword', 'diamond_pickaxe', 'shield', 'water_bucket', 'flint_and_steel',
  'writable_book'
];

/* ---------------- geometry ---------------- */

export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

export function distance3(a: Vec3Like, b: Vec3Like): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function formatVec(v: Vec3Like | null): string {
  if (!v) return '—';
  return `${v.x.toFixed(1)}, ${v.y.toFixed(1)}, ${v.z.toFixed(1)}`;
}

export function formatBlockVec(v: Vec3Like | null): string {
  if (!v) return '—';
  return `${Math.floor(v.x)}, ${Math.floor(v.y)}, ${Math.floor(v.z)}`;
}

export function parseCoordinate(text: string): number | null {
  const value = Number(text.trim());
  return Number.isFinite(value) ? value : null;
}

/* ---------------- normalised value shapes this surface reads ---------------- */

export interface WorldBlock {
  name: string;
  displayName: string;
  type: number | null;
  position: Vec3Like | null;
  hardness: number | null;
  diggable: boolean | null;
  light: number | null;
  skyLight: number | null;
  stateId: number | null;
  properties: Record<string, unknown> | null;
}

export function normaliseBlock(raw: unknown): WorldBlock | null {
  if (!raw || typeof raw !== 'object') return null;
  const source = raw as Record<string, unknown>;
  const name = typeof source.name === 'string' ? source.name : null;
  if (!name) return null;
  return {
    name,
    displayName: typeof source.displayName === 'string' ? source.displayName : name,
    type: typeof source.type === 'number' ? source.type : null,
    position: normaliseVec(source.position),
    hardness: typeof source.hardness === 'number' ? source.hardness : null,
    diggable: typeof source.diggable === 'boolean' ? source.diggable : null,
    light: typeof source.light === 'number' ? source.light : null,
    skyLight: typeof source.skyLight === 'number' ? source.skyLight : null,
    stateId: typeof source.stateId === 'number' ? source.stateId : null,
    properties:
      source.properties && typeof source.properties === 'object'
        ? (source.properties as Record<string, unknown>)
        : null
  };
}

export function normaliseVec(raw: unknown): Vec3Like | null {
  if (!raw || typeof raw !== 'object') return null;
  const source = raw as Record<string, unknown>;
  const x = Number(source.x);
  const y = Number(source.y);
  const z = Number(source.z);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null;
  return { x, y, z };
}

export interface WorldItem {
  name: string;
  displayName: string;
  count: number;
  slot: number;
}

export function normaliseItem(raw: unknown): WorldItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const source = raw as Record<string, unknown>;
  const name = typeof source.name === 'string' ? source.name : null;
  if (!name) return null;
  return {
    name,
    displayName: typeof source.displayName === 'string' ? source.displayName : name,
    count: typeof source.count === 'number' ? source.count : 1,
    slot: typeof source.slot === 'number' ? source.slot : -1
  };
}

export interface WorldEntity {
  id: number;
  name: string;
  displayName: string;
  username: string | null;
  type: string;
  position: Vec3Like | null;
  health: number | null;
  onGround: boolean | null;
  equipment: WorldItem[];
}

export function normaliseEntity(raw: unknown): WorldEntity | null {
  if (!raw || typeof raw !== 'object') return null;
  const source = raw as Record<string, unknown>;
  const id = Number(source.id);
  if (!Number.isFinite(id)) return null;
  const name = typeof source.name === 'string' ? source.name : 'entity';
  return {
    id,
    name,
    displayName: typeof source.displayName === 'string' ? source.displayName : name,
    username: typeof source.username === 'string' && source.username.length > 0 ? source.username : null,
    type: typeof source.type === 'string' ? source.type : 'unknown',
    position: normaliseVec(source.position),
    health: typeof source.health === 'number' ? source.health : null,
    onGround: typeof source.onGround === 'boolean' ? source.onGround : null,
    equipment: Array.isArray(source.equipment)
      ? (source.equipment as unknown[]).map((item) => normaliseItem(item)).filter((item): item is WorldItem => item !== null)
      : []
  };
}

export interface WorldWindow {
  id: number | null;
  slots: WorldItem[];
}

export function normaliseWindow(raw: unknown): WorldWindow {
  if (!raw || typeof raw !== 'object') return { id: null, slots: [] };
  const source = raw as Record<string, unknown>;
  const slots = Array.isArray(source.slots)
    ? (source.slots as unknown[]).map((item) => normaliseItem(item)).filter((item): item is WorldItem => item !== null)
    : [];
  return { id: typeof source.id === 'number' ? source.id : null, slots };
}

/**
 * The live read-out this surface needs from `BotState` (`../mineflayer/protocol.ts`).
 *
 * Duck-typed rather than statically imported: this file never assumes the
 * `mineflayer` feature's internal shapes stay exactly as they are today, only
 * that a field with this name and type means what its name says.
 */
export interface WorldBotState {
  status: string;
  username: string | null;
  health: number | null;
  food: number | null;
  oxygenLevel: number | null;
  gameMode: string | null;
  dimension: string | null;
  position: Vec3Like | null;
  isSleeping: boolean | null;
  heldItem: WorldItem | null;
  timeOfDay: number | null;
  isDay: boolean | null;
  isRaining: boolean | null;
  thunderState: number | null;
}

export function normaliseState(raw: unknown): WorldBotState | null {
  if (!raw || typeof raw !== 'object') return null;
  const source = raw as Record<string, unknown>;
  return {
    status: typeof source.status === 'string' ? source.status : 'idle',
    username: typeof source.username === 'string' ? source.username : null,
    health: typeof source.health === 'number' ? source.health : null,
    food: typeof source.food === 'number' ? source.food : null,
    oxygenLevel: typeof source.oxygenLevel === 'number' ? source.oxygenLevel : null,
    gameMode: typeof source.gameMode === 'string' ? source.gameMode : null,
    dimension: typeof source.dimension === 'string' ? source.dimension : null,
    position: normaliseVec(source.position),
    isSleeping: typeof source.isSleeping === 'boolean' ? source.isSleeping : null,
    heldItem: normaliseItem(source.heldItem),
    timeOfDay: typeof source.timeOfDay === 'number' ? source.timeOfDay : null,
    isDay: typeof source.isDay === 'boolean' ? source.isDay : null,
    isRaining: typeof source.isRaining === 'boolean' ? source.isRaining : null,
    thunderState: typeof source.thunderState === 'number' ? source.thunderState : null
  };
}

export function isConnected(state: WorldBotState | null): boolean {
  return state !== null && (state.status === 'spawned' || state.status === 'connected');
}

/* ---------------- per-bot "a dig is in flight" guard ----------------
 *
 * Kept outside any single mounted panel: a keyboard submit or a second mount
 * of the same tab must never be able to start a second dig on top of one the
 * host is still awaiting. The disabled button is the visible guard; this map
 * is the real one.
 */
const diggingInFlight = new Set<string>();

export function isDiggingInFlight(botId: string): boolean {
  return diggingInFlight.has(botId);
}

export function setDiggingInFlight(botId: string, value: boolean): void {
  if (value) diggingInFlight.add(botId);
  else diggingInFlight.delete(botId);
}

let idCounter = 0;
export function nextRowId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter.toString(36)}`;
}

export function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}
