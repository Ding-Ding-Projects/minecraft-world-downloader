import { BrowserWindow, app, nativeTheme, screen, session, shell } from 'electron';
import { randomInt } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import type { DimSumDraw } from '../shared/api';
import {
  buildAppInfo,
  describeWindow,
  registerAllHandlers,
  setMainWindowAccessor,
  unregisteredChannels
} from './ipc';
import { attachWorldVaultBroadcast, stopAllRunners } from './features/world-vault';
import { PRODUCT_NAME, applyStablePaths, windowStateFilePath } from './paths';
import { attachProcessBroadcast, killAll } from './services/processes';
import { handleSquirrelEvent } from './squirrel';

/**
 * Squirrel runs the freshly installed executable with a lifecycle argument and
 * waits for it to do that event's housekeeping and exit. This is asked first --
 * before the single-instance lock, before any path is pinned, before a window
 * exists -- because all of that costs time Squirrel is counting, and none of it
 * applies to a housekeeping run.
 *
 * `handleSquirrelEvent()` owns the quit for the events it answers, and quits
 * only once `Update.exe` has actually finished. Quitting here as well would end
 * the process while the shortcut was still being created, which is precisely
 * the failure this handling exists to remove.
 */
const IS_SQUIRREL_RUN = handleSquirrelEvent();

const STARTED_AT = Date.now();
const IS_DEVELOPMENT = !app.isPackaged && process.env.ELECTRON_RENDERER_URL !== undefined;

/** The application is a single window; a second launch focuses the first one. */
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

if (!IS_SQUIRREL_RUN) {
  applyStablePaths();
}

let mainWindow: BrowserWindow | null = null;
setMainWindowAccessor(() => mainWindow);
attachProcessBroadcast(() => mainWindow);
attachWorldVaultBroadcast(() => mainWindow);

/* ------------------------------------------------------------------ */
/* Window state persistence                                            */
/* ------------------------------------------------------------------ */

interface PersistedWindowState {
  width: number;
  height: number;
  x?: number;
  y?: number;
  maximized: boolean;
}

const DEFAULT_STATE: PersistedWindowState = { width: 1440, height: 920, maximized: false };
const MIN_WIDTH = 900;
const MIN_HEIGHT = 620;

