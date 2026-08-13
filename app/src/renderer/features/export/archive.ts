import type { StudioApi } from '../../../shared/api';

/**
 * Archives: ZIP and 7z, with the whole 7z option set rather than one hard-coded
 * default.
 *
 * Three things this module refuses to fudge.
 *
 * Every entry is stored at a RELATIVE path under one root folder. The archiver
 * is run with its working directory set to the folder that contains that root
 * and is handed the root's bare name, so nothing in the archive can carry a
 * drive letter, a leading separator or a `..` segment, and extracting it can
 * never write outside the directory it was extracted into.
 *
 * An encrypted archive is never described as protected while its file names sit
 * in the clear. ZIP genuinely cannot encrypt its central directory, so choosing
 * ZIP with encryption disables the encrypt-names control and states the reason
 * on the control itself instead of leaving a switch that silently does nothing.
 *
 * The archiver is a real external program and is either reachable or it is not.
 * `probeArchiver` asks the privileged bridge for it and reports the exact answer
 * that came back, including a refusal. Nothing here simulates an archive, and no
 * control claims to have written one that was not written.
 */

export type ArchiveFormat = 'zip' | '7z';

export type ArchiveMethod = 'LZMA2' | 'LZMA' | 'PPMd' | 'BZip2' | 'Deflate' | 'Copy';

export interface ArchiveOptions {
  format: ArchiveFormat;
  method: ArchiveMethod;
  /** 0 store, 1 fastest, 3 fast, 5 normal, 7 maximum, 9 ultra. */
  level: number;
  /** `-md`; `-mmem` for PPMd, where it is the model memory, and the BZip2 block size. */
  dictionary: string;
  /** `-mfb` for the LZMA family and Deflate; `-mo` (model order) for PPMd. */
  wordSize: number;
  solid: boolean;
  /** `-ms=` size when solid is on, e.g. `4g`. `on` means one block for everything. */
  solidBlock: string;
  /** `off`, a thread count, or `on` for the archiver's own choice. */
  threads: string;
  /** `-v` volume size, e.g. `100m`. Empty means one file. */
  volume: string;
  encrypt: boolean;
  /** Held only for the length of one run. Never stored, logged or exported. */
  password: string;
  /** 7z only: `-mhe=on` encrypts the file names as well as the contents. */
  encryptHeaders: boolean;
}

export const DEFAULT_ARCHIVE_OPTIONS: ArchiveOptions = {
  format: '7z',
  method: 'LZMA2',
  level: 5,
  dictionary: '16m',
  wordSize: 32,
  solid: true,
  solidBlock: '4g',
  threads: 'on',
  volume: '',
  encrypt: false,
  password: '',
  encryptHeaders: true
};

export const ARCHIVE_LEVELS = [
  { value: '0', label: '0 — store, no compression' },
  { value: '1', label: '1 — fastest' },
  { value: '3', label: '3 — fast' },
  { value: '5', label: '5 — normal' },
  { value: '7', label: '7 — maximum' },
  { value: '9', label: '9 — ultra' }
];

export const DICTIONARY_SIZES = ['64k', '256k', '1m', '4m', '16m', '32m', '64m', '128m', '256m', '512m', '1024m', '1536m'];

export const SOLID_BLOCK_SIZES = ['on', '1m', '4m', '16m', '64m', '256m', '1g', '4g', '16g', '64g'];

export const VOLUME_SIZES = ['', '10m', '25m', '50m', '100m', '250m', '700m', '1g', '2g', '4g'];

export const METHODS_BY_FORMAT: Record<ArchiveFormat, ArchiveMethod[]> = {
  '7z': ['LZMA2', 'LZMA', 'PPMd', 'BZip2', 'Deflate', 'Copy'],
  zip: ['Deflate', 'BZip2', 'LZMA', 'PPMd', 'Copy']
};

/* ------------------------------------------------------------------ */
/* Which knobs apply, and why one does not                             */
/* ------------------------------------------------------------------ */

export interface Applicability {
  applies: boolean;
  /** Stated on the control itself whenever `applies` is false. */
  reason: string;
}

const OK: Applicability = { applies: true, reason: '' };

