/*
 * Ω∞ OceanicOS :: Mobile
 * Build 0024 · Stage 3 (Applications) · zero-runtime (plain browser or any JS engine)
 *
 * The second screen a PERSON uses. The Harbor (0019) is a desk: dashboard and
 * console, keyboard-driven. Mobile is the phone in your pocket, built around
 * the Charter's Article IV §2 — "Capture is fast and unjudged": one thumb to
 * drop an observation into the ocean, one tap to triage pending reality later.
 *
 * As with the Harbor, the application LOGIC is separated from the screen so it
 * can be verified: createMobile() is a controller / view-model. Every action
 * flows through the API (0017), so the Charter binds this app exactly as it
 * binds a human — it cannot commit on unverified reality, and it never throws.
 *   - capture(text)     → record an observation (born pending), log it, and
 *                         return the fresh home screen.
 *   - inbox()           → the triage queue: pending observations, oldest first.
 *   - triage(id,action) → verify | reject | archive one item, one tap.
 *   - home()            → a plain snapshot for rendering (pulse, ocean, the
 *                         inbox badge, per-engine mini-counts, recent activity).
 *   - tabs()            → the bottom navigation.
 * mobile.html is only the shell that draws these.
 *
 * Dependencies (API/Logger factories) resolve from the OceanicCore namespace
 * the Core scripts populate; pass createMobile({ oceanic, deps }) to inject them.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(root);
  else root.OceanicCore = root.OceanicCore || {}, root.OceanicCore.createMobile = factory(root);
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  var VERSION = "0.24.0";
  var TRIAGE = { verify: "reality.verify", reject: "reality.reject", archive: "reality.archive" };

  function createMobile(options) {
    options = options || {};
    var os = options.oceanic;
    if (!os || typeof os.start !== "function" || !os.status) {
      throw new TypeError("createMobile requires an assembled OceanicOS: createMobile({ oceanic })");
    }
    var D = options.deps || (root && root.OceanicCore) || {};
    function need(fn, what) { if (typeof fn !== "function") throw new Error("createMobile: " + what + " factory is unavailable — load the Core scripts or pass { deps }"); return fn; }

    var logger = options.logger || need(D.createLogger, "logger")({ now: options.now, minLevel: "info" });
    var api    = options.api    || need(D.createAPI, "api")({ oceanic: os });

    var journal = [];
    var booted = false;

    function boot() {
      if (booted) return home();
      var b = os.start();
      booted = true;
      logger.info("mobile online — OceanicOS v" + os.version + " booted on pulse " + b.pulse);
      return home();
    }

    function capture(text) {
      var t = String(text == null ? "" : text).trim();
      if (!t) {
        return { ok: false, error: "nothing to capture — a drop needs words", home: home() };
      }
      var r = api.call("reality.observe", { observation: t, source: "mobile" });
      journal.push({ kind: "capture", text: t, ok: r.ok, id: r.ok ? r.data.id : null });
      if (r.ok) logger.info("drop captured: " + t);
      else logger.warn("capture refused — " + r.error);
      return { ok: r.ok, id: r.ok ? r.data.id : null, error: r.ok ? null : r.error, home: home() };
    }

    function inbox() {
      var r = api.call("reality.list", { status: "pending" });
      return r.ok ? r.data : [];
    }

    function triage(id, action) {
      var op = TRIAGE[action];
      if (!op) {
        return { ok: false, error: "unknown triage action '" + action + "' — use verify | reject | archive", home: home() };
      }
      var r = api.call(op, { id: String(id == null ? "" : id), note: "triaged from mobile" });
      journal.push({ kind: "triage", id: id, action: action, ok: r.ok });
      if (r.ok) logger.info("triage: " + id + " → " + action);
      else logger.warn("triage refused — " + r.error);
      return { ok: r.ok, error: r.ok ? null : r.error, home: home() };
    }

    function shapeLog(e) { return { at: e.at, level: e.level, message: e.message }; }

    function home() {
      var s = os.status();
      return {
        version: VERSION,
        systemVersion: s.version,
        booted: booted,
        pulse: s.pulse,
        ocean: s.memory.count,
        pending: s.reality.pending,
        engines: {
          reality:   { verified: s.reality.verified, pending: s.reality.pending, total: s.reality.total },
          decisions: { decided: s.decisions.decided, open: s.decisions.open, total: s.decisions.total },
          knowledge: { established: s.knowledge.established, topics: s.knowledge.topics, total: s.knowledge.total },
          projects:  { active: s.projects.active, total: s.projects.total }
        },
        activity: logger.recent(5).map(shapeLog)
      };
    }

    function tabs() {
      return [
        { id: "capture", label: "Capture", icon: "💧" },
        { id: "inbox",   label: "Inbox",   icon: "📥" },
        { id: "status",  label: "Status",  icon: "🌊" }
      ];
    }

    function status() {
      return { version: VERSION, booted: booted, entries: journal.length, pending: os.status().reality.pending };
    }

    return {
      version: VERSION,
      boot: boot, capture: capture, inbox: inbox, triage: triage, home: home, tabs: tabs,
      journal: function () { return journal.slice(); },
      status: status,
      oceanic: os, api: api, logger: logger
    };
  }

  createMobile.VERSION = VERSION;
  return createMobile;
});
