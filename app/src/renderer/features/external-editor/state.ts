import type { AppContext, EditorCandidate } from '../../core/registry';
import {
  AUTOMATIC,
  ACTIVE_ID,
  CUSTOM_EDITORS_KEY,
  DEFAULT_ACTIVE,
  DEFAULT_RECENT_LIMIT,
  RECENT_KEY,
  RECENT_LIMIT_ID
} from './settingIds';

/**
 * What the application knows about the editors on this machine.
 *
 * Two things live here, and the difference between them is the whole reason the
 * surface has to be honest about status:
 *
 *   - **Detected** editors come from the privileged bridge, which probes PATH
 *     and the usual per-user and machine install locations for a known list.
 *     Those can be launched, because the bridge knows how to launch them.
 *   - **Added** editors are executables the user browsed for. The bridge
 *     launches an editor by its known id, not by an arbitrary path, so an added
 *     executable is launchable exactly when it turns out to be the same file as
 *     one of the detected ones — which is the common case, because the usual
 *     reason to browse is that the probe looked in the wrong place.
 *
 * An added executable that is nothing the probe knows is still kept, still
 * listed and still verified against the disk; what it does not get is a button
 * that pretends it will start something. It gets a disabled button naming the
 * exact reason and two routes that genuinely work instead.
 */

export interface CustomEditor {
  id: string;
  name: string;
  /** Absolute path to the executable the user browsed for. */
  command: string;
  supportsFolder: boolean;
  /** ISO-8601. */
  addedAt: string;
}

export type EditorOrigin = 'detected' | 'added';

export type EditorStatus =
  /** Detected and present: a handoff will start it. */
  | 'ready'
  /** Added, and the same file as a detected editor, so a handoff will start it. */
  | 'linked'
  /** Known, but the executable is not on this machine. */
  | 'missing'
  /** Added, present on disk, but not an editor this application can start. */
  | 'unlinked';

export interface EditorRow {
  id: string;
  name: string;
  command: string;
  origin: EditorOrigin;
  supportsFolder: boolean;
  status: EditorStatus;
  /**
   * The detected editor id a handoff actually uses. Equal to `id` for a
   * detected row, the matched detected id for a linked one, and null when
   * nothing on this machine can start it.
   */
  launchId: string | null;
  /** ISO-8601, for an added editor. Empty for a detected one. */
  addedAt: string;
}

export interface RecentHandoff {
  id: string;
  /** The path that was handed over. */
  path: string;
  /** `file` or `workspace`. */
  mode: string;
  /** The editor that was asked, or an empty string when none could be. */
  editor: string;
  /** ISO-8601. */
  at: string;
  ok: boolean;
  /** Exact failure text when `ok` is false. Empty otherwise. */
  error: string;
}

/** The detected editors this handoff prefers, best first. */
const PREFERRED_ORDER = ['vscode', 'vscode-insiders', 'vscodium'];

/** A hard ceiling, so a stored list cannot grow without bound. */
const MAX_CUSTOM_EDITORS = 40;
const MAX_RECENT = 200;

function normalizePath(path: string, caseInsensitive: boolean): string {
  const unified = path.trim().replace(/\\/g, '/').replace(/\/+$/, '');
  return caseInsensitive ? unified.toLowerCase() : unified;
}

/** The file name, used to name an added editor when the user does not. */
export function baseName(path: string): string {
  const unified = path.trim().replace(/\\/g, '/').replace(/\/+$/, '');
  const last = unified.slice(unified.lastIndexOf('/') + 1);
  return last.length > 0 ? last : unified;
}

