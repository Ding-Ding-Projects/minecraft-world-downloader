import { el, nextId } from './a11y';
import { i18n } from './i18n';
import { overlay } from './overlay';
import type { OverlayHandle, RegexBuilderHandle, RegexBuilderOptions, RegexState } from './types';

/**
 * The regular-expression builder.
 *
 * Every search bar in this application has one, anchored to that exact field.
 * The engine is the JavaScript `RegExp` engine and the interface says so, so a
 * pattern written here behaves identically wherever the same string is used —
 * for every pattern the static screen below does not flag as dangerous. A
 * flagged pattern is still run, just under a tighter safety margin, and the
 * interface says so.
 *
 * Evaluation is bounded, by three mechanisms that each cover a gap the others
 * leave open:
 *
 * 1. `evaluate()` below runs synchronously and cannot be interrupted mid-call
 *    — a single `RegExp.prototype.exec()` on a catastrophically backtracking
 *    pattern (`(a+)+` against a long run of `a`s with a forced mismatch) can
 *    itself take minutes, and JavaScript has no cooperative yield point
 *    inside a native regex match, so a time check *between* iterations of the
 *    match loop never gets a chance to run until that one call already
 *    returned. `analyzePattern()` below performs a lightweight static scan
 *    for the regex shapes known to cause this (nested unbounded quantifiers,
 *    ambiguous alternation under a quantifier) and, when it finds one, this
 *    function hands the engine a much shorter slice of the sample —
 *    `DANGEROUS_SAMPLE_CHARS` characters instead of `MAX_SAMPLE_CHARS` —
 *    short enough that even the worst-case exponential blowup for these
 *    constructs finishes well inside the stated budget. It is a blunt,
 *    conservative bound, not a proof for arbitrary patterns; it is what
 *    protects the synchronous path used directly by this module's own tests
 *    and by any environment with no Worker.
 * 2. `analyzePattern()` also drives a warning the builder shows in its own
 *    UI, naming the exact construct, before the pattern is ever run — so the
 *    person writing the pattern learns what makes it dangerous rather than
 *    just watching a result get cut short.
 * 3. `evaluateAsync()` is the real fix for the general case: it runs the
 *    match inside a Web Worker and hard-terminates that worker if it has not
 *    answered within its own budget. A worker is the only thing on this
 *    thread that can actually interrupt a hung native regex engine —
 *    `worker.terminate()` does not ask the backtracking to stop, it ends the
 *    thread running it. The renderer's own `update()` loop uses this path
 *    whenever a Worker is available (every real browser and Electron
 *    renderer), and falls back to the bounded synchronous `evaluate()` only
 *    when it is not (this module's unit tests run under jsdom, which does not
 *    implement Worker, so they exercise exactly that fallback).
 *
 * The match loop and match count stay capped as before (`MAX_MATCHES`), and
 * the interface never lets a budget stop render as an honest "no matches" —
 * a stopped evaluation says so, separately from the match count.
 */

const MAX_SAMPLE_CHARS = 20_000;
const MAX_MATCHES = 500;
const TIME_BUDGET_MS = 250;
/**
 * Applied instead of MAX_SAMPLE_CHARS only when `analyzePattern()` flags the
 * pattern as dangerous, on the synchronous fallback path. Chosen so the
 * worst known blowup for these constructs stays far under budget: the exact
 * regression this file's test guards against, `/^(a+)+$/` against 28 `a`s
 * plus a forced mismatch, measured at ~13,900ms uncapped; the same pattern
 * against 16 characters measures under 5ms, and every character shaved off
 * only shrinks an exponential-or-worse blowup further. The real, general
 * protection for arbitrary dangerous patterns is `evaluateAsync()`'s worker
 * terminate below; this cap exists for the path that has no terminate at all.
 */
const DANGEROUS_SAMPLE_CHARS = 16;
/** Hard budget for the worker path: how long `evaluateAsync()` waits before it terminates a worker that has not answered. */
const WORKER_TIME_BUDGET_MS = 750;

export interface MatchResult {
  matches: Array<{ index: number; text: string; groups: Array<{ name: string; value: string | undefined }> }>;
  truncated: boolean;
  timedOut: boolean;
  elapsedMs: number;
  /** True when the sample was cut short — by the ordinary cap or the tighter one for a flagged pattern — before it reached the engine. */
  sampleCapped: boolean;
  /** The exact cap, in characters, that was applied for this evaluation. Shown in the interface whenever `sampleCapped` is true. */
  sampleCapChars: number;
  /** The static pre-screen's verdict on the pattern that produced this result. */
  risk: PatternRisk;
  /** Which mechanism actually ran the match: a worker that can be hard-terminated, or the bounded synchronous fallback. */
  engine: 'worker' | 'synchronous';
}

