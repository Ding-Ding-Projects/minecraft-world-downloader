import { el } from './a11y';
import { components } from './components';
import { history } from './history';
import { i18n } from './i18n';
import { overlay } from './overlay';
import { settings } from './settings';
import { generateSecret, hashPassword, otpauthUri, qrSvg, verifyPassword, verifyTotp } from './totp';
import type { LockMethod, LockRecord, LockService } from './types';

/**
 * Toy locks.
 *
 * It is just for fun, and every surface says so. This is a self-imposed speed
 * bump in exactly the sense the School-mode switch is: not security, not
 * encryption, and no protection at all from anyone else using this computer.
 * Deleting the application data folder clears every lock, and the path is shown
 * where somebody locked out will actually be looking.
 *
 * Each lock carries its OWN credential. There is no master password and no
 * implicit inheritance: unlocking one surface never unlocks another, and a
 * locked property inside a locked tab is two locks with two answers. A user who
 * wants one credential everywhere gets there by deliberately reusing it.
 */

const RECORDS_KEY = 'locks.records';

interface UnlockState {
  until: number;
  session: boolean;
}

function vaultAccount(target: string): string {
  return `lock:${target.replace(/[^A-Za-z0-9._:@-]/g, '_')}`;
}

class LockImpl implements LockService {
  private unlocked = new Map<string, UnlockState>();

  private records(): LockRecord[] {
    const stored = settings.get<LockRecord[]>(RECORDS_KEY, []);
    return Array.isArray(stored) ? stored : [];
  }

  private writeRecords(records: LockRecord[]): void {
    settings.set(RECORDS_KEY, records);
  }

  list(): LockRecord[] {
    return this.records();
  }

  isLocked(target: string): boolean {
    return this.records().some((record) => record.target === target);
  }

  isUnlocked(target: string): boolean {
    if (!this.isLocked(target)) return true;
    const state = this.unlocked.get(target);
    if (!state) return false;
    if (state.session) return true;
    return state.until > Date.now();
  }

  lockAll(): void {
    this.unlocked.clear();
  }

  recoveryPath(): string {
    return window.studio.info.userDataDir;
  }

  async remove(target: string): Promise<void> {
    this.writeRecords(this.records().filter((record) => record.target !== target));
    await window.studio.vault.delete(vaultAccount(target));
    this.unlocked.delete(target);
    await history.record('Removed a lock', 'core.locks', { target });
  }

