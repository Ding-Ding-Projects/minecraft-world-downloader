import type { AppContext, ExportFormat } from '../../core/registry';
import type { HealthReport, InstalledModel, RunningModel, RuntimeConfig } from './api';
import { MAX_REQUEST_MS, checkHealth, contextLengthFrom, listInstalled, listRunning, showModel } from './api';
import type { FitResult, HardwareSnapshot } from './hardware';
import { collectBrowserEvidence, computeFit, emptySnapshot } from './hardware';
import type { RegistrySettings } from './registrysource';
import { LAYER_PROJECTOR } from './registrysource';
import { clampNumber, joinReference, normalizeBaseUrl, nowIso, splitReference } from './util';

/**
 * The feature's shared state.
 *
 * Four panels read from here — the runtime overview, the model store, the chat
 * surface and the harness manager — and every one of them needs the same three
 * things: what the runtime says right now, what the last verified catalog
 * refresh found, and what this machine measurably is. Keeping that in one place
 * is what stops two surfaces disagreeing about whether a model is installed.
 *
 * Everything durable lives in the settings store, which is a plain local file.
 * Nothing here is sent anywhere, and no secret is ever written into it: a
 * harness profile stores the NAME of a vault account, never the value behind it.
 */

/* ------------------------------------------------------------------ */
/* Setting ids                                                         */
/* ------------------------------------------------------------------ */

export const HOST_ID = 'models.host';
export const TIMEOUT_ID = 'models.requestTimeoutSeconds';
export const REGISTRY_HOST_ID = 'models.registryHost';
export const REGISTRY_PAGE_SIZE_ID = 'models.registryPageSize';
export const REGISTRY_MAX_REPOS_ID = 'models.registryMaxRepositories';
export const STALE_HOURS_ID = 'models.staleAfterHours';
export const PULL_PARALLELISM_ID = 'models.pullParallelism';
export const PULL_ATTEMPTS_ID = 'models.pullAttemptBudget';
export const CONTEXT_OVERHEAD_ID = 'models.contextOverheadMegabytes';
export const PROBE_ENABLED_ID = 'models.hardwareProbeEnabled';
export const PROBE_PATH_ID = 'models.hardwareProbePath';
export const CHAT_TURN_LIMIT_ID = 'models.chatTurnLimit';
export const CHAT_TEMPERATURE_ID = 'models.chatTemperature';
export const CHAT_TOP_P_ID = 'models.chatTopP';
export const CHAT_NUM_PREDICT_ID = 'models.chatNumPredict';
export const EXPORT_FORMAT_ID = 'models.exportFormat';

/** Durable records. These are data, not settings, but share the same file. */
export const CATALOG_CACHE_KEY = 'models.catalog.cache';
export const QUEUE_KEY = 'models.queue.items';
export const CHAT_SESSIONS_KEY = 'models.chat.sessions';
export const HARNESS_PROFILES_KEY = 'models.harness.profiles';
export const HARNESS_SNAPSHOTS_KEY = 'models.harness.snapshots';
export const HARDWARE_KEY = 'models.hardware.snapshot';

/** Every element id a palette entry teleports to. */
export const OVERVIEW_TAB = 'models.overview';
export const STORE_TAB = 'models.store';
export const CHAT_TAB = 'models.chat';
export const HARNESS_TAB = 'models.harness';

/* ------------------------------------------------------------------ */
/* Records                                                             */
/* ------------------------------------------------------------------ */

export interface CatalogVariant {
  /** `repository:tag` in the form a person types and the runtime prints. */
  ref: string;
  repository: string;
  tag: string;
  /** Bytes a pull transfers, when the source published it. */
  downloadBytes: number | null;
  /** Bytes of weights that have to be held in memory, when published. */
  modelBytes: number | null;
  parameterSize: string | null;
  quantization: string | null;
  family: string | null;
  format: string | null;
  contextLength: number | null;
  /** Capabilities the source actually stated or a layer actually proved. */
  capabilities: string[];
  /** How those capabilities were established, in one sentence. */
  capabilityEvidence: string;
  installed: boolean;
  running: boolean;
  installedBytes: number | null;
  modifiedAt: string | null;
  digest: string | null;
  source: 'installed' | 'catalog';
  verifiedAt: string;
  /** Each field nothing published, named. Never filled in from the tag name. */
  metadataGaps: string[];
}

