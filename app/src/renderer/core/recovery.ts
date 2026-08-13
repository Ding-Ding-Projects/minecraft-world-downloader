import { a11y, el } from './a11y';
import { components } from './components';
import { i18n } from './i18n';

/**
 * Recovery for a failure the user cannot diagnose from the error alone.
 *
 * The route belongs at the surface where the failure was discovered — beside
 * the control that failed, not behind a menu somewhere else. Someone whose
 * download was refused is looking at the download button; sending them
 * hunting for a "Troubleshooting" page is the dead end this module exists to
 * avoid. `showRecovery` therefore inserts its banner immediately after the
 * anchor element the caller supplies.
 *
 * A refused credential or missing permission scope gets its re-authentication
 * action offered directly and immediately, not "go to settings and sign in
 * again" — so `reauthenticate` is a first-class option alongside `retry`.
 */

export interface RecoveryAction {
  /** i18n key or literal label. */
  label: string;
  run(): void | Promise<void>;
}

export interface RecoveryOptions {
  /** The control that failed. Recovery renders immediately after this element. */
  anchor: HTMLElement;
  /** The exact, plain-words cause. Never vague, at any funny level. */
  reason: string;
  /** Retries the exact same operation. */
  retry?(): void | Promise<void>;
  /**
   * Re-authenticates directly, offered only when the failure genuinely was a
   * refused credential or a missing permission scope. Absent for any other
   * failure — this module never fabricates a re-auth action that does not apply.
   */
  reauthenticate?(): void | Promise<void>;
  /** Further concrete recovery actions specific to this failure. */
  actions?: RecoveryAction[];
}

export interface RecoveryHandle {
  root: HTMLElement;
  dismiss(): void;
}

export function showRecovery(options: RecoveryOptions): RecoveryHandle {
  const root = el('div', {
    className: 'md-recovery',
    attrs: { role: 'alert', 'data-appearance-id': 'core:recovery-banner' }
  });

  root.append(
    el('p', {
      className: 'md-typescale-body-medium md-recovery__reason',
      text: i18n.t('core.recovery.reason', 'This did not work: {reason}', { values: { reason: options.reason } })
    })
  );

  const actionDefs: RecoveryAction[] = [];
  if (options.retry) actionDefs.push({ label: 'core.recovery.retry', run: options.retry });
  if (options.reauthenticate) {
    actionDefs.push({ label: 'core.recovery.reauthenticate', run: options.reauthenticate });
  }
  if (options.actions) actionDefs.push(...options.actions);

  const actionsHost = el('div', { className: 'md-recovery__actions' });
  for (const action of actionDefs) {
    actionsHost.append(
      components.button({
        label: action.label,
        variant: 'tonal',
        onClick: () => void action.run()
      })
    );
  }

  const dismiss = components.iconButton({
    icon: 'close',
    label: i18n.t('core.recovery.dismiss', 'Dismiss this recovery message'),
    variant: 'standard',
    onClick: () => root.remove()
  });
  const actionsRow = el('div', { className: 'md-recovery__row' });
  actionsRow.append(actionsHost, dismiss);
  root.append(actionsRow);

  // Right after the failed control, not in a menu or a page elsewhere.
  options.anchor.insertAdjacentElement('afterend', root);

  a11y.announce(i18n.t('core.recovery.reason', 'This did not work: {reason}', { values: { reason: options.reason } }), true);
  const firstAction = actionsHost.querySelector<HTMLElement>('button');
  if (firstAction) a11y.focusVisible(firstAction);

  return {
    root,
    dismiss: () => root.remove()
  };
}

/**
 * Convenience for the specific, common case: a privileged call returned
 * `{ ok: false }` because a credential was refused or a scope is missing.
 * Keeps the honest-labelling rule in one place rather than re-deciding at
 * every call site whether a failure "counts" as an auth failure.
 */
export function showAuthRecovery(options: {
  anchor: HTMLElement;
  reason: string;
  reauthenticate(): void | Promise<void>;
  retry?(): void | Promise<void>;
}): RecoveryHandle {
  return showRecovery(options);
}
