/**
 * The chat surface's view of the shared bot session.
 *
 * This file defines a contract and nothing else: it never constructs a bot, it
 * never opens a socket, and it holds no session of its own. The bot runtime is
 * owned by the `mineflayer` feature, which publishes its live session here with
 * one call. Two features cannot both own a connection to a game server without
 * the server seeing two players, so ownership is deliberately one-directional.
 *
 * Every name in the event map and every method below is taken from the vendored
 * library in `vendor/mineflayer` — `lib/plugins/chat.js`, `title.js`,
 * `tablist.js`, `boss_bar.js`, `scoreboard.js`, `team.js` and the published
 * `index.d.ts`. Nothing here is invented, and nothing here renames an upstream
 * event: a renamed event is an event that never fires, silently.
 *
 * The runtime handoff is a plain object on `globalThis`, because a feature
 * directory may be imported by a sibling but may never be edited by one. The
 * owning feature calls `publishBotSessionHost` once; this surface subscribes.
 * Until that happens the surface renders its honest disconnected state rather
 * than pretending to have a session.
 */

/* ================================================================== */
/* Message and text shapes                                             */
/* ================================================================== */

/**
 * One run of text carrying the game's own styling.
 *
 * The library hands chat over as a `prismarine-chat` message. Both of its
 * representations reach us: a structured component tree on modern servers and a
 * legacy string carrying section-sign codes on older ones. Both are reduced to
 * this, so the renderer has exactly one thing to draw.
 */
export interface FormattedRun {
  text: string;
  /** A vanilla colour name (`red`, `dark_blue`, …) or a `#rrggbb` literal. */
  color: string | null;
  bold: boolean;
  italic: boolean;
  underlined: boolean;
  strikethrough: boolean;
  obfuscated: boolean;
}

/**
 * The message-position channels the library distinguishes.
 *
 * `chat`, `system` and `game_info` are the exact position strings emitted by
 * `lib/plugins/chat.js`. `outgoing` is not a server channel: it is this
 * surface's own record of what it asked the bot to say, kept separate so it can
 * never be mistaken for something the server sent back.
 */
export type ChatChannel = 'chat' | 'system' | 'game_info' | 'outgoing';

export const CHAT_CHANNELS: ChatChannel[] = ['chat', 'system', 'game_info', 'outgoing'];

/** A message as it arrived, before this surface adds an id or a timestamp. */
export interface IncomingChatMessage {
  /** The position string the library emitted. */
  channel: ChatChannel;
  /** The raw JSON chat component, when the server sent one. */
  component: unknown;
  /** The library's own flattened string, section-sign codes included. */
  raw: string;
  /** The same text with every formatting code removed. */
  plain: string;
  /** The sending player's UUID when the server identified one. */
  senderUuid: string | null;
  /** True when the server signed the message and the signature verified. */
  verified: boolean | null;
}

export interface TitleEvent {
  text: string;
  kind: 'title' | 'subtitle';
}

export interface TitleTimes {
  fadeIn: number;
  stay: number;
  fadeOut: number;
}

/* ================================================================== */
/* Server text surfaces                                                */
/* ================================================================== */

export interface PlayerSnapshot {
  uuid: string;
  username: string;
  /** The rendered display name, formatting codes included. */
  displayName: string;
  /** The numeric game mode the tab list carries: 0..3. */
  gamemode: number;
  /** Round-trip time in milliseconds, as the server reports it. */
  ping: number;
}

export interface TablistSnapshot {
  header: string;
  footer: string;
}

export interface BossBarSnapshot {
  entityUUID: string;
  title: string;
  /** 0..1. The library passes the server's value through unchanged. */
  health: number;
  dividers: number;
  color: string;
  shouldDarkenSky: boolean;
  isDragonBar: boolean;
  createFog: boolean;
}

export interface ScoreboardItemSnapshot {
  name: string;
  displayName: string;
  value: number;
}

export interface ScoreboardSnapshot {
  name: string;
  title: string;
  items: ScoreboardItemSnapshot[];
  /** Display slots currently showing this objective (`sidebar`, `list`, …). */
  slots: string[];
}

export interface TeamSnapshot {
  /** The team's internal name, which is what commands address. */
  team: string;
  /** The team's display name, formatting codes included. */
  name: string;
  color: string;
  prefix: string;
  suffix: string;
  friendlyFire: boolean;
  nameTagVisibility: string;
  collisionRule: string;
  members: string[];
}

/* ================================================================== */
/* Events                                                              */
/* ================================================================== */

/**
 * The events this surface listens for.
 *
 * The keys are the library's own event names. `message` and `actionBar` come
 * from `chat.js`; `title` and `title_clear` from `title.js`; the boss bar,
 * scoreboard and team events from their respective plugins. `connected`,
 * `disconnected` and `players` are the owning feature's own lifecycle
 * signals — the library has no single event that means "the session changed",
 * so the owner raises one.
 */
