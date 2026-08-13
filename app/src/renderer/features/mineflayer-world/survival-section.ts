/**
 * Fishing, sleep, wake, spawn point and respawn (row 15.13). Covers
 * `fishing.js`, `bed.js` and `spawn_point.js`.
 *
 * Every failure message here is the real string the library threw --
 * `bot.sleep` in particular refuses for eight distinct real reasons ("it's
 * not night and it's not a thunderstorm", "the bed is occupied", "there are
 * monsters nearby", and so on) and this surface never collapses them into a
 * generic "could not sleep".
 */

import type { SectionDeps } from './panel';
import { BED_BLOCK_NAMES, SURVIVAL_ELEMENT, formatBlockVec, isDiggingInFlight, normaliseVec, setDiggingInFlight, type Vec3Like } from './model';

export function mountSurvivalSection(host: HTMLElement, deps: SectionDeps): () => void {
  const { ctx } = deps;
  host.id = SURVIVAL_ELEMENT;
  host.append(
    ctx.components.sectionHeading({
      title: ctx.t('mineflayerWorld.survival.heading', 'Fishing, sleeping and respawn'),
      description: ctx.t(
        'mineflayerWorld.survival.heading.description',
        'Failures here are shown exactly as the game reported them -- "the bed is too far" is a different problem from "there are monsters nearby", and the message says which one happened.'
      )
    })
  );

  /* ---------------- fishing ---------------- */

  const fishRow = document.createElement('div');
  fishRow.className = 'mineflayer-world-inline';
  host.append(fishRow);

  const fishStatus = document.createElement('span');
  fishStatus.className = 'md-typescale-body-medium';
  fishStatus.setAttribute('role', 'status');
  fishStatus.textContent = ctx.t('mineflayerWorld.survival.fishIdle', 'Not fishing.');

  const fishButton = ctx.components.button({
    label: ctx.t('mineflayerWorld.survival.fish', 'Cast the fishing rod'),
    icon: 'play',
    variant: 'filled',
    onClick: async () => {
      const guardKey = `${deps.botId}:fish`;
      if (isDiggingInFlight(guardKey)) return;
      setDiggingInFlight(guardKey, true);
      fishButton.disabled = true;
      fishButton.title = ctx.t('mineflayerWorld.survival.fishInFlight', 'Already waiting for a bite.');
      fishStatus.textContent = ctx.t('mineflayerWorld.survival.fishing', 'Line cast -- waiting for a bite…');
      try {
        await deps.call('fish', []);
        fishStatus.textContent = ctx.t('mineflayerWorld.survival.fishCaught', 'Something bit -- reeled in.');
      } catch (error) {
        fishStatus.textContent = ctx.t('mineflayerWorld.survival.fishFailed', 'Fishing stopped: {reason}', {
          values: { reason: error instanceof Error ? error.message : String(error) }
        });
      } finally {
        setDiggingInFlight(guardKey, false);
        fishButton.disabled = false;
        fishButton.title = '';
      }
    }
  });
  fishRow.append(fishButton, fishStatus);

  /* ---------------- sleep / wake ---------------- */

  const bedCard = document.createElement('div');
  bedCard.className = 'mineflayer-world-card';
  host.append(bedCard);

  const bedRow = document.createElement('div');
  bedRow.className = 'mineflayer-world-row';
  bedCard.append(bedRow);

  const bedX = ctx.components.textField({ label: 'X', type: 'number', value: '' });
  const bedY = ctx.components.textField({ label: 'Y', type: 'number', value: '' });
  const bedZ = ctx.components.textField({ label: 'Z', type: 'number', value: '' });
  bedRow.append(bedX.root, bedY.root, bedZ.root);

  function bedPosition(): Vec3Like | null {
    const x = Number(bedX.get());
    const y = Number(bedY.get());
    const z = Number(bedZ.get());
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null;
    return { x, y, z };
  }

  const bedStatus = document.createElement('p');
  bedStatus.className = 'md-typescale-body-small';
  bedStatus.setAttribute('role', 'status');
  bedCard.append(bedStatus);

  const bedActions = document.createElement('div');
  bedActions.className = 'mineflayer-world-actions';
  bedCard.append(bedActions);

  bedActions.append(
    ctx.components.button({
      label: ctx.t('mineflayerWorld.survival.findBed', 'Find the nearest bed'),
      icon: 'search',
      variant: 'tonal',
      onClick: async () => {
        try {
          const raw = await deps.call<Array<{ position: unknown }>>('findBlocks', [
            { matching: BED_BLOCK_NAMES, maxDistance: 32, count: 1 }
          ]);
          const first = raw[0];
          const position = first ? normaliseVec(first.position) : null;
          if (!position) {
            bedStatus.textContent = ctx.t('mineflayerWorld.survival.noBedFound', 'No bed is loaded within 32 blocks.');
            return;
          }
          bedX.set(String(position.x));
          bedY.set(String(position.y));
          bedZ.set(String(position.z));
          bedStatus.textContent = ctx.t('mineflayerWorld.survival.bedFound', 'Found a bed at {position}.', { values: { position: formatBlockVec(position) } });
        } catch (error) {
          deps.notifyError(ctx.t('mineflayerWorld.survival.findBed', 'Find the nearest bed'), error);
        }
      }
    }),
    ctx.components.button({
      label: ctx.t('mineflayerWorld.survival.sleep', 'Sleep'),
      icon: 'play',
      variant: 'filled',
      onClick: async () => {
        const position = bedPosition();
        if (!position) {
          bedStatus.textContent = ctx.t('mineflayerWorld.survival.needBedPosition', 'Enter a bed position, or find the nearest one first.');
          return;
        }
        try {
          await deps.call('sleep', [position]);
          bedStatus.textContent = ctx.t('mineflayerWorld.survival.sleeping', 'Asleep.');
        } catch (error) {
          bedStatus.textContent = ctx.t('mineflayerWorld.survival.sleepFailed', 'Could not sleep: {reason}', {
            values: { reason: error instanceof Error ? error.message : String(error) }
          });
        }
      }
    }),
    ctx.components.button({
      label: ctx.t('mineflayerWorld.survival.wake', 'Wake up'),
      variant: 'outlined',
      onClick: async () => {
        try {
          await deps.call('wake', []);
          bedStatus.textContent = ctx.t('mineflayerWorld.survival.awake', 'Awake.');
        } catch (error) {
          bedStatus.textContent = ctx.t('mineflayerWorld.survival.wakeFailed', 'Could not wake: {reason}', {
            values: { reason: error instanceof Error ? error.message : String(error) }
          });
        }
      }
    })
  );

  const sleepUnsub = deps.onChange(() => {
    const state = deps.getState();
    if (state?.isSleeping === true) bedStatus.textContent = ctx.t('mineflayerWorld.survival.sleeping', 'Asleep.');
  });

  /* ---------------- spawn point / respawn ---------------- */

  const spawnRow = document.createElement('div');
  spawnRow.className = 'mineflayer-world-inline';
  host.append(spawnRow);

  const spawnStatus = document.createElement('span');
  spawnStatus.className = 'md-typescale-body-medium';
  spawnStatus.setAttribute('role', 'status');
  spawnStatus.textContent = ctx.t('mineflayerWorld.survival.spawnUnknown', 'Spawn point not read yet.');

  spawnRow.append(
    ctx.components.button({
      label: ctx.t('mineflayerWorld.survival.spawnPoint', 'Read the current spawn point'),
      icon: 'home',
      variant: 'outlined',
      onClick: async () => {
        try {
          const raw = await deps.call('spawnPoint', []);
          const position = normaliseVec(raw);
          spawnStatus.textContent = position
            ? ctx.t('mineflayerWorld.survival.spawnAt', 'Spawn point: {position}', { values: { position: formatBlockVec(position) } })
            : ctx.t('mineflayerWorld.survival.spawnUnknown', 'Spawn point not read yet.');
        } catch (error) {
          deps.notifyError(ctx.t('mineflayerWorld.survival.spawnPoint', 'Read the current spawn point'), error);
        }
      }
    }),
    ctx.components.button({
      label: ctx.t('mineflayerWorld.survival.respawn', 'Respawn'),
      icon: 'refresh',
      variant: 'outlined',
      onClick: async () => {
        try {
          await deps.call('respawn', []);
          ctx.notify.info(ctx.t('mineflayerWorld.survival.respawn', 'Respawn'), ctx.t('mineflayerWorld.survival.respawnSent', 'A respawn request was sent. It only has an effect while the bot is dead.'));
        } catch (error) {
          deps.notifyError(ctx.t('mineflayerWorld.survival.respawn', 'Respawn'), error);
        }
      }
    }),
    spawnStatus
  );

  return () => {
    sleepUnsub();
  };
}
