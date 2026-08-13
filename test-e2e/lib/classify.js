'use strict';
/*
 * The run's stages, and the honest classification of where a failed run
 * actually stopped.
 *
 * A single "e2e failed" verdict hides five different causes that each need a
 * different fix: the server never came up, the proxy never accepted a
 * connection, the bot never logged in, the bot connected but the server never
 * streamed chunks to it, or chunks streamed but nothing was written to disk.
 * Every stage the run passes through is recorded with a timestamp, so a
 * failure is reported as "reached stage X, then Y happened" rather than a bare
 * exit code.
 */

const STAGES = [
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
];

/** Every distinct reason a run can fail to produce a verified world. */
const FAILURE_CAUSES = {
  ENVIRONMENT_UNAVAILABLE: 'environment-unavailable',
  SERVER_NOT_READY: 'server-not-ready',
  PROXY_NOT_ACCEPTING: 'proxy-not-accepting',
  BOT_NOT_CONNECTED: 'bot-not-connected',
  NO_CHUNKS_STREAMED: 'no-chunks-streamed',
  CHUNKS_NOT_WRITTEN: 'chunks-streamed-not-written',
  CANCELLED: 'cancelled'
};

const FAILURE_MESSAGES = {
  [FAILURE_CAUSES.ENVIRONMENT_UNAVAILABLE]:
    'This machine cannot provide something the run genuinely needs (Docker, a Java runtime, network access for the first download, or the world-downloader jar). The run stopped before it could exercise anything.',
  [FAILURE_CAUSES.SERVER_NOT_READY]:
    'The Minecraft server process never printed its ready line within the timeout (or exited first). No proxy, bot or chunk saving was attempted.',
  [FAILURE_CAUSES.PROXY_NOT_ACCEPTING]:
    "The world-downloader proxy never reported it was listening (its \"Starting proxy for ...\" line never appeared, or it exited first). The server was ready, but nothing downstream of it was exercised.",
  [FAILURE_CAUSES.BOT_NOT_CONNECTED]:
    'The bot process ended without ever logging in through the proxy (no login/spawn was observed). The proxy was listening, but the protocol path itself was never exercised.',
  [FAILURE_CAUSES.NO_CHUNKS_STREAMED]:
    'The bot connected and moved, but the proxy never reported any chunk activity. The protocol handshake worked; chunk delivery did not.',
  [FAILURE_CAUSES.CHUNKS_NOT_WRITTEN]:
    'Chunks were streamed to the client (the proxy logged activity, the bot walked its route), but reading the region files back on disk found zero, or far fewer than expected, saved chunks. Delivery worked; saving did not.',
  [FAILURE_CAUSES.CANCELLED]: 'The run was cancelled before it reached a verdict.'
};

/**
 * Builds a report object naming exactly which stage was reached, and — for a
 * failing run — exactly one of the five distinct causes above rather than a
 * generic failure.
 */
function buildVerdict({ reachedStage, cause, detail }) {
  const stageIndex = STAGES.indexOf(reachedStage);
  return {
    ok: cause === undefined || cause === null,
    reachedStage: reachedStage ?? null,
    reachedStageIndex: stageIndex,
    cause: cause ?? null,
    message: cause ? FAILURE_MESSAGES[cause] ?? String(cause) : 'The run reached its final stage and verified the world on disk.',
    detail: detail ?? null
  };
}

module.exports = { STAGES, FAILURE_CAUSES, FAILURE_MESSAGES, buildVerdict };
