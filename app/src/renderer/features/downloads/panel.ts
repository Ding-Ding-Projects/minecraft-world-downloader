import { el } from '../../core/a11y';
import type { AppContext, DataTableColumn, TabContext } from '../../core/registry';
import { downloadBridge, type BridgeState } from './bridge';
import { downloadsController } from './controller';
import {
  formatBytes,
  formatExactBytes,
  formatPercent,
  formatRate,
  formatTimestamp,
  fraction,
  shortenUrl
} from './format';
import { ACTIVE_STATES, RESUMABLE_STATES, type DownloadRecord, type DownloadState } from './model';
import { stateFallback, stateLabelKey } from './progressWindow';
import { downloadStore, searchableText, toRow } from './store';

/**
 * The Downloads tab: the capture receiver's status, an address to add a
 * download by hand, the search field, the bulk-action toolbar and the list
 * itself.
 *
 * The list has no paging. Every download this application has ever captured
 * or been given by address stays here until it is removed, so "select all"
 * and "every match currently shown" are always the same thing — there is no
 * hidden second page for either of them to disagree about.
 */

async function copyText(ctx: AppContext, text: string, what: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    ctx.a11y.announce(`${what}: ${ctx.t('core.action.copy', 'Copy')}`);
  } catch (error) {
    ctx.notify.error(
      ctx.t('downloads.receiver.pairing.title', 'Pair the browser extension'),
      error instanceof Error ? error.message : String(error)
    );
  }
}

function severityForState(state: DownloadState): 'info' | 'success' | 'warning' | 'error' | 'progress' {
  switch (state) {
    case 'completed':
      return 'success';
    case 'failed':
      return 'error';
    case 'downloading':
    case 'connecting':
      return 'progress';
    case 'awaiting-decision':
    case 'paused':
    case 'interrupted':
      return 'warning';
    default:
      return 'info';
  }
}

function detailRow(term: string, value: HTMLElement): HTMLElement {
  const row = el('div', { className: 'downloads-detail' });
  row.append(el('span', { className: 'downloads-detail__term md-typescale-label-medium', text: term }), value);
  return row;
}

/* ================================================================== */
/* The receiver card                                                   */
/* ================================================================== */

interface ReceiverCard {
  root: HTMLElement;
  refresh(state: BridgeState): void;
}

/**
 * Opens the pairing popover anchored beside `anchor`. Takes a plain
 * `AppContext` rather than a `TabContext` because it only needs the ordinary
 * services every surface has — it is called both from the Downloads tab
 * itself and from the settings action, which has no tab of its own to be
 * inside.
 */
