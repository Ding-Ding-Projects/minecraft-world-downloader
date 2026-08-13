import { defineFeature } from '../../core/registry';
import type { AppContext, DocArticle, PaletteEntry, SettingsSection } from '../../core/registry';
import { el } from '../../core/a11y';
import './styles.css';

import { discardStaged, openReleaseNotes, restartAndInstall } from './actions';
import { mountBanner } from './banner';
import { mountUpdates } from './panel';
import { phaseLabel, phaseSeverity } from './presentation';
import {
  ACCEPT_PRERELEASE_ID,
  ALLOW_DOWNGRADE_ID,
  AUTO_DOWNLOAD_ID,
  CHECK_ACTION_ID,
  CHECK_ON_STARTUP_ID,
  CHUNK_BYTES_ID,
  DEFAULT_CHUNK_BYTES,
  DEFAULT_FEED_URL,
  DEFAULT_MAX_PACKAGE_BYTES,
  DEFAULT_RELEASE_NOTES_URL,
  ENABLED_ID,
  FEED_URL_ID,
  INTERVAL_HOURS_ID,
  LOG_PAGE_SIZE_ID,
  MAX_PACKAGE_BYTES_ID,
  RELEASE_NOTES_ID,
  SNOOZE_HOURS_ID,
  STARTUP_DELAY_ID,
  STATUS_CARD_ID,
  STATUS_ID,
  STORED_LAST_CHECK_ID,
  STORED_LOG_ID,
  STORED_SNOOZE_ID,
  STORED_STAGED_ID,
  UPDATES_TAB_ID,
  VERIFY_AFTER_WRITE_ID
} from './settingIds';
import { UPDATES_STRINGS } from './strings';
import { updater } from './updater';

/**
 * Automatic updates over the unsigned Squirrel feed.
 *
 * The engine (`updater.ts`) reads the release feed, verifies a candidate
 * package against the digest the feed states, transfers it in bounded chunks
 * with real byte progress, and stages it on disk. This module is the
 * integration: it wires that engine into the settings surface, the command
 * palette, the documentation browser and the application's own copy — and it
 * mounts the persistent, non-blocking ready banner once, at boot.
 *
 * Two facts travel with every surface this feature renders, unconditionally:
 * this build is not code-signed, and the digest check proves the downloaded
 * bytes match the feed, never who published them.
 */

/* ====================================================================== */
/* Settings                                                                */
/* ====================================================================== */

function urlValidator(options: { allowEmpty: boolean; requireHttps: boolean }): (value: unknown) => string | null {
  return (value: unknown) => {
    const text = typeof value === 'string' ? value.trim() : '';
    if (text === '') return options.allowEmpty ? null : 'An address is required. Nothing was changed.';
    let parsed: URL;
    try {
      parsed = new URL(text);
    } catch {
      return 'That is not a valid URL. Nothing was changed.';
    }
    if (parsed.protocol === 'https:') return null;
    if (
      !options.requireHttps &&
      parsed.protocol === 'http:' &&
      (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === '::1')
    ) {
      return null;
    }
    return options.requireHttps
      ? 'Use an https address, or an http address on a loopback host for local testing. Nothing was changed.'
      : 'Use an http or https address. Nothing was changed.';
  };
}

function numberValidator(min: number, max: number, label: string): (value: unknown) => string | null {
  return (value: unknown) => {
    const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
    if (!Number.isFinite(parsed)) return `${label} must be a number. Nothing was changed.`;
    if (parsed < min || parsed > max) return `${label} must be between ${min} and ${max}. Nothing was changed.`;
    return null;
  };
}

function renderStatusSetting(host: HTMLElement, ctx: AppContext): void {
  const row = el('div', { className: 'updates-setting-status' });
  const state = updater.state();
  row.append(ctx.components.badge({ label: phaseLabel(ctx, state.phase), severity: phaseSeverity(state.phase) }));
  row.append(
    el('p', {
      className: 'updates-setting-status__text md-typescale-body-medium',
      text: ctx.t('updates.field.currentVersion', 'Installed version') + ': ' + state.currentVersion
    })
  );
  row.append(
    ctx.components.button({
      label: ctx.t('updates.tab', 'Updates'),
      variant: 'text',
      icon: 'download',
      onClick: () => {
        ctx.tabs.teleport(UPDATES_TAB_ID, STATUS_CARD_ID);
      }
    })
  );
  host.append(row);
}

