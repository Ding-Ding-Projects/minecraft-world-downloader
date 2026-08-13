/**
 * The map viewport.
 *
 * A plain 2D canvas that blits the region tiles the headless renderer wrote to
 * disk. No map library, no tile server, no network: the source hands over an
 * already-decoded image or nothing at all, and a frame is never allowed to wait
 * on the disk.
 *
 * Everything here is operable from the keyboard as well as the pointer, because
 * a map that can only be panned by dragging is a map a keyboard user cannot
 * read. Arrow keys pan, `+`/`-` and Page Up/Page Down zoom, Home resets, and
 * every one of those paths reports the same coordinates the pointer readout
 * shows.
 */

import {
  type CameraState,
  MAX_SCALE,
  MIN_SCALE,
  type MapMarker,
  type OverviewMeta,
  WORLD_MAX,
  WORLD_MIN,
  clamp,
  floorDiv,
  niceBlockSpan
} from './model';
import type { TileSource } from './source';

export interface LayerFlags {
  regionGrid: boolean;
  player: boolean;
  markers: boolean;
  crosshair: boolean;
  smoothing: boolean;
}

export interface CanvasHooks {
  /** Markers for the dimension currently on screen. Visible ones only. */
  markers(): MapMarker[];
  layers(): LayerFlags;
  meta(): OverviewMeta;
  reducedMotion(): boolean;
  /** Fires continuously while the pointer is over the map; null when it leaves. */
  onPointer(point: { x: number; z: number } | null): void;
  /** Fires on every camera change, including each animation frame. */
  onCamera(camera: CameraState): void;
  /** Fires once the camera has been still for a moment. Safe to persist on. */
  onSettled(camera: CameraState): void;
  /** Fires when the user pans or zooms by hand, so "follow player" can stop. */
  onManualMove(): void;
}

const SETTLE_MS = 420;
const FLY_MS = 340;
const PAN_STEP_PX = 96;
const FINE_PAN_STEP_PX = 12;
const ZOOM_FACTOR = 1.25;

interface Palette {
  surface: string;
  surfaceContainer: string;
  onSurface: string;
  onSurfaceVariant: string;
  outline: string;
  outlineVariant: string;
  primary: string;
  onPrimary: string;
  secondary: string;
  tertiary: string;
  error: string;
  success: string;
  warning: string;
  typeface: string;
}

export class MapCanvas {
  readonly root: HTMLElement;

  readonly canvas: HTMLCanvasElement;

  private readonly context: CanvasRenderingContext2D;

  private camera: CameraState;

  private frame = 0;

  private settleTimer = 0;

  private animation = 0;

  private palette: Palette;

  private readonly pointers = new Map<number, { x: number; y: number }>();

  private dragOrigin: { pointerX: number; pointerY: number; camX: number; camZ: number } | null = null;

  private pinchDistance = 0;

  private readonly observer: ResizeObserver;

  private disposed = false;

  constructor(
    private readonly source: TileSource,
    private readonly hooks: CanvasHooks,
    initialCamera: CameraState
  ) {
    this.camera = { ...initialCamera };

    this.root = document.createElement('div');
    this.root.className = 'map-viewport';

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'map-viewport__canvas';
    this.canvas.tabIndex = 0;
    this.canvas.setAttribute('role', 'application');
    this.root.append(this.canvas);

    const context = this.canvas.getContext('2d');
    if (!context) {
      throw new Error('This build of the renderer has no 2D canvas context, so the map cannot be drawn.');
    }
    this.context = context;
    this.palette = this.readPalette();

    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(this.root);

    this.attachPointer();
    this.attachKeyboard();
    this.resize();
  }

  dispose(): void {
    this.disposed = true;
    this.observer.disconnect();
    if (this.frame) window.cancelAnimationFrame(this.frame);
    if (this.animation) window.cancelAnimationFrame(this.animation);
    if (this.settleTimer) window.clearTimeout(this.settleTimer);
  }

  /* ---------------- accessible naming ---------------- */

  setAccessibleName(name: string, describedById: string): void {
    this.canvas.setAttribute('aria-label', name);
    this.canvas.setAttribute('aria-describedby', describedById);
  }

  focus(): void {
    this.canvas.focus();
  }

  /* ---------------- camera ---------------- */

  state(): CameraState {
    return { ...this.camera };
  }