export interface CatalogState {
  variants: CatalogVariant[];
  /** When the last refresh attempt ran, successful or not. */
  refreshedAt: string | null;
  /** When the last refresh that produced catalog entries ran. */
  lastSuccessfulRefreshAt: string | null;
  pageCount: number;
  repositoryCount: number;
  /** True only when the source listed everything it was asked for. */
  complete: boolean;
  completenessNote: string;
  /** The registry's own content digest or entity tag, when it supplied one. */
  sourceRevision: string | null;
  sourceHost: string;
  lastError: string | null;
}

export function emptyCatalog(): CatalogState {
  return {
    variants: [],
    refreshedAt: null,
    lastSuccessfulRefreshAt: null,
    pageCount: 0,
    repositoryCount: 0,
    complete: false,
    completenessNote: 'No catalog refresh has run in this profile yet.',
    sourceRevision: null,
    sourceHost: '',
    lastError: null
  };
}

export type QueueStatus = 'queued' | 'running' | 'done' | 'failed' | 'cancelled' | 'skipped';

export interface QueueItem {
  id: string;
  ref: string;
  addedAt: string;
  status: QueueStatus;
  attempts: number;
  maxAttempts: number;
  /** The runtime's own last status line, verbatim. */
  lastStatusLine: string;
  totalBytes: number | null;
  completedBytes: number | null;
  /** What the catalog said the transfer would be, recorded when queued. */
  expectedBytes: number | null;
  error: string | null;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface ChatStats {
  promptTokens: number | null;
  responseTokens: number | null;
  totalDurationMs: number | null;
  tokensPerSecond: number | null;
}

export interface ChatMessage {
  id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  createdAt: string;
  model: string | null;
  stats: ChatStats | null;
  error: string | null;
}

export interface ChatSession {
  id: string;
  title: string;
  model: string;
  systemPrompt: string;
  temperature: number;
  topP: number;
  numPredict: number;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export type HarnessArgument =
  | { kind: 'literal'; value: string }
  | { kind: 'path'; value: string }
  | { kind: 'number'; value: number }
  | { kind: 'model' }
  | { kind: 'runtimeUrl' };

export interface HarnessEnvironmentEntry {
  key: string;
  /** Either a validated literal, or the NAME of an operating system vault account. */
  source: 'literal' | 'vault';
  value: string;
}

export interface HarnessProfile {
  id: string;
  name: string;
  description: string;
  /** True for the profiles this application ships. They can be copied, not edited. */
  builtin: boolean;
  /** One of the executables the privileged process bridge allows. */
  command: string;
  args: HarnessArgument[];
  workingDirectory: string;
  environment: HarnessEnvironmentEntry[];
  requiredPorts: number[];
  /** Files that must exist inside the working directory, by relative name. */
  requiredFiles: string[];
  /** A literal the process must print before it counts as ready. Optional. */
  readinessMarker: string;
  /** Seconds the process must survive before readiness is judged. */
  settleSeconds: number;
  /** The model this profile launches against, or empty to choose at launch. */
  modelRef: string;
  updatedAt: string;
  lastLaunchAt: string | null;
  /** The outcome of the last launch, in the words the launcher reported. */
  lastOutcome: string | null;
}

export interface HarnessSnapshot {
  id: string;
  profileId: string;
  takenAt: string;
  reason: string;
  /** The complete profile as it stood, with every environment value redacted. */
  profile: HarnessProfile;
}

/* ------------------------------------------------------------------ */
/* The store                                                           */
/* ------------------------------------------------------------------ */

export type StateEvent =
  | 'health'
  | 'installed'
  | 'catalog'
  | 'queue'
  | 'chat'
  | 'harness'
  | 'hardware';

type Listener = (event: StateEvent) => void;

/** Hard ceiling on cached catalog rows, so the settings file stays bounded. */
const MAX_CACHED_VARIANTS = 6_000;

export class ModelsState {
  readonly ctx: AppContext;

