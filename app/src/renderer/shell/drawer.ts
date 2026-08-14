import { a11y, el } from '../core/a11y';
import { components } from '../core/components';
import { shortcuts } from '../core/menu';
import type { AppContext } from '../core/types';
import { currentProfileSummary, goOrNotify, shell } from './index';
import type { ScreenDefinition } from './types';

/**
 * The destinations drawer (design lines 1130-1150).
 *
 * It lists every registered screen (with its real, live keyboard shortcut
 * when one is bound) AND every registry tab — every one of the application's
 * feature modules stays reachable from here even though most of them no
 * longer have a rail icon of their own — behind one keyboard-focusable filter
 * field carrying its own anchored regex builder via `ctx.createSearchBar`.
 */

export interface DrawerHandle {
  open(): void;
  close(): void;
  isOpen(): boolean;
}

/**
 * The "Other" screen's own detail frame (`shell/screens/other.ts`) is the
 * only place in this shell that actually mounts a registry tab onto
 * something visible — it reads a tab id out of its `area` router param and
 * mounts that `TabDefinition` into its own frame. `ctx.tabs.open`/
 * `ctx.tabs.teleport` still do a real, live mount with real side effects, but
 * into a hidden legacy-tabs container that has no visible position anywhere
 * in this shell, so calling them directly from chrome leaves the click
 * looking like it did nothing.
 *
 * A small, explicit set of tab ids is instead already surfaced by a
 * dedicated top-level screen (the Downloader, Live map, Bot runner, Settings
 * and Version history screens) rather than by the Other directory —
 * `other.ts`'s own `OWNED_BY_ANOTHER_SCREEN` set excludes exactly these ids
 * from its directory, so routing one of them through `other` would land on
 * "This destination is no longer available." Kept here as an identical,
 * separately hand-written list rather than an import, because `other.ts`
 * exports only its screen definition.
 */
const SCREEN_FOR_OWNED_TAB: Record<string, string> = {
  'downloader.main': 'downloader',
  'map.viewer': 'map',
  'bot.runner': 'bot',
  settings: 'settings',
  'history.panel': 'history',
  'history.protected': 'history'
};

/** Must match `AREA_PARAM` in `shell/screens/other.ts`. */
const OTHER_AREA_PARAM = 'area';

/**
 * The one genuinely visible route to any registered tab. A tab already owned
 * by a dedicated top-level screen navigates straight to that screen; every
 * other tab opens through the Other destination's own directory, which is
 * the only surface that mounts a registry tab where it can be seen.
 */
export function openRegisteredTab(tabId: string): void {
  const ownerScreenId = SCREEN_FOR_OWNED_TAB[tabId];
  if (ownerScreenId) {
    shell.go(ownerScreenId);
    return;
  }
  shell.go('other', { [OTHER_AREA_PARAM]: tabId });
}

function railHotkeyChord(screenId: string, railedIds: string[]): string | undefined {
  if (screenId === 'settings') return shortcuts.chordFor('shell.hotkey.settings');
  const index = railedIds.indexOf(screenId);
  if (index === -1) return undefined;
  return shortcuts.chordFor(`shell.hotkey.${index + 1}`);
}

