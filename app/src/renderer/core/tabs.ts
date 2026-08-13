import { a11y, el } from './a11y';
import { openColorPicker } from './colorpicker';
import { components } from './components';
import { confirmService } from './confirm';
import { i18n } from './i18n';
import { locks } from './locks';
import { registry } from './registry';
import { createSearchBar } from './searchbar';
import { settings } from './settings';
import type { AppContext, DockEdge, TabContext, TabGroup, TabRecord, TabService } from './types';

/**
 * Browser-style tabs.
 *
 * The strip docks to any edge and LEFT is the default. A screen is wider than it
 * is tall and a tab label is wider than it is high, so a vertical strip shows
 * more tabs legibly than the horizontal one every browser trained us to expect.
 *
 * Docking is an orientation change rather than a rotation. The overflow surface
 * measures height instead of width when the strip is vertical, reordering and
 * pinning and grouping all move along the new axis, `aria-orientation` follows
 * the edge and the arrow keys follow the axis — get that last one wrong and the
 * strip looks perfect and cannot be used from a keyboard, which no screenshot
 * ever reveals. A label is never rotated ninety degrees to make it fit: a
 * sideways word is a word nobody reads.
 */

const DOCK_KEY = 'tabs.dock';
const ORDER_KEY = 'tabs.order';
const PINNED_KEY = 'tabs.pinned';
const GROUPS_KEY = 'tabs.groups';
const MEMBERSHIP_KEY = 'tabs.membership';
const CLOSED_KEY = 'tabs.closed';
const ACTIVE_KEY = 'tabs.active';
const GROUPS_SEEDED_KEY = 'tabs.groups.seeded';

/**
 * The default groups a fresh profile opens with, all of them collapsed so the
 * strip opens quiet with the product's own surfaces on top of it. `name` is an
 * i18n key (or literal text — the same "key or literal" contract every other
 * translated field in this application uses), resolved through `groupLabel`
 * wherever it is displayed, never printed raw.
 *
 * This seeds the group ONCE. A user who renames, recolours, reorders or
 * collapses/expands a group afterwards owns that state permanently — the seed
 * never runs again and never overwrites what is already on disk.
 */
const DEFAULT_GROUPS: ReadonlyArray<{ id: string; name: string; color: string; order: number }> = [
  { id: 'group.bot-control', name: 'core.tabs.group.botControl', color: 'var(--md-sys-color-tertiary)', order: 10 },
  { id: 'group.tools', name: 'core.tabs.group.tools', color: 'var(--md-sys-color-secondary)', order: 20 },
  { id: 'group.personalisation', name: 'core.tabs.group.personalisation', color: 'var(--md-sys-color-primary)', order: 30 },
  { id: 'group.records', name: 'core.tabs.group.records', color: 'var(--md-sys-color-success)', order: 40 },
  { id: 'group.security', name: 'core.tabs.group.security', color: 'var(--md-sys-color-error)', order: 50 }
];

interface MountedPanel {
  host: HTMLElement;
  dispose: (() => void) | null;
}

class TabsImpl implements TabService {
  private strip: HTMLElement | null = null;
  private content: HTMLElement | null = null;
  private shell: HTMLElement | null = null;
  private ctx: AppContext | null = null;
  private panels = new Map<string, MountedPanel>();
  private listeners = new Set<() => void>();
  private active: string | null = null;

  /* ---------------- persisted state ---------------- */

  dock(): DockEdge {
    const raw = settings.get<string>(DOCK_KEY, 'left');
    return raw === 'right' || raw === 'top' || raw === 'bottom' ? raw : 'left';
  }

  setDock(edge: DockEdge): void {
    settings.set(DOCK_KEY, edge);
    this.render();
  }

  private orderMap(): Record<string, number> {
    const stored = settings.get<Record<string, number>>(ORDER_KEY, {});
    return stored && typeof stored === 'object' ? stored : {};
  }

  private pinnedSet(): Set<string> {
    const stored = settings.get<string[]>(PINNED_KEY, []);
    return new Set(Array.isArray(stored) ? stored : []);
  }

  private membership(): Record<string, string> {
    const stored = settings.get<Record<string, string>>(MEMBERSHIP_KEY, {});
    return stored && typeof stored === 'object' ? stored : {};
  }

