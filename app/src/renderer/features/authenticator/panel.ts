/**
 * The authenticator surface: the list, the live codes, and everything that acts
 * on them.
 *
 * The list is a real list in this application's sense — multi-select with
 * shift-ranges and a keyboard path, an honestly scoped select-all, an inverse
 * selection, a preview and an exact count before anything happens, and the full
 * set of actions rather than a token subset. Rows carry live controls rather
 * than printed values, because somebody looking at a row has usually come to
 * change something on it.
 */

import { el } from '../../core/a11y';
import type { AppContext, SearchBarHandle, SearchQuery, TabContext } from '../../core/registry';
import {
  applyCorrection,
  clearDrift,
  correctedNow,
  onDrift,
  parseReferenceTime,
  recordReferenceCheck,
  verdict
} from './clock';
import {
  type AuthenticatorEntry,
  type AuthenticatorGroup,
  buildPairingUri,
  describeEntry,
  groupCode,
  groupSecret,
  searchHaystack,
  validateEntryFields
} from './model';
import { QR_MODULE_SIZE_ID, copyText, openRegistration } from './register';
import { encodeQr, qrToSvg } from './qrencode';
import { type SelfTestReport, checkCount, runSelfTest } from './selftest';
import { store } from './store';

export const HIDE_CODES_ID = 'authenticator.hideCodes';
export const SHOW_NEXT_ID = 'authenticator.showNextCode';

const PAGE_SIZE = 50;

const ICON_CHOICES = ['key', 'lock', 'world', 'cloud', 'code', 'terminal', 'map', 'bolt', 'folder', 'file'];

/* ================================================================== */
/* The entry list                                                      */
/* ================================================================== */