export function dictionaryApplies(options: ArchiveOptions): Applicability {
  if (options.method === 'Copy') return { applies: false, reason: 'Copy stores the bytes unchanged, so there is no dictionary.' };
  if (options.method === 'Deflate') return { applies: false, reason: 'Deflate has a fixed 32 KiB window, which is not adjustable.' };
  return OK;
}

export function wordSizeApplies(options: ArchiveOptions): Applicability {
  if (options.method === 'Copy') return { applies: false, reason: 'Copy stores the bytes unchanged, so it never looks for a match.' };
  if (options.method === 'BZip2') return { applies: false, reason: 'BZip2 has no word size; its block size is set by the dictionary control.' };
  return OK;
}

export function solidApplies(options: ArchiveOptions): Applicability {
  if (options.format === 'zip') {
    return { applies: false, reason: 'ZIP compresses each entry on its own, so it has no solid mode.' };
  }
  if (options.method === 'Copy') return { applies: false, reason: 'Copy stores the bytes unchanged, so blocking them together changes nothing.' };
  return OK;
}

export function encryptHeadersApplies(options: ArchiveOptions): Applicability {
  if (options.format === 'zip') {
    return {
      applies: false,
      reason: 'ZIP cannot encrypt its central directory. The names of the files inside stay readable to anybody, even with AES-256 contents.'
    };
  }
  if (!options.encrypt) return { applies: false, reason: 'Nothing is encrypted, so there are no names to hide.' };
  return OK;
}

/** Options corrected so an inapplicable knob can never reach the command line. */
export function normalizeArchiveOptions(options: ArchiveOptions): ArchiveOptions {
  const methods = METHODS_BY_FORMAT[options.format];
  const method = methods.includes(options.method) ? options.method : methods[0];
  const corrected: ArchiveOptions = { ...options, method };
  if (!solidApplies(corrected).applies) corrected.solid = false;
  if (!encryptHeadersApplies(corrected).applies) corrected.encryptHeaders = false;
  if (!corrected.encrypt) corrected.password = '';
  return corrected;
}

/* ------------------------------------------------------------------ */
/* What each choice costs                                              */
/* ------------------------------------------------------------------ */

function parseSize(value: string): number {
  const match = /^(\d+)([kmg])$/i.exec(value.trim());
  if (!match) return 0;
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const scale = unit === 'k' ? 1024 : unit === 'm' ? 1024 * 1024 : 1024 * 1024 * 1024;
  return amount * scale;
}

function humanBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value >= 10 || index === 0 ? Math.round(value) : value.toFixed(1)} ${units[index]}`;
}

/**
 * The real memory and time cost of the current choices, in words and numbers.
 *
 * The multipliers are 7-Zip's own documented ones: the LZMA family needs roughly
 * ten and a half times the dictionary to compress and roughly the dictionary
 * itself to extract, and each additional compressing thread keeps its own
 * buffers.
 */
export function describeCost(options: ArchiveOptions): string[] {
  const lines: string[] = [];
  const explicitThreads = options.threads === 'off' || options.threads === 'on' ? null : Math.max(1, Number(options.threads) || 1);

  if (options.method === 'LZMA2' || options.method === 'LZMA') {
    const dictionary = parseSize(options.dictionary);
    const perThread = dictionary * 10.5;
    const multiplier = options.method === 'LZMA2' && explicitThreads !== null ? explicitThreads : 1;
    lines.push(
      `Compressing needs about ${humanBytes(perThread * multiplier)} of memory: roughly 10.5 times the ${
        options.dictionary
      } dictionary${
        options.method === 'LZMA2'
          ? explicitThreads !== null
            ? `, once for each of the ${explicitThreads} threads`
            : ', once for every compressing thread — and with threads left on the archiver picks the count itself, so the real figure is a multiple of this one'
          : ''
      }.`
    );
    lines.push(`Extracting needs about ${humanBytes(dictionary)}, roughly the dictionary itself. Anyone you send this to pays that.`);
  } else if (options.method === 'PPMd') {
    lines.push(
      `PPMd holds a model of about ${options.dictionary} in memory while compressing, and needs the same again to extract. It is markedly better on plain text and markedly slower than LZMA2.`
    );
    lines.push(`Model order ${options.wordSize}: higher order finds longer patterns, costs time, and gains little past about 16.`);
  } else if (options.method === 'BZip2') {
    lines.push(`BZip2 works in blocks of ${options.dictionary} and parallelizes across them. Memory is modest; the speed is middling in both directions.`);
  } else if (options.method === 'Deflate') {
    lines.push('Deflate has a fixed 32 KiB window. It is the fastest and the weakest of these, and every tool on earth can read it.');
  } else {
    lines.push('Copy writes the bytes unchanged. The archive is the size of its contents plus headers, and it is written as fast as the disk allows.');
  }

  if (options.level === 0) {
    lines.push('Level 0 stores without compressing whatever the method says.');
  } else if (options.level >= 9) {
    lines.push('Level 9 is ultra: the slowest search for the smallest result. Expect several times the time of level 5 for a few percent.');
  }

  if (options.solid) {
    lines.push(
      options.solidBlock === 'on'
        ? 'One solid block for everything: the best compression for many small files, and reading any single file back means decompressing all of them.'
        : `Solid blocks of ${options.solidBlock}: better compression than separate entries, and reading one file back means decompressing its whole block.`
    );
  } else if (options.format === '7z') {
    lines.push('Not solid: each file compresses on its own, so a single file is cheap to read back and many small files compress worse.');
  }

  if (options.threads === 'off') lines.push('One thread: the slowest wall-clock time and the smallest memory footprint.');
  else if (options.threads !== 'on') lines.push(`${options.threads} threads: proportionally more memory, and wall-clock time down roughly in step until the disk becomes the limit.`);

  if (options.volume) {
    lines.push(`Split into ${options.volume} volumes. Every part is needed to extract; losing one loses the archive.`);
  }

  if (options.encrypt) {
    lines.push('AES-256 encryption adds little time. Losing the password loses the archive: there is no recovery route, by design.');
  }

  return lines;
}

/* ------------------------------------------------------------------ */
/* Command planning                                                    */
/* ------------------------------------------------------------------ */

export interface ArchivePlan {
  command: string;
  args: string[];
  /** The same argument list with the password replaced, safe to display. */
  displayArgs: string[];
  /** Working directory: the parent of the root folder, so paths stay relative. */
  cwd: string;
  /** Absolute path of the archive that will be written. */
  archivePath: string;
  /** The one folder every entry sits under, inside the archive. */
  root: string;
}

const PASSWORD_MASK = '********';

export function planArchive(input: {
  command: string;
  options: ArchiveOptions;
  /** Absolute path of the directory that holds the root folder. */
  parentDirectory: string;
  /** Bare folder name; never a path, never absolute. */
  root: string;
  separator: string;
}): ArchivePlan {
  const options = normalizeArchiveOptions(input.options);
  const args: string[] = ['a', `-t${options.format}`];

  if (options.format === '7z') {
    args.push(`-m0=${options.method}`);
  } else if (options.method !== 'Deflate') {
    args.push(`-mm=${options.method}`);
  }

  args.push(`-mx=${options.level}`);

  if (dictionaryApplies(options).applies && options.level > 0) {
    // PPMd sizes its model with `mem`, not with a dictionary. Emitting `-md` for
    // it produces a switch the archiver rejects outright, so the same control
    // has to write a different switch depending on the method it is sizing.
    args.push(options.method === 'PPMd' ? `-mmem=${options.dictionary}` : `-md=${options.dictionary}`);
  }
  if (wordSizeApplies(options).applies && options.level > 0) {
    args.push(options.method === 'PPMd' ? `-mo=${options.wordSize}` : `-mfb=${options.wordSize}`);
  }
  if (solidApplies(options).applies) args.push(`-ms=${options.solid ? options.solidBlock : 'off'}`);
  args.push(`-mmt=${options.threads}`);
  if (options.volume) args.push(`-v${options.volume}`);

  if (options.encrypt) {
    if (options.format === 'zip') args.push('-mem=AES256');
    if (options.encryptHeaders) args.push('-mhe=on');
  }

  // The switch terminator matters: without it a root folder whose name begins
  // with a hyphen would be read by the archiver as another switch.
  args.push('-r', '-y', '--');

  const archiveName = `${input.root}.${options.format}`;
  const archivePath = `${input.parentDirectory}${input.separator}${archiveName}`;
  const displayArgs = [...args];

  if (options.encrypt) {
    args.splice(args.length - 3, 0, `-p${options.password}`);
    displayArgs.splice(displayArgs.length - 3, 0, `-p${PASSWORD_MASK}`);
  }

  args.push(archiveName, input.root);
  displayArgs.push(archiveName, input.root);

  return {
    command: input.command,
    args,
    displayArgs,
    cwd: input.parentDirectory,
    archivePath,
    root: input.root
  };
}

export function renderCommandLine(command: string, args: string[]): string {
  const quote = (value: string): string => (/[\s"]/.test(value) ? `"${value.replace(/"/g, '\\"')}"` : value);
  return [command, ...args].map(quote).join(' ');
}

