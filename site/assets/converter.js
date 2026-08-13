/* World Downloader Studio -- the site's universal file converter.
 *
 * Pure static JavaScript, no build step, no bundler, no third-party
 * dependency. Everything below either uses a browser API that ships
 * with the browser itself (canvas, TextDecoder/TextEncoder, the File
 * and Blob APIs) or is a hand-written implementation of the format in
 * question (the binary-to-text codecs, the delimited-text reader and
 * writer, the documented YAML subset, and the small XML parser). None
 * of it calls out to a network, and none of it needs a server.
 *
 * Registration: window.StudioConverter = { mount: function (host) {},
 * _internal: { ...pure functions, for testing... } }. Call mount(host)
 * from inside Studio.ready(), once the runtime has booted, with the
 * element this feature should render into.
 *
 * Rows satisfied (FEATURE_INVENTORY.md):
 *   11.1  A categorized, searchable adapter catalog across all eight
 *         categories, each with its own search bar and anchored regex
 *         builder (Studio.createSearchBar already carries the builder).
 *   11.2  Enabled means bundled, offline and sandboxed to this page --
 *         nothing here is "enabled" because a tool happens to sit on
 *         somebody's PATH, because there is no PATH here to discover.
 *   11.3  PDF tools are listed and honestly disabled -- see the long
 *         comment above the ADAPTERS catalog for exactly why.
 *   11.4  The queue is bounded rather than claiming to be unlimited,
 *         and says so plainly. See "Bounds" below.
 * ------------------------------------------------------------------ */
