'use strict';
/*
 * Drives one or more mineflayer bots through the proxy using this project's
 * own scraper (`scraper/scrape.js`) — the code the README already documents as
 * verified end to end, rather than a fresh bot implementation for this
 * harness alone. This module only builds the scraper's config, spawns it as a
 * child `node` process, and reads its stdout for the lines it already prints
 * ("spawned at ...", "visited N/M chunks", "done — visited N chunks",
 * "complete — N chunks visited this run").
 */

const { spawn } = require('node:child_process');
const fsp = require('node:fs/promises');
const path = require('node:path');

const SPAWNED_LINE = /spawned at .+? gamemode=(\S+)/;
const VISITED_PROGRESS_LINE = /visited (\d+)\/(\d+) chunks/;
const BOT_DONE_LINE = /done — visited (\d+) chunks/;
const RUN_COMPLETE_LINE = /mcwd-scraper: complete — (\d+) chunks visited this run/;
const LOGIN_REQUIRED_LINE = /disconnected:|kicked:/;

/**
 * Builds the scraper's config object. Kept as its own pure function — no file
 * I/O, no child process — so the one thing that is easy to get silently wrong
 * (forgetting to pin the protocol version) has a direct unit test rather than
 * only being checkable by running a real bot against a real server.
 *
 * The version MUST be pinned to the real server version rather than left as
 * mineflayer's own auto-detect (`false`). Auto-detect walks the proxy's
 * handshake and reports whichever protocol mineflayer-data knows as newest,
 * which is not necessarily the version the proxy is actually speaking — this
 * is the exact gotcha this project's own prior end-to-end passes documented
 * (`docs/testing/goal-3pass-report.md`), and it is why an unpinned bot
 * connects and is disconnected again within a second, with the proxy and
 * server both healthy the whole time. This harness hit exactly that failure
 * on its first live run before the pin was added here.
 *
 * @param {{
 *   host: string, port: number, version: string, centerX: number, centerZ: number,
 *   radiusBlocks: number, botCount: number, loadWaitMs: number, finalDrainMs: number,
 *   visitedFilePath: string
 * }} options
 */
function buildScraperConfig(options) {
  const { host, port, version, centerX, centerZ, radiusBlocks, botCount, loadWaitMs, finalDrainMs, visitedFilePath } = options;
  if (!version) {
    throw new Error('buildScraperConfig requires a real protocol version — leaving it unpinned reconnects and disconnects within a second (see the doc comment above).');
  }
  const accounts = Array.from({ length: Math.max(1, botCount) }, (_, index) => ({
    auth: 'offline',
    username: `E2EBot${index + 1}`
  }));

  return {
    host,
    port,
    version,
    accounts,
    center: { x: centerX, z: centerZ },
    radius: radiusBlocks,
    bbox: null,
    chunkStep: 1,
    flyWhenAble: true,
    preferFly: false,
    walkWhenGrounded: true,
    flyAltitude: 90,
    arriveRadius: 6,
    waypointTimeoutMs: 20000,
    loadWaitMs,
    visitedFile: visitedFilePath,
    revisit: true, // a fresh e2e run must not skip chunks because a stale cache says they were already visited
    containerDwellMs: 0,
    finalDrainMs,
    loginPassword: '',
    autoLogin: false,
    stuckCheckMs: 4000,
    stuckEpsilon: 1.5,
    loginStaggerMs: 2500
  };
}

/**
 * @param {{
 *   scraperDir: string, nodeCommand: string, host: string, port: number, version: string,
 *   centerX: number, centerZ: number, radiusBlocks: number, botCount: number,
 *   loadWaitMs: number, finalDrainMs: number, workDir: string,
 *   onLine?: (line: string) => void
 * }} options
 */
async function runScraperBots(options) {
  const { scraperDir, nodeCommand, workDir, onLine } = options;

  await fsp.mkdir(workDir, { recursive: true });
  const scraperEntry = path.join(scraperDir, 'scrape.js');
  const scraperModulesOk = await pathExists(path.join(scraperDir, 'node_modules', 'mineflayer'));
  if (!scraperModulesOk) {
    throw new Error(
      `${scraperDir} has no installed "mineflayer" dependency. Run "npm install" inside scraper/ before the bot stage can connect.`
    );
  }

  const config = buildScraperConfig({
    host: options.host,
    port: options.port,
    version: options.version,
    centerX: options.centerX,
    centerZ: options.centerZ,
    radiusBlocks: options.radiusBlocks,
    botCount: options.botCount,
    loadWaitMs: options.loadWaitMs,
    finalDrainMs: options.finalDrainMs,
    visitedFilePath: path.join(workDir, 'visited.json')
  });

  const configPath = path.join(workDir, 'scraper-config.json');
  await fsp.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');

  return new Promise((resolve, reject) => {
    const child = spawn(nodeCommand, [scraperEntry, '--config', configPath], { cwd: scraperDir, shell: false });
    const state = { spawnedBots: 0, gamemodes: [], perBotVisited: {}, totalVisited: 0, sawDisconnect: false, lines: [] };
    let buffer = '';

    const feed = (chunk) => {
      buffer += chunk.toString('utf8');
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';
      for (const raw of lines) {
        const line = raw.trim();
        if (line === '') continue;
        state.lines.push(line);
        onLine?.(line);

        const spawned = SPAWNED_LINE.exec(line);
        if (spawned) {
          state.spawnedBots += 1;
          state.gamemodes.push(spawned[1]);
        }
        const progress = VISITED_PROGRESS_LINE.exec(line);
        if (progress) {
          // Reported per-bot; keyed by the "[botN]" tag scrape.js prefixes each line with.
          const tagMatch = /^\[bot(\d+)\]/.exec(line);
          if (tagMatch) state.perBotVisited[tagMatch[1]] = Number(progress[1]);
        }
        const done = BOT_DONE_LINE.exec(line);
        if (done) {
          const tagMatch = /^\[bot(\d+)\]/.exec(line);
          if (tagMatch) state.perBotVisited[tagMatch[1]] = Number(done[1]);
        }
        const complete = RUN_COMPLETE_LINE.exec(line);
        if (complete) state.totalVisited = Number(complete[1]);
        if (LOGIN_REQUIRED_LINE.test(line)) state.sawDisconnect = true;
      }
    };

    child.stdout.on('data', feed);
    child.stderr.on('data', feed);
    child.on('error', (error) => reject(new Error(`Could not run scraper/scrape.js: ${error.message}`)));
    child.on('exit', (code) => {
      resolve({ exitCode: code, state });
    });
  });
}

async function pathExists(target) {
  try {
    await fsp.access(target);
    return true;
  } catch {
    return false;
  }
}

module.exports = { runScraperBots, buildScraperConfig };
