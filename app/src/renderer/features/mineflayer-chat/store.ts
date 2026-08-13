/**
 * The runtime behind the chat surface.
 *
 * It owns the message log, the pattern rules and this window's copy of the
 * server's text surfaces. It owns no bot: it attaches to whichever session the
 * `mineflayer` feature has published and detaches cleanly when that session
 * goes away, so nothing here can keep a dead connection alive or open a second
 * one.
 *
 * Everything it renders is a real event value. While no session is attached the
 * read-outs are empty and say so, rather than showing the last thing they saw
 * as though it were still true.
 */

import type { AppContext } from '../../core/registry';
import { compile } from '../../core/regexbuilder';
import { plainTextOf, runsFor, stripLegacy } from './format';
import {
  ChatLog,
  KEYS,
  REPLY_BUDGET_DEFAULT,
  RETENTION_DEFAULT,
  coerceRule,
  expandPayload,
  nextRecordId,
  ruleSpeaks,
  serializeRule
} from './model';
import type { ChatRecord, ChatRule } from './model';
import { observeBotSession } from './session';
import type {
  BossBarSnapshot,
  BotChatSession,
  ChatChannel,
  IncomingChatMessage,
  PlayerSnapshot,
  ScoreboardSnapshot,
  TablistSnapshot,
  TeamSnapshot,
  TitleEvent,
  TitleTimes
} from './session';

/** What the surface re-reads whenever anything changes. */
export interface ServerTextState {
  players: PlayerSnapshot[];
  tablist: TablistSnapshot;
  bossBars: BossBarSnapshot[];
  scoreboards: ScoreboardSnapshot[];
  teams: TeamSnapshot[];
  title: string;
  subtitle: string;
  titleTimes: TitleTimes | null;
  /** The most recent action-bar line, which the game shows above the hotbar. */
  actionBar: string;
  actionBarAt: number | null;
}

export type StoreEvent = 'messages' | 'server' | 'rules' | 'session';

function emptyServerState(): ServerTextState {
  return {
    players: [],
    tablist: { header: '', footer: '' },
    bossBars: [],
    scoreboards: [],
    teams: [],
    title: '',
    subtitle: '',
    titleTimes: null,
    actionBar: '',
    actionBarAt: null
  };
}

/** Pulls a `<name>` prefix out of a vanilla-formatted line. */
const VANILLA_SENDER = /^<([^>]{1,32})>\s?/;

export class ChatStore {
  readonly log: ChatLog;

  private readonly ctx: AppContext;
  private readonly listeners = new Map<StoreEvent, Set<() => void>>();
  private readonly sessionReleases: Array<() => void> = [];

  private session: BotChatSession | null = null;
  private releaseObserver: (() => void) | null = null;
  private server: ServerTextState = emptyServerState();
  private rules: ChatRule[] = [];

  /** Timestamps of messages this surface sent on the user's behalf. */
  private readonly spokenAt: number[] = [];

  constructor(ctx: AppContext) {
    this.ctx = ctx;
    this.log = new ChatLog(ctx.settings.get<number>(KEYS.retention, RETENTION_DEFAULT));
    this.rules = this.readRules();
  }

  /* ---------------------------------------------------------------- */
  /* Lifecycle                                                         */
  /* ---------------------------------------------------------------- */

  /** Begins following whichever session the bot runtime has published. */
  start(): void {
    if (this.releaseObserver) return;
    this.releaseObserver = observeBotSession((session) => this.attach(session));
  }

  stop(): void {
    this.releaseObserver?.();
    this.releaseObserver = null;
    this.detach();
  }

  currentSession(): BotChatSession | null {
    return this.session;
  }

  connected(): boolean {
    return this.session !== null && this.session.connected();
  }

  /** Why sending is unavailable, or null when it is available. */
  unavailableReason(): string | null {
    if (!this.session) return 'noRuntime';
    if (!this.session.connected()) return 'disconnected';
    return null;
  }

  private attach(session: BotChatSession | null): void {
    this.detach();
    this.session = session;
    if (session) {
      this.bind(session);
      this.refreshServerState();
    } else {
      this.server = emptyServerState();
    }
    this.emit('session');
    this.emit('server');
  }

