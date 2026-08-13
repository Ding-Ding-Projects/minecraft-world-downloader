/**
 * The guided profile editor.
 *
 * Nothing here is a blank box where an enumeration exists: the version list is
 * read from the scraper's own installed protocol data, the host list is seeded
 * from the profiles that already exist, the movement choices are switches rather
 * than remembered key names, and every path field carries a native browse
 * control. Free text stays available everywhere it is meaningful, because a
 * picker cannot anticipate a private server's address or a name nobody has used
 * yet.
 *
 * Validation is inline and in plain words. A control that is unavailable says
 * exactly which condition is unmet rather than sitting there greyed out.
 */

import { el, nextId } from '../../core/a11y';
import type { AppContext, ControlHandle } from '../../core/registry';
import { estimateArea, presets, redactedConfig, toScraperConfig, validateProfile } from './config';
import type { FieldProblem, ProfilePreset } from './config';
import type { AreaMode, AuthMode, BotProfile, BotStore } from './state';
import { SCRAPER_DIR_ID, newId } from './state';

/* ================================================================== */
/* Small helpers                                                       */
/* ================================================================== */

function numberField(
  ctx: AppContext,
  options: {
    label: string;
    help?: string;
    value: number;
    min?: number;
    max?: number;
    step?: number;
    suffix?: string;
    onChange(value: number): void;
  }
): ControlHandle<string> {
  return ctx.components.textField({
    label: options.label,
    value: String(options.value),
    type: 'number',
    variant: 'outlined',
    min: options.min,
    max: options.max,
    step: options.step ?? 1,
    suffix: options.suffix,
    supportingText: options.help,
    onChange: (raw) => {
      const parsed = Number(raw);
      if (Number.isFinite(parsed)) options.onChange(parsed);
    }
  });
}

function fieldRow(children: HTMLElement[]): HTMLElement {
  return el('div', { className: 'bot-form__row', children });
}

function group(ctx: AppContext, titleKey: string, descriptionKey: string, children: HTMLElement[]): HTMLElement {
  const section = el('section', { className: 'bot-form__group' });
  section.append(
    ctx.components.sectionHeading({
      title: ctx.t(titleKey, titleKey),
      description: ctx.t(descriptionKey, descriptionKey)
    })
  );
  for (const child of children) section.append(child);
  return section;
}

/* ================================================================== */
/* The version picker, populated from real installed data              */
/* ================================================================== */

/**
 * Reads the protocol versions the scraper's own `minecraft-data` install
 * actually carries.
 *
 * When the dependency is not installed the picker says so and falls back to the
 * versions the user's other profiles already name, which is still real data
 * rather than a guessed list.
 */
