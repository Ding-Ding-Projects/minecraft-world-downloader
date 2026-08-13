import type {
  AppContext,
  SearchQuery,
  SettingControl,
  SettingsSection,
  TabContext
} from '../../core/registry';
import { createNestedTabs, type NestedTabsHandle } from './nestedtabs';
import { createSettingRow, describeValue, rowElementId, type SettingRowHandle } from './rows';
import { exportableFrom, isOmitted, openExportPanel, openImportFlow, resetEverySetting, type ExportScope } from './transfer';

/**
 * The settings destination.
 *
 * Its content is itself browser-style tabbed: one tab per registered settings
 * section, carrying the full tab contract through `createNestedTabs`. Separate
 * from and additional to that, the surface carries its own search bar, which
 * searches every section's labels, explanations, ids, keywords AND current
 * values, and says plainly when a match sits on a tab other than the one being
 * looked at — with a button that goes there.
 */

export const SETTINGS_TAB_ID = 'settings';
export const SHOW_IDS_ID = 'settings.showIds';
export const EXPAND_EXPLANATIONS_ID = 'settings.expandExplanations';
export const START_TAB_ID = 'settings.startTab';
export const STRIP_DOCK_ID = 'settings.tabs.dock';

/** Settings whose whole capability is removed while the study mode is on. */
const SCHOOL_SUPPRESSED_SECTIONS = new Set(['core.language']);
const SCHOOL_SUPPRESSED_PREFIXES = ['language.', 'vocabulary.', 'dimsum.'];

interface IndexedControl {
  section: SettingsSection;
  control: SettingControl;
  /** Position across every section, in strip order. Used for shift ranges. */
  index: number;
}

interface MountedSection {
  rows: SettingRowHandle[];
  empty: HTMLElement;
  host: HTMLElement;
}

export interface SettingsSurface {
  reveal(controlId: string): void;
  openSection(sectionId: string): void;
  reopenClosedTabs(): void;
  sections(): SettingsSection[];
  destroy(): void;
}

let liveSurface: SettingsSurface | null = null;

/** The surface currently mounted, if the settings tab is open. */
export function currentSurface(): SettingsSurface | null {
  return liveSurface;
}

export function visibleSections(ctx: AppContext): SettingsSection[] {
  const school = ctx.i18n.schoolModeActive();
  return ctx.registry
    .settingsSections()
    .filter((section) => !(school && SCHOOL_SUPPRESSED_SECTIONS.has(section.id)))
    .map((section) => ({
      ...section,
      controls: section.controls.filter(
        (control) => !(school && SCHOOL_SUPPRESSED_PREFIXES.some((prefix) => control.id.startsWith(prefix)))
      )
    }))
    .filter((section) => section.controls.length > 0);
}

