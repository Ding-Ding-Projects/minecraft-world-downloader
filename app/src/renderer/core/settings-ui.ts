import type { SettingsSection } from './types';

/**
 * Settings-surface completeness: the coverage guard behind the progressive
 * disclosure explanation and the default-provenance line.
 *
 * `renderSettingRow` (core/settingcontrol.ts) already renders both for
 * whatever `SettingControl` it is handed: a "?" affordance that reveals
 * `description`, and a provenance line that names the real current value
 * rather than the opaque word "default". That rendering code is necessary
 * but not sufficient on its own — a rule that only checks "every explanation
 * present is well-formed" passes cleanly on a setting that has NO explanation
 * at all, because it never looked for the missing one.
 *
 * This module is the part that looks. `CORE_REQUIRED_SETTING_IDS` is a
 * hand-written manifest — not derived by scanning `coreFeature.ts` — of every
 * setting id core itself registers. `verifyCoreSettingsCoverage` checks that
 * manifest against what the registry actually holds at runtime, so a setting
 * that quietly stopped being registered, lost its description, or was left
 * with a description identical to its own label is reported instead of
 * silently passing. `scripts/check-settings-coverage.mjs` runs the equivalent
 * check statically, from the command line, against the real source file.
 */

export interface CoverageIssue {
  id: string;
  reason: string;
}

/**
 * Every setting id `core/coreFeature.ts` registers. Written by hand and kept
 * in sync with that file deliberately: a list generated FROM the sections
 * currently registered could never notice one disappearing, which is exactly
 * the failure this guard exists to catch.
 */
export const CORE_REQUIRED_SETTING_IDS: readonly string[] = [
  'language.mode',
  'language.funny.en',
  'language.funny.yue',
  'language.emojiInDialogs',
  'vocabulary.file',
  'school.enabled',
  'school.name',
  'school.unlock.set',
  'appearance.themeMode',
  'appearance.seed',
  'appearance.contrast',
  'appearance.density',
  'appearance.fontFamily',
  'appearance.fontScale',
  'appearance.fontWeight',
  'app.displayName',
  'appearance.resetAll',
  'tabs.dock',
  'palette.size',
  'data.reveal',
  'data.exportSettings',
  'data.resetSettings'
];

interface FlatControl {
  id: string;
  label: string;
  description: string;
  defaultValue: unknown;
}

function flatten(sections: SettingsSection[]): Map<string, FlatControl> {
  const byId = new Map<string, FlatControl>();
  for (const section of sections) {
    for (const control of section.controls) {
      byId.set(control.id, {
        id: control.id,
        label: control.label,
        description: control.description,
        defaultValue: control.defaultValue
      });
    }
  }
  return byId;
}

/**
 * Checks every id in `requiredIds` against `sections`. Reports a missing
 * control, an empty or absent explanation, an explanation identical to the
 * label (which restates instead of explaining), and a missing declared
 * default (which leaves the provenance line unable to name a real value).
 */
export function describeSettingsCoverage(sections: SettingsSection[], requiredIds: readonly string[]): CoverageIssue[] {
  const byId = flatten(sections);
  const issues: CoverageIssue[] = [];

  for (const id of requiredIds) {
    const control = byId.get(id);
    if (!control) {
      issues.push({ id, reason: 'is on the required list but no settings control registers it' });
      continue;
    }
    if (!control.description || control.description.trim().length === 0) {
      issues.push({ id, reason: 'has no description, so the progressive-disclosure explanation would render empty' });
      continue;
    }
    if (control.description.trim() === control.label.trim()) {
      issues.push({ id, reason: 'description is identical to its label, so the explanation only restates the label' });
    }
    if (control.defaultValue === undefined) {
      issues.push({ id, reason: 'has no defaultValue, so the provenance line cannot name a real shipped value' });
    }
  }

  return issues;
}

export function verifyCoreSettingsCoverage(sections: SettingsSection[]): { ok: boolean; issues: CoverageIssue[] } {
  const issues = describeSettingsCoverage(sections, CORE_REQUIRED_SETTING_IDS);
  return { ok: issues.length === 0, issues };
}
