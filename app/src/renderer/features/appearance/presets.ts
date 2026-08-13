import type { AppContext, AppearanceOverride, ThemeState } from '../../core/registry';

/**
 * The appearance document, the preset store and the transfer format.
 *
 * Everything here is built ON TOP of the core appearance service rather than
 * beside it. Reading the current appearance is `appearance.exportThemeJson()`,
 * writing one is `appearance.importThemeJson()`, and applying a preset is
 * `appearance.applyPreset()`. Two routes to one value can never disagree about
 * what that value is, because there is only one route underneath.
 *
 * Two rules shape the validation below.
 *
 * Nothing is silently dropped. A value this build cannot represent is reported
 * with the exact reason and KEPT, byte for byte, so the user can export it,
 * carry it to a newer build, or simply read what their own file said. The one
 * thing that never happens is a quiet deletion.
 *
 * An override is CSS that this application writes into a live stylesheet, so a
 * value carrying a brace could end a rule early and start one of its own. Those
 * are refused with a stated reason rather than written and hoped for.
 */

/* ------------------------------------------------------------------ */
/* Storage keys                                                        */
/* ------------------------------------------------------------------ */

/**
 * The index the core appearance service reads for saved presets, and the
 * per-preset payload key it reads when one is applied. This feature writes the
 * shape that service already expects; it does not keep a second private copy.
 */
export const PRESET_INDEX_KEY = 'appearance.presets';
export const presetPayloadKey = (id: string): string => `appearance.preset.${id}`;

/** Metadata this feature owns: created and updated stamps plus the user's note. */
export const PRESET_META_KEY = 'appearance.studio.presetMeta';
/** What a preset was observed to set, the last time it was actually applied. */
export const PRESET_OBSERVED_KEY = 'appearance.studio.presetObserved';
/** Entries an import could not apply, kept exactly as they were written. */
export const KEPT_IMPORT_KEY = 'appearance.studio.keptImportEntries';
/** The appearance in force immediately before the most recent preset apply. */
export const UNDO_KEY = 'appearance.studio.previousAppearance';

/* ------------------------------------------------------------------ */
/* The document                                                        */
/* ------------------------------------------------------------------ */

export interface ThemeValues {
  mode?: string;
  seed?: string;
  contrast?: string;
  density?: number;
  fontFamily?: string;
  fontScale?: number;
  fontWeight?: number;
}

export interface AppearanceDocument {
  schemaVersion: 1;
  generatedAt: string;
  theme: ThemeValues;
  overrides?: Record<string, AppearanceOverride[]>;
  /** Optional payload carrying saved presets alongside the appearance itself. */
  presets?: Array<{ id: string; name: string; note?: string; document: AppearanceDocument }>;
}

export interface KeptEntry {
  /** Where in the file it came from, e.g. `theme.density`. */
  path: string;
  /** The value exactly as the file wrote it, serialized so it survives storage. */
  value: string;
  /** Why this build did not apply it, in plain words. */
  reason: string;
  /** When it was kept, so an old kept entry is identifiable as old. */
  keptAt: string;
}

export interface IncomingPreset {
  name: string;
  note: string;
  document: AppearanceDocument;
}

export interface ValidationResult {
  ok: boolean;
  /** Present when `ok`. Contains only the parts this build can apply. */
  document?: AppearanceDocument;
  /** Present when the whole file was refused; nothing was changed. */
  error?: string;
  /** Anything the file said that this build kept without applying. */
  kept: KeptEntry[];
  /** Notes about values that WERE applied but deserve a word, e.g. a missing font. */
  notes: string[];
  /** Presets carried by the file, ready to be added to the saved list. */
  presets: IncomingPreset[];
}

const THEME_MODES = new Set(['light', 'dark', 'system']);
const CONTRASTS = new Set(['standard', 'medium', 'high']);
const KNOWN_TOP_LEVEL = new Set(['schemaVersion', 'generatedAt', 'theme', 'overrides', 'presets', 'application']);
const KNOWN_THEME_KEYS = new Set(['mode', 'seed', 'contrast', 'density', 'fontFamily', 'fontScale', 'fontWeight']);

/** The compiled-in defaults for every theme value this feature can reset. */
export const THEME_DEFAULTS: Required<ThemeValues> = {
  mode: 'system',
  seed: '#4f6bed',
  contrast: 'standard',
  density: 0,
  fontFamily: '',
  fontScale: 1,
  fontWeight: 400
};

