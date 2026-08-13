/**
 * Records, persistence and the shared in-memory state for the scraper bot runner.
 *
 * Two kinds of record live here and they are deliberately separate:
 *
 *   - a **profile** is the configuration the bundled Node scraper actually
 *     accepts, one field per recognised key in `scraper/config.example.json`;
 *   - a **captured message** is one line the running scraper genuinely emitted
 *     (or one line of a log file the user imported), parsed by a capture rule.
 *
 * Nothing here invents data. A fresh installation starts with no profiles and
 * no captured messages, and both surfaces say so honestly rather than seeding a
 * sample.
 */

import type { AppContext } from '../../core/registry';

/* ================================================================== */
/* Setting ids                                                         */
/* ================================================================== */

export const SCRAPER_DIR_ID = 'bot.scraperDirectory';
export const MESSAGE_LIMIT_ID = 'bot.messageLimit';
export const LOG_LIMIT_ID = 'bot.logLimit';
export const FOLLOW_LOG_ID = 'bot.followLog';
export const CAPTURE_ENABLED_ID = 'bot.captureFromRun';
export const EXPORT_FORMAT_ID = 'bot.exportFormat';
export const STOP_SIGNAL_ID = 'bot.stopSignal';

/** Data keys. These hold records rather than user-tunable settings. */
export const PROFILES_KEY = 'bot.data.profiles';
export const MESSAGES_KEY = 'bot.data.messages';
export const RULES_KEY = 'bot.data.captureRules';
export const LAST_PROFILE_KEY = 'bot.data.lastProfileId';

/** Element ids the palette teleports to. */
export const PROFILE_LIST_ELEMENT = 'bot-profile-list';
export const RUN_CONTROLS_ELEMENT = 'bot-run-controls';
export const LOG_ELEMENT = 'bot-run-log';
export const MESSAGES_ELEMENT = 'bot-message-table';

export const TAB_ID = 'bot.runner';

/* ================================================================== */
/* Profiles                                                            */
/* ================================================================== */

export type AuthMode = 'offline' | 'microsoft';
export type AreaMode = 'center' | 'bbox' | 'spawn';

export interface BoundingBox {
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
}

/**
 * One saved configuration for the bundled scraper.
 *
 * Every field maps onto a key the scraper reads. `loginPasswordAccount` is the
 * one exception: it is the credential-vault account key, never the password
 * itself, so a profile can be exported, recorded in history and read on screen
 * without a secret leaving the vault.
 */
