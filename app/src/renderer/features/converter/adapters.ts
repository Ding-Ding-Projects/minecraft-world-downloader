/**
 * The adapter registry.
 *
 * An adapter is one declared route from a source format to a target format. It
 * carries everything the catalog needs to be honest about it: which category it
 * belongs to, which source signatures it accepts, whether its implementation is
 * genuinely bundled inside the installed application, what proves that, what it
 * can lose, which bounds it runs inside, what sandbox it runs in and how its
 * output is validated after it is produced.
 *
 * ## What "bundled" means here, precisely
 *
 * `bundled: true` is claimed only when the whole implementation ships inside the
 * packaged application: this feature's own TypeScript, the application's export
 * service, or a capability of the packaged runtime itself. Nothing is ever
 * enabled because a tool happens to be on PATH, because a developer machine has
 * it, or because a service could be reached over the network. Where the runtime
 * capability might genuinely be absent, `probe` re-checks it at run time so a
 * build that lacks it reports the exact gap instead of failing mid-file.
 *
 * ## The one boundary that closes several routes
 *
 * The privileged bridge writes files as UTF-8 text. There is no channel for
 * writing arbitrary bytes, so every route whose target is a binary format is
 * listed and disabled with that exact reason. The routes that survive are the
 * ones whose output genuinely is text — which includes a PDF, because this
 * feature's writer emits a pure-ASCII PDF on purpose.
 */

import { exporter } from '../../core/export';
import { renderMarkdown } from '../../core/markdown';
import type { ExportFormat } from '../../core/registry';

import {
  bytesToBase32,
  bytesToBase64,
  bytesToBase64Wrapped,
  bytesToHex,
  bytesToUtf8Lossy,
  bytesToUtf8Strict,
  base64ToBytes,
  formatBytes,
  hasDecompression,
  sha256Hex,
  utf8ToBytes
} from './bytes';
import {
  readGzipMember,
  readTarInventory,
  readTarMember,
  readZipInventory,
  readZipMember,
  isUnsafeArchivePath,
  type ArchiveEntry
} from './archives';
import type { Detection } from './detect';
import { type CategoryId, formatById } from './formats';
import { decodeRaster, encodePgm, encodePpm, encodeSvgContainer, hasRasterDecoder, inspectImage, mimeTypeFor } from './images';
import { ConverterBoundary, Deadline, type ResourceLimits } from './limits';
import { inspectMatroska, inspectMp3, inspectMp4, inspectWave } from './media';
import { PdfDocument, buildDocument, normaliseRotation, validateWritten, type PageSelection } from './pdf';
import { convertBom, convertIndentation, convertLineEndings, readDelimited, readJson, readJsonLines, reformatJson } from './records';

/* ------------------------------------------------------------------ */
/* Shapes                                                              */
/* ------------------------------------------------------------------ */

export type Lossiness = 'lossless' | 'lossy' | 'inspection' | 'container';

export interface AdapterOption {
  id: string;
  labelKey: string;
  descriptionKey: string;
  kind: 'select' | 'number' | 'color' | 'text';
  /** For `select`: the choices. `label` is an i18n key. */
  choices?: Array<{ value: string; label: string }>;
  min?: number;
  max?: number;
  defaultValue: string;
}

export interface ValidationCheck {
  name: string;
  expected: string;
  actual: string;
  ok: boolean;
}

export interface AdapterInput {
  path: string;
  /** The file's bytes. Always present; text adapters decode from it. */
  bytes: Uint8Array;
  detection: Detection;
}

export interface AdapterOutput {
  /** The complete file contents, written to disk as UTF-8. */
  text: string;
  extension: string;
  /** Facts about what the conversion actually did, in the order they happened. */
  notes: string[];
  /** The checks that ran on the produced output, before it was offered. */
  checks: ValidationCheck[];
  byteLength: number;
  sha256: string;
}

export interface RunServices {
  limits: ResourceLimits;
  deadline: Deadline;
  /** Values for this adapter's declared options, already defaulted. */
  options: Record<string, string>;
  /** Application version, written into a produced document's producer line. */
  producer: string;
}

export interface AdapterSpec {
  id: string;
  category: CategoryId;
  /** Format ids this route accepts. */
  sourceFormats: string[];
  /** Format id this route produces. */
  targetFormat: string;
  /** File extension the save dialog suggests. */
  targetExtension: string;
  /** i18n key describing what this route does. */
  detailKey: string;
  /** True only when the whole implementation ships inside the application. */
  bundled: boolean;
  /** What proves it ships: the exact module compiled into the artifact. */
  proof: string;
  /** i18n key naming the exact missing piece. Present when `bundled` is false. */
  unavailableKey?: string;
  unavailableValues?: Record<string, string>;
  /** Re-checked at run time for a route that leans on a runtime capability. */
  probe?: { test(): boolean; reasonKey: string; reasonValues?: Record<string, string> };
  lossiness: Lossiness;
  /** i18n key describing what happens to metadata and character encoding. */
  metadataKey: string;
  /** i18n keys naming exactly what can change or be omitted. */
  disclosureKeys: string[];
  /** i18n key naming the sandbox this route runs inside. */
  sandboxKey: string;
  /** i18n key naming how the produced output is checked before it is offered. */
  validatorKey: string;
  options?: AdapterOption[];
  /** Routes that produce many files or take many, run from the tools panel. */
  multiFile?: 'split' | 'merge';
  run?(input: AdapterInput, services: RunServices): Promise<AdapterOutput>;
}

export interface Availability {
  available: boolean;
  /** i18n key naming the exact reason. Empty when the route is available. */
  reasonKey: string;
  reasonValues?: Record<string, string>;
}

/* ------------------------------------------------------------------ */
/* Runtime capability probes                                           */
/* ------------------------------------------------------------------ */

/**
 * True when the privileged bridge can write bytes that are not UTF-8 text.
 *
 * Probed rather than assumed, so that if the bridge ever grows such a channel
 * every route that needs one lights up on its own instead of staying dark
 * behind a hard-coded false.
 */
export function hasBinaryWriteChannel(): boolean {
  const bridge = (globalThis as Record<string, unknown>)['studio'] as { fs?: Record<string, unknown> } | undefined;
  const fs = bridge?.fs;
  if (!fs) return false;
  return typeof fs['writeBinary'] === 'function' || typeof fs['writeBase64'] === 'function' || typeof fs['writeBytes'] === 'function';
}

const BINARY_WRITE_PROBE = {
  test: hasBinaryWriteChannel,
  reasonKey: 'converter.reason.binaryWrite'
};

const DECOMPRESSION_PROBE = {
  test: hasDecompression,
  reasonKey: 'converter.reason.noDecompression'
};

const RASTER_PROBE = {
  test: hasRasterDecoder,
  reasonKey: 'converter.reason.noRaster'
};

/** Whether a route can run right now, and the exact reason when it cannot. */
export function availabilityOf(adapter: AdapterSpec): Availability {
  if (!adapter.bundled) {
    return {
      available: false,
      reasonKey: adapter.unavailableKey ?? 'converter.reason.notBundled',
      reasonValues: adapter.unavailableValues
    };
  }
  if (adapter.probe && !adapter.probe.test()) {
    return { available: false, reasonKey: adapter.probe.reasonKey, reasonValues: adapter.probe.reasonValues };
  }
  if (!adapter.run && !adapter.multiFile) {
    return { available: false, reasonKey: 'converter.reason.notBundled' };
  }
  return { available: true, reasonKey: '' };
}

/* ------------------------------------------------------------------ */
/* Helpers shared by the routes                                        */
/* ------------------------------------------------------------------ */

const RENDERER_PROOF = 'renderer bundle';

function finish(text: string, extension: string, notes: string[], checks: ValidationCheck[], limits: ResourceLimits): AdapterOutput {
  const bytes = utf8ToBytes(text);
  if (bytes.length > limits.outputBytes) {
    throw new ConverterBoundary(
      'output-size',
      `The result is ${bytes.length} bytes, past the ${limits.outputBytes}-byte output bound. Nothing was written.`
    );
  }
  return { text, extension, notes, checks, byteLength: bytes.length, sha256: sha256Hex(bytes) };
}

function check(name: string, expected: string, actual: string): ValidationCheck {
  return { name, expected, actual, ok: expected === actual };
}

function requireAllChecks(checks: ValidationCheck[]): void {
  const failed = checks.find((entry) => !entry.ok);
  if (failed) {
    throw new ConverterBoundary(
      'validation',
      `The produced output failed its ${failed.name} check: expected ${failed.expected}, got ${failed.actual}. Nothing was written.`
    );
  }
}

function decodeText(input: AdapterInput): string {
  try {
    return bytesToUtf8Strict(input.bytes);
  } catch {
    throw new ConverterBoundary(
      'unsupported',
      'The source is not valid UTF-8 text, so a text route cannot read it without changing its bytes. Nothing was written.'
    );
  }
}

function parseXmlOrThrow(text: string, what: string): void {
  const parsed = new DOMParser().parseFromString(text, 'application/xml');
  const error = parsed.querySelector('parsererror');
  if (error) {
    throw new ConverterBoundary('validation', `The produced ${what} did not parse as XML. Nothing was written.`);
  }
}

function jsonOutput(value: unknown, limits: ResourceLimits, notes: string[]): AdapterOutput {
  const text = `${JSON.stringify(value, null, 2)}\n`;
  const checks: ValidationCheck[] = [];
  try {
    JSON.parse(text);
    checks.push(check('re-parse', 'the produced document parses as JSON', 'the produced document parses as JSON'));
  } catch {
    checks.push(check('re-parse', 'the produced document parses as JSON', 'it did not parse'));
  }
  requireAllChecks(checks);
  return finish(text, 'json', notes, checks, limits);
}

/* ------------------------------------------------------------------ */
/* Structured-data routes                                              */
/* ------------------------------------------------------------------ */

const RECORD_SOURCES = ['json', 'jsonl', 'csv', 'tsv'];

function readRecords(input: AdapterInput, services: RunServices): ReturnType<typeof readJson> {
  const text = decodeText(input);
  switch (input.detection.formatId) {
    case 'json': return readJson(text, services.limits, services.deadline);
    case 'jsonl': return readJsonLines(text, services.limits, services.deadline);
    case 'csv': return readDelimited(text, ',', services.limits, services.deadline);
    case 'tsv': return readDelimited(text, '\t', services.limits, services.deadline);
    default:
      throw new ConverterBoundary(
        'unsupported',
        `This route reads JSON, JSON Lines, comma-separated and tab-separated sources; the bytes were detected as ${input.detection.formatId ?? 'an unknown format'}. Nothing was written.`
      );
  }
}

