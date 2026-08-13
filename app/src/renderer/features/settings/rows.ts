import { openColorPicker } from '../../core/colorpicker';
import type { AppContext, SettingContext, SettingControl, SettingsSection } from '../../core/registry';

/**
 * One settings row: the label, the explanation behind progressive disclosure,
 * the truthful default-provenance line, the real live control, inline validation
 * in plain words, and a per-control reset.
 *
 * The control here is the REAL control, writing to the same store, through the
 * same validation, as the copy the command palette renders inline. Two routes to
 * one value that disagree about what that value is are worse than one route.
 *
 * Provenance names the real value rather than the opaque word "default": a
 * person reading "using the built-in value 8080" knows what they will get back
 * if they reset, and a person reading "default" knows nothing at all.
 */

export const ROW_ID_PREFIX = 'settings-control-';

export function rowElementId(controlId: string): string {
  return `${ROW_ID_PREFIX}${controlId}`;
}

export function describeValue(value: unknown): string {
  if (value === null || value === undefined) return 'nothing';
  if (typeof value === 'string') return value === '' ? 'an empty text value' : value;
  if (typeof value === 'boolean') return value ? 'on' : 'off';
  if (typeof value === 'number') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return 'a structured value';
  }
}

export interface SettingRowHandle {
  root: HTMLElement;
  control: SettingControl;
  sectionId: string;
  sectionTitle: string;
  /** Everything a search should look at, including the current value. */
  haystack(): string;
  setVisible(visible: boolean): void;
  isVisible(): boolean;
  setSelectionMode(on: boolean): void;
  setSelected(on: boolean): void;
  isSelected(): boolean;
  /** True when a stored value exists that differs from the shipped default. */
  isChanged(): boolean;
  reset(): void;
  refresh(): void;
  destroy(): void;
}

