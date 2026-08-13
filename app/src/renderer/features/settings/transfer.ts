import type {
  AppContext,
  ExportFormat,
  SettingControl,
  SettingsProvenance,
  SettingsSection
} from '../../core/registry';
import { describeValue } from './rows';

/**
 * Exporting and importing the settings.
 *
 * Export offers every format the shared exporter supports rather than one
 * favourite, and it reports what a chosen format cannot carry BEFORE anything is
 * written — choosing CSV for a setting that holds a structured value should tell
 * you the column becomes JSON text inside one cell, not let you find out later.
 *
 * Credentials, the personal-vocabulary cache and the lock verifiers are never
 * included, and the file itself says so rather than silently omitting them.
 */

const OMITTED_PREFIXES = ['vocabulary.', 'school.unlock', 'locks.'];

const IMPORT_LIMITS = {
  maxBytes: 1024 * 1024,
  maxKeys: 5000
} as const;

export interface ExportableSetting {
  id: string;
  label: string;
  section: string;
  kind: string;
  value: unknown;
  provenance: SettingsProvenance;
  shippedDefault: unknown;
}

export interface ExportScope {
  id: string;
  /** i18n key for the visible label. */
  label: string;
  collect(): ExportableSetting[];
}

export function exportableFrom(
  ctx: AppContext,
  section: SettingsSection,
  control: SettingControl
): ExportableSetting {
  return {
    id: control.id,
    label: ctx.i18n.t(control.label, control.label),
    section: ctx.i18n.t(section.title, section.title),
    kind: control.kind,
    value: ctx.settings.get(control.id, control.defaultValue),
    provenance: ctx.settings.provenanceOf(control.id),
    shippedDefault: control.defaultValue
  };
}

export function isOmitted(id: string): boolean {
  return OMITTED_PREFIXES.some((prefix) => id.startsWith(prefix));
}

/* ------------------------------------------------------------------ */
/* Export                                                              */
/* ------------------------------------------------------------------ */

export function openExportPanel(ctx: AppContext, anchor: HTMLElement, scopes: ExportScope[]): void {
  const { components } = ctx;
  const t = (key: string, fallback: string, values?: Record<string, string | number>): string =>
    ctx.t(key, fallback, values ? { values } : undefined);

  const handle = ctx.overlay.open({
    anchor,
    placement: 'bottom-end',
    role: 'dialog',
    label: t('settings.export.title', 'Export settings'),
    resizeKey: 'settings.exportPanel',
    dragKey: 'settings.exportPanel'
  });

  let scopeId = scopes[0]?.id ?? 'all';
  let format: ExportFormat = 'json';

  const description = document.createElement('p');
  description.className = 'md-typescale-body-small';
  description.textContent = t(
    'settings.export.description',
    'Writes the settings, their provenance and their shipped defaults to a file in the format you choose.'
  );

  const summary = document.createElement('p');
  summary.className = 'md-typescale-body-medium';
  summary.setAttribute('role', 'status');

  const losses = document.createElement('p');
  losses.className = 'md-typescale-body-small';

  const omitted = document.createElement('p');
  omitted.className = 'md-typescale-body-small';
  omitted.textContent = t(
    'settings.export.omitted',
    'Credentials, the personal vocabulary cache and the lock verifiers are not included in this export.'
  );

  const records = (): Array<Record<string, unknown>> => {
    const scope = scopes.find((candidate) => candidate.id === scopeId) ?? scopes[0];
    const collected = (scope?.collect() ?? []).filter((entry) => !isOmitted(entry.id));
    return [
      ...collected.map((entry) => ({ ...entry })),
      {
        id: '_notice',
        label: 'Export notice',
        section: '',
        kind: 'text',
        value: t(
          'settings.export.omitted',
          'Credentials, the personal vocabulary cache and the lock verifiers are not included in this export.'
        ),
        provenance: 'default' as SettingsProvenance,
        shippedDefault: null
      }
    ];
  };

  const refresh = (): void => {
    const rows = records();
    summary.textContent = t('settings.export.count', '{count} settings will be written.', {
      count: Math.max(0, rows.length - 1)
    });
    const preflight = ctx.exporter.preflight(rows, format);
    losses.textContent =
      preflight.losses.length === 0
        ? t('settings.export.noLosses', '{format} carries every field faithfully.', { format: format.toUpperCase() })
        : t('settings.export.losses', '{format} cannot carry every field faithfully. These become text: {fields}', {
            format: format.toUpperCase(),
            fields: preflight.losses.map((loss) => loss.field).join(', ')
          });
    losses.classList.toggle('settings-warning', preflight.losses.length > 0);
  };

  const scopeControl = components.select({
    label: 'settings.export.scope',
    options: scopes.map((scope) => ({ value: scope.id, label: scope.label })),
    value: scopeId,
    onChange: (value) => {
      scopeId = value;
      refresh();
    }
  });

  const formatControl = components.select({
    label: 'settings.export.format',
    options: ctx.exporter.formats().map((candidate) => ({ value: candidate, label: candidate.toUpperCase() })),
    value: format,
    onChange: (value) => {
      format = value as ExportFormat;
      refresh();
    }
  });

  const save = components.button({
    label: 'core.action.export',
    variant: 'filled',
    icon: 'download',
    onClick: async () => {
      const rows = records();
      try {
        const path = await ctx.exporter.save(rows, format, {
          name: 'settings',
          defaultFileName: `settings.${format === 'markdown' ? 'md' : format}`
        });
        if (!path) {
          ctx.notify.info(t('settings.export.cancelled', 'Nothing was written.'));
          return;
        }
        void ctx.history.record('Exported settings', 'settings', {
          format,
          scope: scopeId,
          count: rows.length - 1,
          path
        });
        ctx.notify.success(t('settings.export.saved', 'Exported to {path}', { path }), undefined);
        const openIn = await ctx.studio.editor.open(path);
        if (!openIn.ok) {
          // Not a failure of the export: the file is on disk either way, and the
          // reason the editor did not open is worth saying rather than hiding.
          ctx.notify.info(t('settings.export.openInEditor', 'Open the export in the editor'), openIn.error);
        }
        handle.close();
      } catch (error) {
        ctx.notify.error(
          t('settings.export.title', 'Export settings'),
          error instanceof Error ? error.message : String(error)
        );
      }
    }
  });

  handle.body.append(description, scopeControl.root, formatControl.root, summary, losses, omitted, save);
  refresh();
  handle.reposition();
}

