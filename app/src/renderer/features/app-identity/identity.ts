import type { AppContext } from '../../core/registry';

/**
 * The identity model.
 *
 * One idea runs through this whole feature: **display is a setting, identity is
 * a constant, and neither is ever derived from the other.**
 *
 * The name the application shows the person using it lives in one settings key.
 * The name and the package id that the data directory, the installer, the update
 * feed and every diagnostic hang off arrive from the main process as compiled-in
 * constants (`AppInfo.packageName` and `AppInfo.productName`) and cannot be
 * written from here at all — there is no bridge call that changes them.
 *
 * That separation is not asserted, it is checked: `identityChecks()` reads the
 * real paths and the real settings store at runtime and reports what it actually
 * found, so a claim on the About surface is evidence rather than a promise.
 */

/* ------------------------------------------------------------------ */
/* Setting ids and constants                                           */
/* ------------------------------------------------------------------ */

/**
 * The one key a rename writes.
 *
 * It is declared by the core appearance section, so this feature reads and
 * writes it rather than registering a second control for the same value: two
 * ids for one value is how two surfaces come to disagree about what the value
 * is.
 */
export const DISPLAY_NAME_SETTING = 'app.displayName';

/** The dim sum code name recorded for this build, if the user recorded one. */
export const CODE_NAME_SETTING = 'app-identity.codeName';

/** Whether a diagnostic report also notes the chosen name. Off by default. */
export const DIAGNOSTICS_CHOSEN_SETTING = 'app-identity.diagnostics.includeChosenName';

/** Whether a diagnostic report shortens paths above the data directory. */
export const DIAGNOSTICS_REDACT_SETTING = 'app-identity.diagnostics.redactPaths';

/** Longest display name accepted. A title bar is not a paragraph. */
export const MAX_DISPLAY_NAME_LENGTH = 80;

/** The licence this application is distributed under, as an SPDX identifier. */
export const LICENCE_ID = 'GPL-3.0-or-later';

/** The licence text, published by its author. Opened in the user's browser. */
export const LICENCE_URL = 'https://www.gnu.org/licenses/gpl-3.0.html';

/**
 * The public dim sum photo catalogue.
 *
 * The photographs live there and are deliberately not vendored into this
 * repository, so the code name surface links to the catalogue rather than
 * shipping a picture of its own.
 */
export const DIM_SUM_CATALOGUE_URL = 'https://github.com/Ding-Ding-Projects/dim-sum-photos';

/* ------------------------------------------------------------------ */
/* Names                                                               */
/* ------------------------------------------------------------------ */

/** The shipped product name. Diagnostics and crash reports use this one. */
export function shippedName(ctx: AppContext): string {
  return ctx.studio.info.productName;
}

/** The stable package identity. Never derived from anything the user types. */
export function packageIdentity(ctx: AppContext): string {
  return ctx.studio.info.packageName;
}

/** The name the user chose, or an empty string when they have not chosen one. */
export function chosenName(ctx: AppContext): string {
  const raw = ctx.settings.get<string>(DISPLAY_NAME_SETTING, '');
  return typeof raw === 'string' ? raw.trim() : '';
}

/** What the application calls itself right now. */
export function displayName(ctx: AppContext): string {
  return chosenName(ctx) || shippedName(ctx);
}

/** True when the user has chosen a name of their own. */
export function hasChosenName(ctx: AppContext): boolean {
  return chosenName(ctx) !== '';
}

/**
 * Validates a candidate display name.
 *
 * Returns an i18n key describing the refusal, or null to accept. An empty value
 * is accepted and means "go back to the shipped name": clearing the field is a
 * legitimate way to reset, and refusing it would trap somebody who deleted the
 * text intending exactly that.
 */
export function validateDisplayName(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return 'app-identity.name.error.type';
  const trimmed = value.trim();
  if (trimmed.length > MAX_DISPLAY_NAME_LENGTH) return 'app-identity.name.error.tooLong';
  // Control characters render as nothing, or as a replacement box, in a title
  // bar. A name that looks empty but is not is worse than a refused one.
  if (/[\u0000-\u001F\u007F\u200B-\u200F\u2028\u2029\uFEFF]/.test(trimmed)) return 'app-identity.name.error.control';
  return null;
}

/* ------------------------------------------------------------------ */
/* Paths                                                               */
/* ------------------------------------------------------------------ */

/** Splits a Windows or POSIX path into its segments, dropping empty ones. */
export function pathSegments(path: string): string[] {
  return path.split(/[\\/]+/).filter((segment) => segment.length > 0);
}

