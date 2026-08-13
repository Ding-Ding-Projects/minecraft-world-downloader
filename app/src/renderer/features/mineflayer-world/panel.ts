/**
 * Mounts the world-interaction tab and wires the shared plumbing every
 * section below is built on: finding the live bot, reading its state,
 * calling its allow-listed methods, and filtering the raw host event stream.
 *
 * The tab itself never opens a connection -- it drives whichever bot session
 * `mineflayer` publishes, and says so plainly when nothing is present rather
 * than pretending to be connected. See `docs/features/mineflayer-world.md`
 * for the full behaviour.
 */

import type { TabContext } from '../../core/registry';
import { WorldContractBridge, type WorldHostMessage, type WorldRuntimeContract } from './contract';
import { formatVec, normaliseState, isConnected, describeError, type WorldBotState, STATUS_ELEMENT } from './model';
import { mountBlocksSection } from './blocks-section';
import { mountEntitiesSection } from './entities-section';
import { mountSurvivalSection } from './survival-section';
import { mountBookSection } from './book-section';
import { mountCreativeSection } from './creative-section';
import { mountAmbienceSection } from './ambience-section';
import { mountResourcePackSection } from './resourcepack-section';

export interface SectionDeps {
  ctx: TabContext;
  contract: WorldRuntimeContract;
  botId: string;
  getState(): WorldBotState | null;
  call<T = unknown>(method: string, args?: unknown[]): Promise<T>;
  /** Fires on any change to any bot's status or state. Cheap to call often; each section filters what it needs. */
  onChange(listener: () => void): () => void;
  /** Filtered raw host events for this one bot, by real library event name. */
  onEvent(names: string[], listener: (name: string, payload: unknown, at: number) => void): () => void;
  notifyError(title: string, error: unknown): void;
}

type SectionMounter = (host: HTMLElement, deps: SectionDeps) => () => void;

const SECTIONS: SectionMounter[] = [
  mountBlocksSection,
  mountEntitiesSection,
  mountSurvivalSection,
  mountBookSection,
  mountCreativeSection,
  mountAmbienceSection,
  mountResourcePackSection
];