  /**
   * The per-element lock wizard.
   *
   * It opens anchored beside the exact element, names that element, creates that
   * element's own credential, and returns focus to the element on completion or
   * cancellation.
   */
  wizard(element: HTMLElement, target: string, labelText: string): void {
    const handle = overlay.open({
      anchor: element,
      placement: 'bottom-start',
      role: 'dialog',
      label: i18n.t('core.lock.wizardTitle', 'Lock {label}', { values: { label: labelText } })
    });
    const body = handle.body;

    body.append(
      el('h2', {
        className: 'md-typescale-title-medium',
        text: i18n.t('core.lock.wizardTitle', 'Lock {label}', { values: { label: labelText }, dialog: true })
      }),
      el('p', { className: 'md-appearance__target md-typescale-body-small', text: target })
    );

    let method: LockMethod = 'password';
    let minutes = 15;
    let secret = generateSecret();

    const methodPicker = components.segmentedButton({
      label: 'core.lock.method',
      options: [
        { value: 'password', label: 'core.lock.method.password' },
        { value: 'totp', label: 'core.lock.method.totp' }
      ],
      value: method,
      onChange: (value) => {
        method = value === 'totp' ? 'totp' : 'password';
        drawMethod();
      }
    });

    const methodHost = el('div', { className: 'md-appearance__group' });

    const passwordField = components.textField({
      label: 'A password for this element',
      type: 'password',
      supportingText: 'Only a verifier is stored, never the password itself.'
    });

    const drawMethod = (): void => {
      methodHost.textContent = '';
      if (method === 'password') {
        methodHost.append(passwordField.root);
        return;
      }
      const uri = otpauthUri({
        secret,
        algorithm: 'SHA-1',
        digits: 6,
        period: 30,
        issuer: window.studio.info.productName,
        account: labelText
      });
      const qr = qrSvg(uri, 4);
      qr.setAttribute('aria-label', `Pairing code for ${labelText}. The secret is also shown as text below.`);
      methodHost.append(qr);
      methodHost.append(
        el('p', { className: 'md-typescale-body-small', text: 'Scan this, or type the secret into your authenticator:' })
      );
      const secretField = components.textField({
        label: 'Secret (base32), SHA-1, 6 digits, 30 seconds',
        value: secret.replace(/(.{4})/g, '$1 ').trim(),
        supportingText: 'A QR is useless to somebody pairing on this same machine, so the text is always here too.'
      });
      const regenerate = components.button({
        label: 'Generate a different secret',
        variant: 'text',
        onClick: () => {
          secret = generateSecret();
          drawMethod();
        }
      });
      const confirmField = components.textField({
        label: 'Type a current code to confirm the pairing',
        id: 'md-lock-confirm-code',
        supportingText: 'Without this step a mis-scanned secret locks you out of something you just set up.'
      });
      methodHost.append(secretField.root, regenerate, confirmField.root);
    };

    drawMethod();

    const duration = components.select({
      label: 'core.lock.duration',
      value: '15',
      options: [
        { value: '0', label: 'core.lock.duration.surface' },
        { value: '5', label: '5 minutes' },
        { value: '15', label: '15 minutes' },
        { value: '60', label: '60 minutes' },
        { value: '-1', label: 'core.lock.duration.session' }
      ],
      onChange: (value) => {
        minutes = Number(value);
      }
    });

    const warning = el('p', {
      className: 'md-field__support md-typescale-body-small',
      text: i18n.t('core.lock.toyWarning', 'This is just for fun.', {
        values: { path: this.recoveryPath() }
      })
    });

    const status = el('p', { className: 'md-field__support md-typescale-body-small', attrs: { role: 'status' } });

    const actions = el('div', { className: 'md-confirm__actions' });
    actions.append(
      components.button({ label: 'core.action.cancel', variant: 'text', onClick: () => handle.close() }),
      components.button({
        label: 'core.lock.command',
        variant: 'filled',
        icon: 'lock',
        onClick: async () => {
          if (method === 'password') {
            const password = passwordField.get();
            if (password.length < 4) {
              status.textContent = 'Enter at least four characters. Nothing was locked.';
              return;
            }
            const verifier = await hashPassword(password);
            const stored = await window.studio.vault.set(vaultAccount(target), `password:${verifier}`);
            if (!stored.ok) {
              status.textContent = `The credential could not be stored: ${stored.error}. Nothing was locked.`;
              return;
            }
          } else {
            const codeField = methodHost.querySelector<HTMLInputElement>('#md-lock-confirm-code');
            const code = codeField?.value ?? '';
            const paired = await verifyTotp({ secret, algorithm: 'SHA-1', digits: 6, period: 30 }, code);
            if (!paired) {
              status.textContent = 'That code did not match, so the pairing was not completed and nothing was locked.';
              return;
            }
            const stored = await window.studio.vault.set(vaultAccount(target), `totp:${secret}`);
            if (!stored.ok) {
              status.textContent = `The credential could not be stored: ${stored.error}. Nothing was locked.`;
              return;
            }
          }
          const records = this.records().filter((record) => record.target !== target);
          records.push({
            target,
            label: labelText,
            method,
            createdAt: new Date().toISOString(),
            unlockMinutes: minutes
          });
          this.writeRecords(records);
          // The configuration change is recorded; the credential never is.
          await history.record('Created a lock', 'core.locks', { target, label: labelText, method });
          handle.close();
        }
      })
    );

    body.append(methodPicker.root, methodHost, duration.root, warning, status, actions);
    handle.reposition();
  }

  /** The anchored unlock prompt. */
  unlock(target: string, anchor: HTMLElement): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const record = this.records().find((candidate) => candidate.target === target);
      if (!record) {
        resolve(true);
        return;
      }
      let settled = false;
      const handle = overlay.open({
        anchor,
        placement: 'bottom-start',
        role: 'dialog',
        label: i18n.t('core.lock.unlockTitle', 'Unlock {label}', { values: { label: record.label } }),
        onClose: () => {
          if (!settled) {
            settled = true;
            resolve(false);
          }
        }
      });

      const body = handle.body;
      body.append(
        el('h2', {
          className: 'md-typescale-title-medium',
          text: i18n.t('core.lock.unlockTitle', 'Unlock {label}', { values: { label: record.label }, dialog: true })
        })
      );

      const field = components.textField({
        label: record.method === 'password' ? 'Password' : 'Current code from your authenticator',
        type: record.method === 'password' ? 'password' : 'text'
      });
      const status = el('p', { className: 'md-field__support md-typescale-body-small', attrs: { role: 'status' } });

      let attempts = 0;
      const attempt = async (): Promise<void> => {
        attempts += 1;
        if (attempts > 5) {
          // Rate limited, honestly: it never wipes content and never escalates.
          status.textContent = 'Too many attempts in a row. Wait a moment and try again.';
          window.setTimeout(() => {
            attempts = 0;
            status.textContent = '';
          }, 10_000);
          return;
        }
        const stored = await window.studio.vault.get(vaultAccount(target));
        if (!stored.ok || !stored.value) {
          status.textContent = `The stored credential could not be read. Delete ${this.recoveryPath()} to reset every lock.`;
          return;
        }
        const [kind, ...rest] = stored.value.split(':');
        const payload = rest.join(':');
        const matched =
          kind === 'password'
            ? await verifyPassword(field.get(), payload)
            : await verifyTotp({ secret: payload, algorithm: 'SHA-1', digits: 6, period: 30 }, field.get());
        if (!matched) {
          status.textContent = i18n.t('core.lock.wrong', 'That did not match.');
          return;
        }
        this.unlocked.set(target, {
          until: record.unlockMinutes > 0 ? Date.now() + record.unlockMinutes * 60_000 : 0,
          session: record.unlockMinutes === -1
        });
        settled = true;
        resolve(true);
        handle.close();
      };

