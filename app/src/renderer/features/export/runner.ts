import type { AppContext } from '../../core/registry';
import {
  buildManifest,
  planArchive,
  renderCommandLine,
  runCommand,
  safeRelativePath,
  type ArchiveEntry,
  type ArchiveOptions,
  type ArchivePlan
} from './archive';
import { formatById, serializeExport, type ExtendedFormat, type LineEnding } from './formats';
import type { ExportSource } from './sources';

/**
 * The engine behind the surface.
 *
 * Everything here reports what actually happened rather than what was intended.
 * A run that is cancelled halfway says how many files were written and that
 * those files are complete; a source that fails to load fails on its own row and
 * does not take the other twenty with it; and every file that is written is
 * stat'd afterwards, so "written" means the bytes are on the disk rather than
 * that a write call returned without complaining.
 */

/* ------------------------------------------------------------------ */
/* Paths                                                               */
/* ------------------------------------------------------------------ */

export function separatorFor(platform: string): string {
  return platform === 'win32' ? '\\' : '/';
}

export function joinPath(separator: string, ...segments: string[]): string {
  return segments
    .filter((segment) => segment.length > 0)
    .map((segment, index) => (index === 0 ? segment.replace(/[\\/]+$/, '') : segment.replace(/^[\\/]+|[\\/]+$/g, '')))
    .join(separator);
}

export function parentOf(path: string, separator: string): string {
  const index = Math.max(path.lastIndexOf('\\'), path.lastIndexOf('/'));
  return index <= 0 ? path : path.slice(0, index) || separator;
}

/* ------------------------------------------------------------------ */
/* Cancellation                                                        */
/* ------------------------------------------------------------------ */

export interface CancelToken {
  cancelled: boolean;
  cancel(): void;
}

export function createCancelToken(): CancelToken {
  return {
    cancelled: false,
    cancel(): void {
      this.cancelled = true;
    }
  };
}

/* ------------------------------------------------------------------ */
/* Outcomes                                                            */
/* ------------------------------------------------------------------ */

export type OutcomeStatus = 'written' | 'failed' | 'skipped' | 'cancelled';

export interface ExportOutcome {
  sourceId: string;
  name: string;
  status: OutcomeStatus;
  format: ExtendedFormat;
  /** Absolute path, present only when the file is genuinely on disk. */
  path: string | null;
  bytes: number;
  records: number;
  losses: Array<{ field: string; reason: string }>;
  schemaOnly: boolean;
  error: string | null;
  finishedAt: string;
}

export interface RunRequest {
  sources: ExportSource[];
  /** Chosen format per source id. Missing entries fall back to the default. */
  formats: Map<string, ExtendedFormat>;
  destination: string;
  lineEnding: LineEnding;
  byteOrderMark: boolean;
  token: CancelToken;
  onProgress(update: { done: number; total: number; current: string }): void;
}

function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

async function writeVerified(ctx: AppContext, path: string, text: string): Promise<number> {
  const written = await ctx.studio.fs.writeText(path, text);
  if (!written.ok) throw new Error(written.error);
  // A write call that returns without complaining is not proof the bytes landed.
  const stat = await ctx.studio.fs.stat(path);
  if (!stat.ok) throw new Error(`The file was written but could not be read back: ${stat.error}`);
  if (!stat.value.exists || !stat.value.isFile) {
    throw new Error('The write reported success but no file exists at that path.');
  }
  return stat.value.size;
}

/**
 * Serializes one source into the text that will be written, with everything the
 * surface needs to describe it honestly.
 */
export async function prepareOne(
  ctx: AppContext,
  source: ExportSource,
  format: ExtendedFormat,
  lineEnding: LineEnding,
  byteOrderMark: boolean
): Promise<{ text: string; extension: string; records: number; losses: ExportOutcome['losses']; schemaOnly: boolean }> {
  const payload = await source.load(ctx);
  const serialized = serializeExport(payload, { name: source.id, format, lineEnding, byteOrderMark }, ctx.exporter);
  return {
    text: serialized.text,
    extension: serialized.extension,
    records: payload.kind === 'records' ? payload.records.length : 1,
    losses: serialized.preflight.losses,
    schemaOnly: serialized.schemaOnly
  };
}