(function () {
  'use strict';

  /* ================================================================
   * 1. Small pure utilities
   * ================================================================ */
  function humanBytes(n) {
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    if (n < 1024 * 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + ' MB';
    return (n / 1024 / 1024 / 1024).toFixed(2) + ' GB';
  }
  function swapExt(filename, newExt) {
    var name = String(filename || 'file');
    var base = name.replace(/\.[^./\\]+$/, '');
    if (!base) base = name;
    return base + '.' + newExt;
  }
  function concatU8(chunks, totalLen) {
    var out = new Uint8Array(totalLen);
    var offset = 0;
    for (var i = 0; i < chunks.length; i++) {
      out.set(chunks[i], offset);
      offset += chunks[i].length;
    }
    return out;
  }
  function makeSkipped(msg) { var e = new Error(msg); e.__skipped = true; return e; }
  function makeCancelled() { var e = new Error('Cancelled.'); e.__cancelled = true; return e; }

  /* ================================================================
   * 2. Bounds
   *
   * A browser tab that runs out of memory takes the whole page with
   * it, so nothing here reads a file whole before checking its size,
   * and text-based reads happen in 1 MiB chunks so a read that would
   * exceed the bound can stop before the whole file has been pulled
   * into memory. This is a real, working bound, not a decorative one:
   * see readFileBoundedChunks below.
   * ================================================================ */
  var CHUNK_BYTES = 1024 * 1024;
  var MAX_QUEUE_FILES = 40;
  var CONCURRENCY = 2;
  var SNIFF_BYTES = 512;
  var BOUNDS = {
    images: { maxFileBytes: 60 * 1024 * 1024, maxTotalBytes: 300 * 1024 * 1024 },
    structured: { maxFileBytes: 20 * 1024 * 1024, maxTotalBytes: 150 * 1024 * 1024 },
    code: { maxFileBytes: 20 * 1024 * 1024, maxTotalBytes: 150 * 1024 * 1024 },
    binary: { maxFileBytes: 12 * 1024 * 1024, maxTotalBytes: 80 * 1024 * 1024 }
  };

  function readFileBoundedChunks(file, maxBytes, onProgress, isCancelled) {
    return new Promise(function (resolve, reject) {
      if (file.size > maxBytes) {
        reject(makeSkipped('This file is ' + humanBytes(file.size) + ', which is over the ' + humanBytes(maxBytes) + ' bound for this adapter.'));
        return;
      }
      if (!file.stream) {
        var fr = new FileReader();
        fr.onerror = function () { reject(new Error('The file could not be read.')); };
        fr.onload = function () { resolve(new Uint8Array(fr.result)); };
        fr.readAsArrayBuffer(file);
        return;
      }
      var reader;
      try { reader = file.stream().getReader(); }
      catch (e) { reject(e); return; }
      var chunks = [];
      var received = 0;
      function pump() {
        if (isCancelled && isCancelled()) {
          try { reader.cancel(); } catch (e2) { /* already closed */ }
          reject(makeCancelled());
          return;
        }
        reader.read().then(function (res) {
          if (res.done) { resolve(concatU8(chunks, received)); return; }
          received += res.value.length;
          if (received > maxBytes) {
            try { reader.cancel(); } catch (e3) { /* already closed */ }
            reject(makeSkipped('The file passed ' + humanBytes(maxBytes) + ' while it was being read, so reading stopped and no partial result was kept.'));
            return;
          }
          chunks.push(res.value);
          if (onProgress) onProgress(received, file.size);
          pump();
        }, reject);
      }
      pump();
    });
  }

  /* ================================================================
   * 3. Byte-inspection type detection
   *
   * The extension is never trusted on its own: the first bytes of the
   * file are read (bounded to SNIFF_BYTES) and matched against real
   * magic numbers. A file with no recognised magic number falls back
   * to a best-effort guess about whether its opening bytes look like
   * one of the text-based formats this page also handles.
   * ================================================================ */
  function bytesStartWith(u8, arr, offset) {
    offset = offset || 0;
    if (u8.length < offset + arr.length) return false;
    for (var i = 0; i < arr.length; i++) if (u8[offset + i] !== arr[i]) return false;
    return true;
  }
  function bytesAsciiAt(u8, offset, str) {
    if (u8.length < offset + str.length) return false;
    for (var i = 0; i < str.length; i++) if (u8[offset + i] !== str.charCodeAt(i)) return false;
    return true;
  }
  var SIGNATURES = [
    { family: 'documents', label: 'PDF document', test: function (u8) { return bytesAsciiAt(u8, 0, '%PDF-'); } },
    { family: 'archives', label: 'ZIP archive (or a format built on ZIP, such as DOCX, XLSX, ODT or JAR)', test: function (u8) { return bytesStartWith(u8, [0x50, 0x4B, 0x03, 0x04]) || bytesStartWith(u8, [0x50, 0x4B, 0x05, 0x06]) || bytesStartWith(u8, [0x50, 0x4B, 0x07, 0x08]); } },
    { family: 'archives', label: 'gzip archive', test: function (u8) { return bytesStartWith(u8, [0x1F, 0x8B]); } },
    { family: 'archives', label: '7-Zip archive', test: function (u8) { return bytesStartWith(u8, [0x37, 0x7A, 0xBC, 0xAF, 0x27, 0x1C]); } },
    { family: 'archives', label: 'RAR archive', test: function (u8) { return bytesAsciiAt(u8, 0, 'Rar!'); } },
    { family: 'images', label: 'PNG image', test: function (u8) { return bytesStartWith(u8, [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]); } },
    { family: 'images', label: 'JPEG image', test: function (u8) { return bytesStartWith(u8, [0xFF, 0xD8, 0xFF]); } },
    { family: 'images', label: 'GIF image', test: function (u8) { return bytesAsciiAt(u8, 0, 'GIF87a') || bytesAsciiAt(u8, 0, 'GIF89a'); } },
    { family: 'images', label: 'WebP image', test: function (u8) { return bytesAsciiAt(u8, 0, 'RIFF') && bytesAsciiAt(u8, 8, 'WEBP'); } },
    { family: 'images', label: 'BMP image', test: function (u8) { return bytesAsciiAt(u8, 0, 'BM'); } },
    { family: 'images', label: 'ICO icon', test: function (u8) { return bytesStartWith(u8, [0x00, 0x00, 0x01, 0x00]); } },
    { family: 'images', label: 'TIFF image', test: function (u8) { return bytesStartWith(u8, [0x49, 0x49, 0x2A, 0x00]) || bytesStartWith(u8, [0x4D, 0x4D, 0x00, 0x2A]); } },
    { family: 'audio', label: 'WAV audio', test: function (u8) { return bytesAsciiAt(u8, 0, 'RIFF') && bytesAsciiAt(u8, 8, 'WAVE'); } },
    { family: 'audio', label: 'OGG audio or video', test: function (u8) { return bytesAsciiAt(u8, 0, 'OggS'); } },
    { family: 'audio', label: 'MP3 audio', test: function (u8) { return bytesAsciiAt(u8, 0, 'ID3') || bytesStartWith(u8, [0xFF, 0xFB]) || bytesStartWith(u8, [0xFF, 0xF3]) || bytesStartWith(u8, [0xFF, 0xF2]); } },
    { family: 'audio', label: 'FLAC audio', test: function (u8) { return bytesAsciiAt(u8, 0, 'fLaC'); } },
    { family: 'video', label: 'MP4 or MOV video', test: function (u8) { return bytesAsciiAt(u8, 4, 'ftyp'); } },
    { family: 'video', label: 'Matroska or WebM video', test: function (u8) { return bytesStartWith(u8, [0x1A, 0x45, 0xDF, 0xA3]); } },
    { family: 'video', label: 'AVI video', test: function (u8) { return bytesAsciiAt(u8, 0, 'RIFF') && bytesAsciiAt(u8, 8, 'AVI '); } },
    { family: 'documents', label: 'Legacy Microsoft Office document (OLE compound file)', test: function (u8) { return bytesStartWith(u8, [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]); } },
    { family: 'documents', label: 'Rich Text Format document', test: function (u8) { return bytesAsciiAt(u8, 0, '{\\rtf'); } }
  ];
  function bytesToHexPreview(u8) {
    var n = Math.min(u8.length, 16);
    var out = [];
    for (var i = 0; i < n; i++) out.push(('0' + u8[i].toString(16)).slice(-2).toUpperCase());
    return out.join(' ');
  }
  function guessTextFormat(u8) {
    var n = Math.min(u8.length, 512);
    var slice = u8.subarray(0, n);
    var text;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(slice); }
    catch (e) { return null; }
    /* fatal:true above already rejects invalid UTF-8 byte sequences; a
       further control-character check catches valid-but-not-text UTF-8
       such as small binary payloads that happen to decode cleanly. */
    var controlCount = 0, i2;
    for (i2 = 0; i2 < text.length; i2++) {
      var code = text.charCodeAt(i2);
      if (code < 32 && code !== 9 && code !== 10 && code !== 13) controlCount++;
    }
    if (text.length > 0 && controlCount / text.length > 0.05) return null;
    var trimmed = text.replace(/^﻿/, '').replace(/^\s+/, '');
    if (!trimmed) return null;
    if (trimmed.charAt(0) === '{' || trimmed.charAt(0) === '[') return 'Looks like JSON text';
    if (trimmed.charAt(0) === '<') return trimmed.slice(0, 6).toLowerCase() === '<?xml ' ? 'Looks like XML text' : 'Looks like markup (HTML or XML) text';
    if (/^[^\n,]+(,[^\n,]+)+\r?\n/.test(trimmed)) return 'Looks like comma-separated text';
    if (/^[^\n\t]+(\t[^\n\t]+)+\r?\n/.test(trimmed)) return 'Looks like tab-separated text';
    if (/^[\w.\- ]+:\s/.test(trimmed)) return 'Looks like YAML or key-value text';
    return 'Looks like plain text';
  }
  function sniff(u8, filename) {
    for (var i = 0; i < SIGNATURES.length; i++) {
      if (SIGNATURES[i].test(u8)) {
        return { matched: true, family: SIGNATURES[i].family, label: SIGNATURES[i].label, hex: bytesToHexPreview(u8) };
      }
    }
    var textGuess = guessTextFormat(u8);
    if (textGuess) return { matched: true, family: 'text', label: textGuess, hex: bytesToHexPreview(u8) };
    return { matched: false, family: null, label: null, hex: bytesToHexPreview(u8) };
  }
  function guessStructuredId(file, sniffResult) {
    var name = ((file && file.name) || '').toLowerCase();
    if (/\.jsonl$|\.ndjson$/.test(name)) return 'jsonl';
    if (/\.json$/.test(name)) return 'json';
    if (/\.ya?ml$/.test(name)) return 'yaml';
    if (/\.tsv$/.test(name)) return 'tsv';
    if (/\.csv$/.test(name)) return 'csv';
    if (/\.xml$/.test(name)) return 'xml';
    if (sniffResult && sniffResult.label) {
      var l = sniffResult.label.toLowerCase();
      if (l.indexOf('json') !== -1) return 'json';
      if (l.indexOf('xml') !== -1) return 'xml';
      if (l.indexOf('comma') !== -1) return 'csv';
      if (l.indexOf('tab-separated') !== -1) return 'tsv';
      if (l.indexOf('yaml') !== -1) return 'yaml';
    }
    return 'json';
  }

  /* ================================================================
   * 4. Binary-to-text codecs
   *
   * Hand-written, dependency-free, and byte-exact: each one is a real
   * transform on raw bytes rather than a wrapper around a browser
   * convenience meant for strings. base64/base64url decode tolerate
   * both padded and unpadded input, since both are common in the
   * wild.
   * ================================================================ */
  var B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  var B64_LOOKUP = (function () {
    var t = {};
    for (var i = 0; i < B64_CHARS.length; i++) t[B64_CHARS.charAt(i)] = i;
    return t;
  })();
  function base64Encode(bytes) {
    var out = [];
    var i = 0, len = bytes.length;
    for (; i + 3 <= len; i += 3) {
      var n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
      out.push(B64_CHARS.charAt((n >>> 18) & 63), B64_CHARS.charAt((n >>> 12) & 63), B64_CHARS.charAt((n >>> 6) & 63), B64_CHARS.charAt(n & 63));
    }
    var rem = len - i;
    if (rem === 1) {
      var n1 = bytes[i] << 16;
      out.push(B64_CHARS.charAt((n1 >>> 18) & 63), B64_CHARS.charAt((n1 >>> 12) & 63), '=', '=');
    } else if (rem === 2) {
      var n2 = (bytes[i] << 16) | (bytes[i + 1] << 8);
      out.push(B64_CHARS.charAt((n2 >>> 18) & 63), B64_CHARS.charAt((n2 >>> 12) & 63), B64_CHARS.charAt((n2 >>> 6) & 63), '=');
    }
    return out.join('');
  }
  function base64Decode(str) {
    var clean = String(str).replace(/[\r\n\s]+/g, '').replace(/=+$/, '');
    for (var k = 0; k < clean.length; k++) {
      if (!Object.prototype.hasOwnProperty.call(B64_LOOKUP, clean.charAt(k))) {
        throw new Error('That is not valid base64: "' + clean.charAt(k) + '" at position ' + k + ' is not in the alphabet.');
      }
    }
    var groups = Math.floor(clean.length / 4);
    var rem = clean.length % 4;
    if (rem === 1) throw new Error('That is not valid base64: it has a stray trailing character that cannot form a full group.');
    var outLen = groups * 3 + (rem === 2 ? 1 : rem === 3 ? 2 : 0);
    var out = new Uint8Array(outLen);
    var oi = 0, ci = 0;
    function val(ch) { return B64_LOOKUP[ch]; }
    for (; ci + 4 <= clean.length; ci += 4) {
      var n = (val(clean.charAt(ci)) << 18) | (val(clean.charAt(ci + 1)) << 12) | (val(clean.charAt(ci + 2)) << 6) | val(clean.charAt(ci + 3));
      out[oi++] = (n >>> 16) & 255; out[oi++] = (n >>> 8) & 255; out[oi++] = n & 255;
    }
    if (rem === 2) {
      var n2v = (val(clean.charAt(ci)) << 18) | (val(clean.charAt(ci + 1)) << 12);
      out[oi++] = (n2v >>> 16) & 255;
    } else if (rem === 3) {
      var n3v = (val(clean.charAt(ci)) << 18) | (val(clean.charAt(ci + 1)) << 12) | (val(clean.charAt(ci + 2)) << 6);
      out[oi++] = (n3v >>> 16) & 255; out[oi++] = (n3v >>> 8) & 255;
    }
    return out;
  }
  function base64UrlEncode(bytes) {
    return base64Encode(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function base64UrlDecode(str) {
    return base64Decode(String(str).replace(/-/g, '+').replace(/_/g, '/'));
  }
  function hexEncode(bytes) {
    var out = [];
    for (var i = 0; i < bytes.length; i++) out.push(('0' + bytes[i].toString(16)).slice(-2));
    return out.join('');
  }
  function hexDecode(str) {
    var clean = String(str).replace(/[\s:]+/g, '');
    if (clean.length % 2 !== 0) throw new Error('That is not valid hex: it has an odd number of characters (' + clean.length + ').');
    if (!/^[0-9a-fA-F]*$/.test(clean)) throw new Error('That is not valid hex: it contains a character outside 0-9 and a-f.');
    var out = new Uint8Array(clean.length / 2);
    for (var i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
    return out;
  }
  var URL_UNRESERVED = /[A-Za-z0-9\-_.~]/;
  function urlEncode(bytes) {
    var out = '';
    for (var i = 0; i < bytes.length; i++) {
      var c = bytes[i];
      var ch = String.fromCharCode(c);
      if (c < 128 && URL_UNRESERVED.test(ch)) out += ch;
      else out += '%' + ('0' + c.toString(16).toUpperCase()).slice(-2);
    }
    return out;
  }
  function urlDecode(str) {
    var out = [];
    var s = String(str);
    for (var i = 0; i < s.length; i++) {
      var c = s.charAt(i);
      if (c === '%') {
        var hex = s.substr(i + 1, 2);
        if (!/^[0-9a-fA-F]{2}$/.test(hex)) throw new Error('That is not valid percent-encoding: "%' + hex + '" near position ' + i + ' is not two hex digits.');
        out.push(parseInt(hex, 16));
        i += 2;
      } else if (c === '+') {
        out.push(32);
      } else {
        var code = c.charCodeAt(0);
        if (code > 255) throw new Error('That is not valid percent-encoded byte text: it has a character outside the byte range at position ' + i + '.');
        out.push(code);
      }
    }
    return new Uint8Array(out);
  }
  function qpEncode(bytes) {
    var out = [];
    var col = 0;
    function emit(s) {
      if (col + s.length > 75) { out.push('=\r\n'); col = 0; }
      out.push(s); col += s.length;
    }
    for (var i = 0; i < bytes.length; i++) {
      var c = bytes[i];
      if (c === 10) { out.push('\n'); col = 0; continue; }
      if (c === 13) { continue; }
      if ((c >= 33 && c <= 126 && c !== 61) || c === 32 || c === 9) emit(String.fromCharCode(c));
      else emit('=' + ('0' + c.toString(16).toUpperCase()).slice(-2));
    }
    return out.join('');
  }
  function qpDecode(str) {
    var out = [];
    var s = String(str).replace(/\r\n/g, '\n');
    for (var i = 0; i < s.length; i++) {
      var c = s.charAt(i);
      if (c === '=') {
        if (s.charAt(i + 1) === '\n') { i += 1; continue; }
        var hex = s.substr(i + 1, 2);
        if (!/^[0-9a-fA-F]{2}$/.test(hex)) throw new Error('That is not valid quoted-printable: "=' + hex + '" near position ' + i + ' is not two hex digits or a line continuation.');
        out.push(parseInt(hex, 16));
        i += 2;
      } else if (c === '\n') {
        out.push(10);
      } else {
        var code = c.charCodeAt(0);
        if (code > 255) throw new Error('That is not valid quoted-printable text: it has a character outside the byte range at position ' + i + '.');
        out.push(code);
      }
    }
    return new Uint8Array(out);
  }
  var BINARY_CODECS = {
    base64: { encode: base64Encode, decode: base64Decode },
    base64url: { encode: base64UrlEncode, decode: base64UrlDecode },
    hex: { encode: hexEncode, decode: hexDecode },
    url: { encode: urlEncode, decode: urlDecode },
    'quoted-printable': { encode: qpEncode, decode: qpDecode }
  };

  /* ================================================================
   * 5. Text encoding and line endings
   * ================================================================ */
  var TEXT_ENCODINGS = [
    { id: 'utf-8', label: 'UTF-8' },
    { id: 'utf-16le', label: 'UTF-16LE' },
    { id: 'utf-16be', label: 'UTF-16BE' },
    { id: 'windows-1252', label: 'Windows-1252 (a Latin-1 superset)' }
  ];
  var WIN1252_TABLE = (function () {
    var m = {}, i;
    for (i = 0x00; i <= 0x7F; i++) m[i] = i;
    var hi = {
      0x80: 0x20AC, 0x81: 0x0081, 0x82: 0x201A, 0x83: 0x0192, 0x84: 0x201E, 0x85: 0x2026, 0x86: 0x2020, 0x87: 0x2021,
      0x88: 0x02C6, 0x89: 0x2030, 0x8A: 0x0160, 0x8B: 0x2039, 0x8C: 0x0152, 0x8D: 0x008D, 0x8E: 0x017D, 0x8F: 0x008F,
      0x90: 0x0090, 0x91: 0x2018, 0x92: 0x2019, 0x93: 0x201C, 0x94: 0x201D, 0x95: 0x2022, 0x96: 0x2013, 0x97: 0x2014,
      0x98: 0x02DC, 0x99: 0x2122, 0x9A: 0x0161, 0x9B: 0x203A, 0x9C: 0x0153, 0x9D: 0x009D, 0x9E: 0x017E, 0x9F: 0x0178
    };
    Object.keys(hi).forEach(function (k) { m[parseInt(k, 10)] = hi[k]; });
    for (i = 0xA0; i <= 0xFF; i++) m[i] = i;
    return m;
  })();
  var WIN1252_REVERSE = (function () {
    var rev = {};
    Object.keys(WIN1252_TABLE).forEach(function (b) { rev[WIN1252_TABLE[b]] = parseInt(b, 10); });
    return rev;
  })();
  function win1252ByteForCodepoint(cp) {
    return Object.prototype.hasOwnProperty.call(WIN1252_REVERSE, cp) ? WIN1252_REVERSE[cp] : null;
  }
  function decodeText(bytes, encodingId) {
    var dec = new TextDecoder(encodingId, { fatal: false });
    return dec.decode(bytes);
  }
  function encodeText(str, encodingId) {
    var warnings = [];
    if (encodingId === 'utf-8') return { bytes: new TextEncoder().encode(str), warnings: warnings };
    if (encodingId === 'utf-16le' || encodingId === 'utf-16be') {
      var out = new Uint8Array(str.length * 2);
      for (var i = 0; i < str.length; i++) {
        var code = str.charCodeAt(i);
        if (encodingId === 'utf-16le') { out[i * 2] = code & 255; out[i * 2 + 1] = (code >> 8) & 255; }
        else { out[i * 2] = (code >> 8) & 255; out[i * 2 + 1] = code & 255; }
      }
      return { bytes: out, warnings: warnings };
    }
    if (encodingId === 'windows-1252') {
      var bytesArr = [], lossCount = 0;
      for (var j = 0; j < str.length; j++) {
        var b = win1252ByteForCodepoint(str.charCodeAt(j));
        if (b === null) { bytesArr.push(0x3F); lossCount++; }
        else bytesArr.push(b);
      }
      if (lossCount > 0) warnings.push(lossCount + ' character' + (lossCount === 1 ? '' : 's') + ' cannot be represented in Windows-1252 and became "?".');
      return { bytes: new Uint8Array(bytesArr), warnings: warnings };
    }
    throw new Error('Unknown target text encoding: ' + encodingId);
  }
  function estimateWin1252Loss(str) {
    var n = 0;
    for (var i = 0; i < str.length; i++) if (win1252ByteForCodepoint(str.charCodeAt(i)) === null) n++;
    return n;
  }
  function convertLineEndings(str, target) {
    var normalized = str.replace(/\r\n|\r|\n/g, '\n');
    if (target === 'lf') return normalized;
    if (target === 'crlf') return normalized.replace(/\n/g, '\r\n');
    if (target === 'cr') return normalized.replace(/\n/g, '\r');
    return str;
  }

  /* ================================================================
   * 6. Delimited text (CSV / TSV)
   *
   * A real state-machine reader following RFC 4180's quoting rules
   * (a doubled quote inside a quoted field is a literal quote), and a
   * writer that quotes a field only when it must.
   * ================================================================ */
  function parseDelimited(text, delimiter) {
    var rows = [], row = [], field = '', inQuotes = false, i = 0, len = text.length;
    function pushField() { row.push(field); field = ''; }
    function pushRow() { pushField(); rows.push(row); row = []; }
    while (i < len) {
      var c = text.charAt(i);
      if (inQuotes) {
        if (c === '"') {
          if (text.charAt(i + 1) === '"') { field += '"'; i += 2; continue; }
          inQuotes = false; i += 1; continue;
        }
        field += c; i += 1; continue;
      }
      if (c === '"' && field === '') { inQuotes = true; i += 1; continue; }
      if (c === delimiter) { pushField(); i += 1; continue; }
      if (c === '\r') { if (text.charAt(i + 1) === '\n') i += 1; pushRow(); i += 1; continue; }
      if (c === '\n') { pushRow(); i += 1; continue; }
      field += c; i += 1;
    }
    if (field !== '' || row.length > 0) pushRow();
    return rows;
  }
  function delimitedNeedsQuote(field, delimiter) {
    return field.indexOf(delimiter) !== -1 || field.indexOf('"') !== -1 || field.indexOf('\n') !== -1 || field.indexOf('\r') !== -1;
  }
  function delimitedQuoteField(field, delimiter) {
    var s = String(field === null || field === undefined ? '' : field);
    return delimitedNeedsQuote(s, delimiter) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function stringifyDelimited(rows, delimiter) {
    return rows.map(function (row) {
      return row.map(function (f) { return delimitedQuoteField(f, delimiter); }).join(delimiter);
    }).join('\r\n');
  }
  function coerceCell(s) {
    if (s === 'true') return true;
    if (s === 'false') return false;
    if (s !== '' && /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?$/.test(s)) return Number(s);
    return s;
  }
  function delimitedToValue(text, delim, opts) {
    var hasHeader = !opts || opts.hasHeader !== false;
    var rows = parseDelimited(text, delim);
    if (rows.length && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === '') rows.pop();
    if (!hasHeader) return { value: rows, warnings: [] };
    if (rows.length === 0) return { value: [], warnings: [] };
    var header = rows[0];
    var out = rows.slice(1).map(function (row) {
      var obj = {};
      header.forEach(function (h, idx) { obj[h] = row[idx] === undefined ? '' : coerceCell(row[idx]); });
      return obj;
    });
    return { value: out, warnings: [] };
  }
  function valueToDelimited(value, delim) {
    var warnings = [];
    if (!Array.isArray(value)) throw new Error('Only a list of records (an array of objects, or an array of lists) can become CSV or TSV. This document\'s top level is not a list.');
    if (value.length === 0) return { text: '', warnings: warnings };
    var asObjects = value.every(function (v) { return v !== null && typeof v === 'object' && !Array.isArray(v); });
    var rows, flattened = false;
    if (asObjects) {
      var header = [];
      value.forEach(function (obj) { Object.keys(obj).forEach(function (k) { if (header.indexOf(k) === -1) header.push(k); }); });
      rows = [header].concat(value.map(function (obj) {
        return header.map(function (h) {
          var v = obj[h];
          if (v !== null && typeof v === 'object') { flattened = true; return JSON.stringify(v); }
          return v === undefined || v === null ? '' : String(v);
        });
      }));
    } else {
      rows = value.map(function (row) {
        if (!Array.isArray(row)) return [String(row)];
        return row.map(function (v) {
          if (v === undefined || v === null) return '';
          if (typeof v === 'object') { flattened = true; return JSON.stringify(v); }
          return String(v);
        });
      });
    }
    if (flattened) warnings.push('A nested object or list inside a cell was written as its own JSON text; it will come back as text, not structure, next time this is read.');
    return { text: stringifyDelimited(rows, delim), warnings: warnings };
  }

  /* ================================================================
   * 7. JSON and JSON Lines
   * ================================================================ */
  function jsonParse(text) {
    try { return { value: JSON.parse(text), warnings: [] }; }
    catch (e) { throw new Error('That is not valid JSON: ' + e.message); }
  }
  function jsonStringify(value) { return { text: JSON.stringify(value, null, 2) + '\n', warnings: [] }; }
  function jsonlParse(text) {
    var lines = text.split(/\r\n|\r|\n/);
    var out = [];
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (line.trim() === '') continue;
      try { out.push(JSON.parse(line)); }
      catch (e) { throw new Error('Line ' + (i + 1) + ' is not valid JSON: ' + e.message); }
    }
    return { value: out, warnings: [] };
  }
  function jsonlStringify(value) {
    var warnings = [];
    var arr = value;
    if (!Array.isArray(arr)) { arr = [value]; warnings.push('The document was not a top-level list, so it was wrapped in one to produce JSON Lines.'); }
    return { text: arr.map(function (v) { return JSON.stringify(v); }).join('\n') + '\n', warnings: warnings };
  }

  /* ================================================================
   * 8. YAML -- a documented, bounded subset
   *
   * Supported: block mappings and sequences with space indentation,
   * the "- key: value" sequence-of-mappings shorthand, plain, single
   * and double quoted scalars, flow lists [a, b] and flow maps
   * {a: 1}, booleans, null (null or ~), integers and floats, and #
   * comments outside quotes.
   *
   * NOT supported, and rejected with a clear message rather than
   * silently misread: anchors and aliases (& and *), tags (!!),
   * multiple documents, and block scalars (| and >). A tab used for
   * indentation is refused by line number.
   * ================================================================ */
  function yamlSplitLines(text) {
    var raw = text.replace(/\r\n/g, '\n').split('\n');
    var out = [];
    for (var i = 0; i < raw.length; i++) {
      var line = raw[i];
      var m = /^( *)(.*)$/.exec(line);
      var indentPart = m[1];
      var content = m[2];
      if (/^[ ]*\t/.test(line)) throw new Error('Line ' + (i + 1) + ' uses a tab for indentation; this YAML reader only accepts spaces.');
      var trimmedContent = content.replace(/^\s+/, '');
      if (trimmedContent === '---' || trimmedContent === '...') continue;
      var stripped = yamlStripComment(content).replace(/\s+$/, '');
      if (stripped.trim() === '') continue;
      out.push({ indent: indentPart.length, text: stripped.replace(/^\s+/, ''), lineNo: i + 1 });
    }
    return out;
  }
  function yamlStripComment(content) {
    var inSingle = false, inDouble = false;
    for (var i = 0; i < content.length; i++) {
      var c = content.charAt(i);
      if (inSingle) { if (c === "'") inSingle = false; continue; }
      if (inDouble) { if (c === '"' && content.charAt(i - 1) !== '\\') inDouble = false; continue; }
      if (c === "'") { inSingle = true; continue; }
      if (c === '"') { inDouble = true; continue; }
      if (c === '#' && (i === 0 || /\s/.test(content.charAt(i - 1)))) return content.slice(0, i);
    }
    return content;
  }
  function isSeqLine(text) { return text === '-' || text.slice(0, 2) === '- '; }
  function yamlSplitKeyValue(text) {
    var inSingle = false, inDouble = false;
    for (var i = 0; i < text.length; i++) {
      var c = text.charAt(i);
      if (inSingle) { if (c === "'") inSingle = false; continue; }
      if (inDouble) { if (c === '"' && text.charAt(i - 1) !== '\\') inDouble = false; continue; }
      if (c === "'") { inSingle = true; continue; }
      if (c === '"') { inDouble = true; continue; }
      if (c === ':' && (i + 1 === text.length || text.charAt(i + 1) === ' ')) {
        return [text.slice(0, i), text.slice(i + 1).replace(/^\s+/, '')];
      }
    }
    return null;
  }
  function yamlFlowSplitTopLevel(inner) {
    var parts = [], depth = 0, inSingle = false, inDouble = false, start = 0, i;
    for (i = 0; i < inner.length; i++) {
      var c = inner.charAt(i);
      if (inSingle) { if (c === "'") inSingle = false; continue; }
      if (inDouble) { if (c === '"' && inner.charAt(i - 1) !== '\\') inDouble = false; continue; }
      if (c === "'") { inSingle = true; continue; }
      if (c === '"') { inDouble = true; continue; }
      if (c === '[' || c === '{') { depth++; continue; }
      if (c === ']' || c === '}') { depth--; continue; }
      if (c === ',' && depth === 0) { parts.push(inner.slice(start, i)); start = i + 1; }
    }
    var last = inner.slice(start);
    if (last.trim() !== '' || parts.length > 0) parts.push(last);
    return parts.map(function (p) { return p.trim(); }).filter(function (p) { return p !== ''; });
  }
  function yamlParseSingleQuoted(text) {
    if (text.charAt(0) !== "'" || text.length < 2 || text.charAt(text.length - 1) !== "'") {
      throw new Error('A single-quoted YAML value is missing its closing quote: ' + text);
    }
    return text.slice(1, -1).replace(/''/g, "'");
  }
  function yamlParseDoubleQuoted(text) {
    if (text.charAt(0) !== '"' || text.length < 2 || text.charAt(text.length - 1) !== '"') {
      throw new Error('A double-quoted YAML value is missing its closing quote: ' + text);
    }
    var body = text.slice(1, -1), out = '', i;
    for (i = 0; i < body.length; i++) {
      var c = body.charAt(i);
      if (c === '\\') {
        var n = body.charAt(i + 1);
        if (n === 'n') { out += '\n'; i++; }
        else if (n === 't') { out += '\t'; i++; }
        else if (n === 'r') { out += '\r'; i++; }
        else if (n === '"') { out += '"'; i++; }
        else if (n === '\\') { out += '\\'; i++; }
        else if (n === 'u') { out += String.fromCharCode(parseInt(body.substr(i + 2, 4), 16)); i += 5; }
        else { out += n; i++; }
      } else out += c;
    }
    return out;
  }
  function yamlUnquoteScalarText(text) {
    if (text.charAt(0) === "'") return yamlParseSingleQuoted(text);
    if (text.charAt(0) === '"') return yamlParseDoubleQuoted(text);
    return text;
  }
  function yamlParsePlain(text) {
    if (text === 'null' || text === '~') return null;
    if (text === 'true') return true;
    if (text === 'false') return false;
    if (/^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?$/.test(text)) return Number(text);
    return text;
  }
  function yamlParseScalar(raw) {
    var text = raw.trim();
    if (text === '') return null;
    if (text.charAt(0) === '[') return yamlParseFlowList(text);
    if (text.charAt(0) === '{') return yamlParseFlowMap(text);
    if (text.charAt(0) === "'") return yamlParseSingleQuoted(text);
    if (text.charAt(0) === '"') return yamlParseDoubleQuoted(text);
    return yamlParsePlain(text);
  }
  function yamlParseFlowList(text) {
    if (text.charAt(text.length - 1) !== ']') throw new Error('A flow list is missing its closing "]": ' + text);
    var inner = text.slice(1, -1);
    if (inner.trim() === '') return [];
    return yamlFlowSplitTopLevel(inner).map(yamlParseScalar);
  }
  function yamlParseFlowMap(text) {
    if (text.charAt(text.length - 1) !== '}') throw new Error('A flow map is missing its closing "}": ' + text);
    var inner = text.slice(1, -1);
    var out = {};
    if (inner.trim() === '') return out;
    yamlFlowSplitTopLevel(inner).forEach(function (pair) {
      var kv = yamlSplitKeyValue(pair);
      if (!kv) throw new Error('A flow map entry is not "key: value": ' + pair);
      out[yamlUnquoteScalarText(kv[0].trim())] = yamlParseScalar(kv[1]);
    });
    return out;
  }
  function yamlLooksLikeMapKey(text) { return yamlSplitKeyValue(text) !== null; }
  function yamlParseMap(lines, pos, indent) {
    var out = {};
    while (pos.i < lines.length && lines[pos.i].indent === indent && !isSeqLine(lines[pos.i].text)) {
      var line = lines[pos.i];
      var kv = yamlSplitKeyValue(line.text);
      if (!kv) throw new Error('Line ' + line.lineNo + ' is not "key: value" and is not a list item; this YAML reader could not read it.');
      var key = yamlUnquoteScalarText(kv[0].trim());
      var valueText = kv[1];
      if (valueText === '') {
        pos.i += 1;
        if (pos.i < lines.length && lines[pos.i].indent > indent) out[key] = yamlParseBlock(lines, pos, lines[pos.i].indent);
        else out[key] = null;
      } else {
        out[key] = yamlParseScalar(valueText);
        pos.i += 1;
      }
    }
    return out;
  }
  function yamlParseSeq(lines, pos, indent) {
    var out = [];
    while (pos.i < lines.length && lines[pos.i].indent === indent && isSeqLine(lines[pos.i].text)) {
      var line = lines[pos.i];
      var rest = line.text === '-' ? '' : line.text.slice(2);
      if (rest === '') {
        pos.i += 1;
        var nested = (pos.i < lines.length && lines[pos.i].indent > indent) ? yamlParseBlock(lines, pos, lines[pos.i].indent) : null;
        out.push(nested);
      } else if (yamlLooksLikeMapKey(rest)) {
        var subIndent = indent + 2;
        var subLines = [{ indent: subIndent, text: rest, lineNo: line.lineNo }];
        pos.i += 1;
        while (pos.i < lines.length && lines[pos.i].indent >= subIndent) { subLines.push(lines[pos.i]); pos.i += 1; }
        var subPos = { i: 0 };
        out.push(yamlParseMap(subLines, subPos, subIndent));
      } else {
        out.push(yamlParseScalar(rest));
        pos.i += 1;
      }
    }
    return out;
  }
  function yamlParseBlock(lines, pos, indent) {
    if (pos.i >= lines.length || lines[pos.i].indent < indent) return null;
    var first = lines[pos.i];
    if (first.indent > indent) throw new Error('Line ' + first.lineNo + ' is indented further than expected; this YAML reader could not tell which block it belongs to.');
    return isSeqLine(first.text) ? yamlParseSeq(lines, pos, indent) : yamlParseMap(lines, pos, indent);
  }
  function parseYamlSubset(text) {
    var lines = yamlSplitLines(text);
    if (lines.length === 0) return { value: null, warnings: [] };
    var pos = { i: 0 };
    var value = yamlParseBlock(lines, pos, lines[0].indent);
    if (pos.i < lines.length) throw new Error('Line ' + lines[pos.i].lineNo + ' does not fit under the document read so far; check its indentation.');
    return { value: value, warnings: [] };
  }
  function yamlNeedsQuote(s) {
    if (s === '') return true;
    if (/^\s|\s$/.test(s)) return true;
    if (/^(true|false|null|~|-?\d+(\.\d+)?([eE][+-]?\d+)?)$/.test(s)) return true;
    if (/[:#\[\]{}",'&*!|>%@`]/.test(s)) return true;
    if (/^[-?:](\s|$)/.test(s)) return true;
    return false;
  }
  function yamlQuoteScalar(s) { return "'" + String(s).replace(/'/g, "''") + "'"; }
  function yamlScalarText(v) {
    if (v === null || v === undefined) return 'null';
    if (typeof v === 'boolean') return v ? 'true' : 'false';
    if (typeof v === 'number') return String(v);
    var s = String(v);
    return yamlNeedsQuote(s) ? yamlQuoteScalar(s) : s;
  }
  function yamlEmit(value, indent, out) {
    var pad = new Array(indent + 1).join(' ');
    if (Array.isArray(value)) {
      if (value.length === 0) { out.push(pad + '[]'); return; }
      value.forEach(function (item) {
        if (item !== null && typeof item === 'object') {
          out.push(pad + '-');
          yamlEmit(item, indent + 2, out);
        } else {
          out.push(pad + '- ' + yamlScalarText(item));
        }
      });
      return;
    }
    if (value !== null && typeof value === 'object') {
      var keys = Object.keys(value);
      if (keys.length === 0) { out.push(pad + '{}'); return; }
      keys.forEach(function (k) {
        var kt = yamlNeedsQuote(k) ? yamlQuoteScalar(k) : k;
        var v = value[k];
        var isNonEmptyObject = v !== null && typeof v === 'object' && ((Array.isArray(v) && v.length) || (!Array.isArray(v) && Object.keys(v).length));
        if (isNonEmptyObject) { out.push(pad + kt + ':'); yamlEmit(v, indent + 2, out); }
        else if (v !== null && typeof v === 'object') out.push(pad + kt + ': ' + (Array.isArray(v) ? '[]' : '{}'));
        else out.push(pad + kt + ': ' + yamlScalarText(v));
      });
      return;
    }
    out.push(pad + yamlScalarText(value));
  }
  function stringifyYamlSubset(value) {
    var out = [];
    if (value !== null && typeof value === 'object') yamlEmit(value, 0, out);
    else out.push(yamlScalarText(value));
    return { text: out.join('\n') + '\n', warnings: [] };
  }

  /* ================================================================
   * 9. XML -- a small hand-written parser and a generic JSON mapping
   *
   * DOMParser is a browser-only API this converter deliberately does
   * not depend on: its "did this fail" signal (a <parsererror>
   * element left in the returned document) is inconsistent between
   * engines, and a hand-written parser can be exercised directly in a
   * plain JavaScript engine with no DOM at all, which is exactly how
   * this file's own conversion logic was checked before publishing.
   * Namespaced names are kept as opaque strings rather than resolved,
   * which is a documented, bounded simplification.
   * ================================================================ */
  function xmlParse(text) {
    var i = 0, len = text.length;
    function error(msg) { throw new Error('XML: ' + msg + ' at position ' + i + '.'); }
    function skipWs() { while (i < len && /\s/.test(text.charAt(i))) i++; }
    function startsWith(s) { return text.substr(i, s.length) === s; }
    function decodeEntities(s) {
      return s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, function (m, ent) {
        if (ent === 'lt') return '<';
        if (ent === 'gt') return '>';
        if (ent === 'amp') return '&';
        if (ent === 'quot') return '"';
        if (ent === 'apos') return "'";
        if (ent.charAt(0) === '#') {
          var code = (ent.charAt(1) === 'x' || ent.charAt(1) === 'X') ? parseInt(ent.slice(2), 16) : parseInt(ent.slice(1), 10);
          return isNaN(code) ? m : String.fromCharCode(code);
        }
        return m;
      });
    }
    function skipMisc() {
      var progressed = true;
      while (progressed) {
        progressed = false;
        skipWs();
        if (startsWith('<?')) { var end = text.indexOf('?>', i); if (end === -1) error('an unterminated processing instruction'); i = end + 2; progressed = true; continue; }
        if (startsWith('<!--')) { var e2 = text.indexOf('-->', i); if (e2 === -1) error('an unterminated comment'); i = e2 + 3; progressed = true; continue; }
        if (/^<!DOCTYPE/i.test(text.slice(i, i + 9))) {
          var depth = 0, j = i;
          while (j < len) { if (text.charAt(j) === '<') depth++; else if (text.charAt(j) === '>') { depth--; if (depth === 0) { j++; break; } } j++; }
          i = j; progressed = true; continue;
        }
      }
    }
    function parseName() {
      var start = i;
      while (i < len && /[^\s\/>=]/.test(text.charAt(i))) i++;
      if (i === start) error('an element or attribute name');
      return text.slice(start, i);
    }
    function parseAttrs() {
      var attrs = {};
      while (true) {
        skipWs();
        if (startsWith('/>') || startsWith('>')) return attrs;
        var name = parseName();
        skipWs();
        if (text.charAt(i) !== '=') error('"=" after the attribute name "' + name + '"');
        i++;
        skipWs();
        var quote = text.charAt(i);
        if (quote !== '"' && quote !== "'") error('a quoted value for the attribute "' + name + '"');
        i++;
        var vstart = i;
        while (i < len && text.charAt(i) !== quote) i++;
        if (i >= len) error('the closing quote for the attribute "' + name + '"');
        attrs[name] = decodeEntities(text.slice(vstart, i));
        i++;
      }
    }
    function parseElement() {
      if (text.charAt(i) !== '<') error('"<" to start an element');
      i++;
      var tag = parseName();
      var attrs = parseAttrs();
      skipWs();
      if (startsWith('/>')) { i += 2; return { tag: tag, attrs: attrs, children: [] }; }
      if (text.charAt(i) !== '>') error('">" to close the start tag of "' + tag + '"');
      i++;
      var children = [];
      while (true) {
        if (i >= len) error('the closing tag for "' + tag + '" before the document ended');
        if (startsWith('</')) {
          var closeStart = i + 2;
          var closeEnd = text.indexOf('>', closeStart);
          if (closeEnd === -1) error('an unterminated closing tag for "' + tag + '"');
          var closeName = text.slice(closeStart, closeEnd).replace(/\s+$/, '');
          if (closeName !== tag) error('a closing tag "' + closeName + '" that does not match the opening tag "' + tag + '"');
          i = closeEnd + 1;
          break;
        }
        if (startsWith('<!--')) { var ce = text.indexOf('-->', i); if (ce === -1) error('an unterminated comment'); i = ce + 3; continue; }
        if (startsWith('<![CDATA[')) {
          var cstart = i + 9, cend = text.indexOf(']]>', cstart);
          if (cend === -1) error('an unterminated CDATA section');
          children.push(text.slice(cstart, cend));
          i = cend + 3; continue;
        }
        if (startsWith('<?')) { var pe = text.indexOf('?>', i); if (pe === -1) error('an unterminated processing instruction'); i = pe + 2; continue; }
        if (text.charAt(i) === '<') { children.push(parseElement()); continue; }
        var tstart = i;
        while (i < len && text.charAt(i) !== '<') i++;
        var decoded = decodeEntities(text.slice(tstart, i));
        if (decoded.trim() !== '') children.push(decoded);
      }
      return { tag: tag, attrs: attrs, children: children };
    }
    skipMisc();
    if (i >= len || text.charAt(i) !== '<') error('a root element (the document has none)');
    var root = parseElement();
    skipMisc();
    return root;
  }
  function xmlEscapeText(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function xmlEscapeAttr(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }
  function xmlNodeToString(node, indent) {
    var pad = new Array(indent + 1).join('  ');
    var attrStr = Object.keys(node.attrs || {}).map(function (k) { return ' ' + k + '="' + xmlEscapeAttr(node.attrs[k]) + '"'; }).join('');
    var kids = node.children || [];
    if (kids.length === 0) return pad + '<' + node.tag + attrStr + '/>';
    if (kids.length === 1 && typeof kids[0] === 'string') return pad + '<' + node.tag + attrStr + '>' + xmlEscapeText(kids[0]) + '</' + node.tag + '>';
    var inner = kids.map(function (k) {
      return typeof k === 'string' ? new Array(indent + 2).join('  ') + xmlEscapeText(k) : xmlNodeToString(k, indent + 1);
    }).join('\n');
    return pad + '<' + node.tag + attrStr + '>\n' + inner + '\n' + pad + '</' + node.tag + '>';
  }
  function stringifyXmlFromNode(root) {
    return { text: '<?xml version="1.0" encoding="UTF-8"?>\n' + xmlNodeToString(root, 0) + '\n', warnings: [] };
  }
  function xmlNodeToGeneric(node) {
    var out = { tag: node.tag };
    if (node.attrs && Object.keys(node.attrs).length) out['@attrs'] = node.attrs;
    var textParts = (node.children || []).filter(function (c) { return typeof c === 'string'; });
    var elementParts = (node.children || []).filter(function (c) { return typeof c !== 'string'; });
    if (elementParts.length === 0) out.text = textParts.join('').trim();
    else {
      out.children = elementParts.map(xmlNodeToGeneric);
      if (textParts.join('').trim() !== '') out.text = textParts.join('').trim();
    }
    return out;
  }
  function xmlSafeName(name) {
    var s = String(name === undefined || name === null ? 'item' : name);
    s = s.replace(/[^A-Za-z0-9_.-]/g, '_');
    if (!/^[A-Za-z_]/.test(s)) s = '_' + s;
    return s || 'item';
  }
  function genericValueToXmlNodes(value, name) {
    if (value === null || value === undefined) return [{ tag: name, attrs: {}, children: [] }];
    if (Array.isArray(value)) {
      var out = [];
      value.forEach(function (item) { out = out.concat(genericValueToXmlNodes(item, name)); });
      return out;
    }
    if (typeof value === 'object') {
      var children = [];
      Object.keys(value).forEach(function (k) { children = children.concat(genericValueToXmlNodes(value[k], xmlSafeName(k))); });
      return [{ tag: name, attrs: {}, children: children }];
    }
    return [{ tag: name, attrs: {}, children: [String(value)] }];
  }
  function stringifyXmlFromGeneric(value, rootName) {
    var root = xmlSafeName(rootName || 'root');
    var node;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      var kids = [];
      Object.keys(value).forEach(function (k) { kids = kids.concat(genericValueToXmlNodes(value[k], xmlSafeName(k))); });
      node = { tag: root, attrs: {}, children: kids };
    } else if (Array.isArray(value)) {
      var kids2 = [];
      value.forEach(function (item) { kids2 = kids2.concat(genericValueToXmlNodes(item, 'item')); });
      node = { tag: root, attrs: {}, children: kids2 };
    } else {
      node = { tag: root, attrs: {}, children: value === null || value === undefined ? [] : [String(value)] };
    }
    var res = stringifyXmlFromNode(node);
    res.warnings = ['Property names that are not valid XML element names were rewritten using letters, digits, "." "-" and "_" only. A list became repeated elements sharing its property\'s name, which is not reversible with certainty: there is no way to tell a one-item list apart from a single value once it is written back out.'];
    return res;
  }

  /* ================================================================
   * 10. Structured-data registry and its lossy disclosure
   * ================================================================ */
  var STRUCTURED_FORMATS = {
    json: {
      id: 'json', label: 'JSON', ext: 'json', mime: 'application/json',
      parse: function (text) { return jsonParse(text); },
      stringify: function (value) { return jsonStringify(value); }
    },
    jsonl: {
      id: 'jsonl', label: 'JSON Lines', ext: 'jsonl', mime: 'application/jsonl',
      parse: function (text) { return jsonlParse(text); },
      stringify: function (value) { return jsonlStringify(value); }
    },
    yaml: {
      id: 'yaml', label: 'YAML (documented subset)', ext: 'yaml', mime: 'application/yaml',
      parse: function (text) { return parseYamlSubset(text); },
      stringify: function (value) { return stringifyYamlSubset(value); }
    },
    csv: {
      id: 'csv', label: 'CSV', ext: 'csv', mime: 'text/csv',
      parse: function (text, opts) { return delimitedToValue(text, ',', opts); },
      stringify: function (value) { return valueToDelimited(value, ','); }
    },
    tsv: {
      id: 'tsv', label: 'TSV', ext: 'tsv', mime: 'text/tab-separated-values',
      parse: function (text, opts) { return delimitedToValue(text, '\t', opts); },
      stringify: function (value) { return valueToDelimited(value, '\t'); }
    },
    xml: {
      id: 'xml', label: 'XML (generic mapping)', ext: 'xml', mime: 'application/xml',
      parse: function (text) {
        var node = xmlParse(text);
        return { value: xmlNodeToGeneric(node), warnings: ['XML was read into a generic { tag, "@attrs", text, children } shape rather than one made just for this document.'] };
      },
      stringify: function (value, opts) { return stringifyXmlFromGeneric(value, opts && opts.rootName); }
    }
  };
  function structuredLossyNotes(fromId, toId) {
    var notes = [];
    if (fromId === 'yaml' || toId === 'yaml') {
      notes.push('This site\'s YAML reader and writer support a documented subset of YAML: block mappings and sequences, quoted and plain scalars, flow lists and maps, booleans, null, numbers and comments. Anchors, aliases, tags, multiple documents and block scalars (| and >) are not supported.');
    }
    if (fromId === 'xml') notes.push('XML is read into a generic shape (tag, attributes, text, children); the result reflects that shape rather than one made just for this document.');
    if (toId === 'xml') notes.push('XML has no equivalent for arbitrary data: property names that are not valid element names are rewritten, and a list becomes repeated elements under the same name, which cannot be told apart from a single value once written.');
    if (toId === 'csv' || toId === 'tsv') notes.push('A nested object or list inside a value is written as its own JSON text inside one cell, and comes back as text rather than structure if converted again.');
    if (fromId === 'csv' || fromId === 'tsv') notes.push('Every cell is read as text unless it is exactly true, false, or a plain number, so a value such as a postal code with a leading zero may change.');
    return notes;
  }

  /* ================================================================
   * 11. The adapter catalog
   *
   * Every category from the brief is present. Four adapters genuinely
   * work in this browser, offline, with nothing to fetch: image
   * raster conversion through canvas, structured-data conversion
   * among JSON/JSONL/YAML/CSV/TSV/XML, text-encoding and line-ending
   * conversion, and the binary-to-text codecs above. Everything else
   * -- PDF, audio, video, archives, office documents, spreadsheets --
   * is listed and disabled with the exact missing capability. None of
   * it is hidden, and none of it pretends a tool on some developer's
   * PATH would make it work: there is no PATH here, only this page.
   * ================================================================ */
  var CATEGORIES = [
    { id: 'documents', labelKey: 'conv.cat.documents' },
    { id: 'images', labelKey: 'conv.cat.images' },
    { id: 'audio', labelKey: 'conv.cat.audio' },
    { id: 'video', labelKey: 'conv.cat.video' },
    { id: 'archives', labelKey: 'conv.cat.archives' },
    { id: 'structured', labelKey: 'conv.cat.structured' },
    { id: 'code', labelKey: 'conv.cat.code' },
    { id: 'binary', labelKey: 'conv.cat.binary' }
  ];

  function convertImageFile(file, opts, onProgress, isCancelled) {
    if (file.size > BOUNDS.images.maxFileBytes) {
      return Promise.reject(makeSkipped('This image is ' + humanBytes(file.size) + ', over the ' + humanBytes(BOUNDS.images.maxFileBytes) + ' bound for the image adapter.'));
    }
    return decodeImageSource(file).then(function (decoded) {
      if (isCancelled && isCancelled()) { if (decoded.close) decoded.close(); throw makeCancelled(); }
      var srcW = decoded.width, srcH = decoded.height, w = srcW, h = srcH;
      if (opts.resize) {
        if (opts.keepAspect) {
          var scale = Math.min(opts.maxWidth / srcW, opts.maxHeight / srcH, 1);
          w = Math.max(1, Math.round(srcW * scale));
          h = Math.max(1, Math.round(srcH * scale));
        } else {
          w = Math.max(1, Math.min(srcW, opts.maxWidth));
          h = Math.max(1, Math.min(srcH, opts.maxHeight));
        }
      }
      var canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      var ctx = canvas.getContext('2d');
      if (opts.target === 'jpeg') { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h); }
      ctx.drawImage(decoded.draw, 0, 0, w, h);
      if (onProgress) onProgress(70, 100);
      if (decoded.close) decoded.close();
      var mime = opts.target === 'png' ? 'image/png' : (opts.target === 'jpeg' ? 'image/jpeg' : 'image/webp');
      return new Promise(function (resolve, reject) {
        canvas.toBlob(function (blob) {
          if (!blob) { reject(new Error('This browser could not encode a ' + opts.target.toUpperCase() + ' from that image.')); return; }
          if (onProgress) onProgress(100, 100);
          resolve({ blob: blob, filename: swapExt(file.name, opts.target === 'jpeg' ? 'jpg' : opts.target), mime: mime });
        }, mime, (opts.target === 'jpeg' || opts.target === 'webp') ? opts.quality : undefined);
      });
    });
  }
  function decodeImageSource(file) {
    if (window.createImageBitmap) {
      return window.createImageBitmap(file).then(function (bmp) {
        return { width: bmp.width, height: bmp.height, draw: bmp, close: function () { bmp.close(); } };
      }).catch(function () { return decodeViaImgTag(file); });
    }
    return decodeViaImgTag(file);
  }
  function decodeViaImgTag(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () { resolve({ width: img.naturalWidth, height: img.naturalHeight, draw: img, close: function () { URL.revokeObjectURL(url); } }); };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('This browser could not decode that as an image.')); };
      img.src = url;
    });
  }
  function convertStructuredFile(file, opts, onProgress, isCancelled) {
    var bound = BOUNDS.structured.maxFileBytes;
    if (file.size > bound) return Promise.reject(makeSkipped('This file is ' + humanBytes(file.size) + ', over the ' + humanBytes(bound) + ' bound for structured-data conversion.'));
    return readFileBoundedChunks(file, bound, onProgress, isCancelled).then(function (bytes) {
      var text = decodeText(bytes, 'utf-8');
      var fromFmt = STRUCTURED_FORMATS[opts.from], toFmt = STRUCTURED_FORMATS[opts.to];
      var parsed;
      try { parsed = fromFmt.parse(text, opts); }
      catch (e) { throw new Error('Could not read this as ' + fromFmt.label + ': ' + e.message); }
      var written;
      try { written = toFmt.stringify(parsed.value, opts); }
      catch (e) { throw new Error('Could not write this as ' + toFmt.label + ': ' + e.message); }
      return { text: written.text, filename: swapExt(file.name, toFmt.ext), mime: toFmt.mime + ';charset=utf-8' };
    });
  }
  function convertTextEncodingFile(file, opts, onProgress, isCancelled) {
    var bound = BOUNDS.code.maxFileBytes;
    if (file.size > bound) return Promise.reject(makeSkipped('This file is ' + humanBytes(file.size) + ', over the ' + humanBytes(bound) + ' bound for text-encoding conversion.'));
    return readFileBoundedChunks(file, bound, onProgress, isCancelled).then(function (bytes) {
      var text;
      try { text = decodeText(bytes, opts.fromEnc); }
      catch (e) { throw new Error('This browser could not decode the source as ' + opts.fromEnc + ': ' + e.message); }
      text = convertLineEndings(text, opts.lineEnding);
      var encoded;
      try { encoded = encodeText(text, opts.toEnc); }
      catch (e) { throw new Error('This browser could not encode the output as ' + opts.toEnc + ': ' + e.message); }
      return { bytes: encoded.bytes, filename: file.name, mime: 'text/plain', warnings: encoded.warnings };
    });
  }
  function convertBinaryFile(file, opts, onProgress, isCancelled) {
    var bound = BOUNDS.binary.maxFileBytes;
    if (file.size > bound) return Promise.reject(makeSkipped('This file is ' + humanBytes(file.size) + ', over the ' + humanBytes(bound) + ' bound for a binary-encoding conversion.'));
    return readFileBoundedChunks(file, bound, onProgress, isCancelled).then(function (raw) {
      var bytes;
      if (opts.from === 'raw') bytes = raw;
      else {
        var text = decodeText(raw, 'utf-8');
        try { bytes = BINARY_CODECS[opts.from].decode(text); }
        catch (e) { throw new Error('Could not read the source as ' + opts.from + ': ' + e.message); }
      }
      if (opts.to === 'raw') return { bytes: bytes, filename: swapExt(file.name, 'bin'), mime: 'application/octet-stream' };
      var outText;
      try { outText = BINARY_CODECS[opts.to].encode(bytes); }
      catch (e) { throw new Error('Could not write the output as ' + opts.to + ': ' + e.message); }
      return { text: outText, filename: swapExt(file.name, opts.to === 'quoted-printable' ? 'qp.txt' : (opts.to + '.txt')), mime: 'text/plain' };
    });
  }

  var ADAPTERS = [
    { id: 'pdf.tools', category: 'documents', enabled: false, labelKey: 'conv.adapter.pdfTools.label', reasonKey: 'conv.adapter.pdfTools.reason', keywords: 'pdf split merge extract rotate metadata inspect reorder' },
    { id: 'pdf.toFromImage', category: 'documents', enabled: false, labelKey: 'conv.adapter.pdfImage.label', reasonKey: 'conv.adapter.pdfImage.reason', keywords: 'pdf render page image' },
    { id: 'office.docs', category: 'documents', enabled: false, labelKey: 'conv.adapter.office.label', reasonKey: 'conv.adapter.office.reason', keywords: 'docx doc rtf odt pptx office word powerpoint' },

    {
      id: 'image.raster', category: 'images', enabled: true,
      labelKey: 'conv.adapter.image.label', sourceNoteKey: 'conv.adapter.image.note',
      keywords: 'image picture png jpeg jpg webp resize photo raster',
      buildPanel: function (container, files, sniffs, notifyChange, S, t, el) {
        var opts = { target: 'png', quality: 0.9, resize: false, maxWidth: 1920, maxHeight: 1080, keepAspect: true };
        var targetSel = S.createSelect({
          label: t('conv.field.convertTo'), storageKey: 'conv-image-target', value: opts.target,
          options: [
            { value: 'png', label: 'PNG', keywords: 'lossless transparent' },
            { value: 'jpeg', label: 'JPEG', keywords: 'lossy photo' },
            { value: 'webp', label: 'WebP', keywords: 'modern lossy lossless' }
          ],
          onChange: function (v) { opts.target = v; updateVisibility(); notifyChange(); }
        });
        var qualityWrap = el('div', { class: 'cv-field' });
        var qualitySlider = S.makeSlider({
          min: 0.4, max: 1, step: 0.05, value: opts.quality, ariaLabel: t('conv.field.quality'),
          format: function (v) { return Math.round(parseFloat(v) * 100) + '%'; },
          onInput: function (v) { opts.quality = parseFloat(v); },
          onChange: function (v) { opts.quality = parseFloat(v); notifyChange(); }
        });
        qualityWrap.appendChild(el('label', { class: 'cap', text: t('conv.field.quality') }));
        qualityWrap.appendChild(qualitySlider);
        var resizeToggle = S.makeSwitch({ checked: opts.resize, ariaLabel: t('conv.field.resize'), onChange: function (v) { opts.resize = v; updateVisibility(); notifyChange(); } });
        var widthInput = el('input', { class: 'cv-native', type: 'number', min: '1', value: String(opts.maxWidth), 'aria-label': 'Maximum width in pixels', oninput: function () { opts.maxWidth = parseInt(widthInput.value, 10) || opts.maxWidth; notifyChange(); } });
        var heightInput = el('input', { class: 'cv-native', type: 'number', min: '1', value: String(opts.maxHeight), 'aria-label': 'Maximum height in pixels', oninput: function () { opts.maxHeight = parseInt(heightInput.value, 10) || opts.maxHeight; notifyChange(); } });
        var keepAspectToggle = S.makeSwitch({ checked: opts.keepAspect, ariaLabel: t('conv.field.keepAspect'), onChange: function (v) { opts.keepAspect = v; notifyChange(); } });
        var resizeRow = el('div', { class: 'cv-field' }, [
          el('div', { class: 'row' }, [el('span', { class: 'cap', text: t('conv.field.resize') }), resizeToggle]),
          el('div', { class: 'row cv-dims' }, [widthInput, el('span', { text: '×' }), heightInput, el('span', { class: 'cap', text: 'px' })]),
          el('div', { class: 'row' }, [el('span', { class: 'cap', text: t('conv.field.keepAspect') }), keepAspectToggle])
        ]);
        function updateVisibility() {
          qualityWrap.hidden = opts.target === 'png';
          widthInput.disabled = !opts.resize;
          heightInput.disabled = !opts.resize;
        }
        updateVisibility();
        container.appendChild(el('div', { class: 'cv-panel-body' }, [
          el('div', { class: 'cv-field' }, targetSel.el),
          qualityWrap, resizeRow
        ]));
        return {
          lossyNotes: function () {
            var notes = [];
            if (opts.target === 'jpeg') notes.push(t('conv.lossy.jpegAlpha'));
            if ((opts.target === 'jpeg' || opts.target === 'webp') && opts.quality < 1) notes.push(t('conv.lossy.quality') + ' ' + Math.round(opts.quality * 100) + '%.');
            if (opts.resize) notes.push(t('conv.lossy.resize') + ' ' + opts.maxWidth + '×' + opts.maxHeight + 'px.');
            notes.push(t('conv.lossy.oneFrame'));
            return notes;
          },
          run: function (file, onProgress, isCancelled) { return convertImageFile(file, opts, onProgress, isCancelled); }
        };
      }
    },
    { id: 'image.vector', category: 'images', enabled: false, labelKey: 'conv.adapter.vector.label', reasonKey: 'conv.adapter.vector.reason', keywords: 'svg vector trace' },
    { id: 'image.heicAvif', category: 'images', enabled: false, labelKey: 'conv.adapter.heic.label', reasonKey: 'conv.adapter.heic.reason', keywords: 'heic heif avif' },

    { id: 'audio.transcode', category: 'audio', enabled: false, labelKey: 'conv.adapter.audio.label', reasonKey: 'conv.adapter.audio.reason', keywords: 'audio wav mp3 flac ogg aac sound transcode' },
    { id: 'video.transcode', category: 'video', enabled: false, labelKey: 'conv.adapter.video.label', reasonKey: 'conv.adapter.video.reason', keywords: 'video mp4 webm mov gif transcode' },
    { id: 'archive.tools', category: 'archives', enabled: false, labelKey: 'conv.adapter.archive.label', reasonKey: 'conv.adapter.archive.reason', keywords: 'zip 7z tar gzip archive compress extract' },

    {
      id: 'structured.convert', category: 'structured', enabled: true,
      labelKey: 'conv.adapter.structured.label', sourceNoteKey: 'conv.adapter.structured.note',
      keywords: 'json yaml csv tsv xml structured data convert',
      buildPanel: function (container, files, sniffs, notifyChange, S, t, el) {
        var guessedFrom = guessStructuredId(files[0], sniffs[0]);
        var opts = { from: guessedFrom, to: guessedFrom === 'json' ? 'yaml' : 'json', hasHeader: true, rootName: 'root' };
        var listOpts = Object.keys(STRUCTURED_FORMATS).map(function (id) { return { value: id, label: STRUCTURED_FORMATS[id].label }; });
        var fromSel = S.createSelect({ label: t('conv.field.fromFormat'), storageKey: 'conv-struct-from', value: opts.from, options: listOpts, onChange: function (v) { opts.from = v; updateVisibility(); notifyChange(); } });
        var toSel = S.createSelect({ label: t('conv.field.toFormat'), storageKey: 'conv-struct-to', value: opts.to, options: listOpts, onChange: function (v) { opts.to = v; updateVisibility(); notifyChange(); } });
        var headerToggle = S.makeSwitch({ checked: opts.hasHeader, ariaLabel: t('conv.field.header'), onChange: function (v) { opts.hasHeader = v; notifyChange(); } });
        var headerRow = el('div', { class: 'cv-field' }, el('div', { class: 'row' }, [el('span', { class: 'cap', text: t('conv.field.header') }), headerToggle]));
        var rootInput = el('input', { class: 'cv-native', type: 'text', value: opts.rootName, 'aria-label': t('conv.field.rootName'), oninput: function () { opts.rootName = rootInput.value || 'root'; notifyChange(); } });
        var rootRow = el('div', { class: 'cv-field' }, [el('label', { class: 'cap', text: t('conv.field.rootName') }), rootInput]);
        function updateVisibility() {
          headerRow.hidden = !(opts.from === 'csv' || opts.from === 'tsv' || opts.to === 'csv' || opts.to === 'tsv');
          rootRow.hidden = opts.to !== 'xml';
        }
        updateVisibility();
        container.appendChild(el('div', { class: 'cv-panel-body' }, [
          el('div', { class: 'cv-field' }, fromSel.el),
          el('div', { class: 'cv-field' }, toSel.el),
          headerRow, rootRow
        ]));
        return {
          lossyNotes: function () { return structuredLossyNotes(opts.from, opts.to); },
          run: function (file, onProgress, isCancelled) { return convertStructuredFile(file, opts, onProgress, isCancelled); }
        };
      }
    },
    { id: 'spreadsheet.xlsx', category: 'structured', enabled: false, labelKey: 'conv.adapter.xlsx.label', reasonKey: 'conv.adapter.xlsx.reason', keywords: 'xlsx ods excel spreadsheet' },

    {
      id: 'code.textEncoding', category: 'code', enabled: true,
      labelKey: 'conv.adapter.text.label', sourceNoteKey: 'conv.adapter.text.note',
      keywords: 'text encoding utf-8 utf-16 windows-1252 line endings crlf lf',
      buildPanel: function (container, files, sniffs, notifyChange, S, t, el) {
        var opts = { fromEnc: 'utf-8', toEnc: 'utf-8', lineEnding: 'keep' };
        var encOptions = TEXT_ENCODINGS.map(function (e) { return { value: e.id, label: e.label }; });
        var fromSel = S.createSelect({ label: t('conv.field.readAs'), storageKey: 'conv-text-from', value: opts.fromEnc, options: encOptions, onChange: function (v) { opts.fromEnc = v; notifyChange(); } });
        var toSel = S.createSelect({ label: t('conv.field.writeAs'), storageKey: 'conv-text-to', value: opts.toEnc, options: encOptions, onChange: function (v) { opts.toEnc = v; notifyChange(); } });
        var lineSel = S.createSelect({
          label: t('conv.field.lineEndings'), storageKey: 'conv-text-line', value: opts.lineEnding,
          options: [
            { value: 'keep', label: 'Keep as they are' },
            { value: 'lf', label: 'LF (Unix and macOS)' },
            { value: 'crlf', label: 'CRLF (Windows)' },
            { value: 'cr', label: 'CR (classic Mac, rare)' }
          ],
          onChange: function (v) { opts.lineEnding = v; notifyChange(); }
        });
        container.appendChild(el('div', { class: 'cv-panel-body' }, [
          el('div', { class: 'cv-field' }, fromSel.el),
          el('div', { class: 'cv-field' }, toSel.el),
          el('div', { class: 'cv-field' }, lineSel.el)
        ]));
        return {
          lossyNotes: function () {
            var notes = [];
            if (opts.fromEnc !== opts.toEnc) notes.push(t('conv.lossy.reencode'));
            if (opts.toEnc === 'windows-1252') notes.push(t('conv.lossy.win1252'));
            if (opts.lineEnding !== 'keep') notes.push(t('conv.lossy.lineEndings'));
            return notes;
          },
          run: function (file, onProgress, isCancelled) { return convertTextEncodingFile(file, opts, onProgress, isCancelled); }
        };
      }
    },
    { id: 'code.formatMinify', category: 'code', enabled: false, labelKey: 'conv.adapter.format.label', reasonKey: 'conv.adapter.format.reason', keywords: 'format minify prettify code' },

    {
      id: 'binary.codec', category: 'binary', enabled: true,
      labelKey: 'conv.adapter.binary.label', sourceNoteKey: 'conv.adapter.binary.note',
      keywords: 'base64 base64url hex percent encoding quoted printable binary',
      buildPanel: function (container, files, sniffs, notifyChange, S, t, el) {
        var opts = { from: 'raw', to: 'base64' };
        var codecOptions = [
          { value: 'raw', label: t('conv.binary.raw') },
          { value: 'base64', label: 'Base64' },
          { value: 'base64url', label: 'Base64url' },
          { value: 'hex', label: 'Hex' },
          { value: 'url', label: 'URL percent-encoding' },
          { value: 'quoted-printable', label: 'Quoted-printable' }
        ];
        var fromSel = S.createSelect({ label: t('conv.field.holds'), storageKey: 'conv-bin-from', value: opts.from, options: codecOptions, onChange: function (v) { opts.from = v; notifyChange(); } });
        var toSel = S.createSelect({ label: t('conv.field.convertItTo'), storageKey: 'conv-bin-to', value: opts.to, options: codecOptions, onChange: function (v) { opts.to = v; notifyChange(); } });
        container.appendChild(el('div', { class: 'cv-panel-body' }, [
          el('div', { class: 'cv-field' }, fromSel.el),
          el('div', { class: 'cv-field' }, toSel.el)
        ]));
        return {
          lossyNotes: function () {
            var notes = [];
            if (opts.from === opts.to) notes.push(t('conv.lossy.sameForm'));
            if (opts.from === 'quoted-printable' || opts.to === 'quoted-printable') notes.push(t('conv.lossy.qpCr'));
            if (opts.from === 'url') notes.push(t('conv.lossy.urlPlus'));
            return notes;
          },
          run: function (file, onProgress, isCancelled) { return convertBinaryFile(file, opts, onProgress, isCancelled); }
        };
      }
    },
    { id: 'binary.legacy', category: 'binary', enabled: false, labelKey: 'conv.adapter.legacy.label', reasonKey: 'conv.adapter.legacy.reason', keywords: 'uuencode yenc legacy' }
  ];

  /* ================================================================
   * 12. Downloading a result
   * ================================================================ */
  function triggerBlobDownload(filename, blob) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename; a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }
  function resultToBlob(result) {
    if (result.blob) return result.blob;
    if (result.bytes) return new Blob([result.bytes], { type: result.mime || 'application/octet-stream' });
    return new Blob([result.text], { type: (result.mime || 'text/plain') + ';charset=utf-8' });
  }

  /* ================================================================
   * 13. i18n copy
   *
   * Five variants, lowest funny level first, in both English and
   * playful Hong Kong-style Cantonese, exactly as every other page on
   * this site. Facts -- which bound, which format, what changes --
   * stay identical at every level; only the telling moves. Adapter
   * names, category names, field labels and the disabled-adapter
   * reasons are near-constant technical facts, so they use same()
   * exactly as the settings page's own tab labels do; the lede, the
   * empty states and the lossy-disclosure sentences are messages, so
   * they carry the full five-level voice.
   * ================================================================ */
  function same(en, zh) { return { en: [en, en, en, en, en], zh: [zh, zh, zh, zh, zh] }; }
  var copy = {
    'conv.lede': {
      en: [
        'Convert files in this browser. Nothing is uploaded: every conversion below runs on this page, using only what this browser itself can decode and encode.',
        'Convert files in this browser. Nothing is uploaded: every conversion below runs on this page, using only what this browser itself can decode and encode.',
        'Convert files right here in this browser. Nothing gets uploaded anywhere: every conversion below runs on this page, using only what this browser can decode and encode by itself.',
        'Convert files right here in this browser, with nothing uploaded anywhere at all: every conversion below runs on this page, using only what this browser can decode and encode by itself, and not one byte further than that.',
        'Convert files right here in this browser, with nothing uploaded anywhere at all, not even a little: every conversion below runs on this very page, using only what this browser can decode and encode by itself -- which, as it turns out, is more than you might think, and rather less than a real desktop app.'
      ],
      zh: [
        '喺呢個瀏覽器度轉換檔案。乜都唔會上載：下面每個轉換都喺呢版度行，淨係用呢個瀏覽器本身識解碼同編碼嘅嘢。',
        '喺呢個瀏覽器度轉換檔案。乜都唔會上載：下面每個轉換都喺呢版度行，淨係用呢個瀏覽器本身識解碼同編碼嘅嘢。',
        '轉換檔案就喺呢個瀏覽器度做。乜都唔會上載去邊度：下面每個轉換都喺呢版行緊，淨係用呢個瀏覽器自己識嘅解碼同編碼。',
        '轉換檔案就喺呢個瀏覽器度做，乜都唔會上載去邊度，一個位元組都唔會：下面每個轉換都喺呢版行緊，淨係用呢個瀏覽器自己識嘅解碼同編碼。',
        '轉換檔案就喺呢個瀏覽器度做，乜都唔會上載去邊度，一個位元組都唔會，認真：下面每個轉換都喺呢版行緊，淨係用呢個瀏覽器自己識嘅解碼同編碼——講出嚟可能仲多過你估，不過梗係無桌面應用程式咁多。'
      ]
    },
    'conv.boundsNote': {
      en: [
        'A browser tab that runs out of memory takes the whole page down, so every adapter here has a per-file size bound and files are read in chunks so a bound can stop a read before the whole file is in memory. Up to ' + MAX_QUEUE_FILES + ' files can be queued at once. The desktop application\'s converter carries an unbounded queue; this page does not, and says so rather than pretending otherwise.',
        'A browser tab that runs out of memory takes the whole page down, so every adapter here has a per-file size bound and files are read in chunks so a bound can stop a read before the whole file is in memory. Up to ' + MAX_QUEUE_FILES + ' files can be queued at once. The desktop application\'s converter carries an unbounded queue; this page does not, and says so rather than pretending otherwise.',
        'A browser tab that runs out of memory takes the whole page down with it, so every adapter here has a per-file size bound, and files are read in chunks so a bound can stop a read partway rather than after the whole file is already in memory. Up to ' + MAX_QUEUE_FILES + ' files can be queued at once. The desktop application\'s converter carries an unbounded queue; this page does not, and it says so rather than quietly pretending otherwise.',
        'A browser tab that runs out of memory takes the whole page down with it, no exceptions, so every adapter here has a per-file size bound, and files are read in chunks so a bound can stop a read partway through rather than only after the whole file is already sitting in memory. Up to ' + MAX_QUEUE_FILES + ' files can be queued at once. The desktop application\'s converter carries a genuinely unbounded queue; this page does not, and it says so plainly rather than quietly pretending otherwise.',
        'A browser tab that runs out of memory takes the whole page down with it, no exceptions and no warning, so every single adapter here has a per-file size bound, and files are read in careful little chunks so a bound can stop a read partway through rather than only after the whole file is already sitting in memory, uninvited. Up to ' + MAX_QUEUE_FILES + ' files can be queued at once. The desktop application\'s converter carries a genuinely unbounded queue; this page very much does not, and it says so out loud rather than quietly pretending it does.'
      ],
      zh: [
        '瀏覽器分頁一旦爆memory就成版都會冧，所以呢度每個轉換工具都有單一檔案上限，而且檔案會分段讀，咁樣上限先可以喺全個檔案入晒記憶體之前就叫停。呢度一次最多可以排 ' + MAX_QUEUE_FILES + ' 個檔案。桌面應用程式嘅轉換器隊列係無上限嘅，呢版唔係，照直講明，唔會扮嘢。',
        '瀏覽器分頁一旦爆memory就成版都會冧，所以呢度每個轉換工具都有單一檔案上限，而且檔案會分段讀，咁樣上限先可以喺全個檔案入晒記憶體之前就叫停。呢度一次最多可以排 ' + MAX_QUEUE_FILES + ' 個檔案。桌面應用程式嘅轉換器隊列係無上限嘅，呢版唔係，照直講明，唔會扮嘢。',
        '瀏覽器分頁爆記憶體，成版嘢一齊冧，所以呢度每個工具都有單一檔案上限，檔案仲要分段讀，等上限可以喺未入晒記憶體之前就叫停。一次最多排 ' + MAX_QUEUE_FILES + ' 個檔案。桌面版嘅隊列係無上限，呢版唔係，照直講，唔會扮嘢。',
        '瀏覽器分頁爆記憶體，成版嘢一齊冧，一個都跑唔甩，所以呢度每個工具都設咗單一檔案上限，檔案仲要分段咁讀，等上限可以喺未入晒記憶體之前就出手叫停。一次最多排 ' + MAX_QUEUE_FILES + ' 個檔案。桌面版嘅隊列係真.無上限，呢版唔係，照直講明，唔會靜靜雞扮嘢。',
        '瀏覽器分頁爆記憶體，成版嘢一齊冧，連一聲招呼都無得打，所以呢度每個工具都認真設咗單一檔案上限，檔案仲要一小段一小段咁讀，等上限可以喺未入晒記憶體之前就搶住叫停。一次最多排 ' + MAX_QUEUE_FILES + ' 個檔案。桌面版嘅隊列先至係真.無上限，呢版真係唔係，大大聲講明，唔會靜靜雞扮有。'
      ]
    },
    'conv.catalogNote': {
      en: [
        'A format that cannot genuinely convert here is still listed, and marked as not available, with the exact reason.',
        'A format that cannot genuinely convert here is still listed, and marked as not available, with the exact reason.',
        'A format that cannot genuinely convert here is still shown, marked not available, with the exact reason spelled out.',
        'A format this page genuinely cannot convert still gets a row here, marked not available, with the exact reason spelled out rather than left to guesswork.',
        'A format this page genuinely cannot convert still earns its own row here, marked not available, with the exact reason spelled out in full -- because a missing feature that hides itself is a feature nobody can trust, and this page would rather be honest than tidy.'
      ],
      zh: [
        '真係轉唔到嘅格式一樣列出嚟，標明暫時做唔到，仲講埋確實原因。',
        '真係轉唔到嘅格式一樣列出嚟，標明暫時做唔到，仲講埋確實原因。',
        '真係轉唔到嘅格式照樣列出嚟，標明做唔到，原因講到明。',
        '呢版真係轉唔到嘅格式，一樣會有自己嗰行，標明做唔到，仲要講到明原因，唔使你自己估。',
        '呢版真係轉唔到嘅格式，一樣攞得到自己嗰行，標明做唔到，原因講到十足十——因為一個功能靜靜雞消失咗，係無人信得過㗎，呢版寧願老實啲都唔想扮靚。'
      ]
    },
    'conv.empty.noFile': same('No file chosen yet.', '仲未揀檔案。'),
    'conv.empty.noAdapter': same('Choose an adapter below to see its options here.', '喺下面揀個轉換工具，呢度就會顯示佢嘅選項。'),
    'conv.empty.needsFile': same('Choose at least one file above before converting.', '轉換之前，先喺上面揀最少一個檔案。'),
    'conv.empty.noQueue': same('Nothing has been converted yet.', '仲未轉換過嘢。'),
    'conv.sniff.reading': same('Reading its first bytes…', '讀緊佢頭幾個位元組…'),
    'conv.sniff.detected': same('Detected from its first bytes:', '由頭幾個位元組睇出：'),
    'conv.sniff.unknown': same('Could not identify this from its first bytes.', '由頭幾個位元組睇唔出係咩。'),
    'conv.whatWillChange': same('What will change:', '會改變啲乜：'),
    'conv.convertAnyway': same('Convert anyway', '照樣轉換'),
    'conv.convertN': same('Convert', '轉換'),
    'conv.section.files': same('Files', '檔案'),
    'conv.section.adapters': same('Adapters', '轉換工具'),
    'conv.section.convert': same('Convert', '轉換'),
    'conv.section.results': same('Results', '結果'),
    'conv.drop.text': same('Drop files here, or choose files', '將檔案拖嚟呢度，或者揀檔案'),
    'conv.remove': same('Remove', '移除'),
    'conv.download': same('Download', '下載'),
    'conv.useThis': same('Use this', '用呢個'),
    'conv.cancelRest': same('Cancel the rest', '取消餘下嘅'),
    'conv.available': same('Available offline', '離線可用'),
    'conv.unavailable': same('Not available in this browser', '呢個瀏覽器暫時做唔到'),
    'conv.status.queued': same('Queued', '排緊隊'),
    'conv.status.converting': same('Converting', '轉緊'),
    'conv.status.converted': same('Converted', '已轉換'),
    'conv.status.failed': same('Failed', '失敗咗'),
    'conv.status.skipped': same('Skipped', '略過咗'),
    'conv.status.cancelled': same('Cancelled', '取消咗'),
    'conv.count.converted': same('converted', '轉換咗'),
    'conv.count.failed': same('failed', '失敗'),
    'conv.count.skipped': same('skipped', '略過'),
    'conv.count.cancelled': same('cancelled', '取消'),
    'conv.field.convertTo': same('Convert to', '轉去邊種格式'),
    'conv.field.quality': same('Quality (JPEG and WebP only)', '質素（淨係 JPEG 同 WebP）'),
    'conv.field.resize': same('Resize to fit within', '調整尺寸至唔超過'),
    'conv.field.keepAspect': same('Keep aspect ratio', '保持長寬比例'),
    'conv.field.fromFormat': same('From format', '原本格式'),
    'conv.field.toFormat': same('To format', '目標格式'),
    'conv.field.header': same('The first row is a header (CSV and TSV)', '第一行係標題（CSV 同 TSV）'),
    'conv.field.rootName': same('Root element name (XML output)', '根元素名稱（XML 輸出）'),
    'conv.field.readAs': same('Read the source as', '將來源當做'),
    'conv.field.writeAs': same('Write the output as', '將輸出寫做'),
    'conv.field.lineEndings': same('Line endings', '換行符'),
    'conv.field.holds': same('The file currently holds', '呢個檔案而家係'),
    'conv.field.convertItTo': same('Convert it to', '轉做'),
    'conv.binary.raw': same('Raw bytes (the file as-is)', '原始位元組（檔案本身）'),
    'conv.lossy.jpegAlpha': same('Transparency will be flattened onto a white background, because JPEG cannot store an alpha channel.', '透明部分會夾實喺白色底上面，因為 JPEG 冇辦法存透明度。'),
    'conv.lossy.quality': same('Quality is set below 100%, which compresses the image and cannot be undone:', '質素設定咗喺 100% 以下，會壓縮張圖，冇得返轉頭：'),
    'conv.lossy.resize': same('Every image will be resized to fit within', '每張圖都會調整尺寸至唔超過'),
    'conv.lossy.oneFrame': same('Only the first frame of an animated image (such as an animated GIF or WebP) is kept; none of the enabled output formats here store animation.', '動畫圖（例如動態 GIF 或 WebP）淨係會保留第一格；呢度啟用嘅輸出格式都唔識存動畫。'),
    'conv.lossy.reencode': same('Re-encoding text between different encodings can change which characters can be represented.', '喺唔同編碼之間轉換文字，可能改變到邊啲字可以顯示到。'),
    'conv.lossy.win1252': same('Any character this encoding cannot represent becomes "?", and this cannot be reversed.', '呢個編碼顯示唔到嘅字會變做「?」，冇得返轉頭。'),
    'conv.lossy.lineEndings': same('Line endings are rewritten, which changes the exact bytes of the file even where the text looks identical.', '換行符會被重寫，即使睇落一樣，檔案嘅實際位元組都會唔同。'),
    'conv.lossy.sameForm': same('The source and target are the same form, so the output will be identical to the input.', '來源同目標係同一種形式，所以輸出會同輸入一樣。'),
    'conv.lossy.qpCr': same('Quoted-printable here normalises line endings to a single LF byte; a lone carriage return in the original bytes is not preserved.', '呢度嘅 quoted-printable 會將換行符統一做單一個 LF 位元組；原本單獨嘅 carriage return 唔會保留。'),
    'conv.lossy.urlPlus': same('A "+" in percent-encoded text is read as a space, matching the common form-encoding convention.', '百分號編碼入面嘅「+」會當空格處理，跟返一般表單編碼嘅慣例。'),
    'conv.cat.documents': same('Documents and PDF', '文件同 PDF'),
    'conv.cat.images': same('Images', '圖片'),
    'conv.cat.audio': same('Audio', '音頻'),
    'conv.cat.video': same('Video', '影片'),
    'conv.cat.archives': same('Archives', '壓縮檔'),
    'conv.cat.structured': same('Structured data and spreadsheets', '結構化資料同試算表'),
    'conv.cat.code': same('Code and text', '程式碼同文字'),
    'conv.cat.binary': same('Binary encodings', '二進位編碼'),
    'conv.adapter.pdfTools.label': same('PDF inspect, split, merge, extract, reorder, rotate and metadata', 'PDF 檢視、拆分、合併、擷取、重排、旋轉同中繼資料'),
    'conv.adapter.pdfTools.reason': same('No bundled PDF decoder ships with this static page. Reading, editing or writing a PDF needs a real PDF library, and bundling one here would mean a build step, a third-party dependency, or a network fetch -- all of which this site avoids. The desktop application ships offline PDF tools that need none of that.', '呢版靜態網頁冇內置 PDF 解碼器。讀取、編輯或寫 PDF 都需要一個真正嘅 PDF 程式庫，喺呢度打包一個就代表要有建置步驟、第三方依賴或者網絡要求——呢版全部都唔會做。桌面應用程式就內置咗離線 PDF 工具，乜都唔使。'),
    'conv.adapter.pdfImage.label': same('PDF pages to and from images', 'PDF 頁面同圖片互轉'),
    'conv.adapter.pdfImage.reason': same('Turning a PDF page into an image needs a PDF renderer, and turning images into a PDF page needs a PDF writer; this static page bundles neither. The desktop application can do both offline.', '將 PDF 頁面變成圖片需要 PDF 渲染器，將圖片變成 PDF 頁面就需要 PDF 寫入器；呢版靜態網頁兩樣都冇內置。桌面應用程式離線就兩樣都做得到。'),
    'conv.adapter.office.label': same('Word, Rich Text Format, OpenDocument Text and PowerPoint', 'Word、RTF、OpenDocument Text 同 PowerPoint'),
    'conv.adapter.office.reason': same('No bundled office-document reader or writer ships with this static page. The desktop application reads and writes these formats offline.', '呢版靜態網頁冇內置辦公文件嘅讀寫程式。桌面應用程式離線就讀寫得到呢啲格式。'),
    'conv.adapter.image.label': same('Image (resize and convert between PNG, JPEG and WebP)', '圖片（喺 PNG、JPEG 同 WebP 之間調整尺寸同轉換）'),
    'conv.adapter.image.note': same('Reads any image this browser can decode: PNG, JPEG, GIF, WebP, BMP, ICO and SVG among others.', '讀取任何呢個瀏覽器識解碼嘅圖片：PNG、JPEG、GIF、WebP、BMP、ICO、SVG 等等。'),
    'conv.adapter.vector.label': same('Raster to SVG (tracing a bitmap into vector paths)', '點陣轉 SVG（將點陣圖描成向量路徑）'),
    'conv.adapter.vector.reason': same('No bundled vector-tracing library ships with this static page; turning pixels into vector paths is a substantial piece of software this site does not bundle.', '呢版靜態網頁冇內置向量描圖程式庫；將像素變成向量路徑係一件唔細嘅軟件工程，呢版冇打包。'),
    'conv.adapter.heic.label': same('Encoding to HEIC, HEIF or AVIF', '編碼做 HEIC、HEIF 或 AVIF'),
    'conv.adapter.heic.reason': same('This browser\'s own canvas encoder does not offer these output formats; only the formats it actually supports (PNG, JPEG and WebP) are enabled above. Decoding an existing HEIC or AVIF file works if this browser itself can decode it.', '呢個瀏覽器自己嘅 canvas 編碼器唔提供呢啲輸出格式；上面只有佢真正支援嘅格式（PNG、JPEG、WebP）先至啟用。解碼現有嘅 HEIC 或 AVIF 檔案就要睇呢個瀏覽器本身識唔識。'),
    'conv.adapter.audio.label': same('WAV, MP3, FLAC, OGG and AAC transcoding', 'WAV、MP3、FLAC、OGG 同 AAC 轉碼'),
    'conv.adapter.audio.reason': same('No bundled audio codec ships with this static page. A browser can often play these formats, but that gives no route to re-encode compressed audio without a codec library this site does not bundle. The desktop application ships one.', '呢版靜態網頁冇內置音頻編解碼器。瀏覽器通常播到呢啲格式，但唔代表冇編解碼程式庫都可以重新編碼壓縮音頻，而呢版冇打包呢個程式庫。桌面應用程式就有內置。'),
    'conv.adapter.video.label': same('MP4, WebM and MOV transcoding, and video to GIF', 'MP4、WebM、MOV 轉碼，同埋影片轉 GIF'),
    'conv.adapter.video.reason': same('No bundled video codec ships with this static page, for the same reason as audio: playback support in a browser is not the same as an encoder this site can call. The desktop application ships one.', '呢版靜態網頁冇內置影片編解碼器，同音頻嗰個原因一樣：瀏覽器識播唔代表呢版有得調用嘅編碼器。桌面應用程式就有內置。'),
    'conv.adapter.archive.label': same('ZIP, 7-Zip, TAR and gzip: create and extract', 'ZIP、7-Zip、TAR 同 gzip：建立同解壓'),
    'conv.adapter.archive.reason': same('No bundled archive codec ships with this static page. The desktop application ships offline archive tools that need none of that.', '呢版靜態網頁冇內置壓縮檔編解碼器。桌面應用程式就內置咗離線壓縮工具，乜都唔使。'),
    'conv.adapter.structured.label': same('Structured data (JSON, JSON Lines, YAML, CSV, TSV, XML)', '結構化資料（JSON、JSON Lines、YAML、CSV、TSV、XML）'),
    'conv.adapter.structured.note': same('Converts between JSON, JSON Lines, a documented YAML subset, CSV, TSV and a generic XML mapping.', '喺 JSON、JSON Lines、有文件記錄嘅 YAML 子集、CSV、TSV 同通用 XML 對應之間轉換。'),
    'conv.adapter.xlsx.label': same('XLSX and ODS spreadsheet reading and writing', 'XLSX 同 ODS 試算表嘅讀寫'),
    'conv.adapter.xlsx.reason': same('No bundled spreadsheet decoder ships with this static page. Use the CSV or TSV adapter above as the offline substitute; the desktop application reads and writes XLSX directly.', '呢版靜態網頁冇內置試算表解碼器。用返上面嘅 CSV 或 TSV 工具做離線替代方案；桌面應用程式就直接讀寫到 XLSX。'),
    'conv.adapter.text.label': same('Text encoding and line endings', '文字編碼同換行符'),
    'conv.adapter.text.note': same('Re-encodes text between UTF-8, UTF-16LE, UTF-16BE and Windows-1252, and rewrites line endings between LF, CRLF and CR.', '喺 UTF-8、UTF-16LE、UTF-16BE 同 Windows-1252 之間重新編碼文字，仲可以喺 LF、CRLF 同 CR 之間重寫換行符。'),
    'conv.adapter.format.label': same('Source-code formatting and minification', '原始碼格式化同壓縮'),
    'conv.adapter.format.reason': same('No bundled formatter or minifier ships with this static page; these are large tools in their own right and this site does not bundle one.', '呢版靜態網頁冇內置格式化或壓縮工具；呢啲本身已經係唔細嘅工具，呢版冇打包。'),
    'conv.adapter.binary.label': same('Binary-to-text encodings (Base64, hex, percent-encoding, quoted-printable)', '二進位轉文字編碼（Base64、Hex、百分號編碼、quoted-printable）'),
    'conv.adapter.binary.note': same('Converts a file\'s bytes to and from Base64, Base64url, hex, URL percent-encoding and quoted-printable.', '將檔案嘅位元組同 Base64、Base64url、Hex、URL 百分號編碼、quoted-printable 互相轉換。'),
    'conv.adapter.legacy.label': same('Uuencode, yEnc and other legacy binary-to-text schemes', 'Uuencode、yEnc 同其他舊式二進位轉文字方案'),
    'conv.adapter.legacy.reason': same('Not implemented. These are rarely used today; Base64, hex, percent-encoding and quoted-printable above cover the common cases.', '未實作。呢啲今時今日已經好少用；上面嘅 Base64、Hex、百分號編碼、quoted-printable 已經涵蓋常見情況。')
  };

  /* ================================================================
   * 14. UI assembly
   * ================================================================ */
  var i18nDefined = false;

  function searchTextFor(a, t) {
    var label = t(a.labelKey);
    var desc = a.enabled ? t(a.sourceNoteKey) : t(a.reasonKey);
    return label + ' ' + desc + ' ' + (a.keywords || '');
  }

  function mount(host) {
    var S = window.Studio;
    if (!S) { window.console && window.console.error && window.console.error('[StudioConverter] Studio was not found; mount() must run inside Studio.ready().'); return; }
    if (!i18nDefined) { S.i18n.define(copy); i18nDefined = true; }

    var el = S.el, icon = S.icon, t = S.t, clear = S.clear;
    var state = { files: [], fileBulk: null, selectedAdapterId: null, panel: null, queueItems: [], cancelBatch: null };

    clear(host);

    var lede = el('p', { class: 'lede' });
    S.label(lede, 'conv.lede', '');
    host.appendChild(lede);

    var boundsNote = el('div', { class: 'note' });
    S.label(boundsNote, 'conv.boundsNote', '');
    host.appendChild(boundsNote);

    /* ---- files ---------------------------------------------------- */
    var filesHeading = el('h2', {});
    S.label(filesHeading, 'conv.section.files', 'Files');
    host.appendChild(filesHeading);

    var fileInput = el('input', {
      type: 'file', multiple: true, class: 'visually-hidden', id: 'conv-file-input',
      onchange: function () { handleFiles(fileInput.files); fileInput.value = ''; }
    });
    var dropText = el('span', { class: 'cv-drop__text' });
    S.label(dropText, 'conv.drop.text', 'Drop files here, or choose files');
    var dropZone = el('label', { class: 'cv-drop', for: 'conv-file-input', tabindex: '0' }, [icon('upload'), dropText, fileInput]);
    dropZone.addEventListener('dragover', function (e) { e.preventDefault(); dropZone.classList.add('is-over'); });
    dropZone.addEventListener('dragleave', function () { dropZone.classList.remove('is-over'); });
    dropZone.addEventListener('drop', function (e) {
      e.preventDefault(); dropZone.classList.remove('is-over');
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
    });
    dropZone.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } });
    host.appendChild(dropZone);

    var fileListHost = el('div', { class: 'cv-file-list' });
    host.appendChild(fileListHost);

    /* ---- catalog ---------------------------------------------------- */
    var catalogHeading = el('h2', {});
    S.label(catalogHeading, 'conv.section.adapters', 'Adapters');
    host.appendChild(catalogHeading);

    var catalogNote = el('p', { class: 'muted' });
    S.label(catalogNote, 'conv.catalogNote', '');
    host.appendChild(catalogNote);

    var catalogHost = el('div', { class: 'stack' });
    host.appendChild(catalogHost);
    catalogHost.appendChild(buildCatalog());

    /* ---- convert panel ---------------------------------------------- */
    var convertHeading = el('h2', {});
    S.label(convertHeading, 'conv.section.convert', 'Convert');
    host.appendChild(convertHeading);

    var panelHost = el('div', { class: 'cv-panel' });
    host.appendChild(panelHost);

    /* ---- results ---------------------------------------------------- */
    var resultsHeading = el('h2', {});
    S.label(resultsHeading, 'conv.section.results', 'Results');
    host.appendChild(resultsHeading);

    var queueHost = el('div', {});
    host.appendChild(queueHost);

    /* ---------------------------------------------------------------- */
    function findAdapter(id) {
      for (var i = 0; i < ADAPTERS.length; i++) if (ADAPTERS[i].id === id) return ADAPTERS[i];
      return null;
    }

    function buildCatalog() {
      var wrap = el('div', { class: 'stack' });
      CATEGORIES.forEach(function (cat) {
        var adapters = ADAPTERS.filter(function (a) { return a.category === cat.id; });
        var listHost = el('ul', { class: 'list' });
        function paintList(matcher) {
          clear(listHost);
          var shown = adapters.filter(function (a) { return !matcher || matcher(searchTextFor(a, t)); });
          if (!shown.length) {
            listHost.appendChild(el('li', { class: 'li' }, el('div', { class: 'li__t' }, el('div', { class: 'li__s', text: t('set.noMatch', 'No setting matches that.') }))));
            return;
          }
          shown.forEach(function (a) { listHost.appendChild(adapterRow(a)); });
        }
        var search = S.createSearchBar({
          ariaLabel: 'Search ' + t(cat.labelKey), storageKey: 'conv-cat-' + cat.id,
          placeholder: t('act.search', 'Search'),
          help: 'Searches the adapter name and its description.',
          onChange: function (api) { paintList(api.matcher()); }
        });
        paintList(null);
        var section = el('div', {}, [search.el, listHost]);
        /* The collapse header's own title text is not tracked by the
           runtime's [data-i18n] mechanism, so a language change is
           handled by the S.on('i18n', ...) subscription below, which
           rebuilds this whole catalog from scratch rather than trying
           to patch one header string in place. */
        S.collapse.attach(section, { title: t(cat.labelKey) + ' (' + adapters.length + ')', storageKey: 'conv-cat-collapse-' + cat.id, descriptive: false });
        wrap.appendChild(section);
      });
      return wrap;
    }

    function adapterRow(a) {
      var label = t(a.labelKey);
      var desc = a.enabled ? t(a.sourceNoteKey) : t(a.reasonKey);
      var statusChip = a.enabled
        ? el('span', { class: 'status status--ok' }, [el('span', { class: 'dot' }), t('conv.available', 'Available offline')])
        : el('span', { class: 'status status--warn' }, [el('span', { class: 'dot' }), t('conv.unavailable', 'Not available in this browser')]);
      var useBtn = el('button', {
        class: 'btn btn--tonal', type: 'button', text: t('conv.useThis', 'Use this'),
        'aria-label': t('conv.useThis', 'Use this') + ': ' + label,
        disabled: !a.enabled,
        title: a.enabled ? '' : desc,
        onclick: a.enabled ? function () { selectAdapter(a.id); } : null
      });
      return el('li', { class: 'li' }, [
        statusChip,
        el('div', { class: 'li__t' }, [
          el('div', { class: 'li__h', text: label }),
          el('div', { class: 'li__s', text: desc })
        ]),
        useBtn
      ]);
    }

    function selectAdapter(id) {
      state.selectedAdapterId = id;
      renderPanel();
      panelHost.scrollIntoView({ block: 'start', behavior: S.a11y.reducedMotion() ? 'auto' : 'smooth' });
    }

    function sniffFile(file) {
      var slice = file.slice(0, SNIFF_BYTES);
      return slice.arrayBuffer().then(function (buf) { return sniff(new Uint8Array(buf), file.name); })
        .catch(function () { return { matched: false, family: null, label: null, hex: '' }; });
    }

    function handleFiles(list) {
      var arr = Array.prototype.slice.call(list || []);
      if (!arr.length) return;
      if (state.files.length + arr.length > MAX_QUEUE_FILES) {
        S.notify.warn('Only ' + MAX_QUEUE_FILES + ' files can be queued at once here; the rest were not added.');
        arr = arr.slice(0, Math.max(0, MAX_QUEUE_FILES - state.files.length));
      }
      var pending = arr.map(function (f) {
        var rec = { id: S.uid('cf'), file: f, sniff: null };
        state.files.push(rec);
        return rec;
      });
      renderFileList();
      Promise.all(pending.map(function (rec) { return sniffFile(rec.file).then(function (s) { rec.sniff = s; }); }))
        .then(function () { renderFileList(); renderPanel(); });
    }

    function removeFile(id) {
      state.files = state.files.filter(function (r) { return r.id !== id; });
      renderFileList();
      renderPanel();
    }

    function renderFileList() {
      clear(fileListHost);
      if (state.fileBulk) { state.fileBulk.destroy(); state.fileBulk = null; }
      if (!state.files.length) {
        var empty = el('p', { class: 'muted' });
        S.label(empty, 'conv.empty.noFile', 'No file chosen yet.');
        fileListHost.appendChild(empty);
        return;
      }
      var list = el('ul', { class: 'list' });
      state.files.forEach(function (rec) {
        var sniffText;
        if (!rec.sniff) sniffText = t('conv.sniff.reading', 'Reading its first bytes…');
        else if (rec.sniff.matched) sniffText = t('conv.sniff.detected', 'Detected from its first bytes:') + ' ' + rec.sniff.label + ' (' + rec.sniff.hex + '…)';
        else sniffText = t('conv.sniff.unknown', 'Could not identify this from its first bytes.');
        list.appendChild(el('li', {
          class: 'li', 'data-bulk-item': '', 'data-id': rec.id, tabindex: '0', role: 'option', 'aria-selected': 'false'
        }, [
          el('span', { class: 'cbx', 'data-bulk-check': '', role: 'checkbox', 'aria-checked': 'false', 'aria-label': 'Select ' + rec.file.name }),
          el('div', { class: 'li__t' }, [
            el('div', { class: 'li__h', text: rec.file.name }),
            el('div', { class: 'li__s', text: humanBytes(rec.file.size) + ' — ' + sniffText })
          ]),
          el('button', {
            class: 'btn btn--text', type: 'button', text: t('conv.remove', 'Remove'),
            'aria-label': t('conv.remove', 'Remove') + ': ' + rec.file.name,
            onclick: function () { removeFile(rec.id); }
          })
        ]));
      });
      fileListHost.appendChild(el('div', { class: 'scrollx' }, list));
      state.fileBulk = S.bulk.attach(list, {
        getLabel: function (id) { var r = state.files.filter(function (x) { return x.id === id; })[0]; return r ? r.file.name : id; },
        allMatchingCount: function () { return state.files.length; },
        allMatchingIds: function () { return state.files.map(function (r) { return r.id; }); },
        actions: [
          { id: 'remove', label: t('conv.remove', 'Remove'), danger: true, destructive: true,
            run: function (ids) { ids.forEach(removeFile); return { done: ids.length, skipped: 0 }; } }
        ]
      });
    }

    function renderPanel() {
      clear(panelHost);
      state.panel = null;
      var adapter = findAdapter(state.selectedAdapterId);
      if (!adapter) {
        var e1 = el('p', { class: 'muted' }); S.label(e1, 'conv.empty.noAdapter', 'Choose an adapter below to see its options here.'); panelHost.appendChild(e1); return;
      }
      if (!state.files.length) {
        var e2 = el('p', { class: 'muted' }); S.label(e2, 'conv.empty.needsFile', 'Choose at least one file above before converting.'); panelHost.appendChild(e2); return;
      }
      var files = state.files.map(function (r) { return r.file; });
      var sniffs = state.files.map(function (r) { return r.sniff; });
      function notifyChange() { refreshNotes(); }
      var built = adapter.buildPanel(panelHost, files, sniffs, notifyChange, S, t, el);
      state.panel = built;

      var noteHost = el('div', { class: 'note' });
      function refreshNotes() {
        var notes = built.lossyNotes ? built.lossyNotes() : [];
        clear(noteHost);
        if (notes.length) {
          var head = el('p', {}); S.label(head, 'conv.whatWillChange', 'What will change:');
          noteHost.appendChild(head);
          noteHost.appendChild(el('ul', {}, notes.map(function (n) { return el('li', { text: n }); })));
          noteHost.hidden = false;
        } else {
          noteHost.hidden = true;
        }
      }
      refreshNotes();
      panelHost.appendChild(noteHost);

      var goBtn = el('button', {
        class: 'btn btn--filled', type: 'button',
        text: t('conv.convertN', 'Convert') + ' ' + state.files.length + ' ×',
        onclick: function () {
          refreshNotes();
          var notes = built.lossyNotes ? built.lossyNotes() : [];
          maybeConfirmAndRun(goBtn, notes, function () { startQueue(built); });
        }
      });
      panelHost.appendChild(goBtn);
    }

    function maybeConfirmAndRun(anchor, notes, onConfirmed) {
      if (!notes || !notes.length) { onConfirmed(); return; }
      var head = el('p', {}); S.label(head, 'conv.whatWillChange', 'What will change:');
      var body = el('div', { class: 'stack' }, [head, el('ul', {}, notes.map(function (n) { return el('li', { text: n }); }))]);
      var cancelLabel = t('act.cancel', 'Cancel');
      var goLabel = t('conv.convertAnyway', 'Convert anyway');
      var h = S.overlay.open({
        anchor: anchor, returnTo: anchor, title: t('conv.whatWillChange', 'What will change:'), content: body,
        footer: [
          el('button', { class: 'btn btn--text', type: 'button', text: cancelLabel, onclick: function () { h.close('cancel'); } }),
          el('button', { class: 'btn btn--filled', type: 'button', text: goLabel, onclick: function () { h.close('go'); onConfirmed(); } })
        ]
      });
    }

    function queueRowId(item) { return 'cv-qrow-' + item.id; }
    function statusLabel(s) {
      var key = 'conv.status.' + s;
      return t(key, s);
    }
    function queueRow(item) {
      var bar = el('div', { class: 'prog' }, el('div', { class: 'prog__bar', style: { width: item.progress + '%' } }));
      var actionArea = el('span', {});
      if (item.status === 'converted' && item.result) {
        actionArea.appendChild(el('button', {
          class: 'btn btn--tonal', type: 'button', text: t('conv.download', 'Download'),
          'aria-label': t('conv.download', 'Download') + ': ' + item.result.filename,
          onclick: function () { triggerBlobDownload(item.result.filename, resultToBlob(item.result)); }
        }));
      } else if ((item.status === 'failed' || item.status === 'skipped') && item.error) {
        actionArea.appendChild(el('span', { class: 'muted t-body-small', text: item.error }));
      }
      return el('li', { class: 'li', id: queueRowId(item) }, [
        el('div', { class: 'li__t' }, [
          el('div', { class: 'li__h', text: item.file.name }),
          el('div', { class: 'li__s', text: statusLabel(item.status) + ' — ' + humanBytes(item.file.size) })
        ]),
        bar, actionArea
      ]);
    }
    function updateQueueRow(item) {
      var node = document.getElementById(queueRowId(item));
      if (!node || !node.parentNode) return;
      node.parentNode.replaceChild(queueRow(item), node);
    }
    function renderQueue() {
      clear(queueHost);
      if (!state.queueItems.length) {
        var e = el('p', { class: 'muted' }); S.label(e, 'conv.empty.noQueue', 'Nothing has been converted yet.'); queueHost.appendChild(e); return;
      }
      var list = el('ul', { class: 'list' });
      state.queueItems.forEach(function (item) { list.appendChild(queueRow(item)); });
      queueHost.appendChild(el('div', { class: 'scrollx' }, list));
      var cancelBtn = el('button', {
        class: 'btn btn--outlined', type: 'button', text: t('conv.cancelRest', 'Cancel the rest'),
        onclick: function () { if (state.cancelBatch) state.cancelBatch(); }
      });
      queueHost.appendChild(cancelBtn);
    }

    function startQueue(panel) {
      var items = state.files.map(function (rec) {
        return { id: rec.id, file: rec.file, status: 'queued', progress: 0, result: null, error: null, cancelledFlag: { value: false } };
      });
      state.queueItems = items;
      renderQueue();

      var idx = 0, active = 0, globalCancelled = false;
      function isCancelledFor(item) { return function () { return globalCancelled || item.cancelledFlag.value; }; }
      function markRemainingCancelled() {
        for (; idx < items.length; idx++) { items[idx].status = 'cancelled'; updateQueueRow(items[idx]); }
      }
      function runOne(item) {
        item.status = 'converting'; updateQueueRow(item);
        return panel.run(item.file, function (done, total) {
          item.progress = total ? Math.round(done / total * 100) : 0;
          updateQueueRow(item);
        }, isCancelledFor(item)).then(function (result) {
          item.status = 'converted'; item.progress = 100; item.result = result; updateQueueRow(item);
        }).catch(function (err) {
          if (err && err.__cancelled) item.status = 'cancelled';
          else if (err && err.__skipped) { item.status = 'skipped'; item.error = err.message; }
          else { item.status = 'failed'; item.error = (err && err.message) || String(err); }
          updateQueueRow(item);
        });
      }
      function pump() {
        if (globalCancelled) { markRemainingCancelled(); finishIfDone(); return; }
        while (active < CONCURRENCY && idx < items.length) {
          var item = items[idx]; idx += 1; active += 1;
          runOne(item).then(function () { active -= 1; pump(); });
        }
        finishIfDone();
      }
      function finishIfDone() {
        if (idx >= items.length && active === 0) finishQueue(items);
      }
      state.cancelBatch = function () {
        globalCancelled = true;
        items.forEach(function (it) { it.cancelledFlag.value = true; });
        markRemainingCancelled();
      };
      pump();
    }

    function finishQueue(items) {
      var converted = items.filter(function (i) { return i.status === 'converted'; }).length;
      var failed = items.filter(function (i) { return i.status === 'failed'; }).length;
      var skipped = items.filter(function (i) { return i.status === 'skipped'; }).length;
      var cancelled = items.filter(function (i) { return i.status === 'cancelled'; }).length;
      var msg = converted + ' ' + t('conv.count.converted', 'converted') + ', ' +
        failed + ' ' + t('conv.count.failed', 'failed') + ', ' +
        skipped + ' ' + t('conv.count.skipped', 'skipped') + ', ' +
        cancelled + ' ' + t('conv.count.cancelled', 'cancelled') + '.';
      if (failed || skipped) S.notify.warn(msg); else S.notify.success(msg);
      S.history.record('converter', converted + ' file' + (converted === 1 ? '' : 's') + ' converted', { converted: converted, failed: failed, skipped: skipped, cancelled: cancelled });
    }

    renderFileList();
    renderPanel();
    renderQueue();

    S.on('i18n', function () {
      clear(catalogHost); catalogHost.appendChild(buildCatalog());
      renderFileList();
      renderPanel();
      if (state.queueItems.length) renderQueue();
    });

    S.palette.register([
      { id: 'converter.page', title: 'File converter', kind: 'page', page: 'converter.html', keywords: 'convert image json yaml csv xml base64 hex pdf audio video archive spreadsheet' }
    ]);
  }

  var StudioConverter = {
    mount: mount,
    _internal: {
      humanBytes: humanBytes, swapExt: swapExt, sniff: sniff, guessStructuredId: guessStructuredId,
      BINARY_CODECS: BINARY_CODECS, base64Encode: base64Encode, base64Decode: base64Decode,
      base64UrlEncode: base64UrlEncode, base64UrlDecode: base64UrlDecode,
      hexEncode: hexEncode, hexDecode: hexDecode, urlEncode: urlEncode, urlDecode: urlDecode,
      qpEncode: qpEncode, qpDecode: qpDecode,
      decodeText: decodeText, encodeText: encodeText, estimateWin1252Loss: estimateWin1252Loss, convertLineEndings: convertLineEndings,
      parseDelimited: parseDelimited, stringifyDelimited: stringifyDelimited, delimitedToValue: delimitedToValue, valueToDelimited: valueToDelimited,
      parseYamlSubset: parseYamlSubset, stringifyYamlSubset: stringifyYamlSubset,
      xmlParse: xmlParse, xmlNodeToGeneric: xmlNodeToGeneric, stringifyXmlFromGeneric: stringifyXmlFromGeneric, stringifyXmlFromNode: stringifyXmlFromNode,
      STRUCTURED_FORMATS: STRUCTURED_FORMATS, structuredLossyNotes: structuredLossyNotes,
      ADAPTERS: ADAPTERS, CATEGORIES: CATEGORIES, BOUNDS: BOUNDS, copy: copy
    }
  };

  if (typeof window !== 'undefined') window.StudioConverter = StudioConverter;
  if (typeof module !== 'undefined' && module.exports) module.exports = StudioConverter;
})();
