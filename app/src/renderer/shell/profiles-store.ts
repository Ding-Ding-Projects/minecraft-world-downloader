import type { AppContext } from '../core/types';
import { OPTION_IDS, asNumber, asString, defaultValues, optionById, type ProfileValues } from '../features/downloader/options';
import {
  LAST_PROFILE_SETTING_ID,
  changedOptionIds,
  createProfile,
  duplicateProfile as duplicateBaseProfile,
  readProfiles,
  writeProfiles,
  type DownloadProfile
} from '../features/downloader/profiles';
import { CURRENT_VALUES_SETTING_ID } from '../features/downloader/state';

/**
 * Profile state other screens need: the title bar's brand text, the header's
 * profile-switcher chip and the destinations drawer all read the *active*
 * profile through `LAST_PROFILE_SETTING_ID` — the same setting id the
 * pre-existing `features/downloader/profiles.ts`/`state.ts` already use for
 * "the last-loaded profile" (`currentProfileSummary` in `shell/index.ts`
 * reads exactly that setting). This module does not fork a second notion of
 * "the active profile": it reuses that identity so the whole shell agrees
 * about which profile is current, and layers the design's richer "several
 * servers, several folders" roster on top of it.
 *
 * A `DownloadProfile` (from `features/downloader/profiles.ts`) already
 * carries one server (`values[serverHost]`/`values[serverPort]`) and one
 * output folder (`values[outputDir]`) — the pair the real `world-downloader`
 * jar actually launches with, because the jar itself only ever connects to
 * one server and writes to one folder. This screen's "several servers /
 * several folders, one marked in use / default" is a roster of saved
 * candidates layered on top of that single pair: the entry at index 0 in
 * `servers`/`folders` below always mirrors the profile's real
 * `serverHost:serverPort`/`outputDir`, and every entry after it is an extra,
 * switchable candidate kept here, in this store, keyed by profile id.
 *
 * Ping/latency results are deliberately NOT persisted here — they are a
 * live, in-session reading (see `profiles.ts`'s own `testServerReachable`),
 * not durable profile state, so keeping them out of `ctx.settings` avoids
 * ever showing a stale, misleading number after a restart.
 */

export const EXTRA_SERVERS_SETTING_ID = 'shell.profiles.extraServers';
export const EXTRA_FOLDERS_SETTING_ID = 'shell.profiles.extraFolders';

export interface ServerEntry {
  host: string;
  note: string;
}

export interface FolderEntry {
  path: string;
  note: string;
}

export interface RichProfile {
  id: string;
  name: string;
  /** A single uppercase letter for the avatar. Never fabricated. */
  initial: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  /** Index 0 mirrors `base.values[serverHost]`/`[serverPort]` and is always "in use". */
  servers: ServerEntry[];
  /** Index 0 mirrors `base.values[outputDir]` and is always the default. */
  folders: FolderEntry[];
  /** The real jar flags this profile changes, excluding connection/output (their own sections cover those). */
  flags: string[];
  base: DownloadProfile;
}

type ExtraServersMap = Record<string, ServerEntry[]>;
type ExtraFoldersMap = Record<string, FolderEntry[]>;

/* ------------------------------------------------------------------ */
/* Raw storage                                                         */
/* ------------------------------------------------------------------ */

function readExtraServers(ctx: AppContext): ExtraServersMap {
  const raw = ctx.settings.get<unknown>(EXTRA_SERVERS_SETTING_ID, {});
  if (!raw || typeof raw !== 'object') return {};
  const out: ExtraServersMap = {};
  for (const [id, list] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(list)) continue;
    out[id] = list
      .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
      .map((item) => ({
        host: typeof item.host === 'string' ? item.host : '',
        note: typeof item.note === 'string' ? item.note : ''
      }))
      .filter((item) => item.host.trim() !== '');
  }
  return out;
}

function writeExtraServers(ctx: AppContext, map: ExtraServersMap): void {
  ctx.settings.set(EXTRA_SERVERS_SETTING_ID, map);
}