async function readWindowState(): Promise<PersistedWindowState> {
  try {
    const raw = await fs.readFile(windowStateFilePath(), 'utf8');
    const parsed = JSON.parse(raw) as Partial<PersistedWindowState>;
    return {
      width: clampNumber(parsed.width, MIN_WIDTH, 10_000, DEFAULT_STATE.width),
      height: clampNumber(parsed.height, MIN_HEIGHT, 10_000, DEFAULT_STATE.height),
      x: typeof parsed.x === 'number' ? parsed.x : undefined,
      y: typeof parsed.y === 'number' ? parsed.y : undefined,
      maximized: parsed.maximized === true
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

async function writeWindowState(window: BrowserWindow): Promise<void> {
  if (window.isDestroyed()) return;
  const maximized = window.isMaximized();
  const bounds = maximized ? window.getNormalBounds() : window.getBounds();
  const state: PersistedWindowState = {
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    maximized
  };
  try {
    await fs.writeFile(windowStateFilePath(), `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  } catch {
    /* losing the remembered geometry is not worth failing a quit over */
  }
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

/**
 * Keeps the restored geometry on a display that actually exists and leaves the
 * title bar grabbable. A window remembered on a monitor that has since been
 * unplugged otherwise opens somewhere the pointer cannot reach.
 */
function fitToDisplay(state: PersistedWindowState): PersistedWindowState {
  const area =
    state.x !== undefined && state.y !== undefined
      ? screen.getDisplayMatching({ x: state.x, y: state.y, width: state.width, height: state.height }).workArea
      : screen.getPrimaryDisplay().workArea;

  const width = Math.min(state.width, Math.max(MIN_WIDTH, Math.floor(area.width * 0.98)));
  const height = Math.min(state.height, Math.max(MIN_HEIGHT, Math.floor(area.height * 0.98)));
  let x = state.x;
  let y = state.y;
  if (x === undefined || y === undefined || x + width < area.x + 80 || x > area.x + area.width - 80) {
    x = Math.round(area.x + (area.width - width) / 2);
    y = Math.round(area.y + (area.height - height) / 2);
  }
  if (y !== undefined && y < area.y) y = area.y;
  return { width, height, x, y, maximized: state.maximized };
}

/* ------------------------------------------------------------------ */
/* Dim sum surprise                                                    */
/* ------------------------------------------------------------------ */

/**
 * One fresh draw per launch, at most once per launch, and there is no setting
 * that turns it off. The roll and the probability travel with the event so the
 * odds stay auditable rather than asserted.
 */
let dimSumDrawn = false;

function drawDimSum(): DimSumDraw {
  dimSumDrawn = true;
  const roll = randomInt(0, 10_000) / 10_000;
  const selector = randomInt(0, 10_000) / 10_000;
  const probability = 0.1;
  return { won: roll < probability, roll, probability, selector };
}

/* ------------------------------------------------------------------ */
/* Window creation                                                     */
/* ------------------------------------------------------------------ */

async function createWindow(): Promise<BrowserWindow> {
  const state = fitToDisplay(await readWindowState());

  const window = new BrowserWindow({
    width: state.width,
    height: state.height,
    x: state.x,
    y: state.y,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    show: false,
    // Frameless: the application draws its own Material title bar and window
    // controls, so the operating system's default chrome is never product chrome.
    frame: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#101418' : '#f8fafd',
    title: PRODUCT_NAME,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
      spellcheck: false,
      devTools: !app.isPackaged
    }
  });

  window.once('ready-to-show', () => {
    if (state.maximized) window.maximize();
    window.show();
  });

  const pushState = () => {
    if (window.isDestroyed()) return;
    window.webContents.send('window:state', describeWindow(window));
  };
  window.on('maximize', pushState);
  window.on('unmaximize', pushState);
  window.on('minimize', pushState);
  window.on('restore', pushState);
  window.on('focus', pushState);
  window.on('blur', pushState);
  window.on('resize', pushState);
  window.on('move', pushState);
  window.on('enter-full-screen', pushState);
  window.on('leave-full-screen', pushState);

  let saveTimer: NodeJS.Timeout | null = null;
  const scheduleSave = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => void writeWindowState(window), 400);
  };
  window.on('resize', scheduleSave);
  window.on('move', scheduleSave);
  window.on('close', () => {
    if (saveTimer) clearTimeout(saveTimer);
    void writeWindowState(window);
  });

  window.on('closed', () => {
    mainWindow = null;
  });

  // Navigation stays inside the application. A link goes to the user's browser,
  // and nothing opens a second Electron window behind their back.
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) void shell.openExternal(url);
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, url) => {
    const current = window.webContents.getURL();
    if (url !== current) {
      event.preventDefault();
      if (url.startsWith('https://') || url.startsWith('http://')) void shell.openExternal(url);
    }
  });
  window.webContents.on('did-finish-load', () => {
    if (!dimSumDrawn) {
      const draw = drawDimSum();
      // Non-blocking and never in the way of startup: it is sent after the first
      // paint, and the renderer shows it as a transient surface that never takes
      // focus and never gates anything.
      setTimeout(() => {
        if (!window.isDestroyed()) window.webContents.send('dimsum:surprise', draw);
      }, 1500);
    }
  });

  const rendererUrl = process.env.ELECTRON_RENDERER_URL;
  if (rendererUrl) {
    await window.loadURL(rendererUrl);
  } else {
    await window.loadFile(join(__dirname, '../renderer/index.html'));
  }

  return window;
}

/* ------------------------------------------------------------------ */
/* Session hardening                                                   */
/* ------------------------------------------------------------------ */

function hardenSession(): void {
  const current = session.defaultSession;

  // Nothing in this application needs a device, a microphone, a camera, a
  // location or a notification permission, so every request is refused.
  current.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  current.setPermissionCheckHandler(() => false);

  // The renderer loads only files this build emitted. Development additionally
  // needs the Vite dev server's own websocket and inline styles.
  const policy = IS_DEVELOPMENT
    ? "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' ws: http://localhost:* http://127.0.0.1:*; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'"
    : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'";

  current.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [policy]
      }
    });
  });
}

/* ------------------------------------------------------------------ */
/* Lifecycle                                                           */
/* ------------------------------------------------------------------ */

app.on('second-instance', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void createWindow().then((window) => {
      mainWindow = window;
    });
  }
});

app.on('before-quit', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('app:before-quit', { reason: 'quit' });
  }
  killAll();
  stopAllRunners();
});

// A renderer must never be able to reach a Node module through a preload it did
// not get, so any attempt to attach a foreign preload is refused outright.
app.on('web-contents-created', (_event, contents) => {
  contents.on('will-attach-webview', (event) => event.preventDefault());
});

if (gotLock && !IS_SQUIRREL_RUN) {
  void app.whenReady().then(async () => {
    hardenSession();
    registerAllHandlers({ startedAt: STARTED_AT, isDevelopment: IS_DEVELOPMENT });

    const missing = unregisteredChannels();
    if (missing.length > 0) {
      // Fail loudly at startup rather than at the moment a feature calls a
      // channel that was never wired up.
      throw new Error(`These IPC channels are on the allow-list but have no handler: ${missing.join(', ')}`);
    }

    // No `nativeTheme.on('updated', ...)` broadcast here: it would have
    // nothing to reach. Electron keeps a renderer's own
    // `prefers-color-scheme` media query in lockstep with `nativeTheme`, and
    // `src/renderer/core/theme.ts` (`initTheme()`) already subscribes to that
    // query directly -- `window.matchMedia('(prefers-color-scheme: dark)')
    // .addEventListener('change', ...)` -- and re-applies the theme whenever
    // the OS scheme changes while the user's mode setting is 'system'. A
    // main-process IPC event for the same fact was wired up, allow-listed in
    // `shared/channels.ts`/`shared/api.ts`, and sent on every OS theme
    // change, but no renderer feature ever subscribed to it: `theme-source-changed`
    // had no listener anywhere in `src/renderer`. Removing the dead send here
    // rather than leaving it in place, since a channel firing into nothing
    // implies a behaviour ("main tells the renderer when the theme changes")
    // the app does not actually rely on for this.

    mainWindow = await createWindow();

    // Touching the info builder once at startup makes the data directories exist
    // before any feature asks for them.
    buildAppInfo(STARTED_AT, IS_DEVELOPMENT);
  });
}
