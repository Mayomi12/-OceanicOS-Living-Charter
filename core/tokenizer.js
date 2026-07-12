/*
 * Ω∞ OceanicOS :: Tokenizer  (Living Tokenization Studio — the engine)
 * Build 0025 · Stage 3 (Applications) · zero-runtime (plain browser or any JS engine)
 *
 * The Root the Vision Edition of the Living Agnostic Charter declares:
 *   Root — Tokenizer: minbpe (Karpathy);  Kernel: Living Tokenization Studio.
 * This is that root, realized: a faithful, dependency-free port of the byte-level
 * Byte-Pair-Encoding of Karpathy's minbpe `BasicTokenizer`.
 *
 * What it does, exactly as minbpe's BasicTokenizer does:
 *   - text → UTF-8 bytes (ids 0..255), a self-contained UTF-8 codec (no TextEncoder
 *     dependency, so it runs identically in a browser or a bare JS engine).
 *   - train(text, vocabSize): repeatedly merge the most frequent adjacent pair,
 *     minting one new id per merge (256, 257, …). Ties break by first occurrence,
 *     matching Python's `max(stats, key=stats.get)` over insertion-ordered counts —
 *     so training is deterministic.
 *   - encode(text): greedily apply the learned merges in the order they were learned
 *     (lowest merge-rank first), exactly like minbpe.
 *   - decode(ids): concatenate each id's byte expansion and read it back as UTF-8.
 *
 * Charter-shaped guarantees:
 *   - HONEST round-trip: for any string, decode(encode(s)) === s, before OR after
 *     training — tokenization never loses the text (Article II: nothing true is lost).
 *   - NO SILENT LOSS on decode: an unknown id is refused (RangeError), not guessed.
 *   - A trained model is portable data (exportModel / loadModel) — platform-agnostic.
 *
 * Design constraints (house style of core/memory.js, core/verify-engine.js):
 *   - No dependencies. Deterministic. Returned model views are deep-frozen copies.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.OceanicCore = root.OceanicCore || {}, root.OceanicCore.createTokenizer = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function deepFreeze(obj) {
    if (obj && typeof obj === "object" && !Object.isFrozen(obj)) {
      Object.freeze(obj);
      Object.keys(obj).forEach(function (k) { deepFreeze(obj[k]); });
    }
    return obj;
  }

  /* ---- self-contained UTF-8 codec (no TextEncoder/TextDecoder dependency) ---- */
  function utf8Encode(str) {
    var bytes = [];
    for (var i = 0; i < str.length; i++) {
      var c = str.codePointAt(i);
      if (c > 0xFFFF) i++; // a surrogate pair was consumed by codePointAt
      if (c < 0x80) bytes.push(c);
      else if (c < 0x800) bytes.push(0xC0 | (c >> 6), 0x80 | (c & 0x3F));
      else if (c < 0x10000) bytes.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 0x3F), 0x80 | (c & 0x3F));
      else bytes.push(0xF0 | (c >> 18), 0x80 | ((c >> 12) & 0x3F), 0x80 | ((c >> 6) & 0x3F), 0x80 | (c & 0x3F));
    }
    return bytes;
  }

  // Tolerant decoder (like minbpe's errors="replace"): malformed bytes become U+FFFD.
  function utf8Decode(bytes) {
    var out = "", i = 0, n = bytes.length;
    function cont(k) { return i + k < n && (bytes[i + k] & 0xC0) === 0x80; }
    while (i < n) {
      var b = bytes[i];
      if (b < 0x80) { out += String.fromCodePoint(b); i += 1; }
      else if ((b >> 5) === 0x6) {
        if (cont(1)) { var c1 = ((b & 0x1F) << 6) | (bytes[i + 1] & 0x3F); out += c1 >= 0x80 ? String.fromCodePoint(c1) : "�"; i += 2; }
        else { out += "�"; i += 1; }
      } else if ((b >> 4) === 0xE) {
        if (cont(1) && cont(2)) { var c2 = ((b & 0x0F) << 12) | ((bytes[i + 1] & 0x3F) << 6) | (bytes[i + 2] & 0x3F); out += c2 >= 0x800 ? String.fromCodePoint(c2) : "�"; i += 3; }
        else { out += "�"; i += 1; }
      } else if ((b >> 3) === 0x1E) {
        if (cont(1) && cont(2) && cont(3)) { var c3 = ((b & 0x07) << 18) | ((bytes[i + 1] & 0x3F) << 12) | ((bytes[i + 2] & 0x3F) << 6) | (bytes[i + 3] & 0x3F); out += (c3 >= 0x10000 && c3 <= 0x10FFFF) ? String.fromCodePoint(c3) : "�"; i += 4; }
        else { out += "�"; i += 1; }
      } else { out += "�"; i += 1; }
    }
    return out;
  }

  /* ---- BPE primitives ---- */
  // Adjacent-pair counts in first-occurrence order (order matters for tie-breaking).
  function statsWithOrder(ids) {
    var counts = {}, order = [];
    for (var i = 0; i < ids.length - 1; i++) {
      var k = ids[i] + "," + ids[i + 1];
      if (counts[k] === undefined) { counts[k] = 0; order.push(k); }
      counts[k] += 1;
    }
    return { counts: counts, order: order };
  }

  // The most frequent pair; ties resolved by first occurrence (minbpe/Python parity).
  function bestPair(ids) {
    var s = statsWithOrder(ids);
    if (s.order.length === 0) return null;
    var bestK = s.order[0], best = s.counts[bestK];
    for (var j = 1; j < s.order.length; j++) {
      if (s.counts[s.order[j]] > best) { best = s.counts[s.order[j]]; bestK = s.order[j]; }
    }
    var p = bestK.split(",");
    return { key: bestK, a: +p[0], b: +p[1], count: best };
  }

  // Replace every occurrence of the pair (a,b) with newid.
  function mergePair(ids, a, b, newid) {
    var out = [], i = 0;
    while (i < ids.length) {
      if (i < ids.length - 1 && ids[i] === a && ids[i + 1] === b) { out.push(newid); i += 2; }
      else { out.push(ids[i]); i += 1; }
    }
    return out;
  }

  function createTokenizer(options) {
    options = options || {};

    var mergeRank;    // "a,b" -> merge index (learn order; lower = applied first)
    var mergePairId;  // "a,b" -> minted id
    var mergeList;    // [{ index, pair:[a,b], id }] in learn order
    var vocab;        // id -> array of raw bytes

    function reset() {
      mergeRank = {}; mergePairId = {}; mergeList = [];
      vocab = {};
      for (var i = 0; i < 256; i++) vocab[i] = [i];
    }
    reset();

    function assertVocabSize(v) {
      if (typeof v !== "number" || v !== Math.floor(v) || v < 256) {
        throw new TypeError("vocabSize must be an integer >= 256 (256 is the raw byte alphabet)");
      }
    }

    function train(text, vocabSize, opts) {
      opts = opts || {};
      assertVocabSize(vocabSize);
      var numMerges = vocabSize - 256;
      var ids = utf8Encode(String(text == null ? "" : text));
      var inputBytes = ids.length;
      reset();
      var performed = 0;
      for (var i = 0; i < numMerges; i++) {
        var bp = bestPair(ids);
        if (!bp) break;                 // nothing left to merge — honest early stop
        if (opts.minFrequency && bp.count < opts.minFrequency) break;
        var newid = 256 + performed;
        ids = mergePair(ids, bp.a, bp.b, newid);
        mergeRank[bp.key] = performed;
        mergePairId[bp.key] = newid;
        vocab[newid] = vocab[bp.a].concat(vocab[bp.b]);
        mergeList.push({ index: performed, pair: [bp.a, bp.b], id: newid });
        performed += 1;
      }
      return deepFreeze({
        requestedVocabSize: vocabSize,
        achievedVocabSize: 256 + performed,
        mergesRequested: numMerges,
        mergesPerformed: performed,
        inputBytes: inputBytes,
        tokens: ids.length,
        compression: ids.length ? +(inputBytes / ids.length).toFixed(4) : 0
      });
    }

    function encode(text) {
      var ids = utf8Encode(String(text == null ? "" : text));
      while (ids.length >= 2) {
        var minRank = Infinity, minKey = null;
        for (var i = 0; i < ids.length - 1; i++) {
          var k = ids[i] + "," + ids[i + 1];
          var r = mergeRank[k];
          if (r !== undefined && r < minRank) { minRank = r; minKey = k; }
        }
        if (minKey === null) break;     // no learned merge applies — done
        var p = minKey.split(",");
        ids = mergePair(ids, +p[0], +p[1], mergePairId[minKey]);
      }
      return ids;
    }

    function decode(ids) {
      if (!Array.isArray(ids)) throw new TypeError("decode requires an array of ids");
      var bytes = [];
      for (var i = 0; i < ids.length; i++) {
        var v = vocab[ids[i]];
        if (v === undefined) throw new RangeError("decode: unknown token id " + ids[i] + " — refused, not guessed");
        for (var j = 0; j < v.length; j++) bytes.push(v[j]);
      }
      return utf8Decode(bytes);
    }

    function getStats(text) {
      var ids = Array.isArray(text) ? text : utf8Encode(String(text == null ? "" : text));
      return statsWithOrder(ids).counts;
    }

    function merges() {
      return deepFreeze(mergeList.map(function (m) { return { index: m.index, pair: m.pair.slice(), id: m.id }; }));
    }

    function vocabSize() { return 256 + mergeList.length; }

    function exportModel() {
      // merges in learn order are sufficient to rebuild vocab deterministically.
      return JSON.stringify({ v: 1, merges: mergeList.map(function (m) { return [m.pair[0], m.pair[1], m.id]; }) });
    }

    function loadModel(json) {
      var model = typeof json === "string" ? JSON.parse(json) : json;
      if (!model || !Array.isArray(model.merges)) throw new TypeError("loadModel: expected { merges: [[a,b,id], …] }");
      reset();
      for (var i = 0; i < model.merges.length; i++) {
        var m = model.merges[i], a = m[0], b = m[1], id = m[2];
        if (vocab[a] === undefined || vocab[b] === undefined) throw new RangeError("loadModel: merge " + i + " references an unknown id");
        var key = a + "," + b;
        mergeRank[key] = i;
        mergePairId[key] = id;
        vocab[id] = vocab[a].concat(vocab[b]);
        mergeList.push({ index: i, pair: [a, b], id: id });
      }
      return status();
    }

    function status() {
      return deepFreeze({
        trained: mergeList.length > 0,
        baseVocab: 256,
        merges: mergeList.length,
        vocabSize: vocabSize()
      });
    }

    return {
      train: train, encode: encode, decode: decode,
      getStats: getStats, merges: merges, vocabSize: vocabSize,
      exportModel: exportModel, loadModel: loadModel,
      status: status, reset: reset
    };
  }

  // exposed for verification of the codec in isolation
  createTokenizer._utf8 = { encode: utf8Encode, decode: utf8Decode };
  return createTokenizer;
});
