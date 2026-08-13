import { el } from './a11y';
import { components } from './components';
import { docsCoverage, docsService, setDocsOpener } from './docs';
import { exporter } from './export';
import {
  EMOJI_DIALOGS_ID,
  FUNNY_EN_ID,
  FUNNY_YUE_ID,
  LANGUAGE_MODE_ID,
  SCHOOL_ENABLED_ID,
  SCHOOL_NAME_ID,
  VOCABULARY_LIMITS,
  i18n
} from './i18n';
import { locks } from './locks';
import { renderMarkdown } from './markdown';
import { listShortcutsForDisplay } from './menu';
import { notifications } from './notifications';
import { createRegexBuilder } from './regexbuilder';
import { registry } from './registry';
import { createSearchBar } from './searchbar';
import { renderSettingRow } from './settingcontrol';
import { settings } from './settings';
import { verifyCoreSettingsCoverage } from './settings-ui';
import { hashPassword } from './totp';
import {
  DEFAULT_SEED,
  THEME_CONTRAST_ID,
  THEME_DENSITY_ID,
  THEME_FONT_FAMILY_ID,
  THEME_FONT_SCALE_ID,
  THEME_FONT_WEIGHT_ID,
  THEME_MODE_ID,
  THEME_SEED_ID
} from './theme';
import type { AppContext, DocArticle, FeatureModule, HistoryEntry, SettingsSection, TabContext } from './types';

/**
 * The core feature module.
 *
 * Everything the application does without any feature installed lives here, and
 * it is registered through exactly the same registry every feature uses — so the
 * core is not a privileged special case that features have to work around.
 */

export const APP_DISPLAY_NAME_ID = 'app.displayName';

/* ================================================================== */
/* Settings sections                                                   */
/* ================================================================== */

function languageSection(): SettingsSection {
  return {
    id: 'core.language',
    title: 'core.language.section',
    icon: 'world',
    order: 10,
    controls: [
      {
        id: LANGUAGE_MODE_ID,
        label: 'core.language.mode',
        description: 'core.language.mode.description',
        kind: 'select',
        defaultValue: 'en',
        keywords: ['english', 'cantonese', 'bilingual', 'language', '語言'],
        options: [
          { value: 'en', label: 'core.language.mode.en' },
          { value: 'yue', label: 'core.language.mode.yue' },
          { value: 'both', label: 'core.language.mode.both' }
        ]
      },
      {
        id: FUNNY_EN_ID,
        label: 'core.language.funnyEn',
        description: 'core.language.funny.description',
        kind: 'slider',
        defaultValue: 3,
        min: 1,
        max: 5,
        step: 1,
        keywords: ['humour', 'humor', 'funny', 'tone', 'voice']
      },
      {
        id: FUNNY_YUE_ID,
        label: 'core.language.funnyYue',
        description: 'core.language.funny.description',
        kind: 'slider',
        defaultValue: 3,
        min: 1,
        max: 5,
        step: 1,
        keywords: ['humour', 'funny', '廣東話', 'tone']
      },
      {
        id: EMOJI_DIALOGS_ID,
        label: 'core.language.emoji',
        description: 'core.language.emoji.description',
        kind: 'switch',
        defaultValue: true,
        keywords: ['emoji', 'dialog', 'message box']
      },
      {
        // Always present, before any file exists. The control is not permission
        // to ship built-in mappings: until the user supplies a valid file,
        // nothing is replaced anywhere.
        id: 'vocabulary.file',
        label: 'core.language.vocabulary',
        description: 'core.language.vocabulary.description',
        kind: 'custom',
        defaultValue: '',
        keywords: ['vocabulary', 'words', 'replacements', 'json'],
        render(host, ctx) {
          const status = el('p', { className: 'md-field__support md-typescale-body-small', attrs: { role: 'status' } });
          const refresh = (): void => {
            const snapshot = i18n.snapshot();
            status.textContent = snapshot.vocabularyLoaded
              ? ctx.t('core.language.vocabulary.loaded', '{count} replacements loaded', {
                  values: { count: String(settings.get<number>('vocabulary.count', 0)) }
                })
              : ctx.t('core.language.vocabulary.none', 'No file loaded');
          };

          const choose = components.button({
            label: 'core.action.browse',
            variant: 'tonal',
            icon: 'upload',
            onClick: async () => {
              const picked = await window.studio.dialog.openFile({
                filters: [{ name: 'JSON', extensions: ['json'] }]
              });
              if (!picked.ok || !picked.value || !picked.value[0]) return;
              const read = await window.studio.fs.readText(picked.value[0], VOCABULARY_LIMITS.maxBytes);
              if (!read.ok) {
                status.textContent = ctx.t('core.language.vocabulary.invalid', 'That file was refused: {reason}', {
                  values: { reason: read.error }
                });
                return;
              }
              const result = await i18n.loadVocabularyFile(read.value);
              if (!result.ok) {
                status.textContent = ctx.t('core.language.vocabulary.invalid', 'That file was refused: {reason}', {
                  values: { reason: result.error ?? 'unknown reason' }
                });
                return;
              }
              settings.set('vocabulary.count', result.entryCount);
              refresh();
            }
          });

          const clear = components.button({
            label: 'core.language.vocabulary.clear',
            variant: 'text',
            onClick: async () => {
              await i18n.clearVocabulary();
              settings.reset('vocabulary.count');
              refresh();
            }
          });

          const limits = el('p', {
            className: 'md-field__support md-typescale-body-small',
            text: `Accepted: JSON, schema version ${VOCABULARY_LIMITS.supportedVersions.join('/')}, at most ${VOCABULARY_LIMITS.maxBytes} bytes and ${VOCABULARY_LIMITS.maxEntries} entries. Read locally; never uploaded, logged or exported.`
          });

          host.append(choose, clear, status, limits);
          refresh();
        }
      }
    ]
  };
}

