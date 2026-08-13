import type { StudioApi } from '../../core/registry';
import {
  createSelfLane,
  isEvidenceState,
  isHttpUrl,
  isStatusValue,
  MAX_EVIDENCE_PER_LANE,
  MAX_GATES_PER_LANE,
  MAX_LANES,
  MAX_LONG_TEXT,
  MAX_SHORT_TEXT,
  MAX_URL_LENGTH,
  SELF_LANE_ID
} from './model';
import type { EvidenceItem, LaneRecord, WorktreeRecord } from './model';
import { clampText, joinPath } from './util';

/**
 * Where this feature's local record actually lives, and how it stays honest.
 *
 * Lanes are kept in their own file rather than inside the settings document,
 * for the same reason the version-history annotations are: this is data the
 * application recorded, not a user preference, and mixing it into settings
 * would make every edit here show up as a generic "changed a setting" entry in
 * the very history panel this data is trying to stay legible next to.
 *
 * Every write reports whether it actually reached disk, and every read that
 * finds something it cannot use drops just that one thing and says so, rather
 * than refusing the whole file over one bad record.
 */

const FILE_NAME = 'status-lanes.json';
const SCHEMA_VERSION = 1;
const MAX_BYTES = 4 * 1024 * 1024;

interface StatusDocument {
  schemaVersion: number;
  lanes: LaneRecord[];
  updatedAt: string;
}

function emptyDocument(): StatusDocument {
  return { schemaVersion: SCHEMA_VERSION, lanes: [createSelfLane()], updatedAt: new Date(0).toISOString() };
}

function sanitizeEvidence(value: unknown): EvidenceItem[] {
  if (!Array.isArray(value)) return [];
  const out: EvidenceItem[] = [];
  for (const raw of value) {
    if (out.length >= MAX_EVIDENCE_PER_LANE) break;
    if (!raw || typeof raw !== 'object') continue;
    const record = raw as Record<string, unknown>;
    const state = isEvidenceState(record.state) ? record.state : null;
    const label = typeof record.label === 'string' ? clampText(record.label, MAX_SHORT_TEXT) : '';
    const url = typeof record.url === 'string' ? clampText(record.url, MAX_URL_LENGTH) : '';
    if (!state || label === '' || !isHttpUrl(url)) continue;
    const id = typeof record.id === 'string' && record.id !== '' ? record.id : `evidence-${out.length + 1}`;
    out.push({ id, label, url, state });
  }
  return out;
}

function sanitizeGates(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const raw of value) {
    if (out.length >= MAX_GATES_PER_LANE) break;
    if (typeof raw !== 'string') continue;
    const trimmed = raw.trim();
    if (trimmed === '') continue;
    out.push(clampText(trimmed, MAX_SHORT_TEXT));
  }
  return out;
}

function sanitizeWorktrees(value: unknown): WorktreeRecord[] {
  if (!Array.isArray(value)) return [];
  const out: WorktreeRecord[] = [];
  for (const raw of value.slice(0, 8)) {
    if (!raw || typeof raw !== 'object') continue;
    const record = raw as Record<string, unknown>;
    out.push({
      path: typeof record.path === 'string' ? clampText(record.path, MAX_URL_LENGTH) : '',
      branch: typeof record.branch === 'string' ? clampText(record.branch, MAX_SHORT_TEXT) : '',
      commit: typeof record.commit === 'string' ? clampText(record.commit, 64) : '',
      bytes: typeof record.bytes === 'number' && Number.isFinite(record.bytes) ? Math.max(0, record.bytes) : 0,
      dirty: record.dirty === true
    });
  }
  return out;
}

function sanitizeLane(value: unknown): LaneRecord | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const id = typeof record.id === 'string' && record.id.trim() !== '' ? record.id : null;
  if (!id) return null;
  const origin = record.origin === 'local' && id === SELF_LANE_ID ? 'local' : 'manual';
  const title = clampText(record.title, MAX_SHORT_TEXT) || (origin === 'local' ? 'This checkout' : 'Untitled lane');
  return {
    id,
    origin,
    title,
    repository: clampText(record.repository, MAX_SHORT_TEXT),
    branch: clampText(record.branch, MAX_SHORT_TEXT),
    agent: clampText(record.agent, MAX_SHORT_TEXT),
    status: isStatusValue(record.status) ? record.status : 'waiting',
    summary: clampText(record.summary, MAX_LONG_TEXT),
    assumption: clampText(record.assumption, MAX_LONG_TEXT),
    verifiedBaseline: clampText(record.verifiedBaseline, MAX_LONG_TEXT),
    evidence: sanitizeEvidence(record.evidence),
    nextGates: sanitizeGates(record.nextGates),
    machine: clampText(record.machine, MAX_SHORT_TEXT),
    worktrees: sanitizeWorktrees(record.worktrees),
    updatedAt: typeof record.updatedAt === 'string' && record.updatedAt !== '' ? record.updatedAt : new Date(0).toISOString()
  };
}

