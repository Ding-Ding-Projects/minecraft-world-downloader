import './services.css';

import { el, nextId } from '../../core/a11y';
import { guidedSelect, guidedTextField } from '../../core/forms';
import { menuItemWithShortcut, shortcuts } from '../../core/menu';
import type { AppContext, MenuItem } from '../../core/types';
import { PROFILES_SETTING_ID, readProfiles } from '../../features/downloader/profiles';
import { shell } from '../index';
import type { ScreenDefinition } from '../types';

/**
 * Services and startup (design lines 392-439): running a profile without the
 * app open.
 *
 * `AppContext.studio` (the privileged bridge, `app/src/shared/api.ts`) has no
 * service-control channel at all: no Windows Service Control Manager call, no
 * `schtasks`, no Startup-folder shortcut writer. Grepping `StudioApi` finds
 * `app`, `window`, `settings`, `vault`, `dialog`, `fs`, `shell`, `editor`,
 * `bundled`, `process` (a plain child-process spawn, not a persistent
 * service), `history`, `http` and `worldVault` — nothing that can register,
 * start, stop or query a real OS service, scheduled task or startup entry.
 *
 * Rather than leave the screen unbuilt, or fake the state transitions the
 * design's own mock performs (`svcStart` flips a random PID into existence;
 * `svcStop` invents an exit code), this build ships the complete surface —
 * list, detail, the three real startup mechanisms with their real costs,
 * every field a "full service manager" needs — backed by an honest LOCAL
 * record of what the user wants installed. Every action that would need the
 * missing channel (Start, Restart, Stop, and Install/Uninstall's registration
 * half) reports plainly that nothing was touched, by name, rather than
 * pretending. Uninstall is the one action that is fully real end to end: it
 * only ever deleted a local record, so removing that local record IS the
 * whole of what "uninstall" ever promised in this build.
 */

/* ================================================================== */
/* Data model: a saved LOCAL plan, never a claim about real OS state    */
/* ================================================================== */

export const SERVICES_SETTING_ID = 'services.configurations';

export type ServiceStartupType = 'automatic' | 'delayed' | 'manual' | 'disabled';
export type ServiceAccount = 'system' | 'user';
export type ServiceRecovery = 'restart' | 'none';
export type ServiceStartupKind = 'service' | 'task' | 'folder';

export interface ServiceConfig {
  id: string;
  name: string;
  profileId: string;
  startupType: ServiceStartupType;
  account: ServiceAccount;
  recovery: ServiceRecovery;
  startupKind: ServiceStartupKind;
  /** Attach to an already-running service instead of opening a second window. */
  attachWindow: boolean;
  createdAt: string;
  updatedAt: string;
}

function newConfigId(): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `service-${Date.now().toString(36)}-${random}`;
}

function isStartupType(value: unknown): value is ServiceStartupType {
  return value === 'automatic' || value === 'delayed' || value === 'manual' || value === 'disabled';
}
function isAccount(value: unknown): value is ServiceAccount {
  return value === 'system' || value === 'user';
}
function isRecovery(value: unknown): value is ServiceRecovery {
  return value === 'restart' || value === 'none';
}
function isStartupKind(value: unknown): value is ServiceStartupKind {
  return value === 'service' || value === 'task' || value === 'folder';
}

