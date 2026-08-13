/**
 * Detecting the two things a render genuinely needs: a Java runtime, and a
 * chosen renderer (a BlueMap-compatible CLI jar or Node entry point).
 *
 * Both probes are real: they run the actual tool with `-version`/`--version`
 * and read what it prints, exactly as `worldlens/detect.ts` does for its own
 * renderer probe (this file does not import that one — per the ownership
 * rule, every feature directory owns its own copy of logic this small — but
 * the shape is deliberately the same, because it is the same real question
 * asked of the same family of tool). A probe that cannot answer says so in
 * words rather than guessing "not installed", because "the probe timed out"
 * and "it is not there" are different facts and only one of them is true.
 */

import type { StudioApi } from '../../../shared/api';
import type { JavaState, RendererKind, RendererState } from './types';

const PROBE_TIMEOUT_MS = 15_000;

async function waitForExit(studio: StudioApi, id: string, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const listed = await studio.process.list();
    if (listed.ok) {
      const entry = listed.value.find((summary) => summary.id === id);
      if (!entry || !entry.running) return true;
    }
    if (Date.now() >= deadline) return false;
    await new Promise<void>((resolve) => setTimeout(resolve, 200));
  }
}

/** Runs `java -version` (Java prints its version to stderr, not stdout) and reports what it found. */
export async function probeJava(studio: StudioApi): Promise<JavaState> {
  const spawned = await studio.process.spawn({
    command: 'java',
    args: ['-version'],
    maxOutputBytes: 16 * 1024,
    timeoutMs: PROBE_TIMEOUT_MS
  });
  if (!spawned.ok) {
    return { kind: 'missing', reason: spawned.error };
  }
  const id = spawned.value.id;
  const exited = await waitForExit(studio, id, PROBE_TIMEOUT_MS);
  const stdout = await studio.process.readOutput(id, 'stdout');
  const stderr = await studio.process.readOutput(id, 'stderr');
  if (!exited) {
    await studio.process.kill(id);
    return { kind: 'missing', reason: 'A Java runtime did not answer "java -version" within 15 seconds.' };
  }
  const text = `${stdout.ok ? stdout.value : ''}\n${stderr.ok ? stderr.value : ''}`;
  const match = /version\s+"([^"]+)"|version\s+(\S+)/.exec(text);
  const version = match ? (match[1] ?? match[2] ?? null) : null;
  if (version) return { kind: 'available', version };
  return {
    kind: 'missing',
    reason: 'A "java" command exists on this machine, but it did not print a version this reader recognised.'
  };
}

function classifyRendererKind(path: string): RendererKind {
  const lower = path.trim().toLowerCase();
  if (lower.endsWith('.jar')) return 'jar';
  if (lower.endsWith('.js') || lower.endsWith('.mjs') || lower.endsWith('.cjs')) return 'node';
  return 'unknown';
}

/** The command and leading arguments to launch a configured renderer path with. */
export function rendererLauncher(path: string, kind: RendererKind): { command: string; leading: string[] } | null {
  if (kind === 'jar') return { command: 'java', leading: ['-jar', path] };
  if (kind === 'node') return { command: 'node', leading: [path] };
  return null;
}

/** Validates a chosen renderer path against the filesystem. Does not run it. */
export async function validateRendererPath(studio: StudioApi, path: string): Promise<RendererState> {
  const trimmed = path.trim();
  if (trimmed === '') return { kind: 'unconfigured' };

  const stat = await studio.fs.stat(trimmed);
  if (!stat.ok) return { kind: 'invalid', path: trimmed, reason: stat.error };
  if (!stat.value.exists) return { kind: 'invalid', path: trimmed, reason: 'Nothing exists at that path.' };
  if (!stat.value.isFile) {
    return { kind: 'invalid', path: trimmed, reason: 'That path is a folder. Choose the renderer file itself.' };
  }

  const rendererKind = classifyRendererKind(trimmed);
  if (rendererKind === 'unknown') {
    return {
      kind: 'invalid',
      path: trimmed,
      reason: 'This is not a ".jar" file or a Node ".js"/".mjs"/".cjs" entry point.'
    };
  }
  return { kind: 'ready', path: trimmed, rendererKind };
}

/** Where a person gets a BlueMap-compatible CLI. Opened externally, never fetched by this app. */
export const BLUEMAP_RELEASES_URL = 'https://github.com/BlueMap-Minecraft/BlueMap/releases';
