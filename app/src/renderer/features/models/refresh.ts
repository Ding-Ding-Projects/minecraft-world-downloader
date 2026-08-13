import type { CatalogVariant, ModelsState } from './state';
import { ModelsState as StateClass } from './state';
import { fetchConfig, fetchManifest, listRepositories, listTags } from './registrysource';
import { displayRepository, joinReference, nowIso, registryRepository, splitReference, unique } from './util';

/**
 * Catalog refresh.
 *
 * The inventory is variant level: one row per published tag, not one row per
 * model family. Repository and tag listings are cheap and paginated, so they are
 * followed to the end on every refresh and the page count is recorded with the
 * result. Manifests are not: fetching one per tag would be thousands of requests
 * for a catalog nobody has scrolled yet, so a manifest is fetched when a row is
 * actually opened, when a variant is queued, or during an explicit bounded
 * enrichment pass. Until then the size fields say Unknown and the row lists that
 * gap by name — which is the honest state, and is never patched over by reading
 * the tag.
 *
 * When the source refuses a whole-catalog listing — a registry is entitled to,
 * and many do — the refresh says exactly that, then enumerates the repositories
 * it can name from real evidence: the ones already cached from an earlier
 * verified refresh, and the ones the local runtime has installed. Those tag
 * listings do work per repository, so the result is genuinely complete for every
 * repository it could name, and honestly incomplete about the rest.
 */

export interface RefreshProgress {
  phase: 'repositories' | 'tags' | 'manifests' | 'done';
  /** Human-readable statement of the current step. Never a bare spinner. */
  detail: string;
  completed: number;
  total: number;
}

export interface RefreshToken {
  cancelled: boolean;
}

export interface RefreshOutcome {
  ok: boolean;
  variantCount: number;
  repositoryCount: number;
  pageCount: number;
  complete: boolean;
  note: string;
  error: string | null;
}

