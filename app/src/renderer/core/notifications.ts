import { a11y, el, nextId } from './a11y';
import { components } from './components';
import { confirmService } from './confirm';
import { exporter } from './export';
import { i18n } from './i18n';
import { createSearchBar } from './searchbar';
import type {
  AppContext,
  NotificationHandle,
  NotificationInput,
  NotificationRecord,
  NotificationService,
  NotificationSeverity
} from './types';

/**
 * Non-blocking notifications, and the centre that keeps them reviewable.
 *
 * Anything that only INFORMS is a toast. A modal dialog is reserved for a
 * decision the user must make before continuing, so a success message, a
 * progress report and a recoverable error all appear in the corner and never
 * halt the application.
 *
 * Warnings and errors do not auto-dismiss. A four-second error is an error
 * nobody read.
 */

const DEFAULT_TIMEOUT: Record<NotificationSeverity, number> = {
  info: 6000,
  success: 4500,
  progress: 0,
  warning: 0,
  error: 0
};

const SEVERITY_ICON: Record<NotificationSeverity, string> = {
  info: 'info',
  success: 'success',
  warning: 'warning',
  error: 'error',
  progress: 'refresh'
};

let host: HTMLElement | null = null;

function ensureHost(): HTMLElement {
  if (host) return host;
  host = el('div', {
    className: 'md-toast-host',
    attrs: { id: 'md-toast-host', role: 'region', 'aria-label': i18n.t('core.notify.centre', 'Notifications') }
  });
  document.body.append(host);
  return host;
}

interface Live {
  record: NotificationRecord;
  node: HTMLElement;
  timer: number | null;
}

class NotificationsImpl implements NotificationService {
  private records: NotificationRecord[] = [];
  private live = new Map<string, Live>();
  private listeners = new Set<() => void>();

  show(input: NotificationInput): NotificationHandle {
    const id = nextId('md-notification');
    const severity = input.severity ?? 'info';
    const record: NotificationRecord = {
      id,
      title: input.title,
      body: input.body ?? '',
      severity,
      source: input.source ?? 'core',
      createdAt: new Date().toISOString(),
      dismissedAt: null,
      progress: typeof input.progress === 'number' ? input.progress : null
    };
    this.records.unshift(record);

    const node = this.buildToast(record, input);
    ensureHost().append(node);
    a11y.announce(`${record.title}. ${record.body}`, severity === 'error');

    const timeout = input.timeoutMs ?? DEFAULT_TIMEOUT[severity];
    const timer =
      timeout > 0
        ? window.setTimeout(() => {
            this.dismiss(id);
          }, timeout)
        : null;

    this.live.set(id, { record, node, timer });
    this.emit();

    return {
      id,
      update: (patch) => this.update(id, patch),
      dismiss: () => this.dismiss(id)
    };
  }

  private buildToast(record: NotificationRecord, input: Partial<NotificationInput>): HTMLElement {
    const node = el('div', {
      className: `md-toast md-toast--${record.severity}`,
      attrs: { role: record.severity === 'error' ? 'alert' : 'status', 'data-notification-id': record.id }
    });
    const head = el('div', { className: 'md-toast__head' });
    head.append(components.icon(SEVERITY_ICON[record.severity], { size: 18 }));
    head.append(
      el('span', {
        className: 'md-toast__title md-typescale-title-small',
        text: i18n.t(record.title, record.title, { dialog: true })
      })
    );
    node.append(head);
    if (record.body) {
      node.append(el('p', { className: 'md-typescale-body-medium', text: i18n.t(record.body, record.body) }));
    }
    if (record.progress !== null) {
      const bar = components.linearProgress({ label: record.title, value: record.progress });
      bar.root.dataset.role = 'progress';
      node.append(bar.root);
    }

    const actions = el('div', { className: 'md-toast__actions' });
    for (const action of input.actions ?? []) {
      const actionButton = el('button', {
        className: 'md-toast__action',
        text: i18n.t(action.label, action.label),
        attrs: { type: 'button' }
      });
      actionButton.addEventListener('click', () => void action.run());
      actions.append(actionButton);
    }
    if (input.link) {
      const link = el('button', {
        className: 'md-toast__action',
        text: i18n.t(input.link.label, input.link.label),
        attrs: { type: 'button' }
      });
      const url = input.link.url;
      link.addEventListener('click', () => void window.studio.shell.openExternal(url));
      actions.append(link);
    }
    const dismiss = el('button', {
      className: 'md-toast__action',
      text: i18n.t('core.action.dismiss', 'Dismiss'),
      attrs: { type: 'button' }
    });
    dismiss.addEventListener('click', () => this.dismiss(record.id));
    actions.append(dismiss);
    node.append(actions);
    return node;
  }