export function readServiceConfigs(ctx: AppContext): ServiceConfig[] {
  const stored = ctx.settings.get<unknown>(SERVICES_SETTING_ID, []);
  if (!Array.isArray(stored)) return [];
  const out: ServiceConfig[] = [];
  for (const raw of stored) {
    if (!raw || typeof raw !== 'object') continue;
    const record = raw as Record<string, unknown>;
    const id = typeof record.id === 'string' && record.id !== '' ? record.id : newConfigId();
    const name = typeof record.name === 'string' && record.name.trim() !== '' ? record.name : 'Unnamed configuration';
    out.push({
      id,
      name,
      profileId: typeof record.profileId === 'string' ? record.profileId : '',
      startupType: isStartupType(record.startupType) ? record.startupType : 'manual',
      account: isAccount(record.account) ? record.account : 'system',
      recovery: isRecovery(record.recovery) ? record.recovery : 'none',
      startupKind: isStartupKind(record.startupKind) ? record.startupKind : 'service',
      attachWindow: typeof record.attachWindow === 'boolean' ? record.attachWindow : true,
      createdAt: typeof record.createdAt === 'string' ? record.createdAt : new Date(0).toISOString(),
      updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : new Date(0).toISOString()
    });
  }
  return out;
}

function writeServiceConfigs(ctx: AppContext, configs: ServiceConfig[]): void {
  // `ctx.settings.set` records this into local history automatically (see
  // `attachSettingsHistory` in `main.ts`) and fires `ctx.settings.onChange`,
  // which is the one thing every renderer of this screen listens to keep
  // itself current — no caller here needs to also push a manual re-render.
  ctx.settings.set(SERVICES_SETTING_ID, configs);
}

function updateConfig(ctx: AppContext, id: string, patch: Partial<ServiceConfig>): void {
  const configs = readServiceConfigs(ctx);
  const index = configs.findIndex((config) => config.id === id);
  if (index === -1) return;
  configs[index] = { ...configs[index], ...patch, updatedAt: new Date().toISOString() };
  writeServiceConfigs(ctx, configs);
}

/* ================================================================== */
/* Real, enumerated option sets                                        */
/* ================================================================== */

const STARTUP_TYPE_OPTIONS: Array<{ value: ServiceStartupType; label: string }> = [
  { value: 'automatic', label: 'Automatic' },
  { value: 'delayed', label: 'Automatic (delayed)' },
  { value: 'manual', label: 'Manual' },
  { value: 'disabled', label: 'Disabled' }
];

const ACCOUNT_OPTIONS: Array<{ value: ServiceAccount; label: string }> = [
  { value: 'system', label: 'LocalSystem' },
  { value: 'user', label: 'This user' }
];

const RECOVERY_OPTIONS: Array<{ value: ServiceRecovery; label: string }> = [
  { value: 'restart', label: 'Restart' },
  { value: 'none', label: 'Take no action' }
];

const STARTUP_KIND_INFO: Record<ServiceStartupKind, { title: string; body: string }> = {
  service: {
    title: 'Windows service',
    body: 'Runs before anyone signs in and keeps running after sign-out. Needs administrator once, at install.'
  },
  task: {
    title: 'Scheduled task at sign-in',
    body: 'Runs as you, with your drives and credentials. Stops when you sign out.'
  },
  folder: {
    title: 'Startup folder shortcut',
    body: 'Opens the window itself at sign-in. No elevation, easiest to remove.'
  }
};
const STARTUP_KIND_ORDER: ServiceStartupKind[] = ['service', 'task', 'folder'];

/* ================================================================== */
/* Actions — every one honest about whether it has a backing call       */
/* ================================================================== */

function reportNoServiceChannel(ctx: AppContext, config: ServiceConfig, action: string): void {
  ctx.notify.warn(
    ctx.t('shell.services.noChannel.title', 'Nothing happened'),
    ctx.t(
      'shell.services.noChannel.body',
      'This build has no channel to the Windows service manager, so "{action}" was not sent to "{name}". No process was started, stopped or touched, and no state changed here.',
      { values: { action, name: config.name } }
    )
  );
}

function handleStart(ctx: AppContext, config: ServiceConfig): void {
  reportNoServiceChannel(ctx, config, ctx.t('shell.services.action.start', 'Start'));
}

function handleRestart(ctx: AppContext, config: ServiceConfig): void {
  reportNoServiceChannel(ctx, config, ctx.t('shell.services.action.restart', 'Restart'));
}

