import { renderMarkdown } from '../../core/markdown';
import type { ExportFormat, ExportPreflight, ExportService } from '../../core/registry';
import type { ExportPayload, SourceShape } from './sources';

/**
 * Format choice, per datum rather than per application.
 *
 * `core/export.ts` owns the ten interchange writers. This module adds the
 * language-source forms on top of them, decides which formats a given shape of
 * data can actually be written in, and states the encoding, the line endings and
 * the schema version that every file carries in its own header.
 *
 * The rule the whole module exists to keep: a format is never offered as though
 * it were faithful when it is not. Where a format cannot carry something, the
 * loss is computed and shown BEFORE anything is written, and the schema-only
 * form says outright that it contains none of the records.
 */

export type LanguageFormat = 'ts' | 'js' | 'py' | 'go' | 'jsonschema';
export type ExtendedFormat = ExportFormat | LanguageFormat;

export type LineEnding = 'lf' | 'crlf';

export const SCHEMA_VERSION = '1';

export interface FormatDescriptor {
  id: ExtendedFormat;
  /** The name people actually call it. Never translated, never joked about. */
  name: string;
  extension: string;
  mimeType: string;
  /** Shapes this format can carry without inventing a representation. */
  shapes: SourceShape[];
  /** One line of what it is for, in plain words. */
  purpose: string;
  /** True when the format has no nesting, so nested fields must be flattened. */
  flat: boolean;
  /** True when the file describes the data rather than containing it. */
  schemaOnly?: boolean;
}

export const FORMATS: FormatDescriptor[] = [
  {
    id: 'json',
    name: 'JSON',
    extension: 'json',
    mimeType: 'application/json',
    shapes: ['tabular', 'structured', 'prose'],
    purpose: 'Structured records with full nesting. The safest round trip back into this application.',
    flat: false
  },
  {
    id: 'jsonl',
    name: 'JSONL / NDJSON',
    extension: 'jsonl',
    mimeType: 'application/x-ndjson',
    shapes: ['tabular', 'structured'],
    purpose: 'One record per line, so a very large export can be streamed rather than parsed whole.',
    flat: false
  },
  {
    id: 'yaml',
    name: 'YAML',
    extension: 'yaml',
    mimeType: 'application/yaml',
    shapes: ['tabular', 'structured', 'prose'],
    purpose: 'Structured records a person can read and edit by hand.',
    flat: false
  },
  {
    id: 'toml',
    name: 'TOML',
    extension: 'toml',
    mimeType: 'application/toml',
    shapes: ['tabular', 'structured'],
    purpose: 'Configuration-shaped records. Deeply nested values are written as JSON text.',
    flat: false
  },
  {
    id: 'xml',
    name: 'XML',
    extension: 'xml',
    mimeType: 'application/xml',
    shapes: ['tabular', 'structured', 'prose'],
    purpose: 'Records as elements, for a consumer that speaks XML and nothing else.',
    flat: false
  },
  {
    id: 'csv',
    name: 'CSV',
    extension: 'csv',
    mimeType: 'text/csv',
    shapes: ['tabular', 'structured'],
    purpose: 'One row per record for a spreadsheet. Has no nesting at all.',
    flat: true
  },
  {
    id: 'tsv',
    name: 'TSV',
    extension: 'tsv',
    mimeType: 'text/tab-separated-values',
    shapes: ['tabular', 'structured'],
    purpose: 'Tab separated, for a consumer that trips over commas inside values.',
    flat: true
  },
  {
    id: 'markdown',
    name: 'Markdown',
    extension: 'md',
    mimeType: 'text/markdown',
    shapes: ['tabular', 'structured', 'prose'],
    purpose: 'Prose as prose, and records as a table you can paste into a document.',
    flat: true
  },
  {
    id: 'html',
    name: 'HTML',
    extension: 'html',
    mimeType: 'text/html',
    shapes: ['tabular', 'structured', 'prose'],
    purpose: 'A self-contained page with no remote asset, script, font or stylesheet in it.',
    flat: true
  },
  {
    id: 'sql',
    name: 'SQL',
    extension: 'sql',
    mimeType: 'application/sql',
    shapes: ['tabular', 'structured'],
    purpose: 'A CREATE TABLE and one INSERT per record, for loading into a database.',
    flat: true
  },
  {
    id: 'ts',
    name: 'TypeScript',
    extension: 'ts',
    mimeType: 'text/typescript',
    shapes: ['tabular', 'structured', 'prose'],
    purpose: 'A typed module exporting the records as a value, for pasting into a project.',
    flat: false
  },
  {
    id: 'js',
    name: 'JavaScript (ESM)',
    extension: 'mjs',
    mimeType: 'text/javascript',
    shapes: ['tabular', 'structured', 'prose'],
    purpose: 'An ES module exporting the records as a value.',
    flat: false
  },
  {
    id: 'py',
    name: 'Python',
    extension: 'py',
    mimeType: 'text/x-python',
    shapes: ['tabular', 'structured', 'prose'],
    purpose: 'A module holding the records as a list of dictionaries.',
    flat: false
  },
  {
    id: 'go',
    name: 'Go',
    extension: 'go',
    mimeType: 'text/x-go',
    shapes: ['tabular', 'structured', 'prose'],
    purpose: 'A package holding the records as a slice of maps.',
    flat: false
  },
  {
    id: 'jsonschema',
    name: 'JSON Schema',
    extension: 'schema.json',
    mimeType: 'application/schema+json',
    shapes: ['tabular', 'structured', 'prose'],
    purpose: 'Describes the shape of the records. Contains none of the records themselves.',
    flat: false,
    schemaOnly: true
  }
];

