import type { AppContext } from '../../core/registry';
import { ChatStore } from './store';

/**
 * The feature's shared state: one `ChatStore` created in `init`, plus a small
 * registry of hooks the mounted panels install so a palette command can reach
 * them.
 *
 * A palette entry can run before its tab has ever been opened, so a hook that
 * is not yet registered opens the tab and retries once the panel has had a
 * chance to mount, rather than silently doing nothing.
 */

type Hook = () => void;

export class ChatFeatureState {
  readonly store: ChatStore;

  private exportLogHook: Hook | null = null;
  private openNewRuleHook: Hook | null = null;

  constructor(readonly ctx: AppContext) {
    this.store = new ChatStore(ctx);
  }

  registerExportLog(hook: Hook | null): void {
    this.exportLogHook = hook;
  }

  registerOpenNewRule(hook: Hook | null): void {
    this.openNewRuleHook = hook;
  }

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

  exportLog(): void {
    this.run(this.exportLogHook, 'mineflayer-chat.chat', () => this.exportLogHook);
  }

  openNewRule(): void {
    this.run(this.openNewRuleHook, 'mineflayer-chat.rules', () => this.openNewRuleHook);
  }
}
