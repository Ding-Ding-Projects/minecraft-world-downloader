import { el } from './a11y';
import { components } from './components';
import { i18n } from './i18n';

/**
 * Long operations: real progress in the surface that started them, a
 * disabled submitting control for the whole run, and a re-entry guard that
 * holds even when something bypasses the `disabled` attribute.
 *
 * A bare spinner is indistinguishable from a hang, so the progress indicator
 * here always mounts into the caller's own `host` — the panel or tab that
 * started the operation — rather than a shared, anonymous location. And a
 * disabled button is only the VISIBLE guard against a second click: a
 * keyboard Enter on a wrapping form, or a second caller reusing the same
 * control reference, can still fire the handler again. `runLongOperation`
 * therefore also tracks in-flight controls itself, so re-entry is refused
 * independently of whatever the DOM's `disabled` state happens to be.
 */

const running = new WeakSet<HTMLButtonElement>();

export interface OptionalPhase {
  /** i18n key describing the optional phase, e.g. "Also verify checksums". */
  label: string;
  /** i18n key stating plainly what skipping it leaves undone. */
  skipDescription: string;
  /** Whether the phase is offered on by default. */
  defaultOn?: boolean;
}

export interface LongOperationOptions<T> {
  /** The surface that started the operation. Progress mounts HERE. */
  host: HTMLElement;
  /** The submitting control. Disabled for the run and guarded against re-entry. */
  control: HTMLButtonElement;
  /** i18n key describing what is running, shown beside the indicator. */
  label: string;
  /** i18n key used as the control's disabled reason while busy. */
  busyReason?: string;
  /**
   * Runs the real operation. Call `report(fraction)` with a genuine 0..1
   * value as work actually completes. A phase whose real progress cannot be
   * measured should call `report(null)` or not call it at all — the
   * indicator then stays honestly indeterminate rather than showing an
   * invented number.
   */
  run(report: (fraction: number | null) => void): Promise<T>;
}

export type LongOperationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: unknown; blockedReentry: boolean };

/**
 * Runs a long operation with real progress reported at `options.host`, the
 * submitting control disabled for the duration, and a re-entry guard that
 * refuses a second concurrent run against the same control.
 */
export async function runLongOperation<T>(options: LongOperationOptions<T>): Promise<LongOperationResult<T>> {
  const { host, control, run } = options;

  if (running.has(control)) {
    return {
      ok: false,
      error: new Error('This operation is already running against that control.'),
      blockedReentry: true
    };
  }
  running.add(control);

  const wasDisabled = control.disabled;
  const wasTitle = control.title;
  const wasAriaDescription = control.getAttribute('aria-description');
  control.disabled = true;
  control.setAttribute('aria-busy', 'true');
  if (options.busyReason) {
    const reason = i18n.t(options.busyReason, options.busyReason);
    control.title = reason;
    control.setAttribute('aria-description', reason);
  }

  const surface = el('div', {
    className: 'md-progress-surface',
    attrs: { role: 'status', 'aria-live': 'polite' }
  });
  surface.append(
    el('p', { className: 'md-typescale-body-small md-progress-surface__label', text: i18n.t(options.label, options.label) })
  );
  const bar = components.linearProgress({ label: options.label });
  surface.append(bar.root);
  host.append(surface);

  try {
    const value = await run((fraction) => {
      if (fraction === null || Number.isNaN(fraction)) return;
      bar.set(Math.min(1, Math.max(0, fraction)));
    });
    return { ok: true, value };
  } catch (error) {
    return { ok: false, error, blockedReentry: false };
  } finally {
    surface.remove();
    running.delete(control);
    control.disabled = wasDisabled;
    control.removeAttribute('aria-busy');
    if (wasDisabled) {
      control.title = wasTitle;
      if (wasAriaDescription !== null) control.setAttribute('aria-description', wasAriaDescription);
    } else {
      control.removeAttribute('title');
      control.removeAttribute('aria-description');
    }
  }
}

/** True while `control` is mid-operation, for a caller wiring a second entry point (e.g. a keyboard submit) to the same run. */
export function isOperationRunning(control: HTMLButtonElement): boolean {
  return running.has(control);
}

/**
 * Mounts a real choice for an expensive optional phase, rather than a
 * feature deciding silently on the user's behalf. The returned handle is read
 * when the operation actually starts.
 */
export function mountOptionalPhaseToggle(host: HTMLElement, phase: OptionalPhase): { included(): boolean } {
  const checkbox = components.checkbox({
    label: phase.label,
    checked: phase.defaultOn ?? true
  });
  const note = el('p', {
    className: 'md-typescale-body-small md-progress-surface__skip-note',
    text: i18n.t(phase.skipDescription, phase.skipDescription)
  });
  host.append(checkbox.root, note);
  return { included: () => checkbox.get() };
}