export interface SettingRowOptions {
  ctx: AppContext;
  section: SettingsSection;
  control: SettingControl;
  index: number;
  showId(): boolean;
  expandExplanations(): boolean;
  onSelectRequest(index: number, selected: boolean, shiftKey: boolean): void;
  onSelectionChanged(): void;
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

interface Checked {
  ok: boolean;
  value: unknown;
  message: string | null;
}

function checkNumber(control: SettingControl, raw: string, ctx: AppContext): Checked {
  const trimmed = raw.trim();
  if (trimmed === '') {
    return { ok: true, value: control.defaultValue, message: null };
  }
  const value = Number(trimmed);
  if (!Number.isFinite(value)) {
    return { ok: false, value: null, message: ctx.t('settings.validate.number', 'That is not a number. Nothing was changed.') };
  }
  const hasMin = typeof control.min === 'number';
  const hasMax = typeof control.max === 'number';
  if (hasMin && hasMax && (value < (control.min as number) || value > (control.max as number))) {
    return {
      ok: false,
      value: null,
      message: ctx.t('settings.validate.range', 'Must be a number between {min} and {max}.', {
        values: { min: control.min as number, max: control.max as number }
      })
    };
  }
  if (hasMin && value < (control.min as number)) {
    return {
      ok: false,
      value: null,
      message: ctx.t('settings.validate.min', 'Must be {min} or more.', { values: { min: control.min as number } })
    };
  }
  if (hasMax && value > (control.max as number)) {
    return {
      ok: false,
      value: null,
      message: ctx.t('settings.validate.max', 'Must be {max} or less.', { values: { max: control.max as number } })
    };
  }
  if (typeof control.step === 'number' && control.step > 0) {
    const base = typeof control.min === 'number' ? control.min : 0;
    const steps = (value - base) / control.step;
    // Floating-point steps such as 0.05 never land exactly, so the comparison is
    // made against a tolerance rather than against zero.
    if (Math.abs(steps - Math.round(steps)) > 1e-6) {
      return {
        ok: false,
        value: null,
        message: ctx.t('settings.validate.step', 'Must be a multiple of {step}, counting from {min}.', {
          values: { step: control.step, min: base }
        })
      };
    }
  }
  return { ok: true, value, message: null };
}

/* ------------------------------------------------------------------ */
/* The row                                                             */
/* ------------------------------------------------------------------ */

export function createSettingRow(options: SettingRowOptions): SettingRowHandle {
  const { ctx, control, section } = options;
  const { components, settings, i18n } = ctx;
  const t = (key: string, fallback: string, values?: Record<string, string | number>): string =>
    ctx.t(key, fallback, values ? { values } : undefined);

  settings.declareDefault(control.id, control.defaultValue);

  const lockTarget = `setting:${control.id}`;
  const sectionTitle = i18n.t(section.title, section.title);

  const el = <K extends keyof HTMLElementTagNameMap>(
    tag: K,
    init: { className?: string; text?: string; attrs?: Record<string, string> } = {}
  ): HTMLElementTagNameMap[K] => {
    const node = document.createElement(tag);
    if (init.className) node.className = init.className;
    if (init.text !== undefined) node.textContent = init.text;
    if (init.attrs) for (const [key, value] of Object.entries(init.attrs)) node.setAttribute(key, value);
    return node;
  };

  const root = el('div', {
    className: 'settings-row',
    attrs: {
      id: rowElementId(control.id),
      'data-setting-id': control.id,
      'data-appearance-id': `settings-row:${control.id}`
    }
  });

  /* ---------------- head ---------------- */

  const head = el('div', { className: 'settings-row__head' });

  const selectHost = el('div', { className: 'settings-row__select' });
  selectHost.hidden = true;
  const selectBox = components.checkbox({
    label: t('settings.row.select', 'Select this setting'),
    checked: false,
    onChange: () => undefined
  });
  const selectInput = selectBox.root.querySelector('input');
  selectBox.root.querySelector('span')?.classList.add('md-visually-hidden');
  selectHost.append(selectBox.root);
  let selected = false;
  if (selectInput) {
    selectInput.addEventListener('click', (event) => {
      const mouse = event as MouseEvent;
      selected = selectInput.checked;
      options.onSelectRequest(options.index, selected, mouse.shiftKey === true);
      options.onSelectionChanged();
    });
    selectInput.addEventListener('keydown', (event) => {
      if (event.key !== ' ' && event.key !== 'Enter') return;
      // Space and Enter reach the same path as a click, so a keyboard user has
      // the same multi-select the pointer has, including the shift range.
      event.preventDefault();
      selected = !selectInput.checked;
      selectInput.checked = selected;
      options.onSelectRequest(options.index, selected, event.shiftKey === true);
      options.onSelectionChanged();
    });
  }

  const titleBox = el('div', { className: 'settings-row__titles' });
  const pair = i18n.pair(control.label, control.label);
  const primary = el('span', { className: 'md-typescale-title-small', text: pair.primary });
  titleBox.append(primary);
  if (pair.secondary) {
    titleBox.append(el('span', { className: 'settings-row__secondary md-typescale-body-small', text: pair.secondary }));
  }
  const idLine = el('code', { className: 'settings-row__id', text: control.id });
  idLine.hidden = !options.showId();
  titleBox.append(idLine);

  const explainId = `settings-explain-${control.id}`;
  const explain = el('button', {
    className: 'settings-row__explain',
    text: '?',
    attrs: {
      type: 'button',
      'aria-label': t('settings.row.explain', 'What this does'),
      'aria-expanded': 'false',
      'aria-controls': explainId
    }
  });

  const lockBadge = components.iconButton({
    icon: 'lock',
    label: t('settings.row.lock', 'Lock this setting…'),
    onClick: () => {
      if (control.lockable === false) {
        ctx.notify.warn(
          t('settings.row.lockNotAvailable', 'This setting cannot be locked: {reason}', {
            reason: control.lockableReason ?? 'the feature that owns it opted out'
          })
        );
        return;
      }
      ctx.locks.wizard(lockBadge, lockTarget, i18n.t(control.label, control.label));
    }
  });
  lockBadge.classList.add('settings-row__lock');

  head.append(selectHost, titleBox, explain, lockBadge);

  const description = el('p', {
    className: 'settings-row__description md-typescale-body-small',
    text: i18n.t(control.description, control.description),
    attrs: { id: explainId }
  });
  description.hidden = !options.expandExplanations();
  explain.setAttribute('aria-expanded', String(!description.hidden));
  explain.addEventListener('click', () => {
    description.hidden = !description.hidden;
    explain.setAttribute('aria-expanded', String(!description.hidden));
    explain.setAttribute(
      'aria-label',
      description.hidden ? t('settings.row.explain', 'What this does') : t('settings.row.hideExplain', 'Hide the explanation')
    );
  });

  /* ---------------- body, validation, provenance ---------------- */

  const body = el('div', { className: 'settings-row__body' });
  const validation = el('p', {
    className: 'settings-row__validation md-typescale-body-small',
    attrs: { role: 'alert' }
  });
  validation.hidden = true;

  const provenance = el('p', { className: 'settings-row__provenance md-typescale-body-small' });

  const currentValue = (): unknown => settings.get(control.id, control.defaultValue);

  const showError = (message: string): void => {
    validation.hidden = false;
    validation.textContent = message;
    validation.classList.add('settings-row__validation--error');
  };

  const clearError = (): void => {
    validation.hidden = true;
    validation.textContent = '';
    validation.classList.remove('settings-row__validation--error');
  };

  /**
   * The single write path.
   *
   * A value typed into the field and a value chosen through a browse button both
   * arrive here, so a browsed path is never trusted more than a typed one.
   */
  const commit = (value: unknown): boolean => {
    const declared = control.validate?.(value) ?? null;
    if (declared) {
      showError(declared);
      return false;
    }
    clearError();
    settings.set(control.id, value);
    refreshProvenance();
    ctx.a11y.announce(
      t('settings.announce.set', '{label} is now {value}', {
        label: i18n.t(control.label, control.label),
        value: describeValue(value)
      })
    );
    return true;
  };

  const commitNumber = (raw: string): boolean => {
    const checked = checkNumber(control, raw, ctx);
    if (!checked.ok) {
      showError(checked.message ?? 'That value was refused.');
      return false;
    }
    return commit(checked.value);
  };

  function refreshProvenance(): void {
    const source = settings.provenanceOf(control.id);
    const shipped = describeValue(settings.defaultOf(control.id) ?? control.defaultValue);
    const path = settings.filePath();
    if (source === 'user') {
      provenance.textContent = path
        ? t('settings.provenance.user', 'From your settings file at {path}.', { path })
        : t('settings.provenance.userNoPath', 'Set by you.');
    } else if (source === 'default') {
      provenance.textContent = t(
        'settings.provenance.default',
        'No file has ever set this. The application is using its built-in value: {value}.',
        { value: shipped }
      );
    } else if (source === 'scheduled') {
      provenance.textContent = t(
        'settings.provenance.scheduled',
        'A schedule is setting this right now. The built-in value is {value}.',
        { value: shipped }
      );
    } else {
      provenance.textContent = t(
        'settings.provenance.imported',
        'Came from an imported theme or settings file. The built-in value is {value}.',
        { value: shipped }
      );
    }
    const atShippedValue = source === 'default';
    resetButton.disabled = atShippedValue;
    resetButton.title = atShippedValue
      ? t('settings.row.resetDisabled', 'This is already the shipped value, so there is nothing to reset.')
      : '';
    if (atShippedValue) {
      resetButton.setAttribute('aria-description', resetButton.title);
    } else {
      resetButton.removeAttribute('aria-description');
    }
    // The "use the built-in value" shortcut only makes sense while the value is
    // NOT already the built-in one, and only for a control that holds a value.
    const holdsValue = control.kind !== 'action' && control.kind !== 'custom';
    suggested.hidden = atShippedValue || !holdsValue;
  }

  const settingContext = (): SettingContext => ({
    ...ctx,
    setting: control,
    value: currentValue(),
    setValue: (value: unknown) => {
      commit(value);
      rebuildBody();
    },
    provenance: settings.provenanceOf(control.id)
  });

  /* ---------------- the live control ---------------- */

  function buildControl(): HTMLElement {
    const value = currentValue();
    const shipped = describeValue(control.defaultValue);

    switch (control.kind) {
      case 'switch': {
        const handle = components.switchControl({
          label: control.label,
          checked: value === true,
          onChange: (next) => commit(next)
        });
        return handle.root;
      }

      case 'number': {
        const rangeHint =
          typeof control.min === 'number' && typeof control.max === 'number'
            ? t('settings.hint.range', 'Between {min} and {max}.', { min: control.min, max: control.max })
            : control.hint
              ? i18n.t(control.hint, control.hint)
              : t('settings.hint.suggested', 'Suggested: {value}', { value: shipped });
        const handle = components.textField({
          label: control.label,
          type: 'number',
          value: value === null || value === undefined ? '' : String(value),
          min: control.min,
          max: control.max,
          step: control.step,
          supportingText: rangeHint,
          onCommit: (raw) => commitNumber(raw)
        });
        return handle.root;
      }

      case 'slider': {
        const handle = components.slider({
          label: control.label,
          min: control.min ?? 0,
          max: control.max ?? 100,
          step: control.step ?? 1,
          value: Number(value ?? control.defaultValue ?? 0),
          onChange: (next) => commit(next)
        });
        return handle.root;
      }

      case 'select': {
        const choices = control.options ?? [];
        const handle = components.select({
          label: control.label,
          options:
            choices.length > 0 ? choices : [{ value: String(value ?? ''), label: String(value ?? '') }],
          value: String(value ?? ''),
          disabled: choices.length === 0,
          disabledReason: 'settings.disabled.noOptions',
          onChange: (next) => commit(next)
        });
        return handle.root;
      }

      case 'color': {
        const host = el('div', { className: 'settings-row__color' });
        const swatch = el('span', { className: 'settings-row__swatch', attrs: { 'aria-hidden': 'true' } });
        swatch.style.background = String(value ?? '#000000');
        const open = components.button({
          label: String(value ?? ''),
          variant: 'outlined',
          icon: 'palette',
          onClick: () => {
            openColorPicker({
              anchor: open,
              value: String(currentValue() ?? '#6750a4'),
              onChange: (next) => {
                if (!commit(next)) return;
                swatch.style.background = next;
                const labelNode = open.querySelector('.md-btn__label');
                if (labelNode) labelNode.textContent = next;
              }
            });
          }
        });
        host.append(swatch, open);
        return host;
      }

      case 'font': {
        const host = el('div', { className: 'settings-row__font' });
        const loading = el('p', {
          className: 'md-typescale-body-small',
          text: ctx.t('core.state.loading', 'Loading…'),
          attrs: { role: 'status' }
        });
        host.append(loading);
        // The list is real: the families this machine actually has, ahead of the
        // bundled fallback stack. A blank box would make the user guess a name.
        void ctx.theme
          .availableFonts()
          .then((families) => {
            loading.remove();
            const handle = components.select({
              label: control.label,
              value: String(value ?? ''),
              options: [
                { value: '', label: 'System default' },
                ...families.map((family) => ({ value: family, label: family }))
              ],
              onChange: (next) => commit(next)
            });
            host.append(handle.root);
          })
          .catch((error: unknown) => {
            loading.textContent =
              error instanceof Error ? error.message : 'The installed fonts could not be read on this machine.';
          });
        return host;
      }

      case 'path':
      case 'file':
      case 'folder': {
        const host = el('div', { className: 'settings-row__path' });
        const handle = components.textField({
          label: control.label,
          value: String(value ?? ''),
          supportingText: control.hint
            ? i18n.t(control.hint, control.hint)
            : t('settings.hint.sameValidation', 'A path you browse for runs through the same checks as one you type.'),
          // Both browse routes and the typed route land on the same onCommit, so
          // they cannot diverge.
          browse: control.kind === 'path' ? 'both' : control.kind === 'file' ? 'file' : 'folder',
          onCommit: (raw) => {
            commit(raw);
          }
        });
        host.append(handle.root);
        return host;
      }

      case 'action': {
        const node = components.button({
          label: control.label,
          variant: 'tonal',
          icon: 'play',
          onClick: () => {
            void Promise.resolve(control.run?.(settingContext())).catch((error: unknown) => {
              const message = error instanceof Error ? error.message : String(error);
              showError(message);
            });
          }
        });
        return node;
      }

      case 'custom': {
        const host = el('div', { className: 'settings-row__custom' });
        control.render?.(host, settingContext());
        return host;
      }

      case 'text':
      default: {
        const handle = components.textField({
          label: control.label,
          value: String(value ?? ''),
          supportingText: control.hint
            ? i18n.t(control.hint, control.hint)
            : t('settings.hint.suggested', 'Suggested: {value}', { value: shipped }),
          onCommit: (raw) => {
            commit(raw);
          }
        });
        return handle.root;
      }
    }
  }

  function rebuildBody(): void {
    body.textContent = '';
    const target = lockTarget;
    if (ctx.locks.isLocked(target) && !ctx.locks.isUnlocked(target)) {
      // A locked setting stays visible and says it is locked, with the route to
      // unlock it right here. It is a for-fun lock, not a hidden setting.
      const notice = el('p', {
        className: 'md-typescale-body-small',
        text: t('settings.disabled.locked', 'This setting is locked.')
      });
      const unlock = components.button({
        label: 'core.lock.unlockTitle',
        variant: 'tonal',
        icon: 'lockOpen',
        onClick: () => {
          void ctx.locks.unlock(target, unlock).then((unlocked) => {
            if (unlocked) rebuildBody();
          });
        }
      });
      body.append(notice, unlock);
      return;
    }
    body.append(buildControl());
  }

  /* ---------------- actions ---------------- */

  const actions = el('div', { className: 'settings-row__actions' });

  const resetButton = components.button({
    label: 'settings.row.reset',
    variant: 'text',
    icon: 'refresh',
    onClick: () => {
      doReset();
    }
  });

  function doReset(): void {
    if (settings.provenanceOf(control.id) === 'default') return;
    const previous = currentValue();
    settings.reset(control.id);
    clearError();
    rebuildBody();
    refreshProvenance();
    void ctx.history.record(`Reset ${i18n.t(control.label, control.label)}`, 'settings', {
      id: control.id,
      from: previous,
      to: settings.get(control.id, control.defaultValue)
    });
    ctx.a11y.announce(
      t('settings.announce.reset', '{label} was reset to {value}', {
        label: i18n.t(control.label, control.label),
        value: describeValue(settings.get(control.id, control.defaultValue))
      })
    );
  }

  const suggested = components.button({
    label: 'settings.hint.useSuggested',
    variant: 'text',
    icon: 'check',
    onClick: () => {
      if (commit(control.defaultValue)) rebuildBody();
    }
  });

  const copyId = components.iconButton({
    icon: 'copy',
    label: t('settings.row.copyId', 'Copy the setting id'),
    onClick: () => {
      void navigator.clipboard
        .writeText(control.id)
        .then(() => ctx.notify.success(t('settings.row.copied', 'Copied {id}', { id: control.id })))
        .catch(() => ctx.notify.warn(t('settings.row.copyId', 'Copy the setting id'), control.id));
    }
  });

  const appearanceButton = components.iconButton({
    icon: 'palette',
    label: t('settings.row.editAppearance', 'Edit appearance…'),
    onClick: () => ctx.appearance.edit(root, `[data-appearance-id="settings-row:${control.id}"]`)
  });

  actions.append(resetButton, suggested, copyId, appearanceButton);

  root.addEventListener('contextmenu', (event) => {
    if ((event.target as HTMLElement | null)?.closest('.md-field__input')) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.shiftKey) {
      ctx.appearance.edit(root, `[data-appearance-id="settings-row:${control.id}"]`);
      return;
    }
    components.menu({
      anchor: root,
      label: i18n.t(control.label, control.label),
      items: [
        {
          id: 'appearance',
          label: 'settings.row.editAppearance',
          icon: 'palette',
          shortcut: 'Shift+Right click',
          run: () => ctx.appearance.edit(root, `[data-appearance-id="settings-row:${control.id}"]`)
        },
        {
          id: 'lock',
          label: 'settings.row.lock',
          icon: 'lock',
          disabled: control.lockable === false,
          disabledReason:
            control.lockableReason ?? 'The feature that owns this setting opted out of locking it.',
          run: () => ctx.locks.wizard(root, lockTarget, i18n.t(control.label, control.label))
        },
        {
          id: 'reset',
          label: 'settings.row.reset',
          icon: 'refresh',
          separatorBefore: true,
          disabled: settings.provenanceOf(control.id) === 'default',
          disabledReason: 'settings.row.resetDisabled',
          run: () => doReset()
        },
        { id: 'copy', label: 'settings.row.copyId', icon: 'copy', run: () => copyId.click() }
      ]
    });
  });

