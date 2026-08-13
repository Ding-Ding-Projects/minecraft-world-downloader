/**
 * Turns "one host process, many bot sessions" into the per-bot API this
 * feature's own tabs and every sibling mineflayer feature actually use.
 *
 * Every live bot — whether it was launched from a saved profile or a one-off
 * quick connect — gets a `LiveBotSession` here: its latest `BotState`, its
 * connection status, a bounded ring buffer of every real library event it has
 * fired (row 15.18's event inspector reads straight from this), and the
 * Microsoft sign-in code when one is pending. One of the live sessions may be
 * "active"; that is the session the connection tab shows by default and the
 * one `bridge.ts` publishes to sibling features, which each drive a single
 * bot at a time.
 */

import type { AppContext } from '../../core/registry';
import { DEFAULT_EVENT_SUBSCRIPTION, type BotState, type BotStatus, type ConnectionOptions, type HostMessage } from './protocol';
import { BotRuntimeClient } from './runtime';
import { ProfileStore, newProfileId, vaultAccountFor, EVENT_BUFFER_SIZE_ID, DEFAULT_EVENT_BUFFER_SIZE, type BotProfile } from './store';

export interface EventLogEntry {
  seq: number;
  botId: string;
  /** The real library event name, or a synthetic marker (`__dropped__`) noting loss under the rate budget. */
  name: string;
  at: number;
  payload: unknown;
}

export type ConnectSource = { kind: 'profile'; profileId: string; profileName: string } | { kind: 'quick' };

export interface LiveBotSession {
  botId: string;
  source: ConnectSource;
  options: ConnectionOptions;
  status: BotStatus;
  statusDetail: string | null;
  state: BotState | null;
  endReason: string | null;
  signIn: { code: string; url: string; message: string } | null;
  events: EventLogEntry[];
  droppedTotal: number;
  connectedAt: number | null;
  subscription: string[];
}

function nowIso(): string {
  return new Date().toISOString();
}

export class BotManager {
  private readonly ctx: AppContext;
  readonly runtime: BotRuntimeClient;
  readonly profiles: ProfileStore;

  private readonly sessions = new Map<string, LiveBotSession>();
  private activeBotId: string | null = null;
  private eventSeq = 0;
  private readonly hostLog: EventLogEntry[] = [];

  private readonly changeListeners = new Set<() => void>();
  private readonly activeListeners = new Set<() => void>();
  private readonly hostLogListeners = new Set<() => void>();

  constructor(ctx: AppContext, runtime: BotRuntimeClient, profiles: ProfileStore) {
    this.ctx = ctx;
    this.runtime = runtime;
    this.profiles = profiles;
    this.runtime.onMessage((message) => this.handleHostMessage(message));
  }

  private emitChange(): void {
    for (const listener of [...this.changeListeners]) listener();
  }

  private emitActiveChange(): void {
    for (const listener of [...this.activeListeners]) listener();
  }

  private emitHostLog(): void {
    for (const listener of [...this.hostLogListeners]) listener();
  }

  onChange(listener: () => void): () => void {
    this.changeListeners.add(listener);
    return () => {
      this.changeListeners.delete(listener);
    };
  }

  onActiveChange(listener: () => void): () => void {
    this.activeListeners.add(listener);
    return () => {
      this.activeListeners.delete(listener);
    };
  }

  onHostLog(listener: () => void): () => void {
    this.hostLogListeners.add(listener);
    return () => {
      this.hostLogListeners.delete(listener);
    };
  }

  listSessions(): LiveBotSession[] {
    return [...this.sessions.values()].sort((a, b) => a.botId.localeCompare(b.botId));
  }

  getSession(botId: string): LiveBotSession | null {
    return this.sessions.get(botId) ?? null;
  }

  activeBotIdValue(): string | null {
    return this.activeBotId;
  }

  activeSession(): LiveBotSession | null {
    return this.activeBotId ? (this.sessions.get(this.activeBotId) ?? null) : null;
  }

  setActive(botId: string | null): void {
    if (botId !== null && !this.sessions.has(botId)) return;
    if (this.activeBotId === botId) return;
    this.activeBotId = botId;
    this.emitActiveChange();
  }

  hostLogEntries(): EventLogEntry[] {
    return this.hostLog;
  }

  private eventBufferSize(): number {
    const value = this.ctx.settings.get<number>(EVENT_BUFFER_SIZE_ID, DEFAULT_EVENT_BUFFER_SIZE);
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : DEFAULT_EVENT_BUFFER_SIZE;
  }

  private pushHostLog(name: string, payload: unknown): void {
    this.eventSeq += 1;
    this.hostLog.push({ seq: this.eventSeq, botId: '', name, at: Date.now(), payload });
    const limit = this.eventBufferSize();
    while (this.hostLog.length > limit) this.hostLog.shift();
    this.emitHostLog();
  }

  private register(botId: string, source: ConnectSource, options: ConnectionOptions): LiveBotSession {
    const session: LiveBotSession = {
      botId,
      source,
      options,
      status: 'idle',
      statusDetail: null,
      state: null,
      endReason: null,
      signIn: null,
      events: [],
      droppedTotal: 0,
      connectedAt: null,
      subscription: [...DEFAULT_EVENT_SUBSCRIPTION]
    };
    this.sessions.set(botId, session);
    if (!this.activeBotId) this.activeBotId = botId;
    this.emitChange();
    if (this.activeBotId === botId) this.emitActiveChange();
    return session;
  }

