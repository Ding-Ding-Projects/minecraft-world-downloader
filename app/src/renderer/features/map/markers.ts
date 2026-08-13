/**
 * The marker store.
 *
 * Markers are the one thing on this surface the user owns rather than the
 * renderer, so every creation, edit and deletion is persisted in the settings
 * document and recorded in local history. A restore is a new history entry
 * rather than a rewrite, which is what makes an undo undoable in turn.
 */

import {
  MAX_MARKERS,
  MAX_MARKER_NAME,
  MAX_MARKER_NOTE,
  type MapMarker,
  type MarkerColour,
  STORE_MARKERS,
  clamp,
  HEIGHT_MAX,
  HEIGHT_MIN,
  WORLD_MAX,
  WORLD_MIN,
  newMarkerId,
  normaliseMarkers
} from './model';
import type { HistoryRecorder, SettingsStore } from '../../core/registry';

export interface MarkerDraft {
  name: string;
  dimension: string;
  x: number;
  y: number;
  z: number;
  colour?: MarkerColour;
  note?: string;
}

export type MarkerChange = 'added' | 'renamed' | 'moved' | 'recoloured' | 'visibility' | 'note' | 'removed';

export class MarkerStore {
  private markers: MapMarker[];

  private readonly listeners = new Set<() => void>();

  constructor(
    private readonly settings: SettingsStore,
    private readonly history: HistoryRecorder
  ) {
    this.markers = normaliseMarkers(this.settings.get<unknown>(STORE_MARKERS, []));
  }

  all(): MapMarker[] {
    return this.markers.map((marker) => ({ ...marker }));
  }

  count(): number {
    return this.markers.length;
  }

  byId(id: string): MapMarker | null {
    const found = this.markers.find((marker) => marker.id === id);
    return found ? { ...found } : null;
  }

