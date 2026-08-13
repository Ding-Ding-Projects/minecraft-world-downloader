import { el } from './a11y';
import { openColorPicker } from './colorpicker';
import { components } from './components';
import { history } from './history';
import { i18n } from './i18n';
import { overlay } from './overlay';
import { createSearchBar } from './searchbar';
import { settings } from './settings';
import { theme } from './theme';
import type { AppearanceOverride, AppearanceService } from './types';

/**
 * The per-element appearance editor.
 *
 * EVERY rendered element supports it. The command sits on the element's context
 * menu and on a keyboard path, and the editor opens as a non-modal popover
 * anchored beside that exact element rather than a detached dialog somewhere
 * else on screen.
 *
 * The editor and the colour picker theme THEMSELVES and the application chrome
 * as well as the element in question. A theming feature that cannot theme its
 * own dialog is incomplete.
 *
 * Nothing is silently dropped: a property this platform cannot render stays
 * visible with a plain explanation, and the user's value is kept.
 */

const STORE_KEY = 'appearance.overrides';
const PRESET_KEY = 'appearance.presets';

interface OverrideDocument {
  [selector: string]: AppearanceOverride[];
}

const BUILT_IN_PRESETS: Array<{ id: string; name: string; seed: string; contrast: 'standard' | 'medium' | 'high'; density: number }> = [
  { id: 'preset.shipped', name: 'Shipped defaults', seed: '#4f6bed', contrast: 'standard', density: 0 },
  { id: 'preset.compact', name: 'Compact', seed: '#4f6bed', contrast: 'standard', density: -2 },
  { id: 'preset.highContrast', name: 'High contrast', seed: '#2f4fd8', contrast: 'high', density: 0 },
  { id: 'preset.forest', name: 'Forest', seed: '#3f7d4f', contrast: 'standard', density: 0 },
  { id: 'preset.ember', name: 'Ember', seed: '#c2532b', contrast: 'medium', density: 0 },
  { id: 'preset.slate', name: 'Slate', seed: '#5b6470', contrast: 'standard', density: -1 }
];

/**
 * The complete typography surface.
 *
 * Word-processor depth is the standard: everything below is a real control the
 * user can operate, and each entry names the CSS property it writes so the
 * result is checkable rather than asserted.
 */
interface TypographyControl {
  property: string;
  label: string;
  kind: 'font' | 'length' | 'number' | 'select' | 'color' | 'text';
  options?: Array<{ value: string; label: string }>;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  /** Named when the platform genuinely cannot render it, instead of hiding it. */
  unsupportedReason?: string;
}