/** The setting id behind each theme value, so provenance can be reported truthfully. */
export const THEME_SETTING_IDS: Record<keyof ThemeValues, string> = {
  mode: 'appearance.themeMode',
  seed: 'appearance.seed',
  contrast: 'appearance.contrast',
  density: 'appearance.density',
  fontFamily: 'appearance.fontFamily',
  fontScale: 'appearance.fontScale',
  fontWeight: 'appearance.fontWeight'
};

/* ------------------------------------------------------------------ */
/* Reading and writing the live appearance                             */
/* ------------------------------------------------------------------ */

/** The appearance in force right now, read through the core service. */
export function currentDocument(ctx: AppContext): AppearanceDocument {
  const parsed = safeParse(ctx.appearance.exportThemeJson());
  const document_: AppearanceDocument = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    theme: themeValuesOf(ctx.theme.state()),
    overrides: {}
  };
  if (parsed && typeof parsed === 'object') {
    const overrides = (parsed as { overrides?: unknown }).overrides;
    if (overrides && typeof overrides === 'object' && !Array.isArray(overrides)) {
      document_.overrides = readStoredOverrides(overrides as Record<string, unknown>);
    }
  }
  return document_;
}

/**
 * Reads the overrides already in force.
 *
 * This deliberately checks the SHAPE and nothing else. The strict validation
 * further down belongs on an imported file, which is untrusted; running it here
 * as well would mean an override the editor accepted quietly vanished from the
 * next export, which is the exact silent drop this feature promises never to do.
 */
function readStoredOverrides(raw: Record<string, unknown>): Record<string, AppearanceOverride[]> {
  const result: Record<string, AppearanceOverride[]> = {};
  for (const [selector, list] of Object.entries(raw)) {
    if (!Array.isArray(list)) continue;
    const clean = list.filter(
      (item): item is AppearanceOverride =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as AppearanceOverride).property === 'string' &&
        typeof (item as AppearanceOverride).value === 'string'
    );
    if (clean.length > 0) result[selector] = clean.map((item) => ({ property: item.property, value: item.value }));
  }
  return result;
}

export function themeValuesOf(state: ThemeState): Required<ThemeValues> {
  return {
    mode: state.mode,
    seed: state.seed,
    contrast: state.contrast,
    density: state.density,
    fontFamily: state.fontFamily,
    fontScale: state.fontScale,
    fontWeight: state.fontWeight
  };
}

/**
 * Writes a whole appearance document.
 *
 * A document with no `overrides` key deliberately leaves the current overrides
 * alone: that is what makes a theme-only file portable rather than destructive.
 */
export function writeDocument(ctx: AppContext, document_: AppearanceDocument): { ok: boolean; error?: string } {
  return ctx.appearance.importThemeJson(JSON.stringify(document_));
}

/** Restores the shipped theme values, leaving per-element overrides untouched. */
export function resetThemeValues(ctx: AppContext): string[] {
  const before = themeValuesOf(ctx.theme.state());
  ctx.theme.setMode('system');
  ctx.theme.setSeed(THEME_DEFAULTS.seed);
  ctx.theme.setContrast('standard');
  ctx.theme.setDensity(THEME_DEFAULTS.density);
  ctx.theme.setFontFamily(THEME_DEFAULTS.fontFamily);
  ctx.theme.setFontScale(THEME_DEFAULTS.fontScale);
  ctx.theme.setFontWeight(THEME_DEFAULTS.fontWeight);
  return diffThemeValues(before, themeValuesOf(ctx.theme.state()));
}

/** Human-readable list of the theme values that differ between two states. */
export function diffThemeValues(before: ThemeValues, after: ThemeValues): string[] {
  const changed: string[] = [];
  for (const key of KNOWN_THEME_KEYS) {
    const name = key as keyof ThemeValues;
    const left = before[name];
    const right = after[name];
    if (left === right) continue;
    changed.push(`${name}: ${describe(left)} → ${describe(right)}`);
  }
  return changed;
}

function describe(value: unknown): string {
  if (value === '' || value === undefined || value === null) return 'not set';
  return String(value);
}

/* ------------------------------------------------------------------ */
/* Saved presets                                                       */
/* ------------------------------------------------------------------ */

export interface SavedPresetIndexEntry {
  id: string;
  name: string;
}

export interface PresetMeta {
  createdAt: string;
  updatedAt: string;
  note: string;
}