  health: HealthReport | null = null;
  installed: InstalledModel[] = [];
  running: RunningModel[] = [];
  installedError: string | null = null;
  /** Extra metadata read from the runtime's own show endpoint, per reference. */
  readonly detail = new Map<string, { capabilities: string[]; contextLength: number | null; family: string | null }>();

  catalog: CatalogState = emptyCatalog();
  queue: QueueItem[] = [];
  sessions: ChatSession[] = [];
  profiles: HarnessProfile[] = [];
  snapshots: HarnessSnapshot[] = [];
  hardware: HardwareSnapshot = emptySnapshot();

  private readonly listeners = new Set<Listener>();
  private readonly fitCache = new Map<string, FitResult>();

  constructor(ctx: AppContext) {
    this.ctx = ctx;
    this.catalog = this.readJson<CatalogState>(CATALOG_CACHE_KEY, emptyCatalog());
    this.queue = this.readJson<QueueItem[]>(QUEUE_KEY, []);
    this.sessions = this.readJson<ChatSession[]>(CHAT_SESSIONS_KEY, []);
    this.profiles = this.readJson<HarnessProfile[]>(HARNESS_PROFILES_KEY, []);
    this.snapshots = this.readJson<HarnessSnapshot[]>(HARNESS_SNAPSHOTS_KEY, []);
    this.hardware = this.readJson<HardwareSnapshot>(HARDWARE_KEY, emptySnapshot());
  }

  private readJson<T>(key: string, fallback: T): T {
    const raw = this.ctx.settings.get<unknown>(key, undefined);
    if (raw === undefined || raw === null) return fallback;
    return raw as T;
  }

  on(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event: StateEvent): void {
    for (const listener of [...this.listeners]) {
      try {
        listener(event);
      } catch (error) {
        console.error('A local-models listener threw:', error);
      }
    }
  }

  /* ---------------- configuration ---------------- */

  runtimeConfig(): RuntimeConfig {
    const seconds = clampNumber(this.ctx.settings.get(TIMEOUT_ID, 60), 5, 120, 60);
    return {
      baseUrl: normalizeBaseUrl(String(this.ctx.settings.get(HOST_ID, 'http://127.0.0.1:11434'))),
      timeoutMs: Math.min(seconds * 1000, MAX_REQUEST_MS)
    };
  }

  registrySettings(): RegistrySettings {
    const host = String(this.ctx.settings.get(REGISTRY_HOST_ID, 'registry.ollama.ai'));
    return {
      host: host === 'none' ? '' : host,
      timeoutMs: Math.min(clampNumber(this.ctx.settings.get(TIMEOUT_ID, 60), 5, 120, 60) * 1000, MAX_REQUEST_MS),
      maxRepositories: clampNumber(this.ctx.settings.get(REGISTRY_MAX_REPOS_ID, 500), 10, 5_000, 500),
      pageSize: clampNumber(this.ctx.settings.get(REGISTRY_PAGE_SIZE_ID, 100), 10, 1_000, 100)
    };
  }

  contextOverheadBytes(): number {
    return clampNumber(this.ctx.settings.get(CONTEXT_OVERHEAD_ID, 1024), 128, 65_536, 1024) * 1024 * 1024;
  }

  staleAfterMs(): number {
    return clampNumber(this.ctx.settings.get(STALE_HOURS_ID, 24), 1, 720, 24) * 3_600_000;
  }

  pullParallelism(): number {
    return clampNumber(this.ctx.settings.get(PULL_PARALLELISM_ID, 1), 1, 4, 1);
  }

  pullAttemptBudget(): number {
    return clampNumber(this.ctx.settings.get(PULL_ATTEMPTS_ID, 20), 1, 200, 20);
  }

  exportFormat(): ExportFormat {
    const value = String(this.ctx.settings.get(EXPORT_FORMAT_ID, 'json'));
    const allowed: ExportFormat[] = ['json', 'jsonl', 'yaml', 'toml', 'xml', 'csv', 'tsv', 'markdown', 'html', 'sql'];
    return (allowed as string[]).includes(value) ? (value as ExportFormat) : 'json';
  }

