/**
 * Resource bounds and the setting ids that carry them.
 *
 * Every adapter runs inside these numbers. They exist so that a hostile or
 * simply enormous source stops at a stated boundary rather than taking the
 * window with it, and so that the boundary a user hits is a number they can see
 * and change rather than a mystery.
 */

import type { SettingsStore } from '../../core/registry';

export const MAX_SOURCE_BYTES_ID = 'converter.limits.sourceBytes';
export const MAX_OUTPUT_BYTES_ID = 'converter.limits.outputBytes';
export const MAX_PIXELS_ID = 'converter.limits.pixels';
export const MAX_PAGES_ID = 'converter.limits.pages';
export const MAX_ENTRIES_ID = 'converter.limits.entries';
export const MAX_DEPTH_ID = 'converter.limits.depth';
export const CPU_BUDGET_ID = 'converter.limits.cpuMs';
export const CONCURRENCY_ID = 'converter.queue.concurrency';
export const CHECKPOINT_EVERY_ID = 'converter.queue.checkpointEvery';
export const DESTINATION_ID = 'converter.queue.destination';
export const OVERWRITE_ID = 'converter.output.overwrite';
export const RESUME_ON_LAUNCH_ID = 'converter.queue.resumeOnLaunch';
export const KEEP_OUTCOMES_ID = 'converter.queue.keepOutcomes';
export const HEAD_BYTES_ID = 'converter.detect.headBytes';

/** The compiled-in defaults, named here once so the provenance line can quote them. */
export const DEFAULTS = {
  /** 16 MiB. The privileged read channel itself refuses beyond 32 MiB. */
  sourceBytes: 16 * 1024 * 1024,
  /** 64 MiB. Hexadecimal re-encoding roughly doubles a payload, so this is above it. */
  outputBytes: 64 * 1024 * 1024,
  /** 40 megapixels: a 40-megapixel decode is about 160 MiB of RGBA. */
  pixels: 40_000_000,
  pages: 5_000,
  entries: 20_000,
  depth: 32,
  cpuMs: 20_000,
  concurrency: 2,
  checkpointEvery: 25,
  destination: '',
  overwrite: 'confirm' as const,
  resumeOnLaunch: true,
  keepOutcomes: 500,
  /** Bytes read for signature detection before anything else touches the file. */
  headBytes: 4_096
} as const;

export interface ResourceLimits {
  /** Hard ceiling on the source read, in bytes. */
  sourceBytes: number;
  /** Hard ceiling on the produced output, in bytes. */
  outputBytes: number;
  /** Hard ceiling on decoded pixels for an image adapter. */
  pixels: number;
  /** Hard ceiling on pages for a document adapter. */
  pages: number;
  /** Hard ceiling on archive members, records or rows. */
  entries: number;
  /** Hard ceiling on nesting depth while parsing. */
  depth: number;
  /** Wall-clock budget for one file, in milliseconds. */
  cpuMs: number;
}

function positive(value: unknown, fallback: number, ceiling: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), ceiling);
}

/** Reads the user's current bounds. Every adapter takes these, never its own. */
export function readLimits(settings: SettingsStore): ResourceLimits {
  return {
    sourceBytes: positive(settings.get(MAX_SOURCE_BYTES_ID, DEFAULTS.sourceBytes), DEFAULTS.sourceBytes, 32 * 1024 * 1024),
    outputBytes: positive(settings.get(MAX_OUTPUT_BYTES_ID, DEFAULTS.outputBytes), DEFAULTS.outputBytes, 256 * 1024 * 1024),
    pixels: positive(settings.get(MAX_PIXELS_ID, DEFAULTS.pixels), DEFAULTS.pixels, 200_000_000),
    pages: positive(settings.get(MAX_PAGES_ID, DEFAULTS.pages), DEFAULTS.pages, 100_000),
    entries: positive(settings.get(MAX_ENTRIES_ID, DEFAULTS.entries), DEFAULTS.entries, 500_000),
    depth: positive(settings.get(MAX_DEPTH_ID, DEFAULTS.depth), DEFAULTS.depth, 512),
    cpuMs: positive(settings.get(CPU_BUDGET_ID, DEFAULTS.cpuMs), DEFAULTS.cpuMs, 600_000)
  };
}

/**
 * A cooperative deadline.
 *
 * Adapters call `check()` inside their loops. The budget is wall clock rather
 * than processor time, which is the honest measure here: the work runs on the
 * renderer's own task queue, so the number a user cares about is how long the
 * window is busy.
 */
export class Deadline {
  private readonly startedAt = Date.now();
  private cancelled = false;

  constructor(private readonly budgetMs: number) {}

  /** Marks the deadline cancelled so the next `check()` stops the work. */
  cancel(): void {
    this.cancelled = true;
  }

  isCancelled(): boolean {
    return this.cancelled;
  }

  elapsedMs(): number {
    return Date.now() - this.startedAt;
  }

  /** Throws with the exact boundary when the budget is spent or work was cancelled. */
  check(): void {
    if (this.cancelled) {
      throw new ConverterBoundary('cancelled', 'The conversion was cancelled. Nothing was written.');
    }
    if (this.elapsedMs() > this.budgetMs) {
      throw new ConverterBoundary(
        'cpu',
        `The conversion passed its ${this.budgetMs} ms budget after ${this.elapsedMs()} ms. Nothing was written.`
      );
    }
  }
}

/** Which bound a refusal hit. Reported verbatim so a user can raise the right one. */
export type BoundaryKind =
  | 'source-size'
  | 'output-size'
  | 'pixels'
  | 'pages'
  | 'entries'
  | 'depth'
  | 'cpu'
  | 'cancelled'
  | 'unsupported'
  | 'malformed'
  | 'encrypted'
  | 'unavailable'
  | 'validation'
  | 'destination';

/**
 * A refusal that names its exact boundary.
 *
 * Thrown instead of a bare `Error` so the surface can say which limit was hit
 * and offer the setting that governs it, rather than printing a sentence and
 * leaving the user to guess.
 */
export class ConverterBoundary extends Error {
  constructor(
    readonly kind: BoundaryKind,
    message: string
  ) {
    super(message);
    this.name = 'ConverterBoundary';
  }
}

/** True when `error` is a boundary refusal rather than an unexpected fault. */
export function isBoundary(error: unknown): error is ConverterBoundary {
  return error instanceof ConverterBoundary;
}

/**
 * Turns any thrown value into a message that is safe to show.
 *
 * A document tool must never leak a source path, a secret, document content or
 * a network detail into a failure line, so anything that is not a deliberate
 * boundary is reduced to its class name plus the adapter's own summary.
 */
export function safeFailureMessage(error: unknown): string {
  if (isBoundary(error)) return error.message;
  if (error instanceof Error) {
    const first = error.message.split('\n')[0].trim();
    // A parser message may quote bytes from the document. Keep it short and
    // strip anything that looks like a path.
    const scrubbed = first
      .replace(/[A-Za-z]:\\[^\s"']+/g, '(path removed)')
      .replace(/(?:\/[\w.\-@]+){2,}/g, '(path removed)')
      .slice(0, 240);
    return scrubbed.length > 0 ? scrubbed : error.name;
  }
  return 'The conversion failed for an unrecognised reason. Nothing was written.';
}
