import { el } from '../../core/a11y';
import type { AppContext, OverlayHandle } from '../../core/registry';
import { buildTicketForm } from './form';
import { buildResolutionCard } from './resolution';
import { TAB_ID } from './settingIds';

/**
 * The anchored desk.
 *
 * This is the compact surface a locked-out user meets: it opens beside the
 * control they pressed — the "Forgotten your password?" link in an unlock
 * prompt, the lock setting, or Help — rather than as a detached dialog
 * somewhere else on screen.
 *
 * The resolution comes FIRST and the comedy comes second. Somebody who cannot
 * get back into their own application should not have to scroll past a joke to
 * reach the folder that fixes it.
 */

export const DESK_OVERLAY_LABEL = 'Support Tickets';

export interface DeskOptions {
  anchor: HTMLElement;
  /** Set when the desk is replacing an overlay that is already on screen. */
  reuse?: { root: HTMLElement; body: HTMLElement; reposition(): void };
}

function fillDeskBody(ctx: AppContext, body: HTMLElement, close: () => void): void {
  body.textContent = '';
  body.setAttribute('data-support-tickets-desk', 'true');

  body.append(
    el('h2', {
      className: 'md-typescale-title-medium',
      text: ctx.t('supportTickets.title', 'Support Tickets', { dialog: true })
    }),
    el('p', {
      className: 'md-typescale-body-small',
      text: ctx.t('supportTickets.fictional', 'The desk is fictional and belongs to this application.')
    })
  );

  // The resolution first, unconditionally, with its own plain disclosure line.
  body.append(buildResolutionCard(ctx, { showHeading: true }));

  // Then the desk theatre, for anybody who wants it.
  body.append(buildTicketForm(ctx, { compact: true }).root);

  const openFull = ctx.components.button({
    label: 'supportTickets.palette.open',
    variant: 'text',
    icon: 'book',
    onClick: () => {
      close();
      ctx.tabs.open(TAB_ID);
    }
  });

  const readArticle = ctx.components.button({
    label: 'supportTickets.help.article',
    variant: 'text',
    icon: 'book',
    onClick: () => {
      close();
      ctx.docsService.open('supportTickets.overview');
    }
  });

  const footer = el('div', { className: 'md-confirm__actions' });
  footer.style.display = 'flex';
  footer.style.flexWrap = 'wrap';
  footer.style.gap = '8px';
  footer.append(openFull, readArticle);
  body.append(footer);
}

/** Opens the anchored desk beside a control. */
export function openSupportDesk(ctx: AppContext, options: DeskOptions): OverlayHandle | null {
  if (options.reuse) {
    const reuse = options.reuse;
    fillDeskBody(ctx, reuse.body, () => {
      // The core overlay owns its own dismissal; closing it from here would
      // reach across a boundary this feature does not own. Escape, the light
      // dismiss and the anchor all still close it exactly as before.
      reuse.root.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    reuse.reposition();
    return null;
  }

  const handle = ctx.overlay.open({
    anchor: options.anchor,
    placement: 'bottom-start',
    role: 'dialog',
    label: DESK_OVERLAY_LABEL,
    resizeKey: 'supportTickets.desk',
    dragKey: 'supportTickets.desk'
  });
  handle.root.setAttribute('data-appearance-id', 'supportTickets:desk');
  fillDeskBody(ctx, handle.body, () => handle.close());
  handle.reposition();
  return handle;
}