async function handleStop(ctx: AppContext, config: ServiceConfig, anchor: HTMLElement): Promise<void> {
  const confirmed = await ctx.confirm.request({
    action: ctx.t('shell.services.confirm.stop.action', 'Stop "{name}"', { values: { name: config.name } }),
    affected: [
      ctx.t(
        'shell.services.confirm.stop.affected',
        'The "{name}" configuration, if anything happens to be running under some other name',
        { values: { name: config.name } }
      )
    ],
    irreversible: ctx.t(
      'shell.services.confirm.stop.irreversible',
      'This build has no channel to Windows services, so there is no real, registered service for it to find or stop. Confirming here touches nothing — no process is sent a signal.'
    ),
    anchor
  });
  if (!confirmed) return;
  reportNoServiceChannel(ctx, config, ctx.t('shell.services.action.stop', 'Stop'));
}

async function handleUninstall(ctx: AppContext, config: ServiceConfig, profileName: string, anchor: HTMLElement): Promise<void> {
  const confirmed = await ctx.confirm.request({
    action: ctx.t('shell.services.confirm.uninstall.action', 'Remove "{name}" from Services', { values: { name: config.name } }),
    affected: [
      ctx.t(
        'shell.services.confirm.uninstall.affected',
        'The saved configuration "{name}", which runs the "{profile}" profile',
        { values: { name: config.name, profile: profileName } }
      )
    ],
    irreversible: ctx.t(
      'shell.services.confirm.uninstall.irreversible',
      'This deletes the local configuration only. This build never registered a real Windows service, scheduled task or startup-folder shortcut for it, so there is nothing on Windows to remove. The profile itself and every world it has already downloaded stay exactly as they are.'
    ),
    anchor
  });
  if (!confirmed) return;
  const remaining = readServiceConfigs(ctx).filter((candidate) => candidate.id !== config.id);
  writeServiceConfigs(ctx, remaining);
  ctx.notify.success(
    ctx.t('shell.services.uninstalled.title', 'Removed'),
    ctx.t('shell.services.uninstalled.body', '"{name}" was removed from Services.', { values: { name: config.name } })
  );
}

async function openEventLog(ctx: AppContext): Promise<void> {
  const result = await ctx.studio.shell.openPath('C:\\Windows\\System32\\eventvwr.msc');
  if (!result.ok) {
    ctx.notify.error(
      ctx.t('shell.services.eventlog.failed.title', 'Could not open the event log'),
      result.error
    );
    return;
  }
  ctx.notify.info(
    ctx.t('shell.services.eventlog.opened.title', 'Opening the Windows event log'),
    ctx.t(
      'shell.services.eventlog.opened.body',
      'Look under Windows Logs → Application and Windows Logs → System for anything a real service would have written.'
    )
  );
}

/**
 * Install: a real guided form (a real, enumerated profile picker — never a
 * free-text guess at one), then the same super-confirmation gate Uninstall
 * and Stop use. Confirming never claims Windows now has this service; it
 * saves the configuration locally, which Uninstall can remove again at any
 * time, and states that plainly before the two keys are even offered.
 */
