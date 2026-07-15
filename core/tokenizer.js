/*
 * Ω∞ OceanicOS :: Tokenizer
 * Build 0068 · Stage 7 (Ecosystem) · zero-runtime (plain browser or any JS engine)
 *
 * ROOT: Andrej Karpathy's minbpe (github.com/karpathy/minbpe) — the minimal,
 * readable byte-pair-encoding tokenizer. This is its BasicTokenizer algorithm,
 * ported faithfully to house style: no dependencies (TextEncoder/TextDecoder
 * are built into every browser and Node), injectable nothing, deterministic
 * everything.
 *
 * BPE in three sentences: text becomes UTF-8 bytes (tokens 0–255). Training
 * repeatedly finds the most frequent ADJACENT PAIR of tokens and mints a new
 * token (256, 257, …) for it, recording each merge. Encoding replays those
 * merges greedily (earliest-learned first); decoding concatenates each
 * token's bytes back and reads them as UTF-8 — so any Unicode round-trips
 * exactly.
 *
 *   train(text, vocabSize)  → learn vocabSize−256 merges from a corpus
 *   encode(text) → ids      · decode(ids) → text      (decode∘encode ≡ identity)
 *   merges() · tokenOf(id) · vocabSize() · stats(text)
 *   snapshot() / createTokenizer.load(json)  — a trained tokenizer travels as JSON
 *
 * THE STATED LIMIT (house honesty): this is minbpe's *Basic* variant — no
 * regex pre-splitting (GPT-style), no special tokens. It is byte-safe on any
 * input; it is a teaching-grade and tooling-grade tokenizer, not a claim of
 * parity with any production model's.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.OceanicCore = root.OceanicCore || {}, root.OceanicCore.createTokenizer = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var enc = new TextEncoder();
  var dec = new TextDecoder("utf-8");

  // count adjacent pairs; remember first-seen order so ties break deterministically
  function pairStats(ids) {
    var counts = {}, order = [], seen = {};
    for (var i = 0; i < ids.length - 1; i++) {
      var k = ids[i] + "," + ids[i + 1];
      counts[k] = (counts[k] || 0) + 1;
      if (!seen[k]) { seen[k] = 1; order.push(k); }
    }
    return { counts: counts, order: order };
  }
  function mergePair(ids, a, b, idx) {
    var out = [];
    for (var i = 0; i < ids.length; i++) {
      if (i < ids.length - 1 && ids[i] === a && ids[i + 1] === b) { out.push(idx); i++; }
      else out.push(ids[i]);
    }
    return out;
  }

  function createTokenizer() {
    var merges = [];      // [{ a, b, id }] in learned order — the rank IS the index
    var rank = {};        // "a,b" -> index into merges
    var vocab = {};       // id -> array of byte values; 0..255 seeded lazily
    function bytesOf(id) {
      if (id < 256) return [id];
      if (!vocab[id]) throw new Error("unknown token id " + id + " — this tokenizer never learned it (vocab tops out at " + (255 + merges.length) + ")");
      return vocab[id];
    }

    function train(text, vocabSize) {
      if (typeof text !== "string" || !text) throw new TypeError("train requires a non-empty text corpus");
      if (typeof vocabSize !== "number" || vocabSize % 1 !== 0 || vocabSize < 256) {
        throw new TypeError("vocabSize must be an integer >= 256 (the first 256 tokens are the bytes themselves)");
      }
      if (merges.length) throw new Error("this tokenizer is already trained — create a fresh one (a vocabulary is not silently rewritten)");
      var ids = Array.from(enc.encode(text));
      var numMerges = vocabSize - 256;
      for (var m = 0; m < numMerges; m++) {
        if (ids.length < 2) break; // nothing left to merge — the corpus was smaller than the ambition
        var s = pairStats(ids);
        var bestKey = null, bestCount = 0;
        for (var o = 0; o < s.order.length; o++) {          // first-seen order breaks ties
          if (s.counts[s.order[o]] > bestCount) { bestCount = s.counts[s.order[o]]; bestKey = s.order[o]; }
        }
        if (bestCount < 2) break; // a pair seen once compresses nothing
        var ab = bestKey.split(",");
        var a = parseInt(ab[0], 10), b = parseInt(ab[1], 10);
        var id = 256 + merges.length;
        ids = mergePair(ids, a, b, id);
        rank[bestKey] = merges.length;
        merges.push({ a: a, b: b, id: id });
        vocab[id] = bytesOf(a).concat(bytesOf(b));
      }
      return { learned: merges.length, requested: numMerges, vocabSize: 256 + merges.length };
    }

    function encode(text) {
      if (typeof text !== "string") throw new TypeError("encode requires a string");
      var ids = Array.from(enc.encode(text));
      while (ids.length >= 2) {
        // find the present pair with the LOWEST rank — earliest-learned merges first (minbpe's law)
        var best = null, bestRank = Infinity;
        for (var i = 0; i < ids.length - 1; i++) {
          var r = rank[ids[i] + "," + ids[i + 1]];
          if (r !== undefined && r < bestRank) { bestRank = r; best = merges[r]; }
        }
        if (!best) break;
        ids = mergePair(ids, best.a, best.b, best.id);
      }
      return ids;
    }

    function decode(ids) {
      if (!Array.isArray(ids)) throw new TypeError("decode requires an array of token ids");
      var bytes = [];
      ids.forEach(function (id) { bytes = bytes.concat(bytesOf(id)); });
      return dec.decode(new Uint8Array(bytes));
    }

    function mergesOf() { return merges.map(function (m) { return { pair: [m.a, m.b], id: m.id }; }); }
    function vocabSize() { return 256 + merges.length; }
    function tokenOf(id) {
      var bytes = bytesOf(id);
      return { id: id, bytes: bytes.slice(),
               text: dec.decode(new Uint8Array(bytes)) }; // lone surrogate halves render as U+FFFD — honest, not hidden
    }
    function stats(text) {
      var bytes = enc.encode(text).length;
      var tokens = encode(text).length;
      return { chars: Array.from(text).length, bytes: bytes, tokens: tokens,
               ratio: tokens ? Math.round((bytes / tokens) * 100) / 100 : 1 };
    }

    function snapshot() {
      return JSON.stringify({ oceanicTokenizer: 1, algorithm: "minbpe/basic",
        merges: merges.map(function (m) { return [m.a, m.b, m.id]; }) });
    }

    return { train: train, encode: encode, decode: decode,
             merges: mergesOf, vocabSize: vocabSize, tokenOf: tokenOf, stats: stats, snapshot: snapshot,
             _restore: function (list) { // internal seam for load()
               list.forEach(function (t) {
                 var a = t[0], b = t[1], id = t[2];
                 if (id !== 256 + merges.length) throw new Error("corrupt snapshot — merge ids must be dense from 256");
                 rank[a + "," + b] = merges.length;
                 merges.push({ a: a, b: b, id: id });
                 vocab[id] = bytesOf(a).concat(bytesOf(b));
               });
             } };
  }

  createTokenizer.load = function (json) {
    var snap;
    try { snap = JSON.parse(json); } catch (e) { throw new TypeError("load: not a tokenizer snapshot (bad JSON)"); }
    if (!snap || snap.oceanicTokenizer !== 1 || !Array.isArray(snap.merges)) {
      throw new TypeError("load: not an OceanicOS tokenizer snapshot");
    }
    var t = createTokenizer();
    t._restore(snap.merges);
    return t;
  };

  return createTokenizer;
});