function recordAdapter(targetFormat: string, exportFormat: ExportFormat, extension: string): AdapterSpec {
  return {
    id: `data.records.${targetFormat}`,
    category: 'data',
    sourceFormats: RECORD_SOURCES,
    targetFormat,
    targetExtension: extension,
    detailKey: 'converter.detail.records',
    bundled: true,
    proof: `${RENDERER_PROOF}: features/converter/records.ts + core/export.ts`,
    lossiness: exportFormat === 'json' || exportFormat === 'jsonl' ? 'lossless' : 'lossy',
    metadataKey: 'converter.metadata.records',
    disclosureKeys: ['converter.loss.nesting', 'converter.loss.precision', 'converter.loss.columns'],
    sandboxKey: 'converter.sandbox.renderer',
    validatorKey: 'converter.validator.records',
    async run(input, services) {
      const set = readRecords(input, services);
      const preflight = exporter.preflight(set.rows, exportFormat);
      const result = exporter.serialize(set.rows, exportFormat, { name: 'records', encoding: 'utf-8' });
      services.deadline.check();

      const notes = [
        `${set.rows.length} record(s) with ${set.columns.length} column(s) were read.`,
        ...set.notes,
        ...preflight.losses.map((loss) => `The ${exportFormat.toUpperCase()} format cannot carry "${loss.field}": ${loss.reason}`)
      ];

      const checks: ValidationCheck[] = [];
      const text = result.text;
      if (exportFormat === 'json') {
        const reparsed = JSON.parse(text) as unknown[];
        checks.push(check('record count', String(set.rows.length), String(Array.isArray(reparsed) ? reparsed.length : 1)));
      } else if (exportFormat === 'jsonl') {
        const lines = text.split('\n').filter((line) => line.trim().length > 0);
        for (const line of lines) JSON.parse(line);
        checks.push(check('record count', String(set.rows.length), String(lines.length)));
      } else if (exportFormat === 'csv' || exportFormat === 'tsv') {
        const back = readDelimited(text, exportFormat === 'csv' ? ',' : '\t', services.limits, services.deadline);
        checks.push(check('record count', String(set.rows.length), String(back.rows.length)));
      } else if (exportFormat === 'xml' || exportFormat === 'html') {
        parseXmlOrThrow(exportFormat === 'html' ? `<root>${text.replace(/<!DOCTYPE[^>]*>/i, '')}</root>` : text, exportFormat);
        checks.push(check('re-parse', 'the produced document parses', 'the produced document parses'));
      } else {
        checks.push(check('not empty', 'the produced document has content', text.trim().length > 0 ? 'the produced document has content' : 'it was empty'));
      }
      requireAllChecks(checks);
      return finish(text, extension, notes, checks, services.limits);
    }
  };
}

function unavailableRecordSource(sourceFormat: string, what: string): AdapterSpec {
  return {
    id: `data.source.${sourceFormat}`,
    category: 'data',
    sourceFormats: [sourceFormat],
    targetFormat: 'json',
    targetExtension: 'json',
    detailKey: 'converter.detail.records',
    bundled: false,
    proof: '',
    unavailableKey: 'converter.reason.noReader',
    unavailableValues: { what },
    lossiness: 'lossless',
    metadataKey: 'converter.metadata.records',
    disclosureKeys: ['converter.loss.nesting'],
    sandboxKey: 'converter.sandbox.renderer',
    validatorKey: 'converter.validator.records'
  };
}

/* ------------------------------------------------------------------ */
/* The registry                                                        */
/* ------------------------------------------------------------------ */

const IMAGE_SOURCES = ['png', 'jpeg', 'gif', 'webp', 'bmp'];

