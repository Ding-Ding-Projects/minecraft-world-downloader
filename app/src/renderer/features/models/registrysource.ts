import type { HttpResponse, Result, StudioApi } from '../../../shared/api';
import { describeError, parseJson, registryRepository } from './util';

/**
 * The catalog source: an OCI Distribution v2 registry.
 *
 * The runtime pulls its models from a standard container registry, so the model
 * catalog is enumerated through that registry's own documented API rather than
 * by scraping a web page or by shipping a hand-picked list. Three endpoints do
 * all of it:
 *
 *   GET /v2/_catalog?n=&last=                 every repository, paginated
 *   GET /v2/<repo>/tags/list?n=&last=         every published tag of one
 *   GET /v2/<repo>/manifests/<tag>            the layers, with their exact sizes
 *
 * Pagination is followed to the end on every refresh, and the page count and the
 * completeness verdict are recorded with the result. When the registry refuses a
 * whole-catalog listing — which many registries do, by design — the refresh says
 * so in exactly those words and falls back to enumerating the repositories it
 * can name from real evidence. It never invents an entry to fill the gap.
 */

/** Layer media types the runtime publishes. Presence is evidence, not a guess. */
export const LAYER_MODEL = 'application/vnd.ollama.image.model';
export const LAYER_PROJECTOR = 'application/vnd.ollama.image.projector';
export const LAYER_ADAPTER = 'application/vnd.ollama.image.adapter';
export const LAYER_PARAMS = 'application/vnd.ollama.image.params';
export const LAYER_TEMPLATE = 'application/vnd.ollama.image.template';
export const LAYER_SYSTEM = 'application/vnd.ollama.image.system';
export const LAYER_LICENSE = 'application/vnd.ollama.image.license';

const MANIFEST_ACCEPT = [
  'application/vnd.docker.distribution.manifest.v2+json',
  'application/vnd.oci.image.manifest.v1+json',
  'application/json'
].join(', ');

export interface RegistryLayer {
  mediaType: string;
  digest: string;
  size: number;
}

export interface RegistryManifest {
  /** Sum of every layer, which is what a pull actually transfers. */
  totalBytes: number;
  /** Size of the weights layer alone, which is what has to fit in memory. */
  modelBytes: number | null;
  layers: RegistryLayer[];
  configDigest: string | null;
  /** The registry's own content digest, used as the source revision. */
  contentDigest: string | null;
}

export interface RegistryConfig {
  modelFormat: string | null;
  modelFamily: string | null;
  modelFamilies: string[];
  /** The published parameter-size label, e.g. "8.0B". Never inferred. */
  parameterSize: string | null;
  /** The published quantization label, e.g. "Q4_K_M". Never inferred. */
  quantization: string | null;
}

export interface RegistrySettings {
  /** Bare host, e.g. `registry.ollama.ai`. Empty means no catalog source. */
  host: string;
  timeoutMs: number;
  /** Hard ceiling on repositories enumerated in one refresh. */
  maxRepositories: number;
  /** Page size requested from the registry. */
  pageSize: number;
}

function failure<T>(error: string, code?: string): Result<T> {
  return code === undefined ? { ok: false, error } : { ok: false, error, code };
}

async function get(
  studio: StudioApi,
  settings: RegistrySettings,
  path: string,
  accept: string,
  maxRedirects = 0
): Promise<Result<HttpResponse>> {
  if (settings.host.trim() === '') {
    return failure('No catalog source is configured.', 'no-source');
  }
  let url: string;
  try {
    url = new URL(path, `https://${settings.host}/`).toString();
  } catch {
    return failure(`"${settings.host}" is not a usable registry host.`, 'bad-host');
  }
  let response: Result<HttpResponse>;
  try {
    response = await studio.http.request({
      url,
      method: 'GET',
      headers: { Accept: accept },
      timeoutMs: settings.timeoutMs,
      maxBytes: 4 * 1024 * 1024,
      maxRedirects
    });
  } catch (error) {
    return failure(describeError(error), 'transport');
  }
  if (!response.ok) return failure(response.error, response.code ?? 'transport');
  const value = response.value;
  if (value.status >= 400) {
    return failure(
      `The registry answered HTTP ${value.status} ${value.statusText} for ${path}.`.trim(),
      `http-${value.status}`
    );
  }
  return { ok: true, value };
}