/* ------------------------------------------------------------------ */
/* Running an external archiver through the privileged bridge          */
/* ------------------------------------------------------------------ */

export interface CommandOutcome {
  started: boolean;
  /** Present when the bridge refused to start the command at all. */
  refusal?: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

/**
 * Runs one command and waits for it to finish.
 *
 * A refusal from the bridge and a non-zero exit are different outcomes and are
 * reported as different outcomes: "the archiver could not be started" and "the
 * archiver ran and failed" send a reader to completely different places.
 */
export async function runCommand(
  studio: StudioApi,
  request: { command: string; args: string[]; cwd?: string; timeoutMs?: number }
): Promise<CommandOutcome> {
  const spawned = await studio.process.spawn({
    command: request.command,
    args: request.args,
    cwd: request.cwd,
    timeoutMs: request.timeoutMs ?? 300_000,
    maxOutputBytes: 512 * 1024
  });

  if (!spawned.ok) {
    return { started: false, refusal: spawned.error, exitCode: null, stdout: '', stderr: '', timedOut: false };
  }

  const id = spawned.value.id;
  let stdout = '';
  let stderr = '';

  return new Promise<CommandOutcome>((resolve) => {
    let settled = false;
    const finish = (outcome: CommandOutcome): void => {
      if (settled) return;
      settled = true;
      unsubscribe();
      window.clearTimeout(guard);
      resolve(outcome);
    };

    const unsubscribe = studio.events.on('process:event', (event) => {
      if (event.id !== id) return;
      if (event.kind === 'stdout') stdout += event.chunk;
      else if (event.kind === 'stderr') stderr += event.chunk;
      else if (event.kind === 'error') {
        finish({ started: true, exitCode: null, stdout, stderr: `${stderr}${event.message}`, timedOut: false });
      } else if (event.kind === 'exit') {
        finish({ started: true, exitCode: event.code, stdout, stderr, timedOut: false });
      }
    });

    // The bridge has its own timeout, but a lost exit event would otherwise leave
    // this promise pending forever and the surface spinning with nothing behind it.
    const guard = window.setTimeout(
      () => finish({ started: true, exitCode: null, stdout, stderr, timedOut: true }),
      (request.timeoutMs ?? 300_000) + 5_000
    );
  });
}

export interface ArchiverProbe {
  available: boolean;
  /** The command that answered, when one did. */
  command: string | null;
  /** Every command that was tried, in order. */
  tried: string[];
  /** The exact reason the last attempt failed, verbatim from the bridge. */
  reason: string;
}

export const ARCHIVER_CANDIDATES = ['7z', '7za', '7zz'];

/**
 * Asks the privileged bridge for an archiver and reports exactly what came back.
 *
 * `7z i` prints the build's method table and exits zero, which makes it a cheap
 * and unambiguous "are you there" that touches no file.
 */
export async function probeArchiver(studio: StudioApi, preferred: string): Promise<ArchiverProbe> {
  const candidates = [preferred.trim(), ...ARCHIVER_CANDIDATES].filter(
    (candidate, index, all) => candidate.length > 0 && all.indexOf(candidate) === index
  );
  const tried: string[] = [];
  let reason = 'No archiver command was tried.';

  for (const candidate of candidates) {
    tried.push(candidate);
    const outcome = await runCommand(studio, { command: candidate, args: ['i'], timeoutMs: 10_000 });
    if (!outcome.started) {
      reason = outcome.refusal ?? 'The command could not be started and no reason was given.';
      continue;
    }
    if (outcome.timedOut) {
      reason = `${candidate} started but never reported an exit.`;
      continue;
    }
    if (outcome.exitCode === 0) {
      return { available: true, command: candidate, tried, reason: '' };
    }
    reason = `${candidate} exited with code ${String(outcome.exitCode)}: ${(outcome.stderr || outcome.stdout).trim().slice(0, 400)}`;
  }

  return { available: false, command: null, tried, reason };
}

/* ------------------------------------------------------------------ */
/* Entries                                                             */
/* ------------------------------------------------------------------ */

export interface ArchiveEntry {
  /** Relative, forward-slashed, and guaranteed free of `..` and drive letters. */
  relativePath: string;
  text: string;
  /** One line naming what this entry is, for the manifest. */
  describes: string;
}

/**
 * Forces a candidate name into a safe relative path.
 *
 * Absolute paths, drive letters, parent traversal and reserved characters are
 * all removed rather than rejected, because the caller is naming an entry after
 * a source id and an extension, and a silent refusal there would drop a file
 * from the archive without anybody noticing.
 */
export function safeRelativePath(candidate: string): string {
  const forward = candidate.replace(/\\/g, '/');
  const withoutDrive = forward.replace(/^[A-Za-z]:/, '');
  const segments = withoutDrive
    .split('/')
    .map((segment) =>
      segment
        // Reserved on Windows, and a control character is reserved everywhere.
        .replace(new RegExp('[<>:"|?*\u0000-\u001f]', 'g'), '_')
        .replace(/\s+/g, '_')
        // A trailing dot or space is dropped silently by Windows, which turns two
        // distinct entry names into one file that overwrites the other.
        .replace(/[. ]+$/, '')
    )
    .filter((segment) => segment.length > 0 && segment !== '.' && segment !== '..');
  const path = segments.join('/');
  return path.length > 0 ? path : 'entry';
}

/** The manifest that names everything inside, written into the archive itself. */
export function buildManifest(input: {
  entries: ArchiveEntry[];
  options: ArchiveOptions;
  root: string;
  commandLine: string;
  generatedAt: string;
  productName: string;
  version: string;
}): string {
  const options = normalizeArchiveOptions(input.options);
  const lines: string[] = [
    `# ${input.root}`,
    '',
    `Written by ${input.productName} ${input.version} on ${input.generatedAt}.`,
    '',
    'Every entry below is stored at a relative path under this one folder, so extracting this archive cannot write outside the directory you extract it into.',
    '',
    '## Contents',
    '',
    '| Entry | What it is |',
    '| --- | --- |'
  ];
  for (const entry of input.entries) {
    lines.push(`| \`${entry.relativePath}\` | ${entry.describes.replace(/\|/g, '\\|')} |`);
  }
  lines.push(
    '',
    '## How it was written',
    '',
    `- Format: ${options.format}`,
    `- Method: ${options.method}`,
    `- Level: ${options.level}`,
    `- Dictionary: ${dictionaryApplies(options).applies ? options.dictionary : 'not applicable to this method'}`,
    `- Word size: ${wordSizeApplies(options).applies ? String(options.wordSize) : 'not applicable to this method'}`,
    `- Solid: ${solidApplies(options).applies ? (options.solid ? options.solidBlock : 'off') : 'not applicable to this format'}`,
    `- Threads: ${options.threads}`,
    `- Volumes: ${options.volume || 'one file'}`,
    `- Encryption: ${options.encrypt ? 'AES-256' : 'none'}`,
    `- File names encrypted: ${options.encrypt ? (options.encryptHeaders ? 'yes' : 'no — the names inside are readable without the password') : 'not applicable'}`,
    '',
    '## The command',
    '',
    '```',
    input.commandLine,
    '```',
    '',
    'The password, when there is one, is shown above as `********` and appears nowhere in this file.',
    ''
  );
  return lines.join('\n');
}