  forDimension(dimension: string): MapMarker[] {
    return this.markers.filter((marker) => marker.dimension === dimension).map((marker) => ({ ...marker }));
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Adds one marker. Returns null when the bounded list is already full. */
  async add(draft: MarkerDraft): Promise<MapMarker | null> {
    if (this.markers.length >= MAX_MARKERS) return null;
    const marker: MapMarker = {
      id: newMarkerId(),
      name: draft.name.slice(0, MAX_MARKER_NAME),
      dimension: draft.dimension,
      x: clamp(Math.round(draft.x), WORLD_MIN, WORLD_MAX),
      y: clamp(Math.round(draft.y), HEIGHT_MIN, HEIGHT_MAX),
      z: clamp(Math.round(draft.z), WORLD_MIN, WORLD_MAX),
      colour: draft.colour ?? 'primary',
      visible: true,
      note: (draft.note ?? '').slice(0, MAX_MARKER_NOTE),
      createdAt: new Date().toISOString()
    };
    this.markers = [...this.markers, marker];
    this.persist();
    await this.record('Added a map marker', {
      id: marker.id,
      name: marker.name,
      dimension: marker.dimension,
      x: marker.x,
      y: marker.y,
      z: marker.z
    });
    return { ...marker };
  }

  /** Applies one field change. Returns false when nothing actually changed. */
  async update(id: string, patch: Partial<Pick<MapMarker, 'name' | 'colour' | 'visible' | 'note' | 'x' | 'y' | 'z'>>): Promise<boolean> {
    const index = this.markers.findIndex((marker) => marker.id === id);
    if (index === -1) return false;
    const previous = this.markers[index];
    const next: MapMarker = { ...previous };
    const changes: MarkerChange[] = [];

    if (patch.name !== undefined) {
      const name = patch.name.slice(0, MAX_MARKER_NAME);
      if (name !== previous.name) {
        next.name = name;
        changes.push('renamed');
      }
    }
    if (patch.colour !== undefined && patch.colour !== previous.colour) {
      next.colour = patch.colour;
      changes.push('recoloured');
    }
    if (patch.visible !== undefined && patch.visible !== previous.visible) {
      next.visible = patch.visible;
      changes.push('visibility');
    }
    if (patch.note !== undefined) {
      const note = patch.note.slice(0, MAX_MARKER_NOTE);
      if (note !== previous.note) {
        next.note = note;
        changes.push('note');
      }
    }
    for (const axis of ['x', 'y', 'z'] as const) {
      const value = patch[axis];
      if (value === undefined) continue;
      const bounded =
        axis === 'y' ? clamp(Math.round(value), HEIGHT_MIN, HEIGHT_MAX) : clamp(Math.round(value), WORLD_MIN, WORLD_MAX);
      if (bounded !== previous[axis]) {
        next[axis] = bounded;
        if (!changes.includes('moved')) changes.push('moved');
      }
    }

    if (changes.length === 0) return false;
    this.markers = this.markers.map((marker, position) => (position === index ? next : marker));
    this.persist();
    await this.record(actionLabel(changes), {
      id: next.id,
      name: next.name,
      dimension: next.dimension,
      changed: changes,
      x: next.x,
      y: next.y,
      z: next.z,
      colour: next.colour,
      visible: next.visible
    });
    return true;
  }

  /** Sets visibility on many markers at once. Returns how many really changed. */
  async setVisibility(ids: string[], visible: boolean): Promise<number> {
    const wanted = new Set(ids);
    let changed = 0;
    this.markers = this.markers.map((marker) => {
      if (!wanted.has(marker.id) || marker.visible === visible) return marker;
      changed += 1;
      return { ...marker, visible };
    });
    if (changed === 0) return 0;
    this.persist();
    await this.record(visible ? 'Showed map markers' : 'Hid map markers', { ids: [...wanted], count: changed });
    return changed;
  }

  /** Removes many markers at once. Returns the records that were removed. */
  async remove(ids: string[]): Promise<MapMarker[]> {
    const wanted = new Set(ids);
    const removed = this.markers.filter((marker) => wanted.has(marker.id));
    if (removed.length === 0) return [];
    this.markers = this.markers.filter((marker) => !wanted.has(marker.id));
    this.persist();
    await this.record('Deleted map markers', {
      count: removed.length,
      markers: removed.map((marker) => ({
        id: marker.id,
        name: marker.name,
        dimension: marker.dimension,
        x: marker.x,
        y: marker.y,
        z: marker.z
      }))
    });
    return removed;
  }

  /**
   * Puts previously removed markers back.
   *
   * This is the undo path, and it is a new history entry rather than an edit of
   * the deletion entry, so the restore can itself be undone.
   */
  async restore(markers: MapMarker[]): Promise<number> {
    const existing = new Set(this.markers.map((marker) => marker.id));
    const room = MAX_MARKERS - this.markers.length;
    const restorable = markers.filter((marker) => !existing.has(marker.id)).slice(0, Math.max(0, room));
    if (restorable.length === 0) return 0;
    this.markers = [...this.markers, ...restorable.map((marker) => ({ ...marker }))];
    this.persist();
    await this.record('Restored map markers', {
      count: restorable.length,
      ids: restorable.map((marker) => marker.id)
    });
    return restorable.length;
  }

  private persist(): void {
    this.settings.set(STORE_MARKERS, this.markers.map((marker) => ({ ...marker })));
    for (const listener of this.listeners) listener();
  }

  private async record(action: string, payload: unknown): Promise<void> {
    await this.history.record(action, 'map', payload);
  }
}

function actionLabel(changes: MarkerChange[]): string {
  if (changes.includes('renamed')) return 'Renamed a map marker';
  if (changes.includes('moved')) return 'Moved a map marker';
  if (changes.includes('visibility')) return 'Changed a map marker’s visibility';
  if (changes.includes('recoloured')) return 'Changed a map marker’s colour';
  return 'Edited a map marker';
}
