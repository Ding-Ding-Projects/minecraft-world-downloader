import { i18n } from './i18n';
import type { MenuItem } from './types';

/**
 * The single source of truth for every live keyboard shortcut in the
 * application, and the reason a menu item's displayed chord can never drift
 * from the chord that actually fires.
 *
 * `components.menu` (core/components.ts) already renders `MenuItem.shortcut`
 * right-aligned in `<kbd>` and mirrors it into `aria-keyshortcuts` for
 * assistive technology. What it does not do — and cannot do on its own — is
 * guarantee that the string a caller typed into `shortcut` is the chord that
 * genuinely works in that context. A literal `shortcut: 'Ctrl+Shift+F'` typed
 * in a menu definition is just a label; nothing stops it from going stale the
 * day the real binding changes.
 *
 * This module closes that gap: `register` installs the live `keydown`
 * listener AND records the display chord in the same call, under the same
 * id. `chordFor` and `menuItemWithShortcut` read that same record, so a menu
 * item's shortcut column is always the chord the registry is actually
 * listening for — never a hand-typed guess that can go out of sync with it.
 */

export interface ShortcutBinding {
  /** Stable id, e.g. `core.palette.toggle`. Never renamed once shipped. */
  id: string;
  /**
   * The chord in platform notation, e.g. `Ctrl+Shift+F`. This exact string is
   * both what is matched against real keydown events and what a menu shows.
   */
  chord: string;
  /** i18n key describing what the shortcut does, for a shortcuts list. */
  label: string;
}

interface Registered extends ShortcutBinding {
  handler: (event: KeyboardEvent) => void;
}

interface ParsedChord {
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  meta: boolean;
  key: string;
}

function parseChord(chord: string): ParsedChord {
  const parts = chord
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean);
  const key = parts[parts.length - 1] ?? '';
  const modifiers = new Set(parts.slice(0, -1).map((part) => part.toLowerCase()));
  return {
    ctrl: modifiers.has('ctrl') || modifiers.has('control'),
    shift: modifiers.has('shift'),
    alt: modifiers.has('alt'),
    meta: modifiers.has('meta') || modifiers.has('cmd') || modifiers.has('command'),
    key: key.toLowerCase()
  };
}

function chordMatches(event: KeyboardEvent, parsed: ParsedChord): boolean {
  if (event.ctrlKey !== parsed.ctrl) return false;
  if (event.shiftKey !== parsed.shift) return false;
  if (event.altKey !== parsed.alt) return false;
  if (event.metaKey !== parsed.meta) return false;
  return event.key.toLowerCase() === parsed.key;
}

class ShortcutRegistry {
  private bindings = new Map<string, Registered>();
  private installed = false;

  /**
   * Registers a live global keyboard shortcut and its display chord as one
   * atomic entry. Returns an unregister function.
   *
   * Throws when `id` is already registered rather than silently letting a
   * second registration shadow the first: two different handlers claiming the
   * same id is exactly the drift this module exists to prevent.
   */
  register(binding: ShortcutBinding, handler: (event: KeyboardEvent) => void): () => void {
    if (this.bindings.has(binding.id)) {
      throw new Error(
        `Shortcut id "${binding.id}" is already registered. Ids are the join key between the live handler and the ` +
          `label a menu shows; two registrations under one id would leave a menu unable to say which chord is real.`
      );
    }
    this.ensureInstalled();
    const parsed = parseChord(binding.chord);
    this.bindings.set(binding.id, {
      ...binding,
      handler: (event) => {
        if (!chordMatches(event, parsed)) return;
        event.preventDefault();
        handler(event);
      }
    });
    return () => {
      this.bindings.delete(binding.id);
    };
  }

  private ensureInstalled(): void {
    if (this.installed) return;
    this.installed = true;
    window.addEventListener('keydown', (event) => {
      for (const binding of this.bindings.values()) binding.handler(event);
    });
  }

  /** The exact chord live for `id`, or `undefined` when nothing is registered. */
  chordFor(id: string): string | undefined {
    return this.bindings.get(id)?.chord;
  }

  /** Every currently live shortcut, for a "Keyboard shortcuts" surface. */
  list(): ShortcutBinding[] {
    return [...this.bindings.values()]
      .map(({ id, chord, label: shortcutLabel }) => ({ id, chord, label: shortcutLabel }))
      .sort((a, b) => a.chord.localeCompare(b.chord));
  }
}

export const shortcuts = new ShortcutRegistry();

/**
 * Builds a `MenuItem` whose `shortcut` is read live from the registry instead
 * of typed as a literal. When nothing is registered under `shortcutId` the
 * field is left unset, so the menu renders no shortcut at all — never a
 * placeholder for a binding that does not exist.
 */
export function menuItemWithShortcut(shortcutId: string, item: Omit<MenuItem, 'shortcut'>): MenuItem {
  const chord = shortcuts.chordFor(shortcutId);
  return chord ? { ...item, shortcut: chord } : item;
}

/** Every live shortcut's label resolved through i18n, for display. */
export function listShortcutsForDisplay(): Array<{ id: string; chord: string; label: string }> {
  return shortcuts.list().map((binding) => ({ ...binding, label: i18n.t(binding.label, binding.label) }));
}