async function openInstallFlow(ctx: AppContext, anchor: HTMLElement, onInstalled: (id: string) => void): Promise<void> {
  const profiles = readProfiles(ctx);
  if (profiles.length === 0) return;

  const body = el('div', { className: 'svc-installform' });
  body.append(
    el('p', {
      className: 'md-typescale-body-medium svc-installform__notice',
      text: ctx.t(
        'shell.services.install.elevation',
        'Installing a real Windows service needs administrator, asked once at the moment it is needed. This build has no channel to the Windows service manager yet, so nothing is registered with Windows — confirming below only saves this configuration on this computer.'
      )
    })
  );

  const existing = readServiceConfigs(ctx);
  const defaultProfile = profiles[0];
  const nameField = guidedTextField({
    label: 'Service name',
    supportingText: 'Shown as the configuration name on this screen',
    suggested: { value: `WDS — ${defaultProfile.name}` },
    validate: (value) => {
      const trimmed = value.trim();
      if (trimmed === '') return 'A service name is required.';
      if (existing.some((candidate) => candidate.name.toLowerCase() === trimmed.toLowerCase())) {
        return `A saved configuration named "${trimmed}" already exists.`;
      }
      return null;
    }
  });
  nameField.root.classList.add('svc-installform__field');

  const profileField = guidedSelect({
    label: 'Profile it runs',
    options: profiles.map((profile) => ({ value: profile.id, label: profile.name })),
    value: defaultProfile.id
  });
  profileField.root.classList.add('svc-installform__field');

  body.append(nameField.root, profileField.root);

  const proceed = await ctx.components.dialog({
    title: ctx.t('shell.services.install.title', 'Install a profile as a service'),
    body,
    confirmLabel: ctx.t('shell.services.install.continue', 'Continue'),
    cancelLabel: ctx.t('core.action.cancel', 'Cancel')
  });
  if (!proceed) return;

  if (!nameField.revalidate()) {
    ctx.notify.warn(
      ctx.t('shell.services.install.invalid.title', 'That name will not work'),
      nameField.error() ?? ''
    );
    return;
  }

  const name = nameField.get().trim();
  const profileId = profileField.get();
  const profile = profiles.find((candidate) => candidate.id === profileId) ?? defaultProfile;

  const confirmed = await ctx.confirm.request({
    action: ctx.t('shell.services.confirm.install.action', 'Install "{name}" as a Windows service', { values: { name } }),
    affected: [
      ctx.t(
        'shell.services.confirm.install.affected',
        'A new saved configuration named "{name}", running the "{profile}" profile on this computer',
        { values: { name, profile: profile.name } }
      )
    ],
    irreversible: ctx.t(
      'shell.services.confirm.install.irreversible',
      'Nothing on Windows is touched: this build cannot register a real service, scheduled task or startup-folder shortcut yet. Confirming only saves this configuration in the application’s own settings, which Uninstall can remove again at any time.'
    ),
    anchor
  });
  if (!confirmed) return;

  const now = new Date().toISOString();
  const config: ServiceConfig = {
    id: newConfigId(),
    name,
    profileId,
    startupType: 'manual',
    account: 'system',
    recovery: 'none',
    startupKind: 'service',
    attachWindow: true,
    createdAt: now,
    updatedAt: now
  };
  onInstalled(config.id);
  writeServiceConfigs(ctx, [config, ...existing]);
  ctx.notify.success(
    ctx.t('shell.services.installed.title', 'Configuration saved'),
    ctx.t(
      'shell.services.installed.body',
      '"{name}" was saved. This build could not register it with Windows, so nothing will actually run until a real service-control channel exists.',
      { values: { name } }
    )
  );
}

function openServiceMenu(
  ctx: AppContext,
  config: ServiceConfig,
  profileName: string,
  anchor: HTMLElement
): void {
  const items: MenuItem[] = [
    menuItemWithShortcut('shell.services.start', {
      id: 'start',
      label: 'Start the service',
      icon: 'play',
      run: () => handleStart(ctx, config)
    }),
    { id: 'restart', label: 'Restart the service', icon: 'refresh', run: () => handleRestart(ctx, config) },
    { id: 'stop', label: 'Stop the service…', icon: 'stop', run: () => void handleStop(ctx, config, anchor) },
    {
      id: 'eventlog',
      label: 'Open the Windows event log',
      icon: 'terminal',
      separatorBefore: true,
      run: () => void openEventLog(ctx)
    },
    {
      id: 'uninstall',
      label: 'Uninstall the service…',
      icon: 'trash',
      danger: true,
      separatorBefore: true,
      run: () => void handleUninstall(ctx, config, profileName, anchor)
    }
  ];
  ctx.components.menu({
    anchor,
    label: ctx.t('shell.services.menu.label', '{name} actions', { values: { name: config.name } }),
    items
  });
}

