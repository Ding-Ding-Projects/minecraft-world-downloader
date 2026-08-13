import type {
  Result,
  StudioApi,
  WorldVaultCommit,
  WorldVaultCommitQuery,
  WorldVaultEvent,
  WorldVaultPermission,
  WorldVaultStatus
} from '../../../shared/api';

/**
 * The typed contract this feature publishes to its two sibling lanes
 * (`world-vault-renders` and `world-vault-edit`).
 *
 * Most of the actual capability already lives on the privileged bridge
 * itself — `ctx.studio.worldVault.*` and the `worldvault:event` push
 * channel — because that is where the git-backed implementation runs. What
 * this module adds on top is the piece that lives in THIS feature's own UI
 * state and cannot come from the bridge: which world is currently the one
 * selected in the vault tab, so a sibling surface that has no world of its
 * own opinion can default to the same one the user is already looking at.
 *
 * A sibling feature imports this file directly:
 *
 *     import { activeWorldPath, subscribeActiveWorldPath, requestRegionAccess }
 *       from '../world-vault/contract';
 *
 * It never edits this file, and this file never imports anything from a
 * sibling feature's own directory.
 */

let activeWorldPathValue: string | null = null;
const activeWorldPathListeners = new Set<(worldPath: string | null) => void>();

/** The world folder currently selected in the vault tab, or null if none. */
export function activeWorldPath(): string | null {
  return activeWorldPathValue;
}

/** Called by this feature's own panel whenever the selection changes. */
export function setActiveWorldPath(worldPath: string | null): void {
  const normalized = worldPath && worldPath.trim() !== '' ? worldPath : null;
  if (normalized === activeWorldPathValue) return;
  activeWorldPathValue = normalized;
  for (const listener of activeWorldPathListeners) listener(normalized);
}

export function subscribeActiveWorldPath(listener: (worldPath: string | null) => void): () => void {
  activeWorldPathListeners.add(listener);
  return () => activeWorldPathListeners.delete(listener);
}

/** Current vault status for one world. Never throws; reads the Result envelope. */
export async function vaultStatus(studio: StudioApi, worldPath: string): Promise<Result<WorldVaultStatus>> {
  return studio.worldVault.status(worldPath);
}

/**
 * Hazard 6: ask permission before a sibling feature reads or writes one
 * region file. Refused, plainly, while the downloader (or anything else)
 * may still be writing to it. Never queued — the caller decides whether and
 * when to retry.
 */
export async function requestRegionAccess(
  studio: StudioApi,
  worldPath: string,
  relativeRegionPath: string
): Promise<Result<WorldVaultPermission>> {
  return studio.worldVault.requestRegionAccess(worldPath, relativeRegionPath);
}

/**
 * Records a sibling feature's own edit (a chunk copy or removal) as a real
 * commit, so the vault's unlimited undo covers it exactly as it covers a
 * downloaded snapshot. Only call this once the edit has actually finished
 * writing to disk. Returns `null` when there was nothing to commit.
 */
export async function commitEdit(
  studio: StudioApi,
  worldPath: string,
  message: string
): Promise<Result<WorldVaultCommit | null>> {
  return studio.worldVault.commitNow(worldPath, message, 'edit');
}

/** The commit timeline for one world, newest first. */
export async function listCommits(studio: StudioApi, query: WorldVaultCommitQuery): Promise<Result<WorldVaultCommit[]>> {
  return studio.worldVault.commits(query);
}

/**
 * Subscribes to new commits and status changes for one specific world.
 * Filters the shared `worldvault:event` push channel down to the world a
 * sibling feature actually cares about, so it never has to filter that
 * itself.
 */
export function subscribeVaultEvents(
  studio: StudioApi,
  worldPath: string,
  listener: (event: WorldVaultEvent) => void
): () => void {
  return studio.events.on('worldvault:event', (event) => {
    if (event.worldPath === worldPath) listener(event);
  });
}

/* ==================================================================== */
/* Compatibility surface: a synchronous vault/commit cache               */
/* ==================================================================== */

/**
 * `world-vault-renders` (see its `vaultLink.ts`) was written in parallel
 * against an assumed *synchronous* shape — `listVaults(): Vault[]`,
 * `listVaultCommits(vaultId): VaultCommit[]` — because it does not know, and
 * should not have to know, that the real implementation is git running in
 * the main process behind an IPC round trip. That gap is bridged here,
 * once, rather than in the sibling: a small reactive cache is kept
 * synchronously readable, and kept warm by the real async bridge
 * (`window.studio.worldVault.*` and the `worldvault:event` push channel)
 * underneath it. `vaultLink.ts`'s own docstring names this file as the one
 * that may need to change if the real shape differs — this is that change,
 * made from this side so the sibling's file needs none.
 */

export interface Vault {
  id: string;
  worldName: string;
  worldPath: string;
}

