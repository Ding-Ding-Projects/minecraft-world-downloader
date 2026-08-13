import './styles/tokens.css';
import './styles/material.css';

import { a11y, el } from './core/a11y';
import { appearance, installAppearanceCommands } from './core/appearance';
import { components } from './core/components';
import { confirmService } from './core/confirm';
import { coreFeature, APP_DISPLAY_NAME_ID } from './core/coreFeature';
import { showDimSum, subscribeDimSum } from './core/dimsum';
import { docsService } from './core/docs';
import { exporter } from './core/export';
import { history, attachSettingsHistory } from './core/history';
import { i18n, initI18n } from './core/i18n';
import { installLockCommands, locks } from './core/locks';
import { notifications } from './core/notifications';
import { overlay } from './core/overlay';
import { palette } from './core/palette';
import { createRegexBuilder } from './core/regexbuilder';
import { registry } from './core/registry';
import { createSearchBar } from './core/searchbar';
import { loadSettings, settings } from './core/settings';
import { tabs } from './core/tabs';
import { initTheme, theme } from './core/theme';
import type { AppContext, FeatureModule } from './core/types';
import type { DimSumDraw, WindowState } from '../shared/api';

/**
 * The boot sequence.
 *
 * Order matters here and each step depends on the one before it: settings must
 * be on disk-backed state before the language and theme read from them, the
 * registry must hold every module before any tab mounts, and the application
 * context must exist before a module's `init` runs.
 *
 * Feature discovery is automatic. Every `./features/<id>/index.ts` is imported
 * and its default export registered, so adding a feature is adding one directory
 * and touching nothing else in the core.
 */