export const ADAPTERS: AdapterSpec[] = [
  /* ---------------- Documents / PDF ---------------- */
  {
    id: 'documents.pdf.inspect',
    category: 'documents',
    sourceFormats: ['pdf'],
    targetFormat: 'pdfReport',
    targetExtension: 'json',
    detailKey: 'converter.detail.pdfInspect',
    bundled: true,
    proof: `${RENDERER_PROOF}: features/converter/pdf.ts`,
    lossiness: 'inspection',
    metadataKey: 'converter.metadata.readOnly',
    disclosureKeys: ['converter.loss.none'],
    sandboxKey: 'converter.sandbox.renderer',
    validatorKey: 'converter.validator.json',
    async run(input, services) {
      const doc = await PdfDocument.open(input.bytes, services.limits, services.deadline);
      const report = await doc.inspect();
      const notes = [
        `PDF ${report.version} with ${report.pageCount} page(s).`,
        report.encrypted
          ? 'The document is encrypted, so only the trailer was read and no page information is available.'
          : `Cross-reference style: ${report.crossReferenceStyle}; ${report.objectStreams} object stream(s) expanded.`
      ];
      return jsonOutput(report, services.limits, notes);
    }
  },
  {
    id: 'documents.pdf.pages',
    category: 'documents',
    sourceFormats: ['pdf'],
    targetFormat: 'pdfPages',
    targetExtension: 'csv',
    detailKey: 'converter.detail.pdfPages',
    bundled: true,
    proof: `${RENDERER_PROOF}: features/converter/pdf.ts + core/export.ts`,
    lossiness: 'inspection',
    metadataKey: 'converter.metadata.readOnly',
    disclosureKeys: ['converter.loss.none'],
    sandboxKey: 'converter.sandbox.renderer',
    validatorKey: 'converter.validator.records',
    async run(input, services) {
      const doc = await PdfDocument.open(input.bytes, services.limits, services.deadline);
      const report = await doc.inspect();
      if (report.encrypted) {
        throw new ConverterBoundary(
          'encrypted',
          'The document is encrypted. This build cannot supply a password to it, so no page inventory could be read.'
        );
      }
      const rows = report.pages.map((page) => ({ ...page }));
      const result = exporter.serialize(rows, 'csv', { name: 'pdf-pages', encoding: 'utf-8' });
      const back = readDelimited(result.text, ',', services.limits, services.deadline);
      const checks = [check('page count', String(rows.length), String(back.rows.length))];
      requireAllChecks(checks);
      return finish(result.text, 'csv', [`${rows.length} page(s) inventoried.`], checks, services.limits);
    }
  },
  {
    id: 'documents.pdf.extract',
    category: 'documents',
    sourceFormats: ['pdf'],
    targetFormat: 'pdf',
    targetExtension: 'pdf',
    detailKey: 'converter.detail.pdfExtract',
    bundled: true,
    proof: `${RENDERER_PROOF}: features/converter/pdf.ts`,
    lossiness: 'lossy',
    metadataKey: 'converter.metadata.pdfRewrite',
    disclosureKeys: [
      'converter.loss.pdfStructure',
      'converter.loss.pdfSignature',
      'converter.loss.pdfSizeGrowth',
      'converter.loss.metadata'
    ],
    sandboxKey: 'converter.sandbox.renderer',
    validatorKey: 'converter.validator.pdfReopen',
    options: [
      {
        id: 'pages',
        labelKey: 'converter.option.pageRange',
        descriptionKey: 'converter.option.pageRange.description',
        kind: 'text',
        defaultValue: '1-'
      },
      {
        id: 'rotate',
        labelKey: 'converter.option.rotate',
        descriptionKey: 'converter.option.rotate.description',
        kind: 'select',
        choices: [
          { value: 'keep', label: 'converter.rotate.keep' },
          { value: '0', label: 'converter.rotate.0' },
          { value: '90', label: 'converter.rotate.90' },
          { value: '180', label: 'converter.rotate.180' },
          { value: '270', label: 'converter.rotate.270' }
        ],
        defaultValue: 'keep'
      }
    ],
    async run(input, services) {
      return runPdfRewrite(input, services, services.options.pages ?? '1-', services.options.rotate ?? 'keep', {});
    }
  },
  {
    id: 'documents.pdf.reorder',
    category: 'documents',
    sourceFormats: ['pdf'],
    targetFormat: 'pdf',
    targetExtension: 'pdf',
    detailKey: 'converter.detail.pdfReorder',
    bundled: true,
    proof: `${RENDERER_PROOF}: features/converter/pdf.ts`,
    lossiness: 'lossy',
    metadataKey: 'converter.metadata.pdfRewrite',
    disclosureKeys: ['converter.loss.pdfStructure', 'converter.loss.pdfSignature', 'converter.loss.pdfSizeGrowth'],
    sandboxKey: 'converter.sandbox.renderer',
    validatorKey: 'converter.validator.pdfReopen',
    options: [
      {
        id: 'order',
        labelKey: 'converter.option.pageOrder',
        descriptionKey: 'converter.option.pageOrder.description',
        kind: 'text',
        defaultValue: '1-'
      }
    ],
    async run(input, services) {
      return runPdfRewrite(input, services, services.options.order ?? '1-', 'keep', {});
    }
  },
  {
    id: 'documents.pdf.rotate',
    category: 'documents',
    sourceFormats: ['pdf'],
    targetFormat: 'pdf',
    targetExtension: 'pdf',
    detailKey: 'converter.detail.pdfRotate',
    bundled: true,
    proof: `${RENDERER_PROOF}: features/converter/pdf.ts`,
    lossiness: 'lossy',
    metadataKey: 'converter.metadata.pdfRewrite',
    disclosureKeys: ['converter.loss.pdfStructure', 'converter.loss.pdfSignature', 'converter.loss.pdfSizeGrowth'],
    sandboxKey: 'converter.sandbox.renderer',
    validatorKey: 'converter.validator.pdfReopen',
    options: [
      {
        id: 'rotate',
        labelKey: 'converter.option.rotate',
        descriptionKey: 'converter.option.rotate.description',
        kind: 'select',
        choices: [
          { value: '0', label: 'converter.rotate.0' },
          { value: '90', label: 'converter.rotate.90' },
          { value: '180', label: 'converter.rotate.180' },
          { value: '270', label: 'converter.rotate.270' }
        ],
        defaultValue: '90'
      }
    ],
    async run(input, services) {
      return runPdfRewrite(input, services, '1-', services.options.rotate ?? '90', {});
    }
  },
  {
    id: 'documents.pdf.metadata',
    category: 'documents',
    sourceFormats: ['pdf'],
    targetFormat: 'pdf',
    targetExtension: 'pdf',
    detailKey: 'converter.detail.pdfMetadata',
    bundled: true,
    proof: `${RENDERER_PROOF}: features/converter/pdf.ts`,
    lossiness: 'lossy',
    metadataKey: 'converter.metadata.pdfWrite',
    disclosureKeys: ['converter.loss.pdfStructure', 'converter.loss.pdfSignature', 'converter.loss.pdfSizeGrowth'],
    sandboxKey: 'converter.sandbox.renderer',
    validatorKey: 'converter.validator.pdfReopen',
    options: [
      { id: 'title', labelKey: 'converter.option.title', descriptionKey: 'converter.option.title.description', kind: 'text', defaultValue: '' },
      { id: 'author', labelKey: 'converter.option.author', descriptionKey: 'converter.option.author.description', kind: 'text', defaultValue: '' },
      { id: 'subject', labelKey: 'converter.option.subject', descriptionKey: 'converter.option.subject.description', kind: 'text', defaultValue: '' },
      { id: 'keywords', labelKey: 'converter.option.keywords', descriptionKey: 'converter.option.keywords.description', kind: 'text', defaultValue: '' }
    ],
    async run(input, services) {
      return runPdfRewrite(input, services, '1-', 'keep', {
        Title: services.options.title ?? '',
        Author: services.options.author ?? '',
        Subject: services.options.subject ?? '',
        Keywords: services.options.keywords ?? ''
      });
    }
  },
  {
    id: 'documents.pdf.split',
    category: 'documents',
    sourceFormats: ['pdf'],
    targetFormat: 'pdf',
    targetExtension: 'pdf',
    detailKey: 'converter.detail.pdfSplit',
    bundled: true,
    proof: `${RENDERER_PROOF}: features/converter/pdf.ts`,
    lossiness: 'lossy',
    metadataKey: 'converter.metadata.pdfRewrite',
    disclosureKeys: ['converter.loss.pdfStructure', 'converter.loss.pdfSignature', 'converter.loss.pdfSizeGrowth'],
    sandboxKey: 'converter.sandbox.renderer',
    validatorKey: 'converter.validator.pdfReopen',
    multiFile: 'split'
  },
  {
    id: 'documents.pdf.merge',
    category: 'documents',
    sourceFormats: ['pdf'],
    targetFormat: 'pdf',
    targetExtension: 'pdf',
    detailKey: 'converter.detail.pdfMerge',
    bundled: true,
    proof: `${RENDERER_PROOF}: features/converter/pdf.ts`,
    lossiness: 'lossy',
    metadataKey: 'converter.metadata.pdfRewrite',
    disclosureKeys: ['converter.loss.pdfStructure', 'converter.loss.pdfSignature', 'converter.loss.pdfSizeGrowth'],
    sandboxKey: 'converter.sandbox.renderer',
    validatorKey: 'converter.validator.pdfReopen',
    multiFile: 'merge'
  },
  {
    id: 'documents.docx.text',
    category: 'documents',
    sourceFormats: ['docx'],
    targetFormat: 'text',
    targetExtension: 'txt',
    detailKey: 'converter.detail.officeText',
    bundled: true,
    proof: `${RENDERER_PROOF}: features/converter/archives.ts + adapters.ts`,
    probe: DECOMPRESSION_PROBE,
    lossiness: 'lossy',
    metadataKey: 'converter.metadata.dropped',
    disclosureKeys: ['converter.loss.layers', 'converter.loss.fonts', 'converter.loss.metadata'],
    sandboxKey: 'converter.sandbox.renderer',
    validatorKey: 'converter.validator.text',
    async run(input, services) {
      return runOfficeText(input, services, 'word/document.xml', 'w:p', 'w:t');
    }
  },
  {
    id: 'documents.odt.text',
    category: 'documents',
    sourceFormats: ['odt'],
    targetFormat: 'text',
    targetExtension: 'txt',
    detailKey: 'converter.detail.officeText',
    bundled: true,
    proof: `${RENDERER_PROOF}: features/converter/archives.ts + adapters.ts`,
    probe: DECOMPRESSION_PROBE,
    lossiness: 'lossy',
    metadataKey: 'converter.metadata.dropped',
    disclosureKeys: ['converter.loss.layers', 'converter.loss.fonts', 'converter.loss.metadata'],
    sandboxKey: 'converter.sandbox.renderer',
    validatorKey: 'converter.validator.text',
    async run(input, services) {
      return runOfficeText(input, services, 'content.xml', 'text:p', '');
    }
  },
  {
    id: 'documents.docx.pdf',
    category: 'documents',
    sourceFormats: ['docx', 'odt', 'rtf'],
    targetFormat: 'pdf',
    targetExtension: 'pdf',
    detailKey: 'converter.detail.officeLayout',
    bundled: false,
    proof: '',
    unavailableKey: 'converter.reason.noLayoutEngine',
    lossiness: 'lossy',
    metadataKey: 'converter.metadata.dropped',
    disclosureKeys: ['converter.loss.fonts', 'converter.loss.layers'],
    sandboxKey: 'converter.sandbox.renderer',
    validatorKey: 'converter.validator.pdfReopen'
  },
  {
    id: 'documents.rtf.text',
    category: 'documents',
    sourceFormats: ['rtf'],
    targetFormat: 'text',
    targetExtension: 'txt',
    detailKey: 'converter.detail.officeText',
    bundled: false,
    proof: '',
    unavailableKey: 'converter.reason.noReader',
    unavailableValues: { what: 'an RTF control-word reader' },
    lossiness: 'lossy',
    metadataKey: 'converter.metadata.dropped',
    disclosureKeys: ['converter.loss.fonts'],
    sandboxKey: 'converter.sandbox.renderer',
    validatorKey: 'converter.validator.text'
  },
  {
    id: 'documents.epub.text',
    category: 'documents',
    sourceFormats: ['epub'],
    targetFormat: 'text',
    targetExtension: 'txt',
    detailKey: 'converter.detail.officeText',
    bundled: false,
    proof: '',
    unavailableKey: 'converter.reason.noReader',
    unavailableValues: { what: 'an EPUB spine and manifest reader' },
    lossiness: 'lossy',
    metadataKey: 'converter.metadata.dropped',
    disclosureKeys: ['converter.loss.layers'],
    sandboxKey: 'converter.sandbox.renderer',
    validatorKey: 'converter.validator.text'
  },

  /* ---------------- Images ---------------- */
  {
    id: 'images.raster.inspect',
    category: 'images',
    sourceFormats: IMAGE_SOURCES,
    targetFormat: 'imageReport',
    targetExtension: 'json',
    detailKey: 'converter.detail.imageInspect',
    bundled: true,
    proof: `${RENDERER_PROOF}: features/converter/images.ts`,
    lossiness: 'inspection',
    metadataKey: 'converter.metadata.readOnly',
    disclosureKeys: ['converter.loss.none'],
    sandboxKey: 'converter.sandbox.renderer',
    validatorKey: 'converter.validator.json',
    async run(input, services) {
      const report = inspectImage(input.detection.formatId ?? '', input.bytes, services.limits, services.deadline);
      return jsonOutput(report, services.limits, [
        `${report.format} ${report.width}x${report.height}, ${report.frames} frame(s).`,
        report.hasColourProfile ? 'A colour-space or profile chunk is present.' : 'No colour profile chunk is present.'
      ]);
    }
  },
  {
    id: 'images.raster.ppm',
    category: 'images',
    sourceFormats: IMAGE_SOURCES,
    targetFormat: 'ppm',
    targetExtension: 'ppm',
    detailKey: 'converter.detail.netpbm',
    bundled: true,
    proof: `${RENDERER_PROOF}: features/converter/images.ts + the packaged runtime's image decoders`,
    probe: RASTER_PROBE,
    lossiness: 'lossy',
    metadataKey: 'converter.metadata.dropped',
    disclosureKeys: ['converter.loss.alpha', 'converter.loss.profile', 'converter.loss.animation', 'converter.loss.metadata', 'converter.loss.sizeGrowth'],
    sandboxKey: 'converter.sandbox.decoder',
    validatorKey: 'converter.validator.netpbm',
    options: [
      {
        id: 'background',
        labelKey: 'converter.option.background',
        descriptionKey: 'converter.option.background.description',
        kind: 'color',
        defaultValue: '#ffffff'
      }
    ],
    async run(input, services) {
      const raster = await decodeRaster(input.bytes, mimeTypeFor(input.detection.formatId ?? ''), services.limits, services.deadline);
      const text = encodePpm(raster, { backgroundHex: services.options.background ?? '#ffffff', maxOutputBytes: services.limits.outputBytes }, services.deadline);
      const checks = validateNetpbm(text, 'P3', raster.width, raster.height, 3);
      requireAllChecks(checks);
      return finish(
        text,
        'ppm',
        [
          `Decoded ${raster.width}x${raster.height} and written as ASCII PPM.`,
          `Transparent pixels were composited over ${services.options.background ?? '#ffffff'} because netpbm has no alpha channel.`
        ],
        checks,
        services.limits
      );
    }
  },
  {
    id: 'images.raster.pgm',
    category: 'images',
    sourceFormats: IMAGE_SOURCES,
    targetFormat: 'pgm',
    targetExtension: 'pgm',
    detailKey: 'converter.detail.netpbm',
    bundled: true,
    proof: `${RENDERER_PROOF}: features/converter/images.ts + the packaged runtime's image decoders`,
    probe: RASTER_PROBE,
    lossiness: 'lossy',
    metadataKey: 'converter.metadata.dropped',
    disclosureKeys: ['converter.loss.alpha', 'converter.loss.profile', 'converter.loss.colour', 'converter.loss.metadata', 'converter.loss.sizeGrowth'],
    sandboxKey: 'converter.sandbox.decoder',
    validatorKey: 'converter.validator.netpbm',
    options: [
      {
        id: 'background',
        labelKey: 'converter.option.background',
        descriptionKey: 'converter.option.background.description',
        kind: 'color',
        defaultValue: '#ffffff'
      }
    ],
    async run(input, services) {
      const raster = await decodeRaster(input.bytes, mimeTypeFor(input.detection.formatId ?? ''), services.limits, services.deadline);
      const text = encodePgm(raster, { backgroundHex: services.options.background ?? '#ffffff', maxOutputBytes: services.limits.outputBytes }, services.deadline);
      const checks = validateNetpbm(text, 'P2', raster.width, raster.height, 1);
      requireAllChecks(checks);
      return finish(
        text,
        'pgm',
        [
          `Decoded ${raster.width}x${raster.height} and written as ASCII PGM.`,
          'Colour was reduced to Rec. 709 luminance, which cannot be reversed.'
        ],
        checks,
        services.limits
      );
    }
  },
  {
    id: 'images.raster.svg',
    category: 'images',
    sourceFormats: IMAGE_SOURCES,
    targetFormat: 'svg',
    targetExtension: 'svg',
    detailKey: 'converter.detail.svgWrap',
    bundled: true,
    proof: `${RENDERER_PROOF}: features/converter/images.ts`,
    lossiness: 'container',
    metadataKey: 'converter.metadata.preserved',
    disclosureKeys: ['converter.loss.notVector', 'converter.loss.sizeGrowth'],
    sandboxKey: 'converter.sandbox.renderer',
    validatorKey: 'converter.validator.svg',
    async run(input, services) {
      const report = inspectImage(input.detection.formatId ?? '', input.bytes, services.limits, services.deadline);
      if (report.width <= 0 || report.height <= 0) {
        throw new ConverterBoundary('malformed', 'The image header does not state usable dimensions, so no viewport could be written.');
      }
      const mime = mimeTypeFor(input.detection.formatId ?? '');
      const text = encodeSvgContainer(input.bytes, mime, report.width, report.height, services.limits.outputBytes);
      parseXmlOrThrow(text, 'SVG document');
      const parsed = new DOMParser().parseFromString(text, 'image/svg+xml');
      const checks = [
        check('root element', 'svg', parsed.documentElement.localName),
        check('viewport', `${report.width}x${report.height}`, `${parsed.documentElement.getAttribute('width')}x${parsed.documentElement.getAttribute('height')}`)
      ];
      requireAllChecks(checks);
      return finish(
        text,
        'svg',
        [
          `The ${report.format} bytes were embedded unchanged inside an SVG viewport of ${report.width}x${report.height}.`,
          'This is a container change, not a vectorisation: the picture inside is still the original raster.',
          `Base64 embedding grows the file to roughly ${formatBytes(Math.ceil(input.bytes.length * 1.37))}.`
        ],
        checks,
        services.limits
      );
    }
  },
  {
    id: 'images.raster.binary',
    category: 'images',
    sourceFormats: IMAGE_SOURCES,
    targetFormat: 'png',
    targetExtension: 'png',
    detailKey: 'converter.detail.rasterBinary',
    bundled: true,
    proof: `${RENDERER_PROOF}: features/converter/images.ts`,
    probe: BINARY_WRITE_PROBE,
    lossiness: 'lossy',
    metadataKey: 'converter.metadata.dropped',
    disclosureKeys: ['converter.loss.metadata', 'converter.loss.profile'],
    sandboxKey: 'converter.sandbox.decoder',
    validatorKey: 'converter.validator.signature'
  },
  {
    id: 'images.tiff.any',
    category: 'images',
    sourceFormats: ['tiff'],
    targetFormat: 'ppm',
    targetExtension: 'ppm',
    detailKey: 'converter.detail.netpbm',
    bundled: false,
    proof: '',
    unavailableKey: 'converter.reason.noDecoder',
    unavailableValues: { what: 'a TIFF decoder; the packaged runtime does not decode TIFF' },
    lossiness: 'lossy',
    metadataKey: 'converter.metadata.dropped',
    disclosureKeys: ['converter.loss.alpha', 'converter.loss.profile'],
    sandboxKey: 'converter.sandbox.decoder',
    validatorKey: 'converter.validator.netpbm'
  },
  {
    id: 'images.ico.any',
    category: 'images',
    sourceFormats: ['ico'],
    targetFormat: 'ppm',
    targetExtension: 'ppm',
    detailKey: 'converter.detail.netpbm',
    bundled: false,
    proof: '',
    unavailableKey: 'converter.reason.noReader',
    unavailableValues: { what: 'a Windows icon directory reader' },
    lossiness: 'lossy',
    metadataKey: 'converter.metadata.dropped',
    disclosureKeys: ['converter.loss.alpha'],
    sandboxKey: 'converter.sandbox.decoder',
    validatorKey: 'converter.validator.netpbm'
  },
  {
    id: 'images.svg.raster',
    category: 'images',
    sourceFormats: ['svg'],
    targetFormat: 'ppm',
    targetExtension: 'ppm',
    detailKey: 'converter.detail.netpbm',
    bundled: false,
    proof: '',
    unavailableKey: 'converter.reason.noRasteriser',
    lossiness: 'lossy',
    metadataKey: 'converter.metadata.dropped',
    disclosureKeys: ['converter.loss.alpha'],
    sandboxKey: 'converter.sandbox.decoder',
    validatorKey: 'converter.validator.netpbm'
  },

  /* ---------------- Audio ---------------- */
  {
    id: 'audio.wav.inspect',
    category: 'audio',
    sourceFormats: ['wav'],
    targetFormat: 'audioReport',
    targetExtension: 'json',
    detailKey: 'converter.detail.mediaInspect',
    bundled: true,
    proof: `${RENDERER_PROOF}: features/converter/media.ts`,
    lossiness: 'inspection',
    metadataKey: 'converter.metadata.readOnly',
    disclosureKeys: ['converter.loss.none'],
    sandboxKey: 'converter.sandbox.renderer',
    validatorKey: 'converter.validator.json',
    async run(input, services) {
      const report = inspectWave(input.bytes, services.limits, services.deadline);
      return jsonOutput(report, services.limits, [
        `${report.container}: ${report.tracks[0]?.detail ?? 'no format chunk was found'}.`
      ]);
    }
  },
  {
    id: 'audio.mp3.inspect',
    category: 'audio',
    sourceFormats: ['mp3'],
    targetFormat: 'audioReport',
    targetExtension: 'json',
    detailKey: 'converter.detail.mediaInspect',
    bundled: true,
    proof: `${RENDERER_PROOF}: features/converter/media.ts`,
    lossiness: 'inspection',
    metadataKey: 'converter.metadata.readOnly',
    disclosureKeys: ['converter.loss.none'],
    sandboxKey: 'converter.sandbox.renderer',
    validatorKey: 'converter.validator.json',
    async run(input, services) {
      const report = inspectMp3(input.bytes, services.limits, services.deadline);
      return jsonOutput(report, services.limits, [
        'Duration is estimated from the first frame, so a variable-bitrate file without a Xing header will be approximate.'
      ]);
    }
  },
  {
    id: 'audio.any.transcode',
    category: 'audio',
    sourceFormats: ['wav', 'mp3', 'flac', 'ogg'],
    targetFormat: 'mp3',
    targetExtension: 'mp3',
    detailKey: 'converter.detail.transcode',
    bundled: false,
    proof: '',
    unavailableKey: 'converter.reason.noCodec',
    unavailableValues: { what: 'an audio encoder' },
    lossiness: 'lossy',
    metadataKey: 'converter.metadata.dropped',
    disclosureKeys: ['converter.loss.precision', 'converter.loss.metadata'],
    sandboxKey: 'converter.sandbox.decoder',
    validatorKey: 'converter.validator.signature'
  },
  {
    id: 'audio.flac.inspect',
    category: 'audio',
    sourceFormats: ['flac'],
    targetFormat: 'audioReport',
    targetExtension: 'json',
    detailKey: 'converter.detail.mediaInspect',
    bundled: false,
    proof: '',
    unavailableKey: 'converter.reason.noReader',
    unavailableValues: { what: 'a FLAC metadata-block reader' },
    lossiness: 'inspection',
    metadataKey: 'converter.metadata.readOnly',
    disclosureKeys: ['converter.loss.none'],
    sandboxKey: 'converter.sandbox.renderer',
    validatorKey: 'converter.validator.json'
  },
  {
    id: 'audio.ogg.inspect',
    category: 'audio',
    sourceFormats: ['ogg'],
    targetFormat: 'audioReport',
    targetExtension: 'json',
    detailKey: 'converter.detail.mediaInspect',
    bundled: false,
    proof: '',
    unavailableKey: 'converter.reason.noReader',
    unavailableValues: { what: 'an Ogg page and codec-header reader' },
    lossiness: 'inspection',
    metadataKey: 'converter.metadata.readOnly',
    disclosureKeys: ['converter.loss.none'],
    sandboxKey: 'converter.sandbox.renderer',
    validatorKey: 'converter.validator.json'
  },

  /* ---------------- Video ---------------- */
  {
    id: 'video.mp4.inspect',
    category: 'video',
    sourceFormats: ['mp4'],
    targetFormat: 'videoReport',
    targetExtension: 'json',
    detailKey: 'converter.detail.mediaInspect',
    bundled: true,
    proof: `${RENDERER_PROOF}: features/converter/media.ts`,
    lossiness: 'inspection',
    metadataKey: 'converter.metadata.readOnly',
    disclosureKeys: ['converter.loss.none'],
    sandboxKey: 'converter.sandbox.renderer',
    validatorKey: 'converter.validator.json',
    async run(input, services) {
      const report = inspectMp4(input.bytes, services.limits, services.deadline);
      return jsonOutput(report, services.limits, [`${report.tracks.length} track(s) declared in the movie header.`]);
    }
  },
  {
    id: 'video.matroska.inspect',
    category: 'video',
    sourceFormats: ['webm', 'mkv'],
    targetFormat: 'videoReport',
    targetExtension: 'json',
    detailKey: 'converter.detail.mediaInspect',
    bundled: true,
    proof: `${RENDERER_PROOF}: features/converter/media.ts`,
    lossiness: 'inspection',
    metadataKey: 'converter.metadata.readOnly',
    disclosureKeys: ['converter.loss.none'],
    sandboxKey: 'converter.sandbox.renderer',
    validatorKey: 'converter.validator.json',
    async run(input, services) {
      const report = inspectMatroska(input.bytes, services.limits, services.deadline);
      return jsonOutput(report, services.limits, [
        'The scan stops at the first cluster, so nothing past the header was read.'
      ]);
    }
  },
  {
    id: 'video.any.transcode',
    category: 'video',
    sourceFormats: ['mp4', 'webm', 'mkv', 'avi'],
    targetFormat: 'mp4',
    targetExtension: 'mp4',
    detailKey: 'converter.detail.transcode',
    bundled: false,
    proof: '',
    unavailableKey: 'converter.reason.noCodec',
    unavailableValues: { what: 'a video encoder' },
    lossiness: 'lossy',
    metadataKey: 'converter.metadata.dropped',
    disclosureKeys: ['converter.loss.precision', 'converter.loss.metadata'],
    sandboxKey: 'converter.sandbox.decoder',
    validatorKey: 'converter.validator.signature'
  },
  {
    id: 'video.avi.inspect',
    category: 'video',
    sourceFormats: ['avi'],
    targetFormat: 'videoReport',
    targetExtension: 'json',
    detailKey: 'converter.detail.mediaInspect',
    bundled: false,
    proof: '',
    unavailableKey: 'converter.reason.noReader',
    unavailableValues: { what: 'a RIFF/AVI stream-header reader' },
    lossiness: 'inspection',
    metadataKey: 'converter.metadata.readOnly',
    disclosureKeys: ['converter.loss.none'],
    sandboxKey: 'converter.sandbox.renderer',
    validatorKey: 'converter.validator.json'
  },

  /* ---------------- Archives ---------------- */
  {
    id: 'archives.zip.inspect',
    category: 'archives',
    sourceFormats: ['zip', 'docx', 'xlsx', 'odt', 'ods', 'epub'],
    targetFormat: 'archiveReport',
    targetExtension: 'json',
    detailKey: 'converter.detail.archiveInspect',
    bundled: true,
    proof: `${RENDERER_PROOF}: features/converter/archives.ts`,
    lossiness: 'inspection',
    metadataKey: 'converter.metadata.readOnly',
    disclosureKeys: ['converter.loss.none'],
    sandboxKey: 'converter.sandbox.renderer',
    validatorKey: 'converter.validator.json',
    async run(input, services) {
      const inventory = readZipInventory(input.bytes, services.limits, services.deadline);
      const unsafe = inventory.entries.filter((entry) => isUnsafeArchivePath(entry.path));
      return jsonOutput({ ...inventory, unsafePaths: unsafe.map((entry) => entry.path) }, services.limits, [
        `${inventory.entries.length} member(s), ${formatBytes(inventory.totalUncompressed)} uncompressed.`,
        unsafe.length > 0
          ? `${unsafe.length} member path(s) point outside the archive root and are marked in the report.`
          : 'No member path points outside the archive root.'
      ]);
    }
  },
  {
    id: 'archives.zip.list',
    category: 'archives',
    sourceFormats: ['zip', 'docx', 'xlsx', 'odt', 'ods', 'epub'],
    targetFormat: 'archiveReport',
    targetExtension: 'csv',
    detailKey: 'converter.detail.archiveList',
    bundled: true,
    proof: `${RENDERER_PROOF}: features/converter/archives.ts + core/export.ts`,
    lossiness: 'inspection',
    metadataKey: 'converter.metadata.readOnly',
    disclosureKeys: ['converter.loss.none'],
    sandboxKey: 'converter.sandbox.renderer',
    validatorKey: 'converter.validator.records',
    async run(input, services) {
      const inventory = readZipInventory(input.bytes, services.limits, services.deadline);
      const rows = inventory.entries.map((entry) => ({
        path: entry.path,
        directory: entry.directory,
        size: entry.size,
        compressedSize: entry.compressedSize,
        method: entry.method,
        modifiedAt: entry.modifiedAt,
        crc32: entry.crc32,
        encrypted: entry.encrypted,
        unsafePath: isUnsafeArchivePath(entry.path)
      }));
      const result = exporter.serialize(rows, 'csv', { name: 'archive-members', encoding: 'utf-8' });
      const back = readDelimited(result.text, ',', services.limits, services.deadline);
      const checks = [check('member count', String(rows.length), String(back.rows.length))];
      requireAllChecks(checks);
      return finish(result.text, 'csv', [`${rows.length} member(s) listed.`], checks, services.limits);
    }
  },
  {
    id: 'archives.zip.member',
    category: 'archives',
    sourceFormats: ['zip', 'docx', 'xlsx', 'odt', 'ods', 'epub'],
    targetFormat: 'archiveMember',
    targetExtension: 'txt',
    detailKey: 'converter.detail.archiveMember',
    bundled: true,
    proof: `${RENDERER_PROOF}: features/converter/archives.ts`,
    probe: DECOMPRESSION_PROBE,
    lossiness: 'lossless',
    metadataKey: 'converter.metadata.memberOnly',
    disclosureKeys: ['converter.loss.encoding', 'converter.loss.memberBinary'],
    sandboxKey: 'converter.sandbox.renderer',
    validatorKey: 'converter.validator.crc',
    options: [
      {
        id: 'member',
        labelKey: 'converter.option.member',
        descriptionKey: 'converter.option.member.description',
        kind: 'text',
        defaultValue: ''
      }
    ],
    async run(input, services) {
      const inventory = readZipInventory(input.bytes, services.limits, services.deadline);
      const wanted = (services.options.member ?? '').trim();
      const entry = wanted.length > 0
        ? inventory.entries.find((candidate) => candidate.path === wanted)
        : inventory.entries.find((candidate) => !candidate.directory);
      if (!entry) {
        throw new ConverterBoundary(
          'unsupported',
          wanted.length > 0
            ? `The archive holds no member named "${wanted}". Nothing was extracted.`
            : 'The archive holds no file member, so there is nothing to extract.'
        );
      }
      const data = await readZipMember(input.bytes, entry, services.limits, services.deadline);
      const text = decodeMemberText(data, entry);
      const checks = [check('CRC-32', entry.crc32, entry.crc32)];
      return finish(
        text,
        'txt',
        [
          `Extracted "${entry.path}" (${formatBytes(entry.size)}, ${entry.method}).`,
          'The member passed its recorded CRC-32 before it was decoded as text.'
        ],
        checks,
        services.limits
      );
    }
  },
  {
    id: 'archives.gzip.text',
    category: 'archives',
    sourceFormats: ['gzip'],
    targetFormat: 'text',
    targetExtension: 'txt',
    detailKey: 'converter.detail.gzip',
    bundled: true,
    proof: `${RENDERER_PROOF}: features/converter/archives.ts`,
    probe: DECOMPRESSION_PROBE,
    lossiness: 'lossless',
    metadataKey: 'converter.metadata.memberOnly',
    disclosureKeys: ['converter.loss.encoding', 'converter.loss.memberBinary'],
    sandboxKey: 'converter.sandbox.renderer',
    validatorKey: 'converter.validator.crc',
    async run(input, services) {
      const data = await readGzipMember(input.bytes, services.limits, services.deadline);
      let text: string;
      try {
        text = bytesToUtf8Strict(data);
      } catch {
        throw new ConverterBoundary(
          'unsupported',
          'The decompressed member is not valid UTF-8 text, and this build has no channel for writing arbitrary bytes. Nothing was written.'
        );
      }
      const checks = [check('CRC-32', 'the gzip trailer matches the decompressed bytes', 'the gzip trailer matches the decompressed bytes')];
      return finish(text, 'txt', [`Decompressed ${formatBytes(data.length)} from the gzip member.`], checks, services.limits);
    }
  },
  {
    id: 'archives.tar.inspect',
    category: 'archives',
    sourceFormats: ['tar'],
    targetFormat: 'archiveReport',
    targetExtension: 'json',
    detailKey: 'converter.detail.archiveInspect',
    bundled: true,
    proof: `${RENDERER_PROOF}: features/converter/archives.ts`,
    lossiness: 'inspection',
    metadataKey: 'converter.metadata.readOnly',
    disclosureKeys: ['converter.loss.none'],
    sandboxKey: 'converter.sandbox.renderer',
    validatorKey: 'converter.validator.json',
    async run(input, services) {
      const inventory = readTarInventory(input.bytes, services.limits, services.deadline);
      const unsafe = inventory.entries.filter((entry) => isUnsafeArchivePath(entry.path));
      return jsonOutput({ ...inventory, unsafePaths: unsafe.map((entry) => entry.path) }, services.limits, [
        `${inventory.entries.length} member(s), ${formatBytes(inventory.totalUncompressed)} in total.`
      ]);
    }
  },
  {
    id: 'archives.tar.member',
    category: 'archives',
    sourceFormats: ['tar'],
    targetFormat: 'archiveMember',
    targetExtension: 'txt',
    detailKey: 'converter.detail.archiveMember',
    bundled: true,
    proof: `${RENDERER_PROOF}: features/converter/archives.ts`,
    lossiness: 'lossless',
    metadataKey: 'converter.metadata.memberOnly',
    disclosureKeys: ['converter.loss.encoding', 'converter.loss.memberBinary'],
    sandboxKey: 'converter.sandbox.renderer',
    validatorKey: 'converter.validator.size',
    options: [
      {
        id: 'member',
        labelKey: 'converter.option.member',
        descriptionKey: 'converter.option.member.description',
        kind: 'text',
        defaultValue: ''
      }
    ],
    async run(input, services) {
      const inventory = readTarInventory(input.bytes, services.limits, services.deadline);
      const wanted = (services.options.member ?? '').trim();
      const entry = wanted.length > 0
        ? inventory.entries.find((candidate) => candidate.path === wanted)
        : inventory.entries.find((candidate) => !candidate.directory && candidate.size > 0);
      if (!entry) {
        throw new ConverterBoundary(
          'unsupported',
          wanted.length > 0
            ? `The archive holds no member named "${wanted}". Nothing was extracted.`
            : 'The archive holds no file member with content, so there is nothing to extract.'
        );
      }
      const data = readTarMember(input.bytes, entry, services.limits);
      const text = decodeMemberText(data, entry);
      const checks = [check('member size', String(entry.size), String(data.length))];
      requireAllChecks(checks);
      return finish(text, 'txt', [`Extracted "${entry.path}" (${formatBytes(entry.size)}).`], checks, services.limits);
    }
  },
  {
    id: 'archives.any.create',
    category: 'archives',
    sourceFormats: ['text', 'json', 'csv', 'png', 'pdf'],
    targetFormat: 'zip',
    targetExtension: 'zip',
    detailKey: 'converter.detail.archiveCreate',
    bundled: true,
    proof: `${RENDERER_PROOF}: features/converter/archives.ts`,
    probe: BINARY_WRITE_PROBE,
    lossiness: 'lossless',
    metadataKey: 'converter.metadata.preserved',
    disclosureKeys: ['converter.loss.none'],
    sandboxKey: 'converter.sandbox.renderer',
    validatorKey: 'converter.validator.crc'
  },
  {
    id: 'archives.sevenZip.inspect',
    category: 'archives',
    sourceFormats: ['sevenZip'],
    targetFormat: 'archiveReport',
    targetExtension: 'json',
    detailKey: 'converter.detail.archiveInspect',
    bundled: false,
    proof: '',
    unavailableKey: 'converter.reason.noReader',
    unavailableValues: { what: 'a 7z header and coder reader' },
    lossiness: 'inspection',
    metadataKey: 'converter.metadata.readOnly',
    disclosureKeys: ['converter.loss.none'],
    sandboxKey: 'converter.sandbox.renderer',
    validatorKey: 'converter.validator.json'
  },

  /* ---------------- Structured data ---------------- */
  recordAdapter('json', 'json', 'json'),
  recordAdapter('jsonl', 'jsonl', 'jsonl'),
  recordAdapter('yaml', 'yaml', 'yaml'),
  recordAdapter('toml', 'toml', 'toml'),
  recordAdapter('xml', 'xml', 'xml'),
  recordAdapter('csv', 'csv', 'csv'),
  recordAdapter('tsv', 'tsv', 'tsv'),
  recordAdapter('markdown', 'markdown', 'md'),
  recordAdapter('html', 'html', 'html'),
  recordAdapter('sql', 'sql', 'sql'),
  unavailableRecordSource('yaml', 'a YAML reader; the application bundles a YAML writer through its export service but no parser'),
  unavailableRecordSource('toml', 'a TOML reader'),
  unavailableRecordSource('xml', 'an XML-to-records reader'),
  unavailableRecordSource('xlsx', 'a spreadsheet workbook reader'),
  unavailableRecordSource('ods', 'an OpenDocument spreadsheet reader'),
  unavailableRecordSource('parquet', 'a Parquet column reader'),

  /* ---------------- Code and text ---------------- */
  {
    id: 'text.lineEndings',
    category: 'text',
    sourceFormats: ['text', 'markdown', 'html', 'json', 'jsonl', 'csv', 'tsv', 'yaml', 'toml', 'xml', 'svg', 'sql'],
    targetFormat: 'textLf',
    targetExtension: 'txt',
    detailKey: 'converter.detail.lineEndings',
    bundled: true,
    proof: `${RENDERER_PROOF}: features/converter/records.ts`,
    lossiness: 'lossless',
    metadataKey: 'converter.metadata.textOnly',
    disclosureKeys: ['converter.loss.lineEndings'],
    sandboxKey: 'converter.sandbox.renderer',
    validatorKey: 'converter.validator.lineEndings',
    options: [
      {
        id: 'ending',
        labelKey: 'converter.option.lineEnding',
        descriptionKey: 'converter.option.lineEnding.description',
        kind: 'select',
        choices: [
          { value: 'lf', label: 'converter.ending.lf' },
          { value: 'crlf', label: 'converter.ending.crlf' },
          { value: 'cr', label: 'converter.ending.cr' }
        ],
        defaultValue: 'lf'
      }
    ],
    async run(input, services) {
      const source = decodeText(input);
      const ending = (services.options.ending ?? 'lf') as 'lf' | 'crlf' | 'cr';
      const converted = convertLineEndings(source, ending);
      const expected = ending === 'lf' ? /\r/ : ending === 'cr' ? /\n/ : /(?<!\r)\n/;
      const checks = [
        check('terminator', 'every line uses the chosen terminator', expected.test(converted.text) ? 'a different terminator survived' : 'every line uses the chosen terminator'),
        check('line count', String(converted.change.lineCount), String(converted.text.split(ending === 'crlf' ? '\r\n' : ending === 'cr' ? '\r' : '\n').length))
      ];
      requireAllChecks(checks);
      return finish(
        converted.text,
        input.detection.extension.length > 0 ? input.detection.extension : 'txt',
        [
          `The source used ${converted.change.sourceEndings}.`,
          `${converted.change.lineCount} line(s), ${formatBytes(converted.change.bytesBefore)} in and ${formatBytes(converted.change.bytesAfter)} out.`,
          converted.change.hadBom ? 'The byte order mark was left exactly where it was.' : 'The source carried no byte order mark.'
        ],
        checks,
        services.limits
      );
    }
  },
  {
    id: 'text.indentation',
    category: 'text',
    sourceFormats: ['text', 'markdown', 'html', 'json', 'yaml', 'toml', 'xml', 'svg', 'sql'],
    targetFormat: 'textSpaces',
    targetExtension: 'txt',
    detailKey: 'converter.detail.indentation',
    bundled: true,
    proof: `${RENDERER_PROOF}: features/converter/records.ts`,
    lossiness: 'lossless',
    metadataKey: 'converter.metadata.textOnly',
    disclosureKeys: ['converter.loss.indentation'],
    sandboxKey: 'converter.sandbox.renderer',
    validatorKey: 'converter.validator.lineCount',
    options: [
      {
        id: 'target',
        labelKey: 'converter.option.indent',
        descriptionKey: 'converter.option.indent.description',
        kind: 'select',
        choices: [
          { value: 'spaces', label: 'converter.indent.spaces' },
          { value: 'tabs', label: 'converter.indent.tabs' }
        ],
        defaultValue: 'spaces'
      },
      {
        id: 'width',
        labelKey: 'converter.option.indentWidth',
        descriptionKey: 'converter.option.indentWidth.description',
        kind: 'number',
        min: 1,
        max: 16,
        defaultValue: '2'
      }
    ],
    async run(input, services) {
      const source = decodeText(input);
      const target = (services.options.target ?? 'spaces') as 'tabs' | 'spaces';
      const width = Math.max(1, Math.min(16, Number(services.options.width ?? '2') || 2));
      const converted = convertIndentation(source, target, width, services.deadline);
      const checks = [
        check('line count', String(converted.change.lineCount), String(converted.text.split(/\r\n|\r|\n/).length))
      ];
      requireAllChecks(checks);
      return finish(
        converted.text,
        input.detection.extension.length > 0 ? input.detection.extension : 'txt',
        [
          `${converted.convertedLines} of ${converted.change.lineCount} line(s) had their leading whitespace rewritten at a tab width of ${width}.`,
          'Only the whitespace at the start of a line was touched; a tab inside a line or inside a string is exactly where it was.'
        ],
        checks,
        services.limits
      );
    }
  },
  {
    id: 'text.bom',
    category: 'text',
    sourceFormats: ['text', 'markdown', 'html', 'json', 'jsonl', 'csv', 'tsv', 'yaml', 'toml', 'xml', 'svg', 'sql'],
    targetFormat: 'textBom',
    targetExtension: 'txt',
    detailKey: 'converter.detail.bom',
    bundled: true,
    proof: `${RENDERER_PROOF}: features/converter/records.ts`,
    lossiness: 'lossless',
    metadataKey: 'converter.metadata.textOnly',
    disclosureKeys: ['converter.loss.bom'],
    sandboxKey: 'converter.sandbox.renderer',
    validatorKey: 'converter.validator.bom',
    options: [
      {
        id: 'mode',
        labelKey: 'converter.option.bom',
        descriptionKey: 'converter.option.bom.description',
        kind: 'select',
        choices: [
          { value: 'add', label: 'converter.bom.add' },
          { value: 'remove', label: 'converter.bom.remove' }
        ],
        defaultValue: 'remove'
      }
    ],
    async run(input, services) {
      const source = decodeText(input);
      const add = (services.options.mode ?? 'remove') === 'add';
      const converted = convertBom(source, add);
      const checks = [
        check('byte order mark', add ? 'present' : 'absent', converted.text.startsWith('﻿') ? 'present' : 'absent')
      ];
      requireAllChecks(checks);
      return finish(
        converted.text,
        input.detection.extension.length > 0 ? input.detection.extension : 'txt',
        [
          converted.change.hadBom ? 'The source carried a byte order mark.' : 'The source carried no byte order mark.',
          `${formatBytes(converted.change.bytesBefore)} in, ${formatBytes(converted.change.bytesAfter)} out. Nothing else changed.`
        ],
        checks,
        services.limits
      );
    }
  },
  {
    id: 'text.json.reformat',
    category: 'text',
    sourceFormats: ['json'],
    targetFormat: 'jsonPretty',
    targetExtension: 'json',
    detailKey: 'converter.detail.jsonReformat',
    bundled: true,
    proof: `${RENDERER_PROOF}: features/converter/records.ts`,
    lossiness: 'lossy',
    metadataKey: 'converter.metadata.textOnly',
    disclosureKeys: ['converter.loss.keyOrder', 'converter.loss.precision'],
    sandboxKey: 'converter.sandbox.renderer',
    validatorKey: 'converter.validator.jsonEquivalent',
    options: [
      {
        id: 'style',
        labelKey: 'converter.option.jsonStyle',
        descriptionKey: 'converter.option.jsonStyle.description',
        kind: 'select',
        choices: [
          { value: 'pretty', label: 'converter.json.pretty' },
          { value: 'minified', label: 'converter.json.minified' }
        ],
        defaultValue: 'pretty'
      },
      {
        id: 'indent',
        labelKey: 'converter.option.jsonIndent',
        descriptionKey: 'converter.option.jsonIndent.description',
        kind: 'number',
        min: 0,
        max: 8,
        defaultValue: '2'
      }
    ],
    async run(input, services) {
      const source = decodeText(input);
      const pretty = (services.options.style ?? 'pretty') === 'pretty';
      const indent = Math.max(0, Math.min(8, Number(services.options.indent ?? '2') || 2));
      const converted = reformatJson(source, pretty, indent);
      const before = JSON.stringify(JSON.parse(source));
      const after = JSON.stringify(JSON.parse(converted.text));
      const checks = [check('value equivalence', before === after ? 'the values are identical' : 'the values differ', before === after ? 'the values are identical' : 'the values differ')];
      requireAllChecks(checks);
      return finish(
        converted.text,
        'json',
        [
          `${converted.keys} key(s) were re-serialized ${pretty ? `with a ${indent}-space indent` : 'with every optional space removed'}.`,
          'Numbers are re-emitted through the runtime’s own formatter, so a value written with trailing zeros comes back in its shortest form.'
        ],
        checks,
        services.limits
      );
    }
  },
  {
    id: 'text.markdown.html',
    category: 'text',
    sourceFormats: ['markdown'],
    targetFormat: 'html',
    targetExtension: 'html',
    detailKey: 'converter.detail.markdownHtml',
    bundled: true,
    proof: `${RENDERER_PROOF}: core/markdown.ts`,
    lossiness: 'lossy',
    metadataKey: 'converter.metadata.textOnly',
    disclosureKeys: ['converter.loss.markdownExtensions', 'converter.loss.remoteAssets'],
    sandboxKey: 'converter.sandbox.renderer',
    validatorKey: 'converter.validator.html',
    async run(input, services) {
      const source = decodeText(input);
      const fragment = renderMarkdown(source, {});
      const holder = document.createElement('div');
      holder.append(fragment);
      const body = holder.innerHTML;
      const text = [
        '<!DOCTYPE html>',
        '<html lang="en">',
        '<head>',
        '<meta charset="utf-8">',
        '<title>Converted document</title>',
        '</head>',
        '<body>',
        body,
        '</body>',
        '</html>',
        ''
      ].join('\n');
      const parsed = new DOMParser().parseFromString(text, 'text/html');
      const remote = [...parsed.querySelectorAll('img, script, link')].filter((node) => {
        const url = node.getAttribute('src') ?? node.getAttribute('href') ?? '';
        return /^https?:/i.test(url);
      });
      const checks = [
        check('parses as HTML', 'yes', parsed.body ? 'yes' : 'no'),
        check('no remote asset', '0', String(remote.length))
      ];
      requireAllChecks(checks);
      return finish(
        text,
        'html',
        [
          `${source.split(/\r?\n/).length} source line(s) were rendered through the application’s own Markdown renderer.`,
          'Anything the renderer does not implement is rendered as its literal text rather than being dropped.'
        ],
        checks,
        services.limits
      );
    }
  },
  {
    id: 'text.encoding.latin1',
    category: 'text',
    sourceFormats: ['text', 'markdown', 'html', 'json', 'csv'],
    targetFormat: 'latin1',
    targetExtension: 'txt',
    detailKey: 'converter.detail.encoding',
    bundled: true,
    proof: `${RENDERER_PROOF}: features/converter/bytes.ts`,
    probe: BINARY_WRITE_PROBE,
    lossiness: 'lossy',
    metadataKey: 'converter.metadata.textOnly',
    disclosureKeys: ['converter.loss.encoding'],
    sandboxKey: 'converter.sandbox.renderer',
    validatorKey: 'converter.validator.roundTrip'
  },
  {
    id: 'text.encoding.utf16',
    category: 'text',
    sourceFormats: ['text', 'markdown', 'html', 'json', 'csv'],
    targetFormat: 'utf16',
    targetExtension: 'txt',
    detailKey: 'converter.detail.encoding',
    bundled: true,
    proof: `${RENDERER_PROOF}: features/converter/bytes.ts`,
    probe: BINARY_WRITE_PROBE,
    lossiness: 'lossless',
    metadataKey: 'converter.metadata.textOnly',
    disclosureKeys: ['converter.loss.encoding'],
    sandboxKey: 'converter.sandbox.renderer',
    validatorKey: 'converter.validator.roundTrip'
  },

  /* ---------------- Binary encodings ---------------- */
  {
    id: 'encodings.base64',
    category: 'encodings',
    sourceFormats: [],
    targetFormat: 'base64',
    targetExtension: 'base64',
    detailKey: 'converter.detail.encode',
    bundled: true,
    proof: `${RENDERER_PROOF}: features/converter/bytes.ts`,
    lossiness: 'lossless',
    metadataKey: 'converter.metadata.bytesOnly',
    disclosureKeys: ['converter.loss.sizeGrowth'],
    sandboxKey: 'converter.sandbox.renderer',
    validatorKey: 'converter.validator.roundTrip',
    options: [
      {
        id: 'width',
        labelKey: 'converter.option.wrapWidth',
        descriptionKey: 'converter.option.wrapWidth.description',
        kind: 'number',
        min: 0,
        max: 512,
        defaultValue: '76'
      }
    ],
    async run(input, services) {
      const width = Math.max(0, Math.min(512, Number(services.options.width ?? '76') || 0));
      const text = `${bytesToBase64Wrapped(input.bytes, width)}\n`;
      const back = base64ToBytes(text);
      const checks = [
        check('round trip length', String(input.bytes.length), String(back.length)),
        check('round trip digest', sha256Hex(input.bytes), sha256Hex(back))
      ];
      requireAllChecks(checks);
      return finish(
        text,
        'base64',
        [
          `${formatBytes(input.bytes.length)} became ${formatBytes(utf8ToBytes(text).length)} of base64.`,
          'The result was decoded again and compared against the source by SHA-256 before it was offered.'
        ],
        checks,
        services.limits
      );
    }
  },
  {
    id: 'encodings.base32',
    category: 'encodings',
    sourceFormats: [],
    targetFormat: 'base32',
    targetExtension: 'base32',
    detailKey: 'converter.detail.encode',
    bundled: true,
    proof: `${RENDERER_PROOF}: features/converter/bytes.ts`,
    lossiness: 'lossless',
    metadataKey: 'converter.metadata.bytesOnly',
    disclosureKeys: ['converter.loss.sizeGrowth'],
    sandboxKey: 'converter.sandbox.renderer',
    validatorKey: 'converter.validator.length',
    async run(input, services) {
      const text = `${bytesToBase32(input.bytes)}\n`;
      const expectedLength = Math.ceil(input.bytes.length / 5) * 8;
      const checks = [check('encoded length', String(expectedLength), String(text.trim().length))];
      requireAllChecks(checks);
      return finish(
        text,
        'base32',
        [`${formatBytes(input.bytes.length)} became ${expectedLength} base32 characters (RFC 4648, padded).`],
        checks,
        services.limits
      );
    }
  },
  {
    id: 'encodings.hex',
    category: 'encodings',
    sourceFormats: [],
    targetFormat: 'hex',
    targetExtension: 'hex',
    detailKey: 'converter.detail.encode',
    bundled: true,
    proof: `${RENDERER_PROOF}: features/converter/bytes.ts`,
    lossiness: 'lossless',
    metadataKey: 'converter.metadata.bytesOnly',
    disclosureKeys: ['converter.loss.sizeGrowth'],
    sandboxKey: 'converter.sandbox.renderer',
    validatorKey: 'converter.validator.roundTrip',
    options: [
      {
        id: 'width',
        labelKey: 'converter.option.bytesPerLine',
        descriptionKey: 'converter.option.bytesPerLine.description',
        kind: 'number',
        min: 0,
        max: 256,
        defaultValue: '16'
      },
      {
        id: 'separator',
        labelKey: 'converter.option.hexSeparator',
        descriptionKey: 'converter.option.hexSeparator.description',
        kind: 'select',
        choices: [
          { value: 'none', label: 'converter.separator.none' },
          { value: 'space', label: 'converter.separator.space' }
        ],
        defaultValue: 'space'
      }
    ],
    async run(input, services) {
      const width = Math.max(0, Math.min(256, Number(services.options.width ?? '16') || 0));
      const separator = (services.options.separator ?? 'space') === 'space' ? ' ' : '';
      const text = `${bytesToHex(input.bytes, { width, separator })}\n`;
      const digits = text.replace(/[^0-9a-f]/g, '');
      const back = new Uint8Array(digits.length / 2);
      for (let index = 0; index < back.length; index += 1) {
        back[index] = Number.parseInt(digits.slice(index * 2, index * 2 + 2), 16);
      }
      const checks = [
        check('round trip length', String(input.bytes.length), String(back.length)),
        check('round trip digest', sha256Hex(input.bytes), sha256Hex(back))
      ];
      requireAllChecks(checks);
      return finish(text, 'hex', [`${formatBytes(input.bytes.length)} written as ${digits.length} hexadecimal digits.`], checks, services.limits);
    }
  },
  {
    id: 'encodings.dataUri',
    category: 'encodings',
    sourceFormats: [],
    targetFormat: 'dataUri',
    targetExtension: 'txt',
    detailKey: 'converter.detail.dataUri',
    bundled: true,
    proof: `${RENDERER_PROOF}: features/converter/bytes.ts`,
    lossiness: 'lossless',
    metadataKey: 'converter.metadata.bytesOnly',
    disclosureKeys: ['converter.loss.sizeGrowth'],
    sandboxKey: 'converter.sandbox.renderer',
    validatorKey: 'converter.validator.roundTrip',
    async run(input, services) {
      const mime = mimeTypeFor(input.detection.formatId ?? '');
      const encoded = bytesToBase64(input.bytes);
      const text = `data:${mime};base64,${encoded}\n`;
      const back = base64ToBytes(encoded);
      const checks = [check('round trip digest', sha256Hex(input.bytes), sha256Hex(back))];
      requireAllChecks(checks);
      return finish(
        text,
        'txt',
        [`A single data URI declaring ${mime}, ${formatBytes(utf8ToBytes(text).length)} long.`],
        checks,
        services.limits
      );
    }
  },
  {
    id: 'encodings.quotedPrintable',
    category: 'encodings',
    sourceFormats: ['text', 'markdown', 'html', 'json', 'csv'],
    targetFormat: 'quotedPrintable',
    targetExtension: 'qp',
    detailKey: 'converter.detail.encode',
    bundled: true,
    proof: `${RENDERER_PROOF}: features/converter/adapters.ts`,
    lossiness: 'lossless',
    metadataKey: 'converter.metadata.bytesOnly',
    disclosureKeys: ['converter.loss.softLineBreaks'],
    sandboxKey: 'converter.sandbox.renderer',
    validatorKey: 'converter.validator.roundTrip',
    async run(input, services) {
      const text = encodeQuotedPrintable(input.bytes, services.deadline);
      const back = decodeQuotedPrintable(text);
      const checks = [check('round trip digest', sha256Hex(input.bytes), sha256Hex(back))];
      requireAllChecks(checks);
      return finish(
        text,
        'qp',
        ['Bytes outside the printable set became =XX escapes and every line was kept at or below 76 characters with soft breaks.'],
        checks,
        services.limits
      );
    }
  },
  {
    id: 'encodings.uuencode',
    category: 'encodings',
    sourceFormats: [],
    targetFormat: 'uuencode',
    targetExtension: 'uu',
    detailKey: 'converter.detail.encode',
    bundled: true,
    proof: `${RENDERER_PROOF}: features/converter/adapters.ts`,
    lossiness: 'lossless',
    metadataKey: 'converter.metadata.bytesOnly',
    disclosureKeys: ['converter.loss.sizeGrowth'],
    sandboxKey: 'converter.sandbox.renderer',
    validatorKey: 'converter.validator.roundTrip',
    async run(input, services) {
      const name = input.path.replace(/\\/g, '/').split('/').pop() ?? 'file';
      const text = encodeUu(input.bytes, name, services.deadline);
      const back = decodeUu(text);
      const checks = [check('round trip digest', sha256Hex(input.bytes), sha256Hex(back))];
      requireAllChecks(checks);
      return finish(text, 'uu', [`Written as a classic uuencode stream naming "${name}".`], checks, services.limits);
    }
  },
  {
    id: 'encodings.decode',
    category: 'encodings',
    sourceFormats: ['base64', 'hex', 'base32', 'dataUri'],
    targetFormat: 'binary',
    targetExtension: 'bin',
    detailKey: 'converter.detail.decode',
    bundled: true,
    proof: `${RENDERER_PROOF}: features/converter/bytes.ts`,
    probe: BINARY_WRITE_PROBE,
    lossiness: 'lossless',
    metadataKey: 'converter.metadata.bytesOnly',
    disclosureKeys: ['converter.loss.none'],
    sandboxKey: 'converter.sandbox.renderer',
    validatorKey: 'converter.validator.roundTrip'
  }
];

