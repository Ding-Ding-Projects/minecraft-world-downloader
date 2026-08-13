#!/usr/bin/env node
'use strict';
/*
 * A home-grown, dependency-free test runner for this harness's own hard
 * logic: the parts where being wrong is silent, because a mistake here would
 * make the harness lie about what an e2e run actually proved.
 *
 *   - region.js:  the Anvil header reader — a bug here silently miscounts or
 *                 mislocates saved chunks.
 *   - route.js:   the spiral route builder — a bug here silently expects the
 *                 wrong chunks and reports false failures or false passes,
 *                 and is cross-checked against scraper/scrape.js's own
 *                 (independently-written) target builder.
 *   - classify.js: every failure cause has real, distinct copy.
 *   - log.js:      every emitted stdout event is valid, parseable JSON.
 *   - downloader.js / paper.js: the log-line regular expressions actually
 *                 match the real lines the jar and the server print.
 *
 * Run with: node test-e2e/test/selftest.js
 * This is intentionally separate from the desktop application's own
 * `npx vitest run` suite: this directory has no build step and must stay
 * runnable with nothing but a plain `node` binary, exactly like the rest of
 * this harness.
 */

const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const { parseRegionHeader, parseRegionFileName, SECTOR_SIZE } = require('../lib/region');
const { buildSpiralChunkTargets, targetKeySet } = require('../lib/route');
const { STAGES, FAILURE_CAUSES, FAILURE_MESSAGES, buildVerdict } = require('../lib/classify');
const { makeReporter } = require('../lib/log');
const { READY_LINE } = require('../lib/paper');
const { PROXY_LINE, PROTOCOL_LINE, LOGIN_LINE, DISCONNECT_LINE } = require('../lib/downloader');
const { buildScraperConfig } = require('../lib/bots');

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

/* ------------------------------------------------------------------ */
/* region.js — the Anvil header reader                                 */
/* ------------------------------------------------------------------ */

/** Builds a synthetic-but-format-correct .mca buffer for a given set of occupied slots. */
function buildFakeRegionBuffer(slots) {
  // slots: Array<{ localX, localZ, sectorOffset, sizeSectors }>
  const locations = Buffer.alloc(SECTOR_SIZE);
  const timestamps = Buffer.alloc(SECTOR_SIZE);
  let maxEnd = 0;
  for (const slot of slots) {
    const index = 4 * (slot.localX + slot.localZ * 32);
    locations.writeUIntBE(slot.sectorOffset, index, 3);
    locations[index + 3] = slot.sizeSectors;
    timestamps.writeUInt32BE(1700000000, index);
    maxEnd = Math.max(maxEnd, (slot.sectorOffset + slot.sizeSectors - 2) * SECTOR_SIZE);
  }
  const chunkArea = Buffer.alloc(maxEnd, 0xab);
  return Buffer.concat([locations, timestamps, chunkArea]);
}

test('region: two real chunks are found at their correct absolute coordinates', () => {
  const buffer = buildFakeRegionBuffer([
    { localX: 0, localZ: 0, sectorOffset: 2, sizeSectors: 1 },
    { localX: 1, localZ: 0, sectorOffset: 3, sizeSectors: 2 }
  ]);
  const { chunks, truncated } = parseRegionHeader(buffer, 2, -3);
  assert.equal(truncated, false);
  assert.equal(chunks.length, 2);
  const keys = chunks.map((c) => c.x + ',' + c.z).sort();
  assert.deepEqual(keys, ['64,-96', '65,-96']);
});

test('region: a lone bare-sector slot is treated as not actually generated', () => {
  const buffer = buildFakeRegionBuffer([{ localX: 5, localZ: 5, sectorOffset: 2, sizeSectors: 1 }]);
  const { chunks } = parseRegionHeader(buffer, 0, 0);
  assert.deepEqual(chunks, []);
});

test('region: an empty (all-zero header) file has no chunks', () => {
  const buffer = Buffer.alloc(SECTOR_SIZE * 2);
  const { chunks } = parseRegionHeader(buffer, 0, 0);
  assert.deepEqual(chunks, []);
});

