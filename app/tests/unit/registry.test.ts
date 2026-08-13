/**
 * Setting id uniqueness across the whole application, and every feature's
 * default export matching the FeatureModule shape.
 *
 * This is the one suite that actually imports every feature's real `index.ts`
 * (not just its `strings.ts`), because the FeatureModule shape and the
 * setting-id registry live there. That means it also imports each feature's
 * `./styles.css` side-effect import and constructs whatever module-scope
 * singletons that pulls in — which is exactly why this needs the jsdom
 * environment and the `window.studio` fake from tests/setup.ts, and exactly
 * why it is its own file rather than folded into the (deliberately
 * lightweight, `strings.ts`-only) localization suite.
 */
import { readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { registry } from '../../src/renderer/core/registry';
import type { FeatureModule } from '../../src/renderer/core/types';

const HERE = dirname(fileURLToPath(import.meta.url));
const FEATURES_DIR = resolve(HERE, '../../src/renderer/features');

function featureDirs(): string[] {
  return readdirSync(FEATURES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

async function importFeature(dir: string): Promise<{ dir: string; module: FeatureModule | null; error: string | null }> {
  const path = resolve(FEATURES_DIR, dir, 'index.ts');
  try {
    const mod = (await import(/* @vite-ignore */ pathToFileURL(path).href)) as { default?: FeatureModule };
    return { dir, module: mod.default ?? null, error: mod.default ? null : 'index.ts has no default export' };
  } catch (error) {
    return { dir, module: null, error: error instanceof Error ? `${error.name}: ${error.message}` : String(error) };
  }
}

describe('every feature/*/index.ts imports cleanly and default-exports a FeatureModule', () => {
  it('imports every feature module without throwing', async () => {
    const dirs = featureDirs();
    expect(dirs.length).toBeGreaterThanOrEqual(35);
    const results = await Promise.all(dirs.map(importFeature));
    const failures = results.filter((result) => result.error !== null);
    const detail = failures.map((f) => `  ${f.dir}: ${f.error}`).join('\n');
    expect(failures, `${failures.length} feature module(s) failed to import cleanly:\n${detail}`).toHaveLength(0);
  });

  it('every default export has the required FeatureModule shape (id, name, description)', async () => {
    const dirs = featureDirs();
    const results = await Promise.all(dirs.map(importFeature));
    const shapeFailures: string[] = [];
    for (const { dir, module } of results) {
      if (!module) continue; // already reported by the import test above
      if (typeof module.id !== 'string' || module.id.trim() === '') {
        shapeFailures.push(`${dir}: module.id is "${String(module.id)}", not a non-empty string`);
      } else if (module.id !== dir) {
        shapeFailures.push(`${dir}: module.id is "${module.id}", which does not match its own directory name`);
      }
      if (typeof module.name !== 'string' || module.name.trim() === '') {
        shapeFailures.push(`${dir}: module.name is not a non-empty string`);
      }
      if (typeof module.description !== 'string' || module.description.trim() === '') {
        shapeFailures.push(`${dir}: module.description is not a non-empty string`);
      }
      if (module.tabs) {
        for (const tab of module.tabs) {
          if (typeof tab.mount !== 'function') shapeFailures.push(`${dir}: tab "${tab.id}" has no mount function`);
        }
      }
      if (module.settings) {
        for (const section of module.settings) {
          for (const control of section.controls) {
            if (control.kind === 'custom' && typeof control.render !== 'function') {
              shapeFailures.push(`${dir}: custom setting "${control.id}" has no render function`);
            }
            if (control.kind === 'action' && typeof control.run !== 'function') {
              shapeFailures.push(`${dir}: action setting "${control.id}" has no run function`);
            }
            if (control.kind === 'select' && (!control.options || control.options.length === 0)) {
              shapeFailures.push(`${dir}: select setting "${control.id}" has no options`);
            }
          }
        }
      }
    }
    expect(shapeFailures, shapeFailures.join('\n')).toHaveLength(0);
  });
});

describe('setting ids are unique across the whole application', () => {
  it('registers every feature module through the real registry with no id collisions', async () => {
    const dirs = featureDirs();
    const results = await Promise.all(dirs.map(importFeature));
    const cleanModules = results.filter((r): r is { dir: string; module: FeatureModule; error: null } => r.module !== null);
    expect(cleanModules.length).toBe(dirs.length); // the import test above should already guarantee this

    const registrationFailures: string[] = [];
    for (const { dir, module } of cleanModules) {
      try {
        registry.register(module);
      } catch (error) {
        registrationFailures.push(`${dir}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    expect(registrationFailures, registrationFailures.join('\n')).toHaveLength(0);

    // Independently of whatever the registry itself enforced above, recompute
    // uniqueness directly from every module's own declared setting ids, so this
    // does not rely solely on the registry's internal bookkeeping being correct.
    const seen = new Map<string, string>(); // settingId -> owning feature dir
    const duplicates: string[] = [];
    for (const { dir, module } of cleanModules) {
      for (const section of module.settings ?? []) {
        for (const control of section.controls) {
          const owner = seen.get(control.id);
          if (owner) {
            duplicates.push(`setting id "${control.id}" is declared by both "${owner}" and "${dir}"`);
          } else {
            seen.set(control.id, dir);
          }
        }
      }
    }
    expect(duplicates, duplicates.join('\n')).toHaveLength(0);
    expect(seen.size).toBeGreaterThan(50); // sanity floor: the app has well over 50 settings
  });

  it('self-test: the registry genuinely refuses a duplicate setting id', async () => {
    // A guard nobody has watched fail proves nothing (see the localization
    // suite's self-test for the same discipline). This proves the registry's
    // own uniqueness enforcement is live, independently of the deduplication
    // performed against fully-imported feature modules above.
    const { registry: freshRegistryModule } = (await import('../../src/renderer/core/registry')) as {
      registry: typeof registry;
    };
    void freshRegistryModule; // same singleton; kept only to document the import path used
    const moduleA: FeatureModule = {
      id: 'self-test-a',
      name: 'A',
      description: 'A',
      settings: [{ id: 'self-test-section-a', title: 'A', icon: 'tune', controls: [{ id: 'self-test.duplicate', label: 'x', description: 'x', kind: 'switch', defaultValue: false }] }]
    };
    const moduleB: FeatureModule = {
      id: 'self-test-b',
      name: 'B',
      description: 'B',
      settings: [{ id: 'self-test-section-b', title: 'B', icon: 'tune', controls: [{ id: 'self-test.duplicate', label: 'x', description: 'x', kind: 'switch', defaultValue: false }] }]
    };
    registry.register(moduleA);
    expect(() => registry.register(moduleB)).toThrow(/self-test\.duplicate/);
  });
});
