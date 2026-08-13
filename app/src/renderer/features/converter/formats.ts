/**
 * The format vocabulary.
 *
 * A format is a thing a file can be. An adapter is a route from one format to
 * another. Keeping the two apart is what lets the catalog list a format that
 * has no working route as visible, disabled content naming exactly what is
 * missing, rather than quietly leaving it out of a dropdown.
 */

/** The eight catalog categories. Every adapter belongs to exactly one. */
export type CategoryId = 'documents' | 'images' | 'audio' | 'video' | 'archives' | 'data' | 'text' | 'encodings';

export const CATEGORY_IDS: CategoryId[] = [
  'documents',
  'images',
  'audio',
  'video',
  'archives',
  'data',
  'text',
  'encodings'
];

export interface CategorySpec {
  id: CategoryId;
  /** i18n key for the visible name. */
  labelKey: string;
  /** i18n key for the one-line explanation shown under the heading. */
  descriptionKey: string;
  icon: string;
}

export const CATEGORIES: Record<CategoryId, CategorySpec> = {
  documents: {
    id: 'documents',
    labelKey: 'converter.category.documents',
    descriptionKey: 'converter.category.documents.description',
    icon: 'file'
  },
  images: {
    id: 'images',
    labelKey: 'converter.category.images',
    descriptionKey: 'converter.category.images.description',
    icon: 'visibility'
  },
  audio: {
    id: 'audio',
    labelKey: 'converter.category.audio',
    descriptionKey: 'converter.category.audio.description',
    icon: 'bolt'
  },
  video: {
    id: 'video',
    labelKey: 'converter.category.video',
    descriptionKey: 'converter.category.video.description',
    icon: 'play'
  },
  archives: {
    id: 'archives',
    labelKey: 'converter.category.archives',
    descriptionKey: 'converter.category.archives.description',
    icon: 'folder'
  },
  data: {
    id: 'data',
    labelKey: 'converter.category.data',
    descriptionKey: 'converter.category.data.description',
    icon: 'sort'
  },
  text: {
    id: 'text',
    labelKey: 'converter.category.text',
    descriptionKey: 'converter.category.text.description',
    icon: 'code'
  },
  encodings: {
    id: 'encodings',
    labelKey: 'converter.category.encodings',
    descriptionKey: 'converter.category.encodings.description',
    icon: 'terminal'
  }
};

export interface FormatSpec {
  id: string;
  /** i18n key. Format names are facts and read the same at every humour level. */
  labelKey: string;
  category: CategoryId;
  /** Lowercase, no leading dot. The first is the one a save dialog suggests. */
  extensions: string[];
  /** True when the bytes are not meaningfully readable as text. */
  binary: boolean;
  /** Short i18n key describing what the format actually holds. */
  summaryKey: string;
}

function format(
  id: string,
  category: CategoryId,
  extensions: string[],
  binary: boolean
): FormatSpec {
  return {
    id,
    labelKey: `converter.format.${id}`,
    category,
    extensions,
    binary,
    summaryKey: `converter.format.${id}.summary`
  };
}

/**
 * Every format the catalog knows about, whether or not a route to it exists.
 *
 * A format with no enabled adapter is still listed; the catalog shows it
 * disabled with the exact missing piece beside it.
 */
