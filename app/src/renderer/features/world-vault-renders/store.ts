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