function schoolSection(): SettingsSection {
  const name = (): string => settings.get<string>(SCHOOL_NAME_ID, 'School mode') || 'School mode';
  return {
    id: 'core.school',
    title: 'core.school.title',
    icon: 'lock',
    order: 20,
    controls: [
      {
        id: SCHOOL_ENABLED_ID,
        label: 'core.school.title',
        description: 'core.school.description',
        kind: 'switch',
        defaultValue: false,
        lockable: false,
        lockableReason:
          'This switch is itself the lock, so putting a second lock on it would leave no route back.',
        keywords: ['school', 'study', 'english only', 'lock'],
        validate: () => null
      },
      {
        id: SCHOOL_NAME_ID,
        label: 'core.school.rename',
        description: 'core.school.description',
        kind: 'text',
        defaultValue: 'School mode',
        keywords: ['rename', 'school'],
        validate: (value) =>
          typeof value === 'string' && value.trim().length > 0 ? null : 'The mode needs a name. Nothing was changed.'
      },
      {
        id: 'school.unlock.set',
        label: 'Set the unlock code',
        description:
          'Stores a verifier for the code that turns this mode off. The code itself is never stored, and deleting the application data folder resets it.',
        kind: 'action',
        defaultValue: null,
        run: async (ctx) => {
          const value = window.prompt(`Unlock code for ${name()}`);
          if (!value) return;
          const stored = await window.studio.vault.set('school.unlock', await hashPassword(value));
          if (!stored.ok) {
            ctx.notify.error('The unlock code was not stored', stored.error);
            return;
          }
          ctx.notify.success('Unlock code stored', `Deleting ${window.studio.info.userDataDir} resets it.`);
        }
      }
    ]
  };
}

function appearanceSection(): SettingsSection {
  return {
    id: 'core.appearance',
    title: 'core.appearance.section',
    icon: 'palette',
    order: 30,
    controls: [
      {
        id: THEME_MODE_ID,
        label: 'core.appearance.theme',
        description:
          'Chooses the light or dark scheme, or follows the operating system. Both schemes are generated from the accent colour below.',
        kind: 'select',
        defaultValue: 'system',
        keywords: ['theme', 'dark', 'light'],
        options: [
          { value: 'system', label: 'core.appearance.theme.system' },
          { value: 'light', label: 'core.appearance.theme.light' },
          { value: 'dark', label: 'core.appearance.theme.dark' }
        ]
      },
      {
        id: THEME_SEED_ID,
        label: 'core.appearance.seed',
        description: 'core.appearance.seed.description',
        kind: 'color',
        defaultValue: DEFAULT_SEED,
        keywords: ['colour', 'color', 'accent', 'seed']
      },
      {
        id: THEME_CONTRAST_ID,
        label: 'core.appearance.contrast',
        description:
          'Pushes the text and container tones further apart. The accent colour itself does not move, so a higher setting never silently changes the scheme.',
        kind: 'select',
        defaultValue: 'standard',
        options: [
          { value: 'standard', label: 'Standard' },
          { value: 'medium', label: 'Medium' },
          { value: 'high', label: 'High' }
        ]
      },
      {
        id: THEME_DENSITY_ID,
        label: 'core.appearance.density',
        description:
          'Tightens the height of rows, buttons and fields. -2 is the shipped desktop-application spacing — this application packs more per row than a document does; 0 is the roomiest setting and -3 is the most compact. Touch targets stay at their accessible minimum at every level.',
        kind: 'slider',
        defaultValue: -2,
        min: -3,
        max: 0,
        step: 1
      },
      {
        id: THEME_FONT_FAMILY_ID,
        label: 'core.appearance.font',
        description:
          'Chooses the interface typeface from the families installed on this machine, ahead of the bundled fallback stack. A family that cannot render Chinese still falls back for those characters.',
        kind: 'font',
        defaultValue: ''
      },
      {
        id: THEME_FONT_SCALE_ID,
        label: 'core.appearance.fontScale',
        description: 'Multiplies the whole type scale. Sizes are declared in CSS pixels throughout.',
        kind: 'slider',
        defaultValue: 1,
        min: 0.8,
        max: 1.6,
        step: 0.05
      },
      {
        id: THEME_FONT_WEIGHT_ID,
        label: 'core.appearance.fontWeight',
        description: 'Sets the base weight. A family without the chosen weight is synthesised by the platform.',
        kind: 'slider',
        defaultValue: 400,
        min: 100,
        max: 900,
        step: 100
      },
      {
        id: APP_DISPLAY_NAME_ID,
        label: 'core.appearance.appName',
        description: 'core.appearance.appName.description',
        kind: 'text',
        defaultValue: '',
        keywords: ['rename', 'title', 'name'],
        validate: (value) => (typeof value === 'string' && value.length <= 80 ? null : 'Use at most 80 characters.')
      },
      {
        id: 'appearance.resetAll',
        label: 'core.action.resetAll',
        description: 'Removes every per-element appearance override and restores the shipped theme.',
        kind: 'action',
        defaultValue: null,
        run: async (ctx) => {
          const approved = await ctx.confirm.request({
            action: ctx.t('core.action.resetAll', 'Reset everything'),
            affected: ['Every per-element appearance override', 'The theme, contrast, density and typography'],
            irreversible:
              'The overrides are removed. The change is recorded in local history, so it can be reviewed and reversed from there.',
            anchor: document.activeElement as HTMLElement
          });
          if (!approved) return;
          ctx.appearance.resetAll();
          ctx.theme.setSeed(DEFAULT_SEED);
          ctx.notify.success(ctx.t('core.action.resetAll', 'Reset everything'));
        }
      }
    ]
  };
}

