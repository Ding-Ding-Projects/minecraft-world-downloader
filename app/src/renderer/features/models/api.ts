import type { HttpRequest, HttpResponse, Result, StudioApi } from '../../../shared/api';
import { describeError, normalizeBaseUrl, parseJson, parseNdjson } from './util';

/**
 * The client for the local model runtime's documented HTTP API.
 *
 * Every request goes through the privileged bridge, which owns the socket, holds
 * the allow rules and bounds the response body. Nothing here reaches an
 * unofficial proxy, a cloud model service or a vendor SDK: the endpoints below
 * are the runtime's own documented ones and nothing else.
 *
 * Two limits of that boundary shape the whole feature and are stated plainly
 * wherever they are visible to a user:
 *
 *   1. The response body is buffered, not streamed. A generation therefore
 *      arrives complete rather than token by token, and a pull cannot report
 *      byte-accurate progress while it is running.
 *   2. A request is capped at 120 seconds. A pull larger than that window is run
 *      as a sequence of bounded attempts and verified against the runtime's own
 *      installed list, which is the only evidence that actually proves a model
 *      landed.
 */

/* ------------------------------------------------------------------ */
/* Wire shapes                                                         */
/* ------------------------------------------------------------------ */

export interface ModelDetails {
  parent_model?: string;
  format?: string;
  family?: string;
  families?: string[] | null;
  parameter_size?: string;
  quantization_level?: string;
}

export interface InstalledModel {
  name: string;
  model?: string;
  modified_at?: string;
  size?: number;
  digest?: string;
  details?: ModelDetails;
}

export interface RunningModel extends InstalledModel {
  expires_at?: string;
  size_vram?: number;
}

export interface ShowResponse {
  license?: string;
  modelfile?: string;
  parameters?: string;
  template?: string;
  system?: string;
  details?: ModelDetails;
  model_info?: Record<string, unknown>;
  capabilities?: string[];
}

export interface ChatMessageWire {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  images?: string[];
}

export interface ChatResponseWire {
  model?: string;
  created_at?: string;
  message?: { role: string; content: string };
  done?: boolean;
  done_reason?: string;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
  error?: string;
}

export interface PullProgressWire {
  status?: string;
  digest?: string;
  total?: number;
  completed?: number;
  error?: string;
}

export interface PullOutcome {
  /** The last status line the runtime reported, verbatim. */
  status: string;
  /** Total bytes the runtime reported for the largest layer it worked on. */
  totalBytes: number | null;
  /** Bytes the runtime reported as completed for that layer. */
  completedBytes: number | null;
  /** True when the runtime's own final line said the pull succeeded. */
  succeeded: boolean;
  /** Every distinct status line, in order, for the queue's evidence panel. */
  statuses: string[];
}

/** Everything a call needs that is not part of the request itself. */
export interface RuntimeConfig {
  baseUrl: string;
  timeoutMs: number;
}

/* ------------------------------------------------------------------ */
/* Transport                                                           */
/* ------------------------------------------------------------------ */

/** The hard ceiling the privileged boundary applies to any single request. */
export const MAX_REQUEST_MS = 120_000;

/** Response bodies are bounded; a catalog page or a chat reply fits easily. */
const MAX_RESPONSE_BYTES = 8 * 1024 * 1024;

function failure<T>(error: string, code?: string): Result<T> {
  return code === undefined ? { ok: false, error } : { ok: false, error, code };
}