export interface PresetRow {
  id: string;
  name: string;
  /** `saved` rows can be renamed, deleted and exported; `application` rows cannot. */
  kind: 'saved' | 'application';
  note: string;
  createdAt: string | null;
  /** What it set the last time it was genuinely applied, or null if never. */
  observed: string[] | null;
  /** Present for a saved preset: what the stored payload actually contains. */
  document: AppearanceDocument | null;
}

export function savedIndex(ctx: AppContext): SavedPresetIndexEntry[] {
  const raw = ctx.settings.get<unknown>(PRESET_INDEX_KEY, []);
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (item): item is SavedPresetIndexEntry =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as SavedPresetIndexEntry).id === 'string' &&
        typeof (item as SavedPresetIndexEntry).name === 'string'
    )
    .map((item) => ({ id: item.id, name: item.name }));
}

function metaMap(ctx: AppContext): Record<string, PresetMeta> {
  const raw = ctx.settings.get<unknown>(PRESET_META_KEY, {});
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, PresetMeta>) : {};
}

function observedMap(ctx: AppContext): Record<string, string[]> {
  const raw = ctx.settings.get<unknown>(PRESET_OBSERVED_KEY, {});
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, string[]>) : {};
}

/** Every preset the application offers: the shipped ones and the user's own. */
export function presetRows(ctx: AppContext): PresetRow[] {
  const saved = savedIndex(ctx);
  const savedIds = new Set(saved.map((entry) => entry.id));
  const meta = metaMap(ctx);
  const observed = observedMap(ctx);

  const rows: PresetRow[] = [];
  for (const preset of ctx.appearance.presets()) {
    if (savedIds.has(preset.id)) continue;
    rows.push({
      id: preset.id,
      name: preset.name,
      kind: 'application',
      note: '',
      createdAt: null,
      observed: observed[preset.id] ?? null,
      document: null
    });
  }
  for (const entry of saved) {
    const payload = ctx.settings.get<unknown>(presetPayloadKey(entry.id), null);
    rows.push({
      id: entry.id,
      name: entry.name,
      kind: 'saved',
      note: meta[entry.id]?.note ?? '',
      createdAt: meta[entry.id]?.createdAt ?? null,
      observed: observed[entry.id] ?? null,
      document: isDocument(payload) ? (payload as AppearanceDocument) : null
    });
  }
  return rows;
}

function isDocument(value: unknown): boolean {
  return typeof value === 'object' && value !== null && (value as { schemaVersion?: unknown }).schemaVersion === 1;
}

function newPresetId(): string {
  const stamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
  const random = Math.floor(Math.random() * 1e6)
    .toString(36)
    .padStart(4, '0');
  return `user-${stamp}-${random}`;
}

export interface SaveOutcome {
  ok: boolean;
  error?: string;
  id?: string;
  themeCount?: number;
  overrideCount?: number;
}

/** Saves the current appearance under a name. Names are unique among saved presets. */
export async function savePreset(
  ctx: AppContext,
  name: string,
  note: string,
  includeOverrides: boolean
): Promise<SaveOutcome> {
  const trimmed = name.trim();
  if (trimmed === '') {
    return { ok: false, error: ctx.t('appearance.preset.nameEmpty', 'A preset needs a name of at least one character.') };
  }
  const existing = presetRows(ctx);
  if (existing.some((row) => row.name.toLowerCase() === trimmed.toLowerCase())) {
    return {
      ok: false,
      error: ctx.t('appearance.preset.nameTaken', '"{name}" is already the name of a preset. Choose another name.', {
        values: { name: trimmed }
      })
    };
  }

  const document_ = currentDocument(ctx);
  if (!includeOverrides) delete document_.overrides;

  const id = newPresetId();
  ctx.settings.set(presetPayloadKey(id), document_);
  ctx.settings.set(PRESET_INDEX_KEY, [...savedIndex(ctx), { id, name: trimmed }]);
  const meta = { ...metaMap(ctx) };
  const now = new Date().toISOString();
  meta[id] = { createdAt: now, updatedAt: now, note: note.trim() };
  ctx.settings.set(PRESET_META_KEY, meta);

  const overrideCount = countOverrides(document_.overrides);
  await ctx.history.record('Saved an appearance preset', 'appearance', {
    id,
    name: trimmed,
    themeValues: Object.keys(document_.theme).length,
    overrideCount
  });
  return { ok: true, id, themeCount: Object.keys(document_.theme).length, overrideCount };
}

export function countOverrides(overrides: Record<string, AppearanceOverride[]> | undefined): number {
  if (!overrides) return 0;
  return Object.values(overrides).reduce((total, list) => total + list.length, 0);
}

