import type { Catalogue, FunnyLadder, TranslationEntry } from '../../core/registry';
import { CATEGORY_IDS, FORMATS } from './formats';

/**
 * Every piece of copy this feature renders, in English and in playful Hong Kong
 * Cantonese, at all five humour levels.
 *
 * Two kinds of copy live here, and they are deliberately treated differently:
 *
 * - **Chrome** — tab titles, button labels, headings, empty states, dialogs,
 *   confirmations and notifications. These get a real five-rung ladder in each
 *   language; the voice changes with the level, the facts never do.
 * - **Vocabulary** — format names, category names, the technical explanation of
 *   what a route does, what it can lose, how its output is checked. These are
 *   facts about the software, not personality copy, so (as `formats.ts` already
 *   says of format names) they read the same at every level. `fact()` writes
 *   the same string into all five rungs of both languages, which is the honest
 *   representation of "this does not change" rather than an omission.
 */

function ladder(...steps: string[]): FunnyLadder {
  if (steps.length === 5) return steps as unknown as FunnyLadder;
  if (steps.length === 1) return [steps[0], steps[0], steps[0], steps[0], steps[0]];
  if (steps.length === 2) return [steps[0], steps[0], steps[0], steps[1], steps[1]];
  if (steps.length === 3) return [steps[0], steps[0], steps[1], steps[2], steps[2]];
  if (steps.length === 4) return [steps[0], steps[1], steps[2], steps[3], steps[3]];
  throw new Error(`A ladder takes 1, 2, 3, 4 or 5 strings; ${steps.length} were given.`);
}

function entry(en: FunnyLadder, yue: FunnyLadder): TranslationEntry {
  return { en, yue };
}

/** A fact: identical wording at every humour level, in both languages. */
function fact(en: string, yue: string): TranslationEntry {
  return entry(ladder(en), ladder(yue));
}

function build(pairs: Array<[string, string, string]>): Catalogue {
  const out: Catalogue = {};
  for (const [key, en, yue] of pairs) out[key] = fact(en, yue);
  return out;
}

/* ------------------------------------------------------------------ */
/* Formats — generated from the format table itself, so a format added */
/* to formats.ts cannot silently ship without a name in both languages */
/* ------------------------------------------------------------------ */

const FORMAT_TEXT: Record<string, { en: string; yue: string }> = {
  pdf: { en: 'PDF document', yue: 'PDF 文件' },
  pdfReport: { en: 'PDF inspection report (JSON)', yue: 'PDF 檢查報告（JSON）' },
  pdfPages: { en: 'PDF page inventory (CSV)', yue: 'PDF 頁面清單（CSV）' },
  docx: { en: 'Word document (DOCX)', yue: 'Word 文件（DOCX）' },
  odt: { en: 'OpenDocument text (ODT)', yue: 'OpenDocument 文字文件（ODT）' },
  rtf: { en: 'Rich Text Format (RTF)', yue: 'RTF 格式文件' },
  epub: { en: 'EPUB e-book', yue: 'EPUB 電子書' },
  png: { en: 'PNG image', yue: 'PNG 圖片' },
  jpeg: { en: 'JPEG image', yue: 'JPEG 圖片' },
  gif: { en: 'GIF image', yue: 'GIF 圖片' },
  webp: { en: 'WebP image', yue: 'WebP 圖片' },
  bmp: { en: 'Bitmap image (BMP)', yue: '點陣圖（BMP）' },
  tiff: { en: 'TIFF image', yue: 'TIFF 圖片' },
  svg: { en: 'SVG vector image', yue: 'SVG 向量圖' },
  ppm: { en: 'Portable Pixmap (PPM)', yue: 'Portable Pixmap（PPM）' },
  pgm: { en: 'Portable Graymap (PGM)', yue: 'Portable Graymap（PGM）' },
  imageReport: { en: 'Image inspection report (JSON)', yue: '圖片檢查報告（JSON）' },
  ico: { en: 'Windows icon (ICO)', yue: 'Windows 圖示（ICO）' },
  wav: { en: 'WAV audio', yue: 'WAV 音效' },
  mp3: { en: 'MP3 audio', yue: 'MP3 音效' },
  flac: { en: 'FLAC audio', yue: 'FLAC 音效' },
  ogg: { en: 'Ogg audio', yue: 'Ogg 音效' },
  audioReport: { en: 'Audio inspection report (JSON)', yue: '音效檢查報告（JSON）' },
  mp4: { en: 'MP4 video', yue: 'MP4 影片' },
  webm: { en: 'WebM video', yue: 'WebM 影片' },
  mkv: { en: 'Matroska video (MKV)', yue: 'Matroska 影片（MKV）' },
  avi: { en: 'AVI video', yue: 'AVI 影片' },
  videoReport: { en: 'Video inspection report (JSON)', yue: '影片檢查報告（JSON）' },
  zip: { en: 'ZIP archive', yue: 'ZIP 壓縮檔' },
  gzip: { en: 'Gzip archive', yue: 'Gzip 壓縮檔' },
  tar: { en: 'Tar archive', yue: 'Tar 封裝檔' },
  tgz: { en: 'Gzipped tar archive (.tar.gz)', yue: 'Gzip 壓縮嘅 tar 檔（.tar.gz）' },
  sevenZip: { en: '7-Zip archive', yue: '7-Zip 壓縮檔' },
  archiveReport: { en: 'Archive inventory report (JSON)', yue: '壓縮檔清單報告（JSON）' },
  archiveMember: { en: 'Extracted archive member (text)', yue: '解壓出嚟嘅成員（文字）' },
  json: { en: 'JSON document', yue: 'JSON 文件' },
  jsonl: { en: 'JSON Lines', yue: 'JSON Lines' },
  csv: { en: 'Comma-separated values (CSV)', yue: '逗號分隔值（CSV）' },
  tsv: { en: 'Tab-separated values (TSV)', yue: 'Tab 分隔值（TSV）' },
  yaml: { en: 'YAML document', yue: 'YAML 文件' },
  toml: { en: 'TOML document', yue: 'TOML 文件' },
  xml: { en: 'XML document', yue: 'XML 文件' },
  sql: { en: 'SQL insert statements', yue: 'SQL insert 語句' },
  xlsx: { en: 'Excel workbook (XLSX)', yue: 'Excel 工作簿（XLSX）' },
  ods: { en: 'OpenDocument spreadsheet (ODS)', yue: 'OpenDocument 試算表（ODS）' },
  parquet: { en: 'Apache Parquet', yue: 'Apache Parquet' },
  text: { en: 'Plain text', yue: '純文字' },
  markdown: { en: 'Markdown', yue: 'Markdown' },
  html: { en: 'HTML document', yue: 'HTML 文件' },
  textLf: { en: 'Plain text (LF line endings)', yue: '純文字（LF 換行）' },
  textCrlf: { en: 'Plain text (CRLF line endings)', yue: '純文字（CRLF 換行）' },
  textCr: { en: 'Plain text (CR line endings)', yue: '純文字（CR 換行）' },
  textTabs: { en: 'Plain text (tab indentation)', yue: '純文字（Tab 縮排）' },
  textSpaces: { en: 'Plain text (space indentation)', yue: '純文字（空格縮排）' },
  textBom: { en: 'Plain text with a byte-order mark', yue: '帶位元組順序記號嘅純文字' },
  textNoBom: { en: 'Plain text without a byte-order mark', yue: '冇位元組順序記號嘅純文字' },
  jsonPretty: { en: 'JSON, pretty-printed', yue: 'JSON（整齊排版）' },
  jsonMinified: { en: 'JSON, minified', yue: 'JSON（精簡版）' },
  latin1: { en: 'Latin-1 encoded text', yue: 'Latin-1 編碼文字' },
  utf16: { en: 'UTF-16 encoded text', yue: 'UTF-16 編碼文字' },
  base64: { en: 'Base64 text', yue: 'Base64 文字' },
  base32: { en: 'Base32 text', yue: 'Base32 文字' },
  hex: { en: 'Hexadecimal text', yue: '十六進制文字' },
  dataUri: { en: 'Data URI', yue: 'Data URI' },
  binary: { en: 'Raw binary', yue: '原始二進制' },
  uuencode: { en: 'Uuencoded text', yue: 'Uuencode 文字' },
  quotedPrintable: { en: 'Quoted-printable text', yue: 'Quoted-printable 文字' }
};

