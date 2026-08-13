/* ==================================================================
 * World Downloader Studio -- local model suite manager (logic layer)
 *
 * ONE global: window.WDSModels. Everything DOM-shaped lives in
 * models.html; this file is the part that talks to the local model
 * runtime and keeps state, so it can be exercised and reasoned about
 * without a browser.
 *
 * NETWORK. This file's calls are the one thing this lane is explicitly
 * permitted to add beyond the shared runtime's dim-sum photo: requests
 * to a local model runtime's documented HTTP API, at the loopback
 * address the visitor configures (127.0.0.1 by default). Nothing else.
 * No remote model catalog, no proxy, no cloud model service, ever --
 * this site makes no other network request of any kind, so the
 * "exhaustive catalog" this module builds is exhaustive over what the
 * REACHABLE LOCAL RUNTIME reports (installed and currently loaded
 * models), never over a browsable library of everything that could be
 * pulled. That full-library browse is the desktop application's job,
 * because it is not bound by a browser's CORS and mixed-content rules.
 * docs/features/site-models.md says this in full, in the surface
 * itself, per the "document the exact reason" rule.
 *
 * The API targeted is Ollama's documented local HTTP API:
 *   GET    /api/version                    runtime version
 *   GET    /api/tags                       installed models
 *   GET    /api/ps                         currently loaded models
 *   POST   /api/show      {name}           details for one model
 *   POST   /api/pull      {name,stream}    NDJSON progress
 *   POST   /api/copy      {source,destination}
 *   DELETE /api/delete    {name}
 *   POST   /api/chat      {model,messages,stream,options}   NDJSON
 *
 * CORS vs. "not running" -- a browser's fetch() cannot tell these two
 * failures apart on its own: a connection genuinely refused, and a
 * connection that succeeded but was blocked because the runtime has
 * not been told to allow this page's origin. `probe()` below
 * disambiguates them with a second, `mode:"no-cors"` request: that
 * mode ignores the CORS check entirely, so if it resolves at all, a
 * real HTTP response came back and the FIRST failure must have been a
 * CORS block, not a dead port. Two different problems, two different
 * fixes; this is how the module tells them apart instead of reporting
 * one generic "could not connect".
 * ================================================================== */