      field.root.querySelector('input')?.addEventListener('keydown', (event) => {
        if ((event as KeyboardEvent).key === 'Enter') void attempt();
      });

      const forgot = components.button({
        label: 'core.lock.forgot',
        variant: 'text',
        onClick: () => openSupportTickets(anchor, this.recoveryPath())
      });

      const actions = el('div', { className: 'md-confirm__actions' });
      actions.append(
        forgot,
        components.button({
          label: 'core.action.confirm',
          variant: 'filled',
          onClick: () => void attempt()
        })
      );

      body.append(
        field.root,
        status,
        el('p', {
          className: 'md-field__support md-typescale-body-small',
          text: i18n.t('core.lock.toyWarning', 'This is just for fun.', { values: { path: this.recoveryPath() } })
        }),
        actions
      );
      handle.reposition();
      window.requestAnimationFrame(() => field.focus());
    });
  }
}

export const locks = new LockImpl();

/**
 * Support Tickets: the recovery route, dressed as a service desk.
 *
 * The joke is the point, and so is the plain line underneath it. Nothing is sent
 * anywhere, no ticket exists outside this machine, no network request is made,
 * nobody is reading it — and the "resolution" does the only thing that actually
 * works, which is to open the application data folder so the user can delete it
 * themselves. The application never deletes it for them.
 */
export function openSupportTickets(anchor: HTMLElement, folder: string): void {
  const handle = overlay.open({
    anchor,
    placement: 'bottom-start',
    role: 'dialog',
    label: 'Support Tickets'
  });
  const body = handle.body;
  const ticketNumber = `WDS-${String(Math.floor(Math.random() * 900_000) + 100_000)}`;

  body.append(
    el('h2', { className: 'md-typescale-title-medium', text: 'Support Tickets' }),
    el('p', {
      className: 'md-typescale-body-medium',
      text: `Ticket ${ticketNumber} — Priority: Highest. Status: Escalated to Tier 3. Assigned to: the folder below.`
    })
  );

  const category = components.select({
    label: 'Category',
    options: [
      { value: 'lockout', label: 'I have locked myself out' },
      { value: 'forgot', label: 'I forgot the code' },
      { value: 'authenticator', label: 'My authenticator is on a phone I no longer own' },
      { value: 'other', label: 'Something else entirely' }
    ]
  });
  const description = components.textField({
    label: 'Describe the issue',
    multiline: true,
    rows: 3,
    placeholder: 'Write whatever you like. Genuinely, nobody will read it.'
  });

  const disclosure = el('p', {
    className: 'md-typescale-body-medium',
    // Deliberately outside the joke and unstyled by the humour setting.
    text:
      'Nothing here is sent anywhere. No ticket exists outside this machine, no network request is made, no data is collected, and nobody is reading it. This is the application talking to itself.'
  });
  disclosure.style.fontWeight = '600';

  const pathField = components.textField({
    label: 'Application data folder',
    value: folder,
    supportingText: 'Deleting this folder clears every lock, and everything else stored locally with them.'
  });

  const resolution = components.button({
    label: 'Open that folder',
    variant: 'filled',
    icon: 'folder',
    onClick: () => {
      void window.studio.shell.openPath(folder).then((result) => {
        if (!result.ok) {
          body.append(
            el('p', {
              className: 'md-field__support--error md-typescale-body-small',
              text: `The file manager could not be opened: ${result.error}. The folder is ${folder}.`
            })
          );
        }
      });
    }
  });

  const copyPath = components.button({
    label: 'core.action.copy',
    variant: 'text',
    onClick: () => void navigator.clipboard.writeText(folder)
  });

  const actions = el('div', { className: 'md-confirm__actions' });
  actions.append(copyPath, resolution);

  body.append(category.root, description.root, disclosure, pathField.root, actions);
  handle.reposition();
}

/** Wires the "Lock this element…" command raised by the element context menu. */
export function installLockCommands(): void {
  window.addEventListener('studio:lock-element', (event) => {
    const detail = (event as CustomEvent<{ target: HTMLElement; selector: string }>).detail;
    if (!detail?.target) return;
    const label = detail.target.getAttribute('aria-label') ?? detail.target.textContent?.trim().slice(0, 60) ?? detail.selector;
    locks.wizard(detail.target, detail.selector, label || detail.selector);
  });
}
