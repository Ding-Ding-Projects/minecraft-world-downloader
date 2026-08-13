import { el } from '../../core/a11y';
import type { AppContext, ExportFormat, SearchQuery } from '../../core/registry';
import { disclosureText } from './disclosure';
import {
  CATEGORIES,
  SCHEMA_VERSION,
  SEVERITIES,
  STATUS_ORDER,
  categoryKey,
  severityKey,
  statusKey,
  toExportRecord
} from './model';
import type { SupportTicket, TicketCategory, TicketSeverity, TicketStatus } from './model';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_ID } from './settingIds';
import type { BulkOutcome } from './store';
import { ticketStore } from './store';

/**
 * The ticket list: searchable, filterable, bulk-manageable and exportable, like
 * every other list in this application.
 *
 * Three things here are easy to get wrong and are done deliberately.
 *
 * Select-all is HONESTLY SCOPED. "Select all" on a filtered list is ambiguous
 * and the ambiguity is dangerous, so there is no single button: there is one for
 * the rows on screen, one for every match including the rows not rendered yet,
 * and one for every stored ticket, each naming its own exact count.
 *
 * Every bulk action states what will happen BEFORE it happens, distinguishing
 * "42 selected" from "42 will change" — a ticket already closed is skipped by
 * "close", and the preview says which ones and why rather than quietly doing
 * nothing to them.
 *
 * The list is WINDOWED. It builds a bounded number of rows and offers to build
 * more, so five hundred tickets never instantiate five hundred live severity
 * controls up front.
 */

interface ListState {
  query: SearchQuery | null;
  status: TicketStatus | 'any';
  category: TicketCategory | 'any';
  rendered: number;
}

export interface TicketListHandle {
  root: HTMLElement;
  refresh(): void;
  destroy(): void;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
}