  /* ---------------- persistence ---------------- */

  saveCatalog(): void {
    const bounded: CatalogState = {
      ...this.catalog,
      variants: this.catalog.variants.slice(0, MAX_CACHED_VARIANTS)
    };
    this.ctx.settings.set(CATALOG_CACHE_KEY, bounded);
    this.fitCache.clear();
    this.emit('catalog');
  }

  saveQueue(): void {
    this.ctx.settings.set(QUEUE_KEY, this.queue);
    this.emit('queue');
  }

  saveSessions(): void {
    this.ctx.settings.set(CHAT_SESSIONS_KEY, this.sessions);
    this.emit('chat');
  }

  saveProfiles(): void {
    this.ctx.settings.set(HARNESS_PROFILES_KEY, this.profiles);
    this.emit('harness');
  }

  saveSnapshots(): void {
    this.ctx.settings.set(HARNESS_SNAPSHOTS_KEY, this.snapshots.slice(0, 100));
    this.emit('harness');
  }

  saveHardware(): void {
    this.ctx.settings.set(HARDWARE_KEY, this.hardware);
    this.fitCache.clear();
    this.emit('hardware');
  }

  /* ---------------- runtime refresh ---------------- */

  /**
   * Asks the runtime what it is and what it holds.
   *
   * A failure never clears what is already known: the installed list from the
   * last successful call stays on screen, labelled with the moment it was read,
   * because a list that empties itself the instant a service stops is a list
   * that has thrown away the only offline evidence the user had.
   */
  async refreshRuntime(): Promise<void> {
    const config = this.runtimeConfig();
    this.health = await checkHealth(this.ctx.studio, config);
    this.emit('health');

    if (!this.health.reachable) {
      this.installedError = this.health.error;
      this.emit('installed');
      return;
    }

    const tags = await listInstalled(this.ctx.studio, config);
    if (tags.ok) {
      this.installed = tags.value;
      this.installedError = null;
    } else {
      this.installedError = tags.error;
    }

    const ps = await listRunning(this.ctx.studio, config);
    this.running = ps.ok ? ps.value : [];

    this.hardware = {
      ...collectBrowserEvidence(this.ctx.studio, this.running),
      measuredTotalMemory: this.hardware.measuredTotalMemory,
      measuredFreeMemory: this.hardware.measuredFreeMemory,
      measuredFreeDisk: this.hardware.measuredFreeDisk,
      measuredDiskPath: this.hardware.measuredDiskPath
    };
    if (this.hardware.measuredTotalMemory !== null) {
      this.hardware.gaps = this.hardware.gaps.filter(
        (gap) => !gap.startsWith('Free disk space and exact system memory') && !gap.startsWith('System memory was not')
      );
    }
    this.saveHardware();

    this.mergeInstalledIntoCatalog();
    this.emit('installed');
  }

  /**
   * Reads the runtime's own capability and context metadata for one installed
   * model. Capabilities come from the runtime rather than from the tag's name.
   */
  async loadDetail(reference: string): Promise<void> {
    if (this.detail.has(reference)) return;
    const result = await showModel(this.ctx.studio, this.runtimeConfig(), reference);
    if (!result.ok) return;
    const capabilities = Array.isArray(result.value.capabilities)
      ? result.value.capabilities.filter((entry): entry is string => typeof entry === 'string')
      : [];
    this.detail.set(reference, {
      capabilities,
      contextLength: contextLengthFrom(result.value.model_info),
      family: result.value.details?.family ?? null
    });
    this.mergeInstalledIntoCatalog();
    this.emit('catalog');
  }