export function mountWorldTab(host: HTMLElement, ctx: TabContext): void {
  const bridge = new WorldContractBridge();
  const root = document.createElement('div');
  root.className = 'mineflayer-world-root';
  host.append(root);

  let sectionDisposers: Array<() => void> = [];
  let statusDisposer: (() => void) | null = null;
  let activeChangeDisposer: (() => void) | null = null;

  function teardownSections(): void {
    for (const dispose of sectionDisposers) {
      try {
        dispose();
      } catch (error) {
        console.error('A mineflayer-world section failed to tear down cleanly.', error);
      }
    }
    sectionDisposers = [];
    statusDisposer?.();
    statusDisposer = null;
  }

  function buildDeps(contract: WorldRuntimeContract, botId: string): SectionDeps {
    return {
      ctx,
      contract,
      botId,
      getState: () => normaliseState(contract.getState(botId)),
      call: (method, args = []) => contract.call(botId, method, args),
      onChange: (listener) => contract.onChange(listener),
      onEvent: (names, listener) => {
        const set = new Set(names);
        return contract.onHostMessage((message: WorldHostMessage) => {
          if (message.type !== 'event') return;
          if (message.botId !== botId) return;
          if (!message.name || !set.has(message.name)) return;
          listener(message.name, message.payload, message.at ?? Date.now());
        });
      },
      notifyError: (title, error) => {
        ctx.notify.error(title, describeError(error));
      }
    };
  }

  function render(): void {
    teardownSections();
    root.replaceChildren();

    const contract = bridge.current();
    activeChangeDisposer?.();
    activeChangeDisposer = null;
    if (!contract) {
      const searching = bridge.state() === 'searching';
      root.append(
        ctx.components.emptyState({
          title: ctx.t('mineflayerWorld.empty.title', 'No bot runtime found'),
          body: searching
            ? ctx.t('mineflayerWorld.empty.searching', 'Looking for the Minecraft bots feature that owns the connection…')
            : ctx.t(
                'mineflayerWorld.empty.unavailable',
                'The Minecraft bots feature is not present in this build, so there is nothing to dig, place or interact with. This tab searched for it and honestly found nothing rather than pretending to be connected.'
              )
        })
      );
      return;
    }

    activeChangeDisposer = contract.onActiveChange(render);

    const botId = contract.activeBotId();
    if (!botId) {
      root.append(
        ctx.components.emptyState({
          title: ctx.t('mineflayerWorld.empty.noBot.title', 'No bot connected'),
          body: ctx.t(
            'mineflayerWorld.empty.noBot.body',
            'Connect a bot from the Minecraft bots tab, then come back here to dig, place, interact with entities, fish, sleep, write books, use creative tools and more.'
          ),
          action: {
            label: ctx.t('mineflayerWorld.empty.noBot.action', 'Open Minecraft bots'),
            onClick: () => ctx.tabs.open('mineflayer.bots')
          }
        })
      );
      return;
    }

    const deps = buildDeps(contract, botId);

    root.append(mountStatusBar(deps));
    const dispose = deps.onChange(() => refreshStatusBar(deps));
    statusDisposer = dispose;

    for (const mounter of SECTIONS) {
      const section = document.createElement('section');
      section.className = 'mineflayer-world-section';
      root.append(section);
      sectionDisposers.push(mounter(section, deps));
    }
  }

  let statusRoot: HTMLElement | null = null;

  function mountStatusBar(deps: SectionDeps): HTMLElement {
    const bar = document.createElement('div');
    bar.className = 'mineflayer-world-status';
    bar.id = STATUS_ELEMENT;
    bar.setAttribute('role', 'status');
    statusRoot = bar;
    writeStatusBar(deps, bar);
    return bar;
  }

  function refreshStatusBar(deps: SectionDeps): void {
    if (!statusRoot) return;
    writeStatusBar(deps, statusRoot);
  }

  function writeStatusBar(deps: SectionDeps, bar: HTMLElement): void {
    const state = deps.getState();
    const connected = isConnected(state);
    bar.replaceChildren();

    const title = document.createElement('div');
    title.className = 'mineflayer-world-status-title md-typescale-title-medium';
    title.textContent = connected
      ? deps.ctx.t('mineflayerWorld.status.connected', 'Driving {username}', {
          values: { username: state?.username ?? deps.botId }
        })
      : deps.ctx.t('mineflayerWorld.status.notConnected', 'This bot is not connected right now ({status})', {
          values: { status: state?.status ?? 'idle' }
        });
    bar.append(title);

    if (!state) return;

    const facts: Array<[string, string]> = [
      [deps.ctx.t('mineflayerWorld.status.health', 'Health'), state.health === null ? '—' : `${state.health.toFixed(1)} / 20`],
      [deps.ctx.t('mineflayerWorld.status.food', 'Food'), state.food === null ? '—' : `${state.food.toFixed(1)} / 20`],
      [
        deps.ctx.t('mineflayerWorld.status.oxygen', 'Oxygen'),
        state.oxygenLevel === null ? '—' : `${state.oxygenLevel.toFixed(1)} / 20`
      ],
      [deps.ctx.t('mineflayerWorld.status.gameMode', 'Gamemode'), state.gameMode ?? '—'],
      [deps.ctx.t('mineflayerWorld.status.dimension', 'Dimension'), state.dimension ?? '—'],
      [deps.ctx.t('mineflayerWorld.status.position', 'Position'), formatVec(state.position)],
      [deps.ctx.t('mineflayerWorld.status.held', 'Held item'), state.heldItem ? `${state.heldItem.displayName} ×${state.heldItem.count}` : '—'],
      [
        deps.ctx.t('mineflayerWorld.status.time', 'Time'),
        state.timeOfDay === null ? '—' : `${state.timeOfDay} (${state.isDay ? deps.ctx.t('mineflayerWorld.status.day', 'day') : deps.ctx.t('mineflayerWorld.status.night', 'night')})`
      ],
      [
        deps.ctx.t('mineflayerWorld.status.weather', 'Weather'),
        state.isRaining
          ? state.thunderState && state.thunderState > 0
            ? deps.ctx.t('mineflayerWorld.status.thunder', 'thunderstorm')
            : deps.ctx.t('mineflayerWorld.status.rain', 'raining')
          : deps.ctx.t('mineflayerWorld.status.clear', 'clear')
      ]
    ];

    const grid = document.createElement('div');
    grid.className = 'mineflayer-world-status-grid';
    for (const [label, value] of facts) {
      const cell = document.createElement('div');
      cell.className = 'mineflayer-world-status-cell';
      const labelEl = document.createElement('span');
      labelEl.className = 'mineflayer-world-status-label md-typescale-label-small';
      labelEl.textContent = label;
      const valueEl = document.createElement('span');
      valueEl.className = 'mineflayer-world-status-value md-typescale-body-medium';
      valueEl.textContent = value;
      cell.append(labelEl, valueEl);
      grid.append(cell);
    }
    bar.append(grid);
  }

  const unsubscribeBridge = bridge.subscribe(render);
  void bridge.start();
  render();

  ctx.onDispose(() => {
    unsubscribeBridge();
    activeChangeDisposer?.();
    bridge.dispose();
    teardownSections();
  });
}
