/*
 * Ω∞ OceanicOS :: Retrospect (as-of time lens)
 * Build 0076 · Stage 8 (Stewardship) · zero-runtime (plain browser or any JS engine)
 *
 * Provenance (0075) reads a record's lineage in SPACE — what it corrected and
 * what corrected it. Retrospect reads the ocean in TIME: because Memory (0005)
 * is append-only and every record carries its `at` timestamp, the ocean does
 * not only remember every record — it remembers every STATE it ever held. This
 * lens recovers those states.
 *
 * A record was "current as of t" when it already existed by t (at ≤ t) and had
 * not yet been superseded by t (its successor, if any, was appended after t).
 * From that one rule the whole history of the present view falls out.
 *
 * It is a PURE READER. It composes over Memory (`get` + `timeline`), writes
 * nothing, and invents nothing — every judgement is a timestamp comparison over
 * records already in the ocean.
 *
 *   createRetrospect({ memory })
 *   asOf(t)                  → the records that were current as of time t
 *   stateOf(id, t)           → what id's lineage read as of t (or null if not yet begun)
 *   changesBetween(t1, t2)   → records appended in (t1, t2] — each a new current view
 *   span()                   → { first, last, count } — the ocean's time extent
 *
 * Boundary convention, stated plainly: `asOf` and `stateOf` are INCLUSIVE of t
 * (at ≤ t); `changesBetween` is (t1, t2] — exclusive of t1, inclusive of t2 —
 * so back-to-back windows tile without overlap. When two records share a
 * timestamp, append order (Memory's own order) breaks the tie, deterministically.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.OceanicCore = root.OceanicCore || {}, root.OceanicCore.createRetrospect = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function createRetrospect(options) {
    options = options || {};
    var memory = options.memory;
    if (!memory || typeof memory.get !== "function" || typeof memory.timeline !== "function") {
      throw new TypeError("createRetrospect needs { memory } — a Memory (build 0005) with get() and timeline()");
    }
    function num(t, who) {
      if (typeof t !== "number" || t !== t) throw new TypeError(who + " requires a numeric timestamp");
      return t;
    }
    // old id -> the record that superseded it (1:1 by Memory's rule)
    function successorMap() {
      var map = {};
      memory.timeline().forEach(function (r) { if (r && r.supersedes) map[r.supersedes] = r; });
      return map;
    }

    function asOf(t) {
      num(t, "asOf");
      var succ = successorMap();
      return memory.timeline().filter(function (r) {
        if (r.at > t) return false;                 // did not exist yet
        var s = succ[r.id];                          // its successor, if any
        if (s && s.at <= t) return false;            // already superseded by t
        return true;                                 // existed, and still current at t
      });
    }

    function stateOf(id, t) {
      num(t, "stateOf");
      var r = memory.get(id);
      if (!r) return null;
      // walk to the origin of this lineage
      var origin = r, guard = {};
      while (origin.supersedes && memory.get(origin.supersedes) && !guard[origin.supersedes]) {
        guard[origin.supersedes] = 1;
        origin = memory.get(origin.supersedes);
      }
      if (origin.at > t) return null;                // the story had not begun as of t
      // walk forward to the latest version whose append was at or before t
      var succ = successorMap(), cur = origin, seen = {};
      while (succ[cur.id] && succ[cur.id].at <= t && !seen[succ[cur.id].id]) {
        seen[succ[cur.id].id] = 1;
        cur = succ[cur.id];
      }
      return cur;
    }

    function changesBetween(t1, t2) {
      num(t1, "changesBetween"); num(t2, "changesBetween");
      if (t2 < t1) { var tmp = t1; t1 = t2; t2 = tmp; }   // tolerate a reversed window
      return memory.timeline().filter(function (r) { return r.at > t1 && r.at <= t2; });
    }

    function span() {
      var all = memory.timeline();
      if (!all.length) return { first: null, last: null, count: 0 };
      var first = all[0].at, last = all[0].at;
      for (var i = 1; i < all.length; i++) {
        if (all[i].at < first) first = all[i].at;
        if (all[i].at > last) last = all[i].at;
      }
      return { first: first, last: last, count: all.length };
    }

    return { asOf: asOf, stateOf: stateOf, changesBetween: changesBetween, span: span };
  }

  return createRetrospect;
});
