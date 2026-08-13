/**
 * The bot movement feature module.
 *
 * Directional controls, sprint, sneak, jump, look-at, walk-to-coordinates,
 * follow-entity and a straight-line route preview, all operable by keyboard
 * as well as pointer. This module never opens a connection itself: it drives
 * whichever bot session the `mineflayer` feature publishes, and says so
 * plainly on screen when nothing is present rather than pretending to be
 * connected. See `docs.ts` for the full behaviour and the exact mechanism
 * that keeps a held control from outliving whatever was holding it.
 */

import './styles.css';

import type { AppContext, FeatureModule, PaletteEntry, SettingsSection } from '../../core/registry';
import { MOVEMENT_DOCS } from './docs';
import {
  ARRIVE_RADIUS_ID,
  BLOCK_RAY_DISTANCE_ID,
  DEFAULTS,
  ENTITY_RAY_DISTANCE_ID,
  FOLLOW_DISTANCE_ID,
  FOLLOW_ELEMENT,
  FEATURE_ID,
  JUMP_WHEN_STUCK_ID,
  KEYBOARD_PILOTING_ID,
  LOG_ELEMENT,
  LOG_KEY,
  LOG_LIMIT_ID,
  LOOK_ELEMENT,
  PAD_ELEMENT,
  PREVIEW_ELEMENT,
  RAY_ELEMENT,
  READOUT_ELEMENT,
  SHOW_PREVIEW_ID,
  SPRINT_WHILE_WALKING_ID,
  STUCK_SECONDS_ID,
  TAB_ID,
  TICK_MS_ID,
  TRAIL_POINTS_ID,
  WALK_ELEMENT,
  WALK_TIMEOUT_ID
} from './model';
import { mountMovementTab } from './panel';
import { sessionBridge } from './session';
import { MOVEMENT_STRINGS } from './strings';