export interface BotProfile {
  id: string;
  name: string;
  /** The proxy address, never the real server. */
  host: string;
  port: number;
  /** Empty means auto-detect, which the scraper spells `false`. */
  version: string;
  auth: AuthMode;
  /** One entry per bot. The grid is partitioned across them. */
  usernames: string[];
  areaMode: AreaMode;
  center: { x: number; z: number };
  radius: number;
  bbox: BoundingBox;
  chunkStep: number;
  flyWhenAble: boolean;
  preferFly: boolean;
  walkWhenGrounded: boolean;
  flyAltitude: number;
  arriveRadius: number;
  waypointTimeoutMs: number;
  loadWaitMs: number;
  containerDwellMs: number;
  finalDrainMs: number;
  visitedFile: string;
  revisit: boolean;
  autoLogin: boolean;
  /** Credential-vault account key holding the AuthMe password, or empty. */
  loginPasswordAccount: string;
  stuckCheckMs: number;
  stuckEpsilon: number;
  loginStaggerMs: number;
  /** Directory containing `scrape.js`. Empty falls back to the global setting. */
  scraperDirectory: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

/** The compiled-in defaults, taken from the scraper's own `loadConfig`. */
export function blankProfile(id: string, name: string): BotProfile {
  const now = new Date().toISOString();
  return {
    id,
    name,
    host: '127.0.0.1',
    port: 25565,
    version: '',
    auth: 'offline',
    usernames: ['Scraper'],
    areaMode: 'center',
    center: { x: 0, z: 0 },
    radius: 256,
    bbox: { minX: -256, minZ: -256, maxX: 256, maxZ: 256 },
    chunkStep: 1,
    flyWhenAble: true,
    preferFly: false,
    walkWhenGrounded: true,
    flyAltitude: 120,
    arriveRadius: 6,
    waypointTimeoutMs: 20000,
    loadWaitMs: 600,
    containerDwellMs: 0,
    finalDrainMs: 6000,
    visitedFile: '',
    revisit: false,
    autoLogin: false,
    loginPasswordAccount: '',
    stuckCheckMs: 4000,
    stuckEpsilon: 1.5,
    loginStaggerMs: 4000,
    scraperDirectory: '',
    notes: '',
    createdAt: now,
    updatedAt: now
  };
}

/** Repairs a stored record so an older or hand-edited file cannot crash a read. */
export function normaliseProfile(raw: unknown, fallbackId: string): BotProfile {
  const base = blankProfile(fallbackId, 'Recovered profile');
  if (!raw || typeof raw !== 'object') return base;
  const source = raw as Record<string, unknown>;
  const str = (key: string, fallback: string): string =>
    typeof source[key] === 'string' ? (source[key] as string) : fallback;
  const num = (key: string, fallback: number): number => {
    const value = Number(source[key]);
    return Number.isFinite(value) ? value : fallback;
  };
  const bool = (key: string, fallback: boolean): boolean =>
    typeof source[key] === 'boolean' ? (source[key] as boolean) : fallback;

  const usernames = Array.isArray(source.usernames)
    ? (source.usernames as unknown[]).filter((name): name is string => typeof name === 'string' && name.length > 0)
    : base.usernames;

  const centreRaw = source.center as Record<string, unknown> | undefined;
  const boxRaw = source.bbox as Record<string, unknown> | undefined;
  const coord = (holder: Record<string, unknown> | undefined, key: string, fallback: number): number => {
    const value = Number(holder?.[key]);
    return Number.isFinite(value) ? value : fallback;
  };

  const areaMode = source.areaMode;
  return {
    ...base,
    id: str('id', fallbackId),
    name: str('name', base.name),
    host: str('host', base.host),
    port: num('port', base.port),
    version: str('version', base.version),
    auth: source.auth === 'microsoft' ? 'microsoft' : 'offline',
    usernames: usernames.length > 0 ? usernames : base.usernames,
    areaMode: areaMode === 'bbox' || areaMode === 'spawn' ? areaMode : 'center',
    center: { x: coord(centreRaw, 'x', 0), z: coord(centreRaw, 'z', 0) },
    radius: num('radius', base.radius),
    bbox: {
      minX: coord(boxRaw, 'minX', base.bbox.minX),
      minZ: coord(boxRaw, 'minZ', base.bbox.minZ),
      maxX: coord(boxRaw, 'maxX', base.bbox.maxX),
      maxZ: coord(boxRaw, 'maxZ', base.bbox.maxZ)
    },
    chunkStep: num('chunkStep', base.chunkStep),
    flyWhenAble: bool('flyWhenAble', base.flyWhenAble),
    preferFly: bool('preferFly', base.preferFly),
    walkWhenGrounded: bool('walkWhenGrounded', base.walkWhenGrounded),
    flyAltitude: num('flyAltitude', base.flyAltitude),
    arriveRadius: num('arriveRadius', base.arriveRadius),
    waypointTimeoutMs: num('waypointTimeoutMs', base.waypointTimeoutMs),
    loadWaitMs: num('loadWaitMs', base.loadWaitMs),
    containerDwellMs: num('containerDwellMs', base.containerDwellMs),
    finalDrainMs: num('finalDrainMs', base.finalDrainMs),
    visitedFile: str('visitedFile', base.visitedFile),
    revisit: bool('revisit', base.revisit),
    autoLogin: bool('autoLogin', base.autoLogin),
    loginPasswordAccount: str('loginPasswordAccount', ''),
    stuckCheckMs: num('stuckCheckMs', base.stuckCheckMs),
    stuckEpsilon: num('stuckEpsilon', base.stuckEpsilon),
    loginStaggerMs: num('loginStaggerMs', base.loginStaggerMs),
    scraperDirectory: str('scraperDirectory', ''),
    notes: str('notes', ''),
    createdAt: str('createdAt', base.createdAt),
    updatedAt: str('updatedAt', base.updatedAt)
  };
}

/* ================================================================== */
/* Captured messages and log lines                                     */
/* ================================================================== */

export type MessageChannel = 'chat' | 'system' | 'auth' | 'progress' | 'disconnect' | 'error';

export const MESSAGE_CHANNELS: MessageChannel[] = [
  'chat',
  'system',
  'auth',
  'progress',
  'disconnect',
  'error'
];

export interface CapturedMessage {
  id: string;
  /** ISO-8601. The moment the line was captured, or a time parsed out of it. */
  timestamp: string;
  /** True when `timestamp` came from the line itself rather than the clock. */
  timestampFromLine: boolean;
  sender: string;
  channel: MessageChannel;
  message: string;
  /** Free-form labels the user attaches in bulk. */
  tags: string[];
  /** Profile the run belonged to, or the imported file's name. */
  origin: string;
  source: 'run' | 'import';
}

export type LogSeverity = 'info' | 'warning' | 'error';

export interface LogLine {
  id: string;
  timestamp: string;
  severity: LogSeverity;
  stream: 'stdout' | 'stderr' | 'runner';
  text: string;
}

/* ================================================================== */
/* Capture rules                                                       */
/* ================================================================== */

/**
 * One pattern that turns a raw output line into a captured message.
 *
 * The shipped rules match the shapes the bundled scraper genuinely prints. They
 * are ordinary editable records: a user can disable them, change them, or add
 * their own through the pattern builder, and the surface says which rule
 * produced which row.
 */
export interface CaptureRule {
  id: string;
  name: string;
  enabled: boolean;
  pattern: string;
  flags: string;
  /** `{n}` substitutes capture group n; anything else is literal. */
  senderTemplate: string;
  messageGroup: number;
  /** 0 means the line carries no time of its own and the clock is used. */
  timestampGroup: number;
  channel: MessageChannel;
  /** Shipped rules can be reset; user rules cannot be "reset" to anything. */
  builtIn: boolean;
}

export function builtInRules(): CaptureRule[] {
  return [
    {
      id: 'bot.rule.chat',
      name: 'Chat line',
      enabled: true,
      pattern: '^(?:\\[bot(\\d+)\\]\\s+)?<([^>]{1,32})>\\s*(.+)$',
      flags: '',
      senderTemplate: '{2}',
      messageGroup: 3,
      timestampGroup: 0,
      channel: 'chat',
      builtIn: true
    },
    {
      id: 'bot.rule.consoleChat',
      name: 'Server console chat line',
      enabled: true,
      pattern: '^\\[(\\d{2}:\\d{2}:\\d{2})\\].*?<([^>]{1,32})>\\s*(.+)$',
      flags: '',
      senderTemplate: '{2}',
      messageGroup: 3,
      timestampGroup: 1,
      channel: 'chat',
      builtIn: true
    },
    {
      id: 'bot.rule.kick',
      name: 'Kick or disconnect reason',
      enabled: true,
      pattern: '^\\[bot(\\d+)\\]\\s+(?:kicked|disconnected):\\s*(.+)$',
      flags: '',
      senderTemplate: 'bot{1}',
      messageGroup: 2,
      timestampGroup: 0,
      channel: 'disconnect',
      builtIn: true
    },
    {
      id: 'bot.rule.error',
      name: 'Bot error',
      enabled: true,
      pattern: '^\\[bot(\\d+)\\]\\s+(?:error|failed to start):\\s*(.+)$',
      flags: '',
      senderTemplate: 'bot{1}',
      messageGroup: 2,
      timestampGroup: 0,
      channel: 'error',
      builtIn: true
    },
    {
      id: 'bot.rule.auth',
      name: 'Sign-in message',
      enabled: true,
      pattern: '^\\[auth\\]\\s+(.+)$',
      flags: '',
      senderTemplate: 'auth',
      messageGroup: 1,
      timestampGroup: 0,
      channel: 'auth',
      builtIn: true
    },
    {
      id: 'bot.rule.msaCode',
      name: 'Microsoft device code',
      enabled: true,
      pattern: '^MSA_CODE\\s+(\\{.*\\})$',
      flags: '',
      senderTemplate: 'scraper',
      messageGroup: 1,
      timestampGroup: 0,
      channel: 'auth',
      builtIn: true
    },
    {
      id: 'bot.rule.progress',
      name: 'Progress report',
      enabled: true,
      pattern: '^\\[bot(\\d+)\\]\\s+((?:spawned at|visited|done|draining|centering|gamemode)\\b.*)$',
      flags: '',
      senderTemplate: 'bot{1}',
      messageGroup: 2,
      timestampGroup: 0,
      channel: 'progress',
      builtIn: true
    }
  ];
}

export function normaliseRule(raw: unknown, fallbackId: string): CaptureRule | null {
  if (!raw || typeof raw !== 'object') return null;
  const source = raw as Record<string, unknown>;
  const pattern = typeof source.pattern === 'string' ? source.pattern : '';
  if (pattern.length === 0) return null;
  const channel = source.channel;
  return {
    id: typeof source.id === 'string' && source.id.length > 0 ? source.id : fallbackId,
    name: typeof source.name === 'string' && source.name.length > 0 ? source.name : 'Capture rule',
    enabled: source.enabled !== false,
    pattern,
    flags: typeof source.flags === 'string' ? source.flags.replace(/[^gimsuy]/g, '') : '',
    senderTemplate: typeof source.senderTemplate === 'string' ? source.senderTemplate : '{1}',
    messageGroup: Number.isFinite(Number(source.messageGroup)) ? Number(source.messageGroup) : 1,
    timestampGroup: Number.isFinite(Number(source.timestampGroup)) ? Number(source.timestampGroup) : 0,
    channel: MESSAGE_CHANNELS.includes(channel as MessageChannel) ? (channel as MessageChannel) : 'system',
    builtIn: source.builtIn === true
  };
}

/* ================================================================== */
/* Ids                                                                 */
/* ================================================================== */

let counter = 0;

/** Monotonic within a session and prefixed, so ids never collide across kinds. */
export function newId(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}`;
}

/* ================================================================== */
/* The store                                                           */
/* ================================================================== */

type Listener = () => void;

/**
 * The feature's own state, persisted through the settings store so it survives
 * a restart and participates in the application's settings file like every
 * other record.
 */
export class BotStore {
  private profiles: BotProfile[] = [];
  private messages: CapturedMessage[] = [];
  private rules: CaptureRule[] = [];
  private readonly listeners = new Set<Listener>();

  constructor(private readonly ctx: AppContext) {
    this.reload();
  }

  reload(): void {
    const storedProfiles = this.ctx.settings.get<unknown[]>(PROFILES_KEY, []);
    this.profiles = Array.isArray(storedProfiles)
      ? storedProfiles.map((raw, index) => normaliseProfile(raw, `bot-profile-recovered-${index}`))
      : [];

    const storedMessages = this.ctx.settings.get<unknown[]>(MESSAGES_KEY, []);
    this.messages = Array.isArray(storedMessages)
      ? storedMessages
          .map((raw) => this.normaliseMessage(raw))
          .filter((row): row is CapturedMessage => row !== null)
      : [];

    const storedRules = this.ctx.settings.get<unknown[]>(RULES_KEY, []);
    const restored = Array.isArray(storedRules)
      ? storedRules
          .map((raw, index) => normaliseRule(raw, `bot-rule-recovered-${index}`))
          .filter((rule): rule is CaptureRule => rule !== null)
      : [];
    this.rules = restored.length > 0 ? restored : builtInRules();
  }

  private normaliseMessage(raw: unknown): CapturedMessage | null {
    if (!raw || typeof raw !== 'object') return null;
    const source = raw as Record<string, unknown>;
    const message = typeof source.message === 'string' ? source.message : '';
    if (message.length === 0) return null;
    const channel = source.channel;
    return {
      id: typeof source.id === 'string' ? source.id : newId('bot-msg'),
      timestamp: typeof source.timestamp === 'string' ? source.timestamp : new Date().toISOString(),
      timestampFromLine: source.timestampFromLine === true,
      sender: typeof source.sender === 'string' ? source.sender : 'unknown',
      channel: MESSAGE_CHANNELS.includes(channel as MessageChannel) ? (channel as MessageChannel) : 'system',
      message,
      tags: Array.isArray(source.tags)
        ? (source.tags as unknown[]).filter((tag): tag is string => typeof tag === 'string')
        : [],
      origin: typeof source.origin === 'string' ? source.origin : '',
      source: source.source === 'import' ? 'import' : 'run'
    };
  }

  /* ---- subscription ---- */

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    for (const listener of [...this.listeners]) listener();
  }

  /* ---- profiles ---- */

  listProfiles(): BotProfile[] {
    return [...this.profiles];
  }

  profile(id: string): BotProfile | null {
    return this.profiles.find((candidate) => candidate.id === id) ?? null;
  }

  saveProfile(profile: BotProfile): void {
    const next = { ...profile, updatedAt: new Date().toISOString() };
    const index = this.profiles.findIndex((candidate) => candidate.id === profile.id);
    if (index >= 0) this.profiles[index] = next;
    else this.profiles.push(next);
    this.persistProfiles();
  }

  removeProfiles(ids: string[]): BotProfile[] {
    const removed = this.profiles.filter((profile) => ids.includes(profile.id));
    this.profiles = this.profiles.filter((profile) => !ids.includes(profile.id));
    this.persistProfiles();
    return removed;
  }

  private persistProfiles(): void {
    this.ctx.settings.set(PROFILES_KEY, this.profiles as unknown);
    this.emit();
  }

  lastProfileId(): string {
    return this.ctx.settings.get<string>(LAST_PROFILE_KEY, '');
  }

  setLastProfileId(id: string): void {
    this.ctx.settings.set(LAST_PROFILE_KEY, id);
  }

  /* ---- messages ---- */

  listMessages(): CapturedMessage[] {
    return [...this.messages];
  }

  addMessages(rows: CapturedMessage[]): number {
    if (rows.length === 0) return 0;
    this.messages.push(...rows);
    const limit = Math.max(100, Number(this.ctx.settings.get<number>(MESSAGE_LIMIT_ID, 5000)));
    let dropped = 0;
    if (this.messages.length > limit) {
      dropped = this.messages.length - limit;
      this.messages = this.messages.slice(dropped);
    }
    this.persistMessages();
    return dropped;
  }

  removeMessages(ids: string[]): CapturedMessage[] {
    const set = new Set(ids);
    const removed = this.messages.filter((row) => set.has(row.id));
    this.messages = this.messages.filter((row) => !set.has(row.id));
    this.persistMessages();
    return removed;
  }

  clearMessages(): number {
    const count = this.messages.length;
    this.messages = [];
    this.persistMessages();
    return count;
  }

  setTags(ids: string[], tag: string, add: boolean): number {
    const set = new Set(ids);
    let changed = 0;
    for (const row of this.messages) {
      if (!set.has(row.id)) continue;
      const has = row.tags.includes(tag);
      if (add && !has) {
        row.tags = [...row.tags, tag];
        changed += 1;
      } else if (!add && has) {
        row.tags = row.tags.filter((existing) => existing !== tag);
        changed += 1;
      }
    }
    if (changed > 0) this.persistMessages();
    return changed;
  }

  /** Every tag currently in use, so the tag picker is populated from real data. */
  knownTags(): string[] {
    const seen = new Set<string>();
    for (const row of this.messages) for (const tag of row.tags) seen.add(tag);
    return [...seen].sort((a, b) => a.localeCompare(b));
  }

  private persistMessages(): void {
    this.ctx.settings.set(MESSAGES_KEY, this.messages as unknown);
    this.emit();
  }

  /* ---- capture rules ---- */

  listRules(): CaptureRule[] {
    return [...this.rules];
  }

  saveRule(rule: CaptureRule): void {
    const index = this.rules.findIndex((candidate) => candidate.id === rule.id);
    if (index >= 0) this.rules[index] = rule;
    else this.rules.push(rule);
    this.persistRules();
  }

  removeRules(ids: string[]): CaptureRule[] {
    const removed = this.rules.filter((rule) => ids.includes(rule.id));
    this.rules = this.rules.filter((rule) => !ids.includes(rule.id));
    this.persistRules();
    return removed;
  }

  restoreBuiltInRules(): void {
    const custom = this.rules.filter((rule) => !rule.builtIn);
    this.rules = [...builtInRules(), ...custom];
    this.persistRules();
  }

  private persistRules(): void {
    this.ctx.settings.set(RULES_KEY, this.rules as unknown);
    this.emit();
  }
}

let store: BotStore | null = null;

export function initStore(ctx: AppContext): BotStore {
  store = new BotStore(ctx);
  return store;
}

export function requireStore(): BotStore | null {
  if (!store) console.error('The scraper bot feature was used before its init ran.');
  return store;
}