export function mountEntries(host: HTMLElement, ctx: TabContext): void {
  const addButton = ctx.components.button({
    label: 'authenticator.add',
    variant: 'filled',
    icon: 'add',
    id: 'authenticator-add',
    onClick: () => openRegistration(ctx, addButton, () => redraw())
  });

  const exportButton = ctx.components.button({
    label: 'authenticator.export',
    variant: 'tonal',
    icon: 'upload',
    id: 'authenticator-export',
    onClick: () => openExport(ctx, exportButton, () => visibleEntries())
  });

  const forgetButton = ctx.components.button({
    label: 'authenticator.privacy.forget',
    variant: 'text',
    icon: 'lock',
    onClick: () => {
      store().forgetCachedSecrets();
      ctx.notify.info(
        ctx.t('authenticator.privacy.title', 'Where this is kept', { dialog: true }),
        ctx.t('authenticator.privacy.cached', '{count} secrets are held in this window’s memory so the codes can tick.', {
          values: { count: 0 }
        })
      );
      redraw();
    }
  });

  host.append(
    ctx.components.topAppBar({
      title: 'authenticator.title',
      subtitle: 'authenticator.subtitle',
      actions: [addButton, exportButton, forgetButton]
    })
  );

  const banners = el('div', { className: 'authenticator-banners' });
  const searchHost = el('div', { className: 'authenticator-toolbar', attrs: { id: 'authenticator-search' } });
  const bulkBar = el('div', {
    className: 'authenticator-bulk',
    attrs: { role: 'group', 'aria-label': ctx.t('authenticator.selection', '{count} selected', { values: { count: 0 } }) }
  });
  const summary = el('p', { className: 'md-typescale-body-small', attrs: { role: 'status' } });
  const listHost = el('div', { className: 'authenticator-list', attrs: { id: 'authenticator-list' } });
  const pager = el('div', { className: 'authenticator-pager' });
  const footer = el('div', { className: 'authenticator-footer' });

  host.append(banners, searchHost, summary, bulkBar, listHost, pager, footer);

  /* ---------------- state ---------------- */

  let query: SearchQuery | null = null;
  const selected = new Set<string>();
  let lastIndex = -1;
  let page = 0;
  const rows = new Map<string, RowView>();
  const rovingDisposers: Array<() => void> = [];

  const search: SearchBarHandle = ctx.createSearchBar({
    label: 'authenticator.search',
    placeholder: 'authenticator.search.placeholder',
    sample: store()
      .entries()
      .map((entry) => searchHaystack(entry, store().groupName(entry.group)))
      .join('\n'),
    onChange: (next) => {
      query = next;
      page = 0;
      redraw();
    }
  });
  searchHost.append(search.root);

  function allEntries(): AuthenticatorEntry[] {
    return store().entries();
  }

  function visibleEntries(): AuthenticatorEntry[] {
    const entries = allEntries();
    if (!query || query.text.trim() === '') return entries;
    return entries.filter((entry) => query!.matches(searchHaystack(entry, store().groupName(entry.group))));
  }

  /* ---------------- drawing ---------------- */

  function redraw(): void {
    for (const row of rows.values()) row.dispose();
    rows.clear();
    for (const stop of rovingDisposers.splice(0)) stop();
    listHost.textContent = '';
    banners.textContent = '';
    pager.textContent = '';
    footer.textContent = '';

    drawClockBanner(ctx, banners, () => redraw());
    drawOrnamentalLockNotice(ctx, banners);

    const entries = allEntries();
    const matching = visibleEntries();

    summary.textContent = ctx.t('authenticator.count', '{shown} of {total} shown', {
      values: { shown: matching.length, total: entries.length }
    });

    if (entries.length === 0) {
      listHost.append(
        ctx.components.emptyState({
          title: 'authenticator.empty.title',
          body: 'authenticator.empty.body',
          action: {
            label: 'authenticator.empty.action',
            icon: 'add',
            variant: 'filled',
            onClick: () => openRegistration(ctx, addButton, () => redraw())
          }
        })
      );
      drawBulkBar();
      drawFooter();
      return;
    }

    if (matching.length === 0) {
      listHost.append(
        ctx.components.emptyState({
          title: 'core.search.noMatches',
          body: 'authenticator.search.placeholder'
        })
      );
      drawBulkBar();
      drawFooter();
      return;
    }

    // Paging keeps a long list from instantiating a live control per row for
    // entries nobody is looking at; the count above always states the truth.
    const totalPages = Math.max(1, Math.ceil(matching.length / PAGE_SIZE));
    page = Math.min(page, totalPages - 1);
    const pageEntries = matching.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

    const groups = store().groups();
    const buckets = new Map<string | null, AuthenticatorEntry[]>();
    for (const entry of pageEntries) {
      const key = entry.group && groups.some((group) => group.id === entry.group) ? entry.group : null;
      const bucket = buckets.get(key) ?? [];
      bucket.push(entry);
      buckets.set(key, bucket);
    }

    const ordered: Array<{ group: AuthenticatorGroup | null; entries: AuthenticatorEntry[] }> = [];
    for (const group of groups) {
      const bucket = buckets.get(group.id);
      if (bucket && bucket.length > 0) ordered.push({ group, entries: bucket });
    }
    const ungrouped = buckets.get(null);
    if (ungrouped && ungrouped.length > 0) ordered.push({ group: null, entries: ungrouped });

    for (const section of ordered) {
      listHost.append(drawSection(section.group, section.entries));
    }

    if (totalPages > 1) drawPager(matching.length, totalPages);
    drawBulkBar();
    drawFooter();
  }

  function drawSection(group: AuthenticatorGroup | null, entries: AuthenticatorEntry[]): HTMLElement {
    const section = el('section', { className: 'authenticator-group' });
    const header = el('div', { className: 'authenticator-group__header' });
    const name = group ? group.name : ctx.t('authenticator.groups.ungrouped', 'Ungrouped');

    if (group) {
      const swatch = el('span', { className: 'authenticator-group__swatch', attrs: { 'aria-hidden': 'true' } });
      swatch.style.background = group.color;
      const toggle = el('button', {
        className: 'authenticator-group__toggle',
        text: name,
        attrs: {
          type: 'button',
          'aria-expanded': String(!group.collapsed),
          'aria-label': ctx.t(group.collapsed ? 'authenticator.groups.expand' : 'authenticator.groups.collapse', name, {
            values: { name }
          })
        }
      });
      toggle.addEventListener('click', () => {
        void store()
          .updateGroup(group.id, { collapsed: !group.collapsed })
          .then(() => redraw());
      });
      const remove = ctx.components.iconButton({
        icon: 'trash',
        label: ctx.t('authenticator.groups.delete', 'Delete this group'),
        onClick: async () => {
          const confirmed = await ctx.confirm.request({
            action: ctx.t('authenticator.groups.delete', 'Delete this group'),
            affected: [name],
            irreversible: ctx.t(
              'authenticator.groups.deleteKeeps',
              'Deleting a group keeps its entries; they simply stop being grouped.'
            ),
            anchor: remove
          });
          if (!confirmed) return;
          await store().removeGroup(group.id);
          redraw();
        }
      });
      header.append(swatch, toggle, remove);
      section.append(header);
      if (group.collapsed) {
        section.append(
          el('p', {
            className: 'md-typescale-body-small',
            text: ctx.t('authenticator.count', '{shown} of {total} shown', {
              values: { shown: entries.length, total: entries.length }
            })
          })
        );
        return section;
      }
    } else if (store().groups().length > 0) {
      header.append(el('span', { className: 'md-typescale-title-small', text: name }));
      section.append(header);
    }

    const list = ctx.components.list({ label: 'authenticator.list.label' });
    for (const entry of entries) {
      const view = createRow(entry);
      rows.set(entry.id, view);
      list.append(view.root);
    }
    section.append(list);
    // The list runs down the surface, so the arrow keys that move between rows
    // are Up and Down. Wiring a vertical list to Left and Right produces a list
    // that looks correct and cannot be used from the keyboard.
    rovingDisposers.push(
      ctx.a11y.roving(list, () => [...list.querySelectorAll<HTMLElement>('.authenticator-row')], 'vertical')
    );
    return section;
  }

  /* ---------------- one row ---------------- */

  interface RowView {
    root: HTMLElement;
    tick(nowMs: number): void;
    dispose(): void;
  }

  function createRow(entry: AuthenticatorEntry): RowView {
    const root = el('div', {
      className: 'authenticator-row md-list-item',
      attrs: {
        id: `authenticator-entry-${entry.id}`,
        'data-appearance-id': 'authenticator:row',
        role: 'group',
        'aria-label': describeEntry(entry),
        tabindex: '-1'
      }
    });

    /* selection */
    //
    // The shift key is read on the click that precedes the change event, rather
    // than acted on there: a checkbox fires `click` before `change`, so handling
    // the range in the click listener and the single toggle in the change
    // listener makes the second one undo part of the first.
    let shiftHeld = false;
    const selectBox = ctx.components.checkbox({
      label: ctx.t('authenticator.select', 'Select {name}', { values: { name: describeEntry(entry) } }),
      checked: selected.has(entry.id),
      onChange: (checked) => setSelected(entry.id, checked, shiftHeld)
    });
    selectBox.root.classList.add('authenticator-row__select');
    selectBox.root.querySelector('input')?.addEventListener('click', (event) => {
      shiftHeld = (event as MouseEvent).shiftKey;
    });

    /* identity */
    const identity = el('div', { className: 'authenticator-row__identity' });
    identity.append(ctx.components.icon(entry.icon, { size: 22 }));
    const text = el('div', { className: 'authenticator-row__text' });
    text.append(
      el('span', { className: 'md-typescale-title-small', text: entry.label || entry.issuer || entry.account }),
      el('span', { className: 'md-typescale-body-small', text: entry.account })
    );
    if (!entry.verified) {
      const badge = ctx.components.badge({ label: ctx.t('authenticator.unverified', 'Not checked'), severity: 'warning' });
      badge.title = ctx.t(
        'authenticator.unverified.explain',
        'No live code from this secret was ever matched, so a typing mistake in the secret would not have been caught.'
      );
      text.append(badge);
    }
    text.append(
      el('span', {
        className: 'authenticator-row__parameters md-typescale-label-small',
        text: ctx.t('authenticator.parameters', '{algorithm}, {digits} digits, every {period} seconds', {
          values: { algorithm: entry.algorithm, digits: entry.digits, period: entry.period }
        })
      })
    );
    identity.append(text);

    /* the code */
    const codeBlock = el('div', { className: 'authenticator-row__code' });
    const codeValue = el('button', {
      className: 'authenticator-code md-typescale-headline-small',
      attrs: {
        type: 'button',
        'aria-label': ctx.t('authenticator.code.copy', 'Copy code'),
        title: ctx.t('authenticator.code.copy', 'Copy code')
      }
    });
    let currentCode: string | null = null;
    let revealed = !ctx.settings.get<boolean>(HIDE_CODES_ID, false);
    codeValue.addEventListener('click', () => {
      if (!currentCode) return;
      void copyText(ctx, currentCode, ctx.t('authenticator.code.copy', 'Copy code'));
      ctx.notify.success(ctx.t('authenticator.code.copied', 'Code copied', { dialog: true }), describeEntry(entry));
    });

    const nextValue = el('span', { className: 'authenticator-code__next md-typescale-body-small' });
    const countdownText = el('span', { className: 'authenticator-code__seconds md-typescale-label-medium' });
    const countdownBar = el('div', {
      className: 'authenticator-code__bar',
      attrs: {
        role: 'progressbar',
        'aria-valuemin': '0',
        'aria-valuemax': String(entry.period),
        'aria-label': ctx.t('authenticator.seconds', '{seconds} seconds left', { values: { seconds: entry.period } })
      }
    });
    const countdownFill = el('div', { className: 'authenticator-code__bar-fill' });
    countdownBar.append(countdownFill);

    const revealSwitch = ctx.components.switchControl({
      label: ctx.t('authenticator.code.reveal', 'Show this code'),
      checked: revealed,
      onChange: (checked) => {
        revealed = checked;
        paintCode();
      }
    });
    revealSwitch.root.classList.add('authenticator-row__reveal');

    codeBlock.append(codeValue, nextValue, countdownText, countdownBar);
    if (ctx.settings.get<boolean>(HIDE_CODES_ID, false)) codeBlock.append(revealSwitch.root);

    /* inline group control: the real control, not a printed value */
    const groupSelect = ctx.components.select({
      label: 'authenticator.row.group.field',
      value: entry.group ?? '',
      options: [
        { value: '', label: 'authenticator.row.group.none' },
        ...store().groups().map((group) => ({ value: group.id, label: group.name }))
      ],
      onChange: (value) => {
        void store()
          .setGroup([entry.id], value === '' ? null : value)
          .then(() => redraw());
      }
    });
    groupSelect.root.classList.add('authenticator-row__group');

    /* the row menu */
    const menuButton = ctx.components.iconButton({
      icon: 'more',
      label: ctx.t('authenticator.row.menu', 'Entry actions'),
      onClick: () => openRowMenu(entry, menuButton)
    });

    root.append(selectBox.root, identity, codeBlock, groupSelect.root, menuButton);

    function paintCode(): void {
      if (currentCode === null) {
        codeValue.textContent = '——';
        codeValue.disabled = true;
        codeValue.title = ctx.t('authenticator.code.unavailable', 'No secret is stored for this entry');
        return;
      }
      codeValue.disabled = false;
      codeValue.title = ctx.t('authenticator.code.copy', 'Copy code');
      codeValue.textContent = revealed ? groupCode(currentCode) : '•'.repeat(entry.digits);
      codeValue.setAttribute(
        'aria-label',
        revealed
          ? `${ctx.t('authenticator.code', 'Current code')} ${currentCode.split('').join(' ')}. ${ctx.t('authenticator.code.copy', 'Copy code')}`
          : ctx.t('authenticator.code.hidden', 'Hidden')
      );
    }

    // The first code arrives asynchronously from the credential vault, so the
    // row paints its honest "nothing yet" state immediately rather than showing
    // an empty control that looks broken for a frame.
    paintCode();

    let lastStep = Number.NaN;
    let missingReported = false;

    async function refreshCode(nowMs: number): Promise<void> {
      const code = await store().codeFor(entry, nowMs);
      if (code === null) {
        currentCode = null;
        paintCode();
        if (!missingReported) {
          missingReported = true;
          codeBlock.append(
            el('p', {
              className: 'authenticator-row__missing md-typescale-body-small',
              text: ctx.t(
                'authenticator.code.unavailable.body',
                'The record exists but the credential vault has nothing under its key, so no code can be produced.'
              )
            })
          );
        }
        return;
      }
      currentCode = code;
      paintCode();
      if (ctx.settings.get<boolean>(SHOW_NEXT_ID, true)) {
        const next = await store().nextCodeFor(entry, nowMs);
        nextValue.textContent = next
          ? `${ctx.t('authenticator.code.next', 'Next code')}: ${revealed ? groupCode(next) : '•'.repeat(entry.digits)}`
          : '';
      } else {
        nextValue.textContent = '';
      }
    }

    return {
      root,
      tick(nowMs: number) {
        const step = Math.floor(nowMs / 1000 / entry.period);
        if (step !== lastStep) {
          lastStep = step;
          void refreshCode(nowMs);
        }
        const remaining = store().secondsRemaining(entry, nowMs);
        // The countdown is never colour alone and never motion alone: the exact
        // number of seconds is always readable as text.
        countdownText.textContent = ctx.t('authenticator.seconds.short', '{seconds}s', { values: { seconds: remaining } });
        countdownBar.setAttribute('aria-valuenow', String(remaining));
        countdownBar.setAttribute(
          'aria-label',
          ctx.t('authenticator.seconds', '{seconds} seconds left', { values: { seconds: remaining } })
        );
        countdownFill.style.inlineSize = `${Math.round((remaining / entry.period) * 100)}%`;
        countdownFill.classList.toggle('authenticator-code__bar-fill--low', remaining <= 5);
      },
      dispose() {
        root.remove();
      }
    };
  }

  /* ---------------- the row menu ---------------- */

  function openRowMenu(entry: AuthenticatorEntry, anchor: HTMLElement): void {
    const index = visibleEntries().findIndex((candidate) => candidate.id === entry.id);
    ctx.components.menu({
      anchor,
      label: ctx.t('authenticator.row.menu', 'Entry actions'),
      items: [
        {
          id: 'edit',
          label: ctx.t('authenticator.row.edit', 'Edit details…'),
          icon: 'edit',
          run: () => openRowEditor(entry, anchor)
        },
        {
          id: 'pairing',
          label: ctx.t('authenticator.row.showPairing', 'Show pairing code…'),
          icon: 'palette',
          run: () => void openPairingView(entry, anchor)
        },
        {
          id: 'reveal',
          label: ctx.t('authenticator.row.reveal', 'Reveal the secret…'),
          icon: 'visibility',
          run: () => void openSecretReveal(entry, anchor)
        },
        {
          id: 'up',
          label: ctx.t('authenticator.row.moveUp', 'Move up'),
          icon: 'chevronUp',
          separatorBefore: true,
          disabled: index <= 0,
          disabledReason: ctx.t('authenticator.row.moveUp', 'Move up'),
          run: () => void store().move(entry.id, -1).then(() => redraw())
        },
        {
          id: 'down',
          label: ctx.t('authenticator.row.moveDown', 'Move down'),
          icon: 'chevronDown',
          disabled: index === -1 || index >= visibleEntries().length - 1,
          disabledReason: ctx.t('authenticator.row.moveDown', 'Move down'),
          run: () => void store().move(entry.id, 1).then(() => redraw())
        },
        {
          id: 'group',
          label: ctx.t('authenticator.row.group', 'Move into group…'),
          icon: 'folder',
          run: () => openGroupPicker(ctx, anchor, [entry.id], () => redraw())
        },
        {
          id: 'delete',
          label: ctx.t('authenticator.row.delete', 'Delete this entry…'),
          icon: 'trash',
          danger: true,
          separatorBefore: true,
          run: () => void deleteEntries([entry.id], anchor)
        }
      ]
    });
  }

  function openRowEditor(entry: AuthenticatorEntry, anchor: HTMLElement): void {
    const overlay = ctx.overlay.open({
      anchor,
      role: 'dialog',
      label: ctx.t('authenticator.row.edit', 'Edit details…'),
      resizeKey: 'authenticator-row-editor',
      dragKey: 'authenticator-row-editor'
    });
    const draft = { ...entry };
    const error = el('p', { className: 'authenticator-register__status--error md-typescale-body-small', attrs: { role: 'status' } });

    const labelField = ctx.components.textField({
      label: 'authenticator.row.label',
      value: draft.label,
      onChange: (value) => {
        draft.label = value;
      }
    });
    const issuerField = ctx.components.textField({
      label: 'authenticator.add.issuer',
      value: draft.issuer,
      onChange: (value) => {
        draft.issuer = value;
      }
    });
    const accountField = ctx.components.textField({
      label: 'authenticator.add.account',
      value: draft.account,
      onChange: (value) => {
        draft.account = value;
      }
    });
    const noteField = ctx.components.textField({
      label: 'authenticator.row.note',
      value: draft.note,
      multiline: true,
      rows: 2,
      onChange: (value) => {
        draft.note = value;
      }
    });
    const iconField = ctx.components.select({
      label: 'authenticator.row.icon',
      value: draft.icon,
      options: ICON_CHOICES.map((icon) => ({ value: icon, label: icon })),
      onChange: (value) => {
        draft.icon = value;
      }
    });

    const save = ctx.components.button({
      label: 'core.action.save',
      variant: 'filled',
      icon: 'save',
      onClick: async () => {
        const problem = validateEntryFields(draft);
        if (problem) {
          error.textContent = problem;
          return;
        }
        await store().update(
          entry.id,
          { label: draft.label, issuer: draft.issuer, account: draft.account, note: draft.note, icon: draft.icon },
          'Edited a one-time code entry'
        );
        overlay.close();
        redraw();
      }
    });

    overlay.body.append(
      ctx.components.sectionHeading({ title: 'authenticator.row.edit' }),
      labelField.root,
      issuerField.root,
      accountField.root,
      iconField.root,
      noteField.root,
      el('p', {
        className: 'md-typescale-body-small',
        text: ctx.t('authenticator.parameters', '{algorithm}, {digits} digits, every {period} seconds', {
          values: { algorithm: entry.algorithm, digits: entry.digits, period: entry.period }
        })
      }),
      save,
      error
    );
  }

  async function openPairingView(entry: AuthenticatorEntry, anchor: HTMLElement): Promise<void> {
    const secret = await store().secretFor(entry.id);
    const overlay = ctx.overlay.open({
      anchor,
      role: 'dialog',
      label: ctx.t('authenticator.row.showPairing', 'Show pairing code…'),
      resizeKey: 'authenticator-pairing-view',
      dragKey: 'authenticator-pairing-view'
    });
    if (secret === null) {
      overlay.body.append(
        el('p', {
          className: 'md-typescale-body-medium',
          text: ctx.t(
            'authenticator.code.unavailable.body',
            'The record exists but the credential vault has nothing under its key.'
          )
        })
      );
      return;
    }
    const parameters = {
      issuer: entry.issuer,
      account: entry.account,
      secret,
      algorithm: entry.algorithm,
      digits: entry.digits,
      period: entry.period
    };
    const uri = buildPairingUri(parameters);
    const description = ctx.t(
      'authenticator.pair.qrAlt',
      'Pairing code for {account} at {issuer}. Scan it with an authenticator, or use the written secret beside it.',
      { values: { account: entry.account, issuer: entry.issuer } }
    );
    const moduleSize = Math.max(3, Math.min(12, ctx.settings.get<number>(QR_MODULE_SIZE_ID, 6)));
    const code = encodeQr(uri, { level: 'M' });
    const written = el('p', { className: 'authenticator-pairing__secret md-typescale-body-large' });
    let visible = false;
    const paint = (): void => {
      written.textContent = visible ? groupSecret(secret) : groupSecret(secret).replace(/[^ ]/g, '•');
    };
    paint();

    overlay.body.append(
      qrToSvg(code, { moduleSize, description }),
      el('p', {
        className: 'md-typescale-body-small',
        text: ctx.t(
          'authenticator.pair.drawnHere',
          'This picture is drawn on this computer. It is never sent anywhere, because it contains the secret.'
        )
      }),
      el('p', { className: 'md-typescale-label-medium', text: ctx.t('authenticator.pair.secretLabel', 'The same secret, written out') }),
      written,
      el('p', {
        className: 'md-typescale-body-small',
        text: ctx.t('authenticator.pair.parameters', 'Algorithm {algorithm}, {digits} digits, {period} second period.', {
          values: { algorithm: entry.algorithm, digits: entry.digits, period: entry.period }
        })
      }),
      ctx.components.button({
        label: 'authenticator.pair.showSecret',
        variant: 'outlined',
        icon: 'visibility',
        onClick: () => {
          visible = !visible;
          paint();
        }
      }),
      ctx.components.button({
        label: 'authenticator.pair.copyUri',
        variant: 'text',
        icon: 'copy',
        onClick: () => void copyText(ctx, uri, ctx.t('authenticator.pair.copyUri', 'Copy the pairing link'))
      })
    );
  }

  /**
   * Shows the written secret for one entry.
   *
   * It is masked when the panel opens and revealed only by a deliberate action,
   * because the value on screen is the whole of the account's second factor —
   * anybody who reads it can generate these codes for ever.
   */
  async function openSecretReveal(entry: AuthenticatorEntry, anchor: HTMLElement): Promise<void> {
    const secret = await store().secretFor(entry.id);
    const overlay = ctx.overlay.open({
      anchor,
      role: 'dialog',
      label: ctx.t('authenticator.row.reveal', 'Reveal the secret…'),
      resizeKey: 'authenticator-secret-reveal'
    });

    if (secret === null) {
      overlay.body.append(
        ctx.components.sectionHeading({ title: 'authenticator.code.unavailable' }),
        el('p', {
          className: 'md-typescale-body-medium',
          text: ctx.t(
            'authenticator.code.unavailable.body',
            'The record exists but the credential vault has nothing under its key, so no code can be produced.'
          )
        })
      );
      return;
    }

    const written = el('p', {
      className: 'authenticator-pairing__secret md-typescale-body-large',
      attrs: { role: 'status' }
    });
    let visible = false;
    const paint = (): void => {
      written.textContent = visible ? groupSecret(secret) : groupSecret(secret).replace(/[^ ]/g, '•');
      written.setAttribute(
        'aria-label',
        visible
          ? `${ctx.t('authenticator.pair.secretLabel', 'The same secret, written out')}: ${groupSecret(secret)}`
          : ctx.t('authenticator.pair.showSecret', 'Show the secret')
      );
    };
    paint();

    const toggle = ctx.components.button({
      label: 'authenticator.pair.showSecret',
      variant: 'outlined',
      icon: 'visibility',
      onClick: () => {
        visible = !visible;
        paint();
        const labelNode = toggle.querySelector('.md-btn__label');
        if (labelNode) {
          labelNode.textContent = ctx.t(
            visible ? 'authenticator.pair.hideSecret' : 'authenticator.pair.showSecret',
            visible ? 'Hide the secret' : 'Show the secret'
          );
        }
      }
    });

    overlay.body.append(
      ctx.components.sectionHeading({ title: 'authenticator.row.reveal' }),
      el('p', { className: 'md-typescale-body-medium', text: describeEntry(entry) }),
      el('p', {
        className: 'md-typescale-label-medium',
        text: ctx.t('authenticator.pair.secretLabel', 'The same secret, written out')
      }),
      written,
      toggle,
      ctx.components.button({
        label: 'authenticator.pair.copySecret',
        variant: 'text',
        icon: 'copy',
        onClick: () => void copyText(ctx, secret, ctx.t('authenticator.pair.copySecret', 'Copy the secret'))
      }),
      el('p', {
        className: 'md-typescale-body-small',
        text: ctx.t(
          'authenticator.exportSecrets.warning',
          'Anybody who reads this value can generate your codes for ever.'
        )
      })
    );
  }

  /* ---------------- selection ---------------- */

  function setSelected(id: string, value: boolean, range: boolean): void {
    const list = visibleEntries();
    const index = list.findIndex((entry) => entry.id === id);
    if (range && lastIndex >= 0 && index >= 0) {
      const from = Math.min(lastIndex, index);
      const to = Math.max(lastIndex, index);
      for (let cursor = from; cursor <= to; cursor += 1) selected.add(list[cursor].id);
    } else if (value) {
      selected.add(id);
    } else {
      selected.delete(id);
    }
    lastIndex = index;
    drawBulkBar();
    syncRowSelection();
  }

  function syncRowSelection(): void {
    for (const [id, view] of rows) {
      const input = view.root.querySelector<HTMLInputElement>('.authenticator-row__select input');
      if (input) input.checked = selected.has(id);
      view.root.setAttribute('aria-selected', String(selected.has(id)));
    }
  }

  function drawBulkBar(): void {
    bulkBar.textContent = '';
    const matching = visibleEntries();
    const total = allEntries().length;

    const count = el('span', {
      className: 'md-typescale-label-large',
      text: ctx.t('authenticator.selection', '{count} selected', { values: { count: selected.size } })
    });

    const selectMatching = ctx.components.button({
      label: ctx.t('authenticator.selectAllMatching', 'Select all {count} matching this search', {
        values: { count: matching.length }
      }),
      variant: 'text',
      onClick: () => {
        for (const entry of matching) selected.add(entry.id);
        drawBulkBar();
        syncRowSelection();
      }
    });

    const selectEverything = ctx.components.button({
      label: ctx.t('authenticator.selectAllEverything', 'Select all {count} entries, including those the search hides', {
        values: { count: total }
      }),
      variant: 'text',
      onClick: () => {
        for (const entry of allEntries()) selected.add(entry.id);
        drawBulkBar();
        syncRowSelection();
      }
    });

    const invert = ctx.components.button({
      label: 'authenticator.invertSelection',
      variant: 'text',
      onClick: () => {
        for (const entry of matching) {
          if (selected.has(entry.id)) selected.delete(entry.id);
          else selected.add(entry.id);
        }
        drawBulkBar();
        syncRowSelection();
      }
    });

    const clear = ctx.components.button({
      label: 'authenticator.clearSelection',
      variant: 'text',
      disabled: selected.size === 0,
      disabledReason: ctx.t('authenticator.bulk.none', 'Nothing is selected, so there is nothing to act on.'),
      onClick: () => {
        selected.clear();
        drawBulkBar();
        syncRowSelection();
      }
    });

    const bulkDelete = ctx.components.button({
      label: 'authenticator.bulk.delete',
      variant: 'text',
      icon: 'trash',
      danger: true,
      disabled: selected.size === 0,
      disabledReason: ctx.t('authenticator.bulk.none', 'Nothing is selected, so there is nothing to act on.'),
      onClick: () => void deleteEntries([...selected], bulkDelete)
    });

    const bulkExport = ctx.components.button({
      label: 'authenticator.bulk.export',
      variant: 'text',
      icon: 'upload',
      disabled: selected.size === 0,
      disabledReason: ctx.t('authenticator.bulk.none', 'Nothing is selected, so there is nothing to act on.'),
      onClick: () =>
        openExport(ctx, bulkExport, () => allEntries().filter((entry) => selected.has(entry.id)))
    });

    const bulkGroup = ctx.components.button({
      label: 'authenticator.bulk.group',
      variant: 'text',
      icon: 'folder',
      disabled: selected.size === 0,
      disabledReason: ctx.t('authenticator.bulk.none', 'Nothing is selected, so there is nothing to act on.'),
      onClick: () => openGroupPicker(ctx, bulkGroup, [...selected], () => redraw())
    });

    bulkBar.append(count, selectMatching, selectEverything, invert, clear, bulkDelete, bulkExport, bulkGroup);
  }

  async function deleteEntries(ids: string[], anchor: HTMLElement): Promise<void> {
    if (ids.length === 0) return;
    const affected = allEntries()
      .filter((entry) => ids.includes(entry.id))
      .map((entry) => describeEntry(entry));
    const confirmed = await ctx.confirm.request({
      action: ctx.t('authenticator.bulk.delete', 'Delete selected…'),
      affected,
      irreversible: ctx.t(
        'authenticator.delete.irreversible',
        'The secret behind each of these entries is removed from the credential vault. Nothing here can produce their codes afterwards, and only the issuer can give you a new secret.'
      ),
      anchor
    });
    if (!confirmed) return;
    const result = await store().remove(ids);
    for (const id of result.removed) selected.delete(id);
    if (result.failed.length > 0) {
      ctx.notify.error(
        ctx.t('authenticator.error.title', 'That did not work', { dialog: true }),
        result.failed.map((failure) => `${failure.id}: ${failure.reason}`).join('\n')
      );
    }
    redraw();
  }

  function drawPager(total: number, totalPages: number): void {
    const from = page * PAGE_SIZE + 1;
    const to = Math.min(total, (page + 1) * PAGE_SIZE);
    pager.append(
      ctx.components.button({
        label: 'authenticator.page.previous',
        variant: 'text',
        icon: 'chevronLeft',
        disabled: page === 0,
        disabledReason: ctx.t('authenticator.page.previous', 'Previous page'),
        onClick: () => {
          page -= 1;
          redraw();
        }
      }),
      el('span', {
        className: 'md-typescale-body-small',
        text: ctx.t('authenticator.paging', 'Showing entries {from} to {to} of {total}', {
          values: { from, to, total }
        })
      }),
      ctx.components.button({
        label: 'authenticator.page.next',
        variant: 'text',
        icon: 'chevronRight',
        disabled: page >= totalPages - 1,
        disabledReason: ctx.t('authenticator.page.next', 'Next page'),
        onClick: () => {
          page += 1;
          redraw();
        }
      })
    );
  }

  function drawFooter(): void {
    footer.append(
      el('h2', { className: 'md-typescale-title-small', text: ctx.t('authenticator.privacy.title', 'Where this is kept') }),
      el('p', {
        className: 'md-typescale-body-small',
        text: ctx.t(
          'authenticator.privacy.body',
          'Records are in this application’s settings file. Secrets are in the operating system’s credential vault.'
        )
      }),
      el('p', {
        className: 'md-typescale-body-small',
        text: ctx.t('authenticator.privacy.cached', '{count} secrets are held in this window’s memory so the codes can tick.', {
          values: { count: store().cachedSecretCount() }
        })
      })
    );

    const vaultLine = el('p', { className: 'md-typescale-body-small', attrs: { role: 'status' } });
    footer.append(vaultLine);
    void ctx.studio.vault.status().then((result) => {
      if (!result.ok) {
        vaultLine.textContent = result.error;
        return;
      }
      vaultLine.textContent = ctx.t('authenticator.privacy.vault', 'Credential vault: {backend}, {state}.', {
        values: {
          backend: result.value.backend,
          state: result.value.encryptionAvailable
            ? ctx.t('authenticator.privacy.vault.encrypted', 'encrypted by the operating system')
            : ctx.t('authenticator.privacy.vault.plain', 'NOT encrypted on this machine')
        }
      });
    });
  }

  /* ---------------- the tick ---------------- */

  const timer = window.setInterval(() => {
    const now = correctedNow(ctx);
    for (const row of rows.values()) row.tick(now);
  }, 250);

  const stopDrift = onDrift(() => redraw());
  // Every mutation lands in the settings store, so one subscription there keeps
  // this surface honest whether the change came from a row, the palette, the
  // settings tab or another window of this application.
  const unsubscribeSettings = ctx.settings.onChange((change) => {
    if (change.id.startsWith('authenticator.')) redraw();
  });

  ctx.onDispose(() => {
    window.clearInterval(timer);
    stopDrift();
    unsubscribeSettings();
    search.destroy();
    for (const row of rows.values()) row.dispose();
    for (const stop of rovingDisposers) stop();
  });

  redraw();
  window.setTimeout(() => {
    const now = correctedNow(ctx);
    for (const row of rows.values()) row.tick(now);
  }, 0);
}

