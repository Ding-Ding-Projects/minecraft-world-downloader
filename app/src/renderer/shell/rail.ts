import { el } from '../core/a11y';
import { components } from '../core/components';
import type { AppContext, PaletteEntry } from '../core/types';
import { shell } from './index';
import type { ScreenDefinition } from './types';

/**
 * The navigation rail (design lines 79-88): the Capture FAB, one pill button
 * per rail-ordered screen, and Settings pinned to the bottom past a spacer.
 *
 * Which screens appear here is entirely data-driven — every `ScreenDefinition`
 * with `rail` set, sorted by that number, rendered through `screen.icon` (a
 * key into the shared `core/icons.ts` set, per this lane's own `types.ts`
 * contract) rather than this file hard-coding a path per destination id. A
 * screen registered without `rail` (the design's "Live map" / "Bot runner" /
 * "Version history", reached from the "Other" destination instead) simply
 * never shows up here, which is the contract working as intended rather than
 * something this file special-cases.
 */

/**
 * Starts (or, if it is already running, no-ops on) the real world download —
 * the exact `downloader.command.start` command every other invoker of it
 * (the command palette, its own keyboard entry) reaches through. This lane
 * owns no session-state signal for the downloader (that lives inside
 * `features/downloader`'s own module-private `FeatureState`, not exposed on
 * `AppContext`), so the FAB starts a download rather than toggling one; see
 * this lane's completion report for the full reasoning.
 */
export function triggerCapture(ctx: AppContext): void {
  const entry: PaletteEntry | undefined = ctx.registry
    .paletteEntries()
    .find((candidate) => candidate.id === 'downloader.command.start');
  if (!entry || !entry.run) {
    ctx.notify.warn(
      ctx.t('shell.rail.capture.unavailable.title', 'The downloader is not ready'),
      ctx.t('shell.rail.capture.unavailable.body', 'The World download feature has not finished starting up yet.')
    );
    return;
  }
  void entry.run();
}

export function mountRail(ctx: AppContext): HTMLElement {
  const nav = el('nav', {
    className: 'wds-rail',
    attrs: { 'aria-label': ctx.t('shell.rail.label', 'Destinations') }
  });

  const fab = el('button', {
    className: 'wds-rail__fab',
    attrs: { type: 'button', 'aria-label': ctx.t('shell.rail.capture', 'Start a download') }
  });
  fab.append(components.icon('download', { size: 24 }));
  const fabLabel = el('span', { className: 'wds-rail__fablabel', text: ctx.t('shell.rail.capture.label', 'Capture') });
  fab.append(fabLabel);
  fab.addEventListener('click', () => triggerCapture(ctx));
  nav.append(fab);

  const destinations = el('div', { className: 'wds-rail__destinations' });
  const bottom = el('div', { className: 'wds-rail__bottom' });
  nav.append(destinations, bottom);

  const buttons = new Map<string, HTMLButtonElement>();

  const render = (): void => {
    // Re-read on every call (initial mount AND every live language/humour
    // change below) rather than once: this is the one piece of this file's
    // own chrome built outside `render` at construction time whose text
    // must repaint alongside the destination pills it already rebuilds.
    nav.setAttribute('aria-label', ctx.t('shell.rail.label', 'Destinations'));
    fab.setAttribute('aria-label', ctx.t('shell.rail.capture', 'Start a download'));
    fabLabel.textContent = ctx.t('shell.rail.capture.label', 'Capture');

    destinations.textContent = '';
    bottom.textContent = '';
    buttons.clear();

    const railed = shell
      .screens()
      .filter((screen): screen is ScreenDefinition & { rail: number } => screen.rail !== undefined)
      .sort((a, b) => a.rail - b.rail);

    for (const screen of railed) {
      const button = el('button', {
        className: 'wds-rail__item',
        attrs: { type: 'button' }
      });
      const pill = el('span', { className: 'wds-rail__pill' });
      pill.append(components.icon(screen.icon, { size: 22 }));
      const labelText = ctx.t(screen.title, screen.title);
      const label = el('span', { className: 'wds-rail__itemlabel', text: labelText });
      button.append(pill, label);
      button.setAttribute('aria-label', labelText);
      button.addEventListener('click', () => shell.go(screen.id));
      buttons.set(screen.id, button);

      if (screen.id === 'settings') bottom.append(button);
      else destinations.append(button);
    }

    updateActive();
    ctx.a11y.roving(nav, () => [...buttons.values()], 'vertical');
  };

  const updateActive = (): void => {
    const activeId = shell.current();
    for (const [id, button] of buttons) {
      const active = id === activeId;
      button.setAttribute('aria-current', active ? 'page' : 'false');
      button.classList.toggle('wds-rail__item--active', active);
    }
  };

  render();
  shell.onChange(updateActive);
  // Permanent shell chrome: `mountRail` is called once at boot
  // (`shell/index.ts`'s `mountShell`) and never torn down for the life of
  // the app, exactly like `shell/header.ts`'s own `ctx.i18n.onChange(refresh)`
  // a few lines above this file in the same folder — so there is no dispose
  // path to wire an unsubscribe into, matching that sibling file exactly.
  ctx.i18n.onChange(render);

  return nav;
}
