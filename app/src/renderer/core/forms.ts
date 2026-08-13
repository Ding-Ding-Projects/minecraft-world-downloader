import { components } from './components';
import { i18n } from './i18n';
import type { ControlHandle, SelectOptions, TextFieldOptions } from './types';

/**
 * Guided forms: pickers populated from real data, sanitized suggested
 * defaults, inline plain-words validation, and a named reason on every
 * disabled control.
 *
 * The native browse control for a path field already lives in
 * `components.textField` (its `browse` option): a browsed value runs through
 * exactly the same `onChange`/`onCommit` callbacks a typed value does, which
 * is what guarantees the two can never be validated differently. This module
 * does not duplicate that — it builds the rest of a guided field on top of it:
 * a live inline validation message, and a real suggested default a person can
 * accept with one action instead of being asked to invent a value the
 * application could have proposed itself.
 */

export interface SuggestedDefault {
  /** i18n key or literal value offered as the suggestion. */
  value: string;
  /** i18n key explaining where the suggestion came from, e.g. "from your last profile". */
  reason?: string;
}

export interface GuidedFieldOptions extends Omit<TextFieldOptions, 'error'> {
  /** Validates the current value in plain words. Return null to accept. */
  validate?(value: string): string | null;
  /** A sanitized, real suggestion offered when the field is empty. */
  suggested?: SuggestedDefault;
}

export interface GuidedFieldHandle extends ControlHandle<string> {
  /** Re-runs validation against the current value. Returns true when valid. */
  revalidate(): boolean;
  /** The current validation message, or null when the value is accepted. */
  error(): string | null;
}

/**
 * A text field (with its native browse control when `browse` is set) that
 * validates inline in plain words and can offer a real suggested default.
 */
export function guidedTextField(options: GuidedFieldOptions): GuidedFieldHandle {
  const { validate, suggested: suggestedDefault, ...fieldOptions } = options;
  let currentError: string | null = validate ? validate(options.value ?? '') : null;

  const field = components.textField({
    ...fieldOptions,
    error: currentError ?? undefined,
    onChange: (value) => {
      currentError = validate ? validate(value) : null;
      paint();
      options.onChange?.(value);
    },
    onCommit: (value) => {
      currentError = validate ? validate(value) : null;
      paint();
      options.onCommit?.(value);
    }
  });

  const support = field.root.querySelector<HTMLElement>('.md-field__support');

  function paint(): void {
    if (!support) return;
    const message = currentError ?? (options.supportingText ? i18n.t(options.supportingText, options.supportingText) : '');
    support.textContent = message;
    support.classList.toggle('md-field__support--error', currentError !== null);
  }

  if (suggestedDefault && !(options.value ?? '')) {
    const row = document.createElement('div');
    row.className = 'md-guided-field__suggestion';
    const text = document.createElement('span');
    text.className = 'md-typescale-body-small';
    text.textContent = i18n.t('core.forms.suggested', 'Suggested: {value}', {
      values: { value: i18n.t(suggestedDefault.value, suggestedDefault.value) }
    });
    row.append(text);
    const use = components.button({
      label: 'core.forms.useSuggested',
      variant: 'text',
      onClick: () => {
        const value = i18n.t(suggestedDefault.value, suggestedDefault.value);
        field.set(value);
        currentError = validate ? validate(value) : null;
        paint();
        options.onChange?.(value);
        options.onCommit?.(value);
      }
    });
    row.append(use);
    if (suggestedDefault.reason) {
      const reason = document.createElement('span');
      reason.className = 'md-typescale-body-small md-guided-field__reason';
      reason.textContent = i18n.t(suggestedDefault.reason, suggestedDefault.reason);
      row.append(reason);
    }
    field.root.append(row);
  }

  return {
    ...field,
    revalidate: () => {
      currentError = validate ? validate(field.get()) : null;
      paint();
      return currentError === null;
    },
    error: () => currentError
  };
}

/**
 * A picker populated from real, enumerable data — never an empty text box
 * when a real list of valid values exists. Thin wrapper over
 * `components.select` so the disabled-reason contract stays enforced in one
 * place (see `components.ts`'s `applyDisabled`), and so a guided form reaches
 * for the same picker every other surface in the application uses.
 */
export function guidedSelect(options: SelectOptions & { emptyReason?: string }): ControlHandle<string> {
  const { emptyReason, ...selectOptions } = options;
  if (selectOptions.options.length === 0 && !selectOptions.disabled) {
    // A picker with nothing to pick from is functionally disabled, and must
    // say so rather than rendering an inert control with no explanation.
    return components.select({
      ...selectOptions,
      disabled: true,
      disabledReason: emptyReason ?? i18n.t('core.forms.noOptions', 'There is nothing real to choose from yet.')
    });
  }
  return components.select(selectOptions);
}