function settingsSection(): SettingsSection {
  return {
    id: 'updates',
    title: 'updates.settings.title',
    icon: 'download',
    order: 260,
    controls: [
      {
        id: ENABLED_ID,
        label: 'updates.setting.enabled',
        description: 'updates.setting.enabled.description',
        kind: 'switch',
        defaultValue: true,
        keywords: ['update', 'automatic', 'background', 'feed', 'squirrel']
      },
      {
        id: FEED_URL_ID,
        label: 'updates.setting.feedUrl',
        description: 'updates.setting.feedUrl.description',
        kind: 'text',
        defaultValue: DEFAULT_FEED_URL,
        keywords: ['feed', 'releases', 'url', 'squirrel', 'address'],
        validate: urlValidator({ allowEmpty: true, requireHttps: true })
      },
      {
        id: RELEASE_NOTES_ID,
        label: 'updates.setting.releaseNotesUrl',
        description: 'updates.setting.releaseNotesUrl.description',
        kind: 'text',
        defaultValue: DEFAULT_RELEASE_NOTES_URL,
        keywords: ['release', 'notes', 'changelog', 'url'],
        validate: urlValidator({ allowEmpty: true, requireHttps: false })
      },
      {
        id: CHECK_ON_STARTUP_ID,
        label: 'updates.setting.checkOnStartup',
        description: 'updates.setting.checkOnStartup.description',
        kind: 'switch',
        defaultValue: true,
        keywords: ['startup', 'launch', 'check']
      },
      {
        id: STARTUP_DELAY_ID,
        label: 'updates.setting.startupDelay',
        description: 'updates.setting.startupDelay.description',
        kind: 'number',
        defaultValue: 20,
        min: 0,
        max: 600,
        step: 5,
        hint: 'updates.hint.seconds',
        keywords: ['startup', 'delay', 'seconds', 'wait'],
        validate: numberValidator(0, 600, 'The startup delay')
      },
      {
        id: INTERVAL_HOURS_ID,
        label: 'updates.setting.intervalHours',
        description: 'updates.setting.intervalHours.description',
        kind: 'number',
        defaultValue: 6,
        min: 1,
        max: 168,
        step: 1,
        hint: 'updates.hint.hours',
        keywords: ['interval', 'schedule', 'hours', 'background'],
        validate: numberValidator(1, 168, 'The check interval')
      },
      {
        id: AUTO_DOWNLOAD_ID,
        label: 'updates.setting.autoDownload',
        description: 'updates.setting.autoDownload.description',
        kind: 'switch',
        defaultValue: true,
        keywords: ['download', 'automatic', 'background', 'transfer']
      },
      {
        id: ACCEPT_PRERELEASE_ID,
        label: 'updates.setting.acceptPrerelease',
        description: 'updates.setting.acceptPrerelease.description',
        kind: 'switch',
        defaultValue: false,
        keywords: ['prerelease', 'beta', 'preview']
      },
      {
        id: ALLOW_DOWNGRADE_ID,
        label: 'updates.setting.allowDowngrade',
        description: 'updates.setting.allowDowngrade.description',
        kind: 'switch',
        defaultValue: false,
        keywords: ['downgrade', 'rollback', 'older']
      },
      {
        id: MAX_PACKAGE_BYTES_ID,
        label: 'updates.setting.maxPackageBytes',
        description: 'updates.setting.maxPackageBytes.description',
        kind: 'number',
        defaultValue: DEFAULT_MAX_PACKAGE_BYTES,
        min: 1_048_576,
        max: 1_073_741_824,
        step: 1_048_576,
        hint: 'updates.hint.bytes',
        keywords: ['size', 'ceiling', 'limit', 'bytes', 'package'],
        validate: numberValidator(1_048_576, 1_073_741_824, 'The staging ceiling')
      },
      {
        id: CHUNK_BYTES_ID,
        label: 'updates.setting.chunkBytes',
        description: 'updates.setting.chunkBytes.description',
        kind: 'number',
        defaultValue: DEFAULT_CHUNK_BYTES,
        min: 262_144,
        max: 7_340_032,
        step: 262_144,
        hint: 'updates.hint.bytes',
        keywords: ['chunk', 'transfer', 'range', 'bytes'],
        validate: numberValidator(262_144, 7_340_032, 'The chunk size')
      },
      {
        id: VERIFY_AFTER_WRITE_ID,
        label: 'updates.setting.verifyAfterWrite',
        description: 'updates.setting.verifyAfterWrite.description',
        kind: 'switch',
        defaultValue: true,
        keywords: ['verify', 'reread', 'rehash', 'staging']
      },
      {
        id: SNOOZE_HOURS_ID,
        label: 'updates.setting.snoozeHours',
        description: 'updates.setting.snoozeHours.description',
        kind: 'number',
        defaultValue: 4,
        min: 1,
        max: 168,
        step: 1,
        hint: 'updates.hint.hours',
        keywords: ['snooze', 'later', 'banner', 'hide'],
        validate: numberValidator(1, 168, 'The snooze duration')
      },
      {
        id: LOG_PAGE_SIZE_ID,
        label: 'updates.setting.logPageSize',
        description: 'updates.setting.logPageSize.description',
        kind: 'number',
        defaultValue: 25,
        min: 5,
        max: 200,
        step: 5,
        keywords: ['log', 'page', 'rows'],
        validate: numberValidator(5, 200, 'The log page size')
      },
      {
        id: CHECK_ACTION_ID,
        label: 'updates.setting.checkNow',
        description: 'updates.setting.checkNow.description',
        kind: 'action',
        defaultValue: null,
        keywords: ['check', 'update', 'refresh', 'now'],
        lockable: false,
        lockableReason: 'An action has no stored value, so a lock on it would guard nothing.',
        run: () => {
          void updater.check('manual');
        }
      },
      {
        id: STATUS_ID,
        label: 'updates.setting.status',
        description: 'updates.setting.status.description',
        kind: 'custom',
        defaultValue: null,
        keywords: ['status', 'state', 'phase', 'update'],
        lockable: false,
        lockableReason: 'This is a live read-out of the updater state, not a stored value, so a lock on it would guard nothing.',
        render(host, ctx) {
          renderStatusSetting(host, ctx);
        }
      }
    ]
  };
}

