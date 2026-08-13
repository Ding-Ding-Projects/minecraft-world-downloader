import type { AppContext, LockRecord } from '../../core/registry';
import {
  APPEARANCE_PREFIX,
  LOCK_RECORDS_KEY,
  classify,
  describeTarget,
  guardSelectors,
  parseAppearanceTarget
} from './model';

/**
 * The part of this feature that makes a lock actually refuse something.
 *
 * A lock that is recorded and never enforced is the exact defect this project
 * forbids everywhere else: a control that looks like it works and does not. The
 * core enforces two kinds already — opening a locked tab asks for its
 * credential, and a locked setting row in the command palette asks for its own —
 * so this guard covers the two it does not: any element matching a locked
 * selector, and any appearance value that is put behind a lock.
 *
 * Three deliberate exemptions, each of which exists to stop a toy lock becoming
 * a trap:
 *
 *  - Overlays, menus, dialogs, the palette and toasts are never blocked, because
 *    the unlock prompt itself is an overlay. Blocking it would leave deleting the
 *    application data folder as the only route back from a broad selector.
 *  - The Locks destination is never blocked, so a lock can always be removed from
 *    the one surface whose entire job is removing it. The manager says so.
 *  - The guard only ever cancels an interaction. It never deletes, never edits
 *    and never escalates, in exactly the way a wrong password never does.
 */

const IGNORED_SURFACES = '.md-overlay-layer, .md-palette-scrim, .md-dialog-scrim, .md-toast-host, .md-confirm';
const MANAGER_SURFACE = '[data-locks-manager]';

export const BADGE_SETTING = 'locks.badge';
export const RELOCK_ON_BLUR_SETTING = 'locks.relockOnBlur';
export const IDLE_MINUTES_SETTING = 'locks.idleMinutes';

const BADGE_CLASS = 'wds-locks-guarded';
const IDLE_TICK_MS = 15_000;

interface GuardedLock {
  record: LockRecord;
  selectors: string[];
}

/** Fired whenever the stored lock records change, so surfaces can repaint. */
export const LOCKS_CHANGED_EVENT = 'wds-locks:changed';

function announceChange(): void {
  window.dispatchEvent(new CustomEvent(LOCKS_CHANGED_EVENT));
}

export class LockGuard {
  private readonly ctx: AppContext;
  private readonly cleanups: Array<() => void> = [];
  private guarded: GuardedLock[] = [];
  private appearanceShadow = new Map<string, string | null>();
  private promptOpenFor: string | null = null;
  private lastActivity = Date.now();
  private observer: MutationObserver | null = null;

  constructor(ctx: AppContext) {
    this.ctx = ctx;
  }

  install(): () => void {
    this.refresh();

    const onSettingsChange = this.ctx.settings.onChange((change) => {
      if (change.id === LOCK_RECORDS_KEY) {
        this.refresh();
        announceChange();
      }
      // Any settings write can be the appearance store being written, so the
      // appearance check runs on every change rather than on a key name this
      // feature would have to guess at and could silently get wrong.
      queueMicrotask(() => this.enforceAppearance());
    });
    this.cleanups.push(onSettingsChange);

    for (const type of ['pointerdown', 'mousedown', 'click', 'dblclick'] as const) {
      const handler = (event: Event): void => this.onPointerEvent(event);
      document.addEventListener(type, handler, true);
      this.cleanups.push(() => document.removeEventListener(type, handler, true));
    }

    const keyHandler = (event: KeyboardEvent): void => this.onKeyDown(event);
    document.addEventListener('keydown', keyHandler, true);
    this.cleanups.push(() => document.removeEventListener('keydown', keyHandler, true));

    const activity = (): void => {
      this.lastActivity = Date.now();
    };
    for (const type of ['pointermove', 'pointerdown', 'keydown', 'wheel'] as const) {
      window.addEventListener(type, activity, { passive: true });
      this.cleanups.push(() => window.removeEventListener(type, activity));
    }

    const onBlur = (): void => {
      if (this.ctx.settings.get<boolean>(RELOCK_ON_BLUR_SETTING, false) !== true) return;
      this.relockAll('the window lost focus');
    };
    window.addEventListener('blur', onBlur);
    this.cleanups.push(() => window.removeEventListener('blur', onBlur));

    const idleTimer = window.setInterval(() => {
      const minutes = Number(this.ctx.settings.get<number>(IDLE_MINUTES_SETTING, 0)) || 0;
      if (minutes <= 0) return;
      if (Date.now() - this.lastActivity < minutes * 60_000) return;
      if (this.ctx.locks.list().every((record) => !this.ctx.locks.isUnlocked(record.target))) return;
      this.relockAll(`nothing happened in this window for ${minutes} minutes`);
      this.lastActivity = Date.now();
    }, IDLE_TICK_MS);
    this.cleanups.push(() => window.clearInterval(idleTimer));

    // Coalesced to one repaint per frame: the observer fires for every node the
    // rest of the application adds, and painting badges on each one would make
    // an ordinary list render quadratic.
    this.observer = new MutationObserver(() => this.schedulePaint());
    this.observer.observe(document.body, { childList: true, subtree: true });
    this.cleanups.push(() => this.observer?.disconnect());

    this.paintBadges();

    return () => {
      for (const cleanup of this.cleanups.splice(0)) cleanup();
      this.clearBadges();
    };
  }