export function fileNameFor(sourceId: string, format: ExtendedFormat): string {
  const descriptor = formatById(format);
  return `${safeRelativePath(sourceId)}.${descriptor ? descriptor.extension : 'txt'}`;
}

/**
 * Writes every selected source into the destination folder.
 *
 * Cancellation is checked between sources rather than mid-write, so a cancelled
 * run never leaves a half-written file behind: whatever exists is complete.
 */
export async function runExport(ctx: AppContext, request: RunRequest): Promise<ExportOutcome[]> {
  const separator = separatorFor(ctx.studio.info.platform);
  const outcomes: ExportOutcome[] = [];
  const total = request.sources.length;

  const ensured = await ctx.studio.fs.ensureDirectory(request.destination);
  if (!ensured.ok) throw new Error(ensured.error);

  let done = 0;
  for (const source of request.sources) {
    const format = request.formats.get(source.id) ?? 'json';
    if (request.token.cancelled) {
      outcomes.push({
        sourceId: source.id,
        name: source.name,
        status: 'cancelled',
        format,
        path: null,
        bytes: 0,
        records: 0,
        losses: [],
        schemaOnly: false,
        error: null,
        finishedAt: new Date().toISOString()
      });
      continue;
    }

    request.onProgress({ done, total, current: source.name });

    try {
      const prepared = await prepareOne(ctx, source, format, request.lineEnding, request.byteOrderMark);
      const path = joinPath(separator, request.destination, fileNameFor(source.id, format));
      const bytes = await writeVerified(ctx, path, prepared.text);
      outcomes.push({
        sourceId: source.id,
        name: source.name,
        status: 'written',
        format,
        path,
        bytes,
        records: prepared.records,
        losses: prepared.losses,
        schemaOnly: prepared.schemaOnly,
        error: null,
        finishedAt: new Date().toISOString()
      });
    } catch (error) {
      outcomes.push({
        sourceId: source.id,
        name: source.name,
        status: 'failed',
        format,
        path: null,
        bytes: 0,
        records: 0,
        losses: [],
        schemaOnly: false,
        error: error instanceof Error ? error.message : String(error),
        finishedAt: new Date().toISOString()
      });
    }

    done += 1;
    request.onProgress({ done, total, current: source.name });
    // Yields to the event loop so the progress bar, the cancel button and the
    // live region all actually update between sources.
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  }

  return outcomes;
}

/* ------------------------------------------------------------------ */
/* Archive staging                                                     */
/* ------------------------------------------------------------------ */

export interface StagingResult {
  /** Absolute path of the root folder every entry sits under. */
  rootDirectory: string;
  /** Bare folder name, which is also the root inside the archive. */
  root: string;
  entries: ArchiveEntry[];
  outcomes: ExportOutcome[];
  manifestPath: string;
}

export interface StageRequest extends RunRequest {
  /** Bare name for the archive and for the folder its entries sit under. */
  root: string;
  options: ArchiveOptions;
  /** The command line, already redacted, written into the manifest. */
  commandLine: string;
}

/**
 * Writes the archive's contents into a folder, at exactly the relative paths the
 * archive will carry, with a manifest naming everything inside.
 *
 * This is both the first half of creating an archive and the honest standalone
 * answer when no archiver can be reached: the same entries, the same layout, and
 * a command line the user can run themselves.
 */
export async function stageArchiveEntries(ctx: AppContext, request: StageRequest): Promise<StagingResult> {
  const separator = separatorFor(ctx.studio.info.platform);
  const root = safeRelativePath(request.root);
  const rootDirectory = joinPath(separator, request.destination, root);

  const ensured = await ctx.studio.fs.ensureDirectory(rootDirectory);
  if (!ensured.ok) throw new Error(ensured.error);

  const outcomes = await runExport(ctx, { ...request, destination: rootDirectory });

  const entries: ArchiveEntry[] = [];
  for (const outcome of outcomes) {
    if (outcome.status !== 'written') continue;
    const source = request.sources.find((candidate) => candidate.id === outcome.sourceId);
    entries.push({
      relativePath: fileNameFor(outcome.sourceId, outcome.format),
      text: '',
      describes: `${source ? source.name : outcome.sourceId} — ${outcome.records} ${
        outcome.records === 1 ? 'record' : 'records'
      }, ${outcome.bytes} bytes${outcome.schemaOnly ? ', a schema rather than the records themselves' : ''}`
    });
  }

  const manifest = buildManifest({
    entries,
    options: request.options,
    root,
    commandLine: request.commandLine,
    generatedAt: new Date().toISOString(),
    productName: ctx.studio.info.productName,
    version: ctx.studio.info.version
  });
  const manifestPath = joinPath(separator, rootDirectory, 'MANIFEST.md');
  await writeVerified(ctx, manifestPath, manifest);
  entries.push({ relativePath: 'MANIFEST.md', text: manifest, describes: 'This list, naming everything inside.' });

  return { rootDirectory, root, entries, outcomes, manifestPath };
}

