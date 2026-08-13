/**
 * Global test environment setup.
 *
 * Two things the real preload bridge normally supplies and jsdom does not:
 *
 * `window.matchMedia` — several core singletons (`core/theme.ts` is the one
 * that matters here) read it as a class-field initializer, which runs the
 * moment the module is imported, not when a test calls into it. Without a
 * polyfill, importing `core/theme.ts` throws before a single test body runs.
 *
 * `window.studio` — the privileged bridge. Nothing in these suites exercises
 * real file I/O, real settings persistence or a real child process, so every
 * method resolves an honest `{ ok: false }` rather than pretending to succeed.
 * A test that actually needs a specific response overrides the one method it
 * cares about on `window.studio` directly.
 */
import { vi } from 'vitest';

if (typeof window.matchMedia !== 'function') {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false
  })) as unknown as typeof window.matchMedia;
}

function notAvailable(): Promise<{ ok: false; error: string }> {
  return Promise.resolve({ ok: false, error: 'not available in the unit test environment' });
}

function fakeStudio(): typeof window.studio {
  const asyncStub = (..._args: unknown[]) => notAvailable();
  return {
    info: {
      packageName: 'com.worlddownloaderstudio.app',
      productName: 'World Downloader Studio',
      version: '0.0.0-test',
      userDataDir: '/tmp/world-downloader-studio-test',
      historyDir: '/tmp/world-downloader-studio-test/history',
      logsDir: '/tmp/world-downloader-studio-test/logs',
      platform: 'win32',
      arch: 'x64',
      versions: { electron: '0.0.0', chrome: '0.0.0', node: process.version, v8: '0.0.0' },
      isDevelopment: true,
      isPackaged: false,
      startedAt: Date.now()
    },
    app: { getInfo: asyncStub, relaunch: asyncStub, quit: asyncStub, revealUserData: asyncStub } as unknown as typeof window.studio.app,
    window: {
      minimize: asyncStub,
      toggleMaximize: asyncStub,
      maximize: asyncStub,
      unmaximize: asyncStub,
      close: asyncStub,
      setFullScreen: asyncStub,
      getState: asyncStub,
      setTitle: asyncStub,
      setAlwaysOnTop: asyncStub
    } as unknown as typeof window.studio.window,
    settings: { readAll: asyncStub, writeAll: asyncStub, filePath: asyncStub } as unknown as typeof window.studio.settings,
    vault: {
      status: asyncStub,
      set: asyncStub,
      get: asyncStub,
      has: asyncStub,
      delete: asyncStub,
      listAccounts: asyncStub
    } as unknown as typeof window.studio.vault,
    dialog: { openFile: asyncStub, openFolder: asyncStub, saveFile: asyncStub } as unknown as typeof window.studio.dialog,
    fs: {
      stat: asyncStub,
      readText: asyncStub,
      writeText: asyncStub,
      readDirectory: asyncStub,
      ensureDirectory: asyncStub,
      readBase64: asyncStub
    } as unknown as typeof window.studio.fs,
    shell: { openPath: asyncStub, showItemInFolder: asyncStub, openExternal: asyncStub } as unknown as typeof window.studio.shell,
    editor: { detect: asyncStub, open: asyncStub } as unknown as typeof window.studio.editor,
    process: {
      spawn: asyncStub,
      write: asyncStub,
      kill: asyncStub,
      list: asyncStub,
      readOutput: asyncStub
    } as unknown as typeof window.studio.process,
    history: {
      status: asyncStub,
      record: asyncStub,
      list: asyncStub,
      actions: asyncStub,
      read: asyncStub,
      prune: asyncStub
    } as unknown as typeof window.studio.history,
    http: { request: asyncStub, allow: asyncStub, rules: asyncStub, revoke: asyncStub } as unknown as typeof window.studio.http,
    events: { on: () => () => undefined } as unknown as typeof window.studio.events
  };
}

if (!('studio' in window) || !window.studio) {
  Object.defineProperty(window, 'studio', { value: fakeStudio(), writable: true, configurable: true });
}

if (typeof navigator.clipboard === 'undefined') {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn(() => Promise.resolve()), readText: vi.fn(() => Promise.resolve('')) },
    configurable: true
  });
}
