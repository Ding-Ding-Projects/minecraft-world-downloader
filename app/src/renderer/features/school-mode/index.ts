import { defineFeature } from '../../core/registry';
import type { AppContext, SettingsSection, TabContext } from '../../core/registry';
import {
  DEFAULT_WATCH_SECONDS,
  MAX_WATCH_SECONDS,
  MIN_WATCH_SECONDS,
  SETTING_CREDENTIAL,
  SETTING_ENABLED,
  SETTING_FOLDER,
  SETTING_NAME,
  SETTING_WATCH_SECONDS,
  schoolMode
} from './controller';
import { article } from './docs';
import { el } from './dom';
import { SHIPPED_MODE_NAME, derivedSharedFolder } from './shared-record';
import './school-mode.css';
import { SCHOOL_MODE_STRINGS, nameStrings } from './strings';
import {
  renderActivityList,
  renderCapabilityList,
  renderCredentialPanel,
  renderNamePanel,
  renderStatePanel,
  revealFolder
} from './surface';

/**
 * The shared study mode.
 *
 * One switch, one record, every application in the suite. This module registers
 * the surfaces; `controller.ts` owns the record and the rules, and `surface.ts`
 * owns what is drawn. The switch in the settings surface and the switch in this
 * feature's own tab are the same builder driving the same record, so they cannot
 * drift apart.
 */

let context: AppContext | null = null;

/**
 * Keeps a panel's subscription alive exactly as long as the panel is on screen.
 *
 * The settings surface rebuilds its rows whenever the language changes, and it
 * has no disposal hook for a custom control, so a panel that subscribed forever
 * would leave a listener behind on every repaint. This checks cheaply and lets
 * go the moment the host leaves the document.
 */
function disposeWhenDetached(host: HTMLElement, dispose: () => void): void {
  const timer = window.setInterval(() => {
    if (host.isConnected) return;
    window.clearInterval(timer);
    dispose();
  }, 4000);
  host.addEventListener('md-dispose', () => {
    window.clearInterval(timer);
    dispose();
  });
}

function settingsSection(): SettingsSection {
  return {
    id: 'school-mode.settings',
    title: 'schoolMode.section.title',
    icon: 'lock',
    order: 120,
    controls: [
      {
        id: SETTING_ENABLED,
        label: 'schoolMode.state.label',
        description: 'schoolMode.state.description',
        kind: 'custom',
        defaultValue: false,
        lockable: false,
        lockableReason:
          'This switch is the way back out of the mode, so a second lock on top of it could leave no route at all.',
        keywords: ['school', 'study', 'english only', 'shared', 'lock', 'classroom'],
        render: (host, ctx) => {
          const dispose = renderStatePanel(ctx, schoolMode, host);
          host.append(
            el('p', {
              className: 'school-mode__mirror-note md-typescale-label-medium',
              text: ctx.t(
                'schoolMode.state.mirrorNote',
                'The line below describes this application’s local copy in its own settings file. The value itself comes from the shared record named above.'
              )
            })
          );
          disposeWhenDetached(host, dispose);
        }
      },
      {
        id: SETTING_NAME,
        label: 'schoolMode.name.label',
        description: 'schoolMode.name.description',
        kind: 'custom',
        defaultValue: SHIPPED_MODE_NAME,
        keywords: ['rename', 'name', 'study', 'school', 'label'],
        render: (host, ctx) => {
          const dispose = renderNamePanel(ctx, schoolMode, host);
          disposeWhenDetached(host, dispose);
        }
      },
      {
        id: SETTING_CREDENTIAL,
        label: 'schoolMode.credential.label',
        description: 'schoolMode.credential.description',
        kind: 'custom',
        defaultValue: 'none',
        lockable: false,
        lockableReason:
          'Locking the control that sets the unlock code would make a forgotten code unrecoverable without deleting application data.',
        keywords: ['unlock', 'pin', 'password', 'authenticator', 'totp', 'code'],
        render: (host, ctx) => {
          const dispose = renderCredentialPanel(ctx, schoolMode, host);
          disposeWhenDetached(host, dispose);
        }
      },
      {
        id: SETTING_FOLDER,
        label: 'schoolMode.shared.label',
        description: 'schoolMode.shared.folderDescription',
        kind: 'folder',
        defaultValue: '',
        hint: 'schoolMode.shared.folderDefault',
        keywords: ['shared', 'folder', 'record', 'path'],
        validate: (value) => {
          const text = String(value ?? '').trim();
          if (text === '') return null;
          const absolute = /^[a-zA-Z]:[\\/]/.test(text) || text.startsWith('/') || text.startsWith('\\\\');
          return absolute ? null : 'That is not an absolute path, so nothing could be read from it. Nothing was changed.';
        }
      },
      {
        id: SETTING_WATCH_SECONDS,
        label: 'schoolMode.watch.label',
        description: 'schoolMode.watch.description',
        kind: 'slider',
        defaultValue: DEFAULT_WATCH_SECONDS,
        min: MIN_WATCH_SECONDS,
        max: MAX_WATCH_SECONDS,
        step: 1,
        hint: 'schoolMode.watch.unit',
        keywords: ['watch', 'poll', 'interval', 'refresh', 'live']
      },
      {
        id: 'school-mode.action.openTab',
        label: 'schoolMode.openSettings',
        description: 'schoolMode.tab.summary',
        kind: 'action',
        defaultValue: null,
        keywords: ['open', 'study', 'school'],
        run: (ctx) => ctx.tabs.open('school-mode.main')
      },
      {
        id: 'school-mode.action.revealFolder',
        label: 'schoolMode.shared.reveal',
        description: 'schoolMode.toy.warning',
        kind: 'action',
        defaultValue: null,
        keywords: ['reset', 'folder', 'reveal', 'recovery'],
        run: (ctx) => void revealFolder(ctx, schoolMode.state().recordFolder)
      }
    ]
  };
}