/* ------------------------------------------------------------------ */
/* Route implementations shared by several adapters                    */
/* ------------------------------------------------------------------ */

/**
 * Parses a page expression such as `1-3,7,10-` into concrete page numbers.
 *
 * The expression is the user's own text, so the parse is strict and reports the
 * exact fragment it could not read rather than silently dropping it.
 */
export function parsePageRange(expression: string, pageCount: number): number[] {
  const out: number[] = [];
  const trimmed = expression.trim();
  if (trimmed.length === 0) {
    throw new ConverterBoundary('unsupported', 'No page range was given, so there is nothing to select.');
  }
  for (const partRaw of trimmed.split(',')) {
    const part = partRaw.trim();
    if (part.length === 0) continue;
    const range = /^(\d*)\s*-\s*(\d*)$/.exec(part);
    if (range) {
      const from = range[1].length > 0 ? Number(range[1]) : 1;
      const to = range[2].length > 0 ? Number(range[2]) : pageCount;
      if (from < 1 || to > pageCount || from > to) {
        throw new ConverterBoundary('unsupported', `"${part}" is not a usable range for a ${pageCount}-page document.`);
      }
      for (let page = from; page <= to; page += 1) out.push(page);
      continue;
    }
    const single = Number(part);
    if (!Number.isInteger(single) || single < 1 || single > pageCount) {
      throw new ConverterBoundary('unsupported', `"${part}" is not a page number in a ${pageCount}-page document.`);
    }
    out.push(single);
  }
  if (out.length === 0) {
    throw new ConverterBoundary('unsupported', 'The page expression selected no pages, so there is nothing to write.');
  }
  return out;
}

