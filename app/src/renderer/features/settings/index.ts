import { defineFeature } from '../../core/registry';
import type { AppContext, DocArticle, PaletteEntry, SettingsSection } from '../../core/registry';
import './styles.css';
import { SETTINGS_ARTICLE } from './docs';
import { SETTINGS_STRINGS } from './strings';
import { openExportPanel, openImportFlow, resetEverySetting, exportableFrom, isOmitted } from './transfer';
import {
  EXPAND_EXPLANATIONS_ID,
  SETTINGS_TAB_ID,
  SHOW_IDS_ID,
  START_TAB_ID,
  STRIP_DOCK_ID,
  currentSurface,
  mountSettingsSurface,
  visibleSections
} from './surface';

/**
 * The tabbed settings surface: the shell every other feature's settings section
 * lands in.
 *
 * A feature contributes a `SettingsSection`; this module turns each one into a
 * real tab in a real tab strip, renders every kind of control it declares, and
 * gives each control its explanation, its truthful provenance line, inline
 * validation in plain words and a per-control reset.
 */

function anchorFor(fallback: HTMLElement | null): HTMLElement {
  const active = document.activeElement;
  if (active instanceof HTMLElement && active !== document.body) return active;
  return fallback ?? document.body;
}

function settingsSection(): SettingsSection {
  return {
    id: 'settings.surface',
    title: 'settings.section.title',
    icon: 'tune',
    order: 15,
    controls: [
      {
        id: STRIP_DOCK_ID,
        label: 'settings.strip.dock',
        description: 'settings.strip.dock.description',
        kind: 'select',
        defaultValue: 'left',
        keywords: ['tabs', 'dock', 'strip', 'settings', 'layout', 'left', 'right', 'top', 'bottom'],
        options: [
          { value: 'left', label: 'settings.strip.dock.left' },
          { value: 'right', label: 'settings.strip.dock.right' },
          { value: 'top', label: 'settings.strip.dock.top' },
          { value: 'bottom', label: 'settings.strip.dock.bottom' }
        ],
        validate: (value) =>
          value === 'left' || value === 'right' || value === 'top' || value === 'bottom'
            ? null
            : 'Choose one of left, right, top or bottom.'
      },
      {
        // A picker rather than a blank box: the choices are the settings tabs
        // that genuinely exist right now, read at the moment the control renders.
        id: START_TAB_ID,
        label: 'settings.startTab',
        description: 'settings.startTab.description',
        kind: 'custom',
        defaultValue: 'last',
        keywords: ['start', 'first', 'open', 'settings', 'tab'],
        render(host, ctx) {
          const sections = visibleSections(ctx);
          const control = ctx.components.select({
            label: 'settings.startTab',
            value: String(ctx.value ?? 'last'),
            options: [
              { value: 'last', label: 'settings.startTab.last' },
              ...sections.map((section) => ({ value: section.id, label: section.title }))
            ],
            onChange: (value) => ctx.setValue(value)
          });
          host.append(control.root);
          if (sections.length === 0) {
            control.setDisabled(true, 'No feature has registered a settings section yet.');
          }
        }
      },
      {
        id: SHOW_IDS_ID,
        label: 'settings.showIds',
        description: 'settings.showIds.description',
        kind: 'switch',
        defaultValue: false,
        keywords: ['id', 'identifier', 'developer', 'key']
      },
      {
        id: EXPAND_EXPLANATIONS_ID,
        label: 'settings.expandAll',
        description: 'settings.expandAll.description',
        kind: 'switch',
        defaultValue: false,
        keywords: ['explanation', 'help', 'expand', 'describe']
      },
      {
        id: 'settings.action.export',
        label: 'settings.export.title',
        description: 'settings.export.description',
        kind: 'action',
        defaultValue: null,
        keywords: ['export', 'backup', 'json', 'csv', 'yaml'],
        lockable: false,
        lockableReason: 'An action has no stored value, so a lock on it would guard nothing.',
        run: (ctx) => {
          const scopeSource = currentSurface();
          openExportPanel(ctx, anchorFor(null), [
            {
              id: 'all',
              label: 'settings.export.scope.all',
              collect: () =>
                (scopeSource?.sections() ?? visibleSections(ctx)).flatMap((section) =>
                  section.controls
                    .filter((control) => !isOmitted(control.id))
                    .map((control) => exportableFrom(ctx, section, control))
                )
            },
            {
              id: 'changed',
              label: 'settings.export.scope.changed',
              collect: () =>
                (scopeSource?.sections() ?? visibleSections(ctx)).flatMap((section) =>
                  section.controls
                    .filter((control) => !isOmitted(control.id) && ctx.settings.provenanceOf(control.id) !== 'default')
                    .map((control) => exportableFrom(ctx, section, control))
                )
            }
          ]);
        }
      },
      {
        id: 'settings.action.import',
        label: 'settings.import.title',
        description: 'settings.import.description',
        kind: 'action',
        defaultValue: null,
        keywords: ['import', 'restore', 'json'],
        lockable: false,
        lockableReason: 'An action has no stored value, so a lock on it would guard nothing.',
        run: (ctx) => {
          openImportFlow(
            ctx,
            anchorFor(null),
            () =>
              new Set(
                visibleSections(ctx).flatMap((section) => section.controls.map((control) => control.id))
              )
          );
        }
      },
      {
        id: 'settings.action.resetAll',
        label: 'settings.reset.all',
        description: 'settings.reset.allDescription',
        kind: 'action',
        defaultValue: null,
        keywords: ['reset', 'default', 'factory', 'clear'],
        lockable: false,
        lockableReason: 'An action has no stored value, so a lock on it would guard nothing.',
        run: (ctx) => resetEverySetting(ctx, anchorFor(null))
      }
    ]
  };
}

