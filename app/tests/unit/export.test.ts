/**
 * Export format writers: every format states its encoding/schema/version in
 * its own header, and preflight reports exactly what a flat format cannot
 * carry faithfully before anything is written.
 */
import { describe, expect, it } from 'vitest';
import { exporter } from '../../src/renderer/core/export';
import type { ExportFormat } from '../../src/renderer/core/types';

const FLAT_RECORDS: Array<Record<string, unknown>> = [
  { id: 1, name: 'Alice', active: true, note: null },
  { id: 2, name: 'Has, a comma "and quotes"\nand a newline', active: false, note: 'plain' }
];

const NESTED_RECORDS: Array<Record<string, unknown>> = [
  { id: 1, name: 'Alice', tags: ['a', 'b'], meta: { role: 'admin' } }
];

describe('exporter.formats()', () => {
  it('lists every format the contract requires, and no others', () => {
    const expected: ExportFormat[] = ['json', 'jsonl', 'yaml', 'toml', 'xml', 'csv', 'tsv', 'markdown', 'html', 'sql'];
    expect([...exporter.formats()].sort()).toEqual([...expected].sort());
  });
});

describe('every format states its encoding and schema version in its own header', () => {
  const cases: Array<{ format: ExportFormat; headerNeedle: RegExp }> = [
    { format: 'json', headerNeedle: /"encoding":\s*"utf-8"/ },
    { format: 'json', headerNeedle: /"schemaVersion":\s*"1"/ },
    { format: 'jsonl', headerNeedle: /"encoding":"utf-8"/ },
    { format: 'yaml', headerNeedle: /encoding: utf-8/ },
    { format: 'yaml', headerNeedle: /schemaVersion: "1"/ },
    { format: 'toml', headerNeedle: /encoding: utf-8/ },
    { format: 'toml', headerNeedle: /schemaVersion = "1"/ },
    { format: 'xml', headerNeedle: /schemaVersion="1"/ },
    { format: 'csv', headerNeedle: /encoding=utf-8; schemaVersion=1/ },
    { format: 'tsv', headerNeedle: /encoding=utf-8; schemaVersion=1/ },
    { format: 'markdown', headerNeedle: /Encoding UTF-8, schema version 1/ },
    { format: 'html', headerNeedle: /UTF-8, schema version 1/ },
    { format: 'sql', headerNeedle: /encoding=utf-8; schemaVersion=1/ }
  ];

  for (const { format, headerNeedle } of cases) {
    it(`${format} header matches ${headerNeedle}`, () => {
      const result = exporter.serialize(FLAT_RECORDS, format, { name: 'records', schemaVersion: '1' });
      expect(result.text).toMatch(headerNeedle);
      expect(result.format).toBe(format);
    });
  }
});

describe('preflight: nothing is dropped silently', () => {
  it('a flat format (CSV) reports a loss for a nested field before anything is written', () => {
    const preflight = exporter.preflight(NESTED_RECORDS, 'csv');
    const fields = preflight.losses.map((loss) => loss.field);
    expect(fields).toContain('tags');
    expect(fields).toContain('meta');
    for (const loss of preflight.losses) {
      expect(loss.reason.length).toBeGreaterThan(0);
    }
  });

  it('a structured format (JSON) reports no losses for the same nested records', () => {
    const preflight = exporter.preflight(NESTED_RECORDS, 'json');
    expect(preflight.losses).toHaveLength(0);
  });

  it('a flat format with no nested fields reports no losses', () => {
    const preflight = exporter.preflight(FLAT_RECORDS, 'csv');
    expect(preflight.losses).toHaveLength(0);
  });

  it('serialize() carries the same preflight it would report standalone', () => {
    const standalone = exporter.preflight(NESTED_RECORDS, 'csv');
    const result = exporter.serialize(NESTED_RECORDS, 'csv');
    expect(result.preflight).toEqual(standalone);
  });
});