/* ================================================================== */
/* Shared surfaces                                                     */
/* ================================================================== */

function drawClockBanner(ctx: AppContext, host: HTMLElement, onChanged: () => void): void {
  const state = verdict(ctx);
  if (state.severity === 'ok' && state.reasons.length === 0) return;

  const banner = el('div', {
    className: `authenticator-banner authenticator-banner--${state.severity}`,
    attrs: { role: state.severity === 'warning' ? 'alert' : 'status' }
  });
  banner.append(el('h2', { className: 'md-typescale-title-small', text: ctx.t('authenticator.clock.title', 'The clock') }));

  for (const reason of state.reasons) {
    let text = '';
    if (reason === 'unchecked') text = ctx.t('authenticator.clock.unchecked', 'This computer’s clock has never been checked against another device.');
    else if (reason === 'measuredLarge' && state.measuredSeconds !== null) {
      text = ctx.t(
        'authenticator.clock.measured',
        'This computer’s clock is {seconds} seconds away from the reference you gave on {when}.',
        {
          values: {
            seconds: state.measuredSeconds - state.offsetSeconds,
            when: state.checkedAt ? new Date(state.checkedAt).toLocaleString() : '—'
          }
        }
      );
    } else if (reason === 'offsetApplied') {
      text = ctx.t('authenticator.clock.offsetApplied', 'Codes are being computed with a manual correction of {seconds} seconds.', {
        values: { seconds: state.offsetSeconds }
      });
    } else if (reason === 'drifted') {
      text = ctx.t('authenticator.clock.drifted', 'The system clock moved {seconds} seconds relative to the steady clock.', {
        values: { seconds: Math.round(state.driftSeconds) }
      });
    } else if (reason === 'implausible') {
      text = ctx.t('authenticator.clock.implausible', 'This computer’s clock reads a year that cannot be right.');
    } else if (reason === 'checkedRecentlyOk') {
      text = ctx.t('authenticator.clock.ok', 'The clock was checked and agrees with your other device.');
    }
    if (text !== '') banner.append(el('p', { className: 'md-typescale-body-medium', text }));
  }

  banner.append(
    el('p', {
      className: 'md-typescale-body-small',
      text: ctx.t('authenticator.clock.timezone', 'Time zones never matter here.')
    })
  );

  const checkButton = ctx.components.button({
    label: 'authenticator.clock.checkAction',
    variant: 'tonal',
    icon: 'calendar',
    id: 'authenticator-clock-check',
    onClick: () => openClockCheck(ctx, checkButton, onChanged)
  });
  banner.append(checkButton);

  if (state.reasons.includes('drifted')) {
    banner.append(
      ctx.components.button({
        label: 'authenticator.clock.acknowledge',
        variant: 'text',
        onClick: () => {
          clearDrift();
          onChanged();
        }
      })
    );
  }

  if (state.offsetSeconds !== 0) {
    banner.append(
      ctx.components.button({
        label: 'authenticator.clock.clear',
        variant: 'text',
        onClick: () => {
          applyCorrection(ctx, 0);
          onChanged();
        }
      })
    );
  }

  host.append(banner);
}