function settingsSection(): SettingsSection {
  return {
    id: FEATURE_ID,
    title: 'mineflayerMovement.settings.title',
    icon: 'map',
    order: 240,
    controls: [
      {
        id: ARRIVE_RADIUS_ID,
        label: 'mineflayerMovement.setting.arriveRadius',
        description: 'mineflayerMovement.setting.arriveRadius.description',
        kind: 'number',
        defaultValue: DEFAULTS.arriveRadius,
        min: 0.1,
        max: 20,
        step: 0.1,
        hint: 'm',
        keywords: ['arrive', 'radius', 'close', 'walk', 'movement'],
        validate: (value) => {
          const radius = Number(value);
          return Number.isFinite(radius) && radius > 0 && radius <= 20 ? null : 'Use a number of metres greater than 0 and at most 20.';
        }
      },
      {
        id: FOLLOW_DISTANCE_ID,
        label: 'mineflayerMovement.setting.followDistance',
        description: 'mineflayerMovement.setting.followDistance.description',
        kind: 'number',
        defaultValue: DEFAULTS.followDistance,
        min: 0.5,
        max: 30,
        step: 0.5,
        hint: 'm',
        keywords: ['follow', 'distance', 'tail', 'movement'],
        validate: (value) => {
          const distance = Number(value);
          return Number.isFinite(distance) && distance > 0 && distance <= 30 ? null : 'Use a number of metres greater than 0 and at most 30.';
        }
      },
      {
        id: SPRINT_WHILE_WALKING_ID,
        label: 'mineflayerMovement.setting.sprint',
        description: 'mineflayerMovement.setting.sprint.description',
        kind: 'switch',
        defaultValue: DEFAULTS.sprintWhileWalking,
        keywords: ['sprint', 'walk', 'follow', 'speed', 'movement']
      },
      {
        id: JUMP_WHEN_STUCK_ID,
        label: 'mineflayerMovement.setting.jumpWhenStuck',
        description: 'mineflayerMovement.setting.jumpWhenStuck.description',
        kind: 'switch',
        defaultValue: DEFAULTS.jumpWhenStuck,
        keywords: ['jump', 'stuck', 'step', 'walk', 'movement']
      },
      {
        id: STUCK_SECONDS_ID,
        label: 'mineflayerMovement.setting.stuckSeconds',
        description: 'mineflayerMovement.setting.stuckSeconds.description',
        kind: 'number',
        defaultValue: DEFAULTS.stuckSeconds,
        min: 1,
        max: 120,
        step: 1,
        hint: 's',
        keywords: ['stuck', 'timeout', 'walk', 'movement'],
        validate: (value) => {
          const seconds = Number(value);
          return Number.isInteger(seconds) && seconds >= 1 && seconds <= 120 ? null : 'Use a whole number of seconds from 1 to 120.';
        }
      },
      {
        id: WALK_TIMEOUT_ID,
        label: 'mineflayerMovement.setting.walkTimeout',
        description: 'mineflayerMovement.setting.walkTimeout.description',
        kind: 'number',
        defaultValue: DEFAULTS.walkTimeoutSeconds,
        min: 5,
        max: 3600,
        step: 5,
        hint: 's',
        keywords: ['walk', 'timeout', 'movement'],
        validate: (value) => {
          const seconds = Number(value);
          return Number.isInteger(seconds) && seconds >= 5 && seconds <= 3600 ? null : 'Use a whole number of seconds from 5 to 3600.';
        }
      },
      {
        id: TICK_MS_ID,
        label: 'mineflayerMovement.setting.tickMs',
        description: 'mineflayerMovement.setting.tickMs.description',
        kind: 'number',
        defaultValue: DEFAULTS.tickMs,
        min: 20,
        max: 2000,
        step: 10,
        hint: 'ms',
        keywords: ['tick', 'refresh', 'rate', 'movement'],
        validate: (value) => {
          const ms = Number(value);
          return Number.isFinite(ms) && ms >= 20 && ms <= 2000 ? null : 'Use a number of milliseconds from 20 to 2000.';
        }
      },
      {
        id: BLOCK_RAY_DISTANCE_ID,
        label: 'mineflayerMovement.setting.blockRayDistance',
        description: 'mineflayerMovement.setting.blockRayDistance.description',
        kind: 'number',
        defaultValue: DEFAULTS.blockRayDistance,
        min: 1,
        max: 256,
        step: 1,
        hint: 'm',
        keywords: ['ray', 'block', 'distance', 'movement'],
        validate: (value) => {
          const distance = Number(value);
          return Number.isFinite(distance) && distance >= 1 && distance <= 256 ? null : 'Use a number of metres from 1 to 256.';
        }
      },
      {
        id: ENTITY_RAY_DISTANCE_ID,
        label: 'mineflayerMovement.setting.entityRayDistance',
        description: 'mineflayerMovement.setting.entityRayDistance.description',
        kind: 'number',
        defaultValue: DEFAULTS.entityRayDistance,
        min: 0.5,
        max: 64,
        step: 0.5,
        hint: 'm',
        keywords: ['ray', 'entity', 'distance', 'movement'],
        validate: (value) => {
          const distance = Number(value);
          return Number.isFinite(distance) && distance >= 0.5 && distance <= 64 ? null : 'Use a number of metres from 0.5 to 64.';
        }
      },
      {
        id: KEYBOARD_PILOTING_ID,
        label: 'mineflayerMovement.setting.keyboardPiloting',
        description: 'mineflayerMovement.setting.keyboardPiloting.description',
        kind: 'switch',
        defaultValue: DEFAULTS.keyboardPiloting,
        keywords: ['keyboard', 'wasd', 'pilot', 'movement']
      },
      {
        id: SHOW_PREVIEW_ID,
        label: 'mineflayerMovement.setting.showPreview',
        description: 'mineflayerMovement.setting.showPreview.description',
        kind: 'switch',
        defaultValue: DEFAULTS.showPreview,
        keywords: ['preview', 'route', 'map', 'movement']
      },
      {
        id: TRAIL_POINTS_ID,
        label: 'mineflayerMovement.setting.trailPoints',
        description: 'mineflayerMovement.setting.trailPoints.description',
        kind: 'number',
        defaultValue: DEFAULTS.trailPoints,
        min: 2,
        max: 5000,
        step: 10,
        keywords: ['trail', 'preview', 'route', 'movement'],
        validate: (value) => {
          const count = Number(value);
          return Number.isInteger(count) && count >= 2 && count <= 5000 ? null : 'Use a whole number from 2 to 5000.';
        }
      },
      {
        id: LOG_LIMIT_ID,
        label: 'mineflayerMovement.setting.logLimit',
        description: 'mineflayerMovement.setting.logLimit.description',
        kind: 'number',
        defaultValue: DEFAULTS.logLimit,
        min: 10,
        max: 20_000,
        step: 10,
        keywords: ['log', 'limit', 'history', 'movement'],
        validate: (value) => {
          const count = Number(value);
          return Number.isInteger(count) && count >= 10 && count <= 20_000 ? null : 'Use a whole number from 10 to 20000.';
        }
      }
    ]
  };
}