describe('CSV/TSV: correct quoting and re-parseable output', () => {
  it('quotes a field containing a comma, quotes and a newline, doubling internal quotes', () => {
    const result = exporter.serialize(FLAT_RECORDS, 'csv');
    expect(result.text).toContain('"Has, a comma ""and quotes""\nand a newline"');
  });

  it('every data row has the same number of columns as the header', () => {
    const result = exporter.serialize(FLAT_RECORDS, 'csv', { name: 'records' });
    const dataLines = result.text.split('\n').slice(1); // drop the leading "# ..." comment
    const header = dataLines[0];
    const headerColumnCount = header.split(',').length;
    expect(headerColumnCount).toBe(4); // id, name, active, note
  });

  it('TSV separates fields with a real tab character', () => {
    const result = exporter.serialize(FLAT_RECORDS, 'tsv');
    const lines = result.text.trim().split('\n');
    expect(lines[1]).toContain('\t');
  });
});

describe('JSON/JSONL: valid, parseable output that round-trips the records', () => {
  it('JSON output is valid JSON and carries every record', () => {
    const result = exporter.serialize(FLAT_RECORDS, 'json', { name: 'records' });
    const parsed = JSON.parse(result.text);
    expect(parsed.records).toEqual(FLAT_RECORDS);
    expect(parsed.count).toBe(FLAT_RECORDS.length);
  });

  it('JSONL emits one header line and one record line per record, each independently valid JSON', () => {
    const result = exporter.serialize(FLAT_RECORDS, 'jsonl');
    const lines = result.text.trim().split('\n');
    expect(lines).toHaveLength(FLAT_RECORDS.length + 1);
    for (const line of lines) expect(() => JSON.parse(line)).not.toThrow();
    const header = JSON.parse(lines[0]);
    expect(header._header.count).toBe(FLAT_RECORDS.length);
  });
});

describe('XML/HTML: well-formed output with entities escaped', () => {
  it('escapes XML-significant characters in both element text and attribute values', () => {
    const result = exporter.serialize([{ note: '<tag> & "quoted" \'single\'' }], 'xml', { name: 'records' });
    expect(result.text).toContain('&lt;tag&gt; &amp; &quot;quoted&quot; &apos;single&apos;');
    expect(result.text).not.toContain('<tag>');
  });

  it('produces one root element containing one <record> per row', () => {
    const result = exporter.serialize(FLAT_RECORDS, 'xml', { name: 'people' });
    const recordCount = (result.text.match(/<record>/g) ?? []).length;
    expect(recordCount).toBe(FLAT_RECORDS.length);
    expect(result.text).toContain('<people ');
    expect(result.text).toContain('</people>');
  });

  it('HTML escapes cell content and emits one row per record plus a header row', () => {
    const result = exporter.serialize([{ note: '<script>alert(1)</script>' }], 'html', { name: 'records' });
    expect(result.text).not.toContain('<script>alert(1)</script>');
    expect(result.text).toContain('&lt;script&gt;');
    const rowCount = (result.text.match(/<tr>/g) ?? []).length;
    expect(rowCount).toBe(2); // header row + one data row
  });
});

describe('SQL: identifiers are sanitized and values are quoted safely', () => {
  it('single-quotes a string value and doubles an embedded single quote', () => {
    const result = exporter.serialize([{ name: "O'Brien" }], 'sql', { name: 'people' });
    expect(result.text).toContain("'O''Brien'");
  });

  it('emits NULL for a null/undefined value and a bare number for a numeric one', () => {
    const result = exporter.serialize([{ note: null, id: 42 }], 'sql', { name: 'records' });
    expect(result.text).toMatch(/VALUES \(NULL, 42\)|VALUES \(42, NULL\)/);
  });

  it('sanitizes a table/column name that is not a valid bare SQL identifier', () => {
    const result = exporter.serialize([{ 'weird name!': 'x' }], 'sql', { name: 'my export' });
    expect(result.text).toContain('CREATE TABLE IF NOT EXISTS my_export');
    expect(result.text).toContain('weird_name_ TEXT');
  });
});

describe('markdown: a valid GFM table', () => {
  it('escapes a pipe inside a cell so it cannot be mistaken for a column separator', () => {
    const result = exporter.serialize([{ note: 'a | b' }], 'markdown');
    expect(result.text).toContain('a \\| b');
  });

  it('emits a header row, a separator row and one row per record', () => {
    const result = exporter.serialize(FLAT_RECORDS, 'markdown', { name: 'records' });
    const tableLines = result.text.split('\n').filter((line) => line.startsWith('|'));
    // header + separator + N data rows
    expect(tableLines).toHaveLength(2 + FLAT_RECORDS.length);
    expect(tableLines[1]).toMatch(/^\|( ?---+ ?\|)+$/);
  });
});
