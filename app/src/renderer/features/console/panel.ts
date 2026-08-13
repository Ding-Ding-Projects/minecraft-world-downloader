/**
 * The console tab: everything the browser dashboard could do, built as real
 * native controls driven by `ConsoleController` and the `consoleApi` client.
 *
 * The section layout mirrors the dashboard's own sections — installation and
 * service, configuration, account, worlds, records, logs — so the mental
 * model transfers directly for anyone who has used the browser version.
 * Nothing here is a screenshot of that page: every control here calls the
 * console's real JSON API over loopback and reflects what actually came back.
 */

import type { ExportFormat, TabContext } from '../../core/registry';
import { consoleApi, type ConsoleCall } from './client';
import { ConsoleController, type ConsoleState, type LogSource } from './controller';
import { CONSOLE_OPTIONS, CONSOLE_OPTION_GROUPS, previewCommandLine, validateOption, type ConsoleOption } from './options';
import { stateEmoji } from './service';
import { CONSOLE_SETTINGS } from './settingsIds';
import { type DataRecord, formatBytes, formatTimestamp, type WorldRecord } from './worlds';

function caption(ctx: TabContext, key: string, fallback: string): HTMLParagraphElement {
  const p = document.createElement('p');
  p.className = 'md-field__support md-typescale-body-small';
  p.textContent = ctx.t(key, fallback);
  return p;
}

function noteParagraph(text: string, extraClass = ''): HTMLParagraphElement {
  const p = document.createElement('p');
  p.className = `md-typescale-body-small console-note ${extraClass}`.trim();
  p.textContent = text;
  return p;
}

async function copyText(ctx: TabContext, text: string, successKey: string, successFallback: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    ctx.notify.success(ctx.t(successKey, successFallback, { dialog: true }), text.length > 80 ? `${text.slice(0, 80)}…` : text);
  } catch (error: unknown) {
    ctx.notify.error(
      ctx.t('console.notify.unavailable', 'The console is not reachable right now', { dialog: true }),
      error instanceof Error ? error.message : 'The clipboard refused the text.'
    );
  }
}

async function runExport<Row extends Record<string, unknown>>(
  ctx: TabContext,
  rows: Row[],
  name: string,
  format: ExportFormat
): Promise<void> {
  if (rows.length === 0) return;
  const preflight = ctx.exporter.preflight(rows, format);
  if (preflight.losses.length > 0) {
    ctx.notify.warn(
      ctx.t('core.export.losses', 'Some fields cannot be carried by this format', { dialog: true }),
      preflight.losses.map((loss) => `${loss.field}: ${loss.reason}`).join('\n')
    );
  }
  const path = await ctx.exporter.save(rows, format, { name, defaultFileName: `${name}.${format}` });
  if (path) ctx.notify.success(ctx.t('core.export.saved', 'Saved', { dialog: true }), path);
}

/* ==================================================================== */
/* Installation and service                                             */
/* ==================================================================== */

function buildServiceSection(ctx: TabContext, controller: ConsoleController): { root: HTMLElement; sync(state: ConsoleState): void } {
  const root = document.createElement('section');
  root.className = 'console-section';
  root.id = 'console-service';
  root.append(ctx.components.sectionHeading({ title: ctx.t('console.section.service', 'Service'), description: ctx.t('console.section.service.description', 'Whether the console process is installed, running and answering.') }));

  const statusRow = document.createElement('div');
  statusRow.className = 'console-status-row';
  statusRow.setAttribute('role', 'status');

  const emoji = document.createElement('span');
  emoji.className = 'console-badge-emoji';
  emoji.setAttribute('aria-hidden', 'true');

  const stateLabel = document.createElement('span');
  stateLabel.className = 'md-typescale-title-small';

  const detail = document.createElement('span');
  detail.className = 'md-typescale-body-medium console-status-row__detail';

  statusRow.append(emoji, stateLabel, detail);

  const toolbar = document.createElement('div');
  toolbar.className = 'console-toolbar';

  const startButton = ctx.components.button({
    label: 'console.action.start',
    icon: 'play',
    variant: 'filled',
    onClick: () => void controller.start()
  });
  const stopButton = ctx.components.button({
    label: 'console.action.stop',
    icon: 'stop',
    variant: 'outlined',
    danger: true,
    onClick: () => void controller.stop()
  });
  const installButton = ctx.components.button({
    label: 'console.action.installDeps',
    icon: 'download',
    variant: 'text',
    onClick: () => void controller.installDependencies()
  });
  const refreshButton = ctx.components.iconButton({
    icon: 'refresh',
    label: ctx.t('console.action.refresh', 'Refresh now'),
    onClick: () => void controller.refreshAll()
  });
  const openFolderButton = ctx.components.button({
    label: 'console.action.openFolder',
    icon: 'folder',
    variant: 'text',
    onClick: () => {
      const dir = controller.serviceDirectory;
      if (dir) void ctx.studio.shell.openPath(dir);
    }
  });
  toolbar.append(startButton, stopButton, installButton, openFolderButton, refreshButton);

  const checksHeading = document.createElement('p');
  checksHeading.className = 'md-typescale-label-large';
  checksHeading.textContent = ctx.t('console.section.installation', 'Installation');

  const checksList = document.createElement('ul');
  checksList.className = 'console-checks';

  root.append(statusRow, toolbar, checksHeading, checksList);

  function sync(state: ConsoleState): void {
    emoji.textContent = stateEmoji(state.service.state);
    stateLabel.textContent = ctx.t(`console.state.${camel(state.service.state)}`, state.service.state);
    detail.textContent = state.service.detail;

    const busy = state.busy !== null;
    const canStart = !state.service.owned && (state.service.state === 'stopped' || state.service.state === 'exited' || state.service.state === 'unhealthy');
    startButton.disabled = busy || !canStart;
    startButton.title = !canStart && !busy ? 'The console is already running, starting, or the folder is not ready.' : '';
    stopButton.disabled = busy || !state.service.owned;
    stopButton.title = !state.service.owned ? 'This application only stops a console it started itself.' : '';
    installButton.disabled = busy || !state.installation.hasRequirements;
    installButton.title = !state.installation.hasRequirements ? 'There is no requirements.txt in the configured folder.' : '';
    openFolderButton.disabled = !state.installation.directory;

    checksList.replaceChildren(
      ...state.installation.checks.map((check) => {
        const li = document.createElement('li');
        li.className = `console-check ${check.found ? '' : 'console-check--missing'}`;
        const mark = document.createElement('span');
        mark.className = 'console-check__mark';
        mark.setAttribute('aria-hidden', 'true');
        mark.textContent = check.found ? '✅' : '🧱';
        const text = document.createElement('span');
        text.textContent = `${check.label}: ${check.detail}`;
        li.append(mark, text);
        return li;
      })
    );
    if (state.installation.checks.length === 0) {
      const li = document.createElement('li');
      li.className = 'console-check';
      li.textContent = ctx.t('console.empty.records.body', 'Set the console’s data directory in Settings to see its stored records.');
      checksList.replaceChildren(li);
    }
  }

  return { root, sync };
}