export function openPairingPopover(ctx: AppContext, anchor: HTMLElement): void {
  const state = downloadBridge.state();
  const handle = ctx.overlay.open({
    anchor,
    placement: 'bottom-end',
    role: 'dialog',
    label: ctx.t('downloads.receiver.pairing.title', 'Pair the browser extension'),
    resizeKey: 'downloads.pairing',
    dragKey: 'downloads.pairing'
  });
  handle.root.classList.add('downloads-pairing');
  handle.root.setAttribute('data-appearance-id', 'downloads.pairing');
  ctx.appearance.applyTo(handle.root, '[data-appearance-id="downloads.pairing"]');

  const body = handle.body;
  const listening = state.status === 'listening' || state.status === 'degraded';

  body.append(el('h2', { className: 'md-typescale-title-medium', text: ctx.t('downloads.receiver.pairing.title', 'Pair the browser extension') }));

  if (!listening) {
    body.append(
      el('p', {
        className: 'md-typescale-body-medium',
        text: ctx.t(
          'downloads.receiver.pairing.notListening',
          'The receiver is not listening right now, so there is nothing to pair yet. Start it first.'
        )
      })
    );
  } else {
    body.append(
      el('p', {
        className: 'md-typescale-body-medium',
        text: ctx.t(
          'downloads.receiver.pairing.intro',
          'In the extension’s settings, paste both of these and press Test the connection.'
        )
      }),
      detailRow(
        ctx.t('downloads.receiver.endpoint.label', 'Loopback address'),
        el('span', { className: 'downloads-detail__value md-typescale-body-medium', text: downloadBridge.endpoint() })
      ),
      detailRow(
        ctx.t('downloads.receiver.token.label', 'Pairing token'),
        el('span', {
          className: 'downloads-detail__value md-typescale-body-medium',
          text: state.token,
          attrs: { style: 'font-family: var(--md-sys-typeface-mono); word-break: break-all;' }
        })
      )
    );
    const actions = el('div', { className: 'downloads-pairing__actions' });
    actions.append(
      ctx.components.button({
        label: 'downloads.receiver.pairing.copyEndpoint',
        variant: 'tonal',
        icon: 'copy',
        onClick: () => void copyText(ctx, downloadBridge.endpoint(), ctx.t('downloads.receiver.endpoint.label', 'Loopback address'))
      }),
      ctx.components.button({
        label: 'downloads.receiver.pairing.copyToken',
        variant: 'tonal',
        icon: 'copy',
        onClick: () => void copyText(ctx, state.token, ctx.t('downloads.receiver.token.label', 'Pairing token'))
      })
    );
    body.append(
      actions,
      el('p', {
        className: 'downloads-pairing__note md-typescale-body-small',
        text: ctx.t(
          'downloads.receiver.pairing.regenerate',
          'A new token is generated every time the receiver starts. If pairing stops working, the receiver was restarted — come back here for the new one.'
        )
      })
    );
  }

  body.append(
    ctx.components.button({
      label: 'downloads.receiver.pairing.close',
      variant: 'text',
      onClick: () => handle.close()
    })
  );

  handle.reposition();
}

function buildReceiverCard(ctx: TabContext): ReceiverCard {
  const card = ctx.components.card({ variant: 'outlined' });
  card.classList.add('downloads-receiver');
  card.setAttribute('id', 'downloads-receiver');
  card.setAttribute('data-appearance-id', 'downloads.receiverCard');
  ctx.appearance.applyTo(card, '[data-appearance-id="downloads.receiverCard"]');

  card.append(
    ctx.components.sectionHeading({
      title: 'downloads.receiver.card.title',
      description: 'downloads.receiver.card.description'
    })
  );

  const statusLine = el('p', {
    className: 'downloads-receiver__status md-typescale-title-small',
    attrs: { role: 'status', 'aria-live': 'polite' }
  });
  const detailLine = el('p', { className: 'downloads-receiver__detail md-typescale-body-small' });
  const errorLine = el('p', { className: 'downloads-receiver__error md-typescale-body-small' });

  const startButton = ctx.components.button({
    label: 'downloads.receiver.start',
    variant: 'filled',
    icon: 'play',
    onClick: () => void downloadsController.startReceiver()
  });
  const stopButton = ctx.components.button({
    label: 'downloads.receiver.stop',
    variant: 'outlined',
    icon: 'stop',
    onClick: () => void downloadsController.stopReceiver()
  });
  const restartButton = ctx.components.button({
    label: 'downloads.receiver.restart',
    variant: 'text',
    icon: 'refresh',
    onClick: () => void downloadsController.startReceiver()
  });
  const pairingButton = ctx.components.button({
    label: 'downloads.receiver.pairing.open',
    variant: 'tonal',
    icon: 'key',
    id: 'downloads-pairing-button',
    onClick: (event) => openPairingPopover(ctx, event.currentTarget as HTMLElement)
  });

  const actions = el('div', { className: 'downloads-receiver__actions' });
  actions.append(startButton, stopButton, restartButton, pairingButton);

  card.append(statusLine, detailLine, errorLine, actions);

  function refresh(state: BridgeState): void {
    card.setAttribute('data-status', state.status);
    statusLine.textContent = ctx.t(`downloads.receiver.status.${state.status}`, state.status);
    const listening = state.status === 'listening' || state.status === 'degraded';
    detailLine.textContent = listening
      ? ctx.t('downloads.receiver.detail.listening', 'Listening on {endpoint}. Node {version}.', {
          values: { endpoint: downloadBridge.endpoint(), version: state.nodeVersion || ctx.t('downloads.value.none', 'None') }
        })
      : '';
    errorLine.hidden = state.error.length === 0;
    errorLine.textContent = state.error;

    startButton.hidden = listening || state.status === 'starting';
    stopButton.hidden = !(listening || state.status === 'starting');
    restartButton.hidden = !listening;
  }

  return { root: card, refresh };
}

