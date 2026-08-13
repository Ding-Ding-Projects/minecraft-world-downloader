import { el } from '../../core/a11y';
import type { AppContext, OverlayHandle } from '../../core/registry';
import { elapsedSeconds, formatBytes, formatDuration, formatExactBytes } from './format';
import type { DownloadRecord } from './model';
import { alwaysOnTop } from './ontop';

/**
 * The Download complete surface.
 *
 * Non-blocking: it never takes focus, never gates anything and never sits in
 * front of what the user is typing into. It does stay ABOVE the browser window
 * the download came from, until the user resolves or dismisses it, because a
 * completion notice that ends up behind the page that started the download is a
 * completion notice nobody sees.
 *
 * It states the outcome that actually happened. A failure gets the same surface
 * with the real reason on it — never a success banner for a file that is not
 * there.
 */

export interface CompletionHandlers {
  open(id: string): void;
  reveal(id: string): void;
  show(id: string): void;
  retry(id: string): void;
}

const open = new Map<string, { handle: OverlayHandle; release(): void }>();

function anchorElement(): HTMLElement {
  const existing = document.getElementById('downloads-completion-anchor');
  if (existing) return existing;
  const anchor = el('div', {
    className: 'downloads-anchor downloads-anchor--completion',
    attrs: { id: 'downloads-completion-anchor' }
  });
  document.body.append(anchor);
  return anchor;
}

export function dismissCompletion(id: string): void {
  open.get(id)?.handle.close();
}

export function dismissAllCompletions(): void {
  for (const id of [...open.keys()]) dismissCompletion(id);
}

export function showCompletion(ctx: AppContext, record: DownloadRecord, handlers: CompletionHandlers): void {
  dismissCompletion(record.id);

  const succeeded = record.state === 'completed';
  const title = succeeded
    ? ctx.t('downloads.complete.title', 'Download complete', { dialog: true })
    : record.state === 'cancelled'
      ? ctx.t('downloads.cancelled.title', 'Download cancelled', { dialog: true })
      : ctx.t('downloads.failed.title', 'Download failed', { dialog: true });

  const release = alwaysOnTop.hold();
  const handle = ctx.overlay.open({
    anchor: anchorElement(),
    placement: 'top-end',
    role: 'dialog',
    label: title,
    lightDismiss: false,
    onClose: () => {
      release();
      open.delete(record.id);
    }
  });
  handle.root.classList.add('downloads-completion');
  handle.root.setAttribute('data-outcome', succeeded ? 'success' : record.state);
  handle.root.setAttribute('data-appearance-id', 'downloads.completion');
  ctx.appearance.applyTo(handle.root, '[data-appearance-id="downloads.completion"]');

  const body = handle.body;
  body.append(
    el('h2', { className: 'downloads-completion__title md-typescale-title-medium', text: title }),
    el('p', { className: 'downloads-completion__name md-typescale-body-large', text: record.filename })
  );

  if (succeeded) {
    const seconds = elapsedSeconds(record.startedAt, record.finishedAt);
    body.append(
      el('p', {
        className: 'downloads-completion__detail md-typescale-body-small',
        text: ctx.t('downloads.complete.body', '{size} written to {path}{duration}', {
          values: {
            size: `${formatBytes(record.received)} (${formatExactBytes(record.received)} bytes)`,
            path: record.destination,
            duration: seconds === null ? '' : ` · ${formatDuration(seconds)}`
          }
        })
      })
    );
  } else {
    body.append(
      el('p', {
        className: 'downloads-completion__detail md-typescale-body-small',
        text:
          record.error ||
          record.note ||
          ctx.t('downloads.failed.noReason', 'The transfer stopped without the server giving a reason.')
      }),
      el('p', {
        className: 'downloads-completion__detail md-typescale-body-small',
        text: ctx.t('downloads.failed.partial', 'Received so far: {size}.', {
          values: { size: `${formatBytes(record.received)} (${formatExactBytes(record.received)} bytes)` }
        })
      })
    );
  }

  const actions = el('div', { className: 'downloads-completion__actions' });
  if (succeeded) {
    actions.append(
      ctx.components.button({
        label: 'downloads.action.openFile',
        variant: 'filled',
        icon: 'file',
        onClick: () => {
          handlers.open(record.id);
          handle.close();
        }
      }),
      ctx.components.button({
        label: 'downloads.action.reveal',
        variant: 'tonal',
        icon: 'folder',
        onClick: () => {
          handlers.reveal(record.id);
          handle.close();
        }
      })
    );
  } else if (record.state === 'failed') {
    actions.append(
      ctx.components.button({
        label: 'downloads.action.retry',
        variant: 'filled',
        icon: 'refresh',
        onClick: () => {
          handlers.retry(record.id);
          handle.close();
        }
      })
    );
  }
  actions.append(
    ctx.components.button({
      label: 'downloads.action.showInList',
      variant: 'text',
      icon: 'download',
      onClick: () => {
        handlers.show(record.id);
        handle.close();
      }
    }),
    ctx.components.button({
      label: 'downloads.action.dismiss',
      variant: 'text',
      onClick: () => handle.close()
    })
  );
  body.append(actions);

  open.set(record.id, { handle, release });

  ctx.a11y.announce(`${title}. ${record.filename}.`);
}
