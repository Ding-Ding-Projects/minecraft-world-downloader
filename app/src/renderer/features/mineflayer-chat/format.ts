/**
 * Turning the game's own text formatting into real styling.
 *
 * A chat line arrives in one of two shapes and neither of them is plain text.
 * Older servers send a string carrying section-sign codes (`§c` for red, `§l`
 * for bold, `§r` to reset). Newer ones send a component tree whose nodes carry
 * `color`, `bold`, `italic`, `underlined`, `strikethrough` and `obfuscated`,
 * with children inheriting from their parent. Printing either one verbatim
 * shows the reader a wall of section signs or a wall of JSON.
 *
 * Both are reduced here to a list of styled runs, which the renderer draws with
 * real styling. The text content of every run is exactly the text the server
 * sent: this module changes how a message looks, never what it says.
 *
 * The sixteen vanilla colours are data, not chrome. They identify who is
 * speaking and what kind of line it is, so they do not follow the user's seed
 * colour — a red death message is red because the server said red. They are
 * declared as custom properties in this feature's own stylesheet so they remain
 * reachable from the per-element appearance editor like anything else.
 */

import { el } from '../../core/a11y';
import type { FormattedRun } from './session';

/** The section sign the game uses to introduce a formatting code. */
const SECTION = '§';

/** The vanilla colour codes, in the order the game numbers them. */
const LEGACY_COLORS: Record<string, string> = {
  '0': 'black',
  '1': 'dark_blue',
  '2': 'dark_green',
  '3': 'dark_aqua',
  '4': 'dark_red',
  '5': 'dark_purple',
  '6': 'gold',
  '7': 'gray',
  '8': 'dark_gray',
  '9': 'blue',
  a: 'green',
  b: 'aqua',
  c: 'red',
  d: 'light_purple',
  e: 'yellow',
  f: 'white'
};

/** Every colour name the game recognises, for the stylesheet's class names. */
export const VANILLA_COLORS: string[] = [
  'black',
  'dark_blue',
  'dark_green',
  'dark_aqua',
  'dark_red',
  'dark_purple',
  'gold',
  'gray',
  'dark_gray',
  'blue',
  'green',
  'aqua',
  'red',
  'light_purple',
  'yellow',
  'white'
];

const LEGACY_STYLES: Record<string, keyof Omit<FormattedRun, 'text' | 'color'>> = {
  k: 'obfuscated',
  l: 'bold',
  m: 'strikethrough',
  n: 'underlined',
  o: 'italic'
};

function emptyRun(text: string): FormattedRun {
  return {
    text,
    color: null,
    bold: false,
    italic: false,
    underlined: false,
    strikethrough: false,
    obfuscated: false
  };
}

/* ================================================================== */
/* Legacy section-sign strings                                         */
/* ================================================================== */

/**
 * Splits a section-sign string into styled runs.
 *
 * A colour code resets every style, which is the game's own rule and the one
 * most easily got wrong: `§lHello §cworld` renders "world" red and *not* bold,
 * because the colour cleared the bold. `§r` clears everything.
 */
export function parseLegacy(input: string, inherited?: FormattedRun): FormattedRun[] {
  const base = inherited ? { ...inherited, text: '' } : emptyRun('');
  const runs: FormattedRun[] = [];
  let current = { ...base };

  const push = (): void => {
    if (current.text.length > 0) runs.push({ ...current });
    current = { ...current, text: '' };
  };

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (character !== SECTION || index + 1 >= input.length) {
      current.text += character;
      continue;
    }
    const code = input[index + 1].toLowerCase();
    index += 1;

    if (code === 'r') {
      push();
      current = emptyRun('');
      continue;
    }
    const color = LEGACY_COLORS[code];
    if (color) {
      push();
      current = emptyRun('');
      current.color = color;
      continue;
    }
    const style = LEGACY_STYLES[code];
    if (style) {
      push();
      current[style] = true;
      continue;
    }
    // An unrecognised code is not text the server meant to show. Dropping the
    // pair is what the game itself does; keeping it would put a stray section
    // sign in the middle of a sentence.
  }

  if (current.text.length > 0) runs.push({ ...current });
  return runs;
}

/** Removes every formatting code, leaving exactly the words. */
export function stripLegacy(input: string): string {
  return parseLegacy(input)
    .map((run) => run.text)
    .join('');
}

/* ================================================================== */
/* Component trees                                                     */
/* ================================================================== */

interface ComponentNode {
  text?: unknown;
  extra?: unknown;
  color?: unknown;
  bold?: unknown;
  italic?: unknown;
  underlined?: unknown;
  strikethrough?: unknown;
  obfuscated?: unknown;
  translate?: unknown;
  with?: unknown;
  /** `prismarine-chat` exposes its own children under this name. */
  json?: unknown;
}

function asBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
}

function inheritedRun(parent: FormattedRun, node: ComponentNode): FormattedRun {
  const run: FormattedRun = { ...parent, text: '' };
  if (typeof node.color === 'string' && node.color.length > 0) run.color = node.color;
  const bold = asBoolean(node.bold);
  if (bold !== null) run.bold = bold;
  const italic = asBoolean(node.italic);
  if (italic !== null) run.italic = italic;
  const underlined = asBoolean(node.underlined);
  if (underlined !== null) run.underlined = underlined;
  const strikethrough = asBoolean(node.strikethrough);
  if (strikethrough !== null) run.strikethrough = strikethrough;
  const obfuscated = asBoolean(node.obfuscated);
  if (obfuscated !== null) run.obfuscated = obfuscated;
  return run;
}

