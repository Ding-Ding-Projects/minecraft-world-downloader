import './styles/tokens.css';
import './styles/material.css';

import { a11y, el } from './core/a11y';
import { appearance, installAppearanceCommands } from './core/appearance';
import { components } from './core/components';
import { confirmService } from './core/confirm';
import { coreFeature } from './core/coreFeature';
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
import { mountShell, shell } from './shell';
import type { DimSumDraw, ProcessSummary } from '../shared/api';

/**
 * The boot sequence.
 *
 * Order matters here and each step depends on the one before it: settings must
 * be on disk-backed state before the language and theme read from them, the
 * registry must hold every module before any screen or tab mounts, and the
 * application context must exist before a module's `init` runs.
 *
 * Feature discovery is automatic. Every `./features/<id>/index.ts` is imported
 * and its default export registered, so adding a feature is adding one directory
 * and touching nothing else in the core.
 *
 * The application's own chrome is `mountShell` (`./shell/index.ts`): a title
 * bar, a left navigation rail and one screen per destination, replacing the
 * browser-style tab strip this file used to build by hand. Every existing
 * feature module still registers exactly as before — the registry does not
 * know or care that the top-level chrome changed — and stays reachable
 * through the "Other" destination, which reads `registry.tabs()` directly.
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
 * application already shares — the settings store (by well-known key), the
 * shell's own screen router and the privileged process bridge — rather than
 * importing a specific feature's own types. `downloader.status.chunksSaved` /
 * `...chunksSavedAt` are published by `features/downloader/panel.ts`; the
 * literal keys are duplicated there and here on purpose, the same way this
 * file duplicates no feature-specific type either.
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

  // "Viewing" now names the shell's active DESTINATION rather than the old
  // top-level tab strip's active TAB — `shell.current()`/`shell.screen()`
  // (`./shell/index.ts`) are the router that replaced `ctx.tabs` as the
  // thing actually on screen. See this lane's completion report for why
  // `ctx.tabs` itself is deliberately not used here any more.
  const refreshDestination = (): void => {
    const activeId = shell.current();
    const definition = activeId ? shell.screen(activeId) : null;
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

  shell.onChange(refreshDestination);
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

/* ---------------------------------------------------------------- */
/* The registry's own tab router — still mounted, no longer visible  */
/* ---------------------------------------------------------------- */

/**
 * `ctx.tabs` (`core/tabs.ts`'s `TabsImpl` singleton) used to be this
 * application's top-level chrome: a visible browser-style strip this file
 * built and mounted at the top of the window. The design's shell replaces
 * that with the navigation rail and per-destination screens, and every
 * registered `TabDefinition` is reachable instead through the "Other"
 * destination (`shell/screens/other.ts`), which reads `ctx.registry.tabs()`
 * and mounts each one directly — it does not go through `ctx.tabs` at all.
 *
 * `ctx.tabs` is still handed out on `AppContext`, though, and three files
 * outside this lane call it directly: `shell/drawer.ts`'s "ALL FEATURES" rows
 * (`ctx.tabs.open(tab.id)`), `shell/header.ts`'s account chip
 * (`ctx.tabs.teleport('downloader.main')`) and `shell/titlebar.ts`'s
 * notification bell (`ctx.tabs.open('core.notifications')`). Left unmounted,
 * `TabsImpl.open()`/`teleport()` are unconditional no-ops — `core/tabs.ts`
 * itself refuses with `if (!definition || !this.content || !this.ctx)
 * return;` — which would make all three of those a genuinely dead control.
 *
 * So the service is still constructed and mounted here, onto a real
 * strip/content pair (real DOM, real per-tab mount/dispose, the same
 * settings-backed pin/group/order state as before) that is simply kept out
 * of the visible layout with `hidden`, since there is no longer a top-level
 * chrome position for it to render into.
 *
 * Known, accepted gap, reported rather than silently left: this keeps
 * `ctx.tabs.open()`/`teleport()` from crashing or silently no-op'ing forever,
 * but it does not make them visible. A tab opened this way mounts its real
 * panel — with real side effects — into this hidden host, not anywhere the
 * user can see it. The only genuinely visible route to a registered tab in
 * this shell is the "Other" destination's own directory. Making the bell,
 * the account chip and the drawer's tab rows navigate somewhere visible
 * (e.g. `shell.go('other', { area: id })`) would mean editing
 * `shell/drawer.ts`, `shell/header.ts` and `shell/titlebar.ts`, none of which
 * are this lane's files.
 */
function mountLegacyTabsRouter(ctx: AppContext): void {
  const host = el('div', { className: 'wds-legacy-tabs', attrs: { hidden: '' } });
  const legacyShell = el('div', { className: 'md-shell' });
  const strip = el('nav', { className: 'md-tabstrip' });
  const content = el('main', { className: 'md-content' });
  legacyShell.append(strip, content);
  host.append(legacyShell);
  document.body.append(host);
  tabs.mount(legacyShell, strip, content, ctx);
}

async function boot(): Promise<void> {
  await loadSettings();
  initI18n();
  initTheme();

  const root = document.getElementById('app');
  if (!root) throw new Error('The application root element is missing from index.html.');
  root.textContent = '';
  // `.md-app` (`styles/material.css`) is the outermost frame: a two-row grid
  // holding the shell (which owns its own internal title-bar row) above this
  // file's own persistent status bar. `mountShell` unconditionally sets its
  // OWN target element's `className` to `wds-shell`, so that target must be a
  // child of `root` rather than `root` itself, or this class would be wiped
  // the moment the shell mounts and the status bar row would have nothing to
  // size against.
  root.className = 'md-app';
  const shellHost = el('div');

  /* ---------------- feature discovery ---------------- */

  registry.register(coreFeature());

  const discovered = import.meta.glob<{ default?: FeatureModule }>('./features/*/index.ts', { eager: true });

  // A feature that fails to register is not silently dropped. Registration is
  // all-or-nothing in the registry, so a refused module changes nothing — but a
  // console line is not a report, and a missing destination in a directory of
  // forty is exactly the kind of absence nobody notices. The failures are
  // collected here and raised once the notification service has a context to
  // render into.
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

  // See `mountLegacyTabsRouter`'s own docstring: keeps `ctx.tabs` genuinely
  // mounted (not a dead service) even though it no longer owns any visible
  // top-level chrome.
  mountLegacyTabsRouter(ctx);

  root.append(shellHost);
  mountShell(shellHost, ctx);
  root.append(buildStatusBar(ctx));

  attachSettingsHistory(settings, (id) => {
    const control = registry.settingControl(id);
    return control ? `${i18n.t(control.label, control.label)} (${id})` : id;
  });

  // Every visible piece of the new shell repaints itself on this same event
  // internally — see `shell/titlebar.ts`, `shell/header.ts` and each
  // `shell/screens/*.ts` module's own `ctx.i18n.onChange` subscription (the
  // app's own display name is one of the things `shell/titlebar.ts` already
  // repaints there, so it is not duplicated here). What this file still
  // repaints is the hidden legacy tabs router's own internal state, for the
  // same reason it is still mounted at all — real, live, settings-backed
  // state, even though nothing user-visible currently depends on it
  // repainting.
  i18n.onChange(() => {
    const active = tabs.activeId();
    tabs.setDock(tabs.dock());
    if (active) tabs.open(active);
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