test('region: a zero-byte file is reported as empty, not truncated', () => {
  const { chunks, truncated } = parseRegionHeader(Buffer.alloc(0), 0, 0);
  assert.deepEqual(chunks, []);
  assert.equal(truncated, false);
});

test('region: a file smaller than the header is reported as truncated', () => {
  const { chunks, truncated } = parseRegionHeader(Buffer.alloc(100, 1), 0, 0);
  assert.deepEqual(chunks, []);
  assert.equal(truncated, true);
});

test('region: an out-of-bounds location entry is skipped rather than crashing', () => {
  const locations = Buffer.alloc(SECTOR_SIZE);
  // A slot claiming a huge sector offset with a nonzero size, but no data behind it.
  locations.writeUIntBE(99999, 0, 3);
  locations[3] = 5;
  const buffer = Buffer.concat([locations, Buffer.alloc(SECTOR_SIZE), Buffer.alloc(SECTOR_SIZE)]);
  const { chunks } = parseRegionHeader(buffer, 0, 0);
  assert.deepEqual(chunks, []);
});

test('region: parseRegionFileName accepts negative coordinates and rejects non-region files', () => {
  assert.deepEqual(parseRegionFileName('r.2.-3.mca'), { x: 2, z: -3 });
  assert.deepEqual(parseRegionFileName('r.-10.-10.mca'), { x: -10, z: -10 });
  assert.equal(parseRegionFileName('level.dat'), null);
  assert.equal(parseRegionFileName('r.2.3.mcc'), null);
});

/* ------------------------------------------------------------------ */
/* route.js — the spiral route builder                                 */
/* ------------------------------------------------------------------ */

test('route: is deterministic across repeated calls with the same input', () => {
  const a = buildSpiralChunkTargets({ centerX: 100, centerZ: -50, radiusBlocks: 96, chunkStep: 1 });
  const b = buildSpiralChunkTargets({ centerX: 100, centerZ: -50, radiusBlocks: 96, chunkStep: 1 });
  assert.deepEqual(a, b);
});

test('route: starts at the center chunk and stays within the requested box', () => {
  const targets = buildSpiralChunkTargets({ centerX: 0, centerZ: 0, radiusBlocks: 64, chunkStep: 1 });
  assert.deepEqual(targets[0], [0, 0]);
  const r = Math.ceil(64 / 16);
  for (const [x, z] of targets) {
    assert.ok(x >= -r && x <= r, `x=${x} out of expected [-${r},${r}]`);
    assert.ok(z >= -r && z <= r, `z=${z} out of expected [-${r},${r}]`);
  }
  const expectedCount = (2 * r + 1) * (2 * r + 1);
  assert.equal(targets.length, expectedCount);
});

test('route: consecutive waypoints are always chunk-adjacent (never a long jump)', () => {
  const targets = buildSpiralChunkTargets({ centerX: 0, centerZ: 0, radiusBlocks: 80, chunkStep: 1 });
  for (let i = 1; i < targets.length; i++) {
    const [x1, z1] = targets[i - 1];
    const [x2, z2] = targets[i];
    const distance = Math.abs(x1 - x2) + Math.abs(z1 - z2);
    assert.equal(distance, 1, `waypoint ${i} jumped ${distance} chunks instead of 1`);
  }
});

test('route: cross-checked against scraper/scrape.js\'s own independent buildTargets', () => {
  let scraperBuildTargets;
  try {
    // eslint-disable-next-line global-require
    ({ buildTargets: scraperBuildTargets } = require('../../scraper/scrape.js'));
  } catch (error) {
    logSkip('route cross-check: scraper/scrape.js could not be required (its own dependencies are likely not installed — run "npm install" inside scraper/ to enable this check): ' + error.message);
    return;
  }
  for (const params of [
    { center: { x: 0, z: 0 }, radius: 64, chunkStep: 1 },
    { center: { x: 200, z: -300 }, radius: 128, chunkStep: 1 },
    { center: { x: -50, z: 50 }, radius: 48, chunkStep: 1 }
  ]) {
    const mine = targetKeySet(buildSpiralChunkTargets({ centerX: params.center.x, centerZ: params.center.z, radiusBlocks: params.radius, chunkStep: params.chunkStep }));
    const theirs = targetKeySet(scraperBuildTargets(Object.assign({ bbox: null }, params)));
    assert.equal(mine.size, theirs.size, `target-set size differs for ${JSON.stringify(params)}`);
    for (const key of mine) assert.ok(theirs.has(key), `mine has ${key} but scraper's builder does not, for ${JSON.stringify(params)}`);
    for (const key of theirs) assert.ok(mine.has(key), `scraper's builder has ${key} but mine does not, for ${JSON.stringify(params)}`);
  }
});

