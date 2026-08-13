/**
 * Container inspection for audio and video files.
 *
 * These readers parse a container's own headers and produce a factual report.
 * They never transcode: a codec is not something this application bundles, and
 * the registry lists every transcode route as unavailable naming exactly that,
 * rather than shipping a control that would fail at the first frame.
 */

import { ascii, bytesToUtf8Lossy, readUintBE, readUintLE, startsWith } from './bytes';
import { ConverterBoundary, Deadline, type ResourceLimits } from './limits';

export interface MediaReport {
  container: string;
  /** Every track the container declares, in declaration order. */
  tracks: Array<{
    index: number;
    kind: string;
    codec: string;
    /** Empty when the container does not record it. */
    detail: string;
  }>;
  /** Duration in seconds when the container records one, otherwise null. */
  durationSeconds: number | null;
  /** Everything else the header states, key by key. */
  properties: Record<string, string>;
  fileBytes: number;
  /** Facts the container does not carry, stated so nobody assumes they exist. */
  notRecorded: string[];
}

/* ------------------------------------------------------------------ */
/* RIFF / WAVE                                                         */
/* ------------------------------------------------------------------ */

const WAVE_FORMATS: Record<number, string> = {
  0x0001: 'PCM',
  0x0003: 'IEEE float',
  0x0006: 'A-law',
  0x0007: 'mu-law',
  0x0011: 'IMA ADPCM',
  0x0055: 'MPEG Layer 3',
  0xfffe: 'extensible'
};

/** Reads a WAVE file's format and data chunks. */
export function inspectWave(bytes: Uint8Array, limits: ResourceLimits, deadline: Deadline): MediaReport {
  if (!startsWith(bytes, ascii('RIFF')) || !startsWith(bytes, ascii('WAVE'), 8)) {
    throw new ConverterBoundary('unsupported', 'The file is not a RIFF container carrying a WAVE form type.');
  }
  const properties: Record<string, string> = {};
  let cursor = 12;
  let channels = 0;
  let sampleRate = 0;
  let bitsPerSample = 0;
  let byteRate = 0;
  let formatCode = 0;
  let dataBytes = 0;
  let chunks = 0;

  while (cursor + 8 <= bytes.length) {
    deadline.check();
    chunks += 1;
    if (chunks > limits.entries) {
      throw new ConverterBoundary('entries', `The container holds more than ${limits.entries} chunks, past the bound.`);
    }
    const id = bytesToUtf8Lossy(bytes.subarray(cursor, cursor + 4));
    const size = readUintLE(bytes, cursor + 4, 4);
    const body = cursor + 8;
    if (id === 'fmt ') {
      formatCode = readUintLE(bytes, body, 2);
      channels = readUintLE(bytes, body + 2, 2);
      sampleRate = readUintLE(bytes, body + 4, 4);
      byteRate = readUintLE(bytes, body + 8, 4);
      bitsPerSample = readUintLE(bytes, body + 14, 2);
    } else if (id === 'data') {
      dataBytes = size;
    } else if (id === 'LIST') {
      properties.list = bytesToUtf8Lossy(bytes.subarray(body, Math.min(body + 4, bytes.length)));
    }
    cursor = body + size + (size % 2);
  }

  const duration = byteRate > 0 && dataBytes > 0 ? dataBytes / byteRate : null;
  properties.sampleRateHz = String(sampleRate);
  properties.channels = String(channels);
  properties.bitsPerSample = String(bitsPerSample);
  properties.byteRate = String(byteRate);
  properties.dataBytes = String(dataBytes);
  properties.chunks = String(chunks);

  return {
    container: 'RIFF/WAVE',
    tracks: [
      {
        index: 1,
        kind: 'audio',
        codec: WAVE_FORMATS[formatCode] ?? `format code ${formatCode}`,
        detail: `${channels} channel(s), ${sampleRate} Hz, ${bitsPerSample}-bit`
      }
    ],
    durationSeconds: duration === null ? null : Math.round(duration * 1000) / 1000,
    properties,
    fileBytes: bytes.length,
    notRecorded: ['loudness', 'chapter marks', 'embedded artwork beyond a LIST chunk name']
  };
}

/* ------------------------------------------------------------------ */
/* MPEG audio (MP3)                                                    */
/* ------------------------------------------------------------------ */

