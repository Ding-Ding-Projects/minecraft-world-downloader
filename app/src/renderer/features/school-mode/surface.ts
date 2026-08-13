import {
  FUNNY_EN_ID,
  FUNNY_YUE_ID,
  LANGUAGE_MODE_ID,
  VOCABULARY_LOADED_ID
} from '../../core/i18n';
import { generateSecret, otpauthUri, qrSvg, verifyTotp } from '../../core/totp';
import type { AppContext, ExportFormat } from '../../core/registry';
import { createBulkList, type BulkListHandle, type BulkRow } from './bulklist';
import {
  MIN_PASSWORD_LENGTH,
  TOTP_PARAMETERS,
  storePassword,
  storeTotpSecret
} from './credential';
import { SchoolModeController, type SchoolModeState } from './controller';
import { bilingual, dialogCopy, el, formatTime, uniqueId } from './dom';
import { SHIPPED_MODE_NAME } from './shared-record';

/**
 * Everything the user sees.
 *
 * The same builders serve the settings surface and the feature's own tab, so the
 * switch in one and the switch in the other are literally the same code driving
 * the same record. Two routes to one value can never disagree about what that
 * value is, because there is only one route underneath both of them.
 */

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

export function renderStatePanel(
  ctx: AppContext,
  controller: SchoolModeController,
  host: HTMLElement,
  options: { switchId?: string } = {}
): () => void {
  // Two copies of this panel can be on screen at once — the feature's own tab and
  // a live control inside a palette row — so only the copy that asked for the
  // stable id gets it. Two elements sharing an id would give the palette's
  // teleport an ambiguous target and break the label association of both.
  const switchId = options.switchId ?? uniqueId('school-mode-switch');
  const root = el('div', {
    className: 'school-mode__panel',
    attrs: { 'data-appearance-id': 'school-mode:state' }
  });
  host.append(root);

  const draw = (state: SchoolModeState): void => {
    root.textContent = '';

    /* ---- the switch itself ---- */

    const row = el('div', { className: 'school-mode__state-row' });
    const badge = ctx.components.badge({
      label: state.enabled
        ? ctx.t('schoolMode.state.on', 'On')
        : ctx.t('schoolMode.state.off', 'Off'),
      severity: state.enabled ? 'success' : 'info'
    });

    const toggle = ctx.components.switchControl({
      label: 'schoolMode.state.switchLabel',
      checked: state.enabled,
      id: switchId,
      onChange: (checked) => {
        // The authority is the record, so the control is put back to whatever
        // the record says as soon as the route resolves — including when the
        // user cancelled the unlock prompt and nothing changed at all.
        const anchor = toggle.root;
        const settle = (): void => toggle.set(controller.state().enabled);
        if (checked) void controller.requestEnable(anchor).then(settle);
        else void controller.requestDisable(anchor).then(settle);
      }
    });

    row.append(toggle.root, badge);
    root.append(row);

    root.append(
      bilingual(
        ctx,
        state.enabled ? 'schoolMode.state.isOn' : 'schoolMode.state.isOff',
        state.enabled ? `${state.name} is on` : `${state.name} is off`,
        undefined,
        'md-typescale-title-small'
      )
    );

    /* ---- where the value actually comes from ---- */

    const authority = el('p', {
      className: `school-mode__authority md-typescale-body-small${
        state.authority === 'shared' ? '' : ' school-mode__warning'
      }`,
      text:
        state.authority === 'shared'
          ? ctx.t(
              'schoolMode.shared.authority.shared',
              'Read from the shared record. Every application in the suite sees the same value.'
            )
          : ctx.t(
              'schoolMode.shared.authority.mirror',
              'The shared record cannot be used right now, so this application is showing its own local copy only. Other applications may be in a different state until the record is readable again.'
            )
    });
    root.append(authority);

    root.append(
      el('p', {
        className: 'school-mode__path md-typescale-body-small',
        text: ctx.t('schoolMode.shared.pathLine', 'Shared record: {path}', { values: { path: state.recordPath } })
      })
    );

    if (state.readState === 'missing') {
      root.append(
        el('p', {
          className: 'md-typescale-body-small',
          text: ctx.t(
            'schoolMode.shared.missing',
            'No shared record exists yet at {path}. This application will create it the first time the mode changes.',
            { values: { path: state.recordPath } }
          )
        })
      );
    }
    if (state.readState === 'unreadable' && state.readError) {
      root.append(
        el('p', {
          className: 'school-mode__warning md-typescale-body-small',
          text: ctx.t('schoolMode.shared.unreadable', 'The shared record at {path} could not be read: {error}', {
            values: { path: state.recordPath, error: state.readError }
          })
        })
      );
    }
    if (state.readState === 'invalid' && state.readError) {
      root.append(
        el('p', {
          className: 'school-mode__warning md-typescale-body-small',
          text: ctx.t(
            'schoolMode.shared.invalid',
            'The shared record at {path} was refused: {error} Nothing from it was applied.',
            { values: { path: state.recordPath, error: state.readError } }
          )
        })
      );
    }
    if (state.writeError) {
      root.append(
        el('p', {
          className: 'school-mode__warning md-typescale-body-small',
          text: ctx.t(
            'schoolMode.shared.writeFailed',
            'The shared record at {path} could not be written: {error} The change stayed local to this application.',
            { values: { path: state.recordPath, error: state.writeError } }
          )
        })
      );
    }
    if (state.record) {
      root.append(
        el('p', {
          className: 'md-typescale-body-small',
          text: ctx.t('schoolMode.shared.lastWritten', 'Last written at {time} by {app}', {
            values: { time: formatTime(state.record.updatedAt), app: state.record.updatedBy }
          })
        })
      );
    }

    /* ---- watching ---- */

    root.append(
      el('p', {
        className: `school-mode__watch md-typescale-body-small${state.watching ? '' : ' school-mode__warning'}`,
        attrs: { role: 'status' },
        text: state.watching
          ? ctx.t(
              'schoolMode.watch.watching',
              'Watching the shared record every {seconds} seconds, and on every window focus.',
              { values: { seconds: Math.round(state.intervalMs / 1000) } }
            )
          : ctx.t('schoolMode.watch.stopped', 'The shared record is not being watched: {error}', {
              values: { error: state.watchError ?? 'the watch could not be started' }
            })
      })
    );
    if (state.lastReadAt) {
      root.append(
        el('p', {
          className: 'md-typescale-label-medium',
          text: ctx.t('schoolMode.shared.lastRead', 'Last read at {time}', {
            values: { time: formatTime(state.lastReadAt) }
          })
        })
      );
    }

    /* ---- the honest disclosure and the way back ---- */

    root.append(
      el('p', {
        className: 'school-mode__toy md-typescale-body-small',
        text: ctx.t(
          'schoolMode.toy.warning',
          'This is a user-experience lock, not a security boundary. It is not encryption, it protects nothing from anybody else using this computer, and anyone who can reach the disk can undo it. Deleting the shared record folder at {path} resets the mode completely.',
          { values: { path: state.recordFolder } }
        )
      })
    );

    const actions = el('div', { className: 'school-mode__actions' });
    actions.append(
      ctx.components.button({
        label: ctx.t('schoolMode.watch.refresh', 'Re-read the shared record now'),
        variant: 'outlined',
        icon: 'refresh',
        onClick: () => void controller.refreshNow()
      }),
      ctx.components.button({
        label: ctx.t('schoolMode.shared.reveal', 'Open the shared folder'),
        variant: 'text',
        icon: 'folder',
        onClick: () => void revealFolder(ctx, state.recordFolder)
      })
    );
    root.append(actions);

    ctx.appearance.applyTo(root, 'school-mode:state');
  };

  draw(controller.state());
  return controller.onChange(draw);
}

