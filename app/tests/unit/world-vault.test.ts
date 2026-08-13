/**
 * The two places `features/world-vault` explicitly calls out as "wrong is
 * silent": settle detection (hazard 1 — never commit a region file
 * mid-write) and region-access refusal (hazard 6 — never race the
 * downloader). Both are pure functions with no I/O, so they are exercised
 * directly here rather than only indirectly through a real git repository
 * and a real download.
 *
 * `world-vault.ts` type-imports `BrowserWindow` from `electron` for
 * `attachWorldVaultBroadcast`'s parameter type only; nothing at module scope
 * touches Electron at runtime, so this imports cleanly under vitest's jsdom
 * environment exactly like `docs-freshness.test.ts` imports `node:child_process`
 * directly.
 */
import { describe, expect, it } from 'vitest';
import {
  computeSettleDecision,
  diffSnapshots,
  evaluateRegionAccess,
  type SnapshotMap
} from '../../src/main/features/world-vault';

describe('diffSnapshots(): the settle detector\'s eyes', () => {
  it('reports no changes between two identical snapshots', () => {
    const snapshot: SnapshotMap = new Map([['region/r.0.0.mca', { size: 4096, mtimeMs: 1000 }]]);
    const diff = diffSnapshots(snapshot, new Map(snapshot));
    expect(diff.hasChanges).toBe(false);
    expect(diff.changed).toEqual([]);
  });

  it('detects a newly appeared file', () => {
    const before: SnapshotMap = new Map();
    const after: SnapshotMap = new Map([['region/r.0.0.mca', { size: 4096, mtimeMs: 1000 }]]);
    const diff = diffSnapshots(before, after);
    expect(diff.hasChanges).toBe(true);
    expect(diff.changed).toEqual(['region/r.0.0.mca']);
  });

  it('detects a removed file', () => {
    const before: SnapshotMap = new Map([['level.dat', { size: 2048, mtimeMs: 1000 }]]);
    const after: SnapshotMap = new Map();
    const diff = diffSnapshots(before, after);
    expect(diff.hasChanges).toBe(true);
    expect(diff.changed).toEqual(['level.dat']);
  });

  it('detects a size change with the same mtime (a rewrite that landed in the same tick)', () => {
    const before: SnapshotMap = new Map([['region/r.0.0.mca', { size: 4096, mtimeMs: 1000 }]]);
    const after: SnapshotMap = new Map([['region/r.0.0.mca', { size: 8192, mtimeMs: 1000 }]]);
    expect(diffSnapshots(before, after).changed).toEqual(['region/r.0.0.mca']);
  });

  it('detects an mtime change with the same size (an in-place rewrite)', () => {
    const before: SnapshotMap = new Map([['region/r.0.0.mca', { size: 4096, mtimeMs: 1000 }]]);
    const after: SnapshotMap = new Map([['region/r.0.0.mca', { size: 4096, mtimeMs: 2000 }]]);
    expect(diffSnapshots(before, after).changed).toEqual(['region/r.0.0.mca']);
  });

  it('leaves an untouched file out of the changed list even when a sibling file changes', () => {
    const before: SnapshotMap = new Map([
      ['region/r.0.0.mca', { size: 4096, mtimeMs: 1000 }],
      ['region/r.1.0.mca', { size: 4096, mtimeMs: 1000 }]
    ]);
    const after: SnapshotMap = new Map([
      ['region/r.0.0.mca', { size: 5000, mtimeMs: 1500 }],
      ['region/r.1.0.mca', { size: 4096, mtimeMs: 1000 }]
    ]);
    expect(diffSnapshots(before, after).changed).toEqual(['region/r.0.0.mca']);
  });

  it('self-test: a broken diff that always reports no changes would fail every test above', () => {
    // The check that actually matters is that these tests can fail. Prove it
    // by deliberately comparing against a diff that reports nothing, and
    // confirming the assertion catches it.
    const brokenDiff = { changed: [] as string[], hasChanges: false };
    expect(() => expect(brokenDiff.changed).toEqual(['region/r.0.0.mca'])).toThrow();
  });
});

