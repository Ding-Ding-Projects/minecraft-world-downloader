/**
 * Writing the configuration folder a BlueMap-compatible renderer reads, and
 * detecting which dimensions an exported world snapshot actually has.
 *
 * The renderer's own bootstrap (documented in `bluemap/README.md` and
 * exercised by `bluemap/pipeline.py`) generates a default file for anything
 * missing from the config folder and leaves anything already there alone, so
 * the job here — exactly as `../worldlens/config.ts` establishes for the
 * companion renderer — is to write only the handful of files whose contents
 * this application must control, and let the tool generate the rest.
 *
 * Three of those contents are deliberate, not cosmetic:
 *
 * - `ip` is pinned to `127.0.0.1`. The tool's own default is `0.0.0.0`, which
 *   would publish a render of somebody's private world to every interface on
 *   the machine; this application never does that.
 * - `metrics` is off. This application makes no network request the user did
 *   not ask for.
 * - `accept-download` follows the `worldvaultrenders.acceptDownload` setting,
 *   off by default. It is consent to fetch Minecraft's own client files for
 *   block textures; off means a render either uses what is already cached, or
 *   fails saying exactly that — the honest outcome, never a silent fetch.
 *
 * Paths are written with forward slashes: HOCON treats a backslash inside a
 * quoted string as an escape, so a Windows path pasted in verbatim is quietly
 * mangled, and both known renderers accept `/` on Windows regardless.
 */

import type { Result, StudioApi } from '../../../shared/api';
import { DIMENSION_REGION_PATHS } from '../../../shared/anvil';

function joinPath(base: string, ...segments: string[]): string {
  const sep = base.includes('\\') && !base.startsWith('/') ? '\\' : '/';
  let out = base.replace(/[\\/]+$/, '');
  for (const segment of segments) {
    const clean = segment.replace(/^[\\/]+/, '').replace(/[\\/]+$/, '');
    if (clean !== '') out += sep + clean;
  }
  return out;
}

function toConfigPath(path: string): string {
  return path.replace(/\\/g, '/');
}

function quote(value: string): string {
  return `"${toConfigPath(value).replace(/"/g, '\\"')}"`;
}

/**
 * Which of the three dimensions an exported world snapshot actually has, by
 * looking for `.mca` files under each dimension's region folder — the same
 * check `bluemap/pipeline.py`'s `dimension_exists` makes.
 */
export async function detectDimensions(studio: StudioApi, worldDirectory: string): Promise<string[]> {
  const found: string[] = [];
  for (const { dimension, segments } of DIMENSION_REGION_PATHS) {
    const listing = await studio.fs.readDirectory(joinPath(worldDirectory, ...segments));
    if (listing.ok && listing.value.some((entry) => !entry.isDirectory && entry.name.endsWith('.mca'))) {
      found.push(dimension);
    }
  }
  return found;
}

export interface RenderPlan {
  /** The exported, immutable snapshot for one commit — never the live world. */
  exportDirectory: string;
  /** Where `-g` writes the web application: `<outputDirectory>/web`. */
  outputDirectory: string;
  dimensions: string[];
  worldLabel: string;
  threads: number;
  acceptDownload: boolean;
}

const HEADER = [
  '# Written by World Downloader Studio for one commit render.',
  '# Safe to edit for a one-off experiment: this file is rewritten every time',
  '# this exact commit is queued for a render, and every value below is one',
  '# this application set deliberately rather than a default it inherited.',
  ''
];

function coreConf(plan: RenderPlan): string {
  return [
    ...HEADER,
    '# Consent to download Minecraft’s own client files, which supply block textures.',
    '# Off by default: this application makes no network request the user did not ask for.',
    `accept-download: ${plan.acceptDownload ? 'true' : 'false'}`,
    '',
    'data: "data"',
    `render-thread-count: ${String(plan.threads)}`,
    'render-thread-priority: 5',
    '',
    '# Off deliberately: nothing about a private world is reported anywhere.',
    'metrics: false',
    ''
  ].join('\n');
}

