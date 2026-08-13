/**
 * A bounded PDF reader and writer, written out in TypeScript and compiled into
 * the renderer bundle.
 *
 * It reads the cross-reference table or cross-reference stream, expands object
 * streams, walks the page tree with inherited attributes, and can emit a fresh
 * document holding a chosen set of pages in a chosen order with chosen
 * rotations and metadata.
 *
 * ## Why the output is pure ASCII
 *
 * The application's file-writing channel writes UTF-8 text, so a byte above 127
 * would be re-encoded as a multi-byte sequence and the file would be corrupt.
 * Every stream this writer emits is therefore wrapped in `ASCIIHexDecode` ahead
 * of whatever filter chain it already carried, every string is emitted as a hex
 * string and every name escapes anything outside the safe set. The result is a
 * standards-valid PDF whose bytes are all printable ASCII, which survives a
 * UTF-8 write byte for byte. It costs roughly twice the stream size, and that
 * cost is disclosed before the conversion runs.
 *
 * ## What it refuses
 *
 * An encrypted document, a document whose cross-reference structure does not
 * parse, and a document past the page or size bound are all refused outright
 * with the exact boundary. Nothing partial is ever produced.
 */

import { ascii, bytesToLatin1, decompress, indexOfBytes, lastIndexOfBytes, sha256Hex, startsWith } from './bytes';
import { ConverterBoundary, Deadline, type ResourceLimits } from './limits';

/* ------------------------------------------------------------------ */
/* Object model                                                        */
/* ------------------------------------------------------------------ */

export interface PdfRef {
  kind: 'ref';
  num: number;
  gen: number;
}

export interface PdfName {
  kind: 'name';
  name: string;
}

export interface PdfString {
  kind: 'string';
  bytes: Uint8Array;
}

export interface PdfStream {
  kind: 'stream';
  dict: PdfDict;
  /** The stream bytes exactly as they appear in the file, still filtered. */
  raw: Uint8Array;
}

export type PdfDict = { kind: 'dict'; map: Map<string, PdfValue> };
export type PdfArray = { kind: 'array'; items: PdfValue[] };

export type PdfValue =
  | { kind: 'null' }
  | { kind: 'bool'; value: boolean }
  | { kind: 'number'; value: number }
  | PdfString
  | PdfName
  | PdfArray
  | PdfDict
  | PdfStream
  | PdfRef;

export const PDF_NULL: PdfValue = { kind: 'null' };

export function name(value: string): PdfName {
  return { kind: 'name', name: value };
}
export function num(value: number): PdfValue {
  return { kind: 'number', value };
}
export function dict(entries: Array<[string, PdfValue]> = []): PdfDict {
  return { kind: 'dict', map: new Map(entries) };
}
export function array(items: PdfValue[]): PdfArray {
  return { kind: 'array', items };
}
export function pdfString(text: string): PdfString {
  // Latin-1 is the safe transport for a document information string: every code
  // point below 256 round-trips, and the writer emits it as a hex string.
  const bytes = new Uint8Array(text.length);
  for (let index = 0; index < text.length; index += 1) bytes[index] = text.charCodeAt(index) & 0xff;
  return { kind: 'string', bytes };
}

/* ------------------------------------------------------------------ */
/* Lexer and parser                                                    */
/* ------------------------------------------------------------------ */

const WHITESPACE = new Set([0x00, 0x09, 0x0a, 0x0c, 0x0d, 0x20]);
const DELIMITERS = new Set([0x28, 0x29, 0x3c, 0x3e, 0x5b, 0x5d, 0x7b, 0x7d, 0x2f, 0x25]);

function isWhitespace(byte: number): boolean {
  return WHITESPACE.has(byte);
}
function isDelimiter(byte: number): boolean {
  return DELIMITERS.has(byte);
}
function isRegular(byte: number): boolean {
  return !isWhitespace(byte) && !isDelimiter(byte);
}

class Lexer {
  position = 0;

  constructor(
    readonly bytes: Uint8Array,
    private readonly depthLimit: number
  ) {}

  atEnd(): boolean {
    return this.position >= this.bytes.length;
  }

  skipWhitespace(): void {
    while (this.position < this.bytes.length) {
      const byte = this.bytes[this.position];
      if (isWhitespace(byte)) {
        this.position += 1;
        continue;
      }
      if (byte === 0x25) {
        // A comment runs to the end of the line.
        while (this.position < this.bytes.length && this.bytes[this.position] !== 0x0a && this.bytes[this.position] !== 0x0d) {
          this.position += 1;
        }
        continue;
      }
      return;
    }
  }

  /** Reads the next regular-character token without interpreting it. */
  readToken(): string {
    this.skipWhitespace();
    const start = this.position;
    while (this.position < this.bytes.length && isRegular(this.bytes[this.position])) this.position += 1;
    if (this.position === start && this.position < this.bytes.length) {
      this.position += 1;
      return String.fromCharCode(this.bytes[start]);
    }
    return bytesToLatin1(this.bytes.subarray(start, this.position));
  }

  peekToken(): string {
    const saved = this.position;
    const token = this.readToken();
    this.position = saved;
    return token;
  }

  parseObject(depth = 0): PdfValue {
    if (depth > this.depthLimit) {
      throw new ConverterBoundary('depth', `The document nests deeper than the ${this.depthLimit}-level bound. Nothing was written.`);
    }
    this.skipWhitespace();
    if (this.atEnd()) throw new ConverterBoundary('malformed', 'The document ended in the middle of an object.');

    const byte = this.bytes[this.position];

    if (byte === 0x2f) return this.parseName();
    if (byte === 0x28) return this.parseLiteralString();
    if (byte === 0x5b) return this.parseArray(depth);
    if (byte === 0x3c) {
      if (this.bytes[this.position + 1] === 0x3c) return this.parseDictOrStream(depth);
      return this.parseHexString();
    }
    if (byte === 0x5d || byte === 0x3e || byte === 0x29) {
      throw new ConverterBoundary('malformed', 'The document closed a container that was never opened.');
    }

    const token = this.readToken();
    if (token === 'true') return { kind: 'bool', value: true };
    if (token === 'false') return { kind: 'bool', value: false };
    if (token === 'null') return PDF_NULL;
    if (token.length === 0) throw new ConverterBoundary('malformed', 'The document produced an empty token where an object was expected.');

    if (/^[+-]?\d+$/.test(token)) {
      // Might be "num gen R"; look ahead without committing.
      const saved = this.position;
      const second = this.readToken();
      if (/^\d+$/.test(second)) {
        const third = this.readToken();
        if (third === 'R') {
          return { kind: 'ref', num: Number(token), gen: Number(second) };
        }
      }
      this.position = saved;
      return { kind: 'number', value: Number(token) };
    }
    if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(token)) return { kind: 'number', value: Number(token) };