export interface BotChatEvents {
  message: (message: IncomingChatMessage) => void;
  actionBar: (message: IncomingChatMessage) => void;
  title: (event: TitleEvent) => void;
  title_times: (times: TitleTimes) => void;
  title_clear: () => void;
  bossBarCreated: (bar: BossBarSnapshot) => void;
  bossBarUpdated: (bar: BossBarSnapshot) => void;
  bossBarDeleted: (bar: BossBarSnapshot) => void;
  scoreboardCreated: (board: ScoreboardSnapshot) => void;
  scoreboardDeleted: (board: ScoreboardSnapshot) => void;
  scoreboardTitleChanged: (board: ScoreboardSnapshot) => void;
  scoreUpdated: (board: ScoreboardSnapshot) => void;
  scoreRemoved: (board: ScoreboardSnapshot) => void;
  scoreboardPosition: (slot: string, board: ScoreboardSnapshot | null) => void;
  teamCreated: (team: TeamSnapshot) => void;
  teamUpdated: (team: TeamSnapshot) => void;
  teamRemoved: (team: TeamSnapshot) => void;
  teamMemberAdded: (team: TeamSnapshot) => void;
  teamMemberRemoved: (team: TeamSnapshot) => void;
  tablist: (tablist: TablistSnapshot) => void;
  players: (players: PlayerSnapshot[]) => void;
  connected: () => void;
  disconnected: (reason: string) => void;
}

export type BotChatEventName = keyof BotChatEvents;

/* ================================================================== */
/* The session                                                         */
/* ================================================================== */

/**
 * A live bot, seen through the narrow slice this surface needs.
 *
 * Everything is a method rather than a property so the owning feature can serve
 * the current value from the real bot at the moment it is asked, instead of
 * handing out a snapshot that silently goes stale.
 */
export interface BotChatSession {
  /** Stable id of this session, so several bots do not mix their state. */
  readonly id: string;
  /** The bot's own username, used to recognise its own echoed messages. */
  username(): string;
  connected(): boolean;
  /** `bot.chat` — sends on the public channel, or runs a leading-slash command. */
  chat(message: string): void;
  /** `bot.whisper` — sends `/tell <username> <message>`. */
  whisper(username: string, message: string): void;
  /** `bot.tabComplete` — the server's own completions for a partial command. */
  tabComplete(text: string): Promise<string[]>;
  /**
   * The chat length limit in force, which the library derives from
   * `chatLengthLimit` or the protocol version: 100 characters where the server
   * supports fewer characters in chat, 256 otherwise.
   */
  chatLengthLimit(): number;
  players(): PlayerSnapshot[];
  tablist(): TablistSnapshot;
  bossBars(): BossBarSnapshot[];
  scoreboards(): ScoreboardSnapshot[];
  teams(): TeamSnapshot[];
  on<K extends BotChatEventName>(event: K, listener: BotChatEvents[K]): () => void;
}

/** What the owning feature publishes. */
export interface BotSessionHost {
  /** The session in focus, or null while nothing is connected. */
  current(): BotChatSession | null;
  /** Fires whenever the session in focus is replaced or cleared. */
  subscribe(listener: (session: BotChatSession | null) => void): () => void;
}

/* ================================================================== */
/* The runtime handoff                                                 */
/* ================================================================== */

const HOST_KEY = '__worldDownloaderStudioBotSessionHost';

interface HostCarrier {
  [HOST_KEY]?: BotSessionHost;
}

function carrier(): HostCarrier {
  return globalThis as unknown as HostCarrier;
}

const watchers = new Set<(host: BotSessionHost | null) => void>();

/**
 * Publishes the live bot session host.
 *
 * The `mineflayer` feature calls this once from its own `init`. It is exported
 * from this file rather than that one because a feature may import a sibling
 * directory but may never edit one, and the surface that consumes the session
 * is the natural place for the contract that describes it to live.
 */
export function publishBotSessionHost(host: BotSessionHost): void {
  carrier()[HOST_KEY] = host;
  for (const watcher of [...watchers]) watcher(host);
}

/** Withdraws a previously published host, for a runtime that is shutting down. */
export function withdrawBotSessionHost(): void {
  delete carrier()[HOST_KEY];
  for (const watcher of [...watchers]) watcher(null);
}

/** The published host, or null while the bot runtime has not published one. */
export function botSessionHost(): BotSessionHost | null {
  return carrier()[HOST_KEY] ?? null;
}

/** Fires when a host is published or withdrawn. Never fires for a session swap. */
export function watchBotSessionHost(listener: (host: BotSessionHost | null) => void): () => void {
  watchers.add(listener);
  return () => {
    watchers.delete(listener);
  };
}

/**
 * Follows the session in focus across both levels of indirection: a host being
 * published at all, and that host swapping which bot is in focus.
 *
 * The listener is called immediately with the current state, so a caller never
 * has to ask separately and never renders an unknown state for one frame.
 */
export function observeBotSession(listener: (session: BotChatSession | null) => void): () => void {
  let releaseSession: (() => void) | null = null;

  const attach = (host: BotSessionHost | null): void => {
    releaseSession?.();
    releaseSession = null;
    if (!host) {
      listener(null);
      return;
    }
    releaseSession = host.subscribe(listener);
    listener(host.current());
  };

  const releaseHost = watchBotSessionHost(attach);
  attach(botSessionHost());

  return () => {
    releaseHost();
    releaseSession?.();
    releaseSession = null;
  };
}