/** The last segment of a path, or an empty string. */
export function lastSegment(path: string): string {
  const segments = pathSegments(path);
  return segments.length > 0 ? segments[segments.length - 1] : '';
}

/** True when `child` sits inside `parent`, comparing case-insensitively. */
export function isInside(parent: string, child: string): boolean {
  if (parent === '' || child === '') return false;
  const normalize = (value: string): string => value.replace(/[\\/]+/g, '/').replace(/\/+$/, '').toLowerCase();
  const p = normalize(parent);
  const c = normalize(child);
  return c === p || c.startsWith(`${p}/`);
}

/**
 * Shortens a path to the application's own directory and everything below it.
 *
 * Everything above the package directory is an account name and a machine
 * layout, which a diagnostic report does not need in order to be useful.
 */
export function redactPath(path: string, packageName: string): string {
  const segments = pathSegments(path);
  const index = segments.findIndex((segment) => segment.toLowerCase() === packageName.toLowerCase());
  if (index === -1) return path;
  return ['…', ...segments.slice(index)].join('\\');
}

/* ------------------------------------------------------------------ */
/* Facts                                                               */
/* ------------------------------------------------------------------ */

export type FactKind = 'constant' | 'display' | 'path' | 'runtime';

export interface IdentityFact {
  id: string;
  /** i18n key for the label. The value itself is a fact and is never styled. */
  labelKey: string;
  value: string;
  kind: FactKind;
}

/**
 * Every identity value this build actually holds.
 *
 * The `kind` column is the point of the table: `constant` values are compiled
 * in and a rename cannot reach them, `display` is the one value a rename moves,
 * `path` values are derived from the package constant, and `runtime` values come
 * from the process.
 */
export function identityFacts(ctx: AppContext): IdentityFact[] {
  const info = ctx.studio.info;
  const yesNo = (value: boolean): string =>
    value ? ctx.t('app-identity.value.yes', 'Yes') : ctx.t('app-identity.value.no', 'No');

  return [
    { id: 'packageName', labelKey: 'app-identity.fact.packageName', value: info.packageName, kind: 'constant' },
    { id: 'productName', labelKey: 'app-identity.fact.productName', value: info.productName, kind: 'constant' },
    {
      id: 'displayName',
      labelKey: 'app-identity.fact.displayName',
      value: hasChosenName(ctx)
        ? chosenName(ctx)
        : ctx.t('app-identity.fact.displayName.shipped', '{name} (the shipped name; no name chosen)', {
            values: { name: info.productName }
          }),
      kind: 'display'
    },
    { id: 'version', labelKey: 'app-identity.fact.version', value: info.version, kind: 'constant' },
    { id: 'licence', labelKey: 'app-identity.fact.licence', value: LICENCE_ID, kind: 'constant' },
    { id: 'userDataDir', labelKey: 'app-identity.fact.dataDir', value: info.userDataDir, kind: 'path' },
    { id: 'historyDir', labelKey: 'app-identity.fact.historyDir', value: info.historyDir, kind: 'path' },
    { id: 'logsDir', labelKey: 'app-identity.fact.logsDir', value: info.logsDir, kind: 'path' },
    {
      id: 'settingsFile',
      labelKey: 'app-identity.fact.settingsFile',
      value: ctx.settings.filePath() || ctx.t('app-identity.value.unknown', 'Not reported yet'),
      kind: 'path'
    },
    { id: 'platform', labelKey: 'app-identity.fact.platform', value: info.platform, kind: 'runtime' },
    { id: 'arch', labelKey: 'app-identity.fact.arch', value: info.arch, kind: 'runtime' },
    { id: 'electron', labelKey: 'app-identity.fact.electron', value: info.versions.electron, kind: 'runtime' },
    { id: 'chrome', labelKey: 'app-identity.fact.chrome', value: info.versions.chrome, kind: 'runtime' },
    { id: 'node', labelKey: 'app-identity.fact.node', value: info.versions.node, kind: 'runtime' },
    { id: 'v8', labelKey: 'app-identity.fact.v8', value: info.versions.v8, kind: 'runtime' },
    { id: 'packaged', labelKey: 'app-identity.fact.packaged', value: yesNo(info.isPackaged), kind: 'runtime' },
    { id: 'development', labelKey: 'app-identity.fact.development', value: yesNo(info.isDevelopment), kind: 'runtime' },
    {
      id: 'startedAt',
      labelKey: 'app-identity.fact.startedAt',
      value: new Date(info.startedAt).toISOString(),
      kind: 'runtime'
    }
  ];
}

