import { BrowserWindow, dialog, ipcMain, shell, app } from 'electron';
import { promises as fs } from 'node:fs';
import { isAbsolute, resolve as resolvePath } from 'node:path';
import type {
  AppInfo,
  DirectoryEntry,
  FileStat,
  OpenDialogOptions,
  Result,
  SaveDialogOptions,
  SettingsRecord,
  WindowState
} from '../shared/api';
import { INVOKE_CHANNELS, SYNC_INFO_CHANNEL, isInvokeChannel, type InvokeChannel } from '../shared/channels';
import { PACKAGE_NAME, PRODUCT_NAME, historyDir, logsDir, settingsFilePath, userDataRoot } from './paths';
import * as editorService from './services/editor';
import * as historyService from './services/history';
import * as netService from './services/net';
import * as processService from './services/processes';
import { readSettings, writeSettings } from './services/settings';
import * as vault from './services/vault';

/* ------------------------------------------------------------------ */
/* Registry                                                            */
/* ------------------------------------------------------------------ */

type Handler = (event: Electron.IpcMainInvokeEvent, ...args: unknown[]) => unknown | Promise<unknown>;

const registered = new Set<InvokeChannel>();

/**
 * Registers one privileged handler.
 *
 * Two guards, not one. The channel must be on the shared allow-list (so a typo
 * cannot quietly open a channel nobody reviewed), and the same channel may not
 * be registered twice (so a later module cannot shadow an earlier handler).
 * Every handler's result is wrapped in the `Result` envelope, so a thrown error
 * crosses the bridge as data rather than as an opaque rejection.
 */
export function registerHandler(channel: InvokeChannel, handler: Handler): void {
  if (!isInvokeChannel(channel)) {
    throw new Error(`Refusing to register "${channel}": it is not on the IPC allow-list.`);
  }
  if (registered.has(channel)) {
    throw new Error(`The IPC channel "${channel}" is already registered.`);
  }
  registered.add(channel);
  ipcMain.handle(channel, async (event, ...args): Promise<Result<unknown>> => {
    if (!isTrustedSender(event)) {
      return { ok: false, error: 'The calling frame is not the application window.', code: 'UNTRUSTED_SENDER' };
    }
    try {
      const value = await handler(event, ...args);
      return { ok: true, value: value === undefined ? null : value };
    } catch (error) {
      return { ok: false, error: describe(error), code: codeOf(error) };
    }
  });
}

/** Channels on the allow-list that nobody registered. Checked at startup. */
export function unregisteredChannels(): InvokeChannel[] {
  return INVOKE_CHANNELS.filter((channel) => !registered.has(channel));
}

function isTrustedSender(event: Electron.IpcMainInvokeEvent): boolean {
  const window = BrowserWindow.fromWebContents(event.sender);
  return window !== null && !window.isDestroyed();
}

