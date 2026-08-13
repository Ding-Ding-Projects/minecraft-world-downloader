/**
 * Translating a saved profile into the exact JSON the bundled scraper reads,
 * validating every field in plain words, and the blank-slate presets.
 *
 * The scraper's own `loadConfig` merges a set of built-in defaults with the
 * file it is given, so the file written here contains every key it recognises
 * and nothing it does not. A key the scraper would ignore is never emitted,
 * because a configuration file that silently does nothing is worse than one
 * that is missing.
 */

import type { AreaMode, BotProfile } from './state';
import { blankProfile } from './state';

/* ================================================================== */
/* The generated configuration                                         */
/* ================================================================== */

export interface ScraperAccount {
  auth: 'offline' | 'microsoft';
  username: string;
}

export interface ScraperConfig {
  host: string;
  port: number;
  version: string | false;
  accounts: ScraperAccount[];
  center: { x: number; z: number };
  radius: number;
  bbox: { minX: number; minZ: number; maxX: number; maxZ: number } | null;
  centerOnSpawn: boolean;
  chunkStep: number;
  flyWhenAble: boolean;
  preferFly: boolean;
  walkWhenGrounded: boolean;
  flyAltitude: number;
  arriveRadius: number;
  waypointTimeoutMs: number;
  loadWaitMs: number;
  visitedFile: string;
  revisit: boolean;
  containerDwellMs: number;
  finalDrainMs: number;
  loginPassword: string;
  autoLogin: boolean;
  stuckCheckMs: number;
  stuckEpsilon: number;
  loginStaggerMs: number;
}

/**
 * Builds the configuration the scraper will actually read.
 *
 * `password` is supplied by the caller straight from the credential vault and
 * is written into the generated file because the scraper has no other way to
 * receive it. It is never returned anywhere else, never recorded in history and
 * never rendered; the file itself lives in the application's own data directory
 * and is deleted when the run ends.
 */
export function toScraperConfig(
  profile: BotProfile,
  password: string,
  visitedFilePath: string
): ScraperConfig {
  const usernames = profile.usernames.filter((name) => name.trim().length > 0);
  return {
    host: profile.host.trim(),
    port: Math.trunc(profile.port),
    version: profile.version.trim().length > 0 ? profile.version.trim() : false,
    accounts: usernames.map((username) => ({ auth: profile.auth, username })),
    center: { x: Math.trunc(profile.center.x), z: Math.trunc(profile.center.z) },
    radius: Math.trunc(profile.radius),
    bbox:
      profile.areaMode === 'bbox'
        ? {
            minX: Math.trunc(profile.bbox.minX),
            minZ: Math.trunc(profile.bbox.minZ),
            maxX: Math.trunc(profile.bbox.maxX),
            maxZ: Math.trunc(profile.bbox.maxZ)
          }
        : null,
    centerOnSpawn: profile.areaMode === 'spawn',
    chunkStep: Math.max(1, Math.trunc(profile.chunkStep)),
    flyWhenAble: profile.flyWhenAble,
    preferFly: profile.preferFly,
    walkWhenGrounded: profile.walkWhenGrounded,
    flyAltitude: Math.trunc(profile.flyAltitude),
    arriveRadius: Math.trunc(profile.arriveRadius),
    waypointTimeoutMs: Math.trunc(profile.waypointTimeoutMs),
    loadWaitMs: Math.trunc(profile.loadWaitMs),
    visitedFile: visitedFilePath,
    revisit: profile.revisit,
    containerDwellMs: Math.trunc(profile.containerDwellMs),
    finalDrainMs: Math.trunc(profile.finalDrainMs),
    loginPassword: password,
    autoLogin: profile.autoLogin,
    stuckCheckMs: Math.trunc(profile.stuckCheckMs),
    stuckEpsilon: profile.stuckEpsilon,
    loginStaggerMs: Math.trunc(profile.loginStaggerMs)
  };
}

/**
 * The same configuration with the password replaced by a marker, for anything
 * a person can see or export: the preview panel, the exported profile, the
 * history payload.
 */
export function redactedConfig(config: ScraperConfig): ScraperConfig {
  return {
    ...config,
    loginPassword: config.loginPassword.length > 0 ? '<held in the credential vault>' : ''
  };
}

/* ================================================================== */
/* How much work a profile describes                                   */
/* ================================================================== */

export interface AreaEstimate {
  /** Chunks the grid will visit, honouring `chunkStep`. */
  chunks: number;
  /** Blocks along each axis. */
  spanX: number;
  spanZ: number;
  /** Null when the area is decided at spawn time and cannot be known yet. */
  known: boolean;
}