function camel(state: string): string {
  return state.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());
}

/* ==================================================================== */
/* Configuration                                                        */
/* ==================================================================== */

function buildConfigurationSection(
  ctx: TabContext,
  controller: ConsoleController
): { root: HTMLElement; sync(state: ConsoleState): void; syncControlsFromSaved(): void } {
  const root = document.createElement('section');
  root.className = 'console-section';
  root.id = 'console-configuration';
  root.append(
    ctx.components.sectionHeading({
      title: ctx.t('console.section.configuration', 'Configuration'),
      description: ctx.t('console.section.configuration.description', 'Every downloader option the console persists, grouped exactly as the console groups them.')
    })
  );

  const sourceNote = noteParagraph('');
  root.append(sourceNote);

  const search = ctx.createSearchBar({
    label: 'console.search.options',
    sample: CONSOLE_OPTIONS.map((option) => option.label).join('\n'),
    onChange: (query) => {
      for (const option of CONSOLE_OPTIONS) {
        const row = fieldRows.get(option.key);
        if (row) row.hidden = !query.matches(`${option.label} ${option.labelYue} ${option.help}`);
      }
    }
  });
  root.append(search.root);
  ctx.onDispose(() => search.destroy());

  const fieldRows = new Map<string, HTMLElement>();
  const errorNodes = new Map<string, HTMLParagraphElement>();
  type AnyHandle = { get(): string | boolean; set(value: string | boolean): void; setDisabled(disabled: boolean, reason?: string): void };
  const handles = new Map<string, AnyHandle>();

  function commit(option: ConsoleOption, raw: string | boolean): void {
    if (option.type === 'bool') {
      controller.setConfigValue(option.key, raw as boolean);
      return;
    }
    const text = String(raw ?? '');
    const error = validateOption(option, text);
    const node = errorNodes.get(option.key);
    if (node) node.textContent = error ?? '';
    if (error) return;
    controller.setConfigValue(option.key, text);
  }

  for (const group of CONSOLE_OPTION_GROUPS) {
    const groupWrap = document.createElement('div');
    groupWrap.className = 'console-config-group';
    const heading = document.createElement('p');
    heading.className = 'md-typescale-title-small';
    heading.textContent = ctx.t(`console.group.${group}`, group);
    groupWrap.append(heading);

    const grid = document.createElement('div');
    grid.className = 'console-config-grid';

    for (const option of CONSOLE_OPTIONS.filter((candidate) => candidate.group === group)) {
      const cell = document.createElement('div');
      cell.dataset.optionKey = option.key;
      const help = ctx.t(`console.option.${option.key}.help`, option.help);

      if (option.type === 'bool') {
        const handle = ctx.components.switchControl({
          label: ctx.t(`console.option.${option.key}.label`, option.label),
          onChange: (value) => commit(option, value),
          id: `console-option-${option.key}`
        });
        cell.append(handle.root, caption(ctx, `console.option.${option.key}.help`, option.help));
        handles.set(option.key, handle as AnyHandle);
      } else {
        const handle = ctx.components.textField({
          label: ctx.t(`console.option.${option.key}.label`, option.label),
          type: option.type === 'int' ? 'number' : 'text',
          supportingText: help,
          onCommit: (value) => commit(option, value),
          id: `console-option-${option.key}`
        });
        const errorNode = document.createElement('p');
        errorNode.className = 'md-field__support md-typescale-body-small';
        errorNode.setAttribute('role', 'alert');
        errorNode.style.color = 'var(--md-sys-color-error)';
        errorNodes.set(option.key, errorNode);
        cell.append(handle.root, errorNode);
        handles.set(option.key, handle as AnyHandle);
      }

      if (option.passthroughNote) {
        cell.append(noteParagraph(`⚠ ${ctx.t(`console.option.${option.key}.passthrough`, option.passthroughNote)}`));
      }

      grid.append(cell);
      fieldRows.set(option.key, cell);
    }

    groupWrap.append(grid);
    root.append(groupWrap);
  }

  const dirtyNote = noteParagraph('');
  const preview = document.createElement('pre');
  preview.className = 'console-preview';

  const toolbar = document.createElement('div');
  toolbar.className = 'console-toolbar';
  const saveButton = ctx.components.button({
    label: 'console.action.save',
    icon: 'save',
    variant: 'outlined',
    onClick: async () => {
      const result = await consoleApi.saveConfig(ctx.studio, controller.port, controller.snapshot().config);
      await onWriteOutcome(ctx, controller, result, 'console.notify.saved', 'Configuration saved', 'console.notify.saveFailed', 'The configuration was not saved');
      await ctx.history.record('Saved the console configuration', 'console', { port: controller.port });
      controlsSync();
    }
  });
  const startWithButton = ctx.components.button({
    label: 'console.action.start',
    icon: 'play',
    variant: 'filled',
    onClick: () => void controller.start()
  });
  const restartButton = ctx.components.button({
    label: 'console.action.restart',
    icon: 'refresh',
    variant: 'text',
    onClick: async () => {
      const result = await consoleApi.restart(ctx.studio, controller.port, controller.snapshot().config);
      await onWriteOutcome(ctx, controller, result, 'console.notify.restarted', 'The console is restarting with this configuration', 'console.notify.restartFailed', 'The restart did not succeed');
      await ctx.history.record('Restarted the console with a new configuration', 'console', { port: controller.port });
      controlsSync();
    }
  });
  const resetButton = ctx.components.button({
    label: 'console.action.resetToSaved',
    icon: 'remove',
    variant: 'text',
    onClick: () => {
      controller.resetConfigToSaved();
      controlsSync();
    }
  });
  const copyCommandButton = ctx.components.button({
    label: 'console.action.copyCommand',
    icon: 'copy',
    variant: 'text',
    onClick: () => {
      const command = previewCommandLine(controller.snapshot().config, controller.jarPath);
      void copyText(ctx, command.join(' '), 'console.notify.commandCopied', 'The command line was copied');
    }
  });
  toolbar.append(saveButton, startWithButton, restartButton, resetButton, copyCommandButton);

  root.append(dirtyNote, preview, toolbar);

  function controlsSync(): void {
    const state = controller.snapshot();
    for (const option of CONSOLE_OPTIONS) {
      const handle = handles.get(option.key);
      if (!handle) continue;
      handle.set(state.config[option.key] ?? (option.type === 'bool' ? false : ''));
      const errorNode = errorNodes.get(option.key);
      if (errorNode) errorNode.textContent = '';
    }
    syncMeta(state);
  }

  function syncMeta(state: ConsoleState): void {
    const label =
      state.configSource === 'console'
        ? 'The console this application is talking to reports this as its current configuration.'
        : state.configSource === 'file'
        ? `Read from the console’s own saved configuration file.`
        : state.configError ?? 'No saved configuration was found; these are the console’s own compiled-in defaults.';
    sourceNote.textContent = label;
    const dirty = controller.configDirty;
    dirtyNote.textContent = dirty
      ? 'This differs from what was last saved or read.'
      : 'This matches the last saved or read configuration.';
    resetButton.disabled = !dirty;
    resetButton.title = !dirty ? 'There is nothing to discard.' : '';
    preview.textContent = previewCommandLine(state.config, controller.jarPath).join(' ');
    const canWrite = state.installation.state === 'ready';
    saveButton.disabled = !canWrite || state.busy !== null;
    startWithButton.disabled = state.busy !== null || !canWrite || state.service.owned;
    restartButton.disabled = !canWrite || state.busy !== null || !controller.apiReachable;
    restartButton.title = !controller.apiReachable ? 'The console is not running, so there is nothing to restart.' : '';
  }

  function sync(state: ConsoleState): void {
    // Deliberately narrow: only the meta line, the dirty note, the preview and
    // button enablement update on every patch. The fields themselves are only
    // ever rewritten by `controlsSync`, so an unrelated probe never overwrites
    // a value someone is in the middle of typing.
    syncMeta(state);
  }

  return { root, sync, syncControlsFromSaved: controlsSync };
}

