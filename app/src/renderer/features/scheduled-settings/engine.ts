/**
 * The runtime that turns a schedule into applied settings — and, just as
 * importantly, turns it back again.
 *
 * The central promise of this feature is that a scheduled value is a *loan*, not
 * a sale. Before any setting is overridden its base value is captured, snapshot
 * and all, into storage that survives a crash; when the window closes the base
 * value goes back exactly as it was, provenance included. A scheduled override is
 * never quietly promoted into the user's permanent setting.
 *
 * The engine ticks on its own bounded interval rather than trusting one computed
 * timestamp, because a laptop that slept through 22:00 still has to notice at
 * 22:04 that the evening rule should be running.
 */

import { describeWindow, matchesAt, resolve } from './evaluate';
import type { ResolveInput } from './evaluate';
import { LIMITS, SCHEDULE_SCHEMA_VERSION, emptyDocument, loadDocument, serializeDocument, validateRule } from './schema';
import type { LoadResult, ScheduleDocument, ScheduleRule } from './schema';
import { SourceResolver } from './sources';
import type { SettingGuard, SourceStatus } from './sources';
import type { AppContext, SettingControl, SettingsProvenance } from '../../core/registry';

/* ------------------------------------------------------------------ */
/* Setting ids owned by this feature                                   */
/* ------------------------------------------------------------------ */

export const RULES_SETTING_ID = 'schedule.rules';
export const BASE_SNAPSHOT_SETTING_ID = 'schedule.baseSnapshot';
export const ENABLED_SETTING_ID = 'schedule.enabled';
export const TICK_SECONDS_SETTING_ID = 'schedule.tickSeconds';
export const NOTIFY_SETTING_ID = 'schedule.notifyOnChange';
export const TIMEOUT_SETTING_ID = 'schedule.networkTimeoutMs';

export const HISTORY_SOURCE = 'features.scheduled-settings';

/**
 * Ids this feature refuses to schedule.
 *
 * Its own keys are excluded so a rule cannot switch off the scheduler that is
 * running it, or rewrite the schedule mid-tick. The School-mode keys are excluded
 * for a different reason: while that mode is on, the capabilities behind them
 * behave as if they are not installed, so offering them here would be offering a
 * control the rest of the application has deliberately withdrawn.
 */
const OWN_PREFIX = 'schedule.';
const SCHOOL_WITHDRAWN = ['language.mode', 'language.funny.en', 'language.funny.yue'];
const SCHOOL_WITHDRAWN_PREFIXES = ['vocabulary.', 'school.'];

/* ------------------------------------------------------------------ */
/* Applied state                                                       */
/* ------------------------------------------------------------------ */

export interface BaseCapture {
  /** True when the settings file genuinely held a value before the override. */
  hadValue: boolean;
  value: unknown;
  provenance: SettingsProvenance;
  /** The rule that took the loan, for the interface and the history entry. */
  ruleId: string;
  capturedAt: string;
}

export interface AppliedOverride {
  settingId: string;
  label: string;
  scheduledValue: unknown;
  baseValue: unknown;
  hadBaseValue: boolean;
  ruleId: string;
  ruleLabel: string;
  /** Rules that also claimed this setting and lost. */
  overriddenBy: Array<{ ruleId: string; ruleLabel: string }>;
}

export interface EngineSnapshot {
  enabled: boolean;
  document: ScheduleDocument;
  /** Rules the stored document held that could not be validated. */
  quarantined: LoadResult['quarantined'];
  /** Set when the whole stored document was refused. */
  refused: string | null;
  migratedFrom: number | null;
  /** Rules whose window contains this instant, whatever their gate says. */
  activeRuleIds: string[];
  overrides: AppliedOverride[];
  /** Setting ids the user edited by hand while a rule was holding them. */
  suppressed: string[];
  lastTickAt: string | null;
  statuses: Record<string, SourceStatus>;
}

/* ------------------------------------------------------------------ */
/* Engine                                                              */
/* ------------------------------------------------------------------ */

