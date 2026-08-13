/** The "Renders" tab: the queue, the comparison surface, and disk usage. */

import { el } from '../../core/a11y';
import type { AppContext, ControlHandle, TabContext } from '../../core/registry';
import { buildCompareHtml, computeWordDiff, startServe, stopServe, type WordDiffResult } from './compare';
import { BLUEMAP_RELEASES_URL, probeJava, validateRendererPath } from './probe';
import { detectDimensions } from './renderConfig';
import { ensureQueue } from './runtime';
import { featureDirectories, SETTINGS, vaultDirName } from './store';
import type { CompareMode, RenderRecord, RenderStatus } from './types';
import {
  exportVaultCommit,
  listVaultCommits,
  listVaults,
  subscribeVaultCommits,
  subscribeVaults,
  type Vault,
  type VaultCommit
} from './vaultLink';

const STATUS_KEYS: Record<RenderStatus, string> = {
  queued: 'worldvaultrenders.status.queued',
  behind: 'worldvaultrenders.status.behind',
  exporting: 'worldvaultrenders.status.exporting',
  rendering: 'worldvaultrenders.status.rendering',
  finished: 'worldvaultrenders.status.finished',
  failed: 'worldvaultrenders.status.failed',
  cancelled: 'worldvaultrenders.status.cancelled'
};

const FAILURE_KEYS: Record<string, string> = {
  'java-missing': 'worldvaultrenders.failure.javaMissing',
  'renderer-not-configured': 'worldvaultrenders.failure.rendererNotConfigured',
  'renderer-invalid': 'worldvaultrenders.failure.rendererInvalid',
  'export-failed': 'worldvaultrenders.failure.exportFailed',
  'spawn-failed': 'worldvaultrenders.failure.spawnFailed',
  'render-failed': 'worldvaultrenders.failure.renderFailed'
};

function shortId(id: string): string {
  return id.length > 10 ? id.slice(0, 10) : id;
}

function joinPath(base: string, ...segments: string[]): string {
  const sep = base.includes('\\') && !base.startsWith('/') ? '\\' : '/';
  let out = base.replace(/[\\/]+$/, '');
  for (const segment of segments) {
    const clean = segment.replace(/^[\\/]+/, '').replace(/[\\/]+$/, '');
    if (clean !== '') out += sep + clean;
  }
  return out;
}

/**
 * A `components.select` whose option list is decided at construction time —
 * the kit has no "update the options" call — so this wraps one in a
 * container and rebuilds a fresh control in place whenever the real list of
 * commits changes underneath it. `value()` always reads the live handle, so
 * a caller never holds a stale reference across a rebuild.
 */
class RebuildableSelect {
  private container: HTMLElement;
  private handle: ControlHandle<string>;
  private currentValue = '';

  constructor(
    private readonly ctx: TabContext,
    private readonly labelKey: string,
    private readonly onChange: (value: string) => void
  ) {
    this.container = el('div', { className: 'worldvaultrenders-select-slot' });
    this.handle = this.build([]);
  }

  get root(): HTMLElement {
    return this.container;
  }

  value(): string {
    return this.currentValue;
  }

  private build(options: Array<{ value: string; label: string }>): ControlHandle<string> {
    const handle = this.ctx.components.select({
      label: this.labelKey,
      options,
      disabled: options.length === 0,
      disabledReason: options.length === 0 ? 'No commits are available yet.' : undefined,
      onChange: (value) => {
        this.currentValue = value;
        this.onChange(value);
      }
    });
    return handle;
  }

  rebuild(options: Array<{ value: string; label: string }>): void {
    const preserved = options.some((option) => option.value === this.currentValue) ? this.currentValue : '';
    const next = this.build(options);
    this.container.replaceChildren(next.root);
    this.handle = next;
    if (preserved !== '') {
      this.handle.set(preserved);
      this.currentValue = preserved;
    } else {
      this.currentValue = '';
      this.onChange('');
    }
  }
}

