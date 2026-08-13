/**
 * The live map destination.
 *
 * Three columns of behaviour: the viewport itself, the layer and position
 * controls beside it, and the marker list under those. Every one of them is
 * honest about what it does not have — an unconfigured folder, a folder with no
 * index, an index with no tiles and an index that would not parse are four
 * different states with four different recovery actions, rather than one blank
 * rectangle that could mean any of them.
 */

import { MapCanvas, type LayerFlags } from './canvas';
import { MarkerStore } from './markers';
import {
  CANVAS_ID,
  DEFAULT_REFRESH_SECONDS,
  DEFAULT_TILE_CACHE,
  HEIGHT_MAX,
  HEIGHT_MIN,
  JUMP_ID,
  LAYERS_ID,
  MARKERS_ID,
  MARKER_COLOURS,
  MAX_MARKERS,
  type MapMarker,
  type MarkerColour,
  READOUT_ID,
  RENDER_MODES,
  type RenderMode,
  SETTING_AUTO_REFRESH,
  SETTING_DEFAULT_MODE,
  SETTING_DIRECTORY,
  SETTING_FOLLOW_PLAYER,
  SETTING_LAYER_CROSSHAIR,
  SETTING_LAYER_MARKERS,
  SETTING_LAYER_PLAYER,
  SETTING_LAYER_REGION_GRID,
  SETTING_REFRESH_SECONDS,
  SETTING_SMOOTHING,
  SETTING_TILE_CACHE,
  STATUS_ID,
  STORE_CAMERA,
  WORLD_MAX,
  WORLD_MIN,
  type CameraState,
  clamp,
  defaultCamera,
  dimensionsOf,
  formatCoordinate,
  formatNumber,
  formatTimestamp,
  isRenderMode,
  markerToRecord,
  normaliseCamera,
  prettyDimension,
  tileCount,
  tilesFor
} from './model';
import { TileSource, type SourceStatus } from './source';
import { el, nextId } from '../../core/a11y';
import type { ExportFormat, SearchBarHandle, SearchQuery, TabContext } from '../../core/registry';

const ROWS_PER_PAGE = 60;

const EXPORT_FORMATS: ExportFormat[] = [
  'json',
  'jsonl',
  'yaml',
  'toml',
  'xml',
  'csv',
  'tsv',
  'markdown',
  'html',
  'sql'
];

