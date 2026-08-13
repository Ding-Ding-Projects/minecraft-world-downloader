/**
 * The extension's stored configuration, its defaults, and its validation.
 *
 * Everything here is local. The extension talks to exactly one host — a
 * loopback address on this machine — and never to anything else. There is no
 * analytics, no remote asset and no telemetry anywhere in this directory.
 */

export const DEFAULTS = Object.freeze({
  /** Capturing is off until the user has paired the extension with the app. */
  enabled: false,
  /** The application's loopback receiver. Only 127.0.0.1 is accepted. */
  endpoint: 'http://127.0.0.1:43110',
  /** The pairing token shown by the application. Never leaves this machine. */
  token: '',
  /** Downloads smaller than this are left to the browser. 0 captures everything. */
  minimumBytes: 0,
  /**
   * Comma-separated file extensions. When `onlyTheseExtensions` is non-empty
   * only those are captured; anything in `neverTheseExtensions` is always left
   * to the browser, which wins over the include list.
   */
  onlyTheseExtensions: '',
  neverTheseExtensions: '',
  /** Leave the browser's own download running when the handoff fails. */
  keepBrowserDownloadOnFailure: true
});

const ENDPOINT_PATTERN = /^http:\/\/(127(?:\.\d{1,3}){3}|localhost)(?::(\d{1,5}))?$/i;

/** Reads the stored configuration, filling in every missing key with its default. */
export async function readConfig() {
  const stored = await chrome.storage.local.get(Object.keys(DEFAULTS));
  const merged = { ...DEFAULTS };
  for (const key of Object.keys(DEFAULTS)) {
    if (stored[key] !== undefined && stored[key] !== null) merged[key] = stored[key];
  }
  return merged;
}

export async function writeConfig(patch) {
  const clean = {};
  for (const [key, value] of Object.entries(patch)) {
    if (key in DEFAULTS) clean[key] = value;
  }
  await chrome.storage.local.set(clean);
}

/**
 * Validates one candidate configuration and returns a per-field error map.
 * An empty map means the configuration is usable.
 */
export function validateConfig(candidate) {
  const errors = {};
  const endpoint = String(candidate.endpoint ?? '').trim().replace(/\/+$/, '');
  const match = ENDPOINT_PATTERN.exec(endpoint);
  if (!match) {
    errors.endpoint =
      'The receiver address must be a loopback address such as http://127.0.0.1:43110. No other host is accepted.';
  } else {
    const port = match[2] ? Number(match[2]) : 80;
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      errors.endpoint = `Port ${match[2]} is outside the range 1 to 65535.`;
    }
  }
  const token = String(candidate.token ?? '').trim();
  if (candidate.enabled && token.length < 16) {
    errors.token =
      'Paste the pairing token from the application before turning capture on. It is at least 16 characters.';
  }
  const minimum = Number(candidate.minimumBytes);
  if (!Number.isFinite(minimum) || minimum < 0) {
    errors.minimumBytes = 'The smallest size must be zero or a positive number of bytes.';
  }
  return errors;
}

/** Normalizes a comma or space separated extension list into lowercase entries. */
export function parseExtensionList(raw) {
  return String(raw ?? '')
    .split(/[\s,;]+/)
    .map((entry) => entry.trim().replace(/^[.*]+/, '').toLowerCase())
    .filter((entry) => entry.length > 0);
}

/** The lowercase extension of a filename or URL path, without the dot. */
export function extensionOf(nameOrUrl) {
  let candidate = String(nameOrUrl ?? '');
  try {
    if (/^https?:/i.test(candidate)) candidate = new URL(candidate).pathname;
  } catch {
    /* a URL we cannot parse is treated as a plain name */
  }
  const base = candidate.split(/[\\/]/).pop() ?? '';
  const dot = base.lastIndexOf('.');
  if (dot <= 0 || dot === base.length - 1) return '';
  return base.slice(dot + 1).toLowerCase();
}

/**
 * Decides whether one browser download item should be handed to the application.
 * Returns `{ capture: boolean, reason: string }` so the popup can explain a skip
 * rather than leaving the user wondering why nothing happened.
 */
export function shouldCapture(item, config) {
  if (!config.enabled) return { capture: false, reason: 'Capture is switched off in this extension.' };
  if (!config.token) return { capture: false, reason: 'No pairing token is stored yet.' };
  const url = String(item.finalUrl || item.url || '');
  if (!/^https?:/i.test(url)) {
    return { capture: false, reason: `Only http and https downloads are handed over; this one is ${url.split(':')[0]}.` };
  }
  const size = Number(item.fileSize ?? item.totalBytes ?? -1);
  const minimum = Number(config.minimumBytes) || 0;
  if (minimum > 0 && size >= 0 && size < minimum) {
    return { capture: false, reason: `It is ${size} bytes, below the ${minimum} byte floor.` };
  }
  const extension = extensionOf(item.filename || url);
  const never = parseExtensionList(config.neverTheseExtensions);
  if (extension && never.includes(extension)) {
    return { capture: false, reason: `The .${extension} extension is on the never-capture list.` };
  }
  const only = parseExtensionList(config.onlyTheseExtensions);
  if (only.length > 0 && !only.includes(extension)) {
    return {
      capture: false,
      reason: extension
        ? `Only ${only.map((entry) => `.${entry}`).join(', ')} are captured, and this is .${extension}.`
        : `Only ${only.map((entry) => `.${entry}`).join(', ')} are captured, and this download has no extension.`
    };
  }
  return { capture: true, reason: 'It matches every capture rule.' };
}
