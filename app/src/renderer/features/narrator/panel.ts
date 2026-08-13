import { el } from '../../core/a11y';
import type { TabContext } from '../../core/registry';
import { createBulkList } from './bulklist';
import type { BulkAction } from './bulklist';
import { narrator } from './engine';
import {
  CATEGORIES,
  NARRATOR_ENABLED_ID,
  NARRATOR_MODE_ID,
  NARRATOR_VOLUME_ID,
  SPEECH_RANGES,
  categoryById,
  categoryCooldownId,
  categoryEnabledId
} from './model';
import type { CategoryDefinition, CategoryId, SpokenLine } from './model';
import { createVoicePicker } from './voicepicker';
import { voiceRegistry } from './voices';

/**
 * The narrator's own destination.
 *
 * Everything here is the real control rather than a printout of a value: the
 * switch in a category row is the same switch the settings surface renders, the
 * cooldown slider writes the same key, and the preview button speaks through
 * the same queue as a genuine event. Two routes to one value must never
 * disagree about what that value is.
 */

interface CategoryRow {
  id: string;
  definition: CategoryDefinition;
}

interface LogRow extends SpokenLine {
  /** Present so the row satisfies the bulk list's row contract. */
  id: string;
}

export function mountNarratorPanel(host: HTMLElement, ctx: TabContext): void {
  voiceRegistry.refresh();

  host.append(
    ctx.components.topAppBar({
      title: 'narrator.tab.title',
      subtitle: 'narrator.tab.subtitle'
    })
  );

  const page = el('div', { className: 'narrator-page' });
  host.append(page);

  /* ================================================================ */
  /* Live status                                                       */
  /* ================================================================ */

  const statusCard = ctx.components.card({ variant: 'outlined' });
  statusCard.setAttribute('data-appearance-id', 'narrator:status');
  const statusLine = el('p', {
    className: 'narrator-status md-typescale-body-medium',
    attrs: { role: 'status', 'aria-live': 'polite', id: 'narrator-status' }
  });
  const errorLine = el('p', { className: 'narrator-status__error md-typescale-body-small' });

  const drawStatus = (): void => {
    const state = narrator.state();
    const parts: string[] = [];
    if (state.silentReason) {
      parts.push(ctx.t('narrator.state.silent', 'Silent: {reason}', { values: { reason: state.silentReason } }));
    } else if (state.speaking) {
      parts.push(
        ctx.t('narrator.state.speaking', 'Speaking now. {count} lines waiting.', { values: { count: state.queued } })
      );
    } else {
      parts.push(ctx.t('narrator.state.idle', 'Ready, and not speaking.'));
    }
    if (state.duckingFor > 0) {
      parts.push(
        ctx.t('narrator.state.ducking', 'Holding back for {ms} milliseconds while the application announces something.', {
          values: { ms: Math.round(state.duckingFor) }
        })
      );
    }
    statusLine.textContent = parts.join(' ');
    errorLine.textContent = state.lastError
      ? ctx.t('narrator.state.lastError', 'Last problem: {message}', { values: { message: state.lastError } })
      : '';
  };

  const masterSwitch = ctx.components.switchControl({
    label: 'narrator.enabled',
    checked: ctx.settings.get<boolean>(NARRATOR_ENABLED_ID, false),
    disabled: !voiceRegistry.supported(),
    disabledReason: ctx.t('narrator.voice.unsupported', 'This build has no speech synthesis, so nothing can be spoken.'),
    onChange: (checked) => {
      ctx.settings.set(NARRATOR_ENABLED_ID, checked);
      if (!checked) narrator.cancelAll('The narrator was switched off.');
      drawStatus();
    },
    id: 'narrator-enabled-switch'
  });

  const volume = ctx.components.slider({
    label: 'narrator.volume',
    min: SPEECH_RANGES.volume.min,
    max: SPEECH_RANGES.volume.max,
    step: SPEECH_RANGES.volume.step,
    value: ctx.settings.get<number>(NARRATOR_VOLUME_ID, SPEECH_RANGES.volume.default),
    onChange: (value) => ctx.settings.set(NARRATOR_VOLUME_ID, value),
    id: 'narrator-volume'
  });

  const controlsRow = el('div', { className: 'narrator-controls' });
  controlsRow.append(masterSwitch.root);

  // While the study mode is on, Cantonese and bilingual narration behave as
  // though they were not installed: the control is OMITTED rather than shown
  // disabled, and the stored choice is untouched.
  if (!ctx.i18n.schoolModeActive()) {
    const mode = ctx.components.segmentedButton({
      label: 'narrator.mode',
      options: [
        { value: 'en', label: 'narrator.mode.en' },
        { value: 'yue', label: 'narrator.mode.yue' },
        { value: 'both', label: 'narrator.mode.both' }
      ],
      value: ctx.settings.get<string>(NARRATOR_MODE_ID, 'en'),
      onChange: (value) => ctx.settings.set(NARRATOR_MODE_ID, value),
      id: 'narrator-mode'
    });
    controlsRow.append(mode.root);
  }

  controlsRow.append(volume.root);

  const actionsRow = el('div', { className: 'narrator-controls' });
  actionsRow.append(
    ctx.components.button({
      label: 'narrator.action.stop',
      variant: 'outlined',
      icon: 'stop',
      onClick: () => {
        narrator.cancelAll('You asked it to stop.');
        drawStatus();
      }
    }),
    ctx.components.button({
      label: 'narrator.action.refresh',
      variant: 'text',
      icon: 'refresh',
      onClick: () => {
        voiceRegistry.refresh();
        ctx.a11y.announce(ctx.t('narrator.action.refresh', 'Re-read the installed voices'));
      }
    })
  );

  statusCard.append(statusLine, errorLine, controlsRow, actionsRow);
  page.append(statusCard);

  if (ctx.i18n.schoolModeActive()) {
    page.append(
      el('p', {
        className: 'narrator-note md-typescale-body-small',
        text: ctx.t('narrator.school.note', 'The narrator is speaking English only, because the study mode is on.')
      })
    );
  }

  /* ================================================================ */
  /* Voices                                                            */
  /* ================================================================ */

  page.append(
    ctx.components.sectionHeading({
      title: 'narrator.section.voices',
      description: 'narrator.voice.description'
    })
  );

  const voicesRow = el('div', { className: 'narrator-voices' });
  const english = createVoicePicker(ctx, 'en');
  voicesRow.append(english.root);
  ctx.onDispose(() => english.destroy());

  if (!ctx.i18n.schoolModeActive()) {
    const cantonese = createVoicePicker(ctx, 'yue');
    voicesRow.append(cantonese.root);
    ctx.onDispose(() => cantonese.destroy());
  } else {
    voicesRow.append(
      el('p', {
        className: 'md-typescale-body-small',
        text: ctx.t('narrator.school.note', 'The narrator is speaking English only, because the study mode is on.')
      })
    );
  }
  page.append(voicesRow);

  /* ================================================================ */
  /* Categories                                                        */
  /* ================================================================ */

  page.append(
    ctx.components.sectionHeading({
      title: 'narrator.section.categories',
      description: 'narrator.cooldown.description'
    })
  );

  const categoryRows = (): CategoryRow[] => CATEGORIES.map((definition) => ({ id: definition.id, definition }));

  const shippedCooldown = (id: CategoryId): number => categoryById(id)?.cooldownMs ?? 0;

  const categoryActions: Array<BulkAction<CategoryRow>> = [
    {
      id: 'enable',
      label: 'narrator.bulk.enable',
      icon: 'check',
      plan: (rows) => ({
        changing: rows.filter(
          (row) => ctx.settings.get<boolean>(categoryEnabledId(row.id), row.definition.enabledByDefault) !== true
        ),
        skipped: rows
          .filter((row) => ctx.settings.get<boolean>(categoryEnabledId(row.id), row.definition.enabledByDefault) === true)
          .map((row) => ({ row, reason: 'It is already spoken.' }))
      }),
      run: (rows) => {
        for (const row of rows) ctx.settings.set(categoryEnabledId(row.id), true);
      }
    },
    {
      id: 'disable',
      label: 'narrator.bulk.disable',
      icon: 'close',
      plan: (rows) => ({
        changing: rows.filter(
          (row) => ctx.settings.get<boolean>(categoryEnabledId(row.id), row.definition.enabledByDefault) === true
        ),
        skipped: rows
          .filter((row) => ctx.settings.get<boolean>(categoryEnabledId(row.id), row.definition.enabledByDefault) !== true)
          .map((row) => ({ row, reason: 'It is already silent.' }))
      }),
      run: (rows) => {
        for (const row of rows) ctx.settings.set(categoryEnabledId(row.id), false);
      }
    },
    {
      id: 'resetCooldown',
      label: 'narrator.bulk.resetCooldown',
      icon: 'refresh',
      plan: (rows) => ({
        changing: rows.filter(
          (row) =>
            !row.definition.neverSuppressed &&
            ctx.settings.get<number>(categoryCooldownId(row.id), shippedCooldown(row.definition.id)) !==
              shippedCooldown(row.definition.id)
        ),
        skipped: rows
          .filter(
            (row) =>
              row.definition.neverSuppressed ||
              ctx.settings.get<number>(categoryCooldownId(row.id), shippedCooldown(row.definition.id)) ===
                shippedCooldown(row.definition.id)
          )
          .map((row) => ({
            row,
            reason: row.definition.neverSuppressed
              ? 'This category is never held back, so it has no gap to restore.'
              : 'It already uses the shipped gap.'
          }))
      }),
      run: (rows) => {
        for (const row of rows) ctx.settings.reset(categoryCooldownId(row.id));
      }
    }
  ];

  const categoryList = createBulkList<CategoryRow>({
    ctx,
    label: 'narrator.section.categories',
    searchLabel: 'narrator.search.categories',
    rows: categoryRows,
    haystack: (row) =>
      `${ctx.t(row.definition.label, row.definition.label)} ${ctx.t(row.definition.description, row.definition.description)} ${row.id}`,
    rowLabel: (row) => ctx.t(row.definition.label, row.definition.label),
    emptyTitle: 'narrator.section.categories',
    actions: categoryActions,
    render: (row) => {
      const wrap = el('div', {
        className: 'narrator-category',
        attrs: { id: `narrator-category-${row.id}`, 'data-appearance-id': `narrator:category:${row.id}` }
      });

      const title = el('div', { className: 'narrator-category__title' });
      title.append(ctx.components.icon(row.definition.icon, { size: 18 }));
      const pair = ctx.i18n.pair(row.definition.label, row.definition.label);
      title.append(el('span', { className: 'md-typescale-title-small', text: pair.primary }));
      if (pair.secondary) title.append(el('span', { className: 'md-setting__secondary', text: pair.secondary }));

      const description = el('p', {
        className: 'md-typescale-body-small',
        text: ctx.t(row.definition.description, row.definition.description)
      });

      const spoken = ctx.components.switchControl({
        label: 'narrator.category.enabled',
        checked: ctx.settings.get<boolean>(categoryEnabledId(row.id), row.definition.enabledByDefault),
        onChange: (checked) => ctx.settings.set(categoryEnabledId(row.id), checked),
        id: `narrator-category-enabled-${row.id}`
      });

      const gap = ctx.components.slider({
        label: 'narrator.cooldown',
        min: 0,
        max: 120000,
        step: 1000,
        unit: 'ms',
        value: ctx.settings.get<number>(categoryCooldownId(row.id), row.definition.cooldownMs),
        onChange: (value) => ctx.settings.set(categoryCooldownId(row.id), value),
        id: `narrator-category-cooldown-${row.id}`
      });
      if (row.definition.neverSuppressed) {
        gap.setDisabled(
          true,
          ctx.t(
            'narrator.category.error.description',
            'This category jumps the queue and is never held back, so a gap would have no effect.'
          )
        );
      }

      const provenance = el('p', {
        className: 'md-setting__provenance',
        text:
          ctx.settings.provenanceOf(categoryEnabledId(row.id)) === 'default'
            ? ctx.t(
                'core.settings.provenance.default',
                'No file has ever set this. The application is using its own value: {value}.',
                {
                  values: {
                    value: `${row.definition.enabledByDefault ? 'spoken' : 'silent'}, ${row.definition.cooldownMs} ms`
                  }
                }
              )
            : ctx.t('core.settings.provenance.user', 'Set by you, and stored in {path}.', {
                values: { path: ctx.settings.filePath() || 'the settings file' }
              })
      });

      const preview = ctx.components.button({
        label: 'narrator.action.testCategory',
        variant: 'text',
        icon: 'play',
        onClick: () =>
          narrator.speak({
            category: row.definition.id,
            force: true,
            values: {
              title: ctx.t(row.definition.label, row.definition.label),
              body: ctx.t('narrator.action.testCategory', 'This is a test of this category.')
            }
          })
      });

      const controls = el('div', { className: 'narrator-category__controls' });
      controls.append(spoken.root, gap.root, preview);
      wrap.append(title, description, controls, provenance);
      return wrap;
    }
  });
  page.append(categoryList.root);
  ctx.onDispose(() => categoryList.destroy());

  /* ================================================================ */
  /* The spoken log                                                    */
  /* ================================================================ */

  page.append(
    ctx.components.sectionHeading({
      title: 'narrator.log.title',
      description: 'narrator.log.description'
    })
  );

  const outcomeLabel = (line: SpokenLine): string =>
    ctx.t(`narrator.outcome.${line.outcome}`, line.outcome);

  const logRows = (): LogRow[] => narrator.lines();

  const logActions: Array<BulkAction<LogRow>> = [
    {
      id: 'export',
      label: 'narrator.bulk.export',
      icon: 'download',
      plan: (rows) => ({ changing: rows, skipped: [] }),
      run: async (rows) => {
        const path = await ctx.exporter.save(
          rows.map((row) => ({
            at: row.at,
            category: row.category,
            outcome: row.outcome,
            reason: row.reason,
            text: row.segments.map((segment) => `${segment.language}: ${segment.text}`).join(' | '),
            voices: row.segments.map((segment) => segment.voiceName).join(' | ')
          })),
          'json',
          { name: 'narrator-log', defaultFileName: 'narrator-log.json', schemaVersion: '1' }
        );
        if (path) {
          ctx.notify.success(ctx.t('narrator.notify.exported', 'Exported to {path}', { values: { path } }));
        }
      }
    },
    {
      id: 'remove',
      label: 'narrator.bulk.delete',
      icon: 'trash',
      danger: true,
      irreversible:
        'The selected lines are removed from this session log. The log is held in memory only, so there is nothing on disk to restore them from.',
      plan: (rows) => ({ changing: rows, skipped: [] }),
      run: async (rows) => {
        const removed = narrator.removeLines(rows.map((row) => row.id));
        await ctx.history.record('Narrator log lines removed', 'narrator', { removed });
      }
    }
  ];

  const logList = createBulkList<LogRow>({
    ctx,
    label: 'narrator.log.title',
    searchLabel: 'narrator.search.log',
    rows: logRows,
    haystack: (row) =>
      `${row.at} ${row.category} ${row.outcome} ${row.reason} ${row.segments
        .map((segment) => `${segment.text} ${segment.voiceName}`)
        .join(' ')}`,
    rowLabel: (row) => `${row.at} — ${ctx.t(`narrator.category.${row.category}`, row.category)} — ${outcomeLabel(row)}`,
    emptyTitle: 'narrator.log.empty',
    emptyBody: 'narrator.log.description',
    actions: logActions,
    window: 40,
    render: (row) => {
      const wrap = el('div', { className: 'narrator-line' });
      const head = el('div', { className: 'narrator-line__head' });
      head.append(
        el('span', { className: 'md-typescale-label-medium', text: row.at }),
        ctx.components.badge({
          label: outcomeLabel(row),
          severity:
            row.outcome === 'spoken'
              ? 'success'
              : row.outcome === 'failed'
                ? 'error'
                : row.outcome === 'suppressed' || row.outcome === 'dropped' || row.outcome === 'replaced'
                  ? 'warning'
                  : 'info'
        }),
        el('span', {
          className: 'md-typescale-label-medium',
          text: ctx.t(`narrator.category.${row.category}`, row.category)
        })
      );
      wrap.append(head);

      for (const segment of row.segments) {
        wrap.append(
          el('p', {
            className: 'narrator-line__text md-typescale-body-small',
            text: `${segment.language === 'en' ? ctx.t('narrator.mode.en', 'English') : ctx.t('narrator.mode.yue', 'Cantonese')}: ${segment.text}${
              segment.voiceName ? ` — ${segment.voiceName}` : ''
            }`
          })
        );
      }
      if (row.reason) {
        wrap.append(el('p', { className: 'narrator-line__reason md-typescale-body-small', text: row.reason }));
      }
      return wrap;
    }
  });

  const logToolbar = el('div', { className: 'narrator-controls' });
  logToolbar.append(
    ctx.components.button({
      label: 'narrator.action.clearLog',
      variant: 'outlined',
      danger: true,
      icon: 'trash',
      onClick: async (event) => {
        const count = narrator.lines().length;
        if (count === 0) {
          ctx.notify.info(ctx.t('narrator.log.empty', 'Nothing has been spoken or suppressed yet.'));
          return;
        }
        const approved = await ctx.confirm.request({
          action: ctx.t('narrator.action.clearLog', 'Clear the log'),
          affected: [`${count} recorded lines from this session`],
          irreversible:
            'The session log is held in memory only, so once it is cleared there is nothing on disk to restore it from. The fact that it was cleared is recorded in local history.',
          anchor: event.currentTarget as HTMLElement
        });
        if (!approved) return;
        narrator.clearLog();
        await ctx.history.record('Narrator log cleared', 'narrator', { removed: count });
        ctx.notify.success(ctx.t('narrator.notify.logCleared', 'The narrator log was cleared'));
        logList.refresh();
      }
    })
  );

  page.append(logToolbar, logList.root);
  ctx.onDispose(() => logList.destroy());

  /* ================================================================ */
  /* Live wiring                                                       */
  /* ================================================================ */

  drawStatus();
  const stopState = narrator.onState(drawStatus);
  const stopLog = narrator.onLog(() => logList.refresh());
  const stopVoices = voiceRegistry.onChange(() => {
    masterSwitch.setDisabled(
      !voiceRegistry.supported(),
      ctx.t('narrator.voice.unsupported', 'This build has no speech synthesis, so nothing can be spoken.')
    );
    drawStatus();
  });
  const stopSettings = ctx.settings.onChange((change) => {
    if (!change.id.startsWith('narrator.')) return;
    // The same value is reachable from the settings surface and the command
    // palette, so the switch here follows the store rather than only its own
    // clicks — two routes to one value must never disagree on screen.
    if (change.id === NARRATOR_ENABLED_ID) masterSwitch.set(change.value === true);
    if (change.id === NARRATOR_VOLUME_ID) volume.set(Number(change.value));
    drawStatus();
    // A category row's own switch and slider write these keys, and rebuilding
    // the list from inside their change event would destroy the control the
    // pointer is still holding — which reads as a slider that refuses to drag.
    // The rows already show their own state; a bulk action redraws explicitly.
    if (!change.id.startsWith('narrator.category.')) categoryList.refresh();
  });
  const ticker = window.setInterval(drawStatus, 1000);

  ctx.onDispose(() => {
    stopState();
    stopLog();
    stopVoices();
    stopSettings();
    window.clearInterval(ticker);
  });
}