export function openClockCheck(ctx: AppContext, anchor: HTMLElement, onChanged: () => void): void {
  const overlay = ctx.overlay.open({
    anchor,
    role: 'dialog',
    label: ctx.t('authenticator.clock.checkAction', 'Check against another device'),
    resizeKey: 'authenticator-clock',
    dragKey: 'authenticator-clock'
  });
  const result = el('p', { className: 'md-typescale-body-medium', attrs: { role: 'status' } });
  const error = el('p', { className: 'authenticator-register__status--error md-typescale-body-small', attrs: { role: 'status' } });
  let measured: number | null = null;
  const actions = el('div', { className: 'authenticator-clock__actions' });

  const field = ctx.components.textField({
    label: 'authenticator.clock.reference',
    supportingText: 'authenticator.clock.reference.hint',
    onCommit: (value) => record(value)
  });

  function record(value: string): void {
    const parsed = parseReferenceTime(value);
    if (parsed.value === null) {
      error.textContent = parsed.error ?? '';
      return;
    }
    error.textContent = '';
    measured = recordReferenceCheck(ctx, parsed.value);
    result.textContent = ctx.t('authenticator.clock.result', 'This computer is {seconds} seconds away from that reading.', {
      values: { seconds: measured }
    });
    actions.textContent = '';
    if (measured !== 0) {
      actions.append(
        ctx.components.button({
          label: ctx.t('authenticator.clock.apply', 'Correct the codes by {seconds} seconds', {
            values: { seconds: measured }
          }),
          variant: 'filled',
          onClick: () => {
            applyCorrection(ctx, measured ?? 0);
            overlay.close();
            onChanged();
          }
        })
      );
    }
    onChanged();
  }

  overlay.body.append(
    ctx.components.sectionHeading({ title: 'authenticator.clock.checkAction' }),
    el('p', {
      className: 'md-typescale-body-medium',
      text: ctx.t('authenticator.clock.unchecked', 'Codes come from this computer’s clock.')
    }),
    field.root,
    ctx.components.button({ label: 'authenticator.clock.record', variant: 'tonal', onClick: () => record(field.get()) }),
    result,
    actions,
    error,
    el('p', {
      className: 'md-typescale-body-small',
      text: ctx.t('authenticator.clock.timezone', 'Time zones never matter here.')
    })
  );
}

