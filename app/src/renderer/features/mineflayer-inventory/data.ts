/**
 * The bundled recipe catalog.
 *
 * `data/items.ts` and `data/recipes.ts` are generated data, not hand-written:
 * produced once, offline, by running the vendored
 * `prismarine-recipe`/`prismarine-registry` packages already in
 * `app/node_modules` against Minecraft Java Edition 1.21.8 — the *real*
 * library algorithm for `delta` and `requiresTable`, not a reimplementation
 * of it. (They are plain `.ts` modules rather than `.json` imports only
 * because `tsconfig.web.json`'s `include` list — a file this feature does not
 * own — does not currently glob `.json`; see this feature's handoff report.)
 *
 * Everything here is keyed by item **name** (`oak_planks`), never by the
 * numeric id `serializeItem` also reports — numeric item ids are not stable
 * across Minecraft versions, but names are, and the bot's own live registry
 * (whatever version it actually connected with) resolves names for every RPC
 * call this feature makes. A recipe that only exists on a newer or older
 * server than the one bundled here still shows up in the browser; asking the
 * bot to craft it is what tells you honestly whether *this* server has it,
 * through the real error the runtime's `itemTypeOrFail` produces.
 *
 * No network request is ever made for any of this. It ships in the app.
 */

import itemsData from './data/items';
import recipesData from './data/recipes';
import type { CatalogItem, RecipeCatalog, RecipeVariant } from './types';

export const CATALOG_VERSION: string = recipesData.version;

const ITEMS: CatalogItem[] = itemsData;
const RECIPES: Record<string, RecipeVariant[]> = recipesData.recipes;

const itemsByName = new Map<string, CatalogItem>();
for (const item of ITEMS) itemsByName.set(item.name, item);

export function allCatalogItems(): CatalogItem[] {
  return ITEMS;
}

export function catalogItem(name: string): CatalogItem | null {
  return itemsByName.get(name) ?? null;
}

export function displayNameFor(name: string): string {
  return itemsByName.get(name)?.displayName ?? name;
}

/** Every result item name that has at least one bundled recipe, sorted by display name. */
export function recipeResultNames(): string[] {
  return Object.keys(RECIPES).sort((a, b) => displayNameFor(a).localeCompare(displayNameFor(b)));
}

export function recipesFor(resultName: string): RecipeVariant[] {
  return RECIPES[resultName] ?? [];
}

/**
 * Every result item name whose recipe list mentions `ingredientName` as an
 * ingredient in at least one variant — the "searchable by ingredient" half of
 * the browser.
 */
const ingredientIndex = new Map<string, Set<string>>();
for (const [resultName, variants] of Object.entries(RECIPES)) {
  for (const variant of variants) {
    for (const ingredient of variant.ingredients) {
      let set = ingredientIndex.get(ingredient.name);
      if (!set) {
        set = new Set();
        ingredientIndex.set(ingredient.name, set);
      }
      set.add(resultName);
    }
  }
}

export function resultsUsingIngredient(ingredientName: string): string[] {
  return [...(ingredientIndex.get(ingredientName) ?? [])].sort((a, b) => displayNameFor(a).localeCompare(displayNameFor(b)));
}

/** A single lower-cased haystack — display name, raw name, and every ingredient's names — for one result item, for the search bar. */
export function searchHaystack(resultName: string): string {
  const item = itemsByName.get(resultName);
  const variants = RECIPES[resultName] ?? [];
  const ingredientNames = new Set<string>();
  for (const variant of variants) {
    for (const ingredient of variant.ingredients) {
      ingredientNames.add(ingredient.name);
      ingredientNames.add(displayNameFor(ingredient.name));
    }
  }
  return [resultName, item?.displayName ?? resultName, ...ingredientNames].join(' ').toLowerCase();
}
