import type {
  AppContext,
  DocArticle,
  FeatureModule,
  PaletteEntry,
  Registry,
  SettingControl,
  SettingsSection,
  TabDefinition
} from './types';

/**
 * The integration point.
 *
 * A feature module is a plain object. It is discovered automatically — the
 * renderer globs `./features/{star}/index.ts` and registers every default export —
 * so adding a feature is adding one directory and touching nothing else.
 *
 * Everything a feature can contribute is declarative: tabs, settings sections,
 * palette entries, documentation articles and its own copy catalogue. The only
 * imperative hook is `init`, which runs once after registration is complete.
 */

export * from './types';

class RegistryImpl implements Registry {
  private readonly byId = new Map<string, FeatureModule>();
  private readonly tabIndex = new Map<string, TabDefinition>();
  private readonly settingIndex = new Map<string, SettingControl>();
  private readonly sectionIds = new Set<string>();
  private isReady = false;

  /**
   * Registers a feature module, or rejects it whole.
   *
   * Registration is all-or-nothing. Every check runs against staging maps first
   * and the live indexes are only written once the module has passed all of
   * them, so a module that is refused leaves the registry exactly as it found
   * it.
   *
   * That matters because features are written independently and the likeliest
   * integration failure is two of them inventing the same id. Validating as it
   * mutated would let a module that is refused for one duplicate setting id
   * still leave its tabs live in the strip — a tab belonging to a module that
   * `modules()` does not list, whose copy catalogue was never registered, so it
   * renders raw i18n keys — and would leave the section and setting ids it had
   * already claimed behind, refusing the next, innocent feature that used one
   * of them. One collision would become a corrupted strip plus an unrelated
   * lane rejected for a clash it did not cause.
   */
  register(module: FeatureModule): void {
    if (!module || typeof module !== 'object') {
      throw new Error('A feature module must be an object.');
    }
    if (typeof module.id !== 'string' || module.id.trim() === '') {
      throw new Error('A feature module needs a stable, non-empty id.');
    }
    if (this.byId.has(module.id)) {
      throw new Error(
        `Two feature modules claim the id "${module.id}". Ids are the directory name and must be unique.`
      );
    }

    // Staged, not committed. Nothing below touches the live indexes.
    const stagedTabs = new Map<string, TabDefinition>();
    const stagedSections = new Set<string>();
    const stagedSettings = new Map<string, SettingControl>();

    for (const tab of module.tabs ?? []) {
      if (this.tabIndex.has(tab.id) || stagedTabs.has(tab.id)) {
        throw new Error(`Two features register the tab id "${tab.id}" (the second is "${module.id}").`);
      }
      if (typeof tab.mount !== 'function') {
        throw new Error(`The tab "${tab.id}" in feature "${module.id}" has no mount function.`);
      }
      stagedTabs.set(tab.id, tab);
    }

    for (const section of module.settings ?? []) {
      if (this.sectionIds.has(section.id) || stagedSections.has(section.id)) {
        throw new Error(
          `Two features register the settings section "${section.id}" (the second is "${module.id}").`
        );
      }
      stagedSections.add(section.id);
      for (const control of section.controls) {
        if (this.settingIndex.has(control.id) || stagedSettings.has(control.id)) {
          throw new Error(
            `Two settings claim the id "${control.id}". A setting id is stable and unique across the whole application.`
          );
        }
        if (control.kind === 'custom' && typeof control.render !== 'function') {
          throw new Error(`The custom setting "${control.id}" has no render function.`);
        }
        if (control.kind === 'action' && typeof control.run !== 'function') {
          throw new Error(`The action setting "${control.id}" has no run function.`);
        }
        if (control.kind === 'select' && (!control.options || control.options.length === 0)) {
          throw new Error(`The select setting "${control.id}" has no options.`);
        }
        stagedSettings.set(control.id, control);
      }
    }

    // Every check passed. Commit.
    for (const [id, tab] of stagedTabs) this.tabIndex.set(id, tab);
    for (const id of stagedSections) this.sectionIds.add(id);
    for (const [id, control] of stagedSettings) this.settingIndex.set(id, control);
    this.byId.set(module.id, module);
  }

  modules(): FeatureModule[] {
    return [...this.byId.values()];
  }

  tabs(): TabDefinition[] {
    return [...this.tabIndex.values()].sort(
      (a, b) => (a.order ?? 1000) - (b.order ?? 1000) || a.id.localeCompare(b.id)
    );
  }

  tab(id: string): TabDefinition | null {
    return this.tabIndex.get(id) ?? null;
  }

  settingsSections(): SettingsSection[] {
    const sections: SettingsSection[] = [];
    for (const module of this.byId.values()) {
      for (const section of module.settings ?? []) sections.push(section);
    }
    return sections.sort((a, b) => (a.order ?? 1000) - (b.order ?? 1000) || a.id.localeCompare(b.id));
  }

  settingControl(id: string): SettingControl | null {
    return this.settingIndex.get(id) ?? null;
  }

  paletteEntries(): PaletteEntry[] {
    const entries: PaletteEntry[] = [];
    for (const module of this.byId.values()) {
      for (const entry of module.palette ?? []) entries.push(entry);
    }
    return entries;
  }

  docs(): DocArticle[] {
    const articles: DocArticle[] = [];
    for (const module of this.byId.values()) {
      for (const article of module.docs ?? []) articles.push(article);
    }
    return articles.sort((a, b) => a.category.localeCompare(b.category) || a.title.localeCompare(b.title));
  }

  ready(): boolean {
    return this.isReady;
  }

  /** Runs every module's `init`. Called once by the boot sequence. */
  initializeAll(ctx: AppContext): void {
    for (const module of this.byId.values()) {
      if (typeof module.init !== 'function') continue;
      try {
        module.init(ctx);
      } catch (error) {
        // One feature failing to initialize must not take the whole window down.
        // It is reported so the failure is visible rather than silent.
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Feature "${module.id}" failed to initialize: ${message}`);
        ctx.notify.error(
          ctx.t('core.feature.initFailed.title', 'A feature did not start'),
          ctx.t('core.feature.initFailed.body', '{id} reported: {message}', {
            values: { id: module.id, message }
          })
        );
      }
    }
    this.isReady = true;
  }
}

export const registry = new RegistryImpl();

/** Registers a feature module. Feature code never calls this directly — the
 *  boot sequence discovers the default export and registers it. */
export function register(module: FeatureModule): void {
  registry.register(module);
}

/**
 * Type-checks a feature module at its definition site without widening it.
 *
 * A feature's `index.ts` ends with `export default defineFeature({ ... })`, so a
 * missing field is a compile error in the feature's own file rather than a
 * runtime surprise at boot.
 */
export function defineFeature(module: FeatureModule): FeatureModule {
  return module;
}
