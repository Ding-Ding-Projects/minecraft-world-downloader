/**
 * Where a rule's answer comes from.
 *
 * Three sources, one contract. A local rule answers instantly from its own
 * assignments. An HTTPS endpoint answers with a version, a gate and a bounded set
 * of setting values. A Home Assistant boolean entity answers with a gate alone,
 * and the rule's own assignments supply the values.
 *
 * Every outbound request goes through the privileged main-process boundary, which
 * refuses redirects, refuses credentials embedded in a URL, refuses plain HTTP to
 * anything but a loopback address and bounds the response. This module adds the
 * parts the boundary cannot know about: an allow-list of the exact hosts a rule
 * asked for, a floor under the refresh interval, a generation guard so a slow
 * answer cannot overwrite a newer one, and a failure path that keeps the last
 * good answer instead of inventing a fresh one.
 *
 * Nothing here logs a token, a response body or a URL query string.
 */

import { LIMITS, checkUrl, vaultAccountFor } from './schema';
import type { ScheduleRule } from './schema';
import type { StudioApi } from '../../core/registry';

/* ------------------------------------------------------------------ */
/* Status                                                              */
/* ------------------------------------------------------------------ */

export type SourceState =
  | 'local'
  | 'never-run'
  | 'running'
  | 'ok'
  | 'gate-closed'
  | 'stale'
  | 'failed'
  | 'offline'
  | 'unauthorized'
  | 'rate-limited'
  | 'refused';

export interface SourceStatus {
  ruleId: string;
  kind: ScheduleRule['source']['kind'];
  state: SourceState;
  /** True only when a live, validated answer says the rule may apply. */
  gateOpen: boolean;
  /** Values an HTTPS source supplied. Empty for the other two kinds. */
  remoteAssignments: Array<{ settingId: string; value: unknown }>;
  /** Setting ids the endpoint sent that this application does not have. */
  rejectedFields: string[];
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  /** Exact, user-facing reason for the current state. Never a stack trace. */
  message: string;
  consecutiveFailures: number;
  /** Earliest instant the next attempt may be made, honouring back-off. */
  nextAttemptAt: number;
}

/** What the engine lets an endpoint write, and how a value is checked. */
export interface SettingGuard {
  /** True when this application actually registers that setting id. */
  isKnown(settingId: string): boolean;
  /** True when the id may be scheduled at all (School mode, own keys, actions). */
  isSchedulable(settingId: string): boolean;
  /** Coerces and validates one value against the owning control. */
  coerce(settingId: string, value: unknown): { ok: boolean; value: unknown; error: string };
}

export interface ResolverOptions {
  studio: StudioApi;
  guard: SettingGuard;
  /** Milliseconds. Clamped into the schema's bounds before use. */
  timeoutMs(): number;
}

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

function localStatus(rule: ScheduleRule): SourceStatus {
  return {
    ruleId: rule.id,
    kind: 'local',
    state: 'local',
    gateOpen: true,
    remoteAssignments: [],
    rejectedFields: [],
    lastAttemptAt: null,
    lastSuccessAt: null,
    message: 'This rule answers from its own stored values and makes no network request.',
    consecutiveFailures: 0,
    nextAttemptAt: 0
  };
}

function backoffMs(failures: number, baseSeconds: number): number {
  // Doubling, capped at eight times the configured interval, so a server that is
  // down is asked less and less rather than being hammered on a fixed schedule.
  const multiplier = Math.min(8, 2 ** Math.max(0, failures - 1));
  return baseSeconds * 1000 * multiplier;
}

/** Strips anything from a URL that could carry a secret before it is shown or recorded. */
export function safeUrlLabel(raw: string): string {
  try {
    const url = new URL(raw);
    return `${url.protocol}//${url.host}${url.pathname}`;
  } catch {
    return '(unreadable address)';
  }
}

/* ------------------------------------------------------------------ */
/* Resolver                                                            */
/* ------------------------------------------------------------------ */

