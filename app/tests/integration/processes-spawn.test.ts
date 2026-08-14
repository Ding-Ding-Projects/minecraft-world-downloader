/**
 * Integration coverage for `main/services/processes.ts`'s real
 * `child_process.spawn` boundary.
 *
 * Every existing test of this module drove it through a full `vi.fn()` fake
 * for `child_process`, so the module's actual command-allowlisting,
 * argument handling, output streaming, truncation and kill/cancellation code
 * had never once been exercised against a real OS process. This file spawns
 * real processes -- always `node` itself, since that is guaranteed to be on
 * PATH in this environment (it is the interpreter running the test) -- and
 * checks the module's own report against independent evidence: a second,
 * separately-invoked `node --version` call for the success case, and the
 * operating system's own process table for the kill case.
 *
 * The command allow-list itself is read live from `allowedCommands()` rather
 * than hard-coded, because another lane may add archiver command names to
 * it; these tests must keep passing either way.
 */
import { execFileSync } from 'node:child_process';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BrowserWindow } from 'electron';
import type { ProcessEvent, ProcessSummary } from '../../src/shared/api';
import {
  allowedCommands,
  attachProcessBroadcast,
  killAll,
  killProcess,
  listProcesses,
  readOutput,
  spawnProcess
} from '../../src/main/services/processes';

vi.setConfig({ testTimeout: 30_000, hookTimeout: 20_000 });

/* ==================================================================== */
/* A fake BrowserWindow that just records every broadcast event           */
/* ==================================================================== */

let capturedEvents: ProcessEvent[] = [];

function fakeWindow(): BrowserWindow {
  return {
    isDestroyed: () => false,
    webContents: {
      send: (_channel: string, event: ProcessEvent) => {
        capturedEvents.push(event);
      }
    }
  } as unknown as BrowserWindow;
}

beforeEach(() => {
  capturedEvents = [];
  attachProcessBroadcast(() => fakeWindow());
});

afterEach(() => {
  // Belt and braces: a test that throws before reaching its own kill/exit
  // wait would otherwise leave a real OS process running past the test.
  killAll();
});

/* ==================================================================== */
/* Polling helpers -- the module exposes no "await completion" API of its */
/* own, so tests observe the real, independently-readable module state.  */
/* ==================================================================== */

function waitFor<T>(check: () => T | undefined, timeoutMs = 15_000, intervalMs = 20): Promise<T> {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      let value: T | undefined;
      try {
        value = check();
      } catch (error) {
        reject(error as Error);
        return;
      }
      if (value !== undefined) {
        resolve(value);
        return;
      }
      if (Date.now() - startedAt > timeoutMs) {
        reject(new Error('Timed out waiting for the expected condition.'));
        return;
      }
      setTimeout(attempt, intervalMs);
    };
    attempt();
  });
}

function waitForExit(id: string, timeoutMs = 15_000): Promise<ProcessSummary> {
  return waitFor(() => listProcesses().find((p) => p.id === id && !p.running), timeoutMs);
}

/** True cross-platform "is this pid still alive" check, independent of the */
/** module's own bookkeeping -- Node's own documented use of signal 0.      */
function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

describe('main/services/processes.ts -- real child_process.spawn boundary', () => {
  it('spawns a real, allowed process that succeeds, and its output matches an independently-run copy', async () => {
    expect(allowedCommands()).toContain('node');

    const independent = execFileSync('node', ['--version']).toString().trim();

    const handle = spawnProcess({ command: 'node', args: ['--version'] });
    expect(handle.pid).not.toBeNull();

    const summary = await waitForExit(handle.id);
    expect(summary.exitCode).toBe(0);
    expect(summary.running).toBe(false);
    expect(summary.endedAt).not.toBeNull();

    const stdout = readOutput(handle.id, 'stdout').trim();
    // Not merely "some output" -- the SAME real version string a second,
    // independently-spawned real node process reports. A fake spawn could
    // never produce this agreement by accident.
    expect(stdout).toBe(independent);
  });

  it('reports a real non-zero exit code from a real process', async () => {
    const handle = spawnProcess({ command: 'node', args: ['-e', 'process.exit(7)'] });

    const summary = await waitForExit(handle.id);

    expect(summary.exitCode).toBe(7);
    expect(summary.running).toBe(false);
  });

  it('refuses a command that is not on the live allow-list, with the exact stated reason', () => {
    const bogusCommand = 'totally-not-a-real-command-xyz';
    expect(allowedCommands()).not.toContain(bogusCommand);

    let thrown: Error | null = null;
    try {
      spawnProcess({ command: bogusCommand, args: [] });
    } catch (error) {
      thrown = error as Error;
    }

    expect(thrown).not.toBeNull();
    // Built from the module's own live allowedCommands() rather than a
    // hard-coded copy, so a sibling lane adding e.g. an archiver command to
    // the allow-list cannot make this assertion stale or wrong.
    expect(thrown!.message).toBe(
      `Refusing to start "${bogusCommand}". Allowed commands are: ${allowedCommands().join(', ')}.`
    );

    // Nothing was actually spawned: no entry exists for a refused command.
    expect(listProcesses().some((p) => p.command === bogusCommand)).toBe(false);
  });

  it('streams real stdout as multiple discrete events before exit, matching the aggregated output', async () => {
    const script =
      "console.log('one'); setTimeout(() => console.log('two'), 30); setTimeout(() => console.log('three'), 60);";
    const handle = spawnProcess({ command: 'node', args: ['-e', script] });

    const summary = await waitForExit(handle.id);
    expect(summary.exitCode).toBe(0);

    const stdoutEvents = capturedEvents.filter(
      (event): event is Extract<ProcessEvent, { kind: 'stdout' }> => event.id === handle.id && event.kind === 'stdout'
    );
    // Real, separately-flushed console.log calls arrive as more than one
    // chunk over real time -- a fully mocked stream could report anything.
    expect(stdoutEvents.length).toBeGreaterThan(1);

    const streamedTogether = stdoutEvents.map((event) => event.chunk).join('');
    expect(streamedTogether).toBe(readOutput(handle.id, 'stdout'));
    expect(streamedTogether).toContain('one');
    expect(streamedTogether).toContain('two');
    expect(streamedTogether).toContain('three');

    // Also saw a real 'exit' broadcast event for this same process.
    const exitEvents = capturedEvents.filter(
      (event): event is Extract<ProcessEvent, { kind: 'exit' }> => event.id === handle.id && event.kind === 'exit'
    );
    expect(exitEvents).toHaveLength(1);
    expect(exitEvents[0].code).toBe(0);
  });

  it('kills a real long-running process, and the OS itself confirms the pid is gone', async () => {
    const handle = spawnProcess({ command: 'node', args: ['-e', "setInterval(() => {}, 1000);"] });
    const pid = handle.pid;
    expect(pid).not.toBeNull();

    // Give the real process a moment to actually start before checking it's
    // alive -- spawnProcess() returns synchronously, before the OS has
    // necessarily scheduled the child.
    await waitFor(() => (isPidAlive(pid as number) ? true : undefined));

    killProcess(handle.id);

    const summary = await waitForExit(handle.id);
    expect(summary.running).toBe(false);

    // The module's own bookkeeping says it's dead. Confirm that through a
    // channel the module does not control at all: ask the operating system
    // directly whether the pid still refers to a live process.
    await waitFor(() => (isPidAlive(pid as number) ? undefined : true));
    expect(isPidAlive(pid as number)).toBe(false);
  });

  it('refuses cancellation of a process id that does not exist', () => {
    expect(() => killProcess('not-a-real-process-id')).toThrow(/No process with id/);
  });
});