async function onWriteOutcome(
  ctx: TabContext,
  controller: ConsoleController,
  result: ConsoleCall<{ message: string }>,
  okKey: string,
  okFallback: string,
  failKey: string,
  failFallback: string
): Promise<void> {
  if (result.ok) {
    ctx.notify.success(ctx.t(okKey, okFallback, { dialog: true }), result.value.message);
  } else {
    ctx.notify.error(ctx.t(failKey, failFallback, { dialog: true }), result.error);
  }
  await controller.probe();
  await controller.loadConfig();
}

/* ==================================================================== */
/* Account                                                               */
/* ==================================================================== */

function buildAccountSection(ctx: TabContext, controller: ConsoleController): { root: HTMLElement; sync(state: ConsoleState): void } {
  const root = document.createElement('section');
  root.className = 'console-section';
  root.id = 'console-account';
  root.append(ctx.components.sectionHeading({ title: ctx.t('console.section.account', 'Minecraft account') }));

  let disposed = false;
  ctx.onDispose(() => {
    disposed = true;
  });

  const status = noteParagraph('');
  root.append(status);

  const deviceCodeBox = document.createElement('div');
  deviceCodeBox.className = 'console-device-code';
  deviceCodeBox.hidden = true;
  root.append(deviceCodeBox);

  const beginMicrosoftButton = ctx.components.button({
    label: 'console.action.beginMicrosoft',
    icon: 'key',
    variant: 'filled',
    onClick: async () => {
      const result = await consoleApi.beginDeviceFlow(ctx.studio, controller.port);
      if (!result.ok) {
        ctx.notify.error(ctx.t('console.notify.microsoftFailed', 'The Microsoft sign-in did not start', { dialog: true }), result.error);
        return;
      }
      ctx.notify.info(
        ctx.t('console.notify.microsoftStarted', 'Enter the code at the address shown to finish signing in', { dialog: true }),
        `${result.value.userCode} — ${result.value.verificationUri}`
      );
      deviceCodeBox.hidden = false;
      deviceCodeBox.replaceChildren();
      const codeEl = document.createElement('span');
      codeEl.className = 'console-device-code__code';
      codeEl.textContent = result.value.userCode;
      const linkEl = document.createElement('span');
      linkEl.textContent = result.value.verificationUri;
      const copyBtn = ctx.components.button({
        label: 'console.action.copyCode',
        icon: 'copy',
        variant: 'text',
        onClick: () => void copyText(ctx, result.value.userCode, 'console.notify.commandCopied', 'Copied')
      });
      deviceCodeBox.append(codeEl, linkEl, copyBtn);

      const flowId = result.value.flowId;
      const intervalMs = Math.max(2, result.value.intervalSeconds) * 1000;
      const deadline = Date.now() + result.value.expiresInSeconds * 1000;
      const poll = async (): Promise<void> => {
        if (disposed) return;
        if (Date.now() > deadline) {
          deviceCodeBox.hidden = true;
          return;
        }
        const outcome = await consoleApi.pollDeviceFlow(ctx.studio, controller.port, flowId);
        if (disposed || !outcome.ok) return;
        if (outcome.value.state === 'ok') {
          deviceCodeBox.hidden = true;
          ctx.notify.success(ctx.t('console.notify.signedIn', 'Signed in as {username}', { values: { username: outcome.value.username }, dialog: true }), outcome.value.username);
          await ctx.history.record('Signed a Minecraft account in through Microsoft', 'console', { username: outcome.value.username });
          await controller.probe();
          return;
        }
        if (outcome.value.state === 'error') {
          deviceCodeBox.hidden = true;
          ctx.notify.error(ctx.t('console.notify.signInFailed', 'The sign-in did not succeed', { dialog: true }), outcome.value.message);
          return;
        }
        window.setTimeout(() => void poll(), intervalMs);
      };
      window.setTimeout(() => void poll(), intervalMs);
    }
  });

  const tokenField = ctx.components.textField({ label: 'console.field.token', type: 'password', id: 'console-account-token' });
  const tokenButton = ctx.components.button({
    label: 'console.action.signInToken',
    variant: 'outlined',
    onClick: async () => {
      const token = tokenField.get();
      if (!token) return;
      const result = await consoleApi.signInWithToken(ctx.studio, controller.port, token);
      tokenField.set('');
      if (!result.ok) {
        ctx.notify.error(ctx.t('console.notify.signInFailed', 'The sign-in did not succeed', { dialog: true }), result.error);
        return;
      }
      ctx.notify.success(ctx.t('console.notify.signedIn', 'Signed in as {username}', { values: { username: result.value.username }, dialog: true }), result.value.username);
      await ctx.history.record('Signed a Minecraft account in with a pasted token', 'console', { username: result.value.username });
      await controller.probe();
    }
  });

  const offlineField = ctx.components.textField({ label: 'console.field.offlineName', id: 'console-account-offline' });
  const offlineButton = ctx.components.button({
    label: 'console.action.signInOffline',
    variant: 'text',
    onClick: async () => {
      const name = offlineField.get();
      if (!name) return;
      const result = await consoleApi.signInOffline(ctx.studio, controller.port, name);
      if (!result.ok) {
        ctx.notify.error(ctx.t('console.notify.signInFailed', 'The sign-in did not succeed', { dialog: true }), result.error);
        return;
      }
      ctx.notify.success(ctx.t('console.notify.signedIn', 'Signed in as {username}', { values: { username: result.value.username }, dialog: true }), result.value.username);
      await ctx.history.record('Signed a Minecraft account in with an offline username', 'console', { username: result.value.username });
      await controller.probe();
    }
  });

  const signOutButton = ctx.components.button({
    label: 'console.action.signOut',
    icon: 'lockOpen',
    variant: 'text',
    danger: true,
    onClick: async (event) => {
      const account = controller.snapshot().account;
      const approved = await ctx.confirm.request({
        action: `Sign out ${account?.username ?? 'this account'}`,
        affected: [account?.username ?? 'the console’s current Minecraft sign-in'],
        irreversible: 'The console forgets this sign-in immediately. Nothing captured so far is lost; downloading again needs a fresh sign-in.',
        anchor: event.currentTarget as HTMLElement
      });
      if (!approved) return;
      const result = await consoleApi.signOut(ctx.studio, controller.port);
      if (!result.ok) {
        ctx.notify.error(ctx.t('console.notify.signOutFailed', 'The console did not sign out', { dialog: true }), result.error);
        return;
      }
      ctx.notify.success(ctx.t('console.notify.signedOut', 'Signed out', { dialog: true }));
      await ctx.history.record('Signed the console’s Minecraft account out', 'console', {});
      await controller.probe();
    }
  });

  const row1 = document.createElement('div');
  row1.className = 'console-form-row';
  row1.append(tokenField.root, tokenButton);
  const row2 = document.createElement('div');
  row2.className = 'console-form-row';
  row2.append(offlineField.root, offlineButton);
  const toolbar = document.createElement('div');
  toolbar.className = 'console-toolbar';
  toolbar.append(beginMicrosoftButton, signOutButton);

  root.append(toolbar, row1, row2);

  /* ---- bot subsection ---- */
  const botHeading = document.createElement('p');
  botHeading.className = 'md-typescale-title-small';
  botHeading.id = 'console-bot';
  botHeading.textContent = ctx.t('console.section.bot', 'Auto-explore bot');
  const botStatus = noteParagraph('');
  const botToolbar = document.createElement('div');
  botToolbar.className = 'console-toolbar';
  const botUserField = ctx.components.textField({ label: 'console.field.botAccount', id: 'console-bot-account' });
  const botAuthButton = ctx.components.button({
    label: 'console.action.authenticateBot',
    variant: 'outlined',
    onClick: async () => {
      const name = botUserField.get();
      if (!name) return;
      const result = await consoleApi.authenticateBot(ctx.studio, controller.port, name);
      if (!result.ok) {
        ctx.notify.error(ctx.t('console.notify.botAuthFailed', 'The bot sign-in did not start', { dialog: true }), result.error);
        return;
      }
      ctx.notify.success(ctx.t('console.notify.botAuthStarted', 'The bot’s Microsoft sign-in is starting', { dialog: true }), result.value.message);
      await ctx.history.record('Started the console bot’s Microsoft sign-in', 'console', { botUser: name });
    }
  });
  const botStartButton = ctx.components.button({
    label: 'console.action.startBot',
    icon: 'play',
    variant: 'filled',
    onClick: async () => {
      const name = botUserField.get();
      const result = await consoleApi.startBot(ctx.studio, controller.port, name ? { botUser: name } : {});
      if (!result.ok) {
        ctx.notify.error(ctx.t('console.notify.botStartFailed', 'The bot did not start', { dialog: true }), result.error);
        return;
      }
      ctx.notify.success(ctx.t('console.notify.botStarted', 'The auto-explore bot is starting', { dialog: true }), result.value.message);
      await ctx.history.record('Started the console’s auto-explore bot', 'console', {});
      await controller.probe();
    }
  });
  const botStopButton = ctx.components.button({
    label: 'console.action.stopBot',
    icon: 'stop',
    variant: 'text',
    onClick: async (event) => {
      const approved = await ctx.confirm.request({
        action: 'Stop the auto-explore bot',
        affected: ['The running auto-explore bot process'],
        irreversible: 'The bot disconnects immediately. Anything it had not yet triggered to load is simply not visited this run.',
        anchor: event.currentTarget as HTMLElement
      });
      if (!approved) return;
      const result = await consoleApi.stopBot(ctx.studio, controller.port);
      if (!result.ok) {
        ctx.notify.error(ctx.t('console.notify.botStopFailed', 'The bot did not stop', { dialog: true }), result.error);
        return;
      }
      ctx.notify.success(ctx.t('console.notify.botStopped', 'The bot was stopped', { dialog: true }));
      await ctx.history.record('Stopped the console’s auto-explore bot', 'console', {});
      await controller.probe();
    }
  });
  botToolbar.append(botStartButton, botStopButton, botUserField.root, botAuthButton);
  root.append(botHeading, botStatus, botToolbar);

  function sync(state: ConsoleState): void {
    const reachable = controller.apiReachable;
    if (!reachable) {
      status.textContent = controller.unavailableReason() ?? 'The console is not reachable.';
      botStatus.textContent = status.textContent;
    } else if (state.accountError) {
      status.textContent = state.accountError;
    } else if (state.account?.authenticated) {
      status.textContent = `Signed in as ${state.account.username ?? '(unknown)'} (${state.account.method ?? 'unknown method'}).`;
    } else {
      status.textContent = 'Not signed in to a Minecraft account.';
    }

    if (state.bot) {
      botStatus.textContent = state.bot.running
        ? `Running (process ${state.bot.pid ?? 'unknown'}).${state.bot.deviceCode ? ` Waiting on a Microsoft sign-in: ${state.bot.deviceCode.code} at ${state.bot.deviceCode.url}.` : ''}`
        : 'Not running.';
    } else if (reachable) {
      botStatus.textContent = 'Not running.';
    }

    const disabledReason = controller.unavailableReason() ?? undefined;
    for (const button of [beginMicrosoftButton, tokenButton, offlineButton, signOutButton, botAuthButton, botStartButton, botStopButton]) {
      button.disabled = !reachable;
      if (disabledReason) button.title = disabledReason;
    }
  }

  return { root, sync };
}

