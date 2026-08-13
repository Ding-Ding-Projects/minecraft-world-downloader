/**
 * The schedule tab.
 *
 * Three questions, answered in order and without scrolling for any of them: what
 * is in effect right now, what rules exist, and what went wrong. The middle one
 * is a real list — multi-select with shift ranges, a select-all that says out
 * loud whether it means the rules on screen or every stored rule, an inverse
 * selection, and every action available in bulk with a reviewable preview before
 * anything runs.
 */

import { describeTimezone, describeWindow, matchesAt, nextBoundary } from './evaluate';
import { openRuleEditor } from './editor';
import type { ScheduleEngine } from './engine';
import type { ScheduleRule } from './schema';
import { displayValue, el, explanation } from './dom';
import type { AppContext, ExportFormat, SearchQuery, TabContext } from '../../core/registry';
import { ENABLED_SETTING_ID } from './engine';

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return iso;
  }
}

export function mountSchedulePanel(host: HTMLElement, ctx: TabContext, engine: ScheduleEngine): void {
  const t = (key: string, fallback: string, values?: Record<string, string | number>): string =>
    ctx.t(key, fallback, values ? { values } : undefined);

  host.classList.add('schedule-panel');

  /* ---------------- heading ---------------- */

  host.append(
    ctx.components.sectionHeading({
      title: 'schedule.heading.title',
      description: 'schedule.heading.description'
    })
  );

  const zone = describeTimezone();
  host.append(
    el('p', {
      className: 'md-typescale-body-small schedule-panel__zone',
      attrs: { id: 'schedule-timezone' },
      text: `${t('schedule.timezone.label', 'Times are read in your local timezone')}: ${zone.zone} (${zone.offsetLabel}). ${
        zone.observesDaylightSaving
          ? t(
              'schedule.timezone.dst',
              'This zone changes its offset for daylight saving. A wall-clock time that the local clock skips in spring never matches, and a time the clock repeats in autumn matches on both passes.'
            )
          : t('schedule.timezone.noDst', 'This zone keeps one offset all year, so no daylight-saving edge case applies.')
      }`
    })
  );

  /* ---------------- runtime strip ---------------- */

  const strip = el('div', { className: 'schedule-strip', attrs: { id: 'schedule-runtime' } });
  const masterSwitch = ctx.components.switchControl({
    label: 'schedule.setting.enabled',
    checked: ctx.settings.get<boolean>(ENABLED_SETTING_ID, true) !== false,
    onChange: (checked) => {
      ctx.settings.set(ENABLED_SETTING_ID, checked);
    },
    id: 'schedule-enabled'
  });
  const tickLine = el('span', { className: 'md-typescale-body-small', attrs: { 'aria-live': 'polite' } });
  const refreshAll = ctx.components.button({
    label: 'schedule.action.refreshAll',
    variant: 'outlined',
    icon: 'refresh',
    onClick: () => {
      void engine.refreshAll();
    }
  });
  const releaseAll = ctx.components.button({
    label: 'schedule.action.releaseAll',
    variant: 'outlined',
    icon: 'stop',
    onClick: () => {
      engine.releaseAll(t('schedule.action.releaseAll', 'Release every override now'));
    }
  });
  strip.append(masterSwitch.root, tickLine, refreshAll, releaseAll);
  host.append(strip);

  /* ---------------- active overrides ---------------- */

  const active = el('section', { className: 'schedule-active', attrs: { id: 'schedule-active' } });
  host.append(active);

  /* ---------------- toolbar ---------------- */

  const toolbar = el('div', { className: 'schedule-toolbar' });
  let query: SearchQuery | null = null;
  const search = ctx.createSearchBar({
    label: 'schedule.search.label',
    placeholder: 'schedule.search.placeholder',
    sample: 'evening theme appearance.themeMode',
    onChange: (next) => {
      query = next;
      draw();
    },
    onEscape: () => {
      query = null;
      draw();
    }
  });
  const newRule = ctx.components.button({
    label: 'schedule.action.new',
    variant: 'filled',
    icon: 'add',
    id: 'schedule-new-rule',
    onClick: () => {
      openRuleEditor({
        ctx,
        engine,
        anchor: newRule,
        existing: null,
        onSaved: () => draw()
      });
    }
  });
  toolbar.append(search.root, newRule);
  host.append(toolbar);

  /* ---------------- selection ---------------- */

  const selected = new Set<string>();
  let anchorIndex: number | null = null;

  const selectionBar = el('div', {
    className: 'schedule-selection',
    attrs: { role: 'region', 'aria-label': t('schedule.selection.count', '{selected} of {total} rules selected', { selected: 0, total: 0 }) }
  });
  host.append(
    explanation(
      t('schedule.column.priority', 'Priority'),
      t(
        'schedule.editor.priorityHint',
        '0 to 999. When two rules set the same setting at the same moment, the higher priority wins; equal priorities are settled by position in the list, where further down wins.'
      )
    )
  );
  host.append(selectionBar);

  const tableWrap = el('div', { className: 'md-table-wrap schedule-table-wrap', attrs: { id: 'schedule-rules' } });
  host.append(tableWrap);

  const quarantine = el('section', { className: 'schedule-quarantine', attrs: { id: 'schedule-quarantine' } });
  host.append(quarantine);

  /* ---------------- helpers ---------------- */

  const visibleRules = (): ScheduleRule[] => {
    const rules = engine.rules();
    if (!query || query.text.trim() === '') return rules;
    return rules.filter((rule) => {
      const haystack = [
        rule.label,
        rule.id,
        rule.source.kind,
        describeWindow(rule),
        ...rule.assignments.map((entry) => `${entry.settingId}=${displayValue(entry.value)}`),
        rule.source.kind === 'https-api' ? rule.source.url : '',
        rule.source.kind === 'home-assistant' ? `${rule.source.baseUrl} ${rule.source.entityId}` : ''
      ].join(' ');
      return query!.matches(haystack);
    });
  };

  const stateLabel = (rule: ScheduleRule): { text: string; severity: 'info' | 'success' | 'warning' | 'error' } => {
    if (!rule.enabled) return { text: t('schedule.state.disabled', 'Off'), severity: 'info' };
    const status = engine.statusFor(rule);
    const inWindow = matchesAt(rule, new Date());
    if (!inWindow) {
      return { text: t('schedule.state.outsideWindow', 'Outside its window'), severity: 'info' };
    }
    if (rule.source.kind === 'local') {
      return { text: t('schedule.state.inWindow', 'In its window'), severity: 'success' };
    }
    const severity =
      status.state === 'ok'
        ? 'success'
        : status.state === 'gate-closed' || status.state === 'never-run' || status.state === 'running'
          ? 'info'
          : status.state === 'stale' || status.state === 'rate-limited' || status.state === 'offline'
            ? 'warning'
            : 'error';
    return { text: t(`schedule.state.${status.state}`, status.state), severity };
  };

  /* ---------------- preview and bulk ---------------- */

  const preview = async (action: string, rules: ScheduleRule[], skipped: string[]): Promise<boolean> => {
    const bodyNode = el('div');
    bodyNode.append(
      el('p', {
        className: 'md-typescale-body-medium',
        text: t('schedule.bulk.previewBody', '{action} will affect these {count} rule(s):', {
          action,
          count: rules.length
        })
      })
    );
    const list = el('ul', { className: 'schedule-preview__list' });
    for (const rule of rules) {
      list.append(
        el('li', {
          className: 'md-typescale-body-small',
          text: `${rule.label} — ${describeWindow(rule)} — ${rule.assignments.length} setting(s)`
        })
      );
    }
    bodyNode.append(list);
    if (skipped.length > 0) {
      bodyNode.append(
        el('p', {
          className: 'md-typescale-body-small',
          text: t('schedule.bulk.skipped', '{count} selected rule(s) were skipped: {reason}', {
            count: skipped.length,
            reason: skipped.join('; ')
          })
        })
      );
    }
    return ctx.components.dialog({
      title: t('schedule.bulk.previewTitle', 'Review before this runs'),
      body: bodyNode,
      confirmLabel: action
    });
  };

  const selectedRules = (): ScheduleRule[] => engine.rules().filter((rule) => selected.has(rule.id));

  const runBulkEnable = async (enabled: boolean): Promise<void> => {
    const chosen = selectedRules();
    const changing = chosen.filter((rule) => rule.enabled !== enabled);
    const skipped = chosen.length - changing.length;
    if (changing.length === 0) {
      ctx.notify.info(
        t('schedule.bulk.previewTitle', 'Review before this runs'),
        `Every selected rule is already ${enabled ? 'on' : 'off'}, so nothing changed.`
      );
      return;
    }
    const ok = await preview(
      enabled ? t('schedule.action.enable', 'Enable') : t('schedule.action.disable', 'Disable'),
      changing,
      skipped > 0 ? [`${skipped} already ${enabled ? 'on' : 'off'}`] : []
    );
    if (!ok) return;
    engine.setEnabled(changing.map((rule) => rule.id), enabled);
    draw();
  };

  const runBulkDuplicate = async (): Promise<void> => {
    const chosen = selectedRules();
    if (chosen.length === 0) return;
    const ok = await preview(t('schedule.action.duplicate', 'Duplicate'), chosen, []);
    if (!ok) return;
    const copies = engine.duplicateRules(chosen.map((rule) => rule.id));
    if (copies.length < chosen.length) {
      ctx.notify.warn(
        t('schedule.action.duplicate', 'Duplicate'),
        `${copies.length} of ${chosen.length} rule(s) were copied; the rest would have passed the stored-rule limit.`
      );
    }
    draw();
  };

  const runBulkDelete = async (): Promise<void> => {
    const chosen = selectedRules();
    if (chosen.length === 0) return;
    const confirmed = await ctx.confirm.request({
      action: t('schedule.confirm.deleteRules', 'Delete {count} schedule rule(s)', { count: chosen.length }),
      affected: chosen.map((rule) => `${rule.label} — ${describeWindow(rule)}`),
      irreversible: t(
        'schedule.confirm.deleteIrreversible',
        'The rules are removed from the schedule and any Home Assistant token stored for them is deleted from the credential vault. Settings a rule was holding are handed back to their base values first. The deletion is recorded in the local version history, which is the only place a copy remains.'
      ),
      anchor: selectionBar,
      confirmLabel: t('schedule.action.delete', 'Delete')
    });
    if (!confirmed) return;
    engine.deleteRules(chosen.map((rule) => rule.id));
    selected.clear();
    draw();
  };

  const runBulkExport = async (): Promise<void> => {
    const chosen = selectedRules();
    const records = engine
      .exportRecords()
      .filter((record) => chosen.length === 0 || chosen.some((rule) => rule.id === record.id));
    if (records.length === 0) {
      ctx.notify.info(t('schedule.action.export', 'Export'), 'There is nothing selected to export.');
      return;
    }
    const bodyNode = el('div');
    let format: ExportFormat = 'json';
    const losses = el('p', { className: 'md-typescale-body-small', attrs: { 'aria-live': 'polite' } });
    const describeLosses = (): void => {
      const preflight = ctx.exporter.preflight(records, format);
      losses.textContent =
        preflight.losses.length === 0
          ? `${records.length} rule(s) will be written as ${format}. Home Assistant tokens are not included: they live in the credential vault and never in a file this application writes.`
          : `${records.length} rule(s) will be written as ${format}. These fields cannot be carried faithfully: ${preflight.losses
              .map((loss) => `${loss.field} (${loss.reason})`)
              .join('; ')}. Home Assistant tokens are not included either.`;
    };
    const picker = ctx.components.select({
      label: 'schedule.action.export',
      options: ctx.exporter.formats().map((value) => ({ value, label: value })),
      value: format,
      onChange: (value) => {
        format = value as ExportFormat;
        describeLosses();
      }
    });
    describeLosses();
    bodyNode.append(picker.root, losses);
    const ok = await ctx.components.dialog({
      title: t('schedule.action.export', 'Export'),
      body: bodyNode,
      confirmLabel: t('schedule.action.export', 'Export')
    });
    if (!ok) return;
    const path = await ctx.exporter.save(records, format, {
      name: 'schedule-rules',
      schemaVersion: '1',
      defaultFileName: `schedule-rules.${format}`
    });
    if (!path) return;
    ctx.notify.success(
      t('schedule.notify.exported.title', 'Schedule exported'),
      t(
        'schedule.notify.exported.body',
        'Written to {path}. Home Assistant tokens were left out, because they live in the credential vault and never in a file this application writes.',
        { path }
      )
    );
  };

  /* ---------------- drawing ---------------- */

  const drawSelectionBar = (shown: ScheduleRule[]): void => {
    selectionBar.textContent = '';
    const total = engine.rules().length;
    const count = selected.size;
    selectionBar.setAttribute(
      'aria-label',
      t('schedule.selection.count', '{selected} of {total} rules selected', { selected: count, total })
    );
    selectionBar.append(
      el('span', {
        className: 'md-typescale-label-large',
        text: t('schedule.selection.count', '{selected} of {total} rules selected', { selected: count, total })
      })
    );

    const selectShown = ctx.components.button({
      label: 'schedule.action.selectMatches',
      variant: 'text',
      onClick: () => {
        for (const rule of shown) selected.add(rule.id);
        draw();
      }
    });
    const selectEvery = ctx.components.button({
      label: 'schedule.action.selectAll',
      variant: 'text',
      onClick: () => {
        for (const rule of engine.rules()) selected.add(rule.id);
        draw();
      }
    });
    const invert = ctx.components.button({
      label: 'schedule.action.invertSelection',
      variant: 'text',
      onClick: () => {
        for (const rule of shown) {
          if (selected.has(rule.id)) selected.delete(rule.id);
          else selected.add(rule.id);
        }
        draw();
      }
    });
    const clear = ctx.components.button({
      label: 'schedule.action.clearSelection',
      variant: 'text',
      disabled: count === 0,
      disabledReason: 'Nothing is selected yet.',
      onClick: () => {
        selected.clear();
        anchorIndex = null;
        draw();
      }
    });
    selectionBar.append(selectShown, selectEvery, invert, clear);

    selectionBar.append(
      el('span', {
        className: 'md-typescale-body-small schedule-selection__scope',
        text: t(
          'schedule.selection.scope',
          'Select all here selects the {shown} rules the current search shows, not all {total} stored rules.',
          { shown: shown.length, total }
        )
      })
    );

    const disabledReason = 'Select at least one rule first.';
    const bulk = el('div', { className: 'schedule-selection__actions' });
    bulk.append(
      ctx.components.button({
        label: 'schedule.action.enable',
        variant: 'tonal',
        disabled: count === 0,
        disabledReason,
        onClick: () => void runBulkEnable(true)
      }),
      ctx.components.button({
        label: 'schedule.action.disable',
        variant: 'tonal',
        disabled: count === 0,
        disabledReason,
        onClick: () => void runBulkEnable(false)
      }),
      ctx.components.button({
        label: 'schedule.action.duplicate',
        variant: 'tonal',
        disabled: count === 0,
        disabledReason,
        onClick: () => void runBulkDuplicate()
      }),
      ctx.components.button({
        label: 'schedule.action.export',
        variant: 'tonal',
        icon: 'download',
        onClick: () => void runBulkExport()
      }),
      ctx.components.button({
        label: 'schedule.action.delete',
        variant: 'outlined',
        danger: true,
        icon: 'trash',
        disabled: count === 0,
        disabledReason,
        onClick: () => void runBulkDelete()
      })
    );
    selectionBar.append(bulk);
  };

  const drawTable = (shown: ScheduleRule[]): void => {
    tableWrap.textContent = '';
    if (engine.rules().length === 0) {
      tableWrap.append(
        ctx.components.emptyState({
          title: 'schedule.empty.title',
          body: 'schedule.empty.body',
          action: {
            label: 'schedule.action.new',
            variant: 'filled',
            icon: 'add',
            onClick: () => {
              openRuleEditor({ ctx, engine, anchor: newRule, existing: null, onSaved: () => draw() });
            }
          }
        })
      );
      return;
    }
    if (shown.length === 0) {
      tableWrap.append(
        ctx.components.emptyState({
          title: 'schedule.empty.search',
          body: 'schedule.empty.body'
        })
      );
      return;
    }

    const table = el('table', {
      className: 'md-table',
      attrs: { 'aria-label': t('schedule.list.label', 'Schedule rules') }
    });
    const head = el('thead');
    const headRow = el('tr');
    headRow.append(el('th', { attrs: { scope: 'col' }, text: t('schedule.action.selectRow', 'Select this rule') }));
    for (const column of [
      'schedule.column.enabled',
      'schedule.column.name',
      'schedule.column.when',
      'schedule.column.source',
      'schedule.column.settings',
      'schedule.column.priority',
      'schedule.column.state',
      'schedule.column.actions'
    ]) {
      headRow.append(el('th', { attrs: { scope: 'col' }, text: ctx.t(column, column) }));
    }
    head.append(headRow);
    const tbody = el('tbody');

    shown.forEach((rule, index) => {
      const row = el('tr', { attrs: { 'data-rule-id': rule.id, 'data-selected': String(selected.has(rule.id)) } });

      /* selection cell: click, shift-click range, and a keyboard equivalent */
      const selectCell = el('td');
      const box = el('input', {
        className: 'schedule-select',
        attrs: {
          type: 'checkbox',
          'aria-label': `${t('schedule.action.selectRow', 'Select this rule')}: ${rule.label}`
        }
      });
      box.checked = selected.has(rule.id);
      const applyRange = (from: number, to: number, on: boolean): void => {
        const [low, high] = from <= to ? [from, to] : [to, from];
        for (let cursor = low; cursor <= high; cursor += 1) {
          const target = shown[cursor];
          if (!target) continue;
          if (on) selected.add(target.id);
          else selected.delete(target.id);
        }
      };
      const toggle = (on: boolean, extend: boolean): void => {
        if (extend && anchorIndex !== null) applyRange(anchorIndex, index, on);
        else {
          if (on) selected.add(rule.id);
          else selected.delete(rule.id);
          anchorIndex = index;
        }
        draw();
        const restored = tableWrap.querySelectorAll<HTMLInputElement>('.schedule-select')[index];
        if (restored) restored.focus();
      };
      box.addEventListener('click', (event) => {
        const mouse = event as MouseEvent;
        toggle(box.checked, mouse.shiftKey === true);
      });
      box.addEventListener('keydown', (event) => {
        const key = event as KeyboardEvent;
        if (!key.shiftKey) return;
        if (key.key !== 'ArrowUp' && key.key !== 'ArrowDown') return;
        // The keyboard equivalent of a shift-click range: hold shift and walk.
        key.preventDefault();
        const step = key.key === 'ArrowDown' ? 1 : -1;
        const next = Math.min(shown.length - 1, Math.max(0, index + step));
        if (anchorIndex === null) anchorIndex = index;
        applyRange(anchorIndex, next, true);
        draw();
        const restored = tableWrap.querySelectorAll<HTMLInputElement>('.schedule-select')[next];
        if (restored) restored.focus();
      });
      selectCell.append(box);
      row.append(selectCell);

      /* the live enabled switch: the real control, not a printout of it */
      const enabledCell = el('td');
      const enabledSwitch = ctx.components.switchControl({
        label: `${ctx.t('schedule.column.enabled', 'On')}: ${rule.label}`,
        checked: rule.enabled,
        onChange: (checked) => {
          engine.setEnabled([rule.id], checked);
          draw();
        }
      });
      enabledSwitch.root.querySelector('span')?.classList.add('md-visually-hidden');
      enabledCell.append(enabledSwitch.root);
      row.append(enabledCell);

      row.append(el('td', { className: 'schedule-cell-name', text: rule.label }));
      row.append(el('td', { className: 'md-typescale-body-small', text: describeWindow(rule) }));

      const sourceCell = el('td');
      sourceCell.append(
        el('span', {
          className: 'md-typescale-body-small',
          text:
            rule.source.kind === 'local'
              ? t('schedule.editor.source.local', 'This computer')
              : rule.source.kind === 'https-api'
                ? t('schedule.editor.source.api', 'HTTPS endpoint')
                : t('schedule.editor.source.ha', 'Home Assistant')
        })
      );
      if (rule.source.kind !== 'local') {
        const status = engine.statusFor(rule);
        sourceCell.append(
          el('span', {
            className: 'md-typescale-body-small schedule-cell-note',
            text: status.message
          })
        );
      }
      row.append(sourceCell);

      const settingsCell = el('td', { className: 'md-typescale-body-small' });
      settingsCell.textContent =
        rule.assignments.length === 0
          ? '—'
          : rule.assignments.map((entry) => `${entry.settingId} = ${displayValue(entry.value)}`).join(', ');
      row.append(settingsCell);

      /* the live priority stepper */
      const priorityCell = el('td');
      const priorityField = ctx.components.textField({
        label: `${ctx.t('schedule.column.priority', 'Priority')}: ${rule.label}`,
        type: 'number',
        value: String(rule.priority),
        min: 0,
        max: 999,
        step: 1,
        onCommit: (value) => {
          const numeric = Number(value);
          if (!Number.isFinite(numeric)) return;
          engine.saveRule(
            { ...rule, priority: Math.min(999, Math.max(0, Math.round(numeric))) },
            'Schedule rule priority changed'
          );
          draw();
        }
      });
      priorityField.root.querySelector('.md-field__label')?.classList.add('md-visually-hidden');
      priorityCell.append(priorityField.root);
      row.append(priorityCell);

      const state = stateLabel(rule);
      const stateCell = el('td');
      stateCell.append(ctx.components.badge({ label: state.text, severity: state.severity }));
      const boundary = rule.enabled ? nextBoundary(rule, new Date()) : null;
      if (boundary) {
        stateCell.append(
          el('span', {
            className: 'md-typescale-body-small schedule-cell-note',
            text: `Next change at ${boundary.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`
          })
        );
      }
      row.append(stateCell);

      const actionCell = el('td');
      const menuButton = ctx.components.iconButton({
        icon: 'more',
        label: `${t('schedule.action.rowMenu', 'Actions for this rule')}: ${rule.label}`,
        onClick: () => {
          ctx.components.menu({
            anchor: menuButton,
            label: t('schedule.action.rowMenu', 'Actions for this rule'),
            items: [
              {
                id: 'edit',
                label: t('schedule.action.edit', 'Edit'),
                icon: 'edit',
                run: () =>
                  openRuleEditor({ ctx, engine, anchor: menuButton, existing: rule, onSaved: () => draw() })
              },
              {
                id: 'refresh',
                label: t('schedule.action.refresh', 'Refresh now'),
                icon: 'refresh',
                disabled: rule.source.kind === 'local',
                disabledReason: 'This rule answers locally and has nothing to refresh.',
                run: () => void engine.refreshOne(rule.id).then(() => draw())
              },
              {
                id: 'duplicate',
                label: t('schedule.action.duplicate', 'Duplicate'),
                icon: 'copy',
                run: () => {
                  engine.duplicateRules([rule.id]);
                  draw();
                }
              },
              {
                id: 'delete',
                label: t('schedule.action.delete', 'Delete'),
                icon: 'trash',
                danger: true,
                separatorBefore: true,
                run: async () => {
                  const confirmed = await ctx.confirm.request({
                    action: t('schedule.confirm.deleteRules', 'Delete {count} schedule rule(s)', { count: 1 }),
                    affected: [`${rule.label} — ${describeWindow(rule)}`],
                    irreversible: t(
                      'schedule.confirm.deleteIrreversible',
                      'The rules are removed from the schedule and any Home Assistant token stored for them is deleted from the credential vault. Settings a rule was holding are handed back to their base values first. The deletion is recorded in the local version history, which is the only place a copy remains.'
                    ),
                    anchor: menuButton,
                    confirmLabel: t('schedule.action.delete', 'Delete')
                  });
                  if (!confirmed) return;
                  engine.deleteRules([rule.id]);
                  selected.delete(rule.id);
                  draw();
                }
              }
            ]
          });
        }
      });
      actionCell.append(menuButton);
      row.append(actionCell);

      row.addEventListener('dblclick', () =>
        openRuleEditor({ ctx, engine, anchor: menuButton, existing: rule, onSaved: () => draw() })
      );
      tbody.append(row);
    });

    table.append(head, tbody);
    tableWrap.append(table);
  };

  const drawActive = (): void => {
    active.textContent = '';
    const snapshot = engine.snapshot();
    active.append(
      el('h2', { className: 'md-typescale-title-medium', text: t('schedule.active.title', 'In effect right now') })
    );
    if (snapshot.overrides.length === 0) {
      active.append(
        el('p', {
          className: 'md-typescale-body-medium',
          text: t(
            'schedule.active.none',
            'No rule is holding a setting at the moment, so every setting shows its own base value.'
          )
        })
      );
    } else {
      const list = ctx.components.list({ label: t('schedule.active.title', 'In effect right now') });
      for (const override of snapshot.overrides) {
        const trailing = ctx.components.button({
          label: 'schedule.action.release',
          variant: 'text',
          onClick: () => {
            engine.releaseOne(override.settingId);
            draw();
          }
        });
        const supporting = [
          `${override.settingId} = ${displayValue(override.scheduledValue)}`,
          t('schedule.active.setBy', 'Set by "{rule}"', { rule: override.ruleLabel }),
          override.hadBaseValue
            ? t('schedule.active.baseValue', 'Base value: {value}', { value: displayValue(override.baseValue) })
            : t('schedule.active.baseMissing', 'No stored base value; the setting goes back to the application default {value}.', {
                value: displayValue(override.baseValue)
              }),
          override.overriddenBy.length > 0
            ? t('schedule.active.contested', 'Also claimed by: {rules}. The rule above wins because it has the higher priority, or sits further down the list.', {
                rules: override.overriddenBy.map((entry) => entry.ruleLabel).join(', ')
              })
            : ''
        ]
          .filter((line) => line !== '')
          .join(' · ');
        list.append(
          ctx.components.listItem({
            headline: override.label,
            supporting,
            trailing
          })
        );
      }
      active.append(list);
    }

    if (snapshot.suppressed.length > 0) {
      active.append(
        el('p', {
          className: 'md-typescale-body-small',
          text: t(
            'schedule.active.suppressed',
            'You changed these by hand while a rule held them, so the rule is leaving them alone until the schedule changes: {ids}',
            { ids: snapshot.suppressed.join(', ') }
          )
        })
      );
    }
  };

  const drawQuarantine = (): void => {
    quarantine.textContent = '';
    const snapshot = engine.snapshot();
    if (snapshot.refused) {
      quarantine.append(
        el('h2', { className: 'md-typescale-title-medium', text: t('schedule.notify.refused.title', 'The stored schedule was not read') }),
        el('p', { className: 'md-typescale-body-medium', text: snapshot.refused })
      );
    }
    if (snapshot.quarantined.length === 0) return;
    quarantine.append(
      el('h2', { className: 'md-typescale-title-medium', text: t('schedule.quarantine.title', 'Rules that were not loaded') }),
      el('p', {
        className: 'md-typescale-body-medium',
        text: t(
          'schedule.quarantine.body',
          'These rules are still stored exactly as they are. None of them is running, and none of them was deleted.'
        )
      })
    );
    const list = ctx.components.list({ label: t('schedule.quarantine.title', 'Rules that were not loaded') });
    for (const entry of snapshot.quarantined) {
      list.append(ctx.components.listItem({ headline: entry.label, supporting: entry.reason }));
    }
    quarantine.append(list);
  };

  let drawing = false;
  let lastRenderKey = '';

  /**
   * Rebuilding the table on a check that changed nothing would take focus out of
   * whatever the user was typing in, every thirty seconds. So the heartbeat line
   * always updates, and the rest is rebuilt only when something it shows has
   * actually moved.
   */
  const renderKey = (shown: ScheduleRule[]): string => {
    const snapshot = engine.snapshot();
    return JSON.stringify([
      snapshot.enabled,
      shown.map((rule) => [rule.id, rule.updatedAt, rule.enabled, rule.priority, stateLabel(rule).text]),
      snapshot.overrides.map((entry) => [entry.settingId, entry.ruleId, entry.scheduledValue]),
      snapshot.suppressed,
      snapshot.quarantined.length,
      snapshot.refused,
      [...selected].sort()
    ]);
  };

  function draw(): void {
    if (drawing) return;
    drawing = true;
    try {
      const shown = visibleRules();
      const snapshot = engine.snapshot();
      masterSwitch.set(snapshot.enabled);
      tickLine.textContent = `Last check ${formatTime(snapshot.lastTickAt)} · ${snapshot.activeRuleIds.length} rule(s) inside their window · ${snapshot.overrides.length} setting(s) held`;
      const key = renderKey(shown);
      if (key === lastRenderKey && tableWrap.childElementCount > 0) return;
      lastRenderKey = key;
      drawActive();
      drawSelectionBar(shown);
      drawTable(shown);
      drawQuarantine();
    } finally {
      drawing = false;
    }
  }

  const stop = engine.onChange(() => draw());
  ctx.onDispose(() => {
    stop();
    search.destroy();
  });

  draw();
}

