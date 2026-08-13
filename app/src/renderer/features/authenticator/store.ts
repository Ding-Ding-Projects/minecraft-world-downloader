/**
 * Where the entries live.
 *
 * Two stores, deliberately: the record — issuer, account, label, icon, group,
 * algorithm, digits, period — goes in the ordinary settings document like any
 * other list this application owns, and the SECRET goes in the operating
 * system's credential vault under a stable per-entry key. Nothing that can
 * generate a code is ever written to the settings file, an export, a log, a
 * screenshot, a history entry or a crash report.
 *
 * There is no account, no synchronization and no network. Deleting the
 * application data folder removes the records; the vault entries are removed
 * with the entry they belong to, and the surface says so where somebody is
 * looking for it.
 */

import { totp } from '../../core/totp';
import type { AppContext } from '../../core/registry';
import type { AuthenticatorEntry, AuthenticatorGroup } from './model';
import { LIMITS } from './model';
import { correctedNow } from './clock';

export const ENTRIES_KEY = 'authenticator.entries';
export const GROUPS_KEY = 'authenticator.groups';

/** The vault account key for one entry. Stable for the entry's whole life. */
export function vaultAccount(entryId: string): string {
  return `authenticator:${entryId.replace(/[^A-Za-z0-9._:@-]/g, '_')}`;
}

/**
 * Secrets read back from the vault, held only in memory for this window.
 *
 * A live code display needs the secret every period, and asking the operating
 * system's credential store for it thirty times a minute is neither fast nor
 * kind. It is a plain map in this process: never persisted, never serialized,
 * gone when the window closes, and clearable on demand from the surface.
 */
const secretCache = new Map<string, string>();

export interface StoreEvents {
  onChange(listener: () => void): () => void;
}

export class AuthenticatorStore implements StoreEvents {
  private listeners = new Set<() => void>();

  constructor(private ctx: AppContext) {}

  /* ---------------- reading ---------------- */

  entries(): AuthenticatorEntry[] {
    const stored = this.ctx.settings.get<AuthenticatorEntry[]>(ENTRIES_KEY, []);
    if (!Array.isArray(stored)) return [];
    return stored.filter(isEntry).sort((a, b) => a.order - b.order);
  }

  entry(id: string): AuthenticatorEntry | null {
    return this.entries().find((candidate) => candidate.id === id) ?? null;
  }

  groups(): AuthenticatorGroup[] {
    const stored = this.ctx.settings.get<AuthenticatorGroup[]>(GROUPS_KEY, []);
    if (!Array.isArray(stored)) return [];
    return stored.filter(isGroup).sort((a, b) => a.order - b.order);
  }

  groupName(groupId: string | null): string {
    if (!groupId) return '';
    return this.groups().find((group) => group.id === groupId)?.name ?? '';
  }

  /* ---------------- writing ---------------- */

  private writeEntries(entries: AuthenticatorEntry[]): void {
    this.ctx.settings.set(
      ENTRIES_KEY,
      entries.map((entry, index) => ({ ...entry, order: index }))
    );
    this.emit();
  }

  private writeGroups(groups: AuthenticatorGroup[]): void {
    this.ctx.settings.set(
      GROUPS_KEY,
      groups.map((group, index) => ({ ...group, order: index }))
    );
    this.emit();
  }

  /**
   * Adds an entry and stores its secret.
   *
   * The vault write happens FIRST. An entry whose record exists but whose secret
   * did not store is an entry that shows a blank code for ever with no
   * explanation, so a failed vault write means no record is created at all and
   * the caller is told exactly what failed.
   */
  async add(entry: AuthenticatorEntry, secret: string): Promise<void> {
    const existing = this.entries();
    if (existing.length >= LIMITS.maxEntries) {
      throw new Error(`This authenticator holds ${LIMITS.maxEntries} entries, which is already full.`);
    }
    const stored = await this.ctx.studio.vault.set(vaultAccount(entry.id), secret);
    if (!stored.ok) {
      throw new Error(`The secret was not stored in the credential vault, so nothing was added: ${stored.error}`);
    }
    secretCache.set(entry.id, secret);
    this.writeEntries([...existing, entry]);
    await this.ctx.history.record('Added a one-time code entry', 'authenticator', {
      id: entry.id,
      issuer: entry.issuer,
      account: entry.account,
      algorithm: entry.algorithm,
      digits: entry.digits,
      period: entry.period,
      verified: entry.verified
    });
  }

