/**
 * Nearby entities: type, name, distance, health, equipment, attack, mount,
 * dismount and use-on (row 15.12). Covers `entities.js`.
 *
 * The host's `entities` method never reports a distance (see
 * `docs/features/mineflayer-world.md` for the exact gap), so distance is
 * computed here from the bot's own live position and each entity's real
 * position rather than trusting a field that does not exist.
 */

import type { SectionDeps } from './panel';
import {
  CONFIRM_MOB_ATTACKS_ID,
  DEFAULTS,
  ENTITIES_ELEMENT,
  ENTITY_POLL_MS_ID,
  distance3,
  normaliseEntity,
  type WorldEntity
} from './model';

interface EntityRow extends WorldEntity {
  distance: number | null;
}

export function mountEntitiesSection(host: HTMLElement, deps: SectionDeps): () => void {
  const { ctx } = deps;
  host.id = ENTITIES_ELEMENT;
  host.append(
    ctx.components.sectionHeading({
      title: ctx.t('mineflayerWorld.entities.heading', 'Nearby entities'),
      description: ctx.t(
        'mineflayerWorld.entities.heading.description',
        'Every entity the bot currently tracks, refreshed on a timer. Attacking a player is gated by a confirmation naming them, because that is a consequential action against another person.'
      )
    })
  );

  let rows: EntityRow[] = [];
  let visibleRows: EntityRow[] = [];

  const table = ctx.components.dataTable<EntityRow>({
    label: ctx.t('mineflayerWorld.entities.heading', 'Nearby entities'),
    columns: [
      { id: 'name', label: ctx.t('mineflayerWorld.entities.column.name', 'Name'), sortable: true, value: (r) => r.username ?? r.displayName },
      { id: 'type', label: ctx.t('mineflayerWorld.entities.column.type', 'Type'), sortable: true, value: (r) => r.type },
      {
        id: 'distance',
        label: ctx.t('mineflayerWorld.entities.column.distance', 'Distance'),
        align: 'end',
        sortable: true,
        value: (r) => (r.distance === null ? Number.POSITIVE_INFINITY : r.distance),
        render: (r) => (r.distance === null ? '—' : `${r.distance.toFixed(1)} m`)
      },
      {
        id: 'health',
        label: ctx.t('mineflayerWorld.entities.column.health', 'Health'),
        align: 'end',
        value: (r) => (r.health === null ? '—' : r.health.toFixed(1))
      },
      {
        id: 'equipment',
        label: ctx.t('mineflayerWorld.entities.column.equipment', 'Equipment'),
        value: (r) => (r.equipment.length === 0 ? '—' : r.equipment.map((i) => i.displayName).join(', '))
      }
    ],
    rows: [],
    rowId: (r) => String(r.id),
    selectable: true,
    emptyMessage: ctx.t('mineflayerWorld.entities.empty', 'No entities are currently tracked nearby.')
  });

  const search = ctx.createSearchBar({
    label: ctx.t('mineflayerWorld.entities.search', 'Filter entities'),
    sample: '',
    onChange: (query) => {
      visibleRows = rows.filter((r) => query.matches(r.displayName) || query.matches(r.type) || query.matches(r.username ?? ''));
      table.setRows(visibleRows);
    }
  });
  host.append(search.root, table.root);

  const rowActions = document.createElement('div');
  rowActions.className = 'mineflayer-world-inline';
  host.append(rowActions);

  const targetSelect = ctx.components.select({
    label: ctx.t('mineflayerWorld.entities.singleTarget', 'Act on'),
    options: [{ value: '', label: ctx.t('mineflayerWorld.entities.pickOne', 'Pick an entity above') }],
    value: ''
  });
  rowActions.append(targetSelect.root);

  function refreshTargetOptions(): void {
    const options = [
      { value: '', label: ctx.t('mineflayerWorld.entities.pickOne', 'Pick an entity above') },
      ...rows.map((r) => ({ value: String(r.id), label: r.username ?? `${r.displayName} (#${r.id})` }))
    ];
    const fresh = ctx.components.select({ label: ctx.t('mineflayerWorld.entities.singleTarget', 'Act on'), options, value: '' });
    targetSelectRef.current.root.replaceWith(fresh.root);
    targetSelectRef.current = fresh;
  }
  const targetSelectRef = { current: targetSelect };

  async function confirmIfPlayer(target: EntityRow, anchor: HTMLElement): Promise<boolean> {
    if (!target.username) return true;
    return ctx.confirm.request({
      action: ctx.t('mineflayerWorld.entities.confirmAttack', 'Attack the player {name}', { values: { name: target.username } }),
      affected: [target.username],
      irreversible: ctx.t(
        'mineflayerWorld.entities.confirmAttackBody',
        'The bot will swing at and damage this player in the running game. This cannot be undone once it lands.'
      ),
      anchor
    });
  }

  rowActions.append(
    ctx.components.button({
      label: ctx.t('mineflayerWorld.entities.attack', 'Attack'),
      icon: 'bolt',
      danger: true,
      variant: 'filled',
      onClick: async (event) => {
        const id = Number(targetSelectRef.current.get());
        const target = rows.find((r) => r.id === id);
        if (!target) return;
        const anchor = event.currentTarget as HTMLElement;
        const requireConfirm = target.username !== null || ctx.settings.get<boolean>(CONFIRM_MOB_ATTACKS_ID, DEFAULTS.confirmMobAttacks);
        if (requireConfirm) {
          const ok = target.username
            ? await confirmIfPlayer(target, anchor)
            : await ctx.confirm.request({
                action: ctx.t('mineflayerWorld.entities.confirmAttackMob', 'Attack {name}', { values: { name: target.displayName } }),
                affected: [target.displayName],
                irreversible: ctx.t('mineflayerWorld.entities.confirmAttackMobBody', 'The bot will swing at and damage this entity.'),
                anchor
              });
          if (!ok) return;
        }
        try {
          await deps.call('attack', [target.id]);
        } catch (error) {
          deps.notifyError(ctx.t('mineflayerWorld.entities.attack', 'Attack'), error);
        }
      }
    }),
    ctx.components.button({
      label: ctx.t('mineflayerWorld.entities.useOn', 'Use on (right-click)'),
      variant: 'tonal',
      onClick: async () => {
        const id = Number(targetSelectRef.current.get());
        if (!Number.isFinite(id)) return;
        try {
          await deps.call('useOn', [id]);
        } catch (error) {
          deps.notifyError(ctx.t('mineflayerWorld.entities.useOn', 'Use on'), error);
        }
      }
    }),
    ctx.components.button({
      label: ctx.t('mineflayerWorld.entities.mount', 'Mount'),
      variant: 'outlined',
      onClick: async () => {
        const id = Number(targetSelectRef.current.get());
        if (!Number.isFinite(id)) return;
        try {
          await deps.call('mount', [id]);
        } catch (error) {
          deps.notifyError(ctx.t('mineflayerWorld.entities.mount', 'Mount'), error);
        }
      }
    }),
    ctx.components.button({
      label: ctx.t('mineflayerWorld.entities.dismount', 'Dismount'),
      variant: 'outlined',
      onClick: async () => {
        try {
          await deps.call('dismount', []);
          ctx.notify.info(
            ctx.t('mineflayerWorld.entities.dismount', 'Dismount'),
            ctx.t(
              'mineflayerWorld.entities.dismountNote',
              'The library reports "not mounted" as an event rather than an error, so check the event inspector if nothing seemed to happen.'
            )
          );
        } catch (error) {
          deps.notifyError(ctx.t('mineflayerWorld.entities.dismount', 'Dismount'), error);
        }
      }
    })
  );

  /* ---------------- bulk attack ---------------- */

  const bulkActions = document.createElement('div');
  bulkActions.className = 'mineflayer-world-actions';
  host.append(bulkActions);
  bulkActions.append(
    ctx.components.button({
      label: ctx.t('mineflayerWorld.entities.selectShown', 'Select all shown'),
      variant: 'text',
      onClick: () => table.setSelection(visibleRows.map((r) => String(r.id)))
    }),
    ctx.components.button({
      label: ctx.t('mineflayerWorld.entities.selectAll', 'Select every tracked entity'),
      variant: 'text',
      onClick: () => {
        search.clear();
        table.setSelection(rows.map((r) => String(r.id)));
      }
    }),
    ctx.components.button({
      label: ctx.t('mineflayerWorld.entities.invert', 'Invert selection'),
      variant: 'text',
      onClick: () => {
        const current = new Set(table.selection());
        table.setSelection(visibleRows.filter((r) => !current.has(String(r.id))).map((r) => String(r.id)));
      }
    }),
    ctx.components.button({
      label: ctx.t('mineflayerWorld.entities.attackSelected', 'Attack selected'),
      icon: 'bolt',
      danger: true,
      variant: 'outlined',
      onClick: async (event) => {
        const selected = new Set(table.selection().map(Number));
        const targets = rows.filter((r) => selected.has(r.id));
        if (targets.length === 0) return;
        const anchor = event.currentTarget as HTMLElement;
        const players = targets.filter((t) => t.username !== null);
        const requireConfirm = players.length > 0 || ctx.settings.get<boolean>(CONFIRM_MOB_ATTACKS_ID, DEFAULTS.confirmMobAttacks);
        if (requireConfirm) {
          const ok = await ctx.confirm.request({
            action: ctx.t('mineflayerWorld.entities.confirmBulk', 'Attack {count} entities', { values: { count: targets.length } }),
            affected: targets.map((t) => t.username ?? t.displayName),
            irreversible:
              players.length > 0
                ? ctx.t(
                    'mineflayerWorld.entities.confirmBulkBodyPlayers',
                    'This includes {count} real player(s). The bot will swing at and damage every one of them.',
                    { values: { count: players.length } }
                  )
                : ctx.t('mineflayerWorld.entities.confirmBulkBody', 'The bot will swing at and damage every selected entity.'),
            anchor
          });
          if (!ok) return;
        }
        let failures = 0;
        for (const target of targets) {
          try {
            await deps.call('attack', [target.id]);
          } catch {
            failures += 1;
          }
        }
        if (failures > 0) {
          ctx.notify.warn(
            ctx.t('mineflayerWorld.entities.attackSelected', 'Attack selected'),
            ctx.t('mineflayerWorld.entities.bulkFailures', '{failed} of {total} attacks were refused by the runtime.', {
              values: { failed: failures, total: targets.length }
            })
          );
        } else {
          ctx.notify.success(ctx.t('mineflayerWorld.entities.attackSelected', 'Attack selected'), ctx.t('mineflayerWorld.entities.bulkDone', '{count} attacks sent.', { values: { count: targets.length } }));
        }
      }
    }),
    ctx.components.button({
      label: ctx.t('core.action.export', 'Export'),
      icon: 'download',
      variant: 'text',
      onClick: async () => {
        if (rows.length === 0) return;
        const selected = new Set(table.selection());
        const toExport = selected.size > 0 ? rows.filter((r) => selected.has(String(r.id))) : rows;
        const path = await ctx.exporter.save(
          toExport.map((r) => ({
            id: r.id,
            name: r.displayName,
            username: r.username ?? '',
            type: r.type,
            distance: r.distance ?? '',
            health: r.health ?? '',
            equipment: r.equipment.map((i) => i.displayName).join('; ')
          })),
          'csv',
          { name: 'nearby-entities', defaultFileName: 'nearby-entities.csv' }
        );
        if (path) ctx.notify.success(ctx.t('core.export.saved', 'Exported'), path);
      }
    })
  );

  async function poll(): Promise<void> {
    try {
      const raw = await deps.call<Array<Record<string, unknown>>>('entities', []);
      const botPosition = deps.getState()?.position ?? null;
      rows = raw
        .map((entry) => normaliseEntity(entry))
        .filter((entity): entity is WorldEntity => entity !== null)
        .map((entity) => ({
          ...entity,
          distance: botPosition && entity.position ? distance3(botPosition, entity.position) : null
        }))
        .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
      visibleRows = rows;
      table.setRows(visibleRows);
      refreshTargetOptions();
    } catch {
      // The bot may simply be disconnected right now; the shared status bar
      // already says so, and this poll quietly tries again next tick.
    }
  }

  const intervalMs = ctx.settings.get<number>(ENTITY_POLL_MS_ID, DEFAULTS.entityPollMs);
  const handle = window.setInterval(() => void poll(), Math.max(250, intervalMs));
  void poll();

  return () => {
    window.clearInterval(handle);
    search.destroy();
  };
}