  /** Rebuilds the guarded set from the stored records. */
  refresh(): void {
    this.guarded = this.ctx.locks
      .list()
      .map((record) => ({ record, selectors: guardSelectors(record.target, classify(record.target, this.ctx)) }))
      .filter((entry) => entry.selectors.length > 0);

    for (const record of this.ctx.locks.list()) {
      if (!record.target.startsWith(APPEARANCE_PREFIX)) continue;
      if (this.appearanceShadow.has(record.target)) continue;
      this.appearanceShadow.set(record.target, this.currentAppearanceValue(record.target));
    }
    for (const target of [...this.appearanceShadow.keys()]) {
      if (!this.ctx.locks.isLocked(target)) this.appearanceShadow.delete(target);
    }
    this.paintBadges();
  }

  relockAll(reason: string): void {
    this.ctx.locks.lockAll();
    this.paintBadges();
    announceChange();
    this.ctx.notify.info(
      this.ctx.t('locks.relocked', 'Everything is locked again'),
      this.ctx.t('locks.relocked.reason', 'Relocked because {reason}.', { values: { reason } })
    );
  }

  /* ---------------- element enforcement ---------------- */

  private exempt(target: HTMLElement | null): boolean {
    if (!target) return true;
    if (target.closest(IGNORED_SURFACES)) return true;
    if (target.closest(MANAGER_SURFACE)) return true;
    return false;
  }

  private matchFor(target: HTMLElement): { record: LockRecord; element: HTMLElement } | null {
    for (const entry of this.guarded) {
      if (this.ctx.locks.isUnlocked(entry.record.target)) continue;
      for (const selector of entry.selectors) {
        let hit: HTMLElement | null = null;
        try {
          hit = target.closest<HTMLElement>(selector);
        } catch {
          // A stored selector that no longer compiles is reported by the
          // manager rather than throwing here on every click in the window.
          hit = null;
        }
        if (hit) return { record: entry.record, element: hit };
      }
    }
    return null;
  }

