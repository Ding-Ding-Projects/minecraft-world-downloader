/**
 * The record shape this feature reads and writes.
 *
 * This mirrors `scripts/report-status.mjs` on purpose — the same status values,
 * the same evidence states, the same fields — so the in-app view and whatever an
 * agent reports to the shared hub from the command line can never disagree about
 * what a "landed" lane or a "verified" piece of evidence means. This tab does
 * not talk to the hub over the network; it is this application's own local
 * record, described in `README.md`'s local-only section of the docs article.
 */

/** Exactly the values `report-status.mjs` accepts for `--status`. */
export const STATUS_VALUES = ['running', 'waiting', 'blocked', 'landed', 'failed'] as const;
export type StatusValue = (typeof STATUS_VALUES)[number];

/** Exactly the values `report-status.mjs` accepts for one evidence item's state. */
export const EVIDENCE_STATES = ['pending', 'running', 'verified', 'failed'] as const;
export type EvidenceState = (typeof EVIDENCE_STATES)[number];

/** A stable emoji per status. Scannable, and never upgrades what it labels. */
export const STATUS_EMOJI: Record<StatusValue, string> = {
  running: '🏃',
  waiting: '⏳',
  blocked: '🧱',
  landed: '✅',
  failed: '❌'
};

/** A stable emoji per evidence state, independent of the lane-status mapping above. */
export const EVIDENCE_EMOJI: Record<EvidenceState, string> = {
  pending: '🕓',
  running: '🏃',
  verified: '✅',
  failed: '❌'
};

/** The icon (from `ICON_NAMES`) that best matches each status at a glance. */
export const STATUS_ICON: Record<StatusValue, string> = {
  running: 'play',
  waiting: 'pause',
  blocked: 'warning',
  landed: 'success',
  failed: 'error'
};

export interface EvidenceItem {
  id: string;
  label: string;
  url: string;
  state: EvidenceState;
}

/**
 * One checked-out copy of a repository. `report-status.mjs` always sends
 * exactly one of these — the checkout that ran the script — with `bytes` fixed
 * at `0` because measuring a working tree's real size needs a recursive walk
 * this application does not perform either. Both surfaces leave it at `0` and
 * say so, rather than one of them inventing a number the other cannot check.
 */
export interface WorktreeRecord {
  path: string;
  branch: string;
  commit: string;
  bytes: number;
  dirty: boolean;
}

export type LaneOrigin = 'local' | 'manual';

export interface LaneRecord {
  id: string;
  /**
   * `local` is this application's own checkout, refreshed from real Git state
   * and never deletable. `manual` is anything you added yourself to keep a
   * second project's last-known status somewhere you will actually see it.
   */
  origin: LaneOrigin;
  title: string;
  repository: string;
  branch: string;
  agent: string;
  status: StatusValue;
  summary: string;
  assumption: string;
  verifiedBaseline: string;
  evidence: EvidenceItem[];
  nextGates: string[];
  machine: string;
  worktrees: WorktreeRecord[];
  /** ISO-8601. When this record last changed — by a refresh or by an edit. */
  updatedAt: string;
}

/** Stable, reserved id for this application's own checkout. Never reused. */
export const SELF_LANE_ID = 'status.self-checkout';

export const MAX_LANES = 200;
export const MAX_EVIDENCE_PER_LANE = 8;
export const MAX_GATES_PER_LANE = 8;
export const MAX_SHORT_TEXT = 200;
export const MAX_LONG_TEXT = 4000;
export const MAX_URL_LENGTH = 2000;

/** A fresh, empty record for this application's own checkout. */
export function createSelfLane(): LaneRecord {
  return {
    id: SELF_LANE_ID,
    origin: 'local',
    title: 'This checkout',
    repository: '',
    branch: '',
    agent: '',
    status: 'running',
    summary: '',
    assumption: '',
    verifiedBaseline: '',
    evidence: [],
    nextGates: [],
    machine: '',
    worktrees: [],
    updatedAt: new Date(0).toISOString()
  };
}

export function isStatusValue(value: unknown): value is StatusValue {
  return typeof value === 'string' && (STATUS_VALUES as readonly string[]).includes(value);
}

export function isEvidenceState(value: unknown): value is EvidenceState {
  return typeof value === 'string' && (EVIDENCE_STATES as readonly string[]).includes(value);
}

/** A honest http(s)-only check — the same rule `report-status.mjs` enforces. */
export function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
