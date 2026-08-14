/**
 * Integration coverage for the IPC startup completeness check that
 * `main/index.ts` runs right after `registerAllHandlers()`:
 *
 *     const missing = unregisteredChannels();
 *     if (missing.length > 0) {
 *       throw new Error(`These IPC channels are on the allow-list but have no
 *       handler: ${missing.join(', ')}`);
 *     }
 *
 * That check is the only thing standing between shipping a channel on the
 * shared allow-list and shipping a dead button: the preload bridge exposes
 * every allow-listed channel to the renderer regardless of whether the main
 * process ever wired up a handler for it, so a channel that is allow-listed
 * but never registered would otherwise fail silently -- or rather, fail
 * loudly at whatever moment a user happens to click the feature that calls
 * it, which is worse. Despite that, the check itself had never been
 * exercised by any test.
 *
 * `electron` does not exist as a real module outside an actual Electron
 * process, so it is mocked here with the minimum surface `main/ipc.ts`
 * touches at *registration* time: `ipcMain.on`/`ipcMain.handle` (recording
 * only, never invoked) and empty stand-ins for `dialog`, `shell`, `app` and
 * `BrowserWindow` that the handler closures capture but this file never
 * calls. `registerAllHandlers()` itself -- the real, unmodified production
 * function -- is what runs in the first test below.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  ipcMain: { on: vi.fn(), handle: vi.fn() },
  dialog: {},
  shell: {},
  app: {},
  BrowserWindow: { fromWebContents: vi.fn(() => null) },
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => false),
    encryptString: vi.fn((value: string) => Buffer.from(value)),
    decryptString: vi.fn((buffer: Buffer) => buffer.toString())
  }
}));

// Each test gets its own fresh copy of `main/ipc.ts`, which means its own
// fresh, empty `registered` Set -- the module-level state the completeness
// check reads. Without this, the module's own guard against double
// registration ("The IPC channel ... is already registered.") would make the
// second test in this file fail for an unrelated reason.
beforeEach(() => {
  vi.resetModules();
});

describe('main/ipc.ts -- startup IPC completeness check', () => {
  it('passes for the real, production channel registration', async () => {
    const ipc = await import('../../src/main/ipc');
    const { INVOKE_CHANNELS } = await import('../../src/shared/channels');

    // Sanity: the real registry is non-trivial, so a check that trivially
    // passes on an empty allow-list would prove nothing.
    expect(INVOKE_CHANNELS.length).toBeGreaterThan(20);

    ipc.registerAllHandlers({ startedAt: Date.now(), isDevelopment: true });

    // This is exactly the call `main/index.ts:303` makes at startup. If any
    // channel newly added to the shared allow-list is ever forgotten in
    // `registerAllHandlers()`, this is what turns red.
    expect(ipc.unregisteredChannels()).toEqual([]);
  });

  it('reports exactly the missing channel when one is left unregistered, via an honest fixture', async () => {
    const ipc = await import('../../src/main/ipc');
    const { INVOKE_CHANNELS } = await import('../../src/shared/channels');

    // Built the honest way: register every real allow-listed channel except
    // one, through the module's own real `registerHandler`, rather than
    // patching production registration code to "break" it. This proves the
    // completeness check's own reporting logic -- unregisteredChannels()
    // filtering INVOKE_CHANNELS against whatever was actually registered --
    // independent of whether production code currently registers everything.
    const missingChannel = INVOKE_CHANNELS[INVOKE_CHANNELS.length - 1];
    for (const channel of INVOKE_CHANNELS) {
      if (channel === missingChannel) continue;
      ipc.registerHandler(channel, () => null);
    }

    expect(ipc.unregisteredChannels()).toEqual([missingChannel]);
  });

  it('reports every missing channel, not just the first, when several are left unregistered', async () => {
    const ipc = await import('../../src/main/ipc');
    const { INVOKE_CHANNELS } = await import('../../src/shared/channels');

    const missing = new Set([INVOKE_CHANNELS[0], INVOKE_CHANNELS[5], INVOKE_CHANNELS[INVOKE_CHANNELS.length - 1]]);
    for (const channel of INVOKE_CHANNELS) {
      if (missing.has(channel)) continue;
      ipc.registerHandler(channel, () => null);
    }

    const reported = ipc.unregisteredChannels();
    expect(new Set(reported)).toEqual(missing);
    expect(reported).toHaveLength(missing.size);
  });

  it('refuses to register a channel that is not on the shared allow-list', async () => {
    const ipc = await import('../../src/main/ipc');

    expect(() => ipc.registerHandler('not:a-real-channel' as never, () => null)).toThrow(
      /is not on the IPC allow-list/
    );
  });

  it('refuses to register the same channel twice, so a later module can never silently shadow an earlier handler', async () => {
    const ipc = await import('../../src/main/ipc');
    const { INVOKE_CHANNELS } = await import('../../src/shared/channels');
    const channel = INVOKE_CHANNELS[0];

    ipc.registerHandler(channel, () => 'first');
    expect(() => ipc.registerHandler(channel, () => 'second')).toThrow(/is already registered/);
  });
});