/* ------------------------------------------------------------------ */
/* Import                                                              */
/* ------------------------------------------------------------------ */

interface ParsedImport {
  ok: true;
  values: Array<[string, unknown]>;
}

interface RefusedImport {
  ok: false;
  error: string;
}

/**
 * Reads either shape this application can legitimately produce: the export this
 * panel writes (`records`), and the raw settings document (`values`). A flat
 * object of id to value is accepted too, because that is what somebody editing
 * the file by hand will most naturally write.
 */
export function parseSettingsImport(text: string): ParsedImport | RefusedImport {
  const bytes = new TextEncoder().encode(text).byteLength;
  if (bytes > IMPORT_LIMITS.maxBytes) {
    return { ok: false, error: `The file is ${bytes} bytes, beyond the ${IMPORT_LIMITS.maxBytes}-byte limit.` };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'The file is not valid JSON.' };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, error: 'The top level must be a JSON object.' };
  }
  const document = parsed as Record<string, unknown>;

  const collect = (pairs: Array<[string, unknown]>): ParsedImport | RefusedImport => {
    if (pairs.length > IMPORT_LIMITS.maxKeys) {
      return { ok: false, error: `The file holds ${pairs.length} keys, beyond the ${IMPORT_LIMITS.maxKeys} limit.` };
    }
    for (const [key] of pairs) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        return { ok: false, error: 'A key used a reserved object key. Nothing was applied.' };
      }
    }
    return { ok: true, values: pairs.filter(([key]) => !isOmitted(key) && key !== '_notice') };
  };

  if (Array.isArray(document.records)) {
    const pairs: Array<[string, unknown]> = [];
    for (const raw of document.records) {
      if (typeof raw !== 'object' || raw === null) continue;
      const record = raw as Record<string, unknown>;
      if (typeof record.id !== 'string') continue;
      // Only a value somebody actually set is carried across. A row exported
      // while it was on its built-in value carries no instruction.
      if (record.provenance === 'default') continue;
      pairs.push([record.id, record.value]);
    }
    return collect(pairs);
  }

  if (typeof document.values === 'object' && document.values !== null && !Array.isArray(document.values)) {
    return collect(Object.entries(document.values as Record<string, unknown>));
  }

  const flat = Object.entries(document).filter(([key]) => !key.startsWith('_') && key !== 'schemaVersion');
  if (flat.length === 0) {
    return { ok: false, error: 'The file carried no settings: it has neither "records" nor "values".' };
  }
  return collect(flat);
}

