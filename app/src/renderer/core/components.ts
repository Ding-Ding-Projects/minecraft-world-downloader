import { a11y, el, nextId } from './a11y';
import { iconElement } from './icons';
import { i18n } from './i18n';
import { overlay } from './overlay';
import { createSearchBar } from './searchbar';
import type {
  ButtonOptions,
  CardOptions,
  CheckboxOptions,
  ChipOptions,
  ComponentKit,
  ControlHandle,
  DataTableHandle,
  DataTableOptions,
  DatePickerOptions,
  DialogOptions,
  FabOptions,
  IconButtonOptions,
  ListItemOptions,
  MenuItem,
  MenuOptions,
  NotificationSeverity,
  OverlayHandle,
  ProgressOptions,
  RadioGroupOptions,
  SegmentedOption,
  SelectOptions,
  SliderOptions,
  SwitchOptions,
  TabBarOptions,
  TextFieldOptions
} from './types';

/**
 * The shared Material Design 3 component kit.
 *
 * Two rules are baked in here rather than left to each caller.
 *
 * Every dropdown, select and menu opens with a keyboard-focusable filter field
 * at its head, and that field carries its own anchored pattern builder. A
 * four-item menu grows to fourteen without anybody revisiting the decision, and
 * a user who has learned to type in one dropdown and finds the next one inert
 * has learned that the pattern is unreliable — which is worse than never having
 * had it. Consistency is the feature; the filtering is a side effect.
 *
 * Every disabled control names the condition that is unmet. A disabled button
 * with no explanation reads as broken rather than as blocked, so `disabled`
 * always travels with `disabledReason`.
 */

function label(text: string): string {
  return i18n.t(text, text);
}

