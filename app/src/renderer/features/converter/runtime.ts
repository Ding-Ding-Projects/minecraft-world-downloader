/**
 * Small pieces shared between the convert queue and the PDF tools tab: reading
 * a source file's bytes through the privileged bridge, detecting its type from
 * those bytes, resolving a destination path and turning an adapter's declared
 * options into a starting value set.
 */

import type { AdapterInput, AdapterOption, AdapterOutput, AdapterSpec } from './adapters';
import { base64ToBytes } from './bytes';
import { detectFromBytes, TAIL_BYTES, type Detection } from './detect';
import { directoryOf, joinPath, stemOf } from './formats';
import { ConverterBoundary, Deadline, DEFAULTS, HEAD_BYTES_ID, readLimits } from './limits';
import type { AppContext } from '../../core/registry';

/** The application name and version, written into a produced document's producer line. */
export function producerString(ctx: AppContext): string {
  const info = ctx.studio.info;
  return `${info.productName} ${info.version}`;
}

/**
 * Reads a source file through the privileged bridge, bounded to the current
 * source-size limit. Throws a plain `Error` with the bridge's own message on
 * failure — the caller turns that into a queue item's failure, never into a
 * crash.
 */
export async function readSourceBytes(ctx: AppContext, path: string, limits: ResourceLimits): Promise<Uint8Array> {
  const result = await ctx.studio.fs.readBase64(path, limits.sourceBytes);
  if (!result.ok) throw new Error(result.error);
  return base64ToBytes(result.value);
}

/**
 * Detects a file's real type from bytes already read into memory.
 *
 * Nothing here reads from disk again: the head and tail windows are both
 * slices of the same bounded read `readSourceBytes` already performed.
 */
export function detectSource(path: string, bytes: Uint8Array, headBytes: number): Detection {
  const head = bytes.subarray(0, Math.min(bytes.length, Math.max(256, headBytes)));
  const tail = bytes.length > TAIL_BYTES ? bytes.subarray(bytes.length - TAIL_BYTES) : bytes;
  return detectFromBytes(path, head, tail);
}

/** The declared defaults for an adapter's options, as a starting value set. */
export function defaultAdapterOptions(adapter: AdapterSpec): Record<string, string> {
  const out: Record<string, string> = {};
  for (const option of adapter.options ?? []) out[option.id] = option.defaultValue;
  return out;
}

/** How many bytes the type detector samples, clamped to a sane range. */
export function currentHeadBytes(ctx: AppContext): number {
  const raw = ctx.settings.get<number>(HEAD_BYTES_ID, DEFAULTS.headBytes);
  const parsed = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULTS.headBytes;
  return Math.min(1_000_000, Math.max(256, Math.round(parsed)));
}

/**
 * Runs one adapter's `run` step against a file on disk, end to end: reads the
 * bytes (bounded), detects the type, builds a deadline from the current
 * limits, and calls the adapter. Used by the PDF tools tab for every
 * single-source route (inspect, extract, reorder, rotate, metadata) so those
 * routes are exercised through the exact same path the queue uses.
 */
export async function runSingleFileAdapter(
  ctx: AppContext,
  path: string,
  adapter: AdapterSpec,
  options: Record<string, string>
): Promise<AdapterOutput> {
  if (!adapter.run) {
    throw new ConverterBoundary('unsupported', 'This route has no single-file conversion step.');
  }
  const limits = readLimits(ctx.settings);
  const bytes = await readSourceBytes(ctx, path, limits);
  const detection = detectSource(path, bytes, currentHeadBytes(ctx));
  const deadline = new Deadline(limits.cpuMs);
  const input: AdapterInput = { path, bytes, detection };
  return adapter.run(input, {
    limits,
    deadline,
    options: { ...defaultAdapterOptions(adapter), ...options },
    producer: producerString(ctx)
  });
}

/** Writes an adapter's output to a destination path, creating the folder first. Throws the bridge's own message on failure. */
export async function writeOutput(ctx: AppContext, destination: string, text: string): Promise<void> {
  const ensured = await ctx.studio.fs.ensureDirectory(directoryOf(destination));
  if (!ensured.ok) throw new Error(ensured.error);
  const written = await ctx.studio.fs.writeText(destination, text);
  if (!written.ok) throw new Error(written.error);
}

/**
 * Where a converted file should be written.
 *
 * An empty destination folder means "beside the source", which is the
 * honest default for a one-off conversion; a chosen folder is used for every
 * file in the batch, which is what makes a destination setting meaningful for
 * more than one file at a time.
 */
export function resolveOutputPath(sourcePath: string, destinationFolder: string, extension: string, suffix = ''): string {
  const stem = stemOf(sourcePath);
  const name = `${stem}${suffix}.${extension}`;
  const folder = destinationFolder.trim().length > 0 ? destinationFolder : directoryOf(sourcePath);
  return joinPath(folder, name);
}

/** Renders one adapter option's control into `host`, wired to `values`. */
export function renderAdapterOption(
  host: HTMLElement,
  ctx: AppContext,
  option: AdapterOption,
  values: Record<string, string>,
  onChange: () => void
): void {
  const label = ctx.t(option.labelKey, option.id);
  const description = ctx.t(option.descriptionKey, '');
  if (option.kind === 'select' && option.choices) {
    const control = ctx.components.select({
      label,
      value: values[option.id] ?? option.defaultValue,
      options: option.choices.map((choice) => ({ value: choice.value, label: ctx.t(choice.label, choice.value) })),
      onChange: (value) => {
        values[option.id] = value;
        onChange();
      }
    });
    host.append(control.root);
  } else if (option.kind === 'number') {
    const control = ctx.components.textField({
      label,
      type: 'number',
      value: values[option.id] ?? option.defaultValue,
      min: option.min,
      max: option.max,
      supportingText: description || undefined,
      onCommit: (value) => {
        values[option.id] = value;
        onChange();
      }
    });
    host.append(control.root);
  } else {
    const control = ctx.components.textField({
      label,
      value: values[option.id] ?? option.defaultValue,
      supportingText: description || undefined,
      onCommit: (value) => {
        values[option.id] = value;
        onChange();
      }
    });
    host.append(control.root);
  }
}