/* ==================================================================== */
/* Worlds                                                                */
/* ==================================================================== */

function buildWorldsSection(ctx: TabContext, controller: ConsoleController): { root: HTMLElement; sync(state: ConsoleState): void } {
  const root = document.createElement('section');
  root.className = 'console-section';
  root.id = 'console-worlds';
  root.append(ctx.components.sectionHeading({ title: ctx.t('console.section.worlds', 'Worlds') }));

  const progressWrap = document.createElement('div');
  progressWrap.className = 'console-scan-progress';
  progressWrap.hidden = true;
  const progressLabel = noteParagraph('');
  let progressHandle: ReturnType<typeof ctx.components.linearProgress> | null = null;
  progressWrap.append(progressLabel);

  const scanButton = ctx.components.button({
    label: 'console.action.scan',
    icon: 'refresh',
    variant: 'filled',
    onClick: () => void controller.scan()
  });
  const cancelScanButton = ctx.components.button({
    label: 'console.action.cancelScan',
    variant: 'text',
    onClick: () => controller.cancelScan()
  });

  const toolbar = document.createElement('div');
  toolbar.className = 'console-toolbar';
  toolbar.append(scanButton, cancelScanButton);

  const bulkBar = document.createElement('div');
  bulkBar.className = 'console-toolbar';
  const selectAllButton = ctx.components.button({ label: 'console.action.selectAll', variant: 'text', onClick: () => table.setSelection(filtered.map((row) => row.name)) });
  const selectNoneButton = ctx.components.button({ label: 'console.action.selectNone', variant: 'text', onClick: () => table.clearSelection() });
  const invertButton = ctx.components.button({
    label: 'console.action.invertSelection',
    variant: 'text',
    onClick: () => {
      const current = new Set(table.selection());
      table.setSelection(filtered.filter((row) => !current.has(row.name)).map((row) => row.name));
    }
  });
  const exportButton = ctx.components.button({
    label: 'console.action.exportSelected',
    icon: 'download',
    variant: 'text',
    onClick: () => {
      const ids = new Set(table.selection());
      const rows = filtered.filter((row) => ids.has(row.name)).map((row) => ({ ...row }));
      void runExport(ctx, rows.length > 0 ? rows : filtered.map((row) => ({ ...row })), 'console-worlds', 'csv');
    }
  });
  bulkBar.append(selectAllButton, selectNoneButton, invertButton, exportButton);

  const search = ctx.createSearchBar({
    label: 'console.search.worlds',
    onChange: (query) => {
      filtered = worlds.filter((world) => query.matches(world.name));
      table.setRows(filtered);
    }
  });

  let worlds: WorldRecord[] = [];
  let filtered: WorldRecord[] = [];

  const table = ctx.components.dataTable<WorldRecord>({
    label: ctx.t('console.section.worlds', 'Worlds'),
    columns: [
      { id: 'name', label: 'Name', sortable: true, value: (row) => row.name, render: (row) => `${row.isCurrent ? '📍 ' : ''}${row.name}` },
      { id: 'bytes', label: 'Size', sortable: true, align: 'end', value: (row) => row.bytes, render: (row) => formatBytes(row.bytes) },
      { id: 'files', label: 'Files', sortable: true, align: 'end', value: (row) => row.files },
      { id: 'regionFiles', label: 'Region files', sortable: true, align: 'end', value: (row) => row.regionFiles },
      { id: 'dimensions', label: 'Dimensions', value: (row) => row.dimensions.join(', ') || '—' },
      { id: 'overview', label: 'Live map', value: (row) => (row.hasOverview ? 'Yes' : 'No') },
      { id: 'modifiedAt', label: 'Modified', sortable: true, value: (row) => row.modifiedAt, render: (row) => formatTimestamp(row.modifiedAt) },
      {
        id: 'actions',
        label: '',
        render: (row) => {
          const button = ctx.components.iconButton({ icon: 'folder', label: ctx.t('console.action.reveal', 'Reveal in folder'), onClick: () => void ctx.studio.shell.showItemInFolder(row.path) });
          return button;
        }
      }
    ],
    rows: [],
    rowId: (row) => row.name,
    selectable: true,
    emptyMessage: 'console.empty.worlds.title'
  });

  const skippedNote = noteParagraph('');
  const cappedNote = noteParagraph('');

  root.append(toolbar, progressWrap, search.root, bulkBar, table.root, skippedNote, cappedNote);
  ctx.onDispose(() => search.destroy());

  function sync(state: ConsoleState): void {
    const dataConfigured = Boolean(controller.dataDirectory);
    scanButton.disabled = state.worldScan.running || !dataConfigured;
    scanButton.title = !dataConfigured ? 'No data directory is configured yet.' : '';
    cancelScanButton.disabled = !state.worldScan.running;

    progressWrap.hidden = !state.worldScan.running;
    if (state.worldScan.running) {
      progressLabel.textContent =
        state.worldScan.total > 0
          ? `Scanning ${state.worldScan.completed} of ${state.worldScan.total}: ${state.worldScan.current}`
          : 'Listing world folders…';
      if (!progressHandle) {
        progressHandle = ctx.components.linearProgress({ label: 'console.action.scan', value: state.worldScan.total > 0 ? state.worldScan.completed / state.worldScan.total : undefined });
        progressWrap.append(progressHandle.root);
      } else if (state.worldScan.total > 0) {
        progressHandle.set(state.worldScan.completed / state.worldScan.total);
      }
    } else if (progressHandle) {
      progressHandle.root.remove();
      progressHandle = null;
    }

    if (state.worlds !== worlds) {
      worlds = state.worlds;
      filtered = worlds.filter((world) => search.query().matches(world.name));
      table.setRows(filtered);
    }

    skippedNote.textContent =
      state.worldsSkipped.length > 0
        ? `Not shown because they are the console’s own records, not worlds: ${state.worldsSkipped.join(', ')}.`
        : '';
    cappedNote.textContent = state.worlds.some((world) => world.capped)
      ? 'One or more totals stopped at the configured scan bound and are floors, not exact counts. Raise the bound in Settings for an exact total.'
      : '';
    if (state.worldsError) cappedNote.textContent = state.worldsError;
  }

  return { root, sync };
}