  private update(id: string, patch: Partial<NotificationInput>): void {
    const live = this.live.get(id);
    const record = this.records.find((candidate) => candidate.id === id);
    if (!record) return;
    if (patch.title !== undefined) record.title = patch.title;
    if (patch.body !== undefined) record.body = patch.body;
    if (patch.severity !== undefined) record.severity = patch.severity;
    if (patch.progress !== undefined) record.progress = patch.progress;
    if (live) {
      const replacement = this.buildToast(record, patch);
      live.node.replaceWith(replacement);
      live.node = replacement;
    }
    this.emit();
  }

  info(title: string, body?: string): NotificationHandle {
    return this.show({ title, body, severity: 'info' });
  }

  success(title: string, body?: string): NotificationHandle {
    return this.show({ title, body, severity: 'success' });
  }

  warn(title: string, body?: string): NotificationHandle {
    return this.show({ title, body, severity: 'warning' });
  }

  error(title: string, body?: string): NotificationHandle {
    return this.show({ title, body, severity: 'error' });
  }

  history(): NotificationRecord[] {
    return [...this.records];
  }

  dismiss(id: string): void {
    const live = this.live.get(id);
    if (live) {
      if (live.timer !== null) window.clearTimeout(live.timer);
      live.node.remove();
      this.live.delete(id);
    }
    const record = this.records.find((candidate) => candidate.id === id);
    if (record && !record.dismissedAt) record.dismissedAt = new Date().toISOString();
    this.emit();
  }

  dismissAll(): void {
    for (const id of [...this.live.keys()]) this.dismiss(id);
  }

  remove(ids: string[]): void {
    const set = new Set(ids);
    for (const id of ids) this.dismiss(id);
    this.records = this.records.filter((record) => !set.has(record.id));
    this.emit();
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    for (const listener of [...this.listeners]) {
      try {
        listener();
      } catch (error) {
        console.error('A notification listener threw:', error);
      }
    }
  }

