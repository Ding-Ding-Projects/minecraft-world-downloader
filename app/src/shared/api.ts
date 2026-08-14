/**
 * Shared type surface between the main process, the preload bridge and the renderer.
 *
 * Everything the renderer can ask the operating system to do passes through this
 * interface. There is no `nodeIntegration`, no `remote`, and no ambient `require`
 * in the renderer, so this file is the complete list of privileged capabilities.
 *
 * Feature code imports types from here:
 *     import type { StudioApi, ProcessEvent } from '../../../shared/api';
 * and reaches the implementation through `window.studio`.
 */

/* ------------------------------------------------------------------ */
/* Result envelope                                                     */
/* ------------------------------------------------------------------ */

/**
 * Every privileged call returns this envelope rather than throwing across the
 * bridge, so a caller can never mistake a rejection reason for a payload.
 * Read `ok` first, always.
 */
export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; code?: string };

/* ------------------------------------------------------------------ */
/* Application identity and window state                               */
/* ------------------------------------------------------------------ */

/**
 * The platform names Node reports.
 *
 * Written out rather than referencing `NodeJS.Platform`, because this file is
 * compiled for the renderer too and the renderer has no Node type definitions —
 * a namespace that resolves in one half of the build and not the other is a
 * type error that only appears on one side.
 */
export type PlatformName =
  | 'aix'
  | 'android'
  | 'darwin'
  | 'freebsd'
  | 'haiku'
  | 'linux'
  | 'openbsd'
  | 'sunos'
  | 'win32'
  | 'cygwin'
  | 'netbsd';

export interface AppInfo {
  /**
   * The stable package identity. Never derived from the user's chosen display
   * name; the data directory, installer identity and update feed all hang off
   * this, so renaming the app in settings must not move any of them.
   */
  packageName: string;
  /** The shipped product name. Diagnostics and crash reports use this one. */
  productName: string;
  version: string;
  /** Absolute path of the application data directory (already created). */
  userDataDir: string;
  /** Absolute path of the isolated local history repository directory. */
  historyDir: string;
  /** Absolute path of the app's log directory. */
  logsDir: string;
  /**
   * Absolute path of the packaged resources root — `process.resourcesPath`
   * inside an installed build — or the repository's `app/resources`
   * directory when running in development (created on first use so a dev
   * run behaves like an installed one).
   *
   * Bundled tools (the Java engine jar, and an optionally-bundled Java
   * runtime, Git and GitHub CLI) resolve underneath this directory before
   * ever falling back to PATH; see `bundled` below and
   * `src/main/services/bundled.ts`.
   */
  resourcesPath: string;
  platform: PlatformName;
  arch: string;
  versions: {
    electron: string;
    chrome: string;
    node: string;
    v8: string;
  };
  /** True when running through `electron-vite dev`. */
  isDevelopment: boolean;
  /** True when the app is packaged (installed build). */
  isPackaged: boolean;
  /** Milliseconds since epoch at which the main process started. */
  startedAt: number;
}

export type WindowStateKind = 'normal' | 'maximized' | 'minimized' | 'fullscreen';

export interface WindowState {
  kind: WindowStateKind;
  isMaximized: boolean;
  isMinimized: boolean;
  isFullScreen: boolean;
  isFocused: boolean;
  width: number;
  height: number;
  x: number;
  y: number;
}

/* ------------------------------------------------------------------ */
/* Settings persistence                                                */
/* ------------------------------------------------------------------ */

/** Where a stored settings value came from. Surfaced beside every control. */
export type SettingsProvenance = 'user' | 'default' | 'scheduled' | 'imported';

export interface SettingsRecord {
  values: Record<string, unknown>;
  provenance: Record<string, SettingsProvenance>;
  /** Schema version of the persisted document. */
  schemaVersion: number;
  /** ISO-8601 timestamp of the last successful write. */
  updatedAt: string;
}

/* ------------------------------------------------------------------ */
/* Credential vault                                                    */
/* ------------------------------------------------------------------ */

