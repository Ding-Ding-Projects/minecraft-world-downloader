import { el } from '../core/a11y';
import { components } from '../core/components';
import { APP_DISPLAY_NAME_ID } from '../core/coreFeature';
import { shortcuts } from '../core/menu';
import type { AppContext } from '../core/types';
import { LAST_PROFILE_SETTING_ID, PROFILES_SETTING_ID } from '../features/downloader/profiles';
import type { WindowState } from '../../shared/api';
import { currentProfileSummary, goOrNotify } from './index';
import { openRegisteredTab, type DrawerHandle } from './drawer';

/**
 * The title bar (design lines 59-75): hamburger -> drawer, the app's own icon
 * and name, the search pill that opens the command palette, accessibility and
 * theme toggles, the notification bell with a real unread count, and the
 * frameless window's own minimize/maximize/close controls.
 *
 * A ligature icon font is not in play here (the shared icon set is inline SVG
 * paths, `core/icons.ts`) but the shared set has no hamburger, crescent-moon or
 * accessibility-figure glyph. Rather than substitute a loosely-related named
 * icon, this file draws those three plus the window-control glyphs from the
 * design's own path data, matching the mockup exactly without touching
 * `core/icons.ts` (which is not a file this lane owns).
 */

function rawIcon(d: string, size = 20, stroke = false): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', d);
  if (stroke) {
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-width', '1.6');
    path.setAttribute('stroke-linecap', 'round');
  } else {
    path.setAttribute('fill', 'currentColor');
  }
  svg.append(path);
  return svg;
}

function rawRect(size = 16): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  rect.setAttribute('x', '5');
  rect.setAttribute('y', '5');
  rect.setAttribute('width', '14');
  rect.setAttribute('height', '14');
  rect.setAttribute('rx', '1.5');
  rect.setAttribute('fill', 'none');
  rect.setAttribute('stroke', 'currentColor');
  rect.setAttribute('stroke-width', '1.6');
  svg.append(rect);
  return svg;
}

/** The "restore" glyph: two overlapping rounded rectangles, the ordinary desktop convention. */
function rawRestoreIcon(size = 16): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  for (const attrs of [
    { x: '4', y: '7', w: '13', h: '13' },
    { x: '7', y: '4', w: '13', h: '13' }
  ]) {
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', attrs.x);
    rect.setAttribute('y', attrs.y);
    rect.setAttribute('width', attrs.w);
    rect.setAttribute('height', attrs.h);
    rect.setAttribute('rx', '1.5');
    rect.setAttribute('fill', 'none');
    rect.setAttribute('stroke', 'currentColor');
    rect.setAttribute('stroke-width', '1.4');
    svg.append(rect);
  }
  return svg;
}

const HAMBURGER_PATH = 'M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z';
const THEME_PATH = 'M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9';
const A11Y_PATH = 'M12 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4M4 8h16v2h-5l1 12h-2l-1-6h-2l-1 6H8l1-12H4z';
const MINIMIZE_PATH = 'M5 12h14';
const CLOSE_PATH = 'M6 6l12 12M18 6L6 18';

function chromeButton(label: string, icon: SVGSVGElement, onClick: () => void): HTMLButtonElement {
  const button = el('button', {
    className: 'wds-chromebtn',
    attrs: { type: 'button', 'aria-label': label, title: label }
  });
  button.append(icon);
  button.addEventListener('click', onClick);
  return button;
}

function unreadNotificationCount(ctx: AppContext): number {
  // `NotificationRecord` carries no dedicated "read" flag, so "unread" is
  // honestly derived from the real records: one that has not been dismissed
  // yet. This is real, live data — never a fabricated constant.
  return ctx.notify.history().filter((record) => record.dismissedAt === null).length;
}