export async function renamePreset(ctx: AppContext, id: string, name: string): Promise<{ ok: boolean; error?: string }> {
  const trimmed = name.trim();
  if (trimmed === '') {
    return { ok: false, error: ctx.t('appearance.preset.nameEmpty', 'A preset needs a name of at least one character.') };
  }
  const index = savedIndex(ctx);
  const target = index.find((entry) => entry.id === id);
  if (!target) return { ok: false, error: 'That preset is not one of the saved presets.' };
  if (
    presetRows(ctx).some((row) => row.id !== id && row.name.toLowerCase() === trimmed.toLowerCase())
  ) {
    return {
      ok: false,
      error: ctx.t('appearance.preset.nameTaken', '"{name}" is already the name of a preset. Choose another name.', {
        values: { name: trimmed }
      })
    };
  }
  const previous = target.name;
  ctx.settings.set(
    PRESET_INDEX_KEY,
    index.map((entry) => (entry.id === id ? { id, name: trimmed } : entry))
  );
  const meta = { ...metaMap(ctx) };
  if (meta[id]) meta[id] = { ...meta[id], updatedAt: new Date().toISOString() };
  ctx.settings.set(PRESET_META_KEY, meta);
  await ctx.history.record('Renamed an appearance preset', 'appearance', { id, from: previous, to: trimmed });
  return { ok: true };
}

export async function duplicatePreset(ctx: AppContext, id: string): Promise<{ ok: boolean; error?: string; id?: string }> {
  const row = presetRows(ctx).find((candidate) => candidate.id === id);
  if (!row || row.kind !== 'saved' || !row.document) {
    return { ok: false, error: 'Only a preset you saved can be duplicated, because only that one has a stored payload.' };
  }
  let name = `${row.name} (copy)`;
  let counter = 2;
  const taken = new Set(presetRows(ctx).map((candidate) => candidate.name.toLowerCase()));
  while (taken.has(name.toLowerCase())) {
    name = `${row.name} (copy ${counter})`;
    counter += 1;
  }
  const copyId = newPresetId();
  ctx.settings.set(presetPayloadKey(copyId), row.document);
  ctx.settings.set(PRESET_INDEX_KEY, [...savedIndex(ctx), { id: copyId, name }]);
  const meta = { ...metaMap(ctx) };
  const now = new Date().toISOString();
  meta[copyId] = { createdAt: now, updatedAt: now, note: row.note };
  ctx.settings.set(PRESET_META_KEY, meta);
  await ctx.history.record('Duplicated an appearance preset', 'appearance', { from: id, to: copyId, name });
  return { ok: true, id: copyId };
}

/** Deletes saved presets. Application presets are part of the build and are refused. */
export async function deletePresets(ctx: AppContext, ids: string[]): Promise<{ removed: string[]; refused: string[] }> {
  const index = savedIndex(ctx);
  const savedIds = new Set(index.map((entry) => entry.id));
  const removed = ids.filter((id) => savedIds.has(id));
  const refused = ids.filter((id) => !savedIds.has(id));
  if (removed.length === 0) return { removed, refused };

  const removedSet = new Set(removed);
  ctx.settings.set(
    PRESET_INDEX_KEY,
    index.filter((entry) => !removedSet.has(entry.id))
  );
  const meta = { ...metaMap(ctx) };
  const observed = { ...observedMap(ctx) };
  for (const id of removed) {
    ctx.settings.reset(presetPayloadKey(id));
    delete meta[id];
    delete observed[id];
  }
  ctx.settings.set(PRESET_META_KEY, meta);
  ctx.settings.set(PRESET_OBSERVED_KEY, observed);
  await ctx.history.record('Deleted appearance presets', 'appearance', { removed, refused });
  return { removed, refused };
}

export interface ApplyOutcome {
  ok: boolean;
  error?: string;
  /** The exact values the preset changed, as `key: before → after` strings. */
  changed: string[];
  /** The appearance that was in force beforehand, for the undo action. */
  previous: AppearanceDocument;
}

/**
 * Applies a preset through the core service and reports exactly what moved.
 *
 * The observation is what makes an application preset honest: this feature does
 * not carry a second copy of the shipped preset table that could drift from the
 * real one, so it states what the preset actually did rather than what a
 * duplicated table claims it would do.
 */