export interface VaultStatus {
  /** True when the OS-backed encryption service is usable on this machine. */
  encryptionAvailable: boolean;
  /** Human-readable backend name, e.g. "dpapi", "keychain", "basic_text". */
  backend: string;
  /** Number of stored entries. Never their values. */
  entryCount: number;
}

/* ------------------------------------------------------------------ */
/* Dialogs and shell                                                   */
/* ------------------------------------------------------------------ */

export interface FileFilter {
  name: string;
  /** Extensions without the leading dot, e.g. ['json', 'jsonl']. */
  extensions: string[];
}

export interface OpenDialogOptions {
  title?: string;
  defaultPath?: string;
  buttonLabel?: string;
  filters?: FileFilter[];
  multiSelections?: boolean;
  showHiddenFiles?: boolean;
}

export interface SaveDialogOptions {
  title?: string;
  defaultPath?: string;
  buttonLabel?: string;
  filters?: FileFilter[];
}

/* ------------------------------------------------------------------ */
/* File system (scoped)                                                */
/* ------------------------------------------------------------------ */

export interface FileStat {
  path: string;
  exists: boolean;
  isFile: boolean;
  isDirectory: boolean;
  size: number;
  /** ISO-8601. */
  modifiedAt: string;
}

export interface DirectoryEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modifiedAt: string;
}

/* ------------------------------------------------------------------ */
/* Child processes                                                     */
/* ------------------------------------------------------------------ */

export interface SpawnOptions {
  /** Executable, e.g. 'java', 'docker', 'node'. Resolved on PATH. */
  command: string;
  args?: string[];
  cwd?: string;
  /** Extra environment entries merged over the inherited environment. */
  env?: Record<string, string>;
  /**
   * Hard ceiling on retained output per stream. Beyond it the stream is
   * truncated and a `truncated` event is emitted; the process keeps running.
   * Defaults to 4 MiB.
   */
  maxOutputBytes?: number;
  /** Kill the process after this many milliseconds. 0 or absent means no limit. */
  timeoutMs?: number;
}

export interface SpawnHandle {
  /** Opaque id used to address this process for the rest of its life. */
  id: string;
  pid: number | null;
  command: string;
  args: string[];
  startedAt: string;
}

export type ProcessEvent =
  | { id: string; kind: 'stdout'; chunk: string }
  | { id: string; kind: 'stderr'; chunk: string }
  | { id: string; kind: 'truncated'; stream: 'stdout' | 'stderr'; retainedBytes: number }
  | { id: string; kind: 'exit'; code: number | null; signal: string | null }
  | { id: string; kind: 'error'; message: string };

export interface ProcessSummary {
  id: string;
  pid: number | null;
  command: string;
  args: string[];
  running: boolean;
  startedAt: string;
  endedAt: string | null;
  exitCode: number | null;
  signal: string | null;
}

/* ------------------------------------------------------------------ */
/* Local history repository                                            */
/* ------------------------------------------------------------------ */

/** `git` when a real repository is in use, `journal` when git is unavailable. */
export type HistoryBackend = 'git' | 'journal';

export interface HistoryEntry {
  /**
   * Zero-padded monotonic entry id, stable across both backends. With the git
   * backend the same id appears in the commit subject, so an entry can be found
   * in the repository log without a second index.
   */
  id: string;
  /** Short label of what changed, e.g. "Deleted the download profile". */
  action: string;
  /** ISO-8601. */
  timestamp: string;
  /** Feature or core module that recorded it, e.g. "core.settings". */
  source: string;
  /** Redacted payload. Never contains credentials or vocabulary content. */
  payload: unknown;
}

export interface HistoryStatus {
  backend: HistoryBackend;
  path: string;
  entryCount: number;
  /** Present when the git backend could not be used, explaining why. */
  degradedReason?: string;
}

export interface HistoryQuery {
  /** Inclusive ISO-8601 lower bound. */
  from?: string;
  /** Inclusive ISO-8601 upper bound. */
  to?: string;
  /** Restrict to these action labels. Empty or absent means all. */
  actions?: string[];
  /** Plain substring match over action, source and serialized payload. */
  text?: string;
  limit?: number;
}

/* ------------------------------------------------------------------ */
/* Outbound HTTP (deny by default)                                     */
/* ------------------------------------------------------------------ */

