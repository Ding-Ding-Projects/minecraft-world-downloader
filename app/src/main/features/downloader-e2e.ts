/**
 * Pure, Electron-free reference logic for the end-to-end downloader harness.
 *
 * This module owns the hard, silently-wrong-if-broken parts of the harness in
 * TypeScript, so they are checked by `npx tsc --noEmit -p tsconfig.node.json`
 * and `npm run build` alongside the rest of the main process: the Anvil
 * region-file header reader, the deterministic spiral route builder, and the
 * classification of a failed run into one of five distinct causes.
 *
 * It intentionally imports nothing from `electron`, `./ipc` or any other main
 * module. Two things follow from that:
 *
 *  - It compiles and runs as a plain Node module, so it has no dependency on
 *    the application's window, IPC bridge or packaged runtime existing.
 *  - It is **not wired into the application's IPC allow-list**. Doing that
 *    would mean editing `app/src/main/ipc.ts` (to call `registerHandler`) and
 *    `app/src/shared/channels.ts` (to add a new channel name to the
 *    allow-list `registerHandler` checks against) — both outside this
 *    feature's owned paths. The renderer's `downloader-e2e` feature does not
 *    need a new privileged channel to run this harness anyway: the existing
 *    `studio.process.spawn` allow-list already includes `node`, so the
 *    renderer launches the exact same, independently runnable script this
 *    module mirrors — `test-e2e/run.js` — as a child process, and reads its
 *    structured stdout. See `docs/features/downloader-e2e.md` for the full
 *    architecture and the reasoning above in one place.
 *
 * `test-e2e/lib/region.js`, `test-e2e/lib/route.js` and
 * `test-e2e/lib/classify.js` are the plain-JavaScript, no-build-step twins of
 * the three sections below — required by `test-e2e/run.js` and by a person
 * running the harness with nothing but `node`, with no TypeScript compiler in
 * the loop. `test-e2e/test/selftest.js` is what actually exercises that
 * plain-JS logic against real fixtures (see that file's own header comment
 * for why: this file has no test runner wired to it, since the application's
 * `npx vitest run` suite only covers `app/tests/**`, a path this feature does
 * not own). The two implementations are kept in step by hand; this file's own
 * JSDoc points back at its twin so a future change to one is a prompt to
 * check the other, and the algorithms themselves are simple enough (a header
 * table walk, a square spiral, an enum lookup) that the risk of silent drift
 * is low.
 */

/* ================================================================== */
/* Anvil (.mca) region-file header reading                             */
/* ================================================================== */

/**
 * A byte-for-byte port of the READ side of
 * `src/main/java/game/data/region/McaFile.java` — the Java class that
 * actually writes the files this harness verifies. Ported from that class
 * rather than the public Anvil spec, because the Java reader/writer pair is
 * the one authority on what bytes this project's own downloader produces.
 */
export const REGION_SECTOR_SIZE = 4096;
const LOCATION_TABLE_BYTES = REGION_SECTOR_SIZE;

export interface RegionChunkSlot {
  x: number;
  z: number;
  sizeBytes: number;
}

export interface RegionHeaderResult {
  chunks: RegionChunkSlot[];
  /** True when the buffer was nonempty but too small to hold even the two header sectors. */
  truncated: boolean;
}

/**
 * Reads one region file's 8 KiB header and returns the chunks its own
 * location table says are occupied, mirroring
 * `McaFile#readFile`/`McaFile#intToCoordinate` exactly — including the "a lone
 * bare-sector slot is probably not actually generated" guard.
 *
 * Mirror: `test-e2e/lib/region.js#parseRegionHeader`.
 */
