import { safeJson } from './util';

/**
 * A structural comparison of two recorded payloads.
 *
 * It walks both sides together rather than diffing their serialized text, so a
 * key that merely moved does not read as an edit, and a nested change is
 * reported at the exact path it happened rather than as one enormous replaced
 * blob.
 */

export type ChangeKind = 'added' | 'removed' | 'changed';

export interface DiffRow {
  /** Dotted path into the payload, e.g. `values.port` or `items.0.name`. */
  path: string;
  kind: ChangeKind;
  left: string;
  right: string;
}

const MAX_ROWS = 500;
const MAX_DEPTH = 12;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function render(value: unknown): string {
  if (value === undefined) return '';
  if (typeof value === 'string') return value;
  return safeJson(value);
}

function walk(left: unknown, right: unknown, path: string, rows: DiffRow[], depth: number): void {
  if (rows.length >= MAX_ROWS) return;

  if (depth > MAX_DEPTH) {
    if (safeJson(left) !== safeJson(right)) {
      rows.push({ path: `${path} (below the depth limit)`, kind: 'changed', left: render(left), right: render(right) });
    }
    return;
  }

  const leftMissing = left === undefined;
  const rightMissing = right === undefined;
  if (leftMissing && rightMissing) return;
  if (leftMissing) {
    rows.push({ path, kind: 'added', left: '', right: render(right) });
    return;
  }
  if (rightMissing) {
    rows.push({ path, kind: 'removed', left: render(left), right: '' });
    return;
  }

  if (isPlainObject(left) && isPlainObject(right)) {
    const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])].sort();
    for (const key of keys) {
      walk(left[key], right[key], path === '' ? key : `${path}.${key}`, rows, depth + 1);
    }
    return;
  }

  if (Array.isArray(left) && Array.isArray(right)) {
    const length = Math.max(left.length, right.length);
    for (let index = 0; index < length; index += 1) {
      walk(left[index], right[index], `${path}.${index}`, rows, depth + 1);
    }
    return;
  }

  if (safeJson(left) !== safeJson(right)) {
    rows.push({ path: path === '' ? '(the whole payload)' : path, kind: 'changed', left: render(left), right: render(right) });
  }
}

export interface DiffResult {
  rows: DiffRow[];
  /** True when the walk stopped at the row ceiling rather than at the end. */
  truncated: boolean;
  identical: boolean;
}

export function diffPayloads(left: unknown, right: unknown): DiffResult {
  const rows: DiffRow[] = [];
  walk(left, right, '', rows, 0);
  return { rows: rows.slice(0, MAX_ROWS), truncated: rows.length >= MAX_ROWS, identical: rows.length === 0 };
}