/**
 * The compact live summary the settings surface renders for the rules control.
 *
 * The settings surface rebuilds its controls wholesale rather than disposing them
 * one by one, so the subscription releases itself the first time it notices its
 * host has left the document. A listener that outlives its element is a leak that
 * grows every time somebody opens settings.
 */
export function mountScheduleSummary(host: HTMLElement, ctx: AppContext, engine: ScheduleEngine): void {
  const line = el('p', { className: 'md-typescale-body-medium', attrs: { 'aria-live': 'polite' } });
  const provenance = el('p', { className: 'md-typescale-body-small schedule-provenance' });
  const open = ctx.components.button({
    label: 'schedule.setting.openEditor',
    variant: 'tonal',
    icon: 'calendar',
    onClick: () => ctx.tabs.teleport('scheduled-settings.schedule', 'schedule-rules')
  });

  let stop: (() => void) | null = null;
  const paint = (): void => {
    if (!host.isConnected && stop) {
      stop();
      stop = null;
      return;
    }
    const snapshot = engine.snapshot();
    line.textContent = `${snapshot.document.rules.length} rule(s) stored · ${snapshot.activeRuleIds.length} inside their window · ${snapshot.overrides.length} setting(s) currently held by the schedule.`;
    const stored = ctx.settings.has('schedule.rules');
    provenance.textContent = stored
      ? `Stored in ${ctx.settings.filePath() || 'the settings file'} · schema 1 · last written ${formatTime(snapshot.document.updatedAt)}.`
      : 'No schedule has been written yet, so the application is using its own compiled-in value of no rules at all.';
  };
  paint();
  host.append(line, provenance, open);
  stop = engine.onChange(paint);
}
