/**
 * Integration coverage for `main/services/settings.ts` -- the atomic
 * settings read/write/corruption-recovery path.
 *
 * Like the other two files in this lane, this module's real filesystem calls
 * (read, atomic write via temp-file-then-rename, and the corruption-recovery
 * rename) have never run under test before this file. Every test below
 * drives the real exported functions against a real temporary directory;
 * every claim the module makes about its own state is checked a second time
 * through an independent `fs` read of the exact bytes on disk.
 *
 * `settingsFilePath()` reaches Electron's `app.getPath('appData')` through
 * `../paths.ts`. There is no real Electron process in this test run, so
 * `electron` is mocked at exactly that one seam; nothing about `fs` is
 * stubbed. `paths.ts` caches its resolved data root, and `settings.ts` keeps
 * its own `fileExisted` module-level flag, so every test resets the module
 * registry and re-imports fresh, pointed at a brand-new temporary directory.
 */
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SettingsRecord } from '../../src/shared/api';

vi.setConfig({ testTimeout: 30_000, hookTimeout: 20_000 });

const state = vi.hoisted(() => ({ appDataRoot: '' }));

vi.mock('electron', () => ({
  app: {
    getPath: (_name: string) => state.appDataRoot,
    setPath: () => undefined
  }
}));

type SettingsModule = typeof import('../../src/main/services/settings');

const tmpDirs: string[] = [];
function freshTmpDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tmpDirs.push(dir);
  return dir;
}

async function freshSettingsModule(): Promise<SettingsModule> {
  vi.resetModules();
  state.appDataRoot = freshTmpDir('wds-settings-appdata-');
  return import('../../src/main/services/settings');
}

function settingsFilePathFor(appDataRoot: string): string {
  return join(appDataRoot, 'world-downloader-studio', 'settings.json');
}

function makeRecord(overrides: Partial<SettingsRecord> = {}): SettingsRecord {
  return {
    values: { theme: 'dark', windowWidth: 1280 },
    provenance: { theme: 'user' },
    schemaVersion: 1,
    updatedAt: new Date(0).toISOString(),
    ...overrides
  };
}

afterEach(() => {
  for (const dir of tmpDirs.splice(0)) {
    try {
      rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
    } catch {
      // Best-effort cleanup; a lingering handle is not worth failing the suite.
    }
  }
});

/* ==================================================================== */
/* First run: no file at all                                             */
/* ==================================================================== */

describe('readSettings(): first run, before any file has ever been written', () => {
  it('returns empty defaults without creating a file, and settingsFileExisted() reports false', async () => {
    const settings = await freshSettingsModule();
    const path = settingsFilePathFor(state.appDataRoot);

    const record = await settings.readSettings();

    expect(record.values).toEqual({});
    expect(record.provenance).toEqual({});
    expect(record.schemaVersion).toBe(settings.SETTINGS_SCHEMA_VERSION);
    expect(settings.settingsFileExisted()).toBe(false);

    // Independent check: merely reading must never create the file.
    expect(existsSync(path)).toBe(false);
  });
});

/* ==================================================================== */
/* A normal, real round trip                                             */
/* ==================================================================== */

