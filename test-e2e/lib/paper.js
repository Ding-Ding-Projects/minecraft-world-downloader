'use strict';
/*
 * Brings up a real Minecraft server for the bot to connect through the proxy
 * to. Two routes, tried in this order:
 *
 *   1. Docker (`docker run` of the well-known `itzg/minecraft-server` image,
 *      the same generic Docker route the rest of this repository already
 *      leans on for the downloader and BlueMap containers).
 *   2. A downloaded PaperMC server jar, run directly with the Java runtime
 *      this machine already has, when Docker is not available.
 *
 * Neither route sleeps a guessed number of seconds and calls that "ready": both
 * parse the server's own log for its real ready line
 * (`Done (12.345s)! For help, type "help"`), which is what Vanilla, Spigot and
 * Paper all print once the world has finished loading and the server is
 * genuinely accepting connections.
 */

const { spawn } = require('node:child_process');
const https = require('node:https');
const crypto = require('node:crypto');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');

const READY_LINE = /Done \(([\d.]+)s\)!\s*For help/i;
const FAILURE_LINES = [
  /Failed to start the minecraft server/i,
  /java\.lang\.OutOfMemoryError/i,
  /Exception in thread "main"/i,
  /\*\*\*\* FAILED TO BIND TO PORT/i,
  /server\.properties.*could not/i
];

const PAPER_API_HOST = 'fill.papermc.io';
const PAPER_DATA_HOST = 'fill-data.papermc.io';

/* ------------------------------------------------------------------ */
/* Small HTTPS helpers (no dependency: this harness runs before `npm    */
/* install` can be assumed for anything beyond what scraper/ needs).    */
/* ------------------------------------------------------------------ */

function httpsGetJson(host, urlPath, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const req = https.get({ host, path: urlPath, headers: { 'user-agent': 'mcwd-e2e-harness' }, timeout: timeoutMs }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`GET https://${host}${urlPath} -> HTTP ${res.statusCode}`));
        return;
      }
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(new Error(`GET https://${host}${urlPath} returned non-JSON: ${error.message}`));
        }
      });
    });
    req.on('timeout', () => req.destroy(new Error(`GET https://${host}${urlPath} timed out after ${timeoutMs}ms`)));
    req.on('error', reject);
  });
}

function httpsDownload(url, destPath, timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { headers: { 'user-agent': 'mcwd-e2e-harness' }, timeout: timeoutMs }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`GET ${url} -> HTTP ${res.statusCode}`));
        return;
      }
      const file = fs.createWriteStream(destPath);
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve()));
      file.on('error', reject);
    });
    request.on('timeout', () => request.destroy(new Error(`Download of ${url} timed out after ${timeoutMs}ms`)));
    request.on('error', reject);
  });
}

async function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  const stream = fs.createReadStream(filePath);
  await new Promise((resolve, reject) => {
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', resolve);
    stream.on('error', reject);
  });
  return hash.digest('hex');
}

/* ------------------------------------------------------------------ */
/* Docker availability                                                 */
/* ------------------------------------------------------------------ */

function run(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { ...options, shell: false });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (chunk) => (stdout += chunk));
    child.stderr?.on('data', (chunk) => (stderr += chunk));
    child.on('error', (error) => resolve({ ok: false, code: null, stdout, stderr, error: error.message }));
    child.on('exit', (code) => resolve({ ok: code === 0, code, stdout, stderr, error: null }));
  });
}

/** Real availability check: the daemon must actually answer, not just the CLI exist. */
async function checkDockerAvailable() {
  const result = await run('docker', ['version', '--format', '{{.Server.Version}}']);
  if (!result.ok) {
    return { available: false, reason: (result.error || result.stderr || 'docker did not report a server version').trim() };
  }
  return { available: true, serverVersion: result.stdout.trim() };
}

/* ------------------------------------------------------------------ */
/* PaperMC "Fill" v3 API — resolving and downloading a real server jar */
/* ------------------------------------------------------------------ */

/** Resolves the latest build for a Paper version and returns its download info. */
async function resolveLatestPaperBuild(version) {
  const build = await httpsGetJson(PAPER_API_HOST, `/v3/projects/paper/versions/${encodeURIComponent(version)}/builds/latest`);
  const download = build?.downloads?.['server:default'];
  if (!download || !download.url || !download.name || !download.checksums?.sha256) {
    throw new Error(`PaperMC's build metadata for ${version} did not include a server:default download.`);
  }
  return { buildId: build.id, name: download.name, url: download.url, sha256: download.checksums.sha256, sizeBytes: download.size };
}

/**
 * Downloads (and sha256-verifies) the Paper server jar for one version into
 * `cacheDir`, reusing a previously-downloaded jar whose checksum still
 * matches rather than re-fetching it.
 */
async function ensurePaperJar(version, cacheDir) {
  await fsp.mkdir(cacheDir, { recursive: true });
  const build = await resolveLatestPaperBuild(version);
  const destPath = path.join(cacheDir, build.name);

  if (fs.existsSync(destPath)) {
    const existingHash = await sha256File(destPath);
    if (existingHash === build.sha256) {
      return { jarPath: destPath, build, reused: true };
    }
  }

  await httpsDownload(build.url, destPath);
  const downloadedHash = await sha256File(destPath);
  if (downloadedHash !== build.sha256) {
    await fsp.rm(destPath, { force: true });
    throw new Error(
      `Downloaded ${build.name} does not match its published sha256 (expected ${build.sha256}, got ${downloadedHash}). Deleted the bad download.`
    );
  }
  return { jarPath: destPath, build, reused: false };
}