const MP3_BITRATES_V1_L3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
const MP3_SAMPLE_RATES = [44100, 48000, 32000, 0];

/** Reads an MP3's first audio frame header and any ID3v2 tag size. */
export function inspectMp3(bytes: Uint8Array, limits: ResourceLimits, deadline: Deadline): MediaReport {
  const properties: Record<string, string> = {};
  let cursor = 0;
  if (startsWith(bytes, ascii('ID3'))) {
    const size =
      ((bytes[6] & 0x7f) << 21) | ((bytes[7] & 0x7f) << 14) | ((bytes[8] & 0x7f) << 7) | (bytes[9] & 0x7f);
    properties.id3Version = `2.${bytes[3]}.${bytes[4]}`;
    properties.id3TagBytes = String(size + 10);
    cursor = size + 10;
  }

  let found = -1;
  const searchLimit = Math.min(bytes.length - 4, cursor + 256 * 1024);
  for (let index = cursor; index < searchLimit; index += 1) {
    if (index % 8192 === 0) deadline.check();
    if (bytes[index] === 0xff && (bytes[index + 1] & 0xe0) === 0xe0) {
      found = index;
      break;
    }
  }
  if (found < 0) {
    throw new ConverterBoundary('malformed', 'No MPEG audio frame header was found within the searched window.');
  }

  const header = bytes.subarray(found, found + 4);
  const versionBits = (header[1] >> 3) & 0x03;
  const layerBits = (header[1] >> 1) & 0x03;
  const bitrateIndex = (header[2] >> 4) & 0x0f;
  const sampleIndex = (header[2] >> 2) & 0x03;
  const channelMode = (header[3] >> 6) & 0x03;

  const version = versionBits === 3 ? 'MPEG-1' : versionBits === 2 ? 'MPEG-2' : versionBits === 0 ? 'MPEG-2.5' : 'reserved';
  const layer = layerBits === 1 ? 'Layer III' : layerBits === 2 ? 'Layer II' : layerBits === 3 ? 'Layer I' : 'reserved';
  const bitrate = MP3_BITRATES_V1_L3[bitrateIndex];
  const sampleRate = MP3_SAMPLE_RATES[sampleIndex];
  const channels = channelMode === 3 ? 1 : 2;

  properties.firstFrameOffset = String(found);
  properties.sampleRateHz = String(sampleRate);
  properties.channels = String(channels);
  properties.bitrateKbps = String(bitrate);
  if (limits.entries < 1) properties.note = 'entry bound is below one, so nothing further was scanned';

  const audioBytes = bytes.length - found;
  const duration = bitrate > 0 ? (audioBytes * 8) / (bitrate * 1000) : null;

  return {
    container: 'MPEG audio',
    tracks: [
      {
        index: 1,
        kind: 'audio',
        codec: `${version} ${layer}`,
        detail: `${channels} channel(s), ${sampleRate} Hz, ${bitrate} kbit/s at the first frame`
      }
    ],
    durationSeconds: duration === null ? null : Math.round(duration * 10) / 10,
    properties,
    fileBytes: bytes.length,
    notRecorded: [
      'exact duration for a variable-bitrate stream without a Xing or VBRI header',
      'ID3 tag contents, which this reader deliberately does not read'
    ]
  };
}

/* ------------------------------------------------------------------ */
/* ISO base media (MP4)                                                */
/* ------------------------------------------------------------------ */

interface Mp4Box {
  type: string;
  start: number;
  bodyStart: number;
  end: number;
}

function readBoxes(bytes: Uint8Array, from: number, to: number, deadline: Deadline, budget: { left: number }): Mp4Box[] {
  const out: Mp4Box[] = [];
  let cursor = from;
  while (cursor + 8 <= to) {
    deadline.check();
    budget.left -= 1;
    if (budget.left < 0) return out;
    let size = readUintBE(bytes, cursor, 4);
    const type = bytesToUtf8Lossy(bytes.subarray(cursor + 4, cursor + 8));
    let bodyStart = cursor + 8;
    if (size === 1) {
      size = readUintBE(bytes, cursor + 8, 8);
      bodyStart = cursor + 16;
    } else if (size === 0) {
      size = to - cursor;
    }
    if (size < 8 || cursor + size > to) break;
    out.push({ type, start: cursor, bodyStart, end: cursor + size });
    cursor += size;
  }
  return out;
}

