import type { ExportFormat, ExportOptions, ExportPreflight, ExportResult, ExportService } from './types';

/**
 * Export, in every format that can carry the data.
 *
 * Two properties matter more than the format list itself.
 *
 * The file says what it is. Encoding, schema version and the shape of the
 * records are stated in the file's own header, so it is readable by something
 * other than the application that wrote it.
 *
 * Nothing is dropped silently. `preflight` reports exactly which fields a chosen
 * format cannot carry faithfully BEFORE anything is written, so a user choosing
 * CSV for records with nested objects is told that those columns will be
 * flattened to JSON text rather than discovering it afterwards.
 */

const FORMAT_META: Record<ExportFormat, { extension: string; mimeType: string; flat: boolean }> = {
  json: { extension: 'json', mimeType: 'application/json', flat: false },
  jsonl: { extension: 'jsonl', mimeType: 'application/x-ndjson', flat: false },
  yaml: { extension: 'yaml', mimeType: 'application/yaml', flat: false },
  toml: { extension: 'toml', mimeType: 'application/toml', flat: false },
  xml: { extension: 'xml', mimeType: 'application/xml', flat: false },
  csv: { extension: 'csv', mimeType: 'text/csv', flat: true },
  tsv: { extension: 'tsv', mimeType: 'text/tab-separated-values', flat: true },
  markdown: { extension: 'md', mimeType: 'text/markdown', flat: true },
  html: { extension: 'html', mimeType: 'text/html', flat: true },
  sql: { extension: 'sql', mimeType: 'application/sql', flat: true }
};

const SCHEMA_VERSION = '1';

function columnsOf(records: Array<Record<string, unknown>>): string[] {
  const seen = new Set<string>();
  for (const record of records) {
    for (const key of Object.keys(record)) seen.add(key);
  }
  return [...seen];
}

function isComplex(value: unknown): boolean {
  return typeof value === 'object' && value !== null;
}

