/**
 * The Convert tab: the visible half of inventory row 11.4, and the general
 * single-file conversion surface for every enabled route in the catalog that
 * is not one of the PDF multi-file tools (those live on the PDF tools tab).
 */

import { ADAPTERS, adapterById, availabilityOf, routeLabel, type AdapterSpec } from './adapters';
import { discoverFiles } from './discovery';
import { DEFAULTS, DESTINATION_ID } from './limits';
import { queueEngine, summarize, type QueueItem, type QueueStatus } from './queue';
import { defaultAdapterOptions, renderAdapterOption } from './runtime';
import { el } from '../../core/a11y';
import type { AppContext, SearchQuery, TabContext } from '../../core/registry';

function statusText(ctx: AppContext, status: QueueStatus): string {
  return ctx.t(`converter.convert.status.${status}`, status);
}

function itemSearchText(ctx: AppContext, item: QueueItem): string {
  const adapter = adapterById(item.adapterId);
  return [
    item.sourceName,
    item.sourcePath,
    item.detectedFormatId ?? '',
    adapter ? routeLabel(adapter, (k, f) => ctx.t(k, f)) : item.adapterId,
    statusText(ctx, item.status),
    item.outputPath ?? '',
    item.error ?? '',
    item.notes.join(' ')
  ].join(' ');
}

/** Every route this tab offers: bundled, currently enabled, and runnable on one file at a time. */
function singleFileAdapters(): AdapterSpec[] {
  return ADAPTERS.filter((adapter) => Boolean(adapter.run) && availabilityOf(adapter).available);
}