export interface HttpRequest {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD';
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  /** Hard ceiling on the response body in bytes. Defaults to 8 MiB. */
  maxBytes?: number;
  /**
   * How the response body is handed back. `utf8` is the default and is the only
   * sensible choice for text; `base64` is for a binary body such as an image,
   * where decoding the bytes as text would destroy them.
   */
  responseEncoding?: 'utf8' | 'base64';
  /**
   * How many redirects to follow, capped at 4. Defaults to 0, which refuses a
   * redirect outright. Every hop is re-checked against the allow rules, so a
   * redirect to a host nobody allowed is refused exactly as a direct request to
   * it would be.
   */
  maxRedirects?: number;
}

export interface HttpResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  /** True when the body was cut off at `maxBytes`. */
  truncated: boolean;
  /** How `body` is encoded. Absent means `utf8`, which is the default. */
  bodyEncoding?: 'utf8' | 'base64';
  /** The URL the body actually came from, after any followed redirect. */
  finalUrl?: string;
}

export interface HttpAllowRule {
  /** Exact host, or a leading-dot suffix such as `.example.org`. */
  host: string;
  /** Allowed schemes. `http` is only permitted for loopback hosts. */
  schemes: Array<'http' | 'https'>;
  /** Which feature asked for it, so the settings surface can explain the rule. */
  owner: string;
  /** Why the rule exists, shown to the user. */
  reason: string;
}

/* ------------------------------------------------------------------ */
/* World vault (a version-controlled repository for a downloaded world) */
/* ------------------------------------------------------------------ */

/**
 * One commit in a world's vault.
 *
 * `kind` is read back from a `Vault-Kind:` trailer this feature writes into
 * every commit it makes itself, so the timeline can label a restore or a
 * prune differently from an ordinary settled snapshot without guessing from
 * the subject text. A commit with no trailer (foreign, or made before this
 * convention existed) reads as `snapshot`.
 */
export type WorldVaultCommitKind = 'snapshot' | 'restore' | 'edit' | 'prune';

export interface WorldVaultCommit {
  hash: string;
  shortHash: string;
  /** ISO-8601, the commit's own committer date. */
  timestampIso: string;
  subject: string;
  kind: WorldVaultCommitKind;
  filesChanged: number;
  /** Best-effort byte delta across the files this commit touched. */
  bytesChanged: number;
}

export interface WorldVaultStatus {
  exists: boolean;
  worldPath: string;
  /** Always equal to `worldPath`: the repository lives inside the world folder. */
  repoRoot: string | null;
  branch: string | null;
  commitCount: number;
  lastCommit: WorldVaultCommit | null;
  runnerActive: boolean;
  /** True from the first detected write until the quiet period commits it. */
  waitingForSettle: boolean;
  /** Milliseconds since the last detected write, when `waitingForSettle` is true. */
  msSinceLastActivity: number | null;
  quietPeriodMs: number;
  pollIntervalMs: number;
  /** Size of `.git`: the actual cost of retaining history. */
  gitDirBytes: number;
  /** Size of the working tree: the current world's own size. */
  workingTreeBytes: number;
  remoteUrl: string | null;
  /** Set when `git` itself is unavailable or the repository could not be read. */
  degradedReason: string | null;
}

export interface WorldVaultCommitQuery {
  worldPath: string;
  offset?: number;
  limit?: number;
}

export interface WorldVaultPermission {
  granted: boolean;
  /** Always present when `granted` is false; names the exact region and cause. */
  reason: string | null;
}

export interface WorldVaultPublishPreflight {
  worldPath: string;
  worldSizeBytes: number;
  fileCount: number;
  hasRemote: boolean;
  remoteUrl: string | null;
  gitAvailable: boolean;
  ghAvailable: boolean;
  ghAuthenticated: boolean;
  ghAccountLogin: string | null;
}

export interface WorldVaultPruneResult {
  removedCommitCount: number;
  reclaimedBytes: number;
}

export type WorldVaultEvent =
  | { worldPath: string; kind: 'status'; status: WorldVaultStatus }
  | { worldPath: string; kind: 'commit'; commit: WorldVaultCommit; status: WorldVaultStatus }
  | { worldPath: string; kind: 'permission-denied'; regionPath: string; reason: string };

