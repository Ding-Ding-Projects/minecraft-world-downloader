/**
 * The Worldlens tab: desktop-application state, headless-renderer state, the
 * list of downloaded worlds, and the render-and-serve controls that drive
 * `runner.ts`.
 *
 * State that must survive the tab being closed — the running renderer, the
 * cached detection results — lives in `WorldlensState`, created once in this
 * feature's `init` and shared by every mount. The DOM built here is rebuilt
 * fresh each time the tab opens; `WorldlensState` is not.
 */

import { el } from '../../core/a11y';
import type {
  AppContext,
  DataTableHandle,
  MenuItem,
  SearchBarHandle,
  SearchQuery,
  TabContext
} from '../../core/registry';
import type { RenderPlan } from './config';
import { detectDesktop, suggestRendererPaths, validateDesktopExecutable, validateRenderer } from './detect';
import type { DesktopState, RendererState } from './detect';
import {
  WORLDLENS_RELEASES_URL,
  WORLDLENS_SITE_URL,
  supportedRangeText
} from './probe';
import { RenderRunner, type RunState } from './runner';
import { DIMENSIONS, scanWorlds, worldExportRow } from './worlds';
import type { DimensionId, DiscoveredWorld, ScanState } from './worlds';

/* ================================================================== */
/* Setting ids                                                         */
/* ================================================================== */

export const DESKTOP_PATH_ID = 'worldlens.desktopPath';
export const RENDERER_PATH_ID = 'worldlens.rendererPath';
export const WORLDS_DIR_ID = 'worldlens.worldsDir';
export const OUTPUT_DIR_ID = 'worldlens.outputDir';
export const PORT_ID = 'worldlens.port';
export const THREADS_ID = 'worldlens.threads';
export const ACCEPT_DOWNLOAD_ID = 'worldlens.acceptDownload';
export const WATCH_ID = 'worldlens.watch';
export const FORCE_ID = 'worldlens.force';

const DEFAULT_PORT = 8100;
const DEFAULT_THREADS = 2;
const PAGE_SIZE = 50;

/* ================================================================== */
/* Shared state                                                        */
/* ================================================================== */

/**
 * Everything that must outlive one mounting of the tab.
 *
 * A render keeps running when the tab is closed — exactly like the download
 * itself does — so the runner, and the last probe results, live here rather
 * than in `mount`'s closure.
 */
export class WorldlensState {
  desktop: DesktopState = { kind: 'not-installed', searched: [] };
  renderer: RendererState = { kind: 'unconfigured' };
  worldsScan: ScanState = { kind: 'unconfigured' };
  readonly runner: RenderRunner;
  private readonly listeners = new Set<() => void>();

  constructor(readonly ctx: AppContext) {
    this.runner = new RenderRunner(ctx.studio, (action, payload) => {
      void ctx.history.record(action, 'worldlens', payload);
    });
  }

  /** Called whenever `desktop`, `renderer` or `worldsScan` changes. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of [...this.listeners]) {
      try {
        listener();
      } catch {
        // One broken subscriber must not stop the others from being told.
      }
    }
  }

  async refreshDesktop(): Promise<void> {
    const override = this.ctx.settings.get<string>(DESKTOP_PATH_ID, '').trim();
    this.desktop = override !== '' ? await validateDesktopExecutable(this.ctx.studio, override) : await detectDesktop(this.ctx.studio);
    this.notify();
  }

  async refreshRenderer(): Promise<void> {
    const path = this.ctx.settings.get<string>(RENDERER_PATH_ID, '').trim();
    this.renderer = await validateRenderer(this.ctx.studio, path);
    this.notify();
  }

  async refreshWorlds(): Promise<void> {
    const directory = this.ctx.settings.get<string>(WORLDS_DIR_ID, '').trim();
    this.worldsScan = await scanWorlds(this.ctx.studio, directory);
    this.notify();
  }

  async refreshAll(): Promise<void> {
    await Promise.all([this.refreshDesktop(), this.refreshRenderer(), this.refreshWorlds()]);
  }

  /** Suggests a renderer path from a detected desktop install, when one is set. */
  async suggestRenderer(): Promise<string[]> {
    return suggestRendererPaths(this.ctx.studio, this.desktop);
  }
}

/* ================================================================== */
/* Small helpers                                                       */
/* ================================================================== */

function dimensionLabelKey(id: DimensionId): string {
  return `worldlens.dimension.${id.replace(/^minecraft:/, '')}`;
}

