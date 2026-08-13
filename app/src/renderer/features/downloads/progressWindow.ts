import { el } from '../../core/a11y';
import type { AppContext, OverlayHandle } from '../../core/registry';
import {
  elapsedSeconds,
  formatBytes,
  formatDuration,
  formatExactBytes,
  formatPercent,
  formatRate,
  fraction,
  shortenUrl
} from './format';
import { ACTIVE_STATES, RESUMABLE_STATES, type DownloadRecord, type DownloadState } from './model';
import { downloadStore } from './store';

/**
 * The Downloading surface: one for each transfer, separate from the list.
 *
 * A row in a table is a summary. This is the surface a person watches while a
 * large file lands: its own draggable, resizable window with the real filename,
 * the real source, the real destination, the real byte count, the real rate,
 * the real estimate and controls that operate the actual transfer. Nothing here
 * animates a number that is not being measured.
 *
 * The application draws its own window chrome and the renderer cannot create a
 * second operating-system window, so this is a real floating panel inside the
 * application: draggable by its header, resizable from its edges, remembered
 * across restarts, bounded by the viewport and scrolling inside itself. That is
 * the closest accessible equivalent this platform supports, and it is stated
 * here and in the feature's documentation rather than quietly substituted.
 */

export interface ProgressHandlers {
  pause(id: string): void;
  resume(id: string): void;
  cancel(id: string, anchor: HTMLElement): void;
  open(id: string): void;
  reveal(id: string): void;
  retry(id: string): void;
}

/** Four remembered positions, cycled, so two open windows do not stack exactly. */
const SLOTS = 4;
const usedSlots = new Set<number>();
const openWindows = new Map<string, { handle: OverlayHandle; slot: number; dispose(): void }>();

function claimSlot(): number {
  for (let slot = 0; slot < SLOTS; slot += 1) {
    if (!usedSlots.has(slot)) {
      usedSlots.add(slot);
      return slot;
    }
  }
  return 0;
}

export function stateLabelKey(state: DownloadState): string {
  return `downloads.state.${state}`;
}

export function stateFallback(state: DownloadState): string {
  switch (state) {
    case 'awaiting-decision':
      return 'Waiting for your decision';
    case 'queued':
      return 'Queued';
    case 'connecting':
      return 'Connecting';
    case 'downloading':
      return 'Downloading';
    case 'paused':
      return 'Paused';
    case 'interrupted':
      return 'Interrupted';
    case 'completed':
      return 'Completed';
    case 'cancelled':
      return 'Cancelled';
    case 'failed':
      return 'Failed';
    default:
      return state;
  }
}

function anchorElement(): HTMLElement {
  const existing = document.getElementById('downloads-surface-anchor');
  if (existing) return existing;
  const anchor = el('div', { className: 'downloads-anchor', attrs: { id: 'downloads-surface-anchor' } });
  document.body.append(anchor);
  return anchor;
}

/** True when a progress window for this transfer is already on screen. */
export function isProgressOpen(id: string): boolean {
  return openWindows.has(id);
}

export function closeProgressWindow(id: string): void {
  openWindows.get(id)?.handle.close();
}

export function closeAllProgressWindows(): void {
  for (const id of [...openWindows.keys()]) closeProgressWindow(id);
}

