/**
 * The personal-vocabulary file contract.
 *
 * ONE documented, versioned, bounded schema, validated over the COMPLETE byte
 * payload before anything is displayed, applied or cached. A file that fails any
 * check is refused whole: nothing is applied partially, and whatever was loaded
 * before stays exactly as it was.
 *
 * Nothing in this file, in the documentation it points at, or in any test is a
 * real vocabulary value. The schema, the limits and the blank template are
 * generic and public; the mappings are the user's own and exist only in a file
 * the user chose and in this application's private local cache.
 *
 * Error messages are written to be actionable WITHOUT quoting content. A
 * rejection names the rule, the limit and the position — never a key, never a
 * value, never a field name that could carry one, and never the file's path.
 * A rejection reason is user-facing copy and a history label at the same time,
 * so a reason that quoted content would leak it into a durable record.
 */

/* ------------------------------------------------------------------ */
/* The contract                                                        */
/* ------------------------------------------------------------------ */

export const VOCABULARY_CONTRACT = {
  /** Name of the schema, stated in the documentation and the blank template. */
  schemaName: 'personal-vocabulary',
  /** Versions this build understands. An unknown version is refused. */
  supportedVersions: [1] as readonly number[],
  /** The version a blank template is written with. */
  currentVersion: 1,
  /** Hard ceiling on the complete payload, measured in UTF-8 bytes. */
  maxBytes: 256 * 1024,
  /** Maximum replacement entries in one file. */
  maxEntries: 2000,
  /** Maximum characters in one replacement key (the text being replaced). */
  maxKeyLength: 120,
  /** Maximum characters in one replacement value (the text put in its place). */
  maxValueLength: 200,
  /**
   * Maximum JSON nesting depth. A valid document is exactly two levels deep —
   * the root object and the `replacements` object — so this is both the schema
   * rule and the guard that keeps a hostile file from reaching the parser with
   * thousands of open brackets.
   */
  maxDepth: 2,
  /** The only fields a document may carry. Anything else is refused. */
  allowedFields: ['version', 'replacements'] as readonly string[],
  /** Object keys that are never accepted as a replacement key. */
  reservedKeys: ['__proto__', 'constructor', 'prototype'] as readonly string[]
} as const;

/* ------------------------------------------------------------------ */
/* Result types                                                        */
/* ------------------------------------------------------------------ */

export interface VocabularyEntry {
  /** The text to look for in user-facing copy. */
  from: string;
  /** The text rendered in its place. May be empty, which removes the word. */
  to: string;
}

export interface VocabularyDocument {
  version: number;
  entries: VocabularyEntry[];
}

/**
 * Stable machine-readable reason a file was refused.
 *
 * The code is what goes into the local history, because it carries no fragment
 * of the file: it says which rule was broken and nothing about the content that
 * broke it.
 */
export type RejectionCode =
  | 'not-text'
  | 'empty-file'
  | 'byte-limit'
  | 'depth-limit'
  | 'duplicate-key'
  | 'malformed-json'
  | 'not-an-object'
  | 'missing-version'
  | 'unsupported-version'
  | 'unknown-field'
  | 'missing-replacements'
  | 'replacements-not-an-object'
  | 'entry-limit'
  | 'reserved-key'
  | 'empty-key'
  | 'whitespace-key'
  | 'key-length'
  | 'value-not-a-string'
  | 'value-length';

export interface VocabularyRejection {
  code: RejectionCode;
  /** Actionable English sentence. Never quotes a key, a value or a path. */
  message: string;
}

export type VocabularyValidation =
  | { ok: true; document: VocabularyDocument; bytes: number }
  | { ok: false; rejection: VocabularyRejection };

function reject(code: RejectionCode, message: string): { ok: false; rejection: VocabularyRejection } {
  return { ok: false, rejection: { code, message } };
}

/* ------------------------------------------------------------------ */
/* Raw structural scan                                                 */
/* ------------------------------------------------------------------ */

/**
 * Walks the raw text before `JSON.parse` sees it.
 *
 * Two rules can only be enforced here. Nesting depth has to be bounded BEFORE a
 * parser recurses through it, and duplicate member names are invisible
 * afterwards: `JSON.parse` keeps the last of two identical keys and silently
 * discards the first, so a document that says two different things about one
 * word would be accepted as though it had only ever said the second.
 *
 * The scan is deliberately tolerant about everything else. Malformed input is
 * `JSON.parse`'s job to report; this pass only fails on the two rules it exists
 * for, so a syntax error never arrives dressed up as a depth violation.
 */
