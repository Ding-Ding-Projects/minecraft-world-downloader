/**
 * The versioned, bounded schedule document.
 *
 * Everything about a schedule that survives a restart lives in this one shape.
 * It is versioned so a future change can migrate rather than guess, bounded so a
 * corrupt or hostile file cannot exhaust memory, and validated field by field so
 * a partially-written rule is quarantined and reported instead of being applied
 * with invented values.
 *
 * This module is pure: it reads no settings, touches no DOM and makes no network
 * request, so every rule in it can be reasoned about and tested on its own.
 */

/* ------------------------------------------------------------------ */
/* Version                                                             */
/* ------------------------------------------------------------------ */

/**
 * The schema version this build writes.
 *
 * A document carrying a lower version is migrated forward on load. A document
 * carrying a higher version was written by a newer build: it is refused and kept
 * untouched rather than downgraded, because silently dropping fields a newer
 * build understood is data loss disguised as compatibility.
 */
export const SCHEDULE_SCHEMA_VERSION = 1;

/* ------------------------------------------------------------------ */
/* Bounds                                                              */
/* ------------------------------------------------------------------ */

export const LIMITS = {
  /** Rules in one document. */
  maxRules: 64,
  /** Settings one rule may assign. */
  maxAssignmentsPerRule: 32,
  maxLabelLength: 80,
  maxUrlLength: 2048,
  maxEntityIdLength: 128,
  /** Refresh interval floor, so a misconfigured rule cannot become a hot loop. */
  minRefreshSeconds: 60,
  maxRefreshSeconds: 86_400,
  /** Hard ceiling on an external response body. */
  maxResponseBytes: 64 * 1024,
  minTimeoutMs: 1_000,
  maxTimeoutMs: 30_000,
  /** Ceiling on any string a rule may assign to a setting. */
  maxStringValueLength: 512,
  /** Ceiling on the serialized document, checked before it is parsed. */
  maxDocumentBytes: 256 * 1024,
  maxPriority: 999,
  minPriority: 0
} as const;

/* ------------------------------------------------------------------ */
/* Shapes                                                              */
/* ------------------------------------------------------------------ */

export type SourceKind = 'local' | 'https-api' | 'home-assistant';

/** Values come straight from the rule's own assignments. Always available. */
export interface LocalSource {
  kind: 'local';
}

/**
 * A versioned HTTPS endpoint returning both a gate and a set of setting values.
 *
 * The response must be:
 *   { "schemaVersion": 1, "active": true, "settings": { "<setting id>": value } }
 *
 * Keys outside the application's own registered setting ids are refused rather
 * than stored, so an endpoint cannot introduce a setting the app does not have.
 */
export interface HttpsApiSource {
  kind: 'https-api';
  url: string;
  refreshSeconds: number;
}

/**
 * A Home Assistant boolean entity — a `binary_sensor` or an `input_boolean`.
 *
 * `on` activates the rule so its own assignments apply; `off` leaves the base
 * settings, or another matching rule, in effect. The long-lived access token
 * never appears here: only the credential-vault account key does.
 */
export interface HomeAssistantSource {
  kind: 'home-assistant';
  baseUrl: string;
  entityId: string;
  refreshSeconds: number;
  /** Stable credential-vault account key. Never the token itself. */
  vaultAccount: string;
}

export type RuleSource = LocalSource | HttpsApiSource | HomeAssistantSource;

export interface Assignment {
  /** A setting id registered by some feature in this application. */
  settingId: string;
  value: unknown;
}

