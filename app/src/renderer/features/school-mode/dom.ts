import type { AppContext } from '../../core/registry';

/**
 * Small DOM and copy helpers, kept inside this feature so nothing outside it is
 * touched. They exist to make the rest of the module read as what it is doing
 * rather than as element plumbing.
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

let counter = 0;

export function uniqueId(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}`;
}

/**
 * A bilingual line: the primary prominent, the secondary compact beneath it.
 *
 * Bilingual mode is where labels are longest, so the secondary is a separate
 * element with its own type scale rather than the same string twice as long.
 */
export function bilingual(
  ctx: AppContext,
  key: string,
  fallbackEn: string,
  values?: Record<string, string | number>,
  className = 'md-typescale-body-medium'
): HTMLElement {
  const pair = ctx.i18n.pair(key, fallbackEn, values ? { values } : undefined);
  const wrap = el('div', { className: 'school-mode__line' });
  wrap.append(el('span', { className, text: pair.primary }));
  if (pair.secondary) {
    wrap.append(el('span', { className: 'school-mode__secondary', text: pair.secondary }));
  }
  return wrap;
}

/**
 * Copy for a dialog or message box, with the one decorative emoji the emoji
 * switch allows.
 *
 * The switch is honoured here rather than assumed, and the mode suppresses the
 * decoration entirely, exactly as the shared decoration rule does elsewhere.
 * Emoji never reaches a button, a field label or an accessible name — those go
 * through `ctx.t` directly.
 */
export function dialogCopy(ctx: AppContext, text: string, emoji: string): string {
  const snapshot = ctx.i18n.snapshot();
  if (snapshot.schoolMode || !snapshot.emojiInDialogs) return text;
  return `${emoji} ${text}`;
}

/** A local ISO timestamp rendered for a person rather than for a parser. */
export function formatTime(iso: string): string {
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return iso;
  const date = new Date(parsed);
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}:${pad(date.getSeconds())}`;
}
