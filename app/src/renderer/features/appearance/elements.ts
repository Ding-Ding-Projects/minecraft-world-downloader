import { el } from '../../core/a11y';
import { openColorPicker } from '../../core/colorpicker';
import type { AppContext } from '../../core/registry';

/**
 * The catalogue of rendered element categories.
 *
 * Every entry names the REAL selector the application paints with, and the
 * sample beside it is a real control from the same component kit as the rest of
 * the window. That combination is the point of this surface: an edit made here
 * reaches the application chrome, the settings surface, the tabs, the toolbars,
 * the menus, the notifications and the appearance editor's own dialog, rather
 * than a decorative copy that looks the same and changes nothing.
 *
 * Some categories are surfaces rather than inline controls — a dialog, the
 * command palette, the colour picker, the appearance editor itself. Those do not
 * get a fake miniature. They get a button that opens the genuine surface, and
 * the editor still writes to the real selector, because a picture of a dialog
 * that cannot be opened is exactly the decorative control this project forbids.
 */

export type SampleKind =
  /** An inline live control, built from the component kit. */
  | 'inline'
  /** A button that opens the genuine surface this category describes. */
  | 'action'
  /** No sample is possible; the reason is stated instead of faked. */
  | 'explained';

export interface ElementCategory {
  id: string;
  /** i18n key for the visible name. */
  label: string;
  /** English wording, used when the catalogue has no entry for the key. */
  fallback: string;
  /** The exact selector the appearance editor writes to. */
  selector: string;
  icon: string;
  kind: SampleKind;
  /** Search keywords, so the catalogue's own search finds it by intent. */
  keywords: string[];
  /** Builds the live sample, or the action button, or the explanation. */
  build(ctx: AppContext, sample: string): HTMLElement;
}

const SAMPLE_FALLBACK = 'Aa Bb Cc 0123 廣東話';

export function sampleText(ctx: AppContext): string {
  const chosen = ctx.settings.get<string>('appearance.studio.sampleText', '');
  return typeof chosen === 'string' && chosen.trim() !== '' ? chosen : SAMPLE_FALLBACK;
}

function row(...nodes: Array<Node | null | undefined>): HTMLElement {
  const wrap = el('div', { className: 'appearance-sample__row' });
  for (const node of nodes) if (node) wrap.append(node);
  return wrap;
}

function explanation(text: string): HTMLElement {
  return el('p', { className: 'appearance-sample__explain md-typescale-body-small', text });
}

