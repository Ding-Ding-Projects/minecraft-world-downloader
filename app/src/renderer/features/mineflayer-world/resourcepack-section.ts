/**
 * Resource pack requests: accept and decline, honestly, never automatically
 * (row 15.17). Covers `resource_pack.js`.
 *
 * The library's own `resourcePack` event carries its two arguments in a
 * different order depending on server version and which packet triggered it
 * (`add_resource_pack` vs `resource_pack_send`, and whether the server
 * negotiates by UUID or by hash) -- see `lib/plugins/resource_pack.js`. This
 * surface never guesses which positional argument is the URL; it classifies
 * whichever one looks like a URL and labels the other an opaque identifier.
 *
 * `acceptResourcePack`/`denyResourcePack` act on whichever request the
 * library considers most recent; there is no way to target an older one, so
 * the accept/decline buttons always act on "the current request" and the
 * list below is a history, not a set of independently actionable items.
 */

import type { SectionDeps } from './panel';
import { RESOURCE_PACK_ELEMENT, nextRowId } from './model';

interface PackRequest {
  id: string;
  at: number;
  url: string;
  identifier: string;
}

function classify(payload: unknown): { url: string; identifier: string } {
  const args = Array.isArray(payload) ? payload : [payload];
  const strings = args.map((v) => (typeof v === 'string' ? v : v && typeof v === 'object' ? JSON.stringify(v) : String(v ?? '')));
  const url = strings.find((s) => /^https?:\/\//i.test(s)) ?? strings[0] ?? '';
  const identifier = strings.find((s) => s !== url) ?? '';
  return { url, identifier };
}

export function mountResourcePackSection(host: HTMLElement, deps: SectionDeps): () => void {
  const { ctx } = deps;
  host.id = RESOURCE_PACK_ELEMENT;
  host.append(
    ctx.components.sectionHeading({
      title: ctx.t('mineflayerWorld.pack.heading', 'Resource pack requests'),
      description: ctx.t(
        'mineflayerWorld.pack.heading.description',
        'A server can ask the bot to load a resource pack. Nothing here accepts one on your behalf -- every request waits for an explicit choice.'
      )
    })
  );

  let requests: PackRequest[] = [];
  let current: PackRequest | null = null;

  const currentCard = document.createElement('div');
  currentCard.className = 'mineflayer-world-card';
  host.append(currentCard);

  const currentStatus = document.createElement('div');
  currentStatus.setAttribute('role', 'status');
  currentStatus.className = 'md-typescale-body-medium';
  currentCard.append(currentStatus);

  const currentActions = document.createElement('div');
  currentActions.className = 'mineflayer-world-actions';
  currentCard.append(currentActions);

  function renderCurrent(): void {
    currentStatus.replaceChildren();
    if (!current) {
      currentStatus.textContent = ctx.t('mineflayerWorld.pack.none', 'No resource pack has been requested this session.');
      return;
    }
    const p1 = document.createElement('p');
    p1.textContent = ctx.t('mineflayerWorld.pack.requested', 'The server offered: {url}', { values: { url: current.url } });
    const p2 = document.createElement('p');
    p2.className = 'md-typescale-body-small';
    p2.textContent = ctx.t('mineflayerWorld.pack.identifier', 'Identifier: {identifier}', { values: { identifier: current.identifier || '—' } });
    const p3 = document.createElement('p');
    p3.className = 'md-typescale-body-small';
    p3.textContent = ctx.t(
      'mineflayerWorld.pack.explain',
      'Accepting downloads and applies that pack for the bot\'s client-side view of the world (textures, sounds and models). Declining tells the server the bot will keep its default look. Neither choice affects gameplay rules.'
    );
    currentStatus.append(p1, p2, p3);
  }

  renderCurrent();

  currentActions.append(
    ctx.components.button({
      label: ctx.t('mineflayerWorld.pack.accept', 'Accept the current request'),
      icon: 'success',
      variant: 'filled',
      onClick: async () => {
        try {
          await deps.call('acceptResourcePack', []);
          ctx.notify.success(ctx.t('mineflayerWorld.pack.accept', 'Accept the current request'), ctx.t('mineflayerWorld.pack.accepted', 'Accepted.'));
        } catch (error) {
          deps.notifyError(ctx.t('mineflayerWorld.pack.accept', 'Accept the current request'), error);
        }
      }
    }),
    ctx.components.button({
      label: ctx.t('mineflayerWorld.pack.decline', 'Decline the current request'),
      icon: 'close',
      variant: 'outlined',
      onClick: async () => {
        try {
          await deps.call('denyResourcePack', []);
          ctx.notify.info(ctx.t('mineflayerWorld.pack.decline', 'Decline the current request'), ctx.t('mineflayerWorld.pack.declined', 'Declined.'));
        } catch (error) {
          deps.notifyError(ctx.t('mineflayerWorld.pack.decline', 'Decline the current request'), error);
        }
      }
    })
  );

  const table = ctx.components.dataTable<PackRequest>({
    label: ctx.t('mineflayerWorld.pack.history', 'Request history'),
    columns: [
      { id: 'time', label: ctx.t('mineflayerWorld.pack.column.time', 'Time'), value: (r) => new Date(r.at).toLocaleTimeString() },
      { id: 'url', label: ctx.t('mineflayerWorld.pack.column.url', 'URL'), value: (r) => r.url },
      { id: 'identifier', label: ctx.t('mineflayerWorld.pack.column.identifier', 'Identifier'), value: (r) => r.identifier }
    ],
    rows: [],
    rowId: (r) => r.id,
    selectable: true,
    emptyMessage: ctx.t('mineflayerWorld.pack.none', 'No resource pack has been requested this session.')
  });
  host.append(table.root);

  host.append(
    ctx.components.button({
      label: ctx.t('core.action.export', 'Export'),
      icon: 'download',
      variant: 'text',
      onClick: async () => {
        if (requests.length === 0) return;
        const path = await ctx.exporter.save(
          requests.map((r) => ({ at: new Date(r.at).toISOString(), url: r.url, identifier: r.identifier })),
          'csv',
          { name: 'resource-pack-requests', defaultFileName: 'resource-pack-requests.csv' }
        );
        if (path) ctx.notify.success(ctx.t('core.export.saved', 'Exported'), path);
      }
    })
  );

  const unsub = deps.onEvent(['resourcePack'], (_name, payload, at) => {
    const { url, identifier } = classify(payload);
    const request: PackRequest = { id: nextRowId('pack'), at, url, identifier };
    requests = [request, ...requests];
    current = request;
    table.setRows(requests);
    renderCurrent();
    ctx.notify.warn(
      ctx.t('mineflayerWorld.pack.heading', 'Resource pack requests'),
      ctx.t('mineflayerWorld.pack.newRequest', 'The server offered a resource pack. Review it before choosing.')
    );
  });

  return () => {
    unsub();
  };
}
