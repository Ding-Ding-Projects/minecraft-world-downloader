/**
 * The event inspector (row 15.18): every real library event a connected bot
 * fires, as it fires, filterable with the project's own regex builder,
 * pausable, and exportable. This is deliberately the honest catch-all — a
 * capability with no dedicated control anywhere else in this feature or its
 * siblings is still reachable and observable here, because `EVENT_NAMES`
 * covers every event the library actually emits (see `protocol.ts`).
 */

import type { TabContext } from '../../core/registry';
import { DEFAULT_EVENT_SUBSCRIPTION, EVENT_NAMES, HIGH_FREQUENCY_EVENTS } from './protocol';
import type { BotManager, EventLogEntry } from './manager';

function formatPayload(payload: unknown): string {
  try {
    return JSON.stringify(payload);
  } catch {
    return String(payload);
  }
}

export function mountEventsTab(host: HTMLElement, ctx: TabContext, manager: BotManager): void {
  host.classList.add('mineflayer-events');
  host.append(
    ctx.components.topAppBar({
      title: ctx.t('mineflayer.tab.events', 'Bot events'),
      subtitle: ctx.t('mineflayer.tab.events.subtitle', 'Every real library event, as it fires')
    })
  );

  let selectedBotId: string | null = manager.activeBotIdValue();
  let paused = false;
  let filterQuery = '';

  const toolbar = document.createElement('div');
  toolbar.className = 'mineflayer-events-toolbar';
  host.append(toolbar);

  const botSelectHost = document.createElement('span');
  toolbar.append(botSelectHost);

  const pauseToggle = ctx.components.switchControl({
    label: ctx.t('mineflayer.events.pause', 'Pause'),
    checked: false,
    onChange: (value) => {
      paused = value;
      if (!paused) renderList();
    }
  });
  toolbar.append(pauseToggle.root);

  const highFrequencyToggle = ctx.components.switchControl({
    label: ctx.t('mineflayer.events.highFrequency', 'Include high-frequency events ({count} more)', {
      values: { count: HIGH_FREQUENCY_EVENTS.length }
    }),
    checked: false,
    onChange: (value) => {
      if (!selectedBotId) return;
      void manager.setEventSubscription(selectedBotId, value ? [...EVENT_NAMES] : [...DEFAULT_EVENT_SUBSCRIPTION]);
    }
  });
  toolbar.append(highFrequencyToggle.root);

  const clearButton = ctx.components.button({
    label: ctx.t('mineflayer.events.clear', 'Clear log'),
    variant: 'text',
    icon: 'trash',
    onClick: async (event) => {
      const botId = selectedBotId;
      if (!botId) return;
      const session = manager.getSession(botId);
      const approved = await ctx.confirm.request({
        action: ctx.t('mineflayer.events.clearAction', 'Clear the event log for this bot'),
        affected: [session ? String(session.events.length) + ' ' + ctx.t('mineflayer.events.entries', 'entries') : ''],
        irreversible: ctx.t('mineflayer.events.clearIrreversible', 'The retained events are removed from memory. Nothing about the connection changes.'),
        anchor: event.currentTarget as HTMLElement
      });
      if (!approved || !session) return;
      manager.clearEvents(botId);
      renderList();
    }
  });
  toolbar.append(clearButton);

  const exportButton = ctx.components.button({
    label: ctx.t('core.action.export', 'Export'),
    variant: 'text',
    icon: 'download',
    onClick: () => {
      void exportEvents();
    }
  });
  toolbar.append(exportButton);

  const droppedNote = document.createElement('span');
  droppedNote.className = 'md-typescale-body-small mineflayer-dropped-note';
  toolbar.append(droppedNote);

  const search = ctx.createSearchBar({
    label: ctx.t('mineflayer.events.search', 'Search event name or payload text'),
    sample: EVENT_NAMES.join('\n'),
    onChange: (query) => {
      filterQuery = query.text;
      renderList();
    }
  });
  host.append(search.root);

  const listHost = document.createElement('div');
  listHost.className = 'mineflayer-events-list-host';
  host.append(listHost);

  const hostLogSection = document.createElement('details');
  hostLogSection.className = 'mineflayer-host-log';
  const hostLogSummary = document.createElement('summary');
  hostLogSection.append(hostLogSummary);
  const hostLogList = document.createElement('ul');
  hostLogSection.append(hostLogList);
  host.append(hostLogSection);

  function currentRows(): EventLogEntry[] {
    if (!selectedBotId) return [];
    const session = manager.getSession(selectedBotId);
    if (!session) return [];
    const query = search.query();
    return session.events.filter((entry) => query.matches(entry.name) || query.matches(formatPayload(entry.payload)));
  }

  async function exportEvents(): Promise<void> {
    const rows = currentRows().map((entry) => ({
      seq: entry.seq,
      botId: entry.botId,
      name: entry.name,
      at: new Date(entry.at).toISOString(),
      payload: formatPayload(entry.payload)
    }));
    const path = await ctx.exporter.save(rows, 'jsonl', {
      name: 'mineflayer-events',
      defaultFileName: 'mineflayer-events.jsonl'
    });
    if (path) ctx.notify.success(ctx.t('core.export.saved', 'Exported'), path);
  }

  function renderBotOptions(): void {
    const sessions = manager.listSessions();
    if (!selectedBotId || !sessions.some((session) => session.botId === selectedBotId)) {
      selectedBotId = sessions[0]?.botId ?? null;
    }
    const options = sessions.map((session) => ({
      value: session.botId,
      label: session.source.kind === 'profile' ? session.source.profileName : session.options.username
    }));
    // The component kit's `select` reads its `options` only at creation time; a
    // live-changing bot list therefore rebuilds the whole control rather than
    // trying to mutate one, which would leave stale internal event bindings.
    botSelectHost.replaceChildren(
      ctx.components.select({
        label: ctx.t('mineflayer.events.bot', 'Bot'),
        value: selectedBotId ?? '',
        options,
        disabled: options.length === 0,
        disabledReason: ctx.t('mineflayer.events.noBots', 'No bot is connected yet.'),
        onChange: (value) => {
          selectedBotId = value || null;
          renderList();
        }
      }).root
    );
  }

  function renderList(): void {
    if (paused) return;
    listHost.replaceChildren();
    const rows = currentRows();

    const session = selectedBotId ? manager.getSession(selectedBotId) : null;
    droppedNote.textContent =
      session && session.droppedTotal > 0
        ? ctx.t('mineflayer.events.dropped', '{count} events dropped so far under the per-second budget', { values: { count: session.droppedTotal } })
        : '';

    if (!selectedBotId) {
      listHost.append(
        ctx.components.emptyState({
          title: ctx.t('mineflayer.events.noBotSelected', 'No bot selected'),
          body: ctx.t('mineflayer.events.noBotSelectedBody', 'Connect a bot on the Bots tab, then pick it here.')
        })
      );
      return;
    }
    if (rows.length === 0) {
      listHost.append(
        ctx.components.emptyState({
          title: filterQuery ? ctx.t('core.search.noMatches', 'No matches') : ctx.t('mineflayer.events.empty', 'No events yet'),
          body: filterQuery
            ? ctx.t('mineflayer.events.emptySearchBody', 'Nothing in the retained log matches "{query}".', { values: { query: filterQuery } })
            : ctx.t(
                'mineflayer.events.emptyBody',
                'Nothing has fired yet, or every event is still subscribed off by default (see the high-frequency list in this feature\'s documentation).'
              )
        })
      );
      return;
    }

    const table = ctx.components.dataTable<EventLogEntry>({
      label: ctx.t('mineflayer.tab.events', 'Bot events'),
      rowId: (row) => String(row.seq),
      selectable: true,
      columns: [
        { id: 'seq', label: '#', align: 'end', value: (row) => row.seq },
        { id: 'at', label: ctx.t('mineflayer.events.column.time', 'Time'), value: (row) => new Date(row.at).toLocaleTimeString() },
        {
          id: 'name',
          label: ctx.t('mineflayer.events.column.name', 'Event'),
          sortable: true,
          value: (row) => (row.name === '__dropped__' ? ctx.t('mineflayer.events.droppedRow', 'events dropped') : row.name)
        },
        {
          id: 'payload',
          label: ctx.t('mineflayer.events.column.payload', 'Payload'),
          render: (row) => {
            const cell = document.createElement('code');
            cell.className = 'mineflayer-event-payload';
            cell.textContent = formatPayload(row.payload);
            return cell;
          }
        }
      ],
      rows,
      emptyMessage: ctx.t('mineflayer.events.empty', 'No events yet')
    });
    listHost.append(table.root);
  }

  function renderHostLog(): void {
    const entries = manager.hostLogEntries();
    hostLogSummary.textContent = ctx.t('mineflayer.events.hostLog', 'Runtime diagnostic log ({count})', { values: { count: entries.length } });
    hostLogList.replaceChildren();
    for (const entry of entries.slice(-200)) {
      const item = document.createElement('li');
      item.textContent = `${new Date(entry.at).toLocaleTimeString()} — ${entry.name}: ${formatPayload(entry.payload)}`;
      hostLogList.append(item);
    }
  }

  const unsubscribeChange = manager.onChange(() => {
    renderBotOptions();
    renderList();
  });
  const unsubscribeActive = manager.onActiveChange(() => {
    if (!selectedBotId) {
      selectedBotId = manager.activeBotIdValue();
      renderBotOptions();
      renderList();
    }
  });
  const unsubscribeHostLog = manager.onHostLog(renderHostLog);

  ctx.onDispose(() => {
    unsubscribeChange();
    unsubscribeActive();
    unsubscribeHostLog();
    search.destroy();
  });

  renderBotOptions();
  renderList();
  renderHostLog();
}