/* ------------------------------------------------------------------ */
/* Archive creation                                                    */
/* ------------------------------------------------------------------ */

export interface ArchiveResult {
  staging: StagingResult;
  plan: ArchivePlan;
  /** True only when the archive file exists on disk afterwards. */
  created: boolean;
  archivePath: string;
  bytes: number;
  /** Present when the archiver could not be started at all. */
  refusal: string | null;
  /** Present when the archiver ran and failed. */
  failure: string | null;
}

/**
 * Stages the entries, runs the archiver over them and checks the result.
 *
 * The archive is stat'd afterwards, so `created` means a file of a stated size
 * exists — not that a process exited zero. A split archive writes `.001` first,
 * so that is checked as well before reporting a miss.
 */
export async function createArchive(
  ctx: AppContext,
  request: StageRequest & { archiverCommand: string }
): Promise<ArchiveResult> {
  const separator = separatorFor(ctx.studio.info.platform);
  const staging = await stageArchiveEntries(ctx, request);

  const plan = planArchive({
    command: request.archiverCommand,
    options: request.options,
    parentDirectory: request.destination,
    root: staging.root,
    separator
  });

  const outcome = await runCommand(ctx.studio, {
    command: plan.command,
    args: plan.args,
    cwd: plan.cwd,
    timeoutMs: 600_000
  });

  if (!outcome.started) {
    return {
      staging,
      plan,
      created: false,
      archivePath: plan.archivePath,
      bytes: 0,
      refusal: outcome.refusal ?? 'The archiver could not be started and no reason was given.',
      failure: null
    };
  }

  if (outcome.timedOut) {
    return {
      staging,
      plan,
      created: false,
      archivePath: plan.archivePath,
      bytes: 0,
      refusal: null,
      failure: 'The archiver ran for longer than ten minutes without reporting an exit, so it was given up on.'
    };
  }

  const candidates = request.options.volume ? [`${plan.archivePath}.001`, plan.archivePath] : [plan.archivePath];
  for (const candidate of candidates) {
    const stat = await ctx.studio.fs.stat(candidate);
    if (stat.ok && stat.value.exists && stat.value.isFile && stat.value.size > 0) {
      return {
        staging,
        plan,
        created: true,
        archivePath: candidate,
        bytes: stat.value.size,
        refusal: null,
        failure: outcome.exitCode === 0 ? null : `The archiver exited with code ${String(outcome.exitCode)} but wrote a file anyway.`
      };
    }
  }

  const detail = (outcome.stderr || outcome.stdout).trim().slice(0, 600);
  return {
    staging,
    plan,
    created: false,
    archivePath: plan.archivePath,
    bytes: 0,
    refusal: null,
    failure: `The archiver exited with code ${String(outcome.exitCode)} and no archive was written.${
      detail ? ` It said: ${detail}` : ''
    }`
  };
}

/* ------------------------------------------------------------------ */
/* Summaries                                                           */
/* ------------------------------------------------------------------ */

export function summarize(outcomes: ExportOutcome[]): {
  written: number;
  failed: number;
  skipped: number;
  cancelled: number;
  bytes: number;
} {
  let written = 0;
  let failed = 0;
  let skipped = 0;
  let cancelled = 0;
  let bytes = 0;
  for (const outcome of outcomes) {
    if (outcome.status === 'written') {
      written += 1;
      bytes += outcome.bytes;
    } else if (outcome.status === 'failed') failed += 1;
    else if (outcome.status === 'skipped') skipped += 1;
    else cancelled += 1;
  }
  return { written, failed, skipped, cancelled, bytes };
}