  setDimension(dimension: string): void {
    if (this.camera.dimension === dimension) return;
    this.camera = { ...this.camera, dimension };
    this.emit();
    this.draw();
  }

  setMode(mode: CameraState['mode']): void {
    if (this.camera.mode === mode) return;
    this.camera = { ...this.camera, mode };
    this.emit();
    this.draw();
  }

  /** Moves without animating. Used by "follow player" and by a restore. */
  jumpTo(x: number, z: number, scale?: number): void {
    this.stopAnimation();
    this.camera = {
      ...this.camera,
      x: clamp(x, WORLD_MIN, WORLD_MAX),
      z: clamp(z, WORLD_MIN, WORLD_MAX),
      scale: scale === undefined ? this.camera.scale : clamp(scale, MIN_SCALE, MAX_SCALE)
    };
    this.emit();
    this.draw();
  }

  /**
   * Moves with a short animation, or instantly under reduced motion.
   *
   * Reduced motion is checked at the moment of the move rather than cached at
   * construction, because the user can change the preference while the tab is
   * open and a cached answer would keep animating at them.
   */
  flyTo(x: number, z: number, scale?: number): void {
    const targetX = clamp(x, WORLD_MIN, WORLD_MAX);
    const targetZ = clamp(z, WORLD_MIN, WORLD_MAX);
    const targetScale = scale === undefined ? this.camera.scale : clamp(scale, MIN_SCALE, MAX_SCALE);

    if (this.hooks.reducedMotion()) {
      this.jumpTo(targetX, targetZ, targetScale);
      return;
    }

    this.stopAnimation();
    const startX = this.camera.x;
    const startZ = this.camera.z;
    const startScale = this.camera.scale;
    const startedAt = performance.now();

    const step = (now: number): void => {
      if (this.disposed) return;
      const progress = clamp((now - startedAt) / FLY_MS, 0, 1);
      const eased = progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
      this.camera = {
        ...this.camera,
        x: startX + (targetX - startX) * eased,
        z: startZ + (targetZ - startZ) * eased,
        scale: startScale * (targetScale / startScale) ** eased
      };
      this.emit();
      this.draw();
      if (progress < 1) this.animation = window.requestAnimationFrame(step);
      else this.animation = 0;
    };
    this.animation = window.requestAnimationFrame(step);
  }

  zoomBy(factor: number, anchor?: { clientX: number; clientY: number }): void {
    const next = clamp(this.camera.scale * factor, MIN_SCALE, MAX_SCALE);
    if (next === this.camera.scale) return;
    if (!anchor) {
      this.camera = { ...this.camera, scale: next };
    } else {
      const rect = this.canvas.getBoundingClientRect();
      const offsetX = anchor.clientX - rect.left - rect.width / 2;
      const offsetY = anchor.clientY - rect.top - rect.height / 2;
      const worldX = this.camera.x + offsetX / this.camera.scale;
      const worldZ = this.camera.z + offsetY / this.camera.scale;
      this.camera = {
        ...this.camera,
        scale: next,
        x: clamp(worldX - offsetX / next, WORLD_MIN, WORLD_MAX),
        z: clamp(worldZ - offsetY / next, WORLD_MIN, WORLD_MAX)
      };
    }
    this.emit();
    this.draw();
  }

  panByPixels(dx: number, dz: number): void {
    this.stopAnimation();
    this.camera = {
      ...this.camera,
      x: clamp(this.camera.x + dx / this.camera.scale, WORLD_MIN, WORLD_MAX),
      z: clamp(this.camera.z + dz / this.camera.scale, WORLD_MIN, WORLD_MAX)
    };
    this.emit();
    this.draw();
  }

  /** The block span and pixel length the scale indicator should show. */
  scaleBar(): { blocks: number; pixels: number } {
    const blocks = niceBlockSpan(120, this.camera.scale);
    return { blocks, pixels: blocks * this.camera.scale };
  }

  /** The world rectangle currently on screen, for "centre on everything". */
  viewportBlocks(): { width: number; height: number } {
    const rect = this.canvas.getBoundingClientRect();
    return { width: rect.width / this.camera.scale, height: rect.height / this.camera.scale };
  }

  refreshPalette(): void {
    this.palette = this.readPalette();
    this.draw();
  }

  /** Schedules a redraw. Safe to call from a tile-ready callback every time. */
  draw(): void {
    if (this.disposed || this.frame) return;
    this.frame = window.requestAnimationFrame(() => {
      this.frame = 0;
      this.render();
    });
  }

