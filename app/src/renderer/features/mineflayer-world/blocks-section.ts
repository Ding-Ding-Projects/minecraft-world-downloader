/**
 * Block interaction and world query (rows 15.10 and 15.11).
 *
 * Covers `digging`, `place_block`, `place_entity`, `generic_place`,
 * `block_actions`, `ray_trace` and `blocks` from `vendor/mineflayer/lib/plugins`.
 * Every method called here (`dig`, `stopDigging`, `digTime`, `placeBlock`,
 * `placeEntity`, `activateBlock`, `blockAt`, `blockAtCursor`, `findBlocks`,
 * `inventory`, `equip`) is on the fixed allow-list in `../mineflayer/bot-host.js`.
 */

import type { SectionDeps } from './panel';
import {
  BLOCKS_ELEMENT,
  FIND_BLOCKS_ELEMENT,
  COMMON_BLOCK_NAMES,
  FACE_OPTIONS,
  DEFAULT_FIND_DISTANCE_ID,
  DEFAULT_FIND_COUNT_ID,
  DEFAULTS,
  formatBlockVec,
  isDiggingInFlight,
  nextRowId,
  normaliseBlock,
  normaliseEntity,
  normaliseVec,
  normaliseWindow,
  parseCoordinate,
  setDiggingInFlight,
  type Vec3Like,
  type WorldBlock
} from './model';

