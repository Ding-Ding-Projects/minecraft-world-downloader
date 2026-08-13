import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import type { EditorCandidate } from '../../shared/api';

/**
 * External editor detection and handoff.
 *
 * Visual Studio Code is the preferred target: everything the application can
 * export must be openable in it directly from the surface that produced the
 * file. Opening a folder opens it as a workspace root, so the file tree is
 * usable rather than a single file with no context.
 *
 * When no editor is found we say so plainly and let the caller offer the
 * download, rather than silently launching some other editor the user did not
 * ask for.
 */

interface Candidate {
  id: string;
  name: string;
  supportsFolder: boolean;
  /** Bare commands to try on PATH, in order. */
  commands: string[];
  /** Absolute paths to try, in order. `~` expands to the home directory. */
  paths: string[];
}

const WINDOWS_CANDIDATES: Candidate[] = [
  {
    id: 'vscode',
    name: 'Visual Studio Code',
    supportsFolder: true,
    commands: ['code.cmd', 'code'],
    paths: [
      '~/AppData/Local/Programs/Microsoft VS Code/bin/code.cmd',
      'C:/Program Files/Microsoft VS Code/bin/code.cmd'
    ]
  },
  {
    id: 'vscode-insiders',
    name: 'Visual Studio Code Insiders',
    supportsFolder: true,
    commands: ['code-insiders.cmd', 'code-insiders'],
    paths: [
      '~/AppData/Local/Programs/Microsoft VS Code Insiders/bin/code-insiders.cmd',
      'C:/Program Files/Microsoft VS Code Insiders/bin/code-insiders.cmd'
    ]
  },
  {
    id: 'vscodium',
    name: 'VSCodium',
    supportsFolder: true,
    commands: ['codium.cmd', 'codium'],
    paths: ['~/AppData/Local/Programs/VSCodium/bin/codium.cmd', 'C:/Program Files/VSCodium/bin/codium.cmd']
  },
  {
    id: 'notepadpp',
    name: 'Notepad++',
    supportsFolder: false,
    commands: ['notepad++.exe'],
    paths: ['C:/Program Files/Notepad++/notepad++.exe', 'C:/Program Files (x86)/Notepad++/notepad++.exe']
  },
  { id: 'notepad', name: 'Notepad', supportsFolder: false, commands: ['notepad.exe'], paths: [] }
];

const POSIX_CANDIDATES: Candidate[] = [
  {
    id: 'vscode',
    name: 'Visual Studio Code',
    supportsFolder: true,
    commands: ['code'],
    paths: ['/usr/bin/code', '/usr/local/bin/code', '/snap/bin/code', '/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code']
  },
  {
    id: 'vscode-insiders',
    name: 'Visual Studio Code Insiders',
    supportsFolder: true,
    commands: ['code-insiders'],
    paths: ['/usr/bin/code-insiders', '/usr/local/bin/code-insiders']
  },
  { id: 'vscodium', name: 'VSCodium', supportsFolder: true, commands: ['codium'], paths: ['/usr/bin/codium', '/snap/bin/codium'] },
  { id: 'nano', name: 'nano', supportsFolder: false, commands: ['nano'], paths: ['/usr/bin/nano'] }
];

function expand(path: string): string {
  return path.startsWith('~/') ? join(homedir(), path.slice(2)) : path;
}

async function exists(path: string): Promise<boolean> {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

function whichCommand(command: string): Promise<string | null> {
  return new Promise((resolve) => {
    const finder = process.platform === 'win32' ? 'where' : 'which';
    const child = spawn(finder, [command], { windowsHide: true });
    let out = '';
    child.stdout.on('data', (chunk: Buffer) => {
      out += chunk.toString('utf8');
    });
    child.on('error', () => resolve(null));
    child.on('close', (code) => {
      if (code !== 0) return resolve(null);
      const first = out.split(/\r?\n/).find((line) => line.trim().length > 0);
      resolve(first ? first.trim() : null);
    });
  });
}

let cache: EditorCandidate[] | null = null;

export async function detect(force = false): Promise<EditorCandidate[]> {
  if (cache && !force) return cache;
  const list = process.platform === 'win32' ? WINDOWS_CANDIDATES : POSIX_CANDIDATES;
  const out: EditorCandidate[] = [];
  for (const candidate of list) {
    let resolved: string | null = null;
    for (const command of candidate.commands) {
      resolved = await whichCommand(command);
      if (resolved) break;
    }
    if (!resolved) {
      for (const raw of candidate.paths) {
        const path = expand(raw);
        if (await exists(path)) {
          resolved = path;
          break;
        }
      }
    }
    out.push({
      id: candidate.id,
      name: candidate.name,
      command: resolved ?? candidate.commands[0] ?? '',
      available: resolved !== null,
      supportsFolder: candidate.supportsFolder
    });
  }
  cache = out;
  return out;
}

export async function open(
  target: string,
  options: { editorId?: string; asFolder?: boolean } = {}
): Promise<void> {
  const candidates = await detect();
  const available = candidates.filter((candidate) => candidate.available);
  if (available.length === 0) {
    throw new Error(
      'No external editor was found on this machine. Visual Studio Code is the preferred one; install it and try again.'
    );
  }
  const chosen = options.editorId
    ? available.find((candidate) => candidate.id === options.editorId)
    : available[0];
  if (!chosen) {
    throw new Error(`The editor "${options.editorId}" is not installed on this machine.`);
  }

  let path = target;
  if (options.asFolder) {
    const stats = await fs.stat(target).catch(() => null);
    path = stats?.isDirectory() ? target : dirname(target);
    if (!chosen.supportsFolder) {
      throw new Error(`${chosen.name} cannot open a folder as a workspace root.`);
    }
  }

  const args = chosen.supportsFolder && options.asFolder ? ['--new-window', path] : [path];
  const child = spawn(chosen.command, args, {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
    shell: false
  });
  child.unref();
}
