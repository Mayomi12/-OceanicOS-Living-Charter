/*
 * Ω∞ OceanicOS :: Regex Tokenizer  (Living Tokenization Studio — GPT-style)
 * Build 0026 · Stage 3 (Applications) · zero-runtime (plain browser or any JS engine)
 *
 * Composed ON the Tokenizer (build 0025): reuses its self-contained UTF-8 codec,
 * and adds the one thing that separates minbpe's RegexTokenizer from its
 * BasicTokenizer — a pre-tokenization split. Text is first cut into chunks on a
 * GPT-4-style regular expression; BPE then runs INSIDE each chunk only. Merges
 * never cross a chunk boundary, so " Drop" and "Drop" stay distinguishable and
 * punctuation never fuses onto a word. Pair frequencies are still counted across
 * the whole corpus, exactly as minbpe does.
 *
 * On the split pattern: minbpe's GPT-4 pattern uses possessive quantifiers (`++`,
 * `?+`) and an inline case-insensitive group `(?i:…)`, neither portable across all
 * JS engines. This is the same pattern adapted to run everywhere: greedy instead
 * of possessive (same matches here), the contraction group spelled out for both
 * cases, `\p{L}`/`\p{N}` under the `u` flag. It splits identically on ordinary
 * text and, crucially, is LOSSLESS — the chunks always concatenate back to the
 * input, so the round-trip guarantee is preserved.
 *
 * Charter-shaped guarantees carried over from 0025:
 *   - decode(encode(s)) === s, before or after training (nothing true is lost).
 *   - unknown id on decode is refused, not guessed.
 *   - a trained model is portable data (exportModel / loadModel).
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./tokenizer.js"));
  else root.OceanicCore = root.OceanicCore || {}, root.OceanicCore.createRegexTokenizer = factory(root.OceanicCore && root.OceanicCore.createTokenizer);
})(typeof self !== "undefined" ? self : this, function (createTokenizer) {
  "use strict";

  if (!createTokenizer || !createTokenizer._utf8) {
    throw new Error("createRegexTokenizer is composed on the Tokenizer (build 0025) — load core/tokenizer.js first");
  }
  var utf8 = createTokenizer._utf8; // reuse the 0025 codec — composition, not duplication

  // GPT-4-style split, adapted for portable JS (see header note).
  var GPT4ISH =
    /'(?:[sdmt]|ll|ve|re)|'(?:[SDMT]|LL|VE|RE)|[^\r\n\p{L}\p{N}]?\p{L}+|\p{N}{1,3}| ?[^\s\p{L}\p{N}]+[\r\n]*|\s*[\r\n]|\s+(?!\S)|\s+/gu;

  function deepFreeze(obj) {
    if (obj && typeof obj === "object" && !Object.isFrozen(obj)) {
      Object.freeze(obj);
      Object.keys(obj).forEach(function (k) { deepFreeze(obj[k]); });
    }
    return obj;
  }

  function splitText(text) {
    return String(text == null ? "" : text).match(GPT4ISH) || [];
  }

  // Replace every occurrence of the pair (a,b) with newid, within one chunk.
  function mergePair(ids, a, b, newid) {
    var out = [], i = 0;
    while (i < ids.length) {
      if (i < ids.length - 1 && ids[i] === a && ids[i + 1] === b) { out.push(newid); i += 2; }
      else { out.push(ids[i]); i += 1; }
    }
    return out;
  }

  function createRegexTokenizer(options) {
    options = options || {};
    var pattern = options.pattern || GPT4ISH;

    var mergeRank, mergePairId, mergeList, vocab;

    function reset() {
      mergeRank = {}; mergePairId = {}; mergeList = [];
      vocab = {};
      for (var i = 0; i < 256; i++) vocab[i] = [i];
    }
    reset();

    function currentSplit(text) {
      return (String(text == null ? "" : text).match(pattern) || []);
    }

    function assertVocabSize(v) {
      if (typeof v !== "number" || v !== Math.floor(v) || v < 256) {
        throw new TypeError("vocabSize must be an integer >= 256 (256 is the raw byte alphabet)");
      }
    }

    // Count adjacent pairs across ALL chunks, remembering first-occurrence order
    // (so ties break deterministically, matching minbpe / Python dict order).
    function crossChunkStats(chunks) {
      var counts = {}, order = [];
      for (var c = 0; c < chunks.length; c++) {
        var ids = chunks[c];
        for (var i = 0; i < ids.length - 1; i++) {
          var k = ids[i] + "," + ids[i + 1];
          if (counts[k] === undefined) { counts[k] = 0; order.push(k); }
          counts[k] += 1;
        }
      }
      return { counts: counts, order: order };
    }

    function train(text, vocabSize, opts) {
      opts = opts || {};
      assertVocabSize(vocabSize);
      var numMerges = vocabSize - 256;
      var pieces = currentSplit(text);
      var chunks = pieces.map(function (p) { return utf8.encode(p); });
      var inputBytes = chunks.reduce(function (n, c) { return n + c.length; }, 0);
      reset();
      var performed = 0;
      for (var i = 0; i < numMerges; i++) {
        var s = crossChunkStats(chunks);
        if (s.order.length === 0) break;                  // no pair left anywhere
        var bestK = s.order[0], best = s.counts[bestK];
        for (var j = 1; j < s.order.length; j++) {
          if (s.counts[s.order[j]] > best) { best = s.counts[s.order[j]]; bestK = s.order[j]; }
        }
        if (opts.minFrequency && best < opts.minFrequency) break;
        var p = bestK.split(","), a = +p[0], b = +p[1];
        var newid = 256 + performed;
        chunks = chunks.map(function (ids) { return mergePair(ids, a, b, newid); });
        mergeRank[bestK] = performed;
        mergePairId[bestK] = newid;
        vocab[newid] = vocab[a].concat(vocab[b]);
        mergeList.push({ index: performed, pair: [a, b], id: newid });
        performed += 1;
      }
      var tokens = chunks.reduce(function (n, c) { return n + c.length; }, 0);
      return deepFreeze({
        requestedVocabSize: vocabSize,
        achievedVocabSize: 256 + performed,
        mergesRequested: numMerges,
        mergesPerformed: performed,
        chunks: pieces.length,
        inputBytes: inputBytes,
        tokens: tokens,
        compression: tokens ? +(inputBytes / tokens).toFixed(4) : 0
      });
    }

    function encodeChunk(ids) {
      while (ids.length >= 2) {
        var minRank = Infinity, minKey = null;
        for (var i = 0; i < ids.length - 1; i++) {
          var k = ids[i] + "," + ids[i + 1];
          var r = mergeRank[k];
          if (r !== undefined && r < minRank) { minRank = r; minKey = k; }
        }
        if (minKey === null) break;
        var p = minKey.split(",");
        ids = mergePair(ids, +p[0], +p[1], mergePairId[minKey]);
      }
      return ids;
    }

    function encode(text) {
      var pieces = currentSplit(text);
      var out = [];
      for (var c = 0; c < pieces.length; c++) {
        var enc = encodeChunk(utf8.encode(pieces[c]));
        for (var i = 0; i < enc.length; i++) out.push(enc[i]);
      }
      return out;
    }

    function decode(ids) {
      if (!Array.isArray(ids)) throw new TypeError("decode requires an array of ids");
      var bytes = [];
      for (var i = 0; i < ids.length; i++) {
        var v = vocab[ids[i]];
        if (v === undefined) throw new RangeError("decode: unknown token id " + ids[i] + " — refused, not guessed");
        for (var j = 0; j < v.length; j++) bytes.push(v[j]);
      }
      return utf8.decode(bytes);
    }

    function merges() {
      return deepFreeze(mergeList.map(function (m) { return { index: m.index, pair: m.pair.slice(), id: m.id }; }));
    }
    function vocabSize() { return 256 + mergeList.length; }

    function exportModel() {
      return JSON.stringify({ v: 1, kind: "regex", merges: mergeList.map(function (m) { return [m.pair[0], m.pair[1], m.id]; }) });
    }
    function loadModel(json) {
      var model = typeof json === "string" ? JSON.parse(json) : json;
      if (!model || !Array.isArray(model.merges)) throw new TypeError("loadModel: expected { merges: [[a,b,id], …] }");
      reset();
      for (var i = 0; i < model.merges.length; i++) {
        var m = model.merges[i], a = m[0], b = m[1], id = m[2];
        if (vocab[a] === undefined || vocab[b] === undefined) throw new RangeError("loadModel: merge " + i + " references an unknown id");
        var key = a + "," + b;
        mergeRank[key] = i; mergePairId[key] = id;
        vocab[id] = vocab[a].concat(vocab[b]);
        mergeList.push({ index: i, pair: [a, b], id: id });
      }
      return status();
    }

    function status() {
      return deepFreeze({ trained: mergeList.length > 0, baseVocab: 256, merges: mergeList.length, vocabSize: vocabSize(), kind: "regex" });
    }

    return {
      train: train, encode: encode, decode: decode,
      splitText: function (t) { return currentSplit(t).slice(); },
      merges: merges, vocabSize: vocabSize,
      exportModel: exportModel, loadModel: loadModel,
      status: status, reset: reset
    };
  }

  createRegexTokenizer.GPT4ISH = GPT4ISH;
  createRegexTokenizer.splitText = splitText;
  return createRegexTokenizer;
});
