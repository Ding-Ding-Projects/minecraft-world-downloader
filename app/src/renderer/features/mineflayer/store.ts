/**
 * Saved bot profiles and the connection defaults new profiles start from.
 *
 * A profile is everything `ConnectionOptions` needs, minus the secret: host,
 * port, username, auth mode, version, proxy, view distance, chat settings and
 * reconnect policy. It is persisted through `ctx.settings`, exactly like any
 * other feature-owned data. The one exception is a `mojang`-auth account's
 * password, which never enters this file's data at all — it goes straight
 * into `ctx.studio.vault` under the account key this file computes, and comes
 * back out only at the moment a connection is actually made.
 */

import type { AppContext } from '../../core/registry';
import type { AuthMode, ChatLevel, ConnectionOptions, MainHand, ReconnectPolicy, ViewDistanceName } from './protocol';

export const PROFILES_SETTING_ID = 'mineflayer.profiles';

export const DEFAULT_VIEW_DISTANCE_ID = 'mineflayer.default.viewDistance';
export const DEFAULT_CHAT_ID = 'mineflayer.default.chat';
export const DEFAULT_AUTH_ID = 'mineflayer.default.auth';
export const DEFAULT_MAIN_HAND_ID = 'mineflayer.default.mainHand';
export const DEFAULT_RECONNECT_ENABLED_ID = 'mineflayer.default.reconnectEnabled';
export const DEFAULT_RECONNECT_MAX_ATTEMPTS_ID = 'mineflayer.default.reconnectMaxAttempts';
export const DEFAULT_RECONNECT_ON_KICK_ID = 'mineflayer.default.reconnectOnKick';
export const EVENT_BUFFER_SIZE_ID = 'mineflayer.eventBufferSize';

export const DEFAULT_EVENT_BUFFER_SIZE = 2000;

export interface BotProfile {
  id: string;
  name: string;
  options: ConnectionOptions;
  createdAt: string;
  updatedAt: string;
  lastConnectedAt: string | null;
}

/** Fields a stored profile might be missing after an older schema version. Every read repairs them. */
function coerceOptions(raw: unknown): ConnectionOptions {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Partial<ConnectionOptions> & {
    reconnect?: Partial<ReconnectPolicy>;
  };
  const reconnectSource = source.reconnect ?? {};
  return {
    host: typeof source.host === 'string' ? source.host : '',
    port: typeof source.port === 'number' && Number.isFinite(source.port) ? source.port : 25565,
    username: typeof source.username === 'string' ? source.username : '',
    auth: (source.auth as AuthMode) ?? 'offline',
    version: typeof source.version === 'string' ? source.version : '',
    proxyHost: typeof source.proxyHost === 'string' ? source.proxyHost : '',
    proxyPort: typeof source.proxyPort === 'number' && Number.isFinite(source.proxyPort) ? source.proxyPort : 1080,
    viewDistance: (source.viewDistance as ViewDistanceName) ?? 'normal',
    chat: (source.chat as ChatLevel) ?? 'enabled',
    colorsEnabled: source.colorsEnabled !== false,
    mainHand: (source.mainHand as MainHand) ?? 'right',
    difficulty: typeof source.difficulty === 'number' ? source.difficulty : 2,
    physicsEnabled: source.physicsEnabled !== false,
    respawn: source.respawn !== false,
    brand: typeof source.brand === 'string' && source.brand.length > 0 ? source.brand : 'vanilla',
    checkTimeoutInterval:
      typeof source.checkTimeoutInterval === 'number' && source.checkTimeoutInterval > 0
        ? source.checkTimeoutInterval
        : 30_000,
    chatLengthLimit: typeof source.chatLengthLimit === 'number' ? source.chatLengthLimit : 0,
    reconnect: {
      enabled: reconnectSource.enabled !== false,
      maxAttempts: typeof reconnectSource.maxAttempts === 'number' ? reconnectSource.maxAttempts : 0,
      initialDelayMs: typeof reconnectSource.initialDelayMs === 'number' ? reconnectSource.initialDelayMs : 5000,
      backoffFactor: typeof reconnectSource.backoffFactor === 'number' ? reconnectSource.backoffFactor : 2,
      maxDelayMs: typeof reconnectSource.maxDelayMs === 'number' ? reconnectSource.maxDelayMs : 120_000,
      onKick: reconnectSource.onKick === true
    }
  };
}

function coerceProfile(raw: unknown): BotProfile | null {
  if (!raw || typeof raw !== 'object') return null;
  const source = raw as Partial<BotProfile>;
  if (typeof source.id !== 'string' || source.id.length === 0) return null;
  const now = new Date().toISOString();
  return {
    id: source.id,
    name: typeof source.name === 'string' && source.name.length > 0 ? source.name : source.id,
    options: coerceOptions(source.options),
    createdAt: typeof source.createdAt === 'string' ? source.createdAt : now,
    updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : now,
    lastConnectedAt: typeof source.lastConnectedAt === 'string' ? source.lastConnectedAt : null
  };
}

export function newProfileId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return 'profile-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

