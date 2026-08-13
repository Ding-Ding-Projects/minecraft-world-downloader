import type { AppContext, ExportFormat, LockRecord, TabContext } from '../../core/registry';
import { LOCKS_CHANGED_EVENT, LockGuard } from './guard';
import {
  LOCK_RECORDS_KEY,
  classify,
  describeDuration,
  describeMethod,
  describeTarget,
  dialogTitle,
  enforcementKey,
  parseAppearanceTarget,
  recordToRow,
  searchHaystack
} from './model';
import { openLockPicker, replaceCredential } from './wizard';

/**
 * The Locks destination: every lock as a real, enumerable, individually
 * manageable row.
 *
 * A lock list is not a log. Each row is the lock itself — its own credential
 * replaced from here, its own unlock prompt raised from here, its own removal
 * gated from here — because a lock nobody can find again is a lock nobody can
 * undo, and "delete the application data folder" should be the last resort
 * rather than the only one.
 *
 * This surface is deliberately exempt from the element guard. A selector broad
 * enough to match every button in the window would otherwise block the very
 * buttons that remove it, and a toy lock must never be able to trap somebody in
 * a state only a folder deletion can leave.
 */

const PAGE_SIZE = 25;
const STATE_TICK_MS = 1000;

interface ManagerState {
  page: number;
  selection: Set<string>;
  lastIndex: number;
  matched: LockRecord[];
}