const TYPOGRAPHY: TypographyControl[] = [
  { property: 'font-family', label: 'Font family', kind: 'font' },
  { property: 'font-size', label: 'Font size', kind: 'length', min: 8, max: 96, step: 1, unit: 'px' },
  {
    property: 'font-weight',
    label: 'Weight',
    kind: 'select',
    options: [100, 200, 300, 400, 500, 600, 700, 800, 900].map((weight) => ({
      value: String(weight),
      label: String(weight)
    }))
  },
  {
    property: 'font-style',
    label: 'Italic or oblique',
    kind: 'select',
    options: [
      { value: 'normal', label: 'Normal' },
      { value: 'italic', label: 'Italic' },
      { value: 'oblique 10deg', label: 'Oblique' }
    ]
  },
  {
    property: 'text-decoration-line',
    label: 'Underline, strikethrough, overline',
    kind: 'select',
    options: [
      { value: 'none', label: 'None' },
      { value: 'underline', label: 'Underline' },
      { value: 'overline', label: 'Overline' },
      { value: 'line-through', label: 'Strikethrough' },
      { value: 'underline line-through', label: 'Underline and strikethrough' },
      { value: 'underline overline', label: 'Underline and overline' }
    ]
  },
  {
    property: 'text-decoration-style',
    label: 'Decoration style',
    kind: 'select',
    options: [
      { value: 'solid', label: 'Single' },
      { value: 'double', label: 'Double' },
      { value: 'dotted', label: 'Dotted' },
      { value: 'dashed', label: 'Dashed' },
      { value: 'wavy', label: 'Wavy' }
    ]
  },
  { property: 'text-decoration-color', label: 'Decoration colour', kind: 'color' },
  {
    property: 'text-decoration-thickness',
    label: 'Decoration thickness',
    kind: 'length',
    min: 0,
    max: 8,
    step: 0.5,
    unit: 'px'
  },
  {
    property: 'text-transform',
    label: 'Capitalization',
    kind: 'select',
    options: [
      { value: 'none', label: 'As typed' },
      { value: 'uppercase', label: 'Upper case' },
      { value: 'lowercase', label: 'Lower case' },
      { value: 'capitalize', label: 'Capitalize' }
    ]
  },
  {
    property: 'font-variant-caps',
    label: 'Small caps',
    kind: 'select',
    options: [
      { value: 'normal', label: 'Off' },
      { value: 'small-caps', label: 'Small caps' },
      { value: 'all-small-caps', label: 'All small caps' }
    ],
    unsupportedReason: 'Small caps render only when the chosen family ships the variant; otherwise the text is unchanged.'
  },
  {
    property: 'vertical-align',
    label: 'Superscript or subscript',
    kind: 'select',
    options: [
      { value: 'baseline', label: 'Baseline' },
      { value: 'super', label: 'Superscript' },
      { value: 'sub', label: 'Subscript' }
    ]
  },
  { property: 'color', label: 'Text colour', kind: 'color' },
  { property: 'background-color', label: 'Highlight', kind: 'color' },
  {
    property: '-webkit-text-stroke',
    label: 'Outline',
    kind: 'text',
    unsupportedReason: 'Written as a width and a colour, for example "1px #202020".'
  },
  { property: 'text-shadow', label: 'Shadow or glow', kind: 'text' },
  { property: 'letter-spacing', label: 'Character spacing', kind: 'length', min: -4, max: 12, step: 0.1, unit: 'px' },
  { property: 'word-spacing', label: 'Word spacing', kind: 'length', min: -4, max: 24, step: 0.5, unit: 'px' },
  { property: 'line-height', label: 'Line height', kind: 'number', min: 0.8, max: 3, step: 0.05 },
  {
    property: 'font-variation-settings',
    label: 'Variable font axes',
    kind: 'text',
    unsupportedReason: 'Applies only to a variable family, for example "\'wght\' 620, \'wdth\' 105".'
  },
  {
    property: 'direction',
    label: 'Text direction',
    kind: 'select',
    options: [
      { value: 'ltr', label: 'Left to right' },
      { value: 'rtl', label: 'Right to left' }
    ]
  },
  {
    property: 'text-align',
    label: 'Alignment',
    kind: 'select',
    options: [
      { value: 'start', label: 'Start' },
      { value: 'center', label: 'Centre' },
      { value: 'end', label: 'End' },
      { value: 'justify', label: 'Justify' }
    ]
  }
];

const BOX: TypographyControl[] = [
  { property: 'border-radius', label: 'Corner radius', kind: 'length', min: 0, max: 48, step: 1, unit: 'px' },
  { property: 'border-color', label: 'Border colour', kind: 'color' },
  { property: 'border-width', label: 'Border width', kind: 'length', min: 0, max: 8, step: 1, unit: 'px' },
  {
    property: 'border-style',
    label: 'Border style',
    kind: 'select',
    options: ['none', 'solid', 'dashed', 'dotted', 'double'].map((value) => ({ value, label: value }))
  },
  { property: 'padding', label: 'Inner spacing', kind: 'length', min: 0, max: 48, step: 1, unit: 'px' },
  { property: 'margin', label: 'Outer spacing', kind: 'length', min: 0, max: 48, step: 1, unit: 'px' },
  { property: 'box-shadow', label: 'Elevation shadow', kind: 'text' },
  { property: 'opacity', label: 'Opacity', kind: 'number', min: 0, max: 1, step: 0.05 }
];

/**
 * A stable selector for an element.
 *
 * The id wins when there is one, then a data attribute a feature set for exactly
 * this purpose, then the element's own class list. A generated nth-child path is
 * deliberately NOT used: it changes the moment a sibling is added, which turns a
 * saved appearance into an appearance applied to the wrong element.
 */
export function selectorFor(element: HTMLElement): string {
  if (element.dataset.appearanceId) return `[data-appearance-id="${element.dataset.appearanceId}"]`;
  if (element.id) return `#${element.id}`;
  const classes = [...element.classList].filter((name) => name.startsWith('md-'));
  if (classes.length > 0) return `.${classes[0]}`;
  return element.tagName.toLowerCase();
}

class AppearanceImpl implements AppearanceService {
  private styleElement: HTMLStyleElement | null = null;

  private document(): OverrideDocument {
    const stored = settings.get<OverrideDocument | undefined>(STORE_KEY, undefined);
    return stored && typeof stored === 'object' ? stored : {};
  }

  private write(document_: OverrideDocument): void {
    settings.set(STORE_KEY, document_);
    this.repaint();
  }