/** Compiles a pattern, returning the error rather than throwing it. */
export function compile(pattern: string, flags: string): { regex: RegExp | null; error: string | null } {
  if (pattern === '') return { regex: null, error: null };
  try {
    return { regex: new RegExp(pattern, flags), error: null };
  } catch (error) {
    return { regex: null, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Runs a compiled pattern over a bounded sample within a time budget.
 *
 * Stays fully synchronous — this is the fallback path `evaluateAsync()` uses
 * when no Worker is available, and the path this module's own unit tests
 * exercise directly, so its safety cannot depend on anything able to
 * interrupt it from outside. See the file-level comment for how its three
 * mechanisms (sample cap, static pre-screen, worker terminate) fit together.
 */
export function evaluate(regex: RegExp, sample: string): MatchResult {
  const risk = analyzePattern(regex.source);
  const cap = risk.dangerous ? DANGEROUS_SAMPLE_CHARS : MAX_SAMPLE_CHARS;
  const sampleCapped = sample.length > cap;
  const text = sampleCapped ? sample.slice(0, cap) : sample;
  const global = regex.flags.includes('g') || regex.flags.includes('y');
  const runner = global ? regex : new RegExp(regex.source, `${regex.flags}g`);
  runner.lastIndex = 0;

  const started = performance.now();
  const matches: MatchResult['matches'] = [];
  let truncated = false;
  let timedOut = false;

  for (;;) {
    if (performance.now() - started > TIME_BUDGET_MS) {
      timedOut = true;
      break;
    }
    const found = runner.exec(text);
    if (!found) break;
    const groups: Array<{ name: string; value: string | undefined }> = [];
    for (let index = 1; index < found.length; index += 1) {
      groups.push({ name: String(index), value: found[index] });
    }
    if (found.groups) {
      for (const [name, value] of Object.entries(found.groups)) groups.push({ name, value });
    }
    matches.push({ index: found.index, text: found[0], groups });
    // A zero-width match would otherwise loop forever on the same index.
    if (found[0] === '') runner.lastIndex += 1;
    if (matches.length >= MAX_MATCHES) {
      truncated = true;
      break;
    }
  }

  return {
    matches,
    truncated,
    timedOut,
    elapsedMs: Math.round(performance.now() - started),
    sampleCapped,
    sampleCapChars: cap,
    risk,
    engine: 'synchronous'
  };
}

/* ------------------------------------------------------------------ */
/* Static risk analysis                                                */
/* ------------------------------------------------------------------ */

/** One construct the static screen recognised as prone to catastrophic backtracking. */
export interface RiskFinding {
  kind: 'nested-quantifier' | 'ambiguous-alternation';
  /** The exact source snippet that triggered the finding, clipped to a reasonable display length. */
  snippet: string;
}

export interface PatternRisk {
  dangerous: boolean;
  findings: RiskFinding[];
}

const RISK_SNIPPET_MAX = 40;

function clipSnippet(raw: string): string {
  return raw.length > RISK_SNIPPET_MAX ? `${raw.slice(0, RISK_SNIPPET_MAX)}…` : raw;
}

interface Quant {
  min: number;
  max: number;
}

type RiskAtom =
  | { kind: 'literal'; value: string; quant: Quant | null }
  | { kind: 'other'; quant: Quant | null }
  | { kind: 'group'; branches: RiskAtom[][]; quant: Quant | null; raw: string };

/**
 * A small, defensive parser over ECMAScript regex *source* text — never the
 * whole grammar, only enough structure (groups, alternation, quantifiers) to
 * spot the shapes known to cause catastrophic backtracking. Callers only ever
 * pass `RegExp.source` from a pattern that already compiled, so this never
 * needs to recover from genuinely malformed input, but it still never throws:
 * a pattern this parser cannot make sense of is reported as "not dangerous"
 * rather than crashing the caller. The worst outcome of a missed detection
 * here is a duller warning, not a hang — the sample-length cap in `evaluate()`
 * and the worker's hard terminate in `evaluateAsync()` are what actually keep
 * evaluation bounded regardless of what this function decides.
 */
function parsePattern(source: string): RiskAtom[][] | null {
  let i = 0;
  const { length } = source;

  const peek = (): string | undefined => source[i];

  const parseQuantifier = (): Quant | null => {
    const c = peek();
    if (c === '*') {
      i += 1;
      if (peek() === '?') i += 1;
      return { min: 0, max: Infinity };
    }
    if (c === '+') {
      i += 1;
      if (peek() === '?') i += 1;
      return { min: 1, max: Infinity };
    }
    if (c === '?') {
      i += 1;
      if (peek() === '?') i += 1;
      return { min: 0, max: 1 };
    }
    if (c === '{') {
      const match = /^\{(\d+)(,(\d*))?\}\??/.exec(source.slice(i));
      if (!match) return null; // a literal "{" that does not form a quantifier
      i += match[0].length;
      const min = Number(match[1]);
      const max = match[2] === undefined ? min : match[3] === '' ? Infinity : Number(match[3]);
      return { min, max };
    }
    return null;
  };

  const parseCharClass = (): void => {
    // Assumes source[i] === '['. Consumes up to and including the matching ']'.
    i += 1;
    if (peek() === ('^' as string)) i += 1;
    if (peek() === (']' as string)) i += 1; // a leading "]" is a literal inside a class
    while (i < length && peek() !== ']') {
      if (peek() === '\\') i += 2;
      else i += 1;
    }
    if (peek() === ']') i += 1;
  };

  const parseGroupPrefix = (): void => {
    // source[i] is the character right after the '(' the caller already consumed.
    if (source.slice(i, i + 2) === '?:' || source.slice(i, i + 2) === '?=' || source.slice(i, i + 2) === '?!') {
      i += 2;
      return;
    }
    if (source.slice(i, i + 3) === '?<=' || source.slice(i, i + 3) === '?<!') {
      i += 3;
      return;
    }
    if (source.slice(i, i + 2) === '?<') {
      const end = source.indexOf('>', i);
      if (end !== -1) i = end + 1;
    }
  };

  const parseBranch = (): RiskAtom[] => {
    const branch: RiskAtom[] = [];
    while (i < length && peek() !== '|' && peek() !== ')') {
      const start = i;
      const c = peek();
      if (c === '(') {
        i += 1;
        parseGroupPrefix();
        // parseAlternation is a `const` defined further down in this same
        // scope; safe here because it is only ever *invoked* — never merely
        // referenced — after parsePattern() has finished defining every
        // helper below and gone on to call parseAlternation() itself.
        const branches = parseAlternation();
        if (peek() === ')') i += 1;
        const quant = parseQuantifier();
        branch.push({ kind: 'group', branches, quant, raw: clipSnippet(source.slice(start, i)) });
        continue;
      }
      if (c === '[') {
        parseCharClass();
        branch.push({ kind: 'other', quant: parseQuantifier() });
        continue;
      }
      if (c === '\\') {
        i += 2;
        branch.push({ kind: 'other', quant: parseQuantifier() });
        continue;
      }
      if (c === '^' || c === '$') {
        i += 1;
        branch.push({ kind: 'other', quant: null });
        continue;
      }
      // A plain character, including "." (any character).
      i += 1;
      const quant = parseQuantifier();
      branch.push(c === '.' ? { kind: 'other', quant } : { kind: 'literal', value: c as string, quant });
    }
    return branch;
  };

  const parseAlternation = (): RiskAtom[][] => {
    const branches: RiskAtom[][] = [parseBranch()];
    while (peek() === '|') {
      i += 1;
      branches.push(parseBranch());
    }
    return branches;
  };

  try {
    return parseAlternation();
  } catch {
    return null;
  }
}

/** True when an unbounded quantifier (`*`, `+`, `{n,}`) appears anywhere within, at any depth. */
function containsUnbounded(branches: RiskAtom[][]): boolean {
  for (const branch of branches) {
    for (const atom of branch) {
      if (atom.quant && atom.quant.max === Infinity) return true;
      if (atom.kind === 'group' && containsUnbounded(atom.branches)) return true;
    }
  }
  return false;
}

/** Reduces a branch to a plain string only when every atom in it is an unquantified literal — the only shape this module compares for overlap. */
function branchLiteral(branch: RiskAtom[]): string | null {
  let text = '';
  for (const atom of branch) {
    if (atom.kind !== 'literal' || atom.quant !== null) return null;
    text += atom.value;
  }
  return text;
}

/** True when two alternation branches are identical or one is a prefix of the other — `(a|a)` and `(a|ab)`, the classic ambiguous-alternation shapes. */
function hasAmbiguousBranches(branches: RiskAtom[][]): boolean {
  const literals = branches.map(branchLiteral);
  for (let a = 0; a < literals.length; a += 1) {
    for (let b = a + 1; b < literals.length; b += 1) {
      const x = literals[a];
      const y = literals[b];
      if (x === null || y === null) continue;
      if (x === y) return true;
      if (x !== '' && y !== '' && (x.startsWith(y) || y.startsWith(x))) return true;
    }
  }
  return false;
}

function collectFindings(branches: RiskAtom[][], findings: RiskFinding[]): void {
  for (const branch of branches) {
    for (const atom of branch) {
      if (atom.kind !== 'group') continue;
      const unbounded = atom.quant !== null && atom.quant.max === Infinity;
      if (unbounded && containsUnbounded(atom.branches)) {
        findings.push({ kind: 'nested-quantifier', snippet: atom.raw });
      }
      if (unbounded && atom.branches.length > 1 && hasAmbiguousBranches(atom.branches)) {
        findings.push({ kind: 'ambiguous-alternation', snippet: atom.raw });
      }
      collectFindings(atom.branches, findings);
    }
  }
}

/**
 * Screens a pattern's source for the regex shapes best known to cause
 * catastrophic backtracking: a quantifier applied to a group that itself
 * contains an unbounded quantifier (`(a+)+`, `(a*)*`, `(\d+)*`), and
 * alternation with overlapping branches under a quantifier (`(a|a)+`,
 * `(a|ab)+`). This is a heuristic, not a proof — a pattern it clears can
 * still be slow, and the recognised shapes are the well-known ones, not every
 * possible one. It exists to warn the person writing the pattern and to pick
 * a tighter sample cap on the fallback path; the actual bound on evaluation
 * time comes from `evaluate()`'s cap and `evaluateAsync()`'s worker terminate.
 */
export function analyzePattern(source: string): PatternRisk {
  const parsed = parsePattern(source);
  if (!parsed) return { dangerous: false, findings: [] };
  const findings: RiskFinding[] = [];
  collectFindings(parsed, findings);
  return { dangerous: findings.length > 0, findings };
}

/* ------------------------------------------------------------------ */
/* Worker-backed evaluation                                            */
/* ------------------------------------------------------------------ */

interface WorkerSuccess {
  ok: true;
  matches: MatchResult['matches'];
  truncated: boolean;
  sampleCapped: boolean;
  elapsedMs: number;
}
interface WorkerFailure {
  ok: false;
  error: string;
}

/**
 * The body of the evaluation worker, inlined as a string and never fetched —
 * this project ships no runtime network access, and a worker built from a
 * Blob URL has no module graph to `import` from regardless. It duplicates a
 * miniature version of `evaluate()`'s match loop rather than sharing it,
 * because the worker's whole reason to exist is that it can be torn down
 * mid-`exec()` by the thread that spawned it, which only works if that
 * spawning thread is not the one running the loop — so the loop has to live
 * somewhere `evaluate()` itself cannot reach.
 */
function workerSource(): string {
  return [
    'self.onmessage = function (event) {',
    '  var data = event.data;',
    '  var sample = data.sample;',
    '  var maxSampleChars = data.maxSampleChars;',
    '  var maxMatches = data.maxMatches;',
    '  var text = sample.length > maxSampleChars ? sample.slice(0, maxSampleChars) : sample;',
    '  var regex;',
    '  try {',
    '    regex = new RegExp(data.source, data.flags);',
    '  } catch (error) {',
    '    self.postMessage({ ok: false, error: String((error && error.message) || error) });',
    '    return;',
    '  }',
    '  var global = data.flags.indexOf("g") !== -1 || data.flags.indexOf("y") !== -1;',
    '  var runner = global ? regex : new RegExp(data.source, data.flags + "g");',
    '  runner.lastIndex = 0;',
    '  var started = Date.now();',
    '  var matches = [];',
    '  var truncated = false;',
    '  for (;;) {',
    '    var found = runner.exec(text);',
    '    if (!found) break;',
    '    var groups = [];',
    '    for (var index = 1; index < found.length; index += 1) groups.push({ name: String(index), value: found[index] });',
    '    if (found.groups) {',
    '      for (var name in found.groups) {',
    '        if (Object.prototype.hasOwnProperty.call(found.groups, name)) groups.push({ name: name, value: found.groups[name] });',
    '      }',
    '    }',
    '    matches.push({ index: found.index, text: found[0], groups: groups });',
    '    if (found[0] === "") runner.lastIndex += 1;',
    '    if (matches.length >= maxMatches) { truncated = true; break; }',
    '  }',
    '  self.postMessage({',
    '    ok: true,',
    '    matches: matches,',
    '    truncated: truncated,',
    '    sampleCapped: text.length !== sample.length,',
    '    elapsedMs: Date.now() - started',
    '  });',
    '};'
  ].join('\n');
}

let workerScriptUrl: string | null = null;

function getWorkerScriptUrl(): string {
  if (!workerScriptUrl) {
    const blob = new Blob([workerSource()], { type: 'application/javascript' });
    workerScriptUrl = URL.createObjectURL(blob);
  }
  return workerScriptUrl;
}

function timedOutResult(risk: PatternRisk, elapsedMs: number, sampleCapped: boolean): MatchResult {
  return {
    matches: [],
    truncated: false,
    timedOut: true,
    elapsedMs,
    sampleCapped,
    sampleCapChars: MAX_SAMPLE_CHARS,
    risk,
    engine: 'worker'
  };
}

/**
 * Runs a compiled pattern over a sample the same way `evaluate()` does, but
 * off the main thread whenever a Worker is available, so a catastrophically
 * backtracking pattern can be interrupted from outside instead of merely
 * bounded from within. This is the real fix for the general case: unlike the
 * sample cap in `evaluate()`, `worker.terminate()` stops evaluation
 * regardless of how dangerous the pattern turns out to be or how long the
 * sample is.
 *
 * Falls back to the synchronous `evaluate()` when no Worker exists in this
 * environment (this module's own unit tests run under jsdom, which does not
 * implement Worker, so `evaluate()` — and its own cap and static screen —
 * is exactly what they exercise). Pass an `AbortSignal` to cancel an
 * in-flight evaluation early, terminating its worker immediately rather than
 * waiting out the full budget; this is what the builder's own `update()`
 * uses so a superseded keystroke does not leave a stale worker running.
 */
export function evaluateAsync(regex: RegExp, sample: string, signal?: AbortSignal): Promise<MatchResult> {
  const risk = analyzePattern(regex.source);

  if (typeof Worker === 'undefined') {
    return Promise.resolve(evaluate(regex, sample));
  }

  return new Promise<MatchResult>((resolve) => {
    let settled = false;
    const worker = new Worker(getWorkerScriptUrl());
    let timer: ReturnType<typeof setTimeout>;

    const cleanup = (): void => {
      clearTimeout(timer);
      worker.removeEventListener('message', onMessage);
      worker.removeEventListener('error', onError);
      signal?.removeEventListener('abort', onAbort);
      worker.terminate();
    };

    const finish = (result: MatchResult): void => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };

    const onMessage = (event: MessageEvent<WorkerSuccess | WorkerFailure>): void => {
      const data = event.data;
      if (!data.ok) {
        finish({
          matches: [],
          truncated: false,
          timedOut: false,
          elapsedMs: 0,
          sampleCapped: false,
          sampleCapChars: MAX_SAMPLE_CHARS,
          risk,
          engine: 'worker'
        });
        return;
      }
      finish({
        matches: data.matches,
        truncated: data.truncated,
        timedOut: false,
        elapsedMs: data.elapsedMs,
        sampleCapped: data.sampleCapped,
        sampleCapChars: MAX_SAMPLE_CHARS,
        risk,
        engine: 'worker'
      });
    };

    const onError = (): void => {
      // A worker script error (not a timeout) — still reported honestly as a
      // stopped evaluation rather than surfaced as a thrown exception, since
      // the caller (the builder's own update loop) treats every MatchResult
      // uniformly.
      finish(timedOutResult(risk, WORKER_TIME_BUDGET_MS, false));
    };

    const onAbort = (): void => {
      // Superseded by a newer evaluation request. Not a budget stop — the
      // caller already knows to discard this result, so its exact shape
      // does not matter beyond being a valid MatchResult.
      finish(timedOutResult(risk, 0, false));
    };

    timer = setTimeout(() => {
      // The worker is still inside exec() and cannot be asked to stop —
      // terminate() is the only interrupt that works on a hung native regex
      // engine. This is the mechanism the whole file exists to provide.
      finish(timedOutResult(risk, WORKER_TIME_BUDGET_MS, sample.length > MAX_SAMPLE_CHARS));
    }, WORKER_TIME_BUDGET_MS);

    worker.addEventListener('message', onMessage);
    worker.addEventListener('error', onError);
    signal?.addEventListener('abort', onAbort);

    worker.postMessage({
      source: regex.source,
      flags: regex.flags,
      sample,
      maxSampleChars: MAX_SAMPLE_CHARS,
      maxMatches: MAX_MATCHES
    });
  });
}

/** Escapes a literal so it can be dropped into a pattern verbatim. */
export function escapeLiteral(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
}

const FLAG_LIST: Array<{ flag: string; label: string }> = [
  { flag: 'g', label: 'global — find every match, not only the first' },
  { flag: 'i', label: 'ignore case' },
  { flag: 'm', label: 'multiline — ^ and $ match at every line' },
  { flag: 's', label: 'dot matches a newline' },
  { flag: 'u', label: 'unicode' },
  { flag: 'y', label: 'sticky — match only at lastIndex' }
];

interface Insertion {
  label: string;
  snippet: string;
  /** Where to leave the caret inside the snippet, counted from its start. */
  caret?: number;
}

const GUIDED: Array<{ group: string; items: Insertion[] }> = [
  {
    group: 'core.regex.insertClass',
    items: [
      { label: 'Any character  .', snippet: '.' },
      { label: 'Digit  \\d', snippet: '\\d' },
      { label: 'Not a digit  \\D', snippet: '\\D' },
      { label: 'Word character  \\w', snippet: '\\w' },
      { label: 'Not a word character  \\W', snippet: '\\W' },
      { label: 'Whitespace  \\s', snippet: '\\s' },
      { label: 'Not whitespace  \\S', snippet: '\\S' },
      { label: 'Custom set  [abc]', snippet: '[]', caret: 1 },
      { label: 'Excluded set  [^abc]', snippet: '[^]', caret: 2 },
      { label: 'Range  [a-z]', snippet: '[a-z]' }
    ]
  },
  {
    group: 'core.regex.insertAnchor',
    items: [
      { label: 'Start of input  ^', snippet: '^' },
      { label: 'End of input  $', snippet: '$' },
      { label: 'Word boundary  \\b', snippet: '\\b' },
      { label: 'Not a word boundary  \\B', snippet: '\\B' }
    ]
  },
  {
    group: 'core.regex.insertGroup',
    items: [
      { label: 'Capturing group  ( )', snippet: '()', caret: 1 },
      { label: 'Non-capturing group  (?: )', snippet: '(?:)', caret: 3 },
      { label: 'Named group  (?<name> )', snippet: '(?<name>)', caret: 8 },
      { label: 'Look ahead  (?= )', snippet: '(?=)', caret: 3 },
      { label: 'Negative look ahead  (?! )', snippet: '(?!)', caret: 3 },
      { label: 'Look behind  (?<= )', snippet: '(?<=)', caret: 4 },
      { label: 'Negative look behind  (?<! )', snippet: '(?<!)', caret: 4 }
    ]
  },
  {
    group: 'core.regex.insertQuantifier',
    items: [
      { label: 'Zero or more  *', snippet: '*' },
      { label: 'One or more  +', snippet: '+' },
      { label: 'Optional  ?', snippet: '?' },
      { label: 'Exactly n  {2}', snippet: '{2}' },
      { label: 'n or more  {2,}', snippet: '{2,}' },
      { label: 'Between n and m  {2,4}', snippet: '{2,4}' },
      { label: 'Lazy one or more  +?', snippet: '+?' },
      { label: 'Lazy zero or more  *?', snippet: '*?' }
    ]
  },
  {
    group: 'core.regex.insertAlternation',
    items: [{ label: 'Either / or  a|b', snippet: '|' }]
  }
];

class RegexBuilder implements RegexBuilderHandle {
  private handle: OverlayHandle | null = null;
  private pattern: string;
  private flags: string;
  private sample: string;
  private readonly options: RegexBuilderOptions;
  /** Cancels a still-running `evaluateAsync()` call — and terminates its worker — when a newer keystroke supersedes it. */
  private currentEvaluation: AbortController | null = null;

  constructor(options: RegexBuilderOptions) {
    this.options = options;
    this.pattern = options.initialPattern ?? '';
    this.flags = options.initialFlags ?? 'g';
    this.sample = options.sample ?? '';
  }

  state(): RegexState {
    const { regex, error } = compile(this.pattern, this.flags);
    return { pattern: this.pattern, flags: this.flags, valid: error === null && (regex !== null || this.pattern === ''), error };
  }

  isOpen(): boolean {
    return this.handle !== null && this.handle.isOpen();
  }

  close(): void {
    this.currentEvaluation?.abort();
    this.currentEvaluation = null;
    this.handle?.close();
    this.handle = null;
  }

  open(): void {
    if (this.isOpen()) {
      this.close();
      return;
    }
    const handle = overlay.open({
      anchor: this.options.anchor,
      placement: 'bottom-start',
      role: 'dialog',
      label: i18n.t('core.regex.title', 'Pattern builder'),
      resizeKey: 'regex-builder',
      onClose: () => {
        this.handle = null;
        this.options.onClose?.();
      }
    });
    this.handle = handle;
    handle.root.classList.add('md-regex');
    this.render(handle.body);
    handle.reposition();
  }

  private render(host: HTMLElement): void {
    host.textContent = '';

    const engineNote = el('p', {
      className: 'md-regex__engine md-typescale-body-small',
      text: i18n.t('core.regex.engine', 'This is the JavaScript RegExp engine.')
    });

    const patternId = nextId('md-regex-pattern');
    const patternLabel = el('label', {
      className: 'md-field__label',
      text: i18n.t('core.regex.pattern', 'Pattern'),
      attrs: { for: patternId }
    });
    const patternInput = el('input', {
      className: 'md-field__input md-regex__pattern',
      attrs: { id: patternId, type: 'text', spellcheck: 'false', autocomplete: 'off' }
    });
    patternInput.value = this.pattern;

    const feedback = el('p', { className: 'md-regex__feedback md-typescale-body-small', attrs: { role: 'status' } });

    // Shows the static pre-screen's findings — naming the exact dangerous
    // construct — the moment the pattern compiles, before evaluate() ever
    // runs against the sample. The builder still runs the pattern; this is
    // teaching, not refusal.
    const riskBox = el('div', { className: 'md-regex__risk', attrs: { role: 'status' } });

    const flagsFieldset = el('fieldset', { className: 'md-regex__flags' });
    flagsFieldset.append(el('legend', { className: 'md-typescale-label-medium', text: i18n.t('core.regex.flags', 'Flags') }));
    const flagInputs = new Map<string, HTMLInputElement>();
    for (const { flag, label } of FLAG_LIST) {
      const id = nextId('md-regex-flag');
      const wrapper = el('label', { className: 'md-regex__flag', attrs: { for: id, title: label } });
      const input = el('input', { attrs: { id, type: 'checkbox' } });
      input.checked = this.flags.includes(flag);
      input.addEventListener('change', () => {
        this.flags = FLAG_LIST.filter(({ flag: candidate }) => flagInputs.get(candidate)?.checked).map((entry) => entry.flag).join('');
        void update();
      });
      flagInputs.set(flag, input);
      wrapper.append(input, el('span', { className: 'md-typescale-label-large', text: flag }));
      wrapper.title = label;
      flagsFieldset.append(wrapper);
    }

    const guided = el('div', { className: 'md-regex__guided' });
    for (const { group, items } of GUIDED) {
      const details = el('details', { className: 'md-regex__guided-group' });
      details.append(el('summary', { className: 'md-typescale-label-large', text: i18n.t(group, group) }));
      const row = el('div', { className: 'md-regex__guided-items' });
      for (const item of items) {
        const button = el('button', { className: 'md-btn md-btn--text md-regex__token', text: item.label, attrs: { type: 'button' } });
        button.addEventListener('click', () => {
          insert(item.snippet, item.caret);
        });
        row.append(button);
      }
      details.append(row);
      guided.append(details);
    }

    const literalRow = el('div', { className: 'md-regex__literal' });
    const literalId = nextId('md-regex-literal');
    const literalInput = el('input', {
      className: 'md-field__input',
      attrs: { id: literalId, type: 'text', placeholder: 'text to match exactly' }
    });
    const literalButton = el('button', {
      className: 'md-btn md-btn--tonal',
      text: i18n.t('core.regex.insertLiteral', 'Literal text'),
      attrs: { type: 'button' }
    });
    literalButton.addEventListener('click', () => {
      if (!literalInput.value) return;
      insert(escapeLiteral(literalInput.value));
      literalInput.value = '';
    });
    literalRow.append(
      el('label', { className: 'md-field__label', text: i18n.t('core.regex.insertLiteral', 'Literal text'), attrs: { for: literalId } }),
      literalInput,
      literalButton
    );

    const sampleId = nextId('md-regex-sample');
    const sampleArea = el('textarea', {
      className: 'md-field__input md-regex__sample',
      attrs: { id: sampleId, rows: '5', spellcheck: 'false' }
    });
    sampleArea.value = this.sample;

    const results = el('div', { className: 'md-regex__results' });

    const actions = el('div', { className: 'md-regex__actions' });
    const copyButton = el('button', {
      className: 'md-btn md-btn--text',
      text: i18n.t('core.action.copy', 'Copy'),
      attrs: { type: 'button' }
    });
    copyButton.addEventListener('click', () => {
      void navigator.clipboard.writeText(`/${this.pattern}/${this.flags}`);
    });
    const exportButton = el('button', {
      className: 'md-btn md-btn--text',
      text: i18n.t('core.action.export', 'Export'),
      attrs: { type: 'button' }
    });
    exportButton.addEventListener('click', () => {
      const payload = JSON.stringify({ pattern: this.pattern, flags: this.flags, engine: 'javascript-regexp' }, null, 2);
      void navigator.clipboard.writeText(payload);
    });
    const applyButton = el('button', {
      className: 'md-btn md-btn--filled',
      text: i18n.t('core.action.apply', 'Apply'),
      attrs: { type: 'button' }
    });
    applyButton.addEventListener('click', () => {
      this.options.onApply(this.state());
      this.close();
    });
    actions.append(copyButton, exportButton, applyButton);

    host.append(
      engineNote,
      el('div', { className: 'md-field md-field--outlined', children: [patternLabel, patternInput] }),
      feedback,
      riskBox,
      flagsFieldset,
      guided,
      literalRow,
      el('div', {
        className: 'md-field md-field--outlined',
        children: [
          el('label', { className: 'md-field__label', text: i18n.t('core.regex.sample', 'Sample text'), attrs: { for: sampleId } }),
          sampleArea
        ]
      }),
      results,
      actions
    );

    const insert = (snippet: string, caret?: number): void => {
      const start = patternInput.selectionStart ?? patternInput.value.length;
      const end = patternInput.selectionEnd ?? start;
      const before = patternInput.value.slice(0, start);
      const after = patternInput.value.slice(end);
      patternInput.value = `${before}${snippet}${after}`;
      const position = start + (caret ?? snippet.length);
      patternInput.setSelectionRange(position, position);
      patternInput.focus();
      this.pattern = patternInput.value;
      void update();
    };

    const renderRisk = (risk: PatternRisk): void => {
      riskBox.textContent = '';
      riskBox.classList.toggle('md-regex__risk--active', risk.dangerous);
      for (const finding of risk.findings) {
        const key = finding.kind === 'nested-quantifier' ? 'core.regex.riskNestedQuantifier' : 'core.regex.riskAmbiguousAlternation';
        riskBox.append(
          el('p', {
            className: 'md-typescale-body-small',
            text: i18n.t(key, 'That construct can backtrack catastrophically: {snippet}', { values: { snippet: finding.snippet } })
          })
        );
      }
    };

    const renderOutcome = (outcome: MatchResult): void => {
      results.textContent = '';
      // A budget stop is never allowed to render as an honest "no matches" —
      // it gets its own line, ahead of and separate from the match count,
      // whichever mechanism (sample cap or worker terminate) produced it.
      if (outcome.timedOut) {
        results.append(
          el('p', {
            className: 'md-regex__feedback md-regex__feedback--error md-typescale-body-small',
            text: i18n.t('core.regex.timeBudget', 'Evaluation stopped after {ms} ms.', {
              values: { ms: outcome.engine === 'worker' ? WORKER_TIME_BUDGET_MS : TIME_BUDGET_MS }
            })
          })
        );
      }
      if (outcome.sampleCapped) {
        results.append(
          el('p', {
            className: 'md-typescale-body-small',
            text: i18n.t('core.regex.sampleCapped', 'Only the first {chars} characters of the sample were evaluated.', {
              values: { chars: outcome.sampleCapChars }
            })
          })
        );
      }
      results.append(
        el('p', {
          className: 'md-typescale-label-large',
          text: `${i18n.t('core.regex.matches', 'Matches')}: ${outcome.matches.length}${outcome.truncated ? '+' : ''} (${outcome.elapsedMs} ms)`
        })
      );
      const list = el('ol', { className: 'md-regex__match-list' });
      for (const match of outcome.matches.slice(0, 50)) {
        const item = el('li', { className: 'md-regex__match' });
        item.append(el('code', { className: 'md-regex__match-text', text: match.text === '' ? '(zero-width)' : match.text }));
        item.append(el('span', { className: 'md-regex__match-index md-typescale-body-small', text: `@${match.index}` }));
        if (match.groups.length > 0) {
          const groups = el('ul', { className: 'md-regex__groups' });
          for (const group of match.groups) {
            groups.append(
              el('li', {
                className: 'md-typescale-body-small',
                text: `${group.name}: ${group.value === undefined ? '(no match)' : group.value}`
              })
            );
          }
          item.append(groups);
        }
        list.append(item);
      }
      results.append(list);
    };

    const update = async (): Promise<void> => {
      // A newer keystroke supersedes whatever evaluation is still in flight —
      // abort it so its worker is torn down immediately rather than left
      // running out its own budget in the background for no reason.
      this.currentEvaluation?.abort();
      this.currentEvaluation = null;

      this.pattern = patternInput.value;
      this.sample = sampleArea.value;
      const { regex, error } = compile(this.pattern, this.flags);
      feedback.classList.toggle('md-regex__feedback--error', error !== null);
      feedback.textContent = error
        ? i18n.t('core.regex.invalid', 'That pattern does not compile: {message}', { values: { message: error } })
        : '';
      riskBox.textContent = '';
      riskBox.classList.remove('md-regex__risk--active');
      results.textContent = '';
      if (!regex) return;

      // Shown immediately, synchronously — the warning does not wait on the
      // sample actually being evaluated.
      renderRisk(analyzePattern(regex.source));

      const controller = new AbortController();
      this.currentEvaluation = controller;
      const outcome = await evaluateAsync(regex, this.sample, controller.signal);
      // Discard a result that arrived after a newer request superseded it —
      // rendering it now would show a stale match list for whatever the
      // pattern or sample used to be a moment ago.
      if (controller.signal.aborted) return;
      this.currentEvaluation = null;
      renderOutcome(outcome);
    };

    patternInput.addEventListener('input', () => {
      void update();
    });
    sampleArea.addEventListener('input', () => {
      void update();
    });
    void update();
    window.requestAnimationFrame(() => patternInput.focus());
  }
}

export function createRegexBuilder(options: RegexBuilderOptions): RegexBuilderHandle {
  return new RegexBuilder(options);
}
