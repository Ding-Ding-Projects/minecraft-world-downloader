/**
 * Writing the configuration folder the headless renderer reads.
 *
 * The renderer is configured by files, not by flags: its command line selects
 * *what to do* (`-r` render, `-w` serve, `-g` generate the web application) and
 * a configuration folder says *to what*. Its own bootstrap writes a default for
 * any file that is missing and leaves any file that already exists alone, so the
 * job here is to write exactly the four files whose contents matter and let it
 * generate the rest.
 *
 * Three of those contents are not cosmetic:
 *
 * - **`ip` is pinned to `127.0.0.1`.** The renderer's own default is `0.0.0.0`,
 *   which publishes somebody's private world to every interface on the machine.
 *   This application never wants that, so the address is written explicitly and
 *   the surface says out loud that the map is local-only.
 * - **`metrics` is turned off.** It defaults to on and this application makes no
 *   network request the user did not ask for.
 * - **`accept-download` follows an explicit setting that is off by default.**
 *   It is the consent to fetch Minecraft's own client files, which the renderer
 *   needs for block textures. Off means a render either uses what is already on
 *   disk or fails saying so — which is the honest outcome, and better than a
 *   silent download.
 *
 * Paths are written with forward slashes. HOCON reads a backslash inside a
 * quoted string as an escape character, so a Windows path pasted in verbatim is
 * quietly mangled; both the Java renderer and the Node one accept `/` on
 * Windows, so writing the separator that needs no escaping is the fix that
 * cannot be got subtly wrong.
 */

import type { Result, StudioApi } from '../../../shared/api';
import { joinPath, toConfigPath } from './probe';
import type { DimensionId, DiscoveredWorld } from './worlds';
import { DIMENSIONS } from './worlds';

export interface RenderPlan {
  /** The world being rendered. */
  world: DiscoveredWorld;
  /** Which of its dimensions to render, in the order they will be written. */
  dimensions: DimensionId[];
  /** The directory the renderer runs in. `config/`, `web/` and `data/` live here. */
  outputDirectory: string;
  /** Loopback port for the web server. */
  port: number;
  /** Render worker threads. */
  threads: number;
  /** Whether the renderer may download Minecraft's client files for textures. */
  acceptDownload: boolean;
  /** Keep watching the world after the first render and update the map. */
  watch: boolean;
  /** Re-render every chunk instead of only the ones that changed. */
  force: boolean;
}

export interface WrittenConfig {
  /** Absolute path of the configuration folder that was written. */
  configDirectory: string;
  /** Absolute path of the generated web application. */
  webroot: string;
  /** Absolute path of the tile storage root. */
  mapsRoot: string;
  /** Map ids written, in order. These are what the server mounts. */
  mapIds: string[];
  /** Every file this writer created or replaced. */
  files: string[];
}

/** Quotes a value for a HOCON file. */
function quote(value: string): string {
  return `"${value.replace(/\\/g, '/').replace(/"/g, '\\"')}"`;
}

/** Turns a dimension id into the file name and map id used for it. */
export function mapIdFor(dimension: DimensionId): string {
  return dimension.replace(/^minecraft:/, '').replace(/\W/g, '_');
}

function dimensionMeta(dimension: DimensionId): { label: string; sorting: number } {
  const found = DIMENSIONS.find((entry) => entry.id === dimension);
  return found ? { label: found.label, sorting: found.sorting } : { label: dimension, sorting: 0 };
}

const HEADER = [
  '# Written by World Downloader Studio for a single local render.',
  '# It is safe to edit: this file is only rewritten when a render is started',
  '# from the Worldlens tab, and every value below is one this application set',
  '# deliberately rather than a default it inherited.',
  ''
];

export function coreConf(plan: RenderPlan): string {
  return [
    ...HEADER,
    '# Consent to download Minecraft’s own client files, which supply block textures.',
    '# Off by default here: this application makes no network request the user did not ask for.',
    `accept-download: ${plan.acceptDownload ? 'true' : 'false'}`,
    '',
    '# Working data, relative to the directory the renderer runs in.',
    'data: "data"',
    '',
    `render-thread-count: ${String(plan.threads)}`,
    'render-thread-priority: 5',
    '',
    '# Off deliberately: nothing about a private world is reported anywhere.',
    'metrics: false',
    ''
  ].join('\n');
}