/** Reads an MP4 container's movie header and track headers. */
export function inspectMp4(bytes: Uint8Array, limits: ResourceLimits, deadline: Deadline): MediaReport {
  const budget = { left: Math.min(limits.entries, 20_000) };
  const top = readBoxes(bytes, 0, bytes.length, deadline, budget);
  const ftyp = top.find((box) => box.type === 'ftyp');
  const moov = top.find((box) => box.type === 'moov');
  const properties: Record<string, string> = {};

  if (ftyp) {
    properties.majorBrand = bytesToUtf8Lossy(bytes.subarray(ftyp.bodyStart, ftyp.bodyStart + 4));
    const brands: string[] = [];
    for (let cursor = ftyp.bodyStart + 8; cursor + 4 <= ftyp.end; cursor += 4) {
      brands.push(bytesToUtf8Lossy(bytes.subarray(cursor, cursor + 4)).trim());
    }
    properties.compatibleBrands = brands.filter((brand) => brand.length > 0).join(' ');
  }
  if (!moov) {
    throw new ConverterBoundary('unsupported', 'The container has no moov box within the read window, so no track information is available.');
  }

  const moovChildren = readBoxes(bytes, moov.bodyStart, moov.end, deadline, budget);
  let durationSeconds: number | null = null;
  const mvhd = moovChildren.find((box) => box.type === 'mvhd');
  if (mvhd) {
    const version = bytes[mvhd.bodyStart];
    if (version === 1) {
      const timescale = readUintBE(bytes, mvhd.bodyStart + 20, 4);
      const duration = readUintBE(bytes, mvhd.bodyStart + 24, 8);
      if (timescale > 0) durationSeconds = duration / timescale;
    } else {
      const timescale = readUintBE(bytes, mvhd.bodyStart + 12, 4);
      const duration = readUintBE(bytes, mvhd.bodyStart + 16, 4);
      if (timescale > 0) durationSeconds = duration / timescale;
    }
  }

  const tracks: MediaReport['tracks'] = [];
  for (const trak of moovChildren.filter((box) => box.type === 'trak')) {
    const trakChildren = readBoxes(bytes, trak.bodyStart, trak.end, deadline, budget);
    const mdia = trakChildren.find((box) => box.type === 'mdia');
    if (!mdia) continue;
    const mdiaChildren = readBoxes(bytes, mdia.bodyStart, mdia.end, deadline, budget);
    const hdlr = mdiaChildren.find((box) => box.type === 'hdlr');
    const kind = hdlr ? bytesToUtf8Lossy(bytes.subarray(hdlr.bodyStart + 8, hdlr.bodyStart + 12)) : 'unknown';
    const minf = mdiaChildren.find((box) => box.type === 'minf');
    let codec = 'unknown';
    let detail = '';
    if (minf) {
      const minfChildren = readBoxes(bytes, minf.bodyStart, minf.end, deadline, budget);
      const stbl = minfChildren.find((box) => box.type === 'stbl');
      if (stbl) {
        const stblChildren = readBoxes(bytes, stbl.bodyStart, stbl.end, deadline, budget);
        const stsd = stblChildren.find((box) => box.type === 'stsd');
        if (stsd) {
          const sample = readBoxes(bytes, stsd.bodyStart + 8, stsd.end, deadline, budget)[0];
          if (sample) {
            codec = sample.type;
            if (kind === 'vide') {
              const width = readUintBE(bytes, sample.bodyStart + 24, 2);
              const height = readUintBE(bytes, sample.bodyStart + 26, 2);
              detail = `${width}x${height} pixels`;
            } else if (kind === 'soun') {
              const channels = readUintBE(bytes, sample.bodyStart + 16, 2);
              const sampleRate = readUintBE(bytes, sample.bodyStart + 24, 2);
              detail = `${channels} channel(s), ${sampleRate} Hz`;
            }
          }
        }
      }
    }
    tracks.push({
      index: tracks.length + 1,
      kind: kind === 'vide' ? 'video' : kind === 'soun' ? 'audio' : kind,
      codec,
      detail
    });
  }

  properties.topLevelBoxes = top.map((box) => box.type).join(' ');
  properties.fragmented = top.some((box) => box.type === 'moof') ? 'yes' : 'no';

  return {
    container: 'ISO base media (MP4)',
    tracks,
    durationSeconds: durationSeconds === null ? null : Math.round(durationSeconds * 1000) / 1000,
    properties,
    fileBytes: bytes.length,
    notRecorded: ['per-frame bitrate', 'colour space beyond what the sample entry declares', 'subtitle text']
  };
}