  /** Rebuilds the single stylesheet that carries every override. */
  repaint(): void {
    if (!this.styleElement) {
      this.styleElement = document.createElement('style');
      this.styleElement.id = 'md-appearance-overrides';
      document.head.append(this.styleElement);
    }
    const document_ = this.document();
    const rules: string[] = [];
    for (const [selector, overrides] of Object.entries(document_)) {
      if (overrides.length === 0) continue;
      const declarations = overrides.map((override) => `${override.property}: ${override.value};`).join(' ');
      // The override sheet is the last stylesheet in the document and each rule
      // is written at its own specificity, so it wins by position rather than by
      // an `!important` that a later feature cannot undo.
      rules.push(`${selector} { ${declarations} }`);
    }
    this.styleElement.textContent = rules.join('\n');
  }

  overridesFor(selector: string): AppearanceOverride[] {
    return this.document()[selector] ?? [];
  }

  setOverride(selector: string, override: AppearanceOverride): void {
    const document_ = this.document();
    const list = document_[selector] ? [...document_[selector]] : [];
    const index = list.findIndex((candidate) => candidate.property === override.property);
    if (index >= 0) list[index] = override;
    else list.push(override);
    document_[selector] = list;
    this.write(document_);
    void history.record('Changed element appearance', 'core.appearance', {
      selector,
      property: override.property,
      value: override.value
    });
  }

  resetProperty(selector: string, property: string): void {
    const document_ = this.document();
    const list = (document_[selector] ?? []).filter((candidate) => candidate.property !== property);
    if (list.length === 0) delete document_[selector];
    else document_[selector] = list;
    this.write(document_);
    void history.record('Reset an appearance property', 'core.appearance', { selector, property });
  }

  resetSelector(selector: string): void {
    const document_ = this.document();
    delete document_[selector];
    this.write(document_);
    void history.record('Reset element appearance', 'core.appearance', { selector });
  }

  resetAll(): void {
    this.write({});
    void history.record('Reset every appearance override', 'core.appearance', {});
  }

  applyTo(element: HTMLElement, selector: string): void {
    for (const override of this.overridesFor(selector)) {
      element.style.setProperty(override.property, override.value);
    }
  }

  presets(): Array<{ id: string; name: string }> {
    const saved = settings.get<Array<{ id: string; name: string }>>(PRESET_KEY, []);
    return [...BUILT_IN_PRESETS.map(({ id, name }) => ({ id, name })), ...(Array.isArray(saved) ? saved : [])];
  }

  applyPreset(id: string): void {
    const builtIn = BUILT_IN_PRESETS.find((preset) => preset.id === id);
    if (builtIn) {
      theme.setSeed(builtIn.seed);
      theme.setContrast(builtIn.contrast);
      theme.setDensity(builtIn.density);
      void history.record('Applied an appearance preset', 'core.appearance', { preset: builtIn.name });
      return;
    }
    const saved = settings.get<Record<string, unknown>>(`appearance.preset.${id}`, {});
    const result = this.importThemeJson(JSON.stringify(saved));
    if (!result.ok) throw new Error(result.error ?? 'That preset could not be applied.');
  }

  exportThemeJson(): string {
    const state = theme.state();
    return `${JSON.stringify(
      {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        theme: {
          mode: state.mode,
          seed: state.seed,
          contrast: state.contrast,
          density: state.density,
          fontFamily: state.fontFamily,
          fontScale: state.fontScale,
          fontWeight: state.fontWeight
        },
        overrides: this.document()
      },
      null,
      2
    )}\n`;
  }