/* ------------------------------------------------------------------ */
/* Watching a server's log for the real ready line                     */
/* ------------------------------------------------------------------ */

/**
 * Attaches a line watcher to a readable stream and resolves as soon as the
 * ready line appears, rejects on a recognised failure line or on the process
 * exiting first, and rejects on a timeout. Never resolves from elapsed time
 * alone.
 */
function watchForReady(child, { timeoutMs, onLine }) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let buffer = '';
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn(value);
    };

    const feed = (chunk) => {
      buffer += chunk.toString('utf8');
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        onLine?.(line);
        if (READY_LINE.test(line)) {
          finish(resolve, { readyLine: line.trim() });
          return;
        }
        for (const pattern of FAILURE_LINES) {
          if (pattern.test(line)) {
            finish(reject, new Error(`The server logged a fatal-looking line before it became ready: "${line.trim()}"`));
            return;
          }
        }
      }
    };

    child.stdout?.on('data', feed);
    child.stderr?.on('data', feed);
    child.on('exit', (code, signal) =>
      finish(reject, new Error(`The server process exited (code ${code}, signal ${signal ?? 'none'}) before it printed a ready line.`))
    );
    child.on('error', (error) => finish(reject, new Error(`Could not run the server process: ${error.message}`)));

    const timer = setTimeout(
      () => finish(reject, new Error(`The server did not print its ready line within ${timeoutMs}ms.`)),
      timeoutMs
    );
  });
}

/* ------------------------------------------------------------------ */
/* Route 2: a downloaded jar, run directly                             */
/* ------------------------------------------------------------------ */

async function startServerJar({ javaCommand, jarPath, workDir, port, memoryMb, readyTimeoutMs, onLine }) {
  await fsp.mkdir(workDir, { recursive: true });
  await fsp.writeFile(path.join(workDir, 'eula.txt'), 'eula=true\n', 'utf8');
  const properties = [
    'online-mode=false',
    `server-port=${port}`,
    'server-ip=127.0.0.1',
    'motd=mcwd end-to-end harness',
    'level-type=flat',
    'generate-structures=false',
    'spawn-protection=0',
    'view-distance=6',
    'simulation-distance=6',
    'enable-command-block=false',
    'white-list=false'
  ].join('\n');
  await fsp.writeFile(path.join(workDir, 'server.properties'), properties + '\n', 'utf8');

  const child = spawn(
    javaCommand,
    [`-Xms${Math.floor(memoryMb / 2)}M`, `-Xmx${memoryMb}M`, '-jar', jarPath, '--nogui'],
    { cwd: workDir, shell: false }
  );

  let ready;
  try {
    ready = await watchForReady(child, { timeoutMs: readyTimeoutMs, onLine });
  } catch (error) {
    try {
      child.kill();
    } catch {
      /* already gone */
    }
    throw error;
  }

  return {
    kind: 'jar',
    readyLine: ready.readyLine,
    stop: async () => {
      await new Promise((resolve) => {
        child.once('exit', () => resolve());
        try {
          child.kill();
        } catch {
          resolve();
        }
        setTimeout(resolve, 8000);
      });
    }
  };
}

/* ------------------------------------------------------------------ */
/* Route 1: Docker                                                     */
/* ------------------------------------------------------------------ */

async function startServerDocker({ containerName, hostPort, version, dataDir, memoryMb, readyTimeoutMs, onLine }) {
  await fsp.mkdir(dataDir, { recursive: true });
  await run('docker', ['rm', '-f', containerName]); // best-effort: clear a stale container from a prior aborted run

  const runResult = await run('docker', [
    'run',
    '-d',
    '--name',
    containerName,
    '-p',
    `${hostPort}:25565`,
    '-e',
    'EULA=TRUE',
    '-e',
    'ONLINE_MODE=FALSE',
    '-e',
    'TYPE=PAPER',
    '-e',
    `VERSION=${version}`,
    '-e',
    `MEMORY=${memoryMb}M`,
    '-e',
    'ENABLE_COMMAND_BLOCK=FALSE',
    '-v',
    `${dataDir}:/data`,
    'itzg/minecraft-server'
  ]);
  if (!runResult.ok) {
    throw new Error(`"docker run" of itzg/minecraft-server failed: ${(runResult.stderr || runResult.error || '').trim()}`);
  }

  const logs = spawn('docker', ['logs', '-f', containerName], { shell: false });
  let ready;
  try {
    ready = await watchForReady(logs, { timeoutMs: readyTimeoutMs, onLine });
  } catch (error) {
    try {
      logs.kill();
    } catch {
      /* already gone */
    }
    await run('docker', ['rm', '-f', containerName]);
    throw error;
  }

  return {
    kind: 'docker',
    readyLine: ready.readyLine,
    stop: async () => {
      try {
        logs.kill();
      } catch {
        /* already gone */
      }
      await run('docker', ['rm', '-f', containerName]);
    }
  };
}

module.exports = {
  READY_LINE,
  checkDockerAvailable,
  resolveLatestPaperBuild,
  ensurePaperJar,
  startServerJar,
  startServerDocker,
  sha256File
};
