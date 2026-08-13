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
import type { DimSumDraw, ProcessSummary, WindowState } from '../shared/api';

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

/* ---------------------------------------------------------------- */
/* The persistent bottom status bar                                  */
/* ---------------------------------------------------------------- */

/**
 * A handful of live facts kept in one glance, the way a real desktop
 * application's status bar does. It is never the primary channel for
 * anything — that is what the notification service is for — and it never
 * shows a fabricated or stale-looking figure: a value that has not genuinely
 * been measured yet says so honestly (e.g. "not counted yet") rather than
 * inventing one.
 *
 * This is core chrome, so it reads only from the substrate every part of the
 * application already shares — the settings store (by well-known key) and the
 * privileged process bridge — rather than importing a specific feature's own
 * types. `downloader.status.chunksSaved` / `...chunksSavedAt` are published by
 * `features/downloader/panel.ts`; the literal keys are duplicated there and
 * here on purpose, the same way `APP_DISPLAY_NAME_ID` above is a well-known
 * settings key rather than a live import across the core/feature boundary.
 */
const DOWNLOADER_CHUNKS_SAVED_KEY = 'downloader.status.chunksSaved';
const DOWNLOADER_CHUNKS_SAVED_AT_KEY = 'downloader.status.chunksSavedAt';

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number): string => String(value).padStart(2, '0');
  return hours > 0 ? `${hours}h ${pad(minutes)}m ${pad(seconds)}s` : `${minutes}m ${pad(seconds)}s`;
}

function formatRelative(iso: string): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return iso;
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(then).toLocaleDateString();
}

function buildStatusBar(ctx: AppContext): HTMLElement {
  const bar = el('footer', {
    className: 'md-statusbar',
    attrs: { 'data-appearance-id': 'chrome:statusbar', 'aria-label': ctx.t('core.statusbar.label', 'Application status') }
  });

  // Destination, session and chunk count change only occasionally, so they
  // sit inside a `status` region that announces the change; the ticking clock
  // below deliberately does not, or a screen reader would narrate it every
  // second.
  const live = el('div', { className: 'md-statusbar__live', attrs: { role: 'status' } });
  const viewing = el('span', { className: 'md-statusbar__item' });
  const divider1 = el('span', { className: 'md-statusbar__divider', attrs: { 'aria-hidden': 'true' } });
  const processesItem = el('span', { className: 'md-statusbar__item' });
  const divider2 = el('span', { className: 'md-statusbar__divider', attrs: { 'aria-hidden': 'true' } });
  const chunksItem = el('span', { className: 'md-statusbar__item' });
  live.append(viewing, divider1, processesItem, divider2, chunksItem);

  const spacer = el('span', { className: 'md-statusbar__spacer' });
  const elapsed = el('span', { className: 'md-statusbar__elapsed' });

  bar.append(live, spacer, elapsed);

  const refreshDestination = (): void => {
    const activeId = ctx.tabs.activeId();
    const definition = activeId ? ctx.registry.tab(activeId) : null;
    viewing.textContent = definition
      ? ctx.t('core.statusbar.viewing', 'Viewing: {tab}', { values: { tab: ctx.t(definition.title, definition.title) } })
      : ctx.t('core.statusbar.noActiveTab', 'No destination open');
  };

  const refreshProcesses = async (): Promise<void> => {
    const result = await ctx.studio.process.list();
    if (!result.ok) return;
    const running = result.value.filter((process: ProcessSummary) => process.running);
    if (running.length === 0) {
      processesItem.textContent = ctx.t('core.statusbar.processes.none', 'No background processes running');
    } else if (running.length === 1) {
      processesItem.textContent = ctx.t('core.statusbar.processes.one', '1 process running: {command}', {
        values: { command: running[0].command }
      });
    } else {
      processesItem.textContent = ctx.t('core.statusbar.processes.many', '{count} processes running', {
        values: { count: running.length }
      });
    }
  };

  const refreshChunks = (): void => {
    const count = ctx.settings.get<number | null>(DOWNLOADER_CHUNKS_SAVED_KEY, null);
    const at = ctx.settings.get<string | null>(DOWNLOADER_CHUNKS_SAVED_AT_KEY, null);
    chunksItem.textContent =
      count === null || at === null
        ? ctx.t('core.statusbar.chunks.none', 'Chunks saved: not counted yet')
        : ctx.t('core.statusbar.chunks.value', 'Chunks saved: {count} (counted {when})', {
            values: { count: new Intl.NumberFormat().format(count), when: formatRelative(at) }
          });
  };

  const refreshElapsed = (): void => {
    elapsed.textContent = ctx.t('core.statusbar.elapsed', 'Up {duration}', {
      values: { duration: formatElapsed(Date.now() - ctx.studio.info.startedAt) }
    });
  };

  refreshDestination();
  void refreshProcesses();
  refreshChunks();
  refreshElapsed();

  ctx.tabs.onChange(refreshDestination);
  ctx.i18n.onChange(() => {
    refreshDestination();
    void refreshProcesses();
    refreshChunks();
    refreshElapsed();
  });
  ctx.settings.onChange((change) => {
    if (change.id === DOWNLOADER_CHUNKS_SAVED_KEY || change.id === DOWNLOADER_CHUNKS_SAVED_AT_KEY) refreshChunks();
  });
  ctx.studio.events.on('process:event', () => void refreshProcesses());
  // A push event can only report on a process that has already sent output; a
  // short bounded poll is the honest way to notice one that has just started
  // and catch a missed exit, the same tradeoff the downloader's own poll makes.
  window.setInterval(() => void refreshProcesses(), 5000);
  window.setInterval(refreshElapsed, 1000);

  return bar;
}

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
  root.append(buildStatusBar(ctx));

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