const CATEGORY_CLAUSE: Record<string, { en: string; yue: string }> = {
  documents: {
    en: 'a document format the converter reads or writes with its document tools.',
    yue: '轉換工具用文件工具讀寫嘅其中一種文件格式。'
  },
  images: {
    en: 'an image format the converter can inspect or convert between.',
    yue: '轉換工具識得檢查或者互相轉換嘅圖片格式。'
  },
  audio: { en: 'an audio container the converter can inspect.', yue: '轉換工具識得檢查嘅音效容器格式。' },
  video: { en: 'a video container the converter can inspect.', yue: '轉換工具識得檢查嘅影片容器格式。' },
  archives: {
    en: 'an archive format the converter can list or extract from.',
    yue: '轉換工具識得列出成員或者解壓嘅封裝格式。'
  },
  data: {
    en: "a structured-data format the converter's record tools read or write.",
    yue: '轉換工具嘅記錄工具讀寫嘅結構化資料格式。'
  },
  text: { en: "a plain-text variant the converter's text tools produce.", yue: '轉換工具嘅文字工具識得產生嘅純文字變體。' },
  encodings: {
    en: 'a byte-to-text encoding the converter can encode or decode.',
    yue: '轉換工具識得編碼或者解碼嘅位元組轉文字編碼。'
  }
};

function formatStrings(): Catalogue {
  const out: Catalogue = {};
  for (const spec of FORMATS) {
    const text = FORMAT_TEXT[spec.id];
    if (!text) throw new Error(`converter: format "${spec.id}" has no name text in strings.ts.`);
    const clause = CATEGORY_CLAUSE[spec.category];
    out[spec.labelKey] = fact(text.en, text.yue);
    out[spec.summaryKey] = fact(`${text.en} — ${clause.en}`, `${text.yue}——${clause.yue}`);
  }
  return out;
}

const CATEGORY_TEXT: Record<string, { en: string; yue: string; enDesc: string; yueDesc: string }> = {
  documents: {
    en: 'Documents / PDF',
    yue: '文件／PDF',
    enDesc: 'PDF inspection, page tools and plain-text extraction from office documents.',
    yueDesc: 'PDF 檢查、頁面工具，同埋由辦公室文件攞出純文字。'
  },
  images: {
    en: 'Images',
    yue: '圖片',
    enDesc: 'Raster decoding, pixel-report inspection and text-safe raster and vector encodings.',
    yueDesc: '點陣解碼、像素報告檢查，同埋文字安全嘅點陣同向量編碼。'
  },
  audio: {
    en: 'Audio',
    yue: '音效',
    enDesc: 'Container-header inspection for common audio formats. No audio is decoded or re-encoded.',
    yueDesc: '常見音效格式嘅容器標頭檢查。唔會解碼或者重新編碼音效本身。'
  },
  video: {
    en: 'Video',
    yue: '影片',
    enDesc: 'Container-header inspection for common video formats. No video is decoded or re-encoded.',
    yueDesc: '常見影片格式嘅容器標頭檢查。唔會解碼或者重新編碼影片本身。'
  },
  archives: {
    en: 'Archives',
    yue: '壓縮檔',
    enDesc: 'Listing, member extraction and creation for ZIP, gzip and tar-family archives.',
    yueDesc: 'ZIP、gzip 同 tar 家族壓縮檔嘅清單、成員解壓，同埋建立。'
  },
  data: {
    en: 'Structured data / spreadsheets',
    yue: '結構化資料／試算表',
    enDesc: 'Records read from JSON, JSON Lines, CSV or TSV and re-serialized in another structured format.',
    yueDesc: '由 JSON、JSON Lines、CSV 或者 TSV 讀出記錄，再用另一種結構化格式輸出。'
  },
  text: {
    en: 'Code / text',
    yue: '程式碼／文字',
    enDesc: 'Line-ending, indentation, byte-order-mark and JSON-formatting conversions for plain text.',
    yueDesc: '純文字嘅換行方式、縮排、位元組順序記號同 JSON 排版轉換。'
  },
  encodings: {
    en: 'Binary encodings',
    yue: '二進制編碼',
    enDesc: 'Text-safe encodings and decodings of raw bytes: Base64, Base32, hex, data URIs and more.',
    yueDesc: '將原始位元組編碼或者解碼做文字安全嘅格式：Base64、Base32、十六進制、data URI 等等。'
  }
};

