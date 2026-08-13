/**
 * Pure helpers for the Worldlens pairing: path arithmetic, version comparison and
 * the parsing of the renderer's own console output.
 *
 * Nothing here touches the DOM or the privileged bridge, so every rule below can
 * be reasoned about — and corrected — without a running application. The numbers
 * and shapes it encodes were read out of the Worldlens repository rather than
 * guessed: see `docs/features/worldlens.md` for exactly which file each one came
 * from.
 */

/** The Squirrel NuGet package id Worldlens publishes under. */
export const WORLDLENS_PACKAGE_ID = 'Worldlens';

/** The product name electron-builder gives the packaged executable. */
export const WORLDLENS_EXECUTABLE = 'Worldlens.exe';

/** Where a person downloads Worldlens. Opened in the browser, never fetched. */
export const WORLDLENS_RELEASES_URL =
  'https://github.com/Ding-Ding-Projects/worldlens/releases/latest';

/** The project's documentation site, for the same honest install route. */
export const WORLDLENS_SITE_URL = 'https://ding-ding-projects.github.io/worldlens/';

/**
 * The world versions Worldlens states it reads: Minecraft 1.12.2 through 26.x.
 *
 * Held as comparable segment tuples so a world's own `Version.Name` can be
 * checked against them rather than string-matched.
 */
export const OLDEST_SUPPORTED_WORLD: readonly number[] = [1, 12, 2];
/** Exclusive upper bound: 26.x is supported, 27.0 is not claimed. */
export const NEWEST_UNSUPPORTED_WORLD: readonly number[] = [27, 0, 0];

/** The directory separator a given absolute path is written with. */
export function separatorOf(path: string): '\\' | '/' {
  return path.includes('\\') && !path.startsWith('/') ? '\\' : '/';
}

/** Joins path segments using the separator the base path already uses. */
export function joinPath(base: string, ...segments: string[]): string {
  const sep = separatorOf(base);
  let out = base.replace(/[\\/]+$/, '');
  for (const segment of segments) {
    const clean = String(segment).replace(/^[\\/]+/, '').replace(/[\\/]+$/, '');
    if (clean === '') continue;
    out += sep + clean;
  }
  return out;
}

/** The last path segment, with any trailing separator ignored. */
export function baseName(path: string): string {
  const trimmed = path.replace(/[\\/]+$/, '');
  const index = Math.max(trimmed.lastIndexOf('\\'), trimmed.lastIndexOf('/'));
  return index === -1 ? trimmed : trimmed.slice(index + 1);
}

/** Everything before the last separator. Empty when there is no parent. */
export function parentDirectory(path: string): string {
  const trimmed = path.replace(/[\\/]+$/, '');
  const index = Math.max(trimmed.lastIndexOf('\\'), trimmed.lastIndexOf('/'));
  return index <= 0 ? '' : trimmed.slice(0, index);
}

/**
 * A path written for a configuration file.
 *
 * HOCON treats a backslash inside a quoted string as an escape character, so a
 * Windows path pasted verbatim into a config file is silently mangled. Both the
 * Java renderer and the Node one accept forward slashes on Windows, so the
 * honest fix is to write the separator that needs no escaping rather than to
 * double every backslash and hope the reader agrees about the rule.
 */
export function toConfigPath(path: string): string {
  return path.replace(/\\/g, '/');
}

/**
 * Derives the machine's local application-data directory from the roaming one.
 *
 * Electron gives this application `<appData>/world-downloader-studio` as its own
 * data directory, and on Windows `<appData>` is the *roaming* profile. Squirrel
 * installs every package into the *local* profile instead, so the sibling
 * directory is where an installed Worldlens actually lives. Returns null when
 * the path does not have the shape this rule assumes, so a wrong guess never
 * becomes a claim.
 */
export function localAppDataFrom(userDataDir: string): string | null {
  const match = /^(.*[\\/]AppData)[\\/]Roaming(?:[\\/].*)?$/i.exec(userDataDir);
  if (!match || !match[1]) return null;
  return joinPath(match[1], 'Local');
}

/** Splits a version string into comparable numeric segments. */
export function versionSegments(version: string): number[] | null {
  const cleaned = version.trim().replace(/^v/i, '');
  if (!/^\d+(\.\d+)*/.test(cleaned)) return null;
  const head = /^\d+(\.\d+)*/.exec(cleaned);
  if (!head) return null;
  return head[0].split('.').map((part) => Number.parseInt(part, 10));
}

/** Compares two numeric segment lists. Missing segments count as zero. */
export function compareSegments(a: readonly number[], b: readonly number[]): number {
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const left = a[index] ?? 0;
    const right = b[index] ?? 0;
    if (left !== right) return left < right ? -1 : 1;
  }
  return 0;
}

/** Compares two version strings. Unparseable versions sort last. */
export function compareVersions(a: string, b: string): number {
  const left = versionSegments(a);
  const right = versionSegments(b);
  if (!left && !right) return a.localeCompare(b);
  if (!left) return 1;
  if (!right) return -1;
  return compareSegments(left, right);
}

/**
 * Picks the newest `app-<version>` directory out of a Squirrel package root.
 *
 * Squirrel keeps the previous version beside the current one after an update,
 * so the directory listing genuinely has more than one entry and taking the
 * first would launch whichever the file system happened to name first.
 */