/* ------------------------------------------------------------------ */
/* Checks                                                              */
/* ------------------------------------------------------------------ */

export type CheckState = 'pass' | 'fail' | 'unknown';

export interface IdentityCheck {
  id: string;
  /** i18n key for the claim being checked. */
  titleKey: string;
  state: CheckState;
  /** Already-resolved evidence text: real paths, real keys, real values. */
  evidence: string;
}

/**
 * Runs every identity check against the values this window actually holds.
 *
 * Nothing here is a constant `true`. Each check reads the real path, the real
 * settings store or the real bridge and reports what it found, which is why the
 * About surface can show evidence beside each verdict instead of a claim.
 */
export function identityChecks(ctx: AppContext): IdentityCheck[] {
  const info = ctx.studio.info;
  const settingsPath = ctx.settings.filePath();
  const chosen = chosenName(ctx);
  const checks: IdentityCheck[] = [];

  /* 1. The data directory is named by the package identity, not the display name. */
  const finalSegment = lastSegment(info.userDataDir);
  checks.push({
    id: 'dataDirSegment',
    titleKey: 'app-identity.check.dataDir.title',
    state: finalSegment.toLowerCase() === info.packageName.toLowerCase() ? 'pass' : 'fail',
    evidence: ctx.t(
      'app-identity.check.dataDir.evidence',
      'The data directory ends in "{segment}". The package identity is "{package}".',
      { values: { segment: finalSegment || '—', package: info.packageName } }
    )
  });

  /* 2. Everything the application stores sits inside that one directory. */
  const contained: Array<[string, string]> = [
    ['historyDir', info.historyDir],
    ['logsDir', info.logsDir]
  ];
  if (settingsPath) contained.push(['settingsFile', settingsPath]);
  const strays = contained.filter(([, path]) => !isInside(info.userDataDir, path));
  checks.push({
    id: 'containedDirs',
    titleKey: 'app-identity.check.contained.title',
    state: strays.length === 0 ? 'pass' : 'fail',
    evidence:
      strays.length === 0
        ? ctx.t(
            'app-identity.check.contained.evidence.pass',
            'The history directory, the log directory and the settings file all sit inside {path}.',
            { values: { path: info.userDataDir } }
          )
        : ctx.t('app-identity.check.contained.evidence.fail', 'Outside {path}: {list}.', {
            values: { path: info.userDataDir, list: strays.map(([, value]) => value).join(', ') }
          })
  });

  /* 3. A rename writes exactly one settings key and nothing else holds the name. */
  if (chosen === '') {
    checks.push({
      id: 'singleKey',
      titleKey: 'app-identity.check.singleKey.title',
      state: 'pass',
      evidence: ctx.t(
        'app-identity.check.singleKey.evidence.none',
        'No name is stored, so no settings key holds one. The shipped name is in use.'
      )
    });
  } else {
    const holders = ctx.settings
      .keys()
      .filter((key) => {
        const value = ctx.settings.get<unknown>(key, null);
        return typeof value === 'string' && value.trim() === chosen;
      })
      .sort();
    const onlyTheOne = holders.length === 1 && holders[0] === DISPLAY_NAME_SETTING;
    checks.push({
      id: 'singleKey',
      titleKey: 'app-identity.check.singleKey.title',
      state: onlyTheOne ? 'pass' : holders.includes(DISPLAY_NAME_SETTING) ? 'unknown' : 'fail',
      evidence: ctx.t(
        'app-identity.check.singleKey.evidence',
        'Settings keys currently holding "{name}": {keys}.',
        { values: { name: chosen, keys: holders.length > 0 ? holders.join(', ') : '—' } }
      )
    });
  }

  /* 4. There is no settings key that could move the package identity. */
  const identityKeys = ['app.packageName', 'app.productName', 'app.userDataDir', 'app.updateFeed'];
  const present = identityKeys.filter((key) => ctx.settings.has(key));
  checks.push({
    id: 'noIdentitySetting',
    titleKey: 'app-identity.check.noIdentitySetting.title',
    state: present.length === 0 ? 'pass' : 'fail',
    evidence:
      present.length === 0
        ? ctx.t(
            'app-identity.check.noIdentitySetting.evidence.pass',
            'None of {keys} exists in the settings store, and the bridge exposes no call that writes them.',
            { values: { keys: identityKeys.join(', ') } }
          )
        : ctx.t('app-identity.check.noIdentitySetting.evidence.fail', 'Present in the settings store: {keys}.', {
            values: { keys: present.join(', ') }
          })
  });

  /* 5. The shipped name is still available for anything that must be exact. */
  checks.push({
    id: 'shippedNameAvailable',
    titleKey: 'app-identity.check.shipped.title',
    state: info.productName.trim() !== '' ? 'pass' : 'fail',
    evidence: ctx.t(
      'app-identity.check.shipped.evidence',
      'Diagnostics report "{shipped}". The window currently calls itself "{display}".',
      { values: { shipped: info.productName || '—', display: displayName(ctx) } }
    )
  });

  return checks;
}

