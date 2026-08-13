/**
 * The chunk-operations tab.
 *
 * A grid of chunk cells, driven by real region-file occupancy read off disk —
 * click or keyboard-select one chunk or a rectangle, copy the selection to
 * another coordinate (rewriting every absolute position the copied chunks
 * carry) or remove it. Every mutating action is gated on the world vault's own
 * permission check (never races the downloader) and recorded as a real commit
 * (unlimited undo covers an edit exactly like a download).
 */

import {
  activeWorldPath,
  commitEdit,
  requestRegionAccess,
  setActiveWorldPath,
  subscribeActiveWorldPath,
  subscribeVaultEvents,
  vaultStatus
} from '../world-vault/contract';
import type { Result, WorldVaultPermission, WorldVaultStatus } from '../../../shared/api';
import { EditLogStore } from './editLog';
import {
  DIMENSION_OPTIONS,
  GRID_ID,
  GRID_PAGE_CHUNKS,
  LOG_ID,
  MAX_CONFIRM_ITEMS,
  MAX_SELECTION_CHUNKS,
  SELECTION_ID,
  SETTING_CUSTOM_DIMENSION_PATH,
  SETTING_DIMENSION,
  SETTING_WORLD_DIRECTORY,
  STATUS_ID,
  STORE_GRID_ORIGIN,
  boundsOf,
  chunkKey,
  chunkToRegion,
  dimensionSubpath,
  formatChunk,
  formatNumber,
  formatTimestamp,
  isDimensionId,
  newLogId,
  parseChunkKey,
  rectangleKeys,
  regionAbsolutePath,
  regionRelativePath,
  selectionToChunks,
  type ChunkPos,
  type DimensionId,
  type EditLogEntry,
  type RegionOccupancy
} from './model';
import { readRegionOccupancy, runOperation } from './workerClient';
import { el, nextId } from '../../core/a11y';
import type { ExportFormat, SearchBarHandle, SearchQuery, TabContext } from '../../core/registry';

const EXPORT_FORMATS: ExportFormat[] = ['json', 'jsonl', 'yaml', 'toml', 'xml', 'csv', 'tsv', 'markdown', 'html', 'sql'];

