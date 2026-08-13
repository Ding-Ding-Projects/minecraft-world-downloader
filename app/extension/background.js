/**
 * The capture service worker.
 *
 * One job: when the browser starts a download that matches the user's rules,
 * offer it to World Downloader Studio first. The handover is posted BEFORE the
 * browser download is cancelled, so a receiver that is not listening leaves the
 * browser's own download running rather than losing it.
 */

import { readConfig, shouldCapture } from './config.js';

const HANDOFF_TIMEOUT_MS = 4000;
const RECENT_LIMIT = 25;

/** Newest first. Survives only for the life of the service worker. */
let recent = [];

async function loadRecent() {
  const stored = await chrome.storage.session.get('recent');
  recent = Array.isArray(stored.recent) ? stored.recent : [];
}

async function remember(entry) {
  recent = [entry, ...recent].slice(0, RECENT_LIMIT);
  await chrome.storage.session.set({ recent });
}

function endpointOf(config, path) {
  return `${String(config.endpoint).replace(/\/+$/, '')}${path}`;
}

/** Posts one JSON document to the application's loopback receiver. */
async function post(config, path, payload) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HANDOFF_TIMEOUT_MS);
  try {
    const response = await fetch(endpointOf(config, path), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-studio-token': config.token
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'error'
    });
    const text = await response.text();
    let parsed = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = null;
    }
    if (!response.ok) {
      return {
        ok: false,
        error:
          parsed && typeof parsed.error === 'string'
            ? parsed.error
            : `The receiver answered ${response.status} ${response.statusText || ''}`.trim()
      };
    }
    return { ok: true, value: parsed };
  } catch (error) {
    const message =
      error && error.name === 'AbortError'
        ? `No answer from ${config.endpoint} within ${HANDOFF_TIMEOUT_MS} ms.`
        : `Could not reach ${config.endpoint}: ${error && error.message ? error.message : String(error)}`;
    return { ok: false, error: message };
  }
}

/** Asks the receiver whether it is listening and whether the token is accepted. */
export async function checkConnection(config) {
  const result = await post(config, '/health', { probe: 'extension' });
  if (!result.ok) return result;
  const value = result.value ?? {};
  return {
    ok: true,
    value: {
      product: typeof value.product === 'string' ? value.product : 'unknown',
      protocol: typeof value.protocol === 'number' ? value.protocol : 0,
      queued: typeof value.queued === 'number' ? value.queued : 0
    }
  };
}

function describe(item) {
  const url = String(item.finalUrl || item.url || '');
  let suggested = '';
  if (typeof item.filename === 'string' && item.filename) {
    suggested = item.filename.split(/[\\/]/).pop() ?? '';
  }
  if (!suggested) {
    try {
      suggested = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '');
    } catch {
      suggested = '';
    }
  }
  return {
    protocol: 1,
    source: 'browser-extension',
    url,
    referrer: String(item.referrer || ''),
    suggestedFilename: suggested,
    mimeType: String(item.mime || ''),
    totalBytes: Number.isFinite(item.fileSize) && item.fileSize > 0 ? item.fileSize : null,
    capturedAt: new Date().toISOString(),
    browserDownloadId: typeof item.id === 'number' ? item.id : null
  };
}

/** Cancels and erases the browser's own copy once the application has the capture. */
async function standDownBrowser(id) {
  try {
    await chrome.downloads.cancel(id);
  } catch {
    /* already finished or already cancelled: nothing more to do */
  }
  try {
    await chrome.downloads.erase({ id });
  } catch {
    /* the shelf entry is cosmetic; failing to erase it is not a failure */
  }
}

async function handleCreated(item) {
  const config = await readConfig();
  const verdict = shouldCapture(item, config);
  if (!verdict.capture) {
    await remember({
      at: new Date().toISOString(),
      url: String(item.finalUrl || item.url || ''),
      outcome: 'left to the browser',
      detail: verdict.reason
    });
    return;
  }

  const capture = describe(item);
  const handed = await post(config, '/capture', capture);
  if (!handed.ok) {
    await remember({
      at: capture.capturedAt,
      url: capture.url,
      outcome: config.keepBrowserDownloadOnFailure ? 'left to the browser' : 'failed',
      detail: handed.error
    });
    return;
  }

  await standDownBrowser(item.id);
  await remember({
    at: capture.capturedAt,
    url: capture.url,
    outcome: 'handed to the application',
    detail: 'The application decides what happens next; nothing transfers until somebody confirms it there.'
  });
}

chrome.downloads.onCreated.addListener((item) => {
  void handleCreated(item);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message !== 'object') return false;
  if (message.kind === 'check-connection') {
    void (async () => {
      const config = message.config ?? (await readConfig());
      sendResponse(await checkConnection(config));
    })();
    return true;
  }
  if (message.kind === 'recent') {
    void (async () => {
      await loadRecent();
      sendResponse({ ok: true, value: recent });
    })();
    return true;
  }
  return false;
});

void loadRecent();