/**
 * Reads the `last` cursor out of a registry `Link` header.
 *
 * The header is the specification's own pagination mechanism, so following it is
 * what makes "every page" a claim rather than a hope. A missing header means the
 * listing ended, which is the only condition that ends the loop.
 */
function nextCursor(header: string | undefined): string | null {
  if (!header) return null;
  const match = /<([^>]+)>\s*;\s*rel="?next"?/i.exec(header);
  if (!match) return null;
  try {
    const url = new URL(match[1], 'https://placeholder.invalid/');
    const last = url.searchParams.get('last');
    return last && last.trim() !== '' ? last : null;
  } catch {
    return null;
  }
}

export interface CatalogListing {
  repositories: string[];
  /** How many pages were actually fetched. */
  pageCount: number;
  /** True only when the listing ran to its end without hitting a ceiling. */
  complete: boolean;
  /** Why it is incomplete, in the registry's own terms. Empty when complete. */
  incompleteReason: string;
}

/** Enumerates every repository the registry will list, following every page. */
export async function listRepositories(
  studio: StudioApi,
  settings: RegistrySettings
): Promise<Result<CatalogListing>> {
  const repositories: string[] = [];
  let cursor: string | null = null;
  let pageCount = 0;

  for (;;) {
    const query = new URLSearchParams({ n: String(settings.pageSize) });
    if (cursor) query.set('last', cursor);
    const page: Result<HttpResponse> = await get(
      studio,
      settings,
      `/v2/_catalog?${query.toString()}`,
      'application/json'
    );
    if (!page.ok) {
      if (pageCount === 0) return failure(page.error, page.code);
      return {
        ok: true,
        value: {
          repositories,
          pageCount,
          complete: false,
          incompleteReason: `Page ${pageCount + 1} of the repository listing failed: ${page.error}`
        }
      };
    }
    pageCount += 1;
    const parsed = parseJson<{ repositories?: string[] }>(page.value.body);
    const batch = Array.isArray(parsed?.repositories) ? parsed.repositories : [];
    for (const name of batch) {
      if (typeof name === 'string' && name.trim() !== '') repositories.push(name.trim());
    }
    if (repositories.length >= settings.maxRepositories) {
      return {
        ok: true,
        value: {
          repositories: repositories.slice(0, settings.maxRepositories),
          pageCount,
          complete: false,
          incompleteReason: `The refresh stopped at the configured ceiling of ${settings.maxRepositories} repositories. Raise the ceiling in Settings to enumerate more.`
        }
      };
    }
    cursor = nextCursor(page.value.headers.link ?? page.value.headers.Link);
    if (!cursor || batch.length === 0) break;
  }

  return { ok: true, value: { repositories, pageCount, complete: true, incompleteReason: '' } };
}

export interface TagListing {
  repository: string;
  tags: string[];
  pageCount: number;
  complete: boolean;
  incompleteReason: string;
}

/** Enumerates every published tag of one repository, following every page. */
export async function listTags(
  studio: StudioApi,
  settings: RegistrySettings,
  repository: string
): Promise<Result<TagListing>> {
  const repo = registryRepository(repository);
  const tags: string[] = [];
  let cursor: string | null = null;
  let pageCount = 0;

  for (;;) {
    const query = new URLSearchParams({ n: String(settings.pageSize) });
    if (cursor) query.set('last', cursor);
    const page: Result<HttpResponse> = await get(
      studio,
      settings,
      `/v2/${repo}/tags/list?${query.toString()}`,
      'application/json'
    );
    if (!page.ok) {
      if (pageCount === 0) return failure(page.error, page.code);
      return {
        ok: true,
        value: {
          repository: repo,
          tags,
          pageCount,
          complete: false,
          incompleteReason: `Page ${pageCount + 1} of the tag listing failed: ${page.error}`
        }
      };
    }
    pageCount += 1;
    const parsed = parseJson<{ tags?: string[] | null }>(page.value.body);
    const batch = Array.isArray(parsed?.tags) ? parsed.tags : [];
    for (const tag of batch) {
      if (typeof tag === 'string' && tag.trim() !== '') tags.push(tag.trim());
    }
    cursor = nextCursor(page.value.headers.link ?? page.value.headers.Link);
    if (!cursor || batch.length === 0) break;
    if (tags.length > 5_000) {
      return {
        ok: true,
        value: {
          repository: repo,
          tags,
          pageCount,
          complete: false,
          incompleteReason: 'The tag listing exceeded 5000 entries and was stopped.'
        }
      };
    }
  }

  return { ok: true, value: { repository: repo, tags, pageCount, complete: true, incompleteReason: '' } };
}

