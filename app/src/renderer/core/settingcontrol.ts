import { el } from './a11y';
import { openColorPicker } from './colorpicker';
import { components } from './components';
import { i18n } from './i18n';
import { settings } from './settings';
import type { AppContext, ControlHandle, SettingContext, SettingControl } from './types';

/**
 * Renders one setting as its real, live control.
 *
 * The same function builds the control in the settings surface and the control
 * embedded in a command-palette row, so two routes to one value can never
 * disagree about what that value is or what changing it does. A switch rendered
 * in a palette row that does not actually switch anything is worse than a label,
 * because it looks like it works.
 */

export function contextFor(control: SettingControl, app: AppContext): SettingContext {
  return {
    ...app,
    setting: control,
    value: settings.get(control.id, control.defaultValue),
    setValue: (value: unknown) => {
      const error = control.validate?.(value) ?? null;
      if (error) {
        app.notify.warn(i18n.t(control.label, control.label), error);
        return;
      }
      settings.set(control.id, value);
    },
    provenance: settings.provenanceOf(control.id)
  };
}

/** Builds just the interactive part of a setting. */
export function renderSettingControl(control: SettingControl, app: AppContext): HTMLElement {
  settings.declareDefault(control.id, control.defaultValue);
  const ctx = contextFor(control, app);
  const current = settings.get(control.id, control.defaultValue);

  switch (control.kind) {
    case 'switch': {
      const handle = components.switchControl({
        label: control.label,
        checked: current === true,
        onChange: (value) => ctx.setValue(value)
      });
      return decorate(handle, control);
    }
    case 'number': {
      const handle = components.textField({
        label: control.label,
        type: 'number',
        value: String(current ?? ''),
        min: control.min,
        max: control.max,
        step: control.step,
        supportingText: control.hint,
        onCommit: (value) => ctx.setValue(value === '' ? control.defaultValue : Number(value))
      });
      return decorate(handle, control);
    }
    case 'slider': {
      const handle = components.slider({
        label: control.label,
        min: control.min ?? 0,
        max: control.max ?? 100,
        step: control.step ?? 1,
        value: Number(current ?? control.defaultValue ?? 0),
        onChange: (value) => ctx.setValue(value)
      });
      return decorate(handle, control);
    }
    case 'select': {
      const handle = components.select({
        label: control.label,
        options: control.options ?? [],
        value: String(current ?? ''),
        onChange: (value) => ctx.setValue(value)
      });
      return decorate(handle, control);
    }
    case 'color': {
      const host = el('div', { className: 'md-setting__color' });
      const swatch = components.button({
        label: String(current ?? ''),
        variant: 'outlined',
        icon: 'palette',
        onClick: () => {
          openColorPicker({
            anchor: swatch,
            value: String(current ?? '#808080'),
            onChange: (value) => {
              ctx.setValue(value);
              const labelNode = swatch.querySelector('.md-btn__label');
              if (labelNode) labelNode.textContent = value;
            }
          });
        }
      });
      host.append(swatch);
      return host;
    }
    case 'font': {
      const host = el('div');
      void app.theme.availableFonts().then((families) => {
        const handle = components.select({
          label: control.label,
          value: String(current ?? ''),
          options: [{ value: '', label: 'System default' }, ...families.map((family) => ({ value: family, label: family }))],
          onChange: (value) => ctx.setValue(value)
        });
        host.append(handle.root);
      });
      return host;
    }
    case 'path':
    case 'file':
    case 'folder': {
      const handle = components.textField({
        label: control.label,
        value: String(current ?? ''),
        supportingText: control.hint,
        browse: control.kind === 'path' ? 'both' : control.kind === 'file' ? 'file' : 'folder',
        onCommit: (value) => ctx.setValue(value)
      });
      return decorate(handle, control);
    }
    case 'action': {
      const node = components.button({
        label: control.label,
        variant: 'tonal',
        onClick: () => void control.run?.(ctx)
      });
      return node;
    }
    case 'custom': {
      const host = el('div', { className: 'md-setting__custom' });
      control.render?.(host, ctx);
      return host;
    }
    case 'text':
    default: {
      const handle = components.textField({
        label: control.label,
        value: String(current ?? ''),
        supportingText: control.hint,
        onCommit: (value) => ctx.setValue(value)
      });
      return decorate(handle, control);
    }
  }
}

function decorate<T>(handle: ControlHandle<T>, control: SettingControl): HTMLElement {
  handle.root.dataset.settingId = control.id;
  handle.root.dataset.appearanceId = `setting:${control.id}`;
  return handle.root;
}

/**
 * The full settings row: label, the explanation behind progressive disclosure,
 * the truthful default-provenance line, the live control and a per-key reset.
 */
export function renderSettingRow(control: SettingControl, app: AppContext): HTMLElement {
  settings.declareDefault(control.id, control.defaultValue);

  const row = el('div', {
    className: 'md-setting',
    attrs: { id: `setting-${control.id}`, 'data-appearance-id': `setting-row:${control.id}` }
  });

  const head = el('div', { className: 'md-setting__head' });
  const pair = i18n.pair(control.label, control.label);
  const title = el('div', { className: 'md-setting__title' });
  title.append(el('span', { className: 'md-typescale-title-small', text: pair.primary }));
  if (pair.secondary) {
    title.append(el('span', { className: 'md-setting__secondary', text: pair.secondary }));
  }

  const explain = el('button', {
    className: 'md-setting__explain',
    text: '?',
    attrs: {
      type: 'button',
      'aria-label': i18n.t('core.settings.explain', 'What this does'),
      'aria-expanded': 'false',
      'aria-controls': `setting-description-${control.id}`
    }
  });

  head.append(title, explain);

  const description = el('p', {
    className: 'md-setting__description md-typescale-body-small',
    text: i18n.t(control.description, control.description),
    attrs: { id: `setting-description-${control.id}` }
  });
  description.hidden = true;
  explain.addEventListener('click', () => {
    description.hidden = !description.hidden;
    explain.setAttribute('aria-expanded', String(!description.hidden));
  });

  const provenance = el('p', { className: 'md-setting__provenance' });
  const refreshProvenance = (): void => {
    const source = settings.provenanceOf(control.id);
    provenance.textContent =
      source === 'default'
        ? i18n.t(
            'core.settings.provenance.default',
            'No file has ever set this. The application is using its own value: {value}.',
            { values: { value: describeValue(control.defaultValue) } }
          )
        : source === 'user'
          ? i18n.t('core.settings.provenance.user', 'Set by you, and stored in {path}.', {
              values: { path: settings.filePath() || 'the settings file' }
            })
          : i18n.t(`core.settings.provenance.${source}`, source);
  };
  refreshProvenance();

  const body = el('div', { className: 'md-setting__body' });
  body.append(renderSettingControl(control, app));

  const reset = components.button({
    label: 'core.settings.resetOne',
    variant: 'text',
    onClick: () => {
      settings.reset(control.id);
      refreshProvenance();
      body.textContent = '';
      body.append(renderSettingControl(control, app));
    }
  });

  const unsubscribe = settings.onChange((change) => {
    if (change.id === control.id) refreshProvenance();
  });
  row.addEventListener('md-dispose', () => unsubscribe());

  row.append(head, description, body, provenance, reset);
  return row;
}

function describeValue(value: unknown): string {
  if (value === null || value === undefined) return 'not set';
  if (typeof value === 'string') return value === '' ? 'an empty string' : value;
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return 'a structured value';
    }
  }
  return String(value);
}