describe('writeSettings()/readSettings(): a real round trip on a real file', () => {
  it('writes real JSON to disk and reads back exactly what was written, verified independently', async () => {
    const settings = await freshSettingsModule();
    const path = settingsFilePathFor(state.appDataRoot);
    const before = Date.now();

    const written = await settings.writeSettings(makeRecord());

    expect(written.values).toEqual({ theme: 'dark', windowWidth: 1280 });
    expect(written.provenance).toEqual({ theme: 'user' });
    expect(Date.parse(written.updatedAt)).toBeGreaterThanOrEqual(before);
    expect(settings.settingsFileExisted()).toBe(true);

    // Independent read #1: raw JSON on disk, parsed outside the module.
    const raw = readFileSync(path, 'utf8');
    const onDisk = JSON.parse(raw) as SettingsRecord;
    expect(onDisk).toEqual(written);

    // Independent read #2: readSettings() itself agrees with the raw file.
    const readBack = await settings.readSettings();
    expect(readBack).toEqual(written);
    expect(settings.settingsFileExisted()).toBe(true);
  });

  it('forces the schema version on write regardless of what the caller passed', async () => {
    const settings = await freshSettingsModule();
    const written = await settings.writeSettings(makeRecord({ schemaVersion: 999 }));

    expect(written.schemaVersion).toBe(settings.SETTINGS_SCHEMA_VERSION);
    const onDisk = JSON.parse(readFileSync(settingsFilePathFor(state.appDataRoot), 'utf8')) as SettingsRecord;
    expect(onDisk.schemaVersion).toBe(settings.SETTINGS_SCHEMA_VERSION);
  });

  it('deleting the file after a write is honestly reported as a fresh first run, not as corruption', async () => {
    const settings = await freshSettingsModule();
    const path = settingsFilePathFor(state.appDataRoot);
    await settings.writeSettings(makeRecord());
    expect(existsSync(path)).toBe(true);

    rmSync(path);

    const record = await settings.readSettings();
    expect(record.values).toEqual({});
    expect(settings.settingsFileExisted()).toBe(false);
    // No corruption backup should appear for an honest ENOENT.
    const dir = join(state.appDataRoot, 'world-downloader-studio');
    expect(readdirSync(dir).some((f) => f.startsWith('settings.corrupt-'))).toBe(false);
  });
});

/* ==================================================================== */
/* Corruption recovery: truncated file                                   */
/* ==================================================================== */

describe('readSettings(): a truncated file recovers to defaults WITHOUT destroying the unreadable original', () => {
  it('renames the truncated file aside (preserving its exact bytes) and returns defaults with recoveredFromCorruption set', async () => {
    const settings = await freshSettingsModule();
    const path = settingsFilePathFor(state.appDataRoot);
    const dir = join(state.appDataRoot, 'world-downloader-studio');
    mkdirSync(dir, { recursive: true });
    const truncated = '{"values": {"theme": "dark", "windowWi'; // cut off mid-write
    writeFileSync(path, truncated, 'utf8');

    const record = await settings.readSettings();

    expect(record.values).toEqual({});
    expect(record.provenance).toEqual({});
    expect((record as SettingsRecord & { recoveredFromCorruption?: boolean }).recoveredFromCorruption).toBe(true);
    expect(settings.settingsFileExisted()).toBe(false);

    // The original path no longer holds the corrupt bytes...
    expect(existsSync(path)).toBe(false);

    // ...but they were NOT destroyed: a real backup file with the exact
    // original bytes was written, verified through an independent read.
    const corruptFiles = readdirSync(dir).filter((f) => f.startsWith('settings.corrupt-') && f.endsWith('.json'));
    expect(corruptFiles.length).toBe(1);
    const backupContent = readFileSync(join(dir, corruptFiles[0]), 'utf8');
    expect(backupContent).toBe(truncated);
  });
});

describe('readSettings(): a syntactically invalid (non-JSON) file recovers the same honest way', () => {
  it('recovers to defaults and preserves the unreadable original under a corrupt-* backup', async () => {
    const settings = await freshSettingsModule();
    const path = settingsFilePathFor(state.appDataRoot);
    const dir = join(state.appDataRoot, 'world-downloader-studio');
    mkdirSync(dir, { recursive: true });
    const garbage = 'definitely not json {{{ %%% <<<';
    writeFileSync(path, garbage, 'utf8');

    const record = await settings.readSettings();

    expect(record.values).toEqual({});
    expect((record as SettingsRecord & { recoveredFromCorruption?: boolean }).recoveredFromCorruption).toBe(true);
    expect(existsSync(path)).toBe(false);

    const corruptFiles = readdirSync(dir).filter((f) => f.startsWith('settings.corrupt-'));
    expect(corruptFiles.length).toBe(1);
    expect(readFileSync(join(dir, corruptFiles[0]), 'utf8')).toBe(garbage);
  });

  it('recovering does not stop the app from being usable afterward: a fresh write and read both succeed normally', async () => {
    const settings = await freshSettingsModule();
    const path = settingsFilePathFor(state.appDataRoot);
    const dir = join(state.appDataRoot, 'world-downloader-studio');
    mkdirSync(dir, { recursive: true });
    writeFileSync(path, 'not json', 'utf8');
    await settings.readSettings(); // triggers recovery

    const written = await settings.writeSettings(makeRecord({ values: { afterRecovery: true }, provenance: {} }));
    expect(written.values).toEqual({ afterRecovery: true });

    const readBack = await settings.readSettings();
    expect(readBack.values).toEqual({ afterRecovery: true });
    expect(settings.settingsFileExisted()).toBe(true);
  });
});