export async function revealFolder(ctx: AppContext, folder: string): Promise<void> {
  if (folder === '') return;
  const ensured = await ctx.studio.fs.ensureDirectory(folder);
  if (!ensured.ok) {
    ctx.notify.error(
      dialogCopy(ctx, ctx.t('schoolMode.shared.reveal', 'Open the shared folder'), '⚠️'),
      ctx.t('schoolMode.shared.revealFailed', 'The shared folder could not be opened: {error}', {
        values: { error: ensured.error }
      })
    );
    return;
  }
  const opened = await ctx.studio.shell.openPath(folder);
  if (!opened.ok) {
    ctx.notify.error(
      dialogCopy(ctx, ctx.t('schoolMode.shared.reveal', 'Open the shared folder'), '⚠️'),
      ctx.t('schoolMode.shared.revealFailed', 'The shared folder could not be opened: {error}', {
        values: { error: opened.error }
      })
    );
  }
}

/* ------------------------------------------------------------------ */
/* Name                                                                */
/* ------------------------------------------------------------------ */

export function renderNamePanel(
  ctx: AppContext,
  controller: SchoolModeController,
  host: HTMLElement,
  options: { fieldId?: string } = {}
): () => void {
  const fieldId = options.fieldId ?? uniqueId('school-mode-name');
  const root = el('div', {
    className: 'school-mode__panel',
    attrs: { 'data-appearance-id': 'school-mode:name' }
  });
  host.append(root);

  const draw = (state: SchoolModeState): void => {
    root.textContent = '';
    const field = ctx.components.textField({
      label: 'schoolMode.name.label',
      value: state.name,
      variant: 'outlined',
      supportingText: 'schoolMode.name.description',
      id: fieldId
    });
    const feedback = el('p', {
      className: 'school-mode__feedback md-typescale-body-small',
      attrs: { role: 'status', 'aria-live': 'polite' }
    });

    const apply = async (): Promise<void> => {
      const result = await controller.rename(field.get());
      feedback.textContent = result.ok ? '' : result.error;
      if (!result.ok) ctx.a11y.announce(result.error, true);
    };

    const actions = el('div', { className: 'school-mode__actions' });
    actions.append(
      ctx.components.button({
        label: ctx.t('schoolMode.name.apply', 'Apply this name'),
        variant: 'filled',
        onClick: () => void apply()
      })
    );
    // The shipped name is offered as a route back, never as text: once the user
    // has chosen their own name, no surface may print the original one.
    if (state.name !== SHIPPED_MODE_NAME) {
      actions.append(
        ctx.components.button({
          label: ctx.t('schoolMode.name.useOriginal', 'Use the original name'),
          variant: 'text',
          onClick: () => void controller.useShippedName()
        })
      );
    }

    root.append(field.root, actions, feedback);
    ctx.appearance.applyTo(root, 'school-mode:name');
  };

  draw(controller.state());
  return controller.onChange(draw);
}

