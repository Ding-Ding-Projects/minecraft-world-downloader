import type { HistoryEntry, HistoryQuery, HistoryRecorder, HistoryStatus } from './types';

/**
 * The renderer's view of the local, append-only version history.
 *
 * Every settings change, every record a feature creates, edits or deletes, and
 * every restore is one entry. Restoring is itself a new entry, so an undo can be
 * undone and that undo undone in turn — the repository's own history is never
 * rewritten.
 *
 * `record` never throws into the caller. A history write that fails must not
 * fail the operation the user actually asked for; it is logged and reported
 * through the status surface instead.
 */

class HistoryImpl implements HistoryRecorder {
  private failures = 0;

  async record(action: string, source: string, payload: unknown): Promise<void> {
    const result = await window.studio.history.record(action, source, payload);
    if (!result.ok) {
      this.failures += 1;
      console.error(`The history entry "${action}" was not recorded: ${result.error}`);
    }
  }

  async list(query?: HistoryQuery): Promise<HistoryEntry[]> {
    const result = await window.studio.history.list(query);
    if (!result.ok) throw new Error(result.error);
    return result.value;
  }

  async status(): Promise<HistoryStatus> {
    const result = await window.studio.history.status();
    if (!result.ok) throw new Error(result.error);
    return result.value;
  }

  async actions(): Promise<Array<{ action: string; count: number }>> {
    const result = await window.studio.history.actions();
    if (!result.ok) throw new Error(result.error);
    return result.value;
  }

  async prune(olderThanIso: string): Promise<{ removed: number }> {
    const result = await window.studio.history.prune(olderThanIso);
    if (!result.ok) throw new Error(result.error);
    return result.value;
  }

  /** How many entries failed to record this session. Surfaced, never hidden. */
  failureCount(): number {
    return this.failures;
  }
}

export const history = new HistoryImpl();

/**
 * Records settings changes automatically.
 *
 * The label says WHAT changed rather than that something did: "Changed the
 * language mode", not "Updated". A history full of "Updated" is a list nobody
 * can read.
 */
export function attachSettingsHistory(
  settingsStore: { onChange(listener: (change: { id: string; value: unknown; previous: unknown }) => void): () => void },
  describe: (id: string) => string
): () => void {
  return settingsStore.onChange((change) => {
    // The personal vocabulary cache never enters the history: it is the user's
    // own private word list, and a history entry is a durable record.
    if (change.id.startsWith('vocabulary.')) return;
    void history.record(`Changed ${describe(change.id)}`, 'core.settings', {
      id: change.id,
      from: change.previous,
      to: change.value
    });
  });
}
