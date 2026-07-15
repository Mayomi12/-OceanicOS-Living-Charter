/*
 * Ω∞ OceanicOS :: Learning
 * Build 0030 · Stage 4 (Intelligence) · zero-runtime (plain browser or any JS engine)
 *
 * The doctrine's loop ends "…Record. Release. Learn. Repeat." Learning is that
 * step made a capability. Because the ocean never erases — every rejection,
 * reversal, and revision is still on the record — the system can look back at its
 * OWN history and draw durable lessons from it:
 *
 *  - LESSONS: the moments understanding changed — a decision that was reversed, an
 *    observation that was rejected on examination, knowledge that was revised.
 *  - SOURCE RELIABILITY: learned from evidence, not assumed. Every observation
 *    carries a source; over time some sources prove out (verified) and some do
 *    not (rejected). The Learner scores each source verified / (verified+rejected)
 *    so the system can weigh where its reality comes from.
 *
 * It is pure — it reads the timeline and computes; it writes nothing. What the
 * system DOES with a lesson (trust a source less, revisit a pattern) stays a
 * human or agent act through the engines.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.OceanicCore = root.OceanicCore || {}, root.OceanicCore.createLearner = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function createLearner(options) {
    options = options || {};
    var os = options.oceanic;
    if (!os || !os.reality || !os.decisions || !os.knowledge || !os.memory) {
      throw new TypeError("createLearner requires an assembled OceanicOS: createLearner({ oceanic })");
    }
    var UNATTRIBUTED = "(unattributed)";

    // reliability learned from the current status of each source's observations
    function sources() {
      var by = {};
      os.reality.observations(false).forEach(function (o) {
        var s = o.source || UNATTRIBUTED;
        var r = by[s] || (by[s] = { source: s, observations: 0, verified: 0, rejected: 0, pending: 0, archived: 0 });
        r.observations += 1;
        r[o.meta.status] += 1;
      });
      return Object.keys(by).map(function (s) {
        var r = by[s];
        var verdicts = r.verified + r.rejected;
        r.reliability = verdicts ? r.verified / verdicts : null; // null = no verdict yet
        return r;
      }).sort(function (a, b) {
        // least reliable (with a verdict) first, then most-observed
        var ar = a.reliability == null ? 2 : a.reliability;
        var br = b.reliability == null ? 2 : b.reliability;
        if (ar !== br) return ar - br;
        return b.observations - a.observations;
      });
    }

    function unreliableSources(threshold, minSamples) {
      threshold = (typeof threshold === "number") ? threshold : 0.5;
      minSamples = (typeof minSamples === "number") ? minSamples : 2;
      return sources().filter(function (r) {
        return r.reliability != null && (r.verified + r.rejected) >= minSamples && r.reliability < threshold;
      });
    }

    // lessons mined from the history of change
    function lessons() {
      var out = [];
      os.decisions.byStatus("reversed").forEach(function (d) {
        out.push({ kind: "reversal", id: d.meta.did, title: d.body,
          detail: "a committed decision was later reversed" + (d.meta.note ? " — " + d.meta.note : ""), at: d.at });
      });
      os.reality.byStatus("rejected").forEach(function (o) {
        out.push({ kind: "rejection", id: o.meta.oid, title: o.body, source: o.source || null,
          detail: "an observation was rejected on examination" + (o.meta.note ? " — " + o.meta.note : ""), at: o.at });
      });
      // revisions: knowledge that exists in more than one version across the timeline
      var versions = {};
      os.memory.timeline().forEach(function (r) {
        if (r.type === "knowledge" && r.meta && r.meta.kid) versions[r.meta.kid] = (versions[r.meta.kid] || 0) + 1;
      });
      os.knowledge.knowledge(false).forEach(function (k) {
        var n = versions[k.meta.kid] || 1;
        if (n > 1) out.push({ kind: "revision", id: k.meta.kid, title: k.body,
          detail: "understanding was revised " + (n - 1) + " time" + (n - 1 === 1 ? "" : "s"), at: k.at });
      });
      out.sort(function (a, b) { return (b.at || 0) - (a.at || 0); }); // most recent lesson first
      return out;
    }

    function summary() {
      var ls = lessons();
      var byKind = { reversal: 0, rejection: 0, revision: 0 };
      ls.forEach(function (l) { byKind[l.kind] += 1; });
      var srcs = sources();
      var scored = srcs.filter(function (s) { return s.reliability != null; });
      var avg = scored.length ? scored.reduce(function (n, s) { return n + s.reliability; }, 0) / scored.length : null;
      return { lessons: ls.length, byKind: byKind, sources: srcs.length, avgReliability: avg, unreliableSources: unreliableSources().length };
    }

    return { sources: sources, unreliableSources: unreliableSources, lessons: lessons, summary: summary };
  }

  return createLearner;
});
