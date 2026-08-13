import { defineFeature } from '../../core/registry';
import type { AppContext, TabContext } from '../../core/registry';
import { setActiveWorldPath } from './contract';

// Named exports (not just the default FeatureModule below) so a sibling
// feature in this cluster can `import { listVaults, ... } from '../world-vault'`
// — see contract.ts's "Compatibility surface" section for why this exists.
export * from './contract';
import { WORLD_VAULT_DOCS } from './docs';
import { mountWorldVaultPanel } from './panel';
import {
  AUTO_START_ID,
  DEFAULT_POLL_INTERVAL_MS,
  DEFAULT_QUIET_PERIOD_MS,
  POLL_INTERVAL_ID,
  PUBLISH_VISIBILITY_ID,
  QUIET_PERIOD_ID,
  VaultFeatureState,
  WORLD_PATH_ID
} from './state';
import { WORLD_VAULT_STRINGS } from './strings';
import './styles.css';

let sharedState: VaultFeatureState | null = null;

export default defineFeature({
  id: 'world-vault',
  name: 'World vault',
  description: 'A version-controlled repository for a downloaded world, with a background settle-and-commit runner, unlimited undo, and an always user-initiated publish.',

  strings: WORLD_VAULT_STRINGS,
  docs: WORLD_VAULT_DOCS,

  settings: [
    {
      id: 'world-vault.settings',
      title: 'world-vault.settings.title',
      icon: 'history',
      order: 260,
      controls: [
        {
          id: WORLD_PATH_ID,
          label: 'world-vault.settings.worldPath.label',
          description: 'world-vault.settings.worldPath.description',
          kind: 'folder',
          defaultValue: '',
          keywords: ['world', 'vault', 'git', 'repository', 'folder']
        },
        {
          id: QUIET_PERIOD_ID,
          label: 'world-vault.settings.quietPeriod.label',
          description: 'world-vault.settings.quietPeriod.description',
          kind: 'slider',
          defaultValue: DEFAULT_QUIET_PERIOD_MS,
          min: 1000,
          max: 60_000,
          step: 500,
          hint: 'ms',
          keywords: ['settle', 'debounce', 'quiet']
        },
        {
          id: POLL_INTERVAL_ID,
          label: 'world-vault.settings.pollInterval.label',
          description: 'world-vault.settings.pollInterval.description',
          kind: 'slider',
          defaultValue: DEFAULT_POLL_INTERVAL_MS,
          min: 500,
          max: 30_000,
          step: 500,
          hint: 'ms',
          keywords: ['poll', 'watch', 'interval']
        },
        {
          id: AUTO_START_ID,
          label: 'world-vault.settings.autoStart.label',
          description: 'world-vault.settings.autoStart.description',
          kind: 'switch',
          defaultValue: true,
          keywords: ['runner', 'watch', 'automatic']
        },
        {
          id: PUBLISH_VISIBILITY_ID,
          label: 'world-vault.settings.publishVisibility.label',
          description: 'world-vault.settings.publishVisibility.description',
          kind: 'select',
          defaultValue: 'private',
          options: [
            { value: 'private', label: 'world-vault.publish.visibility.private' },
            { value: 'public', label: 'world-vault.publish.visibility.public' }
          ],
          keywords: ['github', 'publish', 'visibility', 'private', 'public']
        }
      ]
    }
  ],

  palette: [
    {
      id: 'world-vault.command.open',
      title: 'world-vault.tab',
      icon: 'history',
      kind: 'destination',
      keywords: ['vault', 'git', 'world', 'backup', 'undo', 'history'],
      teleport: { tabId: 'world-vault.main' }
    },
    {
      id: 'world-vault.command.create',
      title: 'world-vault.command.create',
      icon: 'add',
      kind: 'command',
      keywords: ['vault', 'create', 'git', 'init'],
      run: () => sharedState?.refresh()
    },
    {
      id: 'world-vault.command.publish',
      title: 'world-vault.command.publish',
      icon: 'upload',
      kind: 'destination',
      keywords: ['publish', 'push', 'github', 'remote'],
      teleport: { tabId: 'world-vault.main', elementId: 'worldvault-timeline' }
    }
  ],

  tabs: [
    {
      id: 'world-vault.main',
      title: 'world-vault.tab',
      icon: 'history',
      order: 260,
      mount(host: HTMLElement, ctx: TabContext) {
        const state = sharedState ?? new VaultFeatureState(ctx);
        sharedState = state;
        mountWorldVaultPanel(host, ctx, state);
        ctx.onDispose(() => state.dispose());
      }
    }
  ],

  init(ctx: AppContext) {
    ctx.settings.declareDefault(WORLD_PATH_ID, '');
    ctx.settings.declareDefault(QUIET_PERIOD_ID, DEFAULT_QUIET_PERIOD_MS);
    ctx.settings.declareDefault(POLL_INTERVAL_ID, DEFAULT_POLL_INTERVAL_MS);
    ctx.settings.declareDefault(AUTO_START_ID, true);
    ctx.settings.declareDefault(PUBLISH_VISIBILITY_ID, 'private');
    const existingWorldPath = String(ctx.settings.get<string>(WORLD_PATH_ID, ''));
    setActiveWorldPath(existingWorldPath || null);
  }
});
