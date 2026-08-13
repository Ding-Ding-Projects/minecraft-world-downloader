import { el } from '../../core/a11y';
import type { AppContext, HistoryEntry, TabContext } from '../../core/registry';
import { generateSecret, otpauthUri, qrSvg } from '../../core/totp';
import type { FeatureState } from './state';
import { recordEntry, redactRecords } from './state';
import type { ProtectedPayload } from './protected';
import { describeError, formatCount, formatTimestamp, safeJson } from './util';

/**
 * The protected mutation log.
 *
 * It starts locked on every launch, whatever the unlock duration is set to, and
 * it has its own credential: nothing else in the application opens it, and it
 * opens nothing else. A wrong attempt says so, names how many attempts remain,
 * and states the recovery route — a locked-out user deletes the application data
 * folder, which resets this credential along with every other stored preference.
 */

const MAX_RENDERED = 500;
const MIN_PASSWORD_LENGTH = 8;

export function mountProtectedPanel(host: HTMLElement, ctx: TabContext, state: FeatureState): void {
  const log = state.protectedLog;

  const lockButton = ctx.components.button({
    label: 'history.protected.lock',
    variant: 'text',
    icon: 'lock',
    onClick: () => {
      log.lock();
      void draw();
    }
  });
  const verifyButton = ctx.components.button({
    label: 'history.protected.verify',
    variant: 'text',
    icon: 'check',
    onClick: () => void runVerification()
  });
  const credentialButton = ctx.components.button({
    label: 'history.protected.replaceFactor',
    variant: 'text',
    icon: 'key',
    onClick: (event) => openFactorWizard(ctx, state, event.currentTarget as HTMLElement, () => void draw())
  });

  host.append(
    ctx.components.topAppBar({
      title: 'history.protected.title',
      subtitle: 'history.protected.subtitle',
      actions: [verifyButton, credentialButton, lockButton]
    })
  );

  const body = el('div', { className: 'history-protected', attrs: { id: 'history-protected' } });
  host.append(body);

  const selection = new Set<string>();
  let entries: HistoryEntry[] = [];
  let visible: HistoryEntry[] = [];

  const search = ctx.createSearchBar({
    label: 'history.search.label',
    placeholder: 'history.search.placeholder',
    onChange: () => renderEntries()
  });
  search.root.id = 'history-protected-search';

  const listHost = el('div', { className: 'history-protected__list' });
  const bulkBar = el('div', { className: 'history-bulk', attrs: { role: 'group' } });
  bulkBar.hidden = true;
  const countLine = el('p', { className: 'md-typescale-body-small', attrs: { role: 'status' } });

  async function draw(): Promise<void> {
    body.textContent = '';
    selection.clear();

    const hasFactor = await log.hasFactor();
    if (!hasFactor) {
      body.append(
        ctx.components.emptyState({
          title: ctx.t('history.protected.title', 'Protected mutation log'),
          body: ctx.t(
            'history.protected.noFactor',
            'No credential has been set for this log yet. Set one and it locks on every launch.'
          ),
          action: {
            label: 'history.protected.setFactor',
            variant: 'filled',
            icon: 'key',
            onClick: (event) =>
              openFactorWizard(ctx, state, event.currentTarget as HTMLElement, () => void draw())
          }
        })
      );
      // With no credential the entries are still the record and stay readable:
      // this log protects a view, and pretending it protects the data would be a
      // claim it cannot meet.
      await loadEntries();
      body.append(search.root, countLine, bulkBar, listHost);
      renderEntries();
      return;
    }

    if (!log.isUnlocked()) {
      body.append(buildUnlockForm());
      return;
    }

    const unlockNote = el('p', {
      className: 'md-typescale-body-small',
      text: `Unlocked ${log.unlockDescription()}.`
    });
    body.append(unlockNote, search.root, countLine, bulkBar, listHost);
    await loadEntries();
    renderEntries();
  }

  function buildUnlockForm(): HTMLElement {
    const card = ctx.components.card({ variant: 'outlined' });
    card.append(
      el('h2', {
        className: 'md-typescale-title-medium',
        text: ctx.t('history.protected.title', 'Protected mutation log')
      }),
      el('p', {
        className: 'md-typescale-body-medium',
        text: ctx.t(
          'history.protected.locked',
          'This log is locked. It has its own credential; unlocking anything else does not unlock this.'
        )
      })
    );

    const field = ctx.components.textField({
      label: 'history.protected.password',
      type: 'password'
    });
    const message = el('p', { className: 'md-field__support md-typescale-body-small', attrs: { role: 'alert' } });

    const submit = ctx.components.button({
      label: 'history.protected.unlock',
      variant: 'filled',
      icon: 'lockOpen',
      onClick: () => void attempt()
    });

    const attempt = async (): Promise<void> => {
      const result = await log.attemptUnlock(field.get());
      if (!result.ok) {
        message.textContent = result.error ?? '';
        message.classList.add('md-field__support--error');
        field.set('');
        field.focus();
        return;
      }
      message.textContent = '';
      await draw();
    };

    field.root.querySelector('input')?.addEventListener('keydown', (event) => {
      if ((event as KeyboardEvent).key === 'Enter') void attempt();
    });

    void log.factorMethod().then((method) => {
      const input = field.root.querySelector<HTMLInputElement>('input');
      const label = field.root.querySelector<HTMLElement>('.md-field__label');
      if (method === 'totp') {
        if (input) {
          input.type = 'text';
          input.setAttribute('inputmode', 'numeric');
          input.setAttribute('autocomplete', 'one-time-code');
        }
        if (label) label.textContent = ctx.t('history.protected.code', 'Six-digit code');
      }
    });

    card.append(field.root, message, submit);
    card.append(
      el('p', {
        className: 'md-typescale-body-small history-protected__recovery',
        text: ctx.t(
          'history.protected.recovery',
          'Forgotten it? Deleting {path} resets this credential along with every other stored preference.',
          { values: { path: log.recoveryPath() } }
        )
      })
    );
    window.requestAnimationFrame(() => field.focus());
    return card;
  }

  async function loadEntries(): Promise<void> {
    try {
      entries = await log.entries();
    } catch (error) {
      entries = [];
      countLine.textContent = ctx.t('history.status.unreadable', 'The history could not be read: {reason}', {
        values: { reason: describeError(error) }
      });
    }
  }

  function renderEntries(): void {
    const query = search.query();
    visible = entries.filter((entry) => {
      const payload = entry.payload as ProtectedPayload | null;
      const haystack = `${entry.id}\n${entry.action}\n${payload?.kind ?? ''}\n${payload?.target ?? ''}\n${
        payload?.summary ?? ''
      }`;
      return query.matches(haystack);
    });

    countLine.textContent =
      entries.length === 0
        ? ctx.t('history.protected.empty', 'No protected mutation has been recorded yet.')
        : ctx.t('history.results.count', '{shown} shown of {matched} matching, out of {total} kept.', {
            values: {
              shown: formatCount(Math.min(visible.length, MAX_RENDERED)),
              matched: formatCount(visible.length),
              total: formatCount(entries.length)
            }
          });

    listHost.textContent = '';
    if (visible.length === 0) {
      listHost.append(
        ctx.components.emptyState({
          title: ctx.t('core.search.noMatches', 'Nothing matched.'),
          body:
            entries.length === 0
              ? ctx.t('history.protected.empty', 'No protected mutation has been recorded yet.')
              : ctx.t('history.results.noMatch', 'No entry matched. Filtered out by {summary}.', {
                  values: { summary: `"${query.text}"` }
                })
        })
      );
      drawBulk();
      return;
    }

    const list = el('ul', {
      className: 'history-protected__entries',
      attrs: { role: 'list', 'aria-label': ctx.t('history.protected.title', 'Protected mutation log') }
    });
    for (const entry of visible.slice(0, MAX_RENDERED)) {
      list.append(entryRow(entry));
    }
    listHost.append(list);
    if (visible.length > MAX_RENDERED) {
      listHost.append(
        el('p', {
          className: 'md-typescale-body-small',
          text: `Only the newest ${formatCount(MAX_RENDERED)} of ${formatCount(visible.length)} matching entries are drawn. Narrow the search to reach the rest.`
        })
      );
    }
    drawBulk();
  }

  function entryRow(entry: HistoryEntry): HTMLElement {
    const payload = entry.payload as ProtectedPayload | null;
    const row = el('li', { className: 'history-protected__row', attrs: { 'data-entry-id': entry.id } });

    const check = el('input', {
      className: 'history-row__check',
      attrs: {
        type: 'checkbox',
        'aria-label': ctx.t('history.row.select', 'Select entry {id}', { values: { id: entry.id } })
      }
    });
    check.checked = selection.has(entry.id);
    check.addEventListener('change', () => {
      if (check.checked) selection.add(entry.id);
      else selection.delete(entry.id);
      drawBulk();
    });

    const text = el('div', { className: 'history-protected__text' });
    text.append(
      el('span', { className: 'md-typescale-body-large', text: payload?.summary ?? entry.action }),
      el('span', {
        className: 'md-typescale-label-small history-row__meta',
        text: `${formatTimestamp(entry.timestamp)} · ${payload?.kind ?? 'unknown kind'} · ${payload?.target ?? ''} · ${entry.id}`,
        attrs: { title: entry.timestamp }
      })
    );
    if (payload?.envelopeUnavailable) {
      text.append(
        el('span', {
          className: 'md-typescale-body-small history-protected__warning',
          text: ctx.t(
            'history.protected.vaultMissing',
            'The credential store is not usable on this machine ({reason}), so snapshots are recorded without their encrypted body. The event itself is still written down.',
            { values: { reason: payload.envelopeUnavailable } }
          )
        })
      );
    }
    if (payload?.scrubbed && payload.scrubbed.length > 0) {
      text.append(
        el('span', {
          className: 'md-typescale-body-small',
          text: ctx.t(
            'history.protected.scrubbed',
            '{count} fields were dropped before encryption because their names looked credential-shaped: {fields}',
            { values: { count: payload.scrubbed.length, fields: payload.scrubbed.join(', ') } }
          )
        })
      );
    }

    const reveal = ctx.components.button({
      label: 'history.protected.reveal',
      variant: 'text',
      icon: 'visibility',
      disabled: !payload?.envelope,
      disabledReason:
        payload?.envelopeUnavailable ??
        ctx.t('history.protected.reveal', 'Reveal the snapshot metadata'),
      onClick: (event) => void revealEnvelope(entry, event.currentTarget as HTMLElement)
    });

    row.append(check, text, reveal);
    return row;
  }

  async function revealEnvelope(entry: HistoryEntry, anchor: HTMLElement): Promise<void> {
    const payload = entry.payload as ProtectedPayload;
    const opened = await log.openEnvelope(payload);
    const handle = ctx.overlay.open({
      anchor,
      placement: 'bottom-start',
      role: 'dialog',
      label: ctx.t('history.protected.reveal', 'Reveal the snapshot metadata'),
      resizeKey: 'history.envelope'
    });
    handle.root.classList.add('history-details');
    handle.body.append(
      el('h2', {
        className: 'md-typescale-title-small',
        text: ctx.t('history.protected.reveal', 'Reveal the snapshot metadata')
      })
    );
    if (opened.ok) {
      handle.body.append(
        el('pre', { className: 'history-details__payload', text: safeJson(opened.metadata, 2) }),
        el('p', {
          className: 'md-typescale-body-small',
          text: ctx.t(
            'history.protected.revealNote',
            'This is metadata only. No secret, code, password or pairing URI is ever written into an entry.'
          )
        })
      );
    } else {
      handle.body.append(
        el('p', {
          className: 'md-typescale-body-medium',
          text: ctx.t('history.status.unreadable', 'The history could not be read: {reason}', {
            values: { reason: opened.error }
          })
        })
      );
    }
    handle.reposition();
  }

  function selectedEntries(): HistoryEntry[] {
    return visible.filter((entry) => selection.has(entry.id));
  }

  function drawBulk(): void {
    bulkBar.textContent = '';
    bulkBar.hidden = selection.size === 0;
    if (selection.size === 0) return;
    bulkBar.append(
      el('span', {
        className: 'md-typescale-label-large',
        text: ctx.t('history.bulk.selected', '{count} selected', { values: { count: formatCount(selection.size) } })
      }),
      ctx.components.button({
        label: ctx.t('history.bulk.selectAll', 'Select all {count} matching entries', {
          values: { count: formatCount(visible.length) }
        }),
        variant: 'text',
        onClick: () => {
          for (const entry of visible) selection.add(entry.id);
          renderEntries();
        }
      }),
      ctx.components.button({
        label: 'history.bulk.invert',
        variant: 'text',
        onClick: () => {
          for (const entry of visible) {
            if (selection.has(entry.id)) selection.delete(entry.id);
            else selection.add(entry.id);
          }
          renderEntries();
        }
      }),
      ctx.components.button({
        label: 'history.bulk.clear',
        variant: 'text',
        onClick: () => {
          selection.clear();
          renderEntries();
        }
      }),
      ctx.components.button({
        label: 'history.bulk.export',
        variant: 'tonal',
        icon: 'download',
        onClick: () => void exportSelected()
      }),
      ctx.components.button({
        label: 'history.bulk.copy',
        variant: 'text',
        icon: 'copy',
        onClick: () => void copySelected()
      })
    );
  }

  function selectionRecords(): Array<Record<string, unknown>> {
    const base = selectedEntries().map((entry) => ({
      id: entry.id,
      timestamp: entry.timestamp,
      action: entry.action,
      source: entry.source,
      payload: entry.payload
    }));
    // The protected log is always exported redacted: the encrypted body is
    // replaced with a marker so an export can never carry it off the machine.
    return redactRecords(base).records;
  }

  async function exportSelected(): Promise<void> {
    const records = selectionRecords();
    if (records.length === 0) return;
    const path = await ctx.exporter.save(records, 'json', {
      name: 'protected-history',
      schemaVersion: '1',
      defaultFileName: 'protected-history.json'
    });
    if (!path) {
      ctx.notify.info(ctx.t('history.export.title', 'Export history'), ctx.t('history.export.cancelled', 'Nothing was written.'));
      return;
    }
    ctx.notify.success(
      ctx.t('history.export.title', 'Export history'),
      ctx.t('history.export.saved', 'Written to {path}', { values: { path } })
    );
  }

  async function copySelected(): Promise<void> {
    try {
      await navigator.clipboard.writeText(safeJson(selectionRecords(), 2));
      ctx.notify.success(
        ctx.t('history.protected.title', 'Protected mutation log'),
        ctx.t('history.bulk.copied', '{count} entries copied to the clipboard.', {
          values: { count: formatCount(selection.size) }
        })
      );
    } catch (error) {
      ctx.notify.error(
        ctx.t('history.protected.title', 'Protected mutation log'),
        ctx.t('history.bulk.copyFailed', 'The clipboard refused the copy: {reason}', {
          values: { reason: describeError(error) }
        })
      );
    }
  }

  async function runVerification(): Promise<void> {
    try {
      const drift = await log.verifyAgainstVault();
      const clean = drift.unrecorded.length === 0 && drift.orphaned.length === 0;
      const message = clean
        ? ctx.t(
            'history.protected.verifyClean',
            'Every stored account has a matching entry, and every entry has a matching account. {count} accounts checked.',
            { values: { count: formatCount(drift.checked) } }
          )
        : `${ctx.t(
            'history.protected.verifyDrift',
            '{unrecorded} stored accounts have no entry, and {orphaned} entries name an account that is no longer stored.',
            { values: { unrecorded: drift.unrecorded.length, orphaned: drift.orphaned.length } }
          )} ${ctx.t(
            'history.protected.verifyExplain',
            'This compares account keys only, never values. Drift is reported rather than silently written down, because a guess in a log is worse than a gap.'
          )}`;
      if (clean) {
        ctx.notify.success(ctx.t('history.protected.verify', 'Check the log against the credential store'), message);
      } else {
        ctx.notify.warn(ctx.t('history.protected.verify', 'Check the log against the credential store'), message);
      }
    } catch (error) {
      ctx.notify.error(
        ctx.t('history.protected.verify', 'Check the log against the credential store'),
        describeError(error)
      );
    }
  }

  const offLog = log.onChange(() => void draw());
  ctx.onDispose(() => {
    offLog();
    search.destroy();
    // An unlock scoped to "this surface only" ends when the surface does.
    if (String(ctx.settings.get<string>('history.protected.unlockMinutes', '15')) === '0') log.lock();
  });

  void draw();
}

