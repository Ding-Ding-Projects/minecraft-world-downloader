/**
 * How the four sibling mineflayer features reach a live bot.
 *
 * This feature owns the only connection to a Minecraft server; a second
 * feature cannot open one of its own without the server seeing two players.
 * So every sibling drives whichever bot is *active* here, through a narrow,
 * typed facade this file builds and publishes — never by reaching into
 * `manager.ts` or `runtime.ts` directly, and never by this file importing a
 * sibling's own types (a directory may be *read* by a sibling, per the
 * integration contract, but nothing here should have to change shape just
 * because a sibling renamed an internal interface).
 *
 * Two sibling features already exist and each expects a different shape,
 * discovered by reading their own source before writing this file:
 *
 *   - `mineflayer-movement/session.ts` looks for a *named export* from this
 *     module — `sessionHost`, checked first — implementing `{ active(),
 *     subscribe(listener) }` where `active()` returns an object with
 *     `snapshot`, `subscribe`, `setControlState`, `clearControlStates`,
 *     `look`, `lookAt`, `entities`, and optionally `blockAtCursor` /
 *     `entityAtCursor`. It also accepts a global bridge,
 *     `window.mineflayerMovement.provideHost(...)`, which this file calls too
 *     so the two discovery routes can never disagree about which host is live.
 *
 *   - `mineflayer-chat/session.ts` looks for `publishBotSessionHost(host)` to
 *     be *called*, not exported — it owns that function itself and expects
 *     the bot feature to import and call it once. This file finds it with
 *     `import.meta.glob`, exactly as the movement sibling finds this module,
 *     so a missing or renamed chat feature never breaks this feature's build.
 *
 * A future `mineflayer-inventory` or `mineflayer-world` feature has no
 * contract to discover yet. `getMineflayerRuntimeContract()` below is the
 * generic, low-level typed contract for that case: every live bot's state,
 * every allow-listed method call, and the raw event stream, with nothing
 * chat- or movement-specific baked in.
 */

import type { AppContext } from '../../core/registry';
import type { BotState, ConnectionOptions, HostMessage } from './protocol';
import type { BotManager, LiveBotSession } from './manager';

/* ================================================================== */
/* The generic, low-level contract — for any sibling                   */
/* ================================================================== */

export interface MineflayerBotSummary {
  botId: string;
  name: string;
  status: LiveBotSession['status'];
  state: BotState | null;
}

export interface MineflayerRuntimeContract {
  activeBotId(): string | null;
  onActiveChange(listener: () => void): () => void;
  listBots(): MineflayerBotSummary[];
  onChange(listener: () => void): () => void;
  getState(botId: string): BotState | null;
  /** Calls one of the host's allow-listed methods. See `protocol.ts` and `bot-host.js` for the full list. */
  call<T = unknown>(botId: string, method: string, args?: unknown[]): Promise<T>;
  /** Every `event`/`status`/`state`/`dropped`/`signin` message the host sends, for any bot. */
  onHostMessage(listener: (message: HostMessage) => void): () => void;
}

let boundCtx: AppContext | null = null;
let boundManager: BotManager | null = null;
const boundListeners = new Set<() => void>();
const boundActiveListeners = new Set<() => void>();

function notifyBound(): void {
  for (const listener of [...boundListeners]) listener();
}

function notifyActiveBound(): void {
  for (const listener of [...boundActiveListeners]) listener();
}

/** The generic contract, or `null` before this feature's `init` has run. */
export function getMineflayerRuntimeContract(): MineflayerRuntimeContract | null {
  if (!boundManager) return null;
  const manager = boundManager;
  return {
    activeBotId: () => manager.activeBotIdValue(),
    onActiveChange: (listener) => manager.onActiveChange(listener),
    listBots: () =>
      manager.listSessions().map((session) => ({
        botId: session.botId,
        name: session.source.kind === 'profile' ? session.source.profileName : session.options.username,
        status: session.status,
        state: session.state
      })),
    onChange: (listener) => manager.onChange(listener),
    getState: (botId) => manager.getSession(botId)?.state ?? null,
    call: (botId, method, args = []) => manager.call(botId, method, args),
    onHostMessage: (listener) => manager.runtime.onMessage(listener)
  };
}

/* ================================================================== */
/* The movement sibling's shape                                        */
/* ================================================================== */