export function openImportFlow(ctx: AppContext, anchor: HTMLElement, knownIds: () => Set<string>): void {
  const { components } = ctx;
  const t = (key: string, fallback: string, values?: Record<string, string | number>): string =>
    ctx.t(key, fallback, values ? { values } : undefined);

  const handle = ctx.overlay.open({
    anchor,
    placement: 'bottom-end',
    role: 'dialog',
    label: t('settings.import.title', 'Import settings'),
    resizeKey: 'settings.importPanel',
    dragKey: 'settings.importPanel'
  });

  let pending: Array<[string, unknown]> = [];
  let sourcePath = '';

  const description = document.createElement('p');
  description.className = 'md-typescale-body-small';
  description.textContent = t(
    'settings.import.description',
    'Reads a settings file this application exported as JSON and applies the values it carries.'
  );

  const status = document.createElement('p');
  status.className = 'md-typescale-body-medium';
  status.setAttribute('role', 'status');
  status.textContent = t('settings.import.choose', 'Choose a settings file…');

  const unknownLine = document.createElement('p');
  unknownLine.className = 'md-typescale-body-small';

  const preview = components.list({ label: 'settings.import.title' });

  const apply = components.button({
    label: 'settings.import.apply',
    variant: 'filled',
    icon: 'upload',
    disabled: true,
    disabledReason: 'No file has been read yet, so there is nothing to apply.',
    onClick: async () => {
      if (pending.length === 0) return;
      const approved = await ctx.confirm.request({
        action: t('settings.import.title', 'Import settings'),
        affected: pending.slice(0, 40).map(([key, value]) => `${key} → ${describeValue(value)}`),
        irreversible:
          'The current value of each of these settings is overwritten. Every one of the replacements is written to local history first, so the previous values can be read back from the history tab, but the live values are gone the moment this runs.',
        anchor: apply
      });
      if (!approved) return;
      let applied = 0;
      for (const [key, value] of pending) {
        ctx.settings.set(key, value, 'imported');
        applied += 1;
      }
      await ctx.settings.flush();
      void ctx.history.record('Imported settings', 'settings', { path: sourcePath, count: applied });
      ctx.notify.success(t('settings.import.applied', '{count} settings were applied.', { count: applied }));
      handle.close();
    }
  });

  const choose = components.button({
    label: 'settings.import.choose',
    variant: 'tonal',
    icon: 'folder',
    onClick: async () => {
      const picked = await ctx.studio.dialog.openFile({ filters: [{ name: 'JSON', extensions: ['json'] }] });
      if (!picked.ok || !picked.value || !picked.value[0]) return;
      sourcePath = picked.value[0];
      const read = await ctx.studio.fs.readText(sourcePath, IMPORT_LIMITS.maxBytes);
      if (!read.ok) {
        status.textContent = t('settings.import.invalid', 'That file was refused: {reason}', { reason: read.error });
        apply.disabled = true;
        return;
      }
      const parsed = parseSettingsImport(read.value);
      if (!parsed.ok) {
        status.textContent = t('settings.import.invalid', 'That file was refused: {reason}', { reason: parsed.error });
        pending = [];
        apply.disabled = true;
        preview.textContent = '';
        unknownLine.textContent = '';
        return;
      }
      const known = knownIds();
      const unknown = parsed.values.filter(([key]) => !known.has(key));
      const same = parsed.values.filter(
        ([key, value]) => known.has(key) && JSON.stringify(ctx.settings.get(key)) === JSON.stringify(value)
      );
      pending = parsed.values.filter(
        ([key, value]) => known.has(key) && JSON.stringify(ctx.settings.get(key)) !== JSON.stringify(value)
      );

      status.textContent = t(
        'settings.import.preview',
        '{apply} values will be applied, {unknown} keys are not known to this build and {same} already match.',
        { apply: pending.length, unknown: unknown.length, same: same.length }
      );
      unknownLine.textContent =
        unknown.length === 0
          ? ''
          : t('settings.import.unknownList', 'Not known to this build: {keys}', {
              keys: unknown
                .slice(0, 20)
                .map(([key]) => key)
                .join(', ')
            });

      preview.textContent = '';
      for (const [key, value] of pending.slice(0, 200)) {
        preview.append(
          components.listItem({
            headline: key,
            supporting: `${describeValue(ctx.settings.get(key))} → ${describeValue(value)}`,
            leadingIcon: 'edit'
          })
        );
      }
      if (pending.length === 0) {
        preview.append(components.emptyState({ title: 'settings.import.nothing' }));
      }
      apply.disabled = pending.length === 0;
      apply.title = apply.disabled ? t('settings.import.nothing', 'Nothing to apply.') : '';
    }
  });

  handle.body.append(description, choose, status, unknownLine, preview, apply);
  handle.reposition();
}

/* ------------------------------------------------------------------ */
/* Global reset                                                        */
/* ------------------------------------------------------------------ */

export async function resetEverySetting(ctx: AppContext, anchor: HTMLElement): Promise<void> {
  const t = (key: string, fallback: string, values?: Record<string, string | number>): string =>
    ctx.t(key, fallback, values ? { values } : undefined);

  const stored = ctx.settings.keys().filter((key) => ctx.settings.provenanceOf(key) !== 'default');
  if (stored.length === 0) {
    ctx.notify.info(t('settings.reset.nothing', 'Nothing was stored, so nothing changed.'));
    return;
  }

  const approved = await ctx.confirm.request({
    action: t('settings.reset.all', 'Reset every setting'),
    affected: stored.slice(0, 50),
    irreversible:
      'Every stored preference is removed from the settings file, so the application falls back to the value this build ships with. Credentials, toy locks and the local history are not touched, and each removal is written to local history first, so the previous values can be read back from the history tab.',
    anchor
  });
  if (!approved) return;

  const before = stored.map((key) => ({ id: key, value: ctx.settings.get(key) }));
  ctx.settings.resetAll();
  await ctx.settings.flush();
  void ctx.history.record('Reset every setting', 'settings', { count: before.length, previous: before });
  ctx.notify.success(
    t('settings.reset.done', '{count} stored values were removed. The application is now using its built-in values.', {
      count: before.length
    })
  );
}