export interface WriteOutcome {
  ok: boolean;
  /** Empty on success. */
  error: string;
  path: string;
}

export class StatusStore {
  private document: StatusDocument = emptyDocument();
  private readonly path: string;
  private loaded = false;
  private lastError = '';
  private queue: Promise<WriteOutcome> = Promise.resolve({ ok: true, error: '', path: '' });

  constructor(private readonly studio: StudioApi) {
    this.path = joinPath(studio.info.userDataDir, FILE_NAME, studio.info.platform);
  }

  filePath(): string {
    return this.path;
  }

  isLoaded(): boolean {
    return this.loaded;
  }

  /** The last read or write failure, for the panel's honest status line. */
  failure(): string {
    return this.lastError;
  }

  documentUpdatedAt(): string {
    return this.document.updatedAt;
  }

  async load(): Promise<void> {
    this.loaded = true;
    const stat = await this.studio.fs.stat(this.path);
    if (!stat.ok || !stat.value.exists) {
      // No file yet is the ordinary first-run state, not a failure.
      this.lastError = '';
      return;
    }
    const read = await this.studio.fs.readText(this.path, MAX_BYTES);
    if (!read.ok) {
      this.lastError = read.error;
      return;
    }
    try {
      const parsed = JSON.parse(read.value) as Partial<StatusDocument>;
      if (!parsed || typeof parsed !== 'object') throw new Error('the file does not hold an object');
      if (parsed.schemaVersion !== SCHEMA_VERSION) {
        throw new Error(`schema version ${String(parsed.schemaVersion)} is not one this build understands`);
      }
      const lanes = Array.isArray(parsed.lanes)
        ? parsed.lanes
            .map(sanitizeLane)
            .filter((lane): lane is LaneRecord => lane !== null)
            .slice(0, MAX_LANES)
        : [];
      if (!lanes.some((lane) => lane.id === SELF_LANE_ID)) lanes.unshift(createSelfLane());
      this.document = {
        schemaVersion: SCHEMA_VERSION,
        lanes,
        updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date(0).toISOString()
      };
      this.lastError = '';
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
    }
  }

  /** A defensive copy — callers can hold on to it without risk of mutating the store. */
  lanes(): LaneRecord[] {
    return this.document.lanes.map((lane) => ({
      ...lane,
      evidence: lane.evidence.map((item) => ({ ...item })),
      nextGates: [...lane.nextGates],
      worktrees: lane.worktrees.map((worktree) => ({ ...worktree }))
    }));
  }

  private persist(): Promise<WriteOutcome> {
    this.document.updatedAt = new Date().toISOString();
    const payload = JSON.stringify(this.document, null, 2);
    this.queue = this.queue.then(async () => {
      const result = await this.studio.fs.writeText(this.path, payload);
      const outcome: WriteOutcome = { ok: result.ok, error: result.ok ? '' : result.error, path: this.path };
      this.lastError = outcome.ok ? '' : outcome.error;
      return outcome;
    });
    return this.queue;
  }

  async upsertLane(lane: LaneRecord): Promise<WriteOutcome> {
    const index = this.document.lanes.findIndex((existing) => existing.id === lane.id);
    if (index === -1) {
      if (this.document.lanes.length >= MAX_LANES) {
        return { ok: false, error: `No more than ${MAX_LANES} lanes can be kept locally.`, path: this.path };
      }
      this.document.lanes.push(lane);
    } else {
      this.document.lanes[index] = lane;
    }
    return this.persist();
  }

  async removeLanes(ids: string[]): Promise<WriteOutcome> {
    const removable = new Set(ids.filter((id) => id !== SELF_LANE_ID));
    this.document.lanes = this.document.lanes.filter((lane) => !removable.has(lane.id));
    return this.persist();
  }
}