export function estimateArea(profile: BotProfile): AreaEstimate {
  const step = Math.max(1, Math.trunc(profile.chunkStep));
  if (profile.areaMode === 'bbox') {
    const spanX = Math.abs(profile.bbox.maxX - profile.bbox.minX);
    const spanZ = Math.abs(profile.bbox.maxZ - profile.bbox.minZ);
    const chunksX = Math.floor(spanX / 16 / step) + 1;
    const chunksZ = Math.floor(spanZ / 16 / step) + 1;
    return { chunks: chunksX * chunksZ, spanX, spanZ, known: true };
  }
  const span = Math.abs(Math.trunc(profile.radius)) * 2;
  const perAxis = Math.floor(span / 16 / step) + 1;
  return { chunks: perAxis * perAxis, spanX: span, spanZ: span, known: profile.areaMode === 'center' };
}

/* ================================================================== */
/* Validation                                                          */
/* ================================================================== */

export interface FieldProblem {
  field: string;
  message: string;
}

const HOSTNAME = /^[A-Za-z0-9._-]+$/;

/**
 * Every problem with a profile, in plain words that say what to do next.
 *
 * A profile can be saved while it still has problems — half-finished work is
 * not lost — but a run refuses to start until the list is empty, and the run
 * button names the first unmet condition rather than sitting there disabled
 * with no explanation.
 */
export function validateProfile(profile: BotProfile): FieldProblem[] {
  const problems: FieldProblem[] = [];

  if (profile.name.trim().length === 0) {
    problems.push({ field: 'name', message: 'Give the profile a name so you can tell it from the others.' });
  }

  const host = profile.host.trim();
  if (host.length === 0) {
    problems.push({ field: 'host', message: 'Enter the address of the running downloader proxy, for example 127.0.0.1.' });
  } else if (!HOSTNAME.test(host)) {
    problems.push({
      field: 'host',
      message: 'The address may only contain letters, digits, dots, dashes and underscores. Remove anything else.'
    });
  }

  if (!Number.isInteger(profile.port) || profile.port < 1 || profile.port > 65535) {
    problems.push({ field: 'port', message: 'The port must be a whole number between 1 and 65535.' });
  }

  const usernames = profile.usernames.map((name) => name.trim()).filter((name) => name.length > 0);
  if (usernames.length === 0) {
    problems.push({ field: 'usernames', message: 'Add at least one account. Each account is one bot.' });
  }
  if (new Set(usernames).size !== usernames.length) {
    problems.push({ field: 'usernames', message: 'Two accounts have the same name. Each bot needs its own.' });
  }
  if (profile.auth === 'offline') {
    for (const name of usernames) {
      if (!/^[A-Za-z0-9_]{3,16}$/.test(name)) {
        problems.push({
          field: 'usernames',
          message: `"${name}" is not a usable offline name. Use 3 to 16 letters, digits or underscores.`
        });
        break;
      }
    }
  } else {
    for (const name of usernames) {
      if (!name.includes('@')) {
        problems.push({
          field: 'usernames',
          message: `"${name}" does not look like a Microsoft sign-in address. Microsoft accounts sign in by email.`
        });
        break;
      }
    }
  }

  if (profile.areaMode === 'bbox') {
    if (profile.bbox.maxX <= profile.bbox.minX) {
      problems.push({ field: 'bbox', message: 'The maximum X must be larger than the minimum X.' });
    }
    if (profile.bbox.maxZ <= profile.bbox.minZ) {
      problems.push({ field: 'bbox', message: 'The maximum Z must be larger than the minimum Z.' });
    }
  } else if (!Number.isFinite(profile.radius) || profile.radius < 16) {
    problems.push({ field: 'radius', message: 'Use a radius of at least 16 blocks — that is one chunk.' });
  }

  if (!Number.isInteger(profile.chunkStep) || profile.chunkStep < 1) {
    problems.push({ field: 'chunkStep', message: 'The chunk step must be a whole number of 1 or more. 1 visits every chunk.' });
  }

  if (!profile.flyWhenAble && !profile.walkWhenGrounded) {
    problems.push({
      field: 'movement',
      message: 'Flying and walking are both off, so the bots would idle and capture nothing. Turn at least one on.'
    });
  }

  if (profile.arriveRadius < 1) {
    problems.push({ field: 'arriveRadius', message: 'The arrival distance must be at least 1 block.' });
  }
  if (profile.waypointTimeoutMs < 1000) {
    problems.push({ field: 'waypointTimeoutMs', message: 'Give each waypoint at least 1000 ms before giving up on it.' });
  }
  if (profile.loadWaitMs < 0) {
    problems.push({ field: 'loadWaitMs', message: 'The dwell time cannot be negative.' });
  }
  if (profile.stuckEpsilon <= 0) {
    problems.push({ field: 'stuckEpsilon', message: 'The anti-stuck movement threshold must be more than 0 blocks.' });
  }
  if (profile.stuckCheckMs < 1000) {
    problems.push({ field: 'stuckCheckMs', message: 'Check for a stuck bot no more often than once a second.' });
  }
  if (profile.autoLogin && profile.loginPasswordAccount.length === 0) {
    problems.push({
      field: 'autoLogin',
      message: 'Automatic login is on but no password is stored. Set one, or turn automatic login off.'
    });
  }

  return problems;
}

