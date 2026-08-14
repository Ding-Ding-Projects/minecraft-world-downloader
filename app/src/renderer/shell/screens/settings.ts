import type { TabContext } from '../../core/types';
import { mountSettingsSurface } from '../../features/settings/surface';
import type { ScreenDefinition } from '../types';

/**
 * The Settings destination (design lines 920-947).
 *
 * The design shows a rounded search field ("Search every setting on every
 * tab") over a pill `role="tablist"`, one tab per settings section, and rows
 * that render each control's real live widget beside its label, its
 * explanation and — via `settings-ui.ts`'s provenance line, already part of
 * every row — whether the value is the shipped default or something the user
 * (or an import, or a schedule) actually set.
 *
 * That is not rebuilt here. `features/settings/surface.ts`'s
 * `mountSettingsSurface` already IS this: real browser-style tabs per
 * section (`createNestedTabs`, carrying the full tab contract — overflow,
 * reorder, pin, group, the four discovery searches), its own search bar
 * wired to the shared regex builder that searches every label, description,
 * id, keyword AND current value, and rows built by `rows.ts` that render the
 * real control inline plus its explanation and provenance rather than a
 * printout of either. Rebuilding that here to shave off its top app bar would
 * be exactly the second copy of a button the house rules warn against — this
 * screen mounts the real thing.
 *
 * `mountSettingsSurface` takes a `TabContext` (it was written for the old
 * tab-strip, and predates this screen). A `ScreenDefinition` only gets a
 * plain `AppContext`, so this mount builds the same minimal shim
 * `core/tabs.ts` itself uses to open a tab: the `AppContext` plus a stable id
 * and an `onDispose` collector, so the surface's own teardown (it calls
 * `ctx.onDispose(() => surface.destroy())` internally) runs when this screen
 * is replaced by another one rather than leaking its i18n/settings
 * subscriptions.
 *
 * Known, accepted gap: the mounted surface renders its own internal
 * `topAppBar` ("Settings" + the same subtitle + Select/Export/Import/Reset
 * actions) at the top of its content, so the screen shows that heading a
 * second time directly under the shell's own screen header (which renders
 * this same `title`/`subtitle` per the shared shell chrome). Suppressing the
 * surface's internal bar would mean editing `features/settings/surface.ts`,
 * which is not this lane's file — flagged here rather than silently
 * duplicated without comment.
 */

const SCREEN_ID = 'settings';

const screen: ScreenDefinition = {
  id: SCREEN_ID,
  title: 'settings.tab.title',
  subtitle: 'settings.tab.subtitle',
  icon: 'settings',
  rail: 6,
  mount(host, ctx) {
    const disposers: Array<() => void> = [];
    const tabContext: TabContext = {
      ...ctx,
      tabId: SCREEN_ID,
      onDispose: (fn) => disposers.push(fn)
    };

    mountSettingsSurface(host, tabContext);

    return () => {
      for (const dispose of disposers) {
        try {
          dispose();
        } catch (error) {
          console.error('Disposing the settings screen threw:', error);
        }
      }
    };
  }
};

export default screen;