function describe(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function codeOf(error: unknown): string | undefined {
  const code = (error as NodeJS.ErrnoException | null)?.code;
  return typeof code === 'string' ? code : undefined;
}

/* ------------------------------------------------------------------ */
/* Window helpers                                                      */
/* ------------------------------------------------------------------ */

let mainWindowRef: () => BrowserWindow | null = () => null;

export function setMainWindowAccessor(accessor: () => BrowserWindow | null): void {
  mainWindowRef = accessor;
}

function requireWindow(): BrowserWindow {
  const window = mainWindowRef();
  if (!window || window.isDestroyed()) throw new Error('The application window is not available.');
  return window;
}

export function describeWindow(window: BrowserWindow): WindowState {
  const bounds = window.getBounds();
  const isMaximized = window.isMaximized();
  const isMinimized = window.isMinimized();
  const isFullScreen = window.isFullScreen();
  const kind: WindowState['kind'] = isFullScreen
    ? 'fullscreen'
    : isMinimized
      ? 'minimized'
      : isMaximized
        ? 'maximized'
        : 'normal';
  return {
    kind,
    isMaximized,
    isMinimized,
    isFullScreen,
    isFocused: window.isFocused(),
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y
  };
}

/* ------------------------------------------------------------------ */
/* Filesystem guards                                                   */
/* ------------------------------------------------------------------ */

const MAX_TEXT_READ = 32 * 1024 * 1024;

function normalizePath(input: unknown): string {
  const value = String(input ?? '');
  if (!value) throw new Error('No path was given.');
  if (value.includes('\0')) throw new Error('A path may not contain a null byte.');
  if (!isAbsolute(value)) throw new Error(`"${value}" is not an absolute path.`);
  return resolvePath(value);
}

/* ------------------------------------------------------------------ */
/* Registration                                                        */
/* ------------------------------------------------------------------ */

export function buildAppInfo(startedAt: number, isDevelopment: boolean): AppInfo {
  return {
    packageName: PACKAGE_NAME,
    productName: PRODUCT_NAME,
    version: app.getVersion(),
    userDataDir: userDataRoot(),
    historyDir: historyDir(),
    logsDir: logsDir(),
    platform: process.platform,
    arch: process.arch,
    versions: {
      electron: process.versions.electron ?? '',
      chrome: process.versions.chrome ?? '',
      node: process.versions.node ?? '',
      v8: process.versions.v8 ?? ''
    },
    isDevelopment,
    isPackaged: app.isPackaged,
    startedAt
  };
}

export function registerAllHandlers(context: { startedAt: number; isDevelopment: boolean }): void {
  /* ---- app ---- */
  // The one synchronous channel: the preload needs the identity before the first
  // renderer module runs, so `window.studio.info` can be a plain property.
  ipcMain.on(SYNC_INFO_CHANNEL, (event) => {
    event.returnValue = buildAppInfo(context.startedAt, context.isDevelopment);
  });
  registerHandler('app:get-info', () => buildAppInfo(context.startedAt, context.isDevelopment));
  registerHandler('app:relaunch', () => {
    app.relaunch();
    app.quit();
  });
  registerHandler('app:quit', () => {
    app.quit();
  });
  registerHandler('app:reveal-user-data', async () => {
    const message = await shell.openPath(userDataRoot());
    if (message) throw new Error(message);
  });

  /* ---- window ---- */
  registerHandler('window:minimize', () => {
    requireWindow().minimize();
  });
  registerHandler('window:toggle-maximize', () => {
    const window = requireWindow();
    if (window.isMaximized()) window.unmaximize();
    else window.maximize();
    return describeWindow(window);
  });
  registerHandler('window:maximize', () => {
    const window = requireWindow();
    window.maximize();
    return describeWindow(window);
  });
  registerHandler('window:unmaximize', () => {
    const window = requireWindow();
    window.unmaximize();
    return describeWindow(window);
  });
  registerHandler('window:close', () => {
    requireWindow().close();
  });
  registerHandler('window:set-full-screen', (_event, on) => {
    const window = requireWindow();
    window.setFullScreen(Boolean(on));
    return describeWindow(window);
  });
  registerHandler('window:get-state', () => describeWindow(requireWindow()));
  registerHandler('window:set-title', (_event, title) => {
    requireWindow().setTitle(String(title ?? PRODUCT_NAME));
  });
  registerHandler('window:set-always-on-top', (_event, on) => {
    requireWindow().setAlwaysOnTop(Boolean(on));
  });

  /* ---- settings ---- */
  registerHandler('settings:read-all', () => readSettings());
  registerHandler('settings:write-all', (_event, record) => writeSettings(record as SettingsRecord));
  registerHandler('settings:file-path', () => settingsFilePath());

  /* ---- vault ---- */
  registerHandler('vault:status', () => vault.status());
  registerHandler('vault:set', (_event, account, secret) => vault.setSecret(String(account), String(secret)));
  registerHandler('vault:get', (_event, account) => vault.getSecret(String(account)));
  registerHandler('vault:has', (_event, account) => vault.hasSecret(String(account)));
  registerHandler('vault:delete', (_event, account) => vault.deleteSecret(String(account)));
  registerHandler('vault:list-accounts', () => vault.listAccounts());

  /* ---- dialog ---- */
  registerHandler('dialog:open-file', async (_event, options) => {
    const opts = (options ?? {}) as OpenDialogOptions;
    const properties: Array<'openFile' | 'multiSelections' | 'showHiddenFiles'> = ['openFile'];
    if (opts.multiSelections) properties.push('multiSelections');
    if (opts.showHiddenFiles) properties.push('showHiddenFiles');
    const result = await dialog.showOpenDialog(requireWindow(), {
      title: opts.title,
      defaultPath: opts.defaultPath,
      buttonLabel: opts.buttonLabel,
      filters: opts.filters,
      properties
    });
    return result.canceled ? null : result.filePaths;
  });
  registerHandler('dialog:open-folder', async (_event, options) => {
    const opts = (options ?? {}) as OpenDialogOptions;
    const properties: Array<'openDirectory' | 'multiSelections' | 'createDirectory'> = [
      'openDirectory',
      'createDirectory'
    ];
    if (opts.multiSelections) properties.push('multiSelections');
    const result = await dialog.showOpenDialog(requireWindow(), {
      title: opts.title,
      defaultPath: opts.defaultPath,
      buttonLabel: opts.buttonLabel,
      properties
    });
    return result.canceled ? null : result.filePaths;
  });
  registerHandler('dialog:save-file', async (_event, options) => {
    const opts = (options ?? {}) as SaveDialogOptions;
    const result = await dialog.showSaveDialog(requireWindow(), {
      title: opts.title,
      defaultPath: opts.defaultPath,
      buttonLabel: opts.buttonLabel,
      filters: opts.filters
    });
    return result.canceled || !result.filePath ? null : result.filePath;
  });

  /* ---- filesystem ---- */
  registerHandler('fs:stat', async (_event, path): Promise<FileStat> => {
    const target = normalizePath(path);
    try {
      const stats = await fs.stat(target);
      return {
        path: target,
        exists: true,
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory(),
        size: stats.size,
        modifiedAt: stats.mtime.toISOString()
      };
    } catch {
      return {
        path: target,
        exists: false,
        isFile: false,
        isDirectory: false,
        size: 0,
        modifiedAt: new Date(0).toISOString()
      };
    }
  });
  registerHandler('fs:read-text', async (_event, path, maxBytes) => {
    const target = normalizePath(path);
    const limit =
      typeof maxBytes === 'number' && maxBytes > 0 ? Math.min(maxBytes, MAX_TEXT_READ) : MAX_TEXT_READ;
    const stats = await fs.stat(target);
    if (stats.size > limit) {
      throw new Error(
        `"${target}" is ${stats.size} bytes, which is beyond the ${limit}-byte read limit. Nothing was read.`
      );
    }
    return fs.readFile(target, 'utf8');
  });
  registerHandler('fs:write-text', async (_event, path, contents) => {
    const target = normalizePath(path);
    await fs.writeFile(target, String(contents ?? ''), 'utf8');
  });
  registerHandler('fs:read-directory', async (_event, path): Promise<DirectoryEntry[]> => {
    const target = normalizePath(path);
    const names = await fs.readdir(target, { withFileTypes: true });
    const out: DirectoryEntry[] = [];
    for (const dirent of names) {
      const child = resolvePath(target, dirent.name);
      let size = 0;
      let modifiedAt = new Date(0).toISOString();
      try {
        const stats = await fs.stat(child);
        size = stats.size;
        modifiedAt = stats.mtime.toISOString();
      } catch {
        /* an entry may vanish between readdir and stat */
      }
      out.push({ name: dirent.name, path: child, isDirectory: dirent.isDirectory(), size, modifiedAt });
    }
    out.sort((a, b) => Number(b.isDirectory) - Number(a.isDirectory) || a.name.localeCompare(b.name));
    return out;
  });
  registerHandler('fs:ensure-directory', async (_event, path) => {
    await fs.mkdir(normalizePath(path), { recursive: true });
  });
  registerHandler('fs:read-base64', async (_event, path, maxBytes) => {
    const target = normalizePath(path);
    const limit =
      typeof maxBytes === 'number' && maxBytes > 0 ? Math.min(maxBytes, MAX_TEXT_READ) : MAX_TEXT_READ;
    const stats = await fs.stat(target);
    if (stats.size > limit) {
      throw new Error(
        `"${target}" is ${stats.size} bytes, which is beyond the ${limit}-byte read limit. Nothing was read.`
      );
    }
    const buffer = await fs.readFile(target);
    return buffer.toString('base64');
  });

  /* ---- shell ---- */
  registerHandler('shell:open-path', async (_event, path) => {
    const message = await shell.openPath(normalizePath(path));
    if (message) throw new Error(message);
  });
  registerHandler('shell:show-item-in-folder', (_event, path) => {
    shell.showItemInFolder(normalizePath(path));
  });
  registerHandler('shell:open-external', async (_event, url) => {
    const value = String(url ?? '');
    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      throw new Error(`"${value}" is not a valid URL.`);
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new Error(`Refusing to open "${parsed.protocol}"; only http and https are permitted.`);
    }
    await shell.openExternal(parsed.toString());
  });

  /* ---- editor ---- */
  registerHandler('editor:detect', () => editorService.detect(true));
  registerHandler('editor:open', (_event, target, options) =>
    editorService.open(String(target), (options ?? {}) as { editorId?: string; asFolder?: boolean })
  );

  /* ---- processes ---- */
  registerHandler('process:spawn', (_event, options) =>
    processService.spawnProcess(options as Parameters<typeof processService.spawnProcess>[0])
  );
  registerHandler('process:write', (_event, id, data) => {
    processService.writeToProcess(String(id), String(data));
  });
  registerHandler('process:kill', (_event, id, signal) => {
    processService.killProcess(String(id), signal === undefined ? undefined : String(signal));
  });
  registerHandler('process:list', () => processService.listProcesses());
  registerHandler('process:read-output', (_event, id, stream) =>
    processService.readOutput(String(id), stream === 'stderr' ? 'stderr' : 'stdout')
  );

  /* ---- history ---- */
  registerHandler('history:status', () => historyService.status());
  registerHandler('history:record', (_event, action, source, payload) =>
    historyService.record(String(action), String(source), payload)
  );
  registerHandler('history:list', (_event, query) =>
    historyService.list((query ?? {}) as Parameters<typeof historyService.list>[0])
  );
  registerHandler('history:actions', () => historyService.actions());
  registerHandler('history:read', (_event, id) => historyService.read(String(id)));
  registerHandler('history:prune', (_event, olderThanIso) => historyService.prune(String(olderThanIso)));

  /* ---- http ---- */
  registerHandler('http:request', (_event, request) =>
    netService.request(request as Parameters<typeof netService.request>[0])
  );
  registerHandler('http:allow', (_event, rule) => {
    netService.allow(rule as Parameters<typeof netService.allow>[0]);
  });
  registerHandler('http:rules', () => netService.listRules());
  registerHandler('http:revoke', (_event, host) => {
    netService.revoke(String(host));
  });
}
