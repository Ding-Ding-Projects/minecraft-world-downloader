/**
 * The Inventory tab (row 15.5) — the bot's own real 46/45-slot window,
 * covering `lib/plugins/inventory.js` and `lib/plugins/simple_inventory.js`.
 */

import type { TabContext } from '../../core/registry';
import type { SerializedItem, SerializedWindow } from './types';
import {
  ARMOR_SLOTS,
  CRAFT_GRID_SLOTS,
  CRAFT_RESULT_SLOT,
  HOTBAR_COUNT,
  HOTBAR_START,
  MAIN_INVENTORY_COUNT,
  MAIN_INVENTORY_START,
  OFFHAND_SLOT
} from './types';
import { createPickController, createSlotGrid, type SlotGridCell, type SlotGridHandle } from './slot-grid';
import { formatItemLine } from './item-view';
import { activeSession, describeCallError, fetchInventory, pollWhile, subscribeSession, type ActiveSession } from './session';
import { AUTO_REFRESH_ID, POLL_INTERVAL_MS } from './settings';

const EQUIP_DESTINATIONS: Array<{ value: string; labelKey: string; fallback: string }> = [
  { value: 'hand', labelKey: 'mineflayerInventory.inventory.action.equipHand', fallback: 'Equip to hand' },
  { value: 'off-hand', labelKey: 'mineflayerInventory.inventory.action.equipOffhand', fallback: 'Equip to off hand' },
  { value: 'head', labelKey: 'mineflayerInventory.inventory.action.equipHead', fallback: 'Equip to head' },
  { value: 'torso', labelKey: 'mineflayerInventory.inventory.action.equipTorso', fallback: 'Equip to chest' },
  { value: 'legs', labelKey: 'mineflayerInventory.inventory.action.equipLegs', fallback: 'Equip to legs' },
  { value: 'feet', labelKey: 'mineflayerInventory.inventory.action.equipFeet', fallback: 'Equip to feet' }
];