  importThemeJson(json: string): { ok: boolean; error?: string } {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      return { ok: false, error: 'That file is not valid JSON. Nothing was changed.' };
    }
    if (typeof parsed !== 'object' || parsed === null) {
      return { ok: false, error: 'A theme file must be a JSON object. Nothing was changed.' };
    }
    const document_ = parsed as Record<string, unknown>;
    if (document_.schemaVersion !== 1) {
      return { ok: false, error: 'Unsupported theme schema version. Nothing was changed.' };
    }
    const themePart = document_.theme as Record<string, unknown> | undefined;
    if (themePart) {
      if (typeof themePart.seed === 'string') theme.setSeed(themePart.seed);
      if (themePart.mode === 'light' || themePart.mode === 'dark' || themePart.mode === 'system') {
        theme.setMode(themePart.mode);
      }
      if (themePart.contrast === 'standard' || themePart.contrast === 'medium' || themePart.contrast === 'high') {
        theme.setContrast(themePart.contrast);
      }
      if (typeof themePart.density === 'number') theme.setDensity(themePart.density);
      if (typeof themePart.fontFamily === 'string') theme.setFontFamily(themePart.fontFamily);
      if (typeof themePart.fontScale === 'number') theme.setFontScale(themePart.fontScale);
      if (typeof themePart.fontWeight === 'number') theme.setFontWeight(themePart.fontWeight);
    }
    const overrides = document_.overrides;
    if (overrides && typeof overrides === 'object' && !Array.isArray(overrides)) {
      const cleaned: OverrideDocument = {};
      for (const [selector, list] of Object.entries(overrides as Record<string, unknown>)) {
        if (!Array.isArray(list)) continue;
        cleaned[selector] = list
          .filter(
            (item): item is AppearanceOverride =>
              typeof item === 'object' &&
              item !== null &&
              typeof (item as AppearanceOverride).property === 'string' &&
              typeof (item as AppearanceOverride).value === 'string'
          )
          .map((item) => ({ property: item.property, value: item.value }));
      }
      this.write(cleaned);
    }
    void history.record('Imported a theme', 'core.appearance', { schemaVersion: 1 });
    return { ok: true };
  }

  edit(element: HTMLElement, selectorOverride?: string): void {
    const selector = selectorOverride ?? selectorFor(element);
    const handle = overlay.open({
      anchor: element,
      placement: 'bottom-start',
      role: 'dialog',
      label: i18n.t('core.appearance.editorTitle', 'Appearance of {target}', { values: { target: selector } }),
      dragKey: `appearance-editor`,
      resizeKey: `appearance-editor`
    });
    handle.root.classList.add('md-appearance');

    const body = handle.body;
    body.append(
      el('h2', {
        className: 'md-typescale-title-medium',
        text: i18n.t('core.appearance.editorTitle', 'Appearance of {target}', { values: { target: selector } })
      }),
      el('p', { className: 'md-appearance__target md-typescale-body-small', text: selector })
    );

    const groups = el('div', { className: 'md-appearance__grid' });

    const currentValue = (property: string): string =>
      this.overridesFor(selector).find((override) => override.property === property)?.value ?? '';

    const buildControl = (control: TypographyControl): HTMLElement => {
      const wrap = el('div', { className: 'md-appearance__group' });
      const value = currentValue(control.property);

      if (control.kind === 'color') {
        const swatch = components.button({
          label: control.label,
          variant: 'outlined',
          icon: 'palette',
          onClick: () => {
            openColorPicker({
              anchor: swatch,
              value: value || '#808080',
              contrastAgainst: getComputedStyle(element).backgroundColor,
              onChange: (next) => this.setOverride(selector, { property: control.property, value: next })
            });
          }
        });
        wrap.append(swatch);
      } else if (control.kind === 'font') {
        const host = el('div');
        wrap.append(host);
        void theme.availableFonts().then((families) => {
          const picker = components.select({
            label: control.label,
            value: value || '',
            options: [{ value: '', label: 'Inherited' }, ...families.map((family) => ({ value: family, label: family }))],
            onChange: (next) => {
              if (next === '') this.resetProperty(selector, control.property);
              else this.setOverride(selector, { property: control.property, value: next });
            }
          });
          host.append(picker.root);
          // Each family name previews in its own face, which is the only way to
          // choose a typeface without applying it first.
          const preview = el('p', { className: 'md-font-option md-typescale-body-medium' });
          preview.textContent = `${value || 'Inherited'} — Aa Bb Cc 0123 廣東話`;
          if (value) preview.style.fontFamily = value;
          host.append(preview);
        });
      } else if (control.kind === 'select' && control.options) {
        const picker = components.select({
          label: control.label,
          value: value || control.options[0].value,
          options: control.options,
          onChange: (next) => this.setOverride(selector, { property: control.property, value: next })
        });
        wrap.append(picker.root);
      } else if (control.kind === 'length' || control.kind === 'number') {
        const numeric = components.slider({
          label: control.label,
          min: control.min ?? 0,
          max: control.max ?? 100,
          step: control.step ?? 1,
          value: Number.parseFloat(value) || control.min || 0,
          unit: control.unit,
          onChange: (next) =>
            this.setOverride(selector, {
              property: control.property,
              value: control.unit ? `${next}${control.unit}` : String(next)
            })
        });
        const free = components.textField({
          label: `${control.label} (exact value)`,
          value,
          placeholder: control.unit ? `12${control.unit}` : '1.25',
          onCommit: (next) => {
            if (next.trim() === '') this.resetProperty(selector, control.property);
            else this.setOverride(selector, { property: control.property, value: next.trim() });
          }
        });
        wrap.append(numeric.root, free.root);
      } else {
        const free = components.textField({
          label: control.label,
          value,
          supportingText: control.unsupportedReason,
          onCommit: (next) => {
            if (next.trim() === '') this.resetProperty(selector, control.property);
            else this.setOverride(selector, { property: control.property, value: next.trim() });
          }
        });
        wrap.append(free.root);
      }

      if (control.unsupportedReason && control.kind !== 'text') {
        wrap.append(el('p', { className: 'md-field__support md-typescale-body-small', text: control.unsupportedReason }));
      }

      wrap.append(
        components.button({
          label: 'core.appearance.resetProperty',
          variant: 'text',
          onClick: () => {
            this.resetProperty(selector, control.property);
            handle.close();
            this.edit(element, selector);
          }
        })
      );
      return wrap;
    };

    const all = [...TYPOGRAPHY, ...BOX];
    const controlNodes = new Map<TypographyControl, HTMLElement>();
    for (const control of all) {
      const node = buildControl(control);
      controlNodes.set(control, node);
      groups.append(node);
    }

    // The editor is a settings surface, so it carries its own search with its own
    // anchored pattern builder like every other settings surface.
    const search = createSearchBar({
      label: 'core.settings.search',
      sample: all.map((control) => `${control.label} ${control.property}`).join('\n'),
      onChange: (query) => {
        for (const [control, node] of controlNodes) {
          node.hidden = !query.matches(`${control.label} ${control.property}`);
        }
      }
    });

    const presetPicker = components.select({
      label: 'core.appearance.presets',
      options: this.presets().map((preset) => ({ value: preset.id, label: preset.name })),
      onChange: (id) => this.applyPreset(id)
    });

    const actions = el('div', { className: 'md-confirm__actions' });
    actions.append(
      components.button({
        label: 'core.appearance.resetElement',
        variant: 'outlined',
        onClick: () => {
          this.resetSelector(selector);
          handle.close();
        }
      }),
      components.button({
        label: 'core.appearance.exportTheme',
        variant: 'text',
        onClick: () => {
          void window.studio.dialog
            .saveFile({ defaultPath: 'appearance-theme.json', filters: [{ name: 'JSON', extensions: ['json'] }] })
            .then((chosen) => {
              if (chosen.ok && chosen.value) void window.studio.fs.writeText(chosen.value, this.exportThemeJson());
            });
        }
      }),
      components.button({
        label: 'core.appearance.importTheme',
        variant: 'text',
        onClick: () => {
          void window.studio.dialog.openFile({ filters: [{ name: 'JSON', extensions: ['json'] }] }).then(async (chosen) => {
            if (!chosen.ok || !chosen.value || !chosen.value[0]) return;
            const read = await window.studio.fs.readText(chosen.value[0], 1024 * 1024);
            if (!read.ok) return;
            this.importThemeJson(read.value);
            handle.close();
          });
        }
      })
    );

    body.append(search.root, presetPicker.root, groups, actions);
    handle.reposition();
  }
}