/* ==================================================================== */
/* Records                                                               */
/* ==================================================================== */

function buildRecordsSection(ctx: TabContext, controller: ConsoleController): { root: HTMLElement; sync(state: ConsoleState): void } {
  const root = document.createElement('section');
  root.className = 'console-section';
  root.id = 'console-records';
  root.append(ctx.components.sectionHeading({ title: ctx.t('console.section.records', 'Stored records') }));

  let records: DataRecord[] = [];
  let filtered: DataRecord[] = [];

  const search = ctx.createSearchBar({
    label: 'console.search.records',
    onChange: (query) => {
      filtered = records.filter((record) => query.matches(`${record.label} ${record.purpose}`));
      table.setRows(filtered);
    }
  });

  const bulkBar = document.createElement('div');
  bulkBar.className = 'console-toolbar';
  const selectAllButton = ctx.components.button({ label: 'console.action.selectAll', variant: 'text', onClick: () => table.setSelection(filtered.map((row) => row.id)) });
  const selectNoneButton = ctx.components.button({ label: 'console.action.selectNone', variant: 'text', onClick: () => table.clearSelection() });
  const invertButton = ctx.components.button({
    label: 'console.action.invertSelection',
    variant: 'text',
    onClick: () => {
      const current = new Set(table.selection());
      table.setSelection(filtered.filter((row) => !current.has(row.id)).map((row) => row.id));
    }
  });
  const exportButton = ctx.components.button({
    label: 'console.action.exportSelected',
    icon: 'download',
    variant: 'text',
    onClick: () => {
      const ids = new Set(table.selection());
      const rows = filtered.filter((row) => ids.has(row.id)).map((row) => ({ ...row }));
      void runExport(ctx, rows.length > 0 ? rows : filtered.map((row) => ({ ...row })), 'console-records', 'csv');
    }
  });
  bulkBar.append(selectAllButton, selectNoneButton, invertButton, exportButton);

  const table = ctx.components.dataTable<DataRecord>({
    label: ctx.t('console.section.records', 'Stored records'),
    columns: [
      { id: 'label', label: 'Record', sortable: true, value: (row) => row.label },
      { id: 'exists', label: 'Present', sortable: true, value: (row) => (row.exists ? 'Yes' : 'No') },
      { id: 'bytes', label: 'Size', sortable: true, align: 'end', value: (row) => row.bytes, render: (row) => (row.exists ? formatBytes(row.bytes) : '—') },
      { id: 'modifiedAt', label: 'Modified', sortable: true, value: (row) => row.modifiedAt, render: (row) => (row.exists ? formatTimestamp(row.modifiedAt) : '—') },
      { id: 'sensitivity', label: 'Contents', value: (row) => (row.sensitivity === 'never-read' ? 'Never opened here' : 'Plain'), render: (row) => (row.sensitivity === 'never-read' ? '🔒 Never opened here' : 'Plain') },
      { id: 'purpose', label: 'What it holds', value: (row) => row.purpose },
      {
        id: 'actions',
        label: '',
        render: (row) => ctx.components.iconButton({ icon: 'folder', label: ctx.t('console.action.reveal', 'Reveal in folder'), disabled: !row.exists, onClick: () => void ctx.studio.shell.showItemInFolder(row.path) })
      }
    ],
    rows: [],
    rowId: (row) => row.id,
    selectable: true,
    emptyMessage: 'console.empty.records.title'
  });

  root.append(search.root, bulkBar, table.root);
  ctx.onDispose(() => search.destroy());

  function sync(state: ConsoleState): void {
    if (state.records !== records) {
      records = state.records;
      filtered = records.filter((record) => search.query().matches(`${record.label} ${record.purpose}`));
      table.setRows(filtered);
    }
  }

  return { root, sync };
}