export class ScheduleEngine {
  private ctx: AppContext;
  private resolver: SourceResolver;

  private doc: ScheduleDocument = emptyDocument();
  private quarantined: LoadResult['quarantined'] = [];
  private refused: string | null = null;
  private migratedFrom: number | null = null;

  private applied = new Map<string, AppliedOverride>();
  private bases = new Map<string, BaseCapture>();
  private suppressed = new Set<string>();
  private lastSignature = '';
  private lastWindowActive = new Map<string, boolean>();
  private activeRuleIds: string[] = [];
  private lastTickAt: string | null = null;

  private timer: number | null = null;
  private pendingTick: number | null = null;
  private writing = false;
  private started = false;
  private readonly listeners = new Set<() => void>();
  private readonly disposers: Array<() => void> = [];

  constructor(ctx: AppContext) {
    this.ctx = ctx;
    this.resolver = new SourceResolver({
      studio: ctx.studio,
      guard: this.guard(),
      timeoutMs: () =>
        Number(ctx.settings.get<number>(TIMEOUT_SETTING_ID, 8000)) || 8000
    });
  }

  /* ---------------- lifecycle ---------------- */

  start(): void {
    if (this.started) return;
    this.started = true;

    this.readDocument();
    this.readBases();

    this.disposers.push(
      this.resolver.onChange(() => this.requestTick()),
      this.ctx.settings.onChange((change) => this.onSettingChanged(change)),
      this.ctx.i18n.onChange(() => this.requestTick())
    );

    this.restartTimer();
    this.tick();
    this.reportLoadProblems();
  }

