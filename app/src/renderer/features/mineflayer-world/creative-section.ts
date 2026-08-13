/**
 * Creative-mode tools (row 15.15). Covers `creative.js`.
 *
 * `lib/plugins/creative.js` exposes exactly five things: setting or clearing
 * one inventory slot to any item or block, clearing the whole inventory, and
 * flying (start, stop, fly-to). There is no separate "instant break" control
 * in the library at all -- `lib/plugins/digging.js` already passes the bot's
 * real gamemode into the block's own dig-time formula, so the Dig control in
 * the Blocks section above is already instant in creative mode, automatically.
 * There is likewise no "set a block in the world" method: even in real
 * Minecraft, creative mode changes what you can *hold*, never how you place
 * it. "Set block" here means giving yourself that block and placing it with
 * the ordinary Place control above, which is the same thing a real creative
 * player does.
 */

import type { SectionDeps } from './panel';
import { COMMON_BLOCK_NAMES, COMMON_ITEM_NAMES, CREATIVE_ELEMENT, parseCoordinate } from './model';

export function mountCreativeSection(host: HTMLElement, deps: SectionDeps): () => void {
  const { ctx } = deps;
  host.id = CREATIVE_ELEMENT;
  host.append(
    ctx.components.sectionHeading({
      title: ctx.t('mineflayerWorld.creative.heading', 'Creative mode tools'),
      description: ctx.t(
        'mineflayerWorld.creative.heading.description',
        'Give item, set block, fly and instant break -- available only while the connected server reports creative gamemode, and disabled with the exact reason otherwise.'
      )
    })
  );

  const reasonHost = document.createElement('p');
  reasonHost.className = 'md-typescale-body-medium';
  reasonHost.setAttribute('role', 'status');
  host.append(reasonHost);

  const controls: Array<HTMLButtonElement> = [];

  function creativeReason(): string | null {
    const mode = deps.getState()?.gameMode ?? null;
    if (mode === 'creative') return null;
    return ctx.t('mineflayerWorld.creative.notCreative', 'The connected server reports gamemode "{mode}", not creative.', {
      values: { mode: mode ?? 'unknown' }
    });
  }

  function refreshGate(): void {
    const reason = creativeReason();
    reasonHost.textContent =
      reason ?? ctx.t('mineflayerWorld.creative.ready', 'This server is in creative mode; every control below is available.');
    for (const button of controls) {
      button.disabled = reason !== null;
      button.title = reason ?? '';
    }
  }

  /* ---------------- give item / block ---------------- */

  const giveCard = document.createElement('div');
  giveCard.className = 'mineflayer-world-card';
  host.append(giveCard);

  const giveRow = document.createElement('div');
  giveRow.className = 'mineflayer-world-row';
  giveCard.append(giveRow);

  const itemField = ctx.components.textField({
    label: ctx.t('mineflayerWorld.creative.item', 'Item or block name'),
    placeholder: 'diamond_sword'
  });
  const slotField = ctx.components.textField({ label: ctx.t('mineflayerWorld.creative.slot', 'Inventory slot (0-44)'), type: 'number', value: '36', min: 0, max: 44 });
  const countField = ctx.components.textField({ label: ctx.t('mineflayerWorld.creative.count', 'Count'), type: 'number', value: '1', min: 1, max: 64 });
  giveRow.append(itemField.root, slotField.root, countField.root);

  const chipRow = document.createElement('div');
  chipRow.className = 'mineflayer-world-chip-row';
  giveCard.append(chipRow);
  for (const name of [...COMMON_ITEM_NAMES, ...COMMON_BLOCK_NAMES]) {
    chipRow.append(
      ctx.components.button({
        label: name,
        variant: 'text',
        onClick: () => itemField.set(name)
      })
    );
  }

  const giveStatus = document.createElement('p');
  giveStatus.className = 'md-typescale-body-small';
  giveStatus.setAttribute('role', 'status');
  giveCard.append(giveStatus);

  const giveActions = document.createElement('div');
  giveActions.className = 'mineflayer-world-actions';
  giveCard.append(giveActions);

  const giveButton = ctx.components.button({
    label: ctx.t('mineflayerWorld.creative.give', 'Give / set block'),
    icon: 'add',
    variant: 'filled',
    onClick: async () => {
      const name = itemField.get().trim();
      const slot = parseCoordinate(slotField.get());
      const count = parseCoordinate(countField.get());
      if (name.length === 0 || slot === null) {
        giveStatus.textContent = ctx.t('mineflayerWorld.creative.needItem', 'Enter an item or block name and a slot number.');
        return;
      }
      try {
        await deps.call('creativeSetInventorySlot', [slot, name, count ?? 1]);
        giveStatus.textContent = ctx.t('mineflayerWorld.creative.given', 'Slot {slot} now holds {name} ×{count}.', {
          values: { slot, name, count: count ?? 1 }
        });
      } catch (error) {
        deps.notifyError(ctx.t('mineflayerWorld.creative.give', 'Give / set block'), error);
      }
    }
  });
  controls.push(giveButton);
  giveActions.append(giveButton);

  const clearSlotButton = ctx.components.button({
    label: ctx.t('mineflayerWorld.creative.clearSlot', 'Clear this slot'),
    variant: 'outlined',
    onClick: async () => {
      const slot = parseCoordinate(slotField.get());
      if (slot === null) return;
      try {
        await deps.call('creativeClearSlot', [slot]);
        giveStatus.textContent = ctx.t('mineflayerWorld.creative.slotCleared', 'Slot {slot} cleared.', { values: { slot } });
      } catch (error) {
        deps.notifyError(ctx.t('mineflayerWorld.creative.clearSlot', 'Clear this slot'), error);
      }
    }
  });
  controls.push(clearSlotButton);
  giveActions.append(clearSlotButton);

  const clearAllButton = ctx.components.button({
    label: ctx.t('mineflayerWorld.creative.clearAll', 'Clear the entire inventory'),
    icon: 'trash',
    danger: true,
    variant: 'outlined',
    onClick: async (event) => {
      const approved = await ctx.confirm.request({
        action: ctx.t('mineflayerWorld.creative.confirmClear', 'Clear every item from this bot\'s inventory'),
        affected: [ctx.t('mineflayerWorld.creative.confirmClearAffected', 'Every slot in the bot\'s inventory')],
        irreversible: ctx.t('mineflayerWorld.creative.confirmClearBody', 'Every held and stored item is removed. Nothing here can bring them back.'),
        anchor: event.currentTarget as HTMLElement
      });
      if (!approved) return;
      try {
        await deps.call('creativeClearInventory', []);
        giveStatus.textContent = ctx.t('mineflayerWorld.creative.cleared', 'Inventory cleared.');
      } catch (error) {
        deps.notifyError(ctx.t('mineflayerWorld.creative.clearAll', 'Clear the entire inventory'), error);
      }
    }
  });
  controls.push(clearAllButton);
  giveActions.append(clearAllButton);

  /* ---------------- flying ---------------- */

  const flyCard = document.createElement('div');
  flyCard.className = 'mineflayer-world-card';
  host.append(flyCard);

  const flyRow = document.createElement('div');
  flyRow.className = 'mineflayer-world-row';
  flyCard.append(flyRow);
  const flyX = ctx.components.textField({ label: 'X', type: 'number', value: '' });
  const flyY = ctx.components.textField({ label: 'Y', type: 'number', value: '' });
  const flyZ = ctx.components.textField({ label: 'Z', type: 'number', value: '' });
  flyRow.append(flyX.root, flyY.root, flyZ.root);

  const flyActions = document.createElement('div');
  flyActions.className = 'mineflayer-world-actions';
  flyCard.append(flyActions);

  const startFlyButton = ctx.components.button({
    label: ctx.t('mineflayerWorld.creative.startFly', 'Start flying'),
    icon: 'play',
    variant: 'tonal',
    onClick: async () => {
      try {
        await deps.call('creativeStartFlying', []);
      } catch (error) {
        deps.notifyError(ctx.t('mineflayerWorld.creative.startFly', 'Start flying'), error);
      }
    }
  });
  controls.push(startFlyButton);
  flyActions.append(startFlyButton);

  const stopFlyButton = ctx.components.button({
    label: ctx.t('mineflayerWorld.creative.stopFly', 'Stop flying'),
    variant: 'outlined',
    onClick: async () => {
      try {
        await deps.call('creativeStopFlying', []);
      } catch (error) {
        deps.notifyError(ctx.t('mineflayerWorld.creative.stopFly', 'Stop flying'), error);
      }
    }
  });
  controls.push(stopFlyButton);
  flyActions.append(stopFlyButton);

  const flyToButton = ctx.components.button({
    label: ctx.t('mineflayerWorld.creative.flyTo', 'Fly to these coordinates'),
    icon: 'world',
    variant: 'filled',
    onClick: async () => {
      const x = parseCoordinate(flyX.get());
      const y = parseCoordinate(flyY.get());
      const z = parseCoordinate(flyZ.get());
      if (x === null || y === null || z === null) return;
      try {
        await deps.call('creativeFlyTo', [{ x, y, z }]);
      } catch (error) {
        deps.notifyError(ctx.t('mineflayerWorld.creative.flyTo', 'Fly to these coordinates'), error);
      }
    }
  });
  controls.push(flyToButton);
  flyActions.append(flyToButton);

  /* ---------------- instant break note ---------------- */

  const instantNote = document.createElement('p');
  instantNote.className = 'md-typescale-body-small';
  instantNote.textContent = ctx.t(
    'mineflayerWorld.creative.instantBreak',
    'Instant break needs no separate control: the Dig button in the Blocks section above already breaks blocks instantly here, because the game itself treats creative mode as zero dig time.'
  );
  host.append(instantNote);

  refreshGate();
  const unsub = deps.onChange(refreshGate);

  return () => {
    unsub();
  };
}
