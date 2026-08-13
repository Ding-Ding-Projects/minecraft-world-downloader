import type { AppContext } from '../../core/registry';
import {
  MAX_DESCRIPTION,
  MAX_RESPONSES,
  MAX_TICKETS,
  RECORDS_KEY,
  generateTicketNumber,
  nextStatus,
  replyKey,
  sanitizeTicket
} from './model';
import type { SupportTicket, TicketCategory, TicketSeverity, TicketStatus } from './model';

/**
 * The local ticket store.
 *
 * Tickets live in this application's own settings document, beside every other
 * local record. There is no queue, no outbox, no retry loop and no transport:
 * a ticket is created, read and deleted entirely on this machine, and deleting
 * the application data folder removes the lot — which is the same folder every
 * ticket's resolution points at.
 *
 * Every mutation is recorded through the history recorder, so a change here is
 * as undoable and as auditable as any other change the user makes. A history
 * write that fails never fails the operation the user asked for; the recorder
 * already guarantees that.
 */

export interface CreateTicketInput {
  category: TicketCategory;
  severity: TicketSeverity;
  description: string;
}

export type CreateOutcome =
  | { ok: true; ticket: SupportTicket }
  | { ok: false; reason: 'empty' | 'tooLong' | 'full'; detail: { count: number; max: number } };

export interface BulkOutcome {
  changed: string[];
  /** Ticket id mapped to the i18n key explaining exactly why it was skipped. */
  skipped: Array<{ id: string; reasonKey: string }>;
}

type Listener = () => void;

export class TicketStore {
  private ctx: AppContext | null = null;
  private readonly listeners = new Set<Listener>();

  attach(ctx: AppContext): void {
    this.ctx = ctx;
    // A settings change from anywhere — an import, a reset, another surface —
    // repaints every mounted list rather than leaving a stale one on screen.
    ctx.settings.onChange((change) => {
      if (change.id === RECORDS_KEY) this.emit();
    });
  }

  onChange(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    for (const listener of [...this.listeners]) {
      try {
        listener();
      } catch (error) {
        console.error('A Support Tickets listener threw:', error);
      }
    }
  }

  /** Every stored ticket, newest first, with anything malformed dropped. */
  all(): SupportTicket[] {
    const ctx = this.ctx;
    if (!ctx) return [];
    const stored = ctx.settings.get<unknown>(RECORDS_KEY, []);
    if (!Array.isArray(stored)) return [];
    const tickets: SupportTicket[] = [];
    for (const candidate of stored) {
      const ticket = sanitizeTicket(candidate);
      if (ticket) tickets.push(ticket);
    }
    tickets.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    return tickets;
  }

  byId(id: string): SupportTicket | null {
    return this.all().find((ticket) => ticket.id === id) ?? null;
  }

  private write(tickets: SupportTicket[]): void {
    this.ctx?.settings.set(RECORDS_KEY, tickets);
    this.emit();
  }

  private record(action: string, payload: unknown): void {
    void this.ctx?.history.record(action, 'supportTickets', payload);
  }

  private reply(ticket: SupportTicket, status: TicketStatus): SupportTicket {
    const responses = [
      ...ticket.responses,
      { at: new Date().toISOString(), key: replyKey(status), values: { ticket: ticket.id } }
    ].slice(-MAX_RESPONSES);
    return { ...ticket, responses };
  }

  create(input: CreateTicketInput): CreateOutcome {
    const description = input.description.trim();
    if (description === '') {
      return { ok: false, reason: 'empty', detail: { count: 0, max: MAX_DESCRIPTION } };
    }
    if (description.length > MAX_DESCRIPTION) {
      return {
        ok: false,
        reason: 'tooLong',
        detail: { count: description.length, max: MAX_DESCRIPTION }
      };
    }
    const existing = this.all();
    if (existing.length >= MAX_TICKETS) {
      return { ok: false, reason: 'full', detail: { count: existing.length, max: MAX_TICKETS } };
    }

    const now = new Date().toISOString();
    const id = generateTicketNumber(new Set(existing.map((ticket) => ticket.id)));
    const bare: SupportTicket = {
      id,
      category: input.category,
      severity: input.severity,
      status: 'received',
      description,
      createdAt: now,
      updatedAt: now,
      responses: []
    };
    // The canned first response arrives with the ticket. It is canned, it says
    // so, and it is generated here rather than pretending to have travelled.
    const ticket = this.reply(bare, 'received');
    this.write([ticket, ...existing]);
    this.record('Raised a support ticket', {
      id,
      category: ticket.category,
      severity: ticket.severity,
      descriptionLength: description.length
    });
    return { ok: true, ticket };
  }

