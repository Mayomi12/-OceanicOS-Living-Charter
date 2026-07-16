/*
 * Ω∞ OceanicOS :: Special Tokens (tokenizer)
 * Build 0079 · Stage 7 (Ecosystem) · zero-runtime (plain browser or any JS engine)
 *
 * ROOT: Andrej Karpathy's minbpe — its THIRD piece, after the Basic (0068) and
 * Regex (0073) tokenizers. Both of those state the same honest limit: "no
 * special tokens." This closes it, faithfully and composably.
 *
 * A special token is a whole string — `<|endoftext|>`, `<|fim_prefix|>` — that
 * must never be split or byte-paired. It is reserved a dedicated id ABOVE the
 * base vocabulary, matched in the raw text before the base tokenizer sees it,
 * and emitted as that one id; on decode it comes back verbatim. So a document
 * boundary is one token, not the byte soup of "<", "|", "endoftext", …
 *
 * This is a WRAPPER, not a rewrite: give it any trained OceanicOS tokenizer
 * (Basic or Regex) and a name→id map, and it composes special-token handling
 * over that tokenizer's own encode/decode. The base is never modified.
 *
 *   createSpecialTokenizer({ base, specials })   // specials: { "<|eot|>": 100000, … }
 *   encode(text, { allowed })  // allowed: array of names | "all" (default) | "none"
 *   decode(ids) → text         // specials come back verbatim; decode∘encode ≡ identity
 *   specials() · specialIds() · tokenOf(id) · vocabSize()   // {base, specials, size}
 *
 * THE STATED LIMIT (house honesty): ids must be reserved ABOVE the base vocab
 * and are the caller's to choose (as in minbpe — special ids are a convention,
 * not learned). With `allowed:"all"`, any literal occurrence of a special
 * string is treated as special — that is minbpe's documented behaviour; pass
 * `allowed:"none"` (or omit a name) to encode it as ordinary text instead.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.OceanicCore = root.OceanicCore || {}, root.OceanicCore.createSpecialTokenizer = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

  function createSpecialTokenizer(options) {
    options = options || {};
    var base = options.base;
    if (!base || typeof base.encode !== "function" || typeof base.decode !== "function" ||
        typeof base.vocabSize !== "function" || typeof base.tokenOf !== "function") {
      throw new TypeError("createSpecialTokenizer needs { base } — a trained OceanicOS tokenizer (build 0068 or 0073)");
    }
    var specials = options.specials || {};
    var names = Object.keys(specials);
    var floor = base.vocabSize();
    var idToName = {};
    names.forEach(function (name) {
      if (!name) throw new TypeError("a special token name must be a non-empty string");
      var id = specials[name];
      if (typeof id !== "number" || id % 1 !== 0) throw new TypeError("special '" + name + "' needs an integer id");
      if (id < floor) throw new RangeError("special '" + name + "' id " + id + " collides with the base vocabulary (must be >= " + floor + ")");
      if (idToName[id] !== undefined) throw new Error("special id " + id + " is claimed by both '" + idToName[id] + "' and '" + name + "'");
      idToName[id] = name;
    });

    // longest name first, so "<|endoftext|>" wins over any shorter prefix special
    function splitter(allowedNames) {
      if (!allowedNames.length) return null;
      var pattern = allowedNames.slice().sort(function (a, b) { return b.length - a.length; })
                                .map(escapeRegex).join("|");
      return new RegExp("(" + pattern + ")");
    }

    function resolveAllowed(allowed) {
      if (allowed === undefined || allowed === "all") return names.slice();
      if (allowed === "none") return [];
      if (Array.isArray(allowed)) {
        allowed.forEach(function (n) { if (!(n in specials)) throw new Error("encode: '" + n + "' is not a registered special token"); });
        return allowed.slice();
      }
      throw new TypeError("encode: allowed must be an array of names, \"all\", or \"none\"");
    }

    function encode(text, opts) {
      if (typeof text !== "string") throw new TypeError("encode requires a string");
      opts = opts || {};
      var allowedNames = resolveAllowed(opts.allowed);
      var re = splitter(allowedNames);
      if (!re) return base.encode(text);                 // nothing special allowed — pure base
      var out = [];
      text.split(re).forEach(function (part) {
        if (part === "") return;
        if (allowedNames.indexOf(part) >= 0) out.push(specials[part]);   // a whole special → its reserved id
        else out = out.concat(base.encode(part));                        // ordinary run → base BPE
      });
      return out;
    }

    function decode(ids) {
      if (!Array.isArray(ids)) throw new TypeError("decode requires an array of token ids");
      var text = "", run = [];
      function flush() { if (run.length) { text += base.decode(run); run = []; } }
      ids.forEach(function (id) {
        if (idToName[id] !== undefined) { flush(); text += idToName[id]; }   // special → its name, verbatim
        else run.push(id);
      });
      flush();
      return text;
    }

    function tokenOf(id) {
      if (idToName[id] !== undefined) return { id: id, special: true, text: idToName[id] };
      var t = base.tokenOf(id);
      t.special = false;
      return t;
    }

    function specialsMap() { var copy = {}; names.forEach(function (n) { copy[n] = specials[n]; }); return copy; }
    function specialIds() { return names.map(function (n) { return specials[n]; }); }
    function vocabSize() { return { base: floor, specials: names.length, size: floor + names.length }; }

    return { encode: encode, decode: decode, tokenOf: tokenOf,
             specials: specialsMap, specialIds: specialIds, vocabSize: vocabSize };
  }

  return createSpecialTokenizer;
});