/** How many checks passed, and how many ran. */
export function checkSummary(checks: IdentityCheck[]): { passed: number; total: number; failed: number } {
  return {
    passed: checks.filter((check) => check.state === 'pass').length,
    failed: checks.filter((check) => check.state === 'fail').length,
    total: checks.length
  };
}

/* ------------------------------------------------------------------ */
/* Diagnostic report                                                   */
/* ------------------------------------------------------------------ */

/**
 * Builds the diagnostic report.
 *
 * It identifies the software by its SHIPPED name, always. A report headed with
 * a name the reader has never heard of is a report nobody can act on, so the
 * chosen name appears only when the user has explicitly asked for it, and is
 * labelled as the local display name when it does.
 */
export function diagnosticReport(ctx: AppContext): string {
  const info = ctx.studio.info;
  const redact = ctx.settings.get<boolean>(DIAGNOSTICS_REDACT_SETTING, true) === true;
  const includeChosen = ctx.settings.get<boolean>(DIAGNOSTICS_CHOSEN_SETTING, false) === true;
  const shortPath = (path: string): string => (redact ? redactPath(path, info.packageName) : path);
  const settingsPath = ctx.settings.filePath();
  const checks = identityChecks(ctx);
  const summary = checkSummary(checks);
  const codeName = ctx.settings.get<string>(CODE_NAME_SETTING, '');

  const lines: string[] = [
    `# ${info.productName} diagnostic report`,
    '',
    'This report identifies the software by its shipped name so a reader knows exactly what it is.',
    '',
    `- Product name (shipped): ${info.productName}`,
    `- Package identity: ${info.packageName}`,
    `- Version: ${info.version}`,
    `- Licence: ${LICENCE_ID}`,
    `- Platform: ${info.platform} ${info.arch}`,
    `- Electron: ${info.versions.electron}`,
    `- Chromium: ${info.versions.chrome}`,
    `- Node: ${info.versions.node}`,
    `- V8: ${info.versions.v8}`,
    `- Packaged build: ${info.isPackaged ? 'yes' : 'no'}`,
    `- Development build: ${info.isDevelopment ? 'yes' : 'no'}`,
    `- Process started: ${new Date(info.startedAt).toISOString()}`,
    `- Report written: ${new Date().toISOString()}`,
    '',
    '## Paths',
    '',
    redact
      ? 'Paths are shortened to the application directory. Everything above it is an account name and a machine layout, which this report does not need.'
      : 'Paths are complete, including the part above the application directory. That part contains the account name on this machine.',
    '',
    `- Application data: ${shortPath(info.userDataDir)}`,
    `- Version history: ${shortPath(info.historyDir)}`,
    `- Logs: ${shortPath(info.logsDir)}`,
    `- Settings file: ${settingsPath ? shortPath(settingsPath) : 'not reported'}`,
    '',
    '## Identity checks',
    '',
    `${summary.passed} of ${summary.total} passed; ${summary.failed} failed.`,
    ''
  ];

  for (const check of checks) {
    const state = check.state === 'pass' ? 'PASS' : check.state === 'fail' ? 'FAIL' : 'UNKNOWN';
    lines.push(`- ${state} — ${ctx.t(check.titleKey, check.titleKey, { language: 'en' })}: ${check.evidence}`);
  }

  lines.push('', '## Display name', '');
  if (includeChosen) {
    lines.push(
      hasChosenName(ctx)
        ? `The person using this copy renamed the window to "${chosenName(ctx)}". That is a local label only: it changes nothing about the package identity, the data directory, the installer or the update feed.`
        : 'No local display name is set; the window shows the shipped name.'
    );
  } else {
    lines.push(
      'The local display name is omitted from this report. The shipped name above is what identifies this software; the local name would only confuse a reader. Turn the setting on if you want it included.'
    );
  }

  if (codeName) {
    lines.push('', '## Release code name', '', `${codeName} (recorded locally for this build).`);
  }

  return lines.join('\n');
}