function categoryStrings(): Catalogue {
  const out: Catalogue = {};
  for (const id of CATEGORY_IDS) {
    const text = CATEGORY_TEXT[id];
    if (!text) throw new Error(`converter: category "${id}" has no name text in strings.ts.`);
    out[`converter.category.${id}`] = fact(text.en, text.yue);
    out[`converter.category.${id}.description`] = fact(text.enDesc, text.yueDesc);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Adapter vocabulary — every key adapters.ts references              */
/* ------------------------------------------------------------------ */

const DETAIL = build([
  ['converter.detail.archiveCreate', 'Packs a list of entries into a fresh archive of the target format.', '將一堆項目打包成目標格式嘅新壓縮檔。'],
  [
    'converter.detail.archiveInspect',
    "Reads an archive's central directory and lists every member without extracting them.",
    '讀壓縮檔嘅目錄索引，列出每一個成員，唔會解壓。'
  ],
  ['converter.detail.archiveList', 'Lists archive members as a flat table.', '將壓縮檔嘅成員列成一個表。'],
  ['converter.detail.archiveMember', 'Extracts one named member from the archive as text.', '由壓縮檔入面解出一個指定成員，變成文字。'],
  ['converter.detail.bom', 'Adds or removes a leading byte-order mark.', '加返或者拆走開頭嗰個位元組順序記號。'],
  ['converter.detail.dataUri', 'Wraps the bytes as a data: URI with the right MIME type.', '將啲位元組包成有正確 MIME 類型嘅 data: URI。'],
  ['converter.detail.decode', 'Decodes text in this encoding back into raw bytes.', '將呢種編碼嘅文字解返做原始位元組。'],
  ['converter.detail.encode', 'Encodes raw bytes as text in this encoding.', '將原始位元組編碼做呢種格式嘅文字。'],
  ['converter.detail.encoding', 'Re-encodes text between character encodings.', '喺唔同字元編碼之間轉字。'],
  ['converter.detail.gzip', "Reads a gzip member's header and decompresses it.", '讀 gzip 成員嘅標頭並且解壓。'],
  [
    'converter.detail.imageInspect',
    'Decodes the image and reports its dimensions, colour depth and channels.',
    '解碼張圖，講返尺寸、色深同色版。'
  ],
  ['converter.detail.indentation', "Converts a text file's indentation between tabs and spaces.", '將文字檔嘅縮排喺 Tab 同空格之間轉換。'],
  ['converter.detail.jsonReformat', 'Re-serializes a JSON document, pretty-printed or minified.', '將 JSON 文件重新排版，整齊版或者精簡版都得。'],
  ['converter.detail.lineEndings', "Converts a text file's line endings.", '轉換文字檔嘅換行方式。'],
  ['converter.detail.markdownHtml', 'Renders Markdown to a self-contained HTML document.', '將 Markdown render 做一個獨立嘅 HTML 文件。'],
  [
    'converter.detail.mediaInspect',
    'Reads the container header and reports duration, codecs and stream layout, without decoding audio or video.',
    '讀容器標頭，講返長度、編碼格式同串流結構，唔會解碼音效或者影片本身。'
  ],
  ['converter.detail.netpbm', 'Decodes a raster image and writes it as a plain Netpbm sample file.', '解碼一張點陣圖，寫成純文字嘅 Netpbm 樣本檔。'],
  ['converter.detail.officeLayout', "Extracts layout metadata from an office document's XML.", '由辦公室文件嘅 XML 入面攞出排版中繼資料。'],
  [
    'converter.detail.officeText',
    "Reads the paragraphs out of an office document's XML and joins them as plain text.",
    '由辦公室文件嘅 XML 入面讀出段落，砌返做純文字。'
  ],
  ['converter.detail.pdfExtract', 'Copies a chosen page range into a fresh document, with an optional rotation.', '將指定頁數範圍複製去一份新文件，可以順便旋轉。'],
  ['converter.detail.pdfInspect', 'Reads the cross-reference table and every page dictionary, without changing anything.', '讀交叉參照表同每一頁嘅字典，乜都唔會改。'],
  [
    'converter.detail.pdfMerge',
    'Copies pages from several source documents into one new document, in the order given.',
    '將幾份來源文件嘅頁面，按指定次序複製埋一份新文件。'
  ],
  ['converter.detail.pdfMetadata', 'Rewrites the document information dictionary with the given values.', '用指定嘅值重寫文件嘅資訊字典。'],
  ['converter.detail.pdfPages', "Lists every page's size, rotation and content-stream count as a table.", '將每一頁嘅大小、旋轉角度同內容串流數量列成一個表。'],
  ['converter.detail.pdfReorder', 'Copies pages into a new document in a chosen order.', '將啲頁按指定次序複製去一份新文件。'],
  ['converter.detail.pdfRotate', 'Copies every page into a new document with a chosen rotation applied.', '將每一頁複製去一份新文件，套用指定嘅旋轉角度。'],
  ['converter.detail.pdfSplit', 'Copies pages into several new documents, one per chosen group.', '將啲頁按分組複製成幾份新文件，一組一份。'],
  ['converter.detail.rasterBinary', 'Decodes a raster image so its pixel report can be inspected.', '解碼點陣圖，等使用者可以睇返啲像素報告。'],
  [
    'converter.detail.records',
    'Reads rows from a structured-data source and re-serializes them in another structured format.',
    '由結構化資料嚟源讀出行，再用另一種結構化格式重新輸出。'
  ],
  ['converter.detail.svgWrap', 'Wraps the source as a valid, self-contained SVG document.', '將來源包成一份完整、獨立嘅 SVG 文件。'],
  ['converter.detail.transcode', 'Decodes the source raster and re-encodes it in another raster format.', '解碼來源嘅點陣圖，再用另一種點陣格式重新編碼。']
]);

const LOSS = build([
  ['converter.loss.alpha', 'Transparency (the alpha channel) may be flattened onto a solid background.', '透明度（alpha 色版）可能會被拍平做實色背景。'],
  ['converter.loss.animation', 'Only the first frame of an animated source is kept.', '動畫來源淨係會保留第一格。'],
  ['converter.loss.bom', 'A byte-order mark may be added or removed.', '位元組順序記號可能會被加返或者拆走。'],
  ['converter.loss.colour', 'Colour values may shift slightly from re-quantisation.', '色彩數值可能因為重新量化而有少少偏差。'],
  ['converter.loss.columns', 'A column this format cannot represent is dropped, and the drop is named in the notes.', '呢個格式表達唔到嘅欄會被拎走，備註入面會講明。'],
  ['converter.loss.encoding', 'The character encoding changes; characters the target encoding cannot represent are lost.', '字元編碼會改變；目標編碼表達唔到嘅字元會唔見咗。'],
  ['converter.loss.fonts', 'Embedded fonts are not carried across.', '內嵌字體唔會跟過去。'],
  [
    'converter.loss.indentation',
    'Indentation is rewritten; a file mixing tabs and spaces is normalised to one or the other.',
    '縮排會被重寫；混用 Tab 同空格嘅檔案會統一做其中一種。'
  ],
  ['converter.loss.keyOrder', 'Object key order may not be preserved.', '物件入面 key 嘅次序可能唔會保留。'],
  ['converter.loss.layers', 'Layers are flattened into one image.', '圖層會拍平做一張圖。'],
  ['converter.loss.lineEndings', 'Line endings are rewritten to the chosen convention.', '換行方式會改寫做揀咗嗰種。'],
  [
    'converter.loss.markdownExtensions',
    'Non-standard Markdown extensions the renderer does not recognise are passed through as plain text.',
    'render 唔識嘅非標準 Markdown 擴充語法，會照原樣當純文字輸出。'
  ],
  [
    'converter.loss.memberBinary',
    'A binary archive member cannot be written by a text-only channel and is refused, not corrupted.',
    '二進制嘅壓縮檔成員冇辦法用純文字通道寫出，會被拒絕，唔會整壞佢。'
  ],
  [
    'converter.loss.metadata',
    'Document metadata (title, author, subject, keywords) does not survive a rewrite unless explicitly reset.',
    '文件嘅中繼資料（標題、作者、主旨、關鍵字）喺重寫之後唔會保留，除非特登重新設定。'
  ],
  ['converter.loss.nesting', 'Nested structures are flattened to fit a row-and-column format.', '巢狀結構會拍平嚟就返行同列嘅格式。'],
  ['converter.loss.none', 'This route only reads; nothing about the source changes.', '呢條路線淨係讀嘢；來源乜都唔會改。'],
  ['converter.loss.notVector', 'The result is a raster sample, not a true vector image.', '出嚟嘅係點陣樣本，唔係真正嘅向量圖。'],
  [
    'converter.loss.pdfSignature',
    'A digital signature on the source does not carry across and will not validate against the result.',
    '來源嘅數位簽名唔會跟過去，喺出嚟嘅文件度驗唔到。'
  ],
  [
    'converter.loss.pdfSizeGrowth',
    'Every stream is re-encoded as ASCII hex, which roughly doubles its size.',
    '每個串流都會重新編碼做 ASCII 十六進制，體積大概會脹一倍。'
  ],
  [
    'converter.loss.pdfStructure',
    'Outlines, form fields and the structure tree are not carried into the rewritten document.',
    '大綱、表格欄位同結構樹唔會帶入重寫嘅文件。'
  ],
  [
    'converter.loss.precision',
    "Numeric precision may be rounded by the target format's own representation.",
    '數字精確度可能會因為目標格式本身嘅表達方式而被四捨五入。'
  ],
  ['converter.loss.profile', 'An embedded colour profile is not carried across.', '內嵌嘅色彩描述檔唔會跟過去。'],
  [
    'converter.loss.remoteAssets',
    'A remote image or script referenced by the source is not fetched or embedded.',
    '來源引用嘅遠端圖片或者腳本唔會被讀取或者內嵌。'
  ],
  ['converter.loss.sizeGrowth', 'Re-encoding this way roughly doubles the byte count.', '用呢種方式重新編碼，位元組數量大概會脹一倍。'],
  [
    'converter.loss.softLineBreaks',
    'Soft line breaks used for readability are joined back into one paragraph.',
    '為咗易讀而加嘅軟換行，會被砌返做一個段落。'
  ]
]);

const METADATA = build([
  [
    'converter.metadata.bytesOnly',
    'This route reads raw bytes only; there is no metadata to preserve or lose.',
    '呢條路線淨係讀原始位元組；根本冇中繼資料可以保留定係流失。'
  ],
  ['converter.metadata.dropped', 'Metadata is not carried into the result.', '中繼資料唔會帶入結果。'],
  [
    'converter.metadata.memberOnly',
    "Only the named archive member's own bytes are read; the archive's other metadata is untouched.",
    '淨係讀指定壓縮檔成員本身嘅位元組；壓縮檔其他嘅中繼資料唔會郁到。'
  ],
  [
    'converter.metadata.pdfRewrite',
    'The document is rewritten from scratch; metadata is not carried over unless the route explicitly sets it.',
    '文件會由頭重寫；中繼資料除非路線本身特登設定，否則唔會帶過去。'
  ],
  ['converter.metadata.pdfWrite', 'The document information dictionary is rewritten with the values given.', '文件資訊字典會用指定嘅值重寫。'],
  [
    'converter.metadata.preserved',
    'Metadata and character encoding are preserved wherever the target format can carry them.',
    '只要目標格式承載得到，中繼資料同字元編碼都會保留。'
  ],
  ['converter.metadata.readOnly', 'This route only reads and reports; nothing is written back to the source.', '呢條路線淨係讀同報告；乜都唔會寫返去來源。'],
  [
    'converter.metadata.records',
    "Column names are preserved; per-cell type information follows what the target format can represent.",
    '欄位名會保留；每格嘅型別資訊就跟返目標格式表達唔表達到。'
  ],
  ['converter.metadata.textOnly', 'Only the text content changes; there is no separate document metadata in this format.', '淨係文字內容會改；呢個格式冇獨立嘅文件中繼資料。']
]);

const SANDBOX = build([
  [
    'converter.sandbox.decoder',
    "Runs inside this feature's own bounded decoder, never a system or network codec.",
    '喺呢個功能自己嘅有限度解碼器入面行，唔會用系統或者網絡嘅編解碼器。'
  ],
  [
    'converter.sandbox.renderer',
    "Runs entirely inside the application's renderer process, with no network access.",
    '全程喺應用程式嘅 renderer process 入面行，冇網絡連接。'
  ]
]);

const VALIDATOR = build([
  [
    'converter.validator.bom',
    'Reopens the result and checks whether the byte-order mark is present or absent as requested.',
    '重新打開結果，check 返位元組順序記號有冇跟要求出現或者消失。'
  ],
  [
    'converter.validator.crc',
    "Recomputes the CRC-32 of the extracted bytes and compares it against the archive's own record.",
    '重新計過解出嚟位元組嘅 CRC-32，同壓縮檔自己記錄嘅數值對比。'
  ],
  ['converter.validator.html', 'Parses the produced HTML and checks it has no parser error.', '解析出嚟嘅 HTML，check 返冇 parser 錯誤。'],
  ['converter.validator.json', 'Parses the produced text back as JSON.', '將出嚟嘅文字當 JSON 解返一次。'],
  [
    'converter.validator.jsonEquivalent',
    'Parses the result and compares it against the source as a JSON value, not as bytes.',
    '解析結果，同來源用 JSON 數值嚟比較，唔係逐個位元組比。'
  ],
  ['converter.validator.length', 'Compares the produced length against what was expected.', '將出嚟嘅長度同預期嘅數值比較。'],
  ['converter.validator.lineCount', 'Compares the number of lines produced against the number of records read.', '將出嚟嘅行數同讀入嘅記錄數比較。'],
  [
    'converter.validator.lineEndings',
    'Scans the result and confirms every line ending matches the requested convention.',
    '掃描結果，確認每一個換行都跟緊要求嗰種。'
  ],
  [
    'converter.validator.netpbm',
    'Reopens the produced sample file and checks its header and sample count against the decoded image.',
    '重新打開出嚟嘅樣本檔，check 返標頭同樣本數同解碼出嚟嘅圖片是否相符。'
  ],
  [
    'converter.validator.pdfReopen',
    'Reopens the written document from scratch and checks its page count, rotations, sizes and metadata against the request.',
    '由頭重新打開寫出嚟嘅文件，check 返頁數、旋轉角度、大小同中繼資料係咪同要求相符。'
  ],
  ['converter.validator.records', 'Re-reads the produced text and compares the record count against the source.', '重新讀返出嚟嘅文字，將記錄數同來源比較。'],
  [
    'converter.validator.roundTrip',
    'Decodes the produced text back to bytes and compares it against the original input.',
    '將出嚟嘅文字解返做位元組，同原本輸入比較。'
  ],
  [
    'converter.validator.signature',
    'Checks the produced bytes still open with the expected file signature.',
    'check 返出嚟嘅位元組仲係咪用返預期嘅檔案簽名打得開。'
  ],
  ['converter.validator.size', 'Compares the produced byte count against the expected count.', '將出嚟嘅位元組數同預期數量比較。'],
  ['converter.validator.svg', 'Parses the result as XML and checks the root element is <svg>.', '將結果當 XML 解析，check 返根元素係咪 <svg>。'],
  ['converter.validator.text', 'Confirms the result is non-empty and decodes as valid text.', '確認結果唔係空，並且解碼做有效文字。']
]);

const REASON = build([
  [
    'converter.reason.binaryWrite',
    "The application's file-writing channel writes UTF-8 text only; there is no channel yet for arbitrary bytes.",
    '應用程式嘅寫檔通道淨係識寫 UTF-8 文字；而家仲未有通道寫任意位元組。'
  ],
  ['converter.reason.noCodec', 'No bundled codec for this format ships inside the application.', '應用程式入面未有內置呢個格式嘅編解碼器。'],
  ['converter.reason.noDecoder', 'No bundled decoder for this source format ships inside the application.', '應用程式入面未有內置呢個來源格式嘅解碼器。'],
  [
    'converter.reason.noDecompression',
    "The runtime's decompression capability is not available on this build.",
    '呢個版本冇提供 runtime 嘅解壓縮功能。'
  ],
  [
    'converter.reason.noLayoutEngine',
    'Producing a real page layout needs a layout engine this build does not bundle.',
    '整返一個真正嘅版面需要排版引擎，呢個版本冇內置。'
  ],
  ['converter.reason.noRaster', "The runtime's image-decoding capability is not available on this build.", '呢個版本冇提供 runtime 嘅圖片解碼功能。'],
  [
    'converter.reason.noRasteriser',
    'Rendering this to pixels needs a rasteriser this build does not bundle.',
    '要將呢個 render 做像素需要點陣化引擎，呢個版本冇內置。'
  ],
  ['converter.reason.noReader', 'No bundled reader for {what} ships inside the application.', '應用程式入面未有內置讀取 {what} 嘅工具。'],
  [
    'converter.reason.notBundled',
    "This route's implementation does not ship inside the installed application.",
    '呢條路線嘅實作冇隨已安裝嘅應用程式一齊出貨。'
  ]
]);

const ROTATE_ENDING_ETC = build([
  ['converter.rotate.keep', 'Keep the source rotation', '保持來源旋轉角度'],
  ['converter.rotate.0', '0°', '0 度'],
  ['converter.rotate.90', '90° clockwise', '順時針 90 度'],
  ['converter.rotate.180', '180°', '180 度'],
  ['converter.rotate.270', '270° clockwise', '順時針 270 度'],
  ['converter.ending.lf', 'Unix (LF)', 'Unix（LF）'],
  ['converter.ending.crlf', 'Windows (CRLF)', 'Windows（CRLF）'],
  ['converter.ending.cr', 'Classic Mac (CR)', '經典 Mac（CR）'],
  ['converter.indent.tabs', 'Tabs', 'Tab'],
  ['converter.indent.spaces', 'Spaces', '空格'],
  ['converter.json.pretty', 'Pretty-printed', '整齊排版'],
  ['converter.json.minified', 'Minified', '精簡版'],
  ['converter.bom.add', 'Add a byte-order mark', '加返位元組順序記號'],
  ['converter.bom.remove', 'Remove the byte-order mark', '拆走位元組順序記號'],
  ['converter.separator.none', 'No separator', '冇分隔符'],
  ['converter.separator.space', 'Space-separated', '用空格分隔'],
  ['converter.format.any', 'Any file', '任何檔案']
]);

const OPTIONS = build([
  ['converter.option.author', 'Author', '作者'],
  [
    'converter.option.author.description',
    'The Author value to write into the document information dictionary. Empty removes the key.',
    '寫入文件資訊字典嘅作者數值。留空會拎走呢個 key。'
  ],
  ['converter.option.background', 'Background colour', '背景色'],
  [
    'converter.option.background.description',
    'The solid colour used where transparency is flattened.',
    '透明部份拍平之後用嘅實色。'
  ],
  ['converter.option.bom', 'Byte-order mark', '位元組順序記號'],
  [
    'converter.option.bom.description',
    'Whether the result carries a leading byte-order mark.',
    '出嚟嘅結果開頭有冇位元組順序記號。'
  ],
  ['converter.option.bytesPerLine', 'Bytes per line', '每行位元組數'],
  [
    'converter.option.bytesPerLine.description',
    'How many encoded bytes each output line carries before wrapping.',
    '每行編碼位元組去到幾多先至換行。'
  ],
  ['converter.option.hexSeparator', 'Byte separator', '位元組分隔符'],
  [
    'converter.option.hexSeparator.description',
    'What, if anything, is written between each encoded byte pair.',
    '每一對編碼位元組之間寫咩（或者乜都唔寫）。'
  ],
  ['converter.option.indent', 'Indentation', '縮排'],
  ['converter.option.indent.description', "Whether tabs or spaces are used for the file's indentation.", '檔案嘅縮排用 Tab 定係空格。'],
  ['converter.option.indentWidth', 'Indent width', '縮排闊度'],
  [
    'converter.option.indentWidth.description',
    'How many spaces one indentation level is written as.',
    '一層縮排寫做幾多個空格。'
  ],
  ['converter.option.jsonIndent', 'Indent width', '縮排闊度'],
  [
    'converter.option.jsonIndent.description',
    'Spaces per nesting level in the pretty-printed result.',
    '整齊排版結果入面，每層巢狀用幾多個空格。'
  ],
  ['converter.option.jsonStyle', 'Style', '排版方式'],
  [
    'converter.option.jsonStyle.description',
    'Whether the JSON is written pretty-printed or minified.',
    'JSON 係整齊排版定係精簡版輸出。'
  ],
  ['converter.option.keywords', 'Keywords', '關鍵字'],
  [
    'converter.option.keywords.description',
    'The Keywords value to write into the document information dictionary. Empty removes the key.',
    '寫入文件資訊字典嘅關鍵字數值。留空會拎走呢個 key。'
  ],
  ['converter.option.lineEnding', 'Line ending', '換行方式'],
  [
    'converter.option.lineEnding.description',
    'Which line-ending convention the result is rewritten to use.',
    '結果會改寫用邊種換行方式。'
  ],
  ['converter.option.member', 'Archive member', '壓縮檔成員'],
  ['converter.option.member.description', 'The exact path inside the archive to extract.', '壓縮檔入面要解出嚟嘅確實路徑。'],
  ['converter.option.pageOrder', 'Page order', '頁面次序'],
  [
    'converter.option.pageOrder.description',
    'The page numbers, in the order the result should hold them, e.g. "3,1,2" or "1-3,7".',
    '頁碼，跟住結果應該有嘅次序寫，例如「3,1,2」或者「1-3,7」。'
  ],
  ['converter.option.pageRange', 'Page range', '頁面範圍'],
  [
    'converter.option.pageRange.description',
    'Which pages to keep, e.g. "1-3,7" or "2-" for page 2 to the end.',
    '揀邊幾頁，例如「1-3,7」或者「2-」代表由第 2 頁去到尾。'
  ],
  ['converter.option.rotate', 'Rotation', '旋轉'],
  ['converter.option.rotate.description', 'The rotation to apply to every copied page.', '套用喺每一頁複製本嘅旋轉角度。'],
  ['converter.option.subject', 'Subject', '主旨'],
  [
    'converter.option.subject.description',
    'The Subject value to write into the document information dictionary. Empty removes the key.',
    '寫入文件資訊字典嘅主旨數值。留空會拎走呢個 key。'
  ],
  ['converter.option.title', 'Title', '標題'],
  [
    'converter.option.title.description',
    'The Title value to write into the document information dictionary. Empty removes the key.',
    '寫入文件資訊字典嘅標題數值。留空會拎走呢個 key。'
  ],
  ['converter.option.wrapWidth', 'Wrap width', '換行闊度'],
  [
    'converter.option.wrapWidth.description',
    'The column at which encoded text wraps to a new line.',
    '編碼文字去到邊一欄就換新行。'
  ]
]);

/* ------------------------------------------------------------------ */
/* Resource-limit and queue settings — labels double as the settings ids */
/* ------------------------------------------------------------------ */

const LIMITS_SETTINGS = build([
  ['converter.limits.sourceBytes', 'Maximum source size', '來源檔案上限'],
  [
    'converter.limits.sourceBytes.description',
    'The largest source file, in bytes, any route will read. A larger file is refused before anything is decoded.',
    '任何路線會讀嘅來源檔案上限，用位元組計。超過嘅檔案喺解碼之前就會被拒絕。'
  ],
  ['converter.limits.outputBytes', 'Maximum output size', '輸出檔案上限'],
  [
    'converter.limits.outputBytes.description',
    'The largest produced file, in bytes, any route will write. A result past this bound is refused rather than truncated.',
    '任何路線會寫嘅輸出檔案上限，用位元組計。超過呢個上限嘅結果會被拒絕，唔會被截斷。'
  ],
  ['converter.limits.pixels', 'Maximum decoded pixels', '解碼像素上限'],
  [
    'converter.limits.pixels.description',
    'The largest image, in total pixels, an image route will decode into memory.',
    '圖片路線會解碼落記憶體嘅圖片，總像素上限。'
  ],
  ['converter.limits.pages', 'Maximum PDF pages', 'PDF 頁數上限'],
  [
    'converter.limits.pages.description',
    'The largest page count a PDF route will read, select or write.',
    'PDF 路線會讀取、揀選或者寫出嘅頁數上限。'
  ],
  ['converter.limits.entries', 'Maximum entries', '項目上限'],
  [
    'converter.limits.entries.description',
    'The largest number of archive members, records or PDF objects any route will process.',
    '任何路線會處理嘅壓縮檔成員、記錄或者 PDF 物件數量上限。'
  ],
  ['converter.limits.depth', 'Maximum nesting depth', '巢狀深度上限'],
  [
    'converter.limits.depth.description',
    'The deepest an object graph, JSON document or archive path may nest before a route refuses it.',
    '物件圖、JSON 文件或者壓縮檔路徑可以巢狀去到幾深，超過就會被路線拒絕。'
  ],
  ['converter.limits.cpuMs', 'Per-file time budget', '每個檔案嘅時間預算'],
  [
    'converter.limits.cpuMs.description',
    'The wall-clock milliseconds one conversion may run before it is cancelled with nothing written.',
    '一次轉換可以行幾多毫秒，超過就會被取消，乜都唔會寫出。'
  ],
  ['converter.queue.concurrency', 'Queue concurrency', '佇列並行數'],
  [
    'converter.queue.concurrency.description',
    'How many files the conversion queue processes at the same time. Each one still runs inside its own resource bounds.',
    '轉換佇列同一時間會處理幾多個檔案。每一個仍然喺自己嘅資源上限入面行。'
  ],
  ['converter.queue.checkpointEvery', 'Save queue state every', '每幾多個項目儲存佇列狀態'],
  [
    'converter.queue.checkpointEvery.description',
    'How many completed items pass before the durable queue record is written to disk again.',
    '完成幾多個項目之後，就再寫一次持久化嘅佇列紀錄落磁碟。'
  ],
  ['converter.queue.destination', 'Destination folder', '目標資料夾'],
  [
    'converter.queue.destination.description',
    'Where converted files are written. Left empty, each result is written beside its own source file.',
    '轉換好嘅檔案寫去邊。留空嘅話，每個結果都會寫喺自己來源檔案隔籬。'
  ],
  ['converter.output.overwrite', 'When a destination file already exists', '目標檔案已經存在嘅時候'],
  [
    'converter.output.overwrite.description',
    'What the queue does when the file it is about to write already exists at the destination.',
    '佇列準備寫嘅檔案，喺目標度已經有一個同名嘅時候，應該點做。'
  ],
  ['converter.output.overwrite.confirm', 'Ask each time', '每次都問過'],
  ['converter.output.overwrite.skip', 'Skip the file', '跳過呢個檔案'],
  ['converter.output.overwrite.overwrite', 'Overwrite it', '覆寫佢'],
  ['converter.queue.resumeOnLaunch', 'Resume the queue on launch', '開啟時繼續佇列'],
  [
    'converter.queue.resumeOnLaunch.description',
    'Whether pending and interrupted queue items automatically continue the next time the application starts.',
    '下次應用程式開啟嘅時候，未完成同被中斷嘅佇列項目係咪自動繼續。'
  ],
  ['converter.queue.keepOutcomes', 'Keep finished outcomes', '保留已完成嘅結果'],
  [
    'converter.queue.keepOutcomes.description',
    'How many finished queue entries (converted, skipped, cancelled or failed) stay in the list before the oldest are trimmed.',
    '完成咗嘅佇列項目（已轉換、已跳過、已取消或者失敗）保留幾多條，超過就會由最舊嗰啲開始剪走。'
  ],
  ['converter.detect.headBytes', 'Detection sample size', '偵測樣本大小'],
  [
    'converter.detect.headBytes.description',
    "How many bytes from the start of a file the type detector reads before deciding what it is.",
    '型別偵測器會讀檔案開頭幾多位元組先至判斷佢係咩嚟。'
  ]
]);

/* ------------------------------------------------------------------ */
/* Vocabulary, assembled                                               */
/* ------------------------------------------------------------------ */

const VOCABULARY: Catalogue = {
  ...formatStrings(),
  ...categoryStrings(),
  ...DETAIL,
  ...LOSS,
  ...METADATA,
  ...SANDBOX,
  ...VALIDATOR,
  ...REASON,
  ...ROTATE_ENDING_ETC,
  ...OPTIONS,
  ...LIMITS_SETTINGS
};

/* ------------------------------------------------------------------ */
/* Chrome — the feature's own tabs, dialogs, notifications, settings   */
/* ------------------------------------------------------------------ */

const CHROME: Catalogue = {
  'converter.feature.name': fact('File converter', '檔案轉換工具'),

  /* ---------------- tabs ---------------- */

  'converter.tab.catalog': entry(
    ladder('Format catalog', 'Format catalog', 'Format catalog', 'The whole format zoo', 'The whole format zoo'),
    ladder('格式目錄', '格式目錄', '成個格式目錄', '成個格式動物園', '成個格式動物園')
  ),
  'converter.tab.convert': entry(
    ladder('Convert files', 'Convert files', 'Convert some files', 'Feed it files, watch it work', 'Feed it files, watch it work'),
    ladder('轉換檔案', '轉換檔案', '轉幾個檔案', '掟啲檔案入嚟睇佢做嘢', '掟啲檔案入嚟睇佢做嘢')
  ),
  'converter.tab.pdftools': entry(
    ladder('PDF tools', 'PDF tools', 'PDF toolbox', 'The PDF workbench', 'The PDF workbench'),
    ladder('PDF 工具', 'PDF 工具', 'PDF 工具箱', 'PDF 工作枱', 'PDF 工作枱')
  ),

  /* ---------------- catalog tab ---------------- */

  'converter.catalog.subtitle': entry(
    ladder(
      'Every route this feature can take, grouped by category. Disabled routes name exactly what is missing.',
      'Every route this feature can take, grouped by category. Disabled routes name exactly what is missing.',
      'Every route this thing can take, sorted into categories. A greyed-out one tells you exactly what it is waiting for.',
      'Every route this thing knows, filed by category — and if one is greyed out, it names its exact missing piece instead of just sulking.',
      'Every route this thing knows, filed by category — and if one is greyed out, it names its exact missing piece instead of just sulking.'
    ),
    ladder(
      '呢個功能識行嘅每一條路線，按類別分好。停用嘅路線會講明實際缺咗啲乜。',
      '呢個功能識行嘅每一條路線，按類別分好。停用嘅路線會講明實際缺咗啲乜。',
      '呢個嘢識行嘅每條路線，分好晒類別。灰哂嘅嗰啲會講返實際等緊乜嘢。',
      '呢個嘢識行嘅每條路線，分好晒類別；灰哂嗰啲唔會扮嘢喊苦，會老老實實講返仲差咩先得。',
      '呢個嘢識行嘅每條路線，分好晒類別；灰哂嗰啲唔會扮嘢喊苦，會老老實實講返仲差咩先得。'
    )
  ),
  'converter.catalog.search': entry(
    ladder('Search this category', 'Search this category', 'Search inside this category', 'Hunt through this category', 'Hunt through this category'),
    ladder('搵呢個類別', '搵呢個類別', '喺呢個類別入面搵', '喺呢個類別度搜多幾轉', '喺呢個類別度搜多幾轉')
  ),
  'converter.catalog.enabled': entry(
    ladder('Enabled', 'Enabled', 'Ready to go', 'Locked, loaded, ready', 'Locked, loaded, ready'),
    ladder('已啟用', '已啟用', '準備好', '整裝待發', '整裝待發')
  ),
  'converter.catalog.disabled': entry(
    ladder('Disabled', 'Disabled', 'Not available yet', 'Sitting this one out', 'Sitting this one out'),
    ladder('已停用', '已停用', '暫時用唔到', '暫時坐響度睇戲', '暫時坐響度睇戲')
  ),
  'converter.catalog.export': entry(
    ladder('Export catalog', 'Export catalog', 'Export the catalog', 'Take the whole catalog with you', 'Take the whole catalog with you'),
    ladder('匯出目錄', '匯出目錄', '匯出成個目錄', '成個目錄打包帶走', '成個目錄打包帶走')
  ),
  'converter.catalog.column.route': fact('Route', '路線'),
  'converter.catalog.column.status': fact('Status', '狀態'),
  'converter.catalog.column.lossiness': fact('Lossiness', '損耗程度'),
  'converter.catalog.column.sandbox': fact('Sandbox', '沙盒'),
  'converter.catalog.column.validator': fact('Output check', '輸出檢查'),
  'converter.catalog.column.reason': fact('Missing dependency', '缺咗嘅依賴'),
  'converter.catalog.lossiness.lossless': fact('Lossless', '無損'),
  'converter.catalog.lossiness.lossy': fact('Lossy', '有損'),
  'converter.catalog.lossiness.inspection': fact('Read-only inspection', '純讀取檢查'),
  'converter.catalog.lossiness.container': fact('Container repackaging', '容器重新打包'),
  'converter.catalog.noMatches': entry(
    ladder(
      'No route in this category matches.',
      'No route in this category matches.',
      'Nothing in this category matches that.',
      'Came up empty — nothing here answers to that.',
      'Came up empty — nothing here answers to that.'
    ),
    ladder(
      '呢個類別入面冇路線夾得晒。',
      '呢個類別入面冇路線夾得晒。',
      '呢個類別入面搵唔到夾嘅嘢。',
      '搵極都冇——呢度冇嘢應到你嗰句。',
      '搵極都冇——呢度冇嘢應到你嗰句。'
    )
  ),

  /* ---------------- convert tab ---------------- */

  'converter.convert.subtitle': entry(
    ladder(
      'Add files, choose a target format, and the queue converts them with bounded concurrency.',
      'Add files, choose a target format, and the queue converts them with bounded concurrency.',
      'Add files, pick where they should end up, and let the queue chew through them.',
      'Throw files at it, point it at a format, and let the queue grind through the pile at its own pace.',
      'Throw files at it, point it at a format, and let the queue grind through the pile at its own pace.'
    ),
    ladder(
      '加啲檔案，揀個目標格式，佇列就會用有限並行數幫你轉。',
      '加啲檔案，揀個目標格式，佇列就會用有限並行數幫你轉。',
      '加啲檔案，話俾佢知想去邊個格式，佇列就慢慢幫你食晒佢。',
      '掟啲檔案落去，指定個目標格式，剩低嘅交俾佇列自己慢慢磨。',
      '掟啲檔案落去，指定個目標格式，剩低嘅交俾佇列自己慢慢磨。'
    )
  ),
  'converter.convert.addFiles': entry(
    ladder('Add files…', 'Add files…', 'Add some files…', 'Feed it more files…', 'Feed it more files…'),
    ladder('加入檔案…', '加入檔案…', '加幾個檔案…', '再餵多啲檔案畀佢…', '再餵多啲檔案畀佢…')
  ),
  'converter.convert.addFolder': entry(
    ladder('Add a folder…', 'Add a folder…', 'Add a whole folder…', 'Dump in a whole folder…', 'Dump in a whole folder…'),
    ladder('加入資料夾…', '加入資料夾…', '加成個資料夾…', '成個資料夾倒晒落去…', '成個資料夾倒晒落去…')
  ),
  'converter.convert.discovering': entry(
    ladder(
      'Scanning {count} folder(s) for files…',
      'Scanning {count} folder(s) for files…',
      'Digging through {count} folder(s)…',
      'Rummaging through {count} folder(s), one bounded page at a time…',
      'Rummaging through {count} folder(s), one bounded page at a time…'
    ),
    ladder(
      '掃緊 {count} 個資料夾搵檔案…',
      '掃緊 {count} 個資料夾搵檔案…',
      '喺 {count} 個資料夾度爬緊…',
      '喺 {count} 個資料夾度慢慢揦，一頁一頁咁揦…',
      '喺 {count} 個資料夾度慢慢揦，一頁一頁咁揦…'
    )
  ),
  'converter.convert.targetAdapter': entry(
    ladder('Target route', 'Target route', 'Where should it go', 'Point it somewhere', 'Point it somewhere'),
    ladder('目標路線', '目標路線', '想轉去邊', '指個方向畀佢', '指個方向畀佢')
  ),
  'converter.convert.targetAdapter.description': fact(
    'Which route the selected files will be converted with. Only routes that accept at least one selected file are offered.',
    '揀嘅檔案會用邊條路線轉換。淨係會提供最少接受一個已揀檔案嘅路線。'
  ),
  'converter.convert.destination.browse': entry(
    ladder('Choose folder…', 'Choose folder…', 'Pick a folder…', 'Point it at a folder…', 'Point it at a folder…'),
    ladder('揀資料夾…', '揀資料夾…', '揀個資料夾…', '指返個資料夾出嚟…', '指返個資料夾出嚟…')
  ),
  'converter.convert.start': entry(
    ladder('Start the queue', 'Start the queue', 'Start converting', 'Set the queue loose', 'Set the queue loose'),
    ladder('開始佇列', '開始佇列', '開始轉換', '放個佇列出嚟跑', '放個佇列出嚟跑')
  ),
  'converter.convert.pause': entry(
    ladder('Pause', 'Pause', 'Pause it', 'Give it a breather', 'Give it a breather'),
    ladder('暫停', '暫停', '暫停佢', '畀佢抖下', '畀佢抖下')
  ),
  'converter.convert.resume': entry(
    ladder('Resume', 'Resume', 'Resume it', 'Back to work', 'Back to work'),
    ladder('繼續', '繼續', '繼續佢', '返嚟做嘢喇', '返嚟做嘢喇')
  ),
  'converter.convert.cancelAll': entry(
    ladder('Cancel every pending item', 'Cancel every pending item', 'Cancel what has not started', 'Call the whole thing off', 'Call the whole thing off'),
    ladder('取消所有未開始嘅項目', '取消所有未開始嘅項目', '取消未開始嗰啲', '成單嘢唔搞喇', '成單嘢唔搞喇')
  ),
  'converter.convert.clearFinished': entry(
    ladder('Clear finished items', 'Clear finished items', 'Clear the finished ones', 'Sweep the finished pile away', 'Sweep the finished pile away'),
    ladder('清除已完成項目', '清除已完成項目', '清走已完成嗰啲', '掃走做完嗰堆', '掃走做完嗰堆')
  ),
  'converter.convert.retry': entry(
    ladder('Retry', 'Retry', 'Try again', 'Give it another go', 'Give it another go'),
    ladder('重試', '重試', '再試一次', '再嚟多次', '再嚟多次')
  ),
  'converter.convert.remove': entry(
    ladder('Remove from queue', 'Remove from queue', 'Take it off the queue', 'Kick it off the queue', 'Kick it off the queue'),
    ladder('由佇列移除', '由佇列移除', '喺佇列度攞走', '踢佢出佇列', '踢佢出佇列')
  ),
  'converter.convert.invertSelection': entry(
    ladder('Invert selection', 'Invert selection', 'Flip the selection', 'Swap picked for unpicked', 'Swap picked for unpicked'),
    ladder('反轉選取', '反轉選取', '反轉揀選', '揀同冇揀對調', '揀同冇揀對調')
  ),
  'converter.convert.selection.none': fact('Select at least one row first.', '先揀最少一行。'),
  'converter.convert.cancelAll.disabledReason': fact('Nothing pending to cancel.', '冇未開始嘅項目可以取消。'),
  'converter.convert.clearFinished.disabledReason': fact('Nothing finished to clear yet.', '仲未有已完成嘅項目可以清除。'),
  'converter.convert.column.source': fact('Source', '來源'),
  'converter.convert.column.detected': fact('Detected type', '偵測類型'),
  'converter.convert.column.route': fact('Route', '路線'),
  'converter.convert.column.status': fact('Status', '狀態'),
  'converter.convert.column.output': fact('Output', '輸出'),
  'converter.convert.column.notes': fact('Notes', '備註'),
  'converter.convert.status.pending': fact('Pending', '未開始'),
  'converter.convert.status.running': fact('Converting…', '轉緊…'),
  'converter.convert.status.done': fact('Converted', '已轉換'),
  'converter.convert.status.skipped': fact('Skipped', '已跳過'),
  'converter.convert.status.cancelled': fact('Cancelled', '已取消'),
  'converter.convert.status.failed': fact('Failed', '失敗'),
  'converter.convert.status.paused': entry(
    ladder('Paused', 'Paused', 'Paused', 'On a breather', 'On a breather'),
    ladder('已暫停', '已暫停', '已暫停', '抖緊氣', '抖緊氣')
  ),
  'converter.convert.empty': entry(
    ladder(
      'No files queued yet. Add files or a folder to get started.',
      'No files queued yet. Add files or a folder to get started.',
      'Nothing queued yet — add some files or a folder.',
      'Empty queue, nothing to chew on — throw it a file or a folder.',
      'Empty queue, nothing to chew on — throw it a file or a folder.'
    ),
    ladder(
      '仲未有檔案排隊。加啲檔案或者資料夾開始啦。',
      '仲未有檔案排隊。加啲檔案或者資料夾開始啦。',
      '仲未排到嘢——加幾個檔案或者資料夾先。',
      '個佇列得個吉，冇嘢好食——掟個檔案或者資料夾畀佢。',
      '個佇列得個吉，冇嘢好食——掟個檔案或者資料夾畀佢。'
    )
  ),
  'converter.convert.disclosure.title': entry(
    ladder('Before this route runs', 'Before this route runs', 'Before this one runs', 'Read this before it runs', 'Read this before it runs'),
    ladder('喺呢條路線行之前', '喺呢條路線行之前', '喺佢行之前', '行之前睇多兩眼', '行之前睇多兩眼')
  ),
  'converter.convert.disclosure.confirm': entry(
    ladder('Convert anyway', 'Convert anyway', 'Go ahead and convert', 'Fine, do it', 'Fine, do it'),
    ladder('照樣轉換', '照樣轉換', '照轉可以喇', '好喇好喇，轉啦', '好喇好喇，轉啦')
  ),
  'converter.convert.overwrite.action': fact('Overwrite {count} existing file(s)', '覆寫 {count} 個已存在嘅檔案'),
  'converter.convert.overwrite.irreversible': fact(
    'Their current contents are replaced by the conversion output and cannot be recovered.',
    '佢哋而家嘅內容會被轉換結果取代，冇得復原。'
  ),
  'converter.convert.preflight.destinationMissing': entry(
    ladder(
      'The destination folder does not exist yet. It will be created before writing starts.',
      'The destination folder does not exist yet. It will be created before writing starts.',
      'That destination folder is not there yet — it gets created before anything is written.',
      "That folder doesn't exist yet, so it gets built first, before a single byte lands in it.",
      "That folder doesn't exist yet, so it gets built first, before a single byte lands in it."
    ),
    ladder(
      '目標資料夾仲未存在。開始寫之前會幫你整返個出嚟。',
      '目標資料夾仲未存在。開始寫之前會幫你整返個出嚟。',
      '嗰個目標資料夾仲未有——寫嘢之前會幫你整定佢。',
      '嗰個資料夾根本仲未存在，所以會先幫你整好佢，一個位元組都未寫落去。',
      '嗰個資料夾根本仲未存在，所以會先幫你整好佢，一個位元組都未寫落去。'
    )
  ),
  'converter.convert.preflight.destinationNotWritable': entry(
    ladder(
      'The destination path exists but is not a folder, so nothing can be written there.',
      'The destination path exists but is not a folder, so nothing can be written there.',
      "That destination isn't a folder, so nothing can be written there.",
      "That path exists, but it's not a folder — nothing is landing there.",
      "That path exists, but it's not a folder — nothing is landing there."
    ),
    ladder(
      '目標路徑存在但唔係資料夾，所以乜都寫唔到落去。',
      '目標路徑存在但唔係資料夾，所以乜都寫唔到落去。',
      '嗰個目標唔係資料夾，寫唔到嘢落去。',
      '嗰個位確實存在，但佢唔係資料夾——乜都落唔到去。',
      '嗰個位確實存在，但佢唔係資料夾——乜都落唔到去。'
    )
  ),

  /* ---------------- pdf tools tab ---------------- */

  'converter.pdftools.subtitle': entry(
    ladder(
      'Inspect, split, merge, extract, reorder, rotate and edit the metadata of a PDF. Every write is reopened and checked before it is offered.',
      'Inspect, split, merge, extract, reorder, rotate and edit the metadata of a PDF. Every write is reopened and checked before it is offered.',
      'Inspect, split, merge, pull pages out, reorder, rotate or edit the metadata of a PDF — every write gets reopened and checked before it counts.',
      'Poke a PDF, split it, glue several together, yank pages out, shuffle them, spin them round, or rewrite its metadata — nothing counts as done until it has been reopened and checked.',
      'Poke a PDF, split it, glue several together, yank pages out, shuffle them, spin them round, or rewrite its metadata — nothing counts as done until it has been reopened and checked.'
    ),
    ladder(
      '檢查、拆分、合併、抽取、重排、旋轉同編輯 PDF 中繼資料。每次寫入都會重新打開同檢查先至算數。',
      '檢查、拆分、合併、抽取、重排、旋轉同編輯 PDF 中繼資料。每次寫入都會重新打開同檢查先至算數。',
      '檢查、拆分、合併、抽頁、重排、旋轉，定係改 PDF 嘅中繼資料——每次寫完都會重新打開check過先算數。',
      '玩晒個 PDF：拆佢、砌埋佢、抽走幾頁、洗牌、轉個方向，或者改晒佢啲中繼資料——冇重新打開 check 過，一律唔算做完。',
      '玩晒個 PDF：拆佢、砌埋佢、抽走幾頁、洗牌、轉個方向，或者改晒佢啲中繼資料——冇重新打開 check 過，一律唔算做完。'
    )
  ),
  'converter.pdftools.chooseFile': entry(
    ladder('Choose a PDF…', 'Choose a PDF…', 'Pick a PDF…', 'Hand it a PDF…', 'Hand it a PDF…'),
    ladder('揀個 PDF…', '揀個 PDF…', '揀份 PDF…', '交份 PDF 出嚟…', '交份 PDF 出嚟…')
  ),
  'converter.pdftools.chooseFiles': entry(
    ladder('Choose PDFs…', 'Choose PDFs…', 'Pick PDFs to merge…', 'Round up some PDFs…', 'Round up some PDFs…'),
    ladder('揀幾個 PDF…', '揀幾個 PDF…', '揀幾份 PDF 去合併…', '召集幾份 PDF…', '召集幾份 PDF…')
  ),
  'converter.pdftools.noFile': entry(
    ladder(
      'No PDF chosen yet.',
      'No PDF chosen yet.',
      'No PDF picked yet.',
      'No PDF in hand yet — go get one.',
      'No PDF in hand yet — go get one.'
    ),
    ladder('仲未揀 PDF。', '仲未揀 PDF。', '仲未揀份 PDF。', '手上仲冇 PDF——去攞一份先。', '手上仲冇 PDF——去攞一份先。')
  ),
  'converter.pdftools.action.inspect': entry(
    ladder('Inspect', 'Inspect', 'Inspect it', 'Peek inside', 'Peek inside'),
    ladder('檢查', '檢查', '檢查佢', '窺探下入面', '窺探下入面')
  ),
  'converter.pdftools.action.extract': entry(
    ladder('Extract pages', 'Extract pages', 'Extract some pages', 'Pull out the pages you want', 'Pull out the pages you want'),
    ladder('抽取頁面', '抽取頁面', '抽幾頁出嚟', '揀啲頁抽出嚟', '揀啲頁抽出嚟')
  ),
  'converter.pdftools.action.reorder': entry(
    ladder('Reorder pages', 'Reorder pages', 'Reorder some pages', 'Shuffle the pages', 'Shuffle the pages'),
    ladder('重排頁面', '重排頁面', '重排幾頁', '洗牌啲頁', '洗牌啲頁')
  ),
  'converter.pdftools.action.rotate': entry(
    ladder('Rotate pages', 'Rotate pages', 'Rotate every page', 'Spin the whole thing round', 'Spin the whole thing round'),
    ladder('旋轉頁面', '旋轉頁面', '旋轉晒啲頁', '成份文件轉一轉', '成份文件轉一轉')
  ),
  'converter.pdftools.action.metadata': entry(
    ladder('Edit metadata', 'Edit metadata', 'Edit the metadata', 'Rewrite the metadata', 'Rewrite the metadata'),
    ladder('編輯中繼資料', '編輯中繼資料', '編輯下中繼資料', '改返啲中繼資料', '改返啲中繼資料')
  ),
  'converter.pdftools.action.split': entry(
    ladder('Split', 'Split', 'Split it up', 'Cut it into pieces', 'Cut it into pieces'),
    ladder('拆分', '拆分', '拆開佢', '切晒佢做幾份', '切晒佢做幾份')
  ),
  'converter.pdftools.action.merge': entry(
    ladder('Merge', 'Merge', 'Merge them', 'Glue them together', 'Glue them together'),
    ladder('合併', '合併', '合併埋佢哋', '黐晒埋一份', '黐晒埋一份')
  ),
  'converter.pdftools.split.pagesPerFile': entry(
    ladder('Pages per output file', 'Pages per output file', 'Pages in each output file', 'How many pages per slice', 'How many pages per slice'),
    ladder('每個輸出檔案嘅頁數', '每個輸出檔案嘅頁數', '每份輸出檔有幾多頁', '每一份切幾多頁', '每一份切幾多頁')
  ),
  'converter.pdftools.split.pagesPerFile.description': fact(
    'The document is cut into consecutive groups of this many pages, one output file per group. The last file may hold fewer.',
    '文件會按呢個頁數連續分組，每組一個輸出檔案。最尾嗰份可能會少啲頁。'
  ),
  'converter.pdftools.split.run': entry(
    ladder('Split into files…', 'Split into files…', 'Split it into files…', 'Slice it and save the pieces…', 'Slice it and save the pieces…'),
    ladder('拆成幾個檔案…', '拆成幾個檔案…', '拆做幾個檔案…', '切晒佢再逐份儲低…', '切晒佢再逐份儲低…')
  ),
  'converter.pdftools.merge.order': entry(
    ladder('Merge order', 'Merge order', 'Order to merge in', 'The order they line up in', 'The order they line up in'),
    ladder('合併次序', '合併次序', '合併嘅次序', '佢哋排隊嘅次序', '佢哋排隊嘅次序')
  ),
  'converter.pdftools.merge.moveUp': entry(ladder('Move up', 'Move up', 'Move up', 'Bump it up', 'Bump it up'), ladder('上移', '上移', '上移', '踢佢上去啲', '踢佢上去啲')),
  'converter.pdftools.merge.moveDown': entry(ladder('Move down', 'Move down', 'Move down', 'Nudge it down', 'Nudge it down'), ladder('下移', '下移', '下移', '推佢落去啲', '推佢落去啲')),
  'converter.pdftools.merge.disabledReason.first': fact('This file is already first.', '呢個檔案已經排第一。'),
  'converter.pdftools.merge.disabledReason.last': fact('This file is already last.', '呢個檔案已經排最尾。'),
  'converter.pdftools.merge.run': entry(
    ladder('Merge into one file…', 'Merge into one file…', 'Merge into one PDF…', 'Glue them into one file…', 'Glue them into one file…'),
    ladder('合併做一個檔案…', '合併做一個檔案…', '合併做一份 PDF…', '黐做一個檔案…', '黐做一個檔案…')
  ),
  'converter.pdftools.saveAs': entry(
    ladder('Save as…', 'Save as…', 'Save the result as…', 'Save this thing as…', 'Save this thing as…'),
    ladder('另存為…', '另存為…', '將結果儲存為…', '將呢份嘢儲低做…', '將呢份嘢儲低做…')
  ),
  'converter.pdftools.saveTo': entry(
    ladder('Save into…', 'Save into…', 'Save the pieces into…', 'Drop the pieces into…', 'Drop the pieces into…'),
    ladder('儲存去…', '儲存去…', '將啲碎片儲入…', '啲碎片掉入…', '啲碎片掉入…')
  ),
  'converter.pdftools.encrypted': entry(
    ladder(
      'This document is encrypted. Only the trailer could be read, so no page tool can run on it.',
      'This document is encrypted. Only the trailer could be read, so no page tool can run on it.',
      'That PDF is encrypted — only its trailer could be read, so no page tool can touch it.',
      "That PDF is locked up tight — only the trailer's readable, so none of the page tools can lay a finger on it.",
      "That PDF is locked up tight — only the trailer's readable, so none of the page tools can lay a finger on it."
    ),
    ladder(
      '呢份文件已加密。淨係讀到 trailer，所以任何頁面工具都行唔到。',
      '呢份文件已加密。淨係讀到 trailer，所以任何頁面工具都行唔到。',
      '嗰份 PDF 加密咗——淨係讀到 trailer，所以邊個頁面工具都用唔到。',
      '嗰份 PDF 鎖到實一實——淨係讀到 trailer，任何頁面工具都掂佢唔到。',
      '嗰份 PDF 鎖到實一實——淨係讀到 trailer，任何頁面工具都掂佢唔到。'
    )
  ),
  'converter.pdftools.reopenChecks': entry(
    ladder('Reopen checks', 'Reopen checks', 'Reopen checks', 'Proof-of-life checks', 'Proof-of-life checks'),
    ladder('重新打開檢查', '重新打開檢查', '重新打開檢查', '返生證明檢查', '返生證明檢查')
  ),
  'converter.pdftools.checksPassed': entry(
    ladder(
      'Every reopen check passed.',
      'Every reopen check passed.',
      'Every reopen check came back clean.',
      'Reopened it, poked it, and every single check came back green.',
      'Reopened it, poked it, and every single check came back green.'
    ),
    ladder(
      '所有重新打開檢查都通過咗。',
      '所有重新打開檢查都通過咗。',
      '重新打開嘅每個檢查都乾淨過關。',
      '重新打開嚟戳咗一輪，每個檢查都綠燈。',
      '重新打開嚟戳咗一輪，每個檢查都綠燈。'
    )
  ),
  'converter.pdftools.checksFailed': entry(
    ladder(
      'The reopen check found a mismatch. Nothing was written.',
      'The reopen check found a mismatch. Nothing was written.',
      'The reopen check found a mismatch, so nothing got written.',
      'Something did not line up on reopen, so nothing landed on disk.',
      'Something did not line up on reopen, so nothing landed on disk.'
    ),
    ladder(
      '重新打開檢查發現唔相符。乜都冇寫過。',
      '重新打開檢查發現唔相符。乜都冇寫過。',
      '重新打開檢查發現對唔上，所以乜都冇寫落去。',
      '重新打開一睇，對唔上數，於是一個位元組都冇落地。',
      '重新打開一睇，對唔上數，於是一個位元組都冇落地。'
    )
  ),

  /* ---------------- shared confirmations / notifications ---------------- */

  'converter.confirm.clearFinished.action': fact('Clear {count} finished queue item(s)', '清走 {count} 個已完成嘅佇列項目'),
  'converter.confirm.clearFinished.irreversible': fact(
    'Their rows are removed from the queue list. The files already written to disk are not touched.',
    '佇列列表入面嘅呢啲行會被移除。已經寫落磁碟嘅檔案唔會受影響。'
  ),
  'converter.confirm.cancelAll.action': fact('Cancel {count} pending queue item(s)', '取消 {count} 個未開始嘅佇列項目'),
  'converter.confirm.cancelAll.irreversible': fact(
    'Pending items are marked cancelled and skipped. Nothing that already finished is touched.',
    '未開始嘅項目會標記做已取消並跳過。已經完成嘅項目唔會受影響。'
  ),

  'converter.notify.queued': fact('{count} file(s) added to the queue.', '{count} 個檔案已加入佇列。'),
  'converter.notify.discoveryDone': fact('Folder scan finished: {count} file(s) found.', '資料夾掃描完成：搵到 {count} 個檔案。'),
  'converter.notify.queueDone': fact('Queue finished: {done} converted, {skipped} skipped, {failed} failed.', '佇列完成：{done} 個已轉換，{skipped} 個跳過，{failed} 個失敗。'),
  'converter.notify.saved': fact('Saved to {path}.', '已儲存去 {path}。'),
  'converter.notify.mergeSaved': fact('Merged {count} document(s) into {path}.', '已將 {count} 份文件合併去 {path}。'),
  'converter.notify.splitSaved': fact('Split into {count} file(s) in {path}.', '已拆成 {count} 個檔案，放咗喺 {path}。'),
  'converter.notify.conversionFailed': fact('{name} could not be converted: {reason}', '{name} 轉換唔到：{reason}'),

  /* ---------------- settings section ---------------- */

  'converter.settings.title': fact('File converter', '檔案轉換工具'),

  /* ---------------- palette ---------------- */

  'converter.palette.openCatalog': fact('Open the format catalog', '打開格式目錄'),
  'converter.palette.openConvert': fact('Convert files', '轉換檔案'),
  'converter.palette.openPdfTools': fact('Open PDF tools', '打開 PDF 工具')
};

export const CONVERTER_STRINGS: Catalogue = {
  ...VOCABULARY,
  ...CHROME
};
