'use strict';

/*
 * The download capture receiver and transfer engine.
 *
 * This file is not part of the renderer bundle's executable code. It is
 * imported as raw text, written into the application's own data directory and
 * run by `node` through the privileged process bridge, because the renderer
 * cannot open a socket and cannot write bytes to disk as they arrive.
 *
 * It does two things and nothing else:
 *
 *   1. Listens on ONE loopback address for the browser extension's captures.
 *      Every request must carry the pairing token the application generated for
 *      this session. Nothing else is served, no directory is exposed, and the
 *      destination path of a transfer is never taken from the request — the
 *      application decides that, after asking the user.
 *
 *   2. Performs the transfers the application asks for, reporting the real byte
 *      count, the real rate and the real state. Pause is a destroyed socket and
 *      a retained partial file; resume is a fresh request carrying a Range
 *      header. Nothing here simulates progress.
 *
 * Protocol: newline-delimited JSON both ways. Commands arrive on stdin, events
 * leave on stdout with a sentinel prefix so a stray runtime warning on the same
 * stream can never be mistaken for an event.
 */

const http = require('node:http');
const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const PROTOCOL = 1;
const SENTINEL = '@WDS-BRIDGE-1@';
const MAX_REQUEST_BYTES = 64 * 1024;
const MAX_REDIRECTS = 5;
const PROGRESS_INTERVAL_MS = 250;
const READ_TIMEOUT_MS = 60_000;

let token = '';
let productName = 'World Downloader Studio';
let server = null;
let listeningPort = 0;
let capturesReceived = 0;

/** Captures the application has not yet resolved through its Start dialog. */
const unresolved = new Set();

/** Every transfer this process knows about, by the application's own id. */
const jobs = new Map();

/* ------------------------------------------------------------------ */
/* Event plumbing                                                      */
/* ------------------------------------------------------------------ */

function emit(event) {
  try {
    process.stdout.write(SENTINEL + JSON.stringify(event) + '\n');
  } catch (error) {
    /* the parent has gone; there is nowhere left to report anything */
  }
}

function describeError(error) {
  if (!error) return 'The operation failed without reporting a reason.';
  if (error.code === 'ENOSPC') return 'The destination drive is full.';
  if (error.code === 'EACCES' || error.code === 'EPERM') {
    return 'Permission was refused for the destination path.';
  }
  if (error.code === 'ENOENT') return 'The destination folder does not exist.';
  if (error.code === 'ENOTFOUND') return 'The host name could not be resolved.';
  if (error.code === 'ECONNREFUSED') return 'The connection was refused by the server.';
  if (error.code === 'ECONNRESET') return 'The connection was reset by the server.';
  if (error.code === 'ETIMEDOUT') return 'The connection timed out.';
  return String(error.message || error);
}

/* ------------------------------------------------------------------ */
/* The loopback receiver                                               */
/* ------------------------------------------------------------------ */

function tokenMatches(candidate) {
  if (typeof candidate !== 'string' || token.length === 0) return false;
  const left = Buffer.from(candidate, 'utf8');
  const right = Buffer.from(token, 'utf8');
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function respond(response, status, payload, origin) {
  const body = JSON.stringify(payload);
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'content-length': String(Buffer.byteLength(body)),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff'
  };
  if (origin) {
    headers['access-control-allow-origin'] = origin;
    headers['access-control-allow-headers'] = 'content-type, x-studio-token';
    headers['access-control-allow-methods'] = 'POST, OPTIONS';
    headers['access-control-max-age'] = '600';
    headers.vary = 'Origin';
  }
  response.writeHead(status, headers);
  response.end(body);
}

/**
 * Only a browser extension may talk to this receiver, and only from this
 * machine. A page origin is refused outright, so a web page the user happens to
 * have open cannot post captures at it even if it somehow learned the token.
 */
function allowedOrigin(request) {
  const origin = request.headers.origin;
  if (typeof origin !== 'string' || origin.length === 0) return null;
  if (/^(chrome-extension|moz-extension|extension|safari-web-extension):\/\/[a-z0-9-]+$/i.test(origin)) {
    return origin;
  }
  return null;
}