async function boot(): Promise<void> {
  await loadSettings();
  initI18n();
  initTheme();

  const root = document.getElementById('app');
  if (!root) throw new Error('The application root element is missing from index.html.');
  root.textContent = '';
  root.className = 'md-app';

  /* ---------------- the frameless Material title bar ---------------- */

  const titleBar = el('header', { className: 'md-titlebar', attrs: { 'data-appearance-id': 'chrome:titlebar' } });
  const brand = el('div', { className: 'md-titlebar__brand' });
  brand.append(components.icon('world', { size: 18 }));
  const brandText = el('span', { className: 'md-typescale-title-small' });
  brand.append(brandText);

  const applyName = (): void => {
    const chosen = settings.get<string>(APP_DISPLAY_NAME_ID, '') || window.studio.info.productName;
    brandText.textContent = chosen;
    void window.studio.window.setTitle(chosen);
  };
  applyName();

  const actions = el('div', { className: 'md-titlebar__actions' });
  actions.append(
    components.iconButton({
      icon: 'search',
      label: i18n.t('core.palette.title', 'Command palette'),
      onClick: () => palette.open()
    }),
    components.iconButton({
      icon: 'notifications',
      label: i18n.t('core.notify.centre', 'Notifications'),
      onClick: () => tabs.open('core.notifications')
    }),
    components.iconButton({
      icon: 'settings',
      label: i18n.t('core.settings.title', 'Settings'),
      onClick: () => tabs.open('core.settings')
    })
  );

  const controls = el('div', { className: 'md-titlebar__controls' });
  const minimize = el('button', {
    className: 'md-window-button',
    text: '–',
    attrs: { type: 'button', 'aria-label': i18n.t('core.window.minimize', 'Minimize') }
  });
  const maximize = el('button', {
    className: 'md-window-button',
    text: '□',
    attrs: { type: 'button', 'aria-label': i18n.t('core.window.maximize', 'Maximize') }
  });
  const close = el('button', {
    className: 'md-window-button md-window-button--close',
    text: '✕',
    attrs: { type: 'button', 'aria-label': i18n.t('core.window.close', 'Close') }
  });
  minimize.addEventListener('click', () => void window.studio.window.minimize());
  maximize.addEventListener('click', () => void window.studio.window.toggleMaximize());
  close.addEventListener('click', () => void window.studio.window.close());
  controls.append(minimize, maximize, close);

  titleBar.append(brand, el('div', { className: 'md-titlebar__spacer' }), actions, controls);

  const applyWindowState = (state: WindowState): void => {
    const restore = state.isMaximized;
    maximize.textContent = restore ? '❐' : '□';
    maximize.setAttribute(
      'aria-label',
      restore ? i18n.t('core.window.restore', 'Restore') : i18n.t('core.window.maximize', 'Maximize')
    );
  };
  window.studio.events.on('window:state', applyWindowState);
  void window.studio.window.getState().then((result) => {
    if (result.ok) applyWindowState(result.value);
  });

  /* ---------------- shell ---------------- */

  const shell = el('div', { className: 'md-shell' });
  const strip = el('nav', { className: 'md-tabstrip', attrs: { 'data-appearance-id': 'chrome:tabstrip' } });
  const content = el('main', { className: 'md-content', attrs: { id: 'md-content' } });
  shell.append(strip, content);
  root.append(titleBar, shell);

  /* ---------------- feature discovery ---------------- */

  registry.register(coreFeature());

  const discovered = import.meta.glob<{ default?: FeatureModule }>('./features/*/index.ts', { eager: true });

  // A feature that fails to register is not silently dropped. Registration is
  // all-or-nothing in the registry, so a refused module changes nothing — but a
  // console line is not a report, and a missing destination in a strip of thirty
  // is exactly the kind of absence nobody notices. The failures are collected
  // here and raised once the notification service has a context to render into.
  const registrationFailures: Array<{ path: string; reason: string }> = [];

  for (const [path, module] of Object.entries(discovered)) {
    const feature = module?.default;
    if (!feature) {
      const reason = 'the file has no default export.';
      console.error(`"${path}" was not registered: ${reason}`);
      registrationFailures.push({ path, reason });
      continue;
    }
    try {
      registry.register(feature);
      if (feature.strings) i18n.register(feature.strings);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      console.error(`"${path}" could not be registered: ${reason}`);
      registrationFailures.push({ path, reason });
    }
  }

  /* ---------------- application context ---------------- */

  const dimSumListeners = new Set<(draw: DimSumDraw) => void>();

  const ctx: AppContext = {
    registry,
    settings,
    i18n,
    t: (key, fallbackEn, options) => i18n.t(key, fallbackEn, options),
    notify: notifications,
    history,
    confirm: confirmService,
    tabs,
    palette,
    docsService,
    theme,
    appearance,
    locks,
    overlay,
    a11y,
    components,
    exporter,
    createSearchBar,
    createRegexBuilder,
    studio: window.studio,
    dimSum: {
      subscribe: (listener) => {
        dimSumListeners.add(listener);
        return () => dimSumListeners.delete(listener);
      }
    }
  };

  registry.initializeAll(ctx);

  for (const failure of registrationFailures) {
    notifications.error(
      i18n.t('core.feature.registerFailed.title', 'A feature did not load'),
      i18n.t('core.feature.registerFailed.body', '{path} was skipped: {reason}', {
        values: { path: failure.path, reason: failure.reason }
      })
    );
  }

  /* ---------------- shell wiring ---------------- */

  installAppearanceCommands();
  installLockCommands();
  palette.attach(ctx);
  tabs.mount(shell, strip, content, ctx);

  attachSettingsHistory(settings, (id) => {
    const control = registry.settingControl(id);
    return control ? `${i18n.t(control.label, control.label)} (${id})` : id;
  });

  settings.onChange((change) => {
    if (change.id === APP_DISPLAY_NAME_ID) applyName();
  });

  i18n.onChange(() => {
    // A language or humour change repaints without a restart: the strip rebuilds
    // and the currently mounted panel is re-created so its copy follows suit.
    const active = tabs.activeId();
    tabs.setDock(tabs.dock());
    if (active) tabs.open(active);
    applyName();
  });

  /* ---------------- the dim sum draw ---------------- */

  subscribeDimSum((draw) => {
    showDimSum(draw);
    for (const listener of dimSumListeners) {
      try {
        listener(draw);
      } catch (error) {
        console.error('A dim sum listener threw:', error);
      }
    }
  });

  /* ---------------- honest failure reporting ---------------- */

  window.addEventListener('error', (event) => {
    notifications.error(
      i18n.t('core.error.title', 'Something failed', { dialog: true }),
      `${event.message} (${event.filename}:${event.lineno})`
    );
  });
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason instanceof Error ? event.reason.message : String(event.reason);
    notifications.error(i18n.t('core.error.title', 'Something failed', { dialog: true }), reason);
  });

  void window.studio.history
    .status()
    .then((result) => {
      if (result.ok && result.value.degradedReason) {
        notifications.warn(i18n.t('core.history.title', 'Version history'), result.value.degradedReason);
      }
    })
    .catch(() => undefined);
}

void boot().catch((error: unknown) => {
  // The window must say what went wrong rather than showing an empty frame.
  const message = error instanceof Error ? error.message : String(error);
  const root = document.getElementById('app') ?? document.body;
  root.textContent = '';
  const failure = el('div', { className: 'md-panel' });
  failure.append(
    el('h1', { className: 'md-typescale-headline-small', text: 'The application did not start' }),
    el('p', { className: 'md-typescale-body-large', text: message }),
    el('p', {
      className: 'md-typescale-body-small',
      text: 'Nothing was changed on disk. Reopening the application will try again.'
    })
  );
  root.append(failure);
  console.error(error);
});
