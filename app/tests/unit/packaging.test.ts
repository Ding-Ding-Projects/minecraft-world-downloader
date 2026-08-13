/**
 * Packaging configuration: electron-builder.yml targets Squirrel, carries a
 * non-empty author and a squirrelWindows.iconUrl, has signing disabled, and
 * carries no NSIS target and no legacy keys that fail electron-builder's
 * config schema validation.
 *
 * This is read as plain text rather than parsed as YAML. electron-builder.yml
 * is a flat, hand-authored config with no aliases, anchors or multi-document
 * structure, so a full YAML parser is unneeded machinery for what this checks;
 * avoiding it also avoids adding a YAML-parsing devDependency for one file.
 * Bringing in a YAML parser (e.g. `js-yaml`, already present transitively
 * through electron-builder) would let this walk a real object graph instead
 * of matching text, at the cost of a new declared dependency for a single,
 * simple config file — not worth it here, but worth naming as the trade-off.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
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
    const section = /squirrelWindows:\n([\s\S]*?)(?:\n\w[^\n]*:|$)/.exec(CODE);
    expect(section, 'no squirrelWindows: section found').not.toBeNull();
    const iconUrlMatch = /iconUrl:\s*(\S+)/.exec(CODE);
    expect(iconUrlMatch, 'squirrelWindows.iconUrl is missing').not.toBeNull();
    expect(iconUrlMatch![1]).toMatch(/^https:\/\/\S+\.ico$/);
  });

  it('gives squirrelWindows an artifactName and disables the MSI', () => {
    expect(CODE).toMatch(/squirrelWindows:[\s\S]*?artifactName:\s*\S+/);
    expect(CODE).toMatch(/squirrelWindows:[\s\S]*?msi:\s*false/);
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
    expect(CODE).toMatch(/^win:\n(?:.*\n)*?\s*icon:\s*\S+/m);
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
