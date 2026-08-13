import { el } from '../../core/a11y';
import type { DataTableHandle, TabContext } from '../../core/registry';
import { KNOWN_CAPABILITIES } from './api';
import { VERDICT_ORDER } from './hardware';
import type { FitVerdict } from './hardware';
import { enrichBatch, enrichVariant, refreshCatalog } from './refresh';
import type { RefreshProgress, RefreshToken } from './refresh';
import type { Runtime } from './runtime';
import { boundedAffected, fitChip, fitLabel, openVariantDetails, selectionToolbar, setButtonDisabled } from './shared';
import type { CatalogVariant, QueueItem, QueueStatus } from './state';
import { formatAge, formatBytes, formatCount, formatTimestamp } from './util';

/** The "Model store" tab: the published catalog and the local pull queue. */
export function mountStorePanel(host: HTMLElement, ctx: TabContext, rt: Runtime): void {
  const { models, queue } = rt;
  host.className = 'models-panel';

  host.append(
    ctx.components.topAppBar({
      title: ctx.t('models.store.title', 'Model store'),
      subtitle: ctx.t(
        'models.store.subtitle',
        'Every published variant the catalog source lists, combined with everything installed locally. Neither set is hidden.'
      )
    })
  );

  const refreshBar = el('section', { className: 'models-section' });
  const inventorySection = el('section', { className: 'models-section', attrs: { id: 'models-store-inventory' } });
  const queueSection = el('section', { className: 'models-section', attrs: { id: 'models-queue' } });
  host.append(refreshBar, inventorySection, queueSection);

  const filters = {
    state: 'any' as 'any' | 'installed' | 'running' | 'catalog',
    family: 'any',
    capability: 'any',
    quantization: 'any',
    fit: 'any' as 'any' | FitVerdict,
    sort: 'name' as 'name' | 'size' | 'fit',
    group: false
  };
  let searchText = '';
  let query: (value: string) => boolean = () => true;
  const selection = new Set<string>();
  let table: DataTableHandle<CatalogVariant> | null = null;
  let filtered: CatalogVariant[] = [];

  let refreshing = false;
  let refreshToken: RefreshToken | null = null;
  let progress: RefreshProgress | null = null;

  let enriching = false;
  let enrichToken: RefreshToken | null = null;

  /* ================================================================ */
  /* Refresh bar                                                       */
  /* ================================================================ */

  function renderRefreshBar(): void {
    refreshBar.textContent = '';
    const head = el('div', { className: 'models-panel__toolbar' });
    const refreshButton = ctx.components.button({
      label: 'models.store.refresh',
      variant: 'tonal',
      icon: 'refresh',
      onClick: () => void doRefresh()
    });
    setButtonDisabled(refreshButton, refreshing, ctx.t('models.store.refresh', 'Refresh the catalog'));
    head.append(refreshButton);
    if (refreshing) {
      const cancel = ctx.components.button({
        label: 'models.store.cancelRefresh',
        variant: 'text',
        icon: 'stop',
        onClick: () => {
          if (refreshToken) refreshToken.cancelled = true;
        }
      });
      head.append(cancel);
    }
    refreshBar.append(head);

    if (refreshing && progress) {
      const bar = ctx.components.linearProgress({
        label: ctx.t('models.store.refresh', 'Refresh the catalog'),
        value: progress.total > 0 ? progress.completed / progress.total : undefined
      });
      refreshBar.append(bar.root, el('p', { className: 'md-typescale-body-small', text: progress.detail }));
      return;
    }

    const catalog = models.catalog;
    const meta = el('div', { className: 'models-evidence' });
    meta.append(
      el('div', {
        className: 'models-evidence__row',
        children: [
          el('span', { text: catalog.complete ? ctx.t('models.store.completeVerdict', 'Complete') : ctx.t('models.store.incompleteVerdict', 'Incomplete') }),
          el('span', { className: 'models-muted', text: ctx.t('models.store.refreshedAt', 'Last attempt {time}', { values: { time: formatTimestamp(catalog.refreshedAt) } }) })
        ]
      })
    );
    if (catalog.lastSuccessfulRefreshAt) {
      meta.append(
        el('div', {
          className: 'models-evidence__row',
          text: ctx.t('models.store.verifiedAt', 'Last verified refresh {time} ({age})', {
            values: { time: formatTimestamp(catalog.lastSuccessfulRefreshAt), age: formatAge(catalog.lastSuccessfulRefreshAt) }
          })
        })
      );
    }
    if (catalog.pageCount > 0) {
      meta.append(
        el('div', {
          className: 'models-evidence__row',
          text: ctx.t('models.store.pages', '{pages} pages followed across {repositories} repositories', {
            values: { pages: formatCount(catalog.pageCount), repositories: formatCount(catalog.repositoryCount) }
          })
        })
      );
    }
    if (catalog.sourceRevision) {
      meta.append(
        el('div', { className: 'models-evidence__row', text: ctx.t('models.store.revision', 'Source revision {revision}', { values: { revision: catalog.sourceRevision } }) })
      );
    }
    refreshBar.append(meta);
    refreshBar.append(el('p', { className: 'md-typescale-body-small', text: catalog.completenessNote }));

    if (models.isStale()) {
      refreshBar.append(
        el('p', {
          className: 'md-typescale-body-small models-muted',
          text: ctx.t('models.store.stale', 'This catalog is {age} old, past the {hours} hour staleness setting. Refresh to verify it again.', {
            values: { age: formatAge(catalog.lastSuccessfulRefreshAt), hours: Math.round(models.staleAfterMs() / 3_600_000) }
          })
        })
      );
    }
    if (models.health && !models.health.reachable && catalog.variants.length > 0) {
      refreshBar.append(el('p', { className: 'md-typescale-body-small models-muted', text: ctx.t('models.store.offline', 'The catalog source is not reachable, so this is the last verified catalog plus the current installed state. Nothing new was guessed at.') }));
    }
  }

  async function doRefresh(): Promise<void> {
    if (refreshing) return;
    refreshing = true;
    refreshToken = { cancelled: false };
    progress = { phase: 'repositories', detail: '', completed: 0, total: 0 };
    renderRefreshBar();
    await rt.ensureHostsAllowed();
    const outcome = await refreshCatalog(models, refreshToken, (p) => {
      progress = p;
      renderRefreshBar();
    });
    refreshing = false;
    refreshToken = null;
    renderRefreshBar();
    if (outcome.ok) {
      ctx.notify.success(
        ctx.t('models.store.refresh', 'Refresh the catalog'),
        ctx.t('models.notice.refreshed', '{variants} variants across {repositories} repositories, {pages} pages followed. {verdict}', {
          values: {
            variants: formatCount(outcome.variantCount),
            repositories: formatCount(outcome.repositoryCount),
            pages: formatCount(outcome.pageCount),
            verdict: outcome.complete ? ctx.t('models.store.completeVerdict', 'Complete') : ctx.t('models.store.incompleteVerdict', 'Incomplete')
          }
        })
      );
      await ctx.history.record('Refreshed the local model catalog', 'models', {
        variants: outcome.variantCount,
        repositories: outcome.repositoryCount,
        complete: outcome.complete
      });
    } else {
      ctx.notify.warn(ctx.t('models.store.refresh', 'Refresh the catalog'), ctx.t('models.notice.refreshFailed', 'The catalog refresh did not complete. {reason}', { values: { reason: outcome.error ?? outcome.note } }));
    }
  }

  /* ================================================================ */
  /* Inventory                                                          */
  /* ================================================================ */

  function uniqueValues(pick: (v: CatalogVariant) => string | null): string[] {
    const set = new Set<string>();
    for (const variant of models.catalog.variants) {
      const value = pick(variant);
      if (value) set.add(value);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }

  function renderInventory(): void {
    inventorySection.textContent = '';
    inventorySection.append(el('h2', { className: 'md-typescale-title-medium', text: ctx.t('models.store.title', 'Model store'), attrs: { id: 'models-store-inventory' } }));

    const all = models.catalog.variants;
    if (all.length === 0) {
      inventorySection.append(
        ctx.components.emptyState({
          title: ctx.t('models.store.empty.title', 'The inventory is empty'),
          body: ctx.t('models.store.empty.body', 'No refresh has produced entries in this profile yet, and nothing is installed. Refresh the catalog to build the inventory.'),
          action: { label: 'models.store.refresh', variant: 'tonal', onClick: () => void doRefresh() }
        })
      );
      return;
    }

    const search = ctx.createSearchBar({
      label: 'models.store.search',
      sample: all.map((v) => v.ref).join('\n'),
      initialText: searchText,
      onChange: (q) => {
        searchText = q.text;
        query = (value) => q.matches(value);
        applyFilter();
      }
    });
    ctx.onDispose(() => search.destroy());
    inventorySection.append(search.root);

    const filterRow = el('div', { className: 'models-filters' });
    const stateSelect = ctx.components.select({
      label: 'models.store.filter.state',
      value: filters.state,
      options: [
        { value: 'any', label: ctx.t('models.store.filter.any', 'Any') },
        { value: 'installed', label: ctx.t('models.state.installed', 'Installed') },
        { value: 'running', label: ctx.t('models.state.running', 'Loaded') },
        { value: 'catalog', label: ctx.t('models.state.catalog', 'Not installed') }
      ],
      onChange: (v) => {
        filters.state = v as typeof filters.state;
        applyFilter();
      }
    });
    const familySelect = ctx.components.select({
      label: 'models.store.filter.family',
      value: filters.family,
      options: [{ value: 'any', label: ctx.t('models.store.filter.any', 'Any') }, ...uniqueValues((v) => v.family).map((value) => ({ value, label: value }))],
      onChange: (v) => {
        filters.family = v;
        applyFilter();
      }
    });
    const capabilitySelect = ctx.components.select({
      label: 'models.store.filter.capability',
      value: filters.capability,
      options: [{ value: 'any', label: ctx.t('models.store.filter.any', 'Any') }, ...KNOWN_CAPABILITIES.map((value) => ({ value, label: value }))],
      onChange: (v) => {
        filters.capability = v;
        applyFilter();
      }
    });
    const quantizationSelect = ctx.components.select({
      label: 'models.store.filter.quantization',
      value: filters.quantization,
      options: [{ value: 'any', label: ctx.t('models.store.filter.any', 'Any') }, ...uniqueValues((v) => v.quantization).map((value) => ({ value, label: value }))],
      onChange: (v) => {
        filters.quantization = v;
        applyFilter();
      }
    });
    const fitSelect = ctx.components.select({
      label: 'models.store.filter.fit',
      value: filters.fit,
      options: [{ value: 'any', label: ctx.t('models.store.filter.any', 'Any') }, ...VERDICT_ORDER.map((value) => ({ value, label: fitLabel(ctx, value) }))],
      onChange: (v) => {
        filters.fit = v as typeof filters.fit;
        applyFilter();
      }
    });
    const sortSelect = ctx.components.select({
      label: 'models.store.sort',
      value: filters.sort,
      options: [
        { value: 'name', label: ctx.t('models.store.sort.name', 'Name') },
        { value: 'size', label: ctx.t('models.store.sort.size', 'Size') },
        { value: 'fit', label: ctx.t('models.store.sort.fit', 'Hardware fit') }
      ],
      onChange: (v) => {
        filters.sort = v as typeof filters.sort;
        applyFilter();
      }
    });
    filterRow.append(stateSelect.root, familySelect.root, capabilitySelect.root, quantizationSelect.root, fitSelect.root, sortSelect.root);
    inventorySection.append(filterRow);

    const groupSwitch = ctx.components.switchControl({
      label: 'models.store.group',
      checked: filters.group,
      onChange: (checked) => {
        filters.group = checked;
        applyFilter();
      }
    });
    inventorySection.append(groupSwitch.root, el('p', { className: 'md-typescale-body-small models-muted', text: ctx.t('models.store.groupHint', 'Sorts the inventory so variants from the same repository sit next to each other.') }));

    const toolbar = selectionToolbar({
      ctx,
      selection,
      shownIds: () => filtered.map((v) => v.ref),
      allIds: () => all.map((v) => v.ref),
      onChange: () => table?.setSelection([...selection])
    });
    inventorySection.append(toolbar.root);

    const actions = el('div', { className: 'models-panel__toolbar' });
    const addButton = ctx.components.button({ label: 'models.action.queue', variant: 'tonal', icon: 'download', onClick: () => doAddToQueue() });
    const enrichButton = ctx.components.button({ label: 'models.store.enrich', variant: 'text', icon: 'info', onClick: () => void doEnrich() });
    setButtonDisabled(enrichButton, enriching, ctx.t('models.store.enrich', 'Read manifests for the shown variants'));
    const exportButton = ctx.components.button({ label: 'models.action.export', variant: 'text', icon: 'download', onClick: () => void doExport() });
    actions.append(addButton, enrichButton, exportButton);
    inventorySection.append(actions);
    inventorySection.append(el('p', { className: 'md-typescale-body-small', text: ctx.t('models.queue.disclosure', 'Adding a variant schedules a local download and nothing else. There is no price, no purchase, no account and no payment anywhere in this application.') }));

    const scroll = el('div', { className: 'models-scroll' });
    inventorySection.append(scroll);

    table = ctx.components.dataTable<CatalogVariant>({
      label: 'models.store.title',
      rowId: (v) => v.ref,
      rows: [],
      selectable: true,
      emptyMessage: 'core.search.noMatches',
      onSelectionChange: (ids) => {
        selection.clear();
        for (const id of ids) selection.add(id);
        toolbar.refresh();
      },
      onActivate: (v) => openVariantDetails(ctx, models, v, () => enrichSingle(v.ref)),
      columns: [
        { id: 'ref', label: 'models.column.name', sortable: true, value: (v) => v.ref },
        { id: 'size', label: 'models.column.size', sortable: true, align: 'end', value: (v) => v.modelBytes ?? -1, render: (v) => formatBytes(v.modelBytes) },
        { id: 'download', label: 'models.column.download', sortable: true, align: 'end', value: (v) => v.downloadBytes ?? -1, render: (v) => formatBytes(v.downloadBytes) },
        { id: 'parameters', label: 'models.column.parameters', sortable: true, value: (v) => v.parameterSize ?? '' },
        { id: 'quantization', label: 'models.column.quantization', sortable: true, value: (v) => v.quantization ?? '' },
        { id: 'family', label: 'models.column.family', sortable: true, value: (v) => v.family ?? '' },
        { id: 'capabilities', label: 'models.column.capabilities', value: (v) => (v.capabilities.length > 0 ? v.capabilities.join(', ') : '—') },
        {
          id: 'state',
          label: 'models.column.state',
          sortable: true,
          value: (v) => (v.running ? 2 : v.installed ? 1 : 0),
          render: (v) => (v.running ? ctx.t('models.state.running', 'Loaded') : v.installed ? ctx.t('models.state.installed', 'Installed') : ctx.t('models.state.catalog', 'Not installed'))
        },
        { id: 'fit', label: 'models.column.fit', sortable: true, value: (v) => models.fitFor(v).verdict, render: (v) => fitChip(ctx, models.fitFor(v).verdict) }
      ]
    });
    const noMatch = el('p', { className: 'md-typescale-body-small models-muted', attrs: { hidden: 'hidden' } });
    inventorySection.insertBefore(noMatch, scroll);
    scroll.append(table.root);
    applyFilter();

    function applyFilter(): void {
      let rows = all.filter((v) => matchesFilters(v) && (query(v.ref) || query(v.family ?? '') || query(v.capabilities.join(' '))));
      rows = sortRows(rows);
      filtered = rows;
      table?.setRows(filtered);
      table?.setSelection([...selection].filter((id) => filtered.some((v) => v.ref === id)));
      toolbar.refresh();
      if (filtered.length === 0 && all.length > 0) {
        noMatch.textContent = ctx.t('models.store.noMatch', 'Nothing in the {total} inventory entries matches the current search and filters.', {
          values: { total: all.length }
        });
        noMatch.hidden = false;
      } else {
        noMatch.hidden = true;
      }
    }

    function matchesFilters(v: CatalogVariant): boolean {
      if (filters.state === 'installed' && !v.installed) return false;
      if (filters.state === 'running' && !v.running) return false;
      if (filters.state === 'catalog' && v.installed) return false;
      if (filters.family !== 'any' && (v.family ?? '') !== filters.family) return false;
      if (filters.capability !== 'any' && !v.capabilities.includes(filters.capability)) return false;
      if (filters.quantization !== 'any' && (v.quantization ?? '') !== filters.quantization) return false;
      if (filters.fit !== 'any' && models.fitFor(v).verdict !== filters.fit) return false;
      return true;
    }

    function sortRows(rows: CatalogVariant[]): CatalogVariant[] {
      const copy = [...rows];
      copy.sort((a, b) => {
        if (filters.group) {
          const byRepo = a.repository.localeCompare(b.repository);
          if (byRepo !== 0) return byRepo;
        }
        if (filters.sort === 'size') return (a.modelBytes ?? -1) - (b.modelBytes ?? -1);
        if (filters.sort === 'fit') return VERDICT_ORDER.indexOf(models.fitFor(a).verdict) - VERDICT_ORDER.indexOf(models.fitFor(b).verdict);
        return a.ref.localeCompare(b.ref);
      });
      return copy;
    }

    async function enrichSingle(ref: string): Promise<void> {
      const result = await enrichVariant(models, ref);
      if (!result.ok) ctx.notify.error(ctx.t('models.details.readManifest', 'Read this manifest'), result.error ?? '');
    }

    function doAddToQueue(): void {
      const refs = selection.size > 0 ? [...selection] : [];
      if (refs.length === 0) {
        ctx.notify.info(ctx.t('models.action.queue', 'Add to the pull queue'), ctx.t('models.notice.nothingSelected', 'Nothing is selected.'));
        return;
      }
      const result = queue.add(refs);
      void ctx.history.record(`Added ${result.added.length} models to the pull queue`, 'models', result);
      ctx.notify.success(
        ctx.t('models.action.queue', 'Add to the pull queue'),
        ctx.t('models.queue.added', '{added} added, {queued} were already waiting, {installed} were already installed.', {
          values: { added: result.added.length, queued: result.alreadyQueued.length, installed: result.alreadyInstalled.length }
        })
      );
    }

    async function doEnrich(): Promise<void> {
      if (enriching) return;
      const refs = filtered.map((v) => v.ref).slice(0, 300);
      if (refs.length === 0) return;
      enriching = true;
      enrichToken = { cancelled: false };
      renderInventory();
      const outcome = await enrichBatch(models, refs, enrichToken, () => undefined);
      enriching = false;
      enrichToken = null;
      ctx.notify.info(
        ctx.t('models.store.enrich', 'Read manifests for the shown variants'),
        ctx.t('models.notice.enriched', '{enriched} manifests read, {failed} refused.', { values: { enriched: outcome.enriched, failed: outcome.failed } })
      );
    }

    async function doExport(): Promise<void> {
      const rows = (selection.size > 0 ? all.filter((v) => selection.has(v.ref)) : filtered).map((v) => ({ ...v }));
      const format = models.exportFormat();
      const preflight = ctx.exporter.preflight(rows, format);
      if (preflight.losses.length > 0) {
        ctx.notify.warn(
          ctx.t('models.action.export', 'Export'),
          ctx.t('models.notice.exportLosses', '{count} field(s) cannot be carried by {format} and were named before writing.', { values: { count: preflight.losses.length, format } })
        );
      }
      const path = await ctx.exporter.save(rows, format, { name: 'model-catalog', defaultFileName: `model-catalog.${format}` });
      if (path) ctx.notify.success(ctx.t('models.action.export', 'Export'), ctx.t('models.notice.exported', 'Written to {path}.', { values: { path } }));
    }
  }

  /* ================================================================ */
  /* Pull queue                                                        */
  /* ================================================================ */

  const queueSelection = new Set<string>();
  let queueTable: DataTableHandle<QueueItem> | null = null;

  function statusLabel(status: QueueStatus): string {
    switch (status) {
      case 'queued':
        return ctx.t('models.queue.status.queued', 'Waiting');
      case 'running':
        return ctx.t('models.queue.status.running', 'Pulling');
      case 'done':
        return ctx.t('models.queue.status.done', 'Installed');
      case 'failed':
        return ctx.t('models.queue.status.failed', 'Failed');
      case 'cancelled':
        return ctx.t('models.queue.status.cancelled', 'Cancelled');
      default:
        return ctx.t('models.queue.status.skipped', 'Skipped');
    }
  }

  function renderQueue(): void {
    queueSection.textContent = '';
    queueSection.append(el('h2', { className: 'md-typescale-title-medium', text: ctx.t('models.queue.title', 'Pull queue') }));
    queueSection.append(el('p', { className: 'md-typescale-body-small', text: ctx.t('models.queue.mechanism', 'A pull runs as a series of bounded attempts, because the privileged network boundary caps one request at two minutes and hands the body back complete rather than as it arrives. The runtime keeps the layers it already fetched and resumes from them, and after every attempt the queue asks the runtime’s own installed list whether the model is there — which is the only thing that proves it landed.') }));
    queueSection.append(el('p', { className: 'md-typescale-body-small models-muted', text: ctx.t('models.queue.network', 'Each pull is a direct transfer from the configured catalog source to the model runtime on this machine.') }));

    const summary = queue.summary();
    queueSection.append(
      el('p', {
        className: 'md-typescale-body-medium',
        text: ctx.t('models.queue.summary', '{queued} waiting, {running} running, {done} done, {failed} failed, {cancelled} cancelled.', {
          values: { queued: summary.queued, running: summary.running, done: summary.done, failed: summary.failed, cancelled: summary.cancelled }
        })
      })
    );
    if (summary.outstandingBytes !== null) {
      queueSection.append(
        el('p', { className: 'md-typescale-body-small', text: ctx.t('models.queue.estimate', 'The outstanding items transfer {bytes} according to the catalog.', { values: { bytes: formatBytes(summary.outstandingBytes) } }) })
      );
    }
    if (summary.outstandingUnknown) {
      queueSection.append(el('p', { className: 'md-typescale-body-small models-muted', text: ctx.t('models.queue.estimateUnknown', 'At least one outstanding item has no published size, so the total below is a floor rather than a total.') }));
    }
    if (models.hardware.measuredFreeDisk !== null) {
      queueSection.append(
        el('p', {
          className: 'md-typescale-body-small',
          text: ctx.t('models.queue.disk', 'Measured free space at {path}: {free}', { values: { path: models.hardware.measuredDiskPath ?? '', free: formatBytes(models.hardware.measuredFreeDisk) } })
        })
      );
    } else {
      queueSection.append(el('p', { className: 'md-typescale-body-small models-muted', text: ctx.t('models.queue.diskUnknown', 'Free disk space has not been measured, so nothing checked whether this fits.') }));
    }

    const controls = el('div', { className: 'models-panel__toolbar' });
    const startButton = ctx.components.button({ label: 'models.queue.start', variant: 'filled', icon: 'play', onClick: () => { queue.start(); renderQueue(); } });
    const stopButton = ctx.components.button({ label: 'models.queue.stop', variant: 'outlined', icon: 'stop', onClick: () => { queue.stop(); renderQueue(); } });
    setButtonDisabled(startButton, queue.isRunning(), ctx.t('models.queue.start', 'Start the queue'));
    setButtonDisabled(stopButton, !queue.isRunning(), ctx.t('models.queue.stop', 'Stop after the current attempt'));
    controls.append(startButton, stopButton);
    queueSection.append(controls);

    if (models.queue.length === 0) {
      queueSection.append(
        ctx.components.emptyState({
          title: ctx.t('models.queue.empty.title', 'The queue is empty'),
          body: ctx.t('models.queue.empty.body', 'Choose variants in the inventory above and add them to the queue.')
        })
      );
      return;
    }

    const toolbar = selectionToolbar({
      ctx,
      selection: queueSelection,
      shownIds: () => models.queue.map((item) => item.id),
      allIds: () => models.queue.map((item) => item.id),
      onChange: () => queueTable?.setSelection([...queueSelection])
    });
    queueSection.append(toolbar.root);

    const actions = el('div', { className: 'models-panel__toolbar' });
    const cancelButton = ctx.components.button({ label: 'models.action.cancel', variant: 'text', icon: 'stop', onClick: () => doQueueCancel() });
    const retryButton = ctx.components.button({ label: 'models.action.retry', variant: 'text', icon: 'refresh', onClick: () => doQueueRetry() });
    const removeButton = ctx.components.button({ label: 'models.action.remove', variant: 'text', icon: 'trash', danger: true, onClick: (event) => void doQueueRemove(event.currentTarget as HTMLElement) });
    actions.append(cancelButton, retryButton, removeButton);
    queueSection.append(actions);

    const scroll = el('div', { className: 'models-scroll' });
    queueSection.append(scroll);
    queueTable = ctx.components.dataTable<QueueItem>({
      label: 'models.queue.title',
      rowId: (item) => item.id,
      rows: [...models.queue],
      selectable: true,
      onSelectionChange: (ids) => {
        queueSelection.clear();
        for (const id of ids) queueSelection.add(id);
        toolbar.refresh();
      },
      columns: [
        { id: 'ref', label: 'models.column.name', sortable: true, value: (item) => item.ref },
        { id: 'status', label: 'models.column.state', sortable: true, value: (item) => item.status, render: (item) => statusLabel(item.status) },
        { id: 'attempts', label: 'models.queue.attempts', value: (item) => item.attempts, render: (item) => ctx.t('models.queue.attempts', '{attempts} of {max} attempts used', { values: { attempts: item.attempts, max: item.maxAttempts } }) },
        {
          id: 'bytes',
          label: 'models.column.download',
          align: 'end',
          value: (item) => item.completedBytes ?? -1,
          render: (item) => `${formatBytes(item.completedBytes)} / ${formatBytes(item.totalBytes ?? item.expectedBytes)}`
        },
        { id: 'status-line', label: 'models.column.state', value: (item) => item.lastStatusLine || (item.error ?? '') }
      ]
    });
    scroll.append(queueTable.root);
    queueTable.setSelection([...queueSelection]);

    function doQueueCancel(): void {
      const ids = [...queueSelection];
      if (ids.length === 0) {
        ctx.notify.info(ctx.t('models.action.cancel', 'Cancel'), ctx.t('models.notice.nothingSelected', 'Nothing is selected.'));
        return;
      }
      const changed = queue.cancel(ids);
      ctx.notify.info(ctx.t('models.action.cancel', 'Cancel'), ctx.t('models.confirm.cancelledCount', '{count} item(s) were cancelled.', { values: { count: changed } }));
    }

    function doQueueRetry(): void {
      const ids = [...queueSelection];
      if (ids.length === 0) {
        ctx.notify.info(ctx.t('models.action.retry', 'Retry'), ctx.t('models.notice.nothingSelected', 'Nothing is selected.'));
        return;
      }
      const changed = queue.retry(ids);
      ctx.notify.info(ctx.t('models.action.retry', 'Retry'), ctx.t('models.confirm.retriedCount', '{count} item(s) were returned to the queue.', { values: { count: changed } }));
      if (changed > 0 && !queue.isRunning()) queue.start();
    }

    async function doQueueRemove(anchor: HTMLElement): Promise<void> {
      const ids = [...queueSelection];
      if (ids.length === 0) {
        ctx.notify.info(ctx.t('models.action.remove', 'Remove from the list'), ctx.t('models.notice.nothingSelected', 'Nothing is selected.'));
        return;
      }
      const affected = models.queue.filter((item) => ids.includes(item.id)).map((item) => `${item.ref} (${statusLabel(item.status)})`);
      const running = models.queue.some((item) => ids.includes(item.id) && item.status === 'running');
      const approved = await ctx.confirm.request({
        action: ctx.t('models.confirm.removeQueueAction', 'Remove {count} pull queue item(s)', { values: { count: ids.length } }),
        affected: boundedAffected(affected),
        irreversible: running
          ? ctx.t('models.confirm.removeQueueRunning', 'A running item is stopped immediately and its record is deleted. Any layers already fetched stay on disk, but the queue no longer tracks or resumes them.')
          : ctx.t('models.confirm.removeQueue', 'The record is deleted from the queue. Any layers already fetched stay on disk; add the model again to resume from them.'),
        anchor
      });
      if (!approved) return;
      queue.remove(ids);
      queueSelection.clear();
      await ctx.history.record(`Removed ${ids.length} items from the pull queue`, 'models', { ids });
    }
  }

  renderRefreshBar();
  renderInventory();
  renderQueue();

  const unsubscribe = models.on((event) => {
    if (event === 'catalog' || event === 'installed') {
      renderRefreshBar();
      renderInventory();
    }
    if (event === 'hardware') table?.setRows(filtered);
    if (event === 'queue') renderQueue();
  });
  ctx.onDispose(unsubscribe);
}
