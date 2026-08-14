/**
 * Packaging configuration: electron-builder.yml targets Squirrel, carries a
 * non-empty author and a squirrelWindows.iconUrl, has signing disabled, and
 * carries no NSIS target and no legacy keys that fail electron-builder's
 * config schema validation.
 *
 * This is read as plain text rather than parsed as YAML. electron-builder.yml
 * is a flat, hand-authored config with no aliases, anchors or multi-document
 * structure, so a full YAML parser is unneeded machinery for what this checks.
 * js-yaml IS reachable in node_modules, but only as electron-builder's OWN
 * transitive dependency — it is not declared in this project's package.json.
 * Importing it directly here would make this test's correctness depend on
 * another package's dependency tree rather than on anything this project
 * promises to keep installed, and a future electron-builder upgrade that
 * drops or relocates its own js-yaml copy would break this file for a reason
 * that has nothing to do with packaging config. Declaring js-yaml as a real
 * dependency of this project, just to read one flat config file, was judged
 * not worth it — so this stays a plain-text reader, but a structural one.
 *
 * What replaces a real parser is STRUCTURAL section extraction:
 * `topLevelSection` below reads the YAML by indentation depth — the thing
 * that actually delimits a YAML mapping — rather than by regex text
 * bridging. A section runs from a `key:` line at column 0 to the next
 * column-0, non-blank line: exactly the boundary a real parser would find,
 * computed without one. Every assertion below that needs to stay inside one
 * section (squirrelWindows, win) reads ONLY that section's text, so a
 * same-named key belonging to a different section can never satisfy it.
 *
 * This file previously used two vulnerable shapes for the same checks:
 *   - `/iconUrl:\s*(\S+)/.exec(CODE)` — unscoped, matched the string
 *     ANYWHERE in the whole file, not just inside squirrelWindows.
 *   - `squirrelWindows:[\s\S]*?artifactName:\s*\S+` and the equivalent
 *     `/^win:\n(?:.*\n)*?\s*icon:\s*\S+/m` — a lazy `[\s\S]*?`/`(?:.*\n)*?`
 *     bridge with no upper section boundary, satisfied by a key belonging to
 *     a completely different, later section.
 * The self-tests at the bottom reproduce that exact failure shape against a
 * temp-file mirror (never the real file) and prove the fix actually rejects
 * it, while proving the OLD pattern shape would NOT have.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = resolve(HERE, '../..');
const BUILDER_YML = readFileSync(resolve(APP_ROOT, 'electron-builder.yml'), 'utf8');
const PACKAGE_JSON = JSON.parse(readFileSync(resolve(APP_ROOT, 'package.json'), 'utf8')) as {
  author?: unknown;
  productName?: unknown;
  name?: unknown;
};

/** Strips full-line and trailing `#` comments so a commented-out key can never
 *  satisfy a "does not contain" assertion, and a real key inside a comment
 *  explaining why it is absent (as this file's own comments do) can never
 *  satisfy a "contains" assertion either. */