function paletteEntries(): PaletteEntry[] {
  const settingIds = [
    ARRIVE_RADIUS_ID,
    FOLLOW_DISTANCE_ID,
    SPRINT_WHILE_WALKING_ID,
    JUMP_WHEN_STUCK_ID,
    STUCK_SECONDS_ID,
    WALK_TIMEOUT_ID,
    TICK_MS_ID,
    BLOCK_RAY_DISTANCE_ID,
    ENTITY_RAY_DISTANCE_ID,
    KEYBOARD_PILOTING_ID,
    SHOW_PREVIEW_ID,
    TRAIL_POINTS_ID,
    LOG_LIMIT_ID
  ];

  const entries: PaletteEntry[] = [
    {
      id: 'mineflayerMovement.command.open',
      title: 'mineflayerMovement.palette.open',
      icon: 'map',
      kind: 'destination',
      keywords: ['bot', 'movement', 'pilot', 'walk', 'look', '機械人', '移動'],
      teleport: { tabId: TAB_ID, elementId: READOUT_ELEMENT }
    },
    {
      id: 'mineflayerMovement.command.stop',
      title: 'mineflayerMovement.palette.stop',
      icon: 'stop',
      kind: 'command',
      keywords: ['stop', 'bot', 'movement', 'halt'],
      run: () => {
        // Act immediately when the tab is already mounted (the common case,
        // since it is the whole point of an emergency stop); otherwise there
        // is nothing running yet, so opening the tab is the honest fallback.
        if (window.mineflayerMovementControls) {
          window.mineflayerMovementControls.stopAll();
          return;
        }
        contextRef?.tabs.teleport(TAB_ID, PAD_ELEMENT);
      }
    },
    {
      id: 'mineflayerMovement.command.readout',
      title: 'mineflayerMovement.palette.readout',
      icon: 'map',
      kind: 'destination',
      keywords: ['position', 'read-out', 'bot', 'movement'],
      teleport: { tabId: TAB_ID, elementId: READOUT_ELEMENT }
    },
    {
      id: 'mineflayerMovement.command.pad',
      title: 'mineflayerMovement.section.pad',
      icon: 'map',
      kind: 'destination',
      keywords: ['pad', 'directional', 'controls', 'bot', 'movement'],
      teleport: { tabId: TAB_ID, elementId: PAD_ELEMENT }
    },
    {
      id: 'mineflayerMovement.command.look',
      title: 'mineflayerMovement.palette.look',
      icon: 'map',
      kind: 'destination',
      keywords: ['look', 'yaw', 'pitch', 'bot', 'movement'],
      teleport: { tabId: TAB_ID, elementId: LOOK_ELEMENT }
    },
    {
      id: 'mineflayerMovement.command.ray',
      title: 'mineflayerMovement.palette.ray',
      icon: 'map',
      kind: 'destination',
      keywords: ['ray', 'trace', 'target', 'bot', 'movement'],
      teleport: { tabId: TAB_ID, elementId: RAY_ELEMENT }
    },
    {
      id: 'mineflayerMovement.command.walk',
      title: 'mineflayerMovement.palette.walk',
      icon: 'map',
      kind: 'destination',
      keywords: ['walk', 'coordinates', 'bot', 'movement'],
      teleport: { tabId: TAB_ID, elementId: WALK_ELEMENT }
    },
    {
      id: 'mineflayerMovement.command.follow',
      title: 'mineflayerMovement.palette.follow',
      icon: 'map',
      kind: 'destination',
      keywords: ['follow', 'entity', 'tail', 'bot', 'movement'],
      teleport: { tabId: TAB_ID, elementId: FOLLOW_ELEMENT }
    },
    {
      id: 'mineflayerMovement.command.preview',
      title: 'mineflayerMovement.section.preview',
      icon: 'map',
      kind: 'destination',
      keywords: ['preview', 'route', 'map', 'bot', 'movement'],
      teleport: { tabId: TAB_ID, elementId: PREVIEW_ELEMENT }
    },
    {
      id: 'mineflayerMovement.command.log',
      title: 'mineflayerMovement.palette.log',
      icon: 'history',
      kind: 'destination',
      keywords: ['log', 'history', 'movement', 'record'],
      teleport: { tabId: TAB_ID, elementId: LOG_ELEMENT }
    }
  ];

  for (const id of settingIds) {
    entries.push({
      id: `mineflayerMovement.setting.${id}`,
      title: id,
      kind: 'setting',
      settingId: id,
      icon: 'tune',
      keywords: ['mineflayer', 'movement', 'setting', id]
    });
  }

  return entries;
}

let contextRef: AppContext | null = null;

const mineflayerMovement: FeatureModule = {
  id: FEATURE_ID,
  name: 'Bot movement',
  description:
    'Directional controls, sprint, sneak, jump, look-at, ray-trace target picking, walk-to-coordinates, follow-entity and a straight-line route preview, all operable by keyboard as well as pointer, driving whichever bot session the mineflayer feature publishes.',
  strings: MOVEMENT_STRINGS,
  docs: MOVEMENT_DOCS,
  settings: [settingsSection()],
  tabs: [
    {
      id: TAB_ID,
      title: 'mineflayerMovement.tab.title',
      icon: 'map',
      order: 420,
      mount: (host, tabCtx) => {
        mountMovementTab(host, tabCtx);
      }
    }
  ],
  palette: paletteEntries(),
  init(ctx: AppContext) {
    contextRef = ctx;
    ctx.settings.declareDefault(LOG_KEY, []);
    void sessionBridge.start();
  }
};

export default mineflayerMovement;
