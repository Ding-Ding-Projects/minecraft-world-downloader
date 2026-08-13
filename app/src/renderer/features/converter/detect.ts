/**
 * Type detection from a bounded read of the file's own bytes.
 *
 * The extension is a claim the file makes about itself; the signature is what
 * it actually is. Detection reads a bounded head — four kilobytes by default —
 * and, for the container formats whose index lives at the end, a bounded tail.
 * The result carries both answers so the surface can say plainly when they
 * disagree, which is exactly the case where converting on the extension alone
 * would produce mislabeled output.
 */

import { ascii, bytesToUtf8Strict, indexOfBytes, startsWith } from './bytes';
import { extensionOf, formatById, formatsForExtension } from './formats';

export type DetectionConfidence = 'signature' | 'structure' | 'extension' | 'unknown';

export interface Detection {
  /** The format id the bytes say this is, or null when nothing matched. */
  formatId: string | null;
  confidence: DetectionConfidence;
  /** Byte offset at which the matching signature was found. */
  signatureOffset: number;
  /** Human-readable description of what matched, e.g. "%PDF- at offset 0". */
  evidence: string;
  /** The format the extension claims, when the extension is one we know. */
  claimedFormatId: string | null;
  extension: string;
  /** True when the extension names a format the bytes contradict. */
  mismatch: boolean;
  /** True when the head decoded as valid UTF-8 text. */
  looksTextual: boolean;
  /** Bytes actually inspected. */
  inspectedBytes: number;
}

interface SignatureRule {
  formatId: string;
  bytes: number[];
  offset: number;
  /** A second constraint checked after the leading bytes match. */
  extra?(head: Uint8Array): boolean;
  label: string;
}