  private closedSet(): Set<string> {
    const stored = settings.get<string[]>(CLOSED_KEY, []);
    return new Set(Array.isArray(stored) ? stored : []);
  }

  groups(): TabGroup[] {
    const stored = settings.get<TabGroup[]>(GROUPS_KEY, []);
    const list = Array.isArray(stored) ? stored : [];
    return [...list].sort((a, b) => a.order - b.order);
  }

  private writeGroups(groups: TabGroup[]): void {
    settings.set(GROUPS_KEY, groups);
    this.render();
  }

  /**
   * Seeds the default collapsed groups exactly once, and only onto a profile
   * that has never had any group at all. A later run — after the user has
   * created, renamed or removed a group of their own — is a no-op, because the
   * seeded flag is set the first time this runs regardless of outcome. This is
   * what keeps "the user's own arrangement wins" true across an update: a
   * migration that silently rearranged somebody's workspace would be worse
   * than shipping the old flat list.
   */
  private ensureDefaultGroups(): void {
    if (settings.get<boolean>(GROUPS_SEEDED_KEY, false)) return;
    settings.set(GROUPS_SEEDED_KEY, true);
    if (this.groups().length > 0) return;
    const seeded: TabGroup[] = DEFAULT_GROUPS.map((spec) => ({
      id: spec.id,
      name: spec.name,
      color: spec.color,
      collapsed: true,
      order: spec.order
    }));
    settings.set(GROUPS_KEY, seeded);
  }

  /** `TabGroup.name` is an i18n key or literal text, exactly like every other
   * "key or literal" field in this application (see `label()` in
   * `core/components.ts`). A user-typed name never matches a catalogue key, so
   * it resolves to itself unchanged; a seeded name resolves to the localized,
   * funny-level-styled group label. Every place a group's name is displayed —
   * the header, the searches, the pickers, the rename prompt — reads it
   * through here rather than the raw field. */
  private groupLabel(group: TabGroup): string {
    return i18n.t(group.name, group.name);
  }

  /* ---------------- records ---------------- */

  list(): TabRecord[] {
    const order = this.orderMap();
    const pinned = this.pinnedSet();
    const membership = this.membership();
    const closed = this.closedSet();
    return registry
      .tabs()
      .filter((tab) => !closed.has(tab.id))
      .map((tab) => ({
        id: tab.id,
        title: i18n.t(tab.title, tab.title),
        icon: tab.icon,
        group: membership[tab.id] ?? tab.group ?? null,
        pinned: pinned.has(tab.id),
        order: order[tab.id] ?? tab.order ?? 1000,
        permanent: tab.permanent === true
      }))
      .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
  }

  activeId(): string | null {
    return this.active;
  }

  /* ---------------- lifecycle ---------------- */

  mount(shell: HTMLElement, strip: HTMLElement, content: HTMLElement, ctx: AppContext): void {
    this.shell = shell;
    this.strip = strip;
    this.content = content;
    this.ctx = ctx;
    this.ensureDefaultGroups();
    const stored = settings.get<string>(ACTIVE_KEY, '');
    const available = this.list();
    this.active = available.some((record) => record.id === stored) ? stored : (available[0]?.id ?? null);
    this.render();
    if (this.active) this.open(this.active);
  }

