import type { ProcessEvent, Result, StudioApi } from '../../../shared/api';
import type { RunningModel } from './api';
import { describeError, formatBytes, parseJson } from './util';

/**
 * Hardware evidence, and the fit verdict computed from it.
 *
 * The rule this file exists to keep: a verdict is evidence, never a promise, and
 * never a reading of a model's name. Every number below comes from something
 * that measured it — the browser runtime, the graphics driver, the model
 * runtime's own report of what it loaded, or a measurement helper the user
 * explicitly allowed to run. A figure nobody measured is `null`, and a `null`
 * produces Unknown or a more conservative verdict rather than a zero.
 *
 * One asymmetry matters and is honoured throughout: `navigator.deviceMemory` is
 * a LOWER BOUND that the browser caps at 8 GiB. Eight gibibytes of reported
 * memory means "at least eight", not "eight". It can therefore support a
 * positive verdict and can never support a negative one, so it is never used to
 * conclude that something will not fit.
 */

export type FitVerdict = 'well' | 'limits' | 'unlikely' | 'unknown';

export interface EvidenceLine {
  /** What was measured. */
  label: string;
  /** The measured value, already formatted. */
  value: string;
  /** Where the figure came from, so a reader can judge it. */
  source: string;
  /** True when the figure is a bound rather than an exact reading. */
  approximate: boolean;
}

export interface HardwareSnapshot {
  takenAt: string;
  platform: string;
  arch: string;
  /** Logical processors the browser runtime reports. */
  logicalCores: number | null;
  /** Lower bound on system memory in bytes, from `navigator.deviceMemory`. */
  memoryLowerBound: number | null;
  /** Exact total system memory, only present after a measured probe. */
  measuredTotalMemory: number | null;
  /** Exact free system memory, only present after a measured probe. */
  measuredFreeMemory: number | null;
  /** Free bytes on the measured destination, only after a measured probe. */
  measuredFreeDisk: number | null;
  /** The path the disk figure was measured at. */
  measuredDiskPath: string | null;
  /** The graphics adapter string the driver reports, verbatim. */
  gpuRenderer: string | null;
  gpuVendor: string | null;
  /** Largest VRAM footprint the model runtime has been observed to hold. */
  observedVramBytes: number | null;
  /** Which model was loaded when that VRAM figure was observed. */
  observedVramModel: string | null;
  /** Anything that could not be measured, and exactly why. */
  gaps: string[];
}

export function emptySnapshot(): HardwareSnapshot {
  return {
    takenAt: new Date().toISOString(),
    platform: 'unknown',
    arch: 'unknown',
    logicalCores: null,
    memoryLowerBound: null,
    measuredTotalMemory: null,
    measuredFreeMemory: null,
    measuredFreeDisk: null,
    measuredDiskPath: null,
    gpuRenderer: null,
    gpuVendor: null,
    observedVramBytes: null,
    observedVramModel: null,
    gaps: []
  };
}

/* ------------------------------------------------------------------ */
/* Collection                                                          */
/* ------------------------------------------------------------------ */

interface DeviceMemoryNavigator extends Navigator {
  deviceMemory?: number;
}

/**
 * Reads the graphics adapter string.
 *
 * `WEBGL_debug_renderer_info` is the only route a renderer has to the real
 * adapter name, and a browser may refuse it. A refusal is recorded as a gap
 * rather than replaced with a guess.
 */
function readGpu(): { renderer: string | null; vendor: string | null; gap: string | null } {
  let canvas: HTMLCanvasElement | null = null;
  try {
    canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl2') ?? canvas.getContext('webgl')) as WebGLRenderingContext | null;
    if (!gl) return { renderer: null, vendor: null, gap: 'The graphics adapter could not be identified: no WebGL context was available.' };
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    if (!info) {
      return {
        renderer: null,
        vendor: null,
        gap: 'The graphics adapter could not be identified: the browser refused the debug renderer extension.'
      };
    }
    const renderer = gl.getParameter(info.UNMASKED_RENDERER_WEBGL);
    const vendor = gl.getParameter(info.UNMASKED_VENDOR_WEBGL);
    return {
      renderer: typeof renderer === 'string' && renderer.trim() !== '' ? renderer.trim() : null,
      vendor: typeof vendor === 'string' && vendor.trim() !== '' ? vendor.trim() : null,
      gap: null
    };
  } catch (error) {
    return { renderer: null, vendor: null, gap: `The graphics adapter could not be identified: ${describeError(error)}` };
  } finally {
    canvas?.remove();
  }
}