/* ------------------------------------------------------------------ */
/* classify.js                                                         */
/* ------------------------------------------------------------------ */

test('classify: every failure cause has a real, non-empty, distinct message', () => {
  const messages = new Set();
  for (const cause of Object.values(FAILURE_CAUSES)) {
    const message = FAILURE_MESSAGES[cause];
    assert.ok(typeof message === 'string' && message.length > 20, `cause "${cause}" has no real message`);
    assert.ok(!messages.has(message), `cause "${cause}" shares its message with another cause`);
    messages.add(message);
  }
});

test('classify: buildVerdict(ok) has cause null and ok true', () => {
  const verdict = buildVerdict({ reachedStage: 'done' });
  assert.equal(verdict.ok, true);
  assert.equal(verdict.cause, null);
  assert.equal(verdict.reachedStage, 'done');
});

test('classify: buildVerdict(failure) is never ok and carries the exact cause', () => {
  const verdict = buildVerdict({ reachedStage: 'bot-connecting', cause: FAILURE_CAUSES.BOT_NOT_CONNECTED, detail: 'x' });
  assert.equal(verdict.ok, false);
  assert.equal(verdict.cause, FAILURE_CAUSES.BOT_NOT_CONNECTED);
  assert.equal(verdict.detail, 'x');
  assert.equal(verdict.reachedStageIndex, STAGES.indexOf('bot-connecting'));
});

/* ------------------------------------------------------------------ */
/* log.js — every stdout event is well-formed, parseable JSON          */
/* ------------------------------------------------------------------ */

test('log: stage/progress/result events print exactly one parseable JSON line each on stdout', () => {
  const written = [];
  const original = process.stdout.write.bind(process.stdout);
  process.stdout.write = (chunk) => {
    written.push(String(chunk));
    return true;
  };
  try {
    const reporter = makeReporter('selftest-run');
    reporter.stage('server-ready', { detail: 'x' });
    reporter.progress('bot-walking', 3, 10);
    reporter.result(buildVerdict({ reachedStage: 'done' }));
  } finally {
    process.stdout.write = original;
  }
  assert.equal(written.length, 3);
  const [stageLine, progressLine, resultLine] = written.map((line) => line.trim());
  assert.ok(stageLine.startsWith('STAGE '));
  assert.ok(progressLine.startsWith('PROGRESS '));
  assert.ok(resultLine.startsWith('RESULT '));
  const stageEvent = JSON.parse(stageLine.slice('STAGE '.length));
  const progressEvent = JSON.parse(progressLine.slice('PROGRESS '.length));
  const resultEvent = JSON.parse(resultLine.slice('RESULT '.length));
  assert.equal(stageEvent.stage, 'server-ready');
  assert.equal(progressEvent.done, 3);
  assert.equal(progressEvent.total, 10);
  assert.equal(resultEvent.verdict.ok, true);
});

/* ------------------------------------------------------------------ */
/* paper.js / downloader.js — the log-line regular expressions          */
/* ------------------------------------------------------------------ */

test('paper: READY_LINE matches the real Vanilla/Spigot/Paper ready banner', () => {
  assert.ok(READY_LINE.test('[12:34:56] [Server thread/INFO]: Done (12.345s)! For help, type "help"'));
  assert.ok(READY_LINE.test('Done (8.2s)! For help, type "help" (or "?")'));
  assert.ok(!READY_LINE.test('[12:34:56] [Server thread/INFO]: Starting minecraft server version 1.20.4'));
  assert.ok(!READY_LINE.test('Stopping the server'));
});