async function send(
  studio: StudioApi,
  config: RuntimeConfig,
  path: string,
  init: { method?: HttpRequest['method']; body?: unknown; timeoutMs?: number } = {}
): Promise<Result<HttpResponse>> {
  const base = normalizeBaseUrl(config.baseUrl);
  if (base === '') {
    return failure('No runtime address is configured. Set it in Settings › Local models.', 'no-host');
  }
  let url: string;
  try {
    url = new URL(path, `${base}/`).toString();
  } catch {
    return failure(`"${base}" is not a usable runtime address.`, 'bad-host');
  }

  const request: HttpRequest = {
    url,
    method: init.method ?? 'GET',
    headers: { Accept: 'application/json' },
    timeoutMs: Math.min(init.timeoutMs ?? config.timeoutMs, MAX_REQUEST_MS),
    maxBytes: MAX_RESPONSE_BYTES
  };
  if (init.body !== undefined) {
    request.body = JSON.stringify(init.body);
    request.headers = { ...request.headers, 'Content-Type': 'application/json' };
  }

  let response: Result<HttpResponse>;
  try {
    response = await studio.http.request(request);
  } catch (error) {
    return failure(describeError(error), 'transport');
  }
  if (!response.ok) return failure(response.error, response.code ?? 'transport');

  const value = response.value;
  if (value.status >= 400) {
    const parsed = parseJson<{ error?: string }>(value.body);
    const reported = parsed?.error?.trim();
    return failure(
      reported
        ? `The runtime refused the request with HTTP ${value.status}: ${reported}`
        : `The runtime answered HTTP ${value.status} ${value.statusText}`.trim(),
      `http-${value.status}`
    );
  }
  return { ok: true, value };
}

async function sendJson<T>(
  studio: StudioApi,
  config: RuntimeConfig,
  path: string,
  init: { method?: HttpRequest['method']; body?: unknown; timeoutMs?: number } = {}
): Promise<Result<T>> {
  const response = await send(studio, config, path, init);
  if (!response.ok) return failure(response.error, response.code);
  if (response.value.truncated) {
    return failure(
      `The response from ${path} was larger than the ${MAX_RESPONSE_BYTES / (1024 * 1024)} MiB ceiling and was cut off, so it was not parsed.`,
      'truncated'
    );
  }
  const parsed = parseJson<T>(response.value.body);
  if (parsed === null) {
    return failure(
      `The runtime answered ${path} with something that is not JSON. This usually means the address points at a different service.`,
      'not-json'
    );
  }
  return { ok: true, value: parsed };
}

/* ------------------------------------------------------------------ */
/* Endpoints                                                           */
/* ------------------------------------------------------------------ */

export interface HealthReport {
  reachable: boolean;
  version: string | null;
  /** Round-trip time of the version call, in milliseconds. */
  latencyMs: number | null;
  error: string | null;
  /** The transport code, which is what the troubleshooter branches on. */
  code: string | null;
  checkedAt: string;
  baseUrl: string;
}

/** Asks the runtime for its version, which is the cheapest proof it is alive. */
export async function checkHealth(studio: StudioApi, config: RuntimeConfig): Promise<HealthReport> {
  const startedAt = performance.now();
  const result = await sendJson<{ version?: string }>(studio, config, 'api/version', { timeoutMs: 5_000 });
  const latencyMs = Math.round(performance.now() - startedAt);
  const checkedAt = new Date().toISOString();
  if (!result.ok) {
    return {
      reachable: false,
      version: null,
      latencyMs: null,
      error: result.error,
      code: result.code ?? 'unknown',
      checkedAt,
      baseUrl: normalizeBaseUrl(config.baseUrl)
    };
  }
  return {
    reachable: true,
    version: typeof result.value.version === 'string' ? result.value.version : null,
    latencyMs,
    error: null,
    code: null,
    checkedAt,
    baseUrl: normalizeBaseUrl(config.baseUrl)
  };
}

/** Every model installed locally, with the runtime's own metadata. */
export async function listInstalled(studio: StudioApi, config: RuntimeConfig): Promise<Result<InstalledModel[]>> {
  const result = await sendJson<{ models?: InstalledModel[] }>(studio, config, 'api/tags');
  if (!result.ok) return failure(result.error, result.code);
  return { ok: true, value: Array.isArray(result.value.models) ? result.value.models : [] };
}