  open(tabId: string): void {
    const definition = registry.tab(tabId);
    if (!definition || !this.content || !this.ctx) return;

    // A closed tab reopens rather than refusing: the palette is the usual route
    // back to something the user closed.
    const closed = this.closedSet();
    if (closed.has(tabId)) {
      closed.delete(tabId);
      settings.set(CLOSED_KEY, [...closed]);
    }

    if (locks.isLocked(tabId) && !locks.isUnlocked(tabId)) {
      const trigger = this.strip?.querySelector<HTMLElement>(`[data-tab-id="${CSS.escape(tabId)}"]`);
      if (trigger) {
        void locks.unlock(tabId, trigger).then((unlocked) => {
          if (unlocked) this.open(tabId);
        });
        return;
      }
    }

    this.active = tabId;
    settings.set(ACTIVE_KEY, tabId);

    let panel = this.panels.get(tabId);
    if (!panel) {
      const host = el('section', {
        className: 'md-panel',
        attrs: { role: 'tabpanel', id: `md-panel-${tabId}`, 'aria-labelledby': `md-tab-${tabId}`, tabindex: '0' }
      });
      // Registered in `this.panels` — and hidden — BEFORE `mount()` runs, not
      // after. A feature's `mount()` can itself synchronously call
      // `ctx.tabs.open()`/`teleport()` (a redirect, a "reveal this related
      // destination" affordance); when it does, that nested call's own
      // hide-everything-but-me step needs to already know this host exists,
      // or the host sits in `this.content` unhidden and untracked for the
      // whole time `mount()` is still running. Marking it hidden immediately,
      // before it has any content, closes that window rather than relying on
      // the outer call to clean up after a nested one — the outer call may
      // never get the chance to, if `mount()` itself never returns
      // synchronously (a thrown error, or work chained after the nested call
      // that this function has no visibility into).
      host.hidden = true;
      this.content.append(host);
      const disposers: Array<() => void> = [];
      panel = { host, dispose: null };
      this.panels.set(tabId, panel);
      const tabContext: TabContext = {
        ...this.ctx,
        tabId,
        onDispose: (fn) => disposers.push(fn)
      };
      const returned = definition.mount(host, tabContext);
      if (typeof returned === 'function') disposers.push(returned);
      panel.dispose = () => {
        for (const fn of disposers) {
          try {
            fn();
          } catch (error) {
            console.error(`Disposing the "${tabId}" tab threw:`, error);
          }
        }
      };
    }

    // Authoritative over what is actually IN `this.content`, not just over
    // `this.panels`' own bookkeeping of it. The two are supposed to mirror
    // each other exactly, but a loop that only ever walks the cache repeats
    // whatever the cache believes even when reality has drifted from it — the
    // exact failure mode that let a previous destination's pane stay
    // `offsetParent !== null` underneath the one just opened. Walking the
    // host's real children instead means every element genuinely inside
    // `this.content` is hidden except the one just opened, full stop, with no
    // way for a currently-unaccounted-for child to be skipped.
    for (const child of Array.from(this.content.children)) {
      if (child instanceof HTMLElement) child.hidden = child !== panel.host;
    }
    this.render();
    this.emit();
  }

  close(tabId: string): void {
    const definition = registry.tab(tabId);
    if (definition?.permanent) return;
    const panel = this.panels.get(tabId);
    if (panel) {
      panel.dispose?.();
      panel.host.remove();
      this.panels.delete(tabId);
    }
    const closed = this.closedSet();
    closed.add(tabId);
    settings.set(CLOSED_KEY, [...closed]);
    if (this.active === tabId) {
      const next = this.list()[0];
      this.active = next?.id ?? null;
      if (this.active) this.open(this.active);
    }
    this.render();
    this.emit();
  }

  /* ---------------- groups ---------------- */

  createGroup(name: string, color = 'var(--md-sys-color-primary)'): TabGroup {
    const groups = this.groups();
    const group: TabGroup = {
      id: `group-${Date.now().toString(36)}`,
      name,
      color,
      collapsed: false,
      order: groups.length
    };
    this.writeGroups([...groups, group]);
    return group;
  }

  renameGroup(groupId: string, name: string): void {
    this.writeGroups(this.groups().map((group) => (group.id === groupId ? { ...group, name } : group)));
  }

  setGroupColor(groupId: string, color: string): void {
    this.writeGroups(this.groups().map((group) => (group.id === groupId ? { ...group, color } : group)));
  }

  setGroupCollapsed(groupId: string, collapsed: boolean): void {
    this.writeGroups(this.groups().map((group) => (group.id === groupId ? { ...group, collapsed } : group)));
  }

  moveToGroup(tabId: string, groupId: string | null): void {
    const membership = { ...this.membership() };
    if (groupId === null) delete membership[tabId];
    else membership[tabId] = groupId;
    settings.set(MEMBERSHIP_KEY, membership);
    this.render();
  }

  setPinned(tabId: string, pinned: boolean): void {
    const set = this.pinnedSet();
    if (pinned) set.add(tabId);
    else set.delete(tabId);
    settings.set(PINNED_KEY, [...set]);
    this.render();
  }