export function parseRegionHeader(buffer: Buffer, regionX: number, regionZ: number): RegionHeaderResult {
  if (buffer.length < LOCATION_TABLE_BYTES * 2) {
    return { chunks: [], truncated: buffer.length > 0 };
  }

  const locations = buffer.subarray(0, LOCATION_TABLE_BYTES);
  const chunkAreaLength = buffer.length - LOCATION_TABLE_BYTES * 2;
  const occupied: RegionChunkSlot[] = [];

  for (let i = 0; i + 4 <= LOCATION_TABLE_BYTES; i += 4) {
    const sizeSectors = locations[i + 3] & 0xff;
    if (sizeSectors === 0) continue;

    const sectorOffset = locations.readUIntBE(i, 3);
    const dataStart = (sectorOffset - 2) * REGION_SECTOR_SIZE;
    const dataEnd = (sectorOffset + sizeSectors - 2) * REGION_SECTOR_SIZE;
    if (dataStart < 0 || dataStart >= chunkAreaLength) continue;
    if (dataEnd < 0 || dataEnd > chunkAreaLength || dataEnd < dataStart) continue;

    const offset = i / 4;
    const localX = offset & 0x1f;
    const localZ = offset >>> 5;
    occupied.push({ x: regionX * 32 + localX, z: regionZ * 32 + localZ, sizeBytes: dataEnd - dataStart });
  }

  if (occupied.length === 1 && occupied[0].sizeBytes === REGION_SECTOR_SIZE) {
    return { chunks: [], truncated: false };
  }
  return { chunks: occupied, truncated: false };
}

const REGION_FILENAME = /^r\.(-?\d+)\.(-?\d+)\.mca$/;

/** Parses `r.<x>.<z>.mca` into region coordinates, or returns null. */
export function parseRegionFileName(name: string): { x: number; z: number } | null {
  const match = REGION_FILENAME.exec(name);
  if (!match) return null;
  return { x: Number(match[1]), z: Number(match[2]) };
}

/* ================================================================== */
/* Deterministic spiral route builder                                  */
/* ================================================================== */

export interface SpiralRouteOptions {
  centerX?: number;
  centerZ?: number;
  radiusBlocks?: number;
  chunkStep?: number;
}

/**
 * The same center-out square-spiral route `scraper/scrape.js#buildTargets`
 * walks bots along: covers the area nearest the player first, and every
 * consecutive waypoint is chunk-adjacent rather than crisscrossing the box.
 *
 * Mirror: `test-e2e/lib/route.js#buildSpiralChunkTargets`.
 */
export function buildSpiralChunkTargets(options: SpiralRouteOptions = {}): Array<[number, number]> {
  const centerX = options.centerX ?? 0;
  const centerZ = options.centerZ ?? 0;
  const radiusBlocks = Math.max(16, options.radiusBlocks ?? 256);
  const step = Math.max(1, Math.floor(options.chunkStep ?? 1));

  const centerChunkX = Math.floor(centerX / 16);
  const centerChunkZ = Math.floor(centerZ / 16);
  const r = Math.ceil(radiusBlocks / 16);
  const minX = centerChunkX - r;
  const maxX = centerChunkX + r;
  const minZ = centerChunkZ - r;
  const maxZ = centerChunkZ + r;

  const inBox = (x: number, z: number): boolean => x >= minX && x <= maxX && z >= minZ && z <= maxZ;
  const seen = new Set<string>();
  const targets: Array<[number, number]> = [];
  const push = (x: number, z: number): void => {
    const key = `${x},${z}`;
    if (inBox(x, z) && !seen.has(key)) {
      seen.add(key);
      targets.push([x, z]);
    }
  };

  const total = (Math.floor((maxX - minX) / step) + 1) * (Math.floor((maxZ - minZ) / step) + 1);
  let x = centerChunkX;
  let z = centerChunkZ;
  push(x, z);

  const dirs: Array<[number, number]> = [
    [step, 0],
    [0, step],
    [-step, 0],
    [0, -step]
  ];
  let direction = 0;
  let run = 1;
  let guard = 0;
  const maxGuard = 8 * (total + 4);
  while (targets.length < total && guard++ < maxGuard) {
    for (let twice = 0; twice < 2; twice++) {
      const [dx, dz] = dirs[direction % 4];
      for (let s = 0; s < run; s++) {
        x += dx;
        z += dz;
        push(x, z);
      }
      direction++;
    }
    run++;
  }
  return targets;
}

/* ================================================================== */
/* Failure classification                                              */
/* ================================================================== */