function webserverConf(port: number): string {
  return [
    ...HEADER,
    'enabled: true',
    'webroot: "web"',
    '',
    '# Loopback only. The renderer’s own default is 0.0.0.0, which would publish',
    '# this render to every interface on the machine. It never does so here.',
    'ip: "127.0.0.1"',
    `port: ${String(port)}`,
    ''
  ].join('\n');
}

/** Rewrites just the port line, for the on-demand "view this render" serve step. */
export async function writeServePort(
  studio: StudioApi,
  configDirectory: string,
  port: number
): Promise<Result<void>> {
  return studio.fs.writeText(joinPath(configDirectory, 'webserver.conf'), webserverConf(port));
}

/** A pseudo-random loopback port in a high, rarely-used range, for an on-demand serve. */
export function pickServePort(): number {
  return 20_000 + Math.floor(Math.random() * 20_000);
}

function webappConf(): string {
  return [...HEADER, 'webroot: "web"', ''].join('\n');
}

function mapConf(plan: RenderPlan, dimension: string, sorting: number): string {
  return [
    ...HEADER,
    `world: ${quote(plan.exportDirectory)}`,
    `name: ${quote(`${plan.worldLabel} — ${dimension}`)}`,
    `dimension: ${quote(dimension)}`,
    `dimension-type: ${quote(dimension)}`,
    `sorting: ${String(sorting)}`,
    ''
  ].join('\n');
}

export interface WrittenRenderConfig {
  configDirectory: string;
  webroot: string;
  mapIds: string[];
}

function fail(result: Result<unknown>, what: string): string | null {
  return result.ok ? null : `${what}: ${result.error}`;
}

/** Writes the configuration folder for one render. Nothing is written outside `plan.outputDirectory`. */
export async function writeRenderConfig(
  studio: StudioApi,
  plan: RenderPlan
): Promise<{ ok: true; value: WrittenRenderConfig } | { ok: false; error: string }> {
  if (plan.dimensions.length === 0) {
    return {
      ok: false,
      error:
        'The exported snapshot has no region files in any dimension, so there is nothing to render. The world may still be downloading its first chunks.'
    };
  }

  const configDirectory = joinPath(plan.outputDirectory, 'config');
  const mapsDirectory = joinPath(configDirectory, 'maps');

  for (const directory of [plan.outputDirectory, configDirectory, mapsDirectory]) {
    const ensured = await studio.fs.ensureDirectory(directory);
    const problem = fail(ensured, `The folder "${directory}" could not be created`);
    if (problem) return { ok: false, error: problem };
  }

  const writes: Array<{ path: string; contents: string }> = [
    { path: joinPath(configDirectory, 'core.conf'), contents: coreConf(plan) },
    { path: joinPath(configDirectory, 'webserver.conf'), contents: webserverConf(pickServePort()) },
    { path: joinPath(configDirectory, 'webapp.conf'), contents: webappConf() }
  ];

  const mapIds: string[] = [];
  plan.dimensions.forEach((dimension, index) => {
    const id = dimension.replace(/\W/g, '_');
    mapIds.push(id);
    writes.push({ path: joinPath(mapsDirectory, `${id}.conf`), contents: mapConf(plan, dimension, index) });
  });

  for (const write of writes) {
    const written = await studio.fs.writeText(write.path, write.contents);
    const problem = fail(written, `The file "${write.path}" could not be written`);
    if (problem) return { ok: false, error: problem };
  }

  return { ok: true, value: { configDirectory, webroot: joinPath(plan.outputDirectory, 'web'), mapIds } };
}

/** Render-phase arguments: `-c <configDir> -r -g` per `bluemap/pipeline.py`'s `render()`. */
export function renderArguments(configDirectory: string, firstRenderEver: boolean): string[] {
  const args = ['-c', configDirectory, '-r', '-g'];
  if (firstRenderEver) args.push('-f', '-e');
  return args;
}

/** Serve-phase arguments: `-c <configDir> -w` per `bluemap/pipeline.py`'s `serve()`. */
export function serveArguments(configDirectory: string): string[] {
  return ['-c', configDirectory, '-w'];
}