/* ------------------------------------------------------------------ */
/* Unlock code                                                         */
/* ------------------------------------------------------------------ */

export function renderCredentialPanel(
  ctx: AppContext,
  controller: SchoolModeController,
  host: HTMLElement
): () => void {
  const root = el('div', {
    className: 'school-mode__panel',
    attrs: { 'data-appearance-id': 'school-mode:credential' }
  });
  host.append(root);

  const draw = (state: SchoolModeState): void => {
    root.textContent = '';
    const credential = state.credential;

    root.append(
      el('p', {
        className: 'md-typescale-body-medium',
        text:
          credential.method === 'password'
            ? ctx.t(
                'schoolMode.credential.password',
                'A password or PIN is set. It is checked against a stored verifier, never against a stored code.'
              )
            : credential.method === 'totp'
              ? ctx.t(
                  'schoolMode.credential.totp',
                  'An authenticator is paired. A current six-digit code from it turns the mode off.'
                )
              : ctx.t(
                  'schoolMode.credential.none',
                  'No unlock code is set. Without one, the only way back is deleting the shared record folder.'
                )
      })
    );

    if (!credential.vaultAvailable) {
      root.append(
        el('p', {
          className: 'school-mode__warning md-typescale-body-small',
          text: ctx.t(
            'schoolMode.credential.vaultUnavailable',
            'This computer’s credential vault is not usable: {error} An unlock code cannot be stored until that is fixed.',
            { values: { error: credential.error ?? 'the operating system did not offer an encryption backend' } }
          )
        })
      );
    }
    root.append(
      el('p', {
        className: 'md-typescale-label-medium',
        text: ctx.t('schoolMode.credential.backend', 'Vault backend: {backend}', {
          values: { backend: credential.backend }
        })
      })
    );

    const actions = el('div', { className: 'school-mode__actions' });
    const setPassword = ctx.components.button({
      label: ctx.t('schoolMode.credential.setPassword', 'Set a password or PIN…'),
      variant: 'tonal',
      icon: 'key',
      disabled: !credential.vaultAvailable,
      disabledReason: ctx.t(
        'schoolMode.credential.vaultUnavailable',
        'This computer’s credential vault is not usable: {error} An unlock code cannot be stored until that is fixed.',
        { values: { error: credential.error ?? 'no encryption backend' } }
      ),
      onClick: () => void openPasswordEditor(ctx, controller, setPassword)
    });
    const pair = ctx.components.button({
      label: ctx.t('schoolMode.credential.setTotp', 'Pair an authenticator…'),
      variant: 'tonal',
      icon: 'lock',
      disabled: !credential.vaultAvailable,
      disabledReason: ctx.t(
        'schoolMode.credential.vaultUnavailable',
        'This computer’s credential vault is not usable: {error} An unlock code cannot be stored until that is fixed.',
        { values: { error: credential.error ?? 'no encryption backend' } }
      ),
      onClick: () => void openPairingEditor(ctx, controller, pair)
    });
    const remove = ctx.components.button({
      label: ctx.t('schoolMode.credential.remove', 'Remove the unlock code'),
      variant: 'outlined',
      danger: true,
      icon: 'trash',
      disabled: credential.method === 'none',
      disabledReason: ctx.t(
        'schoolMode.credential.none',
        'No unlock code is set. Without one, the only way back is deleting the shared record folder.'
      ),
      onClick: () => void removeCode(ctx, controller, remove)
    });

    actions.append(setPassword, pair, remove);
    root.append(actions);
    ctx.appearance.applyTo(root, 'school-mode:credential');
  };

  draw(controller.state());
  return controller.onChange(draw);
}