export function mountTitlebar(ctx: AppContext, drawer: DrawerHandle): HTMLElement {
  const header = el('header', {
    className: 'wds-titlebar',
    attrs: { 'data-appearance-id': 'chrome:titlebar' }
  });

  const hamburger = chromeButton(
    ctx.t('shell.titlebar.drawer', 'All destinations'),
    rawIcon(HAMBURGER_PATH, 20),
    () => drawer.open()
  );
  hamburger.classList.add('wds-titlebar__squircle');

  const brandIcon = el('span', { className: 'wds-titlebar__brandicon' });
  brandIcon.append(components.icon('world', { size: 16 }));

  const brandText = el('span', { className: 'wds-titlebar__brandtext md-typescale-title-small' });

  const refreshBrand = (): void => {
    const productName = ctx.settings.get<string>(APP_DISPLAY_NAME_ID, '') || ctx.studio.info.productName;
    const profile = currentProfileSummary(ctx);
    const chosen = profile ? `${profile.name} — ${productName}` : productName;
    brandText.textContent = chosen;
    void ctx.studio.window.setTitle(chosen);
  };
  refreshBrand();

  const spacer = el('div', { className: 'wds-titlebar__spacer' });

  const paletteChord = shortcuts.chordFor('core.palette.toggle');
  const searchPill = el('button', {
    className: 'wds-searchpill',
    attrs: { type: 'button' }
  });
  searchPill.append(components.icon('search', { size: 16 }));
  searchPill.append(
    el('span', { text: ctx.t('shell.titlebar.searchPill', 'Search or run a command') })
  );
  if (paletteChord) {
    searchPill.append(el('span', { className: 'wds-searchpill__chord', text: paletteChord }));
  }
  searchPill.addEventListener('click', () => ctx.palette.open());

  const actions = el('div', { className: 'wds-titlebar__actions' });

  const a11yButton = chromeButton(ctx.t('shell.titlebar.a11y', 'Accessibility'), rawIcon(A11Y_PATH, 20), () => {
    // `ctx.a11y` (core/types.ts) exposes only announce/roving/trapFocus/
    // reducedMotion/assertTouchTarget/focusVisible — there is no sheet-opening
    // surface yet. Falling back to the Settings screen, the closest real
    // destination, per this lane's brief.
    goOrNotify(ctx, 'settings');
  });
  a11yButton.classList.add('wds-titlebar__squircle');

  const themeButton = chromeButton(ctx.t('shell.titlebar.theme', 'Switch theme'), rawIcon(THEME_PATH, 20), () => {
    const state = ctx.theme.state();
    ctx.theme.setMode(state.dark ? 'light' : 'dark');
  });
  themeButton.classList.add('wds-titlebar__squircle');

  const bellButton = el('button', {
    className: 'wds-chromebtn wds-titlebar__squircle wds-titlebar__bell',
    attrs: { type: 'button', 'aria-label': ctx.t('core.notify.centre', 'Notifications') }
  });
  bellButton.append(components.icon('notifications', { size: 20 }));
  const badge = el('span', { className: 'wds-badge', attrs: { 'aria-hidden': 'true' } });
  bellButton.append(badge);
  const refreshBadge = (): void => {
    const count = unreadNotificationCount(ctx);
    if (count <= 0) {
      badge.hidden = true;
      bellButton.title = ctx.t('core.notify.centre', 'Notifications');
    } else {
      badge.hidden = false;
      badge.textContent = count > 99 ? '99+' : String(count);
      bellButton.title = ctx.t('shell.titlebar.notifications.count', '{count} unread notifications', {
        values: { count }
      });
    }
    bellButton.setAttribute('aria-label', bellButton.title);
  };
  refreshBadge();
  bellButton.addEventListener('click', () => openRegisteredTab('core.notifications'));
  ctx.notify.onChange(refreshBadge);

  actions.append(a11yButton, themeButton, bellButton);

  const controls = el('div', { className: 'wds-titlebar__controls' });
  const minimizeBtn = el('button', {
    className: 'wds-windowbtn',
    attrs: { type: 'button', 'aria-label': ctx.t('core.window.minimize', 'Minimize') }
  });
  minimizeBtn.append(rawIcon(MINIMIZE_PATH, 16, true));
  const maximizeBtn = el('button', {
    className: 'wds-windowbtn',
    attrs: { type: 'button', 'aria-label': ctx.t('core.window.maximize', 'Maximize') }
  });
  maximizeBtn.append(rawRect(16));
  const closeBtn = el('button', {
    className: 'wds-windowbtn wds-windowbtn--close',
    attrs: { type: 'button', 'aria-label': ctx.t('core.window.close', 'Close') }
  });
  closeBtn.append(rawIcon(CLOSE_PATH, 16, true));
  controls.append(minimizeBtn, maximizeBtn, closeBtn);

  minimizeBtn.addEventListener('click', () => void ctx.studio.window.minimize());
  maximizeBtn.addEventListener('click', () => void ctx.studio.window.toggleMaximize());
  closeBtn.addEventListener('click', () => void ctx.studio.window.close());

  const applyWindowState = (state: WindowState): void => {
    const label = state.isMaximized ? ctx.t('core.window.restore', 'Restore') : ctx.t('core.window.maximize', 'Maximize');
    maximizeBtn.setAttribute('aria-label', label);
    maximizeBtn.title = label;
    maximizeBtn.textContent = '';
    maximizeBtn.append(state.isMaximized ? rawRestoreIcon(16) : rawRect(16));
  };
  ctx.studio.events.on('window:state', applyWindowState);
  void ctx.studio.window.getState().then((result) => {
    if (result.ok) applyWindowState(result.value);
  });

  header.append(hamburger, brandIcon, brandText, spacer, searchPill, actions, controls);

  ctx.settings.onChange((change) => {
    if (change.id === APP_DISPLAY_NAME_ID || change.id === PROFILES_SETTING_ID || change.id === LAST_PROFILE_SETTING_ID) {
      refreshBrand();
    }
  });
  ctx.i18n.onChange(refreshBrand);

  return header;
}
