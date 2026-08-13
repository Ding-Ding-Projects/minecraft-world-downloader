/**
 * Localization completeness.
 *
 * Every catalogue entry, core and every feature's own, must carry five
 * non-empty variants in English AND in Cantonese. This is mechanical and
 * high-value: a missing rung renders `undefined` or falls back to the raw key
 * at some funny level, in some language, for some user — and nobody notices
 * until that exact combination is hit.
 *
 * The catalogues are imported directly from their `strings.ts` modules (or, for
 * the core catalogue, from `core/i18n.ts`) rather than through each feature's
 * `index.ts`. A feature's `index.ts` pulls in `./styles.css` and wires up tabs,
 * settings and palette entries — none of which this suite needs, and CSS/DOM
 * side effects are exactly the kind of thing that should not gate a text check.
 */
import { readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CORE } from '../../src/renderer/core/i18n';
import type { Catalogue, FunnyLadder, TranslationEntry } from '../../src/renderer/core/types';

const HERE = dirname(fileURLToPath(import.meta.url));
const FEATURES_DIR = resolve(HERE, '../../src/renderer/features');

interface CatalogueSource {
  label: string;
  catalogue: Catalogue;
}

async function loadFeatureCatalogues(): Promise<CatalogueSource[]> {
  const dirs = readdirSync(FEATURES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  const sources: CatalogueSource[] = [];
  for (const dir of dirs) {
    const path = resolve(FEATURES_DIR, dir, 'strings.ts');
    if (!existsSync(path)) {
      throw new Error(`features/${dir} has no strings.ts — every feature must carry its own copy catalogue.`);
    }
    const mod = (await import(/* @vite-ignore */ pathToFileURL(path).href)) as Record<string, unknown>;
    const values = Object.values(mod).filter(
      (value): value is Catalogue => typeof value === 'object' && value !== null && !Array.isArray(value)
    );
    if (values.length !== 1) {
      throw new Error(
        `features/${dir}/strings.ts must export exactly one catalogue object; found ${values.length}.`
      );
    }
    sources.push({ label: `features/${dir}`, catalogue: values[0] });
  }
  return sources;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function checkLadder(label: string, key: string, language: 'en' | 'yue', ladder: FunnyLadder, failures: string[]): void {
  if (!Array.isArray(ladder) || ladder.length !== 5) {
    failures.push(`${label}: "${key}".${language} is not a 5-element ladder (got ${JSON.stringify(ladder)}).`);
    return;
  }
  ladder.forEach((rung, index) => {
    if (!isNonEmptyString(rung)) {
      failures.push(`${label}: "${key}".${language}[${index}] (funny level ${index + 1}) is empty or not a string.`);
    }
  });
}

function checkCatalogue(label: string, catalogue: Catalogue, failures: string[]): void {
  for (const [key, raw] of Object.entries(catalogue)) {
    const entryValue = raw as TranslationEntry;
    if (!entryValue || typeof entryValue !== 'object') {
      failures.push(`${label}: "${key}" is not a { en, yue } entry.`);
      continue;
    }
    if (!('en' in entryValue)) failures.push(`${label}: "${key}" has no English ladder.`);
    else checkLadder(label, key, 'en', entryValue.en, failures);
    if (!('yue' in entryValue)) failures.push(`${label}: "${key}" has no Cantonese ladder.`);
    else checkLadder(label, key, 'yue', entryValue.yue, failures);
  }
}

describe('localization: five funny-level variants in both languages', () => {
  it('the core catalogue is fully populated', () => {
    const failures: string[] = [];
    checkCatalogue('core', CORE, failures);
    expect(failures, failures.join('\n')).toHaveLength(0);
  });

  it('the core catalogue has a realistic number of entries', () => {
    // A sanity floor, not a ceiling: this fails loudly if `CORE` is somehow
    // imported empty (e.g. a broken re-export) rather than passing vacuously.
    expect(Object.keys(CORE).length).toBeGreaterThan(50);
  });

  it('every feature directory has a strings.ts and it is fully populated', async () => {
    const sources = await loadFeatureCatalogues();
    expect(sources.length).toBeGreaterThanOrEqual(35);
    const failures: string[] = [];
    for (const source of sources) checkCatalogue(source.label, source.catalogue, failures);
    expect(failures, failures.join('\n')).toHaveLength(0);
  });

  it('self-test: the checker actually rejects a broken catalogue', () => {
    // A guard nobody has watched fail proves nothing. This exercises the exact
    // logic above against fabricated bad entries, so a change that quietly
    // makes `checkLadder`/`checkCatalogue` a no-op is caught here rather than
    // by every other test in this file staying green for the wrong reason.
    const broken: Catalogue = {
      'x.tooShort': { en: ['only one'] as unknown as FunnyLadder, yue: ['得一個'] as unknown as FunnyLadder },
      'x.emptyRung': {
        en: ['a', 'b', '', 'd', 'e'] as FunnyLadder,
        yue: ['甲', '乙', '丙', '丁', '戊'] as FunnyLadder
      },
      'x.missingYue': { en: ['a', 'a', 'a', 'a', 'a'] as FunnyLadder } as unknown as TranslationEntry
    };
    const failures: string[] = [];
    checkCatalogue('self-test', broken, failures);
    expect(failures.length).toBeGreaterThanOrEqual(3);
    expect(failures.some((f) => f.includes('x.tooShort'))).toBe(true);
    expect(failures.some((f) => f.includes('x.emptyRung'))).toBe(true);
    expect(failures.some((f) => f.includes('x.missingYue'))).toBe(true);
  });

  it('no feature catalogue silently shadows a core key', async () => {
    // core/i18n.ts's register() already refuses to let a feature key starting
    // with "core." override a real core entry; this asserts no feature ships
    // one at all, so the intent is visible in the catalogue itself.
    const sources = await loadFeatureCatalogues();
    const offenders: string[] = [];
    for (const source of sources) {
      for (const key of Object.keys(source.catalogue)) {
        if (key.startsWith('core.') && key in CORE) offenders.push(`${source.label} redeclares core key "${key}"`);
      }
    }
    expect(offenders, offenders.join('\n')).toHaveLength(0);
  });
});
