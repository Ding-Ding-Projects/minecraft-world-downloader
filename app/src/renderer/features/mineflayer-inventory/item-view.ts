/**
 * Renders one item as a labelled placeholder.
 *
 * No per-item texture is bundled with this feature — Minecraft's real item
 * artwork is Mojang's, not this application's to redistribute — so every
 * item, in every slot, in every panel, renders the same honest fallback: a
 * coloured chip carrying the item's own short initials, its exact count, and
 * its full real name as the accessible label and tooltip. Nothing here
 * fetches an icon from anywhere.
 */

import type { AppContext } from '../../core/registry';
import type { SerializedItem } from './types';

/** A stable, readable hue for one item name, so different items are visually distinguishable without a real texture. */
function hueFor(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return hash % 360;
}

function initialsFor(displayName: string): string {
  const words = displayName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function itemAccessibleLabel(ctx: AppContext, item: SerializedItem | null, slotLabel: string): string {
  if (!item) {
    return ctx.t('mineflayerInventory.slot.empty', '{slot}: empty', { values: { slot: slotLabel } });
  }
  const durability = item.maxDurability
    ? ctx.t('mineflayerInventory.slot.durability', ', {used} of {max} durability used', {
        values: { used: item.durabilityUsed ?? 0, max: item.maxDurability }
      })
    : '';
  return ctx.t('mineflayerInventory.slot.filled', '{slot}: {name} times {count}{durability}', {
    values: { slot: slotLabel, name: item.displayName || item.name, count: item.count, durability }
  });
}

/** Builds (or refreshes, if `existing` is a live glyph) the coloured placeholder + count badge for one item. */
export function renderItemGlyph(item: SerializedItem | null): HTMLElement {
  const glyph = document.createElement('span');
  glyph.className = 'mineflayer-inventory-glyph';
  if (!item) {
    glyph.classList.add('mineflayer-inventory-glyph-empty');
    return glyph;
  }
  const hue = hueFor(item.name);
  glyph.style.setProperty('--mineflayer-inventory-glyph-hue', String(hue));
  const initials = document.createElement('span');
  initials.className = 'mineflayer-inventory-glyph-initials';
  initials.textContent = initialsFor(item.displayName || item.name);
  glyph.append(initials);
  if (item.count > 1) {
    const count = document.createElement('span');
    count.className = 'mineflayer-inventory-glyph-count';
    count.textContent = String(item.count);
    glyph.append(count);
  }
  if (item.maxDurability && item.maxDurability > 0) {
    const remaining = Math.max(0, item.maxDurability - (item.durabilityUsed ?? 0)) / item.maxDurability;
    const bar = document.createElement('span');
    bar.className = 'mineflayer-inventory-glyph-durability';
    const fill = document.createElement('span');
    fill.style.width = `${Math.round(remaining * 100)}%`;
    fill.className = remaining < 0.25 ? 'mineflayer-inventory-glyph-durability-low' : '';
    bar.append(fill);
    glyph.append(bar);
  }
  return glyph;
}

export function formatItemLine(item: SerializedItem): string {
  return `${item.displayName || item.name} ×${item.count}`;
}
