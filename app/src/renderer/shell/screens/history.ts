import './history.css';

import type { AppContext, TabContext } from '../../core/registry';
import type { ScreenDefinition } from '../types';

/**
 * The "History" destination (design lines 909-919, elevated but not railed
 * per `shell/types.ts`'s own docstring).
 *
 * The design's own mockup for this screen is a single search bar plus a flat
 * list of revert rows. `features/history/panel.ts` already implements
 * everything this destination is asked for and more: a date-range picker
 * (`createDateRange`, with typed and calendar entry kept in step), a filter
 * by every real action the local history actually holds — each with its own
 * count, several selectable at once — a search bar carrying its own anchored
 * regex builder, and restore (per row and in bulk, itself recorded as a new
 * entry so a restore can be undone). Reimplementing a second, thinner copy
 * of that here would both violate "call it, do not rewrite the renderer" and
 * risk quietly disagreeing with the real Version History tab about what a
 * restore does. So this screen mounts that tab's own registered
 * `TabDefinition` directly — the same technique `core/tabs.ts` uses to open
 * an ordinary tab, and the technique the shared brief describes the "Other"
 * destination using to mount whichever registry tab is selected.
 */

const HISTORY_TAB_ID = 'history.panel';

/**
 * The one piece of text this screen builds directly rather than delegating to
 * `features/history/panel.ts` — the honest fallback shown when that tab has
 * not registered. Kept as its own function so a live language/humour change
 * can rebuild it with fresh copy rather than leaving it stuck at whatever was
 * current the moment this rare branch first rendered.
 */
function buildMissingState(ctx: AppContext): HTMLElement {
  return ctx.components.emptyState({
    title: ctx.t('shell.screen.history.missing.title', 'Version history is not available yet'),
    body: ctx.t(
      'shell.screen.history.missing.body',
      'No "{id}" destination is registered. The history feature may not have finished starting; reopening the application usually fixes this.',
      { values: { id: HISTORY_TAB_ID } }
    )
  });
}

const screen: ScreenDefinition = {
  id: 'history',
  // Reusing the history feature's own already-registered, already-localized
  // keys: a screen module has no `strings` catalogue of its own, and the
  // header resolves `screen.title`/`screen.subtitle` with the key itself as
  // the fallback (see `shell/header.ts`), so an unregistered key would
  // render literally.
  title: 'history.panel.title',
  subtitle: 'history.panel.subtitle',
  icon: 'history',
  mount(host, ctx) {
    host.classList.add('wds-screen-history');

    const definition = ctx.registry.tab(HISTORY_TAB_ID);
    if (!definition) {
      let missing = buildMissingState(ctx);
      host.append(missing);
      // The one gap this screen's own chrome can have: no registered tab
      // means nothing below repaints itself, so this fallback message must
      // subscribe on its own to stay current through a language change.
      return ctx.i18n.onChange(() => {
        const next = buildMissingState(ctx);
        missing.replaceWith(next);
        missing = next;
      });
    }

    const disposers: Array<() => void> = [];
    const tabCtx: TabContext = {
      ...ctx,
      tabId: 'shell.history',
      onDispose: (fn: () => void) => {
        disposers.push(fn);
      }
    };

    const dispose = definition.mount(host, tabCtx);
    if (typeof dispose === 'function') disposers.push(dispose);

    return () => {
      for (const fn of disposers) {
        try {
          fn();
        } catch (error) {
          console.error('Disposing the history screen threw:', error);
        }
      }
    };
  }
};

export default screen;