export function mountMapTab(host: HTMLElement, ctx: TabContext): void {
  const t = (key: string, fallback: string, values?: Record<string, string | number>): string =>
    ctx.t(key, fallback, values ? { values } : undefined);

  /* ---------------- state ---------------- */

  const store = new MarkerStore(ctx.settings, ctx.history);
  const source = new TileSource(() => canvas.draw());

  let camera: CameraState = normaliseCamera(ctx.settings.get<unknown>(STORE_CAMERA, null)) ?? defaultCamera();
  if (camera.mode === 'normal' && !isRenderMode(String(ctx.settings.get(SETTING_DEFAULT_MODE, 'normal')))) {
    camera = { ...camera, mode: 'normal' };
  } else if (!normaliseCamera(ctx.settings.get<unknown>(STORE_CAMERA, null))) {
    const preferred = String(ctx.settings.get(SETTING_DEFAULT_MODE, 'normal'));
    camera = { ...camera, mode: isRenderMode(preferred) ? preferred : 'normal' };
  }

  let followPlayer = ctx.settings.get<boolean>(SETTING_FOLLOW_PLAYER, true) !== false;
  let lastPlayerKey = '';
  let markerSelection = new Set<string>();
  let markerQuery: SearchQuery | null = null;
  let markerPage = 0;
  let lastShiftClick = false;
  let lastToggledIndex = -1;
  let exportFormat: ExportFormat = 'json';
  let refreshTimer = 0;
  let dimensionSignature = '';

  /* ---------------- shell ---------------- */

  const root = el('div', { className: 'map-root' });
  root.dataset.appearanceId = 'map.root';
  host.append(root);

  const refreshButton = ctx.components.button({
    label: 'map.action.refreshNow',
    variant: 'tonal',
    icon: 'refresh',
    onClick: () => {
      void refresh(true);
    }
  });

  const revealButton = ctx.components.button({
    label: 'map.action.openFolder',
    variant: 'text',
    icon: 'folder',
    onClick: () => {
      void revealFolder();
    }
  });

  const chooseButton = ctx.components.button({
    label: 'map.action.chooseFolder',
    variant: 'text',
    icon: 'file',
    onClick: () => {
      void chooseFolder();
    }
  });

  root.append(
    ctx.components.topAppBar({
      title: 'map.tab',
      subtitle: 'map.tab.subtitle',
      actions: [refreshButton, revealButton, chooseButton]
    })
  );

  const layout = el('div', { className: 'map-layout' });
  root.append(layout);

  const stage = el('section', {
    className: 'map-stage',
    attrs: { 'aria-label': t('map.canvas.label', 'Map viewport') }
  });
  stage.dataset.appearanceId = 'map.stage';
  layout.append(stage);

  const statusLine = el('p', {
    className: 'map-status md-typescale-body-small',
    attrs: { role: 'status', 'aria-live': 'polite' }
  });
  statusLine.id = STATUS_ID;
  stage.append(statusLine);

  const stateHost = el('div', { className: 'map-state' });
  stage.append(stateHost);

  const canvasHolder = el('div', { className: 'map-canvas-holder' });
  canvasHolder.id = CANVAS_ID;
  stage.append(canvasHolder);

  const helpId = nextId('map-help');
  const helpText = el('p', {
    className: 'map-help md-typescale-body-small',
    text: t(
      'map.canvas.help',
      'Arrow keys pan, Shift and an arrow key pans one small step, plus and minus zoom, Page Up and Page Down zoom, Home returns to the origin. Drag to pan, scroll to zoom.'
    )
  });
  helpText.id = helpId;

  const canvas = new MapCanvas(
    source,
    {
      markers: () => visibleMarkersForCanvas(),
      layers: () => currentLayers(),
      meta: () => source.currentMeta(),
      reducedMotion: () => ctx.a11y.reducedMotion(),
      onPointer: (point) => {
        pointerValue.textContent =
          point === null
            ? t('map.readout.pointerNone', 'Pointer is not over the map')
            : `${formatCoordinate(point.x)}, ${formatCoordinate(point.z)}`;
      },
      onCamera: (next) => {
        camera = next;
        updateReadout();
      },
      onSettled: (next) => {
        ctx.settings.set(STORE_CAMERA, { ...next });
      },
      onManualMove: () => {
        if (!followPlayer) return;
        followPlayer = false;
        ctx.settings.set(SETTING_FOLLOW_PLAYER, false);
        followSwitch.set(false);
      }
    },
    camera
  );
  canvas.setAccessibleName(t('map.canvas.label', 'Map viewport'), helpId);
  canvasHolder.append(canvas.root);

  /* overlay: scale bar and pointer readout ------------------------- */

  const scaleBar = el('div', { className: 'map-scalebar' });
  const scaleBarLine = el('span', { className: 'map-scalebar__line', attrs: { 'aria-hidden': 'true' } });
  const scaleBarText = el('span', { className: 'map-scalebar__text md-typescale-label-small' });
  scaleBar.append(scaleBarLine, scaleBarText);
  canvasHolder.append(scaleBar);

  stage.append(helpText);

  /* ---------------- side column ---------------- */

  const side = el('div', { className: 'map-side' });
  layout.append(side);

  /* layers --------------------------------------------------------- */

  const layersCard = ctx.components.card({ variant: 'outlined' });
  layersCard.id = LAYERS_ID;
  layersCard.dataset.appearanceId = 'map.layers';
  layersCard.append(
    ctx.components.sectionHeading({ title: 'map.layers.title', description: 'map.layers.description' })
  );
  side.append(layersCard);

  const dimensionHolder = el('div', { className: 'map-field' });
  layersCard.append(dimensionHolder);

  const modeControl = ctx.components.segmentedButton({
    label: 'map.layers.mode',
    options: [
      { value: 'normal', label: 'map.mode.normal', icon: 'world' },
      { value: 'caves', label: 'map.mode.caves', icon: 'map' }
    ],
    value: camera.mode,
    onChange: (value) => {
      if (!isRenderMode(value)) return;
      canvas.setMode(value);
      canvas.draw();
      updateReadout();
    }
  });
  layersCard.append(labelledRow(t('map.layers.mode', 'Render mode'), modeControl.root));

  const followSwitch = ctx.components.switchControl({
    label: 'map.followPlayer',
    checked: followPlayer,
    onChange: (value) => {
      followPlayer = value;
      ctx.settings.set(SETTING_FOLLOW_PLAYER, value);
      if (value) centreOnPlayer(false);
    }
  });
  layersCard.append(followSwitch.root);

  const layerSwitches = new Map<string, ReturnType<typeof ctx.components.switchControl>>();
  for (const [settingId, labelKey] of [
    [SETTING_LAYER_MARKERS, 'map.layer.markers'],
    [SETTING_LAYER_PLAYER, 'map.layer.player'],
    [SETTING_LAYER_REGION_GRID, 'map.layer.regionGrid'],
    [SETTING_LAYER_CROSSHAIR, 'map.layer.crosshair'],
    [SETTING_SMOOTHING, 'map.smoothing']
  ] as const) {
    const control = ctx.components.switchControl({
      label: labelKey,
      checked: ctx.settings.get<boolean>(settingId, defaultLayerValue(settingId)) !== false,
      onChange: (value) => {
        ctx.settings.set(settingId, value);
        canvas.draw();
      }
    });
    layerSwitches.set(settingId, control);
    layersCard.append(control.root);
  }

  const autoRefreshSwitch = ctx.components.switchControl({
    label: 'map.autoRefresh',
    checked: ctx.settings.get<boolean>(SETTING_AUTO_REFRESH, true) !== false,
    onChange: (value) => {
      ctx.settings.set(SETTING_AUTO_REFRESH, value);
      scheduleRefresh();
    }
  });
  layersCard.append(autoRefreshSwitch.root);

  /* readout -------------------------------------------------------- */

  const readoutCard = ctx.components.card({ variant: 'outlined' });
  readoutCard.id = READOUT_ID;
  readoutCard.dataset.appearanceId = 'map.readout';
  readoutCard.append(ctx.components.sectionHeading({ title: 'map.readout.title' }));
  side.append(readoutCard);

  const pointerValue = el('span', {
    className: 'map-readout__value md-typescale-body-medium',
    text: t('map.readout.pointerNone', 'Pointer is not over the map')
  });
  const centreValue = el('span', { className: 'map-readout__value md-typescale-body-medium' });
  const zoomValue = el('span', { className: 'map-readout__value md-typescale-body-medium' });
  const playerValue = el('span', { className: 'map-readout__value md-typescale-body-medium' });

  readoutCard.append(
    readoutRow(t('map.readout.pointer', 'Pointer'), pointerValue),
    readoutRow(t('map.readout.centre', 'Centre'), centreValue),
    readoutRow(t('map.readout.zoom', 'Zoom'), zoomValue),
    readoutRow(t('map.readout.player', 'Player'), playerValue)
  );

  const viewActions = el('div', { className: 'map-actions' });
  viewActions.append(
    ctx.components.button({
      label: 'map.action.zoomIn',
      variant: 'outlined',
      icon: 'add',
      onClick: () => {
        canvas.zoomBy(1.25);
        canvas.focus();
      }
    }),
    ctx.components.button({
      label: 'map.action.zoomOut',
      variant: 'outlined',
      icon: 'remove',
      onClick: () => {
        canvas.zoomBy(1 / 1.25);
        canvas.focus();
      }
    }),
    ctx.components.button({
      label: 'map.action.centreOnTiles',
      variant: 'text',
      icon: 'world',
      onClick: () => centreOnTiles()
    }),
    ctx.components.button({
      label: 'map.action.resetView',
      variant: 'text',
      icon: 'home',
      onClick: () => {
        canvas.flyTo(0, 0, 0.5);
      }
    })
  );
  readoutCard.append(viewActions);

  /* jump ----------------------------------------------------------- */

  const jumpCard = ctx.components.card({ variant: 'outlined' });
  jumpCard.id = JUMP_ID;
  jumpCard.dataset.appearanceId = 'map.jump';
  jumpCard.append(ctx.components.sectionHeading({ title: 'map.jump.title', description: 'map.jump.description' }));
  side.append(jumpCard);

  const jumpX = ctx.components.textField({
    label: 'map.jump.x',
    type: 'number',
    value: String(Math.round(camera.x)),
    step: 1
  });
  const jumpZ = ctx.components.textField({
    label: 'map.jump.z',
    type: 'number',
    value: String(Math.round(camera.z)),
    step: 1
  });
  const jumpY = ctx.components.textField({
    label: 'map.jump.y',
    type: 'number',
    value: '64',
    step: 1
  });
  const jumpGrid = el('div', { className: 'map-jump__grid' });
  jumpGrid.append(jumpX.root, jumpZ.root, jumpY.root);
  jumpCard.append(jumpGrid);

  const jumpError = el('p', {
    className: 'map-jump__error md-typescale-body-small',
    attrs: { role: 'status', 'aria-live': 'polite' }
  });
  jumpCard.append(jumpError);

  const jumpPresets = el('div', { className: 'map-actions' });
  jumpPresets.append(
    ctx.components.button({
      label: 'map.jump.preset.player',
      variant: 'text',
      onClick: () => {
        const player = source.currentMeta().player;
        if (!player) {
          ctx.notify.warn(
            t('map.jump.title', 'Go to coordinates'),
            t('map.jump.noPlayer', 'The index has no player position to copy')
          );
          return;
        }
        jumpX.set(String(Math.round(player.x)));
        jumpY.set(String(Math.round(player.y)));
        jumpZ.set(String(Math.round(player.z)));
        jumpError.textContent = '';
      }
    }),
    ctx.components.button({
      label: 'map.jump.preset.origin',
      variant: 'text',
      onClick: () => {
        jumpX.set('0');
        jumpZ.set('0');
        jumpError.textContent = '';
      }
    }),
    ctx.components.button({
      label: 'map.jump.preset.tiles',
      variant: 'text',
      onClick: () => {
        const centre = tilesCentre();
        if (!centre) {
          ctx.notify.warn(
            t('map.jump.title', 'Go to coordinates'),
            t('map.jump.noTiles', 'There are no tiles to centre on yet')
          );
          return;
        }
        jumpX.set(String(Math.round(centre.x)));
        jumpZ.set(String(Math.round(centre.z)));
        jumpError.textContent = '';
      }
    })
  );
  jumpCard.append(jumpPresets);

  const jumpActions = el('div', { className: 'map-actions' });
  jumpActions.append(
    ctx.components.button({
      label: 'map.jump.go',
      variant: 'filled',
      icon: 'map',
      onClick: () => {
        const parsed = readJumpForm();
        if (!parsed) return;
        followPlayer = false;
        ctx.settings.set(SETTING_FOLLOW_PLAYER, false);
        followSwitch.set(false);
        canvas.flyTo(parsed.x, parsed.z);
        ctx.a11y.announce(
          t('map.jump.done', 'Centred on {x}, {z}', {
            x: formatCoordinate(parsed.x),
            z: formatCoordinate(parsed.z)
          })
        );
      }
    }),
    ctx.components.button({
      label: 'map.jump.goAndMark',
      variant: 'tonal',
      icon: 'pin',
      onClick: () => {
        const parsed = readJumpForm();
        if (!parsed) return;
        followPlayer = false;
        ctx.settings.set(SETTING_FOLLOW_PLAYER, false);
        followSwitch.set(false);
        canvas.flyTo(parsed.x, parsed.z);
        void addMarker(parsed.x, parsed.y, parsed.z);
      }
    })
  );
  jumpCard.append(jumpActions);

  /* markers -------------------------------------------------------- */

  const markersCard = ctx.components.card({ variant: 'outlined' });
  markersCard.id = MARKERS_ID;
  markersCard.dataset.appearanceId = 'map.markers';
  markersCard.append(
    ctx.components.sectionHeading({ title: 'map.markers.title', description: 'map.markers.description' })
  );
  layout.append(markersCard);

  const markerToolbar = el('div', { className: 'map-actions' });
  markersCard.append(markerToolbar);

  markerToolbar.append(
    ctx.components.button({
      label: 'map.markers.add',
      variant: 'filled',
      icon: 'add',
      onClick: () => {
        const state = canvas.state();
        void addMarker(Math.round(state.x), 64, Math.round(state.z));
      }
    })
  );

  const search: SearchBarHandle = ctx.createSearchBar({
    label: 'map.markers.search',
    sample: store
      .all()
      .map((marker) => marker.name)
      .join('\n'),
    onChange: (query) => {
      markerQuery = query;
      markerPage = 0;
      renderMarkers();
    }
  });
  markersCard.append(search.root);

  const selectionBar = el('div', { className: 'map-actions map-actions--wrap' });
  markersCard.append(selectionBar);

  const selectShownButton = ctx.components.button({
    label: t('map.markers.selectShown', 'Select the {count} shown', { count: 0 }),
    variant: 'outlined',
    onClick: () => {
      for (const marker of filteredMarkers()) markerSelection.add(marker.id);
      renderMarkers();
    }
  });
  const selectAllButton = ctx.components.button({
    label: t('map.markers.selectAll', 'Select every marker ({count})', { count: 0 }),
    variant: 'outlined',
    onClick: () => {
      for (const marker of store.all()) markerSelection.add(marker.id);
      renderMarkers();
    }
  });
  const invertButton = ctx.components.button({
    label: 'map.markers.invert',
    variant: 'outlined',
    onClick: () => {
      const next = new Set<string>();
      for (const marker of store.all()) if (!markerSelection.has(marker.id)) next.add(marker.id);
      markerSelection = next;
      renderMarkers();
    }
  });
  const clearSelectionButton = ctx.components.button({
    label: 'map.markers.clearSelection',
    variant: 'text',
    onClick: () => {
      markerSelection.clear();
      renderMarkers();
    }
  });
  selectionBar.append(selectShownButton, selectAllButton, invertButton, clearSelectionButton);

  const bulkBar = el('div', { className: 'map-actions map-actions--wrap' });
  markersCard.append(bulkBar);

  const showButton = ctx.components.button({
    label: 'map.markers.show',
    variant: 'text',
    icon: 'visibility',
    onClick: () => {
      void bulkVisibility(true);
    }
  });
  const hideButton = ctx.components.button({
    label: 'map.markers.hide',
    variant: 'text',
    icon: 'visibility',
    onClick: () => {
      void bulkVisibility(false);
    }
  });
  const deleteButton = ctx.components.button({
    label: 'map.markers.delete',
    variant: 'text',
    icon: 'trash',
    danger: true,
    onClick: (event) => {
      void bulkDelete(event.currentTarget as HTMLElement);
    }
  });
  const exportSelect = ctx.components.select({
    label: 'map.markers.format',
    options: EXPORT_FORMATS.map((format) => ({ value: format, label: format.toUpperCase() })),
    value: exportFormat,
    onChange: (value) => {
      exportFormat = EXPORT_FORMATS.includes(value as ExportFormat) ? (value as ExportFormat) : 'json';
    }
  });
  const exportButton = ctx.components.button({
    label: 'map.markers.export',
    variant: 'text',
    icon: 'download',
    onClick: () => {
      void exportMarkers();
    }
  });
  bulkBar.append(showButton, hideButton, deleteButton, exportSelect.root, exportButton);

  const selectionSummary = el('p', {
    className: 'map-markers__summary md-typescale-body-small',
    attrs: { role: 'status', 'aria-live': 'polite' }
  });
  markersCard.append(selectionSummary);

  const markerListHost = el('div', { className: 'map-markers__list' });
  markersCard.append(markerListHost);

  const pager = el('div', { className: 'map-actions' });
  markersCard.append(pager);

  const previousPageButton = ctx.components.button({
    label: 'core.action.previous',
    variant: 'text',
    icon: 'chevronLeft',
    onClick: () => {
      markerPage = Math.max(0, markerPage - 1);
      renderMarkers();
    }
  });
  const nextPageButton = ctx.components.button({
    label: 'core.action.next',
    variant: 'text',
    icon: 'chevronRight',
    onClick: () => {
      markerPage += 1;
      renderMarkers();
    }
  });
  const pageLabel = el('span', { className: 'map-markers__page md-typescale-body-small' });
  pager.append(previousPageButton, pageLabel, nextPageButton);

  /* ---------------- behaviour ---------------- */

  function defaultLayerValue(settingId: string): boolean {
    return settingId !== SETTING_LAYER_REGION_GRID;
  }

  function currentLayers(): LayerFlags {
    return {
      markers: ctx.settings.get<boolean>(SETTING_LAYER_MARKERS, true) !== false,
      player: ctx.settings.get<boolean>(SETTING_LAYER_PLAYER, true) !== false,
      regionGrid: ctx.settings.get<boolean>(SETTING_LAYER_REGION_GRID, false) === true,
      crosshair: ctx.settings.get<boolean>(SETTING_LAYER_CROSSHAIR, true) !== false,
      smoothing: ctx.settings.get<boolean>(SETTING_SMOOTHING, true) !== false
    };
  }

  function visibleMarkersForCanvas(): MapMarker[] {
    const dimension = canvas.state().dimension;
    if (dimension === '') return [];
    return store.forDimension(dimension).filter((marker) => marker.visible);
  }

  function labelledRow(text: string, control: HTMLElement): HTMLElement {
    const row = el('div', { className: 'map-field' });
    row.append(el('span', { className: 'md-typescale-label-medium', text }), control);
    return row;
  }

  function readoutRow(text: string, value: HTMLElement): HTMLElement {
    const row = el('div', { className: 'map-readout__row' });
    row.append(el('span', { className: 'map-readout__key md-typescale-label-medium', text }), value);
    return row;
  }

  function updateReadout(): void {
    const state = canvas.state();
    centreValue.textContent = `${formatCoordinate(state.x)}, ${formatCoordinate(state.z)}`;
    zoomValue.textContent = t('map.readout.zoomValue', '{pixels} pixels per block', {
      pixels: state.scale >= 1 ? state.scale.toFixed(1) : state.scale.toFixed(3)
    });

    const bar = canvas.scaleBar();
    scaleBarLine.style.width = `${Math.round(bar.pixels)}px`;
    scaleBarText.textContent = t('map.readout.scale', '{blocks} blocks', { blocks: formatNumber(bar.blocks) });

    const meta = source.currentMeta();
    if (!meta.player) {
      playerValue.textContent = t('map.readout.playerNone', 'The index has no player position');
    } else if (meta.currentDimension !== null && meta.currentDimension !== state.dimension) {
      playerValue.textContent = t('map.readout.playerElsewhere', 'The player is in {dimension}', {
        dimension: prettyDimension(meta.currentDimension)
      });
    } else {
      playerValue.textContent = `${formatCoordinate(meta.player.x)}, ${formatCoordinate(meta.player.y)}, ${formatCoordinate(meta.player.z)}`;
    }
  }

  function rebuildDimensionSelect(): void {
    const meta = source.currentMeta();
    const dimensions = dimensionsOf(meta);
    const signature = dimensions.join('|');
    if (signature === dimensionSignature) return;
    dimensionSignature = signature;
    dimensionHolder.textContent = '';

    if (dimensions.length === 0) {
      dimensionHolder.append(
        el('p', {
          className: 'md-typescale-body-small',
          text: t('map.layers.dimension.empty', 'No dimension has any tiles yet')
        })
      );
      return;
    }

    let selected = canvas.state().dimension;
    if (!dimensions.includes(selected)) {
      selected = meta.currentDimension && dimensions.includes(meta.currentDimension) ? meta.currentDimension : dimensions[0];
      canvas.setDimension(selected);
    }

    const control = ctx.components.select({
      label: 'map.layers.dimension',
      options: dimensions.map((dimension) => ({
        value: dimension,
        label: `${prettyDimension(dimension)} · ${dimension}`
      })),
      value: selected,
      onChange: (value) => {
        canvas.setDimension(value);
        canvas.draw();
        updateReadout();
        renderMarkers();
      }
    });
    dimensionHolder.append(control.root);
  }

  function describeStatus(status: SourceStatus): void {
    stateHost.textContent = '';
    const meta = source.currentMeta();
    const tiles = tileCount(meta);

    switch (status.kind) {
      case 'unconfigured':
        canvasHolder.hidden = true;
        statusLine.textContent = t('map.empty.noFolder.title', 'No world folder is chosen yet');
        stateHost.append(
          ctx.components.emptyState({
            title: t('map.empty.noFolder.title', 'No world folder is chosen yet'),
            body: t(
              'map.empty.noFolder.body',
              'The viewer reads region tiles the downloader has already written to disk. Choose the folder the downloader writes the world into and the map appears as soon as tiles exist there.'
            ),
            action: {
              label: 'map.action.chooseFolder',
              variant: 'filled',
              icon: 'folder',
              onClick: () => {
                void chooseFolder();
              }
            }
          })
        );
        return;

      case 'missing-directory':
        canvasHolder.hidden = true;
        statusLine.textContent = t('map.empty.missingFolder.title', 'That folder is not there');
        stateHost.append(
          ctx.components.emptyState({
            title: t('map.empty.missingFolder.title', 'That folder is not there'),
            body: t(
              'map.empty.missingFolder.body',
              '{path} does not exist, or is not a folder. Nothing has been deleted by this viewer; choose the folder again or restore it on disk.',
              { path: status.directory }
            ),
            action: {
              label: 'map.action.chooseFolder',
              variant: 'filled',
              icon: 'folder',
              onClick: () => {
                void chooseFolder();
              }
            }
          })
        );
        return;

      case 'missing-index':
        canvasHolder.hidden = true;
        statusLine.textContent = t('map.empty.noIndex.title', 'No map index in that folder');
        stateHost.append(
          ctx.components.emptyState({
            title: t('map.empty.noIndex.title', 'No map index in that folder'),
            body: t(
              'map.empty.noIndex.body',
              'Neither {first} nor {second} exists. The downloader writes that index only while overview rendering is on: it is on automatically in headless mode, can be forced with the render-map flag, and is switched off by the disable-map-render flag.',
              { first: status.looked[0] ?? '', second: status.looked[1] ?? '' }
            ),
            action: {
              label: 'map.action.refreshNow',
              variant: 'filled',
              icon: 'refresh',
              onClick: () => {
                void refresh(true);
              }
            }
          })
        );
        return;

      case 'unreadable':
        canvasHolder.hidden = true;
        statusLine.textContent = t('map.error.unreadable.title', 'The index could not be read');
        stateHost.append(
          ctx.components.emptyState({
            title: t('map.error.unreadable.title', 'The index could not be read'),
            body: t(
              'map.error.unreadable.body',
              '{path} exists but could not be read. The operating system reported: {error}',
              { path: status.path, error: status.error }
            ),
            action: {
              label: 'map.action.refreshNow',
              variant: 'filled',
              icon: 'refresh',
              onClick: () => {
                void refresh(true);
              }
            }
          })
        );
        return;

      case 'invalid':
        canvasHolder.hidden = true;
        statusLine.textContent = t('map.error.invalid.title', 'The index is not readable JSON');
        stateHost.append(
          ctx.components.emptyState({
            title: t('map.error.invalid.title', 'The index is not readable JSON'),
            body: t(
              'map.error.invalid.body',
              '{path} was read but could not be parsed: {error}. This usually means the renderer was writing the file at the moment it was read; refreshing again normally succeeds.',
              { path: status.path, error: status.error }
            ),
            action: {
              label: 'map.action.refreshNow',
              variant: 'filled',
              icon: 'refresh',
              onClick: () => {
                void refresh(true);
              }
            }
          })
        );
        return;

      case 'empty':
        canvasHolder.hidden = true;
        statusLine.textContent = t('map.status.waiting', 'No tiles have been written yet.');
        stateHost.append(
          ctx.components.emptyState({
            title: t('map.empty.noTiles.title', 'The index is there, but it lists no tiles'),
            body: t(
              'map.empty.noTiles.body',
              'The renderer has started but has not flushed a tile yet. Tiles are flushed about every three seconds and only for chunks that have actually been loaded, so connect through the proxy and explore, then refresh.'
            ),
            action: {
              label: 'map.action.refreshNow',
              variant: 'filled',
              icon: 'refresh',
              onClick: () => {
                void refresh(true);
              }
            }
          })
        );
        return;

      default: {
        canvasHolder.hidden = false;
        const parts = [
          t('map.status.live', '{tiles} tiles on disk', { tiles: formatNumber(tiles) }),
          t('map.status.updated', 'Index updated {time}', { time: formatTimestamp(meta.updated) }),
          t('map.status.folder', 'Reading from {path}', { path: source.resolvedDirectory() })
        ];
        statusLine.textContent = parts.join(' · ');
      }
    }
  }

  async function refresh(announce: boolean): Promise<void> {
    const outcome = await source.refresh();
    rebuildDimensionSelect();
    describeStatus(outcome.status);
    updateReadout();
    if (outcome.changed) canvas.draw();

    if (followPlayer) centreOnPlayer(true);

    if (announce && (outcome.status.kind === 'ready' || outcome.status.kind === 'empty')) {
      ctx.notify.info(
        t('map.tab', 'Live map'),
        t('map.notify.refreshed', 'Index re-read: {tiles} tiles', {
          tiles: formatNumber(tileCount(source.currentMeta()))
        })
      );
    }
  }

  function centreOnPlayer(onlyWhenMoved: boolean): void {
    const meta = source.currentMeta();
    if (!meta.player || meta.currentDimension === null) return;
    const key = `${meta.currentDimension}|${Math.round(meta.player.x)}|${Math.round(meta.player.z)}`;
    if (onlyWhenMoved && key === lastPlayerKey) return;
    lastPlayerKey = key;
    if (canvas.state().dimension !== meta.currentDimension) {
      canvas.setDimension(meta.currentDimension);
      rebuildDimensionSelectForced();
    }
    canvas.jumpTo(meta.player.x, meta.player.z);
    updateReadout();
  }

  function rebuildDimensionSelectForced(): void {
    dimensionSignature = '';
    rebuildDimensionSelect();
  }

  function tilesCentre(): { x: number; z: number } | null {
    const state = canvas.state();
    const meta = source.currentMeta();
    const tiles = tilesFor(meta, state.dimension, state.mode);
    if (tiles.length === 0) return null;
    let sumX = 0;
    let sumZ = 0;
    for (const tile of tiles) {
      sumX += (tile.rx + 0.5) * meta.regionPx;
      sumZ += (tile.rz + 0.5) * meta.regionPx;
    }
    return { x: sumX / tiles.length, z: sumZ / tiles.length };
  }

  function centreOnTiles(): void {
    const centre = tilesCentre();
    if (!centre) {
      ctx.notify.warn(
        t('map.tab', 'Live map'),
        t('map.jump.noTiles', 'There are no tiles to centre on yet')
      );
      return;
    }
    followPlayer = false;
    ctx.settings.set(SETTING_FOLLOW_PLAYER, false);
    followSwitch.set(false);
    canvas.flyTo(centre.x, centre.z);
  }

  async function chooseFolder(): Promise<void> {
    const picked = await window.studio.dialog.openFolder({
      title: t('map.action.chooseFolder', 'Choose the world folder…')
    });
    if (!picked.ok) {
      ctx.notify.error(
        t('map.tab', 'Live map'),
        t('map.notify.folderFailed', 'That folder could not be opened: {error}', { error: picked.error })
      );
      return;
    }
    const directory = picked.value?.[0];
    if (!directory) return;
    ctx.settings.set(SETTING_DIRECTORY, directory);
    source.setDirectory(directory);
    source.clearTiles();
    await ctx.history.record('Chose the live map world folder', 'map', { directory });
    ctx.notify.success(
      t('map.tab', 'Live map'),
      t('map.notify.folderChosen', 'Reading the map from {path}', { path: directory })
    );
    await refresh(false);
  }

  async function revealFolder(): Promise<void> {
    const target = source.resolvedDirectory() || source.currentDirectory();
    if (target === '') {
      ctx.notify.warn(
        t('map.tab', 'Live map'),
        t('map.empty.noFolder.title', 'No world folder is chosen yet')
      );
      return;
    }
    const result = await window.studio.shell.openPath(target);
    if (!result.ok) {
      ctx.notify.error(
        t('map.tab', 'Live map'),
        t('map.notify.folderFailed', 'That folder could not be opened: {error}', { error: result.error })
      );
    }
  }

  /* jump form ------------------------------------------------------ */

  function readJumpForm(): { x: number; y: number; z: number } | null {
    jumpError.textContent = '';
    if (canvas.state().dimension === '') {
      jumpError.textContent = t(
        'map.jump.error.dimension',
        'Choose a dimension first. None has any tiles yet, so there is nothing to jump into.'
      );
      return null;
    }
    const x = readAxis(jumpX.get(), t('map.jump.x', 'X'), WORLD_MIN, WORLD_MAX);
    if (x === null) return null;
    const z = readAxis(jumpZ.get(), t('map.jump.z', 'Z'), WORLD_MIN, WORLD_MAX);
    if (z === null) return null;
    const y = readAxis(jumpY.get(), 'Y', HEIGHT_MIN, HEIGHT_MAX);
    if (y === null) return null;
    return { x, y, z };
  }

  function readAxis(raw: string, field: string, min: number, max: number): number | null {
    const text = raw.trim();
    if (text === '') {
      jumpError.textContent = t('map.jump.error.blank', 'Enter a value for {field}. Nothing has moved.', { field });
      return null;
    }
    const value = Number(text);
    if (!Number.isFinite(value) || !Number.isInteger(value)) {
      jumpError.textContent = t(
        'map.jump.error.number',
        '{field} must be a whole number, such as -1240. Nothing has moved.',
        { field }
      );
      return null;
    }
    if (value < min || value > max) {
      jumpError.textContent = t('map.jump.error.range', '{field} must be between {min} and {max}. Nothing has moved.', {
        field,
        min: formatNumber(min),
        max: formatNumber(max)
      });
      return null;
    }
    return value;
  }

  /* markers -------------------------------------------------------- */

  function filteredMarkers(): MapMarker[] {
    const query = markerQuery;
    const all = store.all();
    if (!query) return all;
    return all.filter((marker) =>
      query.matches(`${marker.name} ${prettyDimension(marker.dimension)} ${marker.x} ${marker.z} ${marker.note}`)
    );
  }

  async function addMarker(x: number, y: number, z: number): Promise<void> {
    const dimension = canvas.state().dimension;
    if (dimension === '') {
      ctx.notify.warn(
        t('map.markers.title', 'Markers'),
        t(
          'map.jump.error.dimension',
          'Choose a dimension first. None has any tiles yet, so there is nothing to jump into.'
        )
      );
      return;
    }
    const created = await store.add({
      name: '',
      dimension,
      x,
      y,
      z
    });
    if (!created) {
      ctx.notify.warn(
        t('map.markers.title', 'Markers'),
        t('map.markers.full', 'The marker list is full at {limit}. Delete one before adding another.', {
          limit: formatNumber(MAX_MARKERS)
        })
      );
      return;
    }
    markerPage = 0;
    renderMarkers();
    canvas.draw();
    ctx.notify.success(
      t('map.markers.title', 'Markers'),
      t('map.markers.added', 'Marker added at {x}, {z}', {
        x: formatCoordinate(created.x),
        z: formatCoordinate(created.z)
      })
    );
    const field = markerListHost.querySelector<HTMLInputElement>(`[data-marker-name="${created.id}"]`);
    field?.focus();
  }

  async function bulkVisibility(visible: boolean): Promise<void> {
    const ids = [...markerSelection];
    if (ids.length === 0) {
      ctx.notify.warn(
        t('map.markers.title', 'Markers'),
        t('map.markers.nothingSelected', 'Select at least one marker first')
      );
      return;
    }
    const changed = await store.setVisibility(ids, visible);
    renderMarkers();
    canvas.draw();
    ctx.notify.success(
      t('map.markers.title', 'Markers'),
      t('map.markers.visibilityChanged', '{count} markers changed', { count: formatNumber(changed) })
    );
  }

  async function bulkDelete(anchor: HTMLElement): Promise<void> {
    const ids = [...markerSelection];
    if (ids.length === 0) {
      ctx.notify.warn(
        t('map.markers.title', 'Markers'),
        t('map.markers.nothingSelected', 'Select at least one marker first')
      );
      return;
    }
    await deleteMarkers(ids, anchor);
  }

  async function deleteMarkers(ids: string[], anchor: HTMLElement): Promise<void> {
    const chosen = ids
      .map((id) => store.byId(id))
      .filter((marker): marker is MapMarker => marker !== null);
    if (chosen.length === 0) return;

    const approved = await ctx.confirm.request({
      action: t('map.markers.deletePreview', 'These {count} markers will be deleted', {
        count: formatNumber(chosen.length)
      }),
      affected: chosen.map(
        (marker) =>
          `${marker.name.trim() === '' ? t('map.markers.unnamed', 'Unnamed marker') : marker.name} — ${prettyDimension(marker.dimension)} ${formatCoordinate(marker.x)}, ${formatCoordinate(marker.z)}`
      ),
      irreversible:
        'The markers are removed from the stored list. They can be put back from the notification that follows, and the deletion is recorded in local history either way.',
      anchor
    });
    if (!approved) return;

    const removed = await store.remove(chosen.map((marker) => marker.id));
    for (const marker of removed) markerSelection.delete(marker.id);
    renderMarkers();
    canvas.draw();
    ctx.notify.show({
      title: t('map.markers.title', 'Markers'),
      body: t('map.markers.deleted', '{count} markers deleted', { count: formatNumber(removed.length) }),
      severity: 'success',
      source: 'map',
      actions: [
        {
          label: t('map.markers.undo', 'Put them back'),
          run: async () => {
            const restored = await store.restore(removed);
            renderMarkers();
            canvas.draw();
            ctx.notify.success(
              t('map.markers.title', 'Markers'),
              t('map.markers.restored', '{count} markers restored', { count: formatNumber(restored) })
            );
          }
        }
      ]
    });
  }

  async function exportMarkers(): Promise<void> {
    const rows = filteredMarkers().map(markerToRecord);
    if (rows.length === 0) {
      ctx.notify.warn(
        t('map.markers.title', 'Markers'),
        t('map.markers.empty.title', 'Nothing matched')
      );
      return;
    }
    const preflight = ctx.exporter.preflight(rows, exportFormat);
    if (preflight.losses.length > 0) {
      ctx.notify.warn(
        t('map.markers.export', 'Export markers'),
        t('map.export.losses', 'This format cannot carry: {fields}', {
          fields: preflight.losses.map((loss) => `${loss.field} (${loss.reason})`).join('; ')
        })
      );
    }
    const path = await ctx.exporter.save(rows, exportFormat, {
      name: 'map-markers',
      defaultFileName: `map-markers.${exportFormat === 'markdown' ? 'md' : exportFormat}`
    });
    if (!path) return;
    ctx.notify.success(
      t('map.markers.export', 'Export markers'),
      t('map.export.saved', 'Markers written to {path}', { path })
    );
  }

  function renderMarkers(): void {
    const all = store.all();
    const matching = filteredMarkers();
    const pageCount = Math.max(1, Math.ceil(matching.length / ROWS_PER_PAGE));
    if (markerPage >= pageCount) markerPage = pageCount - 1;
    const start = markerPage * ROWS_PER_PAGE;
    const page = matching.slice(start, start + ROWS_PER_PAGE);

    selectShownButton.querySelector('.md-btn__label')!.textContent = t(
      'map.markers.selectShown',
      'Select the {count} shown',
      { count: formatNumber(matching.length) }
    );
    selectAllButton.querySelector('.md-btn__label')!.textContent = t(
      'map.markers.selectAll',
      'Select every marker ({count})',
      { count: formatNumber(all.length) }
    );

    const selectedCount = [...markerSelection].filter((id) => all.some((marker) => marker.id === id)).length;
    selectionSummary.textContent = `${t('map.markers.count', '{shown} of {total} markers shown', {
      shown: formatNumber(matching.length),
      total: formatNumber(all.length)
    })} · ${t('map.markers.selected', '{count} selected', { count: formatNumber(selectedCount) })}`;

    const nothingSelected = selectedCount === 0;
    const reason = t('map.markers.nothingSelected', 'Select at least one marker first');
    for (const control of [showButton, hideButton, deleteButton]) {
      control.disabled = nothingSelected;
      if (nothingSelected) {
        control.title = reason;
        control.setAttribute('aria-description', reason);
      } else {
        control.removeAttribute('title');
        control.removeAttribute('aria-description');
      }
    }

    previousPageButton.disabled = markerPage === 0;
    if (previousPageButton.disabled) {
      previousPageButton.title = 'This is the first page of markers.';
      previousPageButton.setAttribute('aria-description', 'This is the first page of markers.');
    } else {
      previousPageButton.removeAttribute('title');
      previousPageButton.removeAttribute('aria-description');
    }
    nextPageButton.disabled = markerPage >= pageCount - 1;
    if (nextPageButton.disabled) {
      nextPageButton.title = 'This is the last page of markers.';
      nextPageButton.setAttribute('aria-description', 'This is the last page of markers.');
    } else {
      nextPageButton.removeAttribute('title');
      nextPageButton.removeAttribute('aria-description');
    }
    pager.hidden = matching.length <= ROWS_PER_PAGE;
    pageLabel.textContent =
      matching.length === 0
        ? ''
        : `${formatNumber(start + 1)}–${formatNumber(start + page.length)} / ${formatNumber(matching.length)}`;

    markerListHost.textContent = '';

    if (all.length === 0) {
      markerListHost.append(
        ctx.components.emptyState({
          title: t('map.markers.none.title', 'No markers yet'),
          body: t(
            'map.markers.none.body',
            'Centre the map on a place worth remembering and add a marker for it. Markers can be renamed, hidden, exported and deleted at any time.'
          ),
          action: {
            label: 'map.markers.add',
            variant: 'filled',
            icon: 'add',
            onClick: () => {
              const state = canvas.state();
              void addMarker(Math.round(state.x), 64, Math.round(state.z));
            }
          }
        })
      );
      return;
    }

    if (matching.length === 0) {
      markerListHost.append(
        ctx.components.emptyState({
          title: t('map.markers.empty.title', 'Nothing matched'),
          body: t(
            'map.markers.empty.body',
            'No marker matched the current search. Clearing the field brings all of them back; nothing was deleted.'
          ),
          action: {
            label: 'core.action.clear',
            variant: 'text',
            onClick: () => search.clear()
          }
        })
      );
      return;
    }

    const list = ctx.components.list({ label: 'map.markers.title' });
    markerListHost.append(list);
    page.forEach((marker, index) => list.append(markerRow(marker, start + index, matching)));
  }

  function markerRow(marker: MapMarker, absoluteIndex: number, ordered: MapMarker[]): HTMLElement {
    const row = el('li', { className: 'map-marker' });
    row.dataset.appearanceId = 'map.markerRow';
    row.setAttribute('aria-selected', String(markerSelection.has(marker.id)));

    const selectBox = ctx.components.checkbox({
      label: marker.name.trim() === '' ? t('map.markers.unnamed', 'Unnamed marker') : marker.name,
      checked: markerSelection.has(marker.id),
      onChange: (checked) => {
        if (lastShiftClick && lastToggledIndex >= 0) {
          const from = Math.min(lastToggledIndex, absoluteIndex);
          const to = Math.max(lastToggledIndex, absoluteIndex);
          for (let index = from; index <= to; index += 1) {
            const target = ordered[index];
            if (!target) continue;
            if (checked) markerSelection.add(target.id);
            else markerSelection.delete(target.id);
          }
        } else if (checked) {
          markerSelection.add(marker.id);
        } else {
          markerSelection.delete(marker.id);
        }
        lastToggledIndex = absoluteIndex;
        lastShiftClick = false;
        renderMarkers();
      }
    });
    selectBox.root.classList.add('map-marker__select');
    selectBox.root.querySelector('span')?.classList.add('md-visually-hidden');
    const selectInput = selectBox.root.querySelector('input');
    selectInput?.addEventListener('click', (event) => {
      lastShiftClick = (event as MouseEvent).shiftKey;
    });
    row.append(selectBox.root);

    const dot = el('span', { className: 'map-marker__dot', attrs: { 'aria-hidden': 'true' } });
    dot.style.background = `var(--md-sys-color-${marker.colour})`;
    row.append(dot);

    const nameField = ctx.components.textField({
      label: 'map.markers.name',
      value: marker.name,
      placeholder: 'map.markers.namePlaceholder',
      onCommit: (value) => {
        void store.update(marker.id, { name: value }).then((changed) => {
          if (changed) {
            renderMarkers();
            canvas.draw();
          }
        });
      }
    });
    nameField.root.classList.add('map-marker__name');
    nameField.root.querySelector('input')?.setAttribute('data-marker-name', marker.id);
    row.append(nameField.root);

    const location = el('div', { className: 'map-marker__location' });
    location.append(
      el({
        tag: 'span'
      } as never as 'span', {
        className: 'md-typescale-body-medium',
        text: `${formatCoordinate(marker.x)}, ${formatCoordinate(marker.y)}, ${formatCoordinate(marker.z)}`
      })
    );
    if (marker.dimension !== canvas.state().dimension) {
      location.append(
        el('span', {
          className: 'map-marker__elsewhere md-typescale-body-small',
          text: t('map.markers.otherDimension', 'In {dimension}, which is not the dimension on screen', {
            dimension: prettyDimension(marker.dimension)
          })
        })
      );
    }
    row.append(location);

    const colourSelect = ctx.components.select({
      label: 'map.markers.colour',
      options: MARKER_COLOURS.map((colour) => ({ value: colour, label: `map.markers.colour.${colour}` })),
      value: marker.colour,
      onChange: (value) => {
        void store.update(marker.id, { colour: value as MarkerColour }).then((changed) => {
          if (changed) {
            renderMarkers();
            canvas.draw();
          }
        });
      }
    });
    colourSelect.root.classList.add('map-marker__colour');
    row.append(colourSelect.root);

    const visibleSwitch = ctx.components.switchControl({
      label: 'map.markers.visible',
      checked: marker.visible,
      onChange: (value) => {
        void store.update(marker.id, { visible: value }).then(() => canvas.draw());
      }
    });
    visibleSwitch.root.classList.add('map-marker__visible');
    row.append(visibleSwitch.root);

    const rowActions = el('div', { className: 'map-marker__actions' });
    rowActions.append(
      ctx.components.iconButton({
        icon: 'map',
        label: t('map.markers.goto', 'Go to this marker'),
        onClick: () => {
          if (marker.dimension !== canvas.state().dimension) {
            canvas.setDimension(marker.dimension);
            rebuildDimensionSelectForced();
          }
          followPlayer = false;
          ctx.settings.set(SETTING_FOLLOW_PLAYER, false);
          followSwitch.set(false);
          canvas.flyTo(marker.x, marker.z);
          renderMarkers();
        }
      }),
      ctx.components.iconButton({
        icon: 'trash',
        label: t('map.markers.delete', 'Delete selected'),
        onClick: (event) => {
          void deleteMarkers([marker.id], event.currentTarget as HTMLElement);
        }
      })
    );
    row.append(rowActions);

    return row;
  }

  /* ---------------- timers and subscriptions ---------------- */

  function scheduleRefresh(): void {
    if (refreshTimer) {
      window.clearInterval(refreshTimer);
      refreshTimer = 0;
    }
    if (ctx.settings.get<boolean>(SETTING_AUTO_REFRESH, true) === false) return;
    const seconds = Number(ctx.settings.get(SETTING_REFRESH_SECONDS, DEFAULT_REFRESH_SECONDS));
    const bounded = clamp(Number.isFinite(seconds) ? seconds : DEFAULT_REFRESH_SECONDS, 2, 120);
    refreshTimer = window.setInterval(() => {
      void refresh(false);
    }, bounded * 1000);
  }

  source.setDirectory(String(ctx.settings.get(SETTING_DIRECTORY, '')));
  source.setCacheLimit(Number(ctx.settings.get(SETTING_TILE_CACHE, DEFAULT_TILE_CACHE)) || DEFAULT_TILE_CACHE);

  const stopSettings = ctx.settings.onChange((change) => {
    switch (change.id) {
      case SETTING_DIRECTORY:
        source.setDirectory(String(change.value ?? ''));
        void refresh(false);
        break;
      case SETTING_TILE_CACHE:
        source.setCacheLimit(Number(change.value) || DEFAULT_TILE_CACHE);
        break;
      case SETTING_AUTO_REFRESH:
        autoRefreshSwitch.set(change.value !== false);
        scheduleRefresh();
        break;
      case SETTING_REFRESH_SECONDS:
        scheduleRefresh();
        break;
      case SETTING_FOLLOW_PLAYER:
        followPlayer = change.value !== false;
        followSwitch.set(followPlayer);
        break;
      case SETTING_LAYER_MARKERS:
      case SETTING_LAYER_PLAYER:
      case SETTING_LAYER_REGION_GRID:
      case SETTING_LAYER_CROSSHAIR:
      case SETTING_SMOOTHING: {
        const control = layerSwitches.get(change.id);
        control?.set(change.value !== false);
        canvas.draw();
        break;
      }
      default:
        break;
    }
  });

  const stopTheme = ctx.theme.onChange(() => canvas.refreshPalette());
  const stopMarkers = store.onChange(() => canvas.draw());

  ctx.onDispose(() => {
    if (refreshTimer) window.clearInterval(refreshTimer);
    stopSettings();
    stopTheme();
    stopMarkers();
    search.destroy();
    canvas.dispose();
    source.dispose();
  });

  updateReadout();
  renderMarkers();
  scheduleRefresh();
  void refresh(false);
}