export interface ScheduleRule {
  /** Stable for the life of the rule. Never reused, never renamed. */
  id: string;
  label: string;
  enabled: boolean;
  /** Higher wins. Equal priorities are settled by position in the document. */
  priority: number;
  /** Inclusive local calendar date, or null for "no lower bound". */
  startDate: string | null;
  /** Inclusive local calendar date, or null for "no upper bound". */
  endDate: string | null;
  /** Local wall-clock `HH:MM`. */
  startTime: string;
  /** Local wall-clock `HH:MM`. The window is half-open: [start, end). */
  endTime: string;
  /** True selects all seven weekdays for the chosen time window. */
  everyDay: boolean;
  /** 0 is Sunday. Used only when `everyDay` is false. */
  weekdays: number[];
  source: RuleSource;
  assignments: Assignment[];
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleDocument {
  schemaVersion: number;
  rules: ScheduleRule[];
  updatedAt: string;
}

/** A rule that could not be validated. It is kept, never applied, and reported. */
export interface QuarantinedRule {
  /** The id if one could be read, otherwise a positional description. */
  id: string;
  label: string;
  reason: string;
  /** The original object, so nothing the user wrote is thrown away. */
  raw: unknown;
}

export interface LoadResult {
  document: ScheduleDocument;
  quarantined: QuarantinedRule[];
  /** Set when the whole document was refused; `document` is then the empty one. */
  refused: string | null;
  /** True when a lower schema version was migrated forward on load. */
  migratedFrom: number | null;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

export function emptyDocument(): ScheduleDocument {
  return { schemaVersion: SCHEDULE_SCHEMA_VERSION, rules: [], updatedAt: new Date().toISOString() };
}

let idCounter = 0;

/** A stable rule id. Time plus a counter, so two rules made in one millisecond differ. */
export function newRuleId(): string {
  idCounter += 1;
  return `rule-${Date.now().toString(36)}-${idCounter.toString(36)}`;
}

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const probe = new Date(year, month - 1, day);
  return probe.getFullYear() === year && probe.getMonth() === month - 1 && probe.getDate() === day;
}

export function isClockTime(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{2}:\d{2}$/.test(value)) return false;
  const [hours, minutes] = value.split(':').map(Number);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

/** Minutes since local midnight. */
export function toMinutes(clock: string): number {
  const [hours, minutes] = clock.split(':').map(Number);
  return hours * 60 + minutes;
}

export function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, Math.round(numeric)));
}

/* ------------------------------------------------------------------ */
/* URL validation                                                      */
/* ------------------------------------------------------------------ */

export interface UrlCheck {
  ok: boolean;
  /** The normalized absolute URL when `ok`. */
  url: string;
  host: string;
  scheme: 'http' | 'https';
  /** Exact reason when not ok. Names the field problem, never a guess. */
  error: string;
}

const LOOPBACK = /^(localhost|127(?:\.\d{1,3}){3}|\[::1\]|::1)$/i;

export function isLoopbackHost(hostname: string): boolean {
  return LOOPBACK.test(hostname);
}

/**
 * The single gate every outbound address passes through before the privileged
 * boundary ever sees it.
 *
 * Plain HTTP is refused unless the host is a loopback address, which is the one
 * explicitly bounded development route. Credentials embedded in the URL are
 * refused outright — they would end up in a stored rule, and a stored rule is
 * not a credential store.
 */
export function checkUrl(raw: unknown): UrlCheck {
  const fail = (error: string): UrlCheck => ({ ok: false, url: '', host: '', scheme: 'https', error });
  const text = typeof raw === 'string' ? raw.trim() : '';
  if (text === '') return fail('An address is required.');
  if (text.length > LIMITS.maxUrlLength) {
    return fail(`The address is longer than the ${LIMITS.maxUrlLength} character limit.`);
  }
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return fail('That is not a complete address. Include the scheme, for example https://example.org/state.');
  }
  if (url.username !== '' || url.password !== '') {
    return fail('An address carrying a username or password is refused. Store the secret in the credential vault instead.');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return fail(`Only https is accepted (and http for a loopback address); "${url.protocol.replace(':', '')}" was refused.`);
  }
  const scheme = url.protocol === 'https:' ? 'https' : 'http';
  if (scheme === 'http' && !isLoopbackHost(url.hostname)) {
    return fail('Plain http is only accepted for a loopback address such as http://127.0.0.1:8123. Use https.');
  }
  if (url.hostname === '') return fail('The address has no host.');
  return { ok: true, url: url.toString(), host: url.hostname, scheme, error: '' };
}

const ENTITY_ID = /^(binary_sensor|input_boolean)\.[a-z0-9_]+$/;