async function removeCode(
  ctx: AppContext,
  controller: SchoolModeController,
  anchor: HTMLElement
): Promise<void> {
  const confirmed = await ctx.confirm.request({
    action: ctx.t('schoolMode.remove.action', 'Remove the unlock code'),
    affected: [ctx.t('schoolMode.remove.affected', 'The unlock code for {name}', { values: { name: controller.state().name } })],
    irreversible: ctx.t(
      'schoolMode.remove.irreversible',
      'The stored verifier is deleted from this computer’s credential vault. It cannot be recovered, and a new code has to be set from scratch.'
    ),
    anchor
  });
  if (!confirmed) return;
  const removed = await controller.removeCredential();
  if (!removed.ok) {
    ctx.notify.error(
      dialogCopy(ctx, ctx.t('schoolMode.credential.remove', 'Remove the unlock code'), '⚠️'),
      removed.error
    );
    return;
  }
  ctx.notify.success(
    dialogCopy(ctx, ctx.t('schoolMode.credential.remove', 'Remove the unlock code'), '✅'),
    ctx.t('schoolMode.credential.removed', 'The unlock code is gone. The mode can now be turned off without one.')
  );
}

function openPasswordEditor(ctx: AppContext, controller: SchoolModeController, anchor: HTMLElement): void {
  let release: (() => void) | null = null;
  const handle = ctx.overlay.open({
    anchor,
    role: 'dialog',
    label: ctx.t('schoolMode.credential.setPassword', 'Set a password or PIN…'),
    lightDismiss: false,
    onClose: () => {
      release?.();
      ctx.a11y.focusVisible(anchor);
    }
  });

  const first = ctx.components.textField({
    label: 'schoolMode.credential.newLabel',
    type: 'password',
    variant: 'outlined'
  });
  const second = ctx.components.textField({
    label: 'schoolMode.credential.repeatLabel',
    type: 'password',
    variant: 'outlined'
  });
  const feedback = el('p', {
    className: 'school-mode__feedback md-typescale-body-small',
    attrs: { role: 'status', 'aria-live': 'polite' }
  });

  const save = async (): Promise<void> => {
    const code = first.get();
    if (code.length < MIN_PASSWORD_LENGTH) {
      feedback.textContent = ctx.t(
        'schoolMode.credential.tooShort',
        'A code needs at least {min} characters. Nothing was stored.',
        { values: { min: MIN_PASSWORD_LENGTH } }
      );
      return;
    }
    if (code !== second.get()) {
      feedback.textContent = ctx.t('schoolMode.credential.mismatch', 'The two entries are different. Nothing was stored.');
      return;
    }
    const stored = await storePassword(ctx.studio, code);
    // The code is dropped here and nowhere else holds it.
    first.set('');
    second.set('');
    if (!stored.ok) {
      feedback.textContent = ctx.t('schoolMode.credential.storeFailed', 'The unlock code was not stored: {error}', {
        values: { error: stored.error }
      });
      return;
    }
    await controller.credentialStored('password');
    ctx.notify.success(
      dialogCopy(ctx, ctx.t('schoolMode.credential.label', 'Unlock code'), '✅'),
      ctx.t('schoolMode.credential.stored', 'The unlock code is stored. The code itself was not written anywhere.')
    );
    handle.close();
  };

  const actions = el('div', { className: 'school-mode__dialog-actions' });
  actions.append(
    ctx.components.button({
      label: ctx.t('core.action.cancel', 'Cancel'),
      variant: 'text',
      onClick: () => handle.close()
    }),
    ctx.components.button({
      label: ctx.t('core.action.save', 'Save'),
      variant: 'filled',
      onClick: () => void save()
    })
  );

  handle.body.append(
    el('h2', {
      className: 'md-typescale-title-medium',
      text: ctx.t('schoolMode.credential.setPassword', 'Set a password or PIN…')
    }),
    first.root,
    second.root,
    feedback,
    actions
  );
  release = ctx.a11y.trapFocus(handle.root);
  window.setTimeout(() => first.focus(), 0);
}