  /** Applies a patch to one entry. The secret is never part of a patch. */
  async update(id: string, patch: Partial<Omit<AuthenticatorEntry, 'id' | 'createdAt'>>, action: string): Promise<void> {
    const entries = this.entries();
    const index = entries.findIndex((candidate) => candidate.id === id);
    if (index === -1) return;
    const before = entries[index];
    entries[index] = { ...before, ...patch, id: before.id, createdAt: before.createdAt };
    this.writeEntries(entries);
    await this.ctx.history.record(action, 'authenticator', {
      id,
      changed: Object.keys(patch),
      from: pick(before as unknown as Record<string, unknown>, Object.keys(patch)),
      to: pick(entries[index] as unknown as Record<string, unknown>, Object.keys(patch))
    });
  }

  /** Removes entries and their vault secrets. */
  async remove(ids: string[]): Promise<{ removed: string[]; failed: Array<{ id: string; reason: string }> }> {
    const removed: string[] = [];
    const failed: Array<{ id: string; reason: string }> = [];
    for (const id of ids) {
      const result = await this.ctx.studio.vault.delete(vaultAccount(id));
      if (!result.ok) {
        // The record stays when its secret could not be removed: a record with
        // no secret behind it is a row that can never produce a code, and
        // leaving one of those behind silently is worse than reporting this.
        failed.push({ id, reason: result.error });
        continue;
      }
      secretCache.delete(id);
      removed.push(id);
    }
    if (removed.length > 0) {
      const kept = this.entries().filter((entry) => !removed.includes(entry.id));
      this.writeEntries(kept);
      await this.ctx.history.record('Deleted one-time code entries', 'authenticator', { ids: removed });
    }
    return { removed, failed };
  }

  /** Moves an entry up or down within the list. */
  async move(id: string, delta: number): Promise<void> {
    const entries = this.entries();
    const index = entries.findIndex((entry) => entry.id === id);
    const target = index + delta;
    if (index === -1 || target < 0 || target >= entries.length) return;
    const [moved] = entries.splice(index, 1);
    entries.splice(target, 0, moved);
    this.writeEntries(entries);
    await this.ctx.history.record('Reordered a one-time code entry', 'authenticator', { id, from: index, to: target });
  }

  async setGroup(ids: string[], groupId: string | null): Promise<void> {
    const entries = this.entries().map((entry) => (ids.includes(entry.id) ? { ...entry, group: groupId } : entry));
    this.writeEntries(entries);
    await this.ctx.history.record('Moved one-time code entries into a group', 'authenticator', { ids, group: groupId });
  }

  async createGroup(name: string, color: string): Promise<AuthenticatorGroup> {
    const groups = this.groups();
    const group: AuthenticatorGroup = {
      id: `group-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`,
      name,
      color,
      collapsed: false,
      order: groups.length
    };
    this.writeGroups([...groups, group]);
    await this.ctx.history.record('Created an authenticator group', 'authenticator', { id: group.id, name });
    return group;
  }

  async updateGroup(id: string, patch: Partial<Omit<AuthenticatorGroup, 'id'>>): Promise<void> {
    const groups = this.groups();
    const index = groups.findIndex((group) => group.id === id);
    if (index === -1) return;
    groups[index] = { ...groups[index], ...patch, id };
    this.writeGroups(groups);
    if (patch.collapsed === undefined || Object.keys(patch).length > 1) {
      await this.ctx.history.record('Changed an authenticator group', 'authenticator', { id, changed: Object.keys(patch) });
    }
  }