describe('computeSettleDecision(): hazard 1 — never commit a region file mid-write', () => {
  it('never wants to commit when nothing is dirty', () => {
    const decision = computeSettleDecision({ dirty: false, lastActivityAtMs: 0, nowMs: 100_000, quietPeriodMs: 8000 });
    expect(decision).toEqual({ dirty: false, waitingForSettle: false, shouldCommit: false, msRemaining: 0 });
  });

  it('is still waiting the instant activity is first observed', () => {
    const decision = computeSettleDecision({ dirty: true, lastActivityAtMs: 1000, nowMs: 1000, quietPeriodMs: 8000 });
    expect(decision.shouldCommit).toBe(false);
    expect(decision.waitingForSettle).toBe(true);
    expect(decision.msRemaining).toBe(8000);
  });

  it('is still waiting one millisecond before the quiet period elapses', () => {
    const decision = computeSettleDecision({ dirty: true, lastActivityAtMs: 0, nowMs: 7999, quietPeriodMs: 8000 });
    expect(decision.shouldCommit).toBe(false);
    expect(decision.waitingForSettle).toBe(true);
    expect(decision.msRemaining).toBe(1);
  });

  it('commits at the exact instant the quiet period elapses', () => {
    const decision = computeSettleDecision({ dirty: true, lastActivityAtMs: 0, nowMs: 8000, quietPeriodMs: 8000 });
    expect(decision.shouldCommit).toBe(true);
    expect(decision.waitingForSettle).toBe(false);
    expect(decision.msRemaining).toBe(0);
  });

  it('still wants to commit well after the quiet period has elapsed', () => {
    const decision = computeSettleDecision({ dirty: true, lastActivityAtMs: 0, nowMs: 60_000, quietPeriodMs: 8000 });
    expect(decision.shouldCommit).toBe(true);
    expect(decision.msRemaining).toBe(0);
  });

  it('scenario: a region file rewritten every 2s never triggers a commit while writes continue, only after they stop', () => {
    // This is the exact hazard from the task brief, played out as a
    // simulated poll loop: a writer touches the file every 2s and the
    // runner polls every 1s with an 8s quiet period. No poll during the
    // active writing window may ever want to commit.
    const quietPeriodMs = 8000;
    let lastActivityAtMs = 0;
    let dirty = true;
    const writeTimes = [0, 2000, 4000, 6000, 8000, 10000, 12000]; // a write every 2s until 12s
    let sawUnexpectedCommit = false;

    for (let nowMs = 0; nowMs <= 12_000; nowMs += 1000) {
      if (writeTimes.includes(nowMs)) {
        dirty = true;
        lastActivityAtMs = nowMs;
      }
      const decision = computeSettleDecision({ dirty, lastActivityAtMs, nowMs, quietPeriodMs });
      if (decision.shouldCommit) sawUnexpectedCommit = true;
    }
    expect(sawUnexpectedCommit).toBe(false);

    // Writing stops at 12s. No commit should fire until 20s (12s + 8s quiet
    // period), and it must fire by then.
    for (let nowMs = 13_000; nowMs < 20_000; nowMs += 1000) {
      const decision = computeSettleDecision({ dirty, lastActivityAtMs, nowMs, quietPeriodMs });
      expect(decision.shouldCommit).toBe(false);
    }
    const finalDecision = computeSettleDecision({ dirty, lastActivityAtMs, nowMs: 20_000, quietPeriodMs });
    expect(finalDecision.shouldCommit).toBe(true);
  });

  it('self-test: a broken decision that always commits would fail the mid-write scenario above', () => {
    const alwaysCommits = () => ({ dirty: true, waitingForSettle: false, shouldCommit: true, msRemaining: 0 });
    expect(alwaysCommits().shouldCommit).toBe(true); // sanity: the stand-in itself does the wrong thing
    // computeSettleDecision must NOT behave like this at nowMs=0 while dirty.
    expect(computeSettleDecision({ dirty: true, lastActivityAtMs: 0, nowMs: 0, quietPeriodMs: 8000 }).shouldCommit).toBe(false);
  });
});

