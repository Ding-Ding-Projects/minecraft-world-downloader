import type { AppContext, OverlayHandle } from '../../core/registry';
import { LOCKS_CHANGED_EVENT } from './guard';
import { appearanceTarget, cssEscape, dialogTitle } from './model';

/**
 * Choosing what to lock, and then locking each chosen thing separately.
 *
 * The element context menu already offers "Lock this element…" on whatever is
 * under the pointer. This is the other route: for somebody who knows they want
 * the settings destination locked, or the corner radius of one control frozen,
 * and does not want to go hunting for the right pixel to right-click.
 *
 * The bulk route is deliberately not automatic. Selecting six things does not
 * create six locks with one credential typed once: it opens a queue where each
 * one is set up on its own, with its own wizard and its own credential. A user
 * who wants the same password on all six gets there by typing it six times,
 * which is a decision rather than a default.
 */

export type CandidateKind = 'tab' | 'setting' | 'element' | 'appearance';

export interface LockCandidate {
  target: string;
  label: string;
  detail: string;
  disabledReason?: string;
}

/** The appearance properties the per-element appearance editor actually writes. */
export const APPEARANCE_PROPERTIES: string[] = [
  'color',
  'background-color',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'font-variant-caps',
  'font-variation-settings',
  'text-decoration-line',
  'text-decoration-style',
  'text-decoration-color',
  'text-decoration-thickness',
  'text-transform',
  'vertical-align',
  '-webkit-text-stroke',
  'text-shadow',
  'letter-spacing',
  'word-spacing',
  'line-height',
  'direction',
  'text-align',
  'border-radius',
  'border-color',
  'border-width',
  'border-style',
  'padding',
  'margin',
  'box-shadow',
  'opacity'
];

const EXCLUDED_FROM_SCAN = '.md-overlay-layer, .md-palette-scrim, .md-dialog-scrim, .md-toast-host';

/** Every element currently on screen that carries a stable appearance id. */
export function scanElements(): Array<{ selector: string; label: string }> {
  const found = new Map<string, string>();
  for (const element of document.querySelectorAll<HTMLElement>('[data-appearance-id]')) {
    if (element.closest(EXCLUDED_FROM_SCAN)) continue;
    const id = element.dataset.appearanceId;
    if (!id) continue;
    const selector = `[data-appearance-id="${id}"]`;
    if (found.has(selector)) continue;
    const text = element.getAttribute('aria-label') ?? element.textContent?.trim().replace(/\s+/g, ' ').slice(0, 60) ?? '';
    found.set(selector, text || id);
  }
  return [...found.entries()]
    .map(([selector, label]) => ({ selector, label }))
    .sort((a, b) => a.selector.localeCompare(b.selector));
}

export function candidatesFor(ctx: AppContext, kind: CandidateKind, property: string): LockCandidate[] {
  if (kind === 'tab') {
    return ctx.registry.tabs().map((tab) => ({
      target: tab.id,
      label: ctx.t(tab.title, tab.title),
      detail: ctx.t('locks.enforced.tab', 'Opening this tab asks for its credential.')
    }));
  }
  if (kind === 'setting') {
    const candidates: LockCandidate[] = [];
    for (const section of ctx.registry.settingsSections()) {
      for (const control of section.controls) {
        candidates.push({
          target: control.id,
          label: ctx.t(control.label, control.label),
          detail: `${ctx.t(section.title, section.title)} · ${control.id}`,
          disabledReason:
            control.lockable === false
              ? control.lockableReason ?? ctx.t('locks.picker.notLockable', 'This setting cannot be locked.')
              : undefined
        });
      }
    }
    return candidates;
  }
  if (kind === 'element') {
    return scanElements().map((element) => ({
      target: element.selector,
      label: element.label,
      detail: element.selector
    }));
  }
  return scanElements().map((element) => ({
    target: appearanceTarget(element.selector, property),
    label: `${property} — ${element.label}`,
    detail: element.selector
  }));
}