/* ==================================================================== */
/* Unknown keys                                                          */
/* ==================================================================== */

describe('readSettings(): unknown keys are handled exactly as the code promises', () => {
  it('passes unrecognized "values" keys through untouched but drops unrecognized provenance values, verified against the real parsed record', async () => {
    const settings = await freshSettingsModule();
    const path = settingsFilePathFor(state.appDataRoot);
    const dir = join(state.appDataRoot, 'world-downloader-studio');
    mkdirSync(dir, { recursive: true });
    const raw = JSON.stringify({
      values: { theme: 'dark', someFutureSetting: { nested: true } },
      provenance: { theme: 'user', someFutureSetting: 'not-a-real-provenance-value' },
      schemaVersion: 1,
      updatedAt: '2020-01-01T00:00:00.000Z',
      unexpectedTopLevelKey: 'the module has never heard of this'
    });
    writeFileSync(path, raw, 'utf8');

    const record = await settings.readSettings();

    // Unknown keys inside `values` pass through verbatim: this object is not
    // schema-validated field by field.
    expect(record.values).toEqual({ theme: 'dark', someFutureSetting: { nested: true } });

    // Provenance IS validated: only the recognized enum values survive.
    expect(record.provenance).toEqual({ theme: 'user' });
    expect('someFutureSetting' in record.provenance).toBe(false);

    expect(record.updatedAt).toBe('2020-01-01T00:00:00.000Z');
    expect(settings.settingsFileExisted()).toBe(true);
  });

  it('sanitizes provenance on the WRITE path too, verified by an independent read of the persisted file', async () => {
    const settings = await freshSettingsModule();
    const path = settingsFilePathFor(state.appDataRoot);

    await settings.writeSettings(
      makeRecord({
        provenance: {
          theme: 'user',
          // @ts-expect-error -- deliberately invalid provenance value, to prove sanitizeProvenance() strips it on write
          windowWidth: 'not-a-real-provenance-value'
        }
      })
    );

    const onDisk = JSON.parse(readFileSync(path, 'utf8')) as SettingsRecord;
    expect(onDisk.provenance).toEqual({ theme: 'user' });
    expect('windowWidth' in onDisk.provenance).toBe(false);
  });
});

/* ==================================================================== */
/* Atomic write: a real interrupted write must not destroy the previous  */
/* value -- proven with a genuine filesystem failure, no fs mocking      */
/* ==================================================================== */

describe('writeSettings(): the atomic write really protects the previous value on a genuine failure', () => {
  it('when the rename-target write step genuinely fails, the durable on-disk settings file is completely unharmed', async () => {
    const settings = await freshSettingsModule();
    await settings.writeSettings(makeRecord({ values: { marker: 'must-survive' } }));
    const path = settingsFilePathFor(state.appDataRoot);
    const before = readFileSync(path, 'utf8');

    // Force a REAL fs.writeFile failure at the exact temp-file step
    // writeSettings() uses for its atomic write, without mocking fs: it
    // writes to `${path}.tmp-${process.pid}` before renaming it over the
    // real file. Pre-creating a directory at that exact path makes the
    // write genuinely fail.
    const collisionDir = `${path}.tmp-${process.pid}`;
    mkdirSync(collisionDir, { recursive: true });
    try {
      await expect(settings.writeSettings(makeRecord({ values: { marker: 'should-never-land' } }))).rejects.toThrow();
    } finally {
      rmSync(collisionDir, { recursive: true, force: true });
    }

    // The durable file on disk was never touched by the failed write: no
    // half-written bytes, no truncation, no silently-adopted new value.
    expect(readFileSync(path, 'utf8')).toBe(before);

    const reloaded = await freshSettingsModuleSameDisk();
    const readBack = await reloaded.readSettings();
    expect(readBack.values).toEqual({ marker: 'must-survive' });
  });
});

/** Reloads the module fresh while pointing at the SAME app-data directory --
 * standing in for the next real app launch against the same disk.
 */
async function freshSettingsModuleSameDisk(): Promise<SettingsModule> {
  vi.resetModules();
  return import('../../src/main/services/settings');
}
