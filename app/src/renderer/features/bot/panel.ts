/**
 * The scraper bot runner tab.
 *
 * Four surfaces, in the order a person uses them: the profiles, the run
 * controls, the live run log, and the messages captured out of that log. Each
 * list carries the whole bulk-action contract, each search field is the shared
 * search bar so it brings its anchored pattern builder with it, and every state
 * on screen is the state the real process is actually in.
 */

import { el, nextId } from '../../core/a11y';
import type { AppContext, ExportFormat, SearchQuery, TabContext } from '../../core/registry';
import { CHANNEL_LABEL_KEYS, compileRules, captureLines } from './capture';
import { validateProfile } from './config';
import { buildPresetPicker, mountProfileEditor } from './profileform';
import type { ProfileEditorHandle } from './profileform';
import { BotRunner } from './runner';
import type { RunState } from './runner';
import {
  CaptureRule,
  CapturedMessage,
  EXPORT_FORMAT_ID,
  FOLLOW_LOG_ID,
  LOG_ELEMENT,
  LogLine,
  LogSeverity,
  MESSAGES_ELEMENT,
  MESSAGE_CHANNELS,
  MessageChannel,
  PROFILE_LIST_ELEMENT,
  RUN_CONTROLS_ELEMENT,
  blankProfile,
  newId
} from './state';
import type { BotProfile, BotStore } from './state';

/** How many log lines are put in the DOM at once. */
const LOG_RENDER_WINDOW = 600;

interface PanelDeps {
  ctx: TabContext;
  store: BotStore;
  runner: BotRunner;
}

/* ================================================================== */
/* Formatting                                                          */
/* ================================================================== */

function formatTime(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleTimeString(undefined, { hour12: false });
}

function formatDateTime(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleString(undefined, { hour12: false });
}

function phaseKey(phase: RunState['phase']): string {
  return `bot.phase.${phase}`;
}

/* ================================================================== */
/* The panel                                                           */
/* ================================================================== */

