import { a11y, el } from './a11y';
import { components } from './components';
import { i18n } from './i18n';
import { locks } from './locks';
import { registry } from './registry';
import { createSearchBar } from './searchbar';
import { renderSettingControl } from './settingcontrol';
import { settings } from './settings';
import { tabs } from './tabs';
import type { AppContext, PaletteEntry, PaletteService } from './types';

/**
 * The command palette, on Ctrl+Shift+F.
 *
 * That exact chord, deliberately: it is the one discoverable global shortcut for
 * the palette here, and Ctrl+K is not kept as a competing default because two
 * shortcuts for one surface means neither is the one people learn.
 *
 * Rows are RICH. A setting result renders its real live control inline, wired to
 * the same store, validation and history as the settings surface, so a person
 * who found a value here can change it here. A destination result teleports:
 * it opens the owning tab, reveals the exact element, scrolls it into view,
 * focuses it and briefly highlights it — landing on a general page and leaving
 * the user to hunt does not count.
 */

const SIZE_KEY = 'palette.size';

class PaletteImpl implements PaletteService {
  private scrim: HTMLElement | null = null;
  private ctx: AppContext | null = null;
  private extra: PaletteEntry[] = [];
  private previousFocus: HTMLElement | null = null;

  attach(ctx: AppContext): void {
    this.ctx = ctx;
    window.addEventListener('keydown', (event) => {
      if (event.ctrlKey && event.shiftKey && (event.key === 'F' || event.key === 'f')) {
        event.preventDefault();
        this.toggle();
      }
    });
  }

  add(entries: PaletteEntry[]): () => void {
    this.extra.push(...entries);
    return () => {
      this.extra = this.extra.filter((entry) => !entries.includes(entry));
    };
  }

  isOpen(): boolean {
    return this.scrim !== null;
  }

  toggle(): void {
    if (this.isOpen()) this.close();
    else this.open();
  }

  close(): void {
    this.scrim?.remove();
    this.scrim = null;
    this.previousFocus?.focus({ preventScroll: true });
  }

  private size(): 'card' | 'full' {
    return settings.get<string>(SIZE_KEY, 'card') === 'full' ? 'full' : 'card';
  }

  private entries(): PaletteEntry[] {
    const ctx = this.ctx;
    const fromTabs: PaletteEntry[] = tabs.list().map((record) => ({
      id: `tab:${record.id}`,
      title: record.title,
      subtitle: record.group ? `Tab · ${record.group}` : 'Tab',
      icon: record.icon,
      kind: 'destination',
      teleport: { tabId: record.id }
    }));

    const fromSettings: PaletteEntry[] = [];
    for (const section of registry.settingsSections()) {
      for (const control of section.controls) {
        fromSettings.push({
          id: `setting:${control.id}`,
          title: i18n.t(control.label, control.label),
          subtitle: `${i18n.t(section.title, section.title)} · ${control.id}`,
          icon: section.icon,
          kind: 'setting',
          settingId: control.id,
          keywords: control.keywords,
          teleport: { tabId: 'core.settings', elementId: `setting-${control.id}` }
        });
      }
    }

    const fromDocs: PaletteEntry[] = registry.docs().map((article) => ({
      id: `doc:${article.id}`,
      title: article.title,
      subtitle: `Documentation · ${article.category}`,
      icon: 'book',
      kind: 'destination',
      run: () => ctx?.docsService.open(article.id)
    }));

    return [...registry.paletteEntries(), ...this.extra, ...fromTabs, ...fromSettings, ...fromDocs];
  }