/**
 * Authenticator pairing.
 *
 * The QR is drawn in this process from the local secret, never fetched from a
 * chart service, because a remote generator would receive the secret on its way
 * to being rendered. The secret is also shown as text, because a QR is useless
 * to somebody who cannot see it and useless again to somebody pairing an
 * authenticator on the very device displaying it. Nothing is stored until a
 * current code proves the pairing actually worked.
 */
function openPairingEditor(ctx: AppContext, controller: SchoolModeController, anchor: HTMLElement): void {
  const secret = generateSecret();
  const state = controller.state();
  const uri = otpauthUri({
    secret,
    issuer: ctx.studio.info.productName,
    account: state.name,
    ...TOTP_PARAMETERS
  });

  let release: (() => void) | null = null;
  const handle = ctx.overlay.open({
    anchor,
    role: 'dialog',
    label: ctx.t('schoolMode.credential.pairTitle', 'Pair an authenticator'),
    lightDismiss: false,
    onClose: () => {
      release?.();
      ctx.a11y.focusVisible(anchor);
    }
  });

  const qrWrap = el('div', { className: 'school-mode__qr' });
  try {
    const svg = qrSvg(uri, 4);
    svg.setAttribute('role', 'img');
    svg.setAttribute(
      'aria-label',
      ctx.t('schoolMode.credential.pairQrAlt', 'Pairing code for {name} on this computer, SHA-1, 6 digits, 30 second period.', {
        values: { name: state.name }
      })
    );
    qrWrap.append(svg);
  } catch (error) {
    qrWrap.append(
      el('p', {
        className: 'school-mode__warning md-typescale-body-small',
        text: error instanceof Error ? error.message : String(error)
      })
    );
  }

  const secretId = uniqueId('school-mode-secret');
  const secretText = el('code', {
    className: 'school-mode__secret',
    text: '••••••••',
    attrs: { id: secretId }
  });
  let revealed = false;
  const revealButton = ctx.components.button({
    label: ctx.t('schoolMode.credential.reveal', 'Show the secret'),
    variant: 'text',
    icon: 'visibility',
    onClick: () => {
      revealed = !revealed;
      secretText.textContent = revealed ? secret.replace(/(.{4})/g, '$1 ').trim() : '••••••••';
      const labelNode = revealButton.querySelector('.md-btn__label');
      if (labelNode) {
        labelNode.textContent = revealed
          ? ctx.t('schoolMode.credential.hide', 'Hide the secret')
          : ctx.t('schoolMode.credential.reveal', 'Show the secret');
      }
    }
  });

  const code = ctx.components.textField({
    label: 'schoolMode.credential.pairConfirm',
    variant: 'outlined'
  });
  const feedback = el('p', {
    className: 'school-mode__feedback md-typescale-body-small',
    attrs: { role: 'status', 'aria-live': 'polite' }
  });

  const finish = async (): Promise<void> => {
    const candidate = code.get().trim();
    const matched = candidate === '' ? false : await verifyTotp({ secret, ...TOTP_PARAMETERS }, candidate);
    if (!matched) {
      feedback.textContent = ctx.t(
        'schoolMode.credential.pairWrong',
        'That code did not match. Nothing was paired, and the previous unlock code is untouched.'
      );
      return;
    }
    const stored = await storeTotpSecret(ctx.studio, secret);
    if (!stored.ok) {
      feedback.textContent = ctx.t('schoolMode.credential.storeFailed', 'The unlock code was not stored: {error}', {
        values: { error: stored.error }
      });
      return;
    }
    await controller.credentialStored('totp');
    ctx.notify.success(
      dialogCopy(ctx, ctx.t('schoolMode.credential.pairTitle', 'Pair an authenticator'), '✅'),
      ctx.t('schoolMode.credential.pairDone', 'Pairing complete.')
    );
    handle.close();
  };

  const actions = el('div', { className: 'school-mode__dialog-actions' });
  actions.append(
    ctx.components.button({
      label: ctx.t('core.action.cancel', 'Cancel'),
      variant: 'text',
      onClick: () => handle.close()
    }),
    ctx.components.button({
      label: ctx.t('core.action.save', 'Save'),
      variant: 'filled',
      onClick: () => void finish()
    })
  );

  handle.body.append(
    el('h2', {
      className: 'md-typescale-title-medium',
      text: ctx.t('schoolMode.credential.pairTitle', 'Pair an authenticator')
    }),
    el('p', {
      className: 'md-typescale-body-small',
      text: ctx.t('schoolMode.credential.pairScan', 'Scan this with your authenticator, or type the secret in by hand.')
    }),
    qrWrap,
    el('p', {
      className: 'md-typescale-label-medium',
      text: ctx.t('schoolMode.credential.pairSecret', 'Secret')
    }),
    secretText,
    revealButton,
    el('p', {
      className: 'md-typescale-label-medium',
      text: ctx.t('schoolMode.credential.pairParameters', 'SHA-1, 6 digits, 30 second period')
    }),
    code.root,
    feedback,
    actions
  );
  release = ctx.a11y.trapFocus(handle.root);
  window.setTimeout(() => code.focus(), 0);
}

