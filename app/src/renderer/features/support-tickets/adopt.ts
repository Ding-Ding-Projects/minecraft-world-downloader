import type { AppContext } from '../../core/registry';
import { DESK_OVERLAY_LABEL, openSupportDesk } from './desk';
import { ADOPT_UNLOCK_ID, DEFAULT_ADOPT_UNLOCK } from './settingIds';

/**
 * Taking over the recovery route from the unlock prompt.
 *
 * The unlock prompt's "Forgotten your password?" link is rendered by the core
 * lock service, which opens a short built-in recovery note of its own. That note
 * is correct as far as it goes — it shows the same folder path and the same open
 * action — but it is not the full desk, and this feature owns the full desk.
 *
 * A feature module may not edit a file outside its own directory, so it cannot
 * change where that link points. What it can do is watch the overlay layer for
 * that exact surface appearing and fill it with the complete desk instead, which
 * is what happens here. The behaviour is a setting, defaulting to on, and when
 * it is off the built-in note is left exactly as the core wrote it.
 *
 * The observer is deliberately narrow: it watches the direct children of the one
 * overlay layer, not the whole document, and it recognises the surface by the
 * accessible name the core gives it. A desk this feature opened itself is
 * skipped, because that one is already the full desk.
 */

const LAYER_ID = 'md-overlay-layer';

function isCoreRecoveryOverlay(node: Node): node is HTMLElement {
  if (!(node instanceof HTMLElement)) return false;
  if (!node.classList.contains('md-overlay')) return false;
  if (node.getAttribute('aria-label') !== DESK_OVERLAY_LABEL) return false;
  // A desk this feature opened carries its own marker and is already complete.
  if (node.getAttribute('data-appearance-id') === 'supportTickets:desk') return false;
  if (node.querySelector('[data-support-tickets-desk]')) return false;
  return true;
}

function adopt(ctx: AppContext, root: HTMLElement): void {
  const body = root.querySelector<HTMLElement>('.md-overlay__body');
  if (!body) return;
  root.setAttribute('data-support-tickets-adopted', 'true');
  openSupportDesk(ctx, {
    anchor: root,
    reuse: {
      root,
      body,
      reposition: () => {
        // The replaced content is taller than what it replaced, so the overlay
        // is re-placed rather than left hanging off the bottom of the viewport.
        window.requestAnimationFrame(() => {
          root.style.maxHeight = `${Math.max(
            180,
            window.innerHeight - root.getBoundingClientRect().top - 12
          )}px`;
        });
      }
    }
  });
}

/**
 * Starts watching. Returns a function that stops watching again.
 */
export function installUnlockPromptAdoption(ctx: AppContext): () => void {
  let layerObserver: MutationObserver | null = null;

  const enabled = (): boolean =>
    ctx.settings.get<boolean>(ADOPT_UNLOCK_ID, DEFAULT_ADOPT_UNLOCK) !== false;

  const watchLayer = (layer: HTMLElement): void => {
    if (layerObserver) return;
    layerObserver = new MutationObserver((records) => {
      if (!enabled()) return;
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (isCoreRecoveryOverlay(node)) adopt(ctx, node);
        }
      }
    });
    layerObserver.observe(layer, { childList: true });
  };

  const existing = document.getElementById(LAYER_ID);
  if (existing) watchLayer(existing);

  // The layer is created lazily by the first overlay of the session, so until it
  // exists there is one cheap observer waiting for it and nothing else.
  const bodyObserver = new MutationObserver(() => {
    const layer = document.getElementById(LAYER_ID);
    if (layer) {
      watchLayer(layer);
      bodyObserver.disconnect();
    }
  });
  if (!existing) bodyObserver.observe(document.body, { childList: true });

  return () => {
    bodyObserver.disconnect();
    layerObserver?.disconnect();
    layerObserver = null;
  };
}
