import type { HttpResponse, StudioApi } from '../../../shared/api';
import { normalizeConfig, type ConsoleConfig } from './options';

/**
 * The console's HTTP surface, spoken to natively over loopback.
 *
 * The console is a Flask application. Everything the browser dashboard does it
 * does through these same routes, so calling them directly gives the native
 * surface exactly the capability the browser had — without a browser, and
 * without embedding one.
 *
 * Two boundaries are load-bearing:
 *
 * 1. The privileged bridge denies outbound HTTP by default, so this module
 *    registers one allow rule naming this feature and its reason before the
 *    first request, and plain http is permitted only because the host is
 *    loopback.
 * 2. The bridge strips `cookie` and `authorization` headers. A console started
 *    with `WEB_PASSWORD` therefore gates its API behind a session cookie this
 *    application cannot present. That is reported as its own state with its own
 *    recovery route rather than being reported as a broken console.
 */

export const CONSOLE_HOST = '127.0.0.1';
export const CONSOLE_ALLOW_REASON =
  'Talks to the locally running world downloader web console over loopback so its capabilities can be used natively instead of in a browser.';

let allowPromise: Promise<{ ok: boolean; error?: string }> | null = null;

/** Registers the loopback allow rule once per session. */
export async function ensureAllowRule(studio: StudioApi): Promise<{ ok: boolean; error?: string }> {
  if (!allowPromise) {
    allowPromise = studio.http
      .allow({
        host: CONSOLE_HOST,
        schemes: ['http'],
        owner: 'console',
        reason: CONSOLE_ALLOW_REASON
      })
      .then((result) => (result.ok ? { ok: true } : { ok: false, error: result.error }))
      .catch((error: unknown) => ({ ok: false, error: error instanceof Error ? error.message : String(error) }));
  }
  return allowPromise;
}

export interface ConsoleCallOk<T> {
  ok: true;
  value: T;
  status: number;
}

export interface ConsoleCallFail {
  ok: false;
  /** Exactly what went wrong, in words a person can act on. */
  error: string;
  /** HTTP status when there was one; absent when nothing answered at all. */
  status?: number;
  /** True when the console refused because its own login gate is enabled. */
  loginRequired?: boolean;
  /** True when nothing was listening, as opposed to a refusal from the console. */
  unreachable?: boolean;
}

export type ConsoleCall<T> = ConsoleCallOk<T> | ConsoleCallFail;

function baseUrl(port: number): string {
  return `http://${CONSOLE_HOST}:${port}`;
}

function looksUnreachable(message: string): boolean {
  return /ECONNREFUSED|ERR_CONNECTION_REFUSED|ENOTFOUND|EHOSTUNREACH|ENETUNREACH|timed out|net::ERR/i.test(message);
}

function parseJson(body: string): unknown {
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return null;
  }
}