/* ================================================================== */
/* Presets                                                             */
/* ================================================================== */

export interface ProfilePreset {
  id: string;
  name: string;
  /** Exactly what this preset sets, field by field, shown before it is applied. */
  sets: Array<{ field: string; value: string }>;
  build(id: string): BotProfile;
}

/**
 * The blank-slate offering.
 *
 * Every preset starts from `blankProfile`, which is the scraper's own compiled-in
 * defaults, and changes only the fields it lists. Nothing here is invented: a
 * preset that claims to set a value sets exactly that value, and the result is
 * an ordinary editable profile with no special status afterwards.
 */
export function presets(): ProfilePreset[] {
  return [
    {
      id: 'bot.preset.defaults',
      name: 'The scraper defaults',
      sets: [
        { field: 'Proxy', value: '127.0.0.1:25565' },
        { field: 'Accounts', value: '1 offline account named Scraper' },
        { field: 'Area', value: 'Centre 0, 0 with a 256 block radius' },
        { field: 'Movement', value: 'Fly in creative and spectator, walk in survival and adventure' },
        { field: 'Timing', value: '600 ms dwell, 6000 ms final drain' }
      ],
      build: (id) => blankProfile(id, 'Scraper defaults')
    },
    {
      id: 'bot.preset.nearby',
      name: 'Walk the area around spawn',
      sets: [
        { field: 'Area', value: 'Each bot covers 192 blocks around its own spawn point' },
        { field: 'Movement', value: 'Walking only — flying is turned off' },
        { field: 'Timing', value: '800 ms dwell so slower servers keep up' }
      ],
      build: (id) => ({
        ...blankProfile(id, 'Around spawn, on foot'),
        areaMode: 'spawn' as AreaMode,
        radius: 192,
        flyWhenAble: false,
        preferFly: false,
        walkWhenGrounded: true,
        loadWaitMs: 800
      })
    },
    {
      id: 'bot.preset.aerial',
      name: 'Fly a large area',
      sets: [
        { field: 'Area', value: 'Centre 0, 0 with a 1500 block radius' },
        { field: 'Movement', value: 'Prefer flying in creative, at altitude 140' },
        { field: 'Accounts', value: '4 offline bots, so the grid is split four ways' },
        { field: 'Timing', value: '400 ms dwell, staggered starts 6000 ms apart' }
      ],
      build: (id) => ({
        ...blankProfile(id, 'Large area, flying'),
        radius: 1500,
        flyWhenAble: true,
        preferFly: true,
        flyAltitude: 140,
        loadWaitMs: 400,
        usernames: ['ScraperA', 'ScraperB', 'ScraperC', 'ScraperD'],
        loginStaggerMs: 6000
      })
    },
    {
      id: 'bot.preset.containers',
      name: 'Slow pass for containers',
      sets: [
        { field: 'Area', value: 'Centre 0, 0 with a 384 block radius' },
        { field: 'Timing', value: '600 ms dwell plus 600 ms container dwell, 15000 ms final drain' },
        { field: 'Note', value: 'Pairs with the downloader running with automatic container opening' }
      ],
      build: (id) => ({
        ...blankProfile(id, 'Containers, slow pass'),
        radius: 384,
        containerDwellMs: 600,
        finalDrainMs: 15000,
        notes: 'Run the downloader with automatic container opening for this profile to be worth the extra time.'
      })
    },
    {
      id: 'bot.preset.resume',
      name: 'Resume an interrupted sweep',
      sets: [
        { field: 'Area', value: 'Centre 0, 0 with a 1024 block radius' },
        { field: 'Dedup', value: 'Keeps the visited cache, so chunks already captured are skipped' },
        { field: 'Timing', value: '20000 ms per waypoint, 4000 ms anti-stuck check' }
      ],
      build: (id) => ({
        ...blankProfile(id, 'Resume the sweep'),
        radius: 1024,
        revisit: false,
        waypointTimeoutMs: 20000,
        stuckCheckMs: 4000
      })
    }
  ];
}