  private resolveBotId(preferred?: string): string {
    if (preferred && !this.sessions.has(preferred)) return preferred;
    let candidate = preferred ?? newProfileId();
    while (this.sessions.has(candidate)) candidate = newProfileId();
    return candidate;
  }

  /** Connects a saved profile. Reads its `mojang` password from the vault only for this one call. */
  async connectProfile(profileId: string): Promise<string> {
    const profile = this.profiles.get(profileId);
    if (!profile) {
      throw new Error(this.ctx.t('mineflayer.manager.profileMissing', 'That saved profile no longer exists.'));
    }
    let secret: string | undefined;
    if (profile.options.auth === 'mojang') {
      const stored = await this.ctx.studio.vault.get(vaultAccountFor(profile.id));
      secret = stored.ok && typeof stored.value === 'string' ? stored.value : undefined;
    }
    const botId = this.resolveBotId(profile.id);
    this.register(botId, { kind: 'profile', profileId: profile.id, profileName: profile.name }, profile.options);
    await this.runtime.connect(botId, profile.options, secret);
    this.profiles.update(profile.id, { lastConnectedAt: nowIso() });
    return botId;
  }

  /** Connects without ever creating a saved profile. */
  async connectQuick(options: ConnectionOptions, secret?: string): Promise<string> {
    const botId = this.resolveBotId();
    this.register(botId, { kind: 'quick' }, options);
    await this.runtime.connect(botId, options, secret);
    return botId;
  }

  async disconnect(botId: string, reason: string): Promise<void> {
    await this.runtime.disconnect(botId, reason);
  }

  /** Disconnects if needed, tells the host to drop the session entirely, and removes the local record. */
  async forget(botId: string): Promise<void> {
    const session = this.sessions.get(botId);
    if (session && (session.status === 'connected' || session.status === 'spawned' || session.status === 'reconnecting')) {
      await this.runtime.disconnect(botId, this.ctx.t('mineflayer.manager.forgetReason', 'Session closed.')).catch(() => undefined);
    }
    await this.runtime.forget(botId).catch(() => undefined);
    this.sessions.delete(botId);
    if (this.activeBotId === botId) {
      const next = this.listSessions()[0]?.botId ?? null;
      this.activeBotId = next;
      this.emitActiveChange();
    }
    this.emitChange();
  }

  /** Clears one bot's retained event log without touching its connection. */
  clearEvents(botId: string): void {
    const session = this.sessions.get(botId);
    if (!session) return;
    session.events = [];
    session.droppedTotal = 0;
    this.emitChange();
  }

  async setEventSubscription(botId: string, events: string[]): Promise<void> {
    await this.runtime.subscribe(botId, events);
    const session = this.sessions.get(botId);
    if (session) {
      session.subscription = [...events];
      this.emitChange();
    }
  }

  async call<T = unknown>(botId: string, method: string, args: unknown[] = []): Promise<T> {
    return this.runtime.call<T>(botId, method, args);
  }

  private handleHostMessage(message: HostMessage): void {
    if (message.type === 'log') {
      this.pushHostLog('log:' + message.level, message.text);
      return;
    }
    if (message.type === 'fault') {
      this.pushHostLog('fault', message.message);
      this.ctx.notify.error(this.ctx.t('mineflayer.manager.fault', 'The bot runtime reported a fault'), message.message);
      return;
    }

    const session = 'botId' in message ? this.sessions.get(message.botId) : undefined;
    if (!session) return;

    if (message.type === 'status') {
      session.status = message.status;
      session.statusDetail = message.detail;
      if (message.status === 'spawned' && session.connectedAt === null) session.connectedAt = message.at;
      if (message.status !== 'spawned' && message.status !== 'connected' && message.status !== 'reconnecting') {
        session.signIn = null;
      }
      this.emitChange();
      return;
    }
    if (message.type === 'state') {
      session.state = message.state;
      session.endReason = message.state.endReason;
      this.emitChange();
      return;
    }
    if (message.type === 'event') {
      this.eventSeq += 1;
      session.events.push({ seq: this.eventSeq, botId: session.botId, name: message.name, at: message.at, payload: message.payload });
      const limit = this.eventBufferSize();
      while (session.events.length > limit) session.events.shift();
      this.emitChange();
      return;
    }
    if (message.type === 'dropped') {
      session.droppedTotal += message.count;
      this.eventSeq += 1;
      session.events.push({
        seq: this.eventSeq,
        botId: session.botId,
        name: '__dropped__',
        at: message.at,
        payload: { count: message.count, total: session.droppedTotal }
      });
      const limit = this.eventBufferSize();
      while (session.events.length > limit) session.events.shift();
      this.emitChange();
      return;
    }
    if (message.type === 'signin') {
      session.signIn = { code: message.code, url: message.url, message: message.message };
      this.emitChange();
      this.ctx.notify.show({
        title: this.ctx.t('mineflayer.manager.signInTitle', 'Microsoft sign-in needed: enter {code}', { values: { code: message.code } }),
        body: message.message || message.url,
        severity: 'warning',
        source: 'mineflayer',
        actions: message.url
          ? [
              {
                label: this.ctx.t('mineflayer.manager.signInOpen', 'Open the sign-in page'),
                run: () => {
                  void this.ctx.studio.shell.openExternal(message.url);
                }
              }
            ]
          : undefined
      });
      return;
    }
  }

  async disposeAll(): Promise<void> {
    await this.runtime.dispose();
  }
}

export type { BotProfile };
