/*
 * Ω∞ OceanicOS :: Search
 * Build 0026 · Stage 4 (Intelligence) · zero-runtime (plain browser or any JS engine)
 *
 * The first act of intelligence: finding. Everything the system knows lives in
 * one Memory Ocean — observations, decisions, knowledge, projects, and the build
 * ledger — but until now you could only recall by exact type or a substring.
 * Search reads across ALL of it at once and ranks by relevance.
 *
 * It reads only CURRENT records (superseded history is not surfaced as a result,
 * though it is never erased), and scores by term frequency with the body
 * weighted above metadata, newest breaking ties. Results are typed and carry the
 * logical id of the thing found (an observation's oid, a decision's did, …) plus
 * a snippet around the first match, so a caller can act on the result through the
 * right engine.
 *
 * createSearch({ oceanic })  — or  createSearch({ memory })
 *   .search(query, { type, status, all, limit }) → ranked results
 *   .facets(query)                               → result counts per type
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.OceanicCore = root.OceanicCore || {}, root.OceanicCore.createSearch = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var BODY_WEIGHT = 3, META_WEIGHT = 1;

  // logical id per record type, so results point at the thing, not the storage row
  function logicalId(r) {
    var m = r.meta || {};
    return m.oid || m.did || m.kid || m.pid || (typeof m.number === "number" ? String(m.number) : null) || r.id;
  }

  // gather every string value from meta (+ source) into one searchable blob
  function metaText(r) {
    var parts = [];
    if (r.source) parts.push(String(r.source));
    var m = r.meta || {};
    Object.keys(m).forEach(function (k) {
      var v = m[k];
      if (typeof v === "string") parts.push(v);
      else if (Array.isArray(v)) v.forEach(function (x) { if (typeof x === "string") parts.push(x); else if (x && typeof x === "object") { if (typeof x.id === "string") parts.push(x.id); if (typeof x.kind === "string") parts.push(x.kind); } });
    });
    return parts.join(" ");
  }

  function countOccurrences(haystack, needle) {
    if (!needle) return 0;
    var n = 0, i = 0;
    while ((i = haystack.indexOf(needle, i)) >= 0) { n++; i += needle.length; }
    return n;
  }

  function snippet(body, token, width) {
    width = width || 80;
    var lc = body.toLowerCase();
    var i = token ? lc.indexOf(token) : -1;
    if (i < 0) return body.length > width ? body.slice(0, width) + "…" : body;
    var start = Math.max(0, i - Math.floor(width / 3));
    var end = Math.min(body.length, start + width);
    return (start > 0 ? "…" : "") + body.slice(start, end) + (end < body.length ? "…" : "");
  }

  function createSearch(options) {
    options = options || {};
    var memory = options.memory || (options.oceanic && options.oceanic.memory);
    if (!memory || typeof memory.recall !== "function") {
      throw new TypeError("createSearch requires an OceanicOS or a Memory: createSearch({ oceanic }) or createSearch({ memory })");
    }

    function currentRecords() { return memory.recall({}); } // all non-superseded records, every type

    function tokenize(query) {
      return String(query == null ? "" : query).toLowerCase().split(/\s+/).filter(function (t) { return !!t; });
    }

    function score(record, tokens) {
      var body = String(record.body || "").toLowerCase();
      var meta = metaText(record).toLowerCase();
      var total = 0, matched = 0;
      for (var i = 0; i < tokens.length; i++) {
        var t = tokens[i];
        var inBody = countOccurrences(body, t);
        var inMeta = countOccurrences(meta, t);
        var s = inBody * BODY_WEIGHT + inMeta * META_WEIGHT;
        if (s > 0) matched++;
        total += s;
      }
      return { total: total, matched: matched };
    }

    function search(query, opts) {
      opts = opts || {};
      var tokens = tokenize(query);
      if (!tokens.length) return [];
      var requireAll = !!opts.all;
      var limit = (typeof opts.limit === "number" && opts.limit > 0) ? opts.limit : 20;

      var out = [];
      currentRecords().forEach(function (r) {
        if (opts.type && r.type !== opts.type) return;
        if (opts.status && (!r.meta || r.meta.status !== opts.status)) return;
        var sc = score(r, tokens);
        if (sc.matched === 0) return;
        if (requireAll && sc.matched < tokens.length) return;
        out.push({
          type: r.type,
          id: logicalId(r),
          title: r.body,
          snippet: snippet(String(r.body || ""), tokens[0]),
          status: (r.meta && r.meta.status) || null,
          score: sc.total,
          matched: sc.matched,
          at: r.at
        });
      });

      out.sort(function (a, b) {
        if (b.score !== a.score) return b.score - a.score;
        if (b.matched !== a.matched) return b.matched - a.matched;
        return (b.at || 0) - (a.at || 0); // newest first on ties
      });
      return out.slice(0, limit);
    }

    function facets(query) {
      var results = search(query, { limit: Infinity });
      var counts = {};
      results.forEach(function (r) { counts[r.type] = (counts[r.type] || 0) + 1; });
      return { total: results.length, byType: counts };
    }

    return { search: search, facets: facets };
  }

  createSearch.logicalId = logicalId;
  return createSearch;
});
