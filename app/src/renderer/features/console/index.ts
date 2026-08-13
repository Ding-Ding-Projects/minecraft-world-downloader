/**
 * The console feature module.
 *
 * The web management console (`web/app.py`) is a Flask application that
 * normally runs as a Docker container's main process and is driven from a
 * browser. This feature talks to that exact same process over loopback,
 * through its real JSON API, and renders every one of its capabilities —
 * installation, service lifecycle, configuration, Minecraft account
 * sign-in, worlds, stored records, logs and the auto-explore bot — as real
 * native controls. It never embeds the dashboard in a web view: `client.ts`
 * speaks the console's HTTP routes directly, `controller.ts` owns the
 * observed state, and `panel.ts` renders it.
 */

import './styles.css';

import type { FeatureModule, PaletteEntry, SettingsSection } from '../../core/registry';
import { CONSOLE_DOCS } from './docs';
import { mountConsole } from './panel';
import { PYTHON_COMMANDS } from './service';
import { CONSOLE_ANCHORS, CONSOLE_PASSWORD_ACCOUNT, CONSOLE_SETTINGS, CONSOLE_TAB_ID } from './settingsIds';
import { CONSOLE_STRINGS } from './strings';

function settingsSection(): SettingsSection {
  return {
    id: 'console',
    title: 'console.settings.section',
    icon: 'terminal',
    order: 230,
    controls: [
      {
        id: CONSOLE_SETTINGS.serviceDirectory,
        label: 'console.settings.serviceDirectory',
        description: 'console.settings.serviceDirectory.description',
        kind: 'folder',
        defaultValue: '',
        keywords: ['console', 'folder', 'app.py', 'flask', 'web']
      },
      {
        id: CONSOLE_SETTINGS.dataDirectory,
        label: 'console.settings.dataDirectory',
        description: 'console.settings.dataDirectory.description',
        kind: 'folder',
        defaultValue: '',
        keywords: ['console', 'data', 'worlds', 'exports', 'DATA_DIR']
      },
      {
        id: CONSOLE_SETTINGS.pythonCommand,
        label: 'console.settings.pythonCommand',
        description: 'console.settings.pythonCommand.description',
        kind: 'select',
        defaultValue: 'py',
        options: PYTHON_COMMANDS.map((command) => ({ value: command, label: command })),
        keywords: ['python', 'launcher', 'py', 'console'],
        validate: (value) => ((PYTHON_COMMANDS as readonly string[]).includes(String(value)) ? null : 'Choose one of the offered launchers.')
      },
      {
        id: CONSOLE_SETTINGS.port,
        label: 'console.settings.port',
        description: 'console.settings.port.description',
        kind: 'number',
        defaultValue: 8080,
        min: 1,
        max: 65535,
        step: 1,
        keywords: ['console', 'port', 'loopback', 'WEB_PORT'],
        validate: (value) => {
          const port = Number(value);
          return Number.isInteger(port) && port >= 1 && port <= 65535 ? null : 'A port is a whole number from 1 to 65535.';
        }
      },
      {
        id: CONSOLE_SETTINGS.jarPath,
        label: 'console.settings.jarPath',
        description: 'console.settings.jarPath.description',
        kind: 'file',
        defaultValue: '',
        keywords: ['console', 'jar', 'downloader', 'JAR_PATH']
      },
      {
        id: CONSOLE_SETTINGS.autoProbe,
        label: 'console.settings.autoProbe',
        description: 'console.settings.autoProbe.description',
        kind: 'switch',
        defaultValue: true,
        keywords: ['console', 'poll', 'health', 'automatic']
      },
      {
        id: CONSOLE_SETTINGS.probeSeconds,
        label: 'console.settings.probeSeconds',
        description: 'console.settings.probeSeconds.description',
        kind: 'number',
        defaultValue: 5,
        min: 2,
        max: 300,
        step: 1,
        keywords: ['console', 'health', 'interval', 'seconds']
      },
      {
        id: CONSOLE_SETTINGS.logSeconds,
        label: 'console.settings.logSeconds',
        description: 'console.settings.logSeconds.description',
        kind: 'number',
        defaultValue: 2,
        min: 1,
        max: 300,
        step: 1,
        keywords: ['console', 'log', 'interval', 'seconds']
      },
      {
        id: CONSOLE_SETTINGS.logRetention,
        label: 'console.settings.logRetention',
        description: 'console.settings.logRetention.description',
        kind: 'number',
        defaultValue: 2000,
        min: 100,
        max: 50000,
        step: 100,
        keywords: ['console', 'log', 'retention', 'lines']
      },
      {
        id: CONSOLE_SETTINGS.logFollow,
        label: 'console.settings.logFollow',
        description: 'console.settings.logFollow.description',
        kind: 'switch',
        defaultValue: true,
        keywords: ['console', 'log', 'follow', 'scroll']
      },
      {
        id: CONSOLE_SETTINGS.scanDepth,
        label: 'console.settings.scanDepth',
        description: 'console.settings.scanDepth.description',
        kind: 'number',
        defaultValue: 4,
        min: 1,
        max: 64,
        step: 1,
        keywords: ['console', 'world', 'scan', 'depth']
      },
      {
        id: CONSOLE_SETTINGS.scanCap,
        label: 'console.settings.scanCap',
        description: 'console.settings.scanCap.description',
        kind: 'number',
        defaultValue: 40000,
        min: 100,
        max: 5_000_000,
        step: 1000,
        keywords: ['console', 'world', 'scan', 'cap', 'files']
      },
      {
        id: CONSOLE_SETTINGS.consoleUsername,
        label: 'console.settings.consoleUsername',
        description: 'console.settings.consoleUsername.description',
        kind: 'text',
        defaultValue: 'admin',
        keywords: ['console', 'username', 'login', 'WEB_USERNAME']
      },
      {
        id: CONSOLE_SETTINGS.requireLogin,
        label: 'console.settings.requireLogin',
        description: 'console.settings.requireLogin.description',
        kind: 'switch',
        defaultValue: false,
        keywords: ['console', 'login', 'password', 'WEB_PASSWORD', 'gate']
      },
      {
        id: CONSOLE_SETTINGS.storedPassword,
        label: 'console.settings.storedPassword',
        description: 'console.settings.storedPassword.description',
        kind: 'custom',
        defaultValue: null,
        keywords: ['console', 'password', 'vault', 'login', 'credential'],
        render(host, ctx) {
          const status = document.createElement('p');
          status.className = 'md-field__support md-typescale-body-small';

          const field = ctx.components.textField({
            label: 'console.settings.storedPassword',
            type: 'password',
            id: 'console-settings-password'
          });

          const warning = document.createElement('p');
          warning.className = 'md-field__support md-typescale-body-small';
          warning.textContent = ctx.t('console.settings.storedPassword.warning', 'This is never displayed, exported or logged. Typing a new one replaces the stored value.');

          async function refreshStatus(): Promise<void> {
            const vaultStatus = await ctx.studio.vault.status();
            if (!vaultStatus.ok || !vaultStatus.value.encryptionAvailable) {
              status.textContent = ctx.t(
                'console.settings.storedPassword.status.unavailable',
                'The operating system credential vault is not available, so a password cannot be stored here.'
              );
              storeButton.disabled = true;
              forgetButton.disabled = true;
              return;
            }
            const has = await ctx.studio.vault.has(CONSOLE_PASSWORD_ACCOUNT);
            status.textContent = has.ok && has.value
              ? ctx.t('console.settings.storedPassword.status.set', 'A password is stored.')
              : ctx.t('console.settings.storedPassword.status.unset', 'No password is stored.');
            forgetButton.disabled = !(has.ok && has.value);
          }

          const storeButton = ctx.components.button({
            label: 'console.action.storePassword',
            variant: 'outlined',
            icon: 'key',
            onClick: async () => {
              const value = field.get();
              if (!value) return;
              const result = await ctx.studio.vault.set(CONSOLE_PASSWORD_ACCOUNT, value);
              field.set('');
              if (!result.ok) {
                ctx.notify.error(ctx.t('console.notify.unavailable', 'The console is not reachable right now', { dialog: true }), result.error);
                return;
              }
              ctx.notify.success(ctx.t('console.notify.passwordStored', 'The console password was stored', { dialog: true }));
              await ctx.history.record('Stored the console’s login password', 'console', {});
              await refreshStatus();
            }
          });

          const forgetButton = ctx.components.button({
            label: 'console.action.forgetPassword',
            variant: 'text',
            danger: true,
            onClick: async (event) => {
              const approved = await ctx.confirm.request({
                action: 'Forget the stored console password',
                affected: ['The console login password in the credential vault'],
                irreversible:
                  'The console can no longer be started with its own login gate switched on until a new password is stored, or the requirement is turned off.',
                anchor: event.currentTarget as HTMLElement
              });
              if (!approved) return;
              const result = await ctx.studio.vault.delete(CONSOLE_PASSWORD_ACCOUNT);
              if (!result.ok) {
                ctx.notify.error(ctx.t('console.notify.unavailable', 'The console is not reachable right now', { dialog: true }), result.error);
                return;
              }
              ctx.notify.success(ctx.t('console.notify.passwordForgotten', 'The stored console password was removed', { dialog: true }));
              await ctx.history.record('Forgot the console’s stored login password', 'console', {});
              await refreshStatus();
            }
          });

          const toolbar = document.createElement('div');
          toolbar.className = 'console-toolbar';
          toolbar.append(storeButton, forgetButton);

          host.append(status, field.root, toolbar, warning);
          void refreshStatus();
        }
      },
      {
        id: CONSOLE_SETTINGS.rescanOnFocus,
        label: 'console.settings.rescanOnFocus',
        description: 'console.settings.rescanOnFocus.description',
        kind: 'switch',
        defaultValue: false,
        keywords: ['console', 'world', 'scan', 'focus']
      }
    ]
  };
}