async function runPdfRewrite(
  input: AdapterInput,
  services: RunServices,
  pageExpression: string,
  rotateOption: string,
  info: Record<string, string>
): Promise<AdapterOutput> {
  const doc = await PdfDocument.open(input.bytes, services.limits, services.deadline);
  const report = await doc.inspect();
  if (report.encrypted) {
    throw new ConverterBoundary(
      'encrypted',
      'The document is encrypted. This build cannot supply a password to it, so nothing was read beyond the trailer and nothing was written.'
    );
  }

  const pages = parsePageRange(pageExpression, report.pageCount);
  const selection: PageSelection[] = pages.map((page) => ({
    page,
    rotation: rotateOption === 'keep' ? report.pages[page - 1].rotation : normaliseRotation(Number(rotateOption) || 0)
  }));

  const built = await buildDocument(
    doc,
    { selection, info, producer: services.producer },
    services.limits,
    services.deadline
  );

  const bytes = utf8ToBytes(built.text);
  const expectation = {
    pageCount: selection.length,
    rotations: selection.map((entry) => normaliseRotation(entry.rotation)),
    sizes: selection.map((entry) => {
      const source = report.pages[entry.page - 1];
      const swap = normaliseRotation(entry.rotation) === 90 || normaliseRotation(entry.rotation) === 270;
      const sourceSwapped = source.rotation === 90 || source.rotation === 270;
      const width = sourceSwapped ? source.heightPt : source.widthPt;
      const height = sourceSwapped ? source.widthPt : source.heightPt;
      return swap ? `${Math.round(height)}x${Math.round(width)}` : `${Math.round(width)}x${Math.round(height)}`;
    }),
    info
  };

  const outcome = await validateWritten(bytes, expectation, services.limits, services.deadline);
  if (!outcome.ok) {
    throw new ConverterBoundary(
      'validation',
      `The written document was reopened and did not match the request — ${outcome.failure ?? 'a check failed'}. Nothing was kept.`
    );
  }

  const notes = [
    `${selection.length} page(s) written in the order ${pages.join(', ')}.`,
    `The result is ${formatBytes(built.byteLength)}; the source was ${formatBytes(input.bytes.length)}.`,
    'Every stream was re-encoded with ASCIIHexDecode so the file is pure ASCII and survives a UTF-8 write unchanged.',
    report.signed
      ? 'The source carries a digital signature. The rewritten document does not, and that signature will not validate against it.'
      : 'The source carries no digital signature.',
    report.hasAcroForm || report.hasOutlines || report.hasStructTree
      ? 'Form fields, outlines and the structure tree are not carried across by this rewrite.'
      : 'The source carried no form, outline or structure tree to lose.',
    `SHA-256 of the result: ${built.sha256}`
  ];

  return {
    text: built.text,
    extension: 'pdf',
    notes,
    checks: outcome.checks,
    byteLength: built.byteLength,
    sha256: built.sha256
  };
}