export const E2E_STAGES = [
  'preflight',
  'server-starting',
  'server-ready',
  'proxy-starting',
  'proxy-listening',
  'bot-connecting',
  'bot-connected',
  'bot-walking',
  'bot-drained',
  'verifying',
  'done'
] as const;

export type E2eStage = (typeof E2E_STAGES)[number];

/**
 * Every distinct reason a run can fail to produce a verified world. A single
 * "e2e failed" verdict would hide five different causes that each need a
 * different fix — see `docs/features/downloader-e2e.md`.
 */
export enum E2eFailureCause {
  EnvironmentUnavailable = 'environment-unavailable',
  ServerNotReady = 'server-not-ready',
  ProxyNotAccepting = 'proxy-not-accepting',
  BotNotConnected = 'bot-not-connected',
  NoChunksStreamed = 'no-chunks-streamed',
  ChunksNotWritten = 'chunks-streamed-not-written',
  Cancelled = 'cancelled'
}

export const E2E_FAILURE_MESSAGES: Record<E2eFailureCause, string> = {
  [E2eFailureCause.EnvironmentUnavailable]:
    'This machine cannot provide something the run genuinely needs (Docker, a Java runtime, network access for the first download, or the world-downloader jar). The run stopped before it could exercise anything.',
  [E2eFailureCause.ServerNotReady]:
    'The Minecraft server process never printed its ready line within the timeout (or exited first). No proxy, bot or chunk saving was attempted.',
  [E2eFailureCause.ProxyNotAccepting]:
    'The world-downloader proxy never reported it was listening (its "Starting proxy for ..." line never appeared, or it exited first). The server was ready, but nothing downstream of it was exercised.',
  [E2eFailureCause.BotNotConnected]:
    'The bot process ended without ever logging in through the proxy (no login/spawn was observed). The proxy was listening, but the protocol path itself was never exercised.',
  [E2eFailureCause.NoChunksStreamed]:
    'The bot connected and moved, but the proxy never reported any chunk activity. The protocol handshake worked; chunk delivery did not.',
  [E2eFailureCause.ChunksNotWritten]:
    'Chunks were streamed to the client (the proxy logged activity, the bot walked its route), but reading the region files back on disk found zero, or far fewer than expected, saved chunks. Delivery worked; saving did not.',
  [E2eFailureCause.Cancelled]: 'The run was cancelled before it reached a verdict.'
};

export interface E2eVerdict {
  ok: boolean;
  reachedStage: E2eStage | null;
  reachedStageIndex: number;
  cause: E2eFailureCause | null;
  message: string;
  detail: string | null;
}

/** Mirror: `test-e2e/lib/classify.js#buildVerdict`. */
export function buildE2eVerdict(input: { reachedStage: E2eStage | null; cause?: E2eFailureCause | null; detail?: string | null }): E2eVerdict {
  const reachedStage = input.reachedStage ?? null;
  const cause = input.cause ?? null;
  return {
    ok: cause === null,
    reachedStage,
    reachedStageIndex: reachedStage ? E2E_STAGES.indexOf(reachedStage) : -1,
    cause,
    message: cause ? E2E_FAILURE_MESSAGES[cause] : 'The run reached its final stage and verified the world on disk.',
    detail: input.detail ?? null
  };
}

/* ================================================================== */
/* Log-line recognition                                                */
/* ================================================================== */

/** The real Vanilla/Spigot/Paper "world finished loading" banner. */
export const SERVER_READY_LINE = /Done \(([\d.]+)s\)!\s*For help/i;

/**
 * The lines `world-downloader.jar` itself prints, in the exact shape the
 * desktop application's own session reader
 * (`app/src/renderer/features/downloader/session.ts`) already parses. Kept
 * here too so this reference module's log-recognition logic can be checked
 * against the same real jar output the harness and the application both
 * depend on.
 */
export const PROXY_LISTENING_LINE = /^Starting proxy for (.+?)\. Make sure to connect to localhost:(\d+)/;
export const PROTOCOL_VERSION_LINE = /^Using protocol of game version (\S+) \((\d+)\)/;
export const LOGIN_SUCCESS_LINE = /^Login success: (\S+) logged in with uuid (\S+)/;
export const DISCONNECT_LINE = /^\[disconnect\]\s*(.*)$/;