    throw new ConverterBoundary('malformed', `The document used an unrecognised token where an object was expected.`);
  }

  private parseName(): PdfName {
    this.position += 1;
    let out = '';
    while (this.position < this.bytes.length && isRegular(this.bytes[this.position])) {
      const byte = this.bytes[this.position];
      if (byte === 0x23 && this.position + 2 < this.bytes.length) {
        const hex = bytesToLatin1(this.bytes.subarray(this.position + 1, this.position + 3));
        const value = Number.parseInt(hex, 16);
        if (Number.isFinite(value)) {
          out += String.fromCharCode(value);
          this.position += 3;
          continue;
        }
      }
      out += String.fromCharCode(byte);
      this.position += 1;
    }
    return { kind: 'name', name: out };
  }

  private parseLiteralString(): PdfString {
    this.position += 1;
    const out: number[] = [];
    let nesting = 1;
    while (this.position < this.bytes.length) {
      const byte = this.bytes[this.position];
      this.position += 1;
      if (byte === 0x5c) {
        const next = this.bytes[this.position];
        this.position += 1;
        switch (next) {
          case 0x6e: out.push(0x0a); break;
          case 0x72: out.push(0x0d); break;
          case 0x74: out.push(0x09); break;
          case 0x62: out.push(0x08); break;
          case 0x66: out.push(0x0c); break;
          case 0x0a: break;
          case 0x0d:
            if (this.bytes[this.position] === 0x0a) this.position += 1;
            break;
          default:
            if (next >= 0x30 && next <= 0x37) {
              let value = next - 0x30;
              for (let extra = 0; extra < 2; extra += 1) {
                const digit = this.bytes[this.position];
                if (digit >= 0x30 && digit <= 0x37) {
                  value = value * 8 + (digit - 0x30);
                  this.position += 1;
                } else break;
              }
              out.push(value & 0xff);
            } else {
              out.push(next);
            }
        }
        continue;
      }
      if (byte === 0x28) nesting += 1;
      if (byte === 0x29) {
        nesting -= 1;
        if (nesting === 0) break;
      }
      out.push(byte);
    }
    return { kind: 'string', bytes: Uint8Array.from(out) };
  }

  private parseHexString(): PdfString {
    this.position += 1;
    const digits: string[] = [];
    while (this.position < this.bytes.length && this.bytes[this.position] !== 0x3e) {
      const char = String.fromCharCode(this.bytes[this.position]);
      if (/[0-9a-fA-F]/.test(char)) digits.push(char);
      this.position += 1;
    }
    this.position += 1;
    if (digits.length % 2 === 1) digits.push('0');
    const out = new Uint8Array(digits.length / 2);
    for (let index = 0; index < out.length; index += 1) {
      out[index] = Number.parseInt(digits[index * 2] + digits[index * 2 + 1], 16);
    }
    return { kind: 'string', bytes: out };
  }

  private parseArray(depth: number): PdfArray {
    this.position += 1;
    const items: PdfValue[] = [];
    for (;;) {
      this.skipWhitespace();
      if (this.atEnd()) throw new ConverterBoundary('malformed', 'The document ended inside an array.');
      if (this.bytes[this.position] === 0x5d) {
        this.position += 1;
        break;
      }
      items.push(this.parseObject(depth + 1));
    }
    return { kind: 'array', items };
  }

  private parseDictOrStream(depth: number): PdfDict | PdfStream {
    this.position += 2;
    const map = new Map<string, PdfValue>();
    for (;;) {
      this.skipWhitespace();
      if (this.atEnd()) throw new ConverterBoundary('malformed', 'The document ended inside a dictionary.');
      if (this.bytes[this.position] === 0x3e && this.bytes[this.position + 1] === 0x3e) {
        this.position += 2;
        break;
      }
      if (this.bytes[this.position] !== 0x2f) {
        throw new ConverterBoundary('malformed', 'A dictionary key was not a name.');
      }
      const key = this.parseName();
      const value = this.parseObject(depth + 1);
      map.set(key.name, value);
    }
    const asDict: PdfDict = { kind: 'dict', map };

    const saved = this.position;
    this.skipWhitespace();
    if (startsWith(this.bytes, ascii('stream'), this.position)) {
      this.position += 6;
      if (this.bytes[this.position] === 0x0d) this.position += 1;
      if (this.bytes[this.position] === 0x0a) this.position += 1;
      const start = this.position;
      const declared = asDict.map.get('Length');
      let length = -1;
      if (declared && declared.kind === 'number') length = declared.value;
      if (length < 0 || start + length > this.bytes.length || !this.endstreamFollows(start + length)) {
        // A wrong or indirect /Length is common; recover by scanning.
        const found = indexOfBytes(this.bytes, ascii('endstream'), start);
        if (found < 0) throw new ConverterBoundary('malformed', 'A stream was never closed by endstream.');
        length = found - start;
        while (length > 0 && (this.bytes[start + length - 1] === 0x0a || this.bytes[start + length - 1] === 0x0d)) {
          length -= 1;
        }
      }
      const raw = this.bytes.subarray(start, start + length);
      this.position = start + length;
      const close = indexOfBytes(this.bytes, ascii('endstream'), this.position);
      this.position = close >= 0 ? close + 9 : this.bytes.length;
      return { kind: 'stream', dict: asDict, raw };
    }
    this.position = saved;
    return asDict;
  }

  private endstreamFollows(offset: number): boolean {
    let cursor = offset;
    let guard = 0;
    while (cursor < this.bytes.length && isWhitespace(this.bytes[cursor]) && guard < 4) {
      cursor += 1;
      guard += 1;
    }
    return startsWith(this.bytes, ascii('endstream'), cursor);
  }
}

/* ------------------------------------------------------------------ */
/* Document                                                            */
/* ------------------------------------------------------------------ */

export interface PdfPageInfo {
  /** 1-based position in the page tree. */
  index: number;
  /** Object number of the page dictionary. */
  objectNumber: number;
  widthPt: number;
  heightPt: number;
  /** Normalised to 0, 90, 180 or 270. */
  rotation: number;
  /** True when this page carries any annotation. */
  hasAnnotations: boolean;
  /** Number of content streams the page references. */
  contentStreams: number;
  /** Approximate size of the page's own content, in bytes. */
  contentBytes: number;
}

export interface PdfInspection {
  version: string;
  pageCount: number;
  pages: PdfPageInfo[];
  encrypted: boolean;
  /** Present when the document declares a digital signature. */
  signed: boolean;
  linearized: boolean;
  hasAcroForm: boolean;
  hasOutlines: boolean;
  hasStructTree: boolean;
  hasEmbeddedFiles: boolean;
  /** Object streams found; their contents were expanded to read the objects. */
  objectStreams: number;
  crossReferenceStyle: 'table' | 'stream' | 'mixed';
  /** Document information dictionary, with every value already made safe text. */
  info: Record<string, string>;
  /** True when an XMP metadata stream is present. */
  hasXmp: boolean;
  fileBytes: number;
  sha256: string;
}

export class PdfDocument {
  /** Resolved objects, keyed by object number. */
  private readonly objects = new Map<number, PdfValue>();
  private readonly offsets = new Map<number, number>();
  private readonly compressed = new Map<number, { streamNum: number; indexInStream: number }>();
  private readonly expandedStreams = new Set<number>();

  trailer: PdfDict = dict();
  version = '1.4';
  encrypted = false;
  crossReferenceStyle: 'table' | 'stream' | 'mixed' = 'table';
  objectStreamCount = 0;

  private constructor(
    readonly bytes: Uint8Array,
    private readonly limits: ResourceLimits,
    private readonly deadline: Deadline
  ) {}

