/**
 * Structured-data readers and the text reshaping routes.
 *
 * A record source is anything that can honestly be read as a list of flat
 * objects: JSON, JSON Lines, comma-separated and tab-separated values. Once a
 * source is in that shape the application's own export service serializes it to
 * any of its ten formats, so the whole matrix is bundled code with no optional
 * dependency anywhere in it.
 *
 * Reading is deliberately narrow. There is no YAML, TOML or XML reader here,
 * and the catalog lists those source formats as unavailable naming exactly that
 * gap rather than half-parsing them.
 */

import { ConverterBoundary, Deadline, type ResourceLimits } from './limits';

export type RecordRow = Record<string, unknown>;

export interface RecordSet {
  rows: RecordRow[];
  /** Column order as the source presented it. */
  columns: string[];
  /** What the reader had to flatten or coerce, stated for the disclosure. */
  notes: string[];
}

/* ------------------------------------------------------------------ */
/* JSON and JSON Lines                                                 */
/* ------------------------------------------------------------------ */

function flatten(value: unknown, prefix: string, out: RecordRow, depth: number, limits: ResourceLimits, notes: Set<string>): void {
  if (depth > limits.depth) {
    throw new ConverterBoundary('depth', `A record nests deeper than the ${limits.depth}-level bound. Nothing was written.`);
  }
  if (value === null || typeof value !== 'object') {
    out[prefix] = value as string | number | boolean | null;
    return;
  }
  if (Array.isArray(value)) {
    const scalar = value.every((item) => item === null || typeof item !== 'object');
    if (scalar) {
      out[prefix] = value.join('; ');
      notes.add('An array of scalars was joined with "; " so it fits one column.');
      return;
    }
    value.forEach((item, index) => flatten(item, `${prefix}[${index}]`, out, depth + 1, limits, notes));
    notes.add('An array of objects was expanded into indexed columns.');
    return;
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) {
    out[prefix] = '';
    return;
  }
  for (const [key, child] of entries) {
    flatten(child, prefix.length === 0 ? key : `${prefix}.${key}`, out, depth + 1, limits, notes);
  }
  if (prefix.length > 0) notes.add('A nested object was flattened into dotted column names.');
}

function toRows(parsed: unknown, limits: ResourceLimits, notes: Set<string>): RecordRow[] {
  const list = Array.isArray(parsed) ? parsed : [parsed];
  if (list.length > limits.entries) {
    throw new ConverterBoundary(
      'entries',
      `The source holds ${list.length} records, past the ${limits.entries} bound. Nothing was written.`
    );
  }
  return list.map((item) => {
    const row: RecordRow = {};
    flatten(item, '', row, 0, limits, notes);
    return row;
  });
}

function columnsOf(rows: RecordRow[]): string[] {
  const seen: string[] = [];
  const index = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!index.has(key)) {
        index.add(key);
        seen.push(key);
      }
    }
  }
  return seen;
}

/** Reads a JSON document as a record set. */
export function readJson(text: string, limits: ResourceLimits, deadline: Deadline): RecordSet {
  deadline.check();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new ConverterBoundary(
      'malformed',
      `The source is not valid JSON: ${error instanceof Error ? error.message.split('\n')[0] : 'the parser refused it'}. Nothing was written.`
    );
  }
  const notes = new Set<string>();
  if (!Array.isArray(parsed)) notes.add('The document was a single object, so the result holds one record.');
  const rows = toRows(parsed, limits, notes);
  return { rows, columns: columnsOf(rows), notes: [...notes] };
}

/** Reads a JSON Lines document as a record set, one object per line. */
export function readJsonLines(text: string, limits: ResourceLimits, deadline: Deadline): RecordSet {
  const notes = new Set<string>();
  const rows: RecordRow[] = [];
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    if ((index & 0x3ff) === 0) deadline.check();
    const line = lines[index].trim();
    if (line.length === 0) continue;
    if (rows.length >= limits.entries) {
      throw new ConverterBoundary(
        'entries',
        `The source holds more than ${limits.entries} records, past the bound. Nothing was written.`
      );
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      throw new ConverterBoundary(
        'malformed',
        `Line ${index + 1} is not a valid JSON document, so the file is not JSON Lines. Nothing was written.`
      );
    }
    const row: RecordRow = {};
    flatten(parsed, '', row, 0, limits, notes);
    rows.push(row);
  }
  if (rows.length === 0) {
    throw new ConverterBoundary('malformed', 'The source holds no non-empty lines, so there is nothing to convert.');
  }
  return { rows, columns: columnsOf(rows), notes: [...notes] };
}

