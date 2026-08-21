import type { Catalogue, TranslationEntry } from '../core/registry';

/**
 * Every string the shell's own chrome renders as DATA rather than through an
 * inline `ctx.t(key, 'English fallback')` call.
 *
 * The distinction matters and it is the whole reason this file exists. A call
 * site that passes a fallback degrades gracefully when nothing is registered:
 * the English reads correctly and only the humour ladders are missing. A key
 * handed to a component as data -- a `ScreenDefinition`'s `title`, a select's
 * `label`, a link's text -- has no fallback to fall back to, so the component
 * renders `i18n.t(key, key)` and the user is shown the raw key. That is what
 * put `shell.screen.downloader.title` in the title bar, the navigation rail and
 * the status bar of a shipped build, and `shell.downloader.openFullLog` on a
 * link beside it.
 *
 * Nothing registered these because the shell, unlike every feature, has no
 * module of its own to hang a `strings` property off: features are discovered
 * and their catalogues registered in the boot sequence, and the shell is
 * mounted directly. `registerShellStrings()` below is the shell's equivalent,
 * called from the boot sequence for exactly the same reason.
 *
 * Every other key the shell renders resolves through the feature that owns it
 * (`downloader.*`, `settings.*`, `map.*`, and so on) and is deliberately absent
 * here -- duplicating one would create a second authority for the same string,
 * and the two would drift.
 */

/**
 * Writes a five-rung humour ladder from three distinct voices: professional,
 * relaxed and playful. Rungs 1 and 2 share the professional wording and rungs 4
 * and 5 share the playful one, matching the integration contract's own shape.
 *
 * Humour styles the voice and never the facts: which screen, which folder,
 * which filter, read the same at level 1 and at level 5.
 */
function t3(en: [string, string, string], yue: [string, string, string]): TranslationEntry {
  return {
    en: [en[0], en[0], en[1], en[2], en[2]],
    yue: [yue[0], yue[0], yue[1], yue[2], yue[2]]
  };
}

export const SHELL_STRINGS: Catalogue = {
  /* ---------------- the downloader destination ---------------- */
  'shell.screen.downloader.title': t3(
    ['Capture', 'Capture', 'Capture'],
    ['擷取', '擷取', '擷取']
  ),
  'shell.screen.downloader.subtitle': t3(
    [
      'Run the downloader and save the world you walk through.',
      'Run the downloader and save the world you walk through.',
      'Set the downloader going and keep every chunk you walk past.'
    ],
    [
      '行個下載器，你行過嘅世界就儲落嚟。',
      '行個下載器，你行過嘅世界就儲落嚟。',
      '開住個下載器，你行過邊佢就袋起邊。'
    ]
  ),
  'shell.downloader.openFullLog': t3(
    ['Open the full log', 'Open the full log', 'See the whole log'],
    ['打開完整記錄', '打開完整記錄', '睇晒成個記錄']
  ),
  'shell.downloader.overviewMap.open': t3(
    ['Open the map', 'Open the map', 'Go look at the map']
    ,
    ['打開地圖', '打開地圖', '去睇下張地圖']
  ),

  /* ---------------- the launch-options filter ---------------- */
  'shell.downloader.options.filter': t3(
    ['Show', 'Show', 'Show me']
    ,
    ['顯示', '顯示', '俾我睇']
  ),
  'shell.downloader.options.filter.all': t3(
    ['All options', 'All options', 'Every option'],
    ['全部選項', '全部選項', '所有選項']
  ),
  'shell.downloader.options.filter.changed': t3(
    ['Changed only', 'Changed only', 'Only what I changed'],
    ['只睇改咗嘅', '只睇改咗嘅', '淨係我改過嗰啲']
  ),

  /* ---------------- the navigation drawer ---------------- */
  'shell.drawer.search': t3(
    ['Search destinations', 'Search destinations', 'Find a destination'],
    ['搜尋目的地', '搜尋目的地', '搵個目的地']
  ),
  'shell.drawer.search.placeholder': t3(
    ['Type to filter', 'Type to filter', 'Start typing'],
    ['打字篩選', '打字篩選', '打字啦']
  )
};
