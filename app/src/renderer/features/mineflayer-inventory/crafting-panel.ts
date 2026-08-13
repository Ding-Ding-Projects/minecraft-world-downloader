/**
 * The Crafting tab (row 15.7) — a recipe browser over the bundled catalog
 * (`data.ts`), with every craftability check and the actual craft run through
 * `lib/plugins/craft.js`'s `bot.craft`/`bot.recipesFor`.
 */

import type { TabContext } from '../../core/registry';
import type { SerializedWindow, NearbyBlock, RecipeVariant } from './types';
import { CRAFTING_TABLE_BLOCK_NAMES } from './types';
import { catalogItem, recipeResultNames, recipesFor, searchHaystack, CATALOG_VERSION } from './data';
import { renderItemGlyph } from './item-view';
import { activeSession, describeCallError, fetchInventory, findNearbyBlocks, pollWhile, subscribeSession, type ActiveSession } from './session';
import { DEFAULT_SEARCH_RADIUS, POLL_INTERVAL_MS, SEARCH_RADIUS_ID } from './settings';

const MAX_VISIBLE_RESULTS = 48;

export function mountCraftingTab(host: HTMLElement, ctx: TabContext): void {
  host.classList.add('mineflayer-inventory-panel');
  host.append(
    ctx.components.topAppBar({
      title: ctx.t('mineflayerInventory.tab.crafting', 'Crafting'),
      subtitle: ctx.t('mineflayerInventory.tab.crafting.subtitle', 'Search recipes by result or ingredient; craft what the inventory can really make')
    })
  );

  const content = document.createElement('div');
  host.append(content);

  let disposed = false;
  let inventoryCounts = new Map<string, number>();
  let nearbyTable: NearbyBlock | null = null;
  let allResults = recipeResultNames();
  let filteredResults = allResults;
  let busy = false;

  const search = ctx.createSearchBar({
    label: 'mineflayerInventory.crafting.search',
    sample: allResults.map((name) => catalogItem(name)?.displayName ?? name).join('\n'),
    onChange: (query) => {
      filteredResults = allResults.filter((name) => query.matches(searchHaystack(name)));
      renderContent();
    }
  });
  ctx.onDispose(() => search.destroy());

  async function refreshLiveState(session: ActiveSession): Promise<void> {
    try {
      const win: SerializedWindow = await fetchInventory(session);
      const counts = new Map<string, number>();
      for (const item of win.slots) {
        if (!item) continue;
        counts.set(item.name, (counts.get(item.name) ?? 0) + item.count);
      }
      inventoryCounts = counts;
    } catch {
      /* keep the previous snapshot; the panel still shows it with a stale note via the next successful poll */
    }
    try {
      const tables = await findNearbyBlocks(
        session,
        CRAFTING_TABLE_BLOCK_NAMES,
        ctx.settings.get<number>(SEARCH_RADIUS_ID, DEFAULT_SEARCH_RADIUS),
        1
      );
      nearbyTable = tables[0] ?? null;
    } catch {
      nearbyTable = null;
    }
  }

  const stopPoll = pollWhile(
    async () => {
      if (disposed) return;
      const session = activeSession();
      if (!session || !session.spawned) return;
      await refreshLiveState(session);
      renderContent();
    },
    POLL_INTERVAL_MS
  );
  const unsubscribe = subscribeSession(() => renderContent());
  ctx.onDispose(() => {
    disposed = true;
    stopPoll();
    unsubscribe();
  });

  function haveCount(itemName: string): number {
    return inventoryCounts.get(itemName) ?? 0;
  }

  function missingFor(variant: RecipeVariant, times: number): Array<{ name: string; short: number }> {
    const out: Array<{ name: string; short: number }> = [];
    for (const ingredient of variant.ingredients) {
      const needed = ingredient.count * times;
      const have = haveCount(ingredient.name);
      if (have < needed) out.push({ name: ingredient.name, short: needed - have });
    }
    return out;
  }

  function craftableNow(variant: RecipeVariant, times: number): boolean {
    if (variant.requiresTable && !nearbyTable) return false;
    return missingFor(variant, times).length === 0;
  }

  async function runCraft(resultName: string, variant: RecipeVariant, times: number): Promise<void> {
    const session = activeSession();
    if (!session) return;
    busy = true;
    renderContent();
    try {
      const args: unknown[] = [resultName, times];
      if (variant.requiresTable && nearbyTable) args.push(nearbyTable.position);
      await session.call('craft', args);
      ctx.notify.success(
        ctx.t('mineflayerInventory.crafting.craftSuccess', 'Crafted {count} × {name}.', {
          values: { count: times, name: catalogItem(resultName)?.displayName ?? resultName }
        })
      );
      await ctx.history.record(`Crafted ${times} × ${resultName}`, 'mineflayer-inventory', { resultName, times });
      await refreshLiveState(session);
    } catch (error) {
      ctx.notify.error(
        ctx.t('mineflayerInventory.crafting.craftFailed', 'Crafting {name} failed: {error}', {
          values: { name: catalogItem(resultName)?.displayName ?? resultName, error: describeCallError(error) }
        })
      );
    }
    busy = false;
    renderContent();
  }

  function recipeCard(resultName: string, session: ActiveSession | null): HTMLElement {
    const item = catalogItem(resultName);
    const variants = recipesFor(resultName);
    const card = ctx.components.card({ variant: 'outlined' });
    card.classList.add('mineflayer-inventory-recipe-card');

    const header = document.createElement('div');
    header.className = 'mineflayer-inventory-toolbar';
    header.append(renderItemGlyph({ name: resultName, displayName: item?.displayName ?? resultName, count: 1, slot: -1, type: -1, metadata: null, durabilityUsed: null, maxDurability: null, enchants: [] }));
    const title = document.createElement('span');
    title.className = 'md-typescale-title-medium';
    title.textContent = item?.displayName ?? resultName;
    header.append(title);
    card.append(header);

    let variantIndex = 0;
    let times = 1;

    const variantPicker =
      variants.length > 1
        ? ctx.components.select({
            label: ctx.t('mineflayerInventory.crafting.variantLabel', 'Variant {index} of {total}', { values: { index: 1, total: variants.length } }),
            options: variants.map((_, i) => ({
              value: String(i),
              label: ctx.t('mineflayerInventory.crafting.variantLabel', 'Variant {index} of {total}', { values: { index: i + 1, total: variants.length } })
            })),
            value: '0',
            onChange: (value) => {
              variantIndex = Number.parseInt(value, 10) || 0;
              rerenderVariant();
            }
          })
        : null;
    if (variantPicker) card.append(variantPicker.root);

    const variantBody = document.createElement('div');
    variantBody.className = 'mineflayer-inventory-recipe-ingredients';
    card.append(variantBody);

    const countField = ctx.components.textField({
      label: ctx.t('mineflayerInventory.crafting.craftCount', 'How many to craft'),
      type: 'number',
      value: '1',
      min: 1,
      max: 64,
      onChange: (value) => {
        const parsed = Number.parseInt(value, 10);
        times = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
        rerenderVariant();
      }
    });
    card.append(countField.root);

    const actions = document.createElement('div');
    actions.className = 'mineflayer-inventory-toolbar';
    card.append(actions);

    function rerenderVariant(): void {
      variantBody.replaceChildren();
      const variant = variants[variantIndex];
      const requiresLabel = document.createElement('div');
      requiresLabel.className = 'md-typescale-label-medium';
      requiresLabel.textContent = variant.requiresTable
        ? nearbyTable
          ? ctx.t('mineflayerInventory.crafting.requiresTable', 'Needs a crafting table')
          : ctx.t('mineflayerInventory.crafting.needsTableNearby', 'Needs a crafting table — none was found within {radius} blocks.', {
              values: { radius: ctx.settings.get<number>(SEARCH_RADIUS_ID, DEFAULT_SEARCH_RADIUS) }
            })
        : ctx.t('mineflayerInventory.crafting.noTable', 'No table needed');
      variantBody.append(requiresLabel);

      for (const ingredient of variant.ingredients) {
        const row = document.createElement('div');
        row.className = 'mineflayer-inventory-recipe-ingredient-row md-typescale-body-medium';
        const have = haveCount(ingredient.name);
        const needed = ingredient.count * times;
        const ingredientItem = catalogItem(ingredient.name);
        const label = document.createElement('span');
        label.textContent = `${ingredientItem?.displayName ?? ingredient.name} ×${needed}`;
        const status = document.createElement('span');
        status.textContent = `${have}/${needed}`;
        if (have < needed) status.classList.add('mineflayer-inventory-recipe-ingredient-short');
        row.append(label, status);
        variantBody.append(row);
      }

      const canCraft = craftableNow(variant, times) && session?.spawned === true && !busy;
      const outputNote = document.createElement('div');
      outputNote.className = 'md-typescale-body-small';
      outputNote.textContent = `= ${variant.resultCount * times} ${item?.displayName ?? resultName}`;
      variantBody.append(outputNote);

      actions.replaceChildren(
        ctx.components.badge({
          label: canCraft
            ? ctx.t('mineflayerInventory.crafting.craftableNow', 'Craftable right now')
            : ctx.t('mineflayerInventory.crafting.missingIngredients', 'Missing: {list}', {
                values: { list: missingFor(variant, times).map((m) => `${catalogItem(m.name)?.displayName ?? m.name} ×${m.short}`).join(', ') }
              }),
          severity: canCraft ? 'success' : 'warning'
        }),
        ctx.components.button({
          label: ctx.t('mineflayerInventory.crafting.craftAction', 'Craft'),
          variant: 'filled',
          disabled: !canCraft,
          disabledReason: session?.spawned !== true
            ? ctx.t('mineflayerInventory.disabled.notReady', 'The active bot is not spawned into the world right now, so nothing here can be moved.')
            : busy
              ? ctx.t('mineflayerInventory.disabled.actionPending', 'Another action on this window is still in flight — wait for it to finish before starting another.')
              : ctx.t('mineflayerInventory.crafting.missingIngredients', 'Missing: {list}', {
                  values: { list: missingFor(variant, times).map((m) => `${catalogItem(m.name)?.displayName ?? m.name} ×${m.short}`).join(', ') }
                }),
          onClick: () => void runCraft(resultName, variant, times)
        })
      );
    }

    rerenderVariant();
    return card;
  }

  function renderContent(): void {
    if (disposed) return;
    content.replaceChildren();

    content.append(search.root);
    content.append(
      ctx.components.button({
        label: ctx.t('core.action.export', 'Export'),
        variant: 'text',
        icon: 'download',
        disabled: filteredResults.length === 0,
        disabledReason: ctx.t('mineflayerInventory.crafting.noResults', 'No bundled recipe matches that search.'),
        onClick: async () => {
          const rows = filteredResults.map((resultName) => {
            const variants = recipesFor(resultName);
            const first = variants[0];
            return {
              name: resultName,
              displayName: catalogItem(resultName)?.displayName ?? resultName,
              variantCount: variants.length,
              requiresTable: first?.requiresTable ?? false,
              craftableNow: first ? craftableNow(first, 1) : false,
              ingredients: (first?.ingredients ?? []).map((i) => `${i.name} x${i.count}`).join(', ')
            };
          });
          const path = await ctx.exporter.save(rows, 'json', { name: 'recipe-search', defaultFileName: 'recipe-search.json' });
          if (path) ctx.notify.success(ctx.t('core.export.saved', 'Saved to {path}', { values: { path } }));
        }
      })
    );
    const note = document.createElement('p');
    note.className = 'md-typescale-body-small';
    note.textContent = ctx.t(
      'mineflayerInventory.crafting.catalogNote',
      'Recipes are read from a bundled Minecraft {version} snapshot, and never over the network. Craftability and every count shown are checked against the real, live inventory of the connected bot.',
      { values: { version: CATALOG_VERSION } }
    );
    content.append(note);
    const variantNote = document.createElement('p');
    variantNote.className = 'md-typescale-body-small';
    variantNote.textContent = ctx.t(
      'mineflayerInventory.crafting.craftVariantNote',
      'The bot crafts using whichever real recipe variant it finds it can complete, checked at the moment you craft — it may not always be the exact variant shown here if more than one exists.'
    );
    content.append(variantNote);

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

    if (filteredResults.length === 0) {
      content.append(ctx.components.emptyState({ title: ctx.t('mineflayerInventory.crafting.noResults', 'No bundled recipe matches that search.') }));
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'mineflayer-inventory-recipe-grid';
    for (const resultName of filteredResults.slice(0, MAX_VISIBLE_RESULTS)) {
      grid.append(recipeCard(resultName, session));
    }
    content.append(grid);
    if (filteredResults.length > MAX_VISIBLE_RESULTS) {
      const more = document.createElement('p');
      more.className = 'md-typescale-body-small';
      more.textContent = ctx.t('mineflayerInventory.crafting.moreResults', '{count} more match — refine the search to narrow it down.', {
        values: { count: filteredResults.length - MAX_VISIBLE_RESULTS }
      });
      content.append(more);
    }
  }

  renderContent();
}
