/**
 * A grid of item slots that can be moved between by pointer drag AND by
 * keyboard (select a slot, then select its destination) — the two required
 * routes for row 15.5. Both routes call the same `onMove(source, dest)`.
 *
 * Each cell is a real `<button>`, so it is natively focusable, has a real
 * pressed/selected state, and Enter/Space activate it with no extra wiring.
 * Right-click is never intercepted here, so the host application's own
 * "Edit appearance…" / "Lock this element…" context menu keeps working on
 * every cell automatically, exactly as the integration contract requires.
 *
 * One window (the player's own inventory, a chest, a furnace…) is usually
 * rendered as *several* `createSlotGrid` calls — one per visually distinct
 * section (crafting grid, armour, main inventory, hotbar…) — so a "pick" made
 * in one section and a "destination" chosen in another still moves the item.
 * `createPickController` is the shared state that makes that work: build one
 * per open window and pass it to every `createSlotGrid` call for that window.
 */

import type { AppContext } from '../../core/registry';
import type { SerializedItem } from './types';
import { itemAccessibleLabel, renderItemGlyph } from './item-view';

export interface PickController {
  get(): number | null;
  set(slot: number | null): void;
  subscribe(listener: (slot: number | null) => void): () => void;
}

export function createPickController(): PickController {
  let picked: number | null = null;
  const listeners = new Set<(slot: number | null) => void>();
  return {
    get: () => picked,
    set: (slot) => {
      picked = slot;
      for (const listener of [...listeners]) listener(slot);
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    }
  };
}

export interface SlotGridCell {
  slot: number;
  /** A short label used inside the accessible name, e.g. "Hotbar 3" or "Slot 12". */
  label: string;
  /** Extra CSS class for this one cell (e.g. to mark armor slots). */
  variant?: string;
}

export interface SlotGridOptions {
  ariaLabel: string;
  columns: number;
  cells: SlotGridCell[];
  picker: PickController;
  getItem(slot: number): SerializedItem | null;
  /** Whether interaction is currently possible at all (bot spawned, no destructive gate pending). */
  enabled(): boolean;
  disabledReason(): string;
  onMove(source: number, dest: number): void;
}

export interface SlotGridHandle {
  root: HTMLElement;
  refresh(): void;
  destroy(): void;
}

export function createSlotGrid(ctx: AppContext, options: SlotGridOptions): SlotGridHandle {
  const root = document.createElement('div');
  root.className = 'mineflayer-inventory-grid';
  root.style.setProperty('--mineflayer-inventory-grid-columns', String(options.columns));
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', options.ariaLabel);

  const buttons = new Map<number, HTMLButtonElement>();
  const tooltipCleanups = new Map<number, () => void>();
  let dragSource: number | null = null;

  function refreshCell(cell: SlotGridCell): void {
    const button = buttons.get(cell.slot);
    if (!button) return;
    const item = options.getItem(cell.slot);
    const picked = options.picker.get();
    button.replaceChildren(renderItemGlyph(item));
    button.setAttribute('aria-label', itemAccessibleLabel(ctx, item, cell.label));
    button.classList.toggle('mineflayer-inventory-slot-filled', item !== null);
    button.classList.toggle('mineflayer-inventory-slot-picked', picked === cell.slot);
    button.setAttribute('aria-pressed', picked === cell.slot ? 'true' : 'false');
    const enabled = options.enabled();
    button.disabled = !enabled;
    button.classList.toggle('mineflayer-inventory-slot-disabled', !enabled);
    button.draggable = enabled && item !== null;
    const existingTooltip = tooltipCleanups.get(cell.slot);
    if (!enabled && !existingTooltip) {
      tooltipCleanups.set(cell.slot, ctx.components.tooltip(button, options.disabledReason()));
    } else if (enabled && existingTooltip) {
      existingTooltip();
      tooltipCleanups.delete(cell.slot);
    }
  }

  function refresh(): void {
    for (const cell of options.cells) refreshCell(cell);
  }

  function activate(cell: SlotGridCell): void {
    if (!options.enabled()) return;
    const item = options.getItem(cell.slot);
    const picked = options.picker.get();
    if (picked === null) {
      if (item === null) return; // nothing to pick up from an empty slot
      options.picker.set(cell.slot);
      return;
    }
    if (picked === cell.slot) {
      options.picker.set(null); // toggle the pick-up off
      return;
    }
    options.picker.set(null);
    options.onMove(picked, cell.slot);
  }

  for (const cell of options.cells) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'mineflayer-inventory-slot';
    if (cell.variant) button.classList.add(`mineflayer-inventory-slot-${cell.variant}`);
    button.dataset.slot = String(cell.slot);
    button.addEventListener('click', () => activate(cell));
    button.addEventListener('dragstart', (event) => {
      if (!options.enabled() || options.getItem(cell.slot) === null) {
        event.preventDefault();
        return;
      }
      dragSource = cell.slot;
      event.dataTransfer?.setData('text/plain', String(cell.slot));
      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
    });
    button.addEventListener('dragend', () => {
      dragSource = null;
    });
    button.addEventListener('dragover', (event) => {
      if (dragSource === null || !options.enabled()) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    });
    button.addEventListener('drop', (event) => {
      event.preventDefault();
      const raw = event.dataTransfer?.getData('text/plain');
      const source = raw ? Number.parseInt(raw, 10) : dragSource;
      dragSource = null;
      if (source === null || Number.isNaN(source) || source === cell.slot) return;
      options.picker.set(null);
      options.onMove(source, cell.slot);
    });
    buttons.set(cell.slot, button);
    root.append(button);
  }

  root.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && options.picker.get() !== null) {
      event.preventDefault();
      options.picker.set(null);
    }
  });

  const unsubscribePicker = options.picker.subscribe(refresh);
  refresh();

  return {
    root,
    refresh,
    destroy: () => {
      unsubscribePicker();
      for (const cleanup of tooltipCleanups.values()) cleanup();
      tooltipCleanups.clear();
    }
  };
}