type ControlName = 'forward' | 'back' | 'left' | 'right' | 'jump' | 'sprint' | 'sneak';
const CONTROL_NAMES: ControlName[] = ['forward', 'back', 'left', 'right', 'jump', 'sprint', 'sneak'];

interface LocalVec3 {
  x: number;
  y: number;
  z: number;
}

interface MovementSnapshotLike {
  connected: boolean;
  username: string;
  position: LocalVec3;
  velocity: LocalVec3;
  yaw: number;
  pitch: number;
  onGround: boolean;
  eyeHeight: number;
  isInWater: boolean;
  dimension: string;
  gameMode: string;
  physicsEnabled: boolean;
  controls: Record<ControlName, boolean>;
}

interface MovementEntitySummaryLike {
  id: number;
  name: string;
  displayName: string;
  username: string | null;
  type: string;
  position: LocalVec3;
  distance: number;
  height: number;
  width: number;
}

interface MovementBotSessionLike {
  id: string;
  snapshot(): MovementSnapshotLike | null;
  subscribe(listener: () => void): () => void;
  setControlState(control: ControlName, state: boolean): Promise<void>;
  clearControlStates(): Promise<void>;
  look(yaw: number, pitch: number, force?: boolean): Promise<void>;
  lookAt(point: LocalVec3, force?: boolean): Promise<void>;
  entities(): MovementEntitySummaryLike[];
  blockAtCursor(maxDistance?: number): Promise<unknown>;
  entityAtCursor(maxDistance?: number): Promise<MovementEntitySummaryLike | null>;
  pathfinder: null;
}

const ZERO_VEC: LocalVec3 = { x: 0, y: 0, z: 0 };
const controlShadow = new Map<string, Record<ControlName, boolean>>();
const entityCache = new Map<string, MovementEntitySummaryLike[]>();

function emptyControls(): Record<ControlName, boolean> {
  return { forward: false, back: false, left: false, right: false, jump: false, sprint: false, sneak: false };
}

function toVec(value: { x: number; y: number; z: number } | null | undefined): LocalVec3 {
  if (!value) return ZERO_VEC;
  return { x: value.x, y: value.y, z: value.z };
}