const palette: PaletteEntry[] = [
  {
    id: 'console.command.open',
    title: 'console.palette.open',
    icon: 'terminal',
    kind: 'destination',
    keywords: ['console', 'web', 'dashboard', 'flask', '主控台'],
    teleport: { tabId: CONSOLE_TAB_ID, elementId: CONSOLE_ANCHORS.service }
  },
  {
    id: 'console.command.start',
    title: 'console.palette.start',
    icon: 'play',
    kind: 'destination',
    keywords: ['console', 'start', 'run', 'service'],
    teleport: { tabId: CONSOLE_TAB_ID, elementId: CONSOLE_ANCHORS.service }
  },
  {
    id: 'console.command.stop',
    title: 'console.palette.stop',
    icon: 'stop',
    kind: 'destination',
    keywords: ['console', 'stop', 'kill', 'service'],
    teleport: { tabId: CONSOLE_TAB_ID, elementId: CONSOLE_ANCHORS.service }
  },
  {
    id: 'console.command.configuration',
    title: 'console.palette.configuration',
    icon: 'tune',
    kind: 'destination',
    keywords: ['console', 'configuration', 'options', 'form'],
    teleport: { tabId: CONSOLE_TAB_ID, elementId: CONSOLE_ANCHORS.configuration }
  },
  {
    id: 'console.command.account',
    title: 'console.palette.account',
    icon: 'key',
    kind: 'destination',
    keywords: ['console', 'account', 'sign in', 'microsoft', 'token'],
    teleport: { tabId: CONSOLE_TAB_ID, elementId: CONSOLE_ANCHORS.account }
  },
  {
    id: 'console.command.worlds',
    title: 'console.palette.worlds',
    icon: 'world',
    kind: 'destination',
    keywords: ['console', 'world', 'scan'],
    teleport: { tabId: CONSOLE_TAB_ID, elementId: CONSOLE_ANCHORS.worlds }
  },
  {
    id: 'console.command.records',
    title: 'console.palette.records',
    icon: 'file',
    kind: 'destination',
    keywords: ['console', 'records', 'files', 'auth.json'],
    teleport: { tabId: CONSOLE_TAB_ID, elementId: CONSOLE_ANCHORS.records }
  },
  {
    id: 'console.command.logs',
    title: 'console.palette.logs',
    icon: 'history',
    kind: 'destination',
    keywords: ['console', 'log', 'output'],
    teleport: { tabId: CONSOLE_TAB_ID, elementId: CONSOLE_ANCHORS.logs }
  },
  {
    id: 'console.command.bot',
    title: 'console.section.bot',
    icon: 'world',
    kind: 'destination',
    keywords: ['console', 'bot', 'auto explore', 'mineflayer'],
    teleport: { tabId: CONSOLE_TAB_ID, elementId: 'console-bot' }
  },
  {
    id: 'console.setting.autoProbe',
    title: 'console.settings.autoProbe',
    icon: 'refresh',
    kind: 'setting',
    settingId: CONSOLE_SETTINGS.autoProbe,
    keywords: ['console', 'poll', 'health']
  },
  {
    id: 'console.setting.requireLogin',
    title: 'console.settings.requireLogin',
    icon: 'lock',
    kind: 'setting',
    settingId: CONSOLE_SETTINGS.requireLogin,
    keywords: ['console', 'login', 'password']
  },
  {
    id: 'console.setting.logFollow',
    title: 'console.settings.logFollow',
    icon: 'history',
    kind: 'setting',
    settingId: CONSOLE_SETTINGS.logFollow,
    keywords: ['console', 'log', 'follow']
  },
  {
    id: 'console.setting.port',
    title: 'console.settings.port',
    icon: 'terminal',
    kind: 'setting',
    settingId: CONSOLE_SETTINGS.port,
    keywords: ['console', 'port']
  }
];

const console_: FeatureModule = {
  id: 'console',
  name: 'Web console',
  description:
    'The web management console’s capabilities, surfaced as native controls: installation, service lifecycle, configuration, Minecraft account sign-in, worlds, stored records, logs and the auto-explore bot — every one of it speaking the console’s own JSON API over loopback, without embedding a browser.',
  strings: CONSOLE_STRINGS,
  docs: CONSOLE_DOCS,
  settings: [settingsSection()],
  palette,
  tabs: [
    {
      id: CONSOLE_TAB_ID,
      title: 'console.tab',
      icon: 'terminal',
      // Ungrouped, on top: one of the product's own surfaces.
      order: 5,
      mount: mountConsole
    }
  ]
};

export default console_;
