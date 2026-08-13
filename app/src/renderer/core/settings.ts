import type { SettingsProvenance, SettingsRecord } from '../../shared/api';
import type { SettingsStore } from './types';

/**
 * The persisted settings store.
 *
 * Two things live here that a plain key/value store does not carry.
 *
 * First, provenance: every control shows whether its current value came from a
 * file somebody actually wrote, or whether the application is quietly falling
 * back to its own compiled-in default. "Default" is a real answer, and naming
 * the real value beside it is the difference between a setting a user trusts and
 * one they have to test.
 *
 * Second, declared defaults: a control declares its default when it registers,
 * so `reset` restores exactly the shipped value rather than deleting the key and
 * hoping every reader has the same fallback in mind.
 */

type ChangeListener = (change: { id: string; value: unknown; previous: unknown }) => void;

const WRITE_DEBOUNCE_MS = 250;

class Store implements SettingsStore {
  private values = new Map<string, unknown>();
  private provenance = new Map<string, SettingsProvenance>();
  private defaults = new Map<string, unknown>();
  private listeners = new Set<ChangeListener>();
  private path = '';
  private writeTimer: number | null = null;
  private pending: Promise<void> | null = null;
  private resolvePending: (() => void) | null = null;
  private loaded = false;

  async load(): Promise<void> {
    const result = await window.studio.settings.readAll();
    if (result.ok) {
      const record = result.value;
      for (const [key, value] of Object.entries(record.values)) this.values.set(key, value);
      for (const [key, value] of Object.entries(record.provenance)) this.provenance.set(key, value);
    } else {
      console.error(`Settings could not be read: ${result.error}`);
    }
    const pathResult = await window.studio.settings.filePath();
    this.path = pathResult.ok ? pathResult.value : '';
    this.loaded = true;
  }

  isLoaded(): boolean {
    return this.loaded;
  }

  get<T = unknown>(id: string, fallback?: T): T {
    if (this.values.has(id)) return this.values.get(id) as T;
    if (this.defaults.has(id)) return this.defaults.get(id) as T;
    return fallback as T;
  }

  set(id: string, value: unknown, provenance: SettingsProvenance = 'user'): void {
    const previous = this.get(id);
    if (deepEqual(previous, value)) return;
    this.values.set(id, value);
    this.provenance.set(id, provenance);
    this.emit({ id, value, previous });
    this.schedule();
  }

  has(id: string): boolean {
    return this.values.has(id);
  }

  provenanceOf(id: string): SettingsProvenance {
    if (!this.values.has(id)) return 'default';
    return this.provenance.get(id) ?? 'user';
  }

  defaultOf(id: string): unknown {
    return this.defaults.get(id);
  }

  declareDefault(id: string, value: unknown): void {
    this.defaults.set(id, value);
  }

  reset(id: string): void {
    if (!this.values.has(id)) return;
    const previous = this.values.get(id);
    this.values.delete(id);
    this.provenance.delete(id);
    this.emit({ id, value: this.get(id), previous });
    this.schedule();
  }

  resetAll(): void {
    const ids = [...this.values.keys()];
    for (const id of ids) {
      const previous = this.values.get(id);
      this.values.delete(id);
      this.provenance.delete(id);
      this.emit({ id, value: this.get(id), previous });
    }
    this.schedule();
  }

  onChange(listener: ChangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  keys(): string[] {
    return [...new Set([...this.values.keys(), ...this.defaults.keys()])].sort();
  }

  filePath(): string {
    return this.path;
  }

  async flush(): Promise<void> {
    if (this.writeTimer !== null) {
      window.clearTimeout(this.writeTimer);
      this.writeTimer = null;
      await this.write();
      return;
    }
    if (this.pending) await this.pending;
  }

  private emit(change: { id: string; value: unknown; previous: unknown }): void {
    for (const listener of [...this.listeners]) {
      try {
        listener(change);
      } catch (error) {
        console.error('A settings listener threw:', error);
      }
    }
  }

  private schedule(): void {
    if (!this.pending) {
      this.pending = new Promise<void>((resolve) => {
        this.resolvePending = resolve;
      });
    }
    if (this.writeTimer !== null) window.clearTimeout(this.writeTimer);
    this.writeTimer = window.setTimeout(() => {
      this.writeTimer = null;
      void this.write();
    }, WRITE_DEBOUNCE_MS);
  }

  private async write(): Promise<void> {
    const record: SettingsRecord = {
      values: Object.fromEntries(this.values),
      provenance: Object.fromEntries(this.provenance),
      schemaVersion: 1,
      updatedAt: new Date().toISOString()
    };
    const result = await window.studio.settings.writeAll(record);
    if (!result.ok) console.error(`Settings could not be written: ${result.error}`);
    const resolve = this.resolvePending;
    this.pending = null;
    this.resolvePending = null;
    if (resolve) resolve();
  }
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return false;
  if (typeof a !== 'object') return false;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

export const settings = new Store();

/** Reads the persisted document once at boot. */
export function loadSettings(): Promise<void> {
  return settings.load();
}