export function mountWorldVaultEditTab(host: HTMLElement, ctx: TabContext): void {
  const t = (key: string, fallback: string, values?: Record<string, string | number>): string =>
    ctx.t(key, fallback, values ? { values } : undefined);

  /* ---------------- state ---------------- */

  const log = new EditLogStore(ctx.settings, ctx.history);

  let worldDirectory = String(ctx.settings.get(SETTING_WORLD_DIRECTORY, '')).trim();
  if (worldDirectory === '') worldDirectory = activeWorldPath() ?? '';
  let dimension: DimensionId = isDimensionId(ctx.settings.get(SETTING_DIMENSION, 'overworld'))
    ? (ctx.settings.get(SETTING_DIMENSION, 'overworld') as DimensionId)
    : 'overworld';
  let customPath = String(ctx.settings.get(SETTING_CUSTOM_DIMENSION_PATH, ''));

  let pageOrigin: ChunkPos = normaliseOrigin(ctx.settings.get<unknown>(STORE_GRID_ORIGIN, null));
  let selection = new Set<string>();
  let anchor: ChunkPos | null = null;
  let focusedCell: ChunkPos = { ...pageOrigin };

  const occupancyCache = new Map<string, RegionOccupancy>();
  let vaultState: WorldVaultStatus | null = null;
  let running = false;

  let logQuery: SearchQuery | null = null;

  /* ---------------- shell ---------------- */

  const root = el('div', { className: 'wve-root' });
  root.dataset.appearanceId = 'worldvaultedit.root';
  host.append(root);

  const refreshButton = ctx.components.button({
    label: 'worldvaultedit.action.refresh',
    variant: 'tonal',
    icon: 'refresh',
    onClick: () => {
      void refreshOccupancyForPage(true);
    }
  });
  root.append(ctx.components.topAppBar({ title: 'worldvaultedit.tab', subtitle: 'worldvaultedit.tab.subtitle', actions: [refreshButton] }));

  const layout = el('div', { className: 'wve-layout' });
  root.append(layout);

  /* ---------------- world / dimension chooser ---------------- */

  const configCard = ctx.components.card({ variant: 'outlined' });
  configCard.dataset.appearanceId = 'worldvaultedit.config';
  configCard.append(ctx.components.sectionHeading({ title: 'worldvaultedit.config.title', description: 'worldvaultedit.config.description' }));
  layout.append(configCard);

  const worldField = ctx.components.textField({
    label: 'worldvaultedit.worldDirectory',
    value: worldDirectory,
    browse: 'folder',
    supportingText: 'worldvaultedit.worldDirectory.hint',
    onCommit: (value) => {
      worldDirectory = value.trim();
      ctx.settings.set(SETTING_WORLD_DIRECTORY, worldDirectory);
      if (worldDirectory !== '') setActiveWorldPath(worldDirectory);
      occupancyCache.clear();
      void refreshVaultStatus();
      void refreshOccupancyForPage(false);
    }
  });
  configCard.append(worldField.root);

  const dimensionSelect = ctx.components.select({
    label: 'worldvaultedit.dimension',
    options: DIMENSION_OPTIONS.map((option) => ({ value: option.id, label: option.labelKey })),
    value: dimension,
    onChange: (value) => {
      if (!isDimensionId(value)) return;
      dimension = value;
      ctx.settings.set(SETTING_DIMENSION, dimension);
      customField.root.hidden = dimension !== 'custom';
      occupancyCache.clear();
      void refreshOccupancyForPage(false);
    }
  });
  configCard.append(dimensionSelect.root);

  const customField = ctx.components.textField({
    label: 'worldvaultedit.customDimensionPath',
    value: customPath,
    supportingText: 'worldvaultedit.customDimensionPath.hint',
    onCommit: (value) => {
      customPath = value;
      ctx.settings.set(SETTING_CUSTOM_DIMENSION_PATH, customPath);
      occupancyCache.clear();
      void refreshOccupancyForPage(false);
    }
  });
  customField.root.hidden = dimension !== 'custom';
  configCard.append(customField.root);

  const vaultStatusLine = el('p', {
    className: 'wve-vault-status md-typescale-body-small',
    attrs: { role: 'status', 'aria-live': 'polite' }
  });
  vaultStatusLine.id = STATUS_ID;
  configCard.append(vaultStatusLine);

  /* ---------------- grid ---------------- */

  const gridCard = ctx.components.card({ variant: 'outlined' });
  gridCard.id = GRID_ID;
  gridCard.dataset.appearanceId = 'worldvaultedit.grid';
  gridCard.append(ctx.components.sectionHeading({ title: 'worldvaultedit.grid.title', description: 'worldvaultedit.grid.description' }));
  layout.append(gridCard);

  const gridStatus = el('p', {
    className: 'wve-grid-status md-typescale-body-small',
    attrs: { role: 'status', 'aria-live': 'polite' }
  });
  gridCard.append(gridStatus);

  const navRow = el('div', { className: 'wve-actions' });
  const gotoX = ctx.components.textField({ label: 'worldvaultedit.goto.x', type: 'number', value: String(pageOrigin.cx), step: 1 });
  const gotoZ = ctx.components.textField({ label: 'worldvaultedit.goto.z', type: 'number', value: String(pageOrigin.cz), step: 1 });
  navRow.append(
    ctx.components.button({
      label: 'worldvaultedit.action.pageUp',
      variant: 'text',
      icon: 'chevronUp',
      onClick: () => panPage(0, -GRID_PAGE_CHUNKS)
    }),
    ctx.components.button({
      label: 'worldvaultedit.action.pageDown',
      variant: 'text',
      icon: 'chevronDown',
      onClick: () => panPage(0, GRID_PAGE_CHUNKS)
    }),
    ctx.components.button({
      label: 'worldvaultedit.action.pageLeft',
      variant: 'text',
      icon: 'chevronLeft',
      onClick: () => panPage(-GRID_PAGE_CHUNKS, 0)
    }),
    ctx.components.button({
      label: 'worldvaultedit.action.pageRight',
      variant: 'text',
      icon: 'chevronRight',
      onClick: () => panPage(GRID_PAGE_CHUNKS, 0)
    }),
    ctx.components.button({
      label: 'worldvaultedit.action.home',
      variant: 'text',
      icon: 'home',
      onClick: () => setOrigin({ cx: 0, cz: 0 })
    }),
    gotoX.root,
    gotoZ.root,
    ctx.components.button({
      label: 'worldvaultedit.action.goto',
      variant: 'outlined',
      onClick: () => {
        const cx = Math.trunc(Number(gotoX.get()));
        const cz = Math.trunc(Number(gotoZ.get()));
        if (Number.isFinite(cx) && Number.isFinite(cz)) setOrigin({ cx, cz });
      }
    })
  );
  gridCard.append(navRow);

  const gridHelpId = nextId('wve-grid-help');
  const gridHelp = el('p', {
    className: 'wve-grid-help md-typescale-body-small',
    text: t(
      'worldvaultedit.grid.help',
      'Arrow keys move, Enter or Space toggles the focused chunk, Shift with either extends a rectangle from the last chunk you toggled. Click selects one chunk; Shift-click extends a rectangle; Ctrl or Cmd-click adds or removes one chunk without clearing the rest.'
    )
  });
  gridHelp.id = gridHelpId;

  const gridWrap = el('div', { className: 'wve-grid-wrap' });
  const grid = el('div', {
    className: 'wve-grid',
    attrs: { role: 'grid', 'aria-label': t('worldvaultedit.grid.label', 'Chunk selection grid'), 'aria-describedby': gridHelpId }
  });
  grid.style.setProperty('--wve-grid-size', String(GRID_PAGE_CHUNKS));
  gridWrap.append(grid);
  gridCard.append(gridWrap, gridHelp);

  const cellButtons = new Map<string, HTMLButtonElement>();

  /* ---------------- selection readout + destination ---------------- */

  const selectionCard = ctx.components.card({ variant: 'outlined' });
  selectionCard.id = SELECTION_ID;
  selectionCard.dataset.appearanceId = 'worldvaultedit.selection';
  selectionCard.append(ctx.components.sectionHeading({ title: 'worldvaultedit.selection.title' }));
  layout.append(selectionCard);

  const selectionSummary = el('p', {
    className: 'wve-selection-summary md-typescale-body-medium',
    attrs: { role: 'status', 'aria-live': 'polite' }
  });
  selectionCard.append(selectionSummary);

  const clearSelectionButton = ctx.components.button({
    label: 'worldvaultedit.selection.clear',
    variant: 'text',
    onClick: () => {
      selection.clear();
      renderGrid();
      renderSelectionSummary();
    }
  });
  selectionCard.append(clearSelectionButton);

  const destX = ctx.components.textField({ label: 'worldvaultedit.destination.x', type: 'number', step: 1 });
  const destZ = ctx.components.textField({ label: 'worldvaultedit.destination.z', type: 'number', step: 1 });
  const destRow = el('div', { className: 'wve-actions' });
  destRow.id = 'worldvaultedit-destination-fields';
  destRow.append(destX.root, destZ.root);
  selectionCard.append(
    el('p', { className: 'md-typescale-body-small', text: t('worldvaultedit.destination.hint', 'Where the selection’s top-left chunk should land. Every other selected chunk moves by the same offset.') }),
    destRow
  );

  const copyError = el('p', { className: 'wve-error md-typescale-body-small', attrs: { role: 'status', 'aria-live': 'polite' } });
  selectionCard.append(copyError);

  const progress = ctx.components.linearProgress({ label: 'worldvaultedit.progress.label', value: 0 });
  progress.root.hidden = true;
  selectionCard.append(progress.root);

  const copyButton = ctx.components.button({
    label: 'worldvaultedit.action.copy',
    variant: 'filled',
    icon: 'copy',
    onClick: (event) => {
      void performCopy(event.currentTarget as HTMLElement);
    }
  });
  const removeButton = ctx.components.button({
    label: 'worldvaultedit.action.remove',
    variant: 'text',
    danger: true,
    icon: 'trash',
    onClick: (event) => {
      void performRemove(event.currentTarget as HTMLElement);
    }
  });
  const actionRow = el('div', { className: 'wve-actions' });
  actionRow.append(copyButton, removeButton);
  selectionCard.append(actionRow);

  /* ---------------- edit log ---------------- */

  const logCard = ctx.components.card({ variant: 'outlined' });
  logCard.id = LOG_ID;
  logCard.dataset.appearanceId = 'worldvaultedit.log';
  logCard.append(ctx.components.sectionHeading({ title: 'worldvaultedit.log.title', description: 'worldvaultedit.log.description' }));
  layout.append(logCard);

  const logSearch: SearchBarHandle = ctx.createSearchBar({
    label: 'worldvaultedit.log.search',
    sample: log
      .all()
      .map((entry) => entry.detail)
      .join('\n'),
    onChange: (query) => {
      logQuery = query;
      renderLog();
    }
  });
  logCard.append(logSearch.root);

  let exportFormat: ExportFormat = 'json';
  const logSelectionBar = el('div', { className: 'wve-actions wve-actions--wrap' });
  const selectShownButton = ctx.components.button({
    label: t('worldvaultedit.log.selectShown', 'Select the {count} shown', { count: 0 }),
    variant: 'outlined',
    onClick: () => {
      for (const entry of filteredLog()) logSelection.add(entry.id);
      renderLog();
    }
  });
  const selectAllLogButton = ctx.components.button({
    label: t('worldvaultedit.log.selectAll', 'Select every entry ({count})', { count: 0 }),
    variant: 'outlined',
    onClick: () => {
      for (const entry of log.all()) logSelection.add(entry.id);
      renderLog();
    }
  });
  const invertLogButton = ctx.components.button({
    label: 'worldvaultedit.log.invert',
    variant: 'outlined',
    onClick: () => {
      const next = new Set<string>();
      for (const entry of log.all()) if (!logSelection.has(entry.id)) next.add(entry.id);
      logSelection = next;
      renderLog();
    }
  });
  const clearLogSelectionButton = ctx.components.button({
    label: 'worldvaultedit.log.clearSelection',
    variant: 'text',
    onClick: () => {
      logSelection.clear();
      renderLog();
    }
  });
  logSelectionBar.append(selectShownButton, selectAllLogButton, invertLogButton, clearLogSelectionButton);
  logCard.append(logSelectionBar);

  const logBulkBar = el('div', { className: 'wve-actions wve-actions--wrap' });
  const exportSelect = ctx.components.select({
    label: 'worldvaultedit.log.format',
    options: EXPORT_FORMATS.map((format) => ({ value: format, label: format.toUpperCase() })),
    value: exportFormat,
    onChange: (value) => {
      exportFormat = EXPORT_FORMATS.includes(value as ExportFormat) ? (value as ExportFormat) : 'json';
    }
  });
  const exportLogButton = ctx.components.button({
    label: 'worldvaultedit.log.export',
    variant: 'text',
    icon: 'download',
    onClick: () => {
      void exportLog();
    }
  });
  const deleteLogButton = ctx.components.button({
    label: 'worldvaultedit.log.deleteEntries',
    variant: 'text',
    danger: true,
    icon: 'trash',
    onClick: (event) => {
      void deleteLogEntries(event.currentTarget as HTMLElement);
    }
  });
  logBulkBar.append(exportSelect.root, exportLogButton, deleteLogButton);
  logCard.append(logBulkBar);

  const logSummary = el('p', { className: 'wve-log-summary md-typescale-body-small', attrs: { role: 'status', 'aria-live': 'polite' } });
  logCard.append(logSummary);

  const logListHost = el('div', { className: 'wve-log-list' });
  logCard.append(logListHost);

  let logSelection = new Set<string>();

  /* ================================================================ */
  /* Behaviour                                                          */
  /* ================================================================ */

  function normaliseOrigin(raw: unknown): ChunkPos {
    if (typeof raw === 'object' && raw !== null) {
      const record = raw as Record<string, unknown>;
      const cx = Number(record.cx);
      const cz = Number(record.cz);
      if (Number.isInteger(cx) && Number.isInteger(cz)) return { cx, cz };
    }
    return { cx: 0, cz: 0 };
  }

  function currentDimensionSubpath(): string {
    return dimensionSubpath(dimension, customPath);
  }

  function regionKeyFor(rx: number, rz: number): string {
    return `${String(rx)},${String(rz)}`;
  }

  async function refreshVaultStatus(): Promise<void> {
    if (worldDirectory === '') {
      vaultState = null;
      renderVaultStatus();
      return;
    }
    const result: Result<WorldVaultStatus> = await vaultStatus(ctx.studio, worldDirectory);
    vaultState = result.ok ? result.value : null;
    renderVaultStatus();
  }

  function renderVaultStatus(): void {
    if (worldDirectory === '') {
      vaultStatusLine.textContent = t('worldvaultedit.status.noWorld', 'Choose a world folder to begin.');
    } else if (!vaultState) {
      vaultStatusLine.textContent = t('worldvaultedit.status.unknown', 'The vault status for this world could not be read yet.');
    } else if (!vaultState.exists) {
      vaultStatusLine.textContent = t(
        'worldvaultedit.status.noVault',
        'This world has no vault yet. Create one in the World vault tab before editing here — every edit is recorded as a commit, and there is nothing to commit into without one.'
      );
    } else {
      vaultStatusLine.textContent = t('worldvaultedit.status.ready', 'Vault ready: {count} commits. Last: {last}', {
        count: formatNumber(vaultState.commitCount),
        last: vaultState.lastCommit ? vaultState.lastCommit.subject : t('worldvaultedit.status.noCommits', 'none yet')
      });
    }
    updateActionAvailability();
  }

  function vaultExists(): boolean {
    return vaultState !== null && vaultState.exists;
  }

  function updateActionAvailability(): void {
    const count = selection.size;
    const reasons: string[] = [];
    if (worldDirectory === '') reasons.push(t('worldvaultedit.reason.noWorld', 'Choose a world folder first.'));
    else if (!vaultExists()) reasons.push(t('worldvaultedit.reason.noVault', 'Create the vault for this world first, in the World vault tab.'));
    if (count === 0) reasons.push(t('worldvaultedit.reason.noSelection', 'Select at least one chunk first.'));
    if (count > MAX_SELECTION_CHUNKS) {
      reasons.push(t('worldvaultedit.reason.tooLarge', 'The selection has {count} chunks, past the {max}-chunk bound.', {
        count: formatNumber(count),
        max: formatNumber(MAX_SELECTION_CHUNKS)
      }));
    }
    if (running) reasons.push(t('worldvaultedit.reason.running', 'An edit is already in progress.'));

    const reason = reasons.join(' ');
    const disabled = reasons.length > 0;
    for (const control of [copyButton, removeButton]) {
      control.disabled = disabled;
      if (disabled) {
        control.title = reason;
        control.setAttribute('aria-description', reason);
      } else {
        control.removeAttribute('title');
        control.removeAttribute('aria-description');
      }
    }
  }

  function setOrigin(next: ChunkPos): void {
    pageOrigin = next;
    ctx.settings.set(STORE_GRID_ORIGIN, { ...next });
    gotoX.set(String(next.cx));
    gotoZ.set(String(next.cz));
    focusedCell = { ...next };
    void refreshOccupancyForPage(false);
  }

  function panPage(dx: number, dz: number): void {
    setOrigin({ cx: pageOrigin.cx + dx, cz: pageOrigin.cz + dz });
  }

  async function refreshOccupancyForPage(announce: boolean): Promise<void> {
    if (worldDirectory === '') {
      renderGrid();
      gridStatus.textContent = t('worldvaultedit.grid.empty.noWorld', 'No world folder is chosen yet.');
      return;
    }
    const dimSub = currentDimensionSubpath();
    const regions = new Set<string>();
    for (let dz = 0; dz < GRID_PAGE_CHUNKS; dz += 1) {
      for (let dx = 0; dx < GRID_PAGE_CHUNKS; dx += 1) {
        const { rx, rz } = chunkToRegion(pageOrigin.cx + dx, pageOrigin.cz + dz);
        regions.add(regionKeyFor(rx, rz));
      }
    }
    await Promise.all(
      [...regions].map(async (key) => {
        const [rx, rz] = key.split(',').map(Number);
        const absolute = regionAbsolutePath(worldDirectory, dimSub, 'region', rx, rz);
        const occupancy = await readRegionOccupancy(ctx.studio, absolute, rx, rz);
        occupancyCache.set(key, occupancy);
      })
    );
    renderGrid();
    let occupiedCount = 0;
    for (let dz = 0; dz < GRID_PAGE_CHUNKS; dz += 1) {
      for (let dx = 0; dx < GRID_PAGE_CHUNKS; dx += 1) {
        if (isOccupied(pageOrigin.cx + dx, pageOrigin.cz + dz)) occupiedCount += 1;
      }
    }
    gridStatus.textContent = t('worldvaultedit.grid.status', 'Showing chunks {x1}–{x2}, {z1}–{z2}. {occupied} of {total} have data.', {
      x1: pageOrigin.cx,
      x2: pageOrigin.cx + GRID_PAGE_CHUNKS - 1,
      z1: pageOrigin.cz,
      z2: pageOrigin.cz + GRID_PAGE_CHUNKS - 1,
      occupied: occupiedCount,
      total: GRID_PAGE_CHUNKS * GRID_PAGE_CHUNKS
    });
    if (announce) ctx.a11y.announce(gridStatus.textContent);
  }

  function isOccupied(cx: number, cz: number): boolean {
    const { rx, rz } = chunkToRegion(cx, cz);
    const occupancy = occupancyCache.get(regionKeyFor(rx, rz));
    if (!occupancy) return false;
    const localX = ((cx % 32) + 32) % 32;
    const localZ = ((cz % 32) + 32) % 32;
    return occupancy.occupied[localX + localZ * 32] === true;
  }

  function buildGridOnce(): void {
    for (let dz = 0; dz < GRID_PAGE_CHUNKS; dz += 1) {
      for (let dx = 0; dx < GRID_PAGE_CHUNKS; dx += 1) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'wve-cell';
        button.setAttribute('role', 'gridcell');
        button.dataset.dx = String(dx);
        button.dataset.dz = String(dz);
        button.tabIndex = -1;
        button.addEventListener('click', (event) => onCellActivate(dx, dz, (event as MouseEvent).shiftKey, (event as MouseEvent).ctrlKey || (event as MouseEvent).metaKey));
        button.addEventListener('keydown', (event) => onCellKeydown(event, dx, dz));
        button.addEventListener('focus', () => {
          focusedCell = { cx: pageOrigin.cx + dx, cz: pageOrigin.cz + dz };
        });
        grid.append(button);
        cellButtons.set(`${String(dx)},${String(dz)}`, button);
      }
    }
  }

  function onCellActivate(dx: number, dz: number, shift: boolean, toggleOnly: boolean): void {
    const pos = { cx: pageOrigin.cx + dx, cz: pageOrigin.cz + dz };
    if (shift && anchor) {
      selection = new Set(rectangleKeys(anchor, pos));
    } else if (toggleOnly) {
      const key = chunkKey(pos.cx, pos.cz);
      if (selection.has(key)) selection.delete(key);
      else selection.add(key);
      anchor = pos;
    } else {
      selection = new Set([chunkKey(pos.cx, pos.cz)]);
      anchor = pos;
    }
    renderGrid();
    renderSelectionSummary();
  }

  function onCellKeydown(event: KeyboardEvent, dx: number, dz: number): void {
    let targetDx = dx;
    let targetDz = dz;
    let handled = true;
    switch (event.key) {
      case 'ArrowLeft':
        targetDx -= 1;
        break;
      case 'ArrowRight':
        targetDx += 1;
        break;
      case 'ArrowUp':
        targetDz -= 1;
        break;
      case 'ArrowDown':
        targetDz += 1;
        break;
      case 'Enter':
      case ' ':
        onCellActivate(dx, dz, event.shiftKey, event.ctrlKey || event.metaKey);
        event.preventDefault();
        return;
      default:
        handled = false;
    }
    if (!handled) return;
    event.preventDefault();
    if (targetDx < 0) {
      panPage(-GRID_PAGE_CHUNKS, 0);
      return;
    }
    if (targetDx >= GRID_PAGE_CHUNKS) {
      panPage(GRID_PAGE_CHUNKS, 0);
      return;
    }
    if (targetDz < 0) {
      panPage(0, -GRID_PAGE_CHUNKS);
      return;
    }
    if (targetDz >= GRID_PAGE_CHUNKS) {
      panPage(0, GRID_PAGE_CHUNKS);
      return;
    }
    const nextButton = cellButtons.get(`${String(targetDx)},${String(targetDz)}`);
    nextButton?.focus();
  }

  function renderGrid(): void {
    for (let dz = 0; dz < GRID_PAGE_CHUNKS; dz += 1) {
      for (let dx = 0; dx < GRID_PAGE_CHUNKS; dx += 1) {
        const button = cellButtons.get(`${String(dx)},${String(dz)}`);
        if (!button) continue;
        const cx = pageOrigin.cx + dx;
        const cz = pageOrigin.cz + dz;
        const occupied = isOccupied(cx, cz);
        const selected = selection.has(chunkKey(cx, cz));
        button.classList.toggle('wve-cell--occupied', occupied);
        button.classList.toggle('wve-cell--empty', !occupied);
        button.classList.toggle('wve-cell--selected', selected);
        button.setAttribute('aria-pressed', String(selected));
        button.tabIndex = cx === focusedCell.cx && cz === focusedCell.cz ? 0 : -1;
        const state = occupied ? t('worldvaultedit.cell.hasData', 'has data') : t('worldvaultedit.cell.empty', 'empty');
        const label = `${formatChunk({ cx, cz })} — ${state}${selected ? `, ${t('worldvaultedit.cell.selected', 'selected')}` : ''}`;
        button.setAttribute('aria-label', label);
        button.title = label;
      }
    }
  }

  function renderSelectionSummary(): void {
    const count = selection.size;
    const bounds = boundsOf(selection);
    if (count === 0) {
      selectionSummary.textContent = t('worldvaultedit.selection.none', 'No chunks selected.');
    } else if (count === 1 && bounds) {
      selectionSummary.textContent = t('worldvaultedit.selection.one', 'Chunk {chunk} selected.', {
        chunk: formatChunk({ cx: bounds.minCx, cz: bounds.minCz })
      });
      if (destX.get() === '') destX.set(String(bounds.minCx));
      if (destZ.get() === '') destZ.set(String(bounds.minCz));
    } else if (bounds) {
      selectionSummary.textContent = t(
        'worldvaultedit.selection.many',
        '{count} chunks selected, from {min} to {max}.',
        { count: formatNumber(count), min: formatChunk({ cx: bounds.minCx, cz: bounds.minCz }), max: formatChunk({ cx: bounds.maxCx, cz: bounds.maxCz }) }
      );
    }
    copyError.textContent = '';
    updateActionAvailability();
  }

  /* ---------------- permissions ---------------- */

  async function checkAccess(relativePath: string): Promise<WorldVaultPermission> {
    const result = await requestRegionAccess(ctx.studio, worldDirectory, relativePath);
    if (!result.ok) return { granted: false, reason: result.error };
    return result.value;
  }

  /* ---------------- copy ---------------- */

  async function performCopy(anchorEl: HTMLElement): Promise<void> {
    copyError.textContent = '';
    if (running) return;
    const bounds = boundsOf(selection);
    if (!bounds) return;
    const destinationCx = Math.trunc(Number(destX.get()));
    const destinationCz = Math.trunc(Number(destZ.get()));
    if (!Number.isFinite(destinationCx) || !Number.isFinite(destinationCz)) {
      copyError.textContent = t('worldvaultedit.error.destination', 'Enter whole-number destination coordinates. Nothing was changed.');
      return;
    }
    const deltaCx = destinationCx - bounds.minCx;
    const deltaCz = destinationCz - bounds.minCz;
    if (deltaCx === 0 && deltaCz === 0) {
      copyError.textContent = t('worldvaultedit.error.sameDestination', 'That is where the selection already is. Choose a different destination.');
      return;
    }

    const chunks = selectionToChunks(selection);
    if (chunks.length > MAX_SELECTION_CHUNKS) {
      copyError.textContent = t('worldvaultedit.reason.tooLarge', 'The selection has {count} chunks, past the {max}-chunk bound.', {
        count: formatNumber(chunks.length),
        max: formatNumber(MAX_SELECTION_CHUNKS)
      });
      return;
    }

    const dimSub = currentDimensionSubpath();
    const pairs = chunks.map((source) => ({ source, destination: { cx: source.cx + deltaCx, cz: source.cz + deltaCz } }));

    // Which destinations already have data — every one of those is an overwrite.
    const destRegions = new Set<string>();
    for (const pair of pairs) destRegions.add(regionKeyFor(chunkToRegion(pair.destination.cx, pair.destination.cz).rx, chunkToRegion(pair.destination.cx, pair.destination.cz).rz));
    await Promise.all(
      [...destRegions].map(async (key) => {
        if (occupancyCache.has(key)) return;
        const [rx, rz] = key.split(',').map(Number);
        const occupancy = await readRegionOccupancy(ctx.studio, regionAbsolutePath(worldDirectory, dimSub, 'region', rx, rz), rx, rz);
        occupancyCache.set(key, occupancy);
      })
    );
    const overwritten = pairs.filter((pair) => isOccupied(pair.destination.cx, pair.destination.cz));

    const affected = pairs.map((pair) => `${formatChunk(pair.source)} → ${formatChunk(pair.destination)}`);
    const irreversible =
      overwritten.length > 0
        ? t(
            'worldvaultedit.confirm.copy.overwrite',
            'Every destination chunk already containing data will be replaced ({count} of {total}). This is recorded as a commit, so it can be undone from the World vault tab, but nothing here undoes it automatically.',
            { count: overwritten.length, total: pairs.length }
          )
        : t(
            'worldvaultedit.confirm.copy.body',
            'Each source chunk’s own coordinates and every block entity and entity position inside it are rewritten to the new location. This is recorded as a commit, so it can be undone from the World vault tab.'
          );

    const approved = await ctx.confirm.request({
      action: t('worldvaultedit.confirm.copy.action', 'Copy {count} chunk(s), offset by ({dx}, {dz})', {
        count: pairs.length,
        dx: deltaCx,
        dz: deltaCz
      }),
      affected: capAffected(affected),
      irreversible,
      anchor: anchorEl
    });
    if (!approved) return;

    // Permission check: every source and destination region/entities file involved.
    const relPaths = new Set<string>();
    for (const pair of pairs) {
      const sourceRegion = chunkToRegion(pair.source.cx, pair.source.cz);
      const destRegion = chunkToRegion(pair.destination.cx, pair.destination.cz);
      relPaths.add(regionRelativePath(dimSub, 'region', sourceRegion.rx, sourceRegion.rz));
      relPaths.add(regionRelativePath(dimSub, 'entities', sourceRegion.rx, sourceRegion.rz));
      relPaths.add(regionRelativePath(dimSub, 'region', destRegion.rx, destRegion.rz));
      relPaths.add(regionRelativePath(dimSub, 'entities', destRegion.rx, destRegion.rz));
    }
    const permissionFailure = await refuseIfAnyDenied([...relPaths]);
    if (permissionFailure) {
      copyError.textContent = permissionFailure;
      ctx.notify.error(t('worldvaultedit.tab', 'Chunk operations'), permissionFailure);
      return;
    }

    running = true;
    updateActionAvailability();
    copyButton.disabled = true;
    progress.root.hidden = false;
    progress.set(0);

    let succeeded = 0;
    const failures: string[] = [];
    for (let index = 0; index < pairs.length; index += 1) {
      const pair = pairs[index];
      const sourceRegion = chunkToRegion(pair.source.cx, pair.source.cz);
      const destRegion = chunkToRegion(pair.destination.cx, pair.destination.cz);
      const result = await runOperation(ctx.studio, {
        kind: 'copy',
        sourceRegionPath: regionAbsolutePath(worldDirectory, dimSub, 'region', sourceRegion.rx, sourceRegion.rz),
        sourceEntitiesPath: regionAbsolutePath(worldDirectory, dimSub, 'entities', sourceRegion.rx, sourceRegion.rz),
        source: pair.source,
        destRegionPath: regionAbsolutePath(worldDirectory, dimSub, 'region', destRegion.rx, destRegion.rz),
        destEntitiesPath: regionAbsolutePath(worldDirectory, dimSub, 'entities', destRegion.rx, destRegion.rz),
        destination: pair.destination
      });
      if (result.ok) succeeded += 1;
      else failures.push(`${formatChunk(pair.source)} → ${formatChunk(pair.destination)}: ${result.error ?? 'unknown error'}`);
      progress.set(((index + 1) / pairs.length) * 100);
    }

    progress.root.hidden = true;
    running = false;
    copyButton.disabled = false;
    updateActionAvailability();
    occupancyCache.clear();
    void refreshOccupancyForPage(false);

    await finishOperation('copy', pairs.filter((_pair, index) => index < succeeded || failures.length === 0), [], succeeded, failures, pairs.length);
  }

  /* ---------------- remove ---------------- */

  async function performRemove(anchorEl: HTMLElement): Promise<void> {
    if (running) return;
    const chunks = selectionToChunks(selection);
    if (chunks.length === 0) return;
    if (chunks.length > MAX_SELECTION_CHUNKS) {
      copyError.textContent = t('worldvaultedit.reason.tooLarge', 'The selection has {count} chunks, past the {max}-chunk bound.', {
        count: formatNumber(chunks.length),
        max: formatNumber(MAX_SELECTION_CHUNKS)
      });
      return;
    }
    const dimSub = currentDimensionSubpath();
    const affected = chunks.map((pos) => formatChunk(pos));

    const approved = await ctx.confirm.request({
      action: t('worldvaultedit.confirm.remove.action', 'Remove {count} chunk(s)', { count: chunks.length }),
      affected: capAffected(affected),
      irreversible: t(
        'worldvaultedit.confirm.remove.body',
        'Every listed chunk’s entry is cleared, so the game treats it as absent and regenerates it the next time it is loaded. Anything built there is gone from the saved world. This is recorded as a commit, so it can be undone from the World vault tab.'
      ),
      anchor: anchorEl
    });
    if (!approved) return;

    const byRegion = new Map<string, { rx: number; rz: number; chunks: ChunkPos[] }>();
    for (const pos of chunks) {
      const { rx, rz } = chunkToRegion(pos.cx, pos.cz);
      const key = regionKeyFor(rx, rz);
      const existing = byRegion.get(key);
      if (existing) existing.chunks.push(pos);
      else byRegion.set(key, { rx, rz, chunks: [pos] });
    }

    const relPaths: string[] = [];
    for (const group of byRegion.values()) {
      relPaths.push(regionRelativePath(dimSub, 'region', group.rx, group.rz));
      relPaths.push(regionRelativePath(dimSub, 'entities', group.rx, group.rz));
    }
    const permissionFailure = await refuseIfAnyDenied(relPaths);
    if (permissionFailure) {
      copyError.textContent = permissionFailure;
      ctx.notify.error(t('worldvaultedit.tab', 'Chunk operations'), permissionFailure);
      return;
    }

    running = true;
    updateActionAvailability();
    removeButton.disabled = true;
    progress.root.hidden = false;
    progress.set(0);

    let succeeded = 0;
    const failures: string[] = [];
    let removedTotal: ChunkPos[] = [];
    const groups = [...byRegion.values()];
    for (let index = 0; index < groups.length; index += 1) {
      const group = groups[index];
      const result = await runOperation(ctx.studio, {
        kind: 'remove',
        regionPath: regionAbsolutePath(worldDirectory, dimSub, 'region', group.rx, group.rz),
        entitiesPath: regionAbsolutePath(worldDirectory, dimSub, 'entities', group.rx, group.rz),
        chunks: group.chunks
      });
      if (result.ok) {
        succeeded += group.chunks.length;
        removedTotal = removedTotal.concat(group.chunks);
      } else {
        failures.push(`${t('worldvaultedit.region', 'region')} (${String(group.rx)}, ${String(group.rz)}): ${result.error ?? 'unknown error'}`);
      }
      progress.set(((index + 1) / groups.length) * 100);
    }

    progress.root.hidden = true;
    running = false;
    removeButton.disabled = false;
    updateActionAvailability();
    occupancyCache.clear();
    void refreshOccupancyForPage(false);

    await finishOperation('remove', [], removedTotal, succeeded, failures, chunks.length);
  }

  /* ---------------- shared finish path ---------------- */

  async function refuseIfAnyDenied(relPaths: string[]): Promise<string | null> {
    for (const relPath of relPaths) {
      const permission = await checkAccess(relPath);
      if (!permission.granted) {
        return permission.reason ?? t('worldvaultedit.error.permissionDenied', 'Access to {region} was refused.', { region: relPath });
      }
    }
    return null;
  }

  function capAffected(lines: string[]): string[] {
    if (lines.length <= MAX_CONFIRM_ITEMS) return lines;
    const shown = lines.slice(0, MAX_CONFIRM_ITEMS);
    shown.push(t('worldvaultedit.confirm.andMore', '…and {count} more', { count: lines.length - MAX_CONFIRM_ITEMS }));
    return shown;
  }

  async function finishOperation(
    kind: 'copy' | 'remove',
    pairs: Array<{ source: ChunkPos; destination: ChunkPos }>,
    removed: ChunkPos[],
    succeeded: number,
    failures: string[],
    total: number
  ): Promise<void> {
    let commitId: string | null = null;
    if (succeeded > 0 && worldDirectory !== '') {
      const message =
        kind === 'copy'
          ? `Copied ${String(succeeded)} chunk(s) in the world vault edit grid`
          : `Removed ${String(succeeded)} chunk(s) in the world vault edit grid`;
      const commitResult = await commitEdit(ctx.studio, worldDirectory, message);
      if (commitResult.ok && commitResult.value) commitId = commitResult.value.shortHash;
    }

    const entry: EditLogEntry = {
      id: newLogId(),
      kind,
      dimension,
      dimensionSubpath: currentDimensionSubpath(),
      pairs,
      removed,
      outcome: failures.length === 0 ? 'ok' : 'error',
      detail:
        failures.length === 0
          ? t('worldvaultedit.log.detail.ok', '{succeeded} of {total} chunks {verb}.', {
              succeeded,
              total,
              verb: kind === 'copy' ? t('worldvaultedit.log.copied', 'copied') : t('worldvaultedit.log.removed', 'removed')
            })
          : t('worldvaultedit.log.detail.partial', '{succeeded} of {total} succeeded; {failed} failed: {reasons}', {
              succeeded,
              total,
              failed: failures.length,
              reasons: failures.slice(0, 5).join('; ')
            }),
      commitId,
      createdAt: new Date().toISOString()
    };
    await log.add(entry);
    renderLog();
    await refreshVaultStatus();

    selection.clear();
    renderGrid();
    renderSelectionSummary();

    if (failures.length === 0) {
      ctx.notify.success(t('worldvaultedit.tab', 'Chunk operations'), entry.detail);
    } else {
      ctx.notify.warn(t('worldvaultedit.tab', 'Chunk operations'), entry.detail);
    }
  }

  /* ---------------- edit log rendering ---------------- */

  function filteredLog(): EditLogEntry[] {
    const query = logQuery;
    const all = log.all();
    if (!query) return all;
    return all.filter((entry) =>
      query.matches(`${entry.detail} ${entry.kind} ${entry.dimension} ${entry.commitId ?? ''}`)
    );
  }

  function renderLog(): void {
    const all = log.all();
    const matching = filteredLog();

    selectShownButton.querySelector('.md-btn__label')!.textContent = t('worldvaultedit.log.selectShown', 'Select the {count} shown', {
      count: formatNumber(matching.length)
    });
    selectAllLogButton.querySelector('.md-btn__label')!.textContent = t('worldvaultedit.log.selectAll', 'Select every entry ({count})', {
      count: formatNumber(all.length)
    });
    const selectedCount = [...logSelection].filter((id) => all.some((entry) => entry.id === id)).length;
    logSummary.textContent = `${t('worldvaultedit.log.count', '{shown} of {total} entries shown', {
      shown: formatNumber(matching.length),
      total: formatNumber(all.length)
    })} · ${t('worldvaultedit.log.selected', '{count} selected', { count: formatNumber(selectedCount) })}`;

    const nothingSelected = selectedCount === 0;
    const reason = t('worldvaultedit.log.nothingSelected', 'Select at least one entry first');
    for (const control of [exportLogButton, deleteLogButton]) {
      control.disabled = nothingSelected;
      if (nothingSelected) {
        control.title = reason;
        control.setAttribute('aria-description', reason);
      } else {
        control.removeAttribute('title');
        control.removeAttribute('aria-description');
      }
    }

    logListHost.textContent = '';
    if (all.length === 0) {
      logListHost.append(
        ctx.components.emptyState({
          title: t('worldvaultedit.log.none.title', 'No edits recorded yet'),
          body: t('worldvaultedit.log.none.body', 'Copy or remove a chunk above and it appears here, with a link to the exact vault commit it produced.')
        })
      );
      return;
    }
    if (matching.length === 0) {
      logListHost.append(
        ctx.components.emptyState({
          title: t('worldvaultedit.log.empty.title', 'Nothing matched'),
          body: t('worldvaultedit.log.empty.body', 'No log entry matched the current search. Clearing the field brings all of them back.'),
          action: { label: 'core.action.clear', variant: 'text', onClick: () => logSearch.clear() }
        })
      );
      return;
    }

    const list = ctx.components.list({ label: 'worldvaultedit.log.title' });
    logListHost.append(list);
    for (const entry of matching) list.append(logRow(entry));
  }

  function logRow(entry: EditLogEntry): HTMLElement {
    const row = el('li', { className: 'wve-log-row' });
    row.dataset.appearanceId = 'worldvaultedit.logRow';
    row.setAttribute('aria-selected', String(logSelection.has(entry.id)));

    const checkbox = ctx.components.checkbox({
      label: entry.detail,
      checked: logSelection.has(entry.id),
      onChange: (checked) => {
        if (checked) logSelection.add(entry.id);
        else logSelection.delete(entry.id);
        renderLog();
      }
    });
    checkbox.root.classList.add('wve-log-row__select');
    row.append(checkbox.root);

    const badge = ctx.components.badge({
      label: entry.kind === 'copy' ? t('worldvaultedit.log.badge.copy', 'copy') : t('worldvaultedit.log.badge.remove', 'remove'),
      severity: entry.outcome === 'ok' ? 'success' : 'warning'
    });
    row.append(badge);

    const detail = el('span', { className: 'md-typescale-body-medium wve-log-row__detail', text: entry.detail });
    row.append(detail);

    const meta = el('span', {
      className: 'md-typescale-body-small wve-log-row__meta',
      text: `${formatTimestamp(entry.createdAt)}${entry.commitId ? ` · ${entry.commitId}` : ''}`
    });
    row.append(meta);

    return row;
  }

  async function exportLog(): Promise<void> {
    const ids = new Set(logSelection);
    const rows = log
      .all()
      .filter((entry) => ids.has(entry.id))
      .map((entry) => ({
        id: entry.id,
        kind: entry.kind,
        dimension: entry.dimension,
        detail: entry.detail,
        outcome: entry.outcome,
        commitId: entry.commitId ?? '',
        createdAt: entry.createdAt,
        chunkCount: entry.kind === 'copy' ? entry.pairs.length : entry.removed.length
      }));
    if (rows.length === 0) return;
    const preflight = ctx.exporter.preflight(rows, exportFormat);
    if (preflight.losses.length > 0) {
      ctx.notify.warn(
        t('worldvaultedit.log.export', 'Export the edit log'),
        t('worldvaultedit.export.losses', 'This format cannot carry: {fields}', {
          fields: preflight.losses.map((loss) => `${loss.field} (${loss.reason})`).join('; ')
        })
      );
    }
    const path = await ctx.exporter.save(rows, exportFormat, {
      name: 'world-vault-edit-log',
      defaultFileName: `world-vault-edit-log.${exportFormat === 'markdown' ? 'md' : exportFormat}`
    });
    if (path) ctx.notify.success(t('worldvaultedit.log.export', 'Export the edit log'), t('worldvaultedit.export.saved', 'Saved to {path}', { path }));
  }

  async function deleteLogEntries(anchorEl: HTMLElement): Promise<void> {
    const ids = [...logSelection];
    if (ids.length === 0) return;
    const chosen = log.all().filter((entry) => ids.includes(entry.id));
    const approved = await ctx.confirm.request({
      action: t('worldvaultedit.confirm.deleteLog.action', 'Remove {count} entries from this log', { count: chosen.length }),
      affected: capAffected(chosen.map((entry) => entry.detail)),
      irreversible: t(
        'worldvaultedit.confirm.deleteLog.body',
        'This only clears the entries from this panel’s own log. It does not touch the world, and it does not undo the vault commits those edits already made.'
      ),
      anchor: anchorEl
    });
    if (!approved) return;
    const removedCount = await log.remove(ids);
    logSelection.clear();
    renderLog();
    ctx.notify.success(t('worldvaultedit.log.title', 'Edit log'), t('worldvaultedit.log.deleted', '{count} entries removed', { count: removedCount }));
  }

  /* ================================================================ */
  /* Wiring                                                             */
  /* ================================================================ */

  buildGridOnce();
  gotoX.set(String(pageOrigin.cx));
  gotoZ.set(String(pageOrigin.cz));

  const stopActiveWorld = subscribeActiveWorldPath((path) => {
    if (worldDirectory !== '' || !path) return;
    worldDirectory = path;
    worldField.set(path);
    ctx.settings.set(SETTING_WORLD_DIRECTORY, path);
    void refreshVaultStatus();
    void refreshOccupancyForPage(false);
  });

  const stopVaultEvents =
    worldDirectory !== ''
      ? subscribeVaultEvents(ctx.studio, worldDirectory, () => {
          void refreshVaultStatus();
        })
      : (): void => undefined;

  const stopLog = log.onChange(() => renderLog());

  ctx.onDispose(() => {
    stopActiveWorld();
    stopVaultEvents();
    stopLog();
    logSearch.destroy();
  });

  void refreshVaultStatus();
  void refreshOccupancyForPage(false);
  renderGrid();
  renderSelectionSummary();
  renderLog();
}