export function checkEntityId(raw: unknown): { ok: boolean; error: string } {
  const text = typeof raw === 'string' ? raw.trim() : '';
  if (text === '') return { ok: false, error: 'An entity id is required.' };
  if (text.length > LIMITS.maxEntityIdLength) {
    return { ok: false, error: `The entity id is longer than the ${LIMITS.maxEntityIdLength} character limit.` };
  }
  if (!ENTITY_ID.test(text)) {
    return {
      ok: false,
      error: 'Use a boolean entity, for example binary_sensor.evening or input_boolean.focus_mode.'
    };
  }
  return { ok: true, error: '' };
}

/* ------------------------------------------------------------------ */
/* Value bounds                                                        */
/* ------------------------------------------------------------------ */

/**
 * Checks that a value is small, plain and JSON-safe before it is stored or
 * applied. It says nothing about whether the setting itself accepts it — that is
 * the owning control's own `validate`, which the engine calls separately.
 */
export function checkAssignmentValue(value: unknown): { ok: boolean; error: string } {
  if (value === null) return { ok: true, error: '' };
  switch (typeof value) {
    case 'boolean':
      return { ok: true, error: '' };
    case 'number':
      return Number.isFinite(value)
        ? { ok: true, error: '' }
        : { ok: false, error: 'A numeric value must be a real, finite number.' };
    case 'string':
      return value.length <= LIMITS.maxStringValueLength
        ? { ok: true, error: '' }
        : { ok: false, error: `A text value may not exceed ${LIMITS.maxStringValueLength} characters.` };
    default:
      return { ok: false, error: 'Only text, numbers, true/false and null may be scheduled.' };
  }
}

/* ------------------------------------------------------------------ */
/* Rule validation                                                     */
/* ------------------------------------------------------------------ */

export interface RuleValidation {
  ok: boolean;
  rule: ScheduleRule | null;
  /** Field-by-field problems, so the editor can say which box is wrong. */
  errors: Array<{ field: string; message: string }>;
}

const WEEKDAY_SET = [0, 1, 2, 3, 4, 5, 6];

/**
 * Validates one candidate rule.
 *
 * Nothing is guessed. A missing time is an error rather than a default, because
 * a rule that silently acquired midnight-to-midnight would apply its settings for
 * the whole day and nobody asked it to.
 */
