/**
 * Regex builder bounds: the sample-size cap, the match cap, the time budget,
 * zero-width match handling, and literal escaping.
 */
import { describe, expect, it } from 'vitest';
import { compile, escapeLiteral, evaluate } from '../../src/renderer/core/regexbuilder';

describe('compile()', () => {
  it('compiles a valid pattern', () => {
    const { regex, error } = compile('a+b', 'g');
    expect(error).toBeNull();
    expect(regex).not.toBeNull();
    expect(regex!.test('aaab')).toBe(true);
  });

  it('returns the error rather than throwing, for an invalid pattern', () => {
    const { regex, error } = compile('(unclosed', 'g');
    expect(regex).toBeNull();
    expect(error).not.toBeNull();
    expect(typeof error).toBe('string');
  });

  it('an empty pattern compiles to null with no error (nothing typed yet)', () => {
    const { regex, error } = compile('', 'g');
    expect(regex).toBeNull();
    expect(error).toBeNull();
  });
});

describe('escapeLiteral()', () => {
  it('escapes every regex metacharacter', () => {
    const metacharacters = '.*+?^${}()|[]\\/';
    const escaped = escapeLiteral(metacharacters);
    // The escaped literal, compiled as a pattern, must match only the exact
    // original string — proof the escaping actually round-trips through the
    // real regex engine rather than merely looking plausible.
    const regex = new RegExp(`^${escaped}$`);
    expect(regex.test(metacharacters)).toBe(true);
  });

  it('a literal containing a metacharacter matches only that literal, not the class it would otherwise form', () => {
    const escaped = escapeLiteral('a.b');
    const regex = new RegExp(escaped);
    expect(regex.test('a.b')).toBe(true);
    expect(regex.test('aXb')).toBe(false); // unescaped "." would match this
  });

  it('leaves ordinary characters untouched', () => {
    expect(escapeLiteral('hello world 123')).toBe('hello world 123');
  });
});

describe('evaluate(): match cap', () => {
  it('caps at 500 matches and reports truncated', () => {
    const regex = /a/g;
    const sample = 'a'.repeat(1000);
    const result = evaluate(regex, sample);
    expect(result.matches.length).toBe(500);
    expect(result.truncated).toBe(true);
    expect(result.timedOut).toBe(false);
  });

  it('does not truncate when the match count is under the cap', () => {
    const regex = /a/g;
    const sample = 'a'.repeat(10);
    const result = evaluate(regex, sample);
    expect(result.matches.length).toBe(10);
    expect(result.truncated).toBe(false);
  });
});

describe('evaluate(): sample size cap', () => {
  it('only evaluates the first 20,000 characters of a longer sample', () => {
    // A single marker placed just past the cap must never be found.
    const sample = `${'x'.repeat(20_000)}MARKER`;
    const regex = /MARKER/g;
    const result = evaluate(regex, sample);
    expect(result.matches.length).toBe(0);
  });

  it('a marker placed just before the cap IS found', () => {
    const sample = `${'x'.repeat(19_990)}MARKER`;
    const regex = /MARKER/g;
    const result = evaluate(regex, sample);
    expect(result.matches.length).toBe(1);
  });
});

describe('evaluate(): zero-width matches', () => {
  it('a zero-width pattern advances rather than looping forever', () => {
    const regex = /(?:)/g; // matches the empty string at every position
    const sample = 'abcde';
    const start = Date.now();
    const result = evaluate(regex, sample);
    const elapsed = Date.now() - start;
    // 6 positions (before a,b,c,d,e and after e) for a 5-character string.
    expect(result.matches.length).toBe(6);
    expect(result.matches.every((match) => match.text === '')).toBe(true);
    expect(elapsed).toBeLessThan(1000); // proof it terminated, not a guess
  });

  it('a zero-width lookahead at a word boundary does not loop', () => {
    const regex = /\b/g;
    const result = evaluate(regex, 'hello world');
    expect(result.matches.length).toBeGreaterThan(0);
    expect(result.truncated || result.timedOut).toBe(false);
  });
});