export function mountBlocksSection(host: HTMLElement, deps: SectionDeps): () => void {
  const { ctx } = deps;
  const disposers: Array<() => void> = [];

  host.id = BLOCKS_ELEMENT;
  host.append(
    ctx.components.sectionHeading({
      title: ctx.t('mineflayerWorld.blocks.heading', 'Blocks: dig, place, activate and look up'),
      description: ctx.t(
        'mineflayerWorld.blocks.heading.description',
        'Pick a target block by ray-tracing where the bot is looking, or by typing coordinates, then dig, place against it, activate it, or inspect its state.'
      )
    })
  );

  /* ---------------- shared target picker ---------------- */

  const targetCard = ctx.components.card({ variant: 'outlined' });
  targetCard.classList.add('mineflayer-world-card');
  host.append(targetCard);

  const targetRow = document.createElement('div');
  targetRow.className = 'mineflayer-world-row';
  targetCard.append(targetRow);

  const xField = ctx.components.textField({ label: ctx.t('mineflayerWorld.blocks.x', 'X'), type: 'number', value: '' });
  const yField = ctx.components.textField({ label: ctx.t('mineflayerWorld.blocks.y', 'Y'), type: 'number', value: '' });
  const zField = ctx.components.textField({ label: ctx.t('mineflayerWorld.blocks.z', 'Z'), type: 'number', value: '' });
  targetRow.append(xField.root, yField.root, zField.root);

  function currentTarget(): Vec3Like | null {
    const x = parseCoordinate(xField.get());
    const y = parseCoordinate(yField.get());
    const z = parseCoordinate(zField.get());
    if (x === null || y === null || z === null) return null;
    return { x, y, z };
  }

  function setTarget(v: Vec3Like): void {
    xField.set(String(v.x));
    yField.set(String(v.y));
    zField.set(String(v.z));
  }

  const inspector = document.createElement('div');
  inspector.className = 'mineflayer-world-inspector';
  inspector.setAttribute('role', 'status');
  targetCard.append(inspector);

  function renderInspector(block: WorldBlock | null, message?: string): void {
    inspector.replaceChildren();
    if (message) {
      const p = document.createElement('p');
      p.className = 'md-typescale-body-medium';
      p.textContent = message;
      inspector.append(p);
      return;
    }
    if (!block) {
      const p = document.createElement('p');
      p.className = 'md-typescale-body-medium';
      p.textContent = ctx.t('mineflayerWorld.blocks.inspector.empty', 'No block has been looked up yet.');
      inspector.append(p);
      return;
    }
    const title = document.createElement('div');
    title.className = 'md-typescale-title-small';
    title.textContent = `${block.displayName} (${block.name})`;
    inspector.append(title);

    const facts: Array<[string, string]> = [
      [ctx.t('mineflayerWorld.blocks.position', 'Position'), formatBlockVec(block.position)],
      [ctx.t('mineflayerWorld.blocks.diggable', 'Diggable'), block.diggable === null ? '—' : block.diggable ? ctx.t('core.value.yes', 'Yes') : ctx.t('core.value.no', 'No')],
      [ctx.t('mineflayerWorld.blocks.hardness', 'Hardness'), block.hardness === null ? '—' : String(block.hardness)],
      [ctx.t('mineflayerWorld.blocks.light', 'Light'), block.light === null ? '—' : String(block.light)],
      [ctx.t('mineflayerWorld.blocks.skyLight', 'Sky light'), block.skyLight === null ? '—' : String(block.skyLight)],
      [ctx.t('mineflayerWorld.blocks.stateId', 'State id'), block.stateId === null ? '—' : String(block.stateId)]
    ];
    const grid = document.createElement('div');
    grid.className = 'mineflayer-world-status-grid';
    for (const [label, value] of facts) {
      const cell = document.createElement('div');
      cell.className = 'mineflayer-world-status-cell';
      const l = document.createElement('span');
      l.className = 'mineflayer-world-status-label md-typescale-label-small';
      l.textContent = label;
      const v = document.createElement('span');
      v.className = 'mineflayer-world-status-value md-typescale-body-medium';
      v.textContent = value;
      cell.append(l, v);
      grid.append(cell);
    }
    inspector.append(grid);

    if (block.properties && Object.keys(block.properties).length > 0) {
      const propsTitle = document.createElement('div');
      propsTitle.className = 'md-typescale-label-medium';
      propsTitle.textContent = ctx.t('mineflayerWorld.blocks.properties', 'Block state properties');
      inspector.append(propsTitle);
      const list = document.createElement('ul');
      list.className = 'mineflayer-world-property-list';
      for (const [key, value] of Object.entries(block.properties)) {
        const li = document.createElement('li');
        li.textContent = `${key}: ${String(value)}`;
        list.append(li);
      }
      inspector.append(list);
    }
  }

  renderInspector(null);

  const pickerActions = document.createElement('div');
  pickerActions.className = 'mineflayer-world-actions';
  targetCard.append(pickerActions);

  const rayDistance = ctx.components.textField({
    label: ctx.t('mineflayerWorld.blocks.rayDistance', 'Ray distance'),
    type: 'number',
    value: '4',
    suffix: 'm'
  });
  pickerActions.append(rayDistance.root);

  const rayButton = ctx.components.button({
    label: ctx.t('mineflayerWorld.blocks.lookHere', 'Target what the bot is looking at'),
    icon: 'world',
    variant: 'tonal',
    onClick: async () => {
      const distance = parseCoordinate(rayDistance.get()) ?? 4;
      try {
        const raw = await deps.call('blockAtCursor', [Math.max(0, Math.min(256, distance))]);
        const block = normaliseBlock(raw);
        if (!block || !block.position) {
          renderInspector(null, ctx.t('mineflayerWorld.blocks.noTarget', 'Nothing loaded is in view within that distance.'));
          return;
        }
        setTarget(block.position);
        renderInspector(block);
      } catch (error) {
        deps.notifyError(ctx.t('mineflayerWorld.blocks.lookHere', 'Target what the bot is looking at'), error);
      }
    }
  });
  pickerActions.append(rayButton);

  const lookupButton = ctx.components.button({
    label: ctx.t('mineflayerWorld.blocks.lookUp', 'Look up this position'),
    icon: 'search',
    variant: 'text',
    onClick: async () => {
      const target = currentTarget();
      if (!target) {
        renderInspector(null, ctx.t('mineflayerWorld.blocks.needCoordinates', 'Enter X, Y and Z first, or use the ray-trace button above.'));
        return;
      }
      try {
        const raw = await deps.call('blockAt', [target]);
        const block = normaliseBlock(raw);
        if (!block) {
          renderInspector(null, ctx.t('mineflayerWorld.blocks.notLoaded', 'That chunk is not loaded, so nothing can be read at that position.'));
          return;
        }
        renderInspector(block);
      } catch (error) {
        deps.notifyError(ctx.t('mineflayerWorld.blocks.lookUp', 'Look up this position'), error);
      }
    }
  });
  pickerActions.append(lookupButton);

  /* ---------------- tool selection ---------------- */

  const toolCard = document.createElement('div');
  toolCard.className = 'mineflayer-world-inline';
  host.append(toolCard);

  const toolSelect = ctx.components.select({
    label: ctx.t('mineflayerWorld.blocks.tool', 'Tool to hold before digging'),
    options: [{ value: '', label: ctx.t('mineflayerWorld.blocks.toolNone', 'Whatever is already held') }],
    value: ''
  });
  toolCard.append(toolSelect.root);

  const refreshToolButton = ctx.components.iconButton({
    icon: 'refresh',
    label: ctx.t('mineflayerWorld.blocks.refreshInventory', 'Refresh the inventory list'),
    variant: 'standard',
    onClick: () => void refreshTools()
  });
  toolCard.append(refreshToolButton);

  // Mutable so the equip button and the refresh routine always agree on which
  // control is currently live, even after `refreshTools` swaps it out.
  const toolSelectRef = { current: toolSelect };

  const equipButton = ctx.components.button({
    label: ctx.t('mineflayerWorld.blocks.equip', 'Equip'),
    variant: 'outlined',
    onClick: async () => {
      const name = toolSelectRef.current.get();
      if (!name) return;
      try {
        await deps.call('equip', [name, 'hand']);
        ctx.notify.success(ctx.t('mineflayerWorld.blocks.equip', 'Equip'), ctx.t('mineflayerWorld.blocks.equipped', 'Now holding {name}.', { values: { name } }));
      } catch (error) {
        deps.notifyError(ctx.t('mineflayerWorld.blocks.equip', 'Equip'), error);
      }
    }
  });
  toolCard.append(equipButton);

  async function refreshTools(): Promise<void> {
    try {
      const raw = await deps.call('inventory', []);
      const window = normaliseWindow(raw);
      const options = [
        { value: '', label: ctx.t('mineflayerWorld.blocks.toolNone', 'Whatever is already held') },
        ...window.slots.map((item) => ({ value: item.name, label: `${item.displayName} ×${item.count} (${ctx.t('mineflayerWorld.blocks.slot', 'slot {slot}', { values: { slot: item.slot } })})` }))
      ];
      const fresh = ctx.components.select({ label: ctx.t('mineflayerWorld.blocks.tool', 'Tool to hold before digging'), options, value: '' });
      toolSelectRef.current.root.replaceWith(fresh.root);
      toolSelectRef.current = fresh;
    } catch (error) {
      deps.notifyError(ctx.t('mineflayerWorld.blocks.refreshInventory', 'Refresh the inventory list'), error);
    }
  }

  void refreshTools();

  /* ---------------- dig ---------------- */

  const digCard = document.createElement('div');
  digCard.className = 'mineflayer-world-card';
  host.append(digCard);

  const digProgress = ctx.components.linearProgress({ value: 0, label: ctx.t('mineflayerWorld.blocks.digProgress', 'Dig progress') });
  digCard.append(digProgress.root);

  const digStatus = document.createElement('p');
  digStatus.className = 'md-typescale-body-small';
  digStatus.setAttribute('role', 'status');
  digCard.append(digStatus);

  const digActions = document.createElement('div');
  digActions.className = 'mineflayer-world-actions';
  digCard.append(digActions);

  const digButton = ctx.components.button({
    label: ctx.t('mineflayerWorld.blocks.dig', 'Dig the target block'),
    icon: 'terminal',
    variant: 'filled',
    onClick: () => void startDig()
  });
  digActions.append(digButton);

  const stopDigButton = ctx.components.button({
    label: ctx.t('mineflayerWorld.blocks.stopDig', 'Stop digging'),
    icon: 'stop',
    variant: 'outlined',
    onClick: async () => {
      try {
        await deps.call('stopDigging', []);
      } catch (error) {
        deps.notifyError(ctx.t('mineflayerWorld.blocks.stopDig', 'Stop digging'), error);
      }
    }
  });
  digActions.append(stopDigButton);

  async function startDig(): Promise<void> {
    // The refusal-to-re-enter guard: checked here, not only expressed by the
    // disabled attribute below, because a keyboard submit on a focused button
    // walks straight past a `disabled` set a moment too late by a re-render.
    if (isDiggingInFlight(deps.botId)) return;
    const target = currentTarget();
    if (!target) {
      ctx.notify.warn(
        ctx.t('mineflayerWorld.blocks.dig', 'Dig the target block'),
        ctx.t('mineflayerWorld.blocks.needCoordinates', 'Enter X, Y and Z first, or use the ray-trace button above.')
      );
      return;
    }

    let totalMs = 0;
    try {
      const time = await deps.call<number | null>('digTime', [target]);
      if (time === null) {
        digStatus.textContent = ctx.t(
          'mineflayerWorld.blocks.undiggable',
          'This block cannot be dug (its dig time is infinite, as bedrock and similar blocks report).'
        );
        return;
      }
      totalMs = time;
    } catch (error) {
      deps.notifyError(ctx.t('mineflayerWorld.blocks.dig', 'Dig the target block'), error);
      return;
    }

    setDiggingInFlight(deps.botId, true);
    digButton.disabled = true;
    digButton.title = ctx.t('mineflayerWorld.blocks.digInFlight', 'A dig is already in progress.');
    const startedAt = Date.now();
    digStatus.textContent = ctx.t('mineflayerWorld.blocks.digging', 'Digging…');
    digProgress.set(0);

    const tick = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const pct = totalMs > 0 ? Math.min(99, Math.round((elapsed / totalMs) * 100)) : 50;
      digProgress.set(pct);
    }, 100);

    try {
      await deps.call('dig', [target, true]);
      digProgress.set(100);
      digStatus.textContent = ctx.t('mineflayerWorld.blocks.digDone', 'Block dug.');
      ctx.notify.success(ctx.t('mineflayerWorld.blocks.dig', 'Dig the target block'), ctx.t('mineflayerWorld.blocks.digDone', 'Block dug.'));
    } catch (error) {
      digStatus.textContent = deps.ctx.t('mineflayerWorld.blocks.digFailed', 'Digging stopped: {reason}', {
        values: { reason: error instanceof Error ? error.message : String(error) }
      });
      digProgress.set(0);
    } finally {
      window.clearInterval(tick);
      setDiggingInFlight(deps.botId, false);
      digButton.disabled = false;
      digButton.title = '';
    }
  }

  const digEventUnsub = deps.onEvent(['diggingCompleted', 'diggingAborted', 'blockBreakProgressObserved'], (name, payload) => {
    if (name === 'blockBreakProgressObserved' && Array.isArray(payload)) {
      const [, stage] = payload as [unknown, number];
      if (typeof stage === 'number') digStatus.textContent = ctx.t('mineflayerWorld.blocks.serverStage', 'Server-reported break stage: {stage}/9', { values: { stage } });
    }
  });
  disposers.push(digEventUnsub);

  /* ---------------- place / activate ---------------- */

  const placeCard = document.createElement('div');
  placeCard.className = 'mineflayer-world-card';
  host.append(placeCard);

  const faceSelect = ctx.components.select({
    label: ctx.t('mineflayerWorld.blocks.face', 'Face of the target block to place against'),
    options: FACE_OPTIONS.map((f) => ({ value: f.value, label: f.label })),
    value: 'top'
  });
  placeCard.append(faceSelect.root);

  const placeActions = document.createElement('div');
  placeActions.className = 'mineflayer-world-actions';
  placeCard.append(placeActions);

  function faceVector(): Vec3Like {
    const chosen = FACE_OPTIONS.find((f) => f.value === faceSelect.get());
    return chosen ? chosen.vector : { x: 0, y: 1, z: 0 };
  }

  placeActions.append(
    ctx.components.button({
      label: ctx.t('mineflayerWorld.blocks.place', 'Place block'),
      icon: 'add',
      variant: 'filled',
      onClick: async () => {
        const target = currentTarget();
        if (!target) {
          ctx.notify.warn(ctx.t('mineflayerWorld.blocks.place', 'Place block'), ctx.t('mineflayerWorld.blocks.needCoordinates', 'Enter X, Y and Z first, or use the ray-trace button above.'));
          return;
        }
        try {
          await deps.call('placeBlock', [target, faceVector()]);
          ctx.notify.success(ctx.t('mineflayerWorld.blocks.place', 'Place block'), ctx.t('mineflayerWorld.blocks.placeDone', 'The held item was placed against that face.'));
        } catch (error) {
          deps.notifyError(ctx.t('mineflayerWorld.blocks.place', 'Place block'), error);
        }
      }
    }),
    ctx.components.button({
      label: ctx.t('mineflayerWorld.blocks.placeEntity', 'Place entity (boat, minecart, armour stand…)'),
      icon: 'add',
      variant: 'outlined',
      onClick: async () => {
        const target = currentTarget();
        if (!target) {
          ctx.notify.warn(ctx.t('mineflayerWorld.blocks.placeEntity', 'Place entity'), ctx.t('mineflayerWorld.blocks.needCoordinates', 'Enter X, Y and Z first, or use the ray-trace button above.'));
          return;
        }
        try {
          const raw = await deps.call('placeEntity', [target, faceVector()]);
          const entity = normaliseEntity(raw);
          ctx.notify.success(
            ctx.t('mineflayerWorld.blocks.placeEntity', 'Place entity'),
            entity
              ? ctx.t('mineflayerWorld.blocks.placeEntityDone', 'Placed {name}.', { values: { name: entity.displayName } })
              : ctx.t('mineflayerWorld.blocks.placeEntityDoneUnknown', 'The entity was placed.')
          );
        } catch (error) {
          deps.notifyError(ctx.t('mineflayerWorld.blocks.placeEntity', 'Place entity'), error);
        }
      }
    }),
    ctx.components.button({
      label: ctx.t('mineflayerWorld.blocks.activate', 'Activate (right-click) the target block'),
      icon: 'play',
      variant: 'tonal',
      onClick: async () => {
        const target = currentTarget();
        if (!target) {
          ctx.notify.warn(ctx.t('mineflayerWorld.blocks.activate', 'Activate the target block'), ctx.t('mineflayerWorld.blocks.needCoordinates', 'Enter X, Y and Z first, or use the ray-trace button above.'));
          return;
        }
        try {
          await deps.call('activateBlock', [target]);
          ctx.notify.success(ctx.t('mineflayerWorld.blocks.activate', 'Activate the target block'), ctx.t('mineflayerWorld.blocks.activateDone', 'The block was activated (a door opened, a lever flipped, a button pressed — whatever that block does).'));
        } catch (error) {
          deps.notifyError(ctx.t('mineflayerWorld.blocks.activate', 'Activate the target block'), error);
        }
      }
    })
  );

  /* ---------------- find blocks by type ---------------- */

  const findHost = document.createElement('div');
  findHost.id = FIND_BLOCKS_ELEMENT;
  findHost.className = 'mineflayer-world-card';
  host.append(findHost);
  findHost.append(
    ctx.components.sectionHeading({
      title: ctx.t('mineflayerWorld.find.heading', 'Find blocks by type'),
      description: ctx.t('mineflayerWorld.find.heading.description', 'Search a radius around the bot for every loaded block matching the names you list.')
    })
  );

  const matchingField = ctx.components.textField({
    label: ctx.t('mineflayerWorld.find.matching', 'Block names to find (comma-separated)'),
    placeholder: 'stone, coal_ore',
    supportingText: ctx.t('mineflayerWorld.find.matching.help', 'Names are matched against the server\'s own real block registry; an unrecognised name is refused with the server\'s exact reason.')
  });
  findHost.append(matchingField.root);

  const chipRow = document.createElement('div');
  chipRow.className = 'mineflayer-world-chip-row';
  findHost.append(chipRow);
  for (const name of COMMON_BLOCK_NAMES) {
    chipRow.append(
      ctx.components.button({
        label: name,
        variant: 'text',
        onClick: () => {
          const current = matchingField.get();
          matchingField.set(current.length > 0 ? `${current}, ${name}` : name);
        }
      })
    );
  }

  const findOptionsRow = document.createElement('div');
  findOptionsRow.className = 'mineflayer-world-row';
  findHost.append(findOptionsRow);

  const distanceField = ctx.components.textField({
    label: ctx.t('mineflayerWorld.find.maxDistance', 'Search radius'),
    type: 'number',
    value: String(ctx.settings.get<number>(DEFAULT_FIND_DISTANCE_ID, DEFAULTS.defaultFindDistance)),
    suffix: 'm'
  });
  const countField = ctx.components.textField({
    label: ctx.t('mineflayerWorld.find.count', 'Maximum results'),
    type: 'number',
    value: String(ctx.settings.get<number>(DEFAULT_FIND_COUNT_ID, DEFAULTS.defaultFindCount))
  });
  findOptionsRow.append(distanceField.root, countField.root);

  interface FoundRow {
    id: string;
    position: Vec3Like;
    name: string;
    displayName: string;
  }
  let foundRows: FoundRow[] = [];

  const table = ctx.components.dataTable<FoundRow>({
    label: ctx.t('mineflayerWorld.find.results', 'Matching blocks'),
    columns: [
      { id: 'name', label: ctx.t('mineflayerWorld.find.column.name', 'Block'), sortable: true, value: (r) => r.displayName },
      { id: 'position', label: ctx.t('mineflayerWorld.find.column.position', 'Position'), value: (r) => formatBlockVec(r.position) }
    ],
    rows: [],
    rowId: (r) => r.id,
    selectable: true,
    emptyMessage: ctx.t('mineflayerWorld.find.empty', 'No search has been run yet.')
  });
  findHost.append(table.root);

  const findSearch = ctx.createSearchBar({
    label: ctx.t('mineflayerWorld.find.search', 'Filter results'),
    sample: '',
    onChange: (query) => {
      visibleRows = foundRows.filter((row) => query.matches(row.displayName) || query.matches(row.name));
      table.setRows(visibleRows);
    }
  });
  findHost.insertBefore(findSearch.root, table.root);
  disposers.push(() => findSearch.destroy());

  let visibleRows: FoundRow[] = [];

  const bulkActions = document.createElement('div');
  bulkActions.className = 'mineflayer-world-actions';
  findHost.append(bulkActions);
  bulkActions.append(
    ctx.components.button({
      label: ctx.t('mineflayerWorld.find.selectShown', 'Select all shown'),
      variant: 'text',
      onClick: () => table.setSelection(visibleRows.map((r) => r.id))
    }),
    ctx.components.button({
      label: ctx.t('mineflayerWorld.find.selectAll', 'Select every result (including hidden by the filter)'),
      variant: 'text',
      onClick: () => {
        findSearch.clear();
        table.setSelection(foundRows.map((r) => r.id));
      }
    }),
    ctx.components.button({
      label: ctx.t('mineflayerWorld.find.invert', 'Invert selection'),
      variant: 'text',
      onClick: () => {
        const current = new Set(table.selection());
        table.setSelection(visibleRows.filter((r) => !current.has(r.id)).map((r) => r.id));
      }
    }),
    ctx.components.button({
      label: ctx.t('mineflayerWorld.find.clearSelection', 'Clear selection'),
      variant: 'text',
      onClick: () => table.clearSelection()
    })
  );

  const findActions = document.createElement('div');
  findActions.className = 'mineflayer-world-actions';
  findHost.append(findActions);

  findActions.append(
    ctx.components.button({
      label: ctx.t('mineflayerWorld.find.run', 'Search'),
      icon: 'search',
      variant: 'filled',
      onClick: async () => {
        const names = matchingField
          .get()
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
        if (names.length === 0) {
          ctx.notify.warn(ctx.t('mineflayerWorld.find.run', 'Search'), ctx.t('mineflayerWorld.find.needNames', 'List at least one block name.'));
          return;
        }
        const maxDistance = parseCoordinate(distanceField.get()) ?? DEFAULTS.defaultFindDistance;
        const count = parseCoordinate(countField.get()) ?? DEFAULTS.defaultFindCount;
        ctx.settings.set(DEFAULT_FIND_DISTANCE_ID, maxDistance);
        ctx.settings.set(DEFAULT_FIND_COUNT_ID, count);
        try {
          const raw = await deps.call<Array<Record<string, unknown>>>('findBlocks', [
            { matching: names, maxDistance, count }
          ]);
          foundRows = raw.map((entry) => {
            const position = normaliseVec(entry.position) ?? { x: 0, y: 0, z: 0 };
            return {
              id: nextRowId('block'),
              position,
              name: typeof entry.name === 'string' ? entry.name : 'unknown',
              displayName: typeof entry.displayName === 'string' ? entry.displayName : String(entry.name ?? 'unknown')
            };
          });
          visibleRows = foundRows;
          table.setRows(visibleRows);
          ctx.notify.info(ctx.t('mineflayerWorld.find.run', 'Search'), ctx.t('mineflayerWorld.find.found', '{count} block(s) found.', { values: { count: foundRows.length } }));
        } catch (error) {
          deps.notifyError(ctx.t('mineflayerWorld.find.run', 'Search'), error);
        }
      }
    }),
    ctx.components.button({
      label: ctx.t('mineflayerWorld.find.useSelected', 'Set the selected block as target'),
      variant: 'text',
      onClick: () => {
        const selected = table.selection();
        if (selected.length === 0) return;
        const row = foundRows.find((r) => r.id === selected[0]);
        if (row) {
          setTarget(row.position);
          ctx.tabs.teleport(deps.ctx.tabId, BLOCKS_ELEMENT);
        }
      }
    }),
    ctx.components.button({
      label: ctx.t('core.action.export', 'Export'),
      icon: 'download',
      variant: 'text',
      onClick: async () => {
        if (foundRows.length === 0) return;
        const selected = new Set(table.selection());
        const toExport = selected.size > 0 ? foundRows.filter((r) => selected.has(r.id)) : foundRows;
        const path = await ctx.exporter.save(
          toExport.map((r) => ({ name: r.name, displayName: r.displayName, x: r.position.x, y: r.position.y, z: r.position.z })),
          'csv',
          { name: 'found-blocks', defaultFileName: 'found-blocks.csv' }
        );
        if (path) ctx.notify.success(ctx.t('core.export.saved', 'Exported'), path);
      }
    })
  );

  return () => {
    for (const dispose of disposers) dispose();
  };
}
