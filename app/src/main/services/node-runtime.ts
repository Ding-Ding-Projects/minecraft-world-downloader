import { whichCommand } from './editor';

/**
 * Resolving a Node interpreter to run bundled JavaScript with.
 *
 * Two subsystems in this application spawn a plain `node` process against a
 * script it ships (the Scraper bot's `scraper/scrape.js`, and the mineflayer
 * bot host's generated `bot-host.js`). Requiring a *system* Node install for
 * either one is exactly the "install X and try again" defect every bundled
 * dependency in this application exists to avoid — and unlike a JRE, MinGit
 * or the GitHub CLI, there is nothing to download for Node at all: Electron
 * already embeds a complete Node runtime inside its own executable.
 *
 * Spawning `process.execPath` (the running Electron binary) with
 * `ELECTRON_RUN_AS_NODE=1` set in the child's environment makes it behave as
 * a plain `node` interpreter of exactly the version this build of Electron
 * carries — no separate install, and it is already on disk because it *is*
 * the application. That is the preferred route for both subsystems above.
 *
 * A system `node` on PATH is tried only when the embedded route is somehow
 * unusable, and this module never falls back further than that: a genuinely
 * missing Node is reported honestly by the caller, the same way a missing
 * bundled java/git/gh already is — never a browser link.
 */

export interface NodeResolution {
  /** The exact executable to spawn. */
  command: string;
  /**
   * Extra environment variables the child needs, merged over `process.env`
   * by `./processes.ts`. Empty for a system `node` found on PATH.
   */
  env: Record<string, string>;
  origin: 'embedded' | 'path';
}

/** The one environment variable that turns the Electron binary into plain Node. */
const RUN_AS_NODE_ENV: Readonly<Record<string, string>> = Object.freeze({ ELECTRON_RUN_AS_NODE: '1' });

/**
 * `process.execPath` of the running main process — the Electron binary
 * itself. Exported separately, rather than inlined into `resolveNode`, so
 * `./processes.ts`'s spawn guard can re-resolve this exact same value from
 * the main process to compare a renderer-supplied command against, the same
 * narrow way it already does for the file-backed bundled tools in
 * `./bundled.ts`. Never trust a path the renderer supplies — always recompute
 * it here and compare byte-for-byte.
 */
export function embeddedNodeCommand(): string {
  return process.execPath;
}

/**
 * Embedded (bundled) first, PATH second. In practice this never returns
 * null: the embedded Electron binary is always present, since it is the very
 * process resolving this. The PATH branch exists for the one case this still
 * refuses to spawn blindly — `process.execPath` resolving to an empty string,
 * which no real Electron process produces, but which is still checked rather
 * than assumed — and to keep this tool's shape consistent with every other
 * bundled-then-PATH resolution in `./bundled.ts`.
 */
export async function resolveNode(): Promise<NodeResolution | null> {
  const embedded = embeddedNodeCommand();
  if (embedded.length > 0) {
    return { command: embedded, env: { ...RUN_AS_NODE_ENV }, origin: 'embedded' };
  }

  const onPath = await whichCommand('node');
  return onPath ? { command: onPath, env: {}, origin: 'path' } : null;
}