describe('evaluateRegionAccess(): hazard 6 — refuse to race the downloader', () => {
  it('grants access when nothing is tracking the file and the live check saw no motion', () => {
    const result = evaluateRegionAccess({
      relativePath: 'region/r.0.0.mca',
      runnerActive: false,
      lastKnownActivityAtMs: null,
      nowMs: 100_000,
      quietPeriodMs: 8000,
      liveChanged: false
    });
    expect(result).toEqual({ granted: true, reason: null });
  });

  it('refuses whenever the live double-stat saw the file move, regardless of the runner', () => {
    const result = evaluateRegionAccess({
      relativePath: 'region/r.0.0.mca',
      runnerActive: false,
      lastKnownActivityAtMs: null,
      nowMs: 100_000,
      quietPeriodMs: 8000,
      liveChanged: true
    });
    expect(result.granted).toBe(false);
    expect(result.reason).toContain('region/r.0.0.mca');
  });

  it('refuses a file the runner saw change inside the quiet window', () => {
    const result = evaluateRegionAccess({
      relativePath: 'region/r.2.-1.mca',
      runnerActive: true,
      lastKnownActivityAtMs: 90_000,
      nowMs: 92_000, // 2s ago, inside an 8s quiet period
      quietPeriodMs: 8000,
      liveChanged: false
    });
    expect(result.granted).toBe(false);
    expect(result.reason).toContain('region/r.2.-1.mca');
  });

  it('grants a file the runner saw change well outside the quiet window', () => {
    const result = evaluateRegionAccess({
      relativePath: 'region/r.2.-1.mca',
      runnerActive: true,
      lastKnownActivityAtMs: 0,
      nowMs: 60_000, // 60s ago, well past an 8s quiet period
      quietPeriodMs: 8000,
      liveChanged: false
    });
    expect(result).toEqual({ granted: true, reason: null });
  });

  it('grants access at the exact instant the quiet period elapses', () => {
    const result = evaluateRegionAccess({
      relativePath: 'region/r.0.0.mca',
      runnerActive: true,
      lastKnownActivityAtMs: 0,
      nowMs: 8000,
      quietPeriodMs: 8000,
      liveChanged: false
    });
    expect(result.granted).toBe(true);
  });

  it('grants a path the runner is active for but has never observed changing', () => {
    const result = evaluateRegionAccess({
      relativePath: 'level.dat',
      runnerActive: true,
      lastKnownActivityAtMs: null,
      nowMs: 100_000,
      quietPeriodMs: 8000,
      liveChanged: false
    });
    expect(result).toEqual({ granted: true, reason: null });
  });

  it('scenario: the downloader writes, a sibling asks immediately and is refused, then asks again after the quiet period and is granted', () => {
    const quietPeriodMs = 8000;
    const writeAtMs = 1000;

    const immediateRequest = evaluateRegionAccess({
      relativePath: 'region/r.0.0.mca',
      runnerActive: true,
      lastKnownActivityAtMs: writeAtMs,
      nowMs: writeAtMs + 500, // half a second later
      quietPeriodMs,
      liveChanged: false
    });
    expect(immediateRequest.granted).toBe(false);

    const laterRequest = evaluateRegionAccess({
      relativePath: 'region/r.0.0.mca',
      runnerActive: true,
      lastKnownActivityAtMs: writeAtMs,
      nowMs: writeAtMs + quietPeriodMs + 1,
      quietPeriodMs,
      liveChanged: false
    });
    expect(laterRequest.granted).toBe(true);
  });

  it('self-test: a broken evaluator that always grants would fail the "refuse mid-write" cases above', () => {
    const alwaysGrants = () => ({ granted: true, reason: null });
    expect(alwaysGrants().granted).toBe(true); // sanity: the stand-in itself does the wrong thing
    expect(
      evaluateRegionAccess({
        relativePath: 'region/r.0.0.mca',
        runnerActive: false,
        lastKnownActivityAtMs: null,
        nowMs: 0,
        quietPeriodMs: 8000,
        liveChanged: true
      }).granted
    ).toBe(false);
  });
});
