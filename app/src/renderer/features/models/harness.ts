import type { ProcessEvent, Result, SpawnHandle, StudioApi } from '../../../shared/api';
import type { HarnessArgument, HarnessProfile, HarnessSnapshot, ModelsState } from './state';
import { describeError, nowIso } from './util';

/**
 * Harness profiles: this application orchestrating a local process, on the
 * user's behalf, against a model.
 *
 * The model runtime cannot launch a program. Nothing in this file pretends
 * otherwise: the launcher here is the application's own, and everything it can
 * run is allow-listed twice over — once by the privileged process bridge, which
 * accepts a bare executable name from a fixed list and never a shell, and again
 * by the schema below, which accepts an argument only as a typed token.
 *
 * There is no free-text command field anywhere in this feature, and there is no
 * place where two strings are joined into one. An argument is a literal drawn
 * from a bounded character set, an absolute path chosen through the native
 * browser, a number, or one of two substitutions the application itself fills
 * in. A value that fails validation is refused with the exact reason; it is
 * never trimmed, escaped or "cleaned up" into something that would run.
 */

/** Exactly the executables the privileged process bridge will accept. */
export const ALLOWED_COMMANDS = [
  'java',
  'javaw',
  'node',
  'npm',
  'npx',
  'docker',
  'docker-compose',
  'git',
  'python',
  'python3',
  'py',
  'mvn',
  'gradle'
] as const;

/** Environment keys a profile may set. Anything else is refused by name. */
export const ALLOWED_ENVIRONMENT_KEYS = [
  'OLLAMA_HOST',
  'OLLAMA_MODEL',
  'OLLAMA_MODELS',
  'OLLAMA_KEEP_ALIVE',
  'OLLAMA_NUM_PARALLEL',
  'OLLAMA_MAX_LOADED_MODELS',
  'MODEL',
  'MODEL_BASE_URL',
  'HOST',
  'PORT',
  'NODE_ENV',
  'PYTHONUNBUFFERED',
  'API_KEY'
] as const;

const LITERAL_PATTERN = /^[A-Za-z0-9._:@=+\-/]{1,200}$/;
const VAULT_ACCOUNT_PATTERN = /^[A-Za-z0-9._-]{1,80}$/;
const RELATIVE_FILE_PATTERN = /^[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/;

/** True for a path the operating system would treat as absolute. */
export function isAbsolutePath(value: string): boolean {
  const text = value.trim();
  if (text === '') return false;
  if (text.includes('\0')) return false;
  if (/(^|[\\/])\.\.([\\/]|$)/.test(text)) return false;
  return /^[A-Za-z]:[\\/]/.test(text) || text.startsWith('\\\\') || text.startsWith('/');
}

export interface ValidationIssue {
  field: string;
  message: string;
}

/** Validates one profile completely, naming every field that is wrong. */
export function validateProfile(profile: HarnessProfile): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (profile.name.trim() === '') {
    issues.push({ field: 'name', message: 'Give the profile a name so it can be told apart in the list.' });
  }
  if (!(ALLOWED_COMMANDS as readonly string[]).includes(profile.command)) {
    issues.push({
      field: 'command',
      message: `"${profile.command}" is not one of the executables this application may launch. Choose one from the list.`
    });
  }
  profile.args.forEach((argument, index) => {
    const issue = validateArgument(argument);
    if (issue) issues.push({ field: `args.${index}`, message: issue });
  });
  if (profile.workingDirectory.trim() !== '' && !isAbsolutePath(profile.workingDirectory)) {
    issues.push({
      field: 'workingDirectory',
      message:
        'The working directory must be an absolute path with no parent-directory steps in it. Use the browse control to choose one.'
    });
  }
  for (const entry of profile.environment) {
    if (!(ALLOWED_ENVIRONMENT_KEYS as readonly string[]).includes(entry.key)) {
      issues.push({ field: 'environment', message: `"${entry.key}" is not an environment key a profile may set.` });
      continue;
    }
    if (entry.source === 'vault') {
      if (!VAULT_ACCOUNT_PATTERN.test(entry.value)) {
        issues.push({
          field: 'environment',
          message: `The vault account name for ${entry.key} may use letters, digits, dots, dashes and underscores only.`
        });
      }
    } else if (/[\r\n\0]/.test(entry.value)) {
      issues.push({ field: 'environment', message: `The value for ${entry.key} may not contain a line break.` });
    } else if (entry.value.length > 512) {
      issues.push({ field: 'environment', message: `The value for ${entry.key} is longer than 512 characters.` });
    }
  }
  for (const port of profile.requiredPorts) {
    if (!Number.isInteger(port) || port < 1 || port > 65_535) {
      issues.push({ field: 'requiredPorts', message: `${port} is not a port number between 1 and 65535.` });
    }
  }
  for (const file of profile.requiredFiles) {
    if (!RELATIVE_FILE_PATTERN.test(file)) {
      issues.push({
        field: 'requiredFiles',
        message: `"${file}" is not a plain relative file name. Use names such as package.json or docker-compose.yml.`
      });
    }
  }
  if (profile.readinessMarker !== '' && /[\r\n\0]/.test(profile.readinessMarker)) {
    issues.push({ field: 'readinessMarker', message: 'The readiness marker may not contain a line break.' });
  }
  if (!Number.isFinite(profile.settleSeconds) || profile.settleSeconds < 1 || profile.settleSeconds > 120) {
    issues.push({ field: 'settleSeconds', message: 'The settle window must be between 1 and 120 seconds.' });
  }
  return issues;
}