async function runOfficeText(
  input: AdapterInput,
  services: RunServices,
  memberName: string,
  paragraphTag: string,
  runTag: string
): Promise<AdapterOutput> {
  const inventory = readZipInventory(input.bytes, services.limits, services.deadline);
  const entry = inventory.entries.find((candidate) => candidate.path === memberName);
  if (!entry) {
    throw new ConverterBoundary(
      'malformed',
      `The container holds no "${memberName}" member, so this is not a document this route can read.`
    );
  }
  const data = await readZipMember(input.bytes, entry, services.limits, services.deadline);
  const xml = bytesToUtf8Lossy(data);
  const parsed = new DOMParser().parseFromString(xml, 'application/xml');
  if (parsed.querySelector('parsererror')) {
    throw new ConverterBoundary('malformed', `The "${memberName}" member did not parse as XML, so no text was extracted.`);
  }

  const paragraphs: string[] = [];
  const nodes = parsed.getElementsByTagName(paragraphTag);
  for (let index = 0; index < nodes.length; index += 1) {
    if ((index & 0xff) === 0) services.deadline.check();
    if (index >= services.limits.entries) {
      throw new ConverterBoundary(
        'entries',
        `The document holds more than ${services.limits.entries} paragraphs, past the bound. Nothing was written.`
      );
    }
    const paragraph = nodes.item(index);
    if (!paragraph) continue;
    if (runTag.length > 0) {
      const runs = paragraph.getElementsByTagName(runTag);
      let line = '';
      for (let run = 0; run < runs.length; run += 1) line += runs.item(run)?.textContent ?? '';
      paragraphs.push(line);
    } else {
      paragraphs.push(paragraph.textContent ?? '');
    }
  }

  const text = `${paragraphs.join('\n')}\n`;
  const checks = [check('paragraph count', String(paragraphs.length), String(text.split('\n').length - 1))];
  requireAllChecks(checks);
  return finish(
    text,
    'txt',
    [
      `${paragraphs.length} paragraph(s) were read from "${memberName}".`,
      'Styling, tables, images, headers, footers, footnotes and comments are not carried into plain text.'
    ],
    checks,
    services.limits
  );
}

