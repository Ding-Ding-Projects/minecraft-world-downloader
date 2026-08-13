'use strict';

/*
 * The bot runtime.
 *
 * This file is not part of the renderer bundle's executable code. It is
 * imported as raw text, written into the application's own data directory and
 * run by `node` through the privileged process bridge, because the bot library
 * opens TCP sockets and reads the Minecraft protocol — neither of which the
 * renderer can do.
 *
 * It owns every bot instance and exposes exactly three things: connect,
 * disconnect, and call one of a fixed list of methods with validated arguments.
 * There is deliberately no eval channel, no `require` channel and no way to
 * reach a method that is not on the list below, because a renderer that can ask
 * a Node process to run arbitrary code is a renderer with Node access.
 *
 * Protocol: newline-delimited JSON both ways. Commands arrive on stdin; every
 * message this file writes to stdout is prefixed with a sentinel, so a runtime
 * warning printed on the same stream can never be parsed as a message.
 *
 * Every library name used here was read out of the vendored source at
 * `vendor/mineflayer` — `index.d.ts`, `docs/api.md`, `lib/loader.js` and
 * `lib/version.js`.
 */

const path = require('node:path');
const fs = require('node:fs');
const readline = require('node:readline');

const PROTOCOL = 1;
const SENTINEL = '@WDS-MINEFLAYER-1@';

/** Hard ceilings. A chatty server must not be able to flood the renderer. */
const MAX_EVENTS_PER_SECOND = 200;
const MAX_PAYLOAD_DEPTH = 4;
const MAX_PAYLOAD_KEYS = 40;
const MAX_PAYLOAD_ARRAY = 24;
const MAX_STRING_LENGTH = 600;
const MAX_BOTS = 8;
const MAX_LOG_LENGTH = 2000;

/* ------------------------------------------------------------------ */
/* Output                                                              */
/* ------------------------------------------------------------------ */

function emit(message) {
  let line;
  try {
    line = JSON.stringify(message);
  } catch (error) {
    line = JSON.stringify({
      type: 'fault',
      message: 'A message could not be serialized: ' + String((error && error.message) || error),
      at: Date.now()
    });
  }
  process.stdout.write(SENTINEL + line + '\n');
}

function reply(id, value) {
  emit({ type: 'reply', id: id, ok: true, value: value === undefined ? null : value });
}

function replyError(id, error, code) {
  emit({
    type: 'reply',
    id: id,
    ok: false,
    error: describe(error),
    code: code || (error && typeof error.code === 'string' ? error.code : undefined)
  });
}