function readBody(request) {
  return new Promise(function (resolve, reject) {
    let size = 0;
    const chunks = [];
    request.on('data', function (chunk) {
      size += chunk.length;
      if (size > MAX_REQUEST_BYTES) {
        reject(new Error('The request body exceeded ' + MAX_REQUEST_BYTES + ' bytes.'));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', function () {
      resolve(Buffer.concat(chunks).toString('utf8'));
    });
    request.on('error', reject);
  });
}

function sanitizeCapture(raw) {
  const url = String(raw.url || '');
  let parsed;
  try {
    parsed = new URL(url);
  } catch (error) {
    return { ok: false, error: 'The capture did not carry a usable URL.' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, error: 'Only http and https downloads can be captured.' };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, error: 'A URL carrying embedded credentials is refused.' };
  }
  const total = Number(raw.totalBytes);
  return {
    ok: true,
    value: {
      captureId: crypto.randomUUID(),
      url: parsed.toString(),
      host: parsed.hostname,
      referrer: typeof raw.referrer === 'string' ? raw.referrer.slice(0, 2048) : '',
      // A filename is a suggestion only. The application decides the real
      // destination; nothing from the browser is ever used as a path.
      suggestedFilename: String(raw.suggestedFilename || '').slice(0, 255),
      mimeType: String(raw.mimeType || '').slice(0, 200),
      totalBytes: Number.isFinite(total) && total > 0 ? total : null,
      capturedAt: new Date().toISOString(),
      source: String(raw.source || 'browser-extension').slice(0, 60)
    }
  };
}

function handleRequest(request, response) {
  const origin = allowedOrigin(request);

  if (request.method === 'OPTIONS') {
    if (!origin) {
      respond(response, 403, { error: 'Only a browser extension origin may reach this receiver.' }, null);
      return;
    }
    respond(response, 204, {}, origin);
    return;
  }

  if (request.method !== 'POST') {
    respond(response, 405, { error: 'Only POST is accepted.' }, origin);
    return;
  }

  if (!tokenMatches(request.headers['x-studio-token'])) {
    // Deliberately uninformative: a wrong token learns nothing about the right
    // one, not its length and not how close it was.
    respond(response, 401, { error: 'The pairing token was not accepted.' }, origin);
    return;
  }

  const url = String(request.url || '').split('?')[0];

  if (url === '/health') {
    respond(
      response,
      200,
      { product: productName, protocol: PROTOCOL, queued: unresolved.size, transfers: jobs.size },
      origin
    );
    return;
  }

  if (url !== '/capture') {
    respond(response, 404, { error: 'No such endpoint.' }, origin);
    return;
  }

  readBody(request).then(
    function (text) {
      let raw;
      try {
        raw = JSON.parse(text);
      } catch (error) {
        respond(response, 400, { error: 'The request body was not valid JSON.' }, origin);
        return;
      }
      const checked = sanitizeCapture(raw && typeof raw === 'object' ? raw : {});
      if (!checked.ok) {
        respond(response, 400, { error: checked.error }, origin);
        return;
      }
      capturesReceived += 1;
      unresolved.add(checked.value.captureId);
      emit({ type: 'capture', capture: checked.value });
      respond(response, 200, { accepted: true, captureId: checked.value.captureId }, origin);
    },
    function (error) {
      respond(response, 413, { error: describeError(error) }, origin);
    }
  );
}

function startServer(port) {
  if (server) {
    try {
      server.close();
    } catch (error) {
      /* it was already closing */
    }
    server = null;
  }
  const next = http.createServer(handleRequest);
  next.on('error', function (error) {
    emit({
      type: 'listen-error',
      port: port,
      message:
        error && error.code === 'EADDRINUSE'
          ? 'Port ' + port + ' on 127.0.0.1 is already in use by something else.'
          : describeError(error)
    });
  });
  next.listen(port, '127.0.0.1', function () {
    const address = next.address();
    listeningPort = address && typeof address === 'object' ? address.port : port;
    server = next;
    emit({ type: 'listening', port: listeningPort });
  });
}

/* ------------------------------------------------------------------ */
/* Transfers                                                           */
/* ------------------------------------------------------------------ */

