/**
 * Stable identifiers and the movement log's record shape.
 *
 * Every id here is prefixed with the feature id, because setting ids are unique
 * across the whole application rather than per feature, and a palette teleport
 * needs an element id that survives a re-render.
 */

import type { ControlName, Vec3Like } from './session';

export const FEATURE_ID = 'mineflayer-movement';
export const TAB_ID = 'mineflayerMovement.pilot';

/**
 * The bridge that lets the "Stop all bot movement" palette command act
 * immediately, without navigating anywhere first.
 *
 * The palette entry lives in `index.ts`, which has no access to the mounted
 * tab's private state (held controls, a running walk, a running follow), and
 * the tab may not even be mounted yet when the command is invoked. The tab
 * registers its real stop function here while it is mounted and removes it
 * when it is not, so the palette command can call the genuine thing when it
 * exists and fall back to simply opening the tab when it does not.
 *
 * The `Window` augmentation itself lives in `session.ts`, alongside the
 * pre-existing `mineflayerMovement` provider bridge, rather than in a second
 * `declare global` block here — TypeScript's declaration-merge check across
 * several `declare global { interface Window {...} }` blocks for the same
 * interface is stricter than it looks, and one block per interface per
 * feature is the reliable shape.
 */
export interface MovementControlsBridge {
  stopAll(): void;
}

/* ---------------- setting ids ---------------- */

export const ARRIVE_RADIUS_ID = 'mineflayerMovement.arriveRadius';
export const FOLLOW_DISTANCE_ID = 'mineflayerMovement.followDistance';
export const SPRINT_WHILE_WALKING_ID = 'mineflayerMovement.sprintWhileWalking';
export const JUMP_WHEN_STUCK_ID = 'mineflayerMovement.jumpWhenStuck';
export const STUCK_SECONDS_ID = 'mineflayerMovement.stuckSeconds';
export const WALK_TIMEOUT_ID = 'mineflayerMovement.walkTimeoutSeconds';
export const TICK_MS_ID = 'mineflayerMovement.tickMs';
export const BLOCK_RAY_DISTANCE_ID = 'mineflayerMovement.blockRayDistance';
export const ENTITY_RAY_DISTANCE_ID = 'mineflayerMovement.entityRayDistance';
export const KEYBOARD_PILOTING_ID = 'mineflayerMovement.keyboardPiloting';
export const SHOW_PREVIEW_ID = 'mineflayerMovement.showPreview';
export const TRAIL_POINTS_ID = 'mineflayerMovement.trailPoints';
export const LOG_LIMIT_ID = 'mineflayerMovement.logLimit';

/* ---------------- element ids the palette teleports to ---------------- */

export const READOUT_ELEMENT = 'mineflayer-movement-readout';
export const PAD_ELEMENT = 'mineflayer-movement-pad';
export const STOP_ELEMENT = 'mineflayer-movement-stop';
export const LOOK_ELEMENT = 'mineflayer-movement-look';
export const RAY_ELEMENT = 'mineflayer-movement-ray';
export const WALK_ELEMENT = 'mineflayer-movement-walk';
export const FOLLOW_ELEMENT = 'mineflayer-movement-follow';
export const PREVIEW_ELEMENT = 'mineflayer-movement-preview';
export const LOG_ELEMENT = 'mineflayer-movement-log';

/* ---------------- data keys ---------------- */

/** The movement log. Records only, never a user-tunable setting. */
export const LOG_KEY = 'mineflayerMovement.data.log';

/* ---------------- compiled-in defaults ---------------- */

export const DEFAULTS = {
  arriveRadius: 1.5,
  followDistance: 3,
  sprintWhileWalking: false,
  jumpWhenStuck: true,
  stuckSeconds: 6,
  walkTimeoutSeconds: 120,
  tickMs: 100,
  /** The library's own `blockAtCursor` default is 256; 64 is the useful range. */
  blockRayDistance: 64,
  /** The library's own `entityAtCursor` default, unchanged. */
  entityRayDistance: 3.5,
  keyboardPiloting: true,
  showPreview: true,
  trailPoints: 240,
  logLimit: 500
} as const;

/* ---------------- the movement log ---------------- */

export type MovementLogKind =
  | 'control'
  | 'look'
  | 'walk'
  | 'follow'
  | 'raytrace'
  | 'stop'
  | 'session';

export type MovementLogOutcome = 'started' | 'finished' | 'cancelled' | 'failed' | 'observed';

/**
 * One thing that genuinely happened, recorded as it happened.
 *
 * Nothing is written here speculatively: a walk that was requested and refused
 * is `failed` with the reason the driver actually gave, and an arrival is only
 * written once the measured distance really fell inside the arrive radius.
 */
export interface MovementLogRow {
  id: string;
  /** ISO-8601 with the local offset, so a log read tomorrow still makes sense. */
  timestamp: string;
  kind: MovementLogKind;
  outcome: MovementLogOutcome;
  /** Plain English, already resolved. The log is a record, not live copy. */
  detail: string;
  /** Where the bot was when this happened, when a position was available. */
  position: Vec3Like | null;
}

let counter = 0;

export function newLogId(): string {
  counter += 1;
  return `mfm-${Date.now().toString(36)}-${counter.toString(36)}`;
}

export function normaliseLogRow(raw: unknown): MovementLogRow | null {
  if (!raw || typeof raw !== 'object') return null;
  const source = raw as Record<string, unknown>;
  const detail = typeof source.detail === 'string' ? source.detail : '';
  if (detail.length === 0) return null;
  const kinds: MovementLogKind[] = ['control', 'look', 'walk', 'follow', 'raytrace', 'stop', 'session'];
  const outcomes: MovementLogOutcome[] = ['started', 'finished', 'cancelled', 'failed', 'observed'];
  const position = source.position;
  return {
    id: typeof source.id === 'string' && source.id.length > 0 ? source.id : newLogId(),
    timestamp: typeof source.timestamp === 'string' ? source.timestamp : new Date().toISOString(),
    kind: kinds.includes(source.kind as MovementLogKind) ? (source.kind as MovementLogKind) : 'session',
    outcome: outcomes.includes(source.outcome as MovementLogOutcome)
      ? (source.outcome as MovementLogOutcome)
      : 'observed',
    detail,
    position:
      position && typeof position === 'object'
        ? {
            x: Number((position as Record<string, unknown>).x) || 0,
            y: Number((position as Record<string, unknown>).y) || 0,
            z: Number((position as Record<string, unknown>).z) || 0
          }
        : null
  };
}

/* ---------------- keyboard piloting map ---------------- */

/**
 * The keys that drive the pad while it has focus.
 *
 * Scoped to the pad deliberately: a global key hook would swallow a `w` typed
 * into a coordinate field, and a bot that walks off because somebody typed a
 * number is exactly the failure this surface exists to avoid.
 */
export const PILOT_KEYS: Record<string, ControlName> = {
  KeyW: 'forward',
  ArrowUp: 'forward',
  KeyS: 'back',
  ArrowDown: 'back',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  Space: 'jump',
  ShiftLeft: 'sneak',
  ShiftRight: 'sneak',
  ControlLeft: 'sprint',
  ControlRight: 'sprint'
};

/** The chord shown beside each control, in the notation the platform uses. */
export const CONTROL_SHORTCUTS: Record<ControlName, string> = {
  forward: 'W',
  back: 'S',
  left: 'A',
  right: 'D',
  jump: 'Space',
  sneak: 'Shift',
  sprint: 'Ctrl'
};

/** i18n key for each control's visible name. */
export function controlLabelKey(control: ControlName): string {
  return `mineflayerMovement.control.${control}`;
}