  private detach(): void {
    while (this.sessionReleases.length > 0) {
      const release = this.sessionReleases.pop();
      try {
        release?.();
      } catch {
        // A listener that has already been torn down by the owning feature is
        // not an error here; the point of releasing is that it ends up gone.
      }
    }
    this.session = null;
  }

  private bind(session: BotChatSession): void {
    const hold = (release: () => void): void => {
      this.sessionReleases.push(release);
    };

    hold(session.on('message', (message) => this.ingest(message)));
    hold(
      session.on('actionBar', (message) => {
        this.server.actionBar = message.plain.length > 0 ? message.plain : stripLegacy(message.raw);
        this.server.actionBarAt = Date.now();
        this.emit('server');
      })
    );
    hold(
      session.on('title', (event: TitleEvent) => {
        if (event.kind === 'title') this.server.title = event.text;
        else this.server.subtitle = event.text;
        this.emit('server');
      })
    );
    hold(
      session.on('title_times', (times) => {
        this.server.titleTimes = times;
        this.emit('server');
      })
    );
    hold(
      session.on('title_clear', () => {
        this.server.title = '';
        this.server.subtitle = '';
        this.server.titleTimes = null;
        this.emit('server');
      })
    );

    const resync = (): void => this.refreshServerState();
    for (const name of [
      'bossBarCreated',
      'bossBarUpdated',
      'bossBarDeleted',
      'scoreboardCreated',
      'scoreboardDeleted',
      'scoreboardTitleChanged',
      'scoreUpdated',
      'scoreRemoved',
      'scoreboardPosition',
      'teamCreated',
      'teamUpdated',
      'teamRemoved',
      'teamMemberAdded',
      'teamMemberRemoved',
      'tablist',
      'players'
    ] as const) {
      // Every one of these events carries the changed object, and the session
      // also exposes the whole current collection. Re-reading the collection is
      // both simpler and more honest than patching a local copy that can drift.
      hold(session.on(name, resync as never));
    }

    hold(
      session.on('connected', () => {
        this.refreshServerState();
        this.emit('session');
      })
    );
    hold(
      session.on('disconnected', () => {
        this.server = emptyServerState();
        this.emit('session');
        this.emit('server');
      })
    );
  }

  /* ---------------------------------------------------------------- */
  /* Server text state                                                 */
  /* ---------------------------------------------------------------- */

  serverState(): ServerTextState {
    return this.server;
  }

  refreshServerState(): void {
    const session = this.session;
    if (!session) {
      this.server = emptyServerState();
      this.emit('server');
      return;
    }
    this.server = {
      ...this.server,
      players: safely(() => session.players(), []),
      tablist: safely(() => session.tablist(), { header: '', footer: '' }),
      bossBars: safely(() => session.bossBars(), []),
      scoreboards: safely(() => session.scoreboards(), []),
      teams: safely(() => session.teams(), [])
    };
    this.emit('server');
  }

  /* ---------------------------------------------------------------- */
  /* Messages                                                          */
  /* ---------------------------------------------------------------- */

  private ingest(message: IncomingChatMessage): void {
    const record = this.toRecord(message);
    this.log.append(record);
    this.emit('messages');
    void this.runRules(record);
  }

  private toRecord(message: IncomingChatMessage): ChatRecord {
    const runs = runsFor(message.component, message.raw);
    const plain = message.plain.length > 0 ? message.plain : plainTextOf(message.component, message.raw);
    return {
      id: nextRecordId(),
      at: Date.now(),
      channel: message.channel,
      sender: this.resolveSender(message, plain),
      senderUuid: message.senderUuid,
      verified: message.verified,
      runs,
      plain,
      raw: message.raw
    };
  }

