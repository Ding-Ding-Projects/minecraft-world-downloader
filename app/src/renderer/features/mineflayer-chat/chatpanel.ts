import { el } from '../../core/a11y';
import type { DataTableColumn, DataTableHandle, ExportFormat, SearchBarHandle, TabContext } from '../../core/registry';
import { renderRuns } from './format';
import type { ChatRecord } from './model';
import { KEYS } from './model';
import { CHAT_CHANNELS } from './session';
import type { ChatChannel, PlayerSnapshot } from './session';
import type { ChatFeatureState } from './state';

/**
 * The main "Bot chat" tab: the message log, its filters and bulk actions, and
 * the composer that sends a message, a whisper or a command.
 */

type ComposeMode = 'message' | 'whisper' | 'command';

function isChatChannel(value: unknown): value is ChatChannel {
  return typeof value === 'string' && (CHAT_CHANNELS as string[]).includes(value);
}

function formatTime(ms: number): string {
  try {
    return new Date(ms).toLocaleTimeString();
  } catch {
    return '';
  }
}

function setDisabled(button: HTMLButtonElement, disabled: boolean, reason: string): void {
  button.disabled = disabled;
  if (disabled) {
    button.title = reason;
    button.setAttribute('aria-description', reason);
  } else {
    button.removeAttribute('title');
    button.removeAttribute('aria-description');
  }
}