function mountTab(host: HTMLElement, ctx: TabContext): void {
  const root = el('div', { className: 'md-panel school-mode', attrs: { 'data-appearance-id': 'school-mode:tab' } });

  root.append(
    ctx.components.topAppBar({
      title: ctx.t('schoolMode.tab.title', schoolMode.state().name),
      subtitle: ctx.t(
        'schoolMode.tab.summary',
        'One shared switch, read live from a record every application in this suite shares.'
      )
    })
  );

  const status = el('section', { attrs: { id: 'school-mode-status' } });
  status.append(
    ctx.components.sectionHeading({
      title: 'schoolMode.section.status',
      description: 'schoolMode.state.description'
    })
  );
  const disposeState = renderStatePanel(ctx, schoolMode, status, { switchId: 'school-mode-switch' });

  const naming = el('section', { attrs: { id: 'school-mode-name-section' } });
  naming.append(
    ctx.components.sectionHeading({ title: 'schoolMode.name.label', description: 'schoolMode.name.description' })
  );
  const disposeName = renderNamePanel(ctx, schoolMode, naming, { fieldId: 'school-mode-name' });

  const unlock = el('section', { attrs: { id: 'school-mode-credential' } });
  unlock.append(
    ctx.components.sectionHeading({
      title: 'schoolMode.section.unlock',
      description: 'schoolMode.credential.description'
    })
  );
  const disposeCredential = renderCredentialPanel(ctx, schoolMode, unlock);

  const capabilities = el('section', { attrs: { id: 'school-mode-capabilities' } });
  capabilities.append(
    ctx.components.sectionHeading({
      title: 'schoolMode.capability.title',
      description: 'schoolMode.capability.description'
    })
  );
  const disposeCapabilities = renderCapabilityList(ctx, schoolMode, capabilities);

  const activity = el('section', { attrs: { id: 'school-mode-activity' } });
  activity.append(
    ctx.components.sectionHeading({
      title: 'schoolMode.activity.title',
      description: 'schoolMode.activity.description'
    })
  );
  const disposeActivity = renderActivityList(ctx, schoolMode, activity);

  root.append(status, naming, unlock, capabilities, activity);
  host.append(root);

  ctx.onDispose(() => {
    disposeState();
    disposeName();
    disposeCredential();
    disposeCapabilities();
    disposeActivity();
  });
}