  private onPointerEvent(event: Event): void {
    if (this.guarded.length === 0) return;
    const target = event.target as HTMLElement | null;
    if (this.exempt(target) || !target) return;
    const match = this.matchFor(target);
    if (!match) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.type === 'click' || event.type === 'pointerdown') this.prompt(match.record, match.element);
  }

  private onKeyDown(event: KeyboardEvent): void {
    if (this.guarded.length === 0) return;
    if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar') return;
    const target = event.target as HTMLElement | null;
    if (this.exempt(target) || !target) return;
    const match = this.matchFor(target);
    if (!match) return;
    event.preventDefault();
    event.stopPropagation();
    this.prompt(match.record, match.element);
  }

  private prompt(record: LockRecord, anchor: HTMLElement): void {
    if (this.promptOpenFor) return;
    const label = describeTarget(record, this.ctx);
    this.ctx.a11y.announce(this.ctx.t('locks.guard.blocked', '{label} is locked. Unlock it to use it.', { values: { label } }), true);
    this.promptOpenFor = record.target;
    void this.ctx.locks
      .unlock(record.target, anchor)
      .then((unlocked) => {
        this.promptOpenFor = null;
        this.paintBadges();
        announceChange();
        if (unlocked) {
          this.ctx.notify.success(
            this.ctx.t('locks.state.unlocked', 'Unlocked'),
            this.ctx.t('locks.guard.unlockedBody', '{label} is unlocked. Activate it again to use it.', {
              values: { label }
            })
          );
        }
      })
      .catch(() => {
        this.promptOpenFor = null;
      });
  }

  /* ---------------- appearance enforcement ---------------- */

  private currentAppearanceValue(target: string): string | null {
    const parsed = parseAppearanceTarget(target);
    if (!parsed) return null;
    const override = this.ctx.appearance
      .overridesFor(parsed.selector)
      .find((candidate) => candidate.property === parsed.property);
    return override ? override.value : null;
  }

  /**
   * Puts a locked appearance value back if something changed it.
   *
   * The revert writes through the same appearance service the editor writes
   * through, so the change is applied, repainted and recorded exactly as any
   * other appearance change is. The comparison then finds no difference, which
   * is what stops this from looping.
   */
  private enforceAppearance(): void {
    for (const [target, shadow] of [...this.appearanceShadow]) {
      const parsed = parseAppearanceTarget(target);
      if (!parsed) continue;
      if (!this.ctx.locks.isLocked(target)) {
        this.appearanceShadow.delete(target);
        continue;
      }
      const current = this.currentAppearanceValue(target);
      if (this.ctx.locks.isUnlocked(target)) {
        if (current !== shadow) this.appearanceShadow.set(target, current);
        continue;
      }
      if (current === shadow) continue;
      if (shadow === null) this.ctx.appearance.resetProperty(parsed.selector, parsed.property);
      else this.ctx.appearance.setOverride(parsed.selector, { property: parsed.property, value: shadow });

      const anchor = document.querySelector<HTMLElement>('[data-locks-manager]') ?? document.body;
      this.ctx.notify.warn(
        this.ctx.t('locks.state.locked', 'Locked'),
        this.ctx.t(
          'locks.guard.appearanceReverted',
          'The {property} of {selector} is locked, so it was put back to {value}. Nothing else changed.',
          {
            values: {
              property: parsed.property,
              selector: parsed.selector,
              value: shadow ?? this.ctx.t('locks.guard.noOverride', 'no override')
            }
          }
        )
      );
      // One prompt at a time. An editor that writes on every slider tick would
      // otherwise stack a prompt per tick, which is a worse interface than the
      // change it is refusing.
      if (this.promptOpenFor) continue;
      this.promptOpenFor = target;
      void this.ctx.locks
        .unlock(target, anchor)
        .then((unlocked) => {
          this.promptOpenFor = null;
          if (!unlocked) return;
          this.appearanceShadow.set(target, this.currentAppearanceValue(target));
          announceChange();
        })
        .catch(() => {
          this.promptOpenFor = null;
        });
    }
  }

  /* ---------------- badges ---------------- */

  private paintScheduled = false;

  private schedulePaint(): void {
    if (this.paintScheduled) return;
    if (this.guarded.length === 0) return;
    this.paintScheduled = true;
    window.requestAnimationFrame(() => {
      this.paintScheduled = false;
      this.paintBadges();
    });
  }

  private clearBadges(): void {
    for (const element of document.querySelectorAll<HTMLElement>(`.${BADGE_CLASS}`)) {
      element.classList.remove(BADGE_CLASS);
      element.removeAttribute('data-locks-state');
      if (element.getAttribute('aria-description') === this.badgeText()) element.removeAttribute('aria-description');
    }
  }

  private badgeText(): string {
    return this.ctx.t('locks.guard.badge', 'Locked. Activating this asks for its credential.');
  }

  /**
   * Marks every element a lock covers.
   *
   * A blocked control that looks identical to a working one reads as broken
   * rather than as locked, which is the single most confusing state a toy lock
   * can produce.
   */
  paintBadges(): void {
    this.clearBadges();
    if (this.ctx.settings.get<boolean>(BADGE_SETTING, true) !== true) return;
    for (const entry of this.guarded) {
      const unlocked = this.ctx.locks.isUnlocked(entry.record.target);
      for (const selector of entry.selectors) {
        let matches: NodeListOf<HTMLElement>;
        try {
          matches = document.querySelectorAll<HTMLElement>(selector);
        } catch {
          continue;
        }
        for (const element of matches) {
          if (element.closest(IGNORED_SURFACES) || element.closest(MANAGER_SURFACE)) continue;
          element.classList.add(BADGE_CLASS);
          element.setAttribute('data-locks-state', unlocked ? 'unlocked' : 'locked');
          if (!unlocked) element.setAttribute('aria-description', this.badgeText());
          else if (element.getAttribute('aria-description') === this.badgeText()) {
            element.removeAttribute('aria-description');
          }
        }
      }
    }
  }
}