function workspaceSection(): SettingsSection {
  return {
    id: 'core.workspace',
    title: 'core.tabs.strip',
    icon: 'dock',
    order: 40,
    controls: [
      {
        id: 'tabs.dock',
        label: 'core.tabs.dock',
        description:
          'Which edge the tab strip sits on. Left is the default: a screen is wider than it is tall and a tab label is wider than it is high, so a vertical strip shows more tabs legibly.',
        kind: 'select',
        defaultValue: 'left',
        keywords: ['tabs', 'dock', 'strip', 'layout'],
        options: [
          { value: 'left', label: 'core.tabs.dock.left' },
          { value: 'right', label: 'core.tabs.dock.right' },
          { value: 'top', label: 'core.tabs.dock.top' },
          { value: 'bottom', label: 'core.tabs.dock.bottom' }
        ]
      },
      {
        id: 'palette.size',
        label: 'core.palette.title',
        description: 'Whether Ctrl+Shift+F opens the bounded card or the full window. The card is the default.',
        kind: 'select',
        defaultValue: 'card',
        options: [
          { value: 'card', label: 'core.palette.sizeCard' },
          { value: 'full', label: 'core.palette.sizeFull' }
        ]
      }
    ]
  };
}

function dataSection(): SettingsSection {
  return {
    id: 'core.data',
    title: 'Data and diagnostics',
    icon: 'folder',
    order: 90,
    controls: [
      {
        id: 'data.reveal',
        label: 'Open the application data folder',
        description:
          'Opens the folder holding the settings file, the local history repository and the credential store. Deleting it resets every lock and every stored preference.',
        kind: 'action',
        defaultValue: null,
        run: async (ctx) => {
          const result = await window.studio.app.revealUserData();
          if (!result.ok) ctx.notify.error('The folder could not be opened', result.error);
        }
      },
      {
        id: 'data.exportSettings',
        label: 'Export every setting',
        description:
          'Writes the current settings and their provenance to a file. Credentials and the personal vocabulary cache are omitted, and the export says so.',
        kind: 'action',
        defaultValue: null,
        run: async (ctx) => {
          const records = settings
            .keys()
            .filter((key) => !key.startsWith('vocabulary.'))
            .map((key) => ({
              id: key,
              value: settings.get(key),
              provenance: settings.provenanceOf(key),
              shippedDefault: settings.defaultOf(key)
            }));
          records.push({
            id: '_omitted',
            value: 'Credentials and the personal vocabulary cache are not included in this export.',
            provenance: 'default',
            shippedDefault: null
          });
          const path = await exporter.save(records, 'json', { name: 'settings', defaultFileName: 'settings.json' });
          if (path) ctx.notify.success(ctx.t('core.export.saved', 'Exported to {path}', { values: { path } }));
        }
      },
      {
        id: 'data.resetSettings',
        label: 'core.action.resetAll',
        description: 'Restores every setting to the value this build ships with. Credentials are not touched.',
        kind: 'action',
        defaultValue: null,
        run: async (ctx) => {
          const approved = await ctx.confirm.request({
            action: 'Reset every setting to its shipped value',
            affected: settings.keys().slice(0, 40),
            irreversible:
              'Every stored preference is removed from the settings file. The change is recorded in local history, so the previous values can be read back from there.',
            anchor: document.activeElement as HTMLElement
          });
          if (!approved) return;
          settings.resetAll();
          ctx.notify.success('Every setting was reset');
        }
      }
    ]
  };
}

/* ================================================================== */
/* Tabs                                                                */
/* ================================================================== */