(function () {
  'use strict';

  /* ================================================================
   * 0. A tiny storage shim.
   *
   * Prefers window.Studio.store (the shared runtime's own storage,
   * same "wds." prefix, same honest fallback behaviour) so a value
   * written here shows up in the same local version history and export
   * as everything else on the site. Falls back to an in-memory map so
   * this file can be loaded and exercised on its own -- in a test
   * harness, or on a page that has not loaded site.js yet -- without
   * throwing.
   * ================================================================ */
  var memory = Object.create(null);
  function hasStudioStore() {
    return typeof window !== 'undefined' && window.Studio && window.Studio.store &&
      typeof window.Studio.store.get === 'function';
  }
  var store = {
    get: function (key, fallback) {
      if (hasStudioStore()) return window.Studio.store.get(key, fallback);
      return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : fallback;
    },
    set: function (key, value) {
      if (hasStudioStore()) return window.Studio.store.set(key, value);
      memory[key] = value;
      return true;
    },
    remove: function (key) {
      if (hasStudioStore()) return window.Studio.store.remove(key);
      delete memory[key];
    }
  };

  /* ================================================================
   * 1. Small pure helpers -- no DOM, no network, safe to call from a
   * plain Node process for verification.
   * ================================================================ */
  function uid(prefix) {
    return (prefix || 'id') + '-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }

  function fmtBytes(n) {
    if (n === null || n === undefined || isNaN(n)) return 'unknown size';
    if (n < 1024) return n + ' B';
    var units = ['KB', 'MB', 'GB', 'TB'], u = -1;
    do { n /= 1024; u++; } while (n >= 1024 && u < units.length - 1);
    return n.toFixed(n >= 10 ? 0 : 1) + ' ' + units[u];
  }

  function fmtDuration(ms) {
    if (ms === null || ms === undefined || isNaN(ms) || ms < 0) return 'unknown';
    var s = Math.round(ms / 1000);
    if (s < 60) return s + 's';
    var m = Math.floor(s / 60); s = s % 60;
    if (m < 60) return m + 'm ' + s + 's';
    var h = Math.floor(m / 60); m = m % 60;
    return h + 'h ' + m + 'm';
  }

  /* Ollama reports parameter size as a short string like "7B", "70B",
     "3.8B", "410M". Parsed conservatively: an unparseable value yields
     null rather than 0, so a missing or odd value can never silently
     read as "a tiny model that obviously fits". */
  function parseParamSizeToBillions(s) {
    if (!s || typeof s !== 'string') return null;
    var m = /^([0-9.]+)\s*([BMK])$/i.exec(s.trim());
    if (!m) return null;
    var n = parseFloat(m[1]);
    if (isNaN(n)) return null;
    var unit = m[2].toUpperCase();
    if (unit === 'B') return n;
    if (unit === 'M') return n / 1000;
    if (unit === 'K') return n / 1000000;
    return null;
  }

  /* Ollama's own naming convention: lowercase family, optional
     "/namespace", optional ":tag". Validated so the guided form can
     tell a visitor what is wrong with what they typed rather than just
     rejecting it. */
  var NAME_RE = /^[a-z0-9]([a-z0-9._-]*[a-z0-9])?(\/[a-z0-9]([a-z0-9._-]*[a-z0-9])?)?(:[a-zA-Z0-9._-]+)?$/;
  function validateModelName(name) {
    if (!name || !name.trim()) return { ok: false, reason: 'empty' };
    var trimmed = name.trim();
    if (trimmed.length > 200) return { ok: false, reason: 'long' };
    if (!NAME_RE.test(trimmed)) return { ok: false, reason: 'format' };
    return { ok: true, value: trimmed };
  }

  function clamp(n, lo, hi) { return n < lo ? lo : (n > hi ? hi : n); }

  /* ================================================================
   * 2. Connection -- base URL and the honest probe.
   * ================================================================ */
  var DEFAULT_BASE_URL = 'http://127.0.0.1:11434';

  function getBaseUrl() { return store.get('models.baseUrl', DEFAULT_BASE_URL); }
  function setBaseUrl(url) {
    var v = (url || '').trim().replace(/\/+$/, '');
    if (!v) v = DEFAULT_BASE_URL;
    store.set('models.baseUrl', v);
    return v;
  }

  function fetchWithTimeout(url, opts, timeoutMs) {
    opts = opts || {};
    if (typeof fetch === 'undefined') {
      return Promise.reject(Object.assign(new Error('no-fetch'), { code: 'no-fetch' }));
    }
    var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var to = null;
    if (ctrl) {
      to = setTimeout(function () { ctrl.abort(); }, timeoutMs || 4000);
      opts.signal = opts.signal || ctrl.signal;
    }
    return fetch(url, opts).then(
      function (res) { if (to) clearTimeout(to); return res; },
      function (err) { if (to) clearTimeout(to); throw err; }
    );
  }

  /* state: 'reachable' | 'cors-blocked' | 'unreachable' | 'unsupported' */
  function probe(baseUrl) {
    baseUrl = baseUrl || getBaseUrl();
    if (typeof fetch === 'undefined') {
      return Promise.resolve({ state: 'unsupported', baseUrl: baseUrl,
        detail: 'This browser has no fetch API, so this page cannot reach any local runtime at all.' });
    }
    return fetchWithTimeout(baseUrl + '/api/version', { mode: 'cors', cache: 'no-store' }, 4000).then(
      function (res) {
        if (!res.ok) {
          return { state: 'reachable', baseUrl: baseUrl, version: null,
            detail: 'A response came back (HTTP ' + res.status + '), but /api/version itself did not succeed.' };
        }
        return res.json().then(
          function (data) { return { state: 'reachable', baseUrl: baseUrl, version: (data && data.version) || null, detail: '' }; },
          function () { return { state: 'reachable', baseUrl: baseUrl, version: null, detail: 'The response body was not valid JSON.' }; }
        );
      },
      function (err) {
        /* The cors-mode request failed. Try no-cors: it never performs
           the CORS check, so if THIS resolves, a real server answered
           and the failure above must be a CORS block, not a dead port. */
        return fetchWithTimeout(baseUrl + '/api/version', { mode: 'no-cors', cache: 'no-store' }, 4000).then(
          function () {
            return { state: 'cors-blocked', baseUrl: baseUrl,
              detail: 'Something answered at ' + baseUrl + ', but this page\'s origin was not allowed to read the response. ' +
                'Set OLLAMA_ORIGINS to include this page\'s exact origin (for example OLLAMA_ORIGINS=' +
                (typeof window !== 'undefined' && window.location ? window.location.origin : '<this page\'s origin>') +
                ') and restart the runtime.' };
          },
          function () {
            return { state: 'unreachable', baseUrl: baseUrl,
              detail: 'Nothing answered at ' + baseUrl + '. Either the runtime is not running, or it is listening on a ' +
                'different address or port than this page is configured to use.' };
          }
        );
      }
    );
  }

  function getJson(path) {
    var baseUrl = getBaseUrl();
    return fetchWithTimeout(baseUrl + path, { mode: 'cors', cache: 'no-store' }, 8000).then(function (res) {
      if (!res.ok) return res.text().then(function (txt) { throw httpError(res.status, txt); });
      return res.json();
    });
  }

  function postJson(path, body, method) {
    var baseUrl = getBaseUrl();
    return fetchWithTimeout(baseUrl + path, {
      method: method || 'POST', mode: 'cors', cache: 'no-store',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {})
    }, 15000).then(function (res) {
      if (!res.ok) return res.text().then(function (txt) { throw httpError(res.status, txt); });
      var ct = res.headers && res.headers.get ? (res.headers.get('content-type') || '') : '';
      if (ct.indexOf('application/json') >= 0) return res.json();
      return res.text();
    });
  }

  function httpError(status, text) {
    var err = new Error('HTTP ' + status + (text ? ': ' + String(text).slice(0, 400) : ''));
    err.httpStatus = status;
    return err;
  }

  /* Streams newline-delimited JSON. onEvent is called once per parsed
     line. Falls back to reading the whole body at once on an engine
     with no streaming reader, which loses live progress but never
     loses an event. */
  function streamNdjson(path, body, onEvent, signal) {
    var baseUrl = getBaseUrl();
    if (typeof fetch === 'undefined') return Promise.reject(new Error('This browser has no fetch API.'));
    return fetch(baseUrl + path, {
      method: 'POST', mode: 'cors', cache: 'no-store', signal: signal,
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {})
    }).then(function (res) {
      if (!res.ok) return res.text().then(function (txt) { throw httpError(res.status, txt); });
      if (!res.body || !res.body.getReader) {
        return res.text().then(function (txt) {
          txt.split('\n').forEach(function (line) { if (line.trim()) safeEmit(onEvent, line); });
        });
      }
      var reader = res.body.getReader();
      var decoder = new TextDecoder('utf-8');
      var buf = '';
      function pump() {
        return reader.read().then(function (step) {
          if (step.done) {
            buf += decoder.decode();
            if (buf.trim()) safeEmit(onEvent, buf);
            return;
          }
          buf += decoder.decode(step.value, { stream: true });
          var lines = buf.split('\n');
          buf = lines.pop();
          lines.forEach(function (line) { if (line.trim()) safeEmit(onEvent, line); });
          return pump();
        });
      }
      return pump();
    });
  }
  function safeEmit(onEvent, line) {
    try { onEvent(JSON.parse(line)); } catch (e) { /* one malformed line never kills the stream */ }
  }

  /* ================================================================
   * 3. Catalog -- exhaustive over the reachable local runtime, never
   * curated. Follows every page the runtime's own /api/tags returns
   * (Ollama does not paginate that endpoint today, but the loop below
   * keeps following a `next` cursor if one is ever added, rather than
   * silently reading only page one forever).
   * ================================================================ */
  function fetchAllTags() {
    var pages = 0;
    var all = [];
    function step(cursor) {
      pages++;
      var path = '/api/tags' + (cursor ? ('?cursor=' + encodeURIComponent(cursor)) : '');
      return getJson(path).then(function (data) {
        var models = (data && data.models) || [];
        all = all.concat(models);
        if (data && data.next) return step(data.next);
        return { models: all, pages: pages };
      });
    }
    return step(null);
  }

  function refreshCatalog() {
    var baseUrl = getBaseUrl();
    return probe(baseUrl).then(function (p) {
      if (p.state !== 'reachable') {
        return { ok: false, state: p.state, detail: p.detail, baseUrl: baseUrl };
      }
      return Promise.all([
        fetchAllTags(),
        getJson('/api/ps').catch(function () { return { models: [] }; })
      ]).then(function (results) {
        var tagsResult = results[0], psResult = results[1];
        var running = {};
        (psResult.models || []).forEach(function (m) { running[m.name || m.model] = m; });
        var entries = (tagsResult.models || []).map(function (m) {
          var name = m.name || m.model;
          return {
            name: name,
            family: (m.details && (m.details.family || (m.details.families && m.details.families[0]))) || null,
            parameterSize: (m.details && m.details.parameter_size) || null,
            quantization: (m.details && m.details.quantization_level) || null,
            format: (m.details && m.details.format) || null,
            sizeBytes: (typeof m.size === 'number') ? m.size : null,
            digest: m.digest || null,
            modifiedAt: m.modified_at || null,
            running: !!running[name],
            runningVramBytes: running[name] ? (running[name].size_vram || null) : null,
            expiresAt: running[name] ? (running[name].expires_at || null) : null
          };
        });
        var snapshot = {
          ok: true,
          state: 'reachable',
          baseUrl: baseUrl,
          entries: entries,
          pageCount: tagsResult.pages,
          refreshedAt: new Date().toISOString(),
          completeness: 'complete',
          completenessNote: tagsResult.pages === 1
            ? 'The runtime returned every installed model in one response, with no further-page cursor, so this is everything it reports installed right now.'
            : ('The runtime paginated across ' + tagsResult.pages + ' responses; every page was followed, so this is everything it reports installed right now.')
        };
        store.set('models.catalog.snapshot', snapshot);
        return snapshot;
      });
    }).catch(function (err) {
      var failure = { ok: false, state: 'error', detail: (err && err.message) || String(err), baseUrl: baseUrl };
      return failure;
    });
  }

  function lastSnapshot() {
    return store.get('models.catalog.snapshot', null);
  }

  function snapshotAgeMs(snapshot) {
    if (!snapshot || !snapshot.refreshedAt) return null;
    var t = Date.parse(snapshot.refreshedAt);
    if (isNaN(t)) return null;
    return Date.now() - t;
  }

  function showModel(name) {
    return postJson('/api/show', { name: name });
  }

  function deleteModel(name) {
    return postJson('/api/delete', { name: name }, 'DELETE');
  }

  function copyModel(source, destination) {
    return postJson('/api/copy', { source: source, destination: destination });
  }

  /* ================================================================
   * 4. Hardware fit -- conservative, evidence-backed, never inferred
   * from a name, and "Unknown" whenever evidence is missing rather
   * than treated as zero.
   * ================================================================ */
  function hardwareEvidence() {
    var nav = (typeof navigator !== 'undefined') ? navigator : {};
    var deviceMemoryGb = (typeof nav.deviceMemory === 'number') ? nav.deviceMemory : null;
    var logicalCores = (typeof nav.hardwareConcurrency === 'number') ? nav.hardwareConcurrency : null;
    return {
      deviceMemoryGb: deviceMemoryGb,
      logicalCores: logicalCores,
      vramKnown: false,
      gpuKnown: false,
      freeDiskKnown: false,
      source: 'navigator.deviceMemory (a coarse, rounded, capped bucket that Firefox and Safari never report at all) and ' +
        'navigator.hardwareConcurrency. A web page has no way to observe a graphics card, its VRAM, or free disk space.'
    };
  }

  /* verdict: 'Runs well' | 'Runs with limits' | 'Unlikely' | 'Unknown' */
  function hardwareVerdict(entry, evidence) {
    evidence = evidence || hardwareEvidence();
    var reasons = [];
    if (evidence.deviceMemoryGb === null) {
      reasons.push('This browser does not report navigator.deviceMemory at all, so there is no memory evidence to reason from.');
      reasons.push('The desktop application can read real system RAM, free VRAM and disk space directly; this page cannot, on any browser.');
      return { verdict: 'Unknown', reasons: reasons, evidence: evidence };
    }
    if (entry.sizeBytes === null || entry.sizeBytes === undefined) {
      reasons.push('The runtime did not report an on-disk size for this model, so there is nothing to compare against the available memory evidence.');
      return { verdict: 'Unknown', reasons: reasons, evidence: evidence };
    }
    var sizeGb = entry.sizeBytes / (1024 * 1024 * 1024);
    reasons.push('Reported on-disk size: ' + sizeGb.toFixed(1) + ' GB.');
    reasons.push('Reported device memory: about ' + evidence.deviceMemoryGb + ' GB (a coarse browser-rounded bucket, not an exact reading, and this page cannot tell whether it would run in system memory or in a graphics card\'s own separate memory).');
    if (sizeGb * 1.3 > evidence.deviceMemoryGb) {
      reasons.push('The reported memory bucket is smaller than a conservative estimate of what this model alone needs on disk, before the browser, the operating system, or a conversation\'s context are even accounted for.');
      return { verdict: 'Unlikely', reasons: reasons, evidence: evidence };
    }
    if (sizeGb * 2.2 > evidence.deviceMemoryGb) {
      reasons.push('Reported memory clears the model\'s own size, but not by enough margin to be confident once everything else running on the machine is accounted for.');
      return { verdict: 'Runs with limits', reasons: reasons, evidence: evidence };
    }
    reasons.push('Reported memory comfortably clears a generous multiple of the model\'s on-disk size -- the most this page can responsibly say without seeing a graphics card, its VRAM, or free disk space.');
    return { verdict: 'Runs well', reasons: reasons, evidence: evidence };
  }

  /* ================================================================
   * 5. Pull queue -- durable, bounded concurrency, byte-accurate
   * progress when the runtime supplies it, cancel, retry, honest
   * partial outcomes. A failed item never turns the batch green.
   * ================================================================ */
  var MAX_CONCURRENT_PULLS = 2;
  var pullState = { items: [], controllers: {}, listeners: [] };

  function loadPullQueue() {
    var saved = store.get('models.pullQueue', []);
    /* A page reload drops any in-flight fetch stream. An item that was
       "active" when storage was last written did not necessarily fail
       -- the runtime may well have kept pulling in the background --
       but THIS TAB cannot know that, so it is reported as interrupted
       rather than silently re-labelled as either success or failure. */
    pullState.items = (saved || []).map(function (it) {
      if (it.status === 'active' || it.status === 'queued') {
        return Object.assign({}, it, {
          status: 'interrupted',
          note: 'This browser tab was reloaded while this item was in progress. The runtime may have continued in the ' +
            'background -- refresh the catalog to check -- or you can retry this item to pull it again.'
        });
      }
      return it;
    });
    return pullState.items;
  }

  function savePullQueue() {
    store.set('models.pullQueue', pullState.items.map(function (it) {
      var copy = {};
      for (var k in it) if (k !== 'onProgress') copy[k] = it[k];
      return copy;
    }));
    notifyPullListeners();
  }

  function notifyPullListeners() {
    pullState.listeners.forEach(function (fn) { try { fn(pullState.items.slice()); } catch (e) { /* ignore */ } });
  }
  function onPullChange(fn) {
    pullState.listeners.push(fn);
    return function () {
      var i = pullState.listeners.indexOf(fn);
      if (i >= 0) pullState.listeners.splice(i, 1);
    };
  }

  function pullItems() { return pullState.items.slice(); }

  function enqueuePull(name) {
    var v = validateModelName(name);
    if (!v.ok) return { ok: false, reason: v.reason };
    var item = {
      id: uid('pull'), name: v.value, status: 'queued',
      completedBytes: 0, totalBytes: null, statusText: 'Queued', addedAt: new Date().toISOString(),
      attempts: 0, error: null, note: null
    };
    pullState.items.unshift(item);
    savePullQueue();
    runPullQueue();
    return { ok: true, id: item.id };
  }

  function activeCount() {
    return pullState.items.filter(function (i) { return i.status === 'active'; }).length;
  }

  function runPullQueue() {
    while (activeCount() < MAX_CONCURRENT_PULLS) {
      var next = pullState.items.filter(function (i) { return i.status === 'queued'; })[0];
      if (!next) return;
      startPull(next);
    }
  }

  function startPull(item) {
    item.status = 'active'; item.statusText = 'Starting'; item.attempts++;
    item.error = null; item.note = null;
    savePullQueue();
    var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    if (ctrl) pullState.controllers[item.id] = ctrl;
    streamNdjson('/api/pull', { name: item.name, stream: true }, function (evt) {
      if (evt.total) item.totalBytes = evt.total;
      if (typeof evt.completed === 'number') item.completedBytes = evt.completed;
      if (evt.status) item.statusText = String(evt.status);
      if (evt.error) item.error = String(evt.error);
      savePullQueue();
    }, ctrl ? ctrl.signal : undefined).then(function () {
      delete pullState.controllers[item.id];
      if (item.error) {
        item.status = 'failed'; item.statusText = 'Failed';
      } else {
        item.status = 'done'; item.statusText = 'Complete';
        item.completedBytes = item.totalBytes || item.completedBytes;
      }
      savePullQueue();
      runPullQueue();
    }, function (err) {
      delete pullState.controllers[item.id];
      var wasCancelled = err && (err.name === 'AbortError');
      item.status = wasCancelled ? 'cancelled' : 'failed';
      item.statusText = wasCancelled ? 'Cancelled' : 'Failed';
      item.error = wasCancelled ? null : ((err && err.message) || String(err));
      savePullQueue();
      runPullQueue();
    });
  }

  function cancelPull(id) {
    var ctrl = pullState.controllers[id];
    if (ctrl) { ctrl.abort(); return { ok: true }; }
    var item = pullState.items.filter(function (i) { return i.id === id; })[0];
    if (item && item.status === 'queued') {
      item.status = 'cancelled'; item.statusText = 'Cancelled (never started)';
      savePullQueue();
      return { ok: true };
    }
    return { ok: false, reason: 'not-active' };
  }

  function retryPull(id) {
    var item = pullState.items.filter(function (i) { return i.id === id; })[0];
    if (!item) return { ok: false, reason: 'missing' };
    if (item.status === 'active' || item.status === 'queued') return { ok: false, reason: 'already-running' };
    item.status = 'queued'; item.statusText = 'Queued (retry)'; item.completedBytes = 0; item.error = null; item.note = null;
    savePullQueue();
    runPullQueue();
    return { ok: true };
  }

  function removePullItem(id) {
    var item = pullState.items.filter(function (i) { return i.id === id; })[0];
    if (item && (item.status === 'active' || item.status === 'queued')) return { ok: false, reason: 'running' };
    pullState.items = pullState.items.filter(function (i) { return i.id !== id; });
    savePullQueue();
    return { ok: true };
  }

  function clearFinishedPulls() {
    var before = pullState.items.length;
    pullState.items = pullState.items.filter(function (i) {
      return i.status === 'active' || i.status === 'queued';
    });
    savePullQueue();
    return before - pullState.items.length;
  }

  /* ================================================================
   * 6. Chat -- local sessions, streaming, capability-gated attachments.
   * ================================================================ */
  var DEFAULT_PARAMS = { temperature: 0.8, top_p: 0.9, top_k: 40, num_ctx: 2048, seed: null, repeat_penalty: 1.1 };
  var PARAM_BOUNDS = {
    temperature: { min: 0, max: 2, step: 0.05 },
    top_p: { min: 0, max: 1, step: 0.05 },
    top_k: { min: 0, max: 200, step: 1 },
    num_ctx: { min: 128, max: 131072, step: 128 },
    repeat_penalty: { min: 0.5, max: 2, step: 0.05 }
  };

  function listChatSessions() {
    return store.get('models.chat.sessions', []);
  }
  function saveChatSessions(list) {
    store.set('models.chat.sessions', list);
  }
  function newChatSession(model) {
    var session = {
      id: uid('chat'), title: 'New chat', model: model || null,
      systemPrompt: '', params: Object.assign({}, DEFAULT_PARAMS),
      messages: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    };
    var list = listChatSessions();
    list.unshift(session);
    saveChatSessions(list);
    return session;
  }
  function getChatSession(id) {
    return listChatSessions().filter(function (s) { return s.id === id; })[0] || null;
  }
  function updateChatSession(id, patch) {
    var list = listChatSessions();
    var found = false;
    list = list.map(function (s) {
      if (s.id !== id) return s;
      found = true;
      var merged = Object.assign({}, s, patch, { updatedAt: new Date().toISOString() });
      return merged;
    });
    if (found) saveChatSessions(list);
    return found;
  }
  function deleteChatSession(id) {
    var list = listChatSessions().filter(function (s) { return s.id !== id; });
    saveChatSessions(list);
  }

  function clampParams(params) {
    var out = Object.assign({}, DEFAULT_PARAMS, params || {});
    Object.keys(PARAM_BOUNDS).forEach(function (k) {
      if (typeof out[k] !== 'number' || isNaN(out[k])) { out[k] = DEFAULT_PARAMS[k]; return; }
      out[k] = clamp(out[k], PARAM_BOUNDS[k].min, PARAM_BOUNDS[k].max);
    });
    if (out.seed !== null && out.seed !== undefined) out.seed = Math.round(out.seed);
    return out;
  }

  /* Reads the capability list the runtime itself reports for a model
     (via /api/show), never guessed from the model's name. Anything
     this page cannot confirm reports as unknown/false rather than a
     silent guess of "yes". */
  function modelCapabilities(showResponse) {
    var caps = (showResponse && showResponse.capabilities) || null;
    if (!caps || !caps.length) {
      return { known: false, vision: false, tools: false, note: 'This runtime version did not report a capability list for this model, so attachments stay off until it does.' };
    }
    return {
      known: true,
      vision: caps.indexOf('vision') >= 0,
      tools: caps.indexOf('tools') >= 0,
      note: 'Reported capabilities: ' + caps.join(', ') + '.'
    };
  }

  function sendChatMessage(sessionId, userText, images, onDelta, onDone, onError) {
    var session = getChatSession(sessionId);
    if (!session) { onError(new Error('That chat session no longer exists.')); return function () {}; }
    if (!session.model) { onError(new Error('Choose a model before sending a message.')); return function () {}; }
    var messages = session.messages.slice();
    if (session.systemPrompt && session.systemPrompt.trim() && !messages.some(function (m) { return m.role === 'system'; })) {
      messages.unshift({ role: 'system', content: session.systemPrompt });
    }
    var userMsg = { role: 'user', content: userText, images: (images && images.length) ? images : undefined };
    messages.push(userMsg);
    var assistantAcc = '';
    var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    updateChatSession(sessionId, { messages: session.messages.concat([userMsg]) });
    streamNdjson('/api/chat', {
      model: session.model, messages: messages, stream: true, options: clampParams(session.params)
    }, function (evt) {
      if (evt.message && typeof evt.message.content === 'string') {
        assistantAcc += evt.message.content;
        onDelta(assistantAcc);
      }
    }, ctrl ? ctrl.signal : undefined).then(function () {
      var fresh = getChatSession(sessionId);
      var finalMessages = (fresh ? fresh.messages : session.messages.concat([userMsg])).concat([{ role: 'assistant', content: assistantAcc }]);
      updateChatSession(sessionId, { messages: finalMessages });
      onDone(assistantAcc);
    }, function (err) {
      var wasCancelled = err && err.name === 'AbortError';
      onError(wasCancelled ? Object.assign(new Error('Stopped by request.'), { cancelled: true }) : err);
    });
    return function stop() { if (ctrl) ctrl.abort(); };
  }

  /* ================================================================
   * 7. Harness -- a desktop capability. Listed, disabled, named why.
   * ================================================================ */
  var HARNESS_PROFILES = [
    { id: 'code-editor', label: 'Code editor integration', reason: 'harness-spawn' },
    { id: 'automation-script', label: 'Custom local automation script', reason: 'harness-spawn' },
    { id: 'third-party-chat', label: 'Third-party chat client bridge', reason: 'harness-spawn' }
  ];
  var HARNESS_DISABLED_REASON =
    'Launching a harness starts a local process on this machine. A web page cannot start a process on the visitor\'s ' +
    'computer, in any browser -- that capability exists only in the desktop application, which runs with the ' +
    'operating-system access a browser sandbox deliberately withholds.';
  function harnessProfiles() {
    return HARNESS_PROFILES.map(function (p) {
      return { id: p.id, label: p.label, disabled: true, disabledReason: HARNESS_DISABLED_REASON };
    });
  }

  /* ================================================================
   * 8. Public surface
   * ================================================================ */
  window.WDSModels = {
    DEFAULT_BASE_URL: DEFAULT_BASE_URL,
    DEFAULT_PARAMS: DEFAULT_PARAMS,
    PARAM_BOUNDS: PARAM_BOUNDS,

    fmtBytes: fmtBytes,
    fmtDuration: fmtDuration,
    parseParamSizeToBillions: parseParamSizeToBillions,
    validateModelName: validateModelName,

    getBaseUrl: getBaseUrl,
    setBaseUrl: setBaseUrl,
    probe: probe,

    refreshCatalog: refreshCatalog,
    lastSnapshot: lastSnapshot,
    snapshotAgeMs: snapshotAgeMs,
    showModel: showModel,
    deleteModel: deleteModel,
    copyModel: copyModel,

    hardwareEvidence: hardwareEvidence,
    hardwareVerdict: hardwareVerdict,

    loadPullQueue: loadPullQueue,
    pullItems: pullItems,
    enqueuePull: enqueuePull,
    cancelPull: cancelPull,
    retryPull: retryPull,
    removePullItem: removePullItem,
    clearFinishedPulls: clearFinishedPulls,
    onPullChange: onPullChange,

    listChatSessions: listChatSessions,
    newChatSession: newChatSession,
    getChatSession: getChatSession,
    updateChatSession: updateChatSession,
    deleteChatSession: deleteChatSession,
    clampParams: clampParams,
    modelCapabilities: modelCapabilities,
    sendChatMessage: sendChatMessage,

    harnessProfiles: harnessProfiles,
    HARNESS_DISABLED_REASON: HARNESS_DISABLED_REASON
  };
}());
