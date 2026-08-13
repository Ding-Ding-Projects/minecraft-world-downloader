import type { StudioApi } from '../../../shared/api';

/**
 * Keeps the application window above the browser while a download decision or a
 * completion notice is unresolved, and puts it back down afterwards.
 *
 * It is a reference count rather than a boolean because two surfaces can be
 * open at once — a second capture arriving while the first Start dialog is
 * still up is the normal case, not the exotic one — and the last one to close
 * is the one that may lower the window.
 *
 * The user can switch this off. When they have, `hold` still runs and still
 * balances, so the count never drifts; it simply asks the window for nothing.
 */
export class AlwaysOnTop {
  private studio: StudioApi | null = null;
  private holds = 0;
  private raised = false;
  private enabled = true;

  attach(studio: StudioApi): void {
    this.studio = studio;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled && this.raised) void this.lower();
    if (enabled && this.holds > 0) void this.raise();
  }

  /** Takes one hold. The returned function releases exactly that hold, once. */
  hold(): () => void {
    this.holds += 1;
    if (this.holds === 1) void this.raise();
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.holds = Math.max(0, this.holds - 1);
      if (this.holds === 0) void this.lower();
    };
  }

  active(): boolean {
    return this.raised;
  }

  private async raise(): Promise<void> {
    if (!this.enabled || this.raised) return;
    const result = await this.studio?.window.setAlwaysOnTop(true);
    if (result?.ok) this.raised = true;
  }

  private async lower(): Promise<void> {
    if (!this.raised) return;
    const result = await this.studio?.window.setAlwaysOnTop(false);
    if (result?.ok) this.raised = false;
  }
}

export const alwaysOnTop = new AlwaysOnTop();