/** Collects everything measurable without running any external process. */
export function collectBrowserEvidence(studio: StudioApi, running: RunningModel[]): HardwareSnapshot {
  const snapshot = emptySnapshot();
  snapshot.platform = studio.info.platform;
  snapshot.arch = studio.info.arch;

  const cores = navigator.hardwareConcurrency;
  snapshot.logicalCores = typeof cores === 'number' && cores > 0 ? cores : null;
  if (snapshot.logicalCores === null) snapshot.gaps.push('The processor count was not reported by the browser runtime.');

  const declared = (navigator as DeviceMemoryNavigator).deviceMemory;
  if (typeof declared === 'number' && declared > 0) {
    snapshot.memoryLowerBound = declared * 1024 * 1024 * 1024;
  } else {
    snapshot.gaps.push('System memory was not reported by the browser runtime.');
  }

  const gpu = readGpu();
  snapshot.gpuRenderer = gpu.renderer;
  snapshot.gpuVendor = gpu.vendor;
  if (gpu.gap) snapshot.gaps.push(gpu.gap);

  let best: RunningModel | null = null;
  for (const model of running) {
    const vram = typeof model.size_vram === 'number' ? model.size_vram : 0;
    if (vram <= 0) continue;
    if (!best || (best.size_vram ?? 0) < vram) best = model;
  }
  if (best) {
    snapshot.observedVramBytes = best.size_vram ?? null;
    snapshot.observedVramModel = best.name;
  } else {
    snapshot.gaps.push(
      'Usable video memory is unknown: no model is currently loaded into video memory, so nothing has measured it. Load a model and refresh to observe a real figure.'
    );
  }
  snapshot.gaps.push(
    'Free disk space and exact system memory need the measurement helper, which is off until you turn it on in Settings › Local models.'
  );
  return snapshot;
}

/**
 * The measurement helper.
 *
 * This is a fixed program held as a constant in this file. Nothing a user types
 * ever becomes part of it: the only value that crosses the boundary is the
 * folder to measure, and it arrives as its own argument rather than being
 * concatenated into the text. There is no shell, so there is nothing for a
 * concatenation to escape into even if one were attempted.
 */
export const PROBE_SOURCE = [
  "const os = require('os');",
  "const fs = require('fs');",
  'const target = process.argv[1] || os.homedir();',
  'let disk = null;',
  'try {',
  '  const s = fs.statfsSync(target);',
  '  disk = { free: s.bfree * s.bsize, total: s.blocks * s.bsize, path: target };',
  '} catch (error) {',
  '  disk = { error: String(error && error.message ? error.message : error), path: target };',
  '}',
  'process.stdout.write(JSON.stringify({',
  '  totalMemory: os.totalmem(),',
  '  freeMemory: os.freemem(),',
  '  cpus: os.cpus().length,',
  '  platform: os.platform(),',
  '  arch: os.arch(),',
  '  disk: disk',
  '}));'
].join('\n');

export interface ProbeOutcome {
  totalMemory: number | null;
  freeMemory: number | null;
  freeDisk: number | null;
  diskPath: string | null;
  diskError: string | null;
  cpus: number | null;
}

/** The exact command and arguments the helper will run, for the preview. */
export function probeCommandPreview(destination: string): { command: string; args: string[] } {
  return { command: 'node', args: ['-e', PROBE_SOURCE, destination] };
}

/**
 * Runs the measurement helper and waits for its single JSON line.
 *
 * Failure here is never fatal and never silent: a machine with no `node` on its
 * path simply keeps its Unknown figures, and the exact refusal is reported.
 */
