import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

/**
 * Squirrel.Windows lifecycle handling.
 *
 * The defect this guards is silent and total: an application that ignores
 * Squirrel's lifecycle arguments installs and then, from the user's side, does
 * nothing at all. Setup runs the freshly installed executable with
 * `--squirrel-install`, waits for it to create its shortcuts and exit, gets a
 * full user interface instead, times out, kills the process, and finishes with
 * no Start Menu entry and no Desktop icon. Nothing fails and nothing is logged.
 *
 * `handleSquirrelEvent` takes its argv as a parameter precisely so this can be
 * tested without spawning an installer.
 */

const quit = vi.fn();
const spawned: Array<{ command: string; args: string[] }> = [];

vi.mock('electron', () => ({ app: { get quit() { return quit; } } }));

const spawn = (command: string, args: string[]): unknown => {
  spawned.push({ command, args });
  return {
    on(event: string, listener: () => void) {
      // Resolve the "Update.exe finished" path immediately so the quit that
      // follows it is observable within the test.
      if (event === 'close') setTimeout(listener, 0);
      return this;
    }
  };
};

// A Node built-in needs its `default` export mocked too, or the module graph
// refuses the partial replacement outright.
vi.mock('node:child_process', () => ({ spawn, default: { spawn } }));

const { handleSquirrelEvent } = await import('../../src/main/squirrel');

const originalPlatform = process.platform;

function setPlatform(value: string): void {
  Object.defineProperty(process, 'platform', { value, configurable: true });
}

beforeEach(() => {
  quit.mockClear();
  spawned.length = 0;
  setPlatform('win32');
});

afterEach(() => {
  setPlatform(originalPlatform);
});

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 5));

describe('Squirrel.Windows lifecycle handling', () => {
  it('claims the install event and creates Desktop and Start Menu shortcuts', async () => {
    expect(handleSquirrelEvent(['app.exe', '--squirrel-install', '1.0.0'])).toBe(true);
    await flush();

    expect(spawned).toHaveLength(1);
    expect(spawned[0].command).toMatch(/Update\.exe$/);
    expect(spawned[0].args).toContain('--createShortcut');
    expect(spawned[0].args).toContain('Desktop,StartMenu');
  });

  it('quits only AFTER Update.exe has finished, never before', async () => {
    handleSquirrelEvent(['app.exe', '--squirrel-install', '1.0.0']);

    // The whole point: quitting at the moment the event is recognised would end
    // the process while the shortcut was still being created, which is the
    // failure this handling exists to remove.
    expect(quit).not.toHaveBeenCalled();

    await flush();
    expect(quit).toHaveBeenCalled();
  });

  it('removes the shortcuts on uninstall', async () => {
    expect(handleSquirrelEvent(['app.exe', '--squirrel-uninstall', '1.0.0'])).toBe(true);
    await flush();

    expect(spawned[0].args).toContain('--removeShortcut');
  });

  it('recreates the shortcuts after an update', async () => {
    expect(handleSquirrelEvent(['app.exe', '--squirrel-updated', '1.0.1'])).toBe(true);
    await flush();

    expect(spawned[0].args).toContain('--createShortcut');
  });

  it('gets out of the way for an obsolete version without spawning anything', () => {
    expect(handleSquirrelEvent(['app.exe', '--squirrel-obsolete', '1.0.0'])).toBe(true);
    expect(quit).toHaveBeenCalled();
    expect(spawned).toHaveLength(0);
  });

  it('starts NORMALLY on the first run, which is a real launch and not housekeeping', () => {
    // `--squirrel-firstrun` is the user opening the app through the shortcut
    // Squirrel just made. Treating it as housekeeping would make the first
    // launch after every install appear to do nothing.
    expect(handleSquirrelEvent(['app.exe', '--squirrel-firstrun'])).toBe(false);
    expect(quit).not.toHaveBeenCalled();
    expect(spawned).toHaveLength(0);
  });

  it('leaves an ordinary launch completely alone', () => {
    expect(handleSquirrelEvent(['app.exe'])).toBe(false);
    expect(handleSquirrelEvent(['electron.exe', 'C:/checkout/app'])).toBe(false);
    expect(quit).not.toHaveBeenCalled();
    expect(spawned).toHaveLength(0);
  });

  it('finds the event even when it is not the first argument', async () => {
    expect(handleSquirrelEvent(['electron.exe', 'C:/checkout/app', '--squirrel-install'])).toBe(true);
    await flush();
    expect(spawned).toHaveLength(1);
  });

  it('does nothing at all off Windows, where Squirrel does not exist', () => {
    setPlatform('darwin');
    expect(handleSquirrelEvent(['app.exe', '--squirrel-install'])).toBe(false);
    expect(quit).not.toHaveBeenCalled();
  });

  it('self-test: an implementation that ignored the install event would fail this suite', () => {
    // Guards the guard. If `handleSquirrelEvent` were reduced to `return false`
    // -- which is exactly the state this application shipped in -- the install
    // assertions above would fail rather than passing silently.
    const ignoreEverything = (): boolean => false;
    expect(ignoreEverything()).toBe(false);
    expect(handleSquirrelEvent(['app.exe', '--squirrel-install'])).not.toBe(ignoreEverything());
  });
});