function filenameFromDisposition(value) {
  if (typeof value !== 'string') return '';
  const star = /filename\*\s*=\s*([^']*)'[^']*'([^;]+)/i.exec(value);
  if (star) {
    try {
      return decodeURIComponent(star[2].trim());
    } catch (error) {
      return star[2].trim();
    }
  }
  const plain = /filename\s*=\s*"?([^";]+)"?/i.exec(value);
  return plain ? plain[1].trim() : '';
}

function agentFor(url) {
  return url.protocol === 'https:' ? https : http;
}

function requestOptions(url, headers) {
  return {
    protocol: url.protocol,
    hostname: url.hostname,
    port: url.port || (url.protocol === 'https:' ? 443 : 80),
    path: url.pathname + url.search,
    method: 'GET',
    headers: headers
  };
}

function uniqueDestination(destination) {
  if (!fs.existsSync(destination)) return destination;
  const directory = path.dirname(destination);
  const base = path.basename(destination);
  const dot = base.lastIndexOf('.');
  const stem = dot > 0 ? base.slice(0, dot) : base;
  const suffix = dot > 0 ? base.slice(dot) : '';
  for (let index = 2; index < 10_000; index += 1) {
    const candidate = path.join(directory, stem + ' (' + index + ')' + suffix);
    if (!fs.existsSync(candidate)) return candidate;
  }
  throw new Error('Could not find an unused name beside ' + destination + '.');
}

function emitJobState(job, extra) {
  const event = {
    type: 'state',
    id: job.id,
    state: job.state,
    received: job.received,
    total: job.total,
    destination: job.destination,
    partPath: job.partPath,
    startedAt: job.startedAt,
    updatedAt: new Date().toISOString(),
    resumable: job.acceptsRanges === true
  };
  if (extra) Object.assign(event, extra);
  emit(event);
}

function emitProgress(job, force) {
  const now = Date.now();
  if (!force && now - job.lastProgressAt < PROGRESS_INTERVAL_MS) return;
  // A stalled transfer emits nothing rather than repeating the same numbers.
  // The parent retains this stream up to a hard ceiling and stops relaying it
  // once that is reached, so every avoidable line costs live reporting later.
  if (!force && job.received === job.lastEmittedReceived) return;
  job.lastEmittedReceived = job.received;
  const elapsed = (now - job.sampleAt) / 1000;
  if (elapsed > 0) {
    const instant = (job.received - job.sampleBytes) / elapsed;
    // A short exponential average: an instantaneous rate on a 250 ms window
    // jitters far too much to read, and a whole-transfer average hides a stall.
    job.rate = job.rate === 0 ? instant : job.rate * 0.7 + instant * 0.3;
    job.sampleAt = now;
    job.sampleBytes = job.received;
  }
  job.lastProgressAt = now;
  const remaining = job.total !== null ? Math.max(0, job.total - job.received) : null;
  emit({
    type: 'progress',
    id: job.id,
    received: job.received,
    total: job.total,
    bytesPerSecond: Math.max(0, Math.round(job.rate)),
    etaSeconds: remaining !== null && job.rate > 1 ? Math.round(remaining / job.rate) : null,
    state: job.state
  });
}

function finish(job, error) {
  if (job.finished) return;
  job.finished = true;
  if (job.timer) {
    clearInterval(job.timer);
    job.timer = null;
  }
  const closeFile = function (next) {
    if (!job.file) {
      next();
      return;
    }
    const file = job.file;
    job.file = null;
    file.end(function () {
      next();
    });
  };

  closeFile(function () {
    if (error) {
      job.state = 'failed';
      emitJobState(job, { error: describeError(error) });
      return;
    }
    if (job.state === 'paused') {
      emitJobState(job, { note: 'The partial file is kept so the transfer can be resumed.' });
      return;
    }
    if (job.state === 'cancelled') {
      if (job.deletePartial) {
        try {
          if (fs.existsSync(job.partPath)) fs.unlinkSync(job.partPath);
        } catch (unlinkError) {
          emitJobState(job, { note: 'The partial file could not be removed: ' + describeError(unlinkError) });
          return;
        }
      }
      emitJobState(job, {
        note: job.deletePartial
          ? 'The partial file was removed.'
          : 'The partial file was kept at ' + job.partPath + '.'
      });
      return;
    }

    // Completed. The final rename is the moment the file becomes real.
    let finalPath = job.destination;
    try {
      fs.mkdirSync(path.dirname(finalPath), { recursive: true });
      if (!job.overwrite) finalPath = uniqueDestination(finalPath);
      fs.renameSync(job.partPath, finalPath);
    } catch (renameError) {
      job.state = 'failed';
      emitJobState(job, { error: describeError(renameError) });
      return;
    }
    job.destination = finalPath;
    job.state = 'completed';
    let sizeOnDisk = job.received;
    try {
      sizeOnDisk = fs.statSync(finalPath).size;
    } catch (statError) {
      /* the rename succeeded, so the reported byte count stands */
    }
    emitJobState(job, { finishedAt: new Date().toISOString(), bytesOnDisk: sizeOnDisk });
  });
}

function connect(job, target, redirectsLeft) {
  let url;
  try {
    url = new URL(target);
  } catch (error) {
    finish(job, new Error('"' + target + '" is not a usable URL.'));
    return;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    finish(job, new Error('Only http and https transfers are performed; ' + url.protocol + ' was refused.'));
    return;
  }

  const headers = Object.assign({ accept: '*/*' }, job.headers);
  if (job.referrer) headers.referer = job.referrer;
  const rangeFrom = job.received;
  if (rangeFrom > 0) headers.range = 'bytes=' + rangeFrom + '-';

  const request = agentFor(url).request(requestOptions(url, headers));
  job.request = request;

  request.setTimeout(READ_TIMEOUT_MS, function () {
    request.destroy(new Error('The server sent nothing for ' + READ_TIMEOUT_MS / 1000 + ' seconds.'));
  });

  request.on('error', function (error) {
    if (job.state === 'paused' || job.state === 'cancelled') {
      finish(job, null);
      return;
    }
    finish(job, error);
  });

  request.on('response', function (response) {
    const status = response.statusCode || 0;

    if (status >= 300 && status < 400 && response.headers.location) {
      response.resume();
      if (redirectsLeft <= 0) {
        finish(job, new Error('The server redirected more than ' + MAX_REDIRECTS + ' times.'));
        return;
      }
      connect(job, new URL(response.headers.location, url).toString(), redirectsLeft - 1);
      return;
    }

    if (status !== 200 && status !== 206) {
      response.resume();
      finish(job, new Error('The server answered ' + status + ' ' + (response.statusMessage || '') + '.'));
      return;
    }

    job.acceptsRanges =
      status === 206 || String(response.headers['accept-ranges'] || '').toLowerCase().indexOf('bytes') >= 0;

    let appending = false;
    if (rangeFrom > 0) {
      if (status === 206) {
        appending = true;
      } else {
        // The server ignored the Range header, so the body starts from zero and
        // the bytes already on disk are worthless. Saying so is the honest
        // alternative to silently appending a second copy of the file to itself.
        job.received = 0;
        emitJobState(job, {
          note: 'The server ignored the resume request, so the transfer restarted from the beginning.'
        });
      }
    }

    const declared = Number(response.headers['content-length']);
    if (status === 206) {
      const contentRange = /bytes\s+\d+-\d+\/(\d+)/i.exec(String(response.headers['content-range'] || ''));
      if (contentRange) job.total = Number(contentRange[1]);
      else if (Number.isFinite(declared)) job.total = job.received + declared;
    } else if (Number.isFinite(declared) && declared >= 0) {
      job.total = declared;
    }

    const serverName = filenameFromDisposition(response.headers['content-disposition']);
    if (serverName) job.serverFilename = serverName;
    job.contentType = String(response.headers['content-type'] || '');

    try {
      fs.mkdirSync(path.dirname(job.partPath), { recursive: true });
      job.file = fs.createWriteStream(job.partPath, { flags: appending ? 'a' : 'w' });
    } catch (error) {
      response.resume();
      finish(job, error);
      return;
    }

    job.file.on('error', function (error) {
      try {
        response.destroy();
      } catch (destroyError) {
        /* the socket was already gone */
      }
      finish(job, error);
    });

    job.state = 'downloading';
    job.sampleAt = Date.now();
    job.sampleBytes = job.received;
    emitJobState(job, {
      serverFilename: job.serverFilename || null,
      contentType: job.contentType || null
    });
    if (!job.timer) {
      job.timer = setInterval(function () {
        if (job.state === 'downloading') emitProgress(job, false);
      }, PROGRESS_INTERVAL_MS);
    }

    response.on('data', function (chunk) {
      job.received += chunk.length;
      if (job.file && !job.file.write(chunk)) {
        response.pause();
        job.file.once('drain', function () {
          response.resume();
        });
      }
      emitProgress(job, false);
    });

    response.on('aborted', function () {
      if (job.state === 'paused' || job.state === 'cancelled') {
        finish(job, null);
        return;
      }
      finish(job, new Error('The connection was closed by the server before the file finished.'));
    });

    response.on('error', function (error) {
      if (job.state === 'paused' || job.state === 'cancelled') {
        finish(job, null);
        return;
      }
      finish(job, error);
    });

    response.on('end', function () {
      if (job.state === 'paused' || job.state === 'cancelled') {
        finish(job, null);
        return;
      }
      if (job.total !== null && job.received < job.total) {
        finish(
          job,
          new Error(
            'The connection ended after ' + job.received + ' of ' + job.total + ' bytes. The partial file is kept.'
          )
        );
        return;
      }
      emitProgress(job, true);
      job.state = 'completing';
      finish(job, null);
    });
  });

  request.end();
}

function startTransfer(spec) {
  const id = String(spec.id || '');
  if (!id) {
    emit({ type: 'error', message: 'A transfer was requested with no id.' });
    return;
  }
  const existing = jobs.get(id);
  if (existing && (existing.state === 'downloading' || existing.state === 'connecting')) {
    emit({ type: 'error', id: id, message: 'That transfer is already running.' });
    return;
  }

  const destination = String(spec.destination || '');
  if (!path.isAbsolute(destination)) {
    emit({ type: 'error', id: id, message: 'The destination must be an absolute path.' });
    return;
  }

  const partPath = destination + '.wdspart';
  let received = 0;
  if (spec.resume) {
    try {
      const stat = fs.statSync(partPath);
      if (stat.isFile()) received = stat.size;
    } catch (error) {
      received = 0;
    }
  } else {
    try {
      if (fs.existsSync(partPath)) fs.unlinkSync(partPath);
    } catch (error) {
      emit({ type: 'error', id: id, message: describeError(error) });
      return;
    }
  }

  const job = {
    id: id,
    url: String(spec.url || ''),
    referrer: typeof spec.referrer === 'string' ? spec.referrer : '',
    headers: spec.headers && typeof spec.headers === 'object' ? spec.headers : {},
    destination: destination,
    partPath: partPath,
    overwrite: spec.overwrite === true,
    deletePartial: true,
    received: received,
    total: Number.isFinite(spec.totalBytes) && spec.totalBytes > 0 ? Number(spec.totalBytes) : null,
    state: 'connecting',
    startedAt: new Date().toISOString(),
    rate: 0,
    sampleAt: Date.now(),
    sampleBytes: received,
    lastProgressAt: 0,
    lastEmittedReceived: -1,
    acceptsRanges: null,
    serverFilename: '',
    contentType: '',
    request: null,
    file: null,
    timer: null,
    finished: false
  };
  jobs.set(id, job);
  emitJobState(job, { resumedFromBytes: received });
  connect(job, job.url, MAX_REDIRECTS);
}

function pauseTransfer(id) {
  const job = jobs.get(id);
  if (!job) {
    emit({ type: 'error', id: id, message: 'There is no transfer with that id in this session.' });
    return;
  }
  if (job.state !== 'downloading' && job.state !== 'connecting') {
    emit({ type: 'error', id: id, message: 'That transfer is ' + job.state + ', so it cannot be paused.' });
    return;
  }
  job.state = 'paused';
  if (job.timer) {
    clearInterval(job.timer);
    job.timer = null;
  }
  if (job.request) {
    try {
      job.request.destroy();
    } catch (error) {
      /* destroying an already-destroyed request is not an error worth reporting */
    }
  }
}

function cancelTransfer(id, deletePartial) {
  const job = jobs.get(id);
  if (!job) {
    emit({ type: 'error', id: id, message: 'There is no transfer with that id in this session.' });
    return;
  }
  job.deletePartial = deletePartial !== false;
  if (job.state === 'completed' || job.state === 'cancelled') {
    emitJobState(job, { note: 'It was already ' + job.state + '; nothing changed.' });
    return;
  }
  job.state = 'cancelled';
  if (job.timer) {
    clearInterval(job.timer);
    job.timer = null;
  }
  if (job.request) {
    try {
      job.request.destroy();
    } catch (error) {
      /* the socket had already gone */
    }
  } else {
    finish(job, null);
  }
}

function probe(spec) {
  const id = String(spec.id || '');
  let url;
  try {
    url = new URL(String(spec.url || ''));
  } catch (error) {
    emit({ type: 'probe', id: id, ok: false, error: 'That is not a usable URL.' });
    return;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    emit({ type: 'probe', id: id, ok: false, error: 'Only http and https addresses can be inspected.' });
    return;
  }
  const options = requestOptions(url, { accept: '*/*' });
  options.method = 'HEAD';
  const request = agentFor(url).request(options, function (response) {
    response.resume();
    const status = response.statusCode || 0;
    if (status >= 300 && status < 400 && response.headers.location) {
      const next = new URL(response.headers.location, url).toString();
      probe({ id: id, url: next, hops: Number(spec.hops || 0) + 1 });
      return;
    }
    const declared = Number(response.headers['content-length']);
    emit({
      type: 'probe',
      id: id,
      ok: status >= 200 && status < 300,
      status: status,
      url: url.toString(),
      totalBytes: Number.isFinite(declared) && declared >= 0 ? declared : null,
      filename: filenameFromDisposition(response.headers['content-disposition']),
      contentType: String(response.headers['content-type'] || ''),
      acceptsRanges: String(response.headers['accept-ranges'] || '').toLowerCase().indexOf('bytes') >= 0,
      error: status >= 200 && status < 300 ? null : 'The server answered ' + status + '.'
    });
  });
  request.setTimeout(15_000, function () {
    request.destroy(new Error('The server did not answer within 15 seconds.'));
  });
  request.on('error', function (error) {
    emit({ type: 'probe', id: id, ok: false, error: describeError(error) });
  });
  request.end();
}

/* ------------------------------------------------------------------ */
/* Command loop                                                        */
/* ------------------------------------------------------------------ */

function handleCommand(command) {
  switch (command.cmd) {
    case 'configure':
      token = String(command.token || '');
      productName = String(command.productName || productName);
      if (Number.isFinite(command.port)) startServer(Number(command.port));
      return;
    case 'start':
      startTransfer(command);
      return;
    case 'pause':
      pauseTransfer(String(command.id || ''));
      return;
    case 'resume':
      startTransfer(Object.assign({}, command, { resume: true }));
      return;
    case 'cancel':
      cancelTransfer(String(command.id || ''), command.deletePartial !== false);
      return;
    case 'probe':
      probe(command);
      return;
    case 'resolve':
      unresolved.delete(String(command.captureId || ''));
      return;
    case 'forget':
      jobs.delete(String(command.id || ''));
      return;
    case 'ping':
      emit({ type: 'pong', at: new Date().toISOString(), port: listeningPort, transfers: jobs.size });
      return;
    case 'shutdown':
      shutdown();
      return;
    default:
      emit({ type: 'error', message: 'Unknown command "' + String(command.cmd) + '".' });
  }
}

function shutdown() {
  for (const job of jobs.values()) {
    if (job.state === 'downloading' || job.state === 'connecting') {
      job.state = 'paused';
      if (job.request) {
        try {
          job.request.destroy();
        } catch (error) {
          /* nothing left to destroy */
        }
      }
    }
  }
  if (server) {
    try {
      server.close();
    } catch (error) {
      /* it was already closed */
    }
  }
  emit({ type: 'stopping' });
  setTimeout(function () {
    process.exit(0);
  }, 120);
}

let inputBuffer = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', function (chunk) {
  inputBuffer += chunk;
  let newline = inputBuffer.indexOf('\n');
  while (newline >= 0) {
    const line = inputBuffer.slice(0, newline).trim();
    inputBuffer = inputBuffer.slice(newline + 1);
    if (line.length > 0) {
      let parsed = null;
      try {
        parsed = JSON.parse(line);
      } catch (error) {
        emit({ type: 'error', message: 'A command could not be parsed as JSON.' });
      }
      if (parsed && typeof parsed === 'object') {
        try {
          handleCommand(parsed);
        } catch (error) {
          emit({ type: 'error', message: describeError(error) });
        }
      }
    }
    newline = inputBuffer.indexOf('\n');
  }
});
process.stdin.on('end', function () {
  shutdown();
});

process.on('uncaughtException', function (error) {
  emit({ type: 'error', message: 'The receiver hit an unexpected fault: ' + describeError(error) });
});

emit({ type: 'ready', protocol: PROTOCOL, pid: process.pid, node: process.versions.node });
