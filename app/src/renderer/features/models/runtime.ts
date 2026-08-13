import type { AppContext } from '../../core/registry';
import type { ModelsState } from './state';
import type { PullQueue } from './queue';

/**
 * What every panel in this feature is handed once `init` has run.
 *
 * Kept in its own file so panels can import the type without creating a cycle
 * back through `index.ts`, which is what wires this object together.
 */
export interface Runtime {
  ctx: AppContext;
  models: ModelsState;
  queue: PullQueue;
  /**
   * Registers (or re-registers) the allow rules for the configured runtime and
   * catalog hosts. Safe to call repeatedly; it only asks the privileged bridge
   * again when a host has actually changed since the last call.
   */
  ensureHostsAllowed(): Promise<void>;
}