function mountHome(host: HTMLElement, ctx: TabContext): void {
  const info = window.studio.info;
  host.append(
    components.topAppBar({
      title: 'core.home.welcome',
      subtitle: 'core.home.lede'
    })
  );

  const grid = el('div', { className: 'md-appearance__grid' });

  const shortcutsCard = components.card({ variant: 'outlined', title: 'core.home.paletteHint' });
  shortcutsCard.append(
    components.button({
      label: 'core.palette.title',
      variant: 'tonal',
      icon: 'search',
      onClick: () => ctx.palette.open()
    })
  );
  // The chord shown on every row here is read live from the shortcut
  // registry (core/menu.ts), never typed as a copy — so this list can never
  // say something the keyboard does not actually do.
  const shortcutsButton = components.button({
    label: 'core.home.shortcuts',
    variant: 'text',
    icon: 'code',
    onClick: (event) => {
      const live = listShortcutsForDisplay();
      components.menu({
        anchor: event.currentTarget as HTMLElement,
        label: 'core.home.shortcuts',
        items:
          live.length === 0
            ? [{ id: 'none', label: 'core.home.shortcuts.none', disabled: true, disabledReason: 'core.home.shortcuts.none' }]
            : live.map((binding) => ({ id: binding.id, label: binding.label, shortcut: binding.chord }))
      });
    }
  });
  shortcutsCard.append(shortcutsButton);

  const identity = components.card({ variant: 'outlined', title: 'This build' });
  const rows: Array<[string, string]> = [
    ['Product', info.productName],
    ['Version', info.version],
    ['Package identity', info.packageName],
    ['Electron', info.versions.electron],
    ['Chromium', info.versions.chrome],
    ['Node', info.versions.node],
    ['Platform', `${info.platform} ${info.arch}`],
    ['Data folder', info.userDataDir],
    ['Packaged', String(info.isPackaged)]
  ];
  for (const [name, value] of rows) {
    identity.append(el('p', { className: 'md-typescale-body-small', text: `${name}: ${value}` }));
  }
  identity.append(
    components.button({
      label: 'Open the data folder',
      variant: 'text',
      icon: 'folder',
      onClick: () => void window.studio.app.revealUserData()
    })
  );

  const featuresCard = components.card({ variant: 'outlined', title: 'Installed features' });
  const modules = registry.modules();
  featuresCard.append(
    el('p', { className: 'md-typescale-body-small', text: `${modules.length} modules registered.` })
  );
  const featureList = components.list({ label: 'Installed features' });
  for (const module of modules) {
    featureList.append(
      components.listItem({
        headline: module.name,
        supporting: module.description,
        leadingIcon: 'bolt'
      })
    );
  }
  featuresCard.append(featureList);

  const coverage = docsCoverage();
  const docsCard = components.card({ variant: 'outlined', title: 'core.docs.title' });
  docsCard.append(
    el('p', {
      className: 'md-typescale-body-small',
      text:
        coverage.missing.length === 0
          ? `${coverage.total} articles bundled, and every feature with a surface has at least one.`
          : `${coverage.total} articles bundled. These features have a surface and no article yet: ${coverage.missing.join(', ')}.`
    })
  );
  docsCard.append(
    components.button({
      label: 'core.docs.title',
      variant: 'text',
      icon: 'book',
      onClick: () => ctx.tabs.open('core.docs')
    })
  );

  grid.append(shortcutsCard, identity, featuresCard, docsCard);
  host.append(grid);
}

function mountSettings(host: HTMLElement, ctx: TabContext): void {
  host.append(components.topAppBar({ title: 'core.settings.title' }));

  const sections = registry.settingsSections().filter((section) => {
    // While the named study mode is on, the language and humour controls are
    // omitted from the surface entirely rather than merely disabled.
    if (!i18n.schoolModeActive()) return true;
    return section.id !== 'core.language';
  });

  const tabHost = el('div', { className: 'md-settings' });
  const bodies = new Map<string, HTMLElement>();

  const bar = components.tabBar({
    tabs: sections.map((section) => ({ id: section.id, label: section.title, icon: section.icon })),
    active: sections[0]?.id,
    onChange: (id) => {
      for (const [sectionId, body] of bodies) body.hidden = sectionId !== id;
    }
  });

  const rowsBySection = new Map<string, HTMLElement[]>();

  for (const section of sections) {
    const body = el('div', { className: 'md-settings__section' });
    body.hidden = section.id !== sections[0]?.id;
    const rows: HTMLElement[] = [];
    for (const control of section.controls) {
      const row = renderSettingRow(control, ctx);
      rows.push(row);
      body.append(row);
    }
    rowsBySection.set(section.id, rows);
    bodies.set(section.id, body);
    tabHost.append(body);
  }

  const summary = el('p', { className: 'md-typescale-body-small', attrs: { role: 'status' } });

  const search = createSearchBar({
    label: 'core.settings.search',
    sample: sections
      .flatMap((section) => section.controls.map((control) => `${i18n.t(control.label, control.label)} ${control.id}`))
      .join('\n'),
    onChange: (query) => {
      let shown = 0;
      let total = 0;
      const hitsElsewhere: string[] = [];
      for (const section of sections) {
        const rows = rowsBySection.get(section.id) ?? [];
        const activeSection = bodies.get(section.id)?.hidden === false;
        section.controls.forEach((control, index) => {
          total += 1;
          const haystack = `${i18n.t(control.label, control.label)} ${i18n.t(control.description, control.description)} ${control.id} ${(control.keywords ?? []).join(' ')}`;
          const matched = query.matches(haystack);
          const row = rows[index];
          if (row) row.hidden = !matched;
          if (matched) {
            shown += 1;
            if (!activeSection) hitsElsewhere.push(i18n.t(section.title, section.title));
          }
        });
      }
      const elsewhere = [...new Set(hitsElsewhere)];
      summary.textContent = [
        i18n.t('core.search.matchCount', '{count} of {total} shown', { values: { count: shown, total } }),
        elsewhere.length > 0
          ? elsewhere
              .map((tab) => i18n.t('core.settings.onOtherTab', 'This match is on the "{tab}" tab.', { values: { tab } }))
              .join(' ')
          : ''
      ]
        .filter(Boolean)
        .join(' ');
    }
  });

  host.append(search.root, summary, bar, tabHost);
  ctx.onDispose(() => search.destroy());
}