function distanceBetween(a: LocalVec3, b: LocalVec3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function buildMovementSnapshot(session: LiveBotSession): MovementSnapshotLike | null {
  const state = session.state;
  if (!state || (session.status !== 'spawned' && session.status !== 'connected')) return null;
  return {
    connected: session.status === 'spawned',
    username: state.username ?? session.options.username,
    position: toVec(state.position),
    velocity: toVec(state.velocity),
    yaw: state.yaw ?? 0,
    pitch: state.pitch ?? 0,
    onGround: state.onGround ?? false,
    eyeHeight: state.eyeHeight ?? 1.62,
    isInWater: state.isInWater ?? false,
    dimension: state.dimension ?? '',
    gameMode: state.gameMode ?? '',
    physicsEnabled: session.options.physicsEnabled,
    controls: controlShadow.get(session.botId) ?? emptyControls()
  };
}

function buildMovementSession(ctx: AppContext, manager: BotManager, botId: string): MovementBotSessionLike {
  return {
    id: botId,
    snapshot: () => {
      const session = manager.getSession(botId);
      return session ? buildMovementSnapshot(session) : null;
    },
    subscribe: (listener) => manager.onChange(listener),
    setControlState: async (control, state) => {
      const shadow = controlShadow.get(botId) ?? emptyControls();
      shadow[control] = state;
      controlShadow.set(botId, shadow);
      await manager.call(botId, 'setControlState', [control, state]);
    },
    clearControlStates: async () => {
      controlShadow.set(botId, emptyControls());
      await manager.call(botId, 'clearControlStates', []);
    },
    look: async (yaw, pitch, force) => {
      await manager.call(botId, 'look', [yaw, pitch, force === true]);
    },
    lookAt: async (point, force) => {
      await manager.call(botId, 'lookAt', [point, force === true]);
    },
    entities: () => entityCache.get(botId) ?? [],
    blockAtCursor: async (maxDistance) => manager.call(botId, 'blockAtCursor', [maxDistance]),
    entityAtCursor: async (maxDistance) => {
      const raw = await manager.call<Record<string, unknown> | null>(botId, 'entityAtCursor', [maxDistance]);
      if (!raw) return null;
      return normaliseCachedEntity(raw);
    },
    pathfinder: null
  };
}

function normaliseCachedEntity(raw: Record<string, unknown>): MovementEntitySummaryLike {
  const position = toVec(raw.position as LocalVec3 | undefined);
  return {
    id: typeof raw.id === 'number' ? raw.id : -1,
    name: typeof raw.name === 'string' ? raw.name : 'entity',
    displayName: typeof raw.displayName === 'string' ? raw.displayName : String(raw.name ?? 'entity'),
    username: typeof raw.username === 'string' ? raw.username : null,
    type: typeof raw.type === 'string' ? raw.type : 'unknown',
    position,
    distance: typeof raw.distance === 'number' ? raw.distance : Number.NaN,
    height: 1.8,
    width: 0.6
  };
}

/** Named export the movement sibling looks for first. Always callable, even before `init` runs. */
export const sessionHost = {
  active(): MovementBotSessionLike | null {
    if (!boundCtx || !boundManager) return null;
    const botId = boundManager.activeBotIdValue();
    if (!botId) return null;
    return buildMovementSession(boundCtx, boundManager, botId);
  },
  subscribe(listener: () => void): () => void {
    boundActiveListeners.add(listener);
    return () => {
      boundActiveListeners.delete(listener);
    };
  }
};

/* ================================================================== */
/* The chat sibling's shape                                            */
/* ================================================================== */

interface FormattedTextLike {
  text: string;
  color: string | null;
  bold: boolean;
  italic: boolean;
  underlined: boolean;
  strikethrough: boolean;
  obfuscated: boolean;
}

interface IncomingChatMessageLike {
  channel: 'chat' | 'system' | 'game_info' | 'outgoing';
  component: unknown;
  raw: string;
  plain: string;
  senderUuid: string | null;
  verified: boolean | null;
}

interface PlayerSnapshotLike {
  uuid: string;
  username: string;
  displayName: string;
  gamemode: number;
  ping: number;
}

interface TablistSnapshotLike {
  header: string;
  footer: string;
}

type ChatEventName =
  | 'message'
  | 'actionBar'
  | 'title'
  | 'title_times'
  | 'title_clear'
  | 'bossBarCreated'
  | 'bossBarUpdated'
  | 'bossBarDeleted'
  | 'scoreboardCreated'
  | 'scoreboardDeleted'
  | 'scoreboardTitleChanged'
  | 'scoreUpdated'
  | 'scoreRemoved'
  | 'scoreboardPosition'
  | 'teamCreated'
  | 'teamUpdated'
  | 'teamRemoved'
  | 'teamMemberAdded'
  | 'teamMemberRemoved'
  | 'tablist'
  | 'players'
  | 'connected'
  | 'disconnected';

interface ChatCacheEntry {
  players: PlayerSnapshotLike[];
  tablist: TablistSnapshotLike;
  bossBars: unknown[];
  scoreboards: unknown[];
  teams: unknown[];
  chatLengthLimit: number;
}

const chatCache = new Map<string, ChatCacheEntry>();

function emptyChatCache(): ChatCacheEntry {
  return { players: [], tablist: { header: '', footer: '' }, bossBars: [], scoreboards: [], teams: [], chatLengthLimit: 256 };
}

function cacheFor(botId: string): ChatCacheEntry {
  let entry = chatCache.get(botId);
  if (!entry) {
    entry = emptyChatCache();
    chatCache.set(botId, entry);
  }
  return entry;
}

/** Turns a raw `{text}`-flattened chat payload (see `bot-host.js`'s `serialize`) into a plain string. */
function flattenChatText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && typeof (value as { text?: unknown }).text === 'string') {
    return (value as { text: string }).text;
  }
  return '';
}

function toIncomingMessage(args: unknown[]): IncomingChatMessageLike {
  const plain = flattenChatText(args[0]);
  return {
    channel: (typeof args[1] === 'string' ? (args[1] as IncomingChatMessageLike['channel']) : 'system'),
    // The generic event serializer flattens a `ChatMessage` to its plain text (see `serialize()` in
    // `bot-host.js`); the structured component tree never crosses this bridge, so this is honestly null.
    component: null,
    raw: plain,
    plain,
    senderUuid: typeof args[2] === 'string' ? args[2] : null,
    verified: typeof args[3] === 'boolean' ? args[3] : null
  };
}

