import { contextBridge, ipcRenderer } from 'electron';
import type {
  AppInfo,
  BundledTool,
  BundledToolResolution,
  DirectoryEntry,
  EditorCandidate,
  FileStat,
  HistoryEntry,
  HistoryQuery,
  HistoryStatus,
  HttpAllowRule,
  HttpRequest,
  HttpResponse,
  OpenDialogOptions,
  ProcessSummary,
  Result,
  SaveDialogOptions,
  SettingsRecord,
  SpawnHandle,
  SpawnOptions,
  StudioApi,
  StudioEventName,
  StudioEvents,
  VaultStatus,
  WindowState,
  WorldVaultCommit,
  WorldVaultCommitKind,
  WorldVaultCommitQuery,
  WorldVaultPermission,
  WorldVaultPruneResult,
  WorldVaultPublishPreflight,
  WorldVaultStatus
} from '../shared/api';
import { EVENT_CHANNELS, SYNC_INFO_CHANNEL, isEventChannel, type InvokeChannel } from '../shared/channels';

/**
 * The whole privileged surface, in one place.
 *
 * `contextIsolation` is on and `nodeIntegration` is off, so this bridge is the
 * only route from renderer code to the operating system. Nothing here forwards
 * an arbitrary channel name from the renderer: each method names its own
 * channel literally, so a feature cannot reach a channel this file did not
 * choose to expose.
 */

function invoke<T>(channel: InvokeChannel, ...args: unknown[]): Promise<Result<T>> {
  return ipcRenderer.invoke(channel, ...args).then(
    (result: Result<T>) => result,
    (error: unknown) => ({
      ok: false as const,
      error: error instanceof Error ? error.message : String(error)
    })
  );
}

const info = ipcRenderer.sendSync(SYNC_INFO_CHANNEL) as AppInfo;

