/**
 * How this surface reaches a live bot.
 *
 * The `mineflayer` feature owns the one connection to a Minecraft server and
 * publishes a generic, low-level contract for exactly this situation:
 * `getMineflayerRuntimeContract()` in its own `bridge.ts`, which that file's
 * own comment says was built for "a future mineflayer-inventory or
 * mineflayer-world feature [with] no contract to discover yet". This module
 * finds it with `import.meta.glob` -- the same mechanism the boot sequence
 * uses to discover features, and the same mechanism `mineflayer-movement`
 * already uses to find the bot feature itself -- so this feature compiles,
 * builds and runs whether or not that module exists, and duck-types
 * everything it gets back rather than statically importing the sibling's
 * types: a renamed internal interface over there should never be a compile
 * error over here.
 */

export interface WorldBotSummary {
  botId: string;
  name: string;
  status: string;
  state: unknown;
}

export interface WorldHostMessage {
  type: string;
  botId?: string;
  name?: string;
  at?: number;
  payload?: unknown;
}

export interface WorldRuntimeContract {
  activeBotId(): string | null;
  onActiveChange(listener: () => void): () => void;
  listBots(): WorldBotSummary[];
  onChange(listener: () => void): () => void;
  getState(botId: string): unknown;
  call<T = unknown>(botId: string, method: string, args?: unknown[]): Promise<T>;
  onHostMessage(listener: (message: WorldHostMessage) => void): () => void;
}

const REQUIRED_METHODS = ['activeBotId', 'onActiveChange', 'listBots', 'onChange', 'getState', 'call', 'onHostMessage'];

function asContract(value: unknown): WorldRuntimeContract | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  for (const key of REQUIRED_METHODS) {
    if (typeof candidate[key] !== 'function') return null;
  }
  return candidate as unknown as WorldRuntimeContract;
}

export type WorldBridgeState = 'searching' | 'unavailable' | 'ready';

/**
 * `import.meta.glob` resolves to an empty record when nothing matches, so
 * this feature compiles, builds and runs whether or not `../mineflayer`
 * exists in this build.
 */
const BRIDGE_MODULES = import.meta.glob<Record<string, unknown>>('../mineflayer/bridge.ts');

/**
 * Holds whichever contract was found and reports which of three genuinely
 * different states this surface is in: still looking, nothing to drive
 * (the `mineflayer` feature is not in this build), and ready. Collapsing
 * "no module" into "not connected" would send somebody hunting for a server
 * problem that is really a missing feature.
 */
export class WorldContractBridge {
  private getter: (() => unknown) | null = null;
  private contract: WorldRuntimeContract | null = null;
  private status: WorldBridgeState = 'searching';
  private pollHandle: ReturnType<typeof setInterval> | null = null;
  private readonly listeners = new Set<() => void>();

  state(): WorldBridgeState {
    return this.status;
  }

  current(): WorldRuntimeContract | null {
    return this.contract;
  }

  subscribe(listener: () => void): () => void {
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
        console.error('A mineflayer-world listener threw while the runtime bridge changed.', error);
      }
    }
  }

  async start(): Promise<void> {
    const loaders = Object.values(BRIDGE_MODULES);
    if (loaders.length === 0) {
      this.status = 'unavailable';
      this.emit();
      return;
    }
    let moduleExports: Record<string, unknown>;
    try {
      moduleExports = await loaders[0]();
    } catch (error) {
      console.error('The mineflayer bridge module failed to load for the world surface.', error);
      this.status = 'unavailable';
      this.emit();
      return;
    }
    const found = moduleExports.getMineflayerRuntimeContract;
    if (typeof found !== 'function') {
      this.status = 'unavailable';
      this.emit();
      return;
    }
    this.getter = found as () => unknown;
    this.poll();
    if (!this.contract) {
      this.pollHandle = setInterval(() => this.poll(), 400);
    }
  }

  private poll(): void {
    if (!this.getter || this.contract) return;
    const found = asContract(this.getter());
    if (found) {
      this.contract = found;
      this.status = 'ready';
      if (this.pollHandle) {
        clearInterval(this.pollHandle);
        this.pollHandle = null;
      }
      this.emit();
    }
  }

  dispose(): void {
    if (this.pollHandle) clearInterval(this.pollHandle);
    this.pollHandle = null;
    this.listeners.clear();
  }
}