/* ================================================================== */
/* The credential wizard                                               */
/* ================================================================== */

/**
 * Sets or replaces the log's own credential.
 *
 * A pairing is confirmed with one live code before it is stored. Without that
 * step a mistyped secret locks somebody out of a thing they have just set up,
 * and the first they hear of it is the next time they need it.
 */
export function openFactorWizard(
  ctx: AppContext,
  state: FeatureState,
  anchor: HTMLElement,
  onDone: () => void
): void {
  const log = state.protectedLog;
  const handle = ctx.overlay.open({
    anchor,
    placement: 'bottom-start',
    role: 'dialog',
    label: ctx.t('history.settings.factor', 'Protected log credential'),
    resizeKey: 'history.factor',
    dragKey: 'history.factor',
    onClose: () => anchor.focus()
  });
  handle.root.classList.add('history-factor');

  const body = handle.body;
  body.append(
    el('h2', {
      className: 'md-typescale-title-medium',
      text: ctx.t('history.settings.factor', 'Protected log credential')
    }),
    el('p', {
      className: 'md-typescale-body-small',
      text: ctx.t(
        'history.settings.factor.description',
        'Sets or replaces the credential that opens the protected mutation log.'
      )
    })
  );

  const message = el('p', { className: 'md-field__support md-typescale-body-small', attrs: { role: 'alert' } });
  const panel = el('div', { className: 'history-factor__panel' });

  const methodControl = ctx.components.segmentedButton({
    label: ctx.t('history.protected.method', 'How to unlock'),
    options: [
      { value: 'password', label: ctx.t('history.protected.methodPassword', 'A password') },
      { value: 'totp', label: ctx.t('history.protected.methodTotp', 'A code from an authenticator') }
    ],
    value: 'password',
    onChange: (value) => drawMethod(value)
  });

  body.append(methodControl.root, panel, message);

  function drawMethod(method: string): void {
    panel.textContent = '';
    message.textContent = '';
    if (method === 'password') drawPassword();
    else drawTotp();
    handle.reposition();
  }

  function drawPassword(): void {
    const first = ctx.components.textField({ label: 'history.protected.password', type: 'password' });
    const second = ctx.components.textField({ label: 'history.protected.passwordAgain', type: 'password' });
    const save = ctx.components.button({
      label: 'core.action.save',
      variant: 'filled',
      onClick: async () => {
        if (first.get().length < MIN_PASSWORD_LENGTH) {
          message.textContent = ctx.t('history.protected.tooShort', 'Use at least {min} characters. Nothing was stored.', {
            values: { min: MIN_PASSWORD_LENGTH }
          });
          return;
        }
        if (first.get() !== second.get()) {
          message.textContent = ctx.t('history.protected.mismatch', 'The two entries are different, so nothing was stored.');
          return;
        }
        const result = await log.setPasswordFactor(first.get());
        if (!result.ok) {
          message.textContent = result.error ?? '';
          return;
        }
        await recordEntry(ctx, 'Set the protected history credential to a password', 'history.protected', {
          kind: 'historyManager.credentialSet',
          method: 'password',
          summary: 'The protected mutation log now unlocks with a password.'
        });
        ctx.notify.success(
          ctx.t('history.settings.factor', 'Protected log credential'),
          ctx.t(
            'history.protected.recovery',
            'Forgotten it? Deleting {path} resets this credential along with every other stored preference.',
            { values: { path: log.recoveryPath() } }
          )
        );
        handle.close();
        onDone();
      }
    });
    panel.append(first.root, second.root, save);
    window.requestAnimationFrame(() => first.focus());
  }

  function drawTotp(): void {
    const secret = generateSecret();
    const parameters = {
      secret,
      algorithm: 'SHA-1' as const,
      digits: 6,
      period: 30,
      issuer: ctx.studio.info.productName,
      account: 'Protected history'
    };
    const uri = otpauthUri(parameters);

    panel.append(
      el('p', {
        className: 'md-typescale-body-medium',
        text: ctx.t(
          'history.protected.pairing',
          'Scan this with your authenticator, then type one code back to confirm the pairing.'
        )
      })
    );
    try {
      const qr = qrSvg(uri, 5);
      qr.setAttribute('role', 'img');
      qr.setAttribute(
        'aria-label',
        ctx.t('history.protected.pairing', 'Scan this with your authenticator, then type one code back to confirm the pairing.')
      );
      const frame = el('div', { className: 'history-factor__qr' });
      frame.append(qr);
      panel.append(frame);
    } catch (error) {
      panel.append(el('p', { className: 'md-typescale-body-small', text: describeError(error) }));
    }
    panel.append(
      el('p', {
        className: 'md-typescale-body-small history-factor__secret',
        text: ctx.t('history.protected.pairingManual', 'If you cannot scan it, type this into the authenticator by hand: {secret}', {
          values: { secret: secret.replace(/(.{4})/g, '$1 ').trim() }
        })
      }),
      el('p', {
        className: 'md-typescale-body-small',
        text: 'SHA-1, 6 digits, a 30-second period — the parameters this pairing actually uses.'
      })
    );

    const code = ctx.components.textField({ label: 'history.protected.code', type: 'text' });
    const save = ctx.components.button({
      label: 'core.action.save',
      variant: 'filled',
      onClick: async () => {
        const result = await log.setTotpFactor(parameters, code.get());
        if (!result.ok) {
          message.textContent = result.error ?? '';
          return;
        }
        await recordEntry(ctx, 'Set the protected history credential to an authenticator code', 'history.protected', {
          kind: 'historyManager.credentialSet',
          method: 'totp',
          summary: 'The protected mutation log now unlocks with a code from an authenticator.'
        });
        ctx.notify.success(
          ctx.t('history.settings.factor', 'Protected log credential'),
          ctx.t(
            'history.protected.recovery',
            'Forgotten it? Deleting {path} resets this credential along with every other stored preference.',
            { values: { path: log.recoveryPath() } }
          )
        );
        handle.close();
        onDone();
      }
    });
    panel.append(code.root, save);
    window.requestAnimationFrame(() => code.focus());
  }

  drawMethod('password');
  handle.reposition();
}
