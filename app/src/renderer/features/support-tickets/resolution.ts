import { el } from '../../core/a11y';
import type { AppContext } from '../../core/registry';
import { buildDisclosure } from './disclosure';

/**
 * The resolution card: the one part of the desk that actually resolves anything.
 *
 * It shows the exact application data folder, copyable beside a button that
 * opens it in the platform's own file manager — and then it stops. This
 * application never deletes that folder. Deleting it is the user's own act, in
 * their own file manager, and the card says so in plain words at every humour
 * level.
 *
 * It is available immediately and unconditionally. A ticket's status never gates
 * it: somebody locked out of their own application is not made to wait for a
 * joke to reach its punchline.
 */

/** The folder a locked-out user deletes. Resolved from the privileged bridge. */
export function recoveryFolder(ctx: AppContext): string {
  return ctx.studio.info.userDataDir;
}

/**
 * Opens the application data folder in the platform's file manager.
 *
 * `revealUserData` is the dedicated privileged call and is tried first;
 * `shell.openPath` is the fallback for a build where the dedicated call is
 * refused. Both failing is reported with the exact error and the exact path, so
 * the user can still get there by hand.
 */
export async function openRecoveryFolder(
  ctx: AppContext
): Promise<{ ok: true } | { ok: false; error: string }> {
  const folder = recoveryFolder(ctx);
  const revealed = await ctx.studio.app.revealUserData();
  if (revealed.ok) return { ok: true };
  const opened = await ctx.studio.shell.openPath(folder);
  if (opened.ok) return { ok: true };
  return { ok: false, error: `${revealed.error} / ${opened.error}` };
}

/** Copies the folder path, reporting honestly when the clipboard refuses. */
export async function copyRecoveryFolder(
  ctx: AppContext
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await navigator.clipboard.writeText(recoveryFolder(ctx));
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export interface ResolutionCardOptions {
  /** Rendered above the folder controls; the ticket's own resolution reply. */
  leadIn?: HTMLElement;
  /** Set false inside the compact anchored desk, where space is tight. */
  showHeading?: boolean;
}

export function buildResolutionCard(ctx: AppContext, options: ResolutionCardOptions = {}): HTMLElement {
  const folder = recoveryFolder(ctx);
  const card = ctx.components.card({ variant: 'outlined' });
  card.setAttribute('data-appearance-id', 'supportTickets:resolution');
  card.setAttribute('data-support-tickets-resolution', 'true');
  card.id = 'supportTickets-resolution';

  if (options.showHeading !== false) {
    card.append(
      ctx.components.sectionHeading({
        title: 'supportTickets.resolution.heading',
        description: 'supportTickets.resolution.lede'
      })
    );
  }

  card.append(
    el('p', {
      className: 'md-typescale-body-medium',
      text: ctx.t('supportTickets.resolution.always', 'This is available immediately.')
    })
  );

  if (options.leadIn) card.append(options.leadIn);

  // The disclosure sits above the controls, where somebody who reads one line
  // before pressing a button reads this one.
  card.append(buildDisclosure(ctx));

  const pathField = ctx.components.textField({
    label: 'supportTickets.resolution.pathLabel',
    value: folder,
    supportingText: 'supportTickets.resolution.pathSupport',
    id: 'supportTickets-folder-path'
  });
  const pathInput = pathField.root.querySelector('input');
  if (pathInput) {
    // Read-only rather than editable: a field whose edits change nothing is a
    // control that looks like it works and does not. Selection and copying both
    // still work on a read-only field.
    pathInput.readOnly = true;
    pathInput.spellcheck = false;
    pathInput.setAttribute('aria-readonly', 'true');
  }
  card.append(pathField.root);

  const status = el('p', {
    className: 'md-field__support md-typescale-body-small',
    attrs: { role: 'status', 'aria-live': 'polite' }
  });

  const copyButton = ctx.components.button({
    label: 'supportTickets.resolution.copy',
    variant: 'outlined',
    icon: 'copy',
    onClick: () => {
      void copyRecoveryFolder(ctx).then((result) => {
        if (result.ok) {
          status.classList.remove('md-field__support--error');
          status.textContent = ctx.t(
            'supportTickets.resolution.copied',
            'The path was copied to the clipboard.'
          );
          ctx.a11y.announce(status.textContent);
          return;
        }
        status.classList.add('md-field__support--error');
        status.textContent = ctx.t(
          'supportTickets.resolution.copyFailed',
          'The clipboard refused the copy: {message}. The path is {path}.',
          { values: { message: result.error, path: folder } }
        );
        ctx.a11y.announce(status.textContent, true);
      });
    }
  });

  const openButton = ctx.components.button({
    label: 'supportTickets.resolution.open',
    variant: 'filled',
    icon: 'folder',
    onClick: () => {
      status.classList.remove('md-field__support--error');
      status.textContent = '';
      void openRecoveryFolder(ctx).then((result) => {
        if (result.ok) {
          status.textContent = ctx.t(
            'supportTickets.resolution.opened',
            'The folder was opened in the file manager.'
          );
          ctx.a11y.announce(status.textContent);
          void ctx.history.record('Opened the application data folder', 'supportTickets', {
            path: folder
          });
          return;
        }
        status.classList.add('md-field__support--error');
        status.textContent = ctx.t(
          'supportTickets.resolution.openFailed',
          'The file manager could not be opened: {message}. The folder is {path}.',
          { values: { message: result.error, path: folder } }
        );
        ctx.a11y.announce(status.textContent, true);
        ctx.notify.error(
          ctx.t('supportTickets.title', 'Support Tickets', { dialog: true }),
          status.textContent
        );
      });
    }
  });

  const actions = el('div', { className: 'md-confirm__actions' });
  actions.style.display = 'flex';
  actions.style.flexWrap = 'wrap';
  actions.style.gap = '8px';
  actions.append(copyButton, openButton);
  card.append(actions, status);

  card.append(
    el('p', {
      className: 'md-typescale-body-small',
      text: ctx.t(
        'supportTickets.resolution.neverDeletes',
        'This application never deletes that folder.'
      )
    })
  );

  ctx.appearance.applyTo(card, 'supportTickets:resolution');
  return card;
}
