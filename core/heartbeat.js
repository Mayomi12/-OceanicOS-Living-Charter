/*
 * Ω∞ OceanicOS Core :: Heartbeat
 * Build 0003 · Stage 0 · zero-runtime (plain browser or any JS engine)
 *
 * The Heartbeat is the Core's pulse: a deterministic, observable tick source.
 * Every future engine (Reality, Decision, Verification) subscribes to it.
 *
 * Design constraints:
 *  - No dependencies. No DOM. No timers required (injectable clock + manual beat)
 *    so it is fully testable and simulation-friendly.
 *  - History is append-only within its window — beats are never silently erased,
 *    only aged out past `historyLimit` (and that limit is visible in status).
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.OceanicCore = root.OceanicCore || {}, root.OceanicCore.createHeartbeat = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function createHeartbeat(options) {
    options = options || {};
    var now = options.now || function () { return Date.now(); };
    var intervalMs = options.intervalMs || 1000;
    var historyLimit = options.historyLimit || 100;

    var pulse = 0;
    var born = now();
    var lastBeatAt = null;
    var listeners = [];
    var history = [];
    var timer = null;

    function beat(meta) {
      pulse += 1;
      lastBeatAt = now();
      var event = { pulse: pulse, at: lastBeatAt, meta: meta || null };
      history.push(event);
      if (history.length > historyLimit) history.shift();
      for (var i = 0; i < listeners.length; i++) {
        try { listeners[i](event); } catch (e) { /* a failing listener never stops the heart */ }
      }
      return event;
    }

    function onBeat(fn) {
      if (typeof fn !== "function") throw new TypeError("onBeat requires a function");
      listeners.push(fn);
      return function unsubscribe() {
        var i = listeners.indexOf(fn);
        if (i >= 0) listeners.splice(i, 1);
      };
    }

    function start() {
      if (timer !== null) return false; // already alive — never double-beat
      if (typeof setInterval !== "function") throw new Error("No timer available in this environment; drive beats manually with beat()");
      timer = setInterval(function () { beat({ source: "timer" }); }, intervalMs);
      return true;
    }

    function stop() {
      if (timer === null) return false;
      clearInterval(timer);
      timer = null;
      return true;
    }

    function status() {
      return {
        alive: timer !== null,
        pulse: pulse,
        born: born,
        lastBeatAt: lastBeatAt,
        intervalMs: intervalMs,
        listeners: listeners.length,
        historyLength: history.length,
        historyLimit: historyLimit
      };
    }

    function getHistory() { return history.slice(); }

    return { beat: beat, onBeat: onBeat, start: start, stop: stop, status: status, history: getHistory };
  }

  return createHeartbeat;
});
