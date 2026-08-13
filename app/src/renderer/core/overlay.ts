import { a11y, el, nextId } from './a11y';
import { settings } from './settings';
import type { OverlayHandle, OverlayOptions, OverlayService } from './types';

/**
 * Popovers, menus, tooltips and floating panels.
 *
 * Three rules are baked in here rather than left to each caller, because each
 * one has produced a well-built dialog that looked broken.
 *
 * An overlay paints its OWN surface. Where decoration is optional, transparent
 * is what you get, and whatever sits behind reads straight through the text.
 *
 * An overlay is bounded by the viewport and SCROLLS when it does not fit.
 * Capping a height and hiding the overflow deletes the content past the cap with
 * no scrollbar to say anything is missing — a calendar loses its last week and
 * the user has no way to know.
 *
 * An overlay never covers its own anchor. It flips to the other side first, and
 * only then shrinks.
 */

const GAP = 8;
const VIEWPORT_MARGIN = 12;

let layer: HTMLElement | null = null;
const openOverlays: OverlayInstance[] = [];

function ensureLayer(): HTMLElement {
  if (layer) return layer;
  layer = el('div', { className: 'md-overlay-layer', attrs: { id: 'md-overlay-layer' } });
  document.body.append(layer);
  return layer;
}

interface Geometry {
  width?: number;
  height?: number;
  left?: number;
  top?: number;
}

function geometryKey(key: string): string {
  return `overlay.geometry.${key}`;
}

class OverlayInstance implements OverlayHandle {
  readonly root: HTMLElement;
  readonly body: HTMLElement;
  readonly header: HTMLElement | null;
  private open = true;
  private readonly options: OverlayOptions;
  private readonly cleanups: Array<() => void> = [];