/** Every model currently loaded into memory, with its reported VRAM footprint. */
export async function listRunning(studio: StudioApi, config: RuntimeConfig): Promise<Result<RunningModel[]>> {
  const result = await sendJson<{ models?: RunningModel[] }>(studio, config, 'api/ps');
  if (!result.ok) return failure(result.error, result.code);
  return { ok: true, value: Array.isArray(result.value.models) ? result.value.models : [] };
}

/** Full metadata for one installed model, including its verified capabilities. */
export async function showModel(
  studio: StudioApi,
  config: RuntimeConfig,
  name: string
): Promise<Result<ShowResponse>> {
  return sendJson<ShowResponse>(studio, config, 'api/show', { method: 'POST', body: { model: name } });
}

/** Deletes one installed model. The runtime answers with no body on success. */
export async function deleteModel(
  studio: StudioApi,
  config: RuntimeConfig,
  name: string
): Promise<Result<void>> {
  const response = await send(studio, config, 'api/delete', { method: 'DELETE', body: { model: name } });
  if (!response.ok) return failure(response.error, response.code);
  return { ok: true, value: undefined };
}

/** Copies an installed model to a new local name. */
export async function copyModel(
  studio: StudioApi,
  config: RuntimeConfig,
  source: string,
  destination: string
): Promise<Result<void>> {
  const response = await send(studio, config, 'api/copy', {
    method: 'POST',
    body: { source, destination }
  });
  if (!response.ok) return failure(response.error, response.code);
  return { ok: true, value: undefined };
}

/**
 * Runs one bounded pull attempt.
 *
 * The streaming form of the endpoint is used deliberately: the body arrives
 * buffered, but every progress line is in it, so a completed attempt reports the
 * exact byte totals the runtime itself measured rather than an estimate. An
 * attempt that exceeds the window fails here; the queue then re-checks the
 * installed list, and retries, because the runtime keeps the layers it already
 * fetched and resumes from them.
 */
export async function pullAttempt(
  studio: StudioApi,
  config: RuntimeConfig,
  reference: string,
  timeoutMs: number
): Promise<Result<PullOutcome>> {
  const response = await send(studio, config, 'api/pull', {
    method: 'POST',
    body: { model: reference, stream: true },
    timeoutMs
  });
  if (!response.ok) return failure(response.error, response.code);

  const lines = parseNdjson<PullProgressWire>(response.value.body);
  if (lines.length === 0) {
    return failure('The runtime accepted the pull but reported no progress lines at all.', 'empty');
  }
  const reported = lines.find((line) => typeof line.error === 'string' && line.error.trim() !== '');
  if (reported?.error) return failure(`The runtime refused the pull: ${reported.error}`, 'refused');

  const statuses: string[] = [];
  let totalBytes: number | null = null;
  let completedBytes: number | null = null;
  for (const line of lines) {
    if (typeof line.status === 'string' && statuses[statuses.length - 1] !== line.status) {
      statuses.push(line.status);
    }
    if (typeof line.total === 'number' && (totalBytes === null || line.total > totalBytes)) {
      totalBytes = line.total;
      completedBytes = typeof line.completed === 'number' ? line.completed : completedBytes;
    } else if (typeof line.completed === 'number' && completedBytes !== null && line.completed > completedBytes) {
      completedBytes = line.completed;
    }
  }
  const last = statuses[statuses.length - 1] ?? '';
  return {
    ok: true,
    value: {
      status: last,
      totalBytes,
      completedBytes,
      succeeded: last.toLowerCase() === 'success',
      statuses
    }
  };
}

export interface ChatRequestOptions {
  model: string;
  messages: ChatMessageWire[];
  /** Documented runtime options. Only the keys the user actually set are sent. */
  options?: Record<string, number>;
  /** Sent only when the model's verified capabilities include structured output. */
  format?: 'json';
  keepAlive?: string;
}