export function openProgressWindow(ctx: AppContext, id: string, handlers: ProgressHandlers): void {
  const existing = openWindows.get(id);
  if (existing) {
    existing.handle.reposition();
    return;
  }
  const record = downloadStore.byId(id);
  if (!record) return;

  const slot = claimSlot();
  const geometryKey = `downloads.progress.slot${slot}`;
  const title = ctx.t('downloads.progress.title', 'Downloading {name}', {
    values: { name: record.filename }
  });

  const handle = ctx.overlay.open({
    anchor: anchorElement(),
    placement: 'top-end',
    role: 'dialog',
    label: title,
    lightDismiss: false,
    dragKey: geometryKey,
    resizeKey: geometryKey,
    onClose: () => {
      dispose();
      usedSlots.delete(slot);
      openWindows.delete(id);
    }
  });
  handle.root.classList.add('downloads-progress-window');
  handle.root.setAttribute('data-appearance-id', 'downloads.progressWindow');
  ctx.appearance.applyTo(handle.root, '[data-appearance-id="downloads.progressWindow"]');

  const body = handle.body;
  body.classList.add('downloads-progress');

  const nameLine = el('p', { className: 'downloads-progress__name md-typescale-title-medium' });
  const stateLine = el('p', {
    className: 'downloads-progress__state md-typescale-label-large',
    attrs: { role: 'status', 'aria-live': 'polite' }
  });

  const progress = ctx.components.linearProgress({
    label: ctx.t('downloads.progress.bar', 'Transfer progress'),
    value: 0
  });

  const figures = el('div', { className: 'downloads-progress__figures' });
  const bytesValue = el('span', { className: 'md-typescale-body-medium' });
  const rateValue = el('span', { className: 'md-typescale-body-medium' });
  const etaValue = el('span', { className: 'md-typescale-body-medium' });
  const elapsedValue = el('span', { className: 'md-typescale-body-medium' });

  const figure = (term: string, value: HTMLElement): HTMLElement => {
    const wrap = el('div', { className: 'downloads-progress__figure' });
    wrap.append(el('span', { className: 'md-typescale-label-small', text: term }), value);
    return wrap;
  };

  figures.append(
    figure(ctx.t('downloads.progress.received', 'Received'), bytesValue),
    figure(ctx.t('downloads.progress.rate', 'Rate'), rateValue),
    figure(ctx.t('downloads.progress.eta', 'Time left'), etaValue),
    figure(ctx.t('downloads.progress.elapsed', 'Elapsed'), elapsedValue)
  );

  const details = el('div', { className: 'downloads-progress__details' });
  const destinationValue = el('span', { className: 'downloads-detail__value md-typescale-body-small' });
  const sourceValue = el('span', { className: 'downloads-detail__value md-typescale-body-small' });
  const resumableValue = el('span', { className: 'downloads-detail__value md-typescale-body-small' });
  const detail = (term: string, value: HTMLElement): HTMLElement => {
    const row = el('div', { className: 'downloads-detail' });
    row.append(el('span', { className: 'downloads-detail__term md-typescale-label-medium', text: term }), value);
    return row;
  };
  details.append(
    detail(ctx.t('downloads.progress.destination', 'Writing to'), destinationValue),
    detail(ctx.t('downloads.progress.source', 'From'), sourceValue),
    detail(ctx.t('downloads.progress.resumable', 'Resumable'), resumableValue)
  );

  const message = el('p', { className: 'downloads-progress__message md-typescale-body-small' });

  const actions = el('div', { className: 'downloads-progress__actions' });
  const pauseButton = ctx.components.button({
    label: 'downloads.action.pause',
    variant: 'tonal',
    icon: 'pause',
    onClick: () => handlers.pause(id)
  });
  const resumeButton = ctx.components.button({
    label: 'downloads.action.resume',
    variant: 'filled',
    icon: 'play',
    onClick: () => handlers.resume(id)
  });
  const retryButton = ctx.components.button({
    label: 'downloads.action.retry',
    variant: 'filled',
    icon: 'refresh',
    onClick: () => handlers.retry(id)
  });
  const cancelButton = ctx.components.button({
    label: 'downloads.action.cancel',
    variant: 'text',
    icon: 'stop',
    danger: true,
    onClick: (event) => handlers.cancel(id, event.currentTarget as HTMLElement)
  });
  const openButton = ctx.components.button({
    label: 'downloads.action.openFile',
    variant: 'filled',
    icon: 'file',
    onClick: () => handlers.open(id)
  });
  const revealButton = ctx.components.button({
    label: 'downloads.action.reveal',
    variant: 'tonal',
    icon: 'folder',
    onClick: () => handlers.reveal(id)
  });
  const closeButton = ctx.components.button({
    label: 'downloads.action.closeWindow',
    variant: 'text',
    icon: 'close',
    onClick: () => handle.close()
  });
  actions.append(pauseButton, resumeButton, retryButton, openButton, revealButton, cancelButton, closeButton);

  body.append(nameLine, stateLine, progress.root, figures, details, message, actions);

  let lastAnnouncedState: DownloadState | null = null;

  const show = (button: HTMLButtonElement, visible: boolean): void => {
    button.hidden = !visible;
  };

  const render = (): void => {
    const current = downloadStore.byId(id);
    if (!current) {
      handle.close();
      return;
    }
    nameLine.textContent = current.filename;
    const stateText = ctx.t(stateLabelKey(current.state), stateFallback(current.state));
    stateLine.textContent = stateText;
    handle.root.setAttribute('data-state', current.state);

    const ratio = fraction(current.received, current.total);
    if (ratio === null) {
      progress.root.setAttribute('data-indeterminate', 'true');
      progress.set(0);
    } else {
      progress.root.removeAttribute('data-indeterminate');
      progress.set(ratio);
    }

    bytesValue.textContent =
      current.total === null
        ? `${formatBytes(current.received)} (${formatExactBytes(current.received)} bytes, total unknown)`
        : `${formatBytes(current.received)} / ${formatBytes(current.total)} · ${formatPercent(ratio)}`;
    rateValue.textContent = formatRate(current.bytesPerSecond);
    const eta = formatDuration(current.etaSeconds);
    etaValue.textContent =
      eta ||
      (current.total === null
        ? ctx.t('downloads.progress.eta.noTotal', 'Unknown — the server declared no size')
        : ctx.t('downloads.progress.eta.none', 'Not measurable yet'));
    const elapsed = elapsedSeconds(current.startedAt, current.finishedAt);
    elapsedValue.textContent = elapsed === null ? '—' : formatDuration(elapsed);

    destinationValue.textContent = current.destination;
    sourceValue.textContent = shortenUrl(current.url, 96);
    resumableValue.textContent =
      current.resumable === null
        ? ctx.t('downloads.progress.resumable.unknown', 'Not known until the server has answered')
        : current.resumable
          ? ctx.t('downloads.progress.resumable.yes', 'Yes — the server accepts a range request')
          : ctx.t('downloads.progress.resumable.no', 'No — this server restarts from the beginning');

    const note = current.error || current.note;
    message.textContent = note;
    message.hidden = note.length === 0;
    message.setAttribute('data-tone', current.error ? 'error' : 'info');

    const active = ACTIVE_STATES.includes(current.state);
    const resumable = RESUMABLE_STATES.includes(current.state);
    show(pauseButton, active);
    show(resumeButton, current.state === 'paused' || current.state === 'interrupted');
    show(retryButton, current.state === 'failed');
    show(cancelButton, active || current.state === 'paused' || current.state === 'interrupted');
    show(openButton, current.state === 'completed');
    show(revealButton, current.state === 'completed');
    show(closeButton, true);
    if (!active && !resumable && current.state !== 'completed') show(cancelButton, false);

    if (lastAnnouncedState !== current.state) {
      lastAnnouncedState = current.state;
      ctx.a11y.announce(
        ctx.t('downloads.progress.announce', '{name}: {state}', {
          values: { name: current.filename, state: stateText }
        })
      );
    }
  };

  const unsubscribe = downloadStore.onChange(render);
  const timer = window.setInterval(render, 1000);
  function dispose(): void {
    unsubscribe();
    window.clearInterval(timer);
  }

  openWindows.set(id, { handle, slot, dispose });
  render();
}