/* ====================================================================== */
/* Palette                                                                 */
/* ====================================================================== */

/**
 * Entries that need nothing beyond the engine itself. `updater.check`,
 * `updater.download` and `updater.cancel` read their application context
 * through the engine's own `attach`, so these are safe to declare statically
 * and are findable in the palette before `init` has even run.
 */
function staticPalette(): PaletteEntry[] {
  const settingIds = [
    ENABLED_ID,
    FEED_URL_ID,
    RELEASE_NOTES_ID,
    CHECK_ON_STARTUP_ID,
    STARTUP_DELAY_ID,
    INTERVAL_HOURS_ID,
    AUTO_DOWNLOAD_ID,
    ACCEPT_PRERELEASE_ID,
    ALLOW_DOWNGRADE_ID,
    MAX_PACKAGE_BYTES_ID,
    CHUNK_BYTES_ID,
    VERIFY_AFTER_WRITE_ID,
    SNOOZE_HOURS_ID,
    LOG_PAGE_SIZE_ID
  ];

  const entries: PaletteEntry[] = [
    {
      id: 'updates.command.open',
      title: 'updates.palette.open',
      kind: 'destination',
      icon: 'download',
      keywords: ['updates', 'squirrel', 'version', 'install'],
      teleport: { tabId: UPDATES_TAB_ID, elementId: STATUS_CARD_ID }
    },
    {
      id: 'updates.command.check',
      title: 'updates.palette.check',
      kind: 'command',
      icon: 'refresh',
      keywords: ['check', 'updates', 'feed'],
      run: () => {
        void updater.check('manual');
      }
    },
    {
      id: 'updates.command.download',
      title: 'updates.palette.download',
      kind: 'command',
      icon: 'download',
      keywords: ['download', 'verify', 'transfer'],
      run: () => {
        void updater.download('manual');
      }
    }
  ];

  for (const id of settingIds) {
    entries.push({
      id: `updates.setting.${id}`,
      title: id,
      kind: 'setting',
      settingId: id,
      icon: 'download',
      keywords: ['updates', 'setting', id]
    });
  }

  return entries;
}

/**
 * Entries that need a live `AppContext` — every action that opens a dialog,
 * raises a notification, or otherwise reports back through `ctx`. Registered
 * from `init`, exactly like the settings feature's own live commands, so a
 * palette row is never one that looks like it works and silently does not.
 */
function dynamicPalette(ctx: AppContext): PaletteEntry[] {
  return [
    {
      id: 'updates.command.restart',
      title: 'updates.palette.restart',
      kind: 'command',
      icon: 'play',
      keywords: ['restart', 'install', 'update'],
      run: () => restartAndInstall(ctx, null)
    },
    {
      id: 'updates.command.discard',
      title: 'updates.palette.discard',
      kind: 'command',
      icon: 'trash',
      keywords: ['discard', 'staged', 'update'],
      run: () => {
        const anchor = (document.activeElement as HTMLElement | null) ?? document.body;
        return discardStaged(ctx, anchor);
      }
    },
    {
      id: 'updates.command.releaseNotes',
      title: 'updates.palette.notes',
      kind: 'command',
      icon: 'book',
      keywords: ['release', 'notes', 'changelog'],
      run: () => openReleaseNotes(ctx)
    },
    {
      id: 'updates.command.docs',
      title: 'updates.palette.docs',
      kind: 'command',
      icon: 'book',
      keywords: ['updates', 'documentation', 'how', 'help'],
      run: () => {
        ctx.docsService.open('updates.overview');
      }
    }
  ];
}