export async function applyPreset(ctx: AppContext, id: string, name: string): Promise<ApplyOutcome> {
  const previous = currentDocument(ctx);
  try {
    ctx.appearance.applyPreset(id);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message, changed: [], previous };
  }
  const after = currentDocument(ctx);
  const changed = [
    ...diffThemeValues(previous.theme, after.theme),
    ...diffOverrideCounts(previous.overrides, after.overrides)
  ];

  const observed = { ...observedMap(ctx) };
  observed[id] = changed;
  ctx.settings.set(PRESET_OBSERVED_KEY, observed);
  ctx.settings.set(UNDO_KEY, previous);

  await ctx.history.record('Applied an appearance preset', 'appearance', { id, name, changed });
  return { ok: true, changed, previous };
}

function diffOverrideCounts(
  before: Record<string, AppearanceOverride[]> | undefined,
  after: Record<string, AppearanceOverride[]> | undefined
): string[] {
  const beforeCount = countOverrides(before);
  const afterCount = countOverrides(after);
  if (beforeCount === afterCount) return [];
  return [`element overrides: ${beforeCount} → ${afterCount}`];
}

/** Puts back the appearance captured immediately before the last preset apply. */
export async function undoLastApply(ctx: AppContext): Promise<{ ok: boolean; error?: string }> {
  const stored = ctx.settings.get<unknown>(UNDO_KEY, null);
  if (!isDocument(stored)) {
    return { ok: false, error: 'There is no captured appearance to put back.' };
  }
  const result = writeDocument(ctx, stored as AppearanceDocument);
  if (!result.ok) return result;
  await ctx.history.record('Restored the appearance from before a preset', 'appearance', {});
  return { ok: true };
}