/**
 * Walks a component tree into styled runs.
 *
 * Depth is bounded and the total run count is bounded, because a component tree
 * arrives from a remote server and a deeply nested or enormously wide one would
 * otherwise be able to lock the window up while it is drawn.
 */
const MAX_DEPTH = 24;
const MAX_RUNS = 512;

function walk(value: unknown, inherited: FormattedRun, depth: number, out: FormattedRun[]): void {
  if (out.length >= MAX_RUNS || depth > MAX_DEPTH) return;

  if (typeof value === 'string') {
    if (value.length === 0) return;
    // A string inside a component tree can still carry legacy codes, because
    // plenty of servers build their components by concatenating them.
    if (value.includes(SECTION)) {
      // The inherited style seeds the parse, so text before the first code
      // keeps the parent's styling. A code inside the string then overrides it
      // exactly as the game does — and `§r` clears back to nothing, not back to
      // the parent, which is the game's own rule.
      for (const piece of parseLegacy(value, inherited)) {
        out.push(piece);
        if (out.length >= MAX_RUNS) return;
      }
      return;
    }
    out.push({ ...inherited, text: value });
    return;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    out.push({ ...inherited, text: String(value) });
    return;
  }

  if (Array.isArray(value)) {
    for (const child of value) {
      walk(child, inherited, depth + 1, out);
      if (out.length >= MAX_RUNS) return;
    }
    return;
  }

  if (value === null || typeof value !== 'object') return;

  const node = value as ComponentNode;
  const run = inheritedRun(inherited, node);

  if (typeof node.text === 'string' && node.text.length > 0) {
    walk(node.text, run, depth + 1, out);
  } else if (typeof node.translate === 'string') {
    // A translate key names a client-side string this application does not
    // ship. The key is shown with its arguments rather than being dropped, so
    // the reader still learns which message arrived and what it was about.
    const args: string[] = [];
    if (Array.isArray(node.with)) {
      for (const argument of node.with) {
        const collected: FormattedRun[] = [];
        walk(argument, run, depth + 1, collected);
        args.push(collected.map((piece) => piece.text).join(''));
      }
    }
    const rendered = args.length > 0 ? `${node.translate} [${args.join(', ')}]` : node.translate;
    out.push({ ...run, text: rendered });
  }

  const children = node.extra ?? node.json;
  if (children !== undefined) walk(children, run, depth + 1, out);
}

/** Reduces any chat component this application may be handed to styled runs. */
export function parseComponent(value: unknown): FormattedRun[] {
  const out: FormattedRun[] = [];
  walk(value, emptyRun(''), 0, out);
  return out.filter((run) => run.text.length > 0);
}

/**
 * Chooses the best available representation of one message.
 *
 * The component tree is preferred because it carries the server's own colours
 * exactly. The legacy string is the fallback, and it is also what an older
 * server sends in the first place.
 */
export function runsFor(component: unknown, raw: string): FormattedRun[] {
  if (component !== null && component !== undefined) {
    const parsed = parseComponent(component);
    if (parsed.length > 0) return parsed;
  }
  if (raw.length === 0) return [];
  return parseLegacy(raw);
}

/* ================================================================== */
/* Rendering                                                           */
/* ================================================================== */

/** A `#rrggbb` colour is used literally; a name becomes a class. */
function applyColor(node: HTMLElement, color: string | null): void {
  if (!color) return;
  if (/^#[0-9a-f]{6}$/i.test(color)) {
    node.style.color = color;
    return;
  }
  const normalized = color.toLowerCase();
  if (VANILLA_COLORS.includes(normalized)) {
    node.classList.add(`mineflayer-chat-color-${normalized.replace(/_/g, '-')}`);
  }
}

/**
 * Draws styled runs as real DOM.
 *
 * `reducedMotion` matters for obfuscated text: the game scrambles it
 * continuously, and an animation nobody asked for is exactly what the reduced
 * motion preference exists to stop. The element's text content is the real text
 * either way, so copying, exporting and a screen reader all get the words the
 * server sent rather than the scramble.
 */
export function renderRuns(runs: FormattedRun[], reducedMotion: boolean): DocumentFragment {
  const fragment = document.createDocumentFragment();
  for (const run of runs) {
    const span = el('span', { className: 'mineflayer-chat-run', text: run.text });
    applyColor(span, run.color);
    if (run.bold) span.classList.add('mineflayer-chat-bold');
    if (run.italic) span.classList.add('mineflayer-chat-italic');
    if (run.underlined) span.classList.add('mineflayer-chat-underline');
    if (run.strikethrough) span.classList.add('mineflayer-chat-strike');
    if (run.obfuscated) {
      span.classList.add('mineflayer-chat-obfuscated');
      if (reducedMotion) span.classList.add('mineflayer-chat-obfuscated-still');
    }
    fragment.append(span);
  }
  return fragment;
}

/** Convenience for the many places that hold a raw string and want it drawn. */
export function renderFormatted(raw: string, reducedMotion: boolean): DocumentFragment {
  return renderRuns(parseLegacy(raw), reducedMotion);
}

/** The plain words of any representation, for search, export and matching. */
export function plainTextOf(component: unknown, raw: string): string {
  return runsFor(component, raw)
    .map((run) => run.text)
    .join('');
}
