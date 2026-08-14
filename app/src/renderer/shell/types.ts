import type { AppContext } from '../core/types';

/**
 * The shell contract.
 *
 * A screen is one destination in the navigation rail (or reachable only from the
 * drawer, when `rail` is left unset): "Downloader", "Profiles", "Hosts",
 * "Services", "Other", "Settings", and the elevated-but-not-railed "Live map",
 * "Bot runner" and "Version history". A screen module lives at
 * `shell/screens/<id>.ts` and exports one `ScreenDefinition` as its default
 * export; `shell/index.ts` discovers every file under `./screens/*.ts` the same
 * way `main.ts` discovers each feature's `index.ts` under `./features`, so
 * adding a screen is adding one file and touching nothing else here.
 */

export interface ScreenDefinition {
  /** Stable, unique id: 'downloader' | 'profiles' | 'hosts' | 'services' | 'other' | 'settings' | 'map' | 'bot' | 'history'. */
  id: string;
  /** i18n key, rendered by the screen header. */
  title: string;
  /** i18n key, rendered under the title beside the live dot. */
  subtitle?: string;
  /** Key into core/icons.ts. */
  icon: string;
  /** If set, appears in the navigation rail at this order. Omit to keep a screen drawer-only. */
  rail?: number;
  /** Builds the screen's content into `host`. Return a dispose function to release listeners and timers when another screen replaces it. */
  mount(host: HTMLElement, ctx: AppContext): void | (() => void);
}

export interface ShellApi {
  register(screen: ScreenDefinition): void;
  screens(): ScreenDefinition[];
  go(id: string, params?: Record<string, string>): void;
  params(): Record<string, string>;
  current(): string;
  onChange(listener: (id: string) => void): () => void;
  /** Live subtitle, e.g. "3 profiles on this machine". Overrides the screen's declared subtitle for the header while it stays current. */
  setSubtitle(id: string, text: string): void;
}