function readExtraFolders(ctx: AppContext): ExtraFoldersMap {
  const raw = ctx.settings.get<unknown>(EXTRA_FOLDERS_SETTING_ID, {});
  if (!raw || typeof raw !== 'object') return {};
  const out: ExtraFoldersMap = {};
  for (const [id, list] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(list)) continue;
    out[id] = list
      .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
      .map((item) => ({
        path: typeof item.path === 'string' ? item.path : '',
        note: typeof item.note === 'string' ? item.note : ''
      }))
      .filter((item) => item.path.trim() !== '');
  }
  return out;
}

function writeExtraFolders(ctx: AppContext, map: ExtraFoldersMap): void {
  ctx.settings.set(EXTRA_FOLDERS_SETTING_ID, map);
}

/** Splits "host" or "host:port" the same way the jar's own `--server` flag reads it. */
export function parseHostPort(raw: string): { host: string; port: number } {
  const trimmed = raw.trim();
  const lastColon = trimmed.lastIndexOf(':');
  if (lastColon > 0 && lastColon < trimmed.length - 1) {
    const maybePort = Number(trimmed.slice(lastColon + 1));
    if (Number.isInteger(maybePort) && maybePort > 0 && maybePort <= 65535) {
      return { host: trimmed.slice(0, lastColon), port: maybePort };
    }
  }
  return { host: trimmed, port: 25565 };
}

function formatHostPort(host: string, port: number): string {
  if (host === '') return '';
  return port === 25565 ? host : `${host}:${port}`;
}

/* ------------------------------------------------------------------ */
/* Rich profile assembly                                               */
/* ------------------------------------------------------------------ */

const CONNECTION_OUTPUT_IDS: readonly string[] = [OPTION_IDS.serverHost, OPTION_IDS.serverPort, OPTION_IDS.outputDir];

function computeFlags(values: ProfileValues): string[] {
  const flags = new Set<string>();
  for (const id of changedOptionIds(values)) {
    if (CONNECTION_OUTPUT_IDS.includes(id)) continue;
    const definition = optionById(id);
    if (definition) flags.add(definition.flag);
  }
  return [...flags];
}

function toRichProfile(base: DownloadProfile, extraServers: ExtraServersMap, extraFolders: ExtraFoldersMap): RichProfile {
  const primaryHost = asString(base.values[OPTION_IDS.serverHost]).trim();
  const primaryPort = asNumber(base.values[OPTION_IDS.serverPort], 25565);
  const servers: ServerEntry[] = [];
  if (primaryHost !== '') servers.push({ host: formatHostPort(primaryHost, primaryPort), note: '' });
  servers.push(...(extraServers[base.id] ?? []));

  const primaryFolder = asString(base.values[OPTION_IDS.outputDir]).trim();
  const folders: FolderEntry[] = [];
  if (primaryFolder !== '') folders.push({ path: primaryFolder, note: '' });
  folders.push(...(extraFolders[base.id] ?? []));

  return {
    id: base.id,
    name: base.name,
    initial: base.name.trim().charAt(0).toUpperCase() || '?',
    notes: base.notes,
    createdAt: base.createdAt,
    updatedAt: base.updatedAt,
    servers,
    folders,
    flags: computeFlags(base.values),
    base
  };
}

export function listRichProfiles(ctx: AppContext): RichProfile[] {
  const extraServers = readExtraServers(ctx);
  const extraFolders = readExtraFolders(ctx);
  return readProfiles(ctx).map((profile) => toRichProfile(profile, extraServers, extraFolders));
}

export function getRichProfile(ctx: AppContext, id: string): RichProfile | null {
  return listRichProfiles(ctx).find((profile) => profile.id === id) ?? null;
}

/* ------------------------------------------------------------------ */
/* Active profile                                                      */
/* ------------------------------------------------------------------ */

export function activeProfileId(ctx: AppContext): string {
  const stored = ctx.settings.get<string>(LAST_PROFILE_SETTING_ID, '');
  const profiles = readProfiles(ctx);
  if (profiles.some((profile) => profile.id === stored)) return stored;
  return profiles[0]?.id ?? '';
}

export function setActiveProfileId(ctx: AppContext, id: string): void {
  ctx.settings.set(LAST_PROFILE_SETTING_ID, id);
}

/* ------------------------------------------------------------------ */
/* Mutations                                                           */
/* ------------------------------------------------------------------ */