function withoutComments(yaml: string): string {
  return yaml
    .split(/\r\n|\n|\r/)
    .map((line) => line.replace(/(^|\s)#.*$/, ''))
    .join('\n');
}

/**
 * Returns the body of a top-level, block-style `key:` mapping (a `key:` line
 * at column 0, followed by its indented and/or blank lines), stopping at the
 * next column-0, non-blank line — the point a real YAML parser would also
 * stop. Returns null when no such top-level key exists.
 *
 * This is "count delimiters with a depth counter instead of matching them"
 * applied to YAML, where indentation IS the delimiter: a section boundary is
 * found structurally (by column position), never by a regex reaching forward
 * through the rest of the file looking for the next occurrence of anything.
 */
function topLevelSection(yaml: string, key: string): string | null {
  const lines = yaml.split(/\r\n|\n|\r/);
  const headerPattern = new RegExp(`^${key}:\\s*$`);
  const headerIndex = lines.findIndex((line) => headerPattern.test(line));
  if (headerIndex === -1) return null;
  const body: string[] = [];
  for (let i = headerIndex + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.trim() === '') {
      body.push(line);
      continue;
    }
    if (/^\S/.test(line)) break; // next top-level key: this section is over
    body.push(line);
  }
  return body.join('\n');
}

interface GuardResult {
  ok: boolean;
  reason: string;
}

/** Guard: squirrelWindows carries a non-empty https .ico iconUrl, checked
 *  ONLY inside the squirrelWindows section. */
function checkSquirrelIconUrl(yaml: string): GuardResult {
  const section = topLevelSection(withoutComments(yaml), 'squirrelWindows');
  if (section === null) return { ok: false, reason: 'no squirrelWindows: section found' };
  const match = /^\s*iconUrl:\s*(\S+)\s*$/m.exec(section);
  if (!match) return { ok: false, reason: 'squirrelWindows.iconUrl is missing' };
  if (!/^https:\/\/\S+\.ico$/.test(match[1])) {
    return { ok: false, reason: `squirrelWindows.iconUrl "${match[1]}" is not a public https .ico URL` };
  }
  return { ok: true, reason: 'ok' };
}

/** Guard: squirrelWindows carries an artifactName and disables the MSI,
 *  checked ONLY inside the squirrelWindows section. */
function checkSquirrelArtifactAndMsi(yaml: string): GuardResult {
  const section = topLevelSection(withoutComments(yaml), 'squirrelWindows');
  if (section === null) return { ok: false, reason: 'no squirrelWindows: section found' };
  if (!/^\s*artifactName:\s*\S+/m.test(section)) {
    return { ok: false, reason: 'squirrelWindows.artifactName is missing' };
  }
  if (!/^\s*msi:\s*false\s*$/m.test(section)) {
    return { ok: false, reason: 'squirrelWindows.msi is not set to false' };
  }
  return { ok: true, reason: 'ok' };
}

/** Guard: win carries a Windows icon path, checked ONLY inside the win
 *  section. */
function checkWinIcon(yaml: string): GuardResult {
  const section = topLevelSection(withoutComments(yaml), 'win');
  if (section === null) return { ok: false, reason: 'no win: section found' };
  if (!/^\s*icon:\s*\S+/m.test(section)) return { ok: false, reason: 'win.icon is missing' };
  return { ok: true, reason: 'ok' };
}

const CODE = withoutComments(BUILDER_YML);

describe('electron-builder.yml: Squirrel target', () => {
  it('targets squirrel under win.target', () => {
    expect(CODE).toMatch(/target:\s*\n\s*-\s*target:\s*squirrel/);
  });

  it('carries no NSIS target anywhere', () => {
    expect(CODE).not.toMatch(/target:\s*nsis\b/);
    expect(CODE).not.toMatch(/-\s*nsis\b/);
    expect(CODE).not.toMatch(/^\s*nsis:/m);
  });

  it('carries no legacy setupExe or noMsi keys, which fail electron-builder\'s schema', () => {
    expect(CODE).not.toMatch(/^\s*setupExe:/m);
    expect(CODE).not.toMatch(/^\s*noMsi:/m);
  });

  it('declares a squirrelWindows section with a non-empty https iconUrl', () => {
    const result = checkSquirrelIconUrl(BUILDER_YML);
    expect(result.ok, result.reason).toBe(true);
  });

  it('gives squirrelWindows an artifactName and disables the MSI', () => {
    const result = checkSquirrelArtifactAndMsi(BUILDER_YML);
    expect(result.ok, result.reason).toBe(true);
  });
});

describe('electron-builder.yml: signing permanently disabled', () => {
  it('forceCodeSigning is false', () => {
    expect(CODE).toMatch(/^forceCodeSigning:\s*false\s*$/m);
  });

  it('signExecutable is false (and NOT signAndEditExecutable, which would also skip the icon)', () => {
    expect(CODE).toMatch(/^\s*signExecutable:\s*false\s*$/m);
    // signAndEditExecutable: false skips icon + version metadata too, which the
    // file's own comment explains was a real regression here once already.
    expect(CODE).not.toMatch(/^\s*signAndEditExecutable:\s*false\s*$/m);
  });

  it('carries no CSC_* certificate reference and no publish auto-configuration', () => {
    expect(CODE).not.toMatch(/CSC_LINK|CSC_KEY_PASSWORD|certificateFile|certificatePassword/);
    expect(CODE).toMatch(/^publish:\s*null\s*$/m);
  });
});

describe('electron-builder.yml: identity', () => {
  it('declares a non-empty appId and productName', () => {
    expect(CODE).toMatch(/^appId:\s*\S+/m);
    expect(CODE).toMatch(/^productName:\s*\S.+$/m);
  });

  it('declares a Windows icon path', () => {
    const result = checkWinIcon(BUILDER_YML);
    expect(result.ok, result.reason).toBe(true);
  });
});

describe('package.json: non-empty package author', () => {
  it('has a non-empty, non-placeholder author', () => {
    expect(typeof PACKAGE_JSON.author).toBe('string');
    const author = String(PACKAGE_JSON.author).trim();
    expect(author.length).toBeGreaterThan(0);
    expect(author.toLowerCase()).not.toBe('todo');
    expect(author.toLowerCase()).not.toBe('unknown');
  });

  it('has a non-empty productName-shaped name', () => {
    expect(typeof PACKAGE_JSON.name).toBe('string');
    expect(String(PACKAGE_JSON.name).length).toBeGreaterThan(0);
  });
});

/**
 * Self-tests: each writes a MUTATED MIRROR of electron-builder.yml to a real
 * temp file on disk (never the real file) that reproduces exactly the
 * recorded failure shape — a required key removed from its own section while
 * an identically-named DECOY key is planted in a later, unrelated section —
 * and proves the section-scoped guard above rejects it (RED). Each test also
 * proves, on the same mutated text, that the file's OLD unscoped/unbounded
 * pattern shape would have matched the decoy and stayed green — so this is a
 * genuine regression test for the recorded bug, not an accidentally-inert one.
 */
describe('self-test: the section-scoped guards actually detect a missing key, not just a same-named key anywhere in the file', () => {
  function withTempMirror(content: string, run: (mirroredContent: string) => void): void {
    const dir = mkdtempSync(join(tmpdir(), 'packaging-guard-mirror-'));
    try {
      const mirrorPath = join(dir, 'electron-builder.yml');
      writeFileSync(mirrorPath, content, 'utf8');
      // Read back from disk (not the in-memory `content`) so the guard genuinely
      // runs against the temp mirror file, not just a string still in scope.
      run(readFileSync(mirrorPath, 'utf8'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  it('sanity: the real file passes every guard before any mutation', () => {
    expect(checkSquirrelIconUrl(BUILDER_YML).ok).toBe(true);
    expect(checkSquirrelArtifactAndMsi(BUILDER_YML).ok).toBe(true);
    expect(checkWinIcon(BUILDER_YML).ok).toBe(true);
  });

  it('squirrelWindows.iconUrl guard: RED when iconUrl is removed from squirrelWindows even though an iconUrl-looking key exists in a later, unrelated section', () => {
    const mutated = BUILDER_YML
      .split(/\r\n|\n|\r/)
      .filter((line) => !/^\s*iconUrl:\s*\S+/.test(line))
      .join('\n')
      .concat('\n# decoy: an unrelated later section reusing the same key name\ndecoySection:\n  iconUrl: https://example.com/decoy.ico\n');

    // Prove the decoy alone would have satisfied the file's OLD unscoped
    // `/iconUrl:\s*(\S+)/.exec(CODE)` shape, so this mutation is a genuine
    // test of the fix rather than one that happens to change nothing.
    expect(/iconUrl:\s*(\S+)/.exec(mutated)?.[1]).toBe('https://example.com/decoy.ico');

    withTempMirror(mutated, (mirrored) => {
      const result = checkSquirrelIconUrl(mirrored);
      expect(result.ok, `expected RED (missing iconUrl inside squirrelWindows); got: ${result.reason}`).toBe(false);
      expect(result.reason).toMatch(/iconUrl is missing/);
    });
  });

  it('squirrelWindows.artifactName/msi guard: RED when both are removed from squirrelWindows even though a later, unrelated section declares the same keys', () => {
    const mutated = BUILDER_YML
      .split(/\r\n|\n|\r/)
      .filter((line) => !/^\s*artifactName:\s*\S+/.test(line) && !/^\s*msi:\s*false\s*$/.test(line))
      .join('\n')
      .concat('\n# decoy: an unrelated later section reusing the same key names\ndecoySection:\n  artifactName: decoy-${version}\n  msi: false\n');

    // Prove the decoy alone would have satisfied the file's OLD unbounded-bridge
    // `squirrelWindows:[\s\S]*?artifactName:\s*\S+` / `...msi:\s*false` shape.
    expect(mutated).toMatch(/squirrelWindows:[\s\S]*?artifactName:\s*\S+/);
    expect(mutated).toMatch(/squirrelWindows:[\s\S]*?msi:\s*false/);

    withTempMirror(mutated, (mirrored) => {
      const result = checkSquirrelArtifactAndMsi(mirrored);
      expect(result.ok, `expected RED (missing artifactName/msi inside squirrelWindows); got: ${result.reason}`).toBe(false);
    });
  });

  it('win.icon guard: RED when icon is removed from win even though a later, unrelated section declares an icon key', () => {
    const mutated = BUILDER_YML
      .split(/\r\n|\n|\r/)
      .filter((line) => !/^\s*icon:\s*build\/icon\.ico\s*$/.test(line))
      .join('\n')
      .concat('\n# decoy: an unrelated later section reusing the same key name\ndecoySection:\n  icon: decoy/icon.ico\n');

    // Prove the decoy alone would have satisfied the file's OLD unbounded-bridge
    // `/^win:\n(?:.*\n)*?\s*icon:\s*\S+/m` shape.
    expect(mutated).toMatch(/^win:\n(?:.*\n)*?\s*icon:\s*\S+/m);

    withTempMirror(mutated, (mirrored) => {
      const result = checkWinIcon(mirrored);
      expect(result.ok, `expected RED (missing icon inside win); got: ${result.reason}`).toBe(false);
    });
  });
});
