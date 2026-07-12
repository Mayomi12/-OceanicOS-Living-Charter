/*
 * Ω∞ OceanicOS :: Search Engine
 * Build 0030 · Stage 4 (Intelligence) · zero-runtime (plain browser or any JS engine)
 *
 * Opens Stage 4. The first act of intelligence is to FIND — to turn a heap of
 * text into something answerable. This is ranked lexical search: an inverted
 * index with BM25 scoring, the same ranking function Lucene/Elasticsearch use,
 * implemented pure and dependency-free.
 *
 * It earns the tokenizers their keep. The analyzer that turns text into search
 * terms is the GPT-style word split from the Regex Tokenizer (build 0026):
 * splitText() cuts on word / punctuation / number boundaries; we lowercase and
 * drop punctuation-only pieces. So "the Deep, blue SEA!" indexes as
 * [the, deep, blue, sea] — the tokenizer, used as real search infrastructure.
 *
 * A search index is OPERATIONAL, not the Memory Ocean: like the Logger (0014),
 * it is a derived structure over documents, so re-indexing and removal are
 * ordinary index maintenance — they change no historical record. (To search the
 * Memory Ocean itself, feed its records in; the records stay append-only there.)
 *
 * BM25: score(D,Q) = Σ IDF(q)·( f(q,D)·(k1+1) ) / ( f(q,D) + k1·(1 − b + b·|D|/avgdl) )
 *       IDF(q) = ln( 1 + (N − n(q) + 0.5) / (n(q) + 0.5) )        k1 = 1.5, b = 0.75
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./regex-tokenizer.js"));
  else root.OceanicCore = root.OceanicCore || {}, root.OceanicCore.createSearchEngine = factory(root.OceanicCore && root.OceanicCore.createRegexTokenizer);
})(typeof self !== "undefined" ? self : this, function (createRegexTokenizer) {
  "use strict";

  function deepFreeze(obj) {
    if (obj && typeof obj === "object" && !Object.isFrozen(obj)) {
      Object.freeze(obj);
      Object.keys(obj).forEach(function (k) { deepFreeze(obj[k]); });
    }
    return obj;
  }

  var WORDISH = /[\p{L}\p{N}]/u;

  function createSearchEngine(options) {
    options = options || {};
    var K1 = options.k1 == null ? 1.5 : options.k1;
    var B = options.b == null ? 0.75 : options.b;

    // default analyzer: the Regex Tokenizer's word split, lowercased, punctuation dropped
    var analyzer = options.analyzer;
    if (!analyzer) {
      if (typeof createRegexTokenizer !== "function") {
        throw new Error("createSearchEngine's default analyzer needs the Regex Tokenizer (build 0026) — load core/regex-tokenizer.js first, or pass { analyzer }");
      }
      var splitter = createRegexTokenizer();
      analyzer = function (text) {
        return splitter.splitText(text)
          .map(function (t) { return t.trim().toLowerCase(); })
          .filter(function (t) { return t.length > 0 && WORDISH.test(t); });
      };
    }

    var docs = {};        // id -> { id, meta, terms:[...], len }
    var inverted = {};    // term -> { df, postings: { id: tf } }
    var N = 0;            // document count
    var totalLen = 0;     // sum of doc lengths (for avgdl)

    function termFreqs(terms) {
      var tf = {};
      for (var i = 0; i < terms.length; i++) tf[terms[i]] = (tf[terms[i]] || 0) + 1;
      return tf;
    }

    function unindex(id) {
      var d = docs[id];
      if (!d) return;
      var tf = termFreqs(d.terms);
      Object.keys(tf).forEach(function (term) {
        var entry = inverted[term];
        if (!entry) return;
        delete entry.postings[id];
        entry.df -= 1;
        if (entry.df <= 0) delete inverted[term];
      });
      N -= 1; totalLen -= d.len;
      delete docs[id];
    }

    function index(id, text, meta) {
      if (id == null || id === "") throw new TypeError("index requires a document id");
      if (typeof text !== "string") throw new TypeError("index requires document text (string)");
      if (docs[id]) unindex(id); // re-index replaces cleanly (operational update)
      var terms = analyzer(text);
      var tf = termFreqs(terms);
      Object.keys(tf).forEach(function (term) {
        var entry = inverted[term] || (inverted[term] = { df: 0, postings: {} });
        entry.postings[id] = tf[term];
        entry.df += 1;
      });
      docs[id] = { id: id, meta: meta == null ? null : meta, terms: terms, len: terms.length };
      N += 1; totalLen += terms.length;
      return deepFreeze({ id: id, terms: terms.length, unique: Object.keys(tf).length });
    }

    function remove(id) {
      if (!docs[id]) return false;
      unindex(id);
      return true;
    }

    function idf(term) {
      var entry = inverted[term];
      var n = entry ? entry.df : 0;
      return Math.log(1 + (N - n + 0.5) / (n + 0.5));
    }

    function search(query, opts) {
      opts = opts || {};
      var limit = opts.limit == null ? 10 : opts.limit;
      var qterms = analyzer(String(query == null ? "" : query));
      if (qterms.length === 0 || N === 0) return deepFreeze([]);
      var avgdl = totalLen / N;
      var scores = {};       // id -> score
      var matched = {};      // id -> { term: true }
      var seen = {};
      for (var i = 0; i < qterms.length; i++) {
        var term = qterms[i];
        if (seen[term]) continue; // count each query term once for IDF weighting
        seen[term] = true;
        var entry = inverted[term];
        if (!entry) continue;
        var w = idf(term);
        Object.keys(entry.postings).forEach(function (id) {
          var f = entry.postings[id];
          var dl = docs[id].len;
          var denom = f + K1 * (1 - B + B * dl / avgdl);
          scores[id] = (scores[id] || 0) + w * (f * (K1 + 1)) / denom;
          (matched[id] || (matched[id] = {}))[term] = true;
        });
      }
      var ranked = Object.keys(scores).map(function (id) {
        return { id: id, score: +scores[id].toFixed(6), meta: docs[id].meta, matches: Object.keys(matched[id]) };
      });
      // stable, deterministic order: score desc, then id asc
      ranked.sort(function (a, b) { return b.score - a.score || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0); });
      return deepFreeze(ranked.slice(0, limit));
    }

    function get(id) { var d = docs[id]; return d ? deepFreeze({ id: d.id, meta: d.meta, terms: d.len }) : null; }
    function has(id) { return !!docs[id]; }
    function size() { return N; }
    function status() {
      return deepFreeze({ documents: N, terms: Object.keys(inverted).length, avgDocLength: N ? +(totalLen / N).toFixed(3) : 0, k1: K1, b: B });
    }
    function terms() { return Object.keys(inverted).sort(); }

    return {
      index: index, remove: remove, search: search, get: get, has: has,
      size: size, status: status, terms: terms, analyze: function (t) { return analyzer(String(t == null ? "" : t)); }
    };
  }

  return createSearchEngine;
});
