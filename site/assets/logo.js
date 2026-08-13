/* ==================================================================
 * World Downloader Studio -- site logo customization
 *
 * A self-contained module, loaded the same way as any other page
 * script: <script defer src="assets/logo.js"></script>, AFTER
 * assets/site.js. It adds exactly one property to window:
 * window.StudioLogo. Nothing else.
 *
 * WHAT THIS IS. The desktop application lets a user replace the mark
 * it draws in its title bar (see docs/features/app-logo.md). This is
 * the site's own equivalent: several shipped, project-appropriate
 * marks plus a local image of the visitor's own, cropped, framed and
 * safely converted entirely in this browser, then applied to every
 * place this site actually renders its own mark -- the header brand
 * mark, the landing-page hero mark, and (where a page carries one)
 * the browser-tab favicon.
 *
 * WHAT IT NEVER TOUCHES. This is presentation, and only presentation.
 * Choosing a mark never renames the site, never moves a storage key,
 * never changes a URL, and never edits a file on disk -- it changes
 * what this one browser draws, for this one visitor, and nothing else.
 * See applyToPage() below: every write it makes is either a DOM swap
 * of an already-rendered element, or a Studio.store write under the
 * shared "wds." prefix, next to every other per-visitor preference.
 *
 * NETWORK. None. Nothing here ever uploads a file, calls a remote
 * converter, or fetches anything. A rejected file is refused whole,
 * with the exact reason, and never partially applied.
 *
 * WHERE THINGS LIVE. Studio.store keys "logo.selection" and
 * "logo.custom", exactly like every other per-visitor setting on this
 * site. Clearing this site's storage resets this feature along with
 * everything else -- there is no separate reset route to remember.
 * ================================================================== */
