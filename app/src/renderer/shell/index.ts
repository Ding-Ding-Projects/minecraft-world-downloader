import './shell.css';

import { el } from '../core/a11y';
import { components } from '../core/components';
import { shortcuts } from '../core/menu';
import type { AppContext } from '../core/types';
import { describeProfile, LAST_PROFILE_SETTING_ID, readProfiles } from '../features/downloader/profiles';
import { createDrawer } from './drawer';
import { mountHeader } from './header';
import { mountRail } from './rail';
import { mountTitlebar } from './titlebar';
import type { ScreenDefinition, ShellApi } from './types';
import { SHELL_STRINGS } from './strings';

/**
 * The shell: the title bar + navigation rail + per-destination screens chrome
 * that replaces the browser-style tab strip as the application's primary
 * navigation. `mountShell` is the one entry point another module calls; every
 * other export here is either the shared `shell` router singleton or a small
 * piece of state every chrome file in this lane needs (the current profile
 * summary), kept here so it has exactly one implementation.
 */

/* ================================================================== */
/* The router                                                          */
/* ================================================================== */

const ACTIVE_SCREEN_SETTING_ID = 'shell.activeScreen';

class ShellImpl implements ShellApi {
  private readonly screensById = new Map<string, ScreenDefinition>();
  private readonly listeners = new Set<(id: string) => void>();
  /**
   * Subtitle changes get their OWN channel, deliberately separate from
   * `listeners` above. See `setSubtitle`.
   */
  private readonly subtitleListeners = new Set<(id: string) => void>();
  private readonly subtitleOverrides = new Map<string, string>();
  private activeId = '';
  private activeParams: Record<string, string> = {};

  register(screen: ScreenDefinition): void {
    if (!screen || typeof screen !== 'object') {
      throw new Error('A screen definition must be an object.');
    }
    if (typeof screen.id !== 'string' || screen.id.trim() === '') {
      throw new Error('A screen definition needs a stable, non-empty id.');
    }
    if (this.screensById.has(screen.id)) {
      throw new Error(`Two screens claim the id "${screen.id}". Ids are the filename under shell/screens/ and must be unique.`);
    }
    if (typeof screen.mount !== 'function') {
      throw new Error(`The screen "${screen.id}" has no mount function.`);
    }
    this.screensById.set(screen.id, screen);
  }

  screens(): ScreenDefinition[] {
    return [...this.screensById.values()].sort((a, b) => {
      const railA = a.rail ?? Number.POSITIVE_INFINITY;
      const railB = b.rail ?? Number.POSITIVE_INFINITY;
      if (railA !== railB) return railA - railB;
      return a.id.localeCompare(b.id);
    });
  }

  screen(id: string): ScreenDefinition | null {
    return this.screensById.get(id) ?? null;
  }

  go(id: string, params: Record<string, string> = {}): void {
    if (!this.screensById.has(id)) return;
    this.activeId = id;
    this.activeParams = params;
    this.emit();
  }

  params(): Record<string, string> {
    return this.activeParams;
  }

  current(): string {
    return this.activeId;
  }