function mountDocs(host: HTMLElement, ctx: TabContext): void {
  host.append(components.topAppBar({ title: 'core.docs.title', subtitle: 'core.docs.offline' }));

  const layout = el('div', { className: 'md-docs' });
  const index = el('nav', { className: 'md-docs__index', attrs: { 'aria-label': 'Documentation index' } });
  const article = el('article', { className: 'md-docs__article' });
  layout.append(index, article);

  let currentArticles: DocArticle[] = docsService.all();

  const show = (id: string): void => {
    const found = docsService.byId(id);
    article.textContent = '';
    if (!found) {
      article.append(components.emptyState({ title: 'core.docs.empty' }));
      return;
    }
    article.append(el('h1', { className: 'md-typescale-headline-medium', text: found.title }));
    article.append(
      el('p', { className: 'md-typescale-label-medium md-setting__secondary', text: found.category })
    );
    article.append(renderMarkdown(found.body, { onInternalLink: (target) => show(target) }));
    if (found.related.length > 0) {
      article.append(el('h2', { className: 'md-typescale-title-medium', text: ctx.t('core.docs.related', 'Suggested articles') }));
      const related = components.list({ label: 'core.docs.related' });
      for (const relatedId of found.related) {
        const target = docsService.byId(relatedId);
        related.append(
          components.listItem({
            headline: target?.title ?? relatedId,
            supporting: target ? target.category : 'This article has not been written yet.',
            leadingIcon: 'book',
            onActivate: () => show(relatedId)
          })
        );
      }
      article.append(related);
    }
  };

  const drawIndex = (): void => {
    index.textContent = '';
    for (const category of [...new Set(currentArticles.map((entry) => entry.category))].sort()) {
      index.append(el('h2', { className: 'md-typescale-title-small', text: category }));
      const listNode = components.list({ label: category });
      for (const entry of currentArticles.filter((candidate) => candidate.category === category)) {
        listNode.append(
          components.listItem({ headline: entry.title, leadingIcon: 'book', onActivate: () => show(entry.id) })
        );
      }
      index.append(listNode);
    }
    if (currentArticles.length === 0) index.append(components.emptyState({ title: 'core.docs.empty' }));
  };

  const search = createSearchBar({
    label: 'core.docs.search',
    sample: docsService
      .all()
      .map((entry) => entry.title)
      .join('\n'),
    onChange: (query) => {
      currentArticles = docsService.all().filter((entry) => query.matches(`${entry.title} ${entry.category} ${entry.body}`));
      drawIndex();
    }
  });

  host.append(search.root, layout);
  drawIndex();
  const first = docsService.all()[0];
  if (first) show(first.id);
  setDocsOpener(show);
  ctx.onDispose(() => search.destroy());
}