function validateArgument(argument: HarnessArgument): string | null {
  switch (argument.kind) {
    case 'literal':
      return LITERAL_PATTERN.test(argument.value)
        ? null
        : `"${argument.value}" is refused. An argument may use letters, digits and the characters . _ : @ = + - / only, with no spaces and no shell characters.`;
    case 'path':
      return isAbsolutePath(argument.value)
        ? null
        : 'A path argument must be an absolute path with no parent-directory steps. Use the browse control to choose one.';
    case 'number':
      return Number.isFinite(argument.value) ? null : 'A numeric argument must be a number.';
    case 'model':
    case 'runtimeUrl':
      return null;
    default:
      return 'Unrecognised argument kind.';
  }
}

/** Renders the argument list exactly as it will be passed, for the preview. */
export function resolveArguments(profile: HarnessProfile, modelRef: string, runtimeUrl: string): string[] {
  return profile.args.map((argument) => {
    switch (argument.kind) {
      case 'literal':
        return argument.value;
      case 'path':
        return argument.value;
      case 'number':
        return String(argument.value);
      case 'model':
        return modelRef;
      case 'runtimeUrl':
        return runtimeUrl;
      default:
        return '';
    }
  });
}

/** The environment as it will be shown to a person: secrets never resolved. */
export function redactedEnvironment(
  profile: HarnessProfile,
  modelRef: string,
  runtimeUrl: string
): Array<{ key: string; display: string; secret: boolean }> {
  return profile.environment.map((entry) => {
    if (entry.source === 'vault') {
      return { key: entry.key, display: `from the operating system vault account "${entry.value}"`, secret: true };
    }
    const value = entry.value.replace('{model}', modelRef).replace('{runtimeUrl}', runtimeUrl);
    return { key: entry.key, display: value, secret: false };
  });
}

/* ------------------------------------------------------------------ */
/* Built-in templates                                                  */
/* ------------------------------------------------------------------ */

function template(partial: Partial<HarnessProfile> & { id: string; name: string; command: string }): HarnessProfile {
  return {
    description: '',
    builtin: true,
    args: [],
    workingDirectory: '',
    environment: [],
    requiredPorts: [],
    requiredFiles: [],
    readinessMarker: '',
    settleSeconds: 5,
    modelRef: '',
    updatedAt: nowIso(),
    lastLaunchAt: null,
    lastOutcome: null,
    ...partial
  };
}

/**
 * The profiles this application ships.
 *
 * They are templates rather than one-click launchers, and the surface says so:
 * a template names a real, allow-listed shape and leaves exactly the fields that
 * belong to somebody's own machine — which folder, which script — to be chosen
 * through a picker populated from that folder's real contents. Shipping a
 * template with a folder already in it would be shipping a guess about a
 * directory that does not exist.
 */