/* ================================================================== */
/* Adding a download by address                                        */
/* ================================================================== */

/**
 * Opens the "add by address" dialog. Takes a plain `AppContext` — it only
 * needs `components` and `t`, so it works exactly the same whether it was
 * opened from the Downloads tab itself or from the command palette while a
 * different tab is showing.
 */
export async function openManualAddDialog(ctx: AppContext): Promise<void> {
  const urlField = ctx.components.textField({
    label: 'downloads.manual.dialog.url',
    variant: 'outlined',
    type: 'url',
    placeholder: 'https://example.com/file.zip',
    supportingText: ctx.t(
      'downloads.manual.dialog.hint',
      'Only http and https addresses can be downloaded. This opens the same Start download dialog a captured download does.'
    )
  });
  const body = el('div', { className: 'downloads-manual' });
  body.append(urlField.root);

  window.setTimeout(() => urlField.focus(), 60);
  const confirmed = await ctx.components.dialog({
    title: 'downloads.manual.dialog.title',
    icon: 'add',
    body,
    confirmLabel: ctx.t('downloads.manual.dialog.confirm', 'Continue'),
    cancelLabel: ctx.t('downloads.manual.dialog.cancel', 'Cancel')
  });
  if (!confirmed) return;
  const url = urlField.get().trim();
  if (!url) return;
  await downloadsController.addManual(url);
}

/* ================================================================== */
/* The table                                                           */
/* ================================================================== */

function stateBadge(ctx: TabContext, state: DownloadState): HTMLElement {
  return ctx.components.badge({
    label: ctx.t(stateLabelKey(state), stateFallback(state)),
    severity: severityForState(state)
  });
}

function rowActions(ctx: TabContext, record: DownloadRecord): HTMLElement {
  const wrap = el('div', { className: 'downloads-row__actions' });
  const active = ACTIVE_STATES.includes(record.state);
  // Resumable minus "failed", which gets its own Retry button below rather
  // than sharing this block's progress-window and cancel actions.
  const pausedLike = record.state === 'paused' || record.state === 'interrupted' || record.state === 'queued';

  if (active) {
    wrap.append(
      ctx.components.iconButton({
        icon: 'pause',
        label: ctx.t('downloads.action.pause', 'Pause'),
        onClick: () => downloadsController.pause(record.id)
      })
    );
  }
  if (pausedLike) {
    wrap.append(
      ctx.components.iconButton({
        icon: 'play',
        label: ctx.t('downloads.action.resume', 'Resume'),
        onClick: () => downloadsController.resume(record.id)
      })
    );
  }
  if (record.state === 'failed') {
    wrap.append(
      ctx.components.iconButton({
        icon: 'refresh',
        label: ctx.t('downloads.action.retry', 'Retry'),
        onClick: () => downloadsController.retry(record.id)
      })
    );
  }
  if (active || pausedLike) {
    wrap.append(
      ctx.components.iconButton({
        icon: 'download',
        label: ctx.t('downloads.action.openProgress', 'Show progress window'),
        onClick: () => downloadsController.openProgress(record.id)
      })
    );
    wrap.append(
      ctx.components.iconButton({
        icon: 'stop',
        label: ctx.t('downloads.action.cancel', 'Cancel'),
        onClick: (event) => void downloadsController.cancel(record.id, event.currentTarget as HTMLElement)
      })
    );
  }
  if (record.state === 'completed') {
    wrap.append(
      ctx.components.iconButton({
        icon: 'file',
        label: ctx.t('downloads.action.openFile', 'Open the file'),
        onClick: () => void downloadsController.open(record.id)
      }),
      ctx.components.iconButton({
        icon: 'folder',
        label: ctx.t('downloads.action.reveal', 'Show in folder'),
        onClick: () => void downloadsController.reveal(record.id)
      })
    );
  }
  return wrap;
}

