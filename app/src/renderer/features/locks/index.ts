import { defineFeature } from '../../core/registry';
import type { AppContext, SettingsSection } from '../../core/registry';
import './styles.css';
import { LOCK_DOCS } from './docs';
import {
  BADGE_SETTING,
  IDLE_MINUTES_SETTING,
  LOCKS_CHANGED_EVENT,
  LockGuard,
  RELOCK_ON_BLUR_SETTING
} from './guard';
import { mountLockManager } from './manager';
import { LOCK_STRINGS } from './strings';
import { openLockPicker } from './wizard';

/**
 * Toy locks: the management surface, the enforcement, and the honest copy.
 *
 * The lock service itself lives in the core, because a locked tab has to be
 * refused by the tab strip and a locked setting by the command palette, and
 * neither of those can wait for a feature to load. What lives here is everything
 * around it: the enumerable list, the anchored picker, the queue that gives each
 * chosen thing its own credential, the guard that makes an element lock and an
 * appearance lock genuinely refuse something, and the recovery route that names
 * the actual folder.
 */

let guard: LockGuard | null = null;

function lockSettings(): SettingsSection {
  return {
    id: 'locks.main',
    title: 'locks.settings.section',
    icon: 'lock',
    order: 120,
    controls: [
      {
        id: BADGE_SETTING,
        label: 'locks.settings.badge',
        description: 'locks.settings.badge.description',
        kind: 'switch',
        defaultValue: true,
        keywords: ['lock', 'padlock', 'badge', 'marker', '鎖']
      },
      {
        id: RELOCK_ON_BLUR_SETTING,
        label: 'locks.settings.relockOnBlur',
        description: 'locks.settings.relockOnBlur.description',
        kind: 'switch',
        defaultValue: false,
        keywords: ['lock', 'focus', 'blur', 'relock']
      },
      {
        id: IDLE_MINUTES_SETTING,
        label: 'locks.settings.idleMinutes',
        description: 'locks.settings.idleMinutes.description',
        kind: 'slider',
        defaultValue: 0,
        min: 0,
        max: 120,
        step: 5,
        keywords: ['lock', 'idle', 'timeout', 'relock'],
        validate: (value) => {
          const minutes = Number(value);
          if (!Number.isFinite(minutes) || minutes < 0 || minutes > 120) {
            return 'Use a whole number of minutes between 0 and 120. 0 turns it off.';
          }
          return null;
        }
      },
      {
        // Always present, and it names the real folder rather than gesturing at
        // "app data" — a recovery route nobody can follow is not a route.
        id: 'locks.recovery',
        label: 'locks.settings.recovery',
        description: 'locks.settings.recovery.description',
        kind: 'custom',
        defaultValue: null,
        keywords: ['lock', 'recovery', 'reset', 'folder', 'forgot'],
        render(host, ctx) {
          const path = ctx.locks.recoveryPath();
          const line = document.createElement('p');
          line.className = 'md-typescale-body-small';
          line.style.overflowWrap = 'anywhere';
          line.textContent = ctx.t(
            'locks.recovery.body',
            'Delete this folder and every lock is gone, along with everything else stored locally with it: {path}.',
            { values: { path } }
          );

          const forFun = document.createElement('p');
          forFun.className = 'md-typescale-body-small';
          forFun.textContent = ctx.t('core.lock.toyWarning', 'This is just for fun.', { values: { path } });

          const actions = document.createElement('div');
          actions.className = 'wds-locks-actions';
          actions.append(
            ctx.components.button({
              label: 'locks.recovery.open',
              variant: 'tonal',
              icon: 'folder',
              onClick: async () => {
                const result = await ctx.studio.app.revealUserData();
                if (!result.ok) {
                  ctx.notify.error(
                    ctx.t('locks.recovery.title', 'If you are locked out'),
                    ctx.t(
                      'locks.recovery.failed',
                      'The file manager could not be opened: {reason}. The folder is {path}.',
                      { values: { reason: result.error, path } }
                    )
                  );
                }
              }
            }),
            ctx.components.button({
              label: 'locks.recovery.copy',
              variant: 'text',
              icon: 'copy',
              onClick: () => {
                void navigator.clipboard.writeText(path).catch(() => undefined);
                ctx.a11y.announce(path);
              }
            })
          );

          host.append(line, forFun, actions);
        }
      },
      {
        id: 'locks.relockNow',
        label: 'locks.settings.relockNow',
        description: 'locks.settings.relockNow.description',
        kind: 'action',
        defaultValue: null,
        keywords: ['lock', 'relock', 'now'],
        run: (ctx) => {
          const unlocked = ctx.locks.list().filter((record) => ctx.locks.isUnlocked(record.target)).length;
          ctx.locks.lockAll();
          guard?.paintBadges();
          window.dispatchEvent(new CustomEvent(LOCKS_CHANGED_EVENT));
          ctx.notify.success(
            ctx.t('locks.relocked', 'Everything is locked again'),
            ctx.t('locks.relocked.count', '{count} surfaces were unlocked and are locked again.', {
              values: { count: unlocked }
            })
          );
        }
      },
      {
        id: 'locks.manage',
        label: 'locks.settings.manage',
        description: 'locks.settings.manage.description',
        kind: 'action',
        defaultValue: null,
        keywords: ['lock', 'list', 'manage', 'remove'],
        run: (ctx) => ctx.tabs.open('locks.manager')
      }
    ]
  };
}

