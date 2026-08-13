/**
 * The Format catalog tab: inventory rows 11.1 and 11.2.
 *
 * Every category gets its own heading, its own description and its own search
 * bar wired to the full regex builder — never one shared search silently
 * applying to whichever category was last touched. Every route in every
 * category is listed, whether or not it can run right now; a route that
 * cannot run is shown disabled with the exact missing dependency named,
 * rather than being left out of the list.
 */

import { ADAPTERS, adaptersInCategory, availabilityOf, routeLabel, adapterRecords, type AdapterSpec } from './adapters';
import { CATEGORIES, CATEGORY_IDS, type CategoryId } from './formats';
import { el } from '../../core/a11y';
import type { AppContext, SearchQuery, TabContext } from '../../core/registry';

function statusLabel(ctx: AppContext, adapter: AdapterSpec): string {
  const availability = availabilityOf(adapter);
  return availability.available
    ? ctx.t('converter.catalog.enabled', 'Enabled')
    : ctx.t('converter.catalog.disabled', 'Disabled');
}

function lossinessLabel(ctx: AppContext, adapter: AdapterSpec): string {
  const key = `converter.catalog.lossiness.${adapter.lossiness}`;
  return ctx.t(key, adapter.lossiness);
}

function searchableText(ctx: AppContext, adapter: AdapterSpec): string {
  const availability = availabilityOf(adapter);
  const reason = availability.available ? '' : ctx.t(availability.reasonKey, availability.reasonKey, { values: availability.reasonValues });
  return [
    routeLabel(adapter, (key, fallback) => ctx.t(key, fallback)),
    adapter.id,
    adapter.sourceFormats.join(' '),
    adapter.targetFormat,
    adapter.category,
    statusLabel(ctx, adapter),
    lossinessLabel(ctx, adapter),
    ctx.t(adapter.sandboxKey, adapter.sandboxKey),
    ctx.t(adapter.validatorKey, adapter.validatorKey),
    reason
  ].join(' ');
}

function categorySection(host: HTMLElement, ctx: TabContext, category: CategoryId): void {
  const spec = CATEGORIES[category];
  const rows = adaptersInCategory(category);

  const section = el('section', {
    className: 'converter-catalog-section',
    attrs: { 'data-appearance-id': `converter.catalog.${category}` }
  });
  section.append(
    ctx.components.sectionHeading({
      title: spec.labelKey,
      description: spec.descriptionKey
    })
  );

  const search = ctx.createSearchBar({
    label: 'converter.catalog.search',
    sample: rows.map((adapter) => searchableText(ctx, adapter)).join('\n'),
    onChange: (query: SearchQuery) => {
      table.setRows(rows.filter((adapter) => query.matches(searchableText(ctx, adapter))));
    }
  });
  ctx.onDispose(() => search.destroy());
  section.append(search.root);

  const table = ctx.components.dataTable<AdapterSpec>({
    label: spec.labelKey,
    rowId: (adapter) => adapter.id,
    rows,
    emptyMessage: 'converter.catalog.noMatches',
    columns: [
      { id: 'route', label: 'converter.catalog.column.route', value: (a) => routeLabel(a, (k, f) => ctx.t(k, f)) },
      {
        id: 'status',
        label: 'converter.catalog.column.status',
        render: (adapter) => {
          const availability = availabilityOf(adapter);
          return ctx.components.badge({
            label: statusLabel(ctx, adapter),
            severity: availability.available ? 'success' : 'warning'
          });
        }
      },
      { id: 'lossiness', label: 'converter.catalog.column.lossiness', value: (a) => lossinessLabel(ctx, a) },
      { id: 'sandbox', label: 'converter.catalog.column.sandbox', value: (a) => ctx.t(a.sandboxKey, a.sandboxKey) },
      { id: 'validator', label: 'converter.catalog.column.validator', value: (a) => ctx.t(a.validatorKey, a.validatorKey) },
      {
        id: 'reason',
        label: 'converter.catalog.column.reason',
        value: (adapter) => {
          const availability = availabilityOf(adapter);
          return availability.available ? '' : ctx.t(availability.reasonKey, availability.reasonKey, { values: availability.reasonValues });
        }
      }
    ]
  });
  section.append(table.root);

  host.append(section);
}

export function mountCatalogTab(host: HTMLElement, ctx: TabContext): void {
  host.append(
    ctx.components.topAppBar({
      title: 'converter.tab.catalog',
      subtitle: 'converter.catalog.subtitle',
      actions: [
        ctx.components.button({
          label: 'converter.catalog.export',
          variant: 'text',
          icon: 'download',
          onClick: async () => {
            const records = adapterRecords((key, fallback) => ctx.t(key, fallback));
            const path = await ctx.exporter.save(records, 'csv', {
              name: 'converter-catalog',
              defaultFileName: 'converter-format-catalog.csv'
            });
            if (path) ctx.notify.success('converter.notify.saved', ctx.t('converter.notify.saved', 'Saved to {path}.', { values: { path } }));
          }
        })
      ]
    })
  );

  // A count so the tab is honest about scale rather than implying "a handful"
  // when the registry actually holds dozens of routes.
  const total = ADAPTERS.length;
  const enabled = ADAPTERS.filter((adapter) => availabilityOf(adapter).available).length;
  const summary = el('p', {
    className: 'converter-catalog-summary md-typescale-body-medium',
    text: `${enabled} / ${total} ${ctx.t('converter.catalog.enabled', 'enabled').toLowerCase()}`
  });
  host.append(summary);

  const list = el('div', { className: 'converter-catalog-list' });
  for (const category of CATEGORY_IDS) categorySection(list, ctx, category);
  host.append(list);
}