  /**
   * Folds the installed list into the catalog.
   *
   * Both sets stay visible: an installed model the catalog source never listed
   * keeps its row and is marked as coming from the runtime, and a catalog entry
   * that is not installed keeps its row too. Hiding either would make the
   * inventory a curated view of itself.
   */
  mergeInstalledIntoCatalog(): void {
    const byRef = new Map<string, CatalogVariant>();
    for (const variant of this.catalog.variants) {
      byRef.set(variant.ref, { ...variant, installed: false, running: false, installedBytes: null, modifiedAt: null });
    }
    const runningNames = new Set(this.running.map((model) => model.name));

    for (const model of this.installed) {
      const { repository, tag } = splitReference(model.name);
      const ref = joinReference(repository, tag);
      const detail = this.detail.get(model.name);
      const existing = byRef.get(ref);
      const gaps: string[] = [];
      if (!model.details?.parameter_size) gaps.push('The runtime did not report a parameter size for this model.');
      if (!model.details?.quantization_level) gaps.push('The runtime did not report a quantization level for this model.');
      if (!detail) gaps.push('Capabilities and context window have not been read yet. Open the model to read them.');

      const merged: CatalogVariant = {
        ref,
        repository,
        tag,
        downloadBytes: existing?.downloadBytes ?? null,
        modelBytes: existing?.modelBytes ?? (typeof model.size === 'number' ? model.size : null),
        parameterSize: model.details?.parameter_size ?? existing?.parameterSize ?? null,
        quantization: model.details?.quantization_level ?? existing?.quantization ?? null,
        family: detail?.family ?? model.details?.family ?? existing?.family ?? null,
        format: model.details?.format ?? existing?.format ?? null,
        contextLength: detail?.contextLength ?? existing?.contextLength ?? null,
        capabilities: detail?.capabilities ?? existing?.capabilities ?? [],
        capabilityEvidence: detail
          ? 'Reported by the local runtime for this installed model.'
          : existing?.capabilityEvidence ?? 'Not established yet.',
        installed: true,
        running: runningNames.has(model.name),
        installedBytes: typeof model.size === 'number' ? model.size : null,
        modifiedAt: model.modified_at ?? null,
        digest: model.digest ?? existing?.digest ?? null,
        source: existing ? existing.source : 'installed',
        verifiedAt: nowIso(),
        metadataGaps: gaps
      };
      byRef.set(ref, merged);
    }

    this.catalog.variants = [...byRef.values()].sort((a, b) => a.ref.localeCompare(b.ref));
    this.fitCache.clear();
  }

  /* ---------------- verdicts ---------------- */

  /** Computes a fit verdict for one variant, memoised until evidence changes. */
  fitFor(variant: CatalogVariant): FitResult {
    const cached = this.fitCache.get(variant.ref);
    if (cached) return cached;
    const result = computeFit(
      {
        modelBytes: variant.modelBytes,
        downloadBytes: variant.downloadBytes ?? variant.modelBytes,
        contextLength: variant.contextLength,
        contextOverheadBytes: this.contextOverheadBytes()
      },
      this.hardware
    );
    this.fitCache.set(variant.ref, result);
    return result;
  }

  invalidateFits(): void {
    this.fitCache.clear();
  }

  /* ---------------- catalog helpers ---------------- */

  variant(ref: string): CatalogVariant | null {
    return this.catalog.variants.find((entry) => entry.ref === ref) ?? null;
  }

  isStale(now = Date.now()): boolean {
    if (!this.catalog.lastSuccessfulRefreshAt) return true;
    const then = new Date(this.catalog.lastSuccessfulRefreshAt).getTime();
    if (Number.isNaN(then)) return true;
    return now - then > this.staleAfterMs();
  }

  installedNames(): string[] {
    return this.installed.map((model) => model.name).sort((a, b) => a.localeCompare(b));
  }

  /**
   * Establishes capabilities from layer media types.
   *
   * A projector layer is what a vision model carries, and its presence in a
   * manifest is a fact about that manifest. Nothing here reads a tag's name.
   */
  static capabilitiesFromLayers(mediaTypes: string[]): { capabilities: string[]; evidence: string } {
    const capabilities: string[] = [];
    if (mediaTypes.includes(LAYER_PROJECTOR)) capabilities.push('vision');
    if (capabilities.length === 0) {
      return {
        capabilities: [],
        evidence:
          'The catalog manifest carries no layer that proves a capability. Install the model to have the runtime report its own list.'
      };
    }
    return {
      capabilities,
      evidence: 'Proved by the layer types present in the catalog manifest for this exact tag.'
    };
  }
}
