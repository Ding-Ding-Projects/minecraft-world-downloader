import type { AppContext } from '../../core/registry';
import { ProtectedHistory } from './protected';
import { AnnotationStore } from './store';

/**
 * The feature's shared state.
 *
 * One instance is created in `init` and both surfaces read it, so the label
 * store and the protected log are the same objects wherever they are reached
 * from — a label edited in the details overlay and the same label shown in a row
 * can never disagree about what it is.
 */

export const RETENTION_DAYS_ID = 'history.retentionDays';
export const AUTO_PRUNE_ID = 'history.autoPruneAtStartup';
export const PAGE_SIZE_ID = 'history.pageSize';
export const MAX_LOAD_ID = 'history.maxLoad';
export const REDACT_EXPORTS_ID = 'history.redactExports';
export const EXPORT_FORMAT_ID = 'history.exportFormat';

/**
 * Appends one entry and reports honestly whether it landed.
 *
 * `ctx.history.record` is the same channel, but it swallows a failure so the
 * caller's own operation cannot be broken by a history write. Everything in this
 * feature wants the answer — a label that was applied but not recorded, or a
 * prune whose own record never landed, is something the user should be told
 * about — so it goes through the bridge directly and reads the envelope.
 */
export async function recordEntry(
  ctx: AppContext,
  action: string,
  source: string,
  payload: unknown
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const result = await ctx.studio.history.record(action, source, payload);
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, id: result.value.id };
}

/** Field names whose values are replaced on the way out of the application. */
const CREDENTIAL_SHAPED =
  /(pass(word)?|secret|pin\b|otp|totp|token|credential|verifier|apikey|api_key|authorization|cookie|vocabulary|envelope)/i;

const REPLACEMENT = '[redacted on export]';

/**
 * The second redaction pass.
 *
 * The stored history is already redacted when it is written; this runs again on
 * the way out, because an export leaves the machine and the file says how many
 * values it replaced rather than quietly shipping them.
 */
export function redactRecords(records: Array<Record<string, unknown>>): {
  records: Array<Record<string, unknown>>;
  redactedFields: number;
} {
  let redactedFields = 0;

  const walk = (value: unknown, depth: number): unknown => {
    if (depth > 8) return '[depth limit]';
    if (Array.isArray(value)) return value.map((item) => walk(item, depth + 1));
    if (value !== null && typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
        if (CREDENTIAL_SHAPED.test(key)) {
          out[key] = REPLACEMENT;
          redactedFields += 1;
          continue;
        }
        out[key] = walk(item, depth + 1);
      }
      return out;
    }
    return value;
  };

  const mapped = records.map((record) => walk(record, 0) as Record<string, unknown>);
  return { records: mapped, redactedFields };
}

type Hook = () => void;

export class FeatureState {
  readonly store: AnnotationStore;
  readonly protectedLog: ProtectedHistory;

  private refreshHook: Hook | null = null;
  private focusSearchHook: Hook | null = null;
  private focusDatesHook: Hook | null = null;
  private exportHook: Hook | null = null;
  private pruneHook: Hook | null = null;

  constructor(readonly ctx: AppContext) {
    this.store = new AnnotationStore(ctx.studio);
    this.protectedLog = new ProtectedHistory(ctx);
  }

  registerRefresh(hook: Hook): void {
    this.refreshHook = hook;
  }
  registerFocusSearch(hook: Hook): void {
    this.focusSearchHook = hook;
  }
  registerFocusDates(hook: Hook): void {
    this.focusDatesHook = hook;
  }
  registerExport(hook: Hook): void {
    this.exportHook = hook;
  }
  registerPrune(hook: Hook): void {
    this.pruneHook = hook;
  }

  /**
   * Runs a hook the mounted panel registered.
   *
   * When the panel is not mounted the tab is opened first and the hook runs on
   * the next frame, so a palette command always lands somewhere real rather than
   * doing nothing because the destination happened to be closed.
   */
  private run(hook: Hook | null, tabId: string, again: () => Hook | null): void {
    if (hook) {
      hook();
      return;
    }
    this.ctx.tabs.open(tabId);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => again()?.());
    });
  }

  refresh(): void {
    this.run(this.refreshHook, 'history.panel', () => this.refreshHook);
  }
  focusSearch(): void {
    this.ctx.tabs.teleport('history.panel', 'history-search');
    this.run(this.focusSearchHook, 'history.panel', () => this.focusSearchHook);
  }
  focusDates(): void {
    this.ctx.tabs.teleport('history.panel', 'history-daterange');
    this.run(this.focusDatesHook, 'history.panel', () => this.focusDatesHook);
  }
  exportHistory(): void {
    this.run(this.exportHook, 'history.panel', () => this.exportHook);
  }
  pruneHistory(): void {
    this.run(this.pruneHook, 'history.panel', () => this.pruneHook);
  }
}
