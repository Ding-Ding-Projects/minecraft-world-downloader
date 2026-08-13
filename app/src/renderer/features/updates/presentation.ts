import type { AppContext } from '../../core/registry';

import type { CheckLogEntry, UpdateFailureCode, UpdatePhase, UpdateState } from './types';

/**
 * Turning the engine's state into words, once, so every surface says the same
 * thing about the same state.
 *
 * Two surfaces that describe one state differently is how a user ends up
 * believing an update installed when it did not, so the mapping lives here
 * rather than being rewritten in the banner and again in the panel.
 */

const PHASE_KEY: Record<UpdatePhase, string> = {
  idle: 'updates.phase.idle',
  disabled: 'updates.phase.disabled',
  unconfigured: 'updates.phase.unconfigured',
  checking: 'updates.phase.checking',
  upToDate: 'updates.phase.upToDate',
  available: 'updates.phase.available',
  downloading: 'updates.phase.downloading',
  verifying: 'updates.phase.verifying',
  staging: 'updates.phase.staging',
  ready: 'updates.phase.ready',
  installing: 'updates.phase.installing',
  failed: 'updates.phase.failed'
};

const FAILURE_KEY: Record<UpdateFailureCode, string> = {
  'not-configured': 'updates.failure.notConfigured',
  offline: 'updates.failure.offline',
  'feed-unreachable': 'updates.failure.feedUnreachable',
  'feed-invalid': 'updates.failure.feedInvalid',
  'downgrade-blocked': 'updates.failure.downgradeBlocked',
  'too-large': 'updates.failure.tooLarge',
  'transfer-failed': 'updates.failure.transferFailed',
  'size-mismatch': 'updates.failure.sizeMismatch',
  'hash-mismatch': 'updates.failure.hashMismatch',
  'write-failed': 'updates.failure.writeFailed',
  'asset-corrupt': 'updates.failure.assetCorrupt',
  cancelled: 'updates.failure.cancelled',
  'install-unavailable': 'updates.failure.installUnavailable',
  'install-failed': 'updates.failure.installFailed'
};

/** The severity a phase should be announced with. Never colour alone. */
const PHASE_SEVERITY: Record<UpdatePhase, 'info' | 'success' | 'warning' | 'error' | 'progress'> = {
  idle: 'info',
  disabled: 'info',
  unconfigured: 'warning',
  checking: 'progress',
  upToDate: 'success',
  available: 'info',
  downloading: 'progress',
  verifying: 'progress',
  staging: 'progress',
  ready: 'success',
  installing: 'progress',
  failed: 'error'
};

export function phaseLabel(ctx: AppContext, phase: UpdatePhase): string {
  return ctx.t(PHASE_KEY[phase], PHASE_KEY[phase]);
}

export function phaseSeverity(phase: UpdatePhase): 'info' | 'success' | 'warning' | 'error' | 'progress' {
  return PHASE_SEVERITY[phase];
}

/**
 * The full failure sentence: what went wrong, then the machine detail.
 *
 * The detail is never dropped. A reader who is going to fix a broken feed
 * address needs the status line the server actually returned, not a paraphrase.
 */
export function failureText(ctx: AppContext, state: UpdateState): string {
  if (!state.failure) return '';
  const reason = ctx.t(FAILURE_KEY[state.failure.code], FAILURE_KEY[state.failure.code]);
  if (state.failure.detail.trim() === '') return reason;
  const detail = ctx.t('updates.failure.detail', 'Reported detail: {detail}', {
    values: { detail: state.failure.detail }
  });
  return `${reason} ${detail}`;
}

export function triggerLabel(ctx: AppContext, trigger: CheckLogEntry['trigger']): string {
  const key = `updates.log.trigger.${trigger}`;
  return ctx.t(key, trigger);
}

export function outcomeLabel(ctx: AppContext, outcome: CheckLogEntry['outcome']): string {
  const key =
    outcome === 'up-to-date'
      ? 'updates.log.outcome.upToDate'
      : `updates.log.outcome.${outcome}`;
  return ctx.t(key, outcome);
}

/** A local, human-readable instant. The stored value stays ISO-8601. */
export function formatInstant(iso: string | null, fallback: string): string {
  if (!iso) return fallback;
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return fallback;
  return at.toLocaleString();
}

export function formatDuration(milliseconds: number): string {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return '—';
  if (milliseconds < 1000) return `${Math.round(milliseconds)} ms`;
  return `${(milliseconds / 1000).toFixed(1)} s`;
}

/** Whether the ready banner should be on screen at all right now. */
export function bannerShouldShow(state: UpdateState, snoozed: boolean): boolean {
  return state.phase === 'ready' && state.staged !== null && !snoozed;
}