  private reorder(tabId: string, delta: number): void {
    const records = this.list();
    const index = records.findIndex((record) => record.id === tabId);
    const target = index + delta;
    if (index === -1 || target < 0 || target >= records.length) return;
    const reordered = [...records];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(target, 0, moved);
    const order: Record<string, number> = {};
    reordered.forEach((record, position) => {
      order[record.id] = position;
    });
    settings.set(ORDER_KEY, order);
    this.render();
  }

  /* ---------------- teleport ---------------- */

  teleport(tabId: string, elementId?: string): void {
    this.open(tabId);
    if (!elementId) return;
    window.requestAnimationFrame(() => {
      const target = document.getElementById(elementId);
      if (!target) return;
      target.scrollIntoView({ behavior: a11y.reducedMotion() ? 'auto' : 'smooth', block: 'center' });
      a11y.focusVisible(target);
      target.classList.add('md-teleport-highlight');
      window.setTimeout(() => target.classList.remove('md-teleport-highlight'), 2000);
    });
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    for (const listener of [...this.listeners]) listener();
  }

  /* ---------------- rendering ---------------- */

  private render(): void {
    const strip = this.strip;
    const shell = this.shell;
    if (!strip || !shell) return;
    const dock = this.dock();
    const vertical = dock === 'left' || dock === 'right';

    shell.dataset.dock = dock;
    strip.dataset.dock = dock;
    strip.setAttribute('role', 'tablist');
    strip.setAttribute('aria-orientation', vertical ? 'vertical' : 'horizontal');
    strip.setAttribute('aria-label', i18n.t('core.tabs.strip', 'Tabs'));
    strip.textContent = '';

    const records = this.list();
    const groups = this.groups();
    const pinned = records.filter((record) => record.pinned);
    const loose = records.filter((record) => !record.pinned && !record.group);
    const grouped = new Map<string, TabRecord[]>();
    for (const record of records) {
      if (record.pinned || !record.group) continue;
      const list = grouped.get(record.group) ?? [];
      list.push(record);
      grouped.set(record.group, list);
    }

    /* --- (1) the search for the current strip --- */
    const stripSearchHost = el('div', { className: 'md-tabstrip__search' });
    let stripQuery = (value: string): boolean => value.length >= 0;
    const stripSearch = createSearchBar({
      label: 'core.tabs.searchStrip',
      compact: true,
      sample: records.map((record) => record.title).join('\n'),
      onChange: (query) => {
        stripQuery = (value: string) => query.matches(value);
        applyFilter();
      }
    });
    stripSearchHost.append(stripSearch.root);
    strip.append(stripSearchHost);

    const pinnedList = el('ul', {
      className: 'md-tabstrip__pinned',
      attrs: { role: 'none', 'aria-label': i18n.t('core.tabs.pinned', 'Pinned') }
    });
    const mainList = el('ul', { className: 'md-tabstrip__list', attrs: { role: 'none' } });

    const buttons: HTMLButtonElement[] = [];

    const buildTab = (record: TabRecord): HTMLLIElement => {
      const item = el('li', { attrs: { role: 'none', 'data-tab-item': record.id } });
      const node = el('button', {
        className: 'md-tab',
        attrs: {
          type: 'button',
          role: 'tab',
          id: `md-tab-${record.id}`,
          'data-tab-id': record.id,
          'aria-selected': String(record.id === this.active),
          'aria-controls': `md-panel-${record.id}`,
          'data-appearance-id': `tab:${record.id}`
        }
      });
      node.append(components.icon(record.icon, { size: 18 }));
      node.append(el('span', { className: 'md-tab__label', text: record.title }));
      if (record.pinned) node.append(el('span', { className: 'md-tab__pin', attrs: { 'aria-hidden': 'true' }, text: '📌' }));
      if (locks.isLocked(record.id)) {
        node.append(el('span', { className: 'md-lock-badge', attrs: { 'aria-hidden': 'true' }, text: '🔒' }));
        node.setAttribute('aria-description', i18n.t('core.lock.locked', 'This is locked.'));
      }
      node.addEventListener('click', () => this.open(record.id));
      node.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        event.stopPropagation();
        // Shift+right-click opens the appearance editor directly; the plain
        // context menu keeps every tab-management command AND offers it too.
        if (event.shiftKey) {
          this.ctx?.appearance.edit(node, `[data-appearance-id="tab:${record.id}"]`);
          return;
        }
        this.openTabMenu(record, node);
      });
      buttons.push(node);
      item.append(node);
      return item;
    };

    for (const record of pinned) pinnedList.append(buildTab(record));
    for (const record of loose) mainList.append(buildTab(record));

    for (const group of groups) {
      const members = grouped.get(group.id) ?? [];
      if (members.length === 0) continue;
      const groupNode = el('li', { attrs: { role: 'none' } });
      const groupBox = el('div', {
        className: 'md-tabgroup',
        attrs: { 'data-collapsed': String(group.collapsed), 'data-appearance-id': `tabgroup:${group.id}` }
      });
      const header = el('button', {
        className: 'md-tabgroup__header',
        attrs: { type: 'button', 'aria-expanded': String(!group.collapsed) }
      });
      const swatch = el('span', { className: 'md-tabgroup__swatch' });
      swatch.style.background = group.color;
      header.append(swatch, el('span', { className: 'md-typescale-label-large', text: this.groupLabel(group) }));
      header.append(components.icon(group.collapsed ? 'chevronRight' : 'chevronDown', { size: 16 }));
      header.addEventListener('click', () => this.setGroupCollapsed(group.id, !group.collapsed));
      header.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (event.shiftKey) {
          this.ctx?.appearance.edit(groupBox, `[data-appearance-id="tabgroup:${group.id}"]`);
          return;
        }
        this.openGroupMenu(group, header);
      });

      const body = el('ul', { className: 'md-tabgroup__body', attrs: { role: 'none' } });

      /* --- (2) a search inside every individual group --- */
      const groupSearch = createSearchBar({
        label: 'core.tabs.searchGroup',
        compact: true,
        sample: members.map((record) => record.title).join('\n'),
        onChange: (query) => {
          for (const member of members) {
            const item = body.querySelector<HTMLElement>(`[data-tab-item="${CSS.escape(member.id)}"]`);
            if (item) item.hidden = !query.matches(member.title);
          }
        }
      });
      body.append(el('li', { attrs: { role: 'none' }, children: [groupSearch.root] }));
      for (const member of members) body.append(buildTab(member));

      groupBox.append(header, body);
      groupNode.append(groupBox);
      mainList.append(groupNode);
    }

    if (pinned.length > 0) strip.append(pinnedList);
    strip.append(mainList);

    /* --- overflow: never a silent clip --- */
    const overflowHost = el('div', { className: 'md-tabstrip__overflow' });
    const overflowButton = components.iconButton({
      icon: 'more',
      label: i18n.t('core.tabs.overflow', 'More tabs'),
      onClick: () => {
        components.menu({
          anchor: overflowButton,
          label: 'core.tabs.overflow',
          items: records.map((record) => ({
            id: record.id,
            label: record.title,
            icon: record.icon,
            run: () => this.open(record.id)
          }))
        });
      }
    });
    overflowHost.append(overflowButton);

    /* --- (3) group search, (4) master search, plus the bulk closes --- */
    const toolsButton = components.iconButton({
      icon: 'filter',
      label: i18n.t('core.tabs.searchAll', 'Search every open tab'),
      onClick: () => this.openToolsMenu(toolsButton)
    });
    overflowHost.append(toolsButton);
    strip.append(overflowHost);

    const applyFilter = (): void => {
      for (const record of records) {
        const item = strip.querySelector<HTMLElement>(`[data-tab-item="${CSS.escape(record.id)}"]`);
        if (item) item.hidden = !stripQuery(record.title);
      }
      // The overflow surface reports what the strip cannot show. A vertical
      // strip measures HEIGHT here; a horizontal one measures width.
      const listRect = mainList.getBoundingClientRect();
      const overflowing = vertical
        ? mainList.scrollHeight > listRect.height + 1
        : mainList.scrollWidth > listRect.width + 1;
      overflowButton.hidden = !overflowing && records.length <= 12;
    };

    a11y.roving(strip, () => buttons.filter((node) => node.offsetParent !== null), vertical ? 'vertical' : 'horizontal');
    window.requestAnimationFrame(applyFilter);
  }

  private openTabMenu(record: TabRecord, anchor: HTMLElement): void {
    const groups = this.groups();
    components.menu({
      anchor,
      label: record.title,
      items: [
        { id: 'open', label: 'Open', icon: 'chevronRight', shortcut: 'Enter', run: () => this.open(record.id) },
        {
          id: 'pin',
          label: record.pinned ? 'core.tabs.unpin' : 'core.tabs.pin',
          icon: 'pin',
          run: () => this.setPinned(record.id, !record.pinned)
        },
        { id: 'move-up', label: 'Move earlier', icon: 'chevronUp', run: () => this.reorder(record.id, -1) },
        { id: 'move-down', label: 'Move later', icon: 'chevronDown', run: () => this.reorder(record.id, 1) },
        {
          id: 'move-group',
          label: 'core.tabs.moveToGroup',
          icon: 'folder',
          separatorBefore: true,
          // A picker, never an inlined list of every group: a menu that grows one
          // item per group grows without bound.
          run: () => this.openGroupPicker(record.id, anchor)
        },
        {
          id: 'appearance',
          label: 'core.tabs.editAppearance',
          icon: 'palette',
          shortcut: 'Shift+Right click',
          separatorBefore: true,
          run: () => this.ctx?.appearance.edit(anchor, `[data-appearance-id="tab:${record.id}"]`)
        },
        {
          id: 'lock',
          label: 'core.lock.command',
          icon: 'lock',
          run: () => locks.wizard(anchor, record.id, record.title)
        },
        ...(groups.length === 0
          ? []
          : [
              {
                id: 'ungroup',
                label: 'Remove from group',
                icon: 'close',
                run: () => this.moveToGroup(record.id, null)
              }
            ]),
        {
          id: 'close',
          label: 'core.action.close',
          icon: 'close',
          danger: true,
          separatorBefore: true,
          disabled: record.permanent,
          disabledReason: 'This destination is part of the application and cannot be closed.',
          run: () => this.close(record.id)
        }
      ]
    });
  }

  private openGroupPicker(tabId: string, anchor: HTMLElement): void {
    const groups = this.groups();
    components.menu({
      anchor,
      label: 'core.tabs.moveToGroup',
      items: [
        {
          id: 'new',
          label: 'core.tabs.newGroup',
          icon: 'add',
          run: () => {
            const group = this.createGroup(`Group ${this.groups().length + 1}`);
            this.moveToGroup(tabId, group.id);
          }
        },
        ...groups.map((group) => ({
          id: group.id,
          label: `${this.groupLabel(group)} (${this.list().filter((record) => record.group === group.id).length})`,
          icon: 'folder',
          separatorBefore: group === groups[0],
          run: () => this.moveToGroup(tabId, group.id)
        }))
      ]
    });
  }

  private openGroupMenu(group: TabGroup, anchor: HTMLElement): void {
    components.menu({
      anchor,
      label: this.groupLabel(group),
      items: [
        {
          id: 'collapse',
          label: group.collapsed ? 'core.tabs.expandGroup' : 'core.tabs.collapseGroup',
          icon: group.collapsed ? 'chevronDown' : 'chevronUp',
          run: () => this.setGroupCollapsed(group.id, !group.collapsed)
        },
        {
          id: 'rename',
          label: 'core.tabs.renameGroup',
          icon: 'edit',
          run: () => {
            // Renaming a seeded group replaces its i18n key with the user's own
            // literal text from here on — the prefill shows the resolved label,
            // never the raw key, so what they see is what they are editing.
            const value = window.prompt(i18n.t('core.tabs.renameGroup', 'Rename group…'), this.groupLabel(group));
            if (value) this.renameGroup(group.id, value);
          }
        },
        {
          id: 'color',
          label: 'core.tabs.groupColor',
          icon: 'palette',
          run: () => {
            openColorPicker({
              anchor,
              value: group.color,
              onChange: (value) => this.setGroupColor(group.id, value)
            });
          }
        },
        {
          id: 'appearance',
          label: 'core.tabs.editGroupAppearance',
          icon: 'palette',
          shortcut: 'Shift+Right click',
          separatorBefore: true,
          run: () => this.ctx?.appearance.edit(anchor, `[data-appearance-id="tabgroup:${group.id}"]`)
        }
      ]
    });
  }

  /** The master search, the group search and both bulk closes. */
  private openToolsMenu(anchor: HTMLElement): void {
    components.menu({
      anchor,
      label: 'core.tabs.searchAll',
      items: [
        { id: 'search-all', label: 'core.tabs.searchAll', icon: 'search', run: () => this.openMasterSearch(anchor) },
        { id: 'search-groups', label: 'core.tabs.searchGroups', icon: 'folder', run: () => this.openGroupSearch(anchor) },
        {
          id: 'close-containing',
          label: 'core.tabs.closeContaining',
          icon: 'close',
          separatorBefore: true,
          danger: true,
          run: () => this.openBulkClose(anchor, true)
        },
        {
          id: 'close-not-containing',
          label: 'core.tabs.closeNotContaining',
          icon: 'close',
          danger: true,
          run: () => this.openBulkClose(anchor, false)
        },
        {
          id: 'dock',
          label: 'core.tabs.dock',
          icon: 'dock',
          separatorBefore: true,
          children: (['left', 'right', 'top', 'bottom'] as DockEdge[]).map((edge) => ({
            id: `dock-${edge}`,
            label: `core.tabs.dock.${edge}`,
            icon: 'dock',
            run: () => this.setDock(edge)
          }))
        }
      ]
    });
  }

  private openMasterSearch(anchor: HTMLElement): void {
    const handle = this.ctx?.overlay.open({
      anchor,
      placement: 'bottom-start',
      role: 'dialog',
      label: i18n.t('core.tabs.searchAll', 'Search every open tab')
    });
    if (!handle) return;
    const results = components.list({ label: 'core.tabs.searchAll' });
    const search = createSearchBar({
      label: 'core.tabs.searchAll',
      sample: this.list().map((record) => record.title).join('\n'),
      onChange: (query) => {
        results.textContent = '';
        const groups = new Map(this.groups().map((group) => [group.id, this.groupLabel(group)]));
        const matched = this.list().filter((record) => query.matches(record.title));
        if (matched.length === 0) {
          results.append(components.emptyState({ title: 'core.search.noMatches' }));
          return;
        }
        for (const record of matched) {
          results.append(
            components.listItem({
              headline: record.title,
              // A result names where it lives: which group, whether it is pinned,
              // and whether it is locked.
              supporting: [
                record.group ? `Group: ${groups.get(record.group) ?? record.group}` : 'No group',
                record.pinned ? i18n.t('core.tabs.pinned', 'Pinned') : '',
                locks.isLocked(record.id) ? i18n.t('core.palette.locked', 'Locked') : ''
              ]
                .filter(Boolean)
                .join(' · '),
              leadingIcon: record.icon,
              onActivate: () => {
                // Revealing a result inside a collapsed group does not destroy
                // that collapsed preference.
                this.open(record.id);
                handle.close();
              }
            })
          );
        }
      }
    });
    handle.body.append(search.root, results);
    handle.reposition();
    window.requestAnimationFrame(() => search.focus());
  }

  private openGroupSearch(anchor: HTMLElement): void {
    const handle = this.ctx?.overlay.open({
      anchor,
      placement: 'bottom-start',
      role: 'dialog',
      label: i18n.t('core.tabs.searchGroups', 'Search tab groups')
    });
    if (!handle) return;
    const results = components.list({ label: 'core.tabs.searchGroups' });
    const search = createSearchBar({
      label: 'core.tabs.searchGroups',
      sample: this.groups().map((group) => this.groupLabel(group)).join('\n'),
      onChange: (query) => {
        results.textContent = '';
        const matched = this.groups().filter((group) => query.matches(this.groupLabel(group)));
        if (matched.length === 0) {
          results.append(components.emptyState({ title: 'core.search.noMatches' }));
          return;
        }
        for (const group of matched) {
          const members = this.list().filter((record) => record.group === group.id);
          results.append(
            components.listItem({
              headline: this.groupLabel(group),
              supporting: `${members.length} tabs${group.collapsed ? ' · collapsed' : ''}`,
              leadingIcon: 'folder',
              onActivate: () => {
                this.setGroupCollapsed(group.id, false);
                if (members[0]) this.open(members[0].id);
                handle.close();
              }
            })
          );
        }
      }
    });
    handle.body.append(search.root, results);
    handle.reposition();
    window.requestAnimationFrame(() => search.focus());
  }

  /**
   * The two bulk closes.
   *
   * They share one predicate, so the "not containing" action is the exact
   * negation of the "containing" one and the flags, casing and scope cannot
   * drift apart. Neither runs on an empty query or an invalid pattern, both show
   * the affected count and a reviewable preview first, and pinned tabs are
   * excluded unless the user deliberately includes them.
   */
  private openBulkClose(anchor: HTMLElement, containing: boolean): void {
    const handle = this.ctx?.overlay.open({
      anchor,
      placement: 'bottom-start',
      role: 'dialog',
      label: i18n.t(
        containing ? 'core.tabs.closeContaining' : 'core.tabs.closeNotContaining',
        'Close tabs'
      )
    });
    if (!handle) return;

    let includePinned = false;
    let matched: TabRecord[] = [];
    const preview = components.list({ label: 'core.tabs.closePreview' });
    const summary = el('p', { className: 'md-typescale-body-medium', attrs: { role: 'status' } });

    const recompute = (predicate: (value: string) => boolean, hasQuery: boolean, error: string | null): void => {
      preview.textContent = '';
      if (!hasQuery || error) {
        matched = [];
        summary.textContent = error ?? 'Enter some text first. Nothing will close on an empty query.';
        return;
      }
      const candidates = this.list().filter((record) => {
        if (record.permanent) return false;
        if (record.pinned && !includePinned) return false;
        const hit = predicate(record.title);
        return containing ? hit : !hit;
      });
      matched = candidates;
      const pinnedExcluded = this.list().filter((record) => record.pinned).length;
      summary.textContent = i18n.t('core.tabs.closePreview', '{count} tabs will close. {pinned} pinned tabs are excluded.', {
        values: { count: candidates.length, pinned: includePinned ? 0 : pinnedExcluded }
      });
      for (const record of candidates) {
        preview.append(components.listItem({ headline: record.title, leadingIcon: record.icon }));
      }
    };

    const search = createSearchBar({
      label: containing ? 'core.tabs.closeContaining' : 'core.tabs.closeNotContaining',
      sample: this.list().map((record) => record.title).join('\n'),
      onChange: (query) => recompute((value) => query.matches(value), query.text.trim() !== '' || query.regex, query.error)
    });

    const pinnedToggle = components.switchControl({
      label: 'core.tabs.includePinned',
      checked: false,
      onChange: (value) => {
        includePinned = value;
        const query = search.query();
        recompute((candidate) => query.matches(candidate), query.text.trim() !== '' || query.regex, query.error);
      }
    });

    const run = components.button({
      label: 'core.action.close',
      variant: 'filled',
      danger: true,
      onClick: async (event) => {
        if (matched.length === 0) return;
        const approved = await confirmService.request({
          action: `Close ${matched.length} tabs`,
          affected: matched.map((record) => record.title),
          irreversible:
            'The tabs are closed and their unsaved in-tab state is discarded. Every one of them can be reopened from the command palette afterwards.',
          anchor: event.currentTarget as HTMLElement
        });
        if (!approved) return;
        const failed: string[] = [];
        for (const record of matched) {
          if (record.permanent) {
            failed.push(record.title);
            continue;
          }
          this.close(record.id);
        }
        if (failed.length > 0) {
          this.ctx?.notify.warn(
            'Some tabs stayed open',
            `${failed.length} destinations are part of the application and were not closed: ${failed.join(', ')}`
          );
        }
        handle.close();
      }
    });

    handle.body.append(search.root, pinnedToggle.root, summary, preview, run);
    handle.reposition();
    window.requestAnimationFrame(() => search.focus());
    recompute(() => false, false, null);
  }
}

export const tabs = new TabsImpl();