/* ------------------------------------------------------------------ */
/* External editor                                                     */
/* ------------------------------------------------------------------ */

export interface EditorCandidate {
  id: string;
  /** e.g. "Visual Studio Code". */
  name: string;
  /** Absolute path or bare command resolved on PATH. */
  command: string;
  /** True when the executable was actually found on this machine. */
  available: boolean;
  /** True when this build opens a directory as a workspace root. */
  supportsFolder: boolean;
}

/* ------------------------------------------------------------------ */
/* Bundled tools                                                       */
/* ------------------------------------------------------------------ */

/**
 * A dependency the application can find already sitting inside its own
 * installation, before ever handing the user a link to fetch it themselves.
 *
 * `engineJar` is the Java engine `electron-builder.yml` always ships under
 * `<resources>/engine/world-downloader.jar`. `java`, `git` and `gh` are
 * trimmed runtimes a release build can additionally bundle under
 * `<resources>/runtime/<name>/...`; a build that omits one simply falls back
 * to PATH, exactly as `resolve` below does.
 *
 * `node` is different from the four above: there is no file to look for,
 * because Electron already embeds a complete Node runtime inside its own
 * executable. Resolving it hands back `process.execPath` (origin `bundled`)
 * together with the one environment variable — `ELECTRON_RUN_AS_NODE` — that
 * turns that same executable into plain `node` for the spawned child only.
 * Only when that is somehow unusable does it fall back to a system `node` on
 * PATH, exactly like the other tools.
 *
 * `scraperScript` is the bundled copy of the standalone `scraper/scrape.js`
 * project (`electron-builder.yml`'s `extraResources`, packaged alongside the
 * engine jar) at `<resources>/scraper/scrape.js` — a plain file lookup like
 * `engineJar`, with no PATH fallback, since a missing bundled copy has no
 * meaningful "on PATH" equivalent.
 */
export type BundledTool = 'java' | 'git' | 'gh' | 'engineJar' | 'node' | 'scraperScript';

export interface BundledToolResolution {
  /** Absolute path to the resolved executable or file. */
  path: string;
  /** Whether the path came from inside the application or from PATH. */
  origin: 'bundled' | 'path';
  /**
   * Extra environment variables the child process needs, merged over
   * `process.env` by `process.spawn`. Empty for every tool except `node`
   * resolved to the embedded Electron runtime, which needs
   * `ELECTRON_RUN_AS_NODE=1` set to behave as a plain interpreter.
   */
  env?: Record<string, string>;
}

/* ------------------------------------------------------------------ */
/* Dim sum surprise                                                    */
/* ------------------------------------------------------------------ */

export interface DimSumDraw {
  /** True exactly when this launch won the draw. */
  won: boolean;
  /** The random value that was drawn, so the odds are auditable. */
  roll: number;
  /** The probability the roll was compared against (0.10). */
  probability: number;
  /**
   * A second independent value in [0, 1). The main process decides *whether* the
   * surprise happens; the renderer's dim sum module owns the dish catalogue and
   * uses this to decide *which* dish, so the catalogue never has to live in the
   * main process.
   */
  selector: number;
  /** Stable id of the chosen dish, filled in by the renderer's dim sum module. */
  dishId?: string;
}

/* ------------------------------------------------------------------ */
/* Main -> renderer push events                                        */
/* ------------------------------------------------------------------ */

export interface StudioEvents {
  'window:state': WindowState;
  'process:event': ProcessEvent;
  'dimsum:surprise': DimSumDraw;
  'app:before-quit': { reason: string };
  'app:theme-source-changed': { shouldUseDarkColors: boolean };
  'worldvault:event': WorldVaultEvent;
}

export type StudioEventName = keyof StudioEvents;

/* ------------------------------------------------------------------ */
/* The bridge object                                                   */
/* ------------------------------------------------------------------ */

export interface StudioApi {
  /** Resolved once at preload time; never changes for the life of the window. */
  readonly info: AppInfo;