/** The anchored picker. Everything it renders is keyboard-operable. */
export function openLockPicker(ctx: AppContext, anchor: HTMLElement): OverlayHandle {
  const handle = ctx.overlay.open({
    anchor,
    placement: 'bottom-start',
    role: 'dialog',
    label: ctx.t('locks.picker.title', 'Choose what to lock'),
    resizeKey: 'locks-picker',
    dragKey: 'locks-picker'
  });

  const body = handle.body;
  body.classList.add('wds-locks-picker');

  const heading = document.createElement('h2');
  heading.className = 'md-typescale-title-medium';
  heading.textContent = dialogTitle(ctx, 'locks.picker.title', 'Choose what to lock');
  body.append(heading);

  const forFun = document.createElement('p');
  forFun.className = 'md-typescale-body-small wds-locks-forfun';
  forFun.textContent = ctx.t(
    'core.lock.toyWarning',
    'This is just for fun.',
    { values: { path: ctx.locks.recoveryPath() } }
  );
  body.append(forFun);

  let kind: CandidateKind = 'tab';
  let property = APPEARANCE_PROPERTIES[0];
  let matched: LockCandidate[] = [];
  const selection = new Set<string>();
  let lastIndex = -1;

  const kindPicker = ctx.components.segmentedButton({
    label: 'locks.picker.kind',
    value: kind,
    options: [
      { value: 'tab', label: 'locks.picker.kind.tab', icon: 'dock' },
      { value: 'setting', label: 'locks.picker.kind.setting', icon: 'settings' },
      { value: 'element', label: 'locks.picker.kind.element', icon: 'palette' },
      { value: 'appearance', label: 'locks.picker.kind.appearance', icon: 'edit' }
    ],
    onChange: (value) => {
      kind = value as CandidateKind;
      propertyRow.hidden = kind !== 'appearance';
      selection.clear();
      lastIndex = -1;
      redraw();
    }
  });

  const propertyRow = document.createElement('div');
  propertyRow.className = 'wds-locks-picker__property';
  propertyRow.hidden = true;
  const propertySelect = ctx.components.select({
    label: 'locks.picker.property',
    value: property,
    options: APPEARANCE_PROPERTIES.map((name) => ({ value: name, label: name })),
    onChange: (value) => {
      property = value;
      selection.clear();
      lastIndex = -1;
      redraw();
    }
  });
  propertyRow.append(propertySelect.root);

  const breadth = document.createElement('p');
  breadth.className = 'md-typescale-body-small';
  breadth.textContent = ctx.t(
    'locks.picker.breadth',
    'A broad selector locks every element it matches, which can be a great many of them. The unlock prompt itself always stays reachable.'
  );

  const listHost = document.createElement('div');
  listHost.className = 'wds-locks-picker__list';
  const listNode = ctx.components.list({ label: 'locks.picker.title' });
  listHost.append(listNode);
  const summary = document.createElement('p');
  summary.className = 'md-typescale-body-small';
  summary.setAttribute('role', 'status');

  const search = ctx.createSearchBar({
    label: 'locks.picker.search',
    sample: 'core.settings\n[data-appearance-id="chrome:titlebar"]\nborder-radius',
    onChange: () => redraw()
  });

  const rescan = ctx.components.button({
    label: 'locks.picker.rescan',
    variant: 'text',
    icon: 'refresh',
    onClick: () => redraw()
  });

  const proceed = ctx.components.button({
    label: 'locks.picker.continue',
    variant: 'filled',
    icon: 'lock',
    disabled: true,
    disabledReason: 'locks.bulk.needSelection',
    onClick: () => {
      const chosen = matched.filter((candidate) => selection.has(candidate.target));
      if (chosen.length === 0) return;
      handle.close();
      openLockQueue(ctx, anchor, chosen);
    }
  });

  function redraw(): void {
    const query = search.query();
    const all = candidatesFor(ctx, kind, property);
    matched = all.filter((candidate) => query.matches(`${candidate.label} ${candidate.target} ${candidate.detail}`));

    listNode.textContent = '';
    listHost.querySelector('.md-empty')?.remove();
    if (matched.length === 0) {
      listHost.append(
        ctx.components.emptyState({
          title: all.length === 0 ? 'locks.picker.empty' : 'core.search.noMatches'
        })
      );
    }

    matched.forEach((candidate, index) => {
      const already = ctx.locks.isLocked(candidate.target);
      const supporting = [
        candidate.detail,
        already ? ctx.t('locks.picker.alreadyLocked', 'Already locked') : '',
        candidate.disabledReason ?? ''
      ]
        .filter(Boolean)
        .join(' · ');

      const item = ctx.components.listItem({
        headline: candidate.label,
        supporting,
        leadingIcon: already ? 'lock' : 'lockOpen',
        selectable: candidate.disabledReason === undefined,
        selected: selection.has(candidate.target),
        onSelectChange: (selected) => {
          if (selected) selection.add(candidate.target);
          else selection.delete(candidate.target);
          lastIndex = index;
          updateSummary();
        }
      });

      // Shift+click extends from the last row touched, exactly as a file list
      // does, and the keyboard equivalent is Shift+Space on the row.
      const extend = (event: MouseEvent | KeyboardEvent): void => {
        if (!event.shiftKey || lastIndex < 0) return;
        event.preventDefault();
        const [from, to] = lastIndex <= index ? [lastIndex, index] : [index, lastIndex];
        for (let cursor = from; cursor <= to; cursor += 1) {
          const row = matched[cursor];
          if (row && row.disabledReason === undefined) selection.add(row.target);
        }
        redrawSelectionMarks();
        updateSummary();
      };
      item.addEventListener('click', extend);
      item.addEventListener('keydown', (event) => {
        if (event.key === ' ' || event.key === 'Spacebar') extend(event);
      });
      item.dataset.lockTarget = candidate.target;
      listNode.append(item);
    });

    redrawSelectionMarks();
    updateSummary();
  }

  function redrawSelectionMarks(): void {
    for (const row of listNode.querySelectorAll<HTMLElement>('[data-lock-target]')) {
      const chosen = selection.has(row.dataset.lockTarget ?? '');
      row.setAttribute('aria-selected', String(chosen));
      const box = row.querySelector<HTMLInputElement>('input[type="checkbox"]');
      if (box) box.checked = chosen;
    }
  }

  function updateSummary(): void {
    const chosen = matched.filter((candidate) => selection.has(candidate.target));
    const replacing = chosen.filter((candidate) => ctx.locks.isLocked(candidate.target)).length;
    summary.textContent = ctx.t(
      'locks.picker.summary',
      '{count} selected of {total} shown. {replacing} of them already have a lock and would get a new credential.',
      { values: { count: chosen.length, total: matched.length, replacing } }
    );
    const labelNode = proceed.querySelector('.md-btn__label');
    if (labelNode) {
      labelNode.textContent = ctx.t('locks.picker.continue', 'Set up {count} locks', { values: { count: chosen.length } });
    }
    proceed.disabled = chosen.length === 0;
  }

  const footer = document.createElement('div');
  footer.className = 'md-confirm__actions';
  footer.append(
    ctx.components.button({ label: 'core.action.cancel', variant: 'text', onClick: () => handle.close() }),
    rescan,
    proceed
  );

  body.append(kindPicker.root, propertyRow, search.root, breadth, summary, listHost, footer);
  redraw();
  handle.reposition();
  window.requestAnimationFrame(() => search.focus());
  return handle;
}