function dimensionLabel(ctx: AppContext, id: DimensionId): string {
  const found = DIMENSIONS.find((entry) => entry.id === id);
  return ctx.t(dimensionLabelKey(id), found ? found.label : id);
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

/* ================================================================== */
/* Mounting                                                             */
/* ================================================================== */

export function mountWorldlensTab(host: HTMLElement, ctx: TabContext, state: WorldlensState): () => void {
  const disposers: Array<() => void> = [];

  host.append(
    ctx.components.topAppBar({
      title: ctx.t('worldlens.tab', 'Worldlens'),
      subtitle: ctx.t('worldlens.tab.subtitle', 'Hand a downloaded world to the companion renderer.')
    })
  );

  const body = el('div', { className: 'worldlens-sections' });
  host.append(body);

  /* ---------------- desktop application ---------------- */

  const desktopSection = el('section', { className: 'worldlens-section', attrs: { id: 'worldlens-desktop-section' } });
  body.append(desktopSection);

  function redrawDesktop(): void {
    desktopSection.textContent = '';
    desktopSection.append(
      ctx.components.sectionHeading({
        title: ctx.t('worldlens.section.desktop', 'The Worldlens desktop application')
      })
    );

    const text = desktopStateText(ctx, state.desktop);
    const card = ctx.components.card();
    card.append(el('p', { className: 'md-typescale-body-medium', text }));
    desktopSection.append(card);

    const actions = el('div', { className: 'worldlens-actions' });
    actions.append(
      ctx.components.button({
        label: ctx.t('worldlens.action.detect', 'Detect Worldlens'),
        variant: 'tonal',
        icon: 'search',
        onClick: () => void detectAndNotify(state)
      }),
      ctx.components.button({
        label: ctx.t('worldlens.action.getWorldlens', 'Get Worldlens'),
        variant: 'text',
        icon: 'download',
        onClick: () => void ctx.studio.shell.openExternal(WORLDLENS_RELEASES_URL)
      })
    );
    desktopSection.append(actions);
  }

  /* ---------------- renderer ---------------- */

  const rendererSection = el('section', { className: 'worldlens-section', attrs: { id: 'worldlens-renderer-section' } });
  body.append(rendererSection);

  function redrawRenderer(): void {
    rendererSection.textContent = '';
    rendererSection.append(ctx.components.sectionHeading({ title: ctx.t('worldlens.section.renderer', 'The headless renderer') }));
    const card = ctx.components.card();
    card.append(el('p', { className: 'md-typescale-body-medium', text: rendererStateText(ctx, state.renderer) }));
    rendererSection.append(card);

    if (state.renderer.kind === 'unconfigured' && state.desktop.kind === 'installed') {
      rendererSection.append(
        ctx.components.button({
          label: ctx.t('worldlens.action.useSuggestedRenderer', 'Use the renderer bundled with Worldlens'),
          variant: 'tonal',
          icon: 'search',
          onClick: () => void useSuggestedRenderer()
        })
      );
    }
    refreshRunSection();
  }

  async function useSuggestedRenderer(): Promise<void> {
    const suggestions = await state.suggestRenderer();
    const chosen = suggestions[0];
    if (!chosen) {
      ctx.notify.warn(
        ctx.t('worldlens.action.useSuggestedRenderer', 'Use the renderer bundled with Worldlens'),
        ctx.t('worldlens.notify.noSuggestedRenderer', 'No renderer was found inside the installed Worldlens.')
      );
      return;
    }
    ctx.settings.set(RENDERER_PATH_ID, chosen);
    await state.refreshRenderer();
  }


  /* ---------------- worlds list ---------------- */

  const worldsSection = el('section', { className: 'worldlens-section', attrs: { id: 'worldlens-worlds-section' } });
  body.append(worldsSection);

  let filtered: DiscoveredWorld[] = [];
  let page = 0;
  let query: SearchQuery | null = null;
  let table: DataTableHandle<DiscoveredWorld> | null = null;
  let search: SearchBarHandle | null = null;
  const summary = el('p', { className: 'md-typescale-body-small', attrs: { role: 'status', id: 'worldlens-selection-summary' } });
  const pagerInfo = el('p', { className: 'md-typescale-body-small' });

  function currentWorlds(): DiscoveredWorld[] {
    return state.worldsScan.kind === 'ready' ? state.worldsScan.worlds : [];
  }

  function applyFilter(): void {
    const worlds = currentWorlds();
    filtered = !query || query.text.trim() === '' ? worlds : worlds.filter((world) => query!.matches(worldHaystack(world)));
    if (page * PAGE_SIZE >= filtered.length) page = 0;
  }

  function pageRows(): DiscoveredWorld[] {
    return filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  }

  function selectedWorld(): DiscoveredWorld | null {
    if (!table) return null;
    const ids = table.selection();
    if (ids.length !== 1) return null;
    return currentWorlds().find((world) => world.id === ids[0]) ?? null;
  }

  function updateSummary(): void {
    const count = table ? table.selection().length : 0;
    summary.textContent = ctx.t('worldlens.selection.count', '{count} selected', { values: { count } });
    pagerInfo.textContent =
      filtered.length === 0
        ? ''
        : `${String(page * PAGE_SIZE + 1)}–${String(Math.min(filtered.length, (page + 1) * PAGE_SIZE))} / ${String(filtered.length)}`;
  }

  function redrawWorlds(): void {
    // Destroyed before the DOM is wiped: a search bar's own regex builder can
    // be an overlay anchored elsewhere in the document, and only `destroy()`
    // closes that popover rather than leaving it orphaned on screen.
    search?.destroy();
    search = null;
    table = null;
    worldsSection.textContent = '';
    worldsSection.append(ctx.components.sectionHeading({ title: ctx.t('worldlens.section.worlds', 'Downloaded worlds') }));

    const scan = state.worldsScan;
    if (scan.kind === 'unconfigured') {
      worldsSection.append(
        ctx.components.emptyState({
          title: ctx.t('worldlens.worlds.unconfigured', 'No worlds folder is set.'),
          body: ctx.t(
            'worldlens.worlds.unconfiguredBody',
            'Choose the folder your downloads are written to. A folder holding a level.dat is itself a world, and so is any folder of them.'
          )
        })
      );
      table = null;
      search = null;
      refreshRunSection();
      return;
    }
    if (scan.kind === 'missing') {
      worldsSection.append(
        ctx.components.emptyState({
          title: ctx.t('worldlens.worlds.missing', '{directory} does not exist.', { values: { directory: scan.directory } })
        })
      );
      table = null;
      search = null;
      refreshRunSection();
      return;
    }
    if (scan.kind === 'unreadable') {
      worldsSection.append(
        ctx.components.emptyState({
          title: ctx.t('worldlens.worlds.unreadable', '{directory} could not be read: {error}', {
            values: { directory: scan.directory, error: scan.error }
          })
        })
      );
      table = null;
      search = null;
      refreshRunSection();
      return;
    }
    if (scan.kind === 'empty') {
      worldsSection.append(
        ctx.components.emptyState({
          title: ctx.t('worldlens.worlds.empty', 'No worlds in {directory}.', { values: { directory: scan.directory } }),
          body: ctx.t('worldlens.worlds.emptyBody', '{inspected} folders were inspected and none held a level.dat.', {
            values: { inspected: scan.inspected }
          })
        })
      );
      table = null;
      search = null;
      refreshRunSection();
      return;
    }

    // scan.kind === 'ready'
    applyFilter();

    const searchHost = el('div', { attrs: { id: 'worldlens-worlds-search' } });
    search = ctx.createSearchBar({
      label: 'worldlens.search.worlds',
      sample: scan.worlds.map((world) => worldHaystack(world)).join('\n'),
      initialText: query?.text ?? '',
      onChange: (next) => {
        query = next;
        page = 0;
        applyFilter();
        table?.setRows(pageRows());
        updateSummary();
      }
    });
    searchHost.append(search.root);
    worldsSection.append(searchHost);

    if (scan.skipped > 0) {
      worldsSection.append(
        el('p', {
          className: 'md-typescale-body-small worldlens-muted',
          text: ctx.t('worldlens.worlds.skipped', '{skipped} folders were skipped because they hold no level.dat.', {
            values: { skipped: scan.skipped }
          })
        })
      );
    }

    const toolbar = el('div', { className: 'worldlens-toolbar' });
    const selectShownButton = ctx.components.button({
      label: '',
      variant: 'text',
      onClick: () => {
        const ids = new Set(table?.selection() ?? []);
        for (const world of pageRows()) ids.add(world.id);
        table?.setSelection([...ids]);
        updateSummary();
      }
    });
    const selectFoundButton = ctx.components.button({
      label: '',
      variant: 'text',
      onClick: () => {
        table?.setSelection(filtered.map((world) => world.id));
        updateSummary();
      }
    });
    const invertButton = ctx.components.button({
      label: ctx.t('worldlens.action.invertSelection', 'Invert the selection'),
      variant: 'text',
      onClick: () => {
        const current = new Set(table?.selection() ?? []);
        const filteredIds = new Set(filtered.map((world) => world.id));
        const outside = [...current].filter((id) => !filteredIds.has(id));
        const inverted = filtered.filter((world) => !current.has(world.id)).map((world) => world.id);
        table?.setSelection([...outside, ...inverted]);
        updateSummary();
      }
    });
    const clearButton = ctx.components.button({
      label: ctx.t('worldlens.action.clearSelection', 'Clear the selection'),
      variant: 'text',
      onClick: () => {
        table?.clearSelection();
        updateSummary();
      }
    });
    const rescanButton = ctx.components.button({
      label: ctx.t('worldlens.action.rescan', 'Rescan worlds'),
      variant: 'tonal',
      icon: 'refresh',
      onClick: () => void state.refreshWorlds()
    });
    const exportButton = ctx.components.button({
      label: ctx.t('worldlens.action.export', 'Export the world list'),
      variant: 'text',
      icon: 'download',
      onClick: () => void exportWorlds()
    });
    toolbar.append(selectShownButton, selectFoundButton, invertButton, clearButton, rescanButton, exportButton);
    worldsSection.append(toolbar, summary);

    table = ctx.components.dataTable<DiscoveredWorld>({
      label: ctx.t('worldlens.section.worlds', 'Downloaded worlds'),
      rows: pageRows(),
      rowId: (world) => world.id,
      selectable: true,
      emptyMessage: 'core.search.noMatches',
      onSelectionChange: () => {
        updateSummary();
        refreshRunSection();
      },
      columns: [
        {
          id: 'name',
          label: 'worldlens.column.name',
          sortable: true,
          value: (world) => world.displayName,
          render: (world) => {
            const wrap = el('div');
            wrap.append(el('span', { className: 'md-typescale-body-medium', text: world.displayName }));
            if (world.readError) {
              wrap.append(
                el('div', {
                  className: 'md-typescale-body-small worldlens-error-text',
                  text: ctx.t('worldlens.world.readError', 'level.dat could not be read: {error}', {
                    values: { error: world.readError }
                  })
                })
              );
            } else {
              wrap.append(el('div', { className: 'md-typescale-body-small worldlens-muted', text: world.folderName }));
            }
            return wrap;
          }
        },
        {
          id: 'version',
          label: 'worldlens.column.version',
          sortable: true,
          value: (world) => world.versionName ?? ''
        },
        {
          id: 'support',
          label: 'worldlens.column.support',
          sortable: true,
          value: (world) => world.support.kind,
          render: (world) => renderSupport(ctx, world)
        },
        {
          id: 'dimensions',
          label: 'worldlens.column.dimensions',
          value: (world) => world.dimensions.map((id) => dimensionLabel(ctx, id)).join(', ')
        },
        {
          id: 'regions',
          label: 'worldlens.column.regions',
          align: 'end',
          sortable: true,
          value: (world) => world.regionFiles
        },
        {
          id: 'actions',
          label: 'worldlens.column.actions',
          render: (world) => rowMenuButton(ctx, world)
        }
      ]
    });
    worldsSection.append(table.root);

    const pager = el('div', { className: 'worldlens-pager' });
    const prev = ctx.components.button({
      label: ctx.t('worldlens.action.previousPage', 'Previous page'),
      variant: 'text',
      icon: 'chevronLeft',
      onClick: () => {
        if (page === 0) return;
        page -= 1;
        table?.setRows(pageRows());
        updateSummary();
      }
    });
    const next = ctx.components.button({
      label: ctx.t('worldlens.action.nextPage', 'Next page'),
      variant: 'text',
      icon: 'chevronRight',
      onClick: () => {
        if ((page + 1) * PAGE_SIZE >= filtered.length) return;
        page += 1;
        table?.setRows(pageRows());
        updateSummary();
      }
    });
    pager.append(prev, pagerInfo, next);
    worldsSection.append(pager);

    selectShownButton.textContent = '';
    selectShownButton.append(
      document.createTextNode(
        ctx.t('worldlens.action.selectAllShown', 'Select the {count} worlds shown', { values: { count: pageRows().length } })
      )
    );
    selectFoundButton.textContent = '';
    selectFoundButton.append(
      document.createTextNode(
        ctx.t('worldlens.action.selectAllFound', 'Select all {count} worlds found', { values: { count: filtered.length } })
      )
    );

    updateSummary();
    refreshRunSection();
  }

  function worldHaystack(world: DiscoveredWorld): string {
    return [world.displayName, world.folderName, world.path, world.versionName ?? ''].join(' ');
  }

  function renderSupport(ctxInner: AppContext, world: DiscoveredWorld): HTMLElement {
    const wrap = el('div');
    const severity =
      world.support.kind === 'supported' ? 'success' : world.support.kind === 'unknown' ? 'info' : 'warning';
    const label =
      world.support.kind === 'supported'
        ? ctxInner.t('worldlens.support.supported', 'Supported')
        : world.support.kind === 'too-old'
          ? ctxInner.t('worldlens.support.tooOld', 'Older than {range}', { values: { range: supportedRangeText() } })
          : world.support.kind === 'too-new'
            ? ctxInner.t('worldlens.support.tooNew', 'Newer than {range}', { values: { range: supportedRangeText() } })
            : ctxInner.t('worldlens.support.unknown', 'Unknown');
    wrap.append(ctxInner.components.badge({ label, severity }));
    const support = world.support;
    if (support.kind === 'too-old' || support.kind === 'too-new') {
      const explainKey = support.kind === 'too-old' ? 'worldlens.support.explainOld' : 'worldlens.support.explainNew';
      wrap.append(
        el('p', {
          className: 'md-typescale-body-small worldlens-muted worldlens-explain',
          text: ctxInner.t(explainKey, '', {
            values: { world: world.displayName, version: support.version, range: supportedRangeText() }
          })
        })
      );
    } else if (support.kind === 'unknown') {
      wrap.append(
        el('p', {
          className: 'md-typescale-body-small worldlens-muted worldlens-explain',
          text: ctxInner.t('worldlens.support.explainUnknown', '', {
            values: { world: world.displayName, reason: support.reason }
          })
        })
      );
    }
    return wrap;
  }

  function rowMenuButton(ctxInner: AppContext, world: DiscoveredWorld): HTMLElement {
    const button = ctxInner.components.iconButton({
      icon: 'more',
      label: `${ctxInner.t('worldlens.action.rowMenu', 'Actions for this world')} — ${world.displayName}`,
      variant: 'standard',
      onClick: (event) => {
        const items: MenuItem[] = [
          {
            id: 'open',
            label: ctxInner.t('worldlens.action.openWorld', 'Open this world in Worldlens'),
            icon: 'world',
            run: () => void handoff(world)
          },
          {
            id: 'reveal',
            label: ctxInner.t('worldlens.action.reveal', 'Show the world folder'),
            icon: 'folder',
            run: () => void ctxInner.studio.shell.openPath(world.path)
          },
          {
            id: 'copy',
            label: ctxInner.t('worldlens.action.copyPath', 'Copy the world path'),
            icon: 'copy',
            separatorBefore: true,
            run: () => void copyPath(world)
          }
        ];
        ctxInner.components.menu({ anchor: event.currentTarget as HTMLElement, items });
      }
    });
    return button;
  }

  async function copyPath(world: DiscoveredWorld): Promise<void> {
    try {
      await navigator.clipboard.writeText(world.path);
      ctx.notify.success(ctx.t('worldlens.notify.copied', 'The world path is on the clipboard.'));
    } catch (error) {
      ctx.notify.error(
        ctx.t('worldlens.notify.copyFailed', 'The path could not be copied: {error}. It is {path}.', {
          values: { error: error instanceof Error ? error.message : String(error), path: world.path }
        })
      );
    }
  }

  async function handoff(world: DiscoveredWorld): Promise<void> {
    if (state.desktop.kind !== 'installed') {
      ctx.notify.error(
        ctx.t('worldlens.handoff.title', 'Worldlens is opening'),
        ctx.t(
          'worldlens.handoff.notInstalled',
          'Worldlens is not installed, so there is nothing to hand this world to. Install it from its releases page first.'
        )
      );
      return;
    }
    const executablePath = state.desktop.executablePath;
    let copied = true;
    try {
      await navigator.clipboard.writeText(world.path);
    } catch {
      copied = false;
    }
    const opened = await ctx.studio.shell.openPath(executablePath);
    if (!opened.ok) {
      ctx.notify.error(
        ctx.t('worldlens.handoff.title', 'Worldlens is opening'),
        ctx.t('worldlens.handoff.failed', 'Worldlens could not be started from {path}: {error}', {
          values: { path: executablePath, error: opened.error }
        })
      );
      return;
    }
    void ctx.history.record('Handed a world to Worldlens', 'worldlens', { world: world.path, executablePath });
    if (copied) {
      ctx.notify.info(
        ctx.t('worldlens.handoff.title', 'Worldlens is opening'),
        ctx.t(
          'worldlens.handoff.body',
          'Worldlens takes no world path on its command line, so it opens on its own start screen. The path has been copied to the clipboard: paste it into Worldlens’s own world picker. The world is {world}, at {path}.',
          { values: { world: world.displayName, path: world.path } }
        )
      );
    } else {
      ctx.notify.warn(
        ctx.t('worldlens.handoff.title', 'Worldlens is opening'),
        ctx.t(
          'worldlens.handoff.bodyCopyFailed',
          'Worldlens is opening, but the world path could not be copied to the clipboard: {error}. The world is {world}, at {path}.',
          { values: { world: world.displayName, path: world.path, error: 'the clipboard refused it' } }
        )
      );
    }
  }

  async function exportWorlds(): Promise<void> {
    const rows = filtered.map(worldExportRow);
    if (rows.length === 0) return;
    const preflight = ctx.exporter.preflight(rows, 'csv');
    const doSave = async (): Promise<void> => {
      const path = await ctx.exporter.save(rows, 'csv', { name: 'worldlens-worlds', defaultFileName: 'worldlens-worlds.csv' });
      if (path) {
        ctx.notify.success(ctx.t('worldlens.notify.exported', 'The world list was written to {path}.', { values: { path } }));
      }
    };
    if (preflight.losses.length > 0) {
      ctx.notify.show({
        title: ctx.t('worldlens.action.export', 'Export the world list'),
        body: ctx.t('worldlens.notify.exportLoss', '{format} cannot carry every field: {fields}. Nothing has been written yet.', {
          values: { format: 'CSV', fields: preflight.losses.map((loss) => loss.field).join(', ') }
        }),
        severity: 'warning',
        actions: [{ label: ctx.t('worldlens.action.export', 'Export the world list'), run: () => void doSave() }]
      });
      return;
    }
    await doSave();
  }

  /* ---------------- render and serve ---------------- */

  const runSection = el('section', { className: 'worldlens-section', attrs: { id: 'worldlens-run-section' } });
  body.append(runSection);

  const dimensionState = new Map<DimensionId, boolean>();
  let lastDimensionWorldId: string | null = null;
  let lastLoggedCount = 0;

  const statusText = el('p', { className: 'md-typescale-body-medium', attrs: { role: 'status' } });
  const progress = ctx.components.linearProgress({ label: ctx.t('worldlens.run.progress', 'Render progress') });
  const percentText = el('p', { className: 'md-typescale-body-small worldlens-muted' });
  const servingText = el('p', { className: 'md-typescale-body-medium' });
  const logHost = el('div', { className: 'worldlens-log', attrs: { role: 'log', 'aria-live': 'polite', 'aria-atomic': 'false' } });
  const dimensionsHost = el('div', { className: 'worldlens-dimensions' });

  const renderButton = ctx.components.button({
    label: ctx.t('worldlens.action.renderAndServe', 'Render and serve'),
    variant: 'filled',
    icon: 'play',
    onClick: () => void startRender()
  });
  const stopButton = ctx.components.button({
    label: ctx.t('worldlens.action.stop', 'Stop the renderer'),
    variant: 'text',
    icon: 'stop',
    danger: true,
    onClick: () => void state.runner.stop()
  });
  const openMapButton = ctx.components.button({
    label: ctx.t('worldlens.action.openMap', 'Open the map in the browser'),
    variant: 'tonal',
    icon: 'world',
    onClick: () => {
      const url = state.runner.snapshot().serving?.url;
      if (url) void ctx.studio.shell.openExternal(url);
    }
  });

  function buildDimensionCheckboxes(): void {
    dimensionsHost.textContent = '';
    dimensionsHost.append(
      el('p', { className: 'md-typescale-label-large', text: ctx.t('worldlens.run.dimensions', 'Dimensions to render') })
    );
    const world = selectedWorld();
    // Defaults are (re)seeded only when the selected world itself changes — a
    // deliberate uncheck must survive every later redraw of this same world,
    // including the one its own onChange handler triggers.
    if (world && world.id !== lastDimensionWorldId) {
      lastDimensionWorldId = world.id;
      for (const dimension of DIMENSIONS) dimensionState.set(dimension.id, world.dimensions.includes(dimension.id));
    } else if (!world) {
      lastDimensionWorldId = null;
    }
    for (const dimension of DIMENSIONS) {
      const present = world ? world.dimensions.includes(dimension.id) : false;
      const checkbox = ctx.components.checkbox({
        label: dimensionLabel(ctx, dimension.id),
        checked: dimensionState.get(dimension.id) === true && present,
        disabled: !present,
        disabledReason: present
          ? undefined
          : ctx.t('worldlens.run.dimensionAbsent', 'This world has no {dimension} save data.', {
              values: { dimension: dimensionLabel(ctx, dimension.id) }
            }),
        onChange: (checked) => {
          dimensionState.set(dimension.id, checked);
          refreshRunSection();
        }
      });
      dimensionsHost.append(checkbox.root);
    }
  }

  function checkedDimensions(): DimensionId[] {
    const world = selectedWorld();
    if (!world) return [];
    return DIMENSIONS.map((dimension) => dimension.id).filter(
      (id) => world.dimensions.includes(id) && dimensionState.get(id) === true
    );
  }

  async function startRender(): Promise<void> {
    const world = selectedWorld();
    if (!world) return;
    if (state.renderer.kind !== 'ready') return;
    const outputDirectory = ctx.settings.get<string>(OUTPUT_DIR_ID, '').trim();
    const plan: RenderPlan = {
      world,
      dimensions: checkedDimensions(),
      outputDirectory,
      port: Number(ctx.settings.get<number>(PORT_ID, DEFAULT_PORT)) || DEFAULT_PORT,
      threads: Number(ctx.settings.get<number>(THREADS_ID, DEFAULT_THREADS)) || DEFAULT_THREADS,
      acceptDownload: ctx.settings.get<boolean>(ACCEPT_DOWNLOAD_ID, false) === true,
      watch: ctx.settings.get<boolean>(WATCH_ID, false) === true,
      force: ctx.settings.get<boolean>(FORCE_ID, false) === true
    };
    const outcome = await state.runner.start(plan, ctx.settings.get<string>(RENDERER_PATH_ID, '').trim(), state.renderer.cliKind);
    if (!outcome.ok) {
      const message =
        outcome.refusal.kind === 'busy'
          ? ctx.t('worldlens.run.busy', 'A render is already running. Stop it before starting another.')
          : outcome.refusal.kind === 'no-renderer'
            ? ctx.t('worldlens.run.noRenderer', 'No headless renderer is set, so nothing can be rendered here.')
            : outcome.refusal.error;
      ctx.notify.error(ctx.t('worldlens.action.renderAndServe', 'Render and serve'), message);
    }
  }

  function runStatusText(run: RunState): string {
    switch (run.phase) {
      case 'idle':
        return ctx.t('worldlens.run.idle', 'Nothing is rendering.');
      case 'preparing':
        return ctx.t('worldlens.run.preparing', 'Writing the configuration for {world}.', {
          values: { world: run.plan?.world.displayName ?? '' }
        });
      case 'starting':
        return ctx.t('worldlens.run.starting', 'Starting the renderer.');
      case 'rendering':
      case 'watching':
        if (run.task) return ctx.t('worldlens.run.rendering', '{task}', { values: { task: run.task } });
        return ctx.t('worldlens.run.noPercentYet', 'The renderer has not reported a percentage yet.');
      case 'serving':
        return run.serving
          ? ctx.t('worldlens.run.serving', 'Serving {world} on {url}. This address is loopback: it is reachable from this computer only.', {
              values: { world: run.plan?.world.displayName ?? '', url: run.serving.url }
            })
          : ctx.t('worldlens.run.noPercentYet', 'The renderer has not reported a percentage yet.');
      case 'stopping':
        return ctx.t('worldlens.run.stopping', 'Stopping the renderer.');
      case 'finished':
        return ctx.t('worldlens.run.finished', 'The renderer finished and stopped. The output is in {output}.', {
          values: { output: run.plan?.outputDirectory ?? '' }
        });
      case 'cancelled':
        return ctx.t('worldlens.run.cancelled', 'The render was cancelled. Anything already written stays in {output}.', {
          values: { output: run.plan?.outputDirectory ?? '' }
        });
      case 'failed':
        return ctx.t('worldlens.run.failed', 'The render failed: {error}', { values: { error: run.error ?? '' } });
      default:
        return '';
    }
  }

  function refreshRunSection(): void {
    const run = state.runner.snapshot();
    buildDimensionCheckboxes();

    statusText.textContent = runStatusText(run);
    if (run.fraction !== null) {
      progress.set(run.fraction);
      percentText.textContent = `${String(Math.round(run.fraction * 100))}%${run.eta ? ` — ${run.eta}` : ''}`;
    } else {
      percentText.textContent = ctx.t('worldlens.run.noPercentYet', 'The renderer has not reported a percentage yet.');
    }

    if (run.serving) {
      servingText.hidden = false;
      servingText.textContent = ctx.t(
        run.phase === 'watching' ? 'worldlens.run.watching' : 'worldlens.run.serving',
        'Serving {world} on {url}.',
        { values: { world: run.plan?.world.displayName ?? '', url: run.serving.url } }
      );
      openMapButton.hidden = false;
    } else {
      servingText.hidden = true;
      openMapButton.hidden = true;
    }

    if (run.log.length < lastLoggedCount) {
      logHost.textContent = '';
      lastLoggedCount = 0;
    }
    for (let index = lastLoggedCount; index < run.log.length; index += 1) {
      logHost.append(el('p', { className: 'md-typescale-body-small worldlens-log-line', text: run.log[index] }));
    }
    lastLoggedCount = run.log.length;
    logHost.scrollTop = logHost.scrollHeight;

    const world = selectedWorld();
    const busy = state.runner.busy();
    stopButton.hidden = !busy;

    if (state.renderer.kind !== 'ready') {
      setDisabled(renderButton, true, ctx.t('worldlens.run.noRenderer', 'No headless renderer is set, so nothing can be rendered here.'));
    } else if (busy) {
      setDisabled(renderButton, true, ctx.t('worldlens.run.busy', 'A render is already running. Stop it before starting another.'));
    } else if (!world) {
      setDisabled(renderButton, true, ctx.t('worldlens.run.noSelection', 'Select exactly one world to render.'));
    } else if (checkedDimensions().length === 0) {
      setDisabled(renderButton, true, ctx.t('worldlens.run.noDimensions', 'Select at least one dimension to render.'));
    } else {
      setDisabled(renderButton, false, '');
    }
  }

  runSection.append(
    ctx.components.sectionHeading({ title: ctx.t('worldlens.section.run', 'Render and serve') }),
    dimensionsHost,
    el('div', { className: 'worldlens-actions', children: [renderButton, stopButton, openMapButton] }),
    statusText,
    progress.root,
    percentText,
    servingText,
    el('p', {
      className: 'md-typescale-body-small worldlens-muted',
      text: ctx.t(
        'worldlens.run.loopbackNote',
        'The map server is pinned to 127.0.0.1. No other machine can reach it, whatever the renderer’s own default would have been.'
      )
    }),
    el('p', { className: 'md-typescale-label-large', text: ctx.t('worldlens.run.log', 'Renderer output') }),
    logHost
  );

  const runnerUnsub = state.runner.subscribe(() => refreshRunSection());
  disposers.push(runnerUnsub);

  /* ---------------- wire it all up ---------------- */

  redrawDesktop();
  redrawRenderer();
  redrawWorlds();
  refreshRunSection();

  const stateUnsub = state.subscribe(() => {
    redrawDesktop();
    redrawRenderer();
    redrawWorlds();
  });
  disposers.push(stateUnsub);

  // The worlds directory can gain new downloads while the tab is closed, so
  // reopening it takes a fresh, cheap look rather than trusting a stale cache.
  void state.refreshWorlds();

  ctx.onDispose(() => {
    search?.destroy();
    for (const dispose of disposers) dispose();
  });

  return () => {
    search?.destroy();
    for (const dispose of disposers) dispose();
  };
}

/* ================================================================== */
/* State-to-text                                                       */
/* ================================================================== */

function desktopStateText(ctx: AppContext, desktopState: DesktopState): string {
  switch (desktopState.kind) {
    case 'installed':
      return desktopState.version
        ? ctx.t('worldlens.desktop.installed', 'Worldlens {version} is installed at {path}.', {
            values: { version: desktopState.version, path: desktopState.executablePath }
          })
        : ctx.t('worldlens.desktop.installedUnknownVersion', 'Worldlens is installed at {path}. Its version could not be read.', {
            values: { path: desktopState.executablePath }
          });
    case 'not-installed':
      return ctx.t('worldlens.desktop.notInstalled', 'Worldlens is not installed. Looked in: {searched}.', {
        values: { searched: desktopState.searched.join(', ') }
      });
    case 'unsupported-platform':
      return ctx.t('worldlens.desktop.unsupported', 'Worldlens ships a Windows installer. This is {platform}.', {
        values: { platform: desktopState.platform }
      });
    case 'unreadable':
      return ctx.t('worldlens.desktop.unreadable', 'The search for an installed Worldlens could not be completed: {error}', {
        values: { error: desktopState.error }
      });
    case 'invalid-choice':
      return ctx.t('worldlens.desktop.invalid', 'That path cannot be used: {error}', { values: { error: desktopState.error } });
    default:
      return '';
  }
}

function rendererStateText(ctx: AppContext, rendererState: RendererState): string {
  switch (rendererState.kind) {
    case 'unconfigured':
      return ctx.t(
        'worldlens.renderer.unconfigured',
        'No headless renderer is set. Choose the Worldlens command-line renderer to render a world here.'
      );
    case 'ready':
      return rendererState.version
        ? ctx.t('worldlens.renderer.ready', 'Ready: {path}, started with {command}. Reported version: {version}', {
            values: { path: rendererState.path, command: rendererState.command, version: rendererState.version }
          })
        : ctx.t('worldlens.renderer.readyNoVersion', 'Ready: {path}, started with {command}. Its version is unknown: {note}', {
            values: { path: rendererState.path, command: rendererState.command, note: rendererState.versionNote ?? '' }
          });
    case 'unrecognized':
      return ctx.t('worldlens.renderer.unrecognized', '{path} is neither a .jar nor a JavaScript entry point.', {
        values: { path: rendererState.path }
      });
    case 'invalid-choice':
      return ctx.t('worldlens.desktop.invalid', 'That path cannot be used: {error}', { values: { error: rendererState.error } });
    default:
      return '';
  }
}

/**
 * Re-detects the desktop application and the renderer, and reports the
 * outcome. Shared by the tab's own button, the settings action and the
 * palette command, so all three routes into the same probe behave identically.
 */
export async function detectAndNotify(state: WorldlensState): Promise<void> {
  await state.refreshDesktop();
  await state.refreshRenderer();
  const summary = `${desktopStateText(state.ctx, state.desktop)} ${rendererStateText(state.ctx, state.renderer)}`;
  state.ctx.notify.info(state.ctx.t('worldlens.notify.detected', 'Detection finished'), summary);
  state.ctx.a11y.announce(summary);
}

export { WORLDLENS_SITE_URL };
