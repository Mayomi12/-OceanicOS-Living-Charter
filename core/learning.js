/*
 * Ω∞ OceanicOS :: Learning
 * Build 0032 · Stage 4 (Intelligence) · zero-runtime (plain browser or any JS engine)
 *
 * The fifth Intelligence capability: the Charter's own definition of learning
 * made computable. Article IV — "promotion is earned by connection, synthesis,
 * and trust" and "knowledge that stops being maintained flows back for
 * re-examination. Never stagnate." createLearning() watches how knowledge is
 * doing and PROPOSES what to do about it. It writes nothing.
 *
 *   - evidence-weighed → TRUST is a stated formula, not a mystery: each
 *     VERIFIED ground contributes its confidence rank (speculation=1 · low=2 ·
 *     medium=3 · high=4 · certain=5); pending, eroded, and external grounds
 *     contribute 0. Bands with exact boundaries:
 *     untrusted (0) · low (1–2) · growing (3–5) · strong (6+).
 *   - anti-stagnation → staleness is measured in OCEAN GROWTH, not wall
 *     clock — deterministic: each knowledge is fingerprinted (body + status +
 *     grounds); when the fingerprint changes, the engine stamps the current
 *     ocean count; the knowledge is stale once the ocean has grown
 *     `staleAfter` records past the stamp. A revision resets the clock.
 *   - gap-aware → gaps() lists verified observations cited by NOTHING —
 *     evidence collected but never synthesized. Observed, never learned.
 *   - suggesting, never acting → eroded ground → re-examine / consider
 *     deprecating; stale below strong trust → revisit. Proposals only; the
 *     human decides through the engines, which govern.
 *   - current → decidable freshness (house mechanism) · harmless → the ocean
 *     is byte-identical after any call.
 *
 * learning.html is the screen.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(root);
  else root.OceanicCore = root.OceanicCore || {}, root.OceanicCore.createLearning = factory(root);
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  var VERSION = "0.32.0";
  var SCALE = ["speculation", "low", "medium", "high", "certain"];
  var BASIS = "trust = sum over VERIFIED grounds of confidence rank (speculation=1, low=2, medium=3, high=4, certain=5); other grounds weigh 0. Bands: untrusted=0, low=1-2, growing=3-5, strong=6+.";

  function rank(c) { var i = SCALE.indexOf(String(c || "medium")); return i < 0 ? 3 : i + 1; }
  function band(score) {
    if (score <= 0) return "untrusted";
    if (score <= 2) return "low";
    if (score <= 5) return "growing";
    return "strong";
  }

  function createLearning(options) {
    options = options || {};
    var os = options.oceanic;
    if (!os || typeof os.start !== "function" || !os.status) {
      throw new TypeError("createLearning requires an assembled OceanicOS: createLearning({ oceanic })");
    }
    var D = options.deps || (root && root.OceanicCore) || {};
    function need(fn, what) { if (typeof fn !== "function") throw new Error("createLearning: " + what + " factory is unavailable — load the Core scripts or pass { deps }"); return fn; }
    var logger = options.logger || need(D.createLogger, "logger")({ now: options.now, minLevel: "info" });
    var staleAfter = options.staleAfter > 0 ? options.staleAfter : 10;

    var touched = {};        // kid → ocean count when its fingerprint last changed
    var fingerprints = {};   // kid → fingerprint
    var seenAt = -1;
    var booted = false;

    function boot() {
      if (booted) return status();
      var b = os.start();
      booted = true;
      logger.info("learning online — OceanicOS v" + os.version + " booted on pulse " + b.pulse);
      return status();
    }

    function obsIndex() {
      var byId = {};
      os.reality.observations(false).forEach(function (r) { byId[r.meta.oid] = r; });
      return byId;
    }

    function fresh() {
      var count = os.status().memory.count;
      if (count === seenAt) return;
      os.knowledge.knowledge(false).forEach(function (k) {
        var fp = k.body + "|" + k.meta.status + "|" + (k.meta.grounds || []).join(",");
        if (fingerprints[k.meta.kid] !== fp) {
          fingerprints[k.meta.kid] = fp;
          touched[k.meta.kid] = count;
        }
      });
      seenAt = count;
    }

    function trustOf(k, byId) {
      var evidence = [];
      var score = 0;
      (k.meta.grounds || []).forEach(function (g) {
        var o = byId[g];
        var w = (o && o.meta.status === "verified") ? rank(o.confidence) : 0;
        score += w;
        evidence.push({ id: g, known: !!o, status: o ? o.meta.status : "external",
                        confidence: o ? o.confidence : null, weight: w });
      });
      return { score: score, band: band(score), evidence: evidence, basis: BASIS };
    }

    function trust(kid) {
      fresh();
      var found = null;
      os.knowledge.knowledge(false).forEach(function (k) { if (k.meta.kid === kid) found = k; });
      if (!found) return { score: 0, band: "untrusted", evidence: [], basis: BASIS, error: "no knowledge '" + kid + "'" };
      return trustOf(found, obsIndex());
    }

    function rowFor(k, byId, count) {
      var t = trustOf(k, byId);
      var age = count - (touched[k.meta.kid] != null ? touched[k.meta.kid] : count);
      var stale = age >= staleAfter;
      var suggestions = [];
      var eroded = t.evidence.filter(function (e) { return e.known && (e.status === "archived" || e.status === "rejected"); });
      if (eroded.length) {
        suggestions.push("a ground has eroded (" + eroded.map(function (e) { return e.id; }).join(", ") + ") — re-examine; consider deprecating or revising with living evidence");
      }
      if (stale && t.band !== "strong") {
        suggestions.push("stale for " + age + " records with " + t.band + " trust — revisit. Never stagnate (Article IV)");
      }
      return { id: k.meta.kid, statement: k.body, trust: t.score, band: t.band,
               evidence: t.evidence, stale: stale, age: age, suggestions: suggestions };
    }

    function report() {
      fresh();
      var byId = obsIndex();
      var count = os.status().memory.count;
      return os.knowledge.knowledge(false)
        .filter(function (k) { return k.meta.status === "established"; })
        .map(function (k) { return rowFor(k, byId, count); });
    }

    function gaps() {
      fresh();
      var cited = {};
      os.knowledge.knowledge(false).forEach(function (k) { (k.meta.grounds || []).forEach(function (g) { cited[g] = 1; }); });
      os.decisions.decisions(false).forEach(function (d) { (d.meta.grounds || []).forEach(function (g) { cited[g] = 1; }); });
      return os.reality.observations(false)
        .filter(function (r) { return r.meta.status === "verified" && !cited[r.meta.oid]; })
        .map(function (r) { return { id: r.meta.oid, observation: r.body, confidence: r.confidence,
                                     note: "verified evidence cited by nothing — observed, never learned" }; });
    }

    function suggestions() {
      var out = [];
      report().forEach(function (row) {
        row.suggestions.forEach(function (s) { out.push({ id: row.id, statement: row.statement, suggestion: s }); });
      });
      return out;
    }

    function status() {
      var r = booted ? report() : [];
      return { version: VERSION, booted: booted, knowledge: r.length,
               stale: r.filter(function (x) { return x.stale; }).length,
               suggestions: r.reduce(function (n, x) { return n + x.suggestions.length; }, 0),
               staleAfter: staleAfter, oceanAt: seenAt };
    }

    return {
      version: VERSION,
      boot: boot, trust: trust, report: report, gaps: gaps, suggestions: suggestions,
      basis: BASIS, scale: SCALE.slice(), staleAfter: staleAfter,
      status: status,
      oceanic: os, logger: logger
    };
  }

  createLearning.VERSION = VERSION;
  return createLearning;
});