export function hasUndo(ctx: AppContext): boolean {
  return isDocument(ctx.settings.get<unknown>(UNDO_KEY, null));
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Refuses a value that could escape the CSS rule it is written into.
 *
 * Overrides end up in a live stylesheet as `selector { property: value; }`, so a
 * brace in either half would end that rule and begin another one of the file's
 * choosing. This is the one place an imported file could reach further than the
 * element it names, so it is checked here rather than assumed elsewhere.
 */
function cssSafe(text: string): boolean {
  return !/[{}<>]/.test(text) && !text.includes('*/') && !text.includes('/*');
}

function propertyLooksValid(property: string): boolean {
  return /^--[A-Za-z0-9-]+$/.test(property) || /^[a-zA-Z-]+$/.test(property);
}

function supportsDeclaration(property: string, value: string): boolean {
  if (property.startsWith('--')) return true;
  try {
    return CSS.supports(property, value);
  } catch {
    return false;
  }
}

interface NormalizedOverrides {
  accepted: Record<string, AppearanceOverride[]>;
  kept: KeptEntry[];
}

function normalizeOverrides(raw: Record<string, unknown>): NormalizedOverrides {
  const accepted: Record<string, AppearanceOverride[]> = {};
  const kept: KeptEntry[] = [];
  const keptAt = new Date().toISOString();

  for (const [selector, list] of Object.entries(raw)) {
    if (!Array.isArray(list)) {
      kept.push({
        path: `overrides["${selector}"]`,
        value: JSON.stringify(list ?? null),
        reason: 'An override list must be an array of {property, value} objects.',
        keptAt
      });
      continue;
    }
    if (!cssSafe(selector) || selector.trim() === '') {
      kept.push({
        path: `overrides["${selector}"]`,
        value: JSON.stringify(list),
        reason:
          'That selector contains a brace, an angle bracket or a comment marker, so writing it into the stylesheet could affect elements it does not name. It was kept but not applied.',
        keptAt
      });
      continue;
    }
    const clean: AppearanceOverride[] = [];
    list.forEach((item, index) => {
      const path = `overrides["${selector}"][${index}]`;
      if (typeof item !== 'object' || item === null) {
        kept.push({ path, value: JSON.stringify(item ?? null), reason: 'An override must be an object.', keptAt });
        return;
      }
      const property = (item as AppearanceOverride).property;
      const value = (item as AppearanceOverride).value;
      if (typeof property !== 'string' || typeof value !== 'string') {
        kept.push({
          path,
          value: JSON.stringify(item),
          reason: 'Both the property and the value of an override must be strings.',
          keptAt
        });
        return;
      }
      if (!propertyLooksValid(property)) {
        kept.push({ path, value: JSON.stringify(item), reason: `"${property}" is not a CSS property name.`, keptAt });
        return;
      }
      if (!cssSafe(property) || !cssSafe(value)) {
        kept.push({
          path,
          value: JSON.stringify(item),
          reason:
            'That declaration contains a brace, an angle bracket or a comment marker, so it could end the rule it belongs to. It was kept but not applied.',
          keptAt
        });
        return;
      }
      if (!supportsDeclaration(property, value)) {
        kept.push({
          path,
          value: JSON.stringify(item),
          reason: `This build cannot render "${property}: ${value}". The value is kept exactly as written; a build that understands it will apply it.`,
          keptAt
        });
        return;
      }
      clean.push({ property, value });
    });
    if (clean.length > 0) accepted[selector] = clean;
  }

  return { accepted, kept };
}

function colorLooksValid(value: string): boolean {
  try {
    return CSS.supports('color', value);
  } catch {
    return false;
  }
}

/**
 * Validates a candidate appearance file.
 *
 * A file that is not JSON, or is not this schema, is refused whole and nothing
 * is changed — a half-applied appearance is worse than none. Inside a file that
 * IS this schema, each value stands or falls on its own, and every one that
 * falls is kept with a reason rather than dropped.
 */
export function validateDocument(text: string, ctx: AppContext): ValidationResult {
  const parsed = safeParse(text);
  if (parsed === null) {
    return { ok: false, error: 'That file is not valid JSON. Nothing was changed.', kept: [], notes: [], presets: [] };
  }
  if (typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      ok: false,
      error: 'An appearance file must be a JSON object. Nothing was changed.',
      kept: [],
      notes: [],
      presets: []
    };
  }
  const raw = parsed as Record<string, unknown>;
  if (raw.schemaVersion !== 1) {
    return {
      ok: false,
      error: `This build reads appearance schema version 1; that file declares ${JSON.stringify(raw.schemaVersion ?? null)}. Nothing was changed.`,
      kept: [],
      notes: [],
      presets: []
    };
  }

  const kept: KeptEntry[] = [];
  const notes: string[] = [];
  const keptAt = new Date().toISOString();

  for (const key of Object.keys(raw)) {
    if (KNOWN_TOP_LEVEL.has(key)) continue;
    kept.push({
      path: key,
      value: JSON.stringify(raw[key]),
      reason: 'This build has no such section in an appearance file. It was kept, not discarded.',
      keptAt
    });
  }

  const theme: ThemeValues = {};
  const rawTheme = raw.theme;
  if (rawTheme && typeof rawTheme === 'object' && !Array.isArray(rawTheme)) {
    const values = rawTheme as Record<string, unknown>;
    for (const [key, value] of Object.entries(values)) {
      const path = `theme.${key}`;
      if (!KNOWN_THEME_KEYS.has(key)) {
        kept.push({ path, value: JSON.stringify(value), reason: 'This build has no such theme value.', keptAt });
        continue;
      }
      if (key === 'mode') {
        if (typeof value === 'string' && THEME_MODES.has(value)) theme.mode = value;
        else
          kept.push({
            path,
            value: JSON.stringify(value),
            reason: 'A colour scheme must be "light", "dark" or "system".',
            keptAt
          });
      } else if (key === 'seed') {
        if (typeof value === 'string' && colorLooksValid(value)) theme.seed = value;
        else
          kept.push({
            path,
            value: JSON.stringify(value),
            reason: 'This build could not read that as a colour.',
            keptAt
          });
      } else if (key === 'contrast') {
        if (typeof value === 'string' && CONTRASTS.has(value)) theme.contrast = value;
        else
          kept.push({
            path,
            value: JSON.stringify(value),
            reason: 'Contrast must be "standard", "medium" or "high".',
            keptAt
          });
      } else if (key === 'density') {
        if (typeof value === 'number' && Number.isFinite(value) && value >= -3 && value <= 0) theme.density = value;
        else
          kept.push({
            path,
            value: JSON.stringify(value),
            reason: 'Density runs from -3 to 0 in this build.',
            keptAt
          });
      } else if (key === 'fontFamily') {
        if (typeof value === 'string' && cssSafe(value)) theme.fontFamily = value;
        else
          kept.push({
            path,
            value: JSON.stringify(value),
            reason: 'A typeface name must be text without braces or comment markers.',
            keptAt
          });
      } else if (key === 'fontScale') {
        if (typeof value === 'number' && Number.isFinite(value) && value >= 0.8 && value <= 1.6) theme.fontScale = value;
        else
          kept.push({
            path,
            value: JSON.stringify(value),
            reason: 'The text size multiplier runs from 0.8 to 1.6 in this build.',
            keptAt
          });
      } else if (key === 'fontWeight') {
        if (typeof value === 'number' && Number.isFinite(value) && value >= 100 && value <= 900) {
          theme.fontWeight = value;
        } else
          kept.push({
            path,
            value: JSON.stringify(value),
            reason: 'A text weight runs from 100 to 900.',
            keptAt
          });
      }
    }
  } else if (rawTheme !== undefined) {
    kept.push({ path: 'theme', value: JSON.stringify(rawTheme), reason: 'The theme section must be an object.', keptAt });
  }

  let overrides: Record<string, AppearanceOverride[]> | undefined;
  const rawOverrides = raw.overrides;
  if (rawOverrides && typeof rawOverrides === 'object' && !Array.isArray(rawOverrides)) {
    const normalized = normalizeOverrides(rawOverrides as Record<string, unknown>);
    overrides = normalized.accepted;
    kept.push(...normalized.kept);
  } else if (rawOverrides !== undefined) {
    kept.push({
      path: 'overrides',
      value: JSON.stringify(rawOverrides),
      reason: 'The overrides section must be an object keyed by selector.',
      keptAt
    });
  }

  // A file may carry whole presets beside the appearance itself. They are
  // validated with the same rules, because a preset arriving in a file is
  // exactly as untrusted as the appearance arriving beside it.
  const incomingPresets: IncomingPreset[] = [];
  const rawPresets = raw.presets;
  if (Array.isArray(rawPresets)) {
    rawPresets.forEach((item, index) => {
      const path = `presets[${index}]`;
      if (typeof item !== 'object' || item === null) {
        kept.push({ path, value: JSON.stringify(item ?? null), reason: 'A preset must be an object.', keptAt });
        return;
      }
      const candidate = item as { name?: unknown; note?: unknown; document?: unknown };
      if (typeof candidate.name !== 'string' || candidate.name.trim() === '') {
        kept.push({ path, value: JSON.stringify(item), reason: 'A preset needs a name.', keptAt });
        return;
      }
      const inner = validateDocument(JSON.stringify(candidate.document ?? null), ctx);
      if (!inner.ok || !inner.document) {
        kept.push({
          path,
          value: JSON.stringify(item),
          reason: inner.error ?? 'That preset does not contain a readable appearance.',
          keptAt
        });
        return;
      }
      kept.push(...inner.kept.map((nested) => ({ ...nested, path: `${path}.${nested.path}` })));
      incomingPresets.push({
        name: candidate.name.trim(),
        note: typeof candidate.note === 'string' ? candidate.note : '',
        document: inner.document
      });
    });
  } else if (rawPresets !== undefined) {
    kept.push({
      path: 'presets',
      value: JSON.stringify(rawPresets),
      reason: 'The presets section must be an array.',
      keptAt
    });
  }

  return {
    ok: true,
    document: {
      schemaVersion: 1,
      generatedAt: typeof raw.generatedAt === 'string' ? raw.generatedAt : new Date().toISOString(),
      theme,
      ...(overrides ? { overrides } : {})
    },
    kept,
    notes,
    presets: incomingPresets
  };
}