/** The containing directory of a path, or the path itself when it has none. */
export function parentDirectory(path: string): string {
  const unified = path.trim().replace(/\\/g, '/').replace(/\/+$/, '');
  const cut = unified.lastIndexOf('/');
  return cut > 0 ? unified.slice(0, cut) : unified;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readCustomEditors(raw: unknown): CustomEditor[] {
  if (!Array.isArray(raw)) return [];
  const out: CustomEditor[] = [];
  for (const entry of raw) {
    if (!isRecord(entry)) continue;
    const id = typeof entry.id === 'string' ? entry.id : '';
    const command = typeof entry.command === 'string' ? entry.command : '';
    if (id === '' || command === '') continue;
    out.push({
      id,
      name: typeof entry.name === 'string' && entry.name.trim() !== '' ? entry.name : baseName(command),
      command,
      supportsFolder: entry.supportsFolder === true,
      addedAt: typeof entry.addedAt === 'string' ? entry.addedAt : new Date(0).toISOString()
    });
    if (out.length >= MAX_CUSTOM_EDITORS) break;
  }
  return out;
}

function readRecent(raw: unknown): RecentHandoff[] {
  if (!Array.isArray(raw)) return [];
  const out: RecentHandoff[] = [];
  for (const entry of raw) {
    if (!isRecord(entry)) continue;
    const path = typeof entry.path === 'string' ? entry.path : '';
    if (path === '') continue;
    out.push({
      id: typeof entry.id === 'string' ? entry.id : `handoff-${out.length}`,
      path,
      mode: entry.mode === 'workspace' ? 'workspace' : 'file',
      editor: typeof entry.editor === 'string' ? entry.editor : '',
      at: typeof entry.at === 'string' ? entry.at : new Date(0).toISOString(),
      ok: entry.ok === true,
      error: typeof entry.error === 'string' ? entry.error : ''
    });
    if (out.length >= MAX_RECENT) break;
  }
  return out;
}

let counter = 0;
function freshId(): string {
  counter += 1;
  return `added-${Date.now().toString(36)}-${counter.toString(36)}`;
}

export interface AddOutcome {
  ok: boolean;
  /** Present when the executable was accepted. */
  row?: EditorRow;
  /** Exact refusal reason. */
  error?: string;
}

class EditorStore {
  private ctx: AppContext | null = null;
  private detected: EditorCandidate[] = [];
  private custom: CustomEditor[] = [];
  private missingOnDisk = new Set<string>();
  private listeners = new Set<() => void>();
  private probeError: string | null = null;
  private probed = false;
  private probing = false;

  attach(ctx: AppContext): void {
    this.ctx = ctx;
    this.custom = readCustomEditors(ctx.settings.get<unknown>(CUSTOM_EDITORS_KEY, []));
  }

  private require(): AppContext {
    if (!this.ctx) {
      throw new Error('The external editor store was used before the feature was initialized.');
    }
    return this.ctx;
  }

  private caseInsensitive(): boolean {
    return this.require().studio.info.platform === 'win32';
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    for (const listener of [...this.listeners]) listener();
  }

  /** True once a probe has completed, successfully or not. */
  hasProbed(): boolean {
    return this.probed;
  }

  /** True while a probe is in flight, so a surface can say so rather than spin. */
  isProbing(): boolean {
    return this.probing;
  }

  /** The exact reason the probe itself failed, as opposed to finding nothing. */
  lastProbeError(): string | null {
    return this.probeError;
  }

  /**
   * Probes the machine, then verifies every added executable against the disk.
   *
   * Both halves matter: an editor uninstalled since the last launch must stop
   * claiming to be there, and an added path that has moved must say so rather
   * than failing at the moment somebody uses it.
   */
  async refresh(): Promise<void> {
    const ctx = this.require();
    if (this.probing) return;
    this.probing = true;
    this.emit();
    try {
      const result = await ctx.studio.editor.detect();
      if (result.ok) {
        this.detected = result.value;
        this.probeError = null;
      } else {
        this.detected = [];
        this.probeError = result.error;
      }

      const missing = new Set<string>();
      for (const editor of this.custom) {
        const stat = await ctx.studio.fs.stat(editor.command);
        if (!stat.ok || !stat.value.exists || stat.value.isDirectory) missing.add(editor.id);
      }
      this.missingOnDisk = missing;
      this.probed = true;
    } finally {
      this.probing = false;
      this.emit();
    }
  }

  /** Everything known, detected first in preference order, then added ones. */
  rows(): EditorRow[] {
    const insensitive = this.caseInsensitive();
    const detectedRows: EditorRow[] = this.detected.map((candidate) => ({
      id: candidate.id,
      name: candidate.name,
      command: candidate.command,
      origin: 'detected',
      supportsFolder: candidate.supportsFolder,
      status: candidate.available ? 'ready' : 'missing',
      launchId: candidate.available ? candidate.id : null,
      addedAt: ''
    }));

    detectedRows.sort((left, right) => {
      const leftRank = PREFERRED_ORDER.indexOf(left.id);
      const rightRank = PREFERRED_ORDER.indexOf(right.id);
      const leftKey = leftRank === -1 ? PREFERRED_ORDER.length : leftRank;
      const rightKey = rightRank === -1 ? PREFERRED_ORDER.length : rightRank;
      if (leftKey !== rightKey) return leftKey - rightKey;
      if (left.status !== right.status) return left.status === 'ready' ? -1 : 1;
      return left.name.localeCompare(right.name);
    });

    const addedRows: EditorRow[] = this.custom.map((editor) => {
      const gone = this.missingOnDisk.has(editor.id);
      const match = this.detected.find(
        (candidate) =>
          candidate.available &&
          normalizePath(candidate.command, insensitive) === normalizePath(editor.command, insensitive)
      );
      const status: EditorStatus = gone ? 'missing' : match ? 'linked' : 'unlinked';
      return {
        id: editor.id,
        name: editor.name,
        command: editor.command,
        origin: 'added',
        supportsFolder: match ? match.supportsFolder : editor.supportsFolder,
        status,
        launchId: match ? match.id : null,
        addedAt: editor.addedAt
      };
    });

    return [...detectedRows, ...addedRows];
  }

  row(id: string): EditorRow | null {
    return this.rows().find((row) => row.id === id) ?? null;
  }

  /** Every row a handoff could actually use. */
  usable(): EditorRow[] {
    return this.rows().filter((row) => row.launchId !== null);
  }

  activeId(): string {
    return this.require().settings.get<string>(ACTIVE_ID, DEFAULT_ACTIVE);
  }

  setActive(id: string): void {
    this.require().settings.set(ACTIVE_ID, id);
    this.emit();
  }

  /**
   * The row a handoff will use right now.
   *
   * With `auto`, the first usable row in preference order — Visual Studio Code
   * ahead of everything else. With an explicit choice that is not usable, null
   * rather than a silent substitution: a Notepad window opening where the user
   * asked for Visual Studio Code explains nothing about itself.
   */
  resolveActive(): EditorRow | null {
    const chosen = this.activeId();
    if (chosen !== AUTOMATIC) {
      const row = this.row(chosen);
      return row && row.launchId !== null ? row : null;
    }
    return this.usable()[0] ?? null;
  }

  /** True when an explicit choice was made and that editor cannot be used. */
  activeIsUnusable(): boolean {
    const chosen = this.activeId();
    if (chosen === AUTOMATIC) return false;
    const row = this.row(chosen);
    return row !== null && row.launchId === null;
  }

  /**
   * Registers an executable the user browsed for.
   *
   * The path is verified against the disk before it is stored, so the list
   * cannot fill up with entries that were never going to work. A duplicate is
   * refused by naming the entry that already holds it rather than quietly
   * adding a second row for one file.
   */
  async addCustom(input: { name: string; command: string; supportsFolder: boolean }): Promise<AddOutcome> {
    const ctx = this.require();
    const command = input.command.trim();
    if (command === '') {
      return { ok: false, error: 'No executable was chosen.' };
    }
    if (this.custom.length >= MAX_CUSTOM_EDITORS) {
      return {
        ok: false,
        error: `${MAX_CUSTOM_EDITORS} editors are already stored, which is the limit. Remove one first.`
      };
    }

    const insensitive = this.caseInsensitive();
    const normalized = normalizePath(command, insensitive);
    const clash = this.custom.find((editor) => normalizePath(editor.command, insensitive) === normalized);
    if (clash) {
      return { ok: false, error: `That executable is already stored as "${clash.name}".` };
    }

    const stat = await ctx.studio.fs.stat(command);
    if (!stat.ok) {
      return { ok: false, error: stat.error };
    }
    if (!stat.value.exists) {
      return { ok: false, error: 'There is no file at that path on this machine.' };
    }
    if (stat.value.isDirectory) {
      return { ok: false, error: 'That path is a folder. Choose the editor executable itself.' };
    }

    const editor: CustomEditor = {
      id: freshId(),
      name: input.name.trim() === '' ? baseName(command) : input.name.trim(),
      command,
      supportsFolder: input.supportsFolder,
      addedAt: new Date().toISOString()
    };
    this.custom = [...this.custom, editor];
    this.persistCustom();
    this.missingOnDisk.delete(editor.id);
    this.emit();
    return { ok: true, row: this.row(editor.id) ?? undefined };
  }

  /** Removes added editors. Detected ones are not the user's to remove. */
  removeCustom(ids: string[]): { removed: CustomEditor[]; refused: string[] } {
    const wanted = new Set(ids);
    const removed = this.custom.filter((editor) => wanted.has(editor.id));
    const refused = ids.filter((id) => !removed.some((editor) => editor.id === id));
    if (removed.length === 0) return { removed, refused };
    this.custom = this.custom.filter((editor) => !wanted.has(editor.id));
    this.persistCustom();
    if (removed.some((editor) => editor.id === this.activeId())) {
      this.require().settings.set(ACTIVE_ID, AUTOMATIC);
    }
    this.emit();
    return { removed, refused };
  }

  /** Renames an added editor. Returns false when the id is not an added one. */
  renameCustom(id: string, name: string): boolean {
    const index = this.custom.findIndex((editor) => editor.id === id);
    if (index === -1) return false;
    const trimmed = name.trim();
    this.custom = this.custom.map((editor, position) =>
      position === index ? { ...editor, name: trimmed === '' ? baseName(editor.command) : trimmed } : editor
    );
    this.persistCustom();
    this.emit();
    return true;
  }

  private persistCustom(): void {
    this.require().settings.set(CUSTOM_EDITORS_KEY, this.custom.map((editor) => ({ ...editor })));
  }

  /* ---------------- recent handoffs ---------------- */

  recent(): RecentHandoff[] {
    return readRecent(this.require().settings.get<unknown>(RECENT_KEY, []));
  }

  recordHandoff(entry: Omit<RecentHandoff, 'id' | 'at'>): RecentHandoff {
    const ctx = this.require();
    const limit = Math.max(0, Math.min(MAX_RECENT, Number(ctx.settings.get(RECENT_LIMIT_ID, DEFAULT_RECENT_LIMIT))));
    const record: RecentHandoff = { ...entry, id: freshId(), at: new Date().toISOString() };
    const kept = limit === 0 ? [] : [record, ...this.recent()].slice(0, limit);
    ctx.settings.set(RECENT_KEY, kept.map((item) => ({ ...item })));
    this.emit();
    return record;
  }

  removeRecent(ids: string[]): RecentHandoff[] {
    const wanted = new Set(ids);
    const current = this.recent();
    const removed = current.filter((entry) => wanted.has(entry.id));
    if (removed.length === 0) return removed;
    this.require().settings.set(
      RECENT_KEY,
      current.filter((entry) => !wanted.has(entry.id)).map((entry) => ({ ...entry }))
    );
    this.emit();
    return removed;
  }

  clearRecent(): number {
    const count = this.recent().length;
    if (count === 0) return 0;
    this.require().settings.set(RECENT_KEY, []);
    this.emit();
    return count;
  }
}

export const editorStore = new EditorStore();
