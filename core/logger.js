/*
 * Ω∞ OceanicOS Core :: Logger
 * Build 0014 · Stage 2 (Builder) · zero-runtime (plain browser or any JS engine)
 *
 * Every build leaves evidence — but not every event is knowledge. The Memory
 * Ocean (0005) holds what the system KNOWS (observations, decisions, knowledge);
 * the Logger holds what the system DID: an operational record of the running
 * system's own behaviour, at levels, bounded, and observable in real time.
 *
 * Deliberately NOT Memory: a log is high-volume and operational, so it lives in
 * a bounded ring buffer (oldest entries age out past historyLimit, and that
 * limit is visible in status) rather than the unbounded, permanent ocean. What
 * matters for the record of truth goes to Memory; what matters for watching the
 * machine goes here.
 *
 * House style of heartbeat.js / verify-engine.js:
 *  - No dependencies. Injectable clock for deterministic tests.
 *  - Levels are ordered (debug < info < warn < error); minLevel filters.
 *  - Subscribers are notified live; a throwing subscriber NEVER breaks logging.
 *  - Emitted entries are deep-frozen — the operational record is not mutated
 *    after the fact.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.OceanicCore = root.OceanicCore || {}, root.OceanicCore.createLogger = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var LEVELS = ["debug", "info", "warn", "error"];
  function rank(level) { return LEVELS.indexOf(level); }

  function deepFreeze(obj) {
    if (obj && typeof obj === "object" && !Object.isFrozen(obj)) {
      Object.freeze(obj);
      Object.keys(obj).forEach(function (k) { deepFreeze(obj[k]); });
    }
    return obj;
  }

  function createLogger(options) {
    options = options || {};
    var now = options.now || function () { return Date.now(); };
    var historyLimit = options.historyLimit || 200;
    var minLevel = options.minLevel || "info";
    if (rank(minLevel) < 0) throw new TypeError("minLevel must be one of: " + LEVELS.join(", "));
    var name = options.name || "log";

    var seq = 0;                 // total accepted (emitted) entries, ever
    var filtered = 0;            // entries dropped for being below minLevel
    var counts = { debug: 0, info: 0, warn: 0, error: 0 };
    var history = [];            // bounded ring buffer
    var listeners = [];

    function log(level, message, meta) {
      if (rank(level) < 0) throw new TypeError("unknown level: " + level + " (use " + LEVELS.join(", ") + ")");
      if (typeof message !== "string" || !message) throw new TypeError("log requires a non-empty string message");
      if (rank(level) < rank(minLevel)) { filtered += 1; return null; } // below threshold — counted, not kept
      seq += 1;
      counts[level] += 1;
      var entry = deepFreeze({ seq: seq, at: now(), level: level, message: message, meta: meta || null });
      history.push(entry);
      if (history.length > historyLimit) history.shift();
      for (var i = 0; i < listeners.length; i++) {
        try { listeners[i](entry); } catch (e) { /* a failing subscriber never breaks logging */ }
      }
      return entry;
    }

    function onLog(fn) {
      if (typeof fn !== "function") throw new TypeError("onLog requires a function");
      listeners.push(fn);
      return function unsubscribe() {
        var i = listeners.indexOf(fn);
        if (i >= 0) listeners.splice(i, 1);
      };
    }

    function setMinLevel(level) {
      if (rank(level) < 0) throw new TypeError("minLevel must be one of: " + LEVELS.join(", "));
      minLevel = level;
      return minLevel;
    }

    function history_() { return history.slice(); }
    function recent(n) { n = n || 20; return history.slice(Math.max(0, history.length - n)); }
    function byLevel(level) {
      if (rank(level) < 0) throw new TypeError("unknown level: " + level);
      return history.filter(function (e) { return e.level === level; });
    }

    function status() {
      return {
        name: name,
        emitted: seq,
        filtered: filtered,
        retained: history.length,
        historyLimit: historyLimit,
        minLevel: minLevel,
        listeners: listeners.length,
        counts: { debug: counts.debug, info: counts.info, warn: counts.warn, error: counts.error }
      };
    }

    return {
      log: log,
      debug: function (m, meta) { return log("debug", m, meta); },
      info:  function (m, meta) { return log("info", m, meta); },
      warn:  function (m, meta) { return log("warn", m, meta); },
      error: function (m, meta) { return log("error", m, meta); },
      onLog: onLog, setMinLevel: setMinLevel,
      history: history_, recent: recent, byLevel: byLevel, status: status
    };
  }

  createLogger.LEVELS = LEVELS.slice();
  return createLogger;
});
