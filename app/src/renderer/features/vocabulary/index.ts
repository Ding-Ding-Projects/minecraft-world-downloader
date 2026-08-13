import './styles.css';

import { defineFeature } from '../../core/registry';
import type { AppContext, PaletteEntry } from '../../core/registry';
import { VOCABULARY_DOCS } from './docs';
import { VOCABULARY_ELEMENT_IDS, VOCABULARY_TAB_ID, mountVocabularyPanel, resetVocabularyPanelState } from './panel';
import { VOCABULARY_STRINGS } from './strings';
import { VOCABULARY_KEYS, VocabularyStore } from './store';

/**
 * Personal vocabulary: one local JSON file replacing this application's wording
 * with the user's own.
 *
 * The feature registers a destination, its documentation, its copy and its
 * commands. It deliberately registers NO settings section. The whole capability
 * has to behave as though it were not installed while the named study mode is
 * on, and a registered settings section stays on the settings surface whether
 * this feature wants it to or not — there is no way for a feature to withdraw
 * one. The upload control that belongs on the settings surface already lives in
 * the language section, which that surface omits correctly, and this
 * destination's own options are rendered here with the same explanation and
 * default-provenance line any settings row carries.
 *
 * Everything that CAN be withdrawn is withdrawn live: the destination leaves the
 * tab strip, its commands leave the command palette, the panel state is dropped,
 * and the language layer stops applying replacements. What cannot be withdrawn
 * at runtime is the documentation article, because the article index is built
 * once at registration; that residual gap is stated in the documentation rather
 * than left as an absence somebody has to notice.
 */

let store: VocabularyStore | null = null;
let paletteRelease: (() => void) | null = null;

function ensureStore(ctx: AppContext): VocabularyStore {
  if (!store) {
    store = new VocabularyStore(ctx);
    store.restore();
  }
  return store;
}

function paletteEntries(ctx: AppContext): PaletteEntry[] {
  const active = ensureStore(ctx);
  return [
    {
      id: 'vocabulary.command.open',
      title: 'vocabulary.palette.open',
      subtitle: 'Personal vocabulary',
      icon: 'world',
      kind: 'destination',
      keywords: ['vocabulary', 'words', 'replacements', 'wording', 'json', '詞彙'],
      teleport: { tabId: VOCABULARY_TAB_ID }
    },
    {
      id: 'vocabulary.command.choose',
      title: 'vocabulary.palette.choose',
      subtitle: 'Personal vocabulary',
      icon: 'upload',
      kind: 'command',
      keywords: ['vocabulary', 'load', 'upload', 'file', 'json', 'import'],
      run: () => void active.loadFromPicker()
    },
    {
      id: 'vocabulary.command.clear',
      title: 'vocabulary.palette.clear',
      subtitle: 'Personal vocabulary',
      icon: 'trash',
      kind: 'destination',
      keywords: ['vocabulary', 'clear', 'reset', 'restore', 'original wording'],
      // A destination rather than a command on purpose: clearing goes through the
      // destructive-action gate, and that gate anchors beside the control that
      // opened it. Teleporting to the real button is what gives it an anchor.
      teleport: { tabId: VOCABULARY_TAB_ID, elementId: VOCABULARY_ELEMENT_IDS.clear }
    },
    {
      id: 'vocabulary.command.template',
      title: 'vocabulary.palette.template',
      subtitle: 'Personal vocabulary',
      icon: 'save',
      kind: 'command',
      keywords: ['vocabulary', 'template', 'blank', 'schema', 'example'],
      run: () => void active.saveTemplate()
    },
    {
      id: 'vocabulary.command.preview',
      title: 'vocabulary.palette.preview',
      subtitle: 'Personal vocabulary',
      icon: 'visibility',
      kind: 'destination',
      keywords: ['vocabulary', 'preview', 'try', 'sample', 'test'],
      teleport: { tabId: VOCABULARY_TAB_ID, elementId: VOCABULARY_ELEMENT_IDS.preview }
    },
    {
      id: 'vocabulary.command.schema',
      title: 'vocabulary.palette.schema',
      subtitle: 'Personal vocabulary',
      icon: 'code',
      kind: 'destination',
      keywords: ['vocabulary', 'schema', 'format', 'json', 'version', 'limits'],
      teleport: { tabId: VOCABULARY_TAB_ID, elementId: VOCABULARY_ELEMENT_IDS.schema }
    },
    {
      id: 'vocabulary.command.showEntries',
      title: 'vocabulary.setting.showEntries',
      subtitle: 'Personal vocabulary · option',
      icon: 'tune',
      kind: 'destination',
      keywords: ['vocabulary', 'show', 'hide', 'list', 'privacy', 'option'],
      teleport: { tabId: VOCABULARY_TAB_ID, elementId: `setting-${VOCABULARY_KEYS.showEntries}` }
    },
    {
      id: 'vocabulary.command.pageSize',
      title: 'vocabulary.setting.pageSize',
      subtitle: 'Personal vocabulary · option',
      icon: 'tune',
      kind: 'destination',
      keywords: ['vocabulary', 'page', 'rows', 'size', 'option'],
      teleport: { tabId: VOCABULARY_TAB_ID, elementId: `setting-${VOCABULARY_KEYS.pageSize}` }
    },
    {
      id: 'vocabulary.command.sample',
      title: 'vocabulary.setting.sample',
      subtitle: 'Personal vocabulary · option',
      icon: 'tune',
      kind: 'destination',
      keywords: ['vocabulary', 'sample', 'preview', 'text', 'option'],
      teleport: { tabId: VOCABULARY_TAB_ID, elementId: `setting-${VOCABULARY_KEYS.sample}` }
    }
  ];
}

