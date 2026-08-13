/**
 * Runs the region worker and reads region occupancy, both through the
 * already-sanctioned privileged bridge — no new IPC channel, no edit outside
 * this feature's own directory. See `worker-source.ts`'s header comment for
 * why this is a spawned `node` process rather than an IPC handler.
 */

import type { StudioApi } from '../../../shared/api';
import {
  MAX_REGION_READ_BYTES,
  base64ToBytes,
  emptyOccupancy,
  joinPath,
  parseRegionOccupancy,
  type ChunkPos,
  type RegionOccupancy
} from './model';
import { REGION_EDIT_WORKER_SOURCE, WORKER_VERSION } from './worker-source';

export interface CopyOperation {
  kind: 'copy';
  sourceRegionPath: string;
  sourceEntitiesPath: string | null;
  source: ChunkPos;
  destRegionPath: string;
  destEntitiesPath: string | null;
  destination: ChunkPos;
}

export interface RemoveOperation {
  kind: 'remove';
  regionPath: string;
  entitiesPath: string | null;
  chunks: ChunkPos[];
}

export interface WorkerResult {
  ok: boolean;
  error: string | null;
  filesWritten: string[];
  detail: string;
}

let scriptPathCache: string | null = null;
let scriptVersionWritten = -1;

function workerDirectory(studio: StudioApi): string {
  return joinPath(studio.info.userDataDir, 'world-vault-edit');
}

async function ensureWorkerScript(studio: StudioApi): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const scriptPath = joinPath(workerDirectory(studio), 'region-worker.cjs');
  if (scriptPathCache === scriptPath && scriptVersionWritten === WORKER_VERSION) return { ok: true, path: scriptPath };

  const ensured = await studio.fs.ensureDirectory(workerDirectory(studio));
  if (!ensured.ok) return { ok: false, error: ensured.error };
  const written = await studio.fs.writeText(scriptPath, REGION_EDIT_WORKER_SOURCE);
  if (!written.ok) return { ok: false, error: written.error };

  scriptPathCache = scriptPath;
  scriptVersionWritten = WORKER_VERSION;
  return { ok: true, path: scriptPath };
}

function waitForExit(studio: StudioApi, id: string): Promise<number | null> {
  return new Promise((resolve) => {
    const stop = studio.events.on('process:event', (event) => {
      if (event.id !== id) return;
      if (event.kind === 'exit') {
        stop();
        resolve(event.code);
      } else if (event.kind === 'error') {
        stop();
        resolve(-1);
      }
    });
  });
}

/** Runs one copy or remove operation. Never throws — every failure comes back as `ok: false`. */
export async function runOperation(studio: StudioApi, operation: CopyOperation | RemoveOperation): Promise<WorkerResult> {
  const script = await ensureWorkerScript(studio);
  if (!script.ok) {
    return { ok: false, error: `The region worker could not be prepared: ${script.error}`, filesWritten: [], detail: '' };
  }

  const operationPath = joinPath(
    workerDirectory(studio),
    `operation-${String(Date.now())}-${String(Math.floor(Math.random() * 1_000_000))}.json`
  );
  const payload =
    operation.kind === 'copy'
      ? {
          kind: 'copy',
          copy: {
            sourceRegionPath: operation.sourceRegionPath,
            sourceEntitiesPath: operation.sourceEntitiesPath,
            source: operation.source,
            destRegionPath: operation.destRegionPath,
            destEntitiesPath: operation.destEntitiesPath,
            destination: operation.destination
          }
        }
      : {
          kind: 'remove',
          remove: { regionPath: operation.regionPath, entitiesPath: operation.entitiesPath, chunks: operation.chunks }
        };

  const writtenOp = await studio.fs.writeText(operationPath, JSON.stringify(payload));
  if (!writtenOp.ok) {
    return { ok: false, error: `The operation could not be written to disk: ${writtenOp.error}`, filesWritten: [], detail: '' };
  }

  const spawned = await studio.process.spawn({ command: 'node', args: [script.path, operationPath], timeoutMs: 30_000 });
  if (!spawned.ok) {
    return { ok: false, error: spawned.error, filesWritten: [], detail: '' };
  }

  const id = spawned.value.id;
  const code = await waitForExit(studio, id);
  const stdout = await studio.process.readOutput(id, 'stdout');
  const stderr = await studio.process.readOutput(id, 'stderr');
  const outText = stdout.ok ? stdout.value : '';
  const lines = outText.trim().split('\n').filter((line) => line.trim() !== '');
  const lastLine = lines[lines.length - 1];

  if (!lastLine) {
    const errText = stderr.ok ? stderr.value : '';
    return {
      ok: false,
      error: `The region worker produced no output (exit code ${String(code)}).${errText ? ` ${errText}` : ''}`,
      filesWritten: [],
      detail: ''
    };
  }

  try {
    const parsed = JSON.parse(lastLine) as WorkerResult;
    return {
      ok: parsed.ok === true,
      error: typeof parsed.error === 'string' ? parsed.error : parsed.ok ? null : 'The worker reported failure with no message.',
      filesWritten: Array.isArray(parsed.filesWritten) ? parsed.filesWritten : [],
      detail: typeof parsed.detail === 'string' ? parsed.detail : ''
    };
  } catch {
    return { ok: false, error: `The worker's output could not be parsed as JSON: ${lastLine}`, filesWritten: [], detail: '' };
  }
}

/** Reads just the occupancy header of one region file. Absent/unreadable reads as "nothing occupied", not an error. */
export async function readRegionOccupancy(studio: StudioApi, absolutePath: string, rx: number, rz: number): Promise<RegionOccupancy> {
  const stat = await studio.fs.stat(absolutePath);
  if (!stat.ok || !stat.value.exists || !stat.value.isFile) return emptyOccupancy(rx, rz);
  const read = await studio.fs.readBase64(absolutePath, MAX_REGION_READ_BYTES);
  if (!read.ok) return emptyOccupancy(rx, rz);
  return parseRegionOccupancy(rx, rz, base64ToBytes(read.value));
}