export function builtinProfiles(): HarnessProfile[] {
  return [
    template({
      id: 'models.harness.npm',
      name: 'Run an npm script in a local project',
      description:
        'Runs one script from a project you already have, with the runtime address and the chosen model in its environment. The script list is read from that project’s own package.json.',
      command: 'npm',
      args: [{ kind: 'literal', value: 'run' }],
      requiredFiles: ['package.json'],
      environment: [
        { key: 'OLLAMA_HOST', source: 'literal', value: '{runtimeUrl}' },
        { key: 'OLLAMA_MODEL', source: 'literal', value: '{model}' }
      ],
      settleSeconds: 5
    }),
    template({
      id: 'models.harness.compose',
      name: 'Bring up a Docker Compose stack in a local project',
      description:
        'Starts the compose stack defined in a folder you choose, with the runtime address in its environment. Nothing is downloaded by this application; Docker uses the images the compose file already names.',
      command: 'docker-compose',
      args: [
        { kind: 'literal', value: 'up' },
        { kind: 'literal', value: '-d' }
      ],
      requiredFiles: ['docker-compose.yml'],
      environment: [{ key: 'OLLAMA_HOST', source: 'literal', value: '{runtimeUrl}' }],
      settleSeconds: 10
    }),
    template({
      id: 'models.harness.python',
      name: 'Run a Python module in a local project',
      description:
        'Runs `python -m` against a module inside a folder you choose, with the runtime address and the chosen model in its environment.',
      command: 'python',
      args: [{ kind: 'literal', value: '-m' }],
      environment: [
        { key: 'OLLAMA_HOST', source: 'literal', value: '{runtimeUrl}' },
        { key: 'OLLAMA_MODEL', source: 'literal', value: '{model}' },
        { key: 'PYTHONUNBUFFERED', source: 'literal', value: '1' }
      ],
      settleSeconds: 5
    })
  ];
}

/* ------------------------------------------------------------------ */
/* Preflight                                                           */
/* ------------------------------------------------------------------ */

export interface PreflightCheck {
  label: string;
  status: 'pass' | 'blocked' | 'unchecked';
  /** What was found, and for a block the exact next action inside the app. */
  detail: string;
}

export interface PreflightReport {
  profile: HarnessProfile;
  command: string;
  args: string[];
  workingDirectory: string;
  environment: Array<{ key: string; display: string; secret: boolean }>;
  checks: PreflightCheck[];
  blockers: string[];
  modelRef: string;
  runtimeUrl: string;
}

