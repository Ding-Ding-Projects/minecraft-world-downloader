/** Setting ids, persistence keys and on-disk layout for this feature. */

import type { StudioApi } from '../../../shared/api';
import type { SettingsStore } from '../../core/registry';
import type { RenderRecord } from './types';

export const SETTINGS = {
  enabled: 'worldvaultrenders.enabled',
  concurrency: 'worldvaultrenders.concurrency',
  rendererPath: 'worldvaultrenders.rendererPath',
  acceptDownload: 'worldvaultrenders.acceptDownload',
  threads: 'worldvaultrenders.threads',
  backlogWarningThreshold: 'worldvaultrenders.backlogWarningThreshold'
} as const;

/** Persisted queue snapshot, capped so the settings document never grows without bound. */
const RECORDS_KEY = 'worldvaultrenders.records';
export const MAX_PERSISTED_RECORDS = 200;

export function loadPersistedRecords(settings: SettingsStore): RenderRecord[] {
  const raw = settings.get<unknown>(RECORDS_KEY, []);
  if (!Array.isArray(raw)) return [];
  return raw.filter((entry): entry is RenderRecord => typeof entry === 'object' && entry !== null && typeof (entry as RenderRecord).commitId === 'string');
}

export function savePersistedRecords(settings: SettingsStore, records: RenderRecord[]): void {
  const capped = records.slice(-MAX_PERSISTED_RECORDS);
  settings.set(RECORDS_KEY, capped);
}

function joinPath(base: string, ...segments: string[]): string {
  const sep = base.includes('\\') && !base.startsWith('/') ? '\\' : '/';
  let out = base.replace(/[\\/]+$/, '');
  for (const segment of segments) {
    const clean = segment.replace(/^[\\/]+/, '').replace(/[\\/]+$/, '');
    if (clean !== '') out += sep + clean;
  }
  return out;
}

export interface FeatureDirectories {
  exportRoot: string;
  outputRoot: string;
}

export function featureDirectories(studio: StudioApi): FeatureDirectories {
  const root = joinPath(studio.info.userDataDir, 'world-vault-renders');
  return { exportRoot: joinPath(root, 'exports'), outputRoot: joinPath(root, 'renders') };
}

/**
 * `VaultCommit.vaultId` is the vault's own absolute world path (see the
 * "ASSUMED CONTRACT" note in `vaultLink.ts` — there is no separate short vault
 * id, one world path is one vault). Every export/output directory this
 * feature writes is built by joining that value in as a path *segment*
 * underneath `exportRoot`/`outputRoot`. On Windows that is not a nested
 * directory, it is an illegal one: an absolute path carries its own
 * drive-letter colon (`C:\Users\...`), and a colon is not valid anywhere in a
 * Windows path component except right after the drive letter. `fs.mkdir` and
 * `git worktree add` both refuse it, so every export — and therefore every
 * render and every comparison — failed before this existed.
 *
 * This turns the raw id into one safe, stable, single segment instead:
 * strip the characters a path segment cannot carry, then append a short hash
 * of the original so two ids that sanitize to the same visible text (rare,
 * but two world paths differing only in punctuation could) still land in
 * different directories.
 */
export function vaultDirName(vaultId: string): string {
  const sanitized = vaultId
    .replace(/[:<>"|?*]/g, '')
    .replace(/[\\/]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  let hash = 0;
  for (let i = 0; i < vaultId.length; i += 1) {
    hash = (Math.imul(31, hash) + vaultId.charCodeAt(i)) | 0;
  }
  const hashHex = (hash >>> 0).toString(16).padStart(8, '0');
  // Keep the readable tail rather than the head: on Windows the head is
  // almost always the same "C_Users_name_..." prefix across every world, so
  // the tail is what actually distinguishes one vault from another.
  const truncated = sanitized.length > 60 ? sanitized.slice(-60) : sanitized;
  return `${truncated || 'vault'}-${hashHex}`;
}