(function () {
  'use strict';

  function boot(S) {
    var el = S.el, icon = S.icon, t = S.t, clear = S.clear;

    /* ================================================================
     * 1. Bounds -- named so a rejection is always actionable.
     * ================================================================ */
    var MAX_FILE_BYTES = 4 * 1024 * 1024;      // 4 MiB source file
    var HEADER_WINDOW = 65536;                 // 64 KiB read for sniffing
    var MIN_SIDE = 16;
    var MAX_SIDE = 8192;
    var MAX_DECODE_PIXELS = 16 * 1024 * 1024;  // 16,777,216
    var DECODE_TIMEOUT_MS = 10000;
    var STORAGE_BUDGET_CHARS = 400000;         // ~300 KB of PNG data URLs
    var VARIANTS = [
      { id: 'master', size: 256 },
      { id: 'favicon32', size: 32 },
      { id: 'favicon16', size: 16 }
    ];
    var LIVE_MARKS_SELECTOR = '.site-brand__mark, .lp-hero__mark';

    function clamp(n, lo, hi) { return n < lo ? lo : (n > hi ? hi : n); }
    function clamp01(n) { return clamp(n, 0, 1); }
    function deco(kind) { var d = S.i18n.emoji(kind); return d ? d + ' ' : ''; }

    /* ================================================================
     * 2. Byte-level format sniffing.
     *
     * Nothing here trusts a file extension or the browser's MIME
     * guess. The first HEADER_WINDOW bytes are read and matched
     * against the real container signatures. PNG, JPEG and WebP are
     * the only accepted still-image containers; everything else is
     * refused by name -- including every animated source, which is
     * refused specifically because the output is always exactly one
     * still image and an animation has nowhere to go.
     * ================================================================ */
    var PNG_SIG = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];

    function bytesEqual(bytes, offset, arr) {
      if (offset + arr.length > bytes.length) return false;
      for (var i = 0; i < arr.length; i++) if (bytes[offset + i] !== arr[i]) return false;
      return true;
    }
    function asciiAt(bytes, offset, len) {
      if (offset + len > bytes.length) return '';
      var s = '';
      for (var i = 0; i < len; i++) s += String.fromCharCode(bytes[offset + i]);
      return s;
    }
    function containsAscii(bytes, needle) {
      var n = needle.length, i, j;
      outer: for (i = 0; i + n <= bytes.length; i++) {
        for (j = 0; j < n; j++) if (bytes[i + j] !== needle.charCodeAt(j)) continue outer;
        return true;
      }
      return false;
    }
    function u16be(bytes, o) { return (bytes[o] << 8) | bytes[o + 1]; }
    function u16le(bytes, o) { return bytes[o] | (bytes[o + 1] << 8); }
    function u24le(bytes, o) { return bytes[o] | (bytes[o + 1] << 8) | (bytes[o + 2] << 16); }
    function u32be(bytes, o) { return ((bytes[o] << 24) | (bytes[o + 1] << 16) | (bytes[o + 2] << 8) | bytes[o + 3]) >>> 0; }

    /* PNG: signature, then a bounded chunk walk from IHDR looking for
       an "acTL" chunk before the first "IDAT" -- the animated-PNG
       marker -- within the bytes actually read. */
    function sniffPng(bytes) {
      var info = { format: 'png', animated: false, width: null, height: null };
      if (asciiAt(bytes, 12, 4) === 'IHDR' && bytes.length >= 24) {
        info.width = u32be(bytes, 16);
        info.height = u32be(bytes, 20);
      }
      var pos = 8;
      try {
        while (pos + 8 <= bytes.length) {
          var len = u32be(bytes, pos);
          var type = asciiAt(bytes, pos + 4, 4);
          if (type === 'acTL') { info.animated = true; break; }
          if (type === 'IDAT' || type === 'IEND') break;
          if (len < 0 || len > bytes.length) break;
          pos += 8 + len + 4;
        }
      } catch (e) { /* best-effort past the header window */ }
      return info;
    }

    /* JPEG: FF D8 FF signature, then a bounded marker walk for the
       first SOFn segment. Motion JPEG is not a real animation format
       browsers decode, so JPEG carries no animated flag. */
    function sniffJpeg(bytes) {
      var info = { format: 'jpeg', animated: false, width: null, height: null };
      var p = 2;
      try {
        while (p + 4 <= bytes.length) {
          if (bytes[p] !== 0xFF) { p++; continue; }
          var marker = bytes[p + 1];
          if (marker === 0xFF) { p++; continue; }
          if (marker === 0xD8 || marker === 0x01 || (marker >= 0xD0 && marker <= 0xD7)) { p += 2; continue; }
          if (marker === 0xD9 || marker === 0xDA) break; // EOI or start-of-scan
          var segLen = u16be(bytes, p + 2);
          var isSof = marker >= 0xC0 && marker <= 0xCF && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC;
          if (isSof && p + 9 <= bytes.length) {
            info.height = u16be(bytes, p + 5);
            info.width = u16be(bytes, p + 7);
            break;
          }
          if (segLen < 2) break;
          p += 2 + segLen;
        }
      } catch (e) { /* best-effort: post-decode bounds still apply */ }
      return info;
    }

    /* WebP: RIFF/WEBP signature. VP8X carries an explicit animation
       flag and canvas size; VP8 (lossy) and VP8L (lossless) carry
       their own compact dimension fields. As a second, independent
       check, the whole header window is scanned for a literal "ANIM"
       chunk, which is the strongest signal an animation is present. */
    function sniffWebp(bytes) {
      var info = { format: 'webp', animated: false, width: null, height: null };
      var fourcc = asciiAt(bytes, 12, 4);
      try {
        if (fourcc === 'VP8X' && bytes.length >= 30) {
          var flags = bytes[20];
          if ((flags & 0x02) !== 0) info.animated = true;
          info.width = 1 + u24le(bytes, 24);
          info.height = 1 + u24le(bytes, 27);
        } else if (fourcc === 'VP8 ' && bytes.length >= 30) {
          info.width = u16le(bytes, 26) & 0x3FFF;
          info.height = u16le(bytes, 28) & 0x3FFF;
        } else if (fourcc === 'VP8L' && bytes.length >= 25 && bytes[20] === 0x2F) {
          var b = (bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24)) >>> 0;
          info.width = (b & 0x3FFF) + 1;
          info.height = ((b >>> 14) & 0x3FFF) + 1;
        }
      } catch (e) { /* fall through to the ANIM scan below */ }
      if (containsAscii(bytes, 'ANIM')) info.animated = true;
      return info;
    }

    function detectRejectedFormat(bytes) {
      if (asciiAt(bytes, 0, 3) === 'GIF') return 'a GIF image';
      if (bytes[0] === 0x42 && bytes[1] === 0x4D) return 'a BMP image';
      if (bytes[0] === 0 && bytes[1] === 0 && bytes[2] === 1 && bytes[3] === 0) return 'an ICO icon file';
      if (bytes[0] === 0 && bytes[1] === 0 && bytes[2] === 2 && bytes[3] === 0) return 'a CUR cursor file';
      if ((asciiAt(bytes, 0, 2) === 'II' && bytes[2] === 42 && bytes[3] === 0) ||
          (asciiAt(bytes, 0, 2) === 'MM' && bytes[2] === 0 && bytes[3] === 42)) return 'a TIFF image';
      if (asciiAt(bytes, 0, 5) === '%PDF-') return 'a PDF document';
      if (asciiAt(bytes, 0, 5) === '<?xml' || asciiAt(bytes, 0, 4) === '<svg') return 'an SVG or XML document';
      return null;
    }

    function inspectFile(file) {
      return new Promise(function (resolve, reject) {
        if (!file) { reject('no file was chosen'); return; }
        if (file.size > MAX_FILE_BYTES) {
          reject('it is ' + file.size.toLocaleString() + ' bytes and the limit is ' + MAX_FILE_BYTES.toLocaleString() + ' bytes');
          return;
        }
        var slice = file.slice(0, HEADER_WINDOW);
        var reader = new FileReader();
        reader.onerror = function () { reject('the file could not be read from this browser'); };
        reader.onload = function () {
          var bytes = new Uint8Array(reader.result);
          var info = null;
          if (bytesEqual(bytes, 0, PNG_SIG)) info = sniffPng(bytes);
          else if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) info = sniffJpeg(bytes);
          else if (asciiAt(bytes, 0, 4) === 'RIFF' && asciiAt(bytes, 8, 4) === 'WEBP') info = sniffWebp(bytes);
          if (!info) {
            var known = detectRejectedFormat(bytes);
            reject(known ? ('it is ' + known + ', and only still PNG, JPEG and WebP images are accepted')
                         : 'its first bytes do not match PNG, JPEG or WebP');
            return;
          }
          if (info.animated) { reject('it is an animated image, and this mark can only ever be one still image'); return; }
          if (info.width !== null) {
            if (info.width < MIN_SIDE || info.height < MIN_SIDE) {
              reject('it is only ' + info.width + '×' + info.height + ' pixels, and the smallest accepted side is ' + MIN_SIDE + ' pixels');
              return;
            }
            if (info.width > MAX_SIDE || info.height > MAX_SIDE) {
              reject('it is ' + info.width + '×' + info.height + ' pixels, and the largest accepted side is ' + MAX_SIDE + ' pixels');
              return;
            }
            if (info.width * info.height > MAX_DECODE_PIXELS) {
              reject('it is ' + (info.width * info.height).toLocaleString() + ' pixels total, and the limit is ' + MAX_DECODE_PIXELS.toLocaleString() + ' pixels');
              return;
            }
          }
          resolve({ file: file, info: info });
        };
        reader.readAsArrayBuffer(slice);
      });
    }

    /* ================================================================
     * 3. Bounded decode.
     *
     * createImageBitmap races a real time budget. Where it is not
     * available, an <img> plus decode() stands in. Either way, the
     * decoded pixel count is checked against the same bound the
     * header parse already tried to enforce -- so a source whose
     * header could not be parsed still cannot become a decompression
     * bomb, and a source whose header disagrees with what actually
     * decoded is refused rather than trusted.
     * ================================================================ */
    function decodeBounded(file) {
      var raced = false;
      var timer = null;
      var decodePromise;
      if (window.createImageBitmap) {
        decodePromise = window.createImageBitmap(file);
      } else {
        decodePromise = new Promise(function (resolve, reject) {
          var img = new Image();
          var url = URL.createObjectURL(file);
          img.onload = function () { URL.revokeObjectURL(url); resolve(img); };
          img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('decode-failed')); };
          img.src = url;
        });
      }
      return new Promise(function (resolve, reject) {
        timer = window.setTimeout(function () { raced = true; reject(new Error('timeout')); }, DECODE_TIMEOUT_MS);
        decodePromise.then(function (bitmap) {
          window.clearTimeout(timer);
          if (raced) return;
          var w = bitmap.width || bitmap.naturalWidth, h = bitmap.height || bitmap.naturalHeight;
          if (!w || !h) { reject(new Error('decode-failed')); return; }
          if (w * h > MAX_DECODE_PIXELS) { reject(new Error('decoded-too-large:' + w + 'x' + h)); return; }
          resolve(bitmap);
        }, function (err) {
          window.clearTimeout(timer);
          if (!raced) reject(err);
        });
      });
    }

    function describeDecodeError(err, headerInfo) {
      if (typeof err === 'string') return err;
      var msg = (err && err.message) || String(err);
      if (msg === 'timeout') return 'decoding took longer than ' + (DECODE_TIMEOUT_MS / 1000) + ' seconds and was stopped';
      if (msg.indexOf('decoded-too-large:') === 0) return 'the decoded image is larger than the ' + MAX_DECODE_PIXELS.toLocaleString() + '-pixel limit';
      return 'this browser could not decode that file';
    }

    /* ================================================================
     * 4. Composing a square: crop, fit, focal point, background,
     * corner rounding. Crop is stored as fractions of the source, so
     * it survives any rescale of the on-screen editor.
     * ================================================================ */
    function roundedRectPath(ctx, x, y, w, h, r) {
      r = Math.max(0, Math.min(r, w / 2, h / 2));
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }
    function computeFitRect(cw, ch, size, fit, focalX, focalY) {
      if (fit === 'fill') return { x: 0, y: 0, w: size, h: size };
      var scale = fit === 'cover' ? Math.max(size / cw, size / ch) : Math.min(size / cw, size / ch);
      var w = cw * scale, h = ch * scale;
      var x, y;
      if (fit === 'contain') { x = (size - w) / 2; y = (size - h) / 2; }
      else { x = (size - w) * clamp01(focalX); y = (size - h) * clamp01(focalY); }
      return { x: x, y: y, w: w, h: h };
    }
    function composeSquare(bitmap, crop, opts) {
      var sw = bitmap.width || bitmap.naturalWidth, sh = bitmap.height || bitmap.naturalHeight;
      var cx = clamp(Math.round(crop.x * sw), 0, sw - 1);
      var cy = clamp(Math.round(crop.y * sh), 0, sh - 1);
      var cw = clamp(Math.round(crop.w * sw), 1, sw - cx);
      var ch = clamp(Math.round(crop.h * sh), 1, sh - cy);
      var size = opts.size;
      var canvas = document.createElement('canvas');
      canvas.width = size; canvas.height = size;
      var ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, size, size);
      var clipped = opts.cornerPct > 0;
      if (clipped) {
        ctx.save();
        roundedRectPath(ctx, 0, 0, size, size, (opts.cornerPct / 100) * (size / 2));
        ctx.clip();
      }
      if (!opts.transparent) { ctx.fillStyle = opts.background; ctx.fillRect(0, 0, size, size); }
      var r = computeFitRect(cw, ch, size, opts.fit, opts.focalX, opts.focalY);
      ctx.drawImage(bitmap, cx, cy, cw, ch, r.x, r.y, r.w, r.h);
      if (clipped) ctx.restore();
      return canvas;
    }
    function verifyVariant(dataUrl, size) {
      return new Promise(function (resolve) {
        if (typeof dataUrl !== 'string' || dataUrl.indexOf('data:image/png;base64,') !== 0) { resolve(false); return; }
        var img = new Image();
        img.onload = function () { resolve(img.naturalWidth === size && img.naturalHeight === size); };
        img.onerror = function () { resolve(false); };
        img.src = dataUrl;
      });
    }

    /* ================================================================
     * 5. Shipped presets.
     *
     * Six original vector marks, authored as plain stroke geometry
     * matching the line style this site already draws its own header
     * mark in. They are applied as inline SVG using currentColor, so
     * a chosen preset follows this site's theme, seed colour and
     * light/dark mode automatically -- there is no raster pipeline
     * for these at all, because there is nothing to convert.
     * ================================================================ */
    var PRESETS = [
      { id: 'chunk-arrow', labelKey: 'logo.preset.chunkArrow', keywords: 'chunk arrow download block square',
        body: '<rect x="4" y="4" width="16" height="16" rx="3"></rect><path d="M12 8v7"></path><path d="M9 12l3 3 3-3"></path>' },
      { id: 'compass', labelKey: 'logo.preset.compass', keywords: 'compass explore navigate world map needle',
        body: '<circle cx="12" cy="12" r="9"></circle><path d="M15 9l-2 6-6 2 2-6 6-2z"></path>' },
      { id: 'blocks', labelKey: 'logo.preset.blocks', keywords: 'blocks voxel stack world cube chunk',
        body: '<rect x="4" y="13" width="7" height="7" rx="1"></rect><rect x="13" y="13" width="7" height="7" rx="1"></rect><rect x="8.5" y="3" width="7" height="7" rx="1"></rect>' },
      { id: 'beacon', labelKey: 'logo.preset.beacon', keywords: 'beacon tower map marker light landmark',
        body: '<path d="M7 20h10"></path><path d="M9 20l3-15 3 15"></path><path d="M12 2v3"></path><path d="M6 9l2.5 1"></path><path d="M18 9l-2.5 1"></path>' },
      { id: 'pin', labelKey: 'logo.preset.pin', keywords: 'pin marker location map point waypoint',
        body: '<path d="M12 21s-7-7.5-7-12a7 7 0 0 1 14 0c0 4.5-7 12-7 12z"></path><circle cx="12" cy="9" r="2.5"></circle>' },
      { id: 'monogram', labelKey: 'logo.preset.monogram', keywords: 'monogram letter w initial tile',
        body: '<rect x="3" y="3" width="18" height="18" rx="4"></rect><path d="M7 8l2 8 3-6 3 6 2-8"></path>' }
    ];
    function presetById(id) {
      for (var i = 0; i < PRESETS.length; i++) if (PRESETS[i].id === id) return PRESETS[i];
      return null;
    }
    function presetLabel(preset) { return t(preset.labelKey, preset.id); }
    function presetSvgMarkup(preset) {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
        'stroke-linecap="round" stroke-linejoin="round">' + preset.body + '</svg>';
    }
    function nodeFromMarkup(markup) {
      var wrap = document.createElement('div');
      wrap.innerHTML = markup;
      return wrap.firstChild;
    }
    function presetFaviconDataUri(preset) {
      var cs = window.getComputedStyle(document.documentElement);
      var stroke = (cs.getPropertyValue('--md-sys-color-on-primary-container') || '').trim() || '#002108';
      var bg = (cs.getPropertyValue('--md-sys-color-primary-container') || '').trim() || '#80FBA3';
      var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">' +
        '<rect width="24" height="24" rx="5" fill="' + bg + '"></rect>' +
        '<g fill="none" stroke="' + stroke + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + preset.body + '</g></svg>';
      return 'data:image/svg+xml,' + encodeURIComponent(svg);
    }

    /* ================================================================
     * 6. Storage. Two keys, same "wds." prefix as everything else on
     * this site. logo.custom never carries the source file -- only
     * the three generated, verified variants and the choices that
     * produced them.
     * ================================================================ */
    function getSelection() { return S.store.get('logo.selection', { kind: 'shipped' }); }
    function setSelection(sel) { S.store.set('logo.selection', sel); }
    function getCustomRecord() { return S.store.get('logo.custom', null); }

    /* ================================================================
     * 7. Live apply.
     *
     * Every element this site actually draws its own mark at is found
     * generically by class, at runtime, on whichever page included
     * this script -- nothing here assumes a particular page's markup
     * beyond the classes the runtime's own header and hero markup
     * already carry. The original element is hidden rather than
     * removed, so switching back to the shipped mark is instant and
     * loses nothing.
     * ================================================================ */
    var appliedNodes = [];
    var faviconLink = null;
    var faviconOriginalHref = null;

    function clearLiveApply() {
      appliedNodes.forEach(function (rec) {
        if (rec.node.parentNode) rec.node.parentNode.removeChild(rec.node);
        rec.markEl.style.removeProperty('display');
        rec.markEl.removeAttribute('data-wds-logo-applied');
      });
      appliedNodes = [];
      if (faviconLink && faviconOriginalHref !== null) faviconLink.setAttribute('href', faviconOriginalHref);
    }
    function applyMarks(buildNode, decorate) {
      var marks = document.querySelectorAll(LIVE_MARKS_SELECTOR);
      for (var i = 0; i < marks.length; i++) {
        var markEl = marks[i];
        if (markEl.hasAttribute('data-wds-logo-applied')) continue;
        var node = buildNode(markEl);
        node.setAttribute('data-wds-logo-injected', '');
        decorate(markEl, node);
        markEl.style.setProperty('display', 'none');
        markEl.setAttribute('data-wds-logo-applied', '');
        if (markEl.parentNode) markEl.parentNode.insertBefore(node, markEl.nextSibling);
        appliedNodes.push({ markEl: markEl, node: node });
      }
    }
    function applyFavicon(href) {
      var link = document.querySelector('link[rel="icon"]');
      if (!link || !href) return;
      if (faviconOriginalHref === null) faviconOriginalHref = link.href;
      faviconLink = link;
      link.setAttribute('href', href);
    }
    function decorateDefault(markEl, node) {
      if (markEl.getAttribute('aria-hidden') === 'true') {
        node.setAttribute('aria-hidden', 'true');
        if ('alt' in node) node.alt = '';
      } else {
        var label = markEl.getAttribute('aria-label') || '';
        if (node.tagName === 'IMG') { node.alt = label; }
        else { node.setAttribute('role', 'img'); node.setAttribute('aria-label', label); }
      }
    }
    function applyToPage() {
      try {
        clearLiveApply();
        var sel = getSelection();
        if (sel.kind === 'preset') {
          var preset = presetById(sel.presetId);
          if (!preset) { setSelection({ kind: 'shipped' }); return; }
          applyMarks(function (markEl) {
            var n = nodeFromMarkup(presetSvgMarkup(preset));
            n.setAttribute('class', markEl.className);
            return n;
          }, decorateDefault);
          applyFavicon(presetFaviconDataUri(preset));
          return;
        }
        if (sel.kind === 'custom') {
          var rec = getCustomRecord();
          if (!rec || !rec.master) { setSelection({ kind: 'shipped' }); return; }
          applyMarks(function (markEl) {
            var img = document.createElement('img');
            img.src = rec.master;
            img.className = markEl.className;
            return img;
          }, decorateDefault);
          applyFavicon(rec.favicon32 || rec.favicon16 || rec.master);
        }
        /* sel.kind === 'shipped': everything was already cleared above. */
      } catch (e) {
        if (window.console && window.console.error) window.console.error('[StudioLogo]', e);
      }
    }

    /* ================================================================
     * 8. Copy. Five variants, lowest funny level first, in both
     * languages. Voice changes with the level; the facts inside a
     * message -- which format, which size, which limit -- never do.
     * ================================================================ */
    function same(en, zh) { return { en: [en, en, en, en, en], zh: [zh, zh, zh, zh, zh] }; }
    var copy = {
      'logo.title': same('Site logo', '網站標記'),
      'logo.lede': {
        en: [
          'Choose what mark this browser shows for this site: one of several shipped designs, or an image of your own.',
          'Choose what mark this browser shows for this site: one of several shipped designs, or an image of your own.',
          'Pick the mark this browser shows for this site, from the shipped designs or from an image of your own.',
          'Pick whatever mark this browser shows for this site, whether that is one of the shipped designs or a photo or picture of your own.',
          'Pick whatever this browser shows for the site’s mark, one of the shipped designs or a picture you supply yourself — it is entirely up to you and nobody else will ever see your choice.'
        ],
        zh: [
          '揀返呢個瀏覽器會顯示邊個標記：官方預設之一，或者你自己嘅圖像。',
          '揀返呢個瀏覽器會顯示邊個標記：官方預設之一，或者你自己嘅圖像。',
          '揀返呢個瀏覽器要顯示邊個標記，可以係官方預設，又可以係你自己嘅圖。',
          '揀返呢個瀏覽器要顯示乜嘢標記都得，官方預設又好，你自己嘅相又好。',
          '呢個瀏覽器要顯示乜嘢標記，全部你話事，官方預設又好、你自己張相又好，第二個人永遠都唔會見到你揀咗乜。'
        ]
      },
      'logo.identity': {
        en: [
          'This changes presentation only. The site’s name, its storage keys and every URL stay exactly as they are.',
          'This changes presentation only. The site’s name, its storage keys and every URL stay exactly as they are.',
          'This only changes what you look at. The site’s name, its storage keys and every URL are left completely untouched.',
          'This is presentation and nothing else. The site’s name, its storage keys and every URL are left completely untouched, no matter what mark you choose.',
          'This is presentation, full stop. The site’s name, its storage keys and every single URL are left completely untouched, no matter how many times you change your mind about the mark.'
        ],
        zh: [
          '呢個淨係改外觀。網站名、儲存索引同每一個網址都完全唔會變。',
          '呢個淨係改外觀。網站名、儲存索引同每一個網址都完全唔會變。',
          '呢個淨係改你睇到嘅嘢。網站名、儲存索引同每一個網址完全唔會郁。',
          '呢個純粹係外觀，第二樣都唔會變。網站名、儲存索引同每一個網址完全唔會郁，你揀邊個標記都一樣。',
          '呢個純粹係外觀，第二樣真係一樣都唔會變。網站名、儲存索引同每一個網址完全唔會郁，你想點改變主意都得。'
        ]
      },
      'logo.storageNote': {
        en: [
          'The mark you choose is saved in this browser’s local storage, alongside every other setting on this site. Clearing this site’s storage resets it along with everything else.',
          'The mark you choose is saved in this browser’s local storage, alongside every other setting on this site. Clearing this site’s storage resets it along with everything else.',
          'Your chosen mark is saved in this browser’s local storage, next to every other setting here. Clearing that storage resets it along with everything else.',
          'Your chosen mark is saved in this browser’s own local storage, right next to every other setting on this site — there is no separate reset for it. Clearing that storage resets it along with everything else.',
          'Your chosen mark lives in this browser’s own local storage, filed right next to every other setting on this site — no separate reset, no separate place to remember. Clearing that storage resets it along with absolutely everything else.'
        ],
        zh: [
          '你揀嘅標記會儲喺呢個瀏覽器嘅本機儲存空間，同呢個網站其他設定放埋一齊。清咗本站儲存空間，佢會同其他嘢一齊重設。',
          '你揀嘅標記會儲喺呢個瀏覽器嘅本機儲存空間，同呢個網站其他設定放埋一齊。清咗本站儲存空間，佢會同其他嘢一齊重設。',
          '你揀嘅標記存喺呢個瀏覽器嘅本機儲存空間，同呢度其他設定擺埋一齊。清咗嗰個儲存空間，佢會連其他嘢一齊重設。',
          '你揀嘅標記就存喺呢個瀏覽器自己嘅本機儲存空間，同呢度其他設定擺埋一齊，無獨立重設呢回事。清咗嗰個儲存空間，佢會連其他嘢一齊重設。',
          '你揀嘅標記就住喺呢個瀏覽器自己嘅本機儲存空間，同呢度其他設定擠埋一齊，無獨立嘅重設，都無獨立要記嘅位。清咗嗰個儲存空間，佢會連晒其他所有嘢一齊重設。'
        ]
      },
      'logo.privacyNote': same(
        'Nothing here ever leaves this browser. No upload, no remote converter, and no network request at any stage.',
        '呢度啲嘢永遠唔會離開呢個瀏覽器。無上載、無遠端轉換、任何一步都無網絡要求。'
      ),

      /* ---- tabs -------------------------------------------------- */
      'logo.tab.presets': same('Presets', '預設標記'),
      'logo.tab.custom': same('Your own image', '你自己嘅圖'),
      'logo.tab.about': same('About this', '關於呢個功能'),

      /* ---- presets ------------------------------------------------ */
      'logo.presetsHeading': same('Choose a mark', '揀一個標記'),
      'logo.presetSearchLabel': same('Search marks', '搜尋標記'),
      'logo.presetSearchHelp': same(
        'Searches the name of every shipped mark, including the shipped default.',
        '搜尋每一個官方預設標記嘅名，包括本站原本嗰個。'
      ),
      'logo.emptyPresetSearch': same('No mark matches that.', '無標記符合。'),
      'logo.shippedName': same('This site’s own mark', '本站原本嘅標記'),
      'logo.shippedDescribe': same('The mark this site ships with, unchanged.', '本站本身自帶嘅標記，冇改過。'),
      'logo.selectAction': same('Use this mark', '用呢個標記'),
      'logo.currentlyInUse': same('In use', '用緊'),
      'logo.preset.chunkArrow': same('Chunk & arrow', '方塊與箭頭'),
      'logo.preset.compass': same('Compass', '指南針'),
      'logo.preset.blocks': same('Stacked blocks', '疊起嘅方塊'),
      'logo.preset.beacon': same('Beacon', '訊號塔'),
      'logo.preset.pin': same('Map pin', '地圖大頭針'),
      'logo.preset.monogram': same('Monogram', '字母標記'),

      /* ---- upload --------------------------------------------------- */
      'logo.uploadLabel': same('Choose an image file', '揀一個圖像檔'),
      'logo.uploadHelp': {
        en: [
          'PNG, JPEG or WebP, up to ' + (MAX_FILE_BYTES / (1024 * 1024)) + ' MB and up to ' + MAX_SIDE + ' pixels on a side. Animated files are refused.',
          'PNG, JPEG or WebP, up to ' + (MAX_FILE_BYTES / (1024 * 1024)) + ' MB and up to ' + MAX_SIDE + ' pixels on a side. Animated files are refused.',
          'PNG, JPEG or WebP only, up to ' + (MAX_FILE_BYTES / (1024 * 1024)) + ' MB and up to ' + MAX_SIDE + ' pixels on a side. Animated files are refused, not just discouraged.',
          'PNG, JPEG or WebP only — up to ' + (MAX_FILE_BYTES / (1024 * 1024)) + ' MB, up to ' + MAX_SIDE + ' pixels on a side, and never an animated one, however tempting the GIF is.',
          'PNG, JPEG or WebP only, please — up to ' + (MAX_FILE_BYTES / (1024 * 1024)) + ' MB, up to ' + MAX_SIDE + ' pixels on a side, and absolutely never an animated one, no matter how much that GIF is begging to be the site’s mark.'
        ],
        zh: [
          '只收PNG、JPEG或WebP，最大' + (MAX_FILE_BYTES / (1024 * 1024)) + 'MB，最長邊唔超過' + MAX_SIDE + '像素。有動畫嘅檔案一律唔收。',
          '只收PNG、JPEG或WebP，最大' + (MAX_FILE_BYTES / (1024 * 1024)) + 'MB，最長邊唔超過' + MAX_SIDE + '像素。有動畫嘅檔案一律唔收。',
          '淨係收PNG、JPEG或WebP，最大' + (MAX_FILE_BYTES / (1024 * 1024)) + 'MB，最長邊唔超過' + MAX_SIDE + '像素。有動畫嘅一律唔收，唔係唔建議，係真係唔收。',
          '淨係收PNG、JPEG或WebP，最大' + (MAX_FILE_BYTES / (1024 * 1024)) + 'MB，最長邊唔超過' + MAX_SIDE + '像素，有動畫嘅一概唔收，就算嗰隻GIF幾吸引都唔得。',
          '真係淨係收PNG、JPEG或WebP，最大' + (MAX_FILE_BYTES / (1024 * 1024)) + 'MB，最長邊唔超過' + MAX_SIDE + '像素，有動畫嘅一概唔收 — 唔理嗰隻GIF幾想做網站標記都無得傾。'
        ]
      },
      'logo.stateNone': {
        en: [
          'No image has been chosen yet.',
          'No image has been chosen yet.',
          'No image chosen yet. Pick a file above to start.',
          'Nothing chosen yet — pick a file above and the cropper appears here.',
          'Nothing chosen yet, so there is nothing to crop. Pick a file above and this whole section wakes up.'
        ],
        zh: [
          '仲未揀圖像。',
          '仲未揀圖像。',
          '仲未揀圖，喺上面揀個檔開始。',
          '仲未揀，喺上面揀個檔，裁切工具就會喺呢度出現。',
          '仲未揀，所以都無嘢好裁。喺上面揀個檔，成個版就會醒返。'
        ]
      },
      'logo.stateLoading': {
        en: [
          'Reading and decoding the file.',
          'Reading and decoding the file.',
          'Reading and decoding the file…',
          'Reading the bytes and decoding the picture…',
          'Reading the bytes and decoding the picture, bound to a real time limit so it cannot hang forever…'
        ],
        zh: [
          '讀緊同解碼緊個檔案。',
          '讀緊同解碼緊個檔案。',
          '讀緊同解碼緊個檔案……',
          '讀緊啲位元組，解緊碼……',
          '讀緊啲位元組，解緊碼，仲有真正嘅時限，唔會卡死……'
        ]
      },
      'logo.stateConverted': {
        en: [
          'Converted and applied.',
          'Converted and applied.',
          'Converted, verified and applied.',
          'Converted, verified size by size, and applied — the previous mark would have stayed active if any of that had failed.',
          'Converted, verified size by size and applied — if even one of those checks had failed, the mark you had before would still be sitting there untouched.'
        ],
        zh: [
          '已轉換並套用。',
          '已轉換並套用。',
          '已轉換、驗證咗，並套用。',
          '已逐個尺寸轉換同驗證，再套用 — 只要其中一項失敗，之前個標記就會原封不動。',
          '已逐個尺寸轉換同驗證，先至套用 — 呢啲檢查有一項失敗，之前嗰個標記都會企定喺度冇郁過。'
        ]
      },
      'logo.stateConversionFailure': {
        en: [
          'Conversion was refused, and nothing changed.',
          'Conversion was refused, and nothing changed.',
          'Conversion was refused. The mark you had before is still active.',
          'Conversion was refused before anything applied. The mark you had before is still the one being shown.',
          'Conversion was refused before a single pixel of it applied. Whatever mark you had before is still exactly the one being shown.'
        ],
        zh: [
          '轉換被拒絕，冇嘢變過。',
          '轉換被拒絕，冇嘢變過。',
          '轉換被拒絕，之前個標記繼續用緊。',
          '轉換喺套用之前就被拒絕，之前個標記依然係而家顯示緊嗰個。',
          '轉換連一粒像素都未套用就已經被拒絕，之前嗰個標記依然企定定喺度，一點都冇變。'
        ]
      },
      'logo.replaceAction': same('Choose a different file', '揀過第二個檔'),
      'logo.removeAction': same('Remove the custom image', '移除自訂圖像'),
      'logo.resetAction': same('Reset to the shipped mark', '重設返本站原本嘅標記'),
      'logo.generateAction': same('Generate and apply', '產生並套用'),
      'logo.generatingStatus': {
        en: [
          'Generating and verifying every size.',
          'Generating and verifying every size.',
          'Generating and verifying every size…',
          'Drawing every size, then verifying each one before anything is applied…',
          'Drawing every single size, then verifying every single one before anything at all gets applied…'
        ],
        zh: [
          '產生緊同驗證緊每個尺寸。',
          '產生緊同驗證緊每個尺寸。',
          '產生緊同驗證緊每個尺寸……',
          '逐個尺寸畫緊，畫完先驗證，驗證咗先套用……',
          '逐個尺寸逐個尺寸咁畫，全部驗證晒先至會套用，一步都唔會走漏……'
        ]
      },

      /* ---- crop / fit / focal / background ------------------------- */
      'logo.cropHeading': same('Crop', '裁切'),
      'logo.cropRectLabel': same('Crop area', '裁切範圍'),
      'logo.cropXLabel': same('Left', '左'),
      'logo.cropYLabel': same('Top', '上'),
      'logo.cropWLabel': same('Width', '闊度'),
      'logo.cropHLabel': same('Height', '高度'),
      'logo.cropHandle.tl': same('Top-left corner of the crop area', '裁切範圍嘅左上角'),
      'logo.cropHandle.tr': same('Top-right corner of the crop area', '裁切範圍嘅右上角'),
      'logo.cropHandle.bl': same('Bottom-left corner of the crop area', '裁切範圍嘅左下角'),
      'logo.cropHandle.br': same('Bottom-right corner of the crop area', '裁切範圍嘅右下角'),
      'logo.cropKeyboardNote': same(
        'The crop can also be typed as four percentages below, or moved and resized with the keyboard: focus the crop area or a corner and use the arrow keys, holding Shift for a bigger step.',
        '裁切都可以喺下面用四個百分比打字輸入，或者用鍵盤郁：focus裁切範圍或者一個角，用方向鍵，撳住Shift就跳大步啲。'
      ),
      'logo.fitLabel': same('Fit', '填滿方式'),
      'logo.fitContain': same('Fit inside (contain)', '完整放入（contain）'),
      'logo.fitCover': same('Fill and crop (cover)', '填滿並裁走多餘（cover）'),
      'logo.fitFill': same('Stretch to fill', '拉伸填滿'),
      'logo.focalLabel': same('Focal point', '對焦點'),
      'logo.focalXLabel': same('Horizontal', '水平位置'),
      'logo.focalYLabel': same('Vertical', '垂直位置'),
      'logo.focalNote': same(
        'Only matters when Fill and crop is chosen and the cropped area is not already square: it decides which part survives.',
        '淨係喺揀咗「填滿並裁走多餘」，而裁切範圍又唔啱好係正方形嗰陣先有用：佢決定邊部分會留低。'
      ),
      'logo.backgroundLabel': same('Background', '背景'),
      'logo.backgroundTransparentLabel': same('Keep it transparent', '保持透明'),
      'logo.backgroundColourLabel': same('Background colour', '背景顏色'),
      'logo.contrastWarning': {
        en: [
          'This background does not have enough contrast against a typical page background.',
          'This background does not have enough contrast against a typical page background.',
          'This background does not have enough contrast against a typical page background — it may be hard to see.',
          'This background does not have enough contrast against a typical page background, so the mark may be genuinely hard to see for some visitors.',
          'This background does not have enough contrast against a typical page background — for some visitors the mark could all but vanish, which rather defeats the point of a mark.'
        ],
        zh: [
          '呢個背景同一般頁面背景冇夠對比。',
          '呢個背景同一般頁面背景冇夠對比。',
          '呢個背景同一般頁面背景冇夠對比，可能好難睇清楚。',
          '呢個背景同一般頁面背景冇夠對比，有啲人真係會睇唔清楚個標記。',
          '呢個背景同一般頁面背景冇夠對比，有啲人可能睇到個標記幾乎隱形，標記做到咁真係本末倒置。'
        ]
      },
      'logo.cornerLabel': same('Corner rounding', '角位圓角'),
      'logo.safeAreaLabel': same('Show the safe-area guide', '顯示安全範圍參考線'),
      'logo.safeAreaNote': same(
        'Shows the rounding this site actually applies to its header mark, so you can see what survives at that shape.',
        '顯示本站真正套用喺頁首標記嘅圓角，等你睇到用嗰個形狀時仲剩返乜嘢。'
      ),

      /* ---- losses ---------------------------------------------------- */
      'logo.lossHeading': same('What this conversion changes', '呢次轉換會變啲乜'),
      'logo.loss.reencode': same(
        'Re-drawn and saved as PNG, whatever the source format was.',
        '無論原本係咩格式，都會重新畫過並存做PNG。'
      ),
      'logo.loss.transparencyRemoved': same(
        'Any transparency in the source is painted over with the chosen background colour.',
        '原圖入面嘅透明位會畀你揀嘅背景顏色蓋咗。'
      ),
      'logo.loss.cropped': same('Cropped to less than the whole source image.', '裁走咗，冇用返成張原圖。'),
      'logo.loss.notSquare': same(
        'The cropped area is not square and Stretch to fill is chosen, so the proportions will not be preserved.',
        '裁切範圍唔係正方形，而又揀咗拉伸填滿，所以比例唔會保留返。'
      ),

      /* ---- notifications ---------------------------------------------- */
      'logo.appliedNotify': {
        en: [
          'The site logo is now the custom image you chose. This only changes what you see in this browser.',
          'The site logo is now the custom image you chose. This only changes what you see in this browser.',
          'The site logo is now your custom image — visible only in this browser.',
          'Done. The site logo is now your custom image, and that is visible only in this browser: nobody else’s copy of the site changed.',
          'Done and done. The site logo is now your custom image, visible only in this one browser — not one byte of anybody else’s copy of the site moved.'
        ],
        zh: [
          '網站標記而家係你揀嘅自訂圖像。呢個改動淨係喺呢個瀏覽器見到。',
          '網站標記而家係你揀嘅自訂圖像。呢個改動淨係喺呢個瀏覽器見到。',
          '網站標記而家係你嘅自訂圖像 — 淨係呢個瀏覽器見到。',
          '搞掂。網站標記而家係你嘅自訂圖像，淨係呢個瀏覽器見到，第二個人嗰份網站冇變過。',
          '搞掂晒。網站標記而家係你嘅自訂圖像，淨係呢一個瀏覽器見到 — 第二個人嗰份網站連一個位元都冇郁過。'
        ]
      },
      'logo.presetAppliedNotify': {
        en: [
          'The site logo is now set to that mark, in this browser only.',
          'The site logo is now set to that mark, in this browser only.',
          'Done. The site logo is now that mark, in this browser only.',
          'Done — the site logo is now that mark, and only in this browser.',
          'Done and applied — the site logo is now that mark, and strictly only in this one browser.'
        ],
        zh: [
          '網站標記而家轉咗做嗰個，淨係呢個瀏覽器。',
          '網站標記而家轉咗做嗰個，淨係呢個瀏覽器。',
          '搞掂，網站標記而家係嗰個，淨係呢個瀏覽器。',
          '搞掂 — 網站標記而家係嗰個，淨係呢個瀏覽器。',
          '搞掂晒 — 網站標記而家已經套用做嗰個，淨淨係呢一個瀏覽器。'
        ]
      },
      'logo.removedNotify': same('The custom image was removed. Choose the shipped mark or another preset next.', '自訂圖像已移除。接住揀返本站原本標記或者第二個預設。'),
      'logo.resetNotify': same('Back to the shipped mark, in this browser.', '返咗去本站原本嘅標記，淨係呢個瀏覽器。'),
      'logo.rejectedPrefix': {
        en: [
          'That file was refused',
          'That file was refused',
          'That file was refused',
          'That file was refused, and nothing was applied',
          'That file was firmly refused, and not one pixel of it was applied'
        ],
        zh: [
          '呢個檔案被拒絕',
          '呢個檔案被拒絕',
          '呢個檔案被拒絕',
          '呢個檔案被拒絕，冇嘢套用過',
          '呢個檔案硬係俾人拒絕咗，一粒像素都冇套用過'
        ]
      },

      /* ---- about / boundary / table ------------------------------------ */
      'logo.identityFactsHeading': same('What never changes', '乜嘢永遠唔會變'),
      'logo.variantsHeading': same('The sizes this generates', '呢個功能會產生嘅尺寸'),
      'logo.variantsNote': same(
        'Only the sizes this site actually renders its mark at are generated. The header and hero mark share one 256-pixel image, scaled by this site’s own CSS; the browser tab gets its own small favicon images because a favicon is loaded as an independent resource with no access to this page’s styling.',
        '只會產生本站真正用得著嘅尺寸。頁首同主頁大標記共用一張256像素圖，由本站自己嘅CSS縮放；瀏覽器分頁就有自己嘅細張favicon圖像，因為favicon係獨立資源載入，接觸唔到呢版嘅樣式。'
      ),
      'logo.tableSize': same('Variant', '變體'),
      'logo.tablePixels': same('Pixels', '像素'),
      'logo.tableUse': same('Used for', '用喺邊度'),
      'logo.use.master': same('Header mark and the landing-page hero mark', '頁首標記同主頁大標記'),
      'logo.use.favicon32': same('Browser-tab favicon', '瀏覽器分頁favicon'),
      'logo.use.favicon16': same('Browser-tab favicon fallback', 'favicon備用細尺寸'),
      'logo.contextMenuLabel': same('Customize this logo…', '自訂呢個標記…'),
      'logo.paletteCommand': same('Customize the site logo', '自訂網站標記'),
      'logo.resetConfirmAction': same('Reset the site logo', '重設網站標記'),
      'logo.removeConfirmAction': same('Remove the custom image', '移除自訂圖像')
    };
    S.i18n.define(copy);

    /* ================================================================
     * 9. The crop editor: pointer-drag, keyboard corners, and the
     * numeric percentage fields are three routes to the exact same
     * state, so none of them can disagree with another.
     * ================================================================ */
    function buildCropEditor(session, onChange) {
      var STAGE = 280;
      var sw = session.bitmap.width || session.bitmap.naturalWidth;
      var sh = session.bitmap.height || session.bitmap.naturalHeight;
      var scale = Math.min(STAGE / sw, STAGE / sh);
      var dispW = Math.max(40, Math.round(sw * scale));
      var dispH = Math.max(40, Math.round(sh * scale));

      var stage = el('div', {
        class: 'surface', style: {
          position: 'relative', width: dispW + 'px', height: dispH + 'px',
          background: 'var(--md-sys-color-surface-container-highest)', overflow: 'hidden'
        }
      });

      var previewCanvas = document.createElement('canvas');
      previewCanvas.width = dispW; previewCanvas.height = dispH;
      previewCanvas.style.display = 'block';
      var pctx = previewCanvas.getContext('2d');
      pctx.drawImage(session.bitmap, 0, 0, dispW, dispH);
      stage.appendChild(previewCanvas);

      var rect = el('div', {
        class: 'wds-logo-croprect', tabindex: '0', role: 'group',
        'aria-label': t('logo.cropRectLabel', 'Crop area'),
        style: {
          position: 'absolute', border: '2px solid var(--md-sys-color-primary)',
          boxShadow: '0 0 0 999px rgba(0,0,0,.35)', cursor: 'move', 'touch-action': 'none'
        }
      });
      stage.appendChild(rect);

      var handles = {};
      ['tl', 'tr', 'bl', 'br'].forEach(function (corner) {
        var btn = el('button', {
          type: 'button', class: 'btn btn--icon',
          'aria-label': t('logo.cropHandle.' + corner, 'Crop corner'),
          style: {
            position: 'absolute', width: '28px', height: '28px', 'min-width': '0',
            padding: '0', 'touch-action': 'none'
          }
        }, icon('drag', 'i--sm'));
        handles[corner] = btn;
        stage.appendChild(btn);
      });

      function place(node, x, y) { node.style.left = (x - 14) + 'px'; node.style.top = (y - 14) + 'px'; }
      function layout() {
        var c = session.crop;
        rect.style.left = (c.x * dispW) + 'px';
        rect.style.top = (c.y * dispH) + 'px';
        rect.style.width = Math.max(4, c.w * dispW) + 'px';
        rect.style.height = Math.max(4, c.h * dispH) + 'px';
        var x0 = c.x * dispW, y0 = c.y * dispH, x1 = (c.x + c.w) * dispW, y1 = (c.y + c.h) * dispH;
        place(handles.tl, x0, y0); place(handles.tr, x1, y0);
        place(handles.bl, x0, y1); place(handles.br, x1, y1);
      }
      function clampCrop() {
        var c = session.crop;
        c.w = clamp(c.w, 0.05, 1);
        c.h = clamp(c.h, 0.05, 1);
        c.x = clamp(c.x, 0, 1 - c.w);
        c.y = clamp(c.y, 0, 1 - c.h);
      }
      function commit() { clampCrop(); layout(); onChange(); }

      var dragging = null;
      rect.addEventListener('pointerdown', function (e) {
        try { rect.setPointerCapture(e.pointerId); } catch (err) {}
        dragging = { x: e.clientX, y: e.clientY, cx: session.crop.x, cy: session.crop.y };
        e.preventDefault();
      });
      rect.addEventListener('pointermove', function (e) {
        if (!dragging) return;
        session.crop.x = dragging.cx + (e.clientX - dragging.x) / dispW;
        session.crop.y = dragging.cy + (e.clientY - dragging.y) / dispH;
        commit();
      });
      rect.addEventListener('pointerup', function () { dragging = null; });
      rect.addEventListener('pointercancel', function () { dragging = null; });
      rect.addEventListener('keydown', function (e) {
        var step = e.shiftKey ? 0.05 : 0.01;
        if (e.key === 'ArrowLeft') { session.crop.x -= step; commit(); e.preventDefault(); }
        else if (e.key === 'ArrowRight') { session.crop.x += step; commit(); e.preventDefault(); }
        else if (e.key === 'ArrowUp') { session.crop.y -= step; commit(); e.preventDefault(); }
        else if (e.key === 'ArrowDown') { session.crop.y += step; commit(); e.preventDefault(); }
      });

      function resizeFromCorner(corner, base, dx, dy) {
        var c = session.crop;
        if (corner === 'tl') { c.x = base.x + dx; c.y = base.y + dy; c.w = base.w - dx; c.h = base.h - dy; }
        else if (corner === 'tr') { c.y = base.y + dy; c.w = base.w + dx; c.h = base.h - dy; }
        else if (corner === 'bl') { c.x = base.x + dx; c.w = base.w - dx; c.h = base.h + dy; }
        else { c.w = base.w + dx; c.h = base.h + dy; }
      }
      ['tl', 'tr', 'bl', 'br'].forEach(function (corner) {
        var btn = handles[corner], dragC = null;
        btn.addEventListener('pointerdown', function (e) {
          try { btn.setPointerCapture(e.pointerId); } catch (err) {}
          dragC = { x: e.clientX, y: e.clientY, crop: { x: session.crop.x, y: session.crop.y, w: session.crop.w, h: session.crop.h } };
          e.preventDefault(); e.stopPropagation();
        });
        btn.addEventListener('pointermove', function (e) {
          if (!dragC) return;
          resizeFromCorner(corner, dragC.crop, (e.clientX - dragC.x) / dispW, (e.clientY - dragC.y) / dispH);
          commit();
        });
        btn.addEventListener('pointerup', function () { dragC = null; });
        btn.addEventListener('pointercancel', function () { dragC = null; });
        btn.addEventListener('keydown', function (e) {
          var step = e.shiftKey ? 0.05 : 0.01, dx = 0, dy = 0;
          if (e.key === 'ArrowLeft') dx = -step; else if (e.key === 'ArrowRight') dx = step;
          else if (e.key === 'ArrowUp') dy = -step; else if (e.key === 'ArrowDown') dy = step;
          else return;
          resizeFromCorner(corner, { x: session.crop.x, y: session.crop.y, w: session.crop.w, h: session.crop.h }, dx, dy);
          commit();
          e.preventDefault();
        });
      });

      layout();
      return { el: stage, refresh: layout };
    }

    /* ================================================================
     * 10. The panel. mount(host) appends a self-contained root into
     * host and returns { destroy }. Every string is localized, every
     * colour is a token, and the panel never assumes it is the only
     * thing in host.
     * ================================================================ */
    function field(labelKey, fallback, inputEl, helpText) {
      var children = [el('span', { class: 'field__label', text: t(labelKey, fallback) }), el('div', { class: 'field__box' }, inputEl)];
      if (helpText) children.push(el('p', { class: 'field__help', text: helpText }));
      return el('div', { class: 'field field--outlined field--dense' }, children);
    }
    function percentField(labelKey, fallback, getVal, setVal) {
      var input = el('input', {
        class: 'field__input', type: 'number', min: '0', max: '100', step: '1',
        value: String(Math.round(getVal() * 100)),
        onchange: function () {
          var v = parseFloat(input.value);
          if (isNaN(v)) v = 0;
          setVal(clamp01(v / 100));
        }
      });
      input.wdsRefresh = function () { input.value = String(Math.round(getVal() * 100)); };
      return { el: field(labelKey, fallback, input), input: input };
    }

    function mount(host) {
      var root = el('div', { class: 'stack', style: { gap: '20px', 'min-width': '0' } });
      var session = { bitmap: null, format: null, crop: { x: 0, y: 0, w: 1, h: 1 }, fit: 'contain', focalX: 0.5, focalY: 0.5, transparent: true, background: '#FFFFFF', cornerPct: 0 };
      var cropHost = el('div', { class: 'stack', style: { gap: '16px', 'min-width': '0' } });
      var statusEl = el('p', { role: 'status', 'aria-live': 'polite' });
      var lossList = el('ul', { class: 'list' });
      var generateBtn, replaceBtn, removeBtn, resetBtn, presetGrid;

      /* ---- presets tab ------------------------------------------- */
      function presetTile(kindLabel, describeText, thumb, isActive, onUse) {
        return el('li', { class: 'li' }, [
          thumb,
          el('div', { class: 'li__t' }, [
            el('div', { class: 'li__h', text: kindLabel }),
            el('div', { class: 'li__s', text: describeText })
          ]),
          isActive
            ? el('span', { class: 'status status--ok' }, [el('span', { class: 'dot' }), t('logo.currentlyInUse', 'In use')])
            : el('button', {
                class: 'btn btn--tonal', type: 'button', text: t('logo.selectAction', 'Use this mark'),
                'aria-label': t('logo.selectAction', 'Use this mark') + ': ' + kindLabel,
                onclick: onUse
              })
        ]);
      }
      function renderPresets() {
        clear(presetGrid);
        var sel = getSelection();
        var m = presetSearch ? presetSearch.matcher() : function () { return true; };
        var any = false;

        if (m(t('logo.shippedName', 'This site’s own mark'))) {
          any = true;
          presetGrid.appendChild(presetTile(
            t('logo.shippedName', 'This site’s own mark'),
            t('logo.shippedDescribe', ''),
            el('span', { class: 'i i--lg', style: { display: 'inline-block' } }, icon('doc')),
            sel.kind === 'shipped',
            function () {
              setSelection({ kind: 'shipped' });
              S.history.record('appearance', 'Site logo reset to the shipped mark', { 'logo.selection': 'shipped' });
              applyToPage();
              S.notify.success(deco('success') + t('logo.resetNotify', ''));
              renderPresets();
            }
          ));
        }
        PRESETS.forEach(function (preset) {
          var label = presetLabel(preset);
          if (!m(label + ' ' + preset.keywords)) return;
          any = true;
          var thumb = nodeFromMarkup(presetSvgMarkup(preset));
          thumb.setAttribute('class', 'i i--lg');
          thumb.style.color = 'var(--md-sys-color-primary)';
          presetGrid.appendChild(presetTile(
            label, t('logo.selectAction', 'Use this mark'), thumb,
            sel.kind === 'preset' && sel.presetId === preset.id,
            function () {
              setSelection({ kind: 'preset', presetId: preset.id });
              S.history.record('appearance', 'Site logo set to the "' + label + '" mark', { 'logo.selection': 'preset:' + preset.id });
              applyToPage();
              S.notify.success(deco('success') + t('logo.presetAppliedNotify', ''));
              renderPresets();
            }
          ));
        });
        if (!any) presetGrid.appendChild(el('li', { class: 'li muted', text: t('logo.emptyPresetSearch', '') }));
      }

      var presetSearch = S.createSearchBar({
        ariaLabel: t('logo.presetSearchLabel', 'Search marks'),
        placeholder: t('logo.presetSearchLabel', 'Search marks'),
        storageKey: 'logo-presets',
        help: t('logo.presetSearchHelp', ''),
        sampleProvider: function () {
          var names = [t('logo.shippedName', '')];
          PRESETS.forEach(function (p) { names.push(presetLabel(p) + ' ' + p.keywords); });
          return names.join('\n');
        },
        onChange: function () { renderPresets(); }
      });
      presetGrid = el('ul', { class: 'list' });
      var presetsPanel = el('div', { class: 'stack', style: { gap: '16px' } }, [
        el('p', { class: 'muted', text: t('logo.presetsHeading', '') }),
        presetSearch.el,
        presetGrid
      ]);
      renderPresets();

      /* ---- custom-image tab ---------------------------------------- */
      function setStatus(key, extra) {
        clear(statusEl);
        var txt = t(key, '') + (extra ? ': ' + extra : '');
        statusEl.appendChild(document.createTextNode(txt));
      }
      setStatus('logo.stateNone');

      function refreshLosses() {
        clear(lossList);
        if (!session.bitmap) return;
        var items = [t('logo.loss.reencode', '')];
        if (!session.transparent) items.push(t('logo.loss.transparencyRemoved', ''));
        var full = session.crop.x === 0 && session.crop.y === 0 && session.crop.w === 1 && session.crop.h === 1;
        if (!full) {
          items.push(t('logo.loss.cropped', '') + ' (' + Math.round(session.crop.w * 100) + '% × ' + Math.round(session.crop.h * 100) + '% kept)');
        }
        var sw = session.bitmap.width || session.bitmap.naturalWidth, sh = session.bitmap.height || session.bitmap.naturalHeight;
        var cw = Math.round(session.crop.w * sw), ch = Math.round(session.crop.h * sh);
        if (session.fit === 'fill' && cw !== ch) items.push(t('logo.loss.notSquare', ''));
        items.forEach(function (txt) { lossList.appendChild(el('li', { class: 'li', text: txt })); });
      }

      function rebuildEditor() {
        clear(cropHost);
        if (!session.bitmap) {
          generateBtn.disabled = true;
          generateBtn.title = t('logo.stateNone', '');
          replaceBtn.hidden = true;
          return;
        }
        generateBtn.disabled = false;
        generateBtn.title = '';
        replaceBtn.hidden = false;

        var cropEditor = buildCropEditor(session, function () { syncNumericFields(); refreshLosses(); });

        var xF = percentField('logo.cropXLabel', 'Left', function () { return session.crop.x; }, function (v) { session.crop.x = v; cropEditor.refresh(); refreshLosses(); });
        var yF = percentField('logo.cropYLabel', 'Top', function () { return session.crop.y; }, function (v) { session.crop.y = v; cropEditor.refresh(); refreshLosses(); });
        var wF = percentField('logo.cropWLabel', 'Width', function () { return session.crop.w; }, function (v) { session.crop.w = v; cropEditor.refresh(); refreshLosses(); });
        var hF = percentField('logo.cropHLabel', 'Height', function () { return session.crop.h; }, function (v) { session.crop.h = v; cropEditor.refresh(); refreshLosses(); });
        function syncNumericFields() { xF.input.wdsRefresh(); yF.input.wdsRefresh(); wF.input.wdsRefresh(); hF.input.wdsRefresh(); }

        var fitSelect = S.createSelect({
          ariaLabel: t('logo.fitLabel', 'Fit'), storageKey: 'logo-fit', value: session.fit,
          options: [
            { value: 'contain', label: t('logo.fitContain', ''), keywords: 'contain' },
            { value: 'cover', label: t('logo.fitCover', ''), keywords: 'cover' },
            { value: 'fill', label: t('logo.fitFill', ''), keywords: 'fill stretch' }
          ],
          onChange: function (v) { session.fit = v; focalRow.hidden = v !== 'cover'; refreshLosses(); }
        });

        var focalXSlider = S.makeSlider({
          min: 0, max: 100, step: 1, value: Math.round(session.focalX * 100), ariaLabel: t('logo.focalXLabel', ''),
          format: function (v) { return v + '%'; }, onInput: function (v) { session.focalX = clamp01(parseFloat(v) / 100); }
        });
        var focalYSlider = S.makeSlider({
          min: 0, max: 100, step: 1, value: Math.round(session.focalY * 100), ariaLabel: t('logo.focalYLabel', ''),
          format: function (v) { return v + '%'; }, onInput: function (v) { session.focalY = clamp01(parseFloat(v) / 100); }
        });
        var focalRow = el('div', { class: 'row', hidden: session.fit !== 'cover' }, [
          el('div', { class: 'stack', style: { gap: '4px' } }, [el('span', { class: 't-label-small', text: t('logo.focalXLabel', '') }), focalXSlider]),
          el('div', { class: 'stack', style: { gap: '4px' } }, [el('span', { class: 't-label-small', text: t('logo.focalYLabel', '') }), focalYSlider])
        ]);

        var bgSwatch = el('span', { class: 'set-swatch', style: { display: 'inline-block', width: '28px', height: '28px', 'border-radius': 'var(--md-sys-shape-corner-small)', border: '1px solid var(--md-sys-color-outline)', 'background-color': session.background } });
        var bgBtn = el('button', {
          class: 'btn btn--outlined', type: 'button', text: t('logo.backgroundColourLabel', ''),
          disabled: session.transparent,
          onclick: function () {
            var picker = S.appearance.colourPicker(session.background, function (v) {
              bgSwatch.style.setProperty('background-color', v);
              session.background = v;
              refreshContrast();
            });
            var h = S.overlay.open({
              anchor: bgBtn, returnTo: bgBtn, title: t('logo.backgroundColourLabel', ''), content: picker.el,
              draggable: true, resizable: true, persistKey: 'logo-bg-picker',
              footer: [el('button', { class: 'btn btn--filled', type: 'button', text: t('act.apply', 'Apply'), onclick: function () { h.close('apply'); refreshLosses(); } })]
            });
          }
        });
        var contrastNote = el('p', { class: 'field__help' });
        function refreshContrast() {
          clear(contrastNote);
          if (session.transparent) return;
          var c = null;
          try { c = S.colour.contrast(session.background, '#ffffff'); } catch (e) { c = null; }
          if (c !== null && c < 3) contrastNote.appendChild(document.createTextNode(t('logo.contrastWarning', '')));
        }
        var bgSwitchEl = S.makeSwitch({
          checked: session.transparent, ariaLabel: t('logo.backgroundTransparentLabel', ''),
          onChange: function (v) { session.transparent = v; bgBtn.disabled = v; refreshLosses(); refreshContrast(); }
        });

        var cornerSlider = S.makeSlider({
          min: 0, max: 50, step: 1, value: session.cornerPct, ariaLabel: t('logo.cornerLabel', ''),
          format: function (v) { return v + '%'; }, onInput: function (v) { session.cornerPct = parseFloat(v); }
        });

        var safeAreaGuide = el('div', {
          hidden: true, style: {
            position: 'absolute', inset: '0', border: '2px dashed var(--md-sys-color-error)',
            'border-radius': ((8 / 28) * 100).toFixed(1) + '%', 'pointer-events': 'none'
          }
        });
        var safeAreaSwitchEl = S.makeSwitch({
          checked: false, ariaLabel: t('logo.safeAreaLabel', ''),
          onChange: function (v) { safeAreaGuide.hidden = !v; }
        });

        var stageWrap = el('div', { class: 'row', style: { 'align-items': 'flex-start', 'flex-wrap': 'wrap', gap: '16px' } });
        var stageBox = el('div', { style: { position: 'relative', display: 'inline-block' } }, [cropEditor.el, safeAreaGuide]);
        stageWrap.appendChild(stageBox);
        stageWrap.appendChild(el('div', { class: 'stack', style: { gap: '8px', 'min-width': '160px' } }, [xF.el, yF.el, wF.el, hF.el]));

        cropHost.appendChild(el('div', { class: 'stack', style: { gap: '12px' } }, [
          el('h3', { text: t('logo.cropHeading', '') }),
          el('p', { class: 'muted t-body-small', text: t('logo.cropKeyboardNote', '') }),
          el('div', { class: 'scrollx' }, stageWrap),
          el('div', { class: 'row', style: { 'align-items': 'flex-end', 'flex-wrap': 'wrap', gap: '16px' } }, [
            el('label', { class: 'stack', style: { gap: '4px' } }, [el('span', { class: 't-label-small', text: t('logo.fitLabel', '') }), fitSelect.el]),
            el('div', { class: 'stack', style: { gap: '4px' } }, [
              el('span', { class: 't-label-small', text: t('logo.backgroundLabel', '') }),
              el('div', { class: 'row', style: { 'align-items': 'center' } }, [bgSwitchEl, el('span', { class: 't-body-small', text: t('logo.backgroundTransparentLabel', '') }), bgSwatch, bgBtn])
            ]),
            el('div', { class: 'stack', style: { gap: '4px' } }, [el('span', { class: 't-label-small', text: t('logo.cornerLabel', '') }), cornerSlider]),
            el('label', { class: 'row', style: { 'align-items': 'center', gap: '8px' } }, [safeAreaSwitchEl, el('span', { class: 't-body-small', text: t('logo.safeAreaLabel', '') })])
          ]),
          el('span', { class: 't-label-small', text: t('logo.focalLabel', '') }),
          el('p', { class: 'muted t-body-small', text: t('logo.focalNote', '') }),
          focalRow,
          contrastNote,
          el('p', { class: 'muted t-body-small', text: t('logo.safeAreaNote', '') })
        ]));
        refreshLosses();
        refreshContrast();
      }

      var fileInput = el('input', {
        class: 'field__input', type: 'file', accept: 'image/png,image/jpeg,image/webp',
        'aria-describedby': 'wds-logo-status', 'aria-label': t('logo.uploadLabel', ''),
        onchange: function () {
          var f = fileInput.files && fileInput.files[0];
          if (!f) return;
          setStatus('logo.stateLoading');
          inspectFile(f).then(function (res) {
            return decodeBounded(res.file).then(function (bitmap) {
              var decW = bitmap.width || bitmap.naturalWidth, decH = bitmap.height || bitmap.naturalHeight;
              if (res.info.width !== null && (res.info.width !== decW || res.info.height !== decH)) {
                var err = new Error('its declared size (' + res.info.width + '×' + res.info.height + ') does not match what actually decoded (' + decW + '×' + decH + ')');
                throw err;
              }
              session.bitmap = bitmap;
              session.format = res.info.format;
              session.crop = { x: 0, y: 0, w: 1, h: 1 };
              setStatus('logo.stateNone');
              statusEl.textContent = res.info.format.toUpperCase() + ', ' + decW + '×' + decH + ' pixels.';
              rebuildEditor();
            });
          }).catch(function (err) {
            var reason = typeof err === 'string' ? err : (err && err.message && err.message.indexOf('its declared') === 0 ? err.message : describeDecodeError(err));
            setStatus('logo.rejectedPrefix', reason);
            S.notify.error(t('logo.rejectedPrefix', '') + ': ' + reason);
          });
          fileInput.value = '';
        }
      });
      var fileFieldWrap = field('logo.uploadLabel', 'Choose an image file', fileInput, t('logo.uploadHelp', ''));
      statusEl.id = 'wds-logo-status';

      replaceBtn = el('button', { class: 'btn btn--text', type: 'button', text: t('logo.replaceAction', ''), hidden: true, onclick: function () { fileInput.click(); } });
      removeBtn = el('button', {
        class: 'btn btn--outlined', type: 'button', text: t('logo.removeAction', ''),
        onclick: function () {
          var rec = getCustomRecord();
          S.confirm({
            anchor: removeBtn, returnTo: removeBtn,
            action: t('logo.removeConfirmAction', ''),
            target: t('logo.title', 'Site logo'),
            facts: rec ? [{ k: 'Format', v: rec.format || 'unknown' }, { k: 'Generated', v: rec.generatedAt || 'unknown' }] : [],
            detail: t('logo.identity', ''),
            irreversible: false
          }).then(function (ok) {
            if (!ok) return;
            S.store.remove('logo.custom');
            setSelection({ kind: 'shipped' });
            S.history.record('appearance', 'Site logo custom image removed', { 'logo.selection': 'shipped' });
            applyToPage();
            S.notify.info(t('logo.removedNotify', ''));
            renderPresets();
          });
        }
      });
      generateBtn = el('button', {
        class: 'btn btn--filled', type: 'button', text: t('logo.generateAction', ''), disabled: true,
        onclick: function () {
          if (!session.bitmap) return;
          setStatus('logo.generatingStatus');
          window.setTimeout(function () {
            try {
              var out = {};
              for (var i = 0; i < VARIANTS.length; i++) {
                var v = VARIANTS[i];
                var canvas = composeSquare(session.bitmap, session.crop, {
                  size: v.size, fit: session.fit, focalX: session.focalX, focalY: session.focalY,
                  transparent: session.transparent, background: session.background, cornerPct: session.cornerPct
                });
                out[v.id] = canvas.toDataURL('image/png');
              }
              Promise.all(VARIANTS.map(function (v) { return verifyVariant(out[v.id], v.size).then(function (ok) { return { id: v.id, ok: ok }; }); }))
                .then(function (results) {
                  var bad = results.filter(function (r) { return !r.ok; });
                  if (bad.length) {
                    setStatus('logo.stateConversionFailure', 'the ' + bad.map(function (b) { return b.id; }).join(', ') + ' variant failed verification');
                    S.notify.error(t('logo.stateConversionFailure', ''));
                    return;
                  }
                  var totalChars = out.master.length + out.favicon32.length + out.favicon16.length;
                  if (totalChars > STORAGE_BUDGET_CHARS) {
                    setStatus('logo.stateConversionFailure', 'the generated set is ' + totalChars.toLocaleString() + ' characters and the limit is ' + STORAGE_BUDGET_CHARS.toLocaleString());
                    S.notify.error(t('logo.stateConversionFailure', ''));
                    return;
                  }
                  var record = {
                    master: out.master, favicon32: out.favicon32, favicon16: out.favicon16,
                    format: session.format, generatedAt: new Date().toISOString(),
                    fit: session.fit, transparent: session.transparent, cornerPct: session.cornerPct
                  };
                  S.store.set('logo.custom', record);
                  setSelection({ kind: 'custom' });
                  S.history.record('appearance', 'Site logo set to a custom image', { 'logo.selection': 'custom', format: session.format });
                  setStatus('logo.stateConverted');
                  applyToPage();
                  S.notify.success(deco('success') + t('logo.appliedNotify', ''));
                  renderPresets();
                });
            } catch (e) {
              setStatus('logo.stateConversionFailure', 'an unexpected error stopped the conversion');
              S.notify.error(t('logo.stateConversionFailure', ''));
            }
          }, 0);
        }
      });

      var customPanel = el('div', { class: 'stack', style: { gap: '16px', 'min-width': '0' } }, [
        fileFieldWrap,
        statusEl,
        el('div', { class: 'row' }, [replaceBtn, removeBtn]),
        cropHost,
        el('div', { class: 'stack', style: { gap: '8px' } }, [
          el('h3', { text: t('logo.lossHeading', '') }),
          lossList
        ]),
        generateBtn
      ]);
      rebuildEditor();

      /* ---- about tab ------------------------------------------------ */
      var variantTable = el('div', { class: 'scrollx' }, el('table', { class: 'tbl' }, [
        el('thead', {}, el('tr', {}, [
          el('th', { text: t('logo.tableSize', '') }), el('th', { text: t('logo.tablePixels', '') }), el('th', { text: t('logo.tableUse', '') })
        ])),
        el('tbody', {}, [
          ['master', '256 × 256', t('logo.use.master', '')],
          ['favicon32', '32 × 32', t('logo.use.favicon32', '')],
          ['favicon16', '16 × 16', t('logo.use.favicon16', '')]
        ].map(function (row) {
          return el('tr', {}, [el('td', { text: row[0] }), el('td', { text: row[1] }), el('td', { text: row[2] })]);
        }))
      ]));
      resetBtn = el('button', {
        class: 'btn btn--danger', type: 'button', text: t('logo.resetAction', ''),
        onclick: function () {
          S.confirm({
            anchor: resetBtn, returnTo: resetBtn,
            action: t('logo.resetConfirmAction', ''), target: t('logo.title', 'Site logo'),
            facts: [{ k: 'Currently', v: getSelection().kind }],
            detail: t('logo.identity', ''), irreversible: false
          }).then(function (ok) {
            if (!ok) return;
            setSelection({ kind: 'shipped' });
            S.history.record('appearance', 'Site logo reset to the shipped mark', { 'logo.selection': 'shipped' });
            applyToPage();
            S.notify.success(t('logo.resetNotify', ''));
            renderPresets();
          });
        }
      });
      var aboutPanel = el('div', { class: 'stack', style: { gap: '16px', 'min-width': '0' } }, [
        el('h3', { text: t('logo.identityFactsHeading', '') }),
        el('p', { text: t('logo.identity', '') }),
        el('p', { text: t('logo.storageNote', '') }),
        el('p', { text: t('logo.privacyNote', '') }),
        el('h3', { text: t('logo.variantsHeading', '') }),
        el('p', { class: 'muted t-body-small', text: t('logo.variantsNote', '') }),
        variantTable,
        resetBtn
      ]);

      /* ---- assemble with the shared tab strip ------------------------ */
      var tabsHost = el('div', { style: { display: 'flex', 'min-height': '420px', border: '1px solid var(--md-sys-color-outline-variant)', 'border-radius': 'var(--md-sys-shape-corner-large)', overflow: 'hidden' } });
      var strip = S.tabs.create(tabsHost, {
        id: 'logo',
        dock: 'top',
        tabs: [
          { id: 'presets', labelKey: 'logo.tab.presets', icon: 'palette', panel: el('div', { style: { padding: '16px' } }, presetsPanel), keywords: 'shipped preset mark' },
          { id: 'custom', labelKey: 'logo.tab.custom', icon: 'upload', panel: el('div', { style: { padding: '16px' } }, customPanel), keywords: 'upload crop custom image' },
          { id: 'about', labelKey: 'logo.tab.about', icon: 'info', panel: el('div', { style: { padding: '16px' } }, aboutPanel), keywords: 'privacy identity boundary sizes' }
        ]
      });

      root.appendChild(el('h2', { text: t('logo.title', 'Site logo') }));
      root.appendChild(el('p', { class: 'muted', text: t('logo.lede', '') }));
      root.appendChild(tabsHost);
      host.appendChild(root);

      return {
        el: root,
        destroy: function () { if (root.parentNode) root.parentNode.removeChild(root); }
      };
    }

    /* ================================================================
     * 11. Discovery: the command palette and a context-menu item on
     * this page's own brand mark, both attached at runtime -- neither
     * requires editing a page this module does not own.
     * ================================================================ */
    function openEditorOverlay(anchor) {
      var body = el('div', { style: { 'min-width': '0' } });
      var panel = mount(body);
      S.overlay.open({
        anchor: anchor || null, title: t('logo.title', 'Site logo'), content: body,
        modal: false, draggable: true, resizable: true, persistKey: 'logo-editor',
        onClose: function () { panel.destroy(); }
      });
    }

    function registerDiscovery() {
      S.palette.register([
        { id: 'logo.command.open', title: t('logo.paletteCommand', 'Customize the site logo'), kind: 'command',
          keywords: 'logo mark icon favicon brand appearance customize', run: function () { openEditorOverlay(null); } }
      ]);
      try {
        var marks = document.querySelectorAll('.site-brand__mark');
        for (var i = 0; i < marks.length; i++) {
          (function (markEl) {
            S.contextMenu(markEl, function () {
              return [{ label: t('logo.contextMenuLabel', 'Customize this logo…'), icon: 'palette', run: function () { openEditorOverlay(markEl); } }];
            }, { ariaLabel: t('logo.contextMenuLabel', 'Customize this logo…'), storageKey: 'site-brand-logo' });
          })(marks[i]);
        }
      } catch (e) { /* the context menu is a convenience; the palette command always works */ }
    }

    /* ================================================================
     * 12. Boot.
     * ================================================================ */
    applyToPage();
    registerDiscovery();
    S.store.onChange(function (key) { if (key === 'logo.selection' || key === 'logo.custom') applyToPage(); });
    S.on('theme', applyToPage);
    S.on('i18n', function () { /* labels re-render on next open; live marks need no text */ });

    window.StudioLogo = {
      mount: mount,
      applyToPage: applyToPage,
      openEditor: openEditorOverlay,
      getSelection: getSelection,
      getCustomRecord: getCustomRecord,
      presets: function () { return PRESETS.map(function (p) { return { id: p.id, label: presetLabel(p) }; }); }
    };
  }

  if (window.Studio) window.Studio.ready(boot);
  else if (window.console && window.console.error) window.console.error('[StudioLogo] window.Studio was not found; load assets/site.js before assets/logo.js.');
})();
