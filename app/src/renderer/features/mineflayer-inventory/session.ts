/**
 * How this feature reaches a live bot.
 *
 * The `mineflayer` feature owns the one child process and the one allow-listed
 * method surface (`../mineflayer/bot-host.js`); this feature never opens a
 * second connection and never imports that sibling's internals. Everything
 * here goes through `getMineflayerRuntimeContract()` from `../mineflayer/bridge`
 * — the generic, low-level contract that file documents as the route for a
 * sibling with no bespoke discovery contract of its own yet.
 *
 * A handful of runtime methods this feature would need do not exist on the
 * shared allow-list today (furnace fuel/progress, anvil repair cost, the
 * enchanting table's three offers, and opening a villager's trade window at
 * all — villagers are entities, and the shared runtime only exposes opening a
 * window at a *block* position). Those gaps are named in full, honestly, on
 * screen and in `docs.ts`, and are reported in this feature's handoff rather
 * than worked around by reaching outside this directory.
 */

import { getMineflayerRuntimeContract } from '../mineflayer/bridge';
import type { MineflayerRuntimeContract } from '../mineflayer/bridge';
import type { BotState, HostMessage } from '../mineflayer/protocol';
import type { SerializedWindow, NearbyBlock, NearbyEntity } from './types';

export interface ActiveSession {
  botId: string;
  status: string;
  state: BotState | null;
  /** True once the bot has actually spawned into the world — the only point at which slot data is real. */
  spawned: boolean;
  call<T = unknown>(method: string, args?: unknown[]): Promise<T>;
}

/** `null` before the `mineflayer` feature's `init` has run, or when no bot is connected at all. */
export function activeSession(): ActiveSession | null {
  const contract = getMineflayerRuntimeContract();
  if (!contract) return null;
  const botId = contract.activeBotId();
  if (!botId) return null;
  const summary = contract.listBots().find((bot) => bot.botId === botId) ?? null;
  return {
    botId,
    status: summary?.status ?? 'idle',
    state: summary?.state ?? null,
    spawned: summary?.status === 'spawned',
    call: (method, args = []) => contract.call(botId, method, args)
  };
}

/** Fires whenever the active bot changes, or whenever anything about any bot changes (state, status, list). */
export function subscribeSession(listener: () => void): () => void {
  const contract = getMineflayerRuntimeContract();
  if (!contract) return () => undefined;
  const offChange = contract.onChange(listener);
  const offActive = contract.onActiveChange(listener);
  return () => {
    offChange();
    offActive();
  };
}

export function onHostMessage(listener: (message: HostMessage) => void): () => void {
  const contract = getMineflayerRuntimeContract();
  if (!contract) return () => undefined;
  return contract.onHostMessage(listener);
}

/** `inventory` — the bot's own 46/45-slot window, always available once spawned. */
export async function fetchInventory(session: ActiveSession): Promise<SerializedWindow> {
  return session.call<SerializedWindow>('inventory');
}

/** `currentWindow` — whatever container/workstation window is presently open, or `null`. */
export async function fetchCurrentWindow(session: ActiveSession): Promise<SerializedWindow | null> {
  return session.call<SerializedWindow | null>('currentWindow');
}

/**
 * `findBlocks` — real nearby block positions, used everywhere this feature
 * would otherwise show a blank coordinate box. `matching` takes block *names*;
 * `blockTypeOrFail` in the runtime resolves each one against the bot's own,
 * real, connected-server registry, so a name that does not exist on this
 * server's version is refused with an honest error rather than silently
 * dropped.
 */
export async function findNearbyBlocks(
  session: ActiveSession,
  matching: string[],
  maxDistance: number,
  count: number
): Promise<NearbyBlock[]> {
  const raw = await session.call<Array<{ position: { x: number; y: number; z: number } | null; name: string | null; displayName: string | null }>>(
    'findBlocks',
    [{ matching, maxDistance, count }]
  );
  const origin = session.state?.position ?? null;
  return raw
    .filter((entry): entry is { position: { x: number; y: number; z: number }; name: string; displayName: string } =>
      entry.position !== null && entry.name !== null
    )
    .map((entry) => ({
      name: entry.name,
      displayName: entry.displayName ?? entry.name,
      position: entry.position,
      distance: origin ? distanceBetween(origin, entry.position) : Number.NaN
    }))
    .sort((a, b) => a.distance - b.distance);
}

/** `entities` — every entity the bot currently tracks, filtered and flattened for this feature's own use (villagers). */
export async function findNearbyEntities(
  session: ActiveSession,
  typeName: string,
  maxDistance: number,
  limit: number
): Promise<NearbyEntity[]> {
  const raw = await session.call<
    Array<{
      id: number;
      type: string;
      name: string;
      displayName: string;
      username: string | null;
      position: { x: number; y: number; z: number } | null;
    }>
  >('entities');
  const origin = session.state?.position ?? null;
  return raw
    .filter((entry) => entry.name === typeName)
    .map((entry) => ({
      id: entry.id,
      type: entry.type,
      name: entry.name,
      displayName: entry.displayName,
      username: entry.username,
      position: entry.position,
      distance: origin && entry.position ? distanceBetween(origin, entry.position) : Number.NaN
    }))
    .filter((entry) => !Number.isFinite(entry.distance) || entry.distance <= maxDistance)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit);
}

function distanceBetween(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/** Runs `fn` immediately, then again on the interval, stopping when the returned function is called. Errors are reported, never thrown into the timer. */
export function pollWhile(fn: () => void | Promise<void>, intervalMs: number, onError?: (error: unknown) => void): () => void {
  let disposed = false;
  const run = () => {
    if (disposed) return;
    Promise.resolve()
      .then(fn)
      .catch((error) => onError?.(error));
  };
  run();
  const handle = setInterval(run, intervalMs);
  return () => {
    disposed = true;
    clearInterval(handle);
  };
}

export function describeCallError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'The bot runtime refused the request.';
}