export class SourceResolver {
  private readonly statuses = new Map<string, SourceStatus>();
  private readonly generations = new Map<string, number>();
  private readonly inFlight = new Set<string>();
  private readonly allowed = new Set<string>();
  private readonly listeners = new Set<() => void>();

  constructor(private readonly options: ResolverOptions) {}

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    for (const listener of [...this.listeners]) {
      try {
        listener();
      } catch (error) {
        console.error('A schedule source listener threw:', error);
      }
    }
  }

  status(rule: ScheduleRule): SourceStatus {
    if (rule.source.kind === 'local') return localStatus(rule);
    const existing = this.statuses.get(rule.id);
    if (existing && existing.kind === rule.source.kind) return existing;
    const fresh: SourceStatus = {
      ruleId: rule.id,
      kind: rule.source.kind,
      state: 'never-run',
      gateOpen: false,
      remoteAssignments: [],
      rejectedFields: [],
      lastAttemptAt: null,
      lastSuccessAt: null,
      message: 'This rule has not asked its source yet. It applies nothing until it has a real answer.',
      consecutiveFailures: 0,
      nextAttemptAt: 0
    };
    this.statuses.set(rule.id, fresh);
    return fresh;
  }

  /** Drops everything remembered about rules that no longer exist. */
  prune(liveRuleIds: Set<string>): void {
    for (const id of [...this.statuses.keys()]) {
      if (!liveRuleIds.has(id)) {
        this.statuses.delete(id);
        this.generations.delete(id);
      }
    }
  }

  /** Forgets one rule's cached answer, so the next refresh starts clean. */
  forget(ruleId: string): void {
    this.statuses.delete(ruleId);
    this.generations.set(ruleId, (this.generations.get(ruleId) ?? 0) + 1);
    this.emit();
  }

  /**
   * True when this rule is due to ask its source again.
   *
   * `becameActive` forces one refresh at the moment a window opens, which is the
   * behaviour the contract asks for: a rule that has been idle all day does not
   * apply a stale answer the instant it wakes up.
   */
  isDue(rule: ScheduleRule, now: number, becameActive: boolean): boolean {
    if (rule.source.kind === 'local') return false;
    if (this.inFlight.has(rule.id)) return false;
    const status = this.status(rule);
    if (becameActive) return true;
    if (status.state === 'never-run') return true;
    return now >= status.nextAttemptAt;
  }

  /**
   * Asks one rule's source.
   *
   * Failure is never thrown at the caller. It becomes a status the interface can
   * render, so a schedule tick can never be interrupted by an unreachable server.
   */
  async refresh(rule: ScheduleRule): Promise<SourceStatus> {
    if (rule.source.kind === 'local') return localStatus(rule);
    if (this.inFlight.has(rule.id)) return this.status(rule);

    const generation = (this.generations.get(rule.id) ?? 0) + 1;
    this.generations.set(rule.id, generation);
    this.inFlight.add(rule.id);

    const previous = this.status(rule);
    this.write(rule.id, { ...previous, state: 'running', message: 'Asking the source now.' });

    try {
      const result =
        rule.source.kind === 'https-api'
          ? await this.askHttpsApi(rule)
          : await this.askHomeAssistant(rule);
      // A slower earlier request must never overwrite this one: the generation
      // counter is the only thing that decides whose answer is current.
      if ((this.generations.get(rule.id) ?? 0) !== generation) return this.status(rule);
      this.write(rule.id, result);
      return result;
    } finally {
      this.inFlight.delete(rule.id);
    }
  }

  private write(ruleId: string, status: SourceStatus): void {
    this.statuses.set(ruleId, status);
    this.emit();
  }

  /** Registers the host with the privileged boundary, once per host per session. */
  private async allowHost(host: string, scheme: 'http' | 'https', reason: string): Promise<string | null> {
    const key = `${scheme}:${host}`;
    if (this.allowed.has(key)) return null;
    const result = await this.options.studio.http.allow({
      host,
      schemes: [scheme],
      owner: 'scheduled-settings',
      reason
    });
    if (!result.ok) return result.error;
    this.allowed.add(key);
    return null;
  }

  /** Revokes hosts no rule asks for any more. */
  async revokeUnused(rules: ScheduleRule[]): Promise<void> {
    const wanted = new Set<string>();
    for (const rule of rules) {
      if (!rule.enabled) continue;
      if (rule.source.kind === 'https-api') {
        const check = checkUrl(rule.source.url);
        if (check.ok) wanted.add(`${check.scheme}:${check.host}`);
      } else if (rule.source.kind === 'home-assistant') {
        const check = checkUrl(rule.source.baseUrl);
        if (check.ok) wanted.add(`${check.scheme}:${check.host}`);
      }
    }
    for (const key of [...this.allowed]) {
      if (wanted.has(key)) continue;
      const host = key.slice(key.indexOf(':') + 1);
      this.allowed.delete(key);
      await this.options.studio.http.revoke(host).catch(() => undefined);
    }
  }

  private timeout(): number {
    const raw = this.options.timeoutMs();
    return Math.min(LIMITS.maxTimeoutMs, Math.max(LIMITS.minTimeoutMs, Math.round(raw)));
  }

  private failure(
    rule: ScheduleRule,
    state: SourceState,
    message: string,
    refreshSeconds: number
  ): SourceStatus {
    const previous = this.status(rule);
    const failures = previous.consecutiveFailures + 1;
    const keepGate = previous.lastSuccessAt !== null;
    return {
      ...previous,
      kind: rule.source.kind,
      state: keepGate ? 'stale' : state,
      // The last answer that genuinely arrived is kept rather than replaced by a
      // guess. Nothing new is applied, and the interface says the answer is stale.
      gateOpen: keepGate ? previous.gateOpen : false,
      remoteAssignments: keepGate ? previous.remoteAssignments : [],
      lastAttemptAt: new Date().toISOString(),
      message: keepGate
        ? `${message} The last answer that arrived is still in effect and is marked stale.`
        : `${message} Nothing was applied.`,
      consecutiveFailures: failures,
      nextAttemptAt: Date.now() + backoffMs(failures, refreshSeconds)
    };
  }

  /* ---------------- HTTPS API ---------------- */

  private async askHttpsApi(rule: ScheduleRule): Promise<SourceStatus> {
    if (rule.source.kind !== 'https-api') return this.status(rule);
    const source = rule.source;
    const check = checkUrl(source.url);
    if (!check.ok) {
      return { ...this.failure(rule, 'refused', check.error, source.refreshSeconds), state: 'refused' };
    }

    const allowError = await this.allowHost(
      check.host,
      check.scheme,
      `The schedule rule "${rule.label}" reads setting values from this host.`
    );
    if (allowError) {
      return { ...this.failure(rule, 'refused', `The host could not be allow-listed: ${allowError}`, source.refreshSeconds), state: 'refused' };
    }

    const response = await this.options.studio.http
      .request({
        url: check.url,
        method: 'GET',
        headers: { Accept: 'application/json' },
        timeoutMs: this.timeout(),
        maxBytes: LIMITS.maxResponseBytes
      })
      .catch((error: unknown) => ({ ok: false as const, error: error instanceof Error ? error.message : String(error) }));

    if (!response.ok) {
      const offline = /net::|ENOTFOUND|EAI_AGAIN|getaddrinfo|ECONNREFUSED|timed out/i.test(response.error);
      return this.failure(
        rule,
        offline ? 'offline' : 'failed',
        `${safeUrlLabel(check.url)} could not be reached: ${response.error}`,
        source.refreshSeconds
      );
    }

    const http = response.value;
    if (http.status === 401 || http.status === 403) {
      return {
        ...this.failure(rule, 'unauthorized', `${safeUrlLabel(check.url)} refused the request (HTTP ${http.status}).`, source.refreshSeconds),
        state: 'unauthorized'
      };
    }
    if (http.status === 429) {
      const retryAfter = Number(http.headers['retry-after']);
      const waitSeconds = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : source.refreshSeconds * 4;
      const failed = this.failure(
        rule,
        'rate-limited',
        `${safeUrlLabel(check.url)} asked for fewer requests (HTTP 429).`,
        source.refreshSeconds
      );
      return { ...failed, state: 'rate-limited', nextAttemptAt: Date.now() + waitSeconds * 1000 };
    }
    if (http.status < 200 || http.status >= 300) {
      return this.failure(
        rule,
        'failed',
        `${safeUrlLabel(check.url)} answered HTTP ${http.status} ${http.statusText}.`,
        source.refreshSeconds
      );
    }
    if (http.truncated) {
      return this.failure(
        rule,
        'refused',
        `The answer was longer than the ${LIMITS.maxResponseBytes} byte limit, so it was not read.`,
        source.refreshSeconds
      );
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(http.body) as Record<string, unknown>;
    } catch {
      return this.failure(rule, 'refused', 'The answer was not valid JSON.', source.refreshSeconds);
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return this.failure(rule, 'refused', 'The answer was not a JSON object.', source.refreshSeconds);
    }

    const version = parsed.schemaVersion;
    if (version !== 1) {
      return this.failure(
        rule,
        'refused',
        `The answer declares schemaVersion ${JSON.stringify(version ?? null)}; this build reads version 1 only.`,
        source.refreshSeconds
      );
    }

    const active = parsed.active;
    if (typeof active !== 'boolean') {
      return this.failure(rule, 'refused', 'The answer has no boolean "active" field.', source.refreshSeconds);
    }

    const settingsRaw = parsed.settings;
    const accepted: Array<{ settingId: string; value: unknown }> = [];
    const rejected: string[] = [];
    if (settingsRaw !== undefined) {
      if (typeof settingsRaw !== 'object' || settingsRaw === null || Array.isArray(settingsRaw)) {
        return this.failure(rule, 'refused', 'The answer’s "settings" field is not an object.', source.refreshSeconds);
      }
      const entries = Object.entries(settingsRaw as Record<string, unknown>);
      if (entries.length > LIMITS.maxAssignmentsPerRule) {
        return this.failure(
          rule,
          'refused',
          `The answer carries ${entries.length} settings; the limit is ${LIMITS.maxAssignmentsPerRule}.`,
          source.refreshSeconds
        );
      }
      for (const [settingId, value] of entries) {
        if (!this.options.guard.isKnown(settingId) || !this.options.guard.isSchedulable(settingId)) {
          rejected.push(settingId);
          continue;
        }
        const coerced = this.options.guard.coerce(settingId, value);
        if (!coerced.ok) {
          rejected.push(`${settingId} (${coerced.error})`);
          continue;
        }
        accepted.push({ settingId, value: coerced.value });
      }
    }

    const rejectedNote =
      rejected.length > 0
        ? ` ${rejected.length} field(s) were refused because this application does not accept them: ${rejected.join(', ')}.`
        : '';

    return {
      ruleId: rule.id,
      kind: 'https-api',
      state: active ? 'ok' : 'gate-closed',
      gateOpen: active,
      remoteAssignments: accepted,
      rejectedFields: rejected,
      lastAttemptAt: new Date().toISOString(),
      lastSuccessAt: new Date().toISOString(),
      message: active
        ? `${safeUrlLabel(check.url)} is active and supplied ${accepted.length} setting(s).${rejectedNote}`
        : `${safeUrlLabel(check.url)} answered active: false, so this rule changes nothing.${rejectedNote}`,
      consecutiveFailures: 0,
      nextAttemptAt: Date.now() + source.refreshSeconds * 1000
    };
  }

  /* ---------------- Home Assistant ---------------- */

  private async askHomeAssistant(rule: ScheduleRule): Promise<SourceStatus> {
    if (rule.source.kind !== 'home-assistant') return this.status(rule);
    const source = rule.source;
    const check = checkUrl(source.baseUrl);
    if (!check.ok) {
      return { ...this.failure(rule, 'refused', check.error, source.refreshSeconds), state: 'refused' };
    }

    const account = source.vaultAccount || vaultAccountFor(rule.id);
    const tokenResult = await this.options.studio.vault.get(account);
    if (!tokenResult.ok) {
      return {
        ...this.failure(
          rule,
          'unauthorized',
          `The credential vault could not be read: ${tokenResult.error}`,
          source.refreshSeconds
        ),
        state: 'unauthorized'
      };
    }
    const token = tokenResult.value;
    if (!token) {
      return {
        ...this.failure(
          rule,
          'unauthorized',
          'No Home Assistant token is stored for this rule. Open the rule and store one in the credential vault.',
          source.refreshSeconds
        ),
        state: 'unauthorized'
      };
    }

    const allowError = await this.allowHost(
      check.host,
      check.scheme,
      `The schedule rule "${rule.label}" reads one Home Assistant boolean entity from this host.`
    );
    if (allowError) {
      return {
        ...this.failure(rule, 'refused', `The host could not be allow-listed: ${allowError}`, source.refreshSeconds),
        state: 'refused'
      };
    }

    const endpoint = `${check.url.replace(/\/+$/, '')}/api/states/${encodeURIComponent(source.entityId)}`;
    const response = await this.options.studio.http
      .request({
        url: endpoint,
        method: 'GET',
        // The token is passed for this one request and is never stored, echoed,
        // logged or written into the rule.
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
        timeoutMs: this.timeout(),
        maxBytes: LIMITS.maxResponseBytes
      })
      .catch((error: unknown) => ({ ok: false as const, error: error instanceof Error ? error.message : String(error) }));

    if (!response.ok) {
      const offline = /net::|ENOTFOUND|EAI_AGAIN|getaddrinfo|ECONNREFUSED|timed out/i.test(response.error);
      return this.failure(
        rule,
        offline ? 'offline' : 'failed',
        `${safeUrlLabel(endpoint)} could not be reached: ${response.error}`,
        source.refreshSeconds
      );
    }

    const http = response.value;
    if (http.status === 401 || http.status === 403) {
      return {
        ...this.failure(
          rule,
          'unauthorized',
          `Home Assistant refused the request (HTTP ${http.status}). Either the stored token is not valid for this server, or this build’s privileged HTTP boundary did not forward the Authorization header — the feature’s documentation records that limitation and how to confirm which one applies.`,
          source.refreshSeconds
        ),
        state: 'unauthorized'
      };
    }
    if (http.status === 429) {
      const failed = this.failure(rule, 'rate-limited', 'Home Assistant asked for fewer requests (HTTP 429).', source.refreshSeconds);
      return { ...failed, state: 'rate-limited', nextAttemptAt: Date.now() + source.refreshSeconds * 4000 };
    }
    if (http.status === 404) {
      return this.failure(
        rule,
        'failed',
        `Home Assistant has no entity called ${source.entityId} (HTTP 404).`,
        source.refreshSeconds
      );
    }
    if (http.status < 200 || http.status >= 300) {
      return this.failure(rule, 'failed', `Home Assistant answered HTTP ${http.status} ${http.statusText}.`, source.refreshSeconds);
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(http.body) as Record<string, unknown>;
    } catch {
      return this.failure(rule, 'refused', 'Home Assistant’s answer was not valid JSON.', source.refreshSeconds);
    }
    const state = parsed.state;
    if (state !== 'on' && state !== 'off') {
      return this.failure(
        rule,
        'refused',
        `${source.entityId} reported "${String(state)}". Only a boolean entity reporting on or off can drive a rule.`,
        source.refreshSeconds
      );
    }

    const open = state === 'on';
    return {
      ruleId: rule.id,
      kind: 'home-assistant',
      state: open ? 'ok' : 'gate-closed',
      gateOpen: open,
      remoteAssignments: [],
      rejectedFields: [],
      lastAttemptAt: new Date().toISOString(),
      lastSuccessAt: new Date().toISOString(),
      message: open
        ? `${source.entityId} is on, so this rule’s own values apply inside its window.`
        : `${source.entityId} is off, so this rule changes nothing and the base settings stay in effect.`,
      consecutiveFailures: 0,
      nextAttemptAt: Date.now() + source.refreshSeconds * 1000
    };
  }
}