const BY_ID = new Map<ExtendedFormat, FormatDescriptor>(FORMATS.map((format) => [format.id, format]));

export function formatById(id: string): FormatDescriptor | null {
  return BY_ID.get(id as ExtendedFormat) ?? null;
}

export function formatsForShape(shape: SourceShape): FormatDescriptor[] {
  return FORMATS.filter((format) => format.shapes.includes(shape));
}

/** The closest usable format when a preferred one cannot carry this shape. */
export function resolveFormat(preferred: string, shape: SourceShape): FormatDescriptor {
  const wanted = formatById(preferred);
  if (wanted && wanted.shapes.includes(shape)) return wanted;
  const usable = formatsForShape(shape);
  const fallback = shape === 'prose' ? usable.find((format) => format.id === 'markdown') : usable.find((format) => format.id === 'json');
  return fallback ?? usable[0] ?? FORMATS[0];
}

export function isLanguageFormat(id: ExtendedFormat): id is LanguageFormat {
  return id === 'ts' || id === 'js' || id === 'py' || id === 'go' || id === 'jsonschema';
}

/* ------------------------------------------------------------------ */
/* Line endings and encoding                                           */
/* ------------------------------------------------------------------ */

export function eolSequence(ending: LineEnding): string {
  return ending === 'crlf' ? '\r\n' : '\n';
}

export function eolName(ending: LineEnding): string {
  return ending === 'crlf' ? 'CRLF' : 'LF';
}

/**
 * Applies the chosen line ending to already-serialized text.
 *
 * Normalizing to LF first matters: a writer that emits CRLF for its own reasons
 * would otherwise turn into CR CR LF here, which reads as a corrupt file to
 * anything strict.
 */
export function applyLineEnding(text: string, ending: LineEnding): string {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  return ending === 'crlf' ? normalized.replace(/\n/g, '\r\n') : normalized;
}

/* ------------------------------------------------------------------ */
/* Payload to records                                                  */
/* ------------------------------------------------------------------ */

/**
 * A document rendered as records, for the formats that only speak records.
 *
 * The whole document travels in one field rather than being chopped up, so the
 * round trip is lossless even through CSV — the cell simply contains the entire
 * Markdown source.
 */
export function payloadAsRecords(payload: ExportPayload): Array<Record<string, unknown>> {
  if (payload.kind === 'records') return payload.records;
  return [{ title: payload.title, format: 'markdown', body: payload.markdown }];
}

/* ------------------------------------------------------------------ */
/* Language-source writers                                             */
/* ------------------------------------------------------------------ */

function identifier(name: string): string {
  const cleaned = name.replace(/[^A-Za-z0-9_]/g, '_');
  return /^[A-Za-z_]/.test(cleaned) ? cleaned : `_${cleaned}`;
}