test('downloader: PROXY_LINE / PROTOCOL_LINE / LOGIN_LINE / DISCONNECT_LINE match the jar\'s real output', () => {
  const proxy = PROXY_LINE.exec('Starting proxy for 127.0.0.1:25577. Make sure to connect to localhost:25578');
  assert.ok(proxy);
  assert.equal(proxy[1], '127.0.0.1:25577');
  assert.equal(proxy[2], '25578');

  const protocol = PROTOCOL_LINE.exec('Using protocol of game version 1.20.4 (765)');
  assert.ok(protocol);
  assert.equal(protocol[1], '1.20.4');
  assert.equal(protocol[2], '765');

  const login = LOGIN_LINE.exec('Login success: E2EBot1 logged in with uuid 11111111-2222-3333-4444-555555555555');
  assert.ok(login);
  assert.equal(login[1], 'E2EBot1');

  const disconnect = DISCONNECT_LINE.exec('[disconnect] Server closed');
  assert.ok(disconnect);
  assert.equal(disconnect[1], 'Server closed');
});

/* ------------------------------------------------------------------ */
/* bots.js — the scraper config must always pin a real protocol version */
/* ------------------------------------------------------------------ */

test('bots: buildScraperConfig pins the exact version passed in (regression: this harness\'s first live run silently auto-detected and disconnected within a second)', () => {
  const config = buildScraperConfig({
    host: '127.0.0.1',
    port: 25578,
    version: '1.20.4',
    centerX: 0,
    centerZ: 0,
    radiusBlocks: 64,
    botCount: 2,
    loadWaitMs: 400,
    finalDrainMs: 3000,
    visitedFilePath: '/tmp/visited.json'
  });
  assert.equal(config.version, '1.20.4');
  assert.notEqual(config.version, false);
  assert.equal(config.accounts.length, 2);
  assert.equal(config.revisit, true);
});

test('bots: buildScraperConfig refuses to build an unpinned (version: false) config', () => {
  assert.throws(() =>
    buildScraperConfig({
      host: '127.0.0.1',
      port: 25578,
      version: false,
      centerX: 0,
      centerZ: 0,
      radiusBlocks: 64,
      botCount: 1,
      loadWaitMs: 400,
      finalDrainMs: 3000,
      visitedFilePath: '/tmp/visited.json'
    })
  );
});

/* ------------------------------------------------------------------ */
/* fixture: a real captured run's server output, when one is available */
/* ------------------------------------------------------------------ */

test('paper: READY_LINE matches the fixture captured from a real run, when the fixture exists', () => {
  const fixturePath = path.join(__dirname, 'fixtures', 'real-server-ready-line.txt');
  if (!fs.existsSync(fixturePath)) {
    logSkip('no captured real-run fixture at ' + fixturePath + ' yet (this repository records one once a live run has succeeded on some machine)');
    return;
  }
  const line = fs.readFileSync(fixturePath, 'utf8').trim();
  assert.ok(line.length > 0, 'fixture file is empty');
  assert.ok(READY_LINE.test(line), `captured real ready line did not match READY_LINE: "${line}"`);
});

/* ------------------------------------------------------------------ */
/* runner                                                              */
/* ------------------------------------------------------------------ */

let skipped = 0;
function logSkip(message) {
  skipped += 1;
  console.log(`  SKIP  ${message}`);
}

async function runAll() {
  let passed = 0;
  let failed = 0;
  for (const { name, fn } of tests) {
    try {
      await fn();
      passed += 1;
      console.log(`  PASS  ${name}`);
    } catch (error) {
      failed += 1;
      console.log(`  FAIL  ${name}`);
      console.log(`        ${error.message}`);
    }
  }
  console.log('');
  console.log(`${passed} passed, ${failed} failed, ${skipped} skipped, ${tests.length} total`);
  process.exit(failed > 0 ? 1 : 0);
}

runAll();
