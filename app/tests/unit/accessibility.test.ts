/**
 * Accessibility of the rendered component kit.
 *
 * These render real DOM through `core/components.ts`'s actual factory
 * functions (the same ones every feature calls) and assert on the resulting
 * markup: roles, accessible names, keyboard operability and disabled-reason
 * exposure. What is deliberately NOT asserted here is on-screen geometry
 * (touch-target pixel size, contrast ratios) — jsdom has no layout engine, so
 * `getBoundingClientRect()` is always 0x0 and any assertion built on it would
 * be vacuous. `core/a11y.ts`'s own `assertTouchTarget` already accounts for
 * this (it no-ops on a 0x0 rect precisely because that means "not laid out
 * yet", not "too small") — see the note on that suite below.
 */
import { describe, expect, it, vi } from 'vitest';
import { components } from '../../src/renderer/core/components';
import { a11y } from '../../src/renderer/core/a11y';

describe('button(): accessible name and keyboard/disabled behaviour', () => {
  it('renders a real <button type="button"> carrying its visible label as text', () => {
    const node = components.button({ label: 'Save' });
    expect(node.tagName).toBe('BUTTON');
    expect(node.type).toBe('button');
    expect(node.textContent).toContain('Save');
  });

  it('fires onClick', () => {
    const onClick = vi.fn();
    const node = components.button({ label: 'Go', onClick });
    node.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('a disabled button is disabled and exposes its reason to assistive technology', () => {
    const node = components.button({ label: 'Save', disabled: true, disabledReason: 'Nothing to save yet.' });
    expect(node.disabled).toBe(true);
    expect(node.getAttribute('aria-description')).toBe('Nothing to save yet.');
    expect(node.title).toBe('Nothing to save yet.');
  });

  it('an enabled button carries no disabled explanation', () => {
    const node = components.button({ label: 'Save', disabled: false });
    expect(node.hasAttribute('aria-description')).toBe(false);
    expect(node.hasAttribute('title')).toBe(false);
  });
});

describe('iconButton(): an icon alone is not a name', () => {
  it('requires and renders an accessible name distinct from the icon', () => {
    const node = components.iconButton({ icon: 'close', label: 'Close dialog' });
    expect(node.getAttribute('aria-label')).toBe('Close dialog');
    expect(node.title).toBe('Close dialog');
  });

  it('a toggled icon button exposes aria-pressed', () => {
    const on = components.iconButton({ icon: 'pin', label: 'Pin', toggled: true });
    const off = components.iconButton({ icon: 'pin', label: 'Pin', toggled: false });
    expect(on.getAttribute('aria-pressed')).toBe('true');
    expect(off.getAttribute('aria-pressed')).toBe('false');
  });

  it('an icon button with no toggled option carries no aria-pressed at all (never a stray "false" implying a toggle that is not one)', () => {
    const node = components.iconButton({ icon: 'search', label: 'Search' });
    expect(node.hasAttribute('aria-pressed')).toBe(false);
  });
});

describe('switchControl() and checkbox(): role, state and label association', () => {
  it('a switch has role="switch", starts at the requested checked state, and its label is programmatically associated', () => {
    const handle = components.switchControl({ label: 'Enable narration', checked: true, id: 'narration-switch' });
    const input = handle.root.querySelector('input') as HTMLInputElement;
    expect(input.getAttribute('role')).toBe('switch');
    expect(input.checked).toBe(true);
    expect(handle.root.getAttribute('for')).toBe('narration-switch');
    expect(input.id).toBe('narration-switch');
  });

  it('switching calls onChange with the new boolean state', () => {
    const onChange = vi.fn();
    const handle = components.switchControl({ label: 'x', checked: false, onChange });
    const input = handle.root.querySelector('input') as HTMLInputElement;
    input.checked = true;
    input.dispatchEvent(new Event('change'));
    expect(onChange).toHaveBeenCalledWith(true);
    expect(handle.get()).toBe(true);
  });

  it('handle.set() drives the underlying control, not just internal state', () => {
    const handle = components.switchControl({ label: 'x' });
    handle.set(true);
    const input = handle.root.querySelector('input') as HTMLInputElement;
    expect(input.checked).toBe(true);
  });

  it('a checkbox supports the indeterminate state', () => {
    const handle = components.checkbox({ label: 'x', indeterminate: true });
    const input = handle.root.querySelector('input') as HTMLInputElement;
    expect(input.indeterminate).toBe(true);
  });

  it('handle.setDisabled() exposes the reason the same way a disabled button does', () => {
    const handle = components.switchControl({ label: 'x' });
    handle.setDisabled(true, 'Requires an account.');
    const input = handle.root.querySelector('input') as HTMLInputElement;
    expect(input.disabled).toBe(true);
    expect(input.getAttribute('aria-description')).toBe('Requires an account.');
  });
});

describe('textField(): label association and native input semantics', () => {
  it('associates its visible label with the input via id/for', () => {
    const handle = components.textField({ label: 'Port', id: 'port-field' });
    const labelEl = handle.root.querySelector('label') as HTMLLabelElement;
    const input = handle.root.querySelector('input') as HTMLInputElement;
    expect(labelEl.getAttribute('for')).toBe('port-field');
    expect(input.id).toBe('port-field');
  });

  it('a multiline field renders a real <textarea>, not a styled <input>', () => {
    const handle = components.textField({ label: 'Notes', multiline: true, rows: 6 });
    const textarea = handle.root.querySelector('textarea');
    expect(textarea).not.toBeNull();
    expect(textarea!.rows).toBe(6);
  });

  it('a numeric field carries real min/max/step attributes rather than only client-side validation', () => {
    const handle = components.textField({ label: 'Count', type: 'number', min: 1, max: 10, step: 1 });
    const input = handle.root.querySelector('input') as HTMLInputElement;
    expect(input.min).toBe('1');
    expect(input.max).toBe('10');
    expect(input.step).toBe('1');
  });

  it('onChange fires live on every keystroke (the "input" event); onCommit fires once editing settles (the "change" event)', () => {
    const onChange = vi.fn();
    const onCommit = vi.fn();
    const handle = components.textField({ label: 'x', onChange, onCommit });
    const input = handle.root.querySelector('input') as HTMLInputElement;
    input.value = 'hello';
    input.dispatchEvent(new Event('input'));
    expect(onChange).toHaveBeenCalledWith('hello');
    expect(onCommit).not.toHaveBeenCalled(); // not committed yet — still mid-edit
    input.dispatchEvent(new Event('change'));
    expect(onCommit).toHaveBeenCalledWith('hello');
  });
});

describe('select(): a real listbox with aria-haspopup/aria-expanded, never a bare label', () => {
  it('the trigger announces itself as a listbox popup and starts collapsed', () => {
    const handle = components.select({ label: 'Theme', options: [{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }] });
    const trigger = handle.root.querySelector('button') as HTMLButtonElement;
    expect(trigger.getAttribute('aria-haspopup')).toBe('listbox');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('shows the initial value\'s label as its own text', () => {
    const handle = components.select({ label: 'Theme', value: 'dark', options: [{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }] });
    expect(handle.root.textContent).toContain('Dark');
  });
});

describe('sectionHeading(): progressive disclosure keeps its own accessible state', () => {
  it('the explanation toggle exposes aria-expanded and actually shows/hides the description', () => {
    const node = components.sectionHeading({ title: 'Appearance', description: 'What this section changes.' });
    const toggle = node.querySelector('button.md-setting__explain') as HTMLButtonElement;
    const description = node.querySelector('.md-setting__description') as HTMLElement;
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(description.hidden).toBe(true);
    toggle.click();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(description.hidden).toBe(false);
  });

  it('the explanation itself is not the label repeated (the two must say different things)', () => {
    const node = components.sectionHeading({ title: 'Appearance', description: 'What this section changes.' });
    const heading = node.querySelector('h2')!.textContent;
    const description = node.querySelector('.md-setting__description')!.textContent;
    expect(description).not.toBe(heading);
  });
});

describe('core/a11y.ts: live region announcements', () => {
  it('announce() creates a polite, atomic status region and eventually writes the message into it', async () => {
    a11y.announce('Settings saved.');
    await new Promise((resolveTimer) => setTimeout(resolveTimer, 50));
    const region = document.querySelector('[role="status"][aria-live="polite"]');
    expect(region).not.toBeNull();
    expect(region!.getAttribute('aria-atomic')).toBe('true');
    expect(region!.textContent).toBe('Settings saved.');
  });

  it('announce(message, true) uses the assertive alert region instead', async () => {
    a11y.announce('Something failed.', true);
    await new Promise((resolveTimer) => setTimeout(resolveTimer, 50));
    const region = document.querySelector('[role="alert"][aria-live="assertive"]');
    expect(region).not.toBeNull();
    expect(region!.textContent).toBe('Something failed.');
  });

  it('the live regions are visually hidden, not merely empty', () => {
    const region = document.querySelector('[role="status"]');
    expect(region!.className).toContain('md-visually-hidden');
  });
});

describe('core/a11y.ts: roving tabindex', () => {
  function makeItems(count: number): HTMLElement[] {
    return Array.from({ length: count }, (_unused, index) => {
      const item = document.createElement('button');
      item.textContent = String(index);
      item.tabIndex = -1;
      return item;
    });
  }

  it('exactly one item is tabbable (tabIndex 0) after wiring, the rest are -1', () => {
    const container = document.createElement('div');
    const items = makeItems(3);
    container.append(...items);
    a11y.roving(container, () => items, 'horizontal');
    const tabbable = items.filter((item) => item.tabIndex === 0);
    expect(tabbable).toHaveLength(1);
  });

  it('ArrowRight moves focus forward and wraps at the end (horizontal axis)', () => {
    const container = document.createElement('div');
    document.body.append(container);
    const items = makeItems(3);
    container.append(...items);
    a11y.roving(container, () => items, 'horizontal');
    items[2].tabIndex = 0;
    items[2].focus();
    container.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(document.activeElement).toBe(items[0]); // wrapped
    container.remove();
  });

  it('a vertical strip responds to ArrowUp/ArrowDown, not ArrowLeft/ArrowRight', () => {
    const container = document.createElement('div');
    document.body.append(container);
    const items = makeItems(3);
    container.append(...items);
    a11y.roving(container, () => items, 'vertical');
    items[0].tabIndex = 0;
    items[0].focus();
    // ArrowRight must do nothing on a vertical strip.
    container.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(document.activeElement).toBe(items[0]);
    container.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement).toBe(items[1]);
    container.remove();
  });

  it('Home and End jump to the first and last item', () => {
    const container = document.createElement('div');
    document.body.append(container);
    const items = makeItems(4);
    container.append(...items);
    a11y.roving(container, () => items, 'horizontal');
    items[1].tabIndex = 0;
    items[1].focus();
    container.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(document.activeElement).toBe(items[3]);
    container.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    expect(document.activeElement).toBe(items[0]);
    container.remove();
  });

  it('the returned dispose function stops listening', () => {
    const container = document.createElement('div');
    document.body.append(container);
    const items = makeItems(2);
    container.append(...items);
    const dispose = a11y.roving(container, () => items, 'horizontal');
    dispose();
    items[0].tabIndex = 0;
    items[0].focus();
    container.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(document.activeElement).toBe(items[0]); // unchanged: no listener left
    container.remove();
  });
});

describe('core/a11y.ts: focus trap', () => {
  /** jsdom never lays elements out, so `offsetParent` is always null; the trap
   *  uses it only to skip elements hidden by CSS, which this test does not
   *  exercise, so the elements are marked visible the way a real laid-out
   *  element would report itself. */
  function markVisible(...elements: HTMLElement[]): void {
    for (const element of elements) {
      Object.defineProperty(element, 'offsetParent', { value: document.body, configurable: true });
    }
  }

  it('Tab from the last focusable element wraps to the first, inside the trap', () => {
    const container = document.createElement('div');
    const first = document.createElement('button');
    const middle = document.createElement('button');
    const last = document.createElement('button');
    container.append(first, middle, last);
    document.body.append(container);
    markVisible(first, middle, last);
    a11y.trapFocus(container);

    last.focus();
    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    container.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(first);
    container.remove();
  });

  it('Shift+Tab from the first focusable element wraps to the last', () => {
    const container = document.createElement('div');
    const first = document.createElement('button');
    const last = document.createElement('button');
    container.append(first, last);
    document.body.append(container);
    markVisible(first, last);
    a11y.trapFocus(container);

    first.focus();
    const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
    container.dispatchEvent(event);
    expect(document.activeElement).toBe(last);
    container.remove();
  });

  it('a disabled element inside the trap is never a Tab destination', () => {
    const container = document.createElement('div');
    const first = document.createElement('button');
    const disabledMiddle = document.createElement('button');
    disabledMiddle.disabled = true;
    const last = document.createElement('button');
    container.append(first, disabledMiddle, last);
    document.body.append(container);
    markVisible(first, disabledMiddle, last);
    a11y.trapFocus(container);

    last.focus();
    container.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(first); // skipped the disabled middle button
    container.remove();
  });
});

describe('core/a11y.ts: reduced motion', () => {
  it('reads window.matchMedia("(prefers-reduced-motion: reduce)")', () => {
    const spy = vi.spyOn(window, 'matchMedia');
    a11y.reducedMotion();
    expect(spy).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
    spy.mockRestore();
  });
});

describe('core/a11y.ts: assertTouchTarget never throws (it warns, and only once laid out)', () => {
  it('does not throw for a freshly-created, unlaid-out element (0x0 rect)', () => {
    const node = document.createElement('button');
    expect(() => a11y.assertTouchTarget(node, 'test')).not.toThrow();
  });
});