export function webserverConf(plan: RenderPlan): string {
  return [
    ...HEADER,
    'enabled: true',
    'webroot: "web"',
    '',
    '# Loopback only. The renderer’s own default is 0.0.0.0, which would publish',
    '# this world to every interface on the machine. It never does so from here.',
    'ip: "127.0.0.1"',
    `port: ${String(plan.port)}`,
    '',
    'sse-enabled: true',
    ''
  ].join('\n');
}

export function webappConf(): string {
  return [...HEADER, 'webroot: "web"', ''].join('\n');
}

export function mapConf(plan: RenderPlan, dimension: DimensionId): string {
  const meta = dimensionMeta(dimension);
  const name =
    plan.dimensions.length > 1 ? `${plan.world.displayName} — ${meta.label}` : plan.world.displayName;
  return [
    ...HEADER,
    `world: ${quote(toConfigPath(plan.world.path))}`,
    `name: ${quote(name)}`,
    `dimension: ${quote(dimension)}`,
    `dimension-type: ${quote(dimension)}`,
    `sorting: ${String(meta.sorting)}`,
    ''
  ].join('\n');
}

function fail<T>(result: Result<T>, what: string): string | null {
  return result.ok ? null : `${what}: ${result.error}`;
}

/**
 * Writes the configuration folder for one render.
 *
 * Returns the paths a caller needs afterwards, or an error naming the exact file
 * that could not be written. Nothing is written outside the chosen output
 * directory.
 */
export async function writeRenderConfig(
  studio: StudioApi,
  plan: RenderPlan
): Promise<{ ok: true; value: WrittenConfig } | { ok: false; error: string }> {
  if (plan.dimensions.length === 0) {
    return { ok: false, error: 'No dimension was selected, so there is nothing to render.' };
  }

  const outputDirectory = plan.outputDirectory.trim();
  if (outputDirectory === '') {
    return { ok: false, error: 'No output directory is set, so there is nowhere to write the render.' };
  }

  const configDirectory = joinPath(outputDirectory, 'config');
  const mapsDirectory = joinPath(configDirectory, 'maps');
  const files: string[] = [];

  for (const directory of [outputDirectory, configDirectory, mapsDirectory]) {
    const ensured = await studio.fs.ensureDirectory(directory);
    const problem = fail(ensured, `The folder ${directory} could not be created`);
    if (problem) return { ok: false, error: problem };
  }

  const writes: Array<{ path: string; contents: string }> = [
    { path: joinPath(configDirectory, 'core.conf'), contents: coreConf(plan) },
    { path: joinPath(configDirectory, 'webserver.conf'), contents: webserverConf(plan) },
    { path: joinPath(configDirectory, 'webapp.conf'), contents: webappConf() }
  ];

  const mapIds: string[] = [];
  for (const dimension of plan.dimensions) {
    const id = mapIdFor(dimension);
    mapIds.push(id);
    writes.push({ path: joinPath(mapsDirectory, `${id}.conf`), contents: mapConf(plan, dimension) });
  }

  for (const write of writes) {
    const written = await studio.fs.writeText(write.path, write.contents);
    const problem = fail(written, `The file ${write.path} could not be written`);
    if (problem) return { ok: false, error: problem };
    files.push(write.path);
  }

  return {
    ok: true,
    value: {
      configDirectory,
      webroot: joinPath(outputDirectory, 'web'),
      mapsRoot: joinPath(outputDirectory, 'web', 'maps'),
      mapIds,
      files
    }
  };
}

/** The argument list for one render, in the order the renderer documents. */
export function renderArguments(configDirectory: string, plan: RenderPlan): string[] {
  const args = ['-c', configDirectory, '-r', '-g', '-s', '-w'];
  if (plan.force) args.push('-f');
  if (plan.watch) args.push('-u');
  return args;
}