export function newestSquirrelVersion(directoryNames: readonly string[]): string | null {
  const versions: string[] = [];
  for (const name of directoryNames) {
    const match = /^app-(\d[\w.+-]*)$/i.exec(name);
    if (match && match[1]) versions.push(match[1]);
  }
  if (versions.length === 0) return null;
  versions.sort((a, b) => compareVersions(b, a));
  return versions[0] ?? null;
}

/** How a chosen renderer path will be started. */
export type CliKind = 'node' | 'jar' | 'unknown';

/**
 * Decides how to run a chosen headless renderer.
 *
 * Worldlens ships the renderer two ways and both are real: `@worldlens/cli`
 * builds to a Node entry point (`dist/index.js`, bin name `bluemap-cli`), and
 * every release also attaches `bluemap-<version>-cli.jar`, the upstream Java
 * command-line renderer, whose documented invocation is
 * `java -jar <file> -c <config-dir> -r -g`. The two accept the same flags, so
 * only the launcher differs.
 */
export function classifyCliTarget(path: string): CliKind {
  const lower = path.trim().toLowerCase();
  if (lower === '') return 'unknown';
  if (lower.endsWith('.jar')) return 'jar';
  if (lower.endsWith('.js') || lower.endsWith('.mjs') || lower.endsWith('.cjs')) return 'node';
  return 'unknown';
}

/** The command and leading arguments for a chosen renderer path. */
export function launcherFor(path: string, kind: CliKind): { command: string; leading: string[] } | null {
  if (kind === 'node') return { command: 'node', leading: [path] };
  if (kind === 'jar') return { command: 'java', leading: ['-jar', path] };
  return null;
}

/* ------------------------------------------------------------------ */
/* Console output                                                      */
/* ------------------------------------------------------------------ */

export interface ProgressLine {
  /** The renderer's own description of the task it is on. */
  description: string;
  /** 0..1. */
  fraction: number;
  /** The renderer's own estimate, already formatted, or null when it gave none. */
  eta: string | null;
}

/**
 * Reads one progress line.
 *
 * The Node renderer logs `<task description>: <percent>%[ (ETA: …)]` behind an
 * ISO timestamp and a level, and the Java one logs the same shape behind its own
 * prefix. Matching the percentage and the text before it — rather than the whole
 * line — is what makes one parser serve both, and is why a renderer that changes
 * its prefix does not silently stop reporting progress.
 */
export function parseProgressLine(line: string): ProgressLine | null {
  const match = /([^\]:]+):\s*(\d+(?:\.\d+)?)%(?:\s*\(ETA:\s*([^)]+)\))?/.exec(line);
  if (!match || !match[1] || !match[2]) return null;
  const percent = Number.parseFloat(match[2]);
  if (!Number.isFinite(percent)) return null;
  return {
    description: match[1].trim(),
    fraction: Math.min(1, Math.max(0, percent / 100)),
    eta: match[3] ? match[3].trim() : null
  };
}

/** Reads the line the webserver prints once it is actually listening. */
export function parseListening(line: string): { host: string; port: number } | null {
  const match = /listening on\s+([0-9a-zA-Z.:_-]+):(\d{1,5})\b/i.exec(line);
  if (!match || !match[1] || !match[2]) return null;
  const port = Number.parseInt(match[2], 10);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) return null;
  return { host: match[1], port };
}

/** True for the line the renderer prints when every map is up to date. */
export function isRenderComplete(line: string): boolean {
  return /maps are now all up-to-date/i.test(line);
}

/** True for a line the renderer itself marked as an error. */
export function isErrorLine(line: string): boolean {
  return /\[ERROR\]|\bERROR\b/.test(line);
}

/**
 * Strips the log prefix so a message can be shown without its timestamp.
 * Leaves anything that does not carry a recognised prefix exactly as it was.
 */
export function stripLogPrefix(line: string): string {
  return line.replace(/^\[[^\]]*\]\s*\[[A-Z]+\]\s*/, '').trim();
}

/* ------------------------------------------------------------------ */
/* World version support                                               */
/* ------------------------------------------------------------------ */

export type WorldSupport =
  | { kind: 'supported'; version: string }
  | { kind: 'too-old'; version: string }
  | { kind: 'too-new'; version: string }
  | { kind: 'unknown'; reason: string };

/**
 * Decides whether Worldlens claims to read a world of this version.
 *
 * A version it cannot parse — a snapshot name such as `23w13a`, or a modified
 * launcher's own string — is reported as unknown rather than assumed readable,
 * because "we could not tell" and "it will work" are different answers and only
 * one of them is true.
 */
export function classifyWorldVersion(versionName: string | null): WorldSupport {
  if (!versionName || versionName.trim() === '') {
    return { kind: 'unknown', reason: 'The world does not record a Minecraft version.' };
  }
  const segments = versionSegments(versionName);
  if (!segments) {
    return {
      kind: 'unknown',
      reason: `"${versionName}" is not a numbered release, so it cannot be compared with the supported range.`
    };
  }
  if (compareSegments(segments, OLDEST_SUPPORTED_WORLD) < 0) {
    return { kind: 'too-old', version: versionName };
  }
  if (compareSegments(segments, NEWEST_UNSUPPORTED_WORLD) >= 0) {
    return { kind: 'too-new', version: versionName };
  }
  return { kind: 'supported', version: versionName };
}

/** The supported range as a sentence, used in copy and in the docs article. */
export function supportedRangeText(): string {
  return 'Minecraft 1.12.2 through 26.x';
}