export function mountInventoryTab(host: HTMLElement, ctx: TabContext): void {
  host.classList.add('mineflayer-inventory-panel');
  host.append(
    ctx.components.topAppBar({
      title: ctx.t('mineflayerInventory.tab.inventory', 'Inventory'),
      subtitle: ctx.t('mineflayerInventory.tab.inventory.subtitle', 'The bot\'s real slots, moved by drag or by keyboard')
    })
  );

  const body = document.createElement('div');
  body.className = 'mineflayer-inventory-toolbar';
  host.append(body);

  const content = document.createElement('div');
  host.append(content);

  let disposed = false;
  let window_: SerializedWindow | null = null;
  let lastError: string | null = null;
  let busy = false;
  const picker = createPickController();
  /** Every slot-grid mounted by the current render, torn down at the start of the next one so no tooltip listener leaks. */
  let mountedGrids: SlotGridHandle[] = [];

  const stopPoll = pollWhile(
    async () => {
      if (disposed) return;
      const session = activeSession();
      if (!session || !session.spawned) return;
      if (!ctx.settings.get<boolean>(AUTO_REFRESH_ID, true) && window_ !== null) return;
      try {
        window_ = await fetchInventory(session);
        lastError = null;
      } catch (error) {
        lastError = describeCallError(error);
      }
      renderContent();
    },
    POLL_INTERVAL_MS,
    (error) => {
      lastError = describeCallError(error);
      renderContent();
    }
  );

  const unsubscribe = subscribeSession(() => renderContent());
  ctx.onDispose(() => {
    disposed = true;
    stopPoll();
    unsubscribe();
    for (const grid of mountedGrids) grid.destroy();
    mountedGrids = [];
  });

  function itemAt(slot: number): SerializedItem | null {
    return window_?.slots[slot] ?? null;
  }

  async function move(source: number, dest: number): Promise<void> {
    const session = activeSession();
    if (!session || busy) return;
    busy = true;
    renderContent();
    try {
      await session.call('moveSlotItem', [source, dest]);
      window_ = await fetchInventory(session);
    } catch (error) {
      ctx.notify.error(
        ctx.t('mineflayerInventory.inventory.moveFailed', 'That move was refused: {error}', {
          values: { error: describeCallError(error) }
        })
      );
    }
    busy = false;
    renderContent();
  }

  function renderPickedActions(host: HTMLElement, session: ActiveSession | null): void {
    const slot = picker.get();
    const bar = document.createElement('div');
    bar.className = 'mineflayer-inventory-actionbar';
    bar.setAttribute('role', 'status');
    bar.setAttribute('aria-live', 'polite');

    if (slot === null) {
      bar.classList.add('md-typescale-body-medium');
      bar.textContent = ctx.t('mineflayerInventory.inventory.pickedHint.empty', 'Select a slot with an item in it to pick it up, then select where it should go.');
      host.append(bar);
      return;
    }

    const item = itemAt(slot);
    if (!item) {
      picker.set(null);
      return;
    }

    const hint = document.createElement('div');
    hint.className = 'md-typescale-body-medium';
    hint.textContent = ctx.t('mineflayerInventory.inventory.pickedHint', 'Picked up {name}. Choose a destination slot, or press it again to put it back.', {
      values: { name: formatItemLine(item) }
    });
    bar.append(hint);

    const actions = document.createElement('div');
    actions.className = 'mineflayer-inventory-toolbar';
    bar.append(actions);

    const canAct = session?.spawned === true && !busy;
    const disabledReason = busy
      ? ctx.t('mineflayerInventory.disabled.actionPending', 'Another action on this window is still in flight — wait for it to finish before starting another.')
      : ctx.t('mineflayerInventory.disabled.notReady', 'The active bot is not spawned into the world right now, so nothing here can be moved.');

    const destinationSelect = ctx.components.select({
      label: ctx.t('mineflayerInventory.inventory.action.equipDestination', 'Destination'),
      options: EQUIP_DESTINATIONS.map((d) => ({ value: d.value, label: ctx.t(d.labelKey, d.fallback) })),
      value: 'hand',
      disabled: !canAct,
      disabledReason
    });
    actions.append(destinationSelect.root);

    actions.append(
      ctx.components.button({
        label: ctx.t('mineflayerInventory.inventory.action.equip', 'Equip'),
        variant: 'tonal',
        disabled: !canAct,
        disabledReason,
        onClick: async () => {
          if (!session || busy) return;
          const destination = destinationSelect.get();
          busy = true;
          renderContent();
          try {
            await session.call('equip', [item.name, destination]);
            window_ = await fetchInventory(session);
            picker.set(null);
          } catch (error) {
            ctx.notify.error(
              ctx.t('mineflayerInventory.inventory.equipFailed', 'Equipping {name} failed: {error}', {
                values: { name: item.displayName || item.name, error: describeCallError(error) }
              })
            );
          }
          busy = false;
          renderContent();
        }
      })
    );

    actions.append(
      ctx.components.button({
        label: ctx.t('mineflayerInventory.inventory.action.dropOne', 'Drop one'),
        variant: 'text',
        disabled: !canAct,
        disabledReason,
        onClick: async () => {
          if (!session || busy) return;
          busy = true;
          renderContent();
          try {
            await session.call('toss', [item.name, null, 1]);
            window_ = await fetchInventory(session);
            picker.set(null);
          } catch (error) {
            ctx.notify.error(
              ctx.t('mineflayerInventory.inventory.tossFailed', 'Dropping {name} failed: {error}', {
                values: { name: item.displayName || item.name, error: describeCallError(error) }
              })
            );
          }
          busy = false;
          renderContent();
        }
      })
    );

    actions.append(
      ctx.components.button({
        label: ctx.t('mineflayerInventory.inventory.action.dropStack', 'Drop the stack'),
        variant: 'text',
        disabled: !canAct,
        disabledReason,
        onClick: async () => {
          if (!session || busy) return;
          busy = true;
          renderContent();
          try {
            await session.call('toss', [item.name, null, item.count]);
            window_ = await fetchInventory(session);
            picker.set(null);
          } catch (error) {
            ctx.notify.error(
              ctx.t('mineflayerInventory.inventory.tossFailed', 'Dropping {name} failed: {error}', {
                values: { name: item.displayName || item.name, error: describeCallError(error) }
              })
            );
          }
          busy = false;
          renderContent();
        }
      })
    );

    if (slot >= MAIN_INVENTORY_START) {
      actions.append(
        ctx.components.button({
          label: ctx.t('mineflayerInventory.inventory.action.quickMove', 'Quick-move to hotbar'),
          variant: 'text',
          disabled: !canAct,
          disabledReason,
          onClick: async () => {
            if (!session || busy) return;
            busy = true;
            renderContent();
            try {
              await session.call('clickWindow', [slot, 0, 1]);
              window_ = await fetchInventory(session);
              picker.set(null);
            } catch (error) {
              ctx.notify.error(
                ctx.t('mineflayerInventory.inventory.moveFailed', 'That move was refused: {error}', {
                  values: { error: describeCallError(error) }
                })
              );
            }
            busy = false;
            renderContent();
          }
        })
      );
    }

    if (item.count > 1) {
      actions.append(
        ctx.components.button({
          label: ctx.t('mineflayerInventory.inventory.action.split', 'Split stack'),
          variant: 'text',
          disabled: !canAct,
          disabledReason,
          onClick: async () => {
            if (!session || !window_ || busy) return;
            const empty = findEmptyInventorySlot(window_, slot);
            if (empty === null) {
              ctx.notify.error(
                ctx.t('mineflayerInventory.inventory.moveFailed', 'That move was refused: {error}', {
                  values: { error: 'No empty inventory slot was found to split into.' }
                })
              );
              return;
            }
            busy = true;
            renderContent();
            try {
              await session.call('clickWindow', [slot, 1, 0]);
              await session.call('clickWindow', [empty, 0, 0]);
              window_ = await fetchInventory(session);
              picker.set(null);
            } catch (error) {
              ctx.notify.error(
                ctx.t('mineflayerInventory.inventory.moveFailed', 'That move was refused: {error}', {
                  values: { error: describeCallError(error) }
                })
              );
            }
            busy = false;
            renderContent();
          }
        })
      );
    }

    actions.append(
      ctx.components.button({
        label: ctx.t('mineflayerInventory.inventory.action.cancel', 'Cancel'),
        variant: 'text',
        onClick: () => picker.set(null)
      })
    );

    host.append(bar);
  }

  function findEmptyInventorySlot(win: SerializedWindow, exclude: number): number | null {
    for (let slot = MAIN_INVENTORY_START; slot < HOTBAR_START + HOTBAR_COUNT; slot++) {
      if (slot === exclude) continue;
      if (win.slots[slot] === null) return slot;
    }
    return null;
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
      getItem: itemAt,
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

  function renderContent(): void {
    if (disposed) return;
    for (const grid of mountedGrids) grid.destroy();
    mountedGrids = [];
    content.replaceChildren();
    body.replaceChildren(
      ctx.components.button({
        label: ctx.t('mineflayerInventory.action.refresh', 'Refresh'),
        variant: 'text',
        icon: 'refresh',
        onClick: async () => {
          const session = activeSession();
          if (!session) return;
          try {
            window_ = await fetchInventory(session);
            lastError = null;
          } catch (error) {
            lastError = describeCallError(error);
          }
          renderContent();
        }
      })
    );
    body.append(
      ctx.components.button({
        label: ctx.t('core.action.export', 'Export'),
        variant: 'text',
        icon: 'download',
        disabled: !window_,
        disabledReason: ctx.t('mineflayerInventory.empty.notSpawned.title', 'The bot has not spawned into the world yet'),
        onClick: async () => {
          if (!window_) return;
          const rows = window_.slots
            .map((item, slot) => (item ? { slot, name: item.name, displayName: item.displayName, count: item.count } : null))
            .filter((row): row is { slot: number; name: string; displayName: string; count: number } => row !== null);
          const path = await ctx.exporter.save(rows, 'json', { name: 'bot-inventory', defaultFileName: 'bot-inventory.json' });
          if (path) ctx.notify.success(ctx.t('core.export.saved', 'Saved to {path}', { values: { path } }));
        }
      })
    );

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

    if (lastError && !window_) {
      content.append(
        ctx.components.emptyState({
          title: ctx.t('mineflayerInventory.containers.openFailed', 'Opening {name} failed: {error}', { values: { name: 'inventory', error: lastError } }),
          body: lastError
        })
      );
      return;
    }
    if (!window_) return;

    renderPickedActions(content, session);

    const grid = document.createElement('div');
    grid.className = 'mineflayer-inventory-body';
    content.append(grid);

    const left = document.createElement('div');
    left.className = 'mineflayer-inventory-workstation-body';
    grid.append(left);

    left.append(
      section(
        'mineflayerInventory.inventory.section.craft',
        'Crafting grid',
        [
          { slot: CRAFT_RESULT_SLOT, label: 'Crafting result', variant: 'craftresult' },
          ...CRAFT_GRID_SLOTS.map((slot, index) => ({ slot, label: `Crafting ${index + 1}`, variant: 'craft' }))
        ],
        3,
        session
      )
    );

    left.append(
      section(
        'mineflayerInventory.inventory.section.armor',
        'Armour',
        ARMOR_SLOTS.map((entry) => ({
          slot: entry.slot,
          label: ctx.t(`mineflayerInventory.inventory.label.${entry.destination}`, entry.destination),
          variant: 'armor'
        })),
        4,
        session
      )
    );

    const offhandCells: SlotGridCell[] = window_.slotCount > OFFHAND_SLOT ? [{ slot: OFFHAND_SLOT, label: 'Off hand', variant: 'offhand' }] : [];
    if (offhandCells.length > 0) {
      left.append(section('mineflayerInventory.inventory.section.offhand', 'Off hand', offhandCells, 1, session));
    }

    const right = document.createElement('div');
    right.className = 'mineflayer-inventory-workstation-body';
    grid.append(right);

    right.append(
      section(
        'mineflayerInventory.inventory.section.main',
        'Main inventory',
        Array.from({ length: MAIN_INVENTORY_COUNT }, (_, i) => ({
          slot: MAIN_INVENTORY_START + i,
          label: `Main ${i + 1}`
        })),
        9,
        session
      )
    );
    right.append(
      section(
        'mineflayerInventory.inventory.section.hotbar',
        'Hotbar',
        Array.from({ length: HOTBAR_COUNT }, (_, i) => ({
          slot: HOTBAR_START + i,
          label: `Hotbar ${i + 1}`
        })),
        9,
        session
      )
    );
  }

  renderContent();
}
