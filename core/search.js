/*
 * Ω∞ OceanicOS :: Search
 * Build 0028 · Stage 4 (Intelligence) · zero-runtime (plain browser or any JS engine)
 *
 * The first Intelligence capability: the Memory Ocean becomes FINDABLE.
 * createSearch() builds an inverted index over every record the engines hold —
 * observations, decisions, knowledge, projects, builds — and answers ranked
 * queries about them.
 *
 * Intelligence under the Charter:
 *   - grounded  → a result is always a real record: id, type, status, and the
 *                 record's own text. Search finds; it never fabricates.
 *   - current   → the ocean is append-only and corrections are open
 *                 amendments, so freshness is decidable: the index rebuilds
 *                 exactly when the ocean's record count changes. A query is
 *                 never answered from a stale index.
 *   - harmless  → searching writes nothing. The ocean is byte-identical
 *                 before and after any query.
 *   - honest    → ranking is stated, not mystical: records matching MORE
 *                 distinct query terms rank first; term frequency breaks ties;
 *                 newer records break the rest. matched terms are reported.
 *
 * Surface: query(text, { type, status, limit }) → ranked results, never
 * throws; suggest(prefix) → indexed terms for completion; index() → force a
 * rebuild; status(). search.html is the screen.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(root);
  else root.OceanicCore = root.OceanicCore || {}, root.OceanicCore.createSearch = factory(root);
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  var VERSION = "0.28.0";

  function tokenize(text) {
    return String(text == null ? "" : text).toLowerCase().split(/[^a-z0-9]+/).filter(function (t) { return t.length > 1; });
  }

  function createSearch(options) {
    options = options || {};
    var os = options.oceanic;
    if (!os || typeof os.start !== "function" || !os.status) {
      throw new TypeError("createSearch requires an assembled OceanicOS: createSearch({ oceanic })");
    }
    var D = options.deps || (root && root.OceanicCore) || {};
    function need(fn, what) { if (typeof fn !== "function") throw new Error("createSearch: " + what + " factory is unavailable — load the Core scripts or pass { deps }"); return fn; }
    var logger = options.logger || need(D.createLogger, "logger")({ now: options.now, minLevel: "info" });

    var docs = [];        // { id, type, status, text, seq, tf: { term: count } }
    var terms = {};       // term → [docIndex]
    var indexedCount = -1; // ocean record count the index was built at
    var booted = false;

    function boot() {
      if (booted) return status();
      var b = os.start();
      booted = true;
      logger.info("search online — OceanicOS v" + os.version + " booted on pulse " + b.pulse);
      return status();
    }

    // gather every record from every engine, in one shape
    function gather() {
      var rows = [];
      function add(list, type, idKey, extra) {
        (list || []).forEach(function (r) {
          var text = r.body + (extra ? " " + extra(r) : "");
          rows.push({ id: r.meta[idKey], type: type, status: r.meta.status || "—", text: r.body, indexText: text });
        });
      }
      add(os.reality.observations(false),  "observation", "oid");
      add(os.decisions.decisions(false),   "decision",    "did", function (r) { return (r.meta.options || []).join(" ") + " " + (r.meta.choice || ""); });
      add(os.knowledge.knowledge(false),   "knowledge",   "kid", function (r) { return (r.meta.topics || []).join(" "); });
      add(os.projects.projects(false),     "project",     "pid");
      (os.builds.history() || []).forEach(function (r) {
        rows.push({ id: "build-" + r.meta.number, type: "build", status: "released", text: r.meta.capability, indexText: r.meta.capability });
      });
      return rows;
    }

    function index() {
      docs = [];
      terms = {};
      gather().forEach(function (row, i) {
        var tf = {};
        tokenize(row.indexText).forEach(function (t) { tf[t] = (tf[t] || 0) + 1; });
        docs.push({ id: row.id, type: row.type, status: row.status, text: row.text, seq: i, tf: tf });
        Object.keys(tf).forEach(function (t) {
          if (!terms[t]) terms[t] = [];
          terms[t].push(i);
        });
      });
      indexedCount = os.status().memory.count;
      logger.info("search indexed " + docs.length + " records, " + Object.keys(terms).length + " terms");
      return { indexed: docs.length, terms: Object.keys(terms).length };
    }

    // freshness is decidable: the append-only ocean's count moves on every
    // record AND every open amendment, so equality proves nothing changed.
    function fresh() { if (os.status().memory.count !== indexedCount) index(); }

    function query(text, opts) {
      opts = opts || {};
      var qTerms = tokenize(text);
      if (!qTerms.length) return { ok: false, error: "nothing to search for — give at least one word", results: [] };
      fresh();
      var scores = {};   // docIndex → { hit: distinctTerms, tf: totalFrequency, matched: [] }
      qTerms.forEach(function (t) {
        (terms[t] || []).forEach(function (i) {
          if (!scores[i]) scores[i] = { hit: 0, tf: 0, matched: [] };
          scores[i].hit += 1;
          scores[i].tf += docs[i].tf[t];
          scores[i].matched.push(t);
        });
      });
      var results = Object.keys(scores).map(function (k) {
        var i = Number(k), d = docs[i], s = scores[k];
        return { id: d.id, type: d.type, status: d.status, text: d.text,
                 score: s.hit * 100 + s.tf, matched: s.matched.slice().sort() };
      });
      if (opts.type)   results = results.filter(function (r) { return r.type === opts.type; });
      if (opts.status) results = results.filter(function (r) { return r.status === opts.status; });
      // rank: distinct terms matched, then term frequency (folded into score), then recency
      var seqOf = {}; docs.forEach(function (d) { seqOf[d.id] = d.seq; });
      results.sort(function (a, b) { return b.score - a.score || seqOf[b.id] - seqOf[a.id]; });
      var limit = opts.limit > 0 ? opts.limit : 20;
      return { ok: true, query: String(text), terms: qTerms, total: results.length, results: results.slice(0, limit) };
    }

    function suggest(prefix) {
      var p = String(prefix == null ? "" : prefix).toLowerCase();
      if (!p) return [];
      fresh();
      return Object.keys(terms).filter(function (t) { return t.indexOf(p) === 0; }).sort();
    }

    function status() {
      return { version: VERSION, booted: booted, indexed: docs.length,
               terms: Object.keys(terms).length, oceanAt: indexedCount };
    }

    return {
      version: VERSION,
      boot: boot, index: index, query: query, suggest: suggest, status: status,
      oceanic: os, logger: logger
    };
  }

  createSearch.VERSION = VERSION;
  createSearch.tokenize = tokenize;
  return createSearch;
});
