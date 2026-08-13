import { el } from '../../core/a11y';
import type { DataTableHandle, TabContext } from '../../core/registry';
import { buildBulkBar } from './bulk';
import { openExportMenu } from './editorsList';
import { handOff, reportOutcome, revealInFileManager } from './handoff';
import { ELEMENT_IDS } from './settingIds';
import type { RecentHandoff } from './state';
import { editorStore } from './state';

/**
 * The recent handoffs.
 *
 * Failures are kept beside successes deliberately. A list that only records
 * what worked cannot answer the question somebody actually has — "why did
 * nothing happen when I pressed that?" — and the answer to that question is the
 * exact refusal text, which is stored here rather than only shown once in a
 * toast that has since scrolled away.
 */

export interface RecentSectionHandle {
  root: HTMLElement;
  refresh(): void;
  destroy(): void;
}

function formatTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

function recentRecord(ctx: TabContext, entry: RecentHandoff): Record<string, unknown> {
  return {
    path: entry.path,
    openedAs:
      entry.mode === 'workspace'
        ? ctx.t('externalEditor.mode.workspace', 'Folder as a workspace root')
        : ctx.t('externalEditor.mode.file', 'The file on its own'),
    editor: entry.editor,
    at: entry.at,
    succeeded: entry.ok,
    error: entry.error
  };
}

export function buildRecentSection(ctx: TabContext): RecentSectionHandle {
  const root = el('section', { className: 'external-editor-section' });
  root.id = ELEMENT_IDS.recent;

  root.append(
    ctx.components.sectionHeading({
      title: 'externalEditor.recent.title',
      description: 'externalEditor.recent.description'
    })
  );

  let shown: RecentHandoff[] = [];

  const bar = buildBulkBar<RecentHandoff>({
    ctx,
    everything: () => editorStore.recent(),
    shown: () => shown,
    rowId: (entry) => entry.id,
    actions: [
      {
        id: 'again',
        label: 'externalEditor.action.openAgain',
        icon: 'play',
        disabledReason: (rows) =>
          rows.length === 0
            ? ctx.t('externalEditor.bulk.nothingSelected', 'Nothing is selected.')
            : rows.length > 8
              ? ctx.t(
                  'externalEditor.bulk.tooManyReopens',
                  'Eight is the most that will be reopened at once, so a mis-click cannot open forty editor windows. {count} are selected.',
                  { values: { count: String(rows.length) } }
                )
              : null,
        run: async (rows) => {
          for (const entry of rows) {
            const outcome = await handOff(ctx, {
              path: entry.path,
              kind: 'file',
              mode: entry.mode === 'workspace' ? 'workspace' : 'file'
            });
            reportOutcome(ctx, outcome);
          }
          refresh();
        }
      },
      {
        id: 'reveal',
        label: 'externalEditor.action.reveal',
        icon: 'folder',
        disabledReason: (rows) =>
          rows.length !== 1
            ? ctx.t(
                'externalEditor.bulk.oneOnlyReveal',
                'The file manager is opened one path at a time. Select a single row.'
              )
            : null,
        run: async (rows) => {
          const entry = rows[0];
          if (entry) await revealInFileManager(ctx, entry.path);
        }
      },
      {
        id: 'export',
        label: 'externalEditor.action.export',
        icon: 'download',
        disabledReason: (rows) =>
          rows.length === 0 ? ctx.t('externalEditor.bulk.nothingSelected', 'Nothing is selected.') : null,
        run: (rows, anchor) => {
          openExportMenu(
            ctx,
            anchor,
            rows.map((entry) => recentRecord(ctx, entry)),
            'external-editor-handoffs'
          );
        }
      },
      {
        id: 'forget',
        label: 'externalEditor.action.forget',
        icon: 'trash',
        danger: true,
        disabledReason: (rows) =>
          rows.length === 0 ? ctx.t('externalEditor.bulk.nothingSelected', 'Nothing is selected.') : null,
        run: async (rows, anchor) => {
          const approved = await ctx.confirm.request({
            anchor,
            action: ctx.t('externalEditor.confirm.forgetAction', 'Forget {count} recent handoffs', {
              values: { count: String(rows.length) }
            }),
            affected: rows.map((entry) => `${formatTime(entry.at)} — ${entry.path}`),
            irreversible: ctx.t(
              'externalEditor.confirm.forgetIrreversible',
              'These records are removed from this application. No file is touched and nothing on disk is deleted.'
            )
          });
          if (!approved) return;
          const removed = editorStore.removeRecent(rows.map((entry) => entry.id));
          void ctx.history.record('Forgot recent external editor handoffs', 'external-editor', {
            count: removed.length
          });
          const message = ctx.t('externalEditor.notify.forgot', '{count} recent handoffs were forgotten.', {
            values: { count: String(removed.length) }
          });
          ctx.notify.success(ctx.t('externalEditor.title', 'External editor', { dialog: true }), message);
          ctx.a11y.announce(message);
          table.clearSelection();
          refresh();
        }
      }
    ]
  });

  const table: DataTableHandle<RecentHandoff> = ctx.components.dataTable<RecentHandoff>({
    label: 'externalEditor.recent.title',
    selectable: true,
    emptyMessage: 'externalEditor.recent.empty',
    onSelectionChange: (ids) => bar.onSelectionChange(ids),
    rowId: (entry) => entry.id,
    columns: [
      { id: 'at', label: 'externalEditor.column.when', sortable: true, value: (entry) => formatTime(entry.at) },
      { id: 'path', label: 'externalEditor.column.path', sortable: true, value: (entry) => entry.path },
      {
        id: 'mode',
        label: 'externalEditor.column.openedAs',
        sortable: true,
        value: (entry) =>
          entry.mode === 'workspace'
            ? ctx.t('externalEditor.mode.workspace', 'Folder as a workspace root')
            : ctx.t('externalEditor.mode.file', 'The file on its own')
      },
      {
        id: 'editor',
        label: 'externalEditor.column.editor',
        sortable: true,
        value: (entry) =>
          entry.editor === '' ? ctx.t('externalEditor.recent.noEditor', 'None could be started') : entry.editor
      },
      {
        id: 'outcome',
        label: 'externalEditor.column.outcome',
        sortable: true,
        render: (entry) =>
          entry.ok
            ? ctx.components.badge({
                label: ctx.t('externalEditor.outcome.ok', 'Opened'),
                severity: 'success'
              })
            : ctx.components.badge({ label: entry.error, severity: 'error' })
      }
    ],
    rows: []
  });

  const search = ctx.createSearchBar({
    label: 'externalEditor.recent.search',
    sample: editorStore
      .recent()
      .map((entry) => entry.path)
      .join('\n'),
    onChange: () => refresh()
  });

  const empty = ctx.components.emptyState({
    title: 'externalEditor.recent.emptyTitle',
    body: 'externalEditor.recent.emptyBody'
  });

  root.append(search.root, bar.root, table.root, empty);
  bar.attach(table);

  function refresh(): void {
    const query = search.query();
    const all = editorStore.recent();
    shown = all.filter((entry) =>
      query.matches([entry.path, entry.editor, entry.mode, entry.error].join(' '))
    );
    table.setRows(shown);
    bar.refresh();
    const isEmpty = all.length === 0;
    empty.hidden = !isEmpty;
    table.root.hidden = isEmpty;
    search.root.hidden = isEmpty;
    bar.root.hidden = isEmpty;
  }

  refresh();

  return {
    root,
    refresh,
    destroy: () => search.destroy()
  };
}