function mountHistory(host: HTMLElement, ctx: TabContext): void {
  host.append(components.topAppBar({ title: 'core.history.title', subtitle: 'core.history.description' }));

  const status = el('p', { className: 'md-typescale-body-small', attrs: { role: 'status' } });
  const table = components.dataTable<HistoryEntry>({
    label: 'core.history.title',
    columns: [
      { id: 'timestamp', label: 'When', sortable: true, value: (row) => row.timestamp },
      { id: 'action', label: 'core.history.filterAction', sortable: true, value: (row) => row.action },
      { id: 'source', label: 'Source', sortable: true, value: (row) => row.source },
      {
        id: 'payload',
        label: 'Detail',
        value: (row) => JSON.stringify(row.payload),
        render: (row) => JSON.stringify(row.payload).slice(0, 160)
      }
    ],
    rows: [],
    rowId: (row) => row.id,
    selectable: true,
    emptyMessage: 'core.history.empty'
  });

  let range: { start: string | null; end: string | null } = { start: null, end: null };
  let actionFilter: string[] = [];
  let text = '';

  const reload = async (): Promise<void> => {
    const query = {
      from: range.start ? `${range.start}T00:00:00.000Z` : undefined,
      to: range.end ? `${range.end}T23:59:59.999Z` : undefined,
      actions: actionFilter.length > 0 ? actionFilter : undefined,
      text: text || undefined
    };
    try {
      const entries = await ctx.history.list(query);
      table.setRows(entries);
      const backend = await ctx.history.status();
      status.textContent =
        backend.backend === 'git'
          ? ctx.t('core.history.backend.git', 'Backed by a local git repository at {path}.', {
              values: { path: backend.path }
            })
          : ctx.t(
              'core.history.backend.journal',
              'git is not available, so entries are appended to a journal at {path}. {reason}',
              { values: { path: backend.path, reason: backend.degradedReason ?? '' } }
            );
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : String(error);
    }
  };

  const picker = components.datePicker({
    label: 'core.history.filterDate',
    range: true,
    onChange: (value) => {
      range = value;
      void reload();
    }
  });

  const actionHost = el('div', { className: 'md-swatches' });
  void ctx.history.actions().then((counts) => {
    for (const entry of counts) {
      actionHost.append(
        components.chip({
          label: `${entry.action} (${entry.count})`,
          onToggle: (selected) => {
            actionFilter = selected
              ? [...actionFilter, entry.action]
              : actionFilter.filter((candidate) => candidate !== entry.action);
            void reload();
          }
        })
      );
    }
    if (counts.length === 0) {
      actionHost.append(el('p', { className: 'md-typescale-body-small', text: 'No actions recorded yet.' }));
    }
  });

  const search = createSearchBar({
    label: 'core.search.label',
    onChange: (query) => {
      text = query.text;
      void reload();
    }
  });

  const toolbar = el('div', { className: 'md-notification-centre__toolbar' });
  toolbar.append(
    components.button({
      label: 'core.action.export',
      variant: 'text',
      icon: 'download',
      onClick: async () => {
        const entries = await ctx.history.list({
          from: range.start ? `${range.start}T00:00:00.000Z` : undefined,
          to: range.end ? `${range.end}T23:59:59.999Z` : undefined,
          actions: actionFilter.length > 0 ? actionFilter : undefined,
          text: text || undefined
        });
        const path = await exporter.save(
          entries.map((entry) => ({ ...entry })),
          'json',
          { name: 'history', defaultFileName: 'history.json' }
        );
        if (path) ctx.notify.success(ctx.t('core.export.saved', 'Exported to {path}', { values: { path } }));
      }
    }),
    components.button({
      label: 'core.history.prune',
      variant: 'text',
      danger: true,
      onClick: async (event) => {
        const cutoff = range.start ? `${range.start}T00:00:00.000Z` : null;
        if (!cutoff) {
          ctx.notify.warn('Choose a date first', 'Pruning removes entries older than the start of the selected range.');
          return;
        }
        const approved = await ctx.confirm.request({
          action: `Prune history entries older than ${range.start}`,
          affected: [`Every entry recorded before ${range.start}`],
          irreversible:
            'The entries are removed from the journal. The prune itself is recorded as a new entry, so the fact that it happened remains in the history.',
          anchor: event.currentTarget as HTMLElement
        });
        if (!approved) return;
        const result = await ctx.history.prune(cutoff);
        ctx.notify.success(`${result.removed} entries pruned`);
        void reload();
      }
    })
  );

  host.append(status, search.root, picker.root, actionHost, toolbar, table.root);
  void reload();
  ctx.onDispose(() => search.destroy());
}

function mountNotifications(host: HTMLElement, ctx: TabContext): void {
  host.append(components.topAppBar({ title: 'core.notify.centre' }));
  const dispose = notifications.mountCentre(host, ctx);
  ctx.onDispose(dispose);
}

function mountRegex(host: HTMLElement, ctx: TabContext): void {
  host.append(
    components.topAppBar({
      title: 'core.regex.title',
      subtitle: 'core.regex.engine'
    })
  );
  const anchor = components.button({
    label: 'core.search.builder',
    variant: 'filled',
    icon: 'code',
    onClick: () => builder.open()
  });
  const builder = createRegexBuilder({
    anchor,
    initialFlags: 'g',
    sample: 'World Downloader Studio\nchunk 12, 34\nseed = -428193\nplayer: Steve\n',
    onApply: (state) => {
      ctx.notify.success('Pattern ready', `/${state.pattern}/${state.flags}`);
      void navigator.clipboard.writeText(`/${state.pattern}/${state.flags}`);
    }
  });
  const card = components.card({
    variant: 'outlined',
    title: 'core.regex.title',
    subtitle: 'core.regex.engine'
  });
  card.append(anchor);
  host.append(card);
  ctx.onDispose(() => builder.close());
}

/* ================================================================== */
/* Documentation                                                       */
/* ================================================================== */