/* ====================================================================== */
/* Documentation                                                           */
/* ====================================================================== */

const DOCS: DocArticle[] = [
  {
    id: 'updates.overview',
    title: 'Automatic updates',
    category: 'Downloads and updates',
    body: [
      'This application checks its own release feed, verifies a candidate package against the digest the feed states, downloads it in the background and stages it on disk. Nothing installs without an explicit restart, and no surface in this feature ever claims more than the digest check actually proves.',
      '',
      '## The one fact that never changes',
      '',
      'This build is not code-signed. The SHA-1 digest recorded in the release feed proves the downloaded bytes are the bytes the feed named. It proves nothing about who published them. Every surface — the status card, the ready banner, the confirmation dialog before a restart — says this in the same words, because two surfaces describing one fact differently is how somebody ends up believing more than is true.',
      '',
      '## The four phases that matter',
      '',
      '1. **Checking** reads the `RELEASES` document at the configured feed address and picks the newest package that is not older than the installed version, respecting the prerelease and downgrade settings.',
      '2. **Downloading** transfers the chosen package in bounded byte-range chunks. A chunk boundary is also a cancellation point, and the progress bar reports real bytes; when the server ignores the range header and sends the whole file at once, the surface says so instead of animating a percentage nobody can trust.',
      '3. **Verifying** hashes the transferred bytes with SHA-1 and compares the result against the digest the feed stated. A mismatch writes nothing to disk.',
      '4. **Staging** writes the verified bytes into the application\'s own data directory, and — unless the corresponding setting is turned off — reads them straight back and hashes them again, which is the one step that actually catches a file that was written wrongly or damaged after the fact.',
      '',
      'Once a package is staged, the state is **ready**, the ready banner appears, and nothing further happens until a restart is explicitly requested.',
      '',
      '## The ready banner',
      '',
      'A persistent, non-blocking corner banner, exactly like every other non-blocking notification in this application: it never steals focus, never blocks a click, and stays until the update is installed or the user asks for it later. "Later" hides it for a configurable number of hours; the staged package is completely untouched while it is hidden.',
      '',
      '## Restarting',
      '',
      'The restart action is disabled, with the exact reason stated, whenever there is nothing staged or this build has no privileged installer handover. When it is available, restarting goes through a real confirmation: it names the exact version, restates that the installer is unsigned, and lists every surface on screen that currently declares unsaved work, so a restart can never quietly discard someone\'s editing.',
      '',
      '## The check log',
      '',
      'Every check — whether it ran at startup, on the background schedule, because someone pressed the button, or as a retry — writes one row naming what triggered it, what it found, how long it took and the exact machine detail. The log has its own search field with the anchored pattern builder, full multi-select with an honestly-scoped select-all, an inverse selection, export in every format the application supports, and a bulk delete behind the two-key confirmation gate.',
      '',
      '## Settings',
      '',
      'Every number here has a real ceiling and a real floor, matched between the setting\'s own validation and what the transfer engine actually enforces: the feed address, whether prerelease and downgrade packages are accepted, the largest package the application will stage, the byte-range chunk size, and how long the ready banner stays hidden after "Later". Turning updates off entirely stops the feed from being contacted at all — the manual check still works, and says so.'
    ].join('\n'),
    related: ['settings.surface', 'history.panel']
  }
];

/* ====================================================================== */
/* The module                                                              */
/* ====================================================================== */

export default defineFeature({
  id: 'updates',
  name: 'Updates',
  description:
    'Checks the release feed, verifies a candidate package against the digest it states, transfers and stages it in the background, and installs only on an explicit restart. The feed and its packages are unsigned; nothing here claims otherwise.',
  strings: UPDATES_STRINGS,
  docs: DOCS,
  settings: [settingsSection()],
  palette: staticPalette(),
  tabs: [
    {
      id: UPDATES_TAB_ID,
      title: 'updates.tab',
      icon: 'download',
      group: 'group.tools',
      order: 500,
      mount(host, ctx) {
        mountUpdates(host, ctx);
      }
    }
  ],
  init(ctx: AppContext) {
    // Records the engine keeps for itself, not shown as settings controls, but
    // declared so "reset every setting" can reach them like anything else.
    ctx.settings.declareDefault(STORED_STAGED_ID, null);
    ctx.settings.declareDefault(STORED_LOG_ID, []);
    ctx.settings.declareDefault(STORED_LAST_CHECK_ID, null);
    ctx.settings.declareDefault(STORED_SNOOZE_ID, null);

    updater.attach(ctx);

    const disposeBanner = mountBanner(ctx);
    const teardown = (): void => {
      disposeBanner();
      updater.dispose();
    };
    window.addEventListener('beforeunload', teardown, { once: true });

    ctx.palette.add(dynamicPalette(ctx));
  }
});
