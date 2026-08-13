/**
 * The one, narrow doorway into `../world-vault`.
 *
 * This feature renders a world at a commit; it does not track worlds, decide
 * when to commit, or know a byte about Git. Per the integration contract for
 * this feature cluster — "Do not create a second repository abstraction" —
 * every one of those questions is answered by `../world-vault`, and this file
 * is the *only* place that import happens. If the vault module's real export
 * names differ from the ones assumed here, this is the one file that needs to
 * change; nothing else in this directory reaches across the boundary directly.
 *
 * ASSUMED CONTRACT (documented here because `../world-vault` is a sibling lane
 * built in parallel with this one — see this feature's final report for the
 * exact state this was written against):
 *
 *   interface VaultCommit {
 *     id: string;             // the commit hash
 *     vaultId: string;        // stable id of the vault (one per tracked world)
 *     worldName: string;      // display name of the world
 *     worldPath: string;      // absolute path of the LIVE, actively-written world
 *     message: string;
 *     createdAt: string;      // ISO-8601
 *     filesChanged: number;
 *     parentId: string | null;
 *   }
 *   interface Vault {
 *     id: string;
 *     worldName: string;
 *     worldPath: string;
 *   }
 *   function listVaults(): Vault[];
 *   function subscribeVaults(listener: (vaults: Vault[]) => void): () => void;
 *   function listVaultCommits(vaultId: string): VaultCommit[];
 *   function subscribeVaultCommits(listener: (commit: VaultCommit, all: VaultCommit[]) => void): () => void;
 *   function exportVaultCommit(commit: VaultCommit, destinationDirectory: string): Promise<{ ok: true; value: { path: string } } | { ok: false; error: string }>;
 *   function isRegionActivelyWritten(worldPath: string, regionRelativePath: string): boolean;
 *
 * `exportVaultCommit` is the operation this feature leans on hardest: it
 * checks the chosen commit's tree out to a directory without touching the
 * live, possibly-still-downloading world, which is exactly the git knowledge
 * this feature is told not to reimplement.
 */

import type { VaultCommit } from '../world-vault';
import {
  exportVaultCommit as vaultExportCommit,
  listVaultCommits as vaultListCommits,
  listVaults as vaultListVaults,
  subscribeVaultCommits as vaultSubscribeCommits,
  subscribeVaults as vaultSubscribeVaults
} from '../world-vault';

export type { VaultCommit };

export interface Vault {
  id: string;
  worldName: string;
  worldPath: string;
}

export function listVaults(): Vault[] {
  return vaultListVaults();
}

export function subscribeVaults(listener: (vaults: Vault[]) => void): () => void {
  return vaultSubscribeVaults(listener);
}

export function listVaultCommits(vaultId: string): VaultCommit[] {
  return vaultListCommits(vaultId);
}

/** Fires once per new commit, with the commit and the vault's full list so far. */
export function subscribeVaultCommits(listener: (commit: VaultCommit, all: VaultCommit[]) => void): () => void {
  return vaultSubscribeCommits(listener);
}

export type ExportResult = { ok: true; path: string } | { ok: false; error: string };

/** Checks a commit's tree out to `destinationDirectory`, without touching the live world. */
export async function exportVaultCommit(commit: VaultCommit, destinationDirectory: string): Promise<ExportResult> {
  const result = await vaultExportCommit(commit, destinationDirectory);
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, path: result.value.path };
}