export async function runProbe(studio: StudioApi, destination: string): Promise<Result<ProbeOutcome>> {
  const preview = probeCommandPreview(destination);
  const spawned = await studio.process.spawn({
    command: preview.command,
    args: preview.args,
    maxOutputBytes: 64 * 1024,
    timeoutMs: 20_000
  });
  if (!spawned.ok) {
    return {
      ok: false,
      error: `The measurement helper could not start: ${spawned.error}`,
      code: spawned.code ?? 'spawn'
    };
  }
  const id = spawned.value.id;

  const settled = await new Promise<Result<string>>((resolve) => {
    let stdout = '';
    let stderr = '';
    let done = false;
    const finish = (value: Result<string>): void => {
      if (done) return;
      done = true;
      unsubscribe();
      window.clearTimeout(timer);
      resolve(value);
    };
    const unsubscribe = studio.events.on('process:event', (event: ProcessEvent) => {
      if (event.id !== id) return;
      if (event.kind === 'stdout') stdout += event.chunk;
      else if (event.kind === 'stderr') stderr += event.chunk;
      else if (event.kind === 'error') finish({ ok: false, error: event.message, code: 'process' });
      else if (event.kind === 'exit') {
        if (event.code === 0) finish({ ok: true, value: stdout });
        else {
          finish({
            ok: false,
            error: `The measurement helper exited with code ${event.code ?? 'unknown'}${
              stderr.trim() === '' ? '' : `: ${stderr.trim().slice(0, 400)}`
            }`,
            code: 'exit'
          });
        }
      }
    });
    const timer = window.setTimeout(() => {
      void studio.process.kill(id);
      finish({ ok: false, error: 'The measurement helper did not answer within 25 seconds.', code: 'timeout' });
    }, 25_000);
  });

  if (!settled.ok) return { ok: false, error: settled.error, code: settled.code };

  const parsed = parseJson<{
    totalMemory?: number;
    freeMemory?: number;
    cpus?: number;
    disk?: { free?: number; total?: number; path?: string; error?: string } | null;
  }>(settled.value.trim());
  if (!parsed) {
    return { ok: false, error: 'The measurement helper produced output this application could not read.', code: 'parse' };
  }
  return {
    ok: true,
    value: {
      totalMemory: typeof parsed.totalMemory === 'number' ? parsed.totalMemory : null,
      freeMemory: typeof parsed.freeMemory === 'number' ? parsed.freeMemory : null,
      freeDisk: typeof parsed.disk?.free === 'number' ? parsed.disk.free : null,
      diskPath: typeof parsed.disk?.path === 'string' ? parsed.disk.path : null,
      diskError: typeof parsed.disk?.error === 'string' ? parsed.disk.error : null,
      cpus: typeof parsed.cpus === 'number' ? parsed.cpus : null
    }
  };
}

/** Folds a probe result into a snapshot without discarding what was already known. */
export function applyProbe(snapshot: HardwareSnapshot, probe: ProbeOutcome): HardwareSnapshot {
  const next: HardwareSnapshot = { ...snapshot, gaps: [...snapshot.gaps] };
  next.measuredTotalMemory = probe.totalMemory;
  next.measuredFreeMemory = probe.freeMemory;
  next.measuredFreeDisk = probe.freeDisk;
  next.measuredDiskPath = probe.diskPath;
  if (probe.cpus !== null) next.logicalCores = probe.cpus;
  next.takenAt = new Date().toISOString();
  next.gaps = next.gaps.filter(
    (gap) => !gap.startsWith('Free disk space and exact system memory') && !gap.startsWith('System memory was not reported')
  );
  if (probe.diskError) {
    next.gaps.push(`Free disk space could not be measured at ${probe.diskPath ?? 'the chosen folder'}: ${probe.diskError}`);
  }
  return next;
}

/** The evidence rows a panel renders beside a verdict. */
export function evidenceLines(snapshot: HardwareSnapshot): EvidenceLine[] {
  const lines: EvidenceLine[] = [
    { label: 'Platform', value: `${snapshot.platform} ${snapshot.arch}`, source: 'Application runtime', approximate: false }
  ];
  if (snapshot.logicalCores !== null) {
    lines.push({
      label: 'Logical processors',
      value: String(snapshot.logicalCores),
      source: snapshot.measuredTotalMemory !== null ? 'Measurement helper' : 'Browser runtime',
      approximate: false
    });
  }
  if (snapshot.measuredTotalMemory !== null) {
    lines.push({
      label: 'System memory',
      value: formatBytes(snapshot.measuredTotalMemory),
      source: 'Measurement helper',
      approximate: false
    });
  } else if (snapshot.memoryLowerBound !== null) {
    lines.push({
      label: 'System memory',
      value: `at least ${formatBytes(snapshot.memoryLowerBound)}`,
      source: 'Browser runtime, which caps its answer at 8 GiB',
      approximate: true
    });
  }
  if (snapshot.measuredFreeMemory !== null) {
    lines.push({
      label: 'Free system memory',
      value: formatBytes(snapshot.measuredFreeMemory),
      source: 'Measurement helper',
      approximate: false
    });
  }
  if (snapshot.measuredFreeDisk !== null) {
    lines.push({
      label: `Free disk at ${snapshot.measuredDiskPath ?? 'the measured folder'}`,
      value: formatBytes(snapshot.measuredFreeDisk),
      source: 'Measurement helper',
      approximate: false
    });
  }
  if (snapshot.gpuRenderer) {
    lines.push({ label: 'Graphics adapter', value: snapshot.gpuRenderer, source: 'Graphics driver', approximate: false });
  }
  if (snapshot.observedVramBytes !== null) {
    lines.push({
      label: 'Video memory observed in use',
      value: `${formatBytes(snapshot.observedVramBytes)} while ${snapshot.observedVramModel ?? 'a model'} was loaded`,
      source: 'Model runtime',
      approximate: true
    });
  }
  return lines;
}