/** The credential-vault account key holding a `mojang`-auth profile's password. Never anything else. */
export function vaultAccountFor(profileId: string): string {
  return `mineflayer.profile.${profileId}.password`;
}

export function defaultConnectionOptions(ctx: AppContext): ConnectionOptions {
  return {
    host: '',
    port: 25565,
    username: '',
    auth: ctx.settings.get<AuthMode>(DEFAULT_AUTH_ID, 'offline'),
    version: '',
    proxyHost: '',
    proxyPort: 1080,
    viewDistance: ctx.settings.get<ViewDistanceName>(DEFAULT_VIEW_DISTANCE_ID, 'normal'),
    chat: ctx.settings.get<ChatLevel>(DEFAULT_CHAT_ID, 'enabled'),
    colorsEnabled: true,
    mainHand: ctx.settings.get<MainHand>(DEFAULT_MAIN_HAND_ID, 'right'),
    difficulty: 2,
    physicsEnabled: true,
    respawn: true,
    brand: 'vanilla',
    checkTimeoutInterval: 30_000,
    chatLengthLimit: 0,
    reconnect: {
      enabled: ctx.settings.get<boolean>(DEFAULT_RECONNECT_ENABLED_ID, true),
      maxAttempts: ctx.settings.get<number>(DEFAULT_RECONNECT_MAX_ATTEMPTS_ID, 0),
      initialDelayMs: 5000,
      backoffFactor: 2,
      maxDelayMs: 120_000,
      onKick: ctx.settings.get<boolean>(DEFAULT_RECONNECT_ON_KICK_ID, false)
    }
  };
}

/** Declares every default this file owns, so `defaultOf`/`reset` work even though most of these never appear as their own settings control. */
export function declareStoreDefaults(ctx: AppContext): void {
  ctx.settings.declareDefault(PROFILES_SETTING_ID, []);
  ctx.settings.declareDefault(DEFAULT_VIEW_DISTANCE_ID, 'normal');
  ctx.settings.declareDefault(DEFAULT_CHAT_ID, 'enabled');
  ctx.settings.declareDefault(DEFAULT_AUTH_ID, 'offline');
  ctx.settings.declareDefault(DEFAULT_MAIN_HAND_ID, 'right');
  ctx.settings.declareDefault(DEFAULT_RECONNECT_ENABLED_ID, true);
  ctx.settings.declareDefault(DEFAULT_RECONNECT_MAX_ATTEMPTS_ID, 0);
  ctx.settings.declareDefault(DEFAULT_RECONNECT_ON_KICK_ID, false);
  ctx.settings.declareDefault(EVENT_BUFFER_SIZE_ID, DEFAULT_EVENT_BUFFER_SIZE);
}

/**
 * The persisted profile list.
 *
 * Every mutation writes the whole array back through `ctx.settings.set`, which
 * is the same contract every other feature uses for a small owned list; there
 * is no separate file and no separate schema version to keep in step with it.
 */
export class ProfileStore {
  private readonly ctx: AppContext;
  private readonly listeners = new Set<() => void>();

  constructor(ctx: AppContext) {
    this.ctx = ctx;
  }

  list(): BotProfile[] {
    const raw = this.ctx.settings.get<unknown[]>(PROFILES_SETTING_ID, []);
    if (!Array.isArray(raw)) return [];
    const profiles: BotProfile[] = [];
    for (const entry of raw) {
      const profile = coerceProfile(entry);
      if (profile) profiles.push(profile);
    }
    return profiles;
  }

  get(id: string): BotProfile | null {
    return this.list().find((profile) => profile.id === id) ?? null;
  }

  private persist(profiles: BotProfile[]): void {
    this.ctx.settings.set(PROFILES_SETTING_ID, profiles);
    for (const listener of [...this.listeners]) listener();
  }

  create(name: string, options: ConnectionOptions): BotProfile {
    const now = new Date().toISOString();
    const profile: BotProfile = { id: newProfileId(), name, options, createdAt: now, updatedAt: now, lastConnectedAt: null };
    this.persist([...this.list(), profile]);
    return profile;
  }

  update(id: string, patch: Partial<Pick<BotProfile, 'name' | 'options' | 'lastConnectedAt'>>): BotProfile | null {
    const profiles = this.list();
    const index = profiles.findIndex((profile) => profile.id === id);
    if (index < 0) return null;
    const updated: BotProfile = { ...profiles[index], ...patch, updatedAt: new Date().toISOString() };
    const next = [...profiles];
    next[index] = updated;
    this.persist(next);
    return updated;
  }

  /** Removes profiles and their vaulted passwords. Returns the ids actually removed. */
  async remove(ids: string[]): Promise<string[]> {
    const idSet = new Set(ids);
    const profiles = this.list();
    const removed = profiles.filter((profile) => idSet.has(profile.id));
    if (removed.length === 0) return [];
    this.persist(profiles.filter((profile) => !idSet.has(profile.id)));
    for (const profile of removed) {
      await this.ctx.studio.vault.delete(vaultAccountFor(profile.id)).catch(() => undefined);
    }
    return removed.map((profile) => profile.id);
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}
