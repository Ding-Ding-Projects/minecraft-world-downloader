import { el } from '../../core/a11y';
import { defineFeature } from '../../core/registry';
import type { AppContext, SettingContext, TabContext } from '../../core/registry';
import { installUnlockPromptAdoption } from './adopt';
import { openSupportDesk } from './desk';
import { supportTicketsDocs } from './docs';
import { buildTicketForm } from './form';
import { buildTicketList } from './list';
import { MAX_TICKETS, SEVERITIES, severityKey } from './model';
import {
  buildResolutionCard,
  copyRecoveryFolder,
  openRecoveryFolder,
  recoveryFolder
} from './resolution';
import {
  ADOPT_UNLOCK_ID,
  DEFAULT_ADOPT_UNLOCK,
  DEFAULT_PAGE_SIZE,
  DEFAULT_SEVERITY,
  DEFAULT_SEVERITY_ID,
  PAGE_SIZE_ID,
  TAB_ID
} from './settingIds';
import { supportTicketsStrings } from './strings';
import { ticketStore } from './store';

/**
 * Support Tickets.
 *
 * The recovery route from a toy lock, dressed as a service desk. The joke is the
 * point; so is the plain line underneath it saying that nothing is sent
 * anywhere, that no ticket exists outside this computer, and that nobody is
 * reading it.
 *
 * The desk is this application's own and fictional. It borrows no real
 * organization's name or branding, invents no representative, quotes no response
 * time, and implies no human. The one thing it does that genuinely works is open
 * the application data folder — and then it stands back, because deleting that
 * folder is the user's own action in their own file manager and this application
 * has no code path that does it for them.
 */