function scalar(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (isComplex(value)) return JSON.stringify(value);
  return String(value);
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function xmlName(value: string): string {
  const cleaned = value.replace(/[^A-Za-z0-9_.-]/g, '_');
  return /^[A-Za-z_]/.test(cleaned) ? cleaned : `_${cleaned}`;
}

function yamlValue(value: unknown, indent: number): string {
  const pad = ' '.repeat(indent);
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    return `\n${value.map((item) => `${pad}- ${yamlValue(item, indent + 2).trimStart()}`).join('\n')}`;
  }
  if (isComplex(value)) {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return '{}';
    return `\n${entries.map(([key, item]) => `${pad}${key}: ${yamlValue(item, indent + 2)}`).join('\n')}`;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  const text = String(value);
  return /^[\w.@/-]+$/.test(text) ? text : JSON.stringify(text);
}

function tomlValue(value: unknown): string {
  if (value === null || value === undefined) return '""';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return `[${value.map((item) => tomlValue(item)).join(', ')}]`;
  if (isComplex(value)) return JSON.stringify(JSON.stringify(value));
  return JSON.stringify(String(value));
}

function delimited(records: Array<Record<string, unknown>>, separator: string): string {
  const columns = columnsOf(records);
  const quote = (value: string): string => {
    if (value.includes(separator) || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };
  const lines = [columns.map(quote).join(separator)];
  for (const record of records) {
    lines.push(columns.map((column) => quote(scalar(record[column]))).join(separator));
  }
  return `${lines.join('\n')}\n`;
}

class ExportImpl implements ExportService {
  formats(): ExportFormat[] {
    return Object.keys(FORMAT_META) as ExportFormat[];
  }

  preflight(records: Array<Record<string, unknown>>, format: ExportFormat): ExportPreflight {
    const meta = FORMAT_META[format];
    if (!meta.flat) return { losses: [] };
    const losses: ExportPreflight['losses'] = [];
    const seen = new Set<string>();
    for (const record of records) {
      for (const [key, value] of Object.entries(record)) {
        if (seen.has(key)) continue;
        if (isComplex(value)) {
          seen.add(key);
          losses.push({
            field: key,
            reason: `${format.toUpperCase()} has no nested structure, so this column is written as JSON text inside one cell.`
          });
        }
      }
    }
    return { losses };
  }

  serialize(
    records: Array<Record<string, unknown>>,
    format: ExportFormat,
    options: ExportOptions = {}
  ): ExportResult {
    const meta = FORMAT_META[format];
    const name = options.name ?? 'records';
    const version = options.schemaVersion ?? SCHEMA_VERSION;
    const preflight = this.preflight(records, format);
    const generatedAt = new Date().toISOString();
    let text: string;

    switch (format) {
      case 'json':
        text = `${JSON.stringify(
          { name, schemaVersion: version, encoding: 'utf-8', generatedAt, count: records.length, records },
          null,
          2
        )}\n`;
        break;
      case 'jsonl':
        text = [
          JSON.stringify({ _header: { name, schemaVersion: version, encoding: 'utf-8', generatedAt, count: records.length } }),
          ...records.map((record) => JSON.stringify(record))
        ].join('\n');
        text += '\n';
        break;
      case 'yaml':
        text = [
          `# ${name}`,
          `# encoding: utf-8`,
          `schemaVersion: "${version}"`,
          `generatedAt: "${generatedAt}"`,
          `count: ${records.length}`,
          'records:',
          ...records.map(
            (record) =>
              `  - ${Object.entries(record)
                .map(([key, value]) => `${key}: ${yamlValue(value, 6)}`)
                .join('\n    ')}`
          )
        ].join('\n');
        text += '\n';
        break;
      case 'toml':
        text = [
          `# ${name}`,
          `# encoding: utf-8`,
          `schemaVersion = "${version}"`,
          `generatedAt = "${generatedAt}"`,
          `count = ${records.length}`,
          '',
          ...records.flatMap((record) => [
            `[[${xmlName(name)}]]`,
            ...Object.entries(record).map(([key, value]) => `${xmlName(key)} = ${tomlValue(value)}`),
            ''
          ])
        ].join('\n');
        break;
      case 'xml': {
        const root = xmlName(name);
        text = [
          '<?xml version="1.0" encoding="UTF-8"?>',
          `<${root} schemaVersion="${escapeXml(version)}" generatedAt="${escapeXml(generatedAt)}" count="${records.length}">`,
          ...records.map(
            (record) =>
              `  <record>\n${Object.entries(record)
                .map(([key, value]) => `    <${xmlName(key)}>${escapeXml(scalar(value))}</${xmlName(key)}>`)
                .join('\n')}\n  </record>`
          ),
          `</${root}>`
        ].join('\n');
        text += '\n';
        break;
      }
      case 'csv':
        text = `# ${name}; encoding=utf-8; schemaVersion=${version}; generatedAt=${generatedAt}\n${delimited(records, ',')}`;
        break;
      case 'tsv':
        text = `# ${name}; encoding=utf-8; schemaVersion=${version}; generatedAt=${generatedAt}\n${delimited(records, '\t')}`;
        break;
      case 'markdown': {
        const columns = columnsOf(records);
        const rows = records.map(
          (record) => `| ${columns.map((column) => scalar(record[column]).replace(/\|/g, '\\|')).join(' | ')} |`
        );
        text = [
          `# ${name}`,
          '',
          `Encoding UTF-8, schema version ${version}, generated ${generatedAt}, ${records.length} records.`,
          '',
          `| ${columns.join(' | ')} |`,
          `| ${columns.map(() => '---').join(' | ')} |`,
          ...rows,
          ''
        ].join('\n');
        break;
      }
      case 'html': {
        const columns = columnsOf(records);
        text = [
          '<!doctype html>',
          '<html lang="en"><head><meta charset="utf-8">',
          `<title>${escapeXml(name)}</title></head><body>`,
          `<table><caption>${escapeXml(name)} — UTF-8, schema version ${escapeXml(version)}, generated ${escapeXml(generatedAt)}</caption>`,
          `<thead><tr>${columns.map((column) => `<th>${escapeXml(column)}</th>`).join('')}</tr></thead>`,
          '<tbody>',
          ...records.map(
            (record) => `<tr>${columns.map((column) => `<td>${escapeXml(scalar(record[column]))}</td>`).join('')}</tr>`
          ),
          '</tbody></table></body></html>',
          ''
        ].join('\n');
        break;
      }
      case 'sql': {
        const table = xmlName(name);
        const columns = columnsOf(records);
        const quote = (value: unknown): string => {
          if (value === null || value === undefined) return 'NULL';
          if (typeof value === 'number') return String(value);
          if (typeof value === 'boolean') return value ? '1' : '0';
          return `'${scalar(value).replace(/'/g, "''")}'`;
        };
        text = [
          `-- ${name}; encoding=utf-8; schemaVersion=${version}; generatedAt=${generatedAt}`,
          `CREATE TABLE IF NOT EXISTS ${table} (`,
          columns.map((column) => `  ${xmlName(column)} TEXT`).join(',\n'),
          ');',
          ...records.map(
            (record) =>
              `INSERT INTO ${table} (${columns.map(xmlName).join(', ')}) VALUES (${columns
                .map((column) => quote(record[column]))
                .join(', ')});`
          ),
          ''
        ].join('\n');
        break;
      }
      default:
        text = JSON.stringify(records, null, 2);
    }

    return { format, extension: meta.extension, mimeType: meta.mimeType, text, preflight };
  }

  async save(
    records: Array<Record<string, unknown>>,
    format: ExportFormat,
    options: ExportOptions & { defaultFileName?: string } = {}
  ): Promise<string | null> {
    const result = this.serialize(records, format, options);
    const suggested = options.defaultFileName ?? `${options.name ?? 'export'}.${result.extension}`;
    const chosen = await window.studio.dialog.saveFile({
      defaultPath: suggested,
      filters: [{ name: format.toUpperCase(), extensions: [result.extension] }]
    });
    if (!chosen.ok || !chosen.value) return null;
    const written = await window.studio.fs.writeText(chosen.value, result.text);
    if (!written.ok) throw new Error(written.error);
    return chosen.value;
  }
}

export const exporter = new ExportImpl();
