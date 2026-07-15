/*
 * Ω∞ OceanicOS :: Simulation
 * Build 0032 · Stage 4 (Intelligence) · zero-runtime (plain browser or any JS engine)
 *
 * What-if, without touching reality. Reasoning (0028) judges what IS; Simulation
 * asks what WOULD be: "if this observation were rejected, what becomes unsound?"
 * It overlays hypothetical observation statuses on top of the current ocean,
 * re-judges everything grounded on them, and reports the DIFF against the
 * baseline — every decision or piece of knowledge that would change soundness.
 *
 * Crucially it mutates NOTHING. The overlay is local to the call; the ocean is
 * never written. That is what makes it safe to explore a rejection or a
 * verification before committing to it for real (through the engines, by a human
 * or an honest agent).
 *
 * The soundness rules are exactly the Reasoner's, applied through a status
 * resolver that consults the overlay first and the real Reality second:
 *   sound (all verified) · provisional (some not verified) · unsound (a rejected
 *   ground) · broken (a missing ground) · ungrounded (no grounds).
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.OceanicCore = root.OceanicCore || {}, root.OceanicCore.createSimulator = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var STATUSES = ["pending", "verified", "rejected", "archived", "missing"];

  function createSimulator(options) {
    options = options || {};
    var os = options.oceanic;
    if (!os || !os.reality || !os.decisions || !os.knowledge) {
      throw new TypeError("createSimulator requires an assembled OceanicOS: createSimulator({ oceanic })");
    }

    function idOf(r) { return (r.meta && (r.meta.did || r.meta.kid)) || r.id; }
    function groundedRecords() { return os.decisions.decisions(false).concat(os.knowledge.knowledge(false)); }

    function realStatus(oid) { var o = os.reality.get(oid); return o ? o.meta.status : "missing"; }

    function soundnessOf(record, statusFn) {
      var grounds = (record.meta && record.meta.grounds) ? record.meta.grounds : [];
      if (!grounds.length) return "ungrounded";
      var statuses = grounds.map(statusFn);
      if (statuses.indexOf("missing") >= 0) return "broken";
      if (statuses.indexOf("rejected") >= 0) return "unsound";
      for (var i = 0; i < statuses.length; i++) if (statuses[i] !== "verified") return "provisional";
      return "sound";
    }

    function assessAll(overlay) {
      var statusFn = function (oid) {
        return (overlay && Object.prototype.hasOwnProperty.call(overlay, oid)) ? overlay[oid] : realStatus(oid);
      };
      var map = {};
      groundedRecords().forEach(function (r) { map[idOf(r)] = { record: r, soundness: soundnessOf(r, statusFn) }; });
      return map;
    }

    function simulate(scenario) {
      scenario = scenario || {};
      var set = scenario.set || {};
      if (typeof set !== "object") throw new TypeError("simulate expects { set: { <observationId>: status } }");
      Object.keys(set).forEach(function (oid) {
        if (STATUSES.indexOf(set[oid]) < 0) throw new TypeError("hypothetical status for " + oid + " must be one of: " + STATUSES.join(", "));
      });

      var baseline = assessAll(null);
      var projected = assessAll(set);

      var changes = [];
      var transitions = {};
      Object.keys(projected).forEach(function (id) {
        var from = baseline[id].soundness, to = projected[id].soundness;
        if (from !== to) {
          var rec = projected[id].record;
          changes.push({ id: id, type: rec.type, title: rec.body, from: from, to: to });
          var key = from + "→" + to;
          transitions[key] = (transitions[key] || 0) + 1;
        }
      });

      var order = { broken: 4, unsound: 3, provisional: 2, ungrounded: 1, sound: 0 };
      changes.sort(function (a, b) { return order[b.to] - order[a.to]; }); // worst outcomes first

      var worsened = changes.filter(function (c) { return order[c.to] > order[c.from]; }).length;
      var improved = changes.filter(function (c) { return order[c.to] < order[c.from]; }).length;
      return {
        set: set,
        changes: changes,
        affected: changes.length,
        worsened: worsened,
        improved: improved,
        safe: worsened === 0,      // nothing gets worse under this hypothetical
        transitions: transitions
      };
    }

    // convenience: what would rejecting this observation do?
    function whatIfReject(oid) { var s = {}; s[oid] = "rejected"; return simulate({ set: s }); }
    // convenience: what would verifying this observation unlock?
    function whatIfVerify(oid) { var s = {}; s[oid] = "verified"; return simulate({ set: s }); }

    return { simulate: simulate, whatIfReject: whatIfReject, whatIfVerify: whatIfVerify };
  }

  createSimulator.STATUSES = STATUSES.slice();
  return createSimulator;
});