/* ------------------------------------------------------------------ */
/* Delimiter-separated values                                          */
/* ------------------------------------------------------------------ */

/**
 * Reads delimiter-separated values following RFC 4180's quoting rules.
 *
 * A quoted field may hold the delimiter, a carriage return and a doubled quote.
 * Rows with fewer fields than the header get empty values rather than being
 * dropped, and rows with more get numbered overflow columns, so no cell in the
 * source is ever silently discarded.
 */
export function readDelimited(
  text: string,
  delimiter: string,
  limits: ResourceLimits,
  deadline: Deadline
): RecordSet {
  const notes = new Set<string>();
  const fields: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let index = 0;

  const pushField = (): void => {
    row.push(field);
    field = '';
  };
  const pushRow = (): void => {
    pushField();
    if (row.length > 1 || row[0].length > 0) fields.push(row);
    row = [];
    if (fields.length > limits.entries + 1) {
      throw new ConverterBoundary(
        'entries',
        `The source holds more than ${limits.entries} rows, past the bound. Nothing was written.`
      );
    }
  };

  while (index < text.length) {
    if ((index & 0xffff) === 0) deadline.check();
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 2;
          continue;
        }
        quoted = false;
        index += 1;
        continue;
      }
      field += char;
      index += 1;
      continue;
    }
    if (char === '"' && field.length === 0) {
      quoted = true;
      index += 1;
      continue;
    }
    if (char === delimiter) {
      pushField();
      index += 1;
      continue;
    }
    if (char === '\r') {
      index += 1;
      continue;
    }
    if (char === '\n') {
      pushRow();
      index += 1;
      continue;
    }
    field += char;
    index += 1;
  }
  if (field.length > 0 || row.length > 0) pushRow();

  if (fields.length === 0) {
    throw new ConverterBoundary('malformed', 'The source holds no rows, so there is nothing to convert.');
  }

  const header = fields[0].map((cell, position) => (cell.trim().length > 0 ? cell.trim() : `column${position + 1}`));
  if (fields[0].some((cell) => cell.trim().length === 0)) {
    notes.add('An empty header cell was named after its position so no column is nameless.');
  }
  const rows: RecordRow[] = [];
  for (let line = 1; line < fields.length; line += 1) {
    const cells = fields[line];
    const record: RecordRow = {};
    for (let position = 0; position < Math.max(header.length, cells.length); position += 1) {
      const key = position < header.length ? header[position] : `overflow${position + 1}`;
      if (position >= header.length) notes.add('A row carried more cells than the header, so the extras became overflow columns.');
      record[key] = cells[position] ?? '';
      if (position >= cells.length) notes.add('A row carried fewer cells than the header, so the missing ones are empty.');
    }
    rows.push(record);
  }

  return { rows, columns: columnsOf(rows), notes: [...notes] };
}

/* ------------------------------------------------------------------ */
/* Text reshaping                                                      */
/* ------------------------------------------------------------------ */

export type LineEnding = 'lf' | 'crlf' | 'cr';

/** What a text reshaping route changed, stated back to the caller. */
export interface TextChange {
  /** Line endings found in the source, e.g. `mixed (LF and CRLF)`. */
  sourceEndings: string;
  lineCount: number;
  /** True when the source carried a UTF-8 byte order mark. */
  hadBom: boolean;
  bytesBefore: number;
  bytesAfter: number;
}

const BOM = '\uFEFF';

function describeEndings(text: string): string {
  const crlf = (text.match(/\r\n/g) ?? []).length;
  const withoutCrlf = text.replace(/\r\n/g, '');
  const lf = (withoutCrlf.match(/\n/g) ?? []).length;
  const cr = (withoutCrlf.match(/\r/g) ?? []).length;
  const present: string[] = [];
  if (crlf > 0) present.push(`CRLF x${crlf}`);
  if (lf > 0) present.push(`LF x${lf}`);
  if (cr > 0) present.push(`CR x${cr}`);
  if (present.length === 0) return 'none (single line, no terminator)';
  return present.length === 1 ? present[0] : `mixed (${present.join(', ')})`;
}

