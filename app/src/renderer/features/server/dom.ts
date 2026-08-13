import type { AppContext } from '../../core/registry';

/**
 * Small building blocks shared by the two destinations in this feature.
 *
 * Nothing here re-implements a component the kit already provides. What it does
 * hold is the collapsible section — which the contract asks for by name, with
 * the descriptive statistics panel starting closed — and the selection model
 * that gives every list in this feature shift-ranges and a keyboard equivalent.
 */

export function node<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options: {
    className?: string;
    text?: string;
    attrs?: Record<string, string>;
    children?: Array<Node | null | undefined>;
  } = {}
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (options.className) element.className = options.className;
  if (options.text !== undefined) element.textContent = options.text;
  if (options.attrs) {
    for (const [key, value] of Object.entries(options.attrs)) element.setAttribute(key, value);
  }
  if (options.children) {
    for (const child of options.children) if (child) element.append(child);
  }
  return element;
}

/* ------------------------------------------------------------------ */
/* Collapsible sections                                                */
/* ------------------------------------------------------------------ */

export interface CollapsibleOptions {
  /** Element id of the section, so the palette can teleport to it. */
  id: string;
  /** i18n key for the visible heading. */
  title: string;
  /** i18n key for the sentence under the heading. */
  description?: string;
  /** Descriptive panels start closed; operational rows start open. */
  startOpen: boolean;
  /** Rendered right-aligned in the header, e.g. a live count. */
  summary?: HTMLElement;
}

export interface CollapsibleHandle {
  root: HTMLElement;
  body: HTMLElement;
  isOpen(): boolean;
  setOpen(open: boolean): void;
  toggle(): void;
  /** The button, so a caller can move focus to it. */
  trigger: HTMLButtonElement;
}

/**
 * A section whose body can be folded away.
 *
 * A view whose controls take more room than its content has buried the content,
 * so the filter row and the statistics panel both fold. The state is announced
 * through `aria-expanded` rather than left to the arrow's rotation, because a
 * caret is not readable by anything but an eye.
 */
export function collapsible(ctx: AppContext, options: CollapsibleOptions): CollapsibleHandle {
  let open = options.startOpen;
  const bodyId = `${options.id}-body`;

  const root = node('section', {
    className: 'server-collapsible',
    attrs: { id: options.id, 'data-appearance-id': `server:${options.id}` }
  });

  const trigger = node('button', {
    className: 'server-collapsible__trigger',
    attrs: { type: 'button', 'aria-expanded': String(open), 'aria-controls': bodyId }
  });
  const caret = ctx.components.icon(open ? 'chevronDown' : 'chevronRight', { size: 20 });
  const heading = node('span', {
    className: 'md-typescale-title-small',
    text: ctx.t(options.title, options.title)
  });
  trigger.append(caret, heading);
  if (options.summary) {
    options.summary.classList.add('server-collapsible__summary');
    trigger.append(options.summary);
  }

  const header = node('div', { className: 'server-collapsible__header' });
  header.append(trigger);
  root.append(header);

  if (options.description) {
    root.append(
      node('p', {
        className: 'md-typescale-body-small server-muted',
        text: ctx.t(options.description, options.description)
      })
    );
  }

  const body = node('div', { className: 'server-collapsible__body', attrs: { id: bodyId } });
  body.hidden = !open;
  root.append(body);

  const setOpen = (next: boolean): void => {
    open = next;
    body.hidden = !open;
    trigger.setAttribute('aria-expanded', String(open));
    caret.replaceWith(ctx.components.icon(open ? 'chevronDown' : 'chevronRight', { size: 20 }));
  };

  trigger.addEventListener('click', () => setOpen(!open));

  return {
    root,
    body,
    trigger,
    isOpen: () => open,
    setOpen: (next) => {
      if (next !== open) setOpen(next);
    },
    toggle: () => setOpen(!open)
  };
}

/* ------------------------------------------------------------------ */
/* Selection                                                           */
/* ------------------------------------------------------------------ */

