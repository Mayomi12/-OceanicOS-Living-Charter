/*
 * Ω∞ OceanicOS :: Special Tokens  (Living Tokenization Studio — boundaries)
 * Build 0027 · Stage 3 (Applications) · zero-runtime (plain browser or any JS engine)
 *
 * Composed ON the Regex Tokenizer (build 0026), which is composed on the Tokenizer
 * (0025) — the doctrine compounding. This is the third and final piece of minbpe's
 * progression: BasicTokenizer → RegexTokenizer → special tokens (the GPT-4 style).
 *
 * A special token is a whole string — e.g. "<|endoftext|>" — that must NEVER be
 * split into bytes or merged by BPE. It is a boundary marker with its own reserved
 * id, sitting ABOVE the BPE vocabulary. This wrapper:
 *   - registerSpecial({ "<|endoftext|>": 100257, … }) — ids must not collide with
 *     the byte/merge vocabulary below them.
 *   - encode(text, { allowedSpecial }) — like minbpe: "none" (default) treats the
 *     markers as ordinary text; "all" or an explicit list lifts the listed markers
 *     out as single reserved ids and BPE-encodes only the text between them.
 *   - decode(ids) — reserved ids become their exact string; runs of ordinary ids
 *     pass through the underlying tokenizer so multi-byte characters reassemble.
 *
 * Charter-shaped guarantees, preserved:
 *   - decode(encode(s, {allowedSpecial:"all"})) === s  (nothing true is lost).
 *   - unknown id on decode is refused, not guessed (registered specials aside).
 *   - the whole model — BPE merges AND special registrations — is portable data.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./regex-tokenizer.js"));
  else root.OceanicCore = root.OceanicCore || {}, root.OceanicCore.createSpecialTokenizer = factory(root.OceanicCore && root.OceanicCore.createRegexTokenizer);
})(typeof self !== "undefined" ? self : this, function (createRegexTokenizer) {
  "use strict";

  if (typeof createRegexTokenizer !== "function") {
    throw new Error("createSpecialTokenizer is composed on the Regex Tokenizer (build 0026) — load core/regex-tokenizer.js first");
  }

  function deepFreeze(obj) {
    if (obj && typeof obj === "object" && !Object.isFrozen(obj)) {
      Object.freeze(obj);
      Object.keys(obj).forEach(function (k) { deepFreeze(obj[k]); });
    }
    return obj;
  }
  function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

  function createSpecialTokenizer(options) {
    options = options || {};
    var base = options.base || createRegexTokenizer(options);
    var special = {};        // string -> id
    var inverse = {};        // id -> string

    function registerSpecial(map) {
      if (!map || typeof map !== "object") throw new TypeError("registerSpecial expects an object { name: id }");
      var floor = base.vocabSize();
      Object.keys(map).forEach(function (name) {
        var id = map[name];
        if (!name) throw new TypeError("special token name must be a non-empty string");
        if (typeof id !== "number" || id !== Math.floor(id)) throw new TypeError("special token id must be an integer: " + name);
        if (id < floor) throw new RangeError("special id " + id + " for " + JSON.stringify(name) + " collides with the BPE vocabulary (< " + floor + ") — reserve ids above it");
        if (inverse[id] !== undefined && inverse[id] !== name) throw new RangeError("special id " + id + " is already assigned to " + JSON.stringify(inverse[id]));
        special[name] = id;
        inverse[id] = name;
      });
      return specialTokens();
    }

    function specialTokens() { return deepFreeze(Object.keys(special).map(function (n) { return { token: n, id: special[n] }; })); }

    function resolveAllowed(allowedSpecial) {
      if (allowedSpecial === "all") return Object.keys(special);
      if (!allowedSpecial || allowedSpecial === "none") return [];
      if (Array.isArray(allowedSpecial)) {
        return allowedSpecial.filter(function (n) {
          if (special[n] === undefined) throw new RangeError("allowedSpecial names an unregistered token: " + JSON.stringify(n));
          return true;
        });
      }
      throw new TypeError('allowedSpecial must be "all", "none", or an array of registered token names');
    }

    function train(text, vocabSize, opts) { return base.train(text, vocabSize, opts); }

    function encode(text, opts) {
      opts = opts || {};
      var allowed = resolveAllowed(opts.allowedSpecial);
      text = String(text == null ? "" : text);
      if (allowed.length === 0) return base.encode(text); // markers are ordinary text
      // longest-first so "<|endoftext|>" wins over any shorter overlapping marker
      allowed.sort(function (a, b) { return b.length - a.length; });
      var re = new RegExp("(" + allowed.map(escapeRegex).join("|") + ")");
      var parts = text.split(re); // capturing group keeps the delimiters at odd indices
      var out = [];
      for (var i = 0; i < parts.length; i++) {
        var seg = parts[i];
        if (seg === "") continue;
        if (special[seg] !== undefined && allowed.indexOf(seg) >= 0) out.push(special[seg]);
        else { var e = base.encode(seg); for (var j = 0; j < e.length; j++) out.push(e[j]); }
      }
      return out;
    }

    function decode(ids) {
      if (!Array.isArray(ids)) throw new TypeError("decode requires an array of ids");
      var out = "", run = [];
      function flush() { if (run.length) { out += base.decode(run); run = []; } }
      for (var i = 0; i < ids.length; i++) {
        if (inverse[ids[i]] !== undefined) { flush(); out += inverse[ids[i]]; }
        else run.push(ids[i]);
      }
      flush();
      return out;
    }

    function exportModel() {
      return JSON.stringify({ v: 1, kind: "special", base: JSON.parse(base.exportModel()), special: special });
    }
    function loadModel(json) {
      var model = typeof json === "string" ? JSON.parse(json) : json;
      if (!model || !model.base) throw new TypeError("loadModel: expected { base, special }");
      base.loadModel(model.base);
      special = {}; inverse = {};
      if (model.special) registerSpecial(model.special);
      return status();
    }

    function status() {
      var s = base.status();
      return deepFreeze({ trained: s.trained, baseVocab: 256, merges: s.merges, vocabSize: base.vocabSize(),
        specials: Object.keys(special).length, kind: "special" });
    }

    return {
      registerSpecial: registerSpecial, specialTokens: specialTokens,
      train: train, encode: encode, decode: decode,
      splitText: function (t) { return base.splitText(t); },
      merges: function () { return base.merges(); },
      vocabSize: function () { return base.vocabSize(); },
      exportModel: exportModel, loadModel: loadModel,
      status: status, reset: function () { base.reset(); special = {}; inverse = {}; },
      base: base
    };
  }

  return createSpecialTokenizer;
});