  onChange(listener: (id: string) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onSubtitleChange(listener: (id: string) => void): () => void {
    this.subtitleListeners.add(listener);
    return () => this.subtitleListeners.delete(listener);
  }

  /**
   * Pushes a live subtitle for one screen.
   *
   * This notifies the SUBTITLE channel only, never the navigation channel.
   * Re-emitting `onChange` here -- which is what this did originally, to save
   * the header any plumbing of its own -- meant a screen that set its own
   * subtitle while mounting re-entered the shell's `renderActiveScreen`, which
   * mounts the screen again, which sets the subtitle again. That is an
   * unbounded synchronous loop: the renderer pegged a core, never painted, and
   * the window stayed blank with no error anywhere, because the re-entrancy was
   * a navigation event rather than a thrown exception. The downloader screen
   * (the default destination) did exactly this, so the application never
   * reached first paint at all.
   *
   * A subtitle is header text. It has no business remounting a screen, and
   * keeping the two channels apart is what makes that structurally impossible
   * rather than a rule every future screen has to remember.
   */
  setSubtitle(id: string, text: string): void {
    const previous = this.subtitleOverrides.get(id);
    if (previous === text) return;
    this.subtitleOverrides.set(id, text);
    if (id === this.activeId) this.emitSubtitle();
  }

  /**
   * Not part of the `ShellApi` contract — an implementation-internal reader
   * that `header.ts` (this same lane, importing the concrete singleton rather
   * than the narrower interface) uses to render whatever `setSubtitle` last
   * pushed for the active screen.
   */
  subtitleOverride(id: string): string | undefined {
    return this.subtitleOverrides.get(id);
  }

  private emit(): void {
    for (const listener of [...this.listeners]) {
      try {
        listener(this.activeId);
      } catch (error) {
        console.error('A shell navigation listener threw:', error);
      }
    }
  }

  private emitSubtitle(): void {
    for (const listener of [...this.subtitleListeners]) {
      try {
        listener(this.activeId);
      } catch (error) {
        console.error('A shell subtitle listener threw:', error);
      }
    }
  }
}

export const shell = new ShellImpl();

/* ================================================================== */
/* Shared chrome state: the current profile                            */
/* ================================================================== */

export interface ProfileSummary {
  id: string;
  name: string;
  /** A single uppercase letter for the avatar. Never a fabricated value. */
  initial: string;
  /** "host[:port] → output folder", from the same `describeProfile` the real Profiles screen uses. */
  where: string;
}

/**
 * The profile currently in use, for the title bar's brand text, the screen
 * header's profile-switcher chip, and the destinations drawer's footer card.
 *
 * Reads through `features/downloader/profiles.ts`'s own exported, already
 * real, already-tested `readProfiles`/`describeProfile` rather than
 * duplicating that formatting logic here — a duplicate would risk silently
 * disagreeing with whatever the real Profiles screen shows for the exact same
 * profile. Returns `null` (never a fabricated placeholder) when no profile has
 * ever been saved.
 */
export function currentProfileSummary(ctx: AppContext): ProfileSummary | null {
  const profiles = readProfiles(ctx);
  if (profiles.length === 0) return null;
  const lastId = ctx.settings.get<string>(LAST_PROFILE_SETTING_ID, '');
  const active = profiles.find((profile) => profile.id === lastId) ?? profiles[0];
  const initial = active.name.trim().charAt(0).toUpperCase() || '?';
  return { id: active.id, name: active.name, initial, where: describeProfile(active) };
}

/**
 * Navigates to a screen this chrome file only knows by a hardcoded id
 * belonging to a DIFFERENT lane's not-yet-registered screen module (e.g. the
 * a11y button's Settings fallback, the profile chip's `profiles`). Rather
 * than let that click silently do nothing while the target screen has not
 * landed yet, it reports the honest, real reason instead of pretending the
 * navigation happened.
 */
export function goOrNotify(ctx: AppContext, id: string): void {
  if (shell.screen(id)) {
    shell.go(id);
    return;
  }
  ctx.notify.warn(
    ctx.t('shell.navigate.unavailable.title', 'That destination is not available yet'),
    ctx.t('shell.navigate.unavailable.body', 'No screen is registered under "{id}" yet.', { values: { id } })
  );
}

/* ================================================================== */
/* Screen discovery                                                    */
/* ================================================================== */

function discoverScreens(ctx: AppContext): void {
  const discovered = import.meta.glob<{ default?: ScreenDefinition }>('./screens/*.ts', { eager: true });
  for (const [path, module] of Object.entries(discovered)) {
    const screen = module?.default;
    if (!screen) {
      const reason = 'the file has no default export.';
      console.error(`"${path}" was not registered as a screen: ${reason}`);
      ctx.notify.error(
        ctx.t('shell.screen.registerFailed.title', 'A destination did not load'),
        ctx.t('shell.screen.registerFailed.body', '{path} was skipped: {reason}', { values: { path, reason } })
      );
      continue;
    }
    try {
      shell.register(screen);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      console.error(`"${path}" could not be registered as a screen: ${reason}`);
      ctx.notify.error(
        ctx.t('shell.screen.registerFailed.title', 'A destination did not load'),
        ctx.t('shell.screen.registerFailed.body', '{path} was skipped: {reason}', { values: { path, reason } })
      );
    }
  }
}

/**
 * Real, live keyboard shortcuts for the rail's own destinations, read back
 * from `core/menu.ts`'s shared registry — never a hand-typed chord in the
 * drawer that could drift from what the keyboard actually does. `Settings` is
 * bound to `Ctrl+,` (matching the design's own drawer hint) and every other
 * rail-ordered screen gets `Ctrl+1`, `Ctrl+2`, … in rail order.
 */
function registerHotkeys(railed: ScreenDefinition[]): void {
  let n = 1;
  for (const screen of railed) {
    if (screen.id === 'settings') continue;
    if (n > 9) break;
    try {
      shortcuts.register({ id: `shell.hotkey.${n}`, chord: `Ctrl+${n}`, label: screen.title }, () => shell.go(screen.id));
    } catch (error) {
      console.warn(`Could not register the shell hotkey for "${screen.id}":`, error);
    }
    n += 1;
  }
  const settingsScreen = railed.find((screen) => screen.id === 'settings');
  if (settingsScreen) {
    try {
      shortcuts.register({ id: 'shell.hotkey.settings', chord: 'Ctrl+,', label: settingsScreen.title }, () =>
        shell.go('settings')
      );
    } catch (error) {
      console.warn('Could not register the shell hotkey for "settings":', error);
    }
  }
}

/* ================================================================== */
/* Mounting                                                             */
/* ================================================================== */

/**
 * Builds the whole shell — title bar, navigation rail, screen header and the
 * content region every screen mounts into — and appends it to `root`. Called
 * once from the boot sequence in place of the previous tab-strip chrome.
 */
export function mountShell(root: HTMLElement, ctx: AppContext): void {
  // The shell's own strings. Features get theirs registered during feature
  // discovery; the shell is mounted directly and has no such hook, so it
  // registers here -- before any screen mounts and asks for one.
  ctx.i18n.register(SHELL_STRINGS);

  discoverScreens(ctx);

  root.textContent = '';
  root.className = 'wds-shell';

  const body = el('div', { className: 'wds-body' });

  const drawer = createDrawer(ctx, body);
  const titlebar = mountTitlebar(ctx, drawer);
  const rail = mountRail(ctx);
  const header = mountHeader(ctx);
  const content = el('div', { className: 'wds-content', attrs: { id: 'wds-content' } });

  const main = el('main', { className: 'wds-main' });
  main.append(header, content);

  body.append(rail, main);
  root.append(titlebar, body);

  let disposeCurrent: (() => void) | undefined;
  // Mounting a screen must never re-enter mounting. A screen that navigates or
  // otherwise re-emits during its own `mount` would otherwise loop forever,
  // synchronously, with no exception to surface it -- the exact defect that
  // kept this application on a blank window. `setSubtitle` no longer does that,
  // and this makes the whole class of it impossible rather than trusting every
  // future screen to avoid it.
  let mounting = false;
  const renderActiveScreen = (id: string): void => {
    if (mounting) {
      console.warn(`Ignored a navigation to "${id}" raised while a screen was still mounting.`);
      return;
    }
    if (typeof disposeCurrent === 'function') disposeCurrent();
    content.textContent = '';
    const screen = shell.screen(id);
    if (!screen) {
      content.append(
        components.emptyState({
          title: ctx.t('shell.content.missing.title', 'This destination is not available.'),
          body: ctx.t('shell.content.missing.body', 'Nothing is registered under that id yet.')
        })
      );
      disposeCurrent = undefined;
      return;
    }
    mounting = true;
    try {
      disposeCurrent = screen.mount(content, ctx) ?? undefined;
    } finally {
      mounting = false;
    }
    ctx.settings.set(ACTIVE_SCREEN_SETTING_ID, id);
  };

  shell.onChange(renderActiveScreen);

  const registered = shell.screens();
  const persisted = ctx.settings.get<string>(ACTIVE_SCREEN_SETTING_ID, '');
  const initial =
    registered.find((screen) => screen.id === persisted)?.id ??
    registered.find((screen) => screen.id === 'downloader')?.id ??
    registered[0]?.id ??
    '';

  if (initial) {
    shell.go(initial);
  } else {
    content.append(
      components.emptyState({
        title: ctx.t('shell.content.empty.title', 'No destinations are registered yet.'),
        body: ctx.t('shell.content.empty.body', 'Every screen module lives under shell/screens/. None has been added yet.')
      })
    );
  }

  registerHotkeys(registered.filter((screen) => screen.rail !== undefined));
}
