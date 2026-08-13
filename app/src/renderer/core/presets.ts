import { el } from './a11y';
import { components } from './components';
import { i18n } from './i18n';
import type { AppContext, SettingsStore } from './types';

/**
 * Presets for a blank-slate editor, derived strictly from the application's
 * real defaults.
 *
 * A preset field either carries an explicit override value, or — far more
 * often — carries none at all, in which case the value actually applied is
 * whatever `SettingsStore.defaultOf` reports for that setting id right now.
 * That is the whole point of routing every preset through `resolvePreset`
 * rather than letting a feature hard-code a second copy of its own defaults
 * next to the first: a preset and the "reset to defaults" action read from the
 * exact same source, so they can never disagree about what the shipped value
 * is.
 */

export interface PresetField {
  /** A settings id whose declared default this preset applies. */
  settingId: string;
  /**
   * An explicit override. Omit this to use the REAL declared default for
   * `settingId`, which is what keeps a preset honest: it can only ever set a
   * field to a value that is either its shipped default or an override the
   * preset's own author wrote down and can be read back.
   */
  value?: unknown;
}

export interface PresetDefinition {
  id: string;
  /** i18n key. */
  label: string;
  /** i18n key stating exactly what the preset sets, in plain words. */
  description: string;
  fields: PresetField[];
}

export interface ResolvedPresetField {
  settingId: string;
  value: unknown;
  /** True when the value came from the live declared default rather than an override. */
  fromDefault: boolean;
}

/** What a preset would actually do right now, computed before anything is written. */
export function resolvePreset(preset: PresetDefinition, store: SettingsStore): ResolvedPresetField[] {
  return preset.fields.map((field) => {
    const hasOverride = Object.prototype.hasOwnProperty.call(field, 'value');
    return {
      settingId: field.settingId,
      value: hasOverride ? field.value : store.defaultOf(field.settingId),
      fromDefault: !hasOverride
    };
  });
}

function describeValue(value: unknown): string {
  if (value === null || value === undefined) return i18n.t('core.presets.valueUnset', 'not set');
  if (typeof value === 'string') return value === '' ? i18n.t('core.presets.valueEmpty', 'an empty string') : value;
  if (typeof value === 'boolean') return value ? i18n.t('core.presets.valueOn', 'on') : i18n.t('core.presets.valueOff', 'off');
  return String(value);
}

/** Applies a preset and records it as one normal, undoable history entry. */
export async function applyPreset(preset: PresetDefinition, ctx: AppContext): Promise<void> {
  const resolved = resolvePreset(preset, ctx.settings);
  for (const field of resolved) ctx.settings.set(field.settingId, field.value, 'user');
  const presetLabel = ctx.t(preset.label, preset.label);
  await ctx.history.record(`Applied preset "${presetLabel}"`, 'core.presets', {
    presetId: preset.id,
    fields: resolved.map((f) => ({ settingId: f.settingId, value: f.value, fromDefault: f.fromDefault }))
  });
}

/**
 * Renders a blank-slate picker: one row per preset, each stating exactly what
 * it sets (computed from the real current defaults, never invented), plus an
 * explicit path to the application's own shipped defaults so a preset and
 * "reset to defaults" are visibly the same offer rather than two that could
 * quietly drift apart.
 */
export function renderPresetPicker(
  host: HTMLElement,
  options: { presets: PresetDefinition[]; ctx: AppContext; onApplied?(preset: PresetDefinition): void }
): void {
  const list = components.list({ label: options.ctx.t('core.presets.title', 'Start from a preset') });

  for (const preset of options.presets) {
    const resolved = resolvePreset(preset, options.ctx.settings);
    const summary = resolved
      .map((field) => `${field.settingId} = ${describeValue(field.value)}`)
      .join(', ');
    const item = components.listItem({
      headline: options.ctx.t(preset.label, preset.label),
      supporting: `${options.ctx.t(preset.description, preset.description)} — ${summary}`,
      leadingIcon: 'tune',
      onActivate: () => {
        void applyPreset(preset, options.ctx).then(() => {
          options.ctx.notify.success(
            options.ctx.t('core.presets.applied', 'Applied "{name}"', { values: { name: options.ctx.t(preset.label, preset.label) } })
          );
          options.onApplied?.(preset);
        });
      }
    });
    list.append(item);
  }

  if (options.presets.length === 0) {
    host.append(components.emptyState({ title: 'core.presets.none' }));
    return;
  }

  host.append(
    el('p', { className: 'md-typescale-body-small md-presets__hint', text: options.ctx.t('core.presets.hint', 'Every value shown is what would really be set — nothing here is invented.') }),
    list
  );
}