  /* ---------------- internals ---------------- */

  private emit(): void {
    this.hooks.onCamera(this.state());
    if (this.settleTimer) window.clearTimeout(this.settleTimer);
    this.settleTimer = window.setTimeout(() => {
      this.settleTimer = 0;
      this.hooks.onSettled(this.state());
    }, SETTLE_MS);
  }

  private stopAnimation(): void {
    if (this.animation) {
      window.cancelAnimationFrame(this.animation);
      this.animation = 0;
    }
  }

  private resize(): void {
    const rect = this.root.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.canvas.width = Math.max(1, Math.floor(width * ratio));
    this.canvas.height = Math.max(1, Math.floor(height * ratio));
    this.draw();
  }

  private readPalette(): Palette {
    const style = getComputedStyle(document.documentElement);
    const read = (name: string, fallback: string): string => {
      const value = style.getPropertyValue(name).trim();
      return value === '' ? fallback : value;
    };
    return {
      surface: read('--md-sys-color-surface', '#101418'),
      surfaceContainer: read('--md-sys-color-surface-container-high', '#1c2126'),
      onSurface: read('--md-sys-color-on-surface', '#e1e2e8'),
      onSurfaceVariant: read('--md-sys-color-on-surface-variant', '#c1c7ce'),
      outline: read('--md-sys-color-outline', '#8b9198'),
      outlineVariant: read('--md-sys-color-outline-variant', '#41474d'),
      primary: read('--md-sys-color-primary', '#a0cafd'),
      onPrimary: read('--md-sys-color-on-primary', '#003354'),
      secondary: read('--md-sys-color-secondary', '#bac8da'),
      tertiary: read('--md-sys-color-tertiary', '#d5bee2'),
      error: read('--md-sys-color-error', '#ffb4ab'),
      success: read('--md-sys-color-success', '#7ddc9a'),
      warning: read('--md-sys-color-warning', '#f3c26b'),
      typeface: read('--md-sys-typeface-plain', 'system-ui, sans-serif')
    };
  }

  private colourFor(marker: MapMarker): string {
    switch (marker.colour) {
      case 'secondary':
        return this.palette.secondary;
      case 'tertiary':
        return this.palette.tertiary;
      case 'error':
        return this.palette.error;
      case 'success':
        return this.palette.success;
      case 'warning':
        return this.palette.warning;
      default:
        return this.palette.primary;
    }
  }

  private toScreen(worldX: number, worldZ: number, width: number, height: number): { x: number; y: number } {
    return {
      x: width / 2 + (worldX - this.camera.x) * this.camera.scale,
      y: height / 2 + (worldZ - this.camera.z) * this.camera.scale
    };
  }

  private render(): void {
    const ratio = window.devicePixelRatio || 1;
    const width = this.canvas.width / ratio;
    const height = this.canvas.height / ratio;
    const ctx = this.context;

    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = this.palette.surface;
    ctx.fillRect(0, 0, width, height);

    const layers = this.hooks.layers();
    const meta = this.hooks.meta();
    const regionBlocks = meta.regionPx;
    const scale = this.camera.scale;

    ctx.imageSmoothingEnabled = layers.smoothing && scale < 1;
    ctx.imageSmoothingQuality = 'low';

    if (this.camera.dimension !== '') {
      const halfWidthBlocks = width / 2 / scale;
      const halfHeightBlocks = height / 2 / scale;
      const minRegionX = floorDiv(this.camera.x - halfWidthBlocks, regionBlocks) - 1;
      const maxRegionX = floorDiv(this.camera.x + halfWidthBlocks, regionBlocks) + 1;
      const minRegionZ = floorDiv(this.camera.z - halfHeightBlocks, regionBlocks) - 1;
      const maxRegionZ = floorDiv(this.camera.z + halfHeightBlocks, regionBlocks) + 1;

      // A very wide view over a very large world would otherwise ask for tens of
      // thousands of tiles in one frame. The cap keeps a frame bounded; the
      // status line says plainly when the view is wider than the cap allows.
      const columns = maxRegionX - minRegionX + 1;
      const rows = maxRegionZ - minRegionZ + 1;
      const drawable = columns * rows <= 4096;

      if (drawable) {
        const tileSize = regionBlocks * scale;
        for (let rz = minRegionZ; rz <= maxRegionZ; rz += 1) {
          for (let rx = minRegionX; rx <= maxRegionX; rx += 1) {
            const image = this.source.tile(this.camera.dimension, this.camera.mode, rx, rz);
            if (!image) continue;
            const origin = this.toScreen(rx * regionBlocks, rz * regionBlocks, width, height);
            // Half-pixel expansion closes the hairline seam that appears between
            // neighbouring tiles at fractional scales.
            ctx.drawImage(image, origin.x, origin.y, tileSize + 0.5, tileSize + 0.5);
          }
        }
      }

      if (layers.regionGrid && drawable && tileGridIsLegible(regionBlocks * scale)) {
        ctx.save();
        ctx.strokeStyle = this.palette.outlineVariant;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let rx = minRegionX; rx <= maxRegionX + 1; rx += 1) {
          const point = this.toScreen(rx * regionBlocks, 0, width, height);
          const x = Math.round(point.x) + 0.5;
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
        }
        for (let rz = minRegionZ; rz <= maxRegionZ + 1; rz += 1) {
          const point = this.toScreen(0, rz * regionBlocks, width, height);
          const y = Math.round(point.y) + 0.5;
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
        }
        ctx.stroke();
        ctx.restore();
      }
    }

