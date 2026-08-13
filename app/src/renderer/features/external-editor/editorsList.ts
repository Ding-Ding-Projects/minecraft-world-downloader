import { el } from '../../core/a11y';
import type { DataTableHandle, ExportFormat, TabContext } from '../../core/registry';
import { buildBulkBar } from './bulk';
import { ELEMENT_IDS, AUTOMATIC } from './settingIds';
import type { EditorRow } from './state';
import { editorStore } from './state';

/**
 * The editor inventory.
 *
 * Every row says four things a user has to be able to see at a glance: what it
 * is, where it came from, whether this application can actually start it, and
 * where the executable lives. The third of those is the one that is usually
 * hidden behind an optimistic list, and it is exactly the one somebody needs
 * before they click a button and watch nothing happen.
 */

export interface EditorsSectionHandle {
  root: HTMLElement;
  refresh(): void;
  destroy(): void;
}

export function statusLabel(ctx: TabContext, row: EditorRow): string {
  switch (row.status) {
    case 'ready':
      return ctx.t('externalEditor.status.ready', 'Installed and ready');
    case 'linked':
      return ctx.t('externalEditor.status.linked', 'The same file as a detected editor, so it can be started');
    case 'missing':
      return ctx.t('externalEditor.status.missing', 'Not on this machine');
    case 'unlinked':
      return ctx.t('externalEditor.status.unlinked', 'Present, but this application cannot start it');
    default:
      return '';
  }
}

export function originLabel(ctx: TabContext, row: EditorRow): string {
  return row.origin === 'detected'
    ? ctx.t('externalEditor.origin.detected', 'Detected')
    : ctx.t('externalEditor.origin.added', 'Added by you');
}

function folderLabel(ctx: TabContext, row: EditorRow): string {
  return row.supportsFolder
    ? ctx.t('externalEditor.folder.yes', 'Opens a folder as a workspace root')
    : ctx.t('externalEditor.folder.no', 'Files only');
}

/** Flat records for export and for the clipboard. Never a live object. */
export function editorRecord(ctx: TabContext, row: EditorRow): Record<string, unknown> {
  return {
    id: row.id,
    name: row.name,
    origin: originLabel(ctx, row),
    status: statusLabel(ctx, row),
    executable: row.command,
    opensFolderAsWorkspace: row.supportsFolder,
    canBeStarted: row.launchId !== null,
    addedAt: row.addedAt
  };
}