/** Runs every check a launch depends on and reports each one by name. */
export async function preflight(state: ModelsState, profile: HarnessProfile, modelRef: string): Promise<PreflightReport> {
  const runtimeUrl = state.runtimeConfig().baseUrl;
  const args = resolveArguments(profile, modelRef, runtimeUrl);
  const checks: PreflightCheck[] = [];
  const blockers: string[] = [];

  const issues = validateProfile(profile);
  if (issues.length > 0) {
    checks.push({
      label: 'Profile schema',
      status: 'blocked',
      detail: issues.map((issue) => `${issue.field}: ${issue.message}`).join(' ')
    });
    blockers.push('Fix the profile fields listed above, then run the preflight again.');
  } else {
    checks.push({
      label: 'Profile schema',
      status: 'pass',
      detail: 'Every field passed the allow-listed schema: the executable, each argument token, the environment keys and the paths.'
    });
  }

  if (profile.builtin) {
    checks.push({
      label: 'Template',
      status: 'blocked',
      detail: 'This is a shipped template rather than a configured profile. Use Duplicate to make your own copy, then choose its folder.'
    });
    blockers.push('Duplicate this template into a profile of your own before launching it.');
  }

  if (profile.workingDirectory.trim() === '') {
    checks.push({
      label: 'Working directory',
      status: 'blocked',
      detail: 'No folder is chosen. Open the profile and use Browse beside the working directory field.'
    });
    blockers.push('Choose the working directory.');
  } else {
    const stat = await state.ctx.studio.fs.stat(profile.workingDirectory);
    if (!stat.ok) {
      checks.push({ label: 'Working directory', status: 'blocked', detail: stat.error });
      blockers.push('Choose a working directory this application can read.');
    } else if (!stat.value.exists || !stat.value.isDirectory) {
      checks.push({
        label: 'Working directory',
        status: 'blocked',
        detail: `${profile.workingDirectory} is not a folder that exists. Open the profile and choose another with Browse.`
      });
      blockers.push('Choose a working directory that exists.');
    } else {
      checks.push({ label: 'Working directory', status: 'pass', detail: `${profile.workingDirectory} exists and is a folder.` });
    }
  }

  for (const file of profile.requiredFiles) {
    if (profile.workingDirectory.trim() === '') break;
    const separator = profile.workingDirectory.includes('\\') ? '\\' : '/';
    const path = `${profile.workingDirectory.replace(/[\\/]+$/, '')}${separator}${file}`;
    const stat = await state.ctx.studio.fs.stat(path);
    if (stat.ok && stat.value.exists && stat.value.isFile) {
      checks.push({ label: `Required file ${file}`, status: 'pass', detail: `${path} is present.` });
    } else {
      checks.push({
        label: `Required file ${file}`,
        status: 'blocked',
        detail: `${path} is not there. Choose a folder that contains ${file}.`
      });
      blockers.push(`Choose a folder containing ${file}.`);
    }
  }

  if (modelRef.trim() === '') {
    checks.push({
      label: 'Model',
      status: 'blocked',
      detail: 'No model is selected. Choose one in the profile, or in the launch panel.'
    });
    blockers.push('Choose the model this profile runs against.');
  } else {
    const installed = state.installed.some((model) => model.name === modelRef);
    if (installed) {
      const variant = state.variant(modelRef);
      const fit = variant ? state.fitFor(variant) : null;
      checks.push({
        label: 'Model',
        status: 'pass',
        detail: `${modelRef} is installed. ${fit ? `Hardware fit: ${fit.headline}` : ''}`.trim()
      });
    } else {
      checks.push({
        label: 'Model',
        status: 'blocked',
        detail: `${modelRef} is not in the runtime's installed list. Add it to the pull queue from the Model store.`
      });
      blockers.push(`Install ${modelRef} before launching against it.`);
    }
  }

  for (const entry of profile.environment) {
    if (entry.source !== 'vault') continue;
    const has = await state.ctx.studio.vault.has(entry.value);
    if (has.ok && has.value) {
      checks.push({
        label: `Secret for ${entry.key}`,
        status: 'pass',
        detail: `The vault holds an entry for the account "${entry.value}". Its value is never displayed, logged or exported.`
      });
    } else {
      checks.push({
        label: `Secret for ${entry.key}`,
        status: 'blocked',
        detail: `The vault has no entry for the account "${entry.value}". Store one from the profile editor before launching.`
      });
      blockers.push(`Store the vault entry for ${entry.key}.`);
    }
  }

  if (profile.requiredPorts.length > 0) {
    checks.push({
      label: 'Ports',
      status: 'unchecked',
      detail: `This profile expects ${profile.requiredPorts.join(', ')} to be free. This application does not test a port, because testing one means binding it; the launch will report the process's own complaint if a port is taken.`
    });
  }

  const health = state.health;
  if (health?.reachable) {
    checks.push({
      label: 'Model runtime',
      status: 'pass',
      detail: `Version ${health.version ?? 'unreported'} answered at ${health.baseUrl}.`
    });
  } else {
    checks.push({
      label: 'Model runtime',
      status: 'blocked',
      detail: health?.error ?? 'The runtime has not been checked yet. Run the health check on the Local models tab.'
    });
    blockers.push('Start the model runtime before launching a harness against it.');
  }

  return {
    profile,
    command: profile.command,
    args,
    workingDirectory: profile.workingDirectory,
    environment: redactedEnvironment(profile, modelRef, runtimeUrl),
    checks,
    blockers,
    modelRef,
    runtimeUrl
  };
}

/* ------------------------------------------------------------------ */
/* Snapshots                                                           */
/* ------------------------------------------------------------------ */

let snapshotCounter = 0;

/**
 * Records the profile as it stands, with every environment value redacted.
 *
 * A snapshot is a record of shape, never of secrets: a literal value is kept
 * because it is not a secret by construction, and a vault-backed entry keeps
 * only the account name it points at.
 */
