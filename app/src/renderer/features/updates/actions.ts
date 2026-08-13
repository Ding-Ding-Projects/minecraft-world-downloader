import type { AppContext } from '../../core/registry';

import { failureText } from './presentation';
import { updater } from './updater';

/**
 * The three actions a user can reach from more than one surface.
 *
 * They live together because the banner, the panel and the command palette must
 * behave identically: the same unsaved-work check, the same confirmation gate,
 * the same honest report afterwards. Duplicating any of this is how the palette
 * ends up with the version that skips the gate.
 */

/** Returns focus to whatever opened a flow, whether it succeeded or not. */
function restoreFocus(anchor: HTMLElement | null): void {
  if (!anchor || !anchor.isConnected) return;
  window.requestAnimationFrame(() => {
    if (anchor.isConnected) anchor.focus();
  });
}

/**
 * Restart and install, with unsaved work checked first.
 *
 * Any surface in the application can declare unsaved work by carrying
 * `data-unsaved-work="<what would be lost>"`. Whatever is declared is listed in
 * the dialog, so a restart can never quietly discard somebody's editing.
 */
export async function restartAndInstall(ctx: AppContext, anchor: HTMLElement | null): Promise<void> {
  const state = updater.state();
  const staged = state.staged;
  if (!staged) {
    ctx.notify.warn(
      ctx.t('updates.notify.nothingToDownload.title', 'There is no update to download'),
      ctx.t('updates.disabled.notStaged', 'No verified package is staged yet, so there is nothing to install.')
    );
    restoreFocus(anchor);
    return;
  }

  if (!updater.installBridgeAvailable()) {
    ctx.notify.error(
      ctx.t('updates.notify.installUnavailable.title', 'This build cannot install the update itself'),
      ctx.t(
        'updates.notify.installUnavailable.body',
        'The verified package is staged at {path}. It has to be installed by hand until a privileged installer handover is present.',
        { values: { path: staged.packagePath } }
      )
    );
    restoreFocus(anchor);
    return;
  }

  const unsaved = updater.unsavedWork();
  const bodyLines = [
    ctx.t(
      'updates.confirm.restart.body',
      'The application closes and the platform updater installs version {version}. The installer is unsigned, so Windows will show an unknown-publisher warning.',
      { values: { version: staged.version }, dialog: true }
    )
  ];
  if (unsaved.length > 0) {
    bodyLines.push(
      ctx.t('updates.confirm.restart.unsaved', 'These surfaces say they hold unsaved work and it will be lost: {items}', {
        values: { items: unsaved.join(', ') },
        dialog: true
      })
    );
  }

  const approved = await ctx.components.dialog({
    title: ctx.t('updates.confirm.restart.title', 'Restart now and install version {version}?', {
      values: { version: staged.version },
      dialog: true
    }),
    body: bodyLines.join('\n\n'),
    icon: unsaved.length > 0 ? 'warning' : 'refresh',
    confirmLabel: ctx.t('updates.confirm.restart.confirm', 'Restart and install'),
    cancelLabel: ctx.t('updates.confirm.restart.cancel', 'Stay open')
  });
  if (!approved) {
    restoreFocus(anchor);
    return;
  }

  const result = await updater.installStaged();
  if (!result.ok) {
    ctx.notify.error(ctx.t('updates.notify.failed.title', 'The update attempt failed'), failureText(ctx, updater.state()));
    restoreFocus(anchor);
  }
  // On success the platform updater takes over and this window goes away; there
  // is deliberately no success toast, because a toast nobody can read is not a
  // report.
}

/** Discards the staged package, behind the two-key gate. */
export async function discardStaged(ctx: AppContext, anchor: HTMLElement): Promise<void> {
  const staged = updater.state().staged;
  if (!staged) return;

  const approved = await ctx.confirm.request({
    action: ctx.t('updates.confirm.discard.action', 'Discard the staged update {version}', {
      values: { version: staged.version }
    }),
    affected: [`${staged.fileName} (${staged.size} bytes)`, staged.packagePath, staged.manifestPath],
    irreversible: ctx.t(
      'updates.confirm.discard.irreversible',
      'The downloaded package at {path} is truncated to zero bytes and has to be downloaded again to be installed. The application itself is not touched.',
      { values: { path: staged.packagePath } }
    ),
    anchor
  });
  if (!approved) {
    restoreFocus(anchor);
    return;
  }

  const result = await updater.discardStaged();
  if (!result.ok) {
    ctx.notify.error(
      ctx.t('updates.notify.failed.title', 'The update attempt failed'),
      result.error ?? 'The staged payload could not be truncated.'
    );
  } else {
    ctx.notify.success(
      ctx.t('updates.notify.discarded.title', 'The staged update was discarded'),
      ctx.t(
        'updates.notify.discarded.body',
        'The payload at {path} was truncated to zero bytes and can be deleted. Nothing was installed.',
        { values: { path: result.path } }
      )
    );
  }
  restoreFocus(anchor);
}

/** Opens the configured release notes page in the user's own browser. */
export async function openReleaseNotes(ctx: AppContext): Promise<void> {
  const url = updater.releaseNotesUrl();
  if (url === '') {
    ctx.notify.warn(
      ctx.t('updates.notify.openFailed.title', 'That address could not be opened'),
      ctx.t('updates.disabled.noNotes', 'No release notes address is configured.')
    );
    return;
  }
  const result = await ctx.studio.shell.openExternal(url);
  if (!result.ok) {
    ctx.notify.error(ctx.t('updates.notify.openFailed.title', 'That address could not be opened'), result.error);
  }
}

/** Reveals the staged payload in the platform file manager. */
export async function showStagedPackage(ctx: AppContext): Promise<void> {
  const staged = updater.state().staged;
  if (!staged) return;
  const result = await ctx.studio.shell.showItemInFolder(staged.packagePath);
  if (!result.ok) {
    ctx.notify.error(ctx.t('updates.notify.openFailed.title', 'That address could not be opened'), result.error);
  }
}