/* ================================================================== */
/* Small row builders                                                  */
/* ================================================================== */

function buildInfoRow(labelText: string, valueText: string): HTMLElement {
  const row = el('div', { className: 'svc-inforow' });
  row.append(el('span', { className: 'md-typescale-body-medium svc-inforow__label', text: labelText }));
  row.append(el('b', { className: 'md-typescale-body-small svc-inforow__value', text: valueText }));
  return row;
}

function buildPickerRow(description: string, controlRoot: HTMLElement): HTMLElement {
  const row = el('div', { className: 'svc-inforow svc-inforow--picker' });
  row.append(controlRoot);
  row.append(el('span', { className: 'md-typescale-body-small svc-inforow__desc', text: description }));
  return row;
}

/* ================================================================== */
/* Mount                                                                */
/* ================================================================== */

function mountServices(host: HTMLElement, ctx: AppContext): () => void {
  host.textContent = '';
  host.classList.add('svc-screen');

  let selectedId: string | null = null;
  let matches: (haystack: string) => boolean = () => true;
  let rows: Array<{ config: ServiceConfig; node: HTMLButtonElement; haystack: string }> = [];

  const grid = el('div', { className: 'svc-grid' });
  const listPane = el('section', {
    className: 'svc-list',
    attrs: { 'aria-label': ctx.t('shell.services.list.label', 'Saved service configurations') }
  });
  const detailPane = el('section', { className: 'svc-detail' });
  grid.append(listPane, detailPane);
  host.append(grid);

  /* ---------------- left: search, capability note, list, install ---------------- */

  const searchHost = el('div', { className: 'svc-list__searchhost' });
  listPane.append(searchHost);

  const capabilityNote = el('p', {
    className: 'svc-list__capability md-typescale-body-small',
    text: ctx.t(
      'shell.services.capabilityNote',
      'This build has no channel to Windows services yet. Saved configurations describe what would be installed — nothing is registered with Windows, Task Scheduler or your Startup folder until that channel exists.'
    )
  });
  listPane.append(capabilityNote);

  const rowsContainer = el('div', { className: 'svc-list__rows' });
  const listEmpty = el('p', { className: 'svc-list__empty md-typescale-body-medium' });
  listPane.append(rowsContainer, listEmpty);

  const installButton = ctx.components.button({
    label: 'Install a profile as a service',
    variant: 'tonal',
    icon: 'add',
    onClick: () => {
      void openInstallFlow(ctx, installButton, (id) => {
        selectedId = id;
      });
    }
  });
  listPane.append(installButton);

  const note = el('p', {
    className: 'svc-list__note md-typescale-body-small',
    text: ctx.t(
      'shell.services.note',
      'Installing, removing or changing a service needs administrator. You are asked once, at the moment it is needed.'
    )
  });
  listPane.append(note);

  function refreshInstallAvailability(): void {
    const hasProfiles = readProfiles(ctx).length > 0;
    installButton.disabled = !hasProfiles;
    const reason = ctx.t(
      'shell.services.install.noProfiles',
      'Create a profile on the Profiles screen first — a service always runs one.'
    );
    if (!hasProfiles) {
      installButton.title = reason;
      installButton.setAttribute('aria-description', reason);
    } else {
      installButton.removeAttribute('title');
      installButton.removeAttribute('aria-description');
    }
  }

  const search = ctx.createSearchBar({
    label: 'Search services',
    placeholder: 'Search services',
    compact: true,
    sample: 'WDS — Andyville\nAndyville\nThis computer',
    onChange: (query) => {
      matches = query.matches;
      applyListFilter();
    }
  });
  searchHost.append(search.root);

  function applyListFilter(): void {
    if (rows.length === 0) return;
    let visible = 0;
    for (const row of rows) {
      const shown = matches(row.haystack);
      row.node.hidden = !shown;
      if (shown) visible += 1;
    }
    listEmpty.hidden = visible > 0;
    if (visible === 0) {
      listEmpty.textContent = ctx.t('shell.services.list.noMatches', 'Nothing matches that search.');
    }
  }

  function rebuildList(): void {
    const configs = readServiceConfigs(ctx);
    const profiles = readProfiles(ctx);
    const profileNameById = new Map(profiles.map((profile) => [profile.id, profile.name] as const));

    shell.setSubtitle(
      'services',
      ctx.t('shell.services.subtitle', '{count} saved configuration(s)', { values: { count: configs.length } })
    );

    rowsContainer.textContent = '';
    rows = [];

    if (configs.length === 0) {
      rowsContainer.hidden = true;
      listEmpty.hidden = false;
      listEmpty.textContent = ctx.t(
        'shell.services.list.empty',
        'No profile has been saved as a service yet. Install one below to run a profile without keeping this window open.'
      );
      selectedId = null;
      return;
    }
    rowsContainer.hidden = false;

    if (selectedId && !configs.some((config) => config.id === selectedId)) selectedId = null;
    if (!selectedId) selectedId = configs[0].id;

    for (const config of configs) {
      const profileName = profileNameById.get(config.profileId) ?? ctx.t('shell.services.profile.missing', 'a profile that no longer exists');
      const startupKindLabel = STARTUP_KIND_INFO[config.startupKind].title;
      const selected = config.id === selectedId;
      const row = el('button', {
        className: `svc-row${selected ? ' svc-row--selected' : ''}`,
        attrs: { type: 'button', 'aria-current': String(selected) }
      });
      const text = el('span', { className: 'svc-row__text' });
      text.append(
        el('b', { className: 'svc-row__name', text: config.name }),
        el('span', { className: 'svc-row__meta', text: `${profileName} · ${startupKindLabel}` })
      );
      row.append(text, ctx.components.badge({ label: 'Not installed', severity: 'warning' }));
      row.addEventListener('click', () => {
        if (selectedId === config.id) return;
        selectedId = config.id;
        syncRowSelection();
        renderDetail();
        ctx.a11y.announce(ctx.t('shell.services.list.selected', 'Showing {name}', { values: { name: config.name } }));
      });
      rowsContainer.append(row);
      rows.push({ config, node: row, haystack: `${config.name} ${profileName} ${startupKindLabel}` });
    }

    applyListFilter();
  }

  function syncRowSelection(): void {
    for (const row of rows) {
      const selected = row.config.id === selectedId;
      row.node.classList.toggle('svc-row--selected', selected);
      row.node.setAttribute('aria-current', String(selected));
    }
  }

  /* ---------------- right: detail ---------------- */

  function renderDetail(): void {
    detailPane.textContent = '';
    const configs = readServiceConfigs(ctx);
    const config = configs.find((candidate) => candidate.id === selectedId) ?? null;

    if (!config) {
      detailPane.append(
        ctx.components.emptyState({
          title: 'No configuration selected',
          body:
            configs.length === 0
              ? 'Install a profile as a service on the left to see its detail here.'
              : 'Choose a saved configuration on the left to see its detail here.'
        })
      );
      return;
    }

    const profiles = readProfiles(ctx);
    const profile = profiles.find((candidate) => candidate.id === config.profileId) ?? null;
    const profileName = profile ? profile.name : ctx.t('shell.services.profile.missing', 'a profile that no longer exists');

    /* -------- header: name, state, actions -------- */
    const headerCard = el('div', { className: 'svc-card svc-detail__header' });
    const headerTop = el('div', { className: 'svc-detail__headertop' });
    headerTop.append(
      el('span', { className: 'md-typescale-title-large', text: config.name }),
      ctx.components.badge({ label: 'Not installed', severity: 'warning' })
    );
    headerCard.append(headerTop);
    headerCard.append(
      el('p', {
        className: 'md-typescale-body-small svc-detail__subline',
        text: ctx.t('shell.services.detail.runs', 'Would run the "{profile}" profile on this computer', { values: { profile: profileName } })
      })
    );

    const actions = el('div', { className: 'svc-detail__actions' });
    const startButton = ctx.components.button({ label: 'Start', variant: 'filled', icon: 'play', onClick: () => handleStart(ctx, config) });
    const restartButton = ctx.components.button({ label: 'Restart', variant: 'outlined', icon: 'refresh', onClick: () => handleRestart(ctx, config) });
    const stopButton = ctx.components.button({
      label: 'Stop…',
      variant: 'filled',
      danger: true,
      icon: 'stop',
      onClick: () => void handleStop(ctx, config, stopButton)
    });
    const uninstallButton = ctx.components.button({
      label: 'Uninstall…',
      variant: 'outlined',
      icon: 'trash',
      onClick: () => void handleUninstall(ctx, config, profileName, uninstallButton)
    });
    actions.append(startButton, restartButton, stopButton, uninstallButton);
    headerCard.append(actions);

    // The design's `data-menu="service"` context menu (real keyboard shortcuts
    // resolved live from `core/menu.ts`, never a hand-typed guess — see
    // `shell.services.start` registered below; Restart/Stop/Uninstall show no
    // shortcut because none is genuinely bound, per `menuItemWithShortcut`'s
    // own contract, rather than showing a chord that would not fire).
    headerCard.addEventListener('contextmenu', (event) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      event.preventDefault();
      event.stopPropagation();
      openServiceMenu(ctx, config, profileName, headerCard);
    });

    detailPane.append(headerCard);

    /* -------- Service info card -------- */
    const infoCard = el('div', { className: 'svc-card' });
    infoCard.append(
      el('div', { className: 'svc-card__head', children: [el('b', { className: 'md-typescale-title-small', text: ctx.t('shell.services.detail.serviceHead', 'Service') })] })
    );

    const startupTypeSelect = ctx.components.select({
      label: 'Startup type',
      options: STARTUP_TYPE_OPTIONS,
      value: config.startupType,
      onChange: (value) => {
        if (isStartupType(value)) updateConfig(ctx, config.id, { startupType: value });
      }
    });
    infoCard.append(
      buildPickerRow(
        ctx.t('shell.services.detail.startupType.description', 'Automatic (delayed) starts after sign-in, so a network share is mounted first'),
        startupTypeSelect.root
      )
    );

    const accountSelect = ctx.components.select({
      label: 'Log on as',
      options: ACCOUNT_OPTIONS,
      value: config.account,
      onChange: (value) => {
        if (isAccount(value)) updateConfig(ctx, config.id, { account: value });
      }
    });
    infoCard.append(
      buildPickerRow(ctx.t('shell.services.detail.account.description', 'LocalSystem cannot reach mapped network drives'), accountSelect.root)
    );

    const recoverySelect = ctx.components.select({
      label: 'On failure',
      options: RECOVERY_OPTIONS,
      value: config.recovery,
      onChange: (value) => {
        if (isRecovery(value)) updateConfig(ctx, config.id, { recovery: value });
      }
    });
    infoCard.append(
      buildPickerRow(ctx.t('shell.services.detail.recovery.description', 'What Windows would do when the process exits non-zero'), recoverySelect.root)
    );

    infoCard.append(
      buildInfoRow(
        ctx.t('shell.services.detail.process.label', 'Process'),
        ctx.t('shell.services.detail.process.unavailable', 'Not available — no service-control channel')
      )
    );
    infoCard.append(
      buildInfoRow(
        ctx.t('shell.services.detail.lastOutcome.label', 'Last outcome'),
        ctx.t('shell.services.detail.lastOutcome.unavailable', 'Never installed — this build cannot report a real outcome')
      )
    );

    detailPane.append(infoCard);

    /* -------- Start with Windows: the three real mechanisms -------- */
    const startupCard = el('div', { className: 'svc-card' });
    const startupHead = el('div', { className: 'svc-card__head' });
    startupHead.append(
      el('b', { className: 'md-typescale-title-small', text: ctx.t('shell.services.detail.startupKind.head', 'Start with Windows') }),
      el('span', {
        className: 'md-typescale-body-small svc-card__headhint',
        text: ctx.t('shell.services.detail.startupKind.hint', 'Three real mechanisms, each with what it actually does')
      })
    );
    startupCard.append(startupHead);

    const fieldset = el('fieldset', {
      className: 'svc-startupkind',
      attrs: { 'aria-label': ctx.t('shell.services.detail.startupKind.head', 'Start with Windows') }
    });
    for (const kind of STARTUP_KIND_ORDER) {
      const info = STARTUP_KIND_INFO[kind];
      const optionId = nextId('svc-startupkind');
      const rowSelected = config.startupKind === kind;
      const rowLabel = el('label', {
        className: `svc-startupkind__row${rowSelected ? ' svc-startupkind__row--selected' : ''}`,
        attrs: { for: optionId }
      });
      const input = el('input', { attrs: { id: optionId, type: 'radio', name: `svc-startupkind-${config.id}` } });
      input.checked = rowSelected;
      input.addEventListener('change', () => {
        if (input.checked) updateConfig(ctx, config.id, { startupKind: kind });
      });
      const textBlock = el('span', { className: 'svc-startupkind__text' });
      textBlock.append(
        el('b', { className: 'md-typescale-body-medium', text: info.title }),
        el('span', { className: 'md-typescale-body-small svc-startupkind__desc', text: info.body })
      );
      rowLabel.append(input, textBlock);
      fieldset.append(rowLabel);
    }
    startupCard.append(fieldset);

    const attachHandle = ctx.components.switchControl({
      label:
        'Also open the window when the service is already running — the window attaches to the running session instead of starting a second one. Not wired to a live service yet: this only saves the preference.',
      checked: config.attachWindow,
      onChange: (checked) => updateConfig(ctx, config.id, { attachWindow: checked })
    });
    attachHandle.root.classList.add('svc-attachrow');
    startupCard.append(attachHandle.root);

    detailPane.append(startupCard);
  }

  /* ---------------- keep this screen live ---------------- */

  const unsubscribeSettings = ctx.settings.onChange((change) => {
    if (change.id === SERVICES_SETTING_ID) {
      rebuildList();
      renderDetail();
    } else if (change.id === PROFILES_SETTING_ID) {
      refreshInstallAvailability();
      rebuildList();
      renderDetail();
    }
  });
  const unsubscribeI18n = ctx.i18n.onChange(() => {
    rebuildList();
    renderDetail();
  });

  let unregisterStartShortcut: (() => void) | null = null;
  try {
    unregisterStartShortcut = shortcuts.register(
      { id: 'shell.services.start', chord: 'Ctrl+Enter', label: 'Start the selected service configuration' },
      () => {
        const config = readServiceConfigs(ctx).find((candidate) => candidate.id === selectedId);
        if (config) handleStart(ctx, config);
      }
    );
  } catch (error) {
    console.warn('Could not register the Services screen start shortcut:', error);
  }

  refreshInstallAvailability();
  rebuildList();
  renderDetail();

  return () => {
    search.destroy();
    unsubscribeSettings();
    unsubscribeI18n();
    unregisterStartShortcut?.();
  };
}

const servicesScreen: ScreenDefinition = {
  id: 'services',
  title: 'Services and startup',
  subtitle: 'Run a profile without the app open',
  icon: 'bolt',
  rail: 4,
  mount: mountServices
};

export default servicesScreen;