export const FORMATS: FormatSpec[] = [
  /* Documents */
  format('pdf', 'documents', ['pdf'], true),
  format('pdfReport', 'documents', ['json'], false),
  format('pdfPages', 'documents', ['csv'], false),
  format('docx', 'documents', ['docx'], true),
  format('odt', 'documents', ['odt'], true),
  format('rtf', 'documents', ['rtf'], false),
  format('epub', 'documents', ['epub'], true),

  /* Images */
  format('png', 'images', ['png'], true),
  format('jpeg', 'images', ['jpg', 'jpeg'], true),
  format('gif', 'images', ['gif'], true),
  format('webp', 'images', ['webp'], true),
  format('bmp', 'images', ['bmp'], true),
  format('tiff', 'images', ['tif', 'tiff'], true),
  format('svg', 'images', ['svg'], false),
  format('ppm', 'images', ['ppm'], false),
  format('pgm', 'images', ['pgm'], false),
  format('imageReport', 'images', ['json'], false),
  format('ico', 'images', ['ico'], true),

  /* Audio */
  format('wav', 'audio', ['wav'], true),
  format('mp3', 'audio', ['mp3'], true),
  format('flac', 'audio', ['flac'], true),
  format('ogg', 'audio', ['ogg', 'oga'], true),
  format('audioReport', 'audio', ['json'], false),

  /* Video */
  format('mp4', 'video', ['mp4', 'm4v'], true),
  format('webm', 'video', ['webm'], true),
  format('mkv', 'video', ['mkv'], true),
  format('avi', 'video', ['avi'], true),
  format('videoReport', 'video', ['json'], false),

  /* Archives */
  format('zip', 'archives', ['zip'], true),
  format('gzip', 'archives', ['gz'], true),
  format('tar', 'archives', ['tar'], true),
  format('tgz', 'archives', ['tgz', 'tar.gz'], true),
  format('sevenZip', 'archives', ['7z'], true),
  format('archiveReport', 'archives', ['json'], false),
  format('archiveMember', 'archives', ['txt'], false),

  /* Structured data and spreadsheets */
  format('json', 'data', ['json'], false),
  format('jsonl', 'data', ['jsonl', 'ndjson'], false),
  format('csv', 'data', ['csv'], false),
  format('tsv', 'data', ['tsv'], false),
  format('yaml', 'data', ['yaml', 'yml'], false),
  format('toml', 'data', ['toml'], false),
  format('xml', 'data', ['xml'], false),
  format('sql', 'data', ['sql'], false),
  format('xlsx', 'data', ['xlsx'], true),
  format('ods', 'data', ['ods'], true),
  format('parquet', 'data', ['parquet'], true),

  /* Code and text */
  format('text', 'text', ['txt'], false),
  format('markdown', 'text', ['md'], false),
  format('html', 'text', ['html', 'htm'], false),
  format('textLf', 'text', ['txt'], false),
  format('textCrlf', 'text', ['txt'], false),
  format('textCr', 'text', ['txt'], false),
  format('textTabs', 'text', ['txt'], false),
  format('textSpaces', 'text', ['txt'], false),
  format('textBom', 'text', ['txt'], false),
  format('textNoBom', 'text', ['txt'], false),
  format('jsonPretty', 'text', ['json'], false),
  format('jsonMinified', 'text', ['json'], false),
  format('latin1', 'text', ['txt'], true),
  format('utf16', 'text', ['txt'], true),

  /* Binary encodings */
  format('base64', 'encodings', ['base64', 'txt'], false),
  format('base32', 'encodings', ['base32', 'txt'], false),
  format('hex', 'encodings', ['hex', 'txt'], false),
  format('dataUri', 'encodings', ['txt'], false),
  format('binary', 'encodings', ['bin'], true),
  format('uuencode', 'encodings', ['uu'], false),
  format('quotedPrintable', 'encodings', ['qp', 'txt'], false)
];

const FORMAT_INDEX = new Map(FORMATS.map((entry) => [entry.id, entry]));

/** Looks a format up by id. Returns null rather than throwing on an unknown id. */
export function formatById(id: string): FormatSpec | null {
  return FORMAT_INDEX.get(id) ?? null;
}

/** Every format in one category, in declaration order. */
export function formatsInCategory(category: CategoryId): FormatSpec[] {
  return FORMATS.filter((entry) => entry.category === category);
}

/** The lowercase extension of a path, without the dot. Empty when there is none. */
export function extensionOf(path: string): string {
  const name = path.replace(/\\/g, '/').split('/').pop() ?? '';
  const dot = name.lastIndexOf('.');
  if (dot <= 0 || dot === name.length - 1) return '';
  return name.slice(dot + 1).toLowerCase();
}

/** The file name of a path, without any directory part. */
export function baseName(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  return normalized.split('/').pop() ?? normalized;
}

/** The file name of a path with its extension removed. */
export function stemOf(path: string): string {
  const name = baseName(path);
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(0, dot) : name;
}

/** The directory part of a path, with the platform separator preserved. */
export function directoryOf(path: string): string {
  const backslash = path.lastIndexOf('\\');
  const slash = path.lastIndexOf('/');
  const cut = Math.max(backslash, slash);
  return cut > 0 ? path.slice(0, cut) : path;
}

/** Joins a directory and a file name with the separator the directory already uses. */
export function joinPath(directory: string, name: string): string {
  if (directory.length === 0) return name;
  const separator = directory.includes('\\') && !directory.includes('/') ? '\\' : '/';
  const trimmed = directory.endsWith('/') || directory.endsWith('\\') ? directory.slice(0, -1) : directory;
  return `${trimmed}${separator}${name}`;
}

/** Every format whose declared extensions include `extension`. */
export function formatsForExtension(extension: string): FormatSpec[] {
  const lower = extension.toLowerCase();
  return FORMATS.filter((entry) => entry.extensions.includes(lower));
}