const CORE_DOCS: DocArticle[] = [
  {
    id: 'core.overview',
    title: 'What this application is',
    category: 'Getting started',
    body: [
      'World Downloader Studio brings the parts of this project into one window: the proxy that downloads a world while you play, the tools that operate on the result, the live map pipeline, the web console and the automation around them.',
      '',
      '## The shape of it',
      '',
      'Everything is a **feature module**. A module contributes tabs, settings, command-palette entries and documentation, and the application discovers it automatically at startup. The core is registered through exactly the same route, so nothing in the core is a privileged special case.',
      '',
      '## Finding anything',
      '',
      'Press `Ctrl+Shift+F`. The command palette searches every command, every destination and every setting in the application, and a setting result carries its real control inline, so you can change it without leaving the palette.',
      '',
      '## Where your data lives',
      '',
      'Settings, the local history repository and the credential store all sit in one folder inside your application data directory. The folder is derived from the package identity and never from the name you choose for the application, so renaming it in settings cannot orphan anything.'
    ].join('\n'),
    related: ['core.language', 'core.appearance', 'core.history']
  },
  {
    id: 'core.language',
    title: 'Language modes and humour levels',
    category: 'Getting started',
    body: [
      'Every label, message and notification is written in one of three modes: English, playful Hong Kong Cantonese, or bilingual with English as the primary line.',
      '',
      '## The two humour levels are independent',
      '',
      'English and Cantonese each carry their own slider from 1 to 5. Level 1 reads fully professional; level 5 is maximum playfulness. English at 1 beside Cantonese at 5 is a real combination and both halves of a bilingual line read correctly in it.',
      '',
      '## What the level changes, and what it never changes',
      '',
      'The level styles the VOICE. It never changes the FACTS. At any level a message still names what happened, exactly what it affects and what your options are — including error, warning and destructive copy, which are not carved out of it.',
      '',
      '## Emoji',
      '',
      'The emoji switch adds one decorative emoji to a dialog or a message box. Buttons, field labels and screen-reader names never carry one, in either position of the switch.',
      '',
      '## Your own vocabulary',
      '',
      'The personal vocabulary control is always present, before any file exists. It reads a JSON file from this computer, locally, and never uploads, logs or exports it. Until you supply a valid file nothing is replaced anywhere: the application ships no built-in mappings, no samples and no templates.'
    ].join('\n'),
    related: ['core.overview', 'core.school']
  },
  {
    id: 'core.school',
    title: 'The renamable study mode',
    category: 'Getting started',
    body: [
      'The mode forces English and removes the Cantonese, bilingual, humour, personal-vocabulary and dim sum capabilities from every surface, as though they were not installed — their controls are omitted rather than merely disabled.',
      '',
      'Your existing choices are kept and return when it is turned off. Turning it off needs the unlock code you set.',
      '',
      '## It is a user-experience lock, not security',
      '',
      'Deleting the application data folder resets it. That is documented rather than hidden, because a mode that pretends to be protection is worse than one that is honest about being a speed bump.'
    ].join('\n'),
    related: ['core.language', 'core.locks']
  },
  {
    id: 'core.appearance',
    title: 'Appearance and the colour system',
    category: 'Appearance',
    body: [
      'The whole colour scheme is generated at runtime from one seed colour, in both light and dark, using tonal palettes computed in perceptual lightness.',
      '',
      '## Editing any element',
      '',
      'Right-click any element and choose **Edit appearance…**, or press the context-menu key with it focused. The editor opens anchored beside that exact element and offers word-processor depth: family, size, weight, style, underline and strikethrough variants, overline, capitalization and small caps, super and subscript, colour, highlight, outline, shadow, spacing, line height, direction and alignment, plus the box properties.',
      '',
      '## The infinite colour picker',
      '',
      'A continuous two-dimensional field and hue slider, plus direct numeric entry, plus a translator that converts between named colours, HEX, HEX8, RGB, HSL, HSV, HWB, LAB, LCH, OKLab, OKLCH and CMYK. Alpha survives every conversion, the active space is named, and a colour outside the sRGB gamut says exactly what it will be clipped to.',
      '',
      '## Renaming the application',
      '',
      'The name you choose changes what the application calls itself and nothing else. The data directory, the installer identity and the update feed all stay put, and a diagnostic report still names the shipped product so a reader knows what software they are looking at.'
    ].join('\n'),
    related: ['core.overview', 'core.tabs']
  },
  {
    id: 'core.tabs',
    title: 'Tabs, groups and the four searches',
    category: 'Navigation',
    body: [
      'Content is separated into tabs rather than one long scrolling surface. The strip docks to any edge and left is the default.',
      '',
      '## Four searches, not one',
      '',
      '1. The current tab strip.',
      '2. Inside every individual group.',
      '3. Across groups, by their visible names.',
      '4. A master search across every open tab.',
      '',
      'Each has its own anchored pattern builder and its own query, pattern, flags and mode. None of them shares hidden state with another.',
      '',
      '## Bulk closes',
      '',
      '**Close tabs containing text** and **Close tabs not containing text** share one predicate, so the second is the exact negation of the first and the flags and casing cannot drift apart. Neither runs on an empty query or an invalid pattern; both show the count and a reviewable preview first; pinned tabs are excluded unless you deliberately include them.'
    ].join('\n'),
    related: ['core.palette', 'core.appearance']
  },
  {
    id: 'core.palette',
    title: 'The command palette',
    category: 'Navigation',
    body: [
      '`Ctrl+Shift+F` opens it. That exact chord is the one global shortcut for the palette.',
      '',
      'Rows are rich: a setting result renders its live control inline, wired to the same store and validation as the settings surface. A destination result teleports — it opens the owning tab, reveals the exact element, scrolls it into view, focuses it and briefly highlights it.',
      '',
      'The bounded card and the full-window view are both available and the choice is remembered. The card is the default.'
    ].join('\n'),
    related: ['core.tabs', 'core.overview']
  },
  {
    id: 'core.history',
    title: 'Local version history',
    category: 'Data',
    body: [
      'Every settings change and every record a feature creates, edits or deletes is one entry in a local git repository inside the application data directory. There is no remote and nothing is ever pushed.',
      '',
      '## Append-only',
      '',
      'History is never rewritten. Restoring an earlier state is recorded as a NEW entry, so an undo can be undone and that undo undone in turn. Pruning old entries is likewise a new commit rather than a rewrite.',
      '',
      '## When git is missing',
      '',
      'The same append-only journal is used without commits and the status line says so plainly, rather than reporting a commit that did not happen.'
    ].join('\n'),
    related: ['core.export', 'core.overview']
  },
  {
    id: 'core.export',
    title: 'Exporting anything',
    category: 'Data',
    body: [
      'Every record, view, list and log the application owns can be exported as JSON, JSONL, YAML, TOML, XML, CSV, TSV, Markdown, HTML or SQL.',
      '',
      'Each file states its encoding and schema version in its own header, so it is readable by something other than the application that wrote it.',
      '',
      '## Nothing is dropped silently',
      '',
      'Before anything is written, the export reports exactly which fields the chosen format cannot carry faithfully. Choosing CSV for records with nested objects tells you those columns become JSON text inside one cell, rather than letting you discover it afterwards.'
    ].join('\n'),
    related: ['core.history', 'core.overview']
  },
  {
    id: 'core.locks',
    title: 'Toy locks and Support Tickets',
    category: 'Appearance',
    body: [
      'Any rendered element can be put behind a password or a one-time code from your authenticator. Each lock carries its OWN credential: there is no master password and no inheritance, so unlocking one surface never unlocks another.',
      '',
      '## It is just for fun',
      '',
      'This is not security, not encryption, and no protection at all from anybody else using this computer. Every surface says so.',
      '',
      '## Recovery',
      '',
      'Forgetting the code is a normal outcome for a toy lock, so recovery is self-service: delete the application data folder and every lock is gone. **Support Tickets**, reachable from the unlock prompt, plays the part of a service desk and then opens that exact folder for you. It never deletes anything itself, and it says plainly that nothing is sent anywhere and nobody is reading it.'
    ].join('\n'),
    related: ['core.school', 'core.overview']
  },
  {
    id: 'core.regex',
    title: 'The pattern builder',
    category: 'Navigation',
    body: [
      'Every search field in the application carries a pattern builder anchored to that exact field. Plain text is the default; regular expressions are an explicit opt-in.',
      '',
      'The engine is the JavaScript `RegExp` engine and the interface says so, so a pattern written here behaves identically anywhere else the same string is used.',
      '',
      '## Bounded evaluation',
      '',
      'The sample is capped, the match loop is capped and the elapsed time is checked between iterations. A pattern that starts backtracking is stopped and the interface says it was stopped, rather than showing a partial result as though it were the whole answer.'
    ].join('\n'),
    related: ['core.tabs', 'core.palette']
  }
];

