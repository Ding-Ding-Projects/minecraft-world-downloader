import type { AppContext } from '../../core/registry';
import {
  attemptCount,
  recordFailure,
  recordSuccess,
  verifyCandidate,
  waitRemainingMs,
  type CredentialStatus
} from './credential';
import { el } from './dom';

/**
 * The anchored unlock prompt.
 *
 * It opens beside the control that was operated rather than as a detached
 * dialog, returns focus there on every exit, and states the recovery route the
 * entire time it is open — because forgetting the code is a normal outcome for a
 * lock that exists for fun, and a user must never be stuck behind one with their
 * own application on the other side.
 */

export interface UnlockRequest {
  ctx: AppContext;
  anchor: HTMLElement;
  /** The user's chosen name for the mode. Never the shipped name. */
  modeName: string;
  /** The exact folder a locked-out user deletes to reset the mode. */
  recoveryFolder: string;
  credential: CredentialStatus;
}

export function requestUnlock(request: UnlockRequest): Promise<boolean> {
  const { ctx, anchor, credential } = request;

  return new Promise<boolean>((resolve) => {
    let settled = false;
    let countdown: number | null = null;
    let release: (() => void) | null = null;

    const finish = (value: boolean): void => {
      if (settled) return;
      settled = true;
      if (countdown !== null) window.clearInterval(countdown);
      release?.();
      handle.close();
      ctx.a11y.focusVisible(anchor);
      resolve(value);
    };

    const handle = ctx.overlay.open({
      anchor,
      role: 'dialog',
      label: ctx.t('schoolMode.unlock.title', `Turn off ${request.modeName}`),
      lightDismiss: false,
      onClose: () => finish(false)
    });

    handle.body.append(
      el('h2', {
        className: 'md-typescale-title-medium',
        text: ctx.t('schoolMode.unlock.title', `Turn off ${request.modeName}`)
      })
    );

    const feedback = el('p', {
      className: 'school-mode__feedback md-typescale-body-small',
      attrs: { role: 'status', 'aria-live': 'polite' }
    });

    /* ---- no code was ever set: say so and offer the switch itself ---- */

    if (credential.method === 'none') {
      handle.body.append(
        el('p', {
          className: 'md-typescale-body-medium',
          text: ctx.t(
            'schoolMode.unlock.none',
            'No unlock code was ever set, so there is nothing to type. The mode can be turned off from here, and deleting the shared record folder resets it too.'
          )
        }),
        recoveryLine(),
        feedback
      );
      const actions = el('div', { className: 'school-mode__dialog-actions' });
      const keep = ctx.components.button({
        label: ctx.t('schoolMode.unlock.cancel', 'Keep it on'),
        variant: 'text',
        onClick: () => finish(false)
      });
      const turnOff = ctx.components.button({
        label: ctx.t('schoolMode.state.turnOff', 'Turn it off'),
        variant: 'filled',
        onClick: () => finish(true)
      });
      actions.append(keep, turnOff);
      handle.body.append(actions);
      release = ctx.a11y.trapFocus(handle.root);
      handle.root.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          finish(false);
        }
      });
      window.setTimeout(() => ctx.a11y.focusVisible(turnOff), 0);
      return;
    }

    /* ---- the ordinary path: prove the code ---- */

    const isTotp = credential.method === 'totp';
    const field = ctx.components.textField({
      label: isTotp ? 'schoolMode.unlock.code' : 'schoolMode.unlock.password',
      type: isTotp ? 'text' : 'password',
      variant: 'outlined',
      onCommit: () => void attempt()
    });
    handle.body.append(field.root, recoveryLine(), feedback);

    const actions = el('div', { className: 'school-mode__dialog-actions' });
    const cancel = ctx.components.button({
      label: ctx.t('schoolMode.unlock.cancel', 'Keep it on'),
      variant: 'text',
      onClick: () => finish(false)
    });
    const submit = ctx.components.button({
      label: ctx.t('schoolMode.unlock.submit', 'Unlock'),
      variant: 'filled',
      onClick: () => void attempt()
    });
    actions.append(cancel, submit);
    handle.body.append(actions);

    const paceTick = (): void => {
      const remaining = waitRemainingMs();
      if (remaining <= 0) {
        submit.disabled = false;
        submit.removeAttribute('aria-disabled');
        if (countdown !== null) {
          window.clearInterval(countdown);
          countdown = null;
        }
        return;
      }
      submit.disabled = true;
      submit.setAttribute('aria-disabled', 'true');
      const seconds = Math.ceil(remaining / 1000);
      submit.title = ctx.t('schoolMode.unlock.wait', 'Wait {seconds} seconds before trying again.', {
        values: { seconds }
      });
      feedback.textContent = ctx.t('schoolMode.unlock.wait', 'Wait {seconds} seconds before trying again.', {
        values: { seconds }
      });
    };

    const startPacing = (): void => {
      if (countdown !== null) window.clearInterval(countdown);
      countdown = window.setInterval(paceTick, 250);
      paceTick();
    };

    async function attempt(): Promise<void> {
      if (waitRemainingMs() > 0) {
        paceTick();
        return;
      }
      const candidate = field.get().trim();
      if (candidate === '') {
        feedback.textContent = ctx.t(
          'schoolMode.unlock.wrong',
          'That did not match. Nothing was changed and nothing was deleted. {attempts} attempts so far this session.',
          { values: { attempts: attemptCount() } }
        );
        return;
      }
      const outcome = await verifyCandidate(ctx.studio, credential.method, candidate);
      if (outcome.ok) {
        recordSuccess();
        ctx.a11y.announce(ctx.t('schoolMode.unlock.done', 'Unlocked. The mode is off.'), true);
        finish(true);
        return;
      }
      if (outcome.reason === 'error') {
        feedback.textContent = ctx.t('schoolMode.unlock.vaultError', 'The unlock code could not be checked: {error}', {
          values: { error: outcome.error }
        });
        return;
      }
      if (outcome.reason === 'no-credential') {
        feedback.textContent = ctx.t(
          'schoolMode.unlock.none',
          'No unlock code was ever set, so there is nothing to type. The mode can be turned off from here, and deleting the shared record folder resets it too.'
        );
        submit.disabled = false;
        // The stored code vanished between the status read and this attempt, so
        // the honest thing is to let the switch through rather than trap the
        // user behind a code that no longer exists.
        finish(true);
        return;
      }
      recordFailure();
      field.set('');
      feedback.textContent = ctx.t(
        'schoolMode.unlock.wrong',
        'That did not match. Nothing was changed and nothing was deleted. {attempts} attempts so far this session.',
        { values: { attempts: attemptCount() } }
      );
      ctx.a11y.announce(feedback.textContent, true);
      if (waitRemainingMs() > 0) startPacing();
    }

    function recoveryLine(): HTMLElement {
      return el('p', {
        className: 'school-mode__recovery md-typescale-body-small',
        text: ctx.t(
          'schoolMode.unlock.recovery',
          'Forgotten it? Delete the shared record folder at {path}. That resets the mode on this computer.',
          { values: { path: request.recoveryFolder } }
        )
      });
    }

    release = ctx.a11y.trapFocus(handle.root);
    handle.root.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        finish(false);
      }
    });
    if (waitRemainingMs() > 0) startPacing();
    window.setTimeout(() => field.focus(), 0);
  });
}
