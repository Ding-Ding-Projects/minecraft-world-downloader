/**
 * The vocabulary of the updater.
 *
 * Every state the feature can be in has a name here, and every name is a state
 * the user interface can actually render. There is no "unknown" that stands in
 * for "we did not look", and no success value that can be reached without the
 * work behind it having happened: `ready` requires a package on disk whose hash
 * matched the feed's, and nothing else sets it.
 */

/** What the updater is doing right now. */
export type UpdatePhase =
  /** Nothing has been attempted yet this session. */
  | 'idle'
  /** Automatic updates are switched off, so no check will be made. */
  | 'disabled'
  /** No feed address is configured, so there is nothing to check against. */
  | 'unconfigured'
  /** A check is in flight. */
  | 'checking'
  /** The feed was read and this build is the newest one it offers. */
  | 'upToDate'
  /** A newer release exists in the feed but has not been downloaded. */
  | 'available'
  /** The package is being transferred. `transferred` and `total` are real bytes. */
  | 'downloading'
  /** The transfer finished and the bytes are being hashed against the feed. */
  | 'verifying'
  /** The verified bytes are being written into the staging directory. */
  | 'staging'
  /** A verified package is staged on disk and waiting for an explicit restart. */
  | 'ready'
  /** The user asked to restart and install; the handover is in progress. */
  | 'installing'
  /** Something went wrong. `failure` says exactly what. */
  | 'failed';

/**
 * Why the last attempt failed.
 *
 * Each code maps to one sentence the user can act on. A generic "something went
 * wrong" is not in this list, because it is not something anybody can act on.
 */
export type UpdateFailureCode =
  | 'not-configured'
  | 'offline'
  | 'feed-unreachable'
  | 'feed-invalid'
  | 'downgrade-blocked'
  | 'too-large'
  | 'transfer-failed'
  | 'size-mismatch'
  | 'hash-mismatch'
  | 'write-failed'
  | 'asset-corrupt'
  | 'cancelled'
  | 'install-unavailable'
  | 'install-failed';

export interface UpdateFailure {
  code: UpdateFailureCode;
  /** The exact machine detail: a status line, an error string, two byte counts. */
  detail: string;
}

/** One package the feed offers. */
export interface FeedEntry {
  /** Lower-case SHA-1 hex digest, exactly as the feed states it. */
  sha1: string;
  /** The package file name as it appears in the feed. */
  fileName: string;
  /** Size in bytes, as the feed states it. */
  size: number;
  /** Version parsed out of the package file name. */
  version: string;
  /** Squirrel publishes both complete and differential packages. */
  kind: 'full' | 'delta';
  /** Absolute URL, resolved against the feed address. */
  url: string;
}

/** A verified package sitting in the staging directory. */
export interface StagedUpdate {
  version: string;
  fileName: string;
  /** Lower-case SHA-1 hex digest that both the feed and the bytes agreed on. */
  sha1: string;
  /** Size of the package in bytes, before the staging encoding is applied. */
  size: number;
  /** Absolute path of the staged payload file. */
  packagePath: string;
  /** Absolute path of the manifest that describes the payload beside it. */
  manifestPath: string;
  /**
   * How the payload is stored on disk. `base64` is what this build writes,
   * because the privileged bridge exposes a text write and no binary write; a
   * privileged installer bridge would stage the raw bytes instead.
   */
  encoding: 'base64';
  /** ISO-8601 instant at which staging completed. */
  stagedAt: string;
  /** The feed address the package came from. */
  feedUrl: string;
  /** The application version that was installed when this was staged. */
  supersedes: string;
}

/** One row of the check log. */
export interface CheckLogEntry {
  id: string;
  /** ISO-8601. */
  at: string;
  /** How the check was started. */
  trigger: 'startup' | 'schedule' | 'manual' | 'retry';
  outcome:
    | 'up-to-date'
    | 'available'
    | 'staged'
    | 'failed'
    | 'cancelled'
    | 'skipped';
  /** The version the feed offered, or the installed version when none was newer. */
  version: string;
  /** Machine detail, already free of credentials. */
  detail: string;
  /** How long the attempt took, in milliseconds. */
  durationMs: number;
}

/** Everything a surface needs to render the updater truthfully. */
export interface UpdateState {
  phase: UpdatePhase;
  /** The version this build reports for itself. */
  currentVersion: string;
  /** The newest package the last successful check found, if any. */
  candidate: FeedEntry | null;
  failure: UpdateFailure | null;
  /** Bytes received so far in the current transfer. */
  transferred: number;
  /** Total bytes expected for the current transfer, from the feed. */
  total: number;
  /**
   * Whether the server honoured a byte-range request. `null` before a transfer
   * has been attempted. When it is false the transfer arrives in one piece and
   * intermediate progress genuinely is not available, which the surface says
   * rather than inventing a moving bar.
   */
  rangeSupported: boolean | null;
  /** ISO-8601 of the last completed check, successful or not. */
  lastCheckedAt: string | null;
  /** ISO-8601 of the next scheduled check, or null when none is scheduled. */
  nextCheckAt: string | null;
  staged: StagedUpdate | null;
  /**
   * True when a privileged installer bridge is present in this build. When it is
   * false the restart action is disabled and says exactly why, rather than
   * pretending to install and quietly doing nothing.
   */
  installAvailable: boolean;
  /** ISO-8601 until which the ready banner stays out of the way. */
  snoozedUntil: string | null;
  /** True while a transfer is running and can be cancelled. */
  cancellable: boolean;
}

/**
 * The privileged installer bridge this feature looks for.
 *
 * It is deliberately narrow: hand over a verified staged package and quit into
 * the platform updater. Nothing in the renderer can do this — there is no binary
 * write and the process allow-list carries no installer — so when the bridge is
 * absent the feature reports that boundary instead of guessing at a success.
 */
export interface UpdateInstallBridge {
  installStaged(request: {
    manifestPath: string;
    packagePath: string;
    encoding: 'base64';
    version: string;
    sha1: string;
  }): Promise<{ ok: true; value: void } | { ok: false; error: string; code?: string }>;
}