/* ------------------------------------------------------------------ */
/* Kept entries                                                        */
/* ------------------------------------------------------------------ */

export function keptEntries(ctx: AppContext): KeptEntry[] {
  const raw = ctx.settings.get<unknown>(KEPT_IMPORT_KEY, []);
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is KeptEntry =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as KeptEntry).path === 'string' &&
      typeof (item as KeptEntry).value === 'string' &&
      typeof (item as KeptEntry).reason === 'string'
  );
}

export function storeKeptEntries(ctx: AppContext, entries: KeptEntry[]): void {
  ctx.settings.set(KEPT_IMPORT_KEY, entries);
}

/* ------------------------------------------------------------------ */
/* Import                                                              */
/* ------------------------------------------------------------------ */

export type ImportMode = 'replace' | 'merge';

export interface ImportOutcome {
  ok: boolean;
  error?: string;
  themeCount: number;
  overrideCount: number;
  kept: KeptEntry[];
  notes: string[];
  /** Names of presets the file carried and this build added to the saved list. */
  addedPresets: string[];
  /** The typeface the file asked for, so the caller can check it is installed. */
  fontFamily: string | null;
}

/**
 * Applies a validated document.
 *
 * `merge` keeps the overrides already in place and lets the file win only where
 * both name the same selector AND the same property, which is the only
 * combination where the two genuinely conflict.
 */
