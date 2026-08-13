import { openColorPicker } from '../../core/colorpicker';
import type { AppContext, DockEdge, TabGroup } from '../../core/registry';

/**
 * The browser-style tab system that the settings destination uses INSIDE itself.
 *
 * "It is only settings" is not an exemption and neither is "it is a dialog": a
 * settings surface separates its sections into real tabs, and those tabs carry
 * the whole contract — a strip that docks to any edge with left as the default,
 * an overflow surface that never silently clips, reordering, pinning into a
 * stable dedicated region, groups with a name, a colour and a collapsed state,
 * the four searches each with its own anchored pattern builder, both bulk
 * closes, and persistence of every one of those across restarts.
 *
 * Docking is an orientation change rather than a rotation. When the strip is
 * vertical the overflow test measures HEIGHT instead of width, `aria-orientation`
 * says `vertical`, and the roving arrow keys become Up and Down — get that last
 * one wrong and the strip looks perfect in a screenshot and cannot be operated
 * from a keyboard at all. A label is never rendered sideways: a word turned
 * ninety degrees is a word nobody reads.
 */

export interface NestedTabItem {
  id: string;
  /** Already-resolved, human-readable title. */
  title: string;
  icon: string;
  /** Optional group id the item starts in, before the user moves it. */
  group?: string;
}

export interface NestedTabRecord extends Omit<NestedTabItem, 'group'> {
  /** The group the tab is actually in right now, or null when it is loose. */
  group: string | null;
  pinned: boolean;
  order: number;
}

export interface NestedTabsOptions {
  ctx: AppContext;
  /** Settings key prefix for every persisted piece of state. */
  keyPrefix: string;
  /** i18n key for the strip's accessible name. */
  stripLabel: string;
  items: NestedTabItem[];
  /** Builds a panel's content the first time that panel is opened. */
  mountPanel(item: NestedTabItem, host: HTMLElement): void;
  /** Stable lock target for one tab, so a tab can be put behind a toy lock. */
  lockTarget(id: string): string;
  /** Stable appearance selector id for one tab. */
  appearanceId(id: string): string;
  onOpen?(id: string): void;
  /** Fires whenever the visible set, the order, the groups or the pins change. */
  onChange?(): void;
}

export interface NestedTabsHandle {
  root: HTMLElement;
  open(id: string): void;
  activeId(): string | null;
  records(): NestedTabRecord[];
  visibleIds(): string[];
  closedIds(): string[];
  reopenAll(): void;
  /** Opens the tab that owns an element and reveals that element. */
  reveal(tabId: string, elementId?: string): void;
  refresh(): void;
  destroy(): void;
}

interface Panel {
  host: HTMLElement;
  built: boolean;
}

