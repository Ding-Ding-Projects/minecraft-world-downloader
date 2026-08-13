/** Shared types for the render queue, the comparison surface and their UI. */

import type { VaultCommit } from './vaultLink';

export type RenderStatus =
  | 'queued'
  | 'exporting'
  | 'rendering'
  | 'finished'
  | 'failed'
  | 'cancelled'
  /** Queued for longer than the backlog warning threshold. Still queued, honestly labelled. */
  | 'behind';

export type RenderFailureKind =
  | 'java-missing'
  | 'renderer-not-configured'
  | 'renderer-invalid'
  | 'export-failed'
  | 'spawn-failed'
  | 'render-failed'
  | 'cancelled';

export interface RenderFailure {
  kind: RenderFailureKind;
  /** The exact message, in the words the tool or the export step used. */
  detail: string;
}

export interface RenderRecord {
  /** The commit this render is for. Stable, so "which commit" is never ambiguous. */
  commitId: string;
  vaultId: string;
  /** Copied from the commit at enqueue time, so a list reads without a join. */
  commitMessage: string;
  commitCreatedAt: string;
  status: RenderStatus;
  queuedAt: string;
  startedAt: string | null;
  endedAt: string | null;
  /** 0..1, or null when the renderer has not reported a percentage for this run yet. */
  progressFraction: number | null;
  /** The renderer's own description of the task it is on right now. */
  progressTask: string;
  failure: RenderFailure | null;
  /** Absolute path of the exported world snapshot this render read from. */
  exportDirectory: string | null;
  /** Absolute path of the directory `-g` wrote the web application into. */
  webroot: string | null;
  /** Absolute path of the renderer's own config folder, for a later serve. */
  configDirectory: string | null;
  /** Dimensions actually found in the export and rendered. */
  dimensions: string[];
  /** The most recent log lines, newest last, capped. */
  log: string[];
}

/** A brand-new, not-yet-started record. */
export function newRenderRecord(commit: VaultCommit): RenderRecord {
  return {
    commitId: commit.id,
    vaultId: commit.vaultId,
    commitMessage: commit.message,
    commitCreatedAt: commit.createdAt,
    status: 'queued',
    queuedAt: new Date().toISOString(),
    startedAt: null,
    endedAt: null,
    progressFraction: null,
    progressTask: '',
    failure: null,
    exportDirectory: null,
    webroot: null,
    configDirectory: null,
    dimensions: [],
    log: []
  };
}

export type JavaState =
  | { kind: 'unknown' }
  | { kind: 'checking' }
  | { kind: 'available'; version: string }
  | { kind: 'missing'; reason: string };

export type RendererKind = 'jar' | 'node' | 'unknown';

export type RendererState =
  | { kind: 'unconfigured' }
  | { kind: 'invalid'; path: string; reason: string }
  | { kind: 'ready'; path: string; rendererKind: RendererKind };

/** How the comparison view presents two renders relative to each other. */
export type CompareMode = 'slider' | 'toggle' | 'side-by-side';