export function mountRendersPanel(host: HTMLElement, ctx: TabContext): void {
  const t = ctx.t;
  const paths = featureDirectories(ctx.studio);
  const commitsByVault = new Map<string, VaultCommit[]>();
  let vaults: Vault[] = listVaults();
  let selectedVaultId = vaults[0]?.id ?? '';

  // The queue is an application-lifetime singleton (see runtime.ts) so a
  // render already queued or running keeps going whether or not this tab
  // happens to be open; this only attaches this tab's own UI to it.
  const queue = ensureQueue(ctx);

  for (const vault of vaults) commitsByVault.set(vault.id, listVaultCommits(vault.id));

  host.append(ctx.components.topAppBar({ title: 'worldvaultrenders.tab' }));
  const body = el('div', { className: 'worldvaultrenders-body' });
  host.append(body);

  if (vaults.length === 0) {
    body.append(ctx.components.emptyState({ title: t('worldvaultrenders.queue.empty', 'No renders yet. Turn on rendering in settings, or start one for a commit below.') }));
  }

  /* ---------------- queue section ---------------- */
  const queueCard = ctx.components.card({ variant: 'outlined' });
  queueCard.dataset.appearanceId = 'worldvaultrenders.queue';
  queueCard.append(ctx.components.sectionHeading({ title: 'worldvaultrenders.queue.title' }));
  body.append(queueCard);

  let filteredIds: Set<string> | null = null;
  const search = ctx.createSearchBar({
    label: 'worldvaultrenders.queue.search',
    sample: queue.snapshot().map((record) => `${record.commitId} ${record.commitMessage}`).join('\n'),
    onChange: (query) => {
      const rows = queue.snapshot();
      filteredIds =
        query.text.trim() === ''
          ? null
          : new Set(rows.filter((row) => query.matches(row.commitId) || query.matches(row.commitMessage)).map((row) => row.commitId));
      refreshTable();
    }
  });
  queueCard.append(search.root);
  ctx.onDispose(() => search.destroy());

  function renderStatusChip(row: RenderRecord): HTMLElement {
    const label = t(STATUS_KEYS[row.status], row.status);
    const chip = ctx.components.chip({ label });
    if (row.status === 'failed' && row.failure) {
      const kindLabel = t(FAILURE_KEYS[row.failure.kind] ?? 'worldvaultrenders.failure.renderFailed', row.failure.kind);
      chip.title = `${kindLabel}. ${t('worldvaultrenders.failure.detail', 'Detail: {detail}', { values: { detail: row.failure.detail } })}`;
    }
    return chip;
  }

  function renderProgress(row: RenderRecord): HTMLElement {
    if (row.status === 'rendering' && row.progressFraction !== null) {
      return ctx.components.linearProgress({ value: row.progressFraction, label: row.progressTask || t('worldvaultrenders.status.rendering', 'Rendering') }).root;
    }
    if (row.status === 'rendering' || row.status === 'exporting') {
      return el('span', { className: 'worldvaultrenders-progress-text', text: row.progressTask || t(STATUS_KEYS[row.status], row.status) });
    }
    if (row.status === 'finished') return el('span', { text: '100%' });
    return el('span', { text: '—' });
  }

  function renderRowActions(row: RenderRecord): HTMLElement {
    const wrap = el('div', { className: 'worldvaultrenders-row-actions' });
    if (row.status === 'queued' || row.status === 'behind' || row.status === 'exporting' || row.status === 'rendering') {
      wrap.append(ctx.components.button({ label: 'worldvaultrenders.queue.cancel', variant: 'text', onClick: () => queue.cancel(row.commitId) }));
    }
    if (row.status === 'failed' || row.status === 'cancelled') {
      wrap.append(ctx.components.button({ label: 'worldvaultrenders.queue.retry', variant: 'text', onClick: () => queue.retry(row.commitId) }));
    }
    if (row.status === 'finished' && row.configDirectory) {
      wrap.append(ctx.components.button({ label: 'worldvaultrenders.queue.viewRender', variant: 'text', onClick: () => void viewRender(row) }));
    }
    return wrap;
  }

  const table = ctx.components.dataTable<RenderRecord>({
    label: 'worldvaultrenders.queue.title',
    selectable: true,
    onSelectionChange: () => refreshTable(),
    columns: [
      { id: 'commit', label: t('worldvaultrenders.queue.column.commit', 'Commit'), value: (row) => `${shortId(row.commitId)} — ${row.commitMessage}` },
      { id: 'status', label: t('worldvaultrenders.queue.column.status', 'Status'), render: renderStatusChip },
      { id: 'progress', label: t('worldvaultrenders.queue.column.progress', 'Progress'), render: renderProgress },
      { id: 'queuedAt', label: t('worldvaultrenders.queue.column.queuedAt', 'Queued'), align: 'end', value: (row) => new Date(row.queuedAt).toLocaleString() },
      { id: 'actions', label: '', align: 'end', render: renderRowActions }
    ],
    rows: [],
    rowId: (row) => row.commitId,
    emptyMessage: t('worldvaultrenders.queue.empty', 'No renders yet. Turn on rendering in settings, or start one for a commit below.')
  });
  queueCard.append(table.root);

  async function viewRender(row: RenderRecord): Promise<void> {
    if (!row.configDirectory) return;
    const rendererState = await validateRendererPath(ctx.studio, String(ctx.settings.get(SETTINGS.rendererPath, '')));
    if (rendererState.kind !== 'ready') {
      ctx.notify.error(t('worldvaultrenders.queue.viewRender', 'View in browser'), t('worldvaultrenders.failure.rendererNotConfigured', 'No renderer file is configured'));
      return;
    }
    const started = await startServe(ctx.studio, row.configDirectory, rendererState.path, rendererState.rendererKind);
    if (!started.ok) {
      ctx.notify.error(t('worldvaultrenders.queue.viewRender', 'View in browser'), started.error);
      return;
    }
    await ctx.studio.shell.openExternal(started.handle.url);
    ctx.notify.info(t('worldvaultrenders.queue.viewRender', 'View in browser'), started.handle.url);
  }

  const bulkRow = el('div', { className: 'worldvaultrenders-bulk-row' });
  const selectAllShownButton = ctx.components.button({ label: 'worldvaultrenders.queue.selectAllShown', variant: 'text', onClick: () => table.setSelection(currentRows().map((row) => row.commitId)) });
  const invertButton = ctx.components.button({
    label: 'worldvaultrenders.queue.selectInverse',
    variant: 'text',
    onClick: () => {
      const shown = new Set(currentRows().map((row) => row.commitId));
      const selected = new Set(table.selection());
      table.setSelection([...shown].filter((id) => !selected.has(id)));
    }
  });
  const bulkCancelButton = ctx.components.button({
    label: 'worldvaultrenders.queue.bulkCancel',
    variant: 'text',
    onClick: () => {
      for (const id of table.selection()) queue.cancel(id);
      table.clearSelection();
    }
  });
  const bulkRetryButton = ctx.components.button({
    label: 'worldvaultrenders.queue.bulkRetry',
    variant: 'text',
    onClick: () => {
      for (const id of table.selection()) queue.retry(id);
      table.clearSelection();
    }
  });
  const bulkExportButton = ctx.components.button({
    label: 'worldvaultrenders.queue.bulkExport',
    variant: 'text',
    icon: 'download',
    onClick: async () => {
      const selected = new Set(table.selection());
      const rows = queue.snapshot().filter((row) => selected.has(row.commitId));
      const path = await ctx.exporter.save(rows.map((row) => ({ ...row, log: row.log.join('\n') })), 'json', {
        name: 'world-vault-renders',
        defaultFileName: 'world-vault-renders.json'
      });
      if (path) ctx.notify.success(t('core.export.saved', 'Exported'), path);
    }
  });
  bulkRow.append(selectAllShownButton, invertButton, bulkCancelButton, bulkRetryButton, bulkExportButton);
  queueCard.append(bulkRow);

  function currentRows(): RenderRecord[] {
    const rows = queue.snapshot();
    return filteredIds === null ? rows : rows.filter((row) => filteredIds?.has(row.commitId));
  }

  function refreshTable(): void {
    const rows = currentRows();
    table.setRows(rows);
    const selectedCount = table.selection().length;
    selectAllShownButton.textContent = t('worldvaultrenders.queue.selectAllShown', 'Select all {count} shown', { values: { count: rows.length } });
    bulkCancelButton.textContent = t('worldvaultrenders.queue.bulkCancel', 'Cancel {count} selected', { values: { count: selectedCount } });
    bulkRetryButton.textContent = t('worldvaultrenders.queue.bulkRetry', 'Retry {count} selected', { values: { count: selectedCount } });
    bulkExportButton.textContent = t('worldvaultrenders.queue.bulkExport', 'Export {count} selected', { values: { count: selectedCount } });
    const noSelectionReason = 'Nothing is selected yet.';
    bulkCancelButton.disabled = selectedCount === 0;
    bulkCancelButton.title = selectedCount === 0 ? noSelectionReason : '';
    bulkRetryButton.disabled = selectedCount === 0;
    bulkRetryButton.title = selectedCount === 0 ? noSelectionReason : '';
    bulkExportButton.disabled = selectedCount === 0;
    bulkExportButton.title = selectedCount === 0 ? noSelectionReason : '';
  }

  // Only this tab's own UI subscription is released on close — the queue
  // itself is the shared background runner from runtime.ts and keeps
  // running (and persisting its own state) whether or not this tab is open.
  ctx.onDispose(
    queue.subscribe(() => {
      refreshTable();
      refreshVisualAvailability();
    })
  );
  refreshTable();

  /* ---------------- manual enqueue ---------------- */
  const manualRow = el('div', { className: 'worldvaultrenders-manual-row' });
  const manualSelect = new RebuildableSelect(ctx, 'worldvaultrenders.queue.column.commit', () => refreshManualButton());
  const manualButton = ctx.components.button({
    label: 'worldvaultrenders.queue.enqueue',
    variant: 'tonal',
    icon: 'play',
    disabled: true,
    disabledReason: 'Choose a commit first.',
    onClick: () => {
      const commit = findCommit(manualSelect.value());
      if (commit) queue.enqueue(commit);
    }
  });
  manualRow.append(manualSelect.root, manualButton);
  queueCard.append(manualRow);

  function refreshManualButton(): void {
    const ready = manualSelect.value() !== '';
    manualButton.disabled = !ready;
    manualButton.title = ready ? '' : 'Choose a commit first.';
  }

  /* ---------------- comparison ---------------- */
  const compareCard = ctx.components.card({ variant: 'outlined' });
  compareCard.dataset.appearanceId = 'worldvaultrenders.compare';
  compareCard.append(ctx.components.sectionHeading({ title: 'worldvaultrenders.compare.title', description: 'worldvaultrenders.compare.pickPrompt' }));
  body.append(compareCard);

  const leftSelect = new RebuildableSelect(ctx, 'worldvaultrenders.compare.left', () => refreshVisualAvailability());
  const rightSelect = new RebuildableSelect(ctx, 'worldvaultrenders.compare.right', () => refreshVisualAvailability());
  compareCard.append(el('div', { className: 'worldvaultrenders-compare-row', children: [leftSelect.root, rightSelect.root] }));

  const compareResult = el('div', { className: 'worldvaultrenders-compare-result' });
  const compareButton = ctx.components.button({
    label: 'worldvaultrenders.compare.run',
    variant: 'filled',
    onClick: async () => {
      const leftId = leftSelect.value();
      const rightId = rightSelect.value();
      if (leftId === '' || rightId === '') return;
      const leftCommit = findCommit(leftId);
      const rightCommit = findCommit(rightId);
      if (!leftCommit || !rightCommit) return;

      compareButton.disabled = true;
      compareButton.title = 'A comparison is already running.';
      compareResult.replaceChildren(ctx.components.linearProgress({ label: t('worldvaultrenders.compare.run', 'Compare') }).root);
      try {
        const leftDirectory = queue.recordFor(leftId)?.exportDirectory ?? (await exportForCompare(leftCommit));
        const rightDirectory = queue.recordFor(rightId)?.exportDirectory ?? (await exportForCompare(rightCommit));
        if (!leftDirectory || !rightDirectory) {
          compareResult.replaceChildren(el('p', { text: t('worldvaultrenders.failure.exportFailed', 'The commit could not be exported') }));
          return;
        }
        renderCompareResult(await computeWordDiff(ctx.studio, leftDirectory, rightDirectory));
      } finally {
        compareButton.disabled = false;
        compareButton.title = '';
      }
    }
  });
  compareCard.append(compareButton, compareResult);

  async function exportForCompare(commit: VaultCommit): Promise<string | null> {
    const directory = joinPath(paths.exportRoot, vaultDirName(commit.vaultId), commit.id);
    const stat = await ctx.studio.fs.stat(directory);
    if (stat.ok && stat.value.exists) return directory;
    const exported = await exportVaultCommit(commit, directory);
    return exported.ok ? exported.path : null;
  }

  function renderCompareResult(diff: WordDiffResult): void {
    compareResult.replaceChildren();
    if (diff.regions.length === 0) {
      compareResult.append(el('p', { text: t('worldvaultrenders.compare.noDifference', 'No region files differ between these two commits.') }));
    } else {
      compareResult.append(
        el('p', {
          text: t('worldvaultrenders.compare.summary', '{regions} regions differ: {added} chunks added, {removed} removed, {changed} changed.', {
            values: { regions: diff.regions.length, added: diff.totalChunksAdded, removed: diff.totalChunksRemoved, changed: diff.totalChunksChanged }
          })
        })
      );
      compareResult.append(
        ctx.components.dataTable({
          label: t('worldvaultrenders.compare.title', 'Compare two commits'),
          rows: diff.regions,
          rowId: (row) => `${row.dimension}:${row.regionFile}`,
          columns: [
            { id: 'dimension', label: t('worldvaultrenders.compare.column.dimension', 'Dimension'), value: (row) => row.dimension },
            { id: 'region', label: t('worldvaultrenders.compare.column.region', 'Region file'), value: (row) => row.regionFile },
            {
              id: 'status',
              label: t('worldvaultrenders.compare.column.status', 'Change'),
              value: (row) =>
                row.status === 'added'
                  ? t('worldvaultrenders.compare.regionAdded', 'added')
                  : row.status === 'removed'
                    ? t('worldvaultrenders.compare.regionRemoved', 'removed')
                    : t('worldvaultrenders.compare.regionChanged', 'changed')
            },
            {
              id: 'chunks',
              label: t('worldvaultrenders.compare.column.chunks', 'Chunks +/-/~'),
              align: 'end',
              value: (row) => `+${String(row.addedChunks)} / -${String(row.removedChunks)} / ~${String(row.changedChunks)}`
            }
          ]
        }).root
      );
    }
    if (diff.unreadable.length > 0) {
      compareResult.append(
        el('p', {
          className: 'worldvaultrenders-compare-warning',
          text: t('worldvaultrenders.compare.unreadable', '{count} region file(s) could not be read and were left out of the totals above.', {
            values: { count: diff.unreadable.length }
          })
        })
      );
    }
  }

  /* ---------------- visual comparison ---------------- */
  let compareMode: CompareMode = 'slider';
  compareCard.append(
    ctx.components.segmentedButton({
      label: 'worldvaultrenders.compare.mode',
      options: [
        { value: 'slider', label: 'worldvaultrenders.compare.mode.slider' },
        { value: 'toggle', label: 'worldvaultrenders.compare.mode.toggle' },
        { value: 'side-by-side', label: 'worldvaultrenders.compare.mode.sideBySide' }
      ],
      value: compareMode,
      onChange: (value) => {
        compareMode = value as CompareMode;
      }
    }).root
  );

  let activeServe: { left: string; right: string } | null = null;
  const stopVisualButton = ctx.components.button({
    label: 'worldvaultrenders.compare.stopVisual',
    variant: 'text',
    disabled: true,
    disabledReason: 'Nothing is currently being served.',
    onClick: async () => {
      if (!activeServe) return;
      await stopServe(ctx.studio, activeServe.left);
      await stopServe(ctx.studio, activeServe.right);
      activeServe = null;
      stopVisualButton.disabled = true;
      stopVisualButton.title = 'Nothing is currently being served.';
    }
  });
  const visualButton = ctx.components.button({
    label: 'worldvaultrenders.compare.openVisual',
    variant: 'tonal',
    disabled: true,
    disabledReason: t(
      'worldvaultrenders.compare.needsBothRendered',
      'Both commits need a finished render before they can be compared visually. Use the word comparison below in the meantime.'
    ),
    onClick: async () => {
      const leftId = leftSelect.value();
      const rightId = rightSelect.value();
      const leftRecord = queue.recordFor(leftId);
      const rightRecord = queue.recordFor(rightId);
      if (!leftRecord?.configDirectory || !rightRecord?.configDirectory) return;
      const rendererState = await validateRendererPath(ctx.studio, String(ctx.settings.get(SETTINGS.rendererPath, '')));
      if (rendererState.kind !== 'ready') {
        ctx.notify.error(t('worldvaultrenders.compare.openVisual', 'Open visual comparison'), t('worldvaultrenders.failure.rendererNotConfigured', 'No renderer file is configured'));
        return;
      }

      visualButton.disabled = true;
      const [leftServe, rightServe] = await Promise.all([
        startServe(ctx.studio, leftRecord.configDirectory, rendererState.path, rendererState.rendererKind),
        startServe(ctx.studio, rightRecord.configDirectory, rendererState.path, rendererState.rendererKind)
      ]);
      visualButton.disabled = false;
      if (!leftServe.ok || !rightServe.ok) {
        ctx.notify.error(
          t('worldvaultrenders.compare.openVisual', 'Open visual comparison'),
          !leftServe.ok ? leftServe.error : rightServe.ok ? '' : rightServe.error
        );
        if (leftServe.ok) await stopServe(ctx.studio, leftServe.handle.processId);
        if (rightServe.ok) await stopServe(ctx.studio, rightServe.handle.processId);
        return;
      }
      activeServe = { left: leftServe.handle.processId, right: rightServe.handle.processId };
      stopVisualButton.disabled = false;
      stopVisualButton.title = '';
      const html = buildCompareHtml(
        { url: leftServe.handle.url, label: `${shortId(leftId)} — ${leftRecord.commitMessage}` },
        { url: rightServe.handle.url, label: `${shortId(rightId)} — ${rightRecord.commitMessage}` },
        compareMode
      );
      const comparePath = joinPath(paths.outputRoot, 'compare.html');
      const written = await ctx.studio.fs.writeText(comparePath, html);
      if (written.ok) await ctx.studio.shell.openPath(comparePath);
      else ctx.notify.error(t('worldvaultrenders.compare.openVisual', 'Open visual comparison'), written.error);
    }
  });
  compareCard.append(visualButton, stopVisualButton);
  ctx.onDispose(() => {
    if (activeServe) {
      void stopServe(ctx.studio, activeServe.left);
      void stopServe(ctx.studio, activeServe.right);
    }
  });

  function refreshVisualAvailability(): void {
    const leftRecord = queue.recordFor(leftSelect.value());
    const rightRecord = queue.recordFor(rightSelect.value());
    const ready = leftRecord?.status === 'finished' && rightRecord?.status === 'finished';
    visualButton.disabled = !ready;
    visualButton.title = ready
      ? ''
      : t('worldvaultrenders.compare.needsBothRendered', 'Both commits need a finished render before they can be compared visually. Use the word comparison below in the meantime.');
  }

  function findCommit(commitId: string): VaultCommit | null {
    if (commitId === '') return null;
    for (const list of commitsByVault.values()) {
      const found = list.find((commit) => commit.id === commitId);
      if (found) return found;
    }
    return null;
  }

  /* ---------------- disk usage ---------------- */
  const diskCard = ctx.components.card({ variant: 'outlined' });
  diskCard.append(ctx.components.sectionHeading({ title: 'worldvaultrenders.disk.exportRoot', description: 'worldvaultrenders.disk.description' }));
  const diskList = ctx.components.list();
  diskList.append(
    ctx.components.listItem({
      headline: t('worldvaultrenders.disk.exportRoot', 'Exported snapshots folder'),
      supporting: paths.exportRoot,
      trailing: ctx.components.button({ label: 'worldvaultrenders.disk.reveal', variant: 'text', icon: 'folder', onClick: () => void ctx.studio.shell.showItemInFolder(paths.exportRoot) })
    }),
    ctx.components.listItem({
      headline: t('worldvaultrenders.disk.outputRoot', 'Rendered maps folder'),
      supporting: paths.outputRoot,
      trailing: ctx.components.button({ label: 'worldvaultrenders.disk.reveal', variant: 'text', icon: 'folder', onClick: () => void ctx.studio.shell.showItemInFolder(paths.outputRoot) })
    })
  );
  diskCard.append(diskList);
  body.append(diskCard);

  /* ---------------- vault/commit wiring ---------------- */
  function rebuildCommitLists(): void {
    for (const vault of vaults) commitsByVault.set(vault.id, listVaultCommits(vault.id));
    const options = (commitsByVault.get(selectedVaultId) ?? []).map((commit) => ({
      value: commit.id,
      label: `${shortId(commit.id)} — ${commit.message}`
    }));
    manualSelect.rebuild(options);
    leftSelect.rebuild(options);
    rightSelect.rebuild(options);
    refreshManualButton();
    refreshVisualAvailability();
    search.setText(search.query().text);
  }
  rebuildCommitLists();

  ctx.onDispose(
    subscribeVaults((next) => {
      vaults = next;
      if (!vaults.some((vault) => vault.id === selectedVaultId)) selectedVaultId = vaults[0]?.id ?? '';
      rebuildCommitLists();
    })
  );

  // Auto-enqueueing a new commit is the shared runtime's job (runtime.ts),
  // so every vault is covered whether or not this tab is even open; this
  // subscription only keeps the tab's own commit pickers current.
  ctx.onDispose(
    subscribeVaultCommits((commit, all) => {
      commitsByVault.set(commit.vaultId, all);
      rebuildCommitLists();
    })
  );
}

/** Reports Java/renderer readiness once, for a settings action. */
export async function probeReadiness(ctx: AppContext): Promise<{ java: string; renderer: string }> {
  const java = await probeJava(ctx.studio);
  const renderer = await validateRendererPath(ctx.studio, String(ctx.settings.get(SETTINGS.rendererPath, '')));
  return {
    java: java.kind === 'available' ? java.version : java.kind === 'missing' ? java.reason : 'unknown',
    renderer: renderer.kind === 'ready' ? renderer.path : renderer.kind
  };
}

export { BLUEMAP_RELEASES_URL, detectDimensions };
