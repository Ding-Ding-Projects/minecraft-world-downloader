/**
 * The typed contract this feature offers to the rest of the application.
 *
 * The map feature draws a world; this feature is what produces one, by driving
 * Worldlens's headless renderer. Rather than either feature reaching into the
 * other's directory, the renderer publishes what it is currently serving here
 * and anything that wants it imports this one module:
 *
 * ```ts
 * import { currentMapEndpoint, subscribeMapEndpoint } from '../worldlens/endpoint';
 * ```
 *
 * Two rules hold for everything below and are worth stating rather than
 * assuming. The endpoint is **loopback only** — the renderer is started with its
 * listen address pinned to `127.0.0.1`, so the address published here is never
 * reachable from another machine. And it is **null whenever nothing is running**:
 * there is no last-known value left lying around to be mistaken for a live one
 * after the renderer has stopped.
 */

/** A map the local renderer is serving right now. */
export interface WorldlensMapEndpoint {
  /** The complete loopback URL of the map web application. */
  url: string;
  /** Always a loopback host. */
  host: string;
  port: number;
  /** Absolute path of the directory being served, for a reader that prefers disk. */
  webroot: string;
  /** Absolute path of the world this render came from. */
  worldPath: string;
  /** The world's display name, as the save records it. */
  worldName: string;
  /** The map ids configured for this render, in the order they were written. */
  mapIds: string[];
  /** ISO-8601 time the server reported itself listening. */
  startedAt: string;
}

/** Where a render wrote its output, whether or not a server is running. */
export interface WorldlensRenderOutput {
  /** The directory the renderer ran in; `web/` and `data/` are created inside it. */
  directory: string;
  /** Absolute path of the generated web application and its map tiles. */
  webroot: string;
  /** Absolute path of the tile storage root, `web/maps` by the renderer's default. */
  mapsRoot: string;
  worldPath: string;
  /** ISO-8601 time the render reported itself complete. */
  completedAt: string;
}

type Listener = (endpoint: WorldlensMapEndpoint | null) => void;

let endpoint: WorldlensMapEndpoint | null = null;
let output: WorldlensRenderOutput | null = null;
const listeners = new Set<Listener>();

/**
 * The map currently being served on loopback, or null when nothing is running.
 *
 * Callers must re-read this rather than caching it: the renderer can be stopped
 * from several places, and a cached endpoint outlives the server that answered
 * it.
 */
export function currentMapEndpoint(): WorldlensMapEndpoint | null {
  return endpoint;
}

/** The most recent completed render's output directories, or null. */
export function currentRenderOutput(): WorldlensRenderOutput | null {
  return output;
}

/**
 * Subscribes to endpoint changes. The listener is called immediately with the
 * current value, so a subscriber never has to poll once before it is correct.
 * Returns the unsubscribe function.
 */
export function subscribeMapEndpoint(listener: Listener): () => void {
  listeners.add(listener);
  listener(endpoint);
  return () => {
    listeners.delete(listener);
  };
}

/** Published by the runner. Not part of the contract other features consume. */
export function publishMapEndpoint(next: WorldlensMapEndpoint | null): void {
  endpoint = next;
  for (const listener of [...listeners]) {
    try {
      listener(next);
    } catch {
      // A subscriber that throws must not stop the renderer's own bookkeeping,
      // and must not stop the other subscribers from being told.
    }
  }
}

/** Published by the runner when a render finishes. */
export function publishRenderOutput(next: WorldlensRenderOutput | null): void {
  output = next;
}