function buildColumns(ctx: TabContext): Array<DataTableColumn<DownloadRecord>> {
  return [
    {
      id: 'filename',
      label: ctx.t('downloads.column.filename', 'File'),
      sortable: true,
      value: (row) => row.filename,
      render: (row) => {
        const wrap = el('div', { className: 'downloads-row__name' });
        wrap.append(
          el('span', {
            className: 'downloads-row__filename md-typescale-body-medium',
            text: row.filename,
            attrs: { id: `downloads-row-${row.id}`, tabindex: '-1' }
          }),
          el('span', {
            className: 'downloads-row__host md-typescale-body-small',
            text: row.host || ctx.t('downloads.value.unknownHost', 'An unnamed host')
          })
        );
        return wrap;
      }
    },
    {
      id: 'state',
      label: ctx.t('downloads.column.state', 'State'),
      sortable: true,
      value: (row) => row.state,
      render: (row) => stateBadge(ctx, row.state)
    },
    {
      id: 'progress',
      label: ctx.t('downloads.column.progress', 'Received'),
      align: 'end',
      sortable: true,
      value: (row) => row.received,
      render: (row) => {
        const ratio = fraction(row.received, row.total);
        const text =
          row.total === null
            ? `${formatBytes(row.received)} (${formatExactBytes(row.received)} B)`
            : `${formatBytes(row.received)} / ${formatBytes(row.total)} · ${formatPercent(ratio)}`;
        return el('span', { className: 'md-typescale-body-small', text });
      }
    },
    {
      id: 'rate',
      label: ctx.t('downloads.column.rate', 'Rate'),
      align: 'end',
      sortable: true,
      value: (row) => row.bytesPerSecond,
      render: (row) =>
        el('span', {
          className: 'md-typescale-body-small',
          text: ACTIVE_STATES.includes(row.state) ? formatRate(row.bytesPerSecond) : '—'
        })
    },
    {
      id: 'destination',
      label: ctx.t('downloads.column.destination', 'Destination'),
      value: (row) => row.destination,
      render: (row) => el('span', { className: 'downloads-row__path md-typescale-body-small', text: shortenUrl(row.destination, 64) })
    },
    {
      id: 'captured',
      label: ctx.t('downloads.column.captured', 'Captured'),
      sortable: true,
      value: (row) => row.capturedAt,
      render: (row) => el('span', { className: 'md-typescale-body-small', text: formatTimestamp(row.capturedAt) })
    },
    {
      id: 'actions',
      label: ctx.t('downloads.column.actions', 'Actions'),
      render: (row) => rowActions(ctx, row)
    }
  ];
}

/* ================================================================== */
/* Mounting the tab                                                    */
/* ================================================================== */

