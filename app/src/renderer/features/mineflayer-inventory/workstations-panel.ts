/**
 * The Workstations tab (row 15.8) — furnace/blast furnace/smoker, anvil, and
 * the enchanting table, each opened generically through the shared runtime's
 * `openBlockAt` (the real `bot.openBlock`), with their slot layouts taken
 * directly from `lib/plugins/furnace.js`, `anvil.js` and
 * `enchantment_table.js`.
 *
 * The shared runtime does not yet forward furnace fuel/cook progress, the
 * anvil's real repair cost, or the enchanting table's three offers — none of
 * those are `bot.openBlock` state, they come only from calling
 * `bot.openFurnace`/`openAnvil`/`openEnchantmentTable` and listening for the
 * `craft_progress_bar` window-property packet those plugins subscribe to,
 * and `../mineflayer/bot-host.js` (a sibling feature's file) does not call
 * any of the three or forward that packet. Every panel below says so plainly,
 * in place of a fabricated number, and still does everything that genuinely
 * *is* possible: opening the real window, seeing its real slot contents, and
 * moving real items in and out of it.
 *
 * Brewing stands and grindstones have no row here because the vendored
 * library ships no `brewing_stand.js` or `grindstone.js` plugin at all — see
 * `docs.ts` for the same note in the shipped documentation.
 */

import type { TabContext } from '../../core/registry';
import type { SerializedWindow, NearbyBlock } from './types';
import { ANVIL_BLOCK_NAMES, ANVIL_SLOTS, CLICK_MODE, ENCHANTING_TABLE_BLOCK_NAMES, ENCHANTMENT_SLOTS, FURNACE_BLOCK_NAMES, FURNACE_SLOTS } from './types';
import { createPickController, createSlotGrid, type SlotGridCell, type SlotGridHandle } from './slot-grid';
import { activeSession, describeCallError, fetchCurrentWindow, findNearbyBlocks, pollWhile, subscribeSession, type ActiveSession } from './session';
import { AUTO_REFRESH_ID, DEFAULT_SEARCH_LIMIT, DEFAULT_SEARCH_RADIUS, POLL_INTERVAL_MS, SEARCH_LIMIT_ID, SEARCH_RADIUS_ID } from './settings';

type StationKind = 'furnace' | 'anvil' | 'enchanting';

interface StationConfig {
  kind: StationKind;
  blockNames: string[];
  titleKey: string;
  titleFallback: string;
  slots: Array<{ slot: number; labelKey: string; fallback: string; variant?: string }>;
  noteKey: string;
  noteFallback: string;
}

const STATIONS: StationConfig[] = [
  {
    kind: 'furnace',
    blockNames: FURNACE_BLOCK_NAMES,
    titleKey: 'mineflayerInventory.workstations.furnace',
    titleFallback: 'Furnace family',
    slots: [
      { slot: FURNACE_SLOTS.input, labelKey: 'mineflayerInventory.workstations.furnace.input', fallback: 'Input', variant: 'station' },
      { slot: FURNACE_SLOTS.fuel, labelKey: 'mineflayerInventory.workstations.furnace.fuel', fallback: 'Fuel', variant: 'station' },
      { slot: FURNACE_SLOTS.output, labelKey: 'mineflayerInventory.workstations.furnace.output', fallback: 'Output', variant: 'station' }
    ],
    noteKey: 'mineflayerInventory.workstations.furnace.progressUnavailable',
    noteFallback:
      'Live burn and cook progress is not available yet: the shared bot runtime does not currently forward furnace fuel/progress updates. The input, fuel and output slots above are real and update on refresh.'
  },
  {
    kind: 'anvil',
    blockNames: ANVIL_BLOCK_NAMES,
    titleKey: 'mineflayerInventory.workstations.anvil',
    titleFallback: 'Anvil',
    slots: [
      { slot: ANVIL_SLOTS.itemOne, labelKey: 'mineflayerInventory.workstations.anvil.itemOne', fallback: 'First item', variant: 'station' },
      { slot: ANVIL_SLOTS.itemTwo, labelKey: 'mineflayerInventory.workstations.anvil.itemTwo', fallback: 'Second item / material', variant: 'station' },
      { slot: ANVIL_SLOTS.result, labelKey: 'mineflayerInventory.workstations.anvil.result', fallback: 'Result', variant: 'station' }
    ],
    noteKey: 'mineflayerInventory.workstations.anvil.costUnavailable',
    noteFallback:
      'The real repair cost is not shown: the shared bot runtime does not currently forward the anvil\'s cost, and there is no runtime method yet for renaming. Placing two items here still works — the server computes the real result, shown above once it appears.'
  },
  {
    kind: 'enchanting',
    blockNames: ENCHANTING_TABLE_BLOCK_NAMES,
    titleKey: 'mineflayerInventory.workstations.enchanting',
    titleFallback: 'Enchanting table',
    slots: [
      { slot: ENCHANTMENT_SLOTS.target, labelKey: 'mineflayerInventory.workstations.enchant.target', fallback: 'Item to enchant', variant: 'station' },
      { slot: ENCHANTMENT_SLOTS.lapis, labelKey: 'mineflayerInventory.workstations.enchant.lapis', fallback: 'Lapis lazuli', variant: 'station' }
    ],
    noteKey: 'mineflayerInventory.workstations.enchant.offersUnavailable',
    noteFallback:
      'The three enchantment offers, their real cost and their level requirement are not shown: the shared bot runtime does not yet forward the enchanting table\'s offers, and there is no runtime method yet to choose one. The item and lapis slots above are real.'
  }
];

