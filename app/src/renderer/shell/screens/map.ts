import './map.css';

import { el } from '../../core/a11y';
import type { AppContext, TabContext } from '../../core/registry';
import { mountMapTab } from '../../features/map/panel';
import { mountWorldVaultEditTab } from '../../features/world-vault-edit/panel';
import type { ScreenDefinition } from '../types';

/**
 * The "Live map" destination (design lines 851-878, elevated but not railed
 * per `shell/types.ts`'s own docstring).
 *
 * This screen contributes no map-drawing or chunk-editing logic of its own.
 * Both halves are the real, already-built features — `features/map/panel.ts`
 * (the pannable/zoomable tile viewport, the follow toggle, the zoom and
 * centre actions, the live coordinate readout) and
 * `features/world-vault-edit/panel.ts` (the real chunk-occupancy grid a
 * selection is made on, with copy and remove actions gated on the world
 * vault's own permission check) — mounted directly into this screen's
 * content host. Each already renders its own heading, live status and
 * actions, so this file only supplies the shell wiring: a synthetic
 * `TabContext` for each (matching the exact shape `core/tabs.ts` builds for
 * an ordinary tab — those panels never read `ctx.tabId`, so any stable
 * string is safe here) and a divider between the two.
 */

/** Builds the `TabContext` a tab-shaped panel expects, collecting whatever it registers via `onDispose`. */
function asTabContext(ctx: AppContext, tabId: string, disposers: Array<() => void>): TabContext {
  return {
    ...ctx,
    tabId,
    onDispose: (fn: () => void) => {
      disposers.push(fn);
    }
  };
}

function runDisposers(disposers: Array<() => void>): void {
  for (const dispose of disposers) {
    try {
      dispose();
    } catch (error) {
      console.error('Disposing the live map screen threw:', error);
    }
  }
}

const screen: ScreenDefinition = {
  id: 'map',
  // Reusing the map feature's own already-registered, already-localized key
  // rather than inventing a new one: a screen module has no `strings`
  // catalogue of its own to register a fresh key into, and the header
  // resolves `screen.title` with the key itself as the fallback (see
  // `shell/header.ts`), so an unregistered key would render literally.
  title: 'map.tab',
  subtitle: 'map.tab.subtitle',
  icon: 'map',
  mount(host, ctx) {
    host.classList.add('wds-screen-map');
    const disposers: Array<() => void> = [];

    const mapHost = el('div', { className: 'wds-screen-map__section' });
    host.append(mapHost);
    mountMapTab(mapHost, asTabContext(ctx, 'shell.map.viewer', disposers));

    host.append(ctx.components.divider());

    const editHost = el('div', { className: 'wds-screen-map__section' });
    host.append(editHost);
    mountWorldVaultEditTab(editHost, asTabContext(ctx, 'shell.map.chunkEdit', disposers));

    return () => runDisposers(disposers);
  }
};

export default screen;
