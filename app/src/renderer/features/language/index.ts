import './styles.css';

import type { AppContext, FeatureModule, PaletteEntry, SettingsSection } from '../../core/registry';
import { openDisclosure, showFirstRunDisclosure } from './disclosure';
import { LANGUAGE_DOCS } from './docs';
import { languageSettingsSection } from './settings';
import { LANGUAGE_STRINGS } from './strings';
import { mountLanguageTab } from './tab';
import {
  MIRROR_IDS,
  SCHOOL_HID_TAB_ID,
  SECTION_ID,
  TAB_ID,
  installMirrorSync,
  resetVoiceSettings
} from './state';

/**
 * Language modes, the two humour levels, the emoji switch and the preview that
 * makes all three checkable before you commit to them.
 *
 * The section and the palette entries are held in arrays this module owns, and
 * the registry reads them on every query. That is what makes the study mode's
 * "behave as though it were not installed" achievable honestly: the capability
 * is withdrawn from the surfaces rather than greyed out on them, and restored
 * with the user's own choices intact when the mode is switched off.
 */

const settingsSections: SettingsSection[] = [languageSettingsSection()];
const paletteEntries: PaletteEntry[] = [
  {
    id: 'language.destination.preview',
    title: 'language.palette.destination',
    subtitle: 'language.tab.subtitle',
    icon: 'world',
    kind: 'destination',
    keywords: ['language', 'cantonese', 'bilingual', 'humour', 'funny', 'preview', 'emoji', '語言'],
    teleport: { tabId: TAB_ID, elementId: 'language-matrix' }
  },
  {
    id: 'language.command.disclosure',
    title: 'language.disclosure.show',
    subtitle: 'language.disclosure.title',
    icon: 'info',
    kind: 'command',
    keywords: ['disclosure', 'humour', 'errors', 'warnings', 'consent'],
    run: () => {
      if (!context) return;
      openDisclosure(context);
    }
  },
  {
    id: 'language.command.variants',
    title: 'language.table.title',
    subtitle: 'language.table.description',
    icon: 'sort',
    kind: 'destination',
    keywords: ['variants', 'samples', 'levels', 'compare', 'export'],
    teleport: { tabId: TAB_ID, elementId: 'language-variants' }
  },
  {
    id: 'language.command.reset',
    title: 'language.reset.label',
    subtitle: 'language.reset.description',
    icon: 'refresh',
    kind: 'command',
    keywords: ['reset', 'default', 'language', 'humour', 'emoji'],
    run: async () => {
      const ctx = context;
      if (!ctx) return;
      const approved = await ctx.components.dialog({
        title: ctx.t('language.reset.confirm', 'Reset language mode, both humour levels and the emoji switch?'),
        body: ctx.t(
          'language.reset.confirmBody',
          'The language mode returns to English, both humour levels return to 3, and the emoji switch returns to on. The change is written to local history, so the values you had now can be read back from there.'
        ),
        confirmLabel: ctx.t('core.action.reset', 'Reset'),
        icon: 'refresh'
      });
      if (!approved) return;
      resetVoiceSettings(ctx);
      void ctx.history.record('Reset the language and voice settings', 'language', {
        ids: Object.values(MIRROR_IDS)
      });
      ctx.notify.success(
        ctx.t(
          'language.reset.done',
          'Language mode, both humour levels and the emoji switch are back to their shipped values.'
        )
      );
    }
  }
];

/** Held so a palette entry, which is built before boot, can reach the context. */
let context: AppContext | null = null;

/* ------------------------------------------------------------------ */
/* Study-mode withdrawal and restoration                               */
/* ------------------------------------------------------------------ */

const savedSections = [...settingsSections];
const savedPalette = [...paletteEntries];

const TABS_CLOSED_KEY = 'tabs.closed';

function withdraw(ctx: AppContext): void {
  if (settingsSections.length > 0) settingsSections.length = 0;
  if (paletteEntries.length > 0) paletteEntries.length = 0;

  const stillOpen = ctx.tabs.list().some((record) => record.id === TAB_ID);
  if (stillOpen) {
    // Remembered, so the destination is restored only if this feature was the
    // thing that closed it — never a destination the user closed themselves.
    ctx.settings.set(SCHOOL_HID_TAB_ID, true);
    ctx.tabs.close(TAB_ID);
    void ctx.history.record('Withdrew the language surfaces for the study mode', 'language', {
      section: SECTION_ID,
      tab: TAB_ID
    });
  }
}

function restore(ctx: AppContext): void {
  if (settingsSections.length === 0) settingsSections.push(...savedSections);
  if (paletteEntries.length === 0) paletteEntries.push(...savedPalette);

  if (ctx.settings.get<boolean>(SCHOOL_HID_TAB_ID, false) !== true) return;
  ctx.settings.set(SCHOOL_HID_TAB_ID, false);

  // Taking the destination out of the closed set restores it to the strip
  // without making it active, so leaving the study mode does not yank somebody
  // away from whatever they were looking at. The strip repaints on the same
  // language change that brought us here.
  const closed = ctx.settings.get<string[]>(TABS_CLOSED_KEY, []);
  if (Array.isArray(closed) && closed.includes(TAB_ID)) {
    ctx.settings.set(
      TABS_CLOSED_KEY,
      closed.filter((id) => id !== TAB_ID)
    );
  }
  void ctx.history.record('Restored the language surfaces after the study mode', 'language', {
    section: SECTION_ID,
    tab: TAB_ID
  });
}

/* ------------------------------------------------------------------ */
/* The module                                                          */
/* ------------------------------------------------------------------ */

const feature: FeatureModule = {
  id: 'language',
  name: 'Language and voice',
  description:
    'The language mode, one humour level per language with a live preview of each, the emoji switch, the first-run disclosure, and the preview matrix that shows every mode at both extremes at any width.',
  strings: LANGUAGE_STRINGS,
  settings: settingsSections,
  palette: paletteEntries,
  docs: LANGUAGE_DOCS,
  tabs: [
    {
      id: TAB_ID,
      title: 'language.tab.title',
      icon: 'world',
      group: 'group.personalisation',
      order: 120,
      mount: (host, ctx) => {
        if (ctx.i18n.schoolModeActive()) {
          // Reached only through a stale route; the destination is not offered
          // while that mode is on. Closing it is the honest answer.
          window.requestAnimationFrame(() => ctx.tabs.close(TAB_ID));
          return;
        }
        mountLanguageTab(host, ctx);
      }
    }
  ],
  init(ctx: AppContext) {
    context = ctx;

    const stopMirror = installMirrorSync(ctx);

    let schoolWasActive = ctx.i18n.schoolModeActive();
    if (schoolWasActive) withdraw(ctx);

    const stopI18n = ctx.i18n.onChange((snapshot) => {
      if (snapshot.schoolMode === schoolWasActive) return;
      schoolWasActive = snapshot.schoolMode;
      if (snapshot.schoolMode) withdraw(ctx);
      else restore(ctx);
    });

    // Nothing here is torn down during a normal session; the handles are kept
    // so a future teardown route has something honest to call.
    window.addEventListener('beforeunload', () => {
      stopMirror();
      stopI18n();
    });

    // The first-run disclosure waits for the window to settle so it never
    // competes with the shell's own startup work, and it is non-blocking, so it
    // never gates anything.
    window.setTimeout(() => showFirstRunDisclosure(ctx), 1200);
  }
};

export default feature;