    if (layers.markers) this.drawMarkers(width, height);
    if (layers.player) this.drawPlayer(meta, width, height);
    if (layers.crosshair) this.drawCrosshair(width, height);
  }

  private drawMarkers(width: number, height: number): void {
    const ctx = this.context;
    const markers = this.hooks.markers();
    if (markers.length === 0) return;
    const showLabels = this.camera.scale >= 0.2;
    const fontSize = 12;

    for (const marker of markers) {
      const point = this.toScreen(marker.x, marker.z, width, height);
      if (point.x < -80 || point.y < -40 || point.x > width + 80 || point.y > height + 40) continue;
      const colour = this.colourFor(marker);

      ctx.save();
      ctx.beginPath();
      ctx.arc(point.x, point.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = colour;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = this.palette.surface;
      ctx.stroke();
      ctx.restore();

      if (!showLabels || marker.name.trim() === '') continue;

      ctx.save();
      ctx.font = `${fontSize}px ${this.palette.typeface}`;
      ctx.textBaseline = 'middle';
      const text = marker.name.length > 40 ? `${marker.name.slice(0, 39)}…` : marker.name;
      const textWidth = ctx.measureText(text).width;
      const boxX = point.x + 10;
      const boxY = point.y - fontSize / 2 - 3;
      const boxWidth = textWidth + 10;
      const boxHeight = fontSize + 6;
      ctx.fillStyle = this.palette.surfaceContainer;
      ctx.globalAlpha = 0.92;
      roundedRect(ctx, boxX, boxY, boxWidth, boxHeight, 4);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = this.palette.onSurface;
      ctx.fillText(text, boxX + 5, point.y);
      ctx.restore();
    }
  }

  private drawPlayer(meta: OverviewMeta, width: number, height: number): void {
    if (!meta.player) return;
    if (meta.currentDimension === null || meta.currentDimension !== this.camera.dimension) return;
    const ctx = this.context;
    const point = this.toScreen(meta.player.x, meta.player.z, width, height);
    ctx.save();
    ctx.beginPath();
    ctx.arc(point.x, point.y, 7, 0, Math.PI * 2);
    ctx.fillStyle = this.palette.success;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = this.palette.surface;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(point.x, point.y, 13, 0, Math.PI * 2);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = this.palette.success;
    ctx.globalAlpha = 0.6;
    ctx.stroke();
    ctx.restore();
  }

  private drawCrosshair(width: number, height: number): void {
    const ctx = this.context;
    const x = Math.round(width / 2) + 0.5;
    const y = Math.round(height / 2) + 0.5;
    ctx.save();
    ctx.strokeStyle = this.palette.onSurfaceVariant;
    ctx.globalAlpha = 0.75;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - 10, y);
    ctx.lineTo(x - 3, y);
    ctx.moveTo(x + 3, y);
    ctx.lineTo(x + 10, y);
    ctx.moveTo(x, y - 10);
    ctx.lineTo(x, y - 3);
    ctx.moveTo(x, y + 3);
    ctx.lineTo(x, y + 10);
    ctx.stroke();
    ctx.restore();
  }

  /* ---------------- input ---------------- */

  private attachPointer(): void {
    const canvas = this.canvas;

    canvas.addEventListener('pointerdown', (event) => {
      canvas.focus();
      canvas.setPointerCapture(event.pointerId);
      this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (this.pointers.size === 1) {
        this.stopAnimation();
        this.dragOrigin = {
          pointerX: event.clientX,
          pointerY: event.clientY,
          camX: this.camera.x,
          camZ: this.camera.z
        };
      } else if (this.pointers.size === 2) {
        this.dragOrigin = null;
        this.pinchDistance = this.currentPinchDistance();
      }
    });

    canvas.addEventListener('pointermove', (event) => {
      if (this.pointers.has(event.pointerId)) {
        this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      }

      if (this.pointers.size === 2) {
        const distance = this.currentPinchDistance();
        if (this.pinchDistance > 0 && distance > 0) {
          const centre = this.pinchCentre();
          this.zoomBy(distance / this.pinchDistance, centre);
          this.hooks.onManualMove();
        }
        this.pinchDistance = distance;
        return;
      }

      if (this.dragOrigin) {
        const dx = event.clientX - this.dragOrigin.pointerX;
        const dy = event.clientY - this.dragOrigin.pointerY;
        this.camera = {
          ...this.camera,
          x: clamp(this.dragOrigin.camX - dx / this.camera.scale, WORLD_MIN, WORLD_MAX),
          z: clamp(this.dragOrigin.camZ - dy / this.camera.scale, WORLD_MIN, WORLD_MAX)
        };
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) this.hooks.onManualMove();
        this.emit();
        this.draw();
      }

      this.reportPointer(event.clientX, event.clientY);
    });

    const release = (event: PointerEvent): void => {
      this.pointers.delete(event.pointerId);
      if (this.pointers.size < 2) this.pinchDistance = 0;
      if (this.pointers.size === 0) this.dragOrigin = null;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    };
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);

    canvas.addEventListener('pointerleave', () => {
      this.hooks.onPointer(null);
    });

    canvas.addEventListener(
      'wheel',
      (event) => {
        event.preventDefault();
        const factor = event.deltaY < 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR;
        this.zoomBy(factor, { clientX: event.clientX, clientY: event.clientY });
        this.hooks.onManualMove();
        this.reportPointer(event.clientX, event.clientY);
      },
      { passive: false }
    );
  }

  private currentPinchDistance(): number {
    const points = [...this.pointers.values()];
    if (points.length < 2) return 0;
    return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
  }

  private pinchCentre(): { clientX: number; clientY: number } {
    const points = [...this.pointers.values()];
    return {
      clientX: (points[0].x + points[1].x) / 2,
      clientY: (points[0].y + points[1].y) / 2
    };
  }

  private reportPointer(clientX: number, clientY: number): void {
    const rect = this.canvas.getBoundingClientRect();
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
      this.hooks.onPointer(null);
      return;
    }
    const offsetX = clientX - rect.left - rect.width / 2;
    const offsetY = clientY - rect.top - rect.height / 2;
    this.hooks.onPointer({
      x: this.camera.x + offsetX / this.camera.scale,
      z: this.camera.z + offsetY / this.camera.scale
    });
  }

  private attachKeyboard(): void {
    this.canvas.addEventListener('keydown', (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const step = event.shiftKey ? FINE_PAN_STEP_PX : PAN_STEP_PX;
      let handled = true;
      switch (event.key) {
        case 'ArrowLeft':
          this.panByPixels(-step, 0);
          break;
        case 'ArrowRight':
          this.panByPixels(step, 0);
          break;
        case 'ArrowUp':
          this.panByPixels(0, -step);
          break;
        case 'ArrowDown':
          this.panByPixels(0, step);
          break;
        case '+':
        case '=':
        case 'PageUp':
          this.zoomBy(ZOOM_FACTOR);
          break;
        case '-':
        case '_':
        case 'PageDown':
          this.zoomBy(1 / ZOOM_FACTOR);
          break;
        case 'Home':
          this.jumpTo(0, 0);
          break;
        default:
          handled = false;
      }
      if (handled) {
        event.preventDefault();
        this.hooks.onManualMove();
      }
    });
  }
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/** A grid drawn tighter than this reads as noise rather than as a grid. */
function tileGridIsLegible(tilePixels: number): boolean {
  return tilePixels >= 24;
}