function scanRawStructure(text: string): { ok: true } | { ok: false; rejection: VocabularyRejection } {
  const frames: Array<{ isObject: boolean; keys: Set<string> }> = [];
  let pendingString: string | null = null;
  let index = 0;
  const length = text.length;

  while (index < length) {
    const character = text[index];

    if (character === '"') {
      const start = index;
      index += 1;
      while (index < length) {
        const inner = text[index];
        if (inner === '\\') {
          index += 2;
          continue;
        }
        index += 1;
        if (inner === '"') break;
      }
      const literal = text.slice(start, index);
      try {
        const decoded: unknown = JSON.parse(literal);
        pendingString = typeof decoded === 'string' ? decoded : null;
      } catch {
        // An unterminated or invalid string literal is a syntax error, and
        // JSON.parse will say so precisely. Nothing to add here.
        pendingString = null;
      }
      continue;
    }

    if (character === '{' || character === '[') {
      frames.push({ isObject: character === '{', keys: new Set<string>() });
      if (frames.length > VOCABULARY_CONTRACT.maxDepth) {
        return reject(
          'depth-limit',
          `The document nests more than ${VOCABULARY_CONTRACT.maxDepth} levels deep. A vocabulary file is exactly two levels: the document itself, and the "replacements" object inside it. Nothing was applied.`
        );
      }
      pendingString = null;
      index += 1;
      continue;
    }

    if (character === '}' || character === ']') {
      frames.pop();
      pendingString = null;
      index += 1;
      continue;
    }

    if (character === ':') {
      const frame = frames[frames.length - 1];
      if (frame && frame.isObject && pendingString !== null) {
        if (frame.keys.has(pendingString)) {
          return reject(
            'duplicate-key',
            `Two members of the same object share one name, at member ${frame.keys.size + 1}. JSON keeps only the last of them, so the file does not mean what it looks like it means. Nothing was applied.`
          );
        }
        frame.keys.add(pendingString);
      }
      pendingString = null;
      index += 1;
      continue;
    }

    if (character === ',') {
      pendingString = null;
      index += 1;
      continue;
    }

    index += 1;
  }

  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

/** True when the string is empty or contains nothing but whitespace. */
function isBlank(value: string): boolean {
  return value.trim().length === 0;
}

/**
 * Validates one complete payload.
 *
 * Every check runs against the whole file before a single replacement is
 * accepted, so a file that is good for four hundred entries and wrong on the
 * four hundred and first applies none of them.
 */
export function validateVocabularyPayload(payload: unknown): VocabularyValidation {
  if (typeof payload !== 'string') {
    return reject('not-text', 'The file could not be read as text. Nothing was applied.');
  }

  const bytes = new TextEncoder().encode(payload).byteLength;
  if (bytes > VOCABULARY_CONTRACT.maxBytes) {
    return reject(
      'byte-limit',
      `The file is ${bytes} bytes. The limit is ${VOCABULARY_CONTRACT.maxBytes} bytes. Nothing was applied.`
    );
  }
  if (payload.trim().length === 0) {
    return reject('empty-file', 'The file is empty. Nothing was applied.');
  }

  // A byte-order mark is legal in a file and illegal to JSON.parse, which would
  // otherwise report a puzzling syntax error at position 0.
  const text = payload.charCodeAt(0) === 0xfeff ? payload.slice(1) : payload;

  const scan = scanRawStructure(text);
  if (!scan.ok) return scan;

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    const detail = error instanceof SyntaxError ? error.message : 'the parser refused it';
    return reject('malformed-json', `The file is not valid JSON: ${detail}. Nothing was applied.`);
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return reject('not-an-object', 'The top level of the file must be a JSON object. Nothing was applied.');
  }

  const document = parsed as Record<string, unknown>;

  for (const field of Object.keys(document)) {
    if (!VOCABULARY_CONTRACT.allowedFields.includes(field)) {
      return reject(
        'unknown-field',
        `The document carries a field that is not part of the schema. Only ${VOCABULARY_CONTRACT.allowedFields
          .map((name) => `"${name}"`)
          .join(' and ')} are accepted. Nothing was applied.`
      );
    }
  }

  if (!('version' in document)) {
    return reject('missing-version', 'The document has no "version" field. Nothing was applied.');
  }
  const version = document.version;
  if (typeof version !== 'number' || !Number.isInteger(version)) {
    return reject('unsupported-version', 'The "version" field must be a whole number. Nothing was applied.');
  }
  if (!VOCABULARY_CONTRACT.supportedVersions.includes(version)) {
    return reject(
      'unsupported-version',
      `This build understands schema version ${VOCABULARY_CONTRACT.supportedVersions.join(', ')}. The file declares version ${version}. Nothing was applied.`
    );
  }

  if (!('replacements' in document)) {
    return reject('missing-replacements', 'The document has no "replacements" field. Nothing was applied.');
  }
  const replacements = document.replacements;
  if (typeof replacements !== 'object' || replacements === null || Array.isArray(replacements)) {
    return reject(
      'replacements-not-an-object',
      'The "replacements" field must be a JSON object whose members are all text. Nothing was applied.'
    );
  }

  const raw = Object.entries(replacements as Record<string, unknown>);
  if (raw.length > VOCABULARY_CONTRACT.maxEntries) {
    return reject(
      'entry-limit',
      `The file holds ${raw.length} replacements. The limit is ${VOCABULARY_CONTRACT.maxEntries}. Nothing was applied.`
    );
  }

  const entries: VocabularyEntry[] = [];
  for (let position = 0; position < raw.length; position += 1) {
    const [key, value] = raw[position];
    const ordinal = position + 1;

    if (VOCABULARY_CONTRACT.reservedKeys.includes(key)) {
      return reject(
        'reserved-key',
        `Replacement ${ordinal} uses an object key JavaScript reserves for itself. Nothing was applied.`
      );
    }
    if (key.length === 0) {
      return reject('empty-key', `Replacement ${ordinal} has an empty key. Nothing was applied.`);
    }
    if (isBlank(key)) {
      return reject(
        'whitespace-key',
        `Replacement ${ordinal} has a key made only of whitespace, which would rewrite every space in the application. Nothing was applied.`
      );
    }
    if (key.length > VOCABULARY_CONTRACT.maxKeyLength) {
      return reject(
        'key-length',
        `Replacement ${ordinal} has a key of ${key.length} characters. The limit is ${VOCABULARY_CONTRACT.maxKeyLength}. Nothing was applied.`
      );
    }
    if (typeof value !== 'string') {
      return reject(
        'value-not-a-string',
        `Replacement ${ordinal} has a value that is not text. Every replacement value must be a JSON string. Nothing was applied.`
      );
    }
    if (value.length > VOCABULARY_CONTRACT.maxValueLength) {
      return reject(
        'value-length',
        `Replacement ${ordinal} has a value of ${value.length} characters. The limit is ${VOCABULARY_CONTRACT.maxValueLength}. Nothing was applied.`
      );
    }

    entries.push({ from: key, to: value });
  }

  return { ok: true, document: { version, entries }, bytes };
}

