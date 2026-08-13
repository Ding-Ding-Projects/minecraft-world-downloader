/**
 * The two DOM helpers this feature needs.
 *
 * They are local on purpose: a feature module reaches the application through
 * its `AppContext` and its type imports, and nothing else. Duplicating twenty
 * lines is a smaller cost than a runtime import that ties this directory to a
 * core file it does not own.
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

/** A monotonic id, so a label can point at the control it names. */
export function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}`;
}

/** Removes every child without leaving detached listeners behind. */
export function clear(node: HTMLElement): void {
  node.textContent = '';
}