  /** Moves each ticket one status along, skipping any that is already closed. */
  advance(ids: string[]): BulkOutcome {
    const outcome: BulkOutcome = { changed: [], skipped: [] };
    const wanted = new Set(ids);
    const next = this.all().map((ticket) => {
      if (!wanted.has(ticket.id)) return ticket;
      const target = nextStatus(ticket.status);
      if (!target) {
        outcome.skipped.push({ id: ticket.id, reasonKey: 'supportTickets.bulk.skip.closed' });
        return ticket;
      }
      outcome.changed.push(ticket.id);
      return this.reply({ ...ticket, status: target, updatedAt: new Date().toISOString() }, target);
    });
    if (outcome.changed.length > 0) {
      this.write(next);
      this.record('Advanced support tickets', { ids: outcome.changed });
    }
    return outcome;
  }

  close(ids: string[]): BulkOutcome {
    const outcome: BulkOutcome = { changed: [], skipped: [] };
    const wanted = new Set(ids);
    const next = this.all().map((ticket) => {
      if (!wanted.has(ticket.id)) return ticket;
      if (ticket.status === 'closed') {
        outcome.skipped.push({ id: ticket.id, reasonKey: 'supportTickets.bulk.skip.closed' });
        return ticket;
      }
      outcome.changed.push(ticket.id);
      return this.reply({ ...ticket, status: 'closed', updatedAt: new Date().toISOString() }, 'closed');
    });
    if (outcome.changed.length > 0) {
      this.write(next);
      this.record('Closed support tickets', { ids: outcome.changed });
    }
    return outcome;
  }

  reopen(ids: string[]): BulkOutcome {
    const outcome: BulkOutcome = { changed: [], skipped: [] };
    const wanted = new Set(ids);
    const next = this.all().map((ticket) => {
      if (!wanted.has(ticket.id)) return ticket;
      if (ticket.status !== 'closed') {
        outcome.skipped.push({ id: ticket.id, reasonKey: 'supportTickets.bulk.skip.notClosed' });
        return ticket;
      }
      outcome.changed.push(ticket.id);
      return this.reply(
        { ...ticket, status: 'received', updatedAt: new Date().toISOString() },
        'received'
      );
    });
    if (outcome.changed.length > 0) {
      this.write(next);
      this.record('Reopened support tickets', { ids: outcome.changed });
    }
    return outcome;
  }

  setSeverity(ids: string[], severity: TicketSeverity): BulkOutcome {
    const outcome: BulkOutcome = { changed: [], skipped: [] };
    const wanted = new Set(ids);
    const next = this.all().map((ticket) => {
      if (!wanted.has(ticket.id)) return ticket;
      if (ticket.severity === severity) {
        outcome.skipped.push({ id: ticket.id, reasonKey: 'supportTickets.bulk.skip.sameSeverity' });
        return ticket;
      }
      outcome.changed.push(ticket.id);
      return { ...ticket, severity, updatedAt: new Date().toISOString() };
    });
    if (outcome.changed.length > 0) {
      this.write(next);
      this.record('Changed the severity of support tickets', { ids: outcome.changed, severity });
    }
    return outcome;
  }

  /**
   * Removes ticket records from this application.
   *
   * This deletes rows in the settings document. It never touches the folder that
   * the resolution points at — this application does not delete that folder, for
   * anybody, ever.
   */
  remove(ids: string[]): BulkOutcome {
    const wanted = new Set(ids);
    const remaining = this.all().filter((ticket) => !wanted.has(ticket.id));
    const removed = this.all()
      .filter((ticket) => wanted.has(ticket.id))
      .map((ticket) => ticket.id);
    if (removed.length === 0) return { changed: [], skipped: [] };
    this.write(remaining);
    this.record('Deleted support tickets', { ids: removed });
    return { changed: removed, skipped: [] };
  }

  /** Ticket ids raised strictly before the given ISO date. */
  raisedBefore(isoDate: string): string[] {
    return this.all()
      .filter((ticket) => ticket.createdAt < isoDate)
      .map((ticket) => ticket.id);
  }
}

export const ticketStore = new TicketStore();