/* ================================================================== */
/* Module                                                              */
/* ================================================================== */

export function coreFeature(): FeatureModule {
  return {
    id: 'core',
    name: 'Core',
    description: 'The shell: tabs, settings, documentation, history, notifications and the pattern builder.',
    tabs: [
      // `core.home` is the build-info/about reference page — useful, but not
      // the reason anyone opens this application. The world downloader is what
      // this product IS, so it takes the lowest order (and therefore the
      // fresh-profile default tab, per `TabsImpl.mount`) and Home moves down to
      // sit with the other reference destinations near the tail of the strip.
      { id: 'core.home', title: 'core.home.title', icon: 'home', order: 896, permanent: true, mount: mountHome },
      { id: 'core.settings', title: 'core.settings.title', icon: 'settings', order: 900, permanent: true, mount: mountSettings },
      { id: 'core.docs', title: 'core.docs.title', icon: 'book', order: 910, permanent: true, mount: mountDocs },
      { id: 'core.history', title: 'core.history.title', icon: 'history', order: 920, mount: mountHistory },
      { id: 'core.notifications', title: 'core.notify.centre', icon: 'notifications', order: 930, mount: mountNotifications },
      { id: 'core.regex', title: 'core.regex.title', icon: 'code', order: 940, mount: mountRegex }
    ],
    settings: [languageSection(), schoolSection(), appearanceSection(), workspaceSection(), dataSection()],
    palette: [
      {
        id: 'core.command.reveal',
        title: 'Open the application data folder',
        icon: 'folder',
        kind: 'command',
        keywords: ['data', 'folder', 'reset', 'appdata'],
        run: () => void window.studio.app.revealUserData()
      },
      {
        id: 'core.command.lockAll',
        title: 'Lock every locked element again',
        icon: 'lock',
        kind: 'command',
        keywords: ['lock', 'relock'],
        run: () => locks.lockAll()
      },
      {
        id: 'core.command.resetOverlays',
        title: 'Reset the remembered panel sizes and positions',
        icon: 'refresh',
        kind: 'command',
        keywords: ['panel', 'overlay', 'reset', 'position'],
        run: () => {
          for (const key of ['regex-builder', 'appearance-editor', 'color-picker']) {
            settings.reset(`overlay.geometry.${key}`);
          }
        }
      }
    ],
    docs: CORE_DOCS,
    init(ctx: AppContext) {
      ctx.i18n.onChange(() => {
        const chosen = settings.get<string>(APP_DISPLAY_NAME_ID, '') || window.studio.info.productName;
        void window.studio.window.setTitle(chosen);
      });

      // The hand-written coverage guard for the explanation and provenance
      // contract (core/settings-ui.ts). Non-blocking: it reports, it never
      // withholds a setting from the surface. `scripts/check-settings-coverage.mjs`
      // runs the equivalent check statically from the command line.
      const coverage = verifyCoreSettingsCoverage(ctx.registry.settingsSections());
      if (!coverage.ok) {
        for (const issue of coverage.issues) {
          console.warn(`Settings coverage: "${issue.id}" ${issue.reason}.`);
        }
      }
    }
  };
}
