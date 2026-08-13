/**
 * The wire contract between the renderer and the bot runtime.
 *
 * The bot library is Node-only: it opens TCP sockets, reads the Minecraft
 * protocol and keeps a live world in memory. None of that is possible in the
 * renderer, which has no `require`, no `process` and no socket. So the runtime
 * lives in a separate Node process and this file is the only thing both halves
 * agree on.
 *
 * Newline-delimited JSON travels both ways. Every line the host writes carries
 * a sentinel prefix, so a stray runtime warning printed on the same stream can
 * never be mistaken for a message.
 *
 * Nothing here is guessed. Every event name, method name, option name and
 * property name in this file was read out of `vendor/mineflayer` — `index.d.ts`,
 * `docs/api.md`, `lib/loader.js`, `lib/version.js` and `lib/plugins/`.
 */

/** Bumped when the shape below changes in a way an older host cannot serve. */
export const PROTOCOL_VERSION = 1;

/** Prefixes every line the host writes on stdout. */
export const SENTINEL = '@WDS-MINEFLAYER-1@';

/* ------------------------------------------------------------------ */
/* Connection options                                                  */
/* ------------------------------------------------------------------ */

/** `bot.settings.chat` — `lib/plugins/settings.js`. */
export type ChatLevel = 'enabled' | 'commandsOnly' | 'disabled';

/** `ViewDistance` in `index.d.ts`. A number is also accepted by the library. */
export type ViewDistanceName = 'far' | 'normal' | 'short' | 'tiny';

/** `MainHands` in `index.d.ts`. */
export type MainHand = 'left' | 'right';

/** `auth` in `docs/api.md`: 'mojang' or 'microsoft'. Offline is neither. */
export type AuthMode = 'offline' | 'microsoft' | 'mojang';

/**
 * Everything the connection form can set.
 *
 * This is deliberately *not* the library's `BotOptions`: it is the subset the
 * form owns, in the form's own shape, so a value can be validated on the way in
 * rather than handed to the library unread.
 */
export interface ConnectionOptions {
  host: string;
  port: number;
  username: string;
  auth: AuthMode;
  /** Empty means "let the library detect the server's version". */
  version: string;
  /** Empty means no proxy. `host:port` of a SOCKS5 proxy. */
  proxyHost: string;
  proxyPort: number;
  viewDistance: ViewDistanceName;
  chat: ChatLevel;
  colorsEnabled: boolean;
  mainHand: MainHand;
  /** `bot.settings.difficulty`, 0..3. */
  difficulty: number;
  /** `physicsEnabled` — false leaves the bot inert but still connected. */
  physicsEnabled: boolean;
  /** `respawn` — false leaves a dead bot dead until asked to respawn. */
  respawn: boolean;
  /** `brand` — the client brand string the server is told. */
  brand: string;
  /** `checkTimeoutInterval` in milliseconds. */
  checkTimeoutInterval: number;
  /** `chatLengthLimit`. 0 means "let the library choose by version". */
  chatLengthLimit: number;
  /** Reconnect policy, owned by this application rather than by the library. */
  reconnect: ReconnectPolicy;
}

export interface ReconnectPolicy {
  enabled: boolean;
  /** Attempts before giving up. 0 means keep trying. */
  maxAttempts: number;
  /** First delay in milliseconds. */
  initialDelayMs: number;
  /** Multiplier applied to the delay after each failed attempt. */
  backoffFactor: number;
  /** Ceiling on the delay in milliseconds. */
  maxDelayMs: number;
  /** Reconnect even when the server kicked the bot, rather than only on a drop. */
  onKick: boolean;
}

/* ------------------------------------------------------------------ */
/* Live state                                                          */
/* ------------------------------------------------------------------ */

/** A position, velocity or facing read straight off the bot's own entity. */
export interface Vec3Value {
  x: number;
  y: number;
  z: number;
}

export interface HeldItemValue {
  name: string;
  displayName: string;
  count: number;
  slot: number;
}