function applyDisabled(element: HTMLButtonElement | HTMLInputElement, disabled: boolean, reason?: string): void {
  element.disabled = disabled;
  if (disabled) {
    const explanation = reason ? label(reason) : '';
    element.title = explanation;
    if (explanation) element.setAttribute('aria-description', explanation);
    // Enforced here rather than hoped for, because this is the one function
    // every disabled control in the application passes through. A disabled
    // control with no explanation reads as broken rather than as blocked, so
    // a development build says so at the exact call site that got it wrong.
    if (!explanation && import.meta.env.DEV) {
      console.warn(
        `A control was disabled with no disabledReason (element: ${element.tagName.toLowerCase()}${
          element.id ? `#${element.id}` : ''
        }). Every disabled control must name the exact condition that is unmet.`
      );
    }
  } else {
    element.removeAttribute('title');
    element.removeAttribute('aria-description');
  }
}

/* ------------------------------------------------------------------ */
/* Buttons                                                             */
/* ------------------------------------------------------------------ */

function button(options: ButtonOptions): HTMLButtonElement {
  const variant = options.variant ?? 'filled';
  const node = el('button', {
    className: `md-btn md-btn--${variant}${options.danger ? ' md-btn--danger' : ''}`,
    attrs: { type: 'button' }
  });
  if (options.id) node.id = options.id;
  if (options.icon) node.append(iconElement(options.icon));
  node.append(el('span', { className: 'md-btn__label', text: label(options.label) }));
  if (options.trailingIcon) node.append(iconElement(options.trailingIcon));
  applyDisabled(node, options.disabled === true, options.disabledReason);
  if (options.onClick) node.addEventListener('click', options.onClick);
  a11y.assertTouchTarget(node, `button:${options.label}`);
  return node;
}

function iconButton(options: IconButtonOptions): HTMLButtonElement {
  const variant = options.variant ?? 'standard';
  const node = el('button', {
    className: `md-icon-btn md-icon-btn--${variant}`,
    attrs: { type: 'button', 'aria-label': label(options.label) }
  });
  if (options.id) node.id = options.id;
  if (options.toggled !== undefined) node.setAttribute('aria-pressed', String(options.toggled));
  node.append(iconElement(options.icon));
  applyDisabled(node, options.disabled === true, options.disabledReason);
  // `applyDisabled` clears `title` whenever the control is enabled (it uses
  // that attribute to carry the disabled-reason explanation, and removes it
  // once there is nothing to explain). An icon button's `title` is not only
  // that explanation — it is the hover tooltip that stands in for the visible
  // text label every other button has, so it is applied here, after
  // `applyDisabled`, rather than up front where a call to `applyDisabled`
  // would silently strip it from every icon button that is not disabled.
  if (options.disabled !== true) node.title = label(options.label);
  if (options.onClick) node.addEventListener('click', options.onClick);
  a11y.assertTouchTarget(node, `icon-button:${options.label}`);
  return node;
}

function fab(options: FabOptions): HTMLButtonElement {
  const node = el('button', {
    className: `md-fab md-fab--${options.size ?? 'medium'}`,
    attrs: { type: 'button', 'aria-label': label(options.label ?? options.icon) }
  });
  node.append(iconElement(options.icon, options.size === 'large' ? 32 : 24));
  if (options.label) node.append(el('span', { text: label(options.label) }));
  if (options.onClick) node.addEventListener('click', options.onClick);
  return node;
}

/* ------------------------------------------------------------------ */
/* Surfaces                                                            */
/* ------------------------------------------------------------------ */

function card(options: CardOptions = {}): HTMLElement {
  const variant = options.variant ?? 'filled';
  const tag = options.onClick ? 'button' : 'div';
  const node = el(tag, {
    className: `md-card md-card--${variant}${options.onClick ? ' md-card--interactive' : ''}`
  }) as HTMLElement;
  if (options.onClick) {
    node.setAttribute('type', 'button');
    node.addEventListener('click', options.onClick);
  }
  if (options.title) node.append(el('h3', { className: 'md-typescale-title-medium', text: label(options.title) }));
  if (options.subtitle) {
    node.append(el('p', { className: 'md-typescale-body-small md-setting__secondary', text: label(options.subtitle) }));
  }
  return node;
}

function chip(options: ChipOptions): HTMLElement {
  const node = el('button', {
    className: 'md-chip',
    attrs: { type: 'button', 'aria-pressed': String(options.selected === true) }
  });
  if (options.icon) node.append(iconElement(options.icon, 18));
  node.append(el('span', { text: label(options.label) }));
  node.addEventListener('click', () => {
    const next = node.getAttribute('aria-pressed') !== 'true';
    node.setAttribute('aria-pressed', String(next));
    options.onToggle?.(next);
  });
  if (options.removable) {
    const remove = iconButton({
      icon: 'close',
      label: i18n.t('core.action.dismiss', 'Dismiss'),
      onClick: (event) => {
        event.stopPropagation();
        options.onRemove?.();
        node.remove();
      }
    });
    remove.classList.add('md-chip__remove');
    node.append(remove);
  }
  return node;
}

function badge(options: { label: string; severity?: NotificationSeverity }): HTMLElement {
  const severity = options.severity ?? 'info';
  return el('span', {
    className: `md-badge${severity === 'info' || severity === 'progress' ? '' : ` md-badge--${severity}`}`,
    text: label(options.label)
  });
}

function divider(vertical = false): HTMLElement {
  return el('hr', { className: `md-divider${vertical ? ' md-divider--vertical' : ''}` });
}

/* ------------------------------------------------------------------ */
/* Selection controls                                                  */
/* ------------------------------------------------------------------ */

function switchControl(options: SwitchOptions): ControlHandle<boolean> {
  const id = options.id ?? nextId('md-switch');
  const root = el('label', { className: 'md-switch', attrs: { for: id } });
  const text = el('span', { className: 'md-typescale-body-large', text: label(options.label) });
  const control = el('span', { className: 'md-switch__control' });
  const input = el('input', { attrs: { id, type: 'checkbox', role: 'switch' } });
  input.checked = options.checked === true;
  const track = el('span', { className: 'md-switch__track', attrs: { 'aria-hidden': 'true' } });
  track.append(el('span', { className: 'md-switch__thumb' }));
  control.append(input, track);
  root.append(text, control);
  applyDisabled(input, options.disabled === true, options.disabledReason);
  input.addEventListener('change', () => options.onChange?.(input.checked));
  a11y.assertTouchTarget(root, `switch:${options.label}`);
  return {
    root,
    get: () => input.checked,
    set: (value) => {
      input.checked = value;
    },
    setDisabled: (disabled, reason) => applyDisabled(input, disabled, reason),
    focus: () => input.focus()
  };
}

function checkbox(options: CheckboxOptions): ControlHandle<boolean> {
  const id = options.id ?? nextId('md-checkbox');
  const root = el('label', { className: 'md-checkbox', attrs: { for: id } });
  const input = el('input', { attrs: { id, type: 'checkbox' } });
  input.checked = options.checked === true;
  input.indeterminate = options.indeterminate === true;
  root.append(input, el('span', { text: label(options.label) }));
  applyDisabled(input, options.disabled === true, options.disabledReason);
  input.addEventListener('change', () => options.onChange?.(input.checked));
  return {
    root,
    get: () => input.checked,
    set: (value) => {
      input.checked = value;
      input.indeterminate = false;
    },
    setDisabled: (disabled, reason) => applyDisabled(input, disabled, reason),
    focus: () => input.focus()
  };
}

function radioGroup(options: RadioGroupOptions): ControlHandle<string> {
  const name = options.id ?? nextId('md-radio');
  const root = el('fieldset', { className: 'md-radiogroup' });
  root.append(el('legend', { className: 'md-field__label', text: label(options.label) }));
  const inputs: HTMLInputElement[] = [];
  for (const option of options.options) {
    const id = nextId('md-radio-option');
    const row = el('label', { className: 'md-radio', attrs: { for: id } });
    const input = el('input', { attrs: { id, type: 'radio', name, value: option.value } });
    input.checked = options.value === option.value;
    input.addEventListener('change', () => {
      if (input.checked) options.onChange?.(option.value);
    });
    inputs.push(input);
    row.append(input, el('span', { text: label(option.label) }));
    root.append(row);
  }
  return {
    root,
    get: () => inputs.find((input) => input.checked)?.value ?? '',
    set: (value) => {
      for (const input of inputs) input.checked = input.value === value;
    },
    setDisabled: (disabled, reason) => {
      for (const input of inputs) applyDisabled(input, disabled, reason);
    },
    focus: () => inputs[0]?.focus()
  };
}

function segmentedButton(options: {
  label: string;
  options: SegmentedOption[];
  value?: string;
  onChange?(value: string): void;
  id?: string;
}): ControlHandle<string> {
  const root = el('div', {
    className: 'md-segmented',
    attrs: { role: 'group', 'aria-label': label(options.label) }
  });
  if (options.id) root.id = options.id;
  let value = options.value ?? options.options[0]?.value ?? '';
  const buttons: HTMLButtonElement[] = [];
  for (const option of options.options) {
    const node = el('button', {
      className: 'md-segmented__item',
      attrs: { type: 'button', 'aria-pressed': String(option.value === value), value: option.value }
    });
    if (option.icon) node.append(iconElement(option.icon, 18));
    node.append(el('span', { text: label(option.label) }));
    node.addEventListener('click', () => {
      value = option.value;
      for (const other of buttons) other.setAttribute('aria-pressed', String(other.getAttribute('value') === value));
      options.onChange?.(value);
    });
    buttons.push(node);
    root.append(node);
  }
  a11y.roving(root, () => buttons, 'horizontal');
  return {
    root,
    get: () => value,
    set: (next) => {
      value = next;
      for (const node of buttons) node.setAttribute('aria-pressed', String(node.getAttribute('value') === value));
    },
    setDisabled: (disabled, reason) => {
      for (const node of buttons) applyDisabled(node, disabled, reason);
    },
    focus: () => buttons[0]?.focus()
  };
}

function slider(options: SliderOptions): ControlHandle<number> {
  const id = options.id ?? nextId('md-slider');
  const root = el('div', { className: 'md-slider' });
  root.append(el('label', { className: 'md-field__label', text: label(options.label), attrs: { for: id } }));
  const row = el('div', { className: 'md-slider__row' });
  const input = el('input', {
    attrs: {
      id,
      type: 'range',
      min: String(options.min),
      max: String(options.max),
      step: String(options.step ?? 1)
    }
  });
  input.value = String(options.value ?? options.min);
  const readout = el('output', {
    className: 'md-slider__value md-typescale-label-large',
    attrs: { for: id },
    text: `${input.value}${options.unit ? ` ${options.unit}` : ''}`
  });
  input.addEventListener('input', () => {
    readout.textContent = `${input.value}${options.unit ? ` ${options.unit}` : ''}`;
    options.onChange?.(Number(input.value));
  });
  row.append(input, readout);
  root.append(row);
  if (options.showTicks) {
    const ticks = el('div', { className: 'md-slider__ticks md-typescale-label-small' });
    for (let value = options.min; value <= options.max; value += options.step ?? 1) {
      ticks.append(el('span', { text: String(value) }));
    }
    root.append(ticks);
  }
  return {
    root,
    get: () => Number(input.value),
    set: (value) => {
      input.value = String(value);
      readout.textContent = `${input.value}${options.unit ? ` ${options.unit}` : ''}`;
    },
    setDisabled: (disabled, reason) => applyDisabled(input, disabled, reason),
    focus: () => input.focus()
  };
}

/* ------------------------------------------------------------------ */
/* Text field                                                          */
/* ------------------------------------------------------------------ */

function textField(options: TextFieldOptions): ControlHandle<string> {
  const id = options.id ?? nextId('md-textfield');
  const root = el('div', {
    className: `md-field md-field--${options.variant ?? 'outlined'}${options.error ? ' md-field--error' : ''}`
  });
  root.append(el('label', { className: 'md-field__label', text: label(options.label), attrs: { for: id } }));

  const row = el('div', { className: 'md-field__row' });
  if (options.prefix) row.append(el('span', { className: 'md-field__affix', text: options.prefix }));

  const input = options.multiline
    ? el('textarea', { className: 'md-field__input', attrs: { id, rows: String(options.rows ?? 4) } })
    : el('input', {
        className: 'md-field__input',
        attrs: { id, type: options.type ?? 'text', autocomplete: 'off' }
      });
  if (!options.multiline) {
    const typed = input as HTMLInputElement;
    if (options.min !== undefined) typed.min = String(options.min);
    if (options.max !== undefined) typed.max = String(options.max);
    if (options.step !== undefined) typed.step = String(options.step);
  }
  input.value = options.value ?? '';
  if (options.placeholder) input.setAttribute('placeholder', label(options.placeholder));
  row.append(input);

  if (options.suffix) row.append(el('span', { className: 'md-field__affix', text: options.suffix }));

  // A path field always carries a native browse control beside it, and a browsed
  // value runs through exactly the same validation as a typed one.
  if (options.browse) {
    if (options.browse === 'file' || options.browse === 'both') {
      row.append(
        iconButton({
          icon: 'file',
          label: i18n.t('core.action.browse', 'Browse…'),
          onClick: () => {
            void window.studio.dialog.openFile().then((result) => {
              if (result.ok && result.value && result.value[0]) {
                input.value = result.value[0];
                options.onChange?.(input.value);
                options.onCommit?.(input.value);
              }
            });
          }
        })
      );
    }
    if (options.browse === 'folder' || options.browse === 'both') {
      row.append(
        iconButton({
          icon: 'folder',
          label: i18n.t('core.action.browseFolder', 'Browse for folder…'),
          onClick: () => {
            void window.studio.dialog.openFolder().then((result) => {
              if (result.ok && result.value && result.value[0]) {
                input.value = result.value[0];
                options.onChange?.(input.value);
                options.onCommit?.(input.value);
              }
            });
          }
        })
      );
    }
  }

  root.append(row);

  const support = el('p', {
    className: `md-field__support${options.error ? ' md-field__support--error' : ''}`,
    text: options.error ? label(options.error) : options.supportingText ? label(options.supportingText) : ''
  });
  root.append(support);

  input.addEventListener('input', () => options.onChange?.(input.value));
  input.addEventListener('change', () => options.onCommit?.(input.value));

  return {
    root,
    get: () => input.value,
    set: (value) => {
      input.value = value;
    },
    setDisabled: (disabled, reason) => applyDisabled(input as HTMLInputElement, disabled, reason),
    focus: () => input.focus()
  };
}

/* ------------------------------------------------------------------ */
/* Menu and select                                                     */
/* ------------------------------------------------------------------ */

function menu(options: MenuOptions): OverlayHandle {
  const handle = overlay.open({
    anchor: options.anchor,
    placement: options.placement ?? 'bottom-start',
    role: 'menu',
    label: options.label ? label(options.label) : i18n.t('core.action.more', 'More'),
    onClose: options.onClose
  });
  handle.root.classList.add('md-menu-surface');

  const container = el('div', { className: 'md-menu' });
  const searchHost = el('div', { className: 'md-menu__search' });
  const list = el('ul', { className: 'md-menu__list', attrs: { role: 'none' } });
  const empty = el('p', {
    className: 'md-menu__empty md-typescale-body-medium',
    text: i18n.t('core.search.noMatches', 'Nothing matched.')
  });
  empty.hidden = true;

  const rows: Array<{ item: MenuItem; node: HTMLLIElement; button: HTMLButtonElement }> = [];

  const build = (): void => {
    list.textContent = '';
    rows.length = 0;
    for (const item of options.items) {
      if (item.separatorBefore) list.append(el('li', { className: 'md-menu__separator', attrs: { role: 'none' } }));
      const node = el('li', { attrs: { role: 'none' } });
      const node_button = el('button', {
        className: `md-menu__item${item.danger ? ' md-menu__item--danger' : ''}`,
        attrs: { type: 'button', role: 'menuitem' }
      });
      if (item.icon) node_button.append(iconElement(item.icon, 18));
      node_button.append(el('span', { className: 'md-menu__item-label', text: label(item.label) }));
      // The shortcut shown is the one that genuinely works in this context.
      if (item.shortcut) {
        node_button.append(el('kbd', { className: 'md-menu__shortcut', text: item.shortcut }));
        node_button.setAttribute('aria-keyshortcuts', item.shortcut.replace(/\+/g, '+'));
      }
      if (item.children && item.children.length > 0) {
        node_button.append(iconElement('chevronRight', 16));
        node_button.setAttribute('aria-haspopup', 'menu');
        node_button.addEventListener('click', () => {
          menu({ anchor: node_button, items: item.children ?? [], label: item.label, placement: 'right' });
        });
      } else {
        node_button.addEventListener('click', () => {
          void item.run?.();
          handle.close();
        });
      }
      applyDisabled(node_button, item.disabled === true, item.disabledReason);
      node.append(node_button);
      list.append(node);
      rows.push({ item, node, button: node_button });
    }
  };

  build();

  // Every menu gets its own filter field with its own anchored builder. Filtering
  // hides rows; it never reorders them into a different meaning and never changes
  // what an item does.
  const search = createSearchBar({
    label: 'core.search.label',
    compact: true,
    sample: options.items.map((item) => label(item.label)).join('\n'),
    onChange: (query) => {
      let visible = 0;
      for (const row of rows) {
        const matched = query.matches(label(row.item.label));
        row.node.hidden = !matched;
        if (matched) visible += 1;
      }
      empty.hidden = visible > 0;
    },
    onEscape: () => handle.close()
  });
  searchHost.append(search.root);

  container.append(searchHost, list, empty);
  handle.body.append(container);

  a11y.roving(list, () => rows.filter((row) => !row.node.hidden).map((row) => row.button), 'vertical');

  window.requestAnimationFrame(() => {
    search.focus();
    handle.reposition();
  });

  list.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      handle.close();
      return;
    }
    if (event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
      search.setText(search.input.value + event.key);
      search.focus();
    }
  });

  return handle;
}

function select(options: SelectOptions): ControlHandle<string> {
  const id = options.id ?? nextId('md-select');
  const root = el('div', { className: 'md-select' });
  root.append(el('label', { className: 'md-field__label', text: label(options.label), attrs: { for: id } }));

  let value = options.value ?? options.options[0]?.value ?? '';
  const trigger = el('button', {
    className: 'md-select__button',
    attrs: { id, type: 'button', 'aria-haspopup': 'listbox', 'aria-expanded': 'false' }
  });
  const text = el('span', { className: 'md-select__value' });
  const render = (): void => {
    const found = options.options.find((option) => option.value === value);
    text.textContent = found ? label(found.label) : value;
  };
  render();
  trigger.append(text, iconElement('chevronDown', 18));
  applyDisabled(trigger, options.disabled === true, options.disabledReason);

  trigger.addEventListener('click', () => {
    trigger.setAttribute('aria-expanded', 'true');
    const handle = menu({
      anchor: trigger,
      label: options.label,
      items: options.options.map((option) => ({
        id: option.value,
        label: option.label,
        icon: option.value === value ? 'check' : undefined,
        run: () => {
          value = option.value;
          render();
          options.onChange?.(value);
        }
      })),
      onClose: () => trigger.setAttribute('aria-expanded', 'false')
    });
    handle.root.setAttribute('role', 'listbox');
  });

  root.append(trigger);
  a11y.assertTouchTarget(trigger, `select:${options.label}`);

  return {
    root,
    get: () => value,
    set: (next) => {
      value = next;
      render();
    },
    setDisabled: (disabled, reason) => applyDisabled(trigger, disabled, reason),
    focus: () => trigger.focus()
  };
}

/* ------------------------------------------------------------------ */
/* Lists                                                               */
/* ------------------------------------------------------------------ */

function list(options: { label?: string } = {}): HTMLElement {
  return el('ul', {
    className: 'md-list',
    attrs: options.label ? { role: 'list', 'aria-label': label(options.label) } : { role: 'list' }
  });
}

function listItem(options: ListItemOptions): HTMLElement {
  const row = el('li', { className: 'md-list-item' });
  if (options.id) row.id = options.id;
  if (options.selectable) {
    const box = checkbox({
      label: options.headline,
      checked: options.selected,
      onChange: (checked) => options.onSelectChange?.(checked)
    });
    box.root.classList.add('md-list-item__select');
    box.root.querySelector('span')?.classList.add('md-visually-hidden');
    row.append(box.root);
  }
  if (options.leadingIcon) row.append(iconElement(options.leadingIcon));
  const text = el('div', { className: 'md-list-item__text' });
  text.append(el('span', { className: 'md-typescale-body-large', text: label(options.headline) }));
  if (options.supporting) {
    text.append(el('span', { className: 'md-list-item__supporting', text: label(options.supporting) }));
  }
  row.append(text);
  if (options.trailing) {
    row.append(typeof options.trailing === 'string' ? el('span', { text: options.trailing }) : options.trailing);
  }
  if (options.onActivate) {
    row.setAttribute('role', 'button');
    row.tabIndex = 0;
    row.addEventListener('click', () => options.onActivate?.());
    row.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        options.onActivate?.();
      }
    });
  }
  if (options.selected !== undefined) row.setAttribute('aria-selected', String(options.selected));
  return row;
}

/* ------------------------------------------------------------------ */
/* Dialog                                                              */
/* ------------------------------------------------------------------ */

function dialog(options: DialogOptions): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const scrim = el('div', { className: 'md-dialog-scrim' });
    const surface = el('div', {
      className: 'md-dialog',
      attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': nextId('md-dialog-title') }
    });
    const titleId = surface.getAttribute('aria-labelledby') as string;

    const header = el('div', { className: 'md-dialog__header' });
    if (options.icon) header.append(iconElement(options.icon, 24));
    header.append(
      el('h2', {
        className: 'md-typescale-headline-small',
        text: i18n.t(options.title, options.title, { dialog: true }),
        attrs: { id: titleId }
      })
    );

    const body = el('div', { className: 'md-dialog__body' });
    if (typeof options.body === 'string') {
      body.append(el('p', { className: 'md-typescale-body-medium', text: label(options.body) }));
    } else if (options.body) {
      body.append(options.body);
    }

    const actions = el('div', { className: 'md-dialog__actions' });
    const finish = (result: boolean): void => {
      release();
      scrim.remove();
      previousFocus?.focus({ preventScroll: true });
      resolve(result);
    };

    for (const extra of options.extraActions ?? []) {
      actions.append(button({ ...extra, variant: extra.variant ?? 'text' }));
    }
    actions.append(
      button({
        label: options.cancelLabel ?? i18n.t('core.action.cancel', 'Cancel'),
        variant: 'text',
        onClick: () => finish(false)
      }),
      button({
        label: options.confirmLabel ?? i18n.t('core.action.ok', 'OK'),
        variant: 'filled',
        onClick: () => finish(true)
      })
    );

    surface.append(header, body, actions);
    scrim.append(surface);
    document.body.append(scrim);

    const release = a11y.trapFocus(surface);
    surface.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') finish(false);
    });
    scrim.addEventListener('pointerdown', (event) => {
      if (event.target === scrim) finish(false);
    });
    window.requestAnimationFrame(() => surface.querySelector<HTMLElement>('button')?.focus());
  });
}

/* ------------------------------------------------------------------ */
/* Navigation                                                          */
/* ------------------------------------------------------------------ */

function tabBar(options: TabBarOptions): HTMLElement {
  const root = el('div', {
    className: `md-tabbar md-tabbar--${options.variant ?? 'primary'}`,
    attrs: { role: 'tablist', 'aria-orientation': 'horizontal' }
  });
  const buttons: HTMLButtonElement[] = [];
  let active = options.active ?? options.tabs[0]?.id ?? '';
  for (const tab of options.tabs) {
    const node = el('button', {
      className: 'md-tab',
      attrs: { type: 'button', role: 'tab', 'aria-selected': String(tab.id === active), 'data-tab-id': tab.id }
    });
    if (tab.icon) node.append(iconElement(tab.icon, 18));
    node.append(el('span', { className: 'md-tab__label', text: label(tab.label) }));
    node.addEventListener('click', () => {
      active = tab.id;
      for (const other of buttons) other.setAttribute('aria-selected', String(other.dataset.tabId === active));
      options.onChange?.(active);
    });
    buttons.push(node);
    root.append(node);
  }
  a11y.roving(root, () => buttons, 'horizontal');
  return root;
}

function navigationRail(options: TabBarOptions): HTMLElement {
  const root = tabBar(options);
  root.classList.add('md-navrail');
  root.setAttribute('aria-orientation', 'vertical');
  a11y.roving(root, () => [...root.querySelectorAll<HTMLButtonElement>('.md-tab')], 'vertical');
  return root;
}

function topAppBar(options: { title: string; subtitle?: string; actions?: HTMLElement[] }): HTMLElement {
  const root = el('header', { className: 'md-topbar' });
  const text = el('div', { className: 'md-topbar__text' });
  text.append(el('h1', { className: 'md-typescale-headline-small', text: label(options.title) }));
  if (options.subtitle) {
    text.append(el('p', { className: 'md-typescale-body-medium md-setting__secondary', text: label(options.subtitle) }));
  }
  root.append(text);
  if (options.actions && options.actions.length > 0) {
    const actions = el('div', { className: 'md-topbar__actions' });
    for (const action of options.actions) actions.append(action);
    root.append(actions);
  }
  return root;
}

function tooltip(element: HTMLElement, text: string): () => void {
  let handle: OverlayHandle | null = null;
  const show = (): void => {
    if (handle) return;
    handle = overlay.open({
      anchor: element,
      placement: 'bottom-start',
      role: 'tooltip',
      label: label(text),
      lightDismiss: false
    });
    handle.root.classList.add('md-tooltip');
    handle.body.append(el('span', { className: 'md-typescale-body-small', text: label(text) }));
    handle.reposition();
  };
  const hide = (): void => {
    handle?.close();
    handle = null;
  };
  element.addEventListener('pointerenter', show);
  element.addEventListener('pointerleave', hide);
  element.addEventListener('focus', show);
  element.addEventListener('blur', hide);
  if (!element.hasAttribute('aria-label') && !element.hasAttribute('aria-labelledby')) {
    element.setAttribute('aria-label', label(text));
  }
  return () => {
    hide();
    element.removeEventListener('pointerenter', show);
    element.removeEventListener('pointerleave', hide);
    element.removeEventListener('focus', show);
    element.removeEventListener('blur', hide);
  };
}

/* ------------------------------------------------------------------ */
/* Progress                                                            */
/* ------------------------------------------------------------------ */

function linearProgress(options: ProgressOptions): ControlHandle<number> {
  const root = el('div', {
    className: `md-progress-linear${options.value === undefined ? ' md-progress-linear--indeterminate' : ''}`,
    attrs: {
      role: 'progressbar',
      'aria-label': label(options.label),
      'aria-valuemin': '0',
      'aria-valuemax': '100'
    }
  });
  const bar = el('div', { className: 'md-progress-linear__bar' });
  root.append(bar);
  const apply = (value: number): void => {
    const percent = Math.min(100, Math.max(0, value * 100));
    bar.style.inlineSize = `${percent}%`;
    root.setAttribute('aria-valuenow', String(Math.round(percent)));
    root.classList.remove('md-progress-linear--indeterminate');
  };
  if (options.value !== undefined) apply(options.value);
  return {
    root,
    get: () => Number(root.getAttribute('aria-valuenow') ?? 0) / 100,
    set: apply,
    setDisabled: () => undefined,
    focus: () => root.focus()
  };
}

function circularProgress(options: ProgressOptions): ControlHandle<number> {
  const root = el('div', {
    className: 'md-progress-circular',
    attrs: { role: 'progressbar', 'aria-label': label(options.label) }
  });
  if (options.size) {
    root.style.inlineSize = `${options.size}px`;
    root.style.blockSize = `${options.size}px`;
  }
  return {
    root,
    get: () => 0,
    set: (value) => root.setAttribute('aria-valuenow', String(Math.round(value * 100))),
    setDisabled: () => undefined,
    focus: () => root.focus()
  };
}

/* ------------------------------------------------------------------ */
/* Date picker                                                         */
/* ------------------------------------------------------------------ */

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
];

function isoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parses a typed date.
 *
 * Plain ISO is accepted alongside the locale's own order, and a partial or
 * unparseable entry is reported inline WITHOUT discarding what the user typed —
 * clearing the field under somebody mid-entry is the fastest way to make a date
 * control unusable.
 */
export function parseTypedDate(input: string): { date: string | null; error: string | null } {
  const value = input.trim();
  if (value === '') return { date: null, error: null };
  const iso = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const date = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    if (Number.isNaN(date.getTime())) return { date: null, error: 'That is not a real date.' };
    return { date: isoDate(date), error: null };
  }
  const parts = value.split(/[/.\-\s]+/).filter((part) => part.length > 0);
  if (parts.length < 3) return { date: null, error: 'Enter a full date, for example 2026-08-13.' };
  const probe = new Date(value);
  if (!Number.isNaN(probe.getTime())) return { date: isoDate(probe), error: null };
  return { date: null, error: 'That date could not be read. Try the form 2026-08-13.' };
}

function datePicker(options: DatePickerOptions): ControlHandle<{ start: string | null; end: string | null }> {
  const root = el('div', { className: 'md-datepicker' });
  let start = options.value ?? null;
  let end = options.rangeEnd ?? null;

  const field = textField({
    label: options.label,
    value: options.range ? [start, end].filter(Boolean).join(' … ') : (start ?? ''),
    placeholder: options.range ? '2026-01-01 … 2026-12-31' : '2026-08-13',
    supportingText: 'Type a date, or open the calendar.',
    id: options.id
  });

  const openButton = iconButton({
    icon: 'calendar',
    label: i18n.t('core.history.filterDate', 'Date range'),
    onClick: () => openCalendar()
  });
  field.root.querySelector('.md-field__row')?.append(openButton);

  const emit = (): void => {
    field.set(options.range ? [start, end].filter(Boolean).join(' … ') : (start ?? ''));
    options.onChange?.({ start, end });
  };

  field.root.querySelector<HTMLInputElement>('.md-field__input')?.addEventListener('change', (event) => {
    const raw = (event.target as HTMLInputElement).value;
    const support = field.root.querySelector('.md-field__support');
    if (options.range) {
      const [left, right] = raw.split(/\s*(?:…|\.\.\.|to)\s*/);
      const a = parseTypedDate(left ?? '');
      const b = parseTypedDate(right ?? '');
      if (a.error || b.error) {
        if (support) {
          support.textContent = a.error ?? b.error ?? '';
          support.classList.add('md-field__support--error');
        }
        return;
      }
      start = a.date;
      end = b.date;
    } else {
      const parsed = parseTypedDate(raw);
      if (parsed.error) {
        if (support) {
          support.textContent = parsed.error;
          support.classList.add('md-field__support--error');
        }
        return;
      }
      start = parsed.date;
    }
    if (support) {
      support.textContent = '';
      support.classList.remove('md-field__support--error');
    }
    options.onChange?.({ start, end });
  });

  const openCalendar = (): void => {
    const handle = overlay.open({
      anchor: openButton,
      placement: 'bottom-start',
      role: 'dialog',
      label: label(options.label)
    });
    const body = handle.body;
    const cursor = new Date(start ? `${start}T00:00:00` : Date.now());
    cursor.setDate(1);

    const header = el('div', { className: 'md-datepicker__header' });
    const monthSelect = select({
      label: 'Month',
      options: MONTHS.map((name, index) => ({ value: String(index), label: name })),
      value: String(cursor.getMonth()),
      onChange: (value) => {
        cursor.setMonth(Number(value));
        drawGrid();
      }
    });
    const thisYear = new Date().getFullYear();
    const yearSelect = select({
      label: 'Year',
      options: Array.from({ length: 41 }, (_unused, index) => {
        const year = thisYear - 30 + index;
        return { value: String(year), label: String(year) };
      }),
      value: String(cursor.getFullYear()),
      onChange: (value) => {
        cursor.setFullYear(Number(value));
        drawGrid();
      }
    });
    header.append(monthSelect.root, yearSelect.root);

    const presets = el('div', { className: 'md-datepicker__presets' });
    const presetList: Array<{ name: string; days: number }> = [
      { name: 'Last 7 days', days: 7 },
      { name: 'Last 30 days', days: 30 },
      { name: 'Last 90 days', days: 90 },
      { name: 'Last year', days: 365 }
    ];
    for (const preset of presetList) {
      presets.append(
        button({
          label: preset.name,
          variant: 'text',
          onClick: () => {
            const to = new Date();
            const from = new Date();
            from.setDate(from.getDate() - preset.days);
            start = isoDate(from);
            end = options.range ? isoDate(to) : null;
            emit();
            handle.close();
          }
        })
      );
    }

    const grid = el('div', { className: 'md-datepicker__grid', attrs: { role: 'grid' } });

    const drawGrid = (): void => {
      grid.textContent = '';
      const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
      const offset = first.getDay();
      const days = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
      for (const name of ['S', 'M', 'T', 'W', 'T', 'F', 'S']) {
        grid.append(el('span', { className: 'md-datepicker__dow md-typescale-label-small', text: name }));
      }
      for (let blank = 0; blank < offset; blank += 1) grid.append(el('span'));
      for (let day = 1; day <= days; day += 1) {
        const iso = isoDate(new Date(cursor.getFullYear(), cursor.getMonth(), day));
        const cell = el('button', {
          className: 'md-datepicker__day',
          text: String(day),
          attrs: { type: 'button', role: 'gridcell', 'aria-label': iso }
        });
        if (iso === start || iso === end) cell.setAttribute('aria-selected', 'true');
        if (options.min && iso < options.min) cell.disabled = true;
        if (options.max && iso > options.max) cell.disabled = true;
        cell.addEventListener('click', () => {
          if (!options.range) {
            start = iso;
            emit();
            handle.close();
            return;
          }
          if (!start || (start && end)) {
            start = iso;
            end = null;
          } else if (iso < start) {
            end = start;
            start = iso;
          } else {
            end = iso;
          }
          emit();
          drawGrid();
        });
        grid.append(cell);
      }
    };

    drawGrid();
    body.append(header, grid, presets);
    handle.reposition();
  };

  root.append(field.root);

  return {
    root,
    get: () => ({ start, end }),
    set: (value) => {
      start = value.start;
      end = value.end;
      emit();
    },
    setDisabled: (disabled, reason) => field.setDisabled(disabled, reason),
    focus: () => field.focus()
  };
}

/* ------------------------------------------------------------------ */
/* Data table                                                          */
/* ------------------------------------------------------------------ */

function dataTable<Row>(options: DataTableOptions<Row>): DataTableHandle<Row> {
  const wrap = el('div', { className: 'md-table-wrap' });
  const table = el('table', { className: 'md-table', attrs: { 'aria-label': label(options.label) } });
  const head = el('thead');
  const bodyNode = el('tbody');
  table.append(head, bodyNode);
  wrap.append(table);

  let rows = [...options.rows];
  let sortColumn: string | null = null;
  let sortDirection: 1 | -1 = 1;
  const selection = new Set<string>();

  const valueOf = (row: Row, columnId: string): string | number => {
    const column = options.columns.find((candidate) => candidate.id === columnId);
    if (!column) return '';
    if (column.value) return column.value(row);
    const raw = (row as unknown as Record<string, unknown>)[columnId];
    return typeof raw === 'number' ? raw : String(raw ?? '');
  };

  const drawHead = (): void => {
    head.textContent = '';
    const tr = el('tr');
    if (options.selectable) {
      const th = el('th');
      const all = checkbox({
        label: i18n.t('core.action.selectAll', 'Select all'),
        onChange: (checked) => {
          selection.clear();
          if (checked) for (const row of rows) selection.add(options.rowId(row));
          options.onSelectionChange?.([...selection]);
          drawBody();
        }
      });
      all.root.querySelector('span')?.classList.add('md-visually-hidden');
      th.append(all.root);
      tr.append(th);
    }
    for (const column of options.columns) {
      const th = el('th', { attrs: { scope: 'col' } });
      if (column.align === 'end') th.style.textAlign = 'end';
      if (column.sortable) {
        const sortButton = el('button', { className: 'md-table__sort', attrs: { type: 'button' } });
        sortButton.append(el('span', { text: label(column.label) }));
        if (sortColumn === column.id) sortButton.append(iconElement(sortDirection === 1 ? 'chevronUp' : 'chevronDown', 16));
        sortButton.addEventListener('click', () => {
          if (sortColumn === column.id) sortDirection = sortDirection === 1 ? -1 : 1;
          else {
            sortColumn = column.id;
            sortDirection = 1;
          }
          applySort();
          drawHead();
          drawBody();
        });
        th.append(sortButton);
        th.setAttribute('aria-sort', sortColumn === column.id ? (sortDirection === 1 ? 'ascending' : 'descending') : 'none');
      } else {
        th.textContent = label(column.label);
      }
      tr.append(th);
    }
    head.append(tr);
  };

  const applySort = (): void => {
    if (!sortColumn) return;
    const column = sortColumn;
    rows.sort((a, b) => {
      const left = valueOf(a, column);
      const right = valueOf(b, column);
      if (typeof left === 'number' && typeof right === 'number') return (left - right) * sortDirection;
      return String(left).localeCompare(String(right)) * sortDirection;
    });
  };

  const drawBody = (): void => {
    bodyNode.textContent = '';
    if (rows.length === 0) {
      const tr = el('tr');
      const td = el('td', {
        className: 'md-table__empty',
        text: options.emptyMessage ? label(options.emptyMessage) : i18n.t('core.search.noMatches', 'Nothing matched.'),
        attrs: { colspan: String(options.columns.length + (options.selectable ? 1 : 0)) }
      });
      tr.append(td);
      bodyNode.append(tr);
      return;
    }
    for (const row of rows) {
      const id = options.rowId(row);
      const tr = el('tr', { attrs: { 'data-row-id': id, 'aria-selected': String(selection.has(id)) } });
      if (options.selectable) {
        const td = el('td');
        const box = checkbox({
          label: `Select ${id}`,
          checked: selection.has(id),
          onChange: (checked) => {
            if (checked) selection.add(id);
            else selection.delete(id);
            tr.setAttribute('aria-selected', String(checked));
            options.onSelectionChange?.([...selection]);
          }
        });
        box.root.querySelector('span')?.classList.add('md-visually-hidden');
        td.append(box.root);
        tr.append(td);
      }
      for (const column of options.columns) {
        const td = el('td');
        if (column.align === 'end') td.style.textAlign = 'end';
        const rendered = column.render ? column.render(row) : String(valueOf(row, column.id));
        if (typeof rendered === 'string') td.textContent = rendered;
        else td.append(rendered);
        tr.append(td);
      }
      if (options.onActivate) {
        tr.tabIndex = 0;
        tr.addEventListener('dblclick', () => options.onActivate?.(row));
        tr.addEventListener('keydown', (event) => {
          if (event.key === 'Enter') options.onActivate?.(row);
        });
      }
      bodyNode.append(tr);
    }
  };

  drawHead();
  drawBody();

  return {
    root: wrap,
    setRows: (next) => {
      rows = [...next];
      applySort();
      drawBody();
    },
    selection: () => [...selection],
    setSelection: (ids) => {
      selection.clear();
      for (const id of ids) selection.add(id);
      drawBody();
    },
    clearSelection: () => {
      selection.clear();
      drawBody();
      options.onSelectionChange?.([]);
    }
  };
}

/* ------------------------------------------------------------------ */
/* Misc                                                                */
/* ------------------------------------------------------------------ */

function icon(name: string, options: { size?: number; label?: string } = {}): HTMLElement {
  const wrapper = el('span', { className: 'md-icon' });
  wrapper.append(iconElement(name, options.size ?? 20));
  if (options.label) {
    wrapper.setAttribute('role', 'img');
    wrapper.setAttribute('aria-label', label(options.label));
  } else {
    wrapper.setAttribute('aria-hidden', 'true');
  }
  return wrapper;
}

function emptyState(options: { title: string; body?: string; action?: ButtonOptions }): HTMLElement {
  const root = el('div', { className: 'md-empty' });
  root.append(el('p', { className: 'md-typescale-title-medium', text: label(options.title) }));
  if (options.body) root.append(el('p', { className: 'md-typescale-body-medium', text: label(options.body) }));
  if (options.action) root.append(button(options.action));
  return root;
}

function sectionHeading(options: { title: string; description?: string }): HTMLElement {
  const root = el('div', { className: 'md-section-heading' });
  root.append(el('h2', { className: 'md-typescale-title-large', text: label(options.title) }));
  if (options.description) {
    const explain = el('button', {
      className: 'md-setting__explain',
      text: '?',
      attrs: {
        type: 'button',
        'aria-label': i18n.t('core.settings.explain', 'What this does'),
        'aria-expanded': 'false'
      }
    });
    const description = el('p', {
      className: 'md-setting__description md-typescale-body-small',
      text: label(options.description)
    });
    description.hidden = true;
    explain.addEventListener('click', () => {
      description.hidden = !description.hidden;
      explain.setAttribute('aria-expanded', String(!description.hidden));
    });
    root.append(explain);
    const wrapper = el('div', { className: 'md-section-heading__wrap' });
    wrapper.append(root, description);
    return wrapper;
  }
  return root;
}

export const components: ComponentKit = {
  button,
  iconButton,
  fab,
  card,
  chip,
  switchControl,
  checkbox,
  radioGroup,
  slider,
  textField,
  select,
  menu,
  list,
  listItem,
  dialog,
  tabBar,
  navigationRail,
  topAppBar,
  tooltip,
  linearProgress,
  circularProgress,
  badge,
  divider,
  segmentedButton,
  datePicker,
  dataTable,
  icon,
  emptyState,
  sectionHeading
};
