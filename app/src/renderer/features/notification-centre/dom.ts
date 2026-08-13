/**
 * Small DOM helpers owned by this feature.
 *
 * They are deliberately local rather than imported from the core: a feature
 * module reaches every service through its `AppContext`, and duplicating a
 * fifteen-line element helper is cheaper than a runtime import that couples one
 * feature directory to a core file it does not otherwise need.
 */

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options: {
    className?: string;
    text?: string;
    attrs?: Record<string, string>;
    children?: Array<Node | null | undefined>;
  } = {}
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text !== undefined) node.textContent = options.text;
  if (options.attrs) {
    for (const [key, value] of Object.entries(options.attrs)) node.setAttribute(key, value);
  }
  if (options.children) {
    for (const child of options.children) if (child) node.append(child);
  }
  return node;
}

/** Joins a directory and a file name with the separator this platform uses. */
export function joinPath(directory: string, ...parts: string[]): string {
  const separator = directory.includes('\\') && !directory.includes('/') ? '\\' : '/';
  const trimmed = directory.replace(/[\\/]+$/, '');
  return [trimmed, ...parts].join(separator);
}

/**
 * A timestamp a human can read, in the machine's own locale.
 *
 * The ISO value is kept alongside it everywhere it is shown, because a locale
 * string is ambiguous between machines and the exported record must not be.
 */
export function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
}

/** "4 minutes ago", for the row meta line. Never replaces the exact timestamp. */
export function relativeTime(iso: string, now = Date.now()): string {
  const date = new Date(iso).getTime();
  if (Number.isNaN(date)) return '';
  const seconds = Math.round((date - now) / 1000);
  const absolute = Math.abs(seconds);
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  if (absolute < 60) return formatter.format(Math.round(seconds), 'second');
  if (absolute < 3600) return formatter.format(Math.round(seconds / 60), 'minute');
  if (absolute < 86400) return formatter.format(Math.round(seconds / 3600), 'hour');
  return formatter.format(Math.round(seconds / 86400), 'day');
}

/** Collapses a long body to a readable preview without losing the original. */
export function truncate(value: string, limit: number): { text: string; truncated: boolean } {
  if (value.length <= limit) return { text: value, truncated: false };
  return { text: `${value.slice(0, limit).trimEnd()}…`, truncated: true };
}

export interface Debounced {
  /** Requests a run after the delay, restarting the delay if already pending. */
  schedule(): void;
  /** Runs immediately if a run is pending, and cancels the timer either way. */
  flush(): void;
  /** Cancels a pending run without performing it. */
  cancel(): void;
}

export function debounce(fn: () => void, delayMs: number): Debounced {
  let timer: number | null = null;
  let pending = false;

  const run = (): void => {
    timer = null;
    pending = false;
    fn();
  };

  return {
    schedule(): void {
      pending = true;
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(run, delayMs);
    },
    flush(): void {
      if (timer !== null) {
        window.clearTimeout(timer);
        timer = null;
      }
      if (pending) run();
    },
    cancel(): void {
      if (timer !== null) window.clearTimeout(timer);
      timer = null;
      pending = false;
    }
  };
}

export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}