export function validateRule(raw: unknown, index = 0): RuleValidation {
  const errors: Array<{ field: string; message: string }> = [];
  const record = (raw ?? {}) as Record<string, unknown>;
  const push = (field: string, message: string): void => {
    errors.push({ field, message });
  };

  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, rule: null, errors: [{ field: 'rule', message: 'A rule must be an object.' }] };
  }

  const id = typeof record.id === 'string' && record.id.trim() !== '' ? record.id.trim() : newRuleId();

  const label = typeof record.label === 'string' ? record.label.trim() : '';
  if (label === '') push('label', 'A rule needs a name so it can be recognised in the list.');
  else if (label.length > LIMITS.maxLabelLength) {
    push('label', `The name may not exceed ${LIMITS.maxLabelLength} characters.`);
  }

  const enabled = record.enabled !== false;
  const priority = clampNumber(record.priority, LIMITS.minPriority, LIMITS.maxPriority, 100);

  let startDate: string | null = null;
  if (record.startDate !== null && record.startDate !== undefined && record.startDate !== '') {
    if (isIsoDate(record.startDate)) startDate = record.startDate;
    else push('startDate', 'The start date is not a real calendar date.');
  }
  let endDate: string | null = null;
  if (record.endDate !== null && record.endDate !== undefined && record.endDate !== '') {
    if (isIsoDate(record.endDate)) endDate = record.endDate;
    else push('endDate', 'The end date is not a real calendar date.');
  }
  if (startDate && endDate && endDate < startDate) {
    push('endDate', 'The end date is before the start date, so the rule could never run.');
  }

  const startTime = isClockTime(record.startTime) ? (record.startTime as string) : '';
  if (startTime === '') push('startTime', 'A start time in the form 22:00 is required.');
  const endTime = isClockTime(record.endTime) ? (record.endTime as string) : '';
  if (endTime === '') push('endTime', 'An end time in the form 06:30 is required.');

  const everyDay = record.everyDay !== false;
  let weekdays: number[] = [];
  if (everyDay) {
    weekdays = [...WEEKDAY_SET];
  } else {
    const candidate = Array.isArray(record.weekdays) ? record.weekdays : [];
    weekdays = [...new Set(candidate.filter((day): day is number => WEEKDAY_SET.includes(day as number)))].sort();
    if (weekdays.length === 0) {
      push('weekdays', 'Choose at least one weekday, or switch the rule to every day.');
    }
  }

  const sourceRaw = (record.source ?? { kind: 'local' }) as Record<string, unknown>;
  let source: RuleSource = { kind: 'local' };
  const kind = sourceRaw.kind;
  if (kind === 'https-api') {
    const check = checkUrl(sourceRaw.url);
    if (!check.ok) push('url', check.error);
    source = {
      kind: 'https-api',
      url: check.ok ? check.url : String(sourceRaw.url ?? ''),
      refreshSeconds: clampNumber(sourceRaw.refreshSeconds, LIMITS.minRefreshSeconds, LIMITS.maxRefreshSeconds, 300)
    };
  } else if (kind === 'home-assistant') {
    const check = checkUrl(sourceRaw.baseUrl);
    if (!check.ok) push('baseUrl', check.error);
    const entity = checkEntityId(sourceRaw.entityId);
    if (!entity.ok) push('entityId', entity.error);
    source = {
      kind: 'home-assistant',
      baseUrl: check.ok ? check.url.replace(/\/+$/, '') : String(sourceRaw.baseUrl ?? ''),
      entityId: String(sourceRaw.entityId ?? '').trim(),
      refreshSeconds: clampNumber(sourceRaw.refreshSeconds, LIMITS.minRefreshSeconds, LIMITS.maxRefreshSeconds, 300),
      vaultAccount: vaultAccountFor(id)
    };
  } else if (kind !== undefined && kind !== 'local') {
    push('source', `"${String(kind)}" is not a source this build understands.`);
  }

  const rawAssignments = Array.isArray(record.assignments) ? record.assignments : [];
  if (rawAssignments.length > LIMITS.maxAssignmentsPerRule) {
    push('assignments', `A rule may set at most ${LIMITS.maxAssignmentsPerRule} settings.`);
  }
  const assignments: Assignment[] = [];
  const seen = new Set<string>();
  for (const candidate of rawAssignments.slice(0, LIMITS.maxAssignmentsPerRule)) {
    const entry = (candidate ?? {}) as Record<string, unknown>;
    const settingId = typeof entry.settingId === 'string' ? entry.settingId.trim() : '';
    if (settingId === '') {
      push('assignments', 'One of the settings in this rule has no id.');
      continue;
    }
    if (seen.has(settingId)) {
      push('assignments', `The setting "${settingId}" is set twice in one rule.`);
      continue;
    }
    const valueCheck = checkAssignmentValue(entry.value);
    if (!valueCheck.ok) {
      push('assignments', `${settingId}: ${valueCheck.error}`);
      continue;
    }
    seen.add(settingId);
    assignments.push({ settingId, value: entry.value ?? null });
  }
  if (source.kind !== 'https-api' && assignments.length === 0) {
    push('assignments', 'A rule with no settings would do nothing. Add at least one setting to change.');
  }

  const createdAt = typeof record.createdAt === 'string' ? record.createdAt : new Date().toISOString();
  const updatedAt = typeof record.updatedAt === 'string' ? record.updatedAt : createdAt;

  if (errors.length > 0) {
    return { ok: false, rule: null, errors };
  }

  return {
    ok: true,
    errors: [],
    rule: {
      id,
      label: label === '' ? `Rule ${index + 1}` : label,
      enabled,
      priority,
      startDate,
      endDate,
      startTime,
      endTime,
      everyDay,
      weekdays,
      source,
      assignments,
      createdAt,
      updatedAt
    }
  };
}

/** The stable credential-vault account key for one rule's Home Assistant token. */
export function vaultAccountFor(ruleId: string): string {
  return `scheduled-settings/home-assistant/${ruleId}`;
}

/* ------------------------------------------------------------------ */
/* Document load and migration                                         */
/* ------------------------------------------------------------------ */

/**
 * Migrates a document written by an older build.
 *
 * Version 0 means a document written before the version field existed. Its rules
 * are handed to the current validator unchanged: every field the old shape had is
 * a field this shape still has, so nothing is dropped and nothing is invented.
 * Anything the validator refuses is quarantined and reported, exactly as a
 * corrupt current-version rule would be.
 */