/** Rewrites every line terminator to one style. */
export function convertLineEndings(text: string, ending: LineEnding): { text: string; change: TextChange } {
  const hadBom = text.startsWith(BOM);
  const body = hadBom ? text.slice(1) : text;
  const sourceEndings = describeEndings(body);
  const normalized = body.replace(/\r\n|\r|\n/g, '\n');
  const terminator = ending === 'lf' ? '\n' : ending === 'crlf' ? '\r\n' : '\r';
  const out = normalized.replace(/\n/g, terminator);
  return {
    text: hadBom ? BOM + out : out,
    change: {
      sourceEndings,
      lineCount: normalized.split('\n').length,
      hadBom,
      bytesBefore: new TextEncoder().encode(text).length,
      bytesAfter: new TextEncoder().encode(hadBom ? BOM + out : out).length
    }
  };
}

/** Adds or removes the UTF-8 byte order mark, leaving the rest untouched. */
export function convertBom(text: string, add: boolean): { text: string; change: TextChange } {
  const hadBom = text.startsWith(BOM);
  const body = hadBom ? text.slice(1) : text;
  const out = add ? BOM + body : body;
  return {
    text: out,
    change: {
      sourceEndings: describeEndings(body),
      lineCount: body.split(/\r\n|\r|\n/).length,
      hadBom,
      bytesBefore: new TextEncoder().encode(text).length,
      bytesAfter: new TextEncoder().encode(out).length
    }
  };
}

/**
 * Converts leading indentation between tabs and spaces.
 *
 * Only the run of whitespace at the start of a line is touched, so a tab used
 * for alignment inside a line, or inside a string literal, is left exactly
 * where it is.
 */
export function convertIndentation(
  text: string,
  target: 'tabs' | 'spaces',
  width: number,
  deadline: Deadline
): { text: string; change: TextChange; convertedLines: number } {
  const hadBom = text.startsWith(BOM);
  const body = hadBom ? text.slice(1) : text;
  const sourceEndings = describeEndings(body);
  const lines = body.split(/\r\n|\r|\n/);
  let converted = 0;

  const out = lines.map((line, index) => {
    if ((index & 0x3ff) === 0) deadline.check();
    const match = /^[\t ]+/.exec(line);
    if (!match) return line;
    const leading = match[0];
    const rest = line.slice(leading.length);
    let columns = 0;
    for (const char of leading) columns += char === '\t' ? width - (columns % width) : 1;
    const replacement = target === 'tabs'
      ? '\t'.repeat(Math.floor(columns / width)) + ' '.repeat(columns % width)
      : ' '.repeat(columns);
    if (replacement !== leading) converted += 1;
    return replacement + rest;
  });

  const joined = out.join('\n');
  const finalText = hadBom ? BOM + joined : joined;
  return {
    text: finalText,
    change: {
      sourceEndings,
      lineCount: lines.length,
      hadBom,
      bytesBefore: new TextEncoder().encode(text).length,
      bytesAfter: new TextEncoder().encode(finalText).length
    },
    convertedLines: converted
  };
}

/** Reformats a JSON document, either indented or with every space removed. */
export function reformatJson(text: string, pretty: boolean, indent: number): { text: string; keys: number } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new ConverterBoundary(
      'malformed',
      `The source is not valid JSON: ${error instanceof Error ? error.message.split('\n')[0] : 'the parser refused it'}. Nothing was written.`
    );
  }
  let keys = 0;
  const count = (value: unknown, depth: number): void => {
    if (depth > 200 || value === null || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      for (const item of value) count(item, depth + 1);
      return;
    }
    for (const [, child] of Object.entries(value as Record<string, unknown>)) {
      keys += 1;
      count(child, depth + 1);
    }
  };
  count(parsed, 0);
  return { text: pretty ? `${JSON.stringify(parsed, null, indent)}\n` : JSON.stringify(parsed), keys };
}
