/*
 * Ω∞ OceanicOS :: Digest (a read-out of the ocean's knowledge)
 * Build 0082 · Stage 8 (Stewardship) · zero-runtime (plain browser or any JS engine)
 *
 * Integrity (0081) asks "is this ocean well-formed?"; Monitor (0047) asks "is
 * the system healthy?". Digest asks a third, quieter question: "what is IN this
 * ocean, and what shape has its knowledge taken?" — the descriptive statistics
 * of the content itself: how many records stand current, how they divide by
 * type and by confidence, how much of what was recorded has since been
 * corrected, and which lineages have been revised the most.
 *
 * It is a PURE READER, and it composes rather than reinvents: lineage counting
 * is delegated to Provenance (0075) — `report()` for the top-line tallies and
 * `trail()` for per-lineage depth — while the distributions are read straight
 * from Memory's timeline (0005). It writes nothing and invents nothing.
 *
 *   createDigest({ memory, provenance })
 *   summary()          → { records, current, superseded, lineages, corrected,
 *                          correctionRate, longest, byType, byConfidence, span }
 *   mostCorrected(n=5) → the deepest lineages: [{ originId, depth, currentId, current }]
 *
 * THE STATED LIMIT (house honesty): these are counts, not judgements. A tidy
 * distribution is not a claim of truth or usefulness — Digest describes the
 * knowledge; it does not evaluate it (that is Evaluation, 0033, and the
 * Reasoner, 0028).
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.OceanicCore = root.OceanicCore || {}, root.OceanicCore.createDigest = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function createDigest(options) {
    options = options || {};
    var memory = options.memory, provenance = options.provenance;
    if (!memory || typeof memory.timeline !== "function") {
      throw new TypeError("createDigest needs { memory } — a Memory (build 0005) with timeline()");
    }
    if (!provenance || typeof provenance.report !== "function" || typeof provenance.trail !== "function") {
      throw new TypeError("createDigest needs { provenance } — a Provenance lens (build 0075)");
    }

    function supersededSet() {
      var s = {};
      memory.timeline().forEach(function (r) { if (r.supersedes) s[r.supersedes] = true; });
      return s;
    }
    // the current records: those nothing supersedes (append-only, so this is exact)
    function currentRecords() {
      var superseded = supersededSet();
      return memory.timeline().filter(function (r) { return !superseded[r.id]; });
    }
    // the lineage origins, in the order they first appear
    function origins() {
      return memory.timeline().filter(function (r) { return !r.supersedes; });
    }
    function tally(list, key) {
      var t = {};
      list.forEach(function (r) { var k = r[key] == null ? "(none)" : String(r[key]); t[k] = (t[k] || 0) + 1; });
      return t;
    }
    function snippet(s) { s = String(s || ""); return s.length > 60 ? s.slice(0, 57) + "…" : s; }

    function summary() {
      var all = memory.timeline();
      var rep = provenance.report();                       // { records, lineages, corrections, longest }
      var current = currentRecords();
      var correctedLineages = origins().filter(function (o) { return provenance.trail(o.id).length > 1; }).length;
      var first = null, last = null;
      all.forEach(function (r) {
        if (first === null || r.at < first) first = r.at;
        if (last === null || r.at > last) last = r.at;
      });
      return {
        records: rep.records,
        current: current.length,
        superseded: rep.records - current.length,
        lineages: rep.lineages,
        corrected: correctedLineages,
        correctionRate: rep.lineages ? Math.round((correctedLineages / rep.lineages) * 100) / 100 : 0,
        longest: rep.longest,
        byType: tally(current, "type"),
        byConfidence: tally(current, "confidence"),
        span: { first: first, last: last }
      };
    }

    function mostCorrected(n) {
      n = (typeof n === "number" && n > 0) ? Math.floor(n) : 5;
      var rows = origins().map(function (o) {
        var t = provenance.trail(o.id);
        var cur = t.chain[t.chain.length - 1];
        return { originId: o.id, depth: t.length, currentId: t.currentId, current: snippet(cur.body) };
      });
      rows.sort(function (a, b) { return b.depth - a.depth; });   // deepest (most-revised) first
      return rows.slice(0, n);
    }

    return { summary: summary, mostCorrected: mostCorrected };
  }

  return createDigest;
});