  app: {
    getInfo(): Promise<Result<AppInfo>>;
    /** Relaunches the application. Used only by an explicit user action. */
    relaunch(): Promise<Result<void>>;
    quit(): Promise<Result<void>>;
    /** Opens the app's own data directory in the platform file manager. */
    revealUserData(): Promise<Result<void>>;
  };

  window: {
    minimize(): Promise<Result<void>>;
    /** Toggles between maximized and restored. */
    toggleMaximize(): Promise<Result<WindowState>>;
    maximize(): Promise<Result<WindowState>>;
    unmaximize(): Promise<Result<WindowState>>;
    close(): Promise<Result<void>>;
    setFullScreen(on: boolean): Promise<Result<WindowState>>;
    getState(): Promise<Result<WindowState>>;
    setTitle(title: string): Promise<Result<void>>;
    /** Keeps this window above others. Used by download progress surfaces. */
    setAlwaysOnTop(on: boolean): Promise<Result<void>>;
  };

  settings: {
    readAll(): Promise<Result<SettingsRecord>>;
    /** Writes the whole document atomically. Returns the stored record. */
    writeAll(record: SettingsRecord): Promise<Result<SettingsRecord>>;
    /** Absolute path of the settings file, for the provenance explanation. */
    filePath(): Promise<Result<string>>;
  };

  vault: {
    status(): Promise<Result<VaultStatus>>;
    /** Stores a secret. The value never returns to the renderer afterwards. */
    set(account: string, secret: string): Promise<Result<void>>;
    /**
     * Reads a secret back. Only a flow the user just initiated should call
     * this; the value must not be logged, exported or rendered.
     */
    get(account: string): Promise<Result<string | null>>;
    has(account: string): Promise<Result<boolean>>;
    delete(account: string): Promise<Result<void>>;
    /** Account keys only. Never values, never lengths. */
    listAccounts(): Promise<Result<string[]>>;
  };

  dialog: {
    openFile(options?: OpenDialogOptions): Promise<Result<string[] | null>>;
    openFolder(options?: OpenDialogOptions): Promise<Result<string[] | null>>;
    saveFile(options?: SaveDialogOptions): Promise<Result<string | null>>;
  };

  fs: {
    stat(path: string): Promise<Result<FileStat>>;
    readText(path: string, maxBytes?: number): Promise<Result<string>>;
    writeText(path: string, contents: string): Promise<Result<void>>;
    readDirectory(path: string): Promise<Result<DirectoryEntry[]>>;
    ensureDirectory(path: string): Promise<Result<void>>;
    /** Reads a file the user just picked, as a base64 string. */
    readBase64(path: string, maxBytes?: number): Promise<Result<string>>;
  };

  shell: {
    openPath(path: string): Promise<Result<void>>;
    showItemInFolder(path: string): Promise<Result<void>>;
    /** Opens an http(s) URL in the user's browser. Refuses other schemes. */
    openExternal(url: string): Promise<Result<void>>;
  };

  editor: {
    /** Probes the machine for known editors. Visual Studio Code is preferred. */
    detect(): Promise<Result<EditorCandidate[]>>;
    /** Opens a file. `folder` opens the containing directory as a workspace. */
    open(target: string, options?: { editorId?: string; asFolder?: boolean }): Promise<Result<void>>;
  };

  bundled: {
    /**
     * Resolves a dependency's path: bundled inside the application first,
     * PATH second, `null` when neither has it. Read-only — this only reports
     * where a tool would be found, it never spawns or executes anything.
     */
    resolve(tool: BundledTool): Promise<Result<BundledToolResolution | null>>;
  };

  process: {
    spawn(options: SpawnOptions): Promise<Result<SpawnHandle>>;
    /** Sends a line to the process's stdin. */
    write(id: string, data: string): Promise<Result<void>>;
    kill(id: string, signal?: string): Promise<Result<void>>;
    list(): Promise<Result<ProcessSummary[]>>;
    /** Retained output so far, oldest first. */
    readOutput(id: string, stream: 'stdout' | 'stderr'): Promise<Result<string>>;
  };