/**
 * Only the plain destination is declared statically. Every command that needs a
 * live application context is registered in `init`, because a palette row that
 * looks like it works and does nothing is worse than no row at all.
 */
function staticPalette(): PaletteEntry[] {
  return [
    {
      id: 'settings.command.open',
      title: 'Open settings',
      subtitle: 'Every setting in the application, in tabs',
      icon: 'tune',
      kind: 'destination',
      keywords: ['settings', 'preferences', 'options', 'configure'],
      teleport: { tabId: SETTINGS_TAB_ID }
    }
  ];
}

const DOCS: DocArticle[] = [SETTINGS_ARTICLE];

export default defineFeature({
  id: 'settings',
  name: 'Settings',
  description:
    'The tabbed settings destination: one tab per registered section, a search across every label, explanation and current value, guided controls with truthful provenance, bulk actions, export and import.',
  strings: SETTINGS_STRINGS,
  tabs: [
    {
      id: SETTINGS_TAB_ID,
      title: 'settings.tab.title',
      icon: 'tune',
      order: 890,
      permanent: true,
      mount: (host, ctx) => {
        mountSettingsSurface(host, ctx);
      }
    }
  ],
  settings: [settingsSection()],
  palette: staticPalette(),
  docs: DOCS,
  init(ctx: AppContext) {
    // The palette commands above are declared statically so they are findable
    // even before this runs; here they are given the behaviour that needs a live
    // application context, plus one destination per settings tab and one per
    // setting this module owns, each of which teleports to the exact element.
    const openSurface = (then?: () => void): void => {
      ctx.tabs.open(SETTINGS_TAB_ID);
      if (!then) return;
      window.requestAnimationFrame(then);
    };

    const dynamic: PaletteEntry[] = [
      {
        id: 'settings.command.export.live',
        title: 'Export settings…',
        subtitle: 'Opens the export panel on the settings tab',
        icon: 'download',
        kind: 'command',
        keywords: ['export', 'backup', 'json'],
        run: () =>
          openSurface(() =>
            openExportPanel(ctx, anchorFor(null), [
              {
                id: 'all',
                label: 'settings.export.scope.all',
                collect: () =>
                  visibleSections(ctx).flatMap((section) =>
                    section.controls
                      .filter((control) => !isOmitted(control.id))
                      .map((control) => exportableFrom(ctx, section, control))
                  )
              }
            ])
          )
      },
      {
        id: 'settings.command.import.live',
        title: 'Import settings…',
        subtitle: 'Opens the import panel on the settings tab',
        icon: 'upload',
        kind: 'command',
        keywords: ['import', 'restore'],
        run: () =>
          openSurface(() =>
            openImportFlow(
              ctx,
              anchorFor(null),
              () => new Set(visibleSections(ctx).flatMap((section) => section.controls.map((control) => control.id)))
            )
          )
      },
      {
        id: 'settings.command.resetAll.live',
        title: 'Reset every setting…',
        subtitle: 'Opens the two-key confirmation gate',
        icon: 'refresh',
        kind: 'command',
        keywords: ['reset', 'factory', 'defaults'],
        run: () => openSurface(() => void resetEverySetting(ctx, anchorFor(null)))
      },
      {
        id: 'settings.command.reopenTabs',
        title: 'Reopen every closed settings tab',
        subtitle: 'Brings back every settings tab a bulk close hid',
        icon: 'refresh',
        kind: 'command',
        keywords: ['settings', 'tabs', 'reopen', 'closed'],
        run: () =>
          openSurface(() => {
            currentSurface()?.reopenClosedTabs();
          })
      },
      ...(['left', 'right', 'top', 'bottom'] as const).map<PaletteEntry>((edge) => ({
        id: `settings.command.dock.${edge}`,
        title: `Dock the settings tab strip to the ${edge}`,
        subtitle: 'Changes where the settings tabs sit',
        icon: 'dock',
        kind: 'command',
        keywords: ['settings', 'tabs', 'dock', edge],
        run: () => {
          ctx.settings.set(STRIP_DOCK_ID, edge);
          openSurface();
        }
      }))
    ];

    for (const section of ctx.registry.settingsSections()) {
      dynamic.push({
        id: `settings.destination.${section.id}`,
        title: ctx.i18n.t(section.title, section.title),
        subtitle: `Settings tab · ${section.controls.length} settings`,
        icon: section.icon,
        kind: 'destination',
        keywords: ['settings', section.id, ...section.controls.map((control) => control.id)],
        run: () =>
          openSurface(() => {
            currentSurface()?.openSection(section.id);
          })
      });
      for (const control of section.controls) {
        dynamic.push({
          id: `settings.reveal.${control.id}`,
          title: ctx.i18n.t(control.label, control.label),
          subtitle: `Settings · ${ctx.i18n.t(section.title, section.title)} · ${control.id}`,
          icon: section.icon,
          kind: 'destination',
          keywords: ['settings', control.id, ...(control.keywords ?? [])],
          run: () =>
            openSurface(() => {
              const surface = currentSurface();
              if (!surface) return;
              surface.openSection(section.id);
              window.requestAnimationFrame(() => surface.reveal(control.id));
            })
        });
      }
    }

    ctx.palette.add(dynamic);
  }
});