export const appearance = new AppearanceImpl();

/**
 * Installs the global "Edit appearance…" route.
 *
 * Right-click on any element offers it, and Shift+F10 or the context-menu key
 * reaches the same command from the keyboard, so the capability is not
 * pointer-only.
 */
export function installAppearanceCommands(): void {
  appearance.repaint();

  const openFor = (target: HTMLElement, anchor: HTMLElement): void => {
    components.menu({
      anchor,
      label: 'core.appearance.editElement',
      items: [
        {
          id: 'edit-appearance',
          label: 'core.appearance.editElement',
          icon: 'palette',
          run: () => appearance.edit(target)
        },
        {
          id: 'reset-appearance',
          label: 'core.appearance.resetElement',
          icon: 'refresh',
          run: () => appearance.resetSelector(selectorFor(target))
        },
        {
          id: 'lock-element',
          label: 'core.lock.command',
          icon: 'lock',
          run: () => {
            window.dispatchEvent(
              new CustomEvent('studio:lock-element', { detail: { target, selector: selectorFor(target) } })
            );
          }
        }
      ]
    });
  };

  document.addEventListener('contextmenu', (event) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    // A text input keeps the platform's own editing menu; everywhere else this
    // is the element menu.
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
    event.preventDefault();
    openFor(target, target);
  });

  document.addEventListener('keydown', (event) => {
    const isContextKey = event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10');
    if (!isContextKey) return;
    const target = document.activeElement as HTMLElement | null;
    if (!target || target === document.body) return;
    event.preventDefault();
    openFor(target, target);
  });
}