function describe(error) {
  if (error instanceof Error) return error.message || error.name;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

/*
 * The library and its dependencies print to the console: the Microsoft
 * device-sign-in code is the important one. Forward what was printed rather
 * than letting it vanish into a stream nobody reads.
 */
function interceptConsole() {
  const levels = ['log', 'info', 'warn', 'error'];
  for (const level of levels) {
    const original = console[level].bind(console);
    console[level] = function (...args) {
      let text;
      try {
        text = args
          .map((value) => (typeof value === 'string' ? value : describe(value)))
          .join(' ');
      } catch {
        text = '(unprintable console output)';
      }
      if (text.length > MAX_LOG_LENGTH) text = text.slice(0, MAX_LOG_LENGTH) + '…';
      emit({ type: 'log', level: level, text: text, at: Date.now() });
      if (level === 'error' || level === 'warn') original(...args);
    };
  }
}

/* ------------------------------------------------------------------ */
/* Resolving the library                                               */
/* ------------------------------------------------------------------ */

/**
 * Finds the bot library.
 *
 * A plain `require('mineflayer')` resolves relative to *this* file, which lives
 * in the application data directory and has no `node_modules` beside it. So the
 * candidate roots are tried in order and every one of them is remembered, so a
 * failure can name exactly what was looked for instead of saying "not found".
 */
function resolveLibrary(extraRoots) {
  const attempted = [];
  const candidates = [];

  const push = (root) => {
    if (typeof root !== 'string' || root.length === 0) return;
    const resolved = path.resolve(root);
    if (!candidates.includes(resolved)) candidates.push(resolved);
  };

  for (const root of extraRoots) push(root);

  // Walk up from the working directory the parent process handed down.
  let directory = process.cwd();
  for (let depth = 0; depth < 8; depth += 1) {
    push(directory);
    const parent = path.dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }

  // And up from this script, in case it was placed inside a project tree.
  push(__dirname);

  for (const root of candidates) {
    for (const suffix of ['node_modules/mineflayer', 'app/node_modules/mineflayer']) {
      const target = path.join(root, suffix);
      attempted.push(target);
      try {
        if (!fs.existsSync(path.join(target, 'package.json'))) continue;
        const library = require(target);
        const manifest = JSON.parse(fs.readFileSync(path.join(target, 'package.json'), 'utf8'));
        return { library: library, version: manifest.version, path: target, attempted: attempted };
      } catch (error) {
        attempted.push('  ↳ ' + describe(error));
      }
    }
  }

  // Last resort: the ordinary resolver, which works when the host was placed
  // somewhere the library is genuinely reachable from.
  try {
    attempted.push("require('mineflayer') from " + __dirname);
    const library = require('mineflayer');
    return {
      library: library,
      version: (library && library.version) || 'unknown',
      path: 'resolved by node',
      attempted: attempted
    };
  } catch (error) {
    attempted.push('  ↳ ' + describe(error));
  }

  const failure = new Error(
    'The bot library could not be found. Paths tried:\n' + attempted.join('\n')
  );
  failure.code = 'LIBRARY_NOT_FOUND';
  throw failure;
}

/* ------------------------------------------------------------------ */
/* Bounded serialization                                               */
/* ------------------------------------------------------------------ */

/**
 * Turns any library value into something safe to send.
 *
 * The library's objects are cyclic (an entity holds the bot, which holds the
 * entities), enormous (a chunk column) and full of Buffers. Everything is
 * bounded here: depth, key count, array length and string length, with the
 * truncation stated in the value rather than hidden.
 */
function serialize(value, depth) {
  const level = depth || 0;
  if (value === null || value === undefined) return null;
  const kind = typeof value;
  if (kind === 'number') return Number.isFinite(value) ? value : String(value);
  if (kind === 'boolean') return value;
  if (kind === 'bigint') return value.toString();
  if (kind === 'string') {
    return value.length > MAX_STRING_LENGTH
      ? value.slice(0, MAX_STRING_LENGTH) + '… (' + value.length + ' characters)'
      : value;
  }
  if (kind === 'function') return '[function ' + (value.name || 'anonymous') + ']';
  if (kind === 'symbol') return String(value);
  if (Buffer.isBuffer(value)) return '[' + value.length + ' bytes]';
  if (value instanceof Error) return { error: value.message, name: value.name };
  if (level >= MAX_PAYLOAD_DEPTH) return '[depth limit reached]';

  if (Array.isArray(value)) {
    const out = value.slice(0, MAX_PAYLOAD_ARRAY).map((item) => serialize(item, level + 1));
    if (value.length > MAX_PAYLOAD_ARRAY) {
      out.push('… ' + (value.length - MAX_PAYLOAD_ARRAY) + ' more of ' + value.length);
    }
    return out;
  }

  if (kind === 'object') {
    // Known shapes get a readable form rather than a wall of internals.
    if (typeof value.x === 'number' && typeof value.y === 'number' && typeof value.z === 'number' &&
      Object.keys(value).length <= 4) {
      return { x: value.x, y: value.y, z: value.z };
    }
    if (typeof value.toString === 'function' && value.constructor && value.constructor.name === 'ChatMessage') {
      try {
        return { text: serialize(value.toString(), level + 1) };
      } catch {
        /* fall through to the generic path */
      }
    }
    const out = {};
    let count = 0;
    for (const key of Object.keys(value)) {
      if (key.startsWith('_')) continue;
      if (count >= MAX_PAYLOAD_KEYS) {
        out['…'] = 'more keys omitted';
        break;
      }
      let child;
      try {
        child = value[key];
      } catch {
        continue;
      }
      out[key] = serialize(child, level + 1);
      count += 1;
    }
    return out;
  }

  return String(value);
}

function serializeVec3(vec) {
  if (!vec || typeof vec.x !== 'number') return null;
  return { x: vec.x, y: vec.y, z: vec.z };
}

function serializeItem(item) {
  if (!item) return null;
  return {
    name: item.name,
    displayName: item.displayName,
    count: item.count,
    slot: item.slot,
    type: item.type,
    metadata: item.metadata === undefined ? null : item.metadata,
    durabilityUsed: item.durabilityUsed === undefined ? null : item.durabilityUsed,
    maxDurability: item.maxDurability === undefined ? null : item.maxDurability,
    enchants: Array.isArray(item.enchants) ? item.enchants.slice(0, MAX_PAYLOAD_ARRAY) : []
  };
}

function serializeBlock(block) {
  if (!block) return null;
  return {
    name: block.name,
    displayName: block.displayName,
    type: block.type,
    position: serializeVec3(block.position),
    hardness: block.hardness === undefined ? null : block.hardness,
    diggable: block.diggable === undefined ? null : block.diggable,
    boundingBox: block.boundingBox === undefined ? null : block.boundingBox,
    light: block.light === undefined ? null : block.light,
    skyLight: block.skyLight === undefined ? null : block.skyLight,
    stateId: block.stateId === undefined ? null : block.stateId,
    properties: block.getProperties ? serialize(safeCall(() => block.getProperties()), 2) : null
  };
}

function serializeEntity(entity) {
  if (!entity) return null;
  return {
    id: entity.id,
    type: entity.type,
    name: entity.name,
    displayName: entity.displayName,
    username: entity.username === undefined ? null : entity.username,
    position: serializeVec3(entity.position),
    velocity: serializeVec3(entity.velocity),
    yaw: entity.yaw === undefined ? null : entity.yaw,
    pitch: entity.pitch === undefined ? null : entity.pitch,
    health: entity.health === undefined ? null : entity.health,
    onGround: entity.onGround === undefined ? null : entity.onGround,
    equipment: Array.isArray(entity.equipment)
      ? entity.equipment.map((item) => serializeItem(item))
      : []
  };
}

function serializeWindow(window) {
  if (!window) return null;
  const slots = Array.isArray(window.slots) ? window.slots : [];
  return {
    id: window.id,
    type: window.type,
    title: typeof window.title === 'string' ? window.title : serialize(window.title, 2),
    slotCount: slots.length,
    inventoryStart: window.inventoryStart === undefined ? null : window.inventoryStart,
    inventoryEnd: window.inventoryEnd === undefined ? null : window.inventoryEnd,
    slots: slots.map((item, index) => (item ? Object.assign(serializeItem(item), { slot: index }) : null))
  };
}

function safeCall(fn) {
  try {
    return fn();
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* The live state snapshot                                             */
/* ------------------------------------------------------------------ */

/**
 * Reads the bot's real properties.
 *
 * Every field is null until the library has genuinely reported it. A health bar
 * showing 0 because nothing has arrived yet is indistinguishable from a bot
 * about to die, so nothing here substitutes a zero for an absence.
 */
function snapshot(session) {
  const bot = session.bot;
  const base = {
    botId: session.botId,
    status: session.status,
    endReason: session.endReason,
    username: null,
    version: null,
    protocolVersion: null,
    health: null,
    food: null,
    foodSaturation: null,
    oxygenLevel: null,
    experienceLevel: null,
    experiencePoints: null,
    experienceProgress: null,
    gameMode: null,
    dimension: null,
    difficulty: null,
    levelType: null,
    hardcore: null,
    serverBrand: null,
    maxPlayers: null,
    position: null,
    velocity: null,
    yaw: null,
    pitch: null,
    onGround: null,
    isSleeping: null,
    heldItem: null,
    quickBarSlot: null,
    timeOfDay: null,
    isDay: null,
    isRaining: null,
    thunderState: null,
    playerCount: null,
    entityCount: null,
    at: Date.now()
  };
  if (!bot) return base;

  const numberOrNull = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

  base.username = typeof bot.username === 'string' ? bot.username : null;
  base.version = typeof bot.version === 'string' ? bot.version : null;
  base.protocolVersion = numberOrNull(bot.protocolVersion);
  base.health = numberOrNull(bot.health);
  base.food = numberOrNull(bot.food);
  base.foodSaturation = numberOrNull(bot.foodSaturation);
  base.oxygenLevel = numberOrNull(bot.oxygenLevel);

  if (bot.experience) {
    base.experienceLevel = numberOrNull(bot.experience.level);
    base.experiencePoints = numberOrNull(bot.experience.points);
    base.experienceProgress = numberOrNull(bot.experience.progress);
  }
  if (bot.game) {
    base.gameMode = typeof bot.game.gameMode === 'string' ? bot.game.gameMode : null;
    base.dimension = typeof bot.game.dimension === 'string' ? bot.game.dimension : null;
    base.difficulty = typeof bot.game.difficulty === 'string' ? bot.game.difficulty : null;
    base.levelType = typeof bot.game.levelType === 'string' ? bot.game.levelType : null;
    base.hardcore = typeof bot.game.hardcore === 'boolean' ? bot.game.hardcore : null;
    base.serverBrand = typeof bot.game.serverBrand === 'string' ? bot.game.serverBrand : null;
    base.maxPlayers = numberOrNull(bot.game.maxPlayers);
  }
  if (bot.entity) {
    base.position = serializeVec3(bot.entity.position);
    base.velocity = serializeVec3(bot.entity.velocity);
    base.yaw = numberOrNull(bot.entity.yaw);
    base.pitch = numberOrNull(bot.entity.pitch);
    base.onGround = typeof bot.entity.onGround === 'boolean' ? bot.entity.onGround : null;
  }
  base.isSleeping = typeof bot.isSleeping === 'boolean' ? bot.isSleeping : null;
  if (bot.heldItem) {
    base.heldItem = {
      name: bot.heldItem.name,
      displayName: bot.heldItem.displayName,
      count: bot.heldItem.count,
      slot: bot.heldItem.slot
    };
  }
  base.quickBarSlot = numberOrNull(bot.quickBarSlot);
  if (bot.time) {
    base.timeOfDay = numberOrNull(bot.time.timeOfDay);
    base.isDay = typeof bot.time.isDay === 'boolean' ? bot.time.isDay : null;
  }
  base.isRaining = typeof bot.isRaining === 'boolean' ? bot.isRaining : null;
  base.thunderState = numberOrNull(bot.thunderState);
  base.playerCount = bot.players ? Object.keys(bot.players).length : null;
  base.entityCount = bot.entities ? Object.keys(bot.entities).length : null;
  return base;
}

/* ------------------------------------------------------------------ */
/* Argument validation                                                 */
/* ------------------------------------------------------------------ */

function fail(message, code) {
  const error = new Error(message);
  error.code = code || 'INVALID_ARGUMENT';
  throw error;
}

function checkNumber(value, name, options) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    fail('"' + name + '" must be a finite number; received ' + JSON.stringify(value) + '.');
  }
  if (options && options.integer && !Number.isInteger(value)) {
    fail('"' + name + '" must be a whole number; received ' + value + '.');
  }
  if (options && typeof options.min === 'number' && value < options.min) {
    fail('"' + name + '" must be at least ' + options.min + '; received ' + value + '.');
  }
  if (options && typeof options.max === 'number' && value > options.max) {
    fail('"' + name + '" must be at most ' + options.max + '; received ' + value + '.');
  }
  return value;
}

function checkString(value, name, allowed) {
  if (typeof value !== 'string') {
    fail('"' + name + '" must be text; received ' + JSON.stringify(value) + '.');
  }
  if (value.length > 4096) fail('"' + name + '" is longer than 4096 characters.');
  if (allowed && !allowed.includes(value)) {
    fail('"' + name + '" must be one of: ' + allowed.join(', ') + '. Received "' + value + '".');
  }
  return value;
}

function checkBoolean(value, name) {
  if (typeof value !== 'boolean') {
    fail('"' + name + '" must be true or false; received ' + JSON.stringify(value) + '.');
  }
  return value;
}

function checkVec3(session, value, name) {
  if (!session.Vec3) {
    fail(
      'The vec3 module could not be loaded beside the bot library, so no position can be built. ' +
      'The runtime log names the failure.',
      'VEC3_UNAVAILABLE'
    );
  }
  if (!value || typeof value !== 'object') {
    fail('"' + name + '" must be a position with x, y and z.');
  }
  checkNumber(value.x, name + '.x');
  checkNumber(value.y, name + '.y');
  checkNumber(value.z, name + '.z');
  return session.Vec3(value.x, value.y, value.z);
}

function blockAtOrFail(session, value, name) {
  const point = checkVec3(session, value, name);
  const block = session.bot.blockAt(point);
  if (!block) {
    fail(
      'There is no loaded block at ' + point.x + ', ' + point.y + ', ' + point.z +
      '. The chunk is outside the bot\'s view distance or has not arrived yet.',
      'BLOCK_NOT_LOADED'
    );
  }
  return block;
}

function entityOrFail(session, value, name) {
  checkNumber(value, name, { integer: true });
  const entity = session.bot.entities[value];
  if (!entity) {
    fail('There is no entity with id ' + value + ' near the bot.', 'ENTITY_NOT_FOUND');
  }
  return entity;
}

function itemTypeOrFail(session, value, name) {
  if (typeof value === 'number') return checkNumber(value, name, { integer: true, min: 0 });
  checkString(value, name);
  const registry = session.bot.registry;
  const item = registry && registry.itemsByName ? registry.itemsByName[value] : null;
  if (!item) {
    fail('"' + value + '" is not an item in this server\'s version data.', 'UNKNOWN_ITEM');
  }
  return item.id;
}

function blockTypeOrFail(session, value, name) {
  if (typeof value === 'number') return checkNumber(value, name, { integer: true, min: 0 });
  checkString(value, name);
  const registry = session.bot.registry;
  const block = registry && registry.blocksByName ? registry.blocksByName[value] : null;
  if (!block) {
    fail('"' + value + '" is not a block in this server\'s version data.', 'UNKNOWN_BLOCK');
  }
  return block.id;
}

/* ------------------------------------------------------------------ */
/* The method allow-list                                               */
/* ------------------------------------------------------------------ */

const CONTROL_STATES = ['forward', 'back', 'left', 'right', 'jump', 'sprint', 'sneak'];
const EQUIP_DESTINATIONS = ['hand', 'head', 'torso', 'legs', 'feet', 'off-hand'];
const HANDS = ['left', 'right'];
const CHAT_LEVELS = ['enabled', 'commandsOnly', 'disabled'];

/**
 * Every method the renderer may ask for, with the arguments it accepts.
 *
 * A name that is not a key here cannot be called, so the renderer cannot reach
 * anything on the bot that was not deliberately exposed. Each `run` receives
 * the session and the raw arguments and is responsible for validating them —
 * an argument that arrives wrong is refused with a message naming the argument.
 */
const METHODS = {
  /* --- chat ------------------------------------------------------- */
  chat: {
    run: (s, a) => { s.bot.chat(checkString(a[0], 'message')); return null; }
  },
  whisper: {
    run: (s, a) => {
      s.bot.whisper(checkString(a[0], 'username'), checkString(a[1], 'message'));
      return null;
    }
  },
  tabComplete: {
    run: (s, a) => s.bot.tabComplete(checkString(a[0], 'text'), a[1] === true)
  },
  awaitMessage: {
    run: (s, a) => s.bot.awaitMessage(checkString(a[0], 'pattern'))
  },

  /* --- movement --------------------------------------------------- */
  setControlState: {
    run: (s, a) => {
      s.bot.setControlState(checkString(a[0], 'control', CONTROL_STATES), checkBoolean(a[1], 'state'));
      return null;
    }
  },
  getControlState: {
    run: (s, a) => s.bot.getControlState(checkString(a[0], 'control', CONTROL_STATES))
  },
  clearControlStates: { run: (s) => { s.bot.clearControlStates(); return null; } },
  look: {
    run: (s, a) => s.bot.look(
      checkNumber(a[0], 'yaw'),
      checkNumber(a[1], 'pitch'),
      a[2] === true
    ).then(() => null)
  },
  lookAt: {
    run: (s, a) => s.bot.lookAt(checkVec3(s, a[0], 'point'), a[1] === true).then(() => null)
  },
  elytraFly: { run: (s) => s.bot.elytraFly().then(() => null) },
  moveVehicle: {
    run: (s, a) => {
      s.bot.moveVehicle(checkNumber(a[0], 'left'), checkNumber(a[1], 'forward'));
      return null;
    }
  },
  mount: { run: (s, a) => { s.bot.mount(entityOrFail(s, a[0], 'entityId')); return null; } },
  dismount: { run: (s) => { s.bot.dismount(); return null; } },
  waitForTicks: {
    run: (s, a) => s.bot.waitForTicks(checkNumber(a[0], 'ticks', { integer: true, min: 0, max: 12_000 }))
      .then(() => null)
  },
  waitForChunksToLoad: { run: (s) => s.bot.waitForChunksToLoad().then(() => null) },

  /* --- inventory -------------------------------------------------- */
  equip: {
    run: (s, a) => s.bot.equip(
      itemTypeOrFail(s, a[0], 'item'),
      a[1] === null || a[1] === undefined ? null : checkString(a[1], 'destination', EQUIP_DESTINATIONS)
    ).then(() => null)
  },
  unequip: {
    run: (s, a) => s.bot.unequip(
      a[0] === null || a[0] === undefined ? null : checkString(a[0], 'destination', EQUIP_DESTINATIONS)
    ).then(() => null)
  },
  toss: {
    run: (s, a) => s.bot.toss(
      itemTypeOrFail(s, a[0], 'item'),
      a[1] === null || a[1] === undefined ? null : checkNumber(a[1], 'metadata', { integer: true }),
      a[2] === null || a[2] === undefined ? null : checkNumber(a[2], 'count', { integer: true, min: 1 })
    ).then(() => null)
  },
  setQuickBarSlot: {
    run: (s, a) => {
      s.bot.setQuickBarSlot(checkNumber(a[0], 'slot', { integer: true, min: 0, max: 8 }));
      return null;
    }
  },
  moveSlotItem: {
    run: (s, a) => s.bot.moveSlotItem(
      checkNumber(a[0], 'sourceSlot', { integer: true, min: 0 }),
      checkNumber(a[1], 'destSlot', { integer: true, min: 0 })
    ).then(() => null)
  },
  clickWindow: {
    run: (s, a) => s.bot.clickWindow(
      checkNumber(a[0], 'slot', { integer: true }),
      checkNumber(a[1], 'mouseButton', { integer: true, min: 0, max: 2 }),
      checkNumber(a[2], 'mode', { integer: true, min: 0, max: 6 })
    ).then(() => null)
  },
  putAway: {
    run: (s, a) => s.bot.putAway(checkNumber(a[0], 'slot', { integer: true, min: 0 })).then(() => null)
  },
  updateHeldItem: { run: (s) => { s.bot.updateHeldItem(); return null; } },
  getEquipmentDestSlot: {
    run: (s, a) => s.bot.getEquipmentDestSlot(checkString(a[0], 'destination', EQUIP_DESTINATIONS))
  },
  inventory: { run: (s) => serializeWindow(s.bot.inventory) },
  currentWindow: { run: (s) => serializeWindow(s.bot.currentWindow) },
  closeWindow: {
    run: (s) => {
      if (!s.bot.currentWindow) fail('No container window is open.', 'NO_WINDOW');
      s.bot.closeWindow(s.bot.currentWindow);
      return null;
    }
  },
  openContainerAt: {
    run: (s, a) => s.bot.openContainer(blockAtOrFail(s, a[0], 'position'))
      .then((window) => serializeWindow(window))
  },
  openBlockAt: {
    run: (s, a) => s.bot.openBlock(blockAtOrFail(s, a[0], 'position'))
      .then((window) => serializeWindow(window))
  },

  /* --- crafting --------------------------------------------------- */
  recipesFor: {
    run: (s, a) => {
      const itemId = itemTypeOrFail(s, a[0], 'item');
      const table = a[1] === true ? true : null;
      const recipes = s.bot.recipesFor(itemId, null, 1, table);
      return recipes.map((recipe, index) => ({
        index: index,
        result: recipe.result ? { id: recipe.result.id, count: recipe.result.count } : null,
        requiresTable: recipe.requiresTable === true,
        delta: Array.isArray(recipe.delta)
          ? recipe.delta.map((entry) => ({ id: entry.id, count: entry.count }))
          : []
      }));
    }
  },
  recipesAll: {
    run: (s, a) => {
      const itemId = itemTypeOrFail(s, a[0], 'item');
      const recipes = s.bot.recipesAll(itemId, null, a[1] === true ? true : null);
      return recipes.map((recipe, index) => ({
        index: index,
        result: recipe.result ? { id: recipe.result.id, count: recipe.result.count } : null,
        requiresTable: recipe.requiresTable === true,
        delta: Array.isArray(recipe.delta)
          ? recipe.delta.map((entry) => ({ id: entry.id, count: entry.count }))
          : []
      }));
    }
  },
  craft: {
    run: (s, a) => {
      const itemId = itemTypeOrFail(s, a[0], 'item');
      const count = a[1] === null || a[1] === undefined
        ? 1
        : checkNumber(a[1], 'count', { integer: true, min: 1, max: 640 });
      const table = a[2] === null || a[2] === undefined ? null : blockAtOrFail(s, a[2], 'tablePosition');
      const recipes = s.bot.recipesFor(itemId, null, count, table);
      if (recipes.length === 0) {
        fail(
          'No recipe for that item can be made from the inventory the bot is holding right now' +
          (table ? ' at that crafting table.' : ', without a crafting table.'),
          'NO_RECIPE'
        );
      }
      return s.bot.craft(recipes[0], count, table || undefined).then(() => null);
    }
  },

  /* --- blocks ----------------------------------------------------- */
  blockAt: { run: (s, a) => serializeBlock(s.bot.blockAt(checkVec3(s, a[0], 'position'), true)) },
  blockAtCursor: {
    run: (s, a) => serializeBlock(s.bot.blockAtCursor(
      a[0] === undefined ? 4 : checkNumber(a[0], 'maxDistance', { min: 0, max: 256 })
    ))
  },
  entityAtCursor: {
    run: (s, a) => serializeEntity(s.bot.entityAtCursor(
      a[0] === undefined ? 3.5 : checkNumber(a[0], 'maxDistance', { min: 0, max: 256 })
    ))
  },
  canSeeBlock: { run: (s, a) => s.bot.canSeeBlock(blockAtOrFail(s, a[0], 'position')) },
  canDigBlock: { run: (s, a) => s.bot.canDigBlock(blockAtOrFail(s, a[0], 'position')) },
  digTime: { run: (s, a) => s.bot.digTime(blockAtOrFail(s, a[0], 'position')) },
  findBlocks: {
    run: (s, a) => {
      const options = a[0] && typeof a[0] === 'object' ? a[0] : fail('"options" must be an object.');
      const matching = Array.isArray(options.matching) ? options.matching : [options.matching];
      if (matching.length === 0 || matching.length > 64) {
        fail('"matching" must name between 1 and 64 block types.');
      }
      const ids = matching.map((entry, index) => blockTypeOrFail(s, entry, 'matching[' + index + ']'));
      const found = s.bot.findBlocks({
        point: options.point ? checkVec3(s, options.point, 'point') : undefined,
        matching: ids,
        maxDistance: options.maxDistance === undefined
          ? 32
          : checkNumber(options.maxDistance, 'maxDistance', { min: 1, max: 256 }),
        count: options.count === undefined
          ? 64
          : checkNumber(options.count, 'count', { integer: true, min: 1, max: 4096 })
      });
      return found.map((point) => {
        const block = s.bot.blockAt(point);
        return {
          position: serializeVec3(point),
          name: block ? block.name : null,
          displayName: block ? block.displayName : null
        };
      });
    }
  },
  dig: {
    run: (s, a) => {
      const block = blockAtOrFail(s, a[0], 'position');
      const forceLook = a[1] === undefined ? true : (a[1] === 'ignore' ? 'ignore' : checkBoolean(a[1], 'forceLook'));
      return s.bot.dig(block, forceLook).then(() => null);
    }
  },
  stopDigging: { run: (s) => { s.bot.stopDigging(); return null; } },
  placeBlock: {
    run: (s, a) => s.bot.placeBlock(
      blockAtOrFail(s, a[0], 'referencePosition'),
      checkVec3(s, a[1], 'faceVector')
    ).then(() => null)
  },
  placeEntity: {
    run: (s, a) => s.bot.placeEntity(
      blockAtOrFail(s, a[0], 'referencePosition'),
      checkVec3(s, a[1], 'faceVector')
    ).then((entity) => serializeEntity(entity))
  },
  activateBlock: {
    run: (s, a) => s.bot.activateBlock(blockAtOrFail(s, a[0], 'position')).then(() => null)
  },
  updateSign: {
    run: (s, a) => {
      s.bot.updateSign(
        blockAtOrFail(s, a[0], 'position'),
        checkString(a[1], 'text'),
        a[2] === true
      );
      return null;
    }
  },
  setCommandBlock: {
    run: (s, a) => {
      const options = a[2] && typeof a[2] === 'object' ? a[2] : {};
      s.bot.setCommandBlock(checkVec3(s, a[0], 'position'), checkString(a[1], 'command'), {
        mode: options.mode === undefined ? 1 : checkNumber(options.mode, 'mode', { integer: true, min: 0, max: 2 }),
        trackOutput: options.trackOutput === true,
        conditional: options.conditional === true,
        alwaysActive: options.alwaysActive === true
      });
      return null;
    }
  },

  /* --- entities and items ----------------------------------------- */
  entities: {
    run: (s) => Object.values(s.bot.entities)
      .slice(0, 400)
      .map((entity) => serializeEntity(entity))
  },
  players: {
    run: (s) => Object.values(s.bot.players).slice(0, 400).map((player) => ({
      uuid: player.uuid,
      username: player.username,
      ping: player.ping,
      gamemode: player.gamemode,
      entityId: player.entity ? player.entity.id : null
    }))
  },
  attack: { run: (s, a) => { s.bot.attack(entityOrFail(s, a[0], 'entityId')); return null; } },
  useOn: { run: (s, a) => { s.bot.useOn(entityOrFail(s, a[0], 'entityId')); return null; } },
  activateEntity: {
    run: (s, a) => s.bot.activateEntity(entityOrFail(s, a[0], 'entityId')).then(() => null)
  },
  swingArm: {
    run: (s, a) => {
      s.bot.swingArm(a[0] === undefined ? undefined : checkString(a[0], 'hand', HANDS));
      return null;
    }
  },
  activateItem: { run: (s, a) => { s.bot.activateItem(a[0] === true); return null; } },
  deactivateItem: { run: (s) => { s.bot.deactivateItem(); return null; } },
  consume: { run: (s) => s.bot.consume().then(() => null) },
  fish: { run: (s) => s.bot.fish().then(() => null) },

  /* --- sleeping, spawn, respawn ----------------------------------- */
  sleep: { run: (s, a) => s.bot.sleep(blockAtOrFail(s, a[0], 'bedPosition')).then(() => null) },
  wake: { run: (s) => s.bot.wake().then(() => null) },
  isABed: { run: (s, a) => s.bot.isABed(blockAtOrFail(s, a[0], 'position')) },
  respawn: { run: (s) => { s.bot.respawn(); return null; } },
  spawnPoint: { run: (s) => serializeVec3(s.bot.spawnPoint) },

  /* --- books, trading, resource packs ------------------------------ */
  writeBook: {
    run: (s, a) => {
      const pages = Array.isArray(a[1]) ? a[1] : fail('"pages" must be a list of strings.');
      if (pages.length === 0 || pages.length > 100) fail('"pages" must hold between 1 and 100 pages.');
      pages.forEach((page, index) => checkString(page, 'pages[' + index + ']'));
      return s.bot.writeBook(
        checkNumber(a[0], 'slot', { integer: true, min: 0 }),
        pages
      ).then(() => null);
    }
  },
  acceptResourcePack: { run: (s) => { s.bot.acceptResourcePack(); return null; } },
  denyResourcePack: { run: (s) => { s.bot.denyResourcePack(); return null; } },

  /* --- creative ---------------------------------------------------- */
  creativeStartFlying: { run: (s) => { s.bot.creative.startFlying(); return null; } },
  creativeStopFlying: { run: (s) => { s.bot.creative.stopFlying(); return null; } },
  creativeFlyTo: {
    run: (s, a) => s.bot.creative.flyTo(checkVec3(s, a[0], 'destination')).then(() => null)
  },
  creativeClearSlot: {
    run: (s, a) => s.bot.creative.clearSlot(
      checkNumber(a[0], 'slot', { integer: true, min: 0 })
    ).then(() => null)
  },
  creativeClearInventory: { run: (s) => s.bot.creative.clearInventory().then(() => null) },
  creativeSetInventorySlot: {
    run: (s, a) => {
      const slot = checkNumber(a[0], 'slot', { integer: true, min: 0 });
      if (a[1] === null || a[1] === undefined) {
        return s.bot.creative.setInventorySlot(slot, null).then(() => null);
      }
      const itemId = itemTypeOrFail(s, a[1], 'item');
      const count = a[2] === undefined ? 1 : checkNumber(a[2], 'count', { integer: true, min: 1, max: 64 });
      if (!s.Item) {
        fail(
          'The prismarine-item module could not be loaded beside the bot library, so an item ' +
          'cannot be constructed. Clearing the slot still works.',
          'ITEM_UNAVAILABLE'
        );
      }
      const item = new s.Item(itemId, count);
      return s.bot.creative.setInventorySlot(slot, item).then(() => null);
    }
  },

  /* --- settings and session --------------------------------------- */
  setSettings: {
    run: (s, a) => {
      const options = a[0] && typeof a[0] === 'object' ? a[0] : fail('"settings" must be an object.');
      const patch = {};
      if (options.chat !== undefined) patch.chat = checkString(options.chat, 'chat', CHAT_LEVELS);
      if (options.colorsEnabled !== undefined) {
        patch.colorsEnabled = checkBoolean(options.colorsEnabled, 'colorsEnabled');
      }
      if (options.viewDistance !== undefined) {
        patch.viewDistance = typeof options.viewDistance === 'number'
          ? checkNumber(options.viewDistance, 'viewDistance', { integer: true, min: 2, max: 32 })
          : checkString(options.viewDistance, 'viewDistance', ['far', 'normal', 'short', 'tiny']);
      }
      if (options.mainHand !== undefined) patch.mainHand = checkString(options.mainHand, 'mainHand', HANDS);
      if (options.difficulty !== undefined) {
        patch.difficulty = checkNumber(options.difficulty, 'difficulty', { integer: true, min: 0, max: 3 });
      }
      s.bot.setSettings(patch);
      return null;
    }
  },
  supportFeature: { run: (s, a) => s.bot.supportFeature(checkString(a[0], 'feature')) },
  quit: {
    run: (s, a) => {
      s.bot.quit(a[0] === undefined ? 'disconnect.quitting' : checkString(a[0], 'reason'));
      return null;
    }
  }
};

const METHOD_NAMES = Object.keys(METHODS).sort();

/* ------------------------------------------------------------------ */
/* Sessions                                                            */
/* ------------------------------------------------------------------ */

/**
 * Every event the library emits, plus `connect`, which `lib/loader.js` emits
 * directly. `blockUpdate:(x, y, z)` is a template rather than an event name and
 * is deliberately absent.
 */
const EVENT_NAMES = [
  'actionBar', 'blockBreakProgressEnd', 'blockBreakProgressObserved', 'blockUpdate',
  'bossBarCreated', 'bossBarDeleted', 'bossBarUpdated', 'breath', 'chat', 'chestLidMove',
  'chunkColumnLoad', 'chunkColumnUnload', 'connect', 'death', 'diggingAborted',
  'diggingCompleted', 'dismount', 'end', 'entityAttach', 'entityAttributes',
  'entityCriticalEffect', 'entityCrouch', 'entityDead', 'entityDetach', 'entityEat',
  'entityEatingGrass', 'entityEffect', 'entityEffectEnd', 'entityElytraFlew', 'entityEquip',
  'entityGone', 'entityHandSwap', 'entityHurt', 'entityMagicCriticalEffect', 'entityMoved',
  'entitySleep', 'entitySpawn', 'entitySwingArm', 'entityTamed', 'entityTaming',
  'entityUncrouch', 'entityUpdate', 'entityWake', 'entityShakingOffWater', 'error',
  'experience', 'forcedMove', 'game', 'hardcodedSoundEffectHeard', 'health', 'heldItemChanged',
  'inject_allowed', 'itemDrop', 'kicked', 'login', 'message', 'messagestr', 'mount', 'move',
  'noteHeard', 'particle', 'physicTick', 'physicsTick', 'pistonMove', 'playerCollect',
  'playerJoined', 'playerLeft', 'playerUpdated', 'rain', 'resourcePack', 'respawn',
  'scoreRemoved', 'scoreUpdated', 'scoreboardCreated', 'scoreboardDeleted', 'scoreboardPosition',
  'scoreboardTitleChanged', 'sleep', 'soundEffectHeard', 'spawn', 'spawnReset', 'teamCreated',
  'teamMemberAdded', 'teamMemberRemoved', 'teamRemoved', 'teamUpdated', 'time', 'title',
  'unmatchedMessage', 'usedFirework', 'wake', 'whisper', 'windowClose', 'windowOpen'
];

const sessions = new Map();
let runtime = null;

function requireSession(botId) {
  const session = sessions.get(botId);
  if (!session) {
    fail('There is no bot session with the id "' + botId + '".', 'NO_SESSION');
  }
  return session;
}

function setStatus(session, status, detail) {
  session.status = status;
  emit({
    type: 'status',
    botId: session.botId,
    status: status,
    detail: detail === undefined ? null : detail,
    at: Date.now()
  });
}

/**
 * Forwards one event, subject to the per-second budget.
 *
 * When the budget is spent the event is dropped and counted. The count is
 * reported rather than swallowed, so a gap in the inspector is visible as a
 * gap instead of looking like a quiet server.
 */
function forward(session, name, args) {
  if (!session.subscription.has(name)) return;
  const now = Date.now();
  if (now - session.windowStartedAt >= 1000) {
    if (session.dropped > 0) {
      emit({ type: 'dropped', botId: session.botId, count: session.dropped, at: now });
      session.dropped = 0;
    }
    session.windowStartedAt = now;
    session.budget = MAX_EVENTS_PER_SECOND;
  }
  if (session.budget <= 0) {
    session.dropped += 1;
    return;
  }
  session.budget -= 1;
  emit({
    type: 'event',
    botId: session.botId,
    name: name,
    at: now,
    payload: serialize(args.length === 1 ? args[0] : args, 0)
  });
}

function attachEvents(session) {
  for (const name of EVENT_NAMES) {
    const listener = (...args) => {
      try {
        forward(session, name, args);
      } catch (error) {
        emit({ type: 'fault', message: 'Forwarding "' + name + '" failed: ' + describe(error), at: Date.now() });
      }
    };
    session.listeners.push({ name: name, listener: listener });
    session.bot.on(name, listener);
  }

  session.bot.on('login', () => setStatus(session, 'connected', session.bot.username || null));
  session.bot.on('spawn', () => {
    session.attempt = 0;
    setStatus(session, 'spawned', null);
    pushState(session);
  });
  session.bot.on('kicked', (reason) => {
    session.endReason = typeof reason === 'string' ? reason : JSON.stringify(serialize(reason, 0));
    session.wasKicked = true;
  });
  session.bot.on('error', (error) => {
    session.lastError = describe(error);
  });
  session.bot.on('end', (reason) => {
    if (!session.endReason) {
      session.endReason = typeof reason === 'string' && reason.length > 0
        ? reason
        : (session.lastError || 'The connection ended without the server giving a reason.');
    }
    detach(session);
    scheduleReconnect(session);
  });

  // Cheap state pushes: only when something that changes the read-out changed.
  for (const trigger of ['health', 'breath', 'experience', 'game', 'time', 'rain',
    'heldItemChanged', 'move', 'forcedMove', 'respawn', 'sleep', 'wake', 'death']) {
    const listener = () => { session.stateDirty = true; };
    session.listeners.push({ name: trigger, listener: listener });
    session.bot.on(trigger, listener);
  }
}

function detach(session) {
  if (!session.bot) return;
  for (const entry of session.listeners) {
    try {
      session.bot.removeListener(entry.name, entry.listener);
    } catch {
      /* the emitter is already gone */
    }
  }
  session.listeners = [];
  session.bot = null;
}

function pushState(session) {
  session.stateDirty = false;
  emit({ type: 'state', botId: session.botId, state: snapshot(session) });
}

function scheduleReconnect(session) {
  const policy = session.options.reconnect || {};
  const kicked = session.wasKicked === true;
  session.wasKicked = false;

  if (session.closing || !policy.enabled || (kicked && policy.onKick !== true)) {
    setStatus(session, 'disconnected', session.endReason);
    pushState(session);
    return;
  }
  if (policy.maxAttempts > 0 && session.attempt >= policy.maxAttempts) {
    setStatus(
      session,
      'failed',
      'Gave up after ' + session.attempt + ' reconnection attempts. Last reason: ' +
        (session.endReason || 'unknown') + '.'
    );
    pushState(session);
    return;
  }

  const attempt = session.attempt;
  const factor = typeof policy.backoffFactor === 'number' && policy.backoffFactor >= 1
    ? policy.backoffFactor
    : 2;
  const initial = typeof policy.initialDelayMs === 'number' ? policy.initialDelayMs : 5000;
  const ceiling = typeof policy.maxDelayMs === 'number' ? policy.maxDelayMs : 120_000;
  const delay = Math.min(ceiling, Math.round(initial * Math.pow(factor, attempt)));
  session.attempt = attempt + 1;

  setStatus(
    session,
    'reconnecting',
    'Attempt ' + session.attempt + (policy.maxAttempts > 0 ? ' of ' + policy.maxAttempts : '') +
      ' in ' + Math.round(delay / 1000) + ' seconds. Last reason: ' +
      (session.endReason || 'unknown') + '.'
  );
  pushState(session);

  session.timer = setTimeout(() => {
    session.timer = null;
    try {
      openBot(session);
    } catch (error) {
      session.endReason = describe(error);
      scheduleReconnect(session);
    }
  }, delay);
}

/** Builds the library's own options object from the validated form values. */
function buildBotOptions(session) {
  const options = session.options;
  const built = {
    host: options.host,
    port: options.port,
    username: options.username,
    auth: options.auth,
    hideErrors: false,
    logErrors: false,
    brand: options.brand || 'vanilla',
    physicsEnabled: options.physicsEnabled !== false,
    respawn: options.respawn !== false,
    chat: options.chat || 'enabled',
    colorsEnabled: options.colorsEnabled !== false,
    viewDistance: options.viewDistance || 'normal',
    mainHand: options.mainHand || 'right',
    difficulty: typeof options.difficulty === 'number' ? options.difficulty : 2,
    profilesFolder: session.profilesFolder,
    checkTimeoutInterval: options.checkTimeoutInterval > 0 ? options.checkTimeoutInterval : 30_000,
    onMsaCode: (data) => {
      if (!data || typeof data !== 'object') return;
      emit({
        type: 'signin',
        botId: session.botId,
        code: typeof data.user_code === 'string' ? data.user_code : '',
        url: typeof data.verification_uri === 'string' ? data.verification_uri : '',
        message: typeof data.message === 'string' ? data.message : '',
        at: Date.now()
      });
    }
  };
  if (options.version) built.version = options.version;
  if (options.chatLengthLimit > 0) built.chatLengthLimit = options.chatLengthLimit;
  if (session.secret) built.password = session.secret;
  if (options.proxyHost) {
    const socks = runtime.socks;
    if (!socks) {
      fail(
        'A proxy was configured but the optional "socks" module is not installed beside the bot ' +
        'library, so the connection cannot be made through it. Clear the proxy host to connect ' +
        'directly, or install "socks".',
        'PROXY_UNAVAILABLE'
      );
    }
    built.connect = (client) => {
      socks.SocksClient.createConnection({
        proxy: { host: options.proxyHost, port: options.proxyPort, type: 5 },
        command: 'connect',
        destination: { host: options.host, port: options.port }
      }).then((info) => {
        client.setSocket(info.socket);
        client.emit('connect');
      }).catch((error) => {
        client.emit('error', error);
      });
    };
  }
  return built;
}

function openBot(session) {
  setStatus(session, session.attempt > 0 ? 'reconnecting' : 'connecting', null);
  session.endReason = null;
  session.lastError = null;
  session.bot = runtime.library.createBot(buildBotOptions(session));
  session.listeners = [];
  attachEvents(session);
}

/* ------------------------------------------------------------------ */
/* Commands                                                            */
/* ------------------------------------------------------------------ */

function validateConnectionOptions(options) {
  if (!options || typeof options !== 'object') fail('"options" must be an object.');
  checkString(options.host, 'host');
  if (options.host.trim().length === 0) fail('"host" must not be empty.');
  checkNumber(options.port, 'port', { integer: true, min: 1, max: 65_535 });
  checkString(options.username, 'username');
  if (options.username.trim().length === 0) fail('"username" must not be empty.');
  checkString(options.auth, 'auth', ['offline', 'microsoft', 'mojang']);
  checkString(options.version, 'version');
  if (options.version && !/^[0-9][0-9a-zA-Z._-]{0,31}$/.test(options.version)) {
    fail('"version" must look like a Minecraft version, for example 1.20.4.');
  }
  checkString(options.proxyHost, 'proxyHost');
  if (options.proxyHost) checkNumber(options.proxyPort, 'proxyPort', { integer: true, min: 1, max: 65_535 });
  checkString(options.viewDistance, 'viewDistance', ['far', 'normal', 'short', 'tiny']);
  checkString(options.chat, 'chat', CHAT_LEVELS);
  checkBoolean(options.colorsEnabled, 'colorsEnabled');
  checkString(options.mainHand, 'mainHand', HANDS);
  checkNumber(options.difficulty, 'difficulty', { integer: true, min: 0, max: 3 });
  checkBoolean(options.physicsEnabled, 'physicsEnabled');
  checkBoolean(options.respawn, 'respawn');
  checkString(options.brand, 'brand');
  checkNumber(options.checkTimeoutInterval, 'checkTimeoutInterval', { integer: true, min: 1000, max: 600_000 });
  checkNumber(options.chatLengthLimit, 'chatLengthLimit', { integer: true, min: 0, max: 4096 });
  const policy = options.reconnect;
  if (!policy || typeof policy !== 'object') fail('"reconnect" must be an object.');
  checkBoolean(policy.enabled, 'reconnect.enabled');
  checkNumber(policy.maxAttempts, 'reconnect.maxAttempts', { integer: true, min: 0, max: 1000 });
  checkNumber(policy.initialDelayMs, 'reconnect.initialDelayMs', { integer: true, min: 500, max: 3_600_000 });
  checkNumber(policy.backoffFactor, 'reconnect.backoffFactor', { min: 1, max: 10 });
  checkNumber(policy.maxDelayMs, 'reconnect.maxDelayMs', { integer: true, min: 500, max: 3_600_000 });
  checkBoolean(policy.onKick, 'reconnect.onKick');
}

const HANDLERS = {
  handshake(command) {
    reply(command.id, {
      protocol: PROTOCOL,
      libraryVersion: runtime.version,
      testedVersions: runtime.library.testedVersions || [],
      latestSupportedVersion: runtime.library.latestSupportedVersion || '',
      oldestSupportedVersion: runtime.library.oldestSupportedVersion || '',
      nodeVersion: process.versions.node,
      eventNames: EVENT_NAMES,
      methodNames: METHOD_NAMES,
      libraryPath: runtime.path,
      proxySupported: runtime.socks !== null
    });
  },

  connect(command) {
    const botId = checkString(command.botId, 'botId');
    if (sessions.has(botId)) fail('A bot with the id "' + botId + '" is already open.', 'DUPLICATE_BOT');
    if (sessions.size >= MAX_BOTS) {
      fail('At most ' + MAX_BOTS + ' bots may run at once. Disconnect one first.', 'TOO_MANY_BOTS');
    }
    validateConnectionOptions(command.options);

    const session = {
      botId: botId,
      options: command.options,
      // Held only in memory, never echoed into a reply, an event or a log.
      secret: typeof command.secret === 'string' && command.secret.length > 0 ? command.secret : null,
      profilesFolder: runtime.profilesFolder,
      bot: null,
      listeners: [],
      status: 'idle',
      endReason: null,
      lastError: null,
      wasKicked: false,
      closing: false,
      attempt: 0,
      timer: null,
      stateDirty: false,
      subscription: new Set(EVENT_NAMES),
      budget: MAX_EVENTS_PER_SECOND,
      windowStartedAt: Date.now(),
      dropped: 0,
      Vec3: runtime.Vec3,
      Item: runtime.Item
    };
    sessions.set(botId, session);
    openBot(session);
    reply(command.id, { botId: botId });
  },

  disconnect(command) {
    const session = requireSession(command.botId);
    session.closing = true;
    if (session.timer) {
      clearTimeout(session.timer);
      session.timer = null;
    }
    const reason = typeof command.reason === 'string' && command.reason.length > 0
      ? command.reason
      : 'Disconnected from World Downloader Studio.';
    if (session.bot) {
      try {
        session.bot.quit(reason);
      } catch (error) {
        session.endReason = describe(error);
      }
      detach(session);
    }
    session.endReason = session.endReason || reason;
    setStatus(session, 'disconnected', session.endReason);
    pushState(session);
    reply(command.id, { botId: session.botId });
  },

  forget(command) {
    const session = requireSession(command.botId);
    session.closing = true;
    if (session.timer) clearTimeout(session.timer);
    if (session.bot) {
      try {
        session.bot.quit('Session closed.');
      } catch {
        /* already gone */
      }
      detach(session);
    }
    session.secret = null;
    sessions.delete(session.botId);
    reply(command.id, { botId: command.botId });
  },

  state(command) {
    const session = requireSession(command.botId);
    reply(command.id, snapshot(session));
  },

  subscribe(command) {
    const session = requireSession(command.botId);
    if (!Array.isArray(command.events)) fail('"events" must be a list of event names.');
    const unknown = command.events.filter((name) => !EVENT_NAMES.includes(name));
    if (unknown.length > 0) {
      fail('These are not events this library emits: ' + unknown.join(', ') + '.', 'UNKNOWN_EVENT');
    }
    session.subscription = new Set(command.events);
    reply(command.id, { subscribed: command.events.length });
  },

  call(command) {
    const session = requireSession(command.botId);
    const name = checkString(command.method, 'method');
    const entry = Object.prototype.hasOwnProperty.call(METHODS, name) ? METHODS[name] : null;
    if (!entry) {
      fail(
        '"' + name + '" is not on the list of methods this runtime exposes. ' +
        'The list is fixed at build time and cannot be extended at run time.',
        'METHOD_NOT_ALLOWED'
      );
    }
    if (!session.bot) {
      fail('The bot "' + session.botId + '" is not connected right now.', 'NOT_CONNECTED');
    }
    const args = Array.isArray(command.args) ? command.args : [];
    if (args.length > 8) fail('At most 8 arguments may be passed.');
    const outcome = entry.run(session, args);
    if (outcome && typeof outcome.then === 'function') {
      outcome.then(
        (value) => reply(command.id, value === undefined ? null : value),
        (error) => replyError(command.id, error)
      );
    } else {
      reply(command.id, outcome);
    }
  },

  shutdown(command) {
    reply(command.id, { closed: sessions.size });
    for (const session of sessions.values()) {
      session.closing = true;
      if (session.timer) clearTimeout(session.timer);
      if (session.bot) {
        try {
          session.bot.quit('Runtime shutting down.');
        } catch {
          /* already gone */
        }
      }
    }
    sessions.clear();
    setTimeout(() => process.exit(0), 50);
  }
};

/* ------------------------------------------------------------------ */
/* Start-up                                                            */
/* ------------------------------------------------------------------ */

function start() {
  interceptConsole();

  const extraRoots = [];
  let profilesFolder = path.join(__dirname, 'profiles');
  for (const argument of process.argv.slice(2)) {
    if (argument.startsWith('--library-root=')) extraRoots.push(argument.slice('--library-root='.length));
    else if (argument.startsWith('--profiles=')) profilesFolder = argument.slice('--profiles='.length);
  }

  let resolved;
  try {
    resolved = resolveLibrary(extraRoots);
  } catch (error) {
    emit({ type: 'fault', message: describe(error), at: Date.now() });
    // Stay alive so the renderer can read the fault and explain it, rather than
    // dying and leaving a blank surface with nothing to show.
    resolved = null;
  }

  if (resolved) {
    /*
     * The library's own dependencies sit beside it in the same `node_modules`
     * directory, so they are loaded from there rather than from this file's
     * neighbours — there are none. When the library was found by the ordinary
     * resolver instead, its path is not a directory and the plain name is used.
     */
    const beside = (name) => {
      if (path.isAbsolute(resolved.path)) return require(path.join(path.dirname(resolved.path), name));
      return require(name);
    };
    let socks = null;
    try {
      socks = beside('socks');
    } catch {
      socks = null;
    }
    let Vec3 = null;
    let Item = null;
    try {
      Vec3 = beside('vec3').Vec3;
    } catch (error) {
      emit({ type: 'fault', message: 'The vec3 module could not be loaded: ' + describe(error), at: Date.now() });
    }
    try {
      Item = beside('prismarine-item')(resolved.library.latestSupportedVersion);
    } catch {
      Item = null;
    }
    try {
      fs.mkdirSync(profilesFolder, { recursive: true });
    } catch {
      /* the runtime still works; only cached Microsoft tokens are affected */
    }
    runtime = {
      library: resolved.library,
      version: resolved.version,
      path: resolved.path,
      socks: socks,
      Vec3: Vec3,
      Item: Item,
      profilesFolder: profilesFolder
    };
  }

  const input = readline.createInterface({ input: process.stdin });
  input.on('line', (line) => {
    const text = line.trim();
    if (text.length === 0) return;
    let command;
    try {
      command = JSON.parse(text);
    } catch (error) {
      emit({ type: 'fault', message: 'A command was not valid JSON: ' + describe(error), at: Date.now() });
      return;
    }
    const id = typeof command.id === 'number' ? command.id : -1;
    if (!runtime) {
      replyError(
        id,
        'The bot library is not loaded, so no command can be served. The runtime log above names ' +
        'every path that was searched.',
        'LIBRARY_NOT_FOUND'
      );
      return;
    }
    const handler = Object.prototype.hasOwnProperty.call(HANDLERS, command.cmd)
      ? HANDLERS[command.cmd]
      : null;
    if (!handler) {
      replyError(id, 'Unknown command "' + String(command.cmd) + '".', 'UNKNOWN_COMMAND');
      return;
    }
    try {
      handler(command);
    } catch (error) {
      replyError(id, error);
    }
  });
  input.on('close', () => process.exit(0));

  // One timer, shared by every session, pushing a state snapshot only when
  // something that appears in the read-out actually changed.
  setInterval(() => {
    for (const session of sessions.values()) {
      if (session.stateDirty && session.bot) pushState(session);
    }
  }, 500).unref();

  process.on('uncaughtException', (error) => {
    emit({ type: 'fault', message: 'Uncaught error in the runtime: ' + describe(error), at: Date.now() });
  });
  process.on('unhandledRejection', (error) => {
    emit({ type: 'fault', message: 'Unhandled rejection in the runtime: ' + describe(error), at: Date.now() });
  });
}

start();
