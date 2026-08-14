import { statSync } from 'node:fs';
import { join } from 'node:path';
import type { BundledTool, BundledToolResolution } from '../../shared/api';
import { resourcesRoot } from '../paths';
import { whichCommand } from './editor';
import { embeddedNodeCommand, resolveNode } from './node-runtime';

/**
 * Bundled-dependency resolution.
 *
 * The whole point of this module: a dependency the application itself needs
 * (the Java engine, optionally a trimmed Java runtime, Git and the GitHub
 * CLI, a Node runtime, and the standalone Scraper bot project) is looked for
 * INSIDE the application first. Only when it is genuinely not there does
 * anything fall back to PATH, and nothing here ever hands back a browser
 * link — that is the defect this module exists to remove. Acquiring a
 * dependency that is missing altogether is a BUILD-time concern
 * (electron-builder.yml's `extraResources`, and the scripts that populate
 * `runtime/` before packaging); this module only ever reports what is
 * already on disk.
 *
 * `node` is the one exception to "look for a file": Electron already embeds
 * a complete Node runtime inside its own executable, so resolving it never
 * touches the filesystem at all — see `./node-runtime.ts`, which this module
 * delegates to for both the resolution itself and the exact value
 * `./processes.ts`'s spawn guard re-checks a renderer-supplied command
 * against.
 *
 * `BundledTool` and `BundledToolResolution` are re-exported from
 * `shared/api.ts` (their canonical home, since the renderer-facing bridge
 * needs the exact same type) rather than declared twice, so the two can
 * never quietly drift apart.
 */
export type { BundledTool, BundledToolResolution };

interface ToolSpec {
  /** Directory segments under the resources root, e.g. ['runtime', 'jre', 'bin']. */
  dir: string[];
  /** Base file name, without a platform executable suffix. */
  file: string;
  /** True for a native executable (gets `.exe` on Windows); false for a plain file such as the jar. */
  executable: boolean;
}

/**
 * The fixed path contract every lane in this pass codes against:
 *
 *   <resources>/engine/world-downloader.jar
 *   <resources>/runtime/jre/bin/java(.exe)
 *   <resources>/runtime/git/cmd/git(.exe)
 *   <resources>/runtime/gh/bin/gh(.exe)
 *   <resources>/scraper/scrape.js
 *
 * `node` is deliberately absent: it has no on-disk spec of its own, since
 * resolving it means handing back `process.execPath` rather than statting a
 * file under `resourcesRoot()` — see `bundledToolPath` and `resolveTool`
 * below, both of which special-case it before ever consulting this table.
 */
const TOOL_SPECS: Record<Exclude<BundledTool, 'node'>, ToolSpec> = {
  engineJar: { dir: ['engine'], file: 'world-downloader.jar', executable: false },
  java: { dir: ['runtime', 'jre', 'bin'], file: 'java', executable: true },
  git: { dir: ['runtime', 'git', 'cmd'], file: 'git', executable: true },
  gh: { dir: ['runtime', 'gh', 'bin'], file: 'gh', executable: true },
  scraperScript: { dir: ['scraper'], file: 'scrape.js', executable: false }
};

/**
 * The command each tool would be found under on PATH. `engineJar` and
 * `scraperScript` have none: a jar and a standalone project's entry script
 * are not things a shell resolves by name, so a missing bundled copy of
 * either simply has no PATH fallback to try. `node` also has none here —
 * its own PATH fallback is resolved inside `./node-runtime.ts`, not through
 * this generic table, because unlike the others its "bundled" answer is
 * never a file this module stats.
 */
const PATH_COMMAND: Partial<Record<BundledTool, string>> = {
  java: 'java',
  git: 'git',
  gh: 'gh'
};

function fileName(spec: ToolSpec): string {
  if (!spec.executable) return spec.file;
  return process.platform === 'win32' ? `${spec.file}.exe` : spec.file;
}

function candidatePath(tool: Exclude<BundledTool, 'node'>): string {
  const spec = TOOL_SPECS[tool];
  return join(resourcesRoot(), ...spec.dir, fileName(spec));
}

/**
 * Positive lookups only — a tool once found stays found for the life of the
 * process, since the resources directory of a running build does not change
 * underneath it. A miss is never cached: a fresh `bundledToolPath` call
 * always re-stats, so a tool that a user (or a later build step, in
 * development) drops into place is found without restarting the app.
 *
 * `node` is never entered here: it has nothing to stat, so caching a stat
 * result for it would be caching nothing.
 */
const foundCache = new Map<Exclude<BundledTool, 'node'>, string>();

/**
 * Absolute path to the bundled tool, or null when it is not present in this
 * build. Stats the file; never returns a guess.
 *
 * `node` is the one exception, and it is also the one place in this whole
 * module that `./processes.ts`'s `isKnownBundledExecutable` re-resolves
 * through for that tool: rather than statting anything, it hands back
 * `embeddedNodeCommand()` — the exact same value `resolveNode()` below
 * builds its embedded resolution from — so a renderer-supplied command that
 * is byte-for-byte the running Electron binary's own path is recognised as
 * the legitimate "bundled node" and nothing else is.
 */
export function bundledToolPath(tool: BundledTool): string | null {
  if (tool === 'node') return embeddedNodeCommand();

  const cached = foundCache.get(tool);
  if (cached !== undefined) return cached;

  const path = candidatePath(tool);
  try {
    if (statSync(path).isFile()) {
      foundCache.set(tool, path);
      return path;
    }
  } catch {
    /* not present (yet) — deliberately not cached, see foundCache above */
  }
  return null;
}

/**
 * Bundled first, then PATH. Returns `{ path, origin, env? }` or `null` when
 * neither has it.
 *
 * `node` is delegated to `./node-runtime.ts` in full — including the
 * `ELECTRON_RUN_AS_NODE` environment variable a caller must set on the child
 * for the embedded route to behave as Node at all — rather than routed
 * through the generic stat-then-PATH logic below, which has no concept of
 * "extra environment" and nothing to stat for it in the first place.
 */
export async function resolveTool(tool: BundledTool): Promise<BundledToolResolution | null> {
  if (tool === 'node') {
    const node = await resolveNode();
    if (!node) return null;
    return { path: node.command, origin: node.origin === 'embedded' ? 'bundled' : 'path', env: node.env };
  }

  const bundled = bundledToolPath(tool);
  if (bundled) return { path: bundled, origin: 'bundled' };

  const command = PATH_COMMAND[tool];
  if (!command) return null;

  const onPath = await whichCommand(command);
  return onPath ? { path: onPath, origin: 'path' } : null;
}