/**
 * Multi-select with an anchor, shift-ranges and a keyboard equivalent.
 *
 * The anchor is what makes a range mean anything: a plain click or a plain
 * arrow move sets it, and a shifted one fills from it to here. Without an
 * anchor, shift-click behaves differently depending on which row happened to be
 * selected last, which is the kind of nearly-right behaviour that is worse than
 * no ranges at all.
 */
export class SelectionModel {
  private readonly chosen = new Set<string>();
  private anchor = -1;

  has(key: string): boolean {
    return this.chosen.has(key);
  }

  size(): number {
    return this.chosen.size;
  }

  keys(): string[] {
    return [...this.chosen];
  }

  set(key: string, selected: boolean): void {
    if (selected) this.chosen.add(key);
    else this.chosen.delete(key);
  }

  toggle(key: string): boolean {
    const next = !this.chosen.has(key);
    this.set(key, next);
    return next;
  }

  clear(): void {
    this.chosen.clear();
    this.anchor = -1;
  }

  setAnchor(index: number): void {
    this.anchor = index;
  }

  /** Selects every key from the anchor to `index`, setting the anchor if unset. */
  extendTo(index: number, keys: string[]): void {
    if (this.anchor < 0) this.anchor = index;
    const from = Math.min(this.anchor, index);
    const to = Math.max(this.anchor, index);
    for (let cursor = from; cursor <= to; cursor += 1) {
      const key = keys[cursor];
      if (key !== undefined) this.chosen.add(key);
    }
  }

  addAll(keys: string[]): void {
    for (const key of keys) this.chosen.add(key);
  }

  /** Flips membership for exactly the given keys, leaving the rest alone. */
  invert(keys: string[]): void {
    for (const key of keys) {
      if (this.chosen.has(key)) this.chosen.delete(key);
      else this.chosen.add(key);
    }
  }

  /** Drops any key that is no longer present, e.g. a removed container. */
  retain(keys: string[]): void {
    const alive = new Set(keys);
    for (const key of [...this.chosen]) if (!alive.has(key)) this.chosen.delete(key);
  }
}

/**
 * Wires the keyboard half of the selection to one row's checkbox.
 *
 * Arrow keys move between rows, shift plus an arrow extends the range, and the
 * caller redraws and restores focus. The redraw replaces every node, so the
 * element to focus has to be found again in the new table — a reference kept
 * from before the redraw points at a detached node, and focusing that silently
 * does nothing.
 */
export function wireRowKeyboard(
  input: HTMLInputElement,
  index: number,
  keys: string[],
  selection: SelectionModel,
  redrawAndFocus: (index: number) => void
): void {
  input.addEventListener('click', (event) => {
    if (event.shiftKey) {
      selection.extendTo(index, keys);
      redrawAndFocus(index);
      return;
    }
    selection.setAnchor(index);
  });
  input.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const next = index + (event.key === 'ArrowDown' ? 1 : -1);
    if (next < 0 || next >= keys.length) return;
    event.preventDefault();
    if (event.shiftKey) {
      selection.extendTo(next, keys);
      redrawAndFocus(next);
      return;
    }
    selection.setAnchor(next);
    redrawAndFocus(next);
  });
}

/** Hides a checkbox's visible label without taking it away from a screen reader. */
export function hideCheckboxLabel(root: HTMLElement): void {
  root.querySelector('span')?.classList.add('md-visually-hidden');
}

/** Formats a byte-free duration from milliseconds, e.g. `1 m 04 s`. */
export function formatElapsed(milliseconds: number): string {
  const total = Math.max(0, Math.round(milliseconds / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  if (minutes === 0) return `${seconds} s`;
  return `${minutes} m ${seconds.toString().padStart(2, '0')} s`;
}

/** A local, human-readable time from an ISO string, or an empty string. */
export function formatTime(iso: string | null): string {
  if (!iso) return '';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleTimeString();
}
