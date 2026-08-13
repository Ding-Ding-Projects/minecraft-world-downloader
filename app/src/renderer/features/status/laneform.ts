import { el } from '../../core/a11y';
import type { AppContext, ControlHandle } from '../../core/registry';
import {
  EVIDENCE_EMOJI,
  EVIDENCE_STATES,
  isHttpUrl,
  MAX_EVIDENCE_PER_LANE,
  MAX_GATES_PER_LANE,
  STATUS_EMOJI,
  STATUS_VALUES
} from './model';
import type { EvidenceItem, EvidenceState, LaneRecord, StatusValue } from './model';
import { newLaneId } from './util';

export interface LaneFormResult {
  saved: boolean;
  lane: LaneRecord | null;
}

interface EvidenceRow {
  root: HTMLElement;
  label: ControlHandle<string>;
  url: ControlHandle<string>;
  state: ControlHandle<string>;
}

function statusLabel(ctx: AppContext, value: StatusValue): string {
  return ctx.t(`status.value.${value}`, value);
}

function evidenceStateLabel(ctx: AppContext, value: EvidenceState): string {
  return ctx.t(`status.evidenceValue.${value}`, value);
}

/**
 * Opens the guided add/edit form for one lane, anchored beside the control
 * that opened it. Resolves once the panel closes, saved or not — closing
 * without saving (Escape, the outside-click dismiss, or Cancel) all resolve
 * `{ saved: false }` alike.
 *
 * Git-derived fields (repository, branch, the verified baseline) are read-only
 * here for this checkout's own lane: this form edits what a person can
 * honestly claim by hand — status, summary, assumption, evidence, gates —
 * never what `git` itself already answered a moment ago on the tab behind it.
 */
