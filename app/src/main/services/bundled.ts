import { statSync } from 'node:fs';
import { join } from 'node:path';
import type { BundledTool, BundledToolResolution } from '../../shared/api';
import { resourcesRoot } from '../paths';
import { whichCommand } from './editor';

/**
 * Bundled-dependency resolution.
 *
 * The whole point of this module: a dependency the application itself needs
 * (the Java engine, and optionally a trimmed Java runtime, Git and the
 * GitHub CLI) is looked for INSIDE the application first. Only when it is
 * genuinely not there does anything fall back to PATH, and nothing here ever
 * hands back a browser link — that is the defect this module exists to
 * remove. Acquiring a dependency that is missing altogether is a BUILD-time
 * concern (electron-builder.yml's `extraResources`, and the scripts that
 * populate `runtime/` before packaging); this module only ever reports what
 * is already on disk.
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
 */
const TOOL_SPECS: Record<BundledTool, ToolSpec> = {
  engineJar: { dir: ['engine'], file: 'world-downloader.jar', executable: false },
  java: { dir: ['runtime', 'jre', 'bin'], file: 'java', executable: true },
  git: { dir: ['runtime', 'git', 'cmd'], file: 'git', executable: true },
  gh: { dir: ['runtime', 'gh', 'bin'], file: 'gh', executable: true }
};

/**
 * The command each tool would be found under on PATH. `engineJar` has none:
 * a jar is not something a shell resolves by name, so a missing bundled jar
 * simply has no PATH fallback to try.
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

function candidatePath(tool: BundledTool): string {
  const spec = TOOL_SPECS[tool];
  return join(resourcesRoot(), ...spec.dir, fileName(spec));
}

/**
 * Positive lookups only — a tool once found stays found for the life of the
 * process, since the resources directory of a running build does not change
 * underneath it. A miss is never cached: a fresh `bundledToolPath` call
 * always re-stats, so a tool that a user (or a later build step, in
 * development) drops into place is found without restarting the app.
 */
const foundCache = new Map<BundledTool, string>();

/**
 * Absolute path to the bundled tool, or null when it is not present in this
 * build. Stats the file; never returns a guess.
 */
export function bundledToolPath(tool: BundledTool): string | null {
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
 * Bundled first, then PATH. Returns `{ path, origin: 'bundled' | 'path' }`
 * or `null` when neither has it.
 */
export async function resolveTool(tool: BundledTool): Promise<BundledToolResolution | null> {
  const bundled = bundledToolPath(tool);
  if (bundled) return { path: bundled, origin: 'bundled' };

  const command = PATH_COMMAND[tool];
  if (!command) return null;

  const onPath = await whichCommand(command);
  return onPath ? { path: onPath, origin: 'path' } : null;
}
