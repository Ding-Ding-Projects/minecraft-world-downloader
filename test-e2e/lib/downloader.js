'use strict';
/*
 * Starts `world-downloader.jar` as a proxy in front of the real server
 * brought up by `paper.js`, and reads its own stdout for the lines it prints
 * when it is genuinely listening, when a client logs in, and when a client
 * disconnects.
 *
 * These regular expressions mirror the ones the desktop application's own
 * session reader uses (`app/src/renderer/features/downloader/session.ts`) —
 * this harness watches the exact same jar output the application does, so a
 * change to one without the other is a real behavioural drift, not a
 * cosmetic difference between two logs that happen to look similar.
 */

const { spawn } = require('node:child_process');
const fsp = require('node:fs/promises');

const PROXY_LINE = /^Starting proxy for (.+?)\. Make sure to connect to localhost:(\d+)/;
const PROTOCOL_LINE = /^Using protocol of game version (\S+) \((\d+)\)/;
const LOGIN_LINE = /^Login success: (\S+) logged in with uuid (\S+)/;
const DISCONNECT_LINE = /^\[disconnect\]\s*(.*)$/;

/**
 * @param {{
 *   javaCommand: string, jarPath: string, serverHost: string, serverPort: number,
 *   localPort: number, outputDir: string, workDir: string, readyTimeoutMs: number,
 *   onLine?: (line: string, stream: 'stdout'|'stderr') => void
 * }} options
 */
async function startDownloaderProxy(options) {
  const { javaCommand, jarPath, serverHost, serverPort, localPort, outputDir, workDir, readyTimeoutMs, onLine } = options;
  await fsp.mkdir(workDir, { recursive: true });
  await fsp.mkdir(outputDir, { recursive: true });

  const args = [
    '-jar',
    jarPath,
    '--server',
    `${serverHost}:${serverPort}`,
    '--local-port',
    String(localPort),
    '--output',
    outputDir,
    '--no-gui',
    '--disable-mark-unsaved',
    '--disable-srv-lookup'
  ];

  const child = spawn(javaCommand, args, { cwd: workDir, shell: false });

  const status = {
    proxyTarget: null,
    localPort: null,
    gameVersion: null,
    protocolVersion: null,
    loggedInAccounts: [],
    lastDisconnectReason: null,
    chunkActivityObserved: false
  };

  const listening = new Promise((resolve, reject) => {
    let settled = false;
    let buffer = { stdout: '', stderr: '' };
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn(value);
    };

    const feed = (stream) => (chunk) => {
      buffer[stream] += chunk.toString('utf8');
      const lines = buffer[stream].split(/\r?\n/);
      buffer[stream] = lines.pop() ?? '';
      for (const raw of lines) {
        const line = raw.trim();
        onLine?.(line, stream);
        interpret(line, status);
        if (status.proxyTarget !== null && !settled) finish(resolve, { line });
      }
    };

    child.stdout.on('data', feed('stdout'));
    child.stderr.on('data', feed('stderr'));
    child.on('exit', (code, signal) =>
      finish(reject, new Error(`The downloader jar exited (code ${code}, signal ${signal ?? 'none'}) before it reported it was listening.`))
    );
    child.on('error', (error) => finish(reject, new Error(`Could not run the downloader jar: ${error.message}`)));

    const timer = setTimeout(
      () => finish(reject, new Error(`The downloader jar did not report it was listening within ${readyTimeoutMs}ms.`)),
      readyTimeoutMs
    );
  });

  // Keep watching after the initial "listening" resolution, for login/chunk activity.
  const extraFeed = (stream) => {
    let buffer = '';
    return (chunk) => {
      buffer += chunk.toString('utf8');
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';
      for (const raw of lines) {
        interpret(raw.trim(), status);
      }
    };
  };
  child.stdout.on('data', extraFeed('stdout'));
  child.stderr.on('data', extraFeed('stderr'));

  let listenResult;
  try {
    listenResult = await listening;
  } catch (error) {
    try {
      child.kill();
    } catch {
      /* already gone */
    }
    throw error;
  }

  return {
    readyLine: listenResult.line,
    status,
    stop: async () => {
      await new Promise((resolve) => {
        child.once('exit', () => resolve());
        try {
          child.kill();
        } catch {
          resolve();
        }
        setTimeout(resolve, 10000);
      });
    }
  };
}

function interpret(line, status) {
  if (line === '') return;

  const proxy = PROXY_LINE.exec(line);
  if (proxy) {
    status.proxyTarget = proxy[1];
    status.localPort = Number(proxy[2]);
    return;
  }
  const protocol = PROTOCOL_LINE.exec(line);
  if (protocol) {
    status.gameVersion = protocol[1];
    status.protocolVersion = Number(protocol[2]);
    return;
  }
  const login = LOGIN_LINE.exec(line);
  if (login) {
    status.loggedInAccounts.push({ username: login[1], uuid: login[2], at: new Date().toISOString() });
    return;
  }
  const disconnect = DISCONNECT_LINE.exec(line);
  if (disconnect) {
    status.lastDisconnectReason = disconnect[1] || null;
    return;
  }
  if (/Saving chunk|saved chunk|Received chunk|chunk data/i.test(line)) {
    status.chunkActivityObserved = true;
  }
}

module.exports = { startDownloaderProxy, PROXY_LINE, PROTOCOL_LINE, LOGIN_LINE, DISCONNECT_LINE };