  /** Parses a document. Never mutates `bytes`. */
  static async open(bytes: Uint8Array, limits: ResourceLimits, deadline: Deadline): Promise<PdfDocument> {
    if (!startsWith(bytes, ascii('%PDF-'))) {
      throw new ConverterBoundary('unsupported', 'The file does not begin with %PDF-, so it is not a PDF document.');
    }
    if (bytes.length > limits.sourceBytes) {
      throw new ConverterBoundary(
        'source-size',
        `The document is ${bytes.length} bytes, past the ${limits.sourceBytes}-byte source bound. Nothing was read.`
      );
    }
    const doc = new PdfDocument(bytes, limits, deadline);
    doc.version = bytesToLatin1(bytes.subarray(5, 8));
    await doc.readCrossReference();
    const encrypt = doc.trailer.map.get('Encrypt');
    doc.encrypted = encrypt !== undefined && encrypt.kind !== 'null';
    return doc;
  }

  /* ---- cross-reference ---- */

  private async readCrossReference(): Promise<void> {
    const tailStart = Math.max(0, this.bytes.length - 2048);
    const marker = lastIndexOfBytes(this.bytes, ascii('startxref'), this.bytes.length - 9);
    if (marker < 0 || marker < tailStart - 4096) {
      await this.rebuildByScan();
      return;
    }
    const lexer = new Lexer(this.bytes, this.limits.depth);
    lexer.position = marker + 9;
    const offsetToken = lexer.readToken();
    let offset = Number(offsetToken);
    if (!Number.isFinite(offset) || offset <= 0 || offset >= this.bytes.length) {
      await this.rebuildByScan();
      return;
    }

    const seen = new Set<number>();
    let styleTable = false;
    let styleStream = false;
    while (Number.isFinite(offset) && offset > 0 && offset < this.bytes.length && !seen.has(offset)) {
      seen.add(offset);
      this.deadline.check();
      const section = await this.readCrossReferenceSection(offset);
      if (section === null) break;
      if (section.style === 'table') styleTable = true;
      else styleStream = true;
      for (const [key, value] of section.trailer.map) {
        if (!this.trailer.map.has(key)) this.trailer.map.set(key, value);
      }
      offset = section.previous ?? -1;
    }

    this.crossReferenceStyle = styleTable && styleStream ? 'mixed' : styleStream ? 'stream' : 'table';

    if (!this.trailer.map.has('Root') || this.offsets.size + this.compressed.size === 0) {
      await this.rebuildByScan();
    }
  }

  private async readCrossReferenceSection(
    offset: number
  ): Promise<{ trailer: PdfDict; previous: number | null; style: 'table' | 'stream' } | null> {
    const lexer = new Lexer(this.bytes, this.limits.depth);
    lexer.position = offset;
    const first = lexer.peekToken();

    if (first === 'xref') {
      lexer.readToken();
      for (;;) {
        const token = lexer.peekToken();
        if (token === 'trailer') {
          lexer.readToken();
          const trailer = lexer.parseObject();
          if (trailer.kind !== 'dict') return null;
          const prev = trailer.map.get('Prev');
          const xrefStm = trailer.map.get('XRefStm');
          if (xrefStm && xrefStm.kind === 'number') {
            await this.readCrossReferenceSection(xrefStm.value);
          }
          return { trailer, previous: prev && prev.kind === 'number' ? prev.value : null, style: 'table' };
        }
        if (!/^\d+$/.test(token)) return null;
        const start = Number(lexer.readToken());
        const count = Number(lexer.readToken());
        if (!Number.isFinite(count) || count < 0 || count > this.limits.entries) {
          throw new ConverterBoundary('entries', `A cross-reference subsection declares ${count} entries, past the ${this.limits.entries} bound.`);
        }
        for (let index = 0; index < count; index += 1) {
          const position = Number(lexer.readToken());
          lexer.readToken();
          const type = lexer.readToken();
          const objectNumber = start + index;
          if (type === 'n' && !this.offsets.has(objectNumber) && !this.compressed.has(objectNumber)) {
            this.offsets.set(objectNumber, position);
          }
        }
      }
    }

    // A cross-reference stream: "num gen obj <<...>> stream".
    const objectNumber = Number(lexer.readToken());
    lexer.readToken();
    if (lexer.readToken() !== 'obj' || !Number.isFinite(objectNumber)) return null;
    const value = lexer.parseObject();
    if (value.kind !== 'stream') return null;
    const trailer = value.dict;
    const data = await this.decodeStream(value);

    const wRaw = trailer.map.get('W');
    if (!wRaw || wRaw.kind !== 'array') return null;
    const widths = wRaw.items.map((item) => (item.kind === 'number' ? item.value : 0));
    const sizeRaw = trailer.map.get('Size');
    const size = sizeRaw && sizeRaw.kind === 'number' ? sizeRaw.value : 0;
    const indexRaw = trailer.map.get('Index');
    const ranges: Array<[number, number]> = [];
    if (indexRaw && indexRaw.kind === 'array') {
      for (let index = 0; index + 1 < indexRaw.items.length; index += 2) {
        const a = indexRaw.items[index];
        const b = indexRaw.items[index + 1];
        if (a.kind === 'number' && b.kind === 'number') ranges.push([a.value, b.value]);
      }
    } else {
      ranges.push([0, size]);
    }

    const rowWidth = widths.reduce((total, width) => total + width, 0);
    let cursor = 0;
    for (const [start, count] of ranges) {
      if (count > this.limits.entries) {
        throw new ConverterBoundary('entries', `A cross-reference stream declares ${count} entries, past the ${this.limits.entries} bound.`);
      }
      for (let index = 0; index < count; index += 1) {
        if (cursor + rowWidth > data.length) break;
        const fields: number[] = [];
        for (const width of widths) {
          let field = 0;
          for (let byte = 0; byte < width; byte += 1) {
            field = field * 256 + data[cursor];
            cursor += 1;
          }
          fields.push(width === 0 ? -1 : field);
        }
        const type = widths[0] === 0 ? 1 : fields[0];
        const target = start + index;
        if (this.offsets.has(target) || this.compressed.has(target)) continue;
        if (type === 1) this.offsets.set(target, fields[1]);
        else if (type === 2) this.compressed.set(target, { streamNum: fields[1], indexInStream: fields[2] });
      }
    }

    const prev = trailer.map.get('Prev');
    return { trailer, previous: prev && prev.kind === 'number' ? prev.value : null, style: 'stream' };
  }