export function buildEditorsSection(ctx: TabContext): EditorsSectionHandle {
  const root = el('section', { className: 'external-editor-section' });
  root.id = ELEMENT_IDS.list;

  root.append(
    ctx.components.sectionHeading({
      title: 'externalEditor.list.title',
      description: 'externalEditor.list.description'
    })
  );

  const probeStatus = el('p', {
    className: 'external-editor-note md-typescale-body-small',
    attrs: { role: 'status', 'aria-live': 'polite' }
  });

  const recheck = ctx.components.button({
    label: 'externalEditor.action.recheck',
    variant: 'outlined',
    icon: 'refresh',
    onClick: () => {
      void editorStore.refresh().then(() => {
        const found = editorStore.usable().length;
        ctx.a11y.announce(
          ctx.t('externalEditor.notify.rechecked', 'The machine was checked: {count} usable editors.', {
            values: { count: String(found) }
          })
        );
      });
    }
  });

  const headerRow = el('div', { className: 'external-editor-row' });
  headerRow.append(recheck);
  root.append(headerRow, probeStatus);

  let shown: EditorRow[] = [];

  const bar = buildBulkBar<EditorRow>({
    ctx,
    everything: () => editorStore.rows(),
    shown: () => shown,
    rowId: (row) => row.id,
    actions: [
      {
        id: 'setActive',
        label: 'externalEditor.action.setActive',
        icon: 'check',
        disabledReason: (rows) => {
          if (rows.length !== 1) {
            return ctx.t(
              'externalEditor.bulk.oneOnly',
              'Exactly one editor can be the active one. Select a single row.'
            );
          }
          const row = rows[0];
          if (!row || row.launchId === null) {
            return ctx.t(
              'externalEditor.bulk.notStartable',
              'That editor cannot be started from this application, so it cannot be the active one.'
            );
          }
          return null;
        },
        run: (rows) => {
          const row = rows[0];
          if (!row) return;
          editorStore.setActive(row.id);
          void ctx.history.record('Chose the active external editor', 'external-editor', {
            id: row.id,
            name: row.name
          });
          const message = ctx.t('externalEditor.notify.activeSet', '{name} is now the active editor.', {
            values: { name: row.name }
          });
          ctx.notify.success(ctx.t('externalEditor.title', 'External editor', { dialog: true }), message);
          ctx.a11y.announce(message);
        }
      },
      {
        id: 'copy',
        label: 'externalEditor.action.copyPaths',
        icon: 'copy',
        disabledReason: (rows) =>
          rows.length === 0
            ? ctx.t('externalEditor.bulk.nothingSelected', 'Nothing is selected.')
            : null,
        run: async (rows) => {
          const text = rows.map((row) => `${row.name}\t${row.command}`).join('\n');
          const title = ctx.t('externalEditor.title', 'External editor', { dialog: true });
          try {
            await navigator.clipboard.writeText(text);
            ctx.notify.success(
              title,
              ctx.t('externalEditor.notify.copied', '{count} executable paths were copied to the clipboard.', {
                values: { count: String(rows.length) }
              })
            );
          } catch (error) {
            ctx.notify.error(
              title,
              ctx.t('externalEditor.notify.copyFailed', 'The clipboard refused the copy: {message}', {
                values: { message: error instanceof Error ? error.message : String(error) }
              })
            );
          }
        }
      },
      {
        id: 'export',
        label: 'externalEditor.action.export',
        icon: 'download',
        disabledReason: (rows) =>
          rows.length === 0
            ? ctx.t('externalEditor.bulk.nothingSelected', 'Nothing is selected.')
            : null,
        run: (rows, anchor) => {
          openExportMenu(
            ctx,
            anchor,
            rows.map((row) => editorRecord(ctx, row)),
            'external-editors'
          );
        }
      },
      {
        id: 'remove',
        label: 'externalEditor.action.remove',
        icon: 'trash',
        danger: true,
        disabledReason: (rows) => {
          if (rows.length === 0) {
            return ctx.t('externalEditor.bulk.nothingSelected', 'Nothing is selected.');
          }
          const detected = rows.filter((row) => row.origin === 'detected');
          if (detected.length === rows.length) {
            return ctx.t(
              'externalEditor.bulk.detectedOnly',
              'Detected editors are found on the machine, not stored here, so there is nothing to remove.'
            );
          }
          return null;
        },
        run: async (rows, anchor) => {
          const removable = rows.filter((row) => row.origin === 'added');
          const skipped = rows.length - removable.length;
          const approved = await ctx.confirm.request({
            anchor,
            action: ctx.t('externalEditor.confirm.removeAction', 'Remove {count} added editors', {
              values: { count: String(removable.length) }
            }),
            affected: removable.map((row) => `${row.name} — ${row.command}`),
            irreversible: ctx.t(
              'externalEditor.confirm.removeIrreversible',
              'These entries are deleted from this application. The editors themselves are not touched and stay installed; adding one again means browsing for its executable again.'
            )
          });
          if (!approved) return;
          const outcome = editorStore.removeCustom(removable.map((row) => row.id));
          void ctx.history.record('Removed added external editors', 'external-editor', {
            removed: outcome.removed.map((editor) => ({ name: editor.name, command: editor.command }))
          });
          const message =
            skipped === 0
              ? ctx.t('externalEditor.notify.removed', '{count} added editors were removed.', {
                  values: { count: String(outcome.removed.length) }
                })
              : ctx.t(
                  'externalEditor.notify.removedPartial',
                  '{count} added editors were removed. {skipped} detected editors were left alone, because they are found on the machine rather than stored here.',
                  { values: { count: String(outcome.removed.length), skipped: String(skipped) } }
                );
          ctx.notify.success(ctx.t('externalEditor.title', 'External editor', { dialog: true }), message);
          ctx.a11y.announce(message);
          table.clearSelection();
          refresh();
        }
      }
    ]
  });

  const activeButton = (row: EditorRow): HTMLElement => {
    const isActive = editorStore.activeId() === row.id;
    const startable = row.launchId !== null;
    const node = ctx.components.iconButton({
      icon: isActive ? 'check' : 'play',
      label: isActive
        ? ctx.t('externalEditor.action.isActive', 'Active editor: {name}', { values: { name: row.name } })
        : ctx.t('externalEditor.action.makeActive', 'Use {name} for every handoff', {
            values: { name: row.name }
          }),
      variant: isActive ? 'filled' : 'standard',
      toggled: isActive,
      disabled: !startable,
      disabledReason: ctx.t(
        'externalEditor.bulk.notStartable',
        'That editor cannot be started from this application, so it cannot be the active one.'
      ),
      onClick: () => {
        editorStore.setActive(isActive ? AUTOMATIC : row.id);
        void ctx.history.record('Chose the active external editor', 'external-editor', {
          id: isActive ? AUTOMATIC : row.id,
          name: isActive ? 'automatic' : row.name
        });
      }
    });
    node.setAttribute('aria-pressed', String(isActive));
    return node;
  };

  const table: DataTableHandle<EditorRow> = ctx.components.dataTable<EditorRow>({
    label: 'externalEditor.list.title',
    selectable: true,
    onSelectionChange: (ids) => bar.onSelectionChange(ids),
    emptyMessage: 'externalEditor.list.empty',
    rowId: (row) => row.id,
    columns: [
      {
        id: 'active',
        label: 'externalEditor.column.active',
        render: (row) => activeButton(row)
      },
      { id: 'name', label: 'externalEditor.column.name', sortable: true, value: (row) => row.name },
      {
        id: 'origin',
        label: 'externalEditor.column.origin',
        sortable: true,
        value: (row) => originLabel(ctx, row)
      },
      {
        id: 'status',
        label: 'externalEditor.column.status',
        sortable: true,
        value: (row) => statusLabel(ctx, row)
      },
      {
        id: 'folder',
        label: 'externalEditor.column.folder',
        sortable: true,
        value: (row) => folderLabel(ctx, row)
      },
      {
        id: 'command',
        label: 'externalEditor.column.command',
        sortable: true,
        value: (row) => row.command
      }
    ],
    rows: []
  });

  const search = ctx.createSearchBar({
    label: 'externalEditor.list.search',
    sample: editorStore
      .rows()
      .map((row) => `${row.name} ${row.command}`)
      .join('\n'),
    onChange: () => refresh()
  });

  root.append(search.root, bar.root, table.root);
  bar.attach(table);

  function haystack(row: EditorRow): string {
    return [row.name, row.command, originLabel(ctx, row), statusLabel(ctx, row)].join(' ');
  }

  function refresh(): void {
    const query = search.query();
    const all = editorStore.rows();
    shown = all.filter((row) => query.matches(haystack(row)));
    table.setRows(shown);
    bar.refresh();

    if (editorStore.isProbing()) {
      probeStatus.textContent = ctx.t('externalEditor.probe.running', 'Checking this machine for editors…');
      return;
    }
    const probeError = editorStore.lastProbeError();
    if (probeError !== null) {
      probeStatus.textContent = ctx.t(
        'externalEditor.probe.failed',
        'The machine could not be checked: {message}. Only editors you added yourself are listed.',
        { values: { message: probeError } }
      );
      return;
    }
    if (!editorStore.hasProbed()) {
      probeStatus.textContent = ctx.t(
        'externalEditor.probe.never',
        'This machine has not been checked yet. Choose Re-check to look for installed editors.'
      );
      return;
    }
    const usable = editorStore.usable().length;
    probeStatus.textContent =
      usable === 0
        ? ctx.t(
            'externalEditor.probe.noneUsable',
            'This machine was checked and no editor this application can start was found.'
          )
        : ctx.t('externalEditor.probe.done', '{usable} of {total} known editors can be started from here.', {
            values: { usable: String(usable), total: String(all.length) }
          });
  }

  refresh();

  return {
    root,
    refresh,
    destroy: () => search.destroy()
  };
}