  stop(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    if (this.pendingTick !== null) window.clearTimeout(this.pendingTick);
    this.pendingTick = null;
    for (const dispose of this.disposers.splice(0)) dispose();
    this.started = false;
  }

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
        console.error('A schedule listener threw:', error);
      }
    }
  }

  private restartTimer(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    const seconds = Math.min(300, Math.max(10, Number(this.ctx.settings.get<number>(TICK_SECONDS_SETTING_ID, 30)) || 30));
    this.timer = window.setInterval(() => this.tick(), seconds * 1000);
  }

  /** Coalesces bursts of change notifications into one tick. */
  private requestTick(): void {
    if (this.pendingTick !== null) return;
    this.pendingTick = window.setTimeout(() => {
      this.pendingTick = null;
      this.tick();
    }, 60);
  }

  /* ---------------- persistence ---------------- */

  private readDocument(): void {
    const stored = this.ctx.settings.get<unknown>(RULES_SETTING_ID, null);
    const result = loadDocument(stored);
    this.doc = result.document;
    this.quarantined = result.quarantined;
    this.refused = result.refused;
    this.migratedFrom = result.migratedFrom;
  }

  private readBases(): void {
    const stored = this.ctx.settings.get<Record<string, BaseCapture> | null>(BASE_SNAPSHOT_SETTING_ID, null);
    this.bases.clear();
    if (!stored || typeof stored !== 'object') return;
    for (const [settingId, capture] of Object.entries(stored)) {
      if (!capture || typeof capture !== 'object') continue;
      this.bases.set(settingId, {
        hadValue: capture.hadValue === true,
        value: capture.value ?? null,
        provenance: (capture.provenance ?? 'user') as SettingsProvenance,
        ruleId: String(capture.ruleId ?? ''),
        capturedAt: String(capture.capturedAt ?? new Date().toISOString())
      });
    }
  }

  private writeBases(): void {
    this.withOwnWrite(() => {
      this.ctx.settings.set(BASE_SNAPSHOT_SETTING_ID, Object.fromEntries(this.bases), 'user');
    });
  }

  private writeDocument(): void {
    this.withOwnWrite(() => {
      this.ctx.settings.set(RULES_SETTING_ID, serializeDocument(this.doc), 'user');
    });
  }

  private withOwnWrite(fn: () => void): void {
    const previous = this.writing;
    this.writing = true;
    try {
      fn();
    } finally {
      this.writing = previous;
    }
  }

  private reportLoadProblems(): void {
    if (this.refused) {
      this.ctx.notify.error(
        this.ctx.t('schedule.notify.refused.title', 'The stored schedule was not read'),
        this.refused
      );
    }
    if (this.quarantined.length > 0) {
      this.ctx.notify.warn(
        this.ctx.t('schedule.notify.quarantined.title', 'Some schedule rules were not loaded'),
        this.ctx.t(
          'schedule.notify.quarantined.body',
          '{count} rule(s) did not pass validation. They are still stored and are listed in the schedule tab; none of them is running.',
          { values: { count: this.quarantined.length } }
        )
      );
    }
    if (this.migratedFrom !== null) {
      this.ctx.notify.info(
        this.ctx.t('schedule.notify.migrated.title', 'The schedule was brought up to date'),
        this.ctx.t(
          'schedule.notify.migrated.body',
          'The stored schedule was written by schema {from}; it was read and rewritten as schema {to}.',
          { values: { from: this.migratedFrom, to: SCHEDULE_SCHEMA_VERSION } }
        )
      );
      this.writeDocument();
      this.migratedFrom = null;
    }
  }

  /* ---------------- the schedulable set ---------------- */

  /** Every setting control this application registers, indexed by id. */
  controls(): Map<string, SettingControl> {
    const index = new Map<string, SettingControl>();
    for (const section of this.ctx.registry.settingsSections()) {
      for (const control of section.controls) index.set(control.id, control);
    }
    return index;
  }

  /**
   * True when a setting may take part in a schedule.
   *
   * An action has no stored value and a custom control has a shape only its own
   * feature understands, so neither can be assigned. Everything else — theme,
   * density, seed colour, fonts, motion, the display-name presentation, the
   * language mode and every value any other feature registers — can be.
   */
  isSchedulable(settingId: string): boolean {
    if (settingId.startsWith(OWN_PREFIX)) return false;
    if (this.ctx.i18n.schoolModeActive()) {
      if (SCHOOL_WITHDRAWN.includes(settingId)) return false;
      if (SCHOOL_WITHDRAWN_PREFIXES.some((prefix) => settingId.startsWith(prefix))) return false;
    }
    const control = this.controls().get(settingId);
    if (!control) return false;
    return control.kind !== 'action' && control.kind !== 'custom';
  }

  schedulableControls(): SettingControl[] {
    return [...this.controls().values()]
      .filter((control) => this.isSchedulable(control.id))
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  /**
   * Coerces one candidate value to the shape its control expects.
   *
   * The control's own `validate` has the final word, so a value that would be
   * refused when typed into the settings surface is refused here too. Two routes
   * to one setting must never disagree about what that setting accepts.
   */
  coerce(settingId: string, raw: unknown): { ok: boolean; value: unknown; error: string } {
    const control = this.controls().get(settingId);
    if (!control) return { ok: false, value: null, error: 'this application has no setting with that id' };
    let value: unknown = raw;
    switch (control.kind) {
      case 'switch':
        if (typeof raw === 'boolean') value = raw;
        else if (raw === 'true' || raw === 'false') value = raw === 'true';
        else return { ok: false, value: null, error: 'expected true or false' };
        break;
      case 'number':
      case 'slider': {
        const numeric = typeof raw === 'number' ? raw : Number(raw);
        if (!Number.isFinite(numeric)) return { ok: false, value: null, error: 'expected a number' };
        let bounded = numeric;
        if (typeof control.min === 'number') bounded = Math.max(control.min, bounded);
        if (typeof control.max === 'number') bounded = Math.min(control.max, bounded);
        value = bounded;
        break;
      }
      case 'select': {
        const text = String(raw ?? '');
        const allowed = (control.options ?? []).map((option) => option.value);
        if (!allowed.includes(text)) {
          return { ok: false, value: null, error: `expected one of ${allowed.join(', ')}` };
        }
        value = text;
        break;
      }
      default:
        if (raw === null || raw === undefined) value = '';
        else if (typeof raw === 'string') value = raw;
        else if (typeof raw === 'number' || typeof raw === 'boolean') value = String(raw);
        else return { ok: false, value: null, error: 'expected text' };
        if (String(value).length > LIMITS.maxStringValueLength) {
          return { ok: false, value: null, error: `longer than ${LIMITS.maxStringValueLength} characters` };
        }
        break;
    }
    const refusal = control.validate?.(value) ?? null;
    if (refusal) return { ok: false, value: null, error: refusal };
    return { ok: true, value, error: '' };
  }

  private guard(): SettingGuard {
    return {
      isKnown: (settingId) => this.controls().has(settingId),
      isSchedulable: (settingId) => this.isSchedulable(settingId),
      coerce: (settingId, value) => this.coerce(settingId, value)
    };
  }

  /* ---------------- the tick ---------------- */

  tick(): void {
    const now = new Date();
    this.lastTickAt = now.toISOString();

    const master = this.ctx.settings.get<boolean>(ENABLED_SETTING_ID, true) !== false;
    if (!master) {
      if (this.applied.size > 0) this.releaseAll('The scheduler was switched off.');
      this.activeRuleIds = [];
      this.emit();
      return;
    }

    const rules = this.doc.rules;
    this.resolver.prune(new Set(rules.map((rule) => rule.id)));

    /* Which windows contain this instant, and which have just opened. */
    const active: string[] = [];
    for (const rule of rules) {
      const inWindow = rule.enabled && matchesAt(rule, now);
      if (inWindow) active.push(rule.id);
      const wasActive = this.lastWindowActive.get(rule.id) === true;
      this.lastWindowActive.set(rule.id, inWindow);
      if (!inWindow) continue;
      if (this.resolver.isDue(rule, now.getTime(), !wasActive)) {
        // Deliberately not awaited: a slow server must never hold up a tick. The
        // resolver notifies on completion and a fresh tick follows.
        void this.resolver.refresh(rule);
      }
    }
    this.activeRuleIds = active;

    /* Build the decision. */
    const inputs: ResolveInput[] = rules.map((rule) => {
      const status = this.resolver.status(rule);
      const own = rule.assignments
        .filter((assignment) => this.isSchedulable(assignment.settingId))
        .map((assignment) => {
          const coerced = this.coerce(assignment.settingId, assignment.value);
          return coerced.ok ? { settingId: assignment.settingId, value: coerced.value } : null;
        })
        .filter((entry): entry is { settingId: string; value: unknown } => entry !== null);

      // An endpoint's values are painted over the rule's own, so a rule can carry
      // a working local answer and still defer to the server when it replies.
      const merged = new Map(own.map((entry) => [entry.settingId, entry.value]));
      for (const entry of status.remoteAssignments) merged.set(entry.settingId, entry.value);

      return {
        rule,
        gateOpen: rule.source.kind === 'local' ? true : status.gateOpen,
        assignments: [...merged].map(([settingId, value]) => ({ settingId, value }))
      };
    });

    const winners = resolve(inputs, now);

    /* A change in what the schedule wants clears the hand-edit suppression: the
       user's manual override held until the situation itself changed. */
    const signature = [...winners.values()]
      .map((entry) => `${entry.ruleId}|${entry.settingId}=${JSON.stringify(entry.value)}`)
      .sort()
      .join(';');
    if (signature !== this.lastSignature) {
      this.suppressed.clear();
      this.lastSignature = signature;
    }
    for (const settingId of this.suppressed) winners.delete(settingId);

    this.applyDecision(winners);
    this.emit();
  }

  private applyDecision(winners: Map<string, { settingId: string; value: unknown; ruleId: string; ruleLabel: string; overriddenBy: Array<{ ruleId: string; ruleLabel: string }> }>): void {
    const controls = this.controls();
    const touched: string[] = [];
    const releasedIds: string[] = [];
    const takenIds: string[] = [];

    /* Release the settings no rule wants any more. */
    for (const settingId of [...this.applied.keys()]) {
      if (winners.has(settingId)) continue;
      this.restoreOne(settingId);
      releasedIds.push(settingId);
      touched.push(settingId);
    }

    /* Take, or update, the settings a rule does want. */
    for (const winner of winners.values()) {
      const existing = this.applied.get(winner.settingId);
      if (!existing) {
        const capture: BaseCapture = {
          hadValue: this.ctx.settings.has(winner.settingId),
          value: this.ctx.settings.get(winner.settingId, controls.get(winner.settingId)?.defaultValue ?? null),
          provenance: this.ctx.settings.provenanceOf(winner.settingId),
          ruleId: winner.ruleId,
          capturedAt: new Date().toISOString()
        };
        // A base captured while a previous override was still in place would
        // record the loan, not the original. The stored snapshot wins if it has
        // one, which is also what makes a crash recoverable.
        const preserved = this.bases.get(winner.settingId);
        this.bases.set(winner.settingId, preserved ?? capture);
        takenIds.push(winner.settingId);
      }
      const base = this.bases.get(winner.settingId)!;
      const control = controls.get(winner.settingId);
      this.applied.set(winner.settingId, {
        settingId: winner.settingId,
        label: control ? this.ctx.t(control.label, control.label) : winner.settingId,
        scheduledValue: winner.value,
        baseValue: base.value,
        hadBaseValue: base.hadValue,
        ruleId: winner.ruleId,
        ruleLabel: winner.ruleLabel,
        overriddenBy: winner.overriddenBy
      });
      const current = this.ctx.settings.get(winner.settingId);
      if (!deepEqual(current, winner.value)) {
        this.withOwnWrite(() => this.ctx.settings.set(winner.settingId, winner.value, 'scheduled'));
        touched.push(winner.settingId);
      }
    }

    if (touched.length === 0) return;

    this.writeBases();
    if (touched.some((id) => id.startsWith('appearance.'))) this.ctx.theme.apply();

    const notify = this.ctx.settings.get<boolean>(NOTIFY_SETTING_ID, true) !== false;
    if (takenIds.length > 0) {
      const labels = takenIds.map((id) => this.applied.get(id)?.label ?? id).join(', ');
      void this.ctx.history.record('Scheduled settings applied', HISTORY_SOURCE, {
        settingIds: takenIds,
        ruleIds: [...new Set(takenIds.map((id) => this.applied.get(id)?.ruleId ?? ''))]
      });
      if (notify) {
        this.ctx.notify.show({
          title: this.ctx.t('schedule.notify.applied.title', 'A schedule rule took effect', { dialog: true }),
          body: this.ctx.t('schedule.notify.applied.body', 'Now set by the schedule: {labels}. The previous values are held and go back when the window ends.', {
            values: { labels }
          }),
          severity: 'info',
          source: 'scheduled-settings',
          timeoutMs: 6000,
          actions: [
            {
              label: this.ctx.t('schedule.action.open', 'Open the schedule'),
              run: () => this.ctx.tabs.teleport('scheduled-settings.schedule')
            },
            {
              label: this.ctx.t('schedule.action.releaseAll', 'Release every override now'),
              run: () => this.releaseAll('Released from the notification.')
            }
          ]
        });
      }
    }
    if (releasedIds.length > 0) {
      void this.ctx.history.record('Scheduled settings released', HISTORY_SOURCE, { settingIds: releasedIds });
      if (notify) {
        this.ctx.notify.show({
          title: this.ctx.t('schedule.notify.released.title', 'A schedule window ended', { dialog: true }),
          body: this.ctx.t('schedule.notify.released.body', '{count} setting(s) went back to the values they had before the schedule borrowed them.', {
            values: { count: releasedIds.length }
          }),
          severity: 'success',
          source: 'scheduled-settings',
          timeoutMs: 5000
        });
      }
    }
  }

  /** Puts one setting back exactly as it was, provenance included. */
  private restoreOne(settingId: string): void {
    const base = this.bases.get(settingId);
    this.applied.delete(settingId);
    this.bases.delete(settingId);
    if (!base) return;
    this.withOwnWrite(() => {
      if (base.hadValue) this.ctx.settings.set(settingId, base.value, base.provenance);
      else this.ctx.settings.reset(settingId);
    });
  }

  /* ---------------- user edits during an override ---------------- */

  private onSettingChanged(change: { id: string; value: unknown; previous: unknown }): void {
    if (change.id === TICK_SECONDS_SETTING_ID) {
      this.restartTimer();
      return;
    }
    if (change.id === ENABLED_SETTING_ID) {
      this.requestTick();
      return;
    }
    if (this.writing) return;
    if (change.id === RULES_SETTING_ID) {
      // Somebody replaced the document from outside this engine — an import, a
      // history restore. Re-read it rather than carrying on with a stale copy.
      this.readDocument();
      this.requestTick();
      return;
    }
    const held = this.applied.get(change.id);
    if (!held) return;
    if (deepEqual(change.value, held.scheduledValue)) return;

    // The user changed a setting a rule was holding. Their edit becomes the new
    // base, and the rule stops touching that one setting until the schedule's own
    // decision changes — the person in front of the screen outranks the calendar.
    this.suppressed.add(change.id);
    this.bases.set(change.id, {
      hadValue: true,
      value: change.value,
      provenance: 'user',
      ruleId: held.ruleId,
      capturedAt: new Date().toISOString()
    });
    this.applied.delete(change.id);
    this.writeBases();
    void this.ctx.history.record('Scheduled override taken over by hand', HISTORY_SOURCE, {
      settingId: change.id,
      ruleId: held.ruleId
    });
    this.ctx.notify.info(
      this.ctx.t('schedule.notify.suppressed.title', 'Your change wins'),
      this.ctx.t(
        'schedule.notify.suppressed.body',
        '"{label}" was being set by the rule "{rule}". Your value is now the base value, and the rule leaves this setting alone until the schedule changes.',
        { values: { label: held.label, rule: held.ruleLabel } }
      )
    );
    this.emit();
  }

  /* ---------------- public operations ---------------- */

  snapshot(): EngineSnapshot {
    const statuses: Record<string, SourceStatus> = {};
    for (const rule of this.doc.rules) statuses[rule.id] = this.resolver.status(rule);
    return {
      enabled: this.ctx.settings.get<boolean>(ENABLED_SETTING_ID, true) !== false,
      document: this.doc,
      quarantined: this.quarantined,
      refused: this.refused,
      migratedFrom: this.migratedFrom,
      activeRuleIds: [...this.activeRuleIds],
      overrides: [...this.applied.values()].sort((a, b) => a.settingId.localeCompare(b.settingId)),
      suppressed: [...this.suppressed],
      lastTickAt: this.lastTickAt,
      statuses
    };
  }

  rules(): ScheduleRule[] {
    return this.doc.rules;
  }

  rule(id: string): ScheduleRule | null {
    return this.doc.rules.find((candidate) => candidate.id === id) ?? null;
  }

  statusFor(rule: ScheduleRule): SourceStatus {
    return this.resolver.status(rule);
  }

  /** Saves a validated rule, adding it or replacing the one with the same id. */
  saveRule(rule: ScheduleRule, action: string): { ok: boolean; errors: Array<{ field: string; message: string }> } {
    const validation = validateRule(rule);
    if (!validation.ok || !validation.rule) return { ok: false, errors: validation.errors };
    const next = validation.rule;
    const index = this.doc.rules.findIndex((candidate) => candidate.id === next.id);
    if (index === -1 && this.doc.rules.length >= LIMITS.maxRules) {
      return {
        ok: false,
        errors: [{ field: 'rule', message: `A schedule may hold at most ${LIMITS.maxRules} rules.` }]
      };
    }
    next.updatedAt = new Date().toISOString();
    if (index === -1) this.doc.rules.push(next);
    else this.doc.rules[index] = next;
    this.unsuppress(next.assignments.map((entry) => entry.settingId));
    this.persist(action, { ruleId: next.id, label: next.label, when: describeWindow(next), source: next.source.kind });
    this.resolver.forget(next.id);
    this.lastWindowActive.delete(next.id);
    return { ok: true, errors: [] };
  }

  deleteRules(ids: string[], action = 'Schedule rules deleted'): void {
    const removed = this.doc.rules.filter((rule) => ids.includes(rule.id));
    if (removed.length === 0) return;
    this.doc.rules = this.doc.rules.filter((rule) => !ids.includes(rule.id));
    for (const rule of removed) {
      this.resolver.forget(rule.id);
      this.lastWindowActive.delete(rule.id);
      if (rule.source.kind === 'home-assistant') {
        void this.ctx.studio.vault.delete(rule.source.vaultAccount).catch(() => undefined);
      }
    }
    this.unsuppress(removed.flatMap((rule) => rule.assignments.map((entry) => entry.settingId)));
    this.persist(action, { ruleIds: removed.map((rule) => rule.id), labels: removed.map((rule) => rule.label) });
  }

  setEnabled(ids: string[], enabled: boolean): void {
    let changed = false;
    for (const rule of this.doc.rules) {
      if (!ids.includes(rule.id)) continue;
      if (rule.enabled === enabled) continue;
      rule.enabled = enabled;
      rule.updatedAt = new Date().toISOString();
      changed = true;
    }
    if (!changed) return;
    this.unsuppress(
      this.doc.rules
        .filter((rule) => ids.includes(rule.id))
        .flatMap((rule) => rule.assignments.map((entry) => entry.settingId))
    );
    this.persist(enabled ? 'Schedule rules enabled' : 'Schedule rules disabled', { ruleIds: ids });
  }

  duplicateRules(ids: string[]): ScheduleRule[] {
    const copies: ScheduleRule[] = [];
    for (const rule of this.doc.rules.filter((candidate) => ids.includes(candidate.id))) {
      if (this.doc.rules.length + copies.length >= LIMITS.maxRules) break;
      copies.push({
        ...rule,
        id: `${rule.id}-copy-${Date.now().toString(36)}-${copies.length}`,
        label: `${rule.label} (copy)`.slice(0, LIMITS.maxLabelLength),
        // A copy never inherits the original's vault account: two rules sharing a
        // token entry would delete each other's credential on removal.
        source:
          rule.source.kind === 'home-assistant'
            ? { ...rule.source, vaultAccount: `${rule.source.vaultAccount}-copy-${copies.length}` }
            : { ...rule.source },
        assignments: rule.assignments.map((entry) => ({ ...entry })),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
    if (copies.length === 0) return [];
    this.doc.rules.push(...copies);
    this.persist('Schedule rules duplicated', { ruleIds: copies.map((rule) => rule.id) });
    return copies;
  }

  /**
   * Lifts the hand-edit exception for the settings a just-edited rule touches.
   *
   * Editing a rule is the user saying what they want that rule to do, so it
   * outranks an earlier hand edit of the same setting. It is deliberately narrow:
   * editing one rule never disturbs a hand edit that belongs to a different one.
   */
  private unsuppress(settingIds: Iterable<string>): void {
    for (const settingId of settingIds) this.suppressed.delete(settingId);
  }

  private persist(action: string, payload: unknown): void {
    this.doc.updatedAt = new Date().toISOString();
    this.writeDocument();
    void this.ctx.history.record(action, HISTORY_SOURCE, payload);
    void this.resolver.revokeUnused(this.doc.rules);
    this.requestTick();
  }

  /**
   * Hands every borrowed setting straight back.
   *
   * The released settings are suppressed the same way a hand edit suppresses one,
   * so the very next check does not immediately take them again — a release
   * button that undid itself two seconds later would be a control that looks like
   * it works and does not. The suppression lifts when the schedule's own decision
   * changes: a window opening or closing, a rule edited, an endpoint answering
   * differently.
   */
  releaseAll(reason: string): void {
    const ids = [...this.applied.keys()];
    if (ids.length === 0) return;
    for (const settingId of ids) {
      this.suppressed.add(settingId);
      this.restoreOne(settingId);
    }
    this.writeBases();
    if (ids.some((id) => id.startsWith('appearance.'))) this.ctx.theme.apply();
    void this.ctx.history.record('Scheduled overrides released', HISTORY_SOURCE, { settingIds: ids, reason });
    this.ctx.notify.success(
      this.ctx.t('schedule.notify.releasedAll.title', 'Every scheduled override was released'),
      this.ctx.t('schedule.notify.releasedAll.body', '{count} setting(s) went back to their base values. {reason}', {
        values: { count: ids.length, reason }
      })
    );
    this.emit();
  }

  /** Releases one setting and suppresses it until the schedule's decision changes. */
  releaseOne(settingId: string): void {
    if (!this.applied.has(settingId)) return;
    this.suppressed.add(settingId);
    this.restoreOne(settingId);
    this.writeBases();
    if (settingId.startsWith('appearance.')) this.ctx.theme.apply();
    void this.ctx.history.record('Scheduled override released', HISTORY_SOURCE, { settingId });
    this.emit();
  }

  /** Asks every external source again, right now. */
  async refreshAll(): Promise<void> {
    const external = this.doc.rules.filter((rule) => rule.source.kind !== 'local');
    if (external.length === 0) {
      this.ctx.notify.info(
        this.ctx.t('schedule.notify.noExternal.title', 'Nothing to refresh'),
        this.ctx.t('schedule.notify.noExternal.body', 'No rule reads from an endpoint or from Home Assistant, so no request was made.')
      );
      return;
    }
    await Promise.all(external.map((rule) => this.resolver.refresh(rule)));
    this.tick();
  }

  /**
   * Asks a candidate rule's source without storing the rule.
   *
   * The probe runs through the same resolver the schedule uses, so a passing test
   * and a working rule are the same thing rather than two things that resemble
   * each other. It is given its own id so a stored rule's cached answer is
   * neither read nor overwritten by the test.
   */
  async testRule(rule: ScheduleRule): Promise<SourceStatus> {
    const probe: ScheduleRule = { ...rule, id: `${rule.id}--probe`, enabled: true };
    const status = await this.resolver.refresh(probe);
    this.resolver.forget(probe.id);
    return status;
  }

  refreshOne(ruleId: string): Promise<void> {
    const rule = this.rule(ruleId);
    if (!rule) return Promise.resolve();
    return this.resolver.refresh(rule).then(() => {
      this.tick();
    });
  }

  /** Replaces the whole document, used by import. Validated exactly like a load. */
  replaceDocument(stored: unknown): LoadResult {
    const result = loadDocument(stored);
    if (result.refused) return result;
    this.releaseAll('The schedule was replaced.');
    this.doc = result.document;
    this.quarantined = result.quarantined;
    this.suppressed.clear();
    this.persist('Schedule replaced', { ruleCount: result.document.rules.length });
    return result;
  }

  /** The document as plain records, for export. Never carries a token. */
  exportRecords(): Array<Record<string, unknown>> {
    return this.doc.rules.map((rule) => ({
      id: rule.id,
      label: rule.label,
      enabled: rule.enabled,
      priority: rule.priority,
      startDate: rule.startDate ?? '',
      endDate: rule.endDate ?? '',
      startTime: rule.startTime,
      endTime: rule.endTime,
      everyDay: rule.everyDay,
      weekdays: rule.weekdays.join(' '),
      source: rule.source.kind,
      sourceAddress:
        rule.source.kind === 'https-api'
          ? rule.source.url
          : rule.source.kind === 'home-assistant'
            ? `${rule.source.baseUrl} ${rule.source.entityId}`
            : '',
      settings: rule.assignments.map((entry) => `${entry.settingId}=${JSON.stringify(entry.value)}`).join('; '),
      when: describeWindow(rule),
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt
    }));
  }
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return false;
  if (typeof a !== 'object') return false;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}