/** Fetches one manifest, which is where the exact transfer size comes from. */
export async function fetchManifest(
  studio: StudioApi,
  settings: RegistrySettings,
  repository: string,
  tag: string
): Promise<Result<RegistryManifest>> {
  const repo = registryRepository(repository);
  const response = await get(studio, settings, `/v2/${repo}/manifests/${encodeURIComponent(tag)}`, MANIFEST_ACCEPT);
  if (!response.ok) return failure(response.error, response.code);

  const parsed = parseJson<{
    config?: { digest?: string; size?: number; mediaType?: string };
    layers?: Array<{ mediaType?: string; digest?: string; size?: number }>;
  }>(response.value.body);
  if (!parsed || !Array.isArray(parsed.layers)) {
    return failure('The registry returned a manifest this application could not read.', 'bad-manifest');
  }

  const layers: RegistryLayer[] = [];
  for (const layer of parsed.layers) {
    if (typeof layer?.digest !== 'string') continue;
    layers.push({
      mediaType: typeof layer.mediaType === 'string' ? layer.mediaType : 'application/octet-stream',
      digest: layer.digest,
      size: typeof layer.size === 'number' && Number.isFinite(layer.size) ? layer.size : 0
    });
  }
  const totalBytes = layers.reduce((sum, layer) => sum + layer.size, 0);
  const weights = layers.find((layer) => layer.mediaType === LAYER_MODEL);
  return {
    ok: true,
    value: {
      totalBytes,
      modelBytes: weights ? weights.size : null,
      layers,
      configDigest: typeof parsed.config?.digest === 'string' ? parsed.config.digest : null,
      contentDigest:
        response.value.headers['docker-content-digest'] ??
        response.value.headers['Docker-Content-Digest'] ??
        response.value.headers.etag ??
        null
    }
  };
}

/**
 * Fetches the manifest's config blob, which carries the published parameter
 * size and quantization label.
 *
 * Registries commonly answer a blob request with a redirect to object storage on
 * a different host. That host is not allow-listed, and following a redirect into
 * an unlisted host is exactly what the privileged boundary refuses — correctly.
 * When that happens the fields stay Unknown and the refusal is reported in those
 * words, rather than being filled in from the tag's name.
 */
export async function fetchConfig(
  studio: StudioApi,
  settings: RegistrySettings,
  repository: string,
  digest: string
): Promise<Result<RegistryConfig>> {
  const repo = registryRepository(repository);
  const response = await get(studio, settings, `/v2/${repo}/blobs/${digest}`, 'application/json', 1);
  if (!response.ok) return failure(response.error, response.code);
  const parsed = parseJson<{
    model_format?: string;
    model_family?: string;
    model_families?: string[] | null;
    model_type?: string;
    file_type?: string;
  }>(response.value.body);
  if (!parsed) return failure('The metadata blob was not JSON.', 'bad-config');
  return {
    ok: true,
    value: {
      modelFormat: typeof parsed.model_format === 'string' ? parsed.model_format : null,
      modelFamily: typeof parsed.model_family === 'string' ? parsed.model_family : null,
      modelFamilies: Array.isArray(parsed.model_families)
        ? parsed.model_families.filter((entry): entry is string => typeof entry === 'string')
        : [],
      parameterSize: typeof parsed.model_type === 'string' ? parsed.model_type : null,
      quantization: typeof parsed.file_type === 'string' ? parsed.file_type : null
    }
  };
}