/* ------------------------------------------------------------------ */
/* Capabilities                                                        */
/* ------------------------------------------------------------------ */

interface Capability {
  id: string;
  labelKey: string;
  fallback: string;
  storedChoice(ctx: AppContext): string;
}

const CAPABILITIES: Capability[] = [
  {
    id: 'cantonese',
    labelKey: 'schoolMode.capability.cantonese',
    fallback: 'Cantonese language mode',
    storedChoice: (ctx) => String(ctx.settings.get<string>(LANGUAGE_MODE_ID, 'en'))
  },
  {
    id: 'bilingual',
    labelKey: 'schoolMode.capability.bilingual',
    fallback: 'Bilingual language mode',
    storedChoice: (ctx) => String(ctx.settings.get<string>(LANGUAGE_MODE_ID, 'en'))
  },
  {
    id: 'funny',
    labelKey: 'schoolMode.capability.funny',
    fallback: 'Humour levels, both languages',
    storedChoice: (ctx) =>
      `English ${String(ctx.settings.get<number>(FUNNY_EN_ID, 3))}, Cantonese ${String(
        ctx.settings.get<number>(FUNNY_YUE_ID, 3)
      )}`
  },
  {
    id: 'vocabulary',
    labelKey: 'schoolMode.capability.vocabulary',
    fallback: 'Personal vocabulary file',
    storedChoice: (ctx) => (ctx.settings.get<boolean>(VOCABULARY_LOADED_ID, false) ? 'a file is loaded' : 'no file')
  },
  {
    id: 'dimsum',
    labelKey: 'schoolMode.capability.dimsum',
    fallback: 'The dim sum surprise at startup',
    storedChoice: () => 'always in the draw when the mode is off'
  }
];

