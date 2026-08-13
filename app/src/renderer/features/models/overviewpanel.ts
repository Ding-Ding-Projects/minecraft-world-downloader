import { el } from '../../core/a11y';
import type { DataTableHandle, TabContext } from '../../core/registry';
import { copyModel, deleteModel } from './api';
import { evidenceList, fitChip, openVariantDetails, selectionToolbar, setButtonDisabled } from './shared';
import { PROBE_ENABLED_ID, PROBE_PATH_ID } from './state';
import type { CatalogVariant } from './state';
import { applyProbe, evidenceLines, probeCommandPreview, runProbe } from './hardware';
import type { Runtime } from './runtime';
import { formatBytes, formatTimestamp } from './util';

/**
 * The "Local models" tab: runtime health, the installed inventory, and the
 * hardware evidence every fit verdict is computed from.
 */
export function mountOverviewPanel(host: HTMLElement, ctx: TabContext, rt: Runtime): void {
  const { models } = rt;
  host.className = 'models-panel';

  host.append(
    ctx.components.topAppBar({
      title: ctx.t('models.overview.title', 'Local model runtime'),
      subtitle: ctx.t(
        'models.overview.subtitle',
        'Health, installed models and the hardware evidence every fit verdict is computed from.'
      )
    })
  );

  const healthSection = el('section', { className: 'models-section', attrs: { id: 'models-health' } });
  const installedSection = el('section', { className: 'models-section', attrs: { id: 'models-installed' } });
  const hardwareSection = el('section', { className: 'models-section', attrs: { id: 'models-hardware' } });
  host.append(healthSection, installedSection, hardwareSection);

  const selection = new Set<string>();
  let checking = false;
  let table: DataTableHandle<CatalogVariant> | null = null;
  let filtered: CatalogVariant[] = [];

  /* ================================================================ */
  /* Health                                                            */
  /* ================================================================ */

  function renderHealth(): void {
    healthSection.textContent = '';
    healthSection.append(el('h2', { className: 'md-typescale-title-medium', text: ctx.t('models.health.title', 'Runtime health') }));

    const checkButton = ctx.components.button({
      label: 'models.health.check',
      variant: 'tonal',
      icon: 'refresh',
      onClick: () => void doCheck()
    });
    setButtonDisabled(checkButton, checking, ctx.t('models.health.check', 'Check the runtime'));
    healthSection.append(checkButton);

    const health = models.health;
    if (!health) {
      healthSection.append(el('p', { className: 'md-typescale-body-medium models-muted', text: ctx.t('models.health.never', 'The runtime has not been checked yet in this session.') }));
      return;
    }

    if (health.reachable) {
      healthSection.append(
        el('p', {
          className: 'md-typescale-body-medium',
          text: ctx.t('models.health.reachable', 'The runtime answered at {address}. Version {version}, {latency} round trip.', {
            values: { address: health.baseUrl, version: health.version ?? 'unreported', latency: `${health.latencyMs ?? '—'} ms` }
          })
        })
      );
      return;
    }

    healthSection.classList.add('models-section--bad');
    healthSection.append(
      el('p', {
        className: 'md-typescale-body-medium',
        text: ctx.t('models.health.unreachable', 'The runtime at {address} did not answer. {reason}', {
          values: { address: health.baseUrl, reason: health.error ?? '' }
        })
      })
    );

    const troubleshoot = el('div', { className: 'models-gaps' });
    troubleshoot.append(el('h3', { className: 'md-typescale-title-small', text: ctx.t('models.troubleshoot.title', 'What to do about it') }));
    const platform = ctx.studio.info.platform;
    if (health.code && health.code.startsWith('http-')) {
      troubleshoot.append(
        el('p', {
          className: 'md-typescale-body-small',
          text: ctx.t('models.troubleshoot.refused', 'Something answered at {address} but refused the request: {reason} Check that the address points at the model runtime and not at another service on the same port.', {
            values: { address: health.baseUrl, reason: health.error ?? '' }
          })
        })
      );
    } else {
      troubleshoot.append(
        el('p', {
          className: 'md-typescale-body-small',
          text: ctx.t('models.troubleshoot.notInstalled', 'Nothing is listening on {address}. Install the model runtime from its own official installer for {platform}, then run the check again. This application never downloads or installs it for you, and never runs an installer you did not start.', {
            values: { address: health.baseUrl, platform }
          })
        }),
        el('p', {
          className: 'md-typescale-body-small',
          text: ctx.t('models.troubleshoot.stopped', 'The address is valid but the service is not running. Start it the way you normally start it on {platform}, then run the check again.', {
            values: { platform }
          })
        })
      );
    }
    troubleshoot.append(el('p', { className: 'md-typescale-body-small models-muted', text: ctx.t('models.troubleshoot.offlineNote', 'Everything below still works without the runtime: the last verified catalog, saved chats, harness profiles, snapshots and this guide are all local.') }));

    const actions = el('div', { className: 'models-panel__toolbar' });
    actions.append(
      ctx.components.button({ label: 'models.troubleshoot.retry', variant: 'text', icon: 'refresh', onClick: () => void doCheck() }),
      ctx.components.button({
        label: 'models.troubleshoot.openDocs',
        variant: 'text',
        icon: 'book',
        onClick: () => ctx.docsService.open('models.docs.overview')
      })
    );
    troubleshoot.append(actions);
    healthSection.append(troubleshoot);
  }

  async function doCheck(): Promise<void> {
    if (checking) return;
    checking = true;
    renderHealth();
    await rt.ensureHostsAllowed();
    await models.refreshRuntime();
    checking = false;
    renderHealth();
  }

  /* ================================================================ */
  /* Installed models                                                  */
  /* ================================================================ */

  function installedVariants(): CatalogVariant[] {
    return models.catalog.variants.filter((variant) => variant.installed);
  }

  function renderInstalled(): void {
    // Rebuilt fully on every relevant event — the installed set changes rarely
    // enough that a full rebuild here never becomes a performance problem.
    installedSection.textContent = '';
    installedSection.append(el('h2', { className: 'md-typescale-title-medium', text: ctx.t('models.installed.title', 'Installed models') }));

    const all = installedVariants();
    if (all.length === 0 && models.health?.reachable) {
      installedSection.append(
        ctx.components.emptyState({
          title: ctx.t('models.installed.empty.title', 'Nothing is installed yet'),
          body: ctx.t(
            'models.installed.empty.body',
            'The runtime answered and holds no models. Open the Model store to browse the catalog and queue one.'
          ),
          action: {
            label: ctx.t('models.tab.store', 'Model store'),
            variant: 'text',
            onClick: () => ctx.tabs.teleport('models.store', 'models-store-inventory')
          }
        })
      );
      return;
    }
    if (all.length === 0) {
      installedSection.append(el('p', { className: 'md-typescale-body-medium models-muted', text: ctx.t('models.installed.empty.title', 'Nothing is installed yet') }));
      return;
    }

    if (models.health && !models.health.reachable && models.installedReadAt) {
      installedSection.append(
        el('p', {
          className: 'md-typescale-body-small models-muted',
          text: ctx.t('models.installed.stale', 'This list was read at {time} and the runtime is not answering now, so it may be out of date.', {
            values: { time: formatTimestamp(models.installedReadAt) }
          })
        })
      );
    }

    let query: (value: string) => boolean = () => true;
    const search = ctx.createSearchBar({
      label: 'models.installed.search',
      sample: all.map((v) => v.ref).join('\n'),
      onChange: (q) => {
        query = (value) => q.matches(value);
        applyFilter();
      }
    });
    ctx.onDispose(() => search.destroy());
    installedSection.append(search.root);

    const toolbar = selectionToolbar({
      ctx,
      selection,
      shownIds: () => filtered.map((v) => v.ref),
      allIds: () => all.map((v) => v.ref),
      onChange: () => table?.setSelection([...selection])
    });
    installedSection.append(toolbar.root);

    const actions = el('div', { className: 'models-panel__toolbar' });
    const deleteButton = ctx.components.button({ label: 'models.action.delete', variant: 'outlined', icon: 'trash', danger: true, onClick: (event) => void doDelete(event.currentTarget as HTMLElement) });
    const copyButton = ctx.components.button({ label: 'models.action.copy', variant: 'text', icon: 'copy', onClick: (event) => void doCopy(event.currentTarget as HTMLElement) });
    const exportButton = ctx.components.button({ label: 'models.action.export', variant: 'text', icon: 'download', onClick: () => void doExport() });
    const detailsButton = ctx.components.button({ label: 'models.action.details', variant: 'text', icon: 'info', onClick: () => void doDetails() });
    actions.append(deleteButton, copyButton, exportButton, detailsButton);
    installedSection.append(actions);

    const scroll = el('div', { className: 'models-scroll' });
    installedSection.append(scroll);

    table = ctx.components.dataTable<CatalogVariant>({
      label: 'models.installed.title',
      rowId: (v) => v.ref,
      rows: [],
      selectable: true,
      emptyMessage: 'core.search.noMatches',
      onSelectionChange: (ids) => {
        selection.clear();
        for (const id of ids) selection.add(id);
        toolbar.refresh();
      },
      onActivate: (v) => openVariantDetails(ctx, models, v),
      columns: [
        { id: 'name', label: 'models.column.name', sortable: true, value: (v) => v.repository },
        { id: 'tag', label: 'models.column.tag', sortable: true, value: (v) => v.tag },
        { id: 'size', label: 'models.column.size', sortable: true, align: 'end', value: (v) => v.installedBytes ?? v.modelBytes ?? -1, render: (v) => formatBytes(v.installedBytes ?? v.modelBytes) },
        { id: 'parameters', label: 'models.column.parameters', sortable: true, value: (v) => v.parameterSize ?? '' },
        { id: 'quantization', label: 'models.column.quantization', sortable: true, value: (v) => v.quantization ?? '' },
        { id: 'family', label: 'models.column.family', sortable: true, value: (v) => v.family ?? '' },
        { id: 'context', label: 'models.column.context', sortable: true, align: 'end', value: (v) => v.contextLength ?? -1, render: (v) => (v.contextLength ? v.contextLength.toLocaleString() : '—') },
        { id: 'capabilities', label: 'models.column.capabilities', value: (v) => (v.capabilities.length > 0 ? v.capabilities.join(', ') : '—') },
        { id: 'state', label: 'models.column.state', sortable: true, value: (v) => (v.running ? ctx.t('models.state.running', 'Loaded') : ctx.t('models.state.installed', 'Installed')) },
        { id: 'fit', label: 'models.column.fit', sortable: true, value: (v) => models.fitFor(v).verdict, render: (v) => fitChip(ctx, models.fitFor(v).verdict) },
        { id: 'modified', label: 'models.column.modified', sortable: true, value: (v) => v.modifiedAt ?? '', render: (v) => formatTimestamp(v.modifiedAt) }
      ]
    });
    scroll.append(table.root);
    applyFilter();

    function applyFilter(): void {
      filtered = all.filter((v) => query(v.ref) || query(v.family ?? '') || query((v.capabilities ?? []).join(' ')));
      table?.setRows(filtered);
      table?.setSelection([...selection].filter((id) => filtered.some((v) => v.ref === id)));
      toolbar.refresh();
    }

    async function doDelete(anchor: HTMLElement): Promise<void> {
      const refs = [...selection].filter((id) => all.some((v) => v.ref === id));
      if (refs.length === 0) {
        ctx.notify.info(ctx.t('models.action.delete', 'Delete'), ctx.t('models.notice.nothingSelected', 'Nothing is selected.'));
        return;
      }
      const approved = await ctx.confirm.request({
        action: ctx.t('models.confirm.deleteAction', 'Delete {count} local model(s)', { values: { count: refs.length } }),
        affected: refs,
        irreversible: ctx.t(
          'models.confirm.deleteIrreversible',
          'Every selected model is removed from the local runtime and its weights are deleted from disk. A retained pull-queue record for it stays, and re-adding it downloads it again from the catalog source.'
        ),
        anchor
      });
      if (!approved) return;
      let done = 0;
      let failed = 0;
      const config = models.runtimeConfig();
      for (const ref of refs) {
        const result = await deleteModel(ctx.studio, config, ref);
        if (result.ok) done += 1;
        else failed += 1;
      }
      await ctx.history.record(`Deleted ${done} local models`, 'models', { refs, failed });
      ctx.notify.success(
        ctx.t('models.action.delete', 'Delete'),
        ctx.t('models.delete.done', '{count} model(s) were deleted from the runtime. {failed} could not be.', { values: { count: done, failed } })
      );
      selection.clear();
      await models.refreshRuntime();
    }

    async function doCopy(anchor: HTMLElement): Promise<void> {
      const refs = [...selection];
      if (refs.length !== 1) {
        ctx.notify.info(ctx.t('models.action.copy', 'Copy to a new name'), ctx.t('models.notice.nothingSelected', 'Nothing is selected.'));
        return;
      }
      const source = refs[0];
      const field = ctx.components.textField({
        label: 'models.copy.field',
        supportingText: ctx.t('models.copy.hint', 'Letters, digits, dots, dashes, underscores, one optional colon tag')
      });
      const wrap = el('div');
      wrap.append(field.root);
      const confirmed = await ctx.components.dialog({
        title: ctx.t('models.copy.title', 'Copy {name} to a new local name', { values: { name: source } }),
        body: wrap,
        confirmLabel: 'core.action.copy'
      });
      if (!confirmed) return;
      const destination = field.get().trim();
      if (!/^[A-Za-z0-9._-]+(?::[A-Za-z0-9._-]+)?$/.test(destination)) {
        ctx.notify.error(ctx.t('models.action.copy', 'Copy to a new name'), ctx.t('models.copy.hint', 'Letters, digits, dots, dashes, underscores, one optional colon tag'));
        return;
      }
      const result = await copyModel(ctx.studio, models.runtimeConfig(), source, destination);
      if (!result.ok) {
        ctx.notify.error(ctx.t('models.action.copy', 'Copy to a new name'), result.error);
        return;
      }
      await ctx.history.record(`Copied local model ${source} to ${destination}`, 'models', { source, destination });
      ctx.notify.success(ctx.t('models.action.copy', 'Copy to a new name'), ctx.t('models.copy.done', '{source} was copied to {destination}.', { values: { source, destination } }));
      await models.refreshRuntime();
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
      const path = await ctx.exporter.save(rows, format, { name: 'installed-models', defaultFileName: `installed-models.${format}` });
      if (path) ctx.notify.success(ctx.t('models.action.export', 'Export'), ctx.t('models.notice.exported', 'Written to {path}.', { values: { path } }));
    }

    async function doDetails(): Promise<void> {
      const refs = [...selection];
      if (refs.length !== 1) {
        ctx.notify.info(ctx.t('models.action.details', 'Details'), ctx.t('models.notice.nothingSelected', 'Nothing is selected.'));
        return;
      }
      const variant = all.find((v) => v.ref === refs[0]);
      if (variant) openVariantDetails(ctx, models, variant);
    }
  }

  /* ================================================================ */
  /* Hardware                                                           */
  /* ================================================================ */

  function renderHardware(): void {
    hardwareSection.textContent = '';
    hardwareSection.append(
      el('h2', { className: 'md-typescale-title-medium', text: ctx.t('models.hardware.title', 'Hardware evidence') }),
      el('p', { className: 'md-typescale-body-small', text: ctx.t('models.hardware.description', 'Every fit verdict is arithmetic over these figures. Anything nothing measured stays Unknown; nothing here is read off a model’s name.') }),
      el('p', { className: 'md-typescale-label-small models-muted', text: ctx.t('models.hardware.evidenceLanguage', 'The evidence rows and verdict reasoning below are reported in English, because they are measured figures and quoted output rather than copy.') })
    );

    hardwareSection.append(evidenceList(evidenceLines(models.hardware)));

    if (models.hardware.gaps.length > 0) {
      const gaps = el('div', { className: 'models-gaps' });
      gaps.append(el('p', { className: 'md-typescale-title-small', text: ctx.t('models.hardware.gaps', 'Not measured') }));
      for (const gap of models.hardware.gaps) gaps.append(el('p', { className: 'md-typescale-body-small', text: gap }));
      hardwareSection.append(gaps);
    }

    const probeEnabled = ctx.settings.get<boolean>(PROBE_ENABLED_ID, false) === true;
    const probeButton = ctx.components.button({
      label: 'models.hardware.probe',
      variant: 'tonal',
      icon: 'terminal',
      onClick: () => void doProbe(probeButton)
    });
    setButtonDisabled(
      probeButton,
      !probeEnabled,
      ctx.t('models.probe.disabledReason', 'Turn on the measurement helper in Settings › Local models first.')
    );
    hardwareSection.append(probeButton);
    if (!probeEnabled) {
      hardwareSection.append(el('p', { className: 'md-typescale-body-small models-muted', text: ctx.t('models.hardware.probeOff', 'The measurement helper is off. Turn it on in Settings › Local models to replace the estimated memory figure with a measured one and to learn the free disk space.') }));
    }
  }

  async function doProbe(anchor: HTMLButtonElement): Promise<void> {
    const destination = String(ctx.settings.get(PROBE_PATH_ID, '') ?? '').trim();
    const preview = probeCommandPreview(destination);
    const confirmed = await ctx.components.dialog({
      title: ctx.t('models.hardware.probe', 'Run the measurement helper'),
      body: ctx.t('models.hardware.probePreview', 'It runs exactly this, with no shell involved: {command}', {
        values: { command: `${preview.command} -e "…" ${destination || '(home folder)'}` }
      }),
      confirmLabel: 'models.hardware.probe'
    });
    if (!confirmed) return;
    setButtonDisabled(anchor, true, ctx.t('models.hardware.probe', 'Run the measurement helper'));
    const result = await runProbe(ctx.studio, destination);
    setButtonDisabled(anchor, false, '');
    if (!result.ok) {
      ctx.notify.error(ctx.t('models.hardware.probe', 'Run the measurement helper'), result.error);
      return;
    }
    models.hardware = applyProbe(models.hardware, result.value);
    models.saveHardware();
    await ctx.history.record('Measured local hardware for fit verdicts', 'models', {
      totalMemory: result.value.totalMemory,
      freeMemory: result.value.freeMemory,
      freeDisk: result.value.freeDisk,
      diskPath: result.value.diskPath
    });
    ctx.notify.success(
      ctx.t('models.hardware.probeDone', 'The machine was measured.'),
      `${formatBytes(result.value.totalMemory)} total memory, ${formatBytes(result.value.freeDisk)} free at ${result.value.diskPath ?? (destination || '~')}.`
    );
  }

  renderHealth();
  renderInstalled();
  renderHardware();

  const unsubscribe = models.on((event) => {
    if (event === 'health' || event === 'installed') {
      renderHealth();
      renderInstalled();
    }
    if (event === 'hardware') renderHardware();
  });
  ctx.onDispose(unsubscribe);

  if (!models.health) void doCheck();
}