export async function importDocument(
  ctx: AppContext,
  text: string,
  mode: ImportMode,
  origin: string
): Promise<ImportOutcome> {
  const validated = validateDocument(text, ctx);
  if (!validated.ok || !validated.document) {
    return {
      ok: false,
      error: validated.error ?? 'That file could not be read.',
      themeCount: 0,
      overrideCount: 0,
      kept: validated.kept,
      notes: validated.notes,
      addedPresets: [],
      fontFamily: null
    };
  }

  const incoming = validated.document;
  const toWrite: AppearanceDocument = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    theme: incoming.theme
  };

  if (incoming.overrides) {
    if (mode === 'merge') {
      const existing = currentDocument(ctx).overrides ?? {};
      const merged: Record<string, AppearanceOverride[]> = {};
      for (const [selector, list] of Object.entries(existing)) merged[selector] = [...list];
      for (const [selector, list] of Object.entries(incoming.overrides)) {
        const target = merged[selector] ? [...merged[selector]] : [];
        for (const override of list) {
          const index = target.findIndex((candidate) => candidate.property === override.property);
          if (index >= 0) target[index] = override;
          else target.push(override);
        }
        merged[selector] = target;
      }
      toWrite.overrides = merged;
    } else {
      toWrite.overrides = incoming.overrides;
    }
  }

  const written = writeDocument(ctx, toWrite);
  if (!written.ok) {
    return {
      ok: false,
      error: written.error ?? 'The appearance could not be written.',
      themeCount: 0,
      overrideCount: 0,
      kept: validated.kept,
      notes: validated.notes,
      addedPresets: [],
      fontFamily: null
    };
  }

  if (validated.kept.length > 0) {
    storeKeptEntries(ctx, [...keptEntries(ctx), ...validated.kept]);
  }

  // Presets travelling inside the file become saved presets, with their names
  // made unique rather than silently overwriting one that is already here.
  const addedPresets: string[] = [];
  for (const incomingPreset of validated.presets) {
    const taken = new Set(presetRows(ctx).map((row) => row.name.toLowerCase()));
    let name = incomingPreset.name;
    let counter = 2;
    while (taken.has(name.toLowerCase())) {
      name = `${incomingPreset.name} (${counter})`;
      counter += 1;
    }
    const id = newPresetId();
    ctx.settings.set(presetPayloadKey(id), incomingPreset.document);
    ctx.settings.set(PRESET_INDEX_KEY, [...savedIndex(ctx), { id, name }]);
    const meta = { ...metaMap(ctx) };
    const now = new Date().toISOString();
    meta[id] = { createdAt: now, updatedAt: now, note: incomingPreset.note };
    ctx.settings.set(PRESET_META_KEY, meta);
    addedPresets.push(name);
  }

  const themeCount = Object.keys(incoming.theme).length;
  const overrideCount = countOverrides(incoming.overrides);
  await ctx.history.record('Imported an appearance file', 'appearance', {
    origin,
    mode,
    themeCount,
    overrideCount,
    keptCount: validated.kept.length,
    addedPresets
  });

  return {
    ok: true,
    themeCount,
    overrideCount,
    kept: validated.kept,
    notes: validated.notes,
    addedPresets,
    fontFamily: incoming.theme.fontFamily ?? null
  };
}

/* ------------------------------------------------------------------ */
/* Export                                                              */
/* ------------------------------------------------------------------ */

/** The canonical appearance file: the current state, ready to re-import. */
export function exportText(ctx: AppContext, includeOverrides: boolean, presets: PresetRow[] = []): string {
  const document_ = currentDocument(ctx);
  if (!includeOverrides) delete document_.overrides;
  const savedPayloads = presets
    .filter((row) => row.kind === 'saved' && row.document)
    .map((row) => ({
      id: row.id,
      name: row.name,
      note: row.note,
      document: row.document as AppearanceDocument
    }));
  if (savedPayloads.length > 0) document_.presets = savedPayloads;
  return `${JSON.stringify(document_, null, 2)}\n`;
}

/** The override table, flattened so a spreadsheet or a database can hold it. */
export function overrideRecords(ctx: AppContext): Array<Record<string, unknown>> {
  const overrides = currentDocument(ctx).overrides ?? {};
  const records: Array<Record<string, unknown>> = [];
  for (const [selector, list] of Object.entries(overrides)) {
    for (const override of list) {
      records.push({ selector, property: override.property, value: override.value });
    }
  }
  return records;
}
