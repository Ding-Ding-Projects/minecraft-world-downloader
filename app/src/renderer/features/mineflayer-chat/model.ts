/**
 * What this surface stores: the message log and the pattern rules.
 *
 * The log is bounded. A busy server produces several messages a second and a
 * session left open all evening would otherwise grow without limit until the
 * window slows down and then stops. The retention is a setting, it is stated on
 * the surface, and dropping the oldest message is visible rather than silent.
 */

import type { ChatChannel, FormattedRun } from './session';

/* ================================================================== */
/* Settings keys                                                       */
/* ================================================================== */

export const KEYS = {
  retention: 'mineflayer-chat.retention',
  timestamps: 'mineflayer-chat.timestamps',
  autoScroll: 'mineflayer-chat.autoScroll',
  channels: 'mineflayer-chat.channels',
  rules: 'mineflayer-chat.rules',
  rulesEnabled: 'mineflayer-chat.rulesEnabled',
  replyBudget: 'mineflayer-chat.replyBudget',
  exportFormat: 'mineflayer-chat.exportFormat'
} as const;

export const RETENTION_DEFAULT = 2000;
export const RETENTION_MIN = 100;
export const RETENTION_MAX = 20000;

/** The most messages this surface will send per minute on the user's behalf. */
export const REPLY_BUDGET_DEFAULT = 6;
export const REPLY_BUDGET_MIN = 0;
export const REPLY_BUDGET_MAX = 30;

/* ================================================================== */
/* Messages                                                            */
/* ================================================================== */

export interface ChatRecord {
  id: string;
  /** Milliseconds since the epoch, taken when the message reached this window. */
  at: number;
  channel: ChatChannel;
  /**
   * The sender's name when one could be established: from the tab list by UUID
   * for a signed message, or from the leading `<name>` of a vanilla-formatted
   * line. Null when the server sent no sender, which is normal for a system
   * message and is shown as such rather than guessed at.
   */
  sender: string | null;
  senderUuid: string | null;
  /** True when the server signed the message and the signature verified. */
  verified: boolean | null;
  /** The styled runs, ready to draw. */
  runs: FormattedRun[];
  /** The words with no formatting, for search, matching and export. */
  plain: string;
  /** The library's own string, section signs included, for a faithful export. */
  raw: string;
}

let sequence = 0;

export function nextRecordId(): string {
  sequence += 1;
  return `m${sequence.toString(36)}`;
}

/**
 * A bounded, append-only message log.
 *
 * `dropped` is kept and shown: a log that quietly discards its oldest lines
 * looks identical to one that never received them, and the difference matters
 * when somebody is trying to work out whether they missed something.
 */
export class ChatLog {
  private records: ChatRecord[] = [];
  private droppedCount = 0;
  private limit: number;

  constructor(limit: number) {
    this.limit = clampRetention(limit);
  }

  setLimit(limit: number): void {
    this.limit = clampRetention(limit);
    this.trim();
  }

  currentLimit(): number {
    return this.limit;
  }

  append(record: ChatRecord): void {
    this.records.push(record);
    this.trim();
  }

  all(): ChatRecord[] {
    return this.records;
  }

  byId(id: string): ChatRecord | null {
    return this.records.find((record) => record.id === id) ?? null;
  }

  dropped(): number {
    return this.droppedCount;
  }

  size(): number {
    return this.records.length;
  }

  /** Removes the named records. Returns how many actually went. */
  remove(ids: Set<string>): number {
    const before = this.records.length;
    this.records = this.records.filter((record) => !ids.has(record.id));
    return before - this.records.length;
  }

  clear(): number {
    const removed = this.records.length;
    this.records = [];
    return removed;
  }

  /** Counts per channel, over the whole log rather than the filtered view. */
  counts(): Record<ChatChannel, number> {
    const counts: Record<ChatChannel, number> = { chat: 0, system: 0, game_info: 0, outgoing: 0 };
    for (const record of this.records) counts[record.channel] += 1;
    return counts;
  }

  private trim(): void {
    if (this.records.length <= this.limit) return;
    const excess = this.records.length - this.limit;
    this.records.splice(0, excess);
    this.droppedCount += excess;
  }
}

export function clampRetention(value: number): number {
  if (!Number.isFinite(value)) return RETENTION_DEFAULT;
  return Math.min(RETENTION_MAX, Math.max(RETENTION_MIN, Math.round(value)));
}

/* ================================================================== */
/* Pattern rules                                                       */
/* ================================================================== */

export type RuleAction = 'notify' | 'reply' | 'command' | 'stop';

export const RULE_ACTIONS: RuleAction[] = ['notify', 'reply', 'command', 'stop'];