/** Runs a full catalog refresh against the configured source. */
export async function refreshCatalog(
  state: ModelsState,
  token: RefreshToken,
  onProgress: (progress: RefreshProgress) => void
): Promise<RefreshOutcome> {
  const settings = state.registrySettings();
  state.catalog.refreshedAt = nowIso();
  state.catalog.sourceHost = settings.host;

  if (settings.host === '') {
    state.catalog.complete = false;
    state.catalog.completenessNote =
      'No catalog source is selected, so the inventory is the locally installed models and nothing else. Choose a source in Settings › Local models to enumerate a published catalog.';
    state.catalog.lastError = null;
    state.mergeInstalledIntoCatalog();
    state.saveCatalog();
    onProgress({ phase: 'done', detail: state.catalog.completenessNote, completed: 1, total: 1 });
    return {
      ok: true,
      variantCount: state.catalog.variants.length,
      repositoryCount: 0,
      pageCount: 0,
      complete: false,
      note: state.catalog.completenessNote,
      error: null
    };
  }

  onProgress({
    phase: 'repositories',
    detail: `Listing every repository ${settings.host} will publish, following each page in turn.`,
    completed: 0,
    total: 0
  });

  let repositories: string[] = [];
  let pageCount = 0;
  let complete = true;
  let note = '';

  const listing = await listRepositories(state.ctx.studio, settings);
  if (listing.ok) {
    repositories = listing.value.repositories;
    pageCount = listing.value.pageCount;
    complete = listing.value.complete;
    note = listing.value.incompleteReason;
  } else {
    complete = false;
    note = `${settings.host} refused a whole-catalog listing: ${listing.error} The inventory below covers every repository this application can name from evidence it already holds, and is honestly missing anything neither source has mentioned.`;
    const known = unique([
      ...state.catalog.variants.filter((entry) => entry.source === 'catalog').map((entry) => entry.repository),
      ...state.installed.map((model) => splitReference(model.name).repository)
    ]);
    repositories = known.map((repository) => registryRepository(repository));
  }

  if (repositories.length === 0) {
    state.catalog.complete = false;
    state.catalog.completenessNote =
      note ||
      'The catalog source named no repositories at all, and nothing installed locally gives a name to try. Install a model, or choose a different source, and refresh again.';
    state.catalog.lastError = listing.ok ? null : listing.error;
    state.catalog.pageCount = pageCount;
    state.catalog.repositoryCount = 0;
    state.mergeInstalledIntoCatalog();
    state.saveCatalog();
    onProgress({ phase: 'done', detail: state.catalog.completenessNote, completed: 1, total: 1 });
    return {
      ok: listing.ok,
      variantCount: state.catalog.variants.length,
      repositoryCount: 0,
      pageCount,
      complete: false,
      note: state.catalog.completenessNote,
      error: listing.ok ? null : listing.error,
    };
  }

  const collected = new Map<string, CatalogVariant>();
  const failures: string[] = [];
  let tagPages = 0;

  for (let index = 0; index < repositories.length; index += 1) {
    if (token.cancelled) {
      note = `${note} The refresh was cancelled after ${index} of ${repositories.length} repositories; everything read up to that point was kept.`.trim();
      complete = false;
      break;
    }
    const repository = repositories[index];
    onProgress({
      phase: 'tags',
      detail: `Reading every published tag of ${displayRepository(repository)}.`,
      completed: index,
      total: repositories.length
    });
    const tags = await listTags(state.ctx.studio, settings, repository);
    if (!tags.ok) {
      failures.push(`${displayRepository(repository)}: ${tags.error}`);
      continue;
    }
    tagPages += tags.value.pageCount;
    if (!tags.value.complete) {
      complete = false;
      failures.push(`${displayRepository(repository)}: ${tags.value.incompleteReason}`);
    }
    const display = displayRepository(repository);
    for (const tag of tags.value.tags) {
      const ref = joinReference(display, tag);
      collected.set(ref, {
        ref,
        repository: display,
        tag,
        downloadBytes: null,
        modelBytes: null,
        parameterSize: null,
        quantization: null,
        family: null,
        format: null,
        contextLength: null,
        capabilities: [],
        capabilityEvidence: 'Not established yet. Open the variant to read its manifest.',
        installed: false,
        running: false,
        installedBytes: null,
        modifiedAt: null,
        digest: null,
        source: 'catalog',
        verifiedAt: nowIso(),
        metadataGaps: [
          'Size, parameter count, quantization and capabilities have not been read yet. Open the variant, or run the enrichment pass, to fetch its manifest.'
        ]
      });
    }
  }

  // Anything already enriched keeps its measured fields; a refresh must not
  // throw away a manifest it already paid for.
  for (const previous of state.catalog.variants) {
    if (previous.source !== 'catalog') continue;
    const fresh = collected.get(previous.ref);
    if (!fresh) continue;
    if (previous.downloadBytes !== null || previous.modelBytes !== null) {
      collected.set(previous.ref, {
        ...fresh,
        downloadBytes: previous.downloadBytes,
        modelBytes: previous.modelBytes,
        parameterSize: previous.parameterSize,
        quantization: previous.quantization,
        family: previous.family,
        format: previous.format,
        contextLength: previous.contextLength,
        capabilities: previous.capabilities,
        capabilityEvidence: previous.capabilityEvidence,
        digest: previous.digest,
        metadataGaps: previous.metadataGaps
      });
    }
  }

  if (failures.length > 0) {
    complete = false;
    const shown = failures.slice(0, 5).join(' · ');
    note = `${note} ${failures.length} repository listing${failures.length === 1 ? '' : 's'} did not complete: ${shown}${
      failures.length > 5 ? ` · and ${failures.length - 5} more.` : ''
    }`.trim();
  }

  state.catalog.variants = [...collected.values()];
  state.catalog.pageCount = pageCount + tagPages;
  state.catalog.repositoryCount = repositories.length;
  state.catalog.complete = complete;
  state.catalog.completenessNote =
    note ||
    `Every repository the source listed was read, and every page of every tag listing was followed to its end. ${repositories.length} repositories produced ${collected.size} variants.`;
  state.catalog.lastError = listing.ok ? null : listing.error;
  state.catalog.lastSuccessfulRefreshAt = collected.size > 0 ? nowIso() : state.catalog.lastSuccessfulRefreshAt;
  state.mergeInstalledIntoCatalog();
  state.saveCatalog();

  onProgress({
    phase: 'done',
    detail: state.catalog.completenessNote,
    completed: repositories.length,
    total: repositories.length
  });

  return {
    ok: true,
    variantCount: state.catalog.variants.length,
    repositoryCount: repositories.length,
    pageCount: state.catalog.pageCount,
    complete,
    note: state.catalog.completenessNote,
    error: state.catalog.lastError
  };
}

export interface EnrichOutcome {
  ok: boolean;
  error: string | null;
}