/* ------------------------------------------------------------------ */
/* Serialization                                                       */
/* ------------------------------------------------------------------ */

/**
 * Renders entries back into a document in the same schema.
 *
 * This is how an active set reaches the shared language layer: the layer takes a
 * complete payload and validates it again on its own terms, so the set that ends
 * up applied has passed validation twice and by two independent implementations.
 */
export function serializeDocument(
  entries: VocabularyEntry[],
  version: number = VOCABULARY_CONTRACT.currentVersion
): string {
  const replacements: Record<string, string> = {};
  for (const entry of entries) replacements[entry.from] = entry.to;
  return JSON.stringify({ version, replacements }, null, 2);
}

/**
 * A blank template: the schema shape with no replacements in it.
 *
 * This is not a sample vocabulary and never becomes one. It ships zero mappings,
 * so saving it and loading it back leaves every surface reading exactly the
 * wording this build shipped with.
 */
export function blankTemplate(): string {
  return `${JSON.stringify({ version: VOCABULARY_CONTRACT.currentVersion, replacements: {} }, null, 2)}\n`;
}

/** The example document shown in the in-application schema reference. */
export function exampleDocument(): string {
  return blankTemplate();
}

/**
 * Longest key first.
 *
 * Replacement is applied in this order so a longer phrase is never broken apart
 * by a shorter key that happens to sit inside it.
 */
export function inApplicationOrder(entries: VocabularyEntry[]): VocabularyEntry[] {
  return [...entries].sort((a, b) => b.from.length - a.from.length || a.from.localeCompare(b.from));
}