function drawOrnamentalLockNotice(ctx: AppContext, host: HTMLElement): void {
  const locks = ctx.locks.list().filter((lock) => lock.method === 'totp');
  if (locks.length === 0) return;
  const productNames = new Set(
    [window.studio.info.productName, ctx.settings.get<string>('app.displayName', '')].filter(Boolean).map((name) => name.toLowerCase())
  );
  const own = store()
    .entries()
    .filter((entry) => productNames.has(entry.issuer.trim().toLowerCase()));
  if (own.length === 0) return;

  const banner = el('div', { className: 'authenticator-banner authenticator-banner--notice', attrs: { role: 'status' } });
  banner.append(
    el('h2', {
      className: 'md-typescale-title-small',
      text: ctx.t('authenticator.ownLock.title', 'One of this application’s own locks is kept here')
    }),
    el('p', {
      className: 'md-typescale-body-medium',
      text: ctx.t(
        'authenticator.ownLock.body',
        'That lock is now ornamental: the key is sitting inside the box it opens.'
      )
    }),
    el('p', { className: 'md-typescale-body-small', text: own.map((entry) => describeEntry(entry)).join(', ') })
  );
  host.append(banner);
}

/* ------------------------------------------------------------------ */
/* Group picker                                                        */
/* ------------------------------------------------------------------ */

