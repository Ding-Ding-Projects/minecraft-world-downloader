/**
 * Paged folder discovery.
 *
 * `studio.fs.readDirectory` returns one directory's listing in one call — the
 * privileged bridge does not itself paginate — so paging happens at this
 * level instead: directories are visited breadth-first, each directory's
 * files are handed to the caller as soon as they are found (rather than
 * waiting for the whole tree), and the walk yields to the event loop every
 * few directories so a large tree never blocks the window or the queue it is
 * feeding.
 */

import type { AppContext } from '../../core/registry';

export interface DiscoveryResult {
  files: string[];
  scannedDirectories: number;
  /** True when the directory-count bound was hit before the walk finished. */
  truncated: boolean;
}

/** A hard ceiling on directories visited in one scan, so a pathological tree cannot hang the walk forever. */
const MAX_DIRECTORIES = 20_000;
const YIELD_EVERY_DIRECTORIES = 20;

function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => resolve());
    } else {
      setTimeout(resolve, 0);
    }
  });
}

/**
 * Walks one or more root folders, calling `onBatch` with each directory's
 * files as they are found. Returns once the whole reachable tree has been
 * visited, cancellation was requested, or the directory bound was hit.
 */
export async function discoverFiles(
  ctx: AppContext,
  rootFolders: string[],
  onBatch: (files: string[]) => void,
  isCancelled: () => boolean
): Promise<DiscoveryResult> {
  const files: string[] = [];
  const queue: string[] = [...rootFolders];
  let scanned = 0;
  let truncated = false;

  while (queue.length > 0) {
    if (isCancelled()) break;
    if (scanned >= MAX_DIRECTORIES) {
      truncated = true;
      break;
    }
    const directory = queue.shift();
    if (directory === undefined) break;

    const result = await ctx.studio.fs.readDirectory(directory);
    scanned += 1;
    if (!result.ok) continue;

    const batch: string[] = [];
    for (const entry of result.value) {
      if (entry.isDirectory) {
        queue.push(entry.path);
      } else {
        files.push(entry.path);
        batch.push(entry.path);
      }
    }
    if (batch.length > 0) onBatch(batch);

    if (scanned % YIELD_EVERY_DIRECTORIES === 0) await nextFrame();
  }

  return { files, scannedDirectories: scanned, truncated };
}
