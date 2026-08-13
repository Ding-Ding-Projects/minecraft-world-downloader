import { el } from '../../core/a11y';
import type { AppContext } from '../../core/registry';

import { openReleaseNotes, restartAndInstall, showStagedPackage } from './actions';
import { bannerShouldShow } from './presentation';
import { UPDATES_TAB_ID } from './settingIds';
import { updater } from './updater';

/**
 * The ready banner.
 *
 * It is deliberately not a modal: it appears when a verified package is staged,
 * it stays until the user restarts or asks for it later, and at no point does it
 * take focus, block a click, or delay anything. That is the whole contract of a
 * banner like this one — persistent, and completely out of the way.
 *
 * It also never says more than is true. The package is downloaded and its digest
 * matched the feed; it is not signed, nobody's identity was checked, and the
 * banner says exactly that beside the restart button rather than in a footnote.
 */

const HOST_CLASS = 'updates-banner-host';

let host: HTMLElement | null = null;
let unsubscribe: (() => void) | null = null;
let languageUnsubscribe: (() => void) | null = null;
let snoozeTimer: number | null = null;

function ensureHost(): HTMLElement {
  if (host && host.isConnected) return host;
  host = el('div', { className: HOST_CLASS, attrs: { 'data-appearance-id': 'updates:banner-host' } });
  document.body.append(host);
  return host;
}

function render(ctx: AppContext): void {
  const container = ensureHost();
  container.textContent = '';

  const state = updater.state();
  const snoozed = updater.snoozeActive();
  if (!bannerShouldShow(state, snoozed)) {
    container.hidden = true;
    return;
  }
  container.hidden = false;

  const staged = state.staged;
  if (!staged) {
    container.hidden = true;
    return;
  }

  const card = el('section', {
    className: 'updates-banner',
    attrs: {
      role: 'status',
      'aria-live': 'polite',
      'aria-label': ctx.t('updates.banner.label', 'Update ready to install'),
      'data-appearance-id': 'updates:banner',
      id: 'updates-ready-banner'
    }
  });
  ctx.appearance.applyTo(card, '[data-appearance-id="updates:banner"]');

  const head = el('div', { className: 'updates-banner__head' });
  head.append(ctx.components.icon('download', { size: 22 }));
  head.append(
    el('h2', {
      className: 'updates-banner__title md-typescale-title-medium',
      text: ctx.t('updates.banner.title', 'Version {version} is ready to install', {
        values: { version: staged.version }
      })
    })
  );

  const hide = ctx.components.iconButton({
    icon: 'close',
    label: ctx.t('updates.banner.dismiss', 'Hide this banner for now'),
    variant: 'standard',
    onClick: () => {
      updater.snooze();
    }
  });
  head.append(hide);
  card.append(head);

  card.append(
    el('p', {
      className: 'updates-banner__body md-typescale-body-medium',
      text: ctx.t(
        'updates.banner.body',
        'It was downloaded and its SHA-1 matched the release feed. The application is unsigned, so Windows will warn about an unknown publisher. Restarting installs it; nothing installs until you choose to.'
      )
    })
  );

  const facts = el('dl', { className: 'updates-banner__facts' });
  const addFact = (labelKey: string, labelFallback: string, value: string): void => {
    facts.append(el('dt', { className: 'md-typescale-label-small', text: ctx.t(labelKey, labelFallback) }));
    facts.append(el('dd', { className: 'md-typescale-body-small', text: value }));
  };
  addFact('updates.field.currentVersion', 'Installed version', state.currentVersion);
  addFact('updates.field.candidateVersion', 'Offered version', staged.version);
  addFact('updates.field.digest', 'SHA-1 digest stated by the feed', staged.sha1);
  card.append(facts);

  const actions = el('div', { className: 'updates-banner__actions' });
  const installable = state.installAvailable;
  const restart = ctx.components.button({
    label: ctx.t('updates.action.restart', 'Restart to install update'),
    variant: 'filled',
    icon: 'refresh',
    disabled: !installable,
    disabledReason: installable
      ? undefined
      : ctx.t(
          'updates.disabled.noInstallBridge',
          'This build has no privileged installer handover, so the application cannot install the staged package itself. The package is staged and can be installed by hand.'
        ),
    onClick: (event) => {
      void restartAndInstall(ctx, event.currentTarget as HTMLElement);
    }
  });
  actions.append(restart);

  actions.append(
    ctx.components.button({
      label: ctx.t('updates.action.later', 'Later'),
      variant: 'text',
      onClick: () => {
        updater.snooze();
      }
    })
  );
  actions.append(
    ctx.components.button({
      label: ctx.t('updates.action.releaseNotes', 'Open the release notes'),
      variant: 'text',
      icon: 'book',
      onClick: () => {
        void openReleaseNotes(ctx);
      }
    })
  );
  actions.append(
    ctx.components.button({
      label: ctx.t('updates.action.showStaged', 'Show the staged package'),
      variant: 'text',
      icon: 'folder',
      onClick: () => {
        void showStagedPackage(ctx);
      }
    })
  );
  actions.append(
    ctx.components.button({
      label: ctx.t('updates.tab', 'Updates'),
      variant: 'text',
      icon: 'more',
      onClick: () => {
        ctx.tabs.teleport(UPDATES_TAB_ID, 'updates-status-card');
      }
    })
  );
  card.append(actions);

  container.append(card);

  // The banner arrives without stealing focus, so a screen reader hears it
  // through the polite live region rather than being interrupted mid-sentence.
  ctx.a11y.announce(
    `${ctx.t('updates.banner.title', 'Version {version} is ready to install', { values: { version: staged.version } })}. ${ctx.t('updates.unsigned.body', 'This application is not code-signed.')}`
  );
}

/**
 * Starts the banner.
 *
 * The snooze is re-examined on a one-minute tick so the banner comes back on its
 * own when the snooze runs out, rather than waiting for the next state change
 * that might not arrive for hours.
 */
export function mountBanner(ctx: AppContext): () => void {
  render(ctx);
  unsubscribe = updater.onChange(() => render(ctx));
  languageUnsubscribe = ctx.i18n.onChange(() => render(ctx));
  snoozeTimer = window.setInterval(() => {
    const state = updater.state();
    if (state.phase === 'ready' && state.snoozedUntil !== null && !updater.snoozeActive()) render(ctx);
  }, 60_000);

  return () => {
    unsubscribe?.();
    languageUnsubscribe?.();
    if (snoozeTimer !== null) window.clearInterval(snoozeTimer);
    unsubscribe = null;
    languageUnsubscribe = null;
    snoozeTimer = null;
    host?.remove();
    host = null;
  };
}