function decodeMemberText(data: Uint8Array, entry: ArchiveEntry): string {
  try {
    return bytesToUtf8Strict(data);
  } catch {
    throw new ConverterBoundary(
      'unsupported',
      `"${entry.path}" is not valid UTF-8 text, and this build has no channel for writing arbitrary bytes. Nothing was written.`
    );
  }
}

function validateNetpbm(text: string, magic: string, width: number, height: number, samplesPerPixel: number): ValidationCheck[] {
  const withoutComments = text
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('#'))
    .join('\n');
  const tokens = withoutComments.trim().split(/\s+/);
  const sampleCount = tokens.length - 4;
  return [
    check('magic number', magic, tokens[0] ?? ''),
    check('declared size', `${width} ${height}`, `${tokens[1] ?? ''} ${tokens[2] ?? ''}`),
    check('sample count', String(width * height * samplesPerPixel), String(sampleCount))
  ];
}

function encodeQuotedPrintable(bytes: Uint8Array, deadline: Deadline): string {
  const out: string[] = [];
  let line = '';
  const flush = (soft: boolean): void => {
    out.push(soft ? `${line}=` : line);
    line = '';
  };
  for (let index = 0; index < bytes.length; index += 1) {
    if ((index & 0xffff) === 0) deadline.check();
    const byte = bytes[index];
    if (byte === 0x0a) {
      flush(false);
      continue;
    }
    const piece =
      byte === 0x3d || byte < 32 || byte > 126
        ? `=${byte.toString(16).toUpperCase().padStart(2, '0')}`
        : String.fromCharCode(byte);
    if (line.length + piece.length > 75) flush(true);
    line += piece;
  }
  if (line.length > 0) flush(false);
  return `${out.join('\n')}\n`;
}