/* ==================================================================== */
/* Logs                                                                  */
/* ==================================================================== */

function buildLogsSection(ctx: TabContext, controller: ConsoleController): { root: HTMLElement; sync(state: ConsoleState): void } {
  const root = document.createElement('section');
  root.className = 'console-section';
  root.id = 'console-logs';
  root.append(ctx.components.sectionHeading({ title: ctx.t('console.section.logs', 'Logs') }));

  let activeSource: LogSource = 'service';
  const segmented = ctx.components.segmentedButton({
    label: ctx.t('console.section.logs', 'Logs'),
    options: [
      { value: 'service', label: 'Service' },
      { value: 'downloader', label: 'Downloader' },
      { value: 'bot', label: 'Bot' }
    ],
    value: activeSource,
    onChange: (value) => {
      activeSource = value as LogSource;
      renderLines(controller.snapshot());
    }
  });

  const followHandle = ctx.components.switchControl({
    label: ctx.t('console.settings.logFollow', 'Follow the log'),
    checked: ctx.settings.get<boolean>(CONSOLE_SETTINGS.logFollow, true),
    onChange: (value) => ctx.settings.set(CONSOLE_SETTINGS.logFollow, value)
  });

  const clearButton = ctx.components.button({
    label: 'console.action.clearLog',
    icon: 'trash',
    variant: 'text',
    danger: true,
    onClick: async (event) => {
      const approved = await ctx.confirm.request({
        action: `Clear the ${activeSource} log view`,
        affected: [`${controller.snapshot().logs[activeSource].lines.length} lines currently shown`],
        irreversible: 'The lines already fetched into this view are discarded. Because the console’s cursor has already moved past them, they cannot be re-fetched here; they may still exist in the console’s own log file.',
        anchor: event.currentTarget as HTMLElement
      });
      if (!approved) return;
      controller.clearLog(activeSource);
      await ctx.history.record(`Cleared the ${activeSource} log view`, 'console', { source: activeSource });
    }
  });

  const exportLogButton = ctx.components.button({
    label: 'console.action.exportLog',
    icon: 'download',
    variant: 'text',
    onClick: () => {
      const lines = controller.snapshot().logs[activeSource].lines;
      void runExport(ctx, filteredLines(lines).map((line, index) => ({ index: index + 1, line })), `console-${activeSource}-log`, 'markdown');
    }
  });

  const toolbar = document.createElement('div');
  toolbar.className = 'console-toolbar';
  toolbar.append(segmented.root, followHandle.root, clearButton, exportLogButton);

  let filterText = '';
  let filterMatches: ((value: string) => boolean) | null = null;
  const search = ctx.createSearchBar({
    label: 'console.search.logs',
    onChange: (query) => {
      filterText = query.text;
      filterMatches = query.matches;
      renderLines(controller.snapshot());
    }
  });

  function filteredLines(lines: string[]): string[] {
    if (!filterText || !filterMatches) return lines;
    return lines.filter((line) => filterMatches?.(line));
  }

  const pre = document.createElement('pre');
  pre.className = 'console-log__pre';
  pre.setAttribute('role', 'log');
  pre.setAttribute('aria-live', 'polite');

  const emptyNote = noteParagraph('');

  root.append(toolbar, search.root, pre, emptyNote);
  ctx.onDispose(() => search.destroy());

  function renderLines(state: ConsoleState): void {
    const buffer = state.logs[activeSource];
    const lines = filteredLines(buffer.lines);
    const wasNearBottom = pre.scrollHeight - pre.scrollTop - pre.clientHeight < 24;
    pre.textContent = lines.join('\n');
    emptyNote.textContent = lines.length === 0 ? ctx.t('console.empty.logs.body', 'Log lines appear here once the console is running and something happens.') : buffer.error ?? '';
    const follow = ctx.settings.get<boolean>(CONSOLE_SETTINGS.logFollow, true);
    if (follow && wasNearBottom) pre.scrollTop = pre.scrollHeight;
  }

  function sync(state: ConsoleState): void {
    renderLines(state);
  }

  return { root, sync };
}