/**
 * The queue: one wizard, one credential, one lock at a time.
 *
 * Progress is read back from the stored records rather than assumed, so a wizard
 * that was cancelled shows as still unlocked instead of being counted as done.
 */
export function openLockQueue(ctx: AppContext, anchor: HTMLElement, candidates: LockCandidate[]): OverlayHandle {
  let detach = (): void => undefined;
  const handle = ctx.overlay.open({
    anchor,
    placement: 'bottom-start',
    role: 'dialog',
    label: ctx.t('locks.queue.title', 'One credential each'),
    resizeKey: 'locks-queue',
    dragKey: 'locks-queue',
    onClose: () => detach()
  });

  const body = handle.body;
  body.classList.add('wds-locks-queue');

  const heading = document.createElement('h2');
  heading.className = 'md-typescale-title-medium';
  heading.textContent = dialogTitle(ctx, 'locks.queue.title', 'One credential each');

  const explain = document.createElement('p');
  explain.className = 'md-typescale-body-medium';
  explain.textContent = ctx.t(
    'locks.queue.body',
    'Each of these gets its own lock and its own credential. Nothing is shared between them.'
  );

  const progress = document.createElement('p');
  progress.className = 'md-typescale-body-small';
  progress.setAttribute('role', 'status');

  const rows = ctx.components.list({ label: 'locks.queue.title' });
  body.append(heading, explain, progress, rows);

  const refresh = (): void => {
    rows.textContent = '';
    let done = 0;
    for (const candidate of candidates) {
      const locked = ctx.locks.isLocked(candidate.target);
      if (locked) done += 1;
      const trailing = document.createElement('span');
      if (locked) {
        trailing.className = 'md-badge md-badge--success';
        trailing.textContent = ctx.t('locks.queue.done', 'Locked');
      } else {
        const create = ctx.components.button({
          label: 'locks.queue.create',
          variant: 'tonal',
          icon: 'lock',
          onClick: () => ctx.locks.wizard(create, candidate.target, candidate.label)
        });
        trailing.append(create);
      }
      rows.append(
        ctx.components.listItem({
          headline: candidate.label,
          supporting: candidate.detail,
          leadingIcon: locked ? 'lock' : 'lockOpen',
          trailing
        })
      );
    }
    progress.textContent = ctx.t('locks.queue.progress', '{done} of {total} locked', {
      values: { done, total: candidates.length }
    });
  };

  const onChanged = (): void => refresh();
  window.addEventListener(LOCKS_CHANGED_EVENT, onChanged);
  detach = () => window.removeEventListener(LOCKS_CHANGED_EVENT, onChanged);

  const footer = document.createElement('div');
  footer.className = 'md-confirm__actions';
  footer.append(
    ctx.components.button({
      label: 'core.action.close',
      variant: 'text',
      onClick: () => handle.close()
    })
  );
  body.append(footer);

  refresh();
  handle.reposition();
  return handle;
}

/** Re-runs the wizard for one existing lock, replacing its own credential only. */
export function replaceCredential(ctx: AppContext, anchor: HTMLElement, target: string, label: string): void {
  ctx.notify.info(
    ctx.t('locks.action.replace', 'Replace this credential…'),
    ctx.t(
      'locks.replace.explain',
      'This replaces the credential and the unlock duration for {label}.',
      { values: { label } }
    )
  );
  ctx.locks.wizard(anchor, target, label);
}

/** Escapes a target for use inside an attribute selector in this feature's own DOM. */
export function targetAttributeSelector(target: string): string {
  return `[data-lock-target="${cssEscape(target)}"]`;
}