export function buildTicketList(ctx: AppContext): TicketListHandle {
  const describe = (key: string, values?: Record<string, string>): string =>
    ctx.t(key, key, values ? { values } : undefined);

  const pageSize = Math.max(
    5,
    Math.min(200, Number(ctx.settings.get<number>(PAGE_SIZE_ID, DEFAULT_PAGE_SIZE)) || DEFAULT_PAGE_SIZE)
  );

  const state: ListState = { query: null, status: 'any', category: 'any', rendered: pageSize };
  const selected = new Set<string>();
  let selectionAnchor: string | null = null;

  const root = ctx.components.card({ variant: 'outlined' });
  root.id = 'supportTickets-list';
  root.setAttribute('data-appearance-id', 'supportTickets:list');

  root.append(
    ctx.components.sectionHeading({
      title: 'supportTickets.list.heading',
      description: 'supportTickets.list.description'
    })
  );

  /* ---------------- search and filters ---------------- */

  const controls = el('div', { className: 'md-notification-centre__toolbar' });
  controls.style.display = 'flex';
  controls.style.flexWrap = 'wrap';
  controls.style.gap = '12px';
  controls.style.alignItems = 'flex-end';

  const searchBar = ctx.createSearchBar({
    label: 'supportTickets.list.search',
    placeholder: 'supportTickets.list.searchPlaceholder',
    sample: 'WDS-100200 lockout escalated I cannot get back in',
    onChange: (query) => {
      state.query = query;
      state.rendered = pageSize;
      render();
    }
  });

  const statusFilter = ctx.components.select({
    label: 'supportTickets.list.filterStatus',
    value: 'any',
    options: [
      { value: 'any', label: 'supportTickets.list.filterAny' },
      ...STATUS_ORDER.map((value) => ({ value, label: statusKey(value) }))
    ],
    onChange: (value) => {
      state.status = value as TicketStatus | 'any';
      state.rendered = pageSize;
      render();
    }
  });

  const categoryFilter = ctx.components.select({
    label: 'supportTickets.list.filterCategory',
    value: 'any',
    options: [
      { value: 'any', label: 'supportTickets.list.filterAny' },
      ...CATEGORIES.map((value) => ({ value, label: categoryKey(value) }))
    ],
    onChange: (value) => {
      state.category = value as TicketCategory | 'any';
      state.rendered = pageSize;
      render();
    }
  });

  controls.append(searchBar.root, statusFilter.root, categoryFilter.root);
  root.append(controls);

  /* ---------------- selection toolbar ---------------- */

  const selectionBar = el('div', {
    className: 'md-notification-centre__toolbar',
    attrs: { role: 'group', 'aria-label': ctx.t('supportTickets.bulk.heading', 'Selection') }
  });
  selectionBar.style.display = 'flex';
  selectionBar.style.flexWrap = 'wrap';
  selectionBar.style.gap = '8px';
  selectionBar.style.alignItems = 'center';

  const selectionCount = el('span', {
    className: 'md-typescale-label-large',
    attrs: { role: 'status', 'aria-live': 'polite' }
  });

  const countLine = el('p', { className: 'md-typescale-body-small', attrs: { role: 'status' } });

  const listNode = ctx.components.list({ label: 'supportTickets.list.heading' });
  listNode.setAttribute('aria-multiselectable', 'true');

  const emptyHost = el('div');
  const moreHost = el('div');

  /* ---------------- matching ---------------- */

  function haystack(ticket: SupportTicket): string {
    return [
      ticket.id,
      ticket.description,
      describe(categoryKey(ticket.category)),
      describe(severityKey(ticket.severity)),
      describe(statusKey(ticket.status)),
      ticket.createdAt,
      ticket.updatedAt
    ].join(' ');
  }

  function matching(): SupportTicket[] {
    const query = state.query;
    return ticketStore.all().filter((ticket) => {
      if (state.status !== 'any' && ticket.status !== state.status) return false;
      if (state.category !== 'any' && ticket.category !== state.category) return false;
      if (!query || query.text.trim() === '') return true;
      return query.matches(haystack(ticket));
    });
  }

  /* ---------------- selection helpers ---------------- */

  function updateSelectionCount(): void {
    selectionCount.textContent = ctx.t('supportTickets.bulk.selected', '{count} selected', {
      values: { count: String(selected.size) }
    });
  }

  function toggle(id: string, on: boolean): void {
    if (on) selected.add(id);
    else selected.delete(id);
    updateSelectionCount();
  }

  function extendTo(id: string, order: string[]): void {
    if (!selectionAnchor) {
      toggle(id, true);
      selectionAnchor = id;
      render();
      return;
    }
    const from = order.indexOf(selectionAnchor);
    const to = order.indexOf(id);
    if (from < 0 || to < 0) {
      toggle(id, true);
      render();
      return;
    }
    const [low, high] = from <= to ? [from, to] : [to, from];
    for (let index = low; index <= high; index += 1) selected.add(order[index]);
    updateSelectionCount();
    render();
  }

  /* ---------------- bulk actions ---------------- */

  function previewAndApply(
    anchor: HTMLElement,
    actionLabel: string,
    ids: string[],
    plan: () => BulkOutcome,
    dryRun: () => BulkOutcome
  ): void {
    if (ids.length === 0) {
      ctx.notify.warn(
        ctx.t('supportTickets.title', 'Support Tickets', { dialog: true }),
        ctx.t('supportTickets.bulk.none', 'Nothing is selected, so nothing would change.')
      );
      return;
    }
    const preview = dryRun();
    const handle = ctx.overlay.open({
      anchor,
      placement: 'top-start',
      role: 'dialog',
      label: ctx.t('supportTickets.bulk.preview.title', 'Review before it happens', { dialog: true }),
      lightDismiss: true
    });
    const body = handle.body;
    body.append(
      el('h3', {
        className: 'md-typescale-title-small',
        text: ctx.t('supportTickets.bulk.preview.title', 'Review before it happens', { dialog: true })
      }),
      el('p', { className: 'md-typescale-body-medium', text: actionLabel }),
      el('p', {
        className: 'md-typescale-body-medium',
        text: ctx.t(
          'supportTickets.bulk.preview.willChange',
          '{willChange} of the {selected} selected will change. {skipped} will be skipped.',
          {
            values: {
              willChange: String(preview.changed.length),
              selected: String(ids.length),
              skipped: String(preview.skipped.length)
            }
          }
        )
      })
    );

    const affected = ctx.components.list({ label: 'supportTickets.bulk.preview.title' });
    for (const id of preview.changed) {
      affected.append(ctx.components.listItem({ headline: id, leadingIcon: 'check' }));
    }
    for (const skip of preview.skipped) {
      affected.append(
        ctx.components.listItem({
          headline: skip.id,
          leadingIcon: 'info',
          supporting: ctx.t('supportTickets.bulk.preview.skippedReason', 'Skipped, because: {reason}', {
            values: { reason: describe(skip.reasonKey) }
          })
        })
      );
    }
    body.append(affected);

    const actions = el('div', { className: 'md-confirm__actions' });
    actions.style.display = 'flex';
    actions.style.gap = '8px';
    actions.append(
      ctx.components.button({
        label: 'supportTickets.bulk.preview.cancel',
        variant: 'text',
        onClick: () => handle.close()
      }),
      ctx.components.button({
        label: 'supportTickets.bulk.preview.apply',
        variant: 'filled',
        disabled: preview.changed.length === 0,
        disabledReason: ctx.t(
          'supportTickets.bulk.preview.willChange',
          'None of the selected tickets would change.',
          {
            values: {
              willChange: '0',
              selected: String(ids.length),
              skipped: String(preview.skipped.length)
            }
          }
        ),
        onClick: () => {
          // The anchor is rebuilt by the render that follows, so it is found
          // again by its stable id afterwards rather than left as a detached
          // node that focus quietly falls off.
          const anchorId = anchor.id;
          const outcome = plan();
          handle.close();
          const message = ctx.t(
            'supportTickets.bulk.done',
            '{count} tickets changed. {skipped} were skipped.',
            {
              values: {
                count: String(outcome.changed.length),
                skipped: String(outcome.skipped.length)
              }
            }
          );
          ctx.a11y.announce(message);
          ctx.notify.success(ctx.t('supportTickets.title', 'Support Tickets', { dialog: true }), message);
          render();
          if (anchorId) {
            root.querySelector<HTMLElement>(`#${CSS.escape(anchorId)}`)?.focus({ preventScroll: true });
          }
        }
      })
    );
    body.append(actions);
    handle.reposition();
  }

  function requestDelete(anchor: HTMLElement, ids: string[]): void {
    if (ids.length === 0) {
      ctx.notify.warn(
        ctx.t('supportTickets.title', 'Support Tickets', { dialog: true }),
        ctx.t('supportTickets.bulk.none', 'Nothing is selected, so nothing would change.')
      );
      return;
    }
    void ctx.confirm
      .request({
        anchor,
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
        for (const id of outcome.changed) selected.delete(id);
        updateSelectionCount();
        const message = ctx.t(
          'supportTickets.notify.deleted',
          '{count} tickets deleted from this computer',
          { values: { count: String(outcome.changed.length) } }
        );
        ctx.a11y.announce(message);
        ctx.notify.success(ctx.t('supportTickets.title', 'Support Tickets', { dialog: true }), message);
        render();
      });
  }

  /* ---------------- export ---------------- */

  const exportCard = el('div');
  let exportScope: 'selection' | 'matching' | 'all' = 'selection';
  let exportFormat: ExportFormat = 'json';

  function exportRecords(): Array<Record<string, unknown>> {
    const source =
      exportScope === 'all'
        ? ticketStore.all()
        : exportScope === 'matching'
          ? matching()
          : ticketStore.all().filter((ticket) => selected.has(ticket.id));
    return source.map((ticket) => toExportRecord(ticket, describe));
  }

  const exportStatus = el('p', {
    className: 'md-field__support md-typescale-body-small',
    attrs: { role: 'status', 'aria-live': 'polite' }
  });

  function refreshPreflight(): void {
    const records = exportRecords();
    if (records.length === 0) {
      exportStatus.classList.remove('md-field__support--error');
      exportStatus.textContent = ctx.t(
        'supportTickets.export.nothing',
        'There is nothing in that scope to export.'
      );
      return;
    }
    const preflight = ctx.exporter.preflight(records, exportFormat);
    exportStatus.classList.remove('md-field__support--error');
    exportStatus.textContent =
      preflight.losses.length === 0
        ? ctx.t(
            'supportTickets.export.noLosses',
            '{format} carries every field of every selected ticket.',
            { values: { format: exportFormat.toUpperCase() } }
          )
        : ctx.t('supportTickets.export.losses', '{format} cannot carry these faithfully: {fields}', {
            values: {
              format: exportFormat.toUpperCase(),
              fields: preflight.losses.map((loss) => `${loss.field} (${loss.reason})`).join('; ')
            }
          });
  }

  function buildExport(): void {
    exportCard.textContent = '';
    exportCard.append(
      ctx.components.sectionHeading({
        title: 'supportTickets.export.heading',
        description: 'supportTickets.list.description'
      })
    );

    const scope = ctx.components.select({
      label: 'supportTickets.export.scope',
      value: exportScope,
      options: [
        { value: 'selection', label: 'supportTickets.export.scope.selection' },
        { value: 'matching', label: 'supportTickets.export.scope.matching' },
        { value: 'all', label: 'supportTickets.export.scope.all' }
      ],
      onChange: (value) => {
        exportScope = value as 'selection' | 'matching' | 'all';
        refreshPreflight();
      }
    });

    const format = ctx.components.select({
      label: 'supportTickets.export.format',
      value: exportFormat,
      options: ctx.exporter.formats().map((value) => ({ value, label: value.toUpperCase() })),
      onChange: (value) => {
        exportFormat = value as ExportFormat;
        refreshPreflight();
      }
    });

    const save = ctx.components.button({
      label: 'supportTickets.export.save',
      variant: 'tonal',
      icon: 'save',
      onClick: () => {
        const records = exportRecords();
        if (records.length === 0) {
          refreshPreflight();
          return;
        }
        void ctx.exporter
          .save(records, exportFormat, {
            name: 'support-tickets',
            schemaVersion: SCHEMA_VERSION,
            defaultFileName: `support-tickets.${exportFormat}`
          })
          .then((path) => {
            if (!path) {
              exportStatus.textContent = ctx.t(
                'supportTickets.export.cancelled',
                'No destination was chosen, so nothing was written.'
              );
              return;
            }
            exportStatus.classList.remove('md-field__support--error');
            exportStatus.textContent = ctx.t('supportTickets.export.saved', 'Written to {path}.', {
              values: { path }
            });
            ctx.a11y.announce(exportStatus.textContent);
            void ctx.history.record('Exported support tickets', 'supportTickets', {
              format: exportFormat,
              scope: exportScope,
              count: records.length,
              path
            });
            ctx.notify.show({
              title: ctx.t('supportTickets.title', 'Support Tickets', { dialog: true }),
              body: exportStatus.textContent,
              severity: 'success',
              actions: [
                {
                  label: 'supportTickets.export.openInEditor',
                  run: () => {
                    void ctx.studio.editor.open(path).then((result) => {
                      if (!result.ok) {
                        ctx.notify.error(
                          ctx.t('supportTickets.title', 'Support Tickets', { dialog: true }),
                          result.error
                        );
                      }
                    });
                  }
                }
              ]
            });
          })
          .catch((error: unknown) => {
            exportStatus.classList.add('md-field__support--error');
            exportStatus.textContent = ctx.t('supportTickets.export.failed', 'The export failed: {message}', {
              values: { message: error instanceof Error ? error.message : String(error) }
            });
            ctx.a11y.announce(exportStatus.textContent, true);
          });
      }
    });

    const copy = ctx.components.button({
      label: 'supportTickets.export.copy',
      variant: 'outlined',
      icon: 'copy',
      onClick: () => {
        const records = exportRecords();
        if (records.length === 0) {
          refreshPreflight();
          return;
        }
        const serialized = ctx.exporter.serialize(records, exportFormat, {
          name: 'support-tickets',
          schemaVersion: SCHEMA_VERSION
        });
        const payload = `${serialized.text}\n\n${disclosureText(ctx)}\n`;
        void navigator.clipboard
          .writeText(payload)
          .then(() => {
            exportStatus.classList.remove('md-field__support--error');
            exportStatus.textContent = ctx.t(
              'supportTickets.resolution.copied',
              'The path was copied to the clipboard.'
            );
            ctx.a11y.announce(exportStatus.textContent);
          })
          .catch((error: unknown) => {
            exportStatus.classList.add('md-field__support--error');
            exportStatus.textContent = ctx.t('supportTickets.export.failed', 'The export failed: {message}', {
              values: { message: error instanceof Error ? error.message : String(error) }
            });
          });
      }
    });

    const row = el('div');
    row.style.display = 'flex';
    row.style.flexWrap = 'wrap';
    row.style.gap = '12px';
    row.style.alignItems = 'flex-end';
    row.append(scope.root, format.root, copy, save);
    exportCard.append(row, exportStatus);
    refreshPreflight();
  }

  /* ---------------- rows ---------------- */

  function buildRow(ticket: SupportTicket, order: string[]): HTMLElement {
    const row = el('li', {
      className: 'md-list-item',
      attrs: {
        'data-ticket-id': ticket.id,
        'aria-selected': String(selected.has(ticket.id)),
        'data-appearance-id': 'supportTickets:row'
      }
    });
    row.style.flexWrap = 'wrap';
    row.style.alignItems = 'flex-start';

    const box = ctx.components.checkbox({
      label: ctx.t('supportTickets.ticket.select', 'Select ticket {ticket}', {
        values: { ticket: ticket.id }
      }),
      id: `supportTickets-select-${ticket.id}`,
      checked: selected.has(ticket.id),
      onChange: (checked) => {
        toggle(ticket.id, checked);
        selectionAnchor = ticket.id;
        row.setAttribute('aria-selected', String(checked));
      }
    });
    const boxInput = box.root.querySelector('input');
    if (boxInput) {
      boxInput.addEventListener('click', (event) => {
        if ((event as MouseEvent).shiftKey) {
          event.preventDefault();
          extendTo(ticket.id, order);
        }
      });
      boxInput.addEventListener('keydown', (event) => {
        const key = (event as KeyboardEvent).key;
        if (key === ' ' && (event as KeyboardEvent).shiftKey) {
          event.preventDefault();
          extendTo(ticket.id, order);
          return;
        }
        if (key === 'a' && ((event as KeyboardEvent).ctrlKey || (event as KeyboardEvent).metaKey)) {
          event.preventDefault();
          for (const id of order) selected.add(id);
          updateSelectionCount();
          render();
          return;
        }
        if (key !== 'ArrowDown' && key !== 'ArrowUp') return;
        event.preventDefault();
        const index = order.indexOf(ticket.id);
        const target = key === 'ArrowDown' ? index + 1 : index - 1;
        if (target < 0 || target >= order.length) return;
        const next = listNode.querySelector<HTMLInputElement>(
          `[data-ticket-id="${CSS.escape(order[target])}"] input[type="checkbox"]`
        );
        next?.focus();
      });
    }
    row.append(box.root);

    const text = el('div', { className: 'md-list-item__text' });
    text.style.minWidth = '0';
    text.style.flex = '1 1 260px';

    const headline = el('div');
    headline.style.display = 'flex';
    headline.style.flexWrap = 'wrap';
    headline.style.gap = '8px';
    headline.style.alignItems = 'center';
    headline.append(
      el('span', { className: 'md-typescale-title-small', text: ticket.id }),
      ctx.components.badge({
        label: describe(statusKey(ticket.status)),
        severity: ticket.status === 'closed' ? 'success' : 'info'
      }),
      el('span', {
        className: 'md-typescale-label-medium',
        text: describe(categoryKey(ticket.category))
      })
    );
    text.append(headline);

    text.append(
      el('p', {
        className: 'md-typescale-body-medium',
        text: ticket.description
      })
    );
    text.append(
      el('span', {
        className: 'md-list-item__supporting',
        text: `${ctx.t('supportTickets.ticket.raised', 'Raised {date}', {
          values: { date: formatDate(ticket.createdAt) }
        })} · ${ctx.t('supportTickets.ticket.updated', 'Updated {date}', {
          values: { date: formatDate(ticket.updatedAt) }
        })} · ${ctx.t('supportTickets.ticket.responses', '{count} replies from the desk', {
          values: { count: String(ticket.responses.length) }
        })}`
      })
    );

    /* The correspondence, behind progressive disclosure. */
    const correspondence = el('div');
    correspondence.hidden = true;
    const replies = ctx.components.list({ label: 'supportTickets.ticket.responses' });
    for (const response of ticket.responses) {
      replies.append(
        ctx.components.listItem({
          headline: describe(response.key, response.values),
          supporting: formatDate(response.at),
          leadingIcon: 'info'
        })
      );
    }
    correspondence.append(replies);

    const expand = ctx.components.button({
      // Interpolated here rather than passed as a bare key: the component kit
      // resolves a key without substitution values, which would leave a literal
      // "{ticket}" on screen.
      label: ctx.t('supportTickets.ticket.expand', 'Show the correspondence', {
        values: { ticket: ticket.id }
      }),
      variant: 'text',
      icon: 'chevronDown',
      id: `supportTickets-expand-${ticket.id}`,
      onClick: () => {
        correspondence.hidden = !correspondence.hidden;
        expand.setAttribute('aria-expanded', String(!correspondence.hidden));
        const labelNode = expand.querySelector('.md-btn__label');
        const next = ctx.t(
          correspondence.hidden ? 'supportTickets.ticket.expand' : 'supportTickets.ticket.collapse',
          correspondence.hidden ? 'Show the correspondence' : 'Hide the correspondence',
          { values: { ticket: ticket.id } }
        );
        if (labelNode) labelNode.textContent = next;
        expand.setAttribute('aria-label', next);
      }
    });
    expand.setAttribute('aria-expanded', 'false');
    expand.setAttribute(
      'aria-label',
      ctx.t('supportTickets.ticket.expand', 'Show the correspondence', {
        values: { ticket: ticket.id }
      })
    );

    text.append(expand, correspondence);

    /* The live severity control: the real control, wired to the same code. */
    const severity = ctx.components.select({
      label: ctx.t('supportTickets.ticket.severityLabel', 'Severity for {ticket}', {
        values: { ticket: ticket.id }
      }),
      value: ticket.severity,
      options: SEVERITIES.map((value) => ({ value, label: severityKey(value) })),
      onChange: (value) => {
        const outcome = ticketStore.setSeverity([ticket.id], value as TicketSeverity);
        if (outcome.changed.length > 0) {
          ctx.a11y.announce(
            `${ticket.id}: ${describe(severityKey(value as TicketSeverity))}`
          );
        }
      }
    });

    const chase = ctx.components.button({
      label: 'supportTickets.ticket.chase',
      variant: 'tonal',
      icon: 'refresh',
      id: `supportTickets-chase-${ticket.id}`,
      disabled: ticket.status === 'closed',
      disabledReason: ctx.t('supportTickets.ticket.alreadyClosed', 'This ticket is already closed.'),
      onClick: () => {
        const outcome = ticketStore.advance([ticket.id]);
        if (outcome.changed.length === 0) return;
        const updated = ticketStore.byId(ticket.id);
        if (updated) {
          const message = ctx.t('supportTickets.notify.advanced', 'Ticket {ticket} is now {status}', {
            values: { ticket: ticket.id, status: describe(statusKey(updated.status)) }
          });
          ctx.a11y.announce(message);
          ctx.notify.info(ctx.t('supportTickets.title', 'Support Tickets', { dialog: true }), message);
        }
        render();
      }
    });

    const rowMenu = ctx.components.iconButton({
      icon: 'more',
      label: ctx.t('core.action.more', 'More'),
      id: `supportTickets-menu-${ticket.id}`,
      onClick: () => {
        ctx.components.menu({
          anchor: rowMenu,
          label: ticket.id,
          items: [
            {
              id: 'close',
              label: 'supportTickets.ticket.close',
              icon: 'check',
              disabled: ticket.status === 'closed',
              disabledReason: ctx.t(
                'supportTickets.ticket.alreadyClosed',
                'This ticket is already closed.'
              ),
              run: () => {
                ticketStore.close([ticket.id]);
                render();
              }
            },
            {
              id: 'reopen',
              label: 'supportTickets.ticket.reopen',
              icon: 'refresh',
              disabled: ticket.status !== 'closed',
              disabledReason: ctx.t('supportTickets.bulk.skip.notClosed', 'It is not closed.'),
              run: () => {
                ticketStore.reopen([ticket.id]);
                render();
              }
            },
            {
              id: 'delete',
              label: 'supportTickets.ticket.delete',
              icon: 'trash',
              danger: true,
              separatorBefore: true,
              run: () => requestDelete(rowMenu, [ticket.id])
            }
          ]
        });
      }
    });

    const trailing = el('div');
    trailing.style.display = 'flex';
    trailing.style.flexWrap = 'wrap';
    trailing.style.gap = '8px';
    trailing.style.alignItems = 'center';
    trailing.append(severity.root, chase, rowMenu);

    row.append(text, trailing);
    ctx.appearance.applyTo(row, 'supportTickets:row');
    return row;
  }

  /* ---------------- render ---------------- */

  function buildSelectionBar(matched: SupportTicket[], shown: SupportTicket[], total: number): void {
    selectionBar.textContent = '';
    const hidden = matched.length - shown.length;

    const selectShown = ctx.components.button({
      id: 'supportTickets-bulk-selectShown',
      label: ctx.t('supportTickets.bulk.selectShown', 'Select the {count} shown', {
        values: { count: String(shown.length) }
      }),
      variant: 'outlined',
      disabled: shown.length === 0,
      disabledReason: ctx.t('supportTickets.list.noMatch.title', 'Nothing matched'),
      onClick: () => {
        for (const ticket of shown) selected.add(ticket.id);
        updateSelectionCount();
        render();
      }
    });

    const selectMatched = ctx.components.button({
      id: 'supportTickets-bulk-selectMatched',
      label: ctx.t(
        'supportTickets.bulk.selectMatched',
        'Select all {count} matching, including the {hidden} not shown',
        { values: { count: String(matched.length), hidden: String(hidden) } }
      ),
      variant: 'outlined',
      disabled: hidden <= 0,
      disabledReason: ctx.t(
        'supportTickets.list.count',
        'Every match is already on screen, so this would select the same tickets as the button beside it.',
        {
          values: {
            shown: String(shown.length),
            matched: String(matched.length),
            total: String(total)
          }
        }
      ),
      onClick: () => {
        for (const ticket of matched) selected.add(ticket.id);
        updateSelectionCount();
        render();
      }
    });

    const selectEvery = ctx.components.button({
      id: 'supportTickets-bulk-selectEvery',
      label: ctx.t('supportTickets.bulk.selectEvery', 'Select every one of the {count} stored tickets', {
        values: { count: String(total) }
      }),
      variant: 'outlined',
      disabled: total === 0,
      disabledReason: ctx.t('supportTickets.list.empty.title', 'No tickets yet'),
      onClick: () => {
        for (const ticket of ticketStore.all()) selected.add(ticket.id);
        updateSelectionCount();
        render();
      }
    });

    const invert = ctx.components.button({
      id: 'supportTickets-bulk-invert',
      label: ctx.t('supportTickets.bulk.invert', 'Invert the selection within the {count} matching', {
        values: { count: String(matched.length) }
      }),
      variant: 'text',
      disabled: matched.length === 0,
      disabledReason: ctx.t('supportTickets.list.noMatch.title', 'Nothing matched'),
      onClick: () => {
        for (const ticket of matched) {
          if (selected.has(ticket.id)) selected.delete(ticket.id);
          else selected.add(ticket.id);
        }
        updateSelectionCount();
        render();
      }
    });

    const clear = ctx.components.button({
      id: 'supportTickets-bulk-clear',
      label: 'supportTickets.bulk.clear',
      variant: 'text',
      disabled: selected.size === 0,
      disabledReason: ctx.t('supportTickets.bulk.none', 'Nothing is selected.'),
      onClick: () => {
        selected.clear();
        selectionAnchor = null;
        updateSelectionCount();
        render();
      }
    });

    const ids = (): string[] => [...selected];

    const advance = ctx.components.button({
      id: 'supportTickets-bulk-advance',
      label: 'supportTickets.bulk.advance',
      variant: 'tonal',
      icon: 'refresh',
      disabled: selected.size === 0,
      disabledReason: ctx.t('supportTickets.bulk.none', 'Nothing is selected.'),
      onClick: () =>
        previewAndApply(
          advance,
          ctx.t('supportTickets.bulk.advance', 'Advance the status'),
          ids(),
          () => ticketStore.advance(ids()),
          () => dryRunAdvance(ids())
        )
    });

    const closeAction = ctx.components.button({
      id: 'supportTickets-bulk-close',
      label: 'supportTickets.bulk.close',
      variant: 'tonal',
      icon: 'check',
      disabled: selected.size === 0,
      disabledReason: ctx.t('supportTickets.bulk.none', 'Nothing is selected.'),
      onClick: () =>
        previewAndApply(
          closeAction,
          ctx.t('supportTickets.bulk.close', 'Close'),
          ids(),
          () => ticketStore.close(ids()),
          () => dryRunClose(ids())
        )
    });

    const reopenAction = ctx.components.button({
      id: 'supportTickets-bulk-reopen',
      label: 'supportTickets.bulk.reopen',
      variant: 'tonal',
      icon: 'lockOpen',
      disabled: selected.size === 0,
      disabledReason: ctx.t('supportTickets.bulk.none', 'Nothing is selected.'),
      onClick: () =>
        previewAndApply(
          reopenAction,
          ctx.t('supportTickets.bulk.reopen', 'Reopen'),
          ids(),
          () => ticketStore.reopen(ids()),
          () => dryRunReopen(ids())
        )
    });

    const deleteAction = ctx.components.button({
      id: 'supportTickets-bulk-delete',
      label: 'supportTickets.bulk.delete',
      variant: 'outlined',
      icon: 'trash',
      danger: true,
      disabled: selected.size === 0,
      disabledReason: ctx.t('supportTickets.bulk.none', 'Nothing is selected.'),
      onClick: () => requestDelete(deleteAction, ids())
    });

    selectionBar.append(
      selectionCount,
      selectShown,
      selectMatched,
      selectEvery,
      invert,
      clear,
      advance,
      closeAction,
      reopenAction,
      deleteAction
    );
    updateSelectionCount();
  }

  /* Dry runs mirror the store's own skip rules without writing anything. */
  function dryRunAdvance(ids: string[]): BulkOutcome {
    const outcome: BulkOutcome = { changed: [], skipped: [] };
    for (const id of ids) {
      const ticket = ticketStore.byId(id);
      if (!ticket) continue;
      if (ticket.status === 'closed') {
        outcome.skipped.push({ id, reasonKey: 'supportTickets.bulk.skip.closed' });
      } else outcome.changed.push(id);
    }
    return outcome;
  }

  function dryRunClose(ids: string[]): BulkOutcome {
    const outcome: BulkOutcome = { changed: [], skipped: [] };
    for (const id of ids) {
      const ticket = ticketStore.byId(id);
      if (!ticket) continue;
      if (ticket.status === 'closed') {
        outcome.skipped.push({ id, reasonKey: 'supportTickets.bulk.skip.closed' });
      } else outcome.changed.push(id);
    }
    return outcome;
  }

  function dryRunReopen(ids: string[]): BulkOutcome {
    const outcome: BulkOutcome = { changed: [], skipped: [] };
    for (const id of ids) {
      const ticket = ticketStore.byId(id);
      if (!ticket) continue;
      if (ticket.status !== 'closed') {
        outcome.skipped.push({ id, reasonKey: 'supportTickets.bulk.skip.notClosed' });
      } else outcome.changed.push(id);
    }
    return outcome;
  }

  /**
   * Rebuilds the list.
   *
   * The rows and the selection toolbar are rebuilt wholesale, which would
   * otherwise throw focus back to the top of the document every time a bulk
   * action lands — so the id of whatever had focus is captured first and, if an
   * element with that id survives the rebuild, focus is put back on it. Ids are
   * stable and derived from the ticket number, so "the checkbox I was on" is the
   * same checkbox afterwards.
   */
  function render(): void {
    const focusedId =
      document.activeElement instanceof HTMLElement && root.contains(document.activeElement)
        ? document.activeElement.id
        : '';
    const total = ticketStore.all().length;
    const matched = matching();
    const shown = matched.slice(0, state.rendered);
    const order = matched.map((ticket) => ticket.id);

    // Anything selected that no longer exists is dropped rather than counted.
    const live = new Set(ticketStore.all().map((ticket) => ticket.id));
    for (const id of [...selected]) if (!live.has(id)) selected.delete(id);

    listNode.textContent = '';
    emptyHost.textContent = '';
    moreHost.textContent = '';

    if (total === 0) {
      emptyHost.append(
        ctx.components.emptyState({
          title: 'supportTickets.list.empty.title',
          body: 'supportTickets.list.empty.body',
          action: {
            label: 'supportTickets.new.heading',
            variant: 'tonal',
            icon: 'add',
            onClick: () => {
              const field = document.getElementById('supportTickets-description');
              field?.focus();
              field?.scrollIntoView({ block: 'center' });
            }
          }
        })
      );
    } else if (matched.length === 0) {
      emptyHost.append(
        ctx.components.emptyState({
          title: 'supportTickets.list.noMatch.title',
          body: ctx.t(
            'supportTickets.list.noMatch.body',
            '{total} tickets are stored; none of them matched.',
            { values: { total: String(total) } }
          ),
          action: {
            label: 'core.action.reset',
            variant: 'text',
            onClick: () => {
              searchBar.clear();
              statusFilter.set('any');
              categoryFilter.set('any');
              state.status = 'any';
              state.category = 'any';
              state.rendered = pageSize;
              render();
            }
          }
        })
      );
    } else {
      for (const ticket of shown) listNode.append(buildRow(ticket, order));
      if (matched.length > shown.length) {
        const remaining = matched.length - shown.length;
        moreHost.append(
          ctx.components.button({
            label: ctx.t('supportTickets.list.showMore', 'Show {count} more', {
              values: { count: String(Math.min(remaining, pageSize)) }
            }),
            variant: 'text',
            icon: 'chevronDown',
            onClick: () => {
              state.rendered += pageSize;
              render();
            }
          })
        );
      }
    }

    countLine.textContent = ctx.t(
      'supportTickets.list.count',
      'Showing {shown} of {matched} matching, out of {total} stored.',
      {
        values: {
          shown: String(shown.length),
          matched: String(matched.length),
          total: String(total)
        }
      }
    );

    buildSelectionBar(matched, shown, total);
    refreshPreflight();

    if (focusedId) {
      const restored = root.querySelector<HTMLElement>(`#${CSS.escape(focusedId)}`);
      if (restored && restored !== document.activeElement) restored.focus({ preventScroll: true });
    }
  }

  root.append(selectionBar, countLine, listNode, emptyHost, moreHost, ctx.components.divider(), exportCard);
  buildExport();
  render();

  const unsubscribe = ticketStore.onChange(() => render());
  ctx.appearance.applyTo(root, 'supportTickets:list');

  return {
    root,
    refresh: render,
    destroy: () => {
      unsubscribe();
      searchBar.destroy();
    }
  };
}