export function mountChatPanel(host: HTMLElement, ctx: TabContext, state: ChatFeatureState): void {
  const store = state.store;
  host.classList.add('mineflayer-chat-panel');

  /* ================================================================ */
  /* Status                                                            */
  /* ================================================================ */

  const statusEl = el('div', {
    className: 'mineflayer-chat-status',
    attrs: { role: 'status', 'data-appearance-id': 'mineflayer-chat:status' }
  });
  const statusText = el('div', {});
  const statusTitle = el('p', { className: 'md-typescale-title-small' });
  const statusBody = el('p', { className: 'md-typescale-body-small' });
  statusText.append(statusTitle, statusBody);
  statusEl.append(statusText);
  host.append(
    ctx.components.topAppBar({ title: 'mineflayer-chat.tab.title', subtitle: 'mineflayer-chat.tab.subtitle' }),
    statusEl
  );

  function redrawStatus(): void {
    const reason = store.unavailableReason();
    statusEl.classList.remove('mineflayer-chat-status--bad', 'mineflayer-chat-status--good');
    if (reason === 'noRuntime') {
      statusEl.classList.add('mineflayer-chat-status--bad');
      statusTitle.textContent = ctx.t('mineflayer-chat.state.noRuntime', 'No bot runtime is available');
      statusBody.textContent = ctx.t(
        'mineflayer-chat.state.noRuntime.body',
        'The bot connection is owned by the bot control surface. Open it, connect a bot, and this surface follows that session. Nothing here is simulated while no session exists.'
      );
    } else if (reason === 'disconnected') {
      statusEl.classList.add('mineflayer-chat-status--bad');
      statusTitle.textContent = ctx.t('mineflayer-chat.state.disconnected', 'The bot is not connected');
      statusBody.textContent = ctx.t(
        'mineflayer-chat.state.disconnected.body',
        'Sending is unavailable until the session reconnects. The messages already received stay in the log and can still be searched, copied and exported.'
      );
    } else {
      statusEl.classList.add('mineflayer-chat-status--good');
      const session = store.currentSession();
      statusTitle.textContent = ctx.t('mineflayer-chat.state.connected', 'Connected as {username}', {
        values: { username: session ? session.username() : '' }
      });
      statusBody.textContent = '';
    }
    updateComposerAvailability();
  }

  /* ================================================================ */
  /* Channel filter                                                    */
  /* ================================================================ */

  const storedChannels = ctx.settings.get<unknown[]>(KEYS.channels, [...CHAT_CHANNELS]);
  let visibleChannels = new Set<ChatChannel>(
    Array.isArray(storedChannels) && storedChannels.some(isChatChannel)
      ? storedChannels.filter(isChatChannel)
      : [...CHAT_CHANNELS]
  );

  function persistChannels(): void {
    ctx.settings.set(KEYS.channels, [...visibleChannels]);
  }

  const channelRow = el('div', { className: 'mineflayer-chat-channels', attrs: { role: 'group' } });
  channelRow.setAttribute('aria-label', ctx.t('mineflayer-chat.channel.filter', 'Channels shown'));

  function redrawChannelChips(): void {
    channelRow.textContent = '';
    const counts = store.log.counts();
    for (const channel of CHAT_CHANNELS) {
      const chip = ctx.components.chip({
        label: ctx.t('mineflayer-chat.channel.count', '{channel} ({count})', {
          values: { channel: ctx.t(`mineflayer-chat.channel.${channel}`, channel), count: counts[channel] }
        }),
        selected: visibleChannels.has(channel),
        onToggle: (selected) => {
          if (selected) visibleChannels.add(channel);
          else visibleChannels.delete(channel);
          persistChannels();
          sync();
        }
      });
      channelRow.append(chip);
    }
  }
  host.append(channelRow);

  /* ================================================================ */
  /* Search                                                            */
  /* ================================================================ */

  const search: SearchBarHandle = ctx.createSearchBar({
    label: 'mineflayer-chat.search',
    sample: 'Diamonds! <Steno> anyone trading emeralds?\nSteno joined the game',
    onChange: () => sync()
  });
  search.root.id = 'mineflayer-chat-search';
  host.append(search.root);

  const droppedNote = el('p', {
    className: 'mineflayer-chat-dropped md-typescale-body-small',
    attrs: { role: 'status' }
  });
  droppedNote.hidden = true;
  host.append(droppedNote);

  /* ================================================================ */
  /* The log                                                           */
  /* ================================================================ */

  const resultsHead = el('div', { attrs: { id: 'mineflayer-chat-results' } });
  const resultsCount = el('p', { className: 'md-typescale-body-small', attrs: { role: 'status' } });
  resultsHead.append(resultsCount);
  host.append(resultsHead);

  const bulkBar = el('div', { className: 'mineflayer-chat-bulkbar', attrs: { role: 'group' } });
  bulkBar.hidden = true;
  host.append(bulkBar);

  const tableHost = el('div', { className: 'mineflayer-chat-table-wrap' });
  host.append(tableHost);

  let table: DataTableHandle<ChatRecord> | null = null;
  let columnsHaveTimestamps = ctx.settings.get<boolean>(KEYS.timestamps, true) === true;
  let followBottom = true;

  function filteredRecords(): ChatRecord[] {
    const query = search.query();
    const all = store.log.all();
    return all.filter((record) => {
      if (!visibleChannels.has(record.channel)) return false;
      if (query.text.trim() === '') return true;
      if (query.matches(record.plain)) return true;
      return record.sender !== null && query.matches(record.sender);
    });
  }

  function buildColumns(): Array<DataTableColumn<ChatRecord>> {
    const columns: Array<DataTableColumn<ChatRecord>> = [];
    if (columnsHaveTimestamps) {
      columns.push({
        id: 'time',
        label: ctx.t('mineflayer-chat.column.time', 'Time'),
        sortable: true,
        value: (record) => record.at,
        render: (record) => formatTime(record.at)
      });
    }
    columns.push({
      id: 'channel',
      label: ctx.t('mineflayer-chat.column.channel', 'Channel'),
      sortable: true,
      value: (record) => record.channel,
      render: (record) => ctx.t(`mineflayer-chat.channel.${record.channel}`, record.channel)
    });
    columns.push({
      id: 'sender',
      label: ctx.t('mineflayer-chat.column.sender', 'Sender'),
      sortable: true,
      value: (record) => record.sender ?? '',
      render: (record) => senderCell(record)
    });
    columns.push({
      id: 'message',
      label: ctx.t('mineflayer-chat.column.message', 'Message'),
      value: (record) => record.plain,
      render: (record) => messageCell(record)
    });
    return columns;
  }

  function senderCell(record: ChatRecord): HTMLElement {
    const wrap = el('span', { className: 'mineflayer-chat-sender-cell' });
    wrap.append(el('span', { text: record.sender ?? ctx.t('mineflayer-chat.sender.none', 'No sender') }));
    if (record.verified !== null) {
      wrap.append(
        ctx.components.icon(record.verified ? 'success' : 'warning', {
          size: 16,
          label: ctx.t(
            record.verified ? 'mineflayer-chat.verified' : 'mineflayer-chat.unverified',
            record.verified
              ? 'The server signed this message and the signature verified.'
              : 'The server sent this message without a verified signature.'
          )
        })
      );
    }
    return wrap;
  }

  function messageCell(record: ChatRecord): HTMLElement {
    const container = el('span', {
      className: 'mineflayer-chat-message-cell',
      attrs: {
        'aria-label': ctx.t('mineflayer-chat.row.label', '{channel} message from {sender} at {time}', {
          values: {
            channel: ctx.t(`mineflayer-chat.channel.${record.channel}`, record.channel),
            sender: record.sender ?? ctx.t('mineflayer-chat.sender.none', 'No sender'),
            time: formatTime(record.at)
          }
        })
      }
    });
    container.append(renderRuns(record.runs, ctx.a11y.reducedMotion()));
    return container;
  }

  function rebuildTable(rows: ChatRecord[]): void {
    tableHost.textContent = '';
    if (store.log.size() === 0) {
      table = null;
      tableHost.append(
        ctx.components.emptyState({
          title: ctx.t('mineflayer-chat.log.empty', 'No messages yet'),
          body: ctx.t('mineflayer-chat.log.empty.body', 'Messages appear here as the server sends them. Send one below to start.'),
          action: { label: 'mineflayer-chat.compose.send', variant: 'tonal', onClick: () => messageFieldEl?.focus() }
        })
      );
      return;
    }
    table = ctx.components.dataTable<ChatRecord>({
      label: ctx.t('mineflayer-chat.section.log', 'Message log'),
      columns: buildColumns(),
      rows,
      rowId: (record) => record.id,
      selectable: true,
      onSelectionChange: () => updateBulkBar(),
      emptyMessage: 'core.search.noMatches'
    });
    tableHost.append(table.root);
  }

  function sync(): void {
    redrawChannelChips();
    const rows = filteredRecords();
    const wantsTimestamps = ctx.settings.get<boolean>(KEYS.timestamps, true) === true;
    const columnsChanged = wantsTimestamps !== columnsHaveTimestamps;
    columnsHaveTimestamps = wantsTimestamps;
    const regimeEmpty = store.log.size() === 0;
    if ((table === null) !== regimeEmpty || table === null || columnsChanged) {
      rebuildTable(rows);
    } else {
      table.setRows(rows);
    }

    resultsCount.textContent = ctx.t('mineflayer-chat.log.showing', 'Showing {shown} of {total} messages', {
      values: { shown: rows.length, total: store.log.size() }
    });

    const dropped = store.log.dropped();
    droppedNote.hidden = dropped === 0;
    if (dropped > 0) {
      droppedNote.textContent = ctx.t(
        'mineflayer-chat.log.dropped',
        '{count} older messages were dropped to stay inside the retention limit of {limit}.',
        { values: { count: dropped, limit: store.log.currentLimit() } }
      );
    }

    updateBulkBar();
    maybeAutoScroll();
  }

  /* ---------------- auto-scroll ---------------- */

  host.addEventListener('scroll', () => {
    followBottom = host.scrollHeight - host.scrollTop - host.clientHeight < 48;
  });

  function maybeAutoScroll(): void {
    if (ctx.settings.get<boolean>(KEYS.autoScroll, true) !== true) return;
    if (!followBottom) return;
    requestAnimationFrame(() => {
      host.scrollTop = host.scrollHeight;
    });
  }

  /* ---------------- bulk actions ---------------- */

  function updateBulkBar(): void {
    bulkBar.textContent = '';
    const selected = table ? table.selection() : [];
    if (selected.length === 0) {
      bulkBar.hidden = true;
      return;
    }
    bulkBar.hidden = false;
    bulkBar.setAttribute(
      'aria-label',
      ctx.t('mineflayer-chat.log.selected', '{count} selected', { values: { count: selected.length } })
    );

    const label = el('span', {
      className: 'md-typescale-label-large',
      text: ctx.t('mineflayer-chat.log.selected', '{count} selected', { values: { count: selected.length } })
    });

    const shownIds = filteredRecords().map((record) => record.id);
    const selectShown = ctx.components.button({
      label: ctx.t('mineflayer-chat.select.shown', 'Select all {count} shown', { values: { count: shownIds.length } }),
      variant: 'text',
      onClick: () => {
        table?.setSelection(shownIds);
        updateBulkBar();
      }
    });
    const selectEverything = ctx.components.button({
      label: ctx.t('mineflayer-chat.select.everything', 'Select all {count} in the log', {
        values: { count: store.log.size() }
      }),
      variant: 'text',
      onClick: () => {
        search.clear();
        visibleChannels = new Set([...CHAT_CHANNELS]);
        persistChannels();
        sync();
        table?.setSelection(store.log.all().map((record) => record.id));
        updateBulkBar();
      }
    });
    const invert = ctx.components.button({
      label: 'mineflayer-chat.select.invert',
      variant: 'text',
      onClick: () => {
        const current = new Set(table?.selection() ?? []);
        table?.setSelection(shownIds.filter((id) => !current.has(id)));
        updateBulkBar();
      }
    });
    const clear = ctx.components.button({
      label: 'mineflayer-chat.select.clear',
      variant: 'text',
      onClick: () => {
        table?.clearSelection();
        updateBulkBar();
      }
    });
    const copyButton = ctx.components.button({
      label: 'mineflayer-chat.action.copy',
      variant: 'text',
      icon: 'copy',
      onClick: () => void copySelected(selected)
    });
    const exportButton = ctx.components.button({
      label: 'mineflayer-chat.action.export',
      variant: 'tonal',
      icon: 'download',
      onClick: (event) => void openExportDialog(selected, event.currentTarget as HTMLElement)
    });
    const deleteButton = ctx.components.button({
      label: 'mineflayer-chat.action.delete',
      variant: 'text',
      icon: 'trash',
      danger: true,
      onClick: (event) => void deleteSelected(selected, event.currentTarget as HTMLElement)
    });

    bulkBar.append(
      label,
      selectShown,
      selectEverything,
      invert,
      clear,
      ctx.components.divider(true),
      copyButton,
      exportButton,
      deleteButton
    );
  }

  function recordsById(ids: string[]): ChatRecord[] {
    const out: ChatRecord[] = [];
    for (const id of ids) {
      const record = store.log.byId(id);
      if (record) out.push(record);
    }
    return out;
  }

  async function copySelected(ids: string[]): Promise<void> {
    const records = recordsById(ids);
    const text = records
      .map(
        (record) =>
          `[${formatTime(record.at)}] [${ctx.t(`mineflayer-chat.channel.${record.channel}`, record.channel)}] ${
            record.sender ? `${record.sender}: ` : ''
          }${record.plain}`
      )
      .join('\n');
    try {
      await navigator.clipboard.writeText(text);
      ctx.notify.success(
        ctx.t('mineflayer-chat.action.copy', 'Copy'),
        ctx.t('mineflayer-chat.action.copied', 'Copied {count} messages to the clipboard', { values: { count: records.length } })
      );
    } catch (error) {
      ctx.notify.error(
        ctx.t('mineflayer-chat.action.copy', 'Copy'),
        `${ctx.t('mineflayer-chat.action.copyFailed', 'The clipboard refused the copy')}${
          error instanceof Error ? `: ${error.message}` : ''
        }`
      );
    }
  }

  function toExportRecord(record: ChatRecord): Record<string, unknown> {
    return {
      id: record.id,
      at: new Date(record.at).toISOString(),
      channel: record.channel,
      sender: record.sender,
      verified: record.verified,
      message: record.plain,
      formatted: record.raw
    };
  }

  async function openExportDialog(ids: string[], anchor: HTMLElement): Promise<void> {
    const scope = ids.length > 0 ? recordsById(ids) : filteredRecords();
    if (scope.length === 0) {
      ctx.notify.info(ctx.t('mineflayer-chat.action.export', 'Export'), ctx.t('core.search.noMatches', 'Nothing matched.'));
      return;
    }
    const body = el('div', { className: 'mineflayer-chat-composer' });
    body.append(
      el('p', {
        className: 'md-typescale-body-medium',
        text: ctx.t(
          'mineflayer-chat.action.export.scope',
          'Exports the {count} messages currently shown, in the order shown, with the active filter applied.',
          { values: { count: scope.length } }
        )
      })
    );
    let format = String(ctx.settings.get<string>(KEYS.exportFormat, 'json')) as ExportFormat;
    const losses = el('p', { className: 'md-typescale-body-small', attrs: { role: 'status' } });
    const describe = (): void => {
      const records = scope.map(toExportRecord);
      const preflight = ctx.exporter.preflight(records, format);
      losses.textContent =
        preflight.losses.length === 0
          ? ''
          : ctx.t('mineflayer-chat.action.exportLoss', 'The {format} format cannot carry every field: {fields}. Everything else is written in full.', {
              values: { format: format.toUpperCase(), fields: preflight.losses.map((loss) => `${loss.field} (${loss.reason})`).join('; ') }
            });
    };
    const formatSelect = ctx.components.select({
      label: 'mineflayer-chat.action.export.format',
      value: format,
      options: ctx.exporter.formats().map((candidate) => ({ value: candidate, label: candidate.toUpperCase() })),
      onChange: (value) => {
        format = value as ExportFormat;
        describe();
      }
    });
    body.append(formatSelect.root, losses);
    describe();

    const approved = await ctx.components.dialog({
      title: ctx.t('mineflayer-chat.action.export', 'Export'),
      body,
      confirmLabel: ctx.t('mineflayer-chat.action.export', 'Export')
    });
    if (!approved) {
      anchor.focus();
      return;
    }
    ctx.settings.set(KEYS.exportFormat, format);
    const path = await ctx.exporter.save(scope.map(toExportRecord), format, {
      name: 'mineflayer-chat-log',
      schemaVersion: '1',
      defaultFileName: `bot-chat-log.${format === 'markdown' ? 'md' : format}`
    });
    if (path) {
      ctx.notify.success(
        ctx.t('mineflayer-chat.action.export', 'Export'),
        ctx.t('mineflayer-chat.action.exported', 'Exported to {path}', { values: { path } })
      );
      await ctx.history.record('Exported the bot chat log', 'mineflayer-chat', { count: scope.length, format });
    }
  }

  async function deleteSelected(ids: string[], anchor: HTMLElement): Promise<void> {
    const records = recordsById(ids);
    if (records.length === 0) return;
    const approved = await ctx.confirm.request({
      action: `Delete ${records.length} chat log messages`,
      affected: records
        .slice(0, 20)
        .map((record) => `[${formatTime(record.at)}] ${record.sender ? `${record.sender}: ` : ''}${record.plain.slice(0, 120)}`),
      irreversible: ctx.t(
        'mineflayer-chat.delete.irreversible',
        'The selected messages are removed from this window’s log. The log is held in memory only, so they cannot be fetched back from the server and cannot be recovered. The deletion is recorded in local history.'
      ),
      anchor,
      confirmLabel: ctx.t('mineflayer-chat.action.delete', 'Delete')
    });
    if (!approved) return;
    const removed = store.removeMessages(new Set(ids));
    await ctx.history.record(`Deleted ${removed} chat log messages`, 'mineflayer-chat', {
      ids: ids.slice(0, 200),
      count: removed
    });
    ctx.notify.success(
      ctx.t('mineflayer-chat.action.delete', 'Delete'),
      ctx.t('mineflayer-chat.delete.done', '{count} messages removed from the log', { values: { count: removed } })
    );
  }

  /* ================================================================ */
  /* Composer                                                          */
  /* ================================================================ */

  const composer = el('section', {
    className: 'mineflayer-chat-composer',
    attrs: { id: 'mineflayer-chat-composer', 'data-appearance-id': 'mineflayer-chat:composer' }
  });
  composer.append(
    ctx.components.sectionHeading({
      title: 'mineflayer-chat.section.compose',
      description: 'mineflayer-chat.section.compose.description'
    })
  );

  let mode: ComposeMode = 'message';
  let recipientSelected = '';
  let recipientTyped = '';

  const modeControl = ctx.components.segmentedButton({
    label: ctx.t('mineflayer-chat.compose.mode', 'What to send'),
    options: [
      { value: 'message', label: ctx.t('mineflayer-chat.compose.mode.message', 'Message') },
      { value: 'whisper', label: ctx.t('mineflayer-chat.compose.mode.whisper', 'Whisper') },
      { value: 'command', label: ctx.t('mineflayer-chat.compose.mode.command', 'Command') }
    ],
    value: mode,
    onChange: (value) => {
      mode = value as ComposeMode;
      rebuildMessageField();
      renderRecipientBlock();
      syncCommandWarning();
    }
  });
  composer.append(modeControl.root);

  const recipientHost = el('div', { className: 'mineflayer-chat-composer__row' });
  composer.append(recipientHost);

  function renderRecipientBlock(): void {
    recipientHost.textContent = '';
    recipientHost.hidden = mode !== 'whisper';
    if (mode !== 'whisper') return;

    const players: PlayerSnapshot[] = store.serverState().players;
    if (players.length > 0) {
      const select = ctx.components.select({
        label: ctx.t('mineflayer-chat.compose.recipient', 'Whisper to'),
        options: players.map((player) => ({ value: player.username, label: player.username })),
        value: recipientSelected,
        onChange: (value) => {
          recipientSelected = value;
        }
      });
      recipientHost.append(select.root);
    } else {
      recipientHost.append(
        el('p', {
          className: 'md-typescale-body-small',
          text: ctx.t('mineflayer-chat.compose.recipient.empty', 'No players are listed yet')
        })
      );
    }
    const typedField = ctx.components.textField({
      label: ctx.t('mineflayer-chat.compose.recipient.typed', 'Type a name instead'),
      value: recipientTyped,
      onChange: (value) => {
        recipientTyped = value;
      }
    });
    recipientHost.append(typedField.root);
    recipientHost.append(
      el('p', {
        className: 'md-typescale-body-small',
        text: ctx.t(
          'mineflayer-chat.compose.recipient.help',
          'The list comes from the server’s own tab list. A player who is not listed can still be typed in.'
        )
      })
    );
  }

  const messageFieldHost = el('div', { className: 'mineflayer-chat-composer__row' });
  composer.append(messageFieldHost);

  let messageValue = '';
  let messageFieldEl: ReturnType<typeof ctx.components.textField> | null = null;

  function rebuildMessageField(): void {
    messageFieldHost.textContent = '';
    messageFieldEl = ctx.components.textField({
      label:
        mode === 'command'
          ? ctx.t('mineflayer-chat.compose.command', 'Command')
          : ctx.t('mineflayer-chat.compose.message', 'Message text'),
      value: messageValue,
      variant: 'outlined',
      supportingText:
        mode === 'command' ? ctx.t('mineflayer-chat.compose.command.hint', 'A leading slash is added if you leave it off.') : undefined,
      onChange: (value) => {
        messageValue = value;
        updateLengthCounter();
      },
      id: 'mineflayer-chat-composer-field'
    });
    messageFieldHost.append(messageFieldEl.root);
    if (mode === 'command') {
      const tabCompleteButton = ctx.components.iconButton({
        icon: 'search',
        label: ctx.t('mineflayer-chat.compose.complete', 'Ask the server for completions'),
        onClick: (event) => void handleTabComplete(event.currentTarget as HTMLElement)
      });
      messageFieldHost.append(tabCompleteButton);
    }
    updateLengthCounter();
  }

  const composerMeta = el('div', { className: 'mineflayer-chat-composer__meta' });
  const lengthCounter = el('span', { className: 'md-typescale-body-small', attrs: { role: 'status' } });
  const lengthOverNote = el('span', { className: 'md-typescale-body-small' });
  lengthOverNote.hidden = true;
  composerMeta.append(lengthCounter, lengthOverNote);
  composer.append(composerMeta);

  function updateLengthCounter(): void {
    const session = store.currentSession();
    const limit = session ? session.chatLengthLimit() : 256;
    lengthCounter.textContent = ctx.t('mineflayer-chat.compose.length', '{used} of {limit} characters', {
      values: { used: messageValue.length, limit }
    });
    if (messageValue.length > limit && limit > 0) {
      lengthOverNote.hidden = false;
      lengthOverNote.textContent = ctx.t(
        'mineflayer-chat.compose.length.over',
        'Over the server’s limit of {limit} characters. The library splits a long message into several, so it will arrive as {parts} separate lines.',
        { values: { limit, parts: Math.ceil(messageValue.length / limit) } }
      );
    } else {
      lengthOverNote.hidden = true;
    }
  }

  const commandWarning = el('p', { className: 'mineflayer-chat-composer__warning', attrs: { role: 'status' } });
  commandWarning.hidden = true;
  composer.append(commandWarning);

  function syncCommandWarning(): void {
    commandWarning.hidden = mode !== 'command';
    if (mode === 'command') {
      commandWarning.textContent = ctx.t(
        'mineflayer-chat.compose.commandWarning',
        'This is sent to the server as a command. What it does depends entirely on the server, and this application cannot undo it.'
      );
    }
  }

  const sendButton = ctx.components.button({
    label: 'mineflayer-chat.compose.send',
    variant: 'filled',
    icon: 'save',
    onClick: () => void handleSend()
  });
  composer.append(sendButton);
  host.append(composer);

  function updateComposerAvailability(): void {
    const reason = store.unavailableReason();
    const disabled = reason !== null;
    const reasonText = reason
      ? ctx.t(
          `mineflayer-chat.state.${reason}`,
          reason === 'noRuntime' ? 'No bot runtime is available' : 'The bot is not connected'
        )
      : '';
    setDisabled(sendButton, disabled, reasonText);
    updateLengthCounter();
  }

  async function handleSend(): Promise<void> {
    const session = store.currentSession();
    const reason = store.unavailableReason();
    if (reason || !session) {
      ctx.notify.warn(
        ctx.t('mineflayer-chat.section.compose', 'Send a message'),
        ctx.t(`mineflayer-chat.state.${reason ?? 'noRuntime'}`, 'The bot is not connected')
      );
      return;
    }
    const text = messageValue.trim();
    if (text.length === 0) {
      ctx.notify.info(
        ctx.t('mineflayer-chat.section.compose', 'Send a message'),
        ctx.t('mineflayer-chat.compose.empty', 'There is nothing to send yet')
      );
      return;
    }
    if (mode === 'whisper') {
      const recipient = (recipientSelected || recipientTyped).trim();
      if (recipient.length === 0) {
        ctx.notify.info(
          ctx.t('mineflayer-chat.section.compose', 'Send a message'),
          ctx.t('mineflayer-chat.compose.needRecipient', 'A whisper needs a recipient')
        );
        return;
      }
      session.whisper(recipient, text);
      store.recordOutgoing(`/tell ${recipient} ${text}`);
    } else if (mode === 'command') {
      const outgoing = text.startsWith('/') ? text : `/${text}`;
      session.chat(outgoing);
      store.recordOutgoing(outgoing);
    } else {
      session.chat(text);
      store.recordOutgoing(text);
    }
    messageValue = '';
    messageFieldEl?.set('');
    updateLengthCounter();
    ctx.notify.success(ctx.t('mineflayer-chat.compose.sent', 'Sent'), text.length > 160 ? `${text.slice(0, 160)}…` : text);
    ctx.a11y.announce(ctx.t('mineflayer-chat.compose.sent', 'Sent'));
    messageFieldEl?.focus();
  }

  async function handleTabComplete(anchor: HTMLElement): Promise<void> {
    const session = store.currentSession();
    if (!session) return;
    try {
      const completions = await session.tabComplete(messageValue);
      if (completions.length === 0) {
        ctx.notify.info(
          ctx.t('mineflayer-chat.compose.complete', 'Ask the server for completions'),
          ctx.t('mineflayer-chat.compose.complete.none', 'The server offered no completions for that')
        );
        return;
      }
      ctx.components.menu({
        anchor,
        label: ctx.t('mineflayer-chat.compose.complete', 'Ask the server for completions'),
        items: completions.slice(0, 50).map((completion, index) => ({
          id: `mineflayer-chat-completion-${index}`,
          label: completion,
          run: () => {
            messageValue = completion;
            messageFieldEl?.set(completion);
            updateLengthCounter();
            messageFieldEl?.focus();
          }
        }))
      });
    } catch (error) {
      ctx.notify.error(
        ctx.t('mineflayer-chat.compose.complete', 'Ask the server for completions'),
        ctx.t('mineflayer-chat.compose.complete.failed', 'The completion request failed: {reason}', {
          values: { reason: error instanceof Error ? error.message : String(error) }
        })
      );
    }
  }

  rebuildMessageField();
  renderRecipientBlock();
  syncCommandWarning();

  /* ================================================================ */
  /* Wiring                                                            */
  /* ================================================================ */

  const offSession = store.on('session', () => redrawStatus());
  const offServer = store.on('server', () => renderRecipientBlock());
  const offMessages = store.on('messages', () => sync());

  state.registerExportLog(() => void openExportDialog([], sendButton));

  ctx.onDispose(() => {
    offSession();
    offServer();
    offMessages();
    search.destroy();
    state.registerExportLog(null);
  });

  redrawStatus();
  sync();
}