  /**
   * The notification centre.
   *
   * It is a list, so it carries what every list in this application carries:
   * multi-select with a keyboard path, a select-all that says plainly whether it
   * means what is shown or everything, an inverse selection, bulk dismiss, bulk
   * delete behind the destructive gate, and an export that honours the filter
   * currently applied rather than dumping the whole log.
   */
  mountCentre(hostElement: HTMLElement, ctx: AppContext): () => void {
    const root = el('div', { className: 'md-notification-centre' });
    let filtered: NotificationRecord[] = this.history();
    const selection = new Set<string>();

    const toolbar = el('div', { className: 'md-notification-centre__toolbar' });
    const listNode = components.list({ label: 'core.notify.centre' });
    const summary = el('p', { className: 'md-typescale-body-small md-setting__secondary', attrs: { role: 'status' } });

    const search = createSearchBar({
      label: 'core.search.label',
      sample: this.history()
        .map((record) => `${record.title} ${record.body}`)
        .join('\n'),
      onChange: (query) => {
        filtered = this.history().filter((record) => query.matches(`${record.title} ${record.body} ${record.source}`));
        draw();
      }
    });

    const selectAll = components.button({
      label: 'core.action.selectAll',
      variant: 'text',
      onClick: () => {
        for (const record of filtered) selection.add(record.id);
        draw();
      }
    });
    const invert = components.button({
      label: 'core.action.invertSelection',
      variant: 'text',
      onClick: () => {
        for (const record of filtered) {
          if (selection.has(record.id)) selection.delete(record.id);
          else selection.add(record.id);
        }
        draw();
      }
    });
    const dismissSelected = components.button({
      label: 'core.notify.dismissAll',
      variant: 'text',
      onClick: () => {
        for (const id of selection) this.dismiss(id);
        draw();
      }
    });
    const deleteSelected = components.button({
      label: 'core.notify.deleteSelected',
      variant: 'text',
      danger: true,
      onClick: async (event) => {
        const chosen = [...selection];
        if (chosen.length === 0) return;
        const approved = await confirmService.request({
          action: ctx.t('core.notify.deleteSelected', 'Delete selected') + ` (${chosen.length})`,
          affected: chosen.map((id) => this.records.find((record) => record.id === id)?.title ?? id),
          irreversible: 'These notification records are removed from this session and cannot be recovered.',
          anchor: event.currentTarget as HTMLElement
        });
        if (!approved) return;
        this.remove(chosen);
        selection.clear();
        draw();
      }
    });
    const exportShown = components.button({
      label: 'core.notify.exportFiltered',
      variant: 'text',
      onClick: () => {
        void exporter.save(
          filtered.map((record) => ({ ...record })),
          'json',
          { name: 'notifications', defaultFileName: 'notifications.json' }
        );
      }
    });

    toolbar.append(selectAll, invert, dismissSelected, deleteSelected, exportShown);

    const draw = (): void => {
      listNode.textContent = '';
      if (filtered.length === 0) {
        listNode.append(components.emptyState({ title: 'core.notify.empty' }));
      }
      for (const record of filtered) {
        const row = el('li', {
          className: 'md-notification-row',
          attrs: { 'data-severity': record.severity, 'aria-selected': String(selection.has(record.id)) }
        });
        const box = components.checkbox({
          label: record.title,
          checked: selection.has(record.id),
          onChange: (checked) => {
            if (checked) selection.add(record.id);
            else selection.delete(record.id);
            row.setAttribute('aria-selected', String(checked));
            updateSummary();
          }
        });
        box.root.querySelector('span')?.classList.add('md-visually-hidden');
        const text = el('div', { className: 'md-list-item__text' });
        text.append(el('span', { className: 'md-typescale-title-small', text: record.title }));
        if (record.body) text.append(el('span', { className: 'md-typescale-body-medium', text: record.body }));
        text.append(
          el('span', {
            className: 'md-notification-row__meta',
            text: `${record.source} · ${new Date(record.createdAt).toLocaleString()} · ${i18n.t(
              `core.notify.severity.${record.severity}`,
              record.severity
            )}${record.dismissedAt ? ' · dismissed' : ''}`
          })
        );
        row.append(box.root, components.icon(SEVERITY_ICON[record.severity], { size: 18 }), text);
        listNode.append(row);
      }
      updateSummary();
    };

    const updateSummary = (): void => {
      summary.textContent = `${i18n.t('core.notify.selected', '{count} selected', {
        values: { count: selection.size }
      })} · ${i18n.t('core.search.matchCount', '{count} of {total} shown', {
        values: { count: filtered.length, total: this.history().length }
      })}`;
    };

    root.append(search.root, toolbar, summary, listNode);
    hostElement.append(root);
    draw();

    const unsubscribe = this.onChange(() => {
      filtered = this.history().filter((record) => search.query().matches(`${record.title} ${record.body} ${record.source}`));
      draw();
    });

    return () => {
      unsubscribe();
      search.destroy();
      root.remove();
    };
  }
}

export const notifications = new NotificationsImpl();