export const ELEMENT_CATEGORIES: ElementCategory[] = [
  {
    id: 'chrome.titlebar',
    label: 'appearance.category.chrome.titlebar',
    fallback: 'Application title bar',
    selector: '[data-appearance-id="chrome:titlebar"]',
    icon: 'dock',
    kind: 'inline',
    keywords: ['chrome', 'title', 'window', 'frame', 'brand'],
    build(ctx, sample) {
      const bar = el('div', { className: 'appearance-sample__titlebar' });
      const brand = el('div', { className: 'appearance-sample__brand' });
      brand.append(ctx.components.icon('world', { size: 18 }));
      brand.append(el('span', { className: 'md-typescale-title-small', text: sample }));
      bar.append(brand);
      bar.append(
        ctx.components.iconButton({
          icon: 'search',
          label: ctx.t('core.palette.title', 'Command palette'),
          onClick: () => ctx.palette.open()
        })
      );
      bar.append(
        ctx.components.iconButton({
          icon: 'settings',
          label: ctx.t('core.settings.title', 'Settings'),
          onClick: () => ctx.tabs.open('core.settings')
        })
      );
      return bar;
    }
  },
  {
    id: 'chrome.tabstrip',
    label: 'appearance.category.chrome.tabstrip',
    fallback: 'Tab strip',
    selector: '[data-appearance-id="chrome:tabstrip"]',
    icon: 'dock',
    kind: 'inline',
    keywords: ['tabs', 'strip', 'navigation', 'dock', 'rail'],
    build(ctx) {
      return ctx.components.navigationRail({
        tabs: ctx.tabs
          .list()
          .slice(0, 4)
          .map((record) => ({ id: record.id, label: record.title, icon: record.icon })),
        active: ctx.tabs.activeId() ?? undefined,
        onChange: (id) => ctx.tabs.open(id)
      });
    }
  },
  {
    id: 'tabs.tab',
    label: 'appearance.category.tabs.tab',
    fallback: 'A tab in the strip',
    selector: '.md-tab',
    icon: 'dock',
    kind: 'inline',
    keywords: ['tab', 'pinned', 'group'],
    build(ctx) {
      return ctx.components.tabBar({
        tabs: [
          { id: 'one', label: ctx.t('appearance.section.theme', 'Theme'), icon: 'palette' },
          { id: 'two', label: ctx.t('appearance.section.typography', 'Typography'), icon: 'edit' }
        ],
        active: 'one'
      });
    }
  },
  {
    id: 'tabs.group',
    label: 'appearance.category.tabs.group',
    fallback: 'A tab group header',
    selector: '.md-tabgroup__header',
    icon: 'folder',
    kind: 'explained',
    keywords: ['group', 'collapse', 'colour', 'header'],
    build(ctx) {
      return explanation(
        ctx.t(
          'appearance.elements.groupExplain',
          'A group header appears in the tab strip once a group exists. Editing this category changes every group header, including the ones created later.'
        )
      );
    }
  },
  {
    id: 'chrome.topbar',
    label: 'appearance.category.chrome.topbar',
    fallback: 'Toolbar and top app bar',
    selector: '.md-topbar',
    icon: 'tune',
    kind: 'inline',
    keywords: ['toolbar', 'app bar', 'header', 'actions'],
    build(ctx, sample) {
      return ctx.components.topAppBar({
        title: sample,
        subtitle: ctx.t('appearance.section.elements', 'Rendered elements'),
        actions: [
          ctx.components.iconButton({
            icon: 'more',
            label: ctx.t('core.action.more', 'More'),
            onClick: (event) => {
              ctx.components.menu({
                anchor: event.currentTarget as HTMLElement,
                items: [
                  { id: 'a', label: ctx.t('appearance.elements.edit', 'Edit appearance…'), icon: 'palette' },
                  { id: 'b', label: ctx.t('appearance.elements.reset', 'Reset this element'), icon: 'refresh' }
                ]
              });
            }
          })
        ]
      });
    }
  },
  {
    id: 'controls.button',
    label: 'appearance.category.controls.button',
    fallback: 'Buttons',
    selector: '.md-btn',
    icon: 'bolt',
    kind: 'inline',
    keywords: ['button', 'filled', 'tonal', 'outlined', 'text', 'elevated'],
    build(ctx, sample) {
      return row(
        ctx.components.button({ label: sample, variant: 'filled' }),
        ctx.components.button({ label: sample, variant: 'tonal' }),
        ctx.components.button({ label: sample, variant: 'outlined' }),
        ctx.components.button({ label: sample, variant: 'text' }),
        ctx.components.button({ label: sample, variant: 'elevated' })
      );
    }
  },
  {
    id: 'controls.iconButton',
    label: 'appearance.category.controls.iconButton',
    fallback: 'Icon buttons',
    selector: '.md-icon-btn',
    icon: 'tune',
    kind: 'inline',
    keywords: ['icon', 'button', 'toggle'],
    build(ctx) {
      return row(
        ctx.components.iconButton({ icon: 'edit', label: ctx.t('appearance.elements.edit', 'Edit appearance…') }),
        ctx.components.iconButton({
          icon: 'refresh',
          label: ctx.t('appearance.elements.reset', 'Reset this element'),
          variant: 'tonal'
        }),
        ctx.components.iconButton({
          icon: 'lock',
          label: ctx.t('appearance.elements.lock', 'Lock this element…'),
          variant: 'outlined'
        })
      );
    }
  },
  {
    id: 'controls.field',
    label: 'appearance.category.controls.field',
    fallback: 'Text fields',
    selector: '.md-field',
    icon: 'edit',
    kind: 'inline',
    keywords: ['input', 'text', 'field', 'form'],
    build(ctx, sample) {
      const filled = ctx.components.textField({
        label: ctx.t('appearance.type.sample', 'Sample text'),
        value: sample,
        supportingText: ctx.t('appearance.elements.fieldSupport', 'Supporting text sits under the field.')
      });
      const outlined = ctx.components.textField({
        label: ctx.t('appearance.type.sample', 'Sample text'),
        value: sample,
        variant: 'outlined'
      });
      return row(filled.root, outlined.root);
    }
  },
  {
    id: 'controls.select',
    label: 'appearance.category.controls.select',
    fallback: 'Dropdowns',
    selector: '.md-select__button',
    icon: 'chevronDown',
    kind: 'inline',
    keywords: ['select', 'dropdown', 'combobox', 'picker'],
    build(ctx) {
      const handle = ctx.components.select({
        label: ctx.t('appearance.theme.contrast', 'Contrast'),
        value: 'standard',
        options: [
          { value: 'standard', label: 'appearance.theme.contrast.standard' },
          { value: 'medium', label: 'appearance.theme.contrast.medium' },
          { value: 'high', label: 'appearance.theme.contrast.high' }
        ]
      });
      return handle.root;
    }
  },
  {
    id: 'controls.switch',
    label: 'appearance.category.controls.switch',
    fallback: 'Switches and checkboxes',
    selector: '.md-switch',
    icon: 'check',
    kind: 'inline',
    keywords: ['switch', 'toggle', 'checkbox'],
    build(ctx, sample) {
      const toggle = ctx.components.switchControl({ label: sample, checked: true });
      const box = ctx.components.checkbox({ label: sample, checked: false });
      return row(toggle.root, box.root);
    }
  },
  {
    id: 'controls.slider',
    label: 'appearance.category.controls.slider',
    fallback: 'Sliders',
    selector: '.md-slider',
    icon: 'tune',
    kind: 'inline',
    keywords: ['slider', 'range', 'stepper'],
    build(ctx) {
      const handle = ctx.components.slider({
        label: ctx.t('appearance.theme.density', 'Density'),
        min: -3,
        max: 0,
        step: 1,
        value: 0,
        showTicks: true
      });
      return handle.root;
    }
  },
  {
    id: 'controls.chip',
    label: 'appearance.category.controls.chip',
    fallback: 'Chips',
    selector: '.md-chip',
    icon: 'filter',
    kind: 'inline',
    keywords: ['chip', 'filter', 'tag'],
    build(ctx, sample) {
      return row(
        ctx.components.chip({ label: sample, selected: true }),
        ctx.components.chip({ label: sample, icon: 'palette' }),
        ctx.components.chip({ label: sample, removable: true })
      );
    }
  },
  {
    id: 'surfaces.card',
    label: 'appearance.category.surfaces.card',
    fallback: 'Cards',
    selector: '.md-card',
    icon: 'file',
    kind: 'inline',
    keywords: ['card', 'surface', 'elevation'],
    build(ctx, sample) {
      const elevated = ctx.components.card({ variant: 'elevated', title: sample, subtitle: sample });
      const outlined = ctx.components.card({ variant: 'outlined', title: sample });
      return row(elevated, outlined);
    }
  },
  {
    id: 'surfaces.list',
    label: 'appearance.category.surfaces.list',
    fallback: 'List rows',
    selector: '.md-list-item',
    icon: 'sort',
    kind: 'inline',
    keywords: ['list', 'row', 'item'],
    build(ctx, sample) {
      const list = ctx.components.list({ label: ctx.t('appearance.section.elements', 'Rendered elements') });
      list.append(
        ctx.components.listItem({ headline: sample, supporting: sample, leadingIcon: 'palette' }),
        ctx.components.listItem({ headline: sample, supporting: sample, leadingIcon: 'edit' })
      );
      return list;
    }
  },
  {
    id: 'surfaces.table',
    label: 'appearance.category.surfaces.table',
    fallback: 'Tables',
    selector: '.md-table',
    icon: 'sort',
    kind: 'inline',
    keywords: ['table', 'grid', 'rows', 'columns'],
    build(ctx, sample) {
      const handle = ctx.components.dataTable<{ id: string; name: string; value: string }>({
        label: ctx.t('appearance.section.elements', 'Rendered elements'),
        columns: [
          { id: 'name', label: ctx.t('appearance.preset.saveName', 'Preset name'), sortable: true, value: (r) => r.name },
          { id: 'value', label: ctx.t('appearance.type.sample', 'Sample text'), value: (r) => r.value }
        ],
        rows: [
          { id: '1', name: 'primary', value: sample },
          { id: '2', name: 'surface', value: sample }
        ],
        rowId: (r) => r.id
      });
      return handle.root;
    }
  },
  {
    id: 'surfaces.menu',
    label: 'appearance.category.surfaces.menu',
    fallback: 'Menus and context menus',
    selector: '.md-menu__item',
    icon: 'more',
    kind: 'action',
    keywords: ['menu', 'context', 'right click', 'overflow'],
    build(ctx, sample) {
      return ctx.components.button({
        label: ctx.t('appearance.elements.openMenu', 'Open a real menu'),
        variant: 'tonal',
        icon: 'more',
        onClick: (event) => {
          ctx.components.menu({
            anchor: event.currentTarget as HTMLElement,
            label: ctx.t('appearance.section.elements', 'Rendered elements'),
            items: [
              { id: 'one', label: sample, icon: 'palette', shortcut: 'Ctrl+Shift+F' },
              { id: 'two', label: sample, icon: 'edit' },
              { id: 'three', label: sample, icon: 'refresh', separatorBefore: true }
            ]
          });
        }
      });
    }
  },
  {
    id: 'surfaces.notification',
    label: 'appearance.category.surfaces.notification',
    fallback: 'Notifications',
    selector: '.md-toast',
    icon: 'notifications',
    kind: 'action',
    keywords: ['toast', 'snackbar', 'notification', 'alert'],
    build(ctx, sample) {
      return ctx.components.button({
        label: ctx.t('appearance.elements.showNotification', 'Raise a real notification'),
        variant: 'tonal',
        icon: 'notifications',
        onClick: () => {
          ctx.notify.info(ctx.t('appearance.tab.title', 'Appearance'), sample);
        }
      });
    }
  },
  {
    id: 'surfaces.dialog',
    label: 'appearance.category.surfaces.dialog',
    fallback: 'Dialogs',
    selector: '.md-dialog',
    icon: 'info',
    kind: 'action',
    keywords: ['dialog', 'modal', 'decision'],
    build(ctx, sample) {
      return ctx.components.button({
        label: ctx.t('appearance.elements.openDialog', 'Open a real dialog'),
        variant: 'tonal',
        icon: 'info',
        onClick: () => {
          void ctx.components.dialog({
            title: ctx.t('appearance.tab.title', 'Appearance'),
            body: sample,
            confirmLabel: ctx.t('core.action.ok', 'OK'),
            cancelLabel: ctx.t('core.action.cancel', 'Cancel')
          });
        }
      });
    }
  },
  {
    id: 'surfaces.confirm',
    label: 'appearance.category.surfaces.confirm',
    fallback: 'The destructive-action gate',
    selector: '.md-confirm',
    icon: 'warning',
    kind: 'explained',
    keywords: ['confirm', 'destructive', 'gate', 'two key', 'slider'],
    build(ctx) {
      return explanation(
        ctx.t(
          'appearance.elements.confirmExplain',
          'The two-key gate appears whenever an irreversible action is taken, such as deleting saved presets on this same page. It is not opened here for a pretend action, but editing this category changes the gate wherever it genuinely appears.'
        )
      );
    }
  },
  {
    id: 'surfaces.settingRow',
    label: 'appearance.category.surfaces.settingRow',
    fallback: 'Settings rows',
    selector: '.md-setting',
    icon: 'settings',
    kind: 'action',
    keywords: ['settings', 'preferences', 'row', 'provenance'],
    build(ctx) {
      return ctx.components.button({
        label: ctx.t('appearance.elements.openSettings', 'Open the settings surface'),
        variant: 'tonal',
        icon: 'settings',
        onClick: () => ctx.tabs.open('core.settings')
      });
    }
  },
  {
    id: 'surfaces.search',
    label: 'appearance.category.surfaces.search',
    fallback: 'Search bars',
    selector: '.md-search__field',
    icon: 'search',
    kind: 'inline',
    keywords: ['search', 'filter', 'regex', 'builder'],
    build(ctx) {
      const bar = ctx.createSearchBar({
        label: 'appearance.elements.search',
        sample: ELEMENT_CATEGORIES.map((category) => `${category.label} ${category.selector}`).join('\n'),
        onChange: () => undefined
      });
      return bar.root;
    }
  },
  {
    id: 'surfaces.palette',
    label: 'appearance.category.surfaces.palette',
    fallback: 'The command palette',
    selector: '.md-palette',
    icon: 'search',
    kind: 'action',
    keywords: ['palette', 'command', 'ctrl shift f'],
    build(ctx) {
      return ctx.components.button({
        label: ctx.t('core.palette.title', 'Command palette'),
        variant: 'tonal',
        icon: 'search',
        onClick: () => ctx.palette.open()
      });
    }
  },
  {
    id: 'surfaces.appearanceEditor',
    label: 'appearance.category.surfaces.appearanceEditor',
    fallback: "The appearance editor's own dialog",
    selector: '.md-appearance',
    icon: 'palette',
    kind: 'action',
    keywords: ['editor', 'itself', 'dialog', 'popover'],
    build(ctx) {
      const trigger = ctx.components.button({
        label: ctx.t('appearance.elements.editSelf', 'Open the appearance editor on the appearance editor'),
        variant: 'tonal',
        icon: 'palette',
        onClick: () => ctx.appearance.edit(trigger, '.md-appearance')
      });
      return trigger;
    }
  },
  {
    id: 'surfaces.colorPicker',
    label: 'appearance.category.surfaces.colorPicker',
    fallback: 'The colour picker',
    selector: '.md-colorpicker',
    icon: 'palette',
    kind: 'action',
    keywords: ['colour', 'color', 'picker', 'spectrum', 'translator'],
    build(ctx) {
      const trigger = ctx.components.button({
        label: ctx.t('appearance.theme.seedOpen', 'Choose the accent colour'),
        variant: 'tonal',
        icon: 'palette',
        onClick: () => {
          openColorPicker({
            anchor: trigger,
            value: ctx.theme.state().seed,
            contrastAgainst: getComputedStyle(document.body).backgroundColor,
            onChange: (value) => ctx.theme.setSeed(value)
          });
        }
      });
      return trigger;
    }
  },
  {
    id: 'surfaces.datePicker',
    label: 'appearance.category.surfaces.datePicker',
    fallback: 'The date picker',
    selector: '.md-datepicker',
    icon: 'calendar',
    kind: 'inline',
    keywords: ['date', 'calendar', 'range'],
    build(ctx) {
      const handle = ctx.components.datePicker({
        label: ctx.t('appearance.elements.dateLabel', 'Date'),
        value: null
      });
      return handle.root;
    }
  },
  {
    id: 'surfaces.empty',
    label: 'appearance.category.surfaces.empty',
    fallback: 'Empty states',
    selector: '.md-empty',
    icon: 'info',
    kind: 'inline',
    keywords: ['empty', 'nothing', 'blank'],
    build(ctx, sample) {
      return ctx.components.emptyState({
        title: sample,
        body: ctx.t(
          'appearance.elements.emptyExplain',
          'An empty state says what is missing and offers the action that fills it.'
        )
      });
    }
  }
];
