/**
 * The Containers tab (row 15.6) — chest, dispenser, dropper, hopper, shulker,
 * ender chest and barrel, covering `lib/plugins/chest.js`. Opened through the
 * shared runtime's generic `openContainerAt`, which calls the real
 * `bot.openContainer` — the exact same allow-list of block names as
 * `allowedWindowTypes` in that vendored plugin.
 */

import type { TabContext } from '../../core/registry';
import type { SerializedItem, SerializedWindow, NearbyBlock } from './types';
import { CLICK_MODE, CONTAINER_BLOCK_NAMES } from './types';
import { createPickController, createSlotGrid, type SlotGridCell, type SlotGridHandle } from './slot-grid';
import { formatItemLine } from './item-view';
import {
  activeSession,
  describeCallError,
  fetchCurrentWindow,
  findNearbyBlocks,
  pollWhile,
  subscribeSession,
  type ActiveSession
} from './session';
import { AUTO_REFRESH_ID, DEFAULT_SEARCH_LIMIT, DEFAULT_SEARCH_RADIUS, POLL_INTERVAL_MS, SEARCH_LIMIT_ID, SEARCH_RADIUS_ID } from './settings';

export function mountContainersTab(host: HTMLElement, ctx: TabContext): void {
  host.classList.add('mineflayer-inventory-panel');
  host.append(
    ctx.components.topAppBar({
      title: ctx.t('mineflayerInventory.tab.containers', 'Containers'),
      subtitle: ctx.t(
        'mineflayerInventory.tab.containers.subtitle',
        'Chests, dispensers, droppers, hoppers, shulkers, ender chests and barrels'
      )
    })
  );

  const content = document.createElement('div');
  host.append(content);

  let disposed = false;
  let nearby: NearbyBlock[] = [];
  let filtered: NearbyBlock[] = [];
  let openWindow: SerializedWindow | null = null;
  let openError: string | null = null;
  let busy = false;
  const picker = createPickController();
  /** Every slot-grid mounted by the current render, torn down at the start of the next one so no tooltip listener leaks. */
  let mountedGrids: SlotGridHandle[] = [];

  const search = ctx.createSearchBar({
    label: 'mineflayerInventory.containers.search',
    sample: nearby.map((b) => b.displayName).join('\n'),
    onChange: (query) => {
      filtered = nearby.filter((b) => query.matches(b.displayName) || query.matches(b.name));
      renderContent();
    }
  });
  ctx.onDispose(() => search.destroy());

  async function refreshNearby(): Promise<void> {
    const session = activeSession();
    if (!session || !session.spawned) {
      nearby = [];
      filtered = [];
      return;
    }
    try {
      nearby = await findNearbyBlocks(
        session,
        CONTAINER_BLOCK_NAMES,
        ctx.settings.get<number>(SEARCH_RADIUS_ID, DEFAULT_SEARCH_RADIUS),
        ctx.settings.get<number>(SEARCH_LIMIT_ID, DEFAULT_SEARCH_LIMIT)
      );
      const query = search.query();
      filtered = nearby.filter((b) => query.matches(b.displayName) || query.matches(b.name));
    } catch {
      nearby = [];
      filtered = [];
    }
  }

  async function refreshOpenWindow(session: ActiveSession): Promise<void> {
    try {
      const win = await fetchCurrentWindow(session);
      if (win === null && openWindow !== null) {
        openWindow = null;
        ctx.notify.info(
          ctx.t('mineflayerInventory.containers.closedElsewhere', 'This container was closed — by distance, another player, or the server.')
        );
      } else {
        openWindow = win;
      }
    } catch (error) {
      openError = describeCallError(error);
    }
  }

  const stopPoll = pollWhile(
    async () => {
      if (disposed || busy) return;
      const session = activeSession();
      if (!session || !session.spawned) return;
      if (openWindow) {
        if (ctx.settings.get<boolean>(AUTO_REFRESH_ID, true)) await refreshOpenWindow(session);
      } else {
        await refreshNearby();
      }
      renderContent();
    },
    POLL_INTERVAL_MS
  );

  const unsubscribe = subscribeSession(() => renderContent());
  ctx.onDispose(() => {
    disposed = true;
    stopPoll();
    unsubscribe();
    for (const grid of mountedGrids) grid.destroy();
    mountedGrids = [];
  });

  async function openContainer(block: NearbyBlock): Promise<void> {
    const session = activeSession();
    if (!session) return;
    busy = true;
    renderContent();
    try {
      openWindow = await session.call<SerializedWindow>('openContainerAt', [block.position]);
      openError = null;
    } catch (error) {
      openError = describeCallError(error);
      ctx.notify.error(
        ctx.t('mineflayerInventory.containers.openFailed', 'Opening {name} failed: {error}', {
          values: { name: block.displayName, error: describeCallError(error) }
        })
      );
    }
    busy = false;
    renderContent();
  }

  async function closeContainer(): Promise<void> {
    const session = activeSession();
    if (!session) return;
    try {
      await session.call('closeWindow');
    } catch {
      /* the window may already be gone server-side; either way we stop showing it */
    }
    openWindow = null;
    picker.set(null);
    renderContent();
  }

  async function move(source: number, dest: number): Promise<void> {
    const session = activeSession();
    if (!session) return;
    try {
      await session.call('moveSlotItem', [source, dest]);
      await refreshOpenWindow(session);
    } catch (error) {
      ctx.notify.error(
        ctx.t('mineflayerInventory.inventory.moveFailed', 'That move was refused: {error}', {
          values: { error: describeCallError(error) }
        })
      );
    }
    renderContent();
  }

  function occupiedStacksIn(win: SerializedWindow, start: number, end: number): Array<{ slot: number; item: SerializedItem }> {
    const out: Array<{ slot: number; item: SerializedItem }> = [];
    for (let slot = start; slot < end; slot++) {
      const item = win.slots[slot];
      if (item) out.push({ slot, item });
    }
    return out;
  }

  async function bulkTransfer(direction: 'withdraw' | 'deposit'): Promise<void> {
    const session = activeSession();
    const win = openWindow;
    if (!session || !win || win.inventoryStart === null || win.inventoryEnd === null) return;
    const stacks =
      direction === 'withdraw'
        ? occupiedStacksIn(win, 0, win.inventoryStart)
        : occupiedStacksIn(win, win.inventoryStart, win.inventoryEnd);

    if (stacks.length === 0) {
      ctx.notify.info(ctx.t('mineflayerInventory.containers.nothingToMove', 'There is nothing to move.'));
      return;
    }

    const totalCount = stacks.reduce((sum, s) => sum + s.item.count, 0);
    const itemsSummary = stacks.map((s) => formatItemLine(s.item)).join(', ');
    const titleKey = direction === 'withdraw' ? 'mineflayerInventory.containers.withdrawAll.title' : 'mineflayerInventory.containers.depositAll.title';
    const titleFallback = direction === 'withdraw' ? 'Withdraw all {count} items from {name}' : 'Deposit all {count} items into {name}';

    const confirmed = await ctx.components.dialog({
      title: ctx.t(titleKey, titleFallback, { values: { count: totalCount, name: win.title } }),
      body: ctx.t('mineflayerInventory.containers.previewBody', '{stacks} stacks, {count} items total, will move: {items}', {
        values: { stacks: stacks.length, count: totalCount, items: itemsSummary }
      })
    });
    if (!confirmed) return;

    busy = true;
    renderContent();
    let moved = 0;
    for (const { slot } of stacks) {
      try {
        await session.call('clickWindow', [slot, 0, CLICK_MODE.shiftClick]);
        moved += 1;
      } catch {
        /* keep going — report the honest partial result below */
      }
    }
    await refreshOpenWindow(session);
    busy = false;
    ctx.notify.success(
      ctx.t('mineflayerInventory.containers.moveResult', '{moved} of {total} stacks moved.', { values: { moved, total: stacks.length } })
    );
    renderContent();
  }

  function section(titleKey: string, fallback: string, cells: SlotGridCell[], columns: number, session: ActiveSession | null): HTMLElement {
    const card = ctx.components.card({ variant: 'outlined' });
    card.classList.add('mineflayer-inventory-section');
    card.append(ctx.components.sectionHeading({ title: ctx.t(titleKey, fallback) }));
    const grid = createSlotGrid(ctx, {
      ariaLabel: ctx.t(titleKey, fallback),
      columns,
      cells,
      picker,
      getItem: (slot) => openWindow?.slots[slot] ?? null,
      enabled: () => Boolean(session?.spawned) && !busy,
      disabledReason: () =>
        busy
          ? ctx.t('mineflayerInventory.disabled.actionPending', 'Another action on this window is still in flight — wait for it to finish before starting another.')
          : ctx.t('mineflayerInventory.disabled.notReady', 'The active bot is not spawned into the world right now, so nothing here can be moved.'),
      onMove: (source, dest) => {
        void move(source, dest);
      }
    });
    mountedGrids.push(grid);
    card.append(grid.root);
    return card;
  }

  function renderNearbyList(): void {
    const wrap = document.createElement('div');
    wrap.className = 'mineflayer-inventory-section';
    wrap.append(ctx.components.sectionHeading({ title: ctx.t('mineflayerInventory.containers.nearbyLabel', 'Nearby containers') }));
    wrap.append(search.root);

    if (filtered.length === 0) {
      wrap.append(
        ctx.components.emptyState({
          title: ctx.t('mineflayerInventory.containers.none', 'No matching container was found within {radius} blocks.', {
            values: { radius: ctx.settings.get<number>(SEARCH_RADIUS_ID, DEFAULT_SEARCH_RADIUS) }
          })
        })
      );
    } else {
      const list = ctx.components.list({ label: ctx.t('mineflayerInventory.containers.nearbyLabel', 'Nearby containers') });
      list.classList.add('mineflayer-inventory-nearby-list');
      for (const block of filtered) {
        list.append(
          ctx.components.listItem({
            headline: block.displayName,
            supporting: `${Math.round(block.distance)} — ${block.position.x}, ${block.position.y}, ${block.position.z}`,
            trailing: ctx.components.button({
              label: ctx.t('mineflayerInventory.containers.open', 'Open'),
              variant: 'tonal',
              disabled: busy,
              disabledReason: ctx.t('mineflayerInventory.disabled.actionPending', 'Another action on this window is still in flight — wait for it to finish before starting another.'),
              onClick: () => void openContainer(block)
            })
          })
        );
      }
      wrap.append(list);
    }

    const toolbar = document.createElement('div');
    toolbar.className = 'mineflayer-inventory-toolbar';
    toolbar.append(
      ctx.components.button({
        label: ctx.t('mineflayerInventory.action.refresh', 'Refresh'),
        variant: 'text',
        icon: 'refresh',
        onClick: async () => {
          await refreshNearby();
          renderContent();
        }
      }),
      ctx.components.button({
        label: ctx.t('core.action.export', 'Export'),
        variant: 'text',
        icon: 'download',
        disabled: filtered.length === 0,
        disabledReason: ctx.t('mineflayerInventory.containers.nothingToMove', 'There is nothing to move.'),
        onClick: async () => {
          const rows = filtered.map((b) => ({ name: b.name, displayName: b.displayName, distance: b.distance, ...b.position }));
          const path = await ctx.exporter.save(rows, 'json', { name: 'nearby-containers', defaultFileName: 'nearby-containers.json' });
          if (path) ctx.notify.success(ctx.t('core.export.saved', 'Saved to {path}', { values: { path } }));
        }
      })
    );
    content.append(toolbar);
    content.append(wrap);
  }

  function renderOpenWindow(session: ActiveSession | null): void {
    if (!openWindow) return;
    const toolbar = document.createElement('div');
    toolbar.className = 'mineflayer-inventory-toolbar';
    toolbar.append(
      ctx.components.button({
        label: ctx.t('mineflayerInventory.containers.close', 'Close container'),
        variant: 'text',
        icon: 'close',
        onClick: () => void closeContainer()
      }),
      ctx.components.button({
        label: ctx.t('mineflayerInventory.containers.withdrawAll', 'Withdraw all'),
        variant: 'tonal',
        icon: 'download',
        disabled: busy,
        disabledReason: ctx.t('mineflayerInventory.disabled.actionPending', 'Another action on this window is still in flight — wait for it to finish before starting another.'),
        onClick: () => void bulkTransfer('withdraw')
      }),
      ctx.components.button({
        label: ctx.t('mineflayerInventory.containers.depositAll', 'Deposit all'),
        variant: 'tonal',
        icon: 'upload',
        disabled: busy,
        disabledReason: ctx.t('mineflayerInventory.disabled.actionPending', 'Another action on this window is still in flight — wait for it to finish before starting another.'),
        onClick: () => void bulkTransfer('deposit')
      }),
      ctx.components.button({
        label: ctx.t('core.action.export', 'Export'),
        variant: 'text',
        icon: 'download',
        onClick: async () => {
          const win = openWindow;
          if (!win) return;
          const rows = win.slots
            .map((item, slot) => (item ? { slot, name: item.name, displayName: item.displayName, count: item.count } : null))
            .filter((row): row is { slot: number; name: string; displayName: string; count: number } => row !== null);
          const path = await ctx.exporter.save(rows, 'json', { name: 'container-contents', defaultFileName: 'container-contents.json' });
          if (path) ctx.notify.success(ctx.t('core.export.saved', 'Saved to {path}', { values: { path } }));
        }
      })
    );
    content.append(toolbar);

    const grid = document.createElement('div');
    grid.className = 'mineflayer-inventory-body';
    content.append(grid);

    const win = openWindow;
    const inventoryStart = win.inventoryStart ?? win.slotCount;
    const inventoryEnd = win.inventoryEnd ?? win.slotCount;
    const containerCount = inventoryStart;
    const containerColumns = containerCount === 9 ? 3 : Math.min(9, Math.max(1, containerCount));

    grid.append(
      section(
        'mineflayerInventory.containers.section.container',
        'Container',
        Array.from({ length: containerCount }, (_, i) => ({ slot: i, label: `${win.title} ${i + 1}` })),
        containerColumns,
        session
      )
    );
    grid.append(
      section(
        'mineflayerInventory.containers.section.yourInventory',
        'Your inventory',
        Array.from({ length: Math.max(0, inventoryEnd - inventoryStart) }, (_, i) => ({
          slot: inventoryStart + i,
          label: `Inventory ${i + 1}`
        })),
        9,
        session
      )
    );
  }

  function renderContent(): void {
    if (disposed) return;
    for (const grid of mountedGrids) grid.destroy();
    mountedGrids = [];
    content.replaceChildren();

    const session = activeSession();
    if (!session) {
      content.append(
        ctx.components.emptyState({
          title: ctx.t('mineflayerInventory.empty.noBot.title', 'No bot is connected'),
          body: ctx.t('mineflayerInventory.empty.noBot.body', 'Connect a bot from the Bots tab first. This tab drives whichever bot is active there.')
        })
      );
      return;
    }
    if (!session.spawned) {
      content.append(
        ctx.components.emptyState({
          title: ctx.t('mineflayerInventory.empty.notSpawned.title', 'The bot has not spawned into the world yet'),
          body: ctx.t('mineflayerInventory.empty.notSpawned.body', 'Slot data only exists once the bot has spawned. Current status: {status}.', {
            values: { status: session.status }
          })
        })
      );
      return;
    }

    if (openWindow) {
      renderOpenWindow(session);
      return;
    }
    if (openError) {
      content.append(
        ctx.components.emptyState({
          title: ctx.t('mineflayerInventory.containers.openFailed', 'Opening {name} failed: {error}', { values: { name: '', error: openError } }),
          body: openError
        })
      );
    }
    renderNearbyList();
  }

  void refreshNearby().then(renderContent);
  renderContent();
}