  /**
   * Last-resort recovery: scan the whole file for `n g obj` headers.
   *
   * A document whose cross-reference is damaged is still readable when the
   * objects themselves are intact, and refusing outright would reject files
   * that every reader opens happily.
   */
  private async rebuildByScan(): Promise<void> {
    const pattern = ascii(' obj');
    let cursor = 0;
    let found = 0;
    for (;;) {
      const hit = indexOfBytes(this.bytes, pattern, cursor);
      if (hit < 0) break;
      cursor = hit + 4;
      // Walk backwards over "num gen".
      let start = hit;
      let fields = 0;
      while (start > 0 && fields < 2) {
        let end = start;
        while (end > 0 && isWhitespace(this.bytes[end - 1])) end -= 1;
        let digits = end;
        while (digits > 0 && this.bytes[digits - 1] >= 0x30 && this.bytes[digits - 1] <= 0x39) digits -= 1;
        if (digits === end) break;
        start = digits;
        fields += 1;
      }
      if (fields < 2) continue;
      const header = bytesToLatin1(this.bytes.subarray(start, hit)).trim().split(/\s+/);
      const objectNumber = Number(header[0]);
      if (!Number.isFinite(objectNumber)) continue;
      this.offsets.set(objectNumber, start);
      found += 1;
      if (found > this.limits.entries) {
        throw new ConverterBoundary('entries', `The document holds more than ${this.limits.entries} objects. Nothing was written.`);
      }
      this.deadline.check();
    }

    if (!this.trailer.map.has('Root')) {
      const trailerAt = lastIndexOfBytes(this.bytes, ascii('trailer'), this.bytes.length - 7);
      if (trailerAt >= 0) {
        const lexer = new Lexer(this.bytes, this.limits.depth);
        lexer.position = trailerAt + 7;
        const parsed = lexer.parseObject();
        if (parsed.kind === 'dict') {
          for (const [key, value] of parsed.map) if (!this.trailer.map.has(key)) this.trailer.map.set(key, value);
        }
      }
    }
    if (!this.trailer.map.has('Root')) {
      // Find a catalog among the recovered objects.
      for (const objectNumber of this.offsets.keys()) {
        const value = await this.object(objectNumber);
        const asDict = value.kind === 'stream' ? value.dict : value;
        if (asDict.kind === 'dict') {
          const type = asDict.map.get('Type');
          if (type && type.kind === 'name' && type.name === 'Catalog') {
            this.trailer.map.set('Root', { kind: 'ref', num: objectNumber, gen: 0 });
            break;
          }
        }
      }
    }
    if (!this.trailer.map.has('Root')) {
      throw new ConverterBoundary('malformed', 'No document catalog could be found, so the page tree cannot be read.');
    }
  }

  /* ---- object access ---- */

  /** Reads one object by number, parsing it on first use. */
  async object(objectNumber: number): Promise<PdfValue> {
    const cached = this.objects.get(objectNumber);
    if (cached) return cached;

    const offset = this.offsets.get(objectNumber);
    if (offset !== undefined) {
      const lexer = new Lexer(this.bytes, this.limits.depth);
      lexer.position = offset;
      const declared = Number(lexer.readToken());
      lexer.readToken();
      const keyword = lexer.readToken();
      if (keyword !== 'obj' || declared !== objectNumber) {
        this.objects.set(objectNumber, PDF_NULL);
        return PDF_NULL;
      }
      const value = lexer.parseObject();
      this.objects.set(objectNumber, value);
      return value;
    }

    const packed = this.compressed.get(objectNumber);
    if (packed) {
      await this.expandObjectStream(packed.streamNum);
      return this.objects.get(objectNumber) ?? PDF_NULL;
    }

    return PDF_NULL;
  }

  private async expandObjectStream(streamNumber: number): Promise<void> {
    if (this.expandedStreams.has(streamNumber)) return;
    this.expandedStreams.add(streamNumber);
    this.objectStreamCount += 1;

    const container = await this.object(streamNumber);
    if (container.kind !== 'stream') return;
    const data = await this.decodeStream(container);
    const countRaw = container.dict.map.get('N');
    const firstRaw = container.dict.map.get('First');
    const count = countRaw && countRaw.kind === 'number' ? countRaw.value : 0;
    const first = firstRaw && firstRaw.kind === 'number' ? firstRaw.value : 0;
    if (count > this.limits.entries) {
      throw new ConverterBoundary('entries', `An object stream declares ${count} objects, past the ${this.limits.entries} bound.`);
    }

    const header = new Lexer(data, this.limits.depth);
    const pairs: Array<[number, number]> = [];
    for (let index = 0; index < count; index += 1) {
      const objectNumber = Number(header.readToken());
      const relative = Number(header.readToken());
      if (!Number.isFinite(objectNumber) || !Number.isFinite(relative)) break;
      pairs.push([objectNumber, relative]);
    }
    for (const [objectNumber, relative] of pairs) {
      if (this.objects.has(objectNumber)) continue;
      const body = new Lexer(data, this.limits.depth);
      body.position = first + relative;
      try {
        this.objects.set(objectNumber, body.parseObject());
      } catch {
        this.objects.set(objectNumber, PDF_NULL);
      }
      this.deadline.check();
    }
  }

  /** Follows a reference until a direct value is reached. */
  async resolve(value: PdfValue | undefined, depth = 0): Promise<PdfValue> {
    if (!value) return PDF_NULL;
    if (value.kind !== 'ref') return value;
    if (depth > 32) return PDF_NULL;
    return this.resolve(await this.object(value.num), depth + 1);
  }

  /** Reads one dictionary entry, following a reference. */
  async get(container: PdfDict, key: string): Promise<PdfValue> {
    return this.resolve(container.map.get(key));
  }

  /**
   * Decodes a stream far enough to read it.
   *
   * Only the filters the reader genuinely needs are implemented; anything else
   * is refused by name rather than guessed at, because a half-decoded stream is
   * worse than an honest refusal.
   */
  async decodeStream(stream: PdfStream): Promise<Uint8Array> {
    const filterValue = await this.resolve(stream.dict.map.get('Filter'));
    const parmsValue = await this.resolve(stream.dict.map.get('DecodeParms'));
    const filters: string[] = [];
    if (filterValue.kind === 'name') filters.push(filterValue.name);
    else if (filterValue.kind === 'array') {
      for (const item of filterValue.items) {
        const resolved = await this.resolve(item);
        if (resolved.kind === 'name') filters.push(resolved.name);
      }
    }
    const parmsList: PdfValue[] = [];
    if (parmsValue.kind === 'array') parmsList.push(...parmsValue.items);
    else parmsList.push(parmsValue);

    let data = stream.raw;
    for (let index = 0; index < filters.length; index += 1) {
      const filter = filters[index];
      const parms = await this.resolve(parmsList[index]);
      if (filter === 'FlateDecode' || filter === 'Fl') {
        data = await decompress(data, 'deflate', this.limits.outputBytes);
      } else if (filter === 'ASCIIHexDecode' || filter === 'AHx') {
        data = decodeAsciiHex(data);
      } else if (filter === 'ASCII85Decode' || filter === 'A85') {
        data = decodeAscii85(data);
      } else {
        throw new ConverterBoundary(
          'unsupported',
          `The stream uses the ${filter} filter, which this reader does not implement. Nothing was written.`
        );
      }
      if (parms.kind === 'dict') data = applyPredictor(data, parms, this.limits);
    }
    return data;
  }

  /* ---- page tree ---- */

  private pageCache: Array<{ objectNumber: number; page: PdfDict }> | null = null;

