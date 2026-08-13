#!/usr/bin/env node
'use strict';
/*
 * mcwd-e2e — the end-to-end harness for the world downloader.
 *
 * Brings up a real Minecraft server, starts the downloader as a proxy in
 * front of it, drives one or more mineflayer bots through the proxy along a
 * deterministic route, then opens the region files that were actually
 * written and counts the chunks really saved — comparing that against the
 * route the bots walked rather than trusting a clean process exit.
 *
 * Runnable standalone, with nothing else running:
 *
 *   node test-e2e/run.js --version 1.20.4
 *   node test-e2e/run.js --help
 *
 * Every stage transition is printed as a human line on stderr and as a
 * single-line JSON event on stdout (see lib/log.js), so the desktop
 * application's own "watch a run" surface can drive this exact same script
 * and parse its progress without re-implementing any of the logic here.
 *
 * Exit codes:
 *   0  the run reached its final stage and the world verified on disk
 *   1  the run reached the server/proxy/bot but verification failed or came
 *      up short (see the printed cause — one of the five distinct causes in
 *      lib/classify.js, never a bare "e2e failed")
 *   2  the environment could not even attempt the run (Docker unavailable AND
 *      the jar could not be downloaded/built, Java missing, etc.)
 */

const path = require('node:path');
const fsp = require('node:fs/promises');
const os = require('node:os');
const crypto = require('node:crypto');

const paper = require('./lib/paper');
const downloaderLib = require('./lib/downloader');
const bots = require('./lib/bots');
const verify = require('./lib/verify');
const route = require('./lib/route');
const { STAGES, FAILURE_CAUSES, buildVerdict } = require('./lib/classify');
const { makeReporter } = require('./lib/log');

const REPO_ROOT = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const args = {
    version: '1.20.4',
    mode: 'auto', // auto | docker | jar
    radius: 128,
    bots: 1,
    java: 'java',
    node: process.execPath,
    jar: path.join(REPO_ROOT, 'target', 'world-downloader.jar'),
    scraperDir: path.join(REPO_ROOT, 'scraper'),
    workDir: null,
    serverPort: 25577,
    proxyPort: 25578,
    loadWaitMs: 500,
    finalDrainMs: 4000,
    serverReadyTimeoutMs: 180000,
    proxyReadyTimeoutMs: 30000,
    coverageThreshold: 0.6,
    keep: false,
    help: false
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => argv[++i];
    switch (arg) {
      case '--version': args.version = next(); break;
      case '--mode': args.mode = next(); break;
      case '--radius': args.radius = Number(next()); break;
      case '--bots': args.bots = Number(next()); break;
      case '--java': args.java = next(); break;
      case '--jar': args.jar = path.resolve(next()); break;
      case '--scraper-dir': args.scraperDir = path.resolve(next()); break;
      case '--work-dir': args.workDir = path.resolve(next()); break;
      case '--server-port': args.serverPort = Number(next()); break;
      case '--proxy-port': args.proxyPort = Number(next()); break;
      case '--load-wait-ms': args.loadWaitMs = Number(next()); break;
      case '--final-drain-ms': args.finalDrainMs = Number(next()); break;
      case '--server-ready-timeout-ms': args.serverReadyTimeoutMs = Number(next()); break;
      case '--coverage-threshold': args.coverageThreshold = Number(next()); break;
      case '--keep': args.keep = true; break;
      case '--help':
      case '-h':
        args.help = true;
        break;
      default:
        // Unknown flags are reported, not silently ignored — a typo'd flag
        // should not quietly run with the default instead.
        throw new Error(`Unknown argument "${arg}". Run with --help for the full list.`);
    }
  }
  return args;
}

