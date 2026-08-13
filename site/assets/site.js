/* ==================================================================
 * World Downloader Studio -- shared documentation-site runtime
 *
 * ONE global: window.Studio. Nothing else is added to the window.
 *
 * Pure vanilla JavaScript. No build step, no framework, no bundler, no
 * module loader. Load it with a plain <script defer src="...">.
 *
 * NETWORK. This file makes exactly one kind of network request, and
 * only when the visitor leaves it switched on: the dim sum dish photo,
 * loaded from the public dim-sum catalog's release asset URL as an
 * <img>. There is no other fetch, XHR, WebSocket, beacon, font load,
 * script load or stylesheet load anywhere in the runtime. Turning the
 * photo setting off makes the site entirely offline, and the dish name
 * still appears because the dish metadata is bundled.
 *
 * STORAGE. Everything a visitor changes lives in this browser's
 * localStorage under the `wds.` prefix. Where a desktop application
 * would use an operating-system credential vault or an application
 * data folder, this site uses that same localStorage and says so at
 * the surface. Clearing this site's storage is the reset for
 * everything, including the School-mode credential and every lock.
 *
 * SECURITY. The locks, the School-mode PIN and the authenticator are
 * conveniences, not security boundaries. Anything held here is held in
 * the visitor's own browser, readable by anyone with the machine and a
 * developer console. Every surface that offers one says so in plain
 * words rather than implying protection it cannot provide.
 * ================================================================== */
(function () {
  'use strict';

  var VERSION = '1.0.0';
  var NS = 'wds.';

  /* ================================================================
   * 1. Storage
   *
   * localStorage can be absent (private mode in some browsers), full,
   * or refused. None of those may take the page down, so every access
   * falls back to an in-memory map and the runtime reports the state
   * honestly through Studio.store.status() rather than pretending a
   * value was saved.
   * ================================================================ */
  var memStore = Object.create(null);
  var storageOk = (function () {
    try {
      var k = NS + '__probe';
      window.localStorage.setItem(k, '1');
      window.localStorage.removeItem(k);
      return true;
    } catch (e) { return false; }
  })();
  var storageNote = storageOk
    ? 'Saved in this browser only.'
    : 'This browser refused local storage, so changes last until the page is closed.';

  var storeListeners = [];

  var store = {
    ok: function () { return storageOk; },
    status: function () { return { available: storageOk, note: storageNote, prefix: NS }; },
    get: function (key, fallback) {
      var raw;
      if (storageOk) {
        try { raw = window.localStorage.getItem(NS + key); } catch (e) { raw = null; }
      } else { raw = Object.prototype.hasOwnProperty.call(memStore, key) ? memStore[key] : null; }
      if (raw === null || raw === undefined) return fallback;
      try { return JSON.parse(raw); } catch (e) { return fallback; }
    },
    set: function (key, value) {
      var raw;
      try { raw = JSON.stringify(value); } catch (e) { return false; }
      var saved = false;
      if (storageOk) {
        try { window.localStorage.setItem(NS + key, raw); saved = true; }
        catch (e) { storageOk = false; storageNote = 'This browser ran out of local storage, so the newest changes were not saved.'; }
      }
      if (!saved) memStore[key] = raw;
      fire(key, value);
      return saved;
    },
    remove: function (key) {
      if (storageOk) { try { window.localStorage.removeItem(NS + key); } catch (e) {} }
      delete memStore[key];
      fire(key, undefined);
    },
    keys: function () {
      var out = [], i, k;
      if (storageOk) {
        try {
          for (i = 0; i < window.localStorage.length; i++) {
            k = window.localStorage.key(i);
            if (k && k.indexOf(NS) === 0) out.push(k.slice(NS.length));
          }
        } catch (e) {}
      }
      for (k in memStore) if (out.indexOf(k) < 0) out.push(k);
      return out.sort();
    },
    /* The one blanket reset. Named in every recovery message the site
       shows, because it is the honest answer to a forgotten lock. */
    clearAll: function () {
      var ks = store.keys(), i;
      for (i = 0; i < ks.length; i++) store.remove(ks[i]);
      return ks.length;
    },
    bytes: function () {
      var ks = store.keys(), total = 0, i, v;
      for (i = 0; i < ks.length; i++) {
        v = storageOk ? (window.localStorage.getItem(NS + ks[i]) || '') : (memStore[ks[i]] || '');
        total += (NS + ks[i]).length + v.length;
      }
      return total;
    },
    onChange: function (fn) { storeListeners.push(fn); return function () { var i = storeListeners.indexOf(fn); if (i >= 0) storeListeners.splice(i, 1); }; }
  };
  function fire(key, value) {
    for (var i = 0; i < storeListeners.length; i++) {
      try { storeListeners[i](key, value); } catch (e) { report(e); }
    }
  }
  function report(err) {
    if (window.console && window.console.error) window.console.error('[Studio]', err);
  }

  /* ================================================================
   * 2. Small utilities
   * ================================================================ */
  var uidCounter = 0;
  function uid(prefix) { uidCounter += 1; return (prefix || 'wds') + '-' + uidCounter + '-' + Math.floor(Math.random() * 1e6).toString(36); }

  function el(tag, attrs, children) {
    var node = document.createElement(tag), k, v;
    if (attrs) {
      for (k in attrs) {
        if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
        v = attrs[k];
        if (v === null || v === undefined || v === false) continue;
        if (k === 'class') node.className = v;
        else if (k === 'text') node.textContent = String(v);
        else if (k === 'html') node.innerHTML = v;
        else if (k === 'style' && typeof v === 'object') { for (var s in v) node.style.setProperty(s, v[s]); }
        else if (k.indexOf('on') === 0 && typeof v === 'function') node.addEventListener(k.slice(2), v);
        else if (k === 'dataset') { for (var d in v) node.dataset[d] = v[d]; }
        else if (v === true) node.setAttribute(k, '');
        else node.setAttribute(k, String(v));
      }
    }
    append(node, children);
    return node;
  }
  function append(node, children) {
    if (children === null || children === undefined) return node;
    if (Array.isArray(children)) {
      for (var i = 0; i < children.length; i++) append(node, children[i]);
      return node;
    }
    if (children instanceof Node) node.appendChild(children);
    else node.appendChild(document.createTextNode(String(children)));
    return node;
  }
  function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); return node; }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function clamp(n, lo, hi) { return n < lo ? lo : (n > hi ? hi : n); }
  function debounce(fn, ms) {
    var t = null;
    return function () {
      var args = arguments, self = this;
      if (t) clearTimeout(t);
      t = setTimeout(function () { t = null; fn.apply(self, args); }, ms);
    };
  }
  function nowIso() { return new Date().toISOString(); }
  function deepFreeze(o) {
    if (o && typeof o === 'object' && !Object.isFrozen(o)) {
      Object.freeze(o);
      Object.keys(o).forEach(function (k) { deepFreeze(o[k]); });
    }
    return o;
  }
  function randomBytes(n) {
    var out = new Uint8Array(n);
    if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(out);
    else { for (var i = 0; i < n; i++) out[i] = Math.floor(Math.random() * 256); }
    return out;
  }
  function toHex(bytes) {
    var s = '', i;
    for (i = 0; i < bytes.length; i++) s += ('0' + bytes[i].toString(16)).slice(-2);
    return s;
  }
  function fromHex(hex) {
    var out = new Uint8Array(hex.length >> 1), i;
    for (i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
    return out;
  }
  function utf8Bytes(str) {
    var out = [], i, c;
    for (i = 0; i < str.length; i++) {
      c = str.charCodeAt(i);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) { out.push(0xc0 | (c >> 6), 0x80 | (c & 63)); }
      else if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length) {
        var c2 = str.charCodeAt(i + 1);
        var cp = 0x10000 + ((c - 0xd800) << 10) + (c2 - 0xdc00);
        i++;
        out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
      } else { out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63)); }
    }
    return new Uint8Array(out);
  }

  /* ---- events ---------------------------------------------------- */
  var bus = Object.create(null);
  function on(name, fn) {
    (bus[name] = bus[name] || []).push(fn);
    return function () { var a = bus[name], i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); };
  }
  function emit(name, detail) {
    var a = bus[name] || [], i;
    for (i = 0; i < a.length; i++) { try { a[i](detail); } catch (e) { report(e); } }
  }

  /* ================================================================
   * 3. Icons -- inline SVG only. Never an icon font, never a network
   * image. A ligature icon font puts its own glyph name into the DOM,
   * so a name the font does not carry renders as a literal English
   * word and every textContent assertion downstream starts failing.
   * ================================================================ */
  var ICONS = {
    search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
    close: 'M6 6l12 12M18 6L6 18',
    check: 'M4 12l5 5L20 6',
    minus: 'M5 12h14',
    chevronRight: 'M9 5l7 7-7 7',
    chevronDown: 'M5 9l7 7 7-7',
    chevronUp: 'M19 15l-7-7-7 7',
    chevronLeft: 'M15 5l-7 7 7 7',
    more: 'M12 6h.01M12 12h.01M12 18h.01',
    plus: 'M12 5v14M5 12h14',
    pin: 'M9 3h6l-1 6 4 4H6l4-4-1-6zM12 13v8',
    folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
    lock: 'M6 11h12v9H6zM9 11V8a3 3 0 0 1 6 0v3',
    unlock: 'M6 11h12v9H6zM9 11V8a3 3 0 0 1 5.8-1',
    palette: 'M12 3a9 9 0 1 0 0 18h2a2 2 0 0 0 0-4 2 2 0 0 1 2-2h1a4 4 0 0 0 4-4 8 8 0 0 0-9-8zM7.5 10.5h.01M10.5 7.5h.01M14.5 7.5h.01',
    settings: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z',
    info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v5M12 8h.01',
    warn: 'M12 4l9 16H3zM12 10v4M12 17h.01',
    error: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM9 9l6 6M15 9l-6 6',
    success: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM8 12l3 3 5-5',
    copy: 'M9 9h10v10H9zM5 15V5h10',
    download: 'M12 4v11M7 11l5 5 5-5M5 20h14',
    upload: 'M12 20V9M7 13l5-5 5 5M5 4h14',
    trash: 'M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13',
    filter: 'M4 5h16l-6 7v6l-4 2v-8z',
    history: 'M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4M12 8v4l3 2',
    key: 'M15 4a5 5 0 1 0-4.6 7L9 12.4V15H6.6L4 17.6V21h4l7-7A5 5 0 0 0 15 4z',
    calendar: 'M4 6h16v15H4zM4 10h16M8 3v4M16 3v4',
    grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
    list: 'M4 6h16M4 12h16M4 18h16',
    menu: 'M4 6h16M4 12h16M4 18h16',
    home: 'M4 11l8-7 8 7M6 10v10h5v-6h2v6h5V10',
    dock: 'M4 4h16v16H4zM9 4v16',
    bell: 'M12 4a5 5 0 0 0-5 5v4l-2 3h14l-2-3V9a5 5 0 0 0-5-5zM10 19a2 2 0 0 0 4 0',
    doc: 'M6 3h8l4 4v14H6zM14 3v4h4',
    globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c2.5 3 2.5 15 0 18M12 3c-2.5 3-2.5 15 0 18',
    text: 'M5 5h14M9 5v14M7 19h4',
    reset: 'M4 4v6h6M4 10a8 8 0 1 1 2 6',
    play: 'M7 4l12 8-12 8z',
    stop: 'M6 6h12v12H6z',
    eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
    ticket: 'M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2 2 2 0 0 0 0 4 2 2 0 0 0 0 4 2 2 0 0 1-2 2H6a2 2 0 0 1-2-2 2 2 0 0 0 0-4 2 2 0 0 0 0-4zM10 8v8',
    drag: 'M9 6h.01M9 12h.01M9 18h.01M15 6h.01M15 12h.01M15 18h.01'
  };
  function icon(name, cls) {
    var d = ICONS[name] || ICONS.info;
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('class', 'i' + (cls ? ' ' + cls : ''));
    var p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', d);
    svg.appendChild(p);
    return svg;
  }

  /* ================================================================
   * 4. Accessibility helpers
   * ================================================================ */
  var liveRegion = null, liveAssertive = null;
  function ensureLive() {
    if (liveRegion) return;
    liveRegion = el('div', { class: 'visually-hidden', 'aria-live': 'polite', 'aria-atomic': 'true' });
    liveAssertive = el('div', { class: 'visually-hidden', role: 'alert', 'aria-live': 'assertive', 'aria-atomic': 'true' });
    document.body.appendChild(liveRegion);
    document.body.appendChild(liveAssertive);
  }
  var a11y = {
    announce: function (msg, assertive) {
      ensureLive();
      var target = assertive ? liveAssertive : liveRegion;
      target.textContent = '';
      window.setTimeout(function () { target.textContent = String(msg); }, 30);
    },
    reducedMotion: function () {
      if (document.documentElement.getAttribute('data-motion') === 'reduced') return true;
      return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    },
    focusables: function (root) {
      var sel = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),' +
        'textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"])';
      return Array.prototype.filter.call(root.querySelectorAll(sel), function (n) {
        return n.offsetWidth > 0 || n.offsetHeight > 0 || n === document.activeElement;
      });
    },
    trapFocus: function (root, opts) {
      opts = opts || {};
      var previous = document.activeElement;
      function key(e) {
        if (e.key !== 'Tab') return;
        var f = a11y.focusables(root);
        if (!f.length) { e.preventDefault(); return; }
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && (document.activeElement === first || !root.contains(document.activeElement))) {
          e.preventDefault(); last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault(); first.focus();
        }
      }
      root.addEventListener('keydown', key);
      var f = a11y.focusables(root);
      window.setTimeout(function () { (opts.initial || f[0] || root).focus(); }, 0);
      return function release() {
        root.removeEventListener('keydown', key);
        if (opts.restore !== false && previous && previous.focus) {
          try { previous.focus(); } catch (e) {}
        }
      };
    },
    /* Roving tabindex. `axis` decides which arrow keys move, which is
       what makes a vertical tab strip usable by keyboard: getting this
       wrong produces a strip that looks right and cannot be driven,
       and no capture will ever show it. */
    roving: function (container, opts) {
      opts = opts || {};
      var selector = opts.selector || '[role="tab"]';
      var axis = opts.axis || 'vertical';
      function items() { return Array.prototype.slice.call(container.querySelectorAll(selector)); }
      function setIndex(list, i) {
        for (var n = 0; n < list.length; n++) list[n].tabIndex = n === i ? 0 : -1;
      }
      function sync() {
        var list = items(), active = list.indexOf(document.activeElement);
        var sel = list.findIndex ? list.findIndex(function (x) { return x.getAttribute('aria-selected') === 'true'; }) : -1;
        setIndex(list, active >= 0 ? active : (sel >= 0 ? sel : 0));
      }
      function onKey(e) {
        var list = items(); if (!list.length) return;
        var i = list.indexOf(document.activeElement); if (i < 0) return;
        var prevKey = axis === 'horizontal' ? 'ArrowLeft' : 'ArrowUp';
        var nextKey = axis === 'horizontal' ? 'ArrowRight' : 'ArrowDown';
        var to = -1;
        if (e.key === nextKey) to = (i + 1) % list.length;
        else if (e.key === prevKey) to = (i - 1 + list.length) % list.length;
        else if (e.key === 'Home') to = 0;
        else if (e.key === 'End') to = list.length - 1;
        if (to < 0) return;
        e.preventDefault();
        setIndex(list, to);
        list[to].focus();
        if (opts.onMove) opts.onMove(list[to], to);
      }
      container.addEventListener('keydown', onKey);
      container.addEventListener('focusin', sync);
      sync();
      return { refresh: sync, setAxis: function (a) { axis = a; }, destroy: function () { container.removeEventListener('keydown', onKey); container.removeEventListener('focusin', sync); } };
    }
  };

  /* ================================================================
   * 5. Language, funny levels, emoji switch, personal vocabulary
   *
   * Dictionary format, one entry per key:
   *   D(key, enLevels, zhLevels)
   * where each argument is five variants separated by `|`, lowest
   * funny level first. Five is not decoration: the level slider is
   * wired to real copy, so an entry that shipped one variant would be
   * a slider that visibly does nothing.
   *
   * The FACTS never move. A level changes voice -- how a message is
   * told -- and never what it says happened, what will be affected, or
   * what a control does. Action labels therefore stay near-constant;
   * it is messages, titles and empty states that carry the humour.
   * ================================================================ */
  var DICT = Object.create(null);
  function D(key, en, zh) {
    DICT[key] = { en: String(en).split('|'), zh: String(zh).split('|') };
    if (DICT[key].en.length !== 5 || DICT[key].zh.length !== 5) {
      report(new Error('Dictionary entry "' + key + '" must carry five levels in both languages.'));
    }
  }

  /* -- actions. Deliberately stable: a button must say what it does. */
  D('act.ok', 'OK|OK|OK|OK|OK', '確定|確定|確定|確定|確定');
  D('act.cancel', 'Cancel|Cancel|Cancel|Cancel|Cancel', '取消|取消|取消|取消|取消');
  D('act.close', 'Close|Close|Close|Close|Close', '關閉|關閉|閂咗佢|閂咗佢|閂咗佢');
  D('act.apply', 'Apply|Apply|Apply|Apply|Apply', '套用|套用|套用|套用|套用');
  D('act.save', 'Save|Save|Save|Save|Save', '儲存|儲存|儲存|儲存|儲存');
  D('act.copy', 'Copy|Copy|Copy|Copy|Copy', '複製|複製|複製|複製|複製');
  D('act.copied', 'Copied|Copied|Copied|Copied, safe and sound|Copied. Do not lose it this time',
    '已複製|已複製|複製好喇|複製好喇，收好佢|複製好喇，今次唔好再唔見');
  D('act.reset', 'Reset|Reset|Reset|Reset|Reset', '重設|重設|重設|重設|重設');
  D('act.delete', 'Delete|Delete|Delete|Delete|Delete', '刪除|刪除|刪除|刪除|刪除');
  D('act.remove', 'Remove|Remove|Remove|Remove|Remove', '移除|移除|移除|移除|移除');
  D('act.export', 'Export|Export|Export|Export|Export', '匯出|匯出|匯出|匯出|匯出');
  D('act.import', 'Import|Import|Import|Import|Import', '匯入|匯入|匯入|匯入|匯入');
  D('act.search', 'Search|Search|Search|Search|Search', '搜尋|搜尋|搜尋|搜尋|搜尋');
  D('act.filter', 'Filter|Filter|Filter|Filter|Filter', '篩選|篩選|篩選|篩選|篩選');
  D('act.more', 'More|More|More|More|More', '更多|更多|更多|更多|更多');
  D('act.back', 'Back|Back|Back|Back|Back', '返回|返回|返回|返回|返回');
  D('act.next', 'Next|Next|Next|Next|Next', '下一步|下一步|下一步|下一步|下一步');
  D('act.unlock', 'Unlock|Unlock|Unlock|Unlock|Unlock', '解鎖|解鎖|解鎖|解鎖|解鎖');
  D('act.lock', 'Lock|Lock|Lock|Lock|Lock', '鎖上|鎖上|鎖上|鎖上|鎖上');
  D('act.restore', 'Restore|Restore|Restore|Restore|Restore', '還原|還原|還原|還原|還原');
  D('act.selectAll', 'Select all|Select all|Select all|Select all|Select all', '全選|全選|全選|全選|全選');
  D('act.invert', 'Invert selection|Invert selection|Invert selection|Invert selection|Invert selection', '反向選取|反向選取|反向選取|反向選取|反向選取');
  D('act.dismiss', 'Dismiss|Dismiss|Dismiss|Dismiss|Dismiss', '關閉|關閉|收咗佢|收咗佢|收咗佢');
  D('act.retry', 'Retry|Retry|Try again|Try again|Try again', '重試|重試|再試一次|再試一次|再試一次');
  D('act.undo', 'Undo|Undo|Undo|Undo|Undo', '復原|復原|復原|復原|復原');
  D('act.openEditor', 'Edit appearance|Edit appearance|Edit appearance|Edit appearance|Edit appearance',
    '編輯外觀|編輯外觀|編輯外觀|編輯外觀|編輯外觀');
  D('act.emergencyExit', 'Emergency exit|Emergency exit|Emergency exit|Emergency exit|Emergency exit', '緊急退出|緊急退出|緊急退出|緊急退出|緊急退出');

  /* -- general messages: this is where a level actually shows. */
  D('msg.noMatch',
    'No matches.|No matches.|Nothing matched that.|Nothing matched that one. Try fewer letters.|Nothing at all. Not one thing. Try fewer letters.',
    '無相符項目。|無相符項目。|搵唔到喎。|搵唔到喎，試下打少幾個字。|一個都無。真係一個都無，試下打少幾個字。');
  D('msg.empty',
    'Nothing here yet.|Nothing here yet.|Nothing here yet.|Nothing here yet. That is the correct amount so far.|Empty. Gloriously, deliberately empty.',
    '暫時未有嘢。|暫時未有嘢。|暫時未有嘢。|暫時未有嘢，咁樣先啱。|空空如也，好安樂。');
  D('msg.savedLocal',
    'Saved in this browser.|Saved in this browser.|Saved in this browser.|Saved in this browser, and nowhere else.|Saved in this browser, and absolutely nowhere else.',
    '已儲存喺呢個瀏覽器。|已儲存喺呢個瀏覽器。|已儲存喺呢個瀏覽器。|淨係存喺呢個瀏覽器，其他地方都無。|淨係存喺呢個瀏覽器，第二度真係一份都無。');
  D('msg.storageOff',
    'This browser refused local storage. Changes last until the page is closed.|This browser refused local storage. Changes last until the page is closed.|This browser will not store anything, so changes last until the page closes.|This browser will not store anything, so changes vanish when the page closes.|This browser will not store a thing, so every change here is strictly temporary.',
    '呢個瀏覽器唔畀本機儲存，改動淨係維持到閂頁為止。|呢個瀏覽器唔畀本機儲存，改動淨係維持到閂頁為止。|呢個瀏覽器唔肯存嘢，一閂頁就無晒。|呢個瀏覽器唔肯存嘢，閂咗頁就乜都無。|呢個瀏覽器一啲都唔肯存，所有改動都係臨時嘅。');
  D('msg.notSecurity',
    'This is a convenience lock, not security. Anyone with this computer can clear the site data and get past it.|This is a convenience lock, not security. Anyone with this computer can clear the site data and get past it.|This lock is for fun. Anyone with this computer can clear the site data and walk straight past it.|This lock is for fun, not for safety. Anyone holding this computer can clear the site data and stroll past it.|This lock is a joke you are playing on yourself. Anyone with this computer clears the site data and walks straight through.',
    '呢個鎖係方便用，唔係保安。任何人攞到部電腦，清咗網站資料就過到。|呢個鎖係方便用，唔係保安。任何人攞到部電腦，清咗網站資料就過到。|呢個鎖係玩下嘅。任何人攞到部電腦，清咗網站資料就直接行過。|呢個鎖係玩下嘅，唔係保安。攞住部電腦嘅人清咗網站資料就慢慢行過。|呢個鎖係你同自己開嘅玩笑。攞住部電腦嘅人清咗網站資料就穿過去。');
  D('msg.clearReset',
    'To reset everything, clear this site\'s storage in your browser settings.|To reset everything, clear this site\'s storage in your browser settings.|Forgotten it? Clear this site\'s storage in your browser settings and start fresh.|Forgotten it? Clear this site\'s storage in your browser settings; everything here resets.|Forgotten it? Clear this site\'s storage in your browser settings. Everything resets, including this lock.',
    '想全部重設，喺瀏覽器設定度清除呢個網站嘅儲存空間。|想全部重設，喺瀏覽器設定度清除呢個網站嘅儲存空間。|唔記得咗？喺瀏覽器設定清除呢個網站嘅儲存空間就重新開始。|唔記得咗？喺瀏覽器設定清除呢個網站嘅儲存空間，全部都會重設。|唔記得咗？喺瀏覽器設定清除呢個網站嘅儲存空間，連呢個鎖都會一齊重設。');
  D('msg.appliedLive',
    'Applied.|Applied.|Applied.|Applied, live, no reload needed.|Applied on the spot. No reload, no restart, no ceremony.',
    '已套用。|已套用。|已套用。|即時生效，唔使重新載入。|即刻生效，唔使重新載入，唔使重開，唔使拜神。');

  /* -- appearance and theme */
  D('theme.title', 'Appearance|Appearance|Appearance|Appearance|Appearance', '外觀|外觀|外觀|外觀|外觀');
  D('theme.mode', 'Theme|Theme|Theme|Theme|Theme', '主題|主題|主題|主題|主題');
  D('theme.light', 'Light|Light|Light|Light|Light', '淺色|淺色|淺色|淺色|淺色');
  D('theme.dark', 'Dark|Dark|Dark|Dark|Dark', '深色|深色|深色|深色|深色');
  D('theme.system', 'Follow system|Follow system|Follow system|Follow system|Follow system', '跟隨系統|跟隨系統|跟隨系統|跟隨系統|跟隨系統');
  D('theme.density', 'Density|Density|Density|Density|Density', '密度|密度|密度|密度|密度');
  D('theme.seed', 'Accent colour|Accent colour|Accent colour|Accent colour|Accent colour', '主色|主色|主色|主色|主色');
  D('theme.font', 'Interface font|Interface font|Interface font|Interface font|Interface font', '介面字型|介面字型|介面字型|介面字型|介面字型');
  D('theme.fontScale', 'Text size|Text size|Text size|Text size|Text size', '文字大小|文字大小|文字大小|文字大小|文字大小');
  D('theme.motion', 'Reduce motion|Reduce motion|Reduce motion|Reduce motion|Reduce motion', '減少動態效果|減少動態效果|減少動態效果|減少動態效果|減少動態效果');

  /* -- language settings */
  D('lang.title', 'Language|Language|Language|Language|Language', '語言|語言|語言|語言|語言');
  D('lang.en', 'English|English|English|English|English', '英文|英文|英文|英文|英文');
  D('lang.zh', 'Cantonese|Cantonese|Cantonese|Cantonese|Cantonese', '廣東話|廣東話|廣東話|廣東話|廣東話');
  D('lang.both', 'Bilingual|Bilingual|Bilingual|Bilingual|Bilingual', '雙語|雙語|雙語|雙語|雙語');
  D('lang.funnyEn', 'Funny level, English|Funny level, English|Funny level, English|Funny level, English|Funny level, English',
    '搞笑程度（英文）|搞笑程度（英文）|搞笑程度（英文）|搞笑程度（英文）|搞笑程度（英文）');
  D('lang.funnyZh', 'Funny level, Cantonese|Funny level, Cantonese|Funny level, Cantonese|Funny level, Cantonese|Funny level, Cantonese',
    '搞笑程度（廣東話）|搞笑程度（廣東話）|搞笑程度（廣東話）|搞笑程度（廣東話）|搞笑程度（廣東話）');
  D('lang.funnyNote',
    'The funny level changes the voice of every message on this site, including warnings and errors. What a message says happened, and what a control does, never changes.|The funny level changes the voice of every message on this site, including warnings and errors. What a message says happened, and what a control does, never changes.|The funny level restyles every message here, warnings and errors included. The facts stay exactly the same.|The funny level restyles every message here, warnings and errors included. The facts underneath never move an inch.|The funny level restyles every single message here, warnings and errors and all. The facts stay nailed down; only the tone gets to wander.',
    '搞笑程度會改變本站所有訊息嘅語氣，包括警告同錯誤。訊息講嘅事實同控制項嘅作用永遠唔會變。|搞笑程度會改變本站所有訊息嘅語氣，包括警告同錯誤。訊息講嘅事實同控制項嘅作用永遠唔會變。|搞笑程度會改晒呢度所有訊息嘅語氣，警告同錯誤都包，事實一模一樣。|搞笑程度會改晒呢度所有訊息嘅語氣，警告同錯誤都包，底下嘅事實一寸都唔會郁。|搞笑程度會改晒呢度每一句嘅語氣，警告錯誤全部有份。事實釘死咗，淨係語氣可以周圍走。');
  D('lang.emoji', 'Show emojis in dialogs and message boxes|Show emojis in dialogs and message boxes|Show emojis in dialogs and message boxes|Show emojis in dialogs and message boxes|Show emojis in dialogs and message boxes',
    '喺對話框同訊息框顯示表情符號|喺對話框同訊息框顯示表情符號|喺對話框同訊息框顯示表情符號|喺對話框同訊息框顯示表情符號|喺對話框同訊息框顯示表情符號');
  D('lang.emojiNote',
    'Emojis appear only in dialogs and message boxes. They never appear in buttons, action labels, field labels or accessible names.|Emojis appear only in dialogs and message boxes. They never appear in buttons, action labels, field labels or accessible names.|Emojis show up only in dialogs and message boxes, never in a button or a label.|Emojis show up only in dialogs and message boxes, never in a button, a label or a name a screen reader will read.|Emojis stay in dialogs and message boxes where they belong, and never wander into a button, a label or anything a screen reader has to read aloud.',
    '表情符號淨係喺對話框同訊息框出現，唔會出現喺按鈕、動作標籤、欄位標籤或者無障礙名稱。|表情符號淨係喺對話框同訊息框出現，唔會出現喺按鈕、動作標籤、欄位標籤或者無障礙名稱。|表情符號淨係喺對話框同訊息框度出現，按鈕同標籤都唔會有。|表情符號淨係喺對話框同訊息框度出現，按鈕、標籤同讀屏會讀嘅名都唔會有。|表情符號乖乖留喺對話框同訊息框，唔會走入按鈕、標籤，更加唔會走入讀屏要讀出嚟嘅名。');
  D('vocab.title', 'Personal vocabulary|Personal vocabulary|Personal vocabulary|Personal vocabulary|Personal vocabulary',
    '個人詞彙|個人詞彙|個人詞彙|個人詞彙|個人詞彙');
  D('vocab.none',
    'No vocabulary file loaded. The site shows its original wording.|No vocabulary file loaded. The site shows its original wording.|No vocabulary file loaded, so you are reading the original wording.|No vocabulary file loaded, so every word here is the one that shipped.|No vocabulary file loaded, so every word here is exactly the one that shipped. Nothing is being quietly substituted.',
    '未載入詞彙檔案，網站顯示原本嘅字眼。|未載入詞彙檔案，網站顯示原本嘅字眼。|未載入詞彙檔案，你而家睇到嘅係原本字眼。|未載入詞彙檔案，所以每個字都係出廠嗰個。|未載入詞彙檔案，所以每個字都係出廠嗰個，無人靜靜雞換過。');
  D('vocab.loaded',
    'Vocabulary file loaded.|Vocabulary file loaded.|Vocabulary file loaded.|Vocabulary file loaded and in effect.|Vocabulary file loaded and in effect right now.',
    '已載入詞彙檔案。|已載入詞彙檔案。|已載入詞彙檔案。|已載入詞彙檔案，而家生效緊。|已載入詞彙檔案，而家即刻生效緊。');
  D('vocab.rejected',
    'That file was rejected and nothing was applied.|That file was rejected and nothing was applied.|That file was rejected. Nothing at all was applied.|That file was rejected, so not one word of it was applied.|That file was rejected outright, so not one single word of it reached the page.',
    '呢個檔案被拒絕，冇任何內容套用。|呢個檔案被拒絕，冇任何內容套用。|呢個檔案被拒絕，一啲都冇套用。|呢個檔案被拒絕，入面一個字都冇用到。|呢個檔案直接被拒，入面連一個字都無走到上版面。');

  /* -- School mode */
  D('school.default', 'School mode|School mode|School mode|School mode|School mode', '學校模式|學校模式|學校模式|學校模式|學校模式');
  D('school.on', 'On|On|On|On|On', '開啟|開啟|開啟|開啟|開啟');
  D('school.off', 'Off|Off|Off|Off|Off', '關閉|關閉|關閉|關閉|關閉');
  D('school.rename', 'Rename this mode|Rename this mode|Rename this mode|Rename this mode|Rename this mode',
    '重新命名呢個模式|重新命名呢個模式|重新命名呢個模式|重新命名呢個模式|重新命名呢個模式');
  D('school.setPin', 'Set the unlock code|Set the unlock code|Set the unlock code|Set the unlock code|Set the unlock code',
    '設定解鎖碼|設定解鎖碼|設定解鎖碼|設定解鎖碼|設定解鎖碼');
  D('school.pinWrong',
    'That code did not match.|That code did not match.|That code did not match. Have another go.|That code did not match. Have another go, nothing was harmed.|That code did not match. Nothing broke, nothing was lost, have another go.',
    '呢個碼唔啱。|呢個碼唔啱。|呢個碼唔啱，再試多次。|呢個碼唔啱，再試多次，冇嘢有損失。|呢個碼唔啱。冇壞嘢，冇嘢唔見咗，再試多次。');
  D('school.explain',
    'While this mode is on, the site shows English only. Cantonese, bilingual mode, the funny levels, personal vocabulary and every dim sum feature are removed from the interface rather than merely disabled. Your existing choices are kept and come back when the mode is turned off.|While this mode is on, the site shows English only. Cantonese, bilingual mode, the funny levels, personal vocabulary and every dim sum feature are removed from the interface rather than merely disabled. Your existing choices are kept and come back when the mode is turned off.|While this mode is on the site is English only. Cantonese, bilingual mode, the funny levels, personal vocabulary and the dim sum surprise are taken out of the interface, not just greyed out. Your settings are kept and return when you switch it off.|While this mode is on the site is English only. Cantonese, bilingual mode, the funny levels, personal vocabulary and the dim sum surprise leave the interface entirely rather than sitting there greyed out. Your settings are kept and come straight back when you switch it off.|While this mode is on the site speaks English and nothing else. Cantonese, bilingual mode, both funny sliders, personal vocabulary and every last dumpling leave the interface completely rather than lurking greyed out. Your settings are kept safe and walk straight back in the moment you switch it off.',
    '呢個模式開咗嗰陣，網站淨係顯示英文。廣東話、雙語模式、搞笑程度、個人詞彙同所有點心功能會喺介面度移除，唔係淨係停用。你原本嘅選擇會保留，關咗模式就返嚟。|呢個模式開咗嗰陣，網站淨係顯示英文。廣東話、雙語模式、搞笑程度、個人詞彙同所有點心功能會喺介面度移除，唔係淨係停用。你原本嘅選擇會保留，關咗模式就返嚟。|開咗呢個模式，成個網站淨係英文。廣東話、雙語、搞笑程度、個人詞彙同點心驚喜會直接由介面消失，唔係灰咗喺度。設定會保留，閂咗就返晒嚟。|開咗呢個模式，成個網站淨係英文。廣東話、雙語、搞笑程度、個人詞彙同點心驚喜會完全離開介面，唔係灰灰哋坐喺度。設定保留住，閂咗即刻返晒嚟。|開咗呢個模式，成個網站淨係識講英文。廣東話、雙語、兩條搞笑滑桿、個人詞彙同每一籠點心全部離開介面，唔會灰住喺度扮嘢。設定收好晒，你一閂即刻行返入嚟。');

  /* -- notifications and confirmation */
  D('notify.centre', 'Notifications|Notifications|Notifications|Notifications|Notifications', '通知|通知|通知|通知|通知');
  D('notify.none',
    'No notifications.|No notifications.|No notifications yet.|No notifications yet. Suspiciously quiet.|No notifications yet. Suspiciously, wonderfully quiet.',
    '無通知。|無通知。|暫時無通知。|暫時無通知，靜到有啲可疑。|暫時無通知，靜到有啲可疑，不過幾舒服。');
  D('confirm.title', 'Confirm this action|Confirm this action|Confirm this action|Confirm this action|Confirm this action',
    '確認呢個動作|確認呢個動作|確認呢個動作|確認呢個動作|確認呢個動作');
  D('confirm.key1', 'First key|First key|First key|First key|First key', '第一把鎖匙|第一把鎖匙|第一把鎖匙|第一把鎖匙|第一把鎖匙');
  D('confirm.key2', 'Second key|Second key|Second key|Second key|Second key', '第二把鎖匙|第二把鎖匙|第二把鎖匙|第二把鎖匙|第二把鎖匙');
  D('confirm.slide', 'Slide all the way across to confirm|Slide all the way across to confirm|Slide all the way across to confirm|Slide all the way across to confirm|Slide all the way across to confirm',
    '拉到最尾去確認|拉到最尾去確認|拉到最尾去確認|拉到最尾去確認|拉到最尾去確認');
  D('confirm.needKeys',
    'Turn both keys before the slider will move.|Turn both keys before the slider will move.|Turn both keys and the slider wakes up.|Turn both keys and the slider wakes up. One is not enough.|Turn both keys and the slider wakes up. One key gets you precisely nowhere.',
    '兩把鎖匙都要扭咗，滑桿先郁得。|兩把鎖匙都要扭咗，滑桿先郁得。|兩把鎖匙扭晒，滑桿先會醒。|兩把鎖匙扭晒，滑桿先會醒，得一把唔夠。|兩把鎖匙扭晒，滑桿先會醒。得一把嘅話你邊度都去唔到。');
  D('confirm.done', 'Done.|Done.|Done.|Done. That one is not coming back.|Done. That one is not coming back, exactly as advertised.',
    '完成。|完成。|完成。|完成，返唔到轉頭㗎喇。|完成。返唔到轉頭，同講明嘅一模一樣。');

  /* -- search and regex */
  D('search.placeholder', 'Search|Search|Search|Search|Search', '搜尋|搜尋|搜尋|搜尋|搜尋');
  D('search.regexOn', 'Regular expression|Regular expression|Regular expression|Regular expression|Regular expression',
    '正規表達式|正規表達式|正規表達式|正規表達式|正規表達式');
  D('search.plain', 'Plain text|Plain text|Plain text|Plain text|Plain text', '純文字|純文字|純文字|純文字|純文字');
  D('rex.title', 'Regular expression builder|Regular expression builder|Regular expression builder|Regular expression builder|Regular expression builder',
    '正規表達式編輯器|正規表達式編輯器|正規表達式編輯器|正規表達式編輯器|正規表達式編輯器');
  D('rex.engine',
    'Engine: JavaScript RegExp, as implemented by this browser. Backslashes, character classes and flags follow that dialect.|Engine: JavaScript RegExp, as implemented by this browser. Backslashes, character classes and flags follow that dialect.|Engine: JavaScript RegExp in this very browser. Escapes, classes and flags follow that dialect and no other.|Engine: JavaScript RegExp in this very browser. Escapes, classes and flags follow that dialect and no other, so a pattern from somewhere else may not mean the same thing.|Engine: JavaScript RegExp in this very browser. Escapes, classes and flags follow that dialect and no other, so a pattern copied from a different tool may quietly mean something else here.',
    '引擎：呢個瀏覽器實作嘅 JavaScript RegExp。跳脫字元、字元類同旗標都跟呢個方言。|引擎：呢個瀏覽器實作嘅 JavaScript RegExp。跳脫字元、字元類同旗標都跟呢個方言。|引擎：就係呢個瀏覽器嘅 JavaScript RegExp，跳脫、字元類同旗標淨係跟呢個方言。|引擎：就係呢個瀏覽器嘅 JavaScript RegExp，跳脫、字元類同旗標淨係跟呢個方言，第二度抄嚟嘅式可能唔同意思。|引擎：就係呢個瀏覽器嘅 JavaScript RegExp。跳脫、字元類同旗標淨係跟呢個方言，由第二個工具抄嚟嘅式可能靜雞雞變咗第二個意思。');
  D('rex.invalid', 'Not a valid pattern|Not a valid pattern|Not a valid pattern|Not a valid pattern|Not a valid pattern',
    '唔係有效嘅式|唔係有效嘅式|唔係有效嘅式|唔係有效嘅式|唔係有效嘅式');
  D('rex.risk',
    'This pattern nests one repetition inside another, which can take a very long time on some inputs. Evaluation is bounded, and the sample is capped.|This pattern nests one repetition inside another, which can take a very long time on some inputs. Evaluation is bounded, and the sample is capped.|This pattern nests a repeat inside a repeat, which can crawl on some inputs. Evaluation is bounded and the sample is capped.|This pattern nests a repeat inside a repeat, which can crawl to a halt on the wrong input. Evaluation is bounded and the sample is capped, so the page will not hang.|This pattern nests a repeat inside a repeat, which on the wrong input can crawl to a dead stop. Evaluation is bounded and the sample is capped, so the page keeps breathing either way.',
    '呢個式喺重複入面再包重複，遇著某啲輸入會好慢。運算有上限，樣本亦有上限。|呢個式喺重複入面再包重複，遇著某啲輸入會好慢。運算有上限，樣本亦有上限。|呢個式重複套重複，遇啱輸入會慢到爬。運算有上限，樣本有上限。|呢個式重複套重複，遇啱輸入會慢到停低。運算同樣本都有上限，個頁唔會吊死。|呢個式重複套重複，遇啱輸入會慢到直接停低。運算同樣本都有上限，隻頁點都仲有氣。');

  /* -- tabs */
  D('tabs.searchStrip', 'Search this tab strip|Search this tab strip|Search this tab strip|Search this tab strip|Search this tab strip',
    '搜尋呢條分頁列|搜尋呢條分頁列|搜尋呢條分頁列|搜尋呢條分頁列|搜尋呢條分頁列');
  D('tabs.searchGroup', 'Search this group|Search this group|Search this group|Search this group|Search this group',
    '搜尋呢個群組|搜尋呢個群組|搜尋呢個群組|搜尋呢個群組|搜尋呢個群組');
  D('tabs.searchGroups', 'Search groups by name|Search groups by name|Search groups by name|Search groups by name|Search groups by name',
    '按名稱搜尋群組|按名稱搜尋群組|按名稱搜尋群組|按名稱搜尋群組|按名稱搜尋群組');
  D('tabs.searchAll', 'Search every open tab|Search every open tab|Search every open tab|Search every open tab|Search every open tab',
    '搜尋所有已開分頁|搜尋所有已開分頁|搜尋所有已開分頁|搜尋所有已開分頁|搜尋所有已開分頁');
  D('tabs.dock', 'Tab strip position|Tab strip position|Tab strip position|Tab strip position|Tab strip position',
    '分頁列位置|分頁列位置|分頁列位置|分頁列位置|分頁列位置');
  D('tabs.pin', 'Pin tab|Pin tab|Pin tab|Pin tab|Pin tab', '釘住分頁|釘住分頁|釘住分頁|釘住分頁|釘住分頁');
  D('tabs.unpin', 'Unpin tab|Unpin tab|Unpin tab|Unpin tab|Unpin tab', '取消釘住|取消釘住|取消釘住|取消釘住|取消釘住');
  D('tabs.moveGroup', 'Move into group|Move into group|Move into group|Move into group|Move into group',
    '移入群組|移入群組|移入群組|移入群組|移入群組');
  D('tabs.closeContaining', 'Close tabs containing text|Close tabs containing text|Close tabs containing text|Close tabs containing text|Close tabs containing text',
    '關閉含有指定文字嘅分頁|關閉含有指定文字嘅分頁|關閉含有指定文字嘅分頁|關閉含有指定文字嘅分頁|關閉含有指定文字嘅分頁');
  D('tabs.closeNotContaining', 'Close tabs not containing text|Close tabs not containing text|Close tabs not containing text|Close tabs not containing text|Close tabs not containing text',
    '關閉唔含指定文字嘅分頁|關閉唔含指定文字嘅分頁|關閉唔含指定文字嘅分頁|關閉唔含指定文字嘅分頁|關閉唔含指定文字嘅分頁');
  D('tabs.pinnedExcluded',
    'Pinned tabs are excluded unless you include them.|Pinned tabs are excluded unless you include them.|Pinned tabs sit this one out unless you include them.|Pinned tabs sit this one out unless you deliberately include them.|Pinned tabs sit this one out entirely unless you deliberately, knowingly include them.',
    '除非你特別包括，否則釘住嘅分頁唔計。|除非你特別包括，否則釘住嘅分頁唔計。|釘住嘅分頁唔參加，除非你特別包括佢哋。|釘住嘅分頁唔參加，除非你特登包括佢哋。|釘住嘅分頁完全唔參加，除非你特登、清清楚楚咁包括佢哋。');

  /* -- site navigation. Near-constant across levels, like the actions
     above: these name real pages, so it is the surrounding messages
     that carry the humour, not the destinations themselves. */
  D('nav.home', 'Home|Home|Home|Home|Home', '首頁|首頁|首頁|首頁|首頁');
  D('nav.docs', 'Documentation|Documentation|Documentation|Documentation|Documentation', '文檔|文檔|文檔|文檔|文檔');
  D('nav.downloads', 'Downloads|Downloads|Downloads|Downloads|Downloads', '下載|下載|下載|下載|下載');
  D('nav.converter', 'Converter|Converter|Converter|Converter|Converter', '轉換器|轉換器|轉換器|轉換器|轉換器');
  D('nav.models', 'Local models|Local models|Local models|Local models|Local models', '本機模型|本機模型|本機模型|本機模型|本機模型');
  D('nav.changelog', 'Changelog|Changelog|Changelog|Changelog|Changelog', '更新日誌|更新日誌|更新日誌|更新日誌|更新日誌');
  D('nav.settings', 'Settings|Settings|Settings|Settings|Settings', '設定|設定|設定|設定|設定');
  D('nav.site', 'Site navigation|Site navigation|Site navigation|Site navigation|Site navigation', '網站導覽|網站導覽|網站導覽|網站導覽|網站導覽');
  D('nav.filter', 'Filter pages|Filter pages|Filter pages|Filter pages|Filter pages', '篩選頁面|篩選頁面|篩選頁面|篩選頁面|篩選頁面');

  /* -- palette */
  D('palette.title', 'Command palette|Command palette|Command palette|Command palette|Command palette',
    '命令面板|命令面板|命令面板|命令面板|命令面板');
  D('palette.hint',
    'Type to search commands, pages, articles, settings and appearance controls.|Type to search commands, pages, articles, settings and appearance controls.|Type to find any command, page, article, setting or appearance control here.|Type to find any command, page, article, setting or appearance control on this whole site.|Type to find any command, page, article, setting or appearance control anywhere on this site. It all lives in here.',
    '輸入嚟搜尋指令、頁面、文章、設定同外觀控制項。|輸入嚟搜尋指令、頁面、文章、設定同外觀控制項。|輸入就搵到呢度任何指令、頁面、文章、設定或者外觀控制項。|輸入就搵到成個網站任何指令、頁面、文章、設定或者外觀控制項。|輸入就搵到成個網站任何一個指令、頁面、文章、設定或者外觀控制項，全部都喺呢度。');
  D('palette.size', 'Palette size|Palette size|Palette size|Palette size|Palette size', '面板大小|面板大小|面板大小|面板大小|面板大小');

  /* -- locks, tickets, authenticator */
  D('locks.title', 'Locks|Locks|Locks|Locks|Locks', '鎖|鎖|鎖|鎖|鎖');
  D('locks.lockThis', 'Lock this element|Lock this element|Lock this element|Lock this element|Lock this element',
    '鎖住呢個元素|鎖住呢個元素|鎖住呢個元素|鎖住呢個元素|鎖住呢個元素');
  D('locks.locked', 'Locked|Locked|Locked|Locked|Locked', '已鎖上|已鎖上|已鎖上|已鎖上|已鎖上');
  D('locks.forgot', 'Forgotten your password?|Forgotten your password?|Forgotten your password?|Forgotten your password?|Forgotten your password?',
    '唔記得咗密碼？|唔記得咗密碼？|唔記得咗密碼？|唔記得咗密碼？|唔記得咗密碼？');
  D('locks.own',
    'Every lock keeps its own password or one-time code. Unlocking one never unlocks another.|Every lock keeps its own password or one-time code. Unlocking one never unlocks another.|Every lock has its own password or code. Opening one opens exactly one.|Every lock has its own password or code. Opening one opens exactly one and not a single other.|Every lock has its very own password or code. Opening one opens exactly one, and there is no master key anywhere.',
    '每個鎖有自己嘅密碼或者一次性驗證碼，解開一個唔會解開另一個。|每個鎖有自己嘅密碼或者一次性驗證碼，解開一個唔會解開另一個。|每個鎖有自己嘅密碼或碼，開一個就淨係開一個。|每個鎖有自己嘅密碼或碼，開一個就淨係開一個，第二個都唔會郁。|每個鎖都有自己嗰個密碼或者碼，開一個就淨係開一個，全世界都無總匙。');
  D('tickets.title', 'Support Tickets|Support Tickets|Support Tickets|Support Tickets|Support Tickets',
    '支援工單|支援工單|支援工單|支援工單|支援工單');
  /* The one line the funny level must never touch. All five variants
     are deliberately identical, in both languages, so no slider
     position can soften it into a joke. */
  D('tickets.plain',
    ['Nothing is sent anywhere. No ticket exists outside this browser. No network request is made. No data is collected. Nobody is reading this.',
      'Nothing is sent anywhere. No ticket exists outside this browser. No network request is made. No data is collected. Nobody is reading this.',
      'Nothing is sent anywhere. No ticket exists outside this browser. No network request is made. No data is collected. Nobody is reading this.',
      'Nothing is sent anywhere. No ticket exists outside this browser. No network request is made. No data is collected. Nobody is reading this.',
      'Nothing is sent anywhere. No ticket exists outside this browser. No network request is made. No data is collected. Nobody is reading this.'].join('|'),
    ['乜都唔會送去任何地方。呢個工單淨係存在於呢個瀏覽器。冇任何網絡要求。冇收集任何資料。冇人會睇。',
      '乜都唔會送去任何地方。呢個工單淨係存在於呢個瀏覽器。冇任何網絡要求。冇收集任何資料。冇人會睇。',
      '乜都唔會送去任何地方。呢個工單淨係存在於呢個瀏覽器。冇任何網絡要求。冇收集任何資料。冇人會睇。',
      '乜都唔會送去任何地方。呢個工單淨係存在於呢個瀏覽器。冇任何網絡要求。冇收集任何資料。冇人會睇。',
      '乜都唔會送去任何地方。呢個工單淨係存在於呢個瀏覽器。冇任何網絡要求。冇收集任何資料。冇人會睇。'].join('|'));
  D('auth.title', 'Authenticator|Authenticator|Authenticator|Authenticator|Authenticator',
    '驗證器|驗證器|驗證器|驗證器|驗證器');
  D('auth.scan',
    'Scan this code with your authenticator app, or type the secret beside it.|Scan this code with your authenticator app, or type the secret beside it.|Scan this with your authenticator app, or type the secret beside it in by hand.|Scan this with your authenticator app, or type the secret beside it in by hand if the camera is not an option.|Scan this with your authenticator app, or type the secret beside it in by hand. The code is drawn right here in the page; nothing was sent anywhere to make it.',
    '用你嘅驗證器 App 掃描呢個碼，或者打旁邊嘅密鑰。|用你嘅驗證器 App 掃描呢個碼，或者打旁邊嘅密鑰。|用驗證器 App 掃呢個，或者自己打旁邊個密鑰。|用驗證器 App 掃呢個，冇相機就自己打旁邊個密鑰。|用驗證器 App 掃呢個，冇相機就自己打旁邊個密鑰。個碼係喺呢版度即場畫出嚟，冇送過去任何地方。');
  D('auth.clockSkew',
    'This computer\'s clock looks wrong, so codes here may be refused elsewhere.|This computer\'s clock looks wrong, so codes here may be refused elsewhere.|This computer\'s clock looks off, so codes from here may be refused elsewhere.|This computer\'s clock looks well off, so codes generated here will probably be refused elsewhere.|This computer\'s clock is well off, so codes generated here will almost certainly be refused everywhere else.',
    '呢部電腦嘅時鐘似乎唔啱，喺度出嘅碼可能喺第二度唔收。|呢部電腦嘅時鐘似乎唔啱，喺度出嘅碼可能喺第二度唔收。|呢部電腦個鐘有啲偏，喺度出嘅碼第二度可能唔收。|呢部電腦個鐘偏得幾犀利，喺度出嘅碼第二度好可能唔收。|呢部電腦個鐘偏到走晒樣，喺度出嘅碼第二度幾乎實唔收。');
  D('auth.exportOmits',
    'Ordinary exports leave every secret out. This file contains the entry names only.|Ordinary exports leave every secret out. This file contains the entry names only.|Ordinary exports leave every secret behind. This file has the entry names and nothing else.|Ordinary exports leave every secret behind. This file carries the entry names and nothing else at all.|Ordinary exports leave every secret behind, on purpose. This file carries the entry names and nothing else whatsoever.',
    '一般匯出唔會包含任何密鑰，呢個檔案淨係有項目名稱。|一般匯出唔會包含任何密鑰，呢個檔案淨係有項目名稱。|一般匯出唔會帶走任何密鑰，呢個檔案淨係得項目名。|一般匯出唔會帶走任何密鑰，呢個檔案淨係得項目名，其他一律無。|一般匯出特登唔會帶走任何密鑰，呢個檔案淨係得項目名，其他乜都無。');

  /* -- history and export */
  D('history.title', 'Local history|Local history|Local history|Local history|Local history',
    '本機歷史|本機歷史|本機歷史|本機歷史|本機歷史');
  D('history.appendOnly',
    'History is append-only. Restoring an earlier state is recorded as a new entry, so an undo can itself be undone.|History is append-only. Restoring an earlier state is recorded as a new entry, so an undo can itself be undone.|History only ever grows. Restoring an earlier state writes a new entry, so you can undo the undo.|History only ever grows. Restoring an earlier state writes a new entry, so you can undo the undo, and undo that too.|History only ever grows, never rewrites. Restoring an earlier state writes a brand new entry, so you can undo the undo, and then undo that, forever.',
    '歷史紀錄淨係會加，唔會改。還原舊狀態會記成新一筆，所以復原都可以再復原。|歷史紀錄淨係會加，唔會改。還原舊狀態會記成新一筆，所以復原都可以再復原。|歷史淨係會長大。還原舊狀態會寫多一筆，所以你可以復原個復原。|歷史淨係會長大。還原舊狀態會寫多一筆，所以你可以復原個復原，再復原多次。|歷史淨係會長大，唔會改寫。還原舊狀態會寫全新一筆，所以你可以復原個復原，再復原個復原，一路落去。');
  D('export.title', 'Export|Export|Export|Export|Export', '匯出|匯出|匯出|匯出|匯出');
  D('export.lossy',
    'This format cannot carry every field. The ones it will drop are listed above.|This format cannot carry every field. The ones it will drop are listed above.|This format cannot hold every field. The ones it drops are listed above.|This format cannot hold every field, and the ones it drops are listed above before you commit to it.|This format simply cannot hold every field. Everything it will quietly drop is listed above, before you commit to it.',
    '呢個格式載唔到所有欄位，會漏低嘅列咗喺上面。|呢個格式載唔到所有欄位，會漏低嘅列咗喺上面。|呢個格式裝唔落所有欄位，會漏嘅列咗喺上面。|呢個格式裝唔落所有欄位，會漏嘅喺你落實之前列晒喺上面。|呢個格式真係裝唔落所有欄位，佢會靜靜雞漏低嘅嘢，喺你落實之前全部列晒喺上面。');

  /* -- dim sum */
  D('dimsum.heading', 'A small dim sum|A small dim sum|A small dim sum|A small dim sum, on the house|A small dim sum, on the house, for no reason at all',
    '一件小點心|一件小點心|一件小點心|請你一件小點心|請你一件小點心，無端端咁樣');
  D('dimsum.noPhoto',
    'Photo unavailable offline.|Photo unavailable offline.|Photo unavailable offline.|Photo unavailable offline. The dish is still real.|Photo unavailable offline. The dish is still entirely real.',
    '離線時無法顯示相片。|離線時無法顯示相片。|離線時無法顯示相片。|離線時無法顯示相片，不過碟嘢係真嘅。|離線時無法顯示相片，不過碟嘢真係存在㗎。');
  D('dimsum.photoSetting',
    'Load dish photos from the public catalog|Load dish photos from the public catalog|Load dish photos from the public catalog|Load dish photos from the public catalog|Load dish photos from the public catalog',
    '由公開目錄載入點心相片|由公開目錄載入點心相片|由公開目錄載入點心相片|由公開目錄載入點心相片|由公開目錄載入點心相片');
  D('dimsum.photoNote',
    'This is the only network request this site can make. Switch it off and the site is entirely offline; the dish name is bundled and still appears.|This is the only network request this site can make. Switch it off and the site is entirely offline; the dish name is bundled and still appears.|This is the only network request this site can make. Switch it off and the site goes fully offline; the dish name is bundled and still shows up.|This is the only network request this site can make, and you can turn it off. The site then goes fully offline, and the dish name is bundled so it still shows up.|This is the only network request this whole site is capable of making, and you can turn it off. The site then goes completely offline, and the dish name is bundled anyway so it still turns up.',
    '呢個係本網站唯一會發出嘅網絡要求。閂咗佢，成個網站就完全離線；點心名係打包咗嘅，照樣會出。|呢個係本網站唯一會發出嘅網絡要求。閂咗佢，成個網站就完全離線；點心名係打包咗嘅，照樣會出。|呢個係本網站唯一會發出嘅網絡要求。閂咗佢就完全離線；點心名打包咗，照出。|呢個係本網站唯一會發出嘅網絡要求，你可以閂咗佢。閂咗之後完全離線，點心名打包咗，照出。|呢個係成個網站唯一發得出嘅網絡要求，而你可以閂咗佢。閂咗之後完全離線，點心名本身打包咗，照樣會出。');

  /* ---- language state ------------------------------------------- */
  var LANG_MODES = ['en', 'zh', 'both'];
  var lang = {
    mode: store.get('lang.mode', 'en'),
    funnyEn: clamp(parseInt(store.get('lang.funny.en', 3), 10) || 3, 1, 5),
    funnyZh: clamp(parseInt(store.get('lang.funny.zh', 3), 10) || 3, 1, 5),
    emoji: store.get('lang.emoji', false) === true
  };
  if (LANG_MODES.indexOf(lang.mode) < 0) lang.mode = 'en';

  /* Personal vocabulary. NOTHING ships here. The map stays empty until
     the visitor supplies a file that passes every bound below, and a
     rejected file never applies partially. */
  var VOCAB_LIMITS = deepFreeze({
    maxBytes: 65536, schemaVersion: 1, maxEntries: 500,
    maxKeyLength: 200, maxValueLength: 200, maxDepth: 4,
    modes: ['word', 'substring'], langs: ['en', 'zh', 'all']
  });
  var vocabState = { entries: [], loadedAt: null, error: null, count: 0 };

  function vocabValidate(text) {
    var bytes = utf8Bytes(text).length;
    if (bytes > VOCAB_LIMITS.maxBytes) {
      return { ok: false, error: 'The file is ' + bytes + ' bytes. The limit is ' + VOCAB_LIMITS.maxBytes + ' bytes.' };
    }
    var data;
    try { data = JSON.parse(text); }
    catch (e) { return { ok: false, error: 'That is not valid JSON: ' + e.message }; }
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return { ok: false, error: 'The top level must be a JSON object.' };
    }
    /* Duplicate keys are legal JSON and JSON.parse silently keeps the
       last one, so check the raw text rather than the parsed object. */
    var dupe = findDuplicateKey(text);
    if (dupe) return { ok: false, error: 'The key "' + dupe + '" appears more than once. Duplicate keys are refused rather than silently resolved.' };
    if (depthOf(data) > VOCAB_LIMITS.maxDepth) {
      return { ok: false, error: 'The file nests deeper than ' + VOCAB_LIMITS.maxDepth + ' levels.' };
    }
    var known = ['schemaVersion', 'entries'];
    var extra = Object.keys(data).filter(function (k) { return known.indexOf(k) < 0; });
    if (extra.length) return { ok: false, error: 'Unexpected field(s): ' + extra.join(', ') + '. Only schemaVersion and entries are accepted.' };
    if (data.schemaVersion !== VOCAB_LIMITS.schemaVersion) {
      return { ok: false, error: 'schemaVersion must be ' + VOCAB_LIMITS.schemaVersion + '. This file says ' + JSON.stringify(data.schemaVersion) + '.' };
    }
    if (!Array.isArray(data.entries)) return { ok: false, error: 'entries must be an array.' };
    if (data.entries.length > VOCAB_LIMITS.maxEntries) {
      return { ok: false, error: 'The file holds ' + data.entries.length + ' entries. The limit is ' + VOCAB_LIMITS.maxEntries + '.' };
    }
    var out = [], i, e, fields = ['match', 'replace', 'mode', 'lang'];
    for (i = 0; i < data.entries.length; i++) {
      e = data.entries[i];
      if (!e || typeof e !== 'object' || Array.isArray(e)) return { ok: false, error: 'Entry ' + (i + 1) + ' is not an object.' };
      var unknown = Object.keys(e).filter(function (k) { return fields.indexOf(k) < 0; });
      if (unknown.length) return { ok: false, error: 'Entry ' + (i + 1) + ' has unexpected field(s): ' + unknown.join(', ') + '.' };
      if (typeof e.match !== 'string' || typeof e.replace !== 'string') {
        return { ok: false, error: 'Entry ' + (i + 1) + ' needs string match and replace values.' };
      }
      if (!e.match.length || e.match.length > VOCAB_LIMITS.maxKeyLength) {
        return { ok: false, error: 'Entry ' + (i + 1) + ' has a match of ' + e.match.length + ' characters. The range is 1 to ' + VOCAB_LIMITS.maxKeyLength + '.' };
      }
      if (e.replace.length > VOCAB_LIMITS.maxValueLength) {
        return { ok: false, error: 'Entry ' + (i + 1) + ' has a replace of ' + e.replace.length + ' characters. The limit is ' + VOCAB_LIMITS.maxValueLength + '.' };
      }
      var mode = e.mode === undefined ? 'word' : e.mode;
      var lg = e.lang === undefined ? 'all' : e.lang;
      if (VOCAB_LIMITS.modes.indexOf(mode) < 0) return { ok: false, error: 'Entry ' + (i + 1) + ' has mode ' + JSON.stringify(mode) + '. Allowed: ' + VOCAB_LIMITS.modes.join(', ') + '.' };
      if (VOCAB_LIMITS.langs.indexOf(lg) < 0) return { ok: false, error: 'Entry ' + (i + 1) + ' has lang ' + JSON.stringify(lg) + '. Allowed: ' + VOCAB_LIMITS.langs.join(', ') + '.' };
      out.push({ match: e.match, replace: e.replace, mode: mode, lang: lg });
    }
    return { ok: true, entries: out };
  }
  function findDuplicateKey(text) {
    /* Walk the raw JSON tracking object scopes. A regular expression
       cannot see nesting, so this counts braces rather than matching
       them. */
    var stack = [], i = 0, ch, inStr = false, esc = false, buf = '', lastString = null, expectKey = false;
    stack.push(Object.create(null));
    for (i = 0; i < text.length; i++) {
      ch = text[i];
      if (inStr) {
        if (esc) { esc = false; buf += ch; continue; }
        if (ch === '\\') { esc = true; buf += ch; continue; }
        if (ch === '"') { inStr = false; lastString = buf; buf = ''; continue; }
        buf += ch; continue;
      }
      if (ch === '"') { inStr = true; buf = ''; continue; }
      if (ch === '{') { stack.push(Object.create(null)); expectKey = true; lastString = null; continue; }
      if (ch === '}') { stack.pop(); expectKey = false; lastString = null; continue; }
      if (ch === '[') { stack.push(Object.create(null)); expectKey = false; continue; }
      if (ch === ']') { stack.pop(); continue; }
      if (ch === ':') {
        if (lastString !== null) {
          var scope = stack[stack.length - 1];
          if (scope[lastString]) return lastString;
          scope[lastString] = true;
        }
        lastString = null; continue;
      }
      if (ch === ',') { lastString = null; continue; }
    }
    return null;
  }
  function depthOf(v, d) {
    d = d || 1;
    if (!v || typeof v !== 'object') return d;
    var max = d, k;
    if (Array.isArray(v)) { for (k = 0; k < v.length; k++) max = Math.max(max, depthOf(v[k], d + 1)); return max; }
    for (k in v) if (Object.prototype.hasOwnProperty.call(v, k)) max = Math.max(max, depthOf(v[k], d + 1));
    return max;
  }
  function vocabLoadFromCache() {
    var cached = store.get('vocab.cache', null);
    if (!cached || typeof cached !== 'object') return;
    /* Revalidate before every load. A cache that no longer passes the
       current bounds fails closed to the original wording rather than
       being trusted because it was trusted once. */
    var res = vocabValidate(JSON.stringify(cached));
    if (res.ok) { vocabState.entries = res.entries; vocabState.count = res.entries.length; vocabState.loadedAt = store.get('vocab.at', null); }
    else { store.remove('vocab.cache'); store.remove('vocab.at'); vocabState.error = res.error; }
  }
  function vocabApply(text, langCode) {
    if (!vocabState.entries.length || schoolActive()) return text;
    var out = String(text), i, e;
    for (i = 0; i < vocabState.entries.length; i++) {
      e = vocabState.entries[i];
      if (e.lang !== 'all' && e.lang !== langCode) continue;
      if (e.mode === 'word') {
        out = out.replace(wordRegex(e.match), function (whole, before) { return before + e.replace; });
      } else {
        out = out.split(e.match).join(e.replace);
      }
    }
    return out;
  }
  function escapeRegex(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  var wordRegexCache = Object.create(null);
  function wordRegex(match) {
    if (!wordRegexCache[match]) {
      /* Unicode property escapes so a Cantonese term is bounded the
         same way an English one is. A \b here would match inside CJK
         text, which is exactly the case this site has most of. */
      var body = '(^|[^\\p{L}\\p{N}_])' + escapeRegex(match) + '(?![\\p{L}\\p{N}_])';
      try { wordRegexCache[match] = new RegExp(body, 'gu'); }
      catch (e) { wordRegexCache[match] = new RegExp('(^|[^A-Za-z0-9_])' + escapeRegex(match) + '(?![A-Za-z0-9_])', 'g'); }
    }
    wordRegexCache[match].lastIndex = 0;
    return wordRegexCache[match];
  }

  /* ---- School mode ---------------------------------------------- */
  var schoolState = {
    on: store.get('school.on', false) === true,
    name: store.get('school.name', null),
    cred: store.get('school.cred', null)
  };
  function schoolActive() { return schoolState.on === true; }
  function schoolName() {
    var n = schoolState.name;
    if (typeof n === 'string' && n.trim()) return n.trim();
    return DICT['school.default'].en[0];
  }

  /* ---- the resolver --------------------------------------------- */
  function levelFor(code) { return code === 'zh' ? lang.funnyZh : lang.funnyEn; }
  function raw(key, code) {
    var entry = DICT[key];
    if (!entry) return null;
    var arr = entry[code] || entry.en;
    return arr[clamp(levelFor(code), 1, 5) - 1];
  }
  function effectiveMode() { return schoolActive() ? 'en' : lang.mode; }

  /* t() returns the PRIMARY string. In bilingual mode the primary is
     English and stays prominent; t2() returns the compact secondary.
     A caller that ignores t2 loses nothing but the second language. */
  function t(key, fallback) {
    var mode = effectiveMode();
    var code = mode === 'zh' ? 'zh' : 'en';
    var s = raw(key, code);
    if (s === null) s = (fallback === undefined ? key : fallback);
    return vocabApply(s, code);
  }
  function t2(key) {
    if (effectiveMode() !== 'both') return '';
    var s = raw(key, 'zh');
    return s === null ? '' : vocabApply(s, 'zh');
  }
  /* One string for places that cannot hold two nodes -- a title
     attribute, a document title, an accessible name. */
  function tBoth(key, fallback) {
    var a = t(key, fallback), b = t2(key);
    return b ? a + ' · ' + b : a;
  }
  /* Render a label into an element as primary + compact secondary. */
  function label(node, key, fallback) {
    clear(node);
    node.appendChild(document.createTextNode(t(key, fallback)));
    var sec = t2(key);
    if (sec) node.appendChild(el('span', { class: 'sec', text: sec }));
    node.setAttribute('data-i18n', key);
    return node;
  }
  /* Emoji decoration, dialogs and message boxes only. Returns '' when
     the switch is off, in School mode, or when asked for anywhere that
     is not a dialog or message box -- there is deliberately no way to
     ask for one in a button. */
  function emojiFor(kind) {
    if (!lang.emoji || schoolActive()) return '';
    var map = { info: 'ℹ️', success: '✅', warn: '⚠️', error: '❌', question: '❓', lock: '🔒', dimsum: '🥟' };
    return map[kind] || '';
  }

  function applyI18n(root) {
    var scope = root || document;
    Array.prototype.forEach.call(scope.querySelectorAll('[data-i18n]'), function (n) {
      var key = n.getAttribute('data-i18n');
      if (!DICT[key]) return;
      label(n, key);
    });
    Array.prototype.forEach.call(scope.querySelectorAll('[data-i18n-attr]'), function (n) {
      var spec = n.getAttribute('data-i18n-attr').split(':');
      if (spec.length !== 2 || !DICT[spec[1]]) return;
      n.setAttribute(spec[0], tBoth(spec[1]));
    });
    document.documentElement.lang = effectiveMode() === 'zh' ? 'zh-Hant-HK' : 'en';
  }

  var i18n = {
    modes: LANG_MODES.slice(),
    limits: VOCAB_LIMITS,
    define: function (entries) {
      /* Page authors add their own copy here. Five levels per language
         is required, exactly as the runtime's own entries are. */
      Object.keys(entries).forEach(function (k) {
        var v = entries[k];
        D(k, Array.isArray(v.en) ? v.en.join('|') : v.en, Array.isArray(v.zh) ? v.zh.join('|') : v.zh);
      });
    },
    has: function (key) { return !!DICT[key]; },
    t: t, t2: t2, tBoth: tBoth, label: label, emoji: emojiFor, apply: applyI18n,
    mode: function () { return effectiveMode(); },
    storedMode: function () { return lang.mode; },
    setMode: function (m) {
      if (LANG_MODES.indexOf(m) < 0) return false;
      if (schoolActive()) return false;
      lang.mode = m; store.set('lang.mode', m);
      applyI18n(); emit('i18n', { mode: m }); return true;
    },
    funny: function (code) { return code === 'zh' ? lang.funnyZh : lang.funnyEn; },
    setFunny: function (code, n) {
      if (schoolActive()) return false;
      n = clamp(parseInt(n, 10) || 3, 1, 5);
      if (code === 'zh') { lang.funnyZh = n; store.set('lang.funny.zh', n); }
      else { lang.funnyEn = n; store.set('lang.funny.en', n); }
      applyI18n(); emit('i18n', { funny: code }); return true;
    },
    emojiEnabled: function () { return lang.emoji && !schoolActive(); },
    setEmoji: function (v) { lang.emoji = !!v; store.set('lang.emoji', lang.emoji); emit('i18n', { emoji: lang.emoji }); },
    vocabulary: {
      status: function () {
        return {
          loaded: vocabState.entries.length > 0,
          count: vocabState.count,
          loadedAt: vocabState.loadedAt,
          error: vocabState.error,
          limits: VOCAB_LIMITS
        };
      },
      /* Reads a File the visitor chose. Local only: no network, no
         upload, and the file's name and path are never stored. */
      loadFile: function (file) {
        return new Promise(function (resolve) {
          if (!file) { resolve({ ok: false, error: 'No file was chosen.' }); return; }
          if (file.size > VOCAB_LIMITS.maxBytes) {
            resolve({ ok: false, error: 'The file is ' + file.size + ' bytes. The limit is ' + VOCAB_LIMITS.maxBytes + ' bytes.' });
            return;
          }
          var reader = new FileReader();
          reader.onerror = function () { resolve({ ok: false, error: 'The file could not be read.' }); };
          reader.onload = function () {
            var res = vocabValidate(String(reader.result || ''));
            if (!res.ok) { vocabState.error = res.error; emit('vocab', vocabState); resolve(res); return; }
            vocabState.entries = res.entries;
            vocabState.count = res.entries.length;
            vocabState.loadedAt = nowIso();
            vocabState.error = null;
            store.set('vocab.cache', { schemaVersion: VOCAB_LIMITS.schemaVersion, entries: res.entries });
            store.set('vocab.at', vocabState.loadedAt);
            applyI18n(); emit('vocab', vocabState);
            resolve({ ok: true, count: res.entries.length });
          };
          reader.readAsText(file);
        });
      },
      clear: function () {
        vocabState.entries = []; vocabState.count = 0; vocabState.loadedAt = null; vocabState.error = null;
        store.remove('vocab.cache'); store.remove('vocab.at');
        applyI18n(); emit('vocab', vocabState);
      }
    }
  };
  vocabLoadFromCache();

  /* ================================================================
   * 6. Colour: parsing, conversion, tonal palettes
   *
   * Internal representation is sRGB in 0..1 plus alpha, because that
   * is what a screen actually shows. Every other space converts in and
   * out of it. A colour specified in LAB, LCH, OKLab or OKLCH can land
   * outside the sRGB gamut; when it does, the value is clipped and the
   * clip is REPORTED rather than hidden, because silently showing a
   * different colour than the one entered is the worst possible answer.
   * ================================================================ */
  var NAMED = ('aliceblue f0f8ff|antiquewhite faebd7|aqua 00ffff|aquamarine 7fffd4|azure f0ffff|beige f5f5dc|' +
    'bisque ffe4c4|black 000000|blanchedalmond ffebcd|blue 0000ff|blueviolet 8a2be2|brown a52a2a|' +
    'burlywood deb887|cadetblue 5f9ea0|chartreuse 7fff00|chocolate d2691e|coral ff7f50|' +
    'cornflowerblue 6495ed|cornsilk fff8dc|crimson dc143c|cyan 00ffff|darkblue 00008b|darkcyan 008b8b|' +
    'darkgoldenrod b8860b|darkgray a9a9a9|darkgreen 006400|darkgrey a9a9a9|darkkhaki bdb76b|' +
    'darkmagenta 8b008b|darkolivegreen 556b2f|darkorange ff8c00|darkorchid 9932cc|darkred 8b0000|' +
    'darksalmon e9967a|darkseagreen 8fbc8f|darkslateblue 483d8b|darkslategray 2f4f4f|darkslategrey 2f4f4f|' +
    'darkturquoise 00ced1|darkviolet 9400d3|deeppink ff1493|deepskyblue 00bfff|dimgray 696969|' +
    'dimgrey 696969|dodgerblue 1e90ff|firebrick b22222|floralwhite fffaf0|forestgreen 228b22|' +
    'fuchsia ff00ff|gainsboro dcdcdc|ghostwhite f8f8ff|gold ffd700|goldenrod daa520|gray 808080|' +
    'green 008000|greenyellow adff2f|grey 808080|honeydew f0fff0|hotpink ff69b4|indianred cd5c5c|' +
    'indigo 4b0082|ivory fffff0|khaki f0e68c|lavender e6e6fa|lavenderblush fff0f5|lawngreen 7cfc00|' +
    'lemonchiffon fffacd|lightblue add8e6|lightcoral f08080|lightcyan e0ffff|lightgoldenrodyellow fafad2|' +
    'lightgray d3d3d3|lightgreen 90ee90|lightgrey d3d3d3|lightpink ffb6c1|lightsalmon ffa07a|' +
    'lightseagreen 20b2aa|lightskyblue 87cefa|lightslategray 778899|lightslategrey 778899|' +
    'lightsteelblue b0c4de|lightyellow ffffe0|lime 00ff00|limegreen 32cd32|linen faf0e6|magenta ff00ff|' +
    'maroon 800000|mediumaquamarine 66cdaa|mediumblue 0000cd|mediumorchid ba55d3|mediumpurple 9370db|' +
    'mediumseagreen 3cb371|mediumslateblue 7b68ee|mediumspringgreen 00fa9a|mediumturquoise 48d1cc|' +
    'mediumvioletred c71585|midnightblue 191970|mintcream f5fffa|mistyrose ffe4e1|moccasin ffe4b5|' +
    'navajowhite ffdead|navy 000080|oldlace fdf5e6|olive 808000|olivedrab 6b8e23|orange ffa500|' +
    'orangered ff4500|orchid da70d6|palegoldenrod eee8aa|palegreen 98fb98|paleturquoise afeeee|' +
    'palevioletred db7093|papayawhip ffefd5|peachpuff ffdab9|peru cd853f|pink ffc0cb|plum dda0dd|' +
    'powderblue b0e0e6|purple 800080|rebeccapurple 663399|red ff0000|rosybrown bc8f8f|royalblue 4169e1|' +
    'saddlebrown 8b4513|salmon fa8072|sandybrown f4a460|seagreen 2e8b57|seashell fff5ee|sienna a0522d|' +
    'silver c0c0c0|skyblue 87ceeb|slateblue 6a5acd|slategray 708090|slategrey 708090|snow fffafa|' +
    'springgreen 00ff7f|steelblue 4682b4|tan d2b48c|teal 008080|thistle d8bfd8|tomato ff6347|' +
    'turquoise 40e0d0|violet ee82ee|wheat f5deb3|white ffffff|whitesmoke f5f5f5|yellow ffff00|' +
    'yellowgreen 9acd32').split('|').reduce(function (acc, pair) {
      var p = pair.trim().split(' ');
      acc[p[0]] = p[1];
      return acc;
    }, Object.create(null));
  var NAMED_REVERSE = (function () {
    var r = Object.create(null), k;
    for (k in NAMED) if (!r[NAMED[k]]) r[NAMED[k]] = k;
    return r;
  })();

  function srgbToLinear(c) { return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function linearToSrgb(c) { return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; }
  var D65 = [0.3127 / 0.3290, 1, (1 - 0.3127 - 0.3290) / 0.3290];

  function rgbToXyz(r, g, b) {
    var R = srgbToLinear(r), G = srgbToLinear(g), B = srgbToLinear(b);
    return [
      0.4123907993 * R + 0.3575843394 * G + 0.1804807884 * B,
      0.2126390059 * R + 0.7151686788 * G + 0.0721923154 * B,
      0.0193308187 * R + 0.1191947798 * G + 0.9505321522 * B
    ];
  }
  function xyzToRgbRaw(x, y, z) {
    var R = 3.2409699419 * x - 1.5373831776 * y - 0.4986107603 * z;
    var G = -0.9692436363 * x + 1.8759675015 * y + 0.0415550574 * z;
    var B = 0.0556300797 * x - 0.2039769589 * y + 1.0569715142 * z;
    return [linearToSrgb(R), linearToSrgb(G), linearToSrgb(B)];
  }
  function f1(t) { return t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116; }
  function f1inv(t) { var t3 = t * t * t; return t3 > 216 / 24389 ? t3 : (116 * t - 16) * 27 / 24389; }
  function xyzToLab(x, y, z) {
    var fx = f1(x / D65[0]), fy = f1(y / D65[1]), fz = f1(z / D65[2]);
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
  }
  function labToXyz(L, a, bb) {
    var fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - bb / 200;
    return [f1inv(fx) * D65[0], f1inv(fy) * D65[1], f1inv(fz) * D65[2]];
  }
  function rgbToLab(r, g, b) { var x = rgbToXyz(r, g, b); return xyzToLab(x[0], x[1], x[2]); }
  function labToRgbRaw(L, a, b) { var x = labToXyz(L, a, b); return xyzToRgbRaw(x[0], x[1], x[2]); }
  function labToLch(L, a, b) {
    var c = Math.sqrt(a * a + b * b), h = Math.atan2(b, a) * 180 / Math.PI;
    if (h < 0) h += 360;
    return [L, c, h];
  }
  function lchToLab(L, c, h) { var r = h * Math.PI / 180; return [L, c * Math.cos(r), c * Math.sin(r)]; }

  function rgbToOklab(r, g, b) {
    var R = srgbToLinear(r), G = srgbToLinear(g), B = srgbToLinear(b);
    var l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
    var m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
    var s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
    return [
      0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
      1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
    ];
  }
  function oklabToRgbRaw(L, a, b) {
    var l = L + 0.3963377774 * a + 0.2158037573 * b;
    var m = L - 0.1055613458 * a - 0.0638541728 * b;
    var s = L - 0.0894841775 * a - 1.2914855480 * b;
    l = l * l * l; m = m * m * m; s = s * s * s;
    return [
      linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
      linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
      linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s)
    ];
  }
  function rgbToHsl(r, g, b) {
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, h = 0, s = 0, l = (mx + mn) / 2;
    if (d) {
      s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0));
      else if (mx === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    return [h, s, l];
  }
  function hslToRgb(h, s, l) {
    h = ((h % 360) + 360) % 360;
    var c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
    var v = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return [v[0] + m, v[1] + m, v[2] + m];
  }
  function rgbToHsv(r, g, b) {
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, h = 0;
    if (d) {
      if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0));
      else if (mx === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    return [h, mx === 0 ? 0 : d / mx, mx];
  }
  function hsvToRgb(h, s, v) {
    h = ((h % 360) + 360) % 360;
    var c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c;
    var t3 = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return [t3[0] + m, t3[1] + m, t3[2] + m];
  }
  function rgbToHwb(r, g, b) {
    var hsv = rgbToHsv(r, g, b);
    return [hsv[0], Math.min(r, g, b), 1 - Math.max(r, g, b)];
  }
  function hwbToRgb(h, w, bl) {
    if (w + bl >= 1) { var gy = w / (w + bl); return [gy, gy, gy]; }
    var rgb = hsvToRgb(h, 1, 1);
    return [rgb[0] * (1 - w - bl) + w, rgb[1] * (1 - w - bl) + w, rgb[2] * (1 - w - bl) + w];
  }
  /* CMYK here is the naive device conversion with no ICC profile and
     no black generation curve. Any print workflow needs a real
     profile; the translator says so rather than implying accuracy. */
  function rgbToCmyk(r, g, b) {
    var k = 1 - Math.max(r, g, b);
    if (k >= 1) return [0, 0, 0, 1];
    return [(1 - r - k) / (1 - k), (1 - g - k) / (1 - k), (1 - b - k) / (1 - k), k];
  }
  function cmykToRgb(c, m, y, k) { return [(1 - c) * (1 - k), (1 - m) * (1 - k), (1 - y) * (1 - k)]; }

  function inGamut(rgb) {
    var eps = 1e-6;
    return rgb[0] >= -eps && rgb[0] <= 1 + eps && rgb[1] >= -eps && rgb[1] <= 1 + eps && rgb[2] >= -eps && rgb[2] <= 1 + eps;
  }
  function clipRgb(rgb) { return [clamp(rgb[0], 0, 1), clamp(rgb[1], 0, 1), clamp(rgb[2], 0, 1)]; }
  function hex2(n) { var s = Math.round(clamp(n, 0, 1) * 255).toString(16); return s.length < 2 ? '0' + s : s; }
  function toHexString(rgb, a) {
    var s = '#' + hex2(rgb[0]) + hex2(rgb[1]) + hex2(rgb[2]);
    if (a !== undefined && a < 1) s += hex2(a);
    return s.toUpperCase();
  }
  function num(s) { return parseFloat(s); }
  function pct(s, scale) {
    s = String(s).trim();
    if (s.slice(-1) === '%') return parseFloat(s) / 100 * (scale === undefined ? 1 : scale);
    return parseFloat(s);
  }

  /* Parses every format the translator can emit, plus CSS named
     colours. Returns { rgb:[0..1 x3], a, space, clipped } or null. */
  function parseColor(input) {
    if (input === null || input === undefined) return null;
    var s = String(input).trim().toLowerCase();
    if (!s) return null;
    if (NAMED[s]) s = '#' + NAMED[s];
    if (s === 'transparent') return { rgb: [0, 0, 0], a: 0, space: 'named', clipped: false };
    var m;
    if (s[0] === '#') {
      var h = s.slice(1);
      if (h.length === 3 || h.length === 4) h = h.split('').map(function (c) { return c + c; }).join('');
      if (h.length !== 6 && h.length !== 8) return null;
      if (!/^[0-9a-f]+$/.test(h)) return null;
      return {
        rgb: [parseInt(h.substr(0, 2), 16) / 255, parseInt(h.substr(2, 2), 16) / 255, parseInt(h.substr(4, 2), 16) / 255],
        a: h.length === 8 ? parseInt(h.substr(6, 2), 16) / 255 : 1,
        space: h.length === 8 ? 'hex8' : 'hex', clipped: false
      };
    }
    m = s.match(/^(rgba?|hsla?|hsva?|hwb|lab|lch|oklab|oklch|cmyk|device-cmyk)\s*\(([^)]*)\)$/);
    if (!m) return null;
    var fn = m[1], parts = m[2].replace(/\//g, ' / ').split(/[\s,]+/).filter(function (p) { return p.length; });
    var alpha = 1, slash = parts.indexOf('/');
    if (slash >= 0) { alpha = pct(parts[slash + 1], 1); parts = parts.slice(0, slash); }
    if ((fn === 'rgba' || fn === 'hsla' || fn === 'hsva') && parts.length === 4) { alpha = pct(parts[3], 1); parts = parts.slice(0, 3); }
    if (fn === 'cmyk' || fn === 'device-cmyk') { if (parts.length === 5) { alpha = pct(parts[4], 1); parts = parts.slice(0, 4); } }
    if (isNaN(alpha)) alpha = 1;
    alpha = clamp(alpha, 0, 1);
    var rgbRaw, space = fn;
    try {
      if (fn === 'rgb' || fn === 'rgba') {
        rgbRaw = [pct(parts[0], 255) / 255, pct(parts[1], 255) / 255, pct(parts[2], 255) / 255];
        space = 'rgb';
      } else if (fn === 'hsl' || fn === 'hsla') {
        rgbRaw = hslToRgb(num(parts[0]), pct(parts[1], 1), pct(parts[2], 1)); space = 'hsl';
      } else if (fn === 'hsv' || fn === 'hsva') {
        rgbRaw = hsvToRgb(num(parts[0]), pct(parts[1], 1), pct(parts[2], 1)); space = 'hsv';
      } else if (fn === 'hwb') {
        rgbRaw = hwbToRgb(num(parts[0]), pct(parts[1], 1), pct(parts[2], 1)); space = 'hwb';
      } else if (fn === 'lab') {
        rgbRaw = labToRgbRaw(pct(parts[0], 100), num(parts[1]), num(parts[2])); space = 'lab';
      } else if (fn === 'lch') {
        var lab = lchToLab(pct(parts[0], 100), num(parts[1]), num(parts[2]));
        rgbRaw = labToRgbRaw(lab[0], lab[1], lab[2]); space = 'lch';
      } else if (fn === 'oklab') {
        rgbRaw = oklabToRgbRaw(pct(parts[0], 1), num(parts[1]), num(parts[2])); space = 'oklab';
      } else if (fn === 'oklch') {
        var ol = lchToLab(pct(parts[0], 1), num(parts[1]), num(parts[2]));
        rgbRaw = oklabToRgbRaw(ol[0], ol[1], ol[2]); space = 'oklch';
      } else {
        rgbRaw = cmykToRgb(pct(parts[0], 1), pct(parts[1], 1), pct(parts[2], 1), pct(parts[3], 1)); space = 'cmyk';
      }
    } catch (e) { return null; }
    if (!rgbRaw || rgbRaw.some(isNaN)) return null;
    var clipped = !inGamut(rgbRaw);
    return { rgb: clipRgb(rgbRaw), a: alpha, space: space, clipped: clipped };
  }

  function relLuminance(rgb) {
    return 0.2126 * srgbToLinear(rgb[0]) + 0.7152 * srgbToLinear(rgb[1]) + 0.0722 * srgbToLinear(rgb[2]);
  }
  function contrastRatio(a, b) {
    var la = relLuminance(a), lb = relLuminance(b);
    var hi = Math.max(la, lb), lo = Math.min(la, lb);
    return (hi + 0.05) / (lo + 0.05);
  }

  var round = function (n, p) { var f = Math.pow(10, p === undefined ? 2 : p); return Math.round(n * f) / f; };

  /* The translator. Every format the appearance editor offers, from
     one parsed colour, so two representations can never disagree. */
  function translateColor(input) {
    var c = parseColor(input);
    if (!c) return null;
    var rgb = c.rgb, a = c.a;
    var lab = rgbToLab(rgb[0], rgb[1], rgb[2]);
    var lch = labToLch(lab[0], lab[1], lab[2]);
    var okl = rgbToOklab(rgb[0], rgb[1], rgb[2]);
    var oklch = labToLch(okl[0], okl[1], okl[2]);
    var hsl = rgbToHsl(rgb[0], rgb[1], rgb[2]);
    var hsv = rgbToHsv(rgb[0], rgb[1], rgb[2]);
    var hwb = rgbToHwb(rgb[0], rgb[1], rgb[2]);
    var cmyk = rgbToCmyk(rgb[0], rgb[1], rgb[2]);
    var hexNoHash = toHexString(rgb).slice(1).toLowerCase();
    var r255 = Math.round(rgb[0] * 255), g255 = Math.round(rgb[1] * 255), b255 = Math.round(rgb[2] * 255);
    return {
      input: String(input),
      space: c.space,
      alpha: a,
      clipped: c.clipped,
      rgbFloat: rgb,
      named: NAMED_REVERSE[hexNoHash] || null,
      hex: toHexString(rgb),
      hex8: toHexString(rgb, a),
      rgb: 'rgb(' + r255 + ' ' + g255 + ' ' + b255 + ')',
      rgba: 'rgb(' + r255 + ' ' + g255 + ' ' + b255 + ' / ' + round(a, 3) + ')',
      hsl: 'hsl(' + round(hsl[0], 1) + ' ' + round(hsl[1] * 100, 1) + '% ' + round(hsl[2] * 100, 1) + '%)',
      hsla: 'hsl(' + round(hsl[0], 1) + ' ' + round(hsl[1] * 100, 1) + '% ' + round(hsl[2] * 100, 1) + '% / ' + round(a, 3) + ')',
      hsv: 'hsv(' + round(hsv[0], 1) + ' ' + round(hsv[1] * 100, 1) + '% ' + round(hsv[2] * 100, 1) + '%)',
      hwb: 'hwb(' + round(hwb[0], 1) + ' ' + round(hwb[1] * 100, 1) + '% ' + round(hwb[2] * 100, 1) + '%)',
      lab: 'lab(' + round(lab[0], 2) + '% ' + round(lab[1], 2) + ' ' + round(lab[2], 2) + ')',
      lch: 'lch(' + round(lch[0], 2) + '% ' + round(lch[1], 2) + ' ' + round(lch[2], 2) + ')',
      oklab: 'oklab(' + round(okl[0], 4) + ' ' + round(okl[1], 4) + ' ' + round(okl[2], 4) + ')',
      oklch: 'oklch(' + round(oklch[0], 4) + ' ' + round(oklch[1], 4) + ' ' + round(oklch[2], 2) + ')',
      cmyk: 'cmyk(' + round(cmyk[0] * 100, 1) + '% ' + round(cmyk[1] * 100, 1) + '% ' + round(cmyk[2] * 100, 1) + '% ' + round(cmyk[3] * 100, 1) + '%)',
      cmykNote: 'Naive device conversion. No ICC profile, no black generation. Not a print-ready value.',
      contrastOnWhite: round(contrastRatio(rgb, [1, 1, 1]), 2),
      contrastOnBlack: round(contrastRatio(rgb, [0, 0, 0]), 2)
    };
  }

  /* ---- tonal palette --------------------------------------------
   * Tone IS CIELAB L*, which is what M3's HCT uses. For a requested
   * tone we hold hue, then binary-search the largest chroma sRGB can
   * actually hold at that lightness. Asking for a chroma the gamut
   * cannot carry and clipping afterwards produces a hue shift, which
   * is why the search runs before the conversion rather than after.
   * --------------------------------------------------------------- */
  function toneHex(hue, chroma, tone) {
    var lo = 0, hi = chroma, mid, lab, rgb, best = null, i;
    for (i = 0; i < 16; i++) {
      mid = (lo + hi) / 2;
      lab = lchToLab(tone, mid, hue);
      rgb = labToRgbRaw(lab[0], lab[1], lab[2]);
      if (inGamut(rgb)) { best = rgb; lo = mid; } else { hi = mid; }
    }
    if (!best) {
      lab = lchToLab(tone, 0, hue);
      best = labToRgbRaw(lab[0], lab[1], lab[2]);
    }
    return toHexString(clipRgb(best));
  }
  function palettesFromSeed(seedInput) {
    var c = parseColor(seedInput);
    if (!c) return null;
    var lab = rgbToLab(c.rgb[0], c.rgb[1], c.rgb[2]);
    var lch = labToLch(lab[0], lab[1], lab[2]);
    var hue = lch[2], chroma = Math.max(lch[1], 12);
    function pal(h, ch) {
      return function (tone) { return toneHex(h, ch, tone); };
    }
    return {
      seed: toHexString(c.rgb),
      hue: hue, chroma: chroma,
      primary: pal(hue, chroma),
      secondary: pal(hue, Math.min(chroma / 3, 16)),
      tertiary: pal((hue + 60) % 360, Math.min(chroma / 2, 24)),
      error: pal(25, 48),
      neutral: pal(hue, Math.min(chroma * 0.06, 4)),
      neutralVariant: pal(hue, Math.min(chroma * 0.12, 8))
    };
  }
  /* The role map. Identical structure light and dark so the two can be
     read side by side and a missing role is visible rather than
     silently absent. */
  /* Takes either a palette set from palettesFromSeed or the seed
     colour itself. Every sibling in this module takes a colour, so a
     caller that hands this one a colour is making the obvious mistake
     rather than a careless one -- and it used to fail with "P is not a
     function", which names nothing useful. */
  function rolesFromPalettes(p, dark) {
    if (typeof p === 'string') p = palettesFromSeed(p);
    if (!p || typeof p.primary !== 'function') return null;
    var P = p.primary, S = p.secondary, T = p.tertiary, E = p.error, N = p.neutral, NV = p.neutralVariant;
    if (!dark) {
      return {
        'primary': P(40), 'on-primary': P(100), 'primary-container': P(90), 'on-primary-container': P(10),
        'secondary': S(40), 'on-secondary': S(100), 'secondary-container': S(90), 'on-secondary-container': S(10),
        'tertiary': T(40), 'on-tertiary': T(100), 'tertiary-container': T(90), 'on-tertiary-container': T(10),
        'error': E(40), 'on-error': E(100), 'error-container': E(90), 'on-error-container': E(10),
        'surface': N(98), 'on-surface': N(10), 'surface-variant': NV(90), 'on-surface-variant': NV(30),
        'surface-dim': N(87), 'surface-bright': N(98),
        'surface-container-lowest': N(100), 'surface-container-low': N(96), 'surface-container': N(94),
        'surface-container-high': N(92), 'surface-container-highest': N(90),
        'outline': NV(50), 'outline-variant': NV(80),
        'inverse-surface': N(20), 'inverse-on-surface': N(95), 'inverse-primary': P(80),
        'scrim': '#000000', 'shadow': '#000000', 'surface-tint': P(40)
      };
    }
    return {
      'primary': P(80), 'on-primary': P(20), 'primary-container': P(30), 'on-primary-container': P(90),
      'secondary': S(80), 'on-secondary': S(20), 'secondary-container': S(30), 'on-secondary-container': S(90),
      'tertiary': T(80), 'on-tertiary': T(20), 'tertiary-container': T(30), 'on-tertiary-container': T(90),
      'error': E(80), 'on-error': E(20), 'error-container': E(30), 'on-error-container': E(90),
      'surface': N(6), 'on-surface': N(90), 'surface-variant': NV(30), 'on-surface-variant': NV(80),
      'surface-dim': N(6), 'surface-bright': N(24),
      'surface-container-lowest': N(4), 'surface-container-low': N(10), 'surface-container': N(12),
      'surface-container-high': N(17), 'surface-container-highest': N(22),
      'outline': NV(60), 'outline-variant': NV(30),
      'inverse-surface': N(90), 'inverse-on-surface': N(20), 'inverse-primary': P(40),
      'scrim': '#000000', 'shadow': '#000000', 'surface-tint': P(80)
    };
  }

  /* ================================================================
   * 7. Hashing: SHA-1, SHA-256, SHA-512, HMAC, PBKDF2, base32
   *
   * Implemented here rather than through WebCrypto on purpose.
   * crypto.subtle is unavailable outside a secure context, so a copy
   * of this site opened from a local file would lose its authenticator
   * and its unlock checks entirely. These run everywhere.
   * ================================================================ */
  function rotl32(x, n) { return ((x << n) | (x >>> (32 - n))) >>> 0; }
  function rotr32(x, n) { return ((x >>> n) | (x << (32 - n))) >>> 0; }

  function sha1(bytes) {
    var ml = bytes.length * 8;
    var withPad = new Uint8Array((((bytes.length + 8) >> 6) + 1) * 64);
    withPad.set(bytes); withPad[bytes.length] = 0x80;
    var dv = new DataView(withPad.buffer);
    dv.setUint32(withPad.length - 4, ml >>> 0, false);
    dv.setUint32(withPad.length - 8, Math.floor(ml / 4294967296), false);
    var h = [0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476, 0xC3D2E1F0];
    var w = new Array(80), i, j, a, b, c, d, e, f, k, tmp;
    for (i = 0; i < withPad.length; i += 64) {
      for (j = 0; j < 16; j++) w[j] = dv.getUint32(i + j * 4, false);
      for (j = 16; j < 80; j++) w[j] = rotl32(w[j - 3] ^ w[j - 8] ^ w[j - 14] ^ w[j - 16], 1);
      a = h[0]; b = h[1]; c = h[2]; d = h[3]; e = h[4];
      for (j = 0; j < 80; j++) {
        if (j < 20) { f = (b & c) | (~b & d); k = 0x5A827999; }
        else if (j < 40) { f = b ^ c ^ d; k = 0x6ED9EBA1; }
        else if (j < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8F1BBCDC; }
        else { f = b ^ c ^ d; k = 0xCA62C1D6; }
        tmp = (rotl32(a, 5) + f + e + k + w[j]) >>> 0;
        e = d; d = c; c = rotl32(b, 30); b = a; a = tmp;
      }
      h[0] = (h[0] + a) >>> 0; h[1] = (h[1] + b) >>> 0; h[2] = (h[2] + c) >>> 0;
      h[3] = (h[3] + d) >>> 0; h[4] = (h[4] + e) >>> 0;
    }
    var out = new Uint8Array(20), ov = new DataView(out.buffer);
    for (i = 0; i < 5; i++) ov.setUint32(i * 4, h[i], false);
    return out;
  }

  var K256 = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
  function sha256(bytes) {
    var ml = bytes.length * 8;
    var withPad = new Uint8Array((((bytes.length + 8) >> 6) + 1) * 64);
    withPad.set(bytes); withPad[bytes.length] = 0x80;
    var dv = new DataView(withPad.buffer);
    dv.setUint32(withPad.length - 4, ml >>> 0, false);
    dv.setUint32(withPad.length - 8, Math.floor(ml / 4294967296), false);
    var h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    var w = new Array(64), i, j, a, b, c, d, e, f, g, hh, s0, s1, ch, maj, t1, t2;
    for (i = 0; i < withPad.length; i += 64) {
      for (j = 0; j < 16; j++) w[j] = dv.getUint32(i + j * 4, false);
      for (j = 16; j < 64; j++) {
        s0 = rotr32(w[j - 15], 7) ^ rotr32(w[j - 15], 18) ^ (w[j - 15] >>> 3);
        s1 = rotr32(w[j - 2], 17) ^ rotr32(w[j - 2], 19) ^ (w[j - 2] >>> 10);
        w[j] = (w[j - 16] + s0 + w[j - 7] + s1) >>> 0;
      }
      a = h[0]; b = h[1]; c = h[2]; d = h[3]; e = h[4]; f = h[5]; g = h[6]; hh = h[7];
      for (j = 0; j < 64; j++) {
        s1 = rotr32(e, 6) ^ rotr32(e, 11) ^ rotr32(e, 25);
        ch = (e & f) ^ (~e & g);
        t1 = (hh + s1 + ch + K256[j] + w[j]) >>> 0;
        s0 = rotr32(a, 2) ^ rotr32(a, 13) ^ rotr32(a, 22);
        maj = (a & b) ^ (a & c) ^ (b & c);
        t2 = (s0 + maj) >>> 0;
        hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      h[0] = (h[0] + a) >>> 0; h[1] = (h[1] + b) >>> 0; h[2] = (h[2] + c) >>> 0; h[3] = (h[3] + d) >>> 0;
      h[4] = (h[4] + e) >>> 0; h[5] = (h[5] + f) >>> 0; h[6] = (h[6] + g) >>> 0; h[7] = (h[7] + hh) >>> 0;
    }
    var out = new Uint8Array(32), ov = new DataView(out.buffer);
    for (i = 0; i < 8; i++) ov.setUint32(i * 4, h[i], false);
    return out;
  }

  /* SHA-512 needs 64-bit arithmetic. BigInt is exact and the inputs
     here are a few dozen bytes, so the cost is irrelevant and the
     hi/lo word juggling that usually causes the bugs is avoided. */
  var K512 = ['428a2f98d728ae22', '7137449123ef65cd', 'b5c0fbcfec4d3b2f', 'e9b5dba58189dbbc',
    '3956c25bf348b538', '59f111f1b605d019', '923f82a4af194f9b', 'ab1c5ed5da6d8118',
    'd807aa98a3030242', '12835b0145706fbe', '243185be4ee4b28c', '550c7dc3d5ffb4e2',
    '72be5d74f27b896f', '80deb1fe3b1696b1', '9bdc06a725c71235', 'c19bf174cf692694',
    'e49b69c19ef14ad2', 'efbe4786384f25e3', '0fc19dc68b8cd5b5', '240ca1cc77ac9c65',
    '2de92c6f592b0275', '4a7484aa6ea6e483', '5cb0a9dcbd41fbd4', '76f988da831153b5',
    '983e5152ee66dfab', 'a831c66d2db43210', 'b00327c898fb213f', 'bf597fc7beef0ee4',
    'c6e00bf33da88fc2', 'd5a79147930aa725', '06ca6351e003826f', '142929670a0e6e70',
    '27b70a8546d22ffc', '2e1b21385c26c926', '4d2c6dfc5ac42aed', '53380d139d95b3df',
    '650a73548baf63de', '766a0abb3c77b2a8', '81c2c92e47edaee6', '92722c851482353b',
    'a2bfe8a14cf10364', 'a81a664bbc423001', 'c24b8b70d0f89791', 'c76c51a30654be30',
    'd192e819d6ef5218', 'd69906245565a910', 'f40e35855771202a', '106aa07032bbd1b8',
    '19a4c116b8d2d0c8', '1e376c085141ab53', '2748774cdf8eeb99', '34b0bcb5e19b48a8',
    '391c0cb3c5c95a63', '4ed8aa4ae3418acb', '5b9cca4f7763e373', '682e6ff3d6b2b8a3',
    '748f82ee5defb2fc', '78a5636f43172f60', '84c87814a1f0ab72', '8cc702081a6439ec',
    '90befffa23631e28', 'a4506cebde82bde9', 'bef9a3f7b2c67915', 'c67178f2e372532b',
    'ca273eceea26619c', 'd186b8c721c0c207', 'eada7dd6cde0eb1e', 'f57d4f7fee6ed178',
    '06f067aa72176fba', '0a637dc5a2c898a6', '113f9804bef90dae', '1b710b35131c471b',
    '28db77f523047d84', '32caab7b40c72493', '3c9ebe0a15c9bebc', '431d67c49c100d4c',
    '4cc5d4becb3e42b6', '597f299cfc657e2a', '5fcb6fab3ad6faec', '6c44198c4a475817'].map(function (h) { return BigInt('0x' + h); });
  var M64 = (1n << 64n) - 1n;
  function rotr64(x, n) { return ((x >> n) | (x << (64n - n))) & M64; }
  function sha512(bytes) {
    var ml = BigInt(bytes.length) * 8n;
    var padLen = (((bytes.length + 16) >> 7) + 1) * 128;
    var withPad = new Uint8Array(padLen);
    withPad.set(bytes); withPad[bytes.length] = 0x80;
    var dv = new DataView(withPad.buffer);
    dv.setBigUint64(padLen - 8, ml & M64, false);
    var h = ['6a09e667f3bcc908', 'bb67ae8584caa73b', '3c6ef372fe94f82b', 'a54ff53a5f1d36f1',
      '510e527fade682d1', '9b05688c2b3e6c1f', '1f83d9abfb41bd6b', '5be0cd19137e2179'].map(function (x) { return BigInt('0x' + x); });
    var w = new Array(80), i, j, a, b, c, d, e, f, g, hh, s0, s1, ch, maj, t1, t2;
    for (i = 0; i < padLen; i += 128) {
      for (j = 0; j < 16; j++) w[j] = dv.getBigUint64(i + j * 8, false);
      for (j = 16; j < 80; j++) {
        s0 = rotr64(w[j - 15], 1n) ^ rotr64(w[j - 15], 8n) ^ (w[j - 15] >> 7n);
        s1 = rotr64(w[j - 2], 19n) ^ rotr64(w[j - 2], 61n) ^ (w[j - 2] >> 6n);
        w[j] = (w[j - 16] + s0 + w[j - 7] + s1) & M64;
      }
      a = h[0]; b = h[1]; c = h[2]; d = h[3]; e = h[4]; f = h[5]; g = h[6]; hh = h[7];
      for (j = 0; j < 80; j++) {
        s1 = rotr64(e, 14n) ^ rotr64(e, 18n) ^ rotr64(e, 41n);
        ch = (e & f) ^ ((~e & M64) & g);
        t1 = (hh + s1 + ch + K512[j] + w[j]) & M64;
        s0 = rotr64(a, 28n) ^ rotr64(a, 34n) ^ rotr64(a, 39n);
        maj = (a & b) ^ (a & c) ^ (b & c);
        t2 = (s0 + maj) & M64;
        hh = g; g = f; f = e; e = (d + t1) & M64; d = c; c = b; b = a; a = (t1 + t2) & M64;
      }
      h[0] = (h[0] + a) & M64; h[1] = (h[1] + b) & M64; h[2] = (h[2] + c) & M64; h[3] = (h[3] + d) & M64;
      h[4] = (h[4] + e) & M64; h[5] = (h[5] + f) & M64; h[6] = (h[6] + g) & M64; h[7] = (h[7] + hh) & M64;
    }
    var out = new Uint8Array(64), ov = new DataView(out.buffer);
    for (i = 0; i < 8; i++) ov.setBigUint64(i * 8, h[i], false);
    return out;
  }

  var HASHES = {
    'SHA-1': { fn: sha1, block: 64, size: 20 },
    'SHA-256': { fn: sha256, block: 64, size: 32 },
    'SHA-512': { fn: sha512, block: 128, size: 64 }
  };
  function hmac(algo, key, msg) {
    var spec = HASHES[algo] || HASHES['SHA-1'];
    var k = key;
    if (k.length > spec.block) k = spec.fn(k);
    var pad = new Uint8Array(spec.block);
    pad.set(k);
    var ipad = new Uint8Array(spec.block + msg.length);
    var opad = new Uint8Array(spec.block + spec.size);
    var i;
    for (i = 0; i < spec.block; i++) { ipad[i] = pad[i] ^ 0x36; opad[i] = pad[i] ^ 0x5c; }
    ipad.set(msg, spec.block);
    var inner = spec.fn(ipad);
    opad.set(inner, spec.block);
    return spec.fn(opad);
  }
  /* PBKDF2-HMAC-SHA256. The iteration count is deliberately modest:
     this is a for-fun lock in a browser, and a count that freezes the
     tab for four seconds would be security theatre with a real cost. */
  var PBKDF2_ITERATIONS = 20000;
  function pbkdf2(password, salt, iterations, dkLen) {
    var pw = utf8Bytes(password);
    var out = new Uint8Array(dkLen);
    var blocks = Math.ceil(dkLen / 32), i, j, k, off = 0;
    for (i = 1; i <= blocks; i++) {
      var msg = new Uint8Array(salt.length + 4);
      msg.set(salt);
      msg[salt.length] = (i >>> 24) & 0xff; msg[salt.length + 1] = (i >>> 16) & 0xff;
      msg[salt.length + 2] = (i >>> 8) & 0xff; msg[salt.length + 3] = i & 0xff;
      var u = hmac('SHA-256', pw, msg);
      var acc = u.slice();
      for (j = 1; j < iterations; j++) {
        u = hmac('SHA-256', pw, u);
        for (k = 0; k < acc.length; k++) acc[k] ^= u[k];
      }
      var take = Math.min(32, dkLen - off);
      out.set(acc.subarray(0, take), off);
      off += take;
    }
    return out;
  }
  function makeCredential(password) {
    var salt = randomBytes(16);
    return {
      kind: 'password', v: 1, alg: 'PBKDF2-HMAC-SHA256',
      iterations: PBKDF2_ITERATIONS, salt: toHex(salt),
      hash: toHex(pbkdf2(String(password), salt, PBKDF2_ITERATIONS, 32))
    };
  }
  function checkCredential(cred, password) {
    if (!cred || cred.kind !== 'password') return false;
    var got = toHex(pbkdf2(String(password), fromHex(cred.salt), cred.iterations || PBKDF2_ITERATIONS, 32));
    /* Constant-time-ish compare. It is not a real defence here -- the
       hash is sitting in the same storage -- but comparing lengths
       first and never short-circuiting costs nothing. */
    if (got.length !== cred.hash.length) return false;
    var diff = 0, i;
    for (i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ cred.hash.charCodeAt(i);
    return diff === 0;
  }

  var B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  function base32Encode(bytes) {
    var out = '', bits = 0, value = 0, i;
    for (i = 0; i < bytes.length; i++) {
      value = (value << 8) | bytes[i]; bits += 8;
      while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
    }
    if (bits > 0) out += B32[(value << (5 - bits)) & 31];
    while (out.length % 8 !== 0) out += '=';
    return out;
  }
  function base32Decode(str) {
    var clean = String(str).toUpperCase().replace(/[=\s-]/g, '');
    var bits = 0, value = 0, out = [], i, idx;
    for (i = 0; i < clean.length; i++) {
      idx = B32.indexOf(clean[i]);
      if (idx < 0) throw new Error('"' + clean[i] + '" is not a base32 character.');
      value = (value << 5) | idx; bits += 5;
      if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
    }
    return new Uint8Array(out);
  }
  function base64Encode(bytes) {
    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    var out = '', i;
    for (i = 0; i < bytes.length; i += 3) {
      var b0 = bytes[i], b1 = bytes[i + 1], b2 = bytes[i + 2];
      out += chars[b0 >> 2];
      out += chars[((b0 & 3) << 4) | ((b1 === undefined ? 0 : b1) >> 4)];
      out += b1 === undefined ? '=' : chars[((b1 & 15) << 2) | ((b2 === undefined ? 0 : b2) >> 6)];
      out += b2 === undefined ? '=' : chars[b2 & 63];
    }
    return out;
  }

  /* ================================================================
   * 8. Overlays
   *
   * Every popover, menu, tooltip and panel goes through here, so the
   * four rules hold everywhere at once rather than being remembered
   * per component:
   *
   *   1. It paints its own surface. An overlay framework that makes
   *      decoration optional produces transparent menus that read as
   *      broken, so decoration is not optional here.
   *   2. It is bounded by the viewport and scrolls INTERNALLY. Capping
   *      a height and hiding the overflow silently deletes content
   *      past the cap -- a calendar loses its last week and nothing
   *      says so.
   *   3. It never covers its anchor. On a narrow viewport where a
   *      sheet would land on top of the control that opened it, the
   *      page scrolls the anchor clear instead.
   *   4. It is dismissible by Escape and by a click outside, and focus
   *      returns to whatever opened it.
   * ================================================================ */
  var overlayStack = [];
  var GAP = 8, EDGE = 8;

  function narrowViewport() { return window.innerWidth <= 599; }

  function anchorRectOf(anchor) {
    if (!anchor) return null;
    if (typeof anchor.getBoundingClientRect === 'function') return anchor.getBoundingClientRect();
    if (typeof anchor.x === 'number') return { left: anchor.x, right: anchor.x, top: anchor.y, bottom: anchor.y, width: 0, height: 0 };
    return null;
  }

  function positionOverlay(node, anchor, preferred) {
    var vw = window.innerWidth, vh = window.innerHeight;
    node.style.maxWidth = (vw - EDGE * 2) + 'px';
    var rect = anchorRectOf(anchor);

    if (!rect) {
      /* No anchor: centre it, still bounded. */
      node.style.maxHeight = (vh - EDGE * 2) + 'px';
      var w = Math.min(node.offsetWidth, vw - EDGE * 2);
      var h = Math.min(node.offsetHeight, vh - EDGE * 2);
      node.style.left = Math.round((vw - w) / 2) + 'px';
      node.style.top = Math.round((vh - h) / 2) + 'px';
      return;
    }

    if (narrowViewport() && node.dataset.sheet !== 'no') {
      node.classList.add('is-modal-sheet');
      node.style.left = ''; node.style.top = ''; node.style.width = '';
      node.style.maxHeight = Math.round(vh * 0.85) + 'px';
      /* Rule 3 on a phone: if the sheet would land on the control that
         opened it, move the page rather than the sheet. */
      window.requestAnimationFrame(function () {
        var sheetTop = node.getBoundingClientRect().top;
        var a = anchorRectOf(anchor);
        if (a && a.bottom > sheetTop - GAP) {
          var delta = a.bottom - (sheetTop - GAP) + 16;
          window.scrollBy({ top: delta, behavior: a11y.reducedMotion() ? 'auto' : 'smooth' });
        }
      });
      return;
    }
    node.classList.remove('is-modal-sheet');

    var below = vh - rect.bottom - GAP - EDGE;
    var above = rect.top - GAP - EDGE;
    var right = vw - rect.right - GAP - EDGE;
    var left = rect.left - GAP - EDGE;
    var order = (preferred ? [preferred] : []).concat(['bottom', 'top', 'right', 'left']);
    var space = { bottom: below, top: above, right: right, left: left };
    var want = node.scrollHeight;
    var side = null, i;
    for (i = 0; i < order.length; i++) {
      var s = order[i];
      var avail = (s === 'bottom' || s === 'top') ? space[s] : vh - EDGE * 2;
      if (space[s] > 120 && want <= avail) { side = s; break; }
    }
    if (!side) side = below >= above ? 'bottom' : 'top';

    var maxH;
    if (side === 'bottom') maxH = below;
    else if (side === 'top') maxH = above;
    else maxH = vh - EDGE * 2;
    node.style.maxHeight = Math.max(120, Math.floor(maxH)) + 'px';

    var w = Math.min(node.offsetWidth, vw - EDGE * 2);
    var h = Math.min(node.offsetHeight, vh - EDGE * 2);
    var top, lft;
    if (side === 'bottom') { top = rect.bottom + GAP; lft = rect.left; }
    else if (side === 'top') { top = rect.top - GAP - h; lft = rect.left; }
    else if (side === 'right') { top = rect.top; lft = rect.right + GAP; }
    else { top = rect.top; lft = rect.left - GAP - w; }

    lft = clamp(lft, EDGE, Math.max(EDGE, vw - w - EDGE));
    top = clamp(top, EDGE, Math.max(EDGE, vh - h - EDGE));

    /* Bounding can push a side-placed overlay back over its anchor.
       Detect the overlap and flip rather than shipping rule 3 as an
       aspiration. */
    var overlaps = !(lft + w <= rect.left || lft >= rect.right || top + h <= rect.top || top >= rect.bottom);
    if (overlaps) {
      if (below >= above) top = Math.min(rect.bottom + GAP, vh - h - EDGE);
      else top = Math.max(EDGE, rect.top - GAP - h);
    }
    node.style.left = Math.round(lft) + 'px';
    node.style.top = Math.round(top) + 'px';
    node.dataset.side = side;
  }

  function openOverlay(opts) {
    opts = opts || {};
    var id = uid('ov');
    var node = el('div', {
      class: 'wds-overlay' + (opts.className ? ' ' + opts.className : '') + (opts.draggable ? ' wds-overlay--draggable' : ''),
      id: id,
      role: opts.role || 'dialog',
      'aria-modal': opts.modal ? 'true' : 'false',
      tabindex: '-1'
    });
    if (opts.sheet === false) node.dataset.sheet = 'no';

    var titleId = null;
    if (opts.title) {
      titleId = uid('ovt');
      var head = el('div', { class: 'wds-overlay__head' }, [
        el('span', { class: 'wds-overlay__title', id: titleId, text: opts.title })
      ]);
      if (opts.headExtra) append(head, opts.headExtra);
      head.appendChild(el('button', {
        class: 'btn btn--icon', type: 'button', 'aria-label': t('act.close'),
        onclick: function () { handle.close('close-button'); }
      }, icon('close')));
      node.appendChild(head);
      node.setAttribute('aria-labelledby', titleId);
    } else if (opts.ariaLabel) {
      node.setAttribute('aria-label', opts.ariaLabel);
    }

    var body = el('div', { class: 'wds-overlay__body' });
    if (opts.content) append(body, opts.content);
    node.appendChild(body);
    if (opts.footer) node.appendChild(el('div', { class: 'wds-overlay__foot' }, opts.footer));

    var backdrop = null;
    if (opts.backdrop !== false) {
      backdrop = el('div', {
        class: 'wds-overlay-backdrop' + (opts.dim ? ' is-dim' : ''),
        onpointerdown: function (e) { if (e.target === backdrop) handle.close('outside'); }
      });
      document.body.appendChild(backdrop);
    }
    document.body.appendChild(node);

    /* Persisted size and position for a panel the visitor can move. */
    var persistKey = opts.persistKey ? 'panel.' + opts.persistKey : null;
    if (persistKey) {
      var saved = store.get(persistKey, null);
      if (saved && typeof saved === 'object') {
        if (saved.w) node.style.width = clamp(saved.w, 200, window.innerWidth - EDGE * 2) + 'px';
        if (saved.h) node.style.height = clamp(saved.h, 120, window.innerHeight - EDGE * 2) + 'px';
      }
    }

    positionOverlay(node, opts.anchor, opts.placement);
    if (persistKey) {
      var pos = store.get(persistKey, null);
      if (pos && typeof pos.x === 'number' && !narrowViewport()) {
        node.style.left = clamp(pos.x, EDGE, window.innerWidth - node.offsetWidth - EDGE) + 'px';
        node.style.top = clamp(pos.y, EDGE, window.innerHeight - node.offsetHeight - EDGE) + 'px';
      }
    }

    var release = opts.trapFocus === false
      ? function () { if (opts.restoreFocus !== false && opts.returnTo && opts.returnTo.focus) opts.returnTo.focus(); }
      : a11y.trapFocus(node, { initial: opts.initialFocus, restore: false });

    function onKey(e) {
      if (e.key === 'Escape') { e.stopPropagation(); handle.close('escape'); return; }
      if (e.altKey && persistKey && !narrowViewport()) {
        var step = e.shiftKey ? 24 : 8, moved = false;
        var r = node.getBoundingClientRect();
        var nx = r.left, ny = r.top, nw = r.width, nh = r.height;
        if (e.ctrlKey) {
          if (e.key === 'ArrowRight') { nw += step; moved = true; }
          else if (e.key === 'ArrowLeft') { nw -= step; moved = true; }
          else if (e.key === 'ArrowDown') { nh += step; moved = true; }
          else if (e.key === 'ArrowUp') { nh -= step; moved = true; }
          if (moved) { node.style.width = Math.max(200, nw) + 'px'; node.style.height = Math.max(120, nh) + 'px'; }
        } else {
          if (e.key === 'ArrowRight') { nx += step; moved = true; }
          else if (e.key === 'ArrowLeft') { nx -= step; moved = true; }
          else if (e.key === 'ArrowDown') { ny += step; moved = true; }
          else if (e.key === 'ArrowUp') { ny -= step; moved = true; }
          if (moved) {
            node.style.left = clamp(nx, EDGE, window.innerWidth - node.offsetWidth - EDGE) + 'px';
            node.style.top = clamp(ny, EDGE, window.innerHeight - node.offsetHeight - EDGE) + 'px';
          }
        }
        if (moved) { e.preventDefault(); savePanel(); }
      }
    }
    node.addEventListener('keydown', onKey);

    function savePanel() {
      if (!persistKey) return;
      var r = node.getBoundingClientRect();
      store.set(persistKey, { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) });
    }

    if (opts.draggable && opts.title) {
      var headEl = node.querySelector('.wds-overlay__head');
      makeDraggable(headEl, node, savePanel);
    }
    if (opts.resizable) {
      var grip = el('div', { class: 'wds-overlay__grip', 'aria-hidden': 'true' });
      node.appendChild(grip);
      node.appendChild(el('div', { class: 'wds-overlay__edge', 'data-edge': 'e', 'aria-hidden': 'true' }));
      node.appendChild(el('div', { class: 'wds-overlay__edge', 'data-edge': 's', 'aria-hidden': 'true' }));
      makeResizable(node, savePanel);
    }

    var onScrollResize = debounce(function () {
      if (!document.body.contains(node)) return;
      if (opts.anchor && !persistKey) positionOverlay(node, opts.anchor, opts.placement);
    }, 60);
    window.addEventListener('resize', onScrollResize);
    window.addEventListener('scroll', onScrollResize, true);

    var handle = {
      id: id, el: node, body: body,
      reposition: function () { positionOverlay(node, opts.anchor, opts.placement); },
      resetGeometry: function () {
        if (persistKey) store.remove(persistKey);
        node.style.width = ''; node.style.height = '';
        positionOverlay(node, opts.anchor, opts.placement);
      },
      close: function (reason) {
        if (!document.body.contains(node)) return;
        node.removeEventListener('keydown', onKey);
        window.removeEventListener('resize', onScrollResize);
        window.removeEventListener('scroll', onScrollResize, true);
        if (backdrop && backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
        if (node.parentNode) node.parentNode.removeChild(node);
        var i = overlayStack.indexOf(handle); if (i >= 0) overlayStack.splice(i, 1);
        try { release(); } catch (e) {}
        var back = opts.returnTo || opts.anchor;
        if (opts.restoreFocus !== false && back && back.focus) { try { back.focus(); } catch (e) {} }
        if (opts.onClose) opts.onClose(reason || 'programmatic');
      }
    };
    overlayStack.push(handle);
    return handle;
  }

  function makeDraggable(grabber, node, done) {
    var startX = 0, startY = 0, ox = 0, oy = 0, active = false;
    grabber.addEventListener('pointerdown', function (e) {
      if (e.target.closest('button')) return;
      active = true;
      var r = node.getBoundingClientRect();
      startX = e.clientX; startY = e.clientY; ox = r.left; oy = r.top;
      node.style.left = ox + 'px'; node.style.top = oy + 'px';
      grabber.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    grabber.addEventListener('pointermove', function (e) {
      if (!active) return;
      var nx = clamp(ox + e.clientX - startX, EDGE, window.innerWidth - node.offsetWidth - EDGE);
      var ny = clamp(oy + e.clientY - startY, EDGE, window.innerHeight - node.offsetHeight - EDGE);
      node.style.left = nx + 'px'; node.style.top = ny + 'px';
    });
    grabber.addEventListener('pointerup', function (e) {
      if (!active) return;
      active = false;
      try { grabber.releasePointerCapture(e.pointerId); } catch (err) {}
      if (done) done();
    });
  }
  function makeResizable(node, done) {
    Array.prototype.forEach.call(node.querySelectorAll('.wds-overlay__grip,.wds-overlay__edge'), function (h) {
      var edge = h.dataset.edge || 'se', sw = 0, sh = 0, sx = 0, sy = 0, active = false;
      h.addEventListener('pointerdown', function (e) {
        active = true;
        var r = node.getBoundingClientRect();
        sw = r.width; sh = r.height; sx = e.clientX; sy = e.clientY;
        h.setPointerCapture(e.pointerId); e.preventDefault();
      });
      h.addEventListener('pointermove', function (e) {
        if (!active) return;
        if (edge !== 's') node.style.width = Math.max(220, sw + (e.clientX - sx)) + 'px';
        if (edge !== 'e') node.style.height = Math.max(140, sh + (e.clientY - sy)) + 'px';
      });
      h.addEventListener('pointerup', function (e) {
        if (!active) return;
        active = false;
        try { h.releasePointerCapture(e.pointerId); } catch (err) {}
        if (done) done();
      });
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && overlayStack.length) {
      var top = overlayStack[overlayStack.length - 1];
      if (!top.el.contains(document.activeElement)) top.close('escape');
    }
  });

  var overlay = {
    open: openOverlay,
    closeTop: function () { if (overlayStack.length) overlayStack[overlayStack.length - 1].close('programmatic'); },
    closeAll: function () { while (overlayStack.length) overlayStack[overlayStack.length - 1].close('programmatic'); },
    count: function () { return overlayStack.length; },
    position: positionOverlay
  };

  /* ================================================================
   * 9. The regular expression builder
   *
   * A real builder, not a toggle: guided construction, a raw editor,
   * flags, sample text, live matches with capture groups, syntax
   * feedback, copy and export.
   *
   * BOUNDS. A JavaScript regular expression cannot be interrupted once
   * a single match attempt begins, so a nested-quantifier pattern on
   * the wrong input can spin without the page getting a turn. Where
   * the browser allows a Worker (which is everywhere the site is
   * served over http or https), evaluation runs in one and the worker
   * is TERMINATED on timeout -- that is a real bound, not a hope.
   * Where a Worker cannot be created, evaluation falls back to the
   * main thread with a capped sample and a capped match count, and the
   * builder says which path it is on rather than implying the stronger
   * guarantee.
   * ================================================================ */
  var REX_LIMITS = deepFreeze({
    maxPattern: 2000, maxSample: 20000, hardSample: 200000, maxMatches: 500, timeoutMs: 250
  });
  var REX_FLAGS = [
    { f: 'g', en: 'global', note: 'Find every match, not only the first.' },
    { f: 'i', en: 'ignore case', note: 'Match without regard to letter case.' },
    { f: 'm', en: 'multiline', note: 'Anchors match at every line break.' },
    { f: 's', en: 'dot all', note: 'A dot also matches a line break.' },
    { f: 'u', en: 'unicode', note: 'Treat the pattern as a sequence of code points.' },
    { f: 'y', en: 'sticky', note: 'Match only from the last index.' },
    { f: 'd', en: 'indices', note: 'Report the start and end of every group.' }
  ];
  var REX_PIECES = [
    { id: 'literal', label: 'Literal text', build: function (v) { return escapeRegex(v || ''); }, needsValue: true, hint: 'Matches exactly what you type. Special characters are escaped for you.' },
    { id: 'any', label: 'Any character', build: function () { return '.'; }, hint: 'One of anything except a line break, unless the dot-all flag is on.' },
    { id: 'digit', label: 'A digit', build: function () { return '\\d'; }, hint: 'One character from 0 to 9.' },
    { id: 'word', label: 'A word character', build: function () { return '\\w'; }, hint: 'A letter, a digit or an underscore.' },
    { id: 'space', label: 'Whitespace', build: function () { return '\\s'; }, hint: 'A space, a tab or a line break.' },
    { id: 'class', label: 'One of these characters', build: function (v) { return '[' + String(v || '').replace(/[\]\\^-]/g, '\\$&') + ']'; }, needsValue: true, hint: 'Matches any single character you list.' },
    { id: 'notclass', label: 'None of these characters', build: function (v) { return '[^' + String(v || '').replace(/[\]\\^-]/g, '\\$&') + ']'; }, needsValue: true, hint: 'Matches any single character you did not list.' },
    { id: 'range', label: 'A character range', build: function (v) { return '[' + (v || 'a-z') + ']'; }, needsValue: true, hint: 'Write it as a-z or 0-9. Several ranges can sit side by side.' },
    { id: 'start', label: 'Start of the text', build: function () { return '^'; }, hint: 'Anchors the match to the beginning.' },
    { id: 'end', label: 'End of the text', build: function () { return '$'; }, hint: 'Anchors the match to the end.' },
    { id: 'boundary', label: 'A word boundary', build: function () { return '\\b'; }, hint: 'The edge between a word character and anything else.' },
    { id: 'group', label: 'Capture group', build: function (v) { return '(' + (v || '') + ')'; }, needsValue: true, hint: 'Remembers what it matched so you can read it back.' },
    { id: 'named', label: 'Named capture group', build: function (v) { var p = String(v || 'name:').split(':'); return '(?<' + (p[0] || 'name') + '>' + p.slice(1).join(':') + ')'; }, needsValue: true, hint: 'Write it as name:pattern. The name is how you read the group back.' },
    { id: 'noncap', label: 'Group without capturing', build: function (v) { return '(?:' + (v || '') + ')'; }, needsValue: true, hint: 'Groups for structure without remembering the result.' },
    { id: 'alt', label: 'One or the other', build: function (v) { return '(?:' + String(v || '').split(',').map(escapeRegex).join('|') + ')'; }, needsValue: true, hint: 'List the alternatives separated by commas.' },
    { id: 'opt', label: 'Optional', build: function (v) { return '(?:' + (v || '') + ')?'; }, needsValue: true, hint: 'Zero or one of what you wrote.' },
    { id: 'star', label: 'Zero or more', build: function (v) { return '(?:' + (v || '') + ')*'; }, needsValue: true, hint: 'Any number, including none at all.' },
    { id: 'plus', label: 'One or more', build: function (v) { return '(?:' + (v || '') + ')+'; }, needsValue: true, hint: 'At least one.' },
    { id: 'count', label: 'An exact number of times', build: function (v) { var p = String(v || '2:').split(':'); return '(?:' + (p[1] || '.') + '){' + (p[0] || '2') + '}'; }, needsValue: true, hint: 'Write it as count:pattern, for example 3:a.' },
    { id: 'between', label: 'Between two counts', build: function (v) { var p = String(v || '1:3:').split(':'); return '(?:' + (p.slice(2).join(':') || '.') + '){' + (p[0] || '1') + ',' + (p[1] || '3') + '}'; }, needsValue: true, hint: 'Write it as min:max:pattern, for example 2:4:a.' },
    { id: 'lazy', label: 'As few as possible', build: function (v) { return '(?:' + (v || '') + ')*?'; }, needsValue: true, hint: 'Stops at the first thing that works instead of the last.' },
    { id: 'ahead', label: 'Followed by', build: function (v) { return '(?=' + (v || '') + ')'; }, needsValue: true, hint: 'Checks what comes next without consuming it.' },
    { id: 'notahead', label: 'Not followed by', build: function (v) { return '(?!' + (v || '') + ')'; }, needsValue: true, hint: 'Checks that what comes next is absent.' }
  ];

  /* Static risk scan. It cannot prove a pattern is safe, and does not
     claim to -- it recognises the shape that causes catastrophic
     backtracking so the builder can warn before the visitor runs it. */
  function rexRisk(pattern) {
    var risks = [];
    if (/\([^()]*[+*]\)[+*]/.test(pattern)) risks.push('A repeat wraps another repeat, for example (a+)+.');
    if (/\([^()]*\|[^()]*\)[+*]/.test(pattern) && /[+*]/.test(pattern)) risks.push('A repeated alternation can retry the same text many ways.');
    if (/\[[^\]]*\][+*][^|)]*\[[^\]]*\][+*]/.test(pattern)) risks.push('Two adjacent open-ended repeats can share the same characters.');
    return risks;
  }

  var WORKER_SRC = 'self.onmessage=function(e){' +
    'var d=e.data;try{' +
    'var re=new RegExp(d.pattern,d.flags);var out=[],m,guard=0;' +
    'if(d.flags.indexOf("g")<0){m=re.exec(d.sample);if(m)out.push({index:m.index,text:m[0],groups:Array.prototype.slice.call(m,1),named:m.groups||null});}' +
    'else{while((m=re.exec(d.sample))!==null){out.push({index:m.index,text:m[0],groups:Array.prototype.slice.call(m,1),named:m.groups||null});' +
    'if(m[0]==="")re.lastIndex++;if(++guard>=d.maxMatches)break;}}' +
    'self.postMessage({ok:true,matches:out,truncated:guard>=d.maxMatches});' +
    '}catch(err){self.postMessage({ok:false,error:String(err&&err.message||err)});}};';

  var workerUrl = null, workerAvailable = null;
  function rexWorkerSupported() {
    if (workerAvailable !== null) return workerAvailable;
    try {
      workerUrl = URL.createObjectURL(new Blob([WORKER_SRC], { type: 'text/javascript' }));
      var probe = new Worker(workerUrl);
      probe.terminate();
      workerAvailable = true;
    } catch (e) { workerAvailable = false; }
    return workerAvailable;
  }

  function rexCompile(pattern, flags) {
    if (String(pattern).length > REX_LIMITS.maxPattern) {
      return { ok: false, error: 'The pattern is longer than ' + REX_LIMITS.maxPattern + ' characters.' };
    }
    try { return { ok: true, re: new RegExp(pattern, flags) }; }
    catch (e) { return { ok: false, error: e.message }; }
  }

  function rexEvaluateSync(pattern, flags, sample) {
    var c = rexCompile(pattern, flags);
    if (!c.ok) return { ok: false, error: c.error, path: 'main-thread' };
    var text = String(sample).slice(0, REX_LIMITS.maxSample);
    var matches = [], m, guard = 0, started = Date.now(), truncated = false, timedOut = false;
    try {
      if (flags.indexOf('g') < 0) {
        m = c.re.exec(text);
        if (m) matches.push({ index: m.index, text: m[0], groups: Array.prototype.slice.call(m, 1), named: m.groups || null });
      } else {
        while ((m = c.re.exec(text)) !== null) {
          matches.push({ index: m.index, text: m[0], groups: Array.prototype.slice.call(m, 1), named: m.groups || null });
          if (m[0] === '') c.re.lastIndex++;
          guard++;
          if (guard >= REX_LIMITS.maxMatches) { truncated = true; break; }
          if (Date.now() - started > REX_LIMITS.timeoutMs) { timedOut = true; break; }
        }
      }
    } catch (e) { return { ok: false, error: e.message, path: 'main-thread' }; }
    return {
      ok: true, matches: matches, truncated: truncated, timedOut: timedOut,
      sampleTruncated: String(sample).length > REX_LIMITS.maxSample,
      path: 'main-thread', ms: Date.now() - started
    };
  }

  function rexEvaluate(pattern, flags, sample) {
    var text = String(sample).slice(0, REX_LIMITS.hardSample);
    if (!rexWorkerSupported()) return Promise.resolve(rexEvaluateSync(pattern, flags, text));
    var pre = rexCompile(pattern, flags);
    if (!pre.ok) return Promise.resolve({ ok: false, error: pre.error, path: 'worker' });
    return new Promise(function (resolve) {
      var w, timer, settled = false, started = Date.now();
      function finish(v) { if (settled) return; settled = true; clearTimeout(timer); try { w.terminate(); } catch (e) {} resolve(v); }
      try { w = new Worker(workerUrl); } catch (e) { resolve(rexEvaluateSync(pattern, flags, text)); return; }
      w.onmessage = function (ev) {
        var d = ev.data || {};
        if (!d.ok) { finish({ ok: false, error: d.error, path: 'worker' }); return; }
        finish({
          ok: true, matches: d.matches, truncated: d.truncated, timedOut: false,
          sampleTruncated: String(sample).length > REX_LIMITS.hardSample,
          path: 'worker', ms: Date.now() - started
        });
      };
      w.onerror = function () { finish({ ok: false, error: 'The evaluation worker failed to start.', path: 'worker' }); };
      timer = setTimeout(function () {
        /* The real bound: the worker is killed, so the page keeps its
           thread whatever the pattern was doing. */
        finish({ ok: false, error: 'Evaluation was stopped after ' + REX_LIMITS.timeoutMs + 'ms. That usually means the pattern is backtracking.', path: 'worker', timedOut: true });
      }, REX_LIMITS.timeoutMs * 4);
      w.postMessage({ pattern: pattern, flags: flags, sample: text, maxMatches: REX_LIMITS.maxMatches });
    });
  }

  function buildRegexPanel(state, onChange) {
    state = state || {};
    state.pattern = state.pattern || '';
    state.flags = state.flags || 'g';
    state.sample = state.sample === undefined ? '' : state.sample;

    var wrap = el('div', { class: 'wds-rex' });
    wrap.appendChild(el('p', { class: 'muted t-body-small', text: t('rex.engine') }));

    /* guided construction */
    var pieceValue = el('input', { class: 'field__input', type: 'text', id: uid('rexv'), placeholder: 'value' });
    var pieceHint = el('p', { class: 'muted t-body-small', text: REX_PIECES[0].hint });
    var pieceSelect = el('select', { class: 'field__input', 'aria-label': 'Piece to insert' },
      REX_PIECES.map(function (p) { return el('option', { value: p.id, text: p.label }); }));
    function syncPiece() {
      var p = REX_PIECES.filter(function (x) { return x.id === pieceSelect.value; })[0] || REX_PIECES[0];
      pieceHint.textContent = p.hint;
      pieceValue.disabled = !p.needsValue;
      pieceValue.placeholder = p.needsValue ? 'value' : 'this piece takes no value';
    }
    pieceSelect.addEventListener('change', syncPiece);

    var insert = el('button', {
      class: 'btn btn--tonal', type: 'button', text: 'Insert piece',
      onclick: function () {
        var p = REX_PIECES.filter(function (x) { return x.id === pieceSelect.value; })[0];
        if (!p) return;
        patternInput.value = patternInput.value + p.build(pieceValue.value);
        pieceValue.value = '';
        sync();
      }
    });
    wrap.appendChild(el('div', { class: 'wds-rex__pieces' }, [
      el('div', { class: 'field field--outlined field--dense', style: { 'flex': '1 1 200px' } }, [
        el('div', { class: 'field__box' }, pieceSelect)
      ]),
      el('div', { class: 'field field--outlined field--dense', style: { 'flex': '1 1 160px' } }, [
        el('div', { class: 'field__box' }, pieceValue)
      ]),
      insert
    ]));
    wrap.appendChild(pieceHint);

    /* raw editor */
    var patternId = uid('rexp');
    var patternInput = el('input', { class: 'field__input', type: 'text', id: patternId, value: state.pattern, spellcheck: 'false', autocapitalize: 'off', autocorrect: 'off' });
    var patternMsg = el('p', { class: 'field__help' });
    wrap.appendChild(el('div', { class: 'field field--outlined' }, [
      el('label', { class: 'field__label', for: patternId, text: 'Pattern' }),
      el('div', { class: 'field__box' }, patternInput),
      patternMsg
    ]));

    /* flags */
    var flagBoxes = {};
    var flagsRow = el('div', { class: 'wds-rex__flags' }, REX_FLAGS.map(function (f) {
      var id = uid('rexf');
      var input = el('input', { type: 'checkbox', id: id, checked: state.flags.indexOf(f.f) >= 0, class: 'visually-hidden' });
      flagBoxes[f.f] = input;
      var box = el('span', { class: 'cbx', 'aria-hidden': 'true' }, icon('check'));
      function paint() { box.classList.toggle('is-on', input.checked); }
      input.addEventListener('change', function () { paint(); sync(); });
      paint();
      return el('label', { class: 'ctl', for: id, title: f.note }, [input, box, el('span', { text: f.f + ' · ' + f.en })]);
    }));
    wrap.appendChild(flagsRow);

    /* sample */
    var sampleId = uid('rexs');
    var sampleInput = el('textarea', { class: 'field__input wds-rex__sample', id: sampleId, spellcheck: 'false' });
    sampleInput.value = state.sample;
    wrap.appendChild(el('div', { class: 'field field--outlined' }, [
      el('label', { class: 'field__label', for: sampleId, text: 'Sample text' }),
      el('div', { class: 'field__box' }, sampleInput),
      el('p', { class: 'field__help', text: 'Evaluation is capped at ' + REX_LIMITS.maxSample.toLocaleString() + ' characters and ' + REX_LIMITS.maxMatches + ' matches.' })
    ]));

    var out = el('div', { class: 'wds-rex__out', role: 'status', 'aria-live': 'polite' });
    wrap.appendChild(out);
    var pathNote = el('p', { class: 'muted t-body-small' });
    wrap.appendChild(pathNote);

    wrap.appendChild(el('div', { class: 'row' }, [
      el('button', {
        class: 'btn btn--outlined', type: 'button', text: t('act.copy'),
        onclick: function () { copyText('/' + patternInput.value + '/' + currentFlags()); }
      }),
      el('button', {
        class: 'btn btn--outlined', type: 'button', text: 'Export as JSON',
        onclick: function () {
          downloadText('regex.json', JSON.stringify({
            engine: 'JavaScript RegExp', pattern: patternInput.value, flags: currentFlags(),
            sample: sampleInput.value, exportedAt: nowIso()
          }, null, 2), 'application/json');
        }
      })
    ]));

    function currentFlags() {
      return REX_FLAGS.filter(function (f) { return flagBoxes[f.f].checked; }).map(function (f) { return f.f; }).join('');
    }

    var runEval = debounce(function () {
      var pattern = patternInput.value, flags = currentFlags();
      state.pattern = pattern; state.flags = flags; state.sample = sampleInput.value;
      if (onChange) onChange({ pattern: pattern, flags: flags, sample: state.sample });
      if (!pattern) { clear(out); out.appendChild(el('span', { class: 'wds-rex__ok', text: 'Type a pattern to see what it matches.' })); patternMsg.textContent = ''; return; }
      var risks = rexRisk(pattern);
      patternMsg.textContent = risks.length ? t('rex.risk') + ' ' + risks.join(' ') : '';
      rexEvaluate(pattern, flags, sampleInput.value).then(function (res) {
        clear(out);
        pathNote.textContent = res.path === 'worker'
          ? 'Evaluated in a worker with a hard timeout, so a runaway pattern cannot hang this page.'
          : 'This browser would not create a worker, so evaluation ran on the page thread with a capped sample. A pattern that backtracks badly can still make the page pause.';
        if (!res.ok) {
          out.appendChild(el('span', { class: 'wds-rex__err', text: t('rex.invalid') + ': ' + res.error }));
          return;
        }
        if (!res.matches.length) { out.appendChild(el('span', { class: 'wds-rex__ok', text: t('msg.noMatch') })); return; }
        var head = res.matches.length + (res.truncated ? '+ (stopped at the cap)' : '') + ' match' + (res.matches.length === 1 ? '' : 'es');
        out.appendChild(el('div', { class: 'cap', text: head }));
        var text = sampleInput.value.slice(0, REX_LIMITS.maxSample), cursor = 0;
        var frag = document.createDocumentFragment();
        res.matches.forEach(function (m) {
          if (m.index > cursor) frag.appendChild(document.createTextNode(text.slice(cursor, m.index)));
          frag.appendChild(el('mark', { class: 'wds-rex__hit', text: m.text || '∅' }));
          cursor = m.index + (m.text.length || 0);
        });
        if (cursor < text.length) frag.appendChild(document.createTextNode(text.slice(cursor)));
        out.appendChild(el('div', {}, frag));
        var withGroups = res.matches.filter(function (m) { return m.groups.length || m.named; });
        if (withGroups.length) {
          var gl = el('ol', { class: 'cap' });
          withGroups.slice(0, 20).forEach(function (m) {
            var bits = m.groups.map(function (g, i) { return (i + 1) + ': ' + (g === undefined ? '(no match)' : JSON.stringify(g)); });
            if (m.named) Object.keys(m.named).forEach(function (k) { bits.push(k + ': ' + JSON.stringify(m.named[k])); });
            gl.appendChild(el('li', { text: bits.join('  ') }));
          });
          out.appendChild(gl);
        }
      });
    }, 140);

    function sync() { runEval(); }
    patternInput.addEventListener('input', sync);
    sampleInput.addEventListener('input', sync);
    syncPiece();
    sync();

    return {
      el: wrap,
      state: state,
      focus: function () { patternInput.focus(); },
      current: function () { return { pattern: patternInput.value, flags: currentFlags(), sample: sampleInput.value }; }
    };
  }

  /* An anchored builder, attached to the exact field that opened it. */
  function openRegexBuilder(anchor, state, onApply) {
    var panel = buildRegexPanel({ pattern: state && state.pattern, flags: state && state.flags, sample: state && state.sample });
    var handle = openOverlay({
      anchor: anchor,
      title: t('rex.title'),
      content: panel.el,
      className: 'wds-overlay--rex',
      placement: 'bottom',
      resizable: true,
      persistKey: 'rex-builder',
      returnTo: anchor,
      footer: [
        el('button', { class: 'btn btn--text', type: 'button', text: t('act.cancel'), onclick: function () { handle.close('cancel'); } }),
        el('button', {
          class: 'btn btn--filled', type: 'button', text: t('act.apply'),
          onclick: function () { if (onApply) onApply(panel.current()); handle.close('apply'); }
        })
      ],
      initialFocus: null
    });
    window.setTimeout(function () { panel.focus(); }, 0);
    return handle;
  }

  /* ================================================================
   * 10. Search bars
   *
   * Plain text is the default and regex is an explicit opt-in. Each
   * instance owns its own query, pattern, flags, validation and mode:
   * one shared builder that silently applies to whichever field was
   * last touched is the failure this design exists to prevent.
   * ================================================================ */
  function createSearchBar(opts) {
    opts = opts || {};
    var id = uid('search');
    var state = {
      query: opts.value || '',
      mode: 'plain',
      pattern: opts.value || '',
      flags: 'gi',
      sample: opts.sample || '',
      valid: true,
      error: null
    };
    if (opts.storageKey) {
      var saved = store.get('search.' + opts.storageKey, null);
      if (saved && typeof saved === 'object') {
        state.mode = saved.mode === 'regex' ? 'regex' : 'plain';
        state.flags = typeof saved.flags === 'string' ? saved.flags : state.flags;
      }
    }

    var input = el('input', {
      class: 'wds-search__input', type: 'search', id: id,
      value: state.query, spellcheck: 'false', autocomplete: 'off',
      placeholder: opts.placeholder || t('search.placeholder'),
      'aria-describedby': id + '-msg'
    });
    var msg = el('p', { class: 'wds-search__msg', id: id + '-msg' });
    var modeBtn = el('button', {
      class: 'btn btn--icon', type: 'button',
      'aria-pressed': 'false',
      'aria-label': t('search.regexOn'),
      title: t('search.regexOn'),
      onclick: function () { setMode(state.mode === 'regex' ? 'plain' : 'regex'); }
    }, icon('text'));
    var builderBtn = el('button', {
      class: 'btn btn--icon', type: 'button',
      'aria-label': t('rex.title'), title: t('rex.title'),
      'aria-haspopup': 'dialog',
      onclick: function () {
        openRegexBuilder(builderBtn, { pattern: state.pattern, flags: state.flags, sample: state.sample || opts.sampleProvider && opts.sampleProvider() || '' }, function (res) {
          state.pattern = res.pattern; state.flags = res.flags; state.sample = res.sample;
          setMode('regex');
          input.value = res.pattern;
          state.query = res.pattern;
          validate(); notify();
        });
      }
    }, icon('filter'));

    var box = el('div', { class: 'wds-search__box' }, [icon('search'), input, modeBtn, builderBtn]);
    var wrap = el('div', { class: 'wds-search' + (opts.className ? ' ' + opts.className : '') }, [box, msg]);
    if (opts.label) {
      wrap.insertBefore(el('label', { class: 'cap', for: id, text: opts.label }), box);
    } else {
      input.setAttribute('aria-label', opts.ariaLabel || t('search.placeholder'));
    }

    function setMode(m, silent) {
      state.mode = m === 'regex' ? 'regex' : 'plain';
      modeBtn.setAttribute('aria-pressed', state.mode === 'regex' ? 'true' : 'false');
      modeBtn.title = state.mode === 'regex' ? t('search.regexOn') : t('search.plain');
      modeBtn.setAttribute('aria-label', state.mode === 'regex' ? t('search.regexOn') : t('search.plain'));
      if (opts.storageKey) store.set('search.' + opts.storageKey, { mode: state.mode, flags: state.flags });
      validate();
      if (!silent) notify();
    }
    function validate() {
      if (state.mode !== 'regex' || !state.query) { state.valid = true; state.error = null; msg.textContent = opts.help || ''; wrap.classList.remove('is-invalid'); return; }
      var c = rexCompile(state.query, state.flags);
      state.valid = c.ok; state.error = c.ok ? null : c.error;
      wrap.classList.toggle('is-invalid', !c.ok);
      msg.textContent = c.ok
        ? (t('search.regexOn') + ': /' + state.query + '/' + state.flags)
        : (t('rex.invalid') + ': ' + c.error);
    }
    function notify() { if (opts.onChange) opts.onChange(api); }

    input.addEventListener('input', function () {
      state.query = input.value;
      if (state.mode === 'regex') state.pattern = input.value;
      validate(); notify();
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && input.value) { e.stopPropagation(); input.value = ''; state.query = ''; validate(); notify(); }
    });

    var api = {
      el: wrap,
      input: input,
      value: function () { return state.query; },
      setValue: function (v) { input.value = v === undefined || v === null ? '' : String(v); state.query = input.value; validate(); notify(); },
      mode: function () { return state.mode; },
      setMode: setMode,
      pattern: function () { return state.pattern; },
      flags: function () { return state.flags; },
      valid: function () { return state.valid; },
      error: function () { return state.error; },
      focus: function () { input.focus(); },
      /* One predicate for both the action and its inverse, so the two
         can never drift on casing, flags or Unicode handling. */
      matcher: function () {
        var q = state.query;
        if (!q) return function () { return true; };
        if (state.mode === 'regex') {
          var c = rexCompile(q, state.flags.replace(/g/g, ''));
          if (!c.ok) return function () { return false; };
          return function (text) { c.re.lastIndex = 0; return c.re.test(String(text === null || text === undefined ? '' : text)); };
        }
        var needle = q.toLowerCase();
        return function (text) { return String(text === null || text === undefined ? '' : text).toLowerCase().indexOf(needle) >= 0; };
      },
      test: function (text) { return api.matcher()(text); }
    };
    /* Silent, because callers overwhelmingly write
         var search = createSearchBar({ onChange: render });
       and `render` reads `search`. Firing onChange from inside the
       constructor runs that render before the assignment lands, so
       every one of them would throw on `search.matcher()` -- and it is
       not a change in any case: nothing has changed yet. */
    setMode(state.mode, true);
    return api;
  }

  /* ================================================================
   * 11. Menus, context menus and selects
   *
   * EVERY dropdown and EVERY context menu opens with a keyboard-
   * focusable filter field at its head and its own anchored regex
   * builder beside it. There is no exemption for a short menu: a
   * four-item menu grows to fourteen without anyone revisiting the
   * decision, and a visitor who has learned to type in one dropdown
   * and finds the next one inert has learned that the pattern is
   * unreliable, which is worse than never having had it.
   *
   * Filtering never reorders items, never changes what an item does,
   * and never hides a destructive item while leaving its shortcut
   * live. Escape clears the filter first, and closes only when the
   * filter is already empty.
   * ================================================================ */
  function normaliseItems(items) {
    return (items || []).map(function (it) {
      if (it === '-' || it === null) return { separator: true };
      return {
        id: it.id || uid('mi'),
        label: it.labelKey ? t(it.labelKey) : (it.label || ''),
        secondary: it.labelKey ? t2(it.labelKey) : (it.secondary || ''),
        shortcut: it.shortcut || null,
        icon: it.icon || null,
        danger: !!it.danger,
        disabled: !!it.disabled,
        disabledReason: it.disabledReason || null,
        checked: it.checked,
        keywords: it.keywords || '',
        run: it.run || null,
        separator: false
      };
    });
  }

  function openMenu(opts) {
    opts = opts || {};
    var items = normaliseItems(opts.items);
    var listId = uid('menulist');
    var menu = el('div', { class: 'menu', role: 'menu', 'aria-label': opts.ariaLabel || 'Menu' });
    var head = el('div', { class: 'menu__hd' });
    var scroll = el('div', { class: 'menu__scroll', id: listId });
    var count = el('div', { class: 'menu__count', role: 'status', 'aria-live': 'polite' });

    var search = createSearchBar({
      ariaLabel: opts.filterLabel || 'Filter menu items',
      placeholder: opts.filterLabel || 'Filter',
      storageKey: opts.storageKey ? 'menu.' + opts.storageKey : null,
      sampleProvider: function () { return items.map(function (i) { return i.label; }).join('\n'); },
      onChange: function () { render(); }
    });
    head.appendChild(search.el);
    menu.appendChild(head);
    menu.appendChild(count);
    menu.appendChild(scroll);

    var handle = openOverlay({
      anchor: opts.anchor,
      content: null,
      backdrop: true,
      className: 'wds-overlay--menu',
      placement: opts.placement || 'bottom',
      role: 'presentation',
      ariaLabel: opts.ariaLabel || 'Menu',
      trapFocus: false,
      returnTo: opts.returnTo || (opts.anchor && opts.anchor.focus ? opts.anchor : null),
      onClose: opts.onClose
    });
    /* The menu paints its own surface, so the generic overlay chrome
       steps out of the way rather than drawing a second card. */
    handle.el.classList.add('wds-overlay--bare');
    handle.el.style.background = 'transparent';
    handle.el.style.border = '0';
    handle.el.style.boxShadow = 'none';
    handle.el.style.padding = '0';
    clear(handle.el);
    handle.el.appendChild(menu);

    var rendered = [];
    function render() {
      clear(scroll);
      rendered = [];
      var match = search.matcher();
      var shown = 0;
      items.forEach(function (it) {
        if (it.separator) { scroll.appendChild(el('hr', { class: 'menu__sep' })); return; }
        var hay = it.label + ' ' + (it.secondary || '') + ' ' + it.keywords;
        if (!match(hay)) return;
        shown++;
        var row = el('button', {
          class: 'menu__i' + (it.danger ? ' menu__i--danger' : ''),
          type: 'button', role: 'menuitem', tabindex: '-1',
          'aria-disabled': it.disabled ? 'true' : null,
          title: it.disabled && it.disabledReason ? it.disabledReason : null,
          onclick: function () {
            if (it.disabled) {
              if (it.disabledReason) notify({ kind: 'info', body: it.disabledReason });
              return;
            }
            handle.close('activate');
            if (it.run) it.run();
          }
        });
        if (it.icon) row.appendChild(icon(it.icon));
        if (it.checked !== undefined) {
          row.setAttribute('role', 'menuitemcheckbox');
          row.setAttribute('aria-checked', it.checked ? 'true' : 'false');
          row.appendChild(el('span', { class: 'cbx' + (it.checked ? ' is-on' : ''), 'aria-hidden': 'true' }, icon('check')));
        }
        var lbl = el('span', { class: 'lbl', text: it.label });
        if (it.secondary) lbl.appendChild(el('span', { class: 'sec', text: ' ' + it.secondary }));
        row.appendChild(lbl);
        /* The shortcut that actually works in this context, derived
           from the same registration that binds it. */
        if (it.shortcut) {
          row.appendChild(el('kbd', { class: 'sc', text: it.shortcut, 'aria-hidden': 'true' }));
          row.setAttribute('aria-keyshortcuts', toAriaShortcut(it.shortcut));
        }
        if (it.disabled && it.disabledReason) {
          row.appendChild(el('span', { class: 'visually-hidden', text: ' — ' + it.disabledReason }));
        }
        scroll.appendChild(row);
        rendered.push(row);
      });
      if (!shown) scroll.appendChild(el('p', { class: 'menu__empty', text: t('msg.noMatch') }));
      count.textContent = shown + ' of ' + items.filter(function (i) { return !i.separator; }).length;
      handle.reposition();
    }

    menu.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (search.value()) { search.setValue(''); search.focus(); }
        else handle.close('escape');
        return;
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!rendered.length) return;
        var i = rendered.indexOf(document.activeElement);
        if (i < 0) { rendered[e.key === 'ArrowDown' ? 0 : rendered.length - 1].focus(); return; }
        var to = e.key === 'ArrowDown' ? (i + 1) % rendered.length : (i - 1 + rendered.length) % rendered.length;
        rendered[to].focus();
        return;
      }
      if (e.key === 'Home' && rendered.length) { e.preventDefault(); rendered[0].focus(); }
      if (e.key === 'End' && rendered.length) { e.preventDefault(); rendered[rendered.length - 1].focus(); }
    });

    render();
    window.setTimeout(function () { search.focus(); }, 0);
    return { close: function () { handle.close('programmatic'); }, refresh: render, handle: handle };
  }

  function toAriaShortcut(s) {
    return String(s).replace(/\s*\+\s*/g, '+').replace(/Ctrl/gi, 'Control').replace(/Esc/gi, 'Escape');
  }

  /* Attach a context menu to any element. Right-click, the context-menu
     key and Shift+F10 all reach it, because a menu only a mouse can
     open is a menu half the visitors do not have. */
  function attachContextMenu(target, provider, opts) {
    opts = opts || {};
    function open(e, anchor) {
      var items = typeof provider === 'function' ? provider(target, e) : provider;
      if (!items || !items.length) return;
      e.preventDefault();
      openMenu({
        items: items,
        anchor: anchor || { x: e.clientX, y: e.clientY },
        returnTo: target,
        ariaLabel: opts.ariaLabel || 'Context menu',
        storageKey: opts.storageKey
      });
    }
    target.addEventListener('contextmenu', function (e) { open(e, null); });
    target.addEventListener('keydown', function (e) {
      if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) open(e, target);
    });
    /* A phone has no right-click. A long press is the tap equivalent,
       and without it every context menu on this site would be
       unreachable on the device most visitors arrive with. */
    var pressTimer = null, moved = false;
    target.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'touch') return;
      moved = false;
      pressTimer = window.setTimeout(function () {
        if (moved) return;
        open({ preventDefault: function () {}, clientX: e.clientX, clientY: e.clientY }, null);
      }, 550);
    });
    target.addEventListener('pointermove', function () { moved = true; });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (n) {
      target.addEventListener(n, function () { if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; } });
    });
    return { open: open };
  }

  /* ================================================================
   * Site navigation, collapsed for a phone.
   *
   * Six of this site's seven pages ship a real, static <nav
   * class="site-nav"> full of plain <a href> links -- real
   * navigation that works with no script at all. Below 899px that
   * nav is hidden by CSS (site.css) because seven text links no
   * longer fit beside the brand and the action icons on one row.
   * This is what replaces it: one menu button, wired up once here
   * for every page rather than copied into each page's own inline
   * script, that reads the exact same links straight off the real
   * anchors and opens them as the same anchored, keyboard-operable,
   * dismissible menu every other menu on this site already uses.
   *
   * A page that ships no .site-nav-toggle (the landing page collapses
   * its own actions a different way already) costs this nothing --
   * the loop below simply finds no button and does nothing.
   * ================================================================ */
  function initSiteNav() {
    var toggles = document.querySelectorAll('.site-nav-toggle');
    for (var i = 0; i < toggles.length; i++) {
      (function (btn) {
        var navId = btn.getAttribute('aria-controls');
        var nav = navId ? document.getElementById(navId) : null;
        if (!nav) return;
        function label() { return t('nav.site', 'Site navigation'); }
        btn.setAttribute('aria-label', label());
        btn.title = label();
        on('i18n', function () {
          btn.setAttribute('aria-label', label());
          btn.title = label();
        });
        btn.addEventListener('click', function () {
          var links = nav.querySelectorAll('a[href]');
          var items = [];
          for (var j = 0; j < links.length; j++) {
            var a = links[j];
            items.push({
              label: (a.textContent || a.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim(),
              checked: a.hasAttribute('aria-current'),
              run: (function (href) { return function () { window.location.href = href; }; })(a.getAttribute('href'))
            });
          }
          btn.setAttribute('aria-expanded', 'true');
          openMenu({
            anchor: btn, returnTo: btn, ariaLabel: label(),
            filterLabel: t('nav.filter', 'Filter pages'), storageKey: 'site-nav',
            onClose: function () { btn.setAttribute('aria-expanded', 'false'); },
            items: items
          });
        });
      })(toggles[i]);
    }
  }

  /* ================================================================
   * Action-icon overflow, for a phone.
   *
   * Several pages register five or six icon buttons in the app bar
   * -- search, language, theme, notifications, command palette, edit
   * appearance. At a desktop width that is an ordinary top app bar;
   * once the site-nav toggle above also has to fit beside the brand
   * on a 360px phone, six 48px targets plus a toggle simply do not
   * fit, and without this something else gave: the brand's own
   * min-width: 0 (needed so IT can shrink instead of squeezing a
   * neighbour) let it shrink all the way to nothing, so the page's
   * own title silently vanished.
   *
   * This keeps only the first action visible -- search, the one
   * thing every page here actually differs on -- and folds
   * everything after that into one "More" menu button that
   * calls .click() on each real hidden button rather than
   * reimplementing what any of it does. Only pages that ship the
   * site-nav toggle get this at all: the landing page has its own,
   * already-compact action set and was never the problem.
   *
   * It runs off a MutationObserver rather than a one-time scan at
   * boot, because every page that has one rebuilds #appbar-actions
   * from scratch on its own i18n and School-mode events -- a watcher
   * that is not there when that happens goes stale immediately. */
  function initActionOverflow() {
    if (!document.querySelector('.site-nav-toggle')) return;
    var host = document.getElementById('appbar-actions');
    if (!host) return;
    var KEEP = 1;
    var mq = window.matchMedia('(max-width: 899px)');
    var moreBtn = null;
    var observer = new MutationObserver(function () { apply(); });
    function apply() {
      observer.disconnect();
      var real = Array.prototype.filter.call(host.children, function (n) {
        return !n.hasAttribute('data-overflow-more');
      });
      real.forEach(function (n) { n.style.display = ''; });
      if (moreBtn && moreBtn.parentNode) moreBtn.parentNode.removeChild(moreBtn);
      moreBtn = null;
      if (mq.matches && real.length > KEEP) {
        var hidden = real.slice(KEEP);
        hidden.forEach(function (n) { n.style.display = 'none'; });
        moreBtn = el('button', {
          class: 'btn btn--icon', type: 'button', 'data-overflow-more': '',
          'aria-haspopup': 'menu', 'aria-label': t('act.more', 'More'), title: t('act.more', 'More'),
          onclick: function () {
            openMenu({
              anchor: moreBtn, returnTo: moreBtn, ariaLabel: t('act.more', 'More'),
              filterLabel: t('nav.filter', 'Filter pages'),
              items: hidden.map(function (n) {
                return {
                  label: n.getAttribute('aria-label') || n.title || t('act.more', 'More'),
                  run: function () { n.click(); }
                };
              })
            });
          }
        }, icon('more'));
        host.appendChild(moreBtn);
      }
      observer.observe(host, { childList: true });
    }
    if (mq.addEventListener) mq.addEventListener('change', apply); else mq.addListener(apply);
    apply();
  }

  /* A select is a menu button plus the same filtered menu, so a select
     and a context menu cannot diverge on filtering or keyboard rules. */
  function createSelect(opts) {
    opts = opts || {};
    var options = (opts.options || []).slice();
    var value = opts.value !== undefined ? opts.value : (options[0] && options[0].value);
    var id = uid('sel');
    var labelNode = opts.label ? el('label', { class: 'field__label', for: id, text: opts.label }) : null;
    var valueNode = el('span', { class: 'lbl' });
    var button = el('button', {
      class: 'btn btn--outlined', type: 'button', id: id,
      'aria-haspopup': 'listbox', 'aria-expanded': 'false',
      'aria-label': opts.ariaLabel || opts.label || 'Choose an option',
      style: { 'justify-content': 'space-between', 'min-width': '160px' },
      onclick: function () { openList(); }
    }, [valueNode, icon('chevronDown')]);
    var help = opts.help ? el('p', { class: 'field__help', text: opts.help }) : null;
    var wrap = el('div', { class: 'field field--outlined' + (opts.className ? ' ' + opts.className : '') },
      [labelNode, el('div', { class: 'field__box', style: { 'min-height': 'auto', padding: '0' } }, button), help].filter(Boolean));

    function currentOption() {
      return options.filter(function (o) { return o.value === value; })[0] || null;
    }
    function paint() {
      var o = currentOption();
      valueNode.textContent = o ? o.label : (opts.placeholder || 'Choose');
      button.setAttribute('aria-label', (opts.ariaLabel || opts.label || 'Choose an option') + ': ' + valueNode.textContent);
    }
    function openList() {
      button.setAttribute('aria-expanded', 'true');
      openMenu({
        anchor: button,
        returnTo: button,
        ariaLabel: opts.label || 'Options',
        filterLabel: 'Filter options',
        storageKey: opts.storageKey ? 'select.' + opts.storageKey : null,
        onClose: function () { button.setAttribute('aria-expanded', 'false'); },
        items: options.map(function (o) {
          return {
            label: o.label, keywords: o.keywords || '', checked: o.value === value,
            disabled: !!o.disabled, disabledReason: o.disabledReason,
            run: function () { api.setValue(o.value); }
          };
        })
      });
    }
    var api = {
      el: wrap, button: button,
      value: function () { return value; },
      setValue: function (v) {
        value = v; paint();
        if (opts.onChange) opts.onChange(v, currentOption());
      },
      setOptions: function (list) { options = list.slice(); paint(); },
      options: function () { return options.slice(); },
      focus: function () { button.focus(); }
    };
    paint();
    return api;
  }

  function copyText(text) {
    var done = function (ok) {
      notify({ kind: ok ? 'success' : 'error', body: ok ? t('act.copied') : 'The clipboard refused. Select the text and copy it by hand.' });
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
      return;
    }
    try {
      var ta = el('textarea', { style: { position: 'fixed', top: '-1000px' } });
      ta.value = text; document.body.appendChild(ta); ta.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      done(ok);
    } catch (e) { done(false); }
  }
  function downloadText(filename, text, mime) {
    var blob = new Blob([text], { type: (mime || 'text/plain') + ';charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = el('a', { href: url, download: filename, style: { display: 'none' } });
    document.body.appendChild(a); a.click();
    window.setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 0);
  }

  /* ================================================================
   * 12. Theme and appearance state
   *
   * A seed colour writes a <style> element rather than inline custom
   * properties, because inline properties on the root cannot be made
   * conditional on prefers-color-scheme. The generated stylesheet
   * repeats the exact structure of tokens.css -- bare :root for light,
   * the guarded media query, and both explicit [data-theme] blocks --
   * so a generated palette can never leave a token defined only in a
   * dark block.
   * ================================================================ */
  var FONT_STACKS = [
    { id: 'system', label: 'System default', stack: 'system-ui, -apple-system, "Segoe UI Variable Text", "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", "Noto Sans CJK HK", "Microsoft JhengHei", sans-serif', probe: null },
    { id: 'segoe', label: 'Segoe UI', stack: '"Segoe UI", "Noto Sans CJK HK", "Microsoft JhengHei", sans-serif', probe: 'Segoe UI' },
    { id: 'inter', label: 'Inter', stack: 'Inter, "Noto Sans CJK HK", "Microsoft JhengHei", sans-serif', probe: 'Inter' },
    { id: 'roboto', label: 'Roboto', stack: 'Roboto, "Noto Sans CJK HK", "Microsoft JhengHei", sans-serif', probe: 'Roboto' },
    { id: 'helvetica', label: 'Helvetica Neue', stack: '"Helvetica Neue", Helvetica, "Noto Sans CJK HK", sans-serif', probe: 'Helvetica Neue' },
    { id: 'georgia', label: 'Georgia', stack: 'Georgia, "Noto Serif CJK HK", "Times New Roman", serif', probe: 'Georgia' },
    { id: 'jhenghei', label: 'Microsoft JhengHei', stack: '"Microsoft JhengHei", "Noto Sans CJK HK", sans-serif', probe: 'Microsoft JhengHei' },
    { id: 'notocjk', label: 'Noto Sans CJK HK', stack: '"Noto Sans CJK HK", "Noto Sans", sans-serif', probe: 'Noto Sans CJK HK' },
    { id: 'mono', label: 'Monospace', stack: 'ui-monospace, "Cascadia Mono", Consolas, "Noto Sans Mono", monospace', probe: 'Consolas' }
  ];
  /* Real availability detection: render a string in the candidate and
     compare its width against three generic fallbacks. There is no way
     to enumerate installed fonts without a permission-gated API that
     only one engine ships, so the picker measures rather than guesses,
     and says plainly which families this machine actually has. */
  function fontAvailable(name) {
    if (!name) return true;
    var test = 'mmmmmmmmmmlliWWWW漢字廣東話';
    var size = '72px';
    var canvas = fontAvailable._c || (fontAvailable._c = document.createElement('canvas'));
    var ctx = canvas.getContext && canvas.getContext('2d');
    if (!ctx) return true;
    var base = ['monospace', 'sans-serif', 'serif'], i, w0, w1;
    for (i = 0; i < base.length; i++) {
      ctx.font = size + ' ' + base[i];
      w0 = ctx.measureText(test).width;
      ctx.font = size + ' "' + name + '", ' + base[i];
      w1 = ctx.measureText(test).width;
      if (Math.abs(w0 - w1) > 0.5) return true;
    }
    return false;
  }

  var TYPESCALE_KEYS = [
    ['display-large', 57, 64], ['display-medium', 45, 52], ['display-small', 36, 44],
    ['headline-large', 32, 40], ['headline-medium', 28, 36], ['headline-small', 24, 32],
    ['title-large', 22, 28], ['title-medium', 16, 24], ['title-small', 14, 20],
    ['body-large', 16, 24], ['body-medium', 14, 20], ['body-small', 12, 16],
    ['label-large', 14, 20], ['label-medium', 12, 16], ['label-small', 11, 16]
  ];

  var themeState = {
    mode: store.get('theme.mode', 'system'),
    density: store.get('theme.density', 'comfortable'),
    seed: store.get('theme.seed', null),
    font: store.get('theme.font', 'system'),
    fontCustom: store.get('theme.fontCustom', ''),
    fontScale: parseFloat(store.get('theme.fontScale', 1)) || 1,
    fontWeight: store.get('theme.fontWeight', 'normal'),
    motion: store.get('theme.motion', 'system')
  };

  function seedStyleElement() {
    var node = document.getElementById('wds-seed-style');
    if (!node) {
      node = el('style', { id: 'wds-seed-style' });
      document.head.appendChild(node);
    }
    return node;
  }
  function rolesToCss(roles) {
    return Object.keys(roles).map(function (k) { return '  --md-sys-color-' + k + ': ' + roles[k] + ';'; }).join('\n');
  }
  function applySeed() {
    var node = seedStyleElement();
    if (!themeState.seed) { node.textContent = ''; return; }
    var p = palettesFromSeed(themeState.seed);
    if (!p) { node.textContent = ''; return; }
    var light = rolesFromPalettes(p, false), dark = rolesFromPalettes(p, true);
    node.textContent =
      '/* Generated from the seed colour ' + p.seed + '. Structure matches tokens.css exactly. */\n' +
      ':root {\n' + rolesToCss(light) + '\n}\n' +
      '@media (prefers-color-scheme: dark) {\n  :root:not([data-theme="light"]) {\n' + rolesToCss(dark) + '\n  }\n}\n' +
      ':root[data-theme="dark"] {\n' + rolesToCss(dark) + '\n}\n' +
      ':root[data-theme="light"] {\n' + rolesToCss(light) + '\n}\n';
  }
  function currentFontStack() {
    if (themeState.font === 'custom' && themeState.fontCustom) {
      return themeState.fontCustom + ', "Noto Sans CJK HK", "Microsoft JhengHei", sans-serif';
    }
    var f = FONT_STACKS.filter(function (x) { return x.id === themeState.font; })[0] || FONT_STACKS[0];
    return f.stack;
  }
  function applyTypography() {
    var root = document.documentElement.style;
    root.setProperty('--md-sys-typeface-plain', currentFontStack());
    var scale = clamp(themeState.fontScale, 0.8, 1.6);
    TYPESCALE_KEYS.forEach(function (k) {
      root.setProperty('--md-sys-typescale-' + k[0] + '-size', Math.round(k[1] * scale) + 'px');
      root.setProperty('--md-sys-typescale-' + k[0] + '-line-height', Math.round(k[2] * scale) + 'px');
    });
    if (themeState.fontWeight === 'bold') {
      ['title-medium', 'title-small', 'label-large', 'label-medium', 'label-small'].forEach(function (k) {
        root.setProperty('--md-sys-typescale-' + k + '-weight', '700');
      });
      ['body-large', 'body-medium', 'body-small'].forEach(function (k) {
        root.setProperty('--md-sys-typescale-' + k + '-weight', '500');
      });
    } else {
      TYPESCALE_KEYS.forEach(function (k) { root.removeProperty('--md-sys-typescale-' + k[0] + '-weight'); });
    }
  }
  function applyTheme() {
    var html = document.documentElement;
    if (themeState.mode === 'light' || themeState.mode === 'dark') html.setAttribute('data-theme', themeState.mode);
    else html.removeAttribute('data-theme');
    html.setAttribute('data-density', themeState.density);
    if (themeState.motion === 'reduced') html.setAttribute('data-motion', 'reduced');
    else html.removeAttribute('data-motion');
    applySeed();
    applyTypography();
    emit('theme', themeState);
  }

  var theme = {
    fonts: function () {
      return FONT_STACKS.map(function (f) {
        return { id: f.id, label: f.label, stack: f.stack, available: f.probe === null ? true : fontAvailable(f.probe) };
      });
    },
    mode: function () { return themeState.mode; },
    effectiveMode: function () {
      if (themeState.mode !== 'system') return themeState.mode;
      return (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
    },
    setMode: function (m) {
      if (['light', 'dark', 'system'].indexOf(m) < 0) return false;
      themeState.mode = m; store.set('theme.mode', m); applyTheme();
      history.record('settings', 'Theme set to ' + m, { 'theme.mode': m });
      return true;
    },
    density: function () { return themeState.density; },
    setDensity: function (d) {
      if (['comfortable', 'compact', 'dense'].indexOf(d) < 0) return false;
      themeState.density = d; store.set('theme.density', d); applyTheme();
      history.record('settings', 'Density set to ' + d, { 'theme.density': d });
      return true;
    },
    seed: function () { return themeState.seed; },
    seedDefault: '#0F7A3D',
    setSeed: function (colour) {
      if (colour === null || colour === '') {
        themeState.seed = null; store.remove('theme.seed'); applyTheme();
        history.record('settings', 'Accent colour reset to the shipped palette', { 'theme.seed': null });
        return true;
      }
      var c = parseColor(colour);
      if (!c) return false;
      themeState.seed = toHexString(c.rgb);
      store.set('theme.seed', themeState.seed); applyTheme();
      history.record('settings', 'Accent colour set to ' + themeState.seed, { 'theme.seed': themeState.seed });
      return true;
    },
    palettes: function (seed) { return palettesFromSeed(seed || themeState.seed || theme.seedDefault); },
    roles: function (seed, dark) { return rolesFromPalettes(palettesFromSeed(seed || themeState.seed || theme.seedDefault), dark); },
    font: function () { return themeState.font; },
    customFont: function () { return themeState.fontCustom; },
    setFont: function (id, custom) {
      themeState.font = id;
      if (id === 'custom') { themeState.fontCustom = String(custom || ''); store.set('theme.fontCustom', themeState.fontCustom); }
      store.set('theme.font', id); applyTheme();
      history.record('settings', 'Interface font set to ' + (id === 'custom' ? themeState.fontCustom : id), { 'theme.font': id });
      return true;
    },
    fontScale: function () { return themeState.fontScale; },
    setFontScale: function (n) {
      themeState.fontScale = clamp(parseFloat(n) || 1, 0.8, 1.6);
      store.set('theme.fontScale', themeState.fontScale); applyTheme();
      return true;
    },
    fontWeight: function () { return themeState.fontWeight; },
    setFontWeight: function (w) {
      themeState.fontWeight = w === 'bold' ? 'bold' : 'normal';
      store.set('theme.fontWeight', themeState.fontWeight); applyTheme();
      return true;
    },
    motion: function () { return themeState.motion; },
    setMotion: function (m) {
      themeState.motion = m === 'reduced' ? 'reduced' : 'system';
      store.set('theme.motion', themeState.motion); applyTheme();
      return true;
    },
    reset: function () {
      ['theme.mode', 'theme.density', 'theme.seed', 'theme.font', 'theme.fontCustom', 'theme.fontScale', 'theme.fontWeight', 'theme.motion']
        .forEach(function (k) { store.remove(k); });
      themeState = { mode: 'system', density: 'comfortable', seed: null, font: 'system', fontCustom: '', fontScale: 1, fontWeight: 'normal', motion: 'system' };
      applyTheme();
      history.record('settings', 'Every appearance setting reset to the shipped default', {});
    },
    exportTheme: function () {
      return {
        schemaVersion: 1, kind: 'world-downloader-studio-theme', exportedAt: nowIso(),
        theme: {
          mode: themeState.mode, density: themeState.density, seed: themeState.seed,
          font: themeState.font, fontCustom: themeState.fontCustom, fontScale: themeState.fontScale,
          fontWeight: themeState.fontWeight, motion: themeState.motion
        },
        elements: store.get('appearance.elements', {})
      };
    },
    importTheme: function (data) {
      if (!data || data.kind !== 'world-downloader-studio-theme') {
        return { ok: false, error: 'That file is not a World Downloader Studio theme.' };
      }
      if (data.schemaVersion !== 1) return { ok: false, error: 'This theme uses schema version ' + data.schemaVersion + '. This site reads version 1.' };
      var th = data.theme || {};
      if (th.mode) theme.setMode(th.mode);
      if (th.density) theme.setDensity(th.density);
      theme.setSeed(th.seed || null);
      if (th.font) theme.setFont(th.font, th.fontCustom);
      if (th.fontScale) theme.setFontScale(th.fontScale);
      if (th.fontWeight) theme.setFontWeight(th.fontWeight);
      if (th.motion) theme.setMotion(th.motion);
      if (data.elements && typeof data.elements === 'object') {
        store.set('appearance.elements', data.elements);
        appearance.applyAll();
      }
      history.record('settings', 'Theme imported from a file', {});
      return { ok: true };
    }
  };

  /* ================================================================
   * 13. Notifications
   *
   * Anything that only informs is a corner-anchored toast that never
   * blocks the page. Errors and warnings stay until dismissed, because
   * an error that auto-dismisses is an error the reader may never have
   * seen. Modal dialogs are reserved for a decision the visitor must
   * make before continuing.
   * ================================================================ */
  var toastLayer = null;
  var notificationLog = store.get('notifications.log', []);
  var NOTIFY_LOG_CAP = 200;

  function ensureToastLayer() {
    if (toastLayer && document.body.contains(toastLayer)) return toastLayer;
    toastLayer = el('div', {
      class: 'wds-toasts',
      'data-corner': store.get('notifications.corner', 'bottom-end'),
      role: 'region', 'aria-label': t('notify.centre')
    });
    document.body.appendChild(toastLayer);
    return toastLayer;
  }

  function notify(opts) {
    opts = opts || {};
    var kind = opts.kind || 'info';
    var persist = opts.persist !== undefined ? opts.persist : (kind === 'error' || kind === 'warn');
    var record = {
      id: uid('n'), kind: kind, title: opts.title || '', body: opts.body || '',
      at: nowIso(), read: false
    };
    notificationLog.unshift(record);
    if (notificationLog.length > NOTIFY_LOG_CAP) notificationLog.length = NOTIFY_LOG_CAP;
    store.set('notifications.log', notificationLog);

    var layer = ensureToastLayer();
    var msg = el('div', { class: 'msg' });
    var deco = emojiFor(kind);
    if (record.title) msg.appendChild(el('b', { text: (deco ? deco + ' ' : '') + record.title }));
    if (record.body) msg.appendChild(document.createTextNode(record.body));
    else if (!record.title) msg.appendChild(document.createTextNode(deco ? deco + ' ' : ''));

    var toast = el('div', {
      class: 'snack snack--' + kind + ' wds-toast-enter',
      role: kind === 'error' ? 'alert' : 'status',
      'aria-live': kind === 'error' ? 'assertive' : 'polite'
    }, msg);

    (opts.actions || []).forEach(function (a) {
      toast.appendChild(el(a.href ? 'a' : 'button', {
        class: 'act', type: a.href ? null : 'button', href: a.href || null,
        target: a.href ? '_self' : null,
        text: a.label,
        onclick: function () { if (a.run) a.run(); if (a.dismiss !== false) close(); }
      }));
    });
    toast.appendChild(el('button', {
      class: 'act', type: 'button', 'aria-label': t('act.dismiss'),
      onclick: function () { close(); }
    }, icon('close')));

    layer.appendChild(toast);
    var timer = null;
    function close() {
      if (timer) clearTimeout(timer);
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }
    if (!persist) {
      var ms = opts.timeout || (kind === 'success' ? 4000 : 6000);
      timer = window.setTimeout(close, ms);
      toast.addEventListener('pointerenter', function () { if (timer) { clearTimeout(timer); timer = null; } });
      toast.addEventListener('focusin', function () { if (timer) { clearTimeout(timer); timer = null; } });
    }
    emit('notify', record);
    return { id: record.id, close: close, element: toast };
  }
  notify.info = function (body, o) { return notify(Object.assign({ kind: 'info', body: body }, o || {})); };
  notify.success = function (body, o) { return notify(Object.assign({ kind: 'success', body: body }, o || {})); };
  notify.warn = function (body, o) { return notify(Object.assign({ kind: 'warn', body: body }, o || {})); };
  notify.error = function (body, o) { return notify(Object.assign({ kind: 'error', body: body }, o || {})); };

  var notifications = {
    all: function () { return notificationLog.slice(); },
    corner: function () { return store.get('notifications.corner', 'bottom-end'); },
    setCorner: function (c) {
      if (['bottom-end', 'bottom-start', 'top-end', 'top-start'].indexOf(c) < 0) return false;
      store.set('notifications.corner', c);
      ensureToastLayer().setAttribute('data-corner', c);
      return true;
    },
    dismiss: function (ids) {
      var set = Array.isArray(ids) ? ids : [ids];
      notificationLog = notificationLog.filter(function (n) { return set.indexOf(n.id) < 0; });
      store.set('notifications.log', notificationLog);
      emit('notify', null);
      return set.length;
    },
    markRead: function (ids) {
      var set = Array.isArray(ids) ? ids : [ids];
      notificationLog.forEach(function (n) { if (set.indexOf(n.id) >= 0) n.read = true; });
      store.set('notifications.log', notificationLog);
      return set.length;
    },
    clearAll: function () {
      var n = notificationLog.length;
      notificationLog = []; store.set('notifications.log', notificationLog);
      emit('notify', null);
      return n;
    },
    /* The centre is a list, so it gets the full bulk contract: it is
       not exempt for being "just a log". */
    open: function (anchor) {
      var body = el('div', { class: 'stack' });
      var listWrap = el('div');
      var search = createSearchBar({
        ariaLabel: 'Search notifications', placeholder: t('act.search'),
        storageKey: 'notifications', onChange: function () { render(); }
      });
      var kindSelect = createSelect({
        label: t('act.filter'), storageKey: 'notifications-kind',
        options: [{ value: 'all', label: 'Every kind' }, { value: 'info', label: 'Information' },
          { value: 'success', label: 'Success' }, { value: 'warn', label: 'Warning' }, { value: 'error', label: 'Error' }],
        value: 'all', onChange: function () { render(); }
      });
      body.appendChild(search.el);
      body.appendChild(kindSelect.el);
      body.appendChild(listWrap);

      var bulkCtl = null;
      function visible() {
        var m = search.matcher(), k = kindSelect.value();
        return notificationLog.filter(function (n) {
          if (k !== 'all' && n.kind !== k) return false;
          return m(n.title + ' ' + n.body + ' ' + n.kind);
        });
      }
      function render() {
        clear(listWrap);
        var rows = visible();
        if (!rows.length) { listWrap.appendChild(el('p', { class: 'muted', text: t('notify.none') })); return; }
        var ul = el('ul', { class: 'list' });
        rows.forEach(function (n) {
          ul.appendChild(el('li', { class: 'li', 'data-bulk-item': '', 'data-id': n.id }, [
            el('span', { class: 'status status--' + (n.kind === 'error' ? 'error' : n.kind === 'warn' ? 'warn' : n.kind === 'success' ? 'ok' : ''), text: n.kind }),
            el('span', { class: 'li__t' }, [
              el('span', { class: 'li__h', text: n.title || n.body || '(no text)' }),
              el('span', { class: 'li__s', text: (n.title && n.body ? n.body + ' — ' : '') + new Date(n.at).toLocaleString() })
            ])
          ]));
        });
        listWrap.appendChild(ul);
        if (bulkCtl) bulkCtl.destroy();
        bulkCtl = bulk.attach(ul, {
          scopeLabelPage: 'this page', scopeLabelAll: 'every match',
          allMatchingCount: function () { return visible().length; },
          allMatchingIds: function () { return visible().map(function (n) { return n.id; }); },
          getLabel: function (id) { var n = notificationLog.filter(function (x) { return x.id === id; })[0]; return n ? (n.title || n.body) : id; },
          actions: [
            { id: 'read', label: 'Mark as read', run: function (ids) { notifications.markRead(ids); render(); } },
            { id: 'dismiss', label: t('act.dismiss'), run: function (ids) { notifications.dismiss(ids); render(); } },
            { id: 'export', label: t('act.export'), run: function (ids) {
              var rows = notificationLog.filter(function (n) { return ids.indexOf(n.id) >= 0; });
              exportDialog(rows, { name: 'notifications', anchor: anchor });
            } },
            { id: 'delete', label: t('act.delete'), danger: true, destructive: true, run: function (ids) { notifications.dismiss(ids); render(); } }
          ]
        });
      }
      render();
      return openOverlay({
        anchor: anchor, title: t('notify.centre'), content: body,
        resizable: true, draggable: true, persistKey: 'notification-centre',
        returnTo: anchor
      });
    }
  };

  /* ================================================================
   * 14. Destructive-action super confirmation
   *
   * Two independent keys, then a slider that only wakes once both are
   * turned, a progress animation while it travels, a completion
   * animation, and an emergency exit that is always available. The
   * facts stay exact at every language mode and every funny level: the
   * dialog names the action, the target, and what becomes irreversible
   * in words no level is allowed to soften.
   * ================================================================ */
  function confirmDestructive(opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var settled = false;
      function finish(v) { if (settled) return; settled = true; handle.close(v ? 'confirmed' : 'cancelled'); resolve(v); }

      var facts = el('dl');
      var factRows = [
        { k: 'Action', v: opts.action || 'Delete' },
        { k: 'Affects', v: opts.target || 'the selected item' }
      ].concat(opts.facts || []);
      factRows.forEach(function (f) {
        facts.appendChild(el('dt', { text: f.k || f.label }));
        facts.appendChild(el('dd', { text: String(f.v === undefined ? f.value : f.v) }));
      });
      if (opts.irreversible !== false) {
        facts.appendChild(el('dt', { text: 'Reversible' }));
        facts.appendChild(el('dd', { text: 'No. Once this finishes, it cannot be undone from here.' }));
      }

      var gate = el('div', { class: 'wds-gate' });
      var deco = emojiFor('warn');
      gate.appendChild(el('div', { class: 'wds-gate__facts' }, [
        el('p', { class: 't-title-small', text: (deco ? deco + ' ' : '') + (opts.title || t('confirm.title')) }),
        facts
      ]));
      if (opts.detail) gate.appendChild(el('p', { text: opts.detail }));

      var keys = { a: false, b: false };
      function keyControl(which, labelKey) {
        var id = uid('gk');
        var sw = el('button', {
          class: 'switch', type: 'button', role: 'switch', 'aria-checked': 'false',
          id: id, 'aria-describedby': hintId,
          onclick: function () {
            keys[which] = !keys[which];
            sw.setAttribute('aria-checked', keys[which] ? 'true' : 'false');
            sw.classList.toggle('is-on', keys[which]);
            syncArm();
          }
        }, el('span', { class: 'switch__track' }, el('span', { class: 'knob' })));
        return el('div', { class: 'wds-gate__key' }, [
          el('label', { class: 'ctl', for: id }, [sw, el('span', { text: t(labelKey) })])
        ]);
      }
      var hintId = uid('gh');
      var hint = el('p', { class: 'muted t-body-small', id: hintId, text: t('confirm.needKeys') });
      gate.appendChild(el('div', { class: 'wds-gate__keys' }, [keyControl('a', 'confirm.key1'), keyControl('b', 'confirm.key2')]));
      gate.appendChild(hint);

      var range = el('input', {
        type: 'range', min: '0', max: '100', value: '0', step: '1',
        'aria-label': t('confirm.slide'), disabled: true
      });
      var progress = el('div', { class: 'prog' }, el('div', { class: 'prog__bar' }));
      var sliderWrap = el('div', { class: 'slider wds-gate__slider' }, [
        el('span', { class: 'cap', text: t('confirm.slide') }),
        el('div', { class: 'slider__row' }, [range, el('span', { class: 'slider__value', text: '0%' })]),
        progress
      ]);
      gate.appendChild(sliderWrap);

      function syncArm() {
        var armed = keys.a && keys.b;
        gate.classList.toggle('is-armed', armed);
        range.disabled = !armed;
        hint.textContent = armed ? t('confirm.slide') : t('confirm.needKeys');
        if (!armed) { range.value = '0'; paintRange(); }
      }
      function paintRange() {
        var v = parseInt(range.value, 10) || 0;
        sliderWrap.querySelector('.slider__value').textContent = v + '%';
        progress.querySelector('.prog__bar').style.width = v + '%';
      }
      range.addEventListener('input', function () {
        paintRange();
        if (parseInt(range.value, 10) >= 100) complete();
      });
      /* Sliding back below the top disarms nothing: reaching 100 is
         the commitment, and it happens once. */
      function complete() {
        range.disabled = true;
        clear(gate);
        gate.appendChild(el('div', { class: 'wds-gate__done' }, icon('success', 'i--lg')));
        gate.appendChild(el('p', { class: 't-title-medium', text: t('confirm.done') }));
        a11y.announce(t('confirm.done'), true);
        window.setTimeout(function () { finish(true); }, a11y.reducedMotion() ? 60 : 700);
      }

      var handle = openOverlay({
        title: opts.title || t('confirm.title'),
        content: gate,
        modal: true, dim: true, sheet: false,
        anchor: opts.anchor || null,
        placement: 'bottom',
        returnTo: opts.returnTo || opts.anchor,
        onClose: function (reason) { if (!settled) { settled = true; resolve(false); } },
        footer: [
          el('button', {
            class: 'btn btn--outlined', type: 'button', text: t('act.emergencyExit'),
            onclick: function () { finish(false); }
          }),
          el('button', { class: 'btn btn--text', type: 'button', text: t('act.cancel'), onclick: function () { finish(false); } })
        ]
      });
      syncArm();
    });
  }

  /* ================================================================
   * 15. Collapsible filter rows and statistics panels
   *
   * Descriptive panels start collapsed, because a view whose controls
   * take more room than its content has buried the content. A row that
   * is currently excluding results says so on its own header rather
   * than leaving the visitor to conclude the data is missing.
   * ================================================================ */
  var collapse = {
    attach: function (host, opts) {
      opts = opts || {};
      var key = opts.storageKey ? 'collapse.' + opts.storageKey : null;
      var startOpen = opts.startCollapsed === undefined
        ? (opts.descriptive ? false : true)
        : !opts.startCollapsed;
      var open = key ? store.get(key, startOpen) : startOpen;
      var bodyId = uid('cb');
      var chev = icon('chevronRight', 'wds-collapse__chev');
      var activeBadge = el('span', { class: 'wds-collapse__active', hidden: true });
      var head = el('button', {
        class: 'wds-collapse__head', type: 'button',
        'aria-expanded': open ? 'true' : 'false', 'aria-controls': bodyId,
        onclick: function () { api.toggle(); }
      }, [chev, el('span', { style: { flex: '1' }, text: opts.title || 'Options' }), activeBadge]);
      var body = el('div', { class: 'wds-collapse__body', id: bodyId });
      var wrap = el('div', { class: 'wds-collapse', 'data-open': open ? 'true' : 'false' }, [head, body]);
      while (host.firstChild) body.appendChild(host.firstChild);
      host.appendChild(wrap);

      var api = {
        el: wrap, body: body,
        open: function () { api.set(true); },
        close: function () { api.set(false); },
        toggle: function () { api.set(wrap.dataset.open !== 'true'); },
        set: function (v) {
          wrap.dataset.open = v ? 'true' : 'false';
          head.setAttribute('aria-expanded', v ? 'true' : 'false');
          if (key) store.set(key, !!v);
        },
        isOpen: function () { return wrap.dataset.open === 'true'; },
        /* Say when a collapsed row is currently excluding results. */
        setActiveSummary: function (text) {
          if (text) { activeBadge.textContent = text; activeBadge.hidden = false; }
          else { activeBadge.textContent = ''; activeBadge.hidden = true; }
        }
      };
      return api;
    }
  };

  /* ================================================================
   * 16. Bulk actions
   *
   * Every list, table and grid gets this. Multi-select with shift
   * ranges, a keyboard equivalent, an honestly-scoped select-all that
   * distinguishes "this page" from "every match", inverse selection,
   * and the full action set rather than a token subset. Nothing runs
   * without an exact count and a reviewable preview.
   * ================================================================ */
  var bulk = {
    attach: function (container, opts) {
      opts = opts || {};
      var itemSelector = opts.itemSelector || '[data-bulk-item]';
      var selected = Object.create(null);
      var lastIndex = -1;

      function items() { return Array.prototype.slice.call(container.querySelectorAll(itemSelector)); }
      function idOf(node) { return node.getAttribute('data-id') || ''; }
      function selectedIds() { return Object.keys(selected).filter(function (k) { return selected[k]; }); }

      var countNode = el('span', { class: 'wds-bulkbar__count', role: 'status', 'aria-live': 'polite' });
      var scopeNote = el('span', { class: 'muted t-body-small' });
      var bar = el('div', { class: 'wds-bulkbar', hidden: true, role: 'group', 'aria-label': 'Actions for the selected items' });

      function paint() {
        var ids = selectedIds();
        items().forEach(function (n) {
          var on = !!selected[idOf(n)];
          n.classList.toggle('is-sel', on);
          n.setAttribute('aria-selected', on ? 'true' : 'false');
          var box = n.querySelector('[data-bulk-check]');
          if (box) { box.classList.toggle('is-on', on); box.setAttribute('aria-checked', on ? 'true' : 'false'); }
        });
        bar.hidden = ids.length === 0;
        countNode.textContent = ids.length + ' selected';
        var total = opts.allMatchingCount ? opts.allMatchingCount() : items().length;
        scopeNote.textContent = ids.length === items().length && total > items().length
          ? ('All ' + items().length + ' on this page are selected. ' + total + ' match the current filter.')
          : '';
      }

      function toggle(node, additive, range) {
        var list = items(), i = list.indexOf(node), id = idOf(node);
        if (range && lastIndex >= 0) {
          var lo = Math.min(lastIndex, i), hi = Math.max(lastIndex, i);
          for (var k = lo; k <= hi; k++) selected[idOf(list[k])] = true;
        } else if (additive) {
          selected[id] = !selected[id];
        } else {
          var only = !selected[id] || selectedIds().length > 1;
          Object.keys(selected).forEach(function (x) { delete selected[x]; });
          if (only) selected[id] = true;
        }
        lastIndex = i;
        paint();
      }

      function onClick(e) {
        var node = e.target.closest(itemSelector);
        if (!node || !container.contains(node)) return;
        if (e.target.closest('button,a,input,select,textarea')) return;
        toggle(node, e.ctrlKey || e.metaKey, e.shiftKey);
      }
      function onKey(e) {
        var node = e.target.closest ? e.target.closest(itemSelector) : null;
        if (!node) return;
        if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(node, true, e.shiftKey); }
        else if (e.key === 'a' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); api.selectPage(); }
      }
      container.addEventListener('click', onClick);
      container.addEventListener('keydown', onKey);
      items().forEach(function (n) { if (!n.hasAttribute('tabindex')) n.tabIndex = 0; });

      bar.appendChild(countNode);
      bar.appendChild(el('button', {
        class: 'btn btn--text', type: 'button', text: t('act.selectAll') + ' on this page',
        onclick: function () { api.selectPage(); }
      }));
      if (opts.allMatchingIds) {
        bar.appendChild(el('button', {
          class: 'btn btn--text', type: 'button', text: t('act.selectAll') + ' matching the filter',
          onclick: function () { api.selectAllMatching(); }
        }));
      }
      bar.appendChild(el('button', {
        class: 'btn btn--text', type: 'button', text: t('act.invert'),
        onclick: function () { api.invert(); }
      }));
      (opts.actions || []).forEach(function (a) {
        bar.appendChild(el('button', {
          class: 'btn ' + (a.danger ? 'btn--danger' : 'btn--tonal'), type: 'button', text: a.label,
          onclick: function (e) { api.run(a, e.currentTarget); }
        }));
      });
      bar.appendChild(scopeNote);
      container.parentNode.insertBefore(bar, container.nextSibling);

      var api = {
        bar: bar,
        selected: selectedIds,
        clear: function () { Object.keys(selected).forEach(function (k) { delete selected[k]; }); paint(); },
        selectPage: function () { items().forEach(function (n) { selected[idOf(n)] = true; }); paint(); },
        selectAllMatching: function () {
          if (!opts.allMatchingIds) return api.selectPage();
          opts.allMatchingIds().forEach(function (id) { selected[id] = true; });
          paint();
        },
        invert: function () {
          items().forEach(function (n) { var id = idOf(n); selected[id] = !selected[id]; });
          paint();
        },
        run: function (action, anchor) {
          var ids = selectedIds();
          if (!ids.length) { notify.warn('Nothing is selected, so there is nothing to do.'); return; }
          var labels = ids.slice(0, 12).map(function (id) { return opts.getLabel ? opts.getLabel(id) : id; });
          var preview = el('div', { class: 'stack' }, [
            el('p', { text: action.label + ' will run on ' + ids.length + ' item' + (ids.length === 1 ? '' : 's') + '.' }),
            el('ul', { class: 'cap' }, labels.map(function (l) { return el('li', { text: String(l) }); })),
            ids.length > labels.length ? el('p', { class: 'muted', text: 'and ' + (ids.length - labels.length) + ' more.' }) : null
          ].filter(Boolean));

          function doIt() {
            var res = action.run(ids);
            Promise.resolve(res).then(function (outcome) {
              api.clear();
              if (outcome && typeof outcome === 'object' && outcome.skipped) {
                notify.warn(outcome.done + ' done, ' + outcome.skipped + ' skipped: ' + (outcome.reason || 'no reason given'));
              } else {
                notify.success(action.label + ' finished on ' + ids.length + ' item' + (ids.length === 1 ? '' : 's') + '.');
              }
            });
          }
          if (action.destructive) {
            confirmDestructive({
              anchor: anchor, action: action.label, target: ids.length + ' item' + (ids.length === 1 ? '' : 's'),
              detail: labels.join(', ') + (ids.length > labels.length ? ' and ' + (ids.length - labels.length) + ' more' : ''),
              returnTo: anchor
            }).then(function (ok) { if (ok) doIt(); });
            return;
          }
          var h = openOverlay({
            anchor: anchor, title: action.label, content: preview, returnTo: anchor,
            footer: [
              el('button', { class: 'btn btn--text', type: 'button', text: t('act.cancel'), onclick: function () { h.close('cancel'); } }),
              el('button', { class: 'btn btn--filled', type: 'button', text: action.label, onclick: function () { h.close('run'); doIt(); } })
            ]
          });
        },
        refresh: paint,
        destroy: function () {
          container.removeEventListener('click', onClick);
          container.removeEventListener('keydown', onKey);
          if (bar.parentNode) bar.parentNode.removeChild(bar);
        }
      };
      paint();
      return api;
    }
  };

  /* ================================================================
   * 17. Tabs
   *
   * Browser-style tabs, dockable to any edge, LEFT by default. A
   * screen is wider than it is tall and a tab label is wider than it
   * is high, so a vertical strip shows more tabs legibly than the
   * horizontal one every browser trained everybody to expect.
   *
   * Docking is an ORIENTATION change, not a rotation. Labels are never
   * turned ninety degrees. The overflow surface measures HEIGHT on a
   * vertical strip and WIDTH on a horizontal one, which is genuinely
   * different arithmetic rather than the same code with a flipped
   * flag. `aria-orientation` and the arrow keys follow the axis: get
   * that wrong and the strip looks perfect and cannot be driven by
   * keyboard, which no capture will ever reveal.
   * ================================================================ */
  var DOCKS = ['left', 'right', 'top', 'bottom'];
  var allStrips = [];

  function tabsCreate(host, opts) {
    opts = opts || {};
    var key = 'tabs.' + (opts.id || 'default');
    var saved = store.get(key, null) || {};
    var state = {
      dock: DOCKS.indexOf(saved.dock) >= 0 ? saved.dock : (DOCKS.indexOf(opts.dock) >= 0 ? opts.dock : 'left'),
      order: Array.isArray(saved.order) ? saved.order : null,
      pinned: Array.isArray(saved.pinned) ? saved.pinned : [],
      groups: Array.isArray(saved.groups) ? saved.groups : [],
      selected: saved.selected || null,
      includePinnedInBulkClose: false
    };

    var tabs = (opts.tabs || []).map(function (tb) {
      return {
        id: tb.id || uid('tab'),
        label: tb.labelKey ? t(tb.labelKey) : (tb.label || 'Tab'),
        labelKey: tb.labelKey || null,
        secondary: tb.labelKey ? t2(tb.labelKey) : (tb.secondary || ''),
        icon: tb.icon || 'doc',
        panel: tb.panel || null,
        closable: tb.closable !== false,
        badge: tb.badge || null,
        keywords: tb.keywords || ''
      };
    });

    /* Seed group membership from the saved record, then from options,
       so a group the visitor made survives a page that only declares
       its own defaults. */
    var groups = state.groups.length ? state.groups.map(function (g) {
      return { id: g.id, name: g.name, colour: g.colour || null, collapsed: !!g.collapsed, members: Array.isArray(g.members) ? g.members : [] };
    }) : (opts.groups || []).map(function (g) {
      return { id: g.id || uid('grp'), name: g.name || 'Group', colour: g.colour || null, collapsed: !!g.collapsed, members: (g.members || []).slice() };
    });

    var surface = el('div', { class: 'wds-tabsurface', 'data-dock': state.dock });
    var strip = el('div', { class: 'wds-tabstrip', role: 'tablist' });
    var pinnedList = el('ul', { class: 'wds-tabstrip__pinned', hidden: true });
    var list = el('ul', { class: 'wds-tabstrip__list' });
    var tools = el('div', { class: 'wds-tabstrip__tools' });
    var panels = el('div', { class: 'wds-tabpanels' });
    strip.appendChild(tools);
    strip.appendChild(pinnedList);
    strip.appendChild(list);
    surface.appendChild(strip);
    surface.appendChild(panels);
    host.appendChild(surface);

    var overflowBtn = el('button', {
      class: 'btn btn--icon', type: 'button', hidden: true,
      'aria-haspopup': 'menu', 'aria-label': 'Tabs that do not fit',
      onclick: function () { openOverflow(overflowBtn); }
    }, icon('more'));
    var stripSearchBtn = el('button', {
      class: 'btn btn--icon', type: 'button', 'aria-haspopup': 'dialog',
      'aria-label': t('tabs.searchStrip'), title: t('tabs.searchStrip'),
      onclick: function () { openStripSearch(stripSearchBtn); }
    }, icon('search'));
    var moreBtn = el('button', {
      class: 'btn btn--icon', type: 'button', 'aria-haspopup': 'menu',
      'aria-label': 'Tab strip options', title: 'Tab strip options',
      onclick: function () { openStripMenu(moreBtn); }
    }, icon('settings'));
    tools.appendChild(stripSearchBtn);
    tools.appendChild(overflowBtn);
    tools.appendChild(moreBtn);

    var roving = null;

    function byId(id) { return tabs.filter(function (x) { return x.id === id; })[0] || null; }
    function isPinned(id) { return state.pinned.indexOf(id) >= 0; }
    function groupOf(id) {
      for (var i = 0; i < groups.length; i++) if (groups[i].members.indexOf(id) >= 0) return groups[i];
      return null;
    }
    function orderedIds() {
      var known = tabs.map(function (x) { return x.id; });
      if (!state.order) state.order = known.slice();
      var out = state.order.filter(function (id) { return known.indexOf(id) >= 0; });
      known.forEach(function (id) { if (out.indexOf(id) < 0) out.push(id); });
      state.order = out;
      return out;
    }
    function persist() {
      store.set(key, {
        dock: state.dock, order: state.order, pinned: state.pinned,
        groups: groups.map(function (g) { return { id: g.id, name: g.name, colour: g.colour, collapsed: g.collapsed, members: g.members }; }),
        selected: state.selected
      });
    }

    function makeTabButton(tb) {
      var selected = state.selected === tb.id;
      var btn = el('button', {
        class: 'wds-tab', type: 'button', role: 'tab',
        id: 'tab-' + tb.id, 'aria-controls': 'panel-' + tb.id,
        'aria-selected': selected ? 'true' : 'false',
        tabindex: selected ? '0' : '-1',
        draggable: 'true',
        'data-tab-id': tb.id,
        title: tb.label + (tb.secondary ? ' · ' + tb.secondary : ''),
        onclick: function () { api.select(tb.id); }
      });
      btn.appendChild(icon(isPinned(tb.id) ? 'pin' : tb.icon));
      var lbl = el('span', { class: 'wds-tab__label', text: tb.label });
      if (tb.secondary) lbl.appendChild(el('span', { class: 'sec', text: tb.secondary }));
      btn.appendChild(lbl);
      if (tb.badge) btn.appendChild(el('span', { class: 'badge wds-tab__badge', text: String(tb.badge) }));
      if (locks.isLocked('tab:' + tb.id)) {
        btn.classList.add('is-locked');
        btn.appendChild(icon('lock', 'i--sm'));
        btn.appendChild(el('span', { class: 'visually-hidden', text: ' — ' + t('locks.locked') }));
      }
      btn.addEventListener('keydown', function (e) {
        if (e.altKey && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(e.key) >= 0) {
          e.preventDefault();
          var forward = (e.key === 'ArrowDown' || e.key === 'ArrowRight');
          api.move(tb.id, forward ? 1 : -1);
          window.setTimeout(function () {
            var again = strip.querySelector('[data-tab-id="' + cssEscape(tb.id) + '"]');
            if (again) again.focus();
          }, 0);
        } else if (e.key === 'Delete' && tb.closable) {
          e.preventDefault(); api.close(tb.id);
        }
      });
      btn.addEventListener('dragstart', function (e) {
        e.dataTransfer.setData('text/plain', tb.id);
        e.dataTransfer.effectAllowed = 'move';
        btn.classList.add('is-drag');
      });
      btn.addEventListener('dragend', function () { btn.classList.remove('is-drag'); });
      btn.addEventListener('dragover', function (e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; btn.classList.add('is-drop-before'); });
      btn.addEventListener('dragleave', function () { btn.classList.remove('is-drop-before', 'is-drop-after'); });
      btn.addEventListener('drop', function (e) {
        e.preventDefault();
        btn.classList.remove('is-drop-before', 'is-drop-after');
        var dragged = e.dataTransfer.getData('text/plain');
        if (dragged && dragged !== tb.id) api.reorderBefore(dragged, tb.id);
      });
      attachContextMenu(btn, function () { return tabMenuItems(tb, btn); }, { ariaLabel: 'Tab menu', storageKey: 'tab-context' });
      appearance.enable(btn, 'tab:' + tb.id, tb.label);
      return btn;
    }

    function tabMenuItems(tb, anchor) {
      var g = groupOf(tb.id);
      return [
        { label: t('act.openEditor') + '…', icon: 'palette', shortcut: 'Shift+Right click',
          run: function () { appearance.openEditor(anchor, 'tab:' + tb.id, tb.label); } },
        { label: t('locks.lockThis') + '…', icon: 'lock', run: function () { locks.wizard(anchor, 'tab:' + tb.id, tb.label); } },
        '-',
        { label: isPinned(tb.id) ? t('tabs.unpin') : t('tabs.pin'), icon: 'pin', run: function () { api.togglePin(tb.id); } },
        { label: t('tabs.moveGroup') + '…', icon: 'folder', run: function () { openMoveIntoGroup(anchor, tb.id); } },
        g ? { label: 'Remove from ' + g.name, icon: 'close', run: function () { api.removeFromGroup(tb.id); } } : null,
        '-',
        { label: t('tabs.searchStrip') + '…', icon: 'search', shortcut: 'Ctrl+Shift+F', run: function () { openStripSearch(anchor); } },
        { label: t('tabs.closeContaining') + '…', icon: 'filter', run: function () { openBulkClose(anchor, true); } },
        { label: t('tabs.closeNotContaining') + '…', icon: 'filter', run: function () { openBulkClose(anchor, false); } },
        '-',
        { label: t('act.close'), icon: 'close', danger: true, shortcut: 'Delete',
          disabled: !tb.closable, disabledReason: tb.closable ? null : 'This tab is part of the page and cannot be closed.',
          run: function () { api.close(tb.id); } }
      ].filter(Boolean);
    }

    function makeGroup(g) {
      var headId = uid('gh');
      var head = el('button', {
        class: 'wds-tabgroup__head', type: 'button', id: headId,
        'aria-expanded': g.collapsed ? 'false' : 'true',
        onclick: function () { api.toggleGroup(g.id); }
      }, [
        icon(g.collapsed ? 'chevronRight' : 'chevronDown'),
        el('span', { class: 'wds-tabgroup__dot', style: g.colour ? { background: g.colour } : null, 'aria-hidden': 'true' }),
        el('span', { class: 'wds-tabgroup__name', text: g.name }),
        el('span', { class: 'wds-tabgroup__count', text: String(g.members.length) })
      ]);
      var items = el('ul', { class: 'wds-tabgroup__items', role: 'group', 'aria-labelledby': headId });
      var wrap = el('li', { class: 'wds-tabgroup' + (g.collapsed ? ' is-collapsed' : ''), 'data-group-id': g.id }, [head, items]);
      attachContextMenu(head, function () {
        return [
          { label: t('tabs.searchGroup') + '…', icon: 'search', run: function () { openGroupSearch(head, g.id); } },
          { label: 'Rename this group…', icon: 'text', run: function () { openGroupRename(head, g.id); } },
          { label: 'Change group colour…', icon: 'palette', run: function () { openGroupColour(head, g.id); } },
          { label: g.collapsed ? 'Expand this group' : 'Collapse this group', icon: 'chevronDown', run: function () { api.toggleGroup(g.id); } },
          '-',
          { label: t('act.openEditor') + '…', icon: 'palette', shortcut: 'Shift+Right click',
            run: function () { appearance.openEditor(head, 'group:' + g.id, g.name); } },
          { label: t('locks.lockThis') + '…', icon: 'lock', run: function () { locks.wizard(head, 'group:' + g.id, g.name); } },
          '-',
          { label: 'Remove this group, keeping its tabs', icon: 'trash', danger: true, run: function () { api.removeGroup(g.id); } }
        ];
      }, { ariaLabel: 'Group menu', storageKey: 'group-context' });
      appearance.enable(head, 'group:' + g.id, g.name);
      return { wrap: wrap, items: items };
    }

    function render() {
      var focusId = document.activeElement && document.activeElement.getAttribute
        ? document.activeElement.getAttribute('data-tab-id') : null;
      clear(pinnedList); clear(list);
      var ids = orderedIds();

      var pinnedIds = ids.filter(isPinned);
      pinnedList.hidden = pinnedIds.length === 0;
      pinnedIds.forEach(function (id) {
        var tb = byId(id); if (!tb) return;
        pinnedList.appendChild(el('li', {}, makeTabButton(tb)));
      });

      var placed = Object.create(null);
      groups.forEach(function (g) {
        var members = ids.filter(function (id) { return g.members.indexOf(id) >= 0 && !isPinned(id); });
        if (!members.length && !g.members.length) return;
        var built = makeGroup(g);
        members.forEach(function (id) {
          placed[id] = true;
          var tb = byId(id); if (!tb) return;
          built.items.appendChild(el('li', {}, makeTabButton(tb)));
        });
        list.appendChild(built.wrap);
      });
      ids.forEach(function (id) {
        if (isPinned(id) || placed[id]) return;
        var tb = byId(id); if (!tb) return;
        list.appendChild(el('li', {}, makeTabButton(tb)));
      });

      /* Panels. Only the selected one is shown; the rest keep their
         DOM so state inside a tab survives switching away from it. */
      tabs.forEach(function (tb) {
        var panel = panels.querySelector('#panel-' + cssEscape(tb.id));
        if (!panel) {
          panel = el('div', {
            class: 'wds-tabpanel', id: 'panel-' + tb.id, role: 'tabpanel',
            'aria-labelledby': 'tab-' + tb.id, tabindex: '0', 'data-print-title': tb.label
          });
          var content = typeof tb.panel === 'function' ? tb.panel() : tb.panel;
          if (content) append(panel, content);
          panels.appendChild(panel);
        }
        panel.hidden = state.selected !== tb.id;
      });

      surface.dataset.dock = state.dock;
      var axis = (state.dock === 'top' || state.dock === 'bottom') ? 'horizontal' : 'vertical';
      strip.setAttribute('aria-orientation', axis);
      if (roving) roving.destroy();
      roving = a11y.roving(strip, { selector: '[role="tab"]', axis: axis });

      updateOverflow();
      if (focusId) {
        var again = strip.querySelector('[data-tab-id="' + cssEscape(focusId) + '"]');
        if (again) again.focus();
      }
      emit('tabs', { id: opts.id, state: state });
    }

    /* Overflow. On a vertical strip this measures height; on a
       horizontal strip, width. Same intent, different arithmetic, and
       both are exercised because the dock is a real setting. */
    function updateOverflow() {
      var vertical = (state.dock === 'left' || state.dock === 'right');
      var buttons = Array.prototype.slice.call(list.querySelectorAll('[role="tab"]'));
      buttons.forEach(function (b) { b.removeAttribute('data-overflow'); b.hidden = false; });
      var hidden = [];
      var box = list.getBoundingClientRect();
      var limit = vertical ? box.height : box.width;
      if (limit <= 0) { overflowBtn.hidden = true; return; }
      buttons.forEach(function (b) {
        var r = b.getBoundingClientRect();
        var extent = vertical ? (r.bottom - box.top) : (r.right - box.left);
        if (extent > limit + 1) {
          b.setAttribute('data-overflow', '1');
          b.hidden = true;
          hidden.push(b.getAttribute('data-tab-id'));
        }
      });
      overflowBtn.hidden = hidden.length === 0;
      overflowBtn.setAttribute('aria-label', hidden.length + ' tab' + (hidden.length === 1 ? '' : 's') + ' that do not fit');
      overflowBtn.dataset.hidden = hidden.join(',');
    }
    function openOverflow(anchor) {
      var ids = (overflowBtn.dataset.hidden || '').split(',').filter(Boolean);
      openMenu({
        anchor: anchor, returnTo: anchor, ariaLabel: 'Tabs that do not fit',
        filterLabel: t('tabs.searchStrip'), storageKey: 'tab-overflow',
        items: ids.map(function (id) {
          var tb = byId(id);
          return { label: tb ? tb.label : id, icon: tb ? tb.icon : 'doc', run: function () { api.select(id); } };
        })
      });
    }

    /* ---- search surface 1: this strip ---------------------------- */
    function openStripSearch(anchor) {
      openTabSearchPanel(anchor, {
        title: t('tabs.searchStrip'),
        storageKey: 'tabsearch-strip-' + (opts.id || 'default'),
        rows: function () {
          return orderedIds().map(function (id) {
            var tb = byId(id), g = groupOf(id);
            return {
              id: id, label: tb.label, keywords: tb.keywords,
              context: [g ? 'Group: ' + g.name : null, isPinned(id) ? 'Pinned' : null].filter(Boolean).join(' · '),
              run: function () { api.select(id); }
            };
          });
        }
      });
    }
    /* ---- search surface 2: inside one group ---------------------- */
    function openGroupSearch(anchor, groupId) {
      var g = groups.filter(function (x) { return x.id === groupId; })[0];
      if (!g) return;
      openTabSearchPanel(anchor, {
        title: t('tabs.searchGroup') + ': ' + g.name,
        storageKey: 'tabsearch-group-' + groupId,
        rows: function () {
          return g.members.map(function (id) {
            var tb = byId(id); if (!tb) return null;
            return { id: id, label: tb.label, keywords: tb.keywords, context: 'Group: ' + g.name, run: function () { api.select(id); } };
          }).filter(Boolean);
        }
      });
    }
    /* ---- search surface 3: groups by name ------------------------ */
    function openGroupsSearch(anchor) {
      openTabSearchPanel(anchor, {
        title: t('tabs.searchGroups'),
        storageKey: 'tabsearch-groups-' + (opts.id || 'default'),
        rows: function () {
          return groups.map(function (g) {
            return {
              id: g.id, label: g.name, keywords: g.members.map(function (m) { var tb = byId(m); return tb ? tb.label : ''; }).join(' '),
              context: g.members.length + ' tab' + (g.members.length === 1 ? '' : 's') + (g.collapsed ? ' · collapsed' : ''),
              run: function () {
                /* Revealing a result inside a collapsed group must not
                   destroy the collapsed preference: expand, show, and
                   leave the stored state as the visitor set it. */
                var el2 = strip.querySelector('[data-group-id="' + cssEscape(g.id) + '"]');
                if (el2) { el2.classList.remove('is-collapsed'); el2.scrollIntoView({ block: 'nearest' }); flashTarget(el2); }
              }
            };
          });
        }
      });
    }
    function openTabSearchPanel(anchor, cfg) {
      var results = el('ul', { class: 'list' });
      var count = el('p', { class: 'cap', role: 'status', 'aria-live': 'polite' });
      var search = createSearchBar({
        ariaLabel: cfg.title, placeholder: cfg.title, storageKey: cfg.storageKey,
        sampleProvider: function () { return cfg.rows().map(function (r) { return r.label; }).join('\n'); },
        onChange: render2
      });
      function render2() {
        clear(results);
        var m = search.matcher();
        var all = cfg.rows();
        var shown = all.filter(function (r) { return m(r.label + ' ' + (r.keywords || '') + ' ' + (r.context || '')); });
        count.textContent = shown.length + ' of ' + all.length;
        if (!shown.length) { results.appendChild(el('li', { class: 'li muted', text: t('msg.noMatch') })); return; }
        shown.forEach(function (r) {
          results.appendChild(el('li', { class: 'li li--action', tabindex: '0',
            onclick: function () { r.run(); h.close('activate'); },
            onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); r.run(); h.close('activate'); } }
          }, el('span', { class: 'li__t' }, [
            el('span', { class: 'li__h', text: r.label }),
            r.context ? el('span', { class: 'li__s', text: r.context }) : null
          ].filter(Boolean))));
        });
      }
      var h = openOverlay({
        anchor: anchor, title: cfg.title, returnTo: anchor,
        content: el('div', { class: 'stack' }, [search.el, count, results]),
        resizable: true, persistKey: cfg.storageKey
      });
      render2();
      window.setTimeout(function () { search.focus(); }, 0);
      return h;
    }

    /* ---- move into group: a searchable picker, never an inline list */
    function openMoveIntoGroup(anchor, tabId) {
      var results = el('ul', { class: 'list' });
      var search = createSearchBar({
        ariaLabel: 'Search groups', placeholder: 'Search groups',
        storageKey: 'move-into-group', onChange: render3
      });
      var nameInput = el('input', { class: 'field__input', type: 'text', placeholder: 'New group name' });
      function render3() {
        clear(results);
        var m = search.matcher();
        var shown = groups.filter(function (g) { return m(g.name); });
        if (!groups.length) {
          results.appendChild(el('li', { class: 'li muted', text: 'There are no groups yet. Name one below and it will be created.' }));
        } else if (!shown.length) {
          results.appendChild(el('li', { class: 'li muted', text: t('msg.noMatch') }));
        }
        shown.forEach(function (g) {
          results.appendChild(el('li', {
            class: 'li li--action', tabindex: '0',
            onclick: function () { api.moveToGroup(tabId, g.id); h.close('moved'); },
            onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); api.moveToGroup(tabId, g.id); h.close('moved'); } }
          }, [
            el('span', { class: 'wds-tabgroup__dot', style: g.colour ? { background: g.colour } : null, 'aria-hidden': 'true' }),
            el('span', { class: 'li__t' }, [
              el('span', { class: 'li__h', text: g.name }),
              el('span', { class: 'li__s', text: g.members.length + ' tab' + (g.members.length === 1 ? '' : 's') + (g.collapsed ? ' · collapsed' : '') })
            ])
          ]));
        });
      }
      var h = openOverlay({
        anchor: anchor, title: t('tabs.moveGroup'), returnTo: anchor,
        content: el('div', { class: 'stack' }, [
          search.el, results,
          el('div', { class: 'field field--outlined' }, [
            el('span', { class: 'field__label', text: 'Create a new group' }),
            el('div', { class: 'field__box' }, nameInput)
          ])
        ]),
        footer: [
          el('button', { class: 'btn btn--text', type: 'button', text: t('act.cancel'), onclick: function () { h.close('cancel'); } }),
          el('button', {
            class: 'btn btn--filled', type: 'button', text: 'Create and move',
            onclick: function () {
              var name = nameInput.value.trim();
              if (!name) { notify.warn('Give the new group a name first.'); nameInput.focus(); return; }
              var g = api.createGroup(name);
              api.moveToGroup(tabId, g.id);
              h.close('created');
            }
          })
        ]
      });
      render3();
      window.setTimeout(function () { search.focus(); }, 0);
    }

    function openGroupRename(anchor, groupId) {
      var g = groups.filter(function (x) { return x.id === groupId; })[0];
      if (!g) return;
      var input = el('input', { class: 'field__input', type: 'text', value: g.name });
      var h = openOverlay({
        anchor: anchor, title: 'Rename this group', returnTo: anchor,
        content: el('div', { class: 'field field--outlined' }, [
          el('span', { class: 'field__label', text: 'Group name' }),
          el('div', { class: 'field__box' }, input)
        ]),
        footer: [
          el('button', { class: 'btn btn--text', type: 'button', text: t('act.cancel'), onclick: function () { h.close('cancel'); } }),
          el('button', { class: 'btn btn--filled', type: 'button', text: t('act.save'), onclick: function () {
            api.renameGroup(groupId, input.value.trim() || g.name); h.close('saved');
          } })
        ]
      });
      window.setTimeout(function () { input.focus(); input.select(); }, 0);
    }
    function openGroupColour(anchor, groupId) {
      var g = groups.filter(function (x) { return x.id === groupId; })[0];
      if (!g) return;
      var picker = appearance.colourPicker(g.colour || '#006D34', function (value) {
        g.colour = value; persist(); render();
      });
      openOverlay({ anchor: anchor, title: 'Group colour: ' + g.name, content: picker.el, returnTo: anchor, resizable: true, persistKey: 'group-colour' });
    }

    /* ---- bulk close by text, and its exact inverse ---------------- */
    function openBulkClose(anchor, containing) {
      var includePinned = false;
      var preview = el('div');
      var count = el('p', { class: 'cap', role: 'status', 'aria-live': 'polite' });
      var search = createSearchBar({
        ariaLabel: containing ? t('tabs.closeContaining') : t('tabs.closeNotContaining'),
        placeholder: 'Text to match against the tab label',
        storageKey: 'tab-bulk-close', onChange: render4
      });
      var pinBox = el('input', { type: 'checkbox', class: 'visually-hidden' });
      var pinVisual = el('span', { class: 'cbx', 'aria-hidden': 'true' }, icon('check'));
      pinBox.addEventListener('change', function () {
        includePinned = pinBox.checked;
        pinVisual.classList.toggle('is-on', includePinned);
        render4();
      });
      var pinId = uid('pin');
      pinBox.id = pinId;

      /* ONE predicate, negated for the inverse. Two predicates would
         drift on casing, flags and Unicode the first time either side
         was edited alone. */
      function affected() {
        if (!search.value() || !search.valid()) return [];
        var m = search.matcher();
        return orderedIds().filter(function (id) {
          var tb = byId(id);
          if (!tb || !tb.closable) return false;
          if (!includePinned && isPinned(id)) return false;
          var hit = m(tb.label + (tb.secondary ? ' ' + tb.secondary : ''));
          return containing ? hit : !hit;
        });
      }
      function render4() {
        clear(preview);
        var ids = affected();
        var excluded = orderedIds().filter(function (id) {
          var tb = byId(id);
          return tb && (!tb.closable || (!includePinned && isPinned(id)));
        });
        count.textContent = !search.value()
          ? 'Type something first. Nothing runs on an empty query.'
          : (ids.length + ' tab' + (ids.length === 1 ? '' : 's') + ' will close. ' + excluded.length + ' excluded.');
        var ul = el('ul', { class: 'list' });
        ids.forEach(function (id) {
          var tb = byId(id);
          ul.appendChild(el('li', { class: 'li' }, el('span', { class: 'li__t' }, el('span', { class: 'li__h', text: tb.label }))));
        });
        preview.appendChild(ul);
        if (excluded.length) {
          preview.appendChild(el('p', { class: 'muted t-body-small', text: 'Excluded: ' + excluded.map(function (id) { var tb = byId(id); return tb.label + (tb.closable ? '' : ' (cannot be closed)'); }).join(', ') }));
        }
        runBtn.disabled = ids.length === 0;
      }
      var runBtn = el('button', {
        class: 'btn btn--danger', type: 'button', text: t('act.close'),
        onclick: function () {
          var ids = affected();
          if (!ids.length) return;
          confirmDestructive({
            anchor: runBtn, returnTo: runBtn,
            action: containing ? t('tabs.closeContaining') : t('tabs.closeNotContaining'),
            target: ids.length + ' tab' + (ids.length === 1 ? '' : 's'),
            detail: ids.map(function (id) { return byId(id).label; }).join(', ')
          }).then(function (ok) {
            if (!ok) return;
            ids.forEach(function (id) { api.close(id, true); });
            notify.success(ids.length + ' tab' + (ids.length === 1 ? '' : 's') + ' closed.');
            h.close('done');
          });
        }
      });
      var h = openOverlay({
        anchor: anchor, returnTo: anchor,
        title: containing ? t('tabs.closeContaining') : t('tabs.closeNotContaining'),
        content: el('div', { class: 'stack' }, [
          search.el,
          el('label', { class: 'ctl', for: pinId }, [pinBox, pinVisual, el('span', { text: 'Include pinned tabs' })]),
          el('p', { class: 'muted t-body-small', text: t('tabs.pinnedExcluded') }),
          count, preview
        ]),
        footer: [
          el('button', { class: 'btn btn--text', type: 'button', text: t('act.cancel'), onclick: function () { h.close('cancel'); } }),
          runBtn
        ],
        resizable: true, persistKey: 'tab-bulk-close'
      });
      render4();
      window.setTimeout(function () { search.focus(); }, 0);
    }

    function openStripMenu(anchor) {
      openMenu({
        anchor: anchor, returnTo: anchor, ariaLabel: 'Tab strip options',
        filterLabel: 'Filter options', storageKey: 'tab-strip-menu',
        items: DOCKS.map(function (d) {
          return {
            label: t('tabs.dock') + ': ' + d, icon: 'dock', checked: state.dock === d,
            keywords: 'dock position ' + d, run: function () { api.setDock(d); }
          };
        }).concat([
          '-',
          { label: t('tabs.searchStrip') + '…', icon: 'search', run: function () { openStripSearch(anchor); } },
          { label: t('tabs.searchGroups') + '…', icon: 'folder', run: function () { openGroupsSearch(anchor); } },
          { label: t('tabs.searchAll') + '…', icon: 'grid', run: function () { tabsMasterSearch(anchor); } },
          '-',
          { label: 'New group…', icon: 'plus', run: function () {
            var g = api.createGroup('Group ' + (groups.length + 1));
            notify.success('Created the group "' + g.name + '". Move a tab into it from the tab menu.');
          } },
          { label: t('tabs.closeContaining') + '…', icon: 'filter', run: function () { openBulkClose(anchor, true); } },
          { label: t('tabs.closeNotContaining') + '…', icon: 'filter', run: function () { openBulkClose(anchor, false); } }
        ])
      });
    }

    var api = {
      id: opts.id || 'default',
      el: surface, strip: strip, panels: panels,
      tabs: function () { return tabs.slice(); },
      groups: function () { return groups.slice(); },
      dock: function () { return state.dock; },
      setDock: function (d) {
        if (DOCKS.indexOf(d) < 0) return false;
        state.dock = d; persist(); render();
        a11y.announce('Tab strip moved to the ' + d + '.');
        return true;
      },
      selected: function () { return state.selected; },
      select: function (id) {
        var tb = byId(id); if (!tb) return false;
        if (locks.isLocked('tab:' + id) && !locks.isUnlocked('tab:' + id)) {
          locks.promptUnlock(strip.querySelector('[data-tab-id="' + cssEscape(id) + '"]') || strip, 'tab:' + id, tb.label, function () { api.select(id); });
          return false;
        }
        state.selected = id; persist(); render();
        emit('tab-selected', { strip: api.id, tab: id });
        return true;
      },
      add: function (tb) {
        tabs.push({
          id: tb.id || uid('tab'), label: tb.labelKey ? t(tb.labelKey) : (tb.label || 'Tab'),
          labelKey: tb.labelKey || null, secondary: tb.secondary || '', icon: tb.icon || 'doc',
          panel: tb.panel || null, closable: tb.closable !== false, badge: tb.badge || null, keywords: tb.keywords || ''
        });
        state.order = null; orderedIds(); persist(); render();
      },
      close: function (id, quiet) {
        var tb = byId(id);
        if (!tb || !tb.closable) return false;
        tabs = tabs.filter(function (x) { return x.id !== id; });
        state.order = state.order.filter(function (x) { return x !== id; });
        state.pinned = state.pinned.filter(function (x) { return x !== id; });
        groups.forEach(function (g) { g.members = g.members.filter(function (x) { return x !== id; }); });
        var panel = panels.querySelector('#panel-' + cssEscape(id));
        if (panel) panel.parentNode.removeChild(panel);
        if (state.selected === id) state.selected = (orderedIds()[0] || null);
        persist(); render();
        if (!quiet) notify.info('Closed the tab "' + tb.label + '".');
        return true;
      },
      togglePin: function (id) {
        if (isPinned(id)) state.pinned = state.pinned.filter(function (x) { return x !== id; });
        else state.pinned.push(id);
        persist(); render();
      },
      /* Moves the tab past its VISIBLE neighbour, not past whatever
         happens to sit beside it in the flat order. A pinned tab, a
         grouped tab and an ungrouped tab render in three different
         places, so stepping through the flat order lets Alt+Arrow swap
         a tab with one drawn somewhere else entirely -- the keypress
         then appears to do nothing at all, which reads as a broken
         shortcut rather than a no-op. */
      move: function (id, delta) {
        var ids = orderedIds();
        if (ids.indexOf(id) < 0) return;
        var pinned = isPinned(id), g = groupOf(id);
        var peers = ids.filter(function (x) {
          if (pinned) return isPinned(x);
          if (isPinned(x)) return false;
          var xg = groupOf(x);
          return g ? !!(xg && xg.id === g.id) : !xg;
        });
        var pi = peers.indexOf(id);
        if (pi < 0) return;
        var target = peers[clamp(pi + delta, 0, peers.length - 1)];
        if (!target || target === id) return;
        var from = ids.indexOf(id), to = ids.indexOf(target);
        ids.splice(to, 0, ids.splice(from, 1)[0]);
        state.order = ids; persist(); render();
      },
      reorderBefore: function (dragged, target) {
        var ids = orderedIds(), from = ids.indexOf(dragged), to = ids.indexOf(target);
        if (from < 0 || to < 0) return;
        ids.splice(to, 0, ids.splice(from, 1)[0]);
        state.order = ids;
        /* Dropping onto a tab inside a group joins that group, which is
           what everyone expects and nobody documents. */
        var g = groupOf(target);
        groups.forEach(function (x) { x.members = x.members.filter(function (m) { return m !== dragged; }); });
        if (g) g.members.push(dragged);
        persist(); render();
      },
      createGroup: function (name, colour) {
        var g = { id: uid('grp'), name: name || 'Group', colour: colour || null, collapsed: false, members: [] };
        groups.push(g); persist(); render();
        return g;
      },
      renameGroup: function (id, name) {
        var g = groups.filter(function (x) { return x.id === id; })[0];
        if (!g) return false;
        g.name = name; persist(); render(); return true;
      },
      setGroupColour: function (id, colour) {
        var g = groups.filter(function (x) { return x.id === id; })[0];
        if (!g) return false;
        g.colour = colour; persist(); render(); return true;
      },
      toggleGroup: function (id) {
        var g = groups.filter(function (x) { return x.id === id; })[0];
        if (!g) return false;
        g.collapsed = !g.collapsed; persist(); render(); return true;
      },
      removeGroup: function (id) {
        groups = groups.filter(function (g) { return g.id !== id; });
        persist(); render();
      },
      moveToGroup: function (tabId, groupId) {
        groups.forEach(function (g) { g.members = g.members.filter(function (m) { return m !== tabId; }); });
        var g = groups.filter(function (x) { return x.id === groupId; })[0];
        if (g && g.members.indexOf(tabId) < 0) g.members.push(tabId);
        persist(); render();
      },
      removeFromGroup: function (tabId) {
        groups.forEach(function (g) { g.members = g.members.filter(function (m) { return m !== tabId; }); });
        persist(); render();
      },
      searchStrip: openStripSearch,
      searchGroups: openGroupsSearch,
      searchGroup: openGroupSearch,
      closeContaining: function (anchor) { openBulkClose(anchor, true); },
      closeNotContaining: function (anchor) { openBulkClose(anchor, false); },
      refresh: render,
      state: function () { return JSON.parse(JSON.stringify(state)); }
    };

    if (!state.selected || !byId(state.selected)) state.selected = (tabs[0] && tabs[0].id) || null;
    render();
    var onResize = debounce(updateOverflow, 120);
    window.addEventListener('resize', onResize);
    allStrips.push(api);
    return api;
  }

  /* ---- search surface 4: master, across every strip on the page --- */
  function tabsMasterSearch(anchor) {
    var results = el('ul', { class: 'list' });
    var count = el('p', { class: 'cap', role: 'status', 'aria-live': 'polite' });
    function rows() {
      var out = [];
      allStrips.forEach(function (s) {
        var st = s.state();
        s.tabs().forEach(function (tb) {
          var g = s.groups().filter(function (gg) { return gg.members.indexOf(tb.id) >= 0; })[0];
          out.push({
            label: tb.label,
            context: ['Strip: ' + s.id, g ? 'Group: ' + g.name : null,
              st.pinned.indexOf(tb.id) >= 0 ? 'Pinned' : null,
              locks.isLocked('tab:' + tb.id) ? t('locks.locked') : null].filter(Boolean).join(' · '),
            keywords: tb.keywords,
            run: function () { s.select(tb.id); }
          });
        });
      });
      return out;
    }
    var search = createSearchBar({
      ariaLabel: t('tabs.searchAll'), placeholder: t('tabs.searchAll'),
      storageKey: 'tabsearch-master',
      sampleProvider: function () { return rows().map(function (r) { return r.label; }).join('\n'); },
      onChange: render
    });
    function render() {
      clear(results);
      var m = search.matcher(), all = rows();
      var shown = all.filter(function (r) { return m(r.label + ' ' + r.context + ' ' + (r.keywords || '')); });
      count.textContent = shown.length + ' of ' + all.length;
      if (!shown.length) { results.appendChild(el('li', { class: 'li muted', text: t('msg.noMatch') })); return; }
      shown.forEach(function (r) {
        results.appendChild(el('li', {
          class: 'li li--action', tabindex: '0',
          onclick: function () { r.run(); h.close('activate'); },
          onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); r.run(); h.close('activate'); } }
        }, el('span', { class: 'li__t' }, [
          el('span', { class: 'li__h', text: r.label }),
          el('span', { class: 'li__s', text: r.context })
        ])));
      });
    }
    var h = openOverlay({
      anchor: anchor, title: t('tabs.searchAll'), returnTo: anchor,
      content: el('div', { class: 'stack' }, [search.el, count, results]),
      resizable: true, persistKey: 'tabsearch-master'
    });
    render();
    window.setTimeout(function () { search.focus(); }, 0);
    return h;
  }

  function cssEscape(s) {
    if (window.CSS && window.CSS.escape) return window.CSS.escape(s);
    return String(s).replace(/[^a-zA-Z0-9_-]/g, function (c) { return '\\' + c; });
  }
  function flashTarget(node) {
    node.classList.remove('wds-teleport-target');
    void node.offsetWidth;
    node.classList.add('wds-teleport-target');
    window.setTimeout(function () { node.classList.remove('wds-teleport-target'); }, 2200);
  }

  /* ================================================================
   * 18. The appearance editor
   *
   * Every rendered element can be edited. `enable()` gives an element
   * a stable key, a context-menu entry, a Shift+right-click shortcut
   * and a keyboard equivalent; the editor opens NON-MODALLY anchored
   * beside that exact element and returns focus to it on close.
   *
   * Stored rules are written into one generated stylesheet keyed by
   * `[data-wds-akey]`, so a rule survives a re-render that replaces
   * the node, and resetting a property removes it rather than
   * overwriting it with a guess at the default.
   * ================================================================ */
  var appearanceRules = store.get('appearance.elements', {});
  var appearanceLabels = Object.create(null);

  var TYPO_PROPS = [
    { css: 'font-family', label: 'Font family', kind: 'font' },
    { css: 'font-size', label: 'Font size', kind: 'length', min: 8, max: 96, step: 1, unit: 'px' },
    { css: 'font-weight', label: 'Weight', kind: 'select', options: ['100', '200', '300', '400', '500', '600', '700', '800', '900'] },
    { css: 'font-variation-settings', label: 'Variable font axes', kind: 'text', placeholder: '"wght" 500, "wdth" 90' },
    { css: 'font-style', label: 'Italic or oblique', kind: 'select', options: ['normal', 'italic', 'oblique 10deg'] },
    { css: 'font-variant-caps', label: 'Small caps', kind: 'select', options: ['normal', 'small-caps', 'all-small-caps', 'petite-caps'] },
    { css: 'text-transform', label: 'Capitalization', kind: 'select', options: ['none', 'uppercase', 'lowercase', 'capitalize'] },
    { css: 'text-decoration-line', label: 'Underline, strikethrough, overline', kind: 'select', options: ['none', 'underline', 'line-through', 'overline', 'underline line-through', 'underline overline'] },
    { css: 'text-decoration-style', label: 'Decoration style', kind: 'select', options: ['solid', 'double', 'dotted', 'dashed', 'wavy'] },
    { css: 'text-decoration-color', label: 'Decoration colour', kind: 'colour' },
    { css: 'text-decoration-thickness', label: 'Decoration thickness', kind: 'length', min: 1, max: 8, step: 1, unit: 'px' },
    { css: 'vertical-align', label: 'Superscript or subscript', kind: 'select', options: ['baseline', 'super', 'sub'] },
    { css: 'color', label: 'Text colour', kind: 'colour' },
    { css: 'background-color', label: 'Highlight', kind: 'colour' },
    { css: '-webkit-text-stroke', label: 'Outline', kind: 'text', placeholder: '1px #000000' },
    { css: 'text-shadow', label: 'Shadow or glow', kind: 'text', placeholder: '0 0 6px #00ff88' },
    { css: 'letter-spacing', label: 'Character spacing', kind: 'length', min: -2, max: 12, step: 0.25, unit: 'px' },
    { css: 'word-spacing', label: 'Word spacing', kind: 'length', min: -4, max: 24, step: 0.5, unit: 'px' },
    { css: 'line-height', label: 'Line height', kind: 'length', min: 0.8, max: 3, step: 0.05, unit: '' },
    { css: 'text-align', label: 'Alignment', kind: 'select', options: ['start', 'center', 'end', 'justify'] },
    { css: 'direction', label: 'Text direction', kind: 'select', options: ['ltr', 'rtl'] }
  ];
  var BOX_PROPS = [
    { css: 'border-radius', label: 'Corner radius', kind: 'length', min: 0, max: 48, step: 1, unit: 'px' },
    { css: 'padding', label: 'Padding', kind: 'length', min: 0, max: 48, step: 1, unit: 'px' },
    { css: 'border-width', label: 'Border width', kind: 'length', min: 0, max: 8, step: 1, unit: 'px' },
    { css: 'border-color', label: 'Border colour', kind: 'colour' },
    { css: 'border-style', label: 'Border style', kind: 'select', options: ['none', 'solid', 'dashed', 'dotted', 'double'] },
    { css: 'box-shadow', label: 'Elevation', kind: 'text', placeholder: 'var(--md-sys-elevation-level2)' },
    { css: 'opacity', label: 'Opacity', kind: 'length', min: 0.1, max: 1, step: 0.05, unit: '' }
  ];

  function appearanceStyleElement() {
    var node = document.getElementById('wds-appearance-style');
    if (!node) { node = el('style', { id: 'wds-appearance-style' }); document.head.appendChild(node); }
    return node;
  }
  function appearanceApplyAll() {
    var css = Object.keys(appearanceRules).map(function (k) {
      var props = appearanceRules[k] || {};
      var body = Object.keys(props).map(function (p) { return '  ' + p + ': ' + props[p] + ';'; }).join('\n');
      if (!body) return '';
      return '[data-wds-akey="' + k.replace(/"/g, '\\"') + '"] {\n' + body + '\n}';
    }).filter(Boolean).join('\n');
    appearanceStyleElement().textContent = css;
  }

  function supportsProp(prop, value) {
    if (!window.CSS || !window.CSS.supports) return true;
    try { return window.CSS.supports(prop, value || 'inherit') || window.CSS.supports(prop + ':' + (value || 'inherit')); }
    catch (e) { return true; }
  }

  /* ---- the infinite colour picker -------------------------------- */
  var recentColours = store.get('appearance.recentColours', []);
  function colourPicker(initial, onChange, opts) {
    opts = opts || {};
    var parsed = parseColor(initial) || parseColor('#006D34');
    var hsv = rgbToHsv(parsed.rgb[0], parsed.rgb[1], parsed.rgb[2]);
    var h = hsv[0], s = hsv[1], v = hsv[2], a = parsed.a;

    var field = el('div', { class: 'wds-color__field', tabindex: '0', role: 'application',
      'aria-label': 'Saturation and brightness. Use the arrow keys.' });
    var dot = el('div', { class: 'wds-color__dot' });
    field.appendChild(dot);
    var hueRange = el('input', { type: 'range', min: '0', max: '360', step: '0.1', 'aria-label': 'Hue', class: 'wds-color__hue' });
    var alphaRange = el('input', { type: 'range', min: '0', max: '1', step: '0.01', 'aria-label': 'Opacity', class: 'wds-color__alpha' });
    var swatchFill = el('div', { class: 'wds-color__swatch-fill' });
    var swatch = el('div', { class: 'wds-color__swatch' }, swatchFill);
    var input = el('input', { class: 'field__input', type: 'text', spellcheck: 'false',
      'aria-label': 'Colour value in any supported format' });
    var formats = el('div', { class: 'wds-color__formats' });
    var warn = el('p', { class: 'field__help' });
    var contrast = el('p', { class: 'muted t-body-small' });

    function current() {
      var rgb = hsvToRgb(h, s, v);
      return { rgb: rgb, a: a, css: a < 1 ? toHexString(rgb, a) : toHexString(rgb) };
    }
    function paint(skipInput) {
      var c = current();
      field.style.background =
        'linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ' + toHexString(hsvToRgb(h, 1, 1)) + ')';
      dot.style.left = (s * 100) + '%';
      dot.style.top = ((1 - v) * 100) + '%';
      hueRange.value = String(h);
      alphaRange.value = String(a);
      /* Set a custom property rather than `background`, so the
         stylesheet keeps the alpha track's chequerboard underneath.
         Assigning the shorthand here would replace every layer, and
         "half transparent" would then look exactly like "half white". */
      hueRange.style.setProperty('--wds-hue-overlay', 'linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)');
      alphaRange.style.setProperty('--wds-alpha-overlay', 'linear-gradient(to right, transparent, ' + toHexString(c.rgb) + ')');
      swatchFill.style.background = c.css;
      if (!skipInput) input.value = c.css;
      var tr = translateColor(c.css);
      clear(formats);
      if (tr) {
        [['Named', tr.named || '(no CSS name)'], ['HEX', tr.hex], ['HEX8', tr.hex8], ['RGB', tr.rgb], ['RGBA', tr.rgba],
          ['HSL', tr.hsl], ['HSLA', tr.hsla], ['HSV', tr.hsv], ['HWB', tr.hwb], ['LAB', tr.lab], ['LCH', tr.lch],
          ['OKLab', tr.oklab], ['OKLCH', tr.oklch], ['CMYK', tr.cmyk]].forEach(function (pair) {
          formats.appendChild(el('div', { class: 'wds-color__row' }, [
            el('span', { class: 'wds-color__name', text: pair[0] }),
            el('span', { class: 'wds-color__value', text: pair[1] }),
            el('button', { class: 'btn btn--icon', type: 'button', 'aria-label': t('act.copy') + ' ' + pair[0],
              onclick: function () { copyText(pair[1]); } }, icon('copy'))
          ]));
        });
        formats.appendChild(el('p', { class: 'muted t-body-small', text: tr.cmykNote }));
        contrast.textContent = 'Contrast against white ' + tr.contrastOnWhite + ':1, against black ' + tr.contrastOnBlack + ':1.';
        warn.textContent = tr.clipped
          ? 'That value sits outside what this screen can show, so it was clipped to the nearest colour inside sRGB.'
          : '';
      }
      if (onChange) onChange(c.css, c);
    }
    function fromPointer(e) {
      var r = field.getBoundingClientRect();
      s = clamp((e.clientX - r.left) / r.width, 0, 1);
      v = clamp(1 - (e.clientY - r.top) / r.height, 0, 1);
      paint();
    }
    field.addEventListener('pointerdown', function (e) { field.setPointerCapture(e.pointerId); fromPointer(e); e.preventDefault(); });
    field.addEventListener('pointermove', function (e) { if (e.buttons) fromPointer(e); });
    field.addEventListener('keydown', function (e) {
      var step = e.shiftKey ? 0.1 : 0.02, done = true;
      if (e.key === 'ArrowLeft') s = clamp(s - step, 0, 1);
      else if (e.key === 'ArrowRight') s = clamp(s + step, 0, 1);
      else if (e.key === 'ArrowUp') v = clamp(v + step, 0, 1);
      else if (e.key === 'ArrowDown') v = clamp(v - step, 0, 1);
      else done = false;
      if (done) { e.preventDefault(); paint(); }
    });
    hueRange.addEventListener('input', function () { h = parseFloat(hueRange.value); paint(); });
    alphaRange.addEventListener('input', function () { a = parseFloat(alphaRange.value); paint(); });
    input.addEventListener('change', function () {
      var p = parseColor(input.value);
      if (!p) { warn.textContent = 'That is not a colour this site can read. Try a hex value, or rgb(), hsl(), lab(), oklch() and the rest.'; return; }
      var nh = rgbToHsv(p.rgb[0], p.rgb[1], p.rgb[2]);
      h = nh[0]; s = nh[1]; v = nh[2]; a = p.a;
      paint(true);
    });

    var swatches = el('div', { class: 'chipset' });
    var presetColours = ['#006D34', '#62DE89', '#46664D', '#006973', '#BF002A', '#F3FCF4', '#0D150F', '#FFFFFF', '#000000'];
    presetColours.concat(recentColours).slice(0, 24).forEach(function (cval) {
      swatches.appendChild(el('button', {
        class: 'chip', type: 'button', title: cval, 'aria-label': 'Use ' + cval,
        style: { background: cval, 'min-width': '44px', 'min-height': '32px' },
        onclick: function () { input.value = cval; input.dispatchEvent(new Event('change')); }
      }, el('span', { class: 'visually-hidden', text: cval })));
    });

    var tools = el('div', { class: 'row' });
    if (window.EyeDropper) {
      tools.appendChild(el('button', {
        class: 'btn btn--outlined', type: 'button', text: 'Pick from the screen',
        onclick: function () {
          try {
            new window.EyeDropper().open().then(function (res) {
              input.value = res.sRGBHex; input.dispatchEvent(new Event('change'));
            }, function () {});
          } catch (e) { notify.warn('The eyedropper was refused by this browser.'); }
        }
      }));
    } else {
      tools.appendChild(el('p', { class: 'muted t-body-small', text: 'This browser has no screen eyedropper, so type or paste a value instead.' }));
    }
    tools.appendChild(el('button', {
      class: 'btn btn--text', type: 'button', text: 'Remember this colour',
      onclick: function () {
        var c = current().css;
        recentColours = [c].concat(recentColours.filter(function (x) { return x !== c; })).slice(0, 12);
        store.set('appearance.recentColours', recentColours);
        notify.success('Added ' + c + ' to the recent colours.');
      }
    }));

    var wrap = el('div', { class: 'wds-color' }, [
      swatch, field, hueRange, alphaRange,
      el('div', { class: 'field field--outlined field--dense' }, [
        el('span', { class: 'field__label', text: 'Value in any format' }),
        el('div', { class: 'field__box' }, input),
        warn
      ]),
      contrast, swatches, tools,
      el('details', {}, [el('summary', { text: 'Every representation of this colour' }), formats])
    ]);
    paint();
    return { el: wrap, value: function () { return current().css; }, set: function (v2) { input.value = v2; input.dispatchEvent(new Event('change')); } };
  }

  function appearanceControl(spec, key, refresh) {
    var rules = appearanceRules[key] || {};
    var value = rules[spec.css];
    var row = el('div', { class: 'stack', style: { gap: '4px' } });
    var supported = supportsProp(spec.css, spec.kind === 'colour' ? '#000' : undefined);
    var head = el('div', { class: 'row', style: { 'justify-content': 'space-between' } }, [
      el('span', { class: 'cap', text: spec.label }),
      el('button', {
        class: 'btn btn--text', type: 'button', text: t('act.reset'),
        'aria-label': t('act.reset') + ' ' + spec.label,
        onclick: function () { setValue(null); }
      })
    ]);
    row.appendChild(head);

    function setValue(v) {
      appearanceRules[key] = appearanceRules[key] || {};
      if (v === null || v === '' || v === undefined) delete appearanceRules[key][spec.css];
      else appearanceRules[key][spec.css] = v;
      if (!Object.keys(appearanceRules[key]).length) delete appearanceRules[key];
      store.set('appearance.elements', appearanceRules);
      appearanceApplyAll();
      history.record('appearance', 'Appearance of "' + (appearanceLabels[key] || key) + '": ' + spec.label + (v ? ' set to ' + v : ' reset'), { key: key, prop: spec.css, value: v });
      if (refresh) refresh();
    }

    if (!supported) {
      /* An unsupported property stays visible with the reason, rather
         than vanishing and leaving the visitor to wonder where it
         went, and rather than silently dropping a stored value. */
      row.appendChild(el('p', { class: 'muted t-body-small', text: 'This browser does not support ' + spec.css + ', so setting it here would have no effect. The control stays listed so you can see it exists.' }));
      return row;
    }

    if (spec.kind === 'colour') {
      var preview = el('span', { class: 'wds-color__swatch', style: { width: '40px', height: '28px', background: value || 'transparent' } });
      row.appendChild(el('div', { class: 'row' }, [
        preview,
        el('button', {
          class: 'btn btn--outlined', type: 'button', text: value || 'Choose a colour',
          onclick: function (e) {
            var picker = colourPicker(value || '#006D34', function (v) { setValue(v); preview.style.background = v; });
            openOverlay({ anchor: e.currentTarget, returnTo: e.currentTarget, title: spec.label, content: picker.el, resizable: true, persistKey: 'colour-picker' });
          }
        })
      ]));
    } else if (spec.kind === 'select') {
      var sel = createSelect({
        ariaLabel: spec.label, value: value || spec.options[0],
        options: [{ value: '', label: '(not set)' }].concat(spec.options.map(function (o) { return { value: o, label: o }; })),
        onChange: function (v) { setValue(v || null); }
      });
      row.appendChild(sel.el);
    } else if (spec.kind === 'font') {
      var fonts = theme.fonts();
      var fsel = createSelect({
        ariaLabel: spec.label, value: value || '',
        options: [{ value: '', label: '(not set)' }].concat(fonts.map(function (f) {
          return { value: f.stack, label: f.label + (f.available ? '' : ' — not installed on this computer'), disabled: false };
        })),
        onChange: function (v) { setValue(v || null); }
      });
      row.appendChild(fsel.el);
      var custom = el('input', { class: 'field__input', type: 'text', placeholder: 'Or type a family name', value: '' });
      custom.addEventListener('change', function () { setValue(custom.value ? '"' + custom.value.replace(/"/g, '') + '", sans-serif' : null); });
      row.appendChild(el('div', { class: 'field field--outlined field--dense' }, el('div', { class: 'field__box' }, custom)));
    } else if (spec.kind === 'length') {
      var numeric = parseFloat(value);
      var range = el('input', {
        type: 'range', min: String(spec.min), max: String(spec.max), step: String(spec.step),
        value: String(isNaN(numeric) ? spec.min : numeric), 'aria-label': spec.label
      });
      var free = el('input', { class: 'field__input', type: 'text', value: value || '', 'aria-label': spec.label + ', typed value' });
      range.addEventListener('input', function () { free.value = range.value + spec.unit; setValue(free.value); });
      free.addEventListener('change', function () { setValue(free.value || null); });
      row.appendChild(el('div', { class: 'slider' }, el('div', { class: 'slider__row' }, [range, free])));
    } else {
      var text = el('input', { class: 'field__input', type: 'text', value: value || '', placeholder: spec.placeholder || '', 'aria-label': spec.label });
      text.addEventListener('change', function () { setValue(text.value || null); });
      row.appendChild(el('div', { class: 'field field--outlined field--dense' }, el('div', { class: 'field__box' }, text)));
    }
    return row;
  }

  function openAppearanceEditor(anchor, key, labelText) {
    appearanceLabels[key] = labelText || key;
    var body = el('div', { class: 'wds-appearance' });
    body.appendChild(el('p', { class: 'wds-appearance__target', text: 'Editing: ' + (labelText || key) + '  [' + key + ']' }));

    var search = createSearchBar({
      ariaLabel: 'Search appearance properties', placeholder: 'Search properties',
      storageKey: 'appearance-props', onChange: render
    });
    body.appendChild(search.el);
    var typoWrap = el('div', { class: 'stack' });
    var boxWrap = el('div', { class: 'stack' });
    var typoDetails = el('details', { open: true }, [el('summary', { text: 'Typography' }), typoWrap]);
    var boxDetails = el('details', {}, [el('summary', { text: 'Shape, border and elevation' }), boxWrap]);
    body.appendChild(typoDetails);
    body.appendChild(boxDetails);

    function render() {
      clear(typoWrap); clear(boxWrap);
      var m = search.matcher();
      TYPO_PROPS.filter(function (p) { return m(p.label + ' ' + p.css); })
        .forEach(function (p) { typoWrap.appendChild(appearanceControl(p, key, null)); });
      BOX_PROPS.filter(function (p) { return m(p.label + ' ' + p.css); })
        .forEach(function (p) { boxWrap.appendChild(appearanceControl(p, key, null)); });
      if (!typoWrap.childNodes.length) typoWrap.appendChild(el('p', { class: 'muted', text: t('msg.noMatch') }));
      if (!boxWrap.childNodes.length) boxWrap.appendChild(el('p', { class: 'muted', text: t('msg.noMatch') }));
    }
    render();

    var h = openOverlay({
      anchor: anchor, returnTo: anchor,
      title: t('act.openEditor') + ': ' + (labelText || key),
      content: body,
      modal: false, backdrop: false,
      draggable: true, resizable: true, persistKey: 'appearance-editor',
      footer: [
        el('button', {
          class: 'btn btn--text', type: 'button', text: 'Reset this element',
          onclick: function () {
            delete appearanceRules[key];
            store.set('appearance.elements', appearanceRules);
            appearanceApplyAll(); render();
            history.record('appearance', 'Appearance of "' + (labelText || key) + '" reset', { key: key });
            notify.success('Reset every appearance change on this element.');
          }
        }),
        el('button', { class: 'btn btn--filled', type: 'button', text: t('act.close'), onclick: function () { h.close('close'); } })
      ]
    });
    return h;
  }

  var appearance = {
    /* Give any element its key, its context-menu entry, its
       Shift+right-click shortcut and its keyboard equivalent. */
    enable: function (node, key, labelText) {
      if (!node || node.dataset.wdsAkey === key) return node;
      node.dataset.wdsAkey = key;
      appearanceLabels[key] = labelText || key;
      node.addEventListener('contextmenu', function (e) {
        if (!e.shiftKey) return;
        e.preventDefault(); e.stopPropagation();
        openAppearanceEditor(node, key, labelText);
      }, true);
      node.addEventListener('keydown', function (e) {
        if (e.altKey && e.shiftKey && (e.key === 'E' || e.key === 'e')) {
          e.preventDefault(); openAppearanceEditor(node, key, labelText);
        }
      });
      return node;
    },
    openEditor: openAppearanceEditor,
    colourPicker: colourPicker,
    translate: translateColor,
    parse: parseColor,
    contrast: function (a, b) {
      var pa = parseColor(a), pb = parseColor(b);
      if (!pa || !pb) return null;
      return round(contrastRatio(pa.rgb, pb.rgb), 2);
    },
    applyAll: appearanceApplyAll,
    rules: function () { return JSON.parse(JSON.stringify(appearanceRules)); },
    reset: function (key) {
      delete appearanceRules[key];
      store.set('appearance.elements', appearanceRules);
      appearanceApplyAll();
    },
    resetAll: function () {
      appearanceRules = {};
      store.set('appearance.elements', appearanceRules);
      appearanceApplyAll();
      history.record('appearance', 'Every per-element appearance change reset', {});
    },
    /* Presets are derived from the real shipped defaults, never from
       an invented starting point, so a preset and the reset path can
       never disagree about what the defaults actually are. */
    presets: function () {
      return [
        { id: 'shipped', label: 'Shipped defaults',
          describes: 'Theme follows the system, comfortable density, the shipped green accent, the system font at 100 per cent.',
          apply: function () { theme.reset(); appearance.resetAll(); } },
        { id: 'readable', label: 'Easier to read',
          describes: 'Comfortable density, text at 115 per cent, heavier labels. Theme and accent are left as you set them.',
          apply: function () { theme.setDensity('comfortable'); theme.setFontScale(1.15); theme.setFontWeight('bold'); } },
        { id: 'compact', label: 'More on screen',
          describes: 'Compact density, text at 92 per cent. Theme and accent are left as you set them.',
          apply: function () { theme.setDensity('compact'); theme.setFontScale(0.92); theme.setFontWeight('normal'); } },
        { id: 'calm', label: 'Calm',
          describes: 'Reduced motion, comfortable density, dark theme, text at 100 per cent.',
          apply: function () { theme.setMotion('reduced'); theme.setDensity('comfortable'); theme.setMode('dark'); theme.setFontScale(1); } }
      ];
    }
  };
  appearanceApplyAll();

  /* ================================================================
   * 19. The command palette
   *
   * Ctrl+Shift+F, over every command, page, article, setting and
   * appearance control the site registers. Rows are RICH: a setting
   * row renders its live control inline, wired to the same code the
   * originating surface uses, so the two can never disagree about what
   * the value is. Selecting a result teleports to the exact element --
   * opens the page, selects the tab, reveals it, scrolls it into view,
   * focuses it and briefly highlights it.
   * ================================================================ */
  var paletteItems = [];
  var paletteOpenHandle = null;

  function paletteRegister(items) {
    (Array.isArray(items) ? items : [items]).forEach(function (it) {
      paletteItems.push({
        id: it.id || uid('pi'),
        title: it.titleKey ? t(it.titleKey) : (it.title || ''),
        titleKey: it.titleKey || null,
        subtitle: it.subtitle || '',
        kind: it.kind || 'command',
        keywords: it.keywords || '',
        page: it.page || null,
        target: it.target || null,
        tabStrip: it.tabStrip || null,
        tabId: it.tabId || null,
        control: it.control || null,
        run: it.run || null,
        locked: it.locked || null
      });
    });
    return paletteItems.length;
  }

  function resolveTarget(item) {
    if (!item.target) return null;
    if (item.target instanceof Element) return item.target;
    try { return document.querySelector(item.target); } catch (e) { return null; }
  }

  function paletteTeleport(item) {
    /* A different page: carry the target in the URL so the
       destination can finish the job on load. */
    if (item.page && item.page !== currentPagePath()) {
      var url = item.page + (item.page.indexOf('?') >= 0 ? '&' : '?') + 'teleport=' + encodeURIComponent(item.id);
      window.location.href = url;
      return true;
    }
    if (item.tabStrip && item.tabId) {
      var s = allStrips.filter(function (x) { return x.id === item.tabStrip; })[0];
      if (s) s.select(item.tabId);
    }
    var node = resolveTarget(item);
    if (!node) { if (item.run) item.run(); return true; }
    /* Reveal it even when it sits inside a collapsed disclosure or a
       hidden tab panel, without destroying the visitor's collapsed
       preference elsewhere. */
    var p = node.parentElement;
    while (p) {
      if (p.tagName === 'DETAILS' && !p.open) p.open = true;
      if (p.classList && p.classList.contains('wds-collapse') && p.dataset.open === 'false') p.dataset.open = 'true';
      p = p.parentElement;
    }
    node.scrollIntoView({ block: 'center', behavior: a11y.reducedMotion() ? 'auto' : 'smooth' });
    var focusable = node.matches('a,button,input,select,textarea,[tabindex]') ? node : node.querySelector('a,button,input,select,textarea,[tabindex]');
    if (focusable && focusable.focus) { try { focusable.focus({ preventScroll: true }); } catch (e) { focusable.focus(); } }
    else { node.setAttribute('tabindex', '-1'); node.focus({ preventScroll: true }); }
    flashTarget(node);
    return true;
  }

  function currentPagePath() {
    var p = window.location.pathname.split('/').pop();
    return p || 'index.html';
  }

  function openPalette() {
    if (paletteOpenHandle) { paletteOpenHandle.close('toggle'); paletteOpenHandle = null; return; }
    var size = store.get('palette.size', 'card');
    var listNode = el('div', { class: 'wds-palette__list', role: 'listbox', 'aria-label': t('palette.title') });
    var countNode = el('span', { role: 'status', 'aria-live': 'polite' });
    var search = createSearchBar({
      ariaLabel: t('palette.title'), placeholder: t('palette.hint'),
      storageKey: 'palette', onChange: render,
      sampleProvider: function () { return paletteItems.map(function (i) { return i.title; }).join('\n'); }
    });
    var sizeBtn = el('button', {
      class: 'btn btn--icon', type: 'button', 'aria-label': t('palette.size'),
      title: t('palette.size'),
      onclick: function () {
        size = size === 'card' ? 'full' : 'card';
        store.set('palette.size', size);
        panel.setAttribute('data-size', size);
      }
    }, icon('grid'));

    var panel = el('div', { class: 'wds-palette', 'data-size': size, role: 'dialog', 'aria-modal': 'true', 'aria-label': t('palette.title') }, [
      el('div', { class: 'wds-palette__head' }, [search.el, sizeBtn]),
      listNode,
      el('div', { class: 'wds-palette__foot' }, [
        countNode,
        el('span', { text: 'Enter to go there' }),
        el('span', { text: 'Escape to close' }),
        el('span', { text: 'Ctrl+Shift+F to open this again' })
      ])
    ]);
    var scrim = el('div', {
      class: 'wds-palette-scrim',
      onpointerdown: function (e) { if (e.target === scrim) close('outside'); }
    }, panel);
    document.body.appendChild(scrim);

    var rows = [];
    function render() {
      clear(listNode); rows = [];
      var m = search.matcher();
      var shown = paletteItems.filter(function (it) {
        return m(it.title + ' ' + it.subtitle + ' ' + it.kind + ' ' + it.keywords);
      });
      countNode.textContent = shown.length + ' of ' + paletteItems.length;
      if (!shown.length) {
        listNode.appendChild(el('p', { class: 'menu__empty', text: t('msg.noMatch') }));
        return;
      }
      shown.slice(0, 300).forEach(function (it, idx) {
        var row = el('div', {
          class: 'wds-palette__row', role: 'option', tabindex: '-1',
          'aria-selected': idx === 0 ? 'true' : 'false',
          onclick: function (e) {
            if (e.target.closest('.wds-palette__ctl')) return;
            activate(it);
          }
        });
        row.appendChild(el('span', { class: 'wds-palette__kind', text: it.kind }));
        var text = el('span', { class: 'wds-palette__text' }, [
          el('span', { class: 'wds-palette__title', text: it.title }),
          el('span', { class: 'wds-palette__sub', text: it.subtitle || (it.page ? it.page : '') })
        ]);
        row.appendChild(text);
        if (it.locked && locks.isLocked(it.locked)) {
          row.appendChild(el('span', { class: 'status', text: t('locks.locked') }));
        }
        /* The rich half: a setting result renders its real control. */
        if (typeof it.control === 'function') {
          var ctl = el('span', { class: 'wds-palette__ctl' });
          try { append(ctl, it.control()); } catch (e) { report(e); }
          row.appendChild(ctl);
        }
        listNode.appendChild(row);
        rows.push({ node: row, item: it });
      });
      if (rows.length) setActive(0);
    }
    var activeIndex = 0;
    function setActive(i) {
      activeIndex = clamp(i, 0, rows.length - 1);
      rows.forEach(function (r, n) {
        r.node.classList.toggle('is-active', n === activeIndex);
        r.node.setAttribute('aria-selected', n === activeIndex ? 'true' : 'false');
      });
      if (rows[activeIndex]) rows[activeIndex].node.scrollIntoView({ block: 'nearest' });
    }
    function activate(item) {
      close('activate');
      if (item.locked && locks.isLocked(item.locked) && !locks.isUnlocked(item.locked)) {
        locks.promptUnlock(document.body, item.locked, item.title, function () { paletteTeleport(item); });
        return;
      }
      if (item.run && !item.target && !item.page) { item.run(); return; }
      paletteTeleport(item);
    }
    function close(reason) {
      if (scrim.parentNode) scrim.parentNode.removeChild(scrim);
      paletteOpenHandle = null;
      try { release(); } catch (e) {}
    }
    panel.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.stopPropagation(); close('escape'); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive(activeIndex + 1); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setActive(activeIndex - 1); return; }
      if (e.key === 'Enter' && rows[activeIndex]) { e.preventDefault(); activate(rows[activeIndex].item); }
    });
    var release = a11y.trapFocus(panel, { initial: search.input });
    render();
    paletteOpenHandle = { close: close, el: panel };
    return paletteOpenHandle;
  }

  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey && e.shiftKey && (e.key === 'F' || e.key === 'f')) {
      e.preventDefault();
      openPalette();
    }
  });

  var palette = {
    register: paletteRegister,
    items: function () { return paletteItems.slice(); },
    open: openPalette,
    close: function () { if (paletteOpenHandle) paletteOpenHandle.close('programmatic'); },
    teleport: paletteTeleport,
    shortcut: 'Ctrl+Shift+F'
  };

  /* ================================================================
   * 20. Toy locks
   *
   * Every rendered element and every appearance value can be locked,
   * and EVERY lock carries its own credential. There is no master
   * credential and no inheritance: unlocking a tab never unlocks the
   * font size inside it, and locking a group does not silently relock
   * its members under the group's password.
   *
   * It is for fun. Every surface says so, names the recovery route,
   * and never describes itself as securing, protecting or encrypting
   * anything, because it does none of those things.
   * ================================================================ */
  var lockStore = store.get('locks', {});
  var unlockedUntil = Object.create(null);

  function lockRecord(key) { return lockStore[key] || null; }
  function lockSave() { store.set('locks', lockStore); }

  var locks = {
    list: function () {
      return Object.keys(lockStore).map(function (k) {
        return {
          key: k, label: lockStore[k].label || k, kind: lockStore[k].kind,
          createdAt: lockStore[k].createdAt, duration: lockStore[k].duration,
          unlocked: locks.isUnlocked(k)
        };
      });
    },
    isLocked: function (key) { return !!lockStore[key]; },
    isUnlocked: function (key) {
      if (!lockStore[key]) return true;
      var until = unlockedUntil[key];
      if (until === Infinity) return true;
      return !!until && Date.now() < until;
    },
    remove: function (key) {
      if (!lockStore[key]) return false;
      delete lockStore[key]; delete unlockedUntil[key];
      lockSave();
      history.record('locks', 'Lock removed from "' + key + '"', { key: key });
      return true;
    },
    relock: function (key) { delete unlockedUntil[key]; emit('locks', { key: key }); },

    /* One wizard per element, anchored beside that exact element, and
       it names the target rather than saying "this item". */
    wizard: function (anchor, key, labelText) {
      if (lockStore[key]) { locks.manage(anchor, key); return; }
      var kind = 'password';
      var duration = 'surface';
      var pw = el('input', { class: 'field__input', type: 'password', autocomplete: 'new-password', 'aria-describedby': 'lockwarn' });
      var pw2 = el('input', { class: 'field__input', type: 'password', autocomplete: 'new-password' });
      var otpSecret = base32Encode(randomBytes(20));
      var otpConfirm = el('input', { class: 'field__input', type: 'text', inputmode: 'numeric', autocomplete: 'one-time-code' });
      var pwWrap = el('div', { class: 'stack' }, [
        el('div', { class: 'field field--outlined' }, [
          el('span', { class: 'field__label', text: 'Password for this element' }),
          el('div', { class: 'field__box' }, pw)
        ]),
        el('div', { class: 'field field--outlined' }, [
          el('span', { class: 'field__label', text: 'Type it again' }),
          el('div', { class: 'field__box' }, pw2)
        ])
      ]);
      var otpWrap = el('div', { class: 'stack', hidden: true });
      var kindSel = createSelect({
        label: 'How this element unlocks', value: 'password',
        options: [{ value: 'password', label: 'A password' }, { value: 'totp', label: 'A one-time code from an authenticator' }],
        onChange: function (v) {
          kind = v;
          pwWrap.hidden = v !== 'password';
          otpWrap.hidden = v !== 'totp';
          if (v === 'totp' && !otpWrap.childNodes.length) buildOtp();
        }
      });
      function buildOtp() {
        var uri = otpauthUri({ issuer: 'World Downloader Studio site', account: labelText || key, secret: otpSecret });
        otpWrap.appendChild(el('p', { text: t('auth.scan') }));
        otpWrap.appendChild(qrSvg(uri, { size: 200, label: 'Pairing code for ' + (labelText || key) }));
        otpWrap.appendChild(el('p', { class: 'wds-secret', text: otpSecret.match(/.{1,4}/g).join(' ') }));
        otpWrap.appendChild(el('p', { class: 'muted t-body-small', text: 'Algorithm SHA-1, 6 digits, 30 second period.' }));
        otpWrap.appendChild(el('div', { class: 'field field--outlined' }, [
          el('span', { class: 'field__label', text: 'Type a current code to confirm the pairing' }),
          el('div', { class: 'field__box' }, otpConfirm)
        ]));
      }
      var durSel = createSelect({
        label: 'Stay unlocked for', value: 'surface',
        options: [
          { value: 'surface', label: 'This surface only' },
          { value: '5', label: '5 minutes' }, { value: '30', label: '30 minutes' },
          { value: 'session', label: 'Until this page is closed' }
        ],
        onChange: function (v) { duration = v; }
      });

      var body = el('div', { class: 'stack' }, [
        el('p', { text: 'Locking: ' + (labelText || key) }),
        el('p', { class: 'note note--warn', id: 'lockwarn', text: t('msg.notSecurity') }),
        el('p', { class: 'muted', text: t('locks.own') }),
        kindSel.el, pwWrap, otpWrap, durSel.el,
        el('p', { class: 'note--plain', text: t('msg.clearReset') + ' The key is "' + NS + 'locks" in this browser\'s local storage for ' + window.location.origin + '.' })
      ]);
      var h = openOverlay({
        anchor: anchor, returnTo: anchor,
        title: t('locks.lockThis') + ': ' + (labelText || key),
        content: body,
        footer: [
          el('button', { class: 'btn btn--text', type: 'button', text: t('act.cancel'), onclick: function () { h.close('cancel'); } }),
          el('button', {
            class: 'btn btn--filled', type: 'button', text: t('act.lock'),
            onclick: function () {
              if (kind === 'password') {
                if (!pw.value) { notify.warn('Type a password first.'); pw.focus(); return; }
                if (pw.value !== pw2.value) { notify.error('The two passwords do not match.'); pw2.focus(); return; }
                lockStore[key] = { kind: 'password', label: labelText || key, cred: makeCredential(pw.value), createdAt: nowIso(), duration: duration };
              } else {
                var want = totpCode(otpSecret, { algorithm: 'SHA-1', digits: 6, period: 30 });
                if (String(otpConfirm.value).trim() !== want) {
                  notify.error('That code did not match the one this page expects right now. Check your authenticator and try the current code.');
                  otpConfirm.focus(); return;
                }
                lockStore[key] = { kind: 'totp', label: labelText || key, secret: otpSecret, algorithm: 'SHA-1', digits: 6, period: 30, createdAt: nowIso(), duration: duration };
              }
              lockSave();
              history.record('locks', 'Lock created on "' + (labelText || key) + '"', { key: key, kind: kind });
              notify.success('Locked "' + (labelText || key) + '". ' + t('msg.notSecurity'));
              emit('locks', { key: key });
              h.close('locked');
            }
          })
        ]
      });
    },

    promptUnlock: function (anchor, key, labelText, onOk) {
      var rec = lockRecord(key);
      if (!rec) { if (onOk) onOk(); return; }
      var input = el('input', {
        class: 'field__input',
        type: rec.kind === 'password' ? 'password' : 'text',
        inputmode: rec.kind === 'password' ? null : 'numeric',
        autocomplete: rec.kind === 'password' ? 'current-password' : 'one-time-code'
      });
      var msg = el('p', { class: 'field__help' });
      var attempts = 0, blockedUntil = 0;
      function attempt() {
        if (Date.now() < blockedUntil) {
          msg.textContent = 'Too many tries. Wait a few seconds and try again. Nothing was lost.';
          return;
        }
        var ok = rec.kind === 'password'
          ? checkCredential(rec.cred, input.value)
          : String(input.value).trim() === totpCode(rec.secret, { algorithm: rec.algorithm, digits: rec.digits, period: rec.period });
        if (!ok) {
          attempts++;
          if (attempts >= 5) { blockedUntil = Date.now() + 5000; attempts = 0; }
          msg.textContent = t('school.pinWrong');
          input.select();
          return;
        }
        var d = rec.duration;
        unlockedUntil[key] = d === 'session' || d === 'surface' ? Infinity : Date.now() + parseInt(d, 10) * 60000;
        emit('locks', { key: key, unlocked: true });
        h.close('unlocked');
        if (onOk) onOk();
      }
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); attempt(); } });
      var h = openOverlay({
        anchor: anchor, returnTo: anchor,
        title: t('act.unlock') + ': ' + (labelText || rec.label || key),
        content: el('div', { class: 'stack' }, [
          el('div', { class: 'field field--outlined' }, [
            el('span', { class: 'field__label', text: rec.kind === 'password' ? 'Password' : 'Current one-time code' }),
            el('div', { class: 'field__box' }, input), msg
          ]),
          el('p', { class: 'muted t-body-small', text: t('msg.notSecurity') }),
          el('button', {
            class: 'btn btn--text', type: 'button', text: t('locks.forgot'),
            onclick: function () { h.close('tickets'); support.open(anchor); }
          }),
          el('p', { class: 'note--plain', text: t('msg.clearReset') })
        ]),
        footer: [
          el('button', { class: 'btn btn--text', type: 'button', text: t('act.cancel'), onclick: function () { h.close('cancel'); } }),
          el('button', { class: 'btn btn--filled', type: 'button', text: t('act.unlock'), onclick: attempt })
        ],
        initialFocus: input
      });
    },

    /* A real list: enumerable, searchable, individually removable, and
       manageable in bulk like every other list on the site. */
    manage: function (anchor) {
      var listWrap = el('div');
      var search = createSearchBar({
        ariaLabel: 'Search locks', placeholder: t('act.search'),
        storageKey: 'locks', onChange: render
      });
      var ctl = null;
      function visible() {
        var m = search.matcher();
        return locks.list().filter(function (l) { return m(l.label + ' ' + l.key + ' ' + l.kind); });
      }
      function render() {
        clear(listWrap);
        var rows = visible();
        if (!rows.length) { listWrap.appendChild(el('p', { class: 'muted', text: locks.list().length ? t('msg.noMatch') : 'Nothing is locked yet.' })); return; }
        var ul = el('ul', { class: 'list' });
        rows.forEach(function (l) {
          ul.appendChild(el('li', { class: 'li', 'data-bulk-item': '', 'data-id': l.key }, [
            icon(l.unlocked ? 'unlock' : 'lock'),
            el('span', { class: 'li__t' }, [
              el('span', { class: 'li__h', text: l.label }),
              el('span', { class: 'li__s', text: l.key + ' · ' + (l.kind === 'totp' ? 'one-time code' : 'password') + ' · created ' + new Date(l.createdAt).toLocaleString() })
            ]),
            el('button', { class: 'btn btn--text', type: 'button', text: t('act.remove'), onclick: function (e) {
              e.stopPropagation();
              confirmDestructive({
                anchor: e.currentTarget, returnTo: e.currentTarget, action: 'Remove this lock',
                target: l.label, detail: 'The element stops being locked. Nothing else changes.'
              }).then(function (ok) { if (ok) { locks.remove(l.key); render(); } });
            } })
          ]));
        });
        listWrap.appendChild(ul);
        if (ctl) ctl.destroy();
        ctl = bulk.attach(ul, {
          getLabel: function (id) { return (lockStore[id] && lockStore[id].label) || id; },
          allMatchingCount: function () { return visible().length; },
          allMatchingIds: function () { return visible().map(function (l) { return l.key; }); },
          actions: [
            { id: 'relock', label: 'Lock again now', run: function (ids) { ids.forEach(locks.relock); render(); } },
            { id: 'export', label: t('act.export'), run: function (ids) {
              exportDialog(locks.list().filter(function (l) { return ids.indexOf(l.key) >= 0; })
                .map(function (l) { return { key: l.key, label: l.label, kind: l.kind, createdAt: l.createdAt }; }),
              { name: 'locks', anchor: anchor, omitted: 'Passwords and one-time-code secrets are left out of this file.' });
            } },
            { id: 'remove', label: t('act.remove'), danger: true, destructive: true,
              run: function (ids) { ids.forEach(locks.remove); render(); } }
          ]
        });
      }
      render();
      return openOverlay({
        anchor: anchor, returnTo: anchor, title: t('locks.title'),
        content: el('div', { class: 'stack' }, [
          search.el,
          el('p', { class: 'muted', text: t('locks.own') }),
          listWrap,
          el('p', { class: 'note--plain', text: t('msg.clearReset') })
        ]),
        resizable: true, draggable: true, persistKey: 'locks-manager'
      });
    },

    /* Put a veil over a locked region so the lock is visible rather
       than merely enforced somewhere else. */
    veil: function (node, key, labelText) {
      if (!locks.isLocked(key) || locks.isUnlocked(key)) {
        node.classList.remove('wds-locked');
        var old = node.querySelector(':scope > .wds-lock-veil');
        if (old) old.parentNode.removeChild(old);
        return;
      }
      if (node.querySelector(':scope > .wds-lock-veil')) return;
      node.classList.add('wds-locked');
      var btn = el('button', {
        class: 'btn btn--tonal wds-lock-veil__btn', type: 'button',
        onclick: function () { locks.promptUnlock(btn, key, labelText, function () { locks.veil(node, key, labelText); }); }
      }, [icon('lock'), el('span', { text: t('act.unlock') + ': ' + (labelText || key) })]);
      node.appendChild(el('div', { class: 'wds-lock-veil' }, btn));
    }
  };

  /* ================================================================
   * 21. Support Tickets
   *
   * The recovery route, dressed as a support desk. The joke is the
   * point; the resolution does the only thing that actually works,
   * which is telling you how to clear this site's storage yourself.
   *
   * One plain line, outside the comedy and unstyled by the funny
   * level, states that nothing is sent anywhere. Nobody should sit
   * waiting for a reply that was never coming.
   * ================================================================ */
  var TICKET_STATES = ['Received', 'Triaged', 'Assigned to an engineer', 'Awaiting your reply', 'Resolved'];
  var tickets = store.get('tickets', []);

  var support = {
    list: function () { return tickets.slice(); },
    create: function (category, description) {
      var ticket = {
        id: 'WDS-' + String(Math.floor(Math.random() * 900000) + 100000),
        category: category || 'Locked out', description: description || '',
        severity: 'Critical', state: 0, at: nowIso(),
        responses: ['Thank you for contacting support. Your ticket has been received and prioritised as Critical. A member of nobody will be with you shortly.']
      };
      tickets.unshift(ticket);
      store.set('tickets', tickets);
      history.record('tickets', 'Support ticket ' + ticket.id + ' opened', { id: ticket.id });
      return ticket;
    },
    advance: function (id) {
      var tk = tickets.filter(function (x) { return x.id === id; })[0];
      if (!tk) return null;
      if (tk.state < TICKET_STATES.length - 1) {
        tk.state++;
        tk.responses.push([
          'Your ticket has been triaged. Estimated response time: never, as established below.',
          'Your ticket has been assigned. The engineer is you.',
          'We require additional information, specifically whether you have tried clearing this site\'s storage.',
          'Resolution: clear this site\'s storage in your browser settings. This removes every lock, every setting and every entry on this site, which is exactly what being locked out requires.'
        ][tk.state - 1] || 'Status updated.');
        store.set('tickets', tickets);
      }
      return tk;
    },
    open: function (anchor) {
      var listWrap = el('div');
      var category = createSelect({
        label: 'What has gone wrong', value: 'Locked out',
        options: ['Locked out', 'Forgotten password', 'Lost authenticator', 'Something else entirely']
          .map(function (c) { return { value: c, label: c }; })
      });
      var desc = el('textarea', { class: 'field__input', rows: '3', 'aria-label': 'Describe the problem' });

      function render() {
        clear(listWrap);
        if (!tickets.length) { listWrap.appendChild(el('p', { class: 'muted', text: 'No tickets yet.' })); return; }
        var ul = el('ul', { class: 'list' });
        tickets.forEach(function (tk) {
          var detail = el('div', { class: 'stack', style: { gap: '4px' } });
          tk.responses.forEach(function (r) { detail.appendChild(el('p', { class: 'muted t-body-small', text: r })); });
          if (tk.state >= TICKET_STATES.length - 1) {
            detail.appendChild(el('div', { class: 'stack' }, [
              el('p', { class: 't-title-small', text: 'Resolution' }),
              el('p', { text: 'Clear this site\'s storage in your browser settings. On most browsers that is Settings, then Privacy, then site data, then this site. Everything on this site resets, which is how you get back in.' }),
              el('p', { class: 'wds-secret', text: window.location.origin }),
              el('div', { class: 'row' }, [
                el('button', { class: 'btn btn--outlined', type: 'button', text: 'Copy this site\'s address', onclick: function () { copyText(window.location.origin); } }),
                el('button', {
                  class: 'btn btn--danger', type: 'button', text: 'Clear this site\'s stored data now',
                  onclick: function (e) {
                    confirmDestructive({
                      anchor: e.currentTarget, returnTo: e.currentTarget,
                      action: 'Clear every setting, lock, history entry and authenticator entry this site has stored',
                      target: window.location.origin,
                      detail: 'Everything on this site resets: language, funny levels, theme, tabs, locks, tickets, history and authenticator entries. Your browser\'s own data for other sites is untouched.'
                    }).then(function (ok) {
                      if (!ok) return;
                      var n = store.clearAll();
                      notify.success('Cleared ' + n + ' stored entries. Reload the page to start fresh.');
                    });
                  }
                })
              ])
            ]));
          }
          ul.appendChild(el('li', { class: 'li', 'data-bulk-item': '', 'data-id': tk.id }, [
            icon('ticket'),
            el('span', { class: 'li__t' }, [
              el('span', { class: 'li__h', text: tk.id + ' · ' + tk.category }),
              el('span', { class: 'li__s', text: TICKET_STATES[tk.state] + ' · severity ' + tk.severity + ' · ' + new Date(tk.at).toLocaleString() }),
              el('details', {}, [el('summary', { text: 'Correspondence' }), detail])
            ]),
            tk.state < TICKET_STATES.length - 1
              ? el('button', { class: 'btn btn--tonal', type: 'button', text: 'Chase it up', onclick: function (e) { e.stopPropagation(); support.advance(tk.id); render(); } })
              : null
          ].filter(Boolean)));
        });
        listWrap.appendChild(ul);
        bulk.attach(ul, {
          getLabel: function (id) { return id; },
          actions: [
            { id: 'export', label: t('act.export'), run: function (ids) { exportDialog(tickets.filter(function (x) { return ids.indexOf(x.id) >= 0; }), { name: 'support-tickets', anchor: anchor }); } },
            { id: 'delete', label: t('act.delete'), danger: true, destructive: true, run: function (ids) {
              tickets = tickets.filter(function (x) { return ids.indexOf(x.id) < 0; });
              store.set('tickets', tickets); render();
            } }
          ]
        });
      }
      render();
      var h = openOverlay({
        anchor: anchor, returnTo: anchor, title: t('tickets.title'),
        content: el('div', { class: 'stack' }, [
          /* Not a note, not a banner, no emoji, no funny level. */
          el('p', { class: 'note--plain', text: t('tickets.plain') }),
          category.el,
          el('div', { class: 'field field--outlined' }, [
            el('span', { class: 'field__label', text: 'Describe the problem' }),
            el('div', { class: 'field__box' }, desc)
          ]),
          el('button', {
            class: 'btn btn--filled', type: 'button', text: 'Raise a ticket',
            onclick: function () { support.create(category.value(), desc.value); desc.value = ''; render(); }
          }),
          listWrap
        ]),
        resizable: true, draggable: true, persistKey: 'support-tickets'
      });
      return h;
    }
  };

  /* ================================================================
   * 22. QR encoding
   *
   * Drawn here, in this file, from these bytes. A remote QR service
   * would hand the secret to somebody else's server on the way to
   * rendering it, which is the one thing a pairing code must never do.
   *
   * Byte mode, error-correction level M, versions 1 to 15. That covers
   * every otpauth URI this site produces with room to spare.
   * ================================================================ */
  var QR_TOTAL = [26, 44, 70, 100, 134, 172, 196, 242, 292, 346, 404, 466, 532, 581, 655];
  /* [ec codewords per block, group1 blocks, group1 data, group2 blocks, group2 data] at level M */
  var QR_M = [
    [10, 1, 16, 0, 0], [16, 1, 28, 0, 0], [26, 1, 44, 0, 0], [18, 2, 32, 0, 0], [24, 2, 43, 0, 0],
    [16, 4, 27, 0, 0], [18, 4, 31, 0, 0], [22, 2, 38, 2, 39], [22, 3, 36, 2, 37], [26, 4, 43, 1, 44],
    [30, 1, 50, 4, 51], [22, 6, 36, 2, 37], [22, 8, 37, 1, 38], [24, 4, 40, 5, 41], [24, 5, 41, 5, 42]
  ];
  var QR_ALIGN = [[], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46],
    [6, 28, 50], [6, 30, 54], [6, 32, 58], [6, 34, 62], [6, 26, 46, 66], [6, 26, 48, 70]];

  var GF_EXP = new Uint8Array(512), GF_LOG = new Uint8Array(256);
  (function () {
    var x = 1, i;
    for (i = 0; i < 255; i++) {
      GF_EXP[i] = x; GF_LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11D;
    }
    for (i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
  })();
  function gfMul(a, b) { return (a === 0 || b === 0) ? 0 : GF_EXP[GF_LOG[a] + GF_LOG[b]]; }
  function rsGenerator(n) {
    var poly = [1], i, j;
    for (i = 0; i < n; i++) {
      var next = new Array(poly.length + 1).fill(0);
      for (j = 0; j < poly.length; j++) {
        next[j] ^= poly[j];
        next[j + 1] ^= gfMul(poly[j], GF_EXP[i]);
      }
      poly = next;
    }
    return poly;
  }
  function rsEncode(data, ecLen) {
    var gen = rsGenerator(ecLen);
    var res = new Array(ecLen).fill(0), i, j;
    for (i = 0; i < data.length; i++) {
      var factor = data[i] ^ res[0];
      res.shift(); res.push(0);
      if (factor !== 0) for (j = 0; j < gen.length - 1; j++) res[j] ^= gfMul(gen[j + 1], factor);
    }
    return res;
  }
  function bchFormat(data) {
    var d = data << 10, i;
    for (i = 4; i >= 0; i--) if (d & (1 << (i + 10))) d ^= 0x537 << i;
    return ((data << 10) | d) ^ 0x5412;
  }
  function bchVersion(version) {
    var d = version << 12, i;
    for (i = 5; i >= 0; i--) if (d & (1 << (i + 12))) d ^= 0x1F25 << i;
    return (version << 12) | d;
  }

  function qrEncode(text) {
    var bytes = utf8Bytes(text);
    var version = -1, i, j;
    for (i = 0; i < QR_M.length; i++) {
      var spec = QR_M[i];
      var capacity = spec[1] * spec[2] + spec[3] * spec[4];
      var countBits = (i + 1) < 10 ? 8 : 16;
      if (bytes.length + Math.ceil((4 + countBits) / 8) <= capacity) { version = i + 1; break; }
    }
    if (version < 0) throw new Error('That text is too long for the QR versions this site draws (up to version 15 at level M).');
    var spec = QR_M[version - 1];
    var ecLen = spec[0], g1 = spec[1], d1 = spec[2], g2 = spec[3], d2 = spec[4];
    var totalData = g1 * d1 + g2 * d2;
    var countBits = version < 10 ? 8 : 16;

    /* bit stream */
    var bits = [];
    function push(value, len) { for (var b = len - 1; b >= 0; b--) bits.push((value >>> b) & 1); }
    push(0x4, 4);
    push(bytes.length, countBits);
    for (i = 0; i < bytes.length; i++) push(bytes[i], 8);
    var remaining = totalData * 8 - bits.length;
    push(0, Math.min(4, remaining));
    while (bits.length % 8 !== 0) bits.push(0);
    var dataCw = [];
    for (i = 0; i < bits.length; i += 8) {
      var v = 0;
      for (j = 0; j < 8; j++) v = (v << 1) | bits[i + j];
      dataCw.push(v);
    }
    var padBytes = [0xEC, 0x11], p = 0;
    while (dataCw.length < totalData) { dataCw.push(padBytes[p % 2]); p++; }

    /* blocks and interleaving */
    var blocks = [], ecBlocks = [], offset = 0;
    for (i = 0; i < g1 + g2; i++) {
      var len = i < g1 ? d1 : d2;
      var blk = dataCw.slice(offset, offset + len);
      offset += len;
      blocks.push(blk);
      ecBlocks.push(rsEncode(blk, ecLen));
    }
    var out = [];
    var maxData = Math.max(d1, d2);
    for (i = 0; i < maxData; i++) {
      for (j = 0; j < blocks.length; j++) if (i < blocks[j].length) out.push(blocks[j][i]);
    }
    for (i = 0; i < ecLen; i++) {
      for (j = 0; j < ecBlocks.length; j++) out.push(ecBlocks[j][i]);
    }

    /* matrix */
    var size = version * 4 + 17;
    var m = [], reserved = [];
    for (i = 0; i < size; i++) { m.push(new Array(size).fill(0)); reserved.push(new Array(size).fill(0)); }
    function setFn(r, c, v) { m[r][c] = v; reserved[r][c] = 1; }
    function finder(r0, c0) {
      for (var r = -1; r <= 7; r++) for (var c = -1; c <= 7; c++) {
        var rr = r0 + r, cc = c0 + c;
        if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
        var on = (r >= 0 && r <= 6 && (c === 0 || c === 6)) || (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
          (r >= 2 && r <= 4 && c >= 2 && c <= 4);
        setFn(rr, cc, on ? 1 : 0);
      }
    }
    finder(0, 0); finder(0, size - 7); finder(size - 7, 0);
    for (i = 8; i < size - 8; i++) {
      setFn(6, i, i % 2 === 0 ? 1 : 0);
      setFn(i, 6, i % 2 === 0 ? 1 : 0);
    }
    var centres = QR_ALIGN[version - 1];
    for (i = 0; i < centres.length; i++) {
      for (j = 0; j < centres.length; j++) {
        var ar = centres[i], ac = centres[j];
        if ((ar === 6 && ac === 6) || (ar === 6 && ac === size - 7) || (ar === size - 7 && ac === 6)) continue;
        for (var dr = -2; dr <= 2; dr++) for (var dc = -2; dc <= 2; dc++) {
          var on2 = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
          setFn(ar + dr, ac + dc, on2 ? 1 : 0);
        }
      }
    }
    setFn(size - 8, 8, 1); /* the always-dark module */
    /* reserve format areas */
    for (i = 0; i < 9; i++) { if (!reserved[8][i]) setFn(8, i, 0); if (!reserved[i][8]) setFn(i, 8, 0); }
    for (i = 0; i < 8; i++) { if (!reserved[8][size - 1 - i]) setFn(8, size - 1 - i, 0); if (!reserved[size - 1 - i][8]) setFn(size - 1 - i, 8, 0); }
    if (version >= 7) {
      var vbits = bchVersion(version);
      for (i = 0; i < 18; i++) {
        var bit = (vbits >>> i) & 1;
        setFn(Math.floor(i / 3), size - 11 + (i % 3), bit);
        setFn(size - 11 + (i % 3), Math.floor(i / 3), bit);
      }
    }

    /* data placement, zigzag from the bottom right, skipping column 6 */
    var bitIndex = 0, upward = true;
    for (var col = size - 1; col > 0; col -= 2) {
      if (col === 6) col--;
      for (var n = 0; n < size; n++) {
        var row = upward ? size - 1 - n : n;
        for (var k = 0; k < 2; k++) {
          var cc2 = col - k;
          if (reserved[row][cc2]) continue;
          var bit2 = 0;
          if (bitIndex < out.length * 8) {
            bit2 = (out[bitIndex >>> 3] >>> (7 - (bitIndex & 7))) & 1;
          }
          m[row][cc2] = bit2;
          bitIndex++;
        }
      }
      upward = !upward;
    }

    /* mask selection by the standard penalty rules */
    function maskFn(id, r, c) {
      switch (id) {
        case 0: return (r + c) % 2 === 0;
        case 1: return r % 2 === 0;
        case 2: return c % 3 === 0;
        case 3: return (r + c) % 3 === 0;
        case 4: return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
        case 5: return ((r * c) % 2) + ((r * c) % 3) === 0;
        case 6: return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0;
        default: return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0;
      }
    }
    function penalty(grid) {
      var score = 0, r, c, run, i2, dark = 0;
      for (r = 0; r < size; r++) {
        run = 1;
        for (c = 1; c < size; c++) {
          if (grid[r][c] === grid[r][c - 1]) { run++; } else { if (run >= 5) score += 3 + (run - 5); run = 1; }
        }
        if (run >= 5) score += 3 + (run - 5);
      }
      for (c = 0; c < size; c++) {
        run = 1;
        for (r = 1; r < size; r++) {
          if (grid[r][c] === grid[r - 1][c]) { run++; } else { if (run >= 5) score += 3 + (run - 5); run = 1; }
        }
        if (run >= 5) score += 3 + (run - 5);
      }
      for (r = 0; r < size - 1; r++) for (c = 0; c < size - 1; c++) {
        var v0 = grid[r][c];
        if (v0 === grid[r][c + 1] && v0 === grid[r + 1][c] && v0 === grid[r + 1][c + 1]) score += 3;
      }
      var pat1 = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0], pat2 = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
      function hasPattern(arr, start, pat) {
        for (var q = 0; q < pat.length; q++) if (arr[start + q] !== pat[q]) return false;
        return true;
      }
      for (r = 0; r < size; r++) {
        for (c = 0; c + 11 <= size; c++) {
          if (hasPattern(grid[r], c, pat1) || hasPattern(grid[r], c, pat2)) score += 40;
        }
      }
      for (c = 0; c < size; c++) {
        var colArr = [];
        for (r = 0; r < size; r++) colArr.push(grid[r][c]);
        for (r = 0; r + 11 <= size; r++) {
          if (hasPattern(colArr, r, pat1) || hasPattern(colArr, r, pat2)) score += 40;
        }
      }
      for (r = 0; r < size; r++) for (c = 0; c < size; c++) if (grid[r][c]) dark++;
      var percent = dark * 100 / (size * size);
      score += Math.floor(Math.abs(percent - 50) / 5) * 10;
      return score;
    }

    var best = null, bestScore = Infinity, bestMask = 0;
    for (var maskId = 0; maskId < 8; maskId++) {
      var grid = m.map(function (row2) { return row2.slice(); });
      for (i = 0; i < size; i++) for (j = 0; j < size; j++) {
        if (!reserved[i][j] && maskFn(maskId, i, j)) grid[i][j] ^= 1;
      }
      /* format info for this mask, level M = 0b00 */
      var fbits = bchFormat((0 << 3) | maskId);
      for (i = 0; i <= 5; i++) grid[8][i] = (fbits >>> i) & 1;
      grid[8][7] = (fbits >>> 6) & 1;
      grid[8][8] = (fbits >>> 7) & 1;
      grid[7][8] = (fbits >>> 8) & 1;
      for (i = 9; i <= 14; i++) grid[14 - i][8] = (fbits >>> i) & 1;
      /* The second copy is 7 modules up the left edge and 8 across the
         top, NOT 8 and 7: module (size-8, 8) is the always-dark one
         and belongs to neither. Splitting it 8/7 puts every bit from 7
         onward one place out, which produces a code that scans as
         nothing at all. */
      for (i = 0; i <= 6; i++) grid[size - 1 - i][8] = (fbits >>> i) & 1;
      for (i = 7; i <= 14; i++) grid[8][size - 15 + i] = (fbits >>> i) & 1;
      grid[size - 8][8] = 1;
      var sc = penalty(grid);
      if (sc < bestScore) { bestScore = sc; best = grid; bestMask = maskId; }
    }
    return { size: size, modules: best, version: version, mask: bestMask, level: 'M' };
  }

  function qrSvg(text, opts) {
    opts = opts || {};
    var qr;
    try { qr = qrEncode(text); }
    catch (e) {
      return el('p', { class: 'note note--warn', text: 'The pairing code could not be drawn: ' + e.message });
    }
    var quiet = 4, dim = qr.size + quiet * 2;
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 ' + dim + ' ' + dim);
    svg.setAttribute('class', 'wds-qr');
    svg.setAttribute('role', 'img');
    svg.setAttribute('shape-rendering', 'crispEdges');
    svg.setAttribute('aria-label', opts.label || 'Pairing code. The same value is printed beside it as text.');
    var bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bg.setAttribute('width', String(dim)); bg.setAttribute('height', String(dim)); bg.setAttribute('fill', '#ffffff');
    svg.appendChild(bg);
    var d = '';
    for (var r = 0; r < qr.size; r++) {
      for (var c = 0; c < qr.size; c++) {
        if (qr.modules[r][c]) d += 'M' + (c + quiet) + ' ' + (r + quiet) + 'h1v1h-1z';
      }
    }
    var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    /* True black on true white rather than themed colours: a tinted
       code is a code a camera struggles with, and the quiet zone is
       part of the specification rather than padding. */
    path.setAttribute('fill', '#000000');
    svg.appendChild(path);
    return svg;
  }

  /* ================================================================
   * 23. The authenticator (RFC 6238 over RFC 4226)
   * ================================================================ */
  function otpauthUri(o) {
    var label = encodeURIComponent(o.issuer || 'World Downloader Studio') + ':' + encodeURIComponent(o.account || 'account');
    var q = ['secret=' + encodeURIComponent(o.secret),
      'issuer=' + encodeURIComponent(o.issuer || 'World Downloader Studio'),
      'algorithm=' + (o.algorithm || 'SHA1').replace('-', ''),
      'digits=' + (o.digits || 6),
      'period=' + (o.period || 30)];
    return 'otpauth://totp/' + label + '?' + q.join('&');
  }
  function parseOtpauth(uri) {
    var m = String(uri).match(/^otpauth:\/\/totp\/([^?]*)\?(.*)$/i);
    if (!m) return null;
    var label = decodeURIComponent(m[1]), params = Object.create(null);
    m[2].split('&').forEach(function (p) {
      var kv = p.split('=');
      params[decodeURIComponent(kv[0]).toLowerCase()] = decodeURIComponent(kv.slice(1).join('='));
    });
    if (!params.secret) return null;
    var parts = label.split(':');
    var alg = (params.algorithm || 'SHA1').toUpperCase();
    if (alg.indexOf('-') < 0) alg = alg.replace(/^SHA/, 'SHA-');
    return {
      issuer: params.issuer || (parts.length > 1 ? parts[0] : ''),
      account: parts.length > 1 ? parts.slice(1).join(':') : parts[0],
      secret: params.secret.replace(/\s/g, ''),
      algorithm: ['SHA-1', 'SHA-256', 'SHA-512'].indexOf(alg) >= 0 ? alg : 'SHA-1',
      digits: clamp(parseInt(params.digits, 10) || 6, 6, 8),
      period: clamp(parseInt(params.period, 10) || 30, 5, 300)
    };
  }
  function totpCode(secretB32, opts) {
    opts = opts || {};
    var algorithm = opts.algorithm || 'SHA-1';
    var digits = clamp(opts.digits || 6, 6, 8);
    var period = opts.period || 30;
    var now = opts.timestamp === undefined ? Math.floor(Date.now() / 1000) : opts.timestamp;
    var counter = Math.floor(now / period) + (opts.offset || 0);
    var key = base32Decode(secretB32);
    var msg = new Uint8Array(8), i;
    var big = BigInt(counter);
    for (i = 7; i >= 0; i--) { msg[i] = Number(big & 0xFFn); big >>= 8n; }
    var mac = hmac(algorithm, key, msg);
    var off = mac[mac.length - 1] & 0x0f;
    var bin = ((mac[off] & 0x7f) << 24) | (mac[off + 1] << 16) | (mac[off + 2] << 8) | mac[off + 3];
    var code = String(bin % Math.pow(10, digits));
    while (code.length < digits) code = '0' + code;
    return code;
  }

  var authEntries = store.get('auth.entries', []);
  var authenticator = {
    limits: { digits: [6, 7, 8], algorithms: ['SHA-1', 'SHA-256', 'SHA-512'] },
    list: function () {
      return authEntries.map(function (e) {
        return { id: e.id, issuer: e.issuer, account: e.account, algorithm: e.algorithm, digits: e.digits, period: e.period, addedAt: e.addedAt };
      });
    },
    /* RFC 6238 test vectors, run on demand. An authenticator that is
       subtly wrong produces codes rejected everywhere with no error to
       read, so being able to prove it right matters. */
    selfTest: function () {
      var secretAscii = '12345678901234567890';
      var b32 = base32Encode(utf8Bytes(secretAscii));
      var b32_32 = base32Encode(utf8Bytes('12345678901234567890123456789012'));
      var b32_64 = base32Encode(utf8Bytes('1234567890123456789012345678901234567890123456789012345678901234'));
      var cases = [
        { at: 59, alg: 'SHA-1', secret: b32, want: '94287082' },
        { at: 1111111109, alg: 'SHA-1', secret: b32, want: '07081804' },
        { at: 1234567890, alg: 'SHA-1', secret: b32, want: '89005924' },
        { at: 2000000000, alg: 'SHA-1', secret: b32, want: '69279037' },
        { at: 59, alg: 'SHA-256', secret: b32_32, want: '46119246' },
        { at: 1111111109, alg: 'SHA-256', secret: b32_32, want: '68084774' },
        { at: 59, alg: 'SHA-512', secret: b32_64, want: '90693936' },
        { at: 1234567890, alg: 'SHA-512', secret: b32_64, want: '93441116' }
      ];
      return cases.map(function (c) {
        var got = totpCode(c.secret, { algorithm: c.alg, digits: 8, period: 30, timestamp: c.at });
        return { algorithm: c.alg, at: c.at, expected: c.want, got: got, pass: got === c.want };
      });
    },
    code: function (id, offset) {
      var e = authEntries.filter(function (x) { return x.id === id; })[0];
      if (!e) return null;
      return totpCode(e.secret, { algorithm: e.algorithm, digits: e.digits, period: e.period, offset: offset || 0 });
    },
    add: function (spec) {
      var entry = {
        id: uid('otp'), issuer: spec.issuer || '', account: spec.account || '',
        secret: spec.secret, algorithm: spec.algorithm || 'SHA-1',
        digits: clamp(spec.digits || 6, 6, 8), period: spec.period || 30, addedAt: nowIso()
      };
      try { base32Decode(entry.secret); }
      catch (e) { return { ok: false, error: e.message }; }
      authEntries.push(entry);
      store.set('auth.entries', authEntries);
      history.record('authenticator', 'Authenticator entry added: ' + (entry.issuer || entry.account), { id: entry.id });
      return { ok: true, id: entry.id };
    },
    remove: function (id) {
      authEntries = authEntries.filter(function (e) { return e.id !== id; });
      store.set('auth.entries', authEntries);
      history.record('authenticator', 'Authenticator entry removed', { id: id });
      return true;
    },
    /* The clock is the failure nobody diagnoses. This cannot check a
       time server without a network request, so it reports what it can
       actually see: an obviously wrong year, and the offset the
       visitor tells it about. */
    clockWarning: function () {
      var y = new Date().getFullYear();
      if (y < 2020 || y > 2100) return 'This computer thinks the year is ' + y + '. Codes generated here will be refused everywhere.';
      var manual = store.get('auth.clockOffset', 0);
      if (Math.abs(manual) > 30) return t('auth.clockSkew') + ' The offset recorded here is ' + manual + ' seconds.';
      return null;
    },
    open: function (anchor) {
      var listWrap = el('div');
      var ticker = null;
      var search = createSearchBar({
        ariaLabel: 'Search authenticator entries', placeholder: t('act.search'),
        storageKey: 'authenticator', onChange: render
      });

      function visible() {
        var m = search.matcher();
        return authEntries.filter(function (e) { return m(e.issuer + ' ' + e.account); });
      }
      function render() {
        clear(listWrap);
        var rows = visible();
        if (!rows.length) {
          listWrap.appendChild(el('p', { class: 'muted', text: authEntries.length ? t('msg.noMatch') : 'No entries yet. Add one below and it stays in this browser.' }));
          return;
        }
        var ul = el('ul', { class: 'list' });
        rows.forEach(function (e) {
          var codeNode = el('span', { class: 'wds-otp__code', 'aria-live': 'off' });
          var nextNode = el('span', { class: 'wds-otp__next' });
          var bar = el('div', { class: 'prog', style: { width: '80px' } }, el('div', { class: 'prog__bar' }));
          var secs = el('span', { class: 'cap' });
          ul.appendChild(el('li', { class: 'li', 'data-bulk-item': '', 'data-id': e.id, 'data-otp': e.id }, [
            el('span', { class: 'li__t' }, [
              el('span', { class: 'li__h', text: (e.issuer ? e.issuer + ' · ' : '') + e.account }),
              codeNode,
              el('span', { class: 'li__s' }, [el('span', { text: 'Next: ' }), nextNode]),
              el('span', { class: 'li__s', text: e.algorithm + ' · ' + e.digits + ' digits · ' + e.period + 's' })
            ]),
            el('span', { class: 'wds-otp__count' }, [bar, secs]),
            el('button', { class: 'btn btn--icon', type: 'button', 'aria-label': t('act.copy') + ' code for ' + e.account,
              onclick: function (ev) { ev.stopPropagation(); copyText(authenticator.code(e.id)); } }, icon('copy'))
          ]));
        });
        listWrap.appendChild(ul);
        bulk.attach(ul, {
          getLabel: function (id) { var e = authEntries.filter(function (x) { return x.id === id; })[0]; return e ? (e.issuer + ' ' + e.account) : id; },
          allMatchingCount: function () { return visible().length; },
          allMatchingIds: function () { return visible().map(function (e) { return e.id; }); },
          actions: [
            { id: 'export', label: t('act.export'), run: function (ids) {
              exportDialog(authEntries.filter(function (e) { return ids.indexOf(e.id) >= 0; })
                .map(function (e) { return { issuer: e.issuer, account: e.account, algorithm: e.algorithm, digits: e.digits, period: e.period, addedAt: e.addedAt }; }),
              { name: 'authenticator-entries', anchor: anchor, omitted: t('auth.exportOmits') });
            } },
            { id: 'remove', label: t('act.remove'), danger: true, destructive: true,
              run: function (ids) { ids.forEach(authenticator.remove); render(); } }
          ]
        });
        tick();
      }
      function tick() {
        Array.prototype.forEach.call(listWrap.querySelectorAll('[data-otp]'), function (li) {
          var e = authEntries.filter(function (x) { return x.id === li.getAttribute('data-otp'); })[0];
          if (!e) return;
          var code = totpCode(e.secret, e);
          var next = totpCode(e.secret, { algorithm: e.algorithm, digits: e.digits, period: e.period, offset: 1 });
          var remain = e.period - (Math.floor(Date.now() / 1000) % e.period);
          var codeNode = li.querySelector('.wds-otp__code');
          if (codeNode.textContent !== code.replace(/(.{3})(?=.)/g, '$1 ')) {
            codeNode.textContent = code.replace(/(.{3})(?=.)/g, '$1 ');
            /* Announce on change rather than every second, or a screen
               reader spends the whole minute reading a countdown. */
            a11y.announce('New code for ' + (e.issuer || e.account) + ': ' + code.split('').join(' '));
          }
          li.querySelector('.wds-otp__next').textContent = next;
          li.querySelector('.prog__bar').style.width = Math.round(remain / e.period * 100) + '%';
          li.querySelector('.wds-otp__count .cap').textContent = remain + 's';
        });
      }

      var uriInput = el('input', { class: 'field__input', type: 'text', placeholder: 'otpauth://totp/...' });
      var issuer = el('input', { class: 'field__input', type: 'text', placeholder: 'Issuer' });
      var account = el('input', { class: 'field__input', type: 'text', placeholder: 'Account' });
      var secret = el('input', { class: 'field__input', type: 'text', placeholder: 'Base32 secret', spellcheck: 'false' });
      var algSel = createSelect({
        label: 'Algorithm', value: 'SHA-1',
        options: authenticator.limits.algorithms.map(function (a) { return { value: a, label: a }; })
      });
      var digitsSel = createSelect({
        label: 'Digits', value: '6',
        options: authenticator.limits.digits.map(function (d) { return { value: String(d), label: String(d) }; })
      });
      var periodInput = el('input', { class: 'field__input', type: 'number', min: '5', max: '300', value: '30' });

      var warn = authenticator.clockWarning();
      var content = el('div', { class: 'stack' }, [
        warn ? el('p', { class: 'note note--warn', text: warn }) : null,
        search.el, listWrap,
        el('details', {}, [
          el('summary', { text: 'Add an entry' }),
          el('div', { class: 'stack' }, [
            el('div', { class: 'field field--outlined' }, [
              el('span', { class: 'field__label', text: 'Paste an otpauth:// address' }),
              el('div', { class: 'field__box' }, uriInput),
              el('p', { class: 'field__help', text: 'Everything below fills itself in from the address.' })
            ]),
            el('div', { class: 'field field--outlined' }, [el('span', { class: 'field__label', text: 'Issuer' }), el('div', { class: 'field__box' }, issuer)]),
            el('div', { class: 'field field--outlined' }, [el('span', { class: 'field__label', text: 'Account' }), el('div', { class: 'field__box' }, account)]),
            el('div', { class: 'field field--outlined' }, [el('span', { class: 'field__label', text: 'Base32 secret' }), el('div', { class: 'field__box' }, secret)]),
            algSel.el, digitsSel.el,
            el('div', { class: 'field field--outlined' }, [el('span', { class: 'field__label', text: 'Period in seconds' }), el('div', { class: 'field__box' }, periodInput)]),
            el('button', {
              class: 'btn btn--filled', type: 'button', text: 'Add this entry',
              onclick: function () {
                var res = authenticator.add({
                  issuer: issuer.value, account: account.value, secret: secret.value.replace(/\s/g, ''),
                  algorithm: algSel.value(), digits: parseInt(digitsSel.value(), 10), period: parseInt(periodInput.value, 10) || 30
                });
                if (!res.ok) { notify.error(res.error); return; }
                secret.value = ''; render();
                notify.success('Added. The secret stays in this browser and is left out of ordinary exports.');
              }
            })
          ])
        ]),
        el('details', {}, [
          el('summary', { text: 'Prove this implementation against the RFC 6238 test vectors' }),
          el('div', { id: 'wds-otp-selftest' }),
          el('button', {
            class: 'btn btn--outlined', type: 'button', text: 'Run the test vectors',
            onclick: function () {
              var host = document.getElementById('wds-otp-selftest');
              clear(host);
              var results = authenticator.selfTest();
              var table = el('table', { class: 'tbl' }, [
                el('thead', {}, el('tr', {}, [el('th', { text: 'Algorithm' }), el('th', { text: 'Time' }), el('th', { text: 'Expected' }), el('th', { text: 'Got' }), el('th', { text: 'Result' })])),
                el('tbody', {}, results.map(function (r) {
                  return el('tr', {}, [el('td', { text: r.algorithm }), el('td', { class: 'num', text: String(r.at) }),
                    el('td', { class: 'mono', text: r.expected }), el('td', { class: 'mono', text: r.got }),
                    el('td', {}, el('span', { class: 'status ' + (r.pass ? 'status--ok' : 'status--error'), text: r.pass ? 'pass' : 'fail' }))]);
                }))
              ]);
              host.appendChild(el('div', { class: 'scrollx' }, table));
            }
          })
        ]),
        el('p', { class: 'note--plain', text: t('auth.exportOmits') + ' ' + t('msg.clearReset') })
      ].filter(Boolean));

      uriInput.addEventListener('change', function () {
        var p = parseOtpauth(uriInput.value);
        if (!p) { notify.error('That is not an otpauth address this site can read.'); return; }
        issuer.value = p.issuer; account.value = p.account; secret.value = p.secret;
        algSel.setValue(p.algorithm); digitsSel.setValue(String(p.digits)); periodInput.value = String(p.period);
        notify.success('Read the address. Check the values and add the entry.');
      });

      render();
      var h = openOverlay({
        anchor: anchor, returnTo: anchor, title: t('auth.title'), content: content,
        resizable: true, draggable: true, persistKey: 'authenticator',
        onClose: function () { if (ticker) clearInterval(ticker); }
      });
      ticker = window.setInterval(tick, 1000);
      return h;
    }
  };

  /* ================================================================
   * 24. Local version history
   *
   * Append-only. Restoring an earlier state writes a NEW entry, so an
   * undo can itself be undone, and that undo undone in turn. A restore
   * that discarded what it replaced would be the one failure mode that
   * makes a history panel unsafe to open.
   *
   * The desktop application keeps this in a Git repository beside its
   * own data directory. This site has neither, so it keeps the same
   * append-only log in local browser storage and says so rather than
   * implying a repository exists.
   * ================================================================ */
  var HISTORY_CAP = 500;
  var historyLog = store.get('history.log', []);
  var SETTINGS_KEYS = ['lang.mode', 'lang.funny.en', 'lang.funny.zh', 'lang.emoji',
    'theme.mode', 'theme.density', 'theme.seed', 'theme.font', 'theme.fontCustom',
    'theme.fontScale', 'theme.fontWeight', 'theme.motion', 'school.on', 'school.name',
    'notifications.corner', 'palette.size', 'dimsum.photos'];

  function settingsSnapshot() {
    var snap = {};
    SETTINGS_KEYS.forEach(function (k) { snap[k] = store.get(k, null); });
    snap['appearance.elements'] = store.get('appearance.elements', {});
    return snap;
  }

  var history = {
    /* Recording never fails the operation the visitor actually asked
       for: a history write that throws is logged and stepped over. */
    record: function (action, label, payload) {
      try {
        var entry = {
          id: uid('h'), at: nowIso(), action: action || 'settings',
          label: label || '(no description)', payload: payload || {},
          snapshot: settingsSnapshot()
        };
        historyLog.unshift(entry);
        if (historyLog.length > HISTORY_CAP) historyLog.length = HISTORY_CAP;
        store.set('history.log', historyLog);
        emit('history', entry);
        return entry.id;
      } catch (e) { report(e); return null; }
    },
    all: function () { return historyLog.slice(); },
    /* The real recorded actions with their counts, derived from the
       log rather than from a hard-coded list that drifts from what the
       site actually records. */
    actions: function () {
      var counts = Object.create(null);
      historyLog.forEach(function (e) { counts[e.action] = (counts[e.action] || 0) + 1; });
      return Object.keys(counts).sort().map(function (a) { return { action: a, count: counts[a] }; });
    },
    diff: function (id) {
      var i = historyLog.map(function (e) { return e.id; }).indexOf(id);
      if (i < 0) return null;
      var now = historyLog[i].snapshot, before = (historyLog[i + 1] || {}).snapshot || {};
      var keys = Object.keys(now).concat(Object.keys(before)).filter(function (k, n, arr) { return arr.indexOf(k) === n; });
      return keys.map(function (k) {
        var a = JSON.stringify(before[k]), b = JSON.stringify(now[k]);
        return { key: k, before: a, after: b, changed: a !== b };
      }).filter(function (d) { return d.changed; });
    },
    restore: function (id) {
      var entry = historyLog.filter(function (e) { return e.id === id; })[0];
      if (!entry) return false;
      Object.keys(entry.snapshot).forEach(function (k) {
        var v = entry.snapshot[k];
        if (v === null || v === undefined) store.remove(k);
        else store.set(k, v);
      });
      /* Re-read every piece of state the snapshot touched, so the
         restore is live rather than waiting for a reload. */
      lang.mode = store.get('lang.mode', 'en');
      lang.funnyEn = store.get('lang.funny.en', 3);
      lang.funnyZh = store.get('lang.funny.zh', 3);
      lang.emoji = store.get('lang.emoji', false) === true;
      themeState.mode = store.get('theme.mode', 'system');
      themeState.density = store.get('theme.density', 'comfortable');
      themeState.seed = store.get('theme.seed', null);
      themeState.font = store.get('theme.font', 'system');
      themeState.fontCustom = store.get('theme.fontCustom', '');
      themeState.fontScale = parseFloat(store.get('theme.fontScale', 1)) || 1;
      themeState.fontWeight = store.get('theme.fontWeight', 'normal');
      themeState.motion = store.get('theme.motion', 'system');
      schoolState.on = store.get('school.on', false) === true;
      schoolState.name = store.get('school.name', null);
      appearanceRules = store.get('appearance.elements', {});
      applyTheme(); applyI18n(); appearanceApplyAll();
      /* The append-only half: the restore is itself an entry. */
      history.record('restore', 'Restored the state from ' + new Date(entry.at).toLocaleString(), { restoredFrom: id });
      notify.success('Restored. That restore is itself an entry, so you can undo it.');
      return true;
    },
    label: function (id, text) {
      var e = historyLog.filter(function (x) { return x.id === id; })[0];
      if (!e) return false;
      e.userLabel = String(text || '');
      store.set('history.log', historyLog);
      return true;
    },
    prune: function (keep) {
      keep = clamp(parseInt(keep, 10) || 100, 10, HISTORY_CAP);
      var removed = Math.max(0, historyLog.length - keep);
      historyLog = historyLog.slice(0, keep);
      store.set('history.log', historyLog);
      return removed;
    },
    open: openHistoryPanel
  };

  /* ---- the advanced date picker ---------------------------------- */
  var DATE_PRESETS = [
    { id: 'today', label: 'Today', range: function () { var d = new Date(); return [startOfDay(d), endOfDay(d)]; } },
    { id: 'yesterday', label: 'Yesterday', range: function () { var d = new Date(Date.now() - 86400000); return [startOfDay(d), endOfDay(d)]; } },
    { id: '7', label: 'The last 7 days', range: function () { return [startOfDay(new Date(Date.now() - 6 * 86400000)), endOfDay(new Date())]; } },
    { id: '30', label: 'The last 30 days', range: function () { return [startOfDay(new Date(Date.now() - 29 * 86400000)), endOfDay(new Date())]; } },
    { id: 'month', label: 'This month', range: function () { var d = new Date(); return [new Date(d.getFullYear(), d.getMonth(), 1), endOfDay(new Date())]; } },
    { id: 'all', label: 'Everything', range: function () { return [null, null]; } }
  ];
  function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0); }
  function endOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999); }
  function fmtIso(d) {
    if (!d) return '';
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  /* Accepts a plain ISO date and the locale's own order. An invalid or
     partial entry is reported inline and the typed text is KEPT:
     wiping the box the moment somebody has typed three characters is
     the fastest way to make a date field unusable. */
  function parseTypedDate(text) {
    var s = String(text).trim();
    if (!s) return { ok: true, date: null };
    var iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (iso) {
      var d = new Date(+iso[1], +iso[2] - 1, +iso[3]);
      if (d.getMonth() !== +iso[2] - 1) return { ok: false, error: 'There is no day ' + iso[3] + ' in that month.' };
      return { ok: true, date: d };
    }
    var parts = s.split(/[\/.\- ]+/).filter(Boolean).map(Number);
    if (parts.length === 3 && parts.every(function (n) { return !isNaN(n); })) {
      var probe = new Date(2000, 0, 31);
      var order = new Intl.DateTimeFormat().formatToParts(probe).filter(function (p) { return ['day', 'month', 'year'].indexOf(p.type) >= 0; }).map(function (p) { return p.type; });
      var map = {};
      order.forEach(function (o, i) { map[o] = parts[i]; });
      if (map.year < 100) map.year += 2000;
      var d2 = new Date(map.year, map.month - 1, map.day);
      if (isNaN(d2.getTime())) return { ok: false, error: 'That is not a date this site can read. Try 2026-08-13.' };
      if (d2.getMonth() !== map.month - 1) return { ok: false, error: 'There is no day ' + map.day + ' in month ' + map.month + '.' };
      return { ok: true, date: d2 };
    }
    return { ok: false, error: 'Type a date as ' + new Intl.DateTimeFormat().format(new Date(2026, 7, 13)) + ' or as 2026-08-13.' };
  }

  function datePicker(opts) {
    opts = opts || {};
    var from = opts.from || null, to = opts.to || null;
    var view = new Date((from || new Date()).getTime());
    view.setDate(1);
    var wrap = el('div', { class: 'wds-cal' });
    var monthSel = createSelect({
      ariaLabel: 'Month', value: String(view.getMonth()),
      options: Array.from({ length: 12 }, function (_, i) {
        return { value: String(i), label: new Intl.DateTimeFormat(undefined, { month: 'long' }).format(new Date(2000, i, 1)) };
      }),
      onChange: function (v) { view.setMonth(parseInt(v, 10)); paint(); }
    });
    var thisYear = new Date().getFullYear();
    var yearSel = createSelect({
      ariaLabel: 'Year', value: String(view.getFullYear()),
      options: Array.from({ length: 21 }, function (_, i) { var y = thisYear - 15 + i; return { value: String(y), label: String(y) }; }),
      onChange: function (v) { view.setFullYear(parseInt(v, 10)); paint(); }
    });
    var fromInput = el('input', { class: 'field__input', type: 'text', 'aria-label': 'From date', placeholder: fmtIso(new Date()) });
    var toInput = el('input', { class: 'field__input', type: 'text', 'aria-label': 'To date', placeholder: fmtIso(new Date()) });
    var typedMsg = el('p', { class: 'field__help', role: 'status', 'aria-live': 'polite' });
    var grid = el('div', { class: 'wds-cal__grid' });

    function commit() {
      if (opts.onChange) opts.onChange(from, to);
      fromInput.value = fmtIso(from); toInput.value = fmtIso(to);
    }
    function handleTyped(input, setter) {
      input.addEventListener('change', function () {
        var res = parseTypedDate(input.value);
        if (!res.ok) { typedMsg.textContent = res.error; return; }
        typedMsg.textContent = '';
        setter(res.date);
        if (res.date) { view = new Date(res.date.getTime()); view.setDate(1); monthSel.setValue(String(view.getMonth())); yearSel.setValue(String(view.getFullYear())); }
        paint(); commit();
      });
    }
    handleTyped(fromInput, function (d) { from = d ? startOfDay(d) : null; });
    handleTyped(toInput, function (d) { to = d ? endOfDay(d) : null; });

    function paint() {
      clear(grid);
      var dows = [];
      for (var i = 0; i < 7; i++) dows.push(new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(new Date(2024, 0, 7 + i)));
      dows.forEach(function (d) { grid.appendChild(el('div', { class: 'wds-cal__dow', text: d })); });
      var first = new Date(view.getFullYear(), view.getMonth(), 1);
      var start = new Date(first.getTime());
      start.setDate(1 - first.getDay());
      var today = fmtIso(new Date());
      for (var n = 0; n < 42; n++) {
        var day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + n);
        var iso = fmtIso(day);
        var inRange = from && to && day >= startOfDay(from) && day <= endOfDay(to);
        var isEnd = (from && iso === fmtIso(from)) || (to && iso === fmtIso(to));
        (function (dayCopy, isoCopy) {
          grid.appendChild(el('button', {
            class: 'wds-cal__day' + (dayCopy.getMonth() !== view.getMonth() ? ' is-out' : '') +
              (inRange ? ' is-in-range' : '') + (isEnd ? ' is-end' : '') + (isoCopy === today ? ' is-today' : ''),
            type: 'button', text: String(dayCopy.getDate()),
            'aria-label': new Intl.DateTimeFormat(undefined, { dateStyle: 'full' }).format(dayCopy),
            'aria-pressed': isEnd ? 'true' : 'false',
            onclick: function () {
              if (!opts.range) { from = startOfDay(dayCopy); to = endOfDay(dayCopy); }
              else if (!from || (from && to)) { from = startOfDay(dayCopy); to = null; }
              else if (dayCopy < from) { to = endOfDay(from); from = startOfDay(dayCopy); }
              else { to = endOfDay(dayCopy); }
              paint(); commit();
            }
          }));
        })(day, iso);
      }
    }

    var presets = el('div', { class: 'chipset' }, DATE_PRESETS.map(function (p) {
      return el('button', {
        class: 'chip', type: 'button', text: p.label,
        onclick: function () { var r = p.range(); from = r[0]; to = r[1]; paint(); commit(); }
      });
    }));

    wrap.appendChild(presets);
    wrap.appendChild(el('div', { class: 'row' }, [monthSel.el, yearSel.el]));
    wrap.appendChild(grid);
    wrap.appendChild(el('div', { class: 'row' }, [
      el('div', { class: 'field field--outlined field--dense', style: { flex: '1 1 130px' } }, [
        el('span', { class: 'field__label', text: 'From' }), el('div', { class: 'field__box' }, fromInput)
      ]),
      el('div', { class: 'field field--outlined field--dense', style: { flex: '1 1 130px' } }, [
        el('span', { class: 'field__label', text: 'To' }), el('div', { class: 'field__box' }, toInput)
      ])
    ]));
    wrap.appendChild(typedMsg);
    paint(); commit();
    return { el: wrap, from: function () { return from; }, to: function () { return to; } };
  }

  function openHistoryPanel(anchor) {
    var from = null, to = null, actionFilter = [];
    var listWrap = el('div');
    var search = createSearchBar({
      ariaLabel: 'Search history', placeholder: t('act.search'),
      storageKey: 'history', onChange: render
    });
    var actionsWrap = el('div', { class: 'chipset' });
    var dateHost = el('div');
    var picker = datePicker({ range: true, onChange: function (f, t2v) { from = f; to = t2v; render(); } });
    dateHost.appendChild(picker.el);

    var filterHost = el('div');
    filterHost.appendChild(el('div', { class: 'stack' }, [
      el('p', { class: 'cap', text: t('act.filter') }),
      actionsWrap, dateHost
    ]));
    var filterCollapse = collapse.attach(filterHost, { title: t('act.filter'), descriptive: true, storageKey: 'history-filters' });

    function visible() {
      var m = search.matcher();
      return historyLog.filter(function (e) {
        if (actionFilter.length && actionFilter.indexOf(e.action) < 0) return false;
        if (from && new Date(e.at) < from) return false;
        if (to && new Date(e.at) > to) return false;
        return m(e.label + ' ' + e.action + ' ' + (e.userLabel || ''));
      });
    }
    function renderActions() {
      clear(actionsWrap);
      history.actions().forEach(function (a) {
        var on = actionFilter.indexOf(a.action) >= 0;
        actionsWrap.appendChild(el('button', {
          class: 'chip' + (on ? ' is-sel' : ''), type: 'button',
          'aria-pressed': on ? 'true' : 'false',
          text: a.action + ' (' + a.count + ')',
          onclick: function () {
            if (on) actionFilter = actionFilter.filter(function (x) { return x !== a.action; });
            else actionFilter.push(a.action);
            renderActions(); render();
          }
        }));
      });
      if (!history.actions().length) actionsWrap.appendChild(el('p', { class: 'muted', text: 'Nothing has been recorded yet.' }));
    }
    function render() {
      renderActions();
      clear(listWrap);
      var rows = visible();
      /* A collapsed filter row that is currently excluding results
         says so on its own header. */
      var active = [];
      if (actionFilter.length) active.push(actionFilter.length + ' action filter' + (actionFilter.length === 1 ? '' : 's'));
      if (from || to) active.push('a date range');
      if (search.value()) active.push('a text search');
      filterCollapse.setActiveSummary(active.length ? 'Excluding results: ' + active.join(', ') : '');

      if (!rows.length) {
        listWrap.appendChild(el('p', { class: 'muted', text: historyLog.length ? t('msg.noMatch') : 'Nothing has been recorded yet. Change a setting and it appears here.' }));
        return;
      }
      var ul = el('ul', { class: 'list' });
      rows.slice(0, 200).forEach(function (e) {
        var diffs = history.diff(e.id) || [];
        ul.appendChild(el('li', { class: 'li', 'data-bulk-item': '', 'data-id': e.id }, [
          el('span', { class: 'status', text: e.action }),
          el('span', { class: 'li__t' }, [
            el('span', { class: 'li__h', text: e.userLabel ? e.userLabel + ' — ' + e.label : e.label }),
            el('span', { class: 'li__s', text: new Date(e.at).toLocaleString() }),
            diffs.length ? el('details', {}, [
              el('summary', { text: diffs.length + ' value' + (diffs.length === 1 ? '' : 's') + ' changed' }),
              el('div', { class: 'scrollx' }, el('table', { class: 'tbl' }, [
                el('thead', {}, el('tr', {}, [el('th', { text: 'Key' }), el('th', { text: 'Before' }), el('th', { text: 'After' })])),
                el('tbody', {}, diffs.map(function (d) {
                  return el('tr', {}, [el('td', { class: 'mono', text: d.key }), el('td', { class: 'mono', text: d.before }), el('td', { class: 'mono', text: d.after })]);
                }))
              ]))
            ]) : null
          ].filter(Boolean)),
          el('button', {
            class: 'btn btn--text', type: 'button', text: t('act.restore'),
            onclick: function (ev) { ev.stopPropagation(); history.restore(e.id); render(); }
          }),
          el('button', {
            class: 'btn btn--icon', type: 'button', 'aria-label': 'Label this entry',
            onclick: function (ev) {
              ev.stopPropagation();
              var input = el('input', { class: 'field__input', type: 'text', value: e.userLabel || '' });
              var h2 = openOverlay({
                anchor: ev.currentTarget, returnTo: ev.currentTarget, title: 'Label this entry',
                content: el('div', { class: 'field field--outlined' }, [
                  el('span', { class: 'field__label', text: 'Your own label' }),
                  el('div', { class: 'field__box' }, input)
                ]),
                footer: [el('button', { class: 'btn btn--filled', type: 'button', text: t('act.save'), onclick: function () { history.label(e.id, input.value); h2.close('saved'); render(); } })]
              });
            }
          }, icon('text'))
        ]));
      });
      listWrap.appendChild(ul);
      bulk.attach(ul, {
        getLabel: function (id) { var e = historyLog.filter(function (x) { return x.id === id; })[0]; return e ? e.label : id; },
        allMatchingCount: function () { return visible().length; },
        allMatchingIds: function () { return visible().map(function (e) { return e.id; }); },
        actions: [
          { id: 'export', label: t('act.export'), run: function (ids) {
            exportDialog(historyLog.filter(function (e) { return ids.indexOf(e.id) >= 0; })
              .map(function (e) { return { id: e.id, at: e.at, action: e.action, label: e.label, userLabel: e.userLabel || '' }; }),
            { name: 'history', anchor: anchor, omitted: 'Snapshots are left out of this file, and no secret of any kind is included.' });
          } },
          { id: 'prune', label: 'Prune everything older than the newest 100', run: function () { var n = history.prune(100); render(); return { done: 1, skipped: 0, note: n + ' removed' }; } }
        ]
      });
    }
    render();
    return openOverlay({
      anchor: anchor, returnTo: anchor, title: t('history.title'),
      content: el('div', { class: 'stack' }, [
        el('p', { class: 'muted', text: t('history.appendOnly') }),
        el('p', { class: 'note--plain', text: 'This site has no repository and no application data folder. The log lives in this browser\'s local storage under the "' + NS + 'history.log" key, and clearing this site\'s storage removes it.' }),
        search.el, filterHost, listWrap
      ]),
      resizable: true, draggable: true, persistKey: 'history-panel'
    });
  }

  /* ================================================================
   * 25. Export
   *
   * Every format that can faithfully carry the data, and an honest
   * warning BEFORE the export runs when a format cannot. Silently
   * flattening a nested field into "[object Object]" is the failure
   * this warning exists to prevent.
   * ================================================================ */
  var EXPORT_FORMATS = [
    { id: 'json', label: 'JSON', ext: 'json', mime: 'application/json', lossless: true },
    { id: 'jsonl', label: 'JSONL (one record per line)', ext: 'jsonl', mime: 'application/x-ndjson', lossless: true },
    { id: 'yaml', label: 'YAML', ext: 'yaml', mime: 'text/yaml', lossless: true },
    { id: 'toml', label: 'TOML', ext: 'toml', mime: 'text/plain', lossless: false },
    { id: 'xml', label: 'XML', ext: 'xml', mime: 'application/xml', lossless: true },
    { id: 'csv', label: 'CSV', ext: 'csv', mime: 'text/csv', lossless: false },
    { id: 'tsv', label: 'TSV', ext: 'tsv', mime: 'text/tab-separated-values', lossless: false },
    { id: 'markdown', label: 'Markdown table', ext: 'md', mime: 'text/markdown', lossless: false },
    { id: 'html', label: 'HTML table', ext: 'html', mime: 'text/html', lossless: false },
    { id: 'sql', label: 'SQL insert statements', ext: 'sql', mime: 'application/sql', lossless: false }
  ];
  var EXPORT_SCHEMA_VERSION = 1;

  function columnsOf(rows) {
    var cols = [];
    rows.forEach(function (r) {
      Object.keys(r || {}).forEach(function (k) { if (cols.indexOf(k) < 0) cols.push(k); });
    });
    return cols;
  }
  function isScalar(v) { return v === null || ['string', 'number', 'boolean', 'undefined'].indexOf(typeof v) >= 0; }
  function exportWarnings(rows, formatId) {
    var f = EXPORT_FORMATS.filter(function (x) { return x.id === formatId; })[0];
    if (!f || f.lossless) return [];
    var out = [], nested = [];
    columnsOf(rows).forEach(function (c) {
      var anyNested = rows.some(function (r) { return r && !isScalar(r[c]); });
      if (anyNested) nested.push(c);
    });
    if (nested.length) {
      out.push('These fields hold structured values that ' + f.label + ' cannot carry as structure, so they are written as JSON text inside the cell: ' + nested.join(', ') + '.');
    }
    if (formatId === 'toml' && rows.length > 1) {
      out.push('TOML writes each record as an array-of-tables entry. A record missing a field present in another simply omits it rather than writing an empty value.');
    }
    if (formatId === 'sql') {
      out.push('The table name is derived from the export name, and every value is written as a quoted string. Types are not inferred, because guessing a column type wrongly is worse than writing text.');
    }
    return out;
  }
  function cellText(v) {
    if (v === null || v === undefined) return '';
    if (isScalar(v)) return String(v);
    try { return JSON.stringify(v); } catch (e) { return String(v); }
  }
  function yamlValue(v, indent) {
    var pad = new Array(indent + 1).join(' ');
    if (v === null || v === undefined) return 'null';
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    if (typeof v === 'string') return JSON.stringify(v);
    if (Array.isArray(v)) {
      if (!v.length) return '[]';
      return '\n' + v.map(function (x) { return pad + '- ' + yamlValue(x, indent + 2).replace(/^\n/, ''); }).join('\n');
    }
    var keys = Object.keys(v);
    if (!keys.length) return '{}';
    return '\n' + keys.map(function (k) { return pad + k + ': ' + yamlValue(v[k], indent + 2); }).join('\n');
  }
  function tomlValue(v) {
    if (v === null || v === undefined) return '""';
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    if (Array.isArray(v) && v.every(isScalar)) return '[' + v.map(tomlValue).join(', ') + ']';
    return JSON.stringify(cellText(v));
  }
  function exportData(rows, formatId, opts) {
    opts = opts || {};
    rows = Array.isArray(rows) ? rows : [rows];
    var f = EXPORT_FORMATS.filter(function (x) { return x.id === formatId; })[0] || EXPORT_FORMATS[0];
    var name = opts.name || 'export';
    var cols = columnsOf(rows);
    var header = {
      kind: 'world-downloader-studio-export', schemaVersion: EXPORT_SCHEMA_VERSION,
      exportedAt: nowIso(), source: window.location.href, name: name,
      encoding: 'UTF-8', lineEndings: 'LF', recordCount: rows.length
    };
    if (opts.omitted) header.omitted = opts.omitted;
    var text;
    switch (f.id) {
      case 'json':
        text = JSON.stringify({ meta: header, records: rows }, null, 2);
        break;
      case 'jsonl':
        text = [JSON.stringify({ meta: header })].concat(rows.map(function (r) { return JSON.stringify(r); })).join('\n');
        break;
      case 'yaml':
        text = '# ' + name + '\n' + Object.keys(header).map(function (k) { return k + ': ' + yamlValue(header[k], 2); }).join('\n') +
          '\nrecords:' + (rows.length ? '\n' + rows.map(function (r) {
            return '  - ' + Object.keys(r).map(function (k, i) { return (i ? '    ' : '') + k + ': ' + yamlValue(r[k], 6); }).join('\n');
          }).join('\n') : ' []');
        break;
      case 'toml':
        text = Object.keys(header).map(function (k) { return k + ' = ' + tomlValue(header[k]); }).join('\n') + '\n\n' +
          rows.map(function (r) {
            return '[[records]]\n' + Object.keys(r).filter(function (k) { return r[k] !== undefined; })
              .map(function (k) { return k + ' = ' + tomlValue(r[k]); }).join('\n');
          }).join('\n\n');
        break;
      case 'xml':
        text = '<?xml version="1.0" encoding="UTF-8"?>\n<export' +
          Object.keys(header).map(function (k) { return ' ' + k + '="' + escapeHtml(String(header[k])) + '"'; }).join('') + '>\n' +
          rows.map(function (r) {
            return '  <record>\n' + Object.keys(r).map(function (k) {
              return '    <' + k + '>' + escapeHtml(cellText(r[k])) + '</' + k + '>';
            }).join('\n') + '\n  </record>';
          }).join('\n') + '\n</export>\n';
        break;
      case 'csv':
      case 'tsv': {
        var sep = f.id === 'csv' ? ',' : '\t';
        function q(v) {
          var s = cellText(v);
          if (f.id === 'tsv') return s.replace(/[\t\n\r]/g, ' ');
          return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
        }
        text = [cols.map(q).join(sep)].concat(rows.map(function (r) {
          return cols.map(function (c) { return q(r[c]); }).join(sep);
        })).join('\n');
        break;
      }
      case 'markdown':
        text = '<!-- ' + name + ', ' + header.recordCount + ' records, exported ' + header.exportedAt + ', UTF-8 -->\n\n' +
          '| ' + cols.join(' | ') + ' |\n| ' + cols.map(function () { return '---'; }).join(' | ') + ' |\n' +
          rows.map(function (r) {
            return '| ' + cols.map(function (c) { return cellText(r[c]).replace(/\|/g, '\\|').replace(/\n/g, ' '); }).join(' | ') + ' |';
          }).join('\n') + '\n';
        break;
      case 'html':
        text = '<!doctype html>\n<meta charset="utf-8">\n<title>' + escapeHtml(name) + '</title>\n' +
          '<p>' + escapeHtml(header.recordCount + ' records, exported ' + header.exportedAt + ', schema version ' + header.schemaVersion) + '</p>\n' +
          '<table><thead><tr>' + cols.map(function (c) { return '<th>' + escapeHtml(c) + '</th>'; }).join('') + '</tr></thead>\n<tbody>\n' +
          rows.map(function (r) {
            return '<tr>' + cols.map(function (c) { return '<td>' + escapeHtml(cellText(r[c])) + '</td>'; }).join('') + '</tr>';
          }).join('\n') + '\n</tbody></table>\n';
        break;
      default: {
        var table = name.replace(/[^a-zA-Z0-9_]/g, '_');
        text = '-- ' + name + ', schema version ' + header.schemaVersion + ', exported ' + header.exportedAt + ', UTF-8\n' +
          'CREATE TABLE IF NOT EXISTS ' + table + ' (' + cols.map(function (c) { return c.replace(/[^a-zA-Z0-9_]/g, '_') + ' TEXT'; }).join(', ') + ');\n' +
          rows.map(function (r) {
            return 'INSERT INTO ' + table + ' (' + cols.map(function (c) { return c.replace(/[^a-zA-Z0-9_]/g, '_'); }).join(', ') + ') VALUES (' +
              cols.map(function (c) { return "'" + cellText(r[c]).replace(/'/g, "''") + "'"; }).join(', ') + ');';
          }).join('\n') + '\n';
      }
    }
    return {
      text: text, mime: f.mime, ext: f.ext, filename: name + '.' + f.ext,
      warnings: exportWarnings(rows, f.id), encoding: 'UTF-8', schemaVersion: EXPORT_SCHEMA_VERSION
    };
  }

  function exportDialog(rows, opts) {
    opts = opts || {};
    var formatSel = createSelect({
      label: 'Format', value: 'json', storageKey: 'export-format',
      options: EXPORT_FORMATS.map(function (f) { return { value: f.id, label: f.label, keywords: f.ext }; }),
      onChange: render
    });
    var warnWrap = el('div');
    var preview = el('pre', { class: 'scrollx', style: { 'max-height': '220px' } });
    function current() { return exportData(rows, formatSel.value(), { name: opts.name || 'export', omitted: opts.omitted }); }
    function render() {
      var res = current();
      clear(warnWrap);
      if (opts.omitted) warnWrap.appendChild(el('p', { class: 'note--plain', text: opts.omitted }));
      if (res.warnings.length) {
        warnWrap.appendChild(el('div', { class: 'note note--warn' }, [
          el('p', { text: t('export.lossy') }),
          el('ul', {}, res.warnings.map(function (w) { return el('li', { text: w }); }))
        ]));
      } else {
        warnWrap.appendChild(el('p', { class: 'muted', text: 'This format carries every field in these records without dropping anything.' }));
      }
      preview.textContent = res.text.slice(0, 4000) + (res.text.length > 4000 ? '\n… (' + (res.text.length - 4000) + ' more characters)' : '');
    }
    render();
    var h = openOverlay({
      anchor: opts.anchor, returnTo: opts.anchor, title: t('export.title'),
      content: el('div', { class: 'stack' }, [
        el('p', { text: rows.length + ' record' + (rows.length === 1 ? '' : 's') + '. Encoding UTF-8, line endings LF, schema version ' + EXPORT_SCHEMA_VERSION + '.' }),
        formatSel.el, warnWrap, preview,
        el('p', { class: 'muted t-body-small', text: 'This site cannot open a local editor the way the desktop application can. Download the file and open it wherever you like, or copy it straight from the preview.' })
      ]),
      resizable: true, persistKey: 'export-dialog',
      footer: [
        el('button', { class: 'btn btn--text', type: 'button', text: t('act.copy'), onclick: function () { copyText(current().text); } }),
        el('button', {
          class: 'btn btn--filled', type: 'button', text: t('act.export'),
          onclick: function () { var r = current(); downloadText(r.filename, r.text, r.mime); h.close('exported'); }
        })
      ]
    });
    return h;
  }

  /* ================================================================
   * 26. Markdown
   *
   * ONE renderer, shared by every article body and every piece of text
   * this site did not write itself. Escaped first, then a safe subset
   * is re-introduced: printing markdown into a paragraph shows the
   * source, and rendering remote-authored markup with the page's own
   * privileges is how a docs site becomes an injection surface.
   * ================================================================ */
  function safeHref(href) {
    var s = String(href || '').trim();
    if (/^(https?:|mailto:|#|\.|\/)/i.test(s)) return s;
    return '#';
  }
  function renderInline(text) {
    var out = escapeHtml(text);
    out = out.replace(/`([^`]+)`/g, function (m, c) { return '<code>' + c + '</code>'; });
    out = out.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, function (m, alt, src) {
      var s = safeHref(src);
      if (/^https?:/i.test(s)) return escapeHtml(alt || 'image');
      return '<img src="' + s + '" alt="' + alt + '" loading="lazy">';
    });
    out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (m, label2, href) {
      var s = safeHref(href);
      var ext = /^https?:/i.test(s);
      return '<a href="' + s + '"' + (ext ? ' rel="noopener noreferrer"' : '') + '>' + label2 + '</a>';
    });
    out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
    out = out.replace(/~~([^~]+)~~/g, '<del>$1</del>');
    return out;
  }
  function renderMarkdown(src) {
    if (src === null || src === undefined || !String(src).trim()) {
      return '<p class="wds-md__empty">No text was provided.</p>';
    }
    var lines = String(src).replace(/\r\n?/g, '\n').split('\n');
    var html = [], i = 0, inCode = false, codeLang = '', codeBuf = [];
    var listStack = [];
    function closeLists(toDepth) {
      while (listStack.length > toDepth) html.push(listStack.pop() === 'ol' ? '</ol>' : '</ul>');
    }
    for (i = 0; i < lines.length; i++) {
      var line = lines[i];
      var fence = line.match(/^```\s*([a-zA-Z0-9_+-]*)\s*$/);
      if (fence) {
        if (inCode) { html.push('<pre><code' + (codeLang ? ' class="language-' + escapeHtml(codeLang) + '"' : '') + '>' + escapeHtml(codeBuf.join('\n')) + '</code></pre>'); inCode = false; codeBuf = []; }
        else { closeLists(0); inCode = true; codeLang = fence[1]; }
        continue;
      }
      if (inCode) { codeBuf.push(line); continue; }
      if (!line.trim()) { closeLists(0); continue; }
      var h = line.match(/^(#{1,6})\s+(.*)$/);
      if (h) { closeLists(0); html.push('<h' + h[1].length + '>' + renderInline(h[2]) + '</h' + h[1].length + '>'); continue; }
      if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) { closeLists(0); html.push('<hr>'); continue; }
      var quote = line.match(/^>\s?(.*)$/);
      if (quote) { closeLists(0); html.push('<blockquote>' + renderInline(quote[1]) + '</blockquote>'); continue; }
      var li = line.match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/);
      if (li) {
        var depth = Math.floor(li[1].length / 2) + 1;
        var ordered = /\d/.test(li[2]);
        while (listStack.length < depth) { listStack.push(ordered ? 'ol' : 'ul'); html.push(ordered ? '<ol>' : '<ul>'); }
        closeLists(depth);
        html.push('<li>' + renderInline(li[3]) + '</li>');
        continue;
      }
      if (/^\|.*\|$/.test(line.trim()) && lines[i + 1] && /^\|[\s:|-]+\|$/.test(lines[i + 1].trim())) {
        closeLists(0);
        var headCells = line.trim().replace(/^\||\|$/g, '').split('|').map(function (c) { return renderInline(c.trim()); });
        var rowsHtml = [];
        i += 2;
        while (i < lines.length && /^\|.*\|$/.test(lines[i].trim())) {
          rowsHtml.push('<tr>' + lines[i].trim().replace(/^\||\|$/g, '').split('|').map(function (c) { return '<td>' + renderInline(c.trim()) + '</td>'; }).join('') + '</tr>');
          i++;
        }
        i--;
        html.push('<div class="scrollx"><table><thead><tr>' + headCells.map(function (c) { return '<th>' + c + '</th>'; }).join('') + '</tr></thead><tbody>' + rowsHtml.join('') + '</tbody></table></div>');
        continue;
      }
      closeLists(0);
      html.push('<p>' + renderInline(line) + '</p>');
    }
    if (inCode) html.push('<pre><code>' + escapeHtml(codeBuf.join('\n')) + '</code></pre>');
    closeLists(0);
    return html.join('\n');
  }
  var markdown = {
    render: renderMarkdown,
    renderInto: function (node, src) {
      node.classList.add('wds-md');
      node.innerHTML = renderMarkdown(src);
      return node;
    }
  };

  /* ================================================================
   * 27. The dim sum surprise
   *
   * A 10 per cent chance at each launch. It never gates the page,
   * never takes focus, and cannot be switched off -- there is no
   * setting that disables the surprise, and School mode suppresses it
   * as part of removing every dim sum capability rather than as an
   * opt-out.
   *
   * The dish NAMES are bundled, so the surprise works with no network
   * at all. The PHOTO comes from the public dim-sum catalog's release
   * asset, which is the one and only network request this site can
   * make, is named in the settings, and can be switched off. Nothing
   * is copied into this repository.
   * ================================================================ */
  var DIM_SUM_CATALOG_BASE = 'https://github.com/Ding-Ding-Projects/dim-sum-photos/releases/download/catalog-v1/';
  /* Photo-free metadata snapshot: names and the public asset filename,
     nothing else. No image bytes live in this repository. */
  var DIM_SUM = [
    { id: 'har-gow', en: 'Shrimp dumpling', zh: '蝦餃', file: 'har-gow.jpg' },
    { id: 'siu-mai', en: 'Pork and prawn dumpling', zh: '燒賣', file: 'siu-mai.jpg' },
    { id: 'char-siu-bao', en: 'Barbecue pork bun', zh: '叉燒包', file: 'char-siu-bao.jpg' },
    { id: 'cheung-fun', en: 'Rice noodle roll', zh: '腸粉', file: 'cheung-fun.jpg' },
    { id: 'lo-mai-gai', en: 'Sticky rice in lotus leaf', zh: '糯米雞', file: 'lo-mai-gai.jpg' },
    { id: 'dan-tat', en: 'Egg tart', zh: '蛋撻', file: 'dan-tat.jpg' },
    { id: 'fung-zao', en: 'Braised chicken feet', zh: '鳳爪', file: 'fung-zao.jpg' },
    { id: 'pai-gwat', en: 'Steamed spare ribs', zh: '排骨', file: 'pai-gwat.jpg' },
    { id: 'wu-gok', en: 'Taro puff', zh: '芋角', file: 'wu-gok.jpg' },
    { id: 'ma-lai-go', en: 'Steamed sponge cake', zh: '馬拉糕', file: 'ma-lai-go.jpg' },
    { id: 'zin-deui', en: 'Sesame ball', zh: '煎堆', file: 'zin-deui.jpg' },
    { id: 'ngau-yuk-kau', en: 'Beef ball', zh: '牛肉球', file: 'ngau-yuk-kau.jpg' },
    { id: 'lin-yung-bao', en: 'Lotus seed paste bun', zh: '蓮蓉包', file: 'lin-yung-bao.jpg' },
    { id: 'daan-saan', en: 'Egg puff crisps', zh: '蛋散', file: 'daan-saan.jpg' },
    { id: 'jiu-choi-gao', en: 'Chive dumpling', zh: '韭菜餃', file: 'jiu-choi-gao.jpg' },
    { id: 'seen-juk-guen', en: 'Beancurd skin roll', zh: '鮮竹卷', file: 'seen-juk-guen.jpg' }
  ];
  var dimSumShownThisLaunch = false;

  var dimSum = {
    catalog: function () { return DIM_SUM.slice(); },
    photosEnabled: function () { return store.get('dimsum.photos', true) !== false; },
    setPhotosEnabled: function (v) { store.set('dimsum.photos', !!v); },
    photoUrl: function (dish) { return DIM_SUM_CATALOG_BASE + dish.file; },
    pick: function () { return DIM_SUM[Math.floor(Math.random() * DIM_SUM.length)]; },
    /* One fresh draw per launch, never twice, never more frequent than
       stated, and never during a first run or an error path. */
    maybeShow: function (force) {
      if (dimSumShownThisLaunch && !force) return false;
      if (schoolActive()) return false;
      if (!force && Math.random() >= 0.10) { dimSumShownThisLaunch = true; return false; }
      dimSumShownThisLaunch = true;
      dimSum.show(dimSum.pick());
      return true;
    },
    show: function (dish) {
      if (schoolActive()) return;
      var layer = ensureToastLayer();
      var media;
      if (dimSum.photosEnabled()) {
        media = el('img', {
          class: 'wds-dimsum__photo', alt: dish.en + ' · ' + dish.zh,
          loading: 'lazy', decoding: 'async', referrerpolicy: 'no-referrer',
          src: dimSum.photoUrl(dish)
        });
        media.addEventListener('error', function () {
          var fb = el('div', { class: 'wds-dimsum__fallback', text: t('dimsum.noPhoto') });
          if (media.parentNode) media.parentNode.replaceChild(fb, media);
        });
      } else {
        media = el('div', { class: 'wds-dimsum__fallback', text: t('dimsum.noPhoto') });
      }
      var deco = emojiFor('dimsum');
      var card = el('div', {
        class: 'wds-dimsum', role: 'status', 'aria-live': 'polite'
      }, [
        media,
        el('div', { class: 'wds-dimsum__text' }, [
          el('p', { class: 'cap', text: (deco ? deco + ' ' : '') + t('dimsum.heading') }),
          el('p', { class: 't-title-medium', text: dish.en + ' · ' + dish.zh }),
          el('p', { class: 'muted t-body-small', text: 'Photo from the public dim sum catalog.' })
        ]),
        el('button', { class: 'btn btn--icon', type: 'button', 'aria-label': t('act.dismiss'), onclick: function () { close(); } }, icon('close'))
      ]);
      layer.appendChild(card);
      function close() { if (card.parentNode) card.parentNode.removeChild(card); }
      /* Non-blocking, auto-dismissing, never takes focus. */
      var timer = window.setTimeout(close, 9000);
      card.addEventListener('pointerenter', function () { clearTimeout(timer); });
    }
  };

  /* ================================================================
   * 28. School mode
   * ================================================================ */
  var school = {
    name: schoolName,
    isOn: schoolActive,
    hasCredential: function () { return !!schoolState.cred; },
    setName: function (n) {
      schoolState.name = String(n || '').trim() || null;
      store.set('school.name', schoolState.name);
      applyI18n(); emit('school', { name: schoolName() });
      history.record('settings', 'The mode was renamed to "' + schoolName() + '"', { 'school.name': schoolState.name });
      return true;
    },
    setCredential: function (pin) {
      if (!pin) return false;
      schoolState.cred = makeCredential(String(pin));
      store.set('school.cred', schoolState.cred);
      return true;
    },
    enable: function () {
      if (!schoolState.cred) return { ok: false, error: 'Set an unlock code first, or there is no way back out.' };
      schoolState.on = true; store.set('school.on', true);
      applyI18n(); applyTheme(); emit('school', { on: true });
      history.record('settings', schoolName() + ' turned on', { 'school.on': true });
      return { ok: true };
    },
    disable: function (pin) {
      if (!schoolState.cred) { schoolState.on = false; store.set('school.on', false); emit('school', { on: false }); return { ok: true }; }
      if (!checkCredential(schoolState.cred, String(pin || ''))) return { ok: false, error: t('school.pinWrong') };
      schoolState.on = false; store.set('school.on', false);
      applyI18n(); applyTheme(); emit('school', { on: false });
      history.record('settings', schoolName() + ' turned off', { 'school.on': false });
      return { ok: true };
    },
    /* While the mode is on, every capability it covers is OMITTED
       from the interface rather than disabled: a greyed-out control is
       a control that still tells you the feature exists. */
    suppresses: function (capability) {
      if (!schoolActive()) return false;
      return ['cantonese', 'bilingual', 'funny', 'vocabulary', 'dimsum'].indexOf(capability) >= 0;
    }
  };

  /* ================================================================
   * 29. Settings helpers for page authors
   * ================================================================ */
  function settingRow(opts) {
    var id = uid('set');
    var control = opts.control;
    var explainId = uid('exp');
    var provenance = el('p', { class: 'muted t-body-small' });
    /* The provenance line names the REAL value rather than the opaque
       word "default", and says whether it came from something the
       visitor set or from the value this site ships with. */
    function paintProvenance() {
      var stored = opts.storageKey ? store.get(opts.storageKey, undefined) : undefined;
      if (stored === undefined || stored === null) {
        provenance.textContent = 'Not set here, so this site is using its own value: ' + String(opts.shippedValue);
      } else {
        provenance.textContent = 'Set in this browser to: ' + String(typeof stored === 'object' ? JSON.stringify(stored) : stored);
      }
    }
    paintProvenance();
    if (opts.storageKey) store.onChange(function (k) { if (k === opts.storageKey) paintProvenance(); });

    var head = el('div', { class: 'row', style: { 'justify-content': 'space-between', 'align-items': 'flex-start' } }, [
      el('div', { style: { flex: '1 1 220px', 'min-width': '0' } }, [
        el('span', { class: 't-title-small', id: id, text: opts.label }),
        opts.secondary ? el('span', { class: 'sec muted', text: ' ' + opts.secondary }) : null
      ].filter(Boolean)),
      control
    ]);
    var wrap = el('div', {
      class: 'stack', style: { gap: '4px' },
      'data-setting': opts.id || id, 'data-wds-akey': 'setting:' + (opts.id || id)
    }, [
      head,
      el('details', { }, [
        el('summary', { text: 'What this does' }),
        el('div', { class: 'wds-md', id: explainId, html: renderMarkdown(opts.explain || 'No explanation was written for this setting yet.') })
      ]),
      provenance
    ]);
    appearance.enable(wrap, 'setting:' + (opts.id || id), opts.label);
    attachContextMenu(wrap, function () {
      return [
        { label: t('act.openEditor') + '…', icon: 'palette', shortcut: 'Shift+Right click', run: function () { appearance.openEditor(wrap, 'setting:' + (opts.id || id), opts.label); } },
        { label: t('locks.lockThis') + '…', icon: 'lock', run: function () { locks.wizard(wrap, 'setting:' + (opts.id || id), opts.label); } },
        { label: t('act.reset'), icon: 'reset', disabled: !opts.storageKey, disabledReason: opts.storageKey ? null : 'This setting does not store a value of its own.',
          run: function () { if (opts.storageKey) { store.remove(opts.storageKey); paintProvenance(); if (opts.onReset) opts.onReset(); } } }
      ];
    }, { ariaLabel: 'Setting menu' });
    return wrap;
  }

  function makeSwitch(opts) {
    var sw = el('button', {
      class: 'switch' + (opts.checked ? ' is-on' : ''), type: 'button', role: 'switch',
      'aria-checked': opts.checked ? 'true' : 'false',
      'aria-label': opts.ariaLabel || opts.label || 'Toggle',
      onclick: function () {
        var next = sw.getAttribute('aria-checked') !== 'true';
        sw.setAttribute('aria-checked', next ? 'true' : 'false');
        sw.classList.toggle('is-on', next);
        if (opts.onChange) opts.onChange(next);
      }
    }, el('span', { class: 'switch__track' }, el('span', { class: 'knob' })));
    return sw;
  }
  function makeSlider(opts) {
    var range = el('input', {
      type: 'range', min: String(opts.min), max: String(opts.max), step: String(opts.step || 1),
      value: String(opts.value), 'aria-label': opts.ariaLabel || opts.label
    });
    var out = el('span', { class: 'slider__value', text: String(opts.value) });
    range.addEventListener('input', function () {
      out.textContent = opts.format ? opts.format(range.value) : range.value;
      if (opts.onInput) opts.onInput(range.value);
    });
    range.addEventListener('change', function () { if (opts.onChange) opts.onChange(range.value); });
    return el('div', { class: 'slider' }, el('div', { class: 'slider__row' }, [range, out]));
  }

  /* ================================================================
   * 30. Boot
   * ================================================================ */
  function registerCoreCommands() {
    paletteRegister([
      { id: 'cmd.palette.help', title: 'Command palette', subtitle: 'Ctrl+Shift+F opens this from anywhere', kind: 'command', keywords: 'search find go to', run: function () {} },
      { id: 'cmd.theme.light', title: 'Theme: light', kind: 'setting', keywords: 'appearance colour scheme',
        control: function () { return makeSwitch({ checked: theme.mode() === 'light', ariaLabel: 'Light theme', onChange: function (v) { theme.setMode(v ? 'light' : 'system'); } }); },
        run: function () { theme.setMode('light'); } },
      { id: 'cmd.theme.dark', title: 'Theme: dark', kind: 'setting', keywords: 'appearance colour scheme night',
        control: function () { return makeSwitch({ checked: theme.mode() === 'dark', ariaLabel: 'Dark theme', onChange: function (v) { theme.setMode(v ? 'dark' : 'system'); } }); },
        run: function () { theme.setMode('dark'); } },
      { id: 'cmd.theme.system', title: 'Theme: follow the system', kind: 'setting', keywords: 'appearance auto',
        run: function () { theme.setMode('system'); } },
      { id: 'cmd.motion', title: 'Reduce motion', kind: 'setting', keywords: 'animation accessibility',
        control: function () { return makeSwitch({ checked: theme.motion() === 'reduced', ariaLabel: 'Reduce motion', onChange: function (v) { theme.setMotion(v ? 'reduced' : 'system'); } }); },
        run: function () { theme.setMotion(theme.motion() === 'reduced' ? 'system' : 'reduced'); } },
      { id: 'cmd.density', title: 'Density', kind: 'setting', keywords: 'compact dense comfortable spacing',
        run: function () {
          var order = ['comfortable', 'compact', 'dense'];
          theme.setDensity(order[(order.indexOf(theme.density()) + 1) % order.length]);
          notify.info('Density is now ' + theme.density() + '.');
        } },
      { id: 'cmd.notifications', title: t('notify.centre'), kind: 'command', keywords: 'toast messages alerts history',
        run: function () { notifications.open(document.body); } },
      { id: 'cmd.history', title: t('history.title'), kind: 'command', keywords: 'undo restore versions changes',
        run: function () { history.open(document.body); } },
      { id: 'cmd.locks', title: t('locks.title'), kind: 'command', keywords: 'lock password one-time code',
        run: function () { locks.manage(document.body); } },
      { id: 'cmd.authenticator', title: t('auth.title'), kind: 'command', keywords: 'totp otp two factor qr code',
        run: function () { authenticator.open(document.body); } },
      { id: 'cmd.tickets', title: t('tickets.title'), kind: 'command', keywords: 'support help locked out reset',
        run: function () { support.open(document.body); } },
      { id: 'cmd.tabs.master', title: t('tabs.searchAll'), kind: 'command', keywords: 'tabs find open',
        run: function () { tabsMasterSearch(document.body); } },
      { id: 'cmd.dimsum', title: 'Show a dim sum dish now', kind: 'command', keywords: 'dim sum food surprise',
        run: function () { dimSum.maybeShow(true); } },
      { id: 'cmd.exportSettings', title: 'Export every setting', kind: 'command', keywords: 'backup json yaml csv',
        run: function () {
          var snap = settingsSnapshot();
          exportDialog(Object.keys(snap).map(function (k) { return { key: k, value: snap[k] }; }),
            { name: 'settings', anchor: document.body, omitted: 'Lock passwords and authenticator secrets are left out of this file.' });
        } }
    ]);
  }

  function handleTeleportParam() {
    var m = window.location.search.match(/[?&]teleport=([^&]+)/);
    if (!m) return;
    var id = decodeURIComponent(m[1]);
    window.setTimeout(function () {
      var item = paletteItems.filter(function (x) { return x.id === id; })[0];
      if (item) paletteTeleport(item);
    }, 120);
  }

  var booted = false;
  function boot() {
    if (booted) return;
    booted = true;
    applyTheme();
    applyI18n();
    ensureLive();
    ensureToastLayer();
    appearanceApplyAll();
    initSiteNav();
    initActionOverflow();
    registerCoreCommands();
    handleTeleportParam();
    if (!storageOk) notify.warn(t('msg.storageOff'));
    /* The draw happens once the page is usable, never before, and it
       cannot delay anything. */
    window.setTimeout(function () { dimSum.maybeShow(false); }, 900);
    emit('ready', { version: VERSION });
  }

  var readyQueue = [];
  function ready(fn) {
    if (booted) { try { fn(Studio); } catch (e) { report(e); } return; }
    readyQueue.push(fn);
  }
  function flushReady() {
    while (readyQueue.length) {
      var fn = readyQueue.shift();
      try { fn(Studio); } catch (e) { report(e); }
    }
  }

  var Studio = {
    version: VERSION,
    ready: ready,
    on: on,
    emit: emit,

    store: store,
    el: el, append: append, clear: clear, icon: icon, uid: uid,
    escapeHtml: escapeHtml, escapeRegex: escapeRegex,
    copy: copyText, download: downloadText,

    i18n: i18n,
    t: t, t2: t2, tBoth: tBoth, label: label,
    school: school,
    theme: theme,
    appearance: appearance,
    colour: {
      parse: parseColor, translate: translateColor, contrast: function (a, b) { return appearance.contrast(a, b); },
      palettes: palettesFromSeed, roles: rolesFromPalettes, tone: toneHex, picker: colourPicker
    },

    tabs: { create: tabsCreate, masterSearch: tabsMasterSearch, docks: DOCKS.slice(), strips: function () { return allStrips.slice(); } },
    regex: {
      builder: buildRegexPanel, open: openRegexBuilder, evaluate: rexEvaluate, evaluateSync: rexEvaluateSync,
      compile: rexCompile, risk: rexRisk, limits: REX_LIMITS, flags: REX_FLAGS.slice(), pieces: REX_PIECES.slice(),
      engine: 'JavaScript RegExp',
      evaluationMode: function () { return rexWorkerSupported() ? 'worker' : 'main-thread'; }
    },
    createSearchBar: createSearchBar,
    createMenu: openMenu,
    createSelect: createSelect,
    contextMenu: attachContextMenu,

    notify: notify,
    notifications: notifications,
    confirm: confirmDestructive,
    palette: palette,
    overlay: overlay,
    collapse: collapse,
    bulk: bulk,

    locks: locks,
    support: support,
    authenticator: authenticator,
    qr: { encode: qrEncode, svg: qrSvg, otpauthUri: otpauthUri, parseOtpauth: parseOtpauth },
    totp: totpCode,
    base32: { encode: base32Encode, decode: base32Decode },
    hash: { sha1: sha1, sha256: sha256, sha512: sha512, hmac: hmac, pbkdf2: pbkdf2, hex: toHex, utf8: utf8Bytes, base64: base64Encode },

    history: history,
    datePicker: datePicker,
    parseDate: parseTypedDate,
    exportData: exportData,
    exportDialog: exportDialog,
    exportFormats: function () { return EXPORT_FORMATS.slice(); },
    markdown: markdown,
    dimSum: dimSum,
    a11y: a11y,

    settingRow: settingRow,
    makeSwitch: makeSwitch,
    makeSlider: makeSlider,
    flash: flashTarget,

    /* Everything the site holds about this visitor, and the one line
       that resets all of it. Named here so a page can print it. */
    privacy: {
      storagePrefix: NS,
      origin: window.location.origin,
      note: 'Every setting, tab, lock, ticket, history entry and authenticator entry lives in this browser\'s local storage for ' + window.location.origin + '. Clearing this site\'s storage resets all of it.',
      networkRequests: function () {
        return dimSum.photosEnabled()
          ? ['The dim sum dish photo, loaded as an image from ' + DIM_SUM_CATALOG_BASE + '. That is the only request this site makes, and you can switch it off.']
          : [];
      },
      clearAll: function () { return store.clearAll(); }
    }
  };

  // Each page's own bootstrap is an inline script and therefore runs at parse position, which is
  // BEFORE this deferred file executes. A tiny stub in the page head stands in for Studio until
  // now and queues those callbacks here. Adopt them before anything else, or every page's
  // interface silently fails to build while the page itself looks fine.
  var pendingReady = (window.Studio && window.Studio.__pendingReady) || [];

  window.Studio = Studio;

  for (var pi = 0; pi < pendingReady.length; pi += 1) ready(pendingReady[pi]);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { boot(); flushReady(); });
  } else {
    boot(); flushReady();
  }
})();
