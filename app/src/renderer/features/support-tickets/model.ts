/**
 * The Support Tickets record shape, its bounds, and the pure helpers over it.
 *
 * Everything here is local. A ticket is a row in this application's own settings
 * document; it is never transmitted, never queued for transmission, and there is
 * no remote system it corresponds to. The "desk" is this application's own
 * fictional one — it deliberately does not name, imitate or imply any real
 * organization, any real person, or any real case-management system.
 */

export type TicketCategory = 'lockout' | 'forgotten' | 'authenticator' | 'appearance' | 'other';

export type TicketSeverity = 'routine' | 'elevated' | 'urgent' | 'catastrophic';

export type TicketStatus = 'received' | 'triaged' | 'escalated' | 'resolutionIssued' | 'closed';

/**
 * One canned reply from the fictional desk.
 *
 * The text is stored as a translation key plus its substitution values rather
 * than as rendered prose, so a reply written in one language mode still reads in
 * whichever mode and humour level is active when it is looked at later.
 */
export interface TicketResponse {
  /** ISO-8601, in the machine's own local offset. */
  at: string;
  key: string;
  values: Record<string, string>;
}

export interface SupportTicket {
  /** Locally generated, e.g. `WDS-482913`. Unique within this machine only. */
  id: string;
  category: TicketCategory;
  severity: TicketSeverity;
  status: TicketStatus;
  description: string;
  createdAt: string;
  updatedAt: string;
  responses: TicketResponse[];
}

/* ------------------------------------------------------------------ */
/* Bounds                                                              */
/* ------------------------------------------------------------------ */

/** Hard ceiling on stored tickets. Beyond it, creating one is refused. */
export const MAX_TICKETS = 500;

/** Hard ceiling on one description, in characters. */
export const MAX_DESCRIPTION = 4000;

/** Hard ceiling on retained replies per ticket. */
export const MAX_RESPONSES = 40;

/** The persisted settings key holding every ticket. */
export const RECORDS_KEY = 'supportTickets.records';

/** Schema version of the persisted array, stated in every export. */
export const SCHEMA_VERSION = '1';

/**
 * The ticket-number prefix.
 *
 * It stands for nothing outside this application and matches no external
 * numbering scheme, which is the point: a ticket number that looked like a real
 * vendor's would be an impersonation rather than a joke.
 */
export const TICKET_PREFIX = 'WDS';

/* ------------------------------------------------------------------ */
/* Enumerations                                                        */
/* ------------------------------------------------------------------ */

export const CATEGORIES: TicketCategory[] = [
  'lockout',
  'forgotten',
  'authenticator',
  'appearance',
  'other'
];

export const SEVERITIES: TicketSeverity[] = ['routine', 'elevated', 'urgent', 'catastrophic'];

export const STATUS_ORDER: TicketStatus[] = [
  'received',
  'triaged',
  'escalated',
  'resolutionIssued',
  'closed'
];

/* ------------------------------------------------------------------ */
/* Keys for the localized labels                                       */
/* ------------------------------------------------------------------ */

export function categoryKey(category: TicketCategory): string {
  return `supportTickets.category.${category}`;
}

export function severityKey(severity: TicketSeverity): string {
  return `supportTickets.severity.${severity}`;
}

export function statusKey(status: TicketStatus): string {
  return `supportTickets.status.${status}`;
}

export function replyKey(status: TicketStatus): string {
  return `supportTickets.reply.${status}`;
}

/* ------------------------------------------------------------------ */
/* Pure helpers                                                        */
/* ------------------------------------------------------------------ */

/** The status one step along, or null when the ticket is already closed. */
export function nextStatus(status: TicketStatus): TicketStatus | null {
  const index = STATUS_ORDER.indexOf(status);
  if (index < 0 || index >= STATUS_ORDER.length - 1) return null;
  return STATUS_ORDER[index + 1];
}

/**
 * A locally generated ticket number.
 *
 * `crypto.getRandomValues` is used rather than `Math.random` for no security
 * reason whatsoever — it simply produces a better spread of six-digit numbers,
 * and a ticket number is decoration.
 */
export function generateTicketNumber(taken: ReadonlySet<string>): string {
  for (let attempt = 0; attempt < 64; attempt += 1) {
    const buffer = new Uint32Array(1);
    crypto.getRandomValues(buffer);
    const candidate = `${TICKET_PREFIX}-${String((buffer[0] % 900_000) + 100_000)}`;
    if (!taken.has(candidate)) return candidate;
  }
  // Sixty-four collisions in a 900,000-wide space is not going to happen, but a
  // fallback that cannot collide is cheaper than a loop that might not end.
  let suffix = 1;
  while (taken.has(`${TICKET_PREFIX}-${100_000 + suffix}`)) suffix += 1;
  return `${TICKET_PREFIX}-${100_000 + suffix}`;
}

/** True when the value is a ticket this application wrote and can still read. */
export function isTicket(value: unknown): value is SupportTicket {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<SupportTicket>;
  return (
    typeof candidate.id === 'string' &&
    candidate.id !== '' &&
    typeof candidate.description === 'string' &&
    typeof candidate.createdAt === 'string' &&
    typeof candidate.updatedAt === 'string' &&
    typeof candidate.category === 'string' &&
    CATEGORIES.includes(candidate.category as TicketCategory) &&
    typeof candidate.severity === 'string' &&
    SEVERITIES.includes(candidate.severity as TicketSeverity) &&
    typeof candidate.status === 'string' &&
    STATUS_ORDER.includes(candidate.status as TicketStatus) &&
    Array.isArray(candidate.responses)
  );
}

/** Normalizes a stored ticket, dropping anything malformed rather than guessing. */
export function sanitizeTicket(value: unknown): SupportTicket | null {
  if (!isTicket(value)) return null;
  const responses = value.responses
    .filter(
      (response): response is TicketResponse =>
        Boolean(response) &&
        typeof response === 'object' &&
        typeof (response as TicketResponse).at === 'string' &&
        typeof (response as TicketResponse).key === 'string'
    )
    .slice(-MAX_RESPONSES)
    .map((response) => ({
      at: response.at,
      key: response.key,
      values:
        response.values && typeof response.values === 'object'
          ? Object.fromEntries(
              Object.entries(response.values).map(([key, entry]) => [key, String(entry)])
            )
          : {}
    }));
  return {
    id: value.id,
    category: value.category,
    severity: value.severity,
    status: value.status,
    description: value.description.slice(0, MAX_DESCRIPTION),
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    responses
  };
}

/** The flat record used for exports and for the search haystack. */
export function toExportRecord(
  ticket: SupportTicket,
  describe: (key: string, values?: Record<string, string>) => string
): Record<string, unknown> {
  return {
    id: ticket.id,
    category: describe(categoryKey(ticket.category)),
    categoryId: ticket.category,
    severity: describe(severityKey(ticket.severity)),
    severityId: ticket.severity,
    status: describe(statusKey(ticket.status)),
    statusId: ticket.status,
    description: ticket.description,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    responseCount: ticket.responses.length,
    lastResponse:
      ticket.responses.length > 0
        ? describe(
            ticket.responses[ticket.responses.length - 1].key,
            ticket.responses[ticket.responses.length - 1].values
          )
        : ''
  };
}
