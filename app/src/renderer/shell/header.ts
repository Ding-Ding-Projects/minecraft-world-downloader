import { el } from '../core/a11y';
import { components } from '../core/components';
import type { AppContext } from '../core/types';
import { openRegisteredTab } from './drawer';
import { currentProfileSummary, goOrNotify, shell } from './index';

/**
 * The 68px screen header: the active screen's title, a live-dot subtitle, the
 * profile-switcher chip, and the account chip (design lines 92-101).
 *
 * The subtitle is live in two independent senses: it re-renders whenever the
 * active screen changes, AND a mounted screen can push a running status into
 * it at any time through `shell.setSubtitle(id, text)` (e.g. "3 profiles on
 * this machine").
 *
 * Those are two SEPARATE subscriptions below, and the second one is why. This
 * file originally had no subtitle subscription at all: `setSubtitle` re-emitted
 * the navigation channel, so `refresh()` picked a subtitle change up for free.
 * That shortcut also remounted the screen, so any screen setting its own
 * subtitle while mounting looped forever and the window never painted. The
 * plumbing this docstring once boasted of avoiding is what the header owes for
 * navigation and subtitle changes being genuinely different events.
 */

export function mountHeader(ctx: AppContext): HTMLElement {
  const header = el('div', { className: 'wds-header' });

  const text = el('div', { className: 'wds-header__text' });
  const title = el('div', { className: 'wds-header__title md-typescale-headline-small' });
  const subtitleRow = el('div', { className: 'wds-header__subtitlerow' });
  const dot = el('span', { className: 'wds-header__dot', attrs: { 'aria-hidden': 'true' } });
  const subtitle = el('span', {
    className: 'wds-header__subtitle md-typescale-body-small',
    attrs: { role: 'status' }
  });
  subtitleRow.append(dot, subtitle);
  text.append(title, subtitleRow);

  const chips = el('div', { className: 'wds-header__chips' });

  /* ---------------- profile switcher chip ---------------- */

  const profileChip = el('button', {
    className: 'wds-profilechip',
    attrs: { type: 'button', 'aria-label': ctx.t('shell.header.switchProfile', 'Switch profile') }
  });
  const profileAvatar = el('span', { className: 'wds-profilechip__avatar', attrs: { 'aria-hidden': 'true' } });
  const profileText = el('span', { className: 'wds-profilechip__text' });
  const profileName = el('b', { className: 'wds-profilechip__name' });
  const profileWhere = el('span', { className: 'wds-profilechip__where' });
  profileText.append(profileName, profileWhere);
  profileChip.append(profileAvatar, profileText, components.icon('chevronDown', { size: 18 }));
  profileChip.addEventListener('click', () => goOrNotify(ctx, 'profiles'));

  const refreshProfileChip = (): void => {
    const profile = currentProfileSummary(ctx);
    if (!profile) {
      profileAvatar.textContent = '?';
      profileName.textContent = ctx.t('shell.header.noProfile', 'No profile selected');
      profileWhere.textContent = ctx.t('shell.header.noProfile.hint', 'Create one on the Profiles screen');
      return;
    }
    profileAvatar.textContent = profile.initial;
    profileName.textContent = profile.name;
    profileWhere.textContent = profile.where;
  };
  refreshProfileChip();

  /* ---------------- account chip ---------------- */

  // There is no Microsoft-account/session service anywhere on `AppContext` or
  // `StudioApi` (this app's real sign-in is the downloader's own
  // `--microsoft-login` launch option, run headlessly by the Java process —
  // a grep of `shared/api.ts` and every `features/*` directory turns up no
  // "account"/"microsoft"/"sign-in" surface at all). The design's own
  // "Microsoft sign-in" overlay is listed among the overlays this lane does
  // not own, and its "andy_promenade" text is static mockup content, not real
  // data this lane can honestly reproduce. This chip performs a real, honest
  // action instead: it says plainly where authentication actually lives in
  // this build and navigates to the visible Downloader screen, where the
  // Authentication launch option is set.
  const accountChip = el('button', {
    className: 'wds-accountchip',
    attrs: { type: 'button' }
  });
  accountChip.append(components.icon('key', { size: 18 }));
  accountChip.append(el('span', { text: ctx.t('shell.header.signIn', 'Microsoft sign-in') }));
  accountChip.addEventListener('click', () => {
    ctx.notify.info(
      ctx.t('shell.header.signIn.title', 'Microsoft sign-in'),
      ctx.t(
        'shell.header.signIn.body',
        'This build signs in through the downloader’s own Authentication launch option, not a separate window. Opening it now.'
      )
    );
    openRegisteredTab('downloader.main');
  });

  chips.append(profileChip, accountChip);
  header.append(text, chips);

  /* ---------------- live title/subtitle ---------------- */

  const refresh = (): void => {
    const activeId = shell.current();
    const screen = shell.screen(activeId);
    title.textContent = screen ? ctx.t(screen.title, screen.title) : '';
    const override = shell.subtitleOverride(activeId);
    const subtitleText = override ?? (screen?.subtitle ? ctx.t(screen.subtitle, screen.subtitle) : '');
    subtitle.textContent = subtitleText;
    subtitleRow.hidden = subtitleText === '';
    refreshProfileChip();
  };

  refresh();
  shell.onChange(refresh);
  shell.onSubtitleChange(refresh);
  ctx.settings.onChange(() => refreshProfileChip());
  ctx.i18n.onChange(refresh);

  return header;
}
