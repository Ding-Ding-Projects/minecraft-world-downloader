/**
 * The Villager trading tab (row 15.9) — `lib/plugins/villager.js`.
 *
 * Opening a villager's trade window needs `bot.openEntity`/`bot.openVillager`,
 * which take an *entity*; the shared runtime's only window-opening methods,
 * `openContainerAt` and `openBlockAt`, take a *block position*. There is no
 * allow-listed way from this feature's own directory to open a villager's
 * window, read `villager.trades`, or call `bot.trade` — see this feature's
 * documentation and its handoff report for exactly what `../mineflayer`
 * would need to add. What is real and shown below: the bot's own live
 * `entities()` list, filtered to villagers, with real positions and real
 * distances.
 */

import type { TabContext } from '../../core/registry';
import type { NearbyEntity } from './types';
import { activeSession, findNearbyEntities, pollWhile, subscribeSession } from './session';
import { DEFAULT_SEARCH_LIMIT, DEFAULT_SEARCH_RADIUS, POLL_INTERVAL_MS, SEARCH_LIMIT_ID, SEARCH_RADIUS_ID } from './settings';

export function mountVillagersTab(host: HTMLElement, ctx: TabContext): void {
  host.classList.add('mineflayer-inventory-panel');
  host.append(
    ctx.components.topAppBar({
      title: ctx.t('mineflayerInventory.tab.villagers', 'Villager trading'),
      subtitle: ctx.t('mineflayerInventory.tab.villagers.subtitle', 'Trades, uses remaining and disabled reasons')
    })
  );

  const content = document.createElement('div');
  host.append(content);

  let disposed = false;
  let nearby: NearbyEntity[] = [];
  let filtered: NearbyEntity[] = [];

  const search = ctx.createSearchBar({
    label: 'mineflayerInventory.villagers.search',
    sample: '',
    onChange: (query) => {
      filtered = nearby.filter((v) => query.matches(v.displayName) || (v.username !== null && query.matches(v.username)));
      renderContent();
    }
  });
  ctx.onDispose(() => search.destroy());

  async function refresh(): Promise<void> {
    const session = activeSession();
    if (!session || !session.spawned) {
      nearby = [];
      filtered = [];
      return;
    }
    try {
      nearby = await findNearbyEntities(
        session,
        'villager',
        ctx.settings.get<number>(SEARCH_RADIUS_ID, DEFAULT_SEARCH_RADIUS),
        ctx.settings.get<number>(SEARCH_LIMIT_ID, DEFAULT_SEARCH_LIMIT)
      );
      const query = search.query();
      filtered = nearby.filter((v) => query.matches(v.displayName));
    } catch {
      nearby = [];
      filtered = [];
    }
  }

  const stopPoll = pollWhile(async () => {
    if (disposed) return;
    await refresh();
    renderContent();
  }, POLL_INTERVAL_MS);
  const unsubscribe = subscribeSession(() => renderContent());
  ctx.onDispose(() => {
    disposed = true;
    stopPoll();
    unsubscribe();
  });

  function renderContent(): void {
    if (disposed) return;
    content.replaceChildren();

    const session = activeSession();
    if (!session) {
      content.append(
        ctx.components.emptyState({
          title: ctx.t('mineflayerInventory.empty.noBot.title', 'No bot is connected'),
          body: ctx.t('mineflayerInventory.empty.noBot.body', 'Connect a bot from the Bots tab first. This tab drives whichever bot is active there.')
        })
      );
      return;
    }
    if (!session.spawned) {
      content.append(
        ctx.components.emptyState({
          title: ctx.t('mineflayerInventory.empty.notSpawned.title', 'The bot has not spawned into the world yet'),
          body: ctx.t('mineflayerInventory.empty.notSpawned.body', 'Slot data only exists once the bot has spawned. Current status: {status}.', {
            values: { status: session.status }
          })
        })
      );
      return;
    }

    const note = document.createElement('div');
    note.className = 'mineflayer-inventory-capability-note';
    note.append(ctx.components.icon('info', { size: 20 }));
    const noteBody = document.createElement('div');
    const noteTitle = document.createElement('div');
    noteTitle.className = 'md-typescale-title-small';
    noteTitle.textContent = ctx.t('mineflayerInventory.villagers.unavailable.title', 'Trading is not available yet');
    const noteText = document.createElement('div');
    noteText.className = 'md-typescale-body-small';
    noteText.textContent = ctx.t(
      'mineflayerInventory.villagers.unavailable.body',
      'Villagers are entities, and the shared bot runtime currently only opens a window at a block position. Opening a villager\'s trade window, and trading, need a runtime method this feature does not own — see this feature\'s documentation for exactly what is missing. The list above is real: it comes from the bot\'s own live entity list.'
    );
    noteBody.append(noteTitle, noteText);
    note.append(noteBody);
    content.append(note);

    content.append(
      ctx.components.button({
        label: ctx.t('mineflayerInventory.action.refresh', 'Refresh'),
        variant: 'text',
        icon: 'refresh',
        onClick: async () => {
          await refresh();
          renderContent();
        }
      }),
      ctx.components.button({
        label: ctx.t('core.action.export', 'Export'),
        variant: 'text',
        icon: 'download',
        disabled: filtered.length === 0,
        disabledReason: ctx.t('mineflayerInventory.villagers.none', 'No villager was found within {radius} blocks.', {
          values: { radius: ctx.settings.get<number>(SEARCH_RADIUS_ID, DEFAULT_SEARCH_RADIUS) }
        }),
        onClick: async () => {
          const rows = filtered.map((v) => ({
            id: v.id,
            displayName: v.displayName,
            username: v.username,
            distance: v.distance,
            ...(v.position ?? { x: null, y: null, z: null })
          }));
          const path = await ctx.exporter.save(rows, 'json', { name: 'nearby-villagers', defaultFileName: 'nearby-villagers.json' });
          if (path) ctx.notify.success(ctx.t('core.export.saved', 'Saved to {path}', { values: { path } }));
        }
      })
    );

    const wrap = document.createElement('div');
    wrap.className = 'mineflayer-inventory-section';
    wrap.append(ctx.components.sectionHeading({ title: ctx.t('mineflayerInventory.villagers.nearbyLabel', 'Nearby villagers') }));
    wrap.append(search.root);

    if (filtered.length === 0) {
      wrap.append(
        ctx.components.emptyState({
          title: ctx.t('mineflayerInventory.villagers.none', 'No villager was found within {radius} blocks.', {
            values: { radius: ctx.settings.get<number>(SEARCH_RADIUS_ID, DEFAULT_SEARCH_RADIUS) }
          })
        })
      );
    } else {
      const list = ctx.components.list({ label: ctx.t('mineflayerInventory.villagers.nearbyLabel', 'Nearby villagers') });
      list.classList.add('mineflayer-inventory-nearby-list');
      for (const villager of filtered) {
        list.append(
          ctx.components.listItem({
            headline: villager.displayName,
            supporting: ctx.t('mineflayerInventory.villagers.distance', '{distance} blocks away', {
              values: { distance: Number.isFinite(villager.distance) ? Math.round(villager.distance) : '—' }
            })
          })
        );
      }
      wrap.append(list);
    }

    content.append(wrap);
  }

  void refresh().then(renderContent);
  renderContent();
}
