/**
 * The bundled emoji shortcode map.
 *
 * Provider-authored text — release notes, issue bodies, commit messages —
 * routinely carries `:warning:` and `:rocket:` shortcodes, because the forge
 * that hosted it resolved them. Printed literally they read as noise; resolved,
 * they read as the author intended.
 *
 * The map is compiled in. Nothing here fetches an image, a sprite sheet or a
 * font: each value is the Unicode character itself, which every platform this
 * application runs on already knows how to draw.
 *
 * A shortcode that is not in this map is left exactly as written. Guessing at an
 * unknown name would silently change somebody else's words.
 */

export const EMOJI: Readonly<Record<string, string>> = Object.freeze({
  warning: '⚠️',
  rocket: '🚀',
  bug: '🐛',
  sparkles: '✨',
  tada: '🎉',
  fire: '🔥',
  boom: '💥',
  wrench: '🔧',
  hammer: '🔨',
  lock: '🔒',
  unlock: '🔓',
  key: '🔑',
  book: '📖',
  books: '📚',
  memo: '📝',
  package: '📦',
  gear: '⚙️',
  bulb: '💡',
  zap: '⚡',
  star: '⭐',
  heart: '❤️',
  eyes: '👀',
  point_right: '👉',
  white_check_mark: '✅',
  heavy_check_mark: '✔️',
  x: '❌',
  question: '❓',
  exclamation: '❗',
  information_source: 'ℹ️',
  no_entry: '⛔',
  construction: '🚧',
  recycle: '♻️',
  arrow_up: '⬆️',
  arrow_down: '⬇️',
  arrow_right: '➡️',
  arrow_left: '⬅️',
  clock: '🕐',
  hourglass: '⏳',
  mag: '🔍',
  computer: '💻',
  floppy_disk: '💾',
  globe_with_meridians: '🌐',
  art: '🎨',
  broom: '🧹',
  test_tube: '🧪',
  shield: '🛡️',
  label: '🏷️',
  pushpin: '📌',
  bookmark: '🔖',
  link: '🔗',
  scroll: '📜',
  bar_chart: '📊',
  chart_with_upwards_trend: '📈',
  chart_with_downwards_trend: '📉'
});

const SHORTCODE = /:([a-z0-9_+-]+):/g;

/**
 * Replaces known `:shortcode:` sequences with their character.
 *
 * Runs on the Markdown source before it is parsed, so a shortcode inside a code
 * fence would also be replaced — which is why fenced regions are skipped here
 * rather than in the parser. A code sample that prints `:warning:` means the
 * literal text, and rewriting it would be changing the sample.
 */
export function resolveShortcodes(source: string): string {
  if (!source.includes(':')) return source;
  const lines = source.split('\n');
  let insideFence = false;
  return lines
    .map((line) => {
      if (/^\s*(```|~~~)/.test(line)) {
        insideFence = !insideFence;
        return line;
      }
      if (insideFence) return line;
      return replaceOutsideInlineCode(line);
    })
    .join('\n');
}

/** Rewrites a single line, leaving `` `inline code` `` spans untouched. */
function replaceOutsideInlineCode(line: string): string {
  const parts = line.split('`');
  for (let index = 0; index < parts.length; index += 2) {
    SHORTCODE.lastIndex = 0;
    parts[index] = parts[index].replace(SHORTCODE, (whole, name: string) => EMOJI[name] ?? whole);
  }
  return parts.join('`');
}
