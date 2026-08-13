'use strict';
/*
 * A deterministic square-spiral chunk route, centered on a point and expanding
 * outward one ring at a time.
 *
 * This is the same algorithm `scraper/scrape.js#buildTargets` already uses to
 * walk bots through the proxy (center-out, so nearby chunks are covered first
 * and consecutive waypoints stay adjacent instead of crisscrossing). It is
 * ported here — rather than required from `scraper/` — so this harness's
 * "what the bot is expected to have visited" and the scraper's own "what the
 * bot actually walked" are two independently-written implementations of the
 * same rule; `test/selftest.js` cross-checks the two against each other so a
 * change to one that silently drifts from the other is caught rather than
 * assumed away.
 *
 * Deterministic on purpose: the exact same input always produces the exact
 * same ordered list, so a run's "expected chunks" can be computed before the
 * bot ever connects, and compared against afterward.
 */

/**
 * @param {{ centerX?: number, centerZ?: number, radiusBlocks?: number, chunkStep?: number }} options
 * @returns {Array<[number, number]>} chunk coordinates, nearest-to-center first
 */
function buildSpiralChunkTargets(options = {}) {
  const centerX = Number(options.centerX ?? 0);
  const centerZ = Number(options.centerZ ?? 0);
  const radiusBlocks = Math.max(16, Number(options.radiusBlocks ?? 256));
  const step = Math.max(1, Math.floor(Number(options.chunkStep ?? 1)));

  const cCX = Math.floor(centerX / 16);
  const cCZ = Math.floor(centerZ / 16);
  const r = Math.ceil(radiusBlocks / 16);
  const minCX = cCX - r;
  const maxCX = cCX + r;
  const minCZ = cCZ - r;
  const maxCZ = cCZ + r;

  const inBox = (x, z) => x >= minCX && x <= maxCX && z >= minCZ && z <= maxCZ;
  const seen = new Set();
  const targets = [];
  const push = (x, z) => {
    const key = x + ',' + z;
    if (inBox(x, z) && !seen.has(key)) {
      seen.add(key);
      targets.push([x, z]);
    }
  };

  const total = (Math.floor((maxCX - minCX) / step) + 1) * (Math.floor((maxCZ - minCZ) / step) + 1);
  let x = cCX;
  let z = cCZ;
  push(x, z);

  const dirs = [
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

/** Formats `[[x,z], ...]` as `x,z` keys, for fast set membership checks. */
function targetKeySet(targets) {
  const set = new Set();
  for (const [x, z] of targets) set.add(x + ',' + z);
  return set;
}

module.exports = { buildSpiralChunkTargets, targetKeySet };