export function openGroupPicker(ctx: AppContext, anchor: HTMLElement, ids: string[], onDone: () => void): void {
  const overlay = ctx.overlay.open({
    anchor,
    role: 'dialog',
    label: ctx.t('authenticator.row.group', 'Move into group…'),
    resizeKey: 'authenticator-group-picker'
  });

  const list = ctx.components.list({ label: 'authenticator.groups.title' });
  const groups = store().groups();

  const draw = (query: SearchQuery | null): void => {
    list.textContent = '';
    const matching = groups.filter((group) => !query || query.matches(group.name));
    list.append(
      ctx.components.listItem({
        headline: ctx.t('authenticator.row.group.none', 'No group'),
        leadingIcon: 'close',
        onActivate: () => {
          void store()
            .setGroup(ids, null)
            .then(() => {
              overlay.close();
              onDone();
            });
        }
      })
    );
    for (const group of matching) {
      list.append(
        ctx.components.listItem({
          headline: group.name,
          supporting: `${store().entries().filter((entry) => entry.group === group.id).length}`,
          leadingIcon: 'folder',
          onActivate: () => {
            void store()
              .setGroup(ids, group.id)
              .then(() => {
                overlay.close();
                onDone();
              });
          }
        })
      );
    }
    if (matching.length === 0) {
      list.append(el('p', { className: 'md-typescale-body-small', text: ctx.t('authenticator.groups.empty', 'No groups yet.') }));
    }
  };

  const search = ctx.createSearchBar({
    label: 'authenticator.groups.search',
    compact: true,
    sample: groups.map((group) => group.name).join('\n'),
    onChange: (query) => draw(query)
  });

  const nameField = ctx.components.textField({ label: 'authenticator.groups.name' });
  const create = ctx.components.button({
    label: 'authenticator.groups.create',
    variant: 'tonal',
    icon: 'add',
    onClick: async () => {
      const name = nameField.get().trim();
      if (name === '') return;
      const group = await store().createGroup(name, 'var(--md-sys-color-primary)');
      await store().setGroup(ids, group.id);
      overlay.close();
      onDone();
    }
  });

  overlay.body.append(
    ctx.components.sectionHeading({ title: 'authenticator.row.group' }),
    search.root,
    list,
    nameField.root,
    create
  );
  draw(null);
}