/** Encodes a form body the way Flask's `request.form` expects to read it. */
export function encodeForm(fields: Record<string, string | boolean | number>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(fields)) {
    const text = typeof value === 'boolean' ? (value ? 'true' : '') : String(value);
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(text)}`);
  }
  return parts.join('&');
}

export interface RequestOptions {
  method?: 'GET' | 'POST';
  /** Form fields, url-encoded. Present only on POST routes. */
  form?: Record<string, string | boolean | number>;
  timeoutMs?: number;
  maxBytes?: number;
}

/** One call to the console, returning the parsed JSON body. */
export async function callConsole<T>(
  studio: StudioApi,
  port: number,
  path: string,
  options: RequestOptions = {}
): Promise<ConsoleCall<T>> {
  const allowed = await ensureAllowRule(studio);
  if (!allowed.ok) {
    return {
      ok: false,
      error:
        allowed.error ??
        'The outbound rule for the loopback console could not be registered, so no request was attempted.'
    };
  }

  const method = options.method ?? 'GET';
  const body = options.form ? encodeForm(options.form) : undefined;
  let response: HttpResponse;
  try {
    const result = await studio.http.request({
      url: `${baseUrl(port)}${path}`,
      method,
      headers: body
        ? { 'content-type': 'application/x-www-form-urlencoded; charset=utf-8', accept: 'application/json' }
        : { accept: 'application/json' },
      body,
      timeoutMs: options.timeoutMs ?? 10_000,
      maxBytes: options.maxBytes ?? 4 * 1024 * 1024
    });
    if (!result.ok) {
      const unreachable = looksUnreachable(result.error);
      return {
        ok: false,
        error: result.error,
        unreachable
      };
    }
    response = result.value;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message, unreachable: looksUnreachable(message) };
  }

  if (response.status === 401) {
    return {
      ok: false,
      status: 401,
      loginRequired: true,
      error:
        'The console refused the request because its own username and password gate is switched on. This application cannot present the session cookie that gate requires.'
    };
  }
  if (response.status >= 300 && response.status < 400) {
    return {
      ok: false,
      status: response.status,
      loginRequired: true,
      error:
        'The console redirected the request to its sign-in page, which means its username and password gate is switched on.'
    };
  }

  const parsed = parseJson(response.body);
  if (parsed === null) {
    return {
      ok: false,
      status: response.status,
      error:
        response.status >= 400
          ? `The console answered ${response.status} ${response.statusText} and the body was not JSON.`
          : 'Something answered on that port, but it did not reply with JSON. It is probably not the world downloader console.'
    };
  }
  if (response.status >= 400) {
    const message =
      typeof (parsed as { message?: unknown }).message === 'string'
        ? String((parsed as { message: string }).message)
        : `The console answered ${response.status} ${response.statusText}.`;
    return { ok: false, status: response.status, error: message };
  }
  return { ok: true, status: response.status, value: parsed as T };
}

/* ------------------------------------------------------------------ */
/* Typed views of the console's own payloads                           */
/* ------------------------------------------------------------------ */

export interface ConsoleHealthPayload {
  ok: boolean;
  running: boolean;
}

export interface DownloaderStatus {
  running: boolean;
  pid: number | null;
  uptime: number;
  config: Record<string, unknown>;
  jar: string;
  proxyPort: string | null;
}

export interface LogPage {
  total: number;
  lines: string[];
}

export interface AccountStatus {
  authenticated: boolean;
  method: 'microsoft' | 'manual' | 'offline' | null;
  username: string | null;
  uuid: string | null;
}

export interface WorldInfo {
  exists: boolean;
  path: string;
  size: number;
  files: number;
  hasWorld: boolean;
}

export interface BotStatus {
  running: boolean;
  pid: number | null;
  /** A short-lived Microsoft pairing code, not a secret. Absent when idle. */
  deviceCode: { code: string; url: string } | null;
}

export interface DeviceFlowStart {
  flowId: string;
  userCode: string;
  verificationUri: string;
  intervalSeconds: number;
  expiresInSeconds: number;
}

export type DeviceFlowPoll =
  | { state: 'pending' }
  | { state: 'ok'; username: string }
  | { state: 'error'; message: string };

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : value === undefined || value === null ? fallback : String(value);
}

function asNumber(value: unknown, fallback = 0): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export const consoleApi = {
  /** `/healthz` is deliberately not behind the console's login gate. */
  async health(studio: StudioApi, port: number): Promise<ConsoleCall<ConsoleHealthPayload>> {
    const result = await callConsole<Record<string, unknown>>(studio, port, '/healthz', { timeoutMs: 4000 });
    if (!result.ok) return result;
    const payload = asRecord(result.value);
    if (typeof payload.ok !== 'boolean') {
      return {
        ok: false,
        status: result.status,
        error:
          'Something answered the health check on that port, but not with the shape the console reports. It is probably a different program.'
      };
    }
    return { ok: true, status: result.status, value: { ok: payload.ok === true, running: payload.running === true } };
  },

  async status(studio: StudioApi, port: number): Promise<ConsoleCall<DownloaderStatus>> {
    const result = await callConsole<Record<string, unknown>>(studio, port, '/api/status');
    if (!result.ok) return result;
    const payload = asRecord(result.value);
    return {
      ok: true,
      status: result.status,
      value: {
        running: payload.running === true,
        pid: payload.pid === null || payload.pid === undefined ? null : asNumber(payload.pid, 0),
        uptime: asNumber(payload.uptime, 0),
        config: asRecord(payload.config),
        jar: asString(payload.jar),
        proxyPort: payload.proxy_port === null || payload.proxy_port === undefined ? null : asString(payload.proxy_port)
      }
    };
  },

  async logs(studio: StudioApi, port: number, since: number): Promise<ConsoleCall<LogPage>> {
    const result = await callConsole<Record<string, unknown>>(studio, port, `/api/logs?since=${Math.max(0, since)}`);
    if (!result.ok) return result;
    const payload = asRecord(result.value);
    const lines = Array.isArray(payload.lines) ? payload.lines.map((line) => asString(line)) : [];
    return { ok: true, status: result.status, value: { total: asNumber(payload.total, 0), lines } };
  },

  async botLogs(studio: StudioApi, port: number, since: number): Promise<ConsoleCall<LogPage>> {
    const result = await callConsole<Record<string, unknown>>(studio, port, `/api/bot/logs?since=${Math.max(0, since)}`);
    if (!result.ok) return result;
    const payload = asRecord(result.value);
    const lines = Array.isArray(payload.lines) ? payload.lines.map((line) => asString(line)) : [];
    return { ok: true, status: result.status, value: { total: asNumber(payload.total, 0), lines } };
  },

  async botStatus(studio: StudioApi, port: number): Promise<ConsoleCall<BotStatus>> {
    const result = await callConsole<Record<string, unknown>>(studio, port, '/api/bot/status');
    if (!result.ok) return result;
    const payload = asRecord(result.value);
    const msa = payload.msa && typeof payload.msa === 'object' ? asRecord(payload.msa) : null;
    return {
      ok: true,
      status: result.status,
      value: {
        running: payload.running === true,
        pid: payload.pid === null || payload.pid === undefined ? null : asNumber(payload.pid, 0),
        deviceCode: msa ? { code: asString(msa.code), url: asString(msa.url) } : null
      }
    };
  },

  async worldInfo(studio: StudioApi, port: number): Promise<ConsoleCall<WorldInfo>> {
    const result = await callConsole<Record<string, unknown>>(studio, port, '/api/world-info');
    if (!result.ok) return result;
    const payload = asRecord(result.value);
    return {
      ok: true,
      status: result.status,
      value: {
        exists: payload.exists === true,
        path: asString(payload.path),
        size: asNumber(payload.size, 0),
        files: asNumber(payload.files, 0),
        hasWorld: payload.has_world === true
      }
    };
  },

  /** Persists the configuration through the console's own save route. */
  async saveConfig(studio: StudioApi, port: number, config: ConsoleConfig): Promise<ConsoleCall<{ message: string }>> {
    const result = await callConsole<Record<string, unknown>>(studio, port, '/api/save', {
      method: 'POST',
      form: config
    });
    if (!result.ok) return result;
    return { ok: true, status: result.status, value: { message: asString(asRecord(result.value).message, 'Saved.') } };
  },

  async start(
    studio: StudioApi,
    port: number,
    config: ConsoleConfig
  ): Promise<ConsoleCall<{ message: string; status: DownloaderStatus | null }>> {
    const result = await callConsole<Record<string, unknown>>(studio, port, '/api/start', {
      method: 'POST',
      form: config,
      timeoutMs: 30_000
    });
    if (!result.ok) return result;
    const payload = asRecord(result.value);
    return {
      ok: true,
      status: result.status,
      value: { message: asString(payload.message, 'Started.'), status: null }
    };
  },

  async stop(studio: StudioApi, port: number): Promise<ConsoleCall<{ message: string }>> {
    const result = await callConsole<Record<string, unknown>>(studio, port, '/api/stop', {
      method: 'POST',
      timeoutMs: 30_000,
      form: {}
    });
    if (!result.ok) return result;
    return { ok: true, status: result.status, value: { message: asString(asRecord(result.value).message, 'Stopped.') } };
  },

  async restart(
    studio: StudioApi,
    port: number,
    config: ConsoleConfig
  ): Promise<ConsoleCall<{ message: string }>> {
    const result = await callConsole<Record<string, unknown>>(studio, port, '/api/restart', {
      method: 'POST',
      form: config,
      timeoutMs: 45_000
    });
    if (!result.ok) return result;
    return {
      ok: true,
      status: result.status,
      value: { message: asString(asRecord(result.value).message, 'Restarted.') }
    };
  },

  async exportDirectory(studio: StudioApi, port: number): Promise<ConsoleCall<{ message: string }>> {
    const result = await callConsole<Record<string, unknown>>(studio, port, '/api/export-dir', {
      method: 'POST',
      form: {},
      timeoutMs: 120_000
    });
    if (!result.ok) return result;
    const payload = asRecord(result.value);
    if (payload.ok === false) {
      return { ok: false, status: result.status, error: asString(payload.message, 'The console refused the snapshot.') };
    }
    return { ok: true, status: result.status, value: { message: asString(payload.message, 'Snapshot copied.') } };
  },

  async accountStatus(studio: StudioApi, port: number): Promise<ConsoleCall<AccountStatus>> {
    const result = await callConsole<Record<string, unknown>>(studio, port, '/api/auth/status');
    if (!result.ok) return result;
    const payload = asRecord(result.value);
    const method = asString(payload.method, '');
    return {
      ok: true,
      status: result.status,
      value: {
        authenticated: payload.authenticated === true,
        method: method === 'microsoft' || method === 'manual' || method === 'offline' ? method : null,
        username: payload.username === null || payload.username === undefined ? null : asString(payload.username),
        uuid: payload.uuid === null || payload.uuid === undefined ? null : asString(payload.uuid)
      }
    };
  },

  async beginDeviceFlow(studio: StudioApi, port: number): Promise<ConsoleCall<DeviceFlowStart>> {
    const result = await callConsole<Record<string, unknown>>(studio, port, '/api/auth/microsoft/start', {
      method: 'POST',
      form: {},
      timeoutMs: 30_000
    });
    if (!result.ok) return result;
    const payload = asRecord(result.value);
    if (typeof payload.error === 'string') {
      return { ok: false, status: result.status, error: payload.error };
    }
    const userCode = asString(payload.user_code);
    if (!userCode) {
      return {
        ok: false,
        status: result.status,
        error: 'The console started a Microsoft sign-in but returned no pairing code, so there is nothing to enter.'
      };
    }
    return {
      ok: true,
      status: result.status,
      value: {
        flowId: asString(payload.flow_id),
        userCode,
        verificationUri: asString(payload.verification_uri, 'https://www.microsoft.com/link'),
        intervalSeconds: asNumber(payload.interval, 5),
        expiresInSeconds: asNumber(payload.expires_in, 900)
      }
    };
  },

  async pollDeviceFlow(studio: StudioApi, port: number, flowId: string): Promise<ConsoleCall<DeviceFlowPoll>> {
    const result = await callConsole<Record<string, unknown>>(
      studio,
      port,
      `/api/auth/microsoft/poll?flow=${encodeURIComponent(flowId)}`,
      { timeoutMs: 30_000 }
    );
    if (!result.ok) return result;
    const payload = asRecord(result.value);
    const state = asString(payload.state, 'pending');
    if (state === 'ok') {
      return { ok: true, status: result.status, value: { state: 'ok', username: asString(payload.username) } };
    }
    if (state === 'error') {
      return {
        ok: true,
        status: result.status,
        value: { state: 'error', message: asString(payload.message, 'The sign-in failed.') }
      };
    }
    return { ok: true, status: result.status, value: { state: 'pending' } };
  },

  /**
   * Hands a pasted Minecraft access token to the console.
   *
   * The token is passed straight through from the field the user typed it into
   * and is never retained: it is not stored in settings, in the vault, in a
   * history payload, in an export or in any log line this feature writes.
   */
  async signInWithToken(studio: StudioApi, port: number, token: string): Promise<ConsoleCall<{ username: string }>> {
    const result = await callConsole<Record<string, unknown>>(studio, port, '/api/auth/manual', {
      method: 'POST',
      form: { token },
      timeoutMs: 30_000
    });
    if (!result.ok) return result;
    const payload = asRecord(result.value);
    if (payload.ok === false) {
      return { ok: false, status: result.status, error: asString(payload.message, 'The console refused that token.') };
    }
    return { ok: true, status: result.status, value: { username: asString(payload.username) } };
  },

  async signInOffline(studio: StudioApi, port: number, username: string): Promise<ConsoleCall<{ username: string }>> {
    const result = await callConsole<Record<string, unknown>>(studio, port, '/api/auth/offline', {
      method: 'POST',
      form: { username }
    });
    if (!result.ok) return result;
    const payload = asRecord(result.value);
    if (payload.ok === false) {
      return { ok: false, status: result.status, error: asString(payload.message, 'The console refused that username.') };
    }
    return { ok: true, status: result.status, value: { username: asString(payload.username, username) } };
  },

  async signOut(studio: StudioApi, port: number): Promise<ConsoleCall<{ ok: boolean }>> {
    const result = await callConsole<Record<string, unknown>>(studio, port, '/api/auth/logout', {
      method: 'POST',
      form: {}
    });
    if (!result.ok) return result;
    return { ok: true, status: result.status, value: { ok: true } };
  },

  async startBot(
    studio: StudioApi,
    port: number,
    form: Record<string, string | boolean | number>
  ): Promise<ConsoleCall<{ message: string }>> {
    const result = await callConsole<Record<string, unknown>>(studio, port, '/api/bot/start', {
      method: 'POST',
      form,
      timeoutMs: 30_000
    });
    if (!result.ok) return result;
    const payload = asRecord(result.value);
    if (payload.ok === false) {
      return { ok: false, status: result.status, error: asString(payload.message, 'The console refused to start the bot.') };
    }
    return { ok: true, status: result.status, value: { message: asString(payload.message, 'Bot started.') } };
  },

  async authenticateBot(
    studio: StudioApi,
    port: number,
    username: string
  ): Promise<ConsoleCall<{ message: string }>> {
    const result = await callConsole<Record<string, unknown>>(studio, port, '/api/bot/auth', {
      method: 'POST',
      form: { botUser: username },
      timeoutMs: 30_000
    });
    if (!result.ok) return result;
    const payload = asRecord(result.value);
    if (payload.ok === false) {
      return { ok: false, status: result.status, error: asString(payload.message, 'The console refused the sign-in.') };
    }
    return { ok: true, status: result.status, value: { message: asString(payload.message, 'Sign-in started.') } };
  },

  async stopBot(studio: StudioApi, port: number): Promise<ConsoleCall<{ message: string }>> {
    const result = await callConsole<Record<string, unknown>>(studio, port, '/api/bot/stop', {
      method: 'POST',
      form: {},
      timeoutMs: 30_000
    });
    if (!result.ok) return result;
    const payload = asRecord(result.value);
    if (payload.ok === false) {
      return { ok: false, status: result.status, error: asString(payload.message, 'The console refused to stop the bot.') };
    }
    return { ok: true, status: result.status, value: { message: asString(payload.message, 'Bot stopped.') } };
  }
};

/** Reads the configuration the console currently holds, from its own status. */
export function configFromStatus(status: DownloaderStatus): ConsoleConfig {
  return normalizeConfig(status.config);
}