export function mountConvertTab(host: HTMLElement, ctx: TabContext): void {
  const engine = queueEngine(ctx);
  const routes = singleFileAdapters();

  let selectedAdapterId = routes[0]?.id ?? '';
  let optionValues: Record<string, string> = selectedAdapterId ? defaultAdapterOptions(routes.find((a) => a.id === selectedAdapterId)!) : {};
  let pickedFiles: string[] = [];
  let query: SearchQuery | null = null;
  let scheduled = false;

  const scheduleRender = (): void => {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(() => {
      scheduled = false;
      render();
    });
  };

  ctx.onDispose(engine.subscribe(scheduleRender));

  /* ---------------- chrome ---------------- */

  const addFilesButton = ctx.components.button({
    label: 'converter.convert.addFiles',
    variant: 'tonal',
    icon: 'upload',
    onClick: async () => {
      const result = await ctx.studio.dialog.openFile({ multiSelections: true });
      if (!result.ok || !result.value || result.value.length === 0) return;
      queueSelected(result.value);
    }
  });

  const addFolderButton = ctx.components.button({
    label: 'converter.convert.addFolder',
    variant: 'text',
    icon: 'folder',
    onClick: async () => {
      const result = await ctx.studio.dialog.openFolder({ multiSelections: true });
      if (!result.ok || !result.value || result.value.length === 0) return;
      const banner = ctx.notify.info(
        'converter.convert.discovering',
        ctx.t('converter.convert.discovering', 'Scanning {count} folder(s) for files…', { values: { count: result.value.length } })
      );
      let total = 0;
      const cancelled = { flag: false };
      const discovery = await discoverFiles(
        ctx,
        result.value,
        (batch) => {
          total += batch.length;
          queueSelected(batch);
        },
        () => cancelled.flag
      );
      ctx.notify.dismiss(banner.id);
      ctx.notify.success(
        'converter.notify.discoveryDone',
        ctx.t('converter.notify.discoveryDone', 'Folder scan finished: {count} file(s) found.', { values: { count: discovery.files.length } })
      );
    }
  });

  host.append(
    ctx.components.topAppBar({
      title: 'converter.tab.convert',
      subtitle: 'converter.convert.subtitle',
      actions: [addFilesButton, addFolderButton]
    })
  );

  /* ---------------- route + option picker ---------------- */

  const routePanel = el('div', { className: 'converter-route-panel' });
  host.append(routePanel);

  function currentAdapter(): AdapterSpec | null {
    return routes.find((a) => a.id === selectedAdapterId) ?? null;
  }

  function drawRoutePanel(): void {
    routePanel.textContent = '';
    if (routes.length === 0) {
      routePanel.append(
        ctx.components.emptyState({
          title: 'converter.catalog.disabled',
          body: 'converter.reason.notBundled'
        })
      );
      return;
    }

    const routeSelect = ctx.components.select({
      label: 'converter.convert.targetAdapter',
      value: selectedAdapterId,
      options: routes.map((adapter) => ({ value: adapter.id, label: routeLabel(adapter, (k, f) => ctx.t(k, f)) })),
      onChange: (value) => {
        selectedAdapterId = value;
        const adapter = currentAdapter();
        optionValues = adapter ? defaultAdapterOptions(adapter) : {};
        drawRoutePanel();
      }
    });
    const description = el('p', { className: 'converter-route-panel__description md-typescale-body-small', text: ctx.t('converter.convert.targetAdapter.description', '') });
    routePanel.append(routeSelect.root, description);

    const adapter = currentAdapter();
    if (adapter && adapter.options && adapter.options.length > 0) {
      const optionsHost = el('div', { className: 'converter-route-panel__options' });
      for (const option of adapter.options) renderAdapterOption(optionsHost, ctx, option, optionValues, () => {});
      routePanel.append(optionsHost);
    }

    if (adapter && adapter.disclosureKeys.length > 0 && adapter.disclosureKeys[0] !== 'converter.loss.none') {
      const disclosure = el('div', { className: 'converter-disclosure', attrs: { role: 'note' } });
      disclosure.append(el('p', { className: 'converter-disclosure__title md-typescale-label-large', text: ctx.t('converter.convert.disclosure.title', 'Before this route runs') }));
      const list = el('ul', { className: 'converter-disclosure__list' });
      for (const key of adapter.disclosureKeys) list.append(el('li', { text: ctx.t(key, key) }));
      disclosure.append(list, el('p', { className: 'converter-disclosure__meta md-typescale-body-small', text: ctx.t(adapter.metadataKey, adapter.metadataKey) }));
      routePanel.append(disclosure);
    }
  }

  drawRoutePanel();

  /* ---------------- destination + overwrite (reads the settings this feature registers) ---------------- */

  const destinationField = ctx.components.textField({
    label: 'converter.queue.destination',
    value: String(ctx.settings.get(DESTINATION_ID, DEFAULTS.destination)),
    browse: 'folder',
    supportingText: ctx.t('converter.queue.destination.description', ''),
    onCommit: (value) => ctx.settings.set(DESTINATION_ID, value)
  });
  host.append(destinationField.root);

  function queueSelected(paths: string[]): void {
    if (!selectedAdapterId) return;
    const added = engine.addFiles(paths, selectedAdapterId, optionValues);
    if (added > 0) {
      ctx.notify.success('converter.notify.queued', ctx.t('converter.notify.queued', '{count} file(s) added to the queue.', { values: { count: added } }));
    }
  }

  /* ---------------- controls ---------------- */

  const controls = el('div', { className: 'converter-queue-controls' });
  const startButton = ctx.components.button({ label: 'converter.convert.start', variant: 'filled', icon: 'play', onClick: () => engine.start() });
  const pauseButton = ctx.components.button({ label: 'converter.convert.pause', variant: 'outlined', icon: 'pause', onClick: () => engine.setPaused(true) });
  const resumeButton = ctx.components.button({ label: 'converter.convert.resume', variant: 'outlined', icon: 'play', onClick: () => engine.setPaused(false) });
  const cancelAllButton = ctx.components.button({
    label: 'converter.convert.cancelAll',
    variant: 'text',
    danger: true,
    icon: 'stop',
    onClick: async (event) => {
      const pendingCount = engine.list().filter((i) => i.status === 'pending').length;
      if (pendingCount === 0) return;
      const approved = await ctx.confirm.request({
        action: ctx.t('converter.confirm.cancelAll.action', 'Cancel {count} pending queue item(s)', { values: { count: pendingCount } }),
        affected: engine.list().filter((i) => i.status === 'pending').map((i) => i.sourceName),
        irreversible: ctx.t('converter.confirm.cancelAll.irreversible', 'Pending items are marked cancelled and skipped. Nothing that already finished is touched.'),
        anchor: event.currentTarget as HTMLElement
      });
      if (!approved) return;
      engine.cancelPending();
    }
  });
  const clearFinishedButton = ctx.components.button({
    label: 'converter.convert.clearFinished',
    variant: 'text',
    icon: 'trash',
    onClick: async (event) => {
      const finished = engine.list().filter((i) => i.status === 'done' || i.status === 'skipped' || i.status === 'cancelled' || i.status === 'failed');
      if (finished.length === 0) return;
      const approved = await ctx.confirm.request({
        action: ctx.t('converter.confirm.clearFinished.action', 'Clear {count} finished queue item(s)', { values: { count: finished.length } }),
        affected: finished.map((i) => i.sourceName),
        irreversible: ctx.t('converter.confirm.clearFinished.irreversible', 'Their rows are removed from the queue list. The files already written to disk are not touched.'),
        anchor: event.currentTarget as HTMLElement
      });
      if (!approved) return;
      engine.clearFinished();
    }
  });
  controls.append(startButton, pauseButton, resumeButton, cancelAllButton, clearFinishedButton);
  host.append(controls);

  const progressWrap = el('div', { className: 'converter-queue-progress' });
  host.append(progressWrap);

  /* ---------------- search + table ---------------- */

  const searchWrap = el('div', { className: 'converter-queue-search' });
  host.append(searchWrap);

  const bulkBar = el('div', { className: 'converter-queue-bulk' });
  const retrySelectedButton = ctx.components.button({ label: 'converter.convert.retry', variant: 'text', onClick: () => engine.retry(table.selection()) });
  const removeSelectedButton = ctx.components.button({ label: 'converter.convert.remove', variant: 'text', onClick: () => engine.removeItems(table.selection()) });
  const invertButton = ctx.components.button({
    label: 'converter.convert.invertSelection',
    variant: 'text',
    onClick: () => {
      const visible = new Set(table.selection());
      const all = currentRows().map((r) => r.id);
      table.setSelection(all.filter((id) => !visible.has(id)));
    }
  });
  bulkBar.append(retrySelectedButton, removeSelectedButton, invertButton);
  host.append(bulkBar);

  let allRows: QueueItem[] = engine.list();

  function currentRows(): QueueItem[] {
    return query ? allRows.filter((item) => query!.matches(itemSearchText(ctx, item))) : allRows;
  }

  const table = ctx.components.dataTable<QueueItem>({
    label: 'converter.tab.convert',
    rowId: (item) => item.id,
    rows: currentRows(),
    selectable: true,
    emptyMessage: 'converter.convert.empty',
    columns: [
      { id: 'source', label: 'converter.convert.column.source', value: (i) => i.sourceName },
      { id: 'detected', label: 'converter.convert.column.detected', value: (i) => i.detectedFormatId ?? '?' },
      {
        id: 'route',
        label: 'converter.convert.column.route',
        value: (i) => {
          const adapter = adapterById(i.adapterId);
          return adapter ? routeLabel(adapter, (k, f) => ctx.t(k, f)) : i.adapterId;
        }
      },
      {
        id: 'status',
        label: 'converter.convert.column.status',
        render: (item) => {
          const severity = item.status === 'done' ? 'success' : item.status === 'failed' ? 'error' : item.status === 'running' ? 'progress' : 'info';
          return ctx.components.badge({ label: statusText(ctx, item.status), severity });
        }
      },
      { id: 'output', label: 'converter.convert.column.output', value: (i) => i.outputPath ?? '' },
      { id: 'notes', label: 'converter.convert.column.notes', value: (i) => i.error ?? i.notes[0] ?? '' }
    ]
  });

  const search = ctx.createSearchBar({
    label: 'converter.convert.column.source',
    sample: allRows.map((item) => itemSearchText(ctx, item)).join('\n'),
    onChange: (nextQuery) => {
      query = nextQuery;
      table.setRows(currentRows());
    }
  });
  ctx.onDispose(() => search.destroy());
  searchWrap.append(search.root);
  host.append(table.root);

  /* ---------------- live updates ---------------- */

  function render(): void {
    allRows = engine.list();
    table.setRows(currentRows());

    const summary = summarize(allRows);
    const total = allRows.length;
    const finished = summary.done + summary.skipped + summary.cancelled + summary.failed;

    progressWrap.textContent = '';
    const progress = ctx.components.linearProgress({
      value: total > 0 ? finished / total : 0,
      label: ctx.t('converter.convert.column.status', 'Status')
    });
    progressWrap.append(progress.root);
    progressWrap.append(
      el('p', {
        className: 'converter-queue-progress__text md-typescale-body-small',
        text: `${summary.done} / ${total} · ${summary.running} ${statusText(ctx, 'running')} · ${summary.failed} ${statusText(ctx, 'failed')}`
      })
    );

    const paused = engine.isPaused();
    startButton.hidden = paused === false && engine.isBusy();
    pauseButton.hidden = paused || !engine.isBusy();
    resumeButton.hidden = !paused;

    const pendingCount = summary.pending;
    cancelAllButton.disabled = pendingCount === 0;
    cancelAllButton.title = pendingCount === 0 ? ctx.t('converter.convert.cancelAll.disabledReason', 'Nothing pending to cancel.') : '';

    clearFinishedButton.disabled = finished === 0;
    clearFinishedButton.title = finished === 0 ? ctx.t('converter.convert.clearFinished.disabledReason', 'Nothing finished to clear yet.') : '';

    const selectionCount = table.selection().length;
    retrySelectedButton.disabled = selectionCount === 0;
    retrySelectedButton.title = selectionCount === 0 ? ctx.t('converter.convert.selection.none', 'Select at least one row first.') : '';
    removeSelectedButton.disabled = selectionCount === 0;
    removeSelectedButton.title = retrySelectedButton.title;
  }

  render();
}
