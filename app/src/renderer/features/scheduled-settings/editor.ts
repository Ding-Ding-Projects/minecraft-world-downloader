/**
 * The rule editor.
 *
 * It opens as a non-modal overlay anchored beside whatever opened it, drags by
 * its header, resizes from its edges, remembers both across restarts and returns
 * focus to its anchor on close — the same contract every other overlay in this
 * application keeps.
 *
 * Two things it deliberately does not do. It does not invent a value for a field
 * the user left empty, because a rule that silently acquired midnight-to-midnight
 * would run all day and nobody asked it to. And it does not save a rule it cannot
 * validate: every problem is named beside the field that has it.
 */

import { describeTimezone, describeWindow, weekdayNames, windowShape } from './evaluate';
import { LIMITS, checkEntityId, checkUrl, newRuleId, vaultAccountFor } from './schema';
import type { Assignment, ScheduleRule } from './schema';
import type { ScheduleEngine } from './engine';
import { displayValue, el, explanation, group, nativeField } from './dom';
import type { AppContext, SettingControl, SettingOption } from '../../core/registry';

interface EditorOptions {
  ctx: AppContext;
  engine: ScheduleEngine;
  anchor: HTMLElement;
  /** Null for a new rule. */
  existing: ScheduleRule | null;
  onSaved(rule: ScheduleRule): void;
}

function defaultRule(): ScheduleRule {
  const id = newRuleId();
  const now = new Date().toISOString();
  return {
    id,
    label: '',
    enabled: true,
    priority: 100,
    startDate: null,
    endDate: null,
    startTime: '22:00',
    endTime: '06:30',
    everyDay: true,
    weekdays: [0, 1, 2, 3, 4, 5, 6],
    source: { kind: 'local' },
    assignments: [],
    createdAt: now,
    updatedAt: now
  };
}