const api: StudioApi = {
  info,

  app: {
    getInfo: () => invoke<AppInfo>('app:get-info'),
    relaunch: () => invoke<void>('app:relaunch'),
    quit: () => invoke<void>('app:quit'),
    revealUserData: () => invoke<void>('app:reveal-user-data')
  },

  window: {
    minimize: () => invoke<void>('window:minimize'),
    toggleMaximize: () => invoke<WindowState>('window:toggle-maximize'),
    maximize: () => invoke<WindowState>('window:maximize'),
    unmaximize: () => invoke<WindowState>('window:unmaximize'),
    close: () => invoke<void>('window:close'),
    setFullScreen: (on: boolean) => invoke<WindowState>('window:set-full-screen', on),
    getState: () => invoke<WindowState>('window:get-state'),
    setTitle: (title: string) => invoke<void>('window:set-title', title),
    setAlwaysOnTop: (on: boolean) => invoke<void>('window:set-always-on-top', on)
  },

  settings: {
    readAll: () => invoke<SettingsRecord>('settings:read-all'),
    writeAll: (record: SettingsRecord) => invoke<SettingsRecord>('settings:write-all', record),
    filePath: () => invoke<string>('settings:file-path')
  },

  vault: {
    status: () => invoke<VaultStatus>('vault:status'),
    set: (account: string, secret: string) => invoke<void>('vault:set', account, secret),
    get: (account: string) => invoke<string | null>('vault:get', account),
    has: (account: string) => invoke<boolean>('vault:has', account),
    delete: (account: string) => invoke<void>('vault:delete', account),
    listAccounts: () => invoke<string[]>('vault:list-accounts')
  },

  dialog: {
    openFile: (options?: OpenDialogOptions) => invoke<string[] | null>('dialog:open-file', options ?? {}),
    openFolder: (options?: OpenDialogOptions) => invoke<string[] | null>('dialog:open-folder', options ?? {}),
    saveFile: (options?: SaveDialogOptions) => invoke<string | null>('dialog:save-file', options ?? {})
  },

  fs: {
    stat: (path: string) => invoke<FileStat>('fs:stat', path),
    readText: (path: string, maxBytes?: number) => invoke<string>('fs:read-text', path, maxBytes),
    writeText: (path: string, contents: string) => invoke<void>('fs:write-text', path, contents),
    readDirectory: (path: string) => invoke<DirectoryEntry[]>('fs:read-directory', path),
    ensureDirectory: (path: string) => invoke<void>('fs:ensure-directory', path),
    readBase64: (path: string, maxBytes?: number) => invoke<string>('fs:read-base64', path, maxBytes)
  },

  shell: {
    openPath: (path: string) => invoke<void>('shell:open-path', path),
    showItemInFolder: (path: string) => invoke<void>('shell:show-item-in-folder', path),
    openExternal: (url: string) => invoke<void>('shell:open-external', url)
  },

  editor: {
    detect: () => invoke<EditorCandidate[]>('editor:detect'),
    open: (target: string, options?: { editorId?: string; asFolder?: boolean }) =>
      invoke<void>('editor:open', target, options ?? {})
  },

  bundled: {
    resolve: (tool: BundledTool) => invoke<BundledToolResolution | null>('bundled:resolve-tool', tool)
  },

  process: {
    spawn: (options: SpawnOptions) => invoke<SpawnHandle>('process:spawn', options),
    write: (id: string, data: string) => invoke<void>('process:write', id, data),
    kill: (id: string, signal?: string) => invoke<void>('process:kill', id, signal),
    list: () => invoke<ProcessSummary[]>('process:list'),
    readOutput: (id: string, stream: 'stdout' | 'stderr') => invoke<string>('process:read-output', id, stream)
  },

  history: {
    status: () => invoke<HistoryStatus>('history:status'),
    record: (action: string, source: string, payload: unknown) =>
      invoke<HistoryEntry>('history:record', action, source, payload),
    list: (query?: HistoryQuery) => invoke<HistoryEntry[]>('history:list', query ?? {}),
    actions: () => invoke<Array<{ action: string; count: number }>>('history:actions'),
    read: (id: string) => invoke<HistoryEntry | null>('history:read', id),
    prune: (olderThanIso: string) => invoke<{ removed: number }>('history:prune', olderThanIso)
  },

  http: {
    request: (request: HttpRequest) => invoke<HttpResponse>('http:request', request),
    allow: (rule: HttpAllowRule) => invoke<void>('http:allow', rule),
    rules: () => invoke<HttpAllowRule[]>('http:rules'),
    revoke: (host: string) => invoke<void>('http:revoke', host)
  },

  events: {
    on<K extends StudioEventName>(name: K, handler: (payload: StudioEvents[K]) => void): () => void {
      if (!isEventChannel(name)) {
        throw new Error(`"${name}" is not a push channel. Known channels: ${EVENT_CHANNELS.join(', ')}`);
      }
      const listener = (_event: Electron.IpcRendererEvent, payload: StudioEvents[K]): void => handler(payload);
      ipcRenderer.on(name, listener as never);
      return () => {
        ipcRenderer.removeListener(name, listener as never);
      };
    }
  },

  worldVault: {
    create: (worldPath: string) => invoke<WorldVaultStatus>('worldvault:create', worldPath),
    status: (worldPath: string) => invoke<WorldVaultStatus>('worldvault:status', worldPath),
    startRunner: (worldPath: string, options: { quietPeriodMs: number; pollIntervalMs: number }) =>
      invoke<WorldVaultStatus>('worldvault:start-runner', worldPath, options),
    stopRunner: (worldPath: string) => invoke<WorldVaultStatus>('worldvault:stop-runner', worldPath),
    commitNow: (worldPath: string, message: string, kind: WorldVaultCommitKind) =>
      invoke<WorldVaultCommit | null>('worldvault:commit-now', worldPath, message, kind),
    commits: (query: WorldVaultCommitQuery) => invoke<WorldVaultCommit[]>('worldvault:commits', query),
    restore: (worldPath: string, hash: string) => invoke<WorldVaultCommit>('worldvault:restore', worldPath, hash),
    requestRegionAccess: (worldPath: string, relativePath: string) =>
      invoke<WorldVaultPermission>('worldvault:request-region-access', worldPath, relativePath),
    publishPreflight: (worldPath: string) =>
      invoke<WorldVaultPublishPreflight>('worldvault:publish-preflight', worldPath),
    setRemote: (worldPath: string, url: string) => invoke<void>('worldvault:set-remote', worldPath, url),
    push: (worldPath: string) => invoke<{ output: string }>('worldvault:push', worldPath),
    createGithubRepo: (worldPath: string, options: { name: string; visibility: 'public' | 'private' }) =>
      invoke<{ url: string; output: string }>('worldvault:create-github-repo', worldPath, options),
    gc: (worldPath: string) => invoke<{ gitDirBytes: number }>('worldvault:gc', worldPath),
    prune: (worldPath: string, beforeHash: string) =>
      invoke<WorldVaultPruneResult>('worldvault:prune', worldPath, beforeHash),
    exportCommitTree: (worldPath: string, hash: string, destinationDirectory: string) =>
      invoke<{ path: string }>('worldvault:export-commit-tree', worldPath, hash, destinationDirectory)
  }
};

contextBridge.exposeInMainWorld('studio', api);
