import type { FileStat, PlatformName, StudioApi } from '../../../shared/api';

/**
 * Finding, starting and stopping the console's Python service.
 *
 * The console is a Flask application that normally runs as a container's main
 * process. On a desktop it is a folder holding `app.py`, `auth.py`, its
 * templates and a `requirements.txt`. This module answers three questions that
 * a user in trouble genuinely needs separated: is it installed, is it running,
 * and is the thing that is running actually healthy. Collapsing those into one
 * "unavailable" is what makes a service surface useless.
 */

export function separatorFor(platform: PlatformName): string {
  return platform === 'win32' ? '\\' : '/';
}

export function joinPath(separator: string, ...parts: string[]): string {
  const cleaned = parts
    .filter((part) => part.length > 0)
    .map((part, index) => (index === 0 ? part.replace(/[\\/]+$/, '') : part.replace(/^[\\/]+|[\\/]+$/g, '')));
  return cleaned.join(separator);
}

export function baseName(path: string): string {
  const trimmed = path.replace(/[\\/]+$/, '');
  const index = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'));
  return index === -1 ? trimmed : trimmed.slice(index + 1);
}

export function parentOf(path: string): string {
  const trimmed = path.replace(/[\\/]+$/, '');
  const index = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'));
  return index <= 0 ? trimmed : trimmed.slice(0, index);
}

/** Python launchers the privileged bridge is willing to start. */
export const PYTHON_COMMANDS = ['py', 'python', 'python3'] as const;
export type PythonCommand = (typeof PYTHON_COMMANDS)[number];

export function normalizePythonCommand(raw: unknown): PythonCommand {
  const text = String(raw ?? '').trim().toLowerCase();
  return (PYTHON_COMMANDS as readonly string[]).includes(text) ? (text as PythonCommand) : 'py';
}

/**
 * The arguments in front of the script.
 *
 * The Windows launcher takes a version selector; the interpreters do not, and
 * passing one to them makes the interpreter try to open a file called `-3`.
 */
export function pythonPrefixArgs(command: PythonCommand): string[] {
  return command === 'py' ? ['-3'] : [];
}

export type InstallationState =
  | 'unset'
  | 'directory-missing'
  | 'not-a-directory'
  | 'app-missing'
  | 'ready';

export interface InstallationReport {
  state: InstallationState;
  /** The folder that was inspected. Empty when nothing is configured yet. */
  directory: string;
  appPath: string;
  authPath: string;
  requirementsPath: string;
  templatesPath: string;
  /** True when the file was found at that exact path. */
  hasApp: boolean;
  hasAuth: boolean;
  hasRequirements: boolean;
  hasTemplates: boolean;
  /** Bytes of `app.py`, so an obviously truncated copy is visible. */
  appBytes: number;
  /** Everything checked, in the order it was checked, for the evidence list. */
  checks: Array<{ label: string; path: string; found: boolean; detail: string }>;
}

async function statOf(studio: StudioApi, path: string): Promise<FileStat | null> {
  const result = await studio.fs.stat(path);
  return result.ok ? result.value : null;
}

/** Inspects a candidate console folder and reports exactly what is there. */
export async function inspectInstallation(studio: StudioApi, directory: string): Promise<InstallationReport> {
  const separator = separatorFor(studio.info.platform);
  const trimmed = directory.trim();
  const appPath = trimmed ? joinPath(separator, trimmed, 'app.py') : '';
  const authPath = trimmed ? joinPath(separator, trimmed, 'auth.py') : '';
  const requirementsPath = trimmed ? joinPath(separator, trimmed, 'requirements.txt') : '';
  const templatesPath = trimmed ? joinPath(separator, trimmed, 'templates') : '';

  const empty: InstallationReport = {
    state: 'unset',
    directory: trimmed,
    appPath,
    authPath,
    requirementsPath,
    templatesPath,
    hasApp: false,
    hasAuth: false,
    hasRequirements: false,
    hasTemplates: false,
    appBytes: 0,
    checks: []
  };
  if (!trimmed) return empty;

  const directoryStat = await statOf(studio, trimmed);
  if (!directoryStat || !directoryStat.exists) {
    return { ...empty, state: 'directory-missing', checks: [
      { label: 'Console folder', path: trimmed, found: false, detail: 'Nothing exists at that path.' }
    ] };
  }
  if (!directoryStat.isDirectory) {
    return { ...empty, state: 'not-a-directory', checks: [
      { label: 'Console folder', path: trimmed, found: false, detail: 'That path is a file, not a folder.' }
    ] };
  }

  const [app, auth, requirements, templates] = await Promise.all([
    statOf(studio, appPath),
    statOf(studio, authPath),
    statOf(studio, requirementsPath),
    statOf(studio, templatesPath)
  ]);

  const hasApp = Boolean(app?.exists && app.isFile);
  const hasAuth = Boolean(auth?.exists && auth.isFile);
  const hasRequirements = Boolean(requirements?.exists && requirements.isFile);
  const hasTemplates = Boolean(templates?.exists && templates.isDirectory);

  const checks: InstallationReport['checks'] = [
    { label: 'Console folder', path: trimmed, found: true, detail: 'Found.' },
    {
      label: 'app.py',
      path: appPath,
      found: hasApp,
      detail: hasApp ? `${app?.size ?? 0} bytes.` : 'Missing. Without it there is no console to start.'
    },
    {
      label: 'auth.py',
      path: authPath,
      found: hasAuth,
      detail: hasAuth ? 'Found.' : 'Missing. Minecraft account sign-in will fail at import time.'
    },
    {
      label: 'templates',
      path: templatesPath,
      found: hasTemplates,
      detail: hasTemplates ? 'Found.' : 'Missing. The browser pages will fail; the API routes this surface uses will not.'
    },
    {
      label: 'requirements.txt',
      path: requirementsPath,
      found: hasRequirements,
      detail: hasRequirements ? 'Found, so the dependencies can be installed from here.' : 'Missing, so dependencies have to be installed by hand.'
    }
  ];

  return {
    state: hasApp ? 'ready' : 'app-missing',
    directory: trimmed,
    appPath,
    authPath,
    requirementsPath,
    templatesPath,
    hasApp,
    hasAuth,
    hasRequirements,
    hasTemplates,
    appBytes: app?.size ?? 0,
    checks
  };
}