/**
 * Fetches one variant's manifest, and its metadata blob when the registry will
 * serve it directly.
 *
 * The blob commonly redirects to object storage on a host nobody allow-listed,
 * and the privileged boundary refuses that hop — correctly. When it does, the
 * parameter size and quantization stay Unknown and the refusal is recorded in
 * those words. Filling them in from the tag would be exactly the inference this
 * feature refuses to make.
 */
export async function enrichVariant(state: ModelsState, ref: string): Promise<EnrichOutcome> {
  const variant = state.variant(ref);
  if (!variant) return { ok: false, error: `${ref} is not in the current inventory.` };
  const settings = state.registrySettings();
  if (settings.host === '') {
    return { ok: false, error: 'No catalog source is selected, so no manifest can be fetched.' };
  }

  const manifest = await fetchManifest(state.ctx.studio, settings, variant.repository, variant.tag);
  if (!manifest.ok) return { ok: false, error: manifest.error };

  const layerTypes = manifest.value.layers.map((layer) => layer.mediaType);
  const capability = StateClass.capabilitiesFromLayers(layerTypes);
  const gaps: string[] = [];

  let parameterSize = variant.parameterSize;
  let quantization = variant.quantization;
  let family = variant.family;
  let format = variant.format;

  if (manifest.value.configDigest) {
    const config = await fetchConfig(state.ctx.studio, settings, variant.repository, manifest.value.configDigest);
    if (config.ok) {
      parameterSize = config.value.parameterSize ?? parameterSize;
      quantization = config.value.quantization ?? quantization;
      family = config.value.modelFamily ?? family;
      format = config.value.modelFormat ?? format;
      if (!config.value.parameterSize) gaps.push('The metadata blob published no parameter size for this variant.');
      if (!config.value.quantization) gaps.push('The metadata blob published no quantization label for this variant.');
    } else {
      gaps.push(
        `The parameter size and quantization stay unknown: the metadata blob could not be read. ${config.error}`
      );
    }
  } else {
    gaps.push('The manifest names no metadata blob, so the parameter size and quantization stay unknown.');
  }

  if (manifest.value.modelBytes === null) {
    gaps.push('The manifest carries no weights layer, so the in-memory size stays unknown.');
  }

  const index = state.catalog.variants.findIndex((entry) => entry.ref === ref);
  if (index < 0) return { ok: false, error: `${ref} left the inventory while its manifest was being read.` };

  const merged: CatalogVariant = {
    ...state.catalog.variants[index],
    downloadBytes: manifest.value.totalBytes > 0 ? manifest.value.totalBytes : null,
    modelBytes: manifest.value.modelBytes ?? state.catalog.variants[index].modelBytes,
    parameterSize,
    quantization,
    family,
    format,
    digest: manifest.value.contentDigest ?? state.catalog.variants[index].digest,
    capabilities: unique([...state.catalog.variants[index].capabilities, ...capability.capabilities]),
    capabilityEvidence:
      state.catalog.variants[index].installed && state.catalog.variants[index].capabilities.length > 0
        ? state.catalog.variants[index].capabilityEvidence
        : capability.evidence,
    verifiedAt: nowIso(),
    metadataGaps: gaps
  };
  state.catalog.variants[index] = merged;
  state.invalidateFits();
  state.saveCatalog();
  return { ok: true, error: null };
}

/**
 * Enriches a bounded batch, newest-listed first, reporting after each one.
 *
 * A budget exists so a person who wants sizes for a screenful of rows can have
 * them without the application deciding on its own to make four thousand
 * requests.
 */
export async function enrichBatch(
  state: ModelsState,
  refs: string[],
  token: RefreshToken,
  onProgress: (progress: RefreshProgress) => void
): Promise<{ enriched: number; failed: number; firstError: string | null }> {
  let enriched = 0;
  let failed = 0;
  let firstError: string | null = null;
  for (let index = 0; index < refs.length; index += 1) {
    if (token.cancelled) break;
    onProgress({
      phase: 'manifests',
      detail: `Reading the manifest for ${refs[index]}.`,
      completed: index,
      total: refs.length
    });
    const result = await enrichVariant(state, refs[index]);
    if (result.ok) enriched += 1;
    else {
      failed += 1;
      if (firstError === null) firstError = result.error;
    }
  }
  onProgress({ phase: 'done', detail: `${enriched} read, ${failed} refused.`, completed: refs.length, total: refs.length });
  return { enriched, failed, firstError };
}
