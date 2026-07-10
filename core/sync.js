/*
 * Ω∞ OceanicOS :: Synchronization
 * Build 0046 · Stage 6 (Infrastructure) · zero-runtime (plain browser or any JS engine)
 *
 * Two oceans drift apart — a ship's device and the shore station, two teammates
 * offline, two compatible implementations — and must come back together WITHOUT
 * either history being erased. Synchronization is that reunion, built on what
 * Memory (0005) already guarantees: records are immutable, append-only, and
 * carry their own ids, timestamps and supersession links. A merge is therefore
 * a deterministic UNION of timelines — never a rewrite:
 *
 *   diff(a, b)   → what each side has that the other lacks (+ any conflicts)
 *   merge(a, b)  → one deduplicated, time-ordered timeline + a snapshot that a
 *                  fresh Memory can hydrate (Store 0024 is the persistence seam)
 *   conflicts(m) → divergent amendments: two records superseding the same one
 *
 * Conflict doctrine (the Charter's): when both sides amended the same record,
 * NEITHER version is discarded and neither silently wins — both heads survive
 * the merge as current, and the divergence is REPORTED for a human to resolve
 * with a further open amendment. Disagreement is surfaced, never erased.
 *
 * Inputs are flexible: a Memory instance (its exportSnapshot() is used), a
 * snapshot JSON string, or a parsed { records: [...] }. The merge itself is
 * pure — it writes nothing; hydration happens where the caller chooses.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.OceanicCore = root.OceanicCore || {}, root.OceanicCore.createSync = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function createSync() {

    function recordsOf(ocean, name) {
      if (ocean && typeof ocean.exportSnapshot === "function") ocean = ocean.exportSnapshot();
      if (typeof ocean === "string") {
        try { ocean = JSON.parse(ocean); }
        catch (e) { throw new TypeError("sync: " + name + " is not a valid snapshot (bad JSON)"); }
      }
      if (!ocean || !Array.isArray(ocean.records)) {
        throw new TypeError("sync: " + name + " must be a Memory, a snapshot string, or { records: [...] }");
      }
      for (var i = 0; i < ocean.records.length; i++) {
        var r = ocean.records[i];
        if (!r || typeof r.id !== "string" || !r.id) throw new TypeError("sync: " + name + " contains a record without an id");
      }
      return ocean.records;
    }

    // deterministic order: by time, then id — so merge(a,b) and merge(b,a) agree
    function byTime(x, y) {
      if (x.at !== y.at) return (x.at || 0) - (y.at || 0);
      return x.id < y.id ? -1 : x.id > y.id ? 1 : 0;
    }

    function union(a, b) {
      var seen = {}, out = [];
      a.concat(b).forEach(function (r) {
        if (!seen[r.id]) { seen[r.id] = true; out.push(r); }
      });
      out.sort(byTime);
      return out;
    }

    // divergent amendments: two or more records superseding the SAME record
    function findConflicts(records) {
      var heads = {}; // superseded id -> [superseding ids]
      records.forEach(function (r) {
        if (r.supersedes) (heads[r.supersedes] = heads[r.supersedes] || []).push(r.id);
      });
      var out = [];
      Object.keys(heads).forEach(function (oldId) {
        if (heads[oldId].length > 1) out.push({ supersededId: oldId, heads: heads[oldId].slice().sort() });
      });
      return out;
    }

    function diff(a, b) {
      var ra = recordsOf(a, "the first ocean");
      var rb = recordsOf(b, "the second ocean");
      var inA = {}, inB = {};
      ra.forEach(function (r) { inA[r.id] = true; });
      rb.forEach(function (r) { inB[r.id] = true; });
      return {
        onlyA: ra.filter(function (r) { return !inB[r.id]; }),
        onlyB: rb.filter(function (r) { return !inA[r.id]; }),
        shared: ra.filter(function (r) { return inB[r.id]; }).length,
        conflicts: findConflicts(union(ra, rb))
      };
    }

    function merge(a, b) {
      var ra = recordsOf(a, "the first ocean");
      var rb = recordsOf(b, "the second ocean");
      var inA = {}, inB = {};
      ra.forEach(function (r) { inA[r.id] = true; });
      rb.forEach(function (r) { inB[r.id] = true; });
      var records = union(ra, rb);
      return {
        records: records,
        snapshot: JSON.stringify({ v: 1, records: records }), // hydratable by createMemory({ storage })
        added: {
          fromA: records.filter(function (r) { return inA[r.id] && !inB[r.id]; }).length,
          fromB: records.filter(function (r) { return inB[r.id] && !inA[r.id]; }).length
        },
        total: records.length,
        conflicts: findConflicts(records)
      };
    }

    function conflicts(ocean) {
      return findConflicts(recordsOf(ocean, "the ocean"));
    }

    return { diff: diff, merge: merge, conflicts: conflicts };
  }

  return createSync;
});