export function openRuleEditor(options: EditorOptions): void {
  const { ctx, engine, anchor, existing } = options;
  const t = (key: string, fallback: string, values?: Record<string, string | number>): string =>
    ctx.t(key, fallback, values ? { values } : undefined);

  // A working copy: nothing reaches the stored document until Save validates.
  const draft: ScheduleRule = existing
    ? { ...existing, weekdays: [...existing.weekdays], assignments: existing.assignments.map((a) => ({ ...a })), source: { ...existing.source } }
    : defaultRule();

  const handle = ctx.overlay.open({
    anchor,
    placement: 'bottom-start',
    role: 'dialog',
    label: existing ? t('schedule.editor.editTitle', 'Edit schedule rule') : t('schedule.editor.newTitle', 'New schedule rule'),
    lightDismiss: false,
    resizeKey: 'scheduled-settings.editor',
    dragKey: 'scheduled-settings.editor',
    onClose: () => {
      ctx.a11y.focusVisible(anchor);
    }
  });

  const body = handle.body;
  body.classList.add('schedule-editor');

  const problems = el('div', {
    className: 'schedule-editor__problems',
    attrs: { role: 'alert', 'aria-live': 'assertive', hidden: 'hidden' }
  });
  body.append(problems);

  const showProblems = (errors: Array<{ field: string; message: string }>): void => {
    problems.textContent = '';
    if (errors.length === 0) {
      problems.setAttribute('hidden', 'hidden');
      return;
    }
    problems.removeAttribute('hidden');
    problems.append(
      el('p', {
        className: 'md-typescale-body-medium',
        text: t('schedule.editor.problems', 'This rule was not saved. {count} field(s) need attention:', {
          count: errors.length
        })
      })
    );
    const list = el('ul', { className: 'schedule-editor__problem-list' });
    for (const error of errors) {
      list.append(el('li', { className: 'md-typescale-body-small', text: `${error.field}: ${error.message}` }));
    }
    problems.append(list);
  };

  /* ---------------- identity ---------------- */

  const identity = group(
    t('schedule.editor.newTitle', 'New schedule rule'),
    t('schedule.editor.nameHint', 'The name shown in the list and in the notification when the rule takes effect.')
  );
  identity.root.querySelector('.schedule-group__title')!.textContent = existing
    ? t('schedule.editor.editTitle', 'Edit schedule rule')
    : t('schedule.editor.newTitle', 'New schedule rule');

  const nameField = ctx.components.textField({
    label: 'schedule.editor.name',
    value: draft.label,
    onChange: (value) => {
      draft.label = value.slice(0, LIMITS.maxLabelLength);
    }
  });
  const enabledSwitch = ctx.components.switchControl({
    label: 'schedule.editor.enabled',
    checked: draft.enabled,
    onChange: (checked) => {
      draft.enabled = checked;
    }
  });
  const priorityField = ctx.components.textField({
    label: 'schedule.editor.priority',
    type: 'number',
    value: String(draft.priority),
    min: LIMITS.minPriority,
    max: LIMITS.maxPriority,
    step: 1,
    onCommit: (value) => {
      const numeric = Number(value);
      draft.priority = Number.isFinite(numeric)
        ? Math.min(LIMITS.maxPriority, Math.max(LIMITS.minPriority, Math.round(numeric)))
        : 100;
      priorityField.set(String(draft.priority));
    }
  });
  identity.body.append(
    nameField.root,
    enabledSwitch.root,
    priorityField.root,
    explanation(
      t('schedule.editor.priority', 'Priority'),
      t(
        'schedule.editor.priorityHint',
        '0 to 999. When two rules set the same setting at the same moment, the higher priority wins; equal priorities are settled by position in the list, where further down wins.'
      )
    )
  );
  body.append(identity.root);

  /* ---------------- when ---------------- */

  const when = group(t('schedule.column.when', 'When'));
  const zone = describeTimezone();
  const zoneLine = el('p', {
    className: 'md-typescale-body-small schedule-editor__zone',
    text: `${t('schedule.timezone.label', 'Times are read in your local timezone')}: ${zone.zone} (${zone.offsetLabel}). ${
      zone.observesDaylightSaving
        ? t(
            'schedule.timezone.dst',
            'This zone changes its offset for daylight saving. A wall-clock time that the local clock skips in spring never matches, and a time the clock repeats in autumn matches on both passes.'
          )
        : t('schedule.timezone.noDst', 'This zone keeps one offset all year, so no daylight-saving edge case applies.')
    }`
  });

  const summaryLine = el('p', { className: 'md-typescale-body-medium schedule-editor__summary', attrs: { 'aria-live': 'polite' } });
  const refreshSummary = (): void => {
    summaryLine.textContent = t('schedule.editor.summary', 'This rule holds: {summary}', {
      summary: describeWindow(draft)
    });
  };

  const startDate = nativeField({
    label: t('schedule.editor.startDate', 'Start date'),
    type: 'date',
    value: draft.startDate ?? '',
    onCommit: (value) => {
      draft.startDate = value === '' ? null : value;
      refreshSummary();
    }
  });
  const endDate = nativeField({
    label: t('schedule.editor.endDate', 'End date'),
    type: 'date',
    value: draft.endDate ?? '',
    onCommit: (value) => {
      draft.endDate = value === '' ? null : value;
      refreshSummary();
    }
  });
  const startTime = nativeField({
    label: t('schedule.editor.startTime', 'Start time'),
    type: 'time',
    value: draft.startTime,
    required: true,
    onCommit: (value) => {
      draft.startTime = value;
      refreshSummary();
    }
  });
  const endTime = nativeField({
    label: t('schedule.editor.endTime', 'End time'),
    type: 'time',
    value: draft.endTime,
    required: true,
    onCommit: (value) => {
      draft.endTime = value;
      refreshSummary();
    }
  });

  const dateRow = el('div', { className: 'schedule-row', children: [startDate.root, endDate.root] });
  const timeRow = el('div', { className: 'schedule-row', children: [startTime.root, endTime.root] });

  const weekdayGroup = el('div', {
    className: 'schedule-weekdays',
    attrs: { role: 'group', 'aria-label': t('schedule.editor.weekdays', 'Weekdays') }
  });
  const drawWeekdays = (): void => {
    weekdayGroup.textContent = '';
    for (const day of weekdayNames()) {
      const selected = draft.weekdays.includes(day.index);
      const node = ctx.components.chip({
        label: day.short,
        selected,
        onToggle: (on) => {
          const next = new Set(draft.weekdays);
          if (on) next.add(day.index);
          else next.delete(day.index);
          draft.weekdays = [...next].sort();
          refreshSummary();
        }
      });
      node.setAttribute('aria-label', day.long);
      node.setAttribute('title', day.long);
      weekdayGroup.append(node);
    }
  };
  drawWeekdays();

  const everyDaySwitch = ctx.components.switchControl({
    label: 'schedule.editor.everyDay',
    checked: draft.everyDay,
    onChange: (checked) => {
      draft.everyDay = checked;
      if (checked) draft.weekdays = [0, 1, 2, 3, 4, 5, 6];
      weekdayGroup.hidden = checked;
      drawWeekdays();
      refreshSummary();
    }
  });
  weekdayGroup.hidden = draft.everyDay;

  when.body.append(
    zoneLine,
    dateRow,
    explanation(
      t('schedule.editor.startDate', 'Start date'),
      t('schedule.editor.datesHint', 'Both dates are optional and both are inclusive. Leave them empty for a rule with no calendar bounds.')
    ),
    timeRow,
    explanation(
      t('schedule.editor.startTime', 'Start time'),
      t(
        'schedule.editor.timesHint',
        'The window is [start, end): it includes the start minute and excludes the end minute, so adjacent rules meet exactly without overlapping. An end earlier than the start crosses midnight. An end equal to the start means the whole day.'
      )
    ),
    everyDaySwitch.root,
    explanation(
      t('schedule.editor.everyDay', 'Every day'),
      `${t('schedule.editor.everyDayHint', 'Every day means all seven weekdays for the time window above — it is one rule, not seven.')} ${t('schedule.editor.weekdaysHint', 'For a window that crosses midnight, the weekday is the day the window starts on.')}`
    ),
    weekdayGroup,
    summaryLine
  );
  refreshSummary();
  body.append(when.root);

  /* ---------------- source ---------------- */

  const sourceGroup = group(t('schedule.editor.source', 'Where the answer comes from'));
  const sourceBody = el('div', { className: 'schedule-source' });

  const sourceOptions: SettingOption[] = [
    { value: 'local', label: 'schedule.editor.source.local' },
    { value: 'https-api', label: 'schedule.editor.source.api' },
    { value: 'home-assistant', label: 'schedule.editor.source.ha' }
  ];
  const sourcePicker = ctx.components.segmentedButton({
    label: 'schedule.editor.source',
    options: sourceOptions,
    value: draft.source.kind,
    onChange: (value) => {
      if (value === 'https-api') {
        draft.source = { kind: 'https-api', url: draft.source.kind === 'https-api' ? draft.source.url : '', refreshSeconds: 300 };
      } else if (value === 'home-assistant') {
        draft.source = {
          kind: 'home-assistant',
          baseUrl: draft.source.kind === 'home-assistant' ? draft.source.baseUrl : '',
          entityId: draft.source.kind === 'home-assistant' ? draft.source.entityId : '',
          refreshSeconds: 300,
          vaultAccount: vaultAccountFor(draft.id)
        };
      } else {
        draft.source = { kind: 'local' };
      }
      drawSource();
    }
  });

  const drawSource = (): void => {
    sourceBody.textContent = '';
    if (draft.source.kind === 'local') {
      sourceBody.append(
        el('p', {
          className: 'md-typescale-body-small',
          text: t('schedule.editor.source.localHint', 'The rule uses its own stored values and makes no network request at all.')
        })
      );
      return;
    }

    if (draft.source.kind === 'https-api') {
      const source = draft.source;
      const urlField = ctx.components.textField({
        label: 'schedule.editor.url',
        type: 'url',
        value: source.url,
        placeholder: 'https://example.org/schedule.json',
        supportingText: 'schedule.editor.urlHint',
        onCommit: (value) => {
          source.url = value.trim();
          const check = checkUrl(source.url);
          const support = urlField.root.querySelector('.md-field__support');
          if (support) {
            support.textContent = check.ok
              ? t('schedule.editor.urlHint', 'https only, except for a loopback address such as http://127.0.0.1:8000 during development. A username or password in the address is refused.')
              : check.error;
            support.classList.toggle('md-field__support--error', !check.ok);
          }
        }
      });
      sourceBody.append(
        urlField.root,
        el('p', {
          className: 'md-typescale-body-small',
          text: t(
            'schedule.editor.source.apiHint',
            'The endpoint answers with {"schemaVersion":1,"active":true,"settings":{…}}. A setting id the application does not have is refused rather than stored. Any setting can be driven this way, not only the language.'
          )
        }),
        refreshControl(source),
        testButton()
      );
      return;
    }

    const source = draft.source;
    const baseField = ctx.components.textField({
      label: 'schedule.editor.baseUrl',
      type: 'url',
      value: source.baseUrl,
      placeholder: 'https://home.example.org:8123',
      supportingText: 'schedule.editor.urlHint',
      onCommit: (value) => {
        source.baseUrl = value.trim().replace(/\/+$/, '');
        const check = checkUrl(source.baseUrl);
        const support = baseField.root.querySelector('.md-field__support');
        if (support) {
          support.textContent = check.ok ? '' : check.error;
          support.classList.toggle('md-field__support--error', !check.ok);
        }
      }
    });
    const entityField = ctx.components.textField({
      label: 'schedule.editor.entityId',
      value: source.entityId,
      placeholder: 'binary_sensor.evening',
      supportingText: 'schedule.editor.entityHint',
      onCommit: (value) => {
        source.entityId = value.trim();
        const check = checkEntityId(source.entityId);
        const support = entityField.root.querySelector('.md-field__support');
        if (support) {
          support.textContent = check.ok
            ? t('schedule.editor.entityHint', 'For example binary_sensor.evening or input_boolean.focus_mode.')
            : check.error;
          support.classList.toggle('md-field__support--error', !check.ok);
        }
      }
    });

    const tokenState = el('p', { className: 'md-typescale-body-small', attrs: { 'aria-live': 'polite' } });
    const account = source.vaultAccount || vaultAccountFor(draft.id);
    void ctx.studio.vault.has(account).then((result) => {
      tokenState.textContent = result.ok && result.value
        ? t('schedule.editor.tokenStored', 'A token is stored for this rule.')
        : t('schedule.editor.tokenMissing', 'No token is stored for this rule yet.');
    });

    const tokenField = nativeField({
      label: t('schedule.editor.token', 'Long-lived access token'),
      type: 'password',
      autocomplete: 'off',
      supporting: t(
        'schedule.editor.tokenHint',
        "Stored in the operating system credential vault under this rule's own account key. It is never written into the schedule, an export, the local history, a log or a screenshot, and it is never shown again after it is stored."
      )
    });

    const storeButton = ctx.components.button({
      label: 'schedule.editor.tokenStore',
      variant: 'tonal',
      icon: 'key',
      onClick: () => {
        const secret = tokenField.value();
        if (secret.trim() === '') {
          tokenField.setError('Paste the token before storing it.');
          return;
        }
        tokenField.clearError();
        void ctx.studio.vault.set(account, secret).then((result) => {
          // The field is cleared whatever happens, so the secret does not sit in
          // the DOM waiting to be photographed by a screenshot harness.
          tokenField.setValue('');
          if (!result.ok) {
            ctx.notify.error(t('schedule.notify.tokenFailed.title', 'The token was not stored'), result.error);
            tokenState.textContent = t('schedule.editor.tokenMissing', 'No token is stored for this rule yet.');
            return;
          }
          tokenState.textContent = t('schedule.editor.tokenStored', 'A token is stored for this rule.');
          ctx.notify.success(
            t('schedule.notify.tokenStored.title', 'Token stored'),
            t(
              'schedule.notify.tokenStored.body',
              'The token for "{label}" is in the operating system credential vault. It is not shown again and does not appear in any export.',
              { label: draft.label || draft.id }
            )
          );
          void ctx.history.record('Schedule rule token stored', 'features.scheduled-settings', {
            ruleId: draft.id,
            vaultAccount: account
          });
        });
      }
    });

    const removeButton = ctx.components.button({
      label: 'schedule.editor.tokenRemove',
      variant: 'text',
      onClick: () => {
        void ctx.studio.vault.delete(account).then(() => {
          tokenState.textContent = t('schedule.editor.tokenMissing', 'No token is stored for this rule yet.');
          void ctx.history.record('Schedule rule token removed', 'features.scheduled-settings', {
            ruleId: draft.id,
            vaultAccount: account
          });
        });
      }
    });

    sourceBody.append(
      baseField.root,
      entityField.root,
      el('p', {
        className: 'md-typescale-body-small',
        text: t(
          'schedule.editor.source.haHint',
          'A binary_sensor or input_boolean entity. "on" activates this rule so its own values apply; "off" leaves the base settings, or another matching rule, in effect.'
        )
      }),
      tokenField.root,
      el('div', { className: 'schedule-row schedule-row--actions', children: [storeButton, removeButton] }),
      tokenState,
      refreshControl(source),
      testButton()
    );
  };

  const refreshControl = (source: { refreshSeconds: number }): HTMLElement => {
    const handleSlider = ctx.components.slider({
      label: 'schedule.editor.refresh',
      min: LIMITS.minRefreshSeconds,
      max: 3600,
      step: 30,
      value: Math.min(3600, Math.max(LIMITS.minRefreshSeconds, source.refreshSeconds)),
      unit: 's',
      onChange: (value) => {
        source.refreshSeconds = Math.min(LIMITS.maxRefreshSeconds, Math.max(LIMITS.minRefreshSeconds, Math.round(value)));
      }
    });
    const wrap = el('div');
    wrap.append(
      handleSlider.root,
      explanation(
        t('schedule.editor.refresh', 'Refresh interval'),
        t(
          'schedule.editor.refreshHint',
          'Seconds between requests, with a floor of {min} so a rule can never become a hot loop. The source is also asked once the moment the window opens. After a failure the wait doubles, up to eight times this interval.',
          { min: LIMITS.minRefreshSeconds }
        )
      )
    );
    return wrap;
  };

  const testButton = (): HTMLElement => {
    const result = el('p', { className: 'md-typescale-body-small', attrs: { 'aria-live': 'polite' } });
    const button = ctx.components.button({
      label: 'schedule.editor.test',
      variant: 'outlined',
      icon: 'bolt',
      onClick: () => {
        // The test runs through the resolver the schedule itself uses, and does
        // not store the rule: pressing Test is not a hidden Save.
        const check =
          draft.source.kind === 'https-api'
            ? checkUrl(draft.source.url)
            : draft.source.kind === 'home-assistant'
              ? checkUrl(draft.source.baseUrl)
              : { ok: true, error: '' };
        if (!check.ok) {
          result.textContent = check.error;
          result.classList.add('md-field__support--error');
          return;
        }
        result.classList.remove('md-field__support--error');
        button.disabled = true;
        button.title = 'A test is already running for this source.';
        result.textContent = ctx.t('schedule.state.running', 'Asking');
        void engine
          .testRule(draft)
          .then((status) => {
            result.textContent = `${ctx.t(`schedule.state.${status.state}`, status.state)} — ${status.message}`;
            result.classList.toggle(
              'md-field__support--error',
              status.state !== 'ok' && status.state !== 'gate-closed' && status.state !== 'local'
            );
            ctx.a11y.announce(result.textContent, false);
          })
          .finally(() => {
            button.disabled = false;
            button.title = '';
          });
      }
    });
    const wrap = el('div');
    wrap.append(button, result);
    return wrap;
  };

  sourceGroup.body.append(sourcePicker.root, sourceBody);
  drawSource();
  body.append(sourceGroup.root);

  /* ---------------- assignments ---------------- */

  const assignmentsGroup = group(
    t('schedule.editor.assignments', 'Settings this rule changes'),
    t(
      'schedule.editor.assignmentsHint',
      "Every setting this application registers can be scheduled, apart from actions, custom controls and this feature's own keys. The value box below is the same control the settings surface uses, so it accepts exactly what that surface accepts."
    )
  );
  const assignmentList = el('div', { className: 'schedule-assignments', attrs: { role: 'list' } });

  const schedulable = (): SettingControl[] => engine.schedulableControls();

  const valueControlFor = (control: SettingControl, assignment: Assignment): HTMLElement => {
    const commit = (value: unknown): void => {
      assignment.value = value;
    };
    switch (control.kind) {
      case 'switch': {
        const handleSwitch = ctx.components.switchControl({
          label: control.label,
          checked: assignment.value === true,
          onChange: commit
        });
        return handleSwitch.root;
      }
      case 'slider': {
        const handleSlider = ctx.components.slider({
          label: control.label,
          min: control.min ?? 0,
          max: control.max ?? 100,
          step: control.step ?? 1,
          value: Number(assignment.value ?? control.defaultValue ?? 0),
          onChange: commit
        });
        return handleSlider.root;
      }
      case 'number': {
        const handleNumber = ctx.components.textField({
          label: control.label,
          type: 'number',
          value: String(assignment.value ?? ''),
          min: control.min,
          max: control.max,
          step: control.step,
          onCommit: (value) => commit(value === '' ? control.defaultValue : Number(value))
        });
        return handleNumber.root;
      }
      case 'select': {
        const handleSelect = ctx.components.select({
          label: control.label,
          options: control.options ?? [],
          value: String(assignment.value ?? control.defaultValue ?? ''),
          onChange: commit
        });
        return handleSelect.root;
      }
      case 'font': {
        const handleSelect = ctx.components.select({
          label: control.label,
          options: [{ value: '', label: 'Bundled default' }],
          value: String(assignment.value ?? ''),
          onChange: commit
        });
        // Populated from the fonts this machine genuinely has, so the picker never
        // offers a family that would silently be substituted.
        void ctx.theme.availableFonts().then((families) => {
          const options: SettingOption[] = [
            { value: '', label: 'Bundled default' },
            ...families.map((family) => ({ value: family, label: family }))
          ];
          const replacement = ctx.components.select({
            label: control.label,
            options,
            value: String(assignment.value ?? ''),
            onChange: commit
          });
          handleSelect.root.replaceWith(replacement.root);
        });
        return handleSelect.root;
      }
      case 'path':
      case 'file':
      case 'folder': {
        const handleText = ctx.components.textField({
          label: control.label,
          value: String(assignment.value ?? ''),
          browse: control.kind === 'folder' ? 'folder' : control.kind === 'file' ? 'file' : 'both',
          onCommit: commit
        });
        return handleText.root;
      }
      default: {
        const handleText = ctx.components.textField({
          label: control.label,
          value: String(assignment.value ?? ''),
          supportingText: control.hint,
          onCommit: commit
        });
        return handleText.root;
      }
    }
  };

  const drawAssignments = (): void => {
    assignmentList.textContent = '';
    if (draft.assignments.length === 0) {
      assignmentList.append(
        el('p', {
          className: 'md-typescale-body-small',
          text: t('schedule.editor.noAssignments', 'No settings yet. Choose one above; a rule with no settings would do nothing.')
        })
      );
      return;
    }
    const index = new Map(schedulable().map((control) => [control.id, control]));
    for (const assignment of draft.assignments) {
      const row = el('div', { className: 'schedule-assignment', attrs: { role: 'listitem' } });
      const control = index.get(assignment.settingId);
      const heading = el('div', { className: 'schedule-assignment__head' });
      heading.append(
        el('span', {
          className: 'md-typescale-label-large',
          text: control ? ctx.t(control.label, control.label) : assignment.settingId
        }),
        el('code', { className: 'schedule-assignment__id', text: assignment.settingId })
      );
      const remove = ctx.components.iconButton({
        icon: 'remove',
        label: t('schedule.editor.removeAssignment', 'Remove this setting from the rule'),
        onClick: () => {
          draft.assignments = draft.assignments.filter((entry) => entry !== assignment);
          drawAssignments();
        }
      });
      heading.append(remove);
      row.append(heading);
      if (control) {
        row.append(valueControlFor(control, assignment));
        row.append(
          el('p', {
            className: 'md-typescale-body-small schedule-assignment__base',
            text: `Application default: ${displayValue(control.defaultValue)}. Current value: ${displayValue(
              ctx.settings.get(control.id, control.defaultValue)
            )}.`
          })
        );
      } else {
        row.append(
          el('p', {
            className: 'md-typescale-body-small md-field__support--error',
            text: `No setting with the id ${assignment.settingId} is registered in this build, so this entry will not be applied.`
          })
        );
      }
      assignmentList.append(row);
    }
  };

  const buildPicker = (): HTMLElement => {
    const controls = schedulable();
    if (controls.length === 0) {
      return el('p', {
        className: 'md-typescale-body-small',
        text: t('schedule.editor.noSchedulable', 'No setting is available to schedule right now.')
      });
    }
    let chosen = controls[0].id;
    // A filterable select, so the picker carries its own filter field and the
    // anchored regular-expression builder like every other dropdown here.
    const picker = ctx.components.select({
      label: 'schedule.editor.addSetting',
      options: controls.map((control) => ({ value: control.id, label: `${ctx.t(control.label, control.label)} — ${control.id}` })),
      value: chosen,
      onChange: (value) => {
        chosen = value;
      }
    });
    const add = ctx.components.button({
      label: 'schedule.editor.add',
      variant: 'tonal',
      icon: 'add',
      onClick: () => {
        if (draft.assignments.length >= LIMITS.maxAssignmentsPerRule) {
          showProblems([
            { field: 'assignments', message: `A rule may set at most ${LIMITS.maxAssignmentsPerRule} settings.` }
          ]);
          return;
        }
        if (draft.assignments.some((entry) => entry.settingId === chosen)) {
          showProblems([{ field: 'assignments', message: `"${chosen}" is already in this rule.` }]);
          return;
        }
        const control = controls.find((candidate) => candidate.id === chosen);
        draft.assignments.push({
          settingId: chosen,
          // Seeded with the value the setting currently holds, so a new row is a
          // real starting point rather than an empty box the user has to guess at.
          value: ctx.settings.get(chosen, control?.defaultValue ?? null) ?? control?.defaultValue ?? null
        });
        showProblems([]);
        drawAssignments();
      }
    });
    return el('div', { className: 'schedule-row schedule-row--picker', children: [picker.root, add] });
  };

  assignmentsGroup.body.append(buildPicker(), assignmentList);
  drawAssignments();
  body.append(assignmentsGroup.root);

  /* ---------------- actions ---------------- */

  const actions = el('div', { className: 'schedule-editor__actions' });
  const cancel = ctx.components.button({
    label: 'schedule.action.cancel',
    variant: 'text',
    onClick: () => handle.close()
  });
  const save = ctx.components.button({
    label: 'schedule.action.save',
    variant: 'filled',
    icon: 'save',
    onClick: () => {
      const result = engine.saveRule(draft, existing ? 'Schedule rule edited' : 'Schedule rule created');
      if (!result.ok) {
        showProblems(result.errors);
        const first = body.querySelector<HTMLElement>('.md-field__input, input, select, button');
        if (first) ctx.a11y.focusVisible(first);
        ctx.a11y.announce(
          t('schedule.editor.problems', 'This rule was not saved. {count} field(s) need attention:', {
            count: result.errors.length
          }),
          true
        );
        return;
      }
      showProblems([]);
      const stored = engine.rule(draft.id);
      ctx.notify.success(
        t('schedule.notify.saved.title', 'Rule saved'),
        t('schedule.notify.saved.body', '"{label}" holds: {summary}', {
          label: draft.label,
          summary: stored ? describeWindow(stored) : describeWindow(draft)
        })
      );
      options.onSaved(stored ?? draft);
      handle.close();
    }
  });
  actions.append(cancel, save);
  body.append(actions);

  // The window shape is worth saying out loud the first time somebody builds a
  // rule that crosses midnight, because it is the one case where two correct
  // times read as a mistake.
  if (windowShape(draft) === 'crosses-midnight') refreshSummary();

  const firstField = nameField.root.querySelector<HTMLElement>('input');
  if (firstField) ctx.a11y.focusVisible(firstField);
}