export function createRichProfile(ctx: AppContext, name: string, serverRaw: string, folderRaw: string): RichProfile {
  const values = defaultValues();
  const { host, port } = parseHostPort(serverRaw);
  values[OPTION_IDS.serverHost] = host;
  values[OPTION_IDS.serverPort] = port;
  const folder = folderRaw.trim();
  if (folder !== '') values[OPTION_IDS.outputDir] = folder;

  const profile = createProfile(name, '', values);
  writeProfiles(ctx, [profile, ...readProfiles(ctx)]);
  setActiveProfileId(ctx, profile.id);
  return getRichProfile(ctx, profile.id) as RichProfile;
}

export function renameRichProfile(ctx: AppContext, id: string, name: string): void {
  const trimmed = name.trim();
  if (trimmed === '') return;
  const profiles = readProfiles(ctx).map((profile) =>
    profile.id === id ? { ...profile, name: trimmed, updatedAt: new Date().toISOString() } : profile
  );
  writeProfiles(ctx, profiles);
}

export function duplicateRichProfile(ctx: AppContext, id: string): RichProfile | null {
  const profiles = readProfiles(ctx);
  const base = profiles.find((profile) => profile.id === id);
  if (!base) return null;
  const copy = duplicateBaseProfile(base, `${base.name} (copy)`);
  const index = profiles.findIndex((profile) => profile.id === id);
  const next = [...profiles];
  next.splice(index + 1, 0, copy);
  writeProfiles(ctx, next);

  const extraServers = readExtraServers(ctx);
  if (extraServers[id]) {
    writeExtraServers(ctx, { ...extraServers, [copy.id]: extraServers[id].map((entry) => ({ ...entry })) });
  }
  const extraFolders = readExtraFolders(ctx);
  if (extraFolders[id]) {
    writeExtraFolders(ctx, { ...extraFolders, [copy.id]: extraFolders[id].map((entry) => ({ ...entry })) });
  }

  setActiveProfileId(ctx, copy.id);
  return getRichProfile(ctx, copy.id);
}

export function deleteRichProfile(ctx: AppContext, id: string): void {
  const remaining = readProfiles(ctx).filter((profile) => profile.id !== id);
  writeProfiles(ctx, remaining);

  const extraServers = readExtraServers(ctx);
  if (id in extraServers) {
    const next = { ...extraServers };
    delete next[id];
    writeExtraServers(ctx, next);
  }
  const extraFolders = readExtraFolders(ctx);
  if (id in extraFolders) {
    const next = { ...extraFolders };
    delete next[id];
    writeExtraFolders(ctx, next);
  }

  if (activeProfileId(ctx) === id || ctx.settings.get<string>(LAST_PROFILE_SETTING_ID, '') === id) {
    setActiveProfileId(ctx, remaining[0]?.id ?? '');
  }
}

/** Loads a profile's saved values into the settings the downloader feature reads on start/mount. */
export function applyProfileValues(ctx: AppContext, id: string): void {
  const profile = readProfiles(ctx).find((candidate) => candidate.id === id);
  if (!profile) return;
  setActiveProfileId(ctx, id);
  ctx.settings.set(CURRENT_VALUES_SETTING_ID, profile.values);
}

/* ---------------- servers ---------------- */

export function addServer(ctx: AppContext, id: string, host: string, note: string): void {
  const trimmed = host.trim();
  if (trimmed === '') return;
  const map = readExtraServers(ctx);
  const list = map[id] ?? [];
  writeExtraServers(ctx, { ...map, [id]: [...list, { host: trimmed, note: note.trim() }] });
}

/** `index` is the position in the combined `servers` array (0 = in use). */
export function useServerAt(ctx: AppContext, id: string, index: number): void {
  if (index <= 0) return;
  const rich = getRichProfile(ctx, id);
  if (!rich || index >= rich.servers.length) return;

  const profiles = readProfiles(ctx);
  const base = profiles.find((profile) => profile.id === id);
  if (!base) return;

  const promoted = rich.servers[index];
  const previousPrimaryHost = asString(base.values[OPTION_IDS.serverHost]).trim();
  const previousPrimaryPort = asNumber(base.values[OPTION_IDS.serverPort], 25565);

  const { host, port } = parseHostPort(promoted.host);
  const nextProfiles = profiles.map((profile) =>
    profile.id === id
      ? {
          ...profile,
          values: { ...profile.values, [OPTION_IDS.serverHost]: host, [OPTION_IDS.serverPort]: port },
          updatedAt: new Date().toISOString()
        }
      : profile
  );
  writeProfiles(ctx, nextProfiles);

  const map = readExtraServers(ctx);
  const list = (map[id] ?? []).filter((_, i) => i !== index - 1);
  if (previousPrimaryHost !== '') {
    list.unshift({ host: formatHostPort(previousPrimaryHost, previousPrimaryPort), note: '' });
  }
  writeExtraServers(ctx, { ...map, [id]: list });
}

