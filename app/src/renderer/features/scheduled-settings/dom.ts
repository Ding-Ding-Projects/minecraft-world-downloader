/**
 * The few DOM helpers this feature needs, kept inside the feature.
 *
 * Nothing here is clever: an element factory, and a wrapper that gives a native
 * `<input>` the same field anatomy — label, row, supporting text — that the
 * component kit gives its own controls, so a native date or time picker sits in
 * the interface without looking like it wandered in from another application.
 *
 * The pickers are deliberately native. A hand-built calendar is one more thing to
 * get wrong for a screen reader, and the platform's own date and time controls
 * already handle keyboard entry, locale ordering and the mobile keypad.
 */

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options: {
    className?: string;
    text?: string;
    attrs?: Record<string, string>;
    children?: Array<Node | null | undefined>;
  } = {}
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text !== undefined) node.textContent = options.text;
  if (options.attrs) {
    for (const [key, value] of Object.entries(options.attrs)) node.setAttribute(key, value);
  }
  if (options.children) {
    for (const child of options.children) if (child) node.append(child);
  }
  return node;
}

let counter = 0;
export function uid(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter.toString(36)}`;
}

export interface NativeFieldHandle {
  root: HTMLElement;
  input: HTMLInputElement;
  value(): string;
  setValue(value: string): void;
  setError(message: string): void;
  clearError(): void;
  focus(): void;
}

/**
 * A native input wearing the application's own field anatomy.
 *
 * `type` is passed straight through, so `date` and `time` are the platform's real
 * pickers rather than a text box with a regular expression taped to it.
 */
export function nativeField(options: {
  label: string;
  type: 'date' | 'time' | 'number' | 'text' | 'password';
  value?: string;
  supporting?: string;
  min?: string;
  max?: string;
  step?: string;
  required?: boolean;
  autocomplete?: string;
  onInput?(value: string): void;
  onCommit?(value: string): void;
}): NativeFieldHandle {
  const id = uid('schedule-field');
  const root = el('div', { className: 'md-field schedule-field' });
  const labelNode = el('label', {
    className: 'md-field__label',
    text: options.label,
    attrs: { for: id }
  });
  const row = el('div', { className: 'md-field__row' });
  const input = el('input', {
    className: 'md-field__input',
    attrs: {
      id,
      type: options.type,
      ...(options.min !== undefined ? { min: options.min } : {}),
      ...(options.max !== undefined ? { max: options.max } : {}),
      ...(options.step !== undefined ? { step: options.step } : {}),
      ...(options.required ? { required: 'required' } : {}),
      ...(options.autocomplete ? { autocomplete: options.autocomplete } : {})
    }
  });
  input.value = options.value ?? '';
  row.append(input);
  const support = el('div', {
    className: 'md-field__support',
    text: options.supporting ?? '',
    attrs: { id: `${id}-support` }
  });
  if (options.supporting) input.setAttribute('aria-describedby', `${id}-support`);
  root.append(labelNode, row, support);

  input.addEventListener('input', () => options.onInput?.(input.value));
  input.addEventListener('change', () => options.onCommit?.(input.value));

  return {
    root,
    input,
    value: () => input.value,
    setValue: (value: string) => {
      input.value = value;
    },
    setError: (message: string) => {
      root.classList.add('md-field--error');
      support.classList.add('md-field__support--error');
      support.textContent = message;
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', `${id}-support`);
    },
    clearError: () => {
      root.classList.remove('md-field--error');
      support.classList.remove('md-field__support--error');
      support.textContent = options.supporting ?? '';
      input.removeAttribute('aria-invalid');
    },
    focus: () => input.focus()
  };
}

/** A labelled block with a heading and a body, used to group editor fields. */
export function group(title: string, description?: string): { root: HTMLElement; body: HTMLElement } {
  const root = el('section', { className: 'schedule-group' });
  const heading = el('h3', { className: 'md-typescale-title-small schedule-group__title', text: title });
  root.append(heading);
  if (description) {
    root.append(el('p', { className: 'md-typescale-body-small schedule-group__hint', text: description }));
  }
  const body = el('div', { className: 'schedule-group__body' });
  root.append(body);
  return { root, body };
}

/**
 * A progressive-disclosure explanation.
 *
 * Collapsed by default so it never crowds the control it belongs to, and a real
 * `<details>` so the keyboard and the screen reader get the open state for free.
 */
export function explanation(summary: string, body: string): HTMLElement {
  const details = el('details', { className: 'schedule-explain' });
  const summaryNode = el('summary', { className: 'md-typescale-label-medium', text: summary });
  details.append(summaryNode, el('p', { className: 'md-typescale-body-small', text: body }));
  return details;
}

/** Formats a value for display without pretending an object is a string. */
export function displayValue(value: unknown): string {
  if (value === null || value === undefined) return '(none)';
  if (typeof value === 'string') return value === '' ? '(empty)' : value;
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return '(unreadable)';
  }
}