const RULES: SignatureRule[] = [
  { formatId: 'pdf', bytes: ascii('%PDF-'), offset: 0, label: '%PDF- at offset 0' },
  { formatId: 'png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], offset: 0, label: 'PNG signature at offset 0' },
  { formatId: 'jpeg', bytes: [0xff, 0xd8, 0xff], offset: 0, label: 'JPEG start-of-image at offset 0' },
  { formatId: 'gif', bytes: ascii('GIF87a'), offset: 0, label: 'GIF87a at offset 0' },
  { formatId: 'gif', bytes: ascii('GIF89a'), offset: 0, label: 'GIF89a at offset 0' },
  {
    formatId: 'webp',
    bytes: ascii('RIFF'),
    offset: 0,
    extra: (head) => startsWith(head, ascii('WEBP'), 8),
    label: 'RIFF container with a WEBP form type'
  },
  {
    formatId: 'wav',
    bytes: ascii('RIFF'),
    offset: 0,
    extra: (head) => startsWith(head, ascii('WAVE'), 8),
    label: 'RIFF container with a WAVE form type'
  },
  { formatId: 'bmp', bytes: ascii('BM'), offset: 0, label: 'BM at offset 0' },
  { formatId: 'tiff', bytes: [0x49, 0x49, 0x2a, 0x00], offset: 0, label: 'little-endian TIFF header' },
  { formatId: 'tiff', bytes: [0x4d, 0x4d, 0x00, 0x2a], offset: 0, label: 'big-endian TIFF header' },
  { formatId: 'ico', bytes: [0x00, 0x00, 0x01, 0x00], offset: 0, label: 'Windows icon directory at offset 0' },
  { formatId: 'flac', bytes: ascii('fLaC'), offset: 0, label: 'fLaC at offset 0' },
  { formatId: 'ogg', bytes: ascii('OggS'), offset: 0, label: 'OggS at offset 0' },
  { formatId: 'mp3', bytes: ascii('ID3'), offset: 0, label: 'ID3 tag at offset 0' },
  { formatId: 'mp4', bytes: ascii('ftyp'), offset: 4, label: 'ftyp box at offset 4' },
  { formatId: 'webm', bytes: [0x1a, 0x45, 0xdf, 0xa3], offset: 0, label: 'EBML header at offset 0' },
  { formatId: 'avi', bytes: ascii('RIFF'), offset: 0, extra: (head) => startsWith(head, ascii('AVI '), 8), label: 'RIFF container with an AVI form type' },
  { formatId: 'gzip', bytes: [0x1f, 0x8b], offset: 0, label: 'gzip member header at offset 0' },
  { formatId: 'sevenZip', bytes: [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c], offset: 0, label: '7z signature at offset 0' },
  { formatId: 'zip', bytes: [0x50, 0x4b, 0x03, 0x04], offset: 0, label: 'ZIP local file header at offset 0' },
  { formatId: 'zip', bytes: [0x50, 0x4b, 0x05, 0x06], offset: 0, label: 'empty ZIP end-of-central-directory at offset 0' },
  { formatId: 'rtf', bytes: ascii('{\\rtf'), offset: 0, label: '{\\rtf at offset 0' }
];

/** ZIP-based container formats, told apart by a member name inside the archive. */
const ZIP_MEMBER_RULES: Array<{ formatId: string; needle: number[]; label: string }> = [
  { formatId: 'docx', needle: ascii('word/document.xml'), label: 'a ZIP archive containing word/document.xml' },
  { formatId: 'xlsx', needle: ascii('xl/workbook.xml'), label: 'a ZIP archive containing xl/workbook.xml' },
  { formatId: 'odt', needle: ascii('opendocument.text'), label: 'a ZIP archive declaring the OpenDocument text media type' },
  { formatId: 'ods', needle: ascii('opendocument.spreadsheet'), label: 'a ZIP archive declaring the OpenDocument spreadsheet media type' },
  { formatId: 'epub', needle: ascii('application/epub+zip'), label: 'a ZIP archive declaring the EPUB media type' }
];

/** The tar header carries its magic at offset 257, which is past most head reads. */
const TAR_MAGIC_OFFSET = 257;

function looksLikeTar(head: Uint8Array): boolean {
  if (head.length < TAR_MAGIC_OFFSET + 5) return false;
  return startsWith(head, ascii('ustar'), TAR_MAGIC_OFFSET);
}

function looksLikeSvg(text: string): boolean {
  const head = text.slice(0, 2048).toLowerCase();
  return head.includes('<svg') && (head.startsWith('<?xml') || head.trimStart().startsWith('<'));
}

function looksLikeJson(text: string): boolean {
  const trimmed = text.trimStart();
  if (trimmed.length === 0) return false;
  const first = trimmed[0];
  if (first !== '{' && first !== '[') return false;
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

function looksLikeJsonLines(text: string): boolean {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return false;
  let parsed = 0;
  for (const line of lines.slice(0, 20)) {
    try {
      JSON.parse(line);
      parsed += 1;
    } catch {
      return false;
    }
  }
  return parsed >= 2;
}

function delimiterProfile(text: string, delimiter: string): boolean {
  const lines = text.split(/\r?\n/).filter((line) => line.length > 0).slice(0, 12);
  if (lines.length < 2) return false;
  const counts = lines.map((line) => line.split(delimiter).length - 1);
  if (counts[0] < 1) return false;
  return counts.every((count) => count === counts[0]);
}

/**
 * Detects a file's real type from bytes it has already read.
 *
 * `head` is the bounded leading read; `tail` is an optional bounded trailing
 * read used only for the container formats that keep their index at the end.
 * Nothing here reads from disk itself, so the caller keeps full control of how
 * many bytes were spent.
 */
export function detectFromBytes(path: string, head: Uint8Array, tail?: Uint8Array): Detection {
  const extension = extensionOf(path);
  const claimed = formatsForExtension(extension)[0]?.id ?? null;

  let text: string | null = null;
  try {
    text = bytesToUtf8Strict(head.subarray(0, Math.min(head.length, 65_536)));
  } catch {
    text = null;
  }
  const looksTextual = text !== null && isAsciiTextish(head);

  for (const rule of RULES) {
    if (!startsWith(head, rule.bytes, rule.offset)) continue;
    if (rule.extra && !rule.extra(head)) continue;
    let formatId = rule.formatId;
    let label = rule.label;
    if (formatId === 'zip') {
      const container = detectZipContainer(head, tail);
      if (container) {
        formatId = container.formatId;
        label = container.label;
      }
    }
    return finish(formatId, 'signature', rule.offset, label, claimed, extension, looksTextual, head.length);
  }

  if (looksLikeTar(head)) {
    return finish('tar', 'signature', TAR_MAGIC_OFFSET, 'ustar magic at offset 257', claimed, extension, looksTextual, head.length);
  }

  if (text !== null) {
    if (looksLikeSvg(text)) {
      return finish('svg', 'structure', 0, 'an XML document whose root element is <svg>', claimed, extension, true, head.length);
    }
    if (looksLikeJson(text)) {
      return finish('json', 'structure', 0, 'the whole head parsed as one JSON document', claimed, extension, true, head.length);
    }
    if (looksLikeJsonLines(text)) {
      return finish('jsonl', 'structure', 0, 'every non-empty line parsed as its own JSON document', claimed, extension, true, head.length);
    }
    if (delimiterProfile(text, '\t')) {
      return finish('tsv', 'structure', 0, 'every sampled line carried the same number of tab separators', claimed, extension, true, head.length);
    }
    if (delimiterProfile(text, ',')) {
      return finish('csv', 'structure', 0, 'every sampled line carried the same number of comma separators', claimed, extension, true, head.length);
    }
    if (extension === 'md' || extension === 'markdown') {
      return finish('markdown', 'extension', 0, 'plain text whose name claims Markdown', claimed, extension, true, head.length);
    }
    if (extension === 'html' || extension === 'htm') {
      return finish('html', 'extension', 0, 'plain text whose name claims HTML', claimed, extension, true, head.length);
    }
    if (extension === 'yaml' || extension === 'yml') {
      return finish('yaml', 'extension', 0, 'plain text whose name claims YAML', claimed, extension, true, head.length);
    }
    if (extension === 'toml') {
      return finish('toml', 'extension', 0, 'plain text whose name claims TOML', claimed, extension, true, head.length);
    }
    if (extension === 'xml') {
      return finish('xml', 'extension', 0, 'plain text whose name claims XML', claimed, extension, true, head.length);
    }
    return finish('text', 'structure', 0, 'the whole head decoded as valid UTF-8 text', claimed, extension, true, head.length);
  }

  return finish(null, 'unknown', 0, 'no known signature matched and the head is not valid UTF-8 text', claimed, extension, false, head.length);
}

function isAsciiTextish(head: Uint8Array): boolean {
  // A file carrying a NUL in its first kilobyte is not text, whatever the rest
  // of it happens to decode as.
  const limit = Math.min(head.length, 1024);
  for (let index = 0; index < limit; index += 1) {
    if (head[index] === 0) return false;
  }
  return true;
}

function detectZipContainer(head: Uint8Array, tail?: Uint8Array): { formatId: string; label: string } | null {
  for (const rule of ZIP_MEMBER_RULES) {
    if (indexOfBytes(head, rule.needle) >= 0) return { formatId: rule.formatId, label: rule.label };
    if (tail && indexOfBytes(tail, rule.needle) >= 0) return { formatId: rule.formatId, label: rule.label };
  }
  return null;
}

function finish(
  formatId: string | null,
  confidence: DetectionConfidence,
  signatureOffset: number,
  evidence: string,
  claimedFormatId: string | null,
  extension: string,
  looksTextual: boolean,
  inspectedBytes: number
): Detection {
  const mismatch =
    formatId !== null &&
    claimedFormatId !== null &&
    claimedFormatId !== formatId &&
    !equivalent(formatId, claimedFormatId);
  return {
    formatId,
    confidence,
    signatureOffset,
    evidence,
    claimedFormatId,
    extension,
    mismatch,
    looksTextual,
    inspectedBytes
  };
}

/**
 * Formats whose difference is a naming convention rather than a byte difference.
 *
 * A `.md` file really is plain text and a `.tgz` really is a gzip member, so
 * calling those a mismatch would cry wolf on every ordinary file.
 */
const EQUIVALENT: Array<[string, string]> = [
  ['text', 'markdown'],
  ['text', 'html'],
  ['text', 'yaml'],
  ['text', 'toml'],
  ['text', 'xml'],
  ['text', 'csv'],
  ['text', 'tsv'],
  ['text', 'json'],
  ['text', 'jsonl'],
  ['text', 'sql'],
  ['gzip', 'tgz'],
  ['csv', 'text'],
  ['json', 'text']
];

function equivalent(a: string, b: string): boolean {
  return EQUIVALENT.some(([left, right]) => (left === a && right === b) || (left === b && right === a));
}

/** How many bytes at the end of the file the detector would like, when available. */
export const TAIL_BYTES = 8 * 1024;

/** A short, honest sentence describing what the detector concluded. */
export function detectionSummary(detection: Detection): string {
  const spec = detection.formatId ? formatById(detection.formatId) : null;
  const name = spec ? spec.id : 'unknown';
  return `${name} (${detection.confidence}): ${detection.evidence}`;
}