  /** Removes a group. Its entries are kept and become ungrouped. */
  async removeGroup(id: string): Promise<void> {
    this.writeGroups(this.groups().filter((group) => group.id !== id));
    const entries = this.entries().map((entry) => (entry.group === id ? { ...entry, group: null } : entry));
    this.writeEntries(entries);
    await this.ctx.history.record('Removed an authenticator group', 'authenticator', { id });
  }

  /* ---------------- secrets ---------------- */

  /**
   * Reads one secret back.
   *
   * Only a flow the user just started should call this, and the value must never
   * be logged, exported or rendered anywhere except the deliberate reveal and
   * the pairing picture.
   */
  async secretFor(id: string): Promise<string | null> {
    const cached = secretCache.get(id);
    if (cached !== undefined) return cached;
    const result = await this.ctx.studio.vault.get(vaultAccount(id));
    if (!result.ok || result.value === null) return null;
    secretCache.set(id, result.value);
    return result.value;
  }

  /** True when the vault actually holds a secret for this entry. */
  async hasSecret(id: string): Promise<boolean> {
    if (secretCache.has(id)) return true;
    const result = await this.ctx.studio.vault.has(vaultAccount(id));
    return result.ok && result.value;
  }

  /** Drops every cached secret from this window's memory. */
  forgetCachedSecrets(): void {
    secretCache.clear();
  }

  cachedSecretCount(): number {
    return secretCache.size;
  }

  /* ---------------- codes ---------------- */

  /** The code for one entry at the corrected time, or null with no secret. */
  async codeFor(entry: AuthenticatorEntry, atMs?: number): Promise<string | null> {
    const secret = await this.secretFor(entry.id);
    if (secret === null) return null;
    return totp(
      { secret, algorithm: entry.algorithm, digits: entry.digits, period: entry.period },
      atMs ?? correctedNow(this.ctx)
    );
  }

  /** The code for the period after this one, so nobody types a expiring code. */
  async nextCodeFor(entry: AuthenticatorEntry, atMs?: number): Promise<string | null> {
    const base = atMs ?? correctedNow(this.ctx);
    return this.codeFor(entry, base + entry.period * 1000);
  }

  /** Whole seconds left in the current period. */
  secondsRemaining(entry: AuthenticatorEntry, atMs?: number): number {
    const base = atMs ?? correctedNow(this.ctx);
    const elapsed = (base / 1000) % entry.period;
    return Math.max(0, Math.ceil(entry.period - elapsed));
  }

  /* ---------------- events ---------------- */

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    for (const listener of [...this.listeners]) {
      try {
        listener();
      } catch (error) {
        console.error('An authenticator listener threw:', error);
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* Shared instance                                                     */
/* ------------------------------------------------------------------ */

let instance: AuthenticatorStore | null = null;

export function attachStore(ctx: AppContext): AuthenticatorStore {
  instance = new AuthenticatorStore(ctx);
  return instance;
}

export function store(): AuthenticatorStore {
  if (!instance) {
    throw new Error('The authenticator store was used before the feature was initialized.');
  }
  return instance;
}

/* ------------------------------------------------------------------ */
/* Guards                                                              */
/* ------------------------------------------------------------------ */

function isEntry(value: unknown): value is AuthenticatorEntry {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<AuthenticatorEntry>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.issuer === 'string' &&
    typeof candidate.account === 'string' &&
    typeof candidate.digits === 'number' &&
    typeof candidate.period === 'number' &&
    (candidate.algorithm === 'SHA-1' || candidate.algorithm === 'SHA-256' || candidate.algorithm === 'SHA-512')
  );
}

function isGroup(value: unknown): value is AuthenticatorGroup {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<AuthenticatorGroup>;
  return typeof candidate.id === 'string' && typeof candidate.name === 'string';
}

function pick(source: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of keys) out[key] = source[key];
  return out;
}
