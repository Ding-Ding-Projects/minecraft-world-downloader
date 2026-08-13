import type { AppContext } from '../../core/registry';
import {
  OPTION_DEFINITIONS,
  OPTION_IDS,
  asString,
  defaultValues,
  normalizeValues,
  type OptionValue,
  type ProfileValues
} from './options';

/**
 * Saved server presets.
 *
 * A profile is a name plus one value per launch option. It is stored in the
 * ordinary settings document, so it takes part in export, import, local history
 * and the provenance line like anything else the application remembers.
 *
 * There is no sample profile and no demo server. An installation that has never
 * saved one shows an honest empty state with a real creation path beside it.
 */

export const PROFILES_SETTING_ID = 'downloader.profiles';
export const LAST_PROFILE_SETTING_ID = 'downloader.lastProfileId';

export interface DownloadProfile {
  id: string;
  name: string;
  /** The user's own note about what this profile is for. May be empty. */
  notes: string;
  values: ProfileValues;
  createdAt: string;
  updatedAt: string;
}

function newId(): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `profile-${Date.now().toString(36)}-${random}`;
}

export function readProfiles(ctx: AppContext): DownloadProfile[] {
  const stored = ctx.settings.get<unknown>(PROFILES_SETTING_ID, []);
  if (!Array.isArray(stored)) return [];
  const profiles: DownloadProfile[] = [];
  for (const raw of stored) {
    if (!raw || typeof raw !== 'object') continue;
    const record = raw as Record<string, unknown>;
    const id = typeof record.id === 'string' && record.id !== '' ? record.id : newId();
    const name = typeof record.name === 'string' && record.name.trim() !== '' ? record.name : 'Unnamed profile';
    profiles.push({
      id,
      name,
      notes: typeof record.notes === 'string' ? record.notes : '',
      values: normalizeValues(record.values),
      createdAt: typeof record.createdAt === 'string' ? record.createdAt : new Date(0).toISOString(),
      updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : new Date(0).toISOString()
    });
  }
  return profiles;
}

export function writeProfiles(ctx: AppContext, profiles: DownloadProfile[]): void {
  ctx.settings.set(PROFILES_SETTING_ID, profiles);
}

export function createProfile(name: string, notes: string, values: ProfileValues): DownloadProfile {
  const now = new Date().toISOString();
  return {
    id: newId(),
    name: name.trim() === '' ? 'Unnamed profile' : name.trim(),
    notes,
    values: normalizeValues(values),
    createdAt: now,
    updatedAt: now
  };
}

export function duplicateProfile(profile: DownloadProfile, name: string): DownloadProfile {
  const now = new Date().toISOString();
  return {
    ...profile,
    id: newId(),
    name,
    values: { ...profile.values },
    createdAt: now,
    updatedAt: now
  };
}

/** A one-line description of where a profile points, for the list row. */
export function describeProfile(profile: DownloadProfile): string {
  const host = asString(profile.values[OPTION_IDS.serverHost]).trim();
  const port = Number(profile.values[OPTION_IDS.serverPort] ?? 25565);
  const target = host === '' ? 'no server address' : port === 25565 ? host : `${host}:${port}`;
  const output = asString(profile.values[OPTION_IDS.outputDir]).trim() || 'world';
  return `${target} → ${output}`;
}

/** How many options a profile changes from the compiled-in defaults. */
export function changedOptionIds(values: ProfileValues): string[] {
  const defaults = defaultValues();
  const changed: string[] = [];
  for (const definition of OPTION_DEFINITIONS) {
    const current = values[definition.id];
    if (String(current) !== String(defaults[definition.id])) changed.push(definition.id);
  }
  return changed;
}

/** Flat rows for the exporter: one record per profile, one column per option. */
export function profileExportRecords(profiles: DownloadProfile[]): Array<Record<string, unknown>> {
  return profiles.map((profile) => {
    const row: Record<string, unknown> = {
      id: profile.id,
      name: profile.name,
      notes: profile.notes,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt
    };
    for (const definition of OPTION_DEFINITIONS) {
      row[definition.id] = profile.values[definition.id];
    }
    return row;
  });
}

/* ------------------------------------------------------------------ */
/* Blank-slate presets                                                 */
/* ------------------------------------------------------------------ */

export interface ProfilePreset {
  id: string;
  nameKey: string;
  descriptionKey: string;
  /**
   * The exact deviation from the compiled-in defaults. Everything not named
   * here is the default, so a preset can never disagree with the reset path
   * about what the defaults are.
   */
  delta: Partial<Record<string, OptionValue>>;
}

export const PROFILE_PRESETS: ProfilePreset[] = [
  {
    id: 'defaults',
    nameKey: 'downloader.preset.defaults',
    descriptionKey: 'downloader.preset.defaults.description',
    delta: {}
  },
  {
    id: 'java-map-window',
    nameKey: 'downloader.preset.javaWindow',
    descriptionKey: 'downloader.preset.javaWindow.description',
    delta: {
      [OPTION_IDS.showJavaWindow]: true,
      [OPTION_IDS.guiTheme]: 'dark'
    }
  },
  {
    id: 'extended-render',
    nameKey: 'downloader.preset.extendedRender',
    descriptionKey: 'downloader.preset.extendedRender.description',
    delta: {
      [OPTION_IDS.extendedRenderDistance]: 16,
      [OPTION_IDS.drawExtendedChunks]: true
    }
  },
  {
    id: 'container-sweep',
    nameKey: 'downloader.preset.containerSweep',
    descriptionKey: 'downloader.preset.containerSweep.description',
    delta: {
      [OPTION_IDS.autoOpen]: true,
      [OPTION_IDS.autoOpenDelay]: 600
    }
  }
];

/** Builds a preset's values strictly from the real defaults plus its delta. */
export function presetValues(preset: ProfilePreset): ProfileValues {
  const values = defaultValues();
  for (const [id, value] of Object.entries(preset.delta)) {
    if (value !== undefined) values[id] = value;
  }
  return values;
}

/** The option ids a preset changes, so the offer can say exactly what it sets. */
export function presetChanges(preset: ProfilePreset): string[] {
  return Object.keys(preset.delta);
}