  /**
   * Establishes who spoke, or admits that it could not.
   *
   * A signed message carries the sender's UUID, which the tab list resolves to
   * a username. A vanilla-formatted line carries `<name>` at the front. Nothing
   * else does, and a system message genuinely has no sender — so the answer is
   * null rather than a plausible guess.
   */
  private resolveSender(message: IncomingChatMessage, plain: string): string | null {
    if (message.senderUuid) {
      const player = this.server.players.find((candidate) => candidate.uuid === message.senderUuid);
      if (player) return player.username;
    }
    if (message.channel === 'chat') {
      const matched = VANILLA_SENDER.exec(plain);
      if (matched) return matched[1];
    }
    return null;
  }

  /** Records a message this surface sent, on its own clearly separate channel. */
  recordOutgoing(text: string, channel: ChatChannel = 'outgoing'): void {
    this.log.append({
      id: nextRecordId(),
      at: Date.now(),
      channel,
      sender: this.session ? this.session.username() : null,
      senderUuid: null,
      verified: null,
      runs: [
        {
          text,
          color: null,
          bold: false,
          italic: false,
          underlined: false,
          strikethrough: false,
          obfuscated: false
        }
      ],
      plain: text,
      raw: text
    });
    this.emit('messages');
  }

  removeMessages(ids: Set<string>): number {
    const removed = this.log.remove(ids);
    if (removed > 0) this.emit('messages');
    return removed;
  }

  clearMessages(): number {
    const removed = this.log.clear();
    if (removed > 0) this.emit('messages');
    return removed;
  }

  setRetention(limit: number): void {
    this.log.setLimit(limit);
    this.emit('messages');
  }

  /* ---------------------------------------------------------------- */
  /* Rules                                                             */
  /* ---------------------------------------------------------------- */

  allRules(): ChatRule[] {
    return this.rules;
  }

  ruleById(id: string): ChatRule | null {
    return this.rules.find((rule) => rule.id === id) ?? null;
  }

  upsertRule(rule: ChatRule): void {
    const index = this.rules.findIndex((candidate) => candidate.id === rule.id);
    if (index >= 0) this.rules[index] = rule;
    else this.rules.push(rule);
    this.persistRules();
    this.emit('rules');
  }

  removeRules(ids: Set<string>): ChatRule[] {
    const removed = this.rules.filter((rule) => ids.has(rule.id));
    if (removed.length === 0) return [];
    this.rules = this.rules.filter((rule) => !ids.has(rule.id));
    this.persistRules();
    this.emit('rules');
    return removed;
  }

  setRuleEnabled(id: string, enabled: boolean): void {
    const rule = this.ruleById(id);
    if (!rule || rule.enabled === enabled) return;
    rule.enabled = enabled;
    this.persistRules();
    this.emit('rules');
  }

  private readRules(): ChatRule[] {
    const stored = this.ctx.settings.get<unknown[]>(KEYS.rules, []);
    if (!Array.isArray(stored)) return [];
    const rules: ChatRule[] = [];
    for (const entry of stored.slice(0, 200)) {
      const rule = coerceRule(entry);
      if (rule) rules.push(rule);
    }
    return rules;
  }

  private persistRules(): void {
    this.ctx.settings.set(KEYS.rules, this.rules.map(serializeRule));
  }

  /**
   * Runs the enabled rules against one message.
   *
   * Three separate guards stop this becoming a loop that talks to itself:
   * the `outgoing` channel is never matched, a message the bot itself sent is
   * never matched, and every rule that speaks carries a cooldown with a floor
   * plus a shared per-minute budget. A budget that is spent is reported, not
   * silently swallowed — a rule that has stopped firing must say so.
   */
  private async runRules(record: ChatRecord): Promise<void> {
    if (record.channel === 'outgoing') return;
    if (this.ctx.settings.get<boolean>(KEYS.rulesEnabled, true) !== true) return;

    const session = this.session;
    const own = session ? session.username() : null;
    if (own && record.sender === own) return;

    const now = Date.now();

    for (const rule of this.rules) {
      if (!rule.enabled) continue;
      if (!rule.channels.includes(record.channel)) continue;
      if (rule.lastFiredAt !== null && now - rule.lastFiredAt < rule.cooldownMs) continue;

      const { regex } = compile(rule.pattern, rule.flags);
      if (!regex) continue;

      const match = regex.exec(record.plain);
      if (!match) continue;

      rule.lastFiredAt = now;
      rule.fired += 1;
      this.emit('rules');

      const applied = await this.applyRule(rule, record, match);
      if (applied === 'stop') return;
    }
  }

