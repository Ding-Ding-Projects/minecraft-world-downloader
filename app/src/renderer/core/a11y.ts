import type { A11yService } from './types';

/**
 * Accessibility helpers shared by every surface.
 *
 * These are not decoration. A keyboard path, a visible focus ring, a real
 * accessible name and an adequate target size are completion blockers here, so
 * the helpers exist to make the correct thing the easy thing.
 */

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

let liveRegion: HTMLElement | null = null;
let assertiveRegion: HTMLElement | null = null;

function ensureRegions(): void {
  if (liveRegion && assertiveRegion) return;
  liveRegion = document.createElement('div');
  liveRegion.className = 'md-visually-hidden';
  liveRegion.setAttribute('role', 'status');
  liveRegion.setAttribute('aria-live', 'polite');
  liveRegion.setAttribute('aria-atomic', 'true');

  assertiveRegion = document.createElement('div');
  assertiveRegion.className = 'md-visually-hidden';
  assertiveRegion.setAttribute('role', 'alert');
  assertiveRegion.setAttribute('aria-live', 'assertive');
  assertiveRegion.setAttribute('aria-atomic', 'true');

  document.body.append(liveRegion, assertiveRegion);
}

class A11yImpl implements A11yService {
  announce(message: string, assertive = false): void {
    ensureRegions();
    const region = assertive ? assertiveRegion : liveRegion;
    if (!region) return;
    // Clearing first makes a repeated identical message announce again, which
    // is what a progress or count update needs.
    region.textContent = '';
    window.setTimeout(() => {
      region.textContent = message;
    }, 30);
  }

  /**
   * Roving tabindex over a list.
   *
   * The axis matters: a vertically docked tab strip moves with Up and Down, and
   * wiring it to Left and Right produces a strip that looks correct and cannot
   * be used from the keyboard — which no screenshot ever reveals.
   */
  roving(container: HTMLElement, items: () => HTMLElement[], axis: 'horizontal' | 'vertical'): () => void {
    const previousKey = axis === 'horizontal' ? 'ArrowLeft' : 'ArrowUp';
    const nextKey = axis === 'horizontal' ? 'ArrowRight' : 'ArrowDown';

    const sync = (): void => {
      const list = items();
      const active = list.findIndex((item) => item.getAttribute('aria-selected') === 'true' || item.tabIndex === 0);
      list.forEach((item, index) => {
        item.tabIndex = index === (active === -1 ? 0 : active) ? 0 : -1;
      });
    };

    const onKeyDown = (event: KeyboardEvent): void => {
      const list = items();
      if (list.length === 0) return;
      const current = list.indexOf(document.activeElement as HTMLElement);
      if (current === -1) return;
      let next = current;
      if (event.key === nextKey) next = (current + 1) % list.length;
      else if (event.key === previousKey) next = (current - 1 + list.length) % list.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = list.length - 1;
      else return;
      event.preventDefault();
      list.forEach((item, index) => {
        item.tabIndex = index === next ? 0 : -1;
      });
      list[next].focus();
    };

    container.addEventListener('keydown', onKeyDown);
    sync();
    return () => container.removeEventListener('keydown', onKeyDown);
  }

  trapFocus(container: HTMLElement): () => void {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Tab') return;
      const focusable = [...container.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (element) => element.offsetParent !== null || element === document.activeElement
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    container.addEventListener('keydown', onKeyDown);
    return () => container.removeEventListener('keydown', onKeyDown);
  }

  reducedMotion(): boolean {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /**
   * Reports an interactive target smaller than 44 CSS pixels.
   *
   * It reports rather than throws, because an element measured before layout
   * settles reads as zero and a throw would break a correct interface. In a
   * development build the message names the element so the size can be fixed.
   */
  assertTouchTarget(element: HTMLElement, name: string): void {
    if (!import.meta.env.DEV) return;
    window.requestAnimationFrame(() => {
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;
      if (rect.width < 44 || rect.height < 44) {
        console.warn(
          `Touch target "${name}" is ${Math.round(rect.width)}x${Math.round(rect.height)} CSS pixels, below the 44x44 minimum.`
        );
      }
    });
  }

  focusVisible(element: HTMLElement): void {
    element.setAttribute('data-force-focus-ring', 'true');
    element.focus({ preventScroll: false });
    window.setTimeout(() => element.removeAttribute('data-force-focus-ring'), 2400);
  }
}

export const a11y = new A11yImpl();

/** Collects the focusable descendants of an element, in document order. */
export function focusableWithin(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(FOCUSABLE)];
}

/** Creates an element with a class, text and attributes in one call. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options: {
    className?: string;
    text?: string;
    html?: never;
    attrs?: Record<string, string>;
    children?: Array<Node | null | undefined>;
  } = {}
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text !== undefined) node.textContent = options.text;
  if (options.attrs) {
    for (const [key, value] of Object.entries(options.attrs)) node.setAttribute(key, value);
  }
  if (options.children) {
    for (const child of options.children) if (child) node.append(child);
  }
  return node;
}

/** A monotonic id source for controls that need one. */
let idCounter = 0;
export function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}