function printHelp() {
  process.stdout.write(`mcwd-e2e — end-to-end harness for the Minecraft world downloader

Usage: node test-e2e/run.js [options]

  --version <ver>            Minecraft/Paper version to test (default 1.20.4)
  --mode auto|docker|jar     How to bring up the server (default auto: try Docker, fall back to a downloaded jar)
  --radius <blocks>          Radius the bots cover around spawn (default 128)
  --bots <count>             Number of bots to run (default 1)
  --java <command>           Java command for the server jar and the downloader (default "java")
  --jar <path>               Path to world-downloader.jar (default target/world-downloader.jar)
  --scraper-dir <path>       Path to the scraper/ directory (default ../scraper relative to this file)
  --work-dir <path>          Where to put server data, the downloaded world, and logs (default a fresh directory under test-e2e/work)
  --server-port <port>       Real server's port (default 25577)
  --proxy-port <port>        Downloader proxy's local port, what the bots connect to (default 25578)
  --load-wait-ms <ms>        Dwell time per chunk while walking (default 500)
  --final-drain-ms <ms>      Time to wait connected after walking so pending saves flush (default 4000)
  --coverage-threshold <0-1> Fraction of expected chunks that must be found saved to call the run a pass (default 0.6)
  --keep                     Do not stop the server/downloader or delete the work directory afterward
  --help                     Show this message
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return 0;
  }

  const runId = crypto.randomUUID();
  const report = makeReporter(runId);
  const workDir = args.workDir ?? path.join(REPO_ROOT, 'test-e2e', 'work', `${Date.now()}-${args.version}`);
  await fsp.mkdir(workDir, { recursive: true });

  const serverWorkDir = path.join(workDir, 'server');
  const downloaderWorkDir = path.join(workDir, 'downloader');
  const worldOutputDir = path.join(workDir, 'world');
  const botsWorkDir = path.join(workDir, 'bots');
  const logPath = path.join(workDir, 'full-output.log');
  const logLines = [];
  const collect = (source) => (line) => logLines.push(`[${source}] ${line}`);

  let serverHandle = null;
  let downloaderHandle = null;
  let finalVerdict = null;
  let extra = {};

  report.stage(STAGES[0], { detail: `run ${runId}, version ${args.version}, mode ${args.mode}, work dir ${workDir}` });

  try {
    /* ---- stage: server ---- */
    report.stage('server-starting');
    let dockerAttempted = false;
    let dockerAvailable = { available: false, reason: 'not checked' };
    if (args.mode === 'docker' || args.mode === 'auto') {
      dockerAvailable = await paper.checkDockerAvailable();
      if (dockerAvailable.available) {
        dockerAttempted = true;
        try {
          serverHandle = await paper.startServerDocker({
            containerName: `mcwd-e2e-${runId.slice(0, 8)}`,
            hostPort: args.serverPort,
            version: args.version,
            dataDir: path.join(serverWorkDir, 'docker-data'),
            memoryMb: 1536,
            readyTimeoutMs: args.serverReadyTimeoutMs,
            onLine: collect('server')
          });
        } catch (error) {
          report.note(`Docker route failed: ${error.message}`);
          if (args.mode === 'docker') throw error;
        }
      } else {
        report.note(`Docker is not available (${dockerAvailable.reason}); falling back to a downloaded server jar.`);
      }
    }

    if (!serverHandle) {
      if (args.mode === 'docker') {
        finalVerdict = buildVerdict({
          reachedStage: 'preflight',
          cause: FAILURE_CAUSES.ENVIRONMENT_UNAVAILABLE,
          detail: `--mode docker was requested but Docker is unavailable: ${dockerAvailable.reason}`
        });
        throw new EnvironmentError(finalVerdict.detail);
      }
      let jarInfo;
      try {
        jarInfo = await paper.ensurePaperJar(args.version, path.join(REPO_ROOT, 'test-e2e', '.cache'));
      } catch (error) {
        finalVerdict = buildVerdict({
          reachedStage: 'preflight',
          cause: FAILURE_CAUSES.ENVIRONMENT_UNAVAILABLE,
          detail: `Could not obtain a Paper ${args.version} server jar: ${error.message}`
        });
        throw new EnvironmentError(finalVerdict.detail);
      }
      extra.serverJar = { name: jarInfo.build.name, sha256: jarInfo.build.sha256, reusedFromCache: jarInfo.reused };
      report.note(`Server jar: ${jarInfo.jarPath} (build ${jarInfo.build.buildId}, ${jarInfo.reused ? 'reused from cache' : 'freshly downloaded and sha256-verified'})`);
      try {
        serverHandle = await paper.startServerJar({
          javaCommand: args.java,
          jarPath: jarInfo.jarPath,
          workDir: serverWorkDir,
          port: args.serverPort,
          memoryMb: 1536,
          readyTimeoutMs: args.serverReadyTimeoutMs,
          onLine: collect('server')
        });
      } catch (error) {
        finalVerdict = buildVerdict({ reachedStage: 'server-starting', cause: FAILURE_CAUSES.SERVER_NOT_READY, detail: error.message });
        throw error;
      }
    }
    extra.serverRoute = serverHandle.kind;
    extra.serverReadyLine = serverHandle.readyLine;
    report.stage('server-ready', { detail: `${serverHandle.kind}: ${serverHandle.readyLine}` });

    /* ---- stage: proxy ---- */
    report.stage('proxy-starting');
    try {
      downloaderHandle = await downloaderLib.startDownloaderProxy({
        javaCommand: args.java,
        jarPath: args.jar,
        serverHost: '127.0.0.1',
        serverPort: args.serverPort,
        localPort: args.proxyPort,
        outputDir: worldOutputDir,
        workDir: downloaderWorkDir,
        readyTimeoutMs: args.proxyReadyTimeoutMs,
        onLine: collect('downloader')
      });
    } catch (error) {
      finalVerdict = buildVerdict({ reachedStage: 'proxy-starting', cause: FAILURE_CAUSES.PROXY_NOT_ACCEPTING, detail: error.message });
      throw error;
    }
    extra.proxyReadyLine = downloaderHandle.readyLine;
    report.stage('proxy-listening', { detail: downloaderHandle.readyLine });

    /* ---- stage: bots ---- */
    report.stage('bot-connecting');
    const expectedTargets = route.buildSpiralChunkTargets({ centerX: 0, centerZ: 0, radiusBlocks: args.radius, chunkStep: 1 });
    const expectedKeys = expectedTargets.map(([x, z]) => x + ',' + z);
    report.note(`Expected route: ${expectedTargets.length} chunks within a ${args.radius}-block radius of spawn.`);

    let botRun;
    let sawFirstSpawn = false;
    let lastProgressReported = 0;
    const BOT_SPAWNED_LINE = /spawned at .+? gamemode=(\S+)/;
    const BOT_PROGRESS_LINE = /visited (\d+)\/(\d+) chunks/;
    try {
      botRun = await bots.runScraperBots({
        scraperDir: args.scraperDir,
        nodeCommand: args.node,
        host: '127.0.0.1',
        port: args.proxyPort,
        version: args.version,
        centerX: 0,
        centerZ: 0,
        radiusBlocks: args.radius,
        botCount: args.bots,
        loadWaitMs: args.loadWaitMs,
        finalDrainMs: args.finalDrainMs,
        workDir: botsWorkDir,
        onLine: (line) => {
          // Live progress while the bot walks, not only a verdict after the
          // whole scraper process has already exited — a run this long needs
          // real intermediate feedback, not a single jump from "connecting"
          // to "done" several minutes later.
          collect('bots')(line);
          if (!sawFirstSpawn && BOT_SPAWNED_LINE.test(line)) {
            sawFirstSpawn = true;
            report.stage('bot-connected', { detail: line });
          }
          const progressMatch = BOT_PROGRESS_LINE.exec(line);
          if (progressMatch) {
            const done = Number(progressMatch[1]);
            if (done > lastProgressReported) {
              lastProgressReported = done;
              report.progress('bot-walking', done, expectedTargets.length);
            }
          }
        }
      });
    } catch (error) {
      finalVerdict = buildVerdict({ reachedStage: 'bot-connecting', cause: FAILURE_CAUSES.BOT_NOT_CONNECTED, detail: error.message });
      throw error;
    }
    extra.botRun = { exitCode: botRun.exitCode, spawnedBots: botRun.state.spawnedBots, gamemodes: botRun.state.gamemodes, totalVisited: botRun.state.totalVisited };

    if (botRun.state.spawnedBots === 0) {
      finalVerdict = buildVerdict({
        reachedStage: 'bot-connecting',
        cause: FAILURE_CAUSES.BOT_NOT_CONNECTED,
        detail: 'No bot ever reported spawning. Check the bots log for the login/handshake failure.'
      });
      throw new Error(finalVerdict.detail);
    }
    report.stage('bot-connected', { detail: `${botRun.state.spawnedBots} bot(s) spawned (${botRun.state.gamemodes.join(', ')})` });

    report.stage('bot-walking', { detail: `visited ${botRun.state.totalVisited} chunks this run` });
    if (botRun.state.totalVisited === 0 && !downloaderHandle.status.chunkActivityObserved) {
      finalVerdict = buildVerdict({
        reachedStage: 'bot-walking',
        cause: FAILURE_CAUSES.NO_CHUNKS_STREAMED,
        detail: 'The bot connected but visited no chunks and the proxy never logged chunk activity.'
      });
      throw new Error(finalVerdict.detail);
    }
    report.stage('bot-drained');

    /* ---- stage: stop the proxy so it flushes pending regions to disk ---- */
    await downloaderHandle.stop();
    downloaderHandle = null;

    /* ---- stage: verify ---- */
    report.stage('verifying');
    const verdictData = await verify.verifyWorld({ worldDir: worldOutputDir, expectedChunkKeys: expectedKeys, dimension: 'overworld' });
    extra.verification = verdictData;
    report.note(
      `Verification: ${verdictData.filesFound} region file(s) found, ${verdictData.filesRead} read, ` +
        `${verdictData.matchedCount}/${verdictData.expectedCount} expected chunks confirmed on disk ` +
        `(${(verdictData.coverageRatio * 100).toFixed(1)}% coverage), ${verdictData.totalSavedAcrossDimensions} total chunks saved across all dimensions.`
    );

    if (verdictData.totalSavedAcrossDimensions === 0) {
      finalVerdict = buildVerdict({
        reachedStage: 'verifying',
        cause: FAILURE_CAUSES.CHUNKS_NOT_WRITTEN,
        detail: 'Chunks were streamed to the bot and the proxy reported activity, but zero occupied chunk slots were found in any region file.'
      });
    } else if (verdictData.coverageRatio < args.coverageThreshold) {
      finalVerdict = buildVerdict({
        reachedStage: 'verifying',
        cause: FAILURE_CAUSES.CHUNKS_NOT_WRITTEN,
        detail: `Only ${(verdictData.coverageRatio * 100).toFixed(1)}% of the expected route was found saved, below the ${(args.coverageThreshold * 100).toFixed(0)}% pass threshold.`
      });
    } else {
      report.stage('done');
      finalVerdict = buildVerdict({ reachedStage: 'done' });
    }
  } catch (error) {
    if (!finalVerdict) {
      finalVerdict = buildVerdict({ reachedStage: 'preflight', cause: FAILURE_CAUSES.ENVIRONMENT_UNAVAILABLE, detail: error.message });
    }
    extra.error = error.message;
  } finally {
    if (!args.keep) {
      if (downloaderHandle) await downloaderHandle.stop().catch(() => {});
      if (serverHandle) await serverHandle.stop().catch(() => {});
    } else {
      report.note(`--keep was set: leaving the server, downloader work directory and world at ${workDir}`);
    }
    await fsp.writeFile(logPath, logLines.join('\n') + '\n', 'utf8').catch(() => {});
  }

  const resultEvent = report.result(finalVerdict, extra);
  const reportPath = path.join(workDir, 'report.json');
  await fsp.writeFile(reportPath, JSON.stringify({ args, ...resultEvent }, null, 2), 'utf8').catch(() => {});
  report.note(`Full report: ${reportPath}`);
  report.note(`Full combined log: ${logPath}`);

  if (finalVerdict.ok) return 0;
  if (finalVerdict.cause === FAILURE_CAUSES.ENVIRONMENT_UNAVAILABLE) return 2;
  return 1;
}

class EnvironmentError extends Error {}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    process.stderr.write(`mcwd-e2e: unhandled error: ${error.stack || error.message}\n`);
    process.exit(2);
  });
