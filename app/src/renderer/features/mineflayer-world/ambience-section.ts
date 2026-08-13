/**
 * World ambience as a live event feed, plus command-block editing (row
 * 15.16). Covers `time.js`, `rain.js`, `sound.js`, `particle.js` and
 * `command_block.js`.
 *
 * There is no `explosion` bot event anywhere in `vendor/mineflayer`:
 * `lib/plugins/explosion.js` only exposes a damage-calculator
 * (`bot.getExplosionDamages`), and the raw `explosion` protocol packet is
 * consumed silently inside `lib/plugins/blocks.js` to update block state
 * without ever calling `bot.emit`. This surface says so honestly rather than
 * inventing an explosion feed the library cannot supply -- see
 * `docs/features/mineflayer-world.md`.
 */

import type { SectionDeps } from './panel';
import { AMBIENCE_ELEMENT, EVENT_FEED_LIMIT_ID, DEFAULTS, nextRowId } from './model';

interface FeedRow {
  id: string;
  at: number;
  name: string;
  detail: string;
}

const FEED_EVENTS = ['soundEffectHeard', 'hardcodedSoundEffectHeard', 'particle', 'rain', 'weatherUpdate', 'time'];

function describePayload(name: string, payload: unknown): string {
  if (!Array.isArray(payload)) return typeof payload === 'string' ? payload : '';
  switch (name) {
    case 'soundEffectHeard': {
      const [soundName, , volume, pitch] = payload as [string, unknown, number, number];
      return `${soundName} (volume ${volume ?? '?'}, pitch ${pitch ?? '?'})`;
    }
    case 'hardcodedSoundEffectHeard': {
      const [soundId, category] = payload as [number, string];
      return `sound id ${soundId} (${category ?? 'unknown category'})`;
    }
    case 'particle': {
      const [particle] = payload as [Record<string, unknown> | undefined];
      return particle && typeof particle === 'object' ? String((particle as Record<string, unknown>).id ?? 'particle') : 'particle';
    }
    default:
      return '';
  }
}

