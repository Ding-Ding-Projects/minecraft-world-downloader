import { app } from 'electron';
import { spawn } from 'node:child_process';
import { basename, resolve } from 'node:path';

/**
 * Squirrel.Windows lifecycle handling.
 *
 * Squirrel does not install an application by copying files and walking away.
 * It extracts the package and then RUNS the freshly installed executable with a
 * lifecycle argument -- `--squirrel-install` on a first install,
 * `--squirrel-updated` after an update, `--squirrel-uninstall` on removal,
 * `--squirrel-obsolete` when an older version is being retired -- and waits a
 * short while (roughly fifteen seconds) for it to do the housekeeping for that
 * event and exit. Creating the Start Menu and Desktop shortcuts is part of that
 * housekeeping, and it is the APPLICATION's job, not the installer's: Squirrel
 * only supplies `Update.exe`, one directory above the versioned application
 * folder, which does the actual creating.
 *
 * An application that ignores those arguments therefore installs and, from the
 * user's side, does nothing at all: setup runs, the executable is launched with
 * `--squirrel-install`, it opens its full user interface instead of creating a
 * shortcut, Squirrel's timeout expires, the process is killed, and the install
 * finishes with no Start Menu entry, no Desktop icon and no window that stayed
 * open. That is exactly the reported behaviour -- "the installer doesn't create
 * a shortcut or open" -- and it was never a packaging fault: the installer was
 * correct and the application simply never answered it.
 *
 * `--squirrel-firstrun` is deliberately NOT in that list. It is passed when the
 * user launches the app for the very first time through the shortcut Squirrel
 * just created, and it means "start normally"; quitting on it would make the
 * first launch after every install appear to do nothing.
 */

/** Where Squirrel puts `Update.exe`: one level above the versioned app folder. */
function updateExePath(): string {
  return resolve(process.execPath, '..', '..', 'Update.exe');
}

/**
 * Runs `Update.exe` with the given arguments and resolves once it exits.
 *
 * Bounded on purpose. Squirrel kills this process after its own timeout, so a
 * hang here does not merely delay the install -- it loses the shortcut and
 * leaves the user with the exact silent failure this module exists to prevent.
 * Waiting a bounded time and quitting anyway is strictly better than waiting
 * forever, and a rejected promise still ends in a quit rather than a stuck
 * window.
 */
function runUpdate(args: readonly string[], timeoutMs = 10_000): Promise<void> {
  return new Promise((resolveDone) => {
    let done = false;
    const finish = (): void => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolveDone();
    };

    const timer = setTimeout(finish, timeoutMs);

    try {
      const child = spawn(updateExePath(), [...args], { detached: false, windowsHide: true });
      child.on('close', finish);
      // A missing or unrunnable Update.exe is not worth throwing over: the
      // install is already underway and the only useful thing left to do is
      // exit promptly so Squirrel can finish.
      child.on('error', finish);
    } catch {
      finish();
    }
  });
}

/**
 * Answers a Squirrel lifecycle invocation if this is one.
 *
 * Returns `true` when the process was started by Squirrel for housekeeping and
 * must not become a normal application launch. The caller quits immediately on
 * `true` and does nothing else -- no window, no single-instance lock, no IPC
 * registration -- because every one of those costs time Squirrel is counting.
 */
export function handleSquirrelEvent(argv: readonly string[] = process.argv): boolean {
  if (process.platform !== 'win32') return false;

  // Squirrel passes the lifecycle argument first, so a packaged build sees it
  // at `argv[1]`. Scanning instead of indexing costs nothing and keeps this
  // working when an extra argument precedes it -- an unpackaged run, for
  // instance, where `argv[1]` is the application directory.
  const event = argv.find((argument) => argument.startsWith('--squirrel-'));
  if (event === undefined) return false;

  // The shortcut is named after the executable Squirrel just installed.
  const exeName = basename(process.execPath);

  switch (event) {
    case '--squirrel-install':
    case '--squirrel-updated':
      void runUpdate(['--createShortcut', exeName, '--shortcut-locations', 'Desktop,StartMenu']).then(() =>
        app.quit()
      );
      return true;

    case '--squirrel-uninstall':
      void runUpdate(['--removeShortcut', exeName, '--shortcut-locations', 'Desktop,StartMenu']).then(() =>
        app.quit()
      );
      return true;

    case '--squirrel-obsolete':
      // An older version being retired during an update. Nothing to clean up;
      // the only correct action is to get out of the way at once.
      app.quit();
      return true;

    case '--squirrel-firstrun':
      // The user's own first launch through the new shortcut. Start normally.
      return false;

    default:
      return false;
  }
}