export interface ChatReply {
  content: string;
  doneReason: string | null;
  totalDurationMs: number | null;
  loadDurationMs: number | null;
  promptTokens: number | null;
  responseTokens: number | null;
  /** Tokens per second, computed only when the runtime supplied both figures. */
  tokensPerSecond: number | null;
}

/**
 * Sends one chat turn.
 *
 * `stream: false` is deliberate rather than a shortcut. The privileged boundary
 * buffers the body either way, so asking for a stream would produce exactly the
 * same arrival behaviour with a harder body to parse; the non-streaming form
 * returns the same timing counters, which is what the surface actually reports.
 */
export async function chat(
  studio: StudioApi,
  config: RuntimeConfig,
  request: ChatRequestOptions,
  timeoutMs: number
): Promise<Result<ChatReply>> {
  const body: Record<string, unknown> = {
    model: request.model,
    messages: request.messages,
    stream: false
  };
  if (request.options && Object.keys(request.options).length > 0) body.options = request.options;
  if (request.format) body.format = request.format;
  if (request.keepAlive) body.keep_alive = request.keepAlive;

  const result = await sendJson<ChatResponseWire>(studio, config, 'api/chat', {
    method: 'POST',
    body,
    timeoutMs
  });
  if (!result.ok) return failure(result.error, result.code);

  const wire = result.value;
  if (typeof wire.error === 'string' && wire.error.trim() !== '') {
    return failure(`The runtime refused the request: ${wire.error}`, 'refused');
  }
  const content = wire.message?.content ?? '';
  const evalCount = typeof wire.eval_count === 'number' ? wire.eval_count : null;
  const evalDuration = typeof wire.eval_duration === 'number' ? wire.eval_duration : null;
  return {
    ok: true,
    value: {
      content,
      doneReason: typeof wire.done_reason === 'string' ? wire.done_reason : null,
      totalDurationMs: typeof wire.total_duration === 'number' ? wire.total_duration / 1e6 : null,
      loadDurationMs: typeof wire.load_duration === 'number' ? wire.load_duration / 1e6 : null,
      promptTokens: typeof wire.prompt_eval_count === 'number' ? wire.prompt_eval_count : null,
      responseTokens: evalCount,
      tokensPerSecond:
        evalCount !== null && evalDuration !== null && evalDuration > 0
          ? evalCount / (evalDuration / 1e9)
          : null
    }
  };
}

/* ------------------------------------------------------------------ */
/* Capability reading                                                  */
/* ------------------------------------------------------------------ */

/** The capability names the runtime publishes that this surface acts on. */
export const KNOWN_CAPABILITIES = ['completion', 'tools', 'insert', 'vision', 'embedding', 'thinking'] as const;
export type KnownCapability = (typeof KNOWN_CAPABILITIES)[number];

/**
 * Reads a context length out of the `model_info` map.
 *
 * The key is architecture-specific — `llama.context_length`,
 * `qwen2.context_length` and so on — so the architecture is read first and the
 * key built from it. A map that names no architecture yields `null`, never a
 * default that would quietly become an assumption in a fit verdict.
 */
export function contextLengthFrom(info: Record<string, unknown> | undefined): number | null {
  if (!info) return null;
  const architecture = typeof info['general.architecture'] === 'string' ? String(info['general.architecture']) : null;
  const candidates = architecture ? [`${architecture}.context_length`] : [];
  for (const key of Object.keys(info)) {
    if (key.endsWith('.context_length') && !candidates.includes(key)) candidates.push(key);
  }
  for (const key of candidates) {
    const value = info[key];
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  }
  return null;
}

/** Reads the embedding length, which is what a projector layer scales against. */
export function embeddingLengthFrom(info: Record<string, unknown> | undefined): number | null {
  if (!info) return null;
  for (const key of Object.keys(info)) {
    if (!key.endsWith('.embedding_length')) continue;
    const value = info[key];
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  }
  return null;
}