/* ------------------------------------------------------------------ */
/* Verdicts                                                            */
/* ------------------------------------------------------------------ */

export interface FitInput {
  /** Bytes of weights that must be held in memory. `null` when unpublished. */
  modelBytes: number | null;
  /** Bytes that must be transferred and stored. `null` when unpublished. */
  downloadBytes: number | null;
  /** Declared context window in tokens, or `null`. */
  contextLength: number | null;
  /** The user's configured working-memory allowance, in bytes. */
  contextOverheadBytes: number;
}

export interface FitResult {
  verdict: FitVerdict;
  /** One sentence naming the arithmetic, not an adjective. */
  headline: string;
  /** Every step of the reasoning, in the order it was applied. */
  reasons: string[];
  /** What was assumed because nothing measured it. */
  assumptions: string[];
  /** Working memory the verdict was computed against. */
  requiredBytes: number | null;
  computedAt: string;
}

export function verdictLabel(verdict: FitVerdict): string {
  switch (verdict) {
    case 'well':
      return 'Runs well';
    case 'limits':
      return 'Runs with limits';
    case 'unlikely':
      return 'Unlikely';
    default:
      return 'Unknown';
  }
}

/** Sorts worst-first so a filter on "Unlikely" surfaces the real problems. */
export const VERDICT_ORDER: FitVerdict[] = ['well', 'limits', 'unlikely', 'unknown'];

/**
 * Computes one fit verdict.
 *
 * The order below is the whole policy, and each branch states the arithmetic it
 * used so the reader can disagree with it on the evidence rather than on faith.
 */
