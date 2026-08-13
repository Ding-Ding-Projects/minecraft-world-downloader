import { promises as fs } from 'node:fs';
import { dirname, join } from 'node:path';
import type { SettingsRecord } from '../../shared/api';
import { settingsFilePath } from '../paths';

export const SETTINGS_SCHEMA_VERSION = 1;

function emptyRecord(): SettingsRecord {
  return {
    values: {},
    provenance: {},
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    updatedAt: new Date(0).toISOString()
  };
}

/** True when the settings file has genuinely been written by somebody. */
let fileExisted = false;

export function settingsFileExisted(): boolean {
  return fileExisted;
}

export async function readSettings(): Promise<SettingsRecord> {
  const path = settingsFilePath();
  try {
    const raw = await fs.readFile(path, 'utf8');
    const parsed = JSON.parse(raw) as Partial<SettingsRecord>;
    fileExisted = true;
    const values = isPlainObject(parsed.values) ? parsed.values : {};
    const provenance = isPlainObject(parsed.provenance) ? parsed.provenance : {};
    return {
      values: values as Record<string, unknown>,
      provenance: sanitizeProvenance(provenance as Record<string, unknown>),
      schemaVersion:
        typeof parsed.schemaVersion === 'number' ? parsed.schemaVersion : SETTINGS_SCHEMA_VERSION,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date(0).toISOString()
    };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException | null)?.code;
    if (code === 'ENOENT') {
      fileExisted = false;
      return emptyRecord();
    }
    // A corrupt file must not delete the user's settings silently. Keep a dated
    // copy beside it and start from defaults so the app is usable again.
    fileExisted = false;
    try {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      await fs.rename(path, join(dirname(path), `settings.corrupt-${stamp}.json`));
    } catch {
      /* the rename is best effort; the read failure is what matters */
    }
    const record = emptyRecord();
    (record as SettingsRecord & { recoveredFromCorruption?: boolean }).recoveredFromCorruption = true;
    return record;
  }
}

export async function writeSettings(record: SettingsRecord): Promise<SettingsRecord> {
  const path = settingsFilePath();
  const next: SettingsRecord = {
    values: isPlainObject(record.values) ? record.values : {},
    provenance: sanitizeProvenance(record.provenance as Record<string, unknown>),
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    updatedAt: new Date().toISOString()
  };
  await fs.mkdir(dirname(path), { recursive: true });
  // Atomic: write beside the target and rename, so an interrupted write cannot
  // leave a half-serialized settings file behind.
  const temporary = `${path}.tmp-${process.pid}`;
  await fs.writeFile(temporary, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  await fs.rename(temporary, path);
  fileExisted = true;
  return next;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const PROVENANCE_VALUES = new Set(['user', 'default', 'scheduled', 'imported']);

function sanitizeProvenance(input: Record<string, unknown> | undefined): SettingsRecord['provenance'] {
  const out: SettingsRecord['provenance'] = {};
  if (!input) return out;
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === 'string' && PROVENANCE_VALUES.has(value)) {
      out[key] = value as SettingsRecord['provenance'][string];
    }
  }
  return out;
}
