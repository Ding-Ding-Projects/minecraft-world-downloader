/* schedule.js — the live scheduling engine for scheduled settings.
 *
 * Feature inventory rows 7.1, 7.2, 7.3.
 *
 * This file is the ONE place that decides which scheduled rule wins, right
 * now, for every setting this site lets a rule hold. It is written so it can
 * be loaded on any page and keep that page's language, theme, density,
 * accent colour, font, text size, weight and motion live and correct without
 * that page ever visiting Settings.
 *
 * It shares its storage with the Scheduled settings tab on settings.html —
 * same keys, same schema version, same window-matching arithmetic — so a
 * rule created in one place is read identically by the other. Nothing here
 * rewrites or migrates a document the settings tab already understands; it
 * only reads it, decides who wins, and applies or releases values.
 *
 * Public surface: window.StudioSchedule (documented at the bottom). Once
 * Studio has booted, a convenience alias is also written to Studio.scheduler
 * when nothing else already claimed that name.
 *
 * IMPORTANT — this file is not wired into any page yet. See the "Hook
 * needed" note at the bottom, and docs/features/site-scheduled-settings.md.
 */
(function () {
  'use strict';

  var STORE_RULES = 'schedule.rules';
  var STORE_BASE = 'schedule.base';
  var SCHEMA_VERSION = 1;
  var WEEKDAY_IDS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  var TICK_MS = 20000; /* 20 s — quick enough that a window boundary reads as live without hammering the tab. */

  /* ------------------------------------------------------------------
   * 1. Small pure helpers. No window, no document, no Studio: these can
   *    be exercised from plain Node, which is how they are verified.
   * ------------------------------------------------------------------ */
  function pad2(n) { return n < 10 ? '0' + n : String(n); }

  function localDateStr(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  /** '9:5' and '09:05' both parse; an out-of-range hour or minute is invalid. */
  function toMinutes(hhmm) {
    var m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || ''));
    if (!m) return null;
    var h = parseInt(m[1], 10), mm = parseInt(m[2], 10);
    if (h < 0 || h > 23 || mm < 0 || mm > 59) return null;
    return h * 60 + mm;
  }

  /**
   * Whether one rule is active at `now`, read in `now`'s own local time.
   *
   * Stated semantics (also shown on the Scheduled settings tab):
   *   - Both times empty            -> active all day on the days it matches.
   *   - Only a start time           -> runs from that time to the end of the day.
   *   - Only an end time            -> runs from the start of the day to that time.
   *   - start < end                 -> half-open [start, end): start included, end excluded.
   *   - start > end                 -> wraps past midnight, matched against the
   *                                     day it STARTS on (so a Friday-night rule
   *                                     needs only Friday selected, not Saturday).
   *   - start == end                -> a zero-length window. It NEVER matches.
   *                                     This is a stated decision, not an accident:
   *                                     a rule with equal times can never have been
   *                                     meant to run, so it is treated as inert
   *                                     rather than guessed into "all day".
   *   - Date bounds                 -> inclusive, compared as local calendar dates.
   *                                     An end date before the start date can never
   *                                     match, which is itself the honest answer
   *                                     rather than a special case.
   *   - No weekdays selected        -> can never match.
   *   - Disabled, or a source other than "local" -> never matches here. A
   *     remote source is listed and explained but not evaluated by this site.
   */
  function ruleMatches(rule, now) {
    if (!rule || !rule.enabled) return false;
    if (rule.source && rule.source !== 'local') return false;
    var ymd = localDateStr(now);
    if (rule.startDate && ymd < rule.startDate) return false;
    if (rule.endDate && ymd > rule.endDate) return false;
    if (rule.days !== 'every') {
      if (!Array.isArray(rule.days) || rule.days.indexOf(WEEKDAY_IDS[now.getDay()]) < 0) return false;
    }
    var mins = now.getHours() * 60 + now.getMinutes();
    var s = rule.startTime ? toMinutes(rule.startTime) : 0;
    var e = rule.endTime ? toMinutes(rule.endTime) : 1440;
    if (s === null) s = 0;
    if (e === null) e = 1440;
    if (s === e) return false;
    if (s < e) return mins >= s && mins < e;
    return mins >= s || mins < e;
  }

  /**
   * Deterministic precedence, decided per setting: among the rules matching
   * right now, the highest `priority` wins; a tie goes to whichever rule sits
   * further down the document (later index). Every setting resolves
   * independently, so a low-priority rule can still win a setting that no
   * higher-priority rule is currently claiming.
   */
  function winnersAt(doc, now, isKnownSetting) {
    var out = Object.create(null);
    var rules = (doc && Array.isArray(doc.rules)) ? doc.rules : [];
    rules.forEach(function (rule, i) {
      if (!rule || typeof rule.setting !== 'string') return;
      if (isKnownSetting && !isKnownSetting(rule.setting)) return;
      if (!ruleMatches(rule, now)) return;
      var cur = out[rule.setting];
      var priority = typeof rule.priority === 'number' ? rule.priority : 0;
      if (!cur || priority > cur.priority || (priority === cur.priority && i > cur.index)) {
        out[rule.setting] = { rule: rule, index: i, priority: priority };
      }
    });
    return out;
  }

  /**
   * Weekday matching table, once, for whoever renders the "how a window is
   * read" reference (the settings tab keeps its own copy of this table in
   * its own copy for its own users; this one is for anything reading the
   * engine directly, and the two are kept in sync by hand).
   */
  var WINDOW_SEMANTICS = [
    { input: 'Both times empty', meaning: 'The rule is active all day on the days it matches.' },
    { input: 'Only a start time', meaning: 'The window runs from that time to the end of the day.' },
    { input: 'Only an end time', meaning: 'The window runs from the start of the day to that time.' },
    { input: 'Start earlier than end', meaning: 'Active from the start time inclusive to the end time exclusive.' },
    { input: 'Start later than end', meaning: 'The window wraps past midnight and is matched against the day it started on.' },
    { input: 'Start equal to end', meaning: 'A zero-length window. It never matches — a deliberate reading, not a guess.' },
    { input: 'Both dates empty', meaning: 'No start or end date; the rule runs whenever its times and days match.' },
    { input: 'Dates given', meaning: 'Inclusive on both ends, compared as local calendar dates.' },
    { input: 'End date before start date', meaning: 'Can never match, which is the honest answer for that input.' },
    { input: 'No weekday selected, "every day" off', meaning: 'Can never match.' },
    { input: 'Two rules match the same setting at once', meaning: 'Highest priority wins; a tie goes to the rule further down the list.' },
    { input: 'No rule matches a setting', meaning: 'That setting shows whatever you set it to by hand.' }
  ];

  /* ------------------------------------------------------------------
   * 2. Schema, read, write, migration.
   *
   * Only schema version 1 exists anywhere on this site today, so the
   * migration table below is genuinely empty — there is nothing yet to
   * migrate FROM. It is still real, callable code, structured exactly as
   * the day a version 2 ships: register the upgrade function under the
   * version it upgrades FROM, and read() applies every registered step in
   * order. A document from a schema NEWER than this file understands is
   * left untouched and reported, never guessed at or silently dropped.
   * ------------------------------------------------------------------ */
  var MIGRATIONS = Object.create(null); /* fromVersion (number) -> function(doc): doc */

  function registerMigration(fromVersion, fn) { MIGRATIONS[fromVersion] = fn; }

  function migrateForward(raw) {
    var doc = raw;
    var steps = 0;
    while (doc && typeof doc.schemaVersion === 'number' && doc.schemaVersion < SCHEMA_VERSION
           && MIGRATIONS[doc.schemaVersion] && steps < 20) {
      doc = MIGRATIONS[doc.schemaVersion](doc);
      steps++;
    }
    return doc;
  }

  function studioStore() {
    return (window.Studio && window.Studio.store) ? window.Studio.store : null;
  }

  function readDoc() {
    var store = studioStore();
    var raw = store ? store.get(STORE_RULES, null) : null;
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.rules)) {
      return { schemaVersion: SCHEMA_VERSION, rules: [] };
    }
    if (typeof raw.schemaVersion === 'number' && raw.schemaVersion > SCHEMA_VERSION) {
      if (window.console && console.warn) {
        console.warn('[StudioSchedule] schedule.rules was written by a newer schema (' +
          raw.schemaVersion + ' > ' + SCHEMA_VERSION + ' this file understands). ' +
          'Left untouched on disk; no rule from it is evaluated here.');
      }
      return { schemaVersion: SCHEMA_VERSION, rules: [] };
    }
    if (typeof raw.schemaVersion === 'number' && raw.schemaVersion < SCHEMA_VERSION) {
      var migrated = migrateForward(raw);
      if (migrated && migrated.schemaVersion === SCHEMA_VERSION && Array.isArray(migrated.rules)) {
        return { schemaVersion: SCHEMA_VERSION, rules: migrated.rules };
      }
      return { schemaVersion: SCHEMA_VERSION, rules: [] };
    }
    if (raw.schemaVersion !== SCHEMA_VERSION) return { schemaVersion: SCHEMA_VERSION, rules: [] };
    return { schemaVersion: SCHEMA_VERSION, rules: raw.rules };
  }

  function writeDoc(doc) {
    var store = studioStore();
    if (!store) return false;
    var rules = (doc && Array.isArray(doc.rules)) ? doc.rules : [];
    store.set(STORE_RULES, { schemaVersion: SCHEMA_VERSION, rules: rules });
    if (window.Studio && window.Studio.history) {
      window.Studio.history.record('schedule',
        'Scheduled settings changed: ' + rules.length + ' rule' + (rules.length === 1 ? '' : 's') + '.',
        { rules: rules.length });
    }
    return true;
  }

  function readBase() {
    var store = studioStore();
    var base = store ? store.get(STORE_BASE, {}) : {};
    return (base && typeof base === 'object') ? base : {};
  }

  function writeBase(base) {
    var store = studioStore();
    if (store) store.set(STORE_BASE, base);
  }

  /* ------------------------------------------------------------------
   * 3. The schedulable-settings registry.
   *
   * "Every other appearance value this site exposes" — language mode,
   * theme mode, density, accent colour, interface font, text size, label
   * weight and motion. A page can add its own with .register(); the
   * runtime does not have to know about a setting in advance for a rule
   * to hold it.
   * ------------------------------------------------------------------ */
  var REGISTRY = Object.create(null);
  var REGISTRY_ORDER = [];

  function register(id, def) {
    if (!REGISTRY[id]) REGISTRY_ORDER.push(id);
    REGISTRY[id] = def;
  }

  function isRegistered(id) { return !!REGISTRY[id]; }

  function resolveOptions(def) {
    if (!def) return null;
    if (typeof def.options === 'function') { try { return def.options(); } catch (e) { return null; } }
    return def.options || null;
  }

  function safeGet(def) {
    try { return def.get(); } catch (e) { return undefined; }
  }
  function safeSet(def, value) {
    try { def.set(value); } catch (e) { /* one broken registration must not stop the rest. */ }
  }

  function bootRegistry(S) {
    register('lang.mode', {
      label: 'Language mode', shipped: 'en',
      options: [{ value: 'en', label: 'English' }, { value: 'zh', label: 'Cantonese' }, { value: 'both', label: 'Both' }],
      get: function () { return S.i18n.storedMode(); },
      /* S.i18n.setMode() already refuses silently while School mode is
         active, so a rule scheduled for Cantonese or bilingual mode is
         correctly inert during School mode without this file re-checking it. */
      set: function (v) { S.i18n.setMode(v); }
    });
    register('theme.mode', {
      label: 'Theme', shipped: 'system',
      options: [{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }, { value: 'system', label: 'Follow the system' }],
      get: function () { return S.theme.mode(); },
      set: function (v) { S.theme.setMode(v); }
    });
    register('theme.density', {
      label: 'Density', shipped: 'comfortable',
      options: [{ value: 'comfortable', label: 'Comfortable' }, { value: 'compact', label: 'Compact' }, { value: 'dense', label: 'Dense' }],
      get: function () { return S.theme.density(); },
      set: function (v) { S.theme.setDensity(v); }
    });
    register('theme.motion', {
      label: 'Motion', shipped: 'system',
      options: [{ value: 'system', label: 'As the system asks' }, { value: 'reduced', label: 'Reduced' }],
      get: function () { return S.theme.motion(); },
      set: function (v) { S.theme.setMotion(v); }
    });
    register('theme.seed', {
      label: 'Accent colour', shipped: S.theme.seedDefault,
      options: null, /* free colour entry, not a fixed list */
      get: function () { return S.theme.seed() || S.theme.seedDefault; },
      set: function (v) { S.theme.setSeed(v); }
    });
    register('theme.font', {
      label: 'Interface font', shipped: 'system',
      /* Measured, not guessed — matches theme.fonts()'s own honesty about
         which families this machine actually has. "custom" is left out of
         the option list here because scheduling it needs a second stored
         value (the family string) that a one-value rule cannot carry yet. */
      options: function () {
        return S.theme.fonts().map(function (f) {
          return { value: f.id, label: f.label + (f.available ? '' : ' (not on this computer)') };
        });
      },
      get: function () { return S.theme.font(); },
      set: function (v) { if (v !== 'custom') S.theme.setFont(v); }
    });
    register('theme.fontScale', {
      label: 'Text size', shipped: 1,
      options: null,
      get: function () { return S.theme.fontScale(); },
      set: function (v) { S.theme.setFontScale(v); },
      coerce: function (v) { var n = parseFloat(v); return isFinite(n) ? n : 1; }
    });
    register('theme.fontWeight', {
      label: 'Heavier labels', shipped: 'normal',
      options: [{ value: 'normal', label: 'Normal' }, { value: 'bold', label: 'Heavier' }],
      get: function () { return S.theme.fontWeight(); },
      set: function (v) { S.theme.setFontWeight(v); }
    });
  }

  /* ------------------------------------------------------------------
   * 4. Evaluate: apply every current winner, and hand back every setting
   *    whose window just closed to the value it held before the window
   *    opened — never silently promoting a scheduled override into the
   *    permanent base.
   * ------------------------------------------------------------------ */
  function evaluate() {
    if (!window.Studio) return {};
    var now = new Date();
    var doc = readDoc();
    var winners = winnersAt(doc, now, isRegistered);
    var base = readBase();
    var changed = false;
    var began = [];
    var ended = [];

    REGISTRY_ORDER.forEach(function (key) {
      var def = REGISTRY[key];
      var win = winners[key];
      if (win) {
        if (!Object.prototype.hasOwnProperty.call(base, key)) {
          base[key] = safeGet(def);
          changed = true;
          began.push(key);
        }
        var target = def.coerce ? def.coerce(win.rule.value) : win.rule.value;
        if (safeGet(def) !== target) safeSet(def, target);
      } else if (Object.prototype.hasOwnProperty.call(base, key)) {
        var was = base[key];
        delete base[key];
        changed = true;
        ended.push(key);
        var store = studioStore();
        if (was === null || was === undefined) {
          if (store) store.remove(key);
          if (typeof def.shipped !== 'undefined') safeSet(def, def.shipped);
        } else {
          safeSet(def, was);
        }
      }
    });

    if (changed) {
      writeBase(base);
      if (window.Studio.history && (began.length || ended.length)) {
        var parts = [];
        if (began.length) parts.push(began.length + ' setting' + (began.length === 1 ? '' : 's') + ' taken by a schedule rule');
        if (ended.length) parts.push(ended.length + ' setting' + (ended.length === 1 ? '' : 's') + ' released back to what it was');
        window.Studio.history.record('schedule', 'Scheduled settings: ' + parts.join('; ') + '.', { began: began, ended: ended });
      }
    }
    return winners;
  }

  /* ------------------------------------------------------------------
   * 5. Keep it live: on boot, on a bounded interval, when the tab becomes
   *    visible or focused again, and whenever the rules or the held-base
   *    map change — in this tab (Studio.store.onChange) or in another
   *    tab of this same browser (the "storage" event, which only fires
   *    for writes made elsewhere).
   * ------------------------------------------------------------------ */
  var tickHandle = null;

  function startTicking() {
    if (tickHandle !== null) return;
    tickHandle = window.setInterval(evaluate, TICK_MS);
  }
  function stopTicking() {
    if (tickHandle === null) return;
    window.clearInterval(tickHandle);
    tickHandle = null;
  }

  function bindLiveness(S) {
    if (document.addEventListener) {
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') evaluate();
      });
    }
    if (window.addEventListener) {
      window.addEventListener('focus', function () { evaluate(); });
      window.addEventListener('storage', function (e) {
        if (!e || !e.key) return;
        var prefix = (S.privacy && S.privacy.storagePrefix) || 'wds.';
        if (e.key === prefix + STORE_RULES || e.key === prefix + STORE_BASE) evaluate();
      });
    }
    if (S.store && typeof S.store.onChange === 'function') {
      S.store.onChange(function (key) {
        if (key === STORE_RULES || key === STORE_BASE) evaluate();
      });
    }
  }

  function boot(S) {
    bootRegistry(S);
    evaluate();
    startTicking();
    bindLiveness(S);
    if (!S.scheduler) S.scheduler = window.StudioSchedule;
  }

  /* ------------------------------------------------------------------
   * 6. Small builders a future rule editor can use without duplicating
   *    the id-generation and default-shape logic.
   * ------------------------------------------------------------------ */
  function newRuleId() {
    return 'rule-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e6).toString(36);
  }

  function emptyRule(settingId) {
    var id = (settingId && isRegistered(settingId)) ? settingId : (REGISTRY_ORDER[0] || null);
    var def = id ? REGISTRY[id] : null;
    var opts = resolveOptions(def);
    return {
      id: newRuleId(), label: 'New rule', enabled: false, priority: 1,
      setting: id, value: opts && opts.length ? opts[0].value : (def ? def.shipped : null),
      source: 'local', startDate: '', endDate: '', startTime: '', endTime: '', days: 'every'
    };
  }

  function weekdayLabels() {
    var fmt = null;
    try { fmt = new Intl.DateTimeFormat(undefined, { weekday: 'long' }); } catch (e) { fmt = null; }
    var out = [];
    for (var i = 0; i < 7; i++) {
      var d = new Date(2024, 0, 7 + i); /* 7 January 2024 is a Sunday, in every time zone that matters here. */
      out.push({ id: WEEKDAY_IDS[i], label: fmt ? fmt.format(d) : WEEKDAY_IDS[i] });
    }
    return out;
  }

  function timezoneInfo() {
    var zone = 'unknown';
    try { zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown'; } catch (e) { zone = 'unknown'; }
    var observesDST = false;
    try {
      var year = new Date().getFullYear();
      var jan = new Date(year, 0, 1).getTimezoneOffset();
      var jul = new Date(year, 6, 1).getTimezoneOffset();
      observesDST = jan !== jul;
    } catch (e) { observesDST = false; }
    return { zone: zone, observesDST: observesDST };
  }

  /* ------------------------------------------------------------------
   * 7. Public surface.
   * ------------------------------------------------------------------ */
  window.StudioSchedule = {
    schemaVersion: SCHEMA_VERSION,
    storageKeys: { rules: STORE_RULES, base: STORE_BASE },
    tickMs: TICK_MS,
    weekdayIds: WEEKDAY_IDS.slice(),
    weekdays: weekdayLabels,
    timezone: timezoneInfo,
    windowSemantics: WINDOW_SEMANTICS.slice(),
    toMinutes: toMinutes,

    read: readDoc,
    write: function (doc) { var ok = writeDoc(doc); if (ok) evaluate(); return ok; },

    match: ruleMatches,
    winners: function (now) { return winnersAt(readDoc(), now || new Date(), isRegistered); },
    evaluate: evaluate,

    settings: {
      register: register,
      isRegistered: isRegistered,
      list: function () {
        return REGISTRY_ORDER.map(function (id) {
          var def = REGISTRY[id];
          return { id: id, label: def.label, shipped: def.shipped, options: resolveOptions(def) };
        });
      },
      get: function (id) { return REGISTRY[id] || null; }
    },

    migrations: { register: registerMigration, table: MIGRATIONS },

    newRuleId: newRuleId,
    emptyRule: emptyRule,

    /* Exposed so a page can start/stop the live tick deliberately — e.g. a
       test harness that wants exactly one evaluate() and no timer. Booting
       normally calls both; most callers never need these directly. */
    _startTicking: startTicking,
    _stopTicking: stopTicking,
    _evaluateOnce: evaluate
  };

  if (window.Studio && typeof window.Studio.ready === 'function') {
    window.Studio.ready(boot);
  } else {
    /* Studio.js loads before this file on every page that has both, per
       SITE_API.md's fixed load order, so this branch is only a safety net
       for a page that loads schedule.js on its own. */
    var tries = 0;
    var poll = window.setInterval(function () {
      tries++;
      if (window.Studio && typeof window.Studio.ready === 'function') {
        window.clearInterval(poll);
        window.Studio.ready(boot);
      } else if (tries > 400) { /* ~10 s at 25 ms */
        window.clearInterval(poll);
        if (window.console && console.error) {
          console.error('[StudioSchedule] The Studio runtime never appeared on this page. ' +
            'Scheduled settings cannot run here without it — load assets/site.js first.');
        }
      }
    }, 25);
  }
}());

/*
 * Hook needed (not yet wired in, by design — see the note at the top of
 * this file and the README explaining why):
 *
 *   <script defer src="assets/site.js"></script>
 *   <script defer src="assets/schedule.js"></script>   <-- add this line, after site.js,
 *                                                            to index.html, docs.html,
 *                                                            changelog.html and settings.html
 *
 * That one line is what turns this from "an engine that is correct" into
 * "a schedule that is actually live everywhere". settings.html additionally
 * has its own local, working copy of this exact algorithm inside its inline
 * <script> block (search that file for "Scheduled settings"); the two read
 * and write the identical storage keys and schema version, so nothing here
 * conflicts with it. A follow-up task can safely delete settings.html's
 * private schedRead/schedWrite/schedEvaluate/SCHED_SETTINGS and call
 * Studio.scheduler.read() / .write() / .evaluate() / .settings.list()
 * instead, which would also be what adds "Interface font", "Text size" and
 * "Heavier labels" to the rule editor's Setting picker, since those three
 * are registered here and are not in settings.html's own private list.
 */
