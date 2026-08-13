import { el } from '../../core/a11y';
import type { AppContext } from '../../core/registry';
import {
  CATEGORIES,
  MAX_DESCRIPTION,
  SEVERITIES,
  categoryKey,
  severityKey
} from './model';
import type { SupportTicket, TicketCategory, TicketSeverity } from './model';
import { DEFAULT_SEVERITY_ID } from './settingIds';
import { ticketStore } from './store';

/**
 * The ticket form.
 *
 * It is a real form producing a real local record: a category, a severity that
 * is stored and honoured by nobody, and a description. Every control is the
 * component kit's own, so the category and severity pickers carry their filter
 * fields and pattern builders like every other dropdown in the application.
 *
 * The validation is honest. An empty description is refused with a sentence
 * saying so, an over-long one is refused with the exact count and the exact
 * limit, and a full store is refused with the exact number stored. None of those
 * refusals lose what the user typed.
 */

export interface TicketFormOptions {
  /** Compact drops the section heading, for the anchored desk. */
  compact?: boolean;
  onCreated?(ticket: SupportTicket): void;
}

export interface TicketFormHandle {
  root: HTMLElement;
  focus(): void;
}

export function buildTicketForm(ctx: AppContext, options: TicketFormOptions = {}): TicketFormHandle {
  const root = ctx.components.card({ variant: 'outlined' });
  root.id = 'supportTickets-form';
  root.setAttribute('data-appearance-id', 'supportTickets:form');

  if (!options.compact) {
    root.append(
      ctx.components.sectionHeading({
        title: 'supportTickets.new.heading',
        description: 'supportTickets.new.description'
      })
    );
  } else {
    root.append(
      el('h3', {
        className: 'md-typescale-title-small',
        text: ctx.t('supportTickets.new.heading', 'Raise a ticket')
      })
    );
  }

  root.append(
    el('p', {
      className: 'md-typescale-body-small',
      text: ctx.t('supportTickets.fictional', 'The desk is fictional and belongs to this application.')
    })
  );

  const category = ctx.components.select({
    label: 'supportTickets.field.category',
    value: 'lockout',
    options: CATEGORIES.map((value) => ({ value, label: categoryKey(value) })),
    id: 'supportTickets-category'
  });

  const storedSeverity = ctx.settings.get<string>(DEFAULT_SEVERITY_ID, 'urgent');
  const initialSeverity: TicketSeverity = (SEVERITIES as string[]).includes(storedSeverity)
    ? (storedSeverity as TicketSeverity)
    : 'urgent';

  const severity = ctx.components.select({
    label: 'supportTickets.field.severity',
    value: initialSeverity,
    options: SEVERITIES.map((value) => ({ value, label: severityKey(value) })),
    id: 'supportTickets-severity'
  });
  severity.root.append(
    el('p', {
      className: 'md-field__support md-typescale-body-small',
      text: ctx.t(
        'supportTickets.field.severity.hint',
        'Stored with the ticket. Nothing treats one severity differently from another.'
      )
    })
  );

  const description = ctx.components.textField({
    label: 'supportTickets.field.description',
    multiline: true,
    rows: options.compact ? 3 : 5,
    placeholder: ctx.t(
      'supportTickets.field.description.placeholder',
      'Up to {max} characters. Stored locally.',
      { values: { max: String(MAX_DESCRIPTION) } }
    ),
    supportingText: ctx.t(
      'supportTickets.field.description.placeholder',
      'Up to {max} characters. Stored locally.',
      { values: { max: String(MAX_DESCRIPTION) } }
    ),
    id: 'supportTickets-description'
  });

  const status = el('p', {
    className: 'md-field__support md-typescale-body-small',
    attrs: { role: 'status', 'aria-live': 'polite' }
  });

  const fail = (message: string): void => {
    status.classList.add('md-field__support--error');
    status.textContent = message;
    ctx.a11y.announce(message, true);
    description.focus();
  };

  const submit = ctx.components.button({
    label: 'supportTickets.action.submit',
    variant: 'filled',
    icon: 'add',
    onClick: () => {
      status.classList.remove('md-field__support--error');
      status.textContent = '';
      const outcome = ticketStore.create({
        category: category.get() as TicketCategory,
        severity: severity.get() as TicketSeverity,
        description: description.get()
      });
      if (!outcome.ok) {
        if (outcome.reason === 'empty') {
          fail(ctx.t('supportTickets.field.description.empty', 'Write something first, even one word.'));
        } else if (outcome.reason === 'tooLong') {
          fail(
            ctx.t(
              'supportTickets.field.description.tooLong',
              'That is {count} characters. The limit is {max}.',
              { values: { count: String(outcome.detail.count), max: String(outcome.detail.max) } }
            )
          );
        } else {
          fail(
            ctx.t(
              'supportTickets.list.full',
              '{max} tickets are stored, which is the limit. Delete one before raising another.',
              { values: { max: String(outcome.detail.max) } }
            )
          );
        }
        return;
      }

      description.set('');
      const created = ctx.t('supportTickets.notify.created', 'Ticket {ticket} raised', {
        values: { ticket: outcome.ticket.id }
      });
      status.textContent = created;
      ctx.a11y.announce(created);
      ctx.notify.success(
        ctx.t('supportTickets.title', 'Support Tickets', { dialog: true }),
        `${created} — ${ctx.t(
          'supportTickets.resolution.always',
          'The resolution is available immediately.'
        )}`
      );
      options.onCreated?.(outcome.ticket);
    }
  });

  const clear = ctx.components.button({
    label: 'supportTickets.action.reset',
    variant: 'text',
    onClick: () => {
      description.set('');
      status.classList.remove('md-field__support--error');
      status.textContent = '';
      description.focus();
    }
  });

  const actions = el('div', { className: 'md-confirm__actions' });
  actions.style.display = 'flex';
  actions.style.flexWrap = 'wrap';
  actions.style.gap = '8px';
  actions.append(clear, submit);

  root.append(category.root, severity.root, description.root, actions, status);
  ctx.appearance.applyTo(root, 'supportTickets:form');

  return {
    root,
    focus: () => description.focus()
  };
}