export default defineFeature({
  id: 'locks',
  name: 'Locks',
  description:
    'Toy locks on any element, tab, setting or appearance value, each with its own credential, plus the list that manages them and the recovery route that names the folder.',
  strings: LOCK_STRINGS,
  docs: LOCK_DOCS,
  settings: [lockSettings()],
  tabs: [
    {
      id: 'locks.manager',
      title: 'locks.title',
      icon: 'lock',
      order: 860,
      mount: (host, ctx) => mountLockManager(host, ctx, guard)
    }
  ],
  palette: [
    {
      id: 'locks.palette.manage',
      title: 'locks.palette.manage',
      subtitle: 'locks.subtitle',
      icon: 'lock',
      kind: 'destination',
      keywords: ['lock', 'locks', 'padlock', 'credential', 'unlock', '鎖'],
      teleport: { tabId: 'locks.manager' }
    },
    {
      id: 'locks.palette.new',
      title: 'locks.palette.new',
      icon: 'key',
      kind: 'command',
      keywords: ['lock', 'new', 'password', 'one-time code', 'totp'],
      run: () => {
        const anchor =
          document.querySelector<HTMLElement>('[data-locks-manager]') ??
          document.querySelector<HTMLElement>('.md-content') ??
          document.body;
        openLockPickerFromContext(anchor);
      }
    },
    {
      id: 'locks.palette.recovery',
      title: 'locks.palette.recovery',
      icon: 'folder',
      kind: 'command',
      keywords: ['lock', 'locked out', 'forgot', 'reset', 'folder'],
      run: () => void window.studio.app.revealUserData()
    }
  ],
  init(ctx: AppContext) {
    guard = new LockGuard(ctx);
    guard.install();
    pickerContext = ctx;

    // The list is a real list, so anything that changes it repaints every
    // surface showing it rather than leaving a stale count somewhere.
    window.addEventListener(LOCKS_CHANGED_EVENT, () => guard?.refresh());
    ctx.i18n.onChange(() => guard?.paintBadges());
  }
});

/* ------------------------------------------------------------------ */
/* palette helper                                                      */
/* ------------------------------------------------------------------ */

let pickerContext: AppContext | null = null;

function openLockPickerFromContext(anchor: HTMLElement): void {
  if (!pickerContext) return;
  openLockPicker(pickerContext, anchor);
}