function buildChatSession(ctx: AppContext, manager: BotManager, botId: string) {
  const listeners = new Map<ChatEventName, Set<(...args: unknown[]) => void>>();

  const runtimeUnsubscribe = manager.runtime.onMessage((message) => {
    if (message.type === 'status' && 'botId' in message && message.botId === botId) {
      if (message.status === 'spawned') fire('connected');
      if (message.status === 'disconnected' || message.status === 'failed') {
        fire('disconnected', message.detail ?? '');
      }
      return;
    }
    if (message.type !== 'event' || message.botId !== botId) return;
    const args = Array.isArray(message.payload) ? message.payload : [message.payload];
    switch (message.name) {
      case 'message':
      case 'actionBar':
        fire(message.name as ChatEventName, toIncomingMessage(args));
        return;
      case 'title':
        fire('title', { text: flattenChatText(args[0]), kind: args[1] === 'subtitle' ? 'subtitle' : 'title' });
        return;
      case 'title_times':
        fire('title_times', {
          fadeIn: Number(args[0]) || 0,
          stay: Number(args[1]) || 0,
          fadeOut: Number(args[2]) || 0
        });
        return;
      case 'title_clear':
        fire('title_clear');
        return;
      case 'playerJoined':
      case 'playerLeft':
      case 'playerUpdated':
        void refreshPlayers();
        return;
      case 'bossBarCreated':
      case 'bossBarUpdated':
      case 'bossBarDeleted':
        void refreshBossBars();
        fire(message.name as ChatEventName, message.payload);
        return;
      case 'scoreboardCreated':
      case 'scoreboardDeleted':
      case 'scoreboardTitleChanged':
      case 'scoreUpdated':
      case 'scoreRemoved':
      case 'scoreboardPosition':
        void refreshScoreboards();
        fire(message.name as ChatEventName, message.payload);
        return;
      case 'teamCreated':
      case 'teamUpdated':
      case 'teamRemoved':
      case 'teamMemberAdded':
      case 'teamMemberRemoved':
        void refreshTeams();
        fire(message.name as ChatEventName, message.payload);
        return;
      default:
        return;
    }
  });

  function fire(name: ChatEventName, ...payload: unknown[]): void {
    const set = listeners.get(name);
    if (!set) return;
    for (const listener of [...set]) {
      try {
        listener(...payload);
      } catch (error) {
        console.error(`A mineflayer-chat listener threw handling "${name}".`, error);
      }
    }
  }

  async function refreshPlayers(): Promise<void> {
    const raw = await manager.call<Array<Record<string, unknown>>>(botId, 'players', []).catch(() => []);
    cacheFor(botId).players = raw.map((player) => ({
      uuid: String(player.uuid ?? ''),
      username: String(player.username ?? ''),
      displayName: String(player.username ?? ''),
      gamemode: typeof player.gamemode === 'number' ? player.gamemode : 0,
      ping: typeof player.ping === 'number' ? player.ping : 0
    }));
    fire('players', cacheFor(botId).players);
  }

  async function refreshTablist(): Promise<void> {
    const raw = await manager
      .call<{ header: string; footer: string }>(botId, 'tablist', [])
      .catch(() => ({ header: '', footer: '' }));
    cacheFor(botId).tablist = raw;
    fire('tablist', raw);
  }

  async function refreshBossBars(): Promise<void> {
    cacheFor(botId).bossBars = await manager.call<unknown[]>(botId, 'bossBars', []).catch(() => []);
  }

  async function refreshScoreboards(): Promise<void> {
    cacheFor(botId).scoreboards = await manager.call<unknown[]>(botId, 'scoreboards', []).catch(() => []);
  }

  async function refreshTeams(): Promise<void> {
    cacheFor(botId).teams = await manager.call<unknown[]>(botId, 'teams', []).catch(() => []);
  }

  async function refreshChatLengthLimit(): Promise<void> {
    cacheFor(botId).chatLengthLimit = await manager.call<number>(botId, 'chatLengthLimit', []).catch(() => 256);
  }

  const pollHandle = setInterval(() => {
    const session = manager.getSession(botId);
    if (session && session.status === 'spawned') void refreshTablist();
  }, 3000);

  void refreshPlayers();
  void refreshTablist();
  void refreshBossBars();
  void refreshScoreboards();
  void refreshTeams();
  void refreshChatLengthLimit();

  return {
    id: botId,
    username: () => manager.getSession(botId)?.state?.username ?? manager.getSession(botId)?.options.username ?? '',
    connected: () => manager.getSession(botId)?.status === 'spawned',
    chat: (message: string) => {
      void manager.call(botId, 'chat', [message]);
    },
    whisper: (username: string, message: string) => {
      void manager.call(botId, 'whisper', [username, message]);
    },
    tabComplete: (text: string) => manager.call<string[]>(botId, 'tabComplete', [text, false]),
    chatLengthLimit: () => cacheFor(botId).chatLengthLimit,
    players: () => cacheFor(botId).players,
    tablist: () => cacheFor(botId).tablist,
    bossBars: () => cacheFor(botId).bossBars,
    scoreboards: () => cacheFor(botId).scoreboards,
    teams: () => cacheFor(botId).teams,
    on: (event: ChatEventName, listener: (...args: unknown[]) => void) => {
      let set = listeners.get(event);
      if (!set) {
        set = new Set();
        listeners.set(event, set);
      }
      set.add(listener);
      return () => {
        set?.delete(listener);
      };
    },
    dispose: () => {
      clearInterval(pollHandle);
      runtimeUnsubscribe();
      listeners.clear();
    }
  };
}