/**
 * The export menu, shared by both lists.
 *
 * Every format the application supports is offered rather than one favourite,
 * and the preflight runs before anything is written so the user is told which
 * fields the chosen format cannot carry while there is still time to pick a
 * different one.
 */
export function openExportMenu(
  ctx: TabContext,
  anchor: HTMLElement,
  records: Array<Record<string, unknown>>,
  name: string
): void {
  ctx.components.menu({
    anchor,
    label: 'externalEditor.action.export',
    items: ctx.exporter.formats().map((format: ExportFormat) => ({
      id: `format-${format}`,
      label: format.toUpperCase(),
      icon: 'download',
      run: async () => {
        const preflight = ctx.exporter.preflight(records, format);
        const title = ctx.t('externalEditor.title', 'External editor', { dialog: true });
        if (preflight.losses.length > 0) {
          const proceed = await ctx.components.dialog({
            title: ctx.t('externalEditor.export.lossTitle', 'This format cannot carry every field', {
              dialog: true
            }),
            body: ctx.t(
              'externalEditor.export.lossBody',
              '{format} would drop or flatten: {fields}. Everything else is written exactly as shown.',
              {
                dialog: true,
                values: {
                  format: format.toUpperCase(),
                  fields: preflight.losses.map((loss) => `${loss.field} (${loss.reason})`).join('; ')
                }
              }
            ),
            confirmLabel: ctx.t('externalEditor.export.proceed', 'Write it anyway'),
            cancelLabel: ctx.t('externalEditor.export.cancel', 'Choose another format')
          });
          if (!proceed) return;
        }
        const path = await ctx.exporter.save(records, format, {
          name,
          defaultFileName: `${name}.${format}`
        });
        if (path === null) return;
        ctx.notify.success(
          title,
          ctx.t('externalEditor.notify.exported', '{count} rows were written to {path}.', {
            values: { count: String(records.length), path }
          })
        );
        void ctx.history.record('Exported external editor records', 'external-editor', {
          format,
          count: records.length,
          path
        });
      }
    }))
  });
}