export function computeFit(input: FitInput, snapshot: HardwareSnapshot): FitResult {
  const computedAt = new Date().toISOString();
  const reasons: string[] = [];
  const assumptions: string[] = [];

  if (input.modelBytes === null) {
    return {
      verdict: 'unknown',
      headline: 'The weights size was never published for this variant, so nothing can be computed from it.',
      reasons: [
        'A fit verdict is arithmetic over a measured weights size. This variant has none, and a size read off its name would be a guess.'
      ],
      assumptions: [],
      requiredBytes: null,
      computedAt
    };
  }

  const required = input.modelBytes + input.contextOverheadBytes;
  reasons.push(
    `Working memory needed: ${formatBytes(input.modelBytes)} of weights plus the configured ${formatBytes(
      input.contextOverheadBytes
    )} allowance for context and runtime overhead, which is ${formatBytes(required)}.`
  );
  assumptions.push(
    'The context and runtime allowance is a flat configured figure, not a per-model calculation. Raise it in Settings if your context window is large.'
  );
  if (input.contextLength !== null) {
    reasons.push(`The variant declares a context window of ${input.contextLength.toLocaleString()} tokens.`);
  } else {
    assumptions.push('The context window is not published for this variant, so the flat allowance is all that was budgeted.');
  }

  // Storage first: a variant that cannot be stored cannot be run, and that is
  // the one negative conclusion a measured disk figure supports outright.
  if (input.downloadBytes !== null && snapshot.measuredFreeDisk !== null) {
    if (input.downloadBytes > snapshot.measuredFreeDisk) {
      reasons.push(
        `The download is ${formatBytes(input.downloadBytes)} and the measured free space at ${
          snapshot.measuredDiskPath ?? 'the measured folder'
        } is ${formatBytes(snapshot.measuredFreeDisk)}. It does not fit.`
      );
      return {
        verdict: 'unlikely',
        headline: 'There is not enough measured free disk space to store this variant.',
        reasons,
        assumptions,
        requiredBytes: required,
        computedAt
      };
    }
    reasons.push(
      `The download is ${formatBytes(input.downloadBytes)} against ${formatBytes(
        snapshot.measuredFreeDisk
      )} of measured free space, so storage is not the constraint.`
    );
  } else if (input.downloadBytes !== null) {
    assumptions.push('Free disk space has not been measured, so storage was not checked at all.');
  }

  // Video memory, when something has actually measured it.
  if (snapshot.observedVramBytes !== null) {
    const headroom = snapshot.observedVramBytes;
    if (required <= headroom * 0.85) {
      reasons.push(
        `The runtime has been observed holding ${formatBytes(headroom)} in video memory, and ${formatBytes(
          required
        )} is within 85% of that.`
      );
      assumptions.push(
        'The observed figure is what the adapter held on one occasion, which is a lower bound on its capacity rather than the capacity itself.'
      );
      return {
        verdict: 'well',
        headline: 'It fits inside a video-memory footprint this machine has already been observed to hold.',
        reasons,
        assumptions,
        requiredBytes: required,
        computedAt
      };
    }
    reasons.push(
      `The largest video-memory footprint observed on this machine is ${formatBytes(headroom)}, which ${formatBytes(
        required
      )} exceeds. The runtime would fall back to system memory for part or all of it.`
    );
  } else {
    assumptions.push(
      'No video-memory figure has been observed on this machine, so the verdict was computed against system memory alone.'
    );
  }

  // System memory. A measured total supports both directions; the browser's
  // lower bound supports only the positive one.
  if (snapshot.measuredTotalMemory !== null) {
    const total = snapshot.measuredTotalMemory;
    if (required <= total * 0.5) {
      reasons.push(`${formatBytes(required)} is at most half of the measured ${formatBytes(total)} of system memory.`);
      return {
        verdict: 'well',
        headline: 'It fits comfortably in measured system memory, with room for everything else running.',
        reasons,
        assumptions,
        requiredBytes: required,
        computedAt
      };
    }
    if (required <= total * 0.85) {
      reasons.push(
        `${formatBytes(required)} is between half and 85% of the measured ${formatBytes(
          total
        )} of system memory, so it fits but leaves little room for other work.`
      );
      return {
        verdict: 'limits',
        headline: 'It fits in measured system memory, but close enough to the ceiling to slow other work down.',
        reasons,
        assumptions,
        requiredBytes: required,
        computedAt
      };
    }
    reasons.push(`${formatBytes(required)} is more than 85% of the measured ${formatBytes(total)} of system memory.`);
    return {
      verdict: 'unlikely',
      headline: 'It needs more memory than this machine measurably has free for it.',
      reasons,
      assumptions,
      requiredBytes: required,
      computedAt
    };
  }

  if (snapshot.memoryLowerBound !== null) {
    const bound = snapshot.memoryLowerBound;
    assumptions.push(
      `The browser runtime reports system memory as a lower bound capped at 8 GiB, so "${formatBytes(
        bound
      )}" means at least that much. It can confirm that something fits and can never show that something does not.`
    );
    if (required <= bound * 0.5) {
      reasons.push(`${formatBytes(required)} is at most half of the at-least-${formatBytes(bound)} lower bound.`);
      return {
        verdict: 'well',
        headline: 'It fits inside the memory this machine is known to have at minimum.',
        reasons,
        assumptions,
        requiredBytes: required,
        computedAt
      };
    }
    if (required <= bound * 0.85) {
      reasons.push(`${formatBytes(required)} is within 85% of the at-least-${formatBytes(bound)} lower bound.`);
      return {
        verdict: 'limits',
        headline: 'It fits inside the known minimum memory, but with little headroom.',
        reasons,
        assumptions,
        requiredBytes: required,
        computedAt
      };
    }
    reasons.push(
      `${formatBytes(required)} exceeds the at-least-${formatBytes(
        bound
      )} lower bound. Because that figure is a bound and not a reading, this is not evidence that it will fail.`
    );
    return {
      verdict: 'unknown',
      headline: 'It exceeds the only memory figure available, and that figure is a lower bound rather than a reading.',
      reasons,
      assumptions,
      requiredBytes: required,
      computedAt
    };
  }

  return {
    verdict: 'unknown',
    headline: 'Nothing on this machine has measured its memory, so there is nothing to compute a verdict against.',
    reasons,
    assumptions: [...assumptions, 'Turn the measurement helper on in Settings › Local models to replace this with arithmetic.'],
    requiredBytes: required,
    computedAt
  };
}