export function mountLockManager(host: HTMLElement, ctx: TabContext, guard: LockGuard | null): void {
  host.setAttribute('data-locks-manager', 'true');

  host.append(
    ctx.components.topAppBar({
      title: 'locks.title',
      subtitle: 'locks.subtitle'
    })
  );

  const root = document.createElement('div');
  root.className = 'wds-locks';
  root.setAttribute('data-appearance-id', 'locks:manager');
  host.append(root);

  const state: ManagerState = { page: 0, selection: new Set(), lastIndex: -1, matched: [] };

  /* ---------------- the disclosure and the recovery route ---------------- */

  const disclosure = ctx.components.card({ variant: 'outlined', title: 'locks.forFun.title' });
  disclosure.classList.add('wds-locks-forfun');
  disclosure.append(
    paragraph(
      'md-typescale-body-medium',
      ctx.t(
        'locks.forFun.body',
        'A lock here is a speed bump you set for yourself. It is not security, it is not encryption, and it protects nothing from anybody else who can use this computer. Deleting {path} removes every lock on this list.',
        { values: { path: ctx.locks.recoveryPath() } }
      )
    ),
    paragraph(
      'md-typescale-body-medium',
      ctx.t(
        'locks.recovery.body',
        'Delete this folder and every lock is gone, along with everything else stored locally with it: {path}.',
        { values: { path: ctx.locks.recoveryPath() } }
      )
    ),
    paragraph('md-typescale-body-small', ctx.t('locks.manager.exempt', 'This page is never blocked by an element lock, so a lock can always be removed from here.'))
  );

  const recoveryActions = document.createElement('div');
  recoveryActions.className = 'wds-locks-actions';
  recoveryActions.append(
    ctx.components.button({
      label: 'locks.recovery.open',
      variant: 'tonal',
      icon: 'folder',
      onClick: async () => {
        const result = await ctx.studio.app.revealUserData();
        if (!result.ok) {
          ctx.notify.error(
            dialogTitle(ctx, 'locks.recovery.title', 'If you are locked out'),
            ctx.t('locks.recovery.failed', 'The file manager could not be opened: {reason}. The folder is {path}.', {
              values: { reason: result.error, path: ctx.locks.recoveryPath() }
            })
          );
        }
      }
    }),
    ctx.components.button({
      label: 'locks.recovery.copy',
      variant: 'text',
      icon: 'copy',
      onClick: () => {
        void navigator.clipboard
          .writeText(ctx.locks.recoveryPath())
          .then(() => ctx.a11y.announce(ctx.locks.recoveryPath()))
          .catch(() => ctx.notify.warn(ctx.t('locks.recovery.copy', 'Copy the folder path'), ctx.locks.recoveryPath()));
      }
    })
  );
  disclosure.append(recoveryActions);
  root.append(disclosure);

  /* ---------------- toolbar ---------------- */

  const toolbar = document.createElement('div');
  toolbar.className = 'wds-locks-actions';

  const newLock = ctx.components.button({
    label: 'locks.action.new',
    variant: 'filled',
    icon: 'lock',
    onClick: () => openLockPicker(ctx, newLock)
  });

  const relock = ctx.components.button({
    label: 'locks.action.relock',
    variant: 'tonal',
    icon: 'refresh',
    onClick: () => {
      const unlocked = ctx.locks.list().filter((record) => ctx.locks.isUnlocked(record.target)).length;
      ctx.locks.lockAll();
      guard?.paintBadges();
      redraw();
      ctx.notify.success(
        ctx.t('locks.relocked', 'Everything is locked again'),
        ctx.t('locks.relocked.count', '{count} surfaces were unlocked and are locked again.', {
          values: { count: unlocked }
        })
      );
    }
  });

  const exportFormat = ctx.components.select({
    label: 'core.export.format',
    value: 'json',
    options: ctx.exporter.formats().map((format) => ({ value: format, label: format.toUpperCase() }))
  });

  const exportButton = ctx.components.button({
    label: 'locks.action.export',
    variant: 'text',
    icon: 'download',
    onClick: () => void exportLocks(ctx, exportFormat.get() as ExportFormat, rowsForExport(ctx, state))
  });

  toolbar.append(newLock, relock, exportFormat.root, exportButton);
  root.append(toolbar);

  /* ---------------- search ---------------- */

  const search = ctx.createSearchBar({
    label: 'locks.list.search',
    sample: ctx.locks
      .list()
      .map((record) => `${record.label} ${record.target}`)
      .join('\n'),
    onChange: () => {
      state.page = 0;
      redraw();
    }
  });
  root.append(search.root);

  /* ---------------- selection bar ---------------- */

  const selectionBar = document.createElement('div');
  selectionBar.className = 'wds-locks-actions';

  const selectPage = ctx.components.button({
    label: 'locks.bulk.selectPage',
    variant: 'text',
    onClick: () => {
      for (const record of pageOf(state)) state.selection.add(record.target);
      redraw();
    }
  });
  const selectAll = ctx.components.button({
    label: 'locks.bulk.selectAll',
    variant: 'text',
    onClick: () => {
      for (const record of state.matched) state.selection.add(record.target);
      redraw();
    }
  });
  const invert = ctx.components.button({
    label: 'locks.bulk.invert',
    variant: 'text',
    onClick: () => {
      const next = new Set<string>();
      for (const record of state.matched) {
        if (!state.selection.has(record.target)) next.add(record.target);
      }
      state.selection = next;
      redraw();
    }
  });
  const clearSelection = ctx.components.button({
    label: 'locks.bulk.clear',
    variant: 'text',
    onClick: () => {
      state.selection.clear();
      redraw();
    }
  });
  const removeSelected = ctx.components.button({
    label: 'core.action.delete',
    variant: 'text',
    danger: true,
    icon: 'trash',
    onClick: (event) => void removeSelectedLocks(event.currentTarget as HTMLElement)
  });

  selectionBar.append(selectPage, selectAll, invert, clearSelection, removeSelected);
  root.append(selectionBar);

  const summary = paragraph('md-typescale-body-small', '');
  summary.setAttribute('role', 'status');
  const selectionSummary = paragraph('md-typescale-body-small', '');
  selectionSummary.setAttribute('role', 'status');
  root.append(summary, selectionSummary);

  /* ---------------- the list ---------------- */

  const listHost = document.createElement('div');
  listHost.className = 'wds-locks-list';
  const listNode = ctx.components.list({ label: 'locks.list.label' });
  listHost.append(listNode);
  root.append(listHost);

  const pager = document.createElement('div');
  pager.className = 'wds-locks-actions';
  const previousPage = ctx.components.button({
    label: 'locks.list.previousPage',
    variant: 'text',
    icon: 'chevronLeft',
    onClick: () => {
      state.page = Math.max(0, state.page - 1);
      redraw();
    }
  });
  const nextPage = ctx.components.button({
    label: 'locks.list.nextPage',
    variant: 'text',
    trailingIcon: 'chevronRight',
    onClick: () => {
      state.page = Math.min(pageCount(state) - 1, state.page + 1);
      redraw();
    }
  });
  pager.append(previousPage, nextPage);
  root.append(pager);

  ctx.a11y.roving(listNode, () => [...listNode.querySelectorAll<HTMLElement>('.md-list-item')], 'vertical');

  /* ---------------- drawing ---------------- */

  function redraw(): void {
    const query = search.query();
    const all = ctx.locks.list();
    state.matched = all.filter((record) => query.matches(searchHaystack(record, ctx)));
    const pages = pageCount(state);
    if (state.page >= pages) state.page = Math.max(0, pages - 1);

    listNode.textContent = '';
    listHost.querySelector('.md-empty')?.remove();

    if (all.length === 0) {
      listHost.append(
        ctx.components.emptyState({
          title: 'locks.list.empty.title',
          body: 'locks.list.empty.body',
          action: {
            label: 'locks.action.new',
            variant: 'filled',
            icon: 'lock',
            onClick: (event) => openLockPicker(ctx, event.currentTarget as HTMLElement)
          }
        })
      );
    } else if (state.matched.length === 0) {
      listHost.append(
        ctx.components.emptyState({
          title: ctx.t('locks.list.noMatch', 'No lock matched. {total} locks exist.', {
            values: { total: all.length }
          })
        })
      );
    }

    const page = pageOf(state);
    page.forEach((record, indexOnPage) => {
      listNode.append(buildRow(record, state.page * PAGE_SIZE + indexOnPage));
    });

    summary.textContent =
      all.length === 0
        ? ''
        : ctx.t('locks.list.count', 'Showing {shown} of {total} locks, page {page} of {pages}.', {
            values: {
              shown: page.length,
              total: all.length,
              page: pages === 0 ? 0 : state.page + 1,
              pages: Math.max(1, pages)
            }
          });

    refreshSelectionUi();
    setDisabled(previousPage, state.page === 0, ctx.t('locks.list.firstPage', 'This is the first page.'));
    setDisabled(nextPage, state.page >= pages - 1, ctx.t('locks.list.lastPage', 'This is the last page.'));
    setDisabled(relock, all.length === 0, ctx.t('locks.relock.nothing', 'There are no locks to lock again.'));
    setDisabled(exportButton, all.length === 0, ctx.t('locks.export.nothing', 'There is nothing to export yet.'));
  }

  /**
   * Selection changes never rebuild the rows.
   *
   * Rebuilding a list under a checkbox the user has just clicked destroys the
   * element they are standing on, and the focus goes with it — which turns
   * keyboard multi-select into a control that fights back.
   */
  function refreshSelectionUi(): void {
    const all = ctx.locks.list();
    const selected = [...state.selection].filter((target) => all.some((record) => record.target === target));
    state.selection = new Set(selected);

    for (const row of listNode.querySelectorAll<HTMLElement>('[data-lock-target]')) {
      const chosen = state.selection.has(row.dataset.lockTarget ?? '');
      row.setAttribute('aria-selected', String(chosen));
      const box = row.querySelector<HTMLInputElement>('input[type="checkbox"]');
      if (box && box.checked !== chosen) box.checked = chosen;
    }

    selectionSummary.textContent =
      selected.length === 0
        ? ctx.t('locks.bulk.needSelection', 'Nothing is selected, so nothing will happen.')
        : ctx.t('locks.bulk.selected', '{count} selected. {affected} will change; {skipped} would be skipped.', {
            values: { count: selected.length, affected: selected.length, skipped: 0 }
          });

    updateLabel(
      selectPage,
      ctx.t('locks.bulk.selectPage', 'Select the {count} on this page', { values: { count: pageOf(state).length } })
    );
    updateLabel(
      selectAll,
      ctx.t('locks.bulk.selectAll', 'Select every one of the {count} matches', { values: { count: state.matched.length } })
    );
    setDisabled(
      removeSelected,
      selected.length === 0,
      ctx.t('locks.bulk.needSelection', 'Nothing is selected, so nothing will happen.')
    );
  }

  /** What the visible state depends on, so a tick only repaints a real change. */
  function stateSignature(): string {
    return ctx.locks
      .list()
      .map((record) => `${record.target}:${ctx.locks.isUnlocked(record.target) ? 'u' : 'l'}`)
      .join('|');
  }

  function buildRow(record: LockRecord, absoluteIndex: number): HTMLElement {
    const kind = classify(record.target, ctx);
    const unlocked = ctx.locks.isUnlocked(record.target);

    const trailing = document.createElement('div');
    trailing.className = 'wds-locks-row__actions';

    const stateChip = document.createElement('span');
    stateChip.className = `md-badge ${unlocked ? 'md-badge--warning' : 'md-badge--success'}`;
    stateChip.textContent = unlocked
      ? record.unlockMinutes === -1
        ? ctx.t('locks.state.unlockedUntilClose', 'Unlocked until the application closes')
        : ctx.t('locks.state.unlocked', 'Unlocked')
      : ctx.t('locks.state.locked', 'Locked');
    trailing.append(stateChip);

    const unlockButton = ctx.components.button({
      label: 'locks.action.unlock',
      variant: 'tonal',
      icon: 'lockOpen',
      disabled: unlocked,
      disabledReason: ctx.t('locks.action.alreadyUnlocked', 'This is already unlocked.'),
      onClick: (event) => {
        void ctx.locks.unlock(record.target, event.currentTarget as HTMLElement).then((ok) => {
          if (ok) guard?.paintBadges();
          redraw();
        });
      }
    });

    const replaceButton = ctx.components.button({
      label: 'locks.action.replace',
      variant: 'text',
      icon: 'key',
      onClick: (event) =>
        replaceCredential(ctx, event.currentTarget as HTMLElement, record.target, record.label)
    });

    const revealButton = ctx.components.button({
      label: 'locks.action.reveal',
      variant: 'text',
      icon: 'visibility',
      onClick: () => reveal(record)
    });

    const copyButton = ctx.components.button({
      label: 'locks.action.copyTarget',
      variant: 'text',
      icon: 'copy',
      onClick: () => {
        void navigator.clipboard.writeText(record.target).catch(() => undefined);
        ctx.a11y.announce(record.target);
      }
    });

    const removeButton = ctx.components.button({
      label: 'locks.action.remove',
      variant: 'text',
      danger: true,
      icon: 'trash',
      onClick: (event) => void removeOne(record, event.currentTarget as HTMLElement)
    });

    trailing.append(unlockButton, replaceButton, revealButton, copyButton, removeButton);

    const supporting = [
      describeTarget(record, ctx),
      ctx.t('locks.row.method', 'Unlocks with: {method}', { values: { method: describeMethod(record, ctx) } }),
      ctx.t('locks.row.duration', 'Stays unlocked: {duration}', {
        values: { duration: describeDuration(record.unlockMinutes, ctx) }
      }),
      ctx.t('locks.row.created', 'Created {when}', { values: { when: formatWhen(record.createdAt) } }),
      ctx.t(enforcementKey(kind), 'This lock is a record only.')
    ].join(' · ');

    const row = ctx.components.listItem({
      headline: record.label || record.target,
      supporting,
      leadingIcon: unlocked ? 'lockOpen' : 'lock',
      selectable: true,
      selected: state.selection.has(record.target),
      trailing,
      onSelectChange: (selected) => {
        if (selected) state.selection.add(record.target);
        else state.selection.delete(record.target);
        state.lastIndex = absoluteIndex;
        refreshSelectionUi();
      }
    });
    row.dataset.lockTarget = record.target;

    const extend = (event: MouseEvent | KeyboardEvent): void => {
      if (!event.shiftKey || state.lastIndex < 0) return;
      event.preventDefault();
      const [from, to] =
        state.lastIndex <= absoluteIndex ? [state.lastIndex, absoluteIndex] : [absoluteIndex, state.lastIndex];
      for (let cursor = from; cursor <= to; cursor += 1) {
        const target = state.matched[cursor];
        if (target) state.selection.add(target.target);
      }
      refreshSelectionUi();
    };
    row.addEventListener('click', extend);
    row.addEventListener('keydown', (event) => {
      if (event.key === ' ' || event.key === 'Spacebar') {
        if (event.shiftKey) {
          extend(event);
          return;
        }
        event.preventDefault();
        if (state.selection.has(record.target)) state.selection.delete(record.target);
        else state.selection.add(record.target);
        state.lastIndex = absoluteIndex;
        refreshSelectionUi();
      }
    });

    return row;
  }

  function reveal(record: LockRecord): void {
    const kind = classify(record.target, ctx);
    if (kind === 'tab') {
      ctx.tabs.teleport(record.target);
      return;
    }
    if (kind === 'setting') {
      ctx.tabs.teleport('core.settings', `setting-${record.target}`);
      return;
    }
    const appearance = parseAppearanceTarget(record.target);
    const selector = appearance ? appearance.selector : record.target;
    let element: HTMLElement | null = null;
    try {
      element = document.querySelector<HTMLElement>(selector);
    } catch {
      element = null;
    }
    if (!element) {
      ctx.notify.warn(
        ctx.t('locks.action.reveal', 'Go to what this locks'),
        ctx.t('locks.reveal.absent', 'Nothing matching {selector} is on screen right now.', {
          values: { selector }
        })
      );
      return;
    }
    element.scrollIntoView({ block: 'center', behavior: ctx.a11y.reducedMotion() ? 'auto' : 'smooth' });
    ctx.a11y.focusVisible(element);
  }

  async function removeOne(record: LockRecord, anchor: HTMLElement): Promise<void> {
    const approved = await ctx.confirm.request({
      action: ctx.t('locks.bulk.removeTitle', 'Remove {count} locks', { values: { count: 1 } }),
      affected: [`${record.label} — ${record.target}`],
      irreversible: ctx.t(
        'locks.bulk.removeIrreversible',
        'The locks and their credentials are deleted from the credential vault.'
      ),
      anchor
    });
    if (!approved) return;
    await ctx.locks.remove(record.target);
    await ctx.history.record('Removed a lock from the lock manager', 'locks', {
      target: record.target,
      label: record.label
    });
    guard?.refresh();
    redraw();
    ctx.notify.success(ctx.t('locks.bulk.removed', '{count} locks removed', { values: { count: 1 } }));
  }

  async function removeSelectedLocks(anchor: HTMLElement): Promise<void> {
    const chosen = ctx.locks.list().filter((record) => state.selection.has(record.target));
    if (chosen.length === 0) return;
    const approved = await ctx.confirm.request({
      action: ctx.t('locks.bulk.removeTitle', 'Remove {count} locks', { values: { count: chosen.length } }),
      affected: chosen.map((record) => `${record.label} — ${record.target}`),
      irreversible: ctx.t(
        'locks.bulk.removeIrreversible',
        'The locks and their credentials are deleted from the credential vault.'
      ),
      anchor
    });
    if (!approved) return;

    const failed: string[] = [];
    for (const record of chosen) {
      try {
        await ctx.locks.remove(record.target);
      } catch (error) {
        failed.push(`${record.label}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    await ctx.history.record('Removed locks in bulk', 'locks', {
      requested: chosen.length,
      removed: chosen.length - failed.length,
      targets: chosen.map((record) => record.target)
    });
    state.selection.clear();
    guard?.refresh();
    redraw();
    if (failed.length > 0) {
      ctx.notify.warn(
        ctx.t('locks.bulk.removeFailed', '{count} locks could not be removed: {reason}', {
          values: { count: failed.length, reason: failed.join('; ') }
        })
      );
    }
    ctx.notify.success(
      ctx.t('locks.bulk.removed', '{count} locks removed', { values: { count: chosen.length - failed.length } })
    );
  }

  /* ---------------- live state ---------------- */

  const onChanged = (): void => redraw();
  window.addEventListener(LOCKS_CHANGED_EVENT, onChanged);
  const stopSettings = ctx.settings.onChange((change) => {
    if (change.id === LOCK_RECORDS_KEY) redraw();
  });
  // An unlock expiring is a clock event rather than a stored change, so the
  // state chips are recomputed on a slow tick instead of pretending a surface
  // is still unlocked until something else happens to repaint it. The tick only
  // repaints when the state genuinely moved, so a row is never pulled out from
  // under the pointer once a second for nothing.
  let signature = stateSignature();
  const ticker = window.setInterval(() => {
    const next = stateSignature();
    if (next === signature) return;
    signature = next;
    redraw();
  }, STATE_TICK_MS);

  ctx.onDispose(() => {
    window.removeEventListener(LOCKS_CHANGED_EVENT, onChanged);
    stopSettings();
    window.clearInterval(ticker);
    search.destroy();
  });

  redraw();
}

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

function paragraph(className: string, text: string): HTMLParagraphElement {
  const node = document.createElement('p');
  node.className = className;
  node.textContent = text;
  return node;
}

function updateLabel(button: HTMLButtonElement, text: string): void {
  const labelNode = button.querySelector('.md-btn__label');
  if (labelNode) labelNode.textContent = text;
}

function setDisabled(button: HTMLButtonElement, disabled: boolean, reason: string): void {
  button.disabled = disabled;
  if (disabled) {
    button.title = reason;
    button.setAttribute('aria-description', reason);
  } else {
    button.removeAttribute('title');
    button.removeAttribute('aria-description');
  }
}

function pageCount(state: ManagerState): number {
  return Math.max(1, Math.ceil(state.matched.length / PAGE_SIZE));
}

function pageOf(state: ManagerState): LockRecord[] {
  const start = state.page * PAGE_SIZE;
  return state.matched.slice(start, start + PAGE_SIZE);
}

function formatWhen(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleString();
}

function rowsForExport(ctx: AppContext, state: ManagerState): Array<Record<string, unknown>> {
  const rows = state.matched.map((record) => recordToRow(record, ctx));
  rows.push({
    target: '_omitted',
    label: ctx.t(
      'locks.export.omitted',
      'No credential is in that file. Passwords and one-time-code secrets stay in the credential vault.'
    ),
    describes: '',
    kind: 'note',
    method: '',
    unlockMinutes: 0,
    unlockDuration: '',
    createdAt: new Date().toISOString(),
    currentlyUnlocked: false,
    credential: 'omitted'
  });
  return rows;
}

async function exportLocks(
  ctx: AppContext,
  format: ExportFormat,
  rows: Array<Record<string, unknown>>
): Promise<void> {
  const preflight = ctx.exporter.preflight(rows, format);
  if (preflight.losses.length > 0) {
    ctx.notify.warn(
      ctx.t('core.export.title', 'Export'),
      ctx.t('core.export.losses', '{format} cannot carry every field. These would be flattened or dropped: {fields}', {
        values: { format, fields: preflight.losses.map((loss) => loss.field).join(', ') }
      })
    );
  }
  const path = await ctx.exporter.save(rows, format, {
    name: 'locks',
    schemaVersion: '1',
    defaultFileName: `locks.${format}`
  });
  if (!path) return;
  ctx.notify.success(
    ctx.t('locks.export.done', 'Exported {count} locks to {path}', {
      values: { count: rows.length - 1, path }
    }),
    ctx.t(
      'locks.export.omitted',
      'No credential is in that file. Passwords and one-time-code secrets stay in the credential vault.'
    )
  );
}