/**
 * The live read-out.
 *
 * Every field is `null` until the library has really reported it. A number that
 * has not arrived is not zero, and rendering it as zero would be a lie the user
 * cannot detect.
 */
export interface BotState {
  botId: string;
  status: BotStatus;
  /** The server's own reason for the last disconnection, verbatim. */
  endReason: string | null;
  username: string | null;
  /** `bot.version` — the version actually negotiated, not the one requested. */
  version: string | null;
  protocolVersion: number | null;
  health: number | null;
  food: number | null;
  foodSaturation: number | null;
  /** `bot.oxygenLevel`, 0..20. */
  oxygenLevel: number | null;
  experienceLevel: number | null;
  experiencePoints: number | null;
  /** 0..1 towards the next level. */
  experienceProgress: number | null;
  gameMode: string | null;
  dimension: string | null;
  difficulty: string | null;
  levelType: string | null;
  hardcore: boolean | null;
  serverBrand: string | null;
  maxPlayers: number | null;
  position: Vec3Value | null;
  velocity: Vec3Value | null;
  yaw: number | null;
  pitch: number | null;
  onGround: boolean | null;
  isSleeping: boolean | null;
  heldItem: HeldItemValue | null;
  quickBarSlot: number | null;
  timeOfDay: number | null;
  isDay: boolean | null;
  isRaining: boolean | null;
  thunderState: number | null;
  playerCount: number | null;
  entityCount: number | null;
  /** Milliseconds since the epoch at which this snapshot was taken. */
  at: number;
}

export type BotStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'spawned'
  | 'reconnecting'
  | 'disconnected'
  | 'failed';

/* ------------------------------------------------------------------ */
/* Commands                                                            */
/* ------------------------------------------------------------------ */

export interface HostHandshake {
  protocol: number;
  /** `require('mineflayer/package.json').version`. */
  libraryVersion: string;
  /** `mineflayer.testedVersions` — the real list, not a remembered one. */
  testedVersions: string[];
  latestSupportedVersion: string;
  oldestSupportedVersion: string;
  /** `process.versions.node` of the host process. */
  nodeVersion: string;
  /** Every event name the host will forward. */
  eventNames: string[];
  /** Every method name the host will accept. */
  methodNames: string[];
  /** Where the library was resolved from, so the transport can be explained. */
  libraryPath: string;
  /** True when a SOCKS5 proxy can be used: the optional dependency is present. */
  proxySupported: boolean;
}

export type HostCommand =
  | { cmd: 'handshake'; id: number }
  /**
   * `secret` is the account password, read out of the OS credential vault at
   * the moment the user asked to connect. It is held in the runtime's memory
   * for the life of the session and never appears in a reply, an event, a log
   * line, a setting, an export or a history entry.
   */
  | { cmd: 'connect'; id: number; botId: string; options: ConnectionOptions; secret?: string }
  | { cmd: 'disconnect'; id: number; botId: string; reason: string }
  | { cmd: 'forget'; id: number; botId: string }
  | { cmd: 'state'; id: number; botId: string }
  | { cmd: 'call'; id: number; botId: string; method: string; args: unknown[] }
  | { cmd: 'subscribe'; id: number; botId: string; events: string[] }
  | { cmd: 'shutdown'; id: number };

export type HostMessage =
  | { type: 'reply'; id: number; ok: true; value: unknown }
  | { type: 'reply'; id: number; ok: false; error: string; code?: string }
  | { type: 'event'; botId: string; name: string; at: number; payload: unknown }
  | { type: 'status'; botId: string; status: BotStatus; detail: string | null; at: number }
  | { type: 'state'; botId: string; state: BotState }
  | { type: 'dropped'; botId: string; count: number; at: number }
  /**
   * Anything the library or its dependencies printed to the console.
   *
   * This is how a Microsoft device-sign-in code reaches the user: the
   * authentication library prints it, and the runtime forwards what was
   * printed rather than pretending to have parsed it.
   */
  | { type: 'log'; level: 'log' | 'info' | 'warn' | 'error'; text: string; at: number }
  /** A Microsoft device-code prompt, when the library hands one over directly. */
  | { type: 'signin'; botId: string; code: string; url: string; message: string; at: number }
  | { type: 'fault'; message: string; at: number };

