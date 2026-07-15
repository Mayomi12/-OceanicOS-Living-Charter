/*
 * Ω∞ OceanicOS :: Provenance (lineage lens)
 * Build 0075 · Stage 8 (Stewardship) · zero-runtime (plain browser or any JS engine)
 *
 * The Charter's third article says history is never silently erased: the Memory
 * Ocean is append-only, and a correction never rewrites a record — it appends a
 * new one declaring `supersedes: <old id>`, leaving the old record standing
 * (Memory, build 0005). That promise lives in the data but has had no lens.
 * Provenance is that lens: for any record it reconstructs the whole lineage —
 * what this record corrected, what corrected it, where the story began, and
 * where it stands now.
 *
 * It is a PURE READER. It composes over Memory (`get` + `timeline`), writes
 * nothing, and invents nothing: every link it reports is a `supersedes` edge
 * already in the ocean. Because Memory forbids superseding an already-superseded
 * record, every lineage is a simple line (no branches) — so the trail is exact.
 *
 *   createProvenance({ memory })
 *   trail(id)     → { exists, record, ancestry, descendants, chain, current,
 *                     currentId, originId, position, length, broken }
 *   chain(id)     → the full lineage, origin → current, as an array of records
 *   currentOf(id) · originOf(id) · isCurrent(id)
 *   explain(id)   → a human-readable telling of the lineage
 *   report()      → { records, lineages, corrections, longest } over the ocean
 *
 * WHAT THIS IS NOT: grounds and soundness — whether a decision rests on a
 * verified observation — are the Reasoner's domain (build 0028), not this one.
 * Provenance answers "how did this record come to be, and is it still current?"
 * — the append-only story — and stops honestly there.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.OceanicCore = root.OceanicCore || {}, root.OceanicCore.createProvenance = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function createProvenance(options) {
    options = options || {};
    var memory = options.memory;
    if (!memory || typeof memory.get !== "function" || typeof memory.timeline !== "function") {
      throw new TypeError("createProvenance needs { memory } — a Memory (build 0005) with get() and timeline()");
    }

    // supersededBy: old id -> the record id that supersedes it (1:1, Memory guarantees it)
    function supersededByMap() {
      var map = {};
      memory.timeline().forEach(function (r) {
        if (r && r.supersedes) map[r.supersedes] = r.id;
      });
      return map;
    }

    // walk backward over `supersedes` edges: the records this one corrected, newest-first
    function ancestryOf(id) {
      var out = [], seen = {}, broken = false;
      var r = memory.get(id);
      while (r && r.supersedes) {
        if (seen[r.supersedes]) break;              // cycle guard (should never happen)
        seen[r.supersedes] = 1;
        var older = memory.get(r.supersedes);
        if (!older) { broken = true; break; }        // a snapshot could reference a missing id — say so, don't pretend
        out.push(older);
        r = older;
      }
      return { list: out, broken: broken };
    }

    // walk forward over the supersededBy map: the records that corrected this one, oldest-first
    function descendantsOf(id, map) {
      map = map || supersededByMap();
      var out = [], seen = {};
      var cur = id;
      while (map[cur]) {
        if (seen[map[cur]]) break;                   // cycle guard
        seen[map[cur]] = 1;
        var next = memory.get(map[cur]);
        if (!next) break;
        out.push(next);
        cur = next.id;
      }
      return out;
    }

    function trail(id) {
      var record = memory.get(id);
      if (!record) return { exists: false, id: id, record: null, ancestry: [], descendants: [],
                            chain: [], current: false, currentId: null, originId: null,
                            position: -1, length: 0, broken: false };
      var map = supersededByMap();
      var anc = ancestryOf(id);                       // newest-first: [parent, grandparent, ...]
      var desc = descendantsOf(id, map);              // oldest-first: [child, grandchild, ...]
      var origin = anc.list.length ? anc.list[anc.list.length - 1] : record;
      var current = desc.length ? desc[desc.length - 1] : record;
      // full lineage, origin → current: reverse of ancestry, then self, then descendants
      var chain = anc.list.slice().reverse().concat([record], desc);
      return {
        exists: true, id: id, record: record,
        ancestry: anc.list, descendants: desc, chain: chain,
        current: desc.length === 0, currentId: current.id, originId: origin.id,
        position: anc.list.length,                    // 0 = origin, 1 = first correction, …
        length: chain.length, broken: anc.broken
      };
    }

    function chain(id) { return trail(id).chain; }
    function currentOf(id) { var t = trail(id); return t.exists ? memory.get(t.currentId) : null; }
    function originOf(id)  { var t = trail(id); return t.exists ? memory.get(t.originId) : null; }
    function isCurrent(id) { var t = trail(id); return t.exists && t.current; }

    function snippet(r) {
      var b = String(r.body || "");
      return b.length > 60 ? b.slice(0, 57) + "…" : b;
    }

    function explain(id) {
      var t = trail(id);
      if (!t.exists) return "No record with id " + id + " is in this ocean.";
      var r = t.record;
      var lines = [];
      lines.push("Record " + r.id + " (" + r.type + "): \"" + snippet(r) + "\"");
      if (t.length === 1 && !r.supersedes) {
        lines.push("A first-of-its-kind record — it corrects nothing and is corrected by nothing. It is current.");
        return lines.join("\n");
      }
      if (t.length > 1) {
        lines.push("It stands at position " + t.position + " of " + t.length + " in an append-only lineage.");
        lines.push("Lineage (origin → current): " + t.chain.map(function (x) { return x.id; }).join(" → "));
      }
      if (t.ancestry.length) lines.push("It corrected " + t.ancestry[0].id + " (\"" + snippet(t.ancestry[0]) + "\").");
      if (t.broken) lines.push("NOTE: an ancestor id (" + r.supersedes + ") referenced by a supersedes edge is not present in this ocean — the chain is reported as far as it resolves.");
      lines.push(t.current
        ? "Nothing supersedes it: this is the current version."
        : "It has since been superseded by " + t.descendants[0].id + "; the current version is " + t.currentId + ".");
      return lines.join("\n");
    }

    function report() {
      var all = memory.timeline();
      var corrections = 0, origins = [];
      all.forEach(function (r) { if (r.supersedes) corrections += 1; else origins.push(r.id); });
      var map = supersededByMap();
      var longest = 0;
      origins.forEach(function (oid) {                // each origin heads exactly one lineage
        var len = 1, cur = oid, seen = {};
        while (map[cur] && !seen[map[cur]]) { seen[map[cur]] = 1; cur = map[cur]; len += 1; }
        if (len > longest) longest = len;
      });
      return { records: all.length, lineages: origins.length, corrections: corrections, longest: longest };
    }

    return { trail: trail, chain: chain, currentOf: currentOf, originOf: originOf,
             isCurrent: isCurrent, explain: explain, report: report };
  }

  return createProvenance;
});