  open(): void {
    if (this.isOpen() || !this.ctx) return;
    const ctx = this.ctx;
    this.previousFocus = document.activeElement as HTMLElement | null;

    const scrim = el('div', { className: 'md-palette-scrim' });
    const surface = el('div', {
      className: `md-palette${this.size() === 'full' ? ' md-palette--full' : ''}`,
      attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': i18n.t('core.palette.title', 'Command palette') }
    });

    const header = el('div', { className: 'md-palette__header' });
    const results = el('ul', { className: 'md-palette__results', attrs: { role: 'listbox' } });
    const footer = el('div', { className: 'md-palette__footer' });

    let active = 0;
    let visible: PaletteEntry[] = [];

    const draw = (matched: PaletteEntry[]): void => {
      visible = matched;
      results.textContent = '';
      if (matched.length === 0) {
        results.append(components.emptyState({ title: 'core.search.noMatches' }));
        footer.textContent = '';
        return;
      }
      matched.forEach((entry, index) => {
        const row = el('li', {
          className: 'md-palette__row',
          attrs: { role: 'option', 'aria-selected': String(index === active), 'data-active': String(index === active) }
        });
        if (entry.icon) row.append(components.icon(entry.icon, { size: 20 }));

        const main = el('button', { className: 'md-palette__row-main', attrs: { type: 'button' } });
        main.append(el('span', { className: 'md-typescale-body-large', text: i18n.t(entry.title, entry.title) }));
        const subtitleParts = [entry.subtitle, i18n.t(`core.palette.kind.${entry.kind}`, entry.kind)].filter(Boolean);
        if (entry.settingId && locks.isLocked(entry.settingId)) {
          subtitleParts.push(i18n.t('core.palette.locked', 'Locked'));
        }
        main.append(el('span', { className: 'md-palette__kind', text: subtitleParts.join(' · ') }));
        main.addEventListener('click', () => void this.activate(entry, ctx));
        row.append(main);

        // A setting row carries its real control, not a description of one.
        if (entry.kind === 'setting' && entry.settingId) {
          const control = registry.settingControl(entry.settingId);
          if (control) {
            const host = el('div', { className: 'md-palette__row-control' });
            if (locks.isLocked(entry.settingId) && !locks.isUnlocked(entry.settingId)) {
              host.append(
                components.button({
                  label: 'core.lock.locked',
                  variant: 'outlined',
                  icon: 'lock',
                  onClick: (event) => {
                    void locks.unlock(entry.settingId as string, event.currentTarget as HTMLElement).then((ok) => {
                      if (ok) draw(visible);
                    });
                  }
                })
              );
            } else {
              host.append(renderSettingControl(control, ctx));
            }
            row.append(host);
          }
        }

        results.append(row);
      });
      footer.textContent = i18n.t('core.search.matchCount', '{count} of {total} shown', {
        values: { count: matched.length, total: this.entries().length }
      });
    };

    const search = createSearchBar({
      label: 'core.palette.title',
      placeholder: 'core.palette.placeholder',
      sample: this.entries()
        .map((entry) => i18n.t(entry.title, entry.title))
        .join('\n'),
      onChange: (query) => {
        active = 0;
        draw(
          this.entries().filter((entry) =>
            query.matches(
              `${i18n.t(entry.title, entry.title)} ${entry.subtitle ?? ''} ${(entry.keywords ?? []).join(' ')} ${entry.settingId ?? ''}`
            )
          )
        );
      },
      onEscape: () => this.close()
    });

    const sizeToggle = components.segmentedButton({
      label: 'core.palette.title',
      value: this.size(),
      options: [
        { value: 'card', label: 'core.palette.sizeCard', icon: 'dock' },
        { value: 'full', label: 'core.palette.sizeFull', icon: 'world' }
      ],
      onChange: (value) => {
        settings.set(SIZE_KEY, value);
        surface.classList.toggle('md-palette--full', value === 'full');
      }
    });

    header.append(search.root, sizeToggle.root);
    surface.append(header, results, footer);
    scrim.append(surface);
    document.body.append(scrim);
    this.scrim = scrim;

    const release = a11y.trapFocus(surface);

    surface.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        release();
        this.close();
        return;
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        if (visible.length === 0) return;
        active = (active + (event.key === 'ArrowDown' ? 1 : -1) + visible.length) % visible.length;
        draw(visible);
        return;
      }
      if (event.key === 'Enter' && visible[active]) {
        event.preventDefault();
        void this.activate(visible[active], ctx);
      }
    });

    scrim.addEventListener('pointerdown', (event) => {
      if (event.target === scrim) {
        release();
        this.close();
      }
    });

    draw(this.entries());
    window.requestAnimationFrame(() => search.focus());
  }

  private async activate(entry: PaletteEntry, ctx: AppContext): Promise<void> {
    if (entry.run) {
      this.close();
      await entry.run();
      return;
    }
    if (entry.teleport) {
      this.close();
      ctx.tabs.teleport(entry.teleport.tabId, entry.teleport.elementId);
      return;
    }
    if (entry.settingId) {
      this.close();
      ctx.tabs.teleport('core.settings', `setting-${entry.settingId}`);
    }
  }
}

export const palette = new PaletteImpl();
