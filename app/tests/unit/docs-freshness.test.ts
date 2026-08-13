/**
 * Documentation/bundle freshness.
 *
 * The in-application documentation browser ships every article compiled in at
 * build time (`features/docs-browser/generated.ts`, written by
 * `scripts/bundle-docs.mjs` from the Markdown in `docs/features/`). That bundle
 * can go stale exactly the way any generated file can: a `.md` file is added,
 * edited or removed on disk and nobody re-runs the generator, so the shipped
 * browser silently serves old or missing content while every other check stays
 * green — a generated-file check like this is the only thing that would catch
 * that drift.
 *
 * This wraps the project's own committed verifier
 * (`scripts/check-docs-bundle.mjs`) as a real subprocess rather than
 * re-implementing its comparison logic here, for the same reason
 * `packaging.test.ts` reads YAML as text instead of parsing it: the verifier
 * already exists, is exercised on every build, and a second implementation of
 * the same freshness check would just be a second thing that can drift from
 * the first.
 *
 * When this test was first written it found the bundle 26 articles stale and
 * failed. It was regenerated with `node scripts/bundle-docs.mjs` (a
 * mechanical, generated-file regeneration — no hand-authored source was
 * touched) and the real "before" output is preserved in TEST_INVENTORY.md and
 * the suites-lane report rather than only in this comment.
 */
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = resolve(HERE, '../..');

function run(script: string): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(process.execPath, [resolve(APP_ROOT, 'scripts', script)], {
    cwd: APP_ROOT,
    encoding: 'utf8'
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

describe('scripts/check-docs-bundle.mjs: the in-app documentation bundle matches docs/features/', () => {
  it('passes with exit code 0', () => {
    const { status, stdout, stderr } = run('check-docs-bundle.mjs');
    expect(status, `stdout:\n${stdout}\nstderr:\n${stderr}`).toBe(0);
    expect(stdout).toMatch(/articles bundled.*files on disk.*match/);
  });
});

describe('scripts/validate-changelog.mjs: every changelog commit id resolves', () => {
  it('passes with exit code 0', () => {
    const { status, stdout, stderr } = run('validate-changelog.mjs');
    expect(status, `stdout:\n${stdout}\nstderr:\n${stderr}`).toBe(0);
    expect(stdout).toMatch(/Changelog validated/);
  });
});
