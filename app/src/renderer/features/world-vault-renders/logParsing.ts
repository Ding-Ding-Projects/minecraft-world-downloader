/**
 * Reading a renderer's console output honestly.
 *
 * A percentage is reported only when the tool's own output actually states
 * one; when it does not, the caller shows the task description and the raw
 * log instead of inventing a number. Completion and failure for the render
 * phase are decided by the process's own exit code, never by matching a
 * "finished" string this application does not control the wording of — an
 * exit code cannot silently stop matching after a renderer's own log format
 * changes.
 */

export interface ProgressLine {
  description: string;
  fraction: number;
}

/** Matches "<task description>: NN[.N]%", the common shape this family of tool logs progress in. */
export function parseProgressLine(line: string): ProgressLine | null {
  const match = /([^[\]:]+):\s*(\d+(?:\.\d+)?)%/.exec(line);
  if (!match || !match[1] || !match[2]) return null;
  const percent = Number.parseFloat(match[2]);
  if (!Number.isFinite(percent)) return null;
  return { description: match[1].trim(), fraction: Math.min(1, Math.max(0, percent / 100)) };
}

/** Matches a line reporting the loopback host and port the webserver bound. */
export function parseListeningLine(line: string): { host: string; port: number } | null {
  const match = /listening on\s+([0-9a-zA-Z.:_-]+):(\d{1,5})\b/i.exec(line);
  if (!match || !match[1] || !match[2]) return null;
  const port = Number.parseInt(match[2], 10);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) return null;
  return { host: match[1], port };
}

export function isErrorLine(line: string): boolean {
  return /\[ERROR]|\bERROR\b|Exception in thread|Caused by:/.test(line);
}

/** Strips a `[timestamp] [LEVEL]`-shaped prefix, for a readable log without a redundant clock. */
export function stripLogPrefix(line: string): string {
  return line.replace(/^\[[^\]]*\]\s*\[[A-Z]+\]\s*/, '').trim();
}