export function mountBotPanel(host: HTMLElement, deps: PanelDeps): void {
  const { ctx, store, runner } = deps;

  const root = el('div', { className: 'bot-panel' });
  host.append(root);

  /* ---------------- top bar ---------------- */

  const docsButton = ctx.components.button({
    label: ctx.t('bot.action.docs', 'Read the article'),
    variant: 'text',
    icon: 'book',
    onClick: () => ctx.docsService.open('bot.overview')
  });

  root.append(
    ctx.components.topAppBar({
      title: ctx.t('bot.tab', 'Scraper bot'),
      subtitle: ctx.t(
        'bot.tab.subtitle',
        'Runs the bundled Node scraper through the downloader proxy and keeps what it prints.'
      ),
      actions: [docsButton]
    })
  );

  /* ================================================================ */
  /* Run controls                                                     */
  /* ================================================================ */

  const runCard = ctx.components.card({ variant: 'filled' });
  runCard.id = RUN_CONTROLS_ELEMENT;
  runCard.setAttribute('data-appearance-id', 'bot.runControls');

  const runStatus = el('p', { className: 'bot-run__status md-typescale-title-small', attrs: { role: 'status', 'aria-live': 'polite' } });
  const runDetail = el('p', { className: 'bot-run__detail md-typescale-body-medium' });
  const runError = el('p', { className: 'bot-run__error md-typescale-body-medium', attrs: { role: 'status' } });
  const deviceCodePanel = el('div', { className: 'bot-run__device', attrs: { role: 'status' } });

  let selectedProfileId = store.lastProfileId();

  const profileSelectHolder = el('div', { className: 'bot-run__picker' });

  const buildProfileSelect = (): void => {
    profileSelectHolder.textContent = '';
    const profiles = store.listProfiles();
    if (profiles.length === 0) {
      profileSelectHolder.append(
        el('p', {
          className: 'bot-form__note md-typescale-body-medium',
          text: ctx.t('bot.run.noProfiles', 'There are no profiles yet. Create one below and it appears here.')
        })
      );
      return;
    }
    if (!profiles.some((profile) => profile.id === selectedProfileId)) selectedProfileId = profiles[0].id;
    const picker = ctx.components.select({
      label: ctx.t('bot.run.profile', 'Profile to run'),
      options: profiles.map((profile) => ({
        value: profile.id,
        label: `${profile.name} — ${profile.host}:${profile.port}`
      })),
      value: selectedProfileId,
      onChange: (value) => {
        selectedProfileId = value;
        store.setLastProfileId(value);
        refreshRun();
      }
    });
    profileSelectHolder.append(picker.root);
  };

  const startButton = ctx.components.button({
    label: ctx.t('bot.run.start', 'Start the bot'),
    variant: 'filled',
    icon: 'play',
    onClick: async () => {
      const profile = store.profile(selectedProfileId);
      if (!profile) return;
      store.setLastProfileId(profile.id);
      const outcome = await runner.start(profile);
      if (!outcome.ok) {
        ctx.notify.error(ctx.t('bot.run.failedTitle', 'The bot did not start'), outcome.reason);
      } else {
        ctx.notify.success(
          ctx.t('bot.run.startedTitle', 'The bot is running'),
          ctx.t('bot.run.startedBody', '{name} is connected through {host}:{port}.', {
            values: { name: profile.name, host: profile.host, port: profile.port }
          })
        );
      }
      refreshRun();
    }
  });

  const stopButton = ctx.components.button({
    label: ctx.t('bot.run.stop', 'Stop the bot'),
    variant: 'tonal',
    icon: 'stop',
    onClick: async () => {
      const outcome = await runner.stop();
      if (!outcome.ok) ctx.notify.error(ctx.t('bot.run.stopFailedTitle', 'The bot did not stop'), outcome.reason);
      refreshRun();
    }
  });

  const revealConfigButton = ctx.components.button({
    label: ctx.t('bot.run.revealConfig', 'Show the generated configuration'),
    variant: 'text',
    icon: 'folder',
    onClick: async () => {
      const path = runner.snapshot().configPath;
      if (path.length === 0) return;
      const shown = await ctx.studio.shell.showItemInFolder(path);
      if (!shown.ok) ctx.notify.error(ctx.t('bot.run.revealFailed', 'That folder could not be opened'), shown.error);
    }
  });

  runCard.append(
    ctx.components.sectionHeading({
      title: ctx.t('bot.run.title', 'Run controls'),
      description: ctx.t(
        'bot.run.help',
        'Starts node scrape.js with a configuration generated from the chosen profile. Start the downloader first: the proxy is what saves the chunks.'
      )
    }),
    profileSelectHolder,
    el('div', { className: 'bot-run__actions', children: [startButton, stopButton, revealConfigButton] }),
    runStatus,
    runDetail,
    runError,
    deviceCodePanel
  );
  root.append(runCard);

  const refreshRun = (): void => {
    const state = runner.snapshot();
    const profile = store.profile(selectedProfileId);
    const problems = profile ? validateProfile(profile) : [];

    runStatus.textContent = ctx.t(phaseKey(state.phase), state.phase);

    if (state.phase === 'idle') {
      runDetail.textContent = profile
        ? ctx.t('bot.run.ready', 'Ready to run {name} against {host}:{port}.', {
            values: { name: profile.name, host: profile.host, port: profile.port }
          })
        : ctx.t('bot.run.noProfileChosen', 'Choose a profile to run.');
    } else {
      runDetail.textContent = ctx.t(
        'bot.run.detail',
        '{name} · process {pid} · started {started} · {lines} line(s) read · {messages} message(s) captured',
        {
          values: {
            name: state.profileName || '—',
            pid: state.pid === null ? '—' : state.pid,
            started: state.startedAt ? formatDateTime(state.startedAt) : '—',
            lines: state.linesRead,
            messages: state.messagesCaptured
          }
        }
      );
    }

    runError.textContent = state.error;
    runError.hidden = state.error.length === 0;

    const canStart = profile !== null && problems.length === 0 && !runner.isBusy();
    startButton.disabled = !canStart;
    if (!canStart) {
      const reason = !profile
        ? ctx.t('bot.run.noProfileChosen', 'Choose a profile to run.')
        : runner.isBusy()
          ? ctx.t('bot.run.alreadyRunning', 'A run is already going. Stop it first.')
          : problems[0].message;
      startButton.title = reason;
      startButton.setAttribute('aria-description', reason);
    } else {
      startButton.removeAttribute('title');
      startButton.removeAttribute('aria-description');
    }

    const canStop = state.phase === 'running';
    stopButton.disabled = !canStop;
    if (!canStop) {
      const reason = ctx.t('bot.run.nothingToStop', 'Nothing is running, so there is nothing to stop.');
      stopButton.title = reason;
      stopButton.setAttribute('aria-description', reason);
    } else {
      stopButton.removeAttribute('title');
      stopButton.removeAttribute('aria-description');
    }

    const hasConfig = state.configPath.length > 0;
    revealConfigButton.disabled = !hasConfig;
    if (!hasConfig) {
      const reason = ctx.t('bot.run.noConfigYet', 'A configuration file exists only while a run is going.');
      revealConfigButton.title = reason;
      revealConfigButton.setAttribute('aria-description', reason);
    } else {
      revealConfigButton.removeAttribute('title');
      revealConfigButton.removeAttribute('aria-description');
    }

    deviceCodePanel.textContent = '';
    if (state.deviceCode) {
      deviceCodePanel.append(
        el('h4', { className: 'md-typescale-title-small', text: ctx.t('bot.run.deviceTitle', 'Microsoft sign-in needed') }),
        el('p', {
          className: 'md-typescale-body-medium',
          text: ctx.t(
            'bot.run.deviceBody',
            'Open {url} in a browser and enter the code {code}. This is only needed once per account; the token is cached afterwards.',
            { values: { url: state.deviceCode.url, code: state.deviceCode.code } }
          )
        }),
        el('p', { className: 'bot-run__code md-typescale-headline-small', text: state.deviceCode.code })
      );
      if (state.deviceCode.url.startsWith('http')) {
        deviceCodePanel.append(
          ctx.components.button({
            label: ctx.t('bot.run.deviceOpen', 'Open the sign-in page'),
            variant: 'tonal',
            onClick: async () => {
              const opened = await ctx.studio.shell.openExternal(state.deviceCode?.url ?? '');
              if (!opened.ok) ctx.notify.error(ctx.t('bot.run.deviceOpenFailed', 'That page could not be opened'), opened.error);
            }
          })
        );
      }
    }
    deviceCodePanel.hidden = state.deviceCode === null;
  };

  /* ================================================================ */
  /* Profiles                                                         */
  /* ================================================================ */

  const profilesCard = ctx.components.card({ variant: 'outlined' });
  profilesCard.id = PROFILE_LIST_ELEMENT;
  profilesCard.setAttribute('data-appearance-id', 'bot.profileList');

  const profileListHost = el('div', { className: 'bot-profiles__list' });
  const profileToolbar = el('div', { className: 'bot-profiles__toolbar' });
  const profileEmptyHost = el('div');
  const editorHost = el('div', { className: 'bot-profiles__editor' });
  let editor: ProfileEditorHandle | null = null;

  let profileQuery: SearchQuery | null = null;
  const profileSelection = new Set<string>();

  const filteredProfiles = (): BotProfile[] => {
    const all = store.listProfiles();
    if (!profileQuery || profileQuery.text.trim().length === 0) return all;
    return all.filter((profile) =>
      profileQuery?.matches(`${profile.name} ${profile.host}:${profile.port} ${profile.usernames.join(' ')} ${profile.notes}`)
    );
  };

  const profileSearch = ctx.createSearchBar({
    label: 'bot.profiles.search',
    sample: store
      .listProfiles()
      .map((profile) => `${profile.name} ${profile.host}:${profile.port}`)
      .join('\n'),
    onChange: (query) => {
      profileQuery = query;
      drawProfiles();
    }
  });

  const closeEditor = (): void => {
    editor?.destroy();
    editor = null;
    editorHost.textContent = '';
  };

  const openEditor = (profile: BotProfile, isNew: boolean): void => {
    closeEditor();
    editor = mountProfileEditor(editorHost, {
      ctx,
      store,
      profile,
      isNew,
      onSaved: (saved) => {
        closeEditor();
        selectedProfileId = saved.id;
        store.setLastProfileId(saved.id);
        buildProfileSelect();
        drawProfiles();
        refreshRun();
      },
      onCancelled: () => {
        closeEditor();
        ctx.a11y.announce(ctx.t('bot.profiles.editCancelled', 'Editing was cancelled. Nothing was changed.'));
      }
    });
    editorHost.scrollIntoView({ behavior: ctx.a11y.reducedMotion() ? 'auto' : 'smooth', block: 'nearest' });
  };

  const exportRecords = async (
    records: Array<Record<string, unknown>>,
    name: string,
    anchorLabel: string
  ): Promise<void> => {
    if (records.length === 0) {
      ctx.notify.warn(
        ctx.t('bot.export.nothingTitle', 'Nothing to export'),
        ctx.t('bot.export.nothing', 'The current filter selects no rows, so nothing would be written.')
      );
      return;
    }
    const format = ctx.settings.get<string>(EXPORT_FORMAT_ID, 'json') as ExportFormat;
    const preflight = ctx.exporter.preflight(records, format);
    if (preflight.losses.length > 0) {
      const body = el('div');
      body.append(
        el('p', {
          className: 'md-typescale-body-medium',
          text: ctx.t('bot.export.lossesBody', '{format} cannot carry every field faithfully:', {
            values: { format: format.toUpperCase() }
          })
        })
      );
      const list = el('ul');
      for (const loss of preflight.losses) {
        list.append(el('li', { className: 'md-typescale-body-small', text: `${loss.field}: ${loss.reason}` }));
      }
      body.append(list);
      const proceed = await ctx.components.dialog({
        title: ctx.t('bot.export.lossesTitle', 'Some fields will not survive this format'),
        body,
        confirmLabel: ctx.t('bot.export.proceed', 'Write it anyway'),
        cancelLabel: ctx.t('core.action.cancel', 'Cancel')
      });
      if (!proceed) return;
    }
    try {
      const path = await ctx.exporter.save(records, format, {
        name,
        defaultFileName: `${name}.${format}`,
        schemaVersion: '1'
      });
      if (path) {
        ctx.notify.success(
          ctx.t('bot.export.savedTitle', 'Exported'),
          ctx.t('bot.export.saved', '{count} row(s) of {what} written to {path}.', {
            values: { count: records.length, what: anchorLabel, path }
          })
        );
      }
    } catch (error) {
      ctx.notify.error(
        ctx.t('bot.export.failedTitle', 'The export was not written'),
        error instanceof Error ? error.message : String(error)
      );
    }
  };

  const drawProfileToolbar = (): void => {
    profileToolbar.textContent = '';
    const shown = filteredProfiles();
    const total = store.listProfiles().length;

    const create = ctx.components.button({
      label: ctx.t('bot.profiles.create', 'New profile'),
      variant: 'filled',
      icon: 'add',
      onClick: () => openEditor(blankProfile(newId('bot-profile'), ctx.t('bot.profiles.untitled', 'New profile')), true)
    });

    const selectShown = ctx.components.button({
      label: ctx.t('bot.profiles.selectShown', 'Select the {count} shown', { values: { count: shown.length } }),
      variant: 'text',
      disabled: shown.length === 0,
      disabledReason: ctx.t('bot.profiles.noneShown', 'The current filter shows no profiles.'),
      onClick: () => {
        for (const profile of shown) profileSelection.add(profile.id);
        drawProfiles();
      }
    });

    const selectEvery = ctx.components.button({
      label: ctx.t('bot.profiles.selectEvery', 'Select all {count} profiles', { values: { count: total } }),
      variant: 'text',
      disabled: total === 0,
      disabledReason: ctx.t('bot.profiles.none', 'There are no profiles yet.'),
      onClick: () => {
        for (const profile of store.listProfiles()) profileSelection.add(profile.id);
        drawProfiles();
      }
    });

    const invert = ctx.components.button({
      label: ctx.t('core.action.invertSelection', 'Invert selection'),
      variant: 'text',
      disabled: shown.length === 0,
      disabledReason: ctx.t('bot.profiles.noneShown', 'The current filter shows no profiles.'),
      onClick: () => {
        for (const profile of shown) {
          if (profileSelection.has(profile.id)) profileSelection.delete(profile.id);
          else profileSelection.add(profile.id);
        }
        drawProfiles();
      }
    });

    const duplicate = ctx.components.button({
      label: ctx.t('bot.profiles.duplicate', 'Duplicate selected'),
      variant: 'text',
      icon: 'copy',
      disabled: profileSelection.size === 0,
      disabledReason: ctx.t('bot.profiles.noSelection', 'No profile is selected.'),
      onClick: async () => {
        const chosen = [...profileSelection];
        for (const id of chosen) {
          const original = store.profile(id);
          if (!original) continue;
          const copy: BotProfile = {
            ...JSON.parse(JSON.stringify(original)),
            id: newId('bot-profile'),
            name: ctx.t('bot.profiles.copyName', '{name} (copy)', { values: { name: original.name } }),
            // A copy never inherits the credential-vault key: two profiles sharing
            // one account key means deleting either one deletes the other's password.
            loginPasswordAccount: '',
            autoLogin: false,
            createdAt: new Date().toISOString()
          };
          store.saveProfile(copy);
        }
        await ctx.history.record('Duplicated scraper bot profiles', 'bot', { ids: chosen });
        profileSelection.clear();
        buildProfileSelect();
        drawProfiles();
        ctx.notify.success(
          ctx.t('bot.profiles.duplicatedTitle', 'Duplicated'),
          ctx.t(
            'bot.profiles.duplicated',
            '{count} profile(s) copied. The copies have no stored password, so automatic login is off on them.',
            { values: { count: chosen.length } }
          )
        );
      }
    });

    const exportSelected = ctx.components.button({
      label: ctx.t('bot.profiles.export', 'Export selected'),
      variant: 'text',
      icon: 'download',
      disabled: profileSelection.size === 0,
      disabledReason: ctx.t('bot.profiles.noSelection', 'No profile is selected.'),
      onClick: async () => {
        const records = store
          .listProfiles()
          .filter((profile) => profileSelection.has(profile.id))
          .map((profile) => ({
            ...profile,
            usernames: profile.usernames.join(', '),
            center: `${profile.center.x}, ${profile.center.z}`,
            bbox: `${profile.bbox.minX}, ${profile.bbox.minZ} to ${profile.bbox.maxX}, ${profile.bbox.maxZ}`,
            loginPasswordAccount: profile.loginPasswordAccount.length > 0 ? 'held in the credential vault' : ''
          }));
        await exportRecords(records, 'scraper-bot-profiles', ctx.t('bot.profiles.what', 'profiles'));
      }
    });

    const remove = ctx.components.button({
      label: ctx.t('core.action.delete', 'Delete'),
      variant: 'text',
      danger: true,
      icon: 'trash',
      disabled: profileSelection.size === 0,
      disabledReason: ctx.t('bot.profiles.noSelection', 'No profile is selected.'),
      onClick: async (event) => {
        const chosen = store.listProfiles().filter((profile) => profileSelection.has(profile.id));
        if (chosen.length === 0) return;
        const approved = await ctx.confirm.request({
          action: ctx.t('bot.profiles.deleteAction', 'Delete {count} scraper bot profile(s)', {
            values: { count: chosen.length }
          }),
          affected: chosen.map((profile) => `${profile.name} (${profile.host}:${profile.port})`),
          irreversible: ctx.t(
            'bot.profiles.deleteIrreversible',
            'The profiles are removed from the settings file. Any password each one stored in the credential vault is deleted with it. Captured messages and visited chunk caches are left alone.'
          ),
          anchor: event.currentTarget as HTMLElement
        });
        if (!approved) return;
        for (const profile of chosen) {
          if (profile.loginPasswordAccount.length > 0) await ctx.studio.vault.delete(profile.loginPasswordAccount);
        }
        store.removeProfiles(chosen.map((profile) => profile.id));
        await ctx.history.record('Deleted scraper bot profiles', 'bot', {
          ids: chosen.map((profile) => profile.id),
          names: chosen.map((profile) => profile.name)
        });
        profileSelection.clear();
        buildProfileSelect();
        drawProfiles();
        refreshRun();
        ctx.notify.success(
          ctx.t('bot.profiles.deletedTitle', 'Profiles deleted'),
          ctx.t('bot.profiles.deleted', '{count} profile(s) removed. The change is in local history.', {
            values: { count: chosen.length }
          })
        );
      }
    });

    profileToolbar.append(create, selectShown, selectEvery, invert, duplicate, exportSelected, remove);
  };

  const drawProfiles = (): void => {
    drawProfileToolbar();
    profileListHost.textContent = '';
    profileEmptyHost.textContent = '';

    const all = store.listProfiles();
    if (all.length === 0) {
      profileEmptyHost.append(
        ctx.components.emptyState({
          title: ctx.t('bot.profiles.emptyTitle', 'No profiles yet'),
          body: ctx.t(
            'bot.profiles.emptyBody',
            'A profile is the configuration the scraper actually reads. Start from a preset below, or build one field by field.'
          ),
          action: {
            label: ctx.t('bot.profiles.create', 'New profile'),
            variant: 'filled',
            icon: 'add',
            onClick: () => openEditor(blankProfile(newId('bot-profile'), ctx.t('bot.profiles.untitled', 'New profile')), true)
          }
        }),
        buildPresetPicker({
          ctx,
          onChoose: (profile, preset) => {
            openEditor(profile, true);
            ctx.a11y.announce(
              ctx.t('bot.presets.applied', 'The preset {preset} was applied. Every field is still editable.', {
                values: { preset: preset.name }
              })
            );
          }
        })
      );
      return;
    }

    const shown = filteredProfiles();
    if (shown.length === 0) {
      profileListHost.append(
        el('p', {
          className: 'bot-form__note md-typescale-body-medium',
          text: ctx.t('core.search.noMatches', 'Nothing matched.')
        })
      );
      return;
    }

    const list = ctx.components.list({ label: ctx.t('bot.profiles.list', 'Saved profiles') });
    for (const profile of shown) {
      const problems = validateProfile(profile);
      const trailing = el('div', { className: 'bot-profiles__row-actions' });
      trailing.append(
        ctx.components.iconButton({
          icon: 'play',
          label: ctx.t('bot.profiles.runOne', 'Run {name}', { values: { name: profile.name } }),
          disabled: problems.length > 0 || runner.isBusy(),
          disabledReason: runner.isBusy()
            ? ctx.t('bot.run.alreadyRunning', 'A run is already going. Stop it first.')
            : problems[0]?.message ?? '',
          onClick: async () => {
            selectedProfileId = profile.id;
            buildProfileSelect();
            const outcome = await runner.start(profile);
            if (!outcome.ok) ctx.notify.error(ctx.t('bot.run.failedTitle', 'The bot did not start'), outcome.reason);
            refreshRun();
          }
        }),
        ctx.components.iconButton({
          icon: 'edit',
          label: ctx.t('bot.profiles.editOne', 'Edit {name}', { values: { name: profile.name } }),
          onClick: () => openEditor(profile, false)
        })
      );

      const item = ctx.components.listItem({
        headline: profile.name,
        supporting: ctx.t(
          'bot.profiles.summary',
          '{host}:{port} · {bots} bot(s) · {area} · {status}',
          {
            values: {
              host: profile.host,
              port: profile.port,
              bots: profile.usernames.length,
              area:
                profile.areaMode === 'bbox'
                  ? ctx.t('bot.profiles.areaBox', 'bounding box')
                  : profile.areaMode === 'spawn'
                    ? ctx.t('bot.profiles.areaSpawn', '{radius} blocks around each spawn', { values: { radius: profile.radius } })
                    : ctx.t('bot.profiles.areaCentre', '{radius} blocks around {x}, {z}', {
                        values: { radius: profile.radius, x: profile.center.x, z: profile.center.z }
                      }),
              status:
                problems.length === 0
                  ? ctx.t('bot.profiles.usable', 'ready to run')
                  : ctx.t('bot.profiles.needsWork', '{count} field(s) need attention', { values: { count: problems.length } })
            }
          }
        ),
        leadingIcon: 'terminal',
        selectable: true,
        selected: profileSelection.has(profile.id),
        trailing,
        onSelectChange: (selected) => {
          if (selected) profileSelection.add(profile.id);
          else profileSelection.delete(profile.id);
          drawProfileToolbar();
        },
        onActivate: () => openEditor(profile, false)
      });
      item.setAttribute('data-appearance-id', `bot.profile.${profile.id}`);
      list.append(item);
    }
    profileListHost.append(list);
  };

  profilesCard.append(
    ctx.components.sectionHeading({
      title: ctx.t('bot.profiles.title', 'Profiles'),
      description: ctx.t(
        'bot.profiles.help',
        'Each profile is one complete scraper configuration. Selecting several lets you duplicate, export or delete them together.'
      )
    }),
    profileSearch.root,
    profileToolbar,
    profileListHost,
    profileEmptyHost,
    editorHost
  );
  root.append(profilesCard);

  /* ================================================================ */
  /* Run log                                                          */
  /* ================================================================ */

  const logCard = ctx.components.card({ variant: 'outlined' });
  logCard.id = LOG_ELEMENT;
  logCard.setAttribute('data-appearance-id', 'bot.runLog');

  const logView = el('div', {
    className: 'bot-log',
    attrs: { role: 'log', 'aria-live': 'polite', 'aria-label': ctx.t('bot.log.region', 'Run log'), tabindex: '0' }
  });
  const logCount = el('p', { className: 'bot-log__count md-typescale-body-small', attrs: { role: 'status' } });

  let logQuery: SearchQuery | null = null;
  const logSeverities = new Set<LogSeverity>(['info', 'warning', 'error']);

  const logSearch = ctx.createSearchBar({
    label: 'bot.log.search',
    sample: runner
      .lines()
      .slice(-40)
      .map((line) => line.text)
      .join('\n'),
    onChange: (query) => {
      logQuery = query;
      drawLog();
    }
  });

  const severityChips = el('div', { className: 'bot-log__filters', attrs: { role: 'group', 'aria-label': ctx.t('bot.log.severity', 'Severity filter') } });
  for (const severity of ['info', 'warning', 'error'] as LogSeverity[]) {
    severityChips.append(
      ctx.components.chip({
        label: ctx.t(`bot.severity.${severity}`, severity),
        selected: true,
        onToggle: (selected) => {
          if (selected) logSeverities.add(severity);
          else logSeverities.delete(severity);
          drawLog();
        }
      })
    );
  }

  const followSwitch = ctx.components.switchControl({
    label: ctx.t('bot.log.follow', 'Follow the newest line'),
    checked: ctx.settings.get<boolean>(FOLLOW_LOG_ID, true),
    onChange: (checked) => ctx.settings.set(FOLLOW_LOG_ID, checked)
  });

  const clearLogButton = ctx.components.button({
    label: ctx.t('bot.log.clear', 'Clear the view'),
    variant: 'text',
    onClick: () => {
      runner.clearLog();
      ctx.a11y.announce(ctx.t('bot.log.cleared', 'The run log view was emptied. Captured messages were not touched.'));
    }
  });

  const exportLogButton = ctx.components.button({
    label: ctx.t('bot.log.export', 'Export the shown lines'),
    variant: 'text',
    icon: 'download',
    onClick: async () => {
      const records = visibleLogLines().map((line) => ({
        timestamp: line.timestamp,
        severity: line.severity,
        stream: line.stream,
        text: line.text
      }));
      await exportRecords(records, 'scraper-bot-log', ctx.t('bot.log.what', 'log lines'));
    }
  });

  const visibleLogLines = (): LogLine[] =>
    runner.lines().filter((line) => {
      if (!logSeverities.has(line.severity)) return false;
      if (!logQuery || logQuery.text.trim().length === 0) return true;
      return logQuery.matches(line.text);
    });

  const drawLog = (): void => {
    const filtered = visibleLogLines();
    const window = filtered.slice(-LOG_RENDER_WINDOW);
    logView.textContent = '';
    if (filtered.length === 0) {
      logView.append(
        el('p', {
          className: 'bot-form__note md-typescale-body-medium',
          text:
            runner.lines().length === 0
              ? ctx.t('bot.log.empty', 'Nothing has run yet. Start a profile and the scraper’s own output appears here as it arrives.')
              : ctx.t('core.search.noMatches', 'Nothing matched.')
        })
      );
    } else {
      for (const line of window) {
        const row = el('div', { className: `bot-log__line bot-log__line--${line.severity}` });
        row.append(
          el('span', { className: 'bot-log__time md-typescale-label-small', text: formatTime(line.timestamp) }),
          el('span', { className: 'bot-log__stream md-typescale-label-small', text: line.stream }),
          el('span', { className: 'bot-log__text', text: line.text })
        );
        logView.append(row);
      }
    }

    logCount.textContent =
      filtered.length > window.length
        ? ctx.t('bot.log.windowed', 'Showing the newest {shown} of {total} matching line(s); {held} line(s) are held in memory.', {
            values: { shown: window.length, total: filtered.length, held: runner.lines().length }
          })
        : ctx.t('bot.log.count', '{shown} of {total} line(s) shown.', {
            values: { shown: filtered.length, total: runner.lines().length }
          });

    if (followSwitch.get()) logView.scrollTop = logView.scrollHeight;
  };

  logCard.append(
    ctx.components.sectionHeading({
      title: ctx.t('bot.log.title', 'Run log'),
      description: ctx.t(
        'bot.log.help',
        'Every line the scraper wrote, verbatim. The severity is read from the line and from which stream it came out of; the text itself is never rewritten.'
      )
    }),
    logSearch.root,
    el('div', { className: 'bot-log__toolbar', children: [severityChips, followSwitch.root, clearLogButton, exportLogButton] }),
    logView,
    logCount
  );
  root.append(logCard);

  /* ================================================================ */
  /* Captured messages                                                */
  /* ================================================================ */

  const messagesCard = ctx.components.card({ variant: 'outlined' });
  messagesCard.id = MESSAGES_ELEMENT;
  messagesCard.setAttribute('data-appearance-id', 'bot.messageTable');

  let messageQuery: SearchQuery | null = null;
  let channelFilter: MessageChannel | 'all' = 'all';
  let messageSelection: string[] = [];
  const messageCount = el('p', { className: 'bot-messages__count md-typescale-body-small', attrs: { role: 'status' } });
  const messageToolbar = el('div', { className: 'bot-messages__toolbar' });
  const messageEmptyHost = el('div');

  const filteredMessages = (): CapturedMessage[] =>
    store.listMessages().filter((row) => {
      if (channelFilter !== 'all' && row.channel !== channelFilter) return false;
      if (!messageQuery || messageQuery.text.trim().length === 0) return true;
      return messageQuery.matches(`${row.sender} ${row.message} ${row.tags.join(' ')} ${row.origin}`);
    });

  const messageSearch = ctx.createSearchBar({
    label: 'bot.messages.search',
    sample: store
      .listMessages()
      .slice(-40)
      .map((row) => `${row.sender}: ${row.message}`)
      .join('\n'),
    onChange: (query) => {
      messageQuery = query;
      redrawMessages();
    }
  });

  const channelSelect = ctx.components.select({
    label: ctx.t('bot.messages.channel', 'Channel'),
    options: [
      { value: 'all', label: ctx.t('bot.channel.all', 'Every channel') },
      ...MESSAGE_CHANNELS.map((channel) => ({ value: channel, label: ctx.t(CHANNEL_LABEL_KEYS[channel], channel) }))
    ],
    value: 'all',
    onChange: (value) => {
      channelFilter = value === 'all' ? 'all' : (value as MessageChannel);
      redrawMessages();
    }
  });

  const messageTable = ctx.components.dataTable<CapturedMessage>({
    label: ctx.t('bot.messages.table', 'Captured messages'),
    columns: [
      {
        id: 'timestamp',
        label: ctx.t('bot.messages.time', 'Time'),
        sortable: true,
        value: (row) => row.timestamp,
        render: (row) => {
          const cell = el('span', { className: 'bot-messages__time', text: formatDateTime(row.timestamp) });
          if (!row.timestampFromLine) {
            cell.title = ctx.t(
              'bot.messages.timeCaptured',
              'The line carried no time of its own, so this is when it was captured.'
            );
          }
          return cell;
        }
      },
      { id: 'sender', label: ctx.t('bot.messages.sender', 'Sender'), sortable: true, value: (row) => row.sender },
      {
        id: 'channel',
        label: ctx.t('bot.messages.channelColumn', 'Channel'),
        sortable: true,
        value: (row) => row.channel,
        render: (row) => ctx.components.badge({ label: ctx.t(CHANNEL_LABEL_KEYS[row.channel], row.channel) })
      },
      { id: 'message', label: ctx.t('bot.messages.message', 'Message'), sortable: true, value: (row) => row.message },
      {
        id: 'tags',
        label: ctx.t('bot.messages.tags', 'Tags'),
        sortable: true,
        value: (row) => row.tags.join(', ')
      }
    ],
    rows: [],
    rowId: (row) => row.id,
    selectable: true,
    emptyMessage: ctx.t('core.search.noMatches', 'Nothing matched.'),
    onSelectionChange: (ids) => {
      messageSelection = ids;
      drawMessageToolbar();
    }
  });

  const copySelected = async (rows: CapturedMessage[]): Promise<void> => {
    const text = rows.map((row) => `${formatDateTime(row.timestamp)}\t${row.sender}\t${row.channel}\t${row.message}`).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      ctx.notify.success(
        ctx.t('bot.messages.copiedTitle', 'Copied'),
        ctx.t('bot.messages.copied', '{count} message(s) copied to the clipboard.', { values: { count: rows.length } })
      );
    } catch (error) {
      ctx.notify.error(
        ctx.t('bot.messages.copyFailedTitle', 'Nothing was copied'),
        error instanceof Error ? error.message : String(error)
      );
    }
  };

  const askForTag = async (add: boolean): Promise<void> => {
    const known = store.knownTags();
    const body = el('div', { className: 'bot-messages__tag-dialog' });
    let chosen = known[0] ?? '';
    if (known.length > 0) {
      const picker = ctx.components.select({
        label: ctx.t('bot.messages.tagExisting', 'A tag already in use'),
        options: known.map((tag) => ({ value: tag, label: tag })),
        value: chosen,
        onChange: (value) => {
          chosen = value;
          field.set(value);
        }
      });
      body.append(picker.root);
    }
    const field = ctx.components.textField({
      label: ctx.t('bot.messages.tagName', 'Tag'),
      value: chosen,
      variant: 'outlined',
      supportingText: ctx.t('bot.messages.tagHelp', 'Tags are your own labels. They are stored with the message and exported with it.'),
      onChange: (value) => {
        chosen = value;
      }
    });
    body.append(field.root);

    const confirmed = await ctx.components.dialog({
      title: add
        ? ctx.t('bot.messages.tagAddTitle', 'Tag the selected messages')
        : ctx.t('bot.messages.tagRemoveTitle', 'Remove a tag from the selected messages'),
      body,
      confirmLabel: add ? ctx.t('bot.messages.tagAdd', 'Add the tag') : ctx.t('bot.messages.tagRemove', 'Remove the tag'),
      cancelLabel: ctx.t('core.action.cancel', 'Cancel')
    });
    if (!confirmed) return;
    const tag = chosen.trim();
    if (tag.length === 0) {
      ctx.notify.warn(
        ctx.t('bot.messages.tagEmptyTitle', 'No tag was given'),
        ctx.t('bot.messages.tagEmpty', 'Type a tag first. Nothing was changed.')
      );
      return;
    }
    const changed = store.setTags(messageSelection, tag, add);
    await ctx.history.record(add ? 'Tagged captured bot messages' : 'Untagged captured bot messages', 'bot', {
      tag,
      ids: messageSelection,
      changed
    });
    redrawMessages();
    ctx.notify.success(
      add ? ctx.t('bot.messages.taggedTitle', 'Tagged') : ctx.t('bot.messages.untaggedTitle', 'Tag removed'),
      ctx.t('bot.messages.tagged', '{changed} of {selected} selected message(s) changed.', {
        values: { changed, selected: messageSelection.length }
      })
    );
  };

  const drawMessageToolbar = (): void => {
    messageToolbar.textContent = '';
    const shown = filteredMessages();
    const total = store.listMessages().length;
    const noSelection = ctx.t('bot.messages.noSelection', 'No message is selected.');

    messageToolbar.append(
      ctx.components.button({
        label: ctx.t('bot.messages.selectShown', 'Select the {count} shown', { values: { count: shown.length } }),
        variant: 'text',
        disabled: shown.length === 0,
        disabledReason: ctx.t('bot.messages.noneShown', 'The current filter shows no messages.'),
        onClick: () => {
          messageTable.setSelection(shown.map((row) => row.id));
          messageSelection = shown.map((row) => row.id);
          drawMessageToolbar();
        }
      }),
      ctx.components.button({
        label: ctx.t('bot.messages.selectEvery', 'Select all {count} captured', { values: { count: total } }),
        variant: 'text',
        disabled: total === 0,
        disabledReason: ctx.t('bot.messages.none', 'Nothing has been captured yet.'),
        onClick: () => {
          const ids = store.listMessages().map((row) => row.id);
          messageTable.setSelection(ids);
          messageSelection = ids;
          drawMessageToolbar();
        }
      }),
      ctx.components.button({
        label: ctx.t('core.action.invertSelection', 'Invert selection'),
        variant: 'text',
        disabled: shown.length === 0,
        disabledReason: ctx.t('bot.messages.noneShown', 'The current filter shows no messages.'),
        onClick: () => {
          const current = new Set(messageSelection);
          const next = shown.filter((row) => !current.has(row.id)).map((row) => row.id);
          messageTable.setSelection(next);
          messageSelection = next;
          drawMessageToolbar();
        }
      }),
      ctx.components.button({
        label: ctx.t('core.action.copy', 'Copy'),
        variant: 'text',
        icon: 'copy',
        disabled: messageSelection.size(),
        disabledReason: noSelection,
        onClick: () => {
          const set = new Set(messageSelection);
          void copySelected(store.listMessages().filter((row) => set.has(row.id)));
        }
      }),
      ctx.components.button({
        label: ctx.t('bot.messages.tagAction', 'Tag selected'),
        variant: 'text',
        disabled: messageSelection.length === 0,
        disabledReason: noSelection,
        onClick: () => void askForTag(true)
      }),
      ctx.components.button({
        label: ctx.t('bot.messages.untagAction', 'Untag selected'),
        variant: 'text',
        disabled: messageSelection.length === 0,
        disabledReason: noSelection,
        onClick: () => void askForTag(false)
      }),
      ctx.components.button({
        label: ctx.t('bot.messages.exportShown', 'Export the shown rows'),
        variant: 'text',
        icon: 'download',
        disabled: shown.length === 0,
        disabledReason: ctx.t('bot.messages.noneShown', 'The current filter shows no messages.'),
        onClick: async () => {
          await exportRecords(
            shown.map((row) => ({ ...row, tags: row.tags.join(', ') })),
            'scraper-bot-messages',
            ctx.t('bot.messages.what', 'captured messages')
          );
        }
      }),
      ctx.components.button({
        label: ctx.t('bot.messages.exportSelected', 'Export selected'),
        variant: 'text',
        icon: 'download',
        disabled: messageSelection.length === 0,
        disabledReason: noSelection,
        onClick: async () => {
          const set = new Set(messageSelection);
          await exportRecords(
            store
              .listMessages()
              .filter((row) => set.has(row.id))
              .map((row) => ({ ...row, tags: row.tags.join(', ') })),
            'scraper-bot-messages',
            ctx.t('bot.messages.what', 'captured messages')
          );
        }
      }),
      ctx.components.button({
        label: ctx.t('bot.messages.deleteSelected', 'Delete selected'),
        variant: 'text',
        danger: true,
        icon: 'trash',
        disabled: messageSelection.length === 0,
        disabledReason: noSelection,
        onClick: async (event) => {
          const set = new Set(messageSelection);
          const rows = store.listMessages().filter((row) => set.has(row.id));
          if (rows.length === 0) return;
          const approved = await ctx.confirm.request({
            action: ctx.t('bot.messages.deleteAction', 'Delete {count} captured message(s)', { values: { count: rows.length } }),
            affected: rows.slice(0, 20).map((row) => `${formatDateTime(row.timestamp)} ${row.sender}: ${row.message}`),
            irreversible: ctx.t(
              'bot.messages.deleteIrreversible',
              'The messages are removed from the stored table. They can only come back by running the scraper again or importing a log file that still contains them.'
            ),
            anchor: event.currentTarget as HTMLElement
          });
          if (!approved) return;
          store.removeMessages([...set]);
          await ctx.history.record('Deleted captured bot messages', 'bot', { count: rows.length, ids: [...set] });
          messageTable.clearSelection();
          messageSelection = [];
          redrawMessages();
          ctx.notify.success(
            ctx.t('bot.messages.deletedTitle', 'Messages deleted'),
            ctx.t('bot.messages.deleted', '{count} message(s) removed.', { values: { count: rows.length } })
          );
        }
      }),
      ctx.components.button({
        label: ctx.t('bot.messages.clearAll', 'Clear every captured message'),
        variant: 'text',
        danger: true,
        disabled: total === 0,
        disabledReason: ctx.t('bot.messages.none', 'Nothing has been captured yet.'),
        onClick: async (event) => {
          const approved = await ctx.confirm.request({
            action: ctx.t('bot.messages.clearAction', 'Clear every captured message ({count})', { values: { count: total } }),
            affected: [
              ctx.t('bot.messages.clearAffected', 'Every captured message, from every run and every imported file')
            ],
            irreversible: ctx.t(
              'bot.messages.clearIrreversible',
              'The whole table is emptied, including rows the current filter is hiding. Profiles, the run log and the visited chunk cache are left alone.'
            ),
            anchor: event.currentTarget as HTMLElement
          });
          if (!approved) return;
          const removed = store.clearMessages();
          await ctx.history.record('Cleared every captured bot message', 'bot', { removed });
          messageTable.clearSelection();
          messageSelection = [];
          redrawMessages();
          ctx.notify.success(
            ctx.t('bot.messages.clearedTitle', 'Table cleared'),
            ctx.t('bot.messages.cleared', '{count} message(s) removed.', { values: { count: removed } })
          );
        }
      }),
      ctx.components.button({
        label: ctx.t('bot.messages.import', 'Import a log file'),
        variant: 'tonal',
        icon: 'upload',
        onClick: () => void importLogFile()
      })
    );
  };

  const importLogFile = async (): Promise<void> => {
    const picked = await ctx.studio.dialog.openFile({
      title: ctx.t('bot.messages.importTitle', 'Choose a log file to read'),
      filters: [
        { name: 'Log files', extensions: ['log', 'txt'] },
        { name: 'Every file', extensions: ['*'] }
      ]
    });
    if (!picked.ok) {
      ctx.notify.error(ctx.t('bot.messages.importFailedTitle', 'The file was not read'), picked.error);
      return;
    }
    if (!picked.value || picked.value.length === 0) return;
    const path = picked.value[0];
    const read = await ctx.studio.fs.readText(path, 16 * 1024 * 1024);
    if (!read.ok) {
      ctx.notify.error(ctx.t('bot.messages.importFailedTitle', 'The file was not read'), read.error);
      return;
    }
    const compiled = compileRules(store.listRules());
    const summary = captureLines(read.value.split(/\r?\n/), compiled, { origin: path, source: 'import' });
    if (summary.messages.length === 0) {
      ctx.notify.warn(
        ctx.t('bot.messages.importNothingTitle', 'Nothing matched in that file'),
        ctx.t(
          'bot.messages.importNothing',
          '{lines} line(s) were read and no capture rule matched any of them. Adjust a rule below, or add one, and import again.',
          { values: { lines: summary.linesRead } }
        )
      );
      return;
    }
    const dropped = store.addMessages(summary.messages);
    await ctx.history.record('Imported captured bot messages', 'bot', {
      path,
      linesRead: summary.linesRead,
      captured: summary.messages.length
    });
    redrawMessages();
    ctx.notify.success(
      ctx.t('bot.messages.importedTitle', 'Log file imported'),
      dropped > 0
        ? ctx.t(
            'bot.messages.importedTrimmed',
            '{captured} message(s) captured from {lines} line(s). {dropped} older row(s) were dropped to stay inside the stored message limit.',
            { values: { captured: summary.messages.length, lines: summary.linesRead, dropped } }
          )
        : ctx.t('bot.messages.imported', '{captured} message(s) captured from {lines} line(s).', {
            values: { captured: summary.messages.length, lines: summary.linesRead }
          })
    );
  };

  const redrawMessages = (): void => {
    const shown = filteredMessages();
    messageTable.setRows(shown);
    messageEmptyHost.textContent = '';
    const total = store.listMessages().length;
    if (total === 0) {
      messageEmptyHost.append(
        ctx.components.emptyState({
          title: ctx.t('bot.messages.emptyTitle', 'Nothing captured yet'),
          body: ctx.t(
            'bot.messages.emptyBody',
            'Rows appear here when a capture rule matches a line the scraper printed. The scraper as shipped reports sign-in, progress, kicks and errors; it does not echo server chat, so chat rows come from a server or console log you import.'
          ),
          action: {
            label: ctx.t('bot.messages.import', 'Import a log file'),
            variant: 'tonal',
            icon: 'upload',
            onClick: () => void importLogFile()
          }
        })
      );
    }
    messageCount.textContent = ctx.t('bot.messages.count', '{shown} of {total} captured message(s) shown, {selected} selected.', {
      values: { shown: shown.length, total, selected: messageSelection.length }
    });
    drawMessageToolbar();
  };

  messagesCard.append(
    ctx.components.sectionHeading({
      title: ctx.t('bot.messages.title', 'Captured messages'),
      description: ctx.t(
        'bot.messages.help',
        'Lines a capture rule matched, kept as rows you can sort, filter, tag, export and delete. Every row states which run or file it came from.'
      )
    }),
    messageSearch.root,
    channelSelect.root,
    messageToolbar,
    messageTable.root,
    messageCount,
    messageEmptyHost
  );
  root.append(messagesCard);

  /* ================================================================ */
  /* Capture rules                                                    */
  /* ================================================================ */

  const rulesCard = ctx.components.card({ variant: 'outlined' });
  rulesCard.setAttribute('data-appearance-id', 'bot.captureRules');
  const rulesHost = el('div', { className: 'bot-rules__list' });

  const drawRules = (): void => {
    rulesHost.textContent = '';
    const list = ctx.components.list({ label: ctx.t('bot.rules.list', 'Capture rules') });
    for (const rule of store.listRules()) {
      const row = el('div', { className: 'bot-rules__row' });
      const enabled = ctx.components.switchControl({
        label: ctx.t('bot.rules.enabled', 'Use “{name}”', { values: { name: rule.name } }),
        checked: rule.enabled,
        onChange: (checked) => {
          store.saveRule({ ...rule, enabled: checked });
          drawRules();
        }
      });

      const patternField = ctx.components.textField({
        label: ctx.t('bot.rules.pattern', 'Pattern for “{name}”', { values: { name: rule.name } }),
        value: rule.pattern,
        variant: 'outlined',
        onCommit: (value) => {
          store.saveRule({ ...rule, pattern: value });
          drawRules();
        }
      });

      const compiled = compileRules([rule])[0];
      if (compiled.error) {
        const problem = el('p', { className: 'bot-rules__error md-typescale-body-small', attrs: { role: 'status' } });
        problem.textContent = ctx.t('core.regex.invalid', 'That pattern does not compile: {message}', {
          values: { message: compiled.error }
        });
        row.append(problem);
      }

      const builderAnchor = ctx.components.iconButton({
        icon: 'code',
        label: ctx.t('bot.rules.builder', 'Open the pattern builder for “{name}”', { values: { name: rule.name } }),
        onClick: () => {
          const builder = ctx.createRegexBuilder({
            anchor: builderAnchor,
            initialPattern: rule.pattern,
            initialFlags: rule.flags,
            sample: runner
              .lines()
              .slice(-20)
              .map((line) => line.text)
              .join('\n'),
            onApply: (state) => {
              store.saveRule({ ...rule, pattern: state.pattern, flags: state.flags });
              drawRules();
            }
          });
          builder.open();
        }
      });

      const channel = ctx.components.select({
        label: ctx.t('bot.rules.channel', 'Channel for “{name}”', { values: { name: rule.name } }),
        options: MESSAGE_CHANNELS.map((value) => ({ value, label: ctx.t(CHANNEL_LABEL_KEYS[value], value) })),
        value: rule.channel,
        onChange: (value) => {
          store.saveRule({ ...rule, channel: value as MessageChannel });
          drawRules();
        }
      });

      const remove = ctx.components.iconButton({
        icon: 'trash',
        label: ctx.t('bot.rules.remove', 'Remove the rule “{name}”', { values: { name: rule.name } }),
        onClick: async (event) => {
          const approved = await ctx.confirm.request({
            action: ctx.t('bot.rules.removeAction', 'Remove the capture rule “{name}”', { values: { name: rule.name } }),
            affected: [`${rule.name}: /${rule.pattern}/${rule.flags}`],
            irreversible: rule.builtIn
              ? ctx.t(
                  'bot.rules.removeBuiltIn',
                  'A shipped rule is removed from the list. Restoring the shipped rules brings it back; messages it already captured are untouched.'
                )
              : ctx.t(
                  'bot.rules.removeCustom',
                  'A rule you wrote is deleted and cannot be restored. Messages it already captured are untouched.'
                ),
            anchor: event.currentTarget as HTMLElement
          });
          if (!approved) return;
          store.removeRules([rule.id]);
          await ctx.history.record('Removed a bot capture rule', 'bot', { id: rule.id, name: rule.name });
          drawRules();
        }
      });

      row.append(enabled.root, patternField.root, builderAnchor, channel.root, remove);
      const item = el('li', { className: 'bot-rules__item', children: [row] });
      list.append(item);
    }
    rulesHost.append(list);
  };

  const addRuleButton = ctx.components.button({
    label: ctx.t('bot.rules.add', 'Add a rule'),
    variant: 'tonal',
    icon: 'add',
    onClick: () => {
      const rule: CaptureRule = {
        id: newId('bot-rule'),
        name: ctx.t('bot.rules.newName', 'New rule'),
        enabled: true,
        pattern: '^(.+)$',
        flags: '',
        senderTemplate: 'scraper',
        messageGroup: 1,
        timestampGroup: 0,
        channel: 'system',
        builtIn: false
      };
      store.saveRule(rule);
      drawRules();
    }
  });

  const restoreRulesButton = ctx.components.button({
    label: ctx.t('bot.rules.restore', 'Restore the shipped rules'),
    variant: 'text',
    icon: 'refresh',
    onClick: async () => {
      store.restoreBuiltInRules();
      await ctx.history.record('Restored the shipped bot capture rules', 'bot', {});
      drawRules();
      ctx.notify.success(
        ctx.t('bot.rules.restoredTitle', 'Shipped rules restored'),
        ctx.t('bot.rules.restored', 'The rules that ship with the application are back. Rules you wrote were kept.')
      );
    }
  });

  rulesCard.append(
    ctx.components.sectionHeading({
      title: ctx.t('bot.rules.title', 'Capture rules'),
      description: ctx.t(
        'bot.rules.help',
        'A line becomes a captured message only when one of these patterns matches it. The shipped rules match the shapes the bundled scraper genuinely prints; add your own for a server or console log format.'
      )
    }),
    el('div', { className: 'bot-rules__toolbar', children: [addRuleButton, restoreRulesButton] }),
    rulesHost
  );
  root.append(rulesCard);

  /* ================================================================ */
  /* Wiring                                                           */
  /* ================================================================ */

  const unsubscribeRunner = runner.subscribe(() => {
    refreshRun();
    drawLog();
  });
  const unsubscribeStore = store.subscribe(() => {
    redrawMessages();
  });
  const unsubscribeLanguage = ctx.i18n.onChange(() => {
    refreshRun();
    drawLog();
    redrawMessages();
    drawProfiles();
    drawRules();
  });

  buildProfileSelect();
  drawProfiles();
  refreshRun();
  drawLog();
  drawRules();
  redrawMessages();
  void runner.adopt();

  ctx.onDispose(() => {
    unsubscribeRunner();
    unsubscribeStore();
    unsubscribeLanguage();
    profileSearch.destroy();
    logSearch.destroy();
    messageSearch.destroy();
    closeEditor();
  });

  // Referenced so the identifier is not dropped by an unused check: the id is
  // what the palette teleports to when it reveals the log region.
  logView.setAttribute('data-region-id', nextId('bot-log-region'));
}