export function createDrawer(ctx: AppContext, host: HTMLElement): DrawerHandle {
  let scrim: HTMLElement | null = null;
  let releaseFocusTrap: (() => void) | null = null;
  let releaseSearch: (() => void) | null = null;
  let previousFocus: HTMLElement | null = null;

  const close = (): void => {
    if (!scrim) return;
    releaseFocusTrap?.();
    releaseFocusTrap = null;
    releaseSearch?.();
    releaseSearch = null;
    scrim.remove();
    scrim = null;
    previousFocus?.focus({ preventScroll: true });
    previousFocus = null;
  };

  const open = (): void => {
    if (scrim) return;
    previousFocus = document.activeElement as HTMLElement | null;

    scrim = el('div', { className: 'wds-drawer-scrim' });
    const backdrop = el('div', { className: 'wds-drawer-scrim__backdrop' });
    backdrop.addEventListener('click', () => close());
    scrim.append(backdrop);

    const aside = el('aside', {
      className: 'wds-drawer',
      attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': ctx.t('shell.drawer.title', 'Go to') }
    });

    const headerRow = el('div', { className: 'wds-drawer__header' });
    headerRow.append(el('b', { className: 'md-typescale-title-large', text: ctx.t('shell.drawer.title', 'Go to') }));
    const closeButton = components.iconButton({
      icon: 'close',
      label: ctx.t('core.action.dismiss', 'Close'),
      onClick: () => close()
    });
    headerRow.append(closeButton);
    aside.append(headerRow);

    const searchHost = el('div', { className: 'wds-drawer__search' });
    aside.append(searchHost);

    const destHeading = el('div', {
      className: 'wds-drawer__heading',
      text: ctx.t('shell.drawer.destinations', 'DESTINATIONS')
    });
    const destList = el('div', { className: 'wds-drawer__list' });
    const tabHeading = el('div', {
      className: 'wds-drawer__heading',
      text: ctx.t('shell.drawer.allFeatures', 'ALL FEATURES')
    });
    const tabList = el('div', { className: 'wds-drawer__list' });
    const empty = el('p', {
      className: 'wds-drawer__empty md-typescale-body-medium',
      text: ctx.t('shell.drawer.empty', 'Nothing matches that. Every destination is still there — clear the search.')
    });
    empty.hidden = true;
    aside.append(destHeading, destList, tabHeading, tabList, empty);

    const spacer = el('div', { className: 'wds-drawer__spacer' });
    aside.append(spacer);

    const footer = el('div', { className: 'wds-drawer__footer' });
    const profile = currentProfileSummary(ctx);
    if (profile) {
      footer.append(el('span', { className: 'wds-drawer__footeravatar', text: profile.initial, attrs: { 'aria-hidden': 'true' } }));
      const footerText = el('span', { className: 'wds-drawer__footertext' });
      footerText.append(
        el('b', { text: profile.name }),
        el('span', { text: ctx.t('shell.drawer.profileInUse', 'Profile in use') })
      );
      footer.append(footerText);
      footer.append(
        components.button({
          label: ctx.t('shell.header.switchProfile', 'Switch profile'),
          variant: 'tonal',
          onClick: () => {
            close();
            goOrNotify(ctx, 'profiles');
          }
        })
      );
      aside.append(footer);
    }

    scrim.append(aside);
    host.append(scrim);

    /* ---------------- rows ---------------- */

    const destRows: Array<{ node: HTMLElement; haystack: string }> = [];
    const railedIds = shell
      .screens()
      .filter((screen) => screen.rail !== undefined)
      .sort((a, b) => (a.rail ?? 0) - (b.rail ?? 0))
      .filter((screen) => screen.id !== 'settings')
      .map((screen) => screen.id);

    const allScreens: ScreenDefinition[] = shell.screens();
    for (const screen of allScreens) {
      const label = ctx.t(screen.title, screen.title);
      const row = el('button', { className: 'wds-drawer__item', attrs: { type: 'button' } });
      row.append(el('span', { className: 'wds-drawer__itemlabel', text: label }));
      const chord = railHotkeyChord(screen.id, railedIds);
      if (chord) row.append(el('span', { className: 'wds-drawer__itemhint', text: chord }));
      row.addEventListener('click', () => {
        close();
        shell.go(screen.id);
      });
      destList.append(row);
      destRows.push({ node: row, haystack: `${label} ${screen.id}` });
    }

    const tabRows: Array<{ node: HTMLElement; haystack: string }> = [];
    // `ctx.tabs.list()` only carries the tabs a user has actually opened this
    // session; the drawer needs every REGISTERED tab so all of the
    // application's feature modules stay reachable regardless of what has
    // been opened yet.
    const registryTabs = ctx.registry.tabs();
    for (const tab of registryTabs) {
      const label = ctx.t(tab.title, tab.title);
      const row = el('button', { className: 'wds-drawer__item', attrs: { type: 'button' } });
      row.append(el('span', { className: 'wds-drawer__itemlabel', text: label }));
      row.addEventListener('click', () => {
        close();
        openRegisteredTab(tab.id);
      });
      tabList.append(row);
      tabRows.push({ node: row, haystack: `${label} ${tab.id}` });
    }

    const applyFilter = (matches: (text: string) => boolean): void => {
      let destVisible = 0;
      for (const row of destRows) {
        const match = matches(row.haystack);
        row.node.hidden = !match;
        if (match) destVisible += 1;
      }
      let tabVisible = 0;
      for (const row of tabRows) {
        const match = matches(row.haystack);
        row.node.hidden = !match;
        if (match) tabVisible += 1;
      }
      destHeading.hidden = destVisible === 0;
      destList.hidden = destVisible === 0;
      tabHeading.hidden = tabVisible === 0;
      tabList.hidden = tabVisible === 0;
      empty.hidden = destVisible + tabVisible > 0;
    };

    const search = ctx.createSearchBar({
      label: 'shell.drawer.search',
      placeholder: 'shell.drawer.search.placeholder',
      sample: [...destRows, ...tabRows].map((row) => row.haystack).join('\n'),
      onChange: (query) => applyFilter(query.matches),
      onEscape: () => close()
    });
    searchHost.append(search.root);
    releaseSearch = () => search.destroy();

    releaseFocusTrap = a11y.trapFocus(aside);
    aside.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') close();
    });

    window.requestAnimationFrame(() => search.focus());
  };

  return {
    open,
    close,
    isOpen: () => scrim !== null
  };
}