/** Opens the tab, then runs an action against an element inside it. */
function withTab(ctx: AppContext, elementId: string, run: (anchor: HTMLElement) => void): void {
  ctx.tabs.open('school-mode.main');
  window.setTimeout(() => {
    const anchor = document.getElementById(elementId);
    run(anchor instanceof HTMLElement ? anchor : document.body);
  }, 0);
}

export default defineFeature({
  id: 'school-mode',
  name: 'Shared study mode',
  description:
    'One switch, shared by every application in the suite through a record in a shared application-data folder, applied live and unlocked by a code held in this computer’s credential vault.',
  strings: { ...SCHOOL_MODE_STRINGS, ...nameStrings(SHIPPED_MODE_NAME) },
  settings: [settingsSection()],
  tabs: [
    {
      id: 'school-mode.main',
      title: 'schoolMode.tab.title',
      icon: 'lock',
      group: 'group.personalisation',
      order: 120,
      mount: mountTab
    }
  ],
  palette: [
    {
      id: 'school-mode.destination',
      title: 'schoolMode.command.open',
      icon: 'lock',
      kind: 'destination',
      keywords: ['school', 'study', 'english', 'classroom', 'shared', 'mode'],
      teleport: { tabId: 'school-mode.main', elementId: 'school-mode-status' }
    },
    {
      id: 'school-mode.toggle',
      title: 'schoolMode.command.toggle',
      icon: 'lockOpen',
      kind: 'command',
      keywords: ['school', 'study', 'turn on', 'turn off', 'toggle'],
      run: () => {
        const ctx = context;
        if (!ctx) return;
        withTab(ctx, 'school-mode-switch', (anchor) => {
          if (schoolMode.state().enabled) void schoolMode.requestDisable(anchor);
          else void schoolMode.requestEnable(anchor);
        });
      }
    },
    {
      id: 'school-mode.refresh',
      title: 'schoolMode.command.refresh',
      icon: 'refresh',
      kind: 'command',
      keywords: ['refresh', 'shared', 'record', 're-read'],
      run: () => void schoolMode.refreshNow()
    },
    {
      id: 'school-mode.reveal',
      title: 'schoolMode.command.reveal',
      icon: 'folder',
      kind: 'command',
      keywords: ['folder', 'reset', 'recovery', 'shared'],
      run: () => {
        if (context) void revealFolder(context, schoolMode.state().recordFolder);
      }
    },
    {
      id: 'school-mode.setCode',
      title: 'schoolMode.command.setCode',
      icon: 'key',
      kind: 'command',
      keywords: ['unlock', 'code', 'pin', 'password', 'authenticator'],
      run: () => {
        if (context) withTab(context, 'school-mode-credential', (anchor) => anchor.scrollIntoView({ block: 'start' }));
      }
    }
    // Nothing here for this feature's settings or its documentation article: the
    // palette already walks the registry for both, rendering each setting as its
    // own live inline control. Listing them again would put two rows for one
    // thing in front of the user.
  ],
  docs: [article()],
  init: (ctx) => {
    context = ctx;
    // The derived folder is baked into the setting's own explanation, so the
    // control names the real location rather than describing one in the abstract.
    ctx.i18n.register({
      'schoolMode.shared.folderDescription': {
        en: fiveOf(
          `The one folder every application in this suite reads the mode from. Leave it empty to use ${derivedSharedFolder(
            ctx.studio.info.userDataDir
          )}, which sits beside each application's own data directory. Point it somewhere else only if your applications share a different location.`
        ),
        yue: fiveOf(
          `成套程式都由呢個資料夾讀呢個模式。留空就會用 ${derivedSharedFolder(
            ctx.studio.info.userDataDir
          )}，佢就喺每個程式自己資料夾隔籬。除非你嘅程式共用第二個位置，否則唔使改。`
        )
      }
    });
    schoolMode.start(ctx);
  }
});

function fiveOf(text: string): [string, string, string, string, string] {
  return [text, text, text, text, text];
}