/**
 * Adds or withdraws the whole capability, live, without a restart.
 *
 * Withdrawing means omitting, not disabling: the destination leaves the strip
 * and the commands leave the palette. The user's file and their suppression
 * choices are kept untouched and return when the mode is turned off — that is
 * what makes it a user-experience lock rather than a deletion.
 */
function applyAvailability(ctx: AppContext): void {
  const hidden = ctx.i18n.schoolModeActive();

  if (hidden) {
    if (paletteRelease) {
      paletteRelease();
      paletteRelease = null;
    }
    const present = ctx.tabs.list().some((record) => record.id === VOCABULARY_TAB_ID);
    if (present) {
      ctx.settings.set(VOCABULARY_KEYS.schoolHiddenTab, true);
      resetVocabularyPanelState();
      ctx.tabs.close(VOCABULARY_TAB_ID);
    }
    return;
  }

  if (!paletteRelease) paletteRelease = ctx.palette.add(paletteEntries(ctx));

  if (ctx.settings.get<boolean>(VOCABULARY_KEYS.schoolHiddenTab, false) === true) {
    ctx.settings.set(VOCABULARY_KEYS.schoolHiddenTab, false);
    // Opening is the only public route back out of the closed set. The active
    // destination is restored straight afterwards so the user is not moved off
    // whatever they were looking at.
    const previous = ctx.tabs.activeId();
    ctx.tabs.open(VOCABULARY_TAB_ID);
    if (previous && previous !== VOCABULARY_TAB_ID) ctx.tabs.open(previous);
  }
}

export default defineFeature({
  id: 'vocabulary',
  name: 'Personal vocabulary',
  description:
    'Replaces this application\'s wording with your own, from one local JSON file. Validated completely before anything is applied, cached locally, and never sent anywhere.',
  strings: VOCABULARY_STRINGS,
  docs: VOCABULARY_DOCS,
  tabs: [
    {
      id: VOCABULARY_TAB_ID,
      title: 'vocabulary.tab.title',
      icon: 'world',
      group: 'group.personalisation',
      order: 210,
      mount(host, ctx) {
        mountVocabularyPanel(host, ctx, ensureStore(ctx));
      }
    }
  ],
  init(ctx) {
    ensureStore(ctx);
    applyAvailability(ctx);
    // The named study mode, the language mode and the humour levels all arrive
    // through this one channel, and it fires without a restart.
    ctx.i18n.onChange(() => {
      store?.refresh();
      applyAvailability(ctx);
    });
  }
});