  constructor(options: OverlayOptions) {
    this.options = options;
    const id = nextId('md-overlay');

    this.root = el('div', {
      className: 'md-overlay',
      attrs: {
        id,
        role: options.role ?? 'dialog',
        'aria-label': options.label ?? '',
        'data-placement': options.placement ?? 'bottom-start'
      }
    });
    if (options.role !== 'tooltip') this.root.tabIndex = -1;

    this.header = options.dragKey
      ? el('div', { className: 'md-overlay__header', attrs: { 'data-drag-handle': 'true' } })
      : null;
    if (this.header) {
      this.header.append(
        el('span', { className: 'md-overlay__title', text: options.label ?? '' }),
        el('span', { className: 'md-overlay__grip', attrs: { 'aria-hidden': 'true' } })
      );
      this.root.append(this.header);
    }

    this.body = el('div', { className: 'md-overlay__body' });
    this.root.append(this.body);

    if (options.resizeKey) {
      for (const edge of ['e', 's', 'se'] as const) {
        const grip = el('div', { className: `md-overlay__resize md-overlay__resize--${edge}` });
        grip.addEventListener('pointerdown', (event) => this.beginResize(event, edge));
        this.root.append(grip);
      }
      this.root.classList.add('md-overlay--resizable');
    }

    ensureLayer().append(this.root);
    this.restoreGeometry();
    this.reposition();

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        this.close();
      }
    };
    this.root.addEventListener('keydown', onKeyDown);
    this.cleanups.push(() => this.root.removeEventListener('keydown', onKeyDown));

    if (options.lightDismiss !== false) {
      const onPointerDown = (event: PointerEvent): void => {
        const target = event.target as Node | null;
        if (!target) return;
        if (this.root.contains(target) || options.anchor.contains(target)) return;
        this.close();
      };
      // Deferred so the click that opened it does not immediately close it.
      window.setTimeout(() => document.addEventListener('pointerdown', onPointerDown, true), 0);
      this.cleanups.push(() => document.removeEventListener('pointerdown', onPointerDown, true));
    }

    const onViewportChange = (): void => this.reposition();
    window.addEventListener('resize', onViewportChange);
    window.addEventListener('scroll', onViewportChange, true);
    this.cleanups.push(() => {
      window.removeEventListener('resize', onViewportChange);
      window.removeEventListener('scroll', onViewportChange, true);
    });

    if (this.header) this.header.addEventListener('pointerdown', (event) => this.beginDrag(event));
    if (this.header) this.enableKeyboardMove();

    openOverlays.push(this);
  }

  isOpen(): boolean {
    return this.open;
  }

  close(): void {
    if (!this.open) return;
    this.open = false;
    for (const cleanup of this.cleanups) cleanup();
    this.root.remove();
    const index = openOverlays.indexOf(this);
    if (index >= 0) openOverlays.splice(index, 1);
    this.options.onClose?.();
    if (this.options.anchor.isConnected) this.options.anchor.focus({ preventScroll: true });
  }

  /**
   * Places the overlay: flip before shrink, then bound to the viewport and let
   * the body scroll inside whatever height is left.
   */
  reposition(): void {
    if (!this.open) return;
    const stored = this.storedGeometry();
    if (stored.left !== undefined && stored.top !== undefined) {
      this.applyBoundedPosition(stored.left, stored.top);
      this.applyMaxHeight(stored.top);
      return;
    }

    const anchorRect = this.options.anchor.getBoundingClientRect();
    const overlayRect = this.root.getBoundingClientRect();
    const placement = this.options.placement ?? 'bottom-start';
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let top: number;
    let left: number;

    if (placement === 'right' || placement === 'left') {
      top = anchorRect.top;
      left = placement === 'right' ? anchorRect.right + GAP : anchorRect.left - overlayRect.width - GAP;
      if (left < VIEWPORT_MARGIN) left = anchorRect.right + GAP;
      if (left + overlayRect.width > viewportWidth - VIEWPORT_MARGIN) {
        left = Math.max(VIEWPORT_MARGIN, anchorRect.left - overlayRect.width - GAP);
      }
    } else {
      const wantsTop = placement.startsWith('top');
      const belowSpace = viewportHeight - anchorRect.bottom - GAP - VIEWPORT_MARGIN;
      const aboveSpace = anchorRect.top - GAP - VIEWPORT_MARGIN;
      const placeAbove = wantsTop ? aboveSpace >= 120 : belowSpace < Math.min(overlayRect.height, 220) && aboveSpace > belowSpace;
      top = placeAbove ? anchorRect.top - overlayRect.height - GAP : anchorRect.bottom + GAP;
      left = placement.endsWith('end') ? anchorRect.right - overlayRect.width : anchorRect.left;
    }

    this.applyBoundedPosition(left, top);
    this.applyMaxHeight(Number.parseFloat(this.root.style.top || '0'));
  }

  private applyBoundedPosition(left: number, top: number): void {
    const rect = this.root.getBoundingClientRect();
    const maxLeft = Math.max(VIEWPORT_MARGIN, window.innerWidth - rect.width - VIEWPORT_MARGIN);
    const maxTop = Math.max(VIEWPORT_MARGIN, window.innerHeight - rect.height - VIEWPORT_MARGIN);
    this.root.style.left = `${Math.min(Math.max(VIEWPORT_MARGIN, left), maxLeft)}px`;
    this.root.style.top = `${Math.min(Math.max(VIEWPORT_MARGIN, top), maxTop)}px`;
  }

  private applyMaxHeight(top: number): void {
    const available = window.innerHeight - top - VIEWPORT_MARGIN;
    this.root.style.maxHeight = `${Math.max(140, available)}px`;
    this.root.style.maxWidth = `${Math.max(220, window.innerWidth - 2 * VIEWPORT_MARGIN)}px`;
  }

  private storedGeometry(): Geometry {
    const key = this.options.dragKey ?? this.options.resizeKey;
    if (!key) return {};
    const value = settings.get<Geometry | undefined>(geometryKey(key), undefined);
    return value && typeof value === 'object' ? value : {};
  }

  private saveGeometry(patch: Geometry): void {
    const key = this.options.dragKey ?? this.options.resizeKey;
    if (!key) return;
    settings.set(geometryKey(key), { ...this.storedGeometry(), ...patch });
  }

  private restoreGeometry(): void {
    const stored = this.storedGeometry();
    if (stored.width) this.root.style.width = `${stored.width}px`;
    if (stored.height) this.root.style.height = `${stored.height}px`;
  }

  private beginDrag(event: PointerEvent): void {
    if (event.button !== 0) return;
    const start = this.root.getBoundingClientRect();
    const offsetX = event.clientX - start.left;
    const offsetY = event.clientY - start.top;
    const move = (moveEvent: PointerEvent): void => {
      this.applyBoundedPosition(moveEvent.clientX - offsetX, moveEvent.clientY - offsetY);
    };
    const up = (): void => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      this.saveGeometry({
        left: Number.parseFloat(this.root.style.left || '0'),
        top: Number.parseFloat(this.root.style.top || '0')
      });
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
    event.preventDefault();
  }

  private beginResize(event: PointerEvent, edge: 'e' | 's' | 'se'): void {
    if (event.button !== 0) return;
    const start = this.root.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const move = (moveEvent: PointerEvent): void => {
      if (edge !== 's') {
        this.root.style.width = `${Math.max(240, start.width + (moveEvent.clientX - startX))}px`;
      }
      if (edge !== 'e') {
        this.root.style.height = `${Math.max(160, start.height + (moveEvent.clientY - startY))}px`;
      }
    };
    const up = (): void => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      this.saveGeometry({
        width: Number.parseFloat(this.root.style.width || `${start.width}`),
        height: Number.parseFloat(this.root.style.height || `${start.height}`)
      });
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
    event.preventDefault();
  }

  /** Arrow keys move a floating panel; Shift with them resizes it. */
  private enableKeyboardMove(): void {
    if (!this.header) return;
    this.header.tabIndex = 0;
    this.header.setAttribute('role', 'button');
    this.header.setAttribute('aria-label', `${this.options.label ?? 'Panel'} — move or resize with the arrow keys`);
    const onKeyDown = (event: KeyboardEvent): void => {
      const step = event.altKey ? 1 : 16;
      const dx = event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0;
      const dy = event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0;
      if (dx === 0 && dy === 0) return;
      event.preventDefault();
      event.stopPropagation();
      const rect = this.root.getBoundingClientRect();
      if (event.shiftKey) {
        this.root.style.width = `${Math.max(240, rect.width + dx)}px`;
        this.root.style.height = `${Math.max(160, rect.height + dy)}px`;
        this.saveGeometry({ width: rect.width + dx, height: rect.height + dy });
      } else {
        this.applyBoundedPosition(rect.left + dx, rect.top + dy);
        this.saveGeometry({
          left: Number.parseFloat(this.root.style.left || '0'),
          top: Number.parseFloat(this.root.style.top || '0')
        });
      }
    };
    this.header.addEventListener('keydown', onKeyDown);
    this.cleanups.push(() => this.header?.removeEventListener('keydown', onKeyDown));
  }
}

class OverlayServiceImpl implements OverlayService {
  open(options: OverlayOptions): OverlayHandle {
    const instance = new OverlayInstance(options);
    if (options.role !== 'tooltip') {
      window.requestAnimationFrame(() => {
        instance.reposition();
        a11y.focusVisible(instance.root);
      });
    }
    return instance;
  }

  closeAll(): void {
    for (const instance of [...openOverlays]) instance.close();
  }

  resetGeometry(key: string): void {
    settings.reset(geometryKey(key));
  }
}

export const overlay = new OverlayServiceImpl();