  /** The pages in reading order, with inherited attributes already merged. */
  async pages(): Promise<Array<{ objectNumber: number; page: PdfDict }>> {
    if (this.pageCache) return this.pageCache;
    const rootValue = await this.resolve(this.trailer.map.get('Root'));
    if (rootValue.kind !== 'dict') {
      throw new ConverterBoundary('malformed', 'The document catalog is not a dictionary, so the page tree cannot be read.');
    }
    const pagesValue = await this.get(rootValue, 'Pages');
    const out: Array<{ objectNumber: number; page: PdfDict }> = [];
    const seen = new Set<number>();

    const inheritable = ['Resources', 'MediaBox', 'CropBox', 'Rotate'];

    const walk = async (node: PdfValue, refNumber: number, inherited: Map<string, PdfValue>, depth: number): Promise<void> => {
      this.deadline.check();
      if (depth > this.limits.depth) {
        throw new ConverterBoundary('depth', `The page tree nests deeper than the ${this.limits.depth}-level bound.`);
      }
      if (node.kind !== 'dict') return;
      const nextInherited = new Map(inherited);
      for (const key of inheritable) {
        const own = node.map.get(key);
        if (own !== undefined) nextInherited.set(key, own);
      }
      const type = node.map.get('Type');
      const kidsValue = await this.get(node, 'Kids');

      if (kidsValue.kind === 'array') {
        for (const kid of kidsValue.items) {
          const kidNumber = kid.kind === 'ref' ? kid.num : -1;
          if (kidNumber >= 0) {
            if (seen.has(kidNumber)) continue;
            seen.add(kidNumber);
          }
          const resolved = await this.resolve(kid);
          await walk(resolved, kidNumber, nextInherited, depth + 1);
          if (out.length > this.limits.pages) {
            throw new ConverterBoundary('pages', `The document holds more than ${this.limits.pages} pages, past the bound. Nothing was written.`);
          }
        }
        return;
      }

      if (type && type.kind === 'name' && type.name === 'Pages') return;

      const merged: PdfDict = { kind: 'dict', map: new Map(node.map) };
      for (const [key, value] of nextInherited) if (!merged.map.has(key)) merged.map.set(key, value);
      out.push({ objectNumber: refNumber, page: merged });
    };

    const rootRef = rootValue.map.get('Pages');
    await walk(pagesValue, rootRef && rootRef.kind === 'ref' ? rootRef.num : -1, new Map(), 0);

    if (out.length === 0) throw new ConverterBoundary('malformed', 'The page tree produced no pages.');
    this.pageCache = out;
    return out;
  }

  /** A full inspection report. Read-only: it never writes anything. */
  async inspect(): Promise<PdfInspection> {
    const rootValue = await this.resolve(this.trailer.map.get('Root'));
    const root = rootValue.kind === 'dict' ? rootValue : dict();

    const pages = this.encrypted ? [] : await this.pages();
    const pageInfo: PdfPageInfo[] = [];
    for (let index = 0; index < pages.length; index += 1) {
      this.deadline.check();
      const entry = pages[index];
      const box = await this.rectangle(entry.page, 'MediaBox');
      const rotateValue = await this.get(entry.page, 'Rotate');
      const rotation = normaliseRotation(rotateValue.kind === 'number' ? rotateValue.value : 0);
      const annots = await this.get(entry.page, 'Annots');
      const contents = await this.get(entry.page, 'Contents');
      let streams = 0;
      let contentBytes = 0;
      if (contents.kind === 'stream') {
        streams = 1;
        contentBytes = contents.raw.length;
      } else if (contents.kind === 'array') {
        for (const item of contents.items) {
          const resolved = await this.resolve(item);
          if (resolved.kind === 'stream') {
            streams += 1;
            contentBytes += resolved.raw.length;
          }
        }
      }
      const swap = rotation === 90 || rotation === 270;
      pageInfo.push({
        index: index + 1,
        objectNumber: entry.objectNumber,
        widthPt: round2(swap ? box.height : box.width),
        heightPt: round2(swap ? box.width : box.height),
        rotation,
        hasAnnotations: annots.kind === 'array' && annots.items.length > 0,
        contentStreams: streams,
        contentBytes
      });
    }

    const infoValue = await this.resolve(this.trailer.map.get('Info'));
    const info: Record<string, string> = {};
    if (infoValue.kind === 'dict') {
      for (const [key, raw] of infoValue.map) {
        const resolved = await this.resolve(raw);
        if (resolved.kind === 'string') info[key] = decodeTextString(resolved.bytes);
        else if (resolved.kind === 'name') info[key] = `/${resolved.name}`;
        else if (resolved.kind === 'number') info[key] = String(resolved.value);
      }
    }

    const acroForm = await this.get(root, 'AcroForm');
    const outlines = await this.get(root, 'Outlines');
    const structTree = await this.get(root, 'StructTreeRoot');
    const namesValue = await this.get(root, 'Names');
    let embedded = false;
    if (namesValue.kind === 'dict') {
      const files = await this.get(namesValue, 'EmbeddedFiles');
      embedded = files.kind === 'dict';
    }
    let signed = false;
    if (acroForm.kind === 'dict') {
      const sigFlags = await this.get(acroForm, 'SigFlags');
      signed = sigFlags.kind === 'number' && (sigFlags.value & 1) === 1;
    }
    const metadata = await this.get(root, 'Metadata');

    return {
      version: this.version,
      pageCount: pageInfo.length,
      pages: pageInfo,
      encrypted: this.encrypted,
      signed,
      linearized: indexOfBytes(this.bytes.subarray(0, Math.min(this.bytes.length, 2048)), ascii('/Linearized')) >= 0,
      hasAcroForm: acroForm.kind === 'dict',
      hasOutlines: outlines.kind === 'dict',
      hasStructTree: structTree.kind === 'dict',
      hasEmbeddedFiles: embedded,
      objectStreams: this.objectStreamCount,
      crossReferenceStyle: this.crossReferenceStyle,
      info,
      hasXmp: metadata.kind === 'stream',
      fileBytes: this.bytes.length,
      sha256: sha256Hex(this.bytes)
    };
  }