export function renderCapabilityList(
  ctx: AppContext,
  controller: SchoolModeController,
  host: HTMLElement
): () => void {
  const rows = (): BulkRow[] => {
    const on = controller.state().enabled;
    return CAPABILITIES.map((capability) => {
      const name = ctx.t(capability.labelKey, capability.fallback);
      const status = on
        ? ctx.t('schoolMode.capability.hidden', 'Removed while the mode is on')
        : ctx.t('schoolMode.capability.available', 'Available');
      const stored = ctx.t('schoolMode.capability.stored', 'Your stored choice: {value}', {
        values: { value: capability.storedChoice(ctx) }
      });
      return {
        id: capability.id,
        primary: name,
        secondary: stored,
        meta: status,
        searchText: `${name} ${status} ${stored}`,
        record: {
          capability: capability.id,
          name,
          removedWhileOn: on,
          storedChoice: capability.storedChoice(ctx)
        }
      };
    });
  };

  const list = createBulkList({
    ctx,
    label: 'schoolMode.capability.title',
    searchLabel: 'schoolMode.capability.search',
    emptyTitle: 'schoolMode.capability.empty',
    rows,
    pageSize: 5,
    exportName: 'study-mode-capabilities',
    actions: [exportAction(ctx, 'study-mode-capabilities'), copyAction(ctx)]
  });

  host.append(list.root);
  const unsubscribe = controller.onChange(() => list.refresh());
  return () => {
    unsubscribe();
    list.destroy();
  };
}

/* ------------------------------------------------------------------ */
/* Activity                                                            */
/* ------------------------------------------------------------------ */

export function renderActivityList(
  ctx: AppContext,
  controller: SchoolModeController,
  host: HTMLElement
): () => void {
  let entries: BulkRow[] = [];
  let handle: BulkListHandle | null = null;

  const status = el('p', {
    className: 'school-mode__feedback md-typescale-body-small',
    attrs: { role: 'status', 'aria-live': 'polite' }
  });
  host.append(status);

  const load = async (): Promise<void> => {
    try {
      const activity = await controller.activity();
      entries = activity.map((item) => ({
        id: item.id,
        primary: item.action,
        secondary: item.detail,
        meta: formatTime(item.at),
        searchText: `${item.action} ${item.detail} ${item.at}`,
        record: { id: item.id, action: item.action, detail: item.detail, at: item.at }
      }));
      status.textContent = '';
    } catch (error) {
      entries = [];
      status.textContent = ctx.t('schoolMode.activity.loadFailed', 'The local version history could not be read: {error}', {
        values: { error: error instanceof Error ? error.message : String(error) }
      });
    }
    handle?.refresh();
  };

  handle = createBulkList({
    ctx,
    label: 'schoolMode.activity.title',
    searchLabel: 'schoolMode.activity.search',
    emptyTitle: 'schoolMode.activity.empty',
    rows: () => entries,
    exportName: 'study-mode-activity',
    actions: [
      exportAction(ctx, 'study-mode-activity'),
      copyAction(ctx),
      {
        id: 'prune',
        label: ctx.t('schoolMode.action.prune', 'Prune history older than the oldest selected…'),
        icon: 'trash',
        destructive: true,
        irreversible: ctx.t(
          'schoolMode.action.pruneIrreversible',
          'Pruned history entries are removed from the local history repository and cannot be brought back.'
        ),
        run: async (selected) => {
          const oldest = selected
            .map((row) => String(row.record.at ?? ''))
            .filter((value) => value !== '')
            .sort()[0];
          if (!oldest) return;
          try {
            const result = await ctx.history.prune(oldest);
            controller.invalidateActivity();
            await load();
            ctx.notify.success(
              dialogCopy(ctx, ctx.t('schoolMode.activity.title', 'Activity'), '🗂️'),
              ctx.t('schoolMode.action.pruned', '{count} history entries were removed.', {
                values: { count: result.removed }
              })
            );
          } catch (error) {
            ctx.notify.error(
              dialogCopy(ctx, ctx.t('schoolMode.activity.title', 'Activity'), '⚠️'),
              ctx.t('schoolMode.action.pruneFailed', 'Nothing was pruned: {error}', {
                values: { error: error instanceof Error ? error.message : String(error) }
              })
            );
          }
        }
      }
    ]
  });
  host.append(handle.root);

  void load();
  const unsubscribe = controller.onChange(() => {
    controller.invalidateActivity();
    void load();
  });

  return () => {
    unsubscribe();
    handle?.destroy();
  };
}