/* ------------------------------------------------------------------ */
/* Export                                                              */
/* ------------------------------------------------------------------ */

const SECRET_OMITTED = 'omitted — an ordinary export never carries secrets';

export function openExport(ctx: AppContext, anchor: HTMLElement, pick: () => AuthenticatorEntry[]): void {
  const overlay = ctx.overlay.open({
    anchor,
    role: 'dialog',
    label: ctx.t('authenticator.export', 'Export the list…'),
    resizeKey: 'authenticator-export'
  });

  const entries = pick();
  const records = entries.map((entry) => ({
    id: entry.id,
    label: entry.label,
    issuer: entry.issuer,
    account: entry.account,
    group: store().groupName(entry.group),
    algorithm: entry.algorithm,
    digits: entry.digits,
    period: entry.period,
    createdAt: entry.createdAt,
    verified: entry.verified,
    note: entry.note,
    secret: SECRET_OMITTED
  }));

  let format = ctx.exporter.formats()[0];
  const losses = el('ul', { className: 'authenticator-export__losses' });

  const refreshLosses = (): void => {
    losses.textContent = '';
    const preflight = ctx.exporter.preflight(records, format);
    for (const loss of preflight.losses) {
      losses.append(el('li', { className: 'md-typescale-body-small', text: `${loss.field}: ${loss.reason}` }));
    }
  };

  const formatSelect = ctx.components.select({
    label: 'authenticator.export.format',
    value: format,
    options: ctx.exporter.formats().map((candidate) => ({ value: candidate, label: candidate.toUpperCase() })),
    onChange: (value) => {
      format = value as typeof format;
      refreshLosses();
    }
  });

  const save = ctx.components.button({
    label: 'core.action.export',
    variant: 'filled',
    icon: 'upload',
    disabled: entries.length === 0,
    disabledReason: ctx.t('authenticator.bulk.none', 'Nothing is selected, so there is nothing to act on.'),
    onClick: async () => {
      const path = await ctx.exporter.save(records, format, {
        name: 'authenticator-entries',
        schemaVersion: '1',
        defaultFileName: 'authenticator-entries'
      });
      if (!path) return;
      ctx.notify.success(
        ctx.t('authenticator.export.done', 'Exported {count} entries to {path}', {
          values: { count: records.length, path },
          dialog: true
        })
      );
      overlay.close();
    }
  });

  overlay.body.append(
    ctx.components.sectionHeading({ title: 'authenticator.export' }),
    el('p', {
      className: 'md-typescale-body-medium',
      text: ctx.t(
        'authenticator.export.noSecrets',
        'An ordinary export carries the records and NOT the secrets. Every row says so in its own secret column.'
      )
    }),
    el('p', {
      className: 'md-typescale-body-small',
      text: ctx.t('authenticator.count', '{shown} of {total} shown', {
        values: { shown: records.length, total: store().entries().length }
      })
    }),
    formatSelect.root,
    losses,
    save
  );
  refreshLosses();
}