export interface ChatRule {
  id: string;
  name: string;
  enabled: boolean;
  /** The regular expression source, as the pattern builder produced it. */
  pattern: string;
  flags: string;
  /** Channels the rule is allowed to look at. Never includes `outgoing`. */
  channels: ChatChannel[];
  action: RuleAction;
  /**
   * The reply text or the command, depending on the action. `$1`..`$9` are
   * replaced with the pattern's capture groups, and `$0` with the whole match.
   */
  payload: string;
  /** Milliseconds this rule must wait before it may fire again. */
  cooldownMs: number;
  /** How many times it has fired since the application started. */
  fired: number;
  /** When it last fired, or null. Not persisted between runs. */
  lastFiredAt: number | null;
}

/** The smallest cooldown a rule that speaks is allowed to have. */
export const SPEAKING_COOLDOWN_MIN_MS = 2000;
export const COOLDOWN_DEFAULT_MS = 5000;
export const COOLDOWN_MAX_MS = 600000;

export function ruleSpeaks(rule: ChatRule): boolean {
  return rule.action === 'reply' || rule.action === 'command';
}

export function minimumCooldown(action: RuleAction): number {
  return action === 'reply' || action === 'command' ? SPEAKING_COOLDOWN_MIN_MS : 0;
}

let ruleSequence = 0;

export function nextRuleId(): string {
  ruleSequence += 1;
  return `rule-${Date.now().toString(36)}-${ruleSequence.toString(36)}`;
}

export function newRule(): ChatRule {
  return {
    id: nextRuleId(),
    name: '',
    enabled: false,
    pattern: '',
    flags: 'i',
    channels: ['chat', 'system', 'game_info'],
    action: 'notify',
    payload: '',
    cooldownMs: COOLDOWN_DEFAULT_MS,
    fired: 0,
    lastFiredAt: null
  };
}

/**
 * Reads a rule back out of the settings file.
 *
 * Everything is bounded and type-checked, because the settings file is an
 * ordinary file a user may edit by hand and a rule that speaks on their behalf
 * is not something to construct out of whatever happens to be on disk.
 */
export function coerceRule(value: unknown): ChatRule | null {
  if (value === null || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const pattern = typeof raw.pattern === 'string' ? raw.pattern.slice(0, 500) : '';
  if (pattern.length === 0) return null;

  const action: RuleAction = RULE_ACTIONS.includes(raw.action as RuleAction)
    ? (raw.action as RuleAction)
    : 'notify';

  const channels = Array.isArray(raw.channels)
    ? raw.channels.filter(
        (channel): channel is ChatChannel =>
          channel === 'chat' || channel === 'system' || channel === 'game_info'
      )
    : [];

  const cooldownRaw = typeof raw.cooldownMs === 'number' ? raw.cooldownMs : COOLDOWN_DEFAULT_MS;
  const cooldown = Math.min(
    COOLDOWN_MAX_MS,
    Math.max(minimumCooldown(action), Math.round(Number.isFinite(cooldownRaw) ? cooldownRaw : COOLDOWN_DEFAULT_MS))
  );

  return {
    id: typeof raw.id === 'string' && raw.id.length > 0 ? raw.id.slice(0, 80) : nextRuleId(),
    name: typeof raw.name === 'string' ? raw.name.slice(0, 120) : '',
    enabled: raw.enabled === true,
    pattern,
    flags: typeof raw.flags === 'string' ? sanitizeFlags(raw.flags) : 'i',
    channels: channels.length > 0 ? channels : ['chat', 'system', 'game_info'],
    action,
    payload: typeof raw.payload === 'string' ? raw.payload.slice(0, 400) : '',
    cooldownMs: cooldown,
    fired: 0,
    lastFiredAt: null
  };
}

/**
 * Keeps only flags that make sense for a single-line match.
 *
 * `g` and `y` are deliberately dropped: both carry `lastIndex` between calls, so
 * a rule reusing one compiled expression would match every other message and
 * look intermittently broken rather than wrong.
 */
export function sanitizeFlags(flags: string): string {
  const allowed = new Set(['i', 'm', 's', 'u']);
  const kept: string[] = [];
  for (const flag of flags) {
    if (allowed.has(flag) && !kept.includes(flag)) kept.push(flag);
  }
  return kept.join('');
}

/** The persisted shape, which never carries the live counters. */
export function serializeRule(rule: ChatRule): Record<string, unknown> {
  return {
    id: rule.id,
    name: rule.name,
    enabled: rule.enabled,
    pattern: rule.pattern,
    flags: rule.flags,
    channels: rule.channels,
    action: rule.action,
    payload: rule.payload,
    cooldownMs: rule.cooldownMs
  };
}

/** Substitutes `$0`..`$9` with the match and its capture groups. */
export function expandPayload(payload: string, match: RegExpMatchArray): string {
  return payload.replace(/\$([0-9])/g, (_whole, digit: string) => {
    const index = Number(digit);
    const value = match[index];
    return typeof value === 'string' ? value : '';
  });
}