function pythonLiteral(value: unknown, indent: number): string {
  const pad = ' '.repeat(indent);
  const inner = ' '.repeat(indent + 4);
  if (value === null || value === undefined) return 'None';
  if (typeof value === 'boolean') return value ? 'True' : 'False';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'None';
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    return `[\n${value.map((item) => `${inner}${pythonLiteral(item, indent + 4)}`).join(',\n')},\n${pad}]`;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return '{}';
    return `{\n${entries
      .map(([key, item]) => `${inner}${JSON.stringify(String(key))}: ${pythonLiteral(item, indent + 4)}`)
      .join(',\n')},\n${pad}}`;
  }
  return JSON.stringify(String(value));
}

function goLiteral(value: unknown, indent: number): string {
  const pad = ' '.repeat(indent);
  const inner = ' '.repeat(indent + 1);
  if (value === null || value === undefined) return 'nil';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'nil';
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]any{}';
    return `[]any{\n${value.map((item) => `${inner}${goLiteral(item, indent + 1)},`).join('\n')}\n${pad}}`;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return 'map[string]any{}';
    return `map[string]any{\n${entries
      .map(([key, item]) => `${inner}${JSON.stringify(String(key))}: ${goLiteral(item, indent + 1)},`)
      .join('\n')}\n${pad}}`;
  }
  return JSON.stringify(String(value));
}

/** The TypeScript type of one value, widened enough to stay true of every record. */
function tsTypeOf(values: unknown[]): string {
  const kinds = new Set<string>();
  for (const value of values) {
    if (value === null || value === undefined) kinds.add('null');
    else if (Array.isArray(value)) kinds.add('unknown[]');
    else if (typeof value === 'object') kinds.add('Record<string, unknown>');
    else if (typeof value === 'number') kinds.add('number');
    else if (typeof value === 'boolean') kinds.add('boolean');
    else kinds.add('string');
  }
  if (kinds.size === 0) return 'unknown';
  return [...kinds].sort().join(' | ');
}

function columnsOf(records: Array<Record<string, unknown>>): string[] {
  const seen = new Set<string>();
  for (const record of records) for (const key of Object.keys(record)) seen.add(key);
  return [...seen];
}

function jsonSchemaFor(records: Array<Record<string, unknown>>, name: string): string {
  const columns = columnsOf(records);
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const column of columns) {
    const values = records.map((record) => record[column]);
    const types = new Set<string>();
    for (const value of values) {
      if (value === null || value === undefined) types.add('null');
      else if (Array.isArray(value)) types.add('array');
      else if (typeof value === 'object') types.add('object');
      else if (typeof value === 'number') types.add('number');
      else if (typeof value === 'boolean') types.add('boolean');
      else types.add('string');
    }
    properties[column] = { type: types.size === 1 ? [...types][0] : [...types].sort() };
    if (records.every((record) => Object.prototype.hasOwnProperty.call(record, column))) required.push(column);
  }
  return `${JSON.stringify(
    {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      title: name,
      description: 'The shape of the records. This file deliberately contains none of the records themselves.',
      type: 'array',
      items: { type: 'object', properties, required, additionalProperties: true }
    },
    null,
    2
  )}\n`;
}

/* ------------------------------------------------------------------ */
/* Serialization                                                       */
/* ------------------------------------------------------------------ */

export interface SerializeOptions {
  name: string;
  format: ExtendedFormat;
  lineEnding: LineEnding;
  byteOrderMark: boolean;
}

export interface SerializedExport {
  text: string;
  extension: string;
  mimeType: string;
  preflight: ExportPreflight;
  /** Stated in the surface and written into the file's own header. */
  header: { encoding: 'utf-8'; lineEnding: LineEnding; schemaVersion: string };
  /** True when the file describes the records rather than containing them. */
  schemaOnly: boolean;
}