export function mountSettingsSurface(host: HTMLElement, ctx: TabContext): void {
  const { components, settings, i18n } = ctx;
  const t = (key: string, fallback: string, values?: Record<string, string | number>): string =>
    ctx.t(key, fallback, values ? { values } : undefined);

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

  const shell = el('div', { className: 'settings-surface' });
  host.append(shell);

  let nested: NestedTabsHandle | null = null;
  let searchBar: { root: HTMLElement; destroy(): void; setText(text: string): void } | null = null;
  const mounted = new Map<string, MountedSection>();
  const selection = new Set<string>();
  let selectionMode = false;
  let lastIndex = -1;
  let query: SearchQuery | null = null;
  let sections: SettingsSection[] = [];
  let indexed: IndexedControl[] = [];

  const showIds = (): boolean => settings.get<boolean>(SHOW_IDS_ID, false) === true;
  const expandExplanations = (): boolean => settings.get<boolean>(EXPAND_EXPLANATIONS_ID, false) === true;

  const haystackFor = (entry: IndexedControl): string =>
    [
      i18n.t(entry.control.label, entry.control.label),
      i18n.t(entry.control.description, entry.control.description),
      entry.control.id,
      (entry.control.keywords ?? []).join(' '),
      describeValue(settings.get(entry.control.id, entry.control.defaultValue)),
      describeValue(entry.control.defaultValue),
      i18n.t(entry.section.title, entry.section.title),
      (entry.control.options ?? [])
        .map((option) => `${option.value} ${i18n.t(option.label, option.label)}`)
        .join(' ')
    ].join(' ');

  const matches = (entry: IndexedControl): boolean => (query ? query.matches(haystackFor(entry)) : true);

  /* ---------------- top bar ---------------- */

  const selectToggle = components.button({
    label: 'settings.select.mode',
    variant: 'text',
    icon: 'check',
    onClick: () => setSelectionMode(!selectionMode)
  });

  const exportButton = components.button({
    label: 'settings.export.title',
    variant: 'text',
    icon: 'download',
    onClick: () => openExportPanel(ctx, exportButton, exportScopes())
  });

  const importButton = components.button({
    label: 'settings.import.title',
    variant: 'text',
    icon: 'upload',
    onClick: () =>
      openImportFlow(ctx, importButton, () => new Set(indexed.map((entry) => entry.control.id)))
  });

  const resetButton = components.button({
    label: 'settings.reset.all',
    variant: 'text',
    icon: 'refresh',
    danger: true,
    onClick: () => void resetEverySetting(ctx, resetButton)
  });

  shell.append(
    components.topAppBar({
      title: 'settings.tab.title',
      subtitle: 'settings.tab.subtitle',
      actions: [selectToggle, exportButton, importButton, resetButton]
    })
  );

  /* ---------------- School mode notice ---------------- */

  if (i18n.schoolModeActive()) {
    shell.append(
      el('p', {
        className: 'settings-surface__notice md-typescale-body-small',
        text: t('settings.schoolNotice', '{name} is on, so some settings are not present.', {
          name: i18n.snapshot().schoolModeName
        })
      })
    );
  }

  /* ---------------- search ---------------- */

  const searchHost = el('div', { className: 'settings-surface__search' });
  const summary = el('p', { className: 'settings-surface__summary md-typescale-body-small', attrs: { role: 'status' } });
  const elsewhere = el('div', { className: 'settings-surface__elsewhere' });
  shell.append(searchHost, summary, elsewhere);

  /* ---------------- bulk action bar ---------------- */

  const bulkBar = el('div', { className: 'settings-surface__bulk', attrs: { role: 'group' } });
  bulkBar.setAttribute('aria-label', t('settings.select.mode', 'Select settings'));
  bulkBar.hidden = true;

  const bulkCount = el('p', { className: 'md-typescale-body-medium', attrs: { role: 'status' } });

  const selectThisTab = components.button({
    label: 'settings.select.thisTab',
    variant: 'text',
    icon: 'check',
    onClick: () => {
      const activeSection = nested?.activeId();
      for (const entry of indexed) {
        if (entry.section.id !== activeSection) continue;
        if (!matches(entry)) continue;
        selection.add(entry.control.id);
      }
      syncSelection();
    }
  });

  const selectEveryMatch = components.button({
    label: 'settings.select.everyMatch',
    variant: 'text',
    icon: 'check',
    onClick: () => {
      for (const entry of indexed) {
        if (matches(entry)) selection.add(entry.control.id);
      }
      syncSelection();
    }
  });

  const invertSelection = components.button({
    label: 'settings.select.invert',
    variant: 'text',
    icon: 'refresh',
    onClick: () => {
      for (const entry of indexed) {
        if (!matches(entry)) continue;
        if (selection.has(entry.control.id)) selection.delete(entry.control.id);
        else selection.add(entry.control.id);
      }
      syncSelection();
    }
  });

  const clearSelection = components.button({
    label: 'settings.select.none',
    variant: 'text',
    icon: 'close',
    onClick: () => {
      selection.clear();
      syncSelection();
    }
  });

  const resetSelected = components.button({
    label: 'settings.bulk.resetSelected',
    variant: 'text',
    icon: 'refresh',
    danger: true,
    onClick: async () => {
      const chosen = indexed.filter((entry) => selection.has(entry.control.id));
      const changed = chosen.filter((entry) => settings.provenanceOf(entry.control.id) !== 'default');
      if (changed.length === 0) {
        ctx.notify.info(t('settings.reset.nothing', 'Nothing was stored, so nothing changed.'));
        return;
      }
      const approved = await ctx.confirm.request({
        action: t('settings.bulk.resetSelected', 'Reset the selected settings'),
        affected: changed.map(
          (entry) =>
            `${i18n.t(entry.control.label, entry.control.label)} (${entry.control.id}) → ${describeValue(entry.control.defaultValue)}`
        ),
        irreversible:
          'Each of these stored values is removed from the settings file and the built-in value takes over. Every removal is written to local history first, so the previous values can be read back from the history tab.',
        anchor: resetSelected
      });
      if (!approved) return;
      const previous = changed.map((entry) => ({
        id: entry.control.id,
        value: settings.get(entry.control.id)
      }));
      for (const entry of changed) settings.reset(entry.control.id);
      await settings.flush();
      void ctx.history.record('Reset selected settings', 'settings', { count: changed.length, previous });
      ctx.notify.success(
        t('settings.bulk.resetPreview', '{count} settings will return to their shipped values. {unchanged} were already at them.', {
          count: changed.length,
          unchanged: chosen.length - changed.length
        })
      );
      refreshMountedRows();
      syncSelection();
    }
  });

  const exportSelected = components.button({
    label: 'settings.bulk.exportSelected',
    variant: 'text',
    icon: 'download',
    onClick: () => openExportPanel(ctx, exportSelected, exportScopes())
  });

  const copySelected = components.button({
    label: 'settings.bulk.copySelected',
    variant: 'text',
    icon: 'copy',
    onClick: () => {
      const ids = indexed.filter((entry) => selection.has(entry.control.id)).map((entry) => entry.control.id);
      void navigator.clipboard
        .writeText(ids.join('\n'))
        .then(() => ctx.notify.success(t('settings.row.copied', 'Copied {id}', { id: `${ids.length} ids` })))
        .catch(() => ctx.notify.warn(t('settings.bulk.copySelected', 'Copy the selected ids'), ids.join(', ')));
    }
  });

  const noSections = el('div', { className: 'settings-surface__panels' });

  bulkBar.append(
    bulkCount,
    selectThisTab,
    selectEveryMatch,
    invertSelection,
    clearSelection,
    resetSelected,
    exportSelected,
    copySelected
  );
  shell.append(bulkBar, noSections);

  /* ---------------- selection plumbing ---------------- */

  function setSelectionMode(on: boolean): void {
    selectionMode = on;
    bulkBar.hidden = !on;
    if (!on) selection.clear();
    for (const entry of mounted.values()) {
      for (const row of entry.rows) row.setSelectionMode(on);
    }
    const labelNode = selectToggle.querySelector('.md-btn__label');
    if (labelNode) {
      labelNode.textContent = on
        ? t('settings.select.modeOff', 'Stop selecting')
        : t('settings.select.mode', 'Select settings');
    }
    selectToggle.setAttribute('aria-pressed', String(on));
    syncSelection();
  }

  function syncSelection(): void {
    for (const entry of mounted.values()) {
      for (const row of entry.rows) row.setSelected(selection.has(row.control.id));
    }
    const chosen = indexed.filter((entry) => selection.has(entry.control.id));
    const changed = chosen.filter((entry) => settings.provenanceOf(entry.control.id) !== 'default');
    bulkCount.textContent =
      chosen.length === 0
        ? t('settings.select.empty', 'Nothing is selected, so these actions have nothing to work on.')
        : t('settings.select.count', '{count} selected, {changed} of which differ from the shipped value.', {
            count: chosen.length,
            changed: changed.length
          });
    const empty = chosen.length === 0;
    for (const node of [resetSelected, exportSelected, copySelected]) {
      node.disabled = empty;
      node.title = empty ? t('settings.select.empty', 'Nothing is selected.') : '';
    }
  }

  function handleSelectRequest(index: number, selected: boolean, shiftKey: boolean): void {
    const entry = indexed[index];
    if (!entry) return;
    if (shiftKey && lastIndex >= 0) {
      const from = Math.min(lastIndex, index);
      const to = Math.max(lastIndex, index);
      for (let position = from; position <= to; position += 1) {
        const candidate = indexed[position];
        if (!candidate || !matches(candidate)) continue;
        if (selected) selection.add(candidate.control.id);
        else selection.delete(candidate.control.id);
      }
    } else if (selected) {
      selection.add(entry.control.id);
    } else {
      selection.delete(entry.control.id);
    }
    lastIndex = index;
    syncSelection();
  }

  /* ---------------- export scopes ---------------- */

  function exportScopes(): ExportScope[] {
    const activeSection = nested?.activeId();
    return [
      {
        id: 'all',
        label: 'settings.export.scope.all',
        collect: () =>
          indexed.filter((entry) => !isOmitted(entry.control.id)).map((entry) => exportableFrom(ctx, entry.section, entry.control))
      },
      {
        id: 'tab',
        label: 'settings.export.scope.tab',
        collect: () =>
          indexed
            .filter((entry) => entry.section.id === activeSection && !isOmitted(entry.control.id))
            .map((entry) => exportableFrom(ctx, entry.section, entry.control))
      },
      {
        id: 'selected',
        label: 'settings.export.scope.selected',
        collect: () =>
          indexed
            .filter((entry) => selection.has(entry.control.id) && !isOmitted(entry.control.id))
            .map((entry) => exportableFrom(ctx, entry.section, entry.control))
      },
      {
        id: 'changed',
        label: 'settings.export.scope.changed',
        collect: () =>
          indexed
            .filter((entry) => settings.provenanceOf(entry.control.id) !== 'default' && !isOmitted(entry.control.id))
            .map((entry) => exportableFrom(ctx, entry.section, entry.control))
      }
    ];
  }

  /* ---------------- search application ---------------- */

  function applyQuery(): void {
    for (const entry of mounted.values()) {
      let shown = 0;
      for (const row of entry.rows) {
        const found = indexed.find((candidate) => candidate.control.id === row.control.id);
        const visible = found ? matches(found) : true;
        row.setVisible(visible);
        if (visible) shown += 1;
      }
      // An empty section and a section whose rows were all filtered out are two
      // different states, and each says which one it is.
      entry.empty.hidden = entry.rows.length > 0 && shown > 0;
    }
    updateSummary();
  }

  function updateSummary(): void {
    const activeSection = nested?.activeId() ?? null;
    const onThisTab = indexed.filter((entry) => entry.section.id === activeSection);
    const shownHere = onThisTab.filter(matches);
    summary.textContent = t('settings.search.summary', '{shown} of {total} settings shown on this tab.', {
      shown: shownHere.length,
      total: onThisTab.length
    });

    elsewhere.textContent = '';
    if (!query || (query.text.trim() === '' && !query.regex)) return;

    const others = new Map<string, { section: SettingsSection; count: number }>();
    for (const entry of indexed) {
      if (entry.section.id === activeSection) continue;
      if (!matches(entry)) continue;
      const found = others.get(entry.section.id) ?? { section: entry.section, count: 0 };
      found.count += 1;
      others.set(entry.section.id, found);
    }
    if (others.size === 0) return;

    const total = [...others.values()].reduce((sum, item) => sum + item.count, 0);
    elsewhere.append(
      el('span', {
        className: 'md-typescale-body-small',
        text: t('settings.search.elsewhere', '{count} more matches sit on other tabs: {tabs}', {
          count: total,
          tabs: [...others.values()].map((item) => i18n.t(item.section.title, item.section.title)).join(', ')
        })
      })
    );
    for (const item of others.values()) {
      elsewhere.append(
        components.button({
          label: t('settings.search.goto', 'Go to {tab}', {
            tab: `${i18n.t(item.section.title, item.section.title)} (${item.count})`
          }),
          variant: 'tonal',
          icon: 'chevronRight',
          onClick: () => nested?.open(item.section.id)
        })
      );
    }
  }

  function refreshMountedRows(): void {
    for (const entry of mounted.values()) {
      for (const row of entry.rows) row.refresh();
    }
    applyQuery();
  }

  /* ---------------- section panels ---------------- */

  function mountSection(section: SettingsSection, panelHost: HTMLElement): void {
    panelHost.append(
      components.sectionHeading({
        title: section.title,
        description: t(
          'settings.section.count',
          '{count} settings live on this tab. Every one of them shows where its current value came from.',
          { count: section.controls.length }
        )
      })
    );

    const rows: SettingRowHandle[] = [];
    for (const control of section.controls) {
      const found = indexed.find((entry) => entry.control.id === control.id);
      const row = createSettingRow({
        ctx,
        section,
        control,
        index: found?.index ?? 0,
        showId: showIds,
        expandExplanations,
        onSelectRequest: handleSelectRequest,
        onSelectionChanged: syncSelection
      });
      row.setSelectionMode(selectionMode);
      row.setSelected(selection.has(control.id));
      rows.push(row);
      panelHost.append(row.root);
    }

    const empty = components.emptyState({
      title: section.controls.length === 0 ? 'settings.empty.section' : 'settings.search.noMatches'
    });
    empty.hidden = section.controls.length > 0;
    panelHost.append(empty);

    mounted.set(section.id, { rows, empty, host: panelHost });
    applyQuery();
  }

  /* ---------------- build ---------------- */

  function build(): void {
    for (const entry of mounted.values()) {
      for (const row of entry.rows) row.destroy();
    }
    mounted.clear();
    nested?.destroy();
    nested = null;
    searchBar?.destroy();
    searchBar = null;

    sections = visibleSections(ctx);
    indexed = [];
    let position = 0;
    for (const section of sections) {
      for (const control of section.controls) {
        indexed.push({ section, control, index: position });
        position += 1;
      }
    }

    noSections.textContent = '';
    if (sections.length === 0) {
      noSections.append(components.emptyState({ title: 'settings.empty.noSections' }));
      summary.textContent = '';
      return;
    }

    const search = ctx.createSearchBar({
      label: 'settings.search.label',
      placeholder: 'settings.search.placeholder',
      sample: indexed
        .slice(0, 200)
        .map((entry) => `${i18n.t(entry.control.label, entry.control.label)} ${entry.control.id}`)
        .join('\n'),
      onChange: (next) => {
        query = next;
        applyQuery();
      }
    });
    searchBar = search;
    searchHost.append(search.root);

    nested = createNestedTabs({
      ctx,
      keyPrefix: 'settings.tabs',
      stripLabel: 'settings.strip.label',
      items: sections.map((section) => ({ id: section.id, title: i18n.t(section.title, section.title), icon: section.icon })),
      mountPanel: (item, panelHost) => {
        const section = sections.find((candidate) => candidate.id === item.id);
        if (section) mountSection(section, panelHost);
      },
      lockTarget: (id) => `settings-section:${id}`,
      appearanceId: (id) => `settings-tab:${id}`,
      onOpen: () => updateSummary(),
      onChange: () => updateSummary()
    });
    shell.append(nested.root);

    // The start-tab preference is a real choice: "last one used" is the default
    // and anything else always starts in the same place.
    const preferred = settings.get<string>(START_TAB_ID, 'last');
    if (preferred !== 'last' && sections.some((section) => section.id === preferred)) {
      nested.open(preferred);
    }

    setSelectionMode(selectionMode);
    applyQuery();
  }

  build();

  /* ---------------- live updates ---------------- */

  const unsubscribeI18n = i18n.onChange(() => {
    // Language, humour, the emoji switch and the study mode all repaint this
    // surface in place rather than waiting for a restart.
    build();
  });

  const unsubscribeSettings = settings.onChange((change) => {
    if (change.id === SHOW_IDS_ID || change.id === EXPAND_EXPLANATIONS_ID) {
      for (const entry of mounted.values()) {
        for (const row of entry.rows) row.refresh();
      }
      return;
    }
    if (change.id === STRIP_DOCK_ID) {
      nested?.refresh();
      return;
    }
    // A value changed elsewhere (the palette, a schedule, an import) must be
    // reflected here rather than leaving a stale reading on screen.
    if (mounted.size > 0 && indexed.some((entry) => entry.control.id === change.id)) {
      updateSummary();
    }
  });

  const surface: SettingsSurface = {
    reveal: (controlId) => {
      const entry = indexed.find((candidate) => candidate.control.id === controlId);
      if (!entry || !nested) return;
      searchBar?.setText('');
      nested.reveal(entry.section.id, rowElementId(controlId));
    },
    openSection: (sectionId) => nested?.open(sectionId),
    reopenClosedTabs: () => nested?.reopenAll(),
    sections: () => sections,
    destroy: () => {
      unsubscribeI18n();
      unsubscribeSettings();
      searchBar?.destroy();
      nested?.destroy();
      for (const entry of mounted.values()) {
        for (const row of entry.rows) row.destroy();
      }
      mounted.clear();
      if (liveSurface === surface) liveSurface = null;
    }
  };

  liveSurface = surface;
  ctx.onDispose(() => surface.destroy());
}