export function mountWorkstationsTab(host: HTMLElement, ctx: TabContext): void {
  host.classList.add('mineflayer-inventory-panel');
  host.append(
    ctx.components.topAppBar({
      title: ctx.t('mineflayerInventory.tab.workstations', 'Workstations'),
      subtitle: ctx.t('mineflayerInventory.tab.workstations.subtitle', 'Furnaces, blast furnaces, smokers, the anvil and the enchanting table')
    })
  );

  const content = document.createElement('div');

  let disposed = false;
  let station: StationConfig = STATIONS[0];
  let nearby: NearbyBlock[] = [];
  let filtered: NearbyBlock[] = [];
  let openWindow: SerializedWindow | null = null;
  let busy = false;
  const picker = createPickController();
  /** Every slot-grid mounted by the current render, torn down at the start of the next one so no tooltip listener leaks. */
  let mountedGrids: SlotGridHandle[] = [];

  const chooser = ctx.components.segmentedButton({
    label: ctx.t('mineflayerInventory.workstations.chooser', 'Station'),
    options: STATIONS.map((s) => ({ value: s.kind, label: ctx.t(s.titleKey, s.titleFallback) })),
    value: 'furnace',
    onChange: (value) => {
      station = STATIONS.find((s) => s.kind === value) ?? STATIONS[0];
      nearby = [];
      filtered = [];
      openWindow = null;
      picker.set(null);
      void refreshNearby().then(renderContent);
    }
  });
  host.append(chooser.root);
  host.append(content);

  const search = ctx.createSearchBar({
    label: 'mineflayerInventory.containers.search',
    sample: '',
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
        station.blockNames,
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
      openWindow = await fetchCurrentWindow(session);
    } catch {
      /* leave the last known snapshot in place */
    }
  }

  const stopPoll = pollWhile(async () => {
    if (disposed || busy) return;
    const session = activeSession();
    if (!session || !session.spawned) return;
    if (openWindow) {
      if (ctx.settings.get<boolean>(AUTO_REFRESH_ID, true)) await refreshOpenWindow(session);
    } else {
      await refreshNearby();
    }
    renderContent();
  }, POLL_INTERVAL_MS);

  const unsubscribe = subscribeSession(() => renderContent());
  ctx.onDispose(() => {
    disposed = true;
    stopPoll();
    unsubscribe();
    for (const grid of mountedGrids) grid.destroy();
    mountedGrids = [];
  });

  async function openStation(block: NearbyBlock): Promise<void> {
    const session = activeSession();
    if (!session) return;
    busy = true;
    renderContent();
    try {
      openWindow = await session.call<SerializedWindow>('openBlockAt', [block.position]);
    } catch (error) {
      ctx.notify.error(
        ctx.t('mineflayerInventory.workstations.openFailed', 'Opening {name} failed: {error}', {
          values: { name: block.displayName, error: describeCallError(error) }
        })
      );
    }
    busy = false;
    renderContent();
  }

  async function closeStation(): Promise<void> {
    const session = activeSession();
    if (!session) return;
    try {
      await session.call('closeWindow');
    } catch {
      /* already gone */
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
        ctx.t('mineflayerInventory.inventory.moveFailed', 'That move was refused: {error}', { values: { error: describeCallError(error) } })
      );
    }
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
      onMove: (source, dest) => void move(source, dest)
    });
    mountedGrids.push(grid);
    card.append(grid.root);
    return card;
  }

  function renderOpenWindow(session: ActiveSession | null): void {
    if (!openWindow) return;
    const toolbar = document.createElement('div');
    toolbar.className = 'mineflayer-inventory-toolbar';
    toolbar.append(
      ctx.components.button({
        label: ctx.t('mineflayerInventory.workstations.close', 'Close'),
        variant: 'text',
        icon: 'close',
        onClick: () => void closeStation()
      })
    );
    if (station.kind === 'anvil') {
      toolbar.append(
        ctx.components.button({
          label: ctx.t('mineflayerInventory.workstations.anvil.collectResult', 'Collect the result'),
          variant: 'tonal',
          disabled: busy || !openWindow.slots[ANVIL_SLOTS.result],
          disabledReason: ctx.t('mineflayerInventory.disabled.notReady', 'The active bot is not spawned into the world right now, so nothing here can be moved.'),
          onClick: async () => {
            const session_ = activeSession();
            if (!session_) return;
            try {
              await session_.call('clickWindow', [ANVIL_SLOTS.result, 0, CLICK_MODE.shiftClick]);
              await refreshOpenWindow(session_);
            } catch (error) {
              ctx.notify.error(
                ctx.t('mineflayerInventory.workstations.anvil.collectFailed', 'Collecting the result failed: {error}', {
                  values: { error: describeCallError(error) }
                })
              );
            }
            renderContent();
          }
        })
      );
    }
    content.append(toolbar);

    const note = document.createElement('div');
    note.className = 'mineflayer-inventory-capability-note md-typescale-body-small';
    note.append(ctx.components.icon('info', { size: 20 }));
    const noteText = document.createElement('span');
    noteText.textContent = ctx.t(station.noteKey, station.noteFallback);
    note.append(noteText);
    content.append(note);

    const grid = document.createElement('div');
    grid.className = 'mineflayer-inventory-body';
    content.append(grid);

    grid.append(
      section(
        station.titleKey,
        station.titleFallback,
        station.slots.map((s) => ({ slot: s.slot, label: ctx.t(s.labelKey, s.fallback), variant: s.variant })),
        station.slots.length,
        session
      )
    );

    const win = openWindow;
    const inventoryStart = win.inventoryStart ?? win.slotCount;
    const inventoryEnd = win.inventoryEnd ?? win.slotCount;
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

  function renderNearbyList(): void {
    const wrap = document.createElement('div');
    wrap.className = 'mineflayer-inventory-section';
    wrap.append(ctx.components.sectionHeading({ title: ctx.t('mineflayerInventory.workstations.nearbyLabel', 'Nearby stations') }));
    wrap.append(search.root);

    if (filtered.length === 0) {
      wrap.append(
        ctx.components.emptyState({
          title: ctx.t('mineflayerInventory.workstations.none', 'No matching station was found within {radius} blocks.', {
            values: { radius: ctx.settings.get<number>(SEARCH_RADIUS_ID, DEFAULT_SEARCH_RADIUS) }
          })
        })
      );
    } else {
      const list = ctx.components.list({ label: ctx.t('mineflayerInventory.workstations.nearbyLabel', 'Nearby stations') });
      list.classList.add('mineflayer-inventory-nearby-list');
      for (const block of filtered) {
        list.append(
          ctx.components.listItem({
            headline: block.displayName,
            supporting: `${Math.round(block.distance)} — ${block.position.x}, ${block.position.y}, ${block.position.z}`,
            trailing: ctx.components.button({
              label: ctx.t('mineflayerInventory.workstations.open', 'Open'),
              variant: 'tonal',
              disabled: busy,
              disabledReason: ctx.t('mineflayerInventory.disabled.actionPending', 'Another action on this window is still in flight — wait for it to finish before starting another.'),
              onClick: () => void openStation(block)
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
        disabledReason: ctx.t('mineflayerInventory.workstations.none', 'No matching station was found within {radius} blocks.', {
          values: { radius: ctx.settings.get<number>(SEARCH_RADIUS_ID, DEFAULT_SEARCH_RADIUS) }
        }),
        onClick: async () => {
          const rows = filtered.map((b) => ({ name: b.name, displayName: b.displayName, distance: b.distance, ...b.position }));
          const path = await ctx.exporter.save(rows, 'json', { name: 'nearby-stations', defaultFileName: 'nearby-stations.json' });
          if (path) ctx.notify.success(ctx.t('core.export.saved', 'Saved to {path}', { values: { path } }));
        }
      })
    );
    content.append(toolbar);
    content.append(wrap);
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
    renderNearbyList();
  }

  void refreshNearby().then(renderContent);
  renderContent();
}