export function createNestedTabs(options: NestedTabsOptions): NestedTabsHandle {
  const { ctx, keyPrefix } = options;
  const { settings, components, i18n, a11y } = ctx;
  const t = (key: string, fallback: string, values?: Record<string, string | number>): string =>
    ctx.t(key, fallback, values ? { values } : undefined);

  const DOCK_KEY = `${keyPrefix}.dock`;
  const ORDER_KEY = `${keyPrefix}.order`;
  const PINNED_KEY = `${keyPrefix}.pinned`;
  const GROUPS_KEY = `${keyPrefix}.groups`;
  const MEMBERSHIP_KEY = `${keyPrefix}.membership`;
  const CLOSED_KEY = `${keyPrefix}.closed`;
  const ACTIVE_KEY = `${keyPrefix}.active`;

  /**
   * Only the bars that belong to the strip itself live here, because the strip
   * is rebuilt wholesale on every render. A bar inside an overlay is destroyed
   * when that overlay closes instead — sweeping those up here would empty a
   * search panel the user still had open.
   */
  const stripBars: Array<{ destroy(): void }> = [];
  const panels = new Map<string, Panel>();
  let active: string | null = null;
  let destroyed = false;

  /* ---------------- persisted state ---------------- */

  const dock = (): DockEdge => {
    const raw = settings.get<string>(DOCK_KEY, 'left');
    return raw === 'right' || raw === 'top' || raw === 'bottom' ? raw : 'left';
  };

  const orderMap = (): Record<string, number> => {
    const stored = settings.get<Record<string, number>>(ORDER_KEY, {});
    return stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
  };

  const pinnedSet = (): Set<string> => {
    const stored = settings.get<string[]>(PINNED_KEY, []);
    return new Set(Array.isArray(stored) ? stored : []);
  };

  const membership = (): Record<string, string> => {
    const stored = settings.get<Record<string, string>>(MEMBERSHIP_KEY, {});
    return stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
  };

  const closedSet = (): Set<string> => {
    const stored = settings.get<string[]>(CLOSED_KEY, []);
    return new Set(Array.isArray(stored) ? stored : []);
  };

  const groups = (): TabGroup[] => {
    const stored = settings.get<TabGroup[]>(GROUPS_KEY, []);
    const list = Array.isArray(stored) ? stored.filter((group) => group && typeof group.id === 'string') : [];
    return [...list].sort((a, b) => a.order - b.order);
  };

  const writeGroups = (next: TabGroup[]): void => {
    settings.set(GROUPS_KEY, next);
    render();
    options.onChange?.();
  };

  const records = (): NestedTabRecord[] => {
    const order = orderMap();
    const pinned = pinnedSet();
    const memberOf = membership();
    const closed = closedSet();
    const known = new Set(groups().map((group) => group.id));
    return options.items
      .filter((item) => !closed.has(item.id))
      .map((item, index) => {
        const declared = memberOf[item.id] ?? item.group ?? null;
        return {
          ...item,
          group: declared && known.has(declared) ? declared : null,
          pinned: pinned.has(item.id),
          order: order[item.id] ?? index
        };
      })
      .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
  };

  /* ---------------- structure ---------------- */

  const root = document.createElement('div');
  root.className = 'settings-tabs';

  const strip = document.createElement('nav');
  strip.className = 'settings-tabs__strip';

  const content = document.createElement('div');
  content.className = 'settings-tabs__content';

  root.append(strip, content);

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

  /* ---------------- opening ---------------- */

  const open = (id: string): void => {
    const item = options.items.find((candidate) => candidate.id === id);
    if (!item) return;

    const closed = closedSet();
    if (closed.has(id)) {
      closed.delete(id);
      settings.set(CLOSED_KEY, [...closed]);
    }

    const target = options.lockTarget(id);
    if (ctx.locks.isLocked(target) && !ctx.locks.isUnlocked(target)) {
      const trigger = strip.querySelector<HTMLElement>(`[data-settings-tab="${CSS.escape(id)}"]`);
      if (trigger) {
        void ctx.locks.unlock(target, trigger).then((unlocked) => {
          if (unlocked && !destroyed) open(id);
        });
        return;
      }
    }

    active = id;
    settings.set(ACTIVE_KEY, id);

    let panel = panels.get(id);
    if (!panel) {
      const host = el('section', {
        className: 'settings-tabs__panel',
        attrs: {
          role: 'tabpanel',
          id: `settings-panel-${id}`,
          'aria-labelledby': `settings-tab-${id}`,
          tabindex: '0'
        }
      });
      content.append(host);
      panel = { host, built: false };
      panels.set(id, panel);
    }
    if (!panel.built) {
      panel.built = true;
      options.mountPanel(item, panel.host);
    }
    for (const [panelId, mounted] of panels) mounted.host.hidden = panelId !== id;

    render();
    options.onOpen?.(id);
    a11y.announce(t('settings.announce.opened', 'Opened the {tab} settings tab', { tab: item.title }));
  };

  const close = (id: string): void => {
    const closed = closedSet();
    closed.add(id);
    settings.set(CLOSED_KEY, [...closed]);
    const panel = panels.get(id);
    if (panel) panel.host.hidden = true;
    if (active === id) {
      const next = records()[0];
      active = next?.id ?? null;
      if (active) open(active);
    }
    render();
    options.onChange?.();
  };

  const reopenAll = (): void => {
    settings.set(CLOSED_KEY, []);
    render();
    options.onChange?.();
  };

  /* ---------------- mutations ---------------- */

  const setPinned = (id: string, pinned: boolean): void => {
    const set = pinnedSet();
    if (pinned) set.add(id);
    else set.delete(id);
    settings.set(PINNED_KEY, [...set]);
    render();
    options.onChange?.();
  };

  const reorder = (id: string, delta: number): void => {
    const list = records();
    const index = list.findIndex((record) => record.id === id);
    const target = index + delta;
    if (index === -1 || target < 0 || target >= list.length) return;
    const moved = [...list];
    const [taken] = moved.splice(index, 1);
    moved.splice(target, 0, taken);
    const order: Record<string, number> = {};
    moved.forEach((record, position) => {
      order[record.id] = position;
    });
    settings.set(ORDER_KEY, order);
    render();
    options.onChange?.();
  };

  const moveToGroup = (id: string, groupId: string | null): void => {
    const next = { ...membership() };
    if (groupId === null) delete next[id];
    else next[id] = groupId;
    settings.set(MEMBERSHIP_KEY, next);
    render();
    options.onChange?.();
  };

  const createGroup = (name: string): TabGroup => {
    const existing = groups();
    const group: TabGroup = {
      id: `${keyPrefix}.group.${Date.now().toString(36)}`,
      name,
      color: 'var(--md-sys-color-primary)',
      collapsed: false,
      order: existing.length
    };
    writeGroups([...existing, group]);
    return group;
  };

  const setGroupCollapsed = (groupId: string, collapsed: boolean): void => {
    writeGroups(groups().map((group) => (group.id === groupId ? { ...group, collapsed } : group)));
  };

  /* ---------------- menus ---------------- */

  const openGroupPicker = (id: string, anchor: HTMLElement): void => {
    const list = groups();
    const memberOf = membership()[id] ?? null;
    // A picker rather than one menu item per group: a menu that grows an item per
    // group grows without bound, and this one carries its own filter and builder
    // because every menu in this application does.
    components.menu({
      anchor,
      label: 'settings.tab.moveToGroup',
      items: [
        {
          id: 'new',
          label: 'settings.group.new',
          icon: 'add',
          run: () => {
            const name = window.prompt(t('settings.group.namePrompt', 'Name for this group'), '');
            if (!name || name.trim() === '') return;
            const group = createGroup(name.trim());
            moveToGroup(id, group.id);
          }
        },
        ...(list.length === 0
          ? [
              {
                id: 'none',
                label: 'settings.group.none',
                icon: 'info',
                separatorBefore: true,
                disabled: true,
                disabledReason: 'settings.group.none'
              }
            ]
          : list.map((group, index) => ({
              id: group.id,
              label: `${group.name} (${records().filter((record) => record.group === group.id).length})`,
              icon: group.id === memberOf ? 'check' : 'folder',
              separatorBefore: index === 0,
              run: () => moveToGroup(id, group.id)
            }))),
        ...(memberOf === null
          ? []
          : [
              {
                id: 'remove',
                label: 'settings.tab.removeFromGroup',
                icon: 'close',
                separatorBefore: true,
                run: () => moveToGroup(id, null)
              }
            ])
      ]
    });
  };

  const openTabMenu = (record: NestedTabRecord, anchor: HTMLElement): void => {
    const target = options.lockTarget(record.id);
    components.menu({
      anchor,
      label: record.title,
      items: [
        { id: 'open', label: 'settings.tab.open', icon: 'chevronRight', shortcut: 'Enter', run: () => open(record.id) },
        {
          id: 'pin',
          label: record.pinned ? 'settings.tab.unpin' : 'settings.tab.pin',
          icon: 'pin',
          run: () => setPinned(record.id, !record.pinned)
        },
        { id: 'earlier', label: 'settings.tab.moveEarlier', icon: 'chevronUp', run: () => reorder(record.id, -1) },
        { id: 'later', label: 'settings.tab.moveLater', icon: 'chevronDown', run: () => reorder(record.id, 1) },
        {
          id: 'group',
          label: 'settings.tab.moveToGroup',
          icon: 'folder',
          separatorBefore: true,
          run: () => openGroupPicker(record.id, anchor)
        },
        {
          id: 'appearance',
          label: 'settings.tab.editAppearance',
          icon: 'palette',
          shortcut: 'Shift+Right click',
          separatorBefore: true,
          run: () => ctx.appearance.edit(anchor, `[data-appearance-id="${options.appearanceId(record.id)}"]`)
        },
        {
          id: 'lock',
          label: 'settings.tab.lock',
          icon: 'lock',
          run: () => ctx.locks.wizard(anchor, target, record.title)
        },
        {
          id: 'close',
          label: 'settings.tab.close',
          icon: 'close',
          danger: true,
          separatorBefore: true,
          run: () => close(record.id)
        }
      ]
    });
  };

  const openGroupMenu = (group: TabGroup, anchor: HTMLElement): void => {
    components.menu({
      anchor,
      label: group.name,
      items: [
        {
          id: 'collapse',
          label: group.collapsed ? 'settings.group.expand' : 'settings.group.collapse',
          icon: group.collapsed ? 'chevronDown' : 'chevronUp',
          run: () => setGroupCollapsed(group.id, !group.collapsed)
        },
        {
          id: 'rename',
          label: 'settings.group.rename',
          icon: 'edit',
          run: () => {
            const name = window.prompt(t('settings.group.namePrompt', 'Name for this group'), group.name);
            if (!name || name.trim() === '') return;
            writeGroups(groups().map((candidate) => (candidate.id === group.id ? { ...candidate, name: name.trim() } : candidate)));
          }
        },
        {
          id: 'colour',
          label: 'settings.group.colour',
          icon: 'palette',
          run: () => {
            openColorPicker({
              anchor,
              value: group.color.startsWith('#') ? group.color : '#6750a4',
              onChange: (value) => {
                writeGroups(groups().map((candidate) => (candidate.id === group.id ? { ...candidate, color: value } : candidate)));
              }
            });
          }
        },
        {
          id: 'appearance',
          label: 'settings.group.editAppearance',
          icon: 'palette',
          shortcut: 'Shift+Right click',
          separatorBefore: true,
          run: () => ctx.appearance.edit(anchor, `[data-appearance-id="${keyPrefix}.group:${group.id}"]`)
        }
      ]
    });
  };

  /* ---------------- the four searches ---------------- */

  const openMasterSearch = (anchor: HTMLElement): void => {
    let overlayBar: { destroy(): void } | null = null;
    const handle = ctx.overlay.open({
      anchor,
      placement: 'bottom-start',
      role: 'dialog',
      label: t('settings.strip.searchAll', 'Search every settings tab'),
      resizeKey: `${keyPrefix}.masterSearch`,
      onClose: () => overlayBar?.destroy()
    });
    const results = components.list({ label: 'settings.strip.searchAll' });
    const search = ctx.createSearchBar({
      label: 'settings.strip.searchAll',
      sample: options.items.map((item) => item.title).join('\n'),
      onChange: (query) => {
        results.textContent = '';
        const byGroup = new Map(groups().map((group) => [group.id, group.name]));
        const closed = closedSet();
        // The master search covers every tab this strip owns, including the ones
        // that are currently closed — a result the user cannot see is exactly the
        // one they came here for.
        const matched = options.items.filter((item) => query.matches(item.title));
        if (matched.length === 0) {
          results.append(components.emptyState({ title: 'core.search.noMatches' }));
          return;
        }
        const list = records();
        for (const item of matched) {
          const record = list.find((candidate) => candidate.id === item.id);
          results.append(
            components.listItem({
              headline: item.title,
              supporting: [
                record?.group ? `${byGroup.get(record.group) ?? record.group}` : t('settings.tab.noGroup', 'Not in a group'),
                record?.pinned ? t('settings.strip.pinned', 'Pinned') : '',
                closed.has(item.id) ? t('settings.tab.isClosed', 'Closed') : '',
                ctx.locks.isLocked(options.lockTarget(item.id)) ? t('settings.row.locked', 'Locked') : ''
              ]
                .filter(Boolean)
                .join(' · '),
              leadingIcon: item.icon,
              onActivate: () => {
                open(item.id);
                handle.close();
              }
            })
          );
        }
      }
    });
    overlayBar = search;
    handle.body.append(search.root, results);
    handle.reposition();
    window.requestAnimationFrame(() => search.focus());
  };

  const openGroupSearch = (anchor: HTMLElement): void => {
    let overlayBar: { destroy(): void } | null = null;
    const handle = ctx.overlay.open({
      anchor,
      placement: 'bottom-start',
      role: 'dialog',
      label: t('settings.strip.searchGroups', 'Search settings groups'),
      resizeKey: `${keyPrefix}.groupSearch`,
      onClose: () => overlayBar?.destroy()
    });
    const results = components.list({ label: 'settings.strip.searchGroups' });
    const search = ctx.createSearchBar({
      label: 'settings.strip.searchGroups',
      sample: groups().map((group) => group.name).join('\n'),
      onChange: (query) => {
        results.textContent = '';
        const matched = groups().filter((group) => query.matches(group.name));
        if (matched.length === 0) {
          results.append(components.emptyState({ title: 'core.search.noMatches' }));
          return;
        }
        for (const group of matched) {
          const members = records().filter((record) => record.group === group.id);
          results.append(
            components.listItem({
              headline: group.name,
              supporting: t('settings.group.members', '{count} tabs in this group', { count: members.length }),
              leadingIcon: 'folder',
              onActivate: () => {
                // Revealing a result inside a collapsed group opens it for this
                // visit and leaves the stored preference alone afterwards.
                setGroupCollapsed(group.id, false);
                if (members[0]) open(members[0].id);
                handle.close();
              }
            })
          );
        }
      }
    });
    overlayBar = search;
    handle.body.append(search.root, results);
    handle.reposition();
    window.requestAnimationFrame(() => search.focus());
  };

  /* ---------------- the two bulk closes ---------------- */

  const openBulkClose = (anchor: HTMLElement, containing: boolean): void => {
    let overlayBar: { destroy(): void } | null = null;
    const handle = ctx.overlay.open({
      anchor,
      placement: 'bottom-start',
      role: 'dialog',
      label: t(
        containing ? 'settings.bulk.closeContaining' : 'settings.bulk.closeNotContaining',
        'Close settings tabs'
      ),
      resizeKey: `${keyPrefix}.bulkClose`,
      onClose: () => overlayBar?.destroy()
    });

    let includePinned = false;
    let matched: NestedTabRecord[] = [];

    const summary = el('p', { className: 'md-typescale-body-medium', attrs: { role: 'status' } });
    const preview = components.list({ label: 'settings.bulk.preview' });

    // One predicate for both directions, so "not containing" is the exact
    // negation of "containing" and the flags, casing and scope cannot drift.
    const recompute = (predicate: (value: string) => boolean, hasQuery: boolean, error: string | null): void => {
      preview.textContent = '';
      if (!hasQuery || error) {
        matched = [];
        summary.textContent = error ?? t('settings.bulk.emptyQuery', 'Type something first. Nothing closes on an empty query.');
        run.disabled = true;
        run.title = summary.textContent;
        return;
      }
      const pinnedCount = records().filter((record) => record.pinned).length;
      matched = records().filter((record) => {
        if (record.pinned && !includePinned) return false;
        const hit = predicate(record.title);
        return containing ? hit : !hit;
      });
      summary.textContent = t('settings.bulk.preview', '{count} settings tabs will close. {pinned} pinned tabs are excluded.', {
        count: matched.length,
        pinned: includePinned ? 0 : pinnedCount
      });
      for (const record of matched) {
        preview.append(components.listItem({ headline: record.title, leadingIcon: record.icon }));
      }
      run.disabled = matched.length === 0;
      run.title =
        matched.length === 0
          ? t('settings.bulk.emptyQuery', 'Nothing matches, so there is nothing to close.')
          : '';
    };

    const run = components.button({
      label: 'settings.tab.close',
      variant: 'filled',
      danger: true,
      disabled: true,
      disabledReason: 'settings.bulk.emptyQuery',
      onClick: async () => {
        if (matched.length === 0) return;
        // Closing hides tabs and changes no value, so this is a plain decision
        // dialog with a real preview rather than the two-key destructive gate —
        // and it says exactly how to get them back.
        const approved = await components.dialog({
          title: t('settings.bulk.confirmTitle', 'Close {count} settings tabs?', { count: matched.length }),
          body: `${t('settings.bulk.confirmBody', 'Nothing is deleted and no value changes.')}\n${matched
            .map((record) => record.title)
            .join(', ')}`,
          confirmLabel: t('settings.tab.close', 'Close'),
          icon: 'close'
        });
        if (!approved) return;
        for (const record of matched) close(record.id);
        void ctx.history.record('settings tabs closed', 'settings', {
          count: matched.length,
          ids: matched.map((record) => record.id)
        });
        handle.close();
      }
    });

    const search = ctx.createSearchBar({
      label: containing ? 'settings.bulk.closeContaining' : 'settings.bulk.closeNotContaining',
      sample: records().map((record) => record.title).join('\n'),
      onChange: (query) =>
        recompute((value) => query.matches(value), query.text.trim() !== '' || query.regex, query.error)
    });
    overlayBar = search;

    const pinnedToggle = components.switchControl({
      label: 'settings.bulk.includePinned',
      checked: false,
      onChange: (value) => {
        includePinned = value;
        const query = search.query();
        recompute((candidate) => query.matches(candidate), query.text.trim() !== '' || query.regex, query.error);
      }
    });

    handle.body.append(search.root, pinnedToggle.root, summary, preview, run);
    recompute(() => false, false, null);
    handle.reposition();
    window.requestAnimationFrame(() => search.focus());
  };

  const openToolsMenu = (anchor: HTMLElement): void => {
    const closedCount = closedSet().size;
    components.menu({
      anchor,
      label: 'settings.strip.tools',
      items: [
        { id: 'all', label: 'settings.strip.searchAll', icon: 'search', run: () => openMasterSearch(anchor) },
        { id: 'groups', label: 'settings.strip.searchGroups', icon: 'folder', run: () => openGroupSearch(anchor) },
        {
          id: 'close-containing',
          label: 'settings.bulk.closeContaining',
          icon: 'close',
          danger: true,
          separatorBefore: true,
          run: () => openBulkClose(anchor, true)
        },
        {
          id: 'close-not-containing',
          label: 'settings.bulk.closeNotContaining',
          icon: 'close',
          danger: true,
          run: () => openBulkClose(anchor, false)
        },
        {
          id: 'reopen',
          label: `${t('settings.tab.reopenAll', 'Reopen every closed settings tab')}${closedCount > 0 ? ` (${closedCount})` : ''}`,
          icon: 'refresh',
          disabled: closedCount === 0,
          disabledReason: 'No settings tab is closed, so there is nothing to reopen.',
          run: () => reopenAll()
        },
        {
          id: 'dock',
          label: 'settings.strip.dock',
          icon: 'dock',
          separatorBefore: true,
          children: (['left', 'right', 'top', 'bottom'] as DockEdge[]).map((edge) => ({
            id: `dock-${edge}`,
            label: `settings.strip.dock.${edge}`,
            icon: edge === dock() ? 'check' : 'dock',
            run: () => {
              settings.set(DOCK_KEY, edge);
              render();
            }
          }))
        }
      ]
    });
  };

  /* ---------------- rendering ---------------- */

  let stripFilter: (value: string) => boolean = () => true;

  function render(): void {
    if (destroyed) return;
    const edge = dock();
    const vertical = edge === 'left' || edge === 'right';

    root.dataset.dock = edge;
    strip.dataset.dock = edge;
    strip.setAttribute('role', 'tablist');
    strip.setAttribute('aria-orientation', vertical ? 'vertical' : 'horizontal');
    strip.setAttribute('aria-label', t(options.stripLabel, 'Settings tabs'));

    for (const bar of stripBars.splice(0, stripBars.length)) {
      // Only the strip-owned bars are rebuilt here; overlay-owned ones close with
      // their overlay. Destroying is safe either way.
      try {
        bar.destroy();
      } catch {
        /* a search bar that is already gone is not an error */
      }
    }
    strip.textContent = '';

    const list = records();
    const allGroups = groups();
    const pinned = list.filter((record) => record.pinned);
    const loose = list.filter((record) => !record.pinned && !record.group);

    const grouped = new Map<string, NestedTabRecord[]>();
    for (const record of list) {
      if (record.pinned || !record.group) continue;
      const members = grouped.get(record.group) ?? [];
      members.push(record);
      grouped.set(record.group, members);
    }

    const buttons: HTMLButtonElement[] = [];

    const buildTab = (record: NestedTabRecord): HTMLLIElement => {
      const item = el('li', { attrs: { role: 'none', 'data-settings-tab-item': record.id } });
      const node = el('button', {
        className: 'settings-tabs__tab',
        attrs: {
          type: 'button',
          role: 'tab',
          id: `settings-tab-${record.id}`,
          'data-settings-tab': record.id,
          'aria-selected': String(record.id === active),
          'aria-controls': `settings-panel-${record.id}`,
          'data-appearance-id': options.appearanceId(record.id)
        }
      });
      node.append(components.icon(record.icon, { size: 18 }));
      node.append(el('span', { className: 'settings-tabs__label', text: record.title }));
      if (record.pinned) {
        node.append(
          el('span', {
            className: 'settings-tabs__badge',
            text: '📌',
            attrs: { 'aria-hidden': 'true' }
          })
        );
        node.setAttribute('aria-description', t('settings.strip.pinned', 'Pinned'));
      }
      if (ctx.locks.isLocked(options.lockTarget(record.id))) {
        node.append(el('span', { className: 'settings-tabs__badge', text: '🔒', attrs: { 'aria-hidden': 'true' } }));
        node.setAttribute('aria-description', t('settings.row.locked', 'Locked'));
      }
      node.addEventListener('click', () => open(record.id));
      node.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (event.shiftKey) {
          ctx.appearance.edit(node, `[data-appearance-id="${options.appearanceId(record.id)}"]`);
          return;
        }
        openTabMenu(record, node);
      });
      buttons.push(node);
      item.append(node);
      return item;
    };

    /* --- (1) the search for this strip --- */
    const stripSearch = ctx.createSearchBar({
      label: 'settings.strip.search',
      compact: true,
      sample: list.map((record) => record.title).join('\n'),
      onChange: (query) => {
        stripFilter = (value: string) => query.matches(value);
        applyFilter();
      }
    });
    stripBars.push(stripSearch);
    const searchHost = el('div', { className: 'settings-tabs__search' });
    searchHost.append(stripSearch.root);
    strip.append(searchHost);

    if (pinned.length > 0) {
      const pinnedList = el('ul', {
        className: 'settings-tabs__list settings-tabs__list--pinned',
        attrs: { role: 'none', 'aria-label': t('settings.strip.pinned', 'Pinned settings tabs') }
      });
      for (const record of pinned) pinnedList.append(buildTab(record));
      strip.append(pinnedList);
    }

    const mainList = el('ul', { className: 'settings-tabs__list', attrs: { role: 'none' } });
    for (const record of loose) mainList.append(buildTab(record));

    for (const group of allGroups) {
      const members = grouped.get(group.id) ?? [];
      if (members.length === 0) continue;
      const holder = el('li', { attrs: { role: 'none' } });
      const box = el('div', {
        className: 'settings-tabs__group',
        attrs: {
          'data-collapsed': String(group.collapsed),
          'data-appearance-id': `${keyPrefix}.group:${group.id}`
        }
      });
      const header = el('button', {
        className: 'settings-tabs__group-header',
        attrs: { type: 'button', 'aria-expanded': String(!group.collapsed) }
      });
      const swatch = el('span', { className: 'settings-tabs__swatch', attrs: { 'aria-hidden': 'true' } });
      swatch.style.background = group.color;
      header.append(swatch, el('span', { className: 'md-typescale-label-large', text: group.name }));
      header.append(components.icon(group.collapsed ? 'chevronRight' : 'chevronDown', { size: 16 }));
      header.addEventListener('click', () => setGroupCollapsed(group.id, !group.collapsed));
      header.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (event.shiftKey) {
          ctx.appearance.edit(box, `[data-appearance-id="${keyPrefix}.group:${group.id}"]`);
          return;
        }
        openGroupMenu(group, header);
      });

      const body = el('ul', { className: 'settings-tabs__group-body', attrs: { role: 'none' } });
      body.hidden = group.collapsed;

      /* --- (2) a search inside every individual group --- */
      const groupSearch = ctx.createSearchBar({
        label: 'settings.strip.searchGroup',
        compact: true,
        sample: members.map((record) => record.title).join('\n'),
        onChange: (query) => {
          for (const member of members) {
            const node = body.querySelector<HTMLElement>(`[data-settings-tab-item="${CSS.escape(member.id)}"]`);
            if (node) node.hidden = !query.matches(member.title);
          }
        }
      });
      stripBars.push(groupSearch);
      const groupSearchHolder = el('li', { attrs: { role: 'none' } });
      groupSearchHolder.append(groupSearch.root);
      body.append(groupSearchHolder);
      for (const member of members) body.append(buildTab(member));

      box.append(header, body);
      holder.append(box);
      mainList.append(holder);
    }

    strip.append(mainList);

    if (list.length === 0) {
      strip.append(
        components.emptyState({
          title: 'settings.strip.empty',
          action: { label: 'settings.strip.emptyAction', variant: 'tonal', icon: 'refresh', onClick: () => reopenAll() }
        })
      );
    }

    /* --- overflow: never a silent clip --- */
    const tools = el('div', { className: 'settings-tabs__tools' });
    const overflowButton = components.iconButton({
      icon: 'more',
      label: t('settings.strip.overflow', 'More settings tabs'),
      onClick: () => {
        components.menu({
          anchor: overflowButton,
          label: 'settings.strip.overflow',
          items: list.map((record) => ({
            id: record.id,
            label: record.title,
            icon: record.id === active ? 'check' : record.icon,
            run: () => open(record.id)
          }))
        });
      }
    });
    /* --- (3) group search, (4) master search, plus both bulk closes --- */
    const toolsButton = components.iconButton({
      icon: 'filter',
      label: t('settings.strip.tools', 'Tab tools and bulk actions'),
      onClick: () => openToolsMenu(toolsButton)
    });
    tools.append(overflowButton, toolsButton);
    strip.append(tools);

    function applyFilter(): void {
      for (const record of list) {
        const node = strip.querySelector<HTMLElement>(`[data-settings-tab-item="${CSS.escape(record.id)}"]`);
        if (node) node.hidden = !stripFilter(record.title);
      }
      // A vertical strip overflows in HEIGHT; a horizontal one in width. Reading
      // the wrong dimension here hides the overflow button on exactly the strip
      // that needs it.
      const rect = mainList.getBoundingClientRect();
      const overflowing = vertical
        ? mainList.scrollHeight > rect.height + 1
        : mainList.scrollWidth > rect.width + 1;
      overflowButton.hidden = !overflowing && list.length <= 8;
    }

    a11y.roving(
      strip,
      () => buttons.filter((node) => node.offsetParent !== null),
      vertical ? 'vertical' : 'horizontal'
    );
    window.requestAnimationFrame(applyFilter);
  }

  /* ---------------- boot ---------------- */

  const stored = settings.get<string>(ACTIVE_KEY, '');
  const first = records();
  active = first.some((record) => record.id === stored) ? stored : (first[0]?.id ?? null);
  render();
  if (active) open(active);

  return {
    root,
    open,
    activeId: () => active,
    records,
    visibleIds: () => records().map((record) => record.id),
    closedIds: () => [...closedSet()],
    reopenAll,
    reveal: (tabId, elementId) => {
      open(tabId);
      if (!elementId) return;
      window.requestAnimationFrame(() => {
        const target = document.getElementById(elementId);
        if (!target) return;
        target.scrollIntoView({ behavior: a11y.reducedMotion() ? 'auto' : 'smooth', block: 'center' });
        a11y.focusVisible(target);
        target.classList.add('md-teleport-highlight');
        window.setTimeout(() => target.classList.remove('md-teleport-highlight'), 2000);
      });
    },
    refresh: render,
    destroy: () => {
      destroyed = true;
      for (const bar of stripBars.splice(0, stripBars.length)) {
        try {
          bar.destroy();
        } catch {
          /* already gone */
        }
      }
      panels.clear();
      root.remove();
    }
  };
}