export function snapshotProfile(state: ModelsState, profile: HarnessProfile, reason: string): HarnessSnapshot {
  snapshotCounter += 1;
  const redacted: HarnessProfile = {
    ...profile,
    environment: profile.environment.map((entry) => ({ ...entry }))
  };
  const snapshot: HarnessSnapshot = {
    id: `snap-${Date.now().toString(36)}-${snapshotCounter.toString(36)}`,
    profileId: profile.id,
    takenAt: nowIso(),
    reason,
    profile: redacted
  };
  state.snapshots = [snapshot, ...state.snapshots].slice(0, 100);
  state.saveSnapshots();
  return snapshot;
}

/** Puts a snapshot back. The restore is itself recorded as a new snapshot. */
export function restoreSnapshot(state: ModelsState, snapshot: HarnessSnapshot): { ok: boolean; error: string | null } {
  const index = state.profiles.findIndex((profile) => profile.id === snapshot.profileId);
  if (index < 0) {
    state.profiles = [...state.profiles, { ...snapshot.profile, updatedAt: nowIso() }];
    state.saveProfiles();
    return { ok: true, error: null };
  }
  snapshotProfile(state, state.profiles[index], `Replaced by a restore of the snapshot taken at ${snapshot.takenAt}.`);
  state.profiles[index] = { ...snapshot.profile, updatedAt: nowIso() };
  state.saveProfiles();
  return { ok: true, error: null };
}

/* ------------------------------------------------------------------ */
/* Launch                                                              */
/* ------------------------------------------------------------------ */

export interface LaunchOutcome {
  started: boolean;
  ready: boolean;
  processId: string | null;
  pid: number | null;
  exitCode: number | null;
  /** Everything the process printed, bounded, for the launch report. */
  output: string;
  /** What actually happened, in words a person can act on. */
  summary: string;
  rolledBack: boolean;
}

/**
 * Launches a profile and judges whether it became ready.
 *
 * A snapshot is taken before the profile is touched. If the process refuses to
 * start, exits during the settle window, or never prints the readiness marker,
 * the snapshot is put back automatically and the report says so — a failed
 * launch must not leave a profile carrying the state of a run that did not
 * happen.
 */