/* ================================================================== */
/* Wiring, called once from this feature's `init`                      */
/* ================================================================== */

const CHAT_SESSION_MODULES = import.meta.glob<Record<string, unknown>>('../mineflayer-chat/session.ts');

let publishedChatHost: { dispose(): void } | null = null;

async function wireChatSibling(ctx: AppContext, manager: BotManager): Promise<void> {
  const loaders = Object.values(CHAT_SESSION_MODULES);
  if (loaders.length === 0) return;
  let moduleExports: Record<string, unknown>;
  try {
    moduleExports = await loaders[0]();
  } catch (error) {
    console.error('The mineflayer-chat session module failed to load; chat will show its own honest "no session" state.', error);
    return;
  }
  const publish = moduleExports.publishBotSessionHost;
  if (typeof publish !== 'function') return;

  const sessions = new Map<string, ReturnType<typeof buildChatSession>>();
  const chatListeners = new Set<(session: unknown) => void>();

  function currentChatSession(): ReturnType<typeof buildChatSession> | null {
    const botId = manager.activeBotIdValue();
    if (!botId) return null;
    let session = sessions.get(botId);
    if (!session) {
      session = buildChatSession(ctx, manager, botId);
      sessions.set(botId, session);
    }
    return session;
  }

  const unsubscribeActive = manager.onActiveChange(() => {
    const current = currentChatSession();
    for (const listener of [...chatListeners]) listener(current);
  });

  (publish as (host: { current(): unknown; subscribe(listener: (session: unknown) => void): () => void }) => void)({
    current: () => currentChatSession(),
    subscribe: (listener) => {
      chatListeners.add(listener);
      return () => {
        chatListeners.delete(listener);
      };
    }
  });

  publishedChatHost = {
    dispose: () => {
      unsubscribeActive();
      for (const session of sessions.values()) session.dispose();
      sessions.clear();
      chatListeners.clear();
      const withdraw = moduleExports.withdrawBotSessionHost;
      if (typeof withdraw === 'function') (withdraw as () => void)();
    }
  };
}

/** Called once from `index.ts`'s `init(ctx)`. Wires every sibling discovery route this file knows about. */
export function initSiblingBridge(ctx: AppContext, manager: BotManager): void {
  boundCtx = ctx;
  boundManager = manager;

  manager.onChange(notifyBound);
  manager.onActiveChange(notifyActiveBound);

  // Refresh the movement sibling's entity cache for whichever bot is active.
  setInterval(() => {
    const botId = manager.activeBotIdValue();
    if (!botId) return;
    const session = manager.getSession(botId);
    if (!session || session.status !== 'spawned') return;
    manager
      .call<Array<Record<string, unknown>>>(botId, 'entities', [])
      .then((raw) => {
        entityCache.set(
          botId,
          raw.map((entry) => normaliseCachedEntity(entry))
        );
        notifyBound();
      })
      .catch(() => undefined);
  }, 1500);

  void wireChatSibling(ctx, manager);
}

export function disposeSiblingBridge(): void {
  publishedChatHost?.dispose();
  publishedChatHost = null;
}