function migrate(raw: Record<string, unknown>): { rules: unknown[]; from: number | null } {
  const version = typeof raw.schemaVersion === 'number' ? raw.schemaVersion : 0;
  const rules = Array.isArray(raw.rules) ? raw.rules : [];
  if (version === SCHEDULE_SCHEMA_VERSION) return { rules, from: null };
  return { rules, from: version };
}

/**
 * Reads a stored document.
 *
 * A refusal never destroys anything: the caller keeps the stored bytes exactly as
 * they are and reports the reason, so a document from a newer build survives a
 * downgrade instead of being flattened by it.
 */
export function loadDocument(stored: unknown): LoadResult {
  const empty = emptyDocument();
  if (stored === null || stored === undefined || stored === '') {
    return { document: empty, quarantined: [], refused: null, migratedFrom: null };
  }

  let raw: Record<string, unknown>;
  if (typeof stored === 'string') {
    if (stored.length > LIMITS.maxDocumentBytes) {
      return {
        document: empty,
        quarantined: [],
        refused: `The stored schedule is larger than the ${LIMITS.maxDocumentBytes} byte limit, so it was not read.`,
        migratedFrom: null
      };
    }
    try {
      raw = JSON.parse(stored) as Record<string, unknown>;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { document: empty, quarantined: [], refused: `The stored schedule is not valid JSON: ${message}`, migratedFrom: null };
    }
  } else if (typeof stored === 'object' && !Array.isArray(stored)) {
    raw = stored as Record<string, unknown>;
  } else {
    return { document: empty, quarantined: [], refused: 'The stored schedule is not a schedule document.', migratedFrom: null };
  }

  const version = typeof raw.schemaVersion === 'number' ? raw.schemaVersion : 0;
  if (version > SCHEDULE_SCHEMA_VERSION) {
    return {
      document: empty,
      quarantined: [],
      refused: `The stored schedule was written by a newer build (schema ${version}; this build reads ${SCHEDULE_SCHEMA_VERSION}). It was left untouched and no rule is running.`,
      migratedFrom: null
    };
  }

  const { rules: candidates, from } = migrate(raw);
  const rules: ScheduleRule[] = [];
  const quarantined: QuarantinedRule[] = [];
  const ids = new Set<string>();

  candidates.slice(0, LIMITS.maxRules).forEach((candidate, index) => {
    const result = validateRule(candidate, index);
    if (!result.ok || !result.rule) {
      const record = (candidate ?? {}) as Record<string, unknown>;
      quarantined.push({
        id: typeof record.id === 'string' ? record.id : `position ${index + 1}`,
        label: typeof record.label === 'string' ? record.label : `Rule at position ${index + 1}`,
        reason: result.errors.map((entry) => `${entry.field}: ${entry.message}`).join(' '),
        raw: candidate
      });
      return;
    }
    if (ids.has(result.rule.id)) {
      quarantined.push({
        id: result.rule.id,
        label: result.rule.label,
        reason: 'Two rules claim the same id, so the second was not loaded.',
        raw: candidate
      });
      return;
    }
    ids.add(result.rule.id);
    rules.push(result.rule);
  });

  if (candidates.length > LIMITS.maxRules) {
    quarantined.push({
      id: 'overflow',
      label: `${candidates.length - LIMITS.maxRules} further rules`,
      reason: `The document holds more than the ${LIMITS.maxRules} rule limit. The rules past that limit were not loaded and were not deleted.`,
      raw: null
    });
  }

  return {
    document: {
      schemaVersion: SCHEDULE_SCHEMA_VERSION,
      rules,
      updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString()
    },
    quarantined,
    refused: null,
    migratedFrom: from
  };
}

/** Serializes a document for storage. */
export function serializeDocument(document: ScheduleDocument): ScheduleDocument {
  return {
    schemaVersion: SCHEDULE_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    rules: document.rules.slice(0, LIMITS.maxRules).map((rule) => ({
      ...rule,
      weekdays: [...rule.weekdays].sort(),
      assignments: rule.assignments.slice(0, LIMITS.maxAssignmentsPerRule).map((entry) => ({ ...entry }))
    }))
  };
}
