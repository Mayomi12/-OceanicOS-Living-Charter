/*
 * Ω∞ OceanicOS :: Regex Tokenizer (GPT-style)
 * Build 0073 · Stage 7 (Ecosystem) · zero-runtime (plain browser or any JS engine)
 *
 * ROOT: Andrej Karpathy's minbpe (github.com/karpathy/minbpe) — this is its
 * RegexTokenizer, the sibling of the BasicTokenizer shipped in build 0068.
 *
 * THE ONE DIFFERENCE, and it is the whole point: before any byte-pair merging,
 * the text is first split into chunks by a GPT-style regular expression (the
 * GPT-2 split pattern by default). BPE then runs INSIDE each chunk and never
 * across a chunk boundary. So a merge can never fuse a letter to a digit, a
 * word to its trailing punctuation, or a token to the next word's space —
 * exactly the boundaries GPT-2/GPT-4 tokenizers keep apart. Decoding is
 * unchanged: token bytes are concatenated and read back as UTF-8, so any
 * Unicode still round-trips exactly.
 *
 *   createRegexTokenizer({ pattern? })   // default: minbpe's GPT-2 split pattern
 *   train(text, vocabSize)  → learn vocabSize−256 merges, chunk-respecting
 *   encode(text) → ids      · decode(ids) → text      (decode∘encode ≡ identity)
 *   chunks(text) → the regex split · pattern() → the split source
 *   merges() · tokenOf(id) · vocabSize() · stats(text)
 *   snapshot() / createRegexTokenizer.load(json)  — merges AND pattern travel as JSON
 *
 * For an all-letters single word the split is a no-op and this behaves exactly
 * like the Basic tokenizer — the regex is a pre-split, not a different BPE.
 *
 * THE STATED LIMIT (house honesty): this adds regex pre-splitting but, like
 * build 0068, still has NO special tokens (<|endoftext|> and friends). It is a
 * teaching-grade and tooling-grade tokenizer, honest about what it is, not a
 * claim of byte-for-byte parity with any production model's vocabulary.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.OceanicCore = root.OceanicCore || {}, root.OceanicCore.createRegexTokenizer = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var enc = new TextEncoder();
  var dec = new TextDecoder("utf-8");

  // minbpe's GPT-2 split pattern, expressed for JavaScript's regex engine.
  // \p{L}/\p{N} require the "u" flag (ES2018 Unicode property escapes). This is
  // faithful to minbpe's GPT2_SPLIT_PATTERN — JS lacks possessive quantifiers,
  // so the GPT-4 pattern (which uses ++/?+) can't be ported verbatim; GPT-2's
  // greedy form is the honest, engine-supported default.
  var GPT2_SPLIT = "'(?:[sdmt]|ll|ve|re)| ?\\p{L}+| ?\\p{N}+| ?[^\\s\\p{L}\\p{N}]+|\\s+(?!\\S)|\\s+";

  // count adjacent pairs ACROSS every chunk; remember first-seen order so ties
  // break deterministically (same law as the Basic tokenizer, just chunk-aware)
  function pairStats(chunkList) {
    var counts = {}, order = [], seen = {};
    for (var c = 0; c < chunkList.length; c++) {
      var ids = chunkList[c];
      for (var i = 0; i < ids.length - 1; i++) {
        var k = ids[i] + "," + ids[i + 1];
        counts[k] = (counts[k] || 0) + 1;
        if (!seen[k]) { seen[k] = 1; order.push(k); }
      }
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

  function createRegexTokenizer(opts) {
    opts = opts || {};
    var source = (typeof opts.pattern === "string" && opts.pattern) ? opts.pattern : GPT2_SPLIT;
    var re;
    try { re = new RegExp(source, "gu"); }
    catch (e) { throw new TypeError("pattern is not a valid unicode ('u'-flag) regular expression: " + e.message); }

    var merges = [];      // [{ a, b, id }] in learned order — the rank IS the index
    var rank = {};        // "a,b" -> index into merges
    var vocab = {};       // id -> array of byte values; 0..255 seeded lazily

    function bytesOf(id) {
      if (id < 256) return [id];
      if (!vocab[id]) throw new Error("unknown token id " + id + " — this tokenizer never learned it (vocab tops out at " + (255 + merges.length) + ")");
      return vocab[id];
    }

    // split text into the regex chunks (the pre-split BPE will never cross)
    function chunks(text) {
      if (typeof text !== "string") throw new TypeError("chunks requires a string");
      re.lastIndex = 0;
      return text.match(re) || [];
    }

    function train(text, vocabSize) {
      if (typeof text !== "string" || !text) throw new TypeError("train requires a non-empty text corpus");
      if (typeof vocabSize !== "number" || vocabSize % 1 !== 0 || vocabSize < 256) {
        throw new TypeError("vocabSize must be an integer >= 256 (the first 256 tokens are the bytes themselves)");
      }
      if (merges.length) throw new Error("this tokenizer is already trained — create a fresh one (a vocabulary is not silently rewritten)");
      // one list of byte-ids per chunk — merges stay inside these lists
      var chunkList = chunks(text).map(function (ch) { return Array.from(enc.encode(ch)); });
      var numMerges = vocabSize - 256;
      for (var m = 0; m < numMerges; m++) {
        var s = pairStats(chunkList);
        var bestKey = null, bestCount = 0;
        for (var o = 0; o < s.order.length; o++) {          // first-seen order breaks ties
          if (s.counts[s.order[o]] > bestCount) { bestCount = s.counts[s.order[o]]; bestKey = s.order[o]; }
        }
        if (bestCount < 2) break; // no adjacent pair repeats within any chunk — merging compresses nothing
        var ab = bestKey.split(",");
        var a = parseInt(ab[0], 10), b = parseInt(ab[1], 10);
        var id = 256 + merges.length;
        for (var c = 0; c < chunkList.length; c++) chunkList[c] = mergePair(chunkList[c], a, b, id);
        rank[bestKey] = merges.length;
        merges.push({ a: a, b: b, id: id });
        vocab[id] = bytesOf(a).concat(bytesOf(b));
      }
      return { learned: merges.length, requested: numMerges, vocabSize: 256 + merges.length };
    }

    // greedy lowest-rank BPE over one chunk's byte-ids (minbpe's law, per chunk)
    function encodeChunk(ids) {
      while (ids.length >= 2) {
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

    function encode(text) {
      if (typeof text !== "string") throw new TypeError("encode requires a string");
      var out = [];
      chunks(text).forEach(function (ch) {          // encode each chunk independently, then concatenate
        out = out.concat(encodeChunk(Array.from(enc.encode(ch))));
      });
      return out;
    }

    function decode(ids) {
      if (!Array.isArray(ids)) throw new TypeError("decode requires an array of token ids");
      var bytes = [];
      ids.forEach(function (id) { bytes = bytes.concat(bytesOf(id)); });
      return dec.decode(new Uint8Array(bytes));
    }

    function mergesOf() { return merges.map(function (m) { return { pair: [m.a, m.b], id: m.id }; }); }
    function vocabSize() { return 256 + merges.length; }
    function pattern() { return source; }
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
      return JSON.stringify({ oceanicTokenizer: 1, algorithm: "minbpe/regex", pattern: source,
        merges: merges.map(function (m) { return [m.a, m.b, m.id]; }) });
    }

    return { train: train, encode: encode, decode: decode, chunks: chunks, pattern: pattern,
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

  createRegexTokenizer.load = function (json) {
    var snap;
    try { snap = JSON.parse(json); } catch (e) { throw new TypeError("load: not a tokenizer snapshot (bad JSON)"); }
    if (!snap || snap.oceanicTokenizer !== 1 || !Array.isArray(snap.merges)) {
      throw new TypeError("load: not an OceanicOS tokenizer snapshot");
    }
    if (snap.algorithm && snap.algorithm !== "minbpe/regex") {
      throw new TypeError("load: this snapshot is a '" + snap.algorithm + "' tokenizer — load it with the matching factory");
    }
    var t = createRegexTokenizer(snap.pattern ? { pattern: snap.pattern } : {});
    t._restore(snap.merges);
    return t;
  };

  return createRegexTokenizer;
});