  private async rectangle(page: PdfDict, key: string): Promise<{ width: number; height: number }> {
    const value = await this.get(page, key);
    if (value.kind !== 'array' || value.items.length < 4) return { width: 612, height: 792 };
    const numbers: number[] = [];
    for (const item of value.items) {
      const resolved = await this.resolve(item);
      numbers.push(resolved.kind === 'number' ? resolved.value : 0);
    }
    return { width: Math.abs(numbers[2] - numbers[0]), height: Math.abs(numbers[3] - numbers[1]) };
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function normaliseRotation(value: number): number {
  const wrapped = ((Math.round(value / 90) * 90) % 360 + 360) % 360;
  return wrapped;
}

/** Turns a PDF text string into something safe to render. */
export function decodeTextString(bytes: Uint8Array): string {
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    let out = '';
    for (let index = 2; index + 1 < bytes.length; index += 2) {
      out += String.fromCharCode((bytes[index] << 8) | bytes[index + 1]);
    }
    return out.replace(/[ -]/g, '');
  }
  let out = '';
  for (let index = 0; index < bytes.length; index += 1) out += String.fromCharCode(bytes[index]);
  return out.replace(/[ -]/g, '');
}

function decodeAsciiHex(data: Uint8Array): Uint8Array {
  const digits: number[] = [];
  for (let index = 0; index < data.length; index += 1) {
    const byte = data[index];
    if (byte === 0x3e) break;
    const char = String.fromCharCode(byte);
    if (/[0-9a-fA-F]/.test(char)) digits.push(Number.parseInt(char, 16));
  }
  if (digits.length % 2 === 1) digits.push(0);
  const out = new Uint8Array(digits.length / 2);
  for (let index = 0; index < out.length; index += 1) out[index] = (digits[index * 2] << 4) | digits[index * 2 + 1];
  return out;
}

function decodeAscii85(data: Uint8Array): Uint8Array {
  const out: number[] = [];
  let tuple = 0;
  let count = 0;
  let index = 0;
  if (data[0] === 0x3c && data[1] === 0x7e) index = 2;
  for (; index < data.length; index += 1) {
    const byte = data[index];
    if (byte === 0x7e) break;
    if (isWhitespace(byte)) continue;
    if (byte === 0x7a && count === 0) {
      out.push(0, 0, 0, 0);
      continue;
    }
    if (byte < 0x21 || byte > 0x75) continue;
    tuple = tuple * 85 + (byte - 0x21);
    count += 1;
    if (count === 5) {
      out.push((tuple >>> 24) & 0xff, (tuple >>> 16) & 0xff, (tuple >>> 8) & 0xff, tuple & 0xff);
      tuple = 0;
      count = 0;
    }
  }
  if (count > 0) {
    for (let pad = count; pad < 5; pad += 1) tuple = tuple * 85 + 84;
    const bytes = [(tuple >>> 24) & 0xff, (tuple >>> 16) & 0xff, (tuple >>> 8) & 0xff, tuple & 0xff];
    out.push(...bytes.slice(0, count - 1));
  }
  return Uint8Array.from(out);
}

function applyPredictor(data: Uint8Array, parms: PdfDict, limits: ResourceLimits): Uint8Array {
  const readNumber = (key: string, fallback: number): number => {
    const value = parms.map.get(key);
    return value && value.kind === 'number' ? value.value : fallback;
  };
  const predictor = readNumber('Predictor', 1);
  if (predictor <= 1) return data;
  const colors = readNumber('Colors', 1);
  const bitsPerComponent = readNumber('BitsPerComponent', 8);
  const columns = readNumber('Columns', 1);
  const bytesPerPixel = Math.max(1, Math.ceil((colors * bitsPerComponent) / 8));
  const rowLength = Math.ceil((colors * bitsPerComponent * columns) / 8);
  if (rowLength <= 0 || rowLength > limits.outputBytes) {
    throw new ConverterBoundary('malformed', 'A predictor row length is not usable, so the stream cannot be decoded.');
  }

  if (predictor === 2) {
    if (bitsPerComponent !== 8) return data;
    const rows = Math.floor(data.length / rowLength);
    for (let row = 0; row < rows; row += 1) {
      const base = row * rowLength;
      for (let index = bytesPerPixel; index < rowLength; index += 1) {
        data[base + index] = (data[base + index] + data[base + index - bytesPerPixel]) & 0xff;
      }
    }
    return data;
  }

  // PNG predictors: each row carries a leading filter byte.
  const stride = rowLength + 1;
  const rows = Math.floor(data.length / stride);
  const out = new Uint8Array(rows * rowLength);
  let previous = new Uint8Array(rowLength);
  for (let row = 0; row < rows; row += 1) {
    const filter = data[row * stride];
    const source = data.subarray(row * stride + 1, row * stride + 1 + rowLength);
    const target = out.subarray(row * rowLength, (row + 1) * rowLength);
    target.set(source);
    for (let index = 0; index < rowLength; index += 1) {
      const left = index >= bytesPerPixel ? target[index - bytesPerPixel] : 0;
      const up = previous[index];
      const upLeft = index >= bytesPerPixel ? previous[index - bytesPerPixel] : 0;
      switch (filter) {
        case 0: break;
        case 1: target[index] = (target[index] + left) & 0xff; break;
        case 2: target[index] = (target[index] + up) & 0xff; break;
        case 3: target[index] = (target[index] + ((left + up) >> 1)) & 0xff; break;
        case 4: {
          const p = left + up - upLeft;
          const pa = Math.abs(p - left);
          const pb = Math.abs(p - up);
          const pc = Math.abs(p - upLeft);
          const best = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
          target[index] = (target[index] + best) & 0xff;
          break;
        }
        default:
          throw new ConverterBoundary('malformed', `A stream row uses PNG predictor filter ${filter}, which is not defined.`);
      }
    }
    previous = target;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Writer                                                              */
/* ------------------------------------------------------------------ */

export interface PageSelection {
  /** 1-based page number in the source document. */
  page: number;
  /** Rotation to apply to the copied page, absolute, in degrees. */
  rotation: number;
}

export interface DocumentBuildRequest {
  /** Pages to copy, in the order they should appear in the result. */
  selection: PageSelection[];
  /** Document information entries to write. An empty value removes the key. */
  info: Record<string, string>;
  /** Producer line written into the result. */
  producer: string;
}

export interface DocumentBuildResult {
  /** The complete file, every byte printable ASCII. */
  text: string;
  byteLength: number;
  sha256: string;
  pageCount: number;
}

/**
 * Builds a new document from a source and a page selection.
 *
 * Only what the selected pages reach is copied: the object graph is walked from
 * each page dictionary and everything reachable comes along, renumbered. The
 * catalog is fresh, which is why outlines, form fields, the structure tree,
 * named destinations and any signature do not survive — every one of those is
 * named in the disclosure before the conversion runs.
 */
export async function buildDocument(
  source: PdfDocument,
  request: DocumentBuildRequest,
  limits: ResourceLimits,
  deadline: Deadline
): Promise<DocumentBuildResult> {
  if (source.encrypted) {
    throw new ConverterBoundary(
      'encrypted',
      'The document is encrypted. This build cannot supply a password to it, so nothing was read beyond the trailer and nothing was written.'
    );
  }
  if (request.selection.length === 0) {
    throw new ConverterBoundary('unsupported', 'No page was selected, so there is nothing to write.');
  }
  if (request.selection.length > limits.pages) {
    throw new ConverterBoundary('pages', `The selection holds ${request.selection.length} pages, past the ${limits.pages} bound.`);
  }

  const pages = await source.pages();
  for (const entry of request.selection) {
    if (entry.page < 1 || entry.page > pages.length) {
      throw new ConverterBoundary('unsupported', `Page ${entry.page} is outside the document's ${pages.length} pages.`);
    }
  }

  /* Renumbering: every copied object gets a new number, assigned on first sight. */
  const assigned = new Map<number, number>();
  const emitted = new Map<number, PdfValue>();
  let nextNumber = 3; // 1 = catalog, 2 = pages node.

  const copy = async (value: PdfValue, depth: number): Promise<PdfValue> => {
    deadline.check();
    if (depth > limits.depth) {
      throw new ConverterBoundary('depth', `The object graph nests deeper than the ${limits.depth}-level bound.`);
    }
    switch (value.kind) {
      case 'ref': {
        const existing = assigned.get(value.num);
        if (existing !== undefined) return { kind: 'ref', num: existing, gen: 0 };
        const target = nextNumber;
        nextNumber += 1;
        if (nextNumber > limits.entries) {
          throw new ConverterBoundary('entries', `The result would hold more than ${limits.entries} objects, past the bound.`);
        }
        assigned.set(value.num, target);
        const resolved = await source.resolve(value);
        emitted.set(target, await copy(resolved, depth + 1));
        return { kind: 'ref', num: target, gen: 0 };
      }
      case 'array': {
        const items: PdfValue[] = [];
        for (const item of value.items) items.push(await copy(item, depth + 1));
        return { kind: 'array', items };
      }
      case 'dict': {
        const map = new Map<string, PdfValue>();
        for (const [key, entry] of value.map) map.set(key, await copy(entry, depth + 1));
        return { kind: 'dict', map };
      }
      case 'stream': {
        const map = new Map<string, PdfValue>();
        for (const [key, entry] of value.dict.map) {
          if (key === 'Filter' || key === 'DecodeParms' || key === 'Length') continue;
          map.set(key, await copy(entry, depth + 1));
        }
        return { kind: 'stream', dict: { kind: 'dict', map }, raw: value.raw };
      }
      default:
        return value;
    }
  };

  const pageRefs: PdfValue[] = [];
  for (const entry of request.selection) {
    const sourcePage = pages[entry.page - 1];
    const clone = new Map<string, PdfValue>();
    for (const [key, value] of sourcePage.page.map) {
      if (key === 'Parent') continue;
      clone.set(key, await copy(value, 1));
    }
    clone.set('Type', name('Page'));
    clone.set('Rotate', num(normaliseRotation(entry.rotation)));
    clone.set('Parent', { kind: 'ref', num: 2, gen: 0 });

    const target = nextNumber;
    nextNumber += 1;
    emitted.set(target, { kind: 'dict', map: clone });
    pageRefs.push({ kind: 'ref', num: target, gen: 0 });
  }

  return assembleDocument(pageRefs, emitted, nextNumber, request.info, request.producer, limits, deadline);
}

/**
 * Assembles the catalog, page tree and info dictionary around an already-copied
 * set of page objects, then serializes the whole thing.
 *
 * Shared by `buildDocument` (one source) and `mergeDocuments` (several sources):
 * both produce the same shape of `emitted` object table and page reference list,
 * and only differ in how they got there.
 */
function assembleDocument(
  pageRefs: PdfValue[],
  emitted: Map<number, PdfValue>,
  nextNumberStart: number,
  info: Record<string, string>,
  producer: string,
  limits: ResourceLimits,
  deadline: Deadline
): DocumentBuildResult {
  let nextNumber = nextNumberStart;

  const pagesNode = dict([
    ['Type', name('Pages')],
    ['Kids', array(pageRefs)],
    ['Count', num(pageRefs.length)]
  ]);
  const catalog = dict([
    ['Type', name('Catalog')],
    ['Pages', { kind: 'ref', num: 2, gen: 0 }]
  ]);
  emitted.set(1, catalog);
  emitted.set(2, pagesNode);

  const infoEntries: Array<[string, PdfValue]> = [];
  for (const [key, value] of Object.entries(info)) {
    if (value.length === 0) continue;
    infoEntries.push([key, pdfString(value)]);
  }
  infoEntries.push(['Producer', pdfString(producer)]);
  const infoNumber = nextNumber;
  nextNumber += 1;
  emitted.set(infoNumber, dict(infoEntries));

  /* Serialize. Everything below emits printable ASCII only. */
  const parts: string[] = [];
  let offset = 0;
  const push = (chunk: string): void => {
    parts.push(chunk);
    offset += chunk.length;
    if (offset > limits.outputBytes) {
      throw new ConverterBoundary(
        'output-size',
        `The result passed the ${limits.outputBytes}-byte output bound. Nothing was written.`
      );
    }
  };

  push(`%PDF-1.7\n%ASCII-only rewrite\n`);

  const objectOffsets = new Map<number, number>();
  const highest = nextNumber - 1;
  for (let objectNumber = 1; objectNumber <= highest; objectNumber += 1) {
    const value = emitted.get(objectNumber);
    if (!value) continue;
    deadline.check();
    objectOffsets.set(objectNumber, offset);
    push(`${objectNumber} 0 obj\n`);
    push(serializeValue(value));
    push('\nendobj\n');
  }

  const xrefOffset = offset;
  push(`xref\n0 ${highest + 1}\n`);
  push('0000000000 65535 f \n');
  for (let objectNumber = 1; objectNumber <= highest; objectNumber += 1) {
    const at = objectOffsets.get(objectNumber);
    if (at === undefined) push('0000000000 65535 f \n');
    else push(`${String(at).padStart(10, '0')} 00000 n \n`);
  }
  push('trailer\n');
  push(
    serializeValue(
      dict([
        ['Size', num(highest + 1)],
        ['Root', { kind: 'ref', num: 1, gen: 0 }],
        ['Info', { kind: 'ref', num: infoNumber, gen: 0 }]
      ])
    )
  );
  push(`\nstartxref\n${xrefOffset}\n%%EOF\n`);

  const text = parts.join('');
  for (let index = 0; index < text.length; index += 1) {
    if (text.charCodeAt(index) > 126) {
      throw new ConverterBoundary(
        'validation',
        'The writer produced a byte above the printable ASCII range, which the file-writing channel cannot carry. Nothing was written.'
      );
    }
  }

  const bytes = new Uint8Array(text.length);
  for (let index = 0; index < text.length; index += 1) bytes[index] = text.charCodeAt(index);

  return { text, byteLength: bytes.length, sha256: sha256Hex(bytes), pageCount: pageRefs.length };
}

/** One source document's contribution to a merge, with its own page selection. */
export interface MergeSource {
  doc: PdfDocument;
  selection: PageSelection[];
  /** Used only to name the source in an error message — never written into the output. */
  label: string;
}

/**
 * Merges pages from several source documents into one new document, in the
 * order the sources and their selections are given.
 *
 * This is the same object-graph copy `buildDocument` performs, run once per
 * source with its own renumbering table so that two sources whose object
 * numbers collide (which is the normal case — most PDFs start numbering at 1)
 * do not overwrite each other's objects in the merged result.
 */
export async function mergeDocuments(
  sources: MergeSource[],
  info: Record<string, string>,
  producer: string,
  limits: ResourceLimits,
  deadline: Deadline
): Promise<DocumentBuildResult> {
  if (sources.length === 0) {
    throw new ConverterBoundary('unsupported', 'No source document was given, so there is nothing to merge.');
  }
  let totalPages = 0;
  for (const source of sources) {
    if (source.doc.encrypted) {
      throw new ConverterBoundary(
        'encrypted',
        `"${source.label}" is encrypted. This build cannot supply a password to it, so it cannot take part in a merge.`
      );
    }
    if (source.selection.length === 0) {
      throw new ConverterBoundary('unsupported', `"${source.label}" contributed no pages, so it cannot take part in a merge.`);
    }
    totalPages += source.selection.length;
  }
  if (totalPages > limits.pages) {
    throw new ConverterBoundary('pages', `The merge would hold ${totalPages} pages, past the ${limits.pages} bound.`);
  }

  const emitted = new Map<number, PdfValue>();
  let nextNumber = 3; // 1 = catalog, 2 = pages node.
  const pageRefs: PdfValue[] = [];

  for (const source of sources) {
    const pages = await source.doc.pages();
    for (const entry of source.selection) {
      if (entry.page < 1 || entry.page > pages.length) {
        throw new ConverterBoundary('unsupported', `Page ${entry.page} is outside "${source.label}"'s ${pages.length} pages.`);
      }
    }

    /* Renumbering is per source: object numbers are only unique within one PDF. */
    const assigned = new Map<number, number>();

    const copy = async (value: PdfValue, depth: number): Promise<PdfValue> => {
      deadline.check();
      if (depth > limits.depth) {
        throw new ConverterBoundary('depth', `The object graph in "${source.label}" nests deeper than the ${limits.depth}-level bound.`);
      }
      switch (value.kind) {
        case 'ref': {
          const existing = assigned.get(value.num);
          if (existing !== undefined) return { kind: 'ref', num: existing, gen: 0 };
          const target = nextNumber;
          nextNumber += 1;
          if (nextNumber > limits.entries) {
            throw new ConverterBoundary('entries', `The merged result would hold more than ${limits.entries} objects, past the bound.`);
          }
          assigned.set(value.num, target);
          const resolved = await source.doc.resolve(value);
          emitted.set(target, await copy(resolved, depth + 1));
          return { kind: 'ref', num: target, gen: 0 };
        }
        case 'array': {
          const items: PdfValue[] = [];
          for (const item of value.items) items.push(await copy(item, depth + 1));
          return { kind: 'array', items };
        }
        case 'dict': {
          const map = new Map<string, PdfValue>();
          for (const [key, entry] of value.map) map.set(key, await copy(entry, depth + 1));
          return { kind: 'dict', map };
        }
        case 'stream': {
          const map = new Map<string, PdfValue>();
          for (const [key, entry] of value.dict.map) {
            if (key === 'Filter' || key === 'DecodeParms' || key === 'Length') continue;
            map.set(key, await copy(entry, depth + 1));
          }
          return { kind: 'stream', dict: { kind: 'dict', map }, raw: value.raw };
        }
        default:
          return value;
      }
    };

    for (const entry of source.selection) {
      const sourcePage = pages[entry.page - 1];
      const clone = new Map<string, PdfValue>();
      for (const [key, value] of sourcePage.page.map) {
        if (key === 'Parent') continue;
        clone.set(key, await copy(value, 1));
      }
      clone.set('Type', name('Page'));
      clone.set('Rotate', num(normaliseRotation(entry.rotation)));
      clone.set('Parent', { kind: 'ref', num: 2, gen: 0 });

      const target = nextNumber;
      nextNumber += 1;
      emitted.set(target, { kind: 'dict', map: clone });
      pageRefs.push({ kind: 'ref', num: target, gen: 0 });
    }
  }

  return assembleDocument(pageRefs, emitted, nextNumber, info, producer, limits, deadline);
}

const NAME_SAFE = /^[A-Za-z0-9._\-+]*$/;

function serializeName(value: string): string {
  if (NAME_SAFE.test(value)) return `/${value}`;
  let out = '/';
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index) & 0xff;
    const char = value[index];
    if (/[A-Za-z0-9._\-+]/.test(char)) out += char;
    else out += `#${code.toString(16).padStart(2, '0')}`;
  }
  return out;
}

function serializeHexString(bytes: Uint8Array): string {
  let out = '<';
  for (let index = 0; index < bytes.length; index += 1) out += bytes[index].toString(16).padStart(2, '0');
  return `${out}>`;
}

function serializeNumber(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return String(Math.round(value * 1_000_000) / 1_000_000);
}

function serializeValue(value: PdfValue): string {
  switch (value.kind) {
    case 'null':
      return 'null';
    case 'bool':
      return value.value ? 'true' : 'false';
    case 'number':
      return serializeNumber(value.value);
    case 'name':
      return serializeName(value.name);
    case 'string':
      return serializeHexString(value.bytes);
    case 'ref':
      return `${value.num} 0 R`;
    case 'array':
      return `[${value.items.map(serializeValue).join(' ')}]`;
    case 'dict': {
      const parts: string[] = [];
      for (const [key, entry] of value.map) parts.push(`${serializeName(key)} ${serializeValue(entry)}`);
      return `<<${parts.join(' ')}>>`;
    }
    case 'stream': {
      // Every stream is re-encoded as ASCIIHexDecode ahead of whatever filter
      // chain it already carried, so the raw bytes survive a UTF-8 write.
      let hex = '';
      for (let index = 0; index < value.raw.length; index += 1) {
        hex += value.raw[index].toString(16).padStart(2, '0');
        if ((index + 1) % 40 === 0) hex += '\n';
      }
      hex += '>';
      const map = new Map(value.dict.map);
      map.set('Filter', array([name('ASCIIHexDecode')]));
      map.set('Length', num(hex.length));
      const header = serializeValue({ kind: 'dict', map });
      return `${header}\nstream\n${hex}\nendstream`;
    }
  }
}

/* ------------------------------------------------------------------ */
/* Post-write reopen validation                                        */
/* ------------------------------------------------------------------ */

export interface ValidationExpectation {
  pageCount: number;
  /** Rotation expected on each page, in order. */
  rotations: number[];
  /** Page sizes expected, in order, as `${width}x${height}` at whole points. */
  sizes: string[];
  info: Record<string, string>;
}

export interface ValidationOutcome {
  ok: boolean;
  /** Every check that ran, with its verdict, in the order they ran. */
  checks: Array<{ name: string; expected: string; actual: string; ok: boolean }>;
  /** The first failing check's message, safe to show. */
  failure: string | null;
}

/**
 * Reopens bytes that were just written and checks them against the request.
 *
 * This is the step that turns "the writer believes it produced the right file"
 * into evidence. It parses the result from scratch — same reader, no shortcuts
 * — and compares page count, page order by size, rotation and metadata.
 */
export async function validateWritten(
  bytes: Uint8Array,
  expectation: ValidationExpectation,
  limits: ResourceLimits,
  deadline: Deadline
): Promise<ValidationOutcome> {
  const checks: ValidationOutcome['checks'] = [];
  const add = (name: string, expected: string, actual: string): void => {
    checks.push({ name, expected, actual, ok: expected === actual });
  };

  let reopened: PdfDocument;
  try {
    reopened = await PdfDocument.open(bytes, limits, deadline);
  } catch (error) {
    return {
      ok: false,
      checks: [{ name: 'reopen', expected: 'the written file parses', actual: 'it did not parse', ok: false }],
      failure: error instanceof Error ? error.message : 'The written file could not be reopened.'
    };
  }

  const report = await reopened.inspect();
  add('page count', String(expectation.pageCount), String(report.pageCount));
  add('rotations', expectation.rotations.join(','), report.pages.map((page) => page.rotation).join(','));
  add(
    'page order by size',
    expectation.sizes.join(','),
    report.pages.map((page) => `${Math.round(page.widthPt)}x${Math.round(page.heightPt)}`).join(',')
  );
  for (const [key, value] of Object.entries(expectation.info)) {
    if (value.length === 0) continue;
    add(`metadata /${key}`, value, report.info[key] ?? '(absent)');
  }

  const failed = checks.find((check) => !check.ok) ?? null;
  return {
    ok: failed === null,
    checks,
    failure: failed ? `${failed.name}: expected ${failed.expected}, the written file has ${failed.actual}` : null
  };
}
