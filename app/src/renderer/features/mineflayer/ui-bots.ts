/**
 * The "Bots" tab: saved connection profiles, live multi-bot sessions, the
 * guided connection form (row 15.1), and the live state read-out for
 * whichever bot is active (row 15.2). Several bots can be connected at once —
 * each gets its own row here and its own state without mixing (row 15.19).
 */

import type { TabContext } from '../../core/registry';
import type { AuthMode, BotState, ChatLevel, ConnectionOptions, MainHand, ViewDistanceName } from './protocol';
import type { BotManager, LiveBotSession } from './manager';
import { ProfileStore, defaultConnectionOptions, vaultAccountFor, type BotProfile } from './store';

function statusSeverity(status: LiveBotSession['status']): 'info' | 'success' | 'warning' | 'error' {
  if (status === 'spawned' || status === 'connected') return 'success';
  if (status === 'connecting' || status === 'reconnecting') return 'info';
  if (status === 'failed') return 'error';
  return 'info';
}

function formatVec(v: { x: number; y: number; z: number } | null): string {
  if (!v) return '—';
  return `${v.x.toFixed(2)}, ${v.y.toFixed(2)}, ${v.z.toFixed(2)}`;
}

export function mountBotsTab(host: HTMLElement, ctx: TabContext, manager: BotManager, profiles: ProfileStore): void {
  host.classList.add('mineflayer-bots');

  host.append(
    ctx.components.topAppBar({
      title: ctx.t('mineflayer.tab.bots', 'Bots'),
      subtitle: ctx.t('mineflayer.tab.bots.subtitle', 'Connections, live state and saved profiles')
    })
  );

  const runtimeCard = ctx.components.card({ variant: 'outlined' });
  runtimeCard.classList.add('mineflayer-runtime-card');
  runtimeCard.id = 'mineflayer-runtime-card';
  host.append(runtimeCard);

  const body = document.createElement('div');
  body.className = 'mineflayer-bots-body';
  host.append(body);

  const listSection = document.createElement('section');
  listSection.className = 'mineflayer-bots-list';
  listSection.setAttribute('aria-label', ctx.t('mineflayer.bots.listRegion', 'Saved profiles and live bots'));
  body.append(listSection);

  const detailSection = document.createElement('section');
  detailSection.className = 'mineflayer-bots-detail';
  detailSection.id = 'mineflayer-bot-detail';
  detailSection.setAttribute('aria-label', ctx.t('mineflayer.bots.detailRegion', 'Selected bot'));
  body.append(detailSection);

  /* ---------------------------------------------------------------- */
  /* Runtime status                                                    */
  /* ---------------------------------------------------------------- */

  function renderRuntimeCard(): void {
    runtimeCard.replaceChildren();
    const info = manager.runtime.getInfo();
    const row = document.createElement('div');
    row.className = 'mineflayer-runtime-row';

    const label = document.createElement('div');
    label.className = 'md-typescale-title-small';
    const statusText: Record<string, string> = {
      idle: ctx.t('mineflayer.runtime.idle', 'Bot runtime not started yet'),
      starting: ctx.t('mineflayer.runtime.starting', 'Starting the bot runtime…'),
      ready: ctx.t('mineflayer.runtime.ready', 'Bot runtime ready — {version}', {
        values: { version: info.handshake?.libraryVersion ?? '' }
      }),
      crashed: ctx.t('mineflayer.runtime.crashed', 'Bot runtime could not start'),
      unavailable: ctx.t('mineflayer.runtime.unavailable', 'Bot runtime unavailable'),
      stopped: ctx.t('mineflayer.runtime.stopped', 'Bot runtime stopped')
    };
    label.textContent = statusText[info.status] ?? info.status;
    row.append(label);
    row.append(
      ctx.components.badge({
        label: info.status,
        severity: info.status === 'ready' ? 'success' : info.status === 'starting' ? 'info' : info.status === 'idle' ? 'info' : 'error'
      })
    );

    if (info.status === 'idle' || info.status === 'crashed' || info.status === 'unavailable' || info.status === 'stopped') {
      row.append(
        ctx.components.button({
          label: ctx.t('mineflayer.runtime.start', 'Start runtime'),
          variant: 'tonal',
          icon: 'play',
          onClick: () => {
            manager.runtime
              .ensureStarted()
              .catch((error) => ctx.notify.error(ctx.t('mineflayer.runtime.startFailed', 'The bot runtime failed to start'), String(error)));
          }
        })
      );
    }
    runtimeCard.append(row);

    if (info.fault) {
      const faultText = document.createElement('p');
      faultText.className = 'md-typescale-body-medium mineflayer-runtime-fault';
      faultText.textContent = info.fault;
      runtimeCard.append(faultText);

      if (info.attemptedPaths.length > 0) {
        const details = document.createElement('details');
        const summary = document.createElement('summary');
        summary.textContent = ctx.t('mineflayer.runtime.attemptedPaths', 'Every path the runtime searched ({count})', {
          values: { count: info.attemptedPaths.length }
        });
        details.append(summary);
        const list = document.createElement('ul');
        list.className = 'mineflayer-attempted-list';
        for (const path of info.attemptedPaths) {
          const item = document.createElement('li');
          item.textContent = path;
          list.append(item);
        }
        details.append(list);
        runtimeCard.append(details);
      }
    }
  }

  /* ---------------------------------------------------------------- */
  /* Bot rows: profiles unioned with live-only (quick-connect) sessions */
  /* ---------------------------------------------------------------- */

  interface Row {
    key: string;
    profile: BotProfile | null;
    session: LiveBotSession | null;
  }

  function buildRows(): Row[] {
    const sessions = manager.listSessions();
    const sessionByProfile = new Map<string, LiveBotSession>();
    const quickSessions: LiveBotSession[] = [];
    for (const session of sessions) {
      if (session.source.kind === 'profile') sessionByProfile.set(session.source.profileId, session);
      else quickSessions.push(session);
    }
    const rows: Row[] = profiles.list().map((profile) => ({
      key: 'profile:' + profile.id,
      profile,
      session: sessionByProfile.get(profile.id) ?? null
    }));
    for (const session of quickSessions) {
      rows.push({ key: 'quick:' + session.botId, profile: null, session });
    }
    return rows;
  }

  let selectedKeys = new Set<string>();
  let filterQuery = '';

  const search = ctx.createSearchBar({
    label: ctx.t('mineflayer.bots.search', 'Search profiles and bots'),
    sample: buildRows()
      .map((row) => row.profile?.name ?? row.session?.options.username ?? '')
      .join('\n'),
    onChange: (query) => {
      filterQuery = query.text;
      renderList(query.matches);
    }
  });
  listSection.append(search.root);
  ctx.onDispose(() => search.destroy());

  const toolbar = document.createElement('div');
  toolbar.className = 'mineflayer-bots-toolbar';
  listSection.append(toolbar);

  const newProfileButton = ctx.components.button({
    label: ctx.t('mineflayer.bots.newProfile', 'New profile'),
    variant: 'filled',
    icon: 'add',
    onClick: () => openProfileEditor(null)
  });
  toolbar.append(newProfileButton);

  const quickConnectButton = ctx.components.button({
    label: ctx.t('mineflayer.bots.quickConnect', 'Quick connect'),
    variant: 'outlined',
    icon: 'play',
    onClick: () => openQuickConnect()
  });
  toolbar.append(quickConnectButton);

  const bulkDeleteHost = document.createElement('span');
  toolbar.append(bulkDeleteHost);

  const exportButton = ctx.components.button({
    label: ctx.t('core.action.export', 'Export'),
    variant: 'text',
    icon: 'download',
    onClick: () => {
      void exportProfiles();
    }
  });
  toolbar.append(exportButton);

  const listHost = document.createElement('div');
  listHost.className = 'mineflayer-bots-list-host';
  listSection.append(listHost);

  function updateBulkButton(): void {
    const count = [...selectedKeys].filter((key) => key.startsWith('profile:')).length;
    bulkDeleteHost.replaceChildren(
      ctx.components.button({
        label:
          count === 0
            ? ctx.t('mineflayer.bots.deleteSelected', 'Delete selected')
            : ctx.t('mineflayer.bots.deleteSelectedCount', 'Delete {count} selected', { values: { count } }),
        variant: 'text',
        icon: 'trash',
        danger: true,
        disabled: count === 0,
        disabledReason:
          count === 0 ? ctx.t('mineflayer.bots.deleteSelected.reason', 'Select one or more saved profiles first.') : undefined,
        onClick: (event) => {
          void deleteSelected(event.currentTarget as HTMLElement);
        }
      })
    );
  }

  async function deleteSelected(anchor: HTMLElement): Promise<void> {
    const ids = [...selectedKeys]
      .filter((key) => key.startsWith('profile:'))
      .map((key) => key.slice('profile:'.length));
    if (ids.length === 0) return;
    const named = ids.map((id) => profiles.get(id)?.name ?? id);
    const approved = await ctx.confirm.request({
      action: ctx.t('mineflayer.bots.deleteAction', 'Delete {count} saved bot profiles', { values: { count: ids.length } }),
      affected: named,
      irreversible: ctx.t(
        'mineflayer.bots.deleteIrreversible',
        'Every listed profile and any vaulted password for it is removed. Any bot currently connected from one keeps running until you disconnect it separately.'
      ),
      anchor
    });
    if (!approved) return;
    const removed = await profiles.remove(ids);
    await ctx.history.record(
      ctx.t('mineflayer.bots.deleteRecorded', 'Deleted {count} saved bot profiles', { values: { count: removed.length } }),
      'mineflayer',
      { ids: removed }
    );
    selectedKeys = new Set([...selectedKeys].filter((key) => !key.startsWith('profile:') || !ids.includes(key.slice(7))));
    ctx.notify.success(
      ctx.t('mineflayer.bots.deleted', 'Profiles deleted'),
      ctx.t('mineflayer.bots.deletedBody', '{count} saved profiles removed.', { values: { count: removed.length } })
    );
    renderAll();
  }

  async function exportProfiles(): Promise<void> {
    const rows = profiles.list().map((profile) => ({
      id: profile.id,
      name: profile.name,
      host: profile.options.host,
      port: profile.options.port,
      username: profile.options.username,
      auth: profile.options.auth,
      version: profile.options.version || '(auto)',
      lastConnectedAt: profile.lastConnectedAt ?? ''
    }));
    const path = await ctx.exporter.save(rows, 'json', {
      name: 'mineflayer-profiles',
      defaultFileName: 'mineflayer-profiles.json'
    });
    if (path) ctx.notify.success(ctx.t('core.export.saved', 'Exported'), path);
  }

  function renderList(matches: (value: string) => boolean = () => true): void {
    listHost.replaceChildren();
    const rows = buildRows().filter((row) => matches(row.profile?.name ?? row.session?.options.username ?? row.key));
    if (rows.length === 0) {
      listHost.append(
        ctx.components.emptyState({
          title: filterQuery
            ? ctx.t('core.search.noMatches', 'No matches')
            : ctx.t('mineflayer.bots.empty', 'No bots yet'),
          body: filterQuery
            ? ctx.t('mineflayer.bots.emptySearch', 'Nothing here matches "{query}".', { values: { query: filterQuery } })
            : ctx.t('mineflayer.bots.emptyBody', 'Save a profile or quick-connect to put a bot on a server.'),
          action: filterQuery
            ? undefined
            : { label: ctx.t('mineflayer.bots.newProfile', 'New profile'), onClick: () => openProfileEditor(null) }
        })
      );
      updateBulkButton();
      return;
    }

    const list = ctx.components.list({ label: ctx.t('mineflayer.bots.listRegion', 'Saved profiles and live bots') });
    for (const row of rows) {
      const isActive = row.session ? row.session.botId === manager.activeBotIdValue() : false;
      const status = row.session?.status ?? null;
      const name = row.profile?.name ?? row.session?.options.username ?? row.key;
      const host = row.profile?.options.host ?? row.session?.options.host ?? '';
      const port = row.profile?.options.port ?? row.session?.options.port ?? '';
      const supporting = status
        ? `${host}:${port} — ${ctx.t('mineflayer.status.' + status, status)}`
        : `${host}:${port}`;

      const trailing = document.createElement('div');
      trailing.className = 'mineflayer-row-actions';
      if (status && (status === 'connected' || status === 'spawned' || status === 'reconnecting' || status === 'connecting')) {
        trailing.append(
          ctx.components.iconButton({
            icon: 'stop',
            label: ctx.t('mineflayer.bots.disconnect', 'Disconnect {name}', { values: { name } }),
            onClick: (event) => {
              event.stopPropagation();
              void manager.disconnect(row.session!.botId, ctx.t('mineflayer.bots.disconnectReason', 'Disconnected from the Bots tab.'));
            }
          })
        );
      } else {
        trailing.append(
          ctx.components.iconButton({
            icon: 'play',
            label: ctx.t('mineflayer.bots.connect', 'Connect {name}', { values: { name } }),
            onClick: (event) => {
              event.stopPropagation();
              void connectRow(row);
            }
          })
        );
      }
      if (row.profile) {
        trailing.append(
          ctx.components.iconButton({
            icon: 'edit',
            label: ctx.t('mineflayer.bots.edit', 'Edit {name}', { values: { name } }),
            onClick: (event) => {
              event.stopPropagation();
              openProfileEditor(row.profile);
            }
          })
        );
      }
      if (row.session) {
        trailing.append(
          ctx.components.iconButton({
            icon: 'close',
            label: ctx.t('mineflayer.bots.forget', 'Forget {name}\'s live session', { values: { name } }),
            onClick: (event) => {
              event.stopPropagation();
              void manager.forget(row.session!.botId);
            }
          })
        );
      }

      const item = ctx.components.listItem({
        id: 'mineflayer-row-' + row.key.replace(/[^a-zA-Z0-9_-]/g, '_'),
        headline: name,
        supporting,
        leadingIcon: 'world',
        trailing,
        selected: isActive,
        selectable: true,
        onActivate: () => {
          if (row.session) manager.setActive(row.session.botId);
        },
        onSelectChange: (selected) => {
          if (selected) selectedKeys.add(row.key);
          else selectedKeys.delete(row.key);
          updateBulkButton();
        }
      });
      list.append(item);
    }
    listHost.append(list);
    updateBulkButton();
  }

  async function connectRow(row: Row): Promise<void> {
    try {
      if (row.profile) {
        await manager.connectProfile(row.profile.id);
      } else if (row.session) {
        await manager.connectQuick(row.session.options);
      }
    } catch (error) {
      ctx.notify.error(ctx.t('mineflayer.bots.connectFailed', 'Could not connect'), String(error instanceof Error ? error.message : error));
    }
  }

  /* ---------------------------------------------------------------- */
  /* Connection form (profile editor and quick connect)                */
  /* ---------------------------------------------------------------- */

  function buildConnectionForm(
    initial: ConnectionOptions,
    initialName: string,
    kind: 'profile' | 'quick'
  ): {
    root: HTMLElement;
    read(): { name: string; options: ConnectionOptions; secret: string | null };
  } {
    const form = document.createElement('div');
    form.className = 'mineflayer-form';

    let name = initialName;
    let secret = '';

    const nameField =
      kind === 'profile'
        ? ctx.components.textField({
            label: ctx.t('mineflayer.form.name', 'Profile name'),
            value: initialName,
            onChange: (value) => {
              name = value;
            }
          })
        : null;
    if (nameField) form.append(nameField.root);

    const options: ConnectionOptions = { ...initial, reconnect: { ...initial.reconnect } };

    const hostField = ctx.components.textField({
      label: ctx.t('mineflayer.form.host', 'Server address'),
      value: options.host,
      placeholder: 'play.example.net',
      supportingText: ctx.t('mineflayer.form.host.description', 'The hostname or IP address of the Minecraft server.'),
      onChange: (value) => {
        options.host = value;
      }
    });
    const portField = ctx.components.textField({
      label: ctx.t('mineflayer.form.port', 'Port'),
      value: String(options.port),
      type: 'number',
      min: 1,
      max: 65535,
      onChange: (value) => {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) options.port = Math.round(parsed);
      }
    });
    const usernameField = ctx.components.textField({
      label: ctx.t('mineflayer.form.username', 'Username'),
      value: options.username,
      supportingText: ctx.t('mineflayer.form.username.description', 'The account name the bot logs in as.'),
      onChange: (value) => {
        options.username = value;
      }
    });

    const authSelect = ctx.components.select({
      label: ctx.t('mineflayer.form.auth', 'Authentication'),
      value: options.auth,
      options: [
        { value: 'offline', label: ctx.t('mineflayer.form.auth.offline', 'Offline (cracked / LAN server)') },
        { value: 'microsoft', label: ctx.t('mineflayer.form.auth.microsoft', 'Microsoft account (device sign-in)') },
        { value: 'mojang', label: ctx.t('mineflayer.form.auth.mojang', 'Legacy Mojang account (email + password)') }
      ],
      onChange: (value) => {
        options.auth = value as AuthMode;
        secretField.root.hidden = value !== 'mojang';
      }
    });

    const secretField = ctx.components.textField({
      label: ctx.t('mineflayer.form.password', 'Account password'),
      type: 'password',
      supportingText: ctx.t(
        'mineflayer.form.password.description',
        'Stored only in the operating system credential vault, read back only at the moment of connecting. Leave blank to keep the currently stored password.'
      ),
      onChange: (value) => {
        secret = value;
      }
    });
    secretField.root.hidden = options.auth !== 'mojang';

    const versionField = ctx.components.textField({
      label: ctx.t('mineflayer.form.version', 'Minecraft version'),
      value: options.version,
      placeholder: ctx.t('mineflayer.form.version.placeholder', 'Leave blank to auto-detect'),
      supportingText: ctx.t('mineflayer.form.version.description', 'Empty lets the library ask the server which version to speak.'),
      onChange: (value) => {
        options.version = value;
      }
    });

    const viewDistanceSelect = ctx.components.select({
      label: ctx.t('mineflayer.form.viewDistance', 'View distance'),
      value: options.viewDistance,
      options: [
        { value: 'far', label: ctx.t('mineflayer.form.viewDistance.far', 'Far') },
        { value: 'normal', label: ctx.t('mineflayer.form.viewDistance.normal', 'Normal') },
        { value: 'short', label: ctx.t('mineflayer.form.viewDistance.short', 'Short') },
        { value: 'tiny', label: ctx.t('mineflayer.form.viewDistance.tiny', 'Tiny') }
      ],
      onChange: (value) => {
        options.viewDistance = value as ViewDistanceName;
      }
    });

    const chatSelect = ctx.components.select({
      label: ctx.t('mineflayer.form.chat', 'Chat visibility'),
      value: options.chat,
      options: [
        { value: 'enabled', label: ctx.t('mineflayer.form.chat.enabled', 'Enabled') },
        { value: 'commandsOnly', label: ctx.t('mineflayer.form.chat.commandsOnly', 'Commands only') },
        { value: 'disabled', label: ctx.t('mineflayer.form.chat.disabled', 'Disabled') }
      ],
      onChange: (value) => {
        options.chat = value as ChatLevel;
      }
    });

    const mainHandSelect = ctx.components.select({
      label: ctx.t('mineflayer.form.mainHand', 'Main hand'),
      value: options.mainHand,
      options: [
        { value: 'right', label: ctx.t('mineflayer.form.mainHand.right', 'Right') },
        { value: 'left', label: ctx.t('mineflayer.form.mainHand.left', 'Left') }
      ],
      onChange: (value) => {
        options.mainHand = value as MainHand;
      }
    });

    const colorsSwitch = ctx.components.switchControl({
      label: ctx.t('mineflayer.form.colors', 'Render chat colours'),
      checked: options.colorsEnabled,
      onChange: (value) => {
        options.colorsEnabled = value;
      }
    });
    const physicsSwitch = ctx.components.switchControl({
      label: ctx.t('mineflayer.form.physics', 'Physics enabled'),
      checked: options.physicsEnabled,
      onChange: (value) => {
        options.physicsEnabled = value;
      }
    });
    const respawnSwitch = ctx.components.switchControl({
      label: ctx.t('mineflayer.form.respawn', 'Respawn automatically'),
      checked: options.respawn,
      onChange: (value) => {
        options.respawn = value;
      }
    });

    const proxyHostField = ctx.components.textField({
      label: ctx.t('mineflayer.form.proxyHost', 'SOCKS5 proxy host'),
      value: options.proxyHost,
      supportingText: ctx.t('mineflayer.form.proxyHost.description', 'Leave blank to connect directly, with no proxy.'),
      onChange: (value) => {
        options.proxyHost = value;
      }
    });
    const proxyPortField = ctx.components.textField({
      label: ctx.t('mineflayer.form.proxyPort', 'Proxy port'),
      value: String(options.proxyPort),
      type: 'number',
      min: 1,
      max: 65535,
      onChange: (value) => {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) options.proxyPort = Math.round(parsed);
      }
    });

    const reconnectSwitch = ctx.components.switchControl({
      label: ctx.t('mineflayer.form.reconnect', 'Reconnect automatically'),
      checked: options.reconnect.enabled,
      onChange: (value) => {
        options.reconnect.enabled = value;
      }
    });
    const reconnectOnKickSwitch = ctx.components.switchControl({
      label: ctx.t('mineflayer.form.reconnectOnKick', 'Reconnect after being kicked, not only after a dropped connection'),
      checked: options.reconnect.onKick,
      onChange: (value) => {
        options.reconnect.onKick = value;
      }
    });
    const reconnectMaxField = ctx.components.textField({
      label: ctx.t('mineflayer.form.reconnectMax', 'Maximum reconnect attempts (0 = unlimited)'),
      value: String(options.reconnect.maxAttempts),
      type: 'number',
      min: 0,
      onChange: (value) => {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) options.reconnect.maxAttempts = Math.max(0, Math.round(parsed));
      }
    });

    const grid = document.createElement('div');
    grid.className = 'mineflayer-form-grid';
    grid.append(
      hostField.root,
      portField.root,
      usernameField.root,
      authSelect.root,
      secretField.root,
      versionField.root,
      viewDistanceSelect.root,
      chatSelect.root,
      mainHandSelect.root
    );
    form.append(grid);

    const switches = document.createElement('div');
    switches.className = 'mineflayer-form-switches';
    switches.append(colorsSwitch.root, physicsSwitch.root, respawnSwitch.root);
    form.append(switches);

    form.append(ctx.components.sectionHeading({ title: ctx.t('mineflayer.form.proxy', 'Proxy (optional)') }));
    const proxyGrid = document.createElement('div');
    proxyGrid.className = 'mineflayer-form-grid';
    proxyGrid.append(proxyHostField.root, proxyPortField.root);
    form.append(proxyGrid);

    form.append(ctx.components.sectionHeading({ title: ctx.t('mineflayer.form.reconnectHeading', 'Reconnect policy') }));
    const reconnectGrid = document.createElement('div');
    reconnectGrid.className = 'mineflayer-form-switches';
    reconnectGrid.append(reconnectSwitch.root, reconnectOnKickSwitch.root, reconnectMaxField.root);
    form.append(reconnectGrid);

    return {
      root: form,
      read: () => ({ name, options, secret: secret.length > 0 ? secret : null })
    };
  }

  function openProfileEditor(existing: BotProfile | null): void {
    const overlay = ctx.overlay.open({
      anchor: newProfileButton,
      role: 'dialog',
      label: existing ? ctx.t('mineflayer.form.editTitle', 'Edit profile') : ctx.t('mineflayer.form.createTitle', 'New profile'),
      resizeKey: 'mineflayer.profileEditor'
    });
    overlay.body.classList.add('mineflayer-editor');
    const heading = document.createElement('h2');
    heading.className = 'md-typescale-title-medium';
    heading.textContent = existing ? ctx.t('mineflayer.form.editTitle', 'Edit profile') : ctx.t('mineflayer.form.createTitle', 'New profile');
    overlay.body.append(heading);

    const initialOptions = existing ? existing.options : defaultConnectionOptions(ctx);
    const form = buildConnectionForm(initialOptions, existing?.name ?? '', 'profile');
    overlay.body.append(form.root);

    const actions = document.createElement('div');
    actions.className = 'mineflayer-editor-actions';
    actions.append(
      ctx.components.button({
        label: ctx.t('core.action.cancel', 'Cancel'),
        variant: 'text',
        onClick: () => overlay.close()
      }),
      ctx.components.button({
        label: ctx.t('core.action.save', 'Save'),
        variant: 'filled',
        onClick: async () => {
          const { name, options, secret } = form.read();
          const trimmedName = name.trim().length > 0 ? name.trim() : options.username || options.host || ctx.t('mineflayer.form.unnamed', 'Unnamed bot');
          let profile: BotProfile;
          if (existing) {
            profile = profiles.update(existing.id, { name: trimmedName, options }) ?? existing;
          } else {
            profile = profiles.create(trimmedName, options);
          }
          if (options.auth === 'mojang' && secret) {
            await ctx.studio.vault.set(vaultAccountFor(profile.id), secret);
          }
          await ctx.history.record(
            existing
              ? ctx.t('mineflayer.form.recordedUpdate', 'Updated the bot profile "{name}"', { values: { name: trimmedName } })
              : ctx.t('mineflayer.form.recordedCreate', 'Created the bot profile "{name}"', { values: { name: trimmedName } }),
            'mineflayer',
            { id: profile.id }
          );
          ctx.notify.success(ctx.t('mineflayer.form.saved', 'Profile saved'), trimmedName);
          overlay.close();
          renderAll();
        }
      })
    );
    overlay.body.append(actions);
  }

  function openQuickConnect(): void {
    const overlay = ctx.overlay.open({
      anchor: quickConnectButton,
      role: 'dialog',
      label: ctx.t('mineflayer.bots.quickConnect', 'Quick connect'),
      resizeKey: 'mineflayer.quickConnect'
    });
    overlay.body.classList.add('mineflayer-editor');
    const heading = document.createElement('h2');
    heading.className = 'md-typescale-title-medium';
    heading.textContent = ctx.t('mineflayer.bots.quickConnect', 'Quick connect');
    overlay.body.append(heading);
    const note = document.createElement('p');
    note.className = 'md-typescale-body-medium';
    note.textContent = ctx.t('mineflayer.form.quickConnectNote', 'Connects once without saving a profile.');
    overlay.body.append(note);

    const form = buildConnectionForm(defaultConnectionOptions(ctx), '', 'quick');
    overlay.body.append(form.root);

    const actions = document.createElement('div');
    actions.className = 'mineflayer-editor-actions';
    actions.append(
      ctx.components.button({ label: ctx.t('core.action.cancel', 'Cancel'), variant: 'text', onClick: () => overlay.close() }),
      ctx.components.button({
        label: ctx.t('mineflayer.bots.connect.plain', 'Connect'),
        variant: 'filled',
        icon: 'play',
        onClick: async () => {
          const { options, secret } = form.read();
          overlay.close();
          try {
            await manager.connectQuick(options, secret ?? undefined);
          } catch (error) {
            ctx.notify.error(ctx.t('mineflayer.bots.connectFailed', 'Could not connect'), String(error instanceof Error ? error.message : error));
          }
        }
      })
    );
    overlay.body.append(actions);
  }

  /* ---------------------------------------------------------------- */
  /* Detail panel                                                      */
  /* ---------------------------------------------------------------- */

  function renderDetail(): void {
    detailSection.replaceChildren();
    const session = manager.activeSession();
    if (!session) {
      detailSection.append(
        ctx.components.emptyState({
          title: ctx.t('mineflayer.detail.empty', 'No bot selected'),
          body: ctx.t('mineflayer.detail.emptyBody', 'Connect a saved profile or use quick connect, then select it here.')
        })
      );
      return;
    }

    const heading = document.createElement('h2');
    heading.className = 'md-typescale-title-medium';
    heading.textContent = session.source.kind === 'profile' ? session.source.profileName : session.options.username;
    detailSection.append(heading);

    const statusRow = document.createElement('div');
    statusRow.className = 'mineflayer-detail-status';
    statusRow.append(
      ctx.components.badge({ label: ctx.t('mineflayer.status.' + session.status, session.status), severity: statusSeverity(session.status) })
    );
    if (session.statusDetail) {
      const detail = document.createElement('span');
      detail.className = 'md-typescale-body-medium';
      detail.textContent = session.statusDetail;
      statusRow.append(detail);
    }
    detailSection.append(statusRow);

    if (session.signIn) {
      const signInCard = ctx.components.card({ variant: 'filled' });
      const title = document.createElement('div');
      title.className = 'md-typescale-title-small';
      title.textContent = ctx.t('mineflayer.detail.signInTitle', 'Microsoft sign-in needed');
      signInCard.append(title);
      const code = document.createElement('div');
      code.className = 'md-typescale-headline-small mineflayer-signin-code';
      code.textContent = session.signIn.code;
      signInCard.append(code);
      const message = document.createElement('p');
      message.className = 'md-typescale-body-medium';
      message.textContent = session.signIn.message || session.signIn.url;
      signInCard.append(message);
      if (session.signIn.url) {
        signInCard.append(
          ctx.components.button({
            label: ctx.t('mineflayer.manager.signInOpen', 'Open the sign-in page'),
            variant: 'tonal',
            onClick: () => {
              void ctx.studio.shell.openExternal(session.signIn!.url);
            }
          })
        );
      }
      detailSection.append(signInCard);
    }

    const state: BotState | null = session.state;
    const cards = document.createElement('div');
    cards.className = 'mineflayer-state-cards';
    const entries: Array<[string, string]> = [
      [ctx.t('mineflayer.state.health', 'Health'), state?.health != null ? `${state.health.toFixed(1)} / 20` : '—'],
      [ctx.t('mineflayer.state.food', 'Food'), state?.food != null ? `${state.food} / 20` : '—'],
      [ctx.t('mineflayer.state.saturation', 'Saturation'), state?.foodSaturation != null ? state.foodSaturation.toFixed(1) : '—'],
      [ctx.t('mineflayer.state.oxygen', 'Oxygen'), state?.oxygenLevel != null ? `${state.oxygenLevel} / 20` : '—'],
      [
        ctx.t('mineflayer.state.experience', 'Experience'),
        state?.experienceLevel != null
          ? `${ctx.t('mineflayer.state.level', 'Level')} ${state.experienceLevel} (${Math.round((state.experienceProgress ?? 0) * 100)}%)`
          : '—'
      ],
      [ctx.t('mineflayer.state.gameMode', 'Game mode'), state?.gameMode ?? '—'],
      [ctx.t('mineflayer.state.dimension', 'Dimension'), state?.dimension ?? '—'],
      [ctx.t('mineflayer.state.position', 'Position'), formatVec(state?.position ?? null)],
      [ctx.t('mineflayer.state.velocity', 'Velocity'), formatVec(state?.velocity ?? null)],
      [
        ctx.t('mineflayer.state.facing', 'Facing'),
        state?.yaw != null && state?.pitch != null
          ? `${ctx.t('mineflayer.state.yaw', 'yaw')} ${state.yaw.toFixed(2)}, ${ctx.t('mineflayer.state.pitch', 'pitch')} ${state.pitch.toFixed(2)}`
          : '—'
      ],
      [ctx.t('mineflayer.state.onGround', 'On ground'), state?.onGround == null ? '—' : state.onGround ? ctx.t('core.value.yes', 'Yes') : ctx.t('core.value.no', 'No')],
      [ctx.t('mineflayer.state.heldItem', 'Held item'), state?.heldItem ? state.heldItem.displayName : ctx.t('mineflayer.state.empty', 'Empty hand')],
      [ctx.t('mineflayer.state.time', 'Time of day'), state?.timeOfDay != null ? `${state.timeOfDay} (${state.isDay ? ctx.t('mineflayer.state.day', 'day') : ctx.t('mineflayer.state.night', 'night')})` : '—'],
      [ctx.t('mineflayer.state.weather', 'Weather'), state?.isRaining == null ? '—' : state.isRaining ? ctx.t('mineflayer.state.raining', 'Raining') : ctx.t('mineflayer.state.clear', 'Clear')],
      [ctx.t('mineflayer.state.players', 'Players online'), state?.playerCount != null ? String(state.playerCount) : '—'],
      [ctx.t('mineflayer.state.entities', 'Nearby entities'), state?.entityCount != null ? String(state.entityCount) : '—'],
      [ctx.t('mineflayer.state.serverVersion', 'Server version'), state?.version ?? '—'],
      [ctx.t('mineflayer.state.serverBrand', 'Server brand'), state?.serverBrand ?? '—']
    ];
    for (const [label, value] of entries) {
      const card = ctx.components.card({ variant: 'outlined' });
      card.classList.add('mineflayer-state-card');
      const labelEl = document.createElement('div');
      labelEl.className = 'md-typescale-label-medium';
      labelEl.textContent = label;
      const valueEl = document.createElement('div');
      valueEl.className = 'md-typescale-body-large';
      valueEl.textContent = value;
      card.append(labelEl, valueEl);
      cards.append(card);
    }
    detailSection.append(cards);

    if (session.endReason) {
      const endReason = document.createElement('p');
      endReason.className = 'md-typescale-body-medium mineflayer-end-reason';
      endReason.textContent = ctx.t('mineflayer.detail.endReason', 'Last disconnect reason: {reason}', { values: { reason: session.endReason } });
      detailSection.append(endReason);
    }
  }

  function renderAll(): void {
    renderRuntimeCard();
    renderList((value) => search.query().matches(value));
    renderDetail();
  }

  const unsubscribeManager = manager.onChange(renderAll);
  const unsubscribeActive = manager.onActiveChange(renderDetail);
  const unsubscribeProfiles = profiles.onChange(renderAll);
  const unsubscribeRuntime = manager.runtime.onInfoChange(renderRuntimeCard);

  ctx.onDispose(() => {
    unsubscribeManager();
    unsubscribeActive();
    unsubscribeProfiles();
    unsubscribeRuntime();
  });

  renderAll();
}