export interface StartOptions {
  report: InstallationReport;
  python: PythonCommand;
  port: number;
  dataDirectory: string;
  jarPath: string;
  username: string;
  /**
   * The console's own login password, read from the vault immediately before
   * the call and handed to the child process environment. It is never stored
   * anywhere by this feature, never rendered and never logged.
   */
  password?: string;
}

export interface StartPlan {
  command: PythonCommand;
  args: string[];
  cwd: string;
  /** Environment keys only. The values are never assembled for display. */
  environmentKeys: string[];
}

/** What starting the service would run, so it can be shown before it runs. */
export function planStart(options: StartOptions): StartPlan {
  const environmentKeys = ['WEB_PORT', 'DATA_DIR'];
  if (options.jarPath.trim()) environmentKeys.push('JAR_PATH');
  if (options.password) environmentKeys.push('WEB_USERNAME', 'WEB_PASSWORD');
  return {
    command: options.python,
    args: [...pythonPrefixArgs(options.python), options.report.appPath],
    cwd: options.report.directory,
    environmentKeys
  };
}

export interface StartOutcome {
  ok: boolean;
  processId?: string;
  pid?: number | null;
  error?: string;
}

/** Starts the console as a child process owned by this application. */
export async function startService(studio: StudioApi, options: StartOptions): Promise<StartOutcome> {
  if (options.report.state !== 'ready') {
    return {
      ok: false,
      error: 'The console folder does not contain app.py, so there is nothing to start.'
    };
  }
  const env: Record<string, string> = {
    WEB_PORT: String(options.port),
    DATA_DIR: options.dataDirectory
  };
  if (options.jarPath.trim()) env.JAR_PATH = options.jarPath.trim();
  if (options.password) {
    env.WEB_USERNAME = options.username.trim() || 'admin';
    env.WEB_PASSWORD = options.password;
  } else {
    // An empty password is exactly how the console disables its own login gate,
    // and it is the only configuration this application can then talk to.
    env.WEB_PASSWORD = '';
  }

  const plan = planStart(options);
  const result = await studio.process.spawn({
    command: plan.command,
    args: plan.args,
    cwd: plan.cwd,
    env,
    maxOutputBytes: 4 * 1024 * 1024
  });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, processId: result.value.id, pid: result.value.pid };
}

/** Installs the console's Python dependencies from its own requirements file. */
export async function installRequirements(
  studio: StudioApi,
  report: InstallationReport,
  python: PythonCommand
): Promise<StartOutcome> {
  if (!report.hasRequirements) {
    return { ok: false, error: 'There is no requirements.txt in that folder, so there is no list to install from.' };
  }
  const result = await studio.process.spawn({
    command: python,
    args: [...pythonPrefixArgs(python), '-m', 'pip', 'install', '--user', '-r', report.requirementsPath],
    cwd: report.directory,
    maxOutputBytes: 4 * 1024 * 1024
  });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, processId: result.value.id, pid: result.value.pid };
}

/**
 * Every service state this surface distinguishes.
 *
 * They exist separately because each one has a different recovery action, and
 * a person looking at a stopped console needs a start button while a person
 * looking at an unhealthy one needs to know what answered instead.
 */
export type ServiceState =
  | 'unconfigured'
  | 'not-installed'
  | 'stopped'
  | 'starting'
  | 'running'
  | 'running-elsewhere'
  | 'login-gated'
  | 'unhealthy'
  | 'exited';

export interface ServiceSnapshot {
  state: ServiceState;
  /** Exactly what was observed, in one sentence. */
  detail: string;
  /** Set when a probe reached the port and something answered. */
  status?: number;
  /** Milliseconds the last successful health probe took. */
  latencyMs?: number;
  /** True when this application owns the running process. */
  owned: boolean;
  /** The owned process's exit code, when it has ended. */
  exitCode?: number | null;
  /** ISO-8601 timestamp of the observation. */
  observedAt: string;
}

/** The emoji this feature uses for a state. Stable, and never a claim. */
export function stateEmoji(state: ServiceState): string {
  switch (state) {
    case 'running':
    case 'running-elsewhere':
      return '✅';
    case 'starting':
      return '🏃';
    case 'stopped':
    case 'exited':
      return '⏹️';
    case 'login-gated':
      return '🔒';
    case 'unhealthy':
      return '❌';
    case 'not-installed':
    case 'unconfigured':
    default:
      return '🧱';
  }
}
