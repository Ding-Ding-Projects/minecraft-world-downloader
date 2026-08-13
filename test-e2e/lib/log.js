'use strict';
/*
 * Structured progress reporting.
 *
 * Every stage transition is printed twice: once as a line a person reads
 * (stderr, timestamped, human words), and once as a single-line JSON object on
 * stdout (`STAGE {...}\n`) that a machine — the desktop application's own
 * "watch a run" surface, or a CI script — can parse without scraping prose.
 * The two are never allowed to disagree, because they are built from the same
 * call.
 */

function nowIso() {
  return new Date().toISOString();
}

function makeReporter(runId) {
  return {
    runId,
    stage(name, extra = {}) {
      const event = { kind: 'stage', runId, stage: name, at: nowIso(), ...extra };
      process.stderr.write(`[${event.at}] [${runId}] stage: ${name}${extra.detail ? ' — ' + extra.detail : ''}\n`);
      process.stdout.write('STAGE ' + JSON.stringify(event) + '\n');
      return event;
    },
    progress(name, done, total, extra = {}) {
      const event = { kind: 'progress', runId, stage: name, done, total, at: nowIso(), ...extra };
      process.stderr.write(`[${event.at}] [${runId}] ${name}: ${done}/${total}\n`);
      process.stdout.write('PROGRESS ' + JSON.stringify(event) + '\n');
      return event;
    },
    note(text) {
      process.stderr.write(`[${nowIso()}] [${runId}] ${text}\n`);
    },
    result(verdict, extra = {}) {
      const event = { kind: 'result', runId, at: nowIso(), verdict, ...extra };
      process.stderr.write(`[${event.at}] [${runId}] result: ${verdict.ok ? 'PASS' : 'FAIL'} (${verdict.reachedStage ?? 'no stage reached'}${verdict.cause ? ', cause: ' + verdict.cause : ''})\n`);
      process.stdout.write('RESULT ' + JSON.stringify(event) + '\n');
      return event;
    }
  };
}

module.exports = { makeReporter, nowIso };