describe('evaluate(): time budget', () => {
  // KNOWN, VERIFIED, UNFIXED DEFECT — see TEST_INVENTORY.md and the suites-lane
  // report for the full write-up. Root cause, read directly from
  // core/regexbuilder.ts's `evaluate()`: the elapsed-time check
  // (`performance.now() - started > TIME_BUDGET_MS`) runs only BETWEEN
  // iterations of the match loop, immediately before each `runner.exec(text)`
  // call. It never interrupts an `exec()` call already in progress. JavaScript
  // is single-threaded and V8's native RegExp engine has no cooperative yield
  // point mid-match, so a single call to `exec()` on a catastrophically
  // backtracking pattern can itself run for an unbounded time — the 250ms
  // budget is never consulted again until that one call returns, which for a
  // genuinely pathological pattern may be minutes, not milliseconds.
  //
  // Measured directly on this machine: `/^(a+)+$/.exec('a'.repeat(28) + '!')`
  // via `evaluate()` took **13,894 ms** against a stated 250ms budget — for a
  // 29-character sample, well inside every size cap this module enforces. The
  // sample-length cap (MAX_SAMPLE_CHARS) and the match-count cap (MAX_MATCHES)
  // both protect against a different failure mode (many matches over a large
  // input) and do nothing for this one.
  //
  // A correct fix needs to interrupt a hung synchronous `exec()` call from
  // outside the thread running it — in a browser/Electron renderer that means
  // moving evaluation into a Web Worker with a hard `worker.terminate()` on
  // timeout, which changes `evaluate()`'s call shape from synchronous to
  // asynchronous and therefore touches its one caller in
  // `regexbuilder.ts`'s `update()`. That is a real architecture change to the
  // regex builder itself, not a test fix, and is out of this lane's scope
  // (writing and running the test suite) — reported here rather than
  // silently loosened to a value large enough to stop failing.
  it('a catastrophically backtracking pattern is stopped within the stated time budget', () => {
    // (a+)+$ against a run of a's with a forced non-match is the textbook
    // catastrophic-backtracking case.
    const regex = /^(a+)+$/;
    const sample = `${'a'.repeat(28)}!`; // the trailing "!" forces exhaustive backtracking
    const result = evaluate(regex, sample);
    // This is the module's own stated contract (see TIME_BUDGET_MS and the
    // file's own "the elapsed time is checked between iterations" comment). It
    // is intentionally left asserting the CORRECT behaviour rather than
    // loosened to match what the code currently does, so this test stays red
    // — visibly, honestly — until the defect above is actually fixed.
    expect(result.elapsedMs).toBeLessThan(1000);
  });
});

describe('evaluate(): capture groups', () => {
  it('reports numbered groups', () => {
    const result = evaluate(/(\d+)-(\d+)/g, '12-34 and 56-78');
    expect(result.matches).toHaveLength(2);
    expect(result.matches[0].groups.map((group) => group.value)).toEqual(['12', '34']);
    expect(result.matches[1].groups.map((group) => group.value)).toEqual(['56', '78']);
  });

  it('reports named groups by name', () => {
    const result = evaluate(/(?<year>\d{4})-(?<month>\d{2})/g, '2026-08');
    const named = Object.fromEntries(result.matches[0].groups.map((group) => [group.name, group.value]));
    expect(named.year).toBe('2026');
    expect(named.month).toBe('08');
  });

  it('an unmatched optional group reports undefined rather than an empty string', () => {
    const result = evaluate(/(a)|(b)/g, 'b');
    const group1 = result.matches[0].groups.find((group) => group.name === '1');
    const group2 = result.matches[0].groups.find((group) => group.name === '2');
    expect(group1?.value).toBeUndefined();
    expect(group2?.value).toBe('b');
  });
});

describe('evaluate(): non-global pattern still finds every match', () => {
  it('re-runs a non-global regex as global internally', () => {
    const result = evaluate(/a/, 'aaa');
    expect(result.matches.length).toBe(3);
  });
});