  history: {
    status(): Promise<Result<HistoryStatus>>;
    /** Appends one entry. Restores are recorded as new entries, never rewrites. */
    record(action: string, source: string, payload: unknown): Promise<Result<HistoryEntry>>;
    list(query?: HistoryQuery): Promise<Result<HistoryEntry[]>>;
    /** The distinct action labels actually present, with counts. */
    actions(): Promise<Result<Array<{ action: string; count: number }>>>;
    /** Reads back the stored payload of one entry. */
    read(id: string): Promise<Result<HistoryEntry | null>>;
    /** Removes entries older than the retention window, honestly reporting how many. */
    prune(olderThanIso: string): Promise<Result<{ removed: number }>>;
  };

  http: {
    /** Deny by default: a host must be allow-listed before this succeeds. */
    request(request: HttpRequest): Promise<Result<HttpResponse>>;
    /** Adds a rule for the current session. Rules are not persisted silently. */
    allow(rule: HttpAllowRule): Promise<Result<void>>;
    rules(): Promise<Result<HttpAllowRule[]>>;
    revoke(host: string): Promise<Result<void>>;
  };

  events: {
    /** Subscribes to a push channel. Returns an unsubscribe function. */
    on<K extends StudioEventName>(name: K, handler: (payload: StudioEvents[K]) => void): () => void;
  };

  /**
   * The version-controlled vault for a downloaded world.
   *
   * The repository lives inside the world folder (`<worldPath>/.git`) so it
   * travels with it. Every mutating call is serialized per world path in the
   * main process, so a background commit and a user-initiated restore can
   * never interleave into a corrupt index.
   */
  worldVault: {
    create(worldPath: string): Promise<Result<WorldVaultStatus>>;
    status(worldPath: string): Promise<Result<WorldVaultStatus>>;
    /** Starts (or reconfigures) the settle-and-commit background runner. */
    startRunner(
      worldPath: string,
      options: { quietPeriodMs: number; pollIntervalMs: number }
    ): Promise<Result<WorldVaultStatus>>;
    stopRunner(worldPath: string): Promise<Result<WorldVaultStatus>>;
    /** Commits the current state immediately. Used by the runner and by a
     *  sibling feature that just finished an edit (a chunk copy or removal). */
    commitNow(
      worldPath: string,
      message: string,
      kind: WorldVaultCommitKind
    ): Promise<Result<WorldVaultCommit | null>>;
    commits(query: WorldVaultCommitQuery): Promise<Result<WorldVaultCommit[]>>;
    /** Restores the working tree to a commit. Always records a NEW commit;
     *  the state being replaced is committed first if it was not already. */
    restore(worldPath: string, hash: string): Promise<Result<WorldVaultCommit>>;
    /** Hazard 6: refuses access to a region file the downloader may still be
     *  writing. Granted only once that file's writes have gone quiet. */
    requestRegionAccess(worldPath: string, relativePath: string): Promise<Result<WorldVaultPermission>>;
    publishPreflight(worldPath: string): Promise<Result<WorldVaultPublishPreflight>>;
    setRemote(worldPath: string, url: string): Promise<Result<void>>;
    push(worldPath: string): Promise<Result<{ output: string }>>;
    /** Creates a new GitHub repository from the vault and pushes to it, via `gh`. */
    createGithubRepo(
      worldPath: string,
      options: { name: string; visibility: 'public' | 'private' }
    ): Promise<Result<{ url: string; output: string }>>;
    /** Safe compaction. Never removes a commit. */
    gc(worldPath: string): Promise<Result<{ gitDirBytes: number }>>;
    /** Destructive: squashes every commit before `beforeHash` into one. Only
     *  the detail is lost — the tree at `beforeHash` remains exactly intact. */
    prune(worldPath: string, beforeHash: string): Promise<Result<WorldVaultPruneResult>>;
    /**
     * Checks one commit's tree out to `destinationDirectory` via
     * `git worktree add --detach`, without touching the live world at all —
     * for a sibling feature (a render) that needs a commit's files on disk
     * but must never race the live, possibly-still-downloading world.
     */
    exportCommitTree(worldPath: string, hash: string, destinationDirectory: string): Promise<Result<{ path: string }>>;
  };
}

declare global {
  interface Window {
    studio: StudioApi;
  }
}