  private async applyRule(
    rule: ChatRule,
    record: ChatRecord,
    match: RegExpMatchArray
  ): Promise<'continue' | 'stop'> {
    const label = rule.name.length > 0 ? rule.name : rule.pattern;

    if (rule.action === 'stop') return 'stop';

    if (rule.action === 'notify') {
      this.ctx.notify.show({
        title: this.ctx.t('mineflayer-chat.rule.matched', 'A chat rule matched'),
        body: this.ctx.t('mineflayer-chat.rule.matched.body', '{rule} matched: {message}', {
          values: { rule: label, message: record.plain.slice(0, 200) }
        }),
        severity: 'info',
        source: 'mineflayer-chat'
      });
      return 'continue';
    }

    const session = this.session;
    if (!session || !session.connected()) {
      this.ctx.notify.warn(
        this.ctx.t('mineflayer-chat.rule.notSent', 'A chat rule could not send'),
        this.ctx.t(
          'mineflayer-chat.rule.notSent.body',
          '{rule} matched, but the bot is not connected, so nothing was sent.',
          { values: { rule: label } }
        )
      );
      return 'continue';
    }

    if (!this.spendBudget()) {
      this.ctx.notify.warn(
        this.ctx.t('mineflayer-chat.rule.budget', 'The reply budget is spent'),
        this.ctx.t(
          'mineflayer-chat.rule.budget.body',
          '{rule} matched but was not sent: this surface has already sent its allowance of {budget} messages in the last minute. Raise the allowance in settings, or turn the rule off.',
          { values: { rule: label, budget: String(this.replyBudget()) } }
        )
      );
      return 'continue';
    }

    const text = expandPayload(rule.payload, match).trim();
    if (text.length === 0) return 'continue';

    const outgoing = rule.action === 'command' && !text.startsWith('/') ? `/${text}` : text;
    session.chat(outgoing);
    this.recordOutgoing(outgoing);
    await this.ctx.history.record(
      rule.action === 'command' ? 'Chat rule ran a command' : 'Chat rule sent a reply',
      'mineflayer-chat',
      { rule: rule.id, name: rule.name, action: rule.action, sent: outgoing }
    );
    return 'continue';
  }

  private replyBudget(): number {
    const raw = this.ctx.settings.get<number>(KEYS.replyBudget, REPLY_BUDGET_DEFAULT);
    return Number.isFinite(raw) ? Math.max(0, Math.round(raw)) : REPLY_BUDGET_DEFAULT;
  }

  /** Consumes one of this minute's allowance. False when it is already spent. */
  private spendBudget(): boolean {
    const budget = this.replyBudget();
    const now = Date.now();
    while (this.spokenAt.length > 0 && now - this.spokenAt[0] > 60000) this.spokenAt.shift();
    if (this.spokenAt.length >= budget) return false;
    this.spokenAt.push(now);
    return true;
  }

  /** How many of this minute's allowance remain, for the surface to show. */
  budgetRemaining(): { used: number; total: number } {
    const now = Date.now();
    while (this.spokenAt.length > 0 && now - this.spokenAt[0] > 60000) this.spokenAt.shift();
    return { used: this.spokenAt.length, total: this.replyBudget() };
  }

  /* ---------------------------------------------------------------- */
  /* Change notification                                               */
  /* ---------------------------------------------------------------- */

  on(event: StoreEvent, listener: () => void): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener);
    return () => {
      set?.delete(listener);
    };
  }

  private emit(event: StoreEvent): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const listener of [...set]) {
      try {
        listener();
      } catch (error) {
        console.error('The chat surface failed to redraw:', error);
      }
    }
  }
}

/** Reads a value the bot runtime provides, without letting it break the draw. */
function safely<T>(read: () => T, fallback: T): T {
  try {
    const value = read();
    return value ?? fallback;
  } catch {
    return fallback;
  }
}