/* ------------------------------------------------------------------ */
/* Shared bulk actions                                                 */
/* ------------------------------------------------------------------ */

function exportAction(ctx: AppContext, name: string) {
  return {
    id: 'export',
    label: ctx.t('schoolMode.action.export', 'Export the selection…'),
    icon: 'download',
    run: async (rows: BulkRow[], anchor: HTMLElement) => {
      const format = await chooseFormat(ctx, anchor);
      if (!format) {
        ctx.notify.info(
          ctx.t('schoolMode.action.export', 'Export the selection…'),
          ctx.t('schoolMode.action.exportCancelled', 'The export was cancelled. Nothing was written.')
        );
        return;
      }
      const records = rows.map((row) => row.record);
      const preflight = ctx.exporter.preflight(records, format);
      if (preflight.losses.length > 0) {
        const proceed = await ctx.components.dialog({
          title: ctx.t('core.export.title', 'Export'),
          body: ctx.t(
            'core.export.losses',
            '{format} cannot carry every field. These would be flattened or dropped: {fields}',
            { values: { format, fields: preflight.losses.map((loss) => `${loss.field} (${loss.reason})`).join(', ') } }
          ),
          confirmLabel: ctx.t('core.action.export', 'Export')
        });
        if (!proceed) return;
      }
      const path = await ctx.exporter.save(records, format, {
        name,
        schemaVersion: '1',
        defaultFileName: `${name}.${format}`
      });
      if (!path) {
        ctx.notify.info(
          ctx.t('schoolMode.action.export', 'Export the selection…'),
          ctx.t('schoolMode.action.exportCancelled', 'The export was cancelled. Nothing was written.')
        );
        return;
      }
      ctx.notify.success(
        dialogCopy(ctx, ctx.t('core.export.title', 'Export'), '✅'),
        ctx.t('schoolMode.action.exported', 'Exported to {path}', { values: { path } })
      );
    }
  };
}

function copyAction(ctx: AppContext) {
  return {
    id: 'copy',
    label: ctx.t('schoolMode.action.copy', 'Copy the selection'),
    icon: 'copy',
    run: async (rows: BulkRow[]) => {
      const text = rows.map((row) => [row.primary, row.secondary, row.meta].filter(Boolean).join(' — ')).join('\n');
      try {
        await navigator.clipboard.writeText(text);
        ctx.notify.success(
          dialogCopy(ctx, ctx.t('schoolMode.action.copy', 'Copy the selection'), '✅'),
          ctx.t('schoolMode.action.copied', '{count} rows copied to the clipboard.', { values: { count: rows.length } })
        );
      } catch (error) {
        ctx.notify.error(
          dialogCopy(ctx, ctx.t('schoolMode.action.copy', 'Copy the selection'), '⚠️'),
          ctx.t('schoolMode.action.copyFailed', 'The clipboard refused the copy: {error}', {
            values: { error: error instanceof Error ? error.message : String(error) }
          })
        );
      }
    }
  };
}

/** A filtered menu of the formats the exporter genuinely offers. */
function chooseFormat(ctx: AppContext, anchor: HTMLElement): Promise<ExportFormat | null> {
  return new Promise<ExportFormat | null>((resolve) => {
    let settled = false;
    const done = (value: ExportFormat | null): void => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    ctx.components.menu({
      anchor,
      label: ctx.t('schoolMode.action.exportFormat', 'Choose an export format'),
      items: ctx.exporter.formats().map((format) => ({
        id: format,
        label: format.toUpperCase(),
        run: () => done(format)
      })),
      onClose: () => done(null)
    });
  });
}