export function mountAmbienceSection(host: HTMLElement, deps: SectionDeps): () => void {
  const { ctx } = deps;
  host.id = AMBIENCE_ELEMENT;
  host.append(
    ctx.components.sectionHeading({
      title: ctx.t('mineflayerWorld.ambience.heading', 'World ambience and command blocks'),
      description: ctx.t(
        'mineflayerWorld.ambience.heading.description',
        'Time and weather are shown at the top of this tab. Sounds, particles and weather changes stream in below as they really happen.'
      )
    })
  );

  const explosionNote = document.createElement('p');
  explosionNote.className = 'md-typescale-body-small';
  host.append(explosionNote);
  explosionNote.textContent = ctx.t(
    'mineflayerWorld.ambience.explosionNote',
    'This build of the bot library never emits an explosion event -- explosion.js only calculates damage, it does not report explosions happening. Nothing here fakes one; open the full event inspector to watch the raw "blockUpdate" events an explosion leaves behind instead.'
  );
  host.append(
    ctx.components.button({
      label: ctx.t('mineflayerWorld.ambience.openInspector', 'Open the event inspector'),
      variant: 'text',
      icon: 'terminal',
      onClick: () => ctx.tabs.open('mineflayer.events')
    })
  );

  const limit = ctx.settings.get<number>(EVENT_FEED_LIMIT_ID, DEFAULTS.eventFeedLimit);
  let feed: FeedRow[] = [];
  let paused = false;

  const table = ctx.components.dataTable<FeedRow>({
    label: ctx.t('mineflayerWorld.ambience.feed', 'Ambience feed'),
    columns: [
      { id: 'time', label: ctx.t('mineflayerWorld.ambience.column.time', 'Time'), value: (r) => new Date(r.at).toLocaleTimeString() },
      { id: 'name', label: ctx.t('mineflayerWorld.ambience.column.event', 'Event'), sortable: true, value: (r) => r.name },
      { id: 'detail', label: ctx.t('mineflayerWorld.ambience.column.detail', 'Detail'), value: (r) => r.detail }
    ],
    rows: [],
    rowId: (r) => r.id,
    selectable: true,
    emptyMessage: ctx.t('mineflayerWorld.ambience.empty', 'Nothing has happened yet.')
  });

  const search = ctx.createSearchBar({
    label: ctx.t('mineflayerWorld.ambience.search', 'Filter the feed'),
    sample: '',
    onChange: (query) => {
      table.setRows(feed.filter((row) => query.matches(row.name) || query.matches(row.detail)));
    }
  });
  host.append(search.root, table.root);

  const feedActions = document.createElement('div');
  feedActions.className = 'mineflayer-world-actions';
  host.append(feedActions);

  const pauseSwitch = ctx.components.switchControl({
    label: ctx.t('mineflayerWorld.ambience.pause', 'Pause the feed'),
    checked: false,
    onChange: (checked) => {
      paused = checked;
    }
  });
  feedActions.append(
    pauseSwitch.root,
    ctx.components.button({
      label: ctx.t('mineflayerWorld.ambience.clear', 'Clear'),
      variant: 'text',
      onClick: () => {
        feed = [];
        table.setRows(feed);
      }
    }),
    ctx.components.button({
      label: ctx.t('core.action.export', 'Export'),
      icon: 'download',
      variant: 'text',
      onClick: async () => {
        if (feed.length === 0) return;
        const path = await ctx.exporter.save(
          feed.map((r) => ({ at: new Date(r.at).toISOString(), event: r.name, detail: r.detail })),
          'csv',
          { name: 'ambience-feed', defaultFileName: 'ambience-feed.csv' }
        );
        if (path) ctx.notify.success(ctx.t('core.export.saved', 'Exported'), path);
      }
    })
  );

  const unsubEvents = deps.onEvent(FEED_EVENTS, (name, payload, at) => {
    if (paused) return;
    feed = [{ id: nextRowId('ambience'), at, name, detail: describePayload(name, payload) }, ...feed].slice(0, Math.max(20, limit));
    table.setRows(feed);
  });

  /* ---------------- command block editor ---------------- */

  const commandCard = document.createElement('div');
  commandCard.className = 'mineflayer-world-card';
  host.append(commandCard);
  commandCard.append(
    ctx.components.sectionHeading({
      title: ctx.t('mineflayerWorld.command.heading', 'Command block editor'),
      description: ctx.t('mineflayerWorld.command.heading.description', 'Requires creative mode, exactly as opening a command block does at a real Minecraft client.')
    })
  );

  const commandRow = document.createElement('div');
  commandRow.className = 'mineflayer-world-row';
  commandCard.append(commandRow);
  const cbX = ctx.components.textField({ label: 'X', type: 'number', value: '' });
  const cbY = ctx.components.textField({ label: 'Y', type: 'number', value: '' });
  const cbZ = ctx.components.textField({ label: 'Z', type: 'number', value: '' });
  commandRow.append(cbX.root, cbY.root, cbZ.root);

  const commandField = ctx.components.textField({ label: ctx.t('mineflayerWorld.command.text', 'Command'), placeholder: '/say hello' });
  commandCard.append(commandField.root);

  const modeSelect = ctx.components.select({
    label: ctx.t('mineflayerWorld.command.mode', 'Block type'),
    options: [
      { value: '2', label: ctx.t('mineflayerWorld.command.mode.redstone', 'Impulse (redstone)') },
      { value: '0', label: ctx.t('mineflayerWorld.command.mode.sequence', 'Chain (sequence)') },
      { value: '1', label: ctx.t('mineflayerWorld.command.mode.auto', 'Repeat (auto)') }
    ],
    value: '2'
  });
  commandCard.append(modeSelect.root);

  const commandFlags = document.createElement('div');
  commandFlags.className = 'mineflayer-world-inline';
  commandCard.append(commandFlags);
  const trackOutput = ctx.components.switchControl({ label: ctx.t('mineflayerWorld.command.trackOutput', 'Track output') });
  const conditional = ctx.components.switchControl({ label: ctx.t('mineflayerWorld.command.conditional', 'Conditional') });
  const alwaysActive = ctx.components.switchControl({ label: ctx.t('mineflayerWorld.command.alwaysActive', 'Always active') });
  commandFlags.append(trackOutput.root, conditional.root, alwaysActive.root);

  const commandStatus = document.createElement('p');
  commandStatus.className = 'md-typescale-body-small';
  commandStatus.setAttribute('role', 'status');
  commandCard.append(commandStatus);

  commandCard.append(
    ctx.components.button({
      label: ctx.t('mineflayerWorld.command.apply', 'Set the command block'),
      icon: 'terminal',
      variant: 'filled',
      onClick: async () => {
        const x = Number(cbX.get());
        const y = Number(cbY.get());
        const z = Number(cbZ.get());
        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
          commandStatus.textContent = ctx.t('mineflayerWorld.command.needPosition', 'Enter the command block\'s X, Y and Z.');
          return;
        }
        const command = commandField.get().trim();
        if (command.length === 0) {
          commandStatus.textContent = ctx.t('mineflayerWorld.command.needCommand', 'Enter a command.');
          return;
        }
        try {
          await deps.call('setCommandBlock', [
            { x, y, z },
            command,
            {
              mode: Number(modeSelect.get()),
              trackOutput: trackOutput.get(),
              conditional: conditional.get(),
              alwaysActive: alwaysActive.get()
            }
          ]);
          commandStatus.textContent = ctx.t('mineflayerWorld.command.applied', 'Command block updated.');
        } catch (error) {
          deps.notifyError(ctx.t('mineflayerWorld.command.apply', 'Set the command block'), error);
        }
      }
    })
  );

  return () => {
    unsubEvents();
    search.destroy();
  };
}