export async function launchProfile(
  studio: StudioApi,
  state: ModelsState,
  profile: HarnessProfile,
  modelRef: string
): Promise<LaunchOutcome> {
  const before = snapshotProfile(state, profile, 'Taken automatically before a launch.');
  const runtimeUrl = state.runtimeConfig().baseUrl;
  const args = resolveArguments(profile, modelRef, runtimeUrl);

  const env: Record<string, string> = {};
  for (const entry of profile.environment) {
    if (entry.source === 'literal') {
      env[entry.key] = entry.value.replace('{model}', modelRef).replace('{runtimeUrl}', runtimeUrl);
      continue;
    }
    const secret = await studio.vault.get(entry.value);
    if (!secret.ok || secret.value === null) {
      rollback(state, profile, before);
      return {
        started: false,
        ready: false,
        processId: null,
        pid: null,
        exitCode: null,
        output: '',
        summary: `The vault has no value for the account "${entry.value}", which ${entry.key} needs. Nothing was launched and the profile was put back as it was.`,
        rolledBack: true
      };
    }
    env[entry.key] = secret.value;
  }

  let spawned: Result<SpawnHandle>;
  try {
    spawned = await studio.process.spawn({
      command: profile.command,
      args,
      cwd: profile.workingDirectory || undefined,
      env,
      maxOutputBytes: 512 * 1024
    });
  } catch (error) {
    rollback(state, profile, before);
    return {
      started: false,
      ready: false,
      processId: null,
      pid: null,
      exitCode: null,
      output: '',
      summary: `The launch failed before the process started: ${describeError(error)} The profile was put back as it was.`,
      rolledBack: true
    };
  }
  if (!spawned.ok) {
    rollback(state, profile, before);
    return {
      started: false,
      ready: false,
      processId: null,
      pid: null,
      exitCode: null,
      output: '',
      summary: `${profile.command} did not start: ${spawned.error} The profile was put back as it was.`,
      rolledBack: true
    };
  }

  const handle = spawned.value;
  const settleMs = Math.round(Math.min(Math.max(profile.settleSeconds, 1), 120) * 1000);

  const result = await new Promise<{ ready: boolean; exitCode: number | null; output: string; reason: string }>(
    (resolve) => {
      let output = '';
      let settled = false;
      const finish = (value: { ready: boolean; exitCode: number | null; output: string; reason: string }): void => {
        if (settled) return;
        settled = true;
        unsubscribe();
        window.clearTimeout(timer);
        resolve(value);
      };
      const unsubscribe = studio.events.on('process:event', (event: ProcessEvent) => {
        if (event.id !== handle.id) return;
        if (event.kind === 'stdout' || event.kind === 'stderr') {
          output = `${output}${event.chunk}`.slice(-16_000);
          if (profile.readinessMarker !== '' && output.includes(profile.readinessMarker)) {
            finish({ ready: true, exitCode: null, output, reason: `The process printed the readiness marker.` });
          }
        } else if (event.kind === 'exit') {
          finish({
            ready: false,
            exitCode: event.code,
            output,
            reason: `The process exited with code ${event.code ?? 'unknown'} during the ${profile.settleSeconds} second settle window.`
          });
        } else if (event.kind === 'error') {
          finish({ ready: false, exitCode: null, output, reason: event.message });
        }
      });
      const timer = window.setTimeout(() => {
        if (profile.readinessMarker === '') {
          finish({
            ready: true,
            exitCode: null,
            output,
            reason: `The process was still running after the ${profile.settleSeconds} second settle window, and no readiness marker is configured.`
          });
        } else {
          finish({
            ready: false,
            exitCode: null,
            output,
            reason: `The process never printed "${profile.readinessMarker}" within the ${profile.settleSeconds} second settle window.`
          });
        }
      }, settleMs);
    }
  );

  if (!result.ready) {
    await studio.process.kill(handle.id);
    rollback(state, profile, before);
    return {
      started: true,
      ready: false,
      processId: handle.id,
      pid: handle.pid,
      exitCode: result.exitCode,
      output: result.output,
      summary: `${result.reason} The process was stopped and the profile was put back as it was.`,
      rolledBack: true
    };
  }

  const index = state.profiles.findIndex((entry) => entry.id === profile.id);
  if (index >= 0) {
    state.profiles[index] = {
      ...state.profiles[index],
      modelRef,
      lastLaunchAt: nowIso(),
      lastOutcome: result.reason,
      updatedAt: nowIso()
    };
    state.saveProfiles();
  }

  return {
    started: true,
    ready: true,
    processId: handle.id,
    pid: handle.pid,
    exitCode: null,
    output: result.output,
    summary: result.reason,
    rolledBack: false
  };
}

function rollback(state: ModelsState, profile: HarnessProfile, snapshot: HarnessSnapshot): void {
  const index = state.profiles.findIndex((entry) => entry.id === profile.id);
  if (index < 0) return;
  state.profiles[index] = { ...snapshot.profile, updatedAt: nowIso(), lastOutcome: 'Rolled back after a failed launch.' };
  state.saveProfiles();
}

/**
 * Reads the script names out of a project's package.json.
 *
 * This is what makes the script field a picker rather than a text box: the list
 * is the project's own, read from the folder the user chose, so a name that is
 * not really there cannot be selected.
 */
export async function readNpmScripts(studio: StudioApi, directory: string): Promise<Result<string[]>> {
  const separator = directory.includes('\\') ? '\\' : '/';
  const path = `${directory.replace(/[\\/]+$/, '')}${separator}package.json`;
  const read = await studio.fs.readText(path, 1024 * 1024);
  if (!read.ok) return { ok: false, error: `package.json could not be read at ${path}: ${read.error}` };
  try {
    const parsed = JSON.parse(read.value) as { scripts?: Record<string, unknown> };
    const scripts = parsed.scripts ?? {};
    const names = Object.keys(scripts).filter((name) => LITERAL_PATTERN.test(name));
    if (names.length === 0) return { ok: false, error: `${path} declares no scripts with names this launcher can pass.` };
    return { ok: true, value: names.sort((a, b) => a.localeCompare(b)) };
  } catch (error) {
    return { ok: false, error: `${path} is not valid JSON: ${describeError(error)}` };
  }
}
