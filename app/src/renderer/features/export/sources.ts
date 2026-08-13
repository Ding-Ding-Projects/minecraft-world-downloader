import type { AppContext } from '../../core/registry';

/**
 * The catalogue of everything that can be taken away.
 *
 * The contract is the plain one: if a surface can show it, the user can export
 * it. This module holds the sources the shell itself owns — settings, history,
 * notifications, navigation, documentation, appearance, locks and the machine
 * facts — and offers `registerExportSource` so any other feature can add its own
 * without either module importing the other.
 *
 * Two rules are enforced here rather than left to each caller.
 *
 * No secret ever becomes an export. The credential vault contributes its account
 * KEYS and nothing else: no value, no length, no hint. A source that touches
 * anything sensitive says so in its own omission line, and the surface repeats
 * that line before a single byte is written.
 *
 * The omission line is written for the mode the application is actually in.
 * While School mode is on, the suppressed capabilities are not named — an
 * omission notice that says "the personal vocabulary cache is not included"
 * announces the existence of a capability that is supposed to behave as though
 * it were not installed.
 */

export type SourceShape = 'tabular' | 'structured' | 'prose';

export interface RecordsPayload {
  kind: 'records';
  records: Array<Record<string, unknown>>;
}

export interface DocumentPayload {
  kind: 'document';
  title: string;
  /** Markdown source. Rendered by the shared renderer for the HTML form. */
  markdown: string;
}

export type ExportPayload = RecordsPayload | DocumentPayload;

export interface ExportSource {
  /** Stable and unique. Becomes the file name inside a folder or archive. */
  id: string;
  /** i18n key or literal name. */
  name: string;
  /** i18n key or literal one-line description of what the records are. */
  description: string;
  category: string;
  shape: SourceShape;
  /**
   * True when the records, while carrying no secret value, still name things a
   * user may not want in a shared archive. Such a source is never added to an
   * archive without an explicit, separate acknowledgement.
   */
  sensitive?: boolean;
  /** What this export deliberately leaves out, written for the current mode. */
  omits?(schoolMode: boolean): string | null;
  /** Reads the data. Called on demand and again on every refresh. */
  load(ctx: AppContext): Promise<ExportPayload>;
}

/* ------------------------------------------------------------------ */
/* Registration                                                        */
/* ------------------------------------------------------------------ */

const registered = new Map<string, ExportSource>();

/**
 * Adds a source to the export catalogue.
 *
 * A feature calls this from its own `init`. Registering the same id twice
 * replaces the earlier one rather than silently keeping a stale reader, because
 * a feature that re-initializes must not end up exporting from a dead closure.
 */
export function registerExportSource(source: ExportSource): () => void {
  registered.set(source.id, source);
  return () => {
    if (registered.get(source.id) === source) registered.delete(source.id);
  };
}

/**
 * The late-registration bridge.
 *
 * A feature that loads after this one, or that would rather not import it at
 * all, can push a source onto `globalThis.studioExportSources` and it is picked
 * up on the next listing. Documented in `docs/features/export.md`.
 */
interface GlobalWithSources {
  studioExportSources?: ExportSource[];
}

function drainGlobalQueue(): void {
  const holder = globalThis as unknown as GlobalWithSources;
  const queue = holder.studioExportSources;
  if (!Array.isArray(queue) || queue.length === 0) return;
  for (const source of queue.splice(0, queue.length)) {
    if (source && typeof source.id === 'string' && typeof source.load === 'function') {
      registered.set(source.id, source);
    }
  }
}