function proseToHtml(payload: Extract<ExportPayload, { kind: 'document' }>, generatedAt: string): string {
  // The shared renderer is used rather than a second Markdown implementation, so
  // the exported page and the in-application view can never disagree. It emits no
  // remote asset, script, font or stylesheet.
  const fragment = renderMarkdown(payload.markdown);
  const host = document.createElement('div');
  host.append(fragment);
  return [
    '<!doctype html>',
    '<html lang="en"><head><meta charset="utf-8">',
    `<title>${escapeHtml(payload.title)}</title>`,
    '</head><body>',
    `<!-- encoding=utf-8; schemaVersion=${SCHEMA_VERSION}; generatedAt=${generatedAt} -->`,
    `<h1>${escapeHtml(payload.title)}</h1>`,
    host.innerHTML,
    '</body></html>',
    ''
  ].join('\n');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function serializeExport(
  payload: ExportPayload,
  options: SerializeOptions,
  exporter: ExportService
): SerializedExport {
  const descriptor = formatById(options.format) ?? FORMATS[0];
  const generatedAt = new Date().toISOString();
  const records = payloadAsRecords(payload);
  const name = options.name;

  let text: string;
  let preflight: ExportPreflight = { losses: [] };

  if (payload.kind === 'document' && options.format === 'markdown') {
    text = [
      `<!-- ${name}; encoding=utf-8; schemaVersion=${SCHEMA_VERSION}; generatedAt=${generatedAt} -->`,
      '',
      `# ${payload.title}`,
      '',
      payload.markdown,
      ''
    ].join('\n');
  } else if (payload.kind === 'document' && options.format === 'html') {
    text = proseToHtml(payload, generatedAt);
  } else if (!isLanguageFormat(descriptor.id)) {
    const result = exporter.serialize(records, descriptor.id as ExportFormat, {
      name,
      schemaVersion: SCHEMA_VERSION,
      encoding: 'utf-8'
    });
    text = result.text;
    preflight = result.preflight;
  } else {
    const banner = `${name}; encoding=utf-8; schemaVersion=${SCHEMA_VERSION}; generatedAt=${generatedAt}; count=${records.length}`;
    switch (descriptor.id) {
      case 'ts': {
        const columns = columnsOf(records);
        const fields = columns
          .map((column) => `  ${JSON.stringify(column)}: ${tsTypeOf(records.map((record) => record[column]))};`)
          .join('\n');
        text = [
          `// ${banner}`,
          '',
          `export interface ${identifier(name)}Record {`,
          fields || '  [key: string]: unknown;',
          '}',
          '',
          `export const ${identifier(name)}: ${identifier(name)}Record[] = ${JSON.stringify(records, null, 2)};`,
          ''
        ].join('\n');
        break;
      }
      case 'js':
        text = [`// ${banner}`, '', `export const ${identifier(name)} = ${JSON.stringify(records, null, 2)};`, ''].join('\n');
        break;
      case 'py':
        text = [
          `# ${banner}`,
          '',
          `${identifier(name)} = ${pythonLiteral(records, 0)}`,
          ''
        ].join('\n');
        break;
      case 'go':
        text = [
          `// ${banner}`,
          '',
          `package ${identifier(name).toLowerCase()}`,
          '',
          `var ${identifier(name)} = ${goLiteral(records, 0)}`,
          ''
        ].join('\n');
        break;
      case 'jsonschema':
      default:
        text = jsonSchemaFor(records, name);
        break;
    }
  }

  // Written as an escape rather than a literal: an invisible character at the
  // start of a template string is the kind of thing an editor silently eats.
  if (options.byteOrderMark) text = String.fromCharCode(0xfeff) + text;

  return {
    text: applyLineEnding(text, options.lineEnding),
    extension: descriptor.extension,
    mimeType: descriptor.mimeType,
    preflight,
    header: { encoding: 'utf-8', lineEnding: options.lineEnding, schemaVersion: SCHEMA_VERSION },
    schemaOnly: descriptor.schemaOnly === true
  };
}

/**
 * What a format would lose, computed before anything is written.
 *
 * Delegated to the core writer for the ten interchange formats so the surface
 * and the file can never disagree about it. The language-source forms carry
 * nesting natively and lose nothing; the schema form is not a loss but a
 * deliberate omission, and is reported as such in its own words.
 */
export function preflightFor(
  payload: ExportPayload,
  format: ExtendedFormat,
  exporter: ExportService
): ExportPreflight {
  if (isLanguageFormat(format)) return { losses: [] };
  return exporter.preflight(payloadAsRecords(payload), format as ExportFormat);
}