export function removeServerAt(ctx: AppContext, id: string, index: number): void {
  const rich = getRichProfile(ctx, id);
  if (!rich || index < 0 || index >= rich.servers.length) return;

  if (index === 0) {
    const map = readExtraServers(ctx);
    const list = map[id] ?? [];
    const promoted = list[0];
    const profiles = readProfiles(ctx);
    const nextProfiles = profiles.map((profile) => {
      if (profile.id !== id) return profile;
      const host = promoted ? parseHostPort(promoted.host).host : '';
      const port = promoted ? parseHostPort(promoted.host).port : 25565;
      return {
        ...profile,
        values: { ...profile.values, [OPTION_IDS.serverHost]: host, [OPTION_IDS.serverPort]: port },
        updatedAt: new Date().toISOString()
      };
    });
    writeProfiles(ctx, nextProfiles);
    writeExtraServers(ctx, { ...map, [id]: list.slice(1) });
    return;
  }

  const map = readExtraServers(ctx);
  const list = (map[id] ?? []).filter((_, i) => i !== index - 1);
  writeExtraServers(ctx, { ...map, [id]: list });
}

/* ---------------- folders ---------------- */

export function addFolder(ctx: AppContext, id: string, path: string, note: string): void {
  const trimmed = path.trim();
  if (trimmed === '') return;
  const map = readExtraFolders(ctx);
  const list = map[id] ?? [];
  writeExtraFolders(ctx, { ...map, [id]: [...list, { path: trimmed, note: note.trim() }] });
}

export function makeDefaultFolderAt(ctx: AppContext, id: string, index: number): void {
  if (index <= 0) return;
  const rich = getRichProfile(ctx, id);
  if (!rich || index >= rich.folders.length) return;

  const profiles = readProfiles(ctx);
  const base = profiles.find((profile) => profile.id === id);
  if (!base) return;

  const promoted = rich.folders[index];
  const previousDefault = asString(base.values[OPTION_IDS.outputDir]).trim();

  const nextProfiles = profiles.map((profile) =>
    profile.id === id
      ? { ...profile, values: { ...profile.values, [OPTION_IDS.outputDir]: promoted.path }, updatedAt: new Date().toISOString() }
      : profile
  );
  writeProfiles(ctx, nextProfiles);

  const map = readExtraFolders(ctx);
  const list = (map[id] ?? []).filter((_, i) => i !== index - 1);
  if (previousDefault !== '') list.unshift({ path: previousDefault, note: '' });
  writeExtraFolders(ctx, { ...map, [id]: list });
}

export function removeFolderAt(ctx: AppContext, id: string, index: number): void {
  const rich = getRichProfile(ctx, id);
  if (!rich || index < 0 || index >= rich.folders.length) return;

  if (index === 0) {
    const map = readExtraFolders(ctx);
    const list = map[id] ?? [];
    const promoted = list[0];
    const profiles = readProfiles(ctx);
    const fallback = defaultValues()[OPTION_IDS.outputDir];
    const nextProfiles = profiles.map((profile) =>
      profile.id === id
        ? {
            ...profile,
            values: { ...profile.values, [OPTION_IDS.outputDir]: promoted ? promoted.path : fallback },
            updatedAt: new Date().toISOString()
          }
        : profile
    );
    writeProfiles(ctx, nextProfiles);
    writeExtraFolders(ctx, { ...map, [id]: list.slice(1) });
    return;
  }

  const map = readExtraFolders(ctx);
  const list = (map[id] ?? []).filter((_, i) => i !== index - 1);
  writeExtraFolders(ctx, { ...map, [id]: list });
}
