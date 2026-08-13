import { net } from 'electron';
import type { HttpAllowRule, HttpRequest, HttpResponse } from '../../shared/api';

/**
 * Outbound HTTP, deny by default.
 *
 * The application ships every asset locally and makes no network request of its
 * own. A feature that genuinely needs to reach a host must register an allow
 * rule first, naming itself and its reason, so the settings surface can list
 * exactly who is allowed to talk to what and why.
 *
 * Redirects are refused, credentials embedded in a URL are refused, plain HTTP
 * is refused except to a loopback address, and the response body is bounded.
 */

const DEFAULT_TIMEOUT = 15_000;
const DEFAULT_MAX_BYTES = 8 * 1024 * 1024;

const rules = new Map<string, HttpAllowRule>();

function normalizeHost(host: string): string {
  return host.trim().toLowerCase();
}

function isLoopback(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '[::1]' ||
    /^127\.\d+\.\d+\.\d+$/.test(hostname)
  );
}

export function allow(rule: HttpAllowRule): void {
  const host = normalizeHost(rule.host);
  if (!host) throw new Error('An allow rule needs a host.');
  const schemes = Array.isArray(rule.schemes) ? rule.schemes : [];
  if (schemes.length === 0) throw new Error('An allow rule needs at least one scheme.');
  for (const scheme of schemes) {
    if (scheme !== 'http' && scheme !== 'https') {
      throw new Error(`Only http and https may be allow-listed; "${scheme}" was refused.`);
    }
  }
  if (schemes.includes('http') && !isLoopback(host.replace(/^\./, ''))) {
    throw new Error(
      `Plain http is only permitted for a loopback host; "${rule.host}" was refused. Use https.`
    );
  }
  rules.set(host, {
    host,
    schemes: [...schemes],
    owner: String(rule.owner || 'unknown'),
    reason: String(rule.reason || '')
  });
}

export function listRules(): HttpAllowRule[] {
  return [...rules.values()].sort((a, b) => a.host.localeCompare(b.host));
}

export function revoke(host: string): void {
  rules.delete(normalizeHost(host));
}

function matchRule(hostname: string): HttpAllowRule | null {
  const host = normalizeHost(hostname);
  const exact = rules.get(host);
  if (exact) return exact;
  for (const rule of rules.values()) {
    if (rule.host.startsWith('.') && (host === rule.host.slice(1) || host.endsWith(rule.host))) {
      return rule;
    }
  }
  return null;
}

/**
 * Checks one target against the allow rules and returns it parsed.
 *
 * Every hop of a redirect chain comes back through here, so following a
 * redirect can never reach a host that a direct request would have been refused
 * for.
 */
function validateTarget(candidate: string): URL {
  let url: URL;
  try {
    url = new URL(String(candidate));
  } catch {
    throw new Error(`"${String(candidate)}" is not a valid URL.`);
  }
  if (url.username || url.password) {
    throw new Error('A URL carrying embedded credentials is refused.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Only http and https are supported; "${url.protocol}" was refused.`);
  }
  const rule = matchRule(url.hostname);
  if (!rule) {
    throw new Error(
      `No outbound rule allows ${url.hostname}. A feature must register an allow rule naming itself and its reason before it can reach a host.`
    );
  }
  const scheme = url.protocol === 'https:' ? 'https' : 'http';
  if (!rule.schemes.includes(scheme)) {
    throw new Error(`The rule for ${rule.host} does not permit ${scheme}.`);
  }
  if (scheme === 'http' && !isLoopback(url.hostname)) {
    throw new Error('Plain http is only permitted for a loopback host.');
  }
  return url;
}

interface RawResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  bytes: Buffer;
  truncated: boolean;
}

function performOnce(
  url: URL,
  method: string,
  headers: Record<string, string>,
  body: string | undefined,
  timeoutMs: number,
  maxBytes: number,
  allowRedirect: boolean
): Promise<RawResponse> {
  return new Promise<RawResponse>((resolve, reject) => {
    // `manual` hands the 3xx back so the caller can re-check the next hop
    // against the allow rules; `error` refuses it outright.
    const req = net.request({ method, url: url.toString(), redirect: allowRedirect ? 'manual' : 'error' });
    for (const [key, value] of Object.entries(headers)) {
      if (/^(cookie|authorization)$/i.test(key)) continue;
      req.setHeader(key, value);
    }
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        req.abort();
      } catch {
        /* already gone */
      }
      reject(new Error(`The request to ${url.hostname} timed out after ${timeoutMs} ms.`));
    }, timeoutMs);

    req.on('response', (response) => {
      const chunks: Buffer[] = [];
      let size = 0;
      let truncated = false;
      response.on('data', (chunk: Buffer) => {
        if (size >= maxBytes) {
          truncated = true;
          return;
        }
        const room = maxBytes - size;
        const piece = chunk.length > room ? chunk.subarray(0, room) : chunk;
        if (piece.length < chunk.length) truncated = true;
        chunks.push(piece);
        size += piece.length;
      });
      response.on('end', () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        const collected: Record<string, string> = {};
        for (const [key, value] of Object.entries(response.headers)) {
          collected[key] = Array.isArray(value) ? value.join(', ') : String(value);
        }
        resolve({
          status: response.statusCode,
          statusText: response.statusMessage ?? '',
          headers: collected,
          bytes: Buffer.concat(chunks),
          truncated
        });
      });
      response.on('error', (error: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(error);
      });
    });

    req.on('error', (error: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });

    if (typeof body === 'string' && body.length > 0) {
      req.write(body, 'utf8');
    }
    req.end();
  });
}

export async function request(input: HttpRequest): Promise<HttpResponse> {
  let url = validateTarget(String(input.url));

  const method = (input.method ?? 'GET').toUpperCase();
  const timeoutMs =
    typeof input.timeoutMs === 'number' && input.timeoutMs > 0 ? Math.min(input.timeoutMs, 120_000) : DEFAULT_TIMEOUT;
  const maxBytes =
    typeof input.maxBytes === 'number' && input.maxBytes > 0
      ? Math.min(input.maxBytes, 64 * 1024 * 1024)
      : DEFAULT_MAX_BYTES;
  const encoding = input.responseEncoding === 'base64' ? 'base64' : 'utf8';
  const maxRedirects =
    typeof input.maxRedirects === 'number' && input.maxRedirects > 0 ? Math.min(Math.floor(input.maxRedirects), 4) : 0;

  const headers = { ...(input.headers ?? {}) };
  let hops = 0;
  for (;;) {
    const allowRedirect = hops < maxRedirects;
    const raw = await performOnce(url, method, headers, input.body, timeoutMs, maxBytes, allowRedirect);
    const isRedirect = raw.status >= 300 && raw.status < 400 && typeof raw.headers.location === 'string';
    if (allowRedirect && isRedirect) {
      hops += 1;
      const next = new URL(raw.headers.location, url);
      // Re-validated rather than trusted: the destination host has to be allowed
      // in its own right, exactly as the first one did.
      url = validateTarget(next.toString());
      continue;
    }
    return {
      status: raw.status,
      statusText: raw.statusText,
      headers: raw.headers,
      body: raw.bytes.toString(encoding),
      truncated: raw.truncated,
      bodyEncoding: encoding,
      finalUrl: url.toString()
    };
  }
}