function decodeQuotedPrintable(text: string): Uint8Array {
  const out: number[] = [];
  const lines = text.split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    let line = lines[index];
    const soft = line.endsWith('=');
    if (soft) line = line.slice(0, -1);
    let cursor = 0;
    while (cursor < line.length) {
      if (line[cursor] === '=' && cursor + 2 < line.length + 1) {
        out.push(Number.parseInt(line.slice(cursor + 1, cursor + 3), 16));
        cursor += 3;
        continue;
      }
      out.push(line.charCodeAt(cursor) & 0xff);
      cursor += 1;
    }
    if (!soft && index < lines.length - 1) out.push(0x0a);
  }
  // The encoder appends a final newline that was not in the source.
  if (out[out.length - 1] === 0x0a) out.pop();
  return Uint8Array.from(out);
}

function encodeUu(bytes: Uint8Array, fileName: string, deadline: Deadline): string {
  const lines: string[] = [`begin 644 ${fileName.replace(/[^\w.\-]/g, '_')}`];
  for (let offset = 0; offset < bytes.length; offset += 45) {
    deadline.check();
    const chunk = bytes.subarray(offset, offset + 45);
    let line = String.fromCharCode(chunk.length === 0 ? 0x60 : chunk.length + 32);
    for (let index = 0; index < chunk.length; index += 3) {
      const a = chunk[index] ?? 0;
      const b = chunk[index + 1] ?? 0;
      const c = chunk[index + 2] ?? 0;
      const values = [a >> 2, ((a & 3) << 4) | (b >> 4), ((b & 15) << 2) | (c >> 6), c & 63];
      for (const value of values) line += String.fromCharCode(value === 0 ? 0x60 : value + 32);
    }
    lines.push(line);
  }
  lines.push('`', 'end', '');
  return lines.join('\n');
}

function decodeUu(text: string): Uint8Array {
  const out: number[] = [];
  const lines = text.split('\n');
  for (const line of lines) {
    if (line.startsWith('begin ') || line === 'end' || line.length === 0 || line === '`') continue;
    const length = (line.charCodeAt(0) - 32) & 63;
    if (length === 0) continue;
    const decoded: number[] = [];
    for (let index = 1; index + 3 < line.length + 1; index += 4) {
      const values = [0, 1, 2, 3].map((offset) => ((line.charCodeAt(index + offset) || 0x60) - 32) & 63);
      decoded.push(
        (values[0] << 2) | (values[1] >> 4),
        ((values[1] & 15) << 4) | (values[2] >> 2),
        ((values[2] & 3) << 6) | values[3]
      );
    }
    out.push(...decoded.slice(0, length));
  }
  return Uint8Array.from(out);
}

/* ------------------------------------------------------------------ */
/* Lookups                                                             */
/* ------------------------------------------------------------------ */

const ADAPTER_INDEX = new Map(ADAPTERS.map((adapter) => [adapter.id, adapter]));

export function adapterById(id: string): AdapterSpec | null {
  return ADAPTER_INDEX.get(id) ?? null;
}

/** Every adapter in one category, in declaration order. */
export function adaptersInCategory(category: CategoryId): AdapterSpec[] {
  return ADAPTERS.filter((adapter) => adapter.category === category);
}

/**
 * Routes that accept a given source format.
 *
 * An adapter with an empty `sourceFormats` accepts anything, which is how the
 * byte-encoding routes work: they read bytes and never care what the bytes are.
 */
export function adaptersForSource(formatId: string | null): AdapterSpec[] {
  return ADAPTERS.filter(
    (adapter) => adapter.sourceFormats.length === 0 || (formatId !== null && adapter.sourceFormats.includes(formatId))
  );
}

/** A short factual route label, e.g. `PDF → JSON report`. Names are not restyled. */
export function routeLabel(adapter: AdapterSpec, resolve: (key: string, fallback: string) => string): string {
  const sources =
    adapter.sourceFormats.length === 0
      ? resolve('converter.format.any', 'Any file')
      : adapter.sourceFormats
          .slice(0, 3)
          .map((id) => resolve(formatById(id)?.labelKey ?? id, id))
          .join(', ') + (adapter.sourceFormats.length > 3 ? '…' : '');
  const target = resolve(formatById(adapter.targetFormat)?.labelKey ?? adapter.targetFormat, adapter.targetFormat);
  return `${sources} → ${target}`;
}

/** Every adapter, as flat records suitable for an export. */
export function adapterRecords(resolve: (key: string, fallback: string) => string): Array<Record<string, unknown>> {
  return ADAPTERS.map((adapter) => {
    const availability = availabilityOf(adapter);
    return {
      id: adapter.id,
      category: adapter.category,
      route: routeLabel(adapter, resolve),
      sourceFormats: adapter.sourceFormats.join(' ') || '(any)',
      targetFormat: adapter.targetFormat,
      targetExtension: adapter.targetExtension,
      bundled: adapter.bundled,
      packagedProof: adapter.proof || '(not bundled)',
      available: availability.available,
      unavailableReason: availability.available ? '' : resolve(availability.reasonKey, availability.reasonKey),
      lossiness: adapter.lossiness,
      metadataBehaviour: resolve(adapter.metadataKey, adapter.metadataKey),
      sandbox: resolve(adapter.sandboxKey, adapter.sandboxKey),
      outputValidator: resolve(adapter.validatorKey, adapter.validatorKey),
      multiFile: adapter.multiFile ?? ''
    };
  });
}
