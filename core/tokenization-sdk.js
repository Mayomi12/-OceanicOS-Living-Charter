/*
 * Ω∞ OceanicOS :: Tokenization SDK  (Living Tokenization Studio — the front door)
 * Build 0028 · Stage 3 (Applications) · zero-runtime (plain browser or any JS engine)
 *
 * One import, the whole tokenization subsystem. Builds 0025–0027 produced three
 * tokenizers that share an API but must be reached by three different factory
 * names. This is their front door — the same move the Developer SDK (0020) made
 * for the system as a whole, scoped here to tokenization:
 *
 *   var T  = OceanicTokenizers;              // the public namespace
 *   var tk = T.create("regex");             // pick a kind, get a ready tokenizer
 *   T.describe();                            // the three kinds, self-described
 *   T.compare("hello world", { corpus });   // how each kind tokenizes the same text
 *
 * Composed ON the Tokenizer (0025), Regex Tokenizer (0026) and Special Tokens
 * (0027). It adds no new tokenization logic — it makes the existing capabilities
 * discoverable, selectable, self-describing, and comparable. Nothing is hidden:
 * create() returns the very same handles the underlying factories return.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./tokenizer.js"), require("./regex-tokenizer.js"), require("./special-tokens.js"));
  } else {
    var C = root.OceanicCore || (root.OceanicCore = {});
    var api = factory(C.createTokenizer, C.createRegexTokenizer, C.createSpecialTokenizer);
    C.createTokenization = api.createTokenization;
    root.OceanicTokenizers = api.namespace; // public front door
  }
})(typeof self !== "undefined" ? self : this, function (createTokenizer, createRegexTokenizer, createSpecialTokenizer) {
  "use strict";

  if (typeof createTokenizer !== "function" || typeof createRegexTokenizer !== "function" || typeof createSpecialTokenizer !== "function") {
    throw new Error("createTokenization needs builds 0025–0027 — load tokenizer.js, regex-tokenizer.js and special-tokens.js first");
  }

  var VERSION = "0.28.0"; // = build 0028

  function deepFreeze(obj) {
    if (obj && typeof obj === "object" && !Object.isFrozen(obj)) {
      Object.freeze(obj);
      Object.keys(obj).forEach(function (k) { deepFreeze(obj[k]); });
    }
    return obj;
  }

  var KINDS = {
    basic:   { factory: createTokenizer,        build: "0025",
               summary: "Byte-level BPE (minbpe BasicTokenizer): merges the most frequent byte pair anywhere.",
               features: ["byte-level", "deterministic", "portable model"] },
    regex:   { factory: createRegexTokenizer,   build: "0026",
               summary: "GPT-style BPE: splits text on a regex first, so merges never cross a word/punctuation boundary.",
               features: ["regex pre-split", "chunk-bounded merges", "lossless split", "portable model"] },
    special: { factory: createSpecialTokenizer, build: "0027",
               summary: "Regex BPE plus whole-string special-token boundary markers with reserved ids above the vocabulary.",
               features: ["special tokens", "allowedSpecial none/all/list", "reserved ids", "portable model"] }
  };

  function createTokenization(options) {
    options = options || {};

    function create(kind, opts) {
      kind = kind || "regex";
      var spec = KINDS[kind];
      if (!spec) throw new RangeError('unknown tokenizer kind: "' + kind + '" — expected one of ' + Object.keys(KINDS).join(", "));
      return spec.factory(opts || {});
    }

    function kinds() { return Object.keys(KINDS); }

    function describe() {
      return deepFreeze({
        version: VERSION,
        kinds: Object.keys(KINDS).map(function (k) {
          return { kind: k, build: KINDS[k].build, summary: KINDS[k].summary, features: KINDS[k].features.slice() };
        })
      });
    }

    // Show how each kind tokenizes the SAME text after training on the SAME corpus.
    // A single, honest, apples-to-apples view of the difference between the kinds.
    function compare(text, opts) {
      opts = opts || {};
      var vocabSize = opts.vocabSize || 300;
      var corpus = opts.corpus == null ? text : opts.corpus;
      text = String(text == null ? "" : text);
      var utf8bytes = createTokenizer._utf8.encode(text).length;
      var rows = ["basic", "regex"].map(function (k) {
        var tk = create(k);
        tk.train(corpus, vocabSize);
        var ids = tk.encode(text);
        var roundTrips = tk.decode(ids) === text;
        return {
          kind: k, build: KINDS[k].build,
          tokens: ids.length,
          compression: ids.length ? +(utf8bytes / ids.length).toFixed(4) : 0,
          roundTrips: roundTrips,
          ids: ids.slice()
        };
      });
      return deepFreeze({ text: text, utf8Bytes: utf8bytes, vocabSize: vocabSize, results: rows });
    }

    return { version: VERSION, create: create, kinds: kinds, describe: describe, compare: compare };
  }

  createTokenization.VERSION = VERSION;
  createTokenization.KINDS = Object.keys(KINDS);

  // the public namespace mirrors the OceanicOS SDK shape: version + a single create()
  var singleton = createTokenization();
  var namespace = {
    version: VERSION,
    create: singleton.create,
    kinds: singleton.kinds,
    describe: singleton.describe,
    compare: singleton.compare
  };

  return { createTokenization: createTokenization, namespace: namespace, VERSION: VERSION };
});