export function listExportSources(ctx: AppContext): ExportSource[] {
  drainGlobalQueue();
  return [...builtInSources(ctx), ...registered.values()].sort(
    (left, right) => left.category.localeCompare(right.category) || left.id.localeCompare(right.id)
  );
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function records(rows: Array<Record<string, unknown>>): RecordsPayload {
  return { kind: 'records', records: rows };
}

/** Unwraps a bridge result, turning a refusal into a readable failure. */
async function unwrap<T>(promise: Promise<{ ok: true; value: T } | { ok: false; error: string }>): Promise<T> {
  const result = await promise;
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

/** Settings keys that are a local cache rather than a setting anybody chose. */
const CACHE_KEY_PREFIXES = ['vocabulary.'];

function isCacheKey(id: string): boolean {
  return CACHE_KEY_PREFIXES.some((prefix) => id.startsWith(prefix));
}

/* ------------------------------------------------------------------ */
/* The shell's own sources                                             */
/* ------------------------------------------------------------------ */

function builtInSources(ctx: AppContext): ExportSource[] {
  return [
    {
      id: 'settings-values',
      name: 'Settings and their values',
      description: 'Every setting the application holds, with its current value, where that value came from, and the compiled-in default.',
      category: 'Settings',
      shape: 'tabular',
      omits: (schoolMode) =>
        schoolMode
          ? 'Local caches that are not settings, and every credential, which lives in the operating system credential store and never in a settings file.'
          : 'The personal-vocabulary cache and every credential. Credentials live in the operating system credential store and never in a settings file.',
      async load(app) {
        const rows: Array<Record<string, unknown>> = [];
        for (const id of app.settings.keys().sort()) {
          if (isCacheKey(id)) continue;
          const control = app.registry.settingControl(id);
          rows.push({
            id,
            label: control ? app.t(control.label, control.label) : '',
            kind: control?.kind ?? 'unknown',
            value: app.settings.get(id, null),
            provenance: app.settings.provenanceOf(id),
            default: app.settings.defaultOf(id)
          });
        }
        return records(rows);
      }
    },
    {
      id: 'settings-inventory',
      name: 'Settings inventory',
      description: 'Every registered setting control: which feature owns it, what kind of control it is, and its explanation.',
      category: 'Settings',
      shape: 'tabular',
      async load(app) {
        const rows: Array<Record<string, unknown>> = [];
        for (const section of app.registry.settingsSections()) {
          for (const control of section.controls) {
            rows.push({
              section: section.id,
              sectionTitle: app.t(section.title, section.title),
              id: control.id,
              label: app.t(control.label, control.label),
              description: app.t(control.description, control.description),
              kind: control.kind,
              default: control.defaultValue,
              lockable: control.lockable !== false,
              keywords: control.keywords ?? []
            });
          }
        }
        return records(rows);
      }
    },
    {
      id: 'history-entries',
      name: 'Local version history',
      description: 'The append-only history of every recorded change, newest first, with the redacted payload each entry carries.',
      category: 'History',
      shape: 'structured',
      omits: () =>
        'Nothing beyond what the history itself already redacts: no credential, no secret and no vocabulary content is ever written into an entry.',
      async load(app) {
        const entries = await app.history.list({ limit: 5000 });
        return records(
          entries.map((entry) => ({
            id: entry.id,
            timestamp: entry.timestamp,
            action: entry.action,
            source: entry.source,
            payload: entry.payload
          }))
        );
      }
    },
    {
      id: 'history-actions',
      name: 'History actions and counts',
      description: 'The distinct action labels actually present in the history, with how many entries carry each one.',
      category: 'History',
      shape: 'tabular',
      async load(app) {
        const actions = await app.history.actions();
        return records(actions.map((action) => ({ action: action.action, count: action.count })));
      }
    },
    {
      id: 'history-status',
      name: 'History repository status',
      description: 'Which backend the history is using, where it lives, how many entries it holds, and why it is degraded when it is.',
      category: 'History',
      shape: 'structured',
      async load(app) {
        const status = await app.history.status();
        return records([
          {
            backend: status.backend,
            path: status.path,
            entryCount: status.entryCount,
            degradedReason: status.degradedReason ?? null
          }
        ]);
      }
    },
    {
      id: 'notifications',
      name: 'Notification centre',
      description: 'Every notification raised this session, dismissed ones included, with severity, source and timestamps.',
      category: 'Notifications',
      shape: 'tabular',
      async load(app) {
        return records(
          app.notify.history().map((record) => ({
            id: record.id,
            createdAt: record.createdAt,
            dismissedAt: record.dismissedAt,
            severity: record.severity,
            source: record.source,
            title: record.title,
            body: record.body,
            progress: record.progress
          }))
        );
      }
    },
    {
      id: 'tabs',
      name: 'Open tabs',
      description: 'Every registered tab with its group, pinned state and order, exactly as the strip has it now.',
      category: 'Navigation',
      shape: 'tabular',
      async load(app) {
        return records(
          app.tabs.list().map((tab) => ({
            id: tab.id,
            title: app.t(tab.title, tab.title),
            icon: tab.icon,
            group: tab.group,
            pinned: tab.pinned,
            order: tab.order,
            permanent: tab.permanent
          }))
        );
      }
    },
    {
      id: 'tab-groups',
      name: 'Tab groups',
      description: 'Every tab group with its name, colour, collapsed state and order.',
      category: 'Navigation',
      shape: 'tabular',
      async load(app) {
        return records(
          app.tabs.groups().map((group) => ({
            id: group.id,
            name: group.name,
            color: group.color,
            collapsed: group.collapsed,
            order: group.order
          }))
        );
      }
    },
    {
      id: 'palette-entries',
      name: 'Command palette entries',
      description: 'Every command, destination and setting the palette can reach, with the keywords that find each one.',
      category: 'Navigation',
      shape: 'tabular',
      async load(app) {
        return records(
          app.registry.paletteEntries().map((entry) => ({
            id: entry.id,
            title: app.t(entry.title, entry.title),
            subtitle: entry.subtitle ? app.t(entry.subtitle, entry.subtitle) : '',
            kind: entry.kind,
            settingId: entry.settingId ?? null,
            teleportTab: entry.teleport?.tabId ?? null,
            teleportElement: entry.teleport?.elementId ?? null,
            keywords: entry.keywords ?? []
          }))
        );
      }
    },
    {
      id: 'documentation-index',
      name: 'Documentation index',
      description: 'Every bundled article with its category, its length and the articles it suggests next.',
      category: 'Documentation',
      shape: 'tabular',
      async load(app) {
        return records(
          app.registry.docs().map((article) => ({
            id: article.id,
            title: article.title,
            category: article.category,
            characters: article.body.length,
            related: article.related
          }))
        );
      }
    },
    {
      id: 'documentation-book',
      name: 'The whole documentation',
      description: 'Every bundled article, in category order, as one document you can read outside the application.',
      category: 'Documentation',
      shape: 'prose',
      async load(app) {
        const articles = app.registry.docs();
        const lines: string[] = [];
        let category = '';
        for (const article of articles) {
          if (article.category !== category) {
            category = article.category;
            lines.push('', `## ${category}`, '');
          }
          lines.push(`### ${article.title}`, '', article.body, '');
          if (article.related.length > 0) {
            lines.push(`*Suggested next: ${article.related.join(', ')}*`, '');
          }
        }
        if (articles.length === 0) lines.push('No article has been registered.', '');
        return {
          kind: 'document',
          title: 'Documentation',
          markdown: lines.join('\n')
        };
      }
    },
    {
      id: 'features',
      name: 'Installed features',
      description: 'Every registered feature module with what it contributes: tabs, settings sections, palette entries and articles.',
      category: 'System',
      shape: 'tabular',
      async load(app) {
        return records(
          app.registry.modules().map((module) => ({
            id: module.id,
            name: module.name,
            description: module.description,
            tabs: (module.tabs ?? []).length,
            settingsSections: (module.settings ?? []).length,
            paletteEntries: (module.palette ?? []).length,
            docs: (module.docs ?? []).length
          }))
        );
      }
    },
    {
      id: 'theme',
      name: 'Theme state',
      description: 'The theme actually rendering now: mode, seed colour, contrast, density, typography and reduced motion.',
      category: 'Appearance',
      shape: 'structured',
      async load(app) {
        const state = app.theme.state();
        return records([{ ...state }]);
      }
    },
    {
      id: 'appearance-overrides',
      name: 'Appearance overrides and presets',
      description: 'Every per-element appearance override you have set, plus the named presets available. Re-importable through the appearance editor.',
      category: 'Appearance',
      shape: 'structured',
      async load(app) {
        let parsed: unknown = null;
        try {
          parsed = JSON.parse(app.appearance.exportThemeJson());
        } catch (error) {
          throw new Error(
            `The appearance editor produced a theme document this export could not read: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
        return records([
          {
            theme: parsed,
            presets: app.appearance.presets()
          }
        ]);
      }
    },
    {
      id: 'locks',
      name: 'Toy locks',
      description: 'Which elements are locked, by which method, and for how long an unlock lasts.',
      category: 'Appearance',
      shape: 'tabular',
      omits: () =>
        'Every credential. No password, no password hash, no one-time-code secret and no hint about any of them is ever written here.',
      async load(app) {
        return records(
          app.locks.list().map((lock) => ({
            target: lock.target,
            label: lock.label,
            method: lock.method,
            createdAt: lock.createdAt,
            unlockMinutes: lock.unlockMinutes
          }))
        );
      }
    },
    {
      id: 'application-information',
      name: 'Application information',
      description: 'Version, package identity, platform, runtime versions and the exact directories this build uses.',
      category: 'System',
      shape: 'structured',
      async load(app) {
        const info = app.studio.info;
        return records([
          {
            packageName: info.packageName,
            productName: info.productName,
            version: info.version,
            platform: info.platform,
            arch: info.arch,
            isPackaged: info.isPackaged,
            isDevelopment: info.isDevelopment,
            userDataDir: info.userDataDir,
            historyDir: info.historyDir,
            logsDir: info.logsDir,
            versions: info.versions,
            startedAt: new Date(info.startedAt).toISOString()
          }
        ]);
      }
    },
    {
      id: 'network-rules',
      name: 'Outbound network rules',
      description: 'Every host allowed out of this application, which feature asked for it and why. Empty is the normal state.',
      category: 'System',
      shape: 'tabular',
      async load(app) {
        const rules = await unwrap(app.studio.http.rules());
        return records(rules.map((rule) => ({ ...rule })));
      }
    },
    {
      id: 'processes',
      name: 'Child processes',
      description: 'Every process this application has started this session, whether it is still running, and how it ended.',
      category: 'System',
      shape: 'tabular',
      async load(app) {
        const list = await unwrap(app.studio.process.list());
        return records(list.map((entry) => ({ ...entry })));
      }
    },
    {
      id: 'editors',
      name: 'Detected editors',
      description: 'Which external editors were found on this machine, where, and whether each can open a folder as a workspace root.',
      category: 'System',
      shape: 'tabular',
      async load(app) {
        const candidates = await unwrap(app.studio.editor.detect());
        return records(candidates.map((candidate) => ({ ...candidate })));
      }
    },
    {
      id: 'vault-accounts',
      name: 'Credential vault account keys',
      description: 'The names under which secrets are stored. The names only.',
      category: 'Security',
      shape: 'tabular',
      sensitive: true,
      omits: () =>
        'Every secret value, and every property of one. Not the value, not its length, not its composition, not a hash of it. This export is a list of names.',
      async load(app) {
        const accounts = await unwrap(app.studio.vault.listAccounts());
        const status = await unwrap(app.studio.vault.status());
        return records(
          accounts.map((account) => ({ account, backend: status.backend, encryptionAvailable: status.encryptionAvailable }))
        );
      }
    },
    {
      id: 'export-formats',
      name: 'Export format catalogue',
      description: 'Every format this surface can write, what it is for, which shapes it carries and whether it has nesting.',
      category: 'Export',
      shape: 'tabular',
      async load() {
        const { FORMATS } = await import('./formats');
        return records(
          FORMATS.map((format) => ({
            id: format.id,
            name: format.name,
            extension: format.extension,
            mimeType: format.mimeType,
            shapes: format.shapes,
            nesting: !format.flat,
            schemaOnly: format.schemaOnly === true,
            purpose: format.purpose
          }))
        );
      }
    }
  ];
}