  root.append(head, description, body, validation, provenance, actions);
  rebuildBody();
  refreshProvenance();

  const unsubscribe = settings.onChange((change) => {
    if (change.id !== control.id) return;
    refreshProvenance();
  });

  return {
    root,
    control,
    sectionId: section.id,
    sectionTitle,
    haystack: () =>
      [
        i18n.t(control.label, control.label),
        i18n.t(control.description, control.description),
        control.id,
        (control.keywords ?? []).join(' '),
        describeValue(currentValue()),
        describeValue(control.defaultValue),
        sectionTitle,
        (control.options ?? []).map((option) => `${option.value} ${i18n.t(option.label, option.label)}`).join(' ')
      ].join(' '),
    setVisible: (visible) => {
      root.hidden = !visible;
    },
    isVisible: () => !root.hidden,
    setSelectionMode: (on) => {
      selectHost.hidden = !on;
      if (!on && selectInput) {
        selectInput.checked = false;
        selected = false;
      }
    },
    setSelected: (on) => {
      selected = on;
      if (selectInput) selectInput.checked = on;
    },
    isSelected: () => selected,
    isChanged: () => settings.provenanceOf(control.id) !== 'default',
    reset: doReset,
    refresh: () => {
      idLine.hidden = !options.showId();
      rebuildBody();
      refreshProvenance();
    },
    destroy: () => {
      unsubscribe();
      root.remove();
    }
  };
}