/* ------------------------------------------------------------------ */
/* Event names                                                         */
/* ------------------------------------------------------------------ */

/**
 * Every event the library emits, taken from `BotEvents` in `index.d.ts` plus
 * `connect`, which `lib/loader.js` emits directly and the type declaration
 * omits.
 *
 * `blockUpdate:(x, y, z)` is deliberately absent: it is a template for a
 * per-coordinate listener rather than an event name anything ever emits.
 */
export const EVENT_NAMES: readonly string[] = [
  'actionBar',
  'blockBreakProgressEnd',
  'blockBreakProgressObserved',
  'blockUpdate',
  'bossBarCreated',
  'bossBarDeleted',
  'bossBarUpdated',
  'breath',
  'chat',
  'chestLidMove',
  'chunkColumnLoad',
  'chunkColumnUnload',
  'connect',
  'death',
  'diggingAborted',
  'diggingCompleted',
  'dismount',
  'end',
  'entityAttach',
  'entityAttributes',
  'entityCriticalEffect',
  'entityCrouch',
  'entityDead',
  'entityDetach',
  'entityEat',
  'entityEatingGrass',
  'entityEffect',
  'entityEffectEnd',
  'entityElytraFlew',
  'entityEquip',
  'entityGone',
  'entityHandSwap',
  'entityHurt',
  'entityMagicCriticalEffect',
  'entityMoved',
  'entitySleep',
  'entitySpawn',
  'entitySwingArm',
  'entityTamed',
  'entityTaming',
  'entityUncrouch',
  'entityUpdate',
  'entityWake',
  'entityShakingOffWater',
  'error',
  'experience',
  'forcedMove',
  'game',
  'hardcodedSoundEffectHeard',
  'health',
  'heldItemChanged',
  'inject_allowed',
  'itemDrop',
  'kicked',
  'login',
  'message',
  'messagestr',
  'mount',
  'move',
  'noteHeard',
  'particle',
  'physicTick',
  'physicsTick',
  'pistonMove',
  'playerCollect',
  'playerJoined',
  'playerLeft',
  'playerUpdated',
  'rain',
  'resourcePack',
  'respawn',
  'scoreRemoved',
  'scoreUpdated',
  'scoreboardCreated',
  'scoreboardDeleted',
  'scoreboardPosition',
  'scoreboardTitleChanged',
  'sleep',
  'soundEffectHeard',
  'spawn',
  'spawnReset',
  'teamCreated',
  'teamMemberAdded',
  'teamMemberRemoved',
  'teamRemoved',
  'teamUpdated',
  'time',
  'title',
  'unmatchedMessage',
  'usedFirework',
  'wake',
  'whisper',
  'windowClose',
  'windowOpen'
];

/**
 * Events that fire tens of times a second on a normal server.
 *
 * They are still subscribable — an inspector that hid them would be lying about
 * being a catch-all — but they are off until asked for, because a subscription
 * that turns them all on at once fills the buffer in under a second and pushes
 * every other event out of it.
 */
export const HIGH_FREQUENCY_EVENTS: readonly string[] = [
  'blockUpdate',
  'chunkColumnLoad',
  'chunkColumnUnload',
  'entityAttributes',
  'entityMoved',
  'entityUpdate',
  'move',
  'particle',
  'physicTick',
  'physicsTick'
];

/** The subscription a new bot starts with: everything except the firehose. */
export const DEFAULT_EVENT_SUBSCRIPTION: readonly string[] = EVENT_NAMES.filter(
  (name) => !HIGH_FREQUENCY_EVENTS.includes(name)
);