async function readInstalledVersions(ctx: AppContext, scraperDirectory: string): Promise<{ versions: string[]; note: string }> {
  const directory = scraperDirectory.trim();
  if (directory.length === 0) {
    return { versions: [], note: ctx.t('bot.version.noDirectory', 'Set the scraper folder to read the installed version list.') };
  }
  const separator = directory.includes('\\') && !directory.includes('/') ? '\\' : '/';
  const base = directory.replace(/[\\/]+$/, '');
  const dataDir = `${base}${separator}node_modules${separator}minecraft-data${separator}minecraft-data${separator}data${separator}pc`;
  const listed = await ctx.studio.fs.readDirectory(dataDir);
  if (!listed.ok) {
    return {
      versions: [],
      note: ctx.t('bot.version.notReadable', 'The installed version list could not be read.')
    };
  }
  const versions = listed.value
    .filter((entry) => entry.isDirectory && /^\d+\.\d+(\.\d+)?$/.test(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => compareVersions(b, a));
  return {
    versions,
    note:
      versions.length > 0
        ? ctx.t('bot.version.fromInstall', 'Read from the scraper folder.')
        : ctx.t('bot.version.notReadable', 'The installed version list could not be read.')
  };
}

function compareVersions(left: string, right: string): number {
  const a = left.split('.').map((part) => Number(part) || 0);
  const b = right.split('.').map((part) => Number(part) || 0);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const diff = (a[index] ?? 0) - (b[index] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/* ================================================================== */
/* The editor                                                          */
/* ================================================================== */

export interface ProfileEditorOptions {
  ctx: AppContext;
  store: BotStore;
  /** The profile being edited. It is copied; the store is only written on save. */
  profile: BotProfile;
  /** True for a profile that does not exist yet, which changes the save copy. */
  isNew: boolean;
  onSaved(profile: BotProfile): void;
  onCancelled(): void;
}

export interface ProfileEditorHandle {
  root: HTMLElement;
  destroy(): void;
}

export function mountProfileEditor(host: HTMLElement, options: ProfileEditorOptions): ProfileEditorHandle {
  const { ctx, store } = options;
  const draft: BotProfile = JSON.parse(JSON.stringify(options.profile)) as BotProfile;

  const root = el('div', { className: 'bot-form', attrs: { id: 'bot-profile-editor' } });
  const problemList = el('div', {
    className: 'bot-form__problems',
    attrs: { role: 'status', 'aria-live': 'polite' }
  });
  const preview = el('pre', { className: 'bot-form__preview', attrs: { tabindex: '0' } });
  const estimate = el('p', { className: 'bot-form__estimate md-typescale-body-medium', attrs: { role: 'status' } });

  let vaultHasPassword = draft.loginPasswordAccount.length > 0;

  /* ---------------- live feedback ---------------- */

  const refreshFeedback = (): void => {
    const problems: FieldProblem[] = validateProfile(draft);
    problemList.textContent = '';
    if (problems.length === 0) {
      problemList.append(
        el('p', {
          className: 'bot-form__ok md-typescale-body-medium',
          text: ctx.t('bot.form.noProblems', 'Every field is usable. This profile can start a run.')
        })
      );
    } else {
      problemList.append(
        el('p', {
          className: 'md-typescale-title-small',
          text: ctx.t('bot.form.problems', '{count} field needs attention', { values: { count: problems.length } })
        })
      );
      const list = el('ul', { className: 'bot-form__problem-list' });
      for (const problem of problems) {
        list.append(el('li', { className: 'md-typescale-body-medium', text: problem.message }));
      }
      problemList.append(list);
    }

    const area = estimateArea(draft);
    estimate.textContent =
      draft.areaMode === 'spawn'
        ? ctx.t(
            'bot.form.estimateSpawn',
            'Each bot covers about {chunks} chunks around wherever it spawns, so the total depends on where they land.',
            { values: { chunks: area.chunks } }
          )
        : ctx.t(
            'bot.form.estimate',
            'About {chunks} chunks across {spanX} by {spanZ} blocks, shared between {bots} bot(s).',
            {
              values: {
                chunks: area.chunks,
                spanX: area.spanX,
                spanZ: area.spanZ,
                bots: draft.usernames.filter((name) => name.trim().length > 0).length
              }
            }
          );

    preview.textContent = JSON.stringify(
      redactedConfig(toScraperConfig(draft, vaultHasPassword ? 'stored' : '', draft.visitedFile || '<the application data folder>')),
      null,
      2
    );
  };

  /* ---------------- identity ---------------- */

  const nameField = ctx.components.textField({
    label: ctx.t('bot.field.name', 'Profile name'),
    value: draft.name,
    variant: 'outlined',
    supportingText: ctx.t('bot.field.name.help', 'Shown in the profile list and in the run log.'),
    onChange: (value) => {
      draft.name = value;
      refreshFeedback();
    }
  });

  const directoryField = ctx.components.textField({
    label: ctx.t('bot.field.scraperDirectory', 'Scraper folder for this profile'),
    value: draft.scraperDirectory,
    variant: 'outlined',
    browse: 'folder',
    supportingText: ctx.t(
      'bot.field.scraperDirectory.help',
      'The folder containing scrape.js. Leave it empty to use the folder set in the feature settings.'
    ),
    onChange: (value) => {
      draft.scraperDirectory = value;
      void refreshVersions();
      refreshFeedback();
    }
  });

  const notesField = ctx.components.textField({
    label: ctx.t('bot.field.notes', 'Notes'),
    value: draft.notes,
    variant: 'outlined',
    multiline: true,
    rows: 2,
    supportingText: ctx.t('bot.field.notes.help', 'Anything you want to remember about this profile. Stored with it and exported with it.'),
    onChange: (value) => {
      draft.notes = value;
    }
  });

  /* ---------------- connection ---------------- */

  const knownHosts = new Set<string>(['127.0.0.1', 'localhost']);
  for (const profile of store.listProfiles()) {
    if (profile.host.trim().length > 0) knownHosts.add(profile.host.trim());
  }

  const hostPicker = ctx.components.select({
    label: ctx.t('bot.field.hostPicker', 'Known proxy addresses'),
    options: [...knownHosts].map((host) => ({ value: host, label: host })),
    value: knownHosts.has(draft.host) ? draft.host : [...knownHosts][0],
    onChange: (value) => {
      draft.host = value;
      hostField.set(value);
      refreshFeedback();
    }
  });

  const hostField = ctx.components.textField({
    label: ctx.t('bot.field.host', 'Proxy address'),
    value: draft.host,
    variant: 'outlined',
    supportingText: ctx.t(
      'bot.field.host.help',
      'The address of the running downloader proxy, never the real server. The proxy is what saves the chunks.'
    ),
    onChange: (value) => {
      draft.host = value;
      refreshFeedback();
    }
  });

  const portField = numberField(ctx, {
    label: ctx.t('bot.field.port', 'Proxy port'),
    help: ctx.t('bot.field.port.help', 'The port the downloader listens on for players, not the port it connects out on.'),
    value: draft.port,
    min: 1,
    max: 65535,
    onChange: (value) => {
      draft.port = value;
      refreshFeedback();
    }
  });

  const versionNote = el('p', { className: 'bot-form__note md-typescale-body-small' });
  /**
   * The picker is rebuilt rather than mutated because the component kit's select
   * owns its option list at construction time. The holder keeps the rebuilt
   * control in the same place in the layout.
   */
  const versionHolder = el('div', { className: 'bot-form__version' });

  const buildVersionPicker = (options: Array<{ value: string; label: string }>): void => {
    versionHolder.textContent = '';
    const picker = ctx.components.select({
      label: ctx.t('bot.field.version', 'Protocol version'),
      options,
      value: options.some((option) => option.value === draft.version) ? draft.version : '',
      onChange: (value) => {
        draft.version = value;
        versionField.set(value);
        refreshFeedback();
      }
    });
    versionHolder.append(picker.root);
  };

  const versionField = ctx.components.textField({
    label: ctx.t('bot.field.versionCustom', 'Or type a version'),
    value: draft.version,
    variant: 'outlined',
    supportingText: ctx.t('bot.field.versionCustom.help', 'Leave it empty to let the bot negotiate the version with the server.'),
    onChange: (value) => {
      draft.version = value.trim();
      refreshFeedback();
    }
  });

  const refreshVersions = async (): Promise<void> => {
    const directory =
      draft.scraperDirectory.trim().length > 0 ? draft.scraperDirectory : ctx.settings.get<string>(SCRAPER_DIR_ID, '');
    const { versions, note } = await readInstalledVersions(ctx, directory);
    const fromProfiles = store
      .listProfiles()
      .map((profile) => profile.version.trim())
      .filter((version) => version.length > 0);
    const combined = [...new Set([...versions, ...fromProfiles])];
    const options = [
      { value: '', label: ctx.t('bot.field.version.auto', 'Detect automatically') },
      ...combined.map((version) => ({ value: version, label: version }))
    ];
    buildVersionPicker(options);
    versionNote.textContent =
      combined.length > 0
        ? ctx.t('bot.version.count', '{count} version(s) available. {note}', { values: { count: combined.length, note } })
        : note;
  };

  /* ---------------- accounts ---------------- */

  const authControl = ctx.components.segmentedButton({
    label: ctx.t('bot.field.auth', 'Sign-in method'),
    options: [
      { value: 'offline', label: ctx.t('bot.field.auth.offline', 'Offline name'), icon: 'key' },
      { value: 'microsoft', label: ctx.t('bot.field.auth.microsoft', 'Microsoft account'), icon: 'cloud' }
    ],
    value: draft.auth,
    onChange: (value) => {
      draft.auth = value as AuthMode;
      drawAccounts();
      refreshFeedback();
    }
  });

  const accountsHost = el('div', { className: 'bot-form__accounts' });
  const accountSelection = new Set<number>();

  const drawAccounts = (): void => {
    accountsHost.textContent = '';

    const toolbar = el('div', { className: 'bot-form__accounts-toolbar' });
    const selectAll = ctx.components.button({
      label: ctx.t('core.action.selectAll', 'Select all'),
      variant: 'text',
      onClick: () => {
        accountSelection.clear();
        draft.usernames.forEach((_, index) => accountSelection.add(index));
        drawAccounts();
      }
    });
    const invert = ctx.components.button({
      label: ctx.t('core.action.invertSelection', 'Invert selection'),
      variant: 'text',
      onClick: () => {
        const next = new Set<number>();
        draft.usernames.forEach((_, index) => {
          if (!accountSelection.has(index)) next.add(index);
        });
        accountSelection.clear();
        for (const index of next) accountSelection.add(index);
        drawAccounts();
      }
    });
    const removeSelected = ctx.components.button({
      label: ctx.t('bot.accounts.removeSelected', 'Remove selected accounts'),
      variant: 'text',
      danger: true,
      disabled: accountSelection.size === 0 || accountSelection.size >= draft.usernames.length,
      disabledReason:
        accountSelection.size === 0
          ? ctx.t('bot.accounts.noneSelected', 'No account is selected.')
          : ctx.t('bot.accounts.lastOne', 'A profile needs at least one account, so they cannot all be removed.'),
      onClick: () => {
        draft.usernames = draft.usernames.filter((_, index) => !accountSelection.has(index));
        accountSelection.clear();
        drawAccounts();
        refreshFeedback();
      }
    });
    const add = ctx.components.button({
      label: ctx.t('bot.accounts.add', 'Add an account'),
      variant: 'tonal',
      icon: 'add',
      onClick: () => {
        const base = draft.auth === 'offline' ? 'Scraper' : '';
        const suffix = draft.usernames.length + 1;
        draft.usernames = [...draft.usernames, base.length > 0 ? `${base}${suffix}` : ''];
        drawAccounts();
        refreshFeedback();
      }
    });
    const generate = ctx.components.button({
      label: ctx.t('bot.accounts.generate', 'Number the offline names'),
      variant: 'text',
      disabled: draft.auth !== 'offline',
      disabledReason: ctx.t('bot.accounts.generateReason', 'Microsoft accounts sign in by email, so they cannot be numbered.'),
      onClick: () => {
        draft.usernames = draft.usernames.map((_, index) => `Scraper${index + 1}`);
        drawAccounts();
        refreshFeedback();
      }
    });
    toolbar.append(add, generate, selectAll, invert, removeSelected);
    accountsHost.append(toolbar);

    const list = ctx.components.list({ label: ctx.t('bot.accounts.list', 'Accounts, one bot each') });
    draft.usernames.forEach((username, index) => {
      const row = el('div', { className: 'bot-form__account' });
      const box = ctx.components.checkbox({
        label: ctx.t('bot.accounts.select', 'Select account {position}', { values: { position: index + 1 } }),
        checked: accountSelection.has(index),
        onChange: (checked) => {
          if (checked) accountSelection.add(index);
          else accountSelection.delete(index);
        }
      });
      const field = ctx.components.textField({
        label:
          draft.auth === 'offline'
            ? ctx.t('bot.accounts.offlineName', 'Offline name for bot {position}', { values: { position: index + 1 } })
            : ctx.t('bot.accounts.microsoftName', 'Microsoft sign-in address for bot {position}', { values: { position: index + 1 } }),
        value: username,
        variant: 'outlined',
        onChange: (value) => {
          draft.usernames[index] = value;
          refreshFeedback();
        }
      });
      const remove = ctx.components.iconButton({
        icon: 'remove',
        label: ctx.t('bot.accounts.removeOne', 'Remove account {position}', { values: { position: index + 1 } }),
        disabled: draft.usernames.length <= 1,
        disabledReason: ctx.t('bot.accounts.lastOne', 'A profile needs at least one account, so they cannot all be removed.'),
        onClick: () => {
          draft.usernames = draft.usernames.filter((_, position) => position !== index);
          accountSelection.clear();
          drawAccounts();
          refreshFeedback();
        }
      });
      row.append(box.root, field.root, remove);
      list.append(row);
    });
    accountsHost.append(list);

    if (draft.auth === 'microsoft') {
      accountsHost.append(
        el('p', {
          className: 'bot-form__note md-typescale-body-small',
          text: ctx.t(
            'bot.accounts.microsoftNote',
            'The first Microsoft sign-in prints a device code in the run log. Enter it in a browser once; the token is then cached per account.'
          )
        })
      );
    }
  };

  /* ---------------- area ---------------- */

  const areaControl = ctx.components.segmentedButton({
    label: ctx.t('bot.field.areaMode', 'Area to cover'),
    options: [
      { value: 'center', label: ctx.t('bot.field.areaMode.center', 'Centre and radius'), icon: 'world' },
      { value: 'bbox', label: ctx.t('bot.field.areaMode.bbox', 'Bounding box'), icon: 'map' },
      { value: 'spawn', label: ctx.t('bot.field.areaMode.spawn', 'Around each spawn'), icon: 'pin' }
    ],
    value: draft.areaMode,
    onChange: (value) => {
      draft.areaMode = value as AreaMode;
      drawArea();
      refreshFeedback();
    }
  });

  const areaHost = el('div', { className: 'bot-form__area' });

  const drawArea = (): void => {
    areaHost.textContent = '';
    if (draft.areaMode === 'bbox') {
      areaHost.append(
        fieldRow([
          numberField(ctx, {
            label: ctx.t('bot.field.minX', 'Minimum X'),
            value: draft.bbox.minX,
            suffix: 'blocks',
            onChange: (value) => {
              draft.bbox.minX = value;
              refreshFeedback();
            }
          }).root,
          numberField(ctx, {
            label: ctx.t('bot.field.minZ', 'Minimum Z'),
            value: draft.bbox.minZ,
            suffix: 'blocks',
            onChange: (value) => {
              draft.bbox.minZ = value;
              refreshFeedback();
            }
          }).root
        ]),
        fieldRow([
          numberField(ctx, {
            label: ctx.t('bot.field.maxX', 'Maximum X'),
            value: draft.bbox.maxX,
            suffix: 'blocks',
            onChange: (value) => {
              draft.bbox.maxX = value;
              refreshFeedback();
            }
          }).root,
          numberField(ctx, {
            label: ctx.t('bot.field.maxZ', 'Maximum Z'),
            value: draft.bbox.maxZ,
            suffix: 'blocks',
            onChange: (value) => {
              draft.bbox.maxZ = value;
              refreshFeedback();
            }
          }).root
        ])
      );
      return;
    }

    if (draft.areaMode === 'center') {
      areaHost.append(
        fieldRow([
          numberField(ctx, {
            label: ctx.t('bot.field.centerX', 'Centre X'),
            value: draft.center.x,
            suffix: 'blocks',
            onChange: (value) => {
              draft.center.x = value;
              refreshFeedback();
            }
          }).root,
          numberField(ctx, {
            label: ctx.t('bot.field.centerZ', 'Centre Z'),
            value: draft.center.z,
            suffix: 'blocks',
            onChange: (value) => {
              draft.center.z = value;
              refreshFeedback();
            }
          }).root
        ])
      );
    } else {
      areaHost.append(
        el('p', {
          className: 'bot-form__note md-typescale-body-small',
          text: ctx.t(
            'bot.field.areaMode.spawnNote',
            'Each bot builds its own grid around wherever it spawns, so the grid is not split between them.'
          )
        })
      );
    }

    areaHost.append(
      fieldRow([
        numberField(ctx, {
          label: ctx.t('bot.field.radius', 'Radius'),
          help: ctx.t('bot.field.radius.help', 'Measured in blocks from the centre, so 256 covers a 512 by 512 square.'),
          value: draft.radius,
          min: 16,
          suffix: 'blocks',
          onChange: (value) => {
            draft.radius = value;
            refreshFeedback();
          }
        }).root,
        numberField(ctx, {
          label: ctx.t('bot.field.chunkStep', 'Visit every Nth chunk'),
          help: ctx.t('bot.field.chunkStep.help', '1 visits every chunk. A larger step covers ground faster and leaves gaps.'),
          value: draft.chunkStep,
          min: 1,
          onChange: (value) => {
            draft.chunkStep = value;
            refreshFeedback();
          }
        }).root
      ])
    );
  };

  /* ---------------- movement ---------------- */

  const flySwitch = ctx.components.switchControl({
    label: ctx.t('bot.field.flyWhenAble', 'Fly the grid in creative and spectator'),
    checked: draft.flyWhenAble,
    onChange: (checked) => {
      draft.flyWhenAble = checked;
      preferFlySwitch.setDisabled(!checked, ctx.t('bot.field.preferFly.reason', 'Flying is turned off, so there is nothing to prefer.'));
      altitudeField.setDisabled(!checked, ctx.t('bot.field.flyAltitude.reason', 'Flying is turned off, so the altitude is not used.'));
      refreshFeedback();
    }
  });

  const preferFlySwitch = ctx.components.switchControl({
    label: ctx.t('bot.field.preferFly', 'In creative, fly rather than walk'),
    checked: draft.preferFly,
    disabled: !draft.flyWhenAble,
    disabledReason: ctx.t('bot.field.preferFly.reason', 'Flying is turned off, so there is nothing to prefer.'),
    onChange: (checked) => {
      draft.preferFly = checked;
      refreshFeedback();
    }
  });

  const walkSwitch = ctx.components.switchControl({
    label: ctx.t('bot.field.walkWhenGrounded', 'Walk the grid in survival and adventure'),
    checked: draft.walkWhenGrounded,
    onChange: (checked) => {
      draft.walkWhenGrounded = checked;
      refreshFeedback();
    }
  });

  const altitudeField = numberField(ctx, {
    label: ctx.t('bot.field.flyAltitude', 'Flying altitude'),
    value: draft.flyAltitude,
    suffix: 'Y',
    onChange: (value) => {
      draft.flyAltitude = value;
      refreshFeedback();
    }
  });
  if (!draft.flyWhenAble) {
    altitudeField.setDisabled(true, ctx.t('bot.field.flyAltitude.reason', 'Flying is turned off, so the altitude is not used.'));
  }

  /* ---------------- timing ---------------- */

  const arriveField = numberField(ctx, {
    label: ctx.t('bot.field.arriveRadius', 'Counts as arrived within'),
    value: draft.arriveRadius,
    min: 1,
    suffix: 'blocks',
    onChange: (value) => {
      draft.arriveRadius = value;
      refreshFeedback();
    }
  });

  const waypointField = numberField(ctx, {
    label: ctx.t('bot.field.waypointTimeoutMs', 'Give up on a waypoint after'),
    help: ctx.t('bot.field.waypointTimeoutMs.help', 'A waypoint that times out is marked visited and skipped rather than retried forever.'),
    value: draft.waypointTimeoutMs,
    min: 1000,
    step: 500,
    suffix: 'ms',
    onChange: (value) => {
      draft.waypointTimeoutMs = value;
      refreshFeedback();
    }
  });

  const dwellField = numberField(ctx, {
    label: ctx.t('bot.field.loadWaitMs', 'Pause at each chunk'),
    help: ctx.t('bot.field.loadWaitMs.help', 'Long enough for the proxy to receive and write the chunk before the bot moves on.'),
    value: draft.loadWaitMs,
    min: 0,
    step: 50,
    suffix: 'ms',
    onChange: (value) => {
      draft.loadWaitMs = value;
      refreshFeedback();
    }
  });

  const containerField = numberField(ctx, {
    label: ctx.t('bot.field.containerDwellMs', 'Extra pause for containers'),
    help: ctx.t(
      'bot.field.containerDwellMs.help',
      'Only worth setting when the downloader is opening containers automatically. 400 to 800 ms is the usual range.'
    ),
    value: draft.containerDwellMs,
    min: 0,
    step: 50,
    suffix: 'ms',
    onChange: (value) => {
      draft.containerDwellMs = value;
      refreshFeedback();
    }
  });

  const drainField = numberField(ctx, {
    label: ctx.t('bot.field.finalDrainMs', 'Stay connected after finishing'),
    help: ctx.t('bot.field.finalDrainMs.help', 'Gives the proxy time to flush the last chunk and container writes before the bots leave.'),
    value: draft.finalDrainMs,
    min: 0,
    step: 500,
    suffix: 'ms',
    onChange: (value) => {
      draft.finalDrainMs = value;
      refreshFeedback();
    }
  });

  const staggerField = numberField(ctx, {
    label: ctx.t('bot.field.loginStaggerMs', 'Wait between starting each bot'),
    value: draft.loginStaggerMs,
    min: 0,
    step: 500,
    suffix: 'ms',
    onChange: (value) => {
      draft.loginStaggerMs = value;
      refreshFeedback();
    }
  });

  const stuckCheckField = numberField(ctx, {
    label: ctx.t('bot.field.stuckCheckMs', 'Check for a stuck bot every'),
    value: draft.stuckCheckMs,
    min: 1000,
    step: 500,
    suffix: 'ms',
    onChange: (value) => {
      draft.stuckCheckMs = value;
      refreshFeedback();
    }
  });

  const stuckEpsilonField = numberField(ctx, {
    label: ctx.t('bot.field.stuckEpsilon', 'Counts as progress if it moved'),
    value: draft.stuckEpsilon,
    min: 0.1,
    step: 0.1,
    suffix: 'blocks',
    onChange: (value) => {
      draft.stuckEpsilon = value;
      refreshFeedback();
    }
  });

  /* ---------------- dedup ---------------- */

  const visitedField = ctx.components.textField({
    label: ctx.t('bot.field.visitedFile', 'Visited chunk cache'),
    value: draft.visitedFile,
    variant: 'outlined',
    browse: 'file',
    supportingText: ctx.t(
      'bot.field.visitedFile.help',
      'Where the list of already captured chunks is kept, so a re-run skips them. Empty keeps it in the application data folder.'
    ),
    onChange: (value) => {
      draft.visitedFile = value;
      refreshFeedback();
    }
  });

  const revisitSwitch = ctx.components.switchControl({
    label: ctx.t('bot.field.revisit', 'Ignore the cache and walk everything again'),
    checked: draft.revisit,
    onChange: (checked) => {
      draft.revisit = checked;
      refreshFeedback();
    }
  });

  /* ---------------- automatic login ---------------- */

  const passwordStatus = el('p', { className: 'bot-form__note md-typescale-body-small', attrs: { role: 'status' } });

  const describePassword = (): void => {
    passwordStatus.textContent = vaultHasPassword
      ? ctx.t(
          'bot.field.password.stored',
          'A password is stored in this computer’s credential vault for this profile. It is written into the generated configuration file only while a run is going, and never shown here.'
        )
      : ctx.t('bot.field.password.absent', 'No password is stored for this profile.');
  };
  describePassword();

  const passwordField = ctx.components.textField({
    label: ctx.t('bot.field.password', 'Server login password'),
    value: '',
    type: 'password',
    variant: 'outlined',
    supportingText: ctx.t(
      'bot.field.password.help',
      'Used only for servers running an AuthMe-style login plugin. It goes straight into the credential vault and is never read back to this screen.'
    ),
    onChange: () => {
      /* Held in the field until the store button is used. Nothing is echoed. */
    }
  });

  const storePassword = ctx.components.button({
    label: ctx.t('bot.field.password.store', 'Store the password'),
    variant: 'tonal',
    icon: 'lock',
    onClick: async () => {
      const secret = passwordField.get();
      if (secret.length === 0) {
        ctx.notify.warn(
          ctx.t('bot.field.password.emptyTitle', 'Nothing to store'),
          ctx.t('bot.field.password.empty', 'Type the password into the field first. Nothing was changed.')
        );
        return;
      }
      const account = draft.loginPasswordAccount.length > 0 ? draft.loginPasswordAccount : `bot.profile.${draft.id}.loginPassword`;
      const stored = await ctx.studio.vault.set(account, secret);
      if (!stored.ok) {
        ctx.notify.error(
          ctx.t('bot.field.password.failedTitle', 'The password was not stored'),
          stored.error
        );
        return;
      }
      draft.loginPasswordAccount = account;
      vaultHasPassword = true;
      passwordField.set('');
      describePassword();
      refreshFeedback();
      await ctx.history.record('Stored a scraper bot login password', 'bot', {
        profileId: draft.id,
        vaultAccount: account
      });
      ctx.notify.success(
        ctx.t('bot.field.password.storedTitle', 'Password stored'),
        ctx.t('bot.field.password.storedBody', 'It is held in the credential vault and never written to the settings file.')
      );
    }
  });

  const clearPassword = ctx.components.button({
    label: ctx.t('bot.field.password.remove', 'Remove the stored password'),
    variant: 'text',
    danger: true,
    onClick: async (event) => {
      if (!vaultHasPassword) return;
      const approved = await ctx.confirm.request({
        action: ctx.t('bot.field.password.removeAction', 'Remove the stored login password for {name}', {
          values: { name: draft.name }
        }),
        affected: [draft.loginPasswordAccount],
        irreversible: ctx.t(
          'bot.field.password.removeIrreversible',
          'The password is deleted from the credential vault. It cannot be read back afterwards and must be typed again.'
        ),
        anchor: event.currentTarget as HTMLElement
      });
      if (!approved) return;
      const removed = await ctx.studio.vault.delete(draft.loginPasswordAccount);
      if (!removed.ok) {
        ctx.notify.error(ctx.t('bot.field.password.failedTitle', 'The password was not removed'), removed.error);
        return;
      }
      draft.loginPasswordAccount = '';
      vaultHasPassword = false;
      describePassword();
      refreshFeedback();
      await ctx.history.record('Removed a scraper bot login password', 'bot', { profileId: draft.id });
    }
  });

  const autoLoginSwitch = ctx.components.switchControl({
    label: ctx.t('bot.field.autoLogin', 'Register and log in automatically'),
    checked: draft.autoLogin,
    onChange: (checked) => {
      draft.autoLogin = checked;
      refreshFeedback();
    }
  });

  /* ---------------- assembly ---------------- */

  const previewId = nextId('bot-preview');
  preview.setAttribute('aria-labelledby', previewId);

  root.append(
    group(ctx, 'bot.form.identity', 'bot.form.identity.help', [nameField.root, directoryField.root, notesField.root]),
    group(ctx, 'bot.form.connection', 'bot.form.connection.help', [
      fieldRow([hostPicker.root, hostField.root]),
      fieldRow([portField.root, versionHolder]),
      fieldRow([versionField.root]),
      versionNote
    ]),
    group(ctx, 'bot.form.accounts', 'bot.form.accounts.help', [authControl.root, accountsHost]),
    group(ctx, 'bot.form.area', 'bot.form.area.help', [areaControl.root, areaHost, estimate]),
    group(ctx, 'bot.form.movement', 'bot.form.movement.help', [
      flySwitch.root,
      preferFlySwitch.root,
      walkSwitch.root,
      fieldRow([altitudeField.root, arriveField.root])
    ]),
    group(ctx, 'bot.form.timing', 'bot.form.timing.help', [
      fieldRow([dwellField.root, waypointField.root]),
      fieldRow([containerField.root, drainField.root]),
      fieldRow([staggerField.root]),
      fieldRow([stuckCheckField.root, stuckEpsilonField.root])
    ]),
    group(ctx, 'bot.form.dedup', 'bot.form.dedup.help', [visitedField.root, revisitSwitch.root]),
    group(ctx, 'bot.form.login', 'bot.form.login.help', [
      autoLoginSwitch.root,
      passwordField.root,
      el('div', { className: 'bot-form__row', children: [storePassword, clearPassword] }),
      passwordStatus
    ]),
    group(ctx, 'bot.form.preview', 'bot.form.preview.help', [
      el('h4', { className: 'md-typescale-title-small', text: ctx.t('bot.form.preview', 'What will be written'), attrs: { id: previewId } }),
      preview
    ]),
    problemList
  );

  const saveButton = ctx.components.button({
    label: options.isNew ? ctx.t('bot.form.create', 'Create the profile') : ctx.t('core.action.save', 'Save'),
    variant: 'filled',
    icon: 'save',
    onClick: async () => {
      draft.usernames = draft.usernames.map((name) => name.trim()).filter((name) => name.length > 0);
      if (draft.usernames.length === 0) draft.usernames = [draft.auth === 'offline' ? 'Scraper' : ''];
      store.saveProfile(draft);
      await ctx.history.record(options.isNew ? 'Created a scraper bot profile' : 'Edited a scraper bot profile', 'bot', {
        profileId: draft.id,
        name: draft.name,
        host: draft.host,
        port: draft.port,
        accounts: draft.usernames.length,
        areaMode: draft.areaMode
      });
      ctx.notify.success(
        options.isNew
          ? ctx.t('bot.form.createdTitle', 'Profile created')
          : ctx.t('bot.form.savedTitle', 'Profile saved'),
        ctx.t('bot.form.savedBody', '{name} is stored and can be started, edited or exported.', { values: { name: draft.name } })
      );
      options.onSaved(draft);
    }
  });

  const cancelButton = ctx.components.button({
    label: ctx.t('core.action.cancel', 'Cancel'),
    variant: 'text',
    onClick: () => options.onCancelled()
  });

  root.append(el('div', { className: 'bot-form__actions', children: [saveButton, cancelButton] }));

  drawAccounts();
  drawArea();
  refreshFeedback();
  buildVersionPicker([
    { value: '', label: ctx.t('bot.field.version.auto', 'Detect automatically') },
    ...(draft.version.length > 0 ? [{ value: draft.version, label: draft.version }] : [])
  ]);
  void refreshVersions();

  host.append(root);

  return {
    root,
    destroy: () => {
      root.remove();
    }
  };
}

/* ================================================================== */
/* Preset offering                                                     */
/* ================================================================== */

export interface PresetPickerOptions {
  ctx: AppContext;
  onChoose(profile: BotProfile, preset: ProfilePreset): void;
}

/**
 * The blank-slate offering.
 *
 * Each card states exactly what its preset sets before it is applied, so
 * choosing one is an informed action rather than a guess about what just
 * happened. Every result is an ordinary profile afterwards.
 */
export function buildPresetPicker(options: PresetPickerOptions): HTMLElement {
  const { ctx } = options;
  const root = el('div', { className: 'bot-presets' });
  root.append(
    ctx.components.sectionHeading({
      title: ctx.t('bot.presets.title', 'Start from a preset'),
      description: ctx.t(
        'bot.presets.help',
        'Every preset starts from the scraper’s own compiled-in defaults and changes only the fields it lists. The result is an ordinary profile you can edit.'
      )
    })
  );

  const grid = el('div', { className: 'bot-presets__grid' });
  for (const preset of presets()) {
    const card = ctx.components.card({ variant: 'outlined', title: preset.name });
    const list = el('ul', { className: 'bot-presets__sets' });
    for (const entry of preset.sets) {
      list.append(
        el('li', {
          className: 'md-typescale-body-small',
          text: `${entry.field}: ${entry.value}`
        })
      );
    }
    card.append(list);
    card.append(
      ctx.components.button({
        label: ctx.t('bot.presets.use', 'Use this preset'),
        variant: 'tonal',
        onClick: () => options.onChoose(preset.build(newId('bot-profile')), preset)
      })
    );
    grid.append(card);
  }
  root.append(grid);
  return root;
}