export function openLaneForm(ctx: AppContext, anchor: HTMLElement, existing: LaneRecord | null): Promise<LaneFormResult> {
  return new Promise((resolve) => {
    const isSelf = existing?.origin === 'local';
    let settled = false;

    const handle = ctx.overlay.open({
      anchor,
      placement: 'bottom-start',
      role: 'dialog',
      label: existing
        ? ctx.t('status.form.editTitle', 'Edit the status lane "{title}"', { values: { title: existing.title } })
        : ctx.t('status.form.addTitle', 'Add a status lane'),
      resizeKey: 'status.laneForm',
      dragKey: 'status.laneForm',
      onClose: () => finish({ saved: false, lane: null })
    });

    const finish = (result: LaneFormResult): void => {
      if (settled) return;
      settled = true;
      resolve(result);
      if (handle.isOpen()) handle.close();
    };

    handle.body.append(
      el('h2', {
        className: 'md-typescale-title-medium',
        text: existing ? ctx.t('status.form.editTitle.short', 'Edit this lane') : ctx.t('status.form.addTitle', 'Add a status lane')
      })
    );

    if (isSelf) {
      handle.body.append(
        el('p', {
          className: 'md-typescale-body-small status-form__note',
          text: ctx.t(
            'status.form.selfNote',
            'This is this checkout’s own record. Repository, branch and the verified baseline are read from Git on the card behind this one — press Refresh from Git there to update them, not here.'
          )
        })
      );
    }

    const titleField = ctx.components.textField({
      label: 'status.form.title',
      value: existing?.title ?? '',
      variant: 'outlined',
      supportingText: ctx.t('status.form.title.hint', 'A short name you will recognise in the list.')
    });

    const repositoryField = ctx.components.textField({
      label: 'status.form.repository',
      value: existing?.repository ?? '',
      variant: 'outlined',
      placeholder: 'owner/repository'
    });

    const branchField = ctx.components.textField({
      label: 'status.form.branch',
      value: existing?.branch ?? '',
      variant: 'outlined'
    });

    const agentField = ctx.components.textField({
      label: 'status.form.agent',
      value: existing?.agent ?? '',
      variant: 'outlined',
      supportingText: ctx.t('status.form.agent.hint', 'Who or what is doing this work, if that is worth naming.')
    });

    const machineField = ctx.components.textField({
      label: 'status.form.machine',
      value: existing?.machine ?? '',
      variant: 'outlined',
      supportingText: ctx.t(
        'status.form.machine.hint',
        'This application cannot read the computer’s name by itself; type it if it matters to you.'
      )
    });

    const statusField = ctx.components.select({
      label: 'status.form.status',
      value: existing?.status ?? 'waiting',
      options: STATUS_VALUES.map((value) => ({ value, label: `${STATUS_EMOJI[value]} ${statusLabel(ctx, value)}` }))
    });

    const summaryField = ctx.components.textField({
      label: 'status.form.summary',
      value: existing?.summary ?? '',
      variant: 'outlined',
      multiline: true,
      rows: 3,
      supportingText: ctx.t('status.form.summary.hint', 'What is actually true right now, in a sentence or two.')
    });

    const assumptionField = ctx.components.textField({
      label: 'status.form.assumption',
      value: existing?.assumption ?? '',
      variant: 'outlined',
      multiline: true,
      rows: 2,
      supportingText: ctx.t('status.form.assumption.hint', 'Optional. What you are proceeding on, rather than waiting to confirm.')
    });

    const baselineField = ctx.components.textField({
      label: 'status.form.verifiedBaseline',
      value: existing?.verifiedBaseline ?? '',
      variant: 'outlined',
      supportingText: ctx.t(
        'status.form.verifiedBaseline.hint',
        'A claim about the remote you can actually prove — a SHA comparison, a run link — not a guess.'
      )
    });

    if (isSelf) {
      const reason = ctx.t('status.form.gitOwned', 'Read from Git on the card behind this one. Press Refresh from Git there instead.');
      repositoryField.setDisabled(true, reason);
      branchField.setDisabled(true, reason);
      baselineField.setDisabled(true, reason);
    }

    handle.body.append(
      titleField.root,
      repositoryField.root,
      branchField.root,
      agentField.root,
      machineField.root,
      statusField.root,
      summaryField.root,
      assumptionField.root,
      baselineField.root
    );

    /* ---------------- evidence ---------------- */

    const evidenceRows: EvidenceRow[] = [];
    const evidenceList = el('div', { className: 'status-form__rows' });
    const evidenceError = el('p', { className: 'md-typescale-body-small status-form__error', attrs: { role: 'status' } });

    const addEvidenceButton = ctx.components.button({
      label: 'status.form.evidence.add',
      variant: 'text',
      icon: 'add',
      onClick: () => addEvidenceRow(null)
    });

    function addEvidenceRow(seed: EvidenceItem | null): void {
      if (evidenceRows.length >= MAX_EVIDENCE_PER_LANE) return;
      const row = el('div', { className: 'status-form__row' });
      const labelField = ctx.components.textField({
        label: ctx.t('status.form.evidence.label', 'What it is'),
        value: seed?.label ?? '',
        variant: 'outlined'
      });
      const urlField = ctx.components.textField({
        label: ctx.t('status.form.evidence.url', 'Link (http or https)'),
        value: seed?.url ?? '',
        variant: 'outlined',
        type: 'url'
      });
      const stateField = ctx.components.select({
        label: ctx.t('status.form.evidence.state', 'State'),
        value: seed?.state ?? 'pending',
        options: EVIDENCE_STATES.map((value) => ({ value, label: `${EVIDENCE_EMOJI[value]} ${evidenceStateLabel(ctx, value)}` }))
      });
      const removeButton = ctx.components.iconButton({
        icon: 'trash',
        label: ctx.t('status.form.evidence.remove', 'Remove this piece of evidence'),
        onClick: () => {
          const index = evidenceRows.findIndex((candidate) => candidate.root === row);
          if (index !== -1) evidenceRows.splice(index, 1);
          row.remove();
          syncEvidenceButton();
        }
      });
      row.append(labelField.root, urlField.root, stateField.root, removeButton);
      evidenceList.append(row);
      evidenceRows.push({ root: row, label: labelField, url: urlField, state: stateField });
      syncEvidenceButton();
    }

    function syncEvidenceButton(): void {
      const atMax = evidenceRows.length >= MAX_EVIDENCE_PER_LANE;
      addEvidenceButton.disabled = atMax;
      addEvidenceButton.title = atMax
        ? ctx.t('status.form.evidence.max', 'Up to {max} pieces of evidence per lane.', { values: { max: MAX_EVIDENCE_PER_LANE } })
        : '';
    }

    for (const item of existing?.evidence ?? []) addEvidenceRow(item);

    handle.body.append(
      el('h3', { className: 'md-typescale-title-small', text: ctx.t('status.form.evidence.heading', 'Evidence') }),
      evidenceList,
      addEvidenceButton,
      evidenceError
    );

    /* ---------------- next gates ---------------- */

    const gateRows: ControlHandle<string>[] = [];
    const gatesList = el('div', { className: 'status-form__rows' });

    const addGateButton = ctx.components.button({
      label: 'status.form.gates.add',
      variant: 'text',
      icon: 'add',
      onClick: () => addGateRow('')
    });

    function addGateRow(seed: string): void {
      if (gateRows.length >= MAX_GATES_PER_LANE) return;
      const row = el('div', { className: 'status-form__row' });
      const field = ctx.components.textField({
        label: ctx.t('status.form.gates.placeholder', 'What has to happen next'),
        value: seed,
        variant: 'outlined'
      });
      const removeButton = ctx.components.iconButton({
        icon: 'trash',
        label: ctx.t('status.form.gates.remove', 'Remove this gate'),
        onClick: () => {
          const index = gateRows.indexOf(field);
          if (index !== -1) gateRows.splice(index, 1);
          row.remove();
          syncGateButton();
        }
      });
      row.append(field.root, removeButton);
      gatesList.append(row);
      gateRows.push(field);
      syncGateButton();
    }

    function syncGateButton(): void {
      const atMax = gateRows.length >= MAX_GATES_PER_LANE;
      addGateButton.disabled = atMax;
      addGateButton.title = atMax
        ? ctx.t('status.form.gates.max', 'Up to {max} next gates per lane.', { values: { max: MAX_GATES_PER_LANE } })
        : '';
    }

    for (const gate of existing?.nextGates ?? []) addGateRow(gate);

    handle.body.append(
      el('h3', { className: 'md-typescale-title-small', text: ctx.t('status.form.gates.heading', 'Next gates') }),
      gatesList,
      addGateButton
    );

    /* ---------------- save / cancel ---------------- */

    const formError = el('p', { className: 'md-typescale-body-small status-form__error', attrs: { role: 'status' } });

    const cancelButton = ctx.components.button({
      label: 'status.form.cancel',
      variant: 'text',
      onClick: () => finish({ saved: false, lane: null })
    });

    const saveButton = ctx.components.button({
      label: 'status.form.save',
      variant: 'filled',
      icon: 'save',
      onClick: () => {
        const title = titleField.get().trim();
        if (title === '') {
          formError.textContent = ctx.t('status.form.validation.titleRequired', 'Give this lane a name before saving.');
          titleField.focus();
          return;
        }

        const evidence: EvidenceItem[] = [];
        for (let index = 0; index < evidenceRows.length; index += 1) {
          const row = evidenceRows[index];
          const label = row.label.get().trim();
          const url = row.url.get().trim();
          if (label === '' && url === '') continue; // an untouched blank row is simply dropped, not an error
          if (label === '' || !isHttpUrl(url)) {
            evidenceError.textContent = ctx.t(
              'status.form.validation.evidenceInvalid',
              'Every piece of evidence needs a label and a real http or https link, or should be removed.'
            );
            return;
          }
          evidence.push({ id: `evidence-${index + 1}`, label, url, state: row.state.get() as EvidenceState });
        }
        evidenceError.textContent = '';
        formError.textContent = '';

        const nextGates = gateRows
          .map((field) => field.get().trim())
          .filter((gate) => gate !== '')
          .slice(0, MAX_GATES_PER_LANE);

        const lane: LaneRecord = {
          id: existing?.id ?? newLaneId(),
          origin: isSelf ? 'local' : 'manual',
          title,
          repository: isSelf ? existing?.repository ?? '' : repositoryField.get().trim(),
          branch: isSelf ? existing?.branch ?? '' : branchField.get().trim(),
          agent: agentField.get().trim(),
          status: statusField.get() as StatusValue,
          summary: summaryField.get().trim(),
          assumption: assumptionField.get().trim(),
          verifiedBaseline: isSelf ? existing?.verifiedBaseline ?? '' : baselineField.get().trim(),
          evidence,
          nextGates,
          machine: machineField.get().trim(),
          worktrees: existing?.worktrees ?? [],
          updatedAt: new Date().toISOString()
        };
        finish({ saved: true, lane });
      }
    });

    const actions = el('div', { className: 'status-form__actions' });
    actions.append(cancelButton, saveButton);
    handle.body.append(formError, actions);

    handle.reposition();
    titleField.focus();
  });
}