/* ------------------------------------------------------------------ */
/* Matroska / WebM                                                     */
/* ------------------------------------------------------------------ */

function readVint(bytes: Uint8Array, offset: number): { value: number; length: number; masked: number } {
  const first = bytes[offset];
  let length = 1;
  let mask = 0x80;
  while (length <= 8 && (first & mask) === 0) {
    mask >>= 1;
    length += 1;
  }
  if (length > 8) return { value: 0, length: 1, masked: 0 };
  let value = first;
  let masked = first & (mask - 1);
  for (let index = 1; index < length; index += 1) {
    value = value * 256 + bytes[offset + index];
    masked = masked * 256 + bytes[offset + index];
  }
  return { value, length, masked };
}

/** Reads a Matroska or WebM header far enough to name the tracks. */
export function inspectMatroska(bytes: Uint8Array, limits: ResourceLimits, deadline: Deadline): MediaReport {
  if (!startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3])) {
    throw new ConverterBoundary('unsupported', 'The file does not begin with an EBML header.');
  }
  const properties: Record<string, string> = {};
  const tracks: MediaReport['tracks'] = [];
  let durationSeconds: number | null = null;
  let timecodeScale = 1_000_000;

  // A bounded scan: enough to reach the Tracks element without walking clusters.
  const limit = Math.min(bytes.length, 4 * 1024 * 1024);
  let cursor = 0;
  let elements = 0;
  const stack: Array<{ end: number }> = [];

  const MASTER = new Set([0x18538067, 0x1654ae6b, 0xae, 0x1549a966, 0x1a45dfa3, 0xe0, 0xe1]);

  while (cursor < limit) {
    deadline.check();
    elements += 1;
    if (elements > limits.entries) break;

    const id = readVint(bytes, cursor);
    if (id.length === 0) break;
    const size = readVint(bytes, cursor + id.length);
    const bodyStart = cursor + id.length + size.length;
    const bodyEnd = Math.min(bodyStart + size.masked, bytes.length);
    if (bodyEnd <= bodyStart && size.masked !== 0) break;

    let idValue = 0;
    for (let index = 0; index < id.length; index += 1) idValue = idValue * 256 + bytes[cursor + index];

    if (idValue === 0x2ad7b1) {
      timecodeScale = readUintBE(bytes, bodyStart, size.masked);
      properties.timecodeScaleNs = String(timecodeScale);
    } else if (idValue === 0x4489) {
      const view = new DataView(bytes.buffer, bytes.byteOffset + bodyStart, size.masked);
      const raw = size.masked === 4 ? view.getFloat32(0) : size.masked === 8 ? view.getFloat64(0) : 0;
      durationSeconds = (raw * timecodeScale) / 1_000_000_000;
    } else if (idValue === 0x86) {
      const codec = bytesToUtf8Lossy(bytes.subarray(bodyStart, bodyEnd)).replace(/\0+$/, '');
      tracks.push({ index: tracks.length + 1, kind: codec.startsWith('V_') ? 'video' : codec.startsWith('A_') ? 'audio' : 'other', codec, detail: '' });
    } else if (idValue === 0x4282) {
      properties.docType = bytesToUtf8Lossy(bytes.subarray(bodyStart, bodyEnd)).replace(/\0+$/, '');
    } else if (idValue === 0x1f43b675) {
      // A cluster: everything past this point is media data.
      break;
    }

    cursor = MASTER.has(idValue) ? bodyStart : bodyEnd;
    while (stack.length > 0 && cursor >= stack[stack.length - 1].end) stack.pop();
  }

  return {
    container: properties.docType === 'webm' ? 'Matroska (WebM profile)' : 'Matroska',
    tracks,
    durationSeconds: durationSeconds === null ? null : Math.round(durationSeconds * 1000) / 1000,
    properties,
    fileBytes: bytes.length,
    notRecorded: ['per-cluster timing', 'chapter and tag elements past the first cluster', 'attachment contents']
  };
}