/* ==================================================================== */
/* Mount                                                                 */
/* ==================================================================== */

export function mountConsole(host: HTMLElement, ctx: TabContext): () => void {
  const controller = new ConsoleController(ctx);

  const scroll = document.createElement('div');
  scroll.className = 'console-scroll';
  host.append(scroll);

  scroll.append(ctx.components.topAppBar({ title: ctx.t('console.tab', 'Web console'), subtitle: ctx.t('console.tab.subtitle', 'Every capability of the web dashboard, spoken to natively.') }));

  const service = buildServiceSection(ctx, controller);
  const configuration = buildConfigurationSection(ctx, controller);
  const account = buildAccountSection(ctx, controller);
  const worlds = buildWorldsSection(ctx, controller);
  const records = buildRecordsSection(ctx, controller);
  const logs = buildLogsSection(ctx, controller);

  scroll.append(service.root, configuration.root, account.root, worlds.root, records.root, logs.root);

  const unsubscribe = controller.subscribe((state) => {
    service.sync(state);
    configuration.sync(state);
    account.sync(state);
    worlds.sync(state);
    records.sync(state);
    logs.sync(state);
  });

  let lastSource: ConsoleState['configSource'] | null = null;
  const configWatcher = controller.subscribe((state) => {
    if (state.configSource !== lastSource) {
      lastSource = state.configSource;
      configuration.syncControlsFromSaved();
    }
  });

  void controller.attach();

  return () => {
    unsubscribe();
    configWatcher();
    controller.dispose();
  };
}