export interface VaultCommit {
  id: string;
  vaultId: string;
  worldName: string;
  worldPath: string;
  message: string;
  createdAt: string;
  filesChanged: number;
  parentId: string | null;
}

const knownVaults = new Map<string, Vault>();
const vaultListeners = new Set<(vaults: Vault[]) => void>();
/** worldPath -> commits, newest first. Absent means never primed. */
const commitCache = new Map<string, VaultCommit[]>();
const commitListeners = new Set<(commit: VaultCommit, all: VaultCommit[]) => void>();

function worldNameOf(worldPath: string): string {
  const parts = worldPath.split(/[\\/]+/).filter(Boolean);
  return parts[parts.length - 1] || worldPath;
}

function toVaultCommit(worldPath: string, commit: WorldVaultCommit, parentId: string | null): VaultCommit {
  return {
    id: commit.hash,
    vaultId: worldPath,
    worldName: worldNameOf(worldPath),
    worldPath,
    message: commit.subject,
    createdAt: commit.timestampIso,
    filesChanged: commit.filesChanged,
    parentId
  };
}

function notifyVaults(): void {
  const list = [...knownVaults.values()];
  for (const listener of vaultListeners) listener(list);
}

/**
 * Marks a world as having (or no longer having) a real vault. Called by this
 * feature's own panel/state whenever a status read confirms one exists, and
 * by the module-level event listener below whenever a push event reports it.
 */
export function registerKnownVault(worldPath: string, exists: boolean): void {
  if (!worldPath) return;
  if (!exists) {
    if (knownVaults.delete(worldPath)) notifyVaults();
    return;
  }
  const alreadyKnown = knownVaults.has(worldPath);
  knownVaults.set(worldPath, { id: worldPath, worldName: worldNameOf(worldPath), worldPath });
  if (!alreadyKnown) {
    notifyVaults();
    void primeVaultCommits(worldPath);
  }
}

/** The vaults this session currently knows about — one per tracked world. */
export function listVaults(): Vault[] {
  return [...knownVaults.values()];
}

export function subscribeVaults(listener: (vaults: Vault[]) => void): () => void {
  vaultListeners.add(listener);
  return () => vaultListeners.delete(listener);
}

/** Cached commits for one vault, newest first. Empty until primed. */
export function listVaultCommits(vaultId: string): VaultCommit[] {
  return commitCache.get(vaultId) ?? [];
}

/** Fires once per new (or newly-loaded) commit, with the vault's full list so far. */
export function subscribeVaultCommits(listener: (commit: VaultCommit, all: VaultCommit[]) => void): () => void {
  commitListeners.add(listener);
  return () => commitListeners.delete(listener);
}

async function primeVaultCommits(worldPath: string): Promise<void> {
  if (commitCache.has(worldPath)) return; // already primed, or priming is in flight
  commitCache.set(worldPath, []);
  if (typeof window === 'undefined' || !window.studio) return;
  const result = await window.studio.worldVault.commits({ worldPath, limit: 500 });
  if (!result.ok) return;
  const oldestFirst = [...result.value].reverse();
  let parentId: string | null = null;
  const converted: VaultCommit[] = [];
  for (const raw of oldestFirst) {
    const commit = toVaultCommit(worldPath, raw, parentId);
    converted.push(commit);
    parentId = commit.id;
  }
  commitCache.set(worldPath, [...converted].reverse());
  for (const commit of converted) {
    const snapshot = commitCache.get(worldPath) ?? [];
    for (const listener of commitListeners) listener(commit, snapshot);
  }
}

/**
 * Checks a commit's tree out to `destinationDirectory` without touching the
 * live world at all (real `git worktree add --detach` in the main process).
 */
export async function exportVaultCommit(
  commit: VaultCommit,
  destinationDirectory: string
): Promise<Result<{ path: string }>> {
  if (typeof window === 'undefined' || !window.studio) {
    return { ok: false, error: 'The privileged bridge is not available in this environment.' };
  }
  return window.studio.worldVault.exportCommitTree(commit.worldPath, commit.id, destinationDirectory);
}

// Kept warm independently of any mounted tab: a render or edit feature must
// see new commits even while the vault tab itself is closed.
if (typeof window !== 'undefined' && window.studio) {
  window.studio.events.on('worldvault:event', (event) => {
    if (event.kind === 'status') {
      registerKnownVault(event.worldPath, event.status.exists);
      return;
    }
    if (event.kind === 'commit') {
      registerKnownVault(event.worldPath, true);
      const existing = commitCache.get(event.worldPath) ?? [];
      const parentId = existing[0]?.id ?? null;
      const converted = toVaultCommit(event.worldPath, event.commit, parentId);
      const next = [converted, ...existing];
      commitCache.set(event.worldPath, next);
      for (const listener of commitListeners) listener(converted, next);
    }
  });
}