/**
 * The deliberate secrets export.
 *
 * It is a separate, explicitly named action behind the two-key gate, and it says
 * plainly what the resulting file is: every secret in readable form, which
 * anybody who copies the file can use to generate these codes for ever.
 */
export async function exportSecrets(ctx: AppContext, anchor: HTMLElement): Promise<void> {
  const entries = store().entries();
  if (entries.length === 0) {
    ctx.notify.info(
      ctx.t('authenticator.empty.title', 'No entries yet', { dialog: true }),
      ctx.t('authenticator.empty.body', 'Add an account and its codes appear here.')
    );
    return;
  }

  const confirmed = await ctx.confirm.request({
    action: ctx.t('authenticator.exportSecrets.action', 'Write the secrets in the clear'),
    affected: entries.map((entry) => describeEntry(entry)),
    irreversible: ctx.t(
      'authenticator.exportSecrets.irreversible',
      'A file of readable secrets will exist on this computer. Anyone who copies it can generate these codes for ever, and there is no way to withdraw it afterwards.'
    ),
    anchor,
    confirmLabel: ctx.t('authenticator.exportSecrets.action', 'Write the secrets in the clear')
  });
  if (!confirmed) return;

  const lines: string[] = [
    '# Authenticator secrets, written in the clear.',
    '# Anybody who reads this file can generate these codes. Delete it when you are done.',
    `# Written ${new Date().toISOString()} by this application on this computer.`,
    ''
  ];
  const missing: string[] = [];
  for (const entry of entries) {
    const secret = await store().secretFor(entry.id);
    if (secret === null) {
      missing.push(describeEntry(entry));
      continue;
    }
    lines.push(
      buildPairingUri({
        issuer: entry.issuer,
        account: entry.account,
        secret,
        algorithm: entry.algorithm,
        digits: entry.digits,
        period: entry.period
      })
    );
  }
  if (missing.length > 0) {
    lines.push('', '# These entries had no secret in the credential vault and could not be written:');
    for (const name of missing) lines.push(`# ${name}`);
  }

  const destination = await ctx.studio.dialog.saveFile({
    title: ctx.t('authenticator.exportSecrets', 'Export the secrets in the clear…'),
    defaultPath: 'authenticator-secrets.txt',
    filters: [{ name: 'Text', extensions: ['txt'] }]
  });
  if (!destination.ok || !destination.value) return;

  const written = await ctx.studio.fs.writeText(destination.value, `${lines.join('\n')}\n`);
  if (!written.ok) {
    ctx.notify.error(ctx.t('authenticator.error.title', 'That did not work', { dialog: true }), written.error);
    return;
  }
  await ctx.history.record('Exported authenticator secrets in the clear', 'authenticator', {
    count: entries.length - missing.length,
    path: destination.value
  });
  ctx.notify.warn(
    ctx.t('authenticator.exportSecrets', 'Export the secrets in the clear…', { dialog: true }),
    ctx.t('authenticator.exportSecrets.warning', 'This writes every secret in readable form.')
  );
}

/* ================================================================== */
/* Verification tab                                                    */
/* ================================================================== */

export function mountChecks(host: HTMLElement, ctx: TabContext): void {
  host.append(
    ctx.components.topAppBar({ title: 'authenticator.checks.title', subtitle: 'authenticator.checks.intro' })
  );

  const intro = el('p', {
    className: 'md-typescale-body-medium',
    text: ctx.t('authenticator.checks.intro', 'These checks run the real code that produces your codes.')
  });
  const status = el('p', { className: 'md-typescale-body-medium', attrs: { role: 'status', 'aria-live': 'polite' } });
  status.textContent = ctx.t('authenticator.checks.never', 'These have not been run in this session yet.');

  const progress = ctx.components.linearProgress({ label: 'authenticator.checks.title', value: 0 });
  progress.root.hidden = true;

  const results = el('div', { className: 'authenticator-checks', attrs: { id: 'authenticator-checks' } });

  const run = ctx.components.button({
    label: 'authenticator.checks.run',
    variant: 'filled',
    icon: 'play',
    id: 'authenticator-run-checks',
    onClick: async () => {
      run.disabled = true;
      progress.root.hidden = false;
      progress.set(0);
      results.textContent = '';
      status.textContent = ctx.t('authenticator.checks.running', 'Running check {done} of {total}…', {
        values: { done: 0, total: checkCount() }
      });
      const report = await runSelfTest((done, total) => {
        progress.set(done / total);
        status.textContent = ctx.t('authenticator.checks.running', 'Running check {done} of {total}…', {
          values: { done, total }
        });
      });
      progress.root.hidden = true;
      run.disabled = false;
      drawReport(report);
    }
  });

  function drawReport(report: SelfTestReport): void {
    status.textContent = `${ctx.t('authenticator.checks.summary', '{passed} passed, {failed} failed, in {ms} milliseconds.', {
      values: { passed: report.passed, failed: report.failed, ms: report.totalMs }
    })} ${
      report.failed === 0
        ? ctx.t('authenticator.checks.allPassed', 'Every check passed.')
        : ctx.t('authenticator.checks.someFailed', '{failed} checks failed.', { values: { failed: report.failed } })
    }`;
    ctx.a11y.announce(status.textContent, report.failed > 0);

    results.textContent = '';
    for (const result of report.results) {
      const card = ctx.components.card({ variant: result.passed ? 'outlined' : 'filled' });
      card.classList.add(result.passed ? 'authenticator-check--passed' : 'authenticator-check--failed');
      card.append(
        el('div', { className: 'authenticator-check__head' , children: [
          ctx.components.badge({
            label: result.passed
              ? ctx.t('authenticator.checks.passed', 'Passed')
              : ctx.t('authenticator.checks.failed', 'Failed'),
            severity: result.passed ? 'success' : 'error'
          }),
          el('span', { className: 'md-typescale-title-small', text: result.name })
        ]}),
        el('p', { className: 'md-typescale-body-small', text: result.detail }),
        el('p', { className: 'md-typescale-label-small', text: `${result.id} · ${result.durationMs} ms` })
      );
      results.append(card);
    }

    void ctx.history.record('Ran the authenticator verification checks', 'authenticator', {
      passed: report.passed,
      failed: report.failed,
      totalMs: report.totalMs
    });
  }

  const clockButton = ctx.components.button({
    label: 'authenticator.clock.checkAction',
    variant: 'tonal',
    icon: 'calendar',
    onClick: () => openClockCheck(ctx, clockButton, () => undefined)
  });

  const secretsButton = ctx.components.button({
    label: 'authenticator.exportSecrets',
    variant: 'outlined',
    icon: 'warning',
    danger: true,
    onClick: () => void exportSecrets(ctx, secretsButton)
  });

  host.append(intro, run, clockButton, secretsButton, progress.root, status, results);
}