export function mountDownloadsPanel(host: HTMLElement, ctx: TabContext): void {
  const root = el('div', { className: 'downloads-panel' });
  host.append(root);

  root.append(ctx.components.topAppBar({ title: 'downloads.tab.title', subtitle: 'downloads.tab.subtitle' }));

  const receiverCard = buildReceiverCard(ctx);
  root.append(receiverCard.root);

  const addButton = ctx.components.button({
    label: 'downloads.action.addManual',
    variant: 'tonal',
    icon: 'add',
    onClick: () => void openManualAddDialog(ctx)
  });

  const toolbar = el('div', { className: 'downloads-toolbar' });
  const searchWrap = el('div', { className: 'downloads-toolbar__search' });

  const summary = el('p', { className: 'downloads-bulk__summary md-typescale-body-small', attrs: { role: 'status', 'aria-live': 'polite' } });

  const bulk = el('div', { className: 'downloads-bulk' });
  const bulkActions = el('div', { className: 'downloads-bulk__actions' });

  let allRecords: DownloadRecord[] = downloadStore.all();
  let filtered: DownloadRecord[] = [...allRecords];

  const table = ctx.components.dataTable<DownloadRecord>({
    label: ctx.t('downloads.tab.title', 'Downloads'),
    columns: buildColumns(ctx),
    rows: filtered,
    rowId: (row) => row.id,
    selectable: true,
    emptyMessage: 'downloads.table.empty',
    onSelectionChange: () => refreshSummary()
  });

  const tableWrap = el('div', { className: 'downloads-table-wrap', attrs: { id: 'downloads-results' } });
  tableWrap.append(table.root);

  function refreshSummary(): void {
    const selected = table.selection().length;
    summary.textContent = ctx.t('downloads.selection.summary', '{selected} of {shown} shown selected ({total} total).', {
      values: { selected: String(selected), shown: String(filtered.length), total: String(allRecords.length) }
    });
  }

  const retrySelectedButton = ctx.components.button({
    label: 'downloads.action.retrySelected',
    variant: 'text',
    icon: 'refresh',
    onClick: () => {
      const selected = table.selection();
      const applicable = selected.filter((id) => downloadStore.byId(id)?.state === 'failed');
      if (applicable.length === 0) {
        ctx.notify.info(
          ctx.t('downloads.bulk.retry.title', 'Retry selected'),
          ctx.t('downloads.bulk.retry.none', 'None of the selected downloads have failed, so nothing was retried.')
        );
        return;
      }
      for (const id of applicable) downloadsController.retry(id);
      ctx.notify.success(
        ctx.t('downloads.bulk.retry.title', 'Retry selected'),
        ctx.t('downloads.bulk.retry.done', '{count} of {selected} selected downloads were retried.', {
          values: { count: String(applicable.length), selected: String(selected.length) }
        })
      );
    }
  });

  const pauseSelectedButton = ctx.components.button({
    label: 'downloads.action.pauseSelected',
    variant: 'text',
    icon: 'pause',
    onClick: () => {
      const selected = table.selection();
      const applicable = selected.filter((id) => {
        const record = downloadStore.byId(id);
        return record !== null && ACTIVE_STATES.includes(record.state);
      });
      if (applicable.length === 0) {
        ctx.notify.info(
          ctx.t('downloads.bulk.pause.title', 'Pause selected'),
          ctx.t('downloads.bulk.pause.none', 'None of the selected downloads are running, so nothing was paused.')
        );
        return;
      }
      for (const id of applicable) downloadsController.pause(id);
      ctx.notify.success(
        ctx.t('downloads.bulk.pause.title', 'Pause selected'),
        ctx.t('downloads.bulk.pause.done', '{count} of {selected} selected downloads were paused.', {
          values: { count: String(applicable.length), selected: String(selected.length) }
        })
      );
    }
  });

  const resumeSelectedButton = ctx.components.button({
    label: 'downloads.action.resumeSelected',
    variant: 'text',
    icon: 'play',
    onClick: () => {
      const selected = table.selection();
      const applicable = selected.filter((id) => {
        const record = downloadStore.byId(id);
        return record !== null && RESUMABLE_STATES.includes(record.state);
      });
      if (applicable.length === 0) {
        ctx.notify.info(
          ctx.t('downloads.bulk.resume.title', 'Resume selected'),
          ctx.t('downloads.bulk.resume.none', 'None of the selected downloads can be resumed right now, so nothing changed.')
        );
        return;
      }
      for (const id of applicable) downloadsController.resume(id);
      ctx.notify.success(
        ctx.t('downloads.bulk.resume.title', 'Resume selected'),
        ctx.t('downloads.bulk.resume.done', '{count} of {selected} selected downloads were resumed.', {
          values: { count: String(applicable.length), selected: String(selected.length) }
        })
      );
    }
  });

  const inverseButton = ctx.components.button({
    label: 'downloads.action.selectInverse',
    variant: 'text',
    onClick: () => {
      const currentlySelected = new Set(table.selection());
      const inverse = filtered.map((row) => row.id).filter((id) => !currentlySelected.has(id));
      table.setSelection(inverse);
      refreshSummary();
    }
  });

  const exportButton = ctx.components.button({
    label: 'downloads.action.exportSelected',
    variant: 'text',
    icon: 'save',
    onClick: (event) => {
      const selected = new Set(table.selection());
      const rows = filtered.filter((row) => selected.size === 0 || selected.has(row.id)).map((record) => toRow(record));
      if (rows.length === 0) {
        ctx.notify.info(
          ctx.t('downloads.export.title', 'Export downloads'),
          ctx.t('downloads.export.empty', 'Nothing is selected, so there is nothing to export.')
        );
        return;
      }
      ctx.components.menu({
        anchor: event.currentTarget as HTMLElement,
        label: ctx.t('downloads.export.title', 'Export downloads'),
        items: ctx.exporter.formats().map((format) => ({
          id: `downloads.export.${format}`,
          label: format.toUpperCase(),
          icon: 'save',
          run: async () => {
            const preflight = ctx.exporter.preflight(rows, format);
            if (preflight.losses.length > 0) {
              const proceed = await ctx.components.dialog({
                title: ctx.t('downloads.export.lossy.title', 'Some fields cannot be saved in this format'),
                body: preflight.losses.map((loss) => `${loss.field}: ${loss.reason}`).join('\n'),
                confirmLabel: ctx.t('downloads.export.lossy.confirm', 'Export anyway'),
                cancelLabel: ctx.t('downloads.export.lossy.cancel', 'Cancel')
              });
              if (!proceed) return;
            }
            const path = await ctx.exporter.save(rows, format, { name: 'downloads', defaultFileName: `downloads.${format}` });
            if (path) ctx.notify.success(ctx.t('downloads.export.done.title', 'Export complete'), path);
          }
        }))
      });
    }
  });

  const removeSelectedButton = ctx.components.button({
    label: 'downloads.action.removeSelected',
    variant: 'text',
    icon: 'trash',
    danger: true,
    onClick: (event) => {
      const selected = table.selection();
      if (selected.length === 0) return;
      void downloadsController.remove(selected, event.currentTarget as HTMLElement).then(() => {
        table.clearSelection();
        refreshSummary();
      });
    }
  });

  bulkActions.append(pauseSelectedButton, resumeSelectedButton, retrySelectedButton, exportButton, inverseButton, removeSelectedButton);
  bulk.append(summary, bulkActions);

  const search = ctx.createSearchBar({
    label: 'downloads.search',
    sample: allRecords.map((record) => searchableText(record)).join('\n'),
    onChange: (query) => {
      filtered = allRecords.filter((record) => query.matches(searchableText(record)));
      table.setRows(filtered);
      refreshSummary();
    }
  });
  searchWrap.append(search.root);
  toolbar.append(searchWrap, addButton);

  root.append(toolbar, bulk, tableWrap);

  refreshSummary();

  const unsubscribeStore = downloadStore.onChange((records) => {
    allRecords = records;
    const query = search.query();
    filtered = allRecords.filter((record) => query.matches(searchableText(record)));
    table.setRows(filtered);
    refreshSummary();
  });
  const unsubscribeBridge = downloadBridge.stateChanged.add((state) => receiverCard.refresh(state));
  receiverCard.refresh(downloadBridge.state());

  ctx.onDispose(() => {
    unsubscribeStore();
    unsubscribeBridge();
    search.destroy();
  });
}