function mountDesk(host: HTMLElement, ctx: TabContext): () => void {
  host.append(
    ctx.components.topAppBar({
      title: 'supportTickets.title',
      subtitle: 'supportTickets.subtitle'
    })
  );

  host.append(
    el('p', {
      className: 'md-typescale-body-small',
      text: ctx.t('supportTickets.fictional', 'The desk is fictional and belongs to this application.')
    })
  );

  host.append(buildResolutionCard(ctx));

  const list = buildTicketList(ctx);
  const form = buildTicketForm(ctx, {
    onCreated: () => {
      list.refresh();
      list.root.scrollIntoView({ block: 'nearest' });
    }
  });

  host.append(form.root, list.root);

  return () => list.destroy();
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

function renderFolderSetting(host: HTMLElement, ctx: SettingContext): void {
  const folder = recoveryFolder(ctx);
  const field = ctx.components.textField({
    label: 'supportTickets.resolution.pathLabel',
    value: folder,
    supportingText: 'supportTickets.resolution.pathSupport'
  });
  const input = field.root.querySelector('input');
  if (input) {
    input.readOnly = true;
    input.setAttribute('aria-readonly', 'true');
  }

  const status = el('p', {
    className: 'md-field__support md-typescale-body-small',
    attrs: { role: 'status', 'aria-live': 'polite' }
  });

  const actions = el('div', { className: 'md-confirm__actions' });
  actions.style.display = 'flex';
  actions.style.flexWrap = 'wrap';
  actions.style.gap = '8px';
  actions.append(
    ctx.components.button({
      label: 'supportTickets.resolution.copy',
      variant: 'outlined',
      icon: 'copy',
      onClick: () => {
        void copyRecoveryFolder(ctx).then((result) => {
          status.classList.toggle('md-field__support--error', !result.ok);
          status.textContent = result.ok
            ? ctx.t('supportTickets.resolution.copied', 'The path was copied to the clipboard.')
            : ctx.t(
                'supportTickets.resolution.copyFailed',
                'The clipboard refused the copy: {message}. The path is {path}.',
                { values: { message: result.error, path: folder } }
              );
          ctx.a11y.announce(status.textContent, !result.ok);
        });
      }
    }),
    ctx.components.button({
      label: 'supportTickets.resolution.open',
      variant: 'tonal',
      icon: 'folder',
      onClick: () => {
        void openRecoveryFolder(ctx).then((result) => {
          status.classList.toggle('md-field__support--error', !result.ok);
          status.textContent = result.ok
            ? ctx.t('supportTickets.resolution.opened', 'The folder was opened in the file manager.')
            : ctx.t(
                'supportTickets.resolution.openFailed',
                'The file manager could not be opened: {message}. The folder is {path}.',
                { values: { message: result.error, path: folder } }
              );
          ctx.a11y.announce(status.textContent, !result.ok);
        });
      }
    })
  );

  host.append(
    field.root,
    actions,
    status,
    el('p', {
      className: 'md-typescale-body-small',
      text: ctx.t(
        'supportTickets.resolution.neverDeletes',
        'This application never deletes that folder.'
      )
    })
  );
}

function renderPruneSetting(host: HTMLElement, ctx: SettingContext): void {
  let chosen: string | null = null;

  const status = el('p', {
    className: 'md-field__support md-typescale-body-small',
    attrs: { role: 'status', 'aria-live': 'polite' }
  });

  // Declared before anything that can call `refresh`, so no path reaches it
  // before it exists — a picker that fires its own change during construction
  // would otherwise throw where the interface merely looks empty.
  const remove = ctx.components.button({
    label: 'supportTickets.bulk.delete',
    variant: 'outlined',
    icon: 'trash',
    danger: true,
    disabled: true,
    disabledReason: ctx.t('supportTickets.settings.prune.pick', 'Choose a date first.'),
    onClick: () => {
      if (!chosen) return;
      const ids = ticketStore.raisedBefore(chosen);
      if (ids.length === 0) return;
      void ctx.confirm
        .request({
          anchor: remove,
          action: ctx.t('supportTickets.confirm.deleteAction', 'Delete {count} support tickets', {
            values: { count: String(ids.length) }
          }),
          affected: ids,
          irreversible: ctx.t(
            'supportTickets.confirm.deleteIrreversible',
            'These ticket records are removed from this application permanently.'
          )
        })
        .then((confirmed) => {
          if (!confirmed) return;
          const outcome = ticketStore.remove(ids);
          const message = ctx.t(
            'supportTickets.notify.deleted',
            '{count} tickets deleted from this computer',
            { values: { count: String(outcome.changed.length) } }
          );
          ctx.notify.success(
            ctx.t('supportTickets.title', 'Support Tickets', { dialog: true }),
            message
          );
          ctx.a11y.announce(message);
          refresh();
        });
    }
  });

  const refresh = (): void => {
    if (!chosen) {
      status.textContent = '';
      remove.disabled = true;
      remove.title = ctx.t('supportTickets.settings.prune.pick', 'Raised before');
      return;
    }
    const ids = ticketStore.raisedBefore(chosen);
    status.textContent =
      ids.length === 0
        ? ctx.t('supportTickets.settings.prune.none', 'No stored ticket was raised before {date}.', {
            values: { date: chosen }
          })
        : ctx.t('supportTickets.settings.prune.count', '{count} tickets were raised before {date}.', {
            values: { count: String(ids.length), date: chosen }
          });
    remove.disabled = ids.length === 0;
    if (ids.length === 0) remove.title = status.textContent;
    else remove.removeAttribute('title');
  };

  const picker = ctx.components.datePicker({
    label: 'supportTickets.settings.prune.pick',
    value: null,
    onChange: (value) => {
      chosen = value.start;
      refresh();
    }
  });

  const row = el('div');
  row.style.display = 'flex';
  row.style.flexWrap = 'wrap';
  row.style.gap = '12px';
  row.style.alignItems = 'flex-end';
  row.append(picker.root, remove);
  host.append(row, status);
  refresh();
}

/* ------------------------------------------------------------------ */
/* The module                                                          */
/* ------------------------------------------------------------------ */

export default defineFeature({
  id: 'support-tickets',
  name: 'Support Tickets',
  description:
    'A local, fictional support desk whose resolution opens the application data folder so a locked-out user can delete it themselves. Nothing is sent anywhere.',

  strings: supportTicketsStrings,
  docs: supportTicketsDocs,

  tabs: [
    {
      id: TAB_ID,
      title: 'supportTickets.title',
      icon: 'lockOpen',
      group: 'group.security',
      order: 860,
      mount: mountDesk
    }
  ],

  settings: [
    {
      id: 'supportTickets',
      title: 'supportTickets.settings.section',
      icon: 'lockOpen',
      order: 620,
      controls: [
        {
          id: DEFAULT_SEVERITY_ID,
          label: 'supportTickets.settings.defaultSeverity',
          description: 'supportTickets.settings.defaultSeverity.description',
          kind: 'select',
          defaultValue: DEFAULT_SEVERITY,
          keywords: ['support', 'ticket', 'severity', 'priority', 'desk'],
          options: SEVERITIES.map((value) => ({ value, label: severityKey(value) }))
        },
        {
          id: PAGE_SIZE_ID,
          label: 'supportTickets.settings.pageSize',
          description: 'supportTickets.settings.pageSize.description',
          kind: 'number',
          defaultValue: DEFAULT_PAGE_SIZE,
          min: 5,
          max: 200,
          step: 5,
          keywords: ['support', 'ticket', 'rows', 'page', 'list'],
          validate: (value) => {
            const parsed = Number(value);
            if (!Number.isFinite(parsed)) return 'That is not a number.';
            if (parsed < 5 || parsed > 200) return 'Choose a number between 5 and 200.';
            return null;
          }
        },
        {
          id: ADOPT_UNLOCK_ID,
          label: 'supportTickets.settings.adopt',
          description: 'supportTickets.settings.adopt.description',
          kind: 'switch',
          defaultValue: DEFAULT_ADOPT_UNLOCK,
          keywords: ['support', 'ticket', 'unlock', 'lock', 'forgotten', 'password', 'recovery']
        },
        {
          id: 'supportTickets.openDesk',
          label: 'supportTickets.settings.openDesk',
          description: 'supportTickets.settings.openDesk.description',
          kind: 'action',
          defaultValue: '',
          keywords: ['support', 'ticket', 'desk', 'open', 'help'],
          run: (ctx) => ctx.tabs.open(TAB_ID)
        },
        {
          id: 'supportTickets.folder',
          label: 'supportTickets.settings.folder',
          description: 'supportTickets.settings.folder.description',
          kind: 'custom',
          defaultValue: '',
          lockable: false,
          lockableReason:
            'This is the recovery route out of every other lock. Locking it would make a lockout unrecoverable, which is the one thing a toy lock must never do.',
          keywords: ['folder', 'application data', 'recovery', 'reset', 'delete', 'lockout'],
          render: renderFolderSetting
        },
        {
          id: 'supportTickets.prune',
          label: 'supportTickets.settings.prune',
          description: 'supportTickets.settings.prune.description',
          kind: 'custom',
          defaultValue: '',
          keywords: ['support', 'ticket', 'prune', 'delete', 'retention', 'old'],
          render: renderPruneSetting
        }
      ]
    }
  ],

  palette: [
    {
      id: 'supportTickets.palette.open',
      title: 'supportTickets.palette.open',
      subtitle: 'supportTickets.palette.openSubtitle',
      icon: 'lockOpen',
      kind: 'destination',
      keywords: ['support', 'ticket', 'desk', 'help', 'locked out', 'forgotten password', '客服'],
      teleport: { tabId: TAB_ID }
    },
    {
      id: 'supportTickets.palette.newTicket',
      title: 'supportTickets.palette.newTicket',
      icon: 'add',
      kind: 'command',
      keywords: ['support', 'ticket', 'raise', 'new', 'complaint'],
      teleport: { tabId: TAB_ID, elementId: 'supportTickets-form' }
    },
    {
      id: 'supportTickets.palette.resolution',
      title: 'supportTickets.resolution.heading',
      subtitle: 'supportTickets.resolution.lede',
      icon: 'folder',
      kind: 'destination',
      keywords: ['recovery', 'reset', 'application data', 'folder', 'unlock', 'delete'],
      teleport: { tabId: TAB_ID, elementId: 'supportTickets-resolution' }
    },
    {
      id: 'supportTickets.setting.defaultSeverity',
      title: 'supportTickets.settings.defaultSeverity',
      icon: 'tune',
      kind: 'setting',
      settingId: DEFAULT_SEVERITY_ID,
      keywords: ['support', 'ticket', 'severity']
    },
    {
      id: 'supportTickets.setting.pageSize',
      title: 'supportTickets.settings.pageSize',
      icon: 'tune',
      kind: 'setting',
      settingId: PAGE_SIZE_ID,
      keywords: ['support', 'ticket', 'rows', 'page size']
    },
    {
      id: 'supportTickets.setting.adopt',
      title: 'supportTickets.settings.adopt',
      icon: 'tune',
      kind: 'setting',
      settingId: ADOPT_UNLOCK_ID,
      keywords: ['support', 'ticket', 'unlock prompt', 'forgotten password']
    }
  ],

  init(ctx: AppContext) {
    ticketStore.attach(ctx);

    // The unlock prompt's "Forgotten your password?" link opens the core's own
    // short recovery note. With the setting on, that surface is filled with the
    // full desk instead; with it off, the built-in note is left untouched.
    installUnlockPromptAdoption(ctx);

    // Two commands that need a live anchor, so they are registered here rather
    // than declared statically: both open a surface beside whatever the user was
    // last using, falling back to the document body when nothing has focus.
    ctx.palette.add([
      {
        id: 'supportTickets.command.openFolder',
        title: 'supportTickets.palette.openFolder',
        icon: 'folder',
        kind: 'command',
        keywords: ['application data', 'folder', 'reveal', 'reset', 'recovery'],
        run: () => {
          void openRecoveryFolder(ctx).then((result) => {
            if (result.ok) {
              ctx.notify.success(
                ctx.t('supportTickets.title', 'Support Tickets', { dialog: true }),
                ctx.t('supportTickets.resolution.opened', 'The folder was opened in the file manager.')
              );
              void ctx.history.record('Opened the application data folder', 'supportTickets', {
                path: recoveryFolder(ctx)
              });
              return;
            }
            ctx.notify.error(
              ctx.t('supportTickets.title', 'Support Tickets', { dialog: true }),
              ctx.t(
                'supportTickets.resolution.openFailed',
                'The file manager could not be opened: {message}. The folder is {path}.',
                { values: { message: result.error, path: recoveryFolder(ctx) } }
              )
            );
          });
        }
      },
      {
        id: 'supportTickets.command.copyFolder',
        title: 'supportTickets.palette.copyFolder',
        icon: 'copy',
        kind: 'command',
        keywords: ['application data', 'folder', 'copy', 'path'],
        run: () => {
          void copyRecoveryFolder(ctx).then((result) => {
            if (result.ok) {
              ctx.notify.success(
                ctx.t('supportTickets.title', 'Support Tickets', { dialog: true }),
                ctx.t('supportTickets.resolution.copied', 'The path was copied to the clipboard.')
              );
              return;
            }
            ctx.notify.error(
              ctx.t('supportTickets.title', 'Support Tickets', { dialog: true }),
              ctx.t(
                'supportTickets.resolution.copyFailed',
                'The clipboard refused the copy: {message}. The path is {path}.',
                { values: { message: result.error, path: recoveryFolder(ctx) } }
              )
            );
          });
        }
      },
      {
        id: 'supportTickets.command.openDesk',
        title: 'supportTickets.help.link',
        icon: 'lockOpen',
        kind: 'command',
        keywords: ['forgotten password', 'locked out', 'help', 'recovery', 'support'],
        run: () => {
          const anchor =
            document.activeElement instanceof HTMLElement && document.activeElement !== document.body
              ? document.activeElement
              : (document.querySelector<HTMLElement>('.md-titlebar') ?? document.body);
          openSupportDesk(ctx, { anchor });
        }
      }
    ]);

    // A store that is at its ceiling refuses new tickets, and says so once at
    // startup rather than only at the moment somebody tries and is refused.
    const stored = ticketStore.all().length;
    if (stored >= MAX_TICKETS) {
      ctx.notify.warn(
        ctx.t('supportTickets.title', 'Support Tickets', { dialog: true }),
        ctx.t(
          'supportTickets.list.full',
          '{max} tickets are stored, which is the limit. Delete one before raising another.',
          { values: { max: String(MAX_TICKETS) } }
        )
      );
    }
  }
});
